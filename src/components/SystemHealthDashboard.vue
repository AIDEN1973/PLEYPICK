<template>
  <div class="system-health-dashboard">
    <div class="dashboard-header">
      <h2>🚀 BrickBox 시스템 건강도 대시보드</h2>
      <div class="health-status" :class="overallHealthClass">
        {{ overallHealthText }}
      </div>
    </div>

    <div class="system-components">
      <div class="component-card" v-for="(component, key) in systemStats" :key="key">
        <div class="component-header">
          <h3>{{ getComponentName(key) }}</h3>
          <div class="status-indicator" :class="component.status">
            {{ component.status }}
          </div>
        </div>
        
        <div class="component-metrics">
          <div class="metric" v-if="component.performance !== undefined">
            <span class="metric-label">성능:</span>
            <span class="metric-value">{{ (component.performance * 100).toFixed(1) }}%</span>
          </div>
          
          <div class="metric" v-if="component.accuracy !== undefined">
            <span class="metric-label">정확도:</span>
            <span class="metric-value">{{ (component.accuracy * 100).toFixed(1) }}%</span>
          </div>
          
          <div class="metric" v-if="component.efficiency !== undefined">
            <span class="metric-label">효율성:</span>
            <span class="metric-value">{{ (component.efficiency * 100).toFixed(1) }}%</span>
          </div>
          
          <div class="metric" v-if="component.completeness !== undefined">
            <span class="metric-label">완성도:</span>
            <span class="metric-value">{{ (component.completeness * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-controls">
      <button @click="refreshStatus" :disabled="loading" class="btn btn-primary">
        {{ loading ? '새로고침 중...' : '상태 새로고침' }}
      </button>
      
      <button @click="toggleMonitoring" class="btn btn-secondary">
        {{ isMonitoring ? '모니터링 중지' : '모니터링 시작' }}
      </button>
      
      <button @click="performOptimization" :disabled="loading" class="btn btn-success">
        성능 최적화
      </button>
    </div>

    <div class="system-logs" v-if="logs.length > 0">
      <h3>시스템 로그</h3>
      <div class="log-entry" v-for="(log, index) in logs" :key="index" :class="log.type">
        <span class="log-time">{{ formatTime(log.timestamp) }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import systemHealthMonitor from '../services/SystemHealthMonitor'

// 반응형 데이터
const loading = ref(false)
const isMonitoring = ref(false)
const systemStats = reactive({
  fgcEncoder: { status: 'unknown', performance: 0 },
  dataSplitter: { status: 'unknown', accuracy: 0 },
  mmapIndex: { status: 'unknown', efficiency: 0 },
  directoryStructure: { status: 'unknown', completeness: 0 },
  overallHealth: 'unknown'
})

const logs = ref([])

// 계산된 속성
const overallHealthClass = computed(() => {
  const health = systemStats.overallHealth
  return {
    'health-excellent': health === 'excellent',
    'health-good': health === 'good',
    'health-fair': health === 'fair',
    'health-poor': health === 'poor'
  }
})

const overallHealthText = computed(() => {
  const health = systemStats.overallHealth
  const healthMap = {
    'excellent': '🟢 우수',
    'good': '🟡 양호',
    'fair': '🟠 보통',
    'poor': '🔴 불량',
    'unknown': '⚪ 알 수 없음'
  }
  return healthMap[health] || '⚪ 알 수 없음'
})

// 메서드
const getComponentName = (key) => {
  const nameMap = {
    'fgcEncoder': 'FGC-Encoder (ArcFace)',
    'dataSplitter': '데이터 분할 시스템',
    'mmapIndex': 'L1/L2 mmap 인덱스',
    'directoryStructure': '디렉토리 구조'
  }
  return nameMap[key] || key
}

const refreshStatus = async () => {
  try {
    loading.value = true
    const status = systemHealthMonitor.getSystemStatus()
    
    // 시스템 상태 업데이트
    Object.assign(systemStats, status.stats)
    isMonitoring.value = status.isMonitoring
    
    addLog('info', '시스템 상태 새로고침 완료')
    
  } catch (error) {
    console.error('상태 새로고침 실패:', error)
    addLog('error', `상태 새로고침 실패: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const toggleMonitoring = () => {
  if (isMonitoring.value) {
    systemHealthMonitor.stopMonitoring()
    isMonitoring.value = false
    addLog('info', '모니터링 중지됨')
  } else {
    systemHealthMonitor.startAutoMonitoring()
    isMonitoring.value = true
    addLog('info', '모니터링 시작됨')
  }
}

const performOptimization = async () => {
  try {
    loading.value = true
    await systemHealthMonitor.performAutoOptimization()
    addLog('success', '성능 최적화 완료')
  } catch (error) {
    console.error('최적화 실패:', error)
    addLog('error', `최적화 실패: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const addLog = (type, message) => {
  logs.value.unshift({
    type,
    message,
    timestamp: Date.now()
  })
  
  // 최대 100개 로그만 유지
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100)
  }
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

// 이벤트 리스너 설정
const setupEventListeners = () => {
  systemHealthMonitor.on('health_changed', (data) => {
    addLog('info', `시스템 건강도 변경: ${data.previous} → ${data.current}`)
  })
  
  systemHealthMonitor.on('alert', (data) => {
    addLog('warning', `${data.component} ${data.type}: ${data.value} < ${data.threshold}`)
  })
  
  systemHealthMonitor.on('optimization_completed', () => {
    addLog('success', '자동 성능 최적화 완료')
  })
  
  systemHealthMonitor.on('error', (error) => {
    addLog('error', `시스템 오류: ${error.message}`)
  })
}

// 생명주기
onMounted(async () => {
  setupEventListeners()
  await refreshStatus()
  addLog('info', '시스템 건강도 대시보드 시작됨')
})

onUnmounted(() => {
  // 정리 작업
})
</script>

<style scoped>
.system-health-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 10px;
}

.health-status {
  padding: 10px 20px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 1.1em;
}

.health-excellent { background: #4ade80; }
.health-good { background: #fbbf24; }
.health-fair { background: #fb923c; }
.health-poor { background: #f87171; }

.system-components {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.component-card {
  background: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #3b82f6;
}

.component-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.component-header h3 {
  margin: 0;
  color: #1f2937;
}

.status-indicator {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.9em;
  font-weight: bold;
}

.status-indicator.ready { background: #dcfce7; color: #166534; }
.status-indicator.initializing { background: #fef3c7; color: #92400e; }
.status-indicator.unknown { background: #f3f4f6; color: #6b7280; }

.component-metrics {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.metric-label {
  font-weight: 500;
  color: #6b7280;
}

.metric-value {
  font-weight: bold;
  color: #1f2937;
}

.dashboard-controls {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.system-logs {
  background: #f9fafb;
  border-radius: 10px;
  padding: 20px;
  max-height: 400px;
  overflow-y: auto;
}

.system-logs h3 {
  margin: 0 0 15px 0;
  color: #1f2937;
}

.log-entry {
  display: flex;
  gap: 15px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.9em;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #6b7280;
  font-family: monospace;
  min-width: 80px;
}

.log-message {
  color: #1f2937;
}

.log-entry.info .log-message { color: #3b82f6; }
.log-entry.success .log-message { color: #10b981; }
.log-entry.warning .log-message { color: #f59e0b; }
.log-entry.error .log-message { color: #ef4444; }
</style>
