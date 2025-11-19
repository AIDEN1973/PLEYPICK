import { ref, reactive } from 'vue'

// 글로벌 백그라운드 작업 상태
const backgroundTasks = reactive(new Map())
const taskIdCounter = ref(0)
const taskCancellers = reactive(new Map()) // 작업 취소 함수 저장

export function useBackgroundTasks() {
  // 새 백그라운드 작업 시작
  const startBackgroundTask = (taskName, taskFunction) => {
    const taskId = ++taskIdCounter.value
    let cancelled = false
    const cancelToken = { cancelled: false }
    
    const task = {
      id: taskId,
      name: taskName,
      status: 'running', // running, completed, failed, cancelled
      progress: 0,
      total: 0,
      current: 0,
      result: null,
      error: null,
      startTime: new Date(),
      endTime: null,
      setNum: null, // 레고 세트 번호
      setName: null, // 레고 세트 이름
      totalParts: 0, // 전체 부품수
      savedParts: 0 // 저장된 부품수
    }
    
    backgroundTasks.set(taskId, task)
    
    // 취소 함수 저장
    const cancelFn = () => {
      cancelToken.cancelled = true
      task.status = 'cancelled'
      task.endTime = new Date()
      console.log(`Background task ${taskName} (ID: ${taskId}) cancelled`)
    }
    taskCancellers.set(taskId, cancelFn)
    
    // 백그라운드에서 작업 실행
    const wrappedFunction = async (task) => {
      // 취소 체크를 위한 래퍼
      const checkCancelled = () => {
        if (cancelToken.cancelled) {
          throw new Error('Task cancelled by user')
        }
      }
      
      try {
        checkCancelled()
        const result = await taskFunction(task, checkCancelled)
        if (!cancelToken.cancelled) {
          task.status = 'completed'
          task.result = result
          task.endTime = new Date()
          task.progress = 100
        }
        return result
      } catch (error) {
        if (cancelToken.cancelled) {
          task.status = 'cancelled'
        } else {
          task.status = 'failed'
          task.error = error
        }
        task.endTime = new Date()
        if (!cancelToken.cancelled) {
          console.error(`Background task ${taskName} failed:`, error)
        }
        throw error
      }
    }
    
    wrappedFunction(task)
      .catch(() => {}) // 에러는 이미 처리됨
    
    return taskId
  }
  
  // 작업 취소
  const cancelTask = (taskId) => {
    const cancelFn = taskCancellers.get(taskId)
    if (cancelFn) {
      cancelFn()
      taskCancellers.delete(taskId)
      return true
    }
    return false
  }
  
  // 작업 상태 업데이트
  const updateTaskProgress = (taskId, current, total, savedParts = null) => {
    const task = backgroundTasks.get(taskId)
    if (task) {
      task.current = current
      task.total = total
      task.progress = total > 0 ? Math.round((current / total) * 100) : 0
      if (savedParts !== null) {
        task.savedParts = savedParts
      } else {
        task.savedParts = current
      }
    }
  }
  
  // 작업 완료
  const completeTask = (taskId, result) => {
    const task = backgroundTasks.get(taskId)
    if (task) {
      task.status = 'completed'
      task.result = result
      task.endTime = new Date()
      task.progress = 100
    }
  }
  
  // 작업 실패
  const failTask = (taskId, error) => {
    const task = backgroundTasks.get(taskId)
    if (task) {
      task.status = 'failed'
      task.error = error
      task.endTime = new Date()
    }
  }
  
  // 작업 제거
  const removeTask = (taskId) => {
    backgroundTasks.delete(taskId)
  }
  
  // 모든 작업 가져오기
  const getAllTasks = () => {
    return Array.from(backgroundTasks.values())
  }
  
  // 실행 중인 작업 가져오기
  const getRunningTasks = () => {
    return Array.from(backgroundTasks.values()).filter(task => task.status === 'running')
  }
  
  // 특정 작업 가져오기
  const getTask = (taskId) => {
    return backgroundTasks.get(taskId)
  }
  
  return {
    startBackgroundTask,
    updateTaskProgress,
    completeTask,
    failTask,
    removeTask,
    cancelTask,
    getAllTasks,
    getRunningTasks,
    getTask
  }
}
