<template>
  <div class="model-monitoring-dashboard">
    <!-- 헤더 -->
    <div class="dashboard-header">
      <h1>🤖 모델 모니터링 대시보드</h1>
      <div class="header-actions">
        <button @click="refreshData" :disabled="loading" class="btn btn-primary">
          🔄 새로고침
        </button>
        <button @click="toggleAutoUpdate" :class="['btn', autoUpdate ? 'btn-success' : 'btn-secondary']">
          {{ autoUpdate ? '⏸️ 자동 업데이트 중지' : '▶️ 자동 업데이트 시작' }}
        </button>
      </div>
    </div>

    <!-- 모델 상태 카드 -->
    <div class="model-status-cards">
      <div class="status-card current-model">
        <div class="card-header">
          <h3>📋 현재 모델</h3>
          <span :class="['status-badge', statusClass]">{{ statusText }}</span>
        </div>
        <div class="card-content" v-if="currentModel">
          <div class="model-info">
            <div class="info-item">
              <span class="label">모델명:</span>
              <span class="value">{{ currentModel.model_name }}</span>
            </div>
            <div class="info-item">
              <span class="label">버전:</span>
              <span class="value">{{ currentModel.model_version }}</span>
            </div>
            <div class="info-item">
              <span class="label">타입:</span>
              <span class="value">{{ currentModel.model_type }}</span>
            </div>
            <div class="info-item">
              <span class="label">활성화:</span>
              <span class="value">{{ currentModel.is_active ? '✅ 활성' : '❌ 비활성' }}</span>
            </div>
            <div class="info-item">
              <span class="label">생성일:</span>
              <span class="value">{{ formatDate(currentModel.created_at) }}</span>
            </div>
          </div>
        </div>
        <div class="card-content" v-else>
          <div class="no-model-message">
            <p>📭 등록된 모델이 없습니다</p>
            <p class="help-text">새로운 모델을 학습하거나 업로드해주세요</p>
          </div>
        </div>
      </div>

      <div class="status-card latest-model" v-if="latestModel">
        <div class="card-header">
          <h3>🆕 최신 모델</h3>
          <span v-if="hasUpdate" class="status-badge status-warning">업데이트 가능</span>
        </div>
        <div class="card-content">
          <div class="model-info">
            <div class="info-item">
              <span class="label">모델명:</span>
              <span class="value">{{ latestModel.model_name }}</span>
            </div>
            <div class="info-item">
              <span class="label">버전:</span>
              <span class="value">{{ latestModel.model_version }}</span>
            </div>
            <div class="info-item">
              <span class="label">생성일:</span>
              <span class="value">{{ formatDate(latestModel.created_at) }}</span>
            </div>
          </div>
          <div class="update-actions" v-if="hasUpdate">
            <button @click="updateToLatest" :disabled="isUpdating" class="btn btn-success">
              {{ isUpdating ? '🔄 업데이트 중...' : '🚀 최신 모델로 업데이트' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 성능 메트릭 -->
    <div class="performance-section" v-if="currentModel?.performance_metrics">
      <h2>📊 성능 메트릭</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">mAP50</div>
          <div class="metric-value">{{ (currentModel.performance_metrics.mAP50 * 100).toFixed(1) }}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">mAP50-95</div>
          <div class="metric-value">{{ (currentModel.performance_metrics.mAP50_95 * 100).toFixed(1) }}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Precision</div>
          <div class="metric-value">{{ (currentModel.performance_metrics.precision * 100).toFixed(1) }}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Recall</div>
          <div class="metric-value">{{ (currentModel.performance_metrics.recall * 100).toFixed(1) }}%</div>
        </div>
      </div>
    </div>

    <!-- 모델 히스토리 -->
    <div class="history-section">
      <h2>📜 모델 히스토리</h2>
      <div class="history-list">
        <div 
          v-for="(model, index) in modelHistory" 
          :key="model.id || index"
          class="history-item"
          :class="{ 'active': model.is_active }"
        >
          <div class="history-info">
            <div class="model-name">{{ model.model_name }}</div>
            <div class="model-version">{{ model.model_version }}</div>
            <div class="model-date">{{ formatDate(model.created_at) }}</div>
          </div>
          <div class="history-status">
            <span v-if="model.is_active" class="status-badge status-success">활성</span>
            <span v-else class="status-badge status-secondary">비활성</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 설정 -->
    <div class="settings-section">
      <h2>⚙️ 모니터링 설정</h2>
      <div class="settings-grid">
        <div class="setting-item">
          <label>체크 간격 (초)</label>
          <input 
            v-model.number="checkInterval" 
            type="number" 
            min="10" 
            max="300"
            @change="updateCheckInterval"
          />
        </div>
        <div class="setting-item">
          <label>
            <input 
              v-model="autoUpdate" 
              type="checkbox" 
              @change="updateAutoUpdate"
            />
            자동 업데이트
          </label>
        </div>
        <div class="setting-item">
          <label>성능 임계값 (%)</label>
          <input 
            v-model.number="performanceThreshold" 
            type="number" 
            min="0" 
            max="50" 
            step="0.1"
            @change="updatePerformanceThreshold"
          />
        </div>
      </div>
    </div>

    <!-- 로딩 상태 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>데이터 로딩 중...</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useModelVersionChecker } from '../composables/useModelVersionChecker'

export default {
  name: 'ModelMonitoringDashboard',
  setup() {
    const {
      currentModel,
      latestModel,
      modelHistory,
      isChecking,
      hasUpdate,
      updateAvailable,
      checkInterval,
      autoUpdate,
      performanceThreshold,
      modelStatus,
      statusText,
      statusClass,
      getCurrentModel,
      checkLatestModel,
      updateToLatestModel,
      getModelHistory,
      startPeriodicCheck,
      stopPeriodicCheck,
      startRealtimeMonitoring,
      stopMonitoring
    } = useModelVersionChecker()

    const loading = ref(false)
    const isUpdating = ref(false)

    // 데이터 새로고침
    const refreshData = async () => {
      loading.value = true
      try {
        await Promise.all([
          getCurrentModel(),
          checkLatestModel(),
          getModelHistory()
        ])
      } finally {
        loading.value = false
      }
    }

    // 최신 모델로 업데이트
    const updateToLatest = async () => {
      isUpdating.value = true
      try {
        await updateToLatestModel()
        await refreshData()
      } finally {
        isUpdating.value = false
      }
    }

    // 자동 업데이트 토글
    const toggleAutoUpdate = () => {
      if (autoUpdate.value) {
        stopPeriodicCheck()
        autoUpdate.value = false
      } else {
        startPeriodicCheck()
        autoUpdate.value = true
      }
    }

    // 설정 업데이트
    const updateCheckInterval = () => {
      stopPeriodicCheck()
      startPeriodicCheck()
    }

    const updateAutoUpdate = () => {
      if (autoUpdate.value) {
        startPeriodicCheck()
      } else {
        stopPeriodicCheck()
      }
    }

    const updatePerformanceThreshold = () => {
      // 성능 임계값 업데이트 로직
      console.log('성능 임계값 업데이트:', performanceThreshold.value)
    }

    // 날짜 포맷팅
    const formatDate = (dateString) => {
      if (!dateString) return '알 수 없음'
      return new Date(dateString).toLocaleString('ko-KR')
    }

    // 생명주기
    onMounted(async () => {
      await refreshData()
      startRealtimeMonitoring()
    })

    onUnmounted(() => {
      stopMonitoring()
    })

    return {
      // 상태
      currentModel,
      latestModel,
      modelHistory,
      loading,
      isUpdating,
      isChecking,
      hasUpdate,
      updateAvailable,
      
      // 설정
      checkInterval,
      autoUpdate,
      performanceThreshold,
      
      // 계산된 속성
      modelStatus,
      statusText,
      statusClass,
      
      // 메서드
      refreshData,
      updateToLatest,
      toggleAutoUpdate,
      updateCheckInterval,
      updateAutoUpdate,
      updatePerformanceThreshold,
      formatDate
    }
  }
}
</script>

<style scoped>
.model-monitoring-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.dashboard-header h1 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.model-status-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}

