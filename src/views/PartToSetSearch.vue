<template>
  <div class="part-to-set-search-page">
    <div class="layout-container">
      <div class="page-header">
        <h1>부품으로 레고 찾기</h1>
        <p>부품번호를 입력하여 해당 부품이 포함된 레고를 찾을 수 있습니다</p>
      </div>

      <div class="search-content">
      <div class="search-section">
        <div class="setup-card">
          <div class="card-body">
            <div class="form-group">
              <label for="element-id-input">부품번호를 입력하세요.</label>
              <div class="set-search-wrapper">
                <div class="set-search-input-row">
                  <div class="set-search-input-wrapper">
                    <input
                      id="element-id-input"
                      v-model="elementIdInput"
                      type="text"
                      class="set-search-input"
                      placeholder="예 : 306923"
                      @keyup.enter="searchByElementId"
                      :disabled="loading"
                    />
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M14 14L11.1 11.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <button
                    @click="searchByElementId"
                    class="search-button"
                    :disabled="loading"
                  >
                    {{ loading ? '검색 중...' : '검색' }}
                  </button>
                </div>
                <!-- 검색 툴팁 -->
                <div v-if="searchTooltip" class="search-tooltip">
                  <span>{{ searchTooltip }}</span>
                </div>
                <div v-if="searchResult" class="result-part-card">
                  <button class="close-result-button" @click="resetPage" title="초기화">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                  <div class="part-image-container" style="position: relative;">
                    <img
                      v-if="searchResult.part_image_url"
                      :src="searchResult.part_image_url"
                      :alt="searchResult.part_name"
                      class="part-image"
                      @error="handlePartImageError"
                      @load="(e) => { if (e.target) searchResult._currentSrc = e.target.src }"
                    />
                    <div v-else class="no-part-image">이미지 없음</div>
                    <span 
                      v-if="searchResult.part_image_url && (isCdnUrl(searchResult.part_image_url) || (searchResult._currentSrc && isCdnUrl(searchResult._currentSrc)))"
                      class="cdn-badge"
                    >
                      CDN
                    </span>
                  </div>
                  <div class="part-info">
                    <div v-if="searchResult.element_id" class="element-id-badge">
                      {{ searchResult.element_id }}
                    </div>
                    <div class="part-name-text">{{ searchResult.part_name }}</div>
                    <span 
                      v-if="searchResult.color_name || searchResult.color_id"
                      class="result-color-badge"
                      :style="{ 
                        backgroundColor: getColorRgb(searchResult.color_rgb) || '#ccc',
                        color: getColorTextColor(searchResult.color_rgb)
                      }"
                    >
                      {{ formatColorLabel(searchResult.color_name, searchResult.color_id, searchResult.part_id) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 최근 등록 부품 리스트 -->
      <div v-if="!loading && !error && !searchResult && recentParts.length > 0" class="recent-parts-section">
        <div class="result-header">
          <h3>최근 등록 부품</h3>
        </div>
        <div class="parts-grid">
          <div
            v-for="part in paginatedRecentParts"
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
              <div class="part-image-section" style="position: relative;">
                <img
                  v-if="part.image_url"
                  :src="part.image_url"
                  :alt="part.part_name"
                  class="part-image"
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
            </div>
          </div>
        </div>
        <!-- 페이지네이션 -->
        <div v-if="recentPartsTotalPages > 1" class="pagination">
          <button
            class="pagination-button"
            :class="{ disabled: recentPartsCurrentPage === 1 }"
            @click="goToRecentPartsPage(recentPartsCurrentPage - 1)"
            :disabled="recentPartsCurrentPage === 1"
          >
            이전
          </button>
          <div class="pagination-numbers">
            <span
              v-for="page in recentPartsVisiblePages"
              :key="page"
            >
              <button
                v-if="page !== '...'"
                class="pagination-number"
                :class="{ active: page === recentPartsCurrentPage }"
                @click="goToRecentPartsPage(page)"
              >
                {{ page }}
              </button>
              <span v-else class="pagination-ellipsis">...</span>
            </span>
          </div>
          <button
            class="pagination-button"
            :class="{ disabled: recentPartsCurrentPage === recentPartsTotalPages }"
            @click="goToRecentPartsPage(recentPartsCurrentPage + 1)"
            :disabled="recentPartsCurrentPage === recentPartsTotalPages"
          >
            다음
          </button>
        </div>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="searchResult" class="result-section">
        <div class="result-header">
          <h3>검색결과</h3>
        </div>
        <div v-if="searchResult.sets && searchResult.sets.length > 0" class="sets-grid">
          <div
            v-for="set in searchResult.sets"
            :key="set.id"
            class="set-card"
          >
            <div class="set-image">
              <img
                v-if="set.image_url"
                :src="set.image_url"
                :alt="set.name"
                @error="handleImageError"
              />
              <div v-else class="no-image">이미지 없음</div>
              <button
                class="set-parts-icon-button"
                @click.stop="openSetPartsModal(set)"
                :title="'부품 정보 보기'"
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
              <p class="set-quantity">수량 : {{ set.quantity }}개</p>
            </div>
          </div>
        </div>
        <div v-else class="empty-result">
          <p>해당 부품이 포함된 세트를 찾을 수 없습니다.</p>
        </div>

        <div v-if="searchResult.alternatives && searchResult.alternatives.length > 0 && searchResult.alternatives[0].colors && searchResult.alternatives[0].colors.length > 0" class="alternatives-section">
          <div class="alternative-group">
            <h4 class="alternative-title">유사부품 (동일 모양, 다른 색상)</h4>
            <div class="alternative-parts-grid">
              <div
                v-for="color in searchResult.alternatives[0].colors"
                :key="color.color_id"
                class="alternative-part-card"
                :data-part-id="searchResult.alternatives[0].part_id"
                :data-color-id="color.color_id"
                @click="searchByAlternativeElementId(color.element_id)"
              >
                <div class="card-header">
                  <div class="part-info">
                    <div v-if="color.element_id" class="element-id">{{ color.element_id }}</div>
                    <h4 class="part-name">{{ searchResult.alternatives[0].part_name }}</h4>
                    <span 
                      class="color-badge"
                      :style="{ 
                        backgroundColor: getColorRgb(color.rgb) || '#ccc',
                        color: getColorTextColor(color.rgb)
                      }"
                    >
                      {{ color.name || color.color_id }}
                    </span>
                  </div>
                </div>
                <div class="card-body">
                  <div class="part-image-section" style="position: relative;">
                    <img
                      v-if="color.image_url"
                      :src="color.image_url"
                      :alt="searchResult.alternatives[0].part_name"
                      @error="handlePartImageError"
                      class="part-image"
                      @load="(e) => { if (e.target) color._currentSrc = e.target.src }"
                    />
                    <div v-else class="no-part-image">이미지 없음</div>
                    <span 
                      v-if="color.image_url && (isCdnUrl(color.image_url) || (color._currentSrc && isCdnUrl(color._currentSrc)))"
                      class="cdn-badge"
                    >
                      CDN
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- 세트 부품 리스트 모달 -->
    <div v-if="showSetPartsModal" class="modal-overlay" @click.self="closeSetPartsModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ selectedSet ? formatSetDisplay(selectedSet.set_num, selectedSet.theme_name, selectedSet.name) : '' }}</h3>
          <button class="modal-close-button" @click="closeSetPartsModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="setPartsLoading" class="loading-message">로딩 중...</div>
          <div v-else-if="setPartsError" class="error-message">{{ setPartsError }}</div>
          <div v-else-if="setParts && setParts.length > 0" class="set-parts-list">
            <div class="parts-grid modal-parts-grid">
              <div
                v-for="(part, index) in setParts"
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
                  <div class="part-image-section">
                    <img
                      v-if="part.image_url"
                      :src="part.image_url"
                      :alt="part.part_name"
                      class="part-image"
                      @error="handlePartImageError"
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
          <div v-else class="empty-message">부품이 없습니다.</div>
        </div>
      </div>
    </div>
    
    <!-- 부품 정보 동기화 모달 -->
    <SetPartsSyncModal
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
              <div v-if="selectedPart.element_id" class="element-id-display">
                <strong>{{ selectedPart.element_id }}</strong>
              </div>
              <h4>{{ selectedPart.part_name }}</h4>
              <p class="part-color-info">{{ formatColorLabel(selectedPart.color_name, selectedPart.color_id, selectedPart.part_id) }}</p>
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
                  <span class="set-num">{{ formatSetNumber(set.set_num) }}</span>
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
                      <span class="alt-color-name">{{ formatColorLabel(color.name, color.color_id, alt.part_id) }}</span>
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
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router' // 🔧 수정됨
import { useSupabase } from '../composables/useSupabase'
import { usePartSearch } from '../composables/usePartSearch'
import { usePleyonInventorySync } from '../composables/usePleyonInventorySync'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'
import { useRebrickable } from '../composables/useRebrickable'
import SetPartsSyncModal from '../components/SetPartsSyncModal.vue'
import { formatSetDisplay, formatSetNumber } from '../utils/setDisplay'

export default {
  name: 'PartToSetSearch',
  components: {
    SetPartsSyncModal
  },
  setup() {
    const { supabase, user } = useSupabase()
    const route = useRoute() // 🔧 수정됨
    const { findSetsByPart, findAlternativeParts, loading } = usePartSearch()
    const { checkSetPartsExist, syncSetParts, syncing, syncProgress, syncStatus, error: syncError } = usePleyonInventorySync()
    const { getStoreInfoByEmail, getStoreInventory } = useSupabasePleyon()

    const elementIdInput = ref('')
    const lastQuerySignature = ref('') // 🔧 수정됨
    const searchResult = ref(null)
    
    // 최근 등록 부품 관련
    const recentParts = ref([])
    const recentPartsCurrentPage = ref(1)
    const recentPartsItemsPerPage = 40
    
    // 부품 정보 모달 관련
    const showPartInfoModal = ref(false)
    const selectedPart = ref(null)
    const partSets = ref([])
    const partSetsLoading = ref(false)
    const alternativeParts = ref([])
    const alternativePartsLoading = ref(false)
    
    const error = ref(null)
    const showSetPartsModal = ref(false)
    const selectedSet = ref(null)
    const setParts = ref([])
    const setPartsLoading = ref(false)
    const setPartsError = ref(null)
    
    // 동기화 모달 관련
    const showSyncModal = ref(false)
    const syncSetNum = ref('')
    const syncCompleted = ref(false)
    const syncPartsCount = ref(0)
    
    // 매장 인벤토리 관련
    const storeInventory = ref([])
    const storeInfo = ref(null)
    
    // 매장 인벤토리 로드
    const loadStoreInventory = async () => {
      if (!user.value || !user.value.email) {
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
          console.log('[PartToSetSearch] 매장 인벤토리 로드 완료:', storeInventory.value.length, '개')
        } else {
          storeInfo.value = null
          storeInventory.value = []
        }
      } catch (err) {
        console.error('[PartToSetSearch] 매장 인벤토리 로드 실패:', err)
        storeInfo.value = null
        storeInventory.value = []
      }
    }
    
    const resolveElementIdByPart = async (partId, colorId = null) => { // 🔧 수정됨
      if (!partId) return null // 🔧 수정됨
      try {
        let elementQuery = supabase
          .from('set_parts')
          .select('element_id')
          .eq('part_id', partId)
          .not('element_id', 'is', null)
        
        if (colorId !== null && colorId !== undefined) {
          elementQuery = elementQuery.eq('color_id', colorId)
        }
        
        const { data, error } = await elementQuery
          .limit(1)
          .maybeSingle()
        
        if (error) {
          console.warn('[PartToSetSearch] element_id 조회 실패:', error)
          return null
        }
        
        return data?.element_id ? String(data.element_id) : null
      } catch (err) {
        console.error('[PartToSetSearch] element_id 해석 실패:', err)
        return null
      }
    }
    
    // 매장 인벤토리의 세트 번호 목록 추출
    const inventorySetNumbers = computed(() => {
      if (storeInventory.value.length === 0) {
        return new Set()
      }
      
      return new Set(
        storeInventory.value
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
      )
    })

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

    const searchByElementId = async () => {
      if (!elementIdInput.value.trim()) {
        showSearchTooltip('검색어를 입력해주세요.')
        return
      }

      try {
        error.value = null
        searchResult.value = null

        // element_id로 set_parts에서 part_id와 color_id 조회
        const { data: setPart, error: setPartError } = await supabase
          .from('set_parts')
          .select('part_id, color_id')
          .eq('element_id', String(elementIdInput.value.trim()))
          .limit(1)
          .maybeSingle()

        if (setPartError) {
          throw new Error(`데이터베이스 조회 실패: ${setPartError.message}`)
        }

        if (!setPart) {
          error.value = `엘리먼트 ID "${elementIdInput.value.trim()}"를 찾을 수 없습니다.`
          return
        }

        // 부품 정보 가져오기
        const { data: partInfo, error: partError } = await supabase
          .from('lego_parts')
          .select('part_num, name')
          .eq('part_num', setPart.part_id)
          .maybeSingle()

        if (partError) {
          throw new Error(`부품 정보 조회 실패: ${partError.message}`)
        }

        // 색상 정보 가져오기
        const { data: colorInfo, error: colorError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .eq('color_id', setPart.color_id)
          .maybeSingle()

        if (colorError) {
          throw new Error(`색상 정보 조회 실패: ${colorError.message}`)
        }

        // 부품 이미지 URL 조회: element_id 우선, 없으면 part_id + color_id, 마지막으로 part_img_url
        let partImageUrl = null
        const debugElementId = elementIdInput.value.trim()
        console.log('[PartToSetSearch] 이미지 로딩 시작 - element_id:', debugElementId, 'part_id:', setPart.part_id, 'color_id:', setPart.color_id)

        // 버킷 URL 생성 헬퍼 함수
        const getBucketImageUrl = (elementId, partId, colorId) => {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
          const bucketName = 'lego_parts_images'
          const fileName = elementId ? `${String(elementId)}.webp` : `${partId}_${colorId}.webp`
          const url = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
          console.log('[PartToSetSearch] 버킷 URL 생성:', { elementId, partId, colorId, fileName, url })
          return url
        }

        // Rebrickable CDN URL 생성 헬퍼 함수 (jpg 사용)
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          let url = null
          if (elementId) {
            url = `https://cdn.rebrickable.com/media/parts/elements/${String(elementId)}.jpg`
          } else if (partId && colorId !== null && colorId !== undefined) {
            url = `https://cdn.rebrickable.com/media/parts/${partId}/${colorId}.jpg`
          } else if (partId) {
            // partId만 있는 경우 (colorId가 0이거나 null일 수 있음)
            url = `https://cdn.rebrickable.com/media/parts/${partId}/0.jpg`
          }
          console.log('[PartToSetSearch] CDN URL 생성:', { elementId, partId, colorId, url })
          return url
        }

        // 버킷 이미지 존재 확인 헬퍼 함수
        const checkBucketImageExists = async (url) => {
          try {
            console.log('[PartToSetSearch] 버킷 이미지 존재 확인:', url)
            const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
            // 400, 404는 파일 없음으로 처리 (콘솔 오류 방지)
            if (response.status === 400 || response.status === 404) {
              console.log('[PartToSetSearch] 버킷 이미지 없음 (400/404):', response.status)
              return false
            }
            const exists = response.ok
            console.log('[PartToSetSearch] 버킷 이미지 존재 여부:', exists, 'status:', response.status)
            return exists
          } catch (err) {
            console.log('[PartToSetSearch] 버킷 이미지 확인 실패:', err)
            return false
          }
        }
        
        if (elementIdInput.value.trim()) {
          // element_id로 먼저 조회
          console.log('[PartToSetSearch] part_images 테이블에서 element_id로 조회:', elementIdInput.value.trim())
          const { data: partImageByElement, error: elementError } = await supabase
            .from('part_images')
            .select('uploaded_url')
            .eq('element_id', String(elementIdInput.value.trim()))
            .maybeSingle()

          console.log('[PartToSetSearch] part_images 조회 결과:', { error: elementError, data: partImageByElement })

          if (!elementError && partImageByElement?.uploaded_url) {
            const uploadedUrl = partImageByElement.uploaded_url
            console.log('[PartToSetSearch] part_images에서 uploaded_url 발견:', uploadedUrl)
            // 버킷 URL인지 확인
            const isBucketUrl = uploadedUrl.includes('/storage/v1/object/public/lego_parts_images/')
            if (isBucketUrl && !uploadedUrl.toLowerCase().endsWith('.jpg')) {
              partImageUrl = uploadedUrl
              console.log('[PartToSetSearch] 버킷 URL 사용:', partImageUrl)
            } else if (!isBucketUrl) {
              // CDN/API URL이면 버킷에 저장된 이미지 확인
              const bucketUrl = getBucketImageUrl(elementIdInput.value.trim(), null, null)
              console.log('[PartToSetSearch] 버킷 직접 확인 시도:', bucketUrl)
              const exists = await checkBucketImageExists(bucketUrl)
              console.log('[PartToSetSearch] 버킷 존재 여부:', exists)
              if (exists) {
                partImageUrl = bucketUrl
                console.log('[PartToSetSearch] 버킷 URL 사용:', partImageUrl)
              } else {
                partImageUrl = uploadedUrl
                console.log('[PartToSetSearch] uploaded_url 사용:', partImageUrl)
              }
            }
          } else {
            console.log('[PartToSetSearch] part_images에서 이미지 없음')
          }
        }

        // element_id로 찾지 못했으면 part_id + color_id로 조회
        if (!partImageUrl) {
          console.log('[PartToSetSearch] part_id + color_id로 조회:', setPart.part_id, setPart.color_id)
          const { data: partImage, error: partImageError } = await supabase
            .from('part_images')
            .select('uploaded_url')
            .eq('part_id', setPart.part_id)
            .eq('color_id', setPart.color_id)
            .maybeSingle()

          console.log('[PartToSetSearch] part_id+color_id 조회 결과:', { error: partImageError, data: partImage })

          if (!partImageError && partImage?.uploaded_url) {
            const uploadedUrl = partImage.uploaded_url
            console.log('[PartToSetSearch] part_id+color_id에서 uploaded_url 발견:', uploadedUrl)
            // 버킷 URL인지 확인
            const isBucketUrl = uploadedUrl.includes('/storage/v1/object/public/lego_parts_images/')
            if (isBucketUrl && !uploadedUrl.toLowerCase().endsWith('.jpg')) {
              partImageUrl = uploadedUrl
              console.log('[PartToSetSearch] 버킷 URL 사용:', partImageUrl)
            } else if (!isBucketUrl) {
              // CDN/API URL이면 버킷에 저장된 이미지 확인
              const bucketUrl = getBucketImageUrl(null, setPart.part_id, setPart.color_id)
              console.log('[PartToSetSearch] 버킷 직접 확인 시도:', bucketUrl)
              const exists = await checkBucketImageExists(bucketUrl)
              console.log('[PartToSetSearch] 버킷 존재 여부:', exists)
              if (exists) {
                partImageUrl = bucketUrl
                console.log('[PartToSetSearch] 버킷 URL 사용:', partImageUrl)
              } else {
                partImageUrl = uploadedUrl
                console.log('[PartToSetSearch] uploaded_url 사용:', partImageUrl)
              }
            }
          } else {
            console.log('[PartToSetSearch] part_id+color_id에서 이미지 없음')
          }
        }

        // part_images에 없으면 버킷 직접 확인
        if (!partImageUrl) {
          console.log('[PartToSetSearch] part_images에 없음, 버킷 직접 확인 시작')
          const bucketUrl = elementIdInput.value.trim()
            ? getBucketImageUrl(elementIdInput.value.trim(), setPart.part_id, setPart.color_id)
            : getBucketImageUrl(null, setPart.part_id, setPart.color_id)
          console.log('[PartToSetSearch] 버킷 직접 확인 URL:', bucketUrl)
          const exists = await checkBucketImageExists(bucketUrl)
          console.log('[PartToSetSearch] 버킷 직접 확인 결과:', exists)
          if (exists) {
            partImageUrl = bucketUrl
            console.log('[PartToSetSearch] 버킷 직접 확인 성공, URL 설정:', partImageUrl)
          } else {
            console.log('[PartToSetSearch] 버킷 직접 확인 실패')
          }
        } else {
          console.log('[PartToSetSearch] 이미지 URL 설정됨 (part_images):', partImageUrl)
        }

        // 버킷에도 없으면 Rebrickable CDN으로 폴백
        if (!partImageUrl) {
          console.log('[PartToSetSearch] 버킷에도 없음, CDN 폴백 시작')
          const elementId = elementIdInput.value.trim() || null
          console.log('[PartToSetSearch] CDN 폴백 파라미터:', { elementId, partId: setPart.part_id, colorId: setPart.color_id })
          partImageUrl = getRebrickableCdnUrl(elementId, setPart.part_id, setPart.color_id)
          console.log('[PartToSetSearch] getRebrickableCdnUrl 결과:', partImageUrl)
          // CDN URL도 없으면 element_id만으로 시도
          if (!partImageUrl && elementId) {
            partImageUrl = `https://cdn.rebrickable.com/media/parts/elements/${elementId}.jpg`
            console.log('[PartToSetSearch] element_id만으로 CDN URL 생성:', partImageUrl)
          }
        }

        console.log('[PartToSetSearch] 최종 이미지 URL:', partImageUrl)

        // 세트 찾기
        const allSets = await findSetsByPart(setPart.part_id, setPart.color_id)
        let sets = allSets
        
        // 로그인 상태일 때만 매장 보유 세트만 필터링
        if (user.value && inventorySetNumbers.value.size > 0) {
          sets = allSets.filter(set => {
            const setNum = set.set_num
            // 세트 번호 정규화 (하이픈 제거하여 비교)
            const normalizedSetNum = setNum.replace(/-.*$/, '')
            return inventorySetNumbers.value.has(setNum) || inventorySetNumbers.value.has(normalizedSetNum)
          })
          console.log(`[PartToSetSearch] 매장 보유 세트 필터링: ${sets.length}개 (전체: ${allSets.length}개)`)
        } else {
          // 로그아웃 상태: 전체 레고 세트에서 검색
          console.log('[PartToSetSearch] 로그아웃 상태 - 전체 레고 세트에서 검색')
        }
        
        // 기본 검색 결과 먼저 표시 (세트 목록)
        console.log('[PartToSetSearch] searchResult 설정:', { 
          element_id: elementIdInput.value.trim(), 
          part_id: setPart.part_id, 
          color_id: setPart.color_id,
          part_image_url: partImageUrl 
        })
        searchResult.value = {
          element_id: elementIdInput.value.trim(),
          part_id: setPart.part_id,
          color_id: setPart.color_id,
          part_name: partInfo?.name || setPart.part_id,
          color_name: colorInfo?.name || `Color ${setPart.color_id}`,
          color_rgb: colorInfo?.rgb || null,
          part_image_url: partImageUrl,
          sets: sets,
          alternatives: null // 나중에 업데이트
        }
        console.log('[PartToSetSearch] searchResult.value 설정 완료:', searchResult.value)
        
        // 유사부품 찾기 (백그라운드에서 실행, element_id 포함)
        const alternatives = await findAlternativeParts(setPart.part_id, setPart.color_id)

        // 유사부품의 각 색상별 이미지 URL 로드 (배치 처리로 최적화)
        if (alternatives && alternatives.length > 0 && alternatives[0].colors) {
          const colors = alternatives[0].colors
          const partId = alternatives[0].part_id
          
          // 1. element_id 목록 수집 (findAlternativeParts에서 이미 조회됨)
          const elementIds = colors
            .map(c => c.element_id)
            .filter(Boolean)
            .map(id => String(id))

          // 2. element_id로 이미지 배치 조회 (버킷 URL 우선)
          const elementImageMap = new Map()
          if (elementIds.length > 0) {
            // 버킷 URL 생성 헬퍼 함수
            const getBucketImageUrl = (elementId) => {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
              const bucketName = 'lego_parts_images'
              const fileName = `${String(elementId)}.webp`
              return `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
            }

            // 버킷 이미지 존재 확인 헬퍼 함수
            const checkBucketImageExists = async (url) => {
              try {
                const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
                return response.ok
              } catch {
                return false
              }
            }

            const { data: elementImages, error: elementImagesError } = await supabase
              .from('part_images')
              .select('element_id, uploaded_url')
              .in('element_id', elementIds)
              .not('uploaded_url', 'is', null)

            if (!elementImagesError && elementImages) {
              for (const img of elementImages) {
                if (img.element_id && img.uploaded_url) {
                  const elementId = String(img.element_id)
                  // 버킷 URL인지 확인
                  const isBucketUrl = img.uploaded_url.includes('/storage/v1/object/public/lego_parts_images/')
                  if (isBucketUrl && !img.uploaded_url.toLowerCase().endsWith('.jpg')) {
                    elementImageMap.set(elementId, img.uploaded_url)
                  } else if (!isBucketUrl) {
                    // CDN/API URL이면 버킷에 저장된 이미지 확인
                    const bucketUrl = getBucketImageUrl(elementId)
                    const exists = await checkBucketImageExists(bucketUrl)
                    if (exists) {
                      elementImageMap.set(elementId, bucketUrl)
                    }
                  }
                }
              }
            }

            // part_images에 없으면 버킷 직접 확인
            const missingElementIds = elementIds.filter(id => !elementImageMap.has(id))
            for (const elementId of missingElementIds) {
              const bucketUrl = getBucketImageUrl(elementId)
              const exists = await checkBucketImageExists(bucketUrl)
              if (exists) {
                elementImageMap.set(elementId, bucketUrl)
              }
            }
          }

          // 3. element_id로 찾지 못한 색상들을 part_id + color_id로 배치 조회 (버킷 URL 우선)
          const colorsWithoutImage = colors.filter(c => !c.element_id || !elementImageMap.has(String(c.element_id)))
          if (colorsWithoutImage.length > 0) {
            // 버킷 URL 생성 헬퍼 함수
            const getBucketImageUrl = (partId, colorId) => {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
              const bucketName = 'lego_parts_images'
              const fileName = `${partId}_${colorId}.webp`
              return `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
            }

            // 버킷 이미지 존재 확인 헬퍼 함수
            const checkBucketImageExists = async (url) => {
              try {
                const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
                return response.ok
              } catch {
                return false
              }
            }

            const missingColorIds = colorsWithoutImage.map(c => c.color_id).filter(Boolean)
            if (missingColorIds.length > 0) {
              const { data: partImages, error: partImagesError } = await supabase
                .from('part_images')
                .select('part_id, color_id, uploaded_url')
                .eq('part_id', partId)
                .in('color_id', missingColorIds)
                .not('uploaded_url', 'is', null)

              if (!partImagesError && partImages) {
                const partColorImageMap = new Map()
                for (const img of partImages) {
                  const key = `${img.part_id}_${img.color_id}`
                  if (!partColorImageMap.has(key)) {
                    // 버킷 URL인지 확인
                    const isBucketUrl = img.uploaded_url.includes('/storage/v1/object/public/lego_parts_images/')
                    if (isBucketUrl && !img.uploaded_url.toLowerCase().endsWith('.jpg')) {
                      partColorImageMap.set(key, img.uploaded_url)
                    } else if (!isBucketUrl) {
                      // CDN/API URL이면 버킷에 저장된 이미지 확인
                      const bucketUrl = getBucketImageUrl(img.part_id, img.color_id)
                      const exists = await checkBucketImageExists(bucketUrl)
                      if (exists) {
                        partColorImageMap.set(key, bucketUrl)
                      }
                    }
                  }
                }

                // part_images에 없으면 버킷 직접 확인
                for (const color of colorsWithoutImage) {
                  const key = `${partId}_${color.color_id}`
                  if (!partColorImageMap.has(key)) {
                    const bucketUrl = getBucketImageUrl(partId, color.color_id)
                    const exists = await checkBucketImageExists(bucketUrl)
                    if (exists) {
                      partColorImageMap.set(key, bucketUrl)
                    }
                  }
                }

                // 이미지 URL 할당
                colorsWithoutImage.forEach(color => {
                  const key = `${partId}_${color.color_id}`
                  if (partColorImageMap.has(key)) {
                    color.image_url = partColorImageMap.get(key)
                  }
                })
              }
            }
          }

          // 4. 이미지 URL 할당 (element_id 우선, 버킷 직접 확인)
          for (const color of colors) {
            if (!color.image_url) {
              if (color.element_id && elementImageMap.has(String(color.element_id))) {
                color.image_url = elementImageMap.get(String(color.element_id))
              } else {
                // 버킷 직접 확인
                const getBucketImageUrl = (elementId, partId, colorId) => {
                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
                  const bucketName = 'lego_parts_images'
                  const fileName = elementId ? `${String(elementId)}.webp` : `${partId}_${colorId}.webp`
                  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
                }

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

                const bucketUrl = color.element_id
                  ? getBucketImageUrl(color.element_id, alternatives[0].part_id, color.color_id)
                  : getBucketImageUrl(null, alternatives[0].part_id, color.color_id)
                const exists = await checkBucketImageExists(bucketUrl)
                if (exists) {
                  color.image_url = bucketUrl
                } else {
                  // 버킷에 없으면 Rebrickable CDN으로 폴백
                  color.image_url = getRebrickableCdnUrl(color.element_id, alternatives[0].part_id, color.color_id)
                }
              }
            }
          }
        }

        // 유사부품 정보 업데이트
        if (searchResult.value) {
          searchResult.value.alternatives = alternatives
        }
      } catch (err) {
        error.value = err.message || '검색 중 오류가 발생했습니다.'
        console.error('검색 실패:', err)
      }
    }

    const openSetPartsModal = async (set) => {
      selectedSet.value = set
      
      // 부품 정보가 있는지 확인
      try {
        const partsStatus = await checkSetPartsExist(set.set_num)
        
        if (!partsStatus.partsExist) {
          // 부품 정보가 없으면 모달 표시
          showSyncModal.value = true
          syncSetNum.value = set.set_num
          syncCompleted.value = false
          syncPartsCount.value = 0
          return
        }
      } catch (checkError) {
        console.error(`[PartToSetSearch] 부품 정보 확인 실패:`, checkError)
        // 확인 실패해도 계속 진행
      }
      
      showSetPartsModal.value = true
      setParts.value = []
      setPartsError.value = null
      setPartsLoading.value = true

      try {
        // 세트의 모든 부품 조회
        const { data: partsData, error: partsError } = await supabase
          .from('set_parts')
          .select('part_id, color_id, quantity, element_id')
          .eq('set_id', set.id)

        if (partsError) throw partsError

        if (!partsData || partsData.length === 0) {
          setParts.value = []
          setPartsLoading.value = false
          return
        }

        // 예비부품 제외
        const nonSpareParts = partsData.filter(p => !p.is_spare)

        // 부품 정보와 색상 정보를 병렬로 조회
        const partIds = [...new Set(nonSpareParts.map(p => p.part_id).filter(Boolean))]
        const colorIds = [...new Set(nonSpareParts.map(p => p.color_id).filter(id => id !== null && id !== undefined))]

        const [partsInfoResult, colorsInfoResult] = await Promise.all([
          partIds.length > 0 ? supabase
            .from('lego_parts')
            .select('part_num, name, part_img_url')
            .in('part_num', partIds) : Promise.resolve({ data: [], error: null }),
          colorIds.length > 0 ? supabase
            .from('lego_colors')
            .select('color_id, name, rgb')
            .in('color_id', colorIds) : Promise.resolve({ data: [], error: null })
        ])

        if (partsInfoResult.error) throw partsInfoResult.error
        if (colorsInfoResult.error) throw colorsInfoResult.error

        const partsInfo = partsInfoResult.data || []
        const colorsInfo = colorsInfoResult.data || []

        // 부품 이미지 URL 조회
        const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
        const colorsInfoMap = new Map(colorsInfo.map(c => [c.color_id, c]))

        // 버킷 URL 생성 헬퍼 함수
        const getBucketImageUrl = (elementId, partId, colorId) => {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
          const bucketName = 'lego_parts_images'
          const fileName = elementId ? `${String(elementId)}.webp` : `${partId}_${colorId}.webp`
          return `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
        }

        // Rebrickable CDN URL 생성 헬퍼 함수
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          if (elementId) {
            return `https://cdn.rebrickable.com/media/parts/elements/${elementId}.jpg`
          } else if (partId && colorId !== null && colorId !== undefined) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/${colorId}.jpg`
          } else if (partId) {
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

        // element_id 목록 수집
        const elementIds = [...new Set(partsData.map(p => p.element_id).filter(Boolean))].map(id => String(id))
        
        // element_id 기반 이미지 배치 조회 (병렬 처리로 최적화)
        const elementImageMap = new Map()
        if (elementIds.length > 0) {
          // part_images와 image_metadata를 병렬로 조회
          const [elementImagesResult, elementMetadataResult] = await Promise.all([
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
          ])

          // part_images 결과 처리
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

          // image_metadata 결과 처리 (part_images에 없는 것만)
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

          // 버킷 직접 확인은 제거 (DB에서 이미 확인했으므로)
        }

        // part_id + color_id 기반 이미지 배치 조회
        const partColorImageMap = new Map()
        const partIdsForImages = [...new Set(nonSpareParts.map(p => p.part_id).filter(Boolean))]
        const colorIdsForImages = [...new Set(nonSpareParts.map(p => p.color_id).filter(id => id !== null && id !== undefined))]

        if (partIdsForImages.length > 0 && colorIdsForImages.length > 0) {
          // part_images와 image_metadata를 병렬로 조회
          const [partImagesResult, metadataImagesResult] = await Promise.all([
            supabase
              .from('part_images')
              .select('part_id, color_id, uploaded_url')
              .in('part_id', partIdsForImages)
              .in('color_id', colorIdsForImages)
              .not('uploaded_url', 'is', null),
            supabase
              .from('image_metadata')
              .select('part_num, color_id, supabase_url')
              .in('part_num', partIdsForImages)
              .in('color_id', colorIdsForImages)
              .not('supabase_url', 'is', null)
          ])

          // part_images 결과 처리
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

          // image_metadata 결과 처리 (part_images에 없는 것만)
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

          // 버킷 직접 확인은 제거 (DB에서 이미 확인했으므로)
        }

        // 부품 데이터와 이미지 URL 매핑 (동기 처리로 최적화)
        const partsWithImages = nonSpareParts.map((part) => {
          const partInfo = partsInfoMap.get(part.part_id)
          const colorInfo = colorsInfoMap.get(part.color_id)

          // 이미지 URL 결정: element_id 우선, 없으면 part_id + color_id
          let imageUrl = null
          if (part.element_id && elementImageMap.has(String(part.element_id))) {
            imageUrl = elementImageMap.get(String(part.element_id))
          }
          
          if (!imageUrl && part.part_id && part.color_id !== null && part.color_id !== undefined) {
            const key = `${part.part_id}_${part.color_id}`
            if (partColorImageMap.has(key)) {
              imageUrl = partColorImageMap.get(key)
            }
          }

          // 버킷에도 없으면 Rebrickable CDN으로 폴백
          if (!imageUrl) {
            const elementId = part.element_id ? String(part.element_id) : null
            imageUrl = getRebrickableCdnUrl(elementId, part.part_id, part.color_id)
            if (!imageUrl && elementId) {
              imageUrl = `https://cdn.rebrickable.com/media/parts/elements/${elementId}.jpg`
            }
          }

          return {
            part_id: part.part_id,
            color_id: part.color_id,
            quantity: part.quantity,
            element_id: part.element_id,
            part_name: partInfo?.name || part.part_id,
            color_name: colorInfo?.name || null,
            color_rgb: colorInfo?.rgb || null,
            image_url: imageUrl
          }
        })

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

        setParts.value = sortParts(partsWithImages)
      } catch (err) {
        setPartsError.value = err.message || '부품 목록을 불러오는 중 오류가 발생했습니다.'
        console.error('부품 목록 조회 실패:', err)
      } finally {
        setPartsLoading.value = false
      }
    }

    const closeSetPartsModal = () => {
      showSetPartsModal.value = false
      selectedSet.value = null
      setParts.value = []
      setPartsError.value = null
    }

    const resetPage = () => {
      elementIdInput.value = ''
      searchResult.value = null
      error.value = null
      showSetPartsModal.value = false
      selectedSet.value = null
      setParts.value = []
    }

    const searchByAlternativeElementId = async (elementId) => {
      if (!elementId) return
      
      elementIdInput.value = String(elementId)
      await searchByElementId()
      
      // 검색 결과로 스크롤
      setTimeout(() => {
      }, 100)
    }
    
    const searchByQueryParams = async () => { // 🔧 수정됨
      const { element, element_id: elementIdAlias, part, color } = route.query // 🔧 수정됨
      const signature = JSON.stringify({ element, elementIdAlias, part, color }) // 🔧 수정됨
      if (signature === lastQuerySignature.value) return // 🔧 수정됨
      lastQuerySignature.value = signature // 🔧 수정됨
      
      const elementParam = element ?? elementIdAlias // 🔧 수정됨
      if (elementParam) { // 🔧 수정됨
        const normalizedElementId = String(elementParam).trim() // 🔧 수정됨
        if (normalizedElementId) { // 🔧 수정됨
          elementIdInput.value = normalizedElementId // 🔧 수정됨
          await searchByElementId() // 🔧 수정됨
        }
        return // 🔧 수정됨
      }
      
      if (part) { // 🔧 수정됨
        const normalizedPartId = String(part).trim() // 🔧 수정됨
        if (!normalizedPartId) return // 🔧 수정됨
        const resolvedElementId = await resolveElementIdByPart(normalizedPartId, color ?? null) // 🔧 수정됨
        if (resolvedElementId) { // 🔧 수정됨
          elementIdInput.value = resolvedElementId // 🔧 수정됨
          await searchByElementId() // 🔧 수정됨
        }
      }
    }

    const handleImageError = (event) => {
      event.target.style.display = 'none'
    }

    const getColorRgb = (rgb) => {
      if (!rgb) return null
      let rgbStr = String(rgb).trim()
      if (rgbStr && !rgbStr.startsWith('#')) {
        rgbStr = `#${rgbStr}`
      }
      return rgbStr || null
    }

    const getColorTextColor = (rgb) => {
      if (!rgb) return '#ffffff'
      let rgbStr = String(rgb).trim()
      if (rgbStr && !rgbStr.startsWith('#')) {
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

    // CDN URL인지 확인하는 함수
    const isCdnUrl = (url) => {
      if (!url) return false
      return url.includes('cdn.rebrickable.com')
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
      
      // RGB 값을 추출
      const r = parseInt(rgbStr.substring(1, 3), 16)
      const g = parseInt(rgbStr.substring(3, 5), 16)
      const b = parseInt(rgbStr.substring(5, 7), 16)
      
      // 상대적 밝기 계산 (0-255)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      
      // 밝기가 128보다 크면 어두운 텍스트, 작으면 밝은 텍스트
      return brightness > 128 ? '#1f2937' : '#ffffff'
    }

    const handlePartImageError = async (event) => {
      const img = event.target
      const originalSrc = img.src
      const partCard = img.closest('.alternative-part-card')
      
      console.log('[PartToSetSearch] 이미지 로드 실패:', { originalSrc, hasPartCard: !!partCard })
      
      if (!partCard) {
        // 검색 결과 이미지인 경우 - Rebrickable CDN으로 폴백
        console.log('[PartToSetSearch] 검색 결과 이미지 로드 실패, CDN 폴백 시도')
        if (searchResult.value && originalSrc) {
          console.log('[PartToSetSearch] searchResult.value:', searchResult.value)
          const getRebrickableCdnUrl = (elementId, partId, colorId) => {
            // elementId를 문자열로 변환하여 처리 (jpg 사용)
            if (elementId) {
              return `https://cdn.rebrickable.com/media/parts/elements/${String(elementId)}.jpg`
            } else if (partId && colorId !== null && colorId !== undefined) {
              return `https://cdn.rebrickable.com/media/parts/${partId}/${colorId}.jpg`
            } else if (partId) {
              return `https://cdn.rebrickable.com/media/parts/${partId}/0.jpg`
            }
            return null
          }
          
          const cdnUrl = getRebrickableCdnUrl(
            searchResult.value.element_id,
            searchResult.value.part_id,
            searchResult.value.color_id
          )
          
          console.log('[PartToSetSearch] CDN 폴백 URL:', { 
            element_id: searchResult.value.element_id,
            part_id: searchResult.value.part_id,
            color_id: searchResult.value.color_id,
            cdnUrl,
            originalSrc,
            willRetry: cdnUrl && cdnUrl !== originalSrc
          })
          
          if (cdnUrl && cdnUrl !== originalSrc) {
            console.log('[PartToSetSearch] CDN URL로 재시도:', cdnUrl)
            img.src = cdnUrl
            return
          } else {
            console.log('[PartToSetSearch] CDN URL 재시도 불가:', { cdnUrl, originalSrc })
          }
        } else {
          console.log('[PartToSetSearch] searchResult.value 없음 또는 originalSrc 없음')
        }
        console.log('[PartToSetSearch] 이미지 숨김 처리')
        img.style.display = 'none'
        return
      }

      const colorId = partCard.dataset.colorId
      const partId = partCard.dataset.partId
      if (!colorId || !partId) {
        img.style.display = 'none'
        return
      }

      // 이미지 로드 실패 시 숨김 처리
      img.style.display = 'none'
    }

    const handleSyncConfirm = async () => {
      try {
        syncCompleted.value = false
        const result = await syncSetParts(syncSetNum.value, true)
        if (result && result.success) {
          syncCompleted.value = true
          syncPartsCount.value = result.partsCount || 0
        }
      } catch (err) {
        console.error('[PartToSetSearch] 동기화 실패:', err)
      }
    }
    
    const handleSyncClose = () => {
      showSyncModal.value = false
      syncSetNum.value = ''
      syncCompleted.value = false
      syncPartsCount.value = 0
      if (selectedSet.value) {
        openSetPartsModal(selectedSet.value)
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

    // 부품 정보 모달 관련 함수
    const showPartInfo = async (part) => {
      if (!part) return

      selectedPart.value = {
        ...part,
        part_img_url: part.image_url || null
      }
      showPartInfoModal.value = true

      partSetsLoading.value = true
      try {
        const allPartSets = await findSetsByPart(part.part_id, part.color_id)
        
        // 로그인 상태일 때만 매장 보유 세트만 필터링
        if (user.value && inventorySetNumbers.value.size > 0) {
          partSets.value = allPartSets.filter(set => {
            const setNum = set.set_num
            const normalizedSetNum = setNum.replace(/-.*$/, '')
            return inventorySetNumbers.value.has(setNum) || inventorySetNumbers.value.has(normalizedSetNum)
          })
        } else {
          // 로그아웃 상태: 전체 레고 세트
          partSets.value = allPartSets
        }
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

    const handleSetRowClick = async (set) => {
      if (!set || !set.set_num) return
      closePartInfoModal()
      // 세트 번호로 검색하도록 변경 (부품 정보 모달에서 세트 클릭 시)
      // 여기서는 부품 정보만 표시하므로 모달만 닫기
    }

    const handleAlternativePartClick = (alt) => {
      if (!alt) return
      closePartInfoModal()
      if (alt.colors && alt.colors.length > 0 && alt.colors[0].element_id) {
        searchByAlternativeElementId(alt.colors[0].element_id)
      }
    }

    // 최근 등록 부품 로드
    const loadRecentParts = async () => {
      try {
        // part_images 테이블에서 최근 등록된 부품 조회 (created_at 기준)
        const { data: recentImages, error: recentImagesError } = await supabase
          .from('part_images')
          .select('part_id, color_id, element_id, uploaded_url, created_at')
          .not('uploaded_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200) // 최대 200개만 조회

        if (recentImagesError) throw recentImagesError

        if (!recentImages || recentImages.length === 0) {
          recentParts.value = []
          return
        }

        // 부품 정보 조회
        const partIds = [...new Set(recentImages.map(img => img.part_id).filter(Boolean))]
        const { data: partsInfo, error: partsInfoError } = await supabase
          .from('lego_parts')
          .select('part_num, name')
          .in('part_num', partIds)

        if (partsInfoError) throw partsInfoError

        // 색상 정보 조회
        const colorIds = [...new Set(recentImages.map(img => img.color_id).filter(id => id !== null && id !== undefined))]
        const { data: colorsInfo, error: colorsError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .in('color_id', colorIds)

        if (colorsError) throw colorsError

        const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
        const colorsInfoMap = new Map(colorsInfo.map(c => [c.color_id, c]))

        // 버킷 URL 생성 헬퍼 함수
        const getBucketImageUrl = (elementId, partId, colorId) => {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
          const bucketName = 'lego_parts_images'
          const fileName = elementId ? `${String(elementId)}.webp` : `${partId}_${colorId}.webp`
          return `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
        }

        // Rebrickable CDN URL 생성 헬퍼 함수
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          if (elementId) {
            return `https://cdn.rebrickable.com/media/parts/elements/${elementId}.jpg`
          } else if (partId && colorId !== null && colorId !== undefined) {
            return `https://cdn.rebrickable.com/media/parts/${partId}/${colorId}.jpg`
          } else if (partId) {
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

        // 부품 데이터 구성
        const partsWithData = await Promise.all(recentImages.map(async (img) => {
          const partInfo = partsInfoMap.get(img.part_id)
          const colorInfo = colorsInfoMap.get(img.color_id)
          
          let imageUrl = null
          
          // uploaded_url이 버킷 URL인지 확인
          if (img.uploaded_url) {
            const isBucketUrl = img.uploaded_url.includes('/storage/v1/object/public/lego_parts_images/')
            if (isBucketUrl && !img.uploaded_url.toLowerCase().endsWith('.jpg')) {
              imageUrl = img.uploaded_url
            } else if (!isBucketUrl) {
              // CDN/API URL이면 버킷에 저장된 이미지 확인
              const bucketUrl = img.element_id
                ? getBucketImageUrl(img.element_id, img.part_id, img.color_id)
                : getBucketImageUrl(null, img.part_id, img.color_id)
              const exists = await checkBucketImageExists(bucketUrl)
              if (exists) {
                imageUrl = bucketUrl
              }
            }
          }

          // 버킷 직접 확인
          if (!imageUrl) {
            const bucketUrl = img.element_id
              ? getBucketImageUrl(img.element_id, img.part_id, img.color_id)
              : getBucketImageUrl(null, img.part_id, img.color_id)
            const exists = await checkBucketImageExists(bucketUrl)
            if (exists) {
              imageUrl = bucketUrl
            }
          }

          // 버킷에도 없으면 Rebrickable CDN으로 폴백
          if (!imageUrl) {
            imageUrl = getRebrickableCdnUrl(img.element_id, img.part_id, img.color_id)
          }

          return {
            part_id: img.part_id,
            color_id: img.color_id,
            element_id: img.element_id,
            part_name: partInfo?.name || img.part_id,
            color_name: colorInfo ? (colorInfo.name || null) : null,
            color_rgb: colorInfo?.rgb || null,
            image_url: imageUrl
          }
        }))

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

        recentParts.value = sortParts(partsWithData)
      } catch (err) {
        console.error('최근 등록 부품 로드 실패:', err)
        recentParts.value = []
      }
    }

    // 최근 등록 부품 페이지네이션
    const recentPartsTotalPages = computed(() => {
      return Math.ceil(recentParts.value.length / recentPartsItemsPerPage)
    })

    const paginatedRecentParts = computed(() => {
      const start = (recentPartsCurrentPage.value - 1) * recentPartsItemsPerPage
      const end = start + recentPartsItemsPerPage
      return recentParts.value.slice(start, end)
    })

    const recentPartsVisiblePages = computed(() => {
      const pages = []
      const total = recentPartsTotalPages.value
      const current = recentPartsCurrentPage.value
      
      if (total <= 7) {
        for (let i = 1; i <= total; i++) {
          pages.push(i)
        }
      } else {
        if (current <= 3) {
          for (let i = 1; i <= 5; i++) {
            pages.push(i)
          }
          pages.push('...')
          pages.push(total)
        } else if (current >= total - 2) {
          pages.push(1)
          pages.push('...')
          for (let i = total - 4; i <= total; i++) {
            pages.push(i)
          }
        } else {
          pages.push(1)
          pages.push('...')
          for (let i = current - 1; i <= current + 1; i++) {
            pages.push(i)
          }
          pages.push('...')
          pages.push(total)
        }
      }
      
      return pages
    })

    const goToRecentPartsPage = (page) => {
      if (page < 1 || page > recentPartsTotalPages.value || page === recentPartsCurrentPage.value) return
      recentPartsCurrentPage.value = page
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // 사용자 변경 시 매장 인벤토리 로드
    watch(user, async (newUser) => {
      if (newUser) {
        await loadStoreInventory()
      } else {
        storeInfo.value = null
        storeInventory.value = []
      }
    }, { immediate: true })
    
    watch(() => route.query, () => { // 🔧 수정됨
      searchByQueryParams() // 🔧 수정됨
    }, { immediate: true }) // 🔧 수정됨
    
    onMounted(async () => {
      if (user.value) {
        await loadStoreInventory()
      }
      await loadRecentParts()
    })

    return {
      elementIdInput,
      searchResult,
      resetPage,
      error,
      loading,
      searchByElementId,
      searchTooltip,
      openSetPartsModal,
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
      closeSetPartsModal,
      searchByAlternativeElementId,
      handleImageError,
      getColorRgb,
      getColorTextColor,
      getContrastColor,
      formatColorLabel,
      handlePartImageError,
      showSetPartsModal,
      selectedSet,
      setParts,
      setPartsLoading,
      setPartsError,
      formatSetDisplay,
      formatSetNumber,
      recentParts,
      paginatedRecentParts,
      recentPartsCurrentPage,
      recentPartsTotalPages,
      recentPartsVisiblePages,
      goToRecentPartsPage,
      showPartInfo,
      closePartInfoModal,
      showPartInfoModal,
      selectedPart,
      partSets,
      partSetsLoading,
      alternativeParts,
      alternativePartsLoading,
      handleSetRowClick,
      handleAlternativePartClick,
      isCdnUrl
    }
  }
}
</script>

<style scoped>
.part-to-set-search-page {
  min-height: 100vh;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  padding: 2rem;
}

.layout-container {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  margin-bottom: 2rem;
  padding: 0;
}

.search-content {
  flex: 1;
  padding: 0;
  overflow-y: auto;
  width: 100%;
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

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.card-header p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
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

.error-message {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  margin-bottom: 2rem;
}

.result-section {
  margin-top: 1.5rem;
  width: 100%;
  max-width: 100%;
}

.result-header {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.result-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.recent-parts-section {
  margin-top: 2rem;
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


.set-search-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-part-card {
  margin-top: 0.75rem;
  margin-bottom: 0;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.25rem; /* // 🔧 수정됨 */
  position: relative;
}

.part-image-container {
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

.part-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  padding: 0.5rem;
}

.no-part-image {
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

.part-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}


.element-id-badge {
  display: block;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #111827;
}

.part-name-text {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #374151;
  line-height: 1.4;
  word-break: break-word;
}

.result-color-badge {
  display: inline-block;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  border: none;
  width: fit-content;
  line-height: 1.1;
  margin-top: 0.25rem;
}

.part-color {
  padding: 0.25rem 0.75rem;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #6b7280;
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

@media (max-width: 1024px) {
  .sets-grid {
    grid-template-columns: repeat(2, 1fr);
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
}

.set-name-divider {
  white-space: nowrap;
  flex-shrink: 0;
}

.set-name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.set-theme-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  line-height: 1.4;
}

.set-name-divider {
  font-size: 0.875rem;
  color: #d1d5db;
  line-height: 1.4;
}

.set-name-text {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.set-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.set-number {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.set-quantity {
  font-size: 0.875rem;
  color: #3b82f6;
  font-weight: 500;
}

.empty-result {
  padding: 3rem;
  text-align: center;
  color: #6b7280;
}

.alternatives-section {
  margin-top: 2rem;
  padding-top: 0; /* // 🔧 수정됨 */
  border-top: none; /* // 🔧 수정됨 */
}

.alternative-group {
  margin-bottom: 1rem;
}

.alternative-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 1.5rem 0;
}

.alternative-parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.5rem;
  max-width: 100%;
}

@media (min-width: 1400px) {
  .alternative-parts-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1200px) and (min-width: 900px) {
  .alternative-parts-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  }
}

@media (max-width: 900px) and (min-width: 600px) {
  .alternative-parts-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  }
}

.alternative-part-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
  cursor: pointer;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.alternative-part-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.alternative-part-card .card-header {
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

.alternative-part-card .part-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  width: 0;
}

.alternative-part-card .element-id {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.alternative-part-card .part-name {
  font-size: 1rem;
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

.alternative-part-card .color-badge { /* // 🔧 수정됨 */
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

.alternative-part-card .card-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.alternative-part-card .part-image-section {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 0;
  min-height: 120px;
  background: transparent;
  border-radius: 8px;
}

.alternative-part-card .part-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}

.alternative-part-card .no-part-image {
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

.color-badge {
  padding: 0.75rem;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.color-name-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.color-id-text {
  font-size: 0.75rem;
  color: #6b7280;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

@media (max-width: 1024px) {
  .search-section {
    max-width: 100%;
    margin-bottom: 1.5rem;
  }

  .result-section {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .page-header {
    margin-bottom: 1rem;
    padding: 1rem 0 0 0;
  }

  .part-to-set-search-page {
    padding: 1rem;
  }

  .search-section {
    max-width: 100%;
    margin-bottom: 1.5rem;
    padding: 0;
  }

  .setup-card {
    border-radius: 8px;
  }

  .card-header {
    padding: 1rem;
  }

  .card-header h3 {
    font-size: 1rem;
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

  .sets-grid {
    grid-template-columns: 1fr;
  }

  .alternative-parts-grid {
    grid-template-columns: 1fr;
  }

  /* 본문 폰트 사이즈 조정 */
  .part-name {
    font-size: 0.9375rem !important;
  }

  .alternative-part-card {
    padding: 1rem;
  }

  .alternative-part-card .card-header {
    display: flex !important;
    flex-direction: row !important;
    align-items: flex-start !important;
    gap: 0.5rem !important;
    overflow: visible !important;
  }

  .alternative-part-card .part-info {
    width: auto !important;
    flex: 1 !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  .alternative-part-card .part-name {
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    font-size: 0.875rem !important;
  }

  .alternative-part-card .element-id {
    display: block !important;
    font-size: 0.875rem !important;
  }

  .alternative-part-card .color-badge {
    display: inline-block !important;
    font-size: 0.8125rem !important;
  }

  .alternative-part-card .part-image-section {
    min-height: 100px;
    padding: 0.75rem 0;
  }

  .alternative-part-card .part-image {
    max-height: 150px;
  }

  .page-header h1 {
    font-size: 1.25rem !important;
  }

  .page-header p {
    font-size: 0.875rem !important;
  }

  .card-header h3 {
    font-size: 1rem !important;
  }

  .card-header p {
    font-size: 0.8125rem !important;
  }

  .set-search-input {
    font-size: 0.9375rem !important;
  }

  .search-button {
    font-size: 0.875rem !important;
  }

  /* 추가 본문 폰트 사이즈 조정 */
  .part-name-text {
    font-size: 0.9375rem !important;
  }

  .color-name-text {
    font-size: 0.875rem !important;
  }

  .color-id-text {
    font-size: 0.75rem !important;
  }

  .result-header h3 {
    font-size: 1.25rem !important;
  }


  .part-image-container {
    width: 80px !important;
    height: 80px !important;
    min-width: 80px !important;
    min-height: 80px !important;
  }

  .part-info {
    gap: 0.25rem;
  }

  .element-id-badge {
    font-size: 0.8125rem !important;
  }

  .part-name-text {
    font-size: 0.875rem !important;
  }

  .set-info {
    font-size: 0.875rem !important;
  }

  .alternative-title {
    font-size: 0.9375rem !important;
  }

  .element-id-badge {
    font-size: 0.8125rem !important;
  }

  .set-name {
    font-size: 0.9375rem !important;
  }

  .set-number {
    font-size: 0.875rem !important;
  }

  .set-quantity {
    font-size: 0.875rem !important;
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
  overflow-y: auto;
  flex: 1;
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
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1.5rem;
  max-width: 100%;
}

/* 모달 부품 그리드 (4열 유지) */
.modal-parts-grid {
  grid-template-columns: repeat(4, 1fr) !important;
}

@media (min-width: 1400px) {
  .parts-grid {
    grid-template-columns: repeat(5, 1fr);
  }
  
  .modal-parts-grid {
    grid-template-columns: repeat(4, 1fr) !important;
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

.part-image-container .cdn-badge {
  top: 4px;
  right: 4px;
  padding: 3px 6px;
  font-size: 0.65rem;
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

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.pagination-button {
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
.pagination-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-numbers {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pagination-number {
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
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination-number.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.pagination-ellipsis {
  color: #9ca3af;
  font-size: 0.875rem;
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.part-info-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  background: #ffffff;
  border-radius: 12px 12px 0 0;
}

.part-info-modal .modal-header h3 {
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

.part-info-modal .modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
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
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.alt-color-name {
  font-size: 0.8125rem;
  color: #374151;
}

.alt-element-id {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-left: auto;
}

.element-id-display {
  font-size: 1rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.element-id-display strong {
  color: #111827;
  font-weight: 600;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 1rem;
  }

  .modal-container {
    max-width: 100%;
    max-height: 100%;
  }

  .parts-grid {
    grid-template-columns: 1fr;
  }
}
</style>


