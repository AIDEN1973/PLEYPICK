<template>
  <div class="store-management-dashboard">
    <div class="dashboard-header">
      <h1>🏪 BrickBox 매장 관리
        <HelpTooltip 
          title="매장 관리"
          content="BrickBox 시스템의 매장별 운영 상태를 관리하는 대시보드입니다. AI 모델 성능, 처리 속도, 메모리 사용량 등을 모니터링합니다."
          :examples="['AI 모델 상태', '검출 성능', '처리 속도', '메모리 사용량']"
        />
      </h1>
      <div class="store-info">
        <span class="store-name">{{ storeInfo.name }}</span>
        <span class="store-id">ID: {{ storeInfo.id }}</span>
      </div>
    </div>

    <!-- 시스템 상태 카드 -->
    <div class="status-cards">
        <div class="status-card">
          <div class="card-icon">🧠</div>
          <div class="card-content">
            <h3>AI 모델
              <HelpTooltip 
                title="AI 모델"
                content="현재 사용 중인 AI 모델의 버전 정보입니다. 새로운 모델이 있으면 업데이트할 수 있습니다."
                :examples="['v1.0.0', 'v1.1.0', 'v2.0.0']"
              />
            </h3>
            <p class="version">{{ currentModelVersion || 'v1.0.0' }}</p>
            <small>현재 버전</small>
          </div>
          <div v-if="hasUpdate" class="update-badge">
            <span>🔄 업데이트 가능</span>
          </div>
        </div>

        <div class="status-card">
          <div class="card-icon">⚡</div>
          <div class="card-content">
            <h3>검출 성능
              <HelpTooltip 
                title="검출 성능"
                content="AI 모델이 부품을 올바르게 인식하는 정확도입니다. 높을수록 더 정확한 검출을 의미합니다."
                :examples="['95% = 매우 정확', '90% = 정확', '85% = 보통']"
              />
            </h3>
            <p class="performance">{{ (performance.accuracy * 100).toFixed(1) }}%</p>
            <small>정확도</small>
          </div>
        </div>

        <div class="status-card">
          <div class="card-icon">📊</div>
          <div class="card-content">
            <h3>처리 속도
              <HelpTooltip 
                title="처리 속도"
                content="AI 모델이 초당 처리할 수 있는 이미지 프레임 수입니다. 높을수록 더 빠른 처리를 의미합니다."
                :examples="['30 FPS = 실시간', '60 FPS = 매우 빠름', '15 FPS = 보통']"
              />
            </h3>
            <p class="fps">{{ Math.round(performance.fps) }} FPS</p>
            <small>초당 프레임</small>
          </div>
        </div>

        <div class="status-card">
          <div class="card-icon">💾</div>
          <div class="card-content">
            <h3>메모리 사용량
              <HelpTooltip 
                title="메모리 사용량"
                content="AI 모델이 사용하는 RAM 메모리의 양입니다. 너무 높으면 시스템 성능에 영향을 줄 수 있습니다."
                :examples="['500MB = 적음', '1GB = 보통', '2GB = 많음']"
              />
            </h3>
            <p class="memory">{{ Math.round(performance.memory_usage) }} MB</p>
            <small>현재 사용량</small>
          </div>
        </div>
    </div>

    <!-- 모델 업데이트 섹션 -->
    <div v-if="hasUpdate" class="update-section">
      <div class="update-card">
        <h3>🔄 모델 업데이트</h3>
        <div class="update-info">
          <p>새로운 AI 모델이 출시되었습니다!</p>
          <div class="version-comparison">
            <span class="current-version">현재: {{ currentModelVersion || 'v1.0.0' }}</span>
            <span class="arrow">→</span>
            <span class="new-version">최신: {{ latestModelVersion || 'v1.0.0' }}</span>
          </div>
        </div>
        
        <div class="update-actions">
          <button 
            @click="handleStartUpdate" 
            :disabled="isUpdating"
            class="update-btn primary"
          >
            {{ isUpdating ? '업데이트 중...' : '🚀 원클릭 업데이트' }}
          </button>
          
          <button 
            @click="checkUpdateDetails" 
            class="update-btn secondary"
          >
            📋 업데이트 내용 보기
          </button>
        </div>
      </div>
    </div>

    <!-- 매장 설정 섹션 -->
    <div class="settings-section">
      <h3>⚙️ 매장 설정</h3>
      
      <div class="settings-grid">
        <div class="setting-item">
          <label>현재 LEGO 세트</label>
          <select v-model="selectedSet" @change="updateSelectedSet">
            <option value="">세트 선택</option>
            <option v-for="set in availableSets" :key="set.id" :value="set.id">
              {{ formatSetName(set) }} ({{ set.partCount }}개 부품)
            </option>
          </select>
        </div>

        <div class="setting-item">
          <label>자동 업데이트</label>
          <div class="toggle-switch">
            <input 
              type="checkbox" 
              id="auto-update" 
              v-model="autoUpdate"
              @change="updateAutoUpdateSetting"
            >
            <label for="auto-update" class="toggle-label">
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-text">{{ autoUpdate ? '활성화' : '비활성화' }}</span>
          </div>
        </div>

        <div class="setting-item">
          <label>검출 민감도</label>
          <input 
            type="range" 
            min="0.1" 
            max="0.9" 
            step="0.1" 
            v-model="detectionSensitivity"
            @change="updateDetectionSensitivity"
            class="sensitivity-slider"
          >
          <span class="sensitivity-value">{{ detectionSensitivity }}</span>
        </div>
      </div>
    </div>

    <!-- 성능 모니터링 섹션 -->
    <div class="monitoring-section">
      <h3>📊 성능 모니터링</h3>
      
      <div class="monitoring-grid">
        <div class="chart-container">
          <h4>정확도 추이</h4>
          <div class="chart" ref="accuracyChart">
            <canvas ref="accuracyChart" width="400" height="200"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <h4>처리 속도</h4>
          <div class="chart" ref="fpsChart">
            <canvas ref="fpsChart" width="400" height="200"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- 시스템 로그 섹션 -->
    <div class="logs-section">
      <h3>📝 시스템 로그</h3>
      
      <div class="logs-container">
        <div class="log-filters">
          <button 
            v-for="level in logLevels" 
            :key="level"
            @click="filterLogs(level)"
            :class="{ active: selectedLogLevel === level }"
            class="log-filter-btn"
          >
            {{ level.toUpperCase() }}
          </button>
        </div>
        
        <div class="log-list">
          <div 
            v-for="log in filteredLogs" 
            :key="log.id"
            :class="['log-entry', log.level]"
          >
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 긴급 조치 섹션 -->
    <div class="emergency-section">
      <h3>🚨 긴급 조치</h3>
      
      <div class="emergency-actions">
        <button @click="emergencyRestart" class="emergency-btn restart">
          🔄 시스템 재시작
        </button>
        
        <button @click="emergencyRollback" class="emergency-btn rollback">
          ⏪ 이전 버전으로 롤백
        </button>
        
        <button @click="emergencyStop" class="emergency-btn stop">
          🛑 시스템 중지
        </button>
      </div>
    </div>

    <!-- 업데이트 진행 상황 모달 -->
    <div v-if="showUpdateModal" class="modal-overlay" @click="closeUpdateModal">
      <div class="modal-content" @click.stop>
        <h3>🔄 모델 업데이트 진행 상황</h3>
        
        <div class="update-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: updateProgress + '%' }"
            ></div>
          </div>
          <p class="progress-text">{{ updateProgress }}% 완료</p>
        </div>
        
        <div class="update-steps">
          <div 
            v-for="(step, index) in updateSteps" 
            :key="index"
            :class="['update-step', step.status]"
          >
            <span class="step-icon">{{ step.icon }}</span>
            <span class="step-text">{{ step.text }}</span>
          </div>
        </div>
        
        <div class="update-logs">
          <div 
            v-for="log in updateLogs" 
            :key="log.id"
            class="update-log"
          >
            {{ log.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useStoreManagement } from '@/composables/useStoreManagement'
import HelpTooltip from '../components/HelpTooltip.vue'

const {
  storeInfo,
  currentModelVersion,
  latestModelVersion,
  hasUpdate,
  performance,
  isUpdating,
  updateProgress,
  updateSteps,
  updateLogs,
  availableSets,
  selectedSet,
  autoUpdate,
  detectionSensitivity,
  systemLogs,
  startUpdate,
  checkUpdateDetails,
  updateSelectedSet,
  updateAutoUpdateSetting,
  updateDetectionSensitivity,
  emergencyRestart,
  emergencyRollback,
  emergencyStop,
  getStoreStatus,
  refreshPerformance
} = useStoreManagement()

// 로그 필터링
const logLevels = ['all', 'info', 'warning', 'error', 'success']
const selectedLogLevel = ref('all')

const filteredLogs = computed(() => {
  if (selectedLogLevel.value === 'all') {
    return systemLogs.value
  }
  return systemLogs.value.filter(log => log.level === selectedLogLevel.value)
})

const filterLogs = (level) => {
  selectedLogLevel.value = level
}

// 업데이트 모달
const showUpdateModal = ref(false)

const closeUpdateModal = () => {
  showUpdateModal.value = false
}

// 시간 포맷팅
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatSetNum = (setNum) => {
  if (!setNum) return ''
  return String(setNum).replace(/-\d+$/, '').trim()
}

const formatSetName = (set) => {
  if (!set) return ''
  const parts = []
  if (set.set_num) parts.push(formatSetNum(set.set_num))
  if (set.set_num && set.theme_name) parts.push('|')
  if (set.theme_name) parts.push(set.theme_name)
  if (set.set_num || set.theme_name) parts.push(set.name)
  else parts.push(set.name)
  return parts.join(' ')
}

// 차트 참조
const accuracyChart = ref(null)
const fpsChart = ref(null)

// 자동 새로고침
let refreshInterval = null

onMounted(async () => {
  console.log('🏪 매장 관리 대시보드 마운트')
  
  // 초기 데이터 로드
  await getStoreStatus()
  await refreshPerformance()
  
  // 자동 새로고침 시작 (30초마다)
  refreshInterval = setInterval(async () => {
    await refreshPerformance()
  }, 30000)
  
  // 업데이트 상태 감지
  if (isUpdating.value) {
    showUpdateModal.value = true
  }
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

// 업데이트 시작 시 모달 표시
const handleStartUpdate = async () => {
  showUpdateModal.value = true
  await startUpdate()
}

// 업데이트 완료 감지
watch(isUpdating, (newValue, oldValue) => {
  if (oldValue && !newValue) {
    // 업데이트 완료
    setTimeout(() => {
      showUpdateModal.value = false
    }, 3000)
  }
})
</script>

<style scoped>
.store-management-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  color: white;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  backdrop-filter: blur(10px);
}

.dashboard-header h1 {
  margin: 0;
  font-size: 2.5rem;
  font-weight: bold;
}

.store-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.store-name {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.store-id {
  font-size: 0.9rem;
  opacity: 0.8;
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.status-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  transition: transform 0.3s ease;
}

.status-card:hover {
  transform: translateY(-5px);
}

.card-icon {
  font-size: 2rem;
  min-width: 60px;
  text-align: center;
}

.card-content h3 {
  margin: 0 0 5px 0;
  font-size: 1rem;
  opacity: 0.9;
}

.card-content p {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
}

.card-content small {
  font-size: 0.8rem;
  opacity: 0.7;
}

.update-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff6b6b;
  color: white;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.update-section {
  margin-bottom: 30px;
}

.update-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 25px;
  backdrop-filter: blur(10px);
  border: 2px solid #4ecdc4;
}

.update-card h3 {
  margin: 0 0 15px 0;
  font-size: 1.3rem;
}

.update-info p {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
}

.version-comparison {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.current-version {
  background: rgba(255, 255, 255, 0.2);
  padding: 5px 10px;
  border-radius: 5px;
}

.arrow {
  font-size: 1.2rem;
  font-weight: bold;
}

.new-version {
  background: #4ecdc4;
  color: #2c3e50;
  padding: 5px 10px;
  border-radius: 5px;
  font-weight: bold;
}

.update-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.update-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.update-btn.primary {
  background: #4ecdc4;
  color: #2c3e50;
}

.update-btn.primary:hover:not(:disabled) {
  background: #45b7b8;
  transform: translateY(-2px);
}

.update-btn.secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.update-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.update-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settings-section,
.monitoring-section,
.logs-section,
.emergency-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 25px;
  margin-bottom: 30px;
  backdrop-filter: blur(10px);
}

.settings-section h3,
.monitoring-section h3,
.logs-section h3,
.emergency-section h3 {
  margin: 0 0 20px 0;
  font-size: 1.3rem;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-item label {
  font-weight: bold;
  font-size: 1rem;
}

.setting-item select,
.setting-item input {
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
}

.setting-item select option {
  background: #2c3e50;
  color: white;
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-label {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 25px;
  cursor: pointer;
}

.toggle-label input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 25px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 19px;
  width: 19px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}

input:checked + .toggle-label .toggle-slider {
  background: #4ecdc4;
}

input:checked + .toggle-label .toggle-slider:before {
  transform: translateX(25px);
}

.sensitivity-slider {
  width: 100%;
  margin: 10px 0;
}

.sensitivity-value {
  font-weight: bold;
  color: #4ecdc4;
}

.monitoring-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.chart-container {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 20px;
}

.chart-container h4 {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
}

.chart {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.3);
}

.chart-container canvas {
  width: 100%;
  height: 200px;
}

.log-filters {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.log-filter-btn {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.log-filter-btn:hover,
.log-filter-btn.active {
  background: #4ecdc4;
  color: #2c3e50;
  border-color: #4ecdc4;
}

.log-list {
  max-height: 300px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 15px;
}

.log-entry {
  display: flex;
  gap: 15px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.9rem;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: rgba(255, 255, 255, 0.7);
  min-width: 80px;
  font-family: monospace;
}

.log-message {
  flex: 1;
}

.log-entry.info .log-message {
  color: #4ecdc4;
}

.log-entry.warning .log-message {
  color: #f39c12;
}

.log-entry.error .log-message {
  color: #e74c3c;
}

.log-entry.success .log-message {
  color: #27ae60;
}

.emergency-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.emergency-btn {
  padding: 15px 25px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.emergency-btn.restart {
  background: #f39c12;
  color: white;
}

.emergency-btn.rollback {
  background: #e74c3c;
  color: white;
}

.emergency-btn.stop {
  background: #8e44ad;
  color: white;
}

.emergency-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  color: #2c3e50;
  border-radius: 15px;
  padding: 30px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  font-size: 1.5rem;
  text-align: center;
}

.update-progress {
  margin-bottom: 25px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #ecf0f1;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ecdc4, #45b7b8);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-weight: bold;
  color: #2c3e50;
}

.update-steps {
  margin-bottom: 25px;
}

.update-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.update-step.pending {
  background: #ecf0f1;
  color: #7f8c8d;
}

.update-step.processing {
  background: #3498db;
  color: white;
}

.update-step.completed {
  background: #27ae60;
  color: white;
}

.update-step.failed {
  background: #e74c3c;
  color: white;
}

.step-icon {
  font-size: 1.2rem;
}

.update-logs {
  max-height: 200px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
}

.update-log {
  padding: 5px 0;
  border-bottom: 1px solid #dee2e6;
  font-size: 0.9rem;
  color: #495057;
}

.update-log:last-child {
  border-bottom: none;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .status-cards {
    grid-template-columns: 1fr;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .monitoring-grid {
    grid-template-columns: 1fr;
  }
  
  .emergency-actions {
    flex-direction: column;
  }
  
  .update-actions {
    flex-direction: column;
  }
}
</style>
