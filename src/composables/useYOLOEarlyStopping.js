import { ref, reactive } from 'vue'

/**
 * YOLO EarlyStopping 구현 (기술문서 3.1)
 * 15 epoch 내 mAP 개선 < 0.1% → 조기 종료
 */
export function useYOLOEarlyStopping() {
  const loading = ref(false)
  const error = ref(null)
  const earlyStoppingStats = reactive({
    totalEpochs: 0,
    earlyStops: 0,
    bestMap: 0,
    patience: 0,
    improvementThreshold: 0.001 // 0.1%
  })

  // EarlyStopping 설정
  const earlyStoppingConfig = {
    patience: 15,           // 15 epoch 내 개선 없으면 종료
    minImprovement: 0.001,  // 0.1% 개선 임계값
    monitorMetric: 'mAP',   // 모니터링 지표
    mode: 'max',           // 최대값 모니터링
    restoreBestWeights: true // 최고 성능 가중치 복원
  }

  /**
   * EarlyStopping 상태 초기화
   */
  const initializeEarlyStopping = () => {
    return {
      bestScore: -Infinity,
      wait: 0,
      stoppedEpoch: 0,
      bestWeights: null,
      history: []
    }
  }

  /**
   * Epoch 성능 평가
   */
  const evaluateEpoch = (currentEpoch, metrics, earlyStoppingState) => {
    const currentScore = metrics.mAP || metrics.map || 0
    
    // 히스토리 기록
    earlyStoppingState.history.push({
      epoch: currentEpoch,
      score: currentScore,
      metrics: { ...metrics },
      timestamp: new Date().toISOString()
    })
    
    // 최고 성능 업데이트
    if (currentScore > earlyStoppingState.bestScore) {
      earlyStoppingState.bestScore = currentScore
      earlyStoppingState.wait = 0
      earlyStoppingState.bestWeights = metrics.weights || null
      
      console.log(`🎯 새로운 최고 성능: mAP ${currentScore.toFixed(4)} (Epoch ${currentEpoch})`)
      
      return {
        improved: true,
        shouldContinue: true,
        bestScore: currentScore
      }
    }
    
    // 개선 없음
    earlyStoppingState.wait++
    
    // 개선량 계산
    const improvement = currentScore - earlyStoppingState.bestScore
    const improvementPercent = (improvement / earlyStoppingState.bestScore) * 100
    
    console.log(`📊 Epoch ${currentEpoch}: mAP ${currentScore.toFixed(4)} (개선: ${improvementPercent.toFixed(3)}%)`)
    
    // EarlyStopping 조건 확인
    if (earlyStoppingState.wait >= earlyStoppingConfig.patience) {
      console.log(`🛑 EarlyStopping 트리거: ${earlyStoppingConfig.patience} epoch 동안 개선 없음`)
      
      earlyStoppingStats.earlyStops++
      earlyStoppingStats.bestMap = earlyStoppingState.bestScore
      
      return {
        improved: false,
        shouldContinue: false,
        reason: 'early_stopping',
        bestScore: earlyStoppingState.bestScore,
        stoppedEpoch: currentEpoch
      }
    }
    
    // 개선량이 임계값 미만인 경우
    if (improvementPercent < (earlyStoppingConfig.minImprovement * 100)) {
      console.log(`⚠️ 개선량 부족: ${improvementPercent.toFixed(3)}% < ${(earlyStoppingConfig.minImprovement * 100)}%`)
    }
    
    return {
      improved: false,
      shouldContinue: true,
      bestScore: earlyStoppingState.bestScore,
      wait: earlyStoppingState.wait
    }
  }

  /**
   * EarlyStopping 체크
   */
  const checkEarlyStopping = (currentEpoch, metrics, earlyStoppingState) => {
    const evaluation = evaluateEpoch(currentEpoch, metrics, earlyStoppingState)
    
    if (!evaluation.shouldContinue) {
      earlyStoppingState.stoppedEpoch = currentEpoch
      
      console.log(`🛑 EarlyStopping: ${currentEpoch} epoch에서 중단 (기술문서 4.2)`)
      console.log(`📊 중단 이유: ${evaluation.reason}`)
      
      // 최고 성능 가중치 복원
      if (earlyStoppingConfig.restoreBestWeights && earlyStoppingState.bestWeights) {
        console.log('🔄 최고 성능 가중치 복원 (기술문서 4.2)')
        return {
          shouldStop: true,
          restoreWeights: earlyStoppingState.bestWeights,
          bestScore: earlyStoppingState.bestScore,
          reason: evaluation.reason
        }
      }
      
      return {
        shouldStop: true,
        bestScore: earlyStoppingState.bestScore,
        reason: evaluation.reason
      }
    }
    
    console.log(`✅ EarlyStopping: ${currentEpoch} epoch 계속 진행 (기술문서 4.2)`)
    return {
      shouldStop: false,
      bestScore: earlyStoppingState.bestScore,
      wait: evaluation.wait
    }
  }

  /**
   * 학습 루프 통합
   */
  const runTrainingWithEarlyStopping = async (trainingConfig, options = {}) => {
    try {
      loading.value = true
      console.log('🚀 EarlyStopping 학습 시작...')
      
      const earlyStoppingState = initializeEarlyStopping()
      const maxEpochs = trainingConfig.maxEpochs || 100
      
      for (let epoch = 1; epoch <= maxEpochs; epoch++) {
        // 학습 실행
        const metrics = await runTrainingEpoch(epoch, trainingConfig)
        
        // EarlyStopping 체크
        const stoppingResult = checkEarlyStopping(epoch, metrics, earlyStoppingState)
        
        if (stoppingResult.shouldStop) {
          console.log(`🛑 학습 조기 종료: Epoch ${epoch}`)
          console.log(`📊 최고 성능: mAP ${stoppingResult.bestScore.toFixed(4)}`)
          
          earlyStoppingStats.totalEpochs = epoch
          
          return {
            stoppedEpoch: epoch,
            bestScore: stoppingResult.bestScore,
            reason: stoppingResult.reason,
            history: earlyStoppingState.history,
            restoredWeights: stoppingResult.restoreWeights
          }
        }
        
        // 진행률 로그
        if (epoch % 5 === 0) {
          console.log(`📈 Epoch ${epoch}/${maxEpochs}: mAP ${metrics.mAP?.toFixed(4) || 0} (대기: ${earlyStoppingState.wait}/${earlyStoppingConfig.patience})`)
        }
      }
      
      // 정상 완료
      earlyStoppingStats.totalEpochs = maxEpochs
      console.log(`✅ 학습 완료: ${maxEpochs} epoch`)
      
      return {
        stoppedEpoch: maxEpochs,
        bestScore: earlyStoppingState.bestScore,
        reason: 'completed',
        history: earlyStoppingState.history
      }
      
    } catch (err) {
      error.value = err.message
      console.error('❌ EarlyStopping 학습 실패:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 학습 Epoch 실행 (실제 구현 필요)
   */
  const runTrainingEpoch = async (epoch, config) => {
    // 실제 학습 로직 구현 필요
    // 실제 구현 필요
    throw new Error('실제 학습 로직이 구현되지 않았습니다')
  }

  /**
   * EarlyStopping 통계 조회
   */
  const getEarlyStoppingStats = () => {
    return {
      ...earlyStoppingStats,
      config: earlyStoppingConfig
    }
  }

  /**
   * 통계 리셋
   */
  const resetStats = () => {
    earlyStoppingStats.totalEpochs = 0
    earlyStoppingStats.earlyStops = 0
    earlyStoppingStats.bestMap = 0
    earlyStoppingStats.patience = 0
  }

  return {
    loading,
    error,
    earlyStoppingStats,
    initializeEarlyStopping,
    evaluateEpoch,
    checkEarlyStopping,
    runTrainingWithEarlyStopping,
    getEarlyStoppingStats,
    resetStats
  }
}
