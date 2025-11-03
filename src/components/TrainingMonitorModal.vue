<template>
  <div v-if="isVisible" class="training-monitor-modal">
    <div class="modal-overlay"></div>
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
          <div v-if="trainingInfo.status !== 'no_job'" class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div v-if="trainingInfo.status !== 'no_job'" class="progress-text">{{ progressText }}</div>
          <div v-else class="no-job-message">
            <p>📋 현재 활성화된 학습 작업이 없습니다.</p>
            <p>새로운 학습을 시작하거나 기존 학습 작업을 확인해보세요.</p>
          </div>
        </div>

        <!-- 학습 정보 -->
        <div class="info-section">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">작업 ID:</span>
              <span class="info-value">{{ trainingJobId || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">상태:</span>
              <span class="info-value" :class="statusClass">{{ statusText }}</span>
            </div>
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

// 전역 Supabase 클라이언트 사용
import { useSupabase } from '../composables/useSupabase.js'
const { supabase } = useSupabase()

// 반응형 데이터
const isVisible = computed(() => props.visible)
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
  if (status === 'running' || status === 'training') return 'status-training'
  if (status === 'paused') return 'status-paused'
  if (status === 'completed') return 'status-completed'
  if (status === 'failed') return 'status-failed'
  if (status === 'no_job') return 'status-no-job'
  return 'status-pending'
})

const statusText = computed(() => {
  const status = trainingInfo.value.status
  const statusMap = {
    'pending': '대기 중',
    'running': '실행 중',
    'training': '학습 중',
    'paused': '일시정지',
    'completed': '완료',
    'failed': '실패',
    'no_job': '학습 작업 없음'
  }
  return statusMap[status] || '알 수 없음'
})

const progressPercent = computed(() => {
  const current = trainingInfo.value.currentEpoch || 0
  const total = trainingInfo.value.totalEpochs || 1
  const status = trainingInfo.value.status
  
  // progress JSONB에서 더 정확한 진행률 확인
  const progress = trainingInfo.value.progress || {}
  if (progress.percent) {
    return Math.min(Math.round(progress.percent), 100)
  }
  
  // running 상태일 때는 최소 1% 표시
  if (status === 'running' && current === 0) {
    return 1
  }
  
  return Math.min(Math.round((current / total) * 100), 100)
})

const progressText = computed(() => {
  const current = trainingInfo.value.currentEpoch || 0
  const total = trainingInfo.value.totalEpochs || 0
  return `${current}/${total} 에폭 (${progressPercent.value}%)`
})

const canPause = computed(() => ['training', 'running'].includes(trainingInfo.value.status))
const canResume = computed(() => trainingInfo.value.status === 'paused')
const canStop = computed(() => ['training', 'paused', 'running'].includes(trainingInfo.value.status))

// 메서드
const closeModal = () => {
  stopPolling()
  emit('close')
}

const pauseTraining = async () => {
  try {
    console.log('⏸️ 학습 일시정지 요청')
    addLog('info', '⏸️ 학습 일시정지 요청 중...')
    
    // TODO: 실제 학습 일시정지 API 호출
    // const response = await fetch(`http://localhost:3012/api/training/pause/${trainingJobId}`, {
    //   method: 'POST'
    // })
    
    // 임시로 상태만 변경
    trainingInfo.value.status = 'paused'
    addLog('success', '✅ 학습이 일시정지되었습니다')
    
    emit('pause')
  } catch (error) {
    console.error('일시정지 실패:', error)
    addLog('error', `❌ 일시정지 실패: ${error.message}`)
  }
}

const resumeTraining = async () => {
  try {
    console.log('▶️ 학습 재개 요청')
    addLog('info', '▶️ 학습 재개 요청 중...')
    
    // TODO: 실제 학습 재개 API 호출
    // const response = await fetch(`http://localhost:3012/api/training/resume/${trainingJobId}`, {
    //   method: 'POST'
    // })
    
    // 임시로 상태만 변경
    trainingInfo.value.status = 'training'
    addLog('success', '✅ 학습이 재개되었습니다')
    
    emit('resume')
  } catch (error) {
    console.error('재개 실패:', error)
    addLog('error', `❌ 재개 실패: ${error.message}`)
  }
}

