<template>
  <div class="realtime-detection">
    <!-- 헤더 -->
    <div class="detection-header">
      <h1>실시간 부품 검수 시스템</h1>
      <div class="session-info" v-if="detectionState.isActive">
        <span class="session-id">세션: {{ detectionState.currentSession?.slice(0, 8) }}</span>
        <span class="target-set">세트: {{ detectionState.targetSet }}</span>
        <button @click="endSession" class="end-session-btn">세션 종료</button>
      </div>
    </div>

    <!-- 세션 시작 섹션 -->
    <div v-if="!detectionState.isActive" class="session-setup">
      <div class="setup-card">
        <h2>검수 세션 시작</h2>
        <div class="form-group">
          <label for="setNumber">레고 세트 번호</label>
          <input 
            id="setNumber"
            v-model="setNumber" 
            type="text" 
            placeholder="예: 60387"
            :disabled="loading"
          />
        </div>
        <button 
          @click="startSession" 
          :disabled="loading || !setNumber"
          class="start-session-btn"
        >
          {{ loading ? '로딩 중...' : '검수 시작' }}
        </button>
        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
    </div>

    <!-- 실시간 검출 섹션 -->
    <div v-if="detectionState.isActive" class="detection-workspace">
      <!-- 카메라 영역 -->
      <div class="camera-section">
        <div class="camera-container">
          <video 
            ref="cameraVideo" 
            autoplay 
            muted 
            playsinline
            class="camera-feed"
          ></video>
          <div class="camera-overlay">
            <div class="detection-indicator" :class="{ active: detecting }">
              {{ detecting ? '검출 중...' : '대기 중' }}
            </div>
          </div>
        </div>
        <div class="camera-controls">
          <button @click="captureFrame" :disabled="detecting" class="capture-btn">
            부품 검출
          </button>
          <button @click="toggleCamera" class="camera-toggle-btn">
            {{ cameraActive ? '카메라 중지' : '카메라 시작' }}
          </button>
        </div>
      </div>

      <!-- 검출 결과 영역 -->
      <div class="results-section">
        <!-- 자동 승인된 부품들 -->
        <div v-if="detectionResults.autoApproved.length > 0" class="result-group auto-approved">
          <h3>✅ 자동 승인된 부품 ({{ detectionResults.autoApproved.length }}개)</h3>
          <div class="parts-grid">
            <div 
              v-for="part in detectionResults.autoApproved" 
              :key="part.id"
              class="part-card approved"
            >
              <div class="part-info">
                <span class="part-name">{{ part.bestMatch?.part.name }}</span>
                <span class="part-color">{{ part.bestMatch?.color.name }}</span>
                <span class="confidence">신뢰도: {{ (part.confidence * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 수동 검토 필요한 부품들 -->
        <div v-if="detectionResults.manualReview.length > 0" class="result-group manual-review">
          <h3>⚠️ 수동 검토 필요 ({{ detectionResults.manualReview.length }}개)</h3>
          <div class="parts-grid">
            <div 
              v-for="part in detectionResults.manualReview" 
              :key="part.id"
              class="part-card manual"
            >
              <div class="part-info">
                <span class="part-name">{{ part.bestMatch?.part.name }}</span>
                <span class="part-color">{{ part.bestMatch?.color.name }}</span>
                <span class="confidence">신뢰도: {{ (part.confidence * 100).toFixed(1) }}%</span>
              </div>
              <div class="candidates">
                <h4>후보 부품들:</h4>
                <div class="candidate-list">
                  <div 
                    v-for="(candidate, index) in part.topCandidates" 
                    :key="index"
                    class="candidate-item"
                    @click="selectCandidate(part, candidate)"
                  >
                    {{ candidate.part.name }} ({{ candidate.color.name }})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 재촬영 필요한 부품들 -->
        <div v-if="detectionResults.retakeRequired.length > 0" class="result-group retake-required">
          <h3>🔄 재촬영 필요 ({{ detectionResults.retakeRequired.length }}개)</h3>
          <div class="parts-grid">
            <div 
              v-for="part in detectionResults.retakeRequired" 
              :key="part.id"
              class="part-card retake"
            >
              <div class="part-info">
                <span class="part-name">부품 식별 실패</span>
                <span class="confidence">신뢰도: {{ (part.confidence * 100).toFixed(1) }}%</span>
              </div>
              <div class="guidance">
                <h4>가이드:</h4>
                <ul>
                  <li v-for="suggestion in part.guidance.suggestions" :key="suggestion">
                    {{ suggestion }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 통계 대시보드 -->
      <div class="statistics-dashboard">
        <h3>검수 통계</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">총 검출</span>
            <span class="stat-value">{{ detectionState.statistics.totalDetected }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">자동 승인</span>
            <span class="stat-value">{{ detectionState.statistics.autoApproved }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">수동 검토</span>
            <span class="stat-value">{{ detectionState.statistics.manualReview }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">재촬영</span>
            <span class="stat-value">{{ detectionState.statistics.retakeRequired }}</span>
          </div>
        </div>
        <div class="accuracy-display">
          <span class="accuracy-label">정확도:</span>
          <span class="accuracy-value">{{ (detectionState.statistics.accuracy * 100).toFixed(1) }}%</span>
        </div>
        <div class="performance-stats" v-if="detectionState.statistics.averageProcessingTime">
          <div class="performance-item">
            <span class="performance-label">평균 처리 시간:</span>
            <span class="performance-value">{{ detectionState.statistics.averageProcessingTime.toFixed(1) }}ms</span>
          </div>
          <div class="performance-item">
            <span class="performance-label">효율성:</span>
            <span class="performance-value">최적화됨 (마스터 DB)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useOptimizedRealtimeDetection } from '../composables/useOptimizedRealtimeDetection'
import { useThresholdSystem } from '../composables/useThresholdSystem'
import { useLLMIntegration } from '../composables/useLLMIntegration'
import { useMasterPartsMatching } from '../composables/useMasterPartsMatching'

// 컴포저블 사용
const { 
  loading, 
  error, 
  detecting, 
  detectionState, 
  startOptimizedSession, 
  detectPartsOptimized, 
  getPerformanceStats, 
  endOptimizedSession 
} = useOptimizedRealtimeDetection()

const { processThresholdApproval } = useThresholdSystem()
const { rerankPartCandidates } = useLLMIntegration()

// 로컬 상태
const setNumber = ref('')
const cameraVideo = ref(null)
const cameraActive = ref(false)
const detectionResults = reactive({
  autoApproved: [],
  manualReview: [],
  retakeRequired: []
})

// 카메라 스트림
let cameraStream = null

// 세션 시작
const startSession = async () => {
  try {
    await startOptimizedSession(setNumber.value)
    await startCamera()
  } catch (err) {
    console.error('Failed to start session:', err)
  }
}

// 세션 종료
const endSession = async () => {
  try {
    await endOptimizedSession()
    await stopCamera()
  } catch (err) {
    console.error('Failed to end session:', err)
  }
}

// 카메라 시작
const startCamera = async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: 1280, 
        height: 720,
        facingMode: 'environment' // 후면 카메라 사용
      } 
    })
    
    if (cameraVideo.value) {
      cameraVideo.value.srcObject = cameraStream
      cameraActive.value = true
    }
  } catch (err) {
    console.error('Failed to start camera:', err)
    error.value = '카메라에 접근할 수 없습니다.'
  }
}

// 카메라 중지
const stopCamera = async () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop())
    cameraStream = null
    cameraActive.value = false
  }
}

