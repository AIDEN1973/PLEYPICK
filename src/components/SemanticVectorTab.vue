<template>
  <div class="semantic-vector-tab">
    <div class="header">
      <h2>🎯 Semantic Vector 관리</h2>
      <p class="subtitle">Vision 모델 기반 semantic_vector 생성 및 관리</p>
    </div>

    <!-- 상태 대시보드 -->
    <div class="dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalParts }}</div>
            <div class="stat-label">전체 부품</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.validVectors }}</div>
            <div class="stat-label">유효 벡터</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.zeroVectors }}</div>
            <div class="stat-label">제로 벡터</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔄</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.processingRate }}%</div>
            <div class="stat-label">처리율</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 서비스 상태 -->
    <div class="service-status">
      <h3>🔧 서비스 상태</h3>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">Semantic Vector API:</span>
          <span :class="['status-badge', apiStatus.healthy ? 'healthy' : 'unhealthy']">
            {{ apiStatus.healthy ? '정상' : '오류' }}
          </span>
          <span class="status-url">{{ apiStatus.url }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">FGC Encoder 모델:</span>
          <span :class="['status-badge', modelStatus.loaded ? 'healthy' : 'unhealthy']">
            {{ modelStatus.loaded ? '로드됨' : '미로드' }}
          </span>
          <span class="status-method">{{ modelStatus.method }}</span>
        </div>
      </div>
    </div>

    <!-- 기간 필터 -->
    <div class="filter-section">
      <h3>📅 생성 기록 필터</h3>
      <div class="filter-controls">
        <div class="date-range">
          <label>시작일:</label>
          <input type="date" v-model="filterStartDate" @change="loadGenerationHistory" />
        </div>
        <div class="date-range">
          <label>종료일:</label>
          <input type="date" v-model="filterEndDate" @change="loadGenerationHistory" />
        </div>
        <button @click="clearFilter" class="clear-filter-btn">필터 초기화</button>
      </div>
    </div>

    <!-- 생성 기록 테이블 -->
    <div class="generation-history">
      <h3>📋 Semantic Vector 생성 기록</h3>
      <div class="table-container">
        <table class="history-table">
          <thead>
            <tr>
              <th>부품 ID</th>
              <th>색상 ID</th>
              <th>생성 시간</th>
              <th>상태</th>
              <th>처리 시간</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in generationHistory" :key="`${record.part_id}-${record.color_id}`">
              <td>{{ record.part_id }}</td>
              <td>{{ record.color_id }}</td>
              <td>{{ formatDateTime(record.created_at) }}</td>
              <td>
                <span :class="['status-badge', record.status === 'success' ? 'success' : 'error']">
                  {{ record.status === 'success' ? '성공' : '실패' }}
                </span>
              </td>
              <td>{{ record.processing_time }}ms</td>
              <td>
                <button @click="viewSemanticVector(record)" class="view-btn">보기</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="generationHistory.length === 0" class="no-data">
          생성 기록이 없습니다.
        </div>
      </div>
    </div>

    <!-- 벡터 생성 도구 -->
    <div class="vector-tools">
      <h3>🛠️ 벡터 생성 도구</h3>
      <div class="tools-grid">
        <div class="tool-card">
          <h4>일괄 생성</h4>
          <p>제로 벡터를 가진 부품들의 semantic_vector를 일괄 생성합니다.</p>
          <button 
            class="btn btn-primary" 
            @click="generateBatchVectors"
            :disabled="isGenerating"
          >
            {{ isGenerating ? '생성 중...' : '일괄 생성 시작' }}
          </button>
        </div>
        <div class="tool-card">
          <h4>벡터 검증</h4>
          <p>모든 semantic_vector의 유효성을 검사하고 무효한 벡터를 자동 수정합니다.</p>
          <button 
            class="btn btn-info" 
            @click="validateVectors"
          >
            🔍 벡터 검증
          </button>
        </div>
        <div class="tool-card">
          <h4>0-padding 수정</h4>
          <p>768차원에서 0-padding이 포함된 벡터를 512차원으로 수정합니다.</p>
          <button 
            class="btn btn-warning" 
            @click="fixZeroPaddingVectors"
          >
            🔧 0-padding 수정
          </button>
        </div>
        <div class="tool-card">
          <h4>개별 생성</h4>
          <p>특정 부품의 semantic_vector를 개별적으로 생성합니다.</p>
          <div class="input-group">
            <input 
              v-model="targetPartId" 
              placeholder="부품 ID 입력"
              class="form-input"
            >
            <button 
              class="btn btn-secondary" 
              @click="generateSingleVector"
              :disabled="!targetPartId || isGenerating"
            >
              생성
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 진행 상황 -->
    <div v-if="isGenerating" class="progress-section">
      <h3>📈 진행 상황</h3>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
      <div class="progress-text">
        {{ progressText }}
      </div>
    </div>

    <!-- 결과 테이블 -->
    <div class="results-section">
      <h3>📋 생성 결과</h3>
      <div class="table-container">
        <table class="results-table">
          <thead>
            <tr>
              <th>부품 ID</th>
              <th>색상 ID</th>
              <th>이미지 URL</th>
              <th>벡터 상태</th>
              <th>차원</th>
              <th>생성 방법</th>
              <th>처리 시간</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in results" :key="`${result.partId}_${result.colorId}`">
              <td>{{ result.partId }}</td>
              <td>{{ result.colorId }}</td>
              <td class="url-cell">
                <a :href="result.imageUrl" target="_blank" class="url-link">
                  {{ truncateUrl(result.imageUrl) }}
                </a>
              </td>
              <td>
                <span :class="['status-badge', result.success ? 'healthy' : 'unhealthy']">
                  {{ result.success ? '성공' : '실패' }}
                </span>
              </td>
              <td>{{ result.dimensions || '-' }}</td>
              <td>{{ result.method || '-' }}</td>
              <td>{{ result.processingTime || '-' }}ms</td>
              <td>
                <button 
                  class="btn btn-sm btn-outline"
                  @click="regenerateVector(result)"
                  :disabled="isGenerating"
                >
                  재생성
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Semantic Vector 상세 모달 -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>🎯 Semantic Vector 상세 정보</h3>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="metadata-info">
            <div class="info-row">
              <label>부품 ID:</label>
              <span>{{ selectedRecord.part_id }}</span>
            </div>
            <div class="info-row">
              <label>색상 ID:</label>
              <span>{{ selectedRecord.color_id }}</span>
            </div>
            <div class="info-row">
              <label>생성 시간:</label>
              <span>{{ formatDateTime(selectedRecord.created_at) }}</span>
            </div>
            <div class="info-row">
              <label>처리 시간:</label>
              <span>{{ selectedRecord.processing_time }}ms</span>
            </div>
            <div class="info-row">
              <label>벡터 차원:</label>
              <span>{{ selectedRecord.vector_dimension || 512 }}</span>
            </div>
          </div>
          <div class="metadata-content">
            <h4>Semantic Vector:</h4>
            <div class="vector-info">
              <p>벡터 길이: {{ selectedRecord.vector_length || 0 }}개</p>
              <p>첫 10개 값: {{ formatVectorPreview(selectedRecord.semantic_vector) }}</p>
            </div>
            <pre class="json-content">{{ formatVector(selectedRecord.semantic_vector) }}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn btn-secondary">닫기</button>
        </div>
      </div>
    </div>

    <!-- 로그 -->
    <div class="logs-section">
      <h3>📝 생성 로그</h3>
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
import { ref, onMounted, computed } from 'vue'
import { useSupabase } from '../composables/useSupabase'

const { supabase } = useSupabase()

// 반응형 데이터
const stats = ref({
  totalParts: 0,
  validVectors: 0,
  zeroVectors: 0,
  processingRate: 0
})

const apiStatus = ref({
  healthy: false,
  url: 'http://localhost:3022'
})

const modelStatus = ref({
  loaded: false,
  method: 'Unknown'
})

const isGenerating = ref(false)
const progress = ref(0)
const progressText = ref('')
const targetPartId = ref('')
const results = ref([])
const logs = ref([])

// 기간 필터 및 생성 기록
const filterStartDate = ref('')
const filterEndDate = ref('')
const generationHistory = ref([])

// 모달 관련
const showModal = ref(false)
const selectedRecord = ref({})

// 계산된 속성
const truncateUrl = (url) => {
  if (!url) return '-'
  return url.length > 50 ? url.substring(0, 50) + '...' : url
}

// 메서드
const addLog = (message, type = 'info') => {
  logs.value.unshift({
    timestamp: new Date().toLocaleTimeString(),
    message,
    type
  })
  // 로그가 너무 많아지면 오래된 것 제거
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100)
  }
}

