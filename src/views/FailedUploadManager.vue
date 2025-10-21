<template>
  <div class="failed-upload-manager">
    <div class="header">
      <h2>실패한 업로드 관리</h2>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-number">{{ statistics.total }}</div>
          <div class="stat-label">전체</div>
        </div>
        <div class="stat-card failed">
          <div class="stat-number">{{ statistics.by_status?.failed || 0 }}</div>
          <div class="stat-label">실패</div>
        </div>
        <div class="stat-card retrying">
          <div class="stat-number">{{ statistics.by_status?.retrying || 0 }}</div>
          <div class="stat-label">재시도 중</div>
        </div>
        <div class="stat-card success">
          <div class="stat-number">{{ statistics.by_status?.success || 0 }}</div>
          <div class="stat-label">성공</div>
        </div>
      </div>
    </div>

    <div class="controls">
      <div class="filter-controls">
        <select v-model="statusFilter" @change="loadFailedUploads">
          <option value="">전체 상태</option>
          <option value="failed">실패</option>
          <option value="retrying">재시도 중</option>
          <option value="success">성공</option>
          <option value="final_failure">최종 실패</option>
        </select>
        <button @click="loadFailedUploads" class="refresh-btn">
          🔄 새로고침
        </button>
      </div>
      
      <div class="bulk-actions">
        <button @click="retryAllFailed" :disabled="loading" class="bulk-retry-btn">
          📤 모든 실패 항목 재시도
        </button>
        <button @click="cleanupSuccess" :disabled="loading" class="cleanup-btn">
          🗑️ 성공 항목 정리
        </button>
      </div>
    </div>

    <div class="upload-list">
      <div v-if="loading" class="loading">
        로딩 중...
      </div>
      
      <div v-else-if="failedUploads.length === 0" class="empty-state">
        실패한 업로드가 없습니다.
      </div>
      
      <div v-else class="upload-items">
        <div 
          v-for="upload in failedUploads" 
          :key="upload.id"
          class="upload-item"
          :class="upload.status"
        >
          <div class="upload-header">
            <div class="upload-info">
              <h3>{{ upload.part_id }} ({{ upload.element_id }})</h3>
              <p class="upload-id">{{ upload.unique_id }}</p>
              <p class="upload-time">{{ formatTime(upload.failed_at) }}</p>
            </div>
            <div class="upload-status">
              <span class="status-badge" :class="upload.status">
                {{ getStatusLabel(upload.status) }}
              </span>
            </div>
          </div>
          
          <div class="upload-details">
            <div class="error-info">
              <strong>오류:</strong> {{ upload.error_reason }}
            </div>
            
            <div class="file-list">
              <h4>파일 목록:</h4>
              <div class="files">
                <div 
                  v-for="(localPath, fileType) in upload.local_paths" 
                  :key="fileType"
                  class="file-item"
                >
                  <span class="file-type">{{ getFileTypeLabel(fileType) }}</span>
                  <span class="file-path">{{ localPath }}</span>
                  <button 
                    @click="uploadSingleFile(upload, fileType)"
                    :disabled="loading"
                    class="upload-single-btn"
                  >
                    📤 업로드
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="upload-actions">
            <button 
              @click="retryUpload(upload)"
              :disabled="loading || upload.status === 'retrying'"
              class="retry-btn"
            >
              🔄 전체 재시도
            </button>
            <button 
              @click="markAsSuccess(upload)"
              :disabled="loading"
              class="success-btn"
            >
              ✅ 성공으로 표시
            </button>
            <button 
              @click="deleteUpload(upload)"
              :disabled="loading"
              class="delete-btn"
            >
              🗑️ 삭제
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 진행 상황 모달 -->
    <div v-if="showProgress" class="progress-modal">
      <div class="progress-content">
        <h3>업로드 진행 상황</h3>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <p>{{ progressText }}</p>
        <button @click="cancelProgress" class="cancel-btn">취소</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'

