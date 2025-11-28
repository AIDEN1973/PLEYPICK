<template>
  <div class="min-h-screen w-full">
    <!-- 메인 컨텐츠 영역 -->
    <div class="w-full">
      <!-- 상단 헤더 -->
      <header class="bg-white sticky top-0 z-50" style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">
        <div class="max-w-7xl mx-auto px-2 sm:px-4 lg:px-12">
          <div class="flex flex-wrap lg:flex-nowrap items-center h-auto lg:h-20 py-2 lg:py-0 relative">
            <!-- 모바일/태블릿: 좌측 햄버거 메뉴 -->
            <div class="lg:hidden flex items-center flex-shrink-0 relative" style="z-index: 30;">
              <button
                @click.stop="showMobileMenu = !showMobileMenu"
                class="hamburger-menu-btn"
                :class="{ 'hamburger-menu-btn-active': showMobileMenu }"
                ref="mobileMenuButton"
                aria-label="메뉴"
                style="pointer-events: auto; position: relative; z-index: 30;"
              >
                <svg class="hamburger-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line v-if="!showMobileMenu" x1="3" y1="6" x2="21" y2="6"></line>
                  <line v-if="!showMobileMenu" x1="3" y1="12" x2="21" y2="12"></line>
                  <line v-if="!showMobileMenu" x1="3" y1="18" x2="21" y2="18"></line>
                  <line v-if="showMobileMenu" x1="18" y1="6" x2="6" y2="18"></line>
                  <line v-if="showMobileMenu" x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- 모바일/태블릿: 가운데 로고 -->
            <div class="lg:hidden flex items-center flex-1 justify-center absolute left-0 right-0" style="pointer-events: none; z-index: 35;">
              <router-link 
                to="/" 
                class="nav-logo flex items-center" 
                @click.stop="showMobileMenu = false" 
                style="pointer-events: auto !important; position: relative; z-index: 35 !important; cursor: pointer;"
              >
                <img :src="pleyLogo" alt="Pleyon" class="object-contain" style="pointer-events: none;" />
              </router-link>
            </div>

            <!-- 데스크톱: 왼쪽 로고 -->
            <div class="hidden lg:flex items-center flex-1 justify-start">
              <router-link to="/" class="nav-logo flex items-center mr-2 sm:mr-4">
                <img :src="pleyLogo" alt="Pleyon" class="object-contain" />
              </router-link>
            </div>

            <!-- 가운데: 데스크톱 메뉴 -->
            <nav class="hidden lg:flex gap-3 xl:gap-5 items-center justify-center flex-shrink-0 self-center">
                <!-- 메뉴 순서: 부품검수 > 누락부품 > 검수이력 > 검수노트 > 구분선 > 레고리스트 > 부품으로 레고 찾기 > 설명서 -->
                <router-link 
                  to="/manual-inspection" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    부품검수
                  </router-link>
                  <router-link 
                    to="/missing-parts" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    누락부품
                  </router-link>
                  <router-link 
                    to="/inspection-history" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    검수이력
                  </router-link>
                  <router-link 
                    to="/inspection-notes" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    검수노트
                  </router-link>
                  <div class="nav-menu-divider"></div>
                  <router-link 
                    to="/set-parts" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    레고 리스트
                  </router-link>
                  <router-link 
                    to="/part-to-set-search" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    부품으로 레고 찾기
                  </router-link>
                  <router-link 
                    to="/set-instructions" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    설명서
                  </router-link>
                  <router-link 
                    to="/user-lego-registration" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    레고등록
                  </router-link>

                  <!-- 더보기 드롭다운 (관리자만) -->
                  <div v-if="user && isAdmin" class="relative" ref="managementDropdown">
                    <button
                      @click="showManagementMenu = !showManagementMenu"
                      class="management-badge-btn"
                      :class="{ 'management-badge-btn-active': showManagementMenu }"
                    >
                      더보기
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
                        viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </button>
                    <div
                      v-if="showManagementMenu"
                      class="management-dropdown-panel"
                    >
                      <div class="management-dropdown-content">
                        <div class="management-dropdown-section">
                          <div class="management-dropdown-label">레고 관리</div>
                          <div class="management-dropdown-items">
                            <router-link to="/new-lego" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>신규 레고 등록</span>
                            </router-link>
                            <router-link to="/saved-lego" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>저장된 레고</span>
                            </router-link>
                            <router-link to="/parts" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>부품 정보</span>
                            </router-link>
                          </div>
                        </div>
                        <div class="management-dropdown-divider"></div>
                        <div class="management-dropdown-section">
                          <div class="management-dropdown-label">데이터셋</div>
                          <div class="management-dropdown-items">
                            <router-link to="/synthetic-dataset" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>합성 데이터셋</span>
                            </router-link>
                          </div>
                        </div>
                        <div class="management-dropdown-divider"></div>
                        <div class="management-dropdown-section">
                          <div class="management-dropdown-label">AI 학습</div>
                          <div class="management-dropdown-items">
                            <router-link to="/automated-training" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>AI 학습</span>
                            </router-link>
                          </div>
                        </div>
                        <div class="management-dropdown-divider"></div>
                        <div class="management-dropdown-section">
                          <div class="management-dropdown-label">검출</div>
                          <div class="management-dropdown-items">
                            <router-link to="/hybrid-detection" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>부품 검출</span>
                            </router-link>
                          </div>
                        </div>
                        <div class="management-dropdown-divider"></div>
                        <div class="management-dropdown-section">
                          <div class="management-dropdown-label">자동 복구</div>
                          <div class="management-dropdown-items">
                            <router-link to="/synthetic-dataset" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>합성 데이터셋 관리</span>
                            </router-link>
                            <a href="#" @click.prevent="openAutoRecoveryStatus" class="management-dropdown-item">
                              <span>자동 복구 상태</span>
                            </a>
                            <a href="#" @click.prevent="openPortManagement" class="management-dropdown-item">
                              <span>포트 관리</span>
                            </a>
                            <a href="#" @click.prevent="openSystemMonitoring" class="management-dropdown-item">
                              <span>시스템 모니터링</span>
                            </a>
                          </div>
                        </div>
                        <div class="management-dropdown-divider"></div>
                        <div class="management-dropdown-section">
                          <div class="management-dropdown-label">시스템 관리</div>
                          <div class="management-dropdown-items">
                            <router-link to="/dashboard" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>대시보드</span>
                            </router-link>
                            <router-link to="/element-search" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>Element ID 검색</span>
                            </router-link>
                            <router-link to="/metadata-management" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>메타데이터 관리</span>
                            </router-link>
                            <router-link to="/render-optimization" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>렌더링 최적화</span>
                            </router-link>
                            <router-link to="/dataset-converter" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>데이터셋 변환</span>
                            </router-link>
                            <router-link to="/store-manager" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>매장 관리</span>
                            </router-link>
                            <router-link to="/store-management" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>매장 대시보드</span>
                            </router-link>
                            <router-link to="/monitoring" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>모니터링</span>
                            </router-link>
                            <router-link to="/model-monitoring" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>모델 모니터링</span>
                            </router-link>
                            <router-link to="/system-monitoring" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>시스템 모니터링</span>
                            </router-link>
                            <router-link to="/quality-healing" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>품질 회복 대시보드</span>
                            </router-link>
                            <router-link to="/category-management" @click="showManagementMenu = false" class="management-dropdown-item">
                              <span>카테고리 관리</span>
                            </router-link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
            </nav>

            <!-- 오른쪽: 계정 메뉴 (모바일/태블릿/데스크탑 모두 표시) -->
            <div class="flex items-center gap-2 lg:gap-4 flex-1 justify-end md:flex-1 flex-shrink-0 relative" style="z-index: 30;">
              <button 
                v-if="!user" 
                @click="showLoginModal = true" 
                class="login-badge-btn"
                style="pointer-events: auto; position: relative; z-index: 30;"
              >
                로그인
              </button>
              <button 
                v-else 
                @click="logout" 
                class="login-badge-btn"
                style="pointer-events: auto; position: relative; z-index: 30;"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
        
        <!-- 모바일 구분선 (태블릿 이하) -->
        <div class="lg:hidden" style="border-top: 1px solid #e5e7eb;"></div>
        
        <!-- 모바일 메뉴 행 (태블릿 이하) -->
        <div class="lg:hidden pt-1">
          <div class="mobile-menu-scroll" ref="mobileMenuScroll">
            <div class="mobile-menu-container">
                <router-link 
                  to="/manual-inspection" 
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                  :class="{ 'text-blue-600': isActiveRoute('/manual-inspection') }"
                >
                  부품검수
                </router-link>
                <router-link 
                  to="/missing-parts" 
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                  :class="{ 'text-blue-600': isActiveRoute('/missing-parts') }"
                >
                  누락부품
                </router-link>
                <router-link 
                  to="/inspection-history" 
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                  :class="{ 'text-blue-600': isActiveRoute('/inspection-history') }"
                >
                  검수이력
                </router-link>
                <router-link 
                  to="/inspection-notes" 
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                  :class="{ 'text-blue-600': isActiveRoute('/inspection-notes') }"
                >
                  검수노트
                </router-link>
                <div class="mobile-menu-divider"></div>
                <router-link 
                  to="/set-parts" 
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                  :class="{ 'text-blue-600': isActiveRoute('/set-parts') }"
                >
                  레고리스트
                </router-link>
                <router-link 
                  to="/part-to-set-search" 
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                  :class="{ 'text-blue-600': isActiveRoute('/part-to-set-search') }"
                >
                  부품으로 레고 찾기
                </router-link>
                <router-link 
                  to="/set-instructions" 
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                  :class="{ 'text-blue-600': isActiveRoute('/set-instructions') }"
                >
                  설명서
                </router-link>
                <router-link 
                  to="/user-lego-registration" 
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                  :class="{ 'text-blue-600': isActiveRoute('/user-lego-registration') }"
                >
                  레고등록
                </router-link>
                <template v-if="isAdmin">
                  <router-link 
                    to="/new-lego" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/new-lego') }"
                  >
                    신규 레고 등록
                  </router-link>
                  <router-link 
                    to="/saved-lego" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/saved-lego') }"
                  >
                    저장된 레고
                  </router-link>
                  <router-link 
                    to="/parts" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/parts') }"
                  >
                    부품 정보
                  </router-link>
                  <router-link 
                    to="/synthetic-dataset" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/synthetic-dataset') }"
                  >
                    합성 데이터셋
                  </router-link>
                  <router-link 
                    to="/automated-training" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/automated-training') }"
                  >
                    AI 학습
                  </router-link>
                  <router-link 
                    to="/hybrid-detection" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/hybrid-detection') }"
                  >
                    부품 검출
                  </router-link>
                  <router-link 
                    to="/dashboard" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/dashboard') }"
                  >
                    대시보드
                  </router-link>
                  <router-link 
                    to="/element-search" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/element-search') }"
                  >
                    Element ID 검색
                  </router-link>
                  <router-link 
                    to="/metadata-management" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/metadata-management') }"
                  >
                    메타데이터 관리
                  </router-link>
                  <router-link 
                    to="/render-optimization" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/render-optimization') }"
                  >
                    렌더링 최적화
                  </router-link>
                  <router-link 
                    to="/dataset-converter" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/dataset-converter') }"
                  >
                    데이터셋 변환
                  </router-link>
                  <router-link 
                    to="/store-manager" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/store-manager') }"
                  >
                    매장 관리
                  </router-link>
                  <router-link 
                    to="/store-management" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/store-management') }"
                  >
                    매장 대시보드
                  </router-link>
                  <router-link 
                    to="/monitoring" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/monitoring') }"
                  >
                    모니터링
                  </router-link>
                  <router-link 
                    to="/model-monitoring" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/model-monitoring') }"
                  >
                    모델 모니터링
                  </router-link>
                  <router-link 
                    to="/system-monitoring" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/system-monitoring') }"
                  >
                    시스템 모니터링
                  </router-link>
                  <router-link 
                    to="/quality-healing" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/quality-healing') }"
                  >
                    품질 회복 대시보드
                  </router-link>
                  <router-link 
                    to="/category-management" 
                    class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline flex-shrink-0"
                    :class="{ 'text-blue-600': isActiveRoute('/category-management') }"
                  >
                    카테고리 관리
              </router-link>
            </template>
            </div>
          </div>
        </div>
      </header>

      <!-- 모바일/태블릿: 햄버거 메뉴 드롭다운 -->
      <transition name="mobile-dropdown">
        <div
          v-if="showMobileMenu"
          class="mobile-hamburger-dropdown"
          ref="mobileMenuDropdown"
          @click.self="showMobileMenu = false"
        >
          <div class="mobile-hamburger-dropdown-content" ref="mobileDropdownContent">
            <!-- 드롭다운 헤더 -->
            <div class="mobile-hamburger-header">
              <div class="mobile-hamburger-header-title">메뉴</div>
              <button
                @click.stop="showMobileMenu = false"
                class="mobile-hamburger-close-btn"
                aria-label="메뉴 닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div class="mobile-hamburger-menu-list">
            <router-link 
              to="/manual-inspection" 
              @click="showMobileMenu = false"
              class="mobile-hamburger-item"
              :class="{ 'mobile-hamburger-item-active': isActiveRoute('/manual-inspection') }"
            >
              <span class="mobile-hamburger-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path>
                </svg>
              </span>
              <span class="mobile-hamburger-item-text">부품검수</span>
            </router-link>
            <router-link 
              to="/missing-parts" 
              @click="showMobileMenu = false"
              class="mobile-hamburger-item"
              :class="{ 'mobile-hamburger-item-active': isActiveRoute('/missing-parts') }"
            >
              <span class="mobile-hamburger-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </span>
              <span class="mobile-hamburger-item-text">누락부품</span>
            </router-link>
            <router-link 
              to="/inspection-history" 
              @click="showMobileMenu = false"
              class="mobile-hamburger-item"
              :class="{ 'mobile-hamburger-item-active': isActiveRoute('/inspection-history') }"
            >
              <span class="mobile-hamburger-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </span>
              <span class="mobile-hamburger-item-text">검수이력</span>
            </router-link>
            <router-link 
              to="/inspection-notes" 
              @click="showMobileMenu = false"
              class="mobile-hamburger-item"
              :class="{ 'mobile-hamburger-item-active': isActiveRoute('/inspection-notes') }"
            >
              <span class="mobile-hamburger-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </span>
              <span class="mobile-hamburger-item-text">검수노트</span>
            </router-link>
            <router-link 
              to="/set-parts" 
              @click="showMobileMenu = false"
              class="mobile-hamburger-item"
              :class="{ 'mobile-hamburger-item-active': isActiveRoute('/set-parts') }"
            >
              <span class="mobile-hamburger-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
              </span>
              <span class="mobile-hamburger-item-text">레고리스트</span>
            </router-link>
            <router-link 
              to="/part-to-set-search" 
              @click="showMobileMenu = false"
              class="mobile-hamburger-item"
              :class="{ 'mobile-hamburger-item-active': isActiveRoute('/part-to-set-search') }"
            >
              <span class="mobile-hamburger-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </span>
              <span class="mobile-hamburger-item-text">부품으로 레고 찾기</span>
            </router-link>
            <router-link 
              to="/set-instructions" 
              @click="showMobileMenu = false"
              class="mobile-hamburger-item"
              :class="{ 'mobile-hamburger-item-active': isActiveRoute('/set-instructions') }"
            >
              <span class="mobile-hamburger-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
              </span>
              <span class="mobile-hamburger-item-text">설명서</span>
            </router-link>
            <router-link 
              to="/user-lego-registration" 
              @click="showMobileMenu = false"
              class="mobile-hamburger-item"
              :class="{ 'mobile-hamburger-item-active': isActiveRoute('/user-lego-registration') }"
            >
              <span class="mobile-hamburger-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </span>
              <span class="mobile-hamburger-item-text">레고등록</span>
            </router-link>
            <template v-if="isAdmin">
              <div class="mobile-hamburger-divider"></div>
              <div class="mobile-hamburger-label">관리자 메뉴</div>
              <router-link 
                to="/new-lego" 
                @click="showMobileMenu = false"
                class="mobile-hamburger-item"
                :class="{ 'mobile-hamburger-item-active': isActiveRoute('/new-lego') }"
              >
                <span class="mobile-hamburger-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </span>
                <span class="mobile-hamburger-item-text">신규 레고 등록</span>
              </router-link>
              <router-link 
                to="/saved-lego" 
                @click="showMobileMenu = false"
                class="mobile-hamburger-item"
                :class="{ 'mobile-hamburger-item-active': isActiveRoute('/saved-lego') }"
              >
                <span class="mobile-hamburger-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                </span>
                <span class="mobile-hamburger-item-text">저장된 레고</span>
              </router-link>
              <router-link 
                to="/parts" 
                @click="showMobileMenu = false"
                class="mobile-hamburger-item"
                :class="{ 'mobile-hamburger-item-active': isActiveRoute('/parts') }"
              >
                <span class="mobile-hamburger-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </span>
                <span class="mobile-hamburger-item-text">부품 정보</span>
              </router-link>
              <router-link 
                to="/synthetic-dataset" 
                @click="showMobileMenu = false"
                class="mobile-hamburger-item"
                :class="{ 'mobile-hamburger-item-active': isActiveRoute('/synthetic-dataset') }"
              >
                <span class="mobile-hamburger-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                  </svg>
                </span>
                <span class="mobile-hamburger-item-text">합성 데이터셋</span>
              </router-link>
              <router-link 
                to="/automated-training" 
                @click="showMobileMenu = false"
                class="mobile-hamburger-item"
                :class="{ 'mobile-hamburger-item-active': isActiveRoute('/automated-training') }"
              >
                <span class="mobile-hamburger-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </span>
                <span class="mobile-hamburger-item-text">AI 학습</span>
              </router-link>
              <router-link 
                to="/hybrid-detection" 
                @click="showMobileMenu = false"
                class="mobile-hamburger-item"
                :class="{ 'mobile-hamburger-item-active': isActiveRoute('/hybrid-detection') }"
              >
                <span class="mobile-hamburger-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </span>
                <span class="mobile-hamburger-item-text">부품 검출</span>
              </router-link>
              <router-link 
                to="/dashboard" 
                @click="showMobileMenu = false"
                class="mobile-hamburger-item"
                :class="{ 'mobile-hamburger-item-active': isActiveRoute('/dashboard') }"
              >
                <span class="mobile-hamburger-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </span>
                <span class="mobile-hamburger-item-text">대시보드</span>
              </router-link>
            </template>
            </div>
          </div>
        </div>
      </transition>

      <!-- 콘텐츠 -->
      <main :class="['flex-1', isSystemMonitoringRoute ? 'p-0 bg-transparent' : 'p-4 sm:p-6 bg-gray-50']">
        <router-view />
      </main>
    </div>

    <!-- 로그인 모달 -->
    <div v-if="showLoginModal" class="modal-overlay">
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
    <div v-if="showSignupModal" class="modal-overlay">
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSupabase } from './composables/useSupabase'
import { useSupabasePleyon } from './composables/useSupabasePleyon'
import pleyLogo from './assets/pley_logo.jpg'

