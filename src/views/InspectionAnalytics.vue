.set-search-field {
  position: relative;
}

.set-search-field {
  position: relative;
}

.set-search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.set-search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  height: 44px;
  box-sizing: border-box;
}

.set-search-input:hover {
  border-color: #9ca3af;
}

.set-search-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.set-search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  transition: color 0.2s ease;
}

.set-search-input:focus ~ .set-search-icon {
  color: #2563eb;
}

.set-search-clear {
  position: absolute;
  right: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
}

.set-search-clear:hover {
  color: #4b5563;
}

.set-search-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  z-index: 50;
  max-height: 320px;
  overflow-y: auto;
}

.set-search-option {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.set-search-option:hover,
.set-search-option.active {
  background: #f3f4f6;
}

.set-search-option.selected {
  background: #e0f2fe;
}

.option-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.option-subtitle {
  font-size: 0.75rem;
  color: #6b7280;
}
<template>
  <div class="inspection-analytics-page">
    <div class="page-header">
      <h1>검수이력</h1><!-- // 🔧 수정됨 -->
      <p>검수이력을 확인하고 분석할 수 있는 페이지입니다.</p><!-- // 🔧 수정됨 -->
    </div>

    <div class="analytics-content">
      <div v-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>

      <div v-else class="analytics-dashboard">
        <div class="filters-section">
          <div class="filter-group">
            <label class="filter-label">기간</label>
            <div class="date-range">
              <div class="date-input-wrapper">
                <input
                  type="date"
                  v-model="dateFrom"
                  @change="loadAnalytics"
                  class="custom-date-input"
                  ref="dateFromInput"
                />
                <div class="date-display">{{ formatDateDisplay(dateFrom) }}</div>
                <button type="button" class="date-trigger-btn" @click="focusDateInput('from')" aria-label="시작 날짜 선택"><!-- // 🔧 수정됨 -->
                  <svg class="date-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V4C14 2.89543 13.1046 2 12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 1V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6 1V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 6H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
              <span class="date-separator">~</span>
              <div class="date-input-wrapper">
                <input
                  type="date"
                  v-model="dateTo"
                  @change="loadAnalytics"
                  class="custom-date-input"
                  ref="dateToInput"
                />
                <div class="date-display">{{ formatDateDisplay(dateTo) }}</div>
                <button type="button" class="date-trigger-btn" @click="focusDateInput('to')" aria-label="종료 날짜 선택"><!-- // 🔧 수정됨 -->
                  <svg class="date-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V4C14 2.89543 13.1046 2 12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 1V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6 1V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 6H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="filter-group">
            <label class="filter-label">레고번호</label>
            <div class="set-search-field" ref="setSearchRef">
              <div class="set-search-input-row">
                <div class="set-search-input-wrapper">
                  <input
                    type="text"
                    v-model="setSearchQuery"
                    @keydown.enter.prevent="handleSetSearch"
                    placeholder="예: 76917"
                    class="set-search-input"
                  />
                  <svg class="set-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 14L11.1 11.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <button
                  type="button"
                  @click="handleSetSearch"
                  class="set-search-button"
                  :disabled="loading"
                >
                  검색
                </button>
                <button @click="resetFilters" class="filter-reset-btn">초기화</button>
              </div>
            </div>
          </div>
        </div>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">총 검수 세션</span>
              <svg class="metric-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 16l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="metric-value">{{ totalSessions }}</div>
            <div class="metric-hint">완료: {{ completedSessions }}건</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">평균 완료율</span>
              <svg class="metric-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="17" cy="17" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="metric-value">{{ averageProgress.toFixed(1) }}%</div>
            <div class="metric-hint">전체 세션 평균</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">평균 소요시간</span>
              <svg class="metric-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="metric-value">{{ averageDurationLabel }}</div>
            <div class="metric-hint">세션당 평균</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">총 누락 부품</span>
              <svg class="metric-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="metric-value error">{{ totalMissingParts }}</div>
            <div class="metric-hint">누락률: {{ missingRate.toFixed(1) }}%</div>
          </div>
        </div>

        <div class="sessions-table-section">
          <h3>최근 검수이력</h3>
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
                  @click="handleRowClick(session)"
                  :class="['table-row', { 'table-row-disabled': session.status === 'completed' }]"
                >
                  <td class="set-name-cell">{{ formatSetDisplay(session.set_num, session.theme_name, session.set_name) }}</td> <!-- // 🔧 수정됨 -->
                  <td>
                    <span class="status-badge" :class="`status-${session.status}`">
                      {{ statusLabel(session.status) }}
                    </span>
                  </td>
                  <td class="progress-column">
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { formatSetDisplay, fetchSetMetadata } from '../utils/setDisplay'

export default {
  name: 'InspectionHistory', // 🔧 수정됨
  directives: {
    'click-outside': {
      mounted(el, binding) {
        el.clickOutsideEvent = (event) => {
          if (!(el === event.target || el.contains(event.target))) {
            binding.value(event)
          }
        }
        document.addEventListener('click', el.clickOutsideEvent)
      },
      unmounted(el) {
        document.removeEventListener('click', el.clickOutsideEvent)
      }
    }
  },
  setup() {
    const router = useRouter()
    const { supabase, user } = useSupabase()

    const loading = ref(false)
    const error = ref(null)
    const sessions = ref([])
    const items = ref([])
    const availableSets = ref([])
    const isAdmin = ref(false)

    const dateFrom = ref('')
    const dateTo = ref('')
    const selectedSetId = ref('')
    const setSearchQuery = ref('')
    const setSearchRef = ref(null)
    const dateFromInput = ref(null)
    const dateToInput = ref(null)

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
          .select('id, name, set_num, theme_id')
          .order('name', { ascending: true })
          .limit(500)

        if (error) throw error

        const themeIds = [...new Set((data || []).map(set => set.theme_id).filter(Boolean))]
        let themeMap = new Map()

        if (themeIds.length > 0) {
          const { data: themesData, error: themesError } = await supabase
            .from('lego_themes')
            .select('theme_id, name')
            .in('theme_id', themeIds)

          if (themesError) throw themesError
          themeMap = new Map((themesData || []).map(theme => [theme.theme_id, theme.name]))
        }

        availableSets.value = (data || []).map(set => ({
          id: set.id,
          name: set.name || '세트명 없음',
          set_num: set.set_num || '',
          theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
          display_name: formatSetDisplay(set.set_num, set.theme_id ? themeMap.get(set.theme_id) : null, set.name || '세트명 없음')
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

        if (!isAdmin.value) {
          query = query.eq('user_id', user.value.id)
        }

        if (selectedSetId.value) {
          console.log('[검색] selectedSetId로 필터링:', selectedSetId.value)
          query = query.eq('set_id', selectedSetId.value)
        } else {
          console.log('[검색] selectedSetId 없음, 전체 조회')
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

        let metadataMap = new Map()
        const sessionSetIds = (sessionsData || []).map(session => session.set_id).filter(Boolean)

        if (sessionSetIds.length > 0) {
          metadataMap = await fetchSetMetadata(supabase, sessionSetIds)
        }

        sessions.value = (sessionsData || []).map(session => {
          const meta = metadataMap.get(session.set_id) || {}
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
            set_name: session.lego_sets?.name || meta.set_name || '세트명 없음',
            set_num: meta.set_num || null,
            theme_name: meta.theme_name || null,
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
        console.log('[검색] 데이터 로드 완료 - 세션:', sessions.value.length, '개, 아이템:', items.value.length, '개')
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
          return '임시저장'
        case 'in_progress':
          return '진행 중'
        default:
          return status
      }
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

    const formatDateDisplay = (dateString) => {
      if (!dateString) return '날짜 선택'
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}. ${month}. ${day}.`
    }

    const handleRowClick = (sessionData) => { // 🔧 수정됨
      if (!sessionData || sessionData.status === 'completed') return // 🔧 수정됨
      viewSession(sessionData)
    } // 🔧 수정됨

    const viewSession = (targetSession) => { // 🔧 수정됨
      if (!targetSession || !targetSession.id) return // 🔧 수정됨
      router.push({ path: '/manual-inspection', query: { session: targetSession.id } }) // 🔧 수정됨
    }

    const handleSetSearch = async () => {
      if (!setSearchQuery.value || !setSearchQuery.value.trim()) {
        selectedSetId.value = ''
        await loadAnalytics()
        return
      }

      try {
        const query = setSearchQuery.value.trim()
        const { data, error } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id')
          .ilike('set_num', `%${query}%`)
          .order('name', { ascending: true })
          .limit(1)

        if (error) throw error

        if (data && data.length > 0) {
          const set = data[0]
          const themeIds = set.theme_id ? [set.theme_id] : []
          let themeName = null

          if (themeIds.length > 0) {
            const { data: themesData } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .in('theme_id', themeIds)
              .maybeSingle()
            themeName = themesData?.name || null
          }

          selectedSetId.value = set.id
          console.log('[검색] 세트 ID 설정:', set.id, 'set_num:', set.set_num)
          await loadAnalytics()
        } else {
          selectedSetId.value = ''
          console.log('[검색] 검색 결과 없음, 필터 초기화')
          await loadAnalytics()
        }
      } catch (err) {
        console.error('세트 검색 실패:', err)
        selectedSetId.value = ''
        await loadAnalytics()
      }
    }

    const focusDateInput = (target) => {
      if (target === 'from' && dateFromInput.value) {
        dateFromInput.value.showPicker?.()
        dateFromInput.value.focus()
      } else if (target === 'to' && dateToInput.value) {
        dateToInput.value.showPicker?.()
        dateToInput.value.focus()
      }
    }

    const resetFilters = async () => {
      dateFrom.value = ''
      dateTo.value = ''
      selectedSetId.value = ''
      setSearchQuery.value = ''
      await loadAnalytics()
    }

    const initializeDateRange = () => {
      const today = new Date()
      const lastWeek = new Date(today)
      lastWeek.setDate(lastWeek.getDate() - 7)

      dateTo.value = today.toISOString().split('T')[0]
      dateFrom.value = lastWeek.toISOString().split('T')[0]
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
      statusLabel,
      formatDate,
      formatDuration,
      formatDateDisplay,
      isAdmin,
      dateFrom,
      dateTo,
      selectedSetId,
      setSearchQuery,
      handleSetSearch,
      resetFilters,
      formatSetDisplay,
      handleRowClick,
      setSearchRef,
      focusDateInput,
      dateFromInput,
      dateToInput
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
  text-align: center;
}

.page-header p {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
  text-align: center;
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
  margin-top: -0.85rem; /* // 🔧 수정됨 */
}

.metric-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0; /* // 🔧 수정됨 */
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-icon { /* // 🔧 수정됨 */
  width: 1.5rem;
  height: 1.5rem;
  color: #9ca3af;
  flex-shrink: 0;
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

.sessions-table-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 0; /* // 🔧 수정됨 */
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
  padding: 1.1rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.sessions-table td {
  padding: 1.1rem 1rem;
  font-size: 0.875rem;
  color: #111827;
  border-bottom: 1px solid #f3f4f6;
  text-align: center;
}

.set-name-cell { /* // 🔧 수정됨 */
  max-width: 360px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.table-row {
  cursor: pointer;
  transition: background 0.2s ease;
}

.table-row-disabled { /* // 🔧 수정됨 */
  cursor: default; /* // 🔧 수정됨 */
  pointer-events: none; /* // 🔧 수정됨 */
  color: #9ca3af; /* // 🔧 수정됨 */
}

.table-row:hover {
  background: #f9fafb;
}

.table-row-disabled:hover { /* // 🔧 수정됨 */
  background: #ffffff; /* // 🔧 수정됨 */
}

.table-row-disabled .status-badge { /* // 🔧 수정됨 */
  background: #e5e7eb; /* // 🔧 수정됨 */
  color: #6b7280; /* // 🔧 수정됨 */
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.status-completed {
  background: #10b981;
  color: #ffffff;
}

.status-badge.status-paused {
  background: #f59e0b;
  color: #ffffff;
}

.status-badge.status-in_progress {
  background: #3b82f6;
  color: #ffffff;
}

.progress-column {
  text-align: right;
}

.progress-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
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

.sessions-table td.error-text {
  color: #dc2626;
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

.set-search-field {
  position: relative;
}

.set-search-field {
  position: relative;
}

.set-search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.set-search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  height: 44px;
  box-sizing: border-box;
}

.set-search-input:hover {
  border-color: #9ca3af;
}

.set-search-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.set-search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  transition: color 0.2s ease;
}

.set-search-input:focus ~ .set-search-icon {
  color: #2563eb;
}

.set-search-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  position: relative;
}

.set-search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.set-search-button {
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  height: 44px;
  box-sizing: border-box;
}

.set-search-button:hover {
  background: #1d4ed8;
}

.set-search-button:active {
  background: #1e40af;
}

.set-search-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.set-search-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
  z-index: 50;
  max-height: 320px;
  overflow-y: auto;
}

.set-search-option {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.set-search-option:hover,
.set-search-option.active {
  background: #f3f4f6;
}

.set-search-option.selected {
  background: #e0f2fe;
}

.option-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.option-subtitle {
  font-size: 0.75rem;
  color: #6b7280;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.date-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.custom-date-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
}

.date-display {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 0.9375rem;
  color: #111827;
  background: #ffffff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  display: flex;
  align-items: center;
  font-weight: 500;
  height: 44px;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-display:empty::before {
  content: '날짜 선택';
  color: #9ca3af;
}

.date-input-wrapper:hover .date-display {
  border-color: #9ca3af;
}

.date-input-wrapper:focus-within .date-display {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.date-trigger-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
  z-index: 3;
  border-radius: 6px;
  transition: background 0.2s ease, color 0.2s ease;
}

.date-trigger-btn:hover {
  background: #f3f4f6;
  color: #2563eb;
}

.date-trigger-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.date-icon {
  width: 1rem;
  height: 1rem;
  pointer-events: none;
}

.custom-dropdown {
  position: relative;
  width: 100%;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #111827;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 38px;
}

.dropdown-trigger:hover {
  border-color: #9ca3af;
}

.dropdown-trigger:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.dropdown-arrow {
  transition: transform 0.2s ease;
  color: #6b7280;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 50;
  overflow: hidden;
}

.dropdown-menu-scrollable {
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: #111827;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.dropdown-item:hover {
  background: #f3f4f6;
}

.dropdown-item.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

.date-separator {
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
  flex-shrink: 0;
}

.filter-reset-btn {
  padding: 0.75rem 1.5rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  height: 44px;
  box-sizing: border-box;
}

.filter-reset-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

@media (min-width: 769px) and (max-width: 1024px) {
  .inspection-analytics-page {
    padding: 1rem;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  /* 본문 폰트 사이즈 조정 */
  .set-name-cell {
    font-size: 0.9375rem !important;
    max-width: none !important;
    white-space: nowrap !important;
    overflow: visible !important;
    text-overflow: clip !important;
  }
  
  .table-container {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
  }
  
  .sessions-table {
    width: auto;
    min-width: 100%;
  }
  
  .sessions-table td {
    white-space: nowrap !important;
  }
  
  .sessions-table th {
    white-space: nowrap !important;
  }
  
  .progress-bar-small {
    display: none !important;
  }
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

  .filters-section > .filter-reset-btn {
    width: 100%;
  }

  .set-search-input-row {
    flex-wrap: wrap;
  }

  .set-search-input-wrapper {
    min-width: 0;
    flex: 1 1 auto;
  }

  .set-search-button,
  .set-search-input-row .filter-reset-btn {
    flex: 0 0 auto;
    min-width: auto;
  }

  /* 본문 폰트 사이즈 조정 */
  .set-name-cell {
    font-size: 0.9375rem !important;
    max-width: none !important;
    white-space: nowrap !important;
    overflow: visible !important;
    text-overflow: clip !important;
  }
  
  .table-container {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
  }
  
  .sessions-table {
    width: auto;
    min-width: 100%;
  }
  
  .sessions-table td {
    white-space: nowrap !important;
  }
  
  .sessions-table th {
    white-space: nowrap !important;
  }
  
  .progress-bar-small {
    display: none !important;
  }

  .session-date-cell,
  .session-status-cell {
    font-size: 0.875rem !important;
  }

  .metric-label {
    font-size: 0.8125rem !important;
  }

  .metric-value {
    font-size: 1.5rem !important;
  }

  .metric-hint {
    font-size: 0.8125rem !important;
  }

  .chart-card h3,
  .sessions-table-section h3 {
    font-size: 1rem !important;
  }

  .page-header h1 {
    font-size: 1.25rem !important;
  }

  .page-header p {
    font-size: 0.875rem !important;
  }

  /* 날짜 필터 텍스트 한 줄 표시 */
  .date-display {
    font-size: 0.8125rem !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .date-range {
    gap: 0.5rem !important;
  }

  .date-input-wrapper {
    min-width: 0 !important;
    flex: 1 1 auto !important;
  }

  /* 테이블 본문 폰트 사이즈 조정 */
  .sessions-table th,
  .sessions-table td {
    font-size: 0.875rem !important;
  }
  
  .sessions-table th {
    white-space: nowrap !important;
  }

  .sessions-table td {
    font-size: 0.875rem !important;
  }

  .filter-label {
    font-size: 0.8125rem !important;
  }

  .set-search-input {
    font-size: 0.9375rem !important;
  }

  .set-search-button {
    font-size: 0.875rem !important;
  }

  .filter-reset-btn {
    font-size: 0.875rem !important;
  }

  .status-badge {
    font-size: 0.75rem !important;
  }

  .dropdown-trigger {
    font-size: 0.875rem !important;
  }

  .dropdown-item {
    font-size: 0.875rem !important;
  }
}
</style>

