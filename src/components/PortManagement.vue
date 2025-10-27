

<template>
  <div class="port-management">
    <div class="header">
      <h2>🔌 포트 관리 시스템</h2>
      <p class="subtitle">실시간 포트 현황 모니터링 및 자동 복구</p>
      <div class="emergency-controls">
        <button @click="emergencyStop" class="emergency-btn">
          🚨 긴급 정지
        </button>
        <span class="status-indicator" :class="{ active: isMonitoring }">
          {{ isMonitoring ? '모니터링 활성' : '모니터링 비활성' }}
        </span>
      </div>
    </div>

    <!-- 실시간 상태 대시보드 -->
    <div class="status-dashboard">
      <h3>📊 실시간 상태</h3>
      <div class="status-grid">
        <div class="status-card">
          <div class="status-icon">🟢</div>
          <div class="status-content">
            <div class="status-value">{{ healthyServices }}</div>
            <div class="status-label">정상 서비스</div>
          </div>
        </div>
        <div class="status-card">
          <div class="status-icon">🔴</div>
          <div class="status-content">
            <div class="status-value">{{ failedServices }}</div>
            <div class="status-label">오류 서비스</div>
          </div>
        </div>
        <div class="status-card">
          <div class="status-icon">⏰</div>
          <div class="status-content">
            <div class="status-value">{{ lastUpdate }}</div>
            <div class="status-label">마지막 업데이트</div>
          </div>
        </div>
        <div class="status-card">
          <div class="status-icon">🔄</div>
          <div class="status-content">
            <div class="status-value">{{ autoRecoveryEnabled ? 'ON' : 'OFF' }}</div>
            <div class="status-label">자동 복구</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 서비스별 포트 상태 -->
    <div class="services-section">
      <h3>🔍 서비스별 포트 상태</h3>
      <div class="services-table-container">
        <table class="services-table">
          <thead>
            <tr>
              <th>서비스</th>
              <th>포트</th>
              <th>상태</th>
              <th>응답 시간</th>
              <th>마지막 확인</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="service in services" :key="service.name" :class="['service-row', service.status]">
              <td>
                <div class="service-info">
                  <span class="service-name">{{ service.name }}</span>
                  <span class="service-description">{{ service.description }}</span>
                </div>
              </td>
              <td>
                <span class="port-number">{{ service.port }}</span>
              </td>
            <td>
              <span :class="['status-badge', service.status]">
                {{ getStatusText(service.status) }}
              </span>
            </td>
              <td>
                <span v-if="service.responseTime" class="response-time">
                  {{ service.responseTime }}ms
                </span>
                <span v-else class="no-data">-</span>
              </td>
              <td>
                <span class="last-check">{{ service.lastCheck }}</span>
              </td>
              <td>
                <div class="action-buttons">
                  <button 
                    @click="checkService(service)" 
                    :disabled="isChecking"
                    class="action-btn check-btn"
                  >
                    🔍 확인
                  </button>
                  <button 
                    v-if="service.status === 'error'"
                    @click="restartService(service)" 
                    :disabled="isRestarting"
                    class="action-btn restart-btn"
                  >
                    🔄 재시작
                  </button>
                  <button 
                    @click="viewLogs(service)" 
                    class="action-btn logs-btn"
                  >
                    📝 로그
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 자동 복구 설정 -->
    <div class="auto-recovery-section">
      <h3>🛡️ 자동 복구 설정</h3>
      <div class="auto-recovery-controls">
        <div class="control-group">
          <label class="control-label">
            <input 
              type="checkbox" 
              v-model="autoRecoveryEnabled"
              @change="toggleAutoRecovery"
            />
            자동 복구 활성화
          </label>
          <p class="control-description">
            오류가 감지되면 자동으로 서비스를 재시작합니다
          </p>
        </div>
        <div class="control-group">
          <label class="control-label">
            모니터링 간격 (초):
            <select v-model="monitoringInterval" @change="updateMonitoringInterval">
              <option value="5">5초</option>
              <option value="10">10초</option>
              <option value="30">30초</option>
              <option value="60">60초</option>
            </select>
          </label>
        </div>
        <div class="control-group">
          <button @click="startMonitoring" :disabled="isMonitoring" class="action-btn primary">
            {{ isMonitoring ? '모니터링 중...' : '모니터링 시작' }}
          </button>
          <button @click="stopMonitoring" :disabled="!isMonitoring" class="action-btn secondary">
            모니터링 중지
          </button>
          <button @click="checkAllServices" :disabled="isChecking" class="action-btn tertiary">
            {{ isChecking ? '확인 중...' : '즉시 확인' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 일괄 작업 -->
    <div class="batch-operations">
      <h3>⚡ 일괄 작업</h3>
      <div class="batch-controls">
        <button @click="checkAllServices" :disabled="isChecking" class="action-btn primary">
          🔍 모든 서비스 확인
        </button>
        <button @click="restartFailedServices" :disabled="isRestarting" class="action-btn warning">
          🔄 실패한 서비스 재시작
        </button>
        <button @click="restartAllServices" :disabled="isRestarting" class="action-btn danger">
          🔄 모든 서비스 재시작
        </button>
        <button @click="cleanupPorts" :disabled="isCleaning" class="action-btn secondary">
          🧹 포트 정리
        </button>
      </div>
    </div>

    <!-- 로그 섹션 -->
    <div class="logs-section">
      <h3>📝 시스템 로그</h3>
      <div class="log-container">
        <div v-for="(log, index) in logs" :key="index" :class="['log-entry', log.type]">
          <span class="log-timestamp">[{{ log.timestamp }}]</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
      <button @click="clearLogs" class="action-btn secondary">로그 지우기</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

// 상태 변수
const services = ref([
  { name: 'Frontend', port: 3000, description: 'Vue.js 프론트엔드', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'WebP API', port: 3004, description: 'WebP 이미지 API', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'AI API', port: 3005, description: 'AI 추론 API', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'Training API', port: 3010, description: 'AI 학습 API', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'Synthetic API', port: 3011, description: '합성 데이터셋 API', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'Training Executor', port: 3012, description: '학습 실행 서버', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'Worker', port: 3020, description: '백그라운드 워커', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'CLIP Service', port: 3021, description: 'CLIP 임베딩 서비스', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'Semantic Vector API', port: 3022, description: 'Semantic Vector API', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'Manual Upload', port: 3030, description: '수동 업로드 API', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'Monitoring', port: 3040, description: '모니터링 대시보드', status: 'unknown', responseTime: null, lastCheck: '-' },
  { name: 'Blender API', port: 5003, description: 'Blender 렌더링 API', status: 'unknown', responseTime: null, lastCheck: '-' }
])

const isMonitoring = ref(false)
const isChecking = ref(false)
const isRestarting = ref(false)
const isCleaning = ref(false)
const autoRecoveryEnabled = ref(true)
const monitoringInterval = ref(30) // 10초에서 30초로 변경
const lastUpdate = ref('-')
const logs = ref([])
let monitoringTimer = null
let lastApiCall = 0 // API 호출 간격 제어

// 계산된 속성
const healthyServices = computed(() => 
  services.value.filter(s => s.status === 'healthy').length
)

const failedServices = computed(() => 
  services.value.filter(s => s.status === 'error').length
)

// 헬퍼 함수
const addLog = (message, type = 'info') => {
  logs.value.unshift({
    timestamp: new Date().toLocaleTimeString(),
    message,
    type
  })
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100)
  }
}

