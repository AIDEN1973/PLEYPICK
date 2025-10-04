import { ref } from 'vue'
import { supabase } from './useSupabase'

export function useMasterPartsMatching() {
  const loading = ref(false)
  const error = ref(null)
  const matching = ref(false)

  // 마스터 부품 DB에서 타겟 세트 부품 로드
  const loadTargetSetParts = async (setNum) => {
    loading.value = true
    error.value = null

    try {
      // 1. 세트의 부품 목록 조회
      const { data: setParts, error: setError } = await supabase
        .from('set_parts')
        .select(`
          part_num,
          color_id,
          quantity,
          lego_parts(part_num, name),
          lego_colors(color_id, name, rgb)
        `)
        .eq('set_num', setNum)

      if (setError) throw setError

      // 2. 마스터 부품 특징 정보 조회
      const partNums = setParts.map(sp => sp.part_num)
      const colorIds = setParts.map(sp => sp.color_id)

      const { data: masterParts, error: masterError } = await supabase
        .from('parts_master_features')
        .select('*')
        .in('part_id', partNums)
        .in('color_id', colorIds)

      if (masterError) throw masterError

      // 3. 세트 부품과 마스터 특징 매핑
      const targetParts = setParts.map(setPart => {
        const masterPart = masterParts.find(mp => 
          mp.part_id === setPart.part_num && 
          mp.color_id === setPart.color_id
        )

        return {
          ...setPart,
          master_characteristics: masterPart,
          detection_priority: calculateDetectionPriority(setPart, masterPart)
        }
      })

      return targetParts
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 실시간 부품 매칭 (LLM 없이)
  const matchDetectedPart = async (detectedImage, targetParts) => {
    matching.value = true
    error.value = null

    try {
      // 1. 검출된 이미지의 CLIP 임베딩 생성 (1536차)
      const detectedEmbedding = await generateClipImageEmbedding(detectedImage)
      
      // 2. 타겟 부품들과 유사도 계산
      const similarities = await calculateSimilarities(detectedEmbedding, targetParts)
      
      // 3. 상위 후보 선별 (상위 5개)
      const topCandidates = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)

      // 4. 추가 검증 (색상, 크기, 형태)
      const validatedCandidates = await validateCandidates(topCandidates, detectedImage)
      
      // 5. 최종 점수 계산
      const finalResults = calculateFinalScores(validatedCandidates)

      return finalResults
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      matching.value = false
    }
  }

  // CLIP 유사도 계산
  const calculateSimilarities = async (detectedEmbedding, targetParts) => {
    const similarities = []

    for (const targetPart of targetParts) {
      if (!targetPart.master_characteristics?.clip_text_emb) continue

      // 코사인 유사도 계산
      const similarity = calculateCosineSimilarity(
        detectedEmbedding,
        targetPart.master_characteristics.clip_text_emb
      )

      similarities.push({
        part: targetPart,
        similarity: similarity,
        confidence: similarity * targetPart.detection_priority
      })
    }

    return similarities
  }

  // 후보 검증 (마스터 DB의 LLM 특징 활용)
  const validateCandidates = async (candidates, detectedImage) => {
    const validatedCandidates = []

    for (const candidate of candidates) {
      const masterPart = candidate.part.master_characteristics
      if (!masterPart) continue

      // 1. 색상 검증
      const colorMatch = await validateColor(detectedImage, masterPart)
      
      // 2. 크기 검증
      const sizeMatch = await validateSize(detectedImage, masterPart)
      
      // 3. 형태 검증 (LLM 특징 활용)
      const shapeMatch = await validateShape(detectedImage, masterPart)

      // 종합 점수 계산
      const validationScore = (colorMatch * 0.3) + (sizeMatch * 0.3) + (shapeMatch * 0.4)

      validatedCandidates.push({
        ...candidate,
        validation_score: validationScore,
        color_match: colorMatch,
        size_match: sizeMatch,
        shape_match: shapeMatch
      })
    }

    return validatedCandidates
  }

  // 색상 검증
  const validateColor = async (detectedImage, masterPart) => {
    // 실제 구현에서는 이미지 색상 분석
    const detectedColor = await extractDominantColor(detectedImage)
    const expectedColor = masterPart.llm_visual_features?.color_characteristics
    
    if (!expectedColor) return 0.5 // 기본값

    // 색상 거리 계산
    const colorDistance = calculateColorDistance(detectedColor, expectedColor.primary_color)
    return Math.max(0, 1 - colorDistance) // 0-1 범위로 정규화
  }

  // 크기 검증
  const validateSize = async (detectedImage, masterPart) => {
    // 실제 구현에서는 객체 크기 분석
    const detectedSize = await calculateObjectSize(detectedImage)
    const expectedSize = masterPart.llm_geometric_features?.dimensions
    
    if (!expectedSize) return 0.5 // 기본값

    // 크기 비율 계산
    const sizeRatio = detectedSize / parseFloat(expectedSize)
    return Math.max(0, 1 - Math.abs(sizeRatio - 1) * 2) // 0-1 범위로 정규화
  }

  // 형태 검증 (LLM 특징 활용)
  const validateShape = async (detectedImage, masterPart) => {
    const recognitionHints = masterPart.llm_recognition_hints
    if (!recognitionHints) return 0.5 // 기본값

    // 실제 구현에서는 이미지에서 특징 추출
    const detectedFeatures = await extractImageFeatures(detectedImage)
    
    // LLM이 분석한 특징과 비교
    const featureMatches = compareFeatures(detectedFeatures, recognitionHints)
    
    return featureMatches
  }

  // 최종 점수 계산
  const calculateFinalScores = (validatedCandidates) => {
    return validatedCandidates.map(candidate => {
      const weights = {
        similarity: 0.4,      // CLIP 유사도
        validation: 0.4,       // 검증 점수
        priority: 0.2         // 우선순위
      }

      const finalScore = (
        candidate.similarity * weights.similarity +
        candidate.validation_score * weights.validation +
        candidate.part.detection_priority * weights.priority
      )

      return {
        ...candidate,
        final_score: finalScore,
        confidence: Math.min(finalScore, 1.0)
      }
    })
  }

  // 우선순위 계산
  const calculateDetectionPriority = (setPart, masterPart) => {
    let priority = 1.0

    // 수량이 많은 부품 우선
    if (setPart.quantity > 5) priority += 0.3
    else if (setPart.quantity > 2) priority += 0.2

    // 마스터 DB의 사용 빈도 활용
    if (masterPart?.usage_frequency > 100) priority += 0.2
    else if (masterPart?.usage_frequency > 50) priority += 0.1

    // 검출 정확도 활용
    if (masterPart?.detection_accuracy > 0.9) priority += 0.1

    return Math.min(priority, 2.0)
  }

  // 유틸리티 함수들
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
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  const extractDominantColor = async (image) => {
    const colorApi = import.meta.env.VITE_COLOR_EXTRACT_API_URL
    if (!colorApi) throw new Error('Missing VITE_COLOR_EXTRACT_API_URL')
    const res = await fetch(colorApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: image })
    })
    if (!res.ok) throw new Error(`Color API Error: ${res.status}`)
    return await res.json() // { r, g, b }
  }

  const calculateColorDistance = (c1, c2) => {
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
    return Math.sqrt(dr*dr + dg*dg + db*db) / Math.sqrt(3)
  }

  const calculateObjectSize = async (image) => {
    const sizeApi = import.meta.env.VITE_OBJECT_SIZE_API_URL
    if (!sizeApi) return 0.5
    const res = await fetch(sizeApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: image })
    })
    if (!res.ok) return 0.5
    const { size } = await res.json()
    return size || 0.5
  }

  const extractImageFeatures = async (image) => {
    const featApi = import.meta.env.VITE_FEATURE_EXTRACT_API_URL
    if (!featApi) return {}
    const res = await fetch(featApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: image })
    })
    if (!res.ok) return {}
    return await res.json()
  }

  const compareFeatures = (detected, expected) => {
    // 간단 비교: 기대 힌트의 키워드가 검출 특징에 존재하는 비율
    if (!detected || !expected) return 0.5
    const hints = [
      expected?.top_view,
      expected?.side_view,
      ...(expected?.unique_features || [])
    ].filter(Boolean).join(' ').toLowerCase()
    const det = JSON.stringify(detected).toLowerCase()
    if (!hints) return 0.5
    const tokens = Array.from(new Set(hints.split(/[^a-z0-9가-힣_]+/).filter(t => t.length > 2)))
    if (tokens.length === 0) return 0.5
    const matchCount = tokens.reduce((acc, t) => acc + (det.includes(t) ? 1 : 0), 0)
    return matchCount / tokens.length
  }

  return {
    loading,
    error,
    matching,
    loadTargetSetParts,
    matchDetectedPart,
    calculateSimilarities,
    validateCandidates,
    calculateFinalScores
  }
}