export default {
  name: 'App',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const { supabase, user, signIn, signUp } = useSupabase()
    const { getStoreInfoByEmail } = useSupabasePleyon()
    const showManagementMenu = ref(false)
    const isAdmin = ref(false)
    const isStoreUser = ref(false)
    const storeInfo = ref(null)
    const managementDropdown = ref(null)
    const showUserMenu = ref(false)
    const userMenuDropdown = ref(null)
    const showMobileMenu = ref(false)
    const mobileMenuDropdown = ref(null)
    const mobileMenuButton = ref(null)
    const mobileDropdownContent = ref(null)
    const mobileMenuScroll = ref(null)

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

    const isSystemMonitoringRoute = computed(() => route.path.startsWith('/system-monitoring'))
    
    // watch로 showMobileMenu 변화 감지
    watch(showMobileMenu, (newVal) => {
      console.log('=== showMobileMenu changed ===')
      console.log('New value:', newVal)
      console.log('mobileMenuDropdown ref:', mobileMenuDropdown.value)
      console.log('mobileDropdownContent ref:', mobileDropdownContent.value)
      
      if (newVal && mobileDropdownContent.value) {
        console.log('Dropdown should be visible now')
        console.log('Dropdown element:', mobileDropdownContent.value)
        console.log('Dropdown classes:', mobileDropdownContent.value.className)
      }
    })

    const handleMobileMenuClick = (event) => {
      console.log('=== Mobile Menu Click Debug ===')
      console.log('Event:', event)
      console.log('Current showMobileMenu state:', showMobileMenu.value)
      console.log('mobileMenuDropdown ref:', mobileMenuDropdown.value)
      console.log('mobileMenuDropdown element:', mobileMenuDropdown.value ? mobileMenuDropdown.value.outerHTML.substring(0, 200) : 'null')
      
      showMobileMenu.value = !showMobileMenu.value
      
      console.log('New showMobileMenu state:', showMobileMenu.value)
      
    }

    const handleClickOutside = (event) => {
      if (managementDropdown.value && !managementDropdown.value.contains(event.target)) {
        showManagementMenu.value = false
      }
      if (userMenuDropdown.value && !userMenuDropdown.value.contains(event.target)) {
        showUserMenu.value = false
      }
      if (showMobileMenu.value && mobileMenuDropdown.value) {
        const isClickInside = mobileMenuDropdown.value.contains(event.target)
        const isClickOnButton = mobileMenuButton.value && (
          mobileMenuButton.value.contains(event.target) || 
          mobileMenuButton.value === event.target ||
          event.target.closest('.hamburger-menu-btn')
        )
        
        if (!isClickInside && !isClickOnButton) {
          showMobileMenu.value = false
        }
      }
    }

    const checkUserRole = async () => {
      if (!user.value) {
        isAdmin.value = false
        isStoreUser.value = false
        storeInfo.value = null
        return
      }

      try {
        const { data: adminData, error: adminError } = await supabase
          .from('admin_users')
          .select('id, role, is_active, email')
          .eq('email', user.value.email)
          .eq('is_active', true)
          .maybeSingle()

        if (adminData && !adminError) {
          isAdmin.value = adminData.role === 'admin' || adminData.role === 'super_admin'
          isStoreUser.value = false
          storeInfo.value = null
          
          // 관리자는 users 테이블의 role을 admin으로 유지
          // 플레이온 매장 정보가 있어도 role은 admin으로 유지
          const pleyonStoreInfo = await getStoreInfoByEmail(user.value.email)
          let updateData = {
            role: 'admin',
            updated_at: new Date().toISOString()
          }
          
          // 플레이온 매장 정보가 있으면 store_id만 업데이트 (role은 admin 유지)
          if (pleyonStoreInfo && pleyonStoreInfo.store) {
            const { store } = pleyonStoreInfo
            
            // stores 테이블 동기화
            const { error: storeSyncError } = await supabase
              .from('stores')
              .upsert({
                id: store.id,
                name: store.name,
                location: store.address || null,
                contact: store.store_phone || store.owner_phone || null,
                status: store.is_active ? 'active' : 'inactive',
                config: {
                  pleyon_store_id: store.id,
                  owner_name: store.store_owner_name,
                  owner_phone: store.owner_phone
                },
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'id'
              })
            
            if (!storeSyncError) {
              updateData.store_id = store.id
            }
          }
          
          // users 테이블의 role을 admin으로 업데이트 (store_id는 선택적)
          const { error: userUpdateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', user.value.id)
          
          if (userUpdateError) {
            console.error('[App] 관리자 role 업데이트 실패:', userUpdateError)
          } else if (pleyonStoreInfo && pleyonStoreInfo.store) {
            // 관리자이면서 매장 정보가 있는 경우, storeInfo 설정
            storeInfo.value = pleyonStoreInfo
          }
          
          return
        } else if (adminError && adminError.code !== 'PGRST116') {
          // PGRST116: No rows found (정상 케이스)
          console.error('[App] 관리자 확인 오류:', adminError.message)
        }

        // 관리자가 아닌 경우, 플레이온 매장 사용자 정보를 확인
        const pleyonStoreInfo = await getStoreInfoByEmail(user.value.email)
        
        if (pleyonStoreInfo && pleyonStoreInfo.store) {
          isStoreUser.value = true
          isAdmin.value = false
          storeInfo.value = pleyonStoreInfo
          
          const { store, storeUserRole } = pleyonStoreInfo
          
          // stores 테이블 동기화
          const { error: storeSyncError } = await supabase
            .from('stores')
            .upsert({
              id: store.id,
              name: store.name,
              location: store.address || null,
              contact: store.store_phone || store.owner_phone || null,
              status: store.is_active ? 'active' : 'inactive',
              config: {
                pleyon_store_id: store.id,
                owner_name: store.store_owner_name,
                owner_phone: store.owner_phone
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            })
          
          if (storeSyncError) {
            console.error('[App] 매장 정보 동기화 실패:', storeSyncError)
          } else {
            console.log('[App] 플레이온 매장 정보 동기화 완료:', store.name)
            
            // 역할 매핑: 점주 -> store_owner, 직원 -> store_staff, 기타 -> store_manager
            let userRole = 'store_user'
            if (storeUserRole === '점주' || storeUserRole === 'owner') {
              userRole = 'store_owner'
            } else if (storeUserRole === '직원' || storeUserRole === 'staff') {
              userRole = 'store_staff'
            } else if (storeUserRole === 'manager') {
              userRole = 'store_manager'
            }
            
            // users 테이블의 role과 store_id 업데이트
            const { error: userUpdateError } = await supabase
              .from('users')
              .update({
                role: userRole,
                store_id: store.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', user.value.id)

            if (userUpdateError) {
              console.error('[App] 사용자 매장 정보 업데이트 실패:', userUpdateError)
            } else {
              console.log('[App] 사용자 매장 정보 업데이트 완료 (role:', userRole, ')')
            }
          }
        } else {
          // 일반 사용자 (관리자도 아니고 매장 사용자도 아님)
          isStoreUser.value = false
          isAdmin.value = false
          storeInfo.value = null
          
          // users 테이블의 role을 default로 업데이트
          const { error: userUpdateError } = await supabase
            .from('users')
            .update({
              role: 'user',
              store_id: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.value.id)

          if (userUpdateError) {
            console.error('[App] 일반 사용자 role 업데이트 실패:', userUpdateError)
          }
        }
      } catch (err) {
        console.error('사용자 역할 확인 오류:', err)
        isAdmin.value = false
        isStoreUser.value = false
        storeInfo.value = null
      }
    }

    watch(user, (newUser) => {
      if (newUser) {
        checkUserRole()
      } else {
        isAdmin.value = false
        isStoreUser.value = false
        storeInfo.value = null
      }
    }, { immediate: true })

    // 모바일 메뉴 스크롤 초기화 함수
    const initMobileMenuScroll = () => {
      const scrollElement = mobileMenuScroll.value || document.querySelector('.mobile-menu-scroll')
      if (!scrollElement) {
        console.log('[모바일 메뉴] 스크롤 컨테이너를 찾을 수 없음')
        return
      }
      
      // 디버깅 정보 출력
      console.log('==== 모바일 메뉴 디버깅 시작 ====')
      console.log('[모바일 메뉴] 스크롤 컨테이너:', scrollElement)
      console.log('[모바일 메뉴] scrollWidth:', scrollElement.scrollWidth)
      console.log('[모바일 메뉴] clientWidth:', scrollElement.clientWidth)
      console.log('[모바일 메뉴] offsetWidth:', scrollElement.offsetWidth)
      console.log('[모바일 메뉴] 스크롤 가능 여부:', scrollElement.scrollWidth > scrollElement.clientWidth)
      
      const computed = window.getComputedStyle(scrollElement)
      console.log('[모바일 메뉴] overflow-x:', computed.overflowX)
      console.log('[모바일 메뉴] touch-action:', computed.touchAction)
      console.log('[모바일 메뉴] user-select:', computed.userSelect)
      console.log('[모바일 메뉴] pointer-events:', computed.pointerEvents)
      
      const container = scrollElement.querySelector('.mobile-menu-container')
      if (container) {
        console.log('[모바일 메뉴] 컨테이너 offsetWidth:', container.offsetWidth)
        console.log('[모바일 메뉴] 컨테이너 scrollWidth:', container.scrollWidth)
        console.log('[모바일 메뉴] 컨테이너 clientWidth:', container.clientWidth)
        const containerComputed = window.getComputedStyle(container)
        console.log('[모바일 메뉴] 컨테이너 width:', containerComputed.width)
        console.log('[모바일 메뉴] 컨테이너 display:', containerComputed.display)
        console.log('[모바일 메뉴] 컨테이너 flex-wrap:', containerComputed.flexWrap)
        
        const children = container.children
        console.log('[모바일 메뉴] 메뉴 항목 수:', children.length)
        let totalWidth = 0
        for (let i = 0; i < Math.min(3, children.length); i++) {
          console.log(`[모바일 메뉴] 항목 ${i} width:`, children[i].offsetWidth)
          totalWidth += children[i].offsetWidth
        }
        console.log('[모바일 메뉴] 처음 3개 항목 총 너비:', totalWidth)
      }
      
      // 실제 스크롤 테스트
      console.log('[모바일 메뉴] 현재 scrollLeft:', scrollElement.scrollLeft)
      scrollElement.scrollLeft = 50
      console.log('[모바일 메뉴] 50px 스크롤 시도 후 scrollLeft:', scrollElement.scrollLeft)
      scrollElement.scrollLeft = 0
      
      // 터치 이벤트 리스너 추가
      let touchStartX = 0
      let touchStartY = 0
      let scrollStartX = 0
      let isScrolling = false
      let preventClick = false
      
      const handleTouchStart = (e) => {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
        scrollStartX = scrollElement.scrollLeft
        isScrolling = false
        preventClick = false
        console.log('[모바일 메뉴] 터치 시작 - X:', touchStartX, 'Y:', touchStartY, 'scrollLeft:', scrollStartX)
      }
      
      const handleTouchMove = (e) => {
        const touchCurrentX = e.touches[0].clientX
        const touchCurrentY = e.touches[0].clientY
        const deltaX = touchCurrentX - touchStartX
        const deltaY = touchCurrentY - touchStartY
        const absDeltaX = Math.abs(deltaX)
        const absDeltaY = Math.abs(deltaY)
        
        console.log('[모바일 메뉴] 터치 이동 - deltaX:', deltaX, 'deltaY:', deltaY, 'isScrolling:', isScrolling)
        
        if (absDeltaX > absDeltaY && absDeltaX > 10) {
          if (!isScrolling) {
            isScrolling = true
            preventClick = true
            console.log('[모바일 메뉴] 스크롤 시작 감지')
          }
          
          // 실제 스크롤 적용
          const newScrollLeft = scrollStartX - deltaX
          scrollElement.scrollLeft = Math.max(0, Math.min(newScrollLeft, scrollElement.scrollWidth - scrollElement.clientWidth))
          console.log('[모바일 메뉴] 스크롤 적용 - newScrollLeft:', scrollElement.scrollLeft)
        }
      }
      
      const handleTouchEnd = (e) => {
        const touchEndX = e.changedTouches[0].clientX
        const touchEndY = e.changedTouches[0].clientY
        const deltaX = Math.abs(touchEndX - touchStartX)
        const deltaY = Math.abs(touchEndY - touchStartY)
        
        console.log('[모바일 메뉴] 터치 종료 - deltaX:', deltaX, 'deltaY:', deltaY, 'isScrolling:', isScrolling, 'preventClick:', preventClick)
        console.log('[모바일 메뉴] 최종 scrollLeft:', scrollElement.scrollLeft)
        
        // 스크롤이 발생했으면 링크 클릭 방지
        if (preventClick && isScrolling) {
          const clickedLink = e.target.closest('a')
          if (clickedLink) {
            console.log('[모바일 메뉴] 링크 클릭 방지:', clickedLink)
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
          }
        }
        
        touchStartX = 0
        touchStartY = 0
        scrollStartX = 0
        isScrolling = false
        
        // 짧은 시간 후 preventClick 해제
        setTimeout(() => {
          preventClick = false
        }, 100)
      }
      
      // 링크 클릭 방지
      const handleLinkClick = (e) => {
        if (preventClick) {
          console.log('[모바일 메뉴] 링크 클릭 차단')
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return false
        }
      }
      
      scrollElement.addEventListener('touchstart', handleTouchStart, { passive: false })
      scrollElement.addEventListener('touchmove', handleTouchMove, { passive: false })
      scrollElement.addEventListener('touchend', handleTouchEnd, { passive: false })
      
      // 모든 링크에 클릭 이벤트 리스너 추가
      const links = scrollElement.querySelectorAll('a')
      links.forEach(link => {
        link.addEventListener('click', handleLinkClick, { capture: true })
      })
      
      console.log('[모바일 메뉴] 터치 이벤트 리스너 등록 완료')
      console.log('==== 모바일 메뉴 디버깅 종료 ====')
    }
    
    // watch로 ref가 설정될 때까지 기다림
    watch(mobileMenuScroll, (newVal) => {
      if (newVal) {
        console.log('[모바일 메뉴] ref 설정됨')
        nextTick(() => {
          setTimeout(() => {
            initMobileMenuScroll()
          }, 100)
        })
      }
    }, { immediate: true })
    
    onMounted(async () => {
      if (user.value) {
        checkUserRole()
      }
      document.addEventListener('click', handleClickOutside)
      
      // DOM 렌더링 완료 후 초기화 시도
      await nextTick()
      setTimeout(() => {
        if (!initMobileMenuScroll()) {
          // 재시도
          setTimeout(() => initMobileMenuScroll(), 200)
        }
      }, 100)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    const logout = async () => {
      showUserMenu.value = false
      await supabase.auth.signOut()
      router.push('/')
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

    const openAutoRecoveryStatus = () => {
      showManagementMenu.value = false
      router.push('/synthetic-dataset')
      setTimeout(() => {
        const element = document.querySelector('.auto-recovery-panel')
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' })
        }
      }, 500)
    }

    const openPortManagement = () => {
      showManagementMenu.value = false
      router.push('/port-management')
    }

    const openSystemMonitoring = () => {
      showManagementMenu.value = false
      router.push('/system-monitoring')
    }

    const isActiveRoute = (path) => {
      return route.path === path || route.path.startsWith(path + '/')
    }

    return {
      pleyLogo,
      user,
      isAdmin,
      isStoreUser,
      storeInfo,
      logout,
      showManagementMenu,
      managementDropdown,
      showUserMenu,
      userMenuDropdown,
      showMobileMenu,
      mobileMenuDropdown,
      mobileMenuButton,
      mobileDropdownContent,
      handleMobileMenuClick,
      openAutoRecoveryStatus,
      openPortManagement,
      openSystemMonitoring,
      isActiveRoute,
      isSystemMonitoringRoute,
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

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  background-color: #f5f7fa;
  color: #111827;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.min-h-screen {
  min-height: 100vh;
}

.w-full {
  width: 100%;
}

.bg-white {
  background-color: #ffffff;
}

.border-b {
  border-bottom-width: 1px;
}

.border-b-2 {
  border-bottom-width: 2px;
}

.border-gray-200 {
  border-color: #e5e7eb;
}

.border-gray-300 {
  border-color: #d1d5db;
}

.px-12 {
  padding-left: 3rem;
  padding-right: 3rem;
}

.py-4 {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.justify-center {
  justify-content: center;
}

.justify-start {
  justify-content: flex-start;
}

.justify-end {
  justify-content: flex-end;
}

.gap-5 {
  gap: 1.25rem;
}

.gap-3 {
  gap: 0.75rem;
}

.gap-1 {
  gap: 0.25rem;
}

.mr-4 {
  margin-right: 1rem;
}

.text-2xl {
  font-size: 1.5rem;
  line-height: 2rem;
}

.font-bold {
  font-weight: 700;
}

.text-gray-800 {
  color: #1f2937;
}

.text-lg {
  font-size: 1.125rem;
  line-height: 1.75rem;
}

.hover\:text-blue-600:hover {
  color: #ff3600;
}

.transition-colors {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

.focus\:outline-none:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.text-blue-600 {
  color: #ff3600;
}

.border-b-4 {
  border-bottom-width: 4px;
}

.border-blue-600 {
  border-color: #2563eb;
}

/* // 🔧 수정됨: 로고 및 메뉴 밑줄 스타일 */
.nav-logo {
  text-decoration: none;
  pointer-events: auto !important;
  cursor: pointer;
  position: relative;
  z-index: 35 !important;
}

.nav-logo img {
  height: 36px;
  max-height: 36px;
  width: auto;
  object-fit: contain;
}

@media (min-width: 768px) {
  .nav-logo img {
    height: 48px;
    max-height: 48px;
  }
}

@media (min-width: 1024px) {
  .nav-logo img {
    height: 51px;
    max-height: 51px;
  }
}

.nav-menu-link {
  text-decoration: none;
  position: relative;
  padding-top: 3px;
  padding-bottom: 4px;
}

.nav-menu-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background-color: transparent;
  transition: background-color 0.2s;
}

.nav-menu-link.nav-menu-active::after {
  background-color: #ff3600;
}

.nav-menu-divider {
  width: 1px;
  height: 16px;
  background-color: #d1d5db;
  margin: 0 0.5rem;
  flex-shrink: 0;
  transform: translateY(-2px);
}

.mobile-menu-divider {
  width: 1px;
  height: 16px;
  background-color: #d1d5db;
  margin: 0 0.5rem;
  flex-shrink: 0;
  align-self: center;
}

.nav-menu-link.nav-menu-active {
  color: #ff3600;
  transform: translateY(-2px);
}

.no-underline {
  text-decoration: none;
}

.mobile-menu-button {
  border: none;
  background: none;
  outline: none;
  box-shadow: none;
  cursor: pointer;
}

.text-base {
  font-size: 1rem;
  line-height: 1.5rem;
}

.relative {
  position: relative;
}

.absolute {
  position: absolute;
}

.left-0 {
  left: 0;
}

.mt-2 {
  margin-top: 0.5rem;
}

.w-64 {
  width: 16rem;
}

.border {
  border-width: 1px;
}

.rounded-lg {
  border-radius: 0.5rem;
}

.shadow-lg {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.z-50 {
  z-index: 50;
}

.max-h-\[80vh\] {
  max-height: 80vh;
}

.overflow-y-auto {
  overflow-y: auto;
}

.p-2 {
  padding: 0.5rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.px-3 {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.py-1 {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.text-xs {
  font-size: 0.75rem;
  line-height: 1rem;
}

.font-semibold {
  font-weight: 600;
}

.text-gray-500 {
  color: #6b7280;
}

.uppercase {
  text-transform: uppercase;
}

.py-2 {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.text-sm {
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.text-gray-700 {
  color: #374151;
}

.hover\:bg-gray-100:hover {
  background-color: #f3f4f6;
}

.rounded {
  border-radius: 0.25rem;
}

.block {
  display: block;
}

.w-4 {
  width: 1rem;
}

.h-4 {
  height: 1rem;
}

.text-gray-500 {
  color: #6b7280;
}

.px-4 {
  padding-left: 1rem;
  padding-right: 1rem;
}

.font-medium {
  font-weight: 500;
}

.text-blue-600 {
  color: #ff3600;
}

.hover\:text-blue-700:hover {
  color: #1d4ed8;
}

.bg-blue-500 {
  background-color: #3b82f6;
}

.hover\:bg-blue-600:hover {
  background-color: #2563eb;
}

.rounded-full {
  border-radius: 9999px;
  border: none;
  outline: none;
}

.w-5 {
  width: 1.25rem;
}

.h-5 {
  height: 1.25rem;
}

.text-white {
  color: #ffffff;
}

.hover\:text-white:hover {
  color: #ffffff;
}

.header-icon-tooltip {
  position: relative;
  cursor: pointer;
}

.header-icon-tooltip:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  white-space: nowrap;
  z-index: 99999;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  margin-top: 0.5rem;
  opacity: 1;
}

.header-icon-tooltip:hover::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-bottom-color: #1f2937;
  z-index: 99999;
  pointer-events: none;
  margin-top: -0.25rem;
  opacity: 1;
}

/* // 🔧 수정됨: 계정 메뉴 스타일 */
.account-menu-trigger {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 9999px;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  color: #ffffff;
  box-shadow: 0 10px 20px -10px rgba(37, 99, 235, 0.65);
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.account-menu-trigger:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%);
  box-shadow: 0 14px 24px -12px rgba(37, 99, 235, 0.75);
  transform: translateY(-1px);
}

.account-dropdown-panel {
  position: absolute;
  right: 0;
  margin-top: 0.75rem;
  width: 200px; /* // 🔧 수정됨 */
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 18px 32px -12px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  z-index: 1000;
}

.account-dropdown-header {
  padding: 16px 20px 14px;
  background: linear-gradient(135deg, #f5f9ff 0%, #eef2ff 100%);
  border-bottom: 1px solid #e5e7eb;
}

.account-dropdown-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f2937;
}

.account-dropdown-email {
  margin-top: 4px;
  font-size: 0.75rem;
  color: #6b7280;
}

.account-dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 12px 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.account-dropdown-item svg {
  flex-shrink: 0;
  color: inherit;
}

.account-dropdown-item:hover {
  background: #f5f7ff;
  color: #2563eb;
}

.account-dropdown-divider {
  height: 1px;
  margin: 4px 0;
  background: #eef2f7;
}

.account-dropdown-item-danger {
  color: #dc2626;
}

.account-dropdown-item-danger:hover {
  background: #fef2f2;
  color: #b91c1c;
}

.account-dropdown-store-section {
  padding: 12px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.account-dropdown-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.account-dropdown-section-title svg {
  color: #9ca3af;
}

.account-dropdown-store-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.account-dropdown-store-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-dropdown-store-label {
  font-size: 0.7rem;
  color: #9ca3af;
  font-weight: 500;
}

.account-dropdown-store-value {
  font-size: 0.8125rem;
  color: #1f2937;
  font-weight: 500;
  word-break: break-word;
}

.right-0 {
  right: 0;
}

.w-48 {
  width: 12rem;
}

.text-gray-900 {
  color: #111827;
}

.border-gray-100 {
  border-color: #f3f4f6;
}

.w-full {
  width: 100%;
}

.text-left {
  text-align: left;
}

.rounded-b-lg {
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}

.flex-1 {
  flex: 1 1 0%;
}

.hidden {
  display: none;
}

/* 반응형 유틸리티 */
.sticky {
  position: sticky;
}

.top-0 {
  top: 0;
}

.z-50 {
  z-index: 50;
}

.max-w-7xl {
  max-width: 80rem;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.px-4 {
  padding-left: 1rem;
  padding-right: 1rem;
}

.h-16 {
  height: 4rem;
}

.flex-shrink-0 {
  flex-shrink: 0;
}

.ml-auto {
  margin-left: auto;
}

.ml-4 {
  margin-left: 1rem;
}

.space-y-1 > * + * {
  margin-top: 0.25rem;
}

.whitespace-nowrap {
  white-space: nowrap;
}

/* 반응형 미디어 쿼리 */
@media (min-width: 640px) {
  .sm\:px-6 {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }

  .sm\:mr-4 {
    margin-right: 1rem;
  }

  .sm\:text-2xl {
    font-size: 1.5rem;
    line-height: 2rem;
  }

  .sm\:p-6 {
    padding: 1.5rem;
  }
}

@media (min-width: 768px) {
  .md\:flex {
    display: flex !important;
  }

  .md\:hidden {
    display: none !important;
  }
}

@media (min-width: 1024px) {
  .lg\:px-12 {
    padding-left: 3rem;
    padding-right: 3rem;
  }

  .lg\:h-20 {
    height: 5rem;
  }

  .lg\:flex {
    display: flex;
  }

  .lg\:hidden {
    display: none;
  }

  .lg\:gap-4 {
    gap: 1rem;
  }
}

@media (min-width: 1280px) {
  .xl\:gap-5 {
    gap: 1.25rem;
  }

  .xl\:text-lg {
    font-size: 1.125rem;
    line-height: 1.75rem;
  }

  .xl\:text-base {
    font-size: 1rem;
    line-height: 1.5rem;
  }
}

.p-0 {
  padding: 0;
}

.bg-transparent {
  background-color: transparent;
}

.p-6 {
  padding: 1.5rem;
}

.bg-gray-50 {
  background-color: #f9fafb;
}

main {
  width: 100%;
  min-height: 0;
}

@media (max-width: 1024px) {
  .px-12 {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
  
  .gap-5 {
    gap: 1rem;
  }
}


/* 태블릿/데스크톱 메뉴 간격 보장 */
@media (min-width: 768px) {
  header nav.gap-3 {
    gap: 0.75rem !important;
  }
  
  header nav.gap-3 > * {
    margin: 0;
  }
}

@media (min-width: 1280px) {
  header nav[class*="gap-3"][class*="xl:gap-5"],
  header nav.gap-3 {
    gap: 1.25rem !important;
  }
}

@media (max-width: 1023px) {
  .px-12 {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  
  .gap-5 {
    gap: 0.5rem;
  }
  
  .text-lg {
    font-size: 1rem;
  }
  
  .text-base {
    font-size: 0.875rem;
  }

  header .flex.items-center {
    flex-wrap: wrap;
    overflow: visible;
  }

  .nav-logo {
    flex-shrink: 0;
  }

  header .flex.items-center.flex-1 {
    min-width: 0;
    overflow: hidden;
  }

  /* 모바일에서 데스크톱 메뉴 확실히 숨김 */
  header nav.hidden {
    display: none !important;
  }

  /* 모바일 메뉴 스크롤 컨테이너 */
  .mobile-menu-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
    width: 100%;
    overscroll-behavior-x: contain;
    position: relative;
    padding: 0 1rem;
    cursor: grab;
  }
  
  .mobile-menu-scroll:active {
    cursor: grabbing;
  }

  .mobile-menu-scroll::-webkit-scrollbar {
    display: none;
  }

  /* 모바일 메뉴 간격 줄이기 */
  .mobile-menu-container {
    gap: 0.125rem !important;
    overflow: visible !important;
    min-width: max-content !important;
    width: max-content !important;
    max-width: none !important;
    display: flex !important;
    align-items: center;
    flex-wrap: nowrap !important;
    flex-shrink: 0 !important;
  }
  
  /* 태블릿 모드: 메뉴 가운데 정렬 */
  @media (min-width: 768px) and (max-width: 1023px) {
    .mobile-menu-scroll {
      display: flex;
      justify-content: center;
      padding: 0;
    }
    
    .mobile-menu-container {
      margin: 0 auto;
    }
  }

  /* 모바일 메뉴 항목 패딩 줄이기 */
  .mobile-menu-container a.px-3,
  .mobile-menu-container button.px-3 {
    padding-left: 0.375rem !important;
    padding-right: 0.375rem !important;
  }
  
  /* 모바일 메뉴 모든 항목 폰트 사이즈 통일 */
  .mobile-menu-container a,
  .mobile-menu-container button {
    font-size: 0.875rem !important;
    font-weight: 700 !important;
    line-height: 1.25rem !important;
    -webkit-tap-highlight-color: transparent;
    pointer-events: auto;
  }
  
  /* 모바일 메뉴 컨테이너의 부모 overflow 해제 */
  header .flex.items-center.h-16,
  header .flex.items-center.lg\:h-20 {
    overflow: visible !important;
  }
  
  /* 헤더 컨테이너 overflow 해제 */
  header > div.max-w-7xl {
    overflow: visible !important;
  }
}

/* 햄버거 메뉴 버튼 스타일 */
.hamburger-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #374151;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  flex-shrink: 0;
  border-radius: 12px;
  pointer-events: auto;
  position: relative;
  z-index: 30;
}

.hamburger-menu-btn:hover {
  color: #ff3600;
  background: transparent;
}

.hamburger-menu-btn:active {
  transform: scale(0.95);
}

.hamburger-menu-btn-active {
  color: #ff3600;
  background: transparent;
}

.hamburger-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 모바일 햄버거 드롭다운 메뉴 */
.mobile-hamburger-dropdown {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(0, 0, 0, 0.7);
  z-index: 99999 !important;
  display: flex !important;
  align-items: flex-start;
  justify-content: flex-start;
  visibility: visible !important;
  opacity: 1 !important;
  padding: 0;
}

.mobile-hamburger-dropdown-content {
  background: linear-gradient(to bottom, #ffffff 0%, #fafafa 100%);
  width: 320px;
  max-width: 85vw;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
  display: flex !important;
  flex-direction: column;
  visibility: visible !important;
  opacity: 1 !important;
  transform: translateX(0);
  will-change: transform;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
  border-radius: 0 16px 16px 0;
  margin-top: 1rem;
  margin-left: 1rem;
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.mobile-hamburger-dropdown-content::-webkit-scrollbar {
  width: 6px;
}

.mobile-hamburger-dropdown-content::-webkit-scrollbar-track {
  background: transparent;
}

.mobile-hamburger-dropdown-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
  transition: background 0.2s ease;
}

.mobile-hamburger-dropdown-content::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.mobile-hamburger-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: #ff3600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.mobile-hamburger-header-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: white;
  letter-spacing: -0.02em;
}

.mobile-hamburger-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.mobile-hamburger-close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.mobile-hamburger-close-btn:active {
  transform: scale(0.95);
}

.mobile-hamburger-menu-list {
  padding: 0.5rem 0;
}

.mobile-hamburger-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-bottom: 1px solid #f3f4f6;
  position: relative;
}

.mobile-hamburger-item:last-child {
  border-bottom: none;
}

.mobile-hamburger-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: #6b7280;
  transition: all 0.2s ease;
}

.mobile-hamburger-item-text {
  flex: 1;
  transition: all 0.2s ease;
}

.mobile-hamburger-item:hover {
  background: linear-gradient(to right, #fef2f2 0%, #ffffff 100%);
  color: #ff3600;
  padding-left: 1.75rem;
}

.mobile-hamburger-item:hover .mobile-hamburger-item-icon {
  color: #ff3600;
  transform: scale(1.1);
}

.mobile-hamburger-item-active {
  color: #ff3600;
  background: linear-gradient(to right, #fef2f2 0%, #ffffff 100%);
  border-left: 3px solid #ff3600;
  font-weight: 600;
  padding-left: calc(1.5rem - 3px);
}

.mobile-hamburger-item-active .mobile-hamburger-item-icon {
  color: #ff3600;
}

.mobile-hamburger-item-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #ff3600;
}

.mobile-hamburger-divider {
  height: 1px;
  background: linear-gradient(to right, transparent 0%, #e5e7eb 20%, #e5e7eb 80%, transparent 100%);
  margin: 0.5rem 1.5rem;
}

.mobile-hamburger-label {
  padding: 0.75rem 1.5rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  background: linear-gradient(to right, #f9fafb 0%, #ffffff 100%);
  border-top: 1px solid #f3f4f6;
  border-bottom: 1px solid #f3f4f6;
  margin-top: 0.25rem;
}

/* 모바일 드롭다운 메뉴 스타일 */
.mobile-dropdown-menu {
  position: absolute !important;
  right: 0 !important;
  top: 100% !important;
  margin-top: 0.5rem !important;
  min-width: 10rem !important;
  width: auto !important;
  background: white !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 0.5rem !important;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
  z-index: 99999 !important;
  overflow: visible !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.mobile-dropdown-item {
  display: block;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  line-height: 1.25rem !important;
  color: #1f2937;
  text-decoration: none;
  transition: all 0.15s;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .mobile-menu-button {
    font-size: 0.875rem !important;
  }

  .mobile-dropdown-item {
    font-size: 0.875rem !important;
  }
}

.mobile-dropdown-item:hover {
  background-color: #f3f4f6;
  color: #ff3600;
}

.mobile-dropdown-item-active {
  color: #ff3600;
  background-color: #f9fafb;
}

.mobile-dropdown-item-sub {
  font-weight: 400;
  color: #374151;
}

.mobile-dropdown-item-sub:hover {
  color: #ff3600;
}

.mobile-dropdown-divider {
  border-top: 1px solid #e5e7eb;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
}

.mobile-dropdown-label {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

/* 모바일 드롭다운 애니메이션 */
.mobile-dropdown-enter-active {
  transition: opacity 0.2s ease-out;
}

.mobile-dropdown-enter-active .mobile-hamburger-dropdown-content {
  transition: transform 0.3s ease-out;
}

.mobile-dropdown-leave-active {
  transition: opacity 0.2s ease-in;
}

.mobile-dropdown-leave-active .mobile-hamburger-dropdown-content {
  transition: transform 0.3s ease-in;
}

.mobile-dropdown-enter-from {
  opacity: 0;
}

.mobile-dropdown-enter-from .mobile-hamburger-dropdown-content {
  transform: translateX(-100%);
}

.mobile-dropdown-leave-to {
  opacity: 0;
}

.mobile-dropdown-leave-to .mobile-hamburger-dropdown-content {
  transform: translateX(-100%);
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

.btn-secondary {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
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

.login-badge-btn {
  padding: 0.375rem 0.75rem;
  background: #ff3600;
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  position: relative;
  z-index: 30;
}

.login-badge-btn:hover {
  background: #e63000;
}

.login-badge-btn:active {
  transform: translateY(0);
}

/* 태블릿 및 데스크탑에서 로그인/로그아웃 버튼 표시 보장 */
@media (min-width: 768px) {
  .login-badge-btn {
    display: inline-flex !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
}

/* 로그인/로그아웃 아이콘 버튼 */
.login-icon-btn {
  display: flex !important;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #374151;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  border-radius: 12px;
  pointer-events: auto;
  position: relative;
  z-index: 30;
}

/* 태블릿 및 데스크탑에서 로그인/로그아웃 버튼 표시 보장 */
@media (min-width: 768px) {
  .login-icon-btn {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
}

.login-icon-btn:hover {
  color: #ff3600;
  background: transparent;
}

.login-icon-btn:active {
  transform: scale(0.95);
}

.login-icon-btn svg {
  width: 20px;
  height: 20px;
}

.management-badge-btn {
  padding: 0.5rem 0.875rem;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.management-badge-btn:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.management-badge-btn-active {
  background: #1d4ed8;
}

.management-badge-btn:active {
  transform: translateY(0);
}

.management-dropdown-panel {
  position: absolute;
  left: 0;
  top: calc(100% + 0.5rem);
  width: 280px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  z-index: 50;
  max-height: 80vh;
  overflow-y: auto;
  animation: dropdownFadeIn 0.2s ease;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.management-dropdown-content {
  padding: 0.5rem;
}

.management-dropdown-section {
  margin-bottom: 0.5rem;
}

.management-dropdown-section:last-child {
  margin-bottom: 0;
}

.management-dropdown-label {
  padding: 0.5rem 0.75rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.management-dropdown-items {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.management-dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0.75rem 0.5rem;
}

.management-dropdown-item {
  display: block;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: #374151;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.15s ease;
  cursor: pointer;
}

.management-dropdown-item:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.management-dropdown-item.router-link-active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 500;
}
</style>