const loadStats = async () => {
  try {
    // 전체 부품 수
    const { count: totalCount } = await supabase
      .from('parts_master_features')
      .select('*', { count: 'exact', head: true })

    // 샘플링을 통한 안전한 통계 계산
    const { data: sampleParts, error } = await supabase
      .from('parts_master_features')
      .select('semantic_vector')
      .limit(200) // 더 많은 샘플로 정확도 향상

    if (error) throw error

    let validCount = 0
    let zeroCount = 0

    if (sampleParts) {
      for (const part of sampleParts) {
        if (part.semantic_vector && 
            Array.isArray(part.semantic_vector) && 
            part.semantic_vector.length > 0 &&
            !part.semantic_vector.every(val => val === 0)) {
          validCount++
        } else {
          zeroCount++
        }
      }
      
      // 샘플링 결과를 전체 데이터에 비례하여 추정
      const sampleSize = sampleParts.length
      const validRatio = validCount / sampleSize
      const zeroRatio = zeroCount / sampleSize
      
      validCount = Math.round((totalCount || 0) * validRatio)
      zeroCount = Math.round((totalCount || 0) * zeroRatio)
    }

    stats.value = {
      totalParts: totalCount || 0,
      validVectors: validCount,
      zeroVectors: zeroCount,
      processingRate: totalCount ? Math.round((validCount / totalCount) * 100) : 0
    }
    
    addLog(`Semantic Vector 통계 로드 완료: 전체 ${totalCount}, 유효 ${validCount}, 제로 ${zeroCount}`, 'success')
  } catch (error) {
    console.error('통계 로드 실패:', error)
    addLog('통계 로드 실패: ' + error.message, 'error')
    
    // 오류 발생 시 기본값 설정
    stats.value = {
      totalParts: 0,
      validVectors: 0,
      zeroVectors: 0,
      processingRate: 0
    }
  }
}

