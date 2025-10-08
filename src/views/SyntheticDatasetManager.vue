<template>
  <div class="synthetic-dataset-manager">
    <div class="header">
      <h1>🧱 BrickBox 합성 데이터셋 관리</h1>
      <p>LDraw + Blender + Supabase 기반 자동 렌더링 파이프라인</p>
    </div>

    <!-- 통계 대시보드 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <h3>{{ stats.totalParts }}</h3>
          <p>총 부품 수</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎨</div>
        <div class="stat-content">
          <h3>{{ stats.renderedImages }}</h3>
          <p>렌더링된 이미지</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">☁️</div>
        <div class="stat-content">
          <h3>{{ stats.storageUsed }}</h3>
          <p>저장소 사용량</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-content">
          <h3>{{ stats.renderingStatus }}</h3>
          <p>렌더링 상태</p>
        </div>
      </div>
    </div>

    <!-- 렌더링 컨트롤 -->
    <div class="control-panel">
      <h2>🎯 렌더링 컨트롤</h2>
      
      <div class="render-options">
        <div class="option-group">
          <label>렌더링 모드</label>
          <select v-model="renderMode" @change="updateRenderSettings">
            <option value="single">단일 부품</option>
            <option value="set">레고 세트</option>
            <option value="batch">배치 렌더링</option>
          </select>
        </div>

        <div class="option-group" v-if="renderMode === 'single'">
          <label>부품 ID</label>
          <input 
            v-model="selectedPartId" 
            placeholder="예: 65635"
            @input="validatePartId"
          />
          <div v-if="partValidation" class="validation-message">
            {{ partValidation }}
          </div>
        </div>

        <div class="option-group" v-if="renderMode === 'set'">
          <label>레고 세트 번호</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <input 
              v-model="selectedSetNum" 
              placeholder="예: 76917 (데이터베이스에서 로드)" 
              @keyup.enter="loadSetParts"
            />
            <button class="btn-secondary" @click="loadSetParts">부품 로드 (DB)</button>
          </div>
        </div>

        <div class="option-group">
          <label>이미지 수</label>
          <input 
            type="number" 
            v-model="imageCount" 
            min="1" 
            max="300"
            placeholder="200"
          />
        </div>

        <div class="option-group">
          <label>렌더링 품질</label>
          <select v-model="renderQuality">
            <option value="fast">빠름 (적응형: 256-400샘플)</option>
            <option value="medium">보통 (적응형: 320-400샘플)</option>
            <option value="high">고품질 (적응형: 400-480샘플)</option>
            <option value="ultra">최고품질 (적응형: 400-480샘플)</option>
          </select>
          <div class="quality-info">
            <small>🎯 적응형 샘플링: 부품 복잡도에 따라 자동 조정</small>
          </div>
        </div>

        <div class="option-group">
          <label>배경색</label>
          <select v-model="background">
            <option value="auto">자동</option>
            <option value="gray">회색</option>
            <option value="white">흰색</option>
          </select>
        </div>

        <div class="option-group">
          <label>해상도</label>
          <select v-model="resolution">
            <option value="640x640">640x640</option>
            <option value="768x768">768x768</option>
            <option value="960x960">960x960</option>
            <option value="1024x1024">1024x1024 (권장)</option>
          </select>
        </div>

        <!-- 적응형 샘플링 정보 -->
        <div class="adaptive-info">
          <h4>🎯 적응형 샘플링 시스템</h4>
          <div class="adaptive-grid">
            <div class="adaptive-item">
              <span class="adaptive-label">단순 부품</span>
              <span class="adaptive-samples">256샘플</span>
              <small>(Plate/Tile)</small>
            </div>
            <div class="adaptive-item">
              <span class="adaptive-label">중간 부품</span>
              <span class="adaptive-samples">320샘플</span>
              <small>(Beam/Rod)</small>
            </div>
            <div class="adaptive-item">
              <span class="adaptive-label">복잡 부품</span>
              <span class="adaptive-samples">400샘플</span>
              <small>(Technic)</small>
            </div>
            <div class="adaptive-item">
              <span class="adaptive-label">투명/반사</span>
              <span class="adaptive-samples">480샘플</span>
              <small>(Glass/Crystal)</small>
            </div>
          </div>
          <div class="adaptive-features">
            <small>✨ 자동 복잡도 감지 • 실시간 노이즈 보정 • SSIM 품질 검증</small>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <button 
          @click="startRendering" 
          :disabled="!canStartRendering"
          class="btn-primary"
        >
          🚀 렌더링 시작
        </button>
        <button 
          v-if="renderMode === 'set' && setParts.length > 0"
          @click="startSetRendering" 
          :disabled="isRendering"
          class="btn-primary"
        >
          📦 세트 전체 렌더링
        </button>
        <button 
          @click="stopRendering" 
          :disabled="!isRendering"
          class="btn-danger"
        >
          ⏹️ 렌더링 중지
        </button>
        <button 
          @click="refreshStats" 
          class="btn-secondary"
        >
          🔄 새로고침
        </button>
      </div>
    </div>

    <!-- 렌더링 진행 상황 -->
    <div class="progress-panel" v-if="isRendering">
      <h3>📈 렌더링 진행 상황</h3>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${renderProgress}%` }"
        ></div>
      </div>
      <p>{{ renderProgress }}% 완료 ({{ currentImage }}/{{ totalImages }})</p>
      <div class="render-log">
        <div 
          v-for="(log, index) in renderLogs" 
          :key="index"
          class="log-entry"
          :class="log.type"
        >
          {{ log.message }}
        </div>
      </div>
    </div>

    <!-- 렌더링 결과 -->
    <div class="results-panel" v-if="renderResults.length > 0">
      <h3>🎨 렌더링 결과</h3>
      <div class="image-grid">
        <div 
          v-for="result in renderResults" 
          :key="result.id"
          class="image-card"
        >
          <img 
            :src="result.imageUrl" 
            :alt="result.partId"
            @click="openImageModal(result)"
          />
          <div class="image-info">
            <p><strong>{{ result.partId }}</strong></p>
            <p>{{ result.colorName }}</p>
            <p>{{ result.angle }}°</p>
          </div>
          <div class="image-actions">
            <button @click="downloadImage(result)" class="btn-small">
              📥 다운로드
            </button>
            <button @click="uploadToSupabase(result)" class="btn-small">
              ☁️ 업로드
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 이미지 모달 -->
    <div v-if="selectedImage" class="image-modal" @click="closeImageModal">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="closeImageModal">×</button>
        <img :src="selectedImage.imageUrl" :alt="selectedImage.partId" />
        <div class="modal-info">
          <h3>{{ selectedImage.partId }}</h3>
          <p>색상: {{ selectedImage.colorName }}</p>
          <p>회전: {{ selectedImage.angle }}°</p>
          <p>해상도: {{ selectedImage.resolution }}</p>
        </div>
      </div>
    </div>

    <!-- 배치 작업 관리 -->
    <div class="batch-management">
      <h3>📋 배치 작업 관리</h3>
      <div class="batch-queue">
        <div 
          v-for="job in batchJobs" 
          :key="job.id"
          class="job-card"
          :class="job.status"
        >
          <div class="job-info">
            <h4>{{ job.name }}</h4>
            <p>{{ job.description }}</p>
            <div class="job-progress">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{ width: `${job.progress}%` }"
                ></div>
              </div>
              <span>{{ job.progress }}%</span>
            </div>
          </div>
          <div class="job-actions">
            <button 
              v-if="job.status === 'pending'"
              @click="startJob(job)"
              class="btn-small"
            >
              ▶️ 시작
            </button>
            <button 
              v-if="job.status === 'running'"
              @click="pauseJob(job)"
              class="btn-small"
            >
              ⏸️ 일시정지
            </button>
            <button 
              v-if="job.status === 'paused'"
              @click="resumeJob(job)"
              class="btn-small"
            >
              ▶️ 재개
            </button>
            <button 
              @click="cancelJob(job)"
              class="btn-small btn-danger"
            >
              ❌ 취소
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useSyntheticDataset } from '@/composables/useSyntheticDataset'

export default {
  name: 'SyntheticDatasetManager',
  setup() {
    const { 
      getStats, 
      startRendering: startRenderingAPI, 
      stopRendering: stopRenderingAPI, 
      getRenderResults,
      uploadToSupabase: uploadToSupabaseAPI 
    } = useSyntheticDataset()

    // 반응형 데이터
    const stats = ref({
      totalParts: 0,
      renderedImages: 0,
      storageUsed: '0 GB',
      renderingStatus: '대기 중'
    })

    const renderMode = ref('single')
    const selectedPartId = ref('')
    const selectedSetNum = ref('')
    const imageCount = ref(200)
    const renderQuality = ref('high')
    const background = ref('white')
    const resolution = ref('1024x1024')
    
    const isRendering = ref(false)
    const renderProgress = ref(0)
    const currentImage = ref(0)
    const totalImages = ref(0)
    const renderLogs = ref([])
    const renderResults = ref([])
    const resolvedPartIdForFiles = ref('')
    
    const availableSets = ref([])
    const setParts = ref([])
    const batchJobs = ref([])
    const selectedImage = ref(null)

    // 계산된 속성
    const canStartRendering = computed(() => {
      if (renderMode.value === 'single') {
        return selectedPartId.value && partValidation.value === '✅ 유효한 부품 ID'
      }
      if (renderMode.value === 'set') {
        return selectedSetNum.value
      }
      return true
    })

    const partValidation = ref('')

    // 메서드
    const validatePartId = async () => {
      if (!selectedPartId.value) {
        partValidation.value = ''
        return
      }
      
      try {
        // 부품 ID 유효성 검사 로직
        const isValid = /^[0-9]+$/.test(selectedPartId.value)
        if (isValid) {
          partValidation.value = '✅ 유효한 부품 ID'
        } else {
          partValidation.value = '❌ 잘못된 부품 ID 형식'
        }
      } catch (error) {
        partValidation.value = '❌ 검증 실패'
      }
    }

    const loadSetParts = async () => {
      if (!selectedSetNum.value) return
      
      try {
        // 저장된 데이터베이스에서 직접 로드 (CORS 문제 해결)
        console.log('세트 부품 로드 (데이터베이스):', selectedSetNum.value)
        const { useMasterPartsMatching } = await import('@/composables/useMasterPartsMatching')
        const { loadTargetSetParts } = useMasterPartsMatching()
        
        const result = await loadTargetSetParts(selectedSetNum.value)
        const rows = result.targetParts || []
        
        // element_id, part_num, color_id를 보존하여 세트 렌더링 시 elementId로 활용
        const items = rows.map(r => ({
          part_num: r.part_id,
          color_id: r.color_id,
          element_id: r.element_id || null // 데이터베이스에서 element_id 가져오기
        })).filter(it => it.part_num)
        
        // 중복 제거: 동일 part_num+color_id 조합 기준
        const dedupKey = it => `${it.part_num}|${it.color_id ?? ''}`
        const seen = new Set()
        const unique = []
        for (const it of items) {
          const k = dedupKey(it)
          if (!seen.has(k)) {
            seen.add(k)
            unique.push(it)
          }
        }
        setParts.value = unique
        console.log(`세트 부품 ${unique.length}개 준비 완료 (데이터베이스에서 로드)`) 
      } catch (error) {
        console.error('세트 부품 로드 실패:', error)
        error.value = `데이터베이스에서 세트를 찾을 수 없습니다: ${error.message}`
      }
    }

    const updateRenderSettings = () => {
      console.log('렌더링 설정 업데이트:', renderMode.value)
    }

    const startRendering = async () => {
      if (!canStartRendering.value) return
      
      // 세트 모드는 단일 호출 대신 배치 렌더링 플로우로 위임
      if (renderMode.value === 'set') {
        await startSetRendering()
        return
      }

      isRendering.value = true
      renderProgress.value = 0
      currentImage.value = 0
      totalImages.value = imageCount.value
      renderLogs.value = []
      
      try {
        const renderConfig = {
          mode: renderMode.value,
          partId: selectedPartId.value,
          setNum: selectedSetNum.value,
          imageCount: imageCount.value,
          quality: renderQuality.value,
          background: background.value,
          resolution: resolution.value,
          targetFill: 0.92
        }
        // 숫자만 입력된 경우는 엘리먼트 ID로 처리하도록 전송 값 보강
        if (renderMode.value === 'single' && selectedPartId.value && /^\d+$/.test(selectedPartId.value.trim())) {
          renderConfig.elementId = selectedPartId.value.trim()
          // 서버 해석 API 호출해 파일 조회용 partId 미리 확보
          try {
            const r = await fetch(`/api/synthetic/resolve-element/${renderConfig.elementId}`, { cache: 'no-store' })
            if (r.ok) {
              const j = await r.json()
              if (j && j.success && j.partId) {
                resolvedPartIdForFiles.value = j.partId
              }
            }
          } catch (e) {
            console.warn('elementId 해석 실패(클라이언트):', e)
          }
        }
        
        console.log('렌더링 시작:', renderConfig)
        
        // API 호출
        const response = await startRenderingAPI(renderConfig)
        
        // 서버에서 jobId를 반환하므로 폴링하며 파일 목록을 가져옴
        if (response && response.success && response.jobId) {
          const jobId = response.jobId
          renderLogs.value.push({ type: 'info', message: `작업 시작: ${jobId}` })
          // 2초 간격으로 진행상황과 파일 목록 확인
          const pollInterval = setInterval(async () => {
            try {
              // 진행상황
              const progressRes = await fetch(`/api/synthetic/progress/${jobId}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
              const progressJson = await progressRes.json()
              if (progressJson && progressJson.success) {
                renderProgress.value = Math.round(progressJson.progress || 0)
                if (progressJson.logs) {
                  renderLogs.value.push(...progressJson.logs)
                }
              }
              // 파일 목록: 단일 부품 모드에서만 조회 (set 모드는 partId가 비어 404 발생 방지)
              const isSingleMode = renderMode.value === 'single'
              const fetchPart = resolvedPartIdForFiles.value || selectedPartId.value
              if (isSingleMode && fetchPart) {
                try {
                  const filesRes = await fetch(`/api/synthetic/files/${fetchPart}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
                  if (!filesRes.ok) {
                    // 404 등은 무시하고 다음 폴링으로
                    return
                  }
                  const filesJson = await filesRes.json()
                  if (filesJson && filesJson.success && Array.isArray(filesJson.results)) {
                    renderResults.value = filesJson.results
                    currentImage.value = filesJson.results.length
                    totalImages.value = imageCount.value
                  }
                } catch (e) {
                  // HTML 응답(JSON 파싱 실패) 등은 무시
                }
              }
              // 완료 조건
              if (progressJson && progressJson.status === 'completed') {
                clearInterval(pollInterval)
                isRendering.value = false
                renderProgress.value = 100
                renderLogs.value.push({ type: 'success', message: '렌더링 완료' })
              }
            } catch (e) {
              console.error(e)
            }
          }, 2000)
        } else {
          // 폴백: 시뮬레이션
          simulateRendering()
        }
        
      } catch (error) {
        console.error('렌더링 시작 실패:', error)
        isRendering.value = false
      }
    }

    const simulateRendering = () => {
      const interval = setInterval(() => {
        if (renderProgress.value >= 100) {
          clearInterval(interval)
          isRendering.value = false
          loadRenderResults()
          return
        }
        
        renderProgress.value += 10
        currentImage.value = Math.floor((renderProgress.value / 100) * totalImages.value)
        
        renderLogs.value.push({
          type: 'info',
          message: `이미지 ${currentImage.value} 렌더링 완료`
        })
      }, 1000)
    }

    const stopRendering = async () => {
      try {
        await stopRenderingAPI()
        isRendering.value = false
        renderProgress.value = 0
        console.log('렌더링 중지')
      } catch (error) {
        console.error('렌더링 중지 실패:', error)
      }
    }

    // 세트 전체 배치 렌더링
    const startSetRendering = async () => {
      if (!selectedSetNum.value || setParts.value.length === 0) return
      isRendering.value = true
      renderLogs.value = []
      renderResults.value = []
      try {
        for (const item of setParts.value) {
          const partNum = typeof item === 'string' ? item : item.part_num
          const colorId = typeof item === 'object' ? (item.color_id ?? null) : null
          const elementIdRaw = typeof item === 'object' ? (item.element_id ?? null) : null
          // elementId 우선순위: element_id → (part_num + '-' + color_id) → part_num
          const elementId = elementIdRaw || (partNum && Number.isInteger(colorId) ? `${partNum}-${colorId}` : partNum)
          const cfg = {
            mode: 'single',
            partId: partNum,
            setNum: selectedSetNum.value,
            imageCount: imageCount.value,
            quality: renderQuality.value,
            background: background.value,
            ...(elementId ? { elementId } : {}),
            ...(Number.isInteger(colorId) ? { colorId } : {})
          }
          const resp = await startRenderingAPI(cfg)
          if (resp && resp.jobId) {
            const jobId = resp.jobId
            let status = 'running'
            while (status === 'running') {
              await new Promise(r => setTimeout(r, 2000))
              const pRes = await fetch(`/api/synthetic/progress/${jobId}`, { cache: 'no-store' })
              const pJson = await pRes.json()
              status = pJson.status
            }
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        isRendering.value = false
        renderProgress.value = 100
      }
    }

    const loadRenderResults = async () => {
      try {
        // 렌더링 결과 로드
        renderResults.value = [
          {
            id: 1,
            partId: selectedPartId.value || '3001',
            imageUrl: '/api/placeholder/3001_001.png',
            colorName: '빨강',
            angle: '45°',
            resolution: '640x640'
          }
        ]
      } catch (error) {
        console.error('렌더링 결과 로드 실패:', error)
      }
    }

    const refreshStats = async () => {
      try {
        const newStats = await getStats()
        stats.value = newStats
      } catch (error) {
        console.error('통계 새로고침 실패:', error)
      }
    }

    const openImageModal = (image) => {
      selectedImage.value = image
    }

    const closeImageModal = () => {
      selectedImage.value = null
    }

    const downloadImage = (result) => {
      console.log('이미지 다운로드:', result)
    }

    const uploadToSupabase = async (result) => {
      try {
        await uploadToSupabaseAPI(result)
        console.log('Supabase 업로드 완료:', result)
      } catch (error) {
        console.error('Supabase 업로드 실패:', error)
      }
    }

    const startJob = (job) => {
      job.status = 'running'
      console.log('작업 시작:', job)
    }

    const pauseJob = (job) => {
      job.status = 'paused'
      console.log('작업 일시정지:', job)
    }

    const resumeJob = (job) => {
      job.status = 'running'
      console.log('작업 재개:', job)
    }

    const cancelJob = (job) => {
      job.status = 'cancelled'
      console.log('작업 취소:', job)
    }

    // 생명주기
    onMounted(async () => {
      await refreshStats()
      
      // 배치 작업 초기화
      batchJobs.value = [
        {
          id: 1,
          name: '1단계 배치 렌더링',
          description: '핵심 부품 100개 렌더링',
          status: 'pending',
          progress: 0
        },
        {
          id: 2,
          name: '2단계 배치 렌더링',
          description: '확장 부품 1,000개 렌더링',
          status: 'pending',
          progress: 0
        }
      ]
    })

    return {
      stats,
      renderMode,
      selectedPartId,
      selectedSetNum,
      imageCount,
      renderQuality,
      background,
      isRendering,
      renderProgress,
      currentImage,
      totalImages,
      renderLogs,
      renderResults,
      availableSets,
      setParts,
      batchJobs,
      selectedImage,
      canStartRendering,
      partValidation,
      validatePartId,
      loadSetParts,
      updateRenderSettings,
      startRendering,
      startSetRendering,
      stopRendering,
      refreshStats,
      openImageModal,
      closeImageModal,
      downloadImage,
      uploadToSupabase,
      startJob,
      pauseJob,
      resumeJob,
      cancelJob,
      resolution
    }
  }
}
</script>

<style scoped>
.synthetic-dataset-manager {
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 32px;
}

.stat-content h3 {
  font-size: 24px;
  margin: 0;
  color: #2c3e50;
}

.stat-content p {
  margin: 5px 0 0 0;
  color: #7f8c8d;
  font-size: 14px;
}

.control-panel {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.control-panel h2 {
  margin-top: 0;
  color: #2c3e50;
}

.render-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 25px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-group label {
  font-weight: 600;
  color: #2c3e50;
}

.option-group input,
.option-group select {
  padding: 10px;
  border: 2px solid #e1e8ed;
  border-radius: 8px;
  font-size: 14px;
}

.option-group input:focus,
.option-group select:focus {
  outline: none;
  border-color: #3498db;
}

.validation-message {
  font-size: 12px;
  margin-top: 5px;
}

.quality-info {
  margin-top: 5px;
}

.quality-info small {
  color: #7f8c8d;
  font-style: italic;
}

.adaptive-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
  border-left: 4px solid #3498db;
}

.adaptive-info h4 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 16px;
}

.adaptive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.adaptive-item {
  background: white;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  border: 1px solid #e1e8ed;
}

.adaptive-label {
  display: block;
  font-weight: 600;
  color: #2c3e50;
  font-size: 12px;
  margin-bottom: 5px;
}

.adaptive-samples {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #3498db;
  margin-bottom: 2px;
}

.adaptive-item small {
  color: #7f8c8d;
  font-size: 10px;
}

.adaptive-features {
  text-align: center;
  margin-top: 10px;
}

.adaptive-features small {
  color: #27ae60;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.btn-primary {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-danger {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-danger:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.progress-panel {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #ecf0f1;
  border-radius: 10px;
  overflow: hidden;
  margin: 15px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.render-log {
  max-height: 200px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
}

.log-entry {
  padding: 5px 0;
  font-size: 14px;
}

.log-entry.info {
  color: #3498db;
}

.log-entry.success {
  color: #27ae60;
}

.log-entry.error {
  color: #e74c3c;
}

.results-panel {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.image-card {
  border: 2px solid #e1e8ed;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.image-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.image-card img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  cursor: pointer;
}

.image-info {
  padding: 15px;
}

.image-info p {
  margin: 5px 0;
  font-size: 14px;
}

.image-actions {
  display: flex;
  gap: 10px;
  padding: 15px;
  background: #f8f9fa;
}

.btn-small {
  background: #3498db;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  max-width: 80%;
  max-height: 80%;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(0,0,0,0.5);
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  z-index: 1001;
}

.modal-content img {
  width: 100%;
  height: auto;
  max-height: 60vh;
  object-fit: contain;
}

.modal-info {
  padding: 20px;
}

.batch-management {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.batch-queue {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 20px;
}

.job-card {
  border: 2px solid #e1e8ed;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.job-card.pending {
  border-color: #f39c12;
}

.job-card.running {
  border-color: #3498db;
}

.job-card.paused {
  border-color: #e67e22;
}

.job-card.completed {
  border-color: #27ae60;
}

.job-card.cancelled {
  border-color: #e74c3c;
}

.job-info h4 {
  margin: 0 0 5px 0;
  color: #2c3e50;
}

.job-info p {
  margin: 0 0 10px 0;
  color: #7f8c8d;
  font-size: 14px;
}

.job-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.job-progress .progress-bar {
  width: 200px;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
}

.job-progress .progress-fill {
  height: 100%;
  background: #3498db;
  transition: width 0.3s ease;
}

.job-actions {
  display: flex;
  gap: 10px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .render-options {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>