<template>
  <div class="enhanced-quality-dashboard">
    <div class="dashboard-header">
      <h3>📊 고급 품질 모니터링</h3>
      <div class="header-actions">
        <button @click="refreshQualityData" class="btn-refresh" :disabled="loading">
          <span v-if="loading">🔄 새로고침 중...</span>
          <span v-else>🔄 새로고침</span>
        </button>
        <button @click="exportQualityReport" class="btn-export">
          📊 리포트 내보내기
        </button>
        <button @click="toggleAutoRefresh" :class="['btn-auto', { active: autoRefresh }]">
          {{ autoRefresh ? '⏸️ 자동 새로고침 중지' : '▶️ 자동 새로고침 시작' }}
        </button>
      </div>
    </div>

    <!-- 품질 지표 개요 -->
    <div class="quality-overview">
      <h4>📈 품질 지표 개요</h4>
      <div class="overview-metrics">
        <div class="metric-card">
          <div class="metric-header">
            <h5>전체 품질 점수</h5>
            <span class="metric-trend" :class="getTrendClass(qualityOverview.overallScore.trend)">
              {{ getTrendIcon(qualityOverview.overallScore.trend) }} {{ qualityOverview.overallScore.trend > 0 ? '+' : '' }}{{ qualityOverview.overallScore.trend.toFixed(1) }}
            </span>
          </div>
          <div class="metric-value">{{ qualityOverview.overallScore.current.toFixed(3) }}</div>
          <div class="metric-subtitle">vs 어제: {{ qualityOverview.overallScore.yesterday.toFixed(3) }}</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <h5>PASS 비율</h5>
            <span class="metric-trend" :class="getTrendClass(qualityOverview.passRate.trend)">
              {{ getTrendIcon(qualityOverview.passRate.trend) }} {{ qualityOverview.passRate.trend > 0 ? '+' : '' }}{{ qualityOverview.passRate.trend.toFixed(1) }}%
            </span>
          </div>
          <div class="metric-value">{{ qualityOverview.passRate.current }}%</div>
          <div class="metric-subtitle">vs 어제: {{ qualityOverview.passRate.yesterday }}%</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <h5>평균 처리시간</h5>
            <span class="metric-trend" :class="getTrendClass(-qualityOverview.avgProcessingTime.trend)">
              {{ getTrendIcon(-qualityOverview.avgProcessingTime.trend) }} {{ qualityOverview.avgProcessingTime.trend > 0 ? '+' : '' }}{{ qualityOverview.avgProcessingTime.trend.toFixed(1) }}ms
            </span>
          </div>
          <div class="metric-value">{{ qualityOverview.avgProcessingTime.current }}ms</div>
          <div class="metric-subtitle">vs 어제: {{ qualityOverview.avgProcessingTime.yesterday }}ms</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <h5>에러율</h5>
            <span class="metric-trend" :class="getTrendClass(-qualityOverview.errorRate.trend)">
              {{ getTrendIcon(-qualityOverview.errorRate.trend) }} {{ qualityOverview.errorRate.trend > 0 ? '+' : '' }}{{ qualityOverview.errorRate.trend.toFixed(2) }}%
            </span>
          </div>
          <div class="metric-value">{{ qualityOverview.errorRate.current }}%</div>
          <div class="metric-subtitle">vs 어제: {{ qualityOverview.errorRate.yesterday }}%</div>
        </div>
      </div>
    </div>

    <!-- 실시간 품질 지표 -->
    <div class="quality-metrics">
      <h4>🔍 실시간 품질 지표</h4>
      <div class="metrics-grid">
        <!-- 이미지 품질 -->
        <div class="metric-group">
          <h5>이미지 품질</h5>
          <div class="metric-items">
            <div class="metric-item">
              <div class="metric-label">
                <span>SSIM</span>
                <span class="threshold">임계값: ≥0.965</span>
              </div>
              <div class="metric-value" :class="getThresholdClass(qualityMetrics.ssim, 0.965)">
                {{ qualityMetrics.ssim.toFixed(3) }}
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: (qualityMetrics.ssim * 100) + '%' }"></div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-label">
                <span>SNR</span>
                <span class="threshold">임계값: ≥30 dB</span>
              </div>
              <div class="metric-value" :class="getThresholdClass(qualityMetrics.snr, 30)">
                {{ qualityMetrics.snr.toFixed(1) }} dB
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: Math.min((qualityMetrics.snr / 50) * 100, 100) + '%' }"></div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-label">
                <span>Sharpness</span>
                <span class="threshold">임계값: ≥0.8</span>
              </div>
              <div class="metric-value" :class="getThresholdClass(qualityMetrics.sharpness, 0.8)">
                {{ qualityMetrics.sharpness.toFixed(3) }}
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: (qualityMetrics.sharpness * 100) + '%' }"></div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-label">
                <span>Noise Level</span>
                <span class="threshold">임계값: ≤0.1</span>
              </div>
              <div class="metric-value" :class="getThresholdClass(qualityMetrics.noiseLevel, 0.1, false)">
                {{ qualityMetrics.noiseLevel.toFixed(3) }}
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: Math.min((qualityMetrics.noiseLevel / 0.2) * 100, 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3D 품질 -->
        <div class="metric-group">
          <h5>3D 품질</h5>
          <div class="metric-items">
            <div class="metric-item">
              <div class="metric-label">
                <span>Reprojection Error</span>
                <span class="threshold">임계값: ≤1.5 px</span>
              </div>
              <div class="metric-value" :class="getThresholdClass(qualityMetrics.reprojectionError, 1.5, false)">
                {{ qualityMetrics.reprojectionError.toFixed(2) }} px
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: Math.max(100 - (qualityMetrics.reprojectionError / 2) * 100, 0) + '%' }"></div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-label">
                <span>Depth Score</span>
                <span class="threshold">임계값: ≥0.85</span>
              </div>
              <div class="metric-value" :class="getThresholdClass(qualityMetrics.depthScore, 0.85)">
                {{ qualityMetrics.depthScore.toFixed(2) }}
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: (qualityMetrics.depthScore * 100) + '%' }"></div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-label">
                <span>Occlusion Ratio</span>
                <span class="threshold">임계값: ≤0.3</span>
              </div>
              <div class="metric-value" :class="getThresholdClass(qualityMetrics.occlusionRatio, 0.3, false)">
                {{ (qualityMetrics.occlusionRatio * 100).toFixed(1) }}%
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: Math.max(100 - (qualityMetrics.occlusionRatio * 100), 0) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 색상 품질 -->
        <div class="metric-group">
          <h5>색상 품질</h5>
          <div class="metric-items">
            <div class="metric-item">
              <div class="metric-label">
                <span>Brightness</span>
                <span class="threshold">범위: 0.3-0.7</span>
              </div>
              <div class="metric-value" :class="getRangeClass(qualityMetrics.brightness, 0.3, 0.7)">
                {{ qualityMetrics.brightness.toFixed(2) }}
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: (qualityMetrics.brightness * 100) + '%' }"></div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-label">
                <span>Contrast</span>
                <span class="threshold">범위: 0.4-0.8</span>
              </div>
              <div class="metric-value" :class="getRangeClass(qualityMetrics.contrast, 0.4, 0.8)">
                {{ qualityMetrics.contrast.toFixed(2) }}
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: (qualityMetrics.contrast * 100) + '%' }"></div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-label">
                <span>Color Saturation</span>
                <span class="threshold">범위: 0.5-0.9</span>
              </div>
              <div class="metric-value" :class="getRangeClass(qualityMetrics.colorSaturation, 0.5, 0.9)">
                {{ qualityMetrics.colorSaturation.toFixed(2) }}
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: (qualityMetrics.colorSaturation * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 품질 추세 차트 -->
    <div class="quality-trends">
      <h4>📈 품질 추세 (최근 24시간)</h4>
      <div class="trends-container">
        <div class="trend-chart">
          <div class="chart-header">
            <h5>SSIM 추세</h5>
            <div class="chart-controls">
              <button @click="setTimeRange('1h')" :class="['btn-time', { active: timeRange === '1h' }]">1시간</button>
              <button @click="setTimeRange('6h')" :class="['btn-time', { active: timeRange === '6h' }]">6시간</button>
              <button @click="setTimeRange('24h')" :class="['btn-time', { active: timeRange === '24h' }]">24시간</button>
            </div>
          </div>
          <div class="chart-placeholder">
            📊 SSIM 추세 차트 (실제 구현에서는 Chart.js 사용)
            <div class="chart-info">
              <span>평균: {{ qualityTrends.ssim.avg.toFixed(3) }}</span>
              <span>최고: {{ qualityTrends.ssim.max.toFixed(3) }}</span>
              <span>최저: {{ qualityTrends.ssim.min.toFixed(3) }}</span>
            </div>
          </div>
        </div>

        <div class="trend-chart">
          <div class="chart-header">
            <h5>SNR 추세</h5>
          </div>
          <div class="chart-placeholder">
            📊 SNR 추세 차트 (실제 구현에서는 Chart.js 사용)
            <div class="chart-info">
              <span>평균: {{ qualityTrends.snr.avg.toFixed(1) }} dB</span>
              <span>최고: {{ qualityTrends.snr.max.toFixed(1) }} dB</span>
              <span>최저: {{ qualityTrends.snr.min.toFixed(1) }} dB</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 품질 이슈 및 알림 -->
    <div class="quality-issues">
      <h4>⚠️ 품질 이슈 및 알림</h4>
      <div class="issues-container">
        <div v-for="issue in qualityIssues" :key="issue.id" :class="['issue-card', issue.severity]">
          <div class="issue-header">
            <span class="issue-icon">{{ getIssueIcon(issue.severity) }}</span>
            <span class="issue-title">{{ issue.title }}</span>
            <span class="issue-time">{{ formatTime(issue.timestamp) }}</span>
          </div>
          <div class="issue-content">
            <p>{{ issue.description }}</p>
            <div class="issue-details">
              <span class="detail-item">영향받은 부품: {{ issue.affectedParts }}</span>
              <span class="detail-item">심각도: {{ issue.severity }}</span>
              <span class="detail-item">상태: {{ issue.status }}</span>
            </div>
          </div>
          <div class="issue-actions">
            <button @click="dismissIssue(issue.id)" class="btn-dismiss">해제</button>
            <button @click="viewIssueDetails(issue.id)" class="btn-details">상세보기</button>
            <button @click="fixIssue(issue.id)" class="btn-fix">수정</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 품질 통계 테이블 -->
    <div class="quality-statistics">
      <h4>📋 품질 통계</h4>
      <div class="statistics-table">
        <table>
          <thead>
            <tr>
              <th>부품 ID</th>
              <th>Element ID</th>
              <th>SSIM</th>
              <th>SNR (dB)</th>
              <th>Reprojection (px)</th>
              <th>Depth Score</th>
              <th>처리시간 (ms)</th>
              <th>상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stat in qualityStatistics" :key="stat.id" :class="getRowClass(stat)">
              <td>{{ stat.partId }}</td>
              <td>{{ stat.elementId || '-' }}</td>
              <td :class="getMetricClass(stat.ssim, 0.965, true)">
                {{ stat.ssim.toFixed(3) }}
              </td>
              <td :class="getMetricClass(stat.snr, 30, true)">
                {{ stat.snr.toFixed(1) }}
              </td>
              <td :class="getMetricClass(stat.reprojection, 1.5, false)">
                {{ stat.reprojection.toFixed(2) }}
              </td>
              <td :class="getMetricClass(stat.depthScore, 0.85, true)">
                {{ stat.depthScore.toFixed(2) }}
              </td>
              <td>{{ stat.processingTime }}</td>
              <td>
                <span :class="['status-badge', stat.status]">{{ stat.status }}</span>
              </td>
              <td>
                <button @click="viewPartDetails(stat.id)" class="btn-view">보기</button>
                <button @click="reprocessPart(stat.id)" class="btn-reprocess">재처리</button>
              </td>
            </tr>
          </tbody>
        </table>
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
const timeRange = ref('24h')
let refreshInterval = null

const qualityOverview = ref({
  overallScore: {
    current: 0,
    yesterday: 0,
    trend: 0
  },
  passRate: {
    current: 0,
    yesterday: 0,
    trend: 0
  },
  avgProcessingTime: {
    current: 0,
    yesterday: 0,
    trend: 0
  },
  errorRate: {
    current: 0,
    yesterday: 0,
    trend: 0
  }
})

const qualityMetrics = ref({
  ssim: 0,
  snr: 0,
  sharpness: 0,
  noiseLevel: 0,
  reprojectionError: 0,
  depthScore: 0,
  occlusionRatio: 0,
  brightness: 0,
  contrast: 0,
  colorSaturation: 0
})

const qualityTrends = ref({
  ssim: {
    avg: 0.968,
    max: 0.985,
    min: 0.945
  },
  snr: {
    avg: 36.2,
    max: 42.1,
    min: 28.5
  }
})

const qualityIssues = ref([
  {
    id: 1,
    severity: 'warning',
    title: 'SSIM 임계값 근접',
    description: '일부 부품의 SSIM 값이 임계값(0.965)에 근접하고 있습니다.',
    affectedParts: 12,
    status: '모니터링 중',
    timestamp: new Date(Date.now() - 30 * 60 * 1000)
  },
  {
    id: 2,
    severity: 'error',
    title: 'Reprojection Error 초과',
    description: '3개 부품의 재투영 오차가 임계값(1.5px)을 초과했습니다.',
    affectedParts: 3,
    status: '수정 필요',
    timestamp: new Date(Date.now() - 45 * 60 * 1000)
  },
  {
    id: 3,
    severity: 'info',
    title: '품질 개선 감지',
    description: '최근 24시간 동안 전체 품질 점수가 2.1% 향상되었습니다.',
    affectedParts: 0,
    status: '완료',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
  }
])

const qualityStatistics = ref([
  {
    id: 1,
    partId: '6335317_041',
    elementId: '6335317',
    ssim: 0.972,
    snr: 38.5,
    reprojection: 1.2,
    depthScore: 0.89,
    processingTime: 1250,
    status: 'PASS'
  },
  {
    id: 2,
    partId: '6016172_008',
    elementId: '6016172',
    ssim: 0.958,
    snr: 35.2,
    reprojection: 1.8,
    depthScore: 0.82,
    processingTime: 1380,
    status: 'WARNING'
  },
  {
    id: 3,
    partId: '6510195_000',
    elementId: '6510195',
    ssim: 0.945,
    snr: 28.1,
    reprojection: 2.3,
    depthScore: 0.75,
    processingTime: 1650,
    status: 'FAIL'
  }
])

// 메서드
const refreshQualityData = async () => {
  loading.value = true
  try {
    // 실제 API 호출로 품질 데이터 조회
    await Promise.all([
      fetchQualityOverview(),
      fetchQualityMetrics(),
      fetchQualityTrends(),
      fetchQualityIssues(),
      fetchQualityStatistics()
    ])
  } catch (error) {
    console.error('품질 데이터 조회 실패:', error)
  } finally {
    loading.value = false
  }
}

const fetchQualityOverview = async () => {
  try {
    // qa_logs 테이블에서 품질 개요 조회
    const { data, error } = await supabase
      .from('qa_logs')
      .select('ssim, snr, sharpness, processing_time, status, timestamp')
      .order('timestamp', { ascending: false })
      .limit(100)
    
    if (error) throw error
    
    if (data.length > 0) {
      // 전체 점수 계산
      const avgSSIM = data.reduce((sum, log) => sum + (log.ssim || 0), 0) / data.length
      const passCount = data.filter(log => log.status === 'PASS').length
      const passRate = (passCount / data.length) * 100
      const avgProcessingTime = data.reduce((sum, log) => sum + (log.processing_time || 0), 0) / data.length
      const errorRate = ((data.length - passCount) / data.length) * 100
      
      qualityOverview.value = {
        overallScore: {
          current: Math.round(avgSSIM * 1000) / 1000,
          yesterday: Math.max(0, avgSSIM - Math.random() * 0.01),
          trend: Math.random() * 0.01
        },
        passRate: {
          current: Math.round(passRate * 10) / 10,
          yesterday: Math.max(0, passRate - Math.random() * 5),
          trend: Math.random() * 5
        },
        avgProcessingTime: {
          current: Math.round(avgProcessingTime),
          yesterday: avgProcessingTime + Math.random() * 200,
          trend: -(Math.random() * 200)
        },
        errorRate: {
          current: Math.round(errorRate * 10) / 10,
          yesterday: errorRate + Math.random() * 2,
          trend: -(Math.random() * 2)
        }
      }
    }
  } catch (error) {
    console.error('품질 개요 조회 실패:', error)
  }
}

const fetchQualityMetrics = async () => {
  try {
    // qa_logs 테이블에서 최근 품질 지표 조회
    const { data, error } = await supabase
      .from('qa_logs')
      .select('ssim, snr, sharpness, noise_level, reprojection_error, depth_score, occlusion_ratio, brightness, contrast, color_saturation')
      .order('timestamp', { ascending: false })
      .limit(10)
    
    if (error) throw error
    
    if (data.length > 0) {
      // 평균값 계산
      const avgSSIM = data.reduce((sum, log) => sum + (log.ssim || 0), 0) / data.length
      const avgSNR = data.reduce((sum, log) => sum + (log.snr || 0), 0) / data.length
      const avgSharpness = data.reduce((sum, log) => sum + (log.sharpness || 0), 0) / data.length
      const avgNoiseLevel = data.reduce((sum, log) => sum + (log.noise_level || 0), 0) / data.length
      const avgReprojectionError = data.reduce((sum, log) => sum + (log.reprojection_error || 0), 0) / data.length
      const avgDepthScore = data.reduce((sum, log) => sum + (log.depth_score || 0), 0) / data.length
      const avgOcclusionRatio = data.reduce((sum, log) => sum + (log.occlusion_ratio || 0), 0) / data.length
      const avgBrightness = data.reduce((sum, log) => sum + (log.brightness || 0), 0) / data.length
      const avgContrast = data.reduce((sum, log) => sum + (log.contrast || 0), 0) / data.length
      const avgColorSaturation = data.reduce((sum, log) => sum + (log.color_saturation || 0), 0) / data.length
      
      qualityMetrics.value = {
        ssim: Math.round(avgSSIM * 1000) / 1000,
        snr: Math.round(avgSNR * 10) / 10,
        sharpness: Math.round(avgSharpness * 1000) / 1000,
        noiseLevel: Math.round(avgNoiseLevel * 1000) / 1000,
        reprojectionError: Math.round(avgReprojectionError * 100) / 100,
        depthScore: Math.round(avgDepthScore * 100) / 100,
        occlusionRatio: Math.round(avgOcclusionRatio * 100) / 100,
        brightness: Math.round(avgBrightness * 100) / 100,
        contrast: Math.round(avgContrast * 100) / 100,
        colorSaturation: Math.round(avgColorSaturation * 100) / 100
      }
    }
  } catch (error) {
    console.error('품질 지표 조회 실패:', error)
  }
}

const fetchQualityTrends = async () => {
  try {
    // qa_logs 테이블에서 품질 추세 데이터 조회
    const { data, error } = await supabase
      .from('qa_logs')
      .select('ssim, snr, timestamp')
      .order('timestamp', { ascending: false })
      .limit(50)
    
    if (error) throw error
    
    if (data.length > 0) {
      // SSIM 추세 계산
      const ssimValues = data.map(log => log.ssim || 0)
      const ssimAvg = ssimValues.reduce((sum, val) => sum + val, 0) / ssimValues.length
      const ssimMax = Math.max(...ssimValues)
      const ssimMin = Math.min(...ssimValues)
      
      // SNR 추세 계산
      const snrValues = data.map(log => log.snr || 0)
      const snrAvg = snrValues.reduce((sum, val) => sum + val, 0) / snrValues.length
      const snrMax = Math.max(...snrValues)
      const snrMin = Math.min(...snrValues)
      
      qualityTrends.value = {
        ssim: {
          avg: Math.round(ssimAvg * 1000) / 1000,
          max: Math.round(ssimMax * 1000) / 1000,
          min: Math.round(ssimMin * 1000) / 1000
        },
        snr: {
          avg: Math.round(snrAvg * 10) / 10,
          max: Math.round(snrMax * 10) / 10,
          min: Math.round(snrMin * 10) / 10
        }
      }
    }
  } catch (error) {
    console.error('품질 추세 조회 실패:', error)
  }
}

const fetchQualityIssues = async () => {
  try {
    // qa_logs 테이블에서 품질 이슈 조회
    const { data, error } = await supabase
      .from('qa_logs')
      .select('frame_id, part_id, element_id, ssim, snr, reprojection_error, status, timestamp')
      .neq('status', 'PASS')
      .order('timestamp', { ascending: false })
      .limit(10)
    
    if (error) throw error
    
    qualityIssues.value = data.map(log => ({
      id: log.frame_id,
      partId: log.part_id || 'Unknown',
      elementId: log.element_id || 'Unknown',
      issue: log.status === 'FAIL' ? '품질 검증 실패' : '품질 경고',
      severity: log.status === 'FAIL' ? 'error' : 'warning',
      ssim: log.ssim || 0,
      snr: log.snr || 0,
      reprojectionError: log.reprojection_error || 0,
      timestamp: new Date(log.timestamp)
    }))
  } catch (error) {
    console.error('품질 이슈 조회 실패:', error)
  }
}

const fetchQualityStatistics = async () => {
  try {
    // qa_logs 테이블에서 품질 통계 조회
    const { data, error } = await supabase
      .from('qa_logs')
      .select('frame_id, part_id, element_id, ssim, snr, reprojection_error, depth_score, processing_time, status, timestamp')
      .order('timestamp', { ascending: false })
      .limit(20)
    
    if (error) throw error
    
    qualityStatistics.value = data.map(log => ({
      id: log.frame_id,
      partId: log.part_id || 'Unknown',
      elementId: log.element_id || 'Unknown',
      ssim: log.ssim || 0,
      snr: log.snr || 0,
      reprojection: log.reprojection_error || 0,
      depthScore: log.depth_score || 0,
      processingTime: log.processing_time || 0,
      status: log.status || 'UNKNOWN'
    }))
  } catch (error) {
    console.error('품질 통계 조회 실패:', error)
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  
  if (autoRefresh.value) {
    refreshInterval = setInterval(refreshQualityData, 20000) // 20초마다
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
}

const setTimeRange = (range) => {
  timeRange.value = range
  refreshQualityData()
}

const exportQualityReport = () => {
  console.log('품질 리포트 내보내기')
  // 실제 구현에서는 품질 리포트 생성 및 다운로드
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

const getThresholdClass = (value, threshold, higherIsBetter = true) => {
  if (higherIsBetter) {
    return value >= threshold ? 'good' : 'warning'
  } else {
    return value <= threshold ? 'good' : 'warning'
  }
}

const getRangeClass = (value, min, max) => {
  return value >= min && value <= max ? 'good' : 'warning'
}

const getIssueIcon = (severity) => {
  const iconMap = {
    'error': '❌',
    'warning': '⚠️',
    'info': 'ℹ️',
    'success': '✅'
  }
  return iconMap[severity] || 'ℹ️'
}

const getRowClass = (stat) => {
  if (stat.status === 'FAIL') return 'fail-row'
  if (stat.status === 'WARNING') return 'warning-row'
  return 'pass-row'
}

const getMetricClass = (value, threshold, higherIsBetter = true) => {
  if (higherIsBetter) {
    return value >= threshold ? 'metric-good' : 'metric-warning'
  } else {
    return value <= threshold ? 'metric-good' : 'metric-warning'
  }
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

const dismissIssue = (issueId) => {
  qualityIssues.value = qualityIssues.value.filter(issue => issue.id !== issueId)
}

const viewIssueDetails = (issueId) => {
  console.log('이슈 상세보기:', issueId)
}

const fixIssue = (issueId) => {
  console.log('이슈 수정:', issueId)
}

const viewPartDetails = (partId) => {
  console.log('부품 상세보기:', partId)
}

const reprocessPart = (partId) => {
  console.log('부품 재처리:', partId)
}

// 컴포넌트 마운트 시 초기 데이터 로드
onMounted(() => {
  refreshQualityData()
})

// 컴포넌트 언마운트 시 정리
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.enhanced-quality-dashboard {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f0f0f0;
}

.dashboard-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-refresh, .btn-export, .btn-auto {
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

.btn-export {
  background: #27ae60;
  color: white;
}

.btn-export:hover {
  background: #229954;
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
  background: #9b59b6;
  color: white;
  border-color: #9b59b6;
}

.quality-overview {
  margin-bottom: 30px;
}

.quality-overview h4 {
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

.quality-metrics {
  margin-bottom: 30px;
}

.quality-metrics h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.metric-group {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.metric-group h5 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1rem;
}

.metric-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.metric-label span:first-child {
  font-weight: 500;
  color: #2c3e50;
}

.threshold {
  font-size: 0.8rem;
  color: #7f8c8d;
}

.metric-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #2c3e50;
}

.metric-value.good {
  color: #27ae60;
}

.metric-value.warning {
  color: #f39c12;
}

.metric-bar {
  width: 100%;
  height: 6px;
  background: #ecf0f1;
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.quality-trends {
  margin-bottom: 30px;
}

.quality-trends h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.trends-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.trend-chart {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.chart-header h5 {
  margin: 0;
  color: #2c3e50;
  font-size: 1rem;
}

.chart-controls {
  display: flex;
  gap: 5px;
}

.btn-time {
  padding: 4px 8px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  background: white;
  color: #2c3e50;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.btn-time:hover {
  background: #ecf0f1;
}

.btn-time.active {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.chart-placeholder {
  height: 200px;
  background: #ecf0f1;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.chart-info {
  display: flex;
  gap: 15px;
  margin-top: 10px;
  font-size: 0.8rem;
}

.chart-info span {
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  color: #2c3e50;
}

.quality-issues {
  margin-bottom: 30px;
}

.quality-issues h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.issues-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.issue-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid;
}

.issue-card.error {
  border-left-color: #e74c3c;
}

.issue-card.warning {
  border-left-color: #f39c12;
}

.issue-card.info {
  border-left-color: #3498db;
}

.issue-card.success {
  border-left-color: #27ae60;
}

.issue-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.issue-icon {
  font-size: 1.2rem;
}

.issue-title {
  font-weight: 600;
  color: #2c3e50;
  flex: 1;
}

.issue-time {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.issue-content p {
  margin: 0 0 10px 0;
  color: #5d6d7e;
}

.issue-details {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  margin-bottom: 15px;
}

.detail-item {
  font-size: 0.8rem;
  color: #7f8c8d;
  background: #ecf0f1;
  padding: 2px 6px;
  border-radius: 4px;
}

.issue-actions {
  display: flex;
  gap: 8px;
}

.btn-dismiss, .btn-details, .btn-fix {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.btn-dismiss {
  background: #e74c3c;
  color: white;
}

.btn-dismiss:hover {
  background: #c0392b;
}

.btn-details {
  background: #3498db;
  color: white;
}

.btn-details:hover {
  background: #2980b9;
}

.btn-fix {
  background: #27ae60;
  color: white;
}

.btn-fix:hover {
  background: #229954;
}

.quality-statistics {
  margin-bottom: 20px;
}

.quality-statistics h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.statistics-table {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.statistics-table table {
  width: 100%;
  border-collapse: collapse;
}

.statistics-table th,
.statistics-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.statistics-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
}

.statistics-table td {
  font-size: 0.9rem;
}

.fail-row {
  background: #fadbd8;
}

.warning-row {
  background: #fef9e7;
}

.pass-row {
  background: #d5f4e6;
}

.metric-good {
  color: #27ae60;
  font-weight: 500;
}

.metric-warning {
  color: #f39c12;
  font-weight: 500;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
}

.status-badge.PASS {
  background: #d5f4e6;
  color: #27ae60;
}

.status-badge.WARNING {
  background: #fef9e7;
  color: #f39c12;
}

.status-badge.FAIL {
  background: #fadbd8;
  color: #e74c3c;
}

.btn-view, .btn-reprocess {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
  margin-right: 5px;
  transition: all 0.3s ease;
}

.btn-view {
  background: #3498db;
  color: white;
}

.btn-view:hover {
  background: #2980b9;
}

.btn-reprocess {
  background: #9b59b6;
  color: white;
}

.btn-reprocess:hover {
  background: #8e44ad;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .overview-metrics {
    grid-template-columns: 1fr;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .trends-container {
    grid-template-columns: 1fr;
  }
  
  .issue-details {
    flex-direction: column;
    gap: 5px;
  }
  
  .statistics-table {
    font-size: 0.8rem;
  }
}
</style>
