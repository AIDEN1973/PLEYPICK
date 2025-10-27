<template>
  <div class="category-management-view">
    <div class="page-header">
      <h1>카테고리 관리 시스템</h1>
      <p>데이터베이스 기반 카테고리 관리 및 자동 처리</p>
    </div>

    <div class="stats-section">
      <div class="stat-card">
        <h3>전체 카테고리</h3>
        <div class="stat-number">{{ categories.length }}</div>
      </div>
      <div class="stat-card">
        <h3>승인 대기</h3>
        <div class="stat-number">{{ pendingCategories.length }}</div>
      </div>
      <div class="stat-card">
        <h3>자동 제안</h3>
        <div class="stat-number">{{ autoStats.autoSuggestions }}</div>
      </div>
    </div>

    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="{ active: activeTab === tab.id }"
        class="tab-button"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="tab-content">
      <!-- 카테고리 관리 -->
      <CategoryManagement v-if="activeTab === 'categories'" />
      
      <!-- 자동 처리 -->
      <div v-if="activeTab === 'auto'" class="auto-processing">
        <div class="section-header">
          <h3>자동 카테고리 처리</h3>
          <div class="actions">
            <button @click="processAllPending" :disabled="isProcessing" class="btn-primary">
              {{ isProcessing ? '처리 중...' : '일괄 처리' }}
            </button>
            <button @click="clearAllPending" class="btn-secondary">
              전체 정리
            </button>
          </div>
        </div>

        <div v-if="pendingItems.length > 0" class="pending-list">
          <div 
            v-for="(item, index) in pendingItems" 
            :key="item.part_num"
            class="pending-item"
          >
            <div class="item-header">
              <span class="part-num">{{ item.part_num }}</span>
              <span class="shape-tag">{{ item.shape_tag }}</span>
              <span class="timestamp">{{ formatTime(item.timestamp) }}</span>
            </div>
            
            <div class="item-content">
              <div class="part-name">{{ item.part_name }}</div>
              
              <!-- 자동 제안 -->
              <div v-if="item.results.suggestions.length > 0" class="suggestions">
                <h4>자동 제안:</h4>
                <div class="suggestion-list">
                  <div 
                    v-for="(suggestion, suggestionIndex) in item.results.suggestions"
                    :key="suggestionIndex"
                    class="suggestion-item"
                  >
                    <div class="suggestion-content">
                      <span class="function">{{ suggestion.function }}</span>
                      <span class="connection">{{ suggestion.connection }}</span>
                      <span class="confidence">신뢰도: {{ Math.round(suggestion.confidence * 100) }}%</span>
                    </div>
                    <div class="suggestion-actions">
                      <button 
                        @click="approveSuggestion(index, suggestionIndex)"
                        class="btn-approve"
                      >
                        승인
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 수동 지정 -->
              <div class="manual-assignment">
                <h4>수동 지정:</h4>
                <div class="assignment-form">
                  <select v-model="item.manualFunction" class="form-select">
                    <option value="">Function 선택</option>
                    <option value="building_block">Building Block</option>
                    <option value="mechanical">Mechanical</option>
                    <option value="connector">Connector</option>
                    <option value="decoration">Decoration</option>
                    <option value="minifigure">Minifigure</option>
                  </select>
                  
                  <select v-model="item.manualConnection" class="form-select">
                    <option value="">Connection 선택</option>
                    <option value="stud_connection">Stud Connection</option>
                    <option value="axle_connection">Axle Connection</option>
                    <option value="ball_connection">Ball Connection</option>
                    <option value="clip_connection">Clip Connection</option>
                  </select>
                  
                  <button 
                    @click="setManualAssignment(index)"
                    :disabled="!item.manualFunction || !item.manualConnection"
                    class="btn-primary"
                  >
                    적용
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <p>처리할 항목이 없습니다.</p>
        </div>
      </div>

      <!-- 통계 -->
      <div v-if="activeTab === 'stats'" class="stats-detail">
        <h3>상세 통계</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <h4>카테고리 타입별 분포</h4>
            <div class="type-distribution">
              <div v-for="(count, type) in categoryTypeStats" :key="type" class="type-item">
                <span class="type-name">{{ type }}</span>
                <span class="type-count">{{ count }}</span>
              </div>
            </div>
          </div>
          
          <div class="stat-item">
            <h4>최근 활동</h4>
            <div class="recent-activity">
              <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
                <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
                <span class="activity-desc">{{ activity.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import CategoryManagement from '@/components/CategoryManagement.vue'
import { useCategoryManagement } from '@/composables/useCategoryManagement'
import { useAutoCategoryHandler } from '@/composables/useAutoCategoryHandler'

const {
  categories,
  pendingCategories,
  fetchCategories
} = useCategoryManagement()

const {
  isProcessing,
  pendingItems,
  processBatchCategories,
  approveAutoSuggestion,
  setManualCategory,
  clearPendingItems,
  getStats
} = useAutoCategoryHandler()

const activeTab = ref('categories')

const tabs = [
  { id: 'categories', label: '카테고리 관리' },
  { id: 'auto', label: '자동 처리' },
  { id: 'stats', label: '통계' }
]

const autoStats = computed(() => getStats())

const categoryTypeStats = computed(() => {
  const stats = {}
  categories.value.forEach(cat => {
    stats[cat.category_type] = (stats[cat.category_type] || 0) + 1
  })
  return stats
})

const recentActivity = ref([
  { id: 1, timestamp: new Date(), description: '새 카테고리 추가됨: baseplate' },
  { id: 2, timestamp: new Date(Date.now() - 300000), description: '자동 매핑 승인: 5개 항목' },
  { id: 3, timestamp: new Date(Date.now() - 600000), description: '카테고리 업데이트: wheel' }
])

onMounted(() => {
  fetchCategories()
})

const processAllPending = async () => {
  // 실제 구현에서는 대기 중인 부품들을 처리
  console.log('일괄 처리 시작')
}

const clearAllPending = () => {
  clearPendingItems()
}

const approveSuggestion = async (itemIndex, suggestionIndex) => {
  await approveAutoSuggestion(itemIndex, suggestionIndex)
}

const setManualAssignment = async (itemIndex) => {
  const item = pendingItems.value[itemIndex]
  const categoryData = {
    function: item.manualFunction,
    connection: item.manualConnection
  }
  
  await setManualCategory(itemIndex, categoryData)
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('ko-KR')
}
</script>

<style scoped>
.category-management-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-header h1 {
  color: #333;
  margin-bottom: 10px;
}

.page-header p {
  color: #666;
  font-size: 16px;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  color: #007bff;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
  margin-bottom: 30px;
}

.tab-button {
  padding: 12px 24px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
}

.tab-button.active {
  border-bottom-color: #007bff;
  color: #007bff;
  font-weight: bold;
}

.auto-processing {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.actions {
  display: flex;
  gap: 10px;
}

.btn-primary, .btn-secondary, .btn-approve {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-approve {
  background: #28a745;
  color: white;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pending-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: #f8f9fa;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.part-num {
  font-weight: bold;
  font-family: monospace;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
}

.shape-tag {
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.timestamp {
  color: #666;
  font-size: 12px;
}

.part-name {
  font-size: 16px;
  margin-bottom: 15px;
  color: #333;
}

.suggestions, .manual-assignment {
  margin-top: 15px;
}

.suggestions h4, .manual-assignment h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #666;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.suggestion-content {
  display: flex;
  gap: 15px;
  align-items: center;
}

.function, .connection {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.confidence {
  color: #666;
  font-size: 12px;
}

.assignment-form {
  display: flex;
  gap: 10px;
  align-items: center;
}

.form-select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.stats-detail {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat-item {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
}

.stat-item h4 {
  margin: 0 0 15px 0;
  color: #333;
}

.type-distribution, .recent-activity {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-item, .activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
}

.type-name {
  font-weight: 500;
}

.type-count {
  background: #007bff;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.activity-time {
  color: #666;
  font-size: 12px;
}

.activity-desc {
  color: #333;
  font-size: 14px;
}
</style>

