<template>
  <div class="automated-training-dashboard">
    <!-- 헤더 -->
    <div class="dashboard-header">
      <h1>🧱 BrickBox 자동화된 YOLO 학습 대시보드</h1>
      <p>Supabase + Colab 연동으로 완전 자동화된 학습 파이프라인</p>
    </div>

    <!-- 세트 단위 학습 섹션 -->
    <div class="set-based-training-section">
      <h2>🎯 세트 단위 학습</h2>
      <p class="section-description">
        특정 레고 세트에 대해 중복을 제거하고 효율적으로 학습합니다.
      </p>
      
      <div class="set-training-controls">
        <div class="control-group">
          <label for="setNum">레고 세트 번호</label>
          <div class="input-group">
            <input 
              id="setNum"
              v-model="selectedSetNum" 
              placeholder="예: 76917"
              class="set-input"
            />
            <button 
              @click="loadSetInfo" 
              :disabled="!selectedSetNum || isLoading"
              class="btn-secondary"
            >
              세트 정보 로드
            </button>
          </div>
        </div>

        <div v-if="setInfo" class="set-info-card">
          <h3>📦 {{ setInfo.set_num }} - {{ setInfo.set_name }}</h3>
          <div class="set-details">
            <div class="detail-item">
              <span class="label">총 부품 수:</span>
              <span class="value">{{ setInfo.total_parts }}개</span>
            </div>
            <div class="detail-item">
              <span class="label">이미 학습된 부품:</span>
              <span class="value">{{ setInfo.trained_parts }}개</span>
            </div>
            <div class="detail-item">
              <span class="label">새로 학습할 부품:</span>
              <span class="value">{{ setInfo.new_parts }}개</span>
            </div>
            <div class="detail-item">
              <span class="label">학습 상태:</span>
              <span class="value status" :class="setInfo.status">{{ getStatusText(setInfo.status) }}</span>
            </div>
          </div>
        </div>

        <div class="set-training-actions">
          <button 
            @click="startSetTraining" 
            :disabled="!setInfo || isLoading || setInfo.new_parts === 0"
            class="btn-primary"
          >
            🎯 세트 학습 시작
          </button>
          <button 
            @click="checkSetTrainingStatus" 
            :disabled="!selectedSetNum || isLoading"
            class="btn-secondary"
          >
            📊 학습 상태 확인
          </button>
        </div>
      </div>
    </div>

    <!-- 현재 모델 상태 -->
    <div class="model-status-card">
      <h2>📊 현재 모델 상태</h2>
      <div v-if="currentModel" class="model-info">
        <div class="model-basic-info">
          <h3>{{ currentModel.model_name }}</h3>
          <span class="version">v{{ currentModel.version }}</span>
          <span class="status" :class="currentModel.status">{{ currentModel.status }}</span>
        </div>
        
        <div class="model-metrics">
          <div class="metric">
            <label>mAP50</label>
            <span class="value">{{ (currentModel.metrics?.mAP50 || 0).toFixed(3) }}</span>
          </div>
          <div class="metric">
            <label>Precision</label>
            <span class="value">{{ (currentModel.metrics?.precision || 0).toFixed(3) }}</span>
          </div>
          <div class="metric">
            <label>Recall</label>
            <span class="value">{{ (currentModel.metrics?.recall || 0).toFixed(3) }}</span>
          </div>
          <div class="metric">
            <label>모델 크기</label>
            <span class="value">{{ modelSizeFormatted }}</span>
          </div>
        </div>
        
        <div class="model-performance" v-if="modelPerformance">
          <div class="performance-status" :class="modelPerformance.overall">
            성능: {{ modelPerformance.overall === 'good' ? '양호' : '개선 필요' }}
          </div>
          <div v-if="modelPerformance.issues.length > 0" class="issues">
            <h4>⚠️ 개선 사항:</h4>
            <ul>
              <li v-for="issue in modelPerformance.issues" :key="issue">{{ issue }}</li>
            </ul>
          </div>
          <div v-if="modelPerformance.recommendations.length > 0" class="recommendations">
            <h4>💡 권장사항:</h4>
            <ul>
              <li v-for="rec in modelPerformance.recommendations" :key="rec">{{ rec }}</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div v-else class="no-model">
        <p>활성 모델이 없습니다</p>
        <p class="no-model-description">
          세트 단위 학습을 통해 새로운 모델을 생성하세요.
        </p>
      </div>
    </div>

    <!-- 학습 작업 관리 -->
    <div class="training-jobs-card">
      <h2>🚀 학습 작업 관리</h2>
      
      <div class="training-controls">
        <button @click="refreshData" :disabled="isLoading" class="btn-secondary">
          새로고침
        </button>
      </div>

      <!-- 실시간 학습 진행 상황 -->
      <div v-if="trainingJobs.length > 0" class="training-progress">
        <h3>📈 실시간 학습 진행 상황</h3>
        <div v-for="job in trainingJobs" :key="job.id" class="job-item">
          <div class="job-header">
            <h4>{{ job.job_name }}</h4>
            <span class="job-status" :class="job.status">{{ job.status }}</span>
          </div>
          
          <div v-if="job.status === 'running'" class="progress-info">
            <p>🔄 학습 진행 중... (실시간 업데이트)</p>
            <div v-if="job.progress && job.progress.final_epoch" class="progress-bar">
              <div class="progress-fill" :style="{ width: '100%' }"></div>
            </div>
          </div>
          
          <div v-if="job.status === 'completed'" class="completion-info">
            <p>✅ 학습 완료!</p>
            <div v-if="job.progress && job.progress.final_metrics" class="final-metrics">
              <span>mAP50: {{ (job.progress.final_metrics.mAP50 || 0).toFixed(3) }}</span>
              <span>Precision: {{ (job.progress.final_metrics.precision || 0).toFixed(3) }}</span>
            </div>
          </div>
          
          <div class="job-timestamps">
            <small v-if="job.started_at">시작: {{ formatDate(job.started_at) }}</small>
            <small v-if="job.completed_at">완료: {{ formatDate(job.completed_at) }}</small>
          </div>
        </div>
      </div>
      
    </div>

    <!-- 모델 히스토리 -->
    <div class="model-history-card">
      <h2>📈 모델 히스토리</h2>
      
      <div class="history-list">
        <div 
          v-for="model in modelHistory" 
          :key="model.id"
          class="history-item"
          :class="{ active: model.status === 'active' }"
        >
          <div class="model-info">
            <h4>{{ model.model_name }}</h4>
            <span class="version">v{{ model.version }}</span>
            <span class="status" :class="model.status">{{ model.status }}</span>
          </div>
          
          <div class="model-metrics">
            <div class="metric">
              <label>mAP50</label>
              <span>{{ (model.metrics?.mAP50 || 0).toFixed(3) }}</span>
            </div>
            <div class="metric">
              <label>Precision</label>
              <span>{{ (model.metrics?.precision || 0).toFixed(3) }}</span>
            </div>
            <div class="metric">
              <label>Recall</label>
              <span>{{ (model.metrics?.recall || 0).toFixed(3) }}</span>
            </div>
          </div>
          
          <div class="model-actions">
            <button 
              v-if="model.status !== 'active'" 
              @click="activateModel(model.id)"
              :disabled="isLoading"
              class="btn-small"
            >
              활성화
            </button>
            <button 
              @click="viewModelDetails(model)"
              class="btn-small btn-outline"
            >
              상세보기
            </button>
          </div>
          
          <div class="model-timestamp">
            {{ formatDate(model.created_at) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 실시간 연결 상태 -->
    <div class="connection-status">
      <div class="status-indicator" :class="{ connected: isConnected }">
        <span class="status-dot"></span>
        {{ isConnected ? '실시간 연결됨' : '연결 끊김' }}
      </div>
    </div>

    <!-- 에러 메시지 -->
    <div v-if="error" class="error-message">
      <h3>❌ 오류 발생</h3>
      <p>{{ error }}</p>
      <button @click="error = null" class="btn-small">닫기</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAutomatedModelRegistry } from '@/composables/useAutomatedModelRegistry.js'
import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 생성
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// 모델 레지스트리 훅
const {
  currentModel,
  modelHistory,
  isLoading,
  error,
  isConnected,
  modelSizeFormatted,
  modelPerformance,
  fetchLatestModel,
  fetchModelHistory,
  activateModel,
  startTraining: startTrainingJob
} = useAutomatedModelRegistry()

// 로컬 상태
const trainingJobs = ref([])

// 세트 단위 학습 상태
const selectedSetNum = ref('')
const setInfo = ref(null)

// 학습 작업 목록 조회
const fetchTrainingJobs = async () => {
  try {
    const { data, error } = await supabase
      .from('training_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) throw error
    trainingJobs.value = data || []
  } catch (err) {
    console.error('학습 작업 조회 실패:', err)
  }
}



// 세트 정보 로드
const loadSetInfo = async () => {
  try {
    console.log(`📦 세트 ${selectedSetNum.value} 정보 로드 중...`)
    
    // 디버깅: 전체 세트 목록 확인
    const { data: allSets, error: allSetsError } = await supabase
      .from('lego_sets')
      .select('set_num, name')
      .limit(10)
    
    console.log('📋 전체 세트 목록 (최대 10개):', allSets)
    if (allSetsError) {
      console.error('❌ 전체 세트 조회 오류:', allSetsError)
    }
    
    // 1. 세트 부품 정보 조회 (3단계 매칭 로직 사용)
    let legoSet = null
    
    // 1단계: 정확한 매치 시도
    try {
      const { data: exactMatch, error: exactError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', selectedSetNum.value)
        .limit(1)
      
      if (exactError) throw exactError
      if (exactMatch && exactMatch.length > 0) {
        legoSet = exactMatch[0]
        console.log('정확한 매치 찾음:', legoSet)
      }
    } catch (error) {
      console.log('정확한 매치 실패:', selectedSetNum.value)
    }

    // 2단계: 기본 번호로 시도 (예: 76917-1 -> 76917)
    if (!legoSet) {
      const baseSetNum = selectedSetNum.value.split('-')[0]
      try {
        const { data: baseMatch, error: baseError } = await supabase
          .from('lego_sets')
          .select('id, set_num, name')
          .eq('set_num', baseSetNum)
          .limit(1)
        
        if (baseError) throw baseError
        if (baseMatch && baseMatch.length > 0) {
          legoSet = baseMatch[0]
          console.log('기본 번호 매치 찾음:', legoSet)
        }
      } catch (error) {
        console.log('기본 번호 매치 실패:', baseSetNum)
      }
    }

    // 3단계: LIKE 패턴으로 시도
    if (!legoSet) {
      try {
        const { data: likeMatch, error: likeError } = await supabase
          .from('lego_sets')
          .select('id, set_num, name')
          .like('set_num', `${selectedSetNum.value}%`)
          .limit(1)
        
        if (likeError) throw likeError
        if (likeMatch && likeMatch.length > 0) {
          legoSet = likeMatch[0]
          console.log('LIKE 패턴 매치 찾음:', legoSet)
        }
      } catch (error) {
        console.log('LIKE 패턴 매치 실패:', selectedSetNum.value)
      }
    }
    
    if (!legoSet) {
      throw new Error(`세트 ${selectedSetNum.value}를 찾을 수 없습니다`)
    }
    
    // 세트 부품 수 조회
    const { data: setParts, error: setPartsError } = await supabase
      .from('set_parts')
      .select('part_id')
      .eq('set_id', legoSet.id)
    
    if (setPartsError) {
      console.warn('세트 부품 조회 실패:', setPartsError)
    }
    
    const totalParts = setParts?.length || 0
    
    // 2. 세트 학습 상태 조회 (76917 / 76917-1 모두 처리, 안전 조회)
    let trainingStatus = null
    try {
      const baseSetNum = selectedSetNum.value.split('-')[0]
      const { data: statusRows, error: statusError } = await supabase
        .from('set_training_status')
        .select('*')
        .in('set_num', [selectedSetNum.value, baseSetNum])
        .order('updated_at', { ascending: false })
        .limit(1)
      
      if (statusError) {
        console.warn('세트 학습 상태 조회 실패:', statusError)
      } else if (statusRows && statusRows.length > 0) {
        trainingStatus = statusRows[0]
        console.log('세트 학습 상태:', trainingStatus)
      } else {
        console.log('세트 학습 상태 없음 (초기 상태)')
      }
    } catch (error) {
      console.warn('세트 학습 상태 조회 중 오류:', error)
      // 오류가 있어도 계속 진행
    }
    
    // 3. 이미 학습된 부품 수 조회 (세트 기준)
    let trainedPartsCount = 0
    try {
      // 3-1) set_training_status.unique_parts_trained 우선 사용
      if (trainingStatus && typeof trainingStatus.unique_parts_trained === 'number') {
        trainedPartsCount = trainingStatus.unique_parts_trained
        console.log('unique_parts_trained 사용:', trainedPartsCount)
      } else {
        // 3-2) model_registry에서 세트별 학습 이력 확인 (training_metadata 컬럼이 있는 경우만)
        try {
          const baseSetNum = selectedSetNum.value.split('-')[0]
          const { data: modelRows, error: modelError } = await supabase
            .from('model_registry')
            .select('training_metadata, created_at')
            .contains('training_metadata', { set_num: baseSetNum })
            .order('created_at', { ascending: false })
            .limit(1)

          if (modelError) {
            console.warn('모델 이력 조회 실패 (training_metadata 컬럼 없음):', modelError)
            // training_metadata 컬럼이 없는 경우 기본값 사용
            trainedPartsCount = 0
          } else if (modelRows && modelRows.length > 0) {
            const meta = modelRows[0]?.training_metadata || {}
            trainedPartsCount = typeof meta.trained_parts_count === 'number'
              ? meta.trained_parts_count
              : Array.isArray(meta.trained_parts) ? meta.trained_parts.length : 0
            console.log('model_registry 메타에서 계산:', trainedPartsCount)
          }
        } catch (error) {
          console.warn('training_metadata 컬럼 조회 실패, 기본값 사용:', error)
          trainedPartsCount = 0
        }
      }
    } catch (e) {
      console.warn('학습된 부품 수 계산 중 오류:', e)
    }

    // 세트 정보 구성
    trainedPartsCount = Math.min(trainedPartsCount, totalParts)
    const newPartsCount = Math.max(0, totalParts - trainedPartsCount)
    
    setInfo.value = {
      set_num: selectedSetNum.value,
      set_name: legoSet.name,
      total_parts: totalParts,
      trained_parts: trainedPartsCount,
      new_parts: newPartsCount,
      status: trainingStatus?.status || 'pending',
      training_status: trainingStatus,
      lego_set: legoSet
    }
    
    console.log(`✅ 세트 정보 로드 완료: 총 ${totalParts}개, 학습됨 ${trainedPartsCount}개, 새로 학습할 ${newPartsCount}개`)
  } catch (err) {
    console.error('세트 정보 로드 실패:', err)
    setInfo.value = null
  }
}

// 세트 학습 시작
const startSetTraining = async () => {
  try {
    console.log(`🎯 세트 ${selectedSetNum.value} 학습 시작...`)
    
    // 1. 세트 학습 상태 업데이트 (세트번호 정규화하여 저장)
    const baseSetNum = selectedSetNum.value.split('-')[0]
    const { error: updateError } = await supabase
      .from('set_training_status')
      .upsert({
        set_num: baseSetNum,
        status: 'training',
        total_parts_in_set: setInfo.value.total_parts,
        last_rendered_at: new Date().toISOString()
      }, {
        onConflict: 'set_num'
      })
    
    if (updateError) {
      console.warn('세트 학습 상태 업데이트 실패:', updateError)
    }
    
    // 2. 일반 학습 시작 (세트별 데이터 필터링은 Colab에서 처리)
    await startTrainingJob('latest', {
      epochs: 100,
      batch_size: 16,
      imgsz: 640,
      device: 'cuda',
      set_num: selectedSetNum.value // 세트 번호 전달
    })
    
    // 3. 세트 정보 새로고침
    await loadSetInfo()
    await refreshData()
    
    console.log(`✅ 세트 ${selectedSetNum.value} 학습이 시작되었습니다!`)
  } catch (err) {
    console.error('세트 학습 시작 실패:', err)
  }
}

// 세트 학습 상태 확인
const checkSetTrainingStatus = async () => {
  try {
    console.log(`📊 세트 ${selectedSetNum.value} 학습 상태 확인 중...`)
    await loadSetInfo()
    console.log('✅ 세트 학습 상태 확인 완료')
  } catch (err) {
    console.error('세트 학습 상태 확인 실패:', err)
  }
}

// 상태 텍스트 변환
const getStatusText = (status) => {
  const statusMap = {
    'pending': '대기 중',
    'rendering': '렌더링 중',
    'training': '학습 중',
    'completed': '완료',
    'failed': '실패'
  }
  return statusMap[status] || status
}

// 데이터 새로고침
const refreshData = async () => {
  try {
    await fetchLatestModel()
    await fetchModelHistory()
    await fetchTrainingJobs()
  } catch (err) {
    console.error('데이터 새로고침 실패:', err)
  }
}

// 모델 상세보기
const viewModelDetails = (model) => {
  console.log('모델 상세 정보:', model)
  // 모달 또는 상세 페이지로 이동
}

// 날짜 포맷팅
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

// 실시간 구독 설정
const setupRealtimeSubscription = () => {
  // training_jobs 테이블 실시간 구독
  const trainingJobsChannel = supabase
    .channel('training_jobs_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'training_jobs' },
      async (payload) => {
        console.log('🔄 학습 작업 상태 변경:', payload)
        await fetchTrainingJobs() // 학습 작업만 새로고침
      }
    )
    .subscribe()

  // training_metrics 테이블 실시간 구독
  const trainingMetricsChannel = supabase
    .channel('training_metrics_changes')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'training_metrics' },
      async (payload) => {
        console.log('📊 새로운 메트릭 데이터:', payload)
        await fetchTrainingJobs() // 학습 작업 새로고침
      }
    )
    .subscribe()

  // model_registry 테이블 실시간 구독
  const modelRegistryChannel = supabase
    .channel('model_registry_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'model_registry' },
      async (payload) => {
        console.log('🏆 모델 레지스트리 변경:', payload)
        await refreshData() // 전체 데이터 새로고침
      }
    )
    .subscribe()

  return { trainingJobsChannel, trainingMetricsChannel, modelRegistryChannel }
}

// 초기화
onMounted(async () => {
  await refreshData()
  setupRealtimeSubscription()
})
</script>

<style scoped>
.automated-training-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 30px;
}

