<template>
  <div class="pipeline-status-monitor">
    <div class="monitor-header">
      <h3>🔄 파이프라인 상태 모니터링</h3>
      <div class="header-actions">
        <button @click="refreshPipelineStatus" class="btn-refresh" :disabled="loading">
          <span v-if="loading">🔄 새로고침 중...</span>
          <span v-else>🔄 새로고침</span>
        </button>
        <button @click="toggleAutoRefresh" :class="['btn-auto', { active: autoRefresh }]">
          {{ autoRefresh ? '⏸️ 자동 새로고침 중지' : '▶️ 자동 새로고침 시작' }}
        </button>
      </div>
    </div>

    <!-- 파이프라인 단계별 진행 상황 -->
    <div class="pipeline-steps">
      <h4>📋 파이프라인 단계</h4>
      <div class="steps-container">
        <div v-for="(step, index) in pipelineSteps" :key="step.name" 
             :class="['step', step.status, { 'current-step': step.isCurrent }]">
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-icon">{{ step.icon }}</div>
          <div class="step-info">
            <h5>{{ step.name }}</h5>
            <p>{{ step.description }}</p>
            <div class="step-progress" v-if="step.progress > 0">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: step.progress + '%' }"></div>
              </div>
              <span class="progress-text">{{ step.progress }}%</span>
            </div>
            <div class="step-details" v-if="step.details">
              <span class="detail-item">{{ step.details }}</span>
            </div>
          </div>
          <div class="step-status">
            <span :class="['status-badge', step.status]">{{ step.statusText }}</span>
            <div class="step-time" v-if="step.duration">
              <span>{{ step.duration }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 워커별 상세 정보 -->
    <div class="worker-details">
      <h4>🤖 워커 상태</h4>
      <div class="workers-grid">
        <div v-for="worker in workers" :key="worker.name" class="worker-card">
          <div class="worker-header">
            <div class="worker-icon">{{ worker.icon }}</div>
            <div class="worker-info">
              <h5>{{ worker.name }}</h5>
              <p>{{ worker.description }}</p>
            </div>
            <div class="worker-status">
              <span :class="['status-badge', worker.status]">{{ worker.status }}</span>
            </div>
          </div>
          
          <div class="worker-metrics">
            <div class="metric-row">
              <span class="metric-label">처리 중:</span>
              <span class="metric-value">{{ worker.processing }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">대기 중:</span>
              <span class="metric-value">{{ worker.queued }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">완료:</span>
              <span class="metric-value">{{ worker.completed }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">성공률:</span>
              <span class="metric-value">{{ worker.successRate }}%</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">평균 처리시간:</span>
              <span class="metric-value">{{ worker.avgProcessingTime }}ms</span>
            </div>
          </div>
          
          <div class="worker-actions">
            <button @click="restartWorker(worker.name)" class="btn-restart" :disabled="worker.status === '처리중'">
              🔄 재시작
            </button>
            <button @click="viewWorkerLogs(worker.name)" class="btn-logs">
              📋 로그 보기
            </button>
            <button @click="viewWorkerMetrics(worker.name)" class="btn-metrics">
              📊 상세 메트릭
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 큐 상태 -->
    <div class="queue-status">
      <h4>📦 작업 큐 상태</h4>
      <div class="queue-overview">
        <div class="queue-card">
          <div class="queue-header">
            <h5>전체 큐</h5>
            <span class="queue-count">{{ queueStats?.total || 0 }}</span>
          </div>
          <div class="queue-breakdown">
            <div class="queue-item">
              <span class="queue-label">대기 중:</span>
              <span class="queue-value">{{ queueStats?.pending || 0 }}</span>
            </div>
            <div class="queue-item">
              <span class="queue-label">처리 중:</span>
              <span class="queue-value">{{ queueStats?.processing || 0 }}</span>
            </div>
            <div class="queue-item">
              <span class="queue-label">완료:</span>
              <span class="queue-value">{{ queueStats?.completed || 0 }}</span>
            </div>
            <div class="queue-item">
              <span class="queue-label">실패:</span>
              <span class="queue-value">{{ queueStats?.failed || 0 }}</span>
            </div>
          </div>
        </div>
        
        <div class="queue-card">
          <div class="queue-header">
            <h5>우선순위별</h5>
          </div>
          <div class="priority-breakdown">
            <div class="priority-item high">
              <span class="priority-label">HIGH:</span>
              <span class="priority-value">{{ queueStats?.high || 0 }}</span>
            </div>
            <div class="priority-item medium">
              <span class="priority-label">MEDIUM:</span>
              <span class="priority-value">{{ queueStats?.medium || 0 }}</span>
            </div>
            <div class="priority-item low">
              <span class="priority-label">LOW:</span>
              <span class="priority-value">{{ queueStats?.low || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 최근 활동 로그 -->
    <div class="activity-log">
      <h4>📋 최근 활동 로그</h4>
      <div class="log-container">
        <div v-for="log in recentLogs" :key="log.id" :class="['log-entry', log.level]">
          <div class="log-timestamp">{{ formatTime(log.timestamp) }}</div>
          <div class="log-level">{{ log.level.toUpperCase() }}</div>
          <div class="log-message">{{ log.message }}</div>
          <div class="log-worker" v-if="log.worker">{{ log.worker }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSupabase } from '../composables/useSupabase'

const { supabase } = useSupabase()

// 반응형 데이터
const loading = ref(false)
const autoRefresh = ref(false)
let refreshInterval = null

const pipelineSteps = ref([
  {
    name: '렌더링',
    description: 'LDraw 모델을 Blender로 렌더링',
    icon: '🎨',
    status: 'completed',
    statusText: '완료',
    progress: 100,
    isCurrent: false,
    duration: '2.3초',
    details: '6335317_041 부품 완료'
  },
  {
    name: '임베딩 생성',
    description: 'CLIP/FGC 임베딩 생성',
    icon: '🧠',
    status: 'processing',
    statusText: '처리 중',
    progress: 65,
    isCurrent: true,
    duration: '1.2초',
    details: 'CLIP 임베딩 생성 중'
  },
  {
    name: 'Fusion 식별',
    description: 'AI 기반 부품 식별',
    icon: '🔍',
    status: 'pending',
    statusText: '대기 중',
    progress: 0,
    isCurrent: false,
    duration: null,
    details: null
  },
  {
    name: 'QA 검증',
    description: '품질 검증 및 검증',
    icon: '📊',
    status: 'pending',
    statusText: '대기 중',
    progress: 0,
    isCurrent: false,
    duration: null,
    details: null
  }
])

const workers = ref([
  {
    name: 'render_worker',
    description: 'Blender 렌더링 워커',
    icon: '🎨',
    status: '정상',
    processing: 1,
    queued: 0,
    completed: 45,
    successRate: 98.5,
    avgProcessingTime: 2300
  },
  {
    name: 'embedding_worker',
    description: 'CLIP/FGC 임베딩 생성',
    icon: '🧠',
    status: '처리중',
    processing: 1,
    queued: 2,
    completed: 38,
    successRate: 96.2,
    avgProcessingTime: 1200
  },
  {
    name: 'fusion_worker',
    description: 'AI 식별 워커',
    icon: '🔍',
    status: '대기중',
    processing: 0,
    queued: 3,
    completed: 42,
    successRate: 94.8,
    avgProcessingTime: 850
  },
  {
    name: 'qa_worker',
    description: '품질 검증 워커',
    icon: '📊',
    status: '정상',
    processing: 0,
    queued: 1,
    completed: 40,
    successRate: 97.1,
    avgProcessingTime: 650
  }
])

const queueStats = ref({
  total: 7,
  pending: 3,
  processing: 1,
  completed: 165,
  failed: 2,
  high: 1,
  medium: 4,
  low: 2
})

const recentLogs = ref([
  {
    id: 1,
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    level: 'info',
    message: 'embedding_worker: CLIP 임베딩 생성 시작',
    worker: 'embedding_worker'
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    level: 'success',
    message: 'render_worker: 6335317_041 렌더링 완료',
    worker: 'render_worker'
  },
  {
    id: 3,
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    level: 'warning',
    message: 'qa_worker: 품질 지표 임계값 근접',
    worker: 'qa_worker'
  },
  {
    id: 4,
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    level: 'error',
    message: 'fusion_worker: 모델 로딩 실패',
    worker: 'fusion_worker'
  }
])

// 메서드
const refreshPipelineStatus = async () => {
  loading.value = true
  try {
    // 실제 API 호출로 파이프라인 상태 조회
    await Promise.all([
      fetchPipelineSteps(),
      fetchWorkerStatus(),
      fetchQueueStats(),
      fetchRecentLogs()
    ])
  } catch (error) {
    console.error('파이프라인 상태 조회 실패:', error)
  } finally {
    loading.value = false
  }
}

const fetchPipelineSteps = async () => {
  try {
    // operation_logs에서 최근 파이프라인 단계별 상태 조회
    const { data, error } = await supabase
      .from('operation_logs')
      .select('operation, status, duration_ms, timestamp')
      .in('operation', ['render_image', 'generate_embedding', 'fusion_identification', 'qa_verification'])
      .order('timestamp', { ascending: false })
      .limit(20)
    
    if (error) throw error
    
    // 각 단계별 최신 상태 업데이트
    const stepMap = {
      'render_image': 0,
      'generate_embedding': 1,
      'fusion_identification': 2,
      'qa_verification': 3
    }
    
    pipelineSteps.value.forEach((step, index) => {
      const stepLogs = data.filter(log => stepMap[log.operation] === index)
      if (stepLogs.length > 0) {
        const latestLog = stepLogs[0]
        step.status = latestLog.status === 'success' ? 'completed' : 'error'
        step.statusText = latestLog.status === 'success' ? '완료' : '오류'
        step.duration = latestLog.duration_ms ? `${(latestLog.duration_ms / 1000).toFixed(1)}초` : null
        step.progress = latestLog.status === 'success' ? 100 : 0
      }
    })
  } catch (error) {
    console.error('파이프라인 단계 조회 실패:', error)
  }
}

const fetchWorkerStatus = async () => {
  try {
    // operation_logs에서 워커별 상태 조회
    const { data, error } = await supabase
      .from('operation_logs')
      .select('worker, status, duration_ms, timestamp')
      .in('worker', ['render_worker', 'embedding_worker', 'fusion_worker', 'qa_worker'])
      .order('timestamp', { ascending: false })
      .limit(20)
    
    if (error) throw error
    
    // 워커별 상태 업데이트
    workers.value.forEach(worker => {
      const workerLogs = data.filter(log => log.worker === worker.name)
      if (workerLogs.length > 0) {
        const latestLog = workerLogs[0]
        worker.status = latestLog.status === 'success' ? '정상' : '오류'
        worker.completed = workerLogs.filter(log => log.status === 'success').length
        worker.successRate = workerLogs.length > 0 ? 
          (workerLogs.filter(log => log.status === 'success').length / workerLogs.length) * 100 : 0
        worker.avgProcessingTime = workerLogs.length > 0 ? 
          Math.round(workerLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / workerLogs.length) : 0
      }
    })
  } catch (error) {
    console.error('워커 상태 조회 실패:', error)
  }
}

const fetchQueueStats = async () => {
  try {
    // operation_logs에서 큐 상태 조회
    const { data, error } = await supabase
      .from('operation_logs')
      .select('operation, status, timestamp')
      .order('timestamp', { ascending: false })
      .limit(100)
    
    if (error) throw error
    
    // 큐 통계 계산
    const total = data.length
    const pending = data.filter(log => log.status === 'pending').length
    const processing = data.filter(log => log.status === 'processing').length
    const completed = data.filter(log => log.status === 'success').length
    const failed = data.filter(log => log.status === 'error').length
    
    queueStats.value = {
      total,
      pending,
      processing,
      completed,
      failed,
      high: Math.floor(pending * 0.3),
      medium: Math.floor(pending * 0.5),
      low: Math.floor(pending * 0.2)
    }
  } catch (error) {
    console.error('큐 통계 조회 실패:', error)
    // 오류 발생 시 기본값 설정
    queueStats.value = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      high: 0,
      medium: 0,
      low: 0
    }
  }
}

const fetchRecentLogs = async () => {
  try {
    // operation_logs에서 최근 로그 조회
    const { data, error } = await supabase
      .from('operation_logs')
      .select('id, operation, status, message, worker, timestamp')
      .order('timestamp', { ascending: false })
      .limit(10)
    
    if (error) throw error
    
    // 로그 데이터 변환
    recentLogs.value = data.map(log => ({
      id: log.id,
      timestamp: new Date(log.timestamp),
      level: log.status === 'error' ? 'error' : log.status === 'success' ? 'info' : 'warning',
      message: log.message || `${log.operation}: ${log.status}`,
      worker: log.worker || 'system'
    }))
  } catch (error) {
    console.error('최근 로그 조회 실패:', error)
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  
  if (autoRefresh.value) {
    refreshInterval = setInterval(refreshPipelineStatus, 10000) // 10초마다
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
}

const restartWorker = (workerName) => {
  console.log(`워커 재시작: ${workerName}`)
  // 실제 구현에서는 워커 재시작 API 호출
}

const viewWorkerLogs = (workerName) => {
  console.log(`워커 로그 보기: ${workerName}`)
  // 실제 구현에서는 워커 로그 페이지로 이동
}

const viewWorkerMetrics = (workerName) => {
  console.log(`워커 메트릭 보기: ${workerName}`)
  // 실제 구현에서는 워커 상세 메트릭 페이지로 이동
}

const formatTime = (timestamp) => {
  const now = new Date()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

// 컴포넌트 마운트 시 초기 데이터 로드
onMounted(() => {
  refreshPipelineStatus()
})

// 컴포넌트 언마운트 시 정리
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.pipeline-status-monitor {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f0f0f0;
}

.monitor-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-refresh, .btn-auto {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-refresh {
  background: #3498db;
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background: #2980b9;
}

.btn-refresh:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-auto {
  background: #ecf0f1;
  color: #2c3e50;
  border: 1px solid #bdc3c7;
}

.btn-auto:hover {
  background: #d5dbdb;
}

.btn-auto.active {
  background: #27ae60;
  color: white;
  border-color: #27ae60;
}

.pipeline-steps {
  margin-bottom: 30px;
}

.pipeline-steps h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.step {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 12px;
  border: 2px solid #ecf0f1;
  transition: all 0.3s ease;
}

.step.completed {
  background: #d5f4e6;
  border-color: #27ae60;
}

.step.processing {
  background: #e3f2fd;
  border-color: #3498db;
  box-shadow: 0 0 10px rgba(52, 152, 219, 0.3);
}

.step.pending {
  background: #f8f9fa;
  border-color: #bdc3c7;
}

.step.current-step {
  border-color: #f39c12;
  box-shadow: 0 0 10px rgba(243, 156, 18, 0.3);
}

.step-number {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #2c3e50;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
}

.step-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.step-info {
  flex: 1;
}

.step-info h5 {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.step-info p {
  margin: 0 0 10px 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.step-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.8rem;
  font-weight: 500;
  color: #2c3e50;
}

.step-details {
  font-size: 0.8rem;
  color: #7f8c8d;
}

.step-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge.completed {
  background: #d5f4e6;
  color: #27ae60;
}

.status-badge.processing {
  background: #e3f2fd;
  color: #3498db;
}

.status-badge.pending {
  background: #f8f9fa;
  color: #7f8c8d;
}

.step-time {
  font-size: 0.7rem;
  color: #7f8c8d;
}

.worker-details {
  margin-bottom: 30px;
}

.worker-details h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.workers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.worker-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.worker-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.worker-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.worker-info {
  flex: 1;
}

.worker-info h5 {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 1rem;
}

.worker-info p {
  margin: 0;
  color: #7f8c8d;
  font-size: 0.8rem;
}

.worker-status .status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
}

.worker-status .status-badge.정상 {
  background: #d5f4e6;
  color: #27ae60;
}

.worker-status .status-badge.처리중 {
  background: #e3f2fd;
  color: #3498db;
}

.worker-status .status-badge.대기중 {
  background: #f8f9fa;
  color: #7f8c8d;
}

.worker-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.metric-label {
  color: #7f8c8d;
}

.metric-value {
  font-weight: 500;
  color: #2c3e50;
}

.worker-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-restart, .btn-logs, .btn-metrics {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.btn-restart {
  background: #e74c3c;
  color: white;
}

.btn-restart:hover:not(:disabled) {
  background: #c0392b;
}

.btn-restart:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-logs {
  background: #3498db;
  color: white;
}

.btn-logs:hover {
  background: #2980b9;
}

.btn-metrics {
  background: #27ae60;
  color: white;
}

.btn-metrics:hover {
  background: #229954;
}

.queue-status {
  margin-bottom: 30px;
}

.queue-status h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.queue-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.queue-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.queue-header h5 {
  margin: 0;
  color: #2c3e50;
  font-size: 1rem;
}

.queue-count {
  font-size: 1.5rem;
  font-weight: bold;
  color: #3498db;
}

.queue-breakdown, .priority-breakdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-item, .priority-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.queue-label, .priority-label {
  color: #7f8c8d;
}

.queue-value, .priority-value {
  font-weight: 500;
  color: #2c3e50;
}

.priority-item.high .priority-value {
  color: #e74c3c;
}

.priority-item.medium .priority-value {
  color: #f39c12;
}

.priority-item.low .priority-value {
  color: #27ae60;
}

.activity-log {
  margin-bottom: 20px;
}

.activity-log h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f8f9fa;
}

.log-entry {
  display: grid;
  grid-template-columns: 80px 60px 1fr 100px;
  gap: 15px;
  padding: 10px 15px;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.8rem;
  align-items: center;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.info {
  background: #e3f2fd;
}

.log-entry.success {
  background: #d5f4e6;
}

.log-entry.warning {
  background: #fef9e7;
}

.log-entry.error {
  background: #fadbd8;
}

.log-timestamp {
  color: #7f8c8d;
  font-size: 0.7rem;
}

.log-level {
  font-weight: bold;
  text-align: center;
}

.log-level.info {
  color: #3498db;
}

.log-level.success {
  color: #27ae60;
}

.log-level.warning {
  color: #f39c12;
}

.log-level.error {
  color: #e74c3c;
}

.log-message {
  color: #2c3e50;
}

.log-worker {
  color: #7f8c8d;
  font-size: 0.7rem;
  text-align: right;
}

@media (max-width: 768px) {
  .monitor-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .workers-grid {
    grid-template-columns: 1fr;
  }
  
  .queue-overview {
    grid-template-columns: 1fr;
  }
  
  .log-entry {
    grid-template-columns: 1fr;
    gap: 5px;
  }
}
</style>
