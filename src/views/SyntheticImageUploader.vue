<template>
  <div class="synthetic-image-uploader">
    <div class="header">
      <h1>📁 합성 이미지 업로드</h1>
      <p class="subtitle">Supabase Storage의 lego-synthetic 버킷에 부품별 폴더로 이미지를 업로드합니다</p>
    </div>

    <!-- 업로드 영역 -->
    <div class="upload-section">
      <div class="upload-area" 
           :class="{ 'drag-over': isDragOver }"
           @drop="handleDrop"
           @dragover="handleDragOver"
           @dragleave="handleDragLeave"
           @click="triggerFileInput">
        <input 
          ref="fileInput"
          type="file" 
          multiple 
          accept="image/*"
          @change="handleFileSelect"
          style="display: none"
        />
        <input 
          ref="folderInput"
          type="file" 
          webkitdirectory
          multiple
          @change="handleFolderSelect"
          style="display: none"
        />
        
        <div v-if="!uploading" class="upload-content">
          <div class="upload-icon">📁</div>
          <h3>이미지 파일 또는 폴더를 드래그하거나 클릭하여 선택하세요</h3>
          <p>지원 형식: JPG, PNG, WebP</p>
          <p>부품별 폴더로 자동 분류됩니다</p>
          
          <!-- 업로드 모드 선택 -->
          <div class="upload-mode-section">
            <div class="mode-buttons">
              <button 
                @click="setUploadMode('files')"
                :class="{ 'active': uploadMode === 'files' }"
                class="mode-btn"
                :disabled="uploading"
              >
                📄 파일 업로드
              </button>
              <button 
                @click="setUploadMode('folder')"
                :class="{ 'active': uploadMode === 'folder' }"
                class="mode-btn"
                :disabled="uploading"
              >
                📁 폴더 업로드
              </button>
            </div>
          </div>
        </div>
        
        <div v-else class="upload-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <p>{{ uploadStatus }}</p>
          <p>{{ uploadedFiles }} / {{ totalFiles }} 파일 업로드됨</p>
        </div>
      </div>
    </div>

    <!-- 부품 정보 입력 -->
    <div class="part-info-section">
      <h3>부품 정보 설정</h3>
      <div class="form-group">
        <label>부품 번호 (Part ID)</label>
        <input 
          v-model="partId" 
          type="text" 
          placeholder="예: 3001"
          :disabled="uploading"
        />
      </div>
      <div class="form-group">
        <label>엘리먼트 ID (Element ID)</label>
        <input 
          v-model="elementId" 
          type="text" 
          placeholder="예: 6211342"
          :disabled="uploading"
        />
      </div>
      <div v-if="folderStructure !== 'element-based'" class="form-group">
        <label>색상 ID (선택사항)</label>
        <input 
          v-model="colorId" 
          type="text" 
          placeholder="예: 4 (빨간색)"
          :disabled="uploading"
        />
      </div>
      <div class="form-group">
        <label>폴더 구조</label>
        <select v-model="folderStructure" :disabled="uploading">
          <option value="part-based">부품별 폴더 (part_id/color_id/)</option>
          <option value="element-based">엘리먼트별 폴더 (element_id/)</option>
          <option value="flat">단일 폴더 (모든 파일)</option>
          <option value="custom">사용자 정의</option>
        </select>
        <small class="form-help">
          엘리먼트별 폴더: synthetic/6211342/ 형태로 생성됩니다
        </small>
      </div>
      <div v-if="folderStructure === 'custom'" class="form-group">
        <label>사용자 정의 경로</label>
        <input 
          v-model="customPath" 
          type="text" 
          placeholder="예: custom_folder/sub_folder"
          :disabled="uploading"
        />
      </div>
    </div>

    <!-- 업로드 옵션 -->
    <div class="upload-options">
      <h3>업로드 옵션</h3>
      <div class="options-grid">
        <label class="checkbox-label">
          <input type="checkbox" v-model="convertToWebP" :disabled="uploading">
          <span class="checkmark"></span>
          WebP 형식으로 변환 (권장)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="optimizeImages" :disabled="uploading">
          <span class="checkmark"></span>
          이미지 최적화 (품질 90%)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="overwriteExisting" :disabled="uploading">
          <span class="checkmark"></span>
          기존 파일 덮어쓰기
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="createMetadata" :disabled="uploading">
          <span class="checkmark"></span>
          메타데이터 파일 생성
        </label>
      </div>
    </div>

    <!-- 업로드 버튼 -->
    <div class="action-section">
      <button 
        @click="startUpload" 
        :disabled="!selectedFiles.length || (!partId && !elementId) || uploading"
        class="btn btn-primary"
      >
        {{ uploading ? '업로드 중...' : (uploadMode === 'folder' && selectedFolder ? `업로드 시작 (${selectedFolder} 폴더, ${selectedFiles.length}개 파일)` : `업로드 시작 (${selectedFiles.length}개 파일)`) }}
      </button>
      <button 
        @click="clearSelection" 
        :disabled="uploading"
        class="btn btn-secondary"
      >
        선택 초기화
      </button>
    </div>

    <!-- 업로드 결과 -->
    <div v-if="uploadResults.length > 0" class="upload-results">
      <h3>업로드 결과</h3>
      <div class="results-grid">
        <div 
          v-for="result in uploadResults" 
          :key="result.fileName"
          class="result-item"
          :class="{ 'success': result.success, 'error': !result.success }"
        >
          <div class="result-icon">
            {{ result.success ? '✅' : '❌' }}
          </div>
          <div class="result-info">
            <h4>{{ result.fileName }}</h4>
            <p>{{ result.message }}</p>
            <p v-if="result.url" class="result-url">
              <a :href="result.url" target="_blank">Supabase Storage에서 보기</a>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 로그 -->
    <div v-if="logs.length > 0" class="logs-section">
      <h3>업로드 로그</h3>
      <div class="logs-container">
        <div 
          v-for="(log, index) in logs" 
          :key="index"
          :class="['log-entry', log.type]"
        >
          <span class="log-time">{{ log.timestamp }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSupabase } from '../composables/useSupabase'

