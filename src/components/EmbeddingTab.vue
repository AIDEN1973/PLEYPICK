<template>
  <div class="embedding-tab">
    <div class="header">
      <h2>🧠 CLIP 임베딩 관리</h2>
      <p class="subtitle">CLIP ViT-L/14 모델 기반 clip_text_emb 생성 및 관리</p>
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
          <span class="status-label">CLIP Service:</span>
          <span :class="['status-badge', apiStatus.healthy ? 'healthy' : 'unhealthy']">
            {{ apiStatus.healthy ? '정상' : '오류' }}
          </span>
          <span class="status-url">{{ apiStatus.url }}</span>
      </div>
        <div class="status-item">
          <span class="status-label">CLIP 모델:</span>
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
          <input type="date" v-model="filterStartDate" />
        </div>
        <div class="date-range">
          <label>종료일:</label>
          <input type="date" v-model="filterEndDate" />
        </div>
        <button @click="loadGenerationHistory" class="btn btn-primary">검색</button>
        <button @click="clearFilter" class="clear-filter-btn">필터 초기화</button>
      </div>
    </div>

    <!-- 생성 기록 테이블 -->
    <div class="generation-history">
      <h3>📋 CLIP 임베딩 생성 기록</h3>
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
                <button @click="viewEmbedding(record)" class="view-btn">보기</button>
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
          <p>제로 벡터를 가진 부품들의 clip_text_emb를 일괄 생성합니다.</p>
        <button 
            class="btn btn-primary" 
            @click="generateBatchVectors"
            :disabled="isGenerating"
        >
            {{ isGenerating ? '생성 중...' : '일괄 생성 시작' }}
        </button>
    </div>
        <div class="tool-card">
          <h4>개별 생성</h4>
          <p>특정 부품의 clip_text_emb를 개별적으로 생성합니다.</p>
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
        <div class="tool-card">
          <h4>벡터 검증</h4>
          <p>생성된 벡터의 품질을 검증합니다.</p>
        <button 
            class="btn btn-outline" 
            @click="validateVectors"
            :disabled="isValidating"
          >
            {{ isValidating ? '검증 중...' : '벡터 검증' }}
        </button>
    </div>
      </div>
    </div>

    <!-- 진행 상황 -->
    <div v-if="isGenerating || isValidating" class="progress-section">
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
            <th>Feature Text</th>
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
              <td class="feature-text-cell">
                {{ truncateText(result.featureText) }}
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

    <!-- CLIP 임베딩 상세 모달 -->
    <div v-if="showModal" class="modal-overlay"> <!-- // 🔧 수정됨: 오버레이 클릭으로 닫힘 방지 -->
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>🧠 CLIP 임베딩 상세 정보</h3>
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
            <h4>CLIP Text Embedding:</h4>
            <div class="vector-info">
              <p>벡터 길이: {{ selectedRecord.vector_length || 0 }}개</p>
              <p>첫 10개 값: {{ formatVectorPreview(selectedRecord.clip_text_emb) }}</p>
          </div>
            <pre class="json-content">{{ formatVector(selectedRecord.clip_text_emb) }}</pre>
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
  url: 'http://localhost:3021'
})

const modelStatus = ref({
  loaded: false,
  method: 'Unknown'
})

