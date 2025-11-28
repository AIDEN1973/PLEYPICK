<template>
  <div class="missing-parts-page">
    <div class="page-header">
      <h1>누락부품</h1>
      <p>세트별 누락된 부품을 확인할 수 있는 페이지입니다.</p>
    </div>

    <div class="missing-parts-content">
      <div class="search-section">
        <div class="setup-card">
          <div class="card-body">
            <div class="form-group">
              <label>레고번호를 입력하세요.</label>
              <div class="set-search-wrapper" ref="setDropdownRef">
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
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M14 14L11.1 11.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <button
                    type="button"
                    @click="handleSearchEnter"
                    class="search-button"
                    :disabled="loading"
                  >
                    검색
                  </button>
                </div>
                <!-- 검색 툴팁 -->
                <div v-if="searchTooltip" class="search-tooltip">
                  <span>{{ searchTooltip }}</span>
                </div>

                <transition name="select-fade">
                  <div v-if="showSetDropdown && searchResults.length > 0" :key="`dropdown-${searchResultsKey}`" class="custom-select-dropdown">
                    <button
                      v-for="(set, index) in searchResults"
                      :key="`${set.id}-${set.set_num}-${searchResultsKey}-${index}`"
                      type="button"
                      class="custom-select-option"
                      :class="{ active: selectedSetId === set.id }"
                      @click="handleSelectSet(set)"
                    >
                      <div class="option-set-image-wrapper">
                        <img
                          v-if="set.webp_image_url || set.set_img_url"
                          :src="set.webp_image_url || set.set_img_url"
                          :alt="set.name || set.set_num"
                          class="option-set-image"
                          @error="handleSetImageError"
                        />
                        <div v-else class="option-set-no-image">이미지 없음</div>
                      </div>
                      <div class="option-set-content">
                        <span class="option-set-num">{{ formatSetNumber(set.set_num) }}</span>
                        <span class="option-set-title">{{ [set.theme_name, set.name].filter(Boolean).join(' ') || (set.name || '') }}</span>
                        <span class="option-set-parts">부품수 : {{ resolvePartCount(set) }}개</span>
                      </div>
                    </button>
                  </div>
                </transition>
                <div v-if="selectedSetId && selectedSet" class="selected-set-info">
                  <button class="close-result-button" @click="resetPage" title="초기화">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                  <div class="selected-set-row">
                    <div class="selected-set-thumb-wrapper">
                      <img
                        v-if="selectedSet.webp_image_url || selectedSet.set_img_url"
                        :src="selectedSet.webp_image_url || selectedSet.set_img_url"
                        :alt="selectedSet.name || selectedSet.set_num"
                        class="selected-set-thumb"
                        @error="handleSelectedSetImageError"
                      />
                      <div v-else class="selected-set-no-image">이미지 없음</div>
                    </div>
                    <div class="selected-set-text">
                      <div class="selected-set-number">{{ formatSetNumber(selectedSet.set_num) }}</div>
                      <div class="selected-set-meta">
                        <span v-if="selectedSet.theme_name" class="selected-set-theme">{{ selectedSet.theme_name }}</span>
                        <span v-if="selectedSet.name" class="selected-set-name">{{ selectedSet.name }}</span>
                      </div>
                      <span class="selected-set-parts">부품수 : {{ resolvePartCount(selectedSet) }}개</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 검수 중인 세트 목록 -->
      <div v-if="!loading && !error && inspectionSets && inspectionSets.length > 0 && !setSearchQuery.trim() && !selectedSetId && missingPartsBySet.length === 0" class="inspection-sets-section">
        <div class="result-header"><h3>검수 중인 레고</h3></div>
        <div class="sets-grid">
          <div
            v-for="set in inspectionSets"
            :key="set.id"
            class="set-card"
            @click="handleSelectSet(set)"
          >
            <div class="set-image">
              <img
                v-if="set.image_url"
                :src="set.image_url"
                :alt="set.name"
                @error="handleSetImageError"
              />
              <div v-else class="no-image">이미지 없음</div>
              <button
                class="set-parts-icon-button"
                @click.stop="openMissingPartsModal(set)"
                :title="'누락부품 정보 보기'"
              >
                <svg class="search-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
            </div>
            <div class="set-info">
              <div class="set-name-container">
                <span class="set-number-badge">{{ formatSetNumber(set.set_num) }}</span>
                <div class="set-name-wrapper">
                  <span v-if="set.theme_name" class="set-theme-name">{{ set.theme_name }}</span>
                  <span v-if="set.theme_name && set.name" class="set-name-divider">|</span>
                  <span v-if="set.name" class="set-name-text">{{ set.name }}</span>
                </div>
              </div>
              <div class="set-stats">
                <div class="status-badges">
                  <span v-if="set.status === 'in_progress'" class="status-badge in-progress">진행 중</span>
                  <span v-if="set.status === 'paused'" class="status-badge paused">일시정지</span>
                  <span v-if="set.status === 'completed'" class="status-badge completed">완료</span>
                  <span v-if="set.progress !== undefined && set.progress !== null" class="progress-badge">
                    {{ set.progress }}%
                  </span>
                  <span v-if="set.missingInfo" class="missing-badge">
                    {{ set.missingInfo.partTypes }}개 분류, 총 {{ set.missingInfo.totalCount }}개
                  </span>
                  <span v-if="set.last_saved_at || set.completed_at" class="time-badge">
                    {{ formatTime(set.last_saved_at || set.completed_at) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <span>로딩 중...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>

      <div v-if="!loading && !error && missingPartsBySet && missingPartsBySet.length > 0" class="missing-parts-list">
        <div
          v-for="setGroup in missingPartsBySet"
          :key="setGroup.set_id"
          class="set-group"
        >
          <div class="set-group-header">
            <div class="set-title">
              <div v-if="setGroup.sessionInfo" class="session-stats">
                <span v-if="setGroup.sessionInfo.status" class="stat-badge status" :class="`status-${setGroup.sessionInfo.status}`">
                  {{ statusLabel(setGroup.sessionInfo.status) }}
                </span>
                <span v-if="setGroup.sessionInfo.progress !== undefined" class="stat-badge progress">{{ setGroup.sessionInfo.progress }}%</span>
                <span v-if="setGroup.missing_parts.length > 0" class="stat-badge missing">
                  {{ setGroup.missing_parts.length }}개 분류, 총 {{ setGroup.total_missing_count }}개
                </span>
                <span v-if="setGroup.sessionInfo.completed_at || setGroup.sessionInfo.last_saved_at" class="stat-badge time">
                  {{ formatTime(setGroup.sessionInfo.completed_at || setGroup.sessionInfo.last_saved_at) }}
                </span>
              </div>
            </div>
          </div>

          <div class="parts-grid">
            <div
              v-for="part in setGroup.missing_parts"
              :key="`${part.part_id}-${part.color_id}`"
              class="part-card"
            >
              <div class="card-header">
                <div class="part-info">
                  <div v-if="part.element_id" class="element-id">
                    {{ part.element_id }}
                  </div>
                  <h4 class="part-name">{{ part.part_name }}</h4>
                  <span 
                    class="color-badge"
                    :style="{ 
                      backgroundColor: getColorRgb(part.color_rgb) || '#ccc',
                      color: getColorTextColor(part.color_rgb)
                    }"
                  >
                    {{ formatColorLabel(part.color_name, part.color_id, part.part_id) }}
                  </span>
                </div>
              </div>
              <div class="card-body">
                <div class="part-image-section" style="position: relative;">
                  <img
                    v-if="part.supabase_image_url"
                    :src="part.supabase_image_url"
                    :alt="part.part_name"
                    class="part-image"
                    :data-element-id="part.element_id || ''"
                    :data-part-id="part.part_id || ''"
                    :data-color-id="part.color_id || ''"
                    @error="handleImageError($event)"
                    @load="(e) => { if (e.target) part._currentSrc = e.target.src }"
                  />
                  <div v-else class="no-part-image">
                    <span>이미지 없음</span>
                    <small v-if="part.element_id" style="display:block;font-size:0.7rem;margin-top:4px;">ID: {{ part.element_id }}</small>
                  </div>
                  <span 
                    v-if="part.supabase_image_url && (isCdnUrl(part.supabase_image_url) || (part._currentSrc && isCdnUrl(part._currentSrc)))"
                    class="cdn-badge"
                  >
                    CDN
                  </span>
                </div>
                <div class="quantity-section">
                  <div class="quantity-badge">{{ part.missing_count }}개</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 누락부품 정보 모달 -->
    <div v-if="showMissingPartsModal" class="modal-overlay" @click.self="closeMissingPartsModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ selectedModalSet ? formatSetDisplay(selectedModalSet.set_num, selectedModalSet.theme_name, selectedModalSet.name) : '' }}</h3>
          <button class="modal-close-button" @click="closeMissingPartsModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="missingPartsModalLoading" class="loading-message">로딩 중...</div>
          <div v-else-if="missingPartsModalError" class="error-message">{{ missingPartsModalError }}</div>
          <div v-else-if="missingPartsModalData && missingPartsModalData.length > 0" class="set-parts-list">
            <div class="parts-grid modal-parts-grid" style="padding-bottom: 2rem;">
              <div
                v-for="(part, index) in missingPartsModalData"
                :key="`${part.part_id}-${part.color_id}-${index}`"
                class="part-card"
              >
                <div class="card-header">
                  <div class="part-info">
                    <div v-if="part.element_id" class="element-id">
                      {{ part.element_id }}
                    </div>
                    <h4 class="part-name">{{ part.part_name }}</h4>
                    <span 
                      class="color-badge"
                      :style="{ 
                        backgroundColor: getColorRgb(part.color_rgb) || '#ccc',
                        color: getColorTextColor(part.color_rgb)
                      }"
                    >
                      {{ formatColorLabel(part.color_name, part.color_id, part.part_id) }}
                    </span>
                  </div>
                </div>
                <div class="card-body">
                  <div class="part-image-section" style="position: relative;">
                    <img
                      v-if="part.image_url"
                      :src="part.image_url"
                      :alt="part.part_name"
                      class="part-image"
                      :data-element-id="part.element_id || ''"
                      :data-part-id="part.part_id || ''"
                      :data-color-id="part.color_id || ''"
                      @error="handlePartImageError"
                      @load="(e) => { if (e.target) part._currentSrc = e.target.src }"
                    />
                    <div v-else class="no-part-image">이미지 없음</div>
                    <span 
                      v-if="part.image_url && (isCdnUrl(part.image_url) || (part._currentSrc && isCdnUrl(part._currentSrc)))"
                      class="cdn-badge"
                    >
                      CDN
                    </span>
                  </div>
                  <div class="quantity-section">
                    <div class="quantity-badge">누락 {{ part.missing_count }}개</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-message">누락부품이 없습니다.</div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'
import { usePleyonInventorySync } from '../composables/usePleyonInventorySync'
import { formatSetDisplay, formatSetNumber, fetchSetMetadata } from '../utils/setDisplay'