.dashboard-header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.dashboard-header p {
  color: #7f8c8d;
  font-size: 16px;
}

.model-status-card,
.training-jobs-card,
.model-history-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
}

.model-status-card h2,
.training-jobs-card h2,
.model-history-card h2 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 20px;
}

.model-info {
  display: grid;
  gap: 20px;
}

.model-basic-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.model-basic-info h3 {
  margin: 0;
  color: #2c3e50;
}

.version {
  background: #3498db;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.status.active {
  background: #27ae60;
  color: white;
}

.status.inactive {
  background: #95a5a6;
  color: white;
}

.model-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.metric label {
  font-size: 12px;
  color: #7f8c8d;
  margin-bottom: 4px;
}

.metric .value {
  font-size: 18px;
  font-weight: bold;
  color: #2c3e50;
}

.model-performance {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.performance-status {
  font-weight: bold;
  margin-bottom: 12px;
}

.performance-status.good {
  color: #27ae60;
}

.performance-status.poor {
  color: #e74c3c;
}

.issues,
.recommendations {
  margin-top: 12px;
}

.issues h4,
.recommendations h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.issues ul,
.recommendations ul {
  margin: 0;
  padding-left: 20px;
}

.issues li {
  color: #e74c3c;
  font-size: 13px;
}

.recommendations li {
  color: #3498db;
  font-size: 13px;
}

.no-model {
  text-align: center;
  padding: 40px;
  color: #7f8c8d;
}

.no-model-description {
  color: #7f8c8d;
  font-size: 14px;
  margin-top: 10px;
  font-style: italic;
}

.training-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
}

