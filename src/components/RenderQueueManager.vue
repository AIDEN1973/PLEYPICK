<template>
  <div class="render-queue-manager">
    <div class="queue-header">
      <h3>🔄 Render Queue 관리</h3>
      <div class="queue-controls">
        <button @click="refreshQueueStatus" :disabled="isLoading" class="btn-refresh">
          <span class="refresh-icon">🔄</span>
          새로고침
        </button>
        <button @click="processFailedQueue" :disabled="isProcessing || isLoading" class="btn-process">
          <span class="process-icon">⚡</span>
          실패한 작업 재처리
        </button>
      </div>
    </div>

    <!-- 큐 상태 대시보드 -->
    <div class="queue-dashboard">
      <div class="stats-grid">
        <div class="stat-card pending" :class="{ active: queueStats.pending > 0 }">
          <div class="stat-icon">⏳</div>
          <div class="stat-content">
            <div class="stat-label">대기 중</div>
            <div class="stat-value">{{ queueStats.pending }}</div>
          </div>
        </div>
        <div class="stat-card processing" :class="{ active: queueStats.processing > 0 }">
          <div class="stat-icon">🔄</div>
          <div class="stat-content">
            <div class="stat-label">처리 중</div>
            <div class="stat-value">{{ queueStats.processing }}</div>
          </div>
        </div>
        <div class="stat-card completed" :class="{ active: queueStats.completed > 0 }">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-label">완료</div>
            <div class="stat-value">{{ queueStats.completed }}</div>
          </div>
        </div>
        <div class="stat-card failed" :class="{ active: queueStats.failed > 0 }">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <div class="stat-label">실패</div>
            <div class="stat-value">{{ queueStats.failed }}</div>
          </div>
        </div>
      </div>
      
      <div class="queue-summary">
        <span class="total-tasks">총 작업: {{ queueStats.total }}</span>
        <span class="last-updated" v-if="lastUpdated">
          마지막 업데이트: {{ formatTime(lastUpdated) }}
        </span>
      </div>
    </div>

    <!-- 작업 목록 -->
    <div class="queue-tasks">
      <div class="tasks-header">
        <h4>📋 작업 목록</h4>
        <div class="task-filters">
          <select v-model="selectedStatus" @change="loadTasks">
            <option value="all">모든 상태</option>
            <option value="pending">대기 중</option>
            <option value="processing">처리 중</option>
            <option value="completed">완료</option>
            <option value="failed">실패</option>
          </select>
          <button @click="loadTasks" :disabled="isLoading" class="btn-load">
            로드
          </button>
        </div>
      </div>

      <div class="tasks-list" v-if="tasks.length > 0">
        <div 
          v-for="task in tasks" 
          :key="task.id"
          class="task-item"
          :class="task.status"
        >
          <div class="task-info">
            <div class="task-id">ID: {{ task.id }}</div>
            <div class="task-part">부품: {{ task.part_id }}</div>
            <div class="task-reason">사유: {{ task.reason }}</div>
            <div class="task-created">
              생성: {{ formatTime(task.created_at) }}
            </div>
            <div class="task-worker" v-if="task.worker_id">
              워커: {{ task.worker_id }}
            </div>
          </div>
          <div class="task-status">
            <span class="status-badge" :class="task.status">
              {{ getStatusText(task.status) }}
            </span>
          </div>
        </div>
      </div>

      <div v-else class="no-tasks">
        <div class="no-tasks-icon">📭</div>
        <div class="no-tasks-text">
          {{ selectedStatus === 'all' ? '작업이 없습니다' : `${getStatusText(selectedStatus)} 작업이 없습니다` }}
        </div>
      </div>
    </div>

    <!-- 처리 로그 -->
    <div class="processing-logs" v-if="processingLogs.length > 0">
      <h4>📝 처리 로그</h4>
      <div class="logs-container">
        <div 
          v-for="(log, index) in processingLogs" 
          :key="index"
          class="log-entry"
          :class="log.type"
        >
          <span class="log-time">{{ log.timestamp }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// 반응형 데이터
const isLoading = ref(false)
const isProcessing = ref(false)
const queueStats = ref({
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  total: 0
})
const tasks = ref([])
const selectedStatus = ref('pending')
const lastUpdated = ref(null)
const processingLogs = ref([])

// 폴링 관련
let statusPolling = null

// API 호출 함수들
const fetchQueueStatus = async () => {
  try {
    const response = await fetch('/api/synthetic/queue/status')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    if (data.success) {
      queueStats.value = data.stats
      lastUpdated.value = data.lastUpdated
    }
  } catch (error) {
    console.error('큐 상태 조회 실패:', error)
    addLog('error', `큐 상태 조회 실패: ${error.message}`)
  }
}

const loadTasks = async () => {
  try {
    isLoading.value = true
    const response = await fetch(`/api/synthetic/queue/tasks?status=${selectedStatus.value}&limit=50`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    if (data.success) {
      tasks.value = data.tasks
    }
  } catch (error) {
    console.error('작업 목록 조회 실패:', error)
    addLog('error', `작업 목록 조회 실패: ${error.message}`)
  } finally {
    isLoading.value = false
  }
}

const processFailedQueue = async () => {
  try {
    isProcessing.value = true
    addLog('info', '실패한 작업 재처리 시작...')
    
    const response = await fetch('/api/synthetic/queue/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    if (data.success) {
      addLog('success', '실패한 작업 재처리 완료')
      addLog('info', data.output)
      // 상태 새로고침
      await refreshQueueStatus()
      await loadTasks()
    } else {
      addLog('error', `재처리 실패: ${data.message}`)
      if (data.error) {
        addLog('error', data.error)
      }
    }
  } catch (error) {
    console.error('재처리 실행 실패:', error)
    addLog('error', `재처리 실행 실패: ${error.message}`)
  } finally {
    isProcessing.value = false
  }
}

const refreshQueueStatus = async () => {
  await fetchQueueStatus()
  await loadTasks()
}

// 유틸리티 함수들
const getStatusText = (status) => {
  const statusMap = {
    pending: '대기 중',
    processing: '처리 중',
    completed: '완료',
    failed: '실패'
  }
  return statusMap[status] || status
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('ko-KR')
}

const addLog = (type, message) => {
  const timestamp = new Date().toLocaleTimeString()
  processingLogs.value.unshift({
    timestamp,
    type,
    message
  })
  
  // 로그가 너무 많으면 오래된 것 제거
  if (processingLogs.value.length > 50) {
    processingLogs.value = processingLogs.value.slice(0, 50)
  }
}

// 폴링 시작/중지
const startPolling = () => {
  statusPolling = setInterval(async () => {
    await fetchQueueStatus()
  }, 5000) // 5초마다 상태 업데이트
}

const stopPolling = () => {
  if (statusPolling) {
    clearInterval(statusPolling)
    statusPolling = null
  }
}

// 라이프사이클
onMounted(async () => {
  addLog('info', 'Render Queue 관리자 초기화')
  await refreshQueueStatus()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.render-queue-manager {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.queue-header h3 {
  margin: 0;
  color: #333;
}

.queue-controls {
  display: flex;
  gap: 10px;
}

.btn-refresh, .btn-process, .btn-load {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}

.btn-refresh {
  background: #6c757d;
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background: #5a6268;
}

.btn-process {
  background: #28a745;
  color: white;
}

.btn-process:hover:not(:disabled) {
  background: #218838;
}

.btn-load {
  background: #007bff;
  color: white;
}

.btn-load:hover:not(:disabled) {
  background: #0056b3;
}

.btn-refresh:disabled, .btn-process:disabled, .btn-load:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.queue-dashboard {
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s;
}

.stat-card.active {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.stat-card.pending.active {
  border-left: 4px solid #ffc107;
}

.stat-card.processing.active {
  border-left: 4px solid #17a2b8;
}

.stat-card.completed.active {
  border-left: 4px solid #28a745;
}

.stat-card.failed.active {
  border-left: 4px solid #dc3545;
}

.stat-icon {
  font-size: 24px;
  margin-right: 15px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.queue-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: white;
  border-radius: 4px;
  font-size: 14px;
  color: #666;
}

.queue-tasks {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.tasks-header h4 {
  margin: 0;
  color: #333;
}

.task-filters {
  display: flex;
  gap: 10px;
  align-items: center;
}

.task-filters select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.tasks-list {
  max-height: 400px;
  overflow-y: auto;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin-bottom: 10px;
  background: #f8f9fa;
  transition: all 0.2s;
}

.task-item:hover {
  background: #e9ecef;
}

.task-item.pending {
  border-left: 4px solid #ffc107;
}

.task-item.processing {
  border-left: 4px solid #17a2b8;
}

.task-item.completed {
  border-left: 4px solid #28a745;
}

.task-item.failed {
  border-left: 4px solid #dc3545;
}

.task-info {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  font-size: 14px;
}

.task-id, .task-part, .task-reason, .task-created, .task-worker {
  color: #666;
}

.task-part {
  font-weight: bold;
  color: #333;
}

.task-status {
  margin-left: 15px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.processing {
  background: #d1ecf1;
  color: #0c5460;
}

.status-badge.completed {
  background: #d4edda;
  color: #155724;
}

.status-badge.failed {
  background: #f8d7da;
  color: #721c24;
}

.no-tasks {
  text-align: center;
  padding: 40px;
  color: #666;
}

.no-tasks-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.processing-logs {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.processing-logs h4 {
  margin: 0 0 15px 0;
  color: #333;
}

.logs-container {
  max-height: 200px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 4px;
  padding: 10px;
}

.log-entry {
  display: flex;
  gap: 10px;
  padding: 5px 0;
  font-size: 13px;
  border-bottom: 1px solid #e9ecef;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #666;
  font-family: monospace;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-entry.info .log-message {
  color: #333;
}

.log-entry.success .log-message {
  color: #28a745;
}

.log-entry.error .log-message {
  color: #dc3545;
}

.refresh-icon, .process-icon {
  animation: none;
}

.btn-refresh:disabled .refresh-icon {
  animation: spin 1s linear infinite;
}

.btn-process:disabled .process-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