export default {
  name: 'MissingParts',
  setup() {
    const { supabase, user, signIn, signUp } = useSupabase()
    const { getStoreInfoByEmail, getStoreInventory } = useSupabasePleyon()
    const { checkSetPartsExist, syncSetParts } = usePleyonInventorySync()
    const route = useRoute()

    const loading = ref(false)
    const error = ref(null)
    const missingParts = ref([])
    const selectedSetId = ref('')
    const setSearchQuery = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0)
    const selectedSet = ref(null)
    const showSetDropdown = ref(false)
    const setDropdownRef = ref(null)
    const searchInputRef = ref(null)
    const storeInventory = ref([])
    const storeInfo = ref(null)

    const sessionInfoMap = ref(new Map())
    const inspectionSets = ref([])

    // 누락부품 모달 관련
    const showMissingPartsModal = ref(false)
    const selectedModalSet = ref(null)
    const missingPartsModalData = ref([])
    const missingPartsModalLoading = ref(false)
    const missingPartsModalError = ref(null)

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

    // 정렬 함수: 색상 우선, element_id 2차, 피규어는 스티커 바로 앞
    const isSticker = (item) => {
      const partName = (item.part_name || '').toLowerCase()
      const partId = (item.part_id || '').toLowerCase()
      return partName.includes('sticker') || 
             partName.includes('스티커') ||
             partId.includes('sticker') ||
             partId.includes('stk-')
    }

    const isMinifigure = (item) => {
      const partId = item.part_id || ''
      return String(partId).toLowerCase().startsWith('fig-')
    }

    const sortParts = (partsList) => {
      return [...partsList].sort((a, b) => {
        // 우선순위: 일반 부품(0) > 피규어(1) > 스티커(2)
        const aIsSticker = isSticker(a)
        const bIsSticker = isSticker(b)
        const aIsMinifigure = isMinifigure(a)
        const bIsMinifigure = isMinifigure(b)
        
        const aPriority = aIsSticker ? 2 : (aIsMinifigure ? 1 : 0)
        const bPriority = bIsSticker ? 2 : (bIsMinifigure ? 1 : 0)
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }
        // 1차: 색상명
        const colorCompare = (a.color_name || '').localeCompare(b.color_name || '')
        if (colorCompare !== 0) {
          return colorCompare
        }
        // 2차: element_id (숫자 우선, 없으면 문자열 비교)
        const aElementId = a.element_id
        const bElementId = b.element_id
        if (aElementId !== bElementId) {
          const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
          const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
          if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum
          }
          return String(aElementId || '').localeCompare(String(bElementId || ''))
        }
        // 3차: 부품명 (같은 element_id 내에서)
        return (a.part_name || '').localeCompare(b.part_name || '')
      })
    }

    const missingPartsBySet = computed(() => {
      const grouped = new Map()

      missingParts.value.forEach(part => {
        const key = part.set_id
        if (!grouped.has(key)) {
          grouped.set(key, {
            set_id: part.set_id,
            set_display_name: part.set_display_name,
            missing_parts: [],
            sessionInfo: sessionInfoMap.value.get(part.set_id) || null
          })
        }

        const existingPart = grouped.get(key).missing_parts.find(
          p => p.part_id === part.part_id && p.color_id === part.color_id
        )

        if (existingPart) {
          existingPart.missing_count += part.missing_count
        } else {
          grouped.get(key).missing_parts.push({
            part_id: part.part_id,
            color_id: part.color_id,
            element_id: part.element_id,
            part_name: part.part_name,
            color_name: part.color_name,
            color_rgb: part.color_rgb,
            supabase_image_url: part.supabase_image_url,
            missing_count: part.missing_count
          })
        }
      })

      return Array.from(grouped.values()).map(group => {
        const totalMissingCount = group.missing_parts.reduce((sum, part) => sum + part.missing_count, 0)
        return {
          ...group,
          missing_parts: sortParts(group.missing_parts),
          total_missing_count: totalMissingCount
        }
      }).sort((a, b) => 
        a.set_display_name.localeCompare(b.set_display_name, 'ko')
      )
    })

    const loadStoreInventory = async () => {
      if (!user.value) {
        storeInfo.value = null
        storeInventory.value = []
        return
      }

      try {
        const storeData = await getStoreInfoByEmail(user.value.email)
        if (storeData && storeData.store) {
          storeInfo.value = storeData
          const inventoryData = await getStoreInventory(storeData.store.id)
          storeInventory.value = inventoryData || []
          console.log('[MissingParts] 매장 인벤토리 로드 완료:', storeInventory.value.length, '개')
        } else {
          storeInfo.value = null
          storeInventory.value = []
        }
      } catch (err) {
        console.error('[MissingParts] 매장 인벤토리 로드 실패:', err)
        storeInfo.value = null
        storeInventory.value = []
      }
    }

    const searchSets = async () => {
      console.log('[MissingParts] searchSets 호출:', { query: setSearchQuery.value })
      if (!setSearchQuery.value.trim()) {
        console.log('[MissingParts] 검색 쿼리 없음, 검색 결과 초기화')
        searchResults.value = []
        showSetDropdown.value = false
        return
      }

      try {
        const query = setSearchQuery.value.trim()
        const mainSetNum = query.split('-')[0]
        console.log('[MissingParts] 검색 시작:', { query, mainSetNum })
        let results = []

        // 매장 인벤토리에서만 검색
        if (storeInventory.value.length === 0) {
          console.log('[MissingParts] 매장 인벤토리 로드 필요')
          await loadStoreInventory()
        }

        if (storeInventory.value.length === 0) {
          console.log('[MissingParts] 매장 인벤토리가 없습니다.')
          searchResults.value = []
          showSetDropdown.value = false
          return
        }

        // 매장 인벤토리의 세트 번호 목록 추출
        const inventorySetNumbers = storeInventory.value
          .map(item => {
            const legoSet = item.lego_sets
            if (!legoSet) return null
            if (Array.isArray(legoSet) && legoSet.length > 0) {
              return legoSet[0].number
            }
            if (!Array.isArray(legoSet)) {
              return legoSet.number
            }
            return null
          })
          .filter(Boolean)

        console.log('[MissingParts] 매장 인벤토리 세트 번호:', inventorySetNumbers.length, '개', { sample: inventorySetNumbers.slice(0, 5) })

        // 1단계: 정확한 매칭 시도 (인벤토리 내에서만)
        const exactMatches = inventorySetNumbers.filter(num => num === query || num === mainSetNum)
        console.log('[MissingParts] 정확한 매칭 시도:', { 
          query, 
          mainSetNum, 
          exactMatches: exactMatches.length, 
          matches: exactMatches 
        })
        
        if (exactMatches.length > 0) {
          const matchedSetNums = [...new Set(exactMatches)]
          console.log('[MissingParts] 정확한 매칭 세트 번호:', matchedSetNums)
          
          // 세트 번호 형식 변환 시도 (예: '71834' -> '71834-1', '71834-2' 등)
          const allPossibleSetNums = new Set(matchedSetNums)
          matchedSetNums.forEach(num => {
            // 기본 세트 번호에 -1, -2 등을 추가하여 검색
            allPossibleSetNums.add(`${num}-1`)
            allPossibleSetNums.add(`${num}-2`)
          })
          
          const { data: exactMatch, error: exactError } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .in('set_num', Array.from(allPossibleSetNums))
            .limit(20)

          if (exactError) {
            console.error('[MissingParts] 정확한 매칭 조회 오류:', exactError)
          } else {
            console.log('[MissingParts] 정확한 매칭 결과:', exactMatch?.length || 0, { exactMatch })
          }

          if (!exactError && exactMatch && exactMatch.length > 0) {
            // 원본 쿼리와 일치하는 것 우선 선택
            const exactQueryMatch = exactMatch.find(set => set.set_num === query || set.set_num === mainSetNum)
            if (exactQueryMatch) {
              results = [exactQueryMatch]
            } else {
              // 세트 번호가 쿼리로 시작하는 것 선택
              const startsWithMatch = exactMatch.find(set => 
                set.set_num.startsWith(mainSetNum) || set.set_num.startsWith(query)
              )
              if (startsWithMatch) {
                results = [startsWithMatch]
              } else {
                results = [exactMatch[0]]
              }
            }
            console.log('[MissingParts] 정확한 매칭으로 결과 설정:', results.length, { results })
          }
        }

        // 2단계: LIKE 패턴으로 검색 (인벤토리 내에서만)
        if (results.length === 0) {
          console.log('[MissingParts] LIKE 패턴 검색 시도')
          const likeMatches = inventorySetNumbers.filter(num => 
            num.startsWith(mainSetNum) || num.includes(mainSetNum)
          )
          console.log('[MissingParts] LIKE 매칭:', { likeMatches: likeMatches.length, matches: likeMatches })

          if (likeMatches.length > 0) {
            const matchedSetNums = [...new Set(likeMatches)]
            console.log('[MissingParts] LIKE 매칭 세트 번호:', matchedSetNums)
            
            // 세트 번호 변형 생성 (예: '71834' -> ['71834', '71834-1', '71834-2'])
            const setNumVariations = new Set()
            matchedSetNums.forEach(num => {
              setNumVariations.add(num)
              setNumVariations.add(`${num}-1`)
              setNumVariations.add(`${num}-2`)
            })
            
            console.log('[MissingParts] 세트 번호 변형:', Array.from(setNumVariations))
            
            // 1단계: 정확한 매칭 시도 (변형 포함)
            const { data: exactVariations, error: exactVarError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
              .in('set_num', Array.from(setNumVariations))
              .order('set_num')
              .limit(20)

            if (exactVarError) {
              console.error('[MissingParts] 세트 번호 변형 조회 오류:', exactVarError)
            } else {
              console.log('[MissingParts] 세트 번호 변형 조회 결과:', exactVariations?.length || 0, { exactVariations })
            }

            if (!exactVarError && exactVariations && exactVariations.length > 0) {
              // 원본 쿼리와 정확히 일치하는 것 우선
              const exactQueryMatch = exactVariations.find(set => 
                set.set_num === query || set.set_num === mainSetNum
              )
              if (exactQueryMatch) {
                results = [exactQueryMatch]
                console.log('[MissingParts] 정확한 쿼리 매칭:', results[0]?.set_num)
              } else {
                // 세트 번호로 시작하는 것 선택 (하이픈 없는 것 우선)
                const startsWithMatch = exactVariations.find(set => 
                  set.set_num.startsWith(mainSetNum) && !set.set_num.includes('-')
                )
                if (startsWithMatch) {
                  results = [startsWithMatch]
                  console.log('[MissingParts] 하이픈 없는 시작 매칭:', results[0]?.set_num)
                } else {
                  // 하이픈 있는 것 중 가장 짧은 것 선택
                  const sorted = exactVariations.sort((a, b) => a.set_num.length - b.set_num.length)
                  results = [sorted[0]]
                  console.log('[MissingParts] 가장 짧은 세트 번호 선택:', results[0]?.set_num)
                }
              }
            } else {
              // 2단계: ilike로 시작하는 패턴 검색
              const { data: likeMatch, error: likeError } = await supabase
                .from('lego_sets')
                .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
                .ilike('set_num', `${mainSetNum}%`)
                .order('set_num')
                .limit(20)

              if (likeError) {
                console.error('[MissingParts] ilike 조회 오류:', likeError)
              } else {
                console.log('[MissingParts] ilike 조회 결과:', likeMatch?.length || 0, { likeMatch })
              }

              if (!likeError && likeMatch && likeMatch.length > 0) {
                // 정확히 일치하는 것 우선
                const exactMatch = likeMatch.find(set => set.set_num === mainSetNum || set.set_num === query)
                if (exactMatch) {
                  results = [exactMatch]
                  console.log('[MissingParts] ilike 정확한 매칭:', results[0]?.set_num)
                } else {
                  // 하이픈 없는 것 우선
                  const withoutHyphen = likeMatch.filter(set => !set.set_num.includes('-'))
                  if (withoutHyphen.length > 0) {
                    results = [withoutHyphen.sort((a, b) => a.set_num.length - b.set_num.length)[0]]
                    console.log('[MissingParts] ilike 하이픈 없는 세트 선택:', results[0]?.set_num)
                  } else {
                    results = [likeMatch[0]]
                    console.log('[MissingParts] ilike 첫 번째 결과 선택:', results[0]?.set_num)
                  }
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
                theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
                part_count: set.num_parts || 0,
                num_parts: set.num_parts || 0
              }))
            } else {
              results = results.map(set => ({
                ...set,
                theme_name: null,
                part_count: set.num_parts || 0,
                num_parts: set.num_parts || 0
              }))
            }
          } else {
            results = results.map(set => ({
              ...set,
              theme_name: null,
              part_count: set.num_parts || 0,
              num_parts: set.num_parts || 0
            }))
          }
        }
        
        console.log('[MissingParts] 최종 검색 결과:', results.length, { results })
        searchResults.value = results
        searchResultsKey.value++
        console.log('[MissingParts] searchResults 설정 완료:', searchResults.value.length, 'showSetDropdown:', showSetDropdown.value)
        
        if (searchResults.value.length > 0) {
          showSetDropdown.value = true
          console.log('[MissingParts] 드롭다운 표시')
        } else {
          showSetDropdown.value = false
          console.log('[MissingParts] 드롭다운 숨김 (결과 없음)')
        }
      } catch (err) {
        console.error('[MissingParts] 세트 검색 실패:', err)
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
      console.log('[MissingParts] handleSearchEnter 호출:', { query: setSearchQuery.value })
      if (!setSearchQuery.value.trim()) {
        console.log('[MissingParts] 검색 쿼리 없음')
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
      console.log('[MissingParts] searchSets 완료, 검색 결과 수:', searchResults.value.length)
      
      if (searchResults.value.length === 1) {
        console.log('[MissingParts] 검색 결과 1개, 자동 선택:', searchResults.value[0])
        handleSelectSet(searchResults.value[0])
      } else if (searchResults.value.length > 0) {
        console.log('[MissingParts] 검색 결과 여러 개, 드롭다운 표시')
        showSetDropdown.value = true
      } else {
        console.log('[MissingParts] 검색 결과 없음')
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

    const handleSearchBlur = () => {
      // blur 이벤트가 드롭다운 클릭보다 먼저 발생할 수 있으므로 약간의 지연
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    const handleSelectSet = async (set) => {
      console.log('[MissingParts] handleSelectSet 호출:', { 
        setNum: set?.set_num, 
        setId: set?.id,
        setName: set?.name,
        hasImage: !!(set?.image_url || set?.webp_image_url || set?.set_img_url),
        numParts: set?.num_parts || set?.part_count,
        source: '레고카드 클릭'
      })
      
      // 검색 입력란에 세트 번호 설정 (접미어 제거)
      const formattedSetNum = formatSetNumber(set.set_num) || ''
      setSearchQuery.value = formattedSetNum
      
      // DB에서 세트 정보를 다시 조회하여 num_parts 확보 (검색창 직접 검색과 동일한 로직)
      let setWithParts = { ...set }
      try {
        const { data: setData, error: setError } = await supabase
          .from('lego_sets')
          .select('id, set_num, name, theme_id, num_parts, webp_image_url, set_img_url')
          .eq('id', set.id)
          .single()
        
        if (!setError && setData) {
          // 테마 정보 조회
          if (setData.theme_id) {
            const { data: themeData, error: themeError } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .eq('theme_id', setData.theme_id)
              .single()
            
            if (!themeError && themeData) {
              setWithParts.theme_name = themeData.name
            }
          }
          
          setWithParts = {
            ...setWithParts,
            ...setData,
            theme_name: setWithParts.theme_name || null,
            num_parts: setData.num_parts || 0,
            part_count: setData.num_parts || 0
          }
          console.log('[MissingParts] DB에서 세트 정보 조회 완료:', {
            num_parts: setWithParts.num_parts,
            part_count: setWithParts.part_count
          })
        }
      } catch (err) {
        console.error('[MissingParts] 세트 정보 조회 실패:', err)
        // 조회 실패 시 기존 데이터 사용
      }
      
      // selectedSet을 검색 결과 형식으로 변환하여 설정
      const searchResultSet = {
        ...setWithParts,
        set_num: setWithParts.set_num,
        name: setWithParts.name,
        theme_name: setWithParts.theme_name,
        num_parts: setWithParts.num_parts || 0,
        webp_image_url: setWithParts.webp_image_url || setWithParts.image_url,
        set_img_url: setWithParts.set_img_url || setWithParts.image_url,
        part_count: setWithParts.num_parts || 0
      }
      
      selectedSet.value = searchResultSet
      selectedSetId.value = set.id
      searchResults.value = [searchResultSet]
      showSetDropdown.value = false
      
      console.log('[MissingParts] 상태 설정 완료:', { 
        selectedSetId: selectedSetId.value, 
        setSearchQuery: setSearchQuery.value,
        formattedSetNum,
        selectedSet: {
          ...selectedSet.value,
          num_parts: selectedSet.value.num_parts,
          part_count: selectedSet.value.part_count
        },
        searchResults: searchResults.value.length
      })
      
      // 부품 정보가 있는지 확인
      try {
        console.log('[MissingParts] 부품 정보 확인 시작:', set.set_num)
        const partsStatus = await checkSetPartsExist(set.set_num)
        console.log('[MissingParts] 부품 정보 확인 결과:', partsStatus)
        
        if (!partsStatus.partsExist) {
          // 부품 정보가 없으면 자동으로 동기화
          console.log(`[MissingParts] 세트 ${set.set_num}의 부품 정보가 없습니다. 자동 동기화 시작...`)
          error.value = `세트 ${set.set_num}의 부품 정보를 동기화하는 중입니다...`
          
          try {
            await syncSetParts(set.set_num, true)
            console.log(`[MissingParts] 세트 ${set.set_num} 부품 정보 동기화 완료`)
            error.value = null
          } catch (syncError) {
            console.error(`[MissingParts] 부품 정보 동기화 실패:`, syncError)
            error.value = `부품 정보 동기화 실패: ${syncError.message}. 수동으로 신규 레고 등록 페이지에서 등록해주세요.`
            return
          }
        }
      } catch (checkError) {
        console.error(`[MissingParts] 부품 정보 확인 실패:`, checkError)
        // 확인 실패해도 계속 진행
      }
      
      console.log('[MissingParts] loadMissingParts 호출 전, 상태:', {
        selectedSetId: selectedSetId.value,
        setSearchQuery: setSearchQuery.value,
        hasUser: !!user.value
      })
      await loadMissingParts()
      console.log('[MissingParts] loadMissingParts 완료:', {
        missingParts: missingParts.value.length,
        missingPartsBySet: missingPartsBySet.value.length,
        loading: loading.value,
        error: error.value
      })
    }

    // 각 set_id별로 가장 최신 세션만 선택하는 함수
    const getSessionTimestamp = (session) => {
      if (session.completed_at) return new Date(session.completed_at).getTime()
      if (session.last_saved_at) return new Date(session.last_saved_at).getTime()
      if (session.started_at) return new Date(session.started_at).getTime()
      return 0
    }

    const getLatestSessionsBySet = (sessionList) => {
      const latestSessionsBySet = new Map()
      sessionList.forEach(session => {
        const setId = session.set_id
        if (!setId) return

        const existing = latestSessionsBySet.get(setId)
        if (!existing) {
          latestSessionsBySet.set(setId, session)
        } else {
          const sessionTime = getSessionTimestamp(session)
          const existingTime = getSessionTimestamp(existing)
          if (sessionTime > existingTime) {
            latestSessionsBySet.set(setId, session)
          }
        }
      })
      return Array.from(latestSessionsBySet.values())
    }

    // 검수 중인 세트 목록 로드 (항상 실행)
    const loadInspectionSets = async () => {
      console.log('[MissingParts] loadInspectionSets 시작')
      if (!user.value) {
        console.log('[MissingParts] 사용자 없음, inspectionSets 초기화')
        inspectionSets.value = []
        return
      }

      try {
        // 관리자 여부 확인과 세션 조회를 병렬로 처리 (세션 조회는 두 가지 쿼리 준비)
        const adminQuery = supabase
          .from('admin_users')
          .select('id, role, is_active')
          .eq('email', user.value.email)
          .eq('is_active', true)
          .maybeSingle()
        
        const allSessionsQuery = supabase
          .from('inspection_sessions')
          .select('id, set_id, status, completed_at, last_saved_at, started_at, progress')
          .in('status', ['in_progress', 'paused', 'completed'])
        
        const userSessionsQuery = supabase
          .from('inspection_sessions')
          .select('id, set_id, status, completed_at, last_saved_at, started_at, progress')
          .in('status', ['in_progress', 'paused', 'completed'])
          .eq('user_id', user.value.id)

        // 관리자 확인과 세션 조회를 병렬로 실행
        const [adminResult, allSessionsResult, userSessionsResult] = await Promise.all([
          adminQuery,
          allSessionsQuery,
          userSessionsQuery
        ])

        const { data: adminData } = adminResult
        const isAdmin = adminData && (adminData.role === 'admin' || adminData.role === 'super_admin')
        
        // 관리자 여부에 따라 적절한 세션 결과 선택
        const { data: allSessions, error: allSessionsError } = isAdmin ? allSessionsResult : userSessionsResult
        
        if (allSessionsError) {
          console.error('[MissingParts] 세션 조회 오류:', allSessionsError)
          throw allSessionsError
        }

        if (!allSessions || allSessions.length === 0) {
          inspectionSets.value = []
          return
        }

        // 각 set_id별로 가장 최신 세션만 선택
        const latestSessionsBySet = new Map()
        allSessions.forEach(session => {
          const setId = session.set_id
          if (!setId) return

          const existing = latestSessionsBySet.get(setId)
          if (!existing) {
            latestSessionsBySet.set(setId, session)
          } else {
            const sessionTime = getSessionTimestamp(session)
            const existingTime = getSessionTimestamp(existing)
            if (sessionTime > existingTime) {
              latestSessionsBySet.set(setId, session)
            }
          }
        })

        const latestSessions = Array.from(latestSessionsBySet.values())
        const setIds = [...new Set(latestSessions.map(s => s.set_id).filter(Boolean))]

        if (setIds.length === 0) {
          inspectionSets.value = []
          return
        }

        // 세트 정보와 inspection_items를 병렬로 조회
        const sessionIds = latestSessions.map(s => s.id)
        
        const [setsResult, itemsResult] = await Promise.all([
          supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .in('id', setIds),
          supabase
            .from('inspection_items')
            .select('session_id, part_id, color_id, total_count, checked_count, status')
            .in('session_id', sessionIds)
            .eq('status', 'missing')
        ])

        const { data: setsData, error: setsError } = setsResult
        if (setsError) {
          console.error('[MissingParts] 세트 정보 조회 오류:', setsError)
          throw setsError
        }

        const { data: allItems } = itemsResult

        // 테마 정보 조회 (세트 정보에서 theme_id 추출 후 병렬 처리)
        const themeIds = [...new Set((setsData || []).map(s => s.theme_id).filter(Boolean))]
        const themeMap = new Map()
        if (themeIds.length > 0) {
          const { data: themesData, error: themesError } = await supabase
            .from('lego_themes')
            .select('theme_id, name')
            .in('theme_id', themeIds)

          if (!themesError && themesData) {
            themesData.forEach(t => themeMap.set(t.theme_id, t.name))
          }
        }

        // 세션 정보를 세트별로 매핑 (한 번만 순회)
        const sessionSetMap = new Map()
        const sessionInfoBySetId = new Map()
        latestSessions.forEach(session => {
          if (session.set_id) {
            sessionSetMap.set(session.id, session.set_id)
            sessionInfoBySetId.set(session.set_id, {
              status: session.status,
              progress: session.progress || 0,
              last_saved_at: session.last_saved_at,
              completed_at: session.completed_at,
              started_at: session.started_at
            })
          }
        })

        // 누락 부품 계산 (한 번의 순회로 처리, 이미 status='missing'으로 필터링됨)
        const setMissingInfoMap = new Map()
        if (allItems && allItems.length > 0) {
          for (const item of allItems) {
            const setId = sessionSetMap.get(item.session_id)
            if (!setId) continue

            const missingCount = Math.max(0, (item.total_count || 0) - (item.checked_count || 0))
            if (missingCount <= 0) continue

            let info = setMissingInfoMap.get(setId)
            if (!info) {
              info = {
                partTypes: new Set(),
                totalCount: 0
              }
              setMissingInfoMap.set(setId, info)
            }

            info.partTypes.add(`${item.part_id}_${item.color_id}`)
            info.totalCount += missingCount
          }
        }

        // 검수 중인 세트 목록 구성 (최적화된 처리)
        const inspectionSetsData = (setsData || []).map(set => {
          const missingInfo = setMissingInfoMap.get(set.id)
          const sessionInfo = sessionInfoBySetId.get(set.id)
          
          return {
            id: set.id,
            set_num: set.set_num,
            name: set.name,
            theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
            image_url: set.webp_image_url || set.set_img_url || null,
            missingInfo: missingInfo ? {
              partTypes: missingInfo.partTypes.size,
              totalCount: missingInfo.totalCount
            } : null,
            status: sessionInfo?.status || null,
            progress: sessionInfo?.progress || null,
            last_saved_at: sessionInfo?.last_saved_at || null,
            completed_at: sessionInfo?.completed_at || null
          }
        }).sort((a, b) => {
          return a.set_num.localeCompare(b.set_num)
        })

        console.log('[MissingParts] 검수 중인 세트 목록 구성 완료:', inspectionSetsData.length, { inspectionSetsData })
        inspectionSets.value = inspectionSetsData
        console.log('[MissingParts] inspectionSets.value 설정 완료:', inspectionSets.value.length)
      } catch (err) {
        console.error('[MissingParts] 검수 중인 세트 목록 로드 실패:', err)
        inspectionSets.value = []
      }
    }

    const loadMissingParts = async () => {
      console.log('[MissingParts] loadMissingParts 시작:', { hasUser: !!user.value, selectedSetId: selectedSetId.value })
      if (!user.value) {
        console.log('[MissingParts] 사용자 없음, 종료')
        return
      }

      try {
        loading.value = true
        error.value = null

        // 검수 중인 세트 목록 먼저 로드 (selectedSetId가 없을 때만)
        if (!selectedSetId.value) {
          console.log('[MissingParts] selectedSetId 없음, loadInspectionSets 호출')
          await loadInspectionSets()
        } else {
          console.log('[MissingParts] selectedSetId 있음, loadInspectionSets 건너뜀:', selectedSetId.value)
        }

        // 일반 사용자는 자신의 세션만 조회
        // 관리자는 모든 세션 조회 가능하도록 구현
        // URL 쿼리 파라미터에서 세션 ID 확인
        const sessionIdFromQuery = route.query.session

        // 관리자 여부 확인과 세션 조회를 병렬로 처리
        const [adminResult, sessionResult] = await Promise.all([
          supabase
            .from('admin_users')
            .select('id, role, is_active')
            .eq('email', user.value.email)
            .eq('is_active', true)
            .maybeSingle(),
          sessionIdFromQuery && typeof sessionIdFromQuery === 'string'
            ? supabase
                .from('inspection_sessions')
                .select('id, set_id, status, completed_at, last_saved_at, started_at, progress, user_id')
                .eq('id', sessionIdFromQuery)
                .maybeSingle()
            : (() => {
                let sessionsQuery = supabase
                  .from('inspection_sessions')
                  .select('id, set_id, status, completed_at, last_saved_at, started_at, progress, user_id')
                  .in('status', ['in_progress', 'paused', 'completed'])

                if (selectedSetId.value) {
                  sessionsQuery = sessionsQuery.eq('set_id', selectedSetId.value)
                }

                return sessionsQuery
              })()
        ])

        const { data: adminData } = adminResult
        const isAdmin = adminData && (adminData.role === 'admin' || adminData.role === 'super_admin')

        let sessions = []

        if (sessionIdFromQuery && typeof sessionIdFromQuery === 'string') {
          const { data: sessionData, error: sessionError } = sessionResult
          if (sessionError) throw sessionError

          if (!sessionData) {
            missingParts.value = []
            loading.value = false
            return
          } else if (!isAdmin && sessionData.user_id !== user.value.id) {
            missingParts.value = []
            loading.value = false
            return
          } else {
            sessions = [sessionData]
          }
        } else {
          const { data: filteredSessions, error: sessionsError } = sessionResult
          if (sessionsError) throw sessionsError

          if (!filteredSessions || filteredSessions.length === 0) {
            sessions = []
          } else {
            // 관리자가 아니면 사용자 필터링
            const userFilteredSessions = !isAdmin 
              ? filteredSessions.filter(s => s.user_id === user.value.id)
              : filteredSessions
            
            sessions = getLatestSessionsBySet(userFilteredSessions)
          }
        }

        const sessionIds = sessions.map(s => s.id)
        const setIds = [...new Set(sessions.map(s => s.set_id).filter(Boolean))]

        console.log('[MissingParts] 세션 정보:', { 
          sessionsCount: sessions.length, 
          sessionIds: sessionIds.length, 
          setIds: setIds.length,
          sessionIds: sessionIds,
          setIds: setIds
        })

        // 누락 부품 조회용: 세션이 없거나 setIds가 비어있으면 누락 부품만 비움
        // 검수 중인 세트 목록은 위에서 이미 설정했으므로 여기서는 누락 부품만 처리
        if (sessions.length === 0 || setIds.length === 0) {
          console.log('[MissingParts] 세션이 없거나 setIds가 비어있음, missingParts 빈 배열로 설정')
          missingParts.value = []
          // inspectionSets는 위에서 이미 설정했으므로 여기서는 건드리지 않음
          loading.value = false
          return
        }

        // 세션 정보를 세트별로 매핑
        sessionInfoMap.value.clear()
        sessions.forEach(session => {
          if (session.set_id) {
            sessionInfoMap.value.set(session.set_id, {
              status: session.status,
              completed_at: session.completed_at,
              last_saved_at: session.last_saved_at,
              progress: session.progress || 0
            })
          }
        })

        // 모든 아이템 조회 (누락 판단을 위해)
        console.log('[MissingParts] inspection_items 조회 시작, sessionIds:', sessionIds)
        const { data: items, error: itemsError } = await supabase
          .from('inspection_items')
          .select('session_id, part_id, color_id, element_id, total_count, checked_count, status')
          .in('session_id', sessionIds)

        if (itemsError) {
          console.error('[MissingParts] inspection_items 조회 오류:', itemsError)
          throw itemsError
        }

        console.log('[MissingParts] 조회된 아이템 수:', items?.length || 0, { items })

        // 누락 부품 필터링: ManualInspection.vue와 동일하게 status가 'missing'인 아이템만
        const missingItems = items && items.length > 0 
          ? items.filter(item => item.status === 'missing')
          : []
        
        console.log('[MissingParts] 누락 부품 필터링 후:', missingItems.length, { missingItems })

        // 세션별 세트 매핑
        const sessionSetMap = new Map(sessions.map(s => [s.id, s.set_id]))

        // 누락 부품이 없으면 조기 종료 (검색 시 성능 개선)
        if (!items || items.length === 0 || missingItems.length === 0) {
          console.log('[MissingParts] 누락 부품 없음, 조기 종료')
          missingParts.value = []
          loading.value = false
          return
        }

        // 병렬 처리: 세트 정보, 세트 메타데이터 동시 조회
        const [setsResult, metadataMap] = await Promise.all([
          // 세트 정보 조회
          supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .in('id', setIds),
          // 세트 메타데이터 가져오기
          fetchSetMetadata(supabase, setIds)
        ])

        const { data: setsData, error: setsError } = setsResult
        if (setsError) throw setsError

        // 테마 정보 조회 (세트 정보 조회 후 즉시 병렬 처리)
        const themeIds = [...new Set((setsData || []).map(s => s.theme_id).filter(Boolean))]
        const themeMap = new Map()
        if (themeIds.length > 0) {
          const { data: themesData, error: themesError } = await supabase
            .from('lego_themes')
            .select('theme_id, name')
            .in('theme_id', themeIds)

          if (!themesError && themesData) {
            themesData.forEach(t => themeMap.set(t.theme_id, t.name))
          }
        }

        // 세트별 누락 정보 계산 (missingItems가 있을 때만)
        const setMissingInfoMap = new Map()
        if (missingItems && missingItems.length > 0) {
          missingItems.forEach(item => {
            const setId = sessionSetMap.get(item.session_id)
            if (!setId) return

            const missingCount = Math.max(0, (item.total_count || 0) - (item.checked_count || 0))
            if (missingCount <= 0) return

            if (!setMissingInfoMap.has(setId)) {
              setMissingInfoMap.set(setId, {
                partTypes: new Set(),
                totalCount: 0
              })
            }

            const info = setMissingInfoMap.get(setId)
            info.partTypes.add(`${item.part_id}_${item.color_id}`)
            info.totalCount += missingCount
          })
        }

        // 검수 중인 세트 목록 구성
        inspectionSets.value = (setsData || []).map(set => {
          const missingInfo = setMissingInfoMap.get(set.id)
          let imageUrl = null

          if (set.webp_image_url) {
            imageUrl = set.webp_image_url
          } else if (set.set_img_url) {
            imageUrl = set.set_img_url
          }

          return {
            id: set.id,
            set_num: set.set_num,
            name: set.name,
            theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
            image_url: imageUrl,
            num_parts: set.num_parts || 0,
            part_count: set.num_parts || 0,
            missingInfo: missingInfo ? {
              partTypes: missingInfo.partTypes.size,
              totalCount: missingInfo.totalCount
            } : null
          }
        }).sort((a, b) => {
          // 세트 번호로 정렬
          return a.set_num.localeCompare(b.set_num)
        })

        // 부품 정보, 색상 정보, 이미지 정보를 모두 병렬로 조회 (성능 최적화)
        const partIds = [...new Set(missingItems.map(i => i.part_id).filter(Boolean))]
        const colorIds = [...new Set(missingItems.map(i => i.color_id).filter(id => id !== null && id !== undefined))]
        const elementIds = [...new Set(missingItems.map(i => i.element_id).filter(Boolean))].map(id => String(id))
        const allPartIdsForImages = [...new Set(missingItems.map(i => i.part_id).filter(id => id !== null && id !== undefined && id !== ''))]
        const allColorIdsForImages = [...new Set(missingItems.map(i => i.color_id).filter(id => id !== null && id !== undefined))]

        // Rebrickable CDN URL 생성 헬퍼 함수 (jpg 사용)
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          if (elementId) {
            return `https://cdn.rebrickable.com/media/parts/elements/${String(elementId)}.jpg`
          } else if (partId && colorId !== null && colorId !== undefined) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/${colorId}.jpg`
          } else if (partId) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/0.jpg`
          }
          return null
        }

        // 모든 데이터 조회를 병렬로 처리
        const allQueries = [
          partIds.length > 0
            ? supabase
                .from('lego_parts')
                .select('part_num, name, part_img_url')
                .in('part_num', partIds)
            : Promise.resolve({ data: [], error: null }),
          colorIds.length > 0
            ? supabase
                .from('lego_colors')
                .select('color_id, name, rgb')
                .in('color_id', colorIds)
            : Promise.resolve({ data: [], error: null })
        ]

        // 이미지 조회 쿼리 추가
        if (elementIds.length > 0) {
          allQueries.push(
            supabase
              .from('part_images')
              .select('element_id, uploaded_url')
              .in('element_id', elementIds)
              .not('uploaded_url', 'is', null),
            supabase
              .from('image_metadata')
              .select('element_id, supabase_url')
              .in('element_id', elementIds)
              .not('supabase_url', 'is', null)
          )
        }
        
        if (allPartIdsForImages.length > 0 && allColorIdsForImages.length > 0) {
          allQueries.push(
            supabase
              .from('part_images')
              .select('part_id, color_id, uploaded_url')
              .in('part_id', allPartIdsForImages)
              .in('color_id', allColorIdsForImages)
              .not('uploaded_url', 'is', null),
            supabase
              .from('image_metadata')
              .select('part_num, color_id, supabase_url')
              .in('part_num', allPartIdsForImages)
              .in('color_id', allColorIdsForImages)
              .not('supabase_url', 'is', null)
          )
        }

        // 모든 쿼리를 병렬로 실행
        const allResults = await Promise.all(allQueries)

        // 결과 분리
        const partsResult = allResults[0]
        const colorsResult = allResults[1]
        let imageResults = []
        if (elementIds.length > 0) {
          imageResults = allResults.slice(2, 4)
          if (allPartIdsForImages.length > 0 && allColorIdsForImages.length > 0) {
            imageResults = allResults.slice(2, 6)
          }
        } else if (allPartIdsForImages.length > 0 && allColorIdsForImages.length > 0) {
          imageResults = allResults.slice(2, 4)
        }

        const { data: partsInfo, error: partsError } = partsResult
        if (partsError) throw partsError

        const { data: colorsInfo, error: colorsError } = colorsResult
        if (colorsError) throw colorsError

        const partsMap = new Map((partsInfo || []).map(p => [p.part_num, p]))
        const colorsMap = new Map((colorsInfo || []).map(c => [c.color_id, c]))

        // element_id 기반 이미지 맵 구성
        const elementImageMap = new Map()
        let imageResultIndex = 0
        if (elementIds.length > 0) {
          const elementImagesResult = imageResults[imageResultIndex++]
          const elementMetadataResult = imageResults[imageResultIndex++]

          if (!elementImagesResult.error && elementImagesResult.data) {
            for (const img of elementImagesResult.data) {
              if (img.element_id && img.uploaded_url) {
                const elementId = String(img.element_id)
                const isBucketUrl = img.uploaded_url.includes('/storage/v1/object/public/lego_parts_images/')
                if (isBucketUrl && !img.uploaded_url.toLowerCase().endsWith('.jpg')) {
                  elementImageMap.set(elementId, img.uploaded_url)
                }
              }
            }
          }

          if (!elementMetadataResult.error && elementMetadataResult.data) {
            for (const img of elementMetadataResult.data) {
              if (img.element_id && img.supabase_url) {
                const elementId = String(img.element_id)
                if (!elementImageMap.has(elementId)) {
                  const isBucketUrl = img.supabase_url.includes('/storage/v1/object/public/lego_parts_images/')
                  if (isBucketUrl && !img.supabase_url.toLowerCase().endsWith('.jpg')) {
                    elementImageMap.set(elementId, img.supabase_url)
                  }
                }
              }
            }
          }
        }

        // part_id + color_id 기반 이미지 맵 구성
        const partColorImageMap = new Map()
        if (allPartIdsForImages.length > 0 && allColorIdsForImages.length > 0 && imageResults.length > imageResultIndex) {
          const partImagesResult = imageResults[imageResultIndex++]
          const metadataImagesResult = imageResults[imageResultIndex++]

          if (!partImagesResult.error && partImagesResult.data) {
            for (const img of partImagesResult.data) {
              if (img.part_id && img.color_id !== null && img.color_id !== undefined && img.uploaded_url) {
                const key = `${img.part_id}_${img.color_id}`
                const isBucketUrl = img.uploaded_url.includes('/storage/v1/object/public/lego_parts_images/')
                if (isBucketUrl && !img.uploaded_url.toLowerCase().endsWith('.jpg')) {
                  partColorImageMap.set(key, img.uploaded_url)
                }
              }
            }
          }

          if (!metadataImagesResult.error && metadataImagesResult.data) {
            for (const img of metadataImagesResult.data) {
              if (img.part_num && img.color_id !== null && img.color_id !== undefined && img.supabase_url) {
                const key = `${img.part_num}_${img.color_id}`
                if (!partColorImageMap.has(key)) {
                  const isBucketUrl = img.supabase_url.includes('/storage/v1/object/public/lego_parts_images/')
                  if (isBucketUrl && !img.supabase_url.toLowerCase().endsWith('.jpg')) {
                    partColorImageMap.set(key, img.supabase_url)
                  }
                }
              }
            }
          }
        }

        // 누락 부품 데이터 구성 (동기 처리로 최적화)
        const partsDataWithImages = missingItems.map((item) => {
          const setId = sessionSetMap.get(item.session_id)
          const meta = metadataMap.get(setId) || {}
          const partInfo = partsMap.get(item.part_id)
          const colorInfo = colorsMap.get(item.color_id)

          // ManualInspection.vue와 동일한 로직: total_count - checked_count가 누락 개수
          const missingCount = Math.max(0, (item.total_count || 0) - (item.checked_count || 0))

          // 이미지 URL 결정: element_id 우선, 없으면 part_id + color_id
          let imageUrl = null
          
          // 1. element_id 기반 이미지 우선 확인
          if (item.element_id && elementImageMap.has(String(item.element_id))) {
            imageUrl = elementImageMap.get(String(item.element_id))
          }
          
          // 2. element_id 이미지가 없으면 part_id + color_id 기반 이미지 확인
          if (!imageUrl && item.part_id && item.color_id !== null && item.color_id !== undefined) {
            const key = `${item.part_id}_${item.color_id}`
            if (partColorImageMap.has(key)) {
              imageUrl = partColorImageMap.get(key)
            }
          }

          // 3. 버킷에도 없으면 Rebrickable CDN으로 폴백
          if (!imageUrl) {
            const elementId = item.element_id ? String(item.element_id) : null
            imageUrl = getRebrickableCdnUrl(elementId, item.part_id, item.color_id)
            if (!imageUrl && elementId) {
              imageUrl = `https://cdn.rebrickable.com/media/parts/elements/${elementId}.jpg`
            }
          }

          const partData = {
            set_id: setId,
            set_display_name: formatSetDisplay(meta.set_num, meta.theme_name, meta.set_name || '세트명 없음'),
            part_id: item.part_id,
            color_id: item.color_id,
            element_id: item.element_id,
            part_name: partInfo?.name || item.part_id,
            color_name: colorInfo ? (colorInfo.name || null) : null,
            color_rgb: colorInfo ? (colorInfo.rgb || null) : null,
            supabase_image_url: imageUrl || null,
            missing_count: missingCount
          }
          
          return partData
        })

        console.log('[MissingParts] 최종 부품 데이터:', partsDataWithImages.length, '개')
        if (partsDataWithImages.length > 0) {
          console.log('[MissingParts] 첫 번째 부품 샘플:', {
            element_id: partsDataWithImages[0].element_id,
            part_id: partsDataWithImages[0].part_id,
            supabase_image_url: partsDataWithImages[0].supabase_image_url?.substring(0, 80) || 'null',
            hasSupabaseImageUrl: !!partsDataWithImages[0].supabase_image_url
          })
        }

        // 정렬 함수: 색상 우선, element_id 2차, 피규어는 스티커 바로 앞
        const isSticker = (item) => {
          const partName = (item.part_name || '').toLowerCase()
          const partId = (item.part_id || '').toLowerCase()
          return partName.includes('sticker') || 
                 partName.includes('스티커') ||
                 partId.includes('sticker') ||
                 partId.includes('stk-')
        }

        const isMinifigure = (item) => {
          const partId = item.part_id || ''
          return String(partId).toLowerCase().startsWith('fig-')
        }

        const sortParts = (partsList) => {
          return [...partsList].sort((a, b) => {
            // 우선순위: 일반 부품(0) > 피규어(1) > 스티커(2)
            const aIsSticker = isSticker(a)
            const bIsSticker = isSticker(b)
            const aIsMinifigure = isMinifigure(a)
            const bIsMinifigure = isMinifigure(b)
            
            const aPriority = aIsSticker ? 2 : (aIsMinifigure ? 1 : 0)
            const bPriority = bIsSticker ? 2 : (bIsMinifigure ? 1 : 0)
            
            if (aPriority !== bPriority) {
              return aPriority - bPriority
            }
            // 1차: 색상명
            const colorCompare = (a.color_name || '').localeCompare(b.color_name || '', 'ko')
            if (colorCompare !== 0) {
              return colorCompare
            }
            // 2차: element_id (숫자 우선, 없으면 문자열 비교)
            const aElementId = a.element_id
            const bElementId = b.element_id
            if (aElementId !== bElementId) {
              const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
              const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
              if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
              }
              return String(aElementId || '').localeCompare(String(bElementId || ''), 'ko')
            }
            // 3차: 부품명 (같은 element_id 내에서)
            return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
          })
        }

        missingParts.value = sortParts(partsDataWithImages)
        console.log('[MissingParts] missingParts 설정 완료:', missingParts.value.length, 'missingPartsBySet:', missingPartsBySet.value.length)
      } catch (err) {
        console.error('[MissingParts] 누락 부품 로드 실패:', err)
        error.value = '누락 부품을 불러오는데 실패했습니다'
      } finally {
        loading.value = false
        console.log('[MissingParts] loadMissingParts 완료, loading:', loading.value)
      }
    }

    const handleImageError = (event) => {
      const img = event.target
      const originalSrc = img.src
      const elementId = img.dataset.elementId
      const partId = img.dataset.partId
      const colorId = img.dataset.colorId
      
      // Rebrickable CDN으로 폴백
      if (elementId || partId) {
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          if (elementId) {
            return `https://cdn.rebrickable.com/media/parts/elements/${String(elementId)}.jpg`
          } else if (partId && colorId !== null && colorId !== undefined) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/${colorId}.jpg`
          } else if (partId) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/0.jpg`
          }
          return null
        }
        
        const cdnUrl = getRebrickableCdnUrl(elementId, partId, colorId)
        if (cdnUrl && cdnUrl !== originalSrc) {
          img.src = cdnUrl
          return
        }
      }
      
      img.style.display = 'none'
      const placeholder = img.nextElementSibling
      if (placeholder) {
        placeholder.style.display = 'flex'
      }
    }

    const handleSelectedSetImageError = (event) => {
      const wrapper = event.target.closest('.selected-set-thumb-wrapper')
      if (wrapper) {
        const placeholder = document.createElement('div')
        placeholder.className = 'selected-set-no-image'
        placeholder.textContent = '이미지 없음'
        wrapper.appendChild(placeholder)
      }
      event.target.style.display = 'none'
    }

    const handleSetImageError = (event) => {
      const img = event.target
      const container = img.closest('.set-image')
      if (container) {
        const noImage = container.querySelector('.no-image')
        if (noImage) {
          noImage.style.display = 'flex'
        }
        img.style.display = 'none'
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleString('ko-KR', {
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

    const statusLabel = (status) => {
      const labels = {
        'in_progress': '진행 중',
        'paused': '임시저장',
        'completed': '완료'
      }
      return labels[status] || status
    }

    const getColorTextColor = (rgb) => {
      if (!rgb) return '#ffffff'
      let rgbStr = String(rgb).trim()
      if (!rgbStr || rgbStr === 'null' || rgbStr === 'undefined' || rgbStr === 'None') {
        return '#ffffff'
      }
      if (!rgbStr.startsWith('#')) {
        rgbStr = `#${rgbStr}`
      }
      
      // 화이트 색상 판단 (#FFFFFF, #ffffff, FFFFFF 등)
      const normalized = rgbStr.toUpperCase()
      if (normalized === '#FFFFFF' || normalized === '#FFF' || normalized === 'FFFFFF' || normalized === 'FFF') {
        return '#6b7280' // 그레이
      }
      
      // RGB 값으로 화이트 판단 (255, 255, 255에 가까운 경우)
      if (normalized.length === 7 && normalized.startsWith('#')) {
        const r = parseInt(normalized.substring(1, 3), 16)
        const g = parseInt(normalized.substring(3, 5), 16)
        const b = parseInt(normalized.substring(5, 7), 16)
        
        // 밝기가 240 이상이면 화이트로 간주
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        if (brightness >= 240) {
          return '#6b7280' // 그레이
        }
      }
      
      return '#ffffff' // 기본값 (흰색 텍스트)
    }

    const getColorRgb = (rgb) => {
      if (!rgb) return null
      let rgbStr = String(rgb).trim()
      if (rgbStr && !rgbStr.startsWith('#')) {
        rgbStr = `#${rgbStr}`
      }
      return rgbStr || null
    }

    const formatColorLabel = (colorName, colorId, partId = null) => {
      // 미니피규어인 경우 (part_id가 fig-로 시작)
      if (partId && String(partId).toLowerCase().startsWith('fig-')) {
        return 'Any Color'
      }
      
      // colorName이 있으면 우선 사용 (colorId가 0이어도 colorName이 있으면 표시)
      if (colorName) {
        const normalized = String(colorName).trim()
        if (!normalized) {
          // 빈 문자열인 경우에만 colorId 체크
          if (colorId === 0 || colorId === '0') {
            return 'Any Color'
          }
          return colorId !== null && colorId !== undefined ? `Color ${colorId}` : 'Any Color'
        }
        
        const lower = normalized.toLowerCase()
        // "No Color", "Any Color" 등 특수 케이스만 "Any Color"로 변환
        if (
          lower === 'no color' ||
          lower === 'any color' ||
          (lower.includes('no color') && lower.includes('any color')) ||
          (normalized.includes('No Color') && normalized.includes('Any Color'))
        ) {
          return 'Any Color'
        }
        // 정상적인 색상명이면 그대로 반환
        return normalized
      }
      
      // colorName이 없을 때만 colorId 체크
      if (colorId === 0 || colorId === '0') {
        return 'Any Color'
      }
      return colorId !== null && colorId !== undefined ? `Color ${colorId}` : 'Any Color'
    }

    const getContrastColor = (rgb) => {
      if (!rgb) return '#1f2937'
      
      let rgbStr = String(rgb).trim()
      if (rgbStr && !rgbStr.startsWith('#')) {
        rgbStr = `#${rgbStr}`
      }
      
      if (!rgbStr || rgbStr.length !== 7) return '#1f2937'
      
      const r = parseInt(rgbStr.substring(1, 3), 16)
      const g = parseInt(rgbStr.substring(3, 5), 16)
      const b = parseInt(rgbStr.substring(5, 7), 16)
      
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      
      return brightness > 128 ? '#1f2937' : '#ffffff'
    }

    const resolvePartCount = (set) => {
      if (!set) return 0
      const candidates = [set.part_count, set.num_parts]
      for (const value of candidates) {
        if (value === null || value === undefined) continue
        const numeric = Number(value)
        if (Number.isFinite(numeric)) {
          return numeric
        }
      }
      return 0
    }

    const resetPage = () => {
      setSearchQuery.value = ''
      selectedSetId.value = ''
      selectedSet.value = null
      searchResults.value = []
      searchResultsKey.value++
      showSetDropdown.value = false
      missingParts.value = []
      error.value = null
      loadInspectionSets()
    }

    const openMissingPartsModal = async (set) => {
      console.log('[MissingParts Modal] openMissingPartsModal 호출:', { 
        setNum: set?.set_num, 
        setId: set?.id,
        numParts: set?.num_parts,
        partCount: set?.part_count
      })
      selectedModalSet.value = set
      showMissingPartsModal.value = true
      missingPartsModalData.value = []
      missingPartsModalError.value = null
      missingPartsModalLoading.value = true
      
      console.log('[MissingParts Modal] 모달 열림, 데이터 로딩 시작')
      
      // 돋보기 클릭 시 모달만 열리고 페이지 상태는 변경하지 않음
      // selectedSet, selectedSetId, setSearchQuery 모두 변경하지 않음

      try {
        console.log('[MissingParts Modal] 세션 조회 시작, set.id:', set.id)
        // 해당 세트의 검수 세션 조회
        const { data: sessions, error: sessionsError } = await supabase
          .from('inspection_sessions')
          .select('id')
          .eq('set_id', set.id)
          .in('status', ['in_progress', 'paused', 'completed'])
          .order('created_at', { ascending: false })
          .limit(1)

        if (sessionsError) throw sessionsError
        console.log('[MissingParts Modal] 세션 조회 결과:', sessions?.length || 0, '개')

        if (!sessions || sessions.length === 0) {
          console.log('[MissingParts Modal] 세션 없음, 종료')
          missingPartsModalData.value = []
          missingPartsModalLoading.value = false
          return
        }

        const sessionId = sessions[0].id
        console.log('[MissingParts Modal] 세션 ID:', sessionId)

        // 누락부품 조회
        const { data: missingItems, error: itemsError } = await supabase
          .from('inspection_items')
          .select('part_id, color_id, element_id, total_count, checked_count, status')
          .eq('session_id', sessionId)
          .eq('status', 'missing')

        if (itemsError) throw itemsError
        console.log('[MissingParts Modal] 누락부품 조회 결과:', missingItems?.length || 0, '개')

        if (!missingItems || missingItems.length === 0) {
          console.log('[MissingParts Modal] 누락부품 없음, 종료')
          missingPartsModalData.value = []
          missingPartsModalLoading.value = false
          return
        }

        // 부품 정보 조회
        const partIds = [...new Set(missingItems.map(i => i.part_id).filter(Boolean))]
        const { data: partsInfo, error: partsInfoError } = await supabase
          .from('lego_parts')
          .select('part_num, name, part_img_url')
          .in('part_num', partIds)

        if (partsInfoError) throw partsInfoError

        // 색상 정보 조회
        const colorIds = [...new Set(missingItems.map(i => i.color_id).filter(id => id !== null && id !== undefined))]
        const { data: colorsInfo, error: colorsError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .in('color_id', colorIds)

        if (colorsError) throw colorsError

        // 부품 이미지 URL 조회
        const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
        const colorsInfoMap = new Map(colorsInfo.map(c => [c.color_id, c]))

        // element_id 목록 수집
        const elementIds = [...new Set(missingItems.map(i => i.element_id).filter(Boolean))].map(id => String(id))
        console.log('[MissingParts Modal] element_id 목록:', elementIds.length, elementIds.slice(0, 5))
        
        // 버킷 URL 생성 헬퍼 함수
        const getBucketImageUrl = (elementId, partId, colorId) => {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
          const bucketName = 'lego_parts_images'
          const fileName = elementId ? `${String(elementId)}.webp` : `${partId}_${colorId}.webp`
          return `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
        }

        // Rebrickable CDN URL 생성 헬퍼 함수 (jpg 사용)
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          if (elementId) {
            return `https://cdn.rebrickable.com/media/parts/elements/${String(elementId)}.jpg`
          } else if (partId && colorId !== null && colorId !== undefined) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/${colorId}.jpg`
          } else if (partId) {
            // partId만 있는 경우 (colorId가 0이거나 null일 수 있음)
            return `https://cdn.rebrickable.com/media/parts/${partId}/0.jpg`
          }
          return null
        }

        // 버킷 이미지 존재 확인 헬퍼 함수
        const checkBucketImageExists = async (url) => {
          try {
            const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
            // 400, 404는 파일 없음으로 처리 (콘솔 오류 방지)
            if (response.status === 400 || response.status === 404) {
              return false
            }
            return response.ok
          } catch {
            return false
          }
        }

        // element_id 기반 이미지 배치 조회 (버킷 URL 우선)
        const elementImageMap = new Map()
        if (elementIds.length > 0) {
          const { data: elementImages, error: elementImagesError } = await supabase
            .from('part_images')
            .select('element_id, uploaded_url')
            .in('element_id', elementIds)
            .not('uploaded_url', 'is', null)

          console.log('[MissingParts Modal] part_images 조회 결과:', elementImages?.length || 0, '개')

          if (!elementImagesError && elementImages) {
            for (const img of elementImages) {
              if (img.element_id && img.uploaded_url) {
                const elementId = String(img.element_id)
                // 버킷 URL인지 확인
                const isBucketUrl = img.uploaded_url.includes('/storage/v1/object/public/lego_parts_images/')
                if (isBucketUrl && !img.uploaded_url.toLowerCase().endsWith('.jpg')) {
                  elementImageMap.set(elementId, img.uploaded_url)
                  console.log('[MissingParts Modal] element_id 이미지 추가:', elementId, '→', img.uploaded_url.substring(0, 80))
                } else if (!isBucketUrl) {
                  // CDN/API URL이면 버킷에 저장된 이미지 확인
                  const bucketUrl = getBucketImageUrl(elementId, null, null)
                  const exists = await checkBucketImageExists(bucketUrl)
                  if (exists) {
                    elementImageMap.set(elementId, bucketUrl)
                    console.log('[MissingParts Modal] 버킷 이미지 추가:', elementId, '→', bucketUrl.substring(0, 80))
                  }
                }
              }
            }
          }

          const missingElementIds = elementIds.filter(id => !elementImageMap.has(id))
          console.log('[MissingParts Modal] image_metadata 조회 필요:', missingElementIds.length, '개')
          
          if (missingElementIds.length > 0) {
            const { data: metadataImages, error: metadataError } = await supabase
              .from('image_metadata')
              .select('element_id, supabase_url')
              .in('element_id', missingElementIds)
              .not('supabase_url', 'is', null)

            console.log('[MissingParts Modal] image_metadata 조회 결과:', metadataImages?.length || 0, '개')

            if (!metadataError && metadataImages) {
              for (const img of metadataImages) {
                if (img.element_id && img.supabase_url) {
                  const elementId = String(img.element_id)
                  // 버킷 URL인지 확인
                  const isBucketUrl = img.supabase_url.includes('/storage/v1/object/public/lego_parts_images/')
                  if (isBucketUrl && !img.supabase_url.toLowerCase().endsWith('.jpg')) {
                    elementImageMap.set(elementId, img.supabase_url)
                    console.log('[MissingParts Modal] metadata 이미지 추가:', elementId, '→', img.supabase_url.substring(0, 80))
                  } else if (!isBucketUrl) {
                    // CDN/API URL이면 버킷에 저장된 이미지 확인
                    const bucketUrl = getBucketImageUrl(elementId, null, null)
                    const exists = await checkBucketImageExists(bucketUrl)
                    if (exists) {
                      elementImageMap.set(elementId, bucketUrl)
                      console.log('[MissingParts Modal] 버킷 이미지 추가 (metadata):', elementId, '→', bucketUrl.substring(0, 80))
                    }
                  }
                }
              }
            }
          }

          // part_images/image_metadata에 없으면 버킷 직접 확인
          const stillMissingElementIds = elementIds.filter(id => !elementImageMap.has(id))
          for (const elementId of stillMissingElementIds) {
            const bucketUrl = getBucketImageUrl(elementId, null, null)
            const exists = await checkBucketImageExists(bucketUrl)
            if (exists) {
              elementImageMap.set(elementId, bucketUrl)
              console.log('[MissingParts Modal] 버킷 직접 확인 이미지 추가:', elementId, '→', bucketUrl.substring(0, 80))
            }
          }
          console.log('[MissingParts Modal] elementImageMap 최종 크기:', elementImageMap.size)
        }

        // part_id + color_id 기반 이미지 조회 (버킷 URL 우선)
        const partColorImageMap = new Map()
        // 모든 누락 아이템의 part_id와 color_id 조회 (element_id가 있어도 fallback으로 사용)
        const allPartIdsForImages = [...new Set(missingItems.map(i => i.part_id).filter(Boolean))]
        const allColorIdsForImages = [...new Set(missingItems.map(i => i.color_id).filter(id => id !== null && id !== undefined))]

        if (allPartIdsForImages.length > 0 && allColorIdsForImages.length > 0) {
          const { data: partImages, error: partImagesError } = await supabase
            .from('part_images')
            .select('part_id, color_id, uploaded_url')
            .in('part_id', allPartIdsForImages)
            .in('color_id', allColorIdsForImages)
            .not('uploaded_url', 'is', null)

          if (!partImagesError && partImages) {
            for (const img of partImages) {
              if (img.part_id && img.color_id && img.uploaded_url) {
                const key = `${img.part_id}_${img.color_id}`
                if (!partColorImageMap.has(key)) {
                  // 버킷 URL인지 확인
                  const isBucketUrl = img.uploaded_url.includes('/storage/v1/object/public/lego_parts_images/')
                  if (isBucketUrl && !img.uploaded_url.toLowerCase().endsWith('.jpg')) {
                    partColorImageMap.set(key, img.uploaded_url)
                  } else if (!isBucketUrl) {
                    // CDN/API URL이면 버킷에 저장된 이미지 확인
                    const bucketUrl = getBucketImageUrl(null, img.part_id, img.color_id)
                    const exists = await checkBucketImageExists(bucketUrl)
                    if (exists) {
                      partColorImageMap.set(key, bucketUrl)
                    }
                  }
                }
              }
            }
          }

          // part_images에 없으면 버킷 직접 확인
          for (const item of missingItems) {
            const key = `${item.part_id}_${item.color_id}`
            if (!partColorImageMap.has(key)) {
              const bucketUrl = getBucketImageUrl(null, item.part_id, item.color_id)
              const exists = await checkBucketImageExists(bucketUrl)
              if (exists) {
                partColorImageMap.set(key, bucketUrl)
              }
            }
          }
        }

        // 누락부품 데이터 구성 (비동기 처리)
        const partsWithImages = await Promise.all(missingItems.map(async (item) => {
          const partInfo = partsInfoMap.get(item.part_id)
          const colorInfo = colorsInfoMap.get(item.color_id)
          const missingCount = Math.max(0, (item.total_count || 0) - (item.checked_count || 0))

          // 이미지 URL 결정: element_id 우선, 없으면 part_id + color_id, 마지막으로 버킷 직접 확인
          let imageUrl = null
          let imageSource = 'none'
          
          // 1. element_id 기반 이미지 우선 확인
          if (item.element_id && elementImageMap.has(String(item.element_id))) {
            imageUrl = elementImageMap.get(String(item.element_id))
            imageSource = 'element_id'
          }
          
          // 2. element_id 이미지가 없으면 part_id + color_id 기반 이미지 확인
          if (!imageUrl) {
            const key = `${item.part_id}_${item.color_id}`
            if (partColorImageMap.has(key)) {
              imageUrl = partColorImageMap.get(key)
              imageSource = 'part_id+color_id'
            }
          }

          // 3. 버킷 직접 확인 (fallback 1)
          if (!imageUrl) {
            const bucketUrl = item.element_id 
              ? getBucketImageUrl(item.element_id, item.part_id, item.color_id)
              : getBucketImageUrl(null, item.part_id, item.color_id)
            const exists = await checkBucketImageExists(bucketUrl)
            if (exists) {
              imageUrl = bucketUrl
              imageSource = 'bucket_direct'
            }
          }

          // 4. 버킷에도 없으면 Rebrickable CDN으로 폴백
          if (!imageUrl) {
            imageUrl = getRebrickableCdnUrl(item.element_id, item.part_id, item.color_id)
            // CDN URL도 없으면 element_id만으로 시도
            if (!imageUrl && item.element_id) {
              imageUrl = `https://cdn.rebrickable.com/media/parts/elements/${item.element_id}.jpg`
            }
            if (imageUrl) {
              imageSource = 'rebrickable_cdn'
            }
          }
          
          console.log(`[MissingParts Modal] 이미지 결정 - element_id: ${item.element_id}, part_id: ${item.part_id}, color_id: ${item.color_id}, source: ${imageSource}, url: ${imageUrl?.substring(0, 80) || 'null'}`)

          const partData = {
            part_id: item.part_id,
            color_id: item.color_id,
            element_id: item.element_id,
            part_name: partInfo?.name || item.part_id,
            color_name: colorInfo?.name || null,
            color_rgb: colorInfo?.rgb || null,
            image_url: imageUrl || null,
            missing_count: missingCount
          }
          
          console.log('[MissingParts Modal] 부품 데이터 생성:', {
            element_id: partData.element_id,
            part_id: partData.part_id,
            color_id: partData.color_id,
            image_url: partData.image_url?.substring(0, 80) || 'null',
            hasImageUrl: !!partData.image_url
          })
          
          return partData
        }))

        console.log('[MissingParts Modal] 최종 부품 데이터:', partsWithImages.length, '개')
        if (partsWithImages.length > 0) {
          console.log('[MissingParts Modal] 첫 번째 부품 샘플:', {
            element_id: partsWithImages[0].element_id,
            part_id: partsWithImages[0].part_id,
            image_url: partsWithImages[0].image_url?.substring(0, 80) || 'null',
            hasImageUrl: !!partsWithImages[0].image_url
          })
        }

        // 정렬 함수: 색상 우선, element_id 2차, 피규어는 스티커 바로 앞
        const isSticker = (item) => {
          const partName = (item.part_name || '').toLowerCase()
          const partId = (item.part_id || '').toLowerCase()
          return partName.includes('sticker') || 
                 partName.includes('스티커') ||
                 partId.includes('sticker') ||
                 partId.includes('stk-')
        }

        const isMinifigure = (item) => {
          const partId = item.part_id || ''
          return String(partId).toLowerCase().startsWith('fig-')
        }

        const sortParts = (partsList) => {
          return [...partsList].sort((a, b) => {
            // 우선순위: 일반 부품(0) > 피규어(1) > 스티커(2)
            const aIsSticker = isSticker(a)
            const bIsSticker = isSticker(b)
            const aIsMinifigure = isMinifigure(a)
            const bIsMinifigure = isMinifigure(b)
            
            const aPriority = aIsSticker ? 2 : (aIsMinifigure ? 1 : 0)
            const bPriority = bIsSticker ? 2 : (bIsMinifigure ? 1 : 0)
            
            if (aPriority !== bPriority) {
              return aPriority - bPriority
            }
            // 1차: 색상명
            const colorCompare = (a.color_name || '').localeCompare(b.color_name || '', 'ko')
            if (colorCompare !== 0) {
              return colorCompare
            }
            // 2차: element_id (숫자 우선, 없으면 문자열 비교)
            const aElementId = a.element_id
            const bElementId = b.element_id
            if (aElementId !== bElementId) {
              const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
              const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
              if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
              }
              return String(aElementId || '').localeCompare(String(bElementId || ''), 'ko')
            }
            // 3차: 부품명 (같은 element_id 내에서)
            return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
          })
        }

        missingPartsModalData.value = sortParts(partsWithImages)
      } catch (err) {
        missingPartsModalError.value = err.message || '누락부품 목록을 불러오는 중 오류가 발생했습니다.'
        console.error('누락부품 목록 조회 실패:', err)
      } finally {
        missingPartsModalLoading.value = false
      }
    }

    const closeMissingPartsModal = () => {
      showMissingPartsModal.value = false
      selectedModalSet.value = null
      missingPartsModalData.value = []
      missingPartsModalError.value = null
    }

    // CDN URL인지 확인하는 함수
    const isCdnUrl = (url) => {
      if (!url) return false
      return url.includes('cdn.rebrickable.com')
    }

    const handlePartImageError = (event) => {
      const img = event.target
      const originalSrc = img.src
      const elementId = img.dataset.elementId
      const partId = img.dataset.partId
      const colorId = img.dataset.colorId
      
      // Rebrickable CDN으로 폴백
      if (elementId || partId) {
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          if (elementId) {
            return `https://cdn.rebrickable.com/media/parts/elements/${String(elementId)}.jpg`
          } else if (partId && colorId !== null && colorId !== undefined) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/${colorId}.jpg`
          } else if (partId) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/0.jpg`
          }
          return null
        }
        
        const cdnUrl = getRebrickableCdnUrl(elementId, partId, colorId)
        if (cdnUrl && cdnUrl !== originalSrc) {
          img.src = cdnUrl
          return
        }
      }
      
      img.style.display = 'none'
    }

    // URL 쿼리 파라미터 변경 감지
    watch(() => route.query.session, async () => {
      await loadMissingParts()
    })

    watch(user, async (newUser) => {
      if (newUser) {
        console.log('[MissingParts] watch user - 사용자 로드됨', { userId: newUser.id, email: newUser.email })
        // loadStoreInventory와 loadInspectionSets를 병렬로 처리
        await Promise.all([
          loadStoreInventory(),
          loadInspectionSets()
        ])
        console.log('[MissingParts] watch user - 로드 완료, inspectionSets:', inspectionSets.value?.length || 0)
      } else {
        storeInfo.value = null
        storeInventory.value = []
        inspectionSets.value = []
      }
    }, { immediate: true })

    onMounted(async () => {
      console.log('[MissingParts] onMounted 시작', { hasUser: !!user.value, user: user.value })
      if (user.value) {
        // loadStoreInventory와 loadInspectionSets를 병렬로 처리
        await Promise.all([
          loadStoreInventory(),
          loadInspectionSets()
        ])
        console.log('[MissingParts] onMounted - 로드 완료, inspectionSets:', inspectionSets.value?.length || 0)
      }
      console.log('[MissingParts] onMounted - loadMissingParts 호출')
      await loadMissingParts()
      console.log('[MissingParts] onMounted - loadMissingParts 완료, inspectionSets:', inspectionSets.value?.length || 0)
    })

    return {
      loading,
      error,
      selectedSetId,
      missingParts,
      missingPartsBySet,
      loadMissingParts,
      handleImageError,
      handleSelectedSetImageError,
      setSearchQuery,
      searchResults,
      searchResultsKey,
      selectedSet,
      inspectionSets,
      formatSetNumber,
      handleSetImageError,
      openMissingPartsModal,
      closeMissingPartsModal,
      showMissingPartsModal,
      selectedModalSet,
      missingPartsModalData,
      missingPartsModalLoading,
      missingPartsModalError,
      handlePartImageError,
      getColorRgb,
      getColorTextColor,
      formatColorLabel,
      showSetDropdown,
      setDropdownRef,
      handleSearchEnter,
      handleSearchBlur,
      handleSelectSet,
      searchTooltip,
      isCdnUrl,
      formatSetDisplay,
      formatSetNumber,
      formatDate,
      formatTime,
      statusLabel,
      getColorRgb,
      getColorTextColor,
      getContrastColor,
      resolvePartCount,
      inspectionSets,
      handleSetImageError,
      resetPage,
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
.missing-parts-page {
  min-height: 100vh;
  background: #f9fafb;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
  padding: 0;
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

.missing-parts-content {
  max-width: 1400px;
  margin: 0 auto;
}

.search-section {
  max-width: 800px;
  margin: 0 auto 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0;
}

.setup-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: visible;
}

.card-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 0rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
  line-height: normal;
  letter-spacing: normal;
  font-family: inherit;
}

