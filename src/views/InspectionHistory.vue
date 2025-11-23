<template>
  <div class="inspection-history-page">
    <!-- 디버그 정보 -->
    <div style="position: fixed; top: 10px; right: 10px; background: yellow; padding: 10px; z-index: 9999; font-size: 12px;">
      <div>showLoginModal: {{ showLoginModal }}</div>
      <div>userLoading: {{ userLoading }}</div>
      <div>hasUser: {{ !!user }}</div>
    </div>
    
    <div class="page-header">
      <h1>검수 이력</h1>
      <p>완료된 검수 세션 목록을 확인할 수 있습니다</p>
    </div>

    <div class="history-content">
      <div v-if="loading" class="loading-state">
        <span>로딩 중...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>

      <div v-else-if="sessions.length === 0" class="empty-state">
        <p>완료된 검수 세션이 없습니다</p>
        <router-link to="/manual-inspection" class="btn-primary">검수 시작하기</router-link>
      </div>

      <div v-else class="sessions-list">
        <div class="sessions-header">
          <div class="filter-controls">
            <select v-model="statusFilter" class="filter-select">
              <option value="all">전체</option>
              <option value="completed">완료</option>
              <option value="paused">임시 저장</option>
            </select>
            <select v-model="sortBy" class="filter-select">
              <option value="recent">최근순</option>
              <option value="oldest">오래된순</option>
              <option value="progress">진행률순</option>
            </select>
          </div>
        </div>

        <div class="sessions-grid">
          <div
            v-for="session in filteredSessions"
            :key="session.id"
            class="session-card"
            @click="viewSessionDetail(session.id)"
          >
            <div class="session-card-header">
              <h3>
                <span v-if="session.set_num" class="set-num">{{ formatSetNum(session.set_num) }}</span>
                <span v-if="session.set_num && session.theme_name" class="separator">|</span>
                <span v-if="session.theme_name" class="theme-name">{{ session.theme_name }}</span>
                <span v-if="session.set_num || session.theme_name" class="set-name">{{ session.set_name || '세트명 없음' }}</span>
                <span v-else>{{ session.set_name || '세트명 없음' }}</span>
              </h3>
              <span class="session-status" :class="`status-${session.status}`">
                {{ statusLabel(session.status) }}
              </span>
            </div>

            <div class="session-card-body">
              <div class="session-metric">
                <span class="metric-label">진행률</span>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: `${session.progress || 0}%` }"></div>
                </div>
                <span class="metric-value">{{ session.progress || 0 }}%</span>
              </div>

              <div class="session-info">
                <div class="info-item">
                  <span class="info-label">시작일시</span>
                  <span class="info-value">{{ formatDate(session.started_at) }}</span>
                </div>
                <div class="info-item" v-if="session.completed_at">
                  <span class="info-label">완료일시</span>
                  <span class="info-value">{{ formatDate(session.completed_at) }}</span>
                </div>
                <div class="info-item" v-if="session.last_saved_at">
                  <span class="info-label">마지막 저장</span>
                  <span class="info-value">{{ formatTime(session.last_saved_at) }}</span>
                </div>
              </div>
            </div>

            <div class="session-card-footer">
              <button
                @click.stop="resumeSession(session.id)"
                v-if="session.status === 'paused'"
                class="btn-resume"
              >
                이어하기
              </button>
              <button
                @click.stop="viewSessionDetail(session.id)"
                class="btn-view"
              >
                상세보기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 로그인 모달 -->
    <div v-if="showLoginModal" class="modal-overlay" @click="showLoginModal = false">
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
    <div v-if="showSignupModal" class="modal-overlay" @click="showSignupModal = false">
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { useInspectionSession } from '../composables/useInspectionSession'