const { supabase } = useSupabase()

// 반응형 데이터
const fileInput = ref(null)
const selectedFiles = ref([])
const isDragOver = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const uploadedFiles = ref(0)
const totalFiles = ref(0)
const uploadResults = ref([])
const logs = ref([])

// 부품 정보
const partId = ref('')
const elementId = ref('6211342')
const colorId = ref('0')
const folderStructure = ref('element-based')
const customPath = ref('')

// 업로드 모드
const uploadMode = ref('files')
const selectedFolder = ref(null)

// 업로드 옵션
const convertToWebP = ref(true)
const optimizeImages = ref(true)
const overwriteExisting = ref(false)
const createMetadata = ref(true)

// 계산된 속성
const uploadPath = computed(() => {
  if (folderStructure.value === 'custom') {
    return customPath.value || 'custom'
  } else if (folderStructure.value === 'part-based') {
    const basePath = `synthetic/${partId.value}`
    return colorId.value ? `${basePath}/${colorId.value}` : basePath
  } else if (folderStructure.value === 'element-based') {
    return `synthetic/${elementId.value}`
  } else {
    return 'synthetic/flat'
  }
})

// 메서드
const addLog = (message, type = 'info') => {
  logs.value.unshift({
    timestamp: new Date().toLocaleTimeString(),
    message,
    type
  })
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100)
  }
}

const triggerFileInput = () => {
  if (!uploading.value) {
    if (uploadMode.value === 'files') {
      fileInput.value.click()
    } else {
      folderInput.value.click()
    }
  }
}

const setUploadMode = (mode) => {
  uploadMode.value = mode
  clearSelection()
}

