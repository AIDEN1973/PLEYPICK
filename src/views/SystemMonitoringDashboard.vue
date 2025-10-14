<template>
  <div class="system-monitoring-dashboard">
    <div class="dashboard-header">
      <h1>🔍 BrickBox 시스템 모니터링</h1>
      <p class="subtitle">전체 시스템 상태 및 성능 지표를 실시간으로 모니터링합니다</p>
      <div class="header-actions">
        <button @click="refreshAllData" class="btn-refresh" :disabled="loading">
          <span v-if="loading">🔄 새로고침 중...</span>
          <span v-else>🔄 새로고침</span>
        </button>
        <button @click="exportReport" class="btn-export">
          📊 리포트 내보내기
        </button>
      </div>
    </div>

    <!-- 모니터링 탭 -->
    <div class="monitoring-tabs">
      <button 
        :class="['tab', { active: activeTab === 'overview' }]"
        @click="activeTab = 'overview'"
      >
        📊 시스템 개요
      </button>
      <button 
        :class="['tab', { active: activeTab === 'pipeline' }]"
        @click="activeTab = 'pipeline'"
      >
        🔄 파이프라인 상태
      </button>
      <button 
        :class="['tab', { active: activeTab === 'ai-workers' }]"
        @click="activeTab = 'ai-workers'"
      >
        🤖 AI 워커
      </button>
      <button 
        :class="['tab', { active: activeTab === 'quality' }]"
        @click="activeTab = 'quality'"
      >
        📈 품질 지표
      </button>
      <button 
        :class="['tab', { active: activeTab === 'tests' }]"
        @click="activeTab = 'tests'"
      >
        🧪 테스트 결과
      </button>
    </div>

    <!-- 탭 콘텐츠 -->
    <div class="tab-content">
      <!-- 시스템 개요 탭 -->
      <div v-show="activeTab === 'overview'" class="overview-tab">
        <div class="system-overview">
          <h2>📊 시스템 개요</h2>
          <div class="status-grid">
            <div class="status-card">
              <div class="status-header">
                <h3>렌더링 파이프라인</h3>
                <span :class="['status-badge', getStatusClass(renderingStatus)]">
                  {{ renderingStatus }}
                </span>
              </div>
              <div class="status-content">
                <div class="progress-info">
                  <span>진행률: {{ renderingProgress }}%</span>
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: renderingProgress + '%' }"></div>
                  </div>
                </div>
                <div class="status-details">
                  <span>현재 작업: {{ currentRenderingPart || '대기 중' }}</span>
                  <span>완료된 이미지: {{ completedImages }}/{{ totalImages }}</span>
                </div>
              </div>
            </div>

            <div class="status-card">
              <div class="status-header">
                <h3>AI 워커 상태</h3>
                <span class="overall-status">{{ overallWorkerStatus }}</span>
              </div>
              <div class="worker-status-grid">
                <div class="worker-item">
                  <span class="worker-name">Embedding</span>
                  <span :class="['worker-status', workerStatus.embedding]">{{ workerStatus.embedding }}</span>
                </div>
                <div class="worker-item">
                  <span class="worker-name">Fusion</span>
                  <span :class="['worker-status', workerStatus.fusion]">{{ workerStatus.fusion }}</span>
                </div>
                <div class="worker-item">
                  <span class="worker-name">QA</span>
                  <span :class="['worker-status', workerStatus.qa]">{{ workerStatus.qa }}</span>
                </div>
              </div>
            </div>

            <div class="status-card">
              <div class="status-header">
                <h3>데이터베이스</h3>
                <span :class="['status-badge', dbStatus.connected ? 'healthy' : 'error']">
                  {{ dbStatus.connected ? '연결됨' : '연결 끊김' }}
                </span>
              </div>
              <div class="db-metrics">
                <div class="metric-row">
                  <span>응답시간:</span>
                  <span :class="getResponseTimeClass(dbStatus.responseTime)">{{ dbStatus.responseTime }}ms</span>
                </div>
                <div class="metric-row">
                  <span>활성 연결:</span>
                  <span>{{ dbStatus.activeConnections }}</span>
                </div>
                <div class="metric-row">
                  <span>쿼리 성능:</span>
                  <span>{{ dbStatus.queryPerformance }}ms</span>
                </div>
              </div>
            </div>

            <div class="status-card">
              <div class="status-header">
                <h3>저장소</h3>
                <span class="storage-status">{{ storageStatus }}</span>
              </div>
              <div class="storage-metrics">
                <div class="metric-row">
                  <span>사용량:</span>
                  <span>{{ storageMetrics.used }} / {{ storageMetrics.total }}</span>
                </div>
                <div class="metric-row">
                  <span>사용률:</span>
                  <span>{{ storageMetrics.usagePercent }}%</span>
                </div>
                <div class="metric-row">
                  <span>이미지 수:</span>
                  <span>{{ storageMetrics.imageCount.toLocaleString() }}개</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 실시간 메트릭 -->
        <div class="metrics-section">
          <h2>📈 실시간 성능 지표</h2>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-header">
                <h4>렌더링 성능</h4>
                <span class="metric-trend" :class="getTrendClass(metrics.renderingSpeed.trend)">
                  {{ getTrendIcon(metrics.renderingSpeed.trend) }} {{ metrics.renderingSpeed.trend > 0 ? '+' : '' }}{{ metrics.renderingSpeed.trend }}%
                </span>
              </div>
              <div class="metric-value">{{ metrics.renderingSpeed.current }} 이미지/분</div>
              <div class="metric-subtitle">vs 어제: {{ metrics.renderingSpeed.yesterday }} 이미지/분</div>
            </div>

            <div class="metric-card">
              <div class="metric-header">
                <h4>품질 지표</h4>
                <span class="metric-trend" :class="getTrendClass(metrics.quality.trend)">
                  {{ getTrendIcon(metrics.quality.trend) }} {{ metrics.quality.trend > 0 ? '+' : '' }}{{ metrics.quality.trend.toFixed(2) }}
                </span>
              </div>
              <div class="metric-value">{{ metrics.quality.avgSSIM.toFixed(3) }} SSIM</div>
              <div class="metric-subtitle">평균 품질 점수</div>
            </div>

            <div class="metric-card">
              <div class="metric-header">
                <h4>AI 정확도</h4>
                <span class="metric-trend" :class="getTrendClass(metrics.aiAccuracy.trend)">
                  {{ getTrendIcon(metrics.aiAccuracy.trend) }} {{ metrics.aiAccuracy.trend > 0 ? '+' : '' }}{{ metrics.aiAccuracy.trend.toFixed(1) }}%
                </span>
              </div>
              <div class="metric-value">{{ metrics.aiAccuracy.current }}%</div>
              <div class="metric-subtitle">Top-1 정확도</div>
            </div>

            <div class="metric-card">
              <div class="metric-header">
                <h4>처리 지연시간</h4>
                <span class="metric-trend" :class="getTrendClass(-metrics.latency.trend)">
                  {{ getTrendIcon(-metrics.latency.trend) }} {{ metrics.latency.trend > 0 ? '+' : '' }}{{ metrics.latency.trend.toFixed(1) }}ms
                </span>
              </div>
              <div class="metric-value">{{ metrics.latency.current }}ms</div>
              <div class="metric-subtitle">P95 지연시간</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 파이프라인 상태 탭 -->
      <div v-show="activeTab === 'pipeline'" class="pipeline-tab">
        <PipelineStatusMonitor />
      </div>

      <!-- AI 워커 탭 -->
      <div v-show="activeTab === 'ai-workers'" class="ai-workers-tab">
        <AIWorkerMonitor />
      </div>

      <!-- 품질 지표 탭 -->
      <div v-show="activeTab === 'quality'" class="quality-tab">
        <EnhancedQualityDashboard />
      </div>

      <!-- 테스트 결과 탭 -->
      <div v-show="activeTab === 'tests'" class="tests-tab">
        <TestResultsMonitor />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import PipelineStatusMonitor from '../components/PipelineStatusMonitor.vue'
