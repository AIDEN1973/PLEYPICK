<template>
  <div class="quality-healing-dashboard">
    <!-- 헤더 -->
    <div class="dashboard-header">
      <h2>📊 품질 회복 자동률 대시보드</h2>
      <p class="subtitle">QA FAIL → 재렌더링 → PASS 자동 회복률 분석</p>
    </div>

    <!-- 통계 카드들 -->
    <div class="stats-grid">
      <div class="stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <h3>전체 성공률</h3>
          <div class="stat-value">{{ overallStats.overall_success_rate }}%</div>
          <div class="stat-detail">{{ overallStats.successful_checks }} / {{ overallStats.total_qa_checks }} 체크</div>
        </div>
      </div>

      <div class="stat-card recovery">
        <div class="stat-icon">🔄</div>
        <div class="stat-content">
          <h3>재시도 성공률</h3>
          <div class="stat-value">{{ retryStats.retry_success_rate }}%</div>
          <div class="stat-detail">{{ retryStats.successful_retries }} / {{ retryStats.total_retries }} 재시도</div>
        </div>
      </div>

      <div class="stat-card healing">
        <div class="stat-icon">🎯</div>
        <div class="stat-content">
          <h3>자동 회복률</h3>
          <div class="stat-value">{{ healingRate }}%</div>
          <div class="stat-detail">최근 24시간 기준</div>
        </div>
      </div>

      <div class="stat-card quality">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <h3>평균 품질</h3>
          <div class="stat-value">{{ avgQuality.toFixed(3) }}</div>
          <div class="stat-detail">SSIM: {{ avgSSIM.toFixed(3) }}</div>
        </div>
      </div>
    </div>

    <!-- 실패 원인별 회복률 분석 -->
    <div class="failure-analysis">
      <h3>🔍 실패 원인별 회복률 분석</h3>
      <div class="failure-grid">
        <div 
          v-for="failure in failureAnalysis" 
          :key="failure.failure_type"
          class="failure-card"
          :class="getFailureTypeClass(failure.failure_type)"
        >
          <div class="failure-header">
            <span class="failure-type">{{ getFailureTypeLabel(failure.failure_type) }}</span>
            <span class="recovery-rate">{{ failure.recovery_rate_percent }}%</span>
          </div>
          <div class="failure-stats">
            <div class="stat-row">
              <span>총 실패:</span>
              <span>{{ failure.total_failures }}회</span>
            </div>
            <div class="stat-row">
              <span>회복:</span>
              <span>{{ failure.recovered_failures }}회</span>
            </div>
            <div class="stat-row">
              <span>평균 SSIM:</span>
              <span>{{ failure.avg_ssim.toFixed(3) }}</span>
            </div>
            <div class="stat-row">
              <span>평균 SNR:</span>
              <span>{{ failure.avg_snr.toFixed(1) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 시간별 품질 회복 트렌드 -->
    <div class="trend-analysis">
      <h3>📈 시간별 품질 회복 트렌드</h3>
      <div class="trend-chart">
        <canvas ref="trendChart" width="800" height="300"></canvas>
      </div>
    </div>

    <!-- 부품별 회복 히스토리 -->
    <div class="part-history">
      <h3>🔧 부품별 회복 히스토리</h3>
      <div class="history-table">
        <table>
          <thead>
            <tr>
              <th>부품 ID</th>
              <th>총 시도</th>
              <th>성공</th>
              <th>회복률</th>
              <th>평균 SSIM</th>
              <th>마지막 체크</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="part in partHistory" 
              :key="part.part_id"
              :class="getPartStatusClass(part.healing_rate_percent)"
            >
              <td>{{ part.part_id }}</td>
              <td>{{ part.total_attempts }}</td>
              <td>{{ part.successful_attempts }}</td>
              <td>
                <div class="progress-bar">
                  <div 
                    class="progress-fill" 
                    :style="{ width: part.healing_rate_percent + '%' }"
                  ></div>
                  <span class="progress-text">{{ part.healing_rate_percent }}%</span>
                </div>
              </td>
              <td>{{ part.avg_ssim.toFixed(3) }}</td>
              <td>{{ formatDate(part.last_attempt) }}</td>
              <td>
                <span class="status-badge" :class="getPartStatusClass(part.healing_rate_percent)">
                  {{ getPartStatusText(part.healing_rate_percent) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 새로고침 버튼 -->
    <div class="dashboard-actions">
      <button @click="refreshData" class="refresh-btn" :disabled="loading">
        <span v-if="loading">🔄</span>
        <span v-else>🔄</span>
        {{ loading ? '새로고침 중...' : '데이터 새로고침' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useSupabase } from '../composables/useSupabase.js'
import Chart from 'chart.js/auto'

// Supabase 클라이언트
const { supabase } = useSupabase()

// 반응형 데이터
const loading = ref(false)
const overallStats = ref({})
const retryStats = ref({})
const failureAnalysis = ref([])
const partHistory = ref([])
const trendData = ref([])
const trendChart = ref(null)

// 계산된 속성
const healingRate = computed(() => {
  if (overallStats.value.overall_success_rate && retryStats.value.retry_success_rate) {
    return Math.round((overallStats.value.overall_success_rate + retryStats.value.retry_success_rate) / 2)
  }
  return 0
})

const avgQuality = computed(() => {
  if (overallStats.value.avg_ssim) {
    return overallStats.value.avg_ssim
  }
  return 0
})

const avgSSIM = computed(() => {
  if (overallStats.value.avg_ssim) {
    return overallStats.value.avg_ssim
  }
  return 0
})

// 메서드들
const refreshData = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadOverallStats(),
      loadRetryStats(),
      loadFailureAnalysis(),
      loadPartHistory(),
      loadTrendData()
    ])
  } catch (error) {
    console.error('데이터 새로고침 실패:', error)
  } finally {
    loading.value = false
  }
}

const loadOverallStats = async () => {
  try {
    const { data, error } = await supabase
      .from('auto_recovery_dashboard')
      .select('*')
      .eq('category', '전체 시스템')
      .single()
    
    if (error) throw error
    overallStats.value = data
  } catch (error) {
    console.error('전체 통계 로드 실패:', error)
  }
}

const loadRetryStats = async () => {
  try {
    const { data, error } = await supabase
      .from('auto_recovery_dashboard')
      .select('*')
      .eq('category', '재시도 성공률')
      .single()
    
    if (error) throw error
    retryStats.value = data
  } catch (error) {
    console.error('재시도 통계 로드 실패:', error)
  }
}

const loadFailureAnalysis = async () => {
  try {
    const { data, error } = await supabase
      .from('failure_recovery_analysis')
      .select('*')
      .order('recovery_rate_percent', { ascending: false })
    
    if (error) throw error
    failureAnalysis.value = data || []
  } catch (error) {
    console.error('실패 분석 로드 실패:', error)
  }
}

const loadPartHistory = async () => {
  try {
    const { data, error } = await supabase
      .from('quality_healing_rate')
      .select('*')
      .order('healing_rate_percent', { ascending: false })
      .limit(20)
    
    if (error) throw error
    partHistory.value = data || []
  } catch (error) {
    console.error('부품 히스토리 로드 실패:', error)
  }
}

const loadTrendData = async () => {
  try {
    const { data, error } = await supabase
      .from('quality_healing_trends')
      .select('*')
      .order('date', { ascending: true })
      .limit(30)
    
    if (error) throw error
    trendData.value = data || []
    
    // 차트 업데이트
    if (trendChart.value) {
      updateTrendChart()
    }
  } catch (error) {
    console.error('트렌드 데이터 로드 실패:', error)
  }
}

const updateTrendChart = () => {
  if (!trendChart.value || !trendData.value.length) return
  
  const ctx = trendChart.value.getContext('2d')
  
  // 기존 차트 제거
  if (window.trendChartInstance) {
    window.trendChartInstance.destroy()
  }
  
  window.trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.value.map(d => new Date(d.date).toLocaleDateString()),
      datasets: [
        {
          label: '일일 회복률 (%)',
          data: trendData.value.map(d => d.daily_healing_rate),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        },
        {
          label: '평균 SSIM',
          data: trendData.value.map(d => d.avg_ssim * 100),
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '회복률 (%)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'SSIM × 100'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      },
      plugins: {
        title: {
          display: true,
          text: '품질 회복 트렌드 (최근 30일)'
        }
      }
    }
  })
}