const getStatusText = (status) => {
  const statusMap = {
    healthy: '정상',
    error: '오류',
    timeout: '타임아웃',
    unknown: '미확인'
  }
  return statusMap[status] || '알 수 없음'
}

// 서비스 확인 함수 (개별 확인용)
const checkService = async (service) => {
  if (isChecking.value) {
    addLog('전체 서비스 확인이 진행 중입니다. 잠시 후 다시 시도해주세요.', 'warn')
    return
  }
  
  try {
    // 서버 측 포트 상태 API 호출
    const response = await fetch('/api/port-status')
    const data = await response.json()
    
    if (data.success) {
      const serviceData = data.services.find(s => s.port === service.port)
      if (serviceData) {
        service.status = serviceData.status
        service.responseTime = serviceData.responseTime
        service.lastCheck = serviceData.lastCheck
        
        addLog(`${service.name} 확인 완료: ${service.status} (${serviceData.responseTime}ms)`, 
               serviceData.status === 'healthy' ? 'success' : 'error')
      }
    } else {
      throw new Error(data.error || '서버 응답 오류')
    }

  } catch (error) {
    service.status = 'error'
    service.responseTime = null
    service.lastCheck = new Date().toLocaleTimeString()

    addLog(`${service.name} 확인 실패: ${error.message}`, 'error')
  }
}

