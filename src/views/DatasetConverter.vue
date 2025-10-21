<template>
  <div class="dataset-converter">
    <div class="header">
      <h1>📊 데이터셋 변환</h1>
      <p>렌더링된 이미지를 YOLO 학습용 데이터셋으로 변환합니다.</p>
    </div>

    <!-- 상태 표시 -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-content">
          <span class="stat-label">소스 이미지:</span>
          <span class="stat-value">{{ datasetStats.sourceImages }}개</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <span class="stat-label">변환 완료:</span>
          <span class="stat-value">{{ datasetStats.convertedImages }}개</span>
        </div>
      </div>
    </div>

    <!-- 변환 컨트롤 -->
    <div class="conversion-controls">
      <div class="control-buttons">
        <button
          @click="startConversion"
          :disabled="isConverting || !hasRenderedData"
          :class="{ 'btn-disabled': isConverting || !hasRenderedData }"
          class="btn btn-primary"
        >
          <span v-if="isConverting">
            🔄 변환 중... ({{ conversionProgress }}%)
          </span>
          <span v-else>
            🚀 데이터셋 변환 시작
          </span>
        </button>

        <button
          @click="stopConversion"
          :disabled="!isConverting"
          :class="{ 'btn-disabled': !isConverting }"
          class="btn btn-secondary"
        >
          ⏹️ 변환 중지
        </button>

        <button
          @click="downloadDataset"
          :disabled="!hasConvertedData"
          :class="{ 'btn-disabled': !hasConvertedData }"
          class="btn btn-success"
        >
          📁 데이터셋 정보 조회
        </button>
      </div>

      <!-- 변환 진행률 표시 -->
      <div v-if="isConverting" class="conversion-progress">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: conversionProgress + '%' }"
          ></div>
        </div>
        <p class="progress-text">{{ conversionStatus }}</p>
      </div>

      <!-- 변환 로그 -->
      <div class="conversion-logs">
        <h4>변환 로그</h4>
        <div class="log-container">
          <div 
            v-for="(log, index) in conversionLogs" 
            :key="index"
            :class="['log-entry', `log-${log.type}`]"
          >
            <span class="log-time">{{ log.time }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 데이터셋 정보 -->
    <div v-if="hasConvertedData" class="dataset-info">
      <h3>📦 변환된 데이터셋 정보</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">총 이미지 수:</span>
          <span class="info-value">{{ datasetStats.convertedImages }}개</span>
        </div>
        <div class="info-item">
          <span class="info-label">변환 상태:</span>
          <span class="info-value success">✅ 완료</span>
        </div>
        <div class="info-item">
          <span class="info-label">변환 시간:</span>
          <span class="info-value">{{ conversionTime }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'

export default {
  name: 'DatasetConverter',
  setup() {
    // 데이터셋 변환 관련 상태
    const isConverting = ref(false)
    const conversionProgress = ref(0)
    const conversionStatus = ref('대기 중')
    const conversionLogs = ref([])
    const currentJobId = ref(null)
    const datasetStats = ref({
      sourceImages: 0,
      convertedImages: 0,
      progress: 0
    })
    const hasConvertedData = ref(false)

    const hasRenderedData = computed(() => datasetStats.value.sourceImages > 0)
    const conversionTime = ref('')

    // 로그 추가 함수
    const addConversionLog = (message, type = 'info') => {
      const log = {
        time: new Date().toLocaleTimeString(),
        message,
        type
      }
      conversionLogs.value.push(log)
      
      // 로그가 너무 많아지면 오래된 것 제거
      if (conversionLogs.value.length > 100) {
        conversionLogs.value = conversionLogs.value.slice(-50)
      }
    }

    // 소스 이미지 확인
    const checkSourceImages = async () => {
      try {
        const response = await fetch('/api/dataset/source-count')
        const data = await response.json()
        return data.count || 0
      } catch (error) {
        console.error('Source count check error:', error)
        return 0
      }
    }

    // 데이터셋 변환 시작
    const startConversion = async () => {
      try {
        isConverting.value = true
        conversionStatus.value = '변환 시작...'
        const startTime = new Date()
        
        addConversionLog('데이터셋 변환을 시작합니다.', 'info')

        // 프로덕션 환경 체크
        if (import.meta.env.PROD) {
          addConversionLog('⚠️ 프로덕션 환경에서는 데이터셋 변환이 제한됩니다.', 'warning')
          isConverting.value = false
          return
        }

        // 렌더링된 이미지 확인
        const sourceCount = await checkSourceImages()
        datasetStats.value.sourceImages = sourceCount
        
        if (sourceCount === 0) {
          addConversionLog('변환할 이미지가 없습니다. 먼저 렌더링을 완료하세요.', 'error')
          isConverting.value = false
          return
        }

        // 데이터셋 변환 API 호출
        addConversionLog('데이터셋 변환을 시작합니다...', 'info')
        const response = await fetch('/api/dataset/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sourcePath: 'output/synthetic',
            targetPath: 'data/brickbox_dataset',
            format: 'yolo'
          })
        })

        if (!response.ok) {
          throw new Error(`변환 실패: ${response.statusText}`)
        }

        const result = await response.json()
        
        // jobId 저장
        currentJobId.value = result.jobId
        
        // 변환 진행률 모니터링 시작
        await monitorConversionProgress()
        
        const endTime = new Date()
        conversionTime.value = `${Math.round((endTime - startTime) / 1000)}초`

      } catch (error) {
        addConversionLog(`변환 중 오류 발생: ${error.message}`, 'error')
      } finally {
        isConverting.value = false
      }
    }

    // 변환 중지
    const stopConversion = () => {
      isConverting.value = false
      currentJobId.value = null
      addConversionLog('데이터셋 변환이 중지되었습니다.', 'warning')
    }

    // 경로 복사 함수
    const copyPathToClipboard = async (path) => {
      try {
        await navigator.clipboard.writeText(path)
        addConversionLog('✅ 경로가 클립보드에 복사되었습니다!', 'success')
      } catch (error) {
        addConversionLog('❌ 경로 복사 실패: 수동으로 복사해주세요.', 'error')
      }
    }

    // 데이터셋 다운로드
    const downloadDataset = async () => {
      try {
        addConversionLog('데이터셋 정보를 조회합니다...', 'info')
        
        const response = await fetch('/api/dataset/download', {
          method: 'GET'
        })

        if (!response.ok) {
          const errorData = await response.json()
          if (response.status === 404) {
            addConversionLog('데이터셋이 아직 생성되지 않았습니다. 먼저 변환을 완료하세요.', 'error')
            return
          } else {
            throw new Error(`조회 실패: ${errorData.error || response.statusText}`)
          }
        }

        const data = await response.json()
        
        if (data.success) {
          addConversionLog('데이터셋 폴더 구조 정보를 받았습니다.', 'success')
          
          // 경로를 강조하여 표시
          addConversionLog('📍 데이터셋 저장 경로:', 'info')
          addConversionLog(`📂 ${data.datasetPath}`, 'success')
          addConversionLog('', 'info') // 빈 줄
          
          // 폴더 구조 정보 표시
          if (data.structure && data.structure.length > 0) {
            addConversionLog('📁 데이터셋 구조:', 'info')
            const displayStructure = (items, depth = 0) => {
              items.forEach(item => {
                const indent = '  '.repeat(depth)
                if (item.type === 'directory') {
                  addConversionLog(`${indent}📁 ${item.name}/`, 'info')
                  if (item.children) {
                    displayStructure(item.children, depth + 1)
                  }
                } else {
                  const sizeKB = (item.size / 1024).toFixed(1)
                  addConversionLog(`${indent}📄 ${item.name} (${sizeKB}KB)`, 'info')
                }
              })
            }
            displayStructure(data.structure)
            addConversionLog('', 'info') // 빈 줄
          }
          
          // 사용 방법 안내
          if (data.instructions) {
            addConversionLog('📋 사용 방법:', 'info')
            data.instructions.forEach((instruction, index) => {
              addConversionLog(`${index + 1}. ${instruction}`, 'info')
            })
            addConversionLog('', 'info') // 빈 줄
          }
          
          // 경로 복사 안내
          addConversionLog('💡 위 경로를 복사하여 파일 탐색기에서 열어주세요.', 'warning')
          addConversionLog('📋 경로 복사: Ctrl+C로 복사 가능', 'info')
          
          // 경로를 클립보드에 복사
          await copyPathToClipboard(data.datasetPath)
        } else {
          addConversionLog(`데이터셋 조회 실패: ${data.error}`, 'error')
        }
        
      } catch (error) {
        addConversionLog(`조회 중 오류 발생: ${error.message}`, 'error')
      }
    }

    // 변환 진행률 모니터링
    const monitorConversionProgress = async () => {
      if (!currentJobId.value) {
        addConversionLog('작업 ID가 없습니다.', 'error')
        return
      }

      let attempts = 0
      const maxAttempts = 100

      while (isConverting.value && attempts < maxAttempts) {
        try {
          const response = await fetch(`/api/dataset/progress?jobId=${currentJobId.value}`)
          const data = await response.json()
          
          if (!data.success) {
            addConversionLog(`진행률 조회 실패: ${data.error}`, 'error')
            break
          }
          
          conversionStatus.value = data.status || '변환 중...'
          conversionProgress.value = data.progress || 0
          datasetStats.value.progress = conversionProgress.value

          if (data.logs && data.logs.length > 0) {
            data.logs.forEach(log => {
              addConversionLog(log.message, log.type)
            })
          }

          if (data.progress >= 100) {
            hasConvertedData.value = true
            datasetStats.value.convertedImages = datasetStats.value.sourceImages
            isConverting.value = false
            addConversionLog('데이터셋 변환이 완료되었습니다!', 'success')
            break
          }

          await new Promise(resolve => setTimeout(resolve, 5000)) // 5초 대기
          attempts++
        } catch (error) {
          addConversionLog(`진행률 모니터링 오류: ${error.message}`, 'error')
          break
        }
      }
    }

    onMounted(async () => {
      // 초기 데이터 로드
      const sourceCount = await checkSourceImages()
      datasetStats.value.sourceImages = sourceCount
      
      if (sourceCount > 0) {
        addConversionLog('렌더링된 이미지를 발견했습니다. 변환을 시작할 수 있습니다.', 'info')
      } else {
        addConversionLog('렌더링된 이미지가 없습니다. 먼저 합성 데이터셋 페이지에서 렌더링을 완료하세요.', 'warning')
      }
    })

    return {
      // 상태
      datasetStats,
      isConverting,
      conversionProgress,
      conversionStatus,
      conversionLogs,
      hasConvertedData,
      hasRenderedData,
      conversionTime,

      // 메서드
      startConversion,
      stopConversion,
      downloadDataset,
      copyPathToClipboard,
      addConversionLog
    }
  }
}
</script>

