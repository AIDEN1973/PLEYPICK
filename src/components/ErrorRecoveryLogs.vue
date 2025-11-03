<template>
  <div class="error-recovery-logs">
    <div class="logs-header">
      <h3>📋 에러 복구 로그</h3>
      <div class="logs-controls">
        <button @click="refreshLogs" :disabled="isLoading" class="btn-refresh">
          <span class="refresh-icon">🔄</span>
          새로고침
        </button>
        <button @click="clearLogs" class="btn-clear">
          <span class="clear-icon">🗑️</span>
          로그 지우기
        </button>
      </div>
    </div>

    <!-- 필터 및 통계 -->
    <div class="logs-filters">
      <div class="filter-group">
        <label>에러 타입:</label>
        <select v-model="selectedErrorType" @change="loadLogs">
          <option value="all">모든 에러</option>
          <option value="rendering_failed">렌더링 실패</option>
          <option value="quality_validation_failed">품질 검증 실패</option>
          <option value="quality_validation_final_failure">품질 검증 최종 실패</option>
          <option value="rendering_exception">렌더링 예외</option>
          <option value="rendering_final_failure">렌더링 최종 실패</option>
          <option value="quality_standards_failed">품질 기준 실패</option>
          <option value="requeue_failed">재큐 실패</option>
          <option value="supabase_connection_failed">Supabase 연결 실패</option>
          <option value="database_insert_failed">DB 삽입 실패</option>
          <option value="insert_exception">삽입 예외</option>
          <option value="queue_processing_failed">큐 처리 실패</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>기간:</label>
        <select v-model="selectedDays" @change="loadLogs">
          <option value="1">1일</option>
          <option value="3">3일</option>
          <option value="7">7일</option>
          <option value="30">30일</option>
        </select>
      </div>

      <div class="filter-group">
        <label>표시 개수:</label>
        <select v-model="selectedLimit" @change="loadLogs">
          <option value="50">50개</option>
          <option value="100">100개</option>
          <option value="200">200개</option>
        </select>
      </div>
    </div>

    <!-- 통계 대시보드 -->
    <div class="logs-stats" v-if="stats">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-label">총 에러</div>
            <div class="stat-value">{{ stats.totalErrors }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <div class="stat-label">기간</div>
            <div class="stat-value">{{ stats.period }}</div>
          </div>
        </div>
      </div>
      
      <div class="error-type-stats" v-if="stats.errorTypeStats">
        <h4>에러 타입별 통계</h4>
        <div class="error-types">
          <div 
            v-for="(count, type) in stats.errorTypeStats" 
            :key="type"
            class="error-type-item"
          >
            <span class="error-type-name">{{ getErrorTypeText(type) }}</span>
            <span class="error-type-count">{{ count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 로그 목록 -->
    <div class="logs-list">
      <div class="logs-list-header">
        <h4>로그 목록 ({{ logs.length }}개)</h4>
        <div class="logs-actions">
          <button @click="exportLogs" class="btn-export">
            <span class="export-icon">📤</span>
            내보내기
          </button>
        </div>
      </div>

      <div class="logs-container" v-if="logs.length > 0">
        <div 
          v-for="log in logs" 
          :key="log.id"
          class="log-entry"
          :class="getLogLevel(log)"
        >
          <div class="log-header">
            <div class="log-meta">
              <span class="log-timestamp">{{ formatTime(log.timestamp) }}</span>
              <span class="log-operation">{{ log.operation }}</span>
              <span class="log-worker">{{ log.worker }}</span>
            </div>
            <div class="log-status">
              <span class="status-badge" :class="log.status">
                {{ getStatusText(log.status) }}
              </span>
            </div>
          </div>
          
          <div class="log-content">
            <div class="log-message">{{ log.message }}</div>
            
            <div class="log-metadata" v-if="log.metadata">
              <div class="metadata-section">
                <strong>에러 타입:</strong> {{ log.metadata.error_type }}
              </div>
              <div class="metadata-section">
                <strong>복구 액션:</strong> {{ log.metadata.recovery_action }}
              </div>
              <div class="metadata-section" v-if="log.metadata.error_message">
                <strong>에러 메시지:</strong> {{ log.metadata.error_message }}
              </div>
              <div class="metadata-section" v-if="log.metadata.part_id">
                <strong>부품 ID:</strong> {{ log.metadata.part_id }}
              </div>
              <div class="metadata-section" v-if="log.metadata.attempt">
                <strong>시도 횟수:</strong> {{ log.metadata.attempt }}/{{ log.metadata.max_retries }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="no-logs">
        <div class="no-logs-icon">📭</div>
        <div class="no-logs-text">
          {{ selectedErrorType === 'all' ? '에러 로그가 없습니다' : `${getErrorTypeText(selectedErrorType)} 로그가 없습니다` }}
        </div>
      </div>
    </div>

    <!-- 페이지네이션 -->
    <div class="pagination" v-if="totalPages > 1">
      <button 
        @click="goToPage(currentPage - 1)" 
        :disabled="currentPage <= 1"
        class="btn-page"
      >
        이전
      </button>
      
      <span class="page-info">
        {{ currentPage }} / {{ totalPages }} 페이지
      </span>
      
      <button 
        @click="goToPage(currentPage + 1)" 
        :disabled="currentPage >= totalPages"
        class="btn-page"
      >
        다음
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

// 반응형 데이터
const isLoading = ref(false)
const logs = ref([])
const stats = ref(null)
const selectedErrorType = ref('all')
const selectedDays = ref(7)
const selectedLimit = ref(100)
const currentPage = ref(1)
const totalPages = ref(1)

// 계산된 속성
const totalLogs = computed(() => logs.value.length)

// API 호출 함수들
const loadLogs = async (page = 1) => {
  try {
    isLoading.value = true
    currentPage.value = page
    
    const offset = (page - 1) * selectedLimit.value
    const params = new URLSearchParams({
      errorType: selectedErrorType.value,
      limit: selectedLimit.value,
      offset: offset.toString()
    })
    
    const response = await fetch(`/api/synthetic/logs/error-recovery?${params}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    if (data.success) {
      logs.value = data.logs
      totalPages.value = Math.ceil(data.total / selectedLimit.value)
    }
  } catch (error) {
    console.error('로그 조회 실패:', error)
  } finally {
    isLoading.value = false
  }
}

const loadStats = async () => {
  try {
    const response = await fetch(`/api/synthetic/logs/error-recovery/stats?days=${selectedDays.value}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    if (data.success) {
      stats.value = data.stats
    }
  } catch (error) {
    console.error('통계 조회 실패:', error)
  }
}

const refreshLogs = async () => {
  await Promise.all([loadLogs(1), loadStats()])
}

const clearLogs = () => {
  logs.value = []
  stats.value = null
}

const exportLogs = () => {
  const csvContent = generateCSV()
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `error-recovery-logs-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const generateCSV = () => {
  const headers = ['타임스탬프', '작업', '상태', '워커', '메시지', '에러 타입', '복구 액션', '부품 ID']
  const rows = logs.value.map(log => [
    log.timestamp,
    log.operation,
    log.status,
    log.worker,
    log.message,
    log.metadata?.error_type || '',
    log.metadata?.recovery_action || '',
    log.metadata?.part_id || ''
  ])
  
  return [headers, ...rows].map(row => 
    row.map(field => `"${field}"`).join(',')
  ).join('\n')
}

// 유틸리티 함수들
const getErrorTypeText = (type) => {
  const typeMap = {
    'rendering_failed': '렌더링 실패',
    'quality_validation_failed': '품질 검증 실패',
    'quality_validation_final_failure': '품질 검증 최종 실패',
    'rendering_exception': '렌더링 예외',
    'rendering_final_failure': '렌더링 최종 실패',
    'quality_standards_failed': '품질 기준 실패',
    'requeue_failed': '재큐 실패',
    'supabase_connection_failed': 'Supabase 연결 실패',
    'database_insert_failed': 'DB 삽입 실패',
    'insert_exception': '삽입 예외',
    'queue_processing_failed': '큐 처리 실패'
  }
  return typeMap[type] || type
}

const getStatusText = (status) => {
  const statusMap = {
    'error_recovery': '에러 복구',
    'success': '성공',
    'failed': '실패'
  }
  return statusMap[status] || status
}

const getLogLevel = (log) => {
  if (log.status === 'error_recovery') return 'error'
  if (log.status === 'success') return 'success'
  return 'info'
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('ko-KR')
}

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    loadLogs(page)
  }
}

// 라이프사이클
onMounted(async () => {
  await refreshLogs()
})
</script>

<style scoped>
.error-recovery-logs {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.logs-header h3 {
  margin: 0;
  color: #333;
}

.logs-controls {
  display: flex;
  gap: 10px;
}

.btn-refresh, .btn-clear, .btn-export, .btn-page {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}

.btn-refresh {
  background: #6c757d;
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background: #5a6268;
}

.btn-clear {
  background: #dc3545;
  color: white;
}

.btn-clear:hover {
  background: #c82333;
}

.btn-export {
  background: #28a745;
  color: white;
}

.btn-export:hover {
  background: #218838;
}

.btn-page {
  background: #007bff;
  color: white;
  padding: 6px 12px;
}

.btn-page:hover:not(:disabled) {
  background: #0056b3;
}

.btn-refresh:disabled, .btn-page:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logs-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  min-width: 60px;
}

.filter-group select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  min-width: 120px;
}

.logs-stats {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.stat-icon {
  font-size: 24px;
  margin-right: 15px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.error-type-stats h4 {
  margin: 0 0 15px 0;
  color: #333;
}

.error-types {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 10px;
}

.error-type-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.error-type-name {
  font-size: 14px;
  color: #333;
}

.error-type-count {
  font-size: 14px;
  font-weight: bold;
  color: #007bff;
}

.logs-list {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.logs-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.logs-list-header h4 {
  margin: 0;
  color: #333;
}

.logs-actions {
  display: flex;
  gap: 10px;
}

.logs-container {
  max-height: 600px;
  overflow-y: auto;
}

.log-entry {
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin-bottom: 10px;
  background: #f8f9fa;
  transition: all 0.2s;
}

.log-entry:hover {
  background: #e9ecef;
}

.log-entry.error {
  border-left: 4px solid #dc3545;
}

.log-entry.success {
  border-left: 4px solid #28a745;
}

.log-entry.info {
  border-left: 4px solid #17a2b8;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
  background: white;
}

.log-meta {
  display: flex;
  gap: 15px;
  font-size: 14px;
}

.log-timestamp {
  color: #666;
  font-family: monospace;
}

.log-operation {
  color: #333;
  font-weight: 500;
}

.log-worker {
  color: #666;
}

.log-status {
  margin-left: 15px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.status-badge.error_recovery {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
}

.status-badge.failed {
  background: #f8d7da;
  color: #721c24;
}

.log-content {
  padding: 15px;
}

.log-message {
  font-size: 14px;
  color: #333;
  margin-bottom: 10px;
  line-height: 1.4;
}

.log-metadata {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  font-size: 13px;
}

.metadata-section {
  color: #666;
}

.metadata-section strong {
  color: #333;
  margin-right: 5px;
}

.no-logs {
  text-align: center;
  padding: 40px;
  color: #666;
}

.no-logs-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
}

.page-info {
  font-size: 14px;
  color: #666;
}

.refresh-icon {
  animation: none;
}

.btn-refresh:disabled .refresh-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
