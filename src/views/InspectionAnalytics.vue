<template>
  <div class="inspection-analytics-page">
    <div class="page-header">
      <h1>검수 통계</h1>
      <p>검수 세션 통계 및 분석 대시보드</p>
    </div>

    <div class="analytics-content">
      <div v-if="loading" class="loading-state">
        <span>로딩 중...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>

      <div v-else class="analytics-dashboard">
        <div class="filters-section">
          <div class="filter-group">
            <label class="filter-label">통계 범위</label>
            <select v-model="viewMode" @change="loadAnalytics" class="filter-select">
              <option value="my">내 통계</option>
              <option v-if="isAdmin" value="all">전체 통계</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">기간</label>
            <div class="date-range">
              <input
                type="date"
                v-model="dateFrom"
                @change="loadAnalytics"
                class="filter-input"
              />
              <span class="date-separator">~</span>
              <input
                type="date"
                v-model="dateTo"
                @change="loadAnalytics"
                class="filter-input"
              />
            </div>
          </div>

          <div class="filter-group">
            <label class="filter-label">세트</label>
            <select v-model="selectedSetId" @change="loadAnalytics" class="filter-select">
              <option value="">전체</option>
              <option v-for="set in availableSets" :key="set.id" :value="set.id">
                {{ set.name }}
              </option>
            </select>
          </div>

          <button @click="resetFilters" class="filter-reset-btn">초기화</button>
        </div>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">총 검수 세션</span>
            </div>
            <div class="metric-value">{{ totalSessions }}</div>
            <div class="metric-hint">완료: {{ completedSessions }}건</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">평균 완료율</span>
            </div>
            <div class="metric-value">{{ averageProgress.toFixed(1) }}%</div>
            <div class="metric-hint">전체 세션 평균</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">평균 소요시간</span>
            </div>
            <div class="metric-value">{{ averageDurationLabel }}</div>
            <div class="metric-hint">세션당 평균</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">총 누락 부품</span>
            </div>
            <div class="metric-value error">{{ totalMissingParts }}</div>
            <div class="metric-hint">누락률: {{ missingRate.toFixed(1) }}%</div>
          </div>
        </div>

        <div class="charts-section">
          <div class="chart-card">
            <h3>세션별 진행률</h3>
            <div class="chart-container">
              <Bar :data="progressChartData" :options="chartOptions" />
            </div>
          </div>

          <div class="chart-card">
            <h3>상태별 부품 분포</h3>
            <div class="chart-container">
              <Bar :data="statusChartData" :options="chartOptions" />
            </div>
          </div>
        </div>

        <div class="timeline-section">
          <h3>검수 타임라인</h3>
          <div class="timeline-container">
            <div
              v-for="session in timelineSessions"
              :key="session.id"
              class="timeline-item"
              @click="viewSession(session.id)"
            >
              <div class="timeline-marker" :class="`status-${session.status}`"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-set-name">{{ session.set_name }}</span>
                  <span class="timeline-date">{{ formatDateShort(session.started_at) }}</span>
                </div>
                <div class="timeline-stats">
                  <span class="stat-item">진행률: {{ session.progress || 0 }}%</span>
                  <span class="stat-item" v-if="session.duration_seconds">소요: {{ formatDuration(session.duration_seconds) }}</span>
                  <span class="stat-item error-text" v-if="session.missing_count">누락: {{ session.missing_count }}개</span>
                </div>
              </div>
            </div>
            <div v-if="timelineSessions.length === 0" class="timeline-empty">
              <p>검수 세션이 없습니다</p>
            </div>
          </div>
        </div>

        <div class="sessions-table-section">
          <h3>최근 검수 세션</h3>
          <div class="table-container">
            <table class="sessions-table">
              <thead>
                <tr>
                  <th>세트명</th>
                  <th>상태</th>
                  <th>진행률</th>
                  <th>소요시간</th>
                  <th>누락</th>
                  <th>완료일시</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="session in recentSessions"
                  :key="session.id"
                  @click="viewSession(session.id)"
                  class="table-row"
                >
                  <td>{{ session.set_name }}</td>
                  <td>
                    <span class="status-badge" :class="`status-${session.status}`">
                      {{ statusLabel(session.status) }}
                    </span>
                  </td>
                  <td>
                    <div class="progress-cell">
                      <div class="progress-bar-small">
                        <div class="progress-fill-small" :style="{ width: `${session.progress || 0}%` }"></div>
                      </div>
                      <span>{{ session.progress || 0 }}%</span>
                    </div>
                  </td>
                  <td>{{ formatDuration(session.duration_seconds) }}</td>
                  <td class="error-text">{{ session.missing_count || 0 }}개</td>
                  <td>{{ formatDate(session.completed_at || session.last_saved_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bar } from 'vue-chartjs'
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { useSupabase } from '../composables/useSupabase'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

export default {
  name: 'InspectionAnalytics',
  components: { Bar },
  setup() {
    const router = useRouter()
    const { supabase, user } = useSupabase()

    const loading = ref(false)
    const error = ref(null)
    const sessions = ref([])
    const items = ref([])
    const availableSets = ref([])
    const isAdmin = ref(false)

    const viewMode = ref('my')
    const dateFrom = ref('')
    const dateTo = ref('')
    const selectedSetId = ref('')

    const totalSessions = computed(() => sessions.value.length)
    const completedSessions = computed(() => sessions.value.filter(s => s.status === 'completed').length)
    const averageProgress = computed(() => {
      if (sessions.value.length === 0) return 0
      const sum = sessions.value.reduce((acc, s) => acc + (s.progress || 0), 0)
      return sum / sessions.value.length
    })

    const totalMissingParts = computed(() => {
      return items.value.filter(item => item.status === 'missing').length
    })

    const missingRate = computed(() => {
      if (items.value.length === 0) return 0
      return (totalMissingParts.value / items.value.length) * 100
    })

    const averageDuration = computed(() => {
      const completed = sessions.value.filter(s => s.status === 'completed' && s.duration_seconds)
      if (completed.length === 0) return 0
      const sum = completed.reduce((acc, s) => acc + (s.duration_seconds || 0), 0)
      return Math.floor(sum / completed.length)
    })

    const averageDurationLabel = computed(() => {
      const seconds = averageDuration.value
      if (seconds === 0) return '--'
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      if (hours > 0) {
        return `${hours}시간 ${minutes}분`
      }
      return `${minutes}분`
    })

    const recentSessions = computed(() => {
      return [...sessions.value]
        .sort((a, b) => new Date(b.completed_at || b.last_saved_at) - new Date(a.completed_at || a.last_saved_at))
        .slice(0, 10)
    })

    const timelineSessions = computed(() => {
      return [...sessions.value]
        .sort((a, b) => new Date(b.started_at || b.created_at) - new Date(a.started_at || a.created_at))
        .slice(0, 20)
    })

    const progressChartData = computed(() => {
      const labels = sessions.value
        .slice(0, 10)
        .map(s => s.set_name || '세트명 없음')
        .slice(0, 10)

      const data = sessions.value
        .slice(0, 10)
        .map(s => s.progress || 0)

      return {
        labels,
        datasets: [
          {
            label: '진행률 (%)',
            data,
            backgroundColor: '#2563eb'
          }
        ]
      }
    })

    const statusChartData = computed(() => {
      const statusCounts = items.value.reduce((acc, item) => {
        const status = item.status || 'pending'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, { pending: 0, checked: 0, missing: 0, hold: 0 })

      return {
        labels: ['완료', '미확인', '누락', '보류'],
        datasets: [
          {
            label: '부품 수',
            data: [
              statusCounts.checked || 0,
              statusCounts.pending || 0,
              statusCounts.missing || 0,
              statusCounts.hold || 0
            ],
            backgroundColor: ['#10b981', '#9ca3af', '#dc2626', '#f59e0b']
          }
        ]
      }
    })

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y ?? 0}${context.dataset.label?.includes('%') ? '%' : '개'}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#4b5563' }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            maxTicksLimit: 10,
            color: '#6b7280'
          }
        }
      }
    }

    const checkAdminRole = async () => {
      if (!user.value) {
        isAdmin.value = false
        return
      }

      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('id, role, is_active, email')
          .eq('email', user.value.email)
          .eq('is_active', true)
          .maybeSingle()

        if (error || !data) {
          isAdmin.value = false
          return
        }

        isAdmin.value = data.role === 'admin' || data.role === 'super_admin'
      } catch (err) {
        console.error('관리자 권한 확인 오류:', err)
        isAdmin.value = false
      }
    }

    const loadAvailableSets = async () => {
      try {
        const { data, error } = await supabase
          .from('lego_sets')
          .select('id, name')
          .order('name', { ascending: true })
          .limit(500)

        if (error) throw error

        availableSets.value = (data || []).map(set => ({
          id: set.id,
          name: set.name || '세트명 없음'
        }))
      } catch (err) {
        console.error('세트 목록 로드 실패:', err)
      }
    }

    const loadAnalytics = async () => {
      if (!user.value) return

      try {
        loading.value = true
        error.value = null

        let query = supabase
          .from('inspection_sessions')
          .select(`
            id,
            set_id,
            user_id,
            status,
            progress,
            started_at,
            last_saved_at,
            completed_at,
            lego_sets:set_id (
              name
            )
          `)

        if (viewMode.value === 'my' || !isAdmin.value) {
          query = query.eq('user_id', user.value.id)
        }

        if (selectedSetId.value) {
          query = query.eq('set_id', selectedSetId.value)
        }

        if (dateFrom.value) {
          query = query.gte('started_at', new Date(dateFrom.value).toISOString())
        }

        if (dateTo.value) {
          const endDate = new Date(dateTo.value)
          endDate.setHours(23, 59, 59, 999)
          query = query.lte('started_at', endDate.toISOString())
        }

        const { data: sessionsData, error: sessionsError } = await query
          .order('last_saved_at', { ascending: false })
          .limit(1000)

        if (sessionsError) throw sessionsError

        const sessionIds = (sessionsData || []).map(s => s.id)
        let itemsData = []

        console.log(`[통계] 세션 ${sessionsData?.length || 0}개 조회, 세션 ID 목록:`, sessionIds.map(id => id.substring(0, 8)).join(', '))

        // 세션이 있을 때만 아이템 조회
        if (sessionIds.length > 0) {
          const { data, error: itemsError } = await supabase
            .from('inspection_items')
            .select('id, session_id, status')
            .in('session_id', sessionIds)

          if (itemsError) {
            console.error('inspection_items 로드 오류:', itemsError)
          } else {
            itemsData = data || []
            console.log(`[통계] 아이템 ${itemsData.length}개 조회됨`)
            
            // 세션별 아이템 수 확인
            const itemsBySession = itemsData.reduce((acc, item) => {
              acc[item.session_id] = (acc[item.session_id] || 0) + 1
              return acc
            }, {})
            console.log(`[통계] 세션별 아이템 수:`, Object.entries(itemsBySession).map(([id, count]) => `${id.substring(0, 8)}: ${count}`).join(', '))
          }
        }

        sessions.value = (sessionsData || []).map(session => {
          // 소요시간 계산: 완료된 경우 completed_at, 그 외에는 last_saved_at 사용
          let duration = null
          if (session.started_at) {
            const endTime = session.completed_at || session.last_saved_at
            if (endTime) {
              duration = Math.floor((new Date(endTime) - new Date(session.started_at)) / 1000)
            }
          }

          const sessionItems = itemsData.filter(item => item.session_id === session.id)
          const missingCount = sessionItems.filter(item => item.status === 'missing').length

          // 디버깅: 누락 부품 수 확인
          if (session.id && sessionItems.length > 0) {
            console.log(`[세션 ${session.id.substring(0, 8)}...] 총 아이템: ${sessionItems.length}, 누락: ${missingCount}, 상태 분포:`, 
              sessionItems.reduce((acc, item) => {
                acc[item.status] = (acc[item.status] || 0) + 1
                return acc
              }, {}))
          }

          return {
            id: session.id,
            set_id: session.set_id,
            set_name: session.lego_sets?.name || '세트명 없음',
            status: session.status,
            progress: session.progress || 0,
            started_at: session.started_at,
            last_saved_at: session.last_saved_at,
            completed_at: session.completed_at,
            duration_seconds: duration,
            missing_count: missingCount
          }
        })

        items.value = itemsData || []
      } catch (err) {
        console.error('통계 데이터 로드 실패:', err)
        error.value = err.message || '통계 데이터를 불러오는데 실패했습니다'
      } finally {
        loading.value = false
      }
    }

    const statusLabel = (status) => {
      switch (status) {
        case 'completed':
          return '완료'
        case 'paused':
          return '임시 저장'
        case 'in_progress':
          return '진행 중'
        default:
          return status
      }
    }

    const formatDateShort = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const formatDuration = (seconds) => {
      if (!seconds || seconds === 0) return '-'
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      if (hours > 0) {
        return `${hours}시간 ${minutes}분`
      }
      return `${minutes}분`
    }

    const viewSession = (sessionId) => {
      router.push(`/manual-inspection?session=${sessionId}`)
    }

    const resetFilters = () => {
      viewMode.value = 'my'
      dateFrom.value = ''
      dateTo.value = ''
      selectedSetId.value = ''
      loadAnalytics()
    }

    const initializeDateRange = () => {
      const today = new Date()
      const lastMonth = new Date(today)
      lastMonth.setMonth(lastMonth.getMonth() - 1)

      dateTo.value = today.toISOString().split('T')[0]
      dateFrom.value = lastMonth.toISOString().split('T')[0]
    }

    onMounted(async () => {
      await checkAdminRole()
      await loadAvailableSets()
      initializeDateRange()
      loadAnalytics()
    })

    return {
      loading,
      error,
      totalSessions,
      completedSessions,
      averageProgress,
      totalMissingParts,
      missingRate,
      averageDurationLabel,
      recentSessions,
      timelineSessions,
      progressChartData,
      statusChartData,
      chartOptions,
      statusLabel,
      formatDate,
      formatDateShort,
      formatDuration,
      viewSession,
      isAdmin,
      viewMode,
      dateFrom,
      dateTo,
      selectedSetId,
      availableSets,
      resetFilters
    }
  }
}
</script>

