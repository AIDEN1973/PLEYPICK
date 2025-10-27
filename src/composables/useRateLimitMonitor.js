import { ref, reactive } from 'vue'

/**
 * Rate Limit 모니터링 시스템
 * OpenAI API 사용량을 추적하고 사용자에게 알림
 */

// Rate limit 상태 추적
const rateLimitState = reactive({
  isActive: false,
  lastError: null,
  retryCount: 0,
  estimatedWaitTime: 0,
  totalRequests: 0,
  totalTokens: 0,
  startTime: null
})

// 알림 상태
const notifications = ref([])

export function useRateLimitMonitor() {
  
  /**
   * Rate limit 오류 감지 및 처리
   */
  const handleRateLimitError = (error) => {
    console.warn('🚨 Rate limit 오류 감지:', error)
    
    rateLimitState.isActive = true
    rateLimitState.lastError = error
    rateLimitState.retryCount++
    
    // 오류 메시지에서 대기 시간 추출
    let waitTime = 60000 // 기본 60초
    const match = error.message?.match(/try again in (\d+)ms/)
    if (match) {
      waitTime = parseInt(match[1])
    }
    
    rateLimitState.estimatedWaitTime = waitTime
    
    // 사용자에게 알림
    addNotification({
      type: 'warning',
      title: 'API 사용량 한계 도달',
      message: `OpenAI API 사용량이 한계에 도달했습니다. 약 ${Math.ceil(waitTime/1000)}초 후 자동으로 재시도합니다.`,
      duration: 10000
    })
    
    return waitTime
  }
  
  /**
   * Rate limit 해제
   */
  const clearRateLimit = () => {
    rateLimitState.isActive = false
    rateLimitState.retryCount = 0
    rateLimitState.estimatedWaitTime = 0
    
    addNotification({
      type: 'success',
      title: 'API 사용량 복구',
      message: 'OpenAI API 사용량이 정상화되었습니다.',
      duration: 5000
    })
  }
  
  /**
   * 요청 통계 업데이트
   */
  const updateRequestStats = (tokens = 0) => {
    rateLimitState.totalRequests++
    rateLimitState.totalTokens += tokens
    
    if (!rateLimitState.startTime) {
      rateLimitState.startTime = Date.now()
    }
  }
  
  /**
   * 사용량 추정
   */
  const getUsageEstimate = () => {
    if (!rateLimitState.startTime) return null
    
    const elapsedMinutes = (Date.now() - rateLimitState.startTime) / 60000
    const requestsPerMinute = rateLimitState.totalRequests / elapsedMinutes
    const tokensPerMinute = rateLimitState.totalTokens / elapsedMinutes
    
    return {
      requestsPerMinute: Math.round(requestsPerMinute),
      tokensPerMinute: Math.round(tokensPerMinute),
      estimatedTimeToLimit: {
        requests: Math.max(0, Math.round((500 - requestsPerMinute) / requestsPerMinute)),
        tokens: Math.max(0, Math.round((200000 - tokensPerMinute) / tokensPerMinute))
      }
    }
  }
  
  /**
   * 알림 추가
   */
  const addNotification = (notification) => {
    const id = Date.now()
    notifications.value.push({
      id,
      timestamp: new Date(),
      ...notification
    })
    
    // 자동 제거
    if (notification.duration) {
      setTimeout(() => {
        removeNotification(id)
      }, notification.duration)
    }
  }
  
  /**
   * 알림 제거
   */
  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }
  
  /**
   * 모든 알림 제거
   */
  const clearNotifications = () => {
    notifications.value = []
  }
  
  /**
   * Rate limit 상태 초기화
   */
  const resetStats = () => {
    rateLimitState.isActive = false
    rateLimitState.lastError = null
    rateLimitState.retryCount = 0
    rateLimitState.estimatedWaitTime = 0
    rateLimitState.totalRequests = 0
    rateLimitState.totalTokens = 0
    rateLimitState.startTime = null
    clearNotifications()
  }
  
  return {
    // 상태
    rateLimitState,
    notifications,
    
    // 메서드
    handleRateLimitError,
    clearRateLimit,
    updateRequestStats,
    getUsageEstimate,
    addNotification,
    removeNotification,
    clearNotifications,
    resetStats
  }
}