// 카메라 토글
const toggleCamera = async () => {
  if (cameraActive.value) {
    await stopCamera()
  } else {
    await startCamera()
  }
}

// 프레임 캡처 및 검출 (최적화된 버전)
const captureFrame = async () => {
  if (!cameraVideo.value || !cameraActive.value) return
  
  try {
    // 캔버스에 프레임 그리기
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = cameraVideo.value.videoWidth
    canvas.height = cameraVideo.value.videoHeight
    ctx.drawImage(cameraVideo.value, 0, 0)
    
    // 이미지 데이터 추출
    const imageData = canvas.toDataURL('image/jpeg')
    
    // 최적화된 부품 검출 실행 (마스터 DB 활용)
    const detectionResult = await detectPartsOptimized(imageData)
    
    // 결과 업데이트
    detectionResults.autoApproved = detectionResult.approvalResults.autoApproved
    detectionResults.manualReview = detectionResult.approvalResults.manualReview
    detectionResults.retakeRequired = detectionResult.approvalResults.retakeRequired
    
    // 통계 업데이트
    detectionState.statistics = detectionResult.approvalResults.statistics
    
    // 성능 정보 표시
    console.log('🎯 Detection Performance:', detectionResult.performance)
    
  } catch (err) {
    console.error('Detection failed:', err)
    error.value = '부품 검출에 실패했습니다.'
  }
}

