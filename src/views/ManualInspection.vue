<template>
  <div class="pleyon-layout">
    <div class="layout-container">
      <main class="main-panel">
        <header class="panel-header" :class="{ 'session-header': session.id, 'start-header': !session.id }">
          <div class="header-left">
            <h1 v-if="!session.id" class="start-title">부품검수</h1>
            <div v-else class="session-title">
              <h1>{{ session.set_name }}</h1>
              <div class="session-stats">
                <span class="stat-badge progress">{{ progress }}%</span>
                <span class="stat-badge missing">{{ missingCount }}개 누락</span>
                <span class="stat-badge time">{{ formatTime(session.last_saved_at) }}</span>
              </div>
            </div>
          </div>
          <div class="header-actions" v-if="session.id">
            <div class="mode-controls">
              <button 
                @click="inspectionMode = 'single'"
                :class="['mode-btn', { active: inspectionMode === 'single' }]"
              >
                단일 검수
              </button>
              <button 
                @click="inspectionMode = 'grid'"
                :class="['mode-btn', { active: inspectionMode === 'grid' }]"
              >
                그리드 검수
              </button>
            </div>
            <div v-if="inspectionMode === 'grid'" class="grid-controls">
              <button 
                v-for="cols in [1, 2, 3]" 
                :key="cols"
                @click="gridColumns = cols"
                :class="['grid-btn', { active: gridColumns === cols }]"
              >
                {{ cols }}열
              </button>
            </div>
          </div>
          <div v-if="session.id" class="sync-section"><!-- // 🔧 수정됨 -->
            <div
              v-if="syncStatusMessage"
              class="sync-status"
              :class="{ error: lastSyncError, syncing: syncInProgress, offline: isOffline }"
            >
              <span class="sync-text">{{ syncStatusMessage }}</span>
              <button
                type="button"
                class="sync-action"
                @click="triggerManualSync"
                :disabled="syncInProgress || isOffline"
              >
                {{ isOffline ? '오프라인' : (syncInProgress ? '동기화 중...' : '지금 동기화') }}
              </button>
              <button
                type="button"
                class="analytics-toggle"
                @click="showAnalytics = !showAnalytics"
                :aria-expanded="showAnalytics"
              >
                <svg 
                  class="toggle-icon" 
                  :class="{ rotated: showAnalytics }"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div class="panel-content">
          <div v-if="!session.id" class="session-setup">
            <div class="setup-card">
              <div class="card-header">
                <h3>새 검수 세션</h3>
                <p>검수할 레고 세트를 선택하세요</p>
              </div>
              <div class="card-body">
                <div class="form-group">
                  <label>세트 선택</label>
                  <div class="custom-select" ref="setDropdownRef">
                    <button
                      type="button"
                      class="custom-select-trigger"
                      :class="{ open: showSetDropdown }"
                      @click="toggleSetDropdown"
                      :disabled="loading"
                    >
                      <span class="custom-select-value">{{ selectedSetLabel }}</span>
                      <svg class="custom-select-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <transition name="select-fade">
                      <div v-if="showSetDropdown" class="custom-select-dropdown">
                        <button
                          v-for="set in availableSets"
                          :key="set.id"
                          type="button"
                          class="custom-select-option"
                          :class="{ active: selectedSetId === set.id }"
                          @click="handleSelectSet(set)"
                        >
                          <div class="option-title">{{ set.name }}</div>
                          <div class="option-subtitle">{{ set.set_num }}</div>
                        </button>
                      </div>
                    </transition>
                  </div>
                </div>
                <button 
                  @click="startNewSession" 
                  :disabled="!selectedSetId || loading"
                  class="btn-primary"
                >
                  검수 시작
                </button>
              </div>
            </div>

            <div v-if="lastSession" class="setup-card resume-card">
              <div class="card-header">
                <h3>이전 세션 복원</h3>
                <p>진행 중이던 검수를 이어서 진행할 수 있습니다</p>
              </div>
              <div class="card-body">
                <div class="resume-info">
                  <div class="info-row">
                    <span class="info-label">세트명:</span>
                    <span class="info-value">{{ lastSession.set_name }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">진행률:</span>
                    <span class="info-value progress-text">{{ lastSession.progress }}%</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">마지막 저장:</span>
                    <span class="info-value">{{ formatDate(lastSession.last_saved_at) }}</span>
                  </div>
                </div>
                <div class="resume-actions">
                  <button @click="resumeSession" class="btn-primary">이어하기</button>
                  <button @click="startNewSession" class="btn-secondary">새로 시작</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 희귀부품 알림 패널 -->
          <div v-if="session.id && rareParts.length > 0" class="rare-parts-panel">
            <div class="rare-parts-header">
              <h3>희귀부품 알림</h3>
              <button @click="showRareParts = !showRareParts" class="toggle-btn">
                {{ showRareParts ? '숨기기' : '보기' }}
              </button>
            </div>
            <div v-if="showRareParts" class="rare-parts-list">
              <div
                v-for="part in rareParts.slice(0, 5)"
                :key="`${part.part_id}_${part.color_id}`"
                class="rare-part-item"
              >
                <span class="rare-part-name">{{ part.part_name }}</span>
                <span class="rare-part-badge">희귀도: {{ part.usage_frequency }}</span>
              </div>
            </div>
          </div>

          <div v-else class="inspection-workspace">
            <div v-if="session.id && showAnalytics" class="progress-section"><!-- // 🔧 수정됨 -->
              <div class="progress-bar-container">
                <div class="progress-bar-fill" :style="{ width: `${progress}%` }"></div>
              </div>
              <div class="progress-stats"><!-- // 🔧 수정됨 -->
                <div class="stat-item">
                  <span class="stat-label">완료</span>
                  <span class="stat-value">{{ items.filter(i => i.status === 'checked').length }} / {{ items.length }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">보류</span>
                  <span class="stat-value">{{ items.filter(i => i.status === 'hold').length }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">누락</span>
                  <span class="stat-value error">{{ items.filter(i => i.status === 'missing').length }}</span>
                </div>
              </div>
            </div>

            <div v-if="session.id && showAnalytics" class="analytics-panel"><!-- // 🔧 수정됨 -->
              <section class="metrics-overview"><!-- // 🔧 수정됨 -->
                <div class="metric-card">
                  <span class="metric-label">평균 소요시간</span>
                  <span class="metric-value">{{ averageDurationLabel }}</span>
                  <span class="metric-hint">총 {{ elapsedDurationLabel }}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-label">완료 부품</span>
                  <span class="metric-value">{{ statusCounts.checked }} / {{ totalItems }}</span>
                  <span class="metric-hint">완료율 {{ progress }}%</span>
                </div>
                <div class="metric-card">
                  <span class="metric-label">누락 · 보류</span>
                  <span class="metric-value error">{{ statusCounts.missing }} / {{ statusCounts.hold }}</span>
                  <span class="metric-hint">누락률 {{ missingRateLabel }}</span>
                </div>
              </section>
              <section class="status-chart-panel"><!-- // 🔧 수정됨 -->
                <Bar :data="statusChartData" :options="statusChartOptions" class="status-chart" />
              </section>
            </div>

            <div v-if="qaReminder.visible" class="qa-reminder" :class="qaReminder.level"><!-- // 🔧 수정됨 -->
              <div class="qa-reminder-title">QA 리마인더</div>
              <p class="qa-reminder-message">{{ qaReminder.message }}</p>
            </div>

            <div v-if="session.id" class="workspace-controls">
              <div class="status-filter-group">
                <button
                  v-for="option in statusOptions"
                  :key="option.value"
                  type="button"
                  class="status-filter-button"
                  :class="{ active: statusFilter === option.value }"
                  @click="statusFilter = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
              <div class="sort-control">
                <label for="sort-select">정렬</label>
                <select id="sort-select" v-model="selectedSortMode" class="sort-select">
                  <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="items-container">
              <div v-if="inspectionMode === 'single' && displayedItems.length > 0" class="single-card-navigation">
                <div class="card-counter">
                  <div class="counter-content">
                    <span class="counter-current">{{ currentItemIndex + 1 }}</span>
                    <span class="counter-separator">/</span>
                    <span class="counter-total">{{ totalItems }}</span>
                  </div>
                  <div class="counter-progress">
                    <div class="counter-progress-bar" :style="{ width: `${((currentItemIndex + 1) / totalItems) * 100}%` }"></div>
                  </div>
                </div>
              </div>
              <div 
                class="items-grid" 
                :class="{ 'single-mode': inspectionMode === 'single' }"
                :style="inspectionMode === 'grid' ? { gridTemplateColumns: `repeat(${gridColumns}, 1fr)` } : {}"
              >
                <template v-if="inspectionMode === 'single'">
                  <div 
                    v-if="displayedItems.length > 0"
                    class="part-card-wrapper"
                  >
                    <button
                      class="card-nav-arrow card-nav-arrow-left"
                      @click="goToPrevItem"
                      :disabled="currentItemIndex === 0"
                      aria-label="이전 카드"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                    <Transition 
                      :name="`slide-${slideDirection}`"
                      mode="out-in"
                    >
                      <div 
                        :key="displayedItems[0].id || `${displayedItems[0].part_id}-${displayedItems[0].color_id}`"
                        class="part-card"
                        :class="getCardStatusClass(displayedItems[0].status)"
                        :style="swipeState.isSwiping ? { 
                          transform: `translateX(${swipeState.currentX - swipeState.startX}px)`,
                          transition: 'none'
                        } : {}"
                        @touchstart="handleSwipeStart"
                        @touchmove="handleSwipeMove"
                        @touchend="handleSwipeEnd"
                        @mousedown="handleSwipeStart"
                        @mousemove="handleSwipeMove"
                        @mouseup="handleSwipeEnd"
                        @mouseleave="handleSwipeEnd"
                      >
                        <div class="card-header">
                          <div class="part-info">
                            <div v-if="displayedItems[0].element_id" class="element-id">{{ displayedItems[0].element_id }}</div>
                            <h4 class="part-name">{{ displayedItems[0].part_name }}</h4>
                            <span 
                              class="color-badge"
                              :style="{ 
                                backgroundColor: getColorRgbSync(displayedItems[0].color_id, displayedItems[0]) || '#ccc'
                              }"
                            >
                              {{ displayedItems[0].color_name || displayedItems[0].color_id }}
                            </span>
                          </div>
                          <button
                            @click="showPartInfo(displayedItems[0])"
                            class="part-info-btn"
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
                              :src="partImageUrls[displayedItems[0].id] || ''"
                              :alt="`${displayedItems[0].part_name} (${displayedItems[0].color_name})`"
                              class="part-image"
                              @error="handleImageError($event)"
                              @load="handleImageLoad($event)"
                            />
                          </div>

                          <div class="quantity-section">
                            <div class="quantity-control">
                              <button 
                                @click="decrementCount(displayedItems[0])"
                                :disabled="displayedItems[0].checked_count <= 0"
                                class="qty-button minus"
                              >
                                <span>−</span>
                              </button>
                              <div class="qty-display">
                                <input 
                                  type="number"
                                  :value="displayedItems[0].checked_count"
                                  @input="updateItemCount(displayedItems[0], $event.target.value)"
                                  :max="displayedItems[0].total_count"
                                  min="0"
                                  class="qty-input"
                                />
                                <span class="qty-divider">/</span>
                                <span class="qty-total">{{ displayedItems[0].total_count }}</span>
                              </div>
                              <button 
                                @click="incrementCount(displayedItems[0])"
                                :disabled="displayedItems[0].checked_count >= displayedItems[0].total_count"
                                class="qty-button plus"
                              >
                                <span>+</span>
                              </button>
                            </div>
                          </div>

                          <div class="status-section">
                            <div class="status-buttons">
                              <button
                                @click="setItemStatus(displayedItems[0], 'checked')"
                                :class="['status-button', 'checked', { active: displayedItems[0].status === 'checked' }]"
                              >
                                완료
                              </button>
                              <button
                                @click="setItemStatus(displayedItems[0], 'missing')"
                                :class="['status-button', 'missing', { active: displayedItems[0].status === 'missing' }]"
                              >
                                누락
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>
                    </Transition>
                    <button
                      class="card-nav-arrow card-nav-arrow-right"
                      @click="goToNextItem"
                      aria-label="다음 카드"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div 
                    v-for="item in displayedItems" 
                    :key="item.id || `${item.part_id}-${item.color_id}`"
                    class="part-card"
                    :class="getCardStatusClass(item.status)"
                  >
                      <div class="card-header">
                        <div class="part-info">
                          <div v-if="item.element_id" class="element-id">{{ item.element_id }}</div>
                          <h4 class="part-name">{{ item.part_name }}</h4>
                          <span 
                            class="color-badge"
                            :style="{ 
                              backgroundColor: getColorRgbSync(item.color_id, item) || '#ccc'
                            }"
                          >
                            {{ item.color_name || item.color_id }}
                          </span>
                        </div>
                        <button
                          @click="showPartInfo(item)"
                          class="part-info-btn"
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
                          :src="partImageUrls[item.id] || ''"
                          :alt="`${item.part_name} (${item.color_name})`"
                          class="part-image"
                          @error="handleImageError($event)"
                          @load="handleImageLoad($event)"
                        />
                      </div>

                      <div class="quantity-section">
                        <div class="quantity-control">
                          <button 
                            @click="decrementCount(item)"
                            :disabled="item.checked_count <= 0"
                            class="qty-button minus"
                          >
                            <span>−</span>
                          </button>
                          <div class="qty-display">
                            <input 
                              type="number"
                              :value="item.checked_count"
                              @input="updateItemCount(item, $event.target.value)"
                              :max="item.total_count"
                              min="0"
                              class="qty-input"
                            />
                            <span class="qty-divider">/</span>
                            <span class="qty-total">{{ item.total_count }}</span>
                          </div>
                          <button 
                            @click="incrementCount(item)"
                            :disabled="item.checked_count >= item.total_count"
                            class="qty-button plus"
                          >
                            <span>+</span>
                          </button>
                        </div>
                      </div>

                      <div class="status-section">
                        <div class="status-buttons">
                          <button
                            @click="setItemStatus(item, 'checked')"
                            :class="['status-button', 'checked', { active: item.status === 'checked' }]"
                          >
                            완료
                          </button>
                          <button
                            @click="setItemStatus(item, 'missing')"
                            :class="['status-button', 'missing', { active: item.status === 'missing' }]"
                          >
                            누락
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </template>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>

    <div v-if="error" class="error-toast">
      <span>{{ error }}</span>
    </div>
    <div v-if="syncErrorToast" class="sync-toast" role="status" aria-live="polite">
      <span>{{ syncErrorToast }}</span>
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
              <p class="part-color-info">{{ selectedPart.color_name }}</p>
            </div>

            <!-- 1. 부품으로 세트 찾기 -->
            <div class="info-section">
              <h5>포함된 세트</h5>
              <div v-if="partSetsLoading" class="loading-text">로딩 중...</div>
              <div v-else-if="partSets.length === 0" class="empty-text">포함된 세트가 없습니다</div>
              <div v-else class="sets-list">
                <div
                  v-for="set in partSets"
                  :key="set.id"
                  class="set-item"
                >
                  <span class="set-name">{{ set.name }}</span>
                  <span class="set-num">{{ set.set_num }}</span>
                </div>
              </div>
            </div>

            <!-- 2. 대체부품 찾기 -->
            <div class="info-section">
              <h5>대체 부품</h5>
              <div v-if="alternativePartsLoading" class="loading-text">로딩 중...</div>
              <div v-else-if="alternativeParts.length === 0" class="empty-text">대체 부품이 없습니다</div>
              <div v-else class="alternatives-list">
                <div
                  v-for="alt in alternativeParts.slice(0, 10)"
                  :key="alt.part_id"
                  class="alternative-item"
                >
                  <span class="alt-part-name">{{ alt.part_name }}</span>
                  <div class="alt-colors">
                    <span
                      v-for="color in alt.colors.slice(0, 5)"
                      :key="color.color_id"
                      class="color-chip"
                      :style="{ backgroundColor: color.rgb || '#ccc' }"
                      :title="color.name"
                    ></span>
                    <span v-if="alt.colors.length > 5" class="color-more">+{{ alt.colors.length - 5 }}</span>
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
import { ref, reactive, onMounted, watch, computed, onUnmounted } from 'vue'
import { Bar } from 'vue-chartjs' // 🔧 수정됨
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js' // 🔧 수정됨
import { useInspectionSession } from '../composables/useInspectionSession'
import { useSupabase } from '../composables/useSupabase'
import { usePartSearch } from '../composables/usePartSearch'
import { useRebrickable } from '../composables/useRebrickable'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend) // 🔧 수정됨

