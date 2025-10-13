<template>
  <div class="quality-metrics-dashboard">
    <div class="dashboard-header">
      <h3>📊 품질 지표 대시보드</h3>
      <div class="summary-stats">
        <div class="stat-badge pass">
          <span class="stat-icon">✅</span>
          <div class="stat-content">
            <span class="stat-value">{{ passedCount }}</span>
            <span class="stat-label">PASS ({{ passRate }}%)</span>
          </div>
        </div>
        <div class="stat-badge warning">
          <span class="stat-icon">⚠️</span>
          <div class="stat-content">
            <span class="stat-value">{{ warningCount }}</span>
            <span class="stat-label">경고</span>
          </div>
        </div>
        <div class="stat-badge error">
          <span class="stat-icon">❌</span>
          <div class="stat-content">
            <span class="stat-value">{{ errorCount }}</span>
            <span class="stat-label">실패</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 차트 그리드 -->
    <div class="charts-grid">
      <!-- SSIM 차트 -->
      <div class="chart-card">
        <div class="chart-header">
          <h4>SSIM (구조적 유사도)</h4>
          <span class="threshold-badge">임계값: ≥0.965</span>
        </div>
        <div class="chart-container">
          <Bar :data="ssimChartData" :options="barChartOptions('SSIM', 0.965, 1.0)" />
        </div>
      </div>

      <!-- SNR 차트 -->
      <div class="chart-card">
        <div class="chart-header">
          <h4>SNR (신호대잡음비)</h4>
          <span class="threshold-badge">임계값: ≥30 dB</span>
        </div>
        <div class="chart-container">
          <Bar :data="snrChartData" :options="barChartOptions('SNR', 30, 50)" />
        </div>
      </div>

      <!-- Reprojection Error 차트 -->
      <div class="chart-card">
        <div class="chart-header">
          <h4>Reprojection Error (재투영 오차)</h4>
          <span class="threshold-badge">임계값: ≤1.5 px</span>
        </div>
        <div class="chart-container">
          <Bar :data="reprojectionChartData" :options="barChartOptions('Reprojection', 0, 1.5, true)" />
        </div>
      </div>

      <!-- Depth Quality Score 차트 -->
      <div class="chart-card">
        <div class="chart-header">
          <h4>Depth Quality Score (깊이 품질)</h4>
          <span class="threshold-badge">임계값: ≥0.85</span>
        </div>
        <div class="chart-container">
          <Bar :data="depthChartData" :options="barChartOptions('Depth', 0.85, 1.0)" />
        </div>
      </div>

      <!-- 종합 레이더 차트 -->
      <div class="chart-card radar-card">
        <div class="chart-header">
          <h4>종합 품질 분석 (평균값)</h4>
          <span class="threshold-badge">정규화 기준</span>
        </div>
        <div class="chart-container">
          <Radar :data="radarChartData" :options="radarChartOptions" />
        </div>
      </div>

      <!-- Mask/BBox Ratio 차트 -->
      <div class="chart-card">
        <div class="chart-header">
          <h4>Mask/BBox Ratio (마스크 비율)</h4>
          <span class="threshold-badge">정상범위: 25-98%</span>
        </div>
        <div class="chart-container">
          <Bar :data="maskRatioChartData" :options="barChartOptions('Mask/BBox', 0.25, 0.98)" />
        </div>
      </div>
    </div>

    <!-- 상세 테이블 -->
    <div class="quality-table-card">
      <h4>📋 상세 품질 데이터</h4>
      <div class="table-container">
        <table class="quality-table">
          <thead>
            <tr>
              <th>부품 ID</th>
              <th>Element ID</th>
              <th>SSIM</th>
              <th>SNR (dB)</th>
              <th>Reprojection (px)</th>
              <th>Depth Score</th>
              <th>Mask Ratio (%)</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(result, index) in renderResults" :key="index" 
                :class="getRowClass(result)">
              <td>{{ result.partId }}</td>
              <td>{{ result.elementId || '-' }}</td>
              <td :class="getMetricClass(result.metrics.ssim, 0.965, true)">
                {{ result.metrics.ssim.toFixed(3) }}
              </td>
              <td :class="getMetricClass(result.metrics.snr, 30, true)">
                {{ result.metrics.snr.toFixed(1) }}
              </td>
              <td :class="getMetricClass(result.metrics.reprojection, 1.5, false)">
                {{ result.metrics.reprojection.toFixed(2) }}
              </td>
              <td :class="getMetricClass(result.metrics.depthScore, 0.85, true)">
                {{ result.metrics.depthScore.toFixed(2) }}
              </td>
              <td :class="getMaskRatioClass(result.metrics.maskBboxRatio)">
                {{ (result.metrics.maskBboxRatio * 100).toFixed(1) }}%
              </td>
              <td>
                <span v-if="result.warnings.length === 0" class="status-badge pass">✅ PASS</span>
                <span v-else-if="hasError(result.warnings)" class="status-badge error">❌ 실패</span>
                <span v-else class="status-badge warning">⚠️ 경고</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar, Radar } from 'vue-chartjs'
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js'