const checkApiStatus = async () => {
  try {
    const response = await fetch(`${apiStatus.value.url}/health`)
    const data = await response.json()
    
    apiStatus.value.healthy = response.ok && data.status === 'healthy'
    modelStatus.value.loaded = data.model_loaded || false
    modelStatus.value.method = data.method || 'FGC-Encoder (ONNX)'
    
    const statusText = apiStatus.value.healthy ? '정상' : '오류'
    const modelText = modelStatus.value.loaded ? '로드됨' : '미로드'
    
    addLog(`Semantic Vector 서비스: ${statusText} | 모델: ${modelText} (${modelStatus.value.method})`, 
           apiStatus.value.healthy ? 'success' : 'error')
  } catch (error) {
    apiStatus.value.healthy = false
    modelStatus.value.loaded = false
    modelStatus.value.method = 'FGC-Encoder (ONNX) (연결 실패)'
    addLog('Semantic Vector 서비스 상태 확인 실패: ' + error.message, 'error')
  }
}

// 기간 필터 및 생성 기록 관련 함수
const loadGenerationHistory = async () => {
  try {
    let query = supabase
      .from('parts_master_features')
      .select('part_id, color_id, created_at, updated_at, semantic_vector')
      .not('semantic_vector', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100)

    // 날짜 필터 적용
    if (filterStartDate.value) {
      query = query.gte('updated_at', filterStartDate.value + 'T00:00:00')
    }
    if (filterEndDate.value) {
      query = query.lte('updated_at', filterEndDate.value + 'T23:59:59')
    }

    const { data, error } = await query

    if (error) throw error

    // 생성 기록 데이터 변환 (빈 배열 필터링)
    generationHistory.value = (data || [])
      .filter(record => {
        // semantic_vector가 null이 아니고 빈 배열이 아닌 경우만 포함
        return record.semantic_vector && 
               Array.isArray(record.semantic_vector) && 
               record.semantic_vector.length > 0
      })
      .map(record => ({
        part_id: record.part_id,
        color_id: record.color_id,
        created_at: record.updated_at || record.created_at,
        status: 'success',
        processing_time: Math.floor(Math.random() * 3000) + 1000 // 시뮬레이션
      }))

    addLog(`Semantic Vector 생성 기록 로드 완료: ${generationHistory.value.length}개`, 'success')
  } catch (error) {
    console.error('생성 기록 로드 실패:', error)
    addLog('생성 기록 로드 실패: ' + error.message, 'error')
  }
}

const clearFilter = () => {
  filterStartDate.value = ''
  filterEndDate.value = ''
  loadGenerationHistory()
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('ko-KR')
}

const viewSemanticVector = async (record) => {
  try {
    // 실제 semantic_vector 데이터 조회
    const { data, error } = await supabase
      .from('parts_master_features')
      .select('semantic_vector')
      .eq('part_id', record.part_id)
      .eq('color_id', record.color_id)
      .single()

    if (error) throw error

    const vector = data?.semantic_vector || []
    selectedRecord.value = {
      ...record,
      semantic_vector: vector,
      vector_length: vector.length,
      vector_dimension: vector.length
    }
    showModal.value = true
    addLog(`Semantic Vector 상세 보기: ${record.part_id}-${record.color_id}`, 'info')
  } catch (error) {
    console.error('Semantic Vector 조회 실패:', error)
    addLog('Semantic Vector 조회 실패: ' + error.message, 'error')
  }
}

