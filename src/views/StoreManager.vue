<template>
  <div class="store-manager">
    <div class="store-header">
      <h1>🏪 매장 관리 시스템</h1>
      <div class="store-info">
        <span class="store-name">{{ storeName }}</span>
        <span class="store-id">매장 ID: {{ storeId }}</span>
      </div>
    </div>

    <div class="store-dashboard">
      <!-- 빠른 액션 버튼들 -->
      <div class="quick-actions">
        <h2>빠른 작업</h2>
        <div class="action-grid">
          <router-link to="/integrated-vision" class="action-card primary">
            <div class="action-icon">📷</div>
            <h3>부품 검수</h3>
            <p>고객이 가져온 레고 부품 인식</p>
          </router-link>
          
          <router-link to="/detection" class="action-card secondary">
            <div class="action-icon">🔍</div>
            <h3>실시간 감지</h3>
            <p>카메라로 실시간 부품 감지</p>
          </router-link>
          
          <div class="action-card info" @click="showInventory">
            <div class="action-icon">📦</div>
            <h3>재고 현황</h3>
            <p>매장 재고 및 부품 현황</p>
          </div>
          
          <div class="action-card success" @click="showReports">
            <div class="action-icon">📊</div>
            <h3>매장 리포트</h3>
            <p>일일/주간 매장 성과</p>
          </div>
        </div>
      </div>

      <!-- 최근 활동 -->
      <div class="recent-activity">
        <h2>최근 활동</h2>
        <div class="activity-list">
          <div v-for="activity in recentActivities" :key="activity.id" class="activity-item">
            <div class="activity-time">{{ formatTime(activity.timestamp) }}</div>
            <div class="activity-content">
              <span class="activity-type">{{ activity.type }}</span>
              <span class="activity-detail">{{ activity.detail }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 매장 통계 -->
      <div class="store-stats">
        <h2>매장 통계</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">{{ todayProcessed }}</div>
            <div class="stat-label">오늘 처리된 부품</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ accuracy }}%</div>
            <div class="stat-label">인식 정확도</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ avgProcessingTime }}ms</div>
            <div class="stat-label">평균 처리 시간</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ customerSatisfaction }}%</div>
            <div class="stat-label">고객 만족도</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 재고 현황 모달 -->
    <div v-if="showInventoryModal" class="modal-overlay" @click="closeInventory">
      <div class="modal-content" @click.stop>
        <h3>매장 재고 현황</h3>
        <div class="inventory-grid">
          <div v-for="item in inventoryItems" :key="item.id" class="inventory-item">
            <div class="item-name">{{ item.name }}</div>
            <div class="item-quantity">{{ item.quantity }}개</div>
            <div class="item-status" :class="item.status">{{ item.statusText }}</div>
          </div>
        </div>
        <button @click="closeInventory" class="close-btn">닫기</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

// 매장 정보
const storeName = ref('강남점')
const storeId = ref('STORE-001')

// 매장 통계
const todayProcessed = ref(45)
const accuracy = ref(92)
const avgProcessingTime = ref(1850)
const customerSatisfaction = ref(88)

// 최근 활동
const recentActivities = ref([
  {
    id: 1,
    type: '부품 검수',
    detail: '76917 세트 부품 3개 인식 완료',
    timestamp: new Date(Date.now() - 5 * 60 * 1000)
  },
  {
    id: 2,
    type: '고객 상담',
    detail: '부품 교체 요청 처리',
    timestamp: new Date(Date.now() - 15 * 60 * 1000)
  },
  {
    id: 3,
    type: '재고 업데이트',
    detail: '3024 부품 10개 입고',
    timestamp: new Date(Date.now() - 30 * 60 * 1000)
  }
])

// 재고 현황
const showInventoryModal = ref(false)
const inventoryItems = ref([
  { id: 1, name: '3024 Brick 2x4', quantity: 150, status: 'good', statusText: '충분' },
  { id: 2, name: '3023 Plate 2x2', quantity: 5, status: 'low', statusText: '부족' },
  { id: 3, name: '2420 Plate 1x2', quantity: 25, status: 'good', statusText: '충분' },
  { id: 4, name: '49307 Tile 1x1', quantity: 2, status: 'critical', statusText: '매우 부족' }
])

// 함수들
const showInventory = () => {
  showInventoryModal.value = true
}

const closeInventory = () => {
  showInventoryModal.value = false
}

const showReports = () => {
  alert('매장 리포트 기능은 준비 중입니다.')
}

const formatTime = (timestamp) => {
  const now = new Date()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  return `${hours}시간 전`
}

onMounted(() => {
  console.log('매장 관리 시스템 로드됨')
})
</script>

<style scoped>
.store-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.store-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  border-radius: 15px;
  margin-bottom: 30px;
  text-align: center;
}

.store-header h1 {
  font-size: 2.5rem;
  margin-bottom: 15px;
}

.store-info {
  display: flex;
  justify-content: center;
  gap: 30px;
  font-size: 1.1rem;
}

.store-name {
  font-weight: bold;
  font-size: 1.3rem;
}

.store-dashboard {
  display: grid;
  gap: 30px;
}

.quick-actions h2,
.recent-activity h2,
.store-stats h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.action-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 5px solid;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 15px rgba(0,0,0,0.15);
}

.action-card.primary {
  border-left-color: #2196F3;
}

.action-card.secondary {
  border-left-color: #9C27B0;
}

.action-card.info {
  border-left-color: #00BCD4;
}

.action-card.success {
  border-left-color: #4CAF50;
}

.action-icon {
  font-size: 2.5rem;
  margin-bottom: 15px;
}

.action-card h3 {
  font-size: 1.3rem;
  margin-bottom: 10px;
  color: #333;
}

.action-card p {
  color: #666;
  font-size: 0.95rem;
}

.recent-activity {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.activity-time {
  color: #666;
  font-size: 0.9rem;
  min-width: 80px;
}

.activity-content {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.activity-type {
  font-weight: bold;
  color: #2196F3;
}

.activity-detail {
  color: #333;
}

.store-stats {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: #2196F3;
  margin-bottom: 10px;
}

.stat-label {
  color: #666;
  font-size: 0.95rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 15px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin-bottom: 20px;
  color: #333;
}

.inventory-grid {
  display: grid;
  gap: 15px;
  margin-bottom: 20px;
}

.inventory-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 15px;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.item-name {
  font-weight: bold;
  color: #333;
}

.item-quantity {
  text-align: center;
  font-weight: bold;
  color: #2196F3;
}

.item-status {
  text-align: center;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.9rem;
  font-weight: bold;
}

.item-status.good {
  background: #d4edda;
  color: #155724;
}

.item-status.low {
  background: #fff3cd;
  color: #856404;
}

.item-status.critical {
  background: #f8d7da;
  color: #721c24;
}

.close-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
}

.close-btn:hover {
  background: #5a6268;
}

@media (max-width: 768px) {
  .store-info {
    flex-direction: column;
    gap: 10px;
  }
  
  .action-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