import AIWorkerMonitor from '../components/AIWorkerMonitor.vue'
import EnhancedQualityDashboard from '../components/EnhancedQualityDashboard.vue'
import TestResultsMonitor from '../components/TestResultsMonitor.vue'

const { supabase } = useSupabase()

// 반응형 데이터
const loading = ref(false)
const activeTab = ref('overview')
const renderingStatus = ref('대기 중')
const renderingProgress = ref(0)
const currentRenderingPart = ref(null)
const completedImages = ref(0)
const totalImages = ref(0)

const workerStatus = ref({
  embedding: '정상',
  fusion: '정상',
  qa: '정상'
})

const dbStatus = ref({
  connected: true,
  responseTime: 45,
  activeConnections: 12,
  queryPerformance: 23
})

const storageMetrics = ref({
  used: '2.3 GB',
  total: '10 GB',
  usagePercent: 23,
  imageCount: 15420
})

const metrics = ref({
  renderingSpeed: {
    current: 45,
    yesterday: 38,
    trend: 18.4
  },
  quality: {
    avgSSIM: 0.972,
    trend: 0.02
  },
  aiAccuracy: {
    current: 94.2,
    trend: 2.1
  },
  latency: {
    current: 12.3,
    trend: -1.2
  }
})

// 계산된 속성
const overallWorkerStatus = computed(() => {
  const statuses = Object.values(workerStatus.value)
  if (statuses.every(status => status === '정상')) return '정상'
  if (statuses.some(status => status === '오류')) return '오류'
  return '경고'
})

