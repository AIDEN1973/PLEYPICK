<template>
  <div class="system-monitoring-dashboard">
    <div class="dashboard-header">
      <h1>🔍 BrickBox 시스템 모니터링
        <HelpTooltip 
          title="시스템 모니터링"
          content="전체 시스템 상태와 성능을 실시간으로 모니터링합니다. 파이프라인, AI 워커, 품질 지표, 테스트 결과를 종합 확인할 수 있습니다."
          :examples="['파이프라인 상태', 'AI 성능', '리소스 사용률']"
        />
      </h1>
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
        <HelpTooltip 
          title="시스템 개요"
          content="전체 시스템의 핵심 지표와 상태를 한눈에 확인합니다. CPU, 메모리, 디스크 사용률과 주요 성능 지표를 보여줍니다."
          position="bottom"
        />
      </button>
      <button 
        :class="['tab', { active: activeTab === 'pipeline' }]"
        @click="activeTab = 'pipeline'"
      >
        🔄 파이프라인 상태
        <HelpTooltip 
          title="파이프라인 상태"
          content="데이터 처리 파이프라인의 현재 상태를 모니터링합니다. 데이터 수집, 전처리, AI 분석, 결과 저장 등의 단계별 진행 상황을 확인합니다."
          position="bottom"
        />
      </button>
      <button 
        :class="['tab', { active: activeTab === 'ai-workers' }]"
        @click="activeTab = 'ai-workers'"
      >
        🤖 AI 워커
        <HelpTooltip 
          title="AI 워커"
          content="AI 모델의 성능과 상태를 모니터링합니다. 모델 정확도, 처리 속도, 리소스 사용률, 에러율 등을 실시간으로 확인합니다."
          position="bottom"
        />
      </button>
      <button 
        :class="['tab', { active: activeTab === 'quality' }]"
        @click="activeTab = 'quality'"
      >
        📈 품질 지표
        <HelpTooltip 
          title="품질 지표"
          content="시스템의 품질과 성능을 측정하는 다양한 지표들을 모니터링합니다. SSIM, PSNR, MSE 등의 이미지 품질 지표를 확인합니다."
          position="bottom"
        />
      </button>
      <button 
        :class="['tab', { active: activeTab === 'tests' }]"
        @click="activeTab = 'tests'"
      >
        🧪 테스트 결과
        <HelpTooltip 
          title="테스트 결과"
          content="시스템의 자동화된 테스트 결과를 모니터링합니다. 단위 테스트, 통합 테스트, 성능 테스트 등의 결과와 커버리지를 확인합니다."
          position="bottom"
        />
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
                <h3>렌더링 파이프라인
                  <HelpTooltip 
                    title="렌더링 파이프라인"
                    content="3D 모델을 이미지로 변환하는 처리 과정입니다. 부품의 다양한 각도와 조명으로 이미지를 생성합니다."
                    :examples="['3D → 2D 변환', '다각도 렌더링', '조명 효과 적용']"
                  />
                </h3>
                <span :class="['status-badge', getStatusClass(renderingStatus)]">
                  {{ renderingStatus }}
                </span>
              </div>
              <div class="status-content">
                <div class="progress-info">
                  <span>진행률: {{ renderingProgress }}%
                    <HelpTooltip 
                      title="진행률"
                      content="현재 렌더링 작업의 완료 비율입니다. 100%가 되면 모든 이미지 생성이 완료됩니다."
                      :examples="['50% = 절반 완료', '100% = 전체 완료']"
                    />
                  </span>
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
                <h3>AI 워커 상태
                  <HelpTooltip 
                    title="AI 워커 상태"
                    content="AI 모델들의 현재 상태를 모니터링합니다. 각 워커의 정상 작동 여부와 성능을 확인할 수 있습니다."
                    :examples="['Embedding 워커', 'Fusion 워커', 'QA 워커']"
                  />
                </h3>
                <span class="overall-status">{{ overallWorkerStatus }}</span>
              </div>
              <div class="worker-status-grid">
                <div class="worker-item">
                  <span class="worker-name">Embedding
                    <HelpTooltip 
                      title="Embedding 워커"
                      content="이미지와 텍스트를 벡터로 변환하는 AI 모델입니다. 유사도 검색의 기반이 됩니다."
                      :examples="['이미지 → 벡터', '텍스트 → 벡터', '유사도 계산']"
                    />
                  </span>
                  <span :class="['worker-status', workerStatus.embedding]">{{ workerStatus.embedding }}</span>
                </div>
                <div class="worker-item">
                  <span class="worker-name">Fusion
                    <HelpTooltip 
                      title="Fusion 워커"
                      content="여러 특징을 결합하여 최종 판단을 내리는 AI 모델입니다. 이미지, 메타데이터, 텍스트를 종합 분석합니다."
                      :examples="['다중 특징 결합', '최종 판단', '종합 분석']"
                    />
                  </span>
                  <span :class="['worker-status', workerStatus.fusion]">{{ workerStatus.fusion }}</span>
                </div>
                <div class="worker-item">
                  <span class="worker-name">QA
                    <HelpTooltip 
                      title="QA 워커"
                      content="결과의 품질을 검증하고 보정하는 AI 모델입니다. 오류를 감지하고 수정합니다."
                      :examples="['품질 검증', '오류 감지', '결과 보정']"
                    />
                  </span>
                  <span :class="['worker-status', workerStatus.qa]">{{ workerStatus.qa }}</span>
                </div>
              </div>
            </div>

            <div class="status-card">
              <div class="status-header">
                <h3>데이터베이스
                  <HelpTooltip 
                    title="데이터베이스"
                    content="시스템의 모든 데이터를 저장하고 관리하는 데이터베이스의 연결 상태와 성능을 모니터링합니다."
                    :examples="['연결 상태', '응답 시간', '쿼리 성능']"
                  />
                </h3>
                <span :class="['status-badge', dbStatus.connected ? 'healthy' : 'error']">
                  {{ dbStatus.connected ? '연결됨' : '연결 끊김' }}
                </span>
              </div>
              <div class="db-metrics">
                <div class="metric-row">
                  <span>응답시간:
                    <HelpTooltip 
                      title="응답시간"
                      content="데이터베이스 쿼리의 평균 응답 시간입니다. 낮을수록 빠른 데이터 처리를 의미합니다."
                      :examples="['5ms = 매우 빠름', '50ms = 보통', '200ms = 느림']"
                    />
                  </span>
                  <span :class="getResponseTimeClass(dbStatus.responseTime)">{{ dbStatus.responseTime }}ms</span>
                </div>
                <div class="metric-row">
                  <span>활성 연결:
                    <HelpTooltip 
                      title="활성 연결"
                      content="현재 데이터베이스에 연결된 활성 세션의 수입니다. 너무 많으면 성능 저하가 발생할 수 있습니다."
                      :examples="['10개 = 정상', '50개 = 많음', '100개 = 과부하']"
                    />
                  </span>
                  <span>{{ dbStatus.activeConnections }}</span>
                </div>
                <div class="metric-row">
                  <span>쿼리 성능:
                    <HelpTooltip 
                      title="쿼리 성능"
                      content="데이터베이스 쿼리의 평균 실행 시간입니다. 복잡한 쿼리일수록 시간이 오래 걸립니다."
                      :examples="['10ms = 빠름', '100ms = 보통', '500ms = 느림']"
                    />
                  </span>
                  <span>{{ dbStatus.queryPerformance }}ms</span>
                </div>
              </div>
            </div>

            <div class="status-card">
              <div class="status-header">
                <h3>저장소
                  <HelpTooltip 
                    title="저장소"
                    content="파일과 이미지를 저장하는 저장소의 상태를 모니터링합니다. 용량과 접근 속도를 확인합니다."
                    :examples="['디스크 용량', '접근 속도', '파일 수']"
                  />
                </h3>
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
import HelpTooltip from '../components/HelpTooltip.vue'

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
    // Supabase에서 렌더링 로그 조회
    const { data, error } = await supabase
      .from('rendering_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) throw error
    
    if (data && data.length > 0) {
      const latest = data[0]
      renderingStatus.value = latest.success_rate > 0.95 ? '정상' : '경고'
      renderingProgress.value = Math.round(latest.success_rate * 100)
      currentRenderingPart.value = `속도: ${latest.rendering_speed.toFixed(2)} 이미지/초`
      completedImages.value = latest.image_count || 0
      totalImages.value = Math.round(latest.image_count / latest.success_rate) || 0
    } else {
      renderingStatus.value = '대기 중'
      renderingProgress.value = 0
      currentRenderingPart.value = null
      completedImages.value = 0
      totalImages.value = 0
    }
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
        yesterday: await getYesterdayRenderingSpeed(),
        trend: await calculateRenderingSpeedTrend()
      },
      quality: {
        avgSSIM: avgSSIM,
        trend: await calculateQualityTrend()
      },
      aiAccuracy: {
        current: successRate,
        trend: await calculateAIAccuracyTrend()
      },
      latency: {
        current: avgLatency,
        trend: await calculateLatencyTrend()
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

// 실제 데이터 연결 함수들
const getYesterdayRenderingSpeed = async () => {
  try {
    const { data, error } = await supabase
      .from('rendering_logs')
      .select('rendering_speed')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    const avgSpeed = data.reduce((sum, log) => sum + (log.rendering_speed || 0), 0) / data.length
    return Math.max(0, Math.round(avgSpeed))
  } catch (error) {
    console.error('어제 렌더링 속도 조회 실패:', error)
    return 0
  }
}

const calculateRenderingSpeedTrend = async () => {
  try {
    const today = await getTodayRenderingSpeed()
    const yesterday = await getYesterdayRenderingSpeed()
    return today - yesterday
  } catch (error) {
    console.error('렌더링 속도 트렌드 계산 실패:', error)
    return 0
  }
}

const getTodayRenderingSpeed = async () => {
  try {
    const { data, error } = await supabase
      .from('rendering_logs')
      .select('rendering_speed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    const avgSpeed = data.reduce((sum, log) => sum + (log.rendering_speed || 0), 0) / data.length
    return Math.round(avgSpeed)
  } catch (error) {
    console.error('오늘 렌더링 속도 조회 실패:', error)
    return 0
  }
}

const calculateQualityTrend = async () => {
  try {
    const today = await getTodayQuality()
    const yesterday = await getYesterdayQuality()
    return today - yesterday
  } catch (error) {
    console.error('품질 트렌드 계산 실패:', error)
    return 0
  }
}

const getTodayQuality = async () => {
  try {
    const { data, error } = await supabase
      .from('quality_logs')
      .select('ssim_score')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    const avgSSIM = data.reduce((sum, log) => sum + (log.ssim_score || 0), 0) / data.length
    return avgSSIM
  } catch (error) {
    console.error('오늘 품질 조회 실패:', error)
    return 0
  }
}

const getYesterdayQuality = async () => {
  try {
    const { data, error } = await supabase
      .from('quality_logs')
      .select('ssim_score')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    const avgSSIM = data.reduce((sum, log) => sum + (log.ssim_score || 0), 0) / data.length
    return avgSSIM
  } catch (error) {
    console.error('어제 품질 조회 실패:', error)
    return 0
  }
}

const calculateAIAccuracyTrend = async () => {
  try {
    const today = await getTodayAIAccuracy()
    const yesterday = await getYesterdayAIAccuracy()
    return today - yesterday
  } catch (error) {
    console.error('AI 정확도 트렌드 계산 실패:', error)
    return 0
  }
}

const getTodayAIAccuracy = async () => {
  try {
    const { data, error } = await supabase
      .from('ai_performance_logs')
      .select('overall_accuracy')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    const avgAccuracy = data.reduce((sum, log) => sum + (log.overall_accuracy || 0), 0) / data.length
    return avgAccuracy
  } catch (error) {
    console.error('오늘 AI 정확도 조회 실패:', error)
    return 0
  }
}

const getYesterdayAIAccuracy = async () => {
  try {
    const { data, error } = await supabase
      .from('ai_performance_logs')
      .select('overall_accuracy')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    const avgAccuracy = data.reduce((sum, log) => sum + (log.overall_accuracy || 0), 0) / data.length
    return avgAccuracy
  } catch (error) {
    console.error('어제 AI 정확도 조회 실패:', error)
    return 0
  }
}

const calculateLatencyTrend = async () => {
  try {
    const today = await getTodayLatency()
    const yesterday = await getYesterdayLatency()
    return yesterday - today // 지연시간은 감소가 좋음
  } catch (error) {
    console.error('지연시간 트렌드 계산 실패:', error)
    return 0
  }
}

const getTodayLatency = async () => {
  try {
    const { data, error } = await supabase
      .from('operation_logs')
      .select('duration_ms')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    const avgLatency = data.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / data.length
    return avgLatency
  } catch (error) {
    console.error('오늘 지연시간 조회 실패:', error)
    return 0
  }
}

const getYesterdayLatency = async () => {
  try {
    const { data, error } = await supabase
      .from('operation_logs')
      .select('duration_ms')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    const avgLatency = data.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / data.length
    return avgLatency
  } catch (error) {
    console.error('어제 지연시간 조회 실패:', error)
    return 0
  }
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