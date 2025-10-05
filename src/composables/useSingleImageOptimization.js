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
        analysisStrategy
      )

      const result = {
        confidence: finalConfidence,
        strategy: analysisStrategy.name,
        imageQuality: imageQuality,
        extractedFeatures: extractedFeatures,
        metadataCorrection: metadataCorrection,
        method: 'single_image_optimized'
      }

      console.log('✅ Single image optimization completed:', result)
      return result

    } catch (err) {
      error.value = err.message
      console.error('❌ Single image optimization failed:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 이미지 품질 평가
  const assessImageQuality = async (imageUrl) => {
    try {
      // 실제 구현에서는 이미지 분석 라이브러리 사용
      // 여기서는 시뮬레이션
      const quality = {
        brightness: Math.random() * 0.5 + 0.5, // 0.5-1.0
        contrast: Math.random() * 0.5 + 0.5,   // 0.5-1.0
        sharpness: Math.random() * 0.5 + 0.5,  // 0.5-1.0
        noise_level: Math.random() * 0.3,      // 0.0-0.3
        resolution: Math.random() * 0.5 + 0.5, // 0.5-1.0
        overall_score: 0
      }

      // 전체 품질 점수 계산
      quality.overall_score = (
        quality.brightness * 0.2 +
        quality.contrast * 0.2 +
        quality.sharpness * 0.3 +
        (1 - quality.noise_level) * 0.2 +
        quality.resolution * 0.1
      )

      return quality
    } catch (err) {
      return {
        brightness: 0.5, contrast: 0.5, sharpness: 0.5,
        noise_level: 0.5, resolution: 0.5, overall_score: 0.5
      }
    }
  }

  // 최적 분석 전략 선택
  const selectOptimalStrategy = (partData, imageQuality) => {
    const partName = partData.name?.toLowerCase() || ''
    const partNum = partData.part_num || ''
    
    // 이미지 품질 기반 전략 조정
    const qualityMultiplier = imageQuality.overall_score > 0.8 ? 1.2 : 
                             imageQuality.overall_score > 0.6 ? 1.0 : 0.8

    // 부품 유형별 전략 선택
    if (/(gear|wheel|technic)/i.test(partName) || /(3647|3648|3650)/.test(partNum)) {
      return {
        name: 'structural_analysis',
        focus: 'rotation_invariant',
        weights: {
          geometric: 0.3,
          structural: 0.5,
          semantic: 0.2
        },
        qualityMultiplier: qualityMultiplier,
        requiresPolarTransform: true,
        requiresRadialProfile: true
      }
    }
    
    if (/(head|face|animal|figure|sculpted)/i.test(partName) || /(3626|24201)/.test(partNum)) {
      return {
        name: 'semantic_analysis',
        focus: 'keypoint_detection',
        weights: {
          geometric: 0.2,
          structural: 0.1,
          semantic: 0.7
        },
        qualityMultiplier: qualityMultiplier,
        requiresKeypointAnalysis: true,
        requiresSymmetryAnalysis: true
      }
    }
    
    // 기본 기하학적 분석
    return {
      name: 'geometric_analysis',
      focus: 'stud_groove_pattern',
      weights: {
        geometric: 0.6,
        structural: 0.2,
        semantic: 0.2
      },
      qualityMultiplier: qualityMultiplier,
      requiresStudDetection: true,
      requiresGrooveDetection: true
    }
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

  // 메타데이터 기반 보정
  const applyMetadataCorrection = (features, partData) => {
    const partName = partData.name?.toLowerCase() || ''
    const partNum = partData.part_num || ''
    
    const correction = {
      expected_stud_count: 0,
      expected_hole_count: 0,
      expected_groove: false,
      expected_center_stud: false,
      expected_round: false,
      correction_factor: 1.0
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

    // 보정 계수 계산
    let accuracy = 0
    let total_checks = 0

    // 스터드 개수 정확도
    if (correction.expected_stud_count > 0) {
      const stud_accuracy = 1 - Math.abs(features.stud_count - correction.expected_stud_count) / 
                           Math.max(correction.expected_stud_count, 1)
      accuracy += stud_accuracy
      total_checks++
    }

    // 그루브 정확도
    if (correction.expected_groove) {
      accuracy += features.groove_presence ? 1 : 0
      total_checks++
    }

    // 중앙 스터드 정확도
    if (correction.expected_center_stud) {
      accuracy += features.center_stud ? 1 : 0
      total_checks++
    }

    // 홀 개수 정확도
    if (correction.expected_hole_count > 0) {
      const hole_accuracy = 1 - Math.abs(features.hole_count - correction.expected_hole_count) / 
                           Math.max(correction.expected_hole_count, 1)
      accuracy += hole_accuracy
      total_checks++
    }

    correction.correction_factor = total_checks > 0 ? accuracy / total_checks : 1.0

    return correction
  }

  // 최종 신뢰도 계산
  const calculateFinalConfidence = (features, metadataCorrection, strategy) => {
    // 기본 신뢰도 계산
    let baseConfidence = 0.5

    // 전략별 가중치 적용
    const weights = strategy.weights
    const qualityMultiplier = strategy.qualityMultiplier

    // 특징별 점수 계산
    const geometricScore = calculateGeometricScore(features)
    const structuralScore = calculateStructuralScore(features)
    const semanticScore = calculateSemanticScore(features)

    // 가중 평균
    baseConfidence = (
      geometricScore * weights.geometric +
      structuralScore * weights.structural +
      semanticScore * weights.semantic
    )

    // 품질 보정
    baseConfidence *= qualityMultiplier

    // 메타데이터 보정
    baseConfidence *= metadataCorrection.correction_factor

    // 최종 신뢰도 (0-1 범위)
    return Math.min(Math.max(baseConfidence, 0), 1)
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
  const detectStuds = async (imageUrl) => Math.floor(Math.random() * 10) + 1
  const detectCenterStud = async (imageUrl) => Math.random() > 0.5
  const detectGroove = async (imageUrl) => Math.random() > 0.5
  const analyzeRotationInvariance = async (imageUrl) => Math.random() > 0.5
  const analyzeKeypointConsistency = async (imageUrl) => Math.random() * 0.5 + 0.3
  const analyzeSymmetry = async (imageUrl) => Math.random() * 0.5 + 0.3
  const analyzeBrightnessPattern = async (imageUrl) => Math.random() * 0.5 + 0.3
  const analyzeEdgeQuality = async (imageUrl) => Math.random() * 0.5 + 0.3
  const analyzeTextureComplexity = async (imageUrl) => Math.random() * 0.5 + 0.3

  return {
    loading,
    error,
    optimizeSingleImageAnalysis,
    assessImageQuality,
    selectOptimalStrategy,
    extractSingleImageFeatures,
    applyMetadataCorrection
  }
}