// Chart.js 등록
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title, 
  Tooltip, 
  Legend,
  Filler
)

const props = defineProps({
  renderResults: {
    type: Array,
    required: true
  }
})

// 통계 계산
const passedCount = computed(() => 
  props.renderResults.filter(r => r.warnings.length === 0).length
)

const warningCount = computed(() => 
  props.renderResults.filter(r => 
    r.warnings.length > 0 && !r.warnings.some(w => w.type === 'error')
  ).length
)

const errorCount = computed(() => 
  props.renderResults.filter(r => 
    r.warnings.some(w => w.type === 'error')
  ).length
)

const passRate = computed(() => 
  props.renderResults.length > 0 
    ? ((passedCount.value / props.renderResults.length) * 100).toFixed(1)
    : '0.0'
)

// 차트 데이터 생성
const ssimChartData = computed(() => ({
  labels: props.renderResults.map(r => r.partId || r.elementId),
  datasets: [{
    label: 'SSIM',
    data: props.renderResults.map(r => r.metrics.ssim),
    backgroundColor: props.renderResults.map(r => 
      r.metrics.ssim >= 0.965 
        ? 'rgba(75, 192, 192, 0.6)' 
        : 'rgba(255, 99, 132, 0.6)'
    ),
    borderColor: props.renderResults.map(r => 
      r.metrics.ssim >= 0.965 
        ? 'rgb(75, 192, 192)' 
        : 'rgb(255, 99, 132)'
    ),
    borderWidth: 2
  }]
}))

const snrChartData = computed(() => ({
  labels: props.renderResults.map(r => r.partId || r.elementId),
  datasets: [{
    label: 'SNR (dB)',
    data: props.renderResults.map(r => r.metrics.snr),
    backgroundColor: props.renderResults.map(r => 
      r.metrics.snr >= 30 
        ? 'rgba(54, 162, 235, 0.6)' 
        : 'rgba(255, 159, 64, 0.6)'
    ),
    borderColor: props.renderResults.map(r => 
      r.metrics.snr >= 30 
        ? 'rgb(54, 162, 235)' 
        : 'rgb(255, 159, 64)'
    ),
    borderWidth: 2
  }]
}))

const reprojectionChartData = computed(() => ({
  labels: props.renderResults.map(r => r.partId || r.elementId),
  datasets: [{
    label: 'Reprojection Error (px)',
    data: props.renderResults.map(r => r.metrics.reprojection),
    backgroundColor: props.renderResults.map(r => 
      r.metrics.reprojection <= 1.5 
        ? 'rgba(153, 102, 255, 0.6)' 
        : 'rgba(255, 99, 132, 0.6)'
    ),
    borderColor: props.renderResults.map(r => 
      r.metrics.reprojection <= 1.5 
        ? 'rgb(153, 102, 255)' 
        : 'rgb(255, 99, 132)'
    ),
    borderWidth: 2
  }]
}))

const depthChartData = computed(() => ({
  labels: props.renderResults.map(r => r.partId || r.elementId),
  datasets: [{
    label: 'Depth Quality Score',
    data: props.renderResults.map(r => r.metrics.depthScore),
    backgroundColor: props.renderResults.map(r => 
      r.metrics.depthScore >= 0.85 
        ? 'rgba(75, 192, 192, 0.6)' 
        : 'rgba(255, 206, 86, 0.6)'
    ),
    borderColor: props.renderResults.map(r => 
      r.metrics.depthScore >= 0.85 
        ? 'rgb(75, 192, 192)' 
        : 'rgb(255, 206, 86)'
    ),
    borderWidth: 2
  }]
}))

const maskRatioChartData = computed(() => ({
  labels: props.renderResults.map(r => r.partId || r.elementId),
  datasets: [{
    label: 'Mask/BBox Ratio',
    data: props.renderResults.map(r => r.metrics.maskBboxRatio),
    backgroundColor: props.renderResults.map(r => {
      const ratio = r.metrics.maskBboxRatio
      return (ratio >= 0.25 && ratio <= 0.98)
        ? 'rgba(54, 162, 235, 0.6)' 
        : 'rgba(255, 99, 132, 0.6)'
    }),
    borderColor: props.renderResults.map(r => {
      const ratio = r.metrics.maskBboxRatio
      return (ratio >= 0.25 && ratio <= 0.98)
        ? 'rgb(54, 162, 235)' 
        : 'rgb(255, 99, 132)'
    }),
    borderWidth: 2
  }]
}))

