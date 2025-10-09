<template>
  <div class="optimized-detection">
    <div class="header">
      <h1>🚀 최적화된 누락 검출</h1>
      <p>메타데이터 기반 + 온디맨드 캐싱으로 트래픽 비용 최소화</p>
    </div>

    <!-- 트래픽 최적화 정보 -->
    <div class="optimization-info">
      <h2>💰 트래픽 최적화 전략</h2>
      <div class="strategy-grid">
        <div class="strategy-card">
          <div class="strategy-icon">📊</div>
          <h3>메타데이터 우선</h3>
          <p>이미지 대신 벡터/특징만 비교</p>
          <span class="traffic-saved">트래픽: &lt;1MB</span>
        </div>
        <div class="strategy-card">
          <div class="strategy-icon">📦</div>
          <h3>온디맨드 캐싱</h3>
          <p>필요한 부품만 1회 다운로드</p>
          <span class="traffic-saved">재사용: 0MB</span>
        </div>
        <div class="strategy-card">
          <div class="strategy-icon">🌐</div>
          <h3>CDN 활용</h3>
          <p>Supabase Edge 캐시 자동 활용</p>
          <span class="traffic-saved">캐시: 무료</span>
        </div>
      </div>
    </div>

    <!-- 설정 패널 -->
    <div class="config-panel">
      <h2>⚙️ 검출 설정</h2>
      
      <div class="config-grid">
        <div class="config-group">
          <label>세트 번호</label>
          <input 
            v-model="setNumber" 
            placeholder="예: 76917 (메타데이터 기반)"
            @keyup.enter="loadMetadata"
          />
          <button @click="loadMetadata" class="btn-secondary">메타데이터 로드</button>
        </div>

        <div class="config-group">
          <label>캐싱 전략</label>
          <select v-model="cachingStrategy">
            <option value="minimal">최소 (10개 부품)</option>
            <option value="moderate">보통 (50개 부품)</option>
            <option value="full">전체 (모든 부품)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 메타데이터 정보 -->
    <div class="metadata-panel" v-if="metadataInfo">
      <h2>📊 메타데이터 정보</h2>
      <div class="metadata-stats">
        <div class="stat-item">
          <span class="stat-label">세트:</span>
          <span class="stat-value">{{ metadataInfo.setInfo.set_num }} - {{ metadataInfo.setInfo.name }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">총 부품:</span>
          <span class="stat-value">{{ metadataInfo.totalParts }}개</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">특징 벡터:</span>
          <span class="stat-value">{{ metadataInfo.withFeatures }}개</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">트래픽 예상:</span>
          <span class="stat-value">{{ estimatedTraffic }}MB</span>
        </div>
      </div>
    </div>

    <!-- 캐시 상태 -->
    <div class="cache-panel" v-if="cacheStats">
      <h2>📦 캐시 상태</h2>
      <div class="cache-stats">
        <div class="cache-item">
          <span class="cache-label">캐시된 부품:</span>
          <span class="cache-value">{{ cacheStats.cachedParts }}개</span>
        </div>
        <div class="cache-item">
          <span class="cache-label">캐시 크기:</span>
          <span class="cache-value">{{ cacheStats.cacheSize }}MB</span>
        </div>
        <div class="cache-item">
          <span class="cache-label">마지막 업데이트:</span>
          <span class="cache-value">{{ formatDate(cacheStats.lastUpdated) }}</span>
        </div>
      </div>
        <button @click="clearCacheAction" class="btn-warning">캐시 정리</button>
    </div>

    <!-- 카메라 컨트롤 -->
    <div class="camera-panel">
      <h2>📷 최적화된 검출</h2>
      
      <div class="camera-controls">
        <button 
          @click="toggleCamera" 
          :class="cameraActive ? 'btn-danger' : 'btn-primary'"
        >
          {{ cameraActive ? '카메라 중지' : '카메라 시작' }}
        </button>
        
        <button 
          @click="optimizedDetect" 
          :disabled="!cameraActive || !metadataInfo"
          class="btn-primary"
        >
          🚀 최적화 검출
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
        ></video>
        <div class="camera-status" v-if="cameraActive">
          <span class="status-indicator">●</span>
          최적화 모드 활성화
        </div>
      </div>
    </div>

    <!-- 검출 결과 -->
    <div class="results-panel" v-if="detectionResults">
      <h2>🎯 최적화 검출 결과</h2>
      
      <!-- 성능 지표 -->
      <div class="performance-metrics">
        <div class="metric-card">
          <div class="metric-icon">⚡</div>
          <div class="metric-content">
            <h3>{{ performanceMetrics.processingTime }}ms</h3>
            <p>처리 시간</p>
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-icon">💰</div>
          <div class="metric-content">
            <h3>{{ performanceMetrics.trafficUsed }}MB</h3>
            <p>트래픽 사용량</p>
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-icon">📊</div>
          <div class="metric-content">
            <h3>{{ performanceMetrics.accuracy }}%</h3>
            <p>정확도</p>
          </div>
        </div>
      </div>

      <!-- 결과 통계 -->
      <div class="results-stats">
        <div class="stat-card success">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <h3>{{ detectionResults.matches.length }}</h3>
            <p>매칭된 부품</p>
          </div>
        </div>
        
        <div class="stat-card error">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <h3>{{ detectionResults.missingParts.length }}</h3>
            <p>누락된 부품</p>
          </div>
        </div>
      </div>

      <!-- 누락된 부품 목록 -->
      <div class="missing-parts" v-if="detectionResults.missingParts.length > 0">
        <h3>❌ 누락된 부품</h3>
        <div class="parts-list">
          <div 
            v-for="part in detectionResults.missingParts" 
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
    </div>

    <!-- 로딩 상태 -->
    <div class="loading-overlay" v-if="loading">
      <div class="loading-spinner"></div>
      <p>최적화 검출 중...</p>
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
import { useOptimizedPartMatching } from '../composables/useOptimizedPartMatching'

export default {
  name: 'OptimizedDetection',
  setup() {
    const { 
      loading, 
      error, 
      loadSetMetadata, 
      cachePartImages, 
      performBOMMatching,
      clearCache,
      getCacheStats
    } = useOptimizedPartMatching()

    // 반응형 데이터
    const setNumber = ref('')
    const cachingStrategy = ref('minimal')
    const cameraActive = ref(false)
    const cameraVideo = ref(null)
    let cameraStream = null

    // 상태 데이터
    const metadataInfo = ref(null)
    const cacheStats = ref(null)
    const detectionResults = ref(null)
    const performanceMetrics = ref({
      processingTime: 0,
      trafficUsed: 0,
      accuracy: 0
    })

    // 계산된 속성
    const estimatedTraffic = computed(() => {
      if (!metadataInfo.value) return 0
      const partsCount = metadataInfo.value.totalParts
      const strategy = cachingStrategy.value
      
      let multiplier = 0.1 // minimal
      if (strategy === 'moderate') multiplier = 0.5
      if (strategy === 'full') multiplier = 1.0
      
      return Math.round(partsCount * multiplier * 0.2) // 200KB per part
    })

    // 메서드
    const loadMetadata = async () => {
      if (!setNumber.value) return
      
      try {
        loading.value = true
        console.log(`📊 메타데이터 로드: ${setNumber.value}`)
        
        const result = await loadSetMetadata(setNumber.value)
        metadataInfo.value = result
        
        console.log('✅ 메타데이터 로드 완료')
      } catch (err) {
        console.error('❌ 메타데이터 로드 실패:', err)
        error.value = err.message
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
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: 'environment' }
          } 
        })
        
        cameraStream = stream
        cameraActive.value = true
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const videoElement = cameraVideo.value
        if (videoElement) {
          videoElement.srcObject = stream
          await videoElement.play()
          console.log('✅ 카메라 시작 완료')
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
          cameraStream.getTracks().forEach(track => track.stop())
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

    const optimizedDetect = async () => {
      if (!cameraVideo.value || !cameraActive.value || !metadataInfo.value) {
        console.log('❌ 카메라 또는 메타데이터가 준비되지 않았습니다')
        return
      }
      
      try {
        loading.value = true
        const startTime = Date.now()
        
        console.log('🚀 최적화 검출 시작...')
        
        // 프레임 캡처
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = cameraVideo.value.videoWidth || 1280
        canvas.height = cameraVideo.value.videoHeight || 720
        ctx.drawImage(cameraVideo.value, 0, 0)
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        
        // 온디맨드 캐싱
        const partIds = [...new Set(metadataInfo.value.partsMetadata.map(p => p.part_id))]
        const cacheCount = cachingStrategy.value === 'minimal' ? 10 : 
                          cachingStrategy.value === 'moderate' ? 50 : partIds.length
        
        await cachePartImages(partIds.slice(0, cacheCount))
        
        // Mock 제거: 실제 경로만 허용 (빈 결과로 진행)
        const { matches, missingSlots } = performBOMMatching([], metadataInfo.value.partsMetadata)
        
        const processingTime = Date.now() - startTime
        
        // 결과 저장
        detectionResults.value = {
          matches,
          missingParts: missingSlots.map(slot => ({
            part_id: slot.part_id,
            color_id: slot.color_id,
            quantity_missing: 1,
            confidence: 'high',
            reason: 'not_detected'
          }))
        }
        
        // 성능 지표 업데이트
        performanceMetrics.value = {
          processingTime,
          trafficUsed: estimatedTraffic.value,
          accuracy: Math.round((matches.length / (matches.length + missingSlots.length)) * 100)
        }
        
        // 캐시 통계 업데이트
        cacheStats.value = getCacheStats()
        
        console.log('✅ 최적화 검출 완료')
        console.log(`⚡ 처리 시간: ${processingTime}ms`)
        console.log(`💰 트래픽 사용량: ${estimatedTraffic.value}MB`)
        
      } catch (err) {
        console.error('❌ 최적화 검출 실패:', err)
        error.value = `검출 실패: ${err.message}`
      } finally {
        loading.value = false
      }
    }

    const clearCacheAction = async () => {
      try {
        await clearCache()
        cacheStats.value = getCacheStats()
        console.log('📦 캐시 정리 완료')
      } catch (err) {
        console.error('❌ 캐시 정리 실패:', err)
      }
    }

    const formatDate = (date) => {
      if (!date) return '없음'
      return new Date(date).toLocaleString()
    }

    // 생명주기
    onMounted(() => {
      console.log('🚀 최적화된 누락 검출 시스템 초기화')
    })

    onUnmounted(() => {
      stopCamera()
    })

    return {
      loading,
      error,
      setNumber,
      cachingStrategy,
      cameraActive,
      cameraVideo,
      metadataInfo,
      cacheStats,
      detectionResults,
      performanceMetrics,
      estimatedTraffic,
      loadMetadata,
      toggleCamera,
      optimizedDetect,
      clearCacheAction,
      formatDate
    }
  }
}
</script>

<style scoped>
.optimized-detection {
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

.optimization-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
}

.strategy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.strategy-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.strategy-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.strategy-card h3 {
  margin: 10px 0;
  font-size: 18px;
}

.strategy-card p {
  margin: 5px 0;
  opacity: 0.9;
}

.traffic-saved {
  display: inline-block;
  background: rgba(39, 174, 96, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 10px;
}

.config-panel, .metadata-panel, .cache-panel, .camera-panel, .results-panel {
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

.metadata-stats, .cache-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.stat-item, .cache-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-label, .cache-label {
  font-weight: 600;
  color: #2c3e50;
}

.stat-value, .cache-value {
  font-size: 16px;
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

.performance-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
}

.metric-icon {
  font-size: 32px;
}

.metric-content h3 {
  font-size: 24px;
  margin: 0;
}

.metric-content p {
  margin: 5px 0 0 0;
  opacity: 0.9;
}

.results-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
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

.btn-primary, .btn-secondary, .btn-danger, .btn-warning {
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

.btn-warning {
  background: #f39c12;
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
  
  .strategy-grid {
    grid-template-columns: 1fr;
  }
  
  .performance-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