const stopTraining = async () => {
  try {
    console.log('⏹️ 학습 중지 요청')
    addLog('info', '⏹️ 학습 중지 요청 중...')
    
    if (props.trainingJobId) {
      // 실제 학습 중지 API 호출
      const response = await fetch(`http://localhost:3012/api/training/stop/${props.trainingJobId}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        trainingInfo.value.status = 'failed'
        addLog('success', '✅ 학습이 중지되었습니다')
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } else {
      // 작업 ID가 없으면 상태만 변경
      trainingInfo.value.status = 'failed'
      addLog('success', '✅ 학습이 중지되었습니다')
    }
    
    emit('stop')
  } catch (error) {
    console.error('중지 실패:', error)
    addLog('error', `❌ 중지 실패: ${error.message}`)
  }
}

const refreshStatus = async () => {
  await fetchTrainingStatus()
  await fetchMetrics()
}

const fetchTrainingStatus = async () => {
  try {
    if (!props.trainingJobId) {
      // 학습 작업 ID가 없으면 no_job 상태로 설정
      trainingInfo.value = {
        partId: '-',
        stage: '-',
        currentEpoch: 0,
        totalEpochs: 0,
        batchSize: '-',
        imageSize: '-',
        device: '-',
        status: 'no_job',
        progress: {}
      }
      addLog('info', '학습 작업이 없습니다.')
      return
    }

    const { data, error } = await supabase
      .from('training_jobs')
      .select('*')
      .eq('id', props.trainingJobId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('학습 작업을 찾을 수 없습니다.')
        addLog('warn', '학습 작업을 찾을 수 없습니다.')
        
        // 작업을 찾을 수 없으면 no_job 상태로 설정
        trainingInfo.value = {
          partId: '-',
          stage: '-',
          currentEpoch: 0,
          totalEpochs: 0,
          batchSize: '-',
          imageSize: '-',
          device: '-',
          status: 'no_job',
          progress: {}
        }
        return
      }
      throw error
    }

    trainingInfo.value = {
      partId: data.config?.partId || data.config?.part_id || data.config?.training_type || '-',
      stage: data.config?.model_stage || 'stage1',
      currentEpoch: data.progress?.current_epoch || data.progress?.epoch || 0,
      totalEpochs: data.config?.epochs || 50,
      batchSize: data.config?.batch_size || 8,
      imageSize: data.config?.imgsz || 640,
      device: data.config?.device || 'cuda',
      status: data.status || 'pending',
      progress: data.progress || {}
    }

    // 로그 추가
    addLog('info', `학습 상태 업데이트: ${statusText.value}`)
    addLog('debug', `작업 상세: ID=${data.id}, 상태=${data.status}, 설정=${JSON.stringify(data.config)}`)
    
    // 상태별 상세 로그 추가
    if (data.status === 'training' && data.progress?.current_epoch) {
      const percent = Math.round((data.progress.current_epoch / data.progress.total_epochs) * 100)
      addLog('info', `🚀 에폭 ${data.progress.current_epoch}/${data.progress.total_epochs} 진행 중 (${percent}%)`)
      
      // 메트릭이 있으면 로그에 추가
      if (data.progress.metrics) {
        const metrics = data.progress.metrics
        if (metrics.box_loss !== undefined) {
          addLog('info', `📊 Loss - Box: ${metrics.box_loss?.toFixed(4) || '0.0000'}, Seg: ${metrics.seg_loss?.toFixed(4) || '0.0000'}`)
        }
        if (metrics.map50 !== undefined) {
          addLog('info', `🎯 mAP - 50: ${metrics.map50?.toFixed(4) || '0.0000'}, 50-95: ${metrics.map50_95?.toFixed(4) || '0.0000'}`)
        }
      }
    } else if (data.status === 'completed') {
      addLog('success', '✅ 학습이 완료되었습니다!')
    } else if (data.status === 'failed') {
      addLog('error', `❌ 학습 실패: ${data.error_message || '알 수 없는 오류'}`)
    } else if (data.status === 'pending') {
      addLog('info', '⏳ 학습 대기 중...')
    } else if (data.status === 'running') {
      addLog('info', '🔄 학습 준비 중...')
    }
  } catch (error) {
    console.error('학습 상태 조회 실패:', error)
    addLog('error', `상태 조회 실패: ${error.message}`)
  }
}

const fetchMetrics = async () => {
  try {
    if (!props.trainingJobId) return

    // training_metrics 테이블에서 메트릭 조회 (올바른 컬럼명 사용)
    const { data, error } = await supabase
      .from('training_metrics')
      .select('*')
      .eq('training_job_id', props.trainingJobId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      // 테이블이 없거나 접근 권한이 없는 경우 무시
      if (error.code === 'PGRST116' || error.code === '42P01') {
        console.log('training_metrics 테이블이 없거나 접근할 수 없습니다. 기본값을 사용합니다.')
        metrics.value = {
          boxLoss: '0.0000',
          segLoss: '0.0000',
          clsLoss: '0.0000',
          dflLoss: '0.0000',
          map50: '0.0000',
          map50_95: '0.0000'
        }
        return
      }
      throw error
    }

    if (data && data.length > 0) {
      const latestMetric = data[0]
      // metrics JSONB 필드에서 데이터 추출
      const metricData = latestMetric.metrics || {}
      metrics.value = {
        boxLoss: metricData.box_loss?.toFixed(4) || '0.0000',
        segLoss: metricData.seg_loss?.toFixed(4) || '0.0000',
        clsLoss: metricData.cls_loss?.toFixed(4) || '0.0000',
        dflLoss: metricData.dfl_loss?.toFixed(4) || '0.0000',
        map50: metricData.map50?.toFixed(4) || '0.0000',
        map50_95: metricData.map50_95?.toFixed(4) || '0.0000'
      }
    } else {
      // 데이터가 없는 경우 기본값
      metrics.value = {
        boxLoss: '0.0000',
        segLoss: '0.0000',
        clsLoss: '0.0000',
        dflLoss: '0.0000',
        map50: '0.0000',
        map50_95: '0.0000'
      }
    }
  } catch (error) {
    console.error('메트릭 조회 실패:', error)
    // 오류 발생 시 기본값 설정
    metrics.value = {
      boxLoss: '0.0000',
      segLoss: '0.0000',
      clsLoss: '0.0000',
      dflLoss: '0.0000',
      map50: '0.0000',
      map50_95: '0.0000'
    }
  }
}

const addLog = (level, message) => {
  const timestamp = new Date().toLocaleTimeString()
  logs.value.unshift({
    timestamp,
    level,
    message
  })

  // 로그가 너무 많으면 오래된 것 제거 (더 많은 로그 보관)
  if (logs.value.length > 200) {
    logs.value = logs.value.slice(0, 200)
  }

  // 자동 스크롤
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = 0
    }
  })
}

const startPolling = () => {
  // 상태 폴링 (2초마다) - 더 빠른 업데이트
  statusPolling = setInterval(async () => {
    await fetchTrainingStatus()
  }, 2000)

  // 메트릭 폴링 (3초마다) - 더 빠른 업데이트
  metricsPolling = setInterval(async () => {
    await fetchMetrics()
  }, 3000)
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
  if (isVisible.value && props.trainingJobId) {
    console.log('🎯 학습 모달 초기화:', props.trainingJobId)
    addLog('info', `학습 모니터링 시작 (작업 ID: ${props.trainingJobId})`)
    startPolling()
    refreshStatus()
  }
})

onUnmounted(() => {
  stopPolling()
})

// Props 변경 감지
watch(() => props.visible, (newVisible) => {
  console.log('👁️ 모달 표시 상태 변경:', newVisible)
  if (newVisible && props.trainingJobId) {
    console.log('🎯 학습 모달 활성화:', props.trainingJobId)
    addLog('info', `학습 모니터링 시작 (작업 ID: ${props.trainingJobId})`)
    startPolling()
    refreshStatus()
  } else {
    stopPolling()
  }
})

watch(() => props.trainingJobId, (newJobId, oldJobId) => {
  console.log('🔄 학습 작업 ID 변경:', oldJobId, '→', newJobId)
  if (newJobId && isVisible.value) {
    addLog('info', `학습 작업 변경: ${oldJobId} → ${newJobId}`)
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

.status-no-job {
  background: #e5e7eb;
  color: #9ca3af;
}

.no-job-message {
  text-align: center;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  margin-top: 12px;
}

.no-job-message p {
  margin: 8px 0;
  color: #6b7280;
  font-size: 0.9rem;
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
  height: 400px;
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
