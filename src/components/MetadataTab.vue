<template>
  <div class="metadata-tab">
    <!-- 통계 -->
    <div class="stats-section">
      <div class="stat-card completed">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-label">완료</div>
          <div class="stat-value">{{ stats.completed || 0 }}</div>
        </div>
      </div>
      <div class="stat-card error">
        <div class="stat-icon">⚠️</div>
        <div class="stat-content">
          <div class="stat-label">오류</div>
          <div class="stat-value">{{ stats.error || 0 }}</div>
        </div>
      </div>
      <div class="stat-card missing">
        <div class="stat-icon">❌</div>
        <div class="stat-content">
          <div class="stat-label">없음</div>
          <div class="stat-value">{{ stats.missing || 0 }}</div>
        </div>
      </div>
      <div class="stat-card progress">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-label">진행률</div>
          <div class="stat-value">{{ progressPercentage }}%</div>
        </div>
      </div>
    </div>

    <!-- 필터 및 검색 -->
    <div class="filter-section">
      <input 
        v-model="searchQuery" 
        type="text" 
        placeholder="🔍 Part ID 또는 이름 검색..."
        class="search-input"
        @input="handleSearch"
      />
      <div class="filter-buttons">
        <button 
          :class="['filter-btn', { active: statusFilter === 'all' }]"
          @click="statusFilter = 'all'"
        >
          전체 ({{ totalCount }})
        </button>
        <button 
          :class="['filter-btn', { active: statusFilter === 'completed' }]"
          @click="statusFilter = 'completed'"
        >
          완료 ({{ stats.completed || 0 }})
        </button>
        <button 
          :class="['filter-btn', { active: statusFilter === 'error' }]"
          @click="statusFilter = 'error'"
        >
          오류 ({{ stats.error || 0 }})
        </button>
        <button 
          :class="['filter-btn', { active: statusFilter === 'missing' }]"
          @click="statusFilter = 'missing'"
        >
          없음 ({{ stats.missing || 0 }})
        </button>
      </div>
    </div>

    <!-- 테이블 -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th width="50">
              <input 
                type="checkbox" 
                v-model="selectAll"
                @change="toggleSelectAll"
              />
            </th>
            <th width="80">ID</th>
            <th width="120">Part ID</th>
            <th width="150">색상</th>
            <th>Feature Text</th>
            <th width="100">상태</th>
            <th width="80">품질</th>
            <th width="150">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="loading-cell">
              <div class="spinner"></div>
              로딩 중...
            </td>
          </tr>
          <tr v-else-if="filteredItems.length === 0">
            <td colspan="8" class="empty-cell">
              데이터가 없습니다
            </td>
          </tr>
          <tr v-else v-for="item in paginatedItems" :key="item.id">
            <td>
              <input 
                type="checkbox" 
                :value="item.id"
                v-model="selectedIds"
              />
            </td>
            <td>{{ item.id }}</td>
            <td class="part-id">{{ item.part_id }}</td>
            <td>
              <div class="color-cell">
                <div 
                  class="color-box" 
                  :style="{ backgroundColor: item.color_rgb || '#ccc' }"
                ></div>
                {{ item.color_name || 'N/A' }}
              </div>
            </td>
            <td class="feature-text">
              {{ item.feature_text || '없음' }}
            </td>
            <td>
              <span :class="['status-badge', item.metadata_status]">
                {{ getStatusLabel(item.metadata_status) }}
              </span>
            </td>
            <td class="quality-score">
              {{ item.quality_score ? item.quality_score.toFixed(2) : '-' }}
            </td>
            <td>
              <div class="action-buttons">
                <button 
                  v-if="item.metadata_status === 'completed'"
                  class="btn-view"
                  @click="viewMetadata(item)"
                  title="보기"
                >
                  👁️
                </button>
                <button 
                  v-else
                  class="btn-generate"
                  @click="generateMetadata([item.id])"
                  :disabled="generating"
                  title="생성"
                >
                  🔄
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 페이지네이션 -->
    <div class="pagination">
      <button 
        @click="currentPage--" 
        :disabled="currentPage === 1"
        class="page-btn"
      >
        ← 이전
      </button>
      <span class="page-info">
        {{ currentPage }} / {{ totalPages }}
      </span>
      <button 
        @click="currentPage++" 
        :disabled="currentPage >= totalPages"
        class="page-btn"
      >
        다음 →
      </button>
    </div>

    <!-- 일괄 작업 -->
    <div class="bulk-actions">
      <button 
        class="btn-bulk"
        @click="generateMetadata(selectedIds)"
        :disabled="selectedIds.length === 0 || generating"
      >
        선택 항목 생성 ({{ selectedIds.length }})
      </button>
      <button 
        class="btn-bulk error"
        @click="retryErrors"
        :disabled="generating"
      >
        오류 전체 재시도 ({{ stats.error || 0 }})
      </button>
      <button 
        class="btn-bulk missing"
        @click="generateMissing"
        :disabled="generating"
      >
        없음 전체 생성 ({{ stats.missing || 0 }})
      </button>
    </div>

    <!-- 메타데이터 상세 모달 -->
    <div v-if="showModal" class="modal-overlay" @click="showModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📝 메타데이터 상세</h3>
          <button @click="showModal = false" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <strong>Part ID:</strong> {{ selectedItem?.part_id }}
          </div>
          <div class="detail-row">
            <strong>색상:</strong> {{ selectedItem?.color_name }}
          </div>
          <div class="detail-row">
            <strong>Feature Text:</strong>
            <p class="detail-text">{{ selectedItem?.feature_json?.feature_text || selectedItem?.feature_text }}</p>
          </div>
          <div class="detail-row">
            <strong>Recognition Hints:</strong>
            <pre class="detail-json">{{ JSON.stringify(selectedItem?.feature_json?.recognition_hints, null, 2) }}</pre>
          </div>
          <div class="detail-row">
            <strong>Feature JSON:</strong>
            <pre class="detail-json">{{ JSON.stringify(selectedItem?.feature_json, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useBackgroundLLMAnalysis } from '../composables/useBackgroundLLMAnalysis'

const { supabase } = useSupabase()
const { startBackgroundAnalysis } = useBackgroundLLMAnalysis()

// 상태
const loading = ref(false)
const generating = ref(false)
const items = ref([])
const stats = ref({})
const searchQuery = ref('')
const statusFilter = ref('all')
const selectedIds = ref([])
const selectAll = ref(false)
const currentPage = ref(1)
const itemsPerPage = 10
const showModal = ref(false)
const selectedItem = ref(null)

// 계산된 속성
const totalCount = computed(() => {
  return (stats.value.completed || 0) + (stats.value.error || 0) + (stats.value.missing || 0)
})

const progressPercentage = computed(() => {
  const total = totalCount.value
  if (total === 0) return 0
  return Math.round((stats.value.completed || 0) * 100 / total)
})

const filteredItems = computed(() => {
  let result = items.value

  // 상태 필터
  if (statusFilter.value !== 'all') {
    result = result.filter(item => item.metadata_status === statusFilter.value)
  }

  // 검색
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item => 
      item.part_id?.toLowerCase().includes(query) ||
      item.part_name?.toLowerCase().includes(query)
    )
  }

  return result
})