.training-config {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
}

.config-item label {
  font-size: 14px;
  color: #2c3e50;
  margin-bottom: 4px;
}

.config-item input,
.config-item select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.config-actions {
  display: flex;
  gap: 12px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 20px;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e1e8ed;
}

.history-item.active {
  border-color: #3498db;
  background: #ebf3fd;
}

.model-actions {
  display: flex;
  gap: 8px;
}

.btn-small {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-small:not(.btn-outline) {
  background: #3498db;
  color: white;
}

.btn-outline {
  background: transparent;
  color: #3498db;
  border: 1px solid #3498db;
}

.model-timestamp {
  font-size: 12px;
  color: #7f8c8d;
}

.connection-status {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 14px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e74c3c;
}

.status-indicator.connected .status-dot {
  background: #27ae60;
}

.error-message {
  background: #e74c3c;
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.error-message h3 {
  margin: 0 0 8px 0;
}

.error-message p {
  margin: 0 0 12px 0;
}

/* 세트 단위 학습 섹션 스타일 */
.set-based-training-section {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.set-based-training-section h2 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 24px;
}

.section-description {
  color: #7f8c8d;
  margin-bottom: 20px;
  font-size: 16px;
}

.set-training-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.set-input {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid #e1e8ed;
  border-radius: 8px;
  font-size: 14px;
}

.set-input:focus {
  outline: none;
  border-color: #3498db;
}

.set-info-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  border-left: 4px solid #3498db;
}

.set-info-card h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
}

.set-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.detail-item .label {
  font-size: 14px;
  color: #7f8c8d;
  font-weight: 500;
}

.detail-item .value {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.detail-item .value.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.detail-item .value.status.pending {
  background: #f39c12;
  color: white;
}

.detail-item .value.status.training {
  background: #3498db;
  color: white;
}

.detail-item .value.status.completed {
  background: #27ae60;
  color: white;
}

.detail-item .value.status.failed {
  background: #e74c3c;
  color: white;
}

.set-training-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .automated-training-dashboard {
    padding: 10px;
  }
  
  .model-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .history-item {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .set-details {
    grid-template-columns: 1fr;
  }
  
  .input-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .set-training-actions {
    flex-direction: column;
  }
}
</style>
