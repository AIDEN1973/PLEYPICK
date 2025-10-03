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
        <router-link to="/lego-manager" class="nav-link" v-if="user">레고 관리</router-link>
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
</style>