const handleFolderSelect = (event) => {
  const files = Array.from(event.target.files)
  selectedFiles.value = files
  selectedFolder.value = files.length > 0 ? files[0].webkitRelativePath.split('/')[0] : null
  addLog(`폴더 "${selectedFolder.value}"에서 ${files.length}개 파일 선택됨`, 'info')
}

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  selectedFiles.value = files
  addLog(`${files.length}개 파일 선택됨`, 'info')
}

const handleDragOver = (event) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (event) => {
  event.preventDefault()
  isDragOver.value = false
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false
  
  const items = Array.from(event.dataTransfer.items)
  const files = Array.from(event.dataTransfer.files).filter(file => 
    file.type.startsWith('image/')
  )
  
  // 폴더인지 파일인지 확인
  if (items.length > 0 && items[0].webkitGetAsEntry) {
    const entry = items[0].webkitGetAsEntry()
    if (entry.isDirectory) {
      addLog('폴더는 폴더 업로드 모드에서 선택해주세요', 'warning')
      return
    }
  }
  
  selectedFiles.value = files
  addLog(`${files.length}개 파일 드래그됨`, 'info')
}

const clearSelection = () => {
  selectedFiles.value = []
  selectedFolder.value = null
  uploadResults.value = []
  logs.value = []
  uploadProgress.value = 0
  uploadedFiles.value = 0
  totalFiles.value = 0
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  if (folderInput.value) {
    folderInput.value.value = ''
  }
}

const convertToWebPFormat = async (file) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/webp', optimizeImages.value ? 0.9 : 1.0)
    }
    
    img.src = URL.createObjectURL(file)
  })
}

const uploadFileToSupabase = async (file, index) => {
  try {
    let fileToUpload = file
    let fileName = file.name
    
    // WebP 변환
    if (convertToWebP.value && !file.name.toLowerCase().endsWith('.webp')) {
      fileToUpload = await convertToWebPFormat(file)
      fileName = fileName.replace(/\.[^/.]+$/, '.webp')
    }
    
    // 파일 경로 생성
    const filePath = `${uploadPath.value}/${fileName}`
    
    // 기존 파일 삭제 (덮어쓰기 옵션)
    if (overwriteExisting.value) {
      try {
        await supabase.storage
          .from('lego-synthetic')
          .remove([filePath])
      } catch (deleteError) {
        // 파일이 없어도 무시
      }
    }
    
    // Supabase Storage 업로드
    const { data, error } = await supabase.storage
      .from('lego-synthetic')
      .upload(filePath, fileToUpload)
    
    if (error) {
      throw new Error(`업로드 실패: ${error.message}`)
    }
    
    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('lego-synthetic')
      .getPublicUrl(filePath)
    
    // 메타데이터 생성
    if (createMetadata.value) {
      const metadata = {
        part_id: folderStructure.value === 'part-based' ? partId.value : null,
        element_id: folderStructure.value === 'element-based' ? elementId.value : null,
        color_id: folderStructure.value === 'part-based' ? (colorId.value || null) : null,
        file_name: fileName,
        file_path: filePath,
        file_size: fileToUpload.size,
        file_type: fileToUpload.type,
        upload_date: new Date().toISOString(),
        folder_structure: folderStructure.value,
        converted_to_webp: convertToWebP.value,
        optimized: optimizeImages.value
      }
      
      // 메타데이터를 JSON 파일로 저장
      const metadataFileName = fileName.replace(/\.[^/.]+$/, '.json')
      const metadataPath = `${uploadPath.value}/${metadataFileName}`
      
      await supabase.storage
        .from('lego-synthetic')
        .upload(metadataPath, JSON.stringify(metadata, null, 2), {
          contentType: 'application/json'
        })
    }
    
    return {
      success: true,
      fileName: fileName,
      message: '업로드 성공',
      url: urlData.publicUrl,
      path: filePath
    }
    
  } catch (error) {
    return {
      success: false,
      fileName: file.name,
      message: error.message,
      url: null,
      path: null
    }
  }
}

