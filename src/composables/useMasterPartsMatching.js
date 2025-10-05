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
      // 1. 먼저 lego_sets에서 set_num으로 set_id 찾기 (정확한 매치 또는 기본 세트)
      let { data: legoSet, error: setError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', setNum)
        .single()

      // 정확한 매치가 없으면 다양한 패턴으로 검색
      if (setError) {
        console.log(`Exact match failed for: ${setNum}`)
        
        // 1. 기본 세트 번호로 검색 (예: 76270-1 -> 76270)
        if (setNum.includes('-')) {
          const baseSetNum = setNum.split('-')[0]
          console.log(`Searching for base set: ${baseSetNum}`)
          
          const { data: baseSet, error: baseError } = await supabase
            .from('lego_sets')
            .select('id, set_num, name')
            .eq('set_num', baseSetNum)
            .single()
          
          if (!baseError && baseSet) {
            legoSet = baseSet
            setError = null
            console.log(`Found base set: ${baseSet.set_num}`)
          }
        }
        
        // 2. 여전히 없으면 LIKE 패턴으로 검색
        if (setError) {
          console.log(`Searching with LIKE pattern: ${setNum}%`)
          
          const { data: likeSet, error: likeError } = await supabase
            .from('lego_sets')
            .select('id, set_num, name')
            .like('set_num', `${setNum}%`)
            .limit(1)
            .single()
          
          if (!likeError && likeSet) {
            legoSet = likeSet
            setError = null
            console.log(`Found set with LIKE: ${likeSet.set_num}`)
          }
        }
      }

      if (setError) {
        console.error('Lego set query error:', setError)
        
        // 디버깅: 사용 가능한 세트들 확인
        const { data: availableSets, error: debugError } = await supabase
          .from('lego_sets')
          .select('set_num, name')
          .limit(10)
        
        if (!debugError && availableSets) {
          console.log('Available sets in database:', availableSets)
        }
        
        throw new Error(`세트 번호 '${setNum}'이 데이터베이스에 없습니다. 사용 가능한 세트를 확인해주세요.`)
      }

      console.log('Found lego set:', legoSet)

      // 2. set_id로 set_parts 조회
      const { data: setParts, error: partsError } = await supabase
        .from('set_parts')
        .select(`
          part_id,
          color_id,
          quantity,
          lego_parts(part_num, name),
          lego_colors(color_id, name, rgb)
        `)
        .eq('set_id', legoSet.id)

      if (partsError) {
        console.error('Set parts query error:', partsError)
        throw partsError
      }

      console.log('Set parts found:', setParts?.length || 0)
      console.log('Sample set part:', setParts?.[0])

      // 3. 마스터 부품 특징 정보 조회
      const partIds = setParts.map(sp => sp.part_id)
      const colorIds = setParts.map(sp => sp.color_id)

      console.log('Part IDs to search:', partIds)
      console.log('Color IDs to search:', colorIds)

      const { data: masterParts, error: masterError } = await supabase
        .from('parts_master_features')
        .select('*')
        .in('part_id', partIds)
        .in('color_id', colorIds)

      if (masterError) {
        console.error('Master parts query error:', masterError)
        throw masterError
      }

      console.log('Master parts found:', masterParts?.length || 0)

      // 4. 세트 부품과 마스터 특징 매핑
      const targetParts = setParts.map(setPart => {
        const masterPart = masterParts.find(mp => 
          mp.part_id === setPart.part_id && 
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

  // CLIP 유사도 계산 (API 없이 시뮬레이션)
  const calculateSimilarities = async (detectedEmbedding, targetParts) => {
    const similarities = []

    for (const targetPart of targetParts) {
      // API 없이 시뮬레이션된 유사도 계산
      const simulatedSimilarity = generateSimulatedSimilarity(targetPart)
      
      similarities.push({
        part: targetPart,
        similarity: simulatedSimilarity,
        confidence: simulatedSimilarity * targetPart.detection_priority
      })
    }

    return similarities
  }

  // 시뮬레이션된 유사도 생성
  const generateSimulatedSimilarity = (targetPart) => {
    // 부품 특성에 따른 시뮬레이션 유사도
    let baseSimilarity = 0.5 + Math.random() * 0.4 // 0.5-0.9 범위
    
    // 마스터 DB의 신뢰도 반영
    if (targetPart.master_characteristics?.confidence) {
      baseSimilarity = Math.max(baseSimilarity, targetPart.master_characteristics.confidence)
    }
    
    // 사용 빈도 반영
    if (targetPart.master_characteristics?.usage_frequency > 50) {
      baseSimilarity += 0.1
    }
    
    // 검출 정확도 반영
    if (targetPart.master_characteristics?.detection_accuracy > 0.8) {
      baseSimilarity += 0.1
    }
    
    return Math.min(baseSimilarity, 0.95) // 최대 95%
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
    // API 없이 시뮬레이션된 임베딩 생성
    console.log('Using simulated CLIP embedding (API not available)')
    
    // 1536차원 시뮬레이션 임베딩 생성
    const simulatedEmbedding = Array.from({ length: 1536 }, () => 
      (Math.random() - 0.5) * 2 // -1 ~ 1 범위
    )
    
    // 정규화
    const magnitude = Math.sqrt(simulatedEmbedding.reduce((sum, val) => sum + val * val, 0))
    return simulatedEmbedding.map(val => val / magnitude)
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
    // API 없이 시뮬레이션된 색상 추출
    console.log('Using simulated color extraction (API not available)')
    
    // 시뮬레이션된 주요 색상 반환
    const simulatedColors = [
      { r: 255, g: 0, b: 0 },     // 빨강
      { r: 0, g: 255, b: 0 },     // 초록
      { r: 0, g: 0, b: 255 },     // 파랑
      { r: 255, g: 255, b: 0 },   // 노랑
      { r: 255, g: 0, b: 255 },   // 마젠타
      { r: 0, g: 255, b: 255 },   // 시안
      { r: 128, g: 128, b: 128 }, // 회색
      { r: 0, g: 0, b: 0 },       // 검정
      { r: 255, g: 255, b: 255 }  // 흰색
    ]
    
    return simulatedColors[Math.floor(Math.random() * simulatedColors.length)]
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
    // API 없이 시뮬레이션된 크기 계산
    console.log('Using simulated object size calculation (API not available)')
    return 0.5 + Math.random() * 0.5 // 0.5-1.0 범위
  }

  const extractImageFeatures = async (image) => {
    // API 없이 시뮬레이션된 특징 추출
    console.log('Using simulated feature extraction (API not available)')
    
    return {
      edges: Math.random() > 0.5,
      corners: Math.floor(Math.random() * 10),
      shapes: ['rectangular', 'circular', 'triangular'][Math.floor(Math.random() * 3)],
      texture: ['smooth', 'rough', 'patterned'][Math.floor(Math.random() * 3)]
    }
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

  // 사용 가능한 세트 목록 조회
  const getAvailableSets = async (limit = 20) => {
    try {
      const { data: sets, error } = await supabase
        .from('lego_sets')
        .select('set_num, name, year, num_parts')
        .order('set_num', { ascending: true })
        .limit(limit)

      if (error) throw error
      
      // 세트 번호 형식별로 그룹화
      const groupedSets = {}
      sets?.forEach(set => {
        const baseNum = set.set_num.split('-')[0]
        if (!groupedSets[baseNum]) {
          groupedSets[baseNum] = []
        }
        groupedSets[baseNum].push(set)
      })
      
      return Object.values(groupedSets).flat() || []
    } catch (err) {
      console.error('Failed to get available sets:', err)
      return []
    }
  }

  return {
    loading,
    error,
    matching,
    loadTargetSetParts,
    matchDetectedPart,
    calculateSimilarities,
    validateCandidates,
    calculateFinalScores,
    getAvailableSets
  }
}
