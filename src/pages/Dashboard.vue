<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>대시보드</h1>
      <p>안녕하세요, {{ user?.email }}님!</p>
    </div>
    
    <div class="dashboard-content">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>총 사용자</h3>
          <p class="stat-number">{{ userCount }}</p>
        </div>
        <div class="stat-card">
          <h3>활성 세션</h3>
          <p class="stat-number">{{ isOnline ? '온라인' : '오프라인' }}</p>
        </div>
        <div class="stat-card">
          <h3>마지막 로그인</h3>
          <p class="stat-number">{{ formatDate(user?.last_sign_in_at) }}</p>
        </div>
      </div>
      
      <div class="actions-grid">
        <div class="action-card">
          <h3>프로필 관리</h3>
          <p>사용자 정보를 확인하고 수정하세요.</p>
          <button class="btn btn-primary">프로필 보기</button>
        </div>
        <div class="action-card">
          <h3>설정</h3>
          <p>애플리케이션 설정을 관리하세요.</p>
          <button class="btn btn-secondary">설정 열기</button>
        </div>
        <div class="action-card">
          <h3>데이터 관리</h3>
          <p>Supabase 데이터베이스와 상호작용하세요.</p>
          <button class="btn btn-secondary">데이터 보기</button>
        </div>
      </div>
      
      <div class="user-info">
        <h3>사용자 정보</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>이메일:</label>
            <span>{{ user?.email }}</span>
          </div>
          <div class="info-item">
            <label>사용자 ID:</label>
            <span>{{ user?.id }}</span>
          </div>
          <div class="info-item">
            <label>가입일:</label>
            <span>{{ formatDate(user?.created_at) }}</span>
          </div>
          <div class="info-item">
            <label>이메일 확인:</label>
            <span :class="{ 'verified': user?.email_confirmed_at, 'unverified': !user?.email_confirmed_at }">
              {{ user?.email_confirmed_at ? '확인됨' : '미확인' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useSupabase } from '../composables/useSupabase'

export default {
  name: 'Dashboard',
  setup() {
    const { user } = useSupabase()
    const userCount = ref(0)
    const isOnline = ref(navigator.onLine)

    const formatDate = (dateString) => {
      if (!dateString) return '정보 없음'
      return new Date(dateString).toLocaleString('ko-KR')
    }

    onMounted(() => {
      // 온라인 상태 감지
      window.addEventListener('online', () => isOnline.value = true)
      window.addEventListener('offline', () => isOnline.value = false)
      
      // 사용자 수 시뮬레이션 (실제로는 Supabase에서 가져와야 함)
      userCount.value = Math.floor(Math.random() * 1000) + 100
    })

    return {
      user,
      userCount,
      isOnline,
      formatDate
    }
  }
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 3rem;
}

.dashboard-header h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.dashboard-header p {
  color: #666;
  font-size: 1.1rem;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  text-align: center;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-card h3 {
  color: #666;
  font-size: 1rem;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: #333;
  margin: 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.action-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.action-card:hover {
  transform: translateY(-5px);
}

.action-card h3 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.action-card p {
  color: #666;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.user-info {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.user-info h3 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item label {
  font-weight: 600;
  color: #666;
  font-size: 0.9rem;
}

.info-item span {
  color: #333;
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 6px;
  word-break: break-all;
}

.verified {
  color: #28a745 !important;
}

.unverified {
  color: #dc3545 !important;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #f8f9fa;
  color: #333;
  border: 2px solid #e1e5e9;
}

.btn-secondary:hover {
  background: #e9ecef;
}

@media (max-width: 768px) {
  .dashboard-header h1 {
    font-size: 2rem;
  }
  
  .stats-grid,
  .actions-grid {
    grid-template-columns: 1fr;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