.set-search-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
}

.set-search-input:hover {
  border-color: #9ca3af;
}

.set-search-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.set-search-input:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.8;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  flex-shrink: 0;
}

.set-search-input:focus + .search-icon {
  color: #2563eb;
}

.search-button {
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

.search-button:hover {
  background: #1d4ed8;
}

.search-button:active {
  background: #1e40af;
}

.search-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
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
  width: 22px; /* // 🔧 수정됨 */
  height: 22px; /* // 🔧 수정됨 */
  background: #ffffff; /* // 🔧 수정됨 */
  border: 1px solid #e5e7eb; /* // 🔧 수정됨 */
  border-radius: 9999px; /* // 🔧 수정됨 */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #4b5563; /* // 🔧 수정됨 */
  transition: all 0.2s ease;
  padding: 0;
  z-index: 10;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06); /* // 🔧 수정됨 */
}

.close-result-button:hover {
  background: #f9fafb; /* // 🔧 수정됨 */
  color: #374151; /* // 🔧 수정됨 */
  border-color: #d1d5db; /* // 🔧 수정됨 */
}

.close-result-button svg { /* // 🔧 수정됨 */
  width: 12px;
  height: 12px;
}

.close-result-button:active {
  transform: scale(0.95);
}

.selected-set-display {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.selected-set-row {
  display: flex;
  align-items: center;
  gap: 1.25rem; /* // 🔧 수정됨 */
}

.selected-set-thumb-wrapper {
  width: 100px;
  height: 100px;
  min-width: 100px;
  min-height: 100px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.selected-set-thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  padding: 0.5rem;
}

.selected-set-no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.5rem;
  background: #f9fafb;
}

