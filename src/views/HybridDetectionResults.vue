<template>
  <div class="hybrid-detection-results">
    <!-- 헤더 -->
    <div class="results-header">
      <h2>🚀 하이브리드 검출 결과</h2>
      <div class="performance-stats">
        <div class="stat-item">
          <span class="stat-label">1차 FPS</span>
          <span class="stat-value">{{ performanceMetrics.stage1_fps.toFixed(1) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">2차 FPS</span>
          <span class="stat-value">{{ performanceMetrics.stage2_fps.toFixed(1) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">처리 시간</span>
          <span class="stat-value">{{ performanceMetrics.total_processing_time.toFixed(0) }}ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">메모리</span>
          <span class="stat-value">{{ performanceMetrics.memory_usage }}MB</span>
        </div>
      </div>
    </div>

    <!-- 2단계 검출 과정 -->
    <div class="detection-process">
      <!-- 1차 검출 결과 -->
      <div class="stage-results stage1">
        <div class="stage-header">
          <h3>🔍 1차 검출 (YOLO11n-seg)</h3>
          <div class="stage-status" :class="{ active: isStage1Ready }">
            {{ isStage1Ready ? '준비됨' : '로딩 중...' }}
          </div>
        </div>
        
        <div class="detection-grid">
          <div 
            v-for="(detection, index) in stage1Results" 
            :key="`stage1-${index}`"
            class="detection-item"
            :class="{ suspicious: detection.isSuspicious }"
          >
            <div class="detection-info">
              <span class="confidence">{{ (detection.confidence * 100).toFixed(1) }}%</span>
              <span class="class-name">{{ detection.className }}</span>
            </div>
            <div class="detection-box" :style="getBoxStyle(detection.boundingBox)">
              <div class="box-label">{{ detection.className }}</div>
            </div>
          </div>
        </div>
        
        <div class="stage-summary">
          <span>총 {{ stage1Results.length }}개 객체 검출</span>
          <span v-if="suspiciousCount > 0" class="suspicious-count">
            의심 영역 {{ suspiciousCount }}개
          </span>
        </div>
      </div>

      <!-- 2차 검증 결과 -->
      <div class="stage-results stage2" v-if="stage2Results.length > 0">
        <div class="stage-header">
          <h3>🔬 2차 검증 (YOLO11s-seg)</h3>
          <div class="stage-status" :class="{ active: isStage2Ready }">
            {{ isStage2Ready ? '준비됨' : '로딩 중...' }}
          </div>
        </div>
        
        <div class="detection-grid">
          <div 
            v-for="(detection, index) in stage2Results" 
            :key="`stage2-${index}`"
            class="detection-item verified"
          >
            <div class="detection-info">
              <span class="confidence">{{ (detection.confidence * 100).toFixed(1) }}%</span>
              <span class="class-name">{{ detection.className }}</span>
              <span class="verification-badge">검증됨</span>
            </div>
            
            <!-- Segmentation 마스크 표시 -->
            <div class="segmentation-mask" v-if="detection.mask">
              <canvas 
                :ref="`mask-${index}`"
                :width="detection.mask.width"
                :height="detection.mask.height"
                class="mask-canvas"
              ></canvas>
            </div>
            
            <div class="detection-box" :style="getBoxStyle(detection.boundingBox)">
              <div class="box-label verified">{{ detection.className }}</div>
            </div>
          </div>
        </div>
        
        <div class="stage-summary">
          <span>정밀 검증 {{ stage2Results.length }}개 객체</span>
          <span class="accuracy">{{ detectionAccuracy.toFixed(1) }}% 정확도</span>
        </div>
      </div>
    </div>

    <!-- 최종 누락 판정 -->
    <div class="final-results" v-if="finalResults.length > 0">
      <div class="final-header">
        <h3>🎯 최종 누락 판정</h3>
        <div class="missing-count">
          누락 부품 {{ missingPartsCount }}개
        </div>
      </div>
      
      <div class="missing-parts">
        <div 
          v-for="(part, index) in missingParts" 
          :key="`missing-${index}`"
          class="missing-part"
        >
          <div class="part-info">
            <span class="part-id">{{ part.partId }}</span>
            <span class="part-name">{{ part.partName }}</span>
            <span class="confidence">{{ (part.confidence * 100).toFixed(1) }}%</span>
          </div>
          <div class="part-mask" v-if="part.segmentationMask">
            <canvas 
              :ref="`missing-mask-${index}`"
              :width="part.segmentationMask.width"
              :height="part.segmentationMask.height"
              class="missing-mask-canvas"
            ></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- 검출 로그 -->
    <div class="detection-logs" v-if="detectionLogs.length > 0">
      <h3>📊 검출 로그</h3>
      <div class="logs-container">
        <div 
          v-for="(log, index) in detectionLogs" 
          :key="`log-${index}`"
          class="log-entry"
        >
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
          <span class="log-level" :class="log.level">{{ log.level }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useHybridYoloDetector } from '@/composables/useHybridYoloDetector.js'

export default {
  name: 'HybridDetectionResults',
  setup() {
    const {
      isInitialized,
      isStage1Ready,
      isStage2Ready,
      isDetecting,
      performanceMetrics,
      detectHybrid
    } = useHybridYoloDetector()
    
    // 검출 결과
    const stage1Results = ref([])
    const stage2Results = ref([])
    const finalResults = ref([])
    const detectionLogs = ref([])
    
    // 계산된 속성
    const suspiciousCount = computed(() => 
      stage1Results.value.filter(d => d.isSuspicious).length
    )
    
    const missingParts = computed(() => 
      finalResults.value.filter(r => r.isMissing)
    )
    
    const missingPartsCount = computed(() => missingParts.value.length)
    
    const detectionAccuracy = computed(() => {
      if (stage1Results.value.length === 0) return 0
      return (stage2Results.value.length / stage1Results.value.length) * 100
    })
    
    // 메서드
    const getBoxStyle = (boundingBox) => {
      return {
        left: `${boundingBox.x * 100}%`,
        top: `${boundingBox.y * 100}%`,
        width: `${boundingBox.width * 100}%`,
        height: `${boundingBox.height * 100}%`
      }
    }
    
    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString()
    }
    
    const drawSegmentationMask = (canvas, mask) => {
      if (!canvas || !mask) return
      
      const ctx = canvas.getContext('2d')
      const imageData = ctx.createImageData(mask.width, mask.height)
      
      // 마스크 데이터를 캔버스에 그리기
      for (let i = 0; i < mask.data.length; i++) {
        const pixelIndex = i * 4
        const maskValue = mask.data[i]
        
        imageData.data[pixelIndex] = 255 * maskValue     // R
        imageData.data[pixelIndex + 1] = 0              // G
        imageData.data[pixelIndex + 2] = 255 * maskValue // B
        imageData.data[pixelIndex + 3] = 128            // A
      }
      
      ctx.putImageData(imageData, 0, 0)
    }
    
    const updateDetectionResults = (results) => {
      stage1Results.value = results.stage1_results || []
      stage2Results.value = results.stage2_results || []
      finalResults.value = results.final_results || []
      
      // 로그 추가
      detectionLogs.value.unshift({
        timestamp: new Date().toISOString(),
        message: `검출 완료: 1차 ${stage1Results.value.length}개, 2차 ${stage2Results.value.length}개`,
        level: 'info'
      })
      
      // 로그 개수 제한
      if (detectionLogs.value.length > 50) {
        detectionLogs.value = detectionLogs.value.slice(0, 50)
      }
    }
    
    const runHybridDetection = async (imageData) => {
      try {
        const results = await detectHybrid(imageData, {
          suspicious_threshold: 0.3,
          min_suspicious_area: 0.01,
          stage1_config: {
            conf_threshold: 0.3,
            max_detections: 50
          },
          stage2_config: {
            conf_threshold: 0.5,
            max_detections: 20
          }
        })
        
        updateDetectionResults(results)
        
      } catch (error) {
        console.error('하이브리드 검출 실패:', error)
        detectionLogs.value.unshift({
          timestamp: new Date().toISOString(),
          message: `검출 실패: ${error.message}`,
          level: 'error'
        })
      }
    }
    
    // 마스크 그리기 (DOM 업데이트 후)
    const drawMasks = async () => {
      await nextTick()
      
      // 2차 검증 마스크 그리기
      stage2Results.value.forEach((detection, index) => {
        if (detection.mask) {
          const canvas = document.querySelector(`[ref="mask-${index}"]`)
          if (canvas) {
            drawSegmentationMask(canvas, detection.mask)
          }
        }
      })
      
      // 누락 부품 마스크 그리기
      missingParts.value.forEach((part, index) => {
        if (part.segmentationMask) {
          const canvas = document.querySelector(`[ref="missing-mask-${index}"]`)
          if (canvas) {
            drawSegmentationMask(canvas, part.segmentationMask)
          }
        }
      })
    }
    
    // 생명주기
    onMounted(async () => {
      try {
        await initializeHybridDetector()
        console.log('하이브리드 검출기 초기화 완료')
      } catch (error) {
        console.error('하이브리드 검출기 초기화 실패:', error)
      }
    })
    
    onUnmounted(() => {
      // 정리 작업
    })
    
    // 결과 변경 감지
    watch([stage2Results, missingParts], drawMasks, { deep: true })
    
    return {
      // 상태
      isInitialized,
      isStage1Ready,
      isStage2Ready,
      isDetecting,
      performanceMetrics,
      
      // 데이터
      stage1Results,
      stage2Results,
      finalResults,
      detectionLogs,
      
      // 계산된 속성
      suspiciousCount,
      missingParts,
      missingPartsCount,
      detectionAccuracy,
      
      // 메서드
      getBoxStyle,
      formatTime,
      runHybridDetection
    }
  }
}
</script>

<style scoped>
.hybrid-detection-results {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.results-header h2 {
  margin: 0;
  color: #333;
  font-size: 2rem;
}

.performance-stats {
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 15px;
  background: #f8f9fa;
  border-radius: 8px;
  min-width: 80px;
}

.stat-label {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
}

.detection-process {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.stage-results {
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 20px;
  background: #fff;
}

.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stage-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.3rem;
}

.stage-status {
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: bold;
  background: #f0f0f0;
  color: #666;
}

.stage-status.active {
  background: #d4edda;
  color: #155724;
}

.detection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.detection-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  background: #fafafa;
  position: relative;
}

.detection-item.suspicious {
  border-color: #ffc107;
  background: #fff3cd;
}

.detection-item.verified {
  border-color: #28a745;
  background: #d4edda;
}

.detection-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.confidence {
  font-weight: bold;
  color: #007bff;
}

.class-name {
  font-size: 0.9rem;
  color: #333;
}

.verification-badge {
  background: #28a745;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: bold;
}

.detection-box {
  position: relative;
  border: 2px solid #007bff;
  border-radius: 4px;
  background: rgba(0, 123, 255, 0.1);
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detection-box.verified {
  border-color: #28a745;
  background: rgba(40, 167, 69, 0.1);
}

.box-label {
  font-size: 0.8rem;
  font-weight: bold;
  color: #333;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: 3px;
}

.segmentation-mask {
  margin-top: 10px;
}

.mask-canvas {
  border: 1px solid #ddd;
  border-radius: 4px;
  max-width: 100%;
  height: auto;
}

.stage-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid #eee;
  font-size: 0.9rem;
  color: #666;
}

.suspicious-count {
  color: #ffc107;
  font-weight: bold;
}

.accuracy {
  color: #28a745;
  font-weight: bold;
}

.final-results {
  margin-top: 30px;
  border: 2px solid #dc3545;
  border-radius: 12px;
  padding: 20px;
  background: #f8d7da;
}

.final-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.final-header h3 {
  margin: 0;
  color: #721c24;
  font-size: 1.3rem;
}

.missing-count {
  background: #dc3545;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
}

.missing-parts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.missing-part {
  background: white;
  border: 1px solid #dc3545;
  border-radius: 8px;
  padding: 15px;
}

.part-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.part-id {
  font-weight: bold;
  color: #dc3545;
}

.part-name {
  font-size: 0.9rem;
  color: #333;
}

.part-mask {
  margin-top: 10px;
}

.missing-mask-canvas {
  border: 1px solid #dc3545;
  border-radius: 4px;
  max-width: 100%;
  height: auto;
}

.detection-logs {
  margin-top: 30px;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 20px;
  background: #f8f9fa;
}

.detection-logs h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.logs-container {
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 5px;
  background: white;
  border-radius: 4px;
  font-size: 0.9rem;
}

.log-time {
  color: #666;
  font-size: 0.8rem;
}

.log-message {
  flex: 1;
  margin: 0 10px;
  color: #333;
}

.log-level {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: bold;
}

.log-level.info {
  background: #d1ecf1;
  color: #0c5460;
}

.log-level.error {
  background: #f8d7da;
  color: #721c24;
}

@media (max-width: 768px) {
  .performance-stats {
    flex-direction: column;
    gap: 10px;
  }
  
  .detection-grid {
    grid-template-columns: 1fr;
  }
  
  .stage-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>
