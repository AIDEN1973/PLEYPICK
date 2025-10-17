<template>
  <div class="embedding-tab">
    <!-- 통계 -->
    <div class="stats-section">
      <div class="stat-card completed">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-label">완료</div>
          <div class="stat-value">{{ stats.completed || 0 }}</div>
        </div>
      </div>
      <div class="stat-card pending">
        <div class="stat-icon">🔄</div>
        <div class="stat-content">
          <div class="stat-label">대기</div>
          <div class="stat-value">{{ stats.pending || 0 }}</div>
        </div>
      </div>
      <div class="stat-card failed">
        <div class="stat-icon">❌</div>
        <div class="stat-content">
          <div class="stat-label">실패</div>
          <div class="stat-value">{{ stats.failed || 0 }}</div>
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

    <!-- 워커 상태 -->
    <div class="worker-status">
      <div class="worker-info">
        <span class="worker-icon" :class="workerStatus">●</span>
        <span class="worker-label">워커 상태:</span>
        <span class="worker-text">{{ workerStatusText }}</span>
      </div>
      <div class="worker-dim">
        <span class="dim-label">임베딩 차원:</span>
        <span class="dim-value">768차원 (ViT-L/14)</span>
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
          :class="['filter-btn', { active: statusFilter === 'pending' }]"
          @click="statusFilter = 'pending'"
        >
          대기 ({{ stats.pending || 0 }})
        </button>
        <button 
          :class="['filter-btn', { active: statusFilter === 'failed' }]"
          @click="statusFilter = 'failed'"
        >
          실패 ({{ stats.failed || 0 }})
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
            <th width="80">차원</th>
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
              <span :class="['status-badge', item.embedding_status || 'missing']">
                {{ getStatusLabel(item.embedding_status) }}
              </span>
            </td>
            <td class="dimension">
              <span v-if="item.vector_dimensions" class="dim-badge">
                {{ item.vector_dimensions }}
              </span>
              <span v-else class="dim-badge empty">-</span>
            </td>
            <td>
              <div class="action-buttons">
                <button 
                  v-if="item.embedding_status === 'completed'"
                  class="btn-view"
                  @click="viewEmbedding(item)"
                  title="보기"
                >
                  👁️
                </button>
                <button 
                  v-else
                  class="btn-generate"
                  @click="generateEmbedding([item.id])"
                  :disabled="generating || !item.feature_text"
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
        @click="generateEmbedding(selectedIds)"
        :disabled="selectedIds.length === 0 || generating"
      >
        선택 항목 생성 ({{ selectedIds.length }})
      </button>
      <button 
        class="btn-bulk failed"
        @click="retryFailed"
        :disabled="generating"
      >
        실패 전체 재시도
      </button>
      <button 
        class="btn-bulk missing"
        @click="generateMissing"
        :disabled="generating"
      >
        없음 전체 생성
      </button>
      <button 
        class="btn-refresh"
        @click="loadData"
        :disabled="loading"
      >
        🔄 새로고침
      </button>
    </div>

    <!-- 임베딩 상세 모달 -->
    <div v-if="showModal" class="modal-overlay" @click="showModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>🧠 임베딩 상세</h3>
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
            <strong>상태:</strong> {{ getStatusLabel(selectedItem?.embedding_status) }}
          </div>
          <div class="detail-row">
            <strong>차원:</strong> {{ selectedItem?.embedding_dimension || '-' }}
          </div>
          <div class="detail-row">
            <strong>Feature Text:</strong>
            <p class="detail-text">{{ selectedItem?.feature_text }}</p>
          </div>
          <div class="detail-row">
            <strong>임베딩 벡터 (처음 20개):</strong>
            <pre class="detail-json">{{ getEmbeddingPreview(selectedItem?.clip_text_emb) }}</pre>
          </div>
          <div class="detail-row">
            <strong>제로 벡터 여부:</strong>
            <span :class="selectedItem?.is_zero_vector ? 'badge-error' : 'badge-success'">
              {{ selectedItem?.is_zero_vector ? '⚠️ 제로 벡터' : '✅ 정상' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useWorkerHealth } from '../composables/useWorkerHealth'

const { supabase } = useSupabase()
const { checkWorkerHealth } = useWorkerHealth()

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
const workerStatus = ref('unknown')

// 계산된 속성
const totalCount = computed(() => {
  return (stats.value.completed || 0) + 
         (stats.value.pending || 0) + 
         (stats.value.failed || 0) + 
         (stats.value.missing || 0)
})

const progressPercentage = computed(() => {
  const total = totalCount.value
  if (total === 0) return 0
  return Math.round((stats.value.completed || 0) * 100 / total)
})

const workerStatusText = computed(() => {
  const statusMap = {
    running: '🟢 실행 중',
    stopped: '🔴 중지됨',
    unknown: '⚪ 알 수 없음'
  }
  return statusMap[workerStatus.value] || '⚪ 알 수 없음'
})

const filteredItems = computed(() => {
  let result = items.value

  // 상태 필터
  if (statusFilter.value !== 'all') {
    if (statusFilter.value === 'missing') {
      result = result.filter(item => !item.embedding_status)
    } else {
      result = result.filter(item => item.embedding_status === statusFilter.value)
    }
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
    const { data: statsData, error: statsError } = await supabase.rpc('get_embedding_stats')
    if (statsError) {
      console.error('통계 로드 실패:', statsError)
    } else if (statsData) {
      // RPC 함수는 JSON 객체를 반환 (배열이 아님)
      stats.value = {
        total: statsData.total || 0,
        completed: statsData.completed || 0,
        pending: statsData.pending || 0,
        no_text: statsData.no_text || 0
      }
    }

    // ✅ 최적화: 데이터 로드 (limit 증가: 500 → 1000)
    const { data, error } = await supabase
      .from('v_embedding_status')
      .select('*')
      .order('id', { ascending: false })
      .limit(1000)
    
    if (error) throw error
    items.value = data || []

    // 워커 상태 실제 체크
    try {
      const healthResult = await checkWorkerHealth()
      workerStatus.value = healthResult.status
    } catch (error) {
      console.error('워커 상태 체크 실패:', error)
      // 폴백: pending 항목이 있으면 running으로 추정
      if (stats.value.pending > 0) {
        workerStatus.value = 'running'
      } else {
        workerStatus.value = 'unknown'
      }
    }
  } catch (error) {
    console.error('데이터 로드 실패:', error)
    alert('데이터를 불러오는데 실패했습니다')
  } finally {
    loading.value = false
  }
}

const generateEmbedding = async (ids) => {
  if (ids.length === 0) return
  
  generating.value = true
  try {
    console.log('[DEBUG] generateEmbedding 호출:', ids)
    
    // 실제 임베딩 생성: clip_text_emb를 null로 설정하여 워커가 처리하도록 함
    const { error } = await supabase
      .from('parts_master_features')
      .update({ 
        clip_text_emb: null,
        semantic_vector: null,
        embedding_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .in('id', ids)
    
    if (error) {
      console.error('[ERROR] 업데이트 실패:', error)
      throw error
    }
    
    console.log('[SUCCESS] 업데이트 완료:', ids.length, '개')
    
    alert(`${ids.length}개 항목의 임베딩 생성이 요청되었습니다.\n워커가 자동으로 처리합니다.`)
    selectedIds.value = []
    await loadData()
  } catch (error) {
    console.error('생성 요청 실패:', error)
    alert('생성 요청에 실패했습니다: ' + error.message)
  } finally {
    generating.value = false
  }
}

const retryFailed = async () => {
  generating.value = true
  try {
    console.log('[DEBUG] retryFailed 호출')
    
    // 실패한 임베딩들을 다시 처리하도록 설정
    const { error } = await supabase
      .from('parts_master_features')
      .update({ 
        clip_text_emb: null,
        semantic_vector: null,
        embedding_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('embedding_status', 'failed')
    
    if (error) {
      console.error('[ERROR] 업데이트 실패:', error)
      throw error
    }
    
    console.log('[SUCCESS] 재시도 요청 완료')
    
    alert('실패한 임베딩들의 재시도가 요청되었습니다.\n워커가 자동으로 처리합니다.')
    await loadData()
  } catch (error) {
    console.error('재시도 실패:', error)
    alert('재시도에 실패했습니다: ' + error.message)
  } finally {
    generating.value = false
  }
}

const generateMissing = async () => {
  generating.value = true
  try {
    console.log('[DEBUG] generateMissing 호출')
    
    // 없음 임베딩들을 처리하도록 설정
    const { error } = await supabase
      .from('parts_master_features')
      .update({ 
        clip_text_emb: null,
        semantic_vector: null,
        embedding_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .or('embedding_status.is.null,embedding_status.eq.missing')
    
    if (error) {
      console.error('[ERROR] 업데이트 실패:', error)
      throw error
    }
    
    console.log('[SUCCESS] 없음 항목 생성 요청 완료')
    
    alert('없음 임베딩들의 생성이 요청되었습니다.\n워커가 자동으로 처리합니다.')
    await loadData()
  } catch (error) {
    console.error('생성 요청 실패:', error)
    alert('생성 요청에 실패했습니다: ' + error.message)
  } finally {
    generating.value = false
  }
}

const viewEmbedding = (item) => {
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
    semantic_ready: '✅ 완료',
    clip_ready: '✅ 완료',
    text_ready: '🔄 대기',
    pending: '🔄 대기',
    failed: '❌ 실패',
    null: '⭕ 없음',
    undefined: '⭕ 없음'
  }
  return labels[status] || '⭕ 없음'
}

const getEmbeddingPreview = (embedding) => {
  if (!embedding) return '없음'
  
  try {
    // embedding이 문자열인 경우 파싱
    const embArray = typeof embedding === 'string' ? JSON.parse(embedding) : embedding
    if (Array.isArray(embArray)) {
      const preview = embArray.slice(0, 20)
      return JSON.stringify(preview, null, 2) + '\n... (총 ' + embArray.length + '개)'
    }
  } catch (e) {
    console.error('임베딩 파싱 실패:', e)
  }
  
  return '파싱 오류'
}

// 워치
watch(statusFilter, () => {
  currentPage.value = 1
})

watch(filteredItems, () => {
  selectAll.value = false
  selectedIds.value = []
})

// 워커 상태 체크 함수
const checkWorkerStatus = async () => {
  try {
    const healthResult = await checkWorkerHealth()
    workerStatus.value = healthResult.status
  } catch (error) {
    console.error('워커 상태 체크 실패:', error)
    workerStatus.value = 'unknown'
  }
}

// 마운트
onMounted(() => {
  loadData()
  checkWorkerStatus()
  
  // 주기적으로 상태 갱신 (30초마다)
  setInterval(() => {
    if (!loading.value && !generating.value) {
      loadData()
    }
  }, 30000)
  
  // 주기적으로 워커 상태 체크 (10초마다)
  setInterval(() => {
    checkWorkerStatus()
  }, 10000)
})
</script>

<style scoped>
/* 이전 MetadataTab.vue의 스타일과 유사하지만 추가 스타일 */
.embedding-tab {
  padding: 1rem;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
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
.stat-card.pending { border-left: 4px solid #f39c12; }
.stat-card.failed { border-left: 4px solid #e74c3c; }
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

.worker-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.worker-info, .worker-dim {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.worker-icon {
  font-size: 1.2rem;
}

.worker-icon.running {
  color: #27ae60;
  animation: pulse 2s infinite;
}

.worker-icon.stopped {
  color: #e74c3c;
}

.worker-icon.unknown {
  color: #95a5a6;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.worker-label, .dim-label {
  font-weight: 600;
  color: #2c3e50;
}

.worker-text, .dim-value {
  color: #7f8c8d;
}

.dim-value {
  font-family: 'Courier New', monospace;
  background: #3498db;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
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
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.75rem 1.25rem;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s;
  white-space: nowrap;
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
  white-space: nowrap;
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
  flex-shrink: 0;
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
  white-space: nowrap;
}

.status-badge.completed {
  background: #d4edda;
  color: #155724;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.failed {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.missing {
  background: #e2e3e5;
  color: #383d41;
}

.dimension {
  text-align: center;
}

.dim-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #3498db;
  color: white;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.dim-badge.empty {
  background: #e2e3e5;
  color: #7f8c8d;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
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
  opacity: 0.6;
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
  vertical-align: middle;
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

.btn-bulk, .btn-refresh {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-bulk {
  background: #3498db;
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

.btn-bulk.failed {
  background: #e74c3c;
}

.btn-bulk.failed:hover:not(:disabled) {
  background: #c0392b;
}

.btn-bulk.missing {
  background: #95a5a6;
}

.btn-bulk.missing:hover:not(:disabled) {
  background: #7f8c8d;
}

.btn-refresh {
  background: #27ae60;
  margin-left: auto;
}

.btn-refresh:hover:not(:disabled) {
  background: #229954;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.btn-refresh:disabled {
  background: #95a5a6;
  cursor: not-allowed;
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

.badge-success {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #d4edda;
  color: #155724;
  border-radius: 4px;
  font-weight: 600;
}

.badge-error {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-weight: 600;
}
</style>