.selected-set-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.selected-set-number {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
}

.selected-set-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  flex-wrap: wrap;
}

.selected-set-theme {
  font-weight: 500;
  color: #6b7280;
}

.selected-set-name {
  font-weight: 700;
  color: #374151;
  line-height: 1.4;
  word-break: break-word;
}

.selected-set-parts {
  display: block;
  font-size: 0.8125rem;
  color: #6b7280;
  margin-top: 0rem;
}

.custom-select-dropdown {
  position: relative;
  width: 100%;
  max-height: 260px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 18px 36px -12px rgba(15, 23, 42, 0.25);
  z-index: 20;
  padding: 0.5rem;
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
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.25rem; /* // 🔧 수정됨 */
  transition: background-color 0.15s ease, color 0.15s ease;
}

.option-set-image-wrapper {
  width: 60px;
  height: 60px;
  min-width: 60px;
  min-height: 60px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.option-set-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  padding: 0.25rem;
}

.option-set-no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.625rem;
  text-align: center;
  padding: 0.25rem;
  background: #f9fafb;
}

.option-set-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
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

.select-fade-enter-active,
.select-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.select-fade-enter-from,
.select-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #6b7280;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.inspection-sets-section {
  margin-bottom: 3rem;
  width: 100%;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.result-header {
  margin-bottom: 1.5rem;
}

