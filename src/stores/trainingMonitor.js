import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTrainingMonitorStore = defineStore('trainingMonitor', () => {
  // 상태
  const isModalVisible = ref(false)
  const currentTrainingJob = ref(null)
  const trainingJobs = ref([])
  const isPolling = ref(false)

  // 계산된 속성
  const hasActiveTraining = computed(() => {
    return trainingJobs.value.some(job => 
      ['pending', 'training', 'paused'].includes(job.status)
    )
  })

  const activeTrainingJob = computed(() => {
    return trainingJobs.value.find(job => 
      ['pending', 'training', 'paused'].includes(job.status)
    )
  })

  // 액션
  const showModal = (jobId = null) => {
    isModalVisible.value = true
    if (jobId) {
      currentTrainingJob.value = jobId
    } else if (activeTrainingJob.value) {
      currentTrainingJob.value = activeTrainingJob.value.id
    }
  }

  const hideModal = () => {
    isModalVisible.value = false
    currentTrainingJob.value = null
  }

  const setCurrentTrainingJob = (jobId) => {
    currentTrainingJob.value = jobId
  }

  const addTrainingJob = (job) => {
    const existingIndex = trainingJobs.value.findIndex(j => j.id === job.id)
    if (existingIndex >= 0) {
      trainingJobs.value[existingIndex] = job
    } else {
      trainingJobs.value.unshift(job)
    }
  }

  const updateTrainingJob = (jobId, updates) => {
    const job = trainingJobs.value.find(j => j.id === jobId)
    if (job) {
      Object.assign(job, updates)
    }
  }

  const removeTrainingJob = (jobId) => {
    const index = trainingJobs.value.findIndex(j => j.id === jobId)
    if (index >= 0) {
      trainingJobs.value.splice(index, 1)
    }
  }

  const setPolling = (value) => {
    isPolling.value = value
  }

  const clearAllJobs = () => {
    trainingJobs.value = []
  }

  // 로컬 스토리지 동기화
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem('brickbox_training_jobs', JSON.stringify(trainingJobs.value))
      localStorage.setItem('brickbox_training_modal_visible', JSON.stringify(isModalVisible.value))
      localStorage.setItem('brickbox_training_current_job', JSON.stringify(currentTrainingJob.value))
    } catch (error) {
      console.error('로컬 스토리지 저장 실패:', error)
    }
  }

  const loadFromLocalStorage = () => {
    try {
      const savedJobs = localStorage.getItem('brickbox_training_jobs')
      if (savedJobs) {
        trainingJobs.value = JSON.parse(savedJobs)
      }

      const savedModalVisible = localStorage.getItem('brickbox_training_modal_visible')
      if (savedModalVisible) {
        isModalVisible.value = JSON.parse(savedModalVisible)
      }

      const savedCurrentJob = localStorage.getItem('brickbox_training_current_job')
      if (savedCurrentJob) {
        currentTrainingJob.value = JSON.parse(savedCurrentJob)
      }
    } catch (error) {
      console.error('로컬 스토리지 로드 실패:', error)
    }
  }

  // 상태 변경 감지하여 자동 저장
  const startAutoSave = () => {
    // Vue의 watch 대신 직접 이벤트 리스너 사용
    const saveInterval = setInterval(saveToLocalStorage, 1000) // 1초마다 저장
    
    return () => {
      clearInterval(saveInterval)
    }
  }

  return {
    // 상태
    isModalVisible,
    currentTrainingJob,
    trainingJobs,
    isPolling,
    
    // 계산된 속성
    hasActiveTraining,
    activeTrainingJob,
    
    // 액션
    showModal,
    hideModal,
    setCurrentTrainingJob,
    addTrainingJob,
    updateTrainingJob,
    removeTrainingJob,
    setPolling,
    clearAllJobs,
    
    // 로컬 스토리지
    saveToLocalStorage,
    loadFromLocalStorage,
    startAutoSave
  }
})
