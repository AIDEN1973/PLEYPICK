<template>
  <div class="integrated-vision-detection">
    <!-- 헤더 -->
    <div class="detection-header">
      <h1>통합 비전 검수 시스템</h1>
      <div class="session-info" v-if="recognitionState.isActive">
        <span class="session-id">세션: {{ recognitionState.currentSession?.slice(0, 8) }}</span>
        <span class="target-set">세트: {{ recognitionState.targetSet }}</span>
        <div class="performance-indicator">
          <span class="processing-time">{{ recognitionState.processingStats.averageProcessingTime.toFixed(1) }}ms</span>
          <span class="success-rate">{{ ((recognitionState.processingStats.successfulMatches / Math.max(recognitionState.processingStats.totalProcessed, 1)) * 100).toFixed(1) }}%</span>
        </div>
        <button @click="endSession" class="end-session-btn">세션 종료</button>
      </div>
    </div>

    <!-- 세션 시작 섹션 -->
    <div v-if="!recognitionState.isActive" class="session-setup">
      <div class="setup-card">
        <h2>통합 검수 세션 시작</h2>
        <div class="form-group">
          <label for="setNumber">레고 세트 번호</label>
          <input 
            id="setNumber"
            v-model="setNumber" 
            type="text" 
            placeholder="76917"
            :disabled="loading"
          />
        </div>
        <div class="options-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="enableLLM" />
            LLM 재랭킹 활성화 (선택적)
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="enablePreprocessing" />
            이미지 전처리 활성화
          </label>
          <label class="checkbox-label">
            <!-- 시뮬레이션 모드 제거됨 -->
          </label>
        </div>
        <button 
          @click="startSession" 
          :disabled="loading || !setNumber"
          class="start-session-btn"
        >
          {{ loading ? '로딩 중...' : '통합 검수 시작' }}
        </button>
        <div v-if="error" class="error-message">{{ error }}</div>
        <div class="available-sets-section">
          <button @click="loadAvailableSets" class="show-sets-btn">
            사용 가능한 세트 보기
          </button>
          <div v-if="showAvailableSets && availableSets.length > 0" class="sets-list">
            <h4>데이터베이스에 있는 세트들:</h4>
            <div class="sets-grid">
              <div 
                v-for="set in availableSets" 
                :key="set.set_num"
                class="set-item"
                @click="setNumber = set.set_num"
              >
                <div class="set-number">{{ set.set_num }}</div>
                <div class="set-name">{{ set.name }}</div>
                <div class="set-info">{{ set.year }}년 • {{ set.num_parts }}개 부품</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 통합 검출 섹션 -->
    <div v-if="recognitionState.isActive" class="detection-workspace">
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
            <div class="detection-indicator" :class="{ active: processing }">
              {{ processing ? '인식 중...' : '대기 중' }}
            </div>
            <div class="quality-indicator" v-if="lastImageQuality">
              품질: {{ (lastImageQuality.overall * 100).toFixed(0) }}%
            </div>
          </div>
        </div>
        <div class="camera-controls">
          <button @click="captureFrame" :disabled="processing" class="capture-btn">
            부품 인식
          </button>
          <button @click="toggleCamera" class="camera-toggle-btn">
            {{ cameraActive ? '카메라 중지' : '카메라 시작' }}
          </button>
          <input 
            type="file" 
            @change="handleImageUpload" 
            accept="image/*" 
            class="image-upload-input"
            id="imageUpload"
            style="display: none;"
          />
          <button @click="triggerImageUpload" class="upload-btn">
            이미지 업로드
          </button>
        </div>
      </div>

      <!-- 인식 결과 영역 -->
      <div class="results-section">
        <!-- 자동 승인된 부품들 -->
        <div v-if="detectionResults.autoApproved.length > 0" class="result-group auto-approved">
          <h3>✅ 자동 승인된 부품 ({{ detectionResults.autoApproved.length }}개)</h3>
          <div class="parts-grid">
            <div 
              v-for="(part, index) in detectionResults.autoApproved" 
              :key="part.id || index"
              class="part-card approved"
            >
              <div class="part-info">
                <span class="part-name">{{ getPartName(part) }}</span>
                <span class="part-color">{{ getPartColor(part) }}</span>
                <span class="part-number">부품번호: {{ getPartNumber(part) }}</span>
                <span class="confidence">신뢰도: {{ getConfidence(part) }}%</span>
                <span class="final-score">최종점수: {{ getFinalScore(part) }}</span>
                <span class="quantity" v-if="getPartQuantity(part)">수량: {{ getPartQuantity(part) }}개</span>
              </div>
              <div class="processing-info">
                <span class="processing-method">통합 인식 (자동승인)</span>
                <span class="timestamp">{{ formatTimestamp(part.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 수동 검토 필요한 부품들 -->
        <div v-if="detectionResults.manualReview.length > 0" class="result-group manual-review">
          <h3>⚠️ 수동 검토 필요 ({{ detectionResults.manualReview.length }}개)</h3>
          <div class="parts-grid">
            <div 
              v-for="(part, index) in detectionResults.manualReview" 
              :key="part.id || index"
              class="part-card manual"
            >
              <div class="part-info">
                <span class="part-name">{{ getPartName(part) }}</span>
                <span class="part-color">{{ getPartColor(part) }}</span>
                <span class="part-number">부품번호: {{ getPartNumber(part) }}</span>
                <span class="confidence">신뢰도: {{ getConfidence(part) }}%</span>
                <span class="final-score">최종점수: {{ getFinalScore(part) }}</span>
              </div>
              <div class="candidates">
                <h4>후보 부품들:</h4>
                <div class="candidate-list">
                  <div 
                    v-for="(candidate, idx) in getTopCandidates(part)" 
                    :key="idx"
                    class="candidate-item"
                    @click="selectCandidate(part, candidate)"
                  >
                    {{ candidate.part?.name || '알 수 없는 부품' }} ({{ candidate.color?.name || '알 수 없는 색상' }})
                    <span class="candidate-score">점수: {{ (candidate.similarity * 100).toFixed(1) }}%</span>
                  </div>
                </div>
              </div>
              <div class="processing-info">
                <span class="processing-method">통합 인식 (수동검토)</span>
                <span class="timestamp">{{ formatTimestamp(part.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 재촬영 필요한 부품들 -->
        <div v-if="detectionResults.retakeRequired.length > 0" class="result-group retake-required">
          <h3>🔄 재촬영 필요 ({{ detectionResults.retakeRequired.length }}개)</h3>
          <div class="parts-grid">
            <div 
              v-for="(part, index) in detectionResults.retakeRequired" 
              :key="part.id || index"
              class="part-card retake"
            >
              <div class="part-info">
                <span class="part-name">{{ getPartName(part) || '부품 식별 실패' }}</span>
                <span class="part-color">{{ getPartColor(part) || '알 수 없는 색상' }}</span>
                <span class="confidence">신뢰도: {{ getConfidence(part) }}%</span>
                <span class="final-score">최종점수: {{ getFinalScore(part) }}</span>
              </div>
              <div class="guidance">
                <h4>재촬영 가이드:</h4>
                <ul>
                  <li v-for="suggestion in getGuidanceSuggestions(part)" :key="suggestion">
                    {{ suggestion }}
                  </li>
                </ul>
              </div>
              <div class="processing-info">
                <span class="processing-method">통합 인식 (재촬영필요)</span>
                <span class="timestamp">{{ formatTimestamp(part.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 통합 통계 대시보드 -->
      <div class="statistics-dashboard">
        <h3>통합 검수 통계</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">총 처리</span>
            <span class="stat-value">{{ totalProcessed }}</span>
          </div>
          <div class="stat-card success">
            <span class="stat-label">자동 승인</span>
            <span class="stat-value">{{ detectionResults.autoApproved.length }}</span>
          </div>
          <div class="stat-card warning">
            <span class="stat-label">수동 검토</span>
            <span class="stat-value">{{ detectionResults.manualReview.length }}</span>
          </div>
          <div class="stat-card error">
            <span class="stat-label">재촬영 필요</span>
            <span class="stat-value">{{ detectionResults.retakeRequired.length }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">성공률</span>
            <span class="stat-value">{{ successRate }}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">평균 신뢰도</span>
            <span class="stat-value">{{ averageConfidence }}%</span>
          </div>
        </div>
        <div class="performance-display">
          <div class="performance-item">
            <span class="performance-label">평균 처리 시간:</span>
            <span class="performance-value">{{ recognitionState.processingStats.averageProcessingTime.toFixed(1) }}ms</span>
          </div>
          <div class="performance-item">
            <span class="performance-label">효율성:</span>
            <span class="performance-value">통합 (마스터 DB + 비전)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useVisionIntegration } from '../composables/useVisionIntegration'
import { useMasterPartsMatching } from '../composables/useMasterPartsMatching'

// 컴포저블 사용
const { 
  loading, 
  error, 
  processing, 
  recognitionState, 
  startRecognitionSession, 
  processRealtimeRecognition, 
  endRecognitionSession 
} = useVisionIntegration()

const { getAvailableSets } = useMasterPartsMatching()

// 로컬 상태
const setNumber = ref('')
const enableLLM = ref(false)
const enablePreprocessing = ref(true)
// 시뮬레이션 모드 제거됨 - 실제 카메라만 사용
const cameraVideo = ref(null)
const cameraActive = ref(false)
const lastImageQuality = ref(null)
const availableSets = ref([])
const showAvailableSets = ref(false)
const detectionResults = reactive({
  autoApproved: [],
  manualReview: [],
  retakeRequired: []
})

// 카메라 스트림
let cameraStream = null

// 계산된 통계
const totalProcessed = computed(() => {
  return detectionResults.autoApproved.length + 
         detectionResults.manualReview.length + 
         detectionResults.retakeRequired.length
})

const successRate = computed(() => {
  if (totalProcessed.value === 0) return 0
  const successful = detectionResults.autoApproved.length + 
                    (detectionResults.manualReview.length * 0.5) // 수동 검토는 50% 성공으로 계산
  return Math.round((successful / totalProcessed.value) * 100)
})

const averageConfidence = computed(() => {
  const allResults = [
    ...detectionResults.autoApproved,
    ...detectionResults.manualReview,
    ...detectionResults.retakeRequired
  ]
  
  if (allResults.length === 0) return 0
  
  const totalConfidence = allResults.reduce((sum, result) => {
    return sum + (result.confidence || 0.5)
  }, 0)
  
  return Math.round((totalConfidence / allResults.length) * 100)
})

const averageProcessingTime = computed(() => {
  return recognitionState.processingStats.averageProcessingTime || 0
})

// 부품 정보 추출 헬퍼 함수들
const getPartName = (part) => {
  return part.part?.lego_parts?.name || 
         part.bestMatch?.part?.lego_parts?.name || 
         part.matchResult?.part?.lego_parts?.name || 
         part.detectedPart?.name || 
         '알 수 없는 부품'
}

const getPartColor = (part) => {
  return part.part?.lego_colors?.name ||
         part.bestMatch?.color?.lego_colors?.name || 
         part.matchResult?.color?.lego_colors?.name || 
         part.detectedPart?.color?.name || 
         '알 수 없는 색상'
}

const getPartNumber = (part) => {
  return part.part?.lego_parts?.part_num ||
         part.bestMatch?.part?.lego_parts?.part_num || 
         part.matchResult?.part?.lego_parts?.part_num || 
         part.detectedPart?.part_num || 
         part.part?.part_id ||  // fallback to part_id
         '알 수 없음'
}

const getConfidence = (part) => {
  return Math.round((part.confidence || 0.5) * 100)
}

const getFinalScore = (part) => {
  return (part.finalScore || 0).toFixed(3)
}

const getPartQuantity = (part) => {
  return part.partInfo?.quantity || part.part?.quantity || null
}

// 희귀도 함수 제거 - 수량 정보만 사용

const getTopCandidates = (part) => {
  return part.topCandidates || part.candidates || []
}

const getGuidanceSuggestions = (part) => {
  return part.guidance?.suggestions || [
    '카메라 각도를 조정해주세요.',
    '조명을 개선해주세요.',
    '부품을 더 명확하게 배치해주세요.'
  ]
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '알 수 없음'
  return new Date(timestamp).toLocaleTimeString()
}

// 사용 가능한 세트 로드
const loadAvailableSets = async () => {
  try {
    const sets = await getAvailableSets(20)
    availableSets.value = sets
    showAvailableSets.value = true
  } catch (err) {
    console.error('Failed to load available sets:', err)
  }
}

// 세션 시작
const startSession = async () => {
  try {
    // 환경 변수는 빌드 시점에 설정되므로 여기서는 로그만 출력
    console.log('LLM reranking enabled:', enableLLM.value)
    console.log('Image preprocessing enabled:', enablePreprocessing.value)
    // 시뮬레이션 모드 제거됨 - 실제 카메라만 사용

    await startRecognitionSession(setNumber.value)
    
    await startCamera()
  } catch (err) {
    console.error('Failed to start session:', err)
  }
}

// 세션 종료
const endSession = async () => {
  try {
    const result = await endRecognitionSession()
    await stopCamera()
    console.log('Session ended with stats:', result.finalStats)
  } catch (err) {
    console.error('Failed to end session:', err)
  }
}

// 카메라 시작
const startCamera = async () => {
  try {
    // 사용 가능한 카메라 장치 확인
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(device => device.kind === 'videoinput')
    
    if (videoDevices.length === 0) {
      throw new Error('카메라 장치를 찾을 수 없습니다.')
    }
    
    console.log('Available video devices:', videoDevices)
    
    // 카메라 요청 (더 유연한 옵션)
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: { ideal: 'environment' }
      }
    }
    
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints)
    
    if (cameraVideo.value) {
      cameraVideo.value.srcObject = cameraStream
      cameraActive.value = true
      console.log('Camera started successfully')
    }
  } catch (err) {
    console.error('Failed to start camera:', err)
    
    // 카메라 오류 타입별 메시지
    if (err.name === 'NotFoundError') {
      error.value = '카메라 장치를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.'
    } else if (err.name === 'NotAllowedError') {
      error.value = '카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.'
    } else if (err.name === 'NotReadableError') {
      error.value = '카메라가 다른 애플리케이션에서 사용 중입니다.'
    } else {
      error.value = `카메라 오류: ${err.message}`
    }
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

// 프레임 캡처 및 인식
const captureFrame = async () => {
  if (!cameraActive.value) return
  
  try {
    let imageData
    
    // 실제 카메라 모드만 사용
    if (!cameraVideo.value) return
      
    // 캔버스에 프레임 그리기
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = cameraVideo.value.videoWidth
    canvas.height = cameraVideo.value.videoHeight
    ctx.drawImage(cameraVideo.value, 0, 0)
    
    // 이미지 데이터 추출
    imageData = canvas.toDataURL('image/jpeg')
    
    // 통합 인식 처리 (옵션 전달)
    const recognitionResult = await processRealtimeRecognition(imageData, {
      enableLLM: enableLLM.value,
      enablePreprocessing: enablePreprocessing.value,
      maxDetections: 20,  // YOLO 검출 결과를 20개로 제한
      minDetConf: 0.5    // 신뢰도 0.5 이상만 사용
    })
    
    // 결과 업데이트
    detectionResults.autoApproved = recognitionResult.approvalResults.autoApproved
    detectionResults.manualReview = recognitionResult.approvalResults.manualReview
    detectionResults.retakeRequired = recognitionResult.approvalResults.retakeRequired
    
    // 이미지 품질 정보 저장
    lastImageQuality.value = recognitionResult.imageQuality
    
    // 성능 정보 표시
    console.log('🎯 Integrated Recognition Performance:', recognitionResult.performance)
    
  } catch (err) {
    console.error('Recognition failed:', err)
    error.value = '부품 인식에 실패했습니다.'
  }
}

// 시뮬레이션 함수 제거됨 - 실제 카메라만 사용

// 이미지 업로드 트리거
const triggerImageUpload = () => {
  const fileInput = document.getElementById('imageUpload')
  if (fileInput) {
    fileInput.click()
  }
}

// 이미지 업로드 처리
const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    console.log('Processing uploaded image:', file.name)
    
    // 이미지를 Base64로 변환
    const imageData = await convertFileToBase64(file)
    
    // 이미지 품질 평가
    const imageQuality = await assessImageQuality(imageData)
    lastImageQuality.value = imageQuality
    
    // 통합 인식 처리
    const recognitionResult = await processRealtimeRecognition(imageData, {
      enableLLM: enableLLM.value,
      enablePreprocessing: enablePreprocessing.value,
      maxDetections: 20,  // YOLO 검출 결과를 20개로 제한
      minDetConf: 0.5     // 신뢰도 0.5 이상만 사용
    })
    
    // 결과 업데이트
    detectionResults.autoApproved = recognitionResult.approvalResults.autoApproved
    detectionResults.manualReview = recognitionResult.approvalResults.manualReview
    detectionResults.retakeRequired = recognitionResult.approvalResults.retakeRequired
    
    // 성능 정보 표시
    console.log('🎯 Uploaded Image Recognition Performance:', recognitionResult.performance)
    
  } catch (err) {
    console.error('Image upload processing failed:', err)
    error.value = '이미지 처리에 실패했습니다.'
  }
}

// 파일을 Base64로 변환
const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 이미지 품질 평가 (useImageProcessing에서 가져옴)
const assessImageQuality = async (imageData) => {
  try {
    const img = new Image()
    return new Promise((resolve) => {
      img.onload = () => {
        const quality = {
          resolution: Math.min(Math.sqrt(img.width * img.height) / Math.sqrt(1920 * 1080), 1),
          brightness: 0.0, // 실제 측정 필요
          contrast: 0.0,   // 실제 측정 필요
          sharpness: 0.0, // 실제 측정 필요
          noise: 0.0,      // 실제 측정 필요
          overall: 0.0    // 실제 측정 필요
        }
        resolve(quality)
      }
      img.src = imageData
    })
  } catch (err) {
    console.error('Image quality assessment failed:', err)
    return {
      resolution: 0.5,
      brightness: 0.5,
      contrast: 0.5,
      sharpness: 0.5,
      noise: 0.5,
      overall: 0.5
    }
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

// 사용자 피드백 처리
const processUserFeedback = async (partId, feedback) => {
  console.log('User feedback processed:', { partId, feedback })
}

// 컴포넌트 마운트 시 초기화
onMounted(() => {
  console.log('IntegratedVisionDetection component mounted')
})

// 컴포넌트 언마운트 시 정리
onUnmounted(() => {
  stopCamera()
})
</script>

<style scoped>
.integrated-vision-detection {
  max-width: 1400px;
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

.performance-indicator {
  display: flex;
  gap: 10px;
  align-items: center;
}

.processing-time, .success-rate {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
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
  width: 450px;
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

.options-group {
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  font-size: 14px;
}

.checkbox-label input {
  margin-right: 8px;
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
  display: flex;
  flex-direction: column;
  gap: 5px;
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

.quality-indicator {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.camera-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.capture-btn, .camera-toggle-btn, .upload-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  min-width: 120px;
}

.capture-btn {
  background: #2196F3;
  color: white;
}

.camera-toggle-btn {
  background: #ff9800;
  color: white;
}

.upload-btn {
  background: #9c27b0;
  color: white;
}

.upload-btn:hover {
  background: #7b1fa2;
}

.image-upload-input {
  display: none;
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
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.part-info span {
  display: block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
}

.part-name {
  font-weight: bold;
  font-size: 16px;
  color: #2c3e50;
  background: #ecf0f1;
}

.part-color {
  color: #7f8c8d;
  background: #f8f9fa;
}

.part-number {
  color: #34495e;
  background: #e8f4f8;
  font-family: monospace;
}

.confidence {
  color: #27ae60;
  background: #d5f4e6;
  font-weight: bold;
}

.final-score {
  color: #8e44ad;
  background: #f4e6f7;
  font-weight: bold;
}

.quantity {
  color: #27ae60;
  background: #d5f4e6;
  font-weight: bold;
}

/* 희귀도 스타일 제거 - 수량 정보만 사용 */


.processing-info {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
}

.processing-method {
  color: #495057;
  font-weight: bold;
}

.timestamp {
  color: #6c757d;
  font-family: monospace;
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
  border-left: 4px solid #6c757d;
}

.stat-card.success {
  background: #d4edda;
  border-left-color: #28a745;
}

.stat-card.warning {
  background: #fff3cd;
  border-left-color: #ffc107;
}

.stat-card.error {
  background: #f8d7da;
  border-left-color: #dc3545;
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

.performance-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e0e0e0;
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

.available-sets-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.show-sets-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
}

.show-sets-btn:hover {
  background: #5a6268;
}

.sets-list {
  margin-top: 15px;
}

.sets-list h4 {
  margin-bottom: 10px;
  color: #333;
  font-size: 16px;
}

.sets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.set-item {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.set-item:hover {
  background: #e9ecef;
  border-color: #007bff;
  transform: translateY(-1px);
}

.set-number {
  font-weight: bold;
  color: #007bff;
  font-size: 14px;
  margin-bottom: 4px;
}

.set-name {
  color: #333;
  font-size: 13px;
  margin-bottom: 4px;
  line-height: 1.3;
}

.set-info {
  color: #666;
  font-size: 12px;
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