.result-header h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.sets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.5rem;
  max-width: 100%;
}

@media (min-width: 1400px) {
  .sets-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1200px) and (min-width: 900px) {
  .sets-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  }
}

@media (max-width: 900px) and (min-width: 600px) {
  .sets-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .sets-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 768px) {
  .sets-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

.set-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.set-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.set-image {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.set-image img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.no-image {
  color: #9ca3af;
  font-size: 0.875rem;
}

.set-parts-icon-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  padding: 0;
}

.set-parts-icon-button:hover {
  transform: scale(1.1);
}

.set-parts-icon-button:active {
  transform: scale(0.95);
}

.search-icon-svg {
  color: #2563eb;
  width: 24px;
  height: 24px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.set-parts-icon-button:hover .search-icon-svg {
  color: #1d4ed8;
  filter: drop-shadow(0 2px 4px rgba(37, 99, 235, 0.3));
}

.set-info {
  padding: 1rem;
}

.set-name-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.set-number-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 20px;
  width: fit-content;
  line-height: 1.2;
}

.set-name-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
  overflow: hidden;
}

.set-theme-name {
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  line-height: 1.4;
}

.set-name-divider {
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.875rem;
  color: #d1d5db;
  line-height: 1.4;
}

.set-name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.set-quantity {
  font-size: 0.875rem;
  color: #3b82f6;
  font-weight: 500;
  margin: 0;
}