const totalPages = computed(() => {
  return Math.ceil(filteredItems.value.length / itemsPerPage)
})

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredItems.value.slice(start, end)
})

// 메서드
const loadData = async () => {
  loading.value = true
  try {
    // 통계 로드
    const { data: statsData, error: statsError } = await supabase.rpc('get_metadata_stats')
    if (statsError) {
      console.error('통계 로드 실패:', statsError)
    } else if (statsData) {
      // RPC 함수는 JSON 객체를 반환 (배열이 아님)
      stats.value = {
        total: statsData.total || 0,
        completed: statsData.completed || 0,
        missing: statsData.missing || 0,
        error: statsData.error || 0,
        completion_rate: statsData.completion_rate || 0
      }
    }

    // ✅ 최적화: 데이터 로드 (limit 증가: 500 → 1000)
    const { data, error } = await supabase
      .from('v_metadata_status')
      .select('*')
      .order('id', { ascending: false })
      .limit(1000)
    
    if (error) throw error
    items.value = data || []
  } catch (error) {
    console.error('데이터 로드 실패:', error)
    alert('데이터를 불러오는데 실패했습니다')
  } finally {
    loading.value = false
  }
}

const generateMetadata = async (ids) => {
  if (ids.length === 0) return
  
  generating.value = true
  try {
    console.log('[DEBUG] generateMetadata 호출:', ids)
    
    // 선택된 항목들의 상세 정보 가져오기
    const { data: partsData, error: fetchError } = await supabase
      .from('parts_master_features')
      .select('id, part_id, part_name, color_id')
      .in('id', ids)
    
    if (fetchError) {
      console.error('[ERROR] 데이터 조회 실패:', fetchError)
      throw fetchError
    }
    
    console.log('[INFO] 백그라운드 LLM 분석 시작:', partsData.length, '개 항목')
    
    // ✅ 백그라운드 큐 방식으로 변경
    const setData = {
      set_num: 'metadata-management',
      name: '메타데이터 생성',
      id: 'metadata-' + Date.now()
    }
    
    // 부품 데이터를 백그라운드 분석 형식으로 변환
    const partsForAnalysis = partsData.map(part => ({
      part: {
        part_num: part.part_id,
        name: part.part_name
      },
      color: {
        id: part.color_id
      }
    }))
    
    // 백그라운드 분석 시작
    const taskId = await startBackgroundAnalysis(setData, partsForAnalysis)
    
    console.log(`📋 백그라운드 작업 시작: ${taskId}`)
    
    alert(`백그라운드에서 LLM 분석을 시작합니다!\n작업 ID: ${taskId}\n처리 항목: ${partsData.length}개`)
    selectedIds.value = []
    await loadData()
  } catch (error) {
    console.error('생성 요청 실패:', error)
    alert('생성 요청에 실패했습니다: ' + error.message)
  } finally {
    generating.value = false
  }
}

