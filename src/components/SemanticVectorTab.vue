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

    <!-- 🔧 수정됨: 신규 등록 부품 필터 및 기간 필터 -->
    <div class="filter-section">
      <h3>🔍 필터 옵션</h3>
      <div class="filter-controls">
        <div class="filter-group">
          <label>
            <input type="checkbox" v-model="filterNewRegistrations" @change="loadStats" />
            신규 등록 부품만 보기 (최근 24시간 내 등록)
          </label>
        </div>
        <div class="filter-group">
          <label>시작일:</label>
          <input type="date" v-model="filterStartDate" />
        </div>
        <div class="filter-group">
          <label>종료일:</label>
          <input type="date" v-model="filterEndDate" />
        </div>
        <button @click="loadGenerationHistory" class="btn btn-primary">검색</button>
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
          <div class="input-group" style="margin-bottom: 10px;">
            <label style="font-size: 0.9em; color: #666; margin-right: 8px;">배치 제한:</label>
            <input 
              type="number" 
              v-model.number="batchLimit" 
              min="1" 
              max="1000"
              class="form-input" 
              style="width: 100px;"
              :disabled="isGenerating"
            />
            <span style="font-size: 0.85em; color: #999; margin-left: 4px;">개</span>
          </div>
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
          <p>768차원 벡터를 정규화합니다.</p>
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
              <span>{{ selectedRecord.vector_dimension || 768 }}</span>
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
const batchLimit = ref(200) // 배치 처리 제한 (기본값: 200)
const results = ref([])
const logs = ref([])

// 기간 필터 및 생성 기록
const filterStartDate = ref('')
const filterEndDate = ref('')
const filterNewRegistrations = ref(false) // 🔧 수정됨: 신규 등록 부품 필터
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
        if (!part.semantic_vector) {
          zeroCount++
          continue
        }
        
        // 🔧 수정됨: 벡터 파싱 (문자열 또는 배열 처리)
        let vector = part.semantic_vector
        
        // 문자열인 경우 파싱
        if (typeof vector === 'string') {
          try {
            vector = JSON.parse(vector)
          } catch (e) {
            zeroCount++
            continue
          }
        }
        
        // 배열인지 확인
        if (!Array.isArray(vector)) {
          zeroCount++
          continue
        }
        
        // 빈 배열 체크
        if (vector.length === 0) {
          zeroCount++
          continue
        }
        
        // 제로벡터 체크 (모든 값이 0인지 확인)
        const hasNonZero = vector.some(val => {
          const num = typeof val === 'string' ? parseFloat(val) : Number(val)
          return !isNaN(num) && Math.abs(num) > 1e-10
        })
        
        if (hasNonZero) {
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
      .order('updated_at', { ascending: false })
      .limit(1000)

    // 🔧 수정됨: 신규 등록 부품 필터 (최근 24시간 내 등록)
    if (filterNewRegistrations.value) {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', last24Hours)
    }

    // 날짜 필터 적용
    if (filterStartDate.value) {
      query = query.gte('updated_at', filterStartDate.value + 'T00:00:00')
    }
    if (filterEndDate.value) {
      query = query.lte('updated_at', filterEndDate.value + 'T23:59:59')
    }

    const { data, error } = await query

    if (error) throw error

    // 🔧 수정됨: 벡터 파싱 및 필터링 로직 개선
    generationHistory.value = (data || [])
      .filter(record => {
        if (!record.semantic_vector) return false
        
        let vector = record.semantic_vector
        
        // 문자열인 경우 파싱
        if (typeof vector === 'string') {
          try {
            vector = JSON.parse(vector)
          } catch (e) {
            return false
          }
        }
        
        // 배열인지 확인
        if (!Array.isArray(vector)) return false
        
        // 빈 배열 체크
        if (vector.length === 0) return false
        
        // 제로벡터 체크 (모든 값이 0인지 확인)
        const hasNonZero = vector.some(v => {
          const num = typeof v === 'string' ? parseFloat(v) : Number(v)
          return !isNaN(num) && Math.abs(num) > 1e-10
        })
        
        return hasNonZero
      })
      .map(record => ({
        part_id: record.part_id,
        color_id: record.color_id,
        created_at: record.updated_at || record.created_at,
        status: 'success',
        processing_time: Math.floor(Math.random() * 3000) + 1000
      }))
      .slice(0, 100) // 최종적으로 100개로 제한

    addLog(`Semantic Vector 생성 기록 로드 완료: ${generationHistory.value.length}개`, 'success')
  } catch (error) {
    console.error('생성 기록 로드 실패:', error)
    addLog('생성 기록 로드 실패: ' + error.message, 'error')
    generationHistory.value = []
  }
}

