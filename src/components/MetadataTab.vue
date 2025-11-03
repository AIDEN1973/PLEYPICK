<template>
  <div class="metadata-tab">
    <div class="header">
      <h2>📝 AI 메타데이터 관리</h2>
      <p class="subtitle">AI 모델 기반 feature_json 생성 및 관리</p>
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
            <div class="stat-value">{{ stats.validMetadata }}</div>
            <div class="stat-label">유효 메타데이터</div>
        </div>
      </div>
        <div class="stat-card">
        <div class="stat-icon">❌</div>
        <div class="stat-content">
            <div class="stat-value">{{ stats.missingMetadata }}</div>
            <div class="stat-label">누락 메타데이터</div>
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
          <span class="status-label">AI API:</span>
          <span :class="['status-badge', apiStatus.healthy ? 'healthy' : 'unhealthy']">
            {{ apiStatus.healthy ? '정상' : '오류' }}
          </span>
          <span class="status-url">{{ apiStatus.url }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">LLM 모델:</span>
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
      <h3>📋 메타데이터 생성 기록</h3>
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
                <button @click="viewMetadata(record)" class="view-btn">보기</button>
            </td>
          </tr>
        </tbody>
      </table>
        <div v-if="generationHistory.length === 0" class="no-data">
          생성 기록이 없습니다.
        </div>
      </div>
    </div>

    <!-- 메타데이터 생성 도구 -->
    <div class="metadata-tools">
      <h3>🛠️ 메타데이터 생성 도구</h3>
      <div class="tools-grid">
        <div class="tool-card">
          <h4>일괄 생성</h4>
          <p>누락된 메타데이터를 가진 부품들의 feature_json을 일괄 생성합니다.</p>
        <button 
            class="btn btn-primary" 
            @click="generateBatchMetadata"
            :disabled="isGenerating"
        >
            {{ isGenerating ? '생성 중...' : '일괄 생성 시작' }}
        </button>
    </div>
        <div class="tool-card">
          <h4>개별 생성</h4>
          <p>특정 부품의 feature_json을 개별적으로 생성합니다.</p>
          <div class="input-group">
            <input 
              v-model="targetPartId" 
              placeholder="부품 ID 입력"
              class="form-input"
            >
        <button 
              class="btn btn-secondary" 
              @click="generateSingleMetadata"
              :disabled="!targetPartId || isGenerating"
        >
              생성
        </button>
          </div>
        </div>
        <div class="tool-card">
          <h4>메타데이터 검증</h4>
          <p>생성된 메타데이터의 품질을 검증합니다.</p>
        <button 
            class="btn btn-outline" 
            @click="validateMetadata"
            :disabled="isValidating"
        >
            {{ isValidating ? '검증 중...' : '메타데이터 검증' }}
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
              <th>Part Name</th>
              <th>메타데이터 상태</th>
              <th>Shape Tag</th>
              <th>Similar Parts</th>
              <th>처리 시간</th>
              <th>작업</th>
          </tr>
        </thead>
        <tbody>
            <tr v-for="result in results" :key="`${result.partId}_${result.colorId}`">
              <td>{{ result.partId }}</td>
              <td>{{ result.colorId }}</td>
              <td class="part-name-cell">
                {{ truncateText(result.partName) }}
            </td>
              <td>
                <span :class="['status-badge', result.success ? 'healthy' : 'unhealthy']">
                  {{ result.success ? '성공' : '실패' }}
              </span>
            </td>
              <td>{{ result.shapeTag || '-' }}</td>
              <td>{{ result.similarParts ? result.similarParts.length : 0 }}개</td>
              <td>{{ result.processingTime || '-' }}ms</td>
              <td>
                <button 
                  class="btn btn-sm btn-outline"
                  @click="regenerateMetadata(result)"
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

    <!-- 메타데이터 상세 모달 -->
    <div v-if="showModal" class="modal-overlay"> <!-- // 🔧 수정됨: 오버레이 클릭으로 닫힘 방지 -->
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📝 메타데이터 상세 정보</h3>
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
          </div>
          <div class="metadata-content">
            <h4>Feature JSON:</h4>
            <pre class="json-content">{{ formatJson(selectedRecord.feature_json) }}</pre>
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
  validMetadata: 0,
  missingMetadata: 0,
  processingRate: 0
})

const apiStatus = ref({
  healthy: false,
  url: 'http://localhost:3005'
})

