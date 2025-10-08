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
          <!-- AR Overlay Canvas -->
          <canvas ref="overlayCanvas" class="overlay-canvas"></canvas>
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
          <button @click="saveCapture" :disabled="!cameraActive || !setNumber" class="camera-toggle-btn">
            캡처 저장
          </button>
          <button @click="fetchReport" :disabled="!setNumber" class="camera-toggle-btn">
            세트 리포트
          </button>
          <button @click="startContinuousCapture" :disabled="!cameraActive || isContinuous" class="camera-toggle-btn">
            계속 촬영
          </button>
          <button @click="stopContinuousCapture" :disabled="!isContinuous" class="camera-toggle-btn">
            촬영 종료
          </button>
          <button @click="prevCapture" class="camera-toggle-btn">이전 촬영</button>
          <button @click="nextCapture" class="camera-toggle-btn">다음 촬영</button>
          <span style="align-self:center; font-size:12px; color:#666;">현재: {{ currentCaptureIndex + 1 }}</span>
        </div>
      </div>

      <!-- 검출 결과 영역 -->
      <div class="results-section">
        <!-- 단일 부품 디텍션 테스트 -->
        <div class="result-group" style="margin-bottom:20px;">
          <h3>🔎 단일 부품 디텍션 테스트</h3>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <input v-model="expectedPartId" placeholder="확인할 부품 ID (예: 3001)" style="padding:8px; border:1px solid #ddd; border-radius:6px;" />
            <button @click="testCurrentFrame" :disabled="!cameraActive || !expectedPartId" class="capture-btn">현재 프레임 테스트</button>
            <label class="camera-toggle-btn" style="cursor:pointer;">
              이미지 업로드
              <input type="file" accept="image/*" @change="onUploadImageTest" style="display:none;" />
            </label>
            <span v-if="singleTest.status" :style="{ color: singleTest.status==='성공' ? '#27ae60' : '#e74c3c', fontWeight:'600' }">
              {{ singleTest.status }}
            </span>
            <span v-if="singleTest.status" style="color:#666;">(검출: {{ singleTest.foundPartId || '없음' }}, 신뢰도: {{ singleTest.confidence !== null ? (singleTest.confidence*100).toFixed(1)+'%' : '-' }})</span>
          </div>
        </div>

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
        <div class="performance-stats">
          <div class="performance-item">
            <span class="performance-label">연속 촬영</span>
            <span class="performance-value">{{ isContinuous ? '진행 중' : '대기' }} ({{ continuousCount }}장)</span>
          </div>
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
        <div v-if="reportState.loaded" class="performance-stats">
          <div class="performance-item">
            <span class="performance-label">세트 확인/누락</span>
            <span class="performance-value">{{ reportState.confirmed }}/{{ reportState.expected }} (누락 {{ reportState.missing }})</span>
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
import { useCaptures } from '../composables/useCaptures'

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
const { uploadCapture, getSetReport } = useCaptures()

// 로컬 상태
const setNumber = ref('')
const cameraVideo = ref(null)
const overlayCanvas = ref(null)
const cameraActive = ref(false)
let detectTimer = null
const detectionResults = reactive({
  autoApproved: [],
  manualReview: [],
  retakeRequired: []
})

// 리포트 상태
const reportState = reactive({
  loaded: false,
  expected: 0,
  confirmed: 0,
  missing: 0
})

// 단일 부품 디텍션 테스트
const expectedPartId = ref('')
const singleTest = reactive({ status: '', confidence: null, foundPartId: null })

// 연속 촬영 상태
const isContinuous = ref(false)
const continuousTimer = ref(null)
const continuousCount = ref(0)
const snapshotResults = ref([])
const aggregatedParts = reactive({ byPart: {}, uniqueCount: 0, totalDetections: 0 })
const currentCaptureIndex = ref(0)

// 카메라 스트림
let cameraStream = null

// 세션 시작
const startSession = async () => {
  try {
    await startOptimizedSession(setNumber.value)
    await startCamera()
    startAutoDetect()
  } catch (err) {
    console.error('Failed to start session:', err)
  }
}

