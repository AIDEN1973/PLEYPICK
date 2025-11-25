<template>
  <div class="set-instructions-page">
    <div class="page-header">
      <div class="page-title-with-toggle">
        <h1>레고 설명서</h1>
        <label class="toggle-switch" :class="{ 'disabled': !user }">
          <input
            type="checkbox"
            v-model="searchInStoreOnly"
            @change="handleSearchOptionChange"
            :disabled="!user"
          />
          <span class="toggle-slider" :class="{ 'store-only': searchInStoreOnly, 'all-sets': !searchInStoreOnly }">
            <span class="toggle-text">{{ searchInStoreOnly ? '우리 매장' : '전체 레고' }}</span>
          </span>
        </label>
      </div>
      <p>레고번호를 입력하여 해당 세트의 공식 설명서를 확인할 수 있습니다.</p>
    </div>

    <div class="set-instructions-content">
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
                      <div class="option-content">
                        <div class="option-image-wrapper" :data-set-num="set.set_num">
                          <img
                            v-if="set.webp_image_url || set.set_img_url"
                            :src="set.webp_image_url || set.set_img_url"
                            :alt="set.name || set.set_num"
                            :data-set-id="set.id"
                            class="option-set-image"
                            @error="handleSetImageError($event, set)"
                            loading="eager"
                            crossorigin="anonymous"
                          />
                          <div v-else class="option-no-image">이미지 없음</div>
                        </div>
                        <div class="option-info">
                          <span class="option-set-num">{{ formatSetNumber(set.set_num) }}</span>
                          <span class="option-set-title">{{ [set.theme_name, set.name].filter(Boolean).join(' ') || (set.name || '') }}</span>
                          <span class="option-set-parts">부품수 : {{ resolvePartCount(set) }}개</span>
                        </div>
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

      <div
        v-if="showStoreSetsSection"
        class="store-sets-section"
      >
        <div class="result-header">
          <h3>레고 리스트</h3>
          <span class="result-count">(총 {{ storeSetsCount }}개)</span><!-- // 🔧 수정됨 -->
        </div>
        <div class="sets-grid">
          <div
            v-for="set in paginatedStoreSets"
            :key="set.id || set.set_num"
            class="set-card"
          >
            <div class="set-image">
              <img
                v-if="set.image_url"
                :src="set.image_url"
                :alt="set.name || set.set_num"
              />
              <div v-else class="no-image">이미지 없음</div>
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
                <span class="set-quantity">부품수 : {{ resolvePartCount(set) }}개</span>
                <span v-if="set.quantity" class="inventory-badge">재고: {{ set.quantity }}개</span>
              </div>
              <div class="set-actions">
                <button
                  type="button"
                  class="instruction-card-button"
                  @click.stop="viewInstructionsFromStore(set)"
                >
                  설명서 보기
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="totalPages > 1" class="pagination">
          <button
            class="pagination-button"
            :class="{ disabled: currentPage === 1 }"
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
          >
            이전
          </button>
          <div class="pagination-numbers">
            <span
              v-for="page in visiblePages"
              :key="page"
            >
              <button
                v-if="page !== '...'"
                class="pagination-number"
                :class="{ active: page === currentPage }"
                @click="goToPage(page)"
              >
                {{ page }}
              </button>
              <span v-else class="pagination-ellipsis">...</span>
            </span>
          </div>
          <button
            class="pagination-button"
            :class="{ disabled: currentPage === totalPages }"
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
          >
            다음
          </button>
        </div>
      </div>

      <div v-if="instructionLoading" class="loading-state">로딩 중...</div>
      <div v-else-if="instructionError" class="error-state">{{ instructionError }}</div>
      <div v-else-if="!instructionLoading && selectedSet && instructions.length === 0" class="empty-state">설명서를 찾을 수 없습니다.</div>
      <div v-if="!instructionLoading && instructions.length > 0" class="instructions-section">
        <div class="instructions-header">
          <h2>설명서 목록</h2>
          <p>{{ instructions.length }}개 설명서를 찾았습니다.</p>
        </div>
        <div class="instructions-grid">
          <div
            v-for="instruction in instructions"
            :key="instruction.id"
            class="instruction-card"
          >
              <div v-if="instruction.thumbnail" class="instruction-thumbnail">
                <img
                  :src="instruction.thumbnail"
                  :alt="instruction.title"
                  @error="handleThumbnailError"
                />
              </div>
            <div v-else class="instruction-thumbnail-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
              <div class="instruction-info">
                <h3 class="instruction-title">{{ instruction.title }}</h3>
                <p v-if="instruction.description" class="instruction-description">{{ instruction.description }}</p>
                <div class="instruction-meta">
                <span v-if="instruction.source" class="instruction-source">{{ instruction.source }}</span>
                <span v-if="instruction.fileSize" class="instruction-size">{{ instruction.fileSize }}</span>
              </div>
            </div>
            <div class="instruction-actions">
              <a
                class="download-button"
                :href="instruction.url"
                target="_blank"
                rel="noopener"
              >
                다운로드
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'
import { formatSetNumber } from '../utils/setDisplay'