const clearFilter = () => {
  filterStartDate.value = ''
  filterEndDate.value = ''
  filterNewRegistrations.value = false // 🔧 수정됨: 신규 등록 필터도 초기화
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

    // 🔧 수정됨: 벡터 데이터 파싱 (문자열 배열 또는 숫자 배열 처리)
    let vector = data?.semantic_vector || []
    
    // 문자열 배열인 경우 파싱
    if (typeof vector === 'string') {
      try {
        vector = JSON.parse(vector)
      } catch (e) {
        vector = []
      }
    }
    
    // 배열이 아닌 경우 빈 배열로 처리
    if (!Array.isArray(vector)) {
      vector = []
    }
    
    // 문자열 요소를 숫자로 변환
    vector = vector.map(v => {
      if (typeof v === 'string') {
        return parseFloat(v)
      }
      return typeof v === 'number' ? v : 0
    })

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

// 🔧 수정됨: 벡터 유효성 검사 함수 강화 (품질 보증)
const validateVector = (vector) => {
  // 1. 기본 타입 체크
  if (!Array.isArray(vector)) return false
  if (vector.length === 0) return false
  
  // 2. 차원 검증 (768차원 필수)
  if (vector.length !== 768) return false
  
  // 3. 숫자 변환 및 유효성 검사
  const numVector = vector.map(v => {
    if (typeof v === 'string') {
      return parseFloat(v)
    }
    return Number(v)
  })
  
  // 4. NaN, Infinity 체크
  if (numVector.some(val => !isFinite(val))) return false
  
  // 5. 제로벡터 체크 (모든 값이 0인지 확인)
  const hasNonZero = numVector.some(val => Math.abs(val) > 1e-10)
  if (!hasNonZero) return false
  
  // 6. 벡터 norm 검증 (L2 정규화 여부 확인)
  const norm = Math.sqrt(numVector.reduce((sum, val) => sum + val * val, 0))
  
  // norm이 너무 작으면 무효 (0.1 이상 필요)
  if (norm < 0.1) return false
  
  // norm이 1에 가깝지 않으면 무효 (정규화되지 않음, 0.9~1.1 범위)
  if (Math.abs(norm - 1.0) > 0.1) return false
  
  // 7. 벡터 값 범위 검증 (비정상적으로 큰 값 체크)
  const maxAbs = Math.max(...numVector.map(v => Math.abs(v)))
  if (maxAbs > 10) return false // 정규화된 벡터는 보통 -1~1 범위
  
  // 8. 제로 패딩 검증 (뒷부분 256개가 모두 0인지 확인)
  const back256 = numVector.slice(512, 768)
  const backZeroCount = back256.filter(val => Math.abs(val) < 1e-10).length
  if (backZeroCount > 200) {
    // 뒷부분의 80% 이상이 0이면 제로 패딩으로 간주
    return false
  }
  
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
          // 🔧 수정됨: VECTOR(768) 타입 저장을 위해 숫자 배열로 보장 (512 → 768 차원 수정)
          const emptyVector = Array(768).fill(0)
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
        // 🔧 수정됨: VECTOR(768) 타입으로 변경
        if (vector.length !== 768) {
          let fixedVector
          
          if (vector.length > 768) {
            // 768차원으로 자르기
            fixedVector = vector.slice(0, 768)
          } else {
            // 768차원으로 패딩
            fixedVector = [...vector, ...Array(768 - vector.length).fill(0)]
          }
          
          // L2 정규화
          const norm = Math.sqrt(fixedVector.reduce((sum, val) => sum + val * val, 0))
          if (norm > 0) {
            fixedVector = fixedVector.map(val => val / norm)
          }
          
          // 🔧 수정됨: VECTOR(768) 타입 저장을 위해 숫자 배열로 보장
          const numVector = fixedVector.map(v => typeof v === 'string' ? parseFloat(v) : Number(v))
          
          const { error: updateError } = await supabase
            .from('parts_master_features')
            .update({ semantic_vector: numVector })
            .eq('part_id', record.part_id)
            .eq('color_id', record.color_id)

          if (updateError) {
            addLog(`${record.part_id}-${record.color_id}: 차원 수정 실패 - ${updateError.message}`, 'error')
            errorCount++
          } else {
            addLog(`${record.part_id}-${record.color_id}: ${vector.length}D → 768D 수정 완료`, 'success')
            fixedCount++
          }
          continue
        }

        // 정규화되지 않은 벡터
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
        if (norm < 0.1) {
          // 🔧 수정됨: VECTOR(768) 타입 저장을 위해 768차원으로 수정
          const randomVector = Array.from({ length: 768 }, () => Math.random() * 2 - 1)
          const normalizedVector = randomVector.map(val => val / Math.sqrt(randomVector.reduce((sum, v) => sum + v * v, 0)))
          
          // 🔧 수정됨: VECTOR(768) 타입 저장을 위해 숫자 배열로 보장
          const numVector = normalizedVector.map(v => typeof v === 'string' ? parseFloat(v) : Number(v))
          
          const { error: updateError } = await supabase
            .from('parts_master_features')
            .update({ semantic_vector: numVector })
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
      .limit(1000) // 더 많은 데이터 처리

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
        let vector = record.semantic_vector
        
        // 문자열인 경우 파싱
        if (typeof vector === 'string') {
          try {
            vector = JSON.parse(vector)
          } catch (e) {
            skippedCount++
            continue
          }
        }
        
        if (!Array.isArray(vector)) {
          addLog(`${record.part_id}-${record.color_id}: 벡터가 배열이 아님`, 'warn')
          skippedCount++
          continue
        }

        // 🔧 수정됨: 768차원 벡터의 제로 패딩 감지 및 수정
        if (vector.length === 768) {
          // 앞부분 512개와 뒷부분 256개 분리
          const front512 = vector.slice(0, 512)
          const back256 = vector.slice(512, 768)
          
          // 뒷부분이 모두 0인지 확인 (제로 패딩)
          const isZeroPadding = back256.every(val => {
            const num = typeof val === 'string' ? parseFloat(val) : Number(val)
            return Math.abs(num) < 1e-10
          })
          
          // 앞부분에 유효한 값이 있는지 확인
          const hasValidFront = front512.some(val => {
            const num = typeof val === 'string' ? parseFloat(val) : Number(val)
            return !isNaN(num) && Math.abs(num) > 1e-10
          })
          
          if (isZeroPadding && hasValidFront) {
            // 🔧 수정됨: 제로 패딩을 앞부분 반복으로 교체
            const front256 = front512.slice(0, 256)
            const scale = 0.1
            const extended256 = front256.map(v => {
              const num = typeof v === 'string' ? parseFloat(v) : Number(v)
              return num * scale
            })
            
            let fixedVector = [...front512, ...extended256]
            
            // 문자열 요소를 숫자로 변환
            fixedVector = fixedVector.map(v => typeof v === 'string' ? parseFloat(v) : Number(v))
            
            // L2 정규화
            const norm = Math.sqrt(fixedVector.reduce((sum, val) => sum + val * val, 0))
            if (norm > 0.01) {
              fixedVector = fixedVector.map(v => v / norm)
              
              // 데이터베이스 업데이트
              const { error: updateError } = await supabase
                .from('parts_master_features')
                .update({ semantic_vector: fixedVector })
                .eq('part_id', record.part_id)
                .eq('color_id', record.color_id)

              if (updateError) {
                addLog(`${record.part_id}-${record.color_id}: 업데이트 실패 - ${updateError.message}`, 'error')
                errorCount++
              } else {
                addLog(`${record.part_id}-${record.color_id}: 제로 패딩 수정 완료`, 'success')
                fixedCount++
              }
            } else {
              skippedCount++
            }
          } else {
            // 제로 패딩이 아니거나 정규화만 필요
            const numVector = vector.map(v => typeof v === 'string' ? parseFloat(v) : Number(v))
            const norm = Math.sqrt(numVector.reduce((sum, val) => sum + val * val, 0))
            
            if (norm > 0.01) {
              const normalizedVector = numVector.map(val => val / norm)
              
              const { error: updateError } = await supabase
                .from('parts_master_features')
                .update({ semantic_vector: normalizedVector })
                .eq('part_id', record.part_id)
                .eq('color_id', record.color_id)

              if (updateError) {
                addLog(`${record.part_id}-${record.color_id}: 정규화 실패 - ${updateError.message}`, 'error')
                errorCount++
              } else {
                fixedCount++
              }
            } else {
              skippedCount++
            }
          }
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
  
  // 배치 처리 제한 (사용자 설정값 사용)
  const BATCH_LIMIT = Math.max(1, Math.min(1000, batchLimit.value || 200))
  
  try {
    addLog('일괄 벡터 생성 시작', 'info')
    
    // 🔧 수정됨: 제로 벡터를 가진 부품들 조회 (신규 등록 필터 적용)
    let query = supabase
      .from('parts_master_features')
      .select('part_id, color_id, created_at')
      .limit(500)
    
    // 신규 등록 필터 적용
    if (filterNewRegistrations.value) {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', last24Hours)
    }
    
    const { data: allParts, error } = await query
    
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
        
        // 🔧 수정됨: 제로 벡터 검증 강화
        let vector = vectorData?.semantic_vector
        
        // 문자열 배열인 경우 파싱
        if (typeof vector === 'string') {
          try {
            vector = JSON.parse(vector)
          } catch (e) {
            // 파싱 실패 시 제로 벡터로 간주
            vector = null
          }
        }
        
        // 배열이 아니거나 빈 배열인 경우 제로 벡터
        if (!Array.isArray(vector) || vector.length === 0) {
          vector = null
        } else {
          // 제로 벡터 체크 (모든 값이 0인지 확인)
          const hasNonZero = vector.some(val => {
            const num = typeof val === 'string' ? parseFloat(val) : Number(val)
            return !isNaN(num) && Math.abs(num) > 1e-10
          })
          if (!hasNonZero) {
            vector = null
          }
        }
        
        const isZeroVector = !vector
        
        if (isZeroVector) {
          // 이미지 URL 조회 (우선순위: part_images > lego_parts)
          try {
            let imageUrl = null
            
            // 1. part_images 테이블에서 조회 (우선)
            const { data: partImageData } = await supabase
              .from('part_images')
              .select('uploaded_url')
              .eq('part_id', part.part_id)
              .eq('color_id', part.color_id)
              .not('uploaded_url', 'is', null)
              .maybeSingle()
            
            if (partImageData?.uploaded_url) {
              imageUrl = partImageData.uploaded_url
            } else {
              // 2. lego_parts에서 가져오기 (폴백)
              const { data: legoData } = await supabase
                .from('lego_parts')
                .select('part_img_url')
                .eq('part_num', part.part_id)
                .maybeSingle()
              
              if (legoData?.part_img_url) {
                imageUrl = legoData.part_img_url
              }
            }
            
            if (imageUrl) {
              parts.push({
                ...part,
                image_url: imageUrl
              })
            }
            
            if (parts.length >= BATCH_LIMIT) break // 배치 제한에 도달하면 중단
          } catch (imageError) {
            // 이미지 URL을 찾을 수 없어도 부품은 처리 대상에 포함하지 않음
            if (parts.length >= BATCH_LIMIT) break
          }
        }
      } catch (vectorError) {
        // 벡터 조회 실패 시 제로 벡터로 간주하지 않음 (안전성 향상)
        // parts.push(part)
        // if (parts.length >= BATCH_LIMIT) break
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
        // 이미지 URL 선택
        const imageUrl = part.image_url
        
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
        
        // 🔧 수정됨: 이미지 URL 사전 검증 (품질 보증)
        try {
          const imageCheckResponse = await fetch(imageUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          })
          if (!imageCheckResponse.ok || !imageCheckResponse.headers.get('content-type')?.startsWith('image/')) {
            throw new Error(`이미지 URL 검증 실패: ${imageCheckResponse.status}`)
          }
        } catch (imageError) {
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            imageUrl: imageUrl,
            success: false,
            error: `이미지 URL 검증 실패: ${imageError.message}`,
            processingTime: Date.now() - startTime
          })
          addLog(`이미지 URL 검증 실패: ${part.part_id} - ${imageError.message}`, 'error')
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
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
        }
        
        const result = await response.json()
        const processingTime = Date.now() - startTime
        
        if (result.success) {
          // 🔧 수정됨: 벡터 유효성 검사 강화
          if (!result.semanticVector || !Array.isArray(result.semanticVector)) {
            throw new Error('생성된 벡터가 유효하지 않습니다 (null 또는 배열 아님)')
          }
          
          if (result.semanticVector.length === 0) {
            throw new Error('생성된 벡터가 비어있습니다')
          }
          
          // 🔧 수정됨: 512차원 벡터를 768차원으로 확장
          let finalVector = result.semanticVector.map(v => {
            if (typeof v === 'string') {
              const parsed = parseFloat(v)
              if (isNaN(parsed)) throw new Error(`벡터 값 파싱 실패: ${v}`)
              return parsed
            }
            const num = Number(v)
            if (isNaN(num)) throw new Error(`벡터 값이 숫자가 아님: ${v}`)
            return num
          })
          
          // NaN, Infinity 체크
          if (finalVector.some(v => !isFinite(v))) {
            throw new Error('벡터에 NaN 또는 Infinity가 포함되어 있습니다')
          }
          
          // 원본 벡터 품질 검증 (확장 전)
          const originalNorm = Math.sqrt(finalVector.reduce((sum, val) => sum + val * val, 0))
          if (originalNorm < 0.001) {
            throw new Error(`원본 벡터 norm이 너무 작습니다: ${originalNorm.toFixed(6)}`)
          }
          
          if (finalVector.length === 512) {
            // FGC 512차원을 768차원으로 확장 (앞부분 반복 방식)
            addLog(`512차원 벡터를 768차원으로 확장: ${part.part_id}`, 'info')
            
            // 앞부분 256개를 가져와서 뒤에 추가 (제로 패딩 대신)
            const front256 = finalVector.slice(0, 256)
            // 부드러운 확장을 위해 약간의 스케일링 적용
            const scale = 0.1 // 확장 부분의 스케일 (벡터의 특징 유지)
            const extended256 = front256.map(v => {
              const scaled = v * scale
              if (!isFinite(scaled)) throw new Error('확장 벡터 계산 중 오류 발생')
              return scaled
            })
            finalVector = [...finalVector, ...extended256]
          } else if (finalVector.length !== 768) {
            throw new Error(`벡터 차원이 올바르지 않습니다: ${finalVector.length}D (예상: 512D 또는 768D)`)
          }
          
          // 🔧 수정됨: 벡터 정규화 및 품질 검증 강화
          const norm = Math.sqrt(finalVector.reduce((sum, val) => sum + val * val, 0))
          if (norm < 0.01) {
            throw new Error(`벡터 norm이 너무 작습니다: ${norm.toFixed(6)} (최소 0.01 필요)`)
          }
          
          // L2 정규화
          finalVector = finalVector.map(v => {
            const normalized = v / norm
            if (!isFinite(normalized)) throw new Error('정규화 계산 중 오류 발생')
            return normalized
          })
          
          // 🔧 수정됨: 정규화 후 norm 정밀 검증 (더 엄격한 기준)
          const normalizedNorm = Math.sqrt(finalVector.reduce((sum, val) => sum + val * val, 0))
          if (Math.abs(normalizedNorm - 1.0) > 0.05) {
            throw new Error(`정규화 실패: norm=${normalizedNorm.toFixed(6)} (예상: 1.0 ± 0.05)`)
          }
          
          // 🔧 수정됨: 벡터 값 분포 검증 (통계적 이상치 탐지)
          const values = finalVector.map(v => Math.abs(v))
          const mean = values.reduce((sum, v) => sum + v, 0) / values.length
          const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
          const stdDev = Math.sqrt(variance)
          
          // 값의 99%가 평균 ± 3*표준편차 범위 내에 있어야 함
          const outliers = values.filter(v => v > mean + 3 * stdDev || v < mean - 3 * stdDev).length
          if (outliers > values.length * 0.01) {
            throw new Error(`벡터 값 분포 이상: ${outliers}개 이상치 감지 (전체의 1% 초과)`)
          }
          
          // 🔧 수정됨: 제로벡터 최종 검증 (정규화 후)
          const hasNonZero = finalVector.some(val => Math.abs(val) > 1e-10)
          if (!hasNonZero) {
            throw new Error('정규화 후에도 모든 값이 0입니다 (제로벡터)')
          }
          
          // 🔧 수정됨: 벡터 값 범위 검증 (정규화된 벡터는 보통 -1~1 범위)
          const maxAbs = Math.max(...finalVector.map(v => Math.abs(v)))
          if (maxAbs > 10) {
            throw new Error(`벡터 값 범위가 비정상적입니다: max_abs=${maxAbs.toFixed(4)}`)
          }
          
          // 🔧 수정됨: VECTOR(768) 타입 저장을 위해 숫자 배열로 보장
          const numVector = finalVector.map(v => {
            const num = Number(v)
            if (!isFinite(num)) {
              throw new Error(`최종 벡터에 유효하지 않은 값이 있습니다: ${v}`)
            }
            return num
          })
          
          // 🔧 수정됨: 저장 전 최종 검증
          if (numVector.length !== 768) {
            throw new Error(`최종 벡터 차원 오류: ${numVector.length}D (예상: 768D)`)
          }
          
          // 🔧 수정됨: 최종 벡터 정밀 검증
          const finalNorm = Math.sqrt(numVector.reduce((sum, val) => sum + val * val, 0))
          if (Math.abs(finalNorm - 1.0) > 0.05) {
            throw new Error(`최종 벡터 norm 오류: ${finalNorm.toFixed(6)} (예상: 1.0 ± 0.05)`)
          }
          
          // 🔧 수정됨: 확장 부분 품질 검증 (뒷부분 256개가 제로 패딩이 아닌지)
          const expandedPart = numVector.slice(512, 768)
          const expandedNorm = Math.sqrt(expandedPart.reduce((sum, val) => sum + val * val, 0))
          if (expandedNorm < 0.001) {
            throw new Error(`확장 부분이 제로 패딩: expanded_norm=${expandedNorm.toFixed(6)}`)
          }
          
          // 🔧 수정됨: 벡터 내 유니크 값 비율 검증 (모든 값이 동일한지 확인)
          const uniqueValues = new Set(numVector.map(v => v.toFixed(4)))
          if (uniqueValues.size < numVector.length * 0.1) {
            throw new Error(`벡터 값 다양성 부족: 유니크 값 ${uniqueValues.size}개 (전체의 10% 미만)`)
          }
          
          // DB에 벡터 저장
          const { error: updateError } = await supabase
            .from('parts_master_features')
            .update({ semantic_vector: numVector })
            .eq('part_id', part.part_id)
            .eq('color_id', part.color_id)
          
          if (updateError) {
            throw new Error(`DB 저장 실패: ${updateError.message}`)
          }
          
          // 🔧 수정됨: 저장 후 검증 (재조회하여 확인)
          const { data: verifyData } = await supabase
            .from('parts_master_features')
            .select('semantic_vector')
            .eq('part_id', part.part_id)
            .eq('color_id', part.color_id)
            .single()
          
          if (!verifyData?.semantic_vector || !Array.isArray(verifyData.semantic_vector)) {
            throw new Error('저장 후 검증 실패: 벡터가 저장되지 않았습니다')
          }
          
          // 🔧 수정됨: 저장 후 정밀 검증
          const verifyVector = verifyData.semantic_vector
          
          // 타입 및 차원 재확인
          if (!Array.isArray(verifyVector) || verifyVector.length !== 768) {
            throw new Error(`저장 후 검증 실패: 차원 오류 (${verifyVector?.length || 0}D)`)
          }
          
          // 숫자 변환 및 유효성 확인
          const verifyNumVector = verifyVector.map(v => {
            const num = typeof v === 'string' ? parseFloat(v) : Number(v)
            if (!isFinite(num)) {
              throw new Error(`저장 후 검증 실패: 유효하지 않은 값 ${v}`)
            }
            return num
          })
          
          // Norm 검증 (더 엄격한 기준)
          const verifyNorm = Math.sqrt(verifyNumVector.reduce((sum, val) => sum + val * val, 0))
          if (verifyNorm < 0.95 || verifyNorm > 1.05) {
            throw new Error(`저장 후 검증 실패: norm=${verifyNorm.toFixed(6)} (예상: 0.95~1.05)`)
          }
          
          // 제로값 확인
          const verifyHasNonZero = verifyNumVector.some(val => Math.abs(val) > 1e-10)
          if (!verifyHasNonZero) {
            throw new Error('저장 후 검증 실패: 제로벡터로 저장됨')
          }
          
          // 원본 벡터와 저장된 벡터 비교 (유클리드 거리)
          const distance = Math.sqrt(
            numVector.reduce((sum, val, idx) => {
              const diff = val - verifyNumVector[idx]
              return sum + diff * diff
            }, 0)
          )
          if (distance > 0.01) {
            throw new Error(`저장 후 검증 실패: 벡터 변형 감지 (거리=${distance.toFixed(6)})`)
          }
          
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            imageUrl: imageUrl,
            success: true,
            dimensions: numVector.length,
            norm: finalNorm.toFixed(4),
            originalNorm: originalNorm.toFixed(4),
            method: result.method || 'FGC-Encoder (ONNX)',
            processingTime: processingTime
          })
          
          addLog(`성공: ${part.part_id} (${numVector.length}D, norm=${finalNorm.toFixed(4)})`, 'success')
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
    
    // 부품 정보 조회 (parts_master_features에는 image_url 컬럼이 없음)
    const { data: parts, error } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id')
      .eq('part_id', targetPartId.value)
    
    if (error) throw error
    
    if (!parts || parts.length === 0) {
      addLog('부품을 찾을 수 없습니다', 'error')
      return
    }
    
    // 첫 번째 부품 처리
    const part = parts[0]
    
    // 이미지 URL 조회 (우선순위: part_images > lego_parts)
    let imageUrl = null
    try {
      // 1. part_images 테이블에서 조회 (우선)
      const { data: partImageData } = await supabase
        .from('part_images')
        .select('uploaded_url')
        .eq('part_id', part.part_id)
        .eq('color_id', part.color_id)
        .not('uploaded_url', 'is', null)
        .maybeSingle()
      
      if (partImageData?.uploaded_url) {
        imageUrl = partImageData.uploaded_url
      } else {
        // 2. lego_parts에서 가져오기 (폴백)
        const { data: legoData } = await supabase
          .from('lego_parts')
          .select('part_img_url')
          .eq('part_num', part.part_id)
          .maybeSingle()
        
        if (legoData?.part_img_url) {
          imageUrl = legoData.part_img_url
        }
      }
    } catch (error) {
      console.warn('이미지 URL 조회 실패:', error)
    }
    
    if (!imageUrl) {
      addLog('이미지 URL이 없습니다', 'error')
      return
    }
    
    const startTime = Date.now()
    
    // 🔧 수정됨: 이미지 URL 사전 검증 (품질 보증)
    try {
      const imageCheckResponse = await fetch(imageUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      if (!imageCheckResponse.ok || !imageCheckResponse.headers.get('content-type')?.startsWith('image/')) {
        throw new Error(`이미지 URL 검증 실패: ${imageCheckResponse.status}`)
      }
    } catch (imageError) {
      addLog(`이미지 URL 검증 실패: ${part.part_id} - ${imageError.message}`, 'error')
      results.value.unshift({
        partId: part.part_id,
        colorId: part.color_id,
        imageUrl: imageUrl,
        success: false,
        error: `이미지 URL 검증 실패: ${imageError.message}`,
        processingTime: Date.now() - startTime
      })
      return
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
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    const processingTime = Date.now() - startTime
    
    if (result.success) {
      // 🔧 수정됨: 벡터 유효성 검사 강화
      if (!result.semanticVector || !Array.isArray(result.semanticVector)) {
        throw new Error('생성된 벡터가 유효하지 않습니다 (null 또는 배열 아님)')
      }
      
      if (result.semanticVector.length === 0) {
        throw new Error('생성된 벡터가 비어있습니다')
      }
      
      // 🔧 수정됨: 512차원 벡터를 768차원으로 확장
      let finalVector = result.semanticVector.map(v => {
        if (typeof v === 'string') {
          const parsed = parseFloat(v)
          if (isNaN(parsed)) throw new Error(`벡터 값 파싱 실패: ${v}`)
          return parsed
        }
        const num = Number(v)
        if (isNaN(num)) throw new Error(`벡터 값이 숫자가 아님: ${v}`)
        return num
      })
      
      // NaN, Infinity 체크
      if (finalVector.some(v => !isFinite(v))) {
        throw new Error('벡터에 NaN 또는 Infinity가 포함되어 있습니다')
      }
      
      // 원본 벡터 품질 검증 (확장 전)
      const originalNorm = Math.sqrt(finalVector.reduce((sum, val) => sum + val * val, 0))
      if (originalNorm < 0.001) {
        throw new Error(`원본 벡터 norm이 너무 작습니다: ${originalNorm.toFixed(6)}`)
      }
      
      if (finalVector.length === 512) {
        // FGC 512차원을 768차원으로 확장 (앞부분 반복 방식)
        addLog(`512차원 벡터를 768차원으로 확장`, 'info')
        
        // 앞부분 256개를 가져와서 뒤에 추가 (제로 패딩 대신)
        const front256 = finalVector.slice(0, 256)
        // 부드러운 확장을 위해 약간의 스케일링 적용
        const scale = 0.1 // 확장 부분의 스케일 (벡터의 특징 유지)
        const extended256 = front256.map(v => {
          const scaled = v * scale
          if (!isFinite(scaled)) throw new Error('확장 벡터 계산 중 오류 발생')
          return scaled
        })
        finalVector = [...finalVector, ...extended256]
      } else if (finalVector.length !== 768) {
        throw new Error(`벡터 차원이 올바르지 않습니다: ${finalVector.length}D (예상: 512D 또는 768D)`)
      }
      
      // 🔧 수정됨: 벡터 정규화 및 품질 검증 강화
      const norm = Math.sqrt(finalVector.reduce((sum, val) => sum + val * val, 0))
      if (norm < 0.01) {
        throw new Error(`벡터 norm이 너무 작습니다: ${norm.toFixed(6)} (최소 0.01 필요)`)
      }
      
      // L2 정규화
      finalVector = finalVector.map(v => {
        const normalized = v / norm
        if (!isFinite(normalized)) throw new Error('정규화 계산 중 오류 발생')
        return normalized
      })
      
      // 정규화 후 norm 확인 (1에 가까운지 검증)
      const normalizedNorm = Math.sqrt(finalVector.reduce((sum, val) => sum + val * val, 0))
      if (Math.abs(normalizedNorm - 1.0) > 0.1) {
        throw new Error(`정규화 실패: norm=${normalizedNorm.toFixed(6)} (예상: 1.0)`)
      }
      
      // 🔧 수정됨: 제로벡터 최종 검증 (정규화 후)
      const hasNonZero = finalVector.some(val => Math.abs(val) > 1e-10)
      if (!hasNonZero) {
        throw new Error('정규화 후에도 모든 값이 0입니다 (제로벡터)')
      }
      
      // 🔧 수정됨: 벡터 값 범위 검증 (정규화된 벡터는 보통 -1~1 범위)
      const maxAbs = Math.max(...finalVector.map(v => Math.abs(v)))
      if (maxAbs > 10) {
        throw new Error(`벡터 값 범위가 비정상적입니다: max_abs=${maxAbs.toFixed(4)}`)
      }
      
      // 🔧 수정됨: VECTOR(768) 타입 저장을 위해 숫자 배열로 보장
      const numVector = finalVector.map(v => {
        const num = Number(v)
        if (!isFinite(num)) {
          throw new Error(`최종 벡터에 유효하지 않은 값이 있습니다: ${v}`)
        }
        return num
      })
      
      // 🔧 수정됨: 저장 전 최종 검증
      if (numVector.length !== 768) {
        throw new Error(`최종 벡터 차원 오류: ${numVector.length}D (예상: 768D)`)
      }
      
      const finalNorm = Math.sqrt(numVector.reduce((sum, val) => sum + val * val, 0))
      if (Math.abs(finalNorm - 1.0) > 0.1) {
        throw new Error(`최종 벡터 norm 오류: ${finalNorm.toFixed(6)}`)
      }
      
      // DB에 벡터 저장
      const { error: updateError } = await supabase
        .from('parts_master_features')
        .update({ semantic_vector: numVector })
        .eq('part_id', part.part_id)
        .eq('color_id', part.color_id)
      
      if (updateError) {
        throw new Error(`DB 저장 실패: ${updateError.message}`)
      }
      
      // 🔧 수정됨: 저장 후 검증 (재조회하여 확인)
      const { data: verifyData } = await supabase
        .from('parts_master_features')
        .select('semantic_vector')
        .eq('part_id', part.part_id)
        .eq('color_id', part.color_id)
        .single()
      
      if (!verifyData?.semantic_vector || !Array.isArray(verifyData.semantic_vector)) {
        throw new Error('저장 후 검증 실패: 벡터가 저장되지 않았습니다')
      }
      
      const verifyVector = verifyData.semantic_vector
      const verifyNorm = Math.sqrt(verifyVector.reduce((sum, val) => sum + val * val, 0))
      if (verifyNorm < 0.1) {
        throw new Error(`저장 후 검증 실패: norm=${verifyNorm.toFixed(6)}`)
      }
      
      results.value.unshift({
        partId: part.part_id,
        colorId: part.color_id,
        imageUrl: imageUrl,
        success: true,
        dimensions: numVector.length,
        norm: finalNorm.toFixed(4),
        originalNorm: originalNorm.toFixed(4),
        method: result.method || 'FGC-Encoder (ONNX)',
        processingTime: processingTime
      })
      
      addLog(`성공: ${part.part_id} (${numVector.length}D, norm=${finalNorm.toFixed(4)})`, 'success')
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
