import { ref } from 'vue'

const API_BASE_URL = 'http://localhost:3002/api/training'

export function useTrainingAPI() {
  const isLoading = ref(false)
  const error = ref(null)
  
  // 학습 시작
  const startTraining = async (datasetPath, config) => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await fetch(`${API_BASE_URL}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          datasetPath,
          config
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '학습 시작 실패')
      }
      
      return data
      
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  // 학습 중단
  const stopTraining = async (jobId) => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await fetch(`${API_BASE_URL}/stop/${jobId}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '학습 중단 실패')
      }
      
      return data
      
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  // 학습 상태 확인
  const getTrainingStatus = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/status/${jobId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '학습 상태 확인 실패')
      }
      
      return data
      
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  // 활성 학습 목록
  const getActiveTrainings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/active`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '활성 학습 목록 조회 실패')
      }
      
      return data
      
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  // 학습 작업 목록
  const getTrainingJobs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '학습 작업 목록 조회 실패')
      }
      
      return data
      
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  return {
    isLoading,
    error,
    startTraining,
    stopTraining,
    getTrainingStatus,
    getActiveTrainings,
    getTrainingJobs
  }
}
