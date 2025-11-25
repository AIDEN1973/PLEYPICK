<template>
  <div class="inspection-notes-page">
    <div class="page-header">
      <h1>검수노트</h1>
      <p>세트별 특이사항을 기록하고 관리할 수 있습니다.</p>
    </div>

    <div class="notes-content">
      <div class="notes-controls">
        <div class="set-selector">
          <label class="filter-label">세트검색</label>
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

        <div class="note-type-filter">
          <div class="filter-buttons">
            <button
              v-for="type in noteTypes"
              :key="type.value"
              @click="noteTypeFilter = type.value"
              :class="['filter-btn', { active: noteTypeFilter === type.value }]"
            >
              {{ type.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="notes-main">
        <div class="notes-list-section">
          <div class="section-header">
            <h3>노트목록</h3>
            <span class="notes-count">{{ filteredNotes.length }}건</span>
          </div>

          <div v-if="loading" class="loading-state">
            <span>로딩 중...</span>
          </div>

          <div v-else-if="error" class="error-state">
            <span>{{ error }}</span>
          </div>

          <div v-else-if="filteredNotes.length === 0" class="empty-state">
            <p>등록된 노트가 없습니다</p>
          </div>

          <div v-else class="notes-list">
            <div
              v-for="note in filteredNotes"
              :key="note.id"
              class="note-item"
            >
              <div class="note-item-content">
                <div class="note-item-image-wrapper">
                  <img
                    v-if="note.set_img_url || note.webp_image_url"
                    :src="note.webp_image_url || note.set_img_url"
                    :alt="note.set_name || note.set_num"
                    class="note-item-image"
                    loading="lazy"
                    crossorigin="anonymous"
                  />
                  <div v-else class="note-item-no-image">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                    </svg>
                  </div>
                </div>
                <div class="note-item-main">
                  <div class="note-item-header">
                    <div class="note-meta">
                      <span class="note-type" :class="`type-${note.note_type}`">
                        {{ noteTypeLabel(note.note_type) }}
                      </span>
                      <div class="note-set-info">
                        <span class="note-set">{{ formatSetDisplay(note.set_num, note.theme_name, note.set_name) }}</span>
                        <span v-if="note.part_id" class="note-part">부품: {{ note.part_id }}</span>
                      </div>
                    </div>
                    <div class="note-actions">
                      <button
                        @click="editNote(note)"
                        class="btn-icon"
                        title="수정"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button
                        @click="deleteNote(note.id)"
                        class="btn-icon btn-danger"
                        title="삭제"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="note-item-body">
                    <p class="note-text">{{ note.note_text }}</p>
                  </div>
                  <div class="note-item-footer">
                    <span class="note-date">{{ formatDate(note.created_at) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="note-form-section">
          <div class="section-header">
            <h3>{{ editingNote ? '노트수정' : '노트추가' }}</h3>
          </div>

          <form @submit.prevent="submitNote" class="note-form">
            <div class="form-row">
              <label for="form-set">세트</label>
              <div class="set-search-wrapper" ref="noteFormSetDropdownRef">
                <div class="set-search-input-row" ref="noteFormSearchInputRef">
                  <div class="set-search-input-wrapper">
                    <input
                      type="text"
                      id="form-set"
                      v-model="noteFormSetSearchQuery"
                      @keyup.enter="handleNoteFormSearchEnter"
                      @blur="handleNoteFormSearchBlur"
                      placeholder="예 : 76917"
                      class="set-search-input"
                      :disabled="loading"
                    />
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M14 14L11.1 11.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <button
                    type="button"
                    @click="handleNoteFormSearchEnter"
                    class="search-button"
                    :disabled="loading"
                  >
                    검색
                  </button>
                </div>
                <!-- 검색 툴팁 -->
                <div v-if="noteFormSearchTooltip" class="search-tooltip">
                  <span>{{ noteFormSearchTooltip }}</span>
                </div>

                <transition name="select-fade">
                  <div v-if="noteFormShowSetDropdown && noteFormSearchResults.length > 0" :key="`note-form-dropdown-${noteFormSearchResultsKey}`" class="custom-select-dropdown">
                    <button
                      v-for="(set, index) in noteFormSearchResults"
                      :key="`${set.id}-${set.set_num}-${noteFormSearchResultsKey}-${index}`"
                      type="button"
                      class="custom-select-option"
                      :class="{ active: noteForm.set_id === set.id }"
                      @click="handleNoteFormSelectSet(set)"
                    >
                      <div class="option-content">
                        <div class="option-image-wrapper" :data-set-num="set.set_num">
                          <img
                            v-if="set.webp_image_url || set.set_img_url"
                            :src="set.webp_image_url || set.set_img_url"
                            :alt="set.name || set.set_num"
                            :data-set-id="set.id"
                            class="option-set-image"
                            loading="lazy"
                            crossorigin="anonymous"
                          />
                          <div 
                            v-else
                            class="option-no-image"
                          >
                            이미지 없음
                          </div>
                        </div>
                        <div class="option-info">
                          <span class="option-set-num">{{ formatSetNumber(set.set_num) }}</span>
                          <span class="option-set-title">{{ [set.theme_name, set.name].filter(Boolean).join(' ') || (set.name || '') }}</span>
                          <span class="option-set-parts">부품수 : {{ set.num_parts || 0 }}개</span>
                        </div>
                      </div>
                    </button>
                  </div>
                </transition>
                <div v-if="noteForm.set_id && noteFormSelectedSet" class="selected-set-info">
                  <button class="close-result-button" @click="handleNoteFormResetSet" title="초기화">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                  <div class="selected-set-row">
                    <div class="selected-set-thumb-wrapper">
                      <img
                        v-if="noteFormSelectedSet.webp_image_url || noteFormSelectedSet.set_img_url"
                        :src="noteFormSelectedSet.webp_image_url || noteFormSelectedSet.set_img_url"
                        :alt="noteFormSelectedSet.name || noteFormSelectedSet.set_num"
                        class="selected-set-thumb"
                        loading="lazy"
                        crossorigin="anonymous"
                      />
                      <div v-else class="selected-set-no-image">이미지 없음</div>
                    </div>
                    <div class="selected-set-details">
                      <div class="selected-set-name">{{ formatSetDisplay(noteFormSelectedSet.set_num, noteFormSelectedSet.theme_name, noteFormSelectedSet.name) }}</div>
                      <div class="selected-set-meta">부품수: {{ noteFormSelectedSet.num_parts || 0 }}개</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-row">
              <label for="form-type">유형</label>
              <div class="custom-type-select-wrapper" ref="noteTypeDropdownRef">
                <button
                  type="button"
                  id="form-type"
                  @click="showNoteTypeDropdown = !showNoteTypeDropdown"
                  class="custom-type-select-button"
                  :class="{ 'active': showNoteTypeDropdown }"
                >
                  <span>{{ noteTypeLabel(noteForm.note_type) }}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="dropdown-arrow" :class="{ 'open': showNoteTypeDropdown }">
                    <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <transition name="select-fade">
                  <div v-if="showNoteTypeDropdown" class="custom-type-select-dropdown">
                    <button
                      v-for="type in noteTypes"
                      :key="type.value"
                      type="button"
                      class="custom-type-select-option"
                      :class="{ 'active': noteForm.note_type === type.value }"
                      @click="handleSelectNoteType(type.value)"
                    >
                      {{ type.label }}
                    </button>
                  </div>
                </transition>
              </div>
            </div>

            <div class="form-row">
              <label for="form-part">대상 부품 (선택)</label>
              <input
                id="form-part"
                v-model="noteForm.part_id"
                type="text"
                placeholder="부품 ID (예: 3001)"
                class="form-input"
              />
            </div>

            <div class="form-row">
              <label for="form-text">내용</label>
              <textarea
                id="form-text"
                v-model="noteForm.note_text"
                required
                rows="5"
                placeholder="검수 시 참고할 내용을 입력하세요"
                class="form-textarea"
              ></textarea>
            </div>

            <div class="form-actions">
              <button
                v-if="editingNote"
                @click="cancelEdit"
                type="button"
                class="btn-secondary"
              >
                취소
              </button>
              <button type="submit" class="btn-primary">
                {{ editingNote ? '수정' : '추가' }}
              </button>
            </div>
          </form>
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
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useInspectionSession } from '../composables/useInspectionSession'
import { formatSetDisplay, fetchSetMetadata } from '../utils/setDisplay'

export default {
  name: 'InspectionNotes',
  setup() {
    const { supabase, user, signIn, signUp } = useSupabase()
    const { addSetNote, deleteSetNote } = useInspectionSession()

    const loading = ref(false)
    const error = ref(null)
    const availableSets = ref([])
    const setMetadataMap = ref(new Map())
    const notes = ref([])
    const selectedSetId = ref('')
    const noteTypeFilter = ref('all')
    const editingNote = ref(null)

    // 세트 검색 관련 (필터용)
    const setSearchQuery = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0)
    const showSetDropdown = ref(false)
    const setDropdownRef = ref(null)
    const searchInputRef = ref(null)
    const searchTooltip = ref('')
    let searchTooltipTimer = null

    // 노트 폼용 세트 검색 관련
    const noteFormSetSearchQuery = ref('')
    const noteFormSearchResults = ref([])
    const noteFormSearchResultsKey = ref(0)
    const noteFormShowSetDropdown = ref(false)
    const noteFormSetDropdownRef = ref(null)
    const noteFormSearchInputRef = ref(null)
    const noteFormSearchTooltip = ref('')
    const noteFormSelectedSet = ref(null)
    let noteFormSearchTooltipTimer = null

    // 노트 유형 드롭다운 관련
    const showNoteTypeDropdown = ref(false)
    const noteTypeDropdownRef = ref(null)

    const noteTypes = [
      { value: 'general', label: '일반' },
      { value: 'tip', label: '검수팁' },
      { value: 'caution', label: '주의' },
      { value: 'missing_frequent', label: '자주누락' }
    ]

    const noteForm = ref({
      set_id: '',
      note_type: 'general',
      part_id: '',
      note_text: ''
    })

    const showLoginModal = ref(false)
    const showSignupModal = ref(false)
    const loginEmail = ref('')
    const loginPassword = ref('')
    const loginLoading = ref(false)
    const loginError = ref('')
    const pendingNoteForm = ref(null)
    
    // 회원가입 모달 관련
    const signupEmail = ref('')
    const signupPassword = ref('')
    const signupPasswordConfirm = ref('')
    const signupLoading = ref(false)
    const signupError = ref('')

    const filteredNotes = computed(() => {
      let filtered = [...notes.value]

      if (selectedSetId.value) {
        filtered = filtered.filter(note => note.set_id === selectedSetId.value)
      }

      if (noteTypeFilter.value !== 'all') {
        filtered = filtered.filter(note => note.note_type === noteTypeFilter.value)
      }

      return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })

    const ensureSetMetadata = async (setIds) => {
      const uniqueIds = Array.from(new Set((setIds || []).filter(Boolean)))
      const missingIds = uniqueIds.filter(id => !setMetadataMap.value.has(id))

      if (missingIds.length === 0) return

      const metadata = await fetchSetMetadata(supabase, missingIds)
      metadata.forEach((meta, id) => {
        setMetadataMap.value.set(id, {
          set_name: meta.set_name || '세트명 없음',
          set_num: meta.set_num || '',
          theme_name: meta.theme_name || null
        })
      })
    }

    const loadAvailableSets = async () => {
      try {
        const { data, error: err } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id')
          .order('name')
          .limit(200)

        if (err) throw err
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

        availableSets.value = (data || []).map(set => {
          const themeName = set.theme_id ? (themeMap.get(set.theme_id) || null) : null
          const meta = {
            set_name: set.name || '세트명 없음',
            set_num: set.set_num || '',
            theme_name: themeName
          }
          setMetadataMap.value.set(set.id, meta)
          return {
            id: set.id,
            name: meta.set_name,
            set_num: meta.set_num,
            theme_name: meta.theme_name,
            display_name: formatSetDisplay(meta.set_num, meta.theme_name, meta.set_name)
          }
        })
      } catch (err) {
        console.error('세트 목록 로드 실패:', err)
        error.value = '세트 목록을 불러오는데 실패했습니다'
      }
    }

    const loadNotes = async () => {
      if (!selectedSetId.value) {
        await loadAllNotes()
        return
      }

      try {
        loading.value = true
        const { data, error: err } = await supabase
          .from('set_inspection_notes')
          .select(`
            *,
            lego_sets:set_id (
              name,
              set_num,
              set_img_url,
              webp_image_url
            )
          `)
          .eq('set_id', selectedSetId.value)
          .order('created_at', { ascending: false })

        if (err) throw err

        const userIds = [...new Set((data || []).map(note => note.created_by).filter(Boolean))]
        const userEmailsMap = await loadUserEmails(userIds)

        const setIds = (data || []).map(note => note.set_id).filter(Boolean)
        await ensureSetMetadata(setIds)

        notes.value = (data || []).map(note => {
          const meta = setMetadataMap.value.get(note.set_id) || {}
          return {
            ...note,
            created_by_email: userEmailsMap.get(note.created_by) || null,
            set_name: meta.set_name || note.lego_sets?.name || null,
            set_num: meta.set_num || note.lego_sets?.set_num || null,
            theme_name: meta.theme_name || null,
            set_img_url: note.lego_sets?.set_img_url || null,
            webp_image_url: note.lego_sets?.webp_image_url || null
          }
        })
      } catch (err) {
        console.error('노트 로드 실패:', err)
        error.value = '노트를 불러오는데 실패했습니다'
      } finally {
        loading.value = false
      }
    }

    const loadUserEmails = async (userIds) => {
      if (!userIds || userIds.length === 0) return new Map()

      try {
        const { data: adminUsers, error: adminError } = await supabase
          .from('admin_users')
          .select('id, email')
          .in('id', userIds)

        const emailMap = new Map()
        if (adminUsers && !adminError) {
          adminUsers.forEach(admin => {
            emailMap.set(admin.id, admin.email)
          })
        }

        return emailMap
      } catch (err) {
        console.warn('사용자 이메일 로드 실패:', err)
        return new Map()
      }
    }

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

    const handleSearchEnter = async () => {
      if (!setSearchQuery.value.trim()) {
        searchResults.value = []
        showSetDropdown.value = false
        showSearchTooltip('검색어를 입력해주세요.')
        return
      }
      
      await searchSets()
      
      if (searchResults.value.length === 1) {
        handleSelectSet(searchResults.value[0])
      } else if (searchResults.value.length > 0) {
        showSetDropdown.value = true
      }
    }

    const handleSearchBlur = () => {
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    const handleSelectSet = (set) => {
      selectedSetId.value = set.id
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      loadNotes()
    }

    const handleResetSet = () => {
      selectedSetId.value = ''
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      loadNotes()
    }

    // 노트 폼용 세트 검색 함수
    const showNoteFormSearchTooltip = (message) => {
      if (noteFormSearchTooltipTimer) {
        clearTimeout(noteFormSearchTooltipTimer)
      }
      noteFormSearchTooltip.value = message
      noteFormSearchTooltipTimer = setTimeout(() => {
        noteFormSearchTooltip.value = ''
        noteFormSearchTooltipTimer = null
      }, 3000)
    }

    const searchSetsForNoteForm = async () => {
      console.log('[노트 폼 검색] searchSetsForNoteForm 시작:', { query: noteFormSetSearchQuery.value })
      
      if (!noteFormSetSearchQuery.value.trim()) {
        noteFormSearchResults.value = []
        noteFormShowSetDropdown.value = false
        return
      }

      try {
        const query = noteFormSetSearchQuery.value.trim()
        const mainSetNum = query.split('-')[0]
        let results = []
        
        console.log('[노트 폼 검색] 검색 단계 1: 정확한 매칭 시도:', query)
        // 1단계: 정확한 매칭 시도
        const { data: exactMatch, error: exactError } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id, num_parts, set_img_url, webp_image_url')
          .eq('set_num', query)
          .limit(20)

        if (exactError) {
          console.error('[노트 폼 검색] 정확한 매칭 오류:', exactError)
        }

        if (!exactError && exactMatch && exactMatch.length > 0) {
          console.log('[노트 폼 검색] 정확한 매칭 결과:', exactMatch.length)
          results = exactMatch
        } else {
          console.log('[노트 폼 검색] 검색 단계 2: 메인 세트 번호로 검색:', mainSetNum)
          // 2단계: 메인 세트 번호로 정확히 일치
          const { data: mainMatch, error: mainError } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, set_img_url, webp_image_url')
            .eq('set_num', mainSetNum)
            .limit(20)

          if (mainError) {
            console.error('[노트 폼 검색] 메인 세트 번호 검색 오류:', mainError)
          }

          if (!mainError && mainMatch && mainMatch.length > 0) {
            console.log('[노트 폼 검색] 메인 세트 번호 검색 결과:', mainMatch.length)
            results = mainMatch
          } else {
            console.log('[노트 폼 검색] 검색 단계 3: LIKE 패턴으로 검색:', `${mainSetNum}%`)
            // 3단계: LIKE 패턴으로 검색
            const { data: likeMatch, error: likeError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, set_img_url, webp_image_url')
              .ilike('set_num', `${mainSetNum}%`)
              .order('set_num')
              .limit(20)

            if (likeError) {
              console.error('[노트 폼 검색] LIKE 패턴 검색 오류:', likeError)
            }

            if (!likeError && likeMatch && likeMatch.length > 0) {
              console.log('[노트 폼 검색] LIKE 패턴 검색 결과:', likeMatch.length)
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

        console.log('[노트 폼 검색] 최종 결과 개수:', results.length)

        // 테마 정보 조회
        if (results.length > 0) {
          const themeIds = [...new Set(results.map(set => set.theme_id).filter(Boolean))]
          
          if (themeIds.length > 0) {
            const { data: themesData, error: themesError } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .in('theme_id', themeIds)

            if (themesError) {
              console.error('[노트 폼 검색] 테마 정보 조회 오류:', themesError)
            }

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
        noteFormSearchResults.value = results
        noteFormSearchResultsKey.value++
        
        console.log('[노트 폼 검색] 검색 결과 업데이트 완료:', {
          resultsCount: noteFormSearchResults.value.length,
          showDropdown: noteFormSearchResults.value.length > 0
        })
        
        if (noteFormSearchResults.value.length > 0) {
          noteFormShowSetDropdown.value = true
        } else {
          noteFormShowSetDropdown.value = false
        }
      } catch (err) {
        console.error('[노트 폼 검색] 세트 검색 실패:', err)
        noteFormSearchResults.value = []
        noteFormShowSetDropdown.value = false
        throw err
      }
    }

    const handleNoteFormSearchEnter = async () => {
      console.log('[노트 폼 검색] handleNoteFormSearchEnter 호출:', { query: noteFormSetSearchQuery.value })
      
      if (!noteFormSetSearchQuery.value.trim()) {
        noteFormSearchResults.value = []
        noteFormShowSetDropdown.value = false
        showNoteFormSearchTooltip('검색어를 입력해주세요.')
        return
      }
      
      try {
        await searchSetsForNoteForm()
        console.log('[노트 폼 검색] 검색 완료:', { 
          resultsCount: noteFormSearchResults.value.length,
          results: noteFormSearchResults.value 
        })
        
        if (noteFormSearchResults.value.length === 1) {
          console.log('[노트 폼 검색] 단일 결과, 자동 선택')
          handleNoteFormSelectSet(noteFormSearchResults.value[0])
        } else if (noteFormSearchResults.value.length > 0) {
          console.log('[노트 폼 검색] 여러 결과, 드롭다운 표시')
          noteFormShowSetDropdown.value = true
        } else {
          console.log('[노트 폼 검색] 검색 결과 없음')
          showNoteFormSearchTooltip('검색 결과가 없습니다.')
        }
      } catch (err) {
        console.error('[노트 폼 검색] 오류:', err)
        showNoteFormSearchTooltip('검색 중 오류가 발생했습니다.')
      }
    }

    const handleNoteFormSearchBlur = () => {
      setTimeout(() => {
        noteFormShowSetDropdown.value = false
      }, 200)
    }

    const handleNoteFormSelectSet = (set) => {
      console.log('[노트 폼 검색] handleNoteFormSelectSet 호출:', { set })
      noteForm.value.set_id = set.id
      noteFormSelectedSet.value = set
      noteFormSetSearchQuery.value = ''
      noteFormSearchResults.value = []
      noteFormShowSetDropdown.value = false
      console.log('[노트 폼 검색] 세트 선택 완료:', { 
        set_id: noteForm.value.set_id,
        selectedSet: noteFormSelectedSet.value 
      })
    }

    const handleNoteFormResetSet = () => {
      console.log('[노트 폼 검색] handleNoteFormResetSet 호출')
      noteForm.value.set_id = ''
      noteFormSelectedSet.value = null
      noteFormSetSearchQuery.value = ''
      noteFormSearchResults.value = []
      noteFormShowSetDropdown.value = false
      console.log('[노트 폼 검색] 초기화 완료')
    }

    const formatSetNumber = (setNum) => {
      if (!setNum) return ''
      return String(setNum).replace(/-\d+$/, '').trim()
    }

    const loadAllNotes = async () => {
      if (!user.value) return

      try {
        loading.value = true
        const { data, error: err } = await supabase
          .from('set_inspection_notes')
          .select(`
            *,
            lego_sets:set_id (
              name,
              set_num,
              set_img_url,
              webp_image_url
            )
          `)
          .order('created_at', { ascending: false })
          .limit(500)

        if (err) throw err

        const userIds = [...new Set((data || []).map(note => note.created_by).filter(Boolean))]
        const userEmailsMap = await loadUserEmails(userIds)

        const setIds = (data || []).map(note => note.set_id).filter(Boolean)
        await ensureSetMetadata(setIds)

        notes.value = (data || []).map(note => {
          const meta = setMetadataMap.value.get(note.set_id) || {}
          return {
            ...note,
            created_by_email: userEmailsMap.get(note.created_by) || null,
            set_name: meta.set_name || note.lego_sets?.name || null,
            set_num: meta.set_num || note.lego_sets?.set_num || null,
            theme_name: meta.theme_name || null,
            set_img_url: note.lego_sets?.set_img_url || null,
            webp_image_url: note.lego_sets?.webp_image_url || null
          }
        })
      } catch (err) {
        console.error('전체 노트 로드 실패:', err)
        error.value = '노트를 불러오는데 실패했습니다'
      } finally {
        loading.value = false
      }
    }

    const formatUserId = (userId) => {
      if (!userId) return '작성자'
      return '작성자'
    }

    const getSetName = (setId) => {
      if (!setId) return '세트명 없음'
      const meta = setMetadataMap.value.get(setId)
      if (!meta) return '세트명 없음'
      return formatSetDisplay(meta.set_num, meta.theme_name, meta.set_name || '세트명 없음')
    }

    const noteTypeLabel = (type) => {
      return noteTypes.find(nt => nt.value === type)?.label || '일반'
    }

    const handleSelectNoteType = (type) => {
      noteForm.value.note_type = type
      showNoteTypeDropdown.value = false
    }

    const submitNote = async () => {
      // 세트 선택 검증
      if (!noteForm.value.set_id) {
        showNoteFormSearchTooltip('세트를 선택해주세요.')
        return
      }
      
      // 노트 내용 검증
      if (!noteForm.value.note_text.trim()) {
        error.value = '노트 내용을 입력해주세요.'
        return
      }

      // 로그인 체크
      if (!user.value) {
        // 입력값 임시 저장
        pendingNoteForm.value = {
          set_id: noteForm.value.set_id,
          note_type: noteForm.value.note_type,
          part_id: noteForm.value.part_id,
          note_text: noteForm.value.note_text,
          isEditing: !!editingNote.value,
          editingNoteId: editingNote.value?.id || null
        }
        showLoginModal.value = true
        return
      }

      await saveNote()
    }

    const saveNote = async () => {
      try {
        const formData = pendingNoteForm.value || noteForm.value

        if (pendingNoteForm.value?.isEditing || editingNote.value) {
          const noteId = pendingNoteForm.value?.editingNoteId || editingNote.value.id
          const { error: err } = await supabase
            .from('set_inspection_notes')
            .update({
              note_type: formData.note_type,
              part_id: formData.part_id || null,
              note_text: formData.note_text.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', noteId)

          if (err) throw err
        } else {
          await addSetNote({
            setId: formData.set_id,
            noteType: formData.note_type,
            noteText: formData.note_text.trim(),
            partId: formData.part_id || null
          })
        }

        noteForm.value = {
          set_id: selectedSetId.value || '',
          note_type: 'general',
          part_id: '',
          note_text: ''
        }
        editingNote.value = null
        pendingNoteForm.value = null

        await loadNotes()
      } catch (err) {
        console.error('노트 저장 실패:', err)
        error.value = '노트를 저장하는데 실패했습니다'
      }
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
          
          // 저장된 입력값으로 노트 저장
          if (pendingNoteForm.value) {
            await saveNote()
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

    const editNote = async (note) => {
      editingNote.value = note
      noteForm.value = {
        set_id: note.set_id,
        note_type: note.note_type,
        part_id: note.part_id || '',
        note_text: note.note_text
      }
      
      // 노트 폼 검색 상태 초기화 및 선택된 세트 정보 로드
      const setMeta = setMetadataMap.value.get(note.set_id)
      if (setMeta) {
        // 세트 정보가 있으면 추가 정보 조회
        const { data: setData } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id, num_parts, set_img_url, webp_image_url')
          .eq('id', note.set_id)
          .single()
        
        if (setData) {
          noteFormSelectedSet.value = {
            ...setData,
            theme_name: setMeta.theme_name
          }
        } else {
          noteFormSelectedSet.value = {
            id: note.set_id,
            name: setMeta.set_name,
            set_num: setMeta.set_num,
            theme_name: setMeta.theme_name,
            num_parts: 0
          }
        }
      } else {
        // 세트 정보가 없으면 조회
        const { data: setData } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id, num_parts, set_img_url, webp_image_url')
          .eq('id', note.set_id)
          .single()
        
        if (setData) {
          const themeIds = setData.theme_id ? [setData.theme_id] : []
          let themeName = null
          if (themeIds.length > 0) {
            const { data: themesData } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .in('theme_id', themeIds)
            
            if (themesData && themesData.length > 0) {
              themeName = themesData[0].name
            }
          }
          noteFormSelectedSet.value = {
            ...setData,
            theme_name: themeName
          }
        }
      }
      
      noteFormSetSearchQuery.value = ''
      noteFormSearchResults.value = []
      noteFormShowSetDropdown.value = false
    }

    const cancelEdit = () => {
      editingNote.value = null
      noteForm.value = {
        set_id: selectedSetId.value || '',
        note_type: 'general',
        part_id: '',
        note_text: ''
      }
      noteFormSelectedSet.value = null
      noteFormSetSearchQuery.value = ''
      noteFormSearchResults.value = []
      noteFormShowSetDropdown.value = false
    }

    const deleteNote = async (noteId) => {
      if (!confirm('노트를 삭제하시겠습니까?')) return

      try {
        await deleteSetNote({ noteId })
        await loadNotes()
      } catch (err) {
        console.error('노트 삭제 실패:', err)
        error.value = '노트를 삭제하는데 실패했습니다'
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

    onMounted(async () => {
      await loadAvailableSets()
      await loadAllNotes()
    })

    return {
      loading,
      error,
      availableSets,
      selectedSetId,
      noteTypeFilter,
      editingNote,
      noteTypes,
      noteForm,
      filteredNotes,
      getSetName,
      noteTypeLabel,
      loadNotes,
      submitNote,
      editNote,
      cancelEdit,
      deleteNote,
      formatDate,
      showNoteTypeDropdown,
      noteTypeDropdownRef,
      handleSelectNoteType,
      formatUserId,
      formatSetDisplay,
      showLoginModal,
      loginEmail,
      loginPassword,
      loginLoading,
      loginError,
      handleLoginInModal,
      setSearchQuery,
      searchResults,
      searchResultsKey,
      showSetDropdown,
      setDropdownRef,
      searchInputRef,
      searchTooltip,
      handleSearchEnter,
      handleSearchBlur,
      handleSelectSet,
      handleResetSet,
      noteFormSetSearchQuery,
      noteFormSearchResults,
      noteFormSearchResultsKey,
      noteFormShowSetDropdown,
      noteFormSetDropdownRef,
      noteFormSearchInputRef,
      noteFormSearchTooltip,
      noteFormSelectedSet,
      handleNoteFormSearchEnter,
      handleNoteFormSearchBlur,
      handleNoteFormSelectSet,
      handleNoteFormResetSet,
      formatSetNumber,
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
.inspection-notes-page {
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

.notes-content {
  max-width: 1400px;
  margin: 0 auto;
}

.notes-controls {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-end;
  overflow: visible;
}

.set-selector,
.note-type-filter {
  display: flex;
  flex-direction: column;
  gap: calc(0.75rem - 5px);
  flex: 1;
  min-width: 200px;
  overflow: visible;
}

.set-selector label,
.note-type-filter label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0;
  margin-top: 0px;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0;
  margin-top: 0px;
}

.set-search-field {
  position: relative;
  overflow: visible;
  margin-bottom: -1px;
}

.set-search-wrapper {
  position: relative;
  overflow: visible;
}

.set-search-input-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
  position: relative;
  overflow: visible;
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
  padding: calc(0.75rem - 1px) 1rem calc(0.75rem - 1px) 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

.set-search-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
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

.filter-reset-btn {
  padding: 0.75rem 1rem;
  background: #ffffff;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.filter-reset-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.filter-reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

.select-fade-enter-active,
.select-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.select-fade-enter-from,
.select-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.set-select {
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #1f2937;
  font-size: 0.875rem;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: #f3f4f6;
}

.filter-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.notes-main {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 1.5rem;
}

.notes-list-section,
.note-form-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  overflow: visible;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.section-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.notes-count {
  font-size: 0.875rem;
  color: #6b7280;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #6b7280;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.note-item {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0;
  background: #ffffff;
  transition: all 0.2s ease;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.note-item:hover {
  border-color: #d1d5db;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.note-item-content {
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

.note-item-image-wrapper {
  width: 100px;
  height: 100px;
  min-width: 100px;
  min-height: 100px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.note-item-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.5rem;
}

.note-item-no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  background: transparent;
}

.note-item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.note-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.note-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.note-set-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.note-type {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid transparent;
  width: fit-content;
  align-self: flex-start;
  line-height: 1.2;
}

.note-type.type-general {
  background: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.note-type.type-tip {
  background: #dbeafe;
  color: #1e40af;
  border-color: #93c5fd;
}

.note-type.type-caution {
  background: #fef3c7;
  color: #92400e;
  border-color: #fcd34d;
}

.note-type.type-missing_frequent {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

.note-set {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 600;
  padding: 0.25rem 0;
}

.note-part {
  font-size: 0.8125rem;
  color: #6b7280;
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-weight: 500;
}

.note-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.btn-icon {
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
}

.btn-icon:hover {
  background: #f3f4f6;
  color: #2563eb;
  border-color: #2563eb;
}

.btn-icon.btn-danger {
  border-color: #e5e7eb;
}

.btn-icon.btn-danger:hover {
  background: #fee2e2;
  color: #dc2626;
  border-color: #ef4444;
}

.note-item-body {
  flex: 1;
}

.note-text {
  font-size: 0.9375rem;
  color: #374151;
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.note-item-footer {
  display: flex;
  justify-content: flex-start;
  font-size: 0.8125rem;
  color: #6b7280;
}

.note-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: visible;
  position: relative;
}

.form-row label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-select,
.form-input,
.form-textarea {
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #1f2937;
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.custom-type-select-wrapper {
  position: relative;
  width: 100%;
  overflow: visible;
}

.custom-type-select-button {
  width: 100%;
  padding: calc(0.75rem - 1px) 1rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9375rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  text-align: left;
}

.custom-type-select-button:hover {
  border-color: #9ca3af;
}

.custom-type-select-button.active,
.custom-type-select-button:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.dropdown-arrow {
  flex-shrink: 0;
  color: #6b7280;
  transition: transform 0.2s ease, color 0.2s ease;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.custom-type-select-button.active .dropdown-arrow {
  color: #2563eb;
}

.custom-type-select-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 18px 36px -12px rgba(15, 23, 42, 0.25);
  z-index: 20;
}

.custom-type-select-option {
  width: 100%;
  text-align: left;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.custom-type-select-option:hover {
  background: #eff6ff;
}

.custom-type-select-option.active {
  background: #dbeafe;
  color: #1e40af;
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

@media (max-width: 1024px) {
  .notes-main {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .inspection-notes-page {
    padding: 1rem;
  }

  .notes-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .notes-main {
    grid-template-columns: 1fr !important;
  }
  
  .notes-list-section,
  .note-form-section {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  
  .note-item {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }
  
  .note-item-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .note-meta {
    flex: 1;
    min-width: 0;
  }
  
  .note-actions {
    flex-shrink: 0;
  }

  .page-header {
    margin-bottom: 1rem;
  }

  .page-header h1 {
    font-size: 1.25rem !important;
  }

  .page-header p {
    font-size: 0.875rem !important;
  }

  /* 본문 폰트 사이즈 조정 */
  .note-text {
    font-size: 0.875rem !important;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .section-header h3 {
    font-size: 1rem !important;
  }

  .notes-count {
    font-size: 0.8125rem !important;
  }

  .note-type {
    font-size: 0.75rem !important;
    font-weight: 600 !important;
  }

  .note-set,
  .note-part {
    font-size: 0.8125rem !important;
    word-break: break-word;
    white-space: normal;
  }

  .note-item-footer {
    font-size: 0.8125rem !important;
  }

  .form-select,
  .form-input,
  .form-textarea {
    font-size: 0.875rem !important;
  }

  .btn-primary,
  .btn-secondary {
    font-size: 0.875rem !important;
  }

  .set-select label,
  .note-type-filter label,
  .form-row label {
    font-size: 0.8125rem !important;
  }
  
  .set-select {
    font-size: 0.875rem !important;
  }
  
  .filter-btn {
    font-size: 0.875rem !important;
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

.custom-select-dropdown {
  position: relative;
  width: 100%;
  max-height: 260px;
  overflow-y: auto;
  overflow-x: visible;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 18px 36px -12px rgba(15, 23, 42, 0.25);
  z-index: 20;
  margin-top: 0.5rem;
}

.custom-select-option {
  width: 100%;
  text-align: left;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  overflow: visible;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  overflow: visible;
}

.option-image-wrapper {
  width: 80px;
  height: 80px;
  min-width: 80px;
  min-height: 80px;
  flex-shrink: 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  position: relative;
}

.option-set-image {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  padding: 0.5rem;
  display: block;
  visibility: visible;
  opacity: 1;
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  pointer-events: auto;
}

.option-no-image {
  color: #9ca3af;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.5rem;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  background: #ffffff;
  box-sizing: border-box;
}

.option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.custom-select-option:hover {
  background: #f5f7ff;
}

.custom-select-option.active {
  background: #e0e7ff;
  color: #1d4ed8;
}

.option-set-num {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.option-set-title {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.875rem;
  color: #374151;
}

.option-set-parts {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.selected-set-info {
  margin-top: 0.75rem;
  margin-bottom: 0;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.close-result-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: #ffffff;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 23px;
  height: 23px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease, color 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.close-result-button:hover {
  background: #f3f4f6;
  color: #111827;
}

.selected-set-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.selected-set-thumb-wrapper {
  width: 60px;
  height: 60px;
  min-width: 60px;
  min-height: 60px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.selected-set-thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.25rem;
}

.selected-set-no-image {
  color: #9ca3af;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.5rem;
}

.selected-set-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.selected-set-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.selected-set-meta {
  font-size: 0.8125rem;
  color: #6b7280;
}

@media (max-width: 768px) {
  .note-item-content {
    flex-direction: column;
    gap: 0.75rem;
  }

  .note-item-image-wrapper {
    width: 100%;
    height: 200px;
    min-height: 200px;
  }

  .note-item-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .note-actions {
    align-self: flex-end;
  }

  .note-set-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
  }
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

