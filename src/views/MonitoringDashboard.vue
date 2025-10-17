<template>
  <div class="monitoring-dashboard">
    <div class="dashboard-header">
      <h1>🔍 BrickBox 모니터링 대시보드</h1>
      <div class="status-indicators">
        <div class="status-item" :class="systemStatus.overall">
          <span class="status-icon">{{ systemStatus.overall === 'healthy' ? '✅' : '⚠️' }}</span>
          <span>시스템 상태: {{ systemStatus.overall === 'healthy' ? '정상' : '주의' }}</span>
        </div>
        <div class="status-item">
          <span class="status-icon">🕒</span>
          <span>마지막 업데이트: {{ lastUpdate }}</span>
        </div>
      </div>
    </div>

    <!-- SLO 지표 카드 -->
    <div class="slo-metrics">
      <h2>📊 SLO 지표
        <HelpTooltip 
          title="SLO (Service Level Objectives)"
          content="시스템이 달성해야 하는 성능 기준입니다. 목표값과 실제 성능을 비교하여 시스템 건강도를 측정합니다."
          :examples="['소형 부품 인식률 95% 이상', 'Top-1 정확도 90% 이상', '오검출률 5% 이하']"
        />
      </h2>
      <div class="metrics-grid">
        <div class="metric-card" :class="getMetricStatus('smallRecall')">
          <div class="metric-header">
            <h3>소형 Recall
              <HelpTooltip 
                title="소형 Recall"
                content="소형 부품을 올바르게 인식한 비율입니다. 높을수록 소형 부품을 놓치지 않고 잘 찾아냅니다."
                :examples="['0.95 = 95% 인식', '0.90 = 90% 인식']"
              />
            </h3>
            <span class="metric-value">{{ sloMetrics.smallRecall.toFixed(3) }}</span>
          </div>
          <div class="metric-threshold">
            목표: ≥ {{ sloThresholds.smallRecall }}
            <span class="status-indicator" :class="sloMetrics.smallRecall >= sloThresholds.smallRecall ? 'pass' : 'fail'">
              {{ sloMetrics.smallRecall >= sloThresholds.smallRecall ? '✅' : '❌' }}
            </span>
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('top1Accuracy')">
          <div class="metric-header">
            <h3>Top-1 정확도
              <HelpTooltip 
                title="Top-1 정확도"
                content="첫 번째 추천 결과가 정답과 일치하는 비율입니다. 사용자가 가장 먼저 보는 결과의 정확도를 측정합니다."
                :examples="['0.90 = 90% 정답', '0.85 = 85% 정답']"
              />
            </h3>
            <span class="metric-value">{{ sloMetrics.top1Accuracy.toFixed(3) }}</span>
          </div>
          <div class="metric-threshold">
            목표: ≥ {{ sloThresholds.top1Accuracy }}
            <span class="status-indicator" :class="sloMetrics.top1Accuracy >= sloThresholds.top1Accuracy ? 'pass' : 'fail'">
              {{ sloMetrics.top1Accuracy >= sloThresholds.top1Accuracy ? '✅' : '❌' }}
            </span>
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('falsePositiveRate')">
          <div class="metric-header">
            <h3>오검출률
              <HelpTooltip 
                title="오검출률"
                content="부품이 아닌데 부품으로 잘못 인식한 비율입니다. 낮을수록 더 정확합니다."
                :examples="['0.05 = 5% 오인식', '0.02 = 2% 오인식']"
              />
            </h3>
            <span class="metric-value">{{ (sloMetrics.falsePositiveRate * 100).toFixed(1) }}%</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ (sloThresholds.falsePositiveRate * 100) }}%
            <span class="status-indicator" :class="sloMetrics.falsePositiveRate <= sloThresholds.falsePositiveRate ? 'pass' : 'fail'">
              {{ sloMetrics.falsePositiveRate <= sloThresholds.falsePositiveRate ? '✅' : '❌' }}
            </span>
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('holdRate')">
          <div class="metric-header">
            <h3>보류율
              <HelpTooltip 
                title="보류율"
                content="AI가 확신하지 못해 수동 검토로 넘긴 케이스의 비율입니다. 낮을수록 AI가 더 확신하고 판단합니다."
                :examples="['0.05 = 5% 보류', '0.02 = 2% 보류']"
              />
            </h3>
            <span class="metric-value">{{ (sloMetrics.holdRate * 100).toFixed(1) }}%</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ (sloThresholds.holdRate * 100) }}%
            <span class="status-indicator" :class="sloMetrics.holdRate <= sloThresholds.holdRate ? 'pass' : 'fail'">
              {{ sloMetrics.holdRate <= sloThresholds.holdRate ? '✅' : '❌' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 성능 지표 -->
    <div class="performance-metrics">
      <h2>⚡ 성능 지표
        <HelpTooltip 
          title="성능 지표"
          content="시스템의 처리 속도와 응답 시간을 측정하는 지표들입니다. 사용자 경험과 시스템 효율성을 평가합니다."
          :examples="['평균 지연시간', 'WebP 디코딩 속도', 'FAISS 검색 속도']"
        />
      </h2>
      <div class="metrics-grid">
        <div class="metric-card" :class="getMetricStatus('avgLatency')">
          <div class="metric-header">
            <h3>평균 지연
              <HelpTooltip 
                title="평균 지연"
                content="요청부터 응답까지의 평균 소요 시간입니다. 낮을수록 빠른 응답을 의미합니다."
                :examples="['150ms = 0.15초', '100ms = 0.1초']"
              />
            </h3>
            <span class="metric-value">{{ sloMetrics.avgLatency.toFixed(1) }}ms</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ sloThresholds.avgLatency }}ms
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('webpDecodeP95')">
          <div class="metric-header">
            <h3>WebP 디코딩 p95
              <HelpTooltip 
                title="WebP 디코딩 p95"
                content="WebP 이미지 디코딩 시간의 95% 백분위수입니다. 대부분의 이미지가 이 시간 내에 디코딩됩니다."
                :examples="['15ms = 95%가 15ms 이내', '10ms = 95%가 10ms 이내']"
              />
            </h3>
            <span class="metric-value">{{ sloMetrics.webpDecodeP95.toFixed(1) }}ms</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ sloThresholds.webpDecodeP95 }}ms
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('faissStage1P95')">
          <div class="metric-header">
            <h3>FAISS Stage-1 p95
              <HelpTooltip 
                title="FAISS Stage-1 p95"
                content="FAISS 1단계 검색 시간의 95% 백분위수입니다. 빠른 후보 검색의 성능을 측정합니다."
                :examples="['10ms = 95%가 10ms 이내', '5ms = 95%가 5ms 이내']"
              />
            </h3>
            <span class="metric-value">{{ sloMetrics.faissStage1P95.toFixed(1) }}ms</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ sloThresholds.faissStage1P95 }}ms
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('faissStage2P95')">
          <div class="metric-header">
            <h3>FAISS Stage-2 p95
              <HelpTooltip 
                title="FAISS Stage-2 p95"
                content="FAISS 2단계 정밀 검색 시간의 95% 백분위수입니다. 정확한 매칭을 위한 상세 검색 성능을 측정합니다."
                :examples="['15ms = 95%가 15ms 이내', '10ms = 95%가 10ms 이내']"
              />
            </h3>
            <span class="metric-value">{{ sloMetrics.faissStage2P95.toFixed(1) }}ms</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ sloThresholds.faissStage2P95 }}ms
          </div>
        </div>
      </div>
    </div>

    <!-- 시스템 지표 -->
    <div class="system-metrics">
      <h2>🖥️ 시스템 지표
        <HelpTooltip 
          title="시스템 지표"
          content="서버의 하드웨어 리소스 사용률과 시스템 성능을 측정하는 지표들입니다. 시스템 안정성을 평가합니다."
          :examples="['메모리 사용률', 'CPU 사용률', '인덱스 크기']"
        />
      </h2>
      <div class="metrics-grid">
        <div class="metric-card" :class="getMetricStatus('stage2Rate')">
          <div class="metric-header">
            <h3>Stage-2 진입률
              <HelpTooltip 
                title="Stage-2 진입률"
                content="1단계 검색에서 확신하지 못해 2단계 정밀 검색으로 넘어가는 비율입니다. 낮을수록 1단계에서 더 정확합니다."
                :examples="['0.25 = 25% 진입', '0.15 = 15% 진입']"
              />
            </h3>
            <span class="metric-value">{{ (sloMetrics.stage2Rate * 100).toFixed(1) }}%</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ (sloThresholds.stage2Rate * 100) }}%
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('indexSize')">
          <div class="metric-header">
            <h3>인덱스 크기
              <HelpTooltip 
                title="인덱스 크기"
                content="검색을 위한 벡터 인덱스의 메모리 사용량입니다. 클수록 더 많은 부품을 저장할 수 있지만 메모리를 많이 사용합니다."
                :examples="['120MB = 120MB 사용', '80MB = 80MB 사용']"
              />
            </h3>
            <span class="metric-value">{{ (sloMetrics.indexSize / 1024 / 1024).toFixed(1) }}MB</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ sloThresholds.indexSize }}MB
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('memoryUsage')">
          <div class="metric-header">
            <h3>메모리 사용률
              <HelpTooltip 
                title="메모리 사용률"
                content="서버의 RAM 메모리 사용 비율입니다. 높을수록 메모리 부족 위험이 있습니다."
                :examples="['85% = 85% 사용', '70% = 70% 사용']"
              />
            </h3>
            <span class="metric-value">{{ (sloMetrics.memoryUsage * 100).toFixed(1) }}%</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ (sloThresholds.memoryUsage * 100) }}%
          </div>
        </div>

        <div class="metric-card" :class="getMetricStatus('cpuUsage')">
          <div class="metric-header">
            <h3>CPU 사용률
              <HelpTooltip 
                title="CPU 사용률"
                content="서버의 CPU 프로세서 사용 비율입니다. 높을수록 처리 속도가 느려질 수 있습니다."
                :examples="['90% = 90% 사용', '75% = 75% 사용']"
              />
            </h3>
            <span class="metric-value">{{ (sloMetrics.cpuUsage * 100).toFixed(1) }}%</span>
          </div>
          <div class="metric-threshold">
            목표: ≤ {{ (sloThresholds.cpuUsage * 100) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- 알림 및 경고 -->
    <div class="alerts-section">
      <h2>🚨 알림 및 경고
        <HelpTooltip 
          title="알림 및 경고"
          content="시스템에서 발생한 문제나 주의사항을 알려주는 메시지들입니다. 즉시 확인이 필요한 사항들을 표시합니다."
          :examples="['SLO 위반', '리소스 부족', '성능 저하']"
        />
      </h2>
      <div class="alerts-list">
        <div v-for="alert in recentAlerts" :key="alert.id" class="alert-item" :class="alert.severity">
          <div class="alert-header">
            <span class="alert-icon">{{ getAlertIcon(alert.severity) }}</span>
            <span class="alert-type">{{ alert.type }}</span>
            <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
          </div>
          <div class="alert-message">{{ alert.message }}</div>
        </div>
      </div>
    </div>

    <!-- 통계 요약 -->
    <div class="stats-summary">
      <h2>📈 통계 요약
        <HelpTooltip 
          title="통계 요약"
          content="시스템 운영 현황을 한눈에 볼 수 있는 주요 통계들입니다. 전체적인 시스템 건강도를 파악할 수 있습니다."
          :examples="['총 알림 수', '해결된 문제', '평균 응답시간']"
        />
      </h2>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">총 알림</span>
          <span class="stat-value">{{ monitoringStats.totalAlerts }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">중요 알림</span>
          <span class="stat-value">{{ monitoringStats.criticalAlerts }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">해결된 알림</span>
          <span class="stat-value">{{ monitoringStats.resolvedAlerts }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">평균 응답 시간</span>
          <span class="stat-value">{{ monitoringStats.avgResponseTime.toFixed(1) }}ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">가동률</span>
          <span class="stat-value">{{ monitoringStats.uptime.toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useMonitoringSystem } from '@/composables/useMonitoringSystem'
import HelpTooltip from '../components/HelpTooltip.vue'

const { 
  loading, 
  error, 
  monitoringStats, 
  runMonitoringPipeline,
  getMonitoringStats,
  collectRealSystemData
} = useMonitoringSystem()

// 반응형 데이터
const lastUpdate = ref('')
const systemStatus = reactive({
  overall: 'healthy'
})

const sloMetrics = reactive({
  smallRecall: 0,
  top1Accuracy: 0,
  falsePositiveRate: 0,
  holdRate: 0,
  avgLatency: 0,
  webpDecodeP95: 0,
  faissStage1P95: 0,
  faissStage2P95: 0,
  stage2Rate: 0,
  indexSize: 0,
  memoryUsage: 0,
  cpuUsage: 0
})

const sloThresholds = reactive({
  smallRecall: 0.95,
  top1Accuracy: 0.97,
  falsePositiveRate: 0.03,
  holdRate: 0.05,
  avgLatency: 150,
  webpDecodeP95: 15,
  faissStage1P95: 10,
  faissStage2P95: 15,
  stage2Rate: 0.25,
  indexSize: 120,
  memoryUsage: 0.85,
  cpuUsage: 0.90
})

const recentAlerts = ref([])

// 메트릭 상태 계산
const getMetricStatus = (metricName) => {
  const current = sloMetrics[metricName]
  const threshold = sloThresholds[metricName]
  
  if (metricName.includes('Rate') || metricName.includes('Usage') || metricName.includes('Size')) {
    return current <= threshold ? 'pass' : 'fail'
  } else {
    return current >= threshold ? 'pass' : 'fail'
  }
}

// 알림 아이콘 반환
const getAlertIcon = (severity) => {
  const icons = {
    critical: '🔴',
    warning: '🟡',
    info: '🔵'
  }
  return icons[severity] || '🔵'
}

// 시간 포맷팅
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('ko-KR')
}

// 모니터링 데이터 업데이트
const updateMonitoringData = async () => {
  try {
    console.log('🔄 모니터링 데이터 업데이트 시작...')
    
    // 실제 시스템 데이터 수집 (프로덕션)
    const systemData = await collectRealSystemData()
    console.log('📊 수집된 시스템 데이터:', systemData)
    
    // 모니터링 파이프라인 실행
    const result = await runMonitoringPipeline(systemData)
    console.log('🔍 모니터링 파이프라인 결과:', result)
    
    // 데이터 업데이트
    console.log('📈 업데이트 전 SLO 메트릭:', { ...sloMetrics })
    Object.assign(sloMetrics, result.metrics)
    console.log('📈 업데이트 후 SLO 메트릭:', { ...sloMetrics })
    
    lastUpdate.value = new Date().toLocaleString('ko-KR')
    console.log('🕒 마지막 업데이트 시간:', lastUpdate.value)
    
    // 시스템 상태 업데이트
    const violations = result.violations || []
    systemStatus.overall = violations.length === 0 ? 'healthy' : 'warning'
    console.log('🚨 SLO 위반 사항:', violations)
    console.log('✅ 시스템 상태:', systemStatus.overall)
    
    // 알림 업데이트
    if (violations.length > 0) {
      console.log('🚨 알림 생성 중...')
      violations.forEach(violation => {
        const alert = {
          id: `alert_${Date.now()}_${violation.type}`,
          type: violation.type,
          severity: violation.severity,
          message: violation.message,
          timestamp: new Date().toISOString()
        }
        recentAlerts.value.unshift(alert)
        console.log('📢 새 알림 추가:', alert)
      })
      
      // 최대 10개 알림만 유지
      recentAlerts.value = recentAlerts.value.slice(0, 10)
      console.log('📋 총 알림 수:', recentAlerts.value.length)
    }
    
    console.log('✅ 모니터링 데이터 업데이트 완료')
    
  } catch (err) {
    console.error('❌ 모니터링 데이터 업데이트 실패:', err)
    // 실패 시 기본값 유지
  }
}

// 자동 업데이트 설정 (기술문서 11.1 실시간 모니터링)
let updateInterval = null
let realtimeConnection = null

onMounted(() => {
  updateMonitoringData()
  
  // 30초마다 기본 업데이트
  updateInterval = setInterval(updateMonitoringData, 30000)
  
  // 실시간 WebSocket 연결 (기술문서 11.1)
  initializeRealtimeConnection()
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
  if (realtimeConnection) {
    realtimeConnection.close()
  }
})

// 실시간 연결 초기화
const initializeRealtimeConnection = () => {
  try {
    console.log('🔌 실시간 모니터링 연결 시도...')
    
    // WebSocket 연결 시도 (개발 환경에서는 비활성화)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('⚠️ 개발 환경: WebSocket 연결 비활성화')
      return
    }
    
    // WebSocket 또는 Server-Sent Events 연결
    realtimeConnection = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/monitoring`)
    
    realtimeConnection.onopen = () => {
      console.log('✅ 실시간 모니터링 연결 성공')
    }
    
    realtimeConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // SLO 지표 실시간 업데이트
        if (data.type === 'slo_update') {
          updateSLOMetrics(data.metrics)
        }
        
        // 알림 실시간 수신
        if (data.type === 'alert') {
          handleRealtimeAlert(data.alert)
        }
        
        // 성능 지표 실시간 업데이트
        if (data.type === 'performance_update') {
          updatePerformanceMetrics(data.metrics)
        }
      } catch (err) {
        console.warn('⚠️ WebSocket 메시지 파싱 실패:', err)
      }
    }
    
    realtimeConnection.onerror = (error) => {
      console.warn('⚠️ 실시간 모니터링 연결 오류:', error)
    }
    
    realtimeConnection.onclose = () => {
      console.log('🔌 실시간 모니터링 연결 종료')
      // 재연결 시도 (5초 후)
      setTimeout(() => {
        console.log('🔄 실시간 모니터링 재연결 시도...')
        initializeRealtimeConnection()
      }, 5000)
    }
    
  } catch (err) {
    console.warn('⚠️ 실시간 모니터링 초기화 실패:', err)
  }
}

// SLO 지표 실시간 업데이트
const updateSLOMetrics = (metrics) => {
  Object.assign(sloMetrics, metrics)
  lastUpdate.value = new Date().toLocaleString('ko-KR')
  
  // 시스템 상태 업데이트
  const violations = checkSLOViolations(metrics)
  systemStatus.overall = violations.length === 0 ? 'healthy' : 'warning'
}

// 성능 지표 실시간 업데이트
const updatePerformanceMetrics = (metrics) => {
  Object.assign(sloMetrics, metrics)
  lastUpdate.value = new Date().toLocaleString('ko-KR')
}

// 실시간 알림 처리
const handleRealtimeAlert = (alert) => {
  recentAlerts.value.unshift({
    id: Date.now(),
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    timestamp: new Date().toISOString()
  })
  
  // 최대 10개 알림만 유지
  recentAlerts.value = recentAlerts.value.slice(0, 10)
  
  // 브라우저 알림 (사용자 허용 시)
  if (Notification.permission === 'granted') {
    new Notification('BrickBox 알림', {
      body: alert.message,
      icon: '/favicon.ico'
    })
  }
}

// SLO 위반 체크
const checkSLOViolations = (metrics) => {
  const violations = []
  
  if (metrics.smallRecall < sloThresholds.smallRecall) {
    violations.push({ type: 'small_recall', metric: 'smallRecall' })
  }
  
  if (metrics.top1Accuracy < sloThresholds.top1Accuracy) {
    violations.push({ type: 'top1_accuracy', metric: 'top1Accuracy' })
  }
  
  if (metrics.falsePositiveRate > sloThresholds.falsePositiveRate) {
    violations.push({ type: 'false_positive', metric: 'falsePositiveRate' })
  }
  
  if (metrics.holdRate > sloThresholds.holdRate) {
    violations.push({ type: 'hold_rate', metric: 'holdRate' })
  }
  
  return violations
}
</script>

<style scoped>
.monitoring-dashboard {
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
  color: #333;
}

.status-indicators {
  display: flex;
  gap: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  background: #f5f5f5;
}

.status-icon {
  font-size: 18px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.metric-card {
  padding: 20px;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  background: white;
  transition: all 0.3s ease;
}

.metric-card.pass {
  border-color: #4caf50;
  background: #f8fff8;
}

.metric-card.fail {
  border-color: #f44336;
  background: #fff8f8;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.metric-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.metric-threshold {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #666;
}

.status-indicator {
  font-size: 16px;
}

.alerts-section {
  margin-bottom: 30px;
}

.alerts-list {
  max-height: 400px;
  overflow-y: auto;
}

.alert-item {
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 8px;
  border-left: 4px solid #e0e0e0;
}

.alert-item.critical {
  border-left-color: #f44336;
  background: #fff8f8;
}

.alert-item.warning {
  border-left-color: #ff9800;
  background: #fffbf0;
}

.alert-item.info {
  border-left-color: #2196f3;
  background: #f0f8ff;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.alert-type {
  font-weight: bold;
  color: #333;
}

.alert-time {
  font-size: 12px;
  color: #666;
}

.alert-message {
  color: #666;
  font-size: 14px;
}

.stats-summary {
  margin-bottom: 30px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.stat-label {
  font-weight: 500;
  color: #333;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

h2 {
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e0e0e0;
}
</style>