// 세션 종료
const endSession = async () => {
  try {
    await endOptimizedSession()
    await stopCamera()
    stopAutoDetect()
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

      // 비디오 메타데이터가 로드되면 오버레이 캔버스 크기 동기화
      cameraVideo.value.onloadedmetadata = () => {
        syncOverlaySize()
        clearOverlay()
      }
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
    stopAutoDetect()
  } else {
    await startCamera()
    startAutoDetect()
  }
}

// 자동 검출 루프 (가벼운 주기)
const startAutoDetect = () => {
  if (detectTimer) return
  detectTimer = setInterval(async () => {
    try {
      await captureFrame()
    } catch (_) {}
  }, 800) // 0.8초 주기
}

const stopAutoDetect = () => {
  if (detectTimer) {
    clearInterval(detectTimer)
    detectTimer = null
  }
}

// 오버레이 캔버스 크기 동기화
const syncOverlaySize = () => {
  if (!cameraVideo.value || !overlayCanvas.value) return
  overlayCanvas.value.width = cameraVideo.value.videoWidth
  overlayCanvas.value.height = cameraVideo.value.videoHeight
  console.log('[AR] overlay synced:', overlayCanvas.value.width, overlayCanvas.value.height)
}

// 오버레이 지우기
const clearOverlay = () => {
  if (!overlayCanvas.value) return
  const ctx = overlayCanvas.value.getContext('2d')
  ctx.clearRect(0, 0, overlayCanvas.value.width, overlayCanvas.value.height)
}

// 검출 박스 그리기
const drawDetections = (detections = []) => {
  if (!overlayCanvas.value || !cameraVideo.value) return
  const ctx = overlayCanvas.value.getContext('2d')
  ctx.clearRect(0, 0, overlayCanvas.value.width, overlayCanvas.value.height)

  ctx.lineWidth = 3
  ctx.font = '14px Segoe UI'
  ctx.textBaseline = 'top'

  console.log('[AR] drawDetections count:', detections.length)

  detections.forEach((det, idx) => {
    // det.boundingBox 정규화 좌표 가정 {x,y,width,height} 0..1
    const bb = det.boundingBox || det.box || {}
    // 정규화 여부 판단 (폭/높이가 1 이하면 정규화로 가정)
    const isNormalized = (bb && bb.width <= 1 && bb.height <= 1)
    const x = Math.max(0, Math.floor((bb.x || 0) * (isNormalized ? overlayCanvas.value.width : 1)))
    const y = Math.max(0, Math.floor((bb.y || 0) * (isNormalized ? overlayCanvas.value.height : 1)))
    const w = Math.floor((bb.width || (isNormalized ? 1 : overlayCanvas.value.width)) * (isNormalized ? overlayCanvas.value.width : 1))
    const h = Math.floor((bb.height || (isNormalized ? 1 : overlayCanvas.value.height)) * (isNormalized ? overlayCanvas.value.height : 1))

    console.log('[AR] box', idx, { x, y, w, h, bb })

    // 윤곽선(글로우 효과)
    ctx.strokeStyle = 'rgba(80, 200, 120, 0.95)'
    ctx.shadowColor = 'rgba(80, 200, 120, 0.9)'
    ctx.shadowBlur = 12
    ctx.strokeRect(x, y, w, h)

    // 라벨
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(80, 200, 120, 0.85)'
    const confText = det && typeof det.confidence === 'number' ? `${(det.confidence * 100).toFixed(0)}%` : ''
    const label = `#${idx + 1} ${confText}`
    const textPadding = 4
    const tw = ctx.measureText(label).width + textPadding * 2
    const th = 18
    ctx.fillRect(x, Math.max(0, y - th - 2), tw, th)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, x + textPadding, Math.max(0, y - th - 2) + 2)
  })
}

