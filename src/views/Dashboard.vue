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
          <h3>신규 레고 등록</h3>
          <p>Rebrickable API를 통해 새로운 레고 세트를 검색하고 등록하세요.</p>
          <router-link to="/new-lego" class="btn btn-primary">신규 등록</router-link>
        </div>
        <div class="action-card">
          <h3>저장된 레고 관리</h3>
          <p>데이터베이스에 저장된 레고 세트들을 관리하세요.</p>
          <router-link to="/saved-lego" class="btn btn-secondary">저장된 레고</router-link>
        </div>
        <div class="action-card">
          <h3>실시간 부품 검수</h3>
          <p>AI 기반 실시간 부품 검수 시스템을 사용하세요.</p>
          <router-link to="/detection" class="btn btn-success">검수 시작</router-link>
        </div>
        <div class="action-card">
          <h3>통합 비전 검수</h3>
          <p>마스터 DB와 통합된 최적화된 비전 검수 시스템을 사용하세요.</p>
          <router-link to="/integrated-vision" class="btn btn-info">통합 검수</router-link>
        </div>
        <div class="action-card">
          <h3>마스터 데이터 구축</h3>
          <p>Rebrickable API에서 부품을 수집하고 LLM으로 분석하여 마스터 데이터베이스를 구축하세요.</p>
          <router-link to="/master-builder" class="btn btn-warning">데이터 구축</router-link>
        </div>
        <div class="action-card">
          <h3>합성 데이터셋 생성</h3>
          <p>LDraw 3D 모델을 Blender로 렌더링하여 AI 학습용 대규모 합성 데이터셋을 자동 생성하세요.</p>
          <router-link to="/synthetic-dataset" class="btn btn-purple">합성 데이터셋</router-link>
        </div>
        <div class="action-card">
          <h3>프로필 관리</h3>
          <p>사용자 정보를 확인하고 수정하세요.</p>
          <button class="btn btn-secondary">프로필 보기</button>
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

.btn-success {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
}

.btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
}

.btn-info {
  background: linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%);
  color: white;
}

.btn-info:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(23, 162, 184, 0.4);
}

.btn-warning {
  background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
  color: white;
}

.btn-warning:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 193, 7, 0.4);
}

.btn-purple {
  background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
  color: white;
}

.btn-purple:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(111, 66, 193, 0.4);
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