// 후보 선택
const selectCandidate = async (part, candidate) => {
  try {
    // 사용자 피드백 처리
    await processUserFeedback(part.id, {
      status: 'correct',
      correctedPartNum: candidate.part.part_num,
      correctedColorId: candidate.color.id
    })
    
    // 수동 검토 목록에서 제거
    const index = detectionResults.manualReview.findIndex(p => p.id === part.id)
    if (index > -1) {
      detectionResults.manualReview.splice(index, 1)
    }
    
    // 자동 승인 목록에 추가
    detectionResults.autoApproved.push({
      ...part,
      bestMatch: candidate,
      classification: { status: 'auto_approved' }
    })
    
  } catch (err) {
    console.error('Failed to select candidate:', err)
  }
}

// 컴포넌트 마운트 시 초기화
onMounted(() => {
  console.log('RealtimeDetection component mounted')
})

// 컴포넌트 언마운트 시 정리
onUnmounted(() => {
  stopCamera()
})
</script>

<style scoped>
.realtime-detection {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.detection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.session-info {
  display: flex;
  gap: 15px;
  align-items: center;
}

.session-id, .target-set {
  background: #f0f0f0;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 14px;
}

.end-session-btn {
  background: #ff4444;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
}

.session-setup {
  display: flex;
  justify-content: center;
  margin-top: 50px;
}

.setup-card {
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 400px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
}

.start-session-btn {
  width: 100%;
  background: #4CAF50;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
}

.start-session-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.detection-workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.camera-section {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.camera-container {
  position: relative;
  margin-bottom: 15px;
}

.camera-feed {
  width: 100%;
  height: 300px;
  object-fit: cover;
  border-radius: 10px;
  background: #000;
}

.camera-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
}

.detection-indicator {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 14px;
}

.detection-indicator.active {
  background: #4CAF50;
}

.camera-controls {
  display: flex;
  gap: 10px;
}

.capture-btn, .camera-toggle-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
}

.capture-btn {
  background: #2196F3;
  color: white;
}

.camera-toggle-btn {
  background: #ff9800;
  color: white;
}

.results-section {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  max-height: 600px;
  overflow-y: auto;
}

.result-group {
  margin-bottom: 30px;
}

.result-group h3 {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e0e0e0;
}

.parts-grid {
  display: grid;
  gap: 15px;
}

.part-card {
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid;
}

.part-card.approved {
  background: #e8f5e8;
  border-left-color: #4CAF50;
}

.part-card.manual {
  background: #fff3cd;
  border-left-color: #ffc107;
}

.part-card.retake {
  background: #f8d7da;
  border-left-color: #dc3545;
}

.part-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.part-name {
  font-weight: bold;
  font-size: 16px;
}

.part-color {
  color: #666;
  font-size: 14px;
}

.confidence {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.candidates {
  margin-top: 10px;
}

.candidates h4 {
  margin-bottom: 8px;
  font-size: 14px;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.candidate-item {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

.candidate-item:hover {
  background: #e9ecef;
}

.guidance {
  margin-top: 10px;
}

.guidance h4 {
  margin-bottom: 8px;
  font-size: 14px;
}

.guidance ul {
  margin: 0;
  padding-left: 20px;
}

.guidance li {
  margin-bottom: 5px;
  font-size: 14px;
}

.statistics-dashboard {
  grid-column: 1 / -1;
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 5px;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.accuracy-display {
  text-align: center;
  font-size: 18px;
}

.accuracy-label {
  color: #666;
  margin-right: 10px;
}

.accuracy-value {
  font-weight: bold;
  color: #4CAF50;
}

.performance-stats {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.performance-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.performance-label {
  color: #666;
}

.performance-value {
  font-weight: bold;
  color: #2196F3;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 10px;
  border-radius: 5px;
  margin-top: 10px;
}

@media (max-width: 768px) {
  .detection-workspace {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