// 레이더 차트 데이터 (평균값 정규화)
const radarChartData = computed(() => {
  const avgSSIM = props.renderResults.reduce((sum, r) => sum + r.metrics.ssim, 0) / props.renderResults.length || 0
  const avgSNR = props.renderResults.reduce((sum, r) => sum + r.metrics.snr, 0) / props.renderResults.length || 0
  const avgReproj = props.renderResults.reduce((sum, r) => sum + r.metrics.reprojection, 0) / props.renderResults.length || 0
  const avgDepth = props.renderResults.reduce((sum, r) => sum + r.metrics.depthScore, 0) / props.renderResults.length || 0
  const avgMask = props.renderResults.reduce((sum, r) => sum + r.metrics.maskBboxRatio, 0) / props.renderResults.length || 0
  
  return {
    labels: ['SSIM', 'SNR', 'Reprojection (반전)', 'Depth Score', 'Mask Ratio'],
    datasets: [{
      label: '평균 품질 지표',
      data: [
        avgSSIM * 100,                    // SSIM (0-1 → 0-100)
        (avgSNR / 50) * 100,              // SNR (0-50 → 0-100)
        (1 - avgReproj / 3) * 100,        // Reprojection 반전 (0-3 → 100-0)
        avgDepth * 100,                   // Depth Score (0-1 → 0-100)
        avgMask * 100                     // Mask Ratio (0-1 → 0-100)
      ],
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgb(54, 162, 235)',
      pointBackgroundColor: 'rgb(54, 162, 235)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgb(54, 162, 235)',
      borderWidth: 2
    }]
  }
})

// 차트 옵션
const barChartOptions = (label, threshold, maxValue, inverted = false) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context) => `${label}: ${context.parsed.y.toFixed(3)}`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      max: maxValue,
      ticks: {
        callback: (value) => value.toFixed(2)
      }
    }
  },
  annotation: {
    annotations: [{
      type: 'line',
      yMin: threshold,
      yMax: threshold,
      borderColor: inverted ? 'rgb(255, 99, 132)' : 'rgb(75, 192, 192)',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        content: `임계값: ${threshold}`,
        enabled: true,
        position: 'end'
      }
    }]
  }
})

const radarChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    r: {
      beginAtZero: true,
      max: 100,
      ticks: {
        stepSize: 20
      }
    }
  },
  plugins: {
    legend: {
      position: 'bottom'
    }
  }
}

// 유틸리티 함수
const getRowClass = (result) => {
  if (result.warnings.length === 0) return 'row-pass'
  if (result.warnings.some(w => w.type === 'error')) return 'row-error'
  return 'row-warning'
}

const getMetricClass = (value, threshold, higherIsBetter) => {
  const pass = higherIsBetter ? value >= threshold : value <= threshold
  return pass ? 'metric-pass' : 'metric-fail'
}

const getMaskRatioClass = (ratio) => {
  return (ratio >= 0.25 && ratio <= 0.98) ? 'metric-pass' : 'metric-fail'
}

const hasError = (warnings) => {
  return warnings.some(w => w.type === 'error')
}
</script>

<style scoped>
.quality-metrics-dashboard {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 24px;
  margin: 24px 0;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 24px;
}

.summary-stats {
  display: flex;
  gap: 16px;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stat-badge.pass {
  border-left: 4px solid #4caf50;
}

.stat-badge.warning {
  border-left: 4px solid #ff9800;
}

.stat-badge.error {
  border-left: 4px solid #f44336;
}

.stat-icon {
  font-size: 24px;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.stat-label {
  font-size: 12px;
  color: #7f8c8d;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.chart-card.radar-card {
  grid-column: span 2;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
}

.threshold-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.chart-container {
  height: 250px;
}

.quality-table-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.quality-table-card h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.table-container {
  overflow-x: auto;
}

.quality-table {
  width: 100%;
  border-collapse: collapse;
}

.quality-table th {
  background: #f5f5f5;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #e0e0e0;
}

.quality-table td {
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.quality-table tr.row-pass {
  background: #f1f8f4;
}

.quality-table tr.row-warning {
  background: #fff8e1;
}

.quality-table tr.row-error {
  background: #ffebee;
}

.metric-pass {
  color: #4caf50;
  font-weight: 600;
}

.metric-fail {
  color: #f44336;
  font-weight: 600;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.pass {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.warning {
  background: #fff3e0;
  color: #e65100;
}

.status-badge.error {
  background: #ffebee;
  color: #c62828;
}
</style>