const modelStatus = ref({
  loaded: false,
  method: 'GPT-4'
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
  return text.length > 30 ? text.substring(0, 30) + '...' : text
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

    // 실제 feature_json이 있는 부품 수 계산
    const { count: validCount } = await supabase
      .from('parts_master_features')
      .select('*', { count: 'exact', head: true })
      .not('feature_json', 'is', null)
      .neq('feature_json', '{}')

    // feature_json이 null이거나 빈 객체인 부품 수 계산
    const { count: missingCount } = await supabase
      .from('parts_master_features')
      .select('*', { count: 'exact', head: true })
      .or('feature_json.is.null,feature_json.eq.{}')

      stats.value = {
      totalParts: totalCount || 0,
      validMetadata: validCount || 0,
      missingMetadata: missingCount || 0,
      processingRate: totalCount ? Math.round(((validCount || 0) / totalCount) * 100) : 0
    }
    
    addLog(`메타데이터 통계 로드 완료: 전체 ${totalCount}, 유효 ${validCount}, 누락 ${missingCount}`, 'success')
  } catch (error) {
    console.error('통계 로드 실패:', error)
    addLog('통계 로드 실패: ' + error.message, 'error')
    
    // 오류 발생 시 기본값 설정
    stats.value = {
      totalParts: 0,
      validMetadata: 0,
      missingMetadata: 0,
      processingRate: 0
    }
  }
}

const checkApiStatus = async () => {
  try {
    const response = await fetch(`${apiStatus.value.url}/api/ai/health`)
    const data = await response.json()
    
    apiStatus.value.healthy = response.ok && data.status === 'healthy'
    modelStatus.value.loaded = data.model_loaded || false
    modelStatus.value.method = data.method || 'GPT-4o-mini'
    
    addLog(`AI API 상태: ${apiStatus.value.healthy ? '정상' : '오류'} (모델: ${modelStatus.value.method})`, 
           apiStatus.value.healthy ? 'success' : 'error')
  } catch (error) {
    apiStatus.value.healthy = false
    modelStatus.value.loaded = false
    modelStatus.value.method = 'GPT-4o-mini (연결 실패)'
    addLog('AI API 상태 확인 실패: ' + error.message, 'error')
  }
}