// 모든 서비스 확인
const checkAllServices = async () => {
  // API 호출 간격 제어 (최소 5초 간격)
  const now = Date.now()
  if (now - lastApiCall < 5000) {
    addLog('API 호출 간격이 너무 짧습니다. 잠시 후 다시 시도해주세요.', 'warn')
    return
  }
  
  if (isChecking.value) {
    addLog('이미 서비스 확인 중입니다', 'warn')
    return
  }
  
  isChecking.value = true
  lastApiCall = now
  addLog('모든 서비스 확인 시작', 'info')
  
  try {
    // 서버 측 포트 상태 API 호출
    const response = await fetch('/api/port-status')
    const data = await response.json()
    
    if (data.success) {
      // 서버에서 받은 데이터로 로컬 상태 업데이트
      data.services.forEach(serverService => {
        const localService = services.value.find(s => s.port === serverService.port)
        if (localService) {
          localService.status = serverService.status
          localService.responseTime = serverService.responseTime
          localService.lastCheck = serverService.lastCheck
        }
      })
      
      addLog(`모든 서비스 확인 완료: ${data.summary.healthy}/${data.summary.total} 정상`, 'success')
    } else {
      throw new Error(data.error || '서버 응답 오류')
    }
  } catch (error) {
    addLog(`서비스 확인 실패: ${error.message}`, 'error')
  } finally {
    isChecking.value = false
    lastUpdate.value = new Date().toLocaleTimeString()
  }
}

// 서비스 재시작
const restartService = async (service) => {
  isRestarting.value = true
  addLog(`${service.name} 재시작 시도`, 'info')
  
  try {
    // 실제 서비스 재시작은 시스템 레벨에서 수행되어야 하므로
    // 현재는 상태 재확인만 수행
    addLog(`${service.name} 재시작 시뮬레이션 (실제 재시작은 시스템 관리자 권한 필요)`, 'warning')
    
    // 2초 대기 후 상태 재확인
    await new Promise(resolve => setTimeout(resolve, 2000))
    await checkService(service)
    
    if (service.status === 'healthy') {
      addLog(`${service.name} 상태 확인 완료`, 'success')
    } else {
      addLog(`${service.name} 상태 확인 실패`, 'error')
    }
    
  } catch (error) {
    addLog(`${service.name} 재시작 오류: ${error.message}`, 'error')
  } finally {
    isRestarting.value = false
  }
}

// 실패한 서비스 재시작
const restartFailedServices = async () => {
  const failedServices = services.value.filter(s => s.status === 'error')
  
  if (failedServices.length === 0) {
    addLog('재시작할 실패한 서비스가 없습니다', 'info')
    return
  }
  
  isRestarting.value = true
  addLog(`${failedServices.length}개 실패한 서비스 재시작 시작`, 'info')
  
  for (const service of failedServices) {
    await restartService(service)
    await new Promise(resolve => setTimeout(resolve, 1000)) // 1초 간격
  }
  
  isRestarting.value = false
  addLog('실패한 서비스 재시작 완료', 'info')
}