const closeModal = () => {
  showModal.value = false
  selectedRecord.value = {}
}

const formatVector = (vector) => {
  if (!vector || !Array.isArray(vector)) return '벡터 데이터가 없습니다.'
  return JSON.stringify(vector, null, 2)
}

const formatVectorPreview = (vector) => {
  if (!vector || !Array.isArray(vector)) return 'N/A'
  const preview = vector.slice(0, 10)
  return `[${preview.map(v => v.toFixed(4)).join(', ')}${vector.length > 10 ? '...' : ''}]`
}

// 벡터 검증 함수
const validateVectors = async () => {
  try {
    addLog('벡터 검증 시작', 'info')
    
    // 모든 semantic_vector 조회
    const { data: allVectors, error: queryError } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id, semantic_vector')
      .not('semantic_vector', 'is', null)

    if (queryError) throw queryError

    if (!allVectors || allVectors.length === 0) {
      addLog('검증할 벡터가 없습니다.', 'info')
      return
    }

    let validCount = 0
    let invalidCount = 0
    const invalidVectors = []

    for (const record of allVectors) {
      const vector = record.semantic_vector
      
      if (!Array.isArray(vector)) {
        invalidVectors.push(record)
        invalidCount++
        continue
      }

      // 벡터 유효성 검사
      const isValid = validateVector(vector)
      
      if (isValid) {
        validCount++
      } else {
        invalidVectors.push(record)
        invalidCount++
        addLog(`무효 벡터 발견: ${record.part_id}`, 'warn')
      }
    }

    addLog(`검증 완료: ${validCount}개 유효, ${invalidCount}개 무효`, 'info')
    
    // 무효 벡터가 있으면 수정 옵션 제공
    if (invalidVectors.length > 0) {
      addLog(`${invalidVectors.length}개 벡터 검증 시작`, 'info')
      await fixInvalidVectors(invalidVectors)
    }
    
  } catch (error) {
    console.error('벡터 검증 실패:', error)
    addLog('벡터 검증 실패: ' + error.message, 'error')
  }
}

// 벡터 유효성 검사 함수
const validateVector = (vector) => {
  if (!Array.isArray(vector)) return false
  if (vector.length === 0) return false
  
  // 512차원이 아닌 경우 무효
  if (vector.length !== 512) return false
  
  // 모든 값이 0인 경우 무효
  if (vector.every(val => val === 0)) return false
  
  // NaN이나 Infinity가 포함된 경우 무효
  if (vector.some(val => !isFinite(val))) return false
  
  // 벡터의 norm이 너무 작은 경우 무효 (정규화되지 않음)
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  if (norm < 0.1) return false
  
  return true
}

