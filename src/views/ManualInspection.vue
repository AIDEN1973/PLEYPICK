<template>
  <div class="pleyon-layout">
    <div class="layout-container">
      <main class="main-panel">
        <header v-if="!session.id" class="page-header">
          <h1>부품검수</h1>
          <p>검수할 레고 세트를 선택하세요</p>
        </header>
        <header v-else class="panel-header session-header">
          <div class="header-left">
            <div class="session-title">
              <h1>{{ sessionDisplayName }}</h1>
              <div class="session-stats">
                <span class="stat-badge progress">{{ progress }}%</span>
                <span class="stat-badge missing" v-if="getMissingCountInfo().categoryCount > 0">
                  {{ getMissingCountInfo().categoryCount }}개 분류, 총 {{ getMissingCountInfo().totalCount }}개
                </span>
                <span class="stat-badge time">{{ formatTime(session.last_saved_at) }}</span>
              </div>
            </div>
          </div>
          <div class="header-actions">
            <div class="mode-controls">
              <button 
                @click="inspectionMode = 'single'"
                :class="['mode-btn', { active: inspectionMode === 'single' }]"
              >
                단일검수
              </button>
              <button 
                @click="inspectionMode = 'grid'"
                :class="['mode-btn', { active: inspectionMode === 'grid' }]"
              >
                그리드 검수
              </button>
            </div>
          </div>
        </header>

        <div class="panel-content">
          <div v-if="!session.id" class="search-section">
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
                          <span class="option-set-num">{{ formatSetNumber(set.set_num) }}</span>
                          <span class="option-set-title">{{ [set.theme_name, set.name].filter(Boolean).join(' ') || (set.name || '') }}</span>
                          <span class="option-set-parts">부품수 : {{ resolvePartCount(set) }}개</span>
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
                <button
                  @click="handleStartNewSession"
                  :disabled="!selectedSetId || loading"
                  class="btn-primary"
                >
                  검수 시작
                </button>
              </div>
            </div>
          </div>

          <!-- 진행 중인 세션 확인 모달 -->
          <div v-if="showExistingSessionModal" class="modal-overlay" @click="closeExistingSessionModal">
            <div class="modal-content" @click.stop>
              <div class="modal-header">
                <h3>진행 중인 검수 세션이 있습니다</h3>
                <!-- // 🔧 수정됨 -->
                <button 
                  type="button" 
                  class="modal-close-btn" 
                  @click="closeExistingSessionModal" 
                  aria-label="모달 닫기" 
                >
                  &times;
                </button>
              </div>
              <div class="modal-body">
                <div class="existing-session-info">
                <p><strong>세트명:</strong> {{ existingSessionInfo ? formatSetDisplay(existingSessionInfo.set_num, existingSessionInfo.set_theme_name, existingSessionInfo.set_name) : '알 수 없음' }}</p>
                  <p><strong>진행률:</strong> {{ existingSessionInfo?.progress || 0 }}%</p>
                  <p><strong>마지막 저장:</strong> {{ existingSessionInfo?.last_saved_at ? formatDate(existingSessionInfo.last_saved_at) : '-' }}</p>
                </div>
                <div class="modal-warning">
                  <p>새로 검수를 시작하면 기존 세션은 완료 처리됩니다.</p>
                </div>
              </div>
              <div class="modal-footer">
                <button @click="resumeExistingSession" class="btn-secondary">이어서 검수</button>
                <button @click="startNewSessionWithCompletion" class="btn-primary">새로 검수</button>
              </div>
            </div>
          </div>

          <div v-if="!session.id && lastSession" class="session-setup" style="margin-top: 1.5rem;">
            <div class="setup-card resume-card">
              <div class="card-header">
                <h3>진행 중 검수</h3>
                <p>진행 중이던 검수를 이어서 진행할 수 있습니다</p>
              </div>
              <div class="card-body">
                <div class="resume-info">
                  <div class="info-row">
                    <span class="info-label">세트명</span>
                    <span class="info-value">{{ lastSessionDisplayName || '알 수 없음' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">진행률</span>
                    <span class="info-value progress-text">
                      {{ lastSession?.progress || 0 }}%
                      <span v-if="lastSessionProgressInfo && lastSessionProgressInfo.total > 0" class="progress-detail">
                        ({{ lastSessionProgressInfo.checked }}/{{ lastSessionProgressInfo.total }})
                      </span>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">마지막 저장</span>
                    <span class="info-value">{{ lastSession?.last_saved_at ? formatDate(lastSession.last_saved_at) : '-' }}</span>
                  </div>
                </div>
                <div class="resume-actions">
                  <button @click="resumeSession" class="btn-primary">이어하기</button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="inspection-workspace">

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
                  <span 
                    v-if="option.value === 'missing' && getMissingCountInfo().categoryCount > 0" 
                    class="status-badge-count status-badge-count-missing"
                  >
                    {{ getMissingCountInfo().categoryCount }}개 분류, 총 {{ getMissingCountInfo().totalCount }}개
                  </span>
                  <span 
                    v-else-if="option.value !== 'missing' && getStatusCount(option.value) > 0" 
                    class="status-badge-count"
                  >
                    {{ getStatusCount(option.value) }}
                  </span>
                </button>
              </div>
              <div class="sort-control">
                <select id="sort-select" v-model="selectedSortMode" class="sort-select">
                  <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="items-container">
              <div v-if="inspectionMode === 'single' && displayedItems.length > 0" class="single-card-navigation">
                <div 
                  class="card-counter"
                >
                  <button
                    class="counter-arrow counter-arrow-left"
                    @click.stop="goToPrevItem"
                    :disabled="currentItemIndex === 0"
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <div class="counter-main">
                    <div class="counter-content">
                      <span class="counter-current">{{ currentItemIndex + 1 }}</span>
                      <span class="counter-separator">/</span>
                      <span class="counter-total">{{ totalItems }}</span>
                    </div>
                    <div 
                      class="counter-progress"
                      @mousedown="handleProgressDragStart"
                      @touchstart="handleProgressDragStart"
                      ref="progressBarRef"
                    >
                      <div class="counter-progress-bar" :style="{ width: `${((currentItemIndex + 1) / totalItems) * 100}%` }"></div>
                      <div 
                        class="counter-progress-handle"
                        :style="{ left: `${((currentItemIndex + 1) / totalItems) * 100}%` }"
                        @mousedown.stop="handleProgressDragStart"
                        @touchstart.stop="handleProgressDragStart"
                      ></div>
                    </div>
                  </div>
                  <button
                    class="counter-arrow counter-arrow-right"
                    @click.stop="goToNextItem"
                    :disabled="currentItemIndex >= totalItems - 1"
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </div>
              <div 
                class="items-grid" 
                :class="{ 'single-mode': inspectionMode === 'single', 'grid-mode': inspectionMode === 'grid' }"
              >
                <template v-if="inspectionMode === 'single'">
                  <div 
                    v-if="displayedItems.length > 0"
                    class="part-card-wrapper"
                  >
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
                                backgroundColor: getColorRgbSync(displayedItems[0].color_id, displayedItems[0]) || '#ccc',
                                color: getColorTextColor(displayedItems[0].color_rgb || getColorRgbSync(displayedItems[0].color_id, displayedItems[0]))
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
                          <div class="part-image-section" style="position: relative;">
                            <img
                              v-if="partImageUrls[displayedItems[0].id]"
                              :src="partImageUrls[displayedItems[0].id]"
                              :alt="`${displayedItems[0].part_name} (${displayedItems[0].color_name})`"
                              class="part-image"
                              @error="handleImageError($event)"
                              @load="(e) => { if (e && e.target) { displayedItems[0]._currentSrc = e.target.src; handleImageLoad(e); } }"
                            />
                            <div v-else class="no-part-image">이미지 없음</div>
                            <span 
                              v-if="partImageUrls[displayedItems[0].id] && (isCdnUrl(partImageUrls[displayedItems[0].id]) || (displayedItems[0]._currentSrc && isCdnUrl(displayedItems[0]._currentSrc)))"
                              class="cdn-badge"
                            >
                              CDN
                            </span>
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
                                <span class="qty-current">{{ displayedItems[0].checked_count }}</span>
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
                                정상
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
                    <div class="card-actions-bottom">
                      <button
                        @click="handleCompleteInspection"
                        class="save-button complete-save"
                      >
                        검수완료
                      </button>
                      <button
                        @click="handleTemporarySave"
                        class="save-button temporary-save"
                        :disabled="syncInProgress || isOffline"
                      >
                        {{ syncInProgress ? '저장 중...' : '임시저장' }}
                      </button>
                    </div>
                    <div v-if="session.id && inspectionMode === 'single' && allItemsForThumbnails.length > 0" class="parts-thumbnails">
                      <div class="thumbnails-scroll">
                        <div
                          v-for="(item, idx) in allItemsForThumbnails"
                          :key="item.id || `${item.part_id}-${item.color_id}`"
                          class="thumbnail-item"
                          :class="{ active: currentItemIndex === idx, ...getCardStatusClass(item.status) }"
                          @click="goToItemByIndex(idx)"
                        >
                          <div class="thumbnail-image">
                            <img
                              v-if="partImageUrls[item.id]"
                              :src="partImageUrls[item.id]"
                              :alt="`${item.part_name} (${item.color_name})`"
                              @error="handleImageError($event)"
                            />
                            <div v-else class="thumbnail-placeholder">이미지 없음</div>
                          </div>
                          <div class="thumbnail-info">
                            <div v-if="item.element_id" class="thumbnail-element-id">{{ item.element_id }}</div>
                            <div class="thumbnail-status" :class="getCardStatusClass(item.status)"></div>
                            <div class="thumbnail-count">{{ item.checked_count }}/{{ item.total_count }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
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
                              backgroundColor: getColorRgbSync(item.color_id, item) || '#ccc',
                              color: getColorTextColor(item.color_rgb || getColorRgbSync(item.color_id, item))
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
                      <div class="part-image-section" style="position: relative;">
                        <img
                          v-if="partImageUrls[item.id]"
                          :src="partImageUrls[item.id]"
                          :alt="`${item.part_name} (${item.color_name})`"
                          class="part-image"
                          @error="handleImageError($event)"
                          @load="(e) => { if (e && e.target) { item._currentSrc = e.target.src; handleImageLoad(e); } }"
                        />
                        <div v-else class="no-part-image">이미지 없음</div>
                        <span 
                          v-if="partImageUrls[item.id] && (isCdnUrl(partImageUrls[item.id]) || (item._currentSrc && isCdnUrl(item._currentSrc)))"
                          class="cdn-badge"
                        >
                          CDN
                        </span>
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
                            <span class="qty-current">{{ item.checked_count }}</span>
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
                            정상
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

    <!-- 그리드 검수 모드 하단 고정 버튼 -->
    <div v-if="session.id && inspectionMode === 'grid'" class="grid-mode-bottom-actions">
      <div class="bottom-actions-container">
        <button
          @click="handleCompleteInspection"
          class="save-button complete-save"
        >
          검수완료
        </button>
        <button
          @click="handleTemporarySave"
          class="save-button temporary-save"
          :disabled="syncInProgress || isOffline"
        >
          {{ syncInProgress ? '저장 중...' : '임시저장' }}
        </button>
      </div>
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
              <div v-if="selectedPart.element_id" class="element-id-display">
                <strong>{{ selectedPart.element_id }}</strong>
              </div>
              <h4>{{ selectedPart.part_name }}</h4>
              <p class="part-color-info">{{ formatColorLabel(selectedPart.color_name, selectedPart.color_id, selectedPart.part_id) }}</p> <!-- // 🔧 수정됨 -->
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
                  role="button"
                  tabindex="0"
                  @click="handleSetRowClick(set)"
                  @keydown.enter.prevent="handleSetRowClick(set)"
                >
                  <span class="set-name">{{ set.name || '이름 없음' }}</span> <!-- // 🔧 수정됨 -->
                  <span class="set-num">{{ displaySetNumber(set.set_num) }}</span> <!-- // 🔧 수정됨 -->
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
                  role="button"
                  tabindex="0"
                  @click="handleAlternativePartClick(alt)"
                  @keydown.enter.prevent="handleAlternativePartClick(alt)"
                >
                  <div class="alt-part-info"> <!-- // 🔧 수정됨 -->
                    <span class="alt-part-name">{{ alt.part_name }}</span> <!-- // 🔧 수정됨 -->
                    <span class="alt-part-id">부품 번호: {{ alt.part_id }}</span> <!-- // 🔧 수정됨 -->
                  </div>
                  <div v-if="alt.colors && alt.colors.length > 0" class="alt-colors"> <!-- // 🔧 수정됨 -->
                    <div
                      v-for="color in alt.colors"
                      :key="`${alt.part_id}-${color.color_id}`"
                      class="alt-color-row"
                    >
                      <span
                        class="color-chip"
                        :style="{ backgroundColor: color.rgb ? (String(color.rgb).startsWith('#') ? color.rgb : `#${color.rgb}`) : '#ccc' }"
                      ></span>
                      <span class="alt-color-name">{{ formatColorLabel(color.name, color.color_id, alt.part_id) }}</span>
                      <span v-if="color.element_id" class="alt-element-id">Element ID: {{ color.element_id }}</span>
                    </div>
                  </div>
                  <div v-else class="empty-text">색상 정보가 없습니다</div> <!-- // 🔧 수정됨 -->
                </div>
              </div>
            </div>
          </div>
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
  </div>
</template>

<script>
import { ref, reactive, onMounted, watch, computed, onUnmounted, nextTick, onActivated } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useInspectionSession } from '../composables/useInspectionSession'
import { useSupabase } from '../composables/useSupabase'
import { formatSetNumber, formatThemeName, formatSetDisplay, fetchSetMetadata } from '../utils/setDisplay'

import { usePartSearch } from '../composables/usePartSearch'
import { useRebrickable } from '../composables/useRebrickable'
import { usePleyonInventorySync } from '../composables/usePleyonInventorySync'
import SetPartsSyncModal from '../components/SetPartsSyncModal.vue'

export default {
  name: 'ManualInspection',
  components: {
    SetPartsSyncModal
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const { supabase, user, loading: userLoading } = useSupabase()
    const { checkSetPartsExist, syncSetParts, syncing, syncProgress, syncStatus, error: syncError } = usePleyonInventorySync()
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
      completeSessionById,
      syncToServer,
      syncInProgress,
      lastSyncError,
      lastSyncAt,
      resetSessionState
    } = useInspectionSession()

    const selectedSetId = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0) // 강제 리렌더링을 위한 key
    const setSearchQuery = ref('')
    const lastSession = ref(null)
    const showSetDropdown = ref(false)
    const partImageUrls = ref({})
    const setDropdownRef = ref(null)
    const syncErrorToast = ref('')
    let syncErrorTimer = null
    const statusFilter = ref('all')
    const selectedSortMode = ref('color')
    const isOffline = ref(!navigator.onLine) // 🔧 수정됨
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
    const sessionMetadata = ref(null)
    const lastSessionMetadata = ref(null)
    const sessionDisplayName = computed(() => {
      const meta = sessionMetadata.value
      const setNum = session.set_num || meta?.set_num
      const themeName = session.set_theme_name || meta?.theme_name
      const setName = session.set_name || meta?.set_name
      return formatSetDisplay(setNum, themeName, setName)
    })
    const lastSessionDisplayName = computed(() => {
      if (!lastSession.value) return ''
      const meta = lastSessionMetadata.value
      const setNum = lastSession.value.set_num || meta?.set_num
      const themeName = lastSession.value.set_theme_name || meta?.theme_name
      const setName = lastSession.value.set_name || meta?.set_name
      return formatSetDisplay(setNum, themeName, setName || '세트명 없음')
    })

    const lastSessionItems = ref([])
    const lastSessionItemsLoading = ref(false)

    const loadLastSessionItems = async () => {
      if (!lastSession.value?.id || lastSessionItemsLoading.value) return
      
      lastSessionItemsLoading.value = true
      try {
        const { data, error } = await supabase
          .from('inspection_items')
          .select('id, status')
          .eq('session_id', lastSession.value.id)
        
        if (!error && data) {
          lastSessionItems.value = data
        }
      } catch (err) {
        console.error('마지막 세션 부품 조회 실패:', err)
      } finally {
        lastSessionItemsLoading.value = false
      }
    }

    const lastSessionProgressInfo = computed(() => {
      if (!lastSession.value) return null
      
      const totalItems = lastSessionItems.value.length || 0
      const checkedItems = lastSessionItems.value.filter(item => item.status === 'checked').length
      
      return {
        total: totalItems,
        checked: checkedItems,
        progress: lastSession.value.progress || 0
      }
    })

    watch(lastSession, async (newSession) => {
      if (newSession?.id) {
        await loadLastSessionItems()
      } else {
        lastSessionItems.value = []
      }
    }, { immediate: true })
    
    // 진행 중인 세션 확인 모달
    const showExistingSessionModal = ref(false)
    const existingSessionInfo = ref(null)
    
    // 동기화 모달 관련
    const showSyncModal = ref(false)
    const syncSetNum = ref('')
    const syncCompleted = ref(false)
    const syncPartsCount = ref(0)
    
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

    const applyMetadataToTarget = (target, meta) => {
      if (!target || !meta) return
      if (meta.set_num && !target.set_num) {
        target.set_num = meta.set_num
      }
      if (meta.theme_name && !target.set_theme_name) {
        target.set_theme_name = meta.theme_name
      }
      if (meta.set_name && !target.set_name) {
        target.set_name = meta.set_name
      }
    }

    const hydrateSetMetadata = async (setId) => {
      if (!setId) return null
      try {
        const metadataMap = await fetchSetMetadata(supabase, [setId])
        return metadataMap.get(setId) || null
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('세트 메타데이터 로드 실패:', err)
        }
        return null
      }
    }

    watch(
      () => session.set_id,
      async (newSetId) => {
        if (!newSetId) {
          sessionMetadata.value = null
          return
        }

        const meta = await hydrateSetMetadata(newSetId)
        sessionMetadata.value = meta
        applyMetadataToTarget(session, meta)
      },
      { immediate: true }
    )

    watch(
      () => lastSession.value?.set_id,
      async (newSetId) => {
        if (!newSetId) {
          lastSessionMetadata.value = null
          return
        }

        const meta = await hydrateSetMetadata(newSetId)
        lastSessionMetadata.value = meta
        if (lastSession.value) {
          applyMetadataToTarget(lastSession.value, meta)
        }
      },
      { immediate: true }
    )
    
    // 색상 RGB 동기 조회 (이미 로드된 items에서)
    // 대체부품의 RGB 값 처리 (색상 정보 표시용)
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

    const getColorRgbFromAlternative = (rgb) => {
      if (!rgb || rgb === null || rgb === 'null' || rgb === 'undefined') {
        return null
      }
      
      let rgbStr = String(rgb).trim()
      if (!rgbStr || rgbStr === 'null' || rgbStr === 'undefined' || rgbStr === 'None') {
        return null
      }
      
      // # 접두사 추가
      if (!rgbStr.startsWith('#')) {
        rgbStr = `#${rgbStr}`
      }
      
      // 유효한 hex 색상인지 확인 (6자리)
      if (rgbStr.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(rgbStr)) {
        return rgbStr.toUpperCase()
      }
      
      return null
    }

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
          return rgb
        }
      }
      
      // 캐시 확인
      if (colorRgbCache.value.has(colorId)) {
        return colorRgbCache.value.get(colorId)
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
          return rgb
        }
      }
      
      // RGB가 없으면 비동기로 조회 시도 (하지만 즉시 반환은 null)
      getColorRgb(colorId).catch(() => {})
      
      return null
    }
    
    const normalizeSetNumber = (setNum) => { // 🔧 수정됨
      if (!setNum) return '' // 🔧 수정됨
      const str = String(setNum).trim() // 🔧 수정됨
      return str.replace(/-1$/, '') // 🔧 수정됨
    } // 🔧 수정됨

    // CDN URL인지 확인하는 함수
    const isCdnUrl = (url) => {
      if (!url) return false
      return url.includes('cdn.rebrickable.com')
    }

    const displaySetNumber = (setNum) => { // 🔧 수정됨
      const normalized = normalizeSetNumber(setNum) // 🔧 수정됨
      return formatSetNumber(normalized) // 🔧 수정됨
    } // 🔧 수정됨

    const formatColorLabel = (colorName, colorId, partId = null) => { // 🔧 수정됨
      // 미니피규어인 경우 (part_id가 fig-로 시작)
      if (partId && String(partId).toLowerCase().startsWith('fig-')) {
        return 'Any Color'
      }
      
      if (colorName) { // 🔧 수정됨
        const normalized = String(colorName).trim() // 🔧 수정됨
        const lower = normalized.toLowerCase() // 🔧 수정됨
        if ( // 🔧 수정됨
          lower === 'no color' || // 🔧 수정됨
          lower === 'any color' || // 🔧 수정됨
          (lower.includes('no color') && lower.includes('any color')) || // 🔧 수정됨
          (normalized.includes('No Color') && normalized.includes('Any Color')) // 🔧 수정됨
        ) { // 🔧 수정됨
          return 'Any Color' // 🔧 수정됨
        } // 🔧 수정됨
        return normalized // 🔧 수정됨
      } // 🔧 수정됨
      if (colorId || colorId === 0) { // 🔧 수정됨
        return `Color ${colorId}` // 🔧 수정됨
      } // 🔧 수정됨
      return '색상 정보 없음' // 🔧 수정됨
    } // 🔧 수정됨

    // 스와이프 관련 상태
    const swipeState = reactive({
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      isSwiping: false
    })

    const progressBarRef = ref(null)
    const isDraggingProgress = ref(false)

    const sortOptions = [
      { value: 'sequence', label: '설명서 순' },
      { value: 'color', label: '색상순' },
      { value: 'shape', label: '형태순' },
      { value: 'size', label: '크기순' },
      { value: 'rarity', label: '희귀도순' },
      { value: 'name', label: '이름순' }
    ]

    const statusOptions = [
      { value: 'all', label: '전체' },
      { value: 'pending', label: '미확인' },
      { value: 'checked', label: '정상확인' },
      { value: 'missing', label: '누락' }
    ]

    const statusLabel = (status) => {
      switch (status) {
        case 'checked':
          return '정상확인'
        case 'missing':
          return '누락'
        default:
          return '미확인'
      }
    }

    const getStatusCount = (statusValue) => {
      if (statusValue === 'all') {
        return items.value.length
      }
      return statusCounts.value[statusValue] || 0
    }

    const getMissingCountInfo = () => {
      const missingItems = items.value.filter(item => item.status === 'missing')
      const categoryCount = missingItems.length
      const totalCount = missingItems.reduce((sum, item) => {
        const missingQty = (item.total_count || 0) - (item.checked_count || 0)
        return sum + missingQty
      }, 0)
      return { categoryCount, totalCount }
    }


    // 스티커 판별 함수
    const isSticker = (item) => {
      const partName = (item.part_name || '').toLowerCase()
      const shapeTag = (item.shape_tag || '').toLowerCase()
      const partId = (item.part_id || '').toLowerCase()
      
      return partName.includes('sticker') || 
             partName.includes('스티커') ||
             shapeTag === 'sticker' ||
             partId.includes('sticker') ||
             partId.includes('stk-')
    }

    // 피규어 판별 함수
    const isMinifigure = (item) => {
      const partId = item.part_id || ''
      return String(partId).toLowerCase().startsWith('fig-')
    }

    const displayedItems = computed(() => {
      const filtered = statusFilter.value === 'all'
        ? items.value
        : items.value.filter(item => item.status === statusFilter.value)

      const sorted = [...filtered]

      switch (selectedSortMode.value) {
        case 'color':
          sorted.sort((a, b) => {
            // 우선순위: 일반 부품(0) > 피규어(1) > 스티커(2)
            const aIsSticker = isSticker(a)
            const bIsSticker = isSticker(b)
            const aIsMinifigure = isMinifigure(a)
            const bIsMinifigure = isMinifigure(b)
            
            // 우선순위 계산: 일반 부품=0, 피규어=1, 스티커=2
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
              // 둘 다 숫자면 숫자 비교, 아니면 문자열 비교
              const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
              const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
              if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
              }
              // 숫자 변환 실패 시 문자열 비교
              return String(aElementId || '').localeCompare(String(bElementId || ''))
            }
            // 3차: 부품명 (같은 element_id 내에서)
            return (a.part_name || '').localeCompare(b.part_name || '')
          })
          break
        case 'shape':
          sorted.sort((a, b) => {
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
            return (a.shape_tag || '').localeCompare(b.shape_tag || '')
          })
          break
        case 'size':
          sorted.sort((a, b) => {
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
            const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            if (aSize === bSize) {
              return (a.part_name || '').localeCompare(b.part_name || '')
            }
            return aSize - bSize
          })
          break
        case 'rarity':
          sorted.sort((a, b) => {
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
            const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
            const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
            if (aFreq === bFreq) {
              return (a.part_name || '').localeCompare(b.part_name || '')
            }
            return aFreq - bFreq
          })
          break
        case 'name':
          sorted.sort((a, b) => {
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
            return (a.part_name || '').localeCompare(b.part_name || '')
          })
          break
        case 'sequence':
        default:
          sorted.sort((a, b) => {
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
            return (a.sequence_index ?? 0) - (b.sequence_index ?? 0)
          })
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

    // 썸네일용 전체 아이템 목록 (정렬된 모든 아이템)
    const allItemsForThumbnails = computed(() => {
      const filtered = statusFilter.value === 'all'
        ? items.value
        : items.value.filter(item => item.status === statusFilter.value)

      const sorted = [...filtered]

      switch (selectedSortMode.value) {
        case 'color':
          sorted.sort((a, b) => {
            // 우선순위: 일반 부품(0) > 피규어(1) > 스티커(2)
            const aIsSticker = isSticker(a)
            const bIsSticker = isSticker(b)
            const aIsMinifigure = isMinifigure(a)
            const bIsMinifigure = isMinifigure(b)
            
            // 우선순위 계산: 일반 부품=0, 피규어=1, 스티커=2
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
              // 둘 다 숫자면 숫자 비교, 아니면 문자열 비교
              const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
              const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
              if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
              }
              // 숫자 변환 실패 시 문자열 비교
              return String(aElementId || '').localeCompare(String(bElementId || ''))
            }
            // 3차: 부품명 (같은 element_id 내에서)
            return (a.part_name || '').localeCompare(b.part_name || '')
          })
          break
        case 'shape':
          sorted.sort((a, b) => {
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
            return (a.shape_tag || '').localeCompare(b.shape_tag || '')
          })
          break
        case 'size':
          sorted.sort((a, b) => {
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
            const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            if (aSize === bSize) {
              return (a.part_name || '').localeCompare(b.part_name || '')
            }
            return aSize - bSize
          })
          break
        case 'rarity':
          sorted.sort((a, b) => {
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
            const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
            const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
            if (aFreq === bFreq) {
              return (a.part_name || '').localeCompare(b.part_name || '')
            }
            return aFreq - bFreq
          })
          break
        case 'name':
          sorted.sort((a, b) => {
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
            return (a.part_name || '').localeCompare(b.part_name || '')
          })
          break
        case 'sequence':
        default:
          sorted.sort((a, b) => {
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
            return (a.sequence_index ?? 0) - (b.sequence_index ?? 0)
          })
          break
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
          sorted.sort((a, b) => {
            const aIsSticker = isSticker(a)
            const bIsSticker = isSticker(b)
            if (aIsSticker !== bIsSticker) {
              return aIsSticker ? 1 : -1
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
              // 둘 다 숫자면 숫자 비교, 아니면 문자열 비교
              const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
              const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
              if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
              }
              // 숫자 변환 실패 시 문자열 비교
              return String(aElementId || '').localeCompare(String(bElementId || ''))
            }
            // 3차: 부품명 (같은 element_id 내에서)
            return (a.part_name || '').localeCompare(b.part_name || '')
          })
          break
        case 'shape':
          sorted.sort((a, b) => {
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
            return (a.shape_tag || '').localeCompare(b.shape_tag || '')
          })
          break
        case 'size':
          sorted.sort((a, b) => {
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
            const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
            if (aSize === bSize) {
              return (a.part_name || '').localeCompare(b.part_name || '')
            }
            return aSize - bSize
          })
          break
        case 'rarity':
          sorted.sort((a, b) => {
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
            const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
            const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
            if (aFreq === bFreq) {
              return (a.part_name || '').localeCompare(b.part_name || '')
            }
            return aFreq - bFreq
          })
          break
        case 'name':
          sorted.sort((a, b) => {
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
            return (a.part_name || '').localeCompare(b.part_name || '')
          })
          break
        case 'sequence':
        default:
          sorted.sort((a, b) => {
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
            return (a.sequence_index ?? 0) - (b.sequence_index ?? 0)
          })
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
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
              .eq('set_num', query)
              .limit(20)

        if (!exactError && exactMatch && exactMatch.length > 0) {
          results = exactMatch
        } else {
          // 2단계: 메인 세트 번호로 정확히 일치
            const { data: mainMatch, error: mainError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
              .eq('set_num', mainSetNum)
              .limit(20)

          if (!mainError && mainMatch && mainMatch.length > 0) {
            results = mainMatch
          } else {
            // 3단계: 메인 세트 번호로 시작하는 모든 세트 검색
            const { data: likeMatch, error: likeError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
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
                theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
                part_count: set.num_parts || 0
              }))
            } else {
              results = results.map(set => ({
                ...set,
                theme_name: null,
                part_count: set.num_parts || 0
              }))
            }
          } else {
            results = results.map(set => ({
              ...set,
              theme_name: null,
              part_count: set.num_parts || 0
            }))
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
      // blur 이벤트가 드롭다운 클릭보다 먼저 발생할 수 있으므로 약간의 지연
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    // 진행 중인 세션 확인
    const checkExistingSession = async (setId) => {
      if (!user.value || !setId) return null

      try {
        // 서버에서 확인
        const { data: serverSessions, error } = await supabase
          .from('inspection_sessions')
          .select(`
            id,
            set_id,
            status,
            progress,
            started_at,
            last_saved_at,
            lego_sets:set_id (
              name,
              set_num,
              theme_id
            )
          `)
          .eq('set_id', setId)
          .eq('user_id', user.value.id)
          .in('status', ['in_progress', 'paused'])
          .order('last_saved_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!error && serverSessions) {
          const sessionData = {
            id: serverSessions.id,
            set_id: serverSessions.set_id,
            set_name: serverSessions.lego_sets?.name || '세트명 없음',
            set_num: serverSessions.lego_sets?.set_num || null,
            set_theme_name: null,
            status: serverSessions.status,
            progress: serverSessions.progress || 0,
            last_saved_at: serverSessions.last_saved_at
          }

          if (serverSessions.lego_sets?.theme_id) {
            const { data: themeData } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .eq('theme_id', serverSessions.lego_sets.theme_id)
              .maybeSingle()

            sessionData.set_theme_name = themeData?.name || null
          } else {
            const meta = await hydrateSetMetadata(sessionData.set_id)
            applyMetadataToTarget(sessionData, meta)
          }

          return sessionData
        }

        return null
      } catch (err) {
        console.error('기존 세션 확인 실패:', err)
        return null
      }
    }

    // 새 세션 시작 처리 (모달 표시)
    const handleStartNewSession = async () => {
      if (!selectedSetId.value) return

      const existingSession = await checkExistingSession(selectedSetId.value)
      if (existingSession) {
        const meta = await hydrateSetMetadata(existingSession.set_id)
        applyMetadataToTarget(existingSession, meta)
        existingSessionInfo.value = existingSession
        showExistingSessionModal.value = true
      } else {
        await startNewSession()
      }
    }

    // 모달 닫기
    const closeExistingSessionModal = () => {
      showExistingSessionModal.value = false
      existingSessionInfo.value = null
    }

    // 기존 세션 이어서 검수
    const resumeExistingSession = async () => {
      if (!existingSessionInfo.value) return
      
      closeExistingSessionModal()
      await loadSession(existingSessionInfo.value.id)
      selectedSetId.value = session.set_id
      
      // 세트 정보 조회하여 검색창에 표시
      if (session.set_id) {
        const { data: setData, error: setError } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id')
          .eq('id', session.set_id)
          .maybeSingle()
        
        if (!setError && setData) {
          setSearchQuery.value = setData.set_num
          if (setData.theme_id) {
            const { data: themeData } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .eq('theme_id', setData.theme_id)
              .maybeSingle()
            
            searchResults.value = [{
              ...setData,
              theme_name: themeData?.name || null
            }]
          } else {
            searchResults.value = [{ ...setData, theme_name: null }]
          }
          searchResultsKey.value++
        }
      }
      
      showSetDropdown.value = false
      lastSession.value = null
    }

    // 새로 검수 (기존 세션 완료 처리)
    const startNewSessionWithCompletion = async () => {
      if (!selectedSetId.value || !existingSessionInfo.value) return

      try {
        // 기존 세션 완료 처리
        await completeSessionById(existingSessionInfo.value.id)
        
        closeExistingSessionModal()
        await startNewSession()
      } catch (err) {
        console.error('기존 세션 완료 처리 실패:', err)
        closeExistingSessionModal()
        await startNewSession()
      }
    }

    const startNewSession = async () => {
      if (!selectedSetId.value) return
      try {
        const newSession = await createSession(selectedSetId.value)
        if (newSession && newSession.id) {
          router.push(`/manual-inspection?session=${newSession.id}`)
        }
        // 새 세션 시작 후 다른 세션이 있는지 확인
        lastSession.value = await findLastSession(user.value?.id)
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
        
        // 세트 정보 조회하여 검색창에 표시
        if (session.set_id) {
          const { data: setData, error: setError } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id')
            .eq('id', session.set_id)
            .maybeSingle()
          
          if (!setError && setData) {
            setSearchQuery.value = setData.set_num
            // theme_id가 있으면 테마 정보도 조회
            if (setData.theme_id) {
              const { data: themeData } = await supabase
                .from('lego_themes')
                .select('theme_id, name')
                .eq('theme_id', setData.theme_id)
                .maybeSingle()
              
              searchResults.value = [{
                ...setData,
                theme_name: themeData?.name || null
              }]
            } else {
              searchResults.value = [{ ...setData, theme_name: null }]
            }
            searchResultsKey.value++
          }
        }
        
        showSetDropdown.value = false
        // 세션 복원 후 다른 세션이 있는지 확인
        lastSession.value = await findLastSession()
        
        await focusLastInspectedItem() // 🔧 수정됨
      } catch (err) {
        console.error('세션 복원 실패:', err)
      }
    }

    const selectedSet = computed(() => {
      if (!selectedSetId.value) return null
      return searchResults.value.find(set => set.id === selectedSetId.value)
    })

    const handleSelectSet = async (set) => {
      selectedSetId.value = set.id
      // 검색창에는 메인 세트 번호만 표시 (하이픈 이전 부분)
      const mainSetNum = set.set_num.split('-')[0]
      setSearchQuery.value = mainSetNum
      showSetDropdown.value = false
      searchResults.value = [{ ...set }] // 새 객체로 복사
      searchResultsKey.value++ // 강제 리렌더링
      
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
        console.error(`[ManualInspection] 부품 정보 확인 실패:`, checkError)
        // 확인 실패해도 계속 진행
      }
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
        console.error('[ManualInspection] 동기화 실패:', err)
      }
    }
    
    const handleSyncClose = () => {
      showSyncModal.value = false
      syncSetNum.value = ''
      syncCompleted.value = false
      syncPartsCount.value = 0
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
              sorted.sort((a, b) => {
                const aIsSticker = isSticker(a)
                const bIsSticker = isSticker(b)
                if (aIsSticker !== bIsSticker) {
                  return aIsSticker ? 1 : -1
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
              // 둘 다 숫자면 숫자 비교, 아니면 문자열 비교
              const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
              const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
              if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
              }
              // 숫자 변환 실패 시 문자열 비교
              return String(aElementId || '').localeCompare(String(bElementId || ''))
            }
            // 3차: 부품명 (같은 element_id 내에서)
            return (a.part_name || '').localeCompare(b.part_name || '')
              })
              break
            case 'shape':
              sorted.sort((a, b) => {
                const aIsSticker = isSticker(a)
                const bIsSticker = isSticker(b)
                if (aIsSticker !== bIsSticker) {
                  return aIsSticker ? 1 : -1
                }
                return (a.shape_tag || '').localeCompare(b.shape_tag || '')
              })
              break
            case 'size':
              sorted.sort((a, b) => {
                const aIsSticker = isSticker(a)
                const bIsSticker = isSticker(b)
                if (aIsSticker !== bIsSticker) {
                  return aIsSticker ? 1 : -1
                }
                const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
                const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
                if (aSize === bSize) {
                  return (a.part_name || '').localeCompare(b.part_name || '')
                }
                return aSize - bSize
              })
              break
            case 'rarity':
              sorted.sort((a, b) => {
                const aIsSticker = isSticker(a)
                const bIsSticker = isSticker(b)
                if (aIsSticker !== bIsSticker) {
                  return aIsSticker ? 1 : -1
                }
                const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
                const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
                if (aFreq === bFreq) {
                  return (a.part_name || '').localeCompare(b.part_name || '')
                }
                return aFreq - bFreq
              })
              break
            case 'name':
              sorted.sort((a, b) => {
                const aIsSticker = isSticker(a)
                const bIsSticker = isSticker(b)
                if (aIsSticker !== bIsSticker) {
                  return aIsSticker ? 1 : -1
                }
                return (a.part_name || '').localeCompare(b.part_name || '')
              })
              break
            case 'sequence':
            default:
              sorted.sort((a, b) => {
                const aIsSticker = isSticker(a)
                const bIsSticker = isSticker(b)
                if (aIsSticker !== bIsSticker) {
                  return aIsSticker ? 1 : -1
                }
                return (a.sequence_index ?? 0) - (b.sequence_index ?? 0)
              })
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
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
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
              // 둘 다 숫자면 숫자 비교, 아니면 문자열 비교
              const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
              const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
              if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
              }
              // 숫자 변환 실패 시 문자열 비교
              return String(aElementId || '').localeCompare(String(bElementId || ''))
            }
            // 3차: 부품명 (같은 element_id 내에서)
            return (a.part_name || '').localeCompare(b.part_name || '')
            })
            break
          case 'shape':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              return (a.shape_tag || '').localeCompare(b.shape_tag || '')
            })
            break
          case 'size':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              if (aSize === bSize) {
                return (a.part_name || '').localeCompare(b.part_name || '')
              }
              return aSize - bSize
            })
            break
          case 'rarity':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
              const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
              if (aFreq === bFreq) {
                return (a.part_name || '').localeCompare(b.part_name || '')
              }
              return aFreq - bFreq
            })
            break
          case 'name':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              return (a.part_name || '').localeCompare(b.part_name || '')
            })
            break
          case 'sequence':
          default:
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              return (a.sequence_index ?? 0) - (b.sequence_index ?? 0)
            })
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
      const target = items.value[index]
      
      // 완료 버튼 클릭 시 재고 수량 자동으로 채우기
      if (status === 'checked') {
        updateItem(index, { 
          status: 'checked',
          checked_count: target.total_count
        })
      } else {
        updateItem(index, { status })
      }
      
      // 단일 카드 모드에서 상태가 'checked' 또는 'missing'로 변경되면 다음 카드로 자동 이동
      if (inspectionMode.value === 'single' && (status === 'checked' || status === 'missing')) {
        slideDirection.value = 'right'
        // displayedItems와 동일한 정렬 로직으로 다음 pending 아이템 찾기
        const filtered = statusFilter.value === 'all'
          ? items.value
          : items.value.filter(item => item.status === statusFilter.value)
        const sorted = [...filtered]
        // 정렬 로직 적용 (displayedItems와 동일)
        switch (selectedSortMode.value) {
          case 'color':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
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
              // 둘 다 숫자면 숫자 비교, 아니면 문자열 비교
              const aNum = typeof aElementId === 'number' ? aElementId : (aElementId ? parseInt(String(aElementId)) : null)
              const bNum = typeof bElementId === 'number' ? bElementId : (bElementId ? parseInt(String(bElementId)) : null)
              if (aNum !== null && bNum !== null && !isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
              }
              // 숫자 변환 실패 시 문자열 비교
              return String(aElementId || '').localeCompare(String(bElementId || ''))
            }
            // 3차: 부품명 (같은 element_id 내에서)
            return (a.part_name || '').localeCompare(b.part_name || '')
            })
            break
          case 'shape':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              return (a.shape_tag || '').localeCompare(b.shape_tag || '')
            })
            break
          case 'size':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              const aSize = a.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              const bSize = b.expected_stud_count ?? Number.MAX_SAFE_INTEGER
              if (aSize === bSize) {
                return (a.part_name || '').localeCompare(b.part_name || '')
              }
              return aSize - bSize
            })
            break
          case 'rarity':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
              const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
              if (aFreq === bFreq) {
                return (a.part_name || '').localeCompare(b.part_name || '')
              }
              return aFreq - bFreq
            })
            break
          case 'name':
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              return (a.part_name || '').localeCompare(b.part_name || '')
            })
            break
          case 'sequence':
          default:
            sorted.sort((a, b) => {
              const aIsSticker = isSticker(a)
              const bIsSticker = isSticker(b)
              if (aIsSticker !== bIsSticker) {
                return aIsSticker ? 1 : -1
              }
              return (a.sequence_index ?? 0) - (b.sequence_index ?? 0)
            })
            break
        }
        // 현재 인덱스 이후의 다음 pending 아이템 찾기 (checked가 아닌 아이템)
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
    
    const handleProgressDragStart = (e) => {
      if (inspectionMode.value !== 'single' || displayedItems.value.length === 0) return
      
      e.preventDefault()
      isDraggingProgress.value = true
      
      const handleMove = (moveEvent) => {
        if (!progressBarRef.value) return
        
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX
        const rect = progressBarRef.value.getBoundingClientRect()
        const x = clientX - rect.left
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
        const newIndex = Math.round((percentage / 100) * totalItems.value) - 1
        const clampedIndex = Math.max(0, Math.min(totalItems.value - 1, newIndex))
        
        if (clampedIndex !== currentItemIndex.value) {
          goToItemByIndex(clampedIndex)
        }
      }
      
      const handleEnd = () => {
        isDraggingProgress.value = false
        document.removeEventListener('mousemove', handleMove)
        document.removeEventListener('mouseup', handleEnd)
        document.removeEventListener('touchmove', handleMove)
        document.removeEventListener('touchend', handleEnd)
      }
      
      handleMove(e)
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleMove)
      document.addEventListener('touchend', handleEnd)
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
                return (a.part_name || '').localeCompare(b.part_name || '')
              }
              return aSize - bSize
            })
            break
          case 'rarity':
            sorted.sort((a, b) => {
              const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
              const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
              if (aFreq === bFreq) {
                return (a.part_name || '').localeCompare(b.part_name || '')
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
    
    const goToItemByIndex = (index) => {
      if (inspectionMode.value === 'single' && index >= 0 && index < allItemsForThumbnails.value.length) {
        currentItemIndex.value = index
        slideDirection.value = 'right'
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
                return (a.part_name || '').localeCompare(b.part_name || '')
              }
              return aSize - bSize
            })
            break
          case 'rarity':
            sorted.sort((a, b) => {
              const aFreq = a.usage_frequency ?? Number.MAX_SAFE_INTEGER
              const bFreq = b.usage_frequency ?? Number.MAX_SAFE_INTEGER
              if (aFreq === bFreq) {
                return (a.part_name || '').localeCompare(b.part_name || '')
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
          const elementIds = [...new Set(itemsWithElementId.map(item => item.element_id).filter(Boolean))].map(id => String(id))
          
          const { data: partImages, error: partImagesError } = await supabase
            .from('part_images')
            .select('element_id, uploaded_url')
            .in('element_id', elementIds)
            .not('uploaded_url', 'is', null)

          if (!partImagesError && partImages) {
            partImages.forEach(pi => {
              const item = itemsWithElementId.find(i => String(i.element_id) === String(pi.element_id))
              if (item && pi.uploaded_url) {
                imageUrlMap[item.id] = pi.uploaded_url
              }
            })
          }

          // 2. part_images에 없으면 Supabase Storage에서 element_id 기반 파일명으로 시도
          for (const item of itemsWithElementId) {
            if (!imageUrlMap[item.id] && item.element_id) {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
              const bucketName = 'lego_parts_images'
              const fileName = `${String(item.element_id)}.webp`
              const directUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
              try {
                const response = await fetch(directUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
                // 400, 404는 파일 없음으로 처리 (콘솔 오류 방지)
                if (response.status === 400 || response.status === 404) {
                  continue
                }
                if (response.ok) {
                  imageUrlMap[item.id] = directUrl
                }
              } catch (fetchError) {
                // 파일이 없으면 무시
              }
            }
          }
          
          // 3. Storage에도 없으면 Rebrickable API에서 element_img_url 가져오기
          for (const item of itemsWithElementId) {
            if (!imageUrlMap[item.id] && item.element_id) {
              try {
                const { getElement } = useRebrickable()
                const elementData = await getElement(item.element_id)
                if (elementData?.element_img_url) {
                  imageUrlMap[item.id] = elementData.element_img_url
                } else if (elementData?.part_img_url) {
                  imageUrlMap[item.id] = elementData.part_img_url
                }
              } catch (elementErr) {
                console.warn(`⚠️ element_id ${item.element_id} 이미지 조회 실패:`, elementErr)
              }
            }
          }
          
          // 4. element_id 실패 시 part_img_url 사용 (fallback)
          itemsWithElementId.forEach(item => {
            if (!imageUrlMap[item.id] && item.part_img_url) {
              imageUrlMap[item.id] = item.part_img_url
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
              imageUrlMap[item.id] = item.part_img_url
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
      const imgSrc = event.target.src
      // 빈 문자열이나 현재 페이지 URL과 같은 잘못된 URL은 로그 출력하지 않음
      if (imgSrc && imgSrc !== window.location.href && imgSrc !== window.location.origin + window.location.pathname) {
        console.warn('[handleImageError] 이미지 로드 실패:', imgSrc)
      }
      event.target.style.display = 'none'
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

    const handleImageLoad = (event) => {
      // 이미지 로드 성공 시 표시
      if (event && event.target) {
        event.target.style.display = 'block'
      }
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

    // 단일검수 모드에서 부품 이미지 출력 영역 스타일 디버깅
    watch([() => inspectionMode.value, () => displayedItems.value], async () => {
      if (inspectionMode.value === 'single' && displayedItems.value.length > 0) {
        await nextTick()
        // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 확인
        setTimeout(() => {
          const partImageSection = document.querySelector('.part-card-wrapper .part-image-section')
          if (partImageSection) {
            const computedStyle = window.getComputedStyle(partImageSection)
            const partImage = partImageSection.querySelector('.part-image')
            const partImageStyle = partImage ? window.getComputedStyle(partImage) : null
            const partImageNatural = partImage ? {
              naturalWidth: partImage.naturalWidth,
              naturalHeight: partImage.naturalHeight,
              clientWidth: partImage.clientWidth,
              clientHeight: partImage.clientHeight,
              offsetWidth: partImage.offsetWidth,
              offsetHeight: partImage.offsetHeight
            } : null
            
            console.log('[ManualInspection] 단일검수 모드 - 부품 이미지 출력 영역 스타일:', {
              inspectionMode: inspectionMode.value,
              element: partImageSection,
              classList: Array.from(partImageSection.classList),
              parentClassList: partImageSection.parentElement ? Array.from(partImageSection.parentElement.classList) : [],
              sectionStyles: {
                padding: computedStyle.padding,
                paddingTop: computedStyle.paddingTop,
                paddingBottom: computedStyle.paddingBottom,
                minHeight: computedStyle.minHeight,
                height: computedStyle.height,
                display: computedStyle.display,
                alignItems: computedStyle.alignItems,
                justifyContent: computedStyle.justifyContent,
                clientHeight: partImageSection.clientHeight,
                offsetHeight: partImageSection.offsetHeight
              },
              imageStyles: partImageStyle ? {
                maxWidth: partImageStyle.maxWidth,
                maxHeight: partImageStyle.maxHeight,
                width: partImageStyle.width,
                height: partImageStyle.height,
                objectFit: partImageStyle.objectFit
              } : null,
              imageDimensions: partImageNatural,
              inlineStyle: partImageSection.getAttribute('style')
            })
          } else {
            console.warn('[ManualInspection] 단일검수 모드 - .part-card-wrapper .part-image-section 요소를 찾을 수 없습니다')
          }
        }, 100)
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

    const handleCompleteInspection = async () => {
      if (!session.id) return
      if (confirm('검수를 완료하시겠습니까?')) {
        try {
          await completeSessionAction()
          await finalizeSessionReset()
        } catch (err) {
          console.error('검수 완료 실패:', err)
          showSyncToast('검수 완료에 실패했습니다.')
        }
      }
    }

    const handleSaveLocal = async () => {
      if (!session.id) return
      try {
        await syncToServer({ forceFullSync: true })
        showSyncToast('서버 저장 완료')
      } catch (err) {
        console.error('저장 실패:', err)
        showSyncToast('저장에 실패했습니다.')
      }
    }

    const handleTemporarySave = async () => {
      if (syncInProgress.value || isOffline.value || !session.id) return
      try {
        await pauseSessionAction()
        showSyncToast('임시저장 완료')
      } catch (err) {
        console.error('임시저장 실패:', err)
        showSyncToast('임시저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
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
      
      // 대체부품 찾기 (현재 세트 제외)
      alternativePartsLoading.value = true
      const currentSetId = session?.set_id || selectedSetId.value || null
      alternativeParts.value = await findAlternativeParts(item.part_id, item.color_id, currentSetId)
      console.log('[ManualInspection] 대체부품 데이터:', alternativeParts.value, '제외된 세트 ID:', currentSetId)
      if (alternativeParts.value && alternativeParts.value.length > 0) {
        console.log('[ManualInspection] 대체부품 색상:', alternativeParts.value[0].colors)
      }
      alternativePartsLoading.value = false
    }

    const handleSetRowClick = async (set) => { // 🔧 수정됨
      if (!set || !set.set_num) return // 🔧 수정됨
      try { // 🔧 수정됨
        const targetSetNum = normalizeSetNumber(set.set_num) // 🔧 수정됨
        setSearchQuery.value = targetSetNum // 🔧 수정됨
        await searchSets() // 🔧 수정됨
        let target = searchResults.value.find(result => normalizeSetNumber(result.set_num) === targetSetNum) // 🔧 수정됨
        if (!target) { // 🔧 수정됨
          target = { // 🔧 수정됨
            id: set.id, // 🔧 수정됨
            set_num: targetSetNum, // 🔧 수정됨
            name: set.name, // 🔧 수정됨
            theme_id: set.theme_id || null, // 🔧 수정됨
            theme_name: set.theme_name || null, // 🔧 수정됨
            webp_image_url: set.image_url || null, // 🔧 수정됨
            set_img_url: set.image_url || null, // 🔧 수정됨
            num_parts: set.quantity || null // 🔧 수정됨
          } // 🔧 수정됨
        } // 🔧 수정됨
        await handleSelectSet(target) // 🔧 수정됨
        closePartInfoModal() // 🔧 수정됨
      } catch (err) { // 🔧 수정됨
        console.error('[ManualInspection] 세트 항목 클릭 실패:', err) // 🔧 수정됨
      } // 🔧 수정됨
    } // 🔧 수정됨

    const handleAlternativePartClick = (part) => { // 🔧 수정됨
      if (!part) return // 🔧 수정됨
      const query = {} // 🔧 수정됨
      if (part.element_id) { // 🔧 수정됨
        query.element = String(part.element_id) // 🔧 수정됨
      } else if (part.part_id) { // 🔧 수정됨
        query.part = part.part_id // 🔧 수정됨
        if (part.color_id !== null && part.color_id !== undefined) { // 🔧 수정됨
          query.color = part.color_id // 🔧 수정됨
        } // 🔧 수정됨
      } // 🔧 수정됨
      if (Object.keys(query).length === 0) return // 🔧 수정됨
      router.push({ // 🔧 수정됨
        path: '/part-to-set-search', // 🔧 수정됨
        query // 🔧 수정됨
      }) // 🔧 수정됨
    } // 🔧 수정됨

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
        showSyncToast('오프라인 상태입니다. 변경사항은 연결 복구 후에만 저장됩니다.')
      } else {
        showSyncToast('온라인으로 복구되었습니다. 동기화를 재시도합니다.')
        triggerManualSync()
      }
    })

    // 정렬 또는 필터 변경 시 단일 검수 모드에서 인덱스 리셋
    watch([selectedSortMode, statusFilter], () => {
      if (inspectionMode.value === 'single') {
        currentItemIndex.value = 0
      }
    })


    const focusLastInspectedItem = async () => { // 🔧 수정됨
      if (inspectionMode.value !== 'single') return // 🔧 수정됨
      if (!Array.isArray(items.value) || items.value.length === 0) return // 🔧 수정됨

      statusFilter.value = 'all' // 🔧 수정됨
      await nextTick() // 🔧 수정됨

      const sorted = [...items.value].sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0)) // 🔧 수정됨
      const targetItem = sorted.find(candidate => candidate?.status !== 'checked') || sorted[0] || null // 🔧 수정됨

      if (!targetItem) { // 🔧 수정됨
        currentItemIndex.value = 0 // 🔧 수정됨
        session.last_active_item_id = null // 🔧 수정됨
        return // 🔧 수정됨
      } // 🔧 수정됨

      const targetIndex = sorted.findIndex(item => item?.id === targetItem.id) // 🔧 수정됨
      currentItemIndex.value = targetIndex >= 0 ? targetIndex : 0 // 🔧 수정됨
      session.last_active_item_id = targetItem.id // 🔧 수정됨
    }

    // URL 쿼리 파라미터에서 세션 로드하는 함수
    const loadSessionFromQuery = async (sessionId) => {
      if (!sessionId || typeof sessionId !== 'string') return false
      
      try {
        await loadSession(sessionId)
        selectedSetId.value = session.set_id
        
        // 세트 정보 조회하여 검색창에 표시
        if (session.set_id) {
          const { data: setData, error: setError } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id')
            .eq('id', session.set_id)
            .maybeSingle()
          
          if (!setError && setData) {
            setSearchQuery.value = setData.set_num
            // theme_id가 있으면 테마 정보도 조회
            if (setData.theme_id) {
              const { data: themeData } = await supabase
                .from('lego_themes')
                .select('theme_id, name')
                .eq('theme_id', setData.theme_id)
                .maybeSingle()
              
              searchResults.value = [{
                ...setData,
                theme_name: themeData?.name || null
              }]
            } else {
              searchResults.value = [{ ...setData, theme_name: null }]
            }
            searchResultsKey.value++
          }
        }
        
        await focusLastInspectedItem() // 🔧 수정됨
        return true
      } catch (err) {
        console.error('세션 로드 실패:', err)
        return false
      }
    }

    // URL 쿼리 파라미터 변경 감지
    watch(() => route.query.session, async (newSessionId) => {
      if (newSessionId && typeof newSessionId === 'string') {
        await loadSessionFromQuery(newSessionId)
      }
    })

    let isLoadingLastSession = false

    // 사용자가 로드된 후 마지막 세션 찾기
    const loadLastSessionIfNeeded = async () => {
      console.log('[loadLastSessionIfNeeded] 시작', {
        hasUser: !!user.value,
        userId: user.value?.id,
        isLoadingLastSession,
        sessionId: session.id,
        routePath: route.path,
        routeQuery: route.query
      })

      if (!user.value) {
        console.log('[loadLastSessionIfNeeded] 사용자 없음, 종료')
        return
      }

      if (isLoadingLastSession) {
        console.log('[loadLastSessionIfNeeded] 이미 로딩 중, 종료')
        return
      }

      isLoadingLastSession = true

      try {
        // URL 쿼리 파라미터에서 세션 ID 확인
        const sessionId = route.query.session
        console.log('[loadLastSessionIfNeeded] 세션 ID 확인', { sessionId })
        
        if (sessionId && typeof sessionId === 'string') {
          const loaded = await loadSessionFromQuery(sessionId)
          console.log('[loadLastSessionIfNeeded] 세션 로드 결과', { loaded })
          if (!loaded) {
            // 세션 로드 실패 시 마지막 세션 찾기
            lastSession.value = await findLastSession(user.value?.id)
            console.log('[loadLastSessionIfNeeded] 세션 로드 실패, lastSession 찾음', lastSession.value)
          }
          // 세션 로드 성공 시에는 watch에서 처리 (lastSession을 null로 설정)
        } else {
          // 세션이 없을 때 마지막 세션 찾기 (findLastSession이 현재 세션을 제외하므로 항상 호출)
          console.log('[loadLastSessionIfNeeded] 세션 ID 없음, lastSession 찾기 시작')
          lastSession.value = await findLastSession(user.value?.id)
          console.log('[loadLastSessionIfNeeded] lastSession 찾기 완료', lastSession.value)
        }
      } finally {
        isLoadingLastSession = false
        console.log('[loadLastSessionIfNeeded] 완료', {
          lastSession: lastSession.value,
          sessionId: session.id,
          condition: !session.id && lastSession.value
        })
      }
    }

    // 사용자 로드 감지
    watch(user, async (newUser, oldUser) => {
      console.log('[watch user] 변경 감지', { newUser: !!newUser, oldUser: !!oldUser, userId: newUser?.id })
      if (newUser) {
        await loadLastSessionIfNeeded()
      }
    }, { immediate: true })

    // 사용자 로딩 완료 감지
    watch(userLoading, async (loading, oldLoading) => {
      console.log('[watch userLoading] 변경 감지', { loading, oldLoading, hasUser: !!user.value })
      if (!loading && user.value) {
        await loadLastSessionIfNeeded()
      }
    }, { immediate: true })

    // 라우트 경로 변경 감지 (다른 메뉴에서 이 페이지로 이동할 때)
    watch(() => route.path, async (newPath, oldPath) => {
      console.log('[watch route.path] 변경 감지', { newPath, oldPath })
      if (newPath === '/manual-inspection' && oldPath !== '/manual-inspection') {
        console.log('[watch route.path] manual-inspection 페이지로 이동')
        // 다른 페이지에서 이 페이지로 이동할 때 플래그 리셋
        isLoadingLastSession = false
        // 사용자가 로드되어 있고 세션이 없을 때만 마지막 세션 찾기
        console.log('[watch route.path] 조건 확인', { hasUser: !!user.value, hasSession: !!session.id })
        if (user.value && !session.id) {
          await loadLastSessionIfNeeded()
        }
      }
    })

    // keep-alive 사용 시 활성화될 때 실행
    onActivated(async () => {
      console.log('[onActivated] 컴포넌트 활성화', { hasUser: !!user.value, hasSession: !!session.id })
      isLoadingLastSession = false
      if (user.value && !session.id) {
        await loadLastSessionIfNeeded()
      }
    })

    onMounted(async () => {
      console.log('[onMounted] 컴포넌트 마운트', {
        userLoading: userLoading.value,
        hasUser: !!user.value,
        userId: user.value?.id,
        hasSession: !!session.id,
        sessionId: session.id
      })
      // 사용자 로딩이 완료되고 사용자가 있으면 즉시 실행
      await nextTick()
      console.log('[onMounted] nextTick 후', {
        userLoading: userLoading.value,
        hasUser: !!user.value
      })
      if (!userLoading.value && user.value) {
        await loadLastSessionIfNeeded()
      }
      
      document.addEventListener('click', handleClickOutsideDropdown)
      window.addEventListener('online', updateOnlineStatus)
      window.addEventListener('offline', updateOnlineStatus)
      if (isOffline.value) {
        showSyncToast('오프라인 상태입니다. 변경사항은 연결 복구 후에만 저장됩니다.')
      }
    })

    // session.id가 변경될 때 lastSession 업데이트
    watch(() => session.id, async (newSessionId, oldSessionId) => {
      console.log('[watch session.id] 변경 감지', { newSessionId, oldSessionId })
      // 세션이 없어질 때 (종료 또는 초기화) 마지막 세션 다시 찾기
      if (!newSessionId && oldSessionId) {
        console.log('[watch session.id] 세션 종료, lastSession 찾기')
        isLoadingLastSession = false
        lastSession.value = await findLastSession(user.value?.id)
        console.log('[watch session.id] lastSession 찾기 완료', lastSession.value)
      } else if (newSessionId) {
        // 세션이 로드되었을 때는 lastSession을 null로 설정 (이전 세션 복원 섹션 숨김)
        console.log('[watch session.id] 세션 로드, lastSession을 null로 설정')
        lastSession.value = null
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
    }

    return {
      loading,
      error,
      session,
      items,
      gridColumns,
      progress,
      missingCount,
      selectedSetId,
      selectedSet,
      setSearchQuery,
      searchResults,
      searchResultsKey,
      showSetDropdown,
      handleSelectSet,
      searchSets,
      handleSearchEnter,
      handleSearchBlur,
      setDropdownRef,
      lastSession,
      handleStartNewSession,
      startNewSession,
      resumeSession,
      showExistingSessionModal,
      existingSessionInfo,
      closeExistingSessionModal,
      resumeExistingSession,
      startNewSessionWithCompletion,
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
      incrementCount,
      decrementCount,
      updateItemCount,
      setItemStatus,
      partImageUrls,
      handleImageError,
      handleImageLoad,
      isCdnUrl,
      inspectionMode,
      currentItemIndex,
      slideDirection,
      goToNextItem,
      goToPrevItem,
      goToItemByIndex,
      handleProgressDragStart,
      progressBarRef,
      allItemsForThumbnails,
      pauseSession,
      completeSession,
      handleCompleteInspection,
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
      syncErrorToast,
      lastSyncError,
      isOffline,
      statusFilter,
      selectedSortMode,
      sortOptions,
      statusOptions,
      formatSetNumber,
      formatThemeName,
      formatSetDisplay,
      displaySetNumber, // 🔧 수정됨
      normalizeSetNumber, // 🔧 수정됨
      handleSelectedSetImageError,
      sessionDisplayName,
      lastSessionDisplayName,
      lastSessionProgressInfo,
      displayedItems,
      totalPendingItems,
      statusLabel,
      statusCounts,
      getStatusCount,
      getMissingCountInfo,
      totalItems,
      qaReminder,
      showPartInfo,
      showPartInfoModal,
      selectedPart,
      partSets,
      partSetsLoading,
      alternativeParts,
      alternativePartsLoading,
      handleSetRowClick, // 🔧 수정됨
      handleAlternativePartClick, // 🔧 수정됨
      closePartInfoModal,
      rareParts,
      getColorRgbSync,
      getColorRgbFromAlternative,
      getColorTextColor,
      formatColorLabel, // 🔧 수정됨
      resolvePartCount
    }
  }
}
</script>

<style scoped>
.pleyon-layout {
  min-height: 100vh;
  background: #f9fafb;
  padding: 2rem;
}

.pleyon-layout:has(.grid-mode-bottom-actions) {
  padding-bottom: 5rem;
}

.layout-container {
  max-width: 1400px;
  margin: 0 auto;
}

.main-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
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

.panel-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
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
  padding: 0;
  overflow-y: auto;
  background: transparent;
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

.session-setup {
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

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff; /* // 🔧 수정됨 */
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.card-header p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  flex: 1;
  text-align: right;
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

.card-body > .btn-primary {
  margin-top: 0;
  width: 100%;
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

.selected-set-parts { /* 🔧 수정됨 */
  display: block;
  font-size: 0.8125rem;
  color: #6b7280;
  margin-top: 0rem;
}

.search-no-results {
  padding: 1rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
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
  flex-wrap: wrap;
  gap: 0.5rem;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 0.875rem;
  color: #6b7280;
  flex-shrink: 0;
}

.info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
  word-break: break-word;
  white-space: normal;
  flex: 1;
  min-width: 0;
  text-align: right;
}

.progress-text {
  color: #2563eb;
}

.progress-detail {
  font-size: 0.875rem;
  color: #6b7280;
  margin-left: 0.25rem;
  font-weight: 400;
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
  margin-top: 1.5rem;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.status-badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  border-radius: 999px;
  background: #6b7280;
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.status-badge-count.status-badge-count-missing {
  height: auto;
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
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

.status-filter-button.active .status-badge-count {
  background: rgba(255, 255, 255, 0.3);
  color: #ffffff;
}

.status-badge-count-missing {
  background: #ef4444 !important;
}

.status-filter-button.active .status-badge-count-missing {
  background: rgba(255, 255, 255, 0.3) !important;
  color: #ffffff !important;
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
  width: 100%;
  margin: 0 auto;
  position: relative;
  overflow: visible;
}

.single-card-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 600px;
  margin: 0 auto 1.5rem auto;
  padding: 0;
  background: transparent;
  border: none;
}

.items-grid.grid-mode {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  max-width: 100%;
}

.items-grid.grid-mode .part-card {
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

@media (min-width: 1400px) {
  .items-grid.grid-mode {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1200px) and (min-width: 900px) {
  .items-grid.grid-mode {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  }
}

@media (max-width: 900px) and (min-width: 600px) {
  .items-grid.grid-mode {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  }
}

@media (max-width: 600px) {
  .items-grid.grid-mode {
    grid-template-columns: 1fr;
  }
}

.part-card-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
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
  min-width: 300px;
  width: 100%;
  max-width: 100%;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
}

.card-counter:hover {
  background: #f9fafb;
}

.counter-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.75rem;
}

.counter-content {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
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
  height: 8px;
  background: #f3f4f6;
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  touch-action: none;
}

.counter-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
  border-radius: 999px;
  transition: width 0.3s ease;
  pointer-events: none;
}

.counter-progress-handle {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: #ffffff;
  border: 3px solid #2563eb;
  border-radius: 50%;
  cursor: grab;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  pointer-events: auto;
  z-index: 10;
}

.counter-progress-handle:active {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.1);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.counter-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #6b7280;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  flex-shrink: 0;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.counter-arrow svg {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2.5;
}

.counter-arrow:hover:not(:disabled) {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
  transform: scale(1.05);
}

.counter-arrow:active:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
  transform: scale(0.95);
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
}

.counter-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: #f9fafb;
  border-color: #e5e7eb;
  box-shadow: none;
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
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.part-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}


.part-card.card-checked {
  background: #ffffff;
  border: 2px solid #10b981;
}

.part-card.card-hold {
  background: #ffffff;
  border: 1px solid #f59e0b;
}

.part-card.card-missing {
  background: #ffffff;
  border: 2px solid #ef4444;
}


.part-card > .card-header {
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
  flex: 1;
  min-width: 0;
  overflow: hidden;
  width: 0;
}

.items-grid.grid-mode .part-card .element-id {
  margin-left: 0;
  padding-left: 0;
  text-align: left;
}/* // 🔧 수정됨 */

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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  max-width: 100%;
  min-width: 0;
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
  width: 56px;
  height: 56px;
  border: 2px solid #e5e7eb;
  background: #ffffff;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: #374151;
  transition: all 0.2s ease;
  min-width: 56px;
  min-height: 56px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.qty-button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #2563eb;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);
  transform: translateY(-1px);
}

.qty-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  padding: 0.5rem 1rem;
  background: #f9fafb;
  border-radius: 10px;
  min-width: 120px;
}

.qty-current {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  min-width: 2ch;
  text-align: center;
}

.qty-divider {
  color: #9ca3af;
  font-weight: 500;
  font-size: 1rem;
}

.qty-total {
  color: #6b7280;
  font-weight: 600;
  font-size: 1.125rem;
}

.status-buttons {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
}

.status-button {
  flex: 1;
  padding: 0.875rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.card-actions-bottom {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  padding: 0 1rem;
}

.parts-thumbnails {
  margin-top: 2rem;
  width: 100%;
  padding: 0 1rem;
}

.thumbnails-scroll {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 0.75rem;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.5rem 0;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f3f4f6;
  -webkit-overflow-scrolling: touch;
}

.thumbnails-scroll::-webkit-scrollbar {
  height: 6px;
}

.thumbnails-scroll::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 3px;
}

.thumbnails-scroll::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.thumbnails-scroll::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.thumbnail-item {
  width: 100%;
  min-width: 70px;
  max-width: 100px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
  transition: all 0.2s ease;
  justify-self: center;
}

.thumbnail-item:hover {
  border-color: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.thumbnail-item.active {
  border-color: #2563eb;
  border-width: 2px;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.thumbnail-item.card-checked {
  border-color: #10b981;
  border-width: 1px;
}

.thumbnail-item.card-missing {
  border-color: #ef4444;
  border-width: 1px;
}

.thumbnail-item.card-hold {
  border-color: #f59e0b;
  border-width: 1px;
}

.thumbnail-item.active.card-checked {
  border-color: #2563eb;
  border-width: 3px;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1), 0 0 0 4px rgba(16, 185, 129, 0.1);
}

.thumbnail-item.active.card-missing {
  border-color: #2563eb;
  border-width: 3px;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1), 0 0 0 4px rgba(239, 68, 68, 0.1);
}

.thumbnail-item.active.card-hold {
  border-color: #2563eb;
  border-width: 3px;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1), 0 0 0 4px rgba(245, 158, 11, 0.1);
}

.thumbnail-image {
  width: 100%;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  overflow: hidden;
  padding: 0.25rem 0.5rem 0 0.5rem;
}

.thumbnail-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumbnail-placeholder {
  font-size: 0.625rem;
  color: #9ca3af;
  text-align: center;
  padding: 0.25rem;
}

.thumbnail-info {
  padding: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
}

.thumbnail-element-id {
  font-size: 0.625rem;
  font-weight: 700;
  color: #374151;
  text-align: center;
}

.thumbnail-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.thumbnail-status.pending {
  background: #9ca3af;
}

.thumbnail-status.checked {
  background: #10b981;
}

.thumbnail-status.missing {
  background: #ef4444;
}

.thumbnail-status.hold {
  background: #f59e0b;
}

.thumbnail-count {
  font-size: 0.625rem;
  color: #6b7280;
  font-weight: 500;
}

.save-button {
  padding: 0.75rem 1.5rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 120px;
}

.save-button.complete-save {
  color: #ffffff;
  background: #10b981;
  border-color: #10b981;
}

.save-button.complete-save:hover {
  background: #059669;
  border-color: #059669;
}

.save-button.temporary-save {
  color: #2563eb;
  border-color: #2563eb;
}

.save-button.temporary-save:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #1d4ed8;
}

.save-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 그리드 검수 모드 하단 고정 버튼 */
.grid-mode-bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  z-index: 40;
  padding: 1rem;
}

.bottom-actions-container {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  padding: 0 1rem;
}

.bottom-actions-container .save-button {
  flex: 1;
  max-width: 300px;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
}

@media (max-width: 768px) {
  .grid-mode-bottom-actions {
    padding: 0.75rem;
  }

  .bottom-actions-container {
    padding: 0 0.5rem;
    gap: 0.5rem;
  }

  .bottom-actions-container .save-button {
    font-size: 0.875rem;
    padding: 0.75rem 1rem;
  }
}

.status-button.checked.active {
  background: #ffffff;
  color: #10b981;
  border-color: #10b981;
  border-width: 2px;
}

.status-button.hold.active {
  background: #ffffff;
  color: #f59e0b;
  border-color: #f59e0b;
  border-width: 2px;
}

.status-button.missing.active {
  background: #ffffff;
  color: #ef4444;
  border-color: #ef4444;
  border-width: 2px;
}

.status-button:hover {
  background: #f9fafb;
}

.status-button.active:hover {
  background: #ffffff;
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

/* 단일검수 모드: 부품 이미지 출력 영역 세로 높이 축소 */
.part-card-wrapper .part-image-section {
  padding: 0.5rem 0;
  min-height: 80px;
  max-height: 250px;
  overflow: hidden;
}

/* 단일검수 모드: 이미지 크기 제한 */
.part-card-wrapper .part-image-section .part-image {
  max-height: 200px;
  max-width: 100%;
  object-fit: contain;
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

.part-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}

.no-part-image {
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
  .items-grid.single-mode {
    max-width: 100%;
    padding: 0 1rem;
  }

  .part-card {
    width: 100%;
    max-width: 100%;
  }

  .single-card-navigation {
    max-width: 100%;
    padding: 0 1rem;
  }

  .card-counter {
    font-size: 1.125rem;
  }

  .part-card-wrapper {
    width: 100%;
    max-width: 100%;
  }

  /* 단일검수 모드: 부품 이미지 출력 영역 세로 높이 축소 (태블릿) */
  .part-card-wrapper .part-image-section {
    padding: 0.375rem 0;
    min-height: 70px;
  }

  .thumbnails-scroll {
    grid-template-columns: repeat(auto-fill, minmax(65px, 1fr));
  }

  .thumbnail-item {
    max-width: 95px;
  }

  .panel-header {
    padding: 1.25rem 1.5rem;
  }

  .panel-content {
    padding: 0;
  }

  .session-setup {
    max-width: 100%;
  }


  .nav-btn {
    min-width: 100px;
    padding: 1rem 1.5rem;
    font-size: 1rem;
  }
}

/* 모바일 (768px 이하) */
@media (max-width: 768px) {
  .items-grid.single-mode {
    max-width: 100%;
    padding: 0 0.5rem;
  }

  .single-card-navigation {
    max-width: 100%;
    padding: 0 0.5rem;
  }

  .part-card {
    width: 100%;
    max-width: 100%;
  }

  /* 단일검수 모드: 부품 이미지 출력 영역 세로 높이 축소 (모바일) */
  .part-card-wrapper .part-image-section {
    padding: 0.25rem 0;
    min-height: 60px;
  }

  .thumbnails-scroll {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  }

  .thumbnail-item {
    min-width: 60px;
    max-width: 90px;
  }

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

  .action-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  .panel-content {
    padding: 0;
  }

  .items-grid {
    gap: 1rem;
  }

  .items-grid.grid-mode {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
    max-width: 100%;
  }

  .items-grid.grid-mode .part-card {
    width: 100%;
    max-width: 100%;
  }

  @media (min-width: 1400px) {
    .items-grid.grid-mode {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (max-width: 1200px) {
    .items-grid.grid-mode {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    }
  }

  @media (max-width: 900px) {
    .items-grid.grid-mode {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
    }
  }

  @media (max-width: 600px) {
    .items-grid.grid-mode {
      grid-template-columns: 1fr;
    }
  }

  .items-container {
    padding: 0;
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
  }

  .part-card .element-id {
    display: block !important;
  }

  .part-card .color-badge {
    display: inline-block !important;
  }

  .pleyon-layout {
    padding: 1rem;
  }

  .pleyon-layout:has(.grid-mode-bottom-actions) {
    padding-bottom: 4.5rem;
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

  .session-setup {
    max-width: 100%;
    margin-bottom: 1.5rem;
    padding: 0;
  }

  .setup-card {
    border-radius: 8px;
  }

  .workspace-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    margin-top: 1.5rem !important;
    margin-bottom: 1.5rem !important;
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
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .card-header h3 {
    font-size: 0.875rem !important;
    margin: 0;
  }

  .card-header p {
    font-size: 0.8125rem !important;
    margin: 0;
    width: 100%;
    text-align: left !important;
  }

  .card-body {
    padding: 1rem;
  }

  .form-select {
    padding: 0.625rem;
    font-size: 0.875rem;
  }

  /* 본문 폰트 사이즈 조정 */
  .set-search-input {
    font-size: 0.9375rem !important;
  }

  .search-button {
    font-size: 0.875rem !important;
  }

  .part-name {
    font-size: 0.9375rem !important;
  }

  /* 추가 본문 폰트 사이즈 조정 */
  .selected-set-display {
    font-size: 0.9375rem !important;
  }

  .search-no-results {
    font-size: 0.875rem !important;
  }

  .custom-select-trigger {
    font-size: 0.9375rem !important;
  }

  .part-card .color-badge {
    font-size: 0.8125rem !important;
  }

  .part-color {
    font-size: 0.8125rem !important;
  }

  .qty-display {
    font-size: 0.875rem !important;
  }

  .save-button {
    font-size: 0.875rem !important;
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
    width: 64px;
    height: 64px;
    font-size: 2rem;
    min-width: 64px;
    min-height: 64px;
    border-radius: 14px;
  }

  .qty-display {
    min-width: 140px;
    padding: 0.625rem 1.25rem;
  }

  .qty-current {
    font-size: 1.5rem;
  }

  .qty-total {
    font-size: 1.25rem;
  }

  .status-buttons {
    flex-direction: row;
    gap: 0.375rem;
  }

  .status-button {
    padding: 0.75rem;
    font-size: 0.875rem !important;
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
    font-size: 1.125rem !important;
  }

  .counter-separator,
  .counter-total {
    font-size: 0.875rem !important;
  }

  .part-card .part-name {
    font-size: 0.875rem !important;
  }

  .part-card .part-color {
    font-size: 0.8125rem !important;
  }

  /* 검수 모드 본문 폰트 사이즈 조정 */
  .part-card .element-id {
    font-size: 0.875rem !important;
  }

  .part-card .section-label {
    font-size: 0.75rem !important;
  }

  .part-card .qty-display {
    min-width: 100px;
    padding: 0.5rem 0.75rem;
  }

  .part-card .qty-current {
    font-size: 1.125rem !important;
  }

  .part-card .qty-total {
    font-size: 1rem !important;
  }

  .part-card .qty-divider {
    font-size: 0.875rem !important;
  }

  .part-card .qty-button {
    width: 52px;
    height: 52px;
    min-width: 52px;
    min-height: 52px;
    font-size: 1.625rem;
  }

  .status-filter-button {
    font-size: 0.8125rem !important;
  }

  .sort-select {
    font-size: 0.875rem !important;
  }

  .sort-control label {
    font-size: 0.8125rem !important;
  }
}

/* 작은 모바일 (480px 이하) */
@media (max-width: 480px) {
  .items-grid.single-mode {
    max-width: 100%;
    padding: 0;
  }

  .part-card {
    width: 100%;
    max-width: 100%;
  }

  .part-name {
    font-size: 0.875rem;
  }

  .thumbnails-scroll {
    grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
  }

  .thumbnail-item {
    min-width: 55px;
    max-width: 80px;
  }

  .panel-header {
    padding: 0.75rem;
  }

  .panel-header h1 {
    font-size: 1.125rem;
  }

  .panel-content {
    padding: 0;
  }

  .items-container {
    padding: 0;
  }

  .part-card {
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

/* 모달 공통 스타일 */
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

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
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
  cursor: pointer; /* // 🔧 수정됨 */
}

.set-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px); /* // 🔧 수정됨 */
}

.set-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

/* 진행 중인 세션 확인 모달 */
.existing-session-info {
  margin-bottom: 1.5rem;
}

.existing-session-info p {
  margin: 0.5rem 0;
  font-size: 0.9375rem;
  color: #374151;
}

.existing-session-info strong {
  color: #111827;
  margin-right: 0.5rem;
}

.modal-warning {
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.modal-warning p {
  margin: 0;
  font-size: 0.875rem;
  color: #92400e;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.set-num { /* // 🔧 수정됨 */
  font-size: 0.75rem;
  color: #6b7280;
  background: #ffffff;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.element-id-display {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.element-id-display strong {
  font-weight: 700;
  color: #1f2937;
}

.alternatives-list { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alternative-item { /* // 🔧 수정됨 */
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

.alternative-item:hover { /* // 🔧 수정됨 */
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
}

.alt-part-info { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.alt-part-name { /* // 🔧 수정됨 */
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.alt-part-id { /* // 🔧 수정됨 */
  font-size: 0.8125rem;
  color: #6b7280;
}

.alt-colors { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.alt-color-row { /* // 🔧 수정됨 */
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-chip { /* // 🔧 수정됨 */
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  display: inline-block;
}

.alt-color-name { /* // 🔧 수정됨 */
  font-size: 0.8125rem;
  color: #374151;
  font-weight: 500;
}

.alt-element-id { /* // 🔧 수정됨 */
  font-size: 0.75rem;
  color: #6b7280;
}
</style>