// 프레임 캡처 및 검출 (최적화된 버전)
const captureFrame = async () => {
  if (!cameraVideo.value || !cameraActive.value) return
  // 이미 감지 중이면 중복 실행 방지
  if (detecting.value) {
    return
  }
  
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
    console.log('[AR] detectionResult keys:', Object.keys(detectionResult || {}))
    
    // 결과 업데이트
    detectionResults.autoApproved = detectionResult.approvalResults.autoApproved
    detectionResults.manualReview = detectionResult.approvalResults.manualReview
    detectionResults.retakeRequired = detectionResult.approvalResults.retakeRequired
    
    // 통계 업데이트
    detectionState.statistics = detectionResult.approvalResults.statistics
    
    // 성능 정보 표시
    console.log('🎯 Detection Performance:', detectionResult.performance)

    // AR 오버레이 그리기 (detections가 제공되는 경우)
    if (detectionResult.detections && Array.isArray(detectionResult.detections)) {
      console.log('[AR] detections received:', detectionResult.detections.length)
      syncOverlaySize()
      if (detectionResult.detections.length > 0) {
        drawDetections(detectionResult.detections)
      } else {
        clearOverlay()
      }
    } else if (detectionResult.detectedParts && Array.isArray(detectionResult.detectedParts)) {
      console.log('[AR] detections (fallback detectedParts):', detectionResult.detectedParts.length)
      syncOverlaySize()
      if (detectionResult.detectedParts.length > 0) {
        drawDetections(detectionResult.detectedParts)
      } else {
        clearOverlay()
      }
    } else {
      // 제공되지 않으면 전체 프레임에 가이드 사각형 표시(옵션)
      syncOverlaySize()
      clearOverlay()
      console.log('[AR] no detections provided')
    }
    
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

// 내부 유틸: 현재 프레임 dataURL 생성
const getCurrentFrameDataUrl = () => {
  if (!cameraVideo.value || !cameraActive.value) return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = cameraVideo.value.videoWidth
  canvas.height = cameraVideo.value.videoHeight
  ctx.drawImage(cameraVideo.value, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.9)
}

// 계속 촬영 시작: 일정 주기로 스냅샷 캡처/분석/업로드
const startContinuousCapture = async () => {
  if (isContinuous.value || !setNumber.value) return
  isContinuous.value = true
  continuousCount.value = 0
  snapshotResults.value = []
  aggregatedParts.byPart = {}
  aggregatedParts.uniqueCount = 0
  aggregatedParts.totalDetections = 0
  currentCaptureIndex.value = 0
  // 1초 간격 기본
  continuousTimer.value = setInterval(async () => {
    try {
      if (!cameraActive.value) return
      const imageData = getCurrentFrameDataUrl()
      if (!imageData) return
      // 검출 호출
      const result = await detectPartsOptimized(imageData)
      snapshotResults.value.push(result)
      currentCaptureIndex.value = snapshotResults.value.length - 1
      // 다부품 집계: detections 또는 detectedParts에서 part_num 수집
      const candidates = Array.isArray(result?.detections) ? result.detections : (result?.detectedParts || [])
      const partNums = []
      for (const det of candidates) {
        const pn = det?.bestMatch?.part?.part_num || det?.part?.part_num || det?.part_num
        if (pn) partNums.push(pn)
      }
      for (const pn of partNums) {
        aggregatedParts.byPart[pn] = (aggregatedParts.byPart[pn] || 0) + 1
        aggregatedParts.totalDetections += 1
      }
      aggregatedParts.uniqueCount = Object.keys(aggregatedParts.byPart).length
      continuousCount.value += 1
      // 저장(옵션): 최상위 파트 라벨로 캡처 저장
      let partId = null
      const approved = result?.approvalResults?.autoApproved || []
      if (approved.length > 0) partId = approved[0]?.bestMatch?.part?.part_num
      if (!partId) {
        const mr = result?.approvalResults?.manualReview || []
        const cand = mr[0]?.topCandidates?.[0]
        partId = cand?.part?.part_num || 'unknown'
      }
      await uploadCapture({ setNum: setNumber.value, partId, imageData })
    } catch (e) {
      console.error('continuous capture tick failed:', e)
    }
  }, 1000)
}

// 촬영 종료: 연속 캡처 중지 후 누적 결과 집계
const stopContinuousCapture = async () => {
  try {
    if (continuousTimer.value) {
      clearInterval(continuousTimer.value)
      continuousTimer.value = null
    }
    isContinuous.value = false
    // 최종 집계: 고유 부품 목록/카운트 출력
    const sorted = Object.entries(aggregatedParts.byPart)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
    console.log('연속 촬영 최종 집계:', {
      uniqueParts: aggregatedParts.uniqueCount,
      totalDetections: aggregatedParts.totalDetections,
      top20: sorted
    })
  } catch (e) {
    console.error('stopContinuousCapture failed:', e)
  }
}

// 이전/다음 촬영 네비게이션 (연속 촬영 재생성 아님, 인덱스 이동)
const prevCapture = () => {
  if (snapshotResults.value.length === 0) return
  currentCaptureIndex.value = Math.max(0, currentCaptureIndex.value - 1)
  // 필요 시 인덱스 기반 상세 표시/리뷰 로직 연결 가능
}

const nextCapture = () => {
  if (snapshotResults.value.length === 0) return
  currentCaptureIndex.value = Math.min(snapshotResults.value.length - 1, currentCaptureIndex.value + 1)
}

// 단일 테스트 공통 로직
const runSinglePartTest = async (imageData) => {
  singleTest.status = ''
  singleTest.confidence = null
  singleTest.foundPartId = null
  try {
    const result = await detectPartsOptimized(imageData)
    const candidates = Array.isArray(result?.detections) ? result.detections : (result?.detectedParts || [])
    // 최고 신뢰도 후보와 기대 파트 매칭
    let best = null
    let bestConf = -1
    let matchedConf = -1
    let matchedPart = null
    for (const det of candidates) {
      const pn = det?.bestMatch?.part?.part_num || det?.part?.part_num || det?.part_num
      const conf = typeof det?.confidence === 'number' ? det.confidence : (det?.score ?? 0)
      if (conf > bestConf) { bestConf = conf; best = pn }
      if (pn && expectedPartId.value && String(pn) === String(expectedPartId.value)) {
        matchedConf = Math.max(matchedConf, conf)
        matchedPart = pn
      }
    }
    if (matchedPart) {
      singleTest.status = '성공'
      singleTest.confidence = matchedConf
      singleTest.foundPartId = matchedPart
    } else {
      singleTest.status = '실패'
      singleTest.confidence = bestConf >= 0 ? bestConf : null
      singleTest.foundPartId = best
    }
  } catch (e) {
    console.error('runSinglePartTest failed:', e)
    singleTest.status = '오류'
  }
}

const testCurrentFrame = async () => {
  const data = getCurrentFrameDataUrl()
  if (!data) return
  await runSinglePartTest(data)
}

const onUploadImageTest = async (evt) => {
  try {
    const file = evt?.target?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e?.target?.result
      if (typeof dataUrl === 'string') {
        await runSinglePartTest(dataUrl)
      }
    }
    reader.readAsDataURL(file)
  } catch (e) {
    console.error('onUploadImageTest failed:', e)
  } finally {
    if (evt?.target) evt.target.value = ''
  }
}

