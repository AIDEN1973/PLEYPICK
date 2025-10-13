/**
 * 🔄 LLM 분석 실패 자동 재시도 큐
 * 
 * 실패한 LLM 분석 작업을 자동으로 재시도하는 큐 시스템
 * - 지수 백오프 (Exponential Backoff) 적용
 * - 최대 3회 재시도
 * - 실패 로그 수집
 */

import { ref, computed } from 'vue'
import { analyzePartWithLLM, saveToMasterPartsDB } from './useMasterPartsPreprocessing'
import { useSlackAlert } from './useSlackAlert'

// 전역 상태 (싱글톤)
const retryQueue = ref([])
const isProcessing = ref(false)

export function useRetryQueue() {
  const maxRetries = 3
  const baseDelayMs = 60000 // 1분 기본 대기
  const { alertLLMAnalysisFailed } = useSlackAlert()

  /**
   * 재시도 큐에 항목 추가
   */
  const addToRetryQueue = (partId, partData, errorType, errorMessage) => {
    const existingItem = retryQueue.value.find(item => item.partId === partId)
    
    if (existingItem) {
      // 이미 있으면 재시도 카운트만 증가
      existingItem.retryCount++
      existingItem.lastError = errorMessage
      existingItem.lastAttempt = new Date()
      existingItem.nextRetry = new Date(Date.now() + baseDelayMs * Math.pow(2, existingItem.retryCount))
      
      console.log(`📋 재시도 큐 업데이트: ${partId} (${existingItem.retryCount}/${maxRetries})`)
    } else {
      // 새로 추가
      const newItem = {
        partId,
        partData,
        errorType,
        errorMessage,
        retryCount: 1,
        firstAttempt: new Date(),
        lastAttempt: new Date(),
        nextRetry: new Date(Date.now() + baseDelayMs),
        status: 'pending'
      }
      
      retryQueue.value.push(newItem)
      console.log(`➕ 재시도 큐에 추가: ${partId}`)
    }
  }

  /**
   * 재시도 큐 처리
   */
  const processRetryQueue = async () => {
    if (isProcessing.value) {
      console.log('⏸️ 재시도 큐 처리 중... 중복 실행 방지')
      return
    }

    isProcessing.value = true
    const now = new Date()
    
    const itemsToRetry = retryQueue.value.filter(
      item => item.status === 'pending' && 
              item.nextRetry <= now && 
              item.retryCount <= maxRetries
    )

    if (itemsToRetry.length === 0) {
      isProcessing.value = false
      return
    }

    console.log(`🔄 재시도 큐 처리 시작: ${itemsToRetry.length}개 항목`)

    for (const item of itemsToRetry) {
      try {
        item.status = 'processing'
        console.log(`🔁 재시도 중: ${item.partId} (${item.retryCount}/${maxRetries})`)
        
        // LLM 분석 재시도
        const analysis = await analyzePartWithLLM(
          item.partData.part,
          item.partData.imageUrl
        )
        
        // DB 저장
        await saveToMasterPartsDB({
          ...analysis,
          part_num: item.partId,
          color_id: item.partData.color_id
        })
        
        // 성공 시 큐에서 제거
        retryQueue.value = retryQueue.value.filter(i => i.partId !== item.partId)
        console.log(`✅ 재시도 성공: ${item.partId}`)
        
      } catch (err) {
        console.error(`❌ 재시도 실패: ${item.partId}`, err)
        
        item.retryCount++
        item.lastAttempt = now
        item.lastError = err.message
        item.status = 'pending'
        
        if (item.retryCount > maxRetries) {
          // 최대 재시도 초과
          item.status = 'failed'
          console.error(`🚫 최대 재시도 초과: ${item.partId} (${item.retryCount}/${maxRetries})`)
          
          // Slack 알림: 최대 재시도 초과
          await alertLLMAnalysisFailed(item.partId, err.message, item.retryCount)
        } else {
          // 다음 재시도 시간 계산 (지수 백오프)
          const delay = baseDelayMs * Math.pow(2, item.retryCount)
          item.nextRetry = new Date(now.getTime() + delay)
          console.log(`⏰ 다음 재시도: ${item.partId} - ${new Date(item.nextRetry).toLocaleTimeString('ko-KR')}`)
        }
      }
    }

    isProcessing.value = false
    console.log(`✅ 재시도 큐 처리 완료`)
  }

  /**
   * 특정 항목 제거
   */
  const removeFromQueue = (partId) => {
    retryQueue.value = retryQueue.value.filter(item => item.partId !== partId)
    console.log(`🗑️ 재시도 큐에서 제거: ${partId}`)
  }

  /**
   * 큐 초기화
   */
  const clearQueue = () => {
    retryQueue.value = []
    console.log(`🧹 재시도 큐 초기화 완료`)
  }

  /**
   * 통계
   */
  const queueStats = computed(() => {
    const pending = retryQueue.value.filter(item => item.status === 'pending').length
    const processing = retryQueue.value.filter(item => item.status === 'processing').length
    const failed = retryQueue.value.filter(item => item.status === 'failed').length
    
    return {
      total: retryQueue.value.length,
      pending,
      processing,
      failed
    }
  })

  return {
    retryQueue,
    queueStats,
    isProcessing,
    addToRetryQueue,
    processRetryQueue,
    removeFromQueue,
    clearQueue
  }
}

/**
 * 자동 재시도 인터벌 시작
 */
export function startAutoRetry(intervalMs = 120000) {
  const { processRetryQueue } = useRetryQueue()
  
  const intervalId = setInterval(() => {
    processRetryQueue()
  }, intervalMs) // 기본 2분마다 실행
  
  console.log(`🚀 자동 재시도 인터벌 시작 (${intervalMs / 1000}초마다)`)
  
  return () => {
    clearInterval(intervalId)
    console.log(`⏹️ 자동 재시도 인터벌 중지`)
  }
}

