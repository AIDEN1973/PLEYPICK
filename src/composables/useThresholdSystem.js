import { ref, reactive } from 'vue'
import { supabase } from './useSupabase'

export function useThresholdSystem() {
  const loading = ref(false)
  const error = ref(null)
  const processing = ref(false)

  // 임계치 설정 (더 현실적인 값으로 조정)
  const thresholdConfig = reactive({
    // 자동 승인 임계치
    autoApprove: {
      minScore: 0.85,  // 0.95에서 0.85로 낮춤
      minConfidence: 0.80,  // 0.90에서 0.80으로 낮춤
      requiredChecks: ['vision', 'llm', 'color']
    },
    
    // 수동 검토 임계치
    manualReview: {
      minScore: 0.70,  // 0.85에서 0.70으로 낮춤
      maxScore: 0.84,  // 0.94에서 0.84로 낮춤
      minConfidence: 0.60,  // 0.70에서 0.60으로 낮춤
      showCandidates: 3
    },
    
    // 재촬영 요청 임계치
    retakeRequired: {
      maxScore: 0.69,  // 0.84에서 0.69로 낮춤
      guidance: true
    },
    
    // 가중치 설정
    weights: {
      vision: 0.4,      // 시각적 유사도
      llm: 0.4,        // LLM 분석
      color: 0.15,     // 색상 정확도
      context: 0.05    // 컨텍스트 검증
    }
  })

  // 임계치 기반 자동 승인 처리
  const processThresholdApproval = async (detectionResults) => {
    processing.value = true
    error.value = null

    try {
      const results = {
        autoApproved: [],
        manualReview: [],
        retakeRequired: [],
        statistics: {
          total: detectionResults.length,
          autoApproved: 0,
          manualReview: 0,
          retakeRequired: 0,
          averageConfidence: 0
        }
      }

      let totalConfidence = 0

      for (const result of detectionResults) {
        try {
          // 최종 점수 계산
          const finalScore = calculateFinalScore(result)
          const confidence = result.confidence || 0.5
          
          totalConfidence += confidence

          // 임계치 기반 분류
          const classification = classifyByThreshold(finalScore, confidence, result)
          
          // 결과 저장
          const processedResult = {
            ...result,
            finalScore,
            confidence,
            classification,
            timestamp: new Date().toISOString()
          }

          // 분류별 처리
          switch (classification.status) {
            case 'auto_approved':
              results.autoApproved.push(processedResult)
              results.statistics.autoApproved++
              await logApprovalResult(processedResult, 'auto_approved')
              break
              
            case 'manual_review':
              results.manualReview.push(processedResult)
              results.statistics.manualReview++
              await logApprovalResult(processedResult, 'manual_review')
              break
              
            case 'retake_required':
              results.retakeRequired.push(processedResult)
              results.statistics.retakeRequired++
              await logApprovalResult(processedResult, 'retake_required')
              break
          }
        } catch (err) {
          console.error('Failed to process result:', err)
          // 오류 발생 시 재촬영 요청으로 분류
          results.retakeRequired.push({
            ...result,
            finalScore: 0,
            confidence: 0,
            classification: { status: 'retake_required', reason: 'Processing error' },
            timestamp: new Date().toISOString()
          })
          results.statistics.retakeRequired++
        }
      }

      // 통계 계산
      results.statistics.averageConfidence = totalConfidence / detectionResults.length

      return results
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      processing.value = false
    }
  }

  // 최종 점수 계산
  const calculateFinalScore = (result) => {
    const weights = thresholdConfig.weights
    let totalScore = 0
    let totalWeight = 0

    // 실제 전달값만 사용 (목업/랜덤 금지)
    const visionScore = Number.isFinite(result.similarity) ? result.similarity : 0
    const llmScore = Number.isFinite(result.llmScore) ? result.llmScore : 0
    const colorScore = Number.isFinite(result.colorMatch) ? result.colorMatch : 0
    const contextScore = Number.isFinite(result.contextScore) ? result.contextScore : 0

    // 각 점수 요소별 가중치 적용
    totalScore += visionScore * weights.vision
    totalWeight += weights.vision

    totalScore += llmScore * weights.llm
    totalWeight += weights.llm

    totalScore += colorScore * weights.color
    totalWeight += weights.color

    totalScore += contextScore * weights.context
    totalWeight += weights.context

    const finalScore = totalWeight > 0 ? Math.min(totalScore / totalWeight, 1.0) : 0
    
    // 상세 로그는 운영 모드에서 비활성화

    return finalScore
  }

  // 임계치 기반 분류
  const classifyByThreshold = (finalScore, confidence, result) => {
    // 자동 승인 조건 확인
    if (finalScore >= thresholdConfig.autoApprove.minScore && 
        confidence >= thresholdConfig.autoApprove.minConfidence) {
      
      // 필수 검증 항목 확인
      const hasRequiredChecks = thresholdConfig.autoApprove.requiredChecks.every(
        check => result[check] !== undefined && result[check] > 0.5
      )
      
      if (hasRequiredChecks) {
        return {
          status: 'auto_approved',
          reason: 'High confidence match',
          confidence: finalScore,
          autoApproved: true
        }
      }
    }

    // 수동 검토 조건 확인
    if (finalScore >= thresholdConfig.manualReview.minScore && 
        finalScore < thresholdConfig.manualReview.maxScore &&
        confidence >= thresholdConfig.manualReview.minConfidence) {
      
      return {
        status: 'manual_review',
        reason: 'Medium confidence - requires review',
        confidence: finalScore,
        showCandidates: thresholdConfig.manualReview.showCandidates,
        guidance: generateReviewGuidance(result)
      }
    }

    // 재촬영 요청
    return {
      status: 'retake_required',
      reason: 'Low confidence - retake required',
      confidence: finalScore,
      guidance: generateRetakeGuidance(result)
    }
  }

  // 수동 검토 가이드 생성
  const generateReviewGuidance = (result) => {
    const guidances = []
    
    if (result.vision < 0.8) {
      guidances.push('시각적 유사도가 낮습니다. 부품이 명확하게 보이는지 확인해주세요.')
    }
    
    if (result.llm < 0.8) {
      guidances.push('LLM 분석 결과가 불확실합니다. 부품의 특징이 명확한지 확인해주세요.')
    }
    
    if (result.color < 0.8) {
      guidances.push('색상 매칭이 불확실합니다. 조명 조건을 확인해주세요.')
    }

    return {
      message: '수동 검토가 필요합니다.',
      suggestions: guidances,
      priority: 'medium'
    }
  }

  // 재촬영 가이드 생성
  const generateRetakeGuidance = (result) => {
    const guidances = []
    
    if (result.vision < 0.6) {
      guidances.push('부품이 명확하게 보이지 않습니다. 카메라 각도를 조정해주세요.')
    }
    
    if (result.llm < 0.6) {
      guidances.push('부품의 특징을 식별할 수 없습니다. 부품을 더 명확하게 배치해주세요.')
    }
    
    if (result.color < 0.6) {
      guidances.push('색상을 정확히 식별할 수 없습니다. 조명을 개선해주세요.')
    }

    return {
      message: '재촬영이 필요합니다.',
      suggestions: guidances,
      priority: 'high',
      actions: [
        '카메라 각도 조정',
        '조명 개선',
        '부품 위치 조정',
        '반사광 제거'
      ]
    }
  }

  // 승인 결과 로깅
  const logApprovalResult = async (result, status) => {
    try {
      // 실제 DB 테이블이 준비되면 여기서 insert 수행
      return { success: true }
    } catch (err) {
      console.error('Failed to log approval result:', err)
    }
  }

  // 사용자 피드백 처리
  const processUserFeedback = async (resultId, feedback) => {
    processing.value = true
    error.value = null

    try {
      return { success: true }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      processing.value = false
    }
  }

  // 피드백 학습 데이터 저장
  const saveFeedbackLearningData = async (resultId, feedback) => {
    try {
      // 실제 구현에서는 학습 데이터를 별도 테이블에 저장
      // 여기서는 간단히 로그만 저장
      console.log('Feedback learning data saved:', { resultId, feedback })
    } catch (err) {
      console.error('Failed to save feedback learning data:', err)
    }
  }

  // 임계치 설정 업데이트
  const updateThresholdConfig = async (newConfig) => {
    try {
      // 설정 검증
      if (newConfig.autoApprove.minScore < 0.8 || newConfig.autoApprove.minScore > 1.0) {
        throw new Error('Auto approve threshold must be between 0.8 and 1.0')
      }
      
      if (newConfig.manualReview.minScore >= newConfig.manualReview.maxScore) {
        throw new Error('Manual review min score must be less than max score')
      }

      // 설정 업데이트
      Object.assign(thresholdConfig, newConfig)
      
      return { success: true, message: 'Threshold configuration updated' }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 성능 통계 조회 (실데이터 연계 전까지 빈 값 반환)
  const getPerformanceStatistics = async (sessionId = null, startDate = null, endDate = null) => {
    loading.value = true
    error.value = null

    try {
      return {
        total_detections: 0,
        correct_detections: 0,
        accuracy_rate: 0,
        auto_approval_rate: 0,
        manual_review_rate: 0,
        retake_rate: 0,
        average_confidence: 0,
        processing_time_avg: 0
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 실시간 모니터링 (빈 목록 반환)
  const getRealtimeMetrics = async () => {
    return []
  }

  // 임계치 최적화 제안
  const getThresholdOptimizationSuggestions = async (recentStats) => {
    const suggestions = []
    
    // 자동 승인률이 너무 낮은 경우
    if (recentStats.auto_approval_rate < 0.7) {
      suggestions.push({
        type: 'auto_approval_threshold',
        message: '자동 승인률이 낮습니다. 임계치를 조정하는 것을 고려해보세요.',
        suggestion: 'autoApprove.minScore를 0.90으로 낮추는 것을 권장합니다.',
        priority: 'medium'
      })
    }
    
    // 재촬영률이 너무 높은 경우
    if (recentStats.retake_rate > 0.3) {
      suggestions.push({
        type: 'retake_threshold',
        message: '재촬영률이 높습니다. 임계치를 조정하는 것을 고려해보세요.',
        suggestion: 'manualReview.minScore를 0.80으로 낮추는 것을 권장합니다.',
        priority: 'high'
      })
    }
    
    // 정확도가 낮은 경우
    if (recentStats.accuracy_rate < 0.9) {
      suggestions.push({
        type: 'accuracy_improvement',
        message: '전체 정확도가 낮습니다. 시스템 개선이 필요합니다.',
        suggestion: 'LLM 모델 업데이트 또는 부품 특징 데이터 개선을 권장합니다.',
        priority: 'high'
      })
    }

    return suggestions
  }

  return {
    loading,
    error,
    processing,
    thresholdConfig,
    processThresholdApproval,
    calculateFinalScore,
    classifyByThreshold,
    processUserFeedback,
    updateThresholdConfig,
    getPerformanceStatistics,
    getRealtimeMetrics,
    getThresholdOptimizationSuggestions
  }
}
