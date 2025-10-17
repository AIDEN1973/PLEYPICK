<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-brand">
        <h1>BrickBox</h1>
      </div>
      <div class="nav-links">
        <router-link to="/" class="nav-link">홈</router-link>
        <router-link to="/login" class="nav-link" v-if="!user">로그인</router-link>
        <router-link to="/dashboard" class="nav-link" v-if="user">대시보드</router-link>
        <div v-if="user" class="lego-menu">
          <router-link to="/new-lego" class="nav-link">신규 레고 등록</router-link>
          <router-link to="/saved-lego" class="nav-link">저장된 레고</router-link>
          <router-link to="/element-search" class="nav-link">🔍 Element ID 검색</router-link>
          <router-link to="/metadata-management" class="nav-link">🤖 메타데이터 관리</router-link>
          <router-link to="/store-manager" class="nav-link">매장 관리</router-link>
          <router-link to="/store-management" class="nav-link">🏪 매장 대시보드</router-link>
          <router-link to="/synthetic-dataset" class="nav-link">합성 데이터셋</router-link>
          <router-link to="/hybrid-detection" class="nav-link">부품 검출</router-link>
          <router-link to="/automated-training" class="nav-link">🧠 AI 학습</router-link>
          <router-link to="/monitoring" class="nav-link">📊 모니터링</router-link>
          <router-link to="/model-monitoring" class="nav-link">🤖 모델 모니터링</router-link>
          <router-link to="/system-monitoring" class="nav-link">🔍 시스템 모니터링</router-link>
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

    const logout = async () => {
      await supabase.auth.signOut()
      router.push('/')
    }

    return {
      user,
      logout
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
  
  .main-content {
    padding: 1rem;
  }
}
</style>
