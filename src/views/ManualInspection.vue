<template>
  <div class="pleyon-layout">
    <div class="layout-container">
      <main class="main-panel">
        <div v-if="!session.id" class="page-header">
          <h1>부품검수</h1>
          <p>레고 세트 부품 검수를 진행할 수 있습니다</p>
        </div>
        <header v-else class="panel-header session-header">
          <div class="header-left">
            <div class="session-title">
              <h1>
                <div class="set-info-row">
                  <span v-if="session.set_num" class="set-num">{{ formatSetNum(session.set_num) }}</span>
                  <span v-if="session.set_num && session.theme_name" class="separator">|</span>
                  <span v-if="session.theme_name" class="theme-name">{{ session.theme_name }}</span>
                </div>
                <div class="set-name">{{ session.set_name }}</div>
              </h1>
              <div class="session-stats">
                <span class="stat-badge progress">{{ progress }}%</span>
                <span class="stat-badge missing">{{ missingCount }}개 누락</span>
                <span class="stat-badge time">{{ formatTime(session.last_saved_at) }}</span>
              </div>
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
                  <label>레고 번호 검색</label>
                  <div class="set-search-container">
                    <div class="search-input-wrapper">
                      <input
                        type="text"
                        v-model="setSearchInput"
                        @keyup.enter="searchSet"
                        placeholder="레고 세트 번호를 입력하세요 (예: 10294)"
                        class="set-search-input"
                        :disabled="searchingSet"
                      />
                      <button
                        type="button"
                        @click="searchSet"
                        :disabled="!setSearchInput || searchingSet"
                        class="search-button"
                      >
                        <svg v-if="!searchingSet" width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M19 19L14.65 14.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span v-else>검색 중...</span>
                      </button>
                    </div>
                    <div v-if="searchedSet" class="search-result">
                      <div class="search-result-item">
                        <div class="result-title">{{ searchedSet.name }}</div>
                        <div class="result-subtitle">레고 번호: {{ searchedSet.set_num }}</div>
                      </div>
                    </div>
                    <div v-if="setSearchError" class="search-error">
                      {{ setSearchError }}
                    </div>
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

            <div v-if="lastSessions.length > 0" class="resume-sessions-section">
              <h3 class="resume-sessions-title">이전 세션 복원</h3>
              <p class="resume-sessions-subtitle">진행 중이던 검수를 이어서 진행할 수 있습니다</p>
              <div class="resume-sessions-list">
                <div 
                  v-for="sessionItem in lastSessions" 
                  :key="sessionItem.id"
                  class="setup-card resume-card"
                >
                  <div class="card-header">
                    <h4>{{ sessionItem.set_name }}</h4>
                    <span class="session-status-badge" :class="sessionItem.status">
                      {{ sessionItem.status === 'in_progress' ? '진행중' : '일시정지' }}
                    </span>
                  </div>
                  <div class="card-body">
                    <div class="resume-info">
                      <div class="info-row">
                        <span class="info-label">진행률:</span>
                        <span class="info-value progress-text">{{ sessionItem.progress }}%</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">마지막 저장:</span>
                        <span class="info-value">{{ formatDate(sessionItem.last_saved_at) }}</span>
                      </div>
                    </div>
                    <div class="resume-actions">
                      <button @click="resumeSession(sessionItem.id)" class="btn-primary">이어하기</button>
                      <button @click="handleCompleteSession(sessionItem.id)" class="btn-primary">완료</button>
                      <button @click="handleDeleteSession(sessionItem.id)" class="btn-primary">삭제</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="inspection-workspace">

            <div v-if="session.id" class="workspace-controls">
              <div class="mode-controls">
                <button
                  type="button"
                  class="mode-toggle-button"
                  :class="{ active: inspectionMode === 'single' }"
                  @click="inspectionMode = 'single'"
                  title="단일 검수"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 4C3 3.44772 3.44772 3 4 3H16C16.5523 3 17 3.44772 17 4V16C17 16.5523 16.5523 17 16 17H4C3.44772 17 3 16.5523 3 16V4Z" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  <span class="button-text-full">단일 검수</span>
                  <span class="button-text-mobile">단일</span>
                </button>
                <button
                  type="button"
                  class="mode-toggle-button"
                  :class="{ active: inspectionMode === 'grid' }"
                  @click="inspectionMode = 'grid'"
                  title="그리드 검수"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 4C3 3.44772 3.44772 3 4 3H9C9.55228 3 10 3.44772 10 4V9C10 9.55228 9.55228 10 9 10H4C3.44772 10 3 9.55228 3 9V4Z" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M11 4C11 3.44772 11.4477 3 12 3H16C16.5523 3 17 3.44772 17 4V9C17 9.55228 16.5523 10 16 10H12C11.4477 10 11 9.55228 11 9V4Z" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M3 11C3 10.4477 3.44772 10 4 10H9C9.55228 10 10 10.4477 10 11V16C10 16.5523 9.55228 17 9 17H4C3.44772 17 3 16.5523 3 16V11Z" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M11 11C11 10.4477 11.4477 10 12 10H16C16.5523 10 17 10.4477 17 11V16C17 16.5523 16.5523 17 16 17H12C11.4477 17 11 16.5523 11 16V11Z" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  <span class="button-text-full">그리드 검수</span>
                  <span class="button-text-mobile">그리드</span>
                </button>
                <div v-if="inspectionMode === 'grid'" class="grid-columns-controls">
                  <div class="grid-columns-buttons">
                    <button
                      v-for="cols in [1, 2, 3]"
                      :key="cols"
                      type="button"
                      class="grid-column-button"
                      :class="{ active: gridColumns === cols }"
                      @click="gridColumns = cols"
                      :title="`${cols}열`"
                    >
                      {{ cols }}열
                    </button>
                  </div>
                  <select
                    v-model="gridColumns"
                    class="grid-columns-select"
                  >
                    <option :value="1">1열</option>
                    <option :value="2">2열</option>
                    <option :value="3">3열</option>
                  </select>
                </div>
              </div>
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
              <div v-if="displayedItems.length > 0 && inspectionMode === 'single'" class="single-card-navigation">
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
                :style="inspectionMode === 'grid' ? { gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` } : {}"
              >
                <template v-if="displayedItems.length > 0">
                  <!-- 단일 검수 모드 -->
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
                              v-if="partImageUrls[displayedItems[0].id]"
                              :src="partImageUrls[displayedItems[0].id]"
                              :alt="`${displayedItems[0].part_name} (${displayedItems[0].color_name})`"
                              class="part-image"
                              @error="handleImageError($event)"
                              @load="handleImageLoad($event)"
                            />
                            <div v-else class="part-image-placeholder">
                              이미지 로딩 중...
                            </div>
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
                  
                  <!-- 그리드 검수 모드 -->
                  <template v-else-if="inspectionMode === 'grid'">
                    <div
                      v-for="(item, index) in displayedItems"
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
                            v-if="partImageUrls[item.id]"
                            :src="partImageUrls[item.id]"
                            :alt="`${item.part_name} (${item.color_name})`"
                            class="part-image"
                            @error="handleImageError($event)"
                            @load="handleImageLoad($event)"
                          />
                          <div v-else class="part-image-placeholder">
                            이미지 로딩 중...
                          </div>
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
                </template>
              </div>

              <div v-if="session.id" class="session-action-buttons">
                <button
                  @click="pauseSession"
                  :disabled="loading"
                  class="session-action-btn pause-btn"
                >
                  임시저장
                </button>
                <button
                  @click="completeSession"
                  :disabled="loading"
                  class="session-action-btn complete-btn"
                >
                  검수 완료
                </button>
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

    <!-- 세션 확인 모달 -->
    <div v-if="showSessionConfirmModal" class="session-confirm-modal-overlay" @click="closeSessionConfirmModal">
      <div class="session-confirm-modal" @click.stop>
        <div class="modal-header">
          <h3>진행 중인 세션 확인</h3>
        </div>
        <div class="modal-body">
          <div class="session-confirm-content">
            <p v-if="lastSessions.length === 1" class="confirm-message">
              진행 중인 검수 세션이 있습니다.
            </p>
            <p v-else class="confirm-message">
              진행 중인 검수 세션이 {{ lastSessions.length }}개 있습니다.
            </p>
            
            <div v-if="lastSessions.length === 1" class="session-info-box">
              <div class="session-info-item">
                <span class="session-info-label">세트명:</span>
                <span class="session-info-value">{{ lastSessions[0].set_name }}</span>
              </div>
              <div class="session-info-item">
                <span class="session-info-label">진행률:</span>
                <span class="session-info-value progress-text">{{ lastSessions[0].progress }}%</span>
              </div>
              <div class="session-info-item">
                <span class="session-info-label">마지막 저장:</span>
                <span class="session-info-value">{{ formatDate(lastSessions[0].last_saved_at) }}</span>
              </div>
            </div>
            
            <p class="confirm-question">어떻게 진행하시겠습니까?</p>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="handleResumeFirstSession" class="modal-btn resume-btn">
            이전 세션 이어하기
          </button>
          <button @click="handleStartNewSession" class="modal-btn new-session-btn">
            새로운 검수 시작
          </button>
        </div>
      </div>
    </div>

    <!-- 기존 세션 완료 처리 확인 모달 -->
    <div v-if="showCompleteSessionsModal" class="session-confirm-modal-overlay" @click="closeCompleteSessionsModal">
      <div class="session-confirm-modal" @click.stop>
        <div class="modal-header">
          <h3>기존 세션 완료 처리</h3>
        </div>
        <div class="modal-body">
          <div class="session-confirm-content">
            <p v-if="lastSessions.length === 1" class="confirm-message">
              진행 중인 검수 세션 <strong>"{{ lastSessions[0].set_name }}"</strong>을 완료 처리하고 새로운 검수를 시작하시겠습니까?
            </p>
            <p v-else class="confirm-message">
              진행 중인 검수 세션 <strong>{{ lastSessions.length }}개</strong>를 모두 완료 처리하고 새로운 검수를 시작하시겠습니까?
            </p>
            
            <div v-if="lastSessions.length === 1" class="session-info-box">
              <div class="session-info-item">
                <span class="session-info-label">세트명:</span>
                <span class="session-info-value">{{ lastSessions[0].set_name }}</span>
              </div>
              <div class="session-info-item">
                <span class="session-info-label">진행률:</span>
                <span class="session-info-value progress-text">{{ lastSessions[0].progress }}%</span>
              </div>
              <div class="session-info-item">
                <span class="session-info-label">마지막 저장:</span>
                <span class="session-info-value">{{ formatDate(lastSessions[0].last_saved_at) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeCompleteSessionsModal" class="modal-btn resume-btn">
            취소
          </button>
          <button @click="confirmCompleteSessions" class="modal-btn new-session-btn">
            완료 처리하고 시작
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, watch, computed, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
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
    const route = useRoute()
    const { supabase, user, loading: userLoading } = useSupabase()
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
      findLastSessions,
      deleteSession,
      syncToServer,
      syncInProgress,
      lastSyncError,
      lastSyncAt,
      resetSessionState
    } = useInspectionSession()

    const selectedSetId = ref('')
    const availableSets = ref([])
    const lastSessions = ref([])
    const showSetDropdown = ref(false)
    const partImageUrls = ref({})
    const setDropdownRef = ref(null)
    const setSearchInput = ref('')
    const searchedSet = ref(null)
    const searchingSet = ref(false)
    const setSearchError = ref('')
    const syncErrorToast = ref('')
    let syncErrorTimer = null
    const statusFilter = ref('all')
    const selectedSortMode = ref('sequence')
    const isOffline = ref(!navigator.onLine) // 🔧 수정됨
    const currentItemIndex = ref(0) // 🔧 수정됨
    const slideDirection = ref('right') // 슬라이드 방향: 'left' 또는 'right'
    const inspectionMode = ref('single') // 단일 검수 또는 그리드 검수
    
    // 화면 크기에 따라 그리드 열 수 자동 조정
    const adjustGridColumns = () => {
      if (inspectionMode.value !== 'grid') return
      
      const width = window.innerWidth
      if (width <= 480) {
        // 모바일: 1열
        gridColumns.value = 1
      } else if (width <= 768) {
        // 태블릿: 2열
        gridColumns.value = 2
      }
      // 데스크톱: 현재 선택된 값 유지 (1, 2, 3)
    }
    
    // 부품 검색 기능
    const { findSetsByPart, findAlternativeParts } = usePartSearch()
    const showPartInfoModal = ref(false)
    const selectedPart = ref(null)
    const showSessionConfirmModal = ref(false)
    const showCompleteSessionsModal = ref(false)
    const pendingNewSessionSetId = ref(null)
    const partSets = ref([])
    const partSetsLoading = ref(false)
    const alternativeParts = ref([])
    const alternativePartsLoading = ref(false)
    
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
          
          return rgb
        } else {
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

      // 그리드 모드일 때는 모든 아이템 반환
      if (inspectionMode.value === 'grid') {
        return sorted
      }

      // 단일 카드 모드일 때는 현재 인덱스의 아이템만 반환
      if (sorted.length > 0) {
        // currentItemIndex가 유효한지 확인하고, 범위를 벗어나면 0으로 리셋
        if (currentItemIndex.value >= sorted.length) {
          currentItemIndex.value = 0
        }
        const currentItem = sorted[currentItemIndex.value]
        return currentItem ? [currentItem] : []
      }
      return []
    })

    // 단일 검수 모드에서 pending 아이템 총 개수
    const totalPendingItems = computed(() => {
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

    const searchSet = async () => {
      if (!setSearchInput.value.trim()) {
        setSearchError.value = '레고 번호를 입력해주세요.'
        return
      }

      try {
        searchingSet.value = true
        setSearchError.value = ''
        searchedSet.value = null

        const searchTerm = setSearchInput.value.trim()
        
        // 레고 번호로 검색 (정확히 일치하거나 부분 일치)
        const { data, error: err } = await supabase
          .from('lego_sets')
          .select('id, name, set_num')
          .or(`set_num.eq.${searchTerm},set_num.ilike.%${searchTerm}%`)
          .limit(10)

        if (err) throw err

        if (!data || data.length === 0) {
          setSearchError.value = `레고 번호 "${searchTerm}"에 해당하는 세트를 찾을 수 없습니다.`
          selectedSetId.value = ''
          searchedSet.value = null
          return
        }

        // 첫 번째 결과를 선택
        const foundSet = data[0]
        searchedSet.value = foundSet
        selectedSetId.value = foundSet.id
        setSearchError.value = ''
      } catch (err) {
        console.error('세트 검색 실패:', err)
        setSearchError.value = '세트 검색 중 오류가 발생했습니다.'
        selectedSetId.value = ''
        searchedSet.value = null
      } finally {
        searchingSet.value = false
      }
    }

    const startNewSession = async () => {
      if (!selectedSetId.value) return
      
      // 진행 중인 세션 확인
      const existingSessions = await findLastSessions(user.value?.id)
      console.log('[ManualInspection] startNewSession - 진행 중인 세션:', existingSessions)
      
      // 진행 중인 세션이 있는 경우 모달 표시
      if (existingSessions.length > 0) {
        lastSessions.value = existingSessions
        pendingNewSessionSetId.value = selectedSetId.value
        showSessionConfirmModal.value = true
        console.log('[ManualInspection] 모달 표시:', showSessionConfirmModal.value)
        return
      }
      
      // 진행 중인 세션이 없으면 바로 시작
      await createNewSession(selectedSetId.value)
    }

    const createNewSession = async (setId) => {
      try {
        await createSession(setId)
        lastSessions.value = []
        currentItemIndex.value = 0
        setSearchInput.value = ''
        searchedSet.value = null
        setSearchError.value = ''
      } catch (err) {
        console.error('세션 시작 실패:', err)
      }
    }

    const handleResumeFirstSession = async () => {
      closeSessionConfirmModal()
      if (lastSessions.value.length > 0) {
        await resumeSession(lastSessions.value[0].id)
      }
    }

    const handleCompleteSession = async (sessionId) => {
      if (!sessionId) return
      
      if (!confirm('이 세션을 완료 처리하시겠습니까?')) {
        return
      }

      try {
        // 세션을 로드하여 완료 처리
        await loadSession(sessionId)
        await completeSessionAction()
        
        // lastSessions 목록에서 완료된 세션 제거 (완료된 세션은 in_progress/paused 상태가 아니므로)
        lastSessions.value = lastSessions.value.filter(s => s.id !== sessionId)
        
        // 세션 상태 초기화
        await resetSessionState({ clearLocal: false })
        
        console.log('[ManualInspection] 세션 완료 처리 완료:', sessionId)
      } catch (err) {
        console.error('[ManualInspection] 세션 완료 처리 오류:', err)
        alert('세션 완료 처리 중 오류가 발생했습니다.')
      }
    }

    const handleDeleteSession = async (sessionId) => {
      if (!sessionId) return
      
      if (!confirm('이 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        return
      }

      try {
        const result = await deleteSession(sessionId, user.value?.id)
        
        if (result.success) {
          // lastSessions 목록에서 삭제된 세션 제거
          lastSessions.value = lastSessions.value.filter(s => s.id !== sessionId)
          console.log('[ManualInspection] 세션 삭제 완료:', sessionId)
        } else {
          alert(`세션 삭제 실패: ${result.error || '알 수 없는 오류'}`)
        }
      } catch (err) {
        console.error('[ManualInspection] 세션 삭제 오류:', err)
        alert('세션 삭제 중 오류가 발생했습니다.')
      }
    }

    const handleStartNewSession = async () => {
      // 커스텀 모달 표시
      closeSessionConfirmModal()
      showCompleteSessionsModal.value = true
    }

    const closeCompleteSessionsModal = () => {
      showCompleteSessionsModal.value = false
    }

    const confirmCompleteSessions = async () => {
      closeCompleteSessionsModal()
      
      // 모든 기존 세션 완료 처리
      try {
        for (const sessionItem of lastSessions.value) {
          try {
            await loadSession(sessionItem.id)
            await completeSessionAction()
            console.log('[ManualInspection] 세션 완료 처리 완료:', sessionItem.id)
          } catch (err) {
            console.error(`[ManualInspection] 세션 ${sessionItem.id} 완료 처리 실패:`, err)
          }
        }
        
        // 세션 상태 초기화
        await resetSessionState({ clearLocal: false })
        
        // lastSessions 목록 초기화
        lastSessions.value = []
        
        // 새 세션 생성
        if (pendingNewSessionSetId.value) {
          await createNewSession(pendingNewSessionSetId.value)
          pendingNewSessionSetId.value = null
        }
      } catch (err) {
        console.error('[ManualInspection] 기존 세션 완료 처리 중 오류:', err)
        alert('기존 세션 완료 처리 중 오류가 발생했습니다.')
      }
    }

    const closeSessionConfirmModal = () => {
      showSessionConfirmModal.value = false
      pendingNewSessionSetId.value = null
    }

    const resumeSession = async (sessionId) => {
      if (!sessionId) return
      try {
        await loadSession(sessionId)
        selectedSetId.value = session.set_id
        lastSessions.value = []
        
        // 마지막 검수 완료한 부품 다음 부품으로 이동
        if (items.value.length > 0) {
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
        if (newStatus === 'checked' && newCount === target.total_count) {
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
      if (newStatus === 'checked' && clampedValue === target.total_count) {
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
      
      const target = items.value[index]
      const updateData = { status }
      
      // 완료 버튼 클릭 시 재고부품 수량을 자동으로 total_count로 설정
      if (status === 'checked') {
        updateData.checked_count = target.total_count
      }
      
      updateItem(index, updateData)
      
      // 단일 카드 모드에서 상태가 'checked'로 변경되면 다음 카드로 자동 이동
      if (status === 'checked') {
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
    
    const goToPrevItem = () => {
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

          // 2. Supabase Storage에서 element_id 기반 파일명으로 시도
          itemsWithElementId.forEach(item => {
            if (!imageUrlMap[item.id] && item.element_id) {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
              const bucketName = 'lego_parts_images'
              const fileName = `${item.element_id}.webp`
              imageUrlMap[item.id] = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
            }
          })
          
          // 3. Supabase Storage에도 없으면 원본 URL 직접 사용 (프록시 불필요)
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

          // Supabase Storage URL 시도
          partKeys.forEach(item => {
            if (!imageUrlMap[item.id]) {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
              const bucketName = 'lego_parts_images'
              const fileName = `${item.part_id}_${item.color_id}.webp`
              imageUrlMap[item.id] = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
            }
          })

          // Supabase Storage에도 없으면 원본 URL 직접 사용 (프록시 불필요)
          partKeys.forEach(item => {
            if (!imageUrlMap[item.id] && item.part_img_url) {
              imageUrlMap[item.id] = item.part_img_url
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
      const imageUrl = event.target?.src
      if (imageUrl && !imageUrl.includes('data:') && imageUrl !== window.location.href) {
        console.warn('[handleImageError] 이미지 로드 실패:', imageUrl)
      }
      if (event.target) {
        event.target.style.display = 'none'
      }
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
      currentItemIndex.value = 0
    }

    const finalizeSessionReset = async () => {
      await resetSessionState()
      resetView()
      try {
        const sessions = await findLastSessions(user.value?.id)
        lastSessions.value = sessions
      } catch (err) {
        console.error('세션 로드 실패:', err)
        lastSessions.value = []
      }
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
      const touch = e.touches ? e.touches[0] : e
      swipeState.startX = touch.clientX
      swipeState.startY = touch.clientY
      swipeState.currentX = touch.clientX
      swipeState.currentY = touch.clientY
      swipeState.isSwiping = true
    }

    const handleSwipeMove = (e) => {
      if (!swipeState.isSwiping) return
      const touch = e.touches ? e.touches[0] : e
      swipeState.currentX = touch.clientX
      swipeState.currentY = touch.clientY
    }

    const handleSwipeEnd = (e) => {
      if (!swipeState.isSwiping) return
      
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


    // lastSessions 로드 함수
    const loadLastSessions = async () => {
      // user 로딩이 완료되고, 세션이 없고, user가 있을 때만 로드
      if (userLoading.value) {
        console.log('[ManualInspection] userLoading이 true입니다. 대기 중...')
        return
      }
      
      if (session.value?.id) {
        console.log('[ManualInspection] 활성 세션이 있습니다. lastSessions 로드 스킵')
        lastSessions.value = []
        return
      }
      
      if (!user.value?.id) {
        console.log('[ManualInspection] user가 없습니다. lastSessions 초기화')
        lastSessions.value = []
        return
      }
      
      try {
        console.log('[ManualInspection] lastSessions 로드 시작... userId:', user.value.id)
        // userId를 명시적으로 전달하여 useInspectionSession 내부의 user ref와 무관하게 동작
        const sessions = await findLastSessions(user.value.id)
        console.log('[ManualInspection] 로드된 세션:', sessions)
        lastSessions.value = sessions
      } catch (err) {
        console.error('[ManualInspection] 세션 로드 실패:', err)
        lastSessions.value = []
      }
    }

    // userLoading이 false가 되면 무조건 로드
    watch(() => userLoading.value, async (loading) => {
      console.log('[ManualInspection] userLoading 변경:', loading)
      if (!loading) {
        await loadLastSessions()
      }
    }, { immediate: true })

    // user가 변경되면 로드
    watch(() => user.value?.id, async (userId) => {
      console.log('[ManualInspection] user 변경:', userId)
      if (!userLoading.value) {
        await loadLastSessions()
      }
    }, { immediate: true })

    // session이 변경되면 업데이트
    watch(() => session.value?.id, async (sessionId) => {
      console.log('[ManualInspection] session 변경:', sessionId)
      if (!sessionId && !userLoading.value && user.value?.id) {
        await loadLastSessions()
      } else if (sessionId) {
        lastSessions.value = []
      }
    })

    // 화면 크기 변경 감지
    const handleResize = () => {
      adjustGridColumns()
    }

    // inspectionMode 변경 감지
    watch(() => inspectionMode.value, () => {
      adjustGridColumns()
    })

    // 마지막 검수 부품의 다음 부품으로 이동하는 함수
    const moveToNextAfterLastChecked = () => {
      if (items.value.length === 0) return
      
      // displayedItems와 동일한 정렬 로직 적용
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

    onMounted(async () => {
      // URL 쿼리 파라미터에서 세션 ID 확인
      const sessionIdFromQuery = route.query.session
      if (sessionIdFromQuery && typeof sessionIdFromQuery === 'string') {
        try {
          console.log('[ManualInspection] URL에서 세션 로드:', sessionIdFromQuery)
          await loadSession(sessionIdFromQuery)
          // 세션 로드 후 마지막 검수 부품의 다음 부품으로 이동
          await new Promise(resolve => setTimeout(resolve, 100)) // items가 업데이트될 시간을 줌
          moveToNextAfterLastChecked()
        } catch (err) {
          console.error('[ManualInspection] URL 세션 로드 실패:', err)
        }
      }
      
      // 초기 로드 시 한 번 더 확인 (watch가 이미 실행되었지만, 확실하게 하기 위해)
      if (!userLoading.value && !session.value?.id && user.value?.id) {
        await loadLastSessions()
      }
      
      window.addEventListener('online', updateOnlineStatus)
      window.addEventListener('offline', updateOnlineStatus)
      window.addEventListener('resize', handleResize)
      adjustGridColumns() // 초기 조정
      
      if (isOffline.value) {
        showSyncToast('오프라인 상태입니다. 변경사항이 로컬에 저장됩니다.')
      }
    })

    onUnmounted(() => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
      window.removeEventListener('resize', handleResize)
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
      inspectionMode,
      progress,
      missingCount,
      selectedSetId,
      availableSets,
      lastSessions,
      setSearchInput,
      searchedSet,
      searchingSet,
      setSearchError,
      searchSet,
      startNewSession,
      resumeSession,
      incrementCount,
      decrementCount,
      updateItemCount,
      setItemStatus,
      partImageUrls,
      handleImageError,
      handleImageLoad,
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
      formatSetNum,
      syncStatusMessage,
      syncInProgress,
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
      showPartInfo,
      showPartInfoModal,
      selectedPart,
      partSets,
      partSetsLoading,
      alternativeParts,
      alternativePartsLoading,
      closePartInfoModal,
      showSessionConfirmModal,
      showCompleteSessionsModal,
      handleResumeFirstSession,
      handleStartNewSession,
      handleCompleteSession,
      handleDeleteSession,
      closeSessionConfirmModal,
      closeCompleteSessionsModal,
      confirmCompleteSessions,
      getColorRgbSync
    }
  }
}
</script>

<style scoped>
.pleyon-layout {
  min-height: 100vh;
  background: #f9fafb;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  padding: 2rem;
}

.layout-container {
  display: flex;
  min-height: calc(100vh - 0px);
  max-width: 1400px;
  margin: 0 auto;
}

.main-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-header {
  position: relative;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.session-header {
  text-align: center;
}

.session-header .header-left {
  width: 100%;
  display: flex;
  justify-content: center;
}

.session-title {
  width: 100%;
  text-align: center;
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

.panel-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.session-title h1 {
  margin-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.session-title h1 .set-info-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-bottom: 0;
}

.session-title h1 .set-num {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  margin: 0;
  padding: 0;
}

.session-title h1 .separator {
  font-size: 1.125rem;
  font-weight: 400;
  color: #6b7280;
  margin: 0;
  padding: 0 0.125rem;
}

.session-title h1 .theme-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  margin: 0;
  padding: 0;
}

.session-title h1 .set-name {
  font-size: 1.5rem;
  font-weight: 900;
  color: #111827;
  text-align: center;
  font-family: 'Montserrat', sans-serif;
}

.session-stats {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: center;
}

.stat-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
}

.stat-badge.progress {
  background: #1e40af;
  color: #ffffff;
}

.stat-badge.missing {
  background: #dc2626;
  color: #ffffff;
}

.stat-badge.time {
  background: #374151;
  color: #ffffff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
  padding: 0;
  overflow-y: auto;
}

.session-setup {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 2rem;
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
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.set-search-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.search-input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.set-search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9375rem;
  transition: all 0.2s ease;
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
}

.set-search-input::placeholder {
  color: #9ca3af;
}

.search-button {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 10px;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
}

.search-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.search-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-button svg {
  color: currentColor;
}

.search-result {
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 10px;
}

.search-result-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.result-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.result-subtitle {
  font-size: 0.8125rem;
  color: #6b7280;
}

.search-error {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
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

.resume-sessions-section {
  margin-top: 2rem;
}

.resume-sessions-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.5rem;
}

.resume-sessions-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.resume-sessions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.resume-card {
  border-color: #dbeafe;
  background: #eff6ff;
}

.resume-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #dbeafe;
}

.resume-card .card-header h4 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.session-status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.session-status-badge.in_progress {
  background: #dbeafe;
  color: #1e40af;
}

.session-status-badge.paused {
  background: #fef3c7;
  color: #92400e;
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
  align-items: center;
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

.workspace-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 0 2rem;
}

.mode-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.mode-toggle-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-toggle-button:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.mode-toggle-button.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
}

.mode-toggle-button svg {
  width: 20px;
  height: 20px;
}

.button-text-mobile {
  display: none;
}

@media (max-width: 768px) {
  .button-text-full {
    display: none;
  }

  .button-text-mobile {
    display: inline;
  }
}

.grid-columns-controls {
  margin-left: 0.5rem;
  padding-left: 0.5rem;
  border-left: 1px solid #e5e7eb;
}

.grid-columns-buttons {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.grid-columns-select {
  display: none;
}

.grid-column-button {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 48px;
}

.grid-column-button:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.grid-column-button.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);
}

@media (max-width: 1024px) {
  .grid-columns-buttons {
    margin-left: 0.25rem;
    padding-left: 0.25rem;
    gap: 0.125rem;
  }

  .grid-column-button {
    padding: 0.375rem 0.5rem;
    font-size: 0.8125rem;
    min-width: 40px;
  }
}

@media (max-width: 768px) {
  .grid-columns-controls {
    margin-left: 0.25rem;
    padding-left: 0;
    border-left: none;
  }

  .grid-columns-buttons {
    display: none;
  }

  .grid-columns-select {
    display: block;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 80px;
  }

  .grid-columns-select:hover {
    border-color: #9ca3af;
  }

  .grid-columns-select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
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
  padding: 0 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
}

.items-grid {
  display: grid;
  gap: 1.25rem;
}

.items-grid.single-mode {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  position: relative;
  overflow: visible;
}

.part-card-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.items-grid.single-mode .part-card-wrapper {
  width: 100%;
  max-width: 100%;
}

.session-action-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1.5rem;
}

.session-action-btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
}

.session-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pause-btn {
  background: #f3f4f6;
  color: #374151;
}

.pause-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.complete-btn {
  background: #2563eb;
  color: #ffffff;
}

.complete-btn:hover:not(:disabled) {
  background: #1d4ed8;
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
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.items-grid.single-mode .part-card {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
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
  background: #ffffff;
  border: 2px solid #10b981;
}

.part-card.card-hold {
  background: #ffffff;
  border: 1px solid #e5e7eb;
}

.part-card.card-missing {
  background: #ffffff;
  border: 2px solid #ef4444;
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
  flex: 1;
  min-width: 0;
  overflow: hidden;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
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
  flex-wrap: nowrap;
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

.part-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  color: #9ca3af;
  font-size: 0.875rem;
  background: #f9fafb;
  border-radius: 4px;
  border: 1px dashed #e5e7eb;
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

  .items-grid.single-mode {
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    padding: 0 1rem;
    margin: 0 auto;
  }

  .part-card-wrapper {
    gap: 0.75rem;
    justify-content: center;
  }

  .card-nav-arrow {
    width: 40px;
    height: 40px;
  }

  .card-nav-arrow svg {
    width: 20px;
    height: 20px;
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

  /* 태블릿에서 그리드 모드: 최대 2열 */
  .items-grid:not(.single-mode) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .items-grid.single-mode {
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    padding: 0;
    margin: 0 auto;
  }

  .items-container {
    padding: 0;
  }

  .part-card {
    padding: 1rem;
  }

  /* 태블릿에서 그리드 모드 카드 간격 조정 */
  .items-grid:not(.single-mode) .part-card {
    padding: 0.875rem;
  }

  .part-card-wrapper {
    gap: 0.5rem;
    justify-content: center;
  }

  .card-nav-arrow {
    width: 36px;
    height: 36px;
  }

  .card-nav-arrow svg {
    width: 18px;
    height: 18px;
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
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .resume-actions .btn-primary {
    flex: 1;
    min-width: 0;
    font-size: 0.875rem;
    padding: 0.625rem 0.75rem;
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
    flex-direction: row;
    gap: 0.375rem;
    flex-wrap: nowrap;
  }

  .status-button {
    padding: 0.5rem;
    font-size: 0.8125rem;
    flex: 1;
    min-width: 0;
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

  .resume-actions {
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 0.25rem;
  }

  .resume-actions .btn-primary {
    flex: 1;
    min-width: 0;
    font-size: 0.8125rem;
    padding: 0.5rem 0.5rem;
  }

  .items-grid.single-mode {
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    padding: 0;
    margin: 0 auto;
  }

  /* 모바일에서 그리드 모드: 최대 1열 */
  .items-grid:not(.single-mode) {
    grid-template-columns: 1fr !important;
    gap: 0.75rem;
  }

  /* 모바일에서 그리드 모드 카드 패딩 조정 */
  .items-grid:not(.single-mode) .part-card {
    padding: 0.75rem;
  }

  .part-card {
    padding: 0.75rem;
  }

  .status-buttons {
    flex-direction: row;
    gap: 0.25rem;
    flex-wrap: nowrap;
  }

  .status-button {
    padding: 0.5rem 0.375rem;
    font-size: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .part-card-wrapper {
    gap: 0.25rem;
    justify-content: center;
  }

  .card-nav-arrow {
    width: 32px;
    height: 32px;
  }

  .card-nav-arrow svg {
    width: 16px;
    height: 16px;
  }

  .session-action-buttons {
    flex-direction: column;
    gap: 0.75rem;
  }

  .session-action-btn {
    width: 100%;
    min-width: auto;
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

/* 세션 확인 모달 */
.session-confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.session-confirm-modal {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-height: 90vh;
  overflow-y: auto;
}

.session-confirm-modal .modal-header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.session-confirm-modal .modal-body {
  padding: 1.5rem;
}

.session-confirm-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.confirm-message {
  font-size: 1rem;
  color: #111827;
  margin: 0;
  font-weight: 500;
}

.session-info-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.session-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-info-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.session-info-value {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 600;
}

.confirm-question {
  font-size: 0.9375rem;
  color: #374151;
  margin: 0;
  font-weight: 500;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  justify-content: flex-end;
}

.modal-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.resume-btn {
  background: #2563eb;
  color: #ffffff;
}

.resume-btn:hover {
  background: #1d4ed8;
}

.new-session-btn {
  background: #f3f4f6;
  color: #111827;
}

.new-session-btn:hover {
  background: #e5e7eb;
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
