<template>
  <div class="set-parts-page">
    <div class="page-header">
      <h1>세트부품</h1>
      <p>세트번호를 입력하여 해당 세트의 부품 정보를 확인할 수 있습니다.</p>
    </div>

    <div class="set-parts-content">
      <div class="search-section">
        <div class="setup-card">
          <div class="card-body">
            <div class="form-group">
              <label>레고번호를 입력하세요.</label>
              <div class="set-search-wrapper" ref="setDropdownRef">
                <div class="set-search-input-row">
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
                            @load="handleSetImageLoad($event, set)"
                            loading="eager"
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
                          <span class="option-set-parts">부품수 : {{ resolvePartCount(set) }}개</span>
                          <span v-if="selectedSetId === set.id && uniquePartsCount > 0" class="option-set-registered">
                            부품수 {{ uniquePartsCount }}종, 실제 등록 부품수 {{ registeredPartsCount }}종
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </transition>
                <div v-if="selectedSetId && selectedSet" class="selected-set-info">
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
                      <span v-if="uniquePartsCount > 0" class="selected-set-registered">
                        부품수 {{ uniquePartsCount }}종, 실제 등록 부품수 {{ registeredPartsCount }}종
                      </span>
                    </div>
                  </div>
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

      <div v-if="!loading && !error && selectedSet && parts.length > 0" class="parts-section">
        <div class="parts-grid">
          <div
            v-for="part in parts"
            :key="`${part.part_id}-${part.color_id}`"
            class="part-card"
          >
            <div class="card-header">
              <div class="part-info">
                <div v-if="part.element_id" class="element-id">
                  {{ part.element_id }}
                </div><!-- // 🔧 수정됨 -->
                <h4 class="part-name">{{ part.part_name }}</h4>
                <span 
                  class="color-badge"
                  :style="{ 
                    backgroundColor: getColorRgb(part.color_rgb) || '#ccc'
                  }"
                >
                  {{ formatColorLabel(part.color_name, part.color_id) }}
                </span>
              </div>
              <button
                type="button"
                class="part-info-btn"
                @click="showPartInfo(part)"
                title="부품 정보"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="card-body">
              <div class="part-image-section">
                <img
                  v-if="part.image_url"
                  :src="part.image_url"
                  :alt="part.part_name"
                  class="part-image"
                  @error="handleImageError"
                />
                <div v-else class="no-part-image">이미지 없음</div>
              </div>
              <div class="quantity-section">
                <div class="quantity-badge">{{ part.quantity }}개</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 부품 정보 모달 -->
    <div v-if="showPartInfoModal" class="part-info-modal-overlay" @click="closePartInfoModal">
      <div class="part-info-modal" @click.stop>
        <div class="modal-header">
          <h3>부품 정보</h3>
          <button @click="closePartInfoModal" class="modal-close-btn">×</button>
        </div>
        <div class="modal-body">
          <div v-if="selectedPart" class="part-info-content">
            <div class="info-section">
              <h4>{{ selectedPart.part_name }}</h4>
              <p class="part-color-info">{{ formatColorLabel(selectedPart.color_name, selectedPart.color_id) }}</p>
            </div>

            <div class="info-section">
              <h5>포함된 세트</h5>
              <div v-if="partSetsLoading" class="loading-text">로딩 중...</div>
              <div v-else-if="partSets.length === 0" class="empty-text">포함된 세트가 없습니다</div>
              <div v-else class="sets-list">
                <div
                  v-for="set in partSets"
                  :key="set.id"
                  class="set-item"
                  @click="handleSetRowClick(set)"
                  tabindex="0"
                >
                  <span class="set-name">{{ set.name }}</span>
                  <span class="set-num">{{ displaySetNumber(set.set_num) }}</span>
                </div>
              </div>
            </div>

            <div class="info-section">
              <h5>대체 부품</h5>
              <div v-if="alternativePartsLoading" class="loading-text">로딩 중...</div>
              <div v-else-if="alternativeParts.length === 0" class="empty-text">대체 부품이 없습니다</div>
              <div v-else class="alternatives-list">
                <div
                  v-for="alt in alternativeParts.slice(0, 10)"
                  :key="alt.part_id"
                  class="alternative-item"
                  @click="handleAlternativePartClick(alt)"
                  tabindex="0"
                >
                  <div class="alt-part-info">
                    <span class="alt-part-name">{{ alt.part_name }}</span>
                    <span class="alt-part-id">부품 번호: {{ alt.part_id }}</span>
                  </div>
                  <div class="alt-colors">
                    <div
                      v-for="color in alt.colors"
                      :key="`${alt.part_id}-${color.color_id}`"
                      class="alt-color-row"
                    >
                      <span
                        class="color-chip"
                        :style="{ backgroundColor: color.rgb ? (color.rgb.startsWith('#') ? color.rgb : `#${color.rgb}`) : '#ccc' }"
                      ></span>
                      <span class="alt-color-name">{{ formatColorLabel(color.name, color.color_id) }}</span>
                      <span v-if="color.element_id" class="alt-element-id">Element ID: {{ color.element_id }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 디버깅: 모달 상태 확인 -->
    <div v-if="showSyncModal" style="position: fixed; top: 10px; right: 10px; background: red; color: white; padding: 10px; z-index: 10000; font-size: 12px;">
      모달 상태: {{ showSyncModal }}, 세트번호: {{ syncSetNum }}
    </div>
    
    <!-- 부품 정보 동기화 모달 -->
    <SetPartsSyncModal
      v-if="showSyncModal && syncSetNum"
      :show="showSyncModal"
      :set-num="syncSetNum"
      :syncing="syncing"
      :sync-progress="syncProgress"
      :sync-status="syncStatus"
      :completed="syncCompleted"
      :parts-count="syncPartsCount"
      :error="syncError"
      @confirm="handleSyncConfirm"
      @cancel="handleSyncCancel"
      @close="handleSyncClose"
      @retry="handleSyncRetry"
    />
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { usePartSearch } from '../composables/usePartSearch'
import { usePleyonInventorySync } from '../composables/usePleyonInventorySync'
import { useRebrickable } from '../composables/useRebrickable'
import SetPartsSyncModal from '../components/SetPartsSyncModal.vue'
import { formatSetDisplay, formatSetNumber } from '../utils/setDisplay'

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export default {
  name: 'SetParts',
  components: {
    SetPartsSyncModal
  },
  setup() {
    const router = useRouter()
    const { supabase } = useSupabase()
    const { checkSetPartsExist, syncSetParts, syncing, syncProgress, syncStatus, error: syncError } = usePleyonInventorySync()

    const loading = ref(false)
    const error = ref(null)
    const parts = ref([])
    const selectedSetId = ref('')
    const setSearchQuery = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0)
    const selectedSet = ref(null)
    const showSetDropdown = ref(false)
    const setDropdownRef = ref(null)
    
    // 부품수 통계
    const registeredPartsCount = ref(0) // 실제 등록된 부품의 종수 (예비부품 제외)
    const uniquePartsCount = ref(0) // 부품 종류 수 (예비부품 제외)
    
    // 동기화 모달 관련
    const showSyncModal = ref(false)
    const syncSetNum = ref('')
    const syncCompleted = ref(false)
    const syncPartsCount = ref(0)
    
    // 테스트용: 모달 강제 표시 함수 (개발 환경에서만)
    const testShowModal = () => {
      if (import.meta.env.DEV) {
        console.log('[SetParts] 테스트: 모달 강제 표시')
        syncSetNum.value = setSearchQuery.value.trim() || '40700'
        showSyncModal.value = true
        syncCompleted.value = false
        syncPartsCount.value = 0
      }
    }
    
    // 디버깅: 모달 상태 감시
    watch(showSyncModal, (newVal) => {
      console.log('[SetParts] showSyncModal 변경:', newVal, {
        syncSetNum: syncSetNum.value,
        syncing: syncing.value
      })
    })
    
    watch(syncSetNum, (newVal) => {
      console.log('[SetParts] syncSetNum 변경:', newVal)
    })

    const { findSetsByPart, findAlternativeParts } = usePartSearch()

    const showPartInfoModal = ref(false)
    const selectedPart = ref(null)
    const partSets = ref([])
    const partSetsLoading = ref(false)
    const alternativeParts = ref([])
    const alternativePartsLoading = ref(false)

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
        
        console.log('[SetParts] 검색 쿼리:', { query, mainSetNum })
        
        // 1단계: 정확한 매칭 시도
        const { data: exactMatch, error: exactError } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
          .eq('set_num', query)
          .limit(20)

        console.log('[SetParts] 1단계 정확한 매칭 결과:', { count: exactMatch?.length || 0, error: exactError })

        if (!exactError && exactMatch && exactMatch.length > 0) {
          results = exactMatch
        } else {
          // 2단계: 메인 세트 번호로 정확히 일치
          const { data: mainMatch, error: mainError } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .eq('set_num', mainSetNum)
            .limit(20)

          console.log('[SetParts] 2단계 메인 세트 번호 매칭 결과:', { count: mainMatch?.length || 0, error: mainError })

          if (!mainError && mainMatch && mainMatch.length > 0) {
            results = mainMatch
          } else {
            // 3단계: LIKE 패턴으로 검색
            const { data: likeMatch, error: likeError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
              .ilike('set_num', `${mainSetNum}%`)
              .order('set_num')
              .limit(20)

            console.log('[SetParts] 3단계 LIKE 패턴 검색 결과:', { count: likeMatch?.length || 0, error: likeError })

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

          // webp_image_url이 상대 경로인 경우 전체 URL로 변환
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
          results = results.map(set => {
            let webpImageUrl = set.webp_image_url
            // webp_image_url 처리
            if (webpImageUrl) {
              if (!webpImageUrl.startsWith('http')) {
                // 상대 경로인 경우 Supabase Storage URL로 변환
                if (webpImageUrl.startsWith('/storage/')) {
                  webpImageUrl = `${supabaseUrl}${webpImageUrl}`
                } else if (webpImageUrl.startsWith('storage/')) {
                  webpImageUrl = `${supabaseUrl}/${webpImageUrl}`
                }
              }
              console.log(`[SetParts] 세트 ${set.set_num} - webp_image_url:`, webpImageUrl)
            } else if (set.set_img_url) {
              // webp_image_url이 없으면 set_img_url 사용
              webpImageUrl = set.set_img_url
              
              // Rebrickable CDN URL인 경우 프록시를 통해 로드
              if (webpImageUrl && webpImageUrl.includes('cdn.rebrickable.com')) {
                const imagePath = webpImageUrl.replace('https://cdn.rebrickable.com/', '')
                webpImageUrl = `/api/proxy/${imagePath}`
                console.log(`[SetParts] 세트 ${set.set_num} - Rebrickable URL을 프록시로 변환:`, webpImageUrl)
              }
              
              console.log(`[SetParts] 세트 ${set.set_num} - set_img_url 사용:`, webpImageUrl)
            } else {
              console.warn(`[SetParts] 세트 ${set.set_num} - 이미지 URL 없음`)
            }
            return {
              ...set,
              webp_image_url: webpImageUrl,
              part_count: set.num_parts || 0
            }
          })
        }

        searchResults.value = results
        console.log('[SetParts] part_count 검증:', results.map(set => ({ set_num: set.set_num, part_count: set.part_count, num_parts: set.num_parts }))) // 🔧 수정됨
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
        return
      }
      
      console.log('[SetParts] 검색 시작:', setSearchQuery.value)
      await searchSets()
      console.log('[SetParts] 검색 결과:', searchResults.value.length, '개')
      
      if (searchResults.value.length === 1) {
        console.log('[SetParts] 검색 결과 1개, 자동 선택')
        handleSelectSet(searchResults.value[0])
      } else if (searchResults.value.length > 0) {
        console.log('[SetParts] 검색 결과 여러 개, 드롭다운 표시')
        showSetDropdown.value = true
      } else {
        // 검색 결과가 없으면 세트 번호로 직접 부품 정보 확인
        console.log('[SetParts] 검색 결과 없음, 세트 번호로 부품 정보 확인')
        const setNum = setSearchQuery.value.trim()
        try {
          const partsStatus = await checkSetPartsExist(setNum)
          console.log('[SetParts] 부품 정보 확인 결과:', partsStatus)
          
          if (!partsStatus.partsExist) {
            // 부품 정보가 없으면 모달 표시
            console.log('[SetParts] 부품 정보 없음, 모달 표시')
            syncSetNum.value = setNum
            syncCompleted.value = false
            syncPartsCount.value = 0
            showSyncModal.value = true
          } else {
            // 부품 정보가 있으면 에러 메시지 표시
            error.value = `세트 ${setNum}을(를) 찾을 수 없습니다.`
          }
        } catch (checkError) {
          console.error('[SetParts] 부품 정보 확인 실패:', checkError)
          // 확인 실패 시에도 모달 표시 (Rebrickable에서 가져올 수 있음)
          syncSetNum.value = setNum
          syncCompleted.value = false
          syncPartsCount.value = 0
          showSyncModal.value = true
        }
      }
    }

    const handleSearchBlur = () => {
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    const handleSelectSet = async (set) => {
      console.log('[SetParts] handleSelectSet 호출됨:', set)
      selectedSet.value = set
      selectedSetId.value = set.id
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      
      // 부품 정보가 있는지 확인
      try {
        console.log('[SetParts] 부품 정보 확인 시작:', set.set_num)
        const partsStatus = await checkSetPartsExist(set.set_num)
        console.log('[SetParts] 부품 정보 확인 결과:', partsStatus)
        
        if (!partsStatus.partsExist) {
          // 부품 정보가 없으면 모달 표시
          console.log('[SetParts] 부품 정보 없음, 모달 표시 시작', {
            showSyncModal: showSyncModal.value,
            syncSetNum: set.set_num
          })
          syncSetNum.value = set.set_num
          syncCompleted.value = false
          syncPartsCount.value = 0
          showSyncModal.value = true
          console.log('[SetParts] 모달 표시 설정 완료', {
            showSyncModal: showSyncModal.value,
            syncSetNum: syncSetNum.value,
            syncCompleted: syncCompleted.value
          })
          return
        } else {
          console.log('[SetParts] 부품 정보 있음, loadSetParts 호출')
        }
      } catch (checkError) {
        console.error(`[SetParts] 부품 정보 확인 실패:`, checkError)
        // 확인 실패해도 계속 진행
      }
      
      loadSetParts()
    }
    
    const handleSyncConfirm = async () => {
      try {
        syncCompleted.value = false
        syncError.value = null
        const result = await syncSetParts(syncSetNum.value, true)
        if (result && result.success) {
          syncCompleted.value = true
          syncPartsCount.value = result.partsCount || 0
          syncError.value = null
        }
      } catch (err) {
        console.error('[SetParts] 동기화 실패:', err)
        syncError.value = err.message || '부품 정보 동기화 중 오류가 발생했습니다.'
        syncCompleted.value = false
      }
    }
    
    const handleSyncClose = async () => {
      const syncedSetNum = syncSetNum.value
      showSyncModal.value = false
      syncSetNum.value = ''
      syncCompleted.value = false
      syncPartsCount.value = 0
      
      // 동기화 완료 후 세트 다시 검색하여 선택
      if (syncedSetNum) {
        console.log('[SetParts] 동기화 완료, 세트 다시 검색:', syncedSetNum)
        setSearchQuery.value = syncedSetNum
        await searchSets()
        if (searchResults.value.length > 0) {
          // 검색 결과가 있으면 첫 번째 세트 선택
          console.log('[SetParts] 검색 결과 있음, 세트 선택')
          await handleSelectSet(searchResults.value[0])
        } else {
          console.log('[SetParts] 검색 결과 없음, 에러 표시')
          error.value = `세트 ${syncedSetNum}을(를) 찾을 수 없습니다.`
        }
      } else if (selectedSet.value) {
        loadSetParts()
      }
    }
    
    const handleSyncCancel = () => {
      showSyncModal.value = false
      syncSetNum.value = ''
      syncCompleted.value = false
      syncPartsCount.value = 0
    }
    
    const handleSyncRetry = () => {
      handleSyncConfirm()
    }

    const loadSetParts = async () => {
      if (!selectedSetId.value) return

      try {
        loading.value = true
        error.value = null

        // 세트의 모든 부품 조회 (is_spare 포함)
        const { data: partsData, error: partsError } = await supabase
          .from('set_parts')
          .select('part_id, color_id, quantity, element_id, is_spare')
          .eq('set_id', selectedSetId.value)

        if (partsError) throw partsError

        if (!partsData || partsData.length === 0) {
          parts.value = []
          return
        }

        // 부품 정보 조회
        const partIds = [...new Set(partsData.map(p => p.part_id).filter(id => id !== null && id !== undefined && id !== ''))] // 🔧 수정됨
        const { data: partsInfo, error: partsInfoError } = await supabase
          .from('lego_parts')
          .select('part_num, name, part_img_url')
          .in('part_num', partIds)

        if (partsInfoError) throw partsInfoError

        // 색상 정보 조회
        const colorIds = [...new Set(partsData.map(p => p.color_id).filter(id => id !== null && id !== undefined))] // 🔧 수정됨
        const { data: colorsInfo, error: colorsError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .in('color_id', colorIds)

        if (colorsError) throw colorsError

        const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
        const colorsInfoMap = new Map(colorsInfo.map(c => [c.color_id, c]))

        // element_id 목록 수집
        const elementIds = [...new Set(partsData.map(p => p.element_id).filter(Boolean))].map(id => String(id))
        
        // element_id 기반 이미지 조회 (part_images + image_metadata)
        const elementImageMap = new Map()
        if (elementIds.length > 0) {
          // 1. part_images 테이블에서 조회
          const { data: elementImages, error: elementImagesError } = await supabase
            .from('part_images')
            .select('element_id, uploaded_url')
            .in('element_id', elementIds)
            .not('uploaded_url', 'is', null)

          if (!elementImagesError && elementImages) {
            elementImages.forEach(img => {
              if (img.element_id && img.uploaded_url) {
                // JPG는 무시, WebP만 사용
                if (!img.uploaded_url.toLowerCase().endsWith('.jpg')) {
                  elementImageMap.set(String(img.element_id), img.uploaded_url)
                }
              }
            })
          }

          // 2. image_metadata 테이블에서도 조회 (part_images에 없는 경우만)
          const missingElementIds = elementIds.filter(id => !elementImageMap.has(id))
          if (missingElementIds.length > 0) {
            const { data: metadataImages, error: metadataError } = await supabase
              .from('image_metadata')
              .select('element_id, supabase_url')
              .in('element_id', missingElementIds)
              .not('supabase_url', 'is', null)

            if (!metadataError && metadataImages) {
              metadataImages.forEach(img => {
                if (img.element_id && img.supabase_url) {
                  // JPG는 무시, WebP만 사용
                  if (!img.supabase_url.toLowerCase().endsWith('.jpg')) {
                    elementImageMap.set(String(img.element_id), img.supabase_url)
                  }
                }
              })
            }
          }
        }

        // part_id + color_id 기반 이미지 조회
        const partColorImageMap = new Map()
        const itemsWithoutElementId = partsData.filter(p => !p.element_id)
        if (itemsWithoutElementId.length > 0) {
          const partIdsForImages = [...new Set(itemsWithoutElementId.map(p => p.part_id).filter(id => id !== null && id !== undefined && id !== ''))]
          const colorIdsForImages = [...new Set(itemsWithoutElementId.map(p => p.color_id).filter(id => id !== null && id !== undefined))]

          if (partIdsForImages.length > 0 && colorIdsForImages.length > 0) {
            // 1. part_images 테이블에서 조회
            const { data: partImages, error: partImagesError } = await supabase
              .from('part_images')
              .select('part_id, color_id, uploaded_url')
              .in('part_id', partIdsForImages)
              .in('color_id', colorIdsForImages)
              .not('uploaded_url', 'is', null)

            if (!partImagesError && partImages) {
              partImages.forEach(img => {
                if (img.part_id && img.color_id && img.uploaded_url) {
                  const key = `${img.part_id}_${img.color_id}`
                  partColorImageMap.set(key, img.uploaded_url)
                }
              })
            }
            
            // 2. image_metadata 테이블에서도 조회 (part_images에 없는 경우만)
            const missingPartColorKeys = itemsWithoutElementId
              .map(p => `${p.part_id}_${p.color_id}`)
              .filter(key => !partColorImageMap.has(key))
            
            if (missingPartColorKeys.length > 0) {
              const { data: metadataImages, error: metadataError } = await supabase
                .from('image_metadata')
                .select('part_num, color_id, supabase_url')
                .in('part_num', partIdsForImages)
                .in('color_id', colorIdsForImages)
                .not('supabase_url', 'is', null)

              if (!metadataError && metadataImages) {
                metadataImages.forEach(img => {
                  if (img.part_num && img.color_id && img.supabase_url) {
                    const key = `${img.part_num}_${img.color_id}`
                    // JPG는 무시, WebP만 사용
                    if (!img.supabase_url.toLowerCase().endsWith('.jpg')) {
                      if (!partColorImageMap.has(key)) {
                        partColorImageMap.set(key, img.supabase_url)
                      }
                    }
                  }
                })
              }
            }
          }
        }

        // 부품 데이터 구성 (비동기 처리)
        // Rebrickable API 호출 제거: DB에 이미지가 없으면 나중에 lazy loading으로 처리

        const partsWithDataPromises = partsData.map(async (part) => {
          const partInfo = partsInfoMap.get(part.part_id)
          const colorInfo = colorsInfoMap.get(part.color_id)

          // 이미지 URL 결정: element_id 우선, 없으면 part_id + color_id, 마지막으로 part_img_url
          let imageUrl = null
          if (part.element_id && elementImageMap.has(String(part.element_id))) {
            imageUrl = elementImageMap.get(String(part.element_id))
          } else if (!part.element_id) {
            const key = `${part.part_id}_${part.color_id}`
            if (partColorImageMap.has(key)) {
              imageUrl = partColorImageMap.get(key)
            }
          }

          // element_id가 있지만 DB에 없으면 image_metadata에서 확인
          if (!imageUrl && part.element_id) {
            try {
              const { data: metadata, error: metadataError } = await supabase
                .from('image_metadata')
                .select('supabase_url')
                .eq('part_num', part.part_id)
                .eq('color_id', part.color_id)
                .eq('element_id', part.element_id)
                .not('supabase_url', 'is', null)
                .maybeSingle()
              
              if (!metadataError && metadata?.supabase_url) {
                // JPG는 무시, WebP만 사용
                if (!metadata.supabase_url.toLowerCase().endsWith('.jpg')) {
                  imageUrl = metadata.supabase_url
                }
              }
            } catch (metadataErr) {
              // 조용히 처리
            }
          }

          // element_id 실패 시 part_img_url 사용 (fallback, 프록시 URL 반환)
          if (!imageUrl && partInfo?.part_img_url) {
            imageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(partInfo.part_img_url)}`
          }
          
          // DB에 이미지가 없으면 null 반환 (나중에 lazy loading으로 처리 가능)

          const colorName = colorInfo?.name || `Color ${part.color_id}`
          let colorRgb = null
          if (colorInfo?.rgb !== null && colorInfo?.rgb !== undefined) {
            let rgbStr = String(colorInfo.rgb).trim() // 🔧 수정됨
            if (rgbStr && rgbStr !== 'null' && rgbStr !== 'undefined' && rgbStr !== 'None') { // 🔧 수정됨
              if (!rgbStr.startsWith('#')) { // 🔧 수정됨
                rgbStr = `#${rgbStr}` // 🔧 수정됨
              }
              if (rgbStr.length === 7) { // 🔧 수정됨
                colorRgb = rgbStr.toUpperCase() // 🔧 수정됨
              }
            }
          }

          return {
            part_id: part.part_id,
            color_id: part.color_id,
            element_id: part.element_id,
            quantity: part.quantity,
            part_name: partInfo?.name || part.part_id,
            color_name: colorName,
            color_rgb: colorRgb,
            image_url: imageUrl
          }
        })

        // 비동기 처리 완료 대기
        const partsWithData = await Promise.all(partsWithDataPromises)
        parts.value = partsWithData
        
        // 예비부품 제외한 부품수 계산
        const nonSpareParts = partsData.filter(p => !p.is_spare)
        uniquePartsCount.value = new Set(nonSpareParts.map(p => `${p.part_id}_${p.color_id}`)).size
        registeredPartsCount.value = uniquePartsCount.value // 실제 등록된 부품의 종수
      } catch (err) {
        console.error('세트 부품 로드 실패:', err)
        error.value = '세트 부품을 불러오는데 실패했습니다'
        uniquePartsCount.value = 0
        registeredPartsCount.value = 0
      } finally {
        loading.value = false
      }
    }

    const normalizeSetNumber = (setNum) => {
      if (!setNum) return ''
      const str = String(setNum).trim()
      return str.replace(/-1$/, '')
    }

    const displaySetNumber = (setNum) => {
      const normalized = normalizeSetNumber(setNum)
      return formatSetNumber(normalized)
    }

    const showPartInfo = async (part) => {
      if (!part) return

      selectedPart.value = {
        ...part,
        part_img_url: part.image_url || null
      }
      showPartInfoModal.value = true

      partSetsLoading.value = true
      try {
        partSets.value = await findSetsByPart(part.part_id, part.color_id)
      } catch (err) {
        partSets.value = []
      } finally {
        partSetsLoading.value = false
      }

      alternativePartsLoading.value = true
      try {
        alternativeParts.value = await findAlternativeParts(part.part_id, part.color_id)
      } catch (err) {
        alternativeParts.value = []
      } finally {
        alternativePartsLoading.value = false
      }
    }

    const closePartInfoModal = () => {
      showPartInfoModal.value = false
      selectedPart.value = null
      partSets.value = []
      alternativeParts.value = []
    }

    const handleImageError = (event) => {
      event.target.style.display = 'none'
    }

    const handleSetImageError = (event, set) => {
      const img = event.target
      const originalSrc = img.src
      console.warn('세트 이미지 로드 실패:', originalSrc, set)
      
      // Rebrickable CDN URL인 경우 프록시로 재시도
      if (originalSrc && originalSrc.includes('cdn.rebrickable.com') && !originalSrc.includes('/api/proxy/')) {
        const imagePath = originalSrc.replace('https://cdn.rebrickable.com/', '')
        const proxyUrl = `/api/proxy/${imagePath}`
        console.log('[SetParts] 프록시 URL로 재시도:', proxyUrl)
        img.src = proxyUrl
        return // 프록시로 재시도하므로 여기서 종료
      }
      
      // 프록시 재시도 실패 또는 다른 오류인 경우
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

    const handleSetImageLoad = (event, set) => {
      console.log('세트 이미지 로드 성공:', event.target.src, set)
      const img = event.target
      const wrapper = img.closest('.option-image-wrapper')
      if (wrapper) {
        // 이미지가 로드되면 명시적으로 표시
        img.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 2 !important; width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; object-fit: contain !important; padding: 0.5rem !important;'
        
        // "이미지 없음" 메시지 숨기기
        const noImageDiv = wrapper.querySelector('.option-no-image')
        if (noImageDiv) {
          noImageDiv.style.cssText = 'display: none !important;'
        }
        
        // 디버깅: 실제 DOM 상태 확인
        console.log('이미지 DOM 상태:', {
          display: window.getComputedStyle(img).display,
          visibility: window.getComputedStyle(img).visibility,
          opacity: window.getComputedStyle(img).opacity,
          width: window.getComputedStyle(img).width,
          height: window.getComputedStyle(img).height,
          zIndex: window.getComputedStyle(img).zIndex,
          position: window.getComputedStyle(img).position,
          wrapperDisplay: window.getComputedStyle(wrapper).display,
          wrapperWidth: window.getComputedStyle(wrapper).width,
          wrapperHeight: window.getComputedStyle(wrapper).height,
          wrapperOverflow: window.getComputedStyle(wrapper).overflow,
          wrapperPosition: window.getComputedStyle(wrapper).position,
          imgNaturalWidth: img.naturalWidth,
          imgNaturalHeight: img.naturalHeight,
          imgComplete: img.complete,
          imgSrc: img.src,
          parentElement: wrapper.parentElement?.tagName,
          isVisible: img.offsetWidth > 0 && img.offsetHeight > 0
        })
        
        // DOM 강제 리플로우
        wrapper.offsetHeight
        img.offsetHeight
      }
    }

    const handleSelectedSetImageError = (event) => {
      const img = event.target
      const originalSrc = img.src
      console.warn('[SetParts] 선택된 세트 이미지 로드 실패:', originalSrc)
      
      // Rebrickable CDN URL인 경우 프록시로 재시도
      if (originalSrc && originalSrc.includes('cdn.rebrickable.com') && !originalSrc.includes('/api/proxy/')) {
        const imagePath = originalSrc.replace('https://cdn.rebrickable.com/', '')
        const proxyUrl = `/api/proxy/${imagePath}`
        console.log('[SetParts] 선택된 세트 프록시 URL로 재시도:', proxyUrl)
        img.src = proxyUrl
        return // 프록시로 재시도하므로 여기서 종료
      }
      
      // 프록시 재시도 실패 또는 다른 오류인 경우
      img.style.display = 'none'
      const wrapper = img.closest('.selected-set-thumb-wrapper')
      if (wrapper) {
        const placeholder = document.createElement('div')
        placeholder.className = 'selected-set-no-image'
        placeholder.textContent = '이미지 없음'
        wrapper.appendChild(placeholder)
      }
    }

    const getColorRgb = (rgb) => { // 🔧 수정됨
      if (!rgb) return null // 🔧 수정됨
      let rgbStr = String(rgb).trim() // 🔧 수정됨
      if (!rgbStr || rgbStr === 'null' || rgbStr === 'undefined' || rgbStr === 'None') { // 🔧 수정됨
        return null // 🔧 수정됨
      }
      if (!rgbStr.startsWith('#')) { // 🔧 수정됨
        rgbStr = `#${rgbStr}` // 🔧 수정됨
      }
      return rgbStr.length === 7 ? rgbStr.toUpperCase() : null // 🔧 수정됨
    }

    const formatColorLabel = (colorName, colorId) => {
      if (colorName) {
        const normalized = String(colorName).trim()
        const lower = normalized.toLowerCase()
        if (
          lower === 'no color' ||
          lower === 'any color' ||
          (lower.includes('no color') && lower.includes('any color')) ||
          normalized.includes('No Color') && normalized.includes('Any Color')
        ) {
          return 'Any Color'
        }
        return normalized
      }
      return colorId !== null && colorId !== undefined ? `Color ${colorId}` : 'Any Color'
    }

    const resolvePartCount = (set) => { // 🔧 수정됨
      if (!set) return 0
      const priority = [set.part_count, set.num_parts]
      for (const value of priority) {
        const normalized = normalizeNumber(value)
        if (normalized !== null) {
          return normalized
        }
      }
      return 0
    }

    const handleSetRowClick = async (set) => {
      if (!set || !set.set_num) return
      try {
        const targetSetNum = normalizeSetNumber(set.set_num)
        setSearchQuery.value = targetSetNum
        await searchSets()
        let target = searchResults.value.find(result => normalizeSetNumber(result.set_num) === targetSetNum)
        if (!target) {
          target = {
            id: set.id,
            set_num: targetSetNum,
            name: set.name,
            theme_id: null,
            theme_name: set.theme_name || null,
            webp_image_url: set.image_url || null,
            set_img_url: set.image_url || null,
            num_parts: set.quantity || null
          }
        }
        await handleSelectSet(target)
        closePartInfoModal()
      } catch (err) {
        console.error('[SetParts] 세트 행 클릭 처리 실패:', err)
      }
    }

    const handleAlternativePartClick = (part) => {
      if (!part) return // 🔧 수정됨
      const query = {} // 🔧 수정됨
      if (part.element_id) { // 🔧 수정됨
        query.element = String(part.element_id) // 🔧 수정됨
      } else if (part.part_id) { // 🔧 수정됨
        query.part = part.part_id // 🔧 수정됨
        if (part.color_id !== null && part.color_id !== undefined) { // 🔧 수정됨
          query.color = part.color_id // 🔧 수정됨
        }
      }
      if (Object.keys(query).length === 0) return // 🔧 수정됨
      router.push({ // 🔧 수정됨
        path: '/part-to-set-search', // 🔧 수정됨
        query
      })
      closePartInfoModal()
    }

    return {
      loading,
      error,
      parts,
      selectedSetId,
      setSearchQuery,
      searchResults,
      searchResultsKey,
      selectedSet,
      uniquePartsCount,
      registeredPartsCount,
      showSyncModal,
      syncSetNum,
      syncing,
      syncProgress,
      syncStatus,
      syncCompleted,
      syncPartsCount,
      syncError,
      handleSyncConfirm,
      handleSyncClose,
      handleSyncCancel,
      handleSyncRetry,
      showSetDropdown,
      setDropdownRef,
      handleSearchEnter,
      handleSearchBlur,
      handleSelectSet,
      handleImageError,
      handleSetImageError,
      handleSetImageLoad,
      handleSelectedSetImageError,
      formatSetDisplay,
      formatSetNumber,
      getColorRgb,
      formatColorLabel,
      resolvePartCount, // 🔧 수정됨
      displaySetNumber,
      handleSetRowClick,
      handleAlternativePartClick,
      showPartInfo,
      closePartInfoModal,
      showPartInfoModal,
      selectedPart,
      partSets,
      partSetsLoading,
      alternativeParts,
      alternativePartsLoading
    }
  }
}
</script>

