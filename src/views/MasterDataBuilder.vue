<template>
  <div class="master-data-builder">
    <div class="header">
      <h1>마스터 부품 데이터 구축</h1>
      <p>Rebrickable API에서 부품을 수집하고 LLM으로 분석하여 마스터 데이터베이스를 구축합니다.</p>
    </div>

    <!-- 세트별 구축 섹션 -->
    <div class="set-specific-section">
      <div class="card">
        <h2>🎯 특정 세트별 구축</h2>
        <p>특정 레고 세트의 부품들만 대상으로 마스터 데이터를 구축합니다.</p>
         <div class="form-group">
           <label for="setNumber">레고 세트 번호</label>
           <input 
             id="setNumber"
             v-model="targetSetNumber" 
             type="text" 
             placeholder="예: 21248 (자동으로 21248-1로 변환)"
             :disabled="loading || processing"
           />
           <small class="form-help">세트 번호만 입력하세요. 자동으로 -1이 추가됩니다.</small>
         </div>
        <button 
          @click="buildSetSpecificData" 
          :disabled="loading || processing || !targetSetNumber"
          class="btn btn-info"
        >
          {{ processing ? '구축 중...' : '세트별 구축 시작' }}
        </button>
        <div v-if="setSpecificProgress > 0" class="progress">
          <div class="progress-bar" :style="{ width: setSpecificProgress + '%' }"></div>
          <span>{{ setSpecificProgress }}%</span>
        </div>
        <div v-if="processing" class="performance-info">
          <small>⚡ 병렬 처리로 성능 최적화 중... (품질 유지)</small>
        </div>
      </div>
    </div>

    <div class="divider">
      <hr>
      <span>또는</span>
    </div>

    <div class="builder-section">
      <div class="card">
        <h2>1단계: 전체 부품 수집</h2>
        <p>Rebrickable API에서 모든 부품 정보를 수집합니다.</p>
        <button 
          @click="collectAllParts" 
          :disabled="loading || processing"
          class="btn btn-primary"
        >
          {{ loading ? '수집 중...' : '부품 수집 시작' }}
        </button>
        <div v-if="collectionProgress > 0" class="progress">
          <div class="progress-bar" :style="{ width: collectionProgress + '%' }"></div>
          <span>{{ collectionProgress }}%</span>
        </div>
      </div>

      <div class="card">
        <h2>2단계: LLM 분석</h2>
        <p>GPT-4 Vision을 사용하여 각 부품의 특징을 분석합니다.</p>
        <button 
          @click="analyzeParts" 
          :disabled="loading || processing || !allParts.length"
          class="btn btn-primary"
        >
          {{ processing ? '분석 중...' : 'LLM 분석 시작' }}
        </button>
        <div v-if="analysisProgress > 0" class="progress">
          <div class="progress-bar" :style="{ width: analysisProgress + '%' }"></div>
          <span>{{ analysisProgress }}%</span>
        </div>
      </div>

      <div class="card">
        <h2>3단계: 임베딩 생성</h2>
        <p>OpenAI text-embedding-3-small을 사용하여 텍스트 임베딩을 생성합니다.</p>
        <button 
          @click="generateEmbeddings" 
          :disabled="loading || processing || !analysisResults.length"
          class="btn btn-primary"
        >
          {{ processing ? '생성 중...' : '임베딩 생성 시작' }}
        </button>
        <div v-if="embeddingProgress > 0" class="progress">
          <div class="progress-bar" :style="{ width: embeddingProgress + '%' }"></div>
          <span>{{ embeddingProgress }}%</span>
        </div>
      </div>

      <div class="card">
        <h2>4단계: 데이터베이스 저장</h2>
        <p>분석된 데이터를 parts_master_features 테이블에 저장합니다.</p>
        <button 
          @click="saveToDatabase" 
          :disabled="loading || processing || !embeddingResults.length"
          class="btn btn-success"
        >
          {{ processing ? '저장 중...' : '데이터베이스 저장' }}
        </button>
      </div>

      <div class="card">
        <h2>전체 프로세스</h2>
        <p>모든 단계를 한 번에 실행합니다.</p>
        <button 
          @click="buildCompleteDatabase" 
          :disabled="loading || processing"
          class="btn btn-warning"
        >
          {{ processing ? '전체 구축 중...' : '전체 마스터 DB 구축' }}
        </button>
        <div v-if="overallProgress > 0" class="progress">
          <div class="progress-bar" :style="{ width: overallProgress + '%' }"></div>
          <span>{{ overallProgress }}%</span>
        </div>
      </div>
    </div>

    <div class="status-section">
      <h3>진행 상태</h3>
      <div class="status-grid">
        <div class="status-item">
          <span class="label">수집된 부품:</span>
          <span class="value">{{ allParts.length }}개</span>
        </div>
        <div class="status-item">
          <span class="label">분석 완료:</span>
          <span class="value">{{ analysisResults.length }}개</span>
        </div>
        <div class="status-item">
          <span class="label">임베딩 생성:</span>
          <span class="value">{{ embeddingResults.length }}개</span>
        </div>
        <div class="status-item">
          <span class="label">DB 저장:</span>
          <span class="value">{{ savedRecords.length }}개</span>
        </div>
      </div>
    </div>

    <!-- 세트별 구축 결과 표시 -->
    <div v-if="setSavedRecords.length > 0" class="results-section">
      <h3>🎯 세트별 구축 결과</h3>
      <div class="results-grid">
        <div v-for="record in setSavedRecords" :key="record.id" class="result-card">
          <div class="part-header">
            <h4>{{ record.part_name || 'Unknown Part' }}</h4>
            <div class="part-badge">
              <span class="part-id">{{ record.part_id }}</span>
              <span class="color-id">Color: {{ record.color_id }}</span>
            </div>
          </div>
          
          <!-- 디버깅 정보 -->
          
          <!-- 부품 이미지 (호버 시 메타데이터 표시) -->
          <div v-if="getPartImageUrl(record)" class="part-image-container">
            <div class="part-image">
              <img 
                :src="getPartImageUrl(record)" 
                :alt="record.part_name"
                @mouseenter="showMetadata = record.id"
                @mouseleave="showMetadata = null"
                @error="handleImageError"
                @load="console.log('이미지 로딩 성공:', record.part_name)"
              />
            </div>
            
            <!-- 호버 시 메타데이터 툴팁 -->
            <div 
              v-if="showMetadata === record.id" 
              class="metadata-tooltip"
              @mouseenter="showMetadata = record.id"
              @mouseleave="showMetadata = null"
            >
              <div class="tooltip-content">
                <h5>📊 AI 분석 결과</h5>
                <div class="metadata-grid">
                  <div class="metadata-item">
                    <span class="label">신뢰도:</span>
                    <span class="value confidence">{{ (record.confidence * 100).toFixed(1) }}%</span>
                  </div>
                  <div class="metadata-item">
                    <span class="label">모양:</span>
                    <span class="value">{{ getDisplayValue(record.shape_tag || record.feature_json?.shape_tag || record.feature_json?.shape) }}</span>
                  </div>
                  <div class="metadata-item">
                    <span class="label">연결:</span>
                    <span class="value">{{ getDisplayValue(record.feature_json?.connection) }}</span>
                  </div>
                  <div class="metadata-item">
                    <span class="label">기능:</span>
                    <span class="value">{{ getDisplayValue(record.function_tag || record.feature_json?.function_tag || record.feature_json?.function) }}</span>
                  </div>
                  <div class="metadata-item">
                    <span class="label">중앙 스터드:</span>
                    <span class="value">{{ record.feature_json?.center_stud ? '✅' : '❌' }}</span>
                  </div>
                  <div class="metadata-item">
                    <span class="label">홈:</span>
                    <span class="value">{{ record.feature_json?.groove ? '✅' : '❌' }}</span>
                  </div>
                </div>
                
                <div v-if="record.feature_text" class="feature-description">
                  <h6>🔍 특징 설명:</h6>
                  <p>{{ record.feature_text }}</p>
                </div>
                
                <div v-if="record.recognition_hints" class="recognition-hints">
                  <h6>👁️ 인식 힌트:</h6>
                  <div class="hint-item">
                    <strong>위에서 본 모습:</strong> {{ record.recognition_hints.top_view }}
                  </div>
                  <div class="hint-item">
                    <strong>옆에서 본 모습:</strong> {{ record.recognition_hints.side_view }}
                  </div>
                  <div v-if="record.recognition_hints.unique_features?.length" class="hint-item">
                    <strong>고유 특징:</strong> {{ record.recognition_hints.unique_features.join(', ') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 기본 정보 (이미지가 없을 때) -->
          <div v-if="!getPartImageUrl(record)" class="part-info">
            <div class="no-image-placeholder">
              <div class="placeholder-icon">🖼️</div>
              <p><strong>이미지 로딩 중...</strong></p>
              <p><strong>부품 번호:</strong> {{ record.part_id }}</p>
              <p><strong>색상 ID:</strong> {{ record.color_id }}</p>
              <p><strong>신뢰도:</strong> {{ record.confidence?.toFixed(2) || 'N/A' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      <h4>오류 발생</h4>
      <p>{{ error }}</p>
    </div>

    <div v-if="successMessage" class="success-message">
      <h4>성공</h4>
      <p>{{ successMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMasterPartsPreprocessing } from '../composables/useMasterPartsPreprocessing'
import { useRebrickable } from '../composables/useRebrickable'
import { useDatabase } from '../composables/useDatabase'
import { useImageManager } from '../composables/useImageManager'

const {
  loading,
  error,
  processing,
  progress,
  collectAllRebrickableParts,
  analyzePartsBatch,
  analyzePartWithLLM,
  generateTextEmbeddingsBatch,
  saveToMasterPartsDB,
  buildMasterPartsDatabase
} = useMasterPartsPreprocessing()

// 상태 변수들
const allParts = ref([])
const analysisResults = ref([])
const embeddingResults = ref([])
const savedRecords = ref([])

// 세트별 구축 변수들
const targetSetNumber = ref('')
const setSpecificProgress = ref(0)
const setParts = ref([])
const setSetInfo = ref(null)
const setAnalysisResults = ref([])
const setEmbeddingResults = ref([])
const setSavedRecords = ref([])
const showMetadata = ref(null)

// 진행률
const collectionProgress = ref(0)
const analysisProgress = ref(0)
const embeddingProgress = ref(0)
const overallProgress = ref(0)

// 메시지
const successMessage = ref('')

// 1단계: 전체 부품 수집
const collectAllParts = async () => {
  try {
    successMessage.value = ''
    error.value = null
    
    console.log('Starting parts collection...')
    allParts.value = await collectAllRebrickableParts()
    collectionProgress.value = 100
    successMessage.value = `${allParts.value.length}개의 부품을 수집했습니다.`
  } catch (err) {
    console.error('Collection failed:', err)
    error.value = err.message
  }
}

// 2단계: LLM 분석
const analyzeParts = async () => {
  if (allParts.value.length === 0) {
    error.value = '먼저 부품을 수집해주세요.'
    return
  }

  try {
    successMessage.value = ''
    error.value = null
    
    console.log('Starting LLM analysis...')
    const results = await analyzePartsBatch(allParts.value, 5)
    analysisResults.value = results.results
    analysisProgress.value = 100
    successMessage.value = `${results.results.length}개 부품의 LLM 분석이 완료되었습니다.`
  } catch (err) {
    console.error('Analysis failed:', err)
    error.value = err.message
  }
}

// 3단계: 임베딩 생성
const generateEmbeddings = async () => {
  if (analysisResults.value.length === 0) {
    error.value = '먼저 LLM 분석을 완료해주세요.'
    return
  }

  try {
    successMessage.value = ''
    error.value = null
    
    console.log('Starting embedding generation...')
    embeddingResults.value = await generateTextEmbeddingsBatch(analysisResults.value)
    embeddingProgress.value = 100
    successMessage.value = `${embeddingResults.value.length}개 부품의 임베딩이 생성되었습니다.`
  } catch (err) {
    console.error('Embedding generation failed:', err)
    error.value = err.message
  }
}

// 4단계: 데이터베이스 저장
const saveToDatabase = async () => {
  if (embeddingResults.value.length === 0) {
    error.value = '먼저 임베딩을 생성해주세요.'
    return
  }

  try {
    successMessage.value = ''
    error.value = null
    
    console.log('Starting database save...')
    savedRecords.value = await saveToMasterPartsDB(embeddingResults.value)
    successMessage.value = `${savedRecords.value.length}개 레코드가 데이터베이스에 저장되었습니다.`
  } catch (err) {
    console.error('Database save failed:', err)
    error.value = err.message
  }
}

// 세트별 구축 함수들
const buildSetSpecificData = async () => {
  try {
    successMessage.value = ''
    error.value = null
    processing.value = true
    setSpecificProgress.value = 0

    // 1단계: 세트 부품 수집
    await collectSetParts()
    setSpecificProgress.value = 15

    // 2단계: LLM 분석 (병렬 처리로 속도 개선)
    await analyzeSetPartsWithLLM()
    setSpecificProgress.value = 50

    // 3단계: CLIP 임베딩 생성 (병렬 처리로 속도 개선)
    await generateSetTextEmbeddings()
    setSpecificProgress.value = 80

    // 4단계: 마스터 DB 저장 (병렬 처리로 속도 개선)
    await saveSetToMasterPartsDB()
    setSpecificProgress.value = 100

    successMessage.value = `세트 ${targetSetNumber.value}의 마스터 데이터 구축이 완료되었습니다!`
  } catch (error) {
    console.error('세트별 구축 실패:', error)
    error.value = error.message
  } finally {
    processing.value = false
  }
}

// 세트 부품 수집
const collectSetParts = async () => {
  try {
    const { getSetParts, getSet } = useRebrickable()
    
    // 세트 번호에 -1이 없으면 자동으로 추가
    let setNumber = targetSetNumber.value.trim()
    if (!setNumber.includes('-')) {
      setNumber = `${setNumber}-1`
    }
    
    console.log(`세트 ${setNumber} 부품 수집 시작...`)
    
    // 1단계: 세트 기본 정보 조회
    const setInfo = await getSet(setNumber)
    console.log('세트 정보:', setInfo)
    setSetInfo.value = setInfo
    
    // 2단계: 세트 부품 정보 조회
    const setPartsResponse = await getSetParts(setNumber)
    console.log('수집된 응답:', setPartsResponse)
    
    if (!setPartsResponse) {
      throw new Error(`세트 ${setNumber}의 데이터를 받을 수 없습니다.`)
    }
    
    // getSetParts는 { count, results } 형태로 반환
    const setPartsData = setPartsResponse.results || setPartsResponse
    
    if (!Array.isArray(setPartsData)) {
      console.error('예상과 다른 데이터 형식:', typeof setPartsData, setPartsData)
      throw new Error(`세트 ${setNumber}의 부품 데이터 형식이 올바르지 않습니다.`)
    }
    
    if (setPartsData.length === 0) {
      throw new Error(`세트 ${setNumber}의 부품을 찾을 수 없습니다.`)
    }

    setParts.value = setPartsData
    console.log(`세트 ${setNumber}에서 ${setPartsData.length}개 부품 수집 완료`)
  } catch (error) {
    console.error('세트 부품 수집 실패:', error)
    throw error
  }
}

// 세트 부품 LLM 분석 (중복 방지 + 병렬 처리로 성능 개선)
const analyzeSetPartsWithLLM = async () => {
  try {
    const results = []
    const total = setParts.value.length
    const batchSize = 3 // API 레이트 리미트 고려하여 3개씩 배치 처리

    console.log(`세트 ${targetSetNumber.value} 부품 분석 시작: ${total}개 (배치 크기: ${batchSize})`)

    // 1단계: 이미 분석된 부품들 확인 (개별 체크)
    const { checkExistingAnalysis } = useMasterPartsPreprocessing()
    const existingAnalyses = []
    const partsToAnalyze = []
    
    for (const part of setParts.value) {
      const partNum = part.part?.part_num
      const colorId = part.color?.id
      
      if (partNum && colorId) {
        const existing = await checkExistingAnalysis(partNum, colorId)
        if (existing) {
          existingAnalyses.push(existing)
          console.log(`⏭️ 기존 분석 발견: ${partNum} (color: ${colorId})`)
        } else {
          partsToAnalyze.push(part)
          console.log(`🆕 새로 분석 필요: ${partNum} (color: ${colorId})`)
        }
      }
    }
    
    console.log(`이미 분석된 부품: ${existingAnalyses.length}개`)
    console.log(`새로 분석할 부품: ${partsToAnalyze.length}개`)

    console.log(`분석 대상 부품: ${partsToAnalyze.length}개`)

    // 3단계: 새로운 부품들만 병렬 분석
    for (let i = 0; i < partsToAnalyze.length; i += batchSize) {
      const batch = partsToAnalyze.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(partsToAnalyze.length / batchSize)
      
      console.log(`배치 ${batchNumber}/${totalBatches} 처리 중... (${batch.length}개 부품)`)
      
      // 병렬 처리: 품질 유지하면서 속도 개선
      const batchPromises = batch.map(async (part, index) => {
        const globalIndex = i + index + 1
        try {
          console.log(`부품 ${globalIndex}/${partsToAnalyze.length} 분석 시작: ${part.part?.part_num || part.part_num}`)
          const analysis = await analyzePartWithLLM(part)
          console.log(`부품 ${globalIndex}/${partsToAnalyze.length} 분석 완료: ${part.part?.part_num || part.part_num}`)
          return analysis
        } catch (error) {
          console.error(`부품 ${part.part?.part_num || part.part_num} 분석 실패:`, error)
          return { 
            part_num: part.part?.part_num || part.part_num, 
            error: error.message 
          }
        }
      })
      
      // 배치 완료 대기
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      console.log(`배치 ${batchNumber}/${totalBatches} 완료: ${batchResults.filter(r => !r.error).length}개 성공, ${batchResults.filter(r => r.error).length}개 실패`)
      
      // API 레이트 리미트 방지를 위한 짧은 대기
      if (i + batchSize < partsToAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms 대기
      }
    }

    // 4단계: 기존 분석 결과와 새 분석 결과 결합
    const allResults = [...existingAnalyses, ...results]

    setAnalysisResults.value = allResults
    
    // 분석 결과 통계
    const totalAnalyzed = allResults.length
    const newAnalyzed = results.filter(r => !r.error).length
    const existingAnalyzed = existingAnalyses.length
    const errorCount = results.filter(r => r.error).length
    const avgConfidence = allResults
      .filter(r => !r.error && r.confidence)
      .reduce((sum, r) => sum + r.confidence, 0) / totalAnalyzed || 0
    
    console.log(`세트 ${targetSetNumber.value} 부품 분석 완료: ${totalAnalyzed}개`)
    console.log(`🔄 기존 분석: ${existingAnalyzed}개, 🆕 새로 분석: ${newAnalyzed}개, ❌ 실패: ${errorCount}개`)
    console.log(`📊 평균 신뢰도: ${avgConfidence.toFixed(2)}`)
    
    // 성공한 분석 결과 샘플 출력
    const successResults = allResults.filter(r => !r.error).slice(0, 3)
    if (successResults.length > 0) {
      console.log('📋 분석 결과 샘플:', successResults.map(r => ({
        part_num: r.part_num,
        shape: r.shape,
        confidence: r.confidence,
        is_existing: r.is_existing || false
      })))
    }
  } catch (error) {
    console.error('세트 부품 LLM 분석 실패:', error)
    throw error
  }
}

// 세트 부품 CLIP 임베딩 생성 (중복 방지 + 병렬 처리로 성능 개선)
const generateSetTextEmbeddings = async () => {
  try {
    const analysisResults = setAnalysisResults.value.filter(r => !r.error)
    const total = analysisResults.length
    const batchSize = 5 // 임베딩 API는 더 큰 배치 크기 가능
    
    console.log(`세트 ${targetSetNumber.value} 임베딩 생성 시작: ${total}개 (배치 크기: ${batchSize})`)
    
    // 1단계: 기존 임베딩이 있는 부품들 필터링
    const needsEmbedding = analysisResults.filter(result => !result.embedding)
    const hasEmbedding = analysisResults.filter(result => result.embedding)
    
    console.log(`📊 임베딩 필요: ${needsEmbedding.length}개, 기존 임베딩: ${hasEmbedding.length}개`)
    
    const allEmbeddingResults = []
    
    // 기존 임베딩이 있는 부품들은 그대로 추가
    allEmbeddingResults.push(...hasEmbedding)
    
    // 2단계: 임베딩이 필요한 부품들만 처리
    if (needsEmbedding.length > 0) {
      for (let i = 0; i < needsEmbedding.length; i += batchSize) {
        const batch = needsEmbedding.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(needsEmbedding.length / batchSize)
        
        console.log(`임베딩 배치 ${batchNumber}/${totalBatches} 처리 중... (${batch.length}개)`)
        
        try {
          // 배치 처리로 임베딩 생성 (품질 유지)
          const batchEmbeddings = await generateTextEmbeddingsBatch(batch)
          allEmbeddingResults.push(...batchEmbeddings)
          
          console.log(`임베딩 배치 ${batchNumber}/${totalBatches} 완료: ${batchEmbeddings.filter(e => !e.error).length}개 성공`)
          
          // API 레이트 리미트 방지
          if (i + batchSize < needsEmbedding.length) {
            await new Promise(resolve => setTimeout(resolve, 50)) // 50ms 대기
          }
        } catch (error) {
          console.error(`임베딩 배치 ${batchNumber} 실패:`, error)
          // 실패한 배치의 개별 처리
          for (const analysis of batch) {
            allEmbeddingResults.push({
              part_num: analysis.part_num,
              error: error.message
            })
          }
        }
      }
    } else {
      console.log(`⏭️ 모든 부품이 이미 임베딩을 가지고 있습니다.`)
    }
    
    setEmbeddingResults.value = allEmbeddingResults
    console.log(`세트 ${targetSetNumber.value} 임베딩 생성 완료: ${allEmbeddingResults.length}개`)
  } catch (error) {
    console.error('세트 부품 임베딩 생성 실패:', error)
    throw error
  }
}

// 세트 데이터를 마스터 DB에 저장 (중복 방지 + 병렬 처리로 성능 개선)
const saveSetToMasterPartsDB = async () => {
  try {
    const validEmbeddings = setEmbeddingResults.value.filter(e => !e.error)
    const total = validEmbeddings.length
    const batchSize = 3 // DB 저장은 작은 배치로 안전하게 처리
    
    console.log(`세트 ${targetSetNumber.value} DB 저장 시작: ${total}개 (배치 크기: ${batchSize})`)
    
    // 1단계: 이미 저장된 부품들 확인
    const { checkExistingAnalysis } = useMasterPartsPreprocessing()
    const needsSaving = []
    const alreadySaved = []
    
    for (const embedding of validEmbeddings) {
      const partNum = embedding.part_num
      const colorId = embedding.color_id
      
      if (partNum && colorId) {
        const existing = await checkExistingAnalysis(partNum, colorId)
        if (existing && existing.embedding) {
          alreadySaved.push(embedding)
          console.log(`⏭️ 이미 저장됨: ${partNum} (color: ${colorId})`)
        } else {
          needsSaving.push(embedding)
          console.log(`🆕 새로 저장 필요: ${partNum} (color: ${colorId})`)
        }
      }
    }
    
    console.log(`📊 저장 필요: ${needsSaving.length}개, 이미 저장됨: ${alreadySaved.length}개`)
    
    const allResults = []
    
    // 이미 저장된 부품들은 결과에 추가
    allResults.push(...alreadySaved)
    
    // 2단계: 저장이 필요한 부품들만 처리
    if (needsSaving.length > 0) {
      for (let i = 0; i < needsSaving.length; i += batchSize) {
        const batch = needsSaving.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(needsSaving.length / batchSize)
        
        console.log(`DB 저장 배치 ${batchNumber}/${totalBatches} 처리 중... (${batch.length}개)`)
      
      // 배치 내 병렬 처리
      const batchPromises = batch.map(async (embedding, index) => {
        const globalIndex = i + index + 1
        try {
          // 1단계: 부품 데이터를 lego_parts 테이블에 먼저 저장
          const originalPart = setParts.value.find(p => p.part?.part_num === embedding.part_num)
          if (originalPart?.part) {
            const { saveLegoPart } = useDatabase()
            await saveLegoPart({
              part_num: originalPart.part.part_num,
              name: originalPart.part.name,
              part_cat_id: originalPart.part.part_cat_id,
              part_url: originalPart.part.part_url,
              part_img_url: originalPart.part.part_img_url,
              external_ids: originalPart.part.external_ids,
              print_of: originalPart.part.print_of
            })
            console.log(`부품 ${embedding.part_num} lego_parts 테이블 저장 완료`)
          }
          
          // 2단계: 색상 데이터를 lego_colors 테이블에 저장
          if (originalPart?.color) {
            const { saveLegoColor } = useDatabase()
            await saveLegoColor({
              id: originalPart.color.id,
              name: originalPart.color.name,
              rgb: originalPart.color.rgb,
              is_trans: originalPart.color.is_trans,
              external_ids: originalPart.color.external_ids
            })
            console.log(`색상 ${originalPart.color.id} lego_colors 테이블 저장 완료`)
          }
          
          // 2.5단계: 부품 이미지를 Supabase Storage에 저장
          if (originalPart?.part?.part_img_url) {
            const { uploadImageFromUrl, saveImageMetadata } = useImageManager()
            try {
              const imageResult = await uploadImageFromUrl(
                originalPart.part.part_img_url,
                `${originalPart.part.part_num}_${originalPart.color.id}.webp`,
                'lego_parts_images'
              )
              
              // 이미지 메타데이터 저장
              await saveImageMetadata({
                original_url: originalPart.part.part_img_url,
                supabase_url: imageResult.url,
                file_path: imageResult.path,
                file_name: `${originalPart.part.part_num}_${originalPart.color.id}.webp`,
                part_num: originalPart.part.part_num,
                color_id: originalPart.color.id,
                set_num: targetSetNumber.value
              })
              
              console.log(`부품 이미지 저장 완료: ${originalPart.part.part_num}`)
            } catch (imageError) {
              console.error(`부품 이미지 저장 실패: ${originalPart.part.part_num}`, imageError)
              // 이미지 저장 실패해도 계속 진행
            }
          }
          
          // 3단계: 세트 정보를 lego_sets 테이블에 저장 (한 번만)
          if (index === 0) { // 첫 번째 부품에서만 세트 정보 저장
            const { saveLegoSet } = useDatabase()
            const setData = {
              set_num: targetSetNumber.value,
              name: setSetInfo.value?.name || `LEGO Set ${targetSetNumber.value}`,
              year: setSetInfo.value?.year || new Date().getFullYear(),
              theme_id: setSetInfo.value?.theme_id || null,
              num_parts: setParts.value.length,
              set_img_url: setSetInfo.value?.set_img_url || null,
              set_url: setSetInfo.value?.set_url || null,
              last_modified_dt: setSetInfo.value?.last_modified_dt || new Date().toISOString()
            }
            await saveLegoSet(setData)
            console.log(`세트 ${targetSetNumber.value} lego_sets 테이블 저장 완료`)
          }
          
          // 4단계: 세트-부품 관계를 set_parts 테이블에 저장
          const { saveSetPart } = useDatabase()
          await saveSetPart(
            null, // set_id는 UUID이므로 null로 설정 (실제로는 세트 ID 필요)
            originalPart.part.part_num,
            originalPart.color.id, // color_id는 integer
            originalPart.quantity || 1,
            originalPart.is_spare || false,
            originalPart.element_id,
            originalPart.num_sets || 1
          )
          console.log(`세트-부품 관계 저장 완료: ${embedding.part_num}`)
          
          // 5단계: 분석 결과와 임베딩을 결합하여 마스터 특징 저장
          const analysis = setAnalysisResults.value.find(a => a.part_num === embedding.part_num)
          const combinedResult = {
            ...analysis,
            clip_text_emb: embedding.embedding,
            part: originalPart?.part,
            color: originalPart?.color
          }
          
          const saved = await saveToMasterPartsDB([combinedResult])
          console.log(`세트 부품 ${globalIndex}/${total} 마스터 특징 저장 완료: ${embedding.part_num}`)
          return saved
        } catch (error) {
          console.error(`부품 ${embedding.part_num} DB 저장 실패:`, error)
          return { part_num: embedding.part_num, error: error.message }
        }
      })
      
      // 배치 완료 대기
      const batchResults = await Promise.all(batchPromises)
      allResults.push(...batchResults)
      
      console.log(`DB 저장 배치 ${batchNumber}/${totalBatches} 완료: ${batchResults.filter(r => !r.error).length}개 성공`)
      
        // DB 부하 방지를 위한 짧은 대기
        if (i + batchSize < needsSaving.length) {
          await new Promise(resolve => setTimeout(resolve, 200)) // 200ms 대기
        }
      }
    } else {
      console.log(`⏭️ 모든 부품이 이미 데이터베이스에 저장되어 있습니다.`)
    }
    
    // 중첩 배열 구조를 평면화
    const results = allResults.flat()

    console.log('🔍 최종 results 구조 확인:', results.slice(0, 2))
    setSavedRecords.value = results
    
    // DB 저장 결과 통계
    const savedCount = results.filter(r => !r.error).length
    const failedCount = results.filter(r => r.error).length
    
    console.log(`세트 ${targetSetNumber.value} DB 저장 완료: ${results.length}개`)
    console.log(`💾 저장 성공: ${savedCount}개, ❌ 저장 실패: ${failedCount}개`)
    
    if (savedCount > 0) {
      console.log('🎉 마스터 데이터베이스 구축 완료!')
      console.log(`📊 총 ${savedCount}개 부품의 특징 데이터가 저장되었습니다.`)
    }
  } catch (error) {
    console.error('세트 데이터 DB 저장 실패:', error)
    throw error
  }
}

// 이미지 로딩 에러 처리 (NewLegoRegistration.vue와 동일한 로직)
const handleImageError = (event) => {
  console.error('이미지 로딩 실패:', event.target.src)
  
  // NewLegoRegistration.vue와 동일하게 플레이스홀더 이미지로 대체
  event.target.src = '/placeholder-image.png'
  event.target.alt = '이미지를 불러올 수 없습니다'
}

// 부품 이미지 URL 가져오기 (NewLegoRegistration.vue와 동일한 로직)
const getPartImageUrl = (record) => {
  // NewLegoRegistration.vue와 동일하게 Rebrickable 원본 이미지 URL 사용
  const partId = record.part_id || record.part_num || record.partId
  
  if (!partId) {
    console.warn('⚠️ partId가 undefined:', record)
    return null
  }
  
  // Supabase Storage에서 이미지 URL 생성
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const bucketName = 'lego_parts_images'
  const fileName = `${partId}_${record.color_id}.webp`
  
  if (supabaseUrl) {
    const url = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
    console.log('✅ Supabase URL 생성:', url)
    return url
  }
  
  // Supabase URL이 없으면 Rebrickable URL 사용
  const rebrickableUrl = `https://cdn.rebrickable.com/media/parts/elements/${partId}.webp`
  console.log('⚠️ Rebrickable URL 사용:', rebrickableUrl)
  return rebrickableUrl
}

// 전체 프로세스
const buildCompleteDatabase = async () => {
  try {
    successMessage.value = ''
    error.value = null
    
    console.log('Starting complete database build...')
    const result = await buildMasterPartsDatabase()
    
    // 결과 업데이트
    allParts.value = result.totalParts
    analysisResults.value = result.analyzedParts
    embeddingResults.value = result.savedRecords
    savedRecords.value = result.savedRecords
    
    // 진행률 업데이트
    collectionProgress.value = 100
    analysisProgress.value = 100
    embeddingProgress.value = 100
    overallProgress.value = 100
    
    successMessage.value = `마스터 데이터베이스 구축이 완료되었습니다! 총 ${result.savedRecords}개 레코드가 저장되었습니다.`
  } catch (err) {
    console.error('Complete build failed:', err)
    error.value = err.message
  }
}

// 메타데이터 표시값 헬퍼 함수
const getDisplayValue = (value) => {
  if (!value || value === '' || value === 'unknown') {
    return '정보 없음'
  }
  
  // 영문 값을 한글로 변환
  const translations = {
    'plate': '플레이트',
    'brick': '브릭',
    'tile': '타일',
    'slope': '경사',
    'round': '둥근',
    'technic': '테크닉',
    'hinge': '힌지',
    'clip': '클립',
    'bar': '막대',
    'connector': '연결',
    'wedge': '쐐기',
    'panel': '패널',
    'system': '시스템',
    'duplo': '듀플로',
    'stud': '스터드',
    'tube': '튜브',
    'solid_tube': '단단한 튜브',
    'hollow': '속이 빈',
    'reinforced': '보강된'
  }
  
  return translations[value.toLowerCase()] || value
}
</script>

<style scoped>
.master-data-builder {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  color: #333;
  margin-bottom: 10px;
}

.header p {
  color: #666;
  font-size: 1.1rem;
}

.set-specific-section {
  margin-bottom: 30px;
}

.divider {
  text-align: center;
  margin: 30px 0;
  position: relative;
}

.divider hr {
  border: none;
  height: 1px;
  background: #ddd;
  margin: 0;
}

.divider span {
  background: white;
  padding: 0 20px;
  color: #666;
  position: relative;
  top: -10px;
}

.builder-section {
  display: grid;
  gap: 20px;
  margin-bottom: 40px;
}

.card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.card h2 {
  color: #333;
  margin-bottom: 10px;
}

.performance-info {
  margin-top: 10px;
  padding: 8px;
  background: #f0f8ff;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  color: #0066cc;
  text-align: center;
}

.card p {
  color: #666;
  margin-bottom: 15px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #1e7e34;
}

.btn-warning {
  background-color: #ffc107;
  color: #212529;
}

.btn-warning:hover:not(:disabled) {
  background-color: #e0a800;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: #138496;
}

.btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.progress {
  margin-top: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  height: 20px;
  position: relative;
  overflow: hidden;
}

.progress-bar {
  background-color: #007bff;
  height: 100%;
  transition: width 0.3s ease;
}

.progress span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 0.9rem;
}

.status-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-help {
  display: block;
  margin-top: 5px;
  color: #666;
  font-size: 0.9rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: white;
  border-radius: 5px;
  border: 1px solid #ddd;
}

.status-item .label {
  font-weight: bold;
  color: #333;
}

.status-item .value {
  color: #007bff;
  font-weight: bold;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
  padding: 15px;
  margin-top: 20px;
}

.success-message {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  border-radius: 5px;
  padding: 15px;
  margin-top: 20px;
}

/* 결과 표시 섹션 */
.results-section {
  margin-top: 30px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.result-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.part-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.part-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
}

.part-badge {
  display: flex;
  gap: 8px;
}

.part-id, .color-id {
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.part-id {
  color: #007bff;
}

.color-id {
  color: #28a745;
}

/* 부품 이미지 컨테이너 */
.part-image-container {
  position: relative;
  margin: 10px 0;
}

.part-image {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.part-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.part-image img:hover {
  transform: scale(1.05);
}

/* 이미지 없음 플레이스홀더 */
.no-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 150px;
  background: #f8f9fa;
  border: 2px dashed #dee2e6;
  border-radius: 4px;
  text-align: center;
  color: #6c757d;
}

.placeholder-icon {
  font-size: 2rem;
  margin-bottom: 10px;
}

/* 메타데이터 툴팁 */
.metadata-tooltip {
  position: absolute;
  top: 0;
  left: 100%;
  margin-left: 10px;
  z-index: 1000;
  width: 350px;
  max-height: 400px;
  overflow-y: auto;
}

.tooltip-content {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.tooltip-content h5 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.metadata-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 15px;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.metadata-item .label {
  font-size: 12px;
  color: #666;
  font-weight: bold;
}

.metadata-item .value {
  font-size: 12px;
  color: #333;
}

.metadata-item .value.confidence {
  color: #28a745;
  font-weight: bold;
}

.feature-description {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e0e0e0;
}

.feature-description h6 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #333;
}

.feature-description p {
  margin: 0;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.recognition-hints {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e0e0e0;
}

.recognition-hints h6 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #333;
}

.hint-item {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.4;
}

.hint-item strong {
  color: #333;
}

.part-info {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 14px;
}

.part-info p {
  margin: 5px 0;
}
</style>