.set-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #ffffff;
  white-space: nowrap;
}

.status-badge.in-progress {
  background-color: #3b82f6;
  color: #ffffff;
}

.status-badge.paused {
  background-color: #f97316;
  color: #ffffff;
}

.status-badge.completed {
  background-color: #22c55e;
  color: #ffffff;
}

.progress-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #3b82f6;
  color: #ffffff;
  white-space: nowrap;
}

.time-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #1f2937;
  color: #ffffff;
  white-space: nowrap;
}

.missing-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #ef4444;
  color: #ffffff;
  white-space: nowrap;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar-container {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: #3b82f6;
  min-width: 40px;
  text-align: right;
}

.missing-parts-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.set-group {
  padding: 0;
}

.set-group-header {
  margin-bottom: 1.75rem;
  padding-bottom: 1.25rem;
  border-bottom: 2px solid #f3f4f6;
  display: flex;
  justify-content: center;
}

.set-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.set-title h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.75rem 0;
  letter-spacing: -0.025em;
}

.session-stats {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: center;
}

.stat-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
}

.stat-badge.progress {
  background: #3b82f6;
  color: #ffffff;
}

.stat-badge.missing {
  background: #ef4444;
  color: #ffffff;
}

.stat-badge.time {
  background: #1f2937;
  color: #ffffff;
}