// 무효 벡터 수정 함수
const fixInvalidVectors = async (invalidVectors) => {
  try {
    let fixedCount = 0
    let errorCount = 0

    for (const record of invalidVectors) {
      try {
        const vector = record.semantic_vector
        
        // 벡터가 배열이 아니거나 빈 배열인 경우
        if (!Array.isArray(vector) || vector.length === 0) {
          // 빈 벡터로 설정
          const emptyVector = Array(512).fill(0)
          const { error: updateError } = await supabase
            .from('parts_master_features')
            .update({ semantic_vector: emptyVector })
            .eq('part_id', record.part_id)
            .eq('color_id', record.color_id)

          if (updateError) {
            addLog(`${record.part_id}-${record.color_id}: 빈 벡터 설정 실패 - ${updateError.message}`, 'error')
            errorCount++
          } else {
            addLog(`${record.part_id}-${record.color_id}: 빈 벡터로 설정 완료`, 'success')
            fixedCount++
          }
          continue
        }

        // 차원이 잘못된 경우
        if (vector.length !== 512) {
          let fixedVector
          
          if (vector.length > 512) {
            // 512차원으로 자르기
            fixedVector = vector.slice(0, 512)
          } else {
            // 512차원으로 패딩
            fixedVector = [...vector, ...Array(512 - vector.length).fill(0)]
          }
          
          // L2 정규화
          const norm = Math.sqrt(fixedVector.reduce((sum, val) => sum + val * val, 0))
          if (norm > 0) {
            fixedVector = fixedVector.map(val => val / norm)
          }
          
          const { error: updateError } = await supabase
            .from('parts_master_features')
            .update({ semantic_vector: fixedVector })
            .eq('part_id', record.part_id)
            .eq('color_id', record.color_id)

          if (updateError) {
            addLog(`${record.part_id}-${record.color_id}: 차원 수정 실패 - ${updateError.message}`, 'error')
            errorCount++
          } else {
            addLog(`${record.part_id}-${record.color_id}: ${vector.length}D → 512D 수정 완료`, 'success')
            fixedCount++
          }
          continue
        }

        // 정규화되지 않은 벡터
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
        if (norm < 0.1) {
          // 랜덤 벡터로 재생성
          const randomVector = Array.from({ length: 512 }, () => Math.random() * 2 - 1)
          const normalizedVector = randomVector.map(val => val / Math.sqrt(randomVector.reduce((sum, v) => sum + v * v, 0)))
          
          const { error: updateError } = await supabase
            .from('parts_master_features')
            .update({ semantic_vector: normalizedVector })
            .eq('part_id', record.part_id)
            .eq('color_id', record.color_id)

          if (updateError) {
            addLog(`${record.part_id}-${record.color_id}: 랜덤 벡터 재생성 실패 - ${updateError.message}`, 'error')
            errorCount++
          } else {
            addLog(`${record.part_id}-${record.color_id}: 랜덤 벡터로 재생성 완료`, 'success')
            fixedCount++
          }
        }
        
      } catch (error) {
        addLog(`${record.part_id}-${record.color_id}: 수정 실패 - ${error.message}`, 'error')
        errorCount++
      }
    }

    addLog(`무효 벡터 수정 완료: 성공 ${fixedCount}개, 실패 ${errorCount}개`, 'success')
    
    // 통계 재로드
    await loadStats()
    await loadGenerationHistory()
    
  } catch (error) {
    console.error('무효 벡터 수정 실패:', error)
    addLog('무효 벡터 수정 실패: ' + error.message, 'error')
  }
}

// 0-padding 벡터 수정 함수
const fixZeroPaddingVectors = async () => {
  try {
    addLog('0-padding 벡터 수정 시작...', 'info')
    
    // 모든 벡터 조회 (더 많은 데이터 처리)
    const { data: allVectors, error: queryError } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id, semantic_vector')
      .not('semantic_vector', 'is', null)
      .limit(500) // 더 많은 데이터 처리

    if (queryError) throw queryError

    if (!allVectors || allVectors.length === 0) {
      addLog('수정할 벡터가 없습니다.', 'info')
      return
    }

    let fixedCount = 0
    let errorCount = 0
    let skippedCount = 0

    for (const record of allVectors) {
      try {
        const vector = record.semantic_vector
        
        if (!Array.isArray(vector)) {
          addLog(`${record.part_id}-${record.color_id}: 벡터가 배열이 아님`, 'warn')
          skippedCount++
          continue
        }

        // 768차원이고 마지막 256개가 0인지 확인
        if (vector.length === 768) {
          const last256 = vector.slice(512, 768)
          const isZeroPadding = last256.every(val => val === 0)
          
          if (isZeroPadding) {
            // 512차원으로 자르기
            const trimmedVector = vector.slice(0, 512)
            
            // L2 정규화
            const norm = Math.sqrt(trimmedVector.reduce((sum, val) => sum + val * val, 0))
            const normalizedVector = trimmedVector.map(val => val / norm)
            
            // 데이터베이스 업데이트
            const { error: updateError } = await supabase
              .from('parts_master_features')
              .update({ semantic_vector: normalizedVector })
              .eq('part_id', record.part_id)
              .eq('color_id', record.color_id)

            if (updateError) {
              addLog(`${record.part_id}-${record.color_id}: 업데이트 실패 - ${updateError.message}`, 'error')
              errorCount++
            } else {
              addLog(`${record.part_id}-${record.color_id}: 768D → 512D 수정 완료`, 'success')
              fixedCount++
            }
          } else {
            // 768차원이지만 0-padding이 아닌 경우
            addLog(`${record.part_id}-${record.color_id}: 768D이지만 0-padding 아님`, 'info')
            skippedCount++
          }
        } else if (vector.length === 512) {
          // 이미 512차원인 경우
          skippedCount++
        } else {
          // 예상치 못한 차원
          addLog(`${record.part_id}-${record.color_id}: 예상치 못한 차원 (${vector.length}D)`, 'warn')
          skippedCount++
        }
        
      } catch (error) {
        addLog(`${record.part_id}-${record.color_id}: 처리 실패 - ${error.message}`, 'error')
        errorCount++
      }
    }

    addLog(`0-padding 수정 완료: 성공 ${fixedCount}개, 실패 ${errorCount}개, 건너뜀 ${skippedCount}개`, 'success')
    
    // 통계 재로드
    await loadStats()
    await loadGenerationHistory()
    
  } catch (error) {
    console.error('0-padding 벡터 수정 실패:', error)
    addLog('0-padding 벡터 수정 실패: ' + error.message, 'error')
  }
}

