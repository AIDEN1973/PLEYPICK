import { ref, reactive } from 'vue'

// 글로벌 백그라운드 작업 상태
const backgroundTasks = reactive(new Map())
const taskIdCounter = ref(0)

export function useBackgroundTasks() {
  // 새 백그라운드 작업 시작
  const startBackgroundTask = (taskName, taskFunction) => {
    const taskId = ++taskIdCounter.value
    const task = {
      id: taskId,
      name: taskName,
      status: 'running', // running, completed, failed
      progress: 0,
      total: 0,
      current: 0,
      result: null,
      error: null,
      startTime: new Date(),
      endTime: null
    }
    
    backgroundTasks.set(taskId, task)
    
    // 백그라운드에서 작업 실행
    taskFunction(task)
      .then(result => {
        task.status = 'completed'
        task.result = result
        task.endTime = new Date()
        task.progress = 100
      })
      .catch(error => {
        task.status = 'failed'
        task.error = error
        task.endTime = new Date()
        console.error(`Background task ${taskName} failed:`, error)
      })
    
    return taskId
  }
  
  // 작업 상태 업데이트
  const updateTaskProgress = (taskId, current, total) => {
    const task = backgroundTasks.get(taskId)
    if (task) {
      task.current = current
      task.total = total
      task.progress = total > 0 ? Math.round((current / total) * 100) : 0
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
    getAllTasks,
    getRunningTasks,
    getTask
  }
}