// 모든 서비스 재시작
const restartAllServices = async () => {
  if (!confirm('모든 서비스를 재시작하시겠습니까?')) {
    return
  }
  
  isRestarting.value = true
  addLog('모든 서비스 재시작 시작', 'warning')
  
  for (const service of services.value) {
    await restartService(service)
    await new Promise(resolve => setTimeout(resolve, 1000)) // 1초 간격
  }
  
  isRestarting.value = false
  addLog('모든 서비스 재시작 완료', 'info')
}

// 포트 정리
const cleanupPorts = async () => {
  isCleaning.value = true
  addLog('포트 정리 시작', 'info')
  
  try {
    // 실제 포트 정리는 시스템 레벨에서 수행되어야 하므로
    // 현재는 상태 재확인만 수행
    addLog('포트 정리 시뮬레이션 (실제 정리는 시스템 관리자 권한 필요)', 'warning')
    
    // 2초 대기 후 모든 서비스 재확인
    await new Promise(resolve => setTimeout(resolve, 2000))
    await checkAllServices()
    
    addLog('포트 상태 재확인 완료', 'success')
    
  } catch (error) {
    addLog(`포트 정리 오류: ${error.message}`, 'error')
  } finally {
    isCleaning.value = false
  }
}

// 모니터링 제어
const startMonitoring = () => {
  if (isMonitoring.value) {
    addLog('이미 모니터링이 실행 중입니다', 'warn')
    return
  }
  
  isMonitoring.value = true
  addLog(`모니터링 시작 (${monitoringInterval.value}초 간격)`, 'info')
  
  monitoringTimer = setInterval(async () => {
    try {
      // 중복 실행 방지
      if (isChecking.value) {
        addLog('이전 확인이 진행 중입니다. 건너뜁니다.', 'warn')
        return
      }
      
      // API 호출 간격 제어
      const now = Date.now()
      if (now - lastApiCall < 5000) {
        addLog('API 호출 간격이 너무 짧습니다. 건너뜁니다.', 'warn')
        return
      }
      
      await checkAllServices()
      
      // 자동 복구가 활성화된 경우 실패한 서비스 자동 재시작
      if (autoRecoveryEnabled.value && failedServices.value > 0) {
        addLog('자동 복구 실행', 'warning')
        await restartFailedServices()
      }
    } catch (error) {
      addLog(`모니터링 오류: ${error.message}`, 'error')
    }
  }, monitoringInterval.value * 1000)
}

const stopMonitoring = () => {
  if (!isMonitoring.value) return
  
  isMonitoring.value = false
  if (monitoringTimer) {
    clearInterval(monitoringTimer)
    monitoringTimer = null
  }
  addLog('모니터링 중지', 'info')
}

const toggleAutoRecovery = () => {
  addLog(`자동 복구 ${autoRecoveryEnabled.value ? '활성화' : '비활성화'}`, 'info')
}

const updateMonitoringInterval = () => {
  if (isMonitoring.value) {
    stopMonitoring()
    startMonitoring()
  }
  addLog(`모니터링 간격 변경: ${monitoringInterval.value}초`, 'info')
}

// 로그 관련
const viewLogs = (service) => {
  addLog(`${service.name} 로그: 현재 시스템 로그 섹션에서 확인 가능`, 'info')
}

const clearLogs = () => {
  logs.value = []
  addLog('로그 지우기 완료', 'info')
}

// 긴급 정지 함수
const emergencyStop = () => {
  addLog('🚨 긴급 정지 실행', 'warning')
  
  // 모든 타이머 정지
  stopMonitoring()
  
  // 모든 상태 초기화
  isChecking.value = false
  isRestarting.value = false
  isCleaning.value = false
  
  // API 호출 시간 초기화
  lastApiCall = 0
  
  addLog('모든 프로세스 정지 완료', 'success')
}

// 생명주기
onMounted(() => {
  addLog('포트 관리 시스템 초기화', 'info')
  // 초기 확인은 지연 실행으로 변경
  setTimeout(() => {
    checkAllServices()
  }, 1000) // 1초 후 실행
})

onUnmounted(() => {
  stopMonitoring()
  // 타이머 강제 정리
  if (monitoringTimer) {
    clearInterval(monitoringTimer)
    monitoringTimer = null
  }
})
</script>

