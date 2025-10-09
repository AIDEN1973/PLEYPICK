// src/composables/useSingleImageOptimization.js
import { ref } from 'vue'

export function useSingleImageOptimization() {
  const loading = ref(false)
  const error = ref(null)

  // 단일 이미지 최적화 분석
  const optimizeSingleImageAnalysis = async (inputImage, partData) => {
    try {
      loading.value = true
      error.value = null

      console.log('🎯 Starting single image optimization analysis...')

      // 1. 이미지 품질 평가
      const imageQuality = await assessImageQuality(inputImage)
      console.log('📸 Image quality assessment:', imageQuality)

      // 2. 최적 분석 전략 선택
      const analysisStrategy = selectOptimalStrategy(partData, imageQuality)
      console.log('🎯 Selected analysis strategy:', analysisStrategy)

      // 3. 단일 이미지 기반 특징 추출
      const extractedFeatures = await extractSingleImageFeatures(inputImage, analysisStrategy)
      console.log('🔍 Extracted features:', extractedFeatures)

      // 4. 메타데이터 기반 보정
      const metadataCorrection = applyMetadataCorrection(extractedFeatures, partData)
      console.log('⚖️ Metadata correction applied:', metadataCorrection)

      // 5. 최종 신뢰도 계산
      const finalConfidence = calculateFinalConfidence(
        extractedFeatures, 
        metadataCorrection, 
        analysisStrategy,
        imageQuality
      )

      // 6. 임계값 기반 결정
      const decision = makeDecision(finalConfidence, analysisStrategy, extractedFeatures)

      // 7. 구조화된 로그 데이터 생성
      const logData = generateStructuredLog(
        imageQuality, analysisStrategy, extractedFeatures, 
        metadataCorrection, finalConfidence, decision
      )

      const result = {
        confidence: finalConfidence,
        strategy: analysisStrategy.name,
        imageQuality: imageQuality,
        extractedFeatures: extractedFeatures,
        metadataCorrection: metadataCorrection,
        decision: decision,
        logData: logData,
        method: 'single_image_optimized'
      }

      console.log('✅ Single image optimization completed:', result)
      console.log('📊 Structured log data:', logData)
      return result

    } catch (err) {
      error.value = err.message
      console.error('❌ Single image optimization failed:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 이미지 품질 평가 (수식 기반 연속값)
  const assessImageQuality = async (imageUrl) => {
    try {
      // 실제 구현에서는 이미지 분석 라이브러리 사용
      // 여기서는 수식 기반 시뮬레이션
      const imageMetrics = await calculateImageMetrics(imageUrl)
      
      // 기준값 (실제 구현에서는 데이터셋 기반 설정)
      const μ₀ = 128, σ₀ = 64, Lv₀ = 100, SNR₀ = 20, R₀ = 512
      
      // 품질 점수 Q 계산 (연속값, 0.8~1.2 클리핑)
      const Q = Math.max(0.8, Math.min(1.2,
        0.2 * (imageMetrics.brightness / μ₀) +
        0.2 * (imageMetrics.contrast / σ₀) +
        0.3 * (imageMetrics.sharpness / Lv₀) +
        0.2 * (imageMetrics.snr / SNR₀) +
        0.1 * (imageMetrics.resolution / R₀)
      ))

      return {
        brightness: imageMetrics.brightness,
        contrast: imageMetrics.contrast,
        sharpness: imageMetrics.sharpness,
        snr: imageMetrics.snr,
        resolution: imageMetrics.resolution,
        Q: Q,
        overall_score: Q
      }
    } catch (err) {
      return {
        brightness: 128, contrast: 64, sharpness: 100,
        snr: 20, resolution: 512, Q: 1.0, overall_score: 1.0
      }
    }
  }

  // 이미지 메트릭 계산 (실제 구현에서는 OpenCV.js 등 사용)
  const calculateImageMetrics = async (imageUrl) => {
    // 실제 구현 대기: 임시로 0 기반 안전값 반환 (목업 금지)
    return {
      brightness: 0,
      contrast: 0,
      sharpness: 0,
      snr: 0,
      resolution: 0
    }
  }

  // 최적 분석 전략 선택 (예외 분기 포함)
  const selectOptimalStrategy = (partData, imageQuality) => {
    const partName = partData.name?.toLowerCase() || ''
    const partNum = partData.part_num || ''
    
    // 예외 분기 1: 저품질 이미지 (Q < 0.85)
    if (imageQuality.Q < 0.85) {
      return {
        name: 'low_quality_analysis',
        focus: 'auto_review',
        weights: { geometric: 0.4, structural: 0.3, semantic: 0.3 },
        autoReview: true,
        requiresStudDetection: true,
        requiresGrooveDetection: true
      }
    }

    // 예외 분기 2: Flip-invariant 부품 (일부 plate, 기어)
    if (isFlipInvariant(partName, partNum)) {
      return {
        name: 'flip_invariant_analysis',
        focus: 'rotation_invariant',
        weights: { geometric: 0.3, structural: 0.5, semantic: 0.2 },
        removeFlipPenalty: true,
        requiresPolarTransform: true,
        requiresRadialProfile: true
      }
    }

    // 예외 분기 3: Orientation-locked 부품 (사자머리 등)
    if (isOrientationLocked(partName, partNum)) {
      return {
        name: 'orientation_locked_analysis',
        focus: 'keypoint_detection',
        weights: { geometric: 0.2, structural: 0.1, semantic: 0.7 },
        orientationWarning: true,
        requiresKeypointAnalysis: true,
        requiresSymmetryAnalysis: true
      }
    }

    // 일반 전략 선택
    if (/(gear|wheel|technic)/i.test(partName) || /(3647|3648|3650)/.test(partNum)) {
      return {
        name: 'structural_analysis',
        focus: 'rotation_invariant',
        weights: { geometric: 0.3, structural: 0.5, semantic: 0.2 },
        requiresPolarTransform: true,
        requiresRadialProfile: true
      }
    }
    
    if (/(head|face|animal|figure|sculpted)/i.test(partName) || /(3626|24201)/.test(partNum)) {
      return {
        name: 'semantic_analysis',
        focus: 'keypoint_detection',
        weights: { geometric: 0.2, structural: 0.1, semantic: 0.7 },
        requiresKeypointAnalysis: true,
        requiresSymmetryAnalysis: true
      }
    }
    
    // 기본 기하학적 분석
    return {
      name: 'geometric_analysis',
      focus: 'stud_groove_pattern',
      weights: { geometric: 0.6, structural: 0.2, semantic: 0.2 },
      requiresStudDetection: true,
      requiresGrooveDetection: true
    }
  }

  // Flip-invariant 부품 판단
  const isFlipInvariant = (partName, partNum) => {
    return /(gear|wheel|pin|connector|axle)/i.test(partName) || 
           /(3647|3648|3650|2780|2781)/.test(partNum)
  }

  // Orientation-locked 부품 판단
  const isOrientationLocked = (partName, partNum) => {
    return /(head|face|animal|figure|sculpted|minifig)/i.test(partName) || 
           /(3626|24201)/.test(partNum)
  }

  // 단일 이미지 기반 특징 추출
  const extractSingleImageFeatures = async (inputImage, strategy) => {
    const features = {
      // 기본 특징
      stud_count: 0,
      groove_presence: false,
      center_stud: false,
      round_shape: false,
      hole_count: 0,
      
      // 품질 기반 특징
      brightness_pattern: 0,
      edge_quality: 0,
      symmetry_score: 0,
      texture_complexity: 0,
      
      // 전략별 특징
      rotation_invariance: false,
      keypoint_consistency: 0,
      semantic_score: 0
    }

    // 전략에 따른 특징 추출
    if (strategy.requiresStudDetection) {
      features.stud_count = await detectStuds(inputImage)
      features.center_stud = await detectCenterStud(inputImage)
    }
    
    if (strategy.requiresGrooveDetection) {
      features.groove_presence = await detectGroove(inputImage)
    }
    
    if (strategy.requiresPolarTransform) {
      features.rotation_invariance = await analyzeRotationInvariance(inputImage)
    }
    
    if (strategy.requiresKeypointAnalysis) {
      features.keypoint_consistency = await analyzeKeypointConsistency(inputImage)
    }
    
    if (strategy.requiresSymmetryAnalysis) {
      features.symmetry_score = await analyzeSymmetry(inputImage)
    }

    // 품질 기반 특징
    features.brightness_pattern = await analyzeBrightnessPattern(inputImage)
    features.edge_quality = await analyzeEdgeQuality(inputImage)
    features.texture_complexity = await analyzeTextureComplexity(inputImage)

    return features
  }

  // 메타데이터 기반 보정 (EM 기반 수식)
  const applyMetadataCorrection = (features, partData) => {
    const partName = partData.name?.toLowerCase() || ''
    const partNum = partData.part_num || ''
    
    const correction = {
      expected_stud_count: 0,
      expected_hole_count: 0,
      expected_groove: false,
      expected_center_stud: false,
      expected_round: false,
      EM: 0, // 예상 특징 매칭율
      confusion_penalty: 0, // 혼동군 페널티
      M: 0 // 최종 보정 계수
    }

    // 예상 특징 추출
    if (/(\d+)x(\d+)/.test(partName)) {
      const match = partName.match(/(\d+)x(\d+)/)
      correction.expected_stud_count = parseInt(match[1]) * parseInt(match[2])
    }
    
    if (/(groove|tile)/i.test(partName)) {
      correction.expected_groove = true
    }
    
    if (/(jumper|center stud)/i.test(partName)) {
      correction.expected_center_stud = true
    }
    
    if (/(round|circle)/i.test(partName)) {
      correction.expected_round = true
    }
    
    if (/(hole|pin|connector)/i.test(partName)) {
      correction.expected_hole_count = 1
    }

    // EM (예상 특징 매칭율) 계산
    let matched_attributes = 0
    let total_attributes = 0

    // 스터드 개수 매칭
    if (correction.expected_stud_count > 0) {
      total_attributes++
      const stud_accuracy = 1 - Math.abs(features.stud_count - correction.expected_stud_count) / 
                           Math.max(correction.expected_stud_count, 1)
      if (stud_accuracy > 0.8) matched_attributes++
    }

    // 그루브 매칭
    if (correction.expected_groove) {
      total_attributes++
      if (features.groove_presence) matched_attributes++
    }

    // 중앙 스터드 매칭
    if (correction.expected_center_stud) {
      total_attributes++
      if (features.center_stud) matched_attributes++
    }

    // 홀 개수 매칭
    if (correction.expected_hole_count > 0) {
      total_attributes++
      const hole_accuracy = 1 - Math.abs(features.hole_count - correction.expected_hole_count) / 
                           Math.max(correction.expected_hole_count, 1)
      if (hole_accuracy > 0.8) matched_attributes++
    }

    correction.EM = total_attributes > 0 ? matched_attributes / total_attributes : 1.0

    // 혼동군 페널티 계산 (실제 구현에서는 혼동군 매트릭스 사용)
    correction.confusion_penalty = calculateConfusionPenalty(partNum, partName)

    // 최종 보정 계수 M 계산 (α≈0.15, β≈1.0)
    const α = 0.15, β = 1.0
    correction.M = α * correction.EM - β * correction.confusion_penalty

    return correction
  }

  // 혼동군 페널티 계산
  const calculateConfusionPenalty = (partNum, partName) => {
    // 실제 구현에서는 혼동군 매트릭스 사용
    // 여기서는 시뮬레이션
    const confusionMatrix = {
      '3023': 0.1, // 2x2 Plate
      '2412b': 0.1, // 2x2 Tile
      '18674': 0.15, // 2x2 Jumper
      '3068b': 0.1  // 2x2 Round
    }
    return confusionMatrix[partNum] || 0
  }

  // 최종 신뢰도 계산 (표준 수식)
  const calculateFinalConfidence = (features, metadataCorrection, strategy, imageQuality) => {
    // Tier별 점수 계산
    const S_geo = calculateGeometricScore(features)
    const S_struct = calculateStructuralScore(features)
    const S_sem = calculateSemanticScore(features)

    // Tier 가중치 (전략별)
    const w_g = strategy.weights.geometric
    const w_s = strategy.weights.structural
    const w_se = strategy.weights.semantic

    // 품질 점수 Q
    const Q = imageQuality.Q

    // 메타데이터 보정 M
    const M = metadataCorrection.M

    // 표준 수식: S_final = Q * (w_g * S_geo + w_s * S_struct + w_se * S_sem) + M
    const S_final = Q * (w_g * S_geo + w_s * S_struct + w_se * S_sem) + M

    // 최종 신뢰도 (0-1 범위)
    return Math.min(Math.max(S_final, 0), 1)
  }

  // 개별 점수 계산 함수들
  const calculateGeometricScore = (features) => {
    let score = 0
    if (features.stud_count > 0) score += 0.3
    if (features.groove_presence) score += 0.2
    if (features.center_stud) score += 0.2
    if (features.round_shape) score += 0.1
    if (features.symmetry_score > 0.5) score += 0.2
    return Math.min(score, 1)
  }

  const calculateStructuralScore = (features) => {
    let score = 0
    if (features.hole_count > 0) score += 0.4
    if (features.rotation_invariance) score += 0.3
    if (features.edge_quality > 0.5) score += 0.3
    return Math.min(score, 1)
  }

  const calculateSemanticScore = (features) => {
    let score = 0
    if (features.keypoint_consistency > 0.5) score += 0.4
    if (features.texture_complexity > 0.5) score += 0.3
    if (features.semantic_score > 0.5) score += 0.3
    return Math.min(score, 1)
  }

  // 개별 감지 함수들 (실제 구현에서는 이미지 처리 라이브러리 사용)
  const detectStuds = async (imageUrl) => 0
  const detectCenterStud = async (imageUrl) => false
  const detectGroove = async (imageUrl) => false
  const analyzeRotationInvariance = async (imageUrl) => false
  const analyzeKeypointConsistency = async (imageUrl) => 0
  const analyzeSymmetry = async (imageUrl) => 0
  const analyzeBrightnessPattern = async (imageUrl) => 0
  const analyzeEdgeQuality = async (imageUrl) => 0
  const analyzeTextureComplexity = async (imageUrl) => 0

  // 임계값 기반 결정
  const makeDecision = (confidence, strategy, features) => {
    // Tier별 임계값 (초기 권장)
    const thresholds = {
      'geometric_analysis': { accept: 0.82, review: 0.72 },
      'structural_analysis': { accept: 0.85, review: 0.75 },
      'semantic_analysis': { accept: 0.80, review: 0.70 },
      'low_quality_analysis': { accept: 0.90, review: 0.80 },
      'flip_invariant_analysis': { accept: 0.85, review: 0.75 },
      'orientation_locked_analysis': { accept: 0.80, review: 0.70 }
    }

    const tierThresholds = thresholds[strategy.name] || thresholds['geometric_analysis']
    
    // 동적 보정: T_accept' = T_accept - 0.08 * semantic_complexity + 0.05 * EM
    const semanticComplexity = features.semantic_complexity || 0
    const EM = features.EM || 1.0
    const adjustedAccept = tierThresholds.accept - 0.08 * semanticComplexity + 0.05 * EM

    if (confidence >= adjustedAccept) {
      return { status: 'accept', confidence, threshold: adjustedAccept }
    } else if (confidence >= tierThresholds.review) {
      return { status: 'review', confidence, threshold: tierThresholds.review }
    } else {
      return { status: 'reject', confidence, threshold: tierThresholds.review }
    }
  }

  // 구조화된 로그 데이터 생성
  const generateStructuredLog = (imageQuality, strategy, features, metadataCorrection, confidence, decision) => {
    return {
      quality: {
        mu: imageQuality.brightness,
        sigma: imageQuality.contrast,
        lv: imageQuality.sharpness,
        snr: imageQuality.snr,
        H: imageQuality.resolution,
        W: imageQuality.resolution,
        Q: imageQuality.Q
      },
      tier_weights: {
        g: strategy.weights.geometric,
        s: strategy.weights.structural,
        se: strategy.weights.semantic
      },
      scores: {
        geo: calculateGeometricScore(features),
        struct: calculateStructuralScore(features),
        sem: calculateSemanticScore(features),
        final: confidence
      },
      meta: {
        EM: metadataCorrection.EM,
        penalty: metadataCorrection.confusion_penalty,
        M: metadataCorrection.M
      },
      decision: {
        status: decision.status,
        confidence: decision.confidence,
        threshold: decision.threshold
      }
    }
  }

  return {
    loading,
    error,
    optimizeSingleImageAnalysis,
    assessImageQuality,
    selectOptimalStrategy,
    extractSingleImageFeatures,
    applyMetadataCorrection,
    makeDecision,
    generateStructuredLog
  }
}