.stat-badge.status {
  background: #eab308;
  color: #ffffff;
}

.stat-badge.status.status-in_progress {
  background: #3b82f6;
  color: #ffffff;
}

.stat-badge.status.status-paused {
  background: #f97316;
  color: #ffffff;
}

.stat-badge.status.status-completed {
  background: #22c55e;
  color: #ffffff;
}

.missing-count {
  font-size: 0.875rem;
  color: #ef4444;
  font-weight: 600;
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1.5rem;
  max-width: 100%;
}

@media (min-width: 1400px) {
  .parts-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (max-width: 1200px) and (min-width: 900px) {
  .parts-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 900px) and (min-width: 600px) {
  .parts-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.part-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease-out;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.part-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.part-card .card-header {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

.part-card .part-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  width: 0;
}

.part-card .element-id {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.part-card .part-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: #111827;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.part-card .color-badge {
  display: inline-block;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  border: none;
  width: fit-content;
  line-height: 1.1;
}

.part-card .card-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.part-card .part-image-section {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0rem 0;
  min-height: 120px;
  background: transparent;
  border-radius: 8px;
}

.part-card .part-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}

.part-card .no-part-image {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.875rem;
  background: #f9fafb;
  border-radius: 4px;
}

.cdn-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  z-index: 10;
  pointer-events: none;
}