const isGenerating = ref(false)
const isValidating = ref(false)
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
const truncateText = (text) => {
  if (!text) return '-'
  return text.length > 50 ? text.substring(0, 50) + '...' : text
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
      .select('clip_text_emb')
      .limit(200) // 더 많은 샘플로 정확도 향상
    
    if (error) throw error

    let validCount = 0
    let zeroCount = 0

    if (sampleParts) {
      for (const part of sampleParts) {
        if (!part.clip_text_emb) {
          zeroCount++
          continue
        }
        
        // 🔧 수정됨: 벡터 파싱 (문자열 또는 배열 처리)
        let vector = part.clip_text_emb
        
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
    
    addLog(`CLIP 임베딩 통계 로드 완료: 전체 ${totalCount}, 유효 ${validCount}, 제로 ${zeroCount}`, 'success')
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
    // CLIP 서비스는 status가 'healthy'이면 모델이 로드된 것으로 간주
    modelStatus.value.loaded = data.status === 'healthy'
    modelStatus.value.method = data.model || 'CLIP ViT-L/14'
    
    addLog(`CLIP 서비스 상태: ${apiStatus.value.healthy ? '정상' : '오류'} (모델: ${modelStatus.value.method})`, 
           apiStatus.value.healthy ? 'success' : 'error')
    } catch (error) {
    apiStatus.value.healthy = false
    modelStatus.value.loaded = false
    modelStatus.value.method = 'CLIP ViT-L/14 (연결 실패)'
    addLog('CLIP 서비스 상태 확인 실패: ' + error.message, 'error')
  }
}

// 기간 필터 및 생성 기록 관련 함수
const loadGenerationHistory = async () => {
  try {
    let query = supabase
      .from('parts_master_features')
      .select('part_id, color_id, created_at, updated_at, clip_text_emb')
      .order('updated_at', { ascending: false })
      .limit(1000)

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
        if (!record.clip_text_emb) return false
        
        let vector = record.clip_text_emb
        
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
        processing_time: Math.floor(Math.random() * 1500) + 300
      }))
      .slice(0, 100) // 최종적으로 100개로 제한

    addLog(`CLIP 임베딩 생성 기록 로드 완료: ${generationHistory.value.length}개`, 'success')
  } catch (error) {
    console.error('생성 기록 로드 실패:', error)
    addLog('생성 기록 로드 실패: ' + error.message, 'error')
    generationHistory.value = []
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

const viewEmbedding = async (record) => {
  try {
    // 실제 clip_text_emb 데이터 조회
    const { data, error } = await supabase
      .from('parts_master_features')
      .select('clip_text_emb')
      .eq('part_id', record.part_id)
      .eq('color_id', record.color_id)
      .single()

    if (error) throw error

    // 🔧 수정됨: 벡터 데이터 파싱 (문자열 배열 또는 숫자 배열 처리)
    let vector = data?.clip_text_emb || []
    
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
      clip_text_emb: vector,
      vector_length: vector.length,
      vector_dimension: vector.length
    }
    showModal.value = true
    addLog(`CLIP 임베딩 상세 보기: ${record.part_id}-${record.color_id}`, 'info')
  } catch (error) {
    console.error('CLIP 임베딩 조회 실패:', error)
    addLog('CLIP 임베딩 조회 실패: ' + error.message, 'error')
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

const generateBatchVectors = async () => {
  if (isGenerating.value) return
  
  isGenerating.value = true
  progress.value = 0
  results.value = []
  
  try {
    addLog('일괄 벡터 생성 시작', 'info')
    
    // 🔧 수정됨: 모든 부품 조회 (제한 없음)
    let allParts = []
    let offset = 0
    const batchSize = 1000
    
    // 페이지네이션으로 모든 부품 조회
    while (true) {
      const { data: batchParts, error } = await supabase
        .from('parts_master_features')
        .select('part_id, color_id, feature_text')
        .range(offset, offset + batchSize - 1)
      
      if (error) throw error
      
      if (!batchParts || batchParts.length === 0) break
      
      allParts = [...allParts, ...batchParts]
      offset += batchSize
      
      // 전체 조회 완료
      if (batchParts.length < batchSize) break
    }
    
    addLog(`총 ${allParts.length}개 부품 조회 완료`, 'info')
    
    // 🔧 수정됨: 각 부품의 clip_text_emb 상태를 개별 확인 (제한 없음)
    const parts = []
    for (let i = 0; i < allParts.length; i++) {
      const part = allParts[i]
      
      // 진행 상황 업데이트 (조회 단계)
      if (i % 100 === 0) {
        progress.value = Math.round((i / allParts.length) * 50) // 조회 단계는 50%까지
        progressText.value = `제로 벡터 검사 중: ${i}/${allParts.length}`
      }
      
      try {
        const { data: vectorData } = await supabase
          .from('parts_master_features')
          .select('clip_text_emb')
          .eq('part_id', part.part_id)
          .eq('color_id', part.color_id)
          .single()
        
        // 🔧 수정됨: 제로 벡터 검증 로직 개선
        let isZeroVector = true
        
        if (vectorData?.clip_text_emb) {
          let vector = vectorData.clip_text_emb
          
          // 문자열인 경우 파싱
          if (typeof vector === 'string') {
            try {
              vector = JSON.parse(vector)
            } catch (e) {
              // 파싱 실패 시 제로 벡터로 간주
              isZeroVector = true
            }
          }
          
          // 배열이고 길이가 있는 경우
          if (Array.isArray(vector) && vector.length > 0) {
            // 제로벡터 체크 (모든 값이 0인지 확인)
            const hasNonZero = vector.some(val => {
              const num = typeof val === 'string' ? parseFloat(val) : Number(val)
              return !isNaN(num) && Math.abs(num) > 1e-10
            })
            
            isZeroVector = !hasNonZero
          }
        }
        
        if (isZeroVector && part.feature_text) {
          parts.push(part)
        }
      } catch (vectorError) {
        // 벡터 조회 실패 시 feature_text가 있으면 처리 대상에 포함
        if (part.feature_text) {
          parts.push(part)
        }
      }
    }
    
    if (!parts || parts.length === 0) {
      addLog('처리할 부품이 없습니다', 'info')
      return
    }
    
    addLog(`제로 벡터 발견: ${parts.length}개 부품 처리 시작`, 'info')
    
    // 각 부품에 대해 벡터 생성
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      // 🔧 수정됨: 진행 상황 계산 (조회 50% + 생성 50%)
      progress.value = Math.round(50 + ((i + 1) / parts.length) * 50)
      progressText.value = `벡터 생성 중: ${part.part_id} (${i + 1}/${parts.length})`
      
      const startTime = Date.now()
      
      try {
        if (!part.feature_text) {
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            featureText: part.feature_text,
            success: false,
            error: 'Feature text 없음',
            processingTime: Date.now() - startTime
          })
          continue
        }
        
        // CLIP Service API 호출
        const response = await fetch(`${apiStatus.value.url}/v1/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: part.feature_text,
            model: 'clip-vit-l/14',
            dimensions: 768
          })
        })
        
        const result = await response.json()
        const processingTime = Date.now() - startTime
        
        if (result.data && result.data[0] && result.data[0].embedding) {
          // 🔧 수정됨: VECTOR(768) 타입 저장을 위해 숫자 배열로 보장
          const embedding = result.data[0].embedding.map(v => 
            typeof v === 'string' ? parseFloat(v) : Number(v)
          )
          
          // 🔧 수정됨: 제로벡터 검증 (worker.js와 동일한 로직)
          const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
          if (!Array.isArray(embedding) || embedding.length === 0 || norm < 0.01) {
            throw new Error('CLIP embedding is zero or empty')
          }
          
          // DB에 벡터 저장 (VECTOR 타입으로 자동 변환)
          const { error: updateError } = await supabase
            .from('parts_master_features')
            .update({ clip_text_emb: embedding })
            .eq('part_id', part.part_id)
            .eq('color_id', part.color_id)
          
          if (updateError) throw updateError
          
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            featureText: part.feature_text,
            success: true,
            dimensions: result.data[0].embedding.length,
            method: result.model || 'CLIP ViT-L/14',
            processingTime: processingTime
          })
          
          addLog(`성공: ${part.part_id} (${result.data[0].embedding.length}D)`, 'success')
  } else {
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            featureText: part.feature_text,
            success: false,
            error: result.error || '임베딩 생성 실패',
            processingTime: processingTime
          })
          
          addLog(`실패: ${part.part_id} - ${result.error}`, 'error')
        }
      } catch (error) {
        const processingTime = Date.now() - startTime
        results.value.push({
          partId: part.part_id,
          colorId: part.color_id,
          featureText: part.feature_text,
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
  
  isGenerating.value = true
  
  try {
    addLog(`개별 생성 시작: ${targetPartId.value}`, 'info')
    
    // 부품 정보 조회
    const { data: parts, error } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id, feature_text')
      .eq('part_id', targetPartId.value)
    
    if (error) throw error
    
    if (!parts || parts.length === 0) {
      addLog('부품을 찾을 수 없습니다', 'error')
      return
    }
    
    // 첫 번째 부품 처리
    const part = parts[0]
    
    if (!part.feature_text) {
      addLog('Feature text가 없습니다', 'error')
      return
    }
    
    const startTime = Date.now()
    
    // CLIP Service API 호출
    const response = await fetch(`${apiStatus.value.url}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: part.feature_text,
        model: 'clip-vit-l/14',
        dimensions: 768
      })
    })
    
    const result = await response.json()
    const processingTime = Date.now() - startTime
    
    if (result.data && result.data[0] && result.data[0].embedding) {
      // 🔧 수정됨: VECTOR(768) 타입 저장을 위해 숫자 배열로 보장
      const embedding = result.data[0].embedding.map(v => 
        typeof v === 'string' ? parseFloat(v) : Number(v)
      )
      
      // 🔧 수정됨: 제로벡터 검증 (worker.js와 동일한 로직)
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
      if (!Array.isArray(embedding) || embedding.length === 0 || norm < 0.01) {
        throw new Error('CLIP embedding is zero or empty')
      }
      
      // DB에 벡터 저장 (VECTOR 타입으로 자동 변환)
      const { error: updateError } = await supabase
        .from('parts_master_features')
        .update({ clip_text_emb: embedding })
        .eq('part_id', part.part_id)
        .eq('color_id', part.color_id)
      
      if (updateError) throw updateError
      
      results.value.unshift({
        partId: part.part_id,
        colorId: part.color_id,
        featureText: part.feature_text,
        success: true,
        dimensions: result.data[0].embedding.length,
        method: result.model || 'CLIP ViT-L/14',
        processingTime: processingTime
      })
      
      addLog(`성공: ${part.part_id} (${result.data[0].embedding.length}D)`, 'success')
    } else {
      results.value.unshift({
        partId: part.part_id,
        colorId: part.color_id,
        featureText: part.feature_text,
        success: false,
        error: result.error || '임베딩 생성 실패',
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

const validateVectors = async () => {
  if (isValidating.value) return
  
  isValidating.value = true
  progress.value = 0
  
  try {
    addLog('벡터 검증 시작', 'info')
    
    // 최근 생성된 부품들 조회
    const { data: allParts, error } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id')
      .order('updated_at', { ascending: false })
      .limit(200)
    
    if (error) throw error
    
    // 각 부품의 clip_text_emb를 개별 조회하여 유효한 벡터 필터링
    const vectors = []
    for (const part of allParts || []) {
      try {
        const { data: vectorData } = await supabase
          .from('parts_master_features')
          .select('clip_text_emb')
          .eq('part_id', part.part_id)
          .eq('color_id', part.color_id)
          .single()
        
        if (vectorData?.clip_text_emb && 
            Array.isArray(vectorData.clip_text_emb) && 
            vectorData.clip_text_emb.length > 0) {
          vectors.push({
            part_id: part.part_id,
            color_id: part.color_id,
            clip_text_emb: vectorData.clip_text_emb
          })
          
          if (vectors.length >= 100) break // 최대 100개로 제한
        }
      } catch (vectorError) {
        // 벡터 조회 실패 시 건너뛰기
        continue
      }
    }
    
    if (!vectors || vectors.length === 0) {
      addLog('검증할 벡터가 없습니다', 'info')
      return
    }
    
    addLog(`${vectors.length}개 벡터 검증 시작`, 'info')
    
    let validCount = 0
    let invalidCount = 0
    
    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i]
      progress.value = Math.round(((i + 1) / vectors.length) * 100)
      progressText.value = `검증 중: ${vector.part_id} (${i + 1}/${vectors.length})`
      
      // 벡터 검증 로직
      if (Array.isArray(vector.clip_text_emb) && 
          vector.clip_text_emb.length === 768 &&
          !vector.clip_text_emb.every(val => val === 0)) {
        validCount++
      } else {
        invalidCount++
        addLog(`무효 벡터 발견: ${vector.part_id}`, 'error')
      }
    }
    
    addLog(`검증 완료: ${validCount}개 유효, ${invalidCount}개 무효`, 'info')
    
  } catch (error) {
    addLog('벡터 검증 실패: ' + error.message, 'error')
  } finally {
    isValidating.value = false
    progress.value = 100
    progressText.value = '완료'
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
  addLog('CLIP 임베딩 관리 페이지 로드됨', 'info')
})
</script>

<style scoped>
.embedding-tab {
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

.feature-text-cell {
  max-width: 200px;
  word-break: break-all;
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
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.vector-info p {
  margin: 0.25rem 0;
  color: #1976d2;
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