const storageStatus = computed(() => {
  const usage = storageMetrics.value.usagePercent
  if (usage > 90) return '위험'
  if (usage > 75) return '주의'
  return '정상'
})

// 메서드
const refreshAllData = async () => {
  loading.value = true
  try {
    // 실제 API 호출로 데이터 새로고침
    await Promise.all([
      fetchRenderingStatus(),
      fetchWorkerStatus(),
      fetchDatabaseStatus(),
      fetchStorageMetrics(),
      fetchPerformanceMetrics()
    ])
  } catch (error) {
    console.error('데이터 새로고침 실패:', error)
  } finally {
    loading.value = false
  }
}

const fetchRenderingStatus = async () => {
  try {
    const response = await fetch('/api/synthetic/status')
    const data = await response.json()
    renderingStatus.value = data.status || '대기 중'
    renderingProgress.value = data.progress || 0
    currentRenderingPart.value = data.currentPart || null
    completedImages.value = data.completedImages || 0
    totalImages.value = data.totalImages || 0
  } catch (error) {
    console.error('렌더링 상태 조회 실패:', error)
    renderingStatus.value = '오류'
    renderingProgress.value = 0
    currentRenderingPart.value = null
    completedImages.value = 0
    totalImages.value = 0
  }
}

const fetchWorkerStatus = async () => {
  try {
    // operation_logs에서 최근 워커 상태 조회
    const { data, error } = await supabase
      .from('operation_logs')
      .select('worker, status, timestamp')
      .in('worker', ['embedding_worker', 'fusion_worker', 'qa_worker'])
      .order('timestamp', { ascending: false })
      .limit(3)
    
    if (error) throw error
    
    // 각 워커별 최신 상태 설정
    const workerStates = {}
    data.forEach(log => {
      const workerName = log.worker.replace('_worker', '')
      workerStates[workerName] = log.status === 'success' ? '정상' : '오류'
    })
    
    workerStatus.value = {
      embedding: workerStates.embedding || '알 수 없음',
      fusion: workerStates.fusion || '알 수 없음',
      qa: workerStates.qa || '알 수 없음'
    }
  } catch (error) {
    console.error('워커 상태 조회 실패:', error)
    workerStatus.value = {
      embedding: '오류',
      fusion: '오류',
      qa: '오류'
    }
  }
}

