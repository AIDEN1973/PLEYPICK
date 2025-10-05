import { ref } from 'vue'

// 3-Tier 부품 분류 시스템
export function usePartClassification() {
  const loading = ref(false)
  const error = ref(null)

  // 부품 유형별 처리 계층 정의
  const PART_TIERS = {
    GEOMETRY: {
      types: ['plate', 'brick', 'tile', 'slope'],
      features: ['stud', 'groove', 'hole', 'edge'],
      flipMethod: 'feature_comparison',
      weight: 1.0
    },
    STRUCTURAL: {
      types: ['technic', 'gear', 'connector', 'axle'],
      features: ['pattern', 'symmetry', 'array', 'mechanism'],
      flipMethod: 'pattern_matching',
      weight: 0.9
    },
    SEMANTIC: {
      types: ['sculpted', 'decorative', 'curved', 'figure'],
      features: ['texture', 'shape', 'meaning', 'orientation'],
      flipMethod: 'semantic_comparison',
      weight: 0.8
    }
  }

  // 부품 유형 분류 (개선된 버전 - 프린트 부품 혼합 가중치)
  const classifyPartTier = (partData) => {
    const partName = partData.name?.toLowerCase() || ''
    const partNum = partData.part_num || ''
    
    // 프린트 부품 감지
    const hasPrint = partName.includes('print') || partName.includes('decorated') || 
                     partNum.includes('pr') || partNum.includes('pb')
    
    // 조형형 부품 키워드 감지 (확장된 버전)
    const sculptedKeywords = [
      'head', 'face', 'lion', 'animal', 'figure', 'sculpted', 
      'curved', 'slope', 'decorative', 'print', 'pattern',
      'dolphin', 'dog', 'crab', 'fern', 'flower', 'plant',
      'hot dog', 'bun', 'food', 'equipment', 'shovel', 'oar',
      'umbrella', 'glasses', 'goblet', 'glass', 'windscreen',
      'surfboard', 'shuttle', 'tail', 'swirled', 'poo',
      'cone', 'ice cream', 'pizza', 'ticket', 'globe', 'sun',
      'goblet', 'glass', 'windscreen', 'umbrella', 'glasses',
      'shuttle', 'tail', 'swirled', 'poo', 'star', 'stud holder'
    ]
    
    const isSculpted = sculptedKeywords.some(keyword => 
      partName.includes(keyword) || partNum.includes(keyword)
    )
    
    if (isSculpted) {
      return {
        tier: 'SEMANTIC',
        confidence: 0.9,
        orientation_sensitive: true,
        flip_tolerance: 0.1,
        printed_subtype: hasPrint
      }
    }
    
    // 구조형 부품 키워드 감지 (확장된 버전)
    const structuralKeywords = [
      'technic', 'gear', 'axle', 'pin', 'connector', 'mechanism',
      'propeller', 'blade', 'bar', 'stop', 'ring', 'special',
      'stud holder', 'clip', 'vertical', 'hollow', 'stud',
      'lever', 'base', 'handle', 'reinforced', 'equipment',
      'separator', 'bucket', 'handle', 'oar', 'paddle',
      'shovel', 'goblet', 'glass', 'windscreen', 'umbrella',
      'glasses', 'accessory', 'door frame', 'storage case'
    ]
    
    const isStructural = structuralKeywords.some(keyword => 
      partName.includes(keyword) || partNum.includes(keyword)
    )
    
    if (isStructural) {
      return {
        tier: 'STRUCTURAL',
        confidence: 0.8,
        orientation_sensitive: false,
        flip_tolerance: 0.3,
        printed_subtype: hasPrint
      }
    }
    
    // 기본형 부품 (기하학적) - 프린트 부품은 혼합 가중치 적용
    if (hasPrint) {
      return {
        tier: 'GEOMETRY',
        confidence: 0.7,
        orientation_sensitive: true,
        flip_tolerance: 0.4,
        printed_subtype: true,
        mixed_weights: { geometry: 0.6, semantic: 0.4 }
      }
    }
    
    return {
      tier: 'GEOMETRY',
      confidence: 0.7,
      orientation_sensitive: true,
      flip_tolerance: 0.4,
      printed_subtype: false
    }
  }

  // 부품 복잡도 분석 (개선된 버전 - 실제 분포 고려)
  const analyzePartComplexity = (partData) => {
    const name = partData.name || ''
    const description = partData.description || ''
    
    // 복잡도 지표들 (확장된 버전)
    const complexityIndicators = {
      studCount: (name.match(/\d+x\d+/g) || []).length,
      specialFeatures: ['special', 'round', 'curved', 'slope', 'inverted', 'truncated', 'technic', 'beam', 'axle', 'pin', 'connector'].filter(f => 
        name.toLowerCase().includes(f)
      ).length,
      descriptionLength: description.length,
      hasPrint: name.includes('print') || name.includes('decorated'),
      hasAnimal: /animal|dolphin|dog|crab|fern|flower|plant/i.test(name),
      hasFood: /food|hot dog|bun|cone|pizza/i.test(name),
      hasEquipment: /equipment|shovel|oar|goblet|umbrella|glasses/i.test(name),
      hasSports: /sports|surfboard|shuttle/i.test(name),
      hasStorage: /storage|case|divider/i.test(name),
      hasSticker: /sticker|sheet/i.test(name),
      hasTechnic: /technic|beam|axle|pin|connector|hub|bush/i.test(name)
    }
    
    // 복잡도 점수 계산 (개선된 수식 - 가중치 조정)
    const baseScore = (
      (complexityIndicators.studCount * 0.1) +  // 0.05 -> 0.1
      (complexityIndicators.specialFeatures * 0.2) +  // 0.15 -> 0.2
      (complexityIndicators.descriptionLength / 1000) +  // 2000 -> 1000
      (complexityIndicators.hasPrint ? 0.3 : 0) +  // 0.4 -> 0.3
      (complexityIndicators.hasAnimal ? 0.4 : 0) +  // 0.3 -> 0.4
      (complexityIndicators.hasFood ? 0.4 : 0) +  // 0.3 -> 0.4
      (complexityIndicators.hasEquipment ? 0.3 : 0) +  // 0.2 -> 0.3
      (complexityIndicators.hasSports ? 0.4 : 0) +  // 0.3 -> 0.4
      (complexityIndicators.hasStorage ? 0.3 : 0) +  // 0.2 -> 0.3
      (complexityIndicators.hasSticker ? 0.2 : 0) +  // 0.1 -> 0.2
      (complexityIndicators.hasTechnic ? 0.2 : 0)  // 새로 추가
    )
    
    // 복잡도 점수 (0-1, 클리핑)
    const complexityScore = Math.min(Math.max(baseScore, 0), 1.0)
    
    // 개선된 임계값 (L/M/H = 40/40/20 분포 목표)
    const level = complexityScore > 0.35 ? 'high' : 
                  complexityScore > 0.15 ? 'medium' : 'low'
    
    return {
      score: complexityScore,
      indicators: complexityIndicators,
      level: level
    }
  }

  // 향상된 메타데이터 생성 (개선된 버전 - 회전/반전 불변 특징 수학적 명시)
  const generateEnhancedMetadata = (partData, tierClassification) => {
    const complexity = analyzePartComplexity(partData)
    const partName = partData.name?.toLowerCase() || ''
    const partNum = partData.part_num || ''
    
    // 회전/반전 불변 특징 (새로 추가)
    let rotationInvariance = false
    let angleStep = 0 // 회전 단위 (도)
    let polarTransform = false // 극좌표 변환 필요 여부
    let radialProfile = false // 방사형 프로파일 분석 필요 여부
    let teethCount = 0 // 톱니 개수 (기어용)
    let pitchPeriodicity = false // 피치 주기성
    let circularArray = false // 원형 배열 (핀/커넥터용)
    
    // Tier별 회전/반전 불변 특징 설정
    switch (tierClassification.tier) {
      case 'STRUCTURAL':
        rotationInvariance = true
        angleStep = 5 // 5도 단위 회전 허용
        polarTransform = true // 극좌표 변환 필요
        radialProfile = true // 방사형 프로파일 분석 필요
        
        // 기어 특화 특징
        if (/(gear|wheel)/i.test(partName)) {
          teethCount = extractTeethCount(partName, partNum)
          pitchPeriodicity = true
        }
        
        // 핀/커넥터 특화 특징
        if (/(pin|connector|axle)/i.test(partName)) {
          circularArray = true
        }
        break
      case 'GEOMETRY':
        rotationInvariance = false
        break
      case 'SEMANTIC':
        rotationInvariance = false // 조형형은 회전 불변하지 않음
        break
    }
    
    return {
      part_id: partData.part_num,
      category_type: partData.category || 'unknown',
      tier: tierClassification.tier,
      orientation_sensitive: tierClassification.orientation_sensitive,
      has_stud: partData.name?.toLowerCase().includes('stud') || false,
      groove: partData.name?.toLowerCase().includes('groove') || false,
      center_stud: partData.name?.toLowerCase().includes('center stud') || false,
      semantic_complexity: complexity.score,
      key_features: extractKeyFeatures(partData),
      flip_tolerance: tierClassification.flip_tolerance,
      confidence_threshold: getConfidenceThreshold(tierClassification.tier),
      complexity_level: complexity.level,
      
      // 회전/반전 불변 특징 (새로 추가)
      rotation_invariance: rotationInvariance,
      angle_step: angleStep,
      polar_transform: polarTransform,
      radial_profile: radialProfile,
      teeth_count: teethCount,
      pitch_periodicity: pitchPeriodicity,
      circular_array: circularArray
    }
  }
  
  // 톱니 개수 추출 (기어용)
  const extractTeethCount = (partName, partNum) => {
    // 실제 구현에서는 부품명/번호에서 톱니 개수 추출
    // 예: "8 Tooth Gear" -> 8, "Gear 24" -> 24
    const teethMatch = partName.match(/(\d+)\s*tooth/i) || partNum.match(/(\d+)/)
    return teethMatch ? parseInt(teethMatch[1]) : 0
  }

  // 주요 특징 추출
  const extractKeyFeatures = (partData) => {
    const name = partData.name?.toLowerCase() || ''
    const features = []
    
    if (name.includes('stud')) features.push('stud')
    if (name.includes('groove')) features.push('groove')
    if (name.includes('hole')) features.push('hole')
    if (name.includes('round')) features.push('round')
    if (name.includes('curved')) features.push('curved')
    if (name.includes('slope')) features.push('slope')
    if (name.includes('special')) features.push('special')
    
    return features
  }

  // 신뢰도 임계값 설정
  const getConfidenceThreshold = (tier) => {
    const thresholds = {
      'GEOMETRY': 0.7,
      'STRUCTURAL': 0.6,
      'SEMANTIC': 0.5
    }
    return thresholds[tier] || 0.6
  }

  return {
    loading,
    error,
    PART_TIERS,
    classifyPartTier,
    analyzePartComplexity,
    generateEnhancedMetadata,
    extractKeyFeatures,
    getConfidenceThreshold
  }
}