export default {
  name: 'SetInstructions',
  setup() {
    const { supabase, user, loading: supabaseAuthLoading } = useSupabase()
    const { getStoreInfoByEmail, getStoreInventory } = useSupabasePleyon()

    const loading = ref(false)
    const instructionLoading = ref(false)
    const instructionError = ref(null)
    const instructions = ref([])
    const setSearchQuery = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0)
    const selectedSet = ref(null)
    const selectedSetId = ref('')
    const showSetDropdown = ref(false)
    const setDropdownRef = ref(null)
    const searchInputRef = ref(null)

    const storeInventory = ref([])
    const storeInfo = ref(null)
    const paginatedStoreSetsData = ref([]) // 현재 페이지 데이터
    const storeInventorySetsCache = ref([]) // 플레이온 계정용 전체 세트 캐시 // 🔧 수정됨
    let storeInventoryCachePromise = null // 🔧 수정됨
    const storeInventoryCacheReady = ref(false) // 🔧 수정됨
    const storeSetsCountValue = ref(0)
    const currentPage = ref(1)
    const itemsPerPage = 40
    
    // 일반회원용 레고 세트 (user_lego_sets)
    const userLegoSets = ref([])
    const isPleyonUser = ref(false)
    
    // 중복 로드 방지
    const isLoadingStoreSets = ref(false)
    const activeInstructionStoreLoad = ref(null)
    
    // 검색 옵션: true = 해당 매장에서 보유한 레고에서 검색, false = 전체 레고에서 검색
    // 로그아웃 상태에서는 "전체 레고"가 기본값
    const searchInStoreOnly = ref(user.value ? true : false)
    
    // 토글 스위치에 따라 필터링된 레고 세트
    const storeSets = computed(() => paginatedStoreSetsData.value)
    const storeSetsCount = computed(() => storeSetsCountValue.value) // 🔧 수정됨
    
    // 매장 인벤토리 세트 번호 Set (필터링용)
    const inventorySetNumbers = computed(() => {
      try {
        const setNumbers = new Set()
        
        // 일반회원인 경우: user_lego_sets의 세트 번호 사용
        if (!isPleyonUser.value && userLegoSets.value && userLegoSets.value.length > 0) {
          userLegoSets.value.forEach(item => {
            const setNum = item.set_num
            if (setNum) {
              setNumbers.add(setNum)
              // 하이픈 제거한 버전도 추가
              const normalized = setNum.replace(/-.*$/, '')
              if (normalized !== setNum) {
                setNumbers.add(normalized)
              }
            }
          })
          console.log('[SetInstructions] 일반회원 레고 세트 번호 생성 완료:', setNumbers.size, '개')
          return setNumbers
        }
        
        // 플레이온 동기화 계정인 경우: 플레이온 인벤토리 사용
        console.log('[SetInstructions] inventorySetNumbers computed 실행:', { 
          storeInventoryLength: storeInventory.value?.length || 0,
          isArray: Array.isArray(storeInventory.value)
        })
        if (storeInventory.value && Array.isArray(storeInventory.value) && storeInventory.value.length > 0) {
          storeInventory.value.forEach(item => {
            // getStoreInventory는 lego_sets.number를 반환함
            const setNum = item.lego_sets?.number || item.set_num
            if (setNum) {
              setNumbers.add(setNum)
              // 하이픈 제거한 버전도 추가
              const normalized = setNum.replace(/-.*$/, '')
              if (normalized !== setNum) {
                setNumbers.add(normalized)
              }
            }
          })
          console.log('[SetInstructions] inventorySetNumbers 생성 완료:', setNumbers.size, '개')
        } else {
          console.log('[SetInstructions] inventorySetNumbers: storeInventory가 비어있음')
        }
        return setNumbers
      } catch (error) {
        console.error('[SetInstructions] inventorySetNumbers computed error:', error)
        return new Set()
      }
    })

    const inventorySetNumbersList = computed(() => {
      if (!storeInventory.value || !Array.isArray(storeInventory.value)) {
        return []
      }
      const seen = new Set()
      const list = []
      storeInventory.value.forEach(item => {
        const setNum = item?.lego_sets?.number || item?.set_num
        if (setNum && !seen.has(setNum)) {
          seen.add(setNum)
          list.push(setNum)
        }
      })
      return list
    })

    const GENERAL_LIST_CACHE_KEY = 'brickbox:set-instructions:general-list-cache:v1' // 🔧 수정됨
    const GENERAL_LIST_CACHE_TTL = 2 * 60 * 1000 // 2분 // 🔧 수정됨

    const loadGeneralListCache = () => { // 🔧 수정됨
      try {
        const raw = sessionStorage.getItem(GENERAL_LIST_CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return null
        if (Date.now() - (parsed.timestamp || 0) > GENERAL_LIST_CACHE_TTL) {
          sessionStorage.removeItem(GENERAL_LIST_CACHE_KEY)
          return null
        }
        return parsed
      } catch {
        return null
      }
    }

    const cacheGeneralList = (payload) => { // 🔧 수정됨
      try {
        sessionStorage.setItem(
          GENERAL_LIST_CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            data: payload.data || [],
            count: payload.count || 0
          })
        )
      } catch {}
    }

    const applyGeneralListCache = () => { // 🔧 수정됨
      const cached = loadGeneralListCache()
      if (!cached || !Array.isArray(cached.data)) {
        return false
      }
      storeSetsCountValue.value = cached.count || cached.data.length
      paginatedStoreSetsData.value = cached.data
      loading.value = false
      return true
    }

    const waitForAuthReady = () => {
      if (!supabaseAuthLoading.value) {
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        const stop = watch(
          supabaseAuthLoading,
          (isLoading) => {
            if (!isLoading) {
              stop()
              resolve()
            }
          },
          { immediate: false }
        )
      })
    }

    // 매장 세트 번호 정규화 유틸 // 🔧 수정됨
    const sanitizeSetNum = (value) => {
      if (value === null || value === undefined) return ''
      return String(value).trim()
    }

    const stripVariantSuffix = (value) => {
      const sanitized = sanitizeSetNum(value)
      return sanitized ? sanitized.replace(/-.*$/, '') : ''
    }

    const buildSetNumFilterClauses = (setNums = []) => {
      const unique = [...new Set((setNums || []).map(sanitizeSetNum).filter(Boolean))]
      if (unique.length === 0) return ''
      return unique
        .map((num) => (num.includes('-') ? `set_num.eq.${num}` : `set_num.ilike.${num}-%`))
        .join(',')
    }

    const buildSetLookupMaps = (sets = []) => {
      const exactMap = new Map()
      const normalizedMap = new Map()
      ;(sets || []).forEach((set) => {
        const key = sanitizeSetNum(set?.set_num)
        if (!key) return
        exactMap.set(key, set)
        const normalized = stripVariantSuffix(key)
        if (normalized && !normalizedMap.has(normalized)) {
          normalizedMap.set(normalized, set)
        }
      })
      return { exactMap, normalizedMap }
    }

    const resolveInventorySetRecord = (setNum, maps) => {
      const key = sanitizeSetNum(setNum)
      if (!key) return null
      if (maps?.exactMap?.has(key)) {
        return maps.exactMap.get(key)
      }
      const normalized = stripVariantSuffix(key)
      if (normalized && maps?.normalizedMap?.has(normalized)) {
        return maps.normalizedMap.get(normalized)
      }
      return null
    }

    // 첫 페이지 우선 로드 함수
    const loadFirstPageStoreSets = async (start, end) => {
      if (!isPleyonUser.value) {
        return null
      }
      
      const inventoryList = inventorySetNumbersList.value
      if (!inventoryList || inventoryList.length === 0) {
        return { items: [], totalCount: 0 }
      }
      
      const unique = [...new Set(inventoryList.map(sanitizeSetNum).filter(Boolean))]
      if (unique.length === 0) {
        return { items: [], totalCount: 0 }
      }
      
      // 정확한 매칭과 패턴 매칭을 분리
      const exactMatches = unique.filter(num => num.includes('-'))
      const patternMatches = unique.filter(num => !num.includes('-'))
      
      // 첫 페이지에 필요한 만큼만 조회 (정확한 매칭 우선, 여유분 증가로 매칭 성공률 향상)
      const neededCount = Math.min((end - start) * 2, unique.length) // 더 많은 여유분
      const firstBatchExact = exactMatches.slice(0, Math.min(neededCount, exactMatches.length))
      const firstBatchPattern = patternMatches.slice(0, Math.min(neededCount - firstBatchExact.length, patternMatches.length))
      
      const allResults = []
      
      // 병렬 처리: 정확한 매칭과 패턴 매칭을 동시에 실행
      const promises = []
      
      if (firstBatchExact.length > 0) {
        const batchClauses = firstBatchExact.map(num => `set_num.eq.${num}`).join(',')
        promises.push(
          supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .or(batchClauses)
        )
      }
      
      if (firstBatchPattern.length > 0) {
        const batchClauses = firstBatchPattern.map(num => `set_num.ilike.${num}-%`).join(',')
        promises.push(
          supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .or(batchClauses)
        )
      }
      
      if (promises.length > 0) {
        const results = await Promise.all(promises)
        results.forEach(result => {
          if (!result.error && result.data) {
            allResults.push(...result.data)
          }
        })
      }
      
      // 중복 제거
      const dataMap = new Map()
      allResults.forEach(set => {
        if (set && set.set_num) {
          const key = sanitizeSetNum(set.set_num)
          if (key && !dataMap.has(key)) {
            dataMap.set(key, set)
          }
        }
      })
      const data = Array.from(dataMap.values())
      
      // 테마 정보는 필요한 만큼만 조회
      const themeIds = [...new Set(data.map(set => set.theme_id).filter(Boolean))]
      const missingThemeIds = themeIds.filter(id => !themeCache.has(id))
      
      if (missingThemeIds.length > 0) {
        const { data: themesData } = await supabase
          .from('lego_themes')
          .select('theme_id, name')
          .in('theme_id', missingThemeIds)
        
        if (themesData) {
          themesData.forEach(theme => {
            themeCache.set(theme.theme_id, theme.name)
          })
        }
      }
      
      // 캐시된 테마 정보로 세트 데이터 보강
      const enriched = data.map(set => ({
        ...set,
        theme_name: set.theme_id ? (themeCache.get(set.theme_id) || null) : null
      }))
      
      // 빠른 매칭: Map 기반 O(1) 조회로 최적화
      const setMaps = buildSetLookupMaps(enriched)
      const matchedSetsMap = new Map()
      
      // 인벤토리 리스트를 순회하면서 매칭 (필요한 만큼만, 중복 제거)
      for (let i = 0; i < inventoryList.length && matchedSetsMap.size < end; i++) {
        const setNum = inventoryList[i]
        const matched = resolveInventorySetRecord(setNum, setMaps)
        if (matched) {
          const key = sanitizeSetNum(setNum)
          if (key && !matchedSetsMap.has(key)) {
            matchedSetsMap.set(key, mapSetRecord(matched))
          }
        }
      }
      
      const matchedSets = Array.from(matchedSetsMap.values())
      
      // 전체 개수는 인벤토리 리스트 길이로 설정 (정확한 개수는 백그라운드에서 계산)
      return {
        items: matchedSets.slice(start, end),
        totalCount: inventoryList.length
      }
    }
    
    const rebuildStoreInventoryCache = async () => {
      // 캐시가 이미 있고 유효하면 재사용
      if (storeInventoryCacheReady.value && storeInventorySetsCache.value.length > 0) {
        return
      }
      
      if (storeInventoryCachePromise) {
        await storeInventoryCachePromise
        return
      }
      
      storeInventoryCachePromise = (async () => {
        if (!isPleyonUser.value) {
          storeInventorySetsCache.value = []
          storeInventoryCacheReady.value = false
          return
        }
        
        const inventoryList = inventorySetNumbersList.value
        if (!inventoryList || inventoryList.length === 0) {
          storeInventorySetsCache.value = []
          storeInventoryCacheReady.value = true
          return
        }
        
        storeInventoryCacheReady.value = false
        const filterClauses = buildSetNumFilterClauses(inventoryList)
        if (!filterClauses) {
          storeInventorySetsCache.value = []
          storeInventoryCacheReady.value = true
          return
        }
        
        try {
          // 세트 조회: OR 조건이 많을 경우 배치로 나누어 처리
          const unique = [...new Set(inventoryList.map(sanitizeSetNum).filter(Boolean))]
          if (unique.length === 0) {
            storeInventorySetsCache.value = []
            storeInventoryCacheReady.value = true
            return
          }
          
          // 정확한 매칭과 패턴 매칭을 분리
          const exactMatches = unique.filter(num => num.includes('-'))
          const patternMatches = unique.filter(num => !num.includes('-'))
          
          const allResults = []
          const BATCH_SIZE = 50 // Supabase OR 조건 제한을 고려한 배치 크기
          
          // 병렬 처리: 모든 배치를 동시에 실행
          const allPromises = []
          
          // 정확한 매칭 처리 (병렬)
          if (exactMatches.length > 0) {
            for (let i = 0; i < exactMatches.length; i += BATCH_SIZE) {
              const batch = exactMatches.slice(i, i + BATCH_SIZE)
              const batchClauses = batch.map(num => `set_num.eq.${num}`).join(',')
              allPromises.push(
                supabase
                  .from('lego_sets')
                  .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
                  .or(batchClauses)
              )
            }
          }
          
          // 패턴 매칭 처리 (병렬)
          if (patternMatches.length > 0) {
            for (let i = 0; i < patternMatches.length; i += BATCH_SIZE) {
              const batch = patternMatches.slice(i, i + BATCH_SIZE)
              const batchClauses = batch.map(num => `set_num.ilike.${num}-%`).join(',')
              allPromises.push(
                supabase
                  .from('lego_sets')
                  .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
                  .or(batchClauses)
              )
            }
          }
          
          // 모든 배치를 병렬로 실행
          if (allPromises.length > 0) {
            const results = await Promise.all(allPromises)
            results.forEach(result => {
              if (!result.error && result.data) {
                allResults.push(...result.data)
              } else if (result.error) {
                throw result.error
              }
            })
          }
          
          // 중복 제거
          const dataMap = new Map()
          allResults.forEach(set => {
            if (set && set.set_num) {
              const key = sanitizeSetNum(set.set_num)
              if (key && !dataMap.has(key)) {
                dataMap.set(key, set)
              }
            }
          })
          const data = Array.from(dataMap.values())
          
          // 테마 정보는 캐시에서 먼저 확인하고, 없으면 배치로 조회
          const themeIds = [...new Set((data || []).map(set => set.theme_id).filter(Boolean))]
          const missingThemeIds = themeIds.filter(id => !themeCache.has(id))
          
          if (missingThemeIds.length > 0) {
            const { data: themesData } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .in('theme_id', missingThemeIds)
            
            if (themesData) {
              themesData.forEach(theme => {
                themeCache.set(theme.theme_id, theme.name)
              })
            }
          }
          
          // 캐시된 테마 정보로 세트 데이터 보강
          const enriched = (data || []).map(set => ({
            ...set,
            theme_name: set.theme_id ? (themeCache.get(set.theme_id) || null) : null
          }))
          
          const setMaps = buildSetLookupMaps(enriched)
          
          storeInventorySetsCache.value = inventoryList
            .map(setNum => {
              const matched = resolveInventorySetRecord(setNum, setMaps)
              return matched ? mapSetRecord(matched) : null
            })
            .filter(Boolean)
          
          storeInventoryCacheReady.value = true
        } catch (cacheError) {
          console.error('[SetInstructions] 매장 세트 캐시 생성 실패:', cacheError)
          storeInventorySetsCache.value = []
          storeInventoryCacheReady.value = true
        }
      })()
      
      try {
        await storeInventoryCachePromise
      } finally {
        storeInventoryCachePromise = null
      }
    }

    const hasUserRegisteredSets = computed(() => (userLegoSets.value?.length || 0) > 0)

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'

    const DEFAULT_THUMBNAIL = 'https://www.lego.com/cdn/product-assets/product.bi.core.img/6602638.png?format=webply&fit=crop&quality=75&width=230&height=230&dpr=1'

    // 테마 정보 전역 캐시 (재사용)
    const themeCache = new Map()
    
    const attachThemeNamesToSets = async (sets) => {
      if (!sets || sets.length === 0) return []
      
      // 이미 theme_name이 있거나 lego_themes가 있으면 그대로 반환
      const normalizedSets = sets.map(set => {
        if (set.theme_name) return set
        if (set.lego_themes && set.lego_themes.name) {
          const { lego_themes, ...rest } = set
          return {
            ...rest,
            theme_name: lego_themes.name
          }
        }
        return set
      })
      
      // 캐시에서 먼저 확인
      const themeIds = [...new Set(normalizedSets.filter(set => !set.theme_name).map(set => set.theme_id).filter(Boolean))]
      if (themeIds.length === 0) {
        return normalizedSets.map(set => ({ ...set, theme_name: set.theme_name || null }))
      }
      
      // 캐시에 없는 테마만 조회
      const missingThemeIds = themeIds.filter(id => !themeCache.has(id))
      
      if (missingThemeIds.length > 0) {
        const { data: themesData, error: themesError } = await supabase
          .from('lego_themes')
          .select('theme_id, name')
          .in('theme_id', missingThemeIds)
        
        if (!themesError && themesData) {
          themesData.forEach(theme => {
            themeCache.set(theme.theme_id, theme.name)
          })
        }
      }
      
      // 캐시된 테마 정보로 보강
      return normalizedSets.map(set => ({
        ...set,
        theme_name: set.theme_id ? (themeCache.get(set.theme_id) || set.theme_name || null) : (set.theme_name || null)
      }))
    }

    const mapSetRecord = (set) => {
      if (!set) return null
      let imageUrl = null
      if (set.webp_image_url && !set.webp_image_url.includes('cdn.rebrickable.com')) {
        imageUrl = set.webp_image_url
      } else if (set.set_img_url && !set.set_img_url.includes('cdn.rebrickable.com')) {
        imageUrl = set.set_img_url
      } else if (set.image_url) {
        imageUrl = set.image_url
      }
      return {
        id: set.id,
        set_num: set.set_num,
        name: set.name,
        theme_name: set.theme_name || null,
        image_url: imageUrl,
        webp_image_url: set.webp_image_url || null,
        set_img_url: set.set_img_url || null,
        num_parts: set.num_parts || 0,
        part_count: set.part_count || set.num_parts || 0,
        quantity: set.quantity || 0
      }
    }

    const loadPaginatedStoreSets = async () => {
      if (activeInstructionStoreLoad.value) {
        await activeInstructionStoreLoad.value
      }

      const start = (currentPage.value - 1) * itemsPerPage
      const end = start + itemsPerPage - 1

      const loadTask = (async () => {
        isLoadingStoreSets.value = true
        loading.value = true

        try {
          if (searchInStoreOnly.value) {
            if (!user.value) {
              paginatedStoreSetsData.value = []
              storeSetsCountValue.value = 0
              return
            }

            if (hasUserRegisteredSets.value) {
              storeSetsCountValue.value = userLegoSets.value.length
              paginatedStoreSetsData.value = userLegoSets.value
                .slice(start, start + itemsPerPage)
                .map(mapSetRecord)
                .filter(Boolean)
              return
            }

            if (!isPleyonUser.value) {
              storeSetsCountValue.value = 0
              paginatedStoreSetsData.value = []
              return
            }

            // 캐시가 이미 있으면 즉시 사용
            if (storeInventoryCacheReady.value && storeInventorySetsCache.value.length > 0) {
              storeSetsCountValue.value = storeInventorySetsCache.value.length
              paginatedStoreSetsData.value = storeInventorySetsCache.value
                .slice(start, start + itemsPerPage)
              return
            }
            
            // 첫 페이지 우선 로드: 필요한 페이지만 먼저 조회하고 즉시 표시
            const firstPageData = await loadFirstPageStoreSets(start, start + itemsPerPage)
            if (firstPageData) {
              paginatedStoreSetsData.value = firstPageData.items
              storeSetsCountValue.value = firstPageData.totalCount
            }
            
            // 나머지 데이터는 백그라운드에서 캐시 빌드 (이미 진행 중이면 스킵)
            if (!storeInventoryCachePromise) {
              rebuildStoreInventoryCache().catch(err => {
                console.error('[SetInstructions] 백그라운드 캐시 빌드 실패:', err)
              })
            }
            return
          }

          // 첫 페이지는 캐시 우선 확인
          if (currentPage.value === 1) {
            const cacheApplied = applyGeneralListCache()
            if (cacheApplied) {
              return
            }
          }

          // 데이터와 카운트를 병렬로 조회
          const [dataResult, countResult] = await Promise.all([
            supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
              .order('created_at', { ascending: false })
              .range(start, end),
            supabase
              .from('lego_sets')
              .select('*', { count: 'exact', head: true })
          ])

          if (dataResult.error) throw dataResult.error
          if (countResult.error) throw countResult.error

          const enriched = await attachThemeNamesToSets(dataResult.data || [])
          const mapped = enriched.map(mapSetRecord).filter(Boolean)
          paginatedStoreSetsData.value = mapped
          storeSetsCountValue.value = countResult.count || 0

          if (currentPage.value === 1) {
            cacheGeneralList({ data: mapped, count: storeSetsCountValue.value })
          }
        } catch (err) {
          console.error('[SetInstructions] 레고 세트 로드 실패:', err)
          paginatedStoreSetsData.value = []
          if (!searchInStoreOnly.value) {
            storeSetsCountValue.value = 0
          }
        } finally {
          loading.value = false
          isLoadingStoreSets.value = false
        }
      })()

      activeInstructionStoreLoad.value = loadTask
      try {
        await loadTask
      } finally {
        activeInstructionStoreLoad.value = null
      }
    }

    const deriveThumbnailFromPdfUrl = (pdfUrl) => {
      if (!pdfUrl) return null
      const match = pdfUrl.match(/product\.bi\.core\.pdf\/(\d+)\.pdf/i)
      if (!match) return null
      const assetId = match[1]
      return `https://www.lego.com/cdn/product-assets/product.bi.core.img/${assetId}.png?format=webply&fit=crop&quality=75&width=230&height=230&dpr=1`
    }

    // 간단한 메모리 캐시 (세트 번호별로 캐싱)
    const instructionCache = new Map()
    const setSearchCache = new Map()
    const CACHE_TTL = 5 * 60 * 1000 // 5분

    const fetchLegoInstructionsFromWeb = async (setNum, fallbackThumbnail = null) => { // 🔧 수정됨
      // 캐시 확인
      const cacheKey = `${setNum}-${fallbackThumbnail || ''}`
      const cached = instructionCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('[SetInstructions] 캐시에서 설명서 로드:', setNum)
        return cached.data
      }

      // 한국 사용자를 위해 ko-kr을 우선 시도
      const locales = ['ko-kr', 'en-au', 'en-us', 'en-gb']
      
      // 모든 요청을 취소하기 위한 AbortController
      const globalController = new AbortController()
      let firstSuccess = null
      
      // 각 로케일별 fetch 함수 정의
      const fetchLocale = async (locale) => {
        if (firstSuccess) return null // 이미 성공한 경우 즉시 종료
        
        const legoPath = `${locale}/service/buildinginstructions/${setNum}`
        const proxyUrl = `/api/lego-instructions/${legoPath}`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000) // 타임아웃 4초로 단축
        
        try {
          // 이미 성공한 경우 요청 취소
          if (firstSuccess || globalController.signal.aborted) {
            clearTimeout(timeoutId)
            return null
          }
          
          // globalController가 취소되었는지 확인
          if (globalController.signal.aborted) {
            clearTimeout(timeoutId)
            return null
          }
          
          console.log(`[SetInstructions] fetchLocale 시작:`, {
            locale,
            setNum,
            proxyUrl,
            fullUrl: window.location.origin + proxyUrl,
            isDev: import.meta.env.DEV,
            isProd: import.meta.env.PROD,
            mode: import.meta.env.MODE
          })
          
          const response = await fetch(proxyUrl, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
          })
          
          console.log(`[SetInstructions] fetchLocale 응답:`, {
            locale,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries())
          })
          
          // 응답 받은 후에도 취소 확인
          if (globalController.signal.aborted) {
            clearTimeout(timeoutId)
            return null
          }

            if (!response.ok) {
              clearTimeout(timeoutId)
              const errorText = await response.text().catch(() => '응답 본문 읽기 실패')
              console.error(`[SetInstructions] fetchLocale 실패:`, {
                locale,
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 500),
                url: response.url
              })
              return null
            }

            const contentType = response.headers.get('content-type') || ''
            const html = await response.text()
            
            // BrickBox index.html이 반환된 경우 감지
            if (html.includes('BrickBox') && html.includes('@vite/client')) {
              clearTimeout(timeoutId)
              return null
            }
            
            // JSON 에러 응답인 경우 처리
            if (contentType.includes('application/json') || (html.length < 1000 && html.trim().startsWith('{'))) {
              clearTimeout(timeoutId)
              return null
            }
            
            // HTML이 너무 짧으면 에러일 가능성 (빠른 검증)
            if (html.length < 1000) {
              clearTimeout(timeoutId)
              return null
            }
            
            // 이미 성공한 경우 중단
            if (firstSuccess) {
              clearTimeout(timeoutId)
              return null
            }

            // window.__INITIAL_STATE__ 에서 설명서 정보 추출 (가장 빠른 방법)
            const instructionEntries = []
            const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s)
            if (initialStateMatch) {
              try {
                const stateData = JSON.parse(initialStateMatch[1])
                const candidates = stateData?.instructions || stateData?.buildingInstructions || stateData?.product?.instructions || []
                if (Array.isArray(candidates) && candidates.length > 0) {
                  candidates.forEach((inst, index) => {
                    const url = inst?.url || inst?.pdfUrl || inst?.downloadUrl || inst?.pdf || null
                    if (!url || !url.includes('.pdf')) return
                    const pdfUrl = url.startsWith('http') ? url : `https://www.lego.com${url}`
                    const resolvedThumbnail = inst?.thumbnail || inst?.image || inst?.thumbnailUrl || deriveThumbnailFromPdfUrl(pdfUrl) || fallbackThumbnail || DEFAULT_THUMBNAIL
                    instructionEntries.push({
                      id: pdfUrl || `instruction-${index}`,
                      title: inst?.title || inst?.name || `Building Instructions ${setNum} - Part ${index + 1}`,
                      description: inst?.description || null,
                      url: pdfUrl,
                      thumbnail: resolvedThumbnail,
                      source: 'LEGO.com',
                      fileSize: inst?.fileSize || null
                    })
                  })
                }
              } catch (err) {
                // 파싱 실패 시 무시
              }
            }

            if (instructionEntries.length > 0) {
              clearTimeout(timeoutId)
              firstSuccess = { locale, data: instructionEntries }
              globalController.abort() // 나머지 요청 취소
              return firstSuccess
            }

            // 빠른 PDF URL 추출 (정규식만 사용, 가장 빠른 대안)
            const pdfRegex = /https?:\/\/[^"'\\s]*\/cdn\/product-assets\/product\.bi\.core\.pdf\/\d+\.pdf/gi
            const matches = html.match(pdfRegex)
            let urls = matches ? [...new Set(matches)] : []

            if (urls.length === 0) {
              // 상대 경로 시도
              const relativeRegex = /\/cdn\/product-assets\/product\.bi\.core\.pdf\/\d+\.pdf/gi
              const relativeMatches = html.match(relativeRegex)
              urls = relativeMatches ? relativeMatches.map(m => `https://www.lego.com${m}`) : []
            }

            if (urls.length === 0) {
              // 더 넓은 패턴 시도 (마지막 수단)
              const broadRegex = /https?:\/\/[^"'\\s]*\/cdn\/product-assets\/[^"'\\s]*\.pdf/gi
              const broadMatches = html.match(broadRegex)
              urls = broadMatches ? [...new Set(broadMatches)] : []
            }

            const uniqueUrls = [...new Set(urls)]
            if (uniqueUrls.length > 0) {
              const result = uniqueUrls.map((url, index) => {
                const derivedThumbnail = deriveThumbnailFromPdfUrl(url) || fallbackThumbnail || DEFAULT_THUMBNAIL
                return {
                  id: `${setNum}-pdf-${index}`,
                  title: `Building Instructions ${setNum} - Part ${index + 1}`,
                  description: null,
                  url,
                  thumbnail: derivedThumbnail,
                  source: 'LEGO.com',
                  fileSize: null
                }
              })

              clearTimeout(timeoutId)
              firstSuccess = { locale, data: result }
              globalController.abort() // 나머지 요청 취소
              return firstSuccess
            }
            
            clearTimeout(timeoutId)
            return null
          } catch (fetchErr) {
            clearTimeout(timeoutId)
            return null
          }
        }

      try {
        // 모든 로케일을 병렬로 시도하되, 첫 번째 성공 시 즉시 반환
        const promises = locales.map(locale => fetchLocale(locale))
        
        // Promise.race로 첫 번째 완료된 결과 확인 (성공/실패 무관)
        const raceResult = await Promise.race(promises)
        
        // 첫 번째 성공한 결과가 있으면 즉시 반환
        if (firstSuccess || (raceResult && raceResult.data && raceResult.data.length > 0)) {
          const successResult = firstSuccess || raceResult
          // 캐시에 저장
          instructionCache.set(cacheKey, {
            data: successResult.data,
            timestamp: Date.now()
          })
          console.log(`[SetInstructions] Locale ${successResult.locale}에서 설명서 찾음:`, successResult.data.length, '개')
          return successResult.data
        }
        
        // 첫 번째 결과가 실패했을 경우, 나머지 결과 확인 (이미 취소되었을 수 있음)
        const results = await Promise.allSettled(promises)
        for (const settled of results) {
          if (settled.status === 'fulfilled' && settled.value && settled.value.data && settled.value.data.length > 0) {
            // 캐시에 저장
            instructionCache.set(cacheKey, {
              data: settled.value.data,
              timestamp: Date.now()
            })
            console.log(`[SetInstructions] Locale ${settled.value.locale}에서 설명서 찾음:`, settled.value.data.length, '개')
            return settled.value.data
          }
        }

        // 모든 로케일에서 실패
        console.warn('[SetInstructions] 모든 로케일에서 설명서를 찾지 못함:', setNum)
        return []
      } catch (err) {
        if (err.name === 'AbortError') {
          // AbortError는 정상적인 취소일 수 있으므로, firstSuccess 확인
          if (firstSuccess) {
            instructionCache.set(cacheKey, {
              data: firstSuccess.data,
              timestamp: Date.now()
            })
            return firstSuccess.data
          }
          throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
        }
        throw err
      }
    }

    const createManualSetFromQuery = (query) => { // 🔧 수정됨
      const value = String(query || '').trim()
      if (!value) return null
      return {
        id: `manual-${value}`,
        set_num: value,
        name: null,
        theme_name: null,
        num_parts: null,
        part_count: null,
        webp_image_url: null,
        set_img_url: null
      }
    }

    const resolvePartCount = (set) => { // 🔧 수정됨
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
      instructions.value = []
      instructionError.value = null
    }

    // 플레이온 계정 확인 (loadStoreInventoryData와 통합하여 중복 호출 방지)
    const checkPleyonAccount = async () => {
      if (!user.value) {
        isPleyonUser.value = false
        storeInfo.value = null
        return
      }

      // loadStoreInventoryData가 이미 호출되었거나 호출 중이면 그 결과 사용
      if (loadStoreInventoryDataPromise) {
        await loadStoreInventoryDataPromise
        isPleyonUser.value = !!storeInfo.value
        return
      }
      
      if (storeInfo.value && lastLoadedEmail === user.value.email) {
        isPleyonUser.value = true
        return
      }

      // loadStoreInventoryData 호출하여 매장 정보와 인벤토리 동시에 로드
      await loadStoreInventoryData()
      isPleyonUser.value = !!storeInfo.value
    }

    // 일반회원용 레고 세트 로드
    const loadUserLegoSets = async () => {
      if (!user.value) {
        userLegoSets.value = []
        return
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('user_lego_sets')
          .select('*')
          .eq('user_id', user.value.id)
          .order('created_at', { ascending: false })

        if (fetchError) {
          console.error('[SetInstructions] 일반회원 레고 세트 로드 실패:', fetchError)
          userLegoSets.value = []
          return
        }

        userLegoSets.value = data || []
        console.log('[SetInstructions] 일반회원 레고 세트 로드 완료:', userLegoSets.value.length, '개')
      } catch (err) {
        console.error('[SetInstructions] 일반회원 레고 세트 로드 오류:', err)
        userLegoSets.value = []
      }
    }

    // 매장 인벤토리 로드 (중복 호출 방지)
    let loadStoreInventoryDataPromise = null
    let lastLoadedEmail = null
    
    const loadStoreInventoryData = async () => {
      // 중복 호출 방지: 같은 이메일로 이미 로딩 중이면 대기
      if (loadStoreInventoryDataPromise) {
        await loadStoreInventoryDataPromise
        return
      }
      
      // 이미 로드된 데이터가 있고 이메일이 같으면 스킵
      if (storeInfo.value && lastLoadedEmail === user.value?.email) {
        return
      }
      
      if (!user.value || !user.value.email) {
        storeInfo.value = null
        storeInventory.value = []
        lastLoadedEmail = null
        return
      }

      loadStoreInventoryDataPromise = (async () => {
        try {
          const storeData = await getStoreInfoByEmail(user.value.email)
          lastLoadedEmail = user.value.email
          
          if (storeData && storeData.store) {
            isPleyonUser.value = true
            storeInfo.value = storeData
            const inventoryData = await getStoreInventory(storeData.store.id)
            storeInventory.value = inventoryData || []
          } else {
            isPleyonUser.value = false
            storeInfo.value = null
            storeInventory.value = []
            storeInventorySetsCache.value = []
            storeInventoryCacheReady.value = false
            await loadUserLegoSets()
          }
        } catch (err) {
          console.error('[SetInstructions] 매장 인벤토리 로드 실패:', err)
          isPleyonUser.value = false
          storeInfo.value = null
          storeInventory.value = []
          storeInventorySetsCache.value = []
          storeInventoryCacheReady.value = false
          await loadUserLegoSets()
        } finally {
          loadStoreInventoryDataPromise = null
        }
      })()
      
      await loadStoreInventoryDataPromise
    }
    
    const loadStoreInventory = async () => {
      await loadStoreInventoryData()
      await loadPaginatedStoreSets()
    }

    const totalPages = computed(() => Math.max(1, Math.ceil(storeSetsCount.value / itemsPerPage)))

    const paginatedStoreSets = computed(() => storeSets.value)

    const visiblePages = computed(() => {
      const pages = []
      const total = totalPages.value
      const current = currentPage.value

      if (total <= 7) {
        for (let i = 1; i <= total; i++) {
          pages.push(i)
        }
      } else if (current <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(total)
      } else if (current >= total - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = total - 4; i <= total; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = current - 1; i <= current + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(total)
      }

      return pages
    })

    const goToPage = (page) => {
      if (typeof page !== 'number') return
      if (page < 1 || page > totalPages.value || page === currentPage.value) return
      currentPage.value = page
    }

    const showStoreSetsSection = computed(() => {
      return (
        !loading.value &&
        !instructionLoading.value &&
        !setSearchQuery.value.trim() &&
        !selectedSetId.value &&
        storeSets.value.length > 0
      )
    })

    const viewInstructionsFromStore = (set) => {
      if (!set) return
      const normalizedSet = {
        ...set,
        webp_image_url: set.webp_image_url || set.image_url || null,
        set_img_url: set.set_img_url || set.image_url || null
      }
      handleSelectSet(normalizedSet)
    }

    const getSetNumberForApi = (setNum) => { // 🔧 수정됨
      if (!setNum) return ''
      const value = String(setNum).trim()
      if (!value) return ''
      return value.includes('-') ? value : `${value}-1`
    }

    const formatFileSize = (bytes) => { // 🔧 수정됨
      if (!bytes || Number.isNaN(Number(bytes))) return null
      const size = Number(bytes)
      if (size < 1024) return `${size} B`
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
      if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }

    const normalizeImageUrl = (set) => { // 🔧 수정됨
      if (!set) return set
      let webpImageUrl = set.webp_image_url
      if (webpImageUrl) {
        if (!webpImageUrl.startsWith('http')) {
          if (webpImageUrl.startsWith('/storage/')) {
            webpImageUrl = `${supabaseUrl}${webpImageUrl}`
          } else if (webpImageUrl.startsWith('storage/')) {
            webpImageUrl = `${supabaseUrl}/${webpImageUrl}`
          }
        }
      } else if (set.set_img_url) {
        webpImageUrl = set.set_img_url
      }
      return {
        ...set,
        webp_image_url: webpImageUrl,
        part_count: resolvePartCount(set)
      }
    }

    const isCacheValid = (entry) => entry && (Date.now() - entry.timestamp < CACHE_TTL)

    const searchSets = async () => { // 🔧 수정됨
      if (!setSearchQuery.value.trim()) {
        searchResults.value = []
        showSetDropdown.value = false
        return
      }

      try {
        loading.value = true
        const query = setSearchQuery.value.trim()
        const mainSetNum = query.split('-')[0]
        const cacheKey = `${query}:${mainSetNum}`
        const cached = setSearchCache.get(cacheKey)
        if (isCacheValid(cached)) {
          searchResults.value = cached.data
          showSetDropdown.value = searchResults.value.length > 0
          loading.value = false
          return
        }

        let results = []

        const [exactMatchResult, mainMatchResult] = await Promise.allSettled([
          supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
          .eq('set_num', query)
            .limit(20),
          supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .eq('set_num', mainSetNum)
            .limit(20)
        ])

        const exactMatch =
          exactMatchResult.status === 'fulfilled' && !exactMatchResult.value.error
            ? exactMatchResult.value.data || []
            : []
        const mainMatch =
          mainMatchResult.status === 'fulfilled' && !mainMatchResult.value.error
            ? mainMatchResult.value.data || []
            : []

        if (exactMatch.length > 0) {
          results = exactMatch
        } else if (mainMatch.length > 0) {
            results = mainMatch
          } else {
            const { data: likeMatch, error: likeError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
              .ilike('set_num', `${mainSetNum}%`)
              .order('set_num')
              .limit(20)

            if (!likeError && likeMatch && likeMatch.length > 0) {
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

        // 검색 옵션에 따라 필터링
        if (searchInStoreOnly.value && user.value && inventorySetNumbers.value && inventorySetNumbers.value.size > 0) {
          results = results.filter(set => {
            if (!set || !set.set_num) return false
            const setNum = set.set_num
            const normalizedSetNum = setNum.replace(/-.*$/, '')
            return inventorySetNumbers.value.has(setNum) || inventorySetNumbers.value.has(normalizedSetNum)
          })
          console.log(`[SetInstructions] 매장 보유 세트 필터링: ${results.length}개`)
        }
        
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
        } else if (
          (exactMatchResult.status === 'rejected') ||
          (mainMatchResult.status === 'rejected')
        ) {
          console.warn('[SetInstructions] set 검색 실패:', {
            exact: exactMatchResult.status === 'rejected' ? exactMatchResult.reason : null,
            main: mainMatchResult.status === 'rejected' ? mainMatchResult.reason : null
          })
        }

        results = results.map(set => normalizeImageUrl(set))

        // 캐시에 저장
        setSearchCache.set(cacheKey, {
          data: results,
          timestamp: Date.now()
        })

        searchResults.value = results
        searchResultsKey.value++
        showSetDropdown.value = searchResults.value.length > 0
      } catch (err) {
        console.error('설명서용 세트 검색 실패:', err)
        searchResults.value = []
        showSetDropdown.value = false
      } finally {
        loading.value = false
      }
    }

    const fetchInstructions = async (set) => { // 🔧 수정됨
      if (!set) {
        console.warn('[SetInstructions] fetchInstructions: set이 없습니다')
        return
      }
      
      console.log('[SetInstructions] fetchInstructions 시작:', { set_num: set.set_num, set })
      instructionLoading.value = true
      instructionError.value = null
      instructions.value = []

      try {
        const mainSetNum = formatSetNumber(set.set_num)
        console.log('[SetInstructions] 포맷된 세트 번호:', mainSetNum)
        
        const fallbackThumbnail = set.webp_image_url || set.set_img_url || null
        const downloadableInstructions = await fetchLegoInstructionsFromWeb(mainSetNum, fallbackThumbnail)
        instructions.value = downloadableInstructions
        if (instructions.value.length === 0) {
          instructionError.value = '다운로드 가능한 설명서를 찾을 수 없습니다.'
        }
      } catch (err) {
        console.error('[SetInstructions] 설명서 조회 실패:', err)
        instructionError.value = err?.message || '설명서를 불러오는데 실패했습니다.'
      } finally {
        instructionLoading.value = false
        console.log('[SetInstructions] fetchInstructions 완료:', {
          instructionsCount: instructions.value.length,
          error: instructionError.value
        })
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

    const handleSearchEnter = async () => { // 🔧 수정됨
      const query = setSearchQuery.value.trim()
      if (!query) {
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
      } else {
        const manualSet = createManualSetFromQuery(query)
        if (manualSet) {
          selectedSet.value = manualSet
          selectedSetId.value = manualSet.id
          setSearchQuery.value = ''
          searchResults.value = []
          showSetDropdown.value = false
          fetchInstructions(manualSet)
        }
      }
    }

    const handleSearchBlur = () => { // 🔧 수정됨
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    const handleSelectSet = (set) => { // 🔧 수정됨
      selectedSet.value = set
      selectedSetId.value = set.id
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      fetchInstructions(set)
    }

    const handleSetImageError = (event) => { // 🔧 수정됨
      const img = event.target
      const wrapper = img.closest('.option-image-wrapper')
      if (wrapper) {
        img.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;'
        let noImageDiv = wrapper.querySelector('.option-no-image')
        if (!noImageDiv) {
          noImageDiv = document.createElement('div')
          noImageDiv.className = 'option-no-image'
          noImageDiv.textContent = '이미지 없음'
          wrapper.appendChild(noImageDiv)
        }
        noImageDiv.style.cssText = 'display: flex !important; z-index: 2 !important;'
      }
    }

    const handleSelectedSetImageError = (event) => { // 🔧 수정됨
      event.target.style.display = 'none'
      const wrapper = event.target.closest('.selected-set-thumb-wrapper')
      if (wrapper) {
        const placeholder = document.createElement('div')
        placeholder.className = 'selected-set-no-image'
        placeholder.textContent = '이미지 없음'
        wrapper.appendChild(placeholder)
      }
    }

    const handleThumbnailError = (event) => { // 🔧 수정됨
      event.target.style.display = 'none'
    }
    
    const handleSearchOptionChange = async () => {
      currentPage.value = 1
      await loadPaginatedStoreSets()
    }

    // 초기 로드 플래그
    const isInitialLoad = ref(true)
    
    watch(user, async (newUser, oldUser) => {
      // 초기 로드는 onMounted에서 처리
      if (isInitialLoad.value) {
        isInitialLoad.value = false
        return
      }
      
      // 로그인 시에는 "우리 매장"이 기본값, 로그아웃 시에는 "전체 레고"가 기본값
      if (newUser) {
        searchInStoreOnly.value = true
        // checkPleyonAccount가 loadStoreInventoryData를 내부적으로 호출하므로 중복 호출 방지
        await checkPleyonAccount()
        if (!isPleyonUser.value) {
          await loadUserLegoSets()
        }
      } else {
        searchInStoreOnly.value = false
        isPleyonUser.value = false
        userLegoSets.value = []
        storeInventory.value = []
        storeInfo.value = null
        storeInventorySetsCache.value = []
        storeInventoryCacheReady.value = false
        lastLoadedEmail = null
      }
      await loadPaginatedStoreSets()
    })
    
    // 초기 로드
    onMounted(async () => {
      await waitForAuthReady()
      if (user.value) {
        searchInStoreOnly.value = true
        // checkPleyonAccount와 첫 페이지 로드를 병렬로 시작
        const accountCheck = checkPleyonAccount()
        if (!isPleyonUser.value) {
          await accountCheck
          await loadUserLegoSets()
        }
        // 계정 확인과 동시에 첫 페이지 로드 시작 (계정 확인 완료 후 자동으로 처리됨)
        await loadPaginatedStoreSets()
      } else {
        searchInStoreOnly.value = false
        // 사용자 없을 때는 즉시 로드
        await loadPaginatedStoreSets()
      }
      isInitialLoad.value = false
    })

    watch(searchInStoreOnly, async () => {
      currentPage.value = 1
      if (searchInStoreOnly.value && isPleyonUser.value) {
        // 캐시가 없을 때만 재빌드
        if (!storeInventoryCacheReady.value || storeInventorySetsCache.value.length === 0) {
          await rebuildStoreInventoryCache()
        }
      }
      await loadPaginatedStoreSets()
    })

    watch(currentPage, async (newPage, oldPage) => {
      if (newPage === oldPage) return
      await loadPaginatedStoreSets()
    })

    let lastInventoryListLength = 0
    watch(inventorySetNumbersList, async (newList) => { // 🔧 수정됨
      // 리스트 길이가 변경되지 않았으면 스킵 (깊은 비교는 비용이 크므로 길이만 확인)
      if (newList?.length === lastInventoryListLength) {
        return
      }
      lastInventoryListLength = newList?.length || 0
      
      if (searchInStoreOnly.value && isPleyonUser.value) { // 🔧 수정됨
        storeInventoryCacheReady.value = false // 🔧 수정됨
        storeInventorySetsCache.value = [] // 🔧 수정됨
        currentPage.value = 1 // 🔧 수정됨
        await rebuildStoreInventoryCache() // 🔧 수정됨
        await loadPaginatedStoreSets() // 🔧 수정됨
      } // 🔧 수정됨
    }) // 🔧 수정됨

    watch(userLegoSets, async () => {
      if (searchInStoreOnly.value && !isPleyonUser.value) {
        currentPage.value = 1
        await loadPaginatedStoreSets()
      }
    })

    return {
      loading,
      instructionLoading,
      instructionError,
      instructions,
      setSearchQuery,
      searchResults,
      searchResultsKey,
      selectedSet,
      selectedSetId,
      showSetDropdown,
      setDropdownRef,
      formatSetNumber,
      resolvePartCount,
      handleSearchEnter,
      handleSearchBlur,
      handleSelectSet,
      searchTooltip,
      searchInputRef,
      handleSetImageError,
      handleSelectedSetImageError,
      handleThumbnailError,
      resetPage,
      storeSets,
      storeSetsCount, // 🔧 수정됨
      paginatedStoreSets,
      visiblePages,
      totalPages,
      currentPage,
      goToPage,
      showStoreSetsSection,
      viewInstructionsFromStore,
      searchInStoreOnly,
      handleSearchOptionChange,
      user,
      inventorySetNumbers
    }
  }
}
</script>

<style scoped>
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

.set-instructions-page {
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
  margin: 0;
}

.page-header p {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
  text-align: center;
}

.page-title-with-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.set-instructions-content {
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
  overflow: visible;
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
  transition: background-color 0.15s ease, color 0.15s ease;
}

.custom-select-option:hover {
  background: #f5f7ff;
}

.custom-select-option.active {
  background: #e0e7ff;
  color: #1d4ed8;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 1.5rem; /* // 🔧 수정됨 */
  width: 100%;
}

.option-image-wrapper {
  width: 80px;
  height: 80px;
  min-width: 80px;
  min-height: 80px;
  flex-shrink: 0;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.option-set-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.5rem;
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
}

.option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
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
  font-size: 0.75rem;
  color: #9ca3af;
  background: #f9fafb;
}

.selected-set-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.store-sets-section { /* // 🔧 수정됨 */
  margin-bottom: 3rem;
  width: 100%;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.result-header { /* // 🔧 수정됨 */
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.result-header h3 { /* // 🔧 수정됨 */
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.result-count { /* // 🔧 수정됨 */
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
}

.sets-grid { /* // 🔧 수정됨 */
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

@media (max-width: 1024px) {
  .sets-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

.set-card { /* // 🔧 수정됨 */
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: default;
  transition: none;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.set-card:hover { /* // 🔧 수정됨 */
  transform: none;
  box-shadow: none;
}

.set-image { /* // 🔧 수정됨 */
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.set-image img { /* // 🔧 수정됨 */
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.no-image { /* // 🔧 수정됨 */
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: center;
}

.set-info { /* // 🔧 수정됨 */
  padding: 1rem;
}

.set-name-container { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.set-number-badge { /* // 🔧 수정됨 */
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

.set-name-wrapper { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
  overflow: hidden;
}

.set-theme-name { /* // 🔧 수정됨 */
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  line-height: 1.4;
}

.set-name-divider { /* // 🔧 수정됨 */
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.875rem;
  color: #d1d5db;
  line-height: 1.4;
}

.set-name-text { /* // 🔧 수정됨 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.set-stats { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.set-quantity { /* // 🔧 수정됨 */
  font-size: 0.875rem;
  color: #3b82f6;
  font-weight: 500;
  margin: 0;
}

.inventory-badge { /* // 🔧 수정됨 */
  font-size: 0.8125rem;
  color: #1f2937;
  background: #f3f4f6;
  border-radius: 9999px;
  padding: 0.25rem 0.75rem;
  width: fit-content;
}

.set-actions { /* // 🔧 수정됨 */
  margin-top: 0.75rem;
  display: flex;
  justify-content: flex-end;
}

.instruction-card-button { /* // 🔧 수정됨 */
  padding: 0.4375rem 0.9375rem;
  background: #ffffff;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.instruction-card-button:hover { /* // 🔧 수정됨 */
  background: #f9fafb;
  border-color: #9ca3af;
  color: #111827;
}

.instruction-card-button:active { /* // 🔧 수정됨 */
  transform: scale(0.96);
}

.pagination { /* // 🔧 수정됨 */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.pagination-button { /* // 🔧 수정됨 */
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-button.disabled,
.pagination-button:disabled { /* // 🔧 수정됨 */
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-numbers { /* // 🔧 수정됨 */
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pagination-number { /* // 🔧 수정됨 */
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-number.active { /* // 🔧 수정됨 */
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.pagination-ellipsis { /* // 🔧 수정됨 */
  color: #9ca3af;
  font-size: 0.875rem;
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

.error-state {
  color: #dc2626;
}

.instructions-section {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.instructions-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}

.instructions-header p {
  margin: 0.25rem 0 0;
  color: #6b7280;
}

.instructions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.instruction-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.instruction-card:hover {
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
  transform: translateY(-2px);
}

.instruction-thumbnail {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: transparent;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.instruction-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.5rem;
}

.instruction-thumbnail-placeholder {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: transparent;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.instruction-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.instruction-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.instruction-description {
  font-size: 0.875rem;
  color: #4b5563;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.instruction-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.instruction-source {
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  border-radius: 4px;
}

.instruction-size {
  color: #6b7280;
}

.instruction-actions {
  display: flex;
  justify-content: stretch;
  margin-top: auto;
}

.download-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.75rem 1rem;
  background: #2563eb;
  color: #ffffff;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s ease;
}

.download-button:hover {
  background: #1d4ed8;
}

@media (max-width: 768px) {
  .set-instructions-page {
    padding: 1rem;
  }

  .page-header {
    margin-bottom: 1rem;
  }

  .page-header h1 {
    font-size: 1.25rem;
  }

  .page-header p {
    font-size: 0.875rem;
  }
  
  .page-title-with-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .search-section {
    margin-bottom: 1.5rem;
  }

  .card-body {
    padding: 1rem;
  }

  .set-search-input-row {
    flex-direction: row;
  }

  .instructions-section {
    gap: 1rem;
  }

  .instructions-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }

  .instruction-card {
    padding: 1rem;
  }
}

/* 토글 스위치 스타일 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 100px;
  height: 32px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #d1d5db;
  transition: 0.3s;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.toggle-text {
  position: absolute;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  transition: 0.3s;
  white-space: nowrap;
  z-index: 1;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.toggle-switch input:checked + .toggle-slider .toggle-text {
  left: 12px;
  right: auto;
}

.toggle-switch input:not(:checked) + .toggle-slider .toggle-text {
  right: 12px;
  left: auto;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #ff3600;
}

.toggle-switch input:checked + .toggle-slider .toggle-text {
  color: white;
}

.toggle-switch input:not(:checked) + .toggle-slider.all-sets {
  background-color: #1f2937;
}

.toggle-switch input:not(:checked) + .toggle-slider .toggle-text {
  color: white;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(68px);
}

.toggle-switch input:focus + .toggle-slider {
  box-shadow: 0 0 1px #ff3600;
}

.toggle-switch.disabled .toggle-slider {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle-switch input:disabled + .toggle-slider {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 768px) {
  .toggle-switch {
    width: 90px;
    height: 28px;
  }
  
  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(58px);
  }
  
  .toggle-switch input:checked + .toggle-slider .toggle-text {
    left: 10px;
  }
  
  .toggle-switch input:not(:checked) + .toggle-slider .toggle-text {
    right: 10px;
  }
  
  .toggle-text {
    font-size: 0.8125rem;
  }
}
</style>