export default {
  name: 'FailedUploadManager',
  setup() {
    const failedUploads = ref([])
    const statistics = ref({ total: 0, by_status: {} })
    const loading = ref(false)
    const statusFilter = ref('')
    const showProgress = ref(false)
    const progressPercent = ref(0)
    const progressText = ref('')
    const cancelRequested = ref(false)

    // 프록시를 통한 상대 경로 사용
    const API_BASE = '/api/manual-upload'

    // 데이터 로드
    const loadFailedUploads = async () => {
      loading.value = true
      try {
        const params = statusFilter.value ? `?status=${statusFilter.value}` : ''
        const response = await fetch(`${API_BASE}/failed-uploads${params}`)
        const data = await response.json()
        
        if (data.success) {
          failedUploads.value = data.data
        } else {
          console.error('Failed to load uploads:', data.error)
        }
      } catch (error) {
        console.error('Error loading uploads:', error)
      } finally {
        loading.value = false
      }
    }

    const loadStatistics = async () => {
      try {
        const response = await fetch(`${API_BASE}/statistics`)
        const data = await response.json()
        
        if (data.success) {
          statistics.value = data.data
        }
      } catch (error) {
        console.error('Error loading statistics:', error)
      }
    }

    // 단일 파일 업로드
    const uploadSingleFile = async (upload, fileType) => {
      try {
        const localPath = upload.local_paths[fileType]
        
        // 파일 읽기
        const file = await fetch(`file://${localPath}`).then(r => r.blob())
        
        // FormData 생성
        const formData = new FormData()
        formData.append('file', file)
        formData.append('entryId', upload.id)
        formData.append('fileType', fileType)
        formData.append('elementId', upload.element_id)
        formData.append('uniqueId', upload.unique_id)
        
        const response = await fetch(`${API_BASE}/upload-file`, {
          method: 'POST',
          body: formData
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert(`${getFileTypeLabel(fileType)} 업로드 성공!`)
          loadFailedUploads()
          loadStatistics()
        } else {
          alert(`업로드 실패: ${result.error}`)
        }
      } catch (error) {
        console.error('Single file upload error:', error)
        alert(`업로드 오류: ${error.message}`)
      }
    }

    // 전체 재시도
    const retryUpload = async (upload) => {
      try {
        const response = await fetch(`${API_BASE}/retry-entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: upload.id })
        })
        
        const result = await response.json()
        
        if (result.success) {
          if (result.data.allSuccessful) {
            alert('모든 파일 업로드 성공!')
          } else {
            alert(`${result.data.successCount}/${result.data.totalCount} 파일 업로드 성공`)
          }
          loadFailedUploads()
          loadStatistics()
        } else {
          alert(`재시도 실패: ${result.error}`)
        }
      } catch (error) {
        console.error('Retry upload error:', error)
        alert(`재시도 오류: ${error.message}`)
      }
    }

    // 모든 실패 항목 재시도
    const retryAllFailed = async () => {
      const failedItems = failedUploads.value.filter(u => u.status === 'failed')
      
      if (failedItems.length === 0) {
        alert('재시도할 실패 항목이 없습니다.')
        return
      }
      
      if (!confirm(`${failedItems.length}개 항목을 재시도하시겠습니까?`)) {
        return
      }
      
      showProgress.value = true
      progressPercent.value = 0
      progressText.value = '재시도 시작...'
      cancelRequested.value = false
      
      let successCount = 0
      
      for (let i = 0; i < failedItems.length; i++) {
        if (cancelRequested.value) {
          progressText.value = '취소됨'
          break
        }
        
        const upload = failedItems[i]
        progressText.value = `${i + 1}/${failedItems.length}: ${upload.part_id} 처리 중...`
        
        try {
          const response = await fetch(`${API_BASE}/retry-entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId: upload.id })
          })
          
          const result = await response.json()
          if (result.success && result.data.allSuccessful) {
            successCount++
          }
        } catch (error) {
          console.error(`Retry failed for ${upload.id}:`, error)
        }
        
        progressPercent.value = ((i + 1) / failedItems.length) * 100
      }
      
      showProgress.value = false
      alert(`완료: ${successCount}/${failedItems.length} 항목 성공`)
      
      loadFailedUploads()
      loadStatistics()
    }

    // 성공으로 표시
    const markAsSuccess = async (upload) => {
      try {
        const response = await fetch(`${API_BASE}/update-status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            entryId: upload.id, 
            status: 'success',
            note: '수동으로 성공 처리됨'
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert('성공으로 표시되었습니다.')
          loadFailedUploads()
          loadStatistics()
        } else {
          alert(`상태 업데이트 실패: ${result.error}`)
        }
      } catch (error) {
        console.error('Mark as success error:', error)
        alert(`상태 업데이트 오류: ${error.message}`)
      }
    }

    // 삭제
    const deleteUpload = async (upload) => {
      if (!confirm('이 항목을 삭제하시겠습니까?')) {
        return
      }
      
      try {
        const response = await fetch(`${API_BASE}/delete-entry`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: upload.id })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert('삭제되었습니다.')
          loadFailedUploads()
          loadStatistics()
        } else {
          alert(`삭제 실패: ${result.error}`)
        }
      } catch (error) {
        console.error('Delete error:', error)
        alert(`삭제 오류: ${error.message}`)
      }
    }

    // 성공 항목 정리
    const cleanupSuccess = async () => {
      const successItems = failedUploads.value.filter(u => u.status === 'success')
      
      if (successItems.length === 0) {
        alert('정리할 성공 항목이 없습니다.')
        return
      }
      
      if (!confirm(`${successItems.length}개 성공 항목을 정리하시겠습니까?`)) {
        return
      }
      
      for (const upload of successItems) {
        await deleteUpload(upload)
      }
    }

    // 진행 취소
    const cancelProgress = () => {
      cancelRequested.value = true
    }

    // 헬퍼 함수들
    const getStatusLabel = (status) => {
      const labels = {
        'failed': '실패',
        'retrying': '재시도 중',
        'success': '성공',
        'final_failure': '최종 실패',
        'partial_success': '부분 성공'
      }
      return labels[status] || status
    }

    const getFileTypeLabel = (fileType) => {
      const labels = {
        'image': '이미지',
        'annotation': '어노테이션',
        'metadata': '메타데이터',
        'e2_metadata': 'E2 메타데이터'
      }
      return labels[fileType] || fileType
    }

    const formatTime = (timeString) => {
      return new Date(timeString).toLocaleString('ko-KR')
    }

    // 컴포넌트 마운트 시 데이터 로드
    onMounted(() => {
      loadFailedUploads()
      loadStatistics()
    })

    return {
      failedUploads,
      statistics,
      loading,
      statusFilter,
      showProgress,
      progressPercent,
      progressText,
      loadFailedUploads,
      loadStatistics,
      uploadSingleFile,
      retryUpload,
      retryAllFailed,
      markAsSuccess,
      deleteUpload,
      cleanupSuccess,
      cancelProgress,
      getStatusLabel,
      getFileTypeLabel,
      formatTime
    }
  }
}
</script>

<style scoped>
.failed-upload-manager {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 30px;
}

.header h2 {
  margin-bottom: 20px;
  color: #333;
}

.stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  min-width: 100px;
}

.stat-card.failed {
  background: #ffe6e6;
  border-left: 4px solid #dc3545;
}

.stat-card.retrying {
  background: #fff3cd;
  border-left: 4px solid #ffc107;
}

.stat-card.success {
  background: #d4edda;
  border-left: 4px solid #28a745;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.filter-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.filter-controls select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.refresh-btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.bulk-actions {
  display: flex;
  gap: 10px;
}

.bulk-retry-btn {
  padding: 10px 20px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cleanup-btn {
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.upload-list {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.loading, .empty-state {
  padding: 40px;
  text-align: center;
  color: #666;
}

.upload-items {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.upload-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
}

.upload-item.failed {
  border-left: 4px solid #dc3545;
}

.upload-item.retrying {
  border-left: 4px solid #ffc107;
}

.upload-item.success {
  border-left: 4px solid #28a745;
}

.upload-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.upload-info h3 {
  margin: 0 0 5px 0;
  color: #333;
}

.upload-id {
  margin: 0 0 5px 0;
  color: #666;
  font-size: 14px;
  font-family: monospace;
}

.upload-time {
  margin: 0;
  color: #999;
  font-size: 12px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.failed {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.retrying {
  background: #fff3cd;
  color: #856404;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
}

.upload-details {
  margin-bottom: 15px;
}

.error-info {
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  color: #721c24;
}

.file-list h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.files {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.file-type {
  font-weight: bold;
  min-width: 80px;
  color: #007bff;
}

.file-path {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  color: #666;
  word-break: break-all;
}

.upload-single-btn {
  padding: 4px 8px;
  background: #17a2b8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.upload-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.retry-btn {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.success-btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.progress-modal {
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

.progress-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  text-align: center;
  min-width: 300px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
  margin: 20px 0;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.cancel-btn {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 15px;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
