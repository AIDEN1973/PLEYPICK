import { ref } from 'vue'

// Feature-space Flip 비교 시스템
export function useFeatureFlipComparison() {
  const loading = ref(false)
  const error = ref(null)

  // Feature 벡터 반전 (실제 이미지 없이)
  const flipFeatureVector = (embedding) => {
    if (!embedding || !Array.isArray(embedding)) {
      return embedding
    }
    
    // 벡터의 특정 차원들을 반전시켜 뒤집힌 상태를 시뮬레이션
    const flippedEmbedding = [...embedding]
    
    // 공간적 특징 차원들 (예: 위치, 방향 관련)을 반전
    for (let i = 0; i < flippedEmbedding.length; i += 3) {
      if (i + 2 < flippedEmbedding.length) {
        // x, y, z 좌표 관련 차원들을 반전
        flippedEmbedding[i] *= -1     // x 좌표 반전
        flippedEmbedding[i + 1] *= -1 // y 좌표 반전
        // z 좌표는 유지 (깊이 정보)
      }
    }
    
    return flippedEmbedding
  }

  // 뒤집힘 신호 탐지 (개선된 버전 - 튜브/홀 패턴 우선)
  const detectFlipSignals = async (imageUrl) => {
    try {
      // 이미지 분석을 통한 뒤집힘 신호 탐지 (우선순위: 튜브/홀 > 엣지 > 밝기)
      const signals = {
        tube_hole_pattern: await detectTubeHolePattern(imageUrl),
        edge_orientation: await analyzeEdgeOrientation(imageUrl),
        brightness_pattern: await analyzeBrightnessPattern(imageUrl),
        symmetry_score: await calculateSymmetryScore(imageUrl),
        stud_pattern: await detectStudPattern(imageUrl)
      }
      
      // 개선된 뒤집힘 점수 계산 (튜브/홀 패턴 우선)
      const flipScore = (
        signals.tube_hole_pattern * 0.5 +  // 튜브/홀 패턴 우선
        signals.edge_orientation * 0.25 +   // 엣지 방향
        signals.brightness_pattern * 0.15 + // 밝기 패턴 (의존성 감소)
        signals.symmetry_score * 0.05 +     // 대칭성
        signals.stud_pattern * 0.05         // 스터드 패턴
      )
      
      return {
        is_flipped_candidate: flipScore > 0.5,
        flip_score: flipScore,
        signals: signals,
        primary_signal: signals.tube_hole_pattern > 0.3 ? 'tube_hole' : 
                        signals.edge_orientation > 0.4 ? 'edge' : 'brightness'
      }
    } catch (err) {
      console.error('Flip signal detection failed:', err)
      return {
        is_flipped_candidate: false,
        flip_score: 0,
        signals: {},
        primary_signal: 'none'
      }
    }
  }

  // 밝기 패턴 분석
  const analyzeBrightnessPattern = async (imageUrl) => {
    // 실제 구현에서는 이미지 처리 라이브러리 사용
    // 여기서는 시뮬레이션
    return Math.random() * 0.5 + 0.3
  }

  // 엣지 방향 분석
  const analyzeEdgeOrientation = async (imageUrl) => {
    // 실제 구현에서는 엣지 감지 알고리즘 사용
    return Math.random() * 0.5 + 0.3
  }

  // 대칭성 점수 계산
  const calculateSymmetryScore = async (imageUrl) => {
    // 실제 구현에서는 대칭성 분석 알고리즘 사용
    return Math.random() * 0.5 + 0.3
  }

  // 튜브/홀 패턴 감지 (새로 추가)
  const detectTubeHolePattern = async (imageUrl) => {
    // 실제 구현에서는 튜브/홀 감지 알고리즘 사용
    // HoughCircles, 원형 감지, 홀 패턴 분석
    return Math.random() * 0.5 + 0.3
  }

  // 스터드 패턴 감지
  const detectStudPattern = async (imageUrl) => {
    // 실제 구현에서는 스터드 감지 알고리즘 사용
    return Math.random() * 0.5 + 0.3
  }

  // Feature-space Flip 비교
  const compareWithFlippedFeature = async (inputImage, partFeature) => {
    try {
      loading.value = true
      
      // 입력 이미지 임베딩 생성
      const inputEmbedding = await generateClipEmbedding(inputImage)
      
      // 기준 부품의 정상/반전 feature
      const normalFeature = partFeature.embedding || partFeature.text_embedding
      const flippedFeature = flipFeatureVector(normalFeature)
      
      // 유사도 계산
      const normalSimilarity = cosineSimilarity(inputEmbedding, normalFeature)
      const flippedSimilarity = cosineSimilarity(inputEmbedding, flippedFeature)
      
      // 뒤집힘 신호 탐지
      const flipSignals = await detectFlipSignals(inputImage)
      
      return {
        normal: normalSimilarity,
        flipped: flippedSimilarity,
        isFlipped: flippedSimilarity > normalSimilarity,
        confidence: Math.max(normalSimilarity, flippedSimilarity),
        flipSignals: flipSignals,
        method: 'feature_flip_comparison'
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 코사인 유사도 계산
  const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }
    
    if (normA === 0 || normB === 0) return 0
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  // CLIP 임베딩 생성 (기존 함수 재사용)
  const generateClipEmbedding = async (imageUrl) => {
    // 기존 useMasterPartsPreprocessing의 generateClipImageEmbedding 함수 사용
    // 여기서는 시뮬레이션
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
  }

  // 향상된 유사도 계산 (메타데이터 기반)
  const calculateEnhancedSimilarity = (comparison, metadata) => {
    let confidence = comparison.confidence
    
    // 부품 유형별 가중치 적용
    if (metadata.tier === 'SEMANTIC') {
      // 조형형 부품: 의미적 유사도 중심
      confidence = 0.7 * comparison.confidence + 0.3 * metadata.semantic_score
    } else if (metadata.orientation_sensitive) {
      // 방향 민감 부품: 정상/반전 가중 평균
      confidence = comparison.normal * 0.7 + comparison.flipped * 0.3
    } else {
      // 일반 부품: 최대값 사용
      confidence = Math.max(comparison.normal, comparison.flipped)
    }
    
    // 복잡도 기반 보정
    if (metadata.complexity_level === 'high') {
      confidence *= 0.9
    } else if (metadata.complexity_level === 'low') {
      confidence *= 1.1
    }
    
    // 특징 기반 보정
    if (metadata.has_stud) confidence *= 1.05
    if (metadata.groove) confidence *= 1.02
    
    return Math.min(confidence, 1.0)
  }

  return {
    loading,
    error,
    flipFeatureVector,
    detectFlipSignals,
    compareWithFlippedFeature,
    calculateEnhancedSimilarity,
    cosineSimilarity
  }
}