// 유틸리티 함수들
const getFailureTypeLabel = (type) => {
  const labels = {
    'fail_ssim': 'SSIM 실패',
    'fail_sharpness': 'Sharpness 실패',
    'fail_pnp': 'PnP 실패',
    'fail_snr': 'SNR 실패',
    'fail_depth': 'Depth 실패',
    'fail_noise': 'Noise 실패',
    'fail_contrast': 'Contrast 실패',
    'other': '기타'
  }
  return labels[type] || type
}

const getFailureTypeClass = (type) => {
  const classes = {
    'fail_ssim': 'ssim-failure',
    'fail_sharpness': 'sharpness-failure',
    'fail_pnp': 'pnp-failure',
    'fail_snr': 'snr-failure',
    'fail_depth': 'depth-failure',
    'fail_noise': 'noise-failure',
    'fail_contrast': 'contrast-failure',
    'other': 'other-failure'
  }
  return classes[type] || 'other-failure'
}

const getPartStatusClass = (rate) => {
  if (rate >= 90) return 'excellent'
  if (rate >= 70) return 'good'
  if (rate >= 50) return 'fair'
  return 'poor'
}

const getPartStatusText = (rate) => {
  if (rate >= 90) return '우수'
  if (rate >= 70) return '양호'
  if (rate >= 50) return '보통'
  return '개선필요'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ko-KR')
}