export default {
  name: 'ManualInspection',
  components: { Bar }, // 🔧 수정됨
  setup() {
    const { supabase } = useSupabase()
    const {
      loading,
      error,
      session,
      items,
      gridColumns,
      progress,
      missingCount,
      createSession,
      loadSession,
      updateItem,
      pauseSession: pauseSessionAction,
      completeSession: completeSessionAction,
      findLastSession,
      syncToServer,
      syncInProgress,
      lastSyncError,
      lastSyncAt,
      resetSessionState
    } = useInspectionSession()

    const selectedSetId = ref('')
    const availableSets = ref([])
    const lastSession = ref(null)
    const showSetDropdown = ref(false)
    const partImageUrls = ref({})
    const setDropdownRef = ref(null)
    const syncErrorToast = ref('')
    let syncErrorTimer = null
    const statusFilter = ref('all')
    const selectedSortMode = ref('sequence')
    const isOffline = ref(!navigator.onLine) // 🔧 수정됨
    const showAnalytics = ref(false) // 🔧 수정됨: 기본값 닫힘
    const inspectionMode = ref('single') // 🔧 수정됨: 'single' 또는 'grid'
    const currentItemIndex = ref(0) // 🔧 수정됨
    const slideDirection = ref('right') // 슬라이드 방향: 'left' 또는 'right'
    
    // 부품 검색 기능
    const { findSetsByPart, findAlternativeParts, findRarePartsInSet } = usePartSearch()
    const showPartInfoModal = ref(false)
    const selectedPart = ref(null)
    const partSets = ref([])
    const partSetsLoading = ref(false)
    const alternativeParts = ref([])
    const alternativePartsLoading = ref(false)
    const rareParts = ref([])
    const showRareParts = ref(true)
    
    // 색상 RGB 조회 (캐시)
    const colorRgbCache = ref(new Map())
    const getColorRgb = async (colorId) => {
      // colorId가 0일 수도 있으므로 null/undefined만 체크
      if (colorId === null || colorId === undefined) return null
      
      // 캐시 확인
      if (colorRgbCache.value.has(colorId)) {
        return colorRgbCache.value.get(colorId)
      }
      
      try {
        const { data, error } = await supabase
          .from('lego_colors')
          .select('rgb')
          .eq('color_id', colorId)
          .single()
        
        if (!error && data?.rgb) {
          let rgb = String(data.rgb).trim()
          // #이 없으면 추가
          if (rgb && !rgb.startsWith('#')) {
            rgb = `#${rgb}`
          }
          if (rgb && rgb !== '#null' && rgb !== '#undefined') {
            colorRgbCache.value.set(colorId, rgb)
            return rgb
          }
        }
      } catch (err) {
        console.warn('색상 RGB 조회 실패:', err)
      }
      
      return null
    }
    
    // 색상 RGB 동기 조회 (이미 로드된 items에서)
    const getColorRgbSync = (colorId, item = null) => {
      // colorId가 0일 수도 있으므로 null/undefined만 체크
      if (colorId === null || colorId === undefined) {
        console.warn('[getColorRgbSync] colorId가 없습니다:', { colorId, item })
        return null
      }
      
      // item이 직접 전달된 경우 우선 사용
      if (item && item.color_rgb) {
        let rgb = String(item.color_rgb).trim()
        // null, undefined, 빈 문자열 체크
        if (rgb && rgb !== 'null' && rgb !== 'undefined' && rgb !== '' && rgb !== 'None') {
          // #이 없으면 추가
          if (!rgb.startsWith('#')) {
            rgb = `#${rgb}`
          }
          colorRgbCache.value.set(colorId, rgb)
          
          // 디버깅: 특정 element_id인 경우 로그
          if (item.element_id === '6335317' || item.element_id === '306923') {
            console.log(`[getColorRgbSync] element_id ${item.element_id}: color_id=${colorId}, rgb=${rgb}, item.color_rgb=${item.color_rgb}`)
          }
          
          return rgb
        } else {
          // 디버깅: element_id 6335317인 경우 로그
          if (item.element_id === '6335317') {
            console.warn(`[getColorRgbSync] element_id 6335317: color_rgb가 유효하지 않습니다:`, { colorId, color_rgb: item.color_rgb, rgb })
          }
        }
      }
      
      // 캐시 확인
      if (colorRgbCache.value.has(colorId)) {
        const cachedRgb = colorRgbCache.value.get(colorId)
        if (item && (item.element_id === '6335317' || item.element_id === '306923')) {
          console.log(`[getColorRgbSync] element_id ${item.element_id}: 캐시에서 가져옴: color_id=${colorId}, rgb=${cachedRgb}`)
        }
        return cachedRgb
      }
      
      // items에서 찾기
      const foundItem = items.value.find(i => i.color_id === colorId)
      if (foundItem && foundItem.color_rgb) {
        let rgb = String(foundItem.color_rgb).trim()
        if (rgb && rgb !== 'null' && rgb !== 'undefined' && rgb !== '' && rgb !== 'None') {
          if (!rgb.startsWith('#')) {
            rgb = `#${rgb}`
          }
          colorRgbCache.value.set(colorId, rgb)
          
          // 디버깅: 특정 element_id인 경우 로그
          if (foundItem.element_id === '6335317' || foundItem.element_id === '306923') {
            console.log(`[getColorRgbSync] element_id ${foundItem.element_id}: items에서 찾음: color_id=${colorId}, rgb=${rgb}`)
          }
          
          return rgb
        }
      }
      
      // 디버깅: 특정 element_id인 경우 로그
      if (item && (item.element_id === '6335317' || item.element_id === '306923')) {
        console.warn(`[getColorRgbSync] element_id ${item.element_id}: RGB를 찾을 수 없습니다:`, { colorId, item, foundItem })
      }
      
      // RGB가 없으면 비동기로 조회 시도 (하지만 즉시 반환은 null)
      getColorRgb(colorId).catch(() => {})
      
      return null
    }
    
    // 스와이프 관련 상태
    const swipeState = reactive({
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      isSwiping: false
    })

    const sortOptions = [
      { value: 'sequence', label: '설명서 순서' },
      { value: 'color', label: '색상순' },
      { value: 'shape', label: '형태순' },
      { value: 'size', label: '크기순' },
      { value: 'rarity', label: '희귀도순' },
      { value: 'name', label: '이름순' }
    ]

    const statusOptions = [
      { value: 'all', label: '전체' },
      { value: 'pending', label: '미확인' },
      { value: 'checked', label: '완료' },
      { value: 'missing', label: '누락' }
    ]


    const statusLabel = (status) => {
      switch (status) {
        case 'checked':
          return '완료'
        case 'missing':
          return '누락'
        default:
          return '미확인'
      }
    }


    const displayedItems = computed(() => {
      const filtered = statusFilter.value === 'all'
        ? items.value
        : items.value.filter(item => item.status === statusFilter.value)

      const sorted = [...filtered]

      switch (selectedSortMode.value) {
        case 'color':
          sorted.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'ko'))
          break
        case 'shape':
          sorted.sort((a, b) => (a.shape_tag || '').localeCompare(b.shape_tag || '', 'ko'))
          break
        case 'size':
          sorted.sort((a, b) => {
            const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            if (aSize === bSize) {
              return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
            }
            return aSize - bSize
          })
          break
        case 'rarity':
          sorted.sort((a, b) => {
            const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
            const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
            if (aFreq === bFreq) {
              return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
            }
            return aFreq - bFreq
          })
          break
        case 'name':
          sorted.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || '', 'ko'))
          break
        case 'sequence':
        default:
          sorted.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
          break
      }

      // 단일 카드 모드일 때는 현재 인덱스의 아이템만 반환
      if (inspectionMode.value === 'single') {
        if (sorted.length > 0) {
          // currentItemIndex가 유효한지 확인하고, 범위를 벗어나면 0으로 리셋
          if (currentItemIndex.value >= sorted.length) {
            currentItemIndex.value = 0
          }
          const currentItem = sorted[currentItemIndex.value]
          return currentItem ? [currentItem] : []
        }
        return []
      }

      return sorted
    })

    // 단일 검수 모드에서 pending 아이템 총 개수
    const totalPendingItems = computed(() => {
      if (inspectionMode.value !== 'single') return 0
      
      const filtered = statusFilter.value === 'all'
        ? items.value
        : items.value.filter(item => item.status === statusFilter.value)
      
      const sorted = [...filtered]
      
      switch (selectedSortMode.value) {
        case 'color':
          sorted.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'ko'))
          break
        case 'shape':
          sorted.sort((a, b) => (a.shape_tag || '').localeCompare(b.shape_tag || '', 'ko'))
          break
        case 'size':
          sorted.sort((a, b) => {
            const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            if (aSize === bSize) {
              return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
            }
            return aSize - bSize
          })
          break
        case 'rarity':
          sorted.sort((a, b) => {
            const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
            const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
            if (aFreq === bFreq) {
              return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
            }
            return aFreq - bFreq
          })
          break
        case 'name':
          sorted.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || '', 'ko'))
          break
        case 'sequence':
        default:
          sorted.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
          break
      }
      
      const pendingItems = sorted.filter(item => item.status !== 'checked')
      return pendingItems.length
    })

    const statusCounts = computed(() => { // 🔧 수정됨
      return items.value.reduce((acc, item) => {
        const status = item?.status || 'pending'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, { pending: 0, checked: 0, missing: 0, hold: 0 })
    })

    const totalItems = computed(() => items.value.length) // 🔧 수정됨

    const elapsedSeconds = computed(() => { // 🔧 수정됨
      if (!session.started_at) return 0
      const started = new Date(session.started_at).getTime()
      const endTimestamp = session.completed_at ? new Date(session.completed_at).getTime() : Date.now()
      return Math.max(0, Math.floor((endTimestamp - started) / 1000))
    })

    const checkedItemsCount = computed(() => statusCounts.value.checked || 0) // 🔧 수정됨

    const averageSecondsPerItem = computed(() => { // 🔧 수정됨
      if (checkedItemsCount.value === 0) return 0
      return Math.floor(elapsedSeconds.value / checkedItemsCount.value)
    })

    const formatSeconds = (seconds) => { // 🔧 수정됨
      if (!seconds || seconds <= 0) return '--'
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      if (hours > 0) {
        return `${hours}시간 ${minutes}분`
      }
      if (minutes > 0) {
        return secs > 0 ? `${minutes}분 ${secs}초` : `${minutes}분`
      }
      return `${secs}초`
    }

    const averageDurationLabel = computed(() => formatSeconds(averageSecondsPerItem.value)) // 🔧 수정됨
    const elapsedDurationLabel = computed(() => formatSeconds(elapsedSeconds.value)) // 🔧 수정됨

    const missingRateLabel = computed(() => { // 🔧 수정됨
      if (totalItems.value === 0) return '--'
      const rate = (statusCounts.value.missing / totalItems.value) * 100
      return `${rate.toFixed(1)}%`
    })

    const statusChartData = computed(() => ({ // 🔧 수정됨
      labels: ['완료', '미확인', '누락', '보류'],
      datasets: [
        {
          label: '부품 수',
          data: [
            statusCounts.value.checked || 0,
            statusCounts.value.pending || 0,
            statusCounts.value.missing || 0,
            statusCounts.value.hold || 0
          ],
          backgroundColor: ['#1d4ed8', '#9ca3af', '#dc2626', '#f59e0b']
        }
      ]
    }))

    const statusChartOptions = { // 🔧 수정됨
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y ?? context.parsed ?? 0}개`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#4b5563' }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            maxTicksLimit: 10,
            color: '#6b7280'
          }
        }
      }
    }

    const qaReminder = computed(() => { // 🔧 수정됨
      if (!session.id) {
        return { visible: false, level: '', message: '' }
      }
      const missing = statusCounts.value.missing || 0
      const hold = statusCounts.value.hold || 0
      const pending = statusCounts.value.pending || 0
      if (missing > 0) {
        return {
          visible: true,
          level: 'alert',
          message: `누락 부품 ${missing}개가 확인되었습니다. 누락 사유를 기록하고 QA 재검수를 진행하세요.`
        }
      }
      if (hold > 0) {
        return {
          visible: true,
          level: 'warning',
          message: `보류 상태 부품 ${hold}개가 남아 있습니다. QA 체크리스트에 따라 추가 검토가 필요합니다.`
        }
      }
      if (pending === 0 && progress.value >= 80) {
        return {
          visible: true,
          level: 'info',
          message: '검수 완료 단계입니다. QA 최종 점검표를 실행한 뒤 세션을 종료하세요.'
        }
      }
      const elapsedMinutes = Math.floor(elapsedSeconds.value / 60)
      if (elapsedMinutes >= 45 && pending > 0) {
        return {
          visible: true,
          level: 'info',
          message: `검수 시간이 ${elapsedMinutes}분을 초과했습니다. QA 항목 중 중간 품질 확인을 수행하세요.`
        }
      }
      return { visible: false, level: '', message: '' }
    })


    const loadAvailableSets = async () => {
      try {
        const { data, error: err } = await supabase
          .from('lego_sets')
          .select('id, name, set_num')
          .order('name')
          .limit(100)

        if (err) throw err
        availableSets.value = data || []
      } catch (err) {
        console.error('세트 목록 로드 실패:', err)
      }
    }

    const startNewSession = async () => {
      if (!selectedSetId.value) return
      try {
        await createSession(selectedSetId.value)
        lastSession.value = null
        showSetDropdown.value = false
        currentItemIndex.value = 0
      } catch (err) {
        console.error('세션 시작 실패:', err)
      }
    }

    const resumeSession = async () => {
      if (!lastSession.value) return
      try {
        await loadSession(lastSession.value.id)
        selectedSetId.value = session.set_id
        showSetDropdown.value = false
        lastSession.value = null
        
        // 마지막 검수 완료한 부품 다음 부품으로 이동
        if (inspectionMode.value === 'single' && items.value.length > 0) {
          // displayedItems와 동일한 정렬 로직 적용
          const filtered = statusFilter.value === 'all'
            ? items.value
            : items.value.filter(item => item.status === statusFilter.value)
          const sorted = [...filtered]
          
          switch (selectedSortMode.value) {
            case 'color':
              sorted.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'ko'))
              break
            case 'shape':
              sorted.sort((a, b) => (a.shape_tag || '').localeCompare(b.shape_tag || '', 'ko'))
              break
            case 'size':
              sorted.sort((a, b) => {
                const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
                const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
                if (aSize === bSize) {
                  return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
                }
                return aSize - bSize
              })
              break
            case 'rarity':
              sorted.sort((a, b) => {
                const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
                const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
                if (aFreq === bFreq) {
                  return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
                }
                return aFreq - bFreq
              })
              break
            case 'name':
              sorted.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || '', 'ko'))
              break
            case 'sequence':
            default:
              sorted.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
              break
          }
          
          // 마지막 완료된 부품 찾기
          let lastCheckedIndex = -1
          for (let i = sorted.length - 1; i >= 0; i--) {
            if (sorted[i].status === 'checked') {
              lastCheckedIndex = i
              break
            }
          }
          
          // 마지막 완료된 부품 다음 인덱스로 설정
          if (lastCheckedIndex >= 0 && lastCheckedIndex < sorted.length - 1) {
            currentItemIndex.value = lastCheckedIndex + 1
          } else if (lastCheckedIndex === -1) {
            // 완료된 부품이 없으면 첫 번째 부품으로
            currentItemIndex.value = 0
          } else {
            // 모든 부품이 완료되었으면 첫 번째 부품으로
            currentItemIndex.value = 0
          }
        }
      } catch (err) {
        console.error('세션 복원 실패:', err)
      }
    }

    const selectedSetLabel = computed(() => {
      if (!selectedSetId.value) {
        return '세트를 선택하세요'
      }
      const match = availableSets.value.find(set => set.id === selectedSetId.value)
      if (!match) {
        return '세트를 선택하세요'
      }
      return `${match.name} (${match.set_num})`
    })

    const toggleSetDropdown = () => {
      if (loading.value) return
      showSetDropdown.value = !showSetDropdown.value
    }

    const handleSelectSet = (set) => {
      selectedSetId.value = set.id
      showSetDropdown.value = false
    }

    const handleClickOutsideDropdown = (event) => {
      if (setDropdownRef.value && !setDropdownRef.value.contains(event.target)) {
        showSetDropdown.value = false
      }
    }

    const findItemIndex = (itemId) => items.value.findIndex(i => i.id === itemId)

    const incrementCount = (item) => {
      const index = findItemIndex(item.id)
      if (index === -1) return
      const target = items.value[index]
      if (target.checked_count < target.total_count) {
        const newCount = target.checked_count + 1
        const newStatus = newCount === target.total_count ? 'checked' : target.status
        updateItem(index, {
          checked_count: newCount,
          status: newStatus
        })
        
        // 단일 카드 모드에서 수량이 total_count에 도달하면 자동으로 다음 카드로 이동
        if (inspectionMode.value === 'single' && newStatus === 'checked' && newCount === target.total_count) {
          slideDirection.value = 'right'
          // displayedItems와 동일한 정렬 로직으로 다음 pending 아이템 찾기
          const filtered = statusFilter.value === 'all'
            ? items.value
            : items.value.filter(item => item.status === statusFilter.value)
          const sorted = [...filtered]
          // 정렬 로직 적용 (displayedItems와 동일)
          switch (selectedSortMode.value) {
            case 'color':
              sorted.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'ko'))
              break
            case 'shape':
              sorted.sort((a, b) => (a.shape_tag || '').localeCompare(b.shape_tag || '', 'ko'))
              break
            case 'size':
              sorted.sort((a, b) => {
                const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
                const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
                if (aSize === bSize) {
                  return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
                }
                return aSize - bSize
              })
              break
            case 'rarity':
              sorted.sort((a, b) => {
                const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
                const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
                if (aFreq === bFreq) {
                  return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
                }
                return aFreq - bFreq
              })
              break
            case 'name':
              sorted.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || '', 'ko'))
              break
            case 'sequence':
            default:
              sorted.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
              break
          }
          // 현재 인덱스 이후의 다음 pending 아이템 찾기
          let nextPendingIndex = -1
          for (let i = currentItemIndex.value + 1; i < sorted.length; i++) {
            if (sorted[i].status !== 'checked') {
              nextPendingIndex = i
              break
            }
          }
          // 현재 인덱스 이후에 pending이 없으면 처음부터 찾기
          if (nextPendingIndex === -1) {
            for (let i = 0; i < currentItemIndex.value; i++) {
              if (sorted[i].status !== 'checked') {
                nextPendingIndex = i
                break
              }
            }
          }
          if (nextPendingIndex !== -1) {
            currentItemIndex.value = nextPendingIndex
          } else {
            // 모든 아이템이 완료되면 처음으로
            currentItemIndex.value = 0
          }
        }
      }
    }

    const decrementCount = (item) => {
      const index = findItemIndex(item.id)
      if (index === -1) return
      const target = items.value[index]
      if (target.checked_count > 0) {
        updateItem(index, {
          checked_count: target.checked_count - 1,
          status: target.checked_count - 1 === 0 ? 'pending' : target.status
        })
      }
    }

    const updateItemCount = (item, value) => {
      const index = findItemIndex(item.id)
      if (index === -1) return
      const target = items.value[index]
      const numValue = parseInt(value) || 0
      const clampedValue = Math.max(0, Math.min(numValue, target.total_count))
      const newStatus = clampedValue === target.total_count ? 'checked' :
                        clampedValue === 0 ? 'pending' : target.status

      updateItem(index, {
        checked_count: clampedValue,
        status: newStatus
      })
      
      // 단일 카드 모드에서 수량이 total_count에 도달하면 자동으로 다음 카드로 이동
      if (inspectionMode.value === 'single' && newStatus === 'checked' && clampedValue === target.total_count) {
        slideDirection.value = 'right'
        // displayedItems와 동일한 정렬 로직으로 다음 pending 아이템 찾기
        const filtered = statusFilter.value === 'all'
          ? items.value
          : items.value.filter(item => item.status === statusFilter.value)
        const sorted = [...filtered]
        // 정렬 로직 적용 (displayedItems와 동일)
        switch (selectedSortMode.value) {
          case 'color':
            sorted.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'ko'))
            break
          case 'shape':
            sorted.sort((a, b) => (a.shape_tag || '').localeCompare(b.shape_tag || '', 'ko'))
            break
          case 'size':
            sorted.sort((a, b) => {
              const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              if (aSize === bSize) {
                return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
              }
              return aSize - bSize
            })
            break
          case 'rarity':
            sorted.sort((a, b) => {
              const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
              const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
              if (aFreq === bFreq) {
                return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
              }
              return aFreq - bFreq
            })
            break
          case 'name':
            sorted.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || '', 'ko'))
            break
          case 'sequence':
          default:
            sorted.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
            break
        }
        // 현재 인덱스 이후의 다음 pending 아이템 찾기
        let nextPendingIndex = -1
        for (let i = currentItemIndex.value + 1; i < sorted.length; i++) {
          if (sorted[i].status !== 'checked') {
            nextPendingIndex = i
            break
          }
        }
        // 현재 인덱스 이후에 pending이 없으면 처음부터 찾기
        if (nextPendingIndex === -1) {
          for (let i = 0; i < currentItemIndex.value; i++) {
            if (sorted[i].status !== 'checked') {
              nextPendingIndex = i
              break
            }
          }
        }
        if (nextPendingIndex !== -1) {
          currentItemIndex.value = nextPendingIndex
        } else {
          // 모든 아이템이 완료되면 처음으로
          currentItemIndex.value = 0
        }
      }
    }

    const setItemStatus = (item, status) => {
      const index = findItemIndex(item.id)
      if (index === -1) return
      updateItem(index, { status })
      
      // 단일 카드 모드에서 상태가 'checked'로 변경되면 다음 카드로 자동 이동
      if (inspectionMode.value === 'single' && status === 'checked') {
        slideDirection.value = 'right'
        // displayedItems와 동일한 정렬 로직으로 다음 pending 아이템 찾기
        const filtered = statusFilter.value === 'all'
          ? items.value
          : items.value.filter(item => item.status === statusFilter.value)
        const sorted = [...filtered]
        // 정렬 로직 적용 (displayedItems와 동일)
        switch (selectedSortMode.value) {
          case 'color':
            sorted.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'ko'))
            break
          case 'shape':
            sorted.sort((a, b) => (a.shape_tag || '').localeCompare(b.shape_tag || '', 'ko'))
            break
          case 'size':
            sorted.sort((a, b) => {
              const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              if (aSize === bSize) {
                return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
              }
              return aSize - bSize
            })
            break
          case 'rarity':
            sorted.sort((a, b) => {
              const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
              const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
              if (aFreq === bFreq) {
                return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
              }
              return aFreq - bFreq
            })
            break
          case 'name':
            sorted.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || '', 'ko'))
            break
          case 'sequence':
          default:
            sorted.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
            break
        }
        // 현재 인덱스 이후의 다음 pending 아이템 찾기
        let nextPendingIndex = -1
        for (let i = currentItemIndex.value + 1; i < sorted.length; i++) {
          if (sorted[i].status !== 'checked') {
            nextPendingIndex = i
            break
          }
        }
        // 현재 인덱스 이후에 pending이 없으면 처음부터 찾기
        if (nextPendingIndex === -1) {
          for (let i = 0; i < currentItemIndex.value; i++) {
            if (sorted[i].status !== 'checked') {
              nextPendingIndex = i
              break
            }
          }
        }
        if (nextPendingIndex !== -1) {
          currentItemIndex.value = nextPendingIndex
        } else {
          // 모든 아이템이 완료되면 처음으로
          currentItemIndex.value = 0
        }
      }
    }
    
    const goToNextItem = () => {
      if (inspectionMode.value === 'single') {
        // 현재 부품이 부분 입력된 경우 보류 상태로 자동 변경
        const currentItem = displayedItems.value[0]
        if (currentItem) {
          const itemIndex = findItemIndex(currentItem.id)
          if (itemIndex !== -1) {
            const item = items.value[itemIndex]
            // 수량이 있지만 완료되지 않은 경우 누락 상태로 변경
            if (item.checked_count > 0 && item.checked_count < item.total_count && item.status !== 'checked') {
              updateItem(itemIndex, { status: 'missing' })
            }
          }
        }
        
        slideDirection.value = 'right'
        // displayedItems와 동일한 정렬 로직 사용 (모든 아이템 포함)
        const filtered = statusFilter.value === 'all'
          ? items.value
          : items.value.filter(item => item.status === statusFilter.value)
        const sorted = [...filtered]
        // 정렬 로직 적용
        switch (selectedSortMode.value) {
          case 'color':
            sorted.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'ko'))
            break
          case 'shape':
            sorted.sort((a, b) => (a.shape_tag || '').localeCompare(b.shape_tag || '', 'ko'))
            break
          case 'size':
            sorted.sort((a, b) => {
              const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              if (aSize === bSize) {
                return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
              }
              return aSize - bSize
            })
            break
          case 'rarity':
            sorted.sort((a, b) => {
              const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
              const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
              if (aFreq === bFreq) {
                return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
              }
              return aFreq - bFreq
            })
            break
          case 'name':
            sorted.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || '', 'ko'))
            break
          case 'sequence':
          default:
            sorted.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
            break
        }
        // 모든 아이템을 순회 (완료된 부품 포함)
        if (currentItemIndex.value < sorted.length - 1) {
          currentItemIndex.value++
        } else {
          currentItemIndex.value = 0
        }
      }
    }
    
    const goToPrevItem = () => {
      if (inspectionMode.value === 'single') {
        // 현재 부품이 부분 입력된 경우 보류 상태로 자동 변경
        const currentItem = displayedItems.value[0]
        if (currentItem) {
          const itemIndex = findItemIndex(currentItem.id)
          if (itemIndex !== -1) {
            const item = items.value[itemIndex]
            // 수량이 있지만 완료되지 않은 경우 누락 상태로 변경
            if (item.checked_count > 0 && item.checked_count < item.total_count && item.status !== 'checked') {
              updateItem(itemIndex, { status: 'missing' })
            }
          }
        }
        
        slideDirection.value = 'left'
        // displayedItems와 동일한 정렬 로직 사용 (모든 아이템 포함)
        const filtered = statusFilter.value === 'all'
          ? items.value
          : items.value.filter(item => item.status === statusFilter.value)
        const sorted = [...filtered]
        // 정렬 로직 적용
        switch (selectedSortMode.value) {
          case 'color':
            sorted.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'ko'))
            break
          case 'shape':
            sorted.sort((a, b) => (a.shape_tag || '').localeCompare(b.shape_tag || '', 'ko'))
            break
          case 'size':
            sorted.sort((a, b) => {
              const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              if (aSize === bSize) {
                return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
              }
              return aSize - bSize
            })
            break
          case 'rarity':
            sorted.sort((a, b) => {
              const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
              const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
              if (aFreq === bFreq) {
                return (a.part_name || '').localeCompare(b.part_name || '', 'ko')
              }
              return aFreq - bFreq
            })
            break
          case 'name':
            sorted.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || '', 'ko'))
            break
          case 'sequence':
          default:
            sorted.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
            break
        }
        // 모든 아이템을 순회 (완료된 부품 포함)
        if (currentItemIndex.value > 0) {
          currentItemIndex.value--
        } else {
          currentItemIndex.value = Math.max(0, sorted.length - 1)
        }
      }
    }

    // 부품 이미지 URL 로드 (element_id 기반으로 정확한 이미지 매칭)
    const loadPartImageUrls = async () => {
      if (!items.value || items.value.length === 0) return

      const imageUrlMap = {}
      const itemsWithElementId = items.value.filter(item => item.element_id)
      const itemsWithoutElementId = items.value.filter(item => !item.element_id)

      try {
        // 1. element_id가 있는 경우: part_images 테이블에서 element_id로 조회
        if (itemsWithElementId.length > 0) {
          const elementIds = [...new Set(itemsWithElementId.map(item => item.element_id).filter(Boolean))]
          
          const { data: partImages, error: partImagesError } = await supabase
            .from('part_images')
            .select('element_id, uploaded_url')
            .in('element_id', elementIds)
            .not('uploaded_url', 'is', null)

          if (!partImagesError && partImages) {
            partImages.forEach(pi => {
              const item = itemsWithElementId.find(i => i.element_id === pi.element_id)
              if (item && pi.uploaded_url) {
                imageUrlMap[item.id] = pi.uploaded_url
              }
            })
          }

          // 2. part_images에 없으면 기존 part_img_url 사용 (Rebrickable API 호출 최소화)
          itemsWithElementId.forEach(item => {
            if (!imageUrlMap[item.id] && item.part_img_url) {
              // 기존에 로드된 part_img_url 사용 (이미 element_id 기반으로 로드됨)
              imageUrlMap[item.id] = `/api/upload/proxy-image?url=${encodeURIComponent(item.part_img_url)}`
            }
          })
          
          // 3. part_img_url도 없으면 Supabase Storage에서 element_id 기반 파일명으로 시도
          itemsWithElementId.forEach(item => {
            if (!imageUrlMap[item.id] && item.element_id) {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
              const bucketName = 'lego_parts_images'
              const fileName = `${item.element_id}.webp`
              imageUrlMap[item.id] = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
            }
          })
        }

        // 4. element_id가 없는 경우: 기존 방식 (part_id + color_id) 사용
        if (itemsWithoutElementId.length > 0) {
          const partKeys = itemsWithoutElementId.map(item => ({
            id: item.id,
            part_id: item.part_id,
            color_id: item.color_id,
            part_img_url: item.part_img_url
          }))

          const partIds = [...new Set(partKeys.map(p => p.part_id))]
          const colorIds = [...new Set(partKeys.map(p => p.color_id))]

          const { data: partImages, error: partImagesError } = await supabase
            .from('part_images')
            .select('part_id, color_id, uploaded_url')
            .in('part_id', partIds)
            .in('color_id', colorIds)

          if (!partImagesError && partImages) {
            partImages.forEach(pi => {
              const item = partKeys.find(p => p.part_id === pi.part_id && p.color_id === pi.color_id)
              if (item && pi.uploaded_url && !imageUrlMap[item.id]) {
                imageUrlMap[item.id] = pi.uploaded_url
              }
            })
          }

          // Rebrickable URL 사용
          partKeys.forEach(item => {
            if (!imageUrlMap[item.id] && item.part_img_url) {
              imageUrlMap[item.id] = `/api/upload/proxy-image?url=${encodeURIComponent(item.part_img_url)}`
            }
          })

          // Supabase Storage URL 시도
          partKeys.forEach(item => {
            if (!imageUrlMap[item.id]) {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
              const bucketName = 'lego_parts_images'
              const fileName = `${item.part_id}_${item.color_id}.webp`
              imageUrlMap[item.id] = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
            }
          })
        }

        partImageUrls.value = imageUrlMap
      } catch (err) {
        console.error('이미지 URL 로드 실패:', err)
      }
    }

    const handleImageError = (event) => {
      // 이미지 로드 실패 시 숨김
      console.warn('[handleImageError] 이미지 로드 실패:', event.target.src)
      event.target.style.display = 'none'
    }

    const handleImageLoad = (event) => {
      // 이미지 로드 성공 시 표시
      event.target.style.display = 'block'
    }

    // items가 변경될 때 이미지 URL 로드 및 색상 RGB 캐시 업데이트
    watch(() => items.value, async (newItems) => {
      if (newItems && newItems.length > 0) {
        await loadPartImageUrls()
        
        // 색상 RGB 캐시 업데이트
        const colorIdsToLoad = []
        newItems.forEach(item => {
          if (item.color_id) {
            if (item.color_rgb) {
              let rgb = String(item.color_rgb).trim()
              if (rgb && rgb !== 'null' && rgb !== 'undefined') {
                if (!rgb.startsWith('#')) {
                  rgb = `#${rgb}`
                }
                colorRgbCache.value.set(item.color_id, rgb)
              } else {
                colorIdsToLoad.push(item.color_id)
              }
            } else {
              colorIdsToLoad.push(item.color_id)
            }
          }
        })
        
        // RGB가 없는 색상들은 비동기로 로드
        if (colorIdsToLoad.length > 0) {
          const uniqueColorIds = [...new Set(colorIdsToLoad)]
          for (const colorId of uniqueColorIds) {
            if (!colorRgbCache.value.has(colorId)) {
              await getColorRgb(colorId)
            }
          }
        }
      }
    }, { immediate: true })

    // 세션이 시작되면 희귀부품 로드
    watch(() => session.value?.set_id, (setId) => {
      if (setId) {
        loadRareParts()
      } else {
        rareParts.value = []
      }
    })

    const pauseSession = async () => {
      await pauseSessionAction()
      await finalizeSessionReset()
    }

    const completeSession = async () => {
      if (confirm('검수를 완료하시겠습니까?')) {
        await completeSessionAction()
        await finalizeSessionReset()
      }
    }

    const resetView = () => {
      selectedSetId.value = ''
      showSetDropdown.value = false
      gridColumns.value = 1
      currentItemIndex.value = 0
    }

    const finalizeSessionReset = async () => {
      await resetSessionState()
      resetView()
      lastSession.value = await findLastSession()
    }

    const getCardStatusClass = (status) => {
      return {
        'card-checked': status === 'checked',
        'card-hold': status === 'hold',
        'card-missing': status === 'missing',
        'card-pending': status === 'pending'
      }
    }

    // 스와이프 핸들러
    const handleSwipeStart = (e) => {
      if (inspectionMode.value !== 'single') return
      const touch = e.touches ? e.touches[0] : e
      swipeState.startX = touch.clientX
      swipeState.startY = touch.clientY
      swipeState.currentX = touch.clientX
      swipeState.currentY = touch.clientY
      swipeState.isSwiping = true
    }

    const handleSwipeMove = (e) => {
      if (!swipeState.isSwiping || inspectionMode.value !== 'single') return
      const touch = e.touches ? e.touches[0] : e
      swipeState.currentX = touch.clientX
      swipeState.currentY = touch.clientY
    }

    const handleSwipeEnd = (e) => {
      if (!swipeState.isSwiping || inspectionMode.value !== 'single') return
      
      const deltaX = swipeState.currentX - swipeState.startX
      const deltaY = swipeState.currentY - swipeState.startY
      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)
      
      // 수평 스와이프가 수직 스와이프보다 크고, 최소 거리 이상일 때만 처리
      const minSwipeDistance = 50
      if (absDeltaX > absDeltaY && absDeltaX > minSwipeDistance) {
        if (deltaX > 0) {
          // 오른쪽으로 스와이프 (이전 카드)
          goToPrevItem()
        } else {
          // 왼쪽으로 스와이프 (다음 카드)
          goToNextItem()
        }
      }
      
      // 스와이프 상태 리셋
      swipeState.isSwiping = false
      swipeState.startX = 0
      swipeState.startY = 0
      swipeState.currentX = 0
      swipeState.currentY = 0
    }

    const triggerManualSync = async () => {
      if (syncInProgress.value || isOffline.value) return
      try {
        await syncToServer()
      } catch (err) {
        console.error('수동 동기화 실패:', err)
        showSyncToast('수동 동기화에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    }

    // 부품 정보 모달 관련 함수
    const showPartInfo = async (item) => {
      selectedPart.value = item
      showPartInfoModal.value = true
      
      // 부품으로 세트 찾기
      partSetsLoading.value = true
      partSets.value = await findSetsByPart(item.part_id, item.color_id)
      partSetsLoading.value = false
      
      // 대체부품 찾기
      alternativePartsLoading.value = true
      alternativeParts.value = await findAlternativeParts(item.part_id, item.color_id)
      alternativePartsLoading.value = false
    }

    const closePartInfoModal = () => {
      showPartInfoModal.value = false
      selectedPart.value = null
      partSets.value = []
      alternativeParts.value = []
    }

    // 세트별 희귀부품 로드
    const loadRareParts = async () => {
      if (!session.value?.set_id) return
      try {
        const rare = await findRarePartsInSet(session.value.set_id)
        rareParts.value = rare
      } catch (err) {
        console.error('희귀부품 로드 실패:', err)
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

    const syncStatusMessage = computed(() => {
      if (!session.id) return ''
      if (isOffline.value) return '오프라인 상태 - 재연결 시 동기화됩니다'
      if (syncInProgress.value) return '동기화 중입니다'
      if (lastSyncError.value) return '동기화 실패'
      if (lastSyncAt.value) {
        return `마지막 동기화 ${formatTime(lastSyncAt.value)}`
      }
      return '동기화 대기 중'
    })

    const showSyncToast = (message) => {
      if (!message) return
      if (syncErrorTimer) {
        clearTimeout(syncErrorTimer)
        syncErrorTimer = null
      }
      syncErrorToast.value = message
      syncErrorTimer = setTimeout(() => {
        syncErrorToast.value = ''
        syncErrorTimer = null
      }, 5000)
    }

    const updateOnlineStatus = () => {
      isOffline.value = !navigator.onLine
    }

    watch(lastSyncError, (value) => {
      if (!value) return
      showSyncToast(`동기화 실패: ${value}`)
    })

    watch(isOffline, (offline) => {
      if (offline) {
        showSyncToast('오프라인 상태입니다. 변경사항이 로컬에 저장됩니다.')
      } else {
        showSyncToast('온라인으로 복구되었습니다. 동기화를 재시도합니다.')
        triggerManualSync()
      }
    })


    onMounted(async () => {
      await loadAvailableSets()
      lastSession.value = await findLastSession()
      document.addEventListener('click', handleClickOutsideDropdown)
      window.addEventListener('online', updateOnlineStatus)
      window.addEventListener('offline', updateOnlineStatus)
      if (isOffline.value) {
        showSyncToast('오프라인 상태입니다. 변경사항이 로컬에 저장됩니다.')
      }
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutsideDropdown)
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
      if (syncErrorTimer) {
        clearTimeout(syncErrorTimer)
        syncErrorTimer = null
      }
    })

    return {
      loading,
      error,
      session,
      items,
      gridColumns,
      progress,
      missingCount,
      selectedSetId,
      availableSets,
      lastSession,
      showSetDropdown,
      selectedSetLabel,
      toggleSetDropdown,
      handleSelectSet,
      setDropdownRef,
      startNewSession,
      resumeSession,
      incrementCount,
      decrementCount,
      updateItemCount,
      setItemStatus,
      partImageUrls,
      handleImageError,
      handleImageLoad,
      inspectionMode,
      currentItemIndex,
      slideDirection,
      goToNextItem,
      goToPrevItem,
      pauseSession,
      completeSession,
      triggerManualSync,
      getCardStatusClass,
      handleSwipeStart,
      handleSwipeMove,
      handleSwipeEnd,
      swipeState,
      formatDate,
      formatTime,
      syncStatusMessage,
      syncInProgress,
      showAnalytics,
      syncErrorToast,
      lastSyncError,
      isOffline,
      statusFilter,
      selectedSortMode,
      sortOptions,
      statusOptions,
      displayedItems,
      totalPendingItems,
      statusLabel,
      statusCounts,
      totalItems,
      averageDurationLabel,
      elapsedDurationLabel,
      missingRateLabel,
      statusChartData,
      statusChartOptions,
      qaReminder,
      showPartInfo,
      showPartInfoModal,
      selectedPart,
      partSets,
      partSetsLoading,
      alternativeParts,
      alternativePartsLoading,
      closePartInfoModal,
      rareParts,
      showRareParts,
      getColorRgbSync
    }
  }
}
</script>

<style scoped>
.pleyon-layout {
  min-height: 100vh;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
}

.layout-container {
  display: flex;
  min-height: calc(100vh - 0px);
}

.main-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-header {
  position: relative;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.panel-header.start-header {
  background: transparent;
  border-bottom: none;
  justify-content: center;
  padding: 1.5rem 1rem 1rem;
}

.panel-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.start-title {
  text-align: center;
  width: 100%;
  font-size: 2rem !important;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem;
  line-height: 1.2;
}

.session-title h1 {
  margin-bottom: 0.5rem;
}

.session-stats {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.stat-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.stat-badge.progress {
  background: #dbeafe;
  color: #1e40af;
}

.stat-badge.missing {
  background: #fee2e2;
  color: #991b1b;
}

.stat-badge.time {
  background: #f3f4f6;
  color: #4b5563;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mode-controls {
  display: flex;
  gap: 0.25rem;
  background: #f3f4f6;
  padding: 0.25rem;
  border-radius: 8px;
}

.mode-btn {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: #e5e7eb;
  color: #111827;
}

.mode-btn.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.grid-controls {
  display: flex;
  gap: 0.25rem;
  background: #f3f4f6;
  padding: 0.25rem;
  border-radius: 8px;
}

.grid-btn {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
}

.grid-btn:hover {
  background: #e5e7eb;
  color: #111827;
}

.grid-btn.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.action-btn {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #2563eb;
  color: #ffffff;
}

.action-btn.primary:hover {
  background: #1d4ed8;
}

.action-btn.secondary {
  background: #f3f4f6;
  color: #374151;
}

.action-btn.secondary:hover {
  background: #e5e7eb;
}

.sync-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sync-status {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #374151;
}

.sync-status .sync-text {
  flex: 1;
}

.sync-status .sync-action {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #2563eb;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sync-status .sync-action:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.sync-status .sync-action:not(:disabled):hover {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.analytics-toggle {
  position: absolute;
  left: 50%;
  bottom: -20px;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.analytics-toggle:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.toggle-icon {
  width: 20px;
  height: 20px;
  color: #6b7280;
  transition: transform 0.2s ease;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}

.sync-status.syncing {
  color: #2563eb;
}

.sync-status.error {
  color: #dc2626;
}

.sync-status.offline {
  color: #6b7280;
}

.sync-status.offline .sync-action {
  cursor: not-allowed;
  opacity: 0.6;
}

.sync-toast {
  position: fixed;
  bottom: 2.5rem;
  right: 2rem;
  background: #fee2e2;
  color: #b91c1c;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px -12px rgba(0,0,0,0.25);
  z-index: 60;
  font-size: 0.875rem;
}

.panel-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.session-setup {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setup-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
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
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.custom-select {
  position: relative;
}

.custom-select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.custom-select-trigger:hover {
  border-color: #a5b4fc;
}

.custom-select-trigger:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.8;
}

.custom-select-trigger:focus-visible {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.custom-select-value {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-select-icon {
  width: 1.1rem;
  height: 1.1rem;
  color: #6b7280;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.custom-select-trigger.open .custom-select-icon {
  transform: rotate(180deg);
  color: #1d4ed8;
}

.custom-select-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: 100%;
  max-height: 260px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 18px 36px -12px rgba(15, 23, 42, 0.25);
  z-index: 20;
  padding: 0.5rem;
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
  flex-direction: column;
  gap: 0.25rem;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.custom-select-option:hover {
  background: #f5f7ff;
}

.custom-select-option.active {
  background: #e0e7ff;
  color: #1d4ed8;
}

.option-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: inherit;
}

.option-subtitle {
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

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  margin-left: 0.5rem;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.resume-card {
  border-color: #dbeafe;
  background: #eff6ff;
}

.resume-info {
  margin-bottom: 1.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #dbeafe;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.progress-text {
  color: #2563eb;
}

.resume-actions {
  display: flex;
  gap: 0.5rem;
}

.inspection-workspace {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.progress-section {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 1.5rem;
}

.progress-bar-container {
  width: 100%;
  height: 12px;
  background: #f3f4f6;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
  transition: width 0.3s ease;
  border-radius: 6px;
}

.progress-stats {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.stat-value.error {
  color: #dc2626;
}

/* // 🔧 수정됨 */
.analytics-panel {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.5rem;
  align-items: stretch;
}

.metrics-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.metric-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  letter-spacing: 0.04em;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.metric-value.error {
  color: #dc2626;
}

.metric-hint {
  font-size: 0.8125rem;
  color: #6b7280;
}

.status-chart-panel {
  width: 260px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
}

.status-chart {
  width: 100%;
  height: 220px;
}

.qa-reminder {
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid #fee2e2;
  background: #fef2f2;
  color: #991b1b;
}

.qa-reminder.warning {
  border-color: #fef3c7;
  background: #fffbeb;
  color: #92400e;
}

.qa-reminder.info {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1e3a8a;
}

.qa-reminder-title {
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.qa-reminder-message {
  font-size: 0.9375rem;
  line-height: 1.5;
}

.workspace-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.status-filter-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.status-filter-button {
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

.status-filter-button:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.status-filter-button.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
}

.sort-control label {
  font-weight: 500;
}

.sort-select {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #1f2937;
  font-size: 0.875rem;
}

.items-container {
  background: transparent;
  border: none;
  padding: 0;
}

.items-grid {
  display: grid;
  gap: 1.25rem;
}

.items-grid.single-mode {
  grid-template-columns: 1fr;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  overflow: visible;
}

.part-card-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* 슬라이드 애니메이션 */
.slide-right-enter-active,
.slide-right-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease-in-out;
}

.slide-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-left-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.single-card-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  padding: 0;
  background: transparent;
  border: none;
}

.nav-btn {
  padding: 0.75rem 1.5rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  transition: all 0.2s;
  min-width: 80px;
}

.nav-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.card-counter {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  min-width: 200px;
}

.counter-content {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.counter-current {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2563eb;
  line-height: 1;
}

.counter-separator {
  font-size: 1.125rem;
  font-weight: 500;
  color: #9ca3af;
  line-height: 1;
}

.counter-total {
  font-size: 1.125rem;
  font-weight: 600;
  color: #6b7280;
  line-height: 1;
}

.counter-progress {
  width: 100%;
  height: 6px;
  background: #f3f4f6;
  border-radius: 999px;
  overflow: hidden;
}

.counter-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.part-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  position: relative;
  transition: transform 0.2s ease-out;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  flex: 1;
}

.part-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card-nav-arrow {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  color: #374151;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-nav-arrow:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: scale(1.05);
}

.card-nav-arrow:active:not(:disabled) {
  transform: scale(0.95);
}

.card-nav-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.card-nav-arrow svg {
  width: 24px;
  height: 24px;
}

.part-card.card-checked {
  background: #f0fdf4;
  border: 1px solid #e5e7eb;
}

.part-card.card-hold {
  background: #fffbeb;
  border: 1px solid #e5e7eb;
}

.part-card.card-missing {
  background: #fef2f2;
  border: 1px solid #e5e7eb;
}


.card-header {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

.part-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.element-id {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.part-name {
  font-size: 1rem;
  font-weight: 500;
  color: #111827;
  margin: 0;
}

.color-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  border: none;
  width: fit-content;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.quantity-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-button {
  width: 48px;
  height: 48px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: #374151;
  transition: all 0.2s;
  min-width: 48px;
  min-height: 48px;
}

.qty-button:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.qty-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  justify-content: center;
}

.qty-input {
  width: 60px;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  text-align: center;
  font-size: 1rem;
  font-weight: 500;
}

.qty-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.qty-divider {
  color: #9ca3af;
  font-weight: 500;
}

.qty-total {
  color: #6b7280;
  font-weight: 500;
}

.status-buttons {
  display: flex;
  gap: 0.5rem;
}

.status-button {
  flex: 1;
  padding: 0.625rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.status-button.checked.active {
  background: #10b981;
  color: #ffffff;
  border-color: #10b981;
}

.status-button.hold.active {
  background: #f59e0b;
  color: #ffffff;
  border-color: #f59e0b;
}

.status-button.missing.active {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

.status-button:hover {
  background: #f9fafb;
}

.status-button.active:hover {
  opacity: 0.9;
}

.card-action-buttons {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 0;
}

.part-image-section {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 0;
  min-height: 120px;
  background: transparent;
  border-radius: 8px;
}

.part-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}



.error-toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: #fee2e2;
  color: #991b1b;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

/* 태블릿 (1024px 이하) */
@media (max-width: 1024px) {
  .analytics-panel {
    grid-template-columns: 1fr; /* // 🔧 수정됨 */
  }

  .status-chart-panel {
    width: 100%; /* // 🔧 수정됨 */
  }


  .panel-header {
    padding: 1.25rem 1.5rem;
  }

  .panel-content {
    padding: 1.5rem;
  }

  .session-setup {
    max-width: 100%;
  }


  .nav-btn {
    min-width: 100px;
    padding: 1rem 1.5rem;
    font-size: 1rem;
  }
  
  .card-counter {
    font-size: 1.125rem;
  }
}

/* 모바일 (768px 이하) */
@media (max-width: 768px) {
  .metrics-overview {
    grid-template-columns: 1fr; /* // 🔧 수정됨 */
  }

  .panel-header {
    padding: 1rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .panel-header h1 {
    font-size: 1.25rem;
  }

  .start-title {
    font-size: 1.75rem !important;
  }

  .session-title h1 {
    font-size: 1.25rem;
  }

  .session-stats {
    gap: 0.5rem;
  }

  .stat-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }

  .header-actions {
    width: 100%;
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }

  .grid-controls {
    width: 100%;
    justify-content: space-between;
  }

  .grid-btn {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.8125rem;
  }

  .action-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  .panel-content {
    padding: 1rem;
  }

  .items-grid {
    /* 그리드 컬럼 수는 gridColumns 값에 따라 동적으로 설정됨 */
    gap: 1rem;
  }

  .items-container {
    padding: 0;
  }

  .part-card {
    padding: 1rem;
  }

  .progress-section {
    padding: 1rem;
  }

  .progress-stats {
    flex-direction: column;
    gap: 0.75rem;
  }

  .stat-item {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .session-setup {
    gap: 1rem;
  }

  .setup-card {
    border-radius: 8px;
  }

  .workspace-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .status-filter-group {
    width: 100%;
  }

  .sort-control {
    width: 100%;
    justify-content: space-between;
  }

  .sort-select {
    flex: 1;
  }

  .notes-dashboard {
    grid-template-columns: 1fr;
    gap: 1rem;
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

  .form-select {
    padding: 0.625rem;
    font-size: 0.875rem;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  .resume-actions {
    flex-direction: column;
  }

  .btn-secondary {
    margin-left: 0;
    margin-top: 0.5rem;
  }

  .quantity-control {
    gap: 0.375rem;
  }

  .qty-button {
    width: 56px;
    height: 56px;
    font-size: 1.75rem;
    min-width: 56px;
    min-height: 56px;
  }

  .qty-input {
    width: 50px;
    padding: 0.375rem;
    font-size: 0.875rem;
  }

  .status-buttons {
    flex-direction: column;
    gap: 0.375rem;
  }

  .status-button {
    padding: 0.5rem;
    font-size: 0.8125rem;
  }

  .part-image-section {
    min-height: 100px;
    padding: 0.75rem 0;
    background: transparent;
  }

  .part-image {
    max-height: 150px;
  }

  .nav-btn {
    min-width: 120px;
    padding: 1.25rem 1.75rem;
    font-size: 1.125rem;
  }
  
  .card-counter {
    padding: 0.875rem 1.25rem;
    min-width: 180px;
  }

  .counter-current {
    font-size: 1.375rem;
  }

  .counter-separator,
  .counter-total {
    font-size: 1rem;
  }

  .part-name {
    font-size: 0.9375rem;
  }

  .part-color {
    font-size: 0.8125rem;
  }
}

/* 작은 모바일 (480px 이하) */
@media (max-width: 480px) {
  .panel-header {
    padding: 0.75rem;
  }

  .panel-header h1 {
    font-size: 1.125rem;
  }

  .start-title {
    font-size: 1.5rem !important;
    margin-bottom: 0.5rem;
  }

  .panel-content {
    padding: 0.75rem;
  }

  .items-container {
    padding: 0;
  }

  .part-card {
    padding: 0.75rem;
  }

  .progress-section {
    padding: 0.75rem;
  }

  .card-header {
    padding: 0.75rem;
  }

  .card-body {
    padding: 0.75rem;
  }

  .error-toast {
    bottom: 1rem;
    right: 1rem;
    left: 1rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }
}

/* 희귀부품 알림 패널 */
.rare-parts-panel {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
}

.rare-parts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.rare-parts-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #9a3412;
  margin: 0;
}

.toggle-btn {
  background: transparent;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  color: #9a3412;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: #fed7aa;
}

.rare-parts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rare-part-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid #fed7aa;
}

.rare-part-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
}

.rare-part-badge {
  font-size: 0.75rem;
  color: #9a3412;
  background: #fed7aa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

/* 부품 정보 모달 */
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
}

.set-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
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
}

.alternatives-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alternative-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.alt-part-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.alt-colors {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.color-chip {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  display: inline-block;
}

.color-more {
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: 0.25rem;
}
</style>