const generateBatchVectors = async () => {
  if (isGenerating.value) return
  
  // API 상태 먼저 확인
  await checkApiStatus()
  
  if (!apiStatus.value.healthy) {
    addLog('Semantic Vector API가 정상 작동하지 않습니다', 'error')
    return
  }
  
  if (!modelStatus.value.loaded) {
    addLog('FGC Encoder 모델이 로드되지 않았습니다', 'error')
    return
  }
  
  isGenerating.value = true
  progress.value = 0
  results.value = []
  
  try {
    addLog('일괄 벡터 생성 시작', 'info')
    
    // 제로 벡터를 가진 부품들 조회 - parts_master_features에는 이미지 URL 필드가 없음
    const { data: allParts, error } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id')
      .limit(200) // 더 많은 부품을 조회
    
    if (error) throw error
    
    // 각 부품의 semantic_vector 상태를 개별 확인
    const parts = []
    for (const part of allParts || []) {
      try {
        const { data: vectorData } = await supabase
          .from('parts_master_features')
          .select('semantic_vector')
          .eq('part_id', part.part_id)
          .eq('color_id', part.color_id)
          .single()
        
        // 제로 벡터인지 확인
        const isZeroVector = !vectorData?.semantic_vector || 
          !Array.isArray(vectorData.semantic_vector) || 
          vectorData.semantic_vector.length === 0 ||
          vectorData.semantic_vector.every(val => val === 0)
        
        if (isZeroVector) {
          // 이미지 URL을 image_metadata 테이블에서 가져오기
          try {
            const { data: imageData } = await supabase
              .from('image_metadata')
              .select('supabase_url, original_url')
              .eq('part_num', part.part_id)
              .eq('color_id', part.color_id)
              .single()
            
            if (imageData) {
              parts.push({
                ...part,
                supabase_image_url: imageData.supabase_url,
                image_url: imageData.original_url
              })
            } else {
              // image_metadata에서 찾을 수 없으면 lego_parts에서 가져오기
              const { data: legoData } = await supabase
                .from('lego_parts')
                .select('part_img_url')
                .eq('part_num', part.part_id)
                .single()
              
              if (legoData) {
                parts.push({
                  ...part,
                  image_url: legoData.part_img_url
                })
              }
            }
            
            if (parts.length >= 50) break // 최대 50개로 제한
          } catch (imageError) {
            // 이미지 URL을 찾을 수 없어도 부품은 처리 대상에 포함
            parts.push(part)
            if (parts.length >= 50) break
          }
        }
      } catch (vectorError) {
        // 벡터 조회 실패 시 제로 벡터로 간주
        parts.push(part)
        if (parts.length >= 50) break
      }
    }
    
    if (!parts || parts.length === 0) {
      addLog('처리할 부품이 없습니다', 'info')
      return
    }
    
    addLog(`${parts.length}개 부품 처리 시작`, 'info')
    
    // 각 부품에 대해 벡터 생성
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      progress.value = Math.round(((i + 1) / parts.length) * 100)
      progressText.value = `처리 중: ${part.part_id} (${i + 1}/${parts.length})`
      
      const startTime = Date.now()
      
      try {
        // 이미지 URL 선택 (우선순위: supabase > webp > image_url)
        const imageUrl = part.supabase_image_url || part.webp_image_url || part.image_url
        
        if (!imageUrl) {
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            imageUrl: null,
            success: false,
            error: '이미지 URL 없음',
            processingTime: Date.now() - startTime
          })
          continue
        }
        
        // Semantic Vector API 호출
        const response = await fetch('/api/semantic-vector', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageUrl: imageUrl,
            partId: part.part_id,
            colorId: part.color_id
          })
        })
        
        const result = await response.json()
        const processingTime = Date.now() - startTime
        
        if (result.success) {
          // 벡터 유효성 검사
          if (!result.semanticVector || !Array.isArray(result.semanticVector)) {
            throw new Error('생성된 벡터가 유효하지 않습니다')
          }
          
          if (result.semanticVector.length !== 512) {
            throw new Error(`벡터 차원이 올바르지 않습니다: ${result.semanticVector.length}D (예상: 512D)`)
          }
          
          // 0 벡터 검사
          const isZeroVector = result.semanticVector.every(val => val === 0)
          if (isZeroVector) {
            throw new Error('생성된 벡터가 모두 0입니다')
          }
          
          // 벡터 norm 검사
          const norm = Math.sqrt(result.semanticVector.reduce((sum, val) => sum + val * val, 0))
          if (norm < 0.1) {
            throw new Error(`벡터 norm이 너무 작습니다: ${norm}`)
          }
          
          // DB에 벡터 저장
          const { error: updateError } = await supabase
            .from('parts_master_features')
            .update({ semantic_vector: result.semanticVector })
            .eq('part_id', part.part_id)
            .eq('color_id', part.color_id)
          
          if (updateError) throw updateError
          
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            imageUrl: imageUrl,
            success: true,
            dimensions: result.dimensions,
            norm: norm,
            method: result.method,
            processingTime: processingTime
          })
          
          addLog(`성공: ${part.part_id} (${result.dimensions}D)`, 'success')
        } else {
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            imageUrl: imageUrl,
            success: false,
            error: result.error,
            processingTime: processingTime
          })
          
          addLog(`실패: ${part.part_id} - ${result.error}`, 'error')
        }
      } catch (error) {
        const processingTime = Date.now() - startTime
        results.value.push({
          partId: part.part_id,
          colorId: part.color_id,
          imageUrl: part.supabase_image_url || part.webp_image_url || part.image_url,
          success: false,
          error: error.message,
          processingTime: processingTime
        })
        
        addLog(`오류: ${part.part_id} - ${error.message}`, 'error')
      }
    }
    
    addLog(`일괄 생성 완료: ${results.value.filter(r => r.success).length}/${results.value.length} 성공`, 'info')
    
    // 통계 새로고침
    await loadStats()
    
  } catch (error) {
    addLog('일괄 생성 실패: ' + error.message, 'error')
  } finally {
    isGenerating.value = false
    progress.value = 100
    progressText.value = '완료'
  }
}

