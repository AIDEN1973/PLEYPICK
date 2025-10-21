<template>
  <div class="render-optimization-dashboard">
    <!-- 헤더 -->
    <div class="dashboard-header">
      <h1>🚀 렌더링 최적화 대시보드</h1>
      <div class="header-controls">
        <button @click="refreshData" :disabled="loading" class="btn btn-primary">
          <span v-if="loading">🔄 로딩 중...</span>
          <span v-else>🔄 새로고침</span>
        </button>
        <button @click="exportReport" class="btn btn-secondary">
          📊 리포트 내보내기
        </button>
      </div>
    </div>

    <!-- 데이터 없음 메시지 -->
    <div v-if="!auditData.files || auditData.files === 0" class="no-data-message">
      <div class="no-data-icon">📊</div>
      <h2>데이터가 없습니다</h2>
      <p>렌더링 최적화 분석을 위해 먼저 진단을 실행해주세요.</p>
      <button @click="refreshData" :disabled="loading" class="btn btn-primary">
        <span v-if="loading">🔄 분석 중...</span>
        <span v-else>🚀 진단 실행</span>
      </button>
    </div>

    <!-- 메트릭 카드들 -->
    <div v-else class="metrics-grid">
      <div class="metric-card">
        <div class="metric-icon">📁</div>
        <div class="metric-content">
          <div class="metric-value">{{ auditData.files || 0 }}</div>
          <div class="metric-label">스캔 파일 수</div>
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">⏱️</div>
        <div class="metric-content">
          <div class="metric-value">{{ auditData.baseline_sec?.toFixed(3) || '0.000' }}s</div>
          <div class="metric-label">현재 렌더 시간</div>
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">🎯</div>
        <div class="metric-content">
          <div class="metric-value">{{ auditData.samples?.mean?.toFixed(0) || '0' }}</div>
          <div class="metric-label">평균 샘플 수</div>
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">🚀</div>
        <div class="metric-content">
          <div class="metric-value">{{ maxSpeedup.toFixed(1) }}x</div>
          <div class="metric-label">최대 속도 향상</div>
        </div>
      </div>
    </div>

    <!-- 품질-속도 Trade-off 차트 -->
    <div v-if="auditData.files && auditData.files > 0" class="chart-section">
      <h2>📊 품질-속도 Trade-off 분석</h2>
      <div class="chart-container">
        <canvas ref="tradeoffChart" width="800" height="400"></canvas>
      </div>
    </div>

    <!-- 시나리오 비교 테이블 -->
    <div v-if="auditData.files && auditData.files > 0" class="scenarios-section">
      <h2>🎯 최적화 시나리오</h2>
      <div class="scenarios-table">
        <table>
          <thead>
            <tr>
              <th>시나리오</th>
              <th>예상 시간</th>
              <th>속도 향상</th>
              <th>품질 영향</th>
              <th>권장도</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(scenario, key) in auditData.scenarios" :key="key" 
                :class="getScenarioRowClass(key)">
              <td class="scenario-name">
                <strong>{{ getScenarioDisplayName(key) }}</strong>
                <div class="scenario-notes">{{ scenario.notes }}</div>
              </td>
              <td class="time-value">{{ scenario.time_sec.toFixed(3) }}s</td>
              <td class="speedup-value">
                <span class="speedup-badge">{{ scenario.x.toFixed(2) }}x</span>
              </td>
              <td class="quality-impact">
                <div v-if="scenario.quality_impact" class="quality-indicator">
                  <span class="quality-badge" :class="getQualityClass(scenario.quality_impact.quality_impact)">
                    {{ getQualityDisplay(scenario.quality_impact) }}
                  </span>
                </div>
                <span v-else class="no-impact">영향 없음</span>
              </td>
              <td class="recommendation">
                <span class="recommendation-badge" :class="getRecommendationClass(key)">
                  {{ getRecommendationText(key) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 그룹별 분석 -->
    <div v-if="auditData.files && auditData.files > 0 && auditData.groups && Object.keys(auditData.groups).length > 0" class="groups-section">
      <h2>📈 그룹별 분석</h2>
      <div class="groups-grid">
        <div v-for="(group, name) in auditData.groups" :key="name" class="group-card">
          <h3>{{ name || 'Unknown' }}</h3>
          <div class="group-metrics">
            <div class="group-metric">
              <span class="metric-label">파일 수:</span>
              <span class="metric-value">{{ group.count }}</span>
            </div>
            <div class="group-metric">
              <span class="metric-label">평균 샘플:</span>
              <span class="metric-value">{{ group.samples.mean.toFixed(0) }}</span>
            </div>
            <div class="group-metric">
              <span class="metric-label">투명 부품:</span>
              <span class="metric-value">{{ (group.transparent_ratio * 100).toFixed(1) }}%</span>
            </div>
            <div class="group-metric">
              <span class="metric-label">밝은 부품:</span>
              <span class="metric-value">{{ (group.bright_ratio * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 권장사항 -->
    <div v-if="auditData.files && auditData.files > 0" class="recommendations-section">
      <h2>💡 최적화 권장사항</h2>
      <div class="recommendations-list">
        <div v-for="(rec, index) in auditData.recommendations" :key="index" class="recommendation-item">
          <span class="recommendation-number">{{ index + 1 }}</span>
          <span class="recommendation-text">{{ rec }}</span>
        </div>
      </div>
    </div>

    <!-- 로딩 오버레이 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <div class="loading-text">데이터 분석 중...</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, nextTick } from 'vue'
import Chart from 'chart.js/auto'

export default {
  name: 'RenderOptimizationDashboard',
  setup() {
    const loading = ref(false)
    const auditData = ref({})
    const tradeoffChart = ref(null)
    let chartInstance = null

    // 최대 속도 향상 계산
    const maxSpeedup = computed(() => {
      if (!auditData.value.scenarios) return 0
      const speeds = Object.values(auditData.value.scenarios)
        .map(s => s.x)
        .filter(x => x > 1)
      return Math.max(...speeds, 0)
    })

    // API 기본 URL 설정 (동적 포트 감지)
    const getApiUrl = async () => {
      try {
        // 포트 설정 파일에서 Synthetic API 포트 읽기
        const response = await fetch('/.synthetic-api-port.json')
        if (response.ok) {
          const portInfo = await response.json()
          return `http://localhost:${portInfo.port}`
        }
      } catch (error) {
        console.warn('포트 설정 파일을 읽을 수 없습니다, 기본 포트 사용:', error)
      }
      
      // 기본 포트들 시도
      const defaultPorts = [3011, 3016, 3010, 3015]
      for (const port of defaultPorts) {
        try {
          const testResponse = await fetch(`http://localhost:${port}/api/render-optimization/status`, {
            method: 'GET',
            signal: AbortSignal.timeout(1000) // 1초 타임아웃
          })
          if (testResponse.ok) {
            return `http://localhost:${port}`
          }
        } catch (error) {
          // 다음 포트 시도
          continue
        }
      }
      
      // 모든 포트 실패 시 기본값
      return 'http://localhost:3011'
    }

    // 데이터 새로고침
    const refreshData = async () => {
      loading.value = true
      try {
        const apiUrl = await getApiUrl()
        console.log('API URL:', apiUrl)
        
        const requestBody = {
          glob: 'output/synthetic/*/*.json',
          auto_baseline: true,
          quality_simulation: true,
          group_by: 'shape_tag'
        }
        console.log('Request body:', requestBody)
        
        const response = await fetch(`${apiUrl}/api/render-optimization/audit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })
        
        console.log('Response status:', response.status)
        console.log('Response headers:', response.headers)
        
        if (response.ok) {
          const result = await response.json()
          console.log('API Response:', result)
          auditData.value = result.data || result
          await nextTick()
          createTradeoffChart()
        } else {
          const errorText = await response.text()
          console.error('데이터 로드 실패:', response.status, errorText)
          alert(`데이터 로드 실패: ${response.status} - ${errorText}`)
        }
      } catch (error) {
        console.error('데이터 로드 오류:', error)
        alert(`데이터 로드 오류: ${error.message}`)
      } finally {
        loading.value = false
      }
    }


    // Trade-off 차트 생성
    const createTradeoffChart = () => {
      if (!tradeoffChart.value || !auditData.value.scenarios) return

      const ctx = tradeoffChart.value.getContext('2d')
      
      // 기존 차트 제거
      if (chartInstance) {
        chartInstance.destroy()
      }

      const scenarios = auditData.value.scenarios
      const data = Object.entries(scenarios).map(([key, scenario]) => ({
        x: scenario.time_sec,
        y: scenario.quality_impact?.ssim_drop ? (1 - scenario.quality_impact.ssim_drop) * 100 : 100,
        label: getScenarioDisplayName(key),
        speedup: scenario.x,
        quality: scenario.quality_impact?.quality_impact || 'none'
      }))

      chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: '시나리오',
            data: data,
            backgroundColor: data.map(d => getQualityColor(d.quality)),
            borderColor: data.map(d => getQualityColor(d.quality)),
            borderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 10
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: '품질-속도 Trade-off 분석'
            },
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                title: (context) => context[0].raw.label,
                label: (context) => [
                  `시간: ${context.raw.x.toFixed(3)}s`,
                  `속도 향상: ${context.raw.speedup.toFixed(2)}x`,
                  `품질 유지: ${context.raw.y.toFixed(1)}%`
                ]
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: '렌더 시간 (초)'
              },
              type: 'linear',
              position: 'bottom'
            },
            y: {
              title: {
                display: true,
                text: '품질 유지율 (%)'
              },
              min: 90,
              max: 100
            }
          }
        }
      })
    }

    // 유틸리티 함수들
    const getScenarioDisplayName = (key) => {
      const names = {
        current: '현재 상태',
        once_render_low: '1회 렌더 (낙관적)',
        once_render_high: '1회 렌더 (보수적)',
        rerender_low: '재렌더 (낙관적)',
        rerender_high: '재렌더 (보수적)'
      }
      return names[key] || key
    }

    const getScenarioRowClass = (key) => {
      if (key === 'current') return 'current-row'
      if (key.includes('low')) return 'optimistic-row'
      if (key.includes('high')) return 'conservative-row'
      return ''
    }

    const getQualityClass = (quality) => {
      return {
        'quality-low': quality === 'low',
        'quality-medium': quality === 'medium',
        'quality-high': quality === 'high'
      }
    }

    const getQualityDisplay = (impact) => {
      return `SSIM -${(impact.ssim_drop * 100).toFixed(1)}%, SNR -${(impact.snr_drop * 100).toFixed(1)}%`
    }

    const getQualityColor = (quality) => {
      const colors = {
        low: '#4CAF50',
        medium: '#FF9800',
        high: '#F44336',
        none: '#9E9E9E'
      }
      return colors[quality] || colors.none
    }

    const getRecommendationClass = (key) => {
      if (key === 'current') return 'not-recommended'
      if (key.includes('low')) return 'highly-recommended'
      if (key.includes('high')) return 'moderately-recommended'
      return ''
    }

    const getRecommendationText = (key) => {
      if (key === 'current') return '현재 상태'
      if (key.includes('low')) return '강력 권장'
      if (key.includes('high')) return '보통 권장'
      return '검토 필요'
    }

    const exportReport = () => {
      const dataStr = JSON.stringify(auditData.value, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `render-optimization-report-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
    }

    onMounted(() => {
      // 페이지 로드 시 자동으로 데이터 새로고침
      refreshData()
    })

    return {
      loading,
      auditData,
      tradeoffChart,
      maxSpeedup,
      refreshData,
      exportReport,
      getScenarioDisplayName,
      getScenarioRowClass,
      getQualityClass,
      getQualityDisplay,
      getRecommendationClass,
      getRecommendationText
    }
  }
}
</script>

<style scoped>
.render-optimization-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
  color: #333;
  margin: 0;
  font-size: 2rem;
}

.header-controls {
  display: flex;
  gap: 10px;
}

.no-data-message {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 12px;
  margin: 30px 0;
}

.no-data-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.no-data-message h2 {
  color: #2c3e50;
  margin-bottom: 10px;
  font-size: 1.8rem;
}

.no-data-message p {
  color: #7f8c8d;
  margin-bottom: 30px;
  font-size: 1.1rem;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.metric-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
  transition: transform 0.3s ease;
}

.metric-card:hover {
  transform: translateY(-5px);
}

.metric-icon {
  font-size: 2rem;
}

.metric-content {
  flex: 1;
}

.metric-value {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.metric-label {
  font-size: 0.9rem;
  opacity: 0.9;
}

.chart-section {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.chart-section h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.chart-container {
  position: relative;
  height: 400px;
}

.scenarios-section {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.scenarios-section h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.scenarios-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.current-row {
  background: #f8f9fa;
}

.optimistic-row {
  background: #e8f5e8;
}

.conservative-row {
  background: #fff3e0;
}

.scenario-name {
  min-width: 200px;
}

.scenario-notes {
  font-size: 0.8rem;
  color: #666;
  margin-top: 5px;
}

.time-value {
  font-family: 'Courier New', monospace;
  font-weight: bold;
}

.speedup-badge {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.quality-indicator {
  display: flex;
  align-items: center;
}

.quality-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
}

.quality-low {
  background: #e8f5e8;
  color: #2e7d32;
}

.quality-medium {
  background: #fff3e0;
  color: #f57c00;
}

.quality-high {
  background: #ffebee;
  color: #c62828;
}

.no-impact {
  color: #666;
  font-style: italic;
}

.recommendation-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
}

.highly-recommended {
  background: #e8f5e8;
  color: #2e7d32;
}

.moderately-recommended {
  background: #fff3e0;
  color: #f57c00;
}

.not-recommended {
  background: #f5f5f5;
  color: #666;
}

.groups-section {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.groups-section h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.group-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.group-card h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1.2rem;
}

.group-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.group-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-label {
  font-weight: 500;
  color: #666;
}

.metric-value {
  font-weight: bold;
  color: #333;
}

.recommendations-section {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.recommendations-section h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.recommendations-list {
  display: grid;
  gap: 15px;
}

.recommendation-item {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.recommendation-number {
  background: #667eea;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.recommendation-text {
  color: #333;
  line-height: 1.5;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: #666;
  font-weight: 500;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }
  
  .header-controls {
    justify-content: center;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .groups-grid {
    grid-template-columns: 1fr;
  }
  
  .group-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
