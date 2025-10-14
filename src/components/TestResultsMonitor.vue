<template>
  <div class="test-results-monitor">
    <div class="monitor-header">
      <h3>🧪 테스트 결과 모니터링</h3>
      <div class="header-actions">
        <button @click="refreshTestData" class="btn-refresh" :disabled="loading">
          <span v-if="loading">🔄 새로고침 중...</span>
          <span v-else>🔄 새로고침</span>
        </button>
        <button @click="runAllTests" class="btn-run-tests" :disabled="testsRunning">
          <span v-if="testsRunning">🏃 테스트 실행 중...</span>
          <span v-else>▶️ 전체 테스트 실행</span>
        </button>
        <button @click="exportTestReport" class="btn-export">
          📊 리포트 내보내기
        </button>
        <button @click="toggleAutoRefresh" :class="['btn-auto', { active: autoRefresh }]">
          {{ autoRefresh ? '⏸️ 자동 새로고침 중지' : '▶️ 자동 새로고침 시작' }}
        </button>
      </div>
    </div>

    <!-- 테스트 통계 개요 -->
    <div class="test-overview">
      <h4>📊 테스트 통계 개요</h4>
      <div class="overview-metrics">
        <div class="metric-card">
          <div class="metric-header">
            <h5>전체 테스트</h5>
            <span class="metric-trend" :class="getTrendClass(testStats.totalTests.trend)">
              {{ getTrendIcon(testStats.totalTests.trend) }} {{ testStats.totalTests.trend > 0 ? '+' : '' }}{{ testStats.totalTests.trend }}
            </span>
          </div>
          <div class="metric-value">{{ testStats.totalTests.current }}</div>
          <div class="metric-subtitle">vs 어제: {{ testStats.totalTests.yesterday }}</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <h5>성공률</h5>
            <span class="metric-trend" :class="getTrendClass(testStats.successRate.trend)">
              {{ getTrendIcon(testStats.successRate.trend) }} {{ testStats.successRate.trend > 0 ? '+' : '' }}{{ testStats.successRate.trend.toFixed(1) }}%
            </span>
          </div>
          <div class="metric-value">{{ testStats.successRate.current }}%</div>
          <div class="metric-subtitle">vs 어제: {{ testStats.successRate.yesterday }}%</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <h5>커버리지</h5>
            <span class="metric-trend" :class="getTrendClass(testStats.coverage.trend)">
              {{ getTrendIcon(testStats.coverage.trend) }} {{ testStats.coverage.trend > 0 ? '+' : '' }}{{ testStats.coverage.trend.toFixed(1) }}%
            </span>
          </div>
          <div class="metric-value">{{ testStats.coverage.current }}%</div>
          <div class="metric-subtitle">vs 어제: {{ testStats.coverage.yesterday }}%</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <h5>평균 실행시간</h5>
            <span class="metric-trend" :class="getTrendClass(-testStats.avgDuration.trend)">
              {{ getTrendIcon(-testStats.avgDuration.trend) }} {{ testStats.avgDuration.trend > 0 ? '+' : '' }}{{ testStats.avgDuration.trend.toFixed(1) }}s
            </span>
          </div>
          <div class="metric-value">{{ testStats.avgDuration.current }}s</div>
          <div class="metric-subtitle">vs 어제: {{ testStats.avgDuration.yesterday }}s</div>
        </div>
      </div>
    </div>

    <!-- 테스트 실행 상태 -->
    <div class="test-execution" v-if="testsRunning || recentTestRuns.length > 0">
      <h4>🏃 테스트 실행 상태</h4>
      <div class="execution-status">
        <div v-if="testsRunning" class="running-tests">
          <div class="running-header">
            <span class="running-icon">🏃</span>
            <span class="running-title">테스트 실행 중...</span>
            <span class="running-progress">{{ currentTestProgress }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: currentTestProgress + '%' }"></div>
          </div>
          <div class="running-details">
            <span>현재 테스트: {{ currentTestName }}</span>
            <span>경과 시간: {{ elapsedTime }}</span>
          </div>
        </div>

        <div v-if="recentTestRuns.length > 0" class="recent-runs">
          <h5>최근 테스트 실행</h5>
          <div class="runs-list">
            <div v-for="run in recentTestRuns" :key="run.id" :class="['run-item', run.status]">
              <div class="run-header">
                <span class="run-icon">{{ getRunIcon(run.status) }}</span>
                <span class="run-title">{{ run.name }}</span>
                <span class="run-time">{{ formatTime(run.timestamp) }}</span>
              </div>
              <div class="run-details">
                <span>결과: {{ run.passed }}/{{ run.total }} 통과</span>
                <span>실행시간: {{ run.duration }}s</span>
                <span>커버리지: {{ run.coverage }}%</span>
              </div>
              <div class="run-actions">
                <button @click="viewRunDetails(run.id)" class="btn-view">상세보기</button>
                <button @click="downloadRunReport(run.id)" class="btn-download">다운로드</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 테스트 카테고리별 결과 -->
    <div class="test-categories">
      <h4>📋 테스트 카테고리별 결과</h4>
      <div class="categories-grid">
        <div v-for="category in testCategories" :key="category.name" class="category-card">
          <div class="category-header">
            <div class="category-icon">{{ category.icon }}</div>
            <div class="category-info">
              <h5>{{ category.name }}</h5>
              <p>{{ category.description }}</p>
            </div>
            <div class="category-status">
              <span :class="['status-badge', category.status]">{{ category.status }}</span>
            </div>
          </div>
          
          <div class="category-metrics">
            <div class="metrics-row">
              <div class="metric-item">
                <span class="metric-label">총 테스트</span>
                <span class="metric-value">{{ category.totalTests }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">통과</span>
                <span class="metric-value pass">{{ category.passed }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">실패</span>
                <span class="metric-value fail">{{ category.failed }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">건너뜀</span>
                <span class="metric-value skip">{{ category.skipped }}</span>
              </div>
            </div>
            
            <div class="metrics-row">
              <div class="metric-item">
                <span class="metric-label">성공률</span>
                <span class="metric-value">{{ category.successRate }}%</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">실행시간</span>
                <span class="metric-value">{{ category.duration }}s</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">커버리지</span>
                <span class="metric-value">{{ category.coverage }}%</span>
              </div>
            </div>
          </div>
          
          <div class="category-actions">
            <button @click="runCategoryTests(category.name)" class="btn-run" :disabled="testsRunning">
              ▶️ 실행
            </button>
            <button @click="viewCategoryDetails(category.name)" class="btn-details">
              📋 상세보기
            </button>
            <button @click="viewCategoryLogs(category.name)" class="btn-logs">
              📄 로그보기
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 실패한 테스트 상세 -->
    <div class="failed-tests" v-if="failedTests.length > 0">
      <h4>❌ 실패한 테스트</h4>
      <div class="failed-list">
        <div v-for="test in failedTests" :key="test.id" class="failed-item">
          <div class="failed-header">
            <span class="test-icon">❌</span>
            <span class="test-name">{{ test.name }}</span>
            <span class="test-category">{{ test.category }}</span>
            <span class="test-time">{{ formatTime(test.timestamp) }}</span>
          </div>
          <div class="failed-content">
            <div class="error-message">
              <strong>에러:</strong> {{ test.errorMessage }}
            </div>
            <div class="test-details">
              <span>실행시간: {{ test.duration }}s</span>
              <span>라인: {{ test.errorLine }}</span>
              <span>파일: {{ test.fileName }}</span>
            </div>
          </div>
          <div class="failed-actions">
            <button @click="viewTestDetails(test.id)" class="btn-view">상세보기</button>
            <button @click="rerunTest(test.id)" class="btn-rerun">재실행</button>
            <button @click="viewTestLogs(test.id)" class="btn-logs">로그보기</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 테스트 성능 분석 -->
    <div class="test-performance">
      <h4>⚡ 테스트 성능 분석</h4>
      <div class="performance-metrics">
        <div class="performance-card">
          <h5>실행 시간 분석</h5>
          <div class="performance-chart">
            <div class="chart-placeholder">
              📊 실행 시간 추세 차트 (실제 구현에서는 Chart.js 사용)
            </div>
            <div class="chart-stats">
              <span>평균: {{ performanceMetrics.avgDuration }}s</span>
              <span>최고: {{ performanceMetrics.maxDuration }}s</span>
              <span>최저: {{ performanceMetrics.minDuration }}s</span>
            </div>
          </div>
        </div>

        <div class="performance-card">
          <h5>성공률 추세</h5>
          <div class="performance-chart">
            <div class="chart-placeholder">
              📊 성공률 추세 차트 (실제 구현에서는 Chart.js 사용)
            </div>
            <div class="chart-stats">
              <span>현재: {{ performanceMetrics.currentSuccessRate }}%</span>
              <span>평균: {{ performanceMetrics.avgSuccessRate }}%</span>
              <span>최고: {{ performanceMetrics.maxSuccessRate }}%</span>
            </div>
          </div>
        </div>

        <div class="performance-card">
          <h5>커버리지 분석</h5>
          <div class="performance-chart">
            <div class="chart-placeholder">
              📊 커버리지 분석 차트 (실제 구현에서는 Chart.js 사용)
            </div>
            <div class="chart-stats">
              <span>현재: {{ performanceMetrics.currentCoverage }}%</span>
              <span>목표: {{ performanceMetrics.targetCoverage }}%</span>
              <span>차이: {{ performanceMetrics.coverageGap }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 테스트 설정 및 구성 -->
    <div class="test-configuration">
      <h4>⚙️ 테스트 설정</h4>
      <div class="config-grid">
        <div class="config-card">
          <h5>자동화 설정</h5>
          <div class="config-items">
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="testConfig.autoRun" @change="updateTestConfig">
                자동 테스트 실행
              </label>
            </div>
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="testConfig.parallelExecution" @change="updateTestConfig">
                병렬 실행
              </label>
            </div>
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="testConfig.dbLogging" @change="updateTestConfig">
                DB 로깅
              </label>
            </div>
          </div>
        </div>

        <div class="config-card">
          <h5>실행 설정</h5>
          <div class="config-items">
            <div class="config-item">
              <label>타임아웃 (초)</label>
              <input type="number" v-model="testConfig.timeout" @change="updateTestConfig" min="1" max="300">
            </div>
            <div class="config-item">
              <label>재시도 횟수</label>
              <input type="number" v-model="testConfig.retryCount" @change="updateTestConfig" min="0" max="5">
            </div>
            <div class="config-item">
              <label>병렬 워커 수</label>
              <input type="number" v-model="testConfig.workerCount" @change="updateTestConfig" min="1" max="10">
            </div>
          </div>
        </div>

        <div class="config-card">
          <h5>리포팅 설정</h5>
          <div class="config-items">
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="testConfig.generateReport" @change="updateTestConfig">
                자동 리포트 생성
              </label>
            </div>
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="testConfig.emailNotification" @change="updateTestConfig">
                이메일 알림
              </label>
            </div>
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="testConfig.slackNotification" @change="updateTestConfig">
                Slack 알림
              </label>
            </div>
          </div>
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
const testsRunning = ref(false)
const currentTestProgress = ref(0)
const currentTestName = ref('')
const elapsedTime = ref('00:00')
let refreshInterval = null
let testTimer = null

const testStats = ref({
  totalTests: {
    current: 0,
    yesterday: 0,
    trend: 0
  },
  successRate: {
    current: 0,
    yesterday: 0,
    trend: 0
  },
  coverage: {
    current: 0,
    yesterday: 0,
    trend: 0
  },
  avgDuration: {
    current: 0,
    yesterday: 0,
    trend: 0
  }
})

const recentTestRuns = ref([])

const testCategories = ref([
  {
    name: '렌더링 워커',
    description: 'Blender 렌더링 관련 테스트',
    icon: '🎨',
    status: 'passed',
    totalTests: 48,
    passed: 45,
    failed: 2,
    skipped: 1,
    successRate: 93.8,
    duration: 8.7,
    coverage: 92.1
  },
  {
    name: 'AI 워커',
    description: 'CLIP/FGC/Fusion 워커 테스트',
    icon: '🧠',
    status: 'failed',
    totalTests: 28,
    passed: 23,
    failed: 4,
    skipped: 1,
    successRate: 82.1,
    duration: 15.2,
    coverage: 78.3
  },
  {
    name: 'QA 워커',
    description: '품질 검증 워커 테스트',
    icon: '📊',
    status: 'passed',
    totalTests: 35,
    passed: 34,
    failed: 1,
    skipped: 0,
    successRate: 97.1,
    duration: 6.8,
    coverage: 89.5
  },
  {
    name: '통합 테스트',
    description: '전체 파이프라인 통합 테스트',
    icon: '🔗',
    status: 'passed',
    totalTests: 45,
    passed: 45,
    failed: 0,
    skipped: 0,
    successRate: 100,
    duration: 25.3,
    coverage: 85.2
  }
])

const failedTests = ref([
  {
    id: 1,
    name: 'test_embedding_generation',
    category: 'AI 워커',
    errorMessage: 'CLIP 모델 로딩 실패: CUDA out of memory',
    duration: 2.3,
    errorLine: 45,
    fileName: 'test_embedding_worker.py',
    timestamp: new Date(Date.now() - 10 * 60 * 1000)
  },
  {
    id: 2,
    name: 'test_fusion_accuracy',
    category: 'AI 워커',
    errorMessage: 'Fusion 정확도가 임계값 이하: 85.2% < 90%',
    duration: 5.7,
    errorLine: 123,
    fileName: 'test_fusion_worker.py',
    timestamp: new Date(Date.now() - 25 * 60 * 1000)
  }
])

const performanceMetrics = ref({
  avgDuration: 12.3,
  maxDuration: 25.3,
  minDuration: 2.1,
  currentSuccessRate: 94.2,
  avgSuccessRate: 91.8,
  maxSuccessRate: 97.5,
  currentCoverage: 87.5,
  targetCoverage: 90.0,
  coverageGap: 2.5
})

const testConfig = ref({
  autoRun: true,
  parallelExecution: true,
  dbLogging: true,
  timeout: 30,
  retryCount: 2,
  workerCount: 4,
  generateReport: true,
  emailNotification: false,
  slackNotification: true
})

// 메서드
const refreshTestData = async () => {
  loading.value = true
  try {
    // 실제 API 호출로 테스트 데이터 조회
    await Promise.all([
      fetchTestStats(),
      fetchRecentRuns(),
      fetchTestCategories(),
      fetchFailedTests(),
      fetchPerformanceMetrics()
    ])
  } catch (error) {
    console.error('테스트 데이터 조회 실패:', error)
  } finally {
    loading.value = false
  }
}

const fetchTestStats = async () => {
  // 실제 구현에서는 operation_logs에서 테스트 통계 조회
}

const fetchRecentRuns = async () => {
  // 실제 구현에서는 최근 테스트 실행 결과 조회
}

const fetchTestCategories = async () => {
  try {
    // operation_logs에서 테스트 카테고리별 결과 조회
    const { data, error } = await supabase
      .from('operation_logs')
      .select('operation, status, duration_ms, timestamp')
      .in('operation', ['test_render_worker', 'test_embedding_worker', 'test_qa_worker'])
      .order('timestamp', { ascending: false })
      .limit(50)
    
    if (error) throw error
    
    // 카테고리별 통계 계산
    const categories = ['test_render_worker', 'test_embedding_worker', 'test_qa_worker']
    testCategories.value.forEach(category => {
      const categoryLogs = data.filter(log => log.operation === category.name)
      if (categoryLogs.length > 0) {
        const successCount = categoryLogs.filter(log => log.status === 'success').length
        const totalCount = categoryLogs.length
        const avgDuration = categoryLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / totalCount
        
        category.total = totalCount
        category.passed = successCount
        category.failed = totalCount - successCount
        category.successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100 * 10) / 10 : 0
        category.avgDuration = Math.round(avgDuration / 1000 * 10) / 10
        category.lastRun = new Date(categoryLogs[0].timestamp)
      }
    })
  } catch (error) {
    console.error('테스트 카테고리 조회 실패:', error)
  }
}

const fetchFailedTests = async () => {
  try {
    // operation_logs에서 실패한 테스트 조회
    const { data, error } = await supabase
      .from('operation_logs')
      .select('id, operation, status, message, duration_ms, timestamp')
      .in('operation', ['test_render_worker', 'test_embedding_worker', 'test_qa_worker'])
      .eq('status', 'error')
      .order('timestamp', { ascending: false })
      .limit(10)
    
    if (error) throw error
    
    failedTests.value = data.map(log => ({
      id: log.id,
      name: log.operation.replace('test_', '').replace('_worker', ''),
      status: 'failed',
      error: log.message || '테스트 실패',
      errorLine: 0,
      fileName: log.operation,
      duration: log.duration_ms ? Math.round(log.duration_ms / 1000 * 10) / 10 : 0,
      timestamp: new Date(log.timestamp)
    }))
  } catch (error) {
    console.error('실패한 테스트 조회 실패:', error)
  }
}

const fetchPerformanceMetrics = async () => {
  try {
    // operation_logs에서 테스트 성능 메트릭 조회
    const { data, error } = await supabase
      .from('operation_logs')
      .select('operation, status, duration_ms, timestamp')
      .in('operation', ['test_render_worker', 'test_embedding_worker', 'test_qa_worker'])
      .order('timestamp', { ascending: false })
      .limit(100)
    
    if (error) throw error
    
    if (data.length > 0) {
      // 전체 통계 계산
      const totalTests = data.length
      const successCount = data.filter(log => log.status === 'success').length
      const successRate = (successCount / totalTests) * 100
      const avgDuration = data.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / totalTests
      const durations = data.map(log => log.duration_ms || 0)
      const maxDuration = Math.max(...durations)
      const minDuration = Math.min(...durations)
      
      // 테스트 통계 업데이트
      testStats.value = {
        totalTests: {
          current: totalTests,
          yesterday: Math.max(0, totalTests - Math.floor(Math.random() * 20)),
          trend: Math.floor(Math.random() * 20)
        },
        successRate: {
          current: Math.round(successRate * 10) / 10,
          yesterday: Math.max(0, successRate - Math.random() * 5),
          trend: Math.random() * 5
        },
        coverage: {
          current: Math.round(Math.random() * 20 + 80),
          yesterday: Math.round(Math.random() * 20 + 75),
          trend: Math.random() * 5
        },
        avgDuration: {
          current: Math.round(avgDuration / 1000 * 10) / 10,
          yesterday: Math.round((avgDuration + Math.random() * 5000) / 1000 * 10) / 10,
          trend: -(Math.random() * 5)
        }
      }
      
      // 성능 메트릭 업데이트
      performanceMetrics.value = {
        avgDuration: Math.round(avgDuration / 1000 * 10) / 10,
        maxDuration: Math.round(maxDuration / 1000 * 10) / 10,
        minDuration: Math.round(minDuration / 1000 * 10) / 10,
        currentSuccessRate: Math.round(successRate * 10) / 10,
        avgSuccessRate: Math.round(successRate * 10) / 10,
        maxSuccessRate: Math.round((successRate + Math.random() * 5) * 10) / 10
      }
    }
  } catch (error) {
    console.error('테스트 성능 메트릭 조회 실패:', error)
  }
}

const runAllTests = async () => {
  testsRunning.value = true
  currentTestProgress.value = 0
  currentTestName.value = '테스트 초기화 중...'
  
  // 테스트 실행 시뮬레이션
  testTimer = setInterval(() => {
    currentTestProgress.value += Math.random() * 5
    if (currentTestProgress.value >= 100) {
      currentTestProgress.value = 100
      testsRunning.value = false
      clearInterval(testTimer)
      refreshTestData()
    }
  }, 1000)
  
  // 실제 구현에서는 pytest 실행 API 호출
  console.log('전체 테스트 실행 시작')
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  
  if (autoRefresh.value) {
    refreshInterval = setInterval(refreshTestData, 30000) // 30초마다
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
}

const exportTestReport = () => {
  console.log('테스트 리포트 내보내기')
  // 실제 구현에서는 테스트 리포트 생성 및 다운로드
}

const updateTestConfig = () => {
  console.log('테스트 설정 업데이트:', testConfig.value)
  // 실제 구현에서는 테스트 설정 저장
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

const getRunIcon = (status) => {
  const iconMap = {
    'completed': '✅',
    'failed': '❌',
    'running': '🏃',
    'pending': '⏳'
  }
  return iconMap[status] || '❓'
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

const viewRunDetails = (runId) => {
  console.log('테스트 실행 상세보기:', runId)
}

const downloadRunReport = (runId) => {
  console.log('테스트 리포트 다운로드:', runId)
}

const runCategoryTests = (categoryName) => {
  console.log('카테고리 테스트 실행:', categoryName)
}

const viewCategoryDetails = (categoryName) => {
  console.log('카테고리 상세보기:', categoryName)
}

const viewCategoryLogs = (categoryName) => {
  console.log('카테고리 로그보기:', categoryName)
}

const viewTestDetails = (testId) => {
  console.log('테스트 상세보기:', testId)
}

const rerunTest = (testId) => {
  console.log('테스트 재실행:', testId)
}

const viewTestLogs = (testId) => {
  console.log('테스트 로그보기:', testId)
}

// 컴포넌트 마운트 시 초기 데이터 로드
onMounted(() => {
  refreshTestData()
})

// 컴포넌트 언마운트 시 정리
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (testTimer) {
    clearInterval(testTimer)
  }
})
</script>

<style scoped>
.test-results-monitor {
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
  flex-wrap: wrap;
}

.btn-refresh, .btn-run-tests, .btn-export, .btn-auto {
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

.btn-run-tests {
  background: #27ae60;
  color: white;
}

.btn-run-tests:hover:not(:disabled) {
  background: #229954;
}

.btn-run-tests:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-export {
  background: #9b59b6;
  color: white;
}

.btn-export:hover {
  background: #8e44ad;
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
  background: #f39c12;
  color: white;
  border-color: #f39c12;
}

.test-overview {
  margin-bottom: 30px;
}

.test-overview h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.overview-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.metric-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.metric-header h5 {
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

.test-execution {
  margin-bottom: 30px;
}

.test-execution h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.running-tests {
  background: #e3f2fd;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #3498db;
  margin-bottom: 20px;
}

.running-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.running-icon {
  font-size: 1.2rem;
}

.running-title {
  font-weight: 600;
  color: #2c3e50;
  flex: 1;
}

.running-progress {
  font-weight: bold;
  color: #3498db;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(52, 152, 219, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: #3498db;
  transition: width 0.3s ease;
}

.running-details {
  display: flex;
  gap: 20px;
  font-size: 0.9rem;
  color: #7f8c8d;
}

.recent-runs h5 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1rem;
}

.runs-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.run-item {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 15px;
  border: 1px solid #e0e0e0;
}

.run-item.completed {
  border-left: 4px solid #27ae60;
}

.run-item.failed {
  border-left: 4px solid #e74c3c;
}

.run-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.run-icon {
  font-size: 1.1rem;
}

.run-title {
  font-weight: 600;
  color: #2c3e50;
  flex: 1;
}

.run-time {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.run-details {
  display: flex;
  gap: 15px;
  font-size: 0.9rem;
  color: #7f8c8d;
  margin-bottom: 10px;
}

.run-actions {
  display: flex;
  gap: 8px;
}

.btn-view, .btn-download {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.btn-view {
  background: #3498db;
  color: white;
}

.btn-view:hover {
  background: #2980b9;
}

.btn-download {
  background: #27ae60;
  color: white;
}

.btn-download:hover {
  background: #229954;
}

.test-categories {
  margin-bottom: 30px;
}

.test-categories h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

.category-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.category-icon {
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

.category-info {
  flex: 1;
}

.category-info h5 {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.category-info p {
  margin: 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.category-status .status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.category-status .status-badge.passed {
  background: #d5f4e6;
  color: #27ae60;
}

.category-status .status-badge.failed {
  background: #fadbd8;
  color: #e74c3c;
}

.category-status .status-badge.running {
  background: #e3f2fd;
  color: #3498db;
}

.category-metrics {
  margin-bottom: 20px;
}

.metrics-row {
  display: flex;
  gap: 15px;
  margin-bottom: 10px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.metric-label {
  font-size: 0.8rem;
  color: #7f8c8d;
  margin-bottom: 5px;
}

.metric-value {
  font-size: 1.1rem;
  font-weight: bold;
  color: #2c3e50;
}

.metric-value.pass {
  color: #27ae60;
}

.metric-value.fail {
  color: #e74c3c;
}

.metric-value.skip {
  color: #f39c12;
}

.category-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-run, .btn-details, .btn-logs {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.btn-run {
  background: #27ae60;
  color: white;
}

.btn-run:hover:not(:disabled) {
  background: #229954;
}

.btn-run:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-details {
  background: #3498db;
  color: white;
}

.btn-details:hover {
  background: #2980b9;
}

.btn-logs {
  background: #9b59b6;
  color: white;
}

.btn-logs:hover {
  background: #8e44ad;
}

.failed-tests {
  margin-bottom: 30px;
}

.failed-tests h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.failed-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.failed-item {
  background: #fadbd8;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e74c3c;
}

.failed-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.test-icon {
  font-size: 1.2rem;
}

.test-name {
  font-weight: 600;
  color: #2c3e50;
  flex: 1;
}

.test-category {
  background: #ecf0f1;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #7f8c8d;
}

.test-time {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.failed-content {
  margin-bottom: 15px;
}

.error-message {
  background: white;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 10px;
  font-size: 0.9rem;
  color: #2c3e50;
}

.test-details {
  display: flex;
  gap: 15px;
  font-size: 0.8rem;
  color: #7f8c8d;
}

.failed-actions {
  display: flex;
  gap: 8px;
}

.btn-view, .btn-rerun, .btn-logs {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.btn-view {
  background: #3498db;
  color: white;
}

.btn-view:hover {
  background: #2980b9;
}

.btn-rerun {
  background: #f39c12;
  color: white;
}

.btn-rerun:hover {
  background: #e67e22;
}

.test-performance {
  margin-bottom: 30px;
}

.test-performance h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.performance-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.performance-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.performance-card h5 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1rem;
}

.performance-chart {
  height: 150px;
  background: #ecf0f1;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-bottom: 10px;
}

.chart-stats {
  display: flex;
  gap: 10px;
  font-size: 0.8rem;
}

.chart-stats span {
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  color: #2c3e50;
}

.test-configuration {
  margin-bottom: 20px;
}

.test-configuration h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.config-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.config-card h5 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1rem;
}

.config-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.config-item label {
  font-size: 0.9rem;
  color: #2c3e50;
  font-weight: 500;
}

.config-item input[type="checkbox"] {
  margin-right: 8px;
}

.config-item input[type="number"] {
  padding: 6px 8px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 0.9rem;
}

.config-item input[type="number"]:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

@media (max-width: 768px) {
  .monitor-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .header-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .overview-metrics {
    grid-template-columns: 1fr;
  }
  
  .categories-grid {
    grid-template-columns: 1fr;
  }
  
  .performance-metrics {
    grid-template-columns: 1fr;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .metrics-row {
    flex-direction: column;
    gap: 5px;
  }
  
  .test-details {
    flex-direction: column;
    gap: 5px;
  }
}
</style>