.part-image-section .cdn-badge {
  top: 8px;
  right: 8px;
}

.part-card .quantity-section {
  display: flex;
  align-items: center;
  justify-content: center;
}

.part-card .quantity-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
}

@media (max-width: 1024px) {
  .parts-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .part-card .part-image-section {
    padding: 0.5rem 0 !important;
  }

  .modal-parts-grid .part-card .part-image-section {
    padding: 0.5rem 0 !important;
  }
}

@media (max-width: 768px) {
  .parts-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
}

/* 모달 부품 그리드 (4열 유지) */
.modal-parts-grid {
  grid-template-columns: repeat(4, 1fr) !important;
}

@media (min-width: 1400px) {
  .modal-parts-grid {
    grid-template-columns: repeat(4, 1fr) !important;
  }
}

/* 검색 툴팁 스타일 */
.set-search-wrapper {
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

@media (min-width: 769px) and (max-width: 1024px) {
  .modal-overlay {
    padding: 1.5rem;
  }

  .modal-container {
    max-width: 95vw;
    max-height: 95vh;
    width: 100%;
  }

  .modal-header {
    padding: 1.25rem;
  }

  .modal-header h3 {
    font-size: 1.125rem;
  }

  .modal-body {
    padding: 1.25rem;
  }

  .modal-parts-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 1rem;
  }
}

@media (max-width: 1200px) and (min-width: 1025px) {
  .modal-parts-grid {
    grid-template-columns: repeat(4, 1fr) !important;
  }
}

/* 모달 스타일 */
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
  padding: 2rem;
}

.modal-container {
  background: white;
  border-radius: 8px;
  max-width: 90vw;
  max-height: 90vh;
  width: 1000px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

.modal-close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.modal-close-button:hover {
  color: #1f2937;
}

.modal-body {
  padding: 1.5rem;
  padding-bottom: 2rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.loading-message,
.error-message,
.empty-message {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.error-message {
  color: #dc2626;
}

.set-parts-list {
  max-height: calc(90vh - 120px);
  padding-bottom: 0;
}

.set-parts-list .modal-parts-grid {
  padding-bottom: 2rem !important;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.5rem;
  }

  .modal-container {
    max-width: 100%;
    max-height: 100%;
    width: 100%;
    border-radius: 0;
  }

  .modal-header {
    padding: 1rem;
  }

  .modal-header h3 {
    font-size: 1.125rem;
  }

  .modal-close-button {
    font-size: 1.75rem;
    width: 1.75rem;
    height: 1.75rem;
  }

  .modal-body {
    padding: 1rem;
    padding-bottom: 1.5rem;
  }

  .modal-parts-grid {
    grid-template-columns: 1fr !important;
    gap: 0.75rem;
  }

  .parts-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 768px) {
  .missing-parts-page {
    padding: 1rem;
  }

  .page-header {
    margin-bottom: 1rem;
    padding: 1rem 0 0 0;
  }

  .page-header h1 {
    font-size: 1.25rem !important;
  }

  .page-header p {
    font-size: 0.875rem !important;
  }

  .search-section {
    max-width: 100%;
    margin-bottom: 1.5rem;
    padding: 0;
  }

  .card-body {
    padding: 1rem;
  }

  .set-search-input-row {
    flex-direction: row;
    gap: 0.5rem;
  }

  .search-button {
    width: auto;
    white-space: nowrap;
  }

  .set-search-input {
    font-size: 0.9375rem !important;
  }

  .search-button {
    font-size: 0.875rem !important;
  }

  .set-group {
    padding: 0;
  }

  .set-group-header {
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
  }

  .set-title h3 {
    font-size: 1.25rem !important;
    margin-bottom: 0.5rem !important;
  }

  .set-group-header {
    margin-bottom: 1rem !important;
  }

  .result-header {
    margin-bottom: 1rem !important;
  }

  .result-header h3 {
    font-size: 1.125rem !important;
  }

  .session-stats {
    gap: 0.5rem;
  }

  .stat-badge {
    font-size: 0.8125rem;
    padding: 0.3125rem 0.625rem;
  }

  .parts-grid {
    grid-template-columns: 1fr;
  }

  .part-card {
    padding: 0.875rem 1rem;
  }

  .modal-parts-grid .part-card .part-image-section {
    padding: 0.5rem 0 !important;
  }

  .part-card .card-header {
    display: flex !important;
    flex-direction: row !important;
    align-items: flex-start !important;
    gap: 0.5rem !important;
    overflow: visible !important;
  }

  .part-card .part-info {
    width: auto !important;
    flex: 1 !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  .part-card .part-name {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    font-size: 0.875rem !important;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .part-card .element-id {
    display: block !important;
  }

  .part-card .color-badge {
    display: inline-block !important;
    font-size: 0.8125rem !important;
  }

  .part-card .part-image-section {
    min-height: 100px;
    padding: 0.5rem 0 !important;
  }

  .part-card .part-image {
    max-height: 150px;
  }
}

/* 로그인 모달 스타일 */
.login-modal-content {
  max-width: 450px;
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



