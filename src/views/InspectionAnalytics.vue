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
                />
                <div class="date-display">{{ formatDateDisplay(dateFrom) }}</div>
                <svg class="date-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V4C14 2.89543 13.1046 2 12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M10 1V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M6 1V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M2 6H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="date-separator">~</span>
              <div class="date-input-wrapper">
                <input
                  type="date"
                  v-model="dateTo"
                  @change="loadAnalytics"
                  class="custom-date-input"
                />
                <div class="date-display">{{ formatDateDisplay(dateTo) }}</div>
                <svg class="date-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V4C14 2.89543 13.1046 2 12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M10 1V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M6 1V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M2 6H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <div class="filter-group">
            <label class="filter-label">세트</label>
            <div class="set-search-field" ref="setDropdownRef">
              <div class="set-search-input-row" ref="searchInputRef">
                <div class="set-search-input-wrapper">
                  <input
                    type="text"
                    v-model="setSearchQuery"
                    @keyup.enter="handleSearchEnter"
                    @blur="handleSearchBlur"
                    placeholder="예 : 76917"
                    class="set-search-input"
                    :disabled="loading"
                  />
                  <svg class="set-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 14L11.1 11.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <button
                  type="button"
                  @click="handleSearchEnter"
                  class="set-search-button"
                  :disabled="loading"
                >
                  검색
                </button>
                <!-- 검색 툴팁 -->
                <div v-if="searchTooltip" class="search-tooltip">
                  <span>{{ searchTooltip }}</span>
                </div>
                <button
                  type="button"
                  @click="handleResetSet"
                  class="filter-reset-btn"
                  :disabled="!selectedSetId"
                >
                  초기화
                </button>
              </div>

              <transition name="select-fade">
                <div v-if="showSetDropdown && searchResults.length > 0" :key="`dropdown-${searchResultsKey}`" class="set-search-dropdown">
                  <div
                    v-for="(set, index) in searchResults"
                    :key="`${set.id}-${set.set_num}-${searchResultsKey}-${index}`"
                    class="set-search-option"
                    :class="{ active: selectedSetId === set.id }"
                    @click="handleSelectSet(set)"
                  >
                    <div class="option-row option-row-meta">
                      <span class="option-value option-set-display">{{ formatSetDisplay(set.set_num, set.theme_name, set.name) }}</span>
                    </div>
                    <div class="option-row">
                      <span class="option-label">제품명:</span>
                      <span class="option-value">{{ set.name || '' }}</span>
                    </div>
                  </div>
                </div>
              </transition>
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
                  <span class="timeline-set-name">
                    <span v-if="session.set_num" class="set-num">{{ formatSetNum(session.set_num) }}</span>
                    <span v-if="session.set_num && session.theme_name" class="separator">|</span>
                    <span v-if="session.theme_name" class="theme-name">{{ session.theme_name }}</span>
                    <span v-if="session.set_num || session.theme_name" class="set-name">{{ session.set_name }}</span>
                    <span v-else>{{ session.set_name }}</span>
                  </span>
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
                  @click="session.status !== 'completed' ? viewSession(session.id) : null"
                  :class="['table-row', { 'table-row-clickable': session.status !== 'completed', 'table-row-completed': session.status === 'completed' }]"
                >
                  <td>
                    <span v-if="session.set_num" class="set-num">{{ formatSetNum(session.set_num) }}</span>
                    <span v-if="session.set_num && session.theme_name" class="separator">|</span>
                    <span v-if="session.theme_name" class="theme-name">{{ session.theme_name }}</span>
                    <span v-if="session.set_num || session.theme_name" class="set-name">{{ session.set_name }}</span>
                    <span v-else>{{ session.set_name }}</span>
                  </td>
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

    <!-- 로그인 모달 -->
    <div v-if="showLoginModal" class="modal-overlay">
      <div class="modal-content login-modal-content" @click.stop>
        <div class="modal-header">
          <h3>로그인</h3>
          <button 
            type="button" 
            class="modal-close-btn" 
            @click="showLoginModal = false" 
            aria-label="모달 닫기"
          >
            &times;
          </button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleLoginInModal" class="login-form-in-modal">
            <div class="form-group">
              <label for="login-email">이메일</label>
              <input
                type="email"
                id="login-email"
                v-model="loginEmail"
                required
                placeholder="이메일을 입력하세요"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="login-password">비밀번호</label>
              <input
                type="password"
                id="login-password"
                v-model="loginPassword"
                required
                placeholder="비밀번호를 입력하세요"
                class="form-input"
              />
            </div>
            <div v-if="loginError" class="error-message-in-modal">
              {{ loginError }}
            </div>
            <div class="modal-footer">
              <button type="button" @click="showLoginModal = false" class="btn-secondary">취소</button>
              <button type="submit" class="btn-primary" :disabled="loginLoading">
                {{ loginLoading ? '로그인 중...' : '로그인' }}
              </button>
            </div>
          </form>
          <div class="login-modal-links">
            <button type="button" @click="showSignupModal = true; showLoginModal = false" class="login-link-btn">
              회원가입
            </button>
            <span class="link-separator">|</span>
            <button type="button" @click="handleTestAccountLogin" class="login-link-btn" :disabled="loginLoading">
              테스트 계정 로그인
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 회원가입 모달 -->
    <div v-if="showSignupModal" class="modal-overlay">
      <div class="modal-content login-modal-content" @click.stop>
        <div class="modal-header">
          <h3>회원가입</h3>
          <button 
            type="button" 
            class="modal-close-btn" 
            @click="showSignupModal = false" 
            aria-label="모달 닫기"
          >
            &times;
          </button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleSignupInModal" class="login-form-in-modal">
            <div class="form-group">
              <label for="signup-email">이메일</label>
              <input
                type="email"
                id="signup-email"
                v-model="signupEmail"
                required
                placeholder="이메일을 입력하세요"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="signup-password">비밀번호</label>
              <input
                type="password"
                id="signup-password"
                v-model="signupPassword"
                required
                placeholder="비밀번호를 입력하세요"
                minlength="6"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="signup-password-confirm">비밀번호 확인</label>
              <input
                type="password"
                id="signup-password-confirm"
                v-model="signupPasswordConfirm"
                required
                placeholder="비밀번호를 다시 입력하세요"
                minlength="6"
                class="form-input"
              />
            </div>
            <div v-if="signupError" class="error-message-in-modal">
              {{ signupError }}
            </div>
            <div class="modal-footer">
              <button type="button" @click="showSignupModal = false" class="btn-secondary">취소</button>
              <button type="submit" class="btn-primary" :disabled="signupLoading">
                {{ signupLoading ? '가입 중...' : '회원가입' }}
              </button>
            </div>
          </form>
          <div class="login-modal-links">
            <button type="button" @click="showLoginModal = true; showSignupModal = false" class="login-link-btn">
              로그인
            </button>
            <span class="link-separator">|</span>
            <button type="button" @click="handleTestAccountLogin" class="login-link-btn" :disabled="signupLoading">
              테스트 계정 로그인
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { formatSetDisplay, fetchSetMetadata } from '../utils/setDisplay'