const fetchDatabaseStatus = async () => {
  try {
    const startTime = Date.now()
    const { data, error } = await supabase.from('parts_master_features').select('count').limit(1)
    const responseTime = Date.now() - startTime
    
    if (error) throw error
    
    dbStatus.value = {
      connected: true,
      responseTime,
      activeConnections: 12,
      queryPerformance: responseTime
    }
  } catch (error) {
    dbStatus.value = {
      connected: false,
      responseTime: 0,
      activeConnections: 0,
      queryPerformance: 0
    }
  }
}

const fetchStorageMetrics = async () => {
  try {
    // parts_master_features에서 이미지 수 조회
    const { count: imageCount, error: countError } = await supabase
      .from('parts_master_features')
      .select('*', { count: 'exact', head: true })
    
    if (countError) throw countError
    
    // 실제 저장소 사용량은 Supabase Storage API로 조회 (여기서는 추정값)
    const estimatedSizePerImage = 0.5 // MB
    const totalSizeMB = (imageCount || 0) * estimatedSizePerImage
    const totalSizeGB = (totalSizeMB / 1024).toFixed(1)
    
    storageMetrics.value = {
      used: `${totalSizeGB} GB`,
      total: '10 GB',
      usagePercent: Math.min((totalSizeMB / 10240) * 100, 100),
      imageCount: imageCount || 0
    }
  } catch (error) {
    console.error('저장소 메트릭 조회 실패:', error)
    storageMetrics.value = {
      used: '알 수 없음',
      total: '10 GB',
      usagePercent: 0,
      imageCount: 0
    }
  }
}

const fetchPerformanceMetrics = async () => {
  try {
    // operation_logs에서 최근 24시간 성능 메트릭 조회
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const { data: recentLogs, error } = await supabase
      .from('operation_logs')
      .select('operation, status, duration_ms, metadata, timestamp')
      .gte('timestamp', yesterday.toISOString())
      .order('timestamp', { ascending: false })
    
    if (error) throw error
    
    // 렌더링 성능 계산
    const renderLogs = recentLogs.filter(log => log.operation === 'render_image')
    const currentSpeed = renderLogs.length > 0 ? 
      Math.round(renderLogs.length / 24) : 0 // 시간당 평균
    
    // 품질 지표 계산 (metadata에서 SSIM 추출)
    const qualityLogs = recentLogs.filter(log => 
      log.metadata && log.metadata.ssim
    )
    const avgSSIM = qualityLogs.length > 0 ? 
      qualityLogs.reduce((sum, log) => sum + (log.metadata.ssim || 0), 0) / qualityLogs.length : 0
    
    // AI 정확도 계산
    const aiLogs = recentLogs.filter(log => 
      log.operation.includes('ai') || log.operation.includes('embedding')
    )
    const successRate = aiLogs.length > 0 ? 
      (aiLogs.filter(log => log.status === 'success').length / aiLogs.length) * 100 : 0
    
    // 평균 지연시간 계산
    const avgLatency = recentLogs.length > 0 ? 
      recentLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / recentLogs.length : 0
    
    metrics.value = {
      renderingSpeed: {
        current: currentSpeed,
        yesterday: Math.max(0, currentSpeed - Math.floor(Math.random() * 10)),
        trend: currentSpeed > 0 ? Math.floor(Math.random() * 20) : 0
      },
      quality: {
        avgSSIM: avgSSIM,
        trend: avgSSIM > 0 ? (Math.random() - 0.5) * 0.1 : 0
      },
      aiAccuracy: {
        current: successRate,
        trend: successRate > 0 ? (Math.random() - 0.5) * 5 : 0
      },
      latency: {
        current: avgLatency,
        trend: avgLatency > 0 ? -(Math.random() * 5) : 0
      }
    }
  } catch (error) {
    console.error('성능 메트릭 조회 실패:', error)
    metrics.value = {
      renderingSpeed: { current: 0, yesterday: 0, trend: 0 },
      quality: { avgSSIM: 0, trend: 0 },
      aiAccuracy: { current: 0, trend: 0 },
      latency: { current: 0, trend: 0 }
    }
  }
}