.status-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.card-header h3 {
  margin: 0;
  color: #333;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
}

.status-badge.status-success {
  background: #d4edda;
  color: #155724;
}

.status-badge.status-warning {
  background: #fff3cd;
  color: #856404;
}

.status-badge.status-secondary {
  background: #e2e3e5;
  color: #6c757d;
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item .label {
  font-weight: 500;
  color: #666;
}

.info-item .value {
  color: #333;
  font-weight: 600;
}

.update-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.performance-section {
  margin-bottom: 30px;
}

.performance-section h2 {
  margin-bottom: 20px;
  color: #333;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.metric-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.metric-label {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

.history-section {
  margin-bottom: 30px;
}

.history-section h2 {
  margin-bottom: 20px;
  color: #333;
}

.history-list {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}

.history-item:last-child {
  border-bottom: none;
}

.history-item.active {
  background: #f8f9fa;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-name {
  font-weight: 600;
  color: #333;
}

.model-version {
  font-size: 0.9rem;
  color: #666;
}

.model-date {
  font-size: 0.8rem;
  color: #999;
}

.settings-section h2 {
  margin-bottom: 20px;
  color: #333;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item label {
  font-weight: 500;
  color: #333;
}

.setting-item input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.no-model-message {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.no-model-message p {
  margin: 0 0 10px 0;
  font-size: 1.1rem;
}

.no-model-message .help-text {
  font-size: 0.9rem;
  color: #999;
}
</style>