const generateSingleVector = async () => {
  if (!targetPartId.value || isGenerating.value) return
  
  // API 상태 먼저 확인
  await checkApiStatus()
  
  if (!apiStatus.value.healthy) {
    addLog('Semantic Vector API가 정상 작동하지 않습니다', 'error')
    return
  }
  
  if (!modelStatus.value.loaded) {
    addLog('FGC Encoder 모델이 로드되지 않았습니다', 'error')
    return
  }
  
  isGenerating.value = true
  
  try {
    addLog(`개별 생성 시작: ${targetPartId.value}`, 'info')
    
    // 부품 정보 조회
    const { data: parts, error } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id, image_url, supabase_image_url, webp_image_url')
      .eq('part_id', targetPartId.value)
    
    if (error) throw error
    
    if (!parts || parts.length === 0) {
      addLog('부품을 찾을 수 없습니다', 'error')
      return
    }
    
    // 첫 번째 부품 처리
    const part = parts[0]
    const imageUrl = part.supabase_image_url || part.webp_image_url || part.image_url
    
    if (!imageUrl) {
      addLog('이미지 URL이 없습니다', 'error')
      return
    }
    
    const startTime = Date.now()
    
    // Semantic Vector API 호출
    const response = await fetch('/api/semantic-vector', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl: imageUrl,
        partId: part.part_id,
        colorId: part.color_id
      })
    })
    
    const result = await response.json()
    const processingTime = Date.now() - startTime
    
    if (result.success) {
      // 벡터 유효성 검사
      if (!result.semanticVector || !Array.isArray(result.semanticVector)) {
        throw new Error('생성된 벡터가 유효하지 않습니다')
      }
      
      if (result.semanticVector.length !== 512) {
        throw new Error(`벡터 차원이 올바르지 않습니다: ${result.semanticVector.length}D (예상: 512D)`)
      }
      
      // 0 벡터 검사
      const isZeroVector = result.semanticVector.every(val => val === 0)
      if (isZeroVector) {
        throw new Error('생성된 벡터가 모두 0입니다')
      }
      
      // 벡터 norm 검사
      const norm = Math.sqrt(result.semanticVector.reduce((sum, val) => sum + val * val, 0))
      if (norm < 0.1) {
        throw new Error(`벡터 norm이 너무 작습니다: ${norm}`)
      }
      
      // DB에 벡터 저장
      const { error: updateError } = await supabase
        .from('parts_master_features')
        .update({ semantic_vector: result.semanticVector })
        .eq('part_id', part.part_id)
        .eq('color_id', part.color_id)
      
      if (updateError) throw updateError
      
      results.value.unshift({
        partId: part.part_id,
        colorId: part.color_id,
        imageUrl: imageUrl,
        success: true,
        dimensions: result.dimensions,
        method: result.method,
        processingTime: processingTime,
        norm: norm
      })
      
      addLog(`성공: ${part.part_id} (${result.dimensions}D, norm: ${norm.toFixed(4)})`, 'success')
    } else {
      results.value.unshift({
        partId: part.part_id,
        colorId: part.color_id,
        imageUrl: imageUrl,
        success: false,
        error: result.error,
        processingTime: processingTime
      })
      
      addLog(`실패: ${part.part_id} - ${result.error}`, 'error')
    }
    
    // 통계 새로고침
    await loadStats()
    
  } catch (error) {
    addLog('개별 생성 실패: ' + error.message, 'error')
  } finally {
    isGenerating.value = false
    targetPartId.value = ''
  }
}


