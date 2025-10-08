<template>
  <div class="closed-world-detection">
    <div class="header">
      <h1>🎯 폐쇄 세계 누락 검출</h1>
      <p>테이블 위 200개 부품에서 누락된 부품을 정확하게 찾아내는 시스템</p>
    </div>

    <!-- 설정 패널 -->
    <div class="config-panel">
      <h2>⚙️ 검출 설정</h2>
      
      <div class="config-grid">
        <div class="config-group">
          <label>세트 번호</label>
          <input 
            v-model="setNumber" 
            placeholder="예: 76917 (76917-1 자동 검색)"
            @keyup.enter="loadBOM"
          />
          <button @click="loadBOM" class="btn-secondary">실제 BOM 로드</button>
        </div>

        <div class="config-group">
          <label>검출 모드</label>
          <select v-model="detectionMode">
            <option value="single">단일 이미지</option>
            <option value="multi">다중 이미지</option>
            <option value="continuous">연속 검출</option>
          </select>
        </div>

        <div class="config-group">
          <label>폐쇄 세계 필터</label>
          <div class="checkbox-group">
            <label>
              <input type="checkbox" v-model="filters.classWhitelist" />
              BOM 클래스만 허용
            </label>
            <label>
              <input type="checkbox" v-model="filters.colorWhitelist" />
              BOM 색상 우선
            </label>
            <label>
              <input type="checkbox" v-model="filters.allowAlternates" />
              대체 부품 허용
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- BOM 정보 -->
    <div class="bom-panel" v-if="detectionState.bomParts.length > 0">
      <h2>📋 BOM 정보</h2>
      <div class="bom-stats">
        <div class="stat-item">
          <span class="stat-label">총 부품 수:</span>
          <span class="stat-value">{{ detectionState.bomParts.length }}개</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">색상 수:</span>
          <span class="stat-value">{{ detectionState.bomColors.length }}개</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">여분 부품:</span>
          <span class="stat-value">{{ sparePartsCount }}개</span>
        </div>
      </div>
    </div>

    <!-- 카메라 컨트롤 -->
    <div class="camera-panel">
      <h2>📷 카메라 컨트롤</h2>
      
      <div class="camera-controls">
        <button 
          @click="toggleCamera" 
          :class="cameraActive ? 'btn-danger' : 'btn-primary'"
        >
          {{ cameraActive ? '카메라 중지' : '카메라 시작' }}
        </button>
        
        <button 
          @click="captureAndDetect" 
          :disabled="!cameraActive || !setNumber"
          class="btn-primary"
        >
          📸 촬영 & 검출
        </button>
      </div>

      <!-- 카메라 비디오 -->
      <div class="camera-container" v-show="cameraActive">
        <video 
          ref="cameraVideo" 
          autoplay 
          muted 
          playsinline
          class="camera-video"
          @loadedmetadata="onVideoLoaded"
          @canplay="onVideoCanPlay"
        ></video>
        <canvas 
          ref="overlayCanvas" 
          class="overlay-canvas"
        ></canvas>
        <div class="camera-status" v-if="cameraActive">
          <span class="status-indicator">●</span>
          카메라 활성화됨
        </div>
      </div>
    </div>

    <!-- 검출 결과 -->
    <div class="results-panel" v-if="detectionState.missingParts.length > 0 || detectionState.matchedParts.length > 0">
      <h2>🎯 검출 결과</h2>
      
      <!-- 통계 -->
      <div class="results-stats">
        <div class="stat-card success">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <h3>{{ detectionState.statistics.autoApproved }}</h3>
            <p>매칭된 부품</p>
          </div>
        </div>
        
        <div class="stat-card error">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <h3>{{ detectionState.statistics.missing }}</h3>
            <p>누락된 부품</p>
          </div>
        </div>
        
        <div class="stat-card warning">
          <div class="stat-icon">❓</div>
          <div class="stat-content">
            <h3>{{ detectionState.statistics.ambiguous }}</h3>
            <p>애매한 부품</p>
          </div>
        </div>
        
        <div class="stat-card info">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <h3>{{ detectionState.statistics.accuracy.toFixed(1) }}%</h3>
            <p>정확도</p>
          </div>
        </div>
      </div>

      <!-- 누락된 부품 목록 -->
      <div class="missing-parts" v-if="detectionState.missingParts.length > 0">
        <h3>❌ 누락된 부품</h3>
        <div class="parts-list">
          <div 
            v-for="part in detectionState.missingParts" 
            :key="`${part.part_id}-${part.color_id}`"
            class="part-item missing"
          >
            <div class="part-info">
              <span class="part-id">{{ part.part_id }}</span>
              <span class="part-color">색상: {{ part.color_id }}</span>
              <span class="part-quantity">수량: {{ part.quantity_missing }}</span>
            </div>
            <div class="part-confidence">
              신뢰도: {{ part.confidence }}
            </div>
          </div>
        </div>
      </div>

      <!-- 애매한 부품 목록 -->
      <div class="ambiguous-parts" v-if="detectionState.ambiguousParts.length > 0">
        <h3>❓ 애매한 부품 (보류)</h3>
        <div class="parts-list">
          <div 
            v-for="part in detectionState.ambiguousParts" 
            :key="`${part.part_id}-${part.color_id}`"
            class="part-item ambiguous"
          >
            <div class="part-info">
              <span class="part-id">{{ part.part_id }}</span>
              <span class="part-color">색상: {{ part.color_id }}</span>
              <span class="part-quantity">수량: {{ part.quantity_missing }}</span>
            </div>
            <div class="part-actions">
              <button @click="approvePart(part)" class="btn-small btn-success">승인</button>
              <button @click="rejectPart(part)" class="btn-small btn-danger">거부</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 로딩 상태 -->
    <div class="loading-overlay" v-if="loading">
      <div class="loading-spinner"></div>
      <p>검출 중...</p>
    </div>

    <!-- 에러 메시지 -->
    <div class="error-message" v-if="error">
      <p>❌ {{ error }}</p>
      <button @click="error = null" class="btn-small">닫기</button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useClosedWorldDetection } from '@/composables/useClosedWorldDetection'

