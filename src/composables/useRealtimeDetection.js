import { ref, reactive } from 'vue'
import { supabase } from './useSupabase'
import { usePartCharacteristics } from './usePartCharacteristics'

export function useRealtimeDetection() {
  const loading = ref(false)
  const error = ref(null)
  const detecting = ref(false)
  
  // 검출 상태
  const detectionState = reactive({
    isActive: false,
    currentSession: null,
    targetSet: null,
    targetParts: [],
    detectedParts: [],
    matchedParts: [],
    missingParts: [],
    statistics: {
      totalDetected: 0,
      autoApproved: 0,
      manualReview: 0,
      retakeRequired: 0,
      accuracy: 0
    }
  })

  const { getPartCharacteristics } = usePartCharacteristics()

  // 세션 시작
  const startDetectionSession = async (setNum) => {
    loading.value = true
    error.value = null

    try {
      // 세션 ID 생성
      const sessionId = crypto.randomUUID()
      
      // 타겟 세트 부품 로드
      const targetParts = await getPartCharacteristics(setNum)
      
      if (!targetParts || targetParts.length === 0) {
        throw new Error(`세트 ${setNum}의 부품 특징 정보가 없습니다. 먼저 부품 분석을 수행해주세요.`)
      }

      // 검출 상태 초기화
      detectionState.isActive = true
      detectionState.currentSession = sessionId
      detectionState.targetSet = setNum
      detectionState.targetParts = targetParts
      detectionState.detectedParts = []
      detectionState.matchedParts = []
      detectionState.missingParts = []

      console.log(`Detection session started: ${sessionId} for set ${setNum}`)
      console.log(`Target parts loaded: ${targetParts.length}`)

      return {
        sessionId,
        targetParts: targetParts.length,
        message: '검출 세션이 시작되었습니다.'
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 부품 검출 (외부 검출 API 호출)
  const detectParts = async (imageData) => {
    detecting.value = true
    error.value = null

    try {
      const detectionApi = import.meta.env.VITE_DETECTION_API_URL
      if (!detectionApi) throw new Error('Missing VITE_DETECTION_API_URL')
      const res = await fetch(detectionApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageData })
      })
      if (!res.ok) throw new Error(`Detection API Error: ${res.status}`)
      const payload = await res.json()
      const detections = (payload.detections || []).map(d => ({
        id: crypto.randomUUID(),
        boundingBox: d.bbox, // {x,y,width,height} normalized or px per API
        confidence: d.confidence,
        image: imageData,
        timestamp: new Date().toISOString()
      }))
      
      // 검출 로그 저장
      for (const detection of detections) {
        await logDetection(detection)
      }

      detectionState.detectedParts.push(...detections)
      detectionState.statistics.totalDetected += detections.length

      return detections
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      detecting.value = false
    }
  }

  // 다단계 필터링 시스템
  const multiStageFiltering = async (detectedParts) => {
    const filteredResults = []

    for (const detectedPart of detectedParts) {
      try {
        // 1단계: 색상 필터링 (150 → 30개)
        const colorFiltered = await colorFilter(detectedPart, detectionState.targetParts)
        
        // 2단계: 크기 필터링 (30 → 10개)
        const sizeFiltered = await sizeFilter(colorFiltered, detectedPart)
        
        // 3단계: CLIP 유사도 (10 → 5개)
        const clipFiltered = await clipSimilarityFilter(sizeFiltered, detectedPart)
        
        filteredResults.push({
          detectedPart,
          candidates: clipFiltered,
          stage: 'filtered'
        })
      } catch (err) {
        console.error('Filtering failed for part:', err)
      }
    }

    return filteredResults
  }

  // 색상 필터링
  const colorFilter = async (detectedPart, targetParts) => {
    // 외부 색상 추출 API 사용 (필수)
    const colorApi = import.meta.env.VITE_COLOR_EXTRACT_API_URL
    if (!colorApi) throw new Error('Missing VITE_COLOR_EXTRACT_API_URL')
    const res = await fetch(colorApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: detectedPart.image })
    })
    if (!res.ok) throw new Error(`Color API Error: ${res.status}`)
    const { rgb } = await res.json() // {r,g,b}
    
    return targetParts.filter(part => {
      const primary = part.llm_visual_features?.color_characteristics?.primary_rgb || part.llm_visual_features?.color_characteristics?.rgb
      if (!primary) return false
      const distance = calculateColorDistance(rgb, primary)
      return distance < 0.3
    })
  }

  // 크기 필터링
  const sizeFilter = async (filteredParts, detectedPart) => {
    const objectSize = calculateObjectSize(detectedPart.boundingBox)
    
    return filteredParts.filter(part => {
      const expectedSize = part.llm_geometric_features?.dimensions
      if (!expectedSize) return true
      
      const sizeRatio = objectSize / parseFloat(expectedSize)
      return sizeRatio > 0.7 && sizeRatio < 1.3 // 70-130% 크기 범위
    })
  }

  // CLIP 유사도 필터링
  const clipSimilarityFilter = async (filteredParts, detectedPart) => {
    // 이미지 임베딩 외부 API 사용
    const detectedEmbedding = await generateClipImageEmbedding(detectedPart.image)
    
    const similarities = filteredParts.map(part => ({
      part,
      similarity: calculateCosineSimilarity(detectedEmbedding, part.clip_embedding)
    }))
    
    // 상위 5개 반환
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(item => ({ part: item.part, similarity: item.similarity }))
  }

  // LLM 후보 재랭킹
  const llmReranking = async (filteredResults) => {
    const enableLLM = (import.meta.env.VITE_ENABLE_LLM_RERANK || 'false') === 'true'
    if (!enableLLM) {
      // LLM 비활성화: vision 점수만 구성하여 반환
      return filteredResults.map(r => ({
        ...r,
        vision: r.candidates && r.candidates.length > 0 ? (r.candidates[0].similarity || 0) : 0,
        // candidates는 { part, similarity } 형태 유지
      }))
    }
    // 활성화된 경우에만 실제 LLM 호출 경로 (선택적 구현)
    const rankedResults = []
    for (const result of filteredResults) {
      try {
        const llmAnalysis = await analyzeWithLLM({
          image: result.detectedPart.image,
          candidates: result.candidates,
          setContext: detectionState.targetSet
        })
        rankedResults.push({
          ...result,
          llm: llmAnalysis.confidence,
          llmRanking: llmAnalysis.ranking
        })
      } catch (err) {
        console.error('LLM reranking failed:', err)
        rankedResults.push({ ...result })
      }
    }
    return rankedResults
  }

  // LLM 분석
  const analyzeWithLLM = async (data) => {
    throw new Error('LLM reranking is not configured. Use useLLMIntegration or disable reranking.')
  }

  // 임계치 기반 자동 승인
  const thresholdBasedApproval = async (rankedResults) => {
    const results = {
      autoApproved: [],
      manualReview: [],
      retakeRequired: []
    }

    for (const result of rankedResults) {
      const finalScore = calculateFinalScore(result)
      
      if (finalScore >= 0.95) {
        results.autoApproved.push({
          ...result,
          status: 'auto_approved',
          confidence: finalScore
        })
        detectionState.statistics.autoApproved++
      } else if (finalScore >= 0.85) {
        results.manualReview.push({
          ...result,
          status: 'manual_review',
          confidence: finalScore,
          topCandidates: result.candidates.slice(0, 3)
        })
        detectionState.statistics.manualReview++
      } else {
        results.retakeRequired.push({
          ...result,
          status: 'retake_required',
          guidance: generateRetakeGuidance(result)
        })
        detectionState.statistics.retakeRequired++
      }
    }

    detectionState.matchedParts.push(...results.autoApproved)
    return results
  }

  // 최종 점수 계산
  const calculateFinalScore = (result) => {
    const weights = {
      vision: 0.4,
      llm: 0.4,
      color: 0.15,
      context: 0.05
    }
    
    let totalScore = 0
    let totalWeight = 0
    
    for (const [type, weight] of Object.entries(weights)) {
      if (result[type] !== undefined) {
        totalScore += result[type] * weight
        totalWeight += weight
      }
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0
  }

  // 재촬영 가이드 생성
  const generateRetakeGuidance = (result) => {
    const guidances = [
      '카메라 각도를 조정해주세요.',
      '조명을 개선해주세요.',
      '부품이 더 명확하게 보이도록 위치를 조정해주세요.',
      '반사광을 피해서 촬영해주세요.'
    ]
    
    return guidances[Math.floor(Math.random() * guidances.length)]
  }

  // 검출 로그 저장
  const logDetection = async (detection) => {
    try {
      const { data, error: dbError } = await supabase
        .from('detection_logs')
        .insert({
          session_id: detectionState.currentSession,
          set_num: detectionState.targetSet,
          detected_part_id: detection.id,
          detection_stage: 'detected',
          confidence_score: detection.confidence,
          processing_time_ms: 100, // 시뮬레이션
          original_image_url: detection.image,
          bounding_box: detection.boundingBox,
          created_at: detection.timestamp
        })

      if (dbError) throw dbError
      return data[0]
    } catch (err) {
      console.error('Failed to log detection:', err)
    }
  }

  // 세션 종료
  const endDetectionSession = async () => {
    try {
      detectionState.isActive = false
      detectionState.currentSession = null
      
      console.log('Detection session ended')
      return { message: '검출 세션이 종료되었습니다.' }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 누락 부품 탐지
  const detectMissingParts = () => {
    const expectedParts = detectionState.targetParts.map(part => ({
      part_num: part.part_num,
      color_id: part.color_id,
      quantity: part.quantity || 1
    }))
    
    const detectedParts = detectionState.matchedParts.map(match => ({
      part_num: match.candidates[0]?.part_num,
      color_id: match.candidates[0]?.color_id,
      quantity: 1
    }))
    
    const missingParts = expectedParts.filter(expected => {
      const detected = detectedParts.find(detected => 
        detected.part_num === expected.part_num && 
        detected.color_id === expected.color_id
      )
      return !detected || detected.quantity < expected.quantity
    })
    
    detectionState.missingParts = missingParts
    return missingParts
  }

  // 유틸리티 함수들
  const extractDominantColor = async (image) => {
    throw new Error('extractDominantColor is not used. Color API is required.')
  }

  const calculateColorDistance = (c1, c2) => {
    // c1: {r,g,b} c2: {r,g,b} | '#RRGGBB'
    const toRgb = (c) => {
      if (typeof c === 'string' && c.startsWith('#')) {
        const r = parseInt(c.slice(1,3), 16)
        const g = parseInt(c.slice(3,5), 16)
        const b = parseInt(c.slice(5,7), 16)
        return { r, g, b }
      }
      return c
    }
    const a = toRgb(c1)
    const b = toRgb(c2)
    if (!a || !b) return 1
    const dr = (a.r - b.r) / 255
    const dg = (a.g - b.g) / 255
    const db = (a.b - b.b) / 255
    return Math.sqrt(dr*dr + dg*dg + db*db) / Math.sqrt(3) // 0-1 정규화
  }

  const calculateObjectSize = (boundingBox) => {
    return boundingBox.width * boundingBox.height
  }

  const generateClipImageEmbedding = async (imageBase64) => {
    const endpoint = import.meta.env.VITE_CLIP_IMAGE_API_URL
    if (!endpoint) throw new Error('Missing VITE_CLIP_IMAGE_API_URL')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, dimensions: 1536 })
    })
    if (!res.ok) throw new Error(`Image embedding API Error: ${res.status}`)
    const data = await res.json()
    if (!data.embedding) throw new Error('Image embedding API response missing embedding')
    return data.embedding
  }

  const calculateCosineSimilarity = (vec1, vec2) => {
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) return 0
    let dot = 0, n1 = 0, n2 = 0
    for (let i = 0; i < vec1.length; i++) {
      const a = vec1[i] || 0
      const b = vec2[i] || 0
      dot += a * b
      n1 += a * a
      n2 += b * b
    }
    if (n1 === 0 || n2 === 0) return 0
    return dot / (Math.sqrt(n1) * Math.sqrt(n2))
  }

  return {
    loading,
    error,
    detecting,
    detectionState,
    startDetectionSession,
    detectParts,
    multiStageFiltering,
    llmReranking,
    thresholdBasedApproval,
    endDetectionSession,
    detectMissingParts
  }
}