<style scoped>
.dataset-converter {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.header p {
  font-size: 1.1rem;
  color: #7f8c8d;
}

/* 상태 표시 */
.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
}

/* 변환 컨트롤 */
.conversion-controls {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.control-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(.btn-disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #e74c3c;
  color: white;
}

.btn-secondary:hover:not(.btn-disabled) {
  background: #c0392b;
  transform: translateY(-2px);
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover:not(.btn-disabled) {
  background: #229954;
  transform: translateY(-2px);
}

.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* 진행률 표시 */
.conversion-progress {
  margin-bottom: 2rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  color: #7f8c8d;
  font-weight: 500;
}

/* 변환 로그 */
.conversion-logs h4 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.log-container {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #ecf0f1;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  font-size: 0.8rem;
  color: #7f8c8d;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-info {
  color: #3498db;
}

.log-success {
  color: #27ae60;
}

.log-warning {
  color: #f39c12;
}

.log-error {
  color: #e74c3c;
}

/* 데이터셋 정보 */
.dataset-info {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.dataset-info h3 {
  color: #2c3e50;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.info-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
}

.info-value.success {
  color: #27ae60;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .dataset-converter {
    padding: 1rem;
  }

  .header h1 {
    font-size: 2rem;
  }

  .control-buttons {
    flex-direction: column;
  }

  .btn {
    justify-content: center;
  }

  .stats-section {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
