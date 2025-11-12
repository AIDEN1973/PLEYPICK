<template>
  <div class="min-h-screen w-full">
    <!-- 메인 컨텐츠 영역 -->
    <div class="w-full">
      <!-- 상단 헤더 -->
      <header class="bg-white sticky top-0 z-50" style="border-bottom: 1px solid #e5e7eb;">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div class="flex items-center h-16 lg:h-20">
            <!-- 왼쪽: 로고 -->
            <div class="flex items-center flex-1 justify-start">
              <router-link to="/" class="nav-logo flex items-center mr-2 sm:mr-4">
                <span class="text-xl sm:text-2xl font-bold text-gray-800">BrickBox</span>
              </router-link>
            </div>

            <!-- 가운데: 데스크톱/태블릿 메뉴 -->
            <nav class="hidden md:flex gap-3 xl:gap-5 items-center justify-center flex-shrink-0">
                <!-- 검수 메뉴 -->
                <router-link 
                  v-if="user"
                  to="/manual-inspection" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    부품검수
                  </router-link>
                  <router-link 
                    v-if="user"
                    to="/inspection-history" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    검수이력
                  </router-link>
                  <router-link 
                    v-if="user"
                    to="/inspection-notes" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    검수노트
                  </router-link>
                  <router-link 
                    v-if="user"
                    to="/part-to-set-search" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    부품으로 세트찾기
                  </router-link>
                  <router-link 
                    v-if="user"
                    to="/missing-parts" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    누락부품
                  </router-link>
                  <router-link 
                    v-if="user"
                    to="/set-parts" 
                    class="nav-menu-link text-base xl:text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none whitespace-nowrap"
                    active-class="nav-menu-active"
                  >
                    세트부품
                  </router-link>

                  <!-- 관리 드롭다운 -->
                  <div v-if="user && isAdmin" class="relative" ref="managementDropdown">
                    <button
                      @click="showManagementMenu = !showManagementMenu"
                      class="text-sm xl:text-base font-bold text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      관리
                      <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2"
                        viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </button>
                    <div
                      v-if="showManagementMenu"
                      class="absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[80vh] overflow-y-auto"
                    >
                      <div class="p-2">
                        <div class="mb-2">
                          <div class="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">레고 관리</div>
                          <router-link to="/new-lego" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">신규 레고 등록</router-link>
                          <router-link to="/saved-lego" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">저장된 레고</router-link>
                        </div>
                        <div class="mb-2">
                          <div class="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">데이터셋</div>
                          <router-link to="/synthetic-dataset" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">합성 데이터셋</router-link>
                        </div>
                        <div class="mb-2">
                          <div class="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">AI 학습</div>
                          <router-link to="/automated-training" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">AI 학습</router-link>
                        </div>
                        <div class="mb-2">
                          <div class="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">검출</div>
                          <router-link to="/hybrid-detection" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">부품 검출</router-link>
                        </div>
                        <div class="mb-2">
                          <div class="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">자동 복구</div>
                          <router-link to="/synthetic-dataset" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">합성 데이터셋 관리</router-link>
                          <a href="#" @click.prevent="openAutoRecoveryStatus" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">자동 복구 상태</a>
                          <a href="#" @click.prevent="openPortManagement" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">포트 관리</a>
                          <a href="#" @click.prevent="openSystemMonitoring" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">시스템 모니터링</a>
                        </div>
                        <div class="mb-2">
                          <div class="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">시스템 관리</div>
                          <router-link to="/dashboard" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">대시보드</router-link>
                          <router-link to="/element-search" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Element ID 검색</router-link>
                          <router-link to="/metadata-management" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">메타데이터 관리</router-link>
                          <router-link to="/render-optimization" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">렌더링 최적화</router-link>
                          <router-link to="/dataset-converter" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">데이터셋 변환</router-link>
                          <router-link to="/store-manager" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">매장 관리</router-link>
                          <router-link to="/store-management" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">매장 대시보드</router-link>
                          <router-link to="/monitoring" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">모니터링</router-link>
                          <router-link to="/model-monitoring" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">모델 모니터링</router-link>
                          <router-link to="/system-monitoring" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">시스템 모니터링</router-link>
                          <router-link to="/quality-healing" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">품질 회복 대시보드</router-link>
                          <router-link to="/category-management" @click="showManagementMenu = false" class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">카테고리 관리</router-link>
                        </div>
                      </div>
                    </div>
                  </div>
            </nav>

            <!-- 가운데: 모바일 메뉴 (휴대폰만) -->
            <div v-if="user" class="md:hidden flex items-center justify-center flex-shrink-0 mobile-menu-container">
              <router-link 
                to="/manual-inspection" 
                class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline"
                :class="{ 'text-blue-600': isActiveRoute('/manual-inspection') }"
              >
                검수시작
              </router-link>
              <router-link 
                to="/inspection-history" 
                class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors whitespace-nowrap no-underline"
                :class="{ 'text-blue-600': isActiveRoute('/inspection-history') }"
              >
                검수이력
              </router-link>
              <div class="relative" ref="mobileMenuDropdown">
                <button
                  @click.prevent="handleMobileMenuClick"
                  class="px-3 py-2 text-sm font-bold text-gray-800 transition-colors flex items-center gap-1 whitespace-nowrap no-underline mobile-menu-button"
                  type="button"
                  ref="mobileMenuButton"
                >
                  더보기
                  <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2"
                    viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                <div
                  v-if="showMobileMenu"
                  ref="mobileDropdownContent"
                  class="mobile-dropdown-menu"
                >
                  <router-link 
                    to="/inspection-notes" 
                    @click="showMobileMenu = false"
                    class="mobile-dropdown-item"
                    :class="{ 'mobile-dropdown-item-active': isActiveRoute('/inspection-notes') }"
                  >
                    검수노트
                  </router-link>
                  <router-link 
                    to="/part-to-set-search" 
                    @click="showMobileMenu = false"
                    class="mobile-dropdown-item"
                    :class="{ 'mobile-dropdown-item-active': isActiveRoute('/part-to-set-search') }"
                  >
                    부품으로 세트찾기
                  </router-link>
                  <router-link 
                    to="/missing-parts" 
                    @click="showMobileMenu = false"
                    class="mobile-dropdown-item"
                    :class="{ 'mobile-dropdown-item-active': isActiveRoute('/missing-parts') }"
                  >
                    누락부품
                  </router-link>
                  <router-link 
                    to="/set-parts" 
                    @click="showMobileMenu = false"
                    class="mobile-dropdown-item"
                    :class="{ 'mobile-dropdown-item-active': isActiveRoute('/set-parts') }"
                  >
                    세트부품
                  </router-link>
                  <div v-if="isAdmin" class="mobile-dropdown-divider">
                    <div class="mobile-dropdown-label">관리</div>
                    <router-link 
                      to="/dashboard" 
                      @click="showMobileMenu = false"
                      class="mobile-dropdown-item mobile-dropdown-item-sub"
                    >
                      대시보드
                    </router-link>
                    <router-link 
                      to="/synthetic-dataset" 
                      @click="showMobileMenu = false"
                      class="mobile-dropdown-item mobile-dropdown-item-sub"
                    >
                      합성 데이터셋
                    </router-link>
                    <router-link 
                      to="/automated-training" 
                      @click="showMobileMenu = false"
                      class="mobile-dropdown-item mobile-dropdown-item-sub"
                    >
                      AI 학습
                    </router-link>
                  </div>
                </div>
              </div>
            </div>

            <!-- 오른쪽: 계정 메뉴 -->
            <div class="flex items-center gap-2 lg:gap-4 flex-1 justify-end">
              <router-link v-if="!user" to="/login" class="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap">로그인</router-link>
              <div v-else class="relative" ref="userMenuDropdown">
                <!-- // 🔧 수정됨: 계정 메뉴 -->
                <button
                  @click="showUserMenu = !showUserMenu"
                  class="account-menu-trigger header-icon-tooltip"
                  data-tooltip="계정메뉴"
                  type="button"
                >
                  <!-- 사용자 아이콘 -->
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </button>

                <div
                  v-if="showUserMenu"
                  class="account-dropdown-panel"
                >
                  <div class="account-dropdown-header">
                    <div class="account-dropdown-name">BrickBox</div>
                    <div class="account-dropdown-email">{{ user?.email || '사용자' }}</div>
                  </div>

                  <button
                    @click="showUserMenu = false"
                    class="account-dropdown-item"
                    type="button"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>
                    </svg>
                    정보수정
                  </button>

                  <div class="account-dropdown-divider"></div>

                  <button
                    @click="logout"
                    class="account-dropdown-item account-dropdown-item-danger"
                    type="button"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16,17 21,12 16,7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    로그아웃
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- 콘텐츠 -->
      <main :class="['flex-1', isSystemMonitoringRoute ? 'p-0 bg-transparent' : 'p-4 sm:p-6 bg-gray-50']">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSupabase } from './composables/useSupabase'