export default {
  name: 'ClosedWorldDetection',
  setup() {
    const { 
      detectionState, 
      loadBOMParts, 
      detectMissingParts 
    } = useClosedWorldDetection()

    // 반응형 데이터
    const loading = ref(false)
    const error = ref(null)
    const setNumber = ref('')
    const detectionMode = ref('single')
    const cameraActive = ref(false)
    const cameraVideo = ref(null)
    const overlayCanvas = ref(null)
    let cameraStream = null

    // 폐쇄 세계 필터 설정
    const filters = reactive({
      classWhitelist: true,
      colorWhitelist: true,
      allowAlternates: true
    })

    // 계산된 속성
    const sparePartsCount = computed(() => {
      return detectionState.bomParts.filter(part => part.is_spare).length
    })

    // 메서드
    const loadBOM = async () => {
      if (!setNumber.value) return
      
      try {
        loading.value = true
        console.log(`🔍 실제 데이터 로드 시작: ${setNumber.value} (변형 자동 검색)`)
        await loadBOMParts(setNumber.value)
        console.log('✅ 실제 BOM 로드 완료 (변형 포함)')
      } catch (err) {
        console.error('❌ 실제 데이터 로드 실패:', err)
        error.value = `실제 데이터 로드 실패: ${err.message}`
      } finally {
        loading.value = false
      }
    }

    const toggleCamera = async () => {
      if (cameraActive.value) {
        await stopCamera()
      } else {
        await startCamera()
      }
    }

    const startCamera = async () => {
      try {
        console.log('📷 카메라 시작 중...')
        
        // 카메라 권한 요청
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: 'environment' }
          } 
        })
        
        cameraStream = stream
        console.log('📷 카메라 스트림 획득 완료')
        
        // 카메라 활성화 상태를 먼저 설정하여 DOM이 렌더링되도록 함
        cameraActive.value = true
        
        // DOM 업데이트를 기다린 후 비디오 엘리먼트 연결
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const videoElement = cameraVideo.value
        if (videoElement) {
          videoElement.srcObject = stream
          await videoElement.play()
          console.log('✅ 카메라 시작 완료')
        } else {
          console.error('❌ 카메라 비디오 엘리먼트를 찾을 수 없습니다')
          console.log('❌ cameraVideo.value:', cameraVideo.value)
          console.log('❌ cameraVideo ref:', cameraVideo)
          // 카메라 활성화 상태를 되돌림
          cameraActive.value = false
        }
      } catch (err) {
        console.error('❌ 카메라 시작 실패:', err)
        error.value = `카메라 접근 실패: ${err.message}`
        cameraActive.value = false
      }
    }

    const stopCamera = async () => {
      try {
        console.log('📷 카메라 중지 중...')
        
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => {
            track.stop()
            console.log('🛑 카메라 트랙 중지:', track.kind)
          })
          cameraStream = null
        }
        
        if (cameraVideo.value) {
          cameraVideo.value.srcObject = null
        }
        
        cameraActive.value = false
        console.log('✅ 카메라 중지 완료')
      } catch (err) {
        console.error('❌ 카메라 중지 실패:', err)
      }
    }

    const captureAndDetect = async () => {
      if (!cameraVideo.value || !cameraActive.value) {
        console.log('❌ 카메라가 활성화되지 않았습니다')
        return
      }
      
      try {
        loading.value = true
        console.log('📸 프레임 캡처 중...')
        
        // 캔버스에 프레임 그리기
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = cameraVideo.value.videoWidth || 1280
        canvas.height = cameraVideo.value.videoHeight || 720
        ctx.drawImage(cameraVideo.value, 0, 0)
        
        // 이미지 데이터 추출
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        console.log('📸 프레임 캡처 완료, 이미지 크기:', canvas.width, 'x', canvas.height)
        
        // 폐쇄 세계 누락 검출 실행
        if (setNumber.value) {
          await detectMissingParts(imageData, setNumber.value)
          console.log('✅ 검출 완료')
        } else {
          error.value = '세트 번호를 먼저 입력하세요'
        }
      } catch (err) {
        console.error('❌ 캡처/검출 실패:', err)
        error.value = `캡처/검출 실패: ${err.message}`
      } finally {
        loading.value = false
      }
    }

    const approvePart = (part) => {
      // 애매한 부품을 승인 처리
      const index = detectionState.ambiguousParts.findIndex(p => 
        p.part_id === part.part_id && p.color_id === part.color_id
      )
      if (index > -1) {
        detectionState.ambiguousParts.splice(index, 1)
        detectionState.matchedParts.push(part)
      }
    }

    const rejectPart = (part) => {
      // 애매한 부품을 거부 처리
      const index = detectionState.ambiguousParts.findIndex(p => 
        p.part_id === part.part_id && p.color_id === part.color_id
      )
      if (index > -1) {
        detectionState.ambiguousParts.splice(index, 1)
        detectionState.missingParts.push(part)
      }
    }

    // 비디오 로드 이벤트
    const onVideoLoaded = () => {
      console.log('📹 비디오 메타데이터 로드 완료')
      console.log('📹 비디오 크기:', cameraVideo.value?.videoWidth, 'x', cameraVideo.value?.videoHeight)
    }

    const onVideoCanPlay = () => {
      console.log('📹 비디오 재생 준비 완료')
      console.log('📹 비디오 크기:', cameraVideo.value?.videoWidth, 'x', cameraVideo.value?.videoHeight)
    }

    // 생명주기
    onMounted(() => {
      console.log('🎯 폐쇄 세계 누락 검출 시스템 초기화')
    })

    onUnmounted(() => {
      stopCamera()
    })

    return {
      detectionState,
      loading,
      error,
      setNumber,
      detectionMode,
      cameraActive,
      cameraVideo,
      overlayCanvas,
      filters,
      sparePartsCount,
      loadBOM,
      toggleCamera,
      captureAndDetect,
      approvePart,
      rejectPart,
      onVideoLoaded,
      onVideoCanPlay
    }
  }
}
</script>