<style scoped>
.port-management {
  font-family: 'Noto Sans KR', sans-serif;
  color: #34495e;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 2rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.1rem;
  color: #7f8c8d;
}

.emergency-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.emergency-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

.emergency-btn:hover {
  background: #c82333;
}

.status-indicator {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  background: #e2e3e5;
  color: #6c757d;
  transition: all 0.3s;
}

.status-indicator.active {
  background: #d4edda;
  color: #155724;
}

.status-dashboard {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  color: white;
}

.status-dashboard h3 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: white;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.status-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  backdrop-filter: blur(10px);
}

.status-icon {
  font-size: 2rem;
}

.status-content {
  flex: 1;
}

.status-value {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.status-label {
  font-size: 0.9rem;
  opacity: 0.9;
}

.services-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.services-section h3 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 1.5rem;
}

.services-table-container {
  overflow-x: auto;
}

.services-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.services-table th {
  background: #f8f9fa;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

.services-table td {
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.service-row.healthy {
  background: rgba(40, 167, 69, 0.05);
}

.service-row.error {
  background: rgba(220, 53, 69, 0.05);
}

.service-row.timeout {
  background: rgba(255, 193, 7, 0.05);
}

.service-info {
  display: flex;
  flex-direction: column;
}

.service-name {
  font-weight: 600;
  color: #2c3e50;
}

.service-description {
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.port-number {
  font-family: 'Courier New', monospace;
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.healthy {
  background: #d4edda;
  color: #155724;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.timeout {
  background: #fff3cd;
  color: #856404;
}

.status-badge.unknown {
  background: #e2e3e5;
  color: #383d41;
}

.response-time {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #28a745;
}

.no-data {
  color: #6c757d;
  font-style: italic;
}

.last-check {
  font-size: 0.8rem;
  color: #6c757d;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.primary {
  background: #007bff;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: #0056b3;
}

.action-btn.secondary {
  background: #6c757d;
  color: white;
}

.action-btn.secondary:hover:not(:disabled) {
  background: #545b62;
}

.action-btn.warning {
  background: #ffc107;
  color: #212529;
}

.action-btn.warning:hover:not(:disabled) {
  background: #e0a800;
}

.action-btn.danger {
  background: #dc3545;
  color: white;
}

.action-btn.danger:hover:not(:disabled) {
  background: #c82333;
}

.action-btn.tertiary {
  background: #17a2b8;
  color: white;
}

.action-btn.tertiary:hover:not(:disabled) {
  background: #138496;
}

.check-btn {
  background: #17a2b8;
  color: white;
}

.check-btn:hover:not(:disabled) {
  background: #138496;
}

.restart-btn {
  background: #fd7e14;
  color: white;
}

.restart-btn:hover:not(:disabled) {
  background: #e8650e;
}

.logs-btn {
  background: #6f42c1;
  color: white;
}

.logs-btn:hover:not(:disabled) {
  background: #5a32a3;
}

.auto-recovery-section,
.batch-operations {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.auto-recovery-section h3,
.batch-operations h3 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 1.5rem;
}

.auto-recovery-controls,
.batch-controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #495057;
}

.control-description {
  font-size: 0.9rem;
  color: #6c757d;
  margin-left: 1.5rem;
}

.batch-controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.logs-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.logs-section h3 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 1.5rem;
}

.log-container {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.log-entry {
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
}

.log-entry.success {
  color: #28a745;
}

.log-entry.error {
  color: #dc3545;
}

.log-entry.warning {
  color: #ffc107;
}

.log-entry.info {
  color: #17a2b8;
}

.log-timestamp {
  color: #6c757d;
  margin-right: 0.5rem;
}

.log-message {
  color: #495057;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .port-management {
    padding: 1rem;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .services-table {
    font-size: 0.8rem;
  }
  
  .services-table th,
  .services-table td {
    padding: 0.5rem;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .batch-controls {
    flex-direction: column;
  }
}
</style>