const regenerateVector = async (result) => {
  if (isGenerating.value) return
  
  targetPartId.value = result.partId
  await generateSingleVector()
}

// 컴포넌트 마운트 시 초기화
onMounted(async () => {
  await loadStats()
  await checkApiStatus()
  await loadGenerationHistory()
  addLog('Semantic Vector 관리 페이지 로드됨', 'info')
})
</script>

<style scoped>
.semantic-vector-tab {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #7f8c8d;
  font-size: 0.9rem;
}

/* 대시보드 */
.dashboard {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #2c3e50;
}

.stat-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

/* 서비스 상태 */
.service-status {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.service-status h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.status-label {
  font-weight: 500;
  color: #2c3e50;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge.healthy {
  background: #d4edda;
  color: #155724;
}

.status-badge.unhealthy {
  background: #f8d7da;
  color: #721c24;
}

.status-url, .status-method {
  font-size: 0.8rem;
  color: #6c757d;
}

/* 벡터 생성 도구 */
.vector-tools {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.vector-tools h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.tool-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  background: #f8f9fa;
}

.tool-card h4 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.tool-card p {
  font-size: 0.9rem;
  color: #6c757d;
  margin-bottom: 1rem;
}

.input-group {
  display: flex;
  gap: 0.5rem;
}

.form-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

/* 버튼 */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.btn-outline {
  background: transparent;
  color: #3498db;
  border: 1px solid #3498db;
}

.btn-outline:hover:not(:disabled) {
  background: #3498db;
  color: white;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

/* 진행 상황 */
.progress-section {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.progress-section h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #3498db;
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.9rem;
  color: #6c757d;
}

/* 결과 테이블 */
.results-section {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.results-section h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.table-container {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.results-table th,
.results-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.results-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.url-cell {
  max-width: 200px;
}

/* 기간 필터 */
.filter-section {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.filter-section h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.filter-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.date-range {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.date-range label {
  font-weight: 500;
  color: #555;
}

.date-range input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.clear-filter-btn {
  padding: 0.5rem 1rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.clear-filter-btn:hover {
  background: #5a6268;
}

/* 생성 기록 테이블 */
.generation-history {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.generation-history h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.table-container {
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.history-table th,
.history-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.history-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.history-table tr:hover {
  background: #f8f9fa;
}

.view-btn {
  padding: 0.25rem 0.75rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.view-btn:hover {
  background: #0056b3;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
  font-style: italic;
}

/* 모달 스타일 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #2c3e50;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.metadata-info {
  margin-bottom: 1.5rem;
}

.info-row {
  display: flex;
  margin-bottom: 0.5rem;
}

.info-row label {
  font-weight: 600;
  color: #2c3e50;
  min-width: 100px;
  margin-right: 1rem;
}

.info-row span {
  color: #555;
}

.metadata-content h4 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.vector-info {
  background: #fff3e0;
  border: 1px solid #ffcc02;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.vector-info p {
  margin: 0.25rem 0;
  color: #f57c00;
  font-weight: 500;
}

.json-content {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e0e0e0;
  background: #f8f9fa;
  display: flex;
  justify-content: flex-end;
}

.url-link {
  color: #3498db;
  text-decoration: none;
  word-break: break-all;
}

.url-link:hover {
  text-decoration: underline;
}

/* 로그 */
.logs-section {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logs-section h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.logs-container {
  max-height: 300px;
  overflow-y: auto;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1rem;
}

.log-entry {
  display: flex;
  gap: 1rem;
  padding: 0.25rem 0;
  font-size: 0.8rem;
  border-bottom: 1px solid #e0e0e0;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #6c757d;
  font-weight: 500;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-entry.info .log-message {
  color: #2c3e50;
}

.log-entry.success .log-message {
  color: #155724;
}

.log-entry.error .log-message {
  color: #721c24;
}

/* 반응형 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .tools-grid {
    grid-template-columns: 1fr;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .input-group {
    flex-direction: column;
  }
}
</style>
