<template>
  <div v-if="isVisible" class="training-monitor-modal">
    <div class="modal-overlay" @click="closeModal"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>🧠 AI 학습 모니터링</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <!-- 학습 상태 -->
        <div class="status-section">
          <div class="status-header">
            <span class="status-label">학습 상태:</span>
            <span :class="['status-badge', statusClass]">{{ statusText }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div class="progress-text">{{ progressText }}</div>
        </div>

        <!-- 학습 정보 -->
        <div class="info-section">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">부품 ID:</span>
              <span class="info-value">{{ trainingInfo.partId || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">모델 단계:</span>
              <span class="info-value">{{ trainingInfo.stage || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">에폭:</span>
              <span class="info-value">{{ trainingInfo.currentEpoch || 0 }} / {{ trainingInfo.totalEpochs || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">배치 크기:</span>
              <span class="info-value">{{ trainingInfo.batchSize || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">이미지 크기:</span>
              <span class="info-value">{{ trainingInfo.imageSize || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">디바이스:</span>
              <span class="info-value">{{ trainingInfo.device || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 실시간 메트릭 -->
        <div class="metrics-section">
          <h4>📊 실시간 메트릭</h4>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Box Loss:</span>
              <span class="metric-value">{{ metrics.boxLoss || '-' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Seg Loss:</span>
              <span class="metric-value">{{ metrics.segLoss || '-' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Cls Loss:</span>
              <span class="metric-value">{{ metrics.clsLoss || '-' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">DFL Loss:</span>
              <span class="metric-value">{{ metrics.dflLoss || '-' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">mAP50:</span>
              <span class="metric-value">{{ metrics.map50 || '-' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">mAP50-95:</span>
              <span class="metric-value">{{ metrics.map50_95 || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 로그 출력 -->
        <div class="logs-section">
          <h4>📝 학습 로그</h4>
          <div class="logs-container" ref="logsContainer">
            <div 
              v-for="(log, index) in logs" 
              :key="index" 
              :class="['log-entry', log.level]"
            >
              <span class="log-time">{{ log.timestamp }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>

        <!-- 제어 버튼 -->
        <div class="controls-section">
          <button @click="pauseTraining" :disabled="!canPause" class="btn-pause">
            ⏸️ 일시정지
          </button>
          <button @click="resumeTraining" :disabled="!canResume" class="btn-resume">
            ▶️ 재개
          </button>
          <button @click="stopTraining" :disabled="!canStop" class="btn-stop">
            ⏹️ 중지
          </button>
          <button @click="refreshStatus" class="btn-refresh">
            🔄 새로고침
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { createClient } from '@supabase/supabase-js'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  trainingJobId: {
    type: String,
    default: null
  }
})

// Emits
const emit = defineEmits(['close', 'pause', 'resume', 'stop'])

// Supabase 클라이언트
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJphdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'
)

// 반응형 데이터
const isVisible = ref(false)
const trainingInfo = ref({})
const metrics = ref({})
const logs = ref([])
const logsContainer = ref(null)

// 폴링 관련
let statusPolling = null
let metricsPolling = null

// 계산된 속성
const statusClass = computed(() => {
  const status = trainingInfo.value.status
  if (status === 'training') return 'status-training'
  if (status === 'paused') return 'status-paused'
  if (status === 'completed') return 'status-completed'
  if (status === 'failed') return 'status-failed'
  return 'status-pending'
})

const statusText = computed(() => {
  const status = trainingInfo.value.status
  const statusMap = {
    'pending': '대기 중',
    'training': '학습 중',
    'paused': '일시정지',
    'completed': '완료',
    'failed': '실패'
  }
  return statusMap[status] || '알 수 없음'
})

const progressPercent = computed(() => {
  const current = trainingInfo.value.currentEpoch || 0
  const total = trainingInfo.value.totalEpochs || 1
  return Math.round((current / total) * 100)
})

const progressText = computed(() => {
  const current = trainingInfo.value.currentEpoch || 0
  const total = trainingInfo.value.totalEpochs || 0
  return `${current}/${total} 에폭 (${progressPercent.value}%)`
})

const canPause = computed(() => trainingInfo.value.status === 'training')
const canResume = computed(() => trainingInfo.value.status === 'paused')
const canStop = computed(() => ['training', 'paused'].includes(trainingInfo.value.status))

// 메서드
const closeModal = () => {
  isVisible.value = false
  stopPolling()
  emit('close')
}

const pauseTraining = () => {
  emit('pause')
}

const resumeTraining = () => {
  emit('resume')
}

const stopTraining = () => {
  emit('stop')
}

const refreshStatus = async () => {
  await fetchTrainingStatus()
  await fetchMetrics()
}

const fetchTrainingStatus = async () => {
  try {
    if (!props.trainingJobId) return

    const { data, error } = await supabase
      .from('training_jobs')
      .select('*')
      .eq('id', props.trainingJobId)
      .single()

    if (error) throw error

    trainingInfo.value = {
      partId: data.config?.partId || data.config?.part_id,
      stage: data.config?.model_stage || 'stage1',
      currentEpoch: data.progress?.current_epoch || 0,
      totalEpochs: data.config?.epochs || 100,
      batchSize: data.config?.batch_size || 16,
      imageSize: data.config?.imgsz || 640,
      device: data.config?.device || 'cuda',
      status: data.status || 'pending'
    }

    // 로그 추가
    addLog('info', `학습 상태 업데이트: ${statusText.value}`)
  } catch (error) {
    console.error('학습 상태 조회 실패:', error)
    addLog('error', `상태 조회 실패: ${error.message}`)
  }
}

const fetchMetrics = async () => {
  try {
    if (!props.trainingJobId) return

    const { data, error } = await supabase
      .from('training_metrics')
      .select('*')
      .eq('job_id', props.trainingJobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (data) {
      metrics.value = {
        boxLoss: data.box_loss?.toFixed(4),
        segLoss: data.seg_loss?.toFixed(4),
        clsLoss: data.cls_loss?.toFixed(4),
        dflLoss: data.dfl_loss?.toFixed(4),
        map50: data.map50?.toFixed(4),
        map50_95: data.map50_95?.toFixed(4)
      }
    }
  } catch (error) {
    console.error('메트릭 조회 실패:', error)
  }
}

const addLog = (level, message) => {
  const timestamp = new Date().toLocaleTimeString()
  logs.value.unshift({
    timestamp,
    level,
    message
  })

  // 로그가 너무 많으면 오래된 것 제거
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100)
  }

  // 자동 스크롤
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = 0
    }
  })
}

const startPolling = () => {
  // 상태 폴링 (5초마다)
  statusPolling = setInterval(async () => {
    await fetchTrainingStatus()
  }, 5000)

  // 메트릭 폴링 (10초마다)
  metricsPolling = setInterval(async () => {
    await fetchMetrics()
  }, 10000)
}

const stopPolling = () => {
  if (statusPolling) {
    clearInterval(statusPolling)
    statusPolling = null
  }
  if (metricsPolling) {
    clearInterval(metricsPolling)
    metricsPolling = null
  }
}

// 라이프사이클
onMounted(() => {
  isVisible.value = props.visible
  if (isVisible.value) {
    startPolling()
    refreshStatus()
  }
})

onUnmounted(() => {
  stopPolling()
})

// Props 변경 감지
watch(() => props.visible, (newVisible) => {
  isVisible.value = newVisible
  if (newVisible) {
    startPolling()
    refreshStatus()
  } else {
    stopPolling()
  }
})

watch(() => props.trainingJobId, (newJobId) => {
  if (newJobId && isVisible.value) {
    refreshStatus()
  }
})
</script>

<style scoped>
.training-monitor-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 1000px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.status-section {
  margin-bottom: 24px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.status-label {
  font-weight: 500;
  color: #374151;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-training {
  background: #dbeafe;
  color: #1e40af;
}

.status-paused {
  background: #fef3c7;
  color: #d97706;
}

.status-completed {
  background: #d1fae5;
  color: #059669;
}

.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.status-pending {
  background: #f3f4f6;
  color: #6b7280;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
}

.info-section {
  margin-bottom: 24px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.info-label {
  font-weight: 500;
  color: #6b7280;
}

.info-value {
  color: #111827;
  font-weight: 600;
}

.metrics-section {
  margin-bottom: 24px;
}

.metrics-section h4 {
  margin: 0 0 16px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f0f9ff;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
}

.metric-label {
  font-weight: 500;
  color: #1e40af;
}

.metric-value {
  color: #111827;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.logs-section {
  margin-bottom: 24px;
}

.logs-section h4 {
  margin: 0 0 16px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}

.logs-container {
  height: 200px;
  overflow-y: auto;
  background: #1f2937;
  border-radius: 6px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.log-entry {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
  padding: 2px 0;
}

.log-time {
  color: #9ca3af;
  flex-shrink: 0;
}

.log-message {
  color: #f9fafb;
}

.log-entry.info .log-message {
  color: #60a5fa;
}

.log-entry.warning .log-message {
  color: #fbbf24;
}

.log-entry.error .log-message {
  color: #f87171;
}

.controls-section {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.controls-section button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-pause {
  background: #fbbf24;
  color: white;
}

.btn-pause:hover:not(:disabled) {
  background: #f59e0b;
}

.btn-resume {
  background: #10b981;
  color: white;
}

.btn-resume:hover:not(:disabled) {
  background: #059669;
}

.btn-stop {
  background: #ef4444;
  color: white;
}

.btn-stop:hover:not(:disabled) {
  background: #dc2626;
}

.btn-refresh {
  background: #3b82f6;
  color: white;
}

.btn-refresh:hover {
  background: #2563eb;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 반응형 */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 95vh;
  }
  
  .info-grid,
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .controls-section {
    flex-wrap: wrap;
  }
}
</style>
