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
                      <div class="selected-set-parts-info">
                        <span class="selected-set-parts">부품수 : {{ resolvePartCount(selectedSet) }}개</span>
                        <span v-if="uniquePartsCount > 0" class="selected-set-parts-divider">|</span>
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
      </div>

      <!-- 매장 레고 리스트 -->
      <div v-if="!loading && !error && !setSearchQuery.trim() && !selectedSetId && storeSets.length > 0" class="store-sets-section">
        <div class="result-header">
          <h3>레고 리스트</h3>
        </div>
        <div v-if="showStoreSetsCdnOnly" class="store-sets-cdn-parts-section">
          <div v-if="loadingStoreSetsParts" class="loading-state">
            <span>부품 정보 수집 중... ({{ loadingStoreSetsProgress.current }}/{{ loadingStoreSetsProgress.total }})</span>
          </div>
          <div v-else-if="allStoreSetsCdnParts.length > 0" class="store-sets-cdn-parts-grid">
            <div
              v-for="part in allStoreSetsCdnParts"
              :key="`${part.part_id}-${part.color_id}-${part.set_num}`"
              class="part-card"
            >
              <div class="card-header">
                <div class="part-info">
                  <div v-if="part.element_id" class="element-id">
                    {{ part.element_id }}
                  </div>
                  <h4 class="part-name">{{ part.part_name }}</h4>
                  <span class="set-badge">{{ part.set_num }}</span>
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
                    @error="handleImageError"
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
          <div v-else-if="allStoreSetsParts.length > 0 && allStoreSetsCdnParts.length === 0" class="empty-cdn-parts">
            <p>CDN 이미지를 사용하는 부품이 없습니다.</p>
            <p class="empty-hint">모든 부품이 버킷에 저장된 이미지를 사용하고 있습니다.</p>
          </div>
          <div v-else class="empty-cdn-parts">
            <p>부품 데이터가 없습니다.</p>
            <p class="empty-hint">"전체 세트 부품 수집" 버튼을 클릭하여 부품 정보를 수집하세요.</p>
          </div>
        </div>
        <template v-else>
          <div class="sets-grid">
            <div
              v-for="set in paginatedStoreSets"
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
                  @click.stop="openSetPartsModal(set)"
                  :title="'부품 정보 보기'"
                >
                  <svg class="search-icon-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                  <span class="set-quantity">부품수 : {{ resolvePartCount(set) }}개</span>
                  <span v-if="set.quantity" class="inventory-badge">재고: {{ set.quantity }}개</span>
                </div>
              </div>
            </div>
          </div>
          <!-- 페이지네이션 -->
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
        </template>
        <!-- CDN 필터 (하단 우측, 관리자 전용) -->
        <div class="cdn-filter-bottom">
          <label class="filter-toggle-small">
            <input
              type="checkbox"
              v-model="showStoreSetsCdnOnly"
              @change="handleStoreSetsFilterChange"
            />
            <span>CDN만 출력</span>
            <span v-if="showStoreSetsCdnOnly" class="filter-count-small">({{ allStoreSetsCdnParts.length }})</span>
          </label>
          <button
            v-if="showStoreSetsCdnOnly && allStoreSetsCdnParts.length > 0 && !loadingStoreSetsParts"
            @click="convertAllStoreSetsCdnPartsToWebP"
            :disabled="convertingStoreSets"
            class="convert-button-small"
          >
            {{ convertingStoreSets ? `변환 중... (${convertStoreSetsProgress.current}/${convertStoreSetsProgress.total})` : `WebP 변환 (${allStoreSetsCdnParts.length}개)` }}
          </button>
        </div>
        <div v-if="loadingStoreSetsParts" class="loading-parts">
          부품 정보 수집 중... ({{ loadingStoreSetsProgress.current }}/{{ loadingStoreSetsProgress.total }})
        </div>
        <div v-if="convertingStoreSets" class="convert-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${(convertStoreSetsProgress.current / convertStoreSetsProgress.total) * 100}%` }"></div>
          </div>
          <div class="progress-text">{{ convertStoreSetsProgress.current }} / {{ convertStoreSetsProgress.total }}</div>
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
            v-for="part in filteredParts"
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
                  :data-element-id="part.element_id || ''"
                  :data-part-id="part.part_id || ''"
                  :data-color-id="part.color_id || ''"
                  :ref="el => { if (el) part._imgRef = el }"
                  @error="handleImageError"
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
                <div class="quantity-badge">{{ part.quantity }}개</div>
              </div>
            </div>
          </div>
        </div>
        <!-- CDN 필터 (하단 우측, 관리자 전용) -->
        <div class="cdn-filter-bottom">
          <label class="filter-toggle-small">
            <input
              type="checkbox"
              v-model="showCdnOnly"
              @change="handleFilterChange"
            />
            <span>CDN만 출력</span>
            <span v-if="showCdnOnly" class="filter-count-small">({{ filteredParts.length }})</span>
          </label>
          <button
            v-if="showCdnOnly && filteredParts.length > 0"
            @click="convertCdnPartsToWebP"
            :disabled="converting"
            class="convert-button-small"
          >
            {{ converting ? `변환 중... (${convertProgress.current}/${convertProgress.total})` : `WebP 변환 (${filteredParts.length}개)` }}
          </button>
        </div>
        <div v-if="converting" class="convert-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${(convertProgress.current / convertProgress.total) * 100}%` }"></div>
          </div>
          <div class="progress-text">{{ convertProgress.current }} / {{ convertProgress.total }}</div>
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

    <!-- 부품 정보 모달 -->
    <div v-if="showSetPartsModal" class="modal-overlay" @click.self="closeSetPartsModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ selectedModalSet ? formatSetDisplay(selectedModalSet.set_num, selectedModalSet.theme_name, selectedModalSet.name) : '' }}</h3>
          <button class="modal-close-button" @click="closeSetPartsModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="setPartsModalLoading" class="loading-message">로딩 중...</div>
          <div v-else-if="setPartsModalError" class="error-message">{{ setPartsModalError }}</div>
          <div v-else-if="setPartsModalData && setPartsModalData.length > 0" class="set-parts-list">
            <div class="parts-grid modal-parts-grid" style="padding-bottom: 2rem;">
              <div
                v-for="(part, index) in setPartsModalData"
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
                      :ref="el => { if (el) part._imgRef = el }"
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
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'
import { usePartSearch } from '../composables/usePartSearch'
import { usePleyonInventorySync } from '../composables/usePleyonInventorySync'
import { useRebrickable } from '../composables/useRebrickable'
import { useImageManager } from '../composables/useImageManager'
import SetPartsSyncModal from '../components/SetPartsSyncModal.vue'
import { formatSetDisplay, formatSetNumber, fetchSetMetadata } from '../utils/setDisplay'

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
    const { supabase, user } = useSupabase()
    const { getStoreInfoByEmail, getStoreInventory } = useSupabasePleyon()
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
    
    // 매장 레고 리스트 관련
    const storeInventory = ref([])
    const storeInfo = ref(null)
    const storeSets = ref([])
    const currentPage = ref(1)
    const itemsPerPage = 40
    
    // 부품 정보 모달 관련
    const showSetPartsModal = ref(false)
    const selectedModalSet = ref(null)
    const setPartsModalData = ref([])
    const setPartsModalLoading = ref(false)
    const setPartsModalError = ref(null)
    
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

    watch(user, async (newUser) => {
      console.log('[SetParts] watch user 호출:', { hasUser: !!newUser, email: newUser?.email })
      if (newUser) {
        console.log('[SetParts] 사용자 있음, 매장 인벤토리 로드 시작')
        await loadStoreInventory()
      } else {
        console.log('[SetParts] 사용자 없음, 매장 데이터 초기화')
        storeInfo.value = null
        storeInventory.value = []
        storeSets.value = []
      }
    }, { immediate: true })

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
      
      // 매장 레고 리스트의 세트 객체는 image_url만 있으므로 매핑 필요
      const mappedSet = {
        ...set,
        webp_image_url: set.webp_image_url || set.image_url || null,
        set_img_url: set.set_img_url || set.image_url || null
      }
      
      selectedSet.value = mappedSet
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

        // 예비부품 제외 (한 번만 계산)
        const nonSpareParts = partsData.filter(p => !p.is_spare)

        // 부품 정보와 색상 정보를 병렬로 조회
        const partIds = [...new Set(nonSpareParts.map(p => p.part_id).filter(id => id !== null && id !== undefined && id !== ''))]
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

        const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
        const colorsInfoMap = new Map(colorsInfo.map(c => [c.color_id, c]))

        // element_id 목록 수집
        const elementIds = [...new Set(partsData.map(p => p.element_id).filter(Boolean))].map(id => String(id))
        
        // 버킷 URL 생성 헬퍼 함수
        const getBucketImageUrl = (elementId, partId, colorId) => {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
          const bucketName = 'lego_parts_images'
          const fileName = elementId ? `${String(elementId)}.webp` : `${partId}_${colorId}.webp`
          return `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
        }

        // Rebrickable CDN URL 생성 헬퍼 함수 (jpg 사용)
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          // elementId를 문자열로 변환하여 처리
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
        
        // element_id 기반 이미지 조회 (병렬 처리로 최적화)
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

        // part_id + color_id 기반 이미지 조회 (버킷 URL 우선)
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

        // 부품 데이터 구성 (동기 처리로 최적화 - 이미지 URL은 이미 Map에서 조회 완료)
        const partsWithData = nonSpareParts.map((part) => {
          const partInfo = partsInfoMap.get(part.part_id)
          const colorInfo = colorsInfoMap.get(part.color_id)

          // 이미지 URL 결정: element_id 우선, 없으면 part_id + color_id
          let imageUrl = null
          if (part.element_id && elementImageMap.has(String(part.element_id))) {
            imageUrl = elementImageMap.get(String(part.element_id))
          }
          
          // part_id + color_id 기반 이미지 확인
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

          const colorName = colorInfo?.name || `Color ${part.color_id}`
          let colorRgb = null
          if (colorInfo?.rgb !== null && colorInfo?.rgb !== undefined) {
            let rgbStr = String(colorInfo.rgb).trim()
            if (rgbStr && rgbStr !== 'null' && rgbStr !== 'undefined' && rgbStr !== 'None') {
              if (!rgbStr.startsWith('#')) {
                rgbStr = `#${rgbStr}`
              }
              if (rgbStr.length === 7) {
                colorRgb = rgbStr.toUpperCase()
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

        parts.value = sortParts(partsWithData)
        
        // 예비부품 제외한 부품수 계산 (nonSpareParts는 이미 위에서 선언됨)
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
      const img = event.target
      const originalSrc = img.src
      const elementId = img.dataset.elementId
      const partId = img.dataset.partId
      const colorId = img.dataset.colorId
      
      // Rebrickable CDN으로 폴백
      if (elementId || partId) {
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
        
        const cdnUrl = getRebrickableCdnUrl(elementId, partId, colorId)
        if (cdnUrl && cdnUrl !== originalSrc) {
          img.src = cdnUrl
          return
        }
      }
      
      img.style.display = 'none'
    }

    const handleSetImageError = (event, set) => {
      const img = event.target
      const originalSrc = img.src
      console.warn('세트 이미지 로드 실패:', originalSrc, set)
      
      // 이미지 로드 실패 처리
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

    const formatColorLabel = (colorName, colorId, partId = null) => {
      // 미니피규어인 경우 (part_id가 fig-로 시작)
      if (partId && String(partId).toLowerCase().startsWith('fig-')) {
        return 'Any Color'
      }
      
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

    // CDN URL인지 확인하는 함수
    const isCdnUrl = (url) => {
      if (!url) return false
      return url.includes('cdn.rebrickable.com')
    }

    // CDN 이미지 필터링
    const showCdnOnly = ref(false)
    const converting = ref(false)
    const convertProgress = ref({ current: 0, total: 0 })

    const filteredParts = computed(() => {
      let result = parts.value
      if (showCdnOnly.value) {
        result = parts.value.filter(part => {
          const imageUrl = part._currentSrc || part.image_url
          return imageUrl && isCdnUrl(imageUrl)
        })
      }
      
      // 정렬은 이미 parts.value에 적용되어 있으므로 그대로 반환
      return result
    })

    const handleFilterChange = () => {
      // 필터 변경 시 추가 처리 없음
    }

    // 레고 리스트 화면용 필터링 및 변환
    const showStoreSetsCdnOnly = ref(false)
    const allStoreSetsParts = ref([])
    const loadingStoreSetsParts = ref(false)
    const loadingStoreSetsProgress = ref({ current: 0, total: 0 })
    const convertingStoreSets = ref(false)
    const convertStoreSetsProgress = ref({ current: 0, total: 0 })

    const allStoreSetsCdnParts = computed(() => {
      if (!showStoreSetsCdnOnly.value) {
        return []
      }
      const filtered = allStoreSetsParts.value.filter(part => {
        const imageUrl = part._currentSrc || part.image_url
        return imageUrl && isCdnUrl(imageUrl)
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

      return [...filtered].sort((a, b) => {
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
    })

    const handleStoreSetsFilterChange = async () => {
      // CDN 필터 활성화 시 부품 데이터가 없으면 자동으로 수집
      if (showStoreSetsCdnOnly.value && allStoreSetsParts.value.length === 0) {
        if (storeSets.value && storeSets.value.length > 0) {
          // 자동으로 부품 수집 시작
          await loadAllStoreSetsParts()
        } else {
          alert('수집할 세트가 없습니다.')
          showStoreSetsCdnOnly.value = false
        }
      }
    }

    // 전체 세트의 부품 수집
    const loadAllStoreSetsParts = async () => {
      if (!storeSets.value || storeSets.value.length === 0) {
        alert('수집할 세트가 없습니다.')
        return
      }

      loadingStoreSetsParts.value = true
      allStoreSetsParts.value = []
      loadingStoreSetsProgress.value = { current: 0, total: storeSets.value.length }

      try {
        // 병렬 처리로 성능 최적화 (동시성 제한: 10개씩)
        const CONCURRENT_LIMIT = 10
        const allParts = []
        
        for (let i = 0; i < storeSets.value.length; i += CONCURRENT_LIMIT) {
          const batch = storeSets.value.slice(i, i + CONCURRENT_LIMIT)
          
          const batchResults = await Promise.allSettled(
            batch.map(async (set) => {
              try {
                const partsData = await loadSetPartsData(set)
                if (partsData && partsData.length > 0) {
                  return partsData.map(part => ({
                    ...part,
                    set_num: set.set_num,
                    set_name: set.name
                  }))
                }
                return []
              } catch (err) {
                console.error(`[SetParts] 세트 ${set.set_num || set.id} 부품 수집 실패:`, err)
                return []
              }
            })
          )
          
          // 결과 수집
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
              allParts.push(...result.value)
            }
          }
          
          loadingStoreSetsProgress.value.current = Math.min(i + CONCURRENT_LIMIT, storeSets.value.length)
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
        
        allStoreSetsParts.value = sortParts(allParts)

        const cdnCount = allStoreSetsCdnParts.value.length
        if (cdnCount > 0) {
          alert(`부품 수집 완료: 전체 ${allStoreSetsParts.value.length}개 중 CDN 이미지 ${cdnCount}개`)
        } else {
          alert(`부품 수집 완료: ${allStoreSetsParts.value.length}개\n\nCDN 이미지를 사용하는 부품이 없습니다.`)
        }
      } catch (err) {
        console.error('[SetParts] 전체 세트 부품 수집 실패:', err)
        alert('부품 수집 중 오류가 발생했습니다.')
      } finally {
        loadingStoreSetsParts.value = false
        loadingStoreSetsProgress.value = { current: 0, total: 0 }
      }
    }

    // 세트의 부품 데이터만 로드 (이미지 URL 포함)
    const loadSetPartsData = async (set) => {
      if (!set || !set.id) return []

      try {
        const { data: setPartsData, error: setPartsError } = await supabase
          .from('set_parts')
          .select('part_id, color_id, quantity, element_id')
          .eq('set_id', set.id)

        if (setPartsError) throw setPartsError
        if (!setPartsData || setPartsData.length === 0) return []

        // 예비부품 제외
        const nonSpareParts = setPartsData.filter(p => p.part_id && !String(p.part_id).toLowerCase().startsWith('spare'))

        // 부품 정보 및 색상 정보 조회
        const partIds = [...new Set(nonSpareParts.map(p => p.part_id))]
        const colorIds = [...new Set(nonSpareParts.map(p => p.color_id).filter(Boolean))]

        const { data: partsInfo, error: partsError } = await supabase
          .from('lego_parts')
          .select('part_num, name')
          .in('part_num', partIds)

        if (partsError) throw partsError

        const { data: colorsInfo, error: colorsError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .in('color_id', colorIds)

        if (colorsError) throw colorsError

        const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
        const colorsInfoMap = new Map(colorsInfo.map(c => [c.color_id, c]))

        // 이미지 URL 결정 로직 (loadSetParts와 동일)
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

        // element_id 목록 수집
        const elementIds = [...new Set(nonSpareParts.map(p => p.element_id).filter(Boolean))].map(id => String(id))

        // part_id + color_id 기반 조회 준비
        const partColorKeys = [...new Set(nonSpareParts
          .filter(p => p.part_id && p.color_id !== null && p.color_id !== undefined)
          .map(p => `${p.part_id}_${p.color_id}`))]
        const partColorPairs = partColorKeys.map(key => {
          const [partId, colorId] = key.split('_')
          return { partId, colorId: parseInt(colorId) }
        })
        const partIdsForQuery = partColorKeys.length > 0 ? [...new Set(partColorPairs.map(p => p.partId))] : []
        const colorIdsForQuery = partColorKeys.length > 0 ? [...new Set(partColorPairs.map(p => p.colorId))] : []

        // 모든 이미지 조회를 병렬로 처리 (최대 성능)
        const imageQueries = []
        
        if (elementIds.length > 0) {
          imageQueries.push(
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
        
        if (partIdsForQuery.length > 0 && colorIdsForQuery.length > 0) {
          imageQueries.push(
            supabase
              .from('part_images')
              .select('part_id, color_id, uploaded_url')
              .in('part_id', partIdsForQuery)
              .in('color_id', colorIdsForQuery)
              .not('uploaded_url', 'is', null)
          )
        }

        // 모든 쿼리를 병렬로 실행
        const imageResults = await Promise.all(imageQueries)

        // element_id 기반 이미지 맵 구성
        let elementImageMap = new Map()
        if (elementIds.length > 0) {
          const elementImagesResult = imageResults[0]
          const elementMetadataResult = imageResults[1]

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
            for (const meta of elementMetadataResult.data) {
              if (meta.element_id && meta.supabase_url) {
                const elementId = String(meta.element_id)
                if (!elementImageMap.has(elementId)) {
                  const isBucketUrl = meta.supabase_url.includes('/storage/v1/object/public/lego_parts_images/')
                  if (isBucketUrl && !meta.supabase_url.toLowerCase().endsWith('.jpg')) {
                    elementImageMap.set(elementId, meta.supabase_url)
                  }
                }
              }
            }
          }
        }

        // part_id + color_id 기반 이미지 맵 구성
        const partColorImageMap = new Map()
        if (partIdsForQuery.length > 0 && colorIdsForQuery.length > 0) {
          const partImagesResult = imageResults[elementIds.length > 0 ? 2 : 0]
          
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
        }

        // 부품 데이터 구성 (이미지 URL은 이미 조회된 맵에서 가져옴)
        const partsWithData = nonSpareParts.map((part) => {
          const partInfo = partsInfoMap.get(part.part_id)
          const colorInfo = colorsInfoMap.get(part.color_id)

          let imageUrl = null

          // element_id 기반 이미지 확인
          if (part.element_id) {
            const elementId = String(part.element_id)
            imageUrl = elementImageMap.get(elementId)
          }

          // part_id + color_id 기반 이미지 확인
          if (!imageUrl && part.part_id && part.color_id !== null && part.color_id !== undefined) {
            const key = `${part.part_id}_${part.color_id}`
            imageUrl = partColorImageMap.get(key)
          }

          // 버킷에도 없으면 CDN으로 폴백
          if (!imageUrl) {
            const elementId = part.element_id ? String(part.element_id) : null
            imageUrl = getRebrickableCdnUrl(elementId, part.part_id, part.color_id)
            if (!imageUrl && elementId) {
              imageUrl = `https://cdn.rebrickable.com/media/parts/elements/${elementId}.jpg`
            }
          }

          const colorName = colorInfo?.name || `Color ${part.color_id}`
          let colorRgb = null
          if (colorInfo?.rgb !== null && colorInfo?.rgb !== undefined) {
            let rgbStr = String(colorInfo.rgb).trim()
            if (rgbStr && rgbStr !== 'null' && rgbStr !== 'undefined' && rgbStr !== 'None') {
              if (!rgbStr.startsWith('#')) {
                rgbStr = `#${rgbStr}`
              }
              if (rgbStr.length === 7) {
                colorRgb = rgbStr.toUpperCase()
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
        return partsWithData
      } catch (err) {
        console.error(`[SetParts] 세트 ${set.set_num || set.id} 부품 데이터 로드 실패:`, err)
        return []
      }
    }

    // 전체 세트의 CDN 부품들을 WebP로 변환
    const convertAllStoreSetsCdnPartsToWebP = async () => {
      const cdnParts = allStoreSetsCdnParts.value

      if (cdnParts.length === 0) {
        alert('변환할 CDN 이미지가 없습니다.')
        return
      }

      if (!confirm(`${cdnParts.length}개의 부품 이미지를 WebP로 변환하시겠습니까?`)) {
        return
      }

      convertingStoreSets.value = true
      convertStoreSetsProgress.value = { current: 0, total: cdnParts.length }

      let successCount = 0
      let failCount = 0

      // 병렬 처리로 성능 최적화 (동시성 제한: 5개)
      const CONCURRENT_LIMIT = 5
      
      for (let i = 0; i < cdnParts.length; i += CONCURRENT_LIMIT) {
        const batch = cdnParts.slice(i, i + CONCURRENT_LIMIT)
        
        const batchResults = await Promise.allSettled(
          batch.map(async (part) => {
            try {
              const imageUrl = part._currentSrc || part.image_url
              if (!imageUrl || !isCdnUrl(imageUrl)) {
                return { success: false, reason: 'CDN URL 아님' }
              }

              let fileName
              if (part.element_id) {
                fileName = `${part.element_id}.webp`
              } else if (part.part_id && part.color_id !== null && part.color_id !== undefined) {
                fileName = `${part.part_id}_${part.color_id}.webp`
              } else if (part.part_id) {
                fileName = `${part.part_id}.webp`
              } else {
                return { success: false, reason: '파일명 생성 불가' }
              }

              const uploadPath = 'images'
              const result = await uploadImageFromUrl(imageUrl, fileName, uploadPath)

              if (result && result.url) {
                part.image_url = result.url
                part._currentSrc = result.url
                return { success: true, fileName }
              } else {
                return { success: false, reason: '변환 결과 없음' }
              }
            } catch (error) {
              // 404 에러는 스킵 (존재하지 않는 이미지)
              if (error.message && error.message.includes('404')) {
                return { success: false, reason: '이미지 없음 (404)', skip: true }
              }
              return { success: false, reason: error.message || '알 수 없는 오류' }
            }
          })
        )

        // 결과 집계
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              successCount++
            } else {
              failCount++
              // 404 에러는 로그 생략 (너무 많음)
              if (!result.value.skip) {
                console.warn(`[SetParts] WebP 변환 실패: ${result.value.reason}`)
              }
            }
          } else {
            failCount++
            console.error(`[SetParts] WebP 변환 오류:`, result.reason)
          }
        }

        convertStoreSetsProgress.value.current = Math.min(i + CONCURRENT_LIMIT, cdnParts.length)
      }

      convertingStoreSets.value = false
      convertStoreSetsProgress.value = { current: 0, total: 0 }

      alert(`변환 완료: 성공 ${successCount}개, 실패 ${failCount}개\n\n페이지를 새로고침하면 변환된 이미지가 표시됩니다.`)
    }

    // useImageManager 사용
    const { uploadImageFromUrl } = useImageManager()

    // CDN 부품들을 WebP로 변환
    const convertCdnPartsToWebP = async () => {
      const cdnParts = filteredParts.value.filter(part => {
        const imageUrl = part._currentSrc || part.image_url
        return imageUrl && isCdnUrl(imageUrl)
      })

      if (cdnParts.length === 0) {
        alert('변환할 CDN 이미지가 없습니다.')
        return
      }

      if (!confirm(`${cdnParts.length}개의 부품 이미지를 WebP로 변환하시겠습니까?`)) {
        return
      }

      converting.value = true
      convertProgress.value = { current: 0, total: cdnParts.length }

      let successCount = 0
      let failCount = 0

      // 병렬 처리로 성능 최적화 (동시성 제한: 5개)
      const CONCURRENT_LIMIT = 5
      
      for (let i = 0; i < cdnParts.length; i += CONCURRENT_LIMIT) {
        const batch = cdnParts.slice(i, i + CONCURRENT_LIMIT)
        
        const batchResults = await Promise.allSettled(
          batch.map(async (part) => {
            try {
              const imageUrl = part._currentSrc || part.image_url
              if (!imageUrl || !isCdnUrl(imageUrl)) {
                return { success: false, reason: 'CDN URL 아님' }
              }

              let fileName
              if (part.element_id) {
                fileName = `${part.element_id}.webp`
              } else if (part.part_id && part.color_id !== null && part.color_id !== undefined) {
                fileName = `${part.part_id}_${part.color_id}.webp`
              } else if (part.part_id) {
                fileName = `${part.part_id}.webp`
              } else {
                return { success: false, reason: '파일명 생성 불가' }
              }

              const uploadPath = 'images'
              const result = await uploadImageFromUrl(imageUrl, fileName, uploadPath)

              if (result && result.url) {
                part.image_url = result.url
                part._currentSrc = result.url
                return { success: true, fileName }
              } else {
                return { success: false, reason: '변환 결과 없음' }
              }
            } catch (error) {
              // 404 에러는 스킵 (존재하지 않는 이미지)
              if (error.message && error.message.includes('404')) {
                return { success: false, reason: '이미지 없음 (404)', skip: true }
              }
              return { success: false, reason: error.message || '알 수 없는 오류' }
            }
          })
        )

        // 결과 집계
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              successCount++
            } else {
              failCount++
              // 404 에러는 로그 생략 (너무 많음)
              if (!result.value.skip) {
                console.warn(`[SetParts] WebP 변환 실패: ${result.value.reason}`)
              }
            }
          } else {
            failCount++
            console.error(`[SetParts] WebP 변환 오류:`, result.reason)
          }
        }

        convertProgress.value.current = Math.min(i + CONCURRENT_LIMIT, cdnParts.length)
      }

      converting.value = false
      convertProgress.value = { current: 0, total: 0 }

      alert(`변환 완료: 성공 ${successCount}개, 실패 ${failCount}개\n\n페이지를 새로고침하면 변환된 이미지가 표시됩니다.`)
      
      // 부품 목록 다시 로드
      if (selectedSet.value) {
        await loadSetParts(selectedSet.value)
      }
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

    const resetPage = () => {
      setSearchQuery.value = ''
      selectedSetId.value = ''
      selectedSet.value = null
      searchResults.value = []
      searchResultsKey.value++
      showSetDropdown.value = false
      parts.value = []
      error.value = null
      uniquePartsCount.value = 0
      registeredPartsCount.value = 0
    }

    // 매장 인벤토리 로드
    const loadStoreInventory = async () => {
      console.log('[SetParts] loadStoreInventory 시작:', { hasUser: !!user.value, email: user.value?.email })
      if (!user.value) {
        console.log('[SetParts] 사용자 없음, 매장 데이터 초기화')
        storeInfo.value = null
        storeInventory.value = []
        storeSets.value = []
        return
      }

      try {
        console.log('[SetParts] 매장 정보 조회 시작:', user.value.email)
        const storeData = await getStoreInfoByEmail(user.value.email)
        console.log('[SetParts] 매장 정보 조회 결과:', { hasStoreData: !!storeData, hasStore: !!(storeData?.store) })
        if (storeData && storeData.store) {
          storeInfo.value = storeData
          console.log('[SetParts] 매장 인벤토리 조회 시작, storeId:', storeData.store.id)
          const inventoryData = await getStoreInventory(storeData.store.id)
          storeInventory.value = inventoryData || []
          console.log('[SetParts] 매장 인벤토리 로드 완료:', storeInventory.value.length, '개')
          
          // 인벤토리에서 세트 정보 추출
          await loadStoreSets()
        } else {
          console.log('[SetParts] 매장 정보 없음, 데이터 초기화')
          storeInfo.value = null
          storeInventory.value = []
          storeSets.value = []
        }
      } catch (err) {
        console.error('[SetParts] 매장 인벤토리 로드 실패:', err)
        storeInfo.value = null
        storeInventory.value = []
        storeSets.value = []
      }
    }

    // 매장 세트 정보 로드
    const loadStoreSets = async () => {
      if (!storeInventory.value || storeInventory.value.length === 0) {
        storeSets.value = []
        return
      }

      try {
        // 인벤토리에서 세트 번호 추출 (MissingParts.vue와 동일한 방식)
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
        
        if (inventorySetNumbers.length === 0) {
          storeSets.value = []
          return
        }

        // 중복 제거
        const uniqueSetNumbers = [...new Set(inventorySetNumbers)]

        // 세트 번호 변형 생성 (접미사 처리: '10358' -> ['10358', '10358-1', '10358-2'])
        const setNumVariations = new Set()
        uniqueSetNumbers.forEach(setNum => {
          setNumVariations.add(setNum)
          const baseNum = setNum.split('-')[0]
          if (baseNum !== setNum) {
            setNumVariations.add(baseNum)
          }
          // 접미사 있는 버전도 추가 (최대 3개만)
          for (let i = 1; i <= 3; i++) {
            setNumVariations.add(`${baseNum}-${i}`)
          }
        })
        
        const allSetNums = Array.from(setNumVariations)

        // 병렬 배치 조회로 속도 개선
        const batchSize = 100
        const batches = []
        for (let i = 0; i < allSetNums.length; i += batchSize) {
          batches.push(allSetNums.slice(i, i + batchSize))
        }
        
        // 모든 배치를 병렬로 조회
        const batchPromises = batches.map(batch =>
          supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .in('set_num', batch)
        )
        
        const batchResults = await Promise.all(batchPromises)
        
        // 결과 합치기
        let allSetsData = []
        for (const result of batchResults) {
          if (result.error) {
            console.error('[SetParts] lego_sets 배치 조회 오류:', result.error)
            throw result.error
          }
          if (result.data && result.data.length > 0) {
            allSetsData.push(...result.data)
          }
        }
        
        // 원본 세트 번호와 매칭되는 세트만 필터링 (접미사 무시)
        const finalSetsData = allSetsData.filter(set => {
          const baseSetNum = set.set_num.split('-')[0]
          return uniqueSetNumbers.includes(set.set_num) || uniqueSetNumbers.includes(baseSetNum)
        })
        
        if (finalSetsData.length === 0) {
          storeSets.value = []
          return
        }

        // 테마 정보 조회
        const themeIds = [...new Set((finalSetsData || []).map(s => s.theme_id).filter(Boolean))]
        console.log('[SetParts] 테마 ID 수:', themeIds.length)
        let themeMap = new Map()
        if (themeIds.length > 0) {
          const { data: themesData, error: themesError } = await supabase
            .from('lego_themes')
            .select('theme_id, name')
            .in('theme_id', themeIds)

          if (!themesError && themesData) {
            themeMap = new Map(themesData.map(t => [t.theme_id, t.name]))
            console.log('[SetParts] 테마 맵 생성 완료:', themeMap.size, '개')
          }
        }

        // 인벤토리에서 수량 정보 매핑 (set_num 기준)
        const quantityMap = new Map()
        storeInventory.value.forEach(item => {
          const legoSet = item.lego_sets
          let setNum = null
          if (legoSet) {
            if (Array.isArray(legoSet) && legoSet.length > 0) {
              setNum = legoSet[0].number
            } else if (!Array.isArray(legoSet)) {
              setNum = legoSet.number
            }
          }
          
          if (setNum) {
            const currentQty = quantityMap.get(setNum) || 0
            quantityMap.set(setNum, currentQty + (item.quantity || 0))
          }
        })
        console.log('[SetParts] 수량 맵 생성 완료:', quantityMap.size, '개')

        // 세트 데이터 구성 (동기 처리 - 이미지 존재 확인 제거)
        const setsWithQuantity = (finalSetsData || []).map((set) => {
          // 이미지 URL 우선순위: webp_image_url > set_img_url
          // CDN URL은 null로 설정 (브라우저가 자동으로 처리)
          let imageUrl = null
          if (set.webp_image_url) {
            if (set.webp_image_url.includes('cdn.rebrickable.com')) {
              imageUrl = null
            } else {
              imageUrl = set.webp_image_url
            }
          } else if (set.set_img_url) {
            if (set.set_img_url.includes('cdn.rebrickable.com')) {
              imageUrl = null
            } else {
              imageUrl = set.set_img_url
            }
          }

          return {
            id: set.id,
            set_num: set.set_num,
            name: set.name,
            theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
            image_url: imageUrl,
            num_parts: set.num_parts || 0,
            part_count: set.num_parts || 0,
            quantity: quantityMap.get(set.set_num) || 0
          }
        })
        
        // 정렬
        setsWithQuantity.sort((a, b) => {
          return a.set_num.localeCompare(b.set_num, 'ko')
        })

        storeSets.value = setsWithQuantity
      } catch (err) {
        console.error('[SetParts] 매장 세트 정보 로드 실패:', err)
        storeSets.value = []
      }
    }

    // 페이지네이션
    const totalPages = computed(() => {
      return Math.ceil(storeSets.value.length / itemsPerPage)
    })

    const paginatedStoreSets = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage
      const end = start + itemsPerPage
      return storeSets.value.slice(start, end)
    })

    const visiblePages = computed(() => {
      const pages = []
      const total = totalPages.value
      const current = currentPage.value
      
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

    const goToPage = (page) => {
      if (page < 1 || page > totalPages.value || page === currentPage.value) return
      currentPage.value = page
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

    // 부품 정보 모달 열기
    const openSetPartsModal = async (set) => {
      selectedModalSet.value = set
      showSetPartsModal.value = true
      setPartsModalData.value = []
      setPartsModalError.value = null
      setPartsModalLoading.value = true

      try {
        // 세트 부품 정보 조회
        const { data: partsData, error: partsError } = await supabase
          .from('set_parts')
          .select('part_id, color_id, quantity, element_id, is_spare')
          .eq('set_id', set.id)

        if (partsError) throw partsError

        if (!partsData || partsData.length === 0) {
          setPartsModalData.value = []
          setPartsModalLoading.value = false
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

        // element_id 목록 수집
        const elementIds = [...new Set(nonSpareParts.map(p => p.element_id).filter(Boolean))].map(id => String(id))

        // 버킷 URL 생성 헬퍼 함수
        const getBucketImageUrl = (elementId, partId, colorId) => {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
          const bucketName = 'lego_parts_images'
          const fileName = elementId ? `${String(elementId)}.webp` : `${partId}_${colorId}.webp`
          return `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
        }

        // Rebrickable CDN URL 생성 헬퍼 함수 (jpg 사용)
        const getRebrickableCdnUrl = (elementId, partId, colorId) => {
          // elementId를 문자열로 변환하여 처리
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

        // element_id 기반 이미지 배치 조회 (병렬 처리로 최적화)
        let elementImageMap = new Map()
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

        // part_id + color_id 기반 이미지 조회 (버킷 URL 우선)
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

        // 부품 데이터 구성 (동기 처리로 최적화 - 이미지 URL은 이미 Map에서 조회 완료)
        const partsWithImages = nonSpareParts.map((part) => {
          const partInfo = partsInfoMap.get(part.part_id)
          const colorInfo = colorsInfoMap.get(part.color_id)
          
          let imageUrl = null
          
          // 1. element_id 기반 이미지 우선
          if (part.element_id) {
            imageUrl = elementImageMap.get(String(part.element_id))
          }
          
          // 2. part_id + color_id 기반 이미지 (fallback)
          if (!imageUrl && part.part_id && part.color_id !== null && part.color_id !== undefined) {
            const key = `${part.part_id}_${part.color_id}`
            imageUrl = partColorImageMap.get(key)
          }

          // 3. 버킷에도 없으면 Rebrickable CDN으로 폴백
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
            element_id: part.element_id,
            part_name: partInfo?.name || part.part_id,
            color_name: colorInfo ? (colorInfo.name || null) : null,
            color_rgb: colorInfo?.rgb || null,
            image_url: imageUrl,
            quantity: part.quantity
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

        setPartsModalData.value = sortParts(partsWithImages)
      } catch (err) {
        setPartsModalError.value = err.message || '부품 목록을 불러오는 중 오류가 발생했습니다.'
        console.error('부품 목록 조회 실패:', err)
      } finally {
        setPartsModalLoading.value = false
      }
    }

    // 부품 정보 모달 닫기
    const closeSetPartsModal = () => {
      showSetPartsModal.value = false
      selectedModalSet.value = null
      setPartsModalData.value = []
      setPartsModalError.value = null
    }

    // 부품 이미지 에러 처리
    const handlePartImageError = (event) => {
      const img = event.target
      const originalSrc = img.src
      const elementId = img.dataset.elementId
      const partId = img.dataset.partId
      const colorId = img.dataset.colorId
      
      // Rebrickable CDN으로 폴백
      if (elementId || partId) {
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
        
        const cdnUrl = getRebrickableCdnUrl(elementId, partId, colorId)
        if (cdnUrl && cdnUrl !== originalSrc) {
          img.src = cdnUrl
          return
        }
      }
      
      img.style.display = 'none'
      const parent = img.parentElement
      if (parent && !parent.querySelector('.no-part-image')) {
        const placeholder = document.createElement('div')
        placeholder.className = 'no-part-image'
        placeholder.textContent = '이미지 없음'
        parent.appendChild(placeholder)
      }
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
      getColorTextColor,
      formatColorLabel,
      resolvePartCount, // 🔧 수정됨
      displaySetNumber,
      handleSetRowClick,
      handleAlternativePartClick,
      resetPage,
      storeInventory,
      storeInfo,
      storeSets,
      paginatedStoreSets,
      currentPage,
      totalPages,
      visiblePages,
      goToPage,
      showPartInfo,
      closePartInfoModal,
      showPartInfoModal,
      selectedPart,
      partSets,
      openSetPartsModal,
      closeSetPartsModal,
      showSetPartsModal,
      setPartsModalData,
      setPartsModalLoading,
      setPartsModalError,
      selectedModalSet,
      handlePartImageError,
      partSetsLoading,
      alternativeParts,
      alternativePartsLoading,
      isCdnUrl,
      showCdnOnly,
      filteredParts,
      handleFilterChange,
      convertCdnPartsToWebP,
      converting,
      convertProgress,
      showStoreSetsCdnOnly,
      allStoreSetsParts,
      allStoreSetsCdnParts,
      handleStoreSetsFilterChange,
      loadAllStoreSetsParts,
      convertAllStoreSetsCdnPartsToWebP,
      loadingStoreSetsParts,
      loadingStoreSetsProgress,
      convertingStoreSets,
      convertStoreSetsProgress
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

.store-sets-section {
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

.set-image img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.no-image {
  color: #9ca3af;
  font-size: 0.875rem;
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

.set-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.set-quantity {
  font-size: 0.875rem;
  color: #3b82f6;
  font-weight: 500;
  margin: 0;
}

.inventory-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #10b981;
  color: #ffffff;
  white-space: nowrap;
  width: fit-content;
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

/* 부품 정보 모달 스타일 */
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

/* 모달 부품 그리드 (4열 유지) */
.modal-parts-grid {
  grid-template-columns: repeat(4, 1fr) !important;
}

@media (min-width: 1400px) {
  .modal-parts-grid {
    grid-template-columns: repeat(4, 1fr) !important;
  }
}

@media (max-width: 1200px) and (min-width: 900px) {
  .modal-parts-grid {
    grid-template-columns: repeat(4, 1fr) !important;
  }
}

/* 부품 카드 스타일 (모달용) */
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
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.part-card .part-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: break-word;
}

.part-card .color-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  width: fit-content;
}

.part-card .card-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.part-card .part-image-section {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #f9fafb;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.part-card .part-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.5rem;
}

.part-card .no-part-image {
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: center;
  padding: 1rem;
}

.part-card .quantity-section {
  display: flex;
  justify-content: center;
  align-items: center;
}

.part-card .quantity-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: #ffffff;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 1rem;
  }

  .modal-container {
    max-width: 100%;
    max-height: 100%;
  }

  .modal-parts-grid {
    grid-template-columns: 1fr !important;
  }
}

.selected-set-display {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.selected-set-row { /* 🔧 수정됨 */
  display: flex;
  align-items: center;
  gap: 1.25rem; /* // 🔧 수정됨 */
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

.selected-set-parts-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0rem;
}

.selected-set-parts {
  font-size: 0.8125rem;
  color: #6b7280;
}

.selected-set-parts-divider {
  font-size: 0.8125rem;
  color: #d1d5db;
}

.selected-set-registered {
  font-size: 0.8125rem;
  color: #3b82f6;
  font-weight: 500;
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
  gap: 1.5rem !important; /* // 🔧 수정됨 */
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

.cdn-filter-bottom {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.25rem 0.5rem;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.cdn-filter-bottom:hover {
  opacity: 1;
}

.filter-toggle-small {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  user-select: none;
  font-size: 0.75rem;
  color: #6b7280;
}

.filter-toggle-small input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.filter-count-small {
  color: #9ca3af;
  font-size: 0.7rem;
}

.convert-button-small {
  padding: 0.25rem 0.5rem;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 400;
  cursor: pointer;
  transition: background 0.2s;
}

.convert-button-small:hover:not(:disabled) {
  background: #4b5563;
}

.convert-button-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.parts-filter-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.filter-toggle input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.filter-count {
  color: #6b7280;
  font-size: 0.875rem;
}

.convert-button {
  padding: 0.5rem 1rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.convert-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.convert-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.convert-progress {
  margin-top: 1rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #2563eb;
  transition: width 0.3s;
}

.progress-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
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
    padding: 0rem 0;
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

.store-sets-filter-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.load-parts-button {
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.load-parts-button:hover:not(:disabled) {
  background: #059669;
}

.load-parts-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.loading-parts {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
}

.store-sets-cdn-parts-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.set-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #e5e7eb;
  color: #374151;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

@media (max-width: 1200px) {
  .store-sets-cdn-parts-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 900px) {
  .store-sets-cdn-parts-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .store-sets-cdn-parts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.store-sets-cdn-parts-section {
  margin-top: 1.5rem;
}

.empty-cdn-parts {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.empty-cdn-parts p {
  margin: 0.5rem 0;
}

.empty-hint {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.5rem;
}

</style>