const retryErrors = async () => {
  const errorIds = items.value
    .filter(item => item.metadata_status === 'error')
    .map(item => item.id)
  
  if (errorIds.length === 0) {
    alert('재시도할 오류 항목이 없습니다')
    return
  }
  
  generating.value = true
  try {
    console.log('[DEBUG] retryErrors 호출:', errorIds)
    
    // generateMetadata 함수 재사용
  await generateMetadata(errorIds)
  } catch (error) {
    console.error('재시도 실패:', error)
    alert('재시도에 실패했습니다: ' + error.message)
  } finally {
    generating.value = false
  }
}

const generateMissing = async () => {
  const missingIds = items.value
    .filter(item => item.metadata_status === 'missing')
    .map(item => item.id)
  
  if (missingIds.length === 0) {
    alert('생성할 항목이 없습니다')
    return
  }
  
  generating.value = true
  try {
    console.log('[DEBUG] generateMissing 호출:', missingIds)
    
    // generateMetadata 함수 재사용
  await generateMetadata(missingIds)
  } catch (error) {
    console.error('생성 요청 실패:', error)
    alert('생성 요청에 실패했습니다: ' + error.message)
  } finally {
    generating.value = false
  }
}

const viewMetadata = (item) => {
  selectedItem.value = item
  showModal.value = true
}

const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedIds.value = paginatedItems.value.map(item => item.id)
  } else {
    selectedIds.value = []
  }
}

const handleSearch = () => {
  currentPage.value = 1
}

const getStatusLabel = (status) => {
  const labels = {
    completed: '✅ 완료',
    error: '⚠️ 오류',
    missing: '❌ 없음'
  }
  return labels[status] || status
}

// 워치
watch(statusFilter, () => {
  currentPage.value = 1
})

watch(filteredItems, () => {
  selectAll.value = false
  selectedIds.value = []
})

// 마운트
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.metadata-tab {
  padding: 1rem;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stat-card.completed { border-left: 4px solid #27ae60; }
.stat-card.error { border-left: 4px solid #e74c3c; }
.stat-card.missing { border-left: 4px solid #95a5a6; }
.stat-card.progress { border-left: 4px solid #3498db; }

.stat-icon {
  font-size: 2rem;
}

.stat-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #2c3e50;
}

.filter-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 250px;
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #3498db;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
}

.filter-btn {
  padding: 0.75rem 1.25rem;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s;
}

.filter-btn:hover {
  background: #f8f9fa;
  border-color: #3498db;
}

.filter-btn.active {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.table-container {
  overflow-x: auto;
  margin-bottom: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.data-table th {
  background: #f8f9fa;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #e0e0e0;
}

.data-table td {
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.data-table tbody tr:hover {
  background: #f8f9fa;
}

.part-id {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #3498db;
}

.color-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-box {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.feature-text {
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-badge.completed {
  background: #d4edda;
  color: #155724;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.missing {
  background: #e2e3e5;
  color: #383d41;
}

.quality-score {
  text-align: center;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-view, .btn-generate {
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-view {
  background: #3498db;
}

.btn-view:hover {
  background: #2980b9;
  transform: scale(1.1);
}

.btn-generate {
  background: #27ae60;
}

.btn-generate:hover:not(:disabled) {
  background: #229954;
  transform: scale(1.1);
}

.btn-generate:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.loading-cell, .empty-cell {
  text-align: center;
  padding: 3rem !important;
  color: #7f8c8d;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #3498db;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-weight: 600;
  color: #2c3e50;
}

.bulk-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-bulk {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  background: #3498db;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-bulk:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.btn-bulk:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.btn-bulk.error {
  background: #e74c3c;
}

.btn-bulk.error:hover:not(:disabled) {
  background: #c0392b;
}

.btn-bulk.missing {
  background: #95a5a6;
}

.btn-bulk.missing:hover:not(:disabled) {
  background: #7f8c8d;
}

/* 모달 */
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
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #7f8c8d;
  line-height: 1;
}

.modal-close:hover {
  color: #e74c3c;
}

.modal-body {
  padding: 1.5rem;
}

.detail-row {
  margin-bottom: 1.5rem;
}

.detail-row strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.detail-text {
  margin: 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  color: #2c3e50;
}

.detail-json {
  margin: 0;
  padding: 1rem;
  background: #2c3e50;
  color: #ecf0f1;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.9rem;
}
</style>