const startUpload = async () => {
  if (!selectedFiles.value.length || (!partId.value && !elementId.value)) {
    addLog('파일과 부품 번호 또는 엘리먼트 ID를 선택해주세요', 'error')
    return
  }
  
  uploading.value = true
  uploadProgress.value = 0
  uploadedFiles.value = 0
  totalFiles.value = selectedFiles.value.length
  uploadResults.value = []
  
  addLog(`업로드 시작: ${totalFiles.value}개 파일`, 'info')
  addLog(`업로드 경로: ${uploadPath.value}`, 'info')
  
  try {
    for (let i = 0; i < selectedFiles.value.length; i++) {
      const file = selectedFiles.value[i]
      uploadStatus.value = `업로드 중: ${file.name}`
      
      const result = await uploadFileToSupabase(file, i)
      uploadResults.value.push(result)
      
      uploadedFiles.value++
      uploadProgress.value = Math.round((uploadedFiles.value / totalFiles.value) * 100)
      
      if (result.success) {
        addLog(`✅ ${result.fileName} 업로드 완료`, 'success')
      } else {
        addLog(`❌ ${result.fileName} 업로드 실패: ${result.message}`, 'error')
      }
    }
    
    const successCount = uploadResults.value.filter(r => r.success).length
    const failCount = uploadResults.value.filter(r => !r.success).length
    
    addLog(`업로드 완료: 성공 ${successCount}개, 실패 ${failCount}개`, 'info')
    uploadStatus.value = `업로드 완료: ${successCount}/${totalFiles.value} 성공`
    
  } catch (error) {
    addLog(`업로드 중 오류: ${error.message}`, 'error')
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.synthetic-image-uploader {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #7f8c8d;
  font-size: 1rem;
}

.upload-section {
  margin-bottom: 2rem;
}

.upload-area {
  border: 2px dashed #bdc3c7;
  border-radius: 8px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8f9fa;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #3498db;
  background: #e3f2fd;
}

.upload-content {
  pointer-events: none;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.upload-progress {
  pointer-events: none;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #ecf0f1;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: #3498db;
  transition: width 0.3s;
}

.part-info-section,
.upload-options {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 1rem;
}

.form-help {
  display: block;
  margin-top: 0.25rem;
  color: #7f8c8d;
  font-size: 0.875rem;
}

.upload-mode-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.mode-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.mode-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #3498db;
  background: white;
  color: #3498db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  background: #f8f9fa;
}

.mode-btn.active {
  background: #3498db;
  color: white;
}

.mode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
}

.action-section {
  text-align: center;
  margin-bottom: 2rem;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  margin: 0 0.5rem;
  transition: all 0.3s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-primary:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
}

.upload-results {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.results-grid {
  display: grid;
  gap: 1rem;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid;
}

.result-item.success {
  background: #d5f4e6;
  border-left-color: #27ae60;
}

.result-item.error {
  background: #fadbd8;
  border-left-color: #e74c3c;
}

.result-icon {
  font-size: 1.5rem;
  margin-right: 1rem;
}

.result-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.result-info p {
  margin: 0.25rem 0;
  color: #7f8c8d;
}

.result-url a {
  color: #3498db;
  text-decoration: none;
}

.result-url a:hover {
  text-decoration: underline;
}

.logs-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logs-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ecf0f1;
  border-radius: 4px;
  padding: 1rem;
}

.log-entry {
  display: flex;
  margin-bottom: 0.5rem;
  font-family: monospace;
  font-size: 0.9rem;
}

.log-time {
  color: #7f8c8d;
  margin-right: 1rem;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-entry.success .log-message {
  color: #27ae60;
}

.log-entry.error .log-message {
  color: #e74c3c;
}

.log-entry.info .log-message {
  color: #2c3e50;
}
</style>
