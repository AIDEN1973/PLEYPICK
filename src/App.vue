<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-brand">
        <h1>BrickBox</h1>
      </div>
      <div class="nav-links">
        <router-link to="/login" class="nav-link" v-if="!user">로그인</router-link>
        <div v-if="user" class="lego-menu">
          <router-link to="/new-lego" class="nav-link">신규 레고 등록</router-link>
          <router-link to="/saved-lego" class="nav-link">저장된 레고</router-link>
          <router-link to="/synthetic-dataset" class="nav-link">합성 데이터셋</router-link>
          <router-link to="/synthetic-uploader" class="nav-link">📁 합성 이미지 업로드</router-link>
          <router-link to="/failed-uploads" class="nav-link">📤 실패 업로드 관리</router-link>
          <router-link to="/automated-training" class="nav-link">🧠 AI 학습</router-link>
          <router-link to="/hybrid-detection" class="nav-link">부품 검출</router-link>
          
          <!-- 자동 복구 시스템 메뉴 -->
          <div class="dropdown-menu" @mouseenter="handleAutoRecoveryEnter" @mouseleave="handleAutoRecoveryLeave">
            <button class="nav-link dropdown-toggle">
              🛡️ 자동 복구
              <span class="dropdown-arrow">▼</span>
            </button>
            <div class="dropdown-content" v-show="showAutoRecoveryMenu" @mouseenter="handleAutoRecoveryEnter" @mouseleave="handleAutoRecoveryLeave">
              <router-link to="/synthetic-dataset" class="dropdown-item">📊 합성 데이터셋 관리</router-link>
              <a href="#" @click.prevent="openAutoRecoveryStatus" class="dropdown-item">🔍 자동 복구 상태</a>
              <a href="#" @click.prevent="openPortManagement" class="dropdown-item">🔌 포트 관리</a>
              <a href="#" @click.prevent="openSystemMonitoring" class="dropdown-item">📈 시스템 모니터링</a>
            </div>
          </div>
          
          <!-- 관리 메뉴 드롭다운 -->
          <div class="dropdown-menu" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
            <button class="nav-link dropdown-toggle">
              🛠️ 관리
              <span class="dropdown-arrow">▼</span>
            </button>
            <div class="dropdown-content" v-show="showManagementMenu" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
              <router-link to="/dashboard" class="dropdown-item">📊 대시보드</router-link>
              <router-link to="/element-search" class="dropdown-item">🔍 Element ID 검색</router-link>
              <router-link to="/metadata-management" class="dropdown-item">🤖 메타데이터 관리</router-link>
              <router-link to="/render-optimization" class="dropdown-item">🚀 렌더링 최적화</router-link>
              <router-link to="/dataset-converter" class="dropdown-item">📊 데이터셋 변환</router-link>
              <router-link to="/store-manager" class="dropdown-item">매장 관리</router-link>
              <router-link to="/store-management" class="dropdown-item">🏪 매장 대시보드</router-link>
              <router-link to="/monitoring" class="dropdown-item">📊 모니터링</router-link>
              <router-link to="/model-monitoring" class="dropdown-item">🤖 모델 모니터링</router-link>
              <router-link to="/system-monitoring" class="dropdown-item">🔍 시스템 모니터링</router-link>
              <router-link to="/quality-healing" class="dropdown-item">📊 품질 회복 대시보드</router-link>
              <router-link to="/category-management" class="dropdown-item">🏷️ 카테고리 관리</router-link>
            </div>
          </div>
        </div>
        <button @click="logout" class="nav-link logout-btn" v-if="user">로그아웃</button>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from './composables/useSupabase'

export default {
  name: 'App',
  setup() {
    const router = useRouter()
    const { supabase, user } = useSupabase()
    const showManagementMenu = ref(false)
    const showAutoRecoveryMenu = ref(false)
    let closeTimer = null
    let autoRecoveryCloseTimer = null

    const logout = async () => {
      await supabase.auth.signOut()
      router.push('/')
    }

    const handleMouseEnter = () => {
      if (closeTimer) {
        clearTimeout(closeTimer)
        closeTimer = null
      }
      showManagementMenu.value = true
    }

    const handleMouseLeave = () => {
      closeTimer = setTimeout(() => {
        showManagementMenu.value = false
      }, 150) // 150ms 지연
    }

    const handleAutoRecoveryEnter = () => {
      if (autoRecoveryCloseTimer) {
        clearTimeout(autoRecoveryCloseTimer)
        autoRecoveryCloseTimer = null
      }
      showAutoRecoveryMenu.value = true
    }

    const handleAutoRecoveryLeave = () => {
      autoRecoveryCloseTimer = setTimeout(() => {
        showAutoRecoveryMenu.value = false
      }, 150) // 150ms 지연
    }

    const openAutoRecoveryStatus = () => {
      // 합성 데이터셋 페이지로 이동하고 자동 복구 상태 섹션으로 스크롤
      router.push('/synthetic-dataset')
      setTimeout(() => {
        const element = document.querySelector('.auto-recovery-panel')
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' })
        }
      }, 500)
    }

    const openPortManagement = () => {
      // 포트 관리 페이지로 이동
      router.push('/port-management')
    }

    const openSystemMonitoring = () => {
      // 시스템 모니터링 페이지로 이동
      router.push('/system-monitoring')
    }

    return {
      user,
      logout,
      showManagementMenu,
      showAutoRecoveryMenu,
      handleMouseEnter,
      handleMouseLeave,
      handleAutoRecoveryEnter,
      handleAutoRecoveryLeave,
      openAutoRecoveryStatus,
      openPortManagement,
      openSystemMonitoring
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f5f5f5;
}

#app {
  min-height: 100vh;
}

.navbar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.nav-brand h1 {
  font-size: 1.5rem;
  font-weight: 600;
}

.nav-links {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.lego-menu {
  display: flex;
  gap: 0.5rem;
  position: relative;
}

.lego-menu::before {
  content: '';
  position: absolute;
  left: -0.5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 20px;
  background: rgba(255,255,255,0.3);
}

.lego-menu .nav-link {
  font-size: 0.9rem;
  padding: 0.4rem 0.8rem;
}

.nav-link {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.nav-link:hover {
  background-color: rgba(255,255,255,0.1);
}

.logout-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: inherit;
}

/* 드롭다운 메뉴 스타일 */
.dropdown-menu {
  position: relative;
  display: inline-block;
}

.dropdown-toggle {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: inherit;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.dropdown-toggle:hover {
  background-color: rgba(255,255,255,0.1);
}

.dropdown-arrow {
  font-size: 0.7rem;
  transition: transform 0.2s;
}

.dropdown-menu:hover .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-radius: 8px;
  z-index: 1000;
  overflow: hidden;
  margin-top: 0.5rem;
}

.dropdown-item {
  display: block;
  color: #333;
  text-decoration: none;
  padding: 0.75rem 1rem;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
  color: #667eea;
}

.main-content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .navbar {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .nav-links {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .lego-menu {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .dropdown-content {
    position: static;
    box-shadow: none;
    background: rgba(255,255,255,0.1);
    margin-top: 0;
    border-radius: 0;
  }
  
  .dropdown-item {
    color: white;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  
  .dropdown-item:hover {
    background-color: rgba(255,255,255,0.1);
    color: white;
  }
  
  .main-content {
    padding: 1rem;
  }
}
</style>