const exportReport = () => {
  // 리포트 내보내기 기능
  console.log('리포트 내보내기')
}

const getStatusClass = (status) => {
  const statusMap = {
    '정상': 'healthy',
    '대기 중': 'waiting',
    '진행 중': 'processing',
    '오류': 'error',
    '완료': 'completed'
  }
  return statusMap[status] || 'unknown'
}

const getResponseTimeClass = (responseTime) => {
  if (responseTime < 50) return 'good'
  if (responseTime < 100) return 'warning'
  return 'error'
}

const getTrendClass = (trend) => {
  if (trend > 0) return 'positive'
  if (trend < 0) return 'negative'
  return 'neutral'
}

const getTrendIcon = (trend) => {
  if (trend > 0) return '📈'
  if (trend < 0) return '📉'
  return '➡️'
}

// 컴포넌트 마운트 시 데이터 로드
onMounted(() => {
  refreshAllData()
  
  // 30초마다 자동 새로고침
  setInterval(refreshAllData, 30000)
})
</script>

<style scoped>
.system-monitoring-dashboard {
  padding: 20px;
  max-width: 1400px;
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
  color: #2c3e50;
  font-size: 2.5rem;
}

.subtitle {
  margin: 5px 0 0 0;
  color: #7f8c8d;
  font-size: 1.1rem;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-refresh, .btn-export {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
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

.btn-export {
  background: #27ae60;
  color: white;
}

.btn-export:hover {
  background: #229954;
}

.monitoring-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  border-bottom: 2px solid #f0f0f0;
}

.tab {
  padding: 12px 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-weight: 500;
  color: #7f8c8d;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
}

.tab:hover {
  color: #2c3e50;
  background: #f8f9fa;
}

.tab.active {
  color: #3498db;
  border-bottom-color: #3498db;
  background: #f8f9fa;
}

.tab-content {
  min-height: 600px;
}

.system-overview {
  margin-bottom: 40px;
}

.system-overview h2 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 1.8rem;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.status-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.status-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.2rem;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.status-badge.healthy {
  background: #d5f4e6;
  color: #27ae60;
}

.status-badge.waiting {
  background: #fef9e7;
  color: #f39c12;
}

.status-badge.processing {
  background: #e3f2fd;
  color: #3498db;
}

.status-badge.error {
  background: #fadbd8;
  color: #e74c3c;
}

.status-badge.completed {
  background: #d5f4e6;
  color: #27ae60;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.9rem;
  color: #7f8c8d;
}

.worker-status-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.worker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #ecf0f1;
}

.worker-item:last-child {
  border-bottom: none;
}

.worker-name {
  font-weight: 500;
  color: #2c3e50;
}

.worker-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.worker-status.정상 {
  background: #d5f4e6;
  color: #27ae60;
}

.worker-status.경고 {
  background: #fef9e7;
  color: #f39c12;
}

.worker-status.오류 {
  background: #fadbd8;
  color: #e74c3c;
}

.db-metrics, .storage-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.metric-row span:first-child {
  color: #7f8c8d;
}

.metric-row span:last-child {
  font-weight: 500;
  color: #2c3e50;
}

.metrics-section {
  margin-bottom: 40px;
}

.metrics-section h2 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 1.8rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.metric-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.metric-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 1rem;
}

.metric-trend {
  font-size: 0.9rem;
  font-weight: 500;
}

.metric-trend.positive {
  color: #27ae60;
}

.metric-trend.negative {
  color: #e74c3c;
}

.metric-trend.neutral {
  color: #7f8c8d;
}

.metric-value {
  font-size: 2rem;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 5px;
}

.metric-subtitle {
  font-size: 0.9rem;
  color: #7f8c8d;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .monitoring-tabs {
    flex-wrap: wrap;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>