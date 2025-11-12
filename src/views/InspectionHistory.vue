<template>
  <div class="inspection-history-page">
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
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { useInspectionSession } from '../composables/useInspectionSession'

export default {
  name: 'InspectionHistory',
  setup() {
    const router = useRouter()
    const { supabase, user } = useSupabase()
    const { loadSession } = useInspectionSession()

    const loading = ref(false)
    const error = ref(null)
    const sessions = ref([])
    const statusFilter = ref('all')
    const sortBy = ref('recent')

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

    onMounted(() => {
      loadSessions()
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
      viewSessionDetail
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
</style>