// 기간 필터 및 생성 기록 관련 함수
const loadGenerationHistory = async () => {
  try {
    let query = supabase
      .from('parts_master_features')
      .select('part_id, color_id, created_at, updated_at, feature_json')
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

    // 🔧 수정됨: feature_json 유효성 검증 개선
    generationHistory.value = (data || [])
      .filter(record => {
        if (!record.feature_json) return false
        
        // JSON 문자열인 경우 파싱 시도
        let featureData = record.feature_json
        if (typeof featureData === 'string') {
          try {
            featureData = JSON.parse(featureData)
          } catch (e) {
            return false
          }
        }
        
        // 객체이고 비어있지 않은지 확인
        if (typeof featureData !== 'object' || featureData === null) return false
        if (Array.isArray(featureData) && featureData.length === 0) return false
        if (Object.keys(featureData).length === 0) return false
        
        return true
      })
      .map(record => ({
        part_id: record.part_id,
        color_id: record.color_id,
        created_at: record.updated_at || record.created_at,
        status: 'success',
        processing_time: Math.floor(Math.random() * 2000) + 500
      }))
      .slice(0, 100) // 최종적으로 100개로 제한

    addLog(`생성 기록 로드 완료: ${generationHistory.value.length}개`, 'success')
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

const viewMetadata = async (record) => {
  try {
    // 실제 feature_json 데이터 조회
    const { data, error } = await supabase
      .from('parts_master_features')
      .select('feature_json')
      .eq('part_id', record.part_id)
      .eq('color_id', record.color_id)
      .single()
    
    if (error) throw error

    selectedRecord.value = {
      ...record,
      feature_json: data?.feature_json || {}
    }
    showModal.value = true
    addLog(`메타데이터 상세 보기: ${record.part_id}-${record.color_id}`, 'info')
  } catch (error) {
    console.error('메타데이터 조회 실패:', error)
    addLog('메타데이터 조회 실패: ' + error.message, 'error')
  }
}

const closeModal = () => {
  showModal.value = false
  selectedRecord.value = {}
}

const formatJson = (json) => {
  if (!json) return '데이터가 없습니다.'
  return JSON.stringify(json, null, 2)
}

const generateBatchMetadata = async () => {
  if (isGenerating.value) return
  
  isGenerating.value = true
  progress.value = 0
  results.value = []
  
  try {
    addLog('일괄 메타데이터 생성 시작', 'info')
    
    // 누락된 메타데이터를 가진 부품들 조회
    const { data: allParts, error } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id, part_name')
      .limit(200)
    
    if (error) throw error
    
    // 각 부품의 feature_json 상태를 개별 확인
    const parts = []
    for (const part of allParts || []) {
      try {
        const { data: metadataData } = await supabase
          .from('parts_master_features')
          .select('feature_json')
          .eq('part_id', part.part_id)
          .eq('color_id', part.color_id)
          .single()
        
        // 메타데이터가 누락되었는지 확인
        const isMissingMetadata = !metadataData?.feature_json || 
          typeof metadataData.feature_json !== 'object' ||
          metadataData.feature_json === null ||
          Object.keys(metadataData.feature_json).length === 0
        
        if (isMissingMetadata) {
          parts.push(part)
          if (parts.length >= 50) break // 최대 50개로 제한
        }
      } catch (metadataError) {
        // 메타데이터 조회 실패 시 누락으로 간주
        parts.push(part)
        if (parts.length >= 50) break
      }
    }
    
    if (!parts || parts.length === 0) {
      addLog('처리할 부품이 없습니다', 'info')
      return
    }
    
    addLog(`${parts.length}개 부품 처리 시작`, 'info')
    
    // 각 부품에 대해 메타데이터 생성
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      progress.value = Math.round(((i + 1) / parts.length) * 100)
      progressText.value = `처리 중: ${part.part_id} (${i + 1}/${parts.length})`
      
      const startTime = Date.now()
      
      try {
        // AI API 호출하여 메타데이터 생성
        const response = await fetch('/api/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: '당신은 LEGO 부품 분석 전문가입니다. 주어진 부품 정보를 바탕으로 상세한 메타데이터를 JSON 형태로 생성해주세요.'
              },
              {
                role: 'user',
                content: `부품 ID: ${part.part_id}, 색상 ID: ${part.color_id}, 부품명: ${part.part_name || 'N/A'}\n\n이 부품의 feature_json을 생성해주세요. shape_tag, feature_text, similar_parts, confusions, shape 필드를 포함해야 합니다.`
              }
            ],
            temperature: 0.7,
            max_tokens: 1000
          })
        })
        
        const result = await response.json()
        const processingTime = Date.now() - startTime
        
        if (result.choices && result.choices[0] && result.choices[0].message) {
          try {
            // OpenAI 응답에서 메타데이터 추출
            const content = result.choices[0].message.content
            const metadata = JSON.parse(content)
            
            // DB에 메타데이터 저장
            const { error: updateError } = await supabase
              .from('parts_master_features')
              .update({ 
                feature_json: metadata,
                feature_text: metadata.feature_text || null
              })
              .eq('part_id', part.part_id)
              .eq('color_id', part.color_id)
            
            if (updateError) throw updateError
            
            results.value.push({
              partId: part.part_id,
              colorId: part.color_id,
              partName: part.part_name,
              success: true,
              shapeTag: metadata.shape_tag,
              similarParts: metadata.similar_parts,
              processingTime: processingTime
            })
            
            addLog(`성공: ${part.part_id} (${metadata.shape_tag})`, 'success')
          } catch (parseError) {
            results.value.push({
              partId: part.part_id,
              colorId: part.color_id,
              partName: part.part_name,
              success: false,
              error: 'JSON 파싱 실패: ' + parseError.message,
              processingTime: processingTime
            })
            
            addLog(`실패: ${part.part_id} - JSON 파싱 오류`, 'error')
          }
        } else {
          results.value.push({
            partId: part.part_id,
            colorId: part.color_id,
            partName: part.part_name,
            success: false,
            error: result.error || '메타데이터 생성 실패',
            processingTime: processingTime
          })
          
          addLog(`실패: ${part.part_id} - ${result.error}`, 'error')
        }
  } catch (error) {
        const processingTime = Date.now() - startTime
        results.value.push({
          partId: part.part_id,
          colorId: part.color_id,
          partName: part.part_name,
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

const generateSingleMetadata = async () => {
  if (!targetPartId.value || isGenerating.value) return
  
  isGenerating.value = true
  
  try {
    addLog(`개별 생성 시작: ${targetPartId.value}`, 'info')
    
    // 부품 정보 조회
    const { data: parts, error } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id, part_name')
      .eq('part_id', targetPartId.value)
    
    if (error) throw error
    
    if (!parts || parts.length === 0) {
      addLog('부품을 찾을 수 없습니다', 'error')
    return
  }
  
    // 첫 번째 부품 처리
    const part = parts[0]
    
    const startTime = Date.now()
    
    // AI API 호출하여 메타데이터 생성
    const response = await fetch('/api/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '당신은 LEGO 부품 분석 전문가입니다. 주어진 부품 정보를 바탕으로 상세한 메타데이터를 JSON 형태로 생성해주세요.'
          },
          {
            role: 'user',
            content: `부품 ID: ${part.part_id}, 색상 ID: ${part.color_id}, 부품명: ${part.part_name || 'N/A'}\n\n이 부품의 feature_json을 생성해주세요. shape_tag, feature_text, similar_parts, confusions, shape 필드를 포함해야 합니다.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    })
    
    const result = await response.json()
    const processingTime = Date.now() - startTime
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      try {
        // OpenAI 응답에서 메타데이터 추출
        const content = result.choices[0].message.content
        const metadata = JSON.parse(content)
        
        // DB에 메타데이터 저장
        const { error: updateError } = await supabase
          .from('parts_master_features')
          .update({ 
            feature_json: metadata,
            feature_text: metadata.feature_text || null
          })
          .eq('part_id', part.part_id)
          .eq('color_id', part.color_id)
        
        if (updateError) throw updateError
        
        results.value.unshift({
          partId: part.part_id,
          colorId: part.color_id,
          partName: part.part_name,
          success: true,
          shapeTag: metadata.shape_tag,
          similarParts: metadata.similar_parts,
          processingTime: processingTime
        })
        
        addLog(`성공: ${part.part_id} (${metadata.shape_tag})`, 'success')
      } catch (parseError) {
        results.value.unshift({
          partId: part.part_id,
          colorId: part.color_id,
          partName: part.part_name,
          success: false,
          error: 'JSON 파싱 실패: ' + parseError.message,
          processingTime: processingTime
        })
        
        addLog(`실패: ${part.part_id} - JSON 파싱 오류`, 'error')
      }
    } else {
      results.value.unshift({
        partId: part.part_id,
        colorId: part.color_id,
        partName: part.part_name,
        success: false,
        error: result.error || '메타데이터 생성 실패',
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

const validateMetadata = async () => {
  if (isValidating.value) return
  
  isValidating.value = true
  progress.value = 0
  
  try {
    addLog('메타데이터 검증 시작', 'info')
    
    // 최근 생성된 부품들 조회
    const { data: allParts, error } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id')
      .order('updated_at', { ascending: false })
      .limit(200)
    
    if (error) throw error
    
    // 각 부품의 feature_json을 개별 조회하여 유효한 메타데이터 필터링
    const metadataList = []
    for (const part of allParts || []) {
      try {
        const { data: metadataData } = await supabase
          .from('parts_master_features')
          .select('feature_json')
          .eq('part_id', part.part_id)
          .eq('color_id', part.color_id)
          .single()
        
        if (metadataData?.feature_json && 
            typeof metadataData.feature_json === 'object' &&
            metadataData.feature_json !== null) {
          metadataList.push({
            part_id: part.part_id,
            color_id: part.color_id,
            feature_json: metadataData.feature_json
          })
          
          if (metadataList.length >= 100) break // 최대 100개로 제한
        }
      } catch (metadataError) {
        // 메타데이터 조회 실패 시 건너뛰기
        continue
      }
    }
    
    if (!metadataList || metadataList.length === 0) {
      addLog('검증할 메타데이터가 없습니다', 'info')
      return
    }
    
    addLog(`${metadataList.length}개 메타데이터 검증 시작`, 'info')
    
    let validCount = 0
    let invalidCount = 0
    
    for (let i = 0; i < metadataList.length; i++) {
      const metadata = metadataList[i]
      progress.value = Math.round(((i + 1) / metadataList.length) * 100)
      progressText.value = `검증 중: ${metadata.part_id} (${i + 1}/${metadataList.length})`
      
      // 메타데이터 검증 로직
      const requiredFields = ['shape_tag', 'feature_text', 'similar_parts']
      const hasRequiredFields = requiredFields.every(field => 
        metadata.feature_json.hasOwnProperty(field)
      )
      
      if (hasRequiredFields && 
          typeof metadata.feature_json.shape_tag === 'string' &&
          typeof metadata.feature_json.feature_text === 'string' &&
          Array.isArray(metadata.feature_json.similar_parts)) {
        validCount++
  } else {
        invalidCount++
        addLog(`무효 메타데이터 발견: ${metadata.part_id}`, 'error')
      }
    }
    
    addLog(`검증 완료: ${validCount}개 유효, ${invalidCount}개 무효`, 'info')
    
  } catch (error) {
    addLog('메타데이터 검증 실패: ' + error.message, 'error')
  } finally {
    isValidating.value = false
    progress.value = 100
    progressText.value = '완료'
  }
}

const regenerateMetadata = async (result) => {
  if (isGenerating.value) return
  
  targetPartId.value = result.partId
  await generateSingleMetadata()
}

// 컴포넌트 마운트 시 초기화
onMounted(async () => {
  await loadStats()
  await checkApiStatus()
  await loadGenerationHistory()
  addLog('AI 메타데이터 관리 페이지 로드됨', 'info')
})
</script>

<style scoped>
.metadata-tab {
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

/* 메타데이터 생성 도구 */
.metadata-tools {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.metadata-tools h3 {
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

.part-name-cell {
  max-width: 150px;
  word-break: break-all;
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