// 컴포넌트 마운트 시 데이터 로드
onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.quality-healing-dashboard {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 30px;
}

.dashboard-header h2 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.subtitle {
  color: #7f8c8d;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-card.success {
  border-left: 4px solid #4CAF50;
}

.stat-card.recovery {
  border-left: 4px solid #2196F3;
}

.stat-card.healing {
  border-left: 4px solid #FF9800;
}

.stat-card.quality {
  border-left: 4px solid #9C27B0;
}

.stat-icon {
  font-size: 32px;
}

.stat-content h3 {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 14px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #2c3e50;
}

.stat-detail {
  font-size: 12px;
  color: #7f8c8d;
}

.failure-analysis {
  margin-bottom: 30px;
}

.failure-analysis h3 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.failure-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 15px;
}

.failure-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.failure-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.failure-type {
  font-weight: bold;
  color: #2c3e50;
}

.recovery-rate {
  font-size: 18px;
  font-weight: bold;
  color: #4CAF50;
}

.failure-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.trend-analysis {
  margin-bottom: 30px;
}

.trend-analysis h3 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.trend-chart {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.part-history {
  margin-bottom: 30px;
}

.part-history h3 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.history-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f8f9fa;
  font-weight: bold;
  color: #2c3e50;
}

.progress-bar {
  position: relative;
  background: #e0e0e0;
  border-radius: 10px;
  height: 20px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  font-weight: bold;
  color: #2c3e50;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.excellent {
  background: #E8F5E8;
  color: #4CAF50;
}

.status-badge.good {
  background: #E3F2FD;
  color: #2196F3;
}

.status-badge.fair {
  background: #FFF3E0;
  color: #FF9800;
}

.status-badge.poor {
  background: #FFEBEE;
  color: #F44336;
}

.dashboard-actions {
  text-align: center;
  margin-top: 30px;
}

.refresh-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: #1976D2;
}

.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .failure-grid {
    grid-template-columns: 1fr;
  }
  
  .history-table {
    overflow-x: auto;
  }
}
</style>