<style>
.set-parts-page {
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

.set-parts-content {
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
  overflow: hidden;
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
  gap: 0.5rem; /* 🔧 수정됨 */
}

.selected-set-display {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.selected-set-row { /* 🔧 수정됨 */
  display: flex;
  align-items: center;
  gap: 0.75rem;
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

.selected-set-parts { /* 🔧 수정됨 */
  display: block;
  font-size: 0.8125rem;
  color: #6b7280;
  margin-top: 0rem;
}

.selected-set-registered {
  display: block;
  font-size: 0.8125rem;
  color: #3b82f6;
  font-weight: 500;
  margin-top: 0.25rem;
}

.selected-set-thumb-wrapper { /* 🔧 수정됨 */
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

.selected-set-thumb { /* 🔧 수정됨 */
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  padding: 0.5rem;
}

.selected-set-no-image { /* 🔧 수정됨 */
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #9ca3af;
  background: #f9fafb;
}

.set-parts-page .custom-select-dropdown {
  position: relative !important;
  width: 100% !important;
  max-height: 260px !important;
  overflow-y: auto !important;
  overflow-x: visible !important;
  background: #ffffff !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 12px !important;
  box-shadow: 0 18px 36px -12px rgba(15, 23, 42, 0.25) !important;
  z-index: 20 !important;
  padding: 0.5rem !important;
  margin-top: 0.5rem !important;
}

.set-parts-page .custom-select-option {
  width: 100% !important;
  text-align: left !important;
  padding: 0.75rem 1rem !important;
  border-radius: 10px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  transition: background-color 0.15s ease, color 0.15s ease !important;
  overflow: visible !important;
}

.set-parts-page .option-content {
  display: flex !important;
  align-items: center !important;
  gap: 1rem !important;
  width: 100% !important;
  overflow: visible !important;
}

.set-parts-page .option-image-wrapper {
  width: 80px !important;
  height: 80px !important;
  min-width: 80px !important;
  min-height: 80px !important;
  flex-shrink: 0 !important;
  background: #f9fafb !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 8px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: visible !important;
  position: relative !important;
}

.set-parts-page .option-set-image {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  padding: 0.5rem !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: relative !important;
  z-index: 2 !important;
  box-sizing: border-box !important;
  pointer-events: auto !important;
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
  background: #f9fafb;
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

.option-set-registered {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: #3b82f6;
  font-weight: 500;
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
.error-state {
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

.parts-section {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
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
  padding: 1rem 0;
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
}

@media (max-width: 600px) {
  .parts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .set-parts-page {
    padding: 1rem;
  }

  .page-header {
    margin-bottom: 1rem;
    padding: 0;
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

  .option-content {
    gap: 0.75rem;
  }

  .option-image-wrapper {
    width: 60px;
    height: 60px;
  }

  .option-set-image {
    padding: 0.375rem;
  }

  .option-no-image {
    font-size: 0.6875rem;
    padding: 0.375rem;
  }

  .option-info {
    gap: 0.125rem;
  }

  .option-set-num,
  .option-set-title {
    font-size: 0.8125rem;
  }

  .option-set-parts {
    font-size: 0.75rem;
  }

  .parts-grid {
    grid-template-columns: 1fr;
  }

  .part-card {
    padding: 1rem;
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
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    font-size: 0.875rem !important;
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
    padding: 0.75rem 0;
  }

  .part-card .part-image {
    max-height: 150px;
  }
}
.part-info-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
  flex-shrink: 0;
  border-radius: 4px;
}

.part-info-btn:hover {
  color: #2563eb;
  background: #f3f4f6;
}

.part-info-modal-overlay {
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

.part-info-modal {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
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

.part-info-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-section h4 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.info-section h5 {
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
}

.part-color-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.loading-text,
.empty-text {
  font-size: 0.875rem;
  color: #9ca3af;
  padding: 1rem;
  text-align: center;
}

.sets-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.set-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.set-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
}

.set-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.set-num {
  font-size: 0.75rem;
  color: #6b7280;
  background: #ffffff;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.alternatives-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alternative-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.alternative-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
}

.alt-part-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.alt-part-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.alt-part-id {
  font-size: 0.8125rem;
  color: #6b7280;
}

.alt-colors {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.alt-color-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-chip {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  display: inline-block;
}

.alt-color-name {
  font-size: 0.8125rem;
  color: #374151;
  font-weight: 500;
}

.alt-element-id {
  font-size: 0.75rem;
  color: #6b7280;
}

</style>


