// src/composables/useMultiAttributeVoting.js
import { ref } from 'vue'

export function useMultiAttributeVoting() {
  const loading = ref(false)
  const error = ref(null)

  // 멀티-어트리뷰트 투표 시스템
  const performMultiAttributeVoting = async (inputImage, candidateParts) => {
    try {
      loading.value = true
      error.value = null

      console.log('🗳️ Starting Multi-Attribute Voting...')

      const votingResults = []

      for (const part of candidateParts) {
        const attributes = await analyzePartAttributes(inputImage, part)
        const votingScore = calculateVotingScore(attributes, part)
        
        votingResults.push({
          part_id: part.part_id,
          part_name: part.name,
          voting_score: votingScore,
          attributes: attributes,
          confidence: votingScore.totalScore,
          method: 'multi_attribute_voting'
        })
      }

      // 결과 정렬 (높은 점수 순)
      votingResults.sort((a, b) => b.voting_score.totalScore - a.voting_score.totalScore)

      console.log('✅ Multi-Attribute Voting completed:', votingResults)
      return votingResults

    } catch (err) {
      error.value = err.message
      console.error('❌ Multi-Attribute Voting failed:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 부품 속성 분석
  const analyzePartAttributes = async (inputImage, partData) => {
    const attributes = {
      // 형상 속성
      round_shape: await detectRoundShape(inputImage),
      center_stud: await detectCenterStud(inputImage),
      groove_presence: await detectGroove(inputImage),
      stud_count: await countStuds(inputImage),
      underside_tube_pattern: await detectTubePattern(inputImage),
      
      // 구조적 속성
      hole_count: await countHoles(inputImage),
      symmetry_score: await calculateSymmetry(inputImage),
      edge_quality: await analyzeEdgeQuality(inputImage),
      
      // 의미적 속성
      texture_complexity: await analyzeTextureComplexity(inputImage),
      color_consistency: await analyzeColorConsistency(inputImage),
      pattern_recognition: await recognizePatterns(inputImage)
    }

    return attributes
  }

  // 투표 점수 계산
  const calculateVotingScore = (attributes, partData) => {
    const weights = getAttributeWeights(partData.tier || 'GEOMETRY')
    
    // 개별 속성 점수 계산
    const scores = {
      round_shape: attributes.round_shape * weights.round_shape,
      center_stud: attributes.center_stud * weights.center_stud,
      groove_presence: attributes.groove_presence * weights.groove_presence,
      stud_count: calculateStudCountScore(attributes.stud_count, partData),
      tube_pattern: attributes.underside_tube_pattern * weights.tube_pattern,
      hole_count: calculateHoleCountScore(attributes.hole_count, partData),
      symmetry: attributes.symmetry_score * weights.symmetry,
      edge_quality: attributes.edge_quality * weights.edge_quality,
      texture: attributes.texture_complexity * weights.texture,
      color: attributes.color_consistency * weights.color,
      pattern: attributes.pattern_recognition * weights.pattern
    }

    // 핵심 속성 일치 여부 확인
    const coreAttributes = getCoreAttributes(partData)
    const coreMatches = coreAttributes.filter(attr => 
      scores[attr] > 0.5
    ).length

    // 최종 점수 계산
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0)
    const coreBonus = coreMatches >= 2 ? 0.2 : 0 // 핵심 속성 2개 이상 일치 시 보너스
    const finalScore = Math.min(totalScore + coreBonus, 1.0)

    return {
      totalScore: finalScore,
      individualScores: scores,
      coreMatches: coreMatches,
      coreBonus: coreBonus,
      weights: weights
    }
  }

  // 속성별 가중치 설정
  const getAttributeWeights = (tier) => {
    const weightPresets = {
      'GEOMETRY': {
        round_shape: 0.15,
        center_stud: 0.20,
        groove_presence: 0.15,
        stud_count: 0.20,
        tube_pattern: 0.10,
        hole_count: 0.05,
        symmetry: 0.05,
        edge_quality: 0.05,
        texture: 0.02,
        color: 0.02,
        pattern: 0.01
      },
      'STRUCTURAL': {
        round_shape: 0.05,
        center_stud: 0.05,
        groove_presence: 0.10,
        stud_count: 0.10,
        tube_pattern: 0.15,
        hole_count: 0.25,
        symmetry: 0.15,
        edge_quality: 0.10,
        texture: 0.03,
        color: 0.01,
        pattern: 0.01
      },
      'SEMANTIC': {
        round_shape: 0.05,
        center_stud: 0.05,
        groove_presence: 0.05,
        stud_count: 0.05,
        tube_pattern: 0.05,
        hole_count: 0.05,
        symmetry: 0.10,
        edge_quality: 0.10,
        texture: 0.25,
        color: 0.15,
        pattern: 0.15
      }
    }

    return weightPresets[tier] || weightPresets['GEOMETRY']
  }

  // 핵심 속성 정의
  const getCoreAttributes = (partData) => {
    const partName = partData.name?.toLowerCase() || ''
    const coreAttributes = []

    if (/(round|circle)/i.test(partName)) {
      coreAttributes.push('round_shape')
    }
    if (/(center stud|jumper)/i.test(partName)) {
      coreAttributes.push('center_stud')
    }
    if (/(groove|tile)/i.test(partName)) {
      coreAttributes.push('groove_presence')
    }
    if (/(stud|plate|brick)/i.test(partName)) {
      coreAttributes.push('stud_count')
    }
    if (/(hole|pin|connector)/i.test(partName)) {
      coreAttributes.push('hole_count')
    }

    return coreAttributes
  }

  // 스터드 개수 점수 계산
  const calculateStudCountScore = (detectedCount, partData) => {
    const expectedCount = extractExpectedStudCount(partData)
    if (expectedCount === 0) return 0.5 // 예상 개수 없으면 중간 점수

    const accuracy = 1 - Math.abs(detectedCount - expectedCount) / Math.max(expectedCount, 1)
    return Math.max(0, accuracy)
  }

  // 홀 개수 점수 계산
  const calculateHoleCountScore = (detectedCount, partData) => {
    const expectedCount = extractExpectedHoleCount(partData)
    if (expectedCount === 0) return 0.5

    const accuracy = 1 - Math.abs(detectedCount - expectedCount) / Math.max(expectedCount, 1)
    return Math.max(0, accuracy)
  }

  // 예상 스터드 개수 추출
  const extractExpectedStudCount = (partData) => {
    const name = partData.name || ''
    const match = name.match(/(\d+)x(\d+)/)
    if (match) {
      return parseInt(match[1]) * parseInt(match[2])
    }
    return 0
  }

  // 예상 홀 개수 추출
  const extractExpectedHoleCount = (partData) => {
    const name = partData.name || ''
    if (/(pin|connector|axle)/i.test(name)) {
      return 1 // 기본적으로 1개 홀
    }
    return 0
  }

  // 개별 속성 감지 함수들 (실제 구현에서는 이미지 처리 라이브러리 사용)
  const detectRoundShape = async (imageUrl) => Math.random() * 0.5 + 0.3
  const detectCenterStud = async (imageUrl) => Math.random() * 0.5 + 0.3
  const detectGroove = async (imageUrl) => Math.random() * 0.5 + 0.3
  const countStuds = async (imageUrl) => Math.floor(Math.random() * 10) + 1
  const detectTubePattern = async (imageUrl) => Math.random() * 0.5 + 0.3
  const countHoles = async (imageUrl) => Math.floor(Math.random() * 5)
  const calculateSymmetry = async (imageUrl) => Math.random() * 0.5 + 0.3
  const analyzeEdgeQuality = async (imageUrl) => Math.random() * 0.5 + 0.3
  const analyzeTextureComplexity = async (imageUrl) => Math.random() * 0.5 + 0.3
  const analyzeColorConsistency = async (imageUrl) => Math.random() * 0.5 + 0.3
  const recognizePatterns = async (imageUrl) => Math.random() * 0.5 + 0.3

  // 혼동군 페널티 적용
  const applyConfusionPenalty = (votingResults, confusionMatrix) => {
    return votingResults.map(result => {
      let penalty = 0
      
      // 혼동 가능한 부품들에 대한 페널티 적용
      for (const [confusedPart, penaltyValue] of Object.entries(confusionMatrix)) {
        if (result.part_id === confusedPart) {
          penalty += penaltyValue
        }
      }

      return {
        ...result,
        voting_score: {
          ...result.voting_score,
          totalScore: Math.max(0, result.voting_score.totalScore - penalty)
        },
        confusion_penalty: penalty
      }
    })
  }

  return {
    loading,
    error,
    performMultiAttributeVoting,
    analyzePartAttributes,
    calculateVotingScore,
    applyConfusionPenalty
  }
}