export default {
  name: 'App',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const { supabase, user } = useSupabase()
    const showManagementMenu = ref(false)
    const isAdmin = ref(false)
    const managementDropdown = ref(null)
    const showUserMenu = ref(false)
    const userMenuDropdown = ref(null)
    const showMobileMenu = ref(false)
    const mobileMenuDropdown = ref(null)
    const mobileMenuButton = ref(null)
    const mobileDropdownContent = ref(null)

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
      if (mobileMenuDropdown.value) {
        const isClickInside = mobileMenuDropdown.value.contains(event.target)
        console.log('=== Click Outside Check ===')
        console.log('Click target:', event.target)
        console.log('mobileMenuDropdown element:', mobileMenuDropdown.value)
        console.log('Is click inside mobileMenuDropdown:', isClickInside)
        console.log('Current showMobileMenu:', showMobileMenu.value)
        
        if (!isClickInside) {
          console.log('Closing mobile menu due to outside click')
          showMobileMenu.value = false
        } else {
          console.log('Click is inside mobile menu, keeping it open')
        }
      }
    }

    const checkAdminRole = async () => {
      if (!user.value) {
        isAdmin.value = false
        return
      }

      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('id, role, is_active, email')
          .eq('email', user.value.email)
          .eq('is_active', true)
          .maybeSingle()

        if (error) {
          console.error('관리자 권한 확인 실패:', error)
          isAdmin.value = false
          return
        }

        if (!data) {
          isAdmin.value = false
          return
        }

        isAdmin.value = data.role === 'admin' || data.role === 'super_admin'
      } catch (err) {
        console.error('관리자 권한 확인 오류:', err)
        isAdmin.value = false
      }
    }

    watch(user, (newUser) => {
      if (newUser) {
        checkAdminRole()
      } else {
        isAdmin.value = false
      }
    }, { immediate: true })

    onMounted(() => {
      if (user.value) {
        checkAdminRole()
      }
      document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    const logout = async () => {
      showUserMenu.value = false
      await supabase.auth.signOut()
      router.push('/')
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
      user,
      isAdmin,
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
      isSystemMonitoringRoute
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
  color: #2563eb;
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
  color: #2563eb;
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
}

.nav-menu-link {
  text-decoration: none;
}

.nav-menu-link.nav-menu-active {
  color: #2563eb;
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
  color: #2563eb;
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
  width: 260px;
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

@media (max-width: 767px) {
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
    flex-wrap: nowrap;
    overflow: hidden;
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

  /* 모바일 메뉴 간격 줄이기 */
  .mobile-menu-container {
    gap: 0.125rem !important;
    overflow: visible !important;
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
  color: #2563eb;
}

.mobile-dropdown-item-active {
  color: #2563eb;
  background-color: #f9fafb;
}

.mobile-dropdown-item-sub {
  font-weight: 400;
  color: #374151;
}

.mobile-dropdown-item-sub:hover {
  color: #2563eb;
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
.mobile-dropdown-enter-active,
.mobile-dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.mobile-dropdown-enter-from {
  opacity: 0;
  transform: translateY(-0.5rem);
}

.mobile-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}
</style>