<style scoped>
.closed-world-detection {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.header p {
  color: #7f8c8d;
  font-size: 16px;
}

.config-panel, .bom-panel, .camera-panel, .results-panel {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-group label {
  font-weight: 600;
  color: #2c3e50;
}

.config-group input, .config-group select {
  padding: 10px;
  border: 2px solid #e1e8ed;
  border-radius: 8px;
  font-size: 14px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
}

.bom-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-label {
  font-weight: 600;
  color: #2c3e50;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #3498db;
}

.camera-controls {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.camera-container {
  position: relative;
  max-width: 640px;
  margin: 0 auto;
  border: 2px solid #e1e8ed;
  border-radius: 12px;
  overflow: hidden;
}

.camera-video {
  width: 100%;
  height: auto;
  display: block;
  background: #000;
}

.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.camera-status {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-indicator {
  color: #27ae60;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.results-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.stat-card.success {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
  color: white;
}

.stat-card.error {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
}

.stat-card.warning {
  background: linear-gradient(135deg, #f39c12, #e67e22);
  color: white;
}

.stat-card.info {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
}

.stat-icon {
  font-size: 32px;
}

.stat-content h3 {
  font-size: 24px;
  margin: 0;
}

.stat-content p {
  margin: 5px 0 0 0;
  opacity: 0.9;
}

.parts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.part-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  border: 2px solid;
}

.part-item.missing {
  border-color: #e74c3c;
  background: #fdf2f2;
}

.part-item.ambiguous {
  border-color: #f39c12;
  background: #fef9e7;
}

.part-info {
  display: flex;
  gap: 15px;
  align-items: center;
}

.part-id {
  font-weight: bold;
  font-size: 16px;
}

.part-color, .part-quantity {
  color: #7f8c8d;
  font-size: 14px;
}

.part-actions {
  display: flex;
  gap: 10px;
}

.btn-primary, .btn-secondary, .btn-danger, .btn-success {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #e74c3c;
  color: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 15px;
}

@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .results-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .camera-controls {
    flex-direction: column;
  }
}
</style>
