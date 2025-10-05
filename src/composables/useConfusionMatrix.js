// src/composables/useConfusionMatrix.js
import { ref } from 'vue'

export function useConfusionMatrix() {
  const loading = ref(false)
  const error = ref(null)

  // 혼동군 정의 및 페널티 매트릭스
  const confusionMatrix = {
    // 2x2 관련 혼동군
    '3023': { // 2x2 Plate
      '2412b': 0.15, // 2x2 Tile (스터드 없음)
      '18674': 0.20, // 2x2 Jumper (중앙 스터드)
      '3068b': 0.10  // 2x2 Round Plate
    },
    '2412b': { // 2x2 Tile
      '3023': 0.15,  // 2x2 Plate
      '3068b': 0.10  // 2x2 Round Plate
    },
    '18674': { // 2x2 Jumper
      '3023': 0.20,  // 2x2 Plate
      '3068b': 0.15  // 2x2 Round Plate
    },
    '3068b': { // 2x2 Round Plate
      '3023': 0.10,  // 2x2 Plate
      '2412b': 0.10, // 2x2 Tile
      '18674': 0.15  // 2x2 Jumper
    },

    // 1x2 관련 혼동군
    '3023': { // 1x2 Plate
      '3069b': 0.12, // 1x2 Tile
      '18651': 0.18  // 1x2 Jumper
    },
    '3069b': { // 1x2 Tile
      '3023': 0.12,  // 1x2 Plate
      '18651': 0.15  // 1x2 Jumper
    },

    // 기어 관련 혼동군
    '3647': { // 8 Tooth Gear
      '3648': 0.25,  // 16 Tooth Gear
      '3650': 0.30,  // 24 Tooth Gear
      '3651': 0.20   // 40 Tooth Gear
    },
    '3648': { // 16 Tooth Gear
      '3647': 0.25,  // 8 Tooth Gear
      '3650': 0.20,  // 24 Tooth Gear
      '3651': 0.15   // 40 Tooth Gear
    },

    // 슬로프 관련 혼동군
    '3040': { // Slope 45 2x2
      '3041': 0.15,  // Slope 45 2x1
      '3042': 0.20,  // Slope 45 1x2
      '3043': 0.10   // Slope 45 1x1
    },

    // 조형형 부품 혼동군
    '3626b': { // Minifig Head
      '3626bp01': 0.30, // Printed Minifig Head
      '3626bp02': 0.30, // Different Print
      '3626bp03': 0.30  // Another Print
    },

    // Technic 핀 관련 혼동군
    '2780': { // Technic Pin
      '2781': 0.20,  // Technic Pin with Friction
      '32034': 0.15, // Technic Pin Long
      '32013': 0.10  // Technic Pin Short
    }
  }

  // 혼동군 페널티 적용
  const applyConfusionPenalty = (recognitionResults) => {
    try {
      loading.value = true
      error.value = null

      console.log('🔍 Applying confusion matrix penalties...')

      const penalizedResults = recognitionResults.map(result => {
        const partId = result.part_id
        const confusionData = confusionMatrix[partId] || {}
        
        let totalPenalty = 0
        const appliedPenalties = []

        // 각 혼동 부품에 대한 페널티 적용
        for (const [confusedPartId, penaltyValue] of Object.entries(confusionData)) {
          // 혼동 가능한 부품이 후보에 있는지 확인
          const confusedPartIndex = recognitionResults.findIndex(r => r.part_id === confusedPartId)
          if (confusedPartIndex !== -1) {
            totalPenalty += penaltyValue
            appliedPenalties.push({
              confused_part: confusedPartId,
              penalty: penaltyValue
            })
          }
        }

        // 최종 점수에서 페널티 차감
        const finalScore = Math.max(0, result.confidence - totalPenalty)

        return {
          ...result,
          confidence: finalScore,
          original_confidence: result.confidence,
          confusion_penalty: totalPenalty,
          applied_penalties: appliedPenalties,
          method: result.method + '_with_confusion_penalty'
        }
      })

      // 페널티 적용 후 다시 정렬
      penalizedResults.sort((a, b) => b.confidence - a.confidence)

      console.log('✅ Confusion penalties applied:', penalizedResults)
      return penalizedResults

    } catch (err) {
      error.value = err.message
      console.error('❌ Confusion penalty application failed:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 혼동군 통계 생성
  const generateConfusionStatistics = (recognitionResults) => {
    const stats = {
      total_parts: recognitionResults.length,
      parts_with_penalties: 0,
      total_penalty_applied: 0,
      confusion_groups: {},
      top_confused_pairs: []
    }

    recognitionResults.forEach(result => {
      if (result.confusion_penalty > 0) {
        stats.parts_with_penalties++
        stats.total_penalty_applied += result.confusion_penalty

        // 혼동군별 통계
        result.applied_penalties?.forEach(penalty => {
          const groupKey = `${result.part_id}_vs_${penalty.confused_part}`
          if (!stats.confusion_groups[groupKey]) {
            stats.confusion_groups[groupKey] = {
              count: 0,
              total_penalty: 0,
              avg_penalty: 0
            }
          }
          stats.confusion_groups[groupKey].count++
          stats.confusion_groups[groupKey].total_penalty += penalty.penalty
          stats.confusion_groups[groupKey].avg_penalty = 
            stats.confusion_groups[groupKey].total_penalty / stats.confusion_groups[groupKey].count
        })
      }
    })

    // 상위 혼동 쌍 추출
    stats.top_confused_pairs = Object.entries(stats.confusion_groups)
      .sort(([,a], [,b]) => b.total_penalty - a.total_penalty)
      .slice(0, 5)
      .map(([pair, data]) => ({
        pair,
        ...data
      }))

    return stats
  }

  // 혼동군 업데이트 (학습 데이터 기반)
  const updateConfusionMatrix = (newConfusionData) => {
    try {
      console.log('🔄 Updating confusion matrix with new data...')

      // 기존 매트릭스에 새 데이터 병합
      Object.entries(newConfusionData).forEach(([partId, penalties]) => {
        if (confusionMatrix[partId]) {
          confusionMatrix[partId] = { ...confusionMatrix[partId], ...penalties }
        } else {
          confusionMatrix[partId] = penalties
        }
      })

      console.log('✅ Confusion matrix updated successfully')
      return confusionMatrix

    } catch (err) {
      error.value = err.message
      console.error('❌ Confusion matrix update failed:', err)
      throw err
    }
  }

  // 혼동군 검증
  const validateConfusionMatrix = () => {
    const validation = {
      total_entries: 0,
      valid_entries: 0,
      invalid_entries: [],
      coverage: 0
    }

    Object.entries(confusionMatrix).forEach(([partId, penalties]) => {
      validation.total_entries++
      
      const isValid = Object.values(penalties).every(penalty => 
        typeof penalty === 'number' && penalty >= 0 && penalty <= 1
      )
      
      if (isValid) {
        validation.valid_entries++
      } else {
        validation.invalid_entries.push(partId)
      }
    })

    validation.coverage = validation.valid_entries / validation.total_entries

    return validation
  }

  // 혼동군 추천 (ML 기반)
  const recommendConfusionGroups = (recognitionHistory) => {
    try {
      console.log('🤖 Generating confusion group recommendations...')

      // 실제 구현에서는 ML 모델을 사용하여 혼동 패턴 학습
      const recommendations = []

      // 예시: 자주 혼동되는 부품 쌍 분석
      const confusionPatterns = analyzeConfusionPatterns(recognitionHistory)
      
      confusionPatterns.forEach(pattern => {
        if (pattern.frequency > 5 && pattern.avg_penalty > 0.1) {
          recommendations.push({
            part_a: pattern.part_a,
            part_b: pattern.part_b,
            suggested_penalty: Math.min(pattern.avg_penalty * 1.2, 0.5),
            confidence: pattern.frequency / 10,
            reason: `Frequently confused pair (${pattern.frequency} occurrences)`
          })
        }
      })

      console.log('✅ Confusion group recommendations generated:', recommendations)
      return recommendations

    } catch (err) {
      error.value = err.message
      console.error('❌ Confusion group recommendation failed:', err)
      return []
    }
  }

  // 혼동 패턴 분석
  const analyzeConfusionPatterns = (recognitionHistory) => {
    const patterns = {}
    
    recognitionHistory.forEach(record => {
      if (record.applied_penalties) {
        record.applied_penalties.forEach(penalty => {
          const key = `${record.part_id}_vs_${penalty.confused_part}`
          if (!patterns[key]) {
            patterns[key] = {
              part_a: record.part_id,
              part_b: penalty.confused_part,
              frequency: 0,
              total_penalty: 0,
              avg_penalty: 0
            }
          }
          patterns[key].frequency++
          patterns[key].total_penalty += penalty.penalty
          patterns[key].avg_penalty = patterns[key].total_penalty / patterns[key].frequency
        })
      }
    })

    return Object.values(patterns)
  }

  return {
    loading,
    error,
    confusionMatrix,
    applyConfusionPenalty,
    generateConfusionStatistics,
    updateConfusionMatrix,
    validateConfusionMatrix,
    recommendConfusionGroups
  }
}
