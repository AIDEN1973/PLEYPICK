<template>
  <div class="home">
    <div class="hero">
      <h1>BrickBox에 오신 것을 환영합니다!</h1>
      <p>Vue.js와 Supabase로 구축된 현대적인 웹 애플리케이션입니다.</p>
      <div class="cta-buttons">
        <router-link to="/login" class="btn btn-primary">시작하기</router-link>
        <router-link to="/dashboard" class="btn btn-secondary" v-if="user">대시보드로 이동</router-link>
      </div>
    </div>
    
    <div class="features">
      <div class="feature-card">
        <h3>🚀 빠른 개발</h3>
        <p>Vue.js의 반응형 시스템으로 빠르고 효율적인 개발이 가능합니다.</p>
      </div>
      <div class="feature-card">
        <h3>🔐 안전한 인증</h3>
        <p>Supabase의 강력한 인증 시스템으로 사용자 데이터를 안전하게 보호합니다.</p>
      </div>
      <div class="feature-card">
        <h3>📱 반응형 디자인</h3>
        <p>모든 디바이스에서 완벽하게 작동하는 반응형 사용자 인터페이스입니다.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { useSupabase } from '../composables/useSupabase'

export default {
  name: 'Home',
  setup() {
    const { user } = useSupabase()
    
    return {
      user
    }
  }
}
</script>

<style scoped>
.home {
  text-align: center;
}

.hero {
  padding: 4rem 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

.hero p {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 2rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s;
  display: inline-block;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-primary:hover {
  background: #f8f9fa;
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255,255,255,0.2);
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background: white;
  color: #667eea;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.feature-card p {
  color: #666;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }
  
  .cta-buttons {
    flex-direction: column;
    align-items: center;
  }
}
</style>
