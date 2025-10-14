import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

export function useTrainingWebSocket() {
  const socket = ref(null)
  const isConnected = ref(false)
  const trainingLogs = ref([])
  const trainingProgress = ref({})
  const trainingStatus = ref({})
  const connectionStatus = ref('disconnected') // 'connected', 'disconnected', 'reconnecting'
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  
  // WebSocket 연결
  const connect = () => {
    if (socket.value) return
    
    socket.value = io('http://localhost:3002', {
      transports: ['websocket']
    })
    
    socket.value.on('connect', () => {
      console.log('📡 학습 WebSocket 연결됨')
      isConnected.value = true
      connectionStatus.value = 'connected'
      reconnectAttempts.value = 0
    })
    
    socket.value.on('disconnect', () => {
      console.log('📡 학습 WebSocket 연결 해제')
      isConnected.value = false
      connectionStatus.value = 'disconnected'
    })
    
    socket.value.on('reconnect', (attemptNumber) => {
      console.log(`📡 학습 WebSocket 재연결 시도 ${attemptNumber}`)
      connectionStatus.value = 'reconnecting'
      reconnectAttempts.value = attemptNumber
    })
    
    socket.value.on('reconnect_failed', () => {
      console.error('📡 학습 WebSocket 재연결 실패')
      connectionStatus.value = 'disconnected'
      reconnectAttempts.value = maxReconnectAttempts
    })
    
    // 학습 로그 수신
    socket.value.on('training_log', (data) => {
      console.log('📊 학습 로그:', data)
      trainingLogs.value.push({
        jobId: data.jobId,
        log: data.log,
        timestamp: data.timestamp
      })
      
      // 최대 100개 로그만 유지
      if (trainingLogs.value.length > 100) {
        trainingLogs.value = trainingLogs.value.slice(-100)
      }
    })
    
    // 학습 진행률 수신 (표준화: progress_percent만 사용)
    socket.value.on('training_progress', (payload) => {
      console.log('📈 학습 진행률:', payload)
      const percent = payload?.progress_percent ?? payload?.progress ?? 0
      trainingProgress.value[payload.jobId] = {
        progress_percent: percent,
        // 하위호환: 기존 코드가 progress를 참조할 수 있어 동기화 유지
        progress: percent,
        currentEpoch: payload.currentEpoch,
        totalEpochs: payload.totalEpochs,
        timestamp: new Date().toISOString()
      }
    })
    
    // 학습 오류 수신
    socket.value.on('training_error', (data) => {
      console.error('❌ 학습 오류:', data)
      trainingLogs.value.push({
        jobId: data.jobId,
        log: `[오류] ${data.error}`,
        timestamp: data.timestamp,
        isError: true
      })
    })
    
    // 학습 완료 수신
    socket.value.on('training_complete', (data) => {
      console.log('✅ 학습 완료:', data)
      trainingStatus.value[data.jobId] = {
        status: data.success ? 'completed' : 'failed',
        message: data.message,
        timestamp: new Date().toISOString()
      }
    })
    
    // 학습 중단 수신
    socket.value.on('training_stopped', (data) => {
      console.log('⏹️ 학습 중단:', data)
      trainingStatus.value[data.jobId] = {
        status: 'stopped',
        message: data.message,
        timestamp: new Date().toISOString()
      }
    })
  }
  
  // WebSocket 연결 해제
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
    }
  }
  
  // 특정 작업 구독
  const subscribeJob = (jobId) => {
    if (socket.value) {
      socket.value.emit('subscribe_job', jobId)
    }
  }
  
  // 작업 구독 해제
  const unsubscribeJob = (jobId) => {
    if (socket.value) {
      socket.value.emit('unsubscribe_job', jobId)
    }
  }
  
  // 특정 작업의 로그 가져오기
  const getJobLogs = (jobId) => {
    return trainingLogs.value.filter(log => log.jobId === jobId)
  }
  
  // 특정 작업의 진행률 가져오기
  const getJobProgress = (jobId) => {
    return trainingProgress.value[jobId] || null
  }
  
  // 특정 작업의 상태 가져오기
  const getJobStatus = (jobId) => {
    return trainingStatus.value[jobId] || null
  }
  
  // 로그 초기화
  const clearLogs = () => {
    trainingLogs.value = []
  }
  
  // 진행률 초기화
  const clearProgress = () => {
    trainingProgress.value = {}
  }
  
  // 상태 초기화
  const clearStatus = () => {
    trainingStatus.value = {}
  }
  
  // 컴포넌트 마운트 시 연결
  onMounted(() => {
    connect()
  })
  
  // 컴포넌트 언마운트 시 연결 해제
  onUnmounted(() => {
    disconnect()
  })
  
  return {
    socket,
    isConnected,
    trainingLogs,
    trainingProgress,
    trainingStatus,
    connectionStatus,
    reconnectAttempts,
    maxReconnectAttempts,
    connect,
    disconnect,
    subscribeJob,
    unsubscribeJob,
    getJobLogs,
    getJobProgress,
    getJobStatus,
    clearLogs,
    clearProgress,
    clearStatus
  }
}