// 캡처 저장: 현재 프레임을 dataURL로 저장, 최상위 검출 파트로 라벨링
const saveCapture = async () => {
  try {
    if (!cameraVideo.value || !cameraActive.value || !setNumber.value) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = cameraVideo.value.videoWidth
    canvas.height = cameraVideo.value.videoHeight
    ctx.drawImage(cameraVideo.value, 0, 0)
    const imageData = canvas.toDataURL('image/jpeg', 0.9)

    // 최상위 파트 결정: autoApproved 1순위, 없으면 manualReview의 첫 후보
    let partId = null
    if (detectionResults.autoApproved.length > 0) {
      partId = detectionResults.autoApproved[0]?.bestMatch?.part?.part_num || null
    }
    if (!partId && detectionResults.manualReview.length > 0) {
      const cand = detectionResults.manualReview[0]?.topCandidates?.[0]
      partId = cand?.part?.part_num || null
    }
    // 폴백: 미지정 시 'unknown'
    partId = partId || 'unknown'

    await uploadCapture({ setNum: setNumber.value, partId, imageData })
  } catch (e) {
    console.error('saveCapture failed:', e)
  }
}

// 세트 리포트 조회
const fetchReport = async () => {
  try {
    if (!setNumber.value) return
    const rep = await getSetReport(setNumber.value)
    reportState.loaded = true
    reportState.expected = rep?.counts?.expected || 0
    reportState.confirmed = rep?.counts?.confirmed || 0
    reportState.missing = rep?.counts?.missing || 0
  } catch (e) {
    console.error('fetchReport failed:', e)
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

/* AR overlay */
.overlay-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
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