<style scoped>
.inspection-analytics-page {
  min-height: 100vh;
  background: #f9fafb;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.page-header p {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
}

.analytics-content {
  max-width: 1400px;
  margin: 0 auto;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 4rem 2rem;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.analytics-dashboard {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.metric-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
}

.metric-value.error {
  color: #dc2626;
}

.metric-hint {
  font-size: 0.875rem;
  color: #6b7280;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
}

.chart-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
}

.chart-container {
  height: 300px;
  position: relative;
}

.timeline-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.timeline-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
}

.timeline-container {
  position: relative;
  padding-left: 2rem;
}

.timeline-item {
  position: relative;
  padding-bottom: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: -1.75rem;
  top: 1.5rem;
  width: 2px;
  height: calc(100% - 0.5rem);
  background: #e5e7eb;
}

.timeline-item:hover {
  opacity: 0.8;
}

.timeline-marker {
  position: absolute;
  left: -2rem;
  top: 0.25rem;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 2px #e5e7eb;
  z-index: 1;
}

.timeline-marker.status-completed {
  background: #10b981;
  box-shadow: 0 0 0 2px #10b981;
}

.timeline-marker.status-paused {
  background: #f59e0b;
  box-shadow: 0 0 0 2px #f59e0b;
}

.timeline-marker.status-in_progress {
  background: #2563eb;
  box-shadow: 0 0 0 2px #2563eb;
}