export default {
  name: 'InspectionHistory',
  setup() {
    console.log('========== InspectionHistory setup() 실행 ==========')
    
    const router = useRouter()
    const { supabase, user, signIn, signUp, loading: userLoading } = useSupabase()
    const { loadSession } = useInspectionSession()

    console.log('useSupabase 결과:', {
      hasUser: !!user.value,
      userLoading: userLoading.value
    })

    const loading = ref(false)
    const error = ref(null)
    const sessions = ref([])
    const statusFilter = ref('all')
    const sortBy = ref('recent')

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
    
    console.log('초기 showLoginModal:', showLoginModal.value)

    const filteredSessions = computed(() => {
      let filtered = [...sessions.value]

      if (statusFilter.value !== 'all') {
        filtered = filtered.filter(s => s.status === statusFilter.value)
      }

      filtered.sort((a, b) => {
        switch (sortBy.value) {
          case 'oldest':
            return new Date(a.started_at) - new Date(b.started_at)
          case 'progress':
            return (b.progress || 0) - (a.progress || 0)
          case 'recent':
          default:
            return new Date(b.last_saved_at || b.started_at) - new Date(a.last_saved_at || a.started_at)
        }
      })

      return filtered
    })

    const loadSessions = async () => {
      if (!user.value) return

      try {
        loading.value = true
        error.value = null

        const { data, error: err } = await supabase
          .from('inspection_sessions')
          .select(`
            id,
            set_id,
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
          .eq('user_id', user.value.id)
          .in('status', ['completed', 'paused'])
          .order('last_saved_at', { ascending: false })
          .limit(100)

        if (err) throw err

        // theme 정보를 별도로 조회
        const themeIds = [...new Set((data || []).map(s => s.lego_sets?.theme_id).filter(Boolean))]
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

        sessions.value = (data || []).map(session => {
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
            completed_at: session.completed_at
          }
        })
      } catch (err) {
        console.error('검수 이력 로드 실패:', err)
        error.value = err.message || '검수 이력을 불러오는데 실패했습니다'
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

    const formatTime = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      const now = new Date()
      const diff = now - date
      const minutes = Math.floor(diff / 60000)

      if (minutes < 1) return '방금 전'
      if (minutes < 60) return `${minutes}분 전`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${hours}시간 전`
      return formatDate(dateString)
    }

    const formatSetNum = (setNum) => {
      if (!setNum) return ''
      // -1, -2 같은 접미사 제거 및 공백 제거
      return String(setNum).replace(/-\d+$/, '').trim()
    }

    const resumeSession = async (sessionId) => {
      try {
        await loadSession(sessionId)
        router.push('/manual-inspection')
      } catch (err) {
        console.error('세션 복원 실패:', err)
        error.value = '세션을 복원하는데 실패했습니다'
      }
    }

    const viewSessionDetail = (sessionId) => {
      router.push(`/manual-inspection?session=${sessionId}`)
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
          
          // 세션 목록 로드
          await loadSessions()
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

    // 초기 로그인 체크 함수
    const checkLoginAndShowModal = () => {
      console.log('========== checkLoginAndShowModal 호출 ==========')
      console.log('userLoading.value:', userLoading.value)
      console.log('user.value:', user.value)
      console.log('showLoginModal.value:', showLoginModal.value)
      
      // 사용자 로딩이 완료되고 사용자가 없으면 모달 표시
      if (!userLoading.value && !user.value) {
        console.log('>>> 로그아웃 상태 감지, 모달 표시')
        showLoginModal.value = true
        console.log('>>> showLoginModal.value 설정 후:', showLoginModal.value)
      } else if (!userLoading.value && user.value) {
        console.log('>>> 로그인 상태, 세션 목록 로드')
        loadSessions()
      } else {
        console.log('>>> 사용자 로딩 중 또는 조건 불일치')
      }
    }

    // 사용자 상태 감지
    watch(user, (newUser, oldUser) => {
      console.log('========== watch(user) 변경 감지 ==========')
      console.log('newUser:', !!newUser, newUser?.id)
      console.log('oldUser:', !!oldUser)
      console.log('showLoginModal:', showLoginModal.value)
      
      if (newUser) {
        // 로그인 상태일 때 세션 목록 로드
        console.log('>>> 로그인 상태, 세션 목록 로드')
        loadSessions()
        // 로그인 성공 시 모달 닫기
        if (showLoginModal.value) {
          console.log('>>> 로그인 성공, 모달 닫기')
          showLoginModal.value = false
        }
      } else {
        // 로그아웃 상태일 때 세션 목록 초기화
        console.log('>>> 로그아웃 상태, 세션 목록 초기화')
        sessions.value = []
      }
    }, { immediate: true })

    // 사용자 로딩 상태 감지
    watch(userLoading, (isLoading, wasLoading) => {
      console.log('========== watch(userLoading) 변경 감지 ==========')
      console.log('isLoading:', isLoading)
      console.log('wasLoading:', wasLoading)
      console.log('hasUser:', !!user.value)
      console.log('showLoginModal:', showLoginModal.value)
      
      if (!isLoading) {
        // 로딩이 완료되면 체크
        console.log('>>> 사용자 로딩 완료, 체크 실행')
        checkLoginAndShowModal()
      }
    }, { immediate: true })

    onMounted(async () => {
      console.log('[InspectionHistory] ========== onMounted 시작 ==========')
      console.log('[InspectionHistory] 초기 상태:', {
        userLoading: userLoading.value,
        hasUser: !!user.value,
        userId: user.value?.id,
        showLoginModal: showLoginModal.value
      })
      
      // 즉시 체크
      const checkImmediately = () => {
        console.log('[InspectionHistory] 즉시 체크 실행')
        if (!userLoading.value && !user.value) {
          console.log('[InspectionHistory] 즉시 체크: 로그아웃 상태, 모달 표시')
          showLoginModal.value = true
          console.log('[InspectionHistory] showLoginModal.value =', showLoginModal.value)
        } else if (!userLoading.value && user.value) {
          console.log('[InspectionHistory] 즉시 체크: 로그인 상태, 세션 로드')
          loadSessions()
        } else {
          console.log('[InspectionHistory] 즉시 체크: 로딩 중 또는 조건 불일치')
        }
      }
      
      // nextTick으로 DOM 업데이트 대기
      await nextTick()
      console.log('[InspectionHistory] nextTick 완료')
      
      // 즉시 체크
      checkImmediately()
      
      // watch가 작동하지 않을 경우를 대비한 안전장치들
      setTimeout(() => {
        console.log('[InspectionHistory] ========== 100ms 후 체크 ==========')
        console.log('[InspectionHistory] 상태:', {
          userLoading: userLoading.value,
          hasUser: !!user.value,
          showLoginModal: showLoginModal.value
        })
        checkImmediately()
      }, 100)
      
      setTimeout(() => {
        console.log('[InspectionHistory] ========== 500ms 후 체크 ==========')
        console.log('[InspectionHistory] 상태:', {
          userLoading: userLoading.value,
          hasUser: !!user.value,
          showLoginModal: showLoginModal.value
        })
        checkImmediately()
      }, 500)
      
      setTimeout(() => {
        console.log('[InspectionHistory] ========== 1초 후 최종 체크 ==========')
        console.log('[InspectionHistory] 상태:', {
          userLoading: userLoading.value,
          hasUser: !!user.value,
          showLoginModal: showLoginModal.value
        })
        
        // 최종 안전장치: 무조건 모달 표시
        if (!userLoading.value && !user.value) {
          console.log('[InspectionHistory] 최종 안전장치: 모달 강제 표시')
          showLoginModal.value = true
          console.log('[InspectionHistory] 최종 showLoginModal.value =', showLoginModal.value)
        }
      }, 1000)
      
      console.log('[InspectionHistory] ========== onMounted 완료 ==========')
    })

    return {
      loading,
      error,
      sessions,
      statusFilter,
      sortBy,
      filteredSessions,
      statusLabel,
      formatDate,
      formatTime,
      formatSetNum,
      resumeSession,
      viewSessionDetail,
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
      handleSignupInModal
    }
  }
}
</script>

<style scoped>
.inspection-history-page {
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
}

.page-header p {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
}

.history-content {
  max-width: 1400px;
  margin: 0 auto;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.sessions-header {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.filter-controls {
  display: flex;
  gap: 0.75rem;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #1f2937;
  font-size: 0.875rem;
  cursor: pointer;
}

.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.session-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.session-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #d1d5db;
}

.session-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.session-card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.session-card-header h3 .set-num {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

.session-card-header h3 .separator {
  font-size: 1rem;
  font-weight: 400;
  color: #6b7280;
}

.session-card-header h3 .theme-name {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

.session-card-header h3 .set-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.session-status {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.session-status.status-completed {
  background: #dbeafe;
  color: #1e40af;
}

.session-status.status-paused {
  background: #fef3c7;
  color: #92400e;
}

.session-card-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-metric {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
  transition: width 0.3s ease;
}

.metric-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.info-label {
  color: #6b7280;
}

.info-value {
  color: #111827;
  font-weight: 500;
}

.session-card-footer {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 0.5rem;
}

.btn-resume,
.btn-view {
  flex: 1;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-resume {
  background: #2563eb;
  color: #ffffff;
}

.btn-resume:hover {
  background: #1d4ed8;
}

.btn-view {
  background: #f3f4f6;
  color: #374151;
}

.btn-view:hover {
  background: #e5e7eb;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  font-weight: 500;
  text-decoration: none;
  display: inline-block;
  transition: background 0.2s ease;
}

.btn-primary:hover {
  background: #1d4ed8;
}

@media (max-width: 768px) {
  .inspection-history-page {
    padding: 1rem;
  }

  .sessions-grid {
    grid-template-columns: 1fr;
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