export default {
  name: 'InspectionAnalytics',
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
    console.log('========== InspectionAnalytics setup() 실행 ==========')
    const router = useRouter()
    const { supabase, user, signIn, signUp, loading: userLoading } = useSupabase()
    console.log('useSupabase 결과:', { hasUser: !!user.value, userLoading: userLoading.value })

    const loading = ref(false)
    const error = ref(null)
    const sessions = ref([])
    const items = ref([])
    const availableSets = ref([])
    const isAdmin = ref(false)

    const dateFrom = ref('')
    const dateTo = ref('')
    const selectedSetId = ref('')
    const selectedSetName = ref('전체')
    const selectedSet = ref(null)
    const setSearchQuery = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0)
    const showSetDropdown = ref(false)
    const setDropdownRef = ref(null)
    const searchInputRef = ref(null)

    // 로그인 모달 관련
    const showLoginModal = ref(false)
    const showSignupModal = ref(false)
    const loginEmail = ref('')
    const loginPassword = ref('')
    const loginLoading = ref(false)
    const loginError = ref('')
    
    // 회원가입 모달 관련
    const signupEmail = ref('')
    const signupPassword = ref('')
    const signupPasswordConfirm = ref('')
    const signupLoading = ref(false)
    const signupError = ref('')
    const pendingSearchQuery = ref('')

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
      const completed = sessions.value.filter(s => s.status === 'completed' && s.duration_seconds && s.duration_seconds > 0)
      if (completed.length === 0) return 0
      const sum = completed.reduce((acc, s) => acc + (s.duration_seconds || 0), 0)
      const avg = Math.floor(sum / completed.length)
      console.log('[검색] 평균 소요시간 계산:', { completedCount: completed.length, sum, avg })
      return avg
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
              name,
              set_num,
              theme_id
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

        // 날짜 필터는 last_saved_at 기준으로 적용 (검수 중인 세션도 포함)
        if (dateFrom.value) {
          const fromDate = new Date(dateFrom.value)
          fromDate.setHours(0, 0, 0, 0)
          console.log('[검색] 날짜 필터 적용 (from):', dateFrom.value, '->', fromDate.toISOString())
          query = query.gte('last_saved_at', fromDate.toISOString())
        } else {
          console.log('[검색] 날짜 필터 없음 (from)')
        }

        if (dateTo.value) {
          const endDate = new Date(dateTo.value)
          endDate.setHours(23, 59, 59, 999)
          console.log('[검색] 날짜 필터 적용 (to):', dateTo.value, '->', endDate.toISOString())
          query = query.lte('last_saved_at', endDate.toISOString())
        } else {
          console.log('[검색] 날짜 필터 없음 (to)')
        }

        const { data: sessionsData, error: sessionsError } = await query
          .order('last_saved_at', { ascending: false })
          .limit(1000)

        if (sessionsError) throw sessionsError

        // theme 정보를 별도로 조회
        const themeIds = [...new Set((sessionsData || []).map(s => s.lego_sets?.theme_id).filter(Boolean))]
        let themesMap = new Map()
        if (themeIds.length > 0) {
          const { data: themesData } = await supabase
            .from('lego_themes')
            .select('theme_id, name')
            .in('theme_id', themeIds)
          
          if (themesData) {
            themesMap = new Map(themesData.map(t => [t.theme_id, t.name]))
          }
        }

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

          const legoSet = session.lego_sets
          const themeName = legoSet?.theme_id ? themesMap.get(legoSet.theme_id) : null
          
          return {
            id: session.id,
            set_id: session.set_id,
            set_name: legoSet?.name || '세트명 없음',
            set_num: legoSet?.set_num || null,
            theme_name: themeName || null,
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

    const formatDateShort = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}.${month}.${day}`
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

    const formatSetNum = (setNum) => {
      if (!setNum) return ''
      // -1, -2 같은 접미사 제거 및 공백 제거
      return String(setNum).replace(/-\d+$/, '').trim()
    }

    const viewSession = (sessionId) => {
      router.push(`/manual-inspection?session=${sessionId}`)
    }

    const searchSets = async () => {
      if (!setSearchQuery.value.trim()) {
        searchResults.value = []
        showSetDropdown.value = false
        return
      }

      try {
        const query = setSearchQuery.value.trim()
        const mainSetNum = query.split('-')[0]
        let results = []
        
        // 1단계: 정확한 매칭 시도
        const { data: exactMatch, error: exactError } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id')
          .eq('set_num', query)
          .limit(20)

        if (!exactError && exactMatch && exactMatch.length > 0) {
          results = exactMatch
        } else {
          // 2단계: 메인 세트 번호로 정확히 일치
          const { data: mainMatch, error: mainError } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id')
            .eq('set_num', mainSetNum)
            .limit(20)

          if (!mainError && mainMatch && mainMatch.length > 0) {
            results = mainMatch
          } else {
            // 3단계: LIKE 패턴으로 검색
            const { data: likeMatch, error: likeError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id')
              .ilike('set_num', `${mainSetNum}%`)
              .order('set_num')
              .limit(20)

            if (!likeError && likeMatch && likeMatch.length > 0) {
              // 하이픈이 없는 메인 세트만 필터링
              results = likeMatch.filter(set => set.set_num === mainSetNum)
              
              if (results.length === 0 && likeMatch.length > 0) {
                const withoutHyphen = likeMatch.filter(set => !set.set_num.includes('-'))
                if (withoutHyphen.length > 0) {
                  results = [withoutHyphen.sort((a, b) => a.set_num.length - b.set_num.length)[0]]
                } else {
                  results = [likeMatch[0]]
                }
              }
            }
          }
        }

        // 테마 정보 조회
        if (results.length > 0) {
          const themeIds = [...new Set(results.map(set => set.theme_id).filter(Boolean))]
          
          if (themeIds.length > 0) {
            const { data: themesData, error: themesError } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .in('theme_id', themeIds)

            if (!themesError && themesData && themesData.length > 0) {
              const themeMap = new Map(themesData.map(theme => [theme.theme_id, theme.name]))
              
              results = results.map(set => ({
                ...set,
                theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null
              }))
            } else {
              results = results.map(set => ({ ...set, theme_name: null }))
            }
          } else {
            results = results.map(set => ({ ...set, theme_name: null }))
          }
        }

        // 검색 결과 업데이트
        searchResults.value = results
        searchResultsKey.value++
        
        if (searchResults.value.length > 0) {
          showSetDropdown.value = true
        } else {
          showSetDropdown.value = false
        }
      } catch (err) {
        console.error('세트 검색 실패:', err)
        searchResults.value = []
        showSetDropdown.value = false
      }
    }

    const searchTooltip = ref('')
    let searchTooltipTimer = null

    const showSearchTooltip = (message) => {
      if (searchTooltipTimer) {
        clearTimeout(searchTooltipTimer)
      }
      searchTooltip.value = message
      searchTooltipTimer = setTimeout(() => {
        searchTooltip.value = ''
        searchTooltipTimer = null
      }, 3000)
    }

    const handleSearchEnter = async () => {
      if (!setSearchQuery.value.trim()) {
        searchResults.value = []
        showSetDropdown.value = false
        showSearchTooltip('검색어를 입력해주세요.')
        return
      }

      // 로그인 체크
      if (!user.value) {
        pendingSearchQuery.value = setSearchQuery.value
        showLoginModal.value = true
        return
      }
      
      await performSearch()
    }

    const performSearch = async () => {
      await searchSets()
      
      if (searchResults.value.length === 1) {
        handleSelectSet(searchResults.value[0])
      } else if (searchResults.value.length > 0) {
        showSetDropdown.value = true
      }
    }

    const handleSearchBlur = () => {
      // blur 이벤트가 드롭다운 클릭보다 먼저 발생할 수 있으므로 약간의 지연
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    const handleSelectSet = (set) => {
      selectedSet.value = set
      selectedSetId.value = set.id
      selectedSetName.value = set.name
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      loadAnalytics()
    }

    const handleResetSet = () => {
      selectedSet.value = null
      selectedSetId.value = ''
      selectedSetName.value = '전체'
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      loadAnalytics()
    }

    const resetFilters = () => {
      dateFrom.value = ''
      dateTo.value = ''
      selectedSetId.value = ''
      selectedSetName.value = '전체'
      selectedSet.value = null
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      loadAnalytics()
    }

    const initializeDateRange = () => {
      // 최근 7일을 기본값으로 설정
      const today = new Date()
      const lastWeek = new Date(today)
      lastWeek.setDate(lastWeek.getDate() - 7)

      dateTo.value = today.toISOString().split('T')[0]
      dateFrom.value = lastWeek.toISOString().split('T')[0]
    }

    // 모달에서 로그인 처리
    const handleLoginInModal = async () => {
      loginLoading.value = true
      loginError.value = ''
      
      try {
        const { data, error: loginErr } = await signIn(loginEmail.value, loginPassword.value)
        
        if (loginErr) {
          loginError.value = loginErr.message
          loginLoading.value = false
          return
        }
        
        if (data?.user) {
          // 로그인 성공 시 사용자 정보 즉시 업데이트
          user.value = data.user
          
          // 세션 정보 확인
          const { data: sessionData } = await supabase.auth.getSession()
          if (sessionData?.session) {
            user.value = sessionData.session.user
          }
          
          // 모달 닫기
          showLoginModal.value = false
          loginEmail.value = ''
          loginPassword.value = ''
          loginError.value = ''
          
          // 사용자 정보 업데이트 대기
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // 데이터 로드
          await checkAdminRole()
          await loadAvailableSets()
          loadAnalytics()
          
          // 저장된 검색 쿼리로 검색 수행
          if (pendingSearchQuery.value) {
            setSearchQuery.value = pendingSearchQuery.value
            await performSearch()
            pendingSearchQuery.value = ''
          }
        } else {
          loginError.value = '로그인에 실패했습니다. 사용자 정보를 가져올 수 없습니다.'
        }
      } catch (err) {
        console.error('로그인 오류:', err)
        loginError.value = err.message || '로그인에 실패했습니다.'
      } finally {
        loginLoading.value = false
      }
    }

    // 테스트 계정 로그인
    const handleTestAccountLogin = async () => {
      loginEmail.value = 'test@pley.co.kr'
      loginPassword.value = '123456'
      await handleLoginInModal()
    }

    // 모달에서 회원가입 처리
    const handleSignupInModal = async () => {
      signupLoading.value = true
      signupError.value = ''
      
      // 비밀번호 확인 검증
      if (signupPassword.value !== signupPasswordConfirm.value) {
        signupError.value = '비밀번호가 일치하지 않습니다.'
        signupLoading.value = false
        return
      }
      
      // 비밀번호 길이 검증
      if (signupPassword.value.length < 6) {
        signupError.value = '비밀번호는 최소 6자 이상이어야 합니다.'
        signupLoading.value = false
        return
      }
      
      try {
        const { data, error: signupErr } = await signUp(signupEmail.value, signupPassword.value)
        
        if (signupErr) {
          signupError.value = signupErr.message
          signupLoading.value = false
          return
        }
        
        if (data?.user) {
          // 회원가입 성공 시 로그인 모달로 전환
          showSignupModal.value = false
          signupEmail.value = ''
          signupPassword.value = ''
          signupPasswordConfirm.value = ''
          signupError.value = ''
          
          // 로그인 모달 표시 및 이메일 자동 입력
          loginEmail.value = data.user.email || signupEmail.value
          showLoginModal.value = true
          
          // 성공 메시지 표시
          loginError.value = '회원가입이 완료되었습니다. 로그인해주세요.'
        } else {
          signupError.value = '회원가입에 실패했습니다.'
        }
      } catch (err) {
        console.error('회원가입 오류:', err)
        signupError.value = err.message || '회원가입에 실패했습니다.'
      } finally {
        signupLoading.value = false
      }
    }

    // 사용자 상태 감지
    watch(user, async (newUser, oldUser) => {
      console.log('[검색] watch(user) 변경 감지:', { hasNewUser: !!newUser, hasOldUser: !!oldUser })
      if (newUser && !userLoading.value) {
        console.log('[검색] 로그인 상태, 데이터 로드 시작')
        await checkAdminRole()
        await loadAvailableSets()
        initializeDateRange()
        console.log('[검색] 날짜 필터 초기화 완료:', { dateFrom: dateFrom.value, dateTo: dateTo.value })
        loadAnalytics()
      }
    }, { immediate: false })

    // 사용자 로딩 완료 감지
    watch(userLoading, async (loading, oldLoading) => {
      console.log('[검색] watch(userLoading) 변경 감지:', { loading, oldLoading, hasUser: !!user.value })
      if (!loading && user.value) {
        console.log('[검색] 사용자 로딩 완료, 데이터 로드 시작')
        await checkAdminRole()
        await loadAvailableSets()
        initializeDateRange()
        console.log('[검색] 날짜 필터 초기화 완료:', { dateFrom: dateFrom.value, dateTo: dateTo.value })
        loadAnalytics()
      }
    }, { immediate: true })

    onMounted(async () => {
      console.log('[검색] onMounted 실행:', { userLoading: userLoading.value, hasUser: !!user.value })
      // 사용자 로딩이 완료되고 사용자가 있으면 즉시 실행
      await nextTick()
      if (!userLoading.value && user.value) {
        console.log('[검색] onMounted에서 즉시 데이터 로드')
        await checkAdminRole()
        await loadAvailableSets()
        initializeDateRange()
        console.log('[검색] 날짜 필터 초기화 완료:', { dateFrom: dateFrom.value, dateTo: dateTo.value })
        loadAnalytics()
      } else {
        console.log('[검색] onMounted에서 데이터 로드 안 함 (로딩 중이거나 사용자 없음)')
      }
    })

    onUnmounted(() => {
      if (showSetDropdown.value) {
        showSetDropdown.value = false
      }
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
      statusLabel,
      formatDate,
      formatDateShort,
      formatDuration,
      formatDateDisplay,
      formatSetNum,
      viewSession,
      isAdmin,
      dateFrom,
      dateTo,
      selectedSetId,
      selectedSetName,
      selectedSet,
      setSearchQuery,
      searchResults,
      showSetDropdown,
      setDropdownRef,
      searchInputRef,
      handleSearchEnter,
      handleSearchBlur,
      handleSelectSet,
      handleResetSet,
      resetFilters,
      showLoginModal,
      loginEmail,
      loginPassword,
      loginLoading,
      loginError,
      handleLoginInModal,
      handleTestAccountLogin,
      showSignupModal,
      signupEmail,
      signupPassword,
      signupPasswordConfirm,
      signupLoading,
      signupError,
      handleSignupInModal,
      searchTooltip,
      userLoading
    }
  }
}
</script>

<style scoped>
.set-search-field {
  position: relative;
}

.set-search-input-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
}

.set-search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
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
  flex-shrink: 0;
}

.set-search-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.set-search-button:active:not(:disabled) {
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

.option-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.option-row-meta {
  margin-bottom: 0.25rem;
}

.option-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.option-value {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 400;
}

.option-set-display {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
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

.select-fade-enter-active,
.select-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.select-fade-enter-from,
.select-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.inspection-analytics-page {
  min-height: 100vh;
  background: #f9fafb;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
  text-align: center;
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
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.timeline-set-name .set-num,
td .set-num {
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
}

.timeline-set-name .separator,
td .separator {
  font-size: 0.875rem;
  font-weight: 400;
  color: #6b7280;
}

.timeline-set-name .theme-name,
td .theme-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
}

.timeline-set-name .set-name,
td .set-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
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
  padding: 0.75rem 1rem;
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

.table-row {
  transition: background 0.2s ease;
}

.table-row-clickable {
  cursor: pointer;
}

.table-row-clickable:hover {
  background: #f9fafb;
}

.table-row-completed {
  cursor: default;
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

.date-range {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.date-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.custom-date-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.date-display {
  padding: 0.5rem 0.75rem;
  padding-right: 2rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #111827;
  background: #ffffff;
  height: 44px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  z-index: 0;
}

.date-input-wrapper:focus-within .date-display {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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

/* 검색 툴팁 스타일 */
.set-search-field {
  position: relative;
  overflow: visible;
}

.search-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: #1f2937;
  color: #ffffff;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  z-index: 10000;
  font-size: 0.875rem;
  white-space: nowrap;
  animation: slideInTooltip 0.3s ease;
}

.search-tooltip::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 1rem;
  border: 6px solid transparent;
  border-bottom-color: #1f2937;
}

@keyframes slideInTooltip {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 로그인 모달 스타일 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.login-modal-content {
  max-width: 450px;
}

.modal-header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.login-form-in-modal {
  padding: 0;
}

.login-form-in-modal .form-group {
  margin-bottom: 1.25rem;
}

.login-form-in-modal .form-group:last-of-type {
  margin-bottom: 1rem;
}

.login-form-in-modal .form-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.login-form-in-modal .form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message-in-modal {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.875rem;
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.login-modal-links {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.login-link {
  color: #2563eb;
  text-decoration: none;
  transition: color 0.2s ease;
}

.login-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.login-link-btn {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
  text-decoration: none;
}

.login-link-btn:hover:not(:disabled) {
  color: #1d4ed8;
  text-decoration: underline;
}

.login-link-btn:disabled {
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.link-separator {
  color: #9ca3af;
}
</style>