.timeline-content {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.timeline-set-name {
  font-weight: 600;
  color: #111827;
  font-size: 0.875rem;
}

.timeline-date {
  font-size: 0.75rem;
  color: #6b7280;
}

.timeline-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.timeline-stats .stat-item {
  font-size: 0.75rem;
  color: #6b7280;
}

.timeline-stats .stat-item.error-text {
  color: #dc2626;
}

.timeline-empty {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.sessions-table-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
}

.sessions-table-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
}

.table-container {
  overflow-x: auto;
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
}

.sessions-table thead {
  background: #f9fafb;
}

.sessions-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.sessions-table td {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: #111827;
  border-bottom: 1px solid #f3f4f6;
}

.table-row {
  cursor: pointer;
  transition: background 0.2s ease;
}

.table-row:hover {
  background: #f9fafb;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.status-completed {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.status-paused {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.status-in_progress {
  background: #dbeafe;
  color: #1e40af;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar-small {
  width: 60px;
  height: 6px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill-small {
  height: 100%;
  background: #2563eb;
  transition: width 0.3s ease;
}

.error-text {
  color: #dc2626;
  font-weight: 600;
}

.filters-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-end;
  margin-bottom: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 200px;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.filter-select,
.filter-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #111827;
  background: #ffffff;
  transition: border-color 0.2s ease;
}

.filter-select:focus,
.filter-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-separator {
  color: #6b7280;
  font-size: 0.875rem;
}

.filter-reset-btn {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.filter-reset-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

@media (max-width: 768px) {
  .inspection-analytics-page {
    padding: 1rem;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .charts-section {
    grid-template-columns: 1fr;
  }

  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    min-width: 100%;
  }

  .filter-reset-btn {
    width: 100%;
  }
}
</style>

