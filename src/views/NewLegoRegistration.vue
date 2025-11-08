<template>
  <div class="lego-set-manager">
    <div class="header">
      <h1>신규 레고 등록</h1>
      <p>Rebrickable API를 통해 새로운 레고 세트를 검색하고 데이터베이스에 등록합니다.</p>
    </div>

    <!-- 세트 검색 -->
    <div class="search-section">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="레고 세트 번호 또는 이름을 검색하세요..."
          @keyup.enter="searchSets"
          class="search-input"
        />
        <button @click="searchSets" :disabled="loading" class="search-btn">
          {{ loading ? '검색 중...' : '검색' }}
        </button>
      </div>
      
      <!-- LLM 분석 옵션 -->
      <div class="master-data-option">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="skipLLMAnalysis"
            :disabled="loading || processing"
          />
          <span class="checkmark"></span>
          ⚡ 빠른 저장 (LLM 분석 + CLIP 임베딩 건너뛰기)
        </label>
        <small class="form-help">
          체크하면 기본 데이터만 저장하고 LLM 분석 + CLIP 임베딩을 건너뜁니다. (기본값: 체크 해제 = 자동 LLM 분석 + CLIP 임베딩 실행)
        </small>
      </div>
    </div>

    <!-- 검색 결과 (단일 제품 번호가 아닌 경우에만 표시) -->
    <div v-if="searchResults.length > 0 && !isSingleSetNumber(searchQuery)" class="search-results">
      <h3>검색 결과 ({{ searchResults.length }}개)</h3>
      <div class="data-source-info">
        <span v-if="isLocalData" class="source-badge local">📁 로컬 데이터베이스</span>
        <span v-else class="source-badge api">🌐 Rebrickable API</span>
      </div>
      <div class="sets-grid">
        <div 
          v-for="set in searchResults" 
          :key="set.set_num"
          class="set-card"
          :class="{ 'existing-set': set.isExisting }"
          @click="selectSet(set)"
        >
          <div class="set-image">
            <img 
              :src="set.set_img_url" 
              :alt="set.name"
              @error="handleImageError"
            />
            <div v-if="set.isExisting" class="duplicate-badge">
              <span class="duplicate-icon">⚠️</span>
              <span class="duplicate-text">이미 등록됨</span>
            </div>
          </div>
          <div class="set-info">
            <h4>{{ set.name }}</h4>
            <p class="set-number">{{ set.set_num }}</p>
            <p class="set-year">{{ set.year }}</p>
            <p class="set-pieces">{{ set.num_parts }}개 부품</p>
            <div v-if="set.isExisting" class="duplicate-info">
              <p class="duplicate-date">등록일: {{ new Date(set.existingData.created_at).toLocaleDateString() }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 선택된 세트 상세 정보 -->
    <div v-if="selectedSet" class="selected-set">
      <div class="set-details">
        <div class="set-main-info">
          <img :src="selectedSet.set_img_url" :alt="selectedSet.name" class="set-large-image" />
          <div class="set-details-text">
            <h2>{{ selectedSet.name }}</h2>
            <p><strong>세트 번호:</strong> {{ selectedSet.set_num }}</p>
            <p><strong>연도:</strong> {{ selectedSet.year }}</p>
            <p><strong>부품 수:</strong> {{ selectedSet.num_parts }}개</p>
            <p><strong>테마:</strong> {{ selectedSet.theme_id }}</p>
            <div class="action-buttons">
              <button @click="saveSetBatch" :disabled="saving" class="btn btn-secondary">
                {{ saving ? '배치 저장 중...' : '⚡ 빠른 배치 저장' }}
              </button>
              <button @click="forceResaveSet" :disabled="saving" class="btn btn-warning">
                {{ saving ? '재저장 중...' : '강제 재저장 (기존 데이터 삭제 후 저장)' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 부품 목록 -->
      <div v-if="setParts.length > 0" class="parts-section">
        <h3 v-if="partsStats">
          부품 목록 {{ partsStats.totalTypes }}종, {{ partsStats.nonSpareQuantity }}개
          <span v-if="partsStats.spareCount > 0" class="spare-info">, 스페어부품 {{ partsStats.spareCount }}개</span>
          <span v-if="partsCountValidation" class="validation-info" :class="{ 'match': partsCountValidation.isMatch, 'mismatch': !partsCountValidation.isMatch }">
            {{ partsCountValidation.isMatch ? '✅ 부품 수량 일치' : '⚠️ 부품 수량 불일치' }}
          </span>
          - API에서 로드됨
        </h3>
        <h3 v-else>부품 목록 ({{ setParts.length }}개) - API에서 로드됨</h3>
        <div class="parts-controls">
          <button @click="downloadAllPartImages" :disabled="downloading" class="btn btn-success">
            {{ downloading ? '이미지 다운로드 중...' : '모든 부품 이미지 다운로드' }}
          </button>
          <button @click="exportPartsData" class="btn btn-info">
            부품 데이터 내보내기
          </button>
        </div>
        
        <!-- 일반 부품 섹션 -->
        <div v-if="categorizedParts && categorizedParts.regularParts.length > 0" class="parts-category">
          <h4 class="category-title regular-title">🧱 일반 부품 ({{ categorizedParts.regularParts.length }}종)</h4>
          <div class="parts-grid">
            <div 
              v-for="part in categorizedParts.regularParts" 
              :key="`${part.part.part_num}-${part.color_id}`"
              class="part-card"
            >
              <div class="part-image">
                <img 
                  :src="part.part.part_img_url" 
                  :alt="part.part.name"
                  @error="handleImageError"
                />
              </div>
              <div class="part-info">
                <h4>{{ part.part.name }}</h4>
                <p><strong>부품 번호:</strong> {{ part.part.part_num }}</p>
                <p><strong>색상:</strong> {{ part.color.name }}</p>
                <p><strong>수량:</strong> {{ part.quantity }}개</p>
                <div class="part-actions">
                  <button 
                    @click="downloadPartImage(part)" 
                    :disabled="downloading"
                    class="btn btn-sm btn-primary"
                  >
                    이미지 다운로드
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 미니피규어 섹션 -->
        <div v-if="setMinifigs && setMinifigs.length > 0" class="parts-category">
          <h4 class="category-title minifig-title">🧸 미니피규어 ({{ setMinifigs.length }}종)</h4>
          <div class="parts-grid">
            <div 
              v-for="minifig in setMinifigs" 
              :key="minifig.set_num"
              class="part-card minifig-card"
            >
              <div class="part-image">
                <img 
                  v-if="minifig.set_img_url"
                  :src="minifig.set_img_url" 
                  :alt="minifig.name"
                  @error="handleImageError"
                />
                <div 
                  v-if="!minifig.set_img_url" 
                  class="no-image"
                >
                  <div class="no-image-icon">🧸</div>
                  <div class="no-image-text">이미지 없음</div>
                </div>
                <div 
                  v-else
                  class="no-image" 
                  style="display: none;"
                >
                  <div class="no-image-icon">🧸</div>
                  <div class="no-image-text">이미지 로딩 실패</div>
                </div>
              </div>
              <div class="part-info">
                <h4>{{ minifig.name }}</h4>
                <p><strong>미니피규어 번호:</strong> {{ minifig.set_num }}</p>
                <p><strong>부품 수:</strong> {{ minifig.num_parts }}개</p>
                <div class="part-actions">
                  <a 
                    v-if="minifig.set_url" 
                    :href="minifig.set_url" 
                    target="_blank" 
                    class="btn btn-sm btn-info"
                  >
                    상세 보기
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 스페어 부품 섹션 -->
        <div v-if="categorizedParts && categorizedParts.spareParts.length > 0" class="parts-category">
          <h4 class="category-title spare-title">🔧 스페어 부품 ({{ categorizedParts.spareParts.length }}종)</h4>
          <div class="parts-grid">
            <div 
              v-for="part in categorizedParts.spareParts" 
              :key="`${part.part.part_num}-${part.color_id}`"
              class="part-card spare-card"
            >
              <div class="part-image">
                <img 
                  :src="part.part.part_img_url" 
                  :alt="part.part.name"
                  @error="handleImageError"
                />
              </div>
              <div class="part-info">
                <h4>{{ part.part.name }}</h4>
                <p><strong>부품 번호:</strong> {{ part.part.part_num }}</p>
                <p><strong>색상:</strong> {{ part.color.name }}</p>
                <p><strong>수량:</strong> {{ part.quantity }}개</p>
                <p class="spare-part"><strong>스페어 부품</strong></p>
                <div class="part-actions">
                  <button 
                    @click="downloadPartImage(part)" 
                    :disabled="downloading"
                    class="btn btn-sm btn-primary"
                  >
                    이미지 다운로드
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 에러 메시지 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 성공 메시지 -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- 진행률 모달 -->
    <div v-if="showProgressModal" class="progress-modal-overlay"> <!-- // 🔧 수정됨: 오버레이 클릭으로 닫힘 방지 -->
      <div class="progress-modal" @click.stop>
        <div class="progress-modal-header">
          <h3>🚀 처리 진행 중...</h3>
          <button @click="closeProgressModal" class="close-btn">&times;</button>
        </div>
        
        <div class="progress-modal-content">
          <!-- 배치 처리 진행률 -->
          <div v-if="batchLoading" class="progress-section">
            <h4>⚡ 배치 처리 중...</h4>
            <div class="progress">
              <div class="progress-bar" :style="{ width: batchProgress + '%' }"></div>
              <span>{{ batchProgress }}%</span>
            </div>
            <small>{{ batchCurrentStep }}</small>
            <div v-if="batchError" class="processing-errors">
              <small>오류: {{ batchError }}</small>
            </div>
          </div>

          <!-- LLM 분석 진행률 -->
          <div v-if="!skipLLMAnalysis && masterDataProgress > 0" class="progress-section">
            <h4>🤖 AI 메타데이터 생성 중...</h4>
            <div class="progress">
              <div class="progress-bar" :style="{ width: masterDataProgress + '%' }"></div>
              <span>{{ masterDataProgress }}%</span>
            </div>
            <small>LLM 분석 및 CLIP 임베딩 생성 중... (고품질 메타데이터)</small>
          </div>

          <!-- 백그라운드 작업 상태 -->
          <div v-if="runningTasks.length > 0" class="progress-section">
            <h4>🔄 백그라운드 작업 중</h4>
            <div v-for="task in runningTasks" :key="task.id" class="task-item">
              <div class="task-info">
                <span class="task-name">{{ task.name }}</span>
                <span class="task-progress">{{ task.current }}/{{ task.total }} ({{ task.progress }}%)</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
              </div>
            </div>
          </div>

          <!-- 백그라운드 LLM 분석 상태 -->
          <div v-if="llmRunningTasks.length > 0" class="progress-section">
            <h4>🤖 LLM 분석 진행 중</h4>
            <div class="queue-status">
              <span>대기: {{ queueStatus.pending }} | 실행: {{ queueStatus.running }} | 완료: {{ queueStatus.completed }} | 실패: {{ queueStatus.failed }}</span>
            </div>
            <div v-for="task in llmRunningTasks" :key="task.id" class="llm-task-item">
              <div class="task-info">
                <span class="task-name">{{ task.setName }} ({{ task.setNum }})</span>
                <span class="task-progress">{{ task.processedParts }}/{{ task.totalParts }} ({{ task.progress }}%)</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
              </div>
              <div v-if="task.errors.length > 0" class="task-errors">
                <small v-for="error in task.errors" :key="error">{{ error }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import { useRebrickable } from '../composables/useRebrickable'
import { useImageManager } from '../composables/useImageManager'
import { useDatabase } from '../composables/useDatabase'
import { useBackgroundTasks } from '../composables/useBackgroundTasks'
import { supabase } from '../composables/useSupabase'
import { 
  analyzePartWithLLM, 
  generateTextEmbeddingsBatch, 
  saveToMasterPartsDB,
  checkExistingAnalysis 
} from '../composables/useMasterPartsPreprocessing'
import { useBackgroundLLMAnalysis } from '../composables/useBackgroundLLMAnalysis'
import { useBatchProcessing } from '../composables/useBatchProcessing'
import { useAutoImageMigration } from '../composables/useAutoImageMigration'
import { waitForMigrationComplete } from '../composables/useMigrationStatus'
import { useSlackAlert } from '../composables/useSlackAlert'

export default {
  name: 'LegoSetManager',
  setup() {
    const { 
      loading, 
      error, 
      searchSets: searchSetsAPI, 
      getSet, 
      getSetParts: getSetPartsAPI,
      getSetMinifigs
    } = useRebrickable()
    
    const { 
      downloading, 
      processRebrickableImage, 
      processMultipleImages,
      saveImageMetadata,
      uploadImageFromUrl
    } = useImageManager()

    const {
      saveLegoSet,
      saveLegoPart,
      saveLegoColor,
      saveSetPart,
      savePartImage,
      saveOperationLog,
      getLegoSets,
      getSetParts,
      checkSetExists,
      checkMultipleSetsExist,
      deleteSetAndParts
    } = useDatabase()

    const {
      startBackgroundTask,
      updateTaskProgress,
      completeTask,
      failTask,
      getRunningTasks
    } = useBackgroundTasks()

    const {
      startBackgroundAnalysis,
      getRunningTasks: getLLMRunningTasks,
      getTaskStatus,
      getQueueStatus,
      isProcessing: isLLMProcessing
    } = useBackgroundLLMAnalysis()

    const {
      batchProcessSet,
      loading: batchLoading,
      progress: batchProgress,
      currentStep: batchCurrentStep,
      error: batchError
    } = useBatchProcessing()

    const {
      alertMigrationFailed,
      alertBatchProcessingFailed
    } = useSlackAlert()

    const searchQuery = ref('')
    const searchResults = ref([])
    const selectedSet = ref(null)
    const setParts = ref([])
    const loadingParts = ref(false)
    const saving = ref(false)
    const successMessage = ref('')
    const isLocalData = ref(false)
    const existingSets = ref(new Set()) // 이미 등록된 세트 번호들을 저장
    const partsCountValidation = ref(null) // 부품 수량 검증 정보
    const partsStats = ref(null) // 부품 통계 정보
    const categorizedParts = ref(null) // 부품 분류 정보
    const setMinifigs = ref([]) // 세트의 미니피규어 정보
    const skipLLMAnalysis = ref(false) // LLM 분석 건너뛰기 옵션 (기본값: false = LLM 분석 실행)
    const masterDataProgress = ref(0) // LLM 분석 진행률
    const processing = ref(false) // 전체 처리 상태
    const showProgressModal = ref(false) // 진행률 모달 표시 여부

    // 단일 제품 번호인지 확인하는 함수
    const isSingleSetNumber = (query) => {
      const trimmedQuery = query.trim()
      // 레고 세트 번호 패턴: 숫자로만 구성되고 3-6자리, 선택적으로 하이픈과 버전 번호 포함
      // 예: "60315", "60315-1", "10497-1"
      const setNumberPattern = /^\d{3,6}(-\d+)?$/
      return setNumberPattern.test(trimmedQuery)
    }

    // 세트 번호를 Rebrickable API 형식으로 변환
    const formatSetNumber = (setNum) => {
      // 이미 -1이 포함되어 있으면 그대로 반환
      if (setNum.includes('-')) {
        return setNum
      }
      // -1 접미사 추가
      return `${setNum}-1`
    }

    // 부품 수량 합계 계산 (스페어 부품 제외)
    const calculatePartsTotal = (parts) => {
      if (!parts || parts.length === 0) return 0
      
      return parts.reduce((total, part) => {
        // 스페어 부품이 아닌 경우에만 수량 추가
        if (!part.is_spare) {
          return total + (part.quantity || 0)
        }
        return total
      }, 0)
    }

    // 부품 수량 검증
    const validatePartsCount = (setInfo, parts) => {
      const expectedCount = setInfo.num_parts || 0
      const actualCount = calculatePartsTotal(parts)
      const spareCount = parts ? parts.filter(part => part.is_spare).length : 0
      
      return {
        expected: expectedCount,
        actual: actualCount,
        spare: spareCount,
        isMatch: expectedCount === actualCount,
        difference: expectedCount - actualCount
      }
    }

    // 부품 통계 계산
    const calculatePartsStats = (parts) => {
      if (!parts || parts.length === 0) {
        return {
          totalTypes: 0,
          totalQuantity: 0,
          spareCount: 0,
          nonSpareQuantity: 0
        }
      }

      const totalTypes = parts.length
      const totalQuantity = parts.reduce((sum, part) => sum + (part.quantity || 0), 0)
      const spareCount = parts.filter(part => part.is_spare).length
      const nonSpareQuantity = parts.reduce((sum, part) => {
        // 스페어 부품이 아닌 경우에만 수량 추가
        if (!part.is_spare) {
          return sum + (part.quantity || 0)
        }
        return sum
      }, 0)

      return {
        totalTypes,
        totalQuantity,
        spareCount,
        nonSpareQuantity
      }
    }

    // 미니피규어와 스페어 부품 구분 (API 기반)
    const categorizeParts = (parts, minifigs) => {
      if (!parts || parts.length === 0) {
        return {
          minifigures: [],
          spareParts: [],
          regularParts: []
        }
      }

      // API에서 가져온 미니피규어 정보 사용
      const minifigures = minifigs || []
      const spareParts = parts.filter(part => part.is_spare)
      const regularParts = parts.filter(part => !part.is_spare)

      return {
        minifigures,
        spareParts,
        regularParts
      }
    }

    const searchSets = async () => {
      if (!searchQuery.value.trim()) return
      
      try {
        const query = searchQuery.value.trim()
        
        // 단일 제품 번호인지 확인
        if (isSingleSetNumber(query)) {
          console.log('Single set number detected, fetching directly...')
          
          try {
            // 세트 번호를 Rebrickable API 형식으로 변환
            const formattedSetNum = formatSetNumber(query)
            console.log(`Formatted set number: ${query} -> ${formattedSetNum}`)
            
            // 중복 확인 (원본 번호로 확인)
            const existingSet = await checkSetExists(query)
            
            // 바로 세트 정보 가져오기 (변환된 번호로)
            const setData = await getSet(formattedSetNum)
            
            // 중복 정보 추가
            const setWithDuplicateInfo = {
              ...setData,
              isExisting: !!existingSet,
              existingData: existingSet
            }
            
            // 중복된 세트인지 확인
            if (setWithDuplicateInfo.isExisting) {
              const confirmMessage = `"${setData.name}" (${setData.set_num}) 세트는 이미 데이터베이스에 등록되어 있습니다.\n등록일: ${new Date(existingSet.created_at).toLocaleDateString()}\n\n계속 진행하시겠습니까?`
              if (!confirm(confirmMessage)) {
                return
              }
            }
            
            // 바로 세트 선택 처리
            selectedSet.value = setData
            setParts.value = []
            searchResults.value = [] // 검색 결과 목록은 비우기
            isLocalData.value = false
            
            // 자동으로 부품 목록 로드
            console.log('Auto-loading parts for direct set selection...')
            await loadSetParts()
            
            console.log('Direct set selection completed')
            return
          } catch (setError) {
            console.error('Failed to fetch set:', setError)
            if (setError.message.includes('404')) {
              error.value = `세트 번호 "${query}"에 해당하는 레고 세트를 찾을 수 없습니다. 올바른 세트 번호인지 확인해주세요.`
            } else {
              error.value = `세트 정보를 가져오는 중 오류가 발생했습니다: ${setError.message}`
            }
            return
          }
        }
        
        // 일반 검색 (여러 결과)
        console.log('Searching Rebrickable API...')
        const result = await searchSetsAPI(searchQuery.value)
        const apiResults = result.results || []
        
        // 검색 결과가 없는 경우
        if (apiResults.length === 0) {
          searchResults.value = []
          error.value = `"${query}"에 대한 검색 결과가 없습니다. 다른 키워드로 검색해보세요.`
          return
        }
        
        // 검색 결과에서 중복 확인
        console.log('Checking for existing sets in database...')
        const setNums = apiResults.map(set => set.set_num)
        const existingSetsData = await checkMultipleSetsExist(setNums)
        
        // 이미 등록된 세트 번호들을 Set에 저장
        existingSets.value = new Set(existingSetsData.map(set => set.set_num))
        console.log('Existing sets found:', Array.from(existingSets.value))
        
        // 검색 결과에 중복 정보 추가
        searchResults.value = apiResults.map(set => ({
          ...set,
          isExisting: existingSets.value.has(set.set_num),
          existingData: existingSetsData.find(existing => existing.set_num === set.set_num)
        }))
        
        isLocalData.value = false
        
        // TODO: 데이터베이스 스키마 생성 후 로컬 검색 활성화
        // 1. 먼저 Supabase에서 검색
        // const localResults = await searchLocalSets(searchQuery.value)
        // if (localResults.length > 0) {
        //   searchResults.value = localResults
        //   isLocalData.value = true
        //   console.log('Found in local database:', localResults.length, 'sets')
        // } else {
        //   // 2. 로컬에 없으면 Rebrickable API에서 검색
        //   console.log('Not found locally, searching Rebrickable API...')
        //   const result = await searchSetsAPI(searchQuery.value)
        //   searchResults.value = result.results || []
        //   isLocalData.value = false
        // }
      } catch (err) {
        console.error('Search failed:', err)
        error.value = `검색 중 오류가 발생했습니다: ${err.message}`
      }
    }

    // 로컬 데이터베이스에서 세트 검색
    const searchLocalSets = async (query) => {
      try {
        const { data, error } = await supabase
          .from('lego_sets')
          .select('*')
          .or(`set_num.ilike.%${query}%,name.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) throw error
        return data || []
      } catch (err) {
        console.error('Local search failed:', err)
        return []
      }
    }

    const selectSet = async (set) => {
      try {
        // 중복된 세트인지 확인
        if (set.isExisting) {
          const confirmMessage = `"${set.name}" (${set.set_num}) 세트는 이미 데이터베이스에 등록되어 있습니다.\n등록일: ${new Date(set.existingData.created_at).toLocaleDateString()}\n\n계속 진행하시겠습니까?`
          if (!confirm(confirmMessage)) {
            return
          }
        }
        
        // 임시로 API에서만 가져오기 (데이터베이스 스키마 생성 후 로컬 검색 활성화)
        console.log('Fetching from Rebrickable API...')
        const result = await getSet(set.set_num)
        selectedSet.value = result
        setParts.value = []
        
        // 자동으로 부품 목록 로드
        console.log('Auto-loading parts for set selection...')
        await loadSetParts()
        
        // TODO: 데이터베이스 스키마 생성 후 로컬 검색 활성화
        // 1. 먼저 로컬 데이터베이스에서 확인
        // const localSet = await getLocalSet(set.set_num)
        // if (localSet) {
        //   selectedSet.value = localSet
        //   console.log('Loaded from local database')
        //   // 로컬 부품 정보도 로드
        //   const localParts = await getLocalSetParts(localSet.id)
        //   setParts.value = localParts
        // } else {
        //   // 2. 로컬에 없으면 Rebrickable API에서 가져오기
        //   console.log('Not found locally, fetching from Rebrickable API...')
        //   const result = await getSet(set.set_num)
        //   selectedSet.value = result
        //   setParts.value = []
        // }
      } catch (err) {
        console.error('Failed to get set details:', err)
        error.value = `세트 정보를 가져오는 중 오류가 발생했습니다: ${err.message}`
      }
    }

    // 로컬 데이터베이스에서 세트 정보 가져오기
    const getLocalSet = async (setNum) => {
      try {
        const { data, error } = await supabase
          .from('lego_sets')
          .select('*')
          .eq('set_num', setNum)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') throw error
        return data
      } catch (err) {
        console.error('Failed to get local set:', err)
        return null
      }
    }

    // 로컬 데이터베이스에서 세트 부품 정보 가져오기
    const getLocalSetParts = async (setId) => {
      try {
        const { data, error } = await supabase
          .from('set_parts')
          .select(`
            *,
            lego_parts(*),
            lego_colors(*)
          `)
          .eq('set_id', setId)

        if (error) throw error
        return data || []
      } catch (err) {
        console.error('Failed to get local set parts:', err)
        return []
      }
    }

    const loadSetParts = async () => {
      if (!selectedSet.value) return
      
      loadingParts.value = true
      try {
        console.log(`Loading all parts for set ${selectedSet.value.set_num}...`)
        
        // ✅ 부품과 미니피규어 정보를 병렬로 로드 (성능 개선)
        const [partsResult, minifigsResult] = await Promise.allSettled([
          getSetPartsAPI(selectedSet.value.set_num),
          getSetMinifigs(selectedSet.value.set_num)
        ])
        
        // 부품 정보 처리
        if (partsResult.status === 'fulfilled') {
          setParts.value = partsResult.value.results || []
          console.log(`✅ Loaded ${setParts.value.length} parts`)
        } else {
          console.error('❌ Failed to load parts:', partsResult.reason)
          setParts.value = []
        }
        
        // 미니피규어 정보 처리
        if (minifigsResult.status === 'fulfilled') {
          setMinifigs.value = minifigsResult.value.results || []
          console.log(`✅ Loaded ${setMinifigs.value.length} minifigs`)
        } else {
          console.log('ℹ️ No minifigs found for this set:', minifigsResult.reason?.message)
          setMinifigs.value = []
        }
        
        // 부품 수량 검증
        partsCountValidation.value = validatePartsCount(selectedSet.value, setParts.value)
        console.log('Parts count validation:', partsCountValidation.value)
        
        // 부품 통계 계산
        partsStats.value = calculatePartsStats(setParts.value)
        console.log('Parts stats:', partsStats.value)
        
        // 부품 분류 (미니피규어 정보 포함)
        categorizedParts.value = categorizeParts(setParts.value, setMinifigs.value)
        console.log('Categorized parts:', categorizedParts.value)
      } catch (err) {
        console.error('Failed to load parts:', err)
        error.value = `부품 로딩 중 오류가 발생했습니다: ${err.message}`
      } finally {
        loadingParts.value = false
      }
    }

    const downloadPartImage = async (part) => {
      try {
        console.log(`🖼️ Downloading image for part ${part.part.part_num}...`)
        const result = await processRebrickableImage(
          part.part.part_img_url,
          part.part.part_num,
          part.color.id
        )
        
        console.log(`🖼️ Image processing result:`, result)
        
        // 이미지 메타데이터를 Supabase에 저장
        if (result.uploadedUrl) {
          console.log(`💾 Saving image metadata for ${part.part.part_num}...`)
          await saveImageMetadata({
            original_url: part.part.part_img_url,
            supabase_url: result.uploadedUrl,
            file_path: result.path,
            file_name: result.filename,
            part_num: part.part.part_num,
            color_id: part.color.id,
            set_num: selectedSet.value?.set_num
          })
          console.log(`✅ Image metadata saved for ${part.part.part_num}`)
        } else {
          console.log(`❌ No uploaded URL for ${part.part.part_num}, skipping metadata save`)
        }
        
        console.log('Image processed:', result)
        
        if (result.isDuplicate) {
          successMessage.value = `부품 ${part.part.part_num} 이미지가 이미 존재합니다. (파일명 중복으로 건너뛰기)`
        } else if (result.isLocal) {
          successMessage.value = `부품 ${part.part.part_num} 이미지가 로컬에 저장되었습니다. (서버 업로드 대기 중)`
        } else {
          successMessage.value = `부품 ${part.part.part_num} 이미지가 성공적으로 업로드되었습니다.`
        }
      } catch (err) {
        console.error('Failed to process image:', err)
        error.value = `이미지 처리 중 오류가 발생했습니다: ${err.message}`
      }
    }

    const downloadAllPartImages = async () => {
      if (setParts.value.length === 0) return
      
      // downloading 상태는 useImageManager에서 자동 관리됨
      successMessage.value = ''
      error.value = ''
      
      try {
        console.log(`🖼️ Starting bulk image download for ${setParts.value.length} parts...`)
        
        // ✅ 배치 병렬 처리 (10개씩)
        const BATCH_SIZE = 10
        const batches = []
        for (let i = 0; i < setParts.value.length; i += BATCH_SIZE) {
          batches.push(setParts.value.slice(i, i + BATCH_SIZE))
        }
        
        const results = []
        const errors = []
        let processedCount = 0
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex]
          console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} images)...`)
          
          // 배치 내 이미지를 병렬로 처리
          const batchResults = await Promise.allSettled(
            batch.map(async (part) => {
              try {
                const result = await processRebrickableImage(
                  part.part.part_img_url,
                  part.part.part_num,
                  part.color.id
                )
                
                // 이미지 메타데이터를 Supabase에 저장
                if (result.uploadedUrl) {
                  await saveImageMetadata({
                    original_url: part.part.part_img_url,
                    supabase_url: result.uploadedUrl,
                    file_path: result.path,
                    file_name: result.filename,
                    part_num: part.part.part_num,
                    color_id: part.color.id,
                    set_num: selectedSet.value?.set_num
                  })
                }
                
                return {
                  partNum: part.part.part_num,
                  result: result
                }
              } catch (err) {
                throw {
                  partNum: part.part.part_num,
                  error: err.message
                }
              }
            })
          )
          
          // 배치 결과 처리
          batchResults.forEach((promiseResult, index) => {
            processedCount++
            console.log(`🖼️ Processing image ${processedCount}/${setParts.value.length}`)
            
            if (promiseResult.status === 'fulfilled') {
              results.push(promiseResult.value)
            } else {
              errors.push(promiseResult.reason)
            }
          })
          
          // 진행률 업데이트 (UI에 표시 가능)
          const progress = Math.round((processedCount / setParts.value.length) * 100)
          console.log(`📊 Progress: ${progress}%`)
        }
        
        console.log(`🖼️ Bulk image processing completed: ${results.length} successful, ${errors.length} failed`)
        
        successMessage.value = `${results.length}개 이미지가 성공적으로 처리되었습니다. ${errors.length}개 오류가 발생했습니다.`
        
        if (errors.length > 0) {
          error.value = `실패한 부품들: ${errors.map(e => e.partNum).join(', ')}`
        }
        
      } catch (err) {
        console.error('Failed to process images:', err)
        error.value = `이미지 처리 중 오류가 발생했습니다: ${err.message}`
      } finally {
        // downloading 상태는 useImageManager에서 자동 관리됨
      }
    }

    // 강제 재저장 (기존 데이터 삭제 후 저장)
    const forceResaveSet = async () => {
      if (!selectedSet.value) return
      
      // 중복 세트 확인
      const existingSet = await checkSetExists(selectedSet.value.set_num)
      if (!existingSet) {
        successMessage.value = '기존 세트가 없습니다. 일반 저장을 사용하세요.'
        return
      }
      
      const shouldReplace = confirm(
        `⚠️ 강제 재저장을 시작합니다!\n\n` +
        `📦 기존 세트 정보:\n` +
        `   • 이름: ${existingSet.name}\n` +
        `   • 세트 번호: ${existingSet.set_num}\n` +
        `   • 등록일: ${new Date(existingSet.created_at).toLocaleDateString('ko-KR')}\n` +
        `   • 부품 수: ${existingSet.num_parts}개\n\n` +
        `🆕 새로운 세트 정보:\n` +
        `   • 이름: ${selectedSet.value.name}\n` +
        `   • 세트 번호: ${selectedSet.value.set_num}\n` +
        `   • 부품 수: ${selectedSet.value.num_parts}개\n\n` +
        `⚠️ 주의: 기존 데이터를 완전히 삭제하고 새로 저장하시겠습니까?\n` +
        `(이 작업은 되돌릴 수 없습니다)`
      )
      
      if (!shouldReplace) {
        console.log('User cancelled force resave')
        return
      }
      
      // LLM 분석 재생성 여부 확인
      const shouldRegenerateLLM = confirm(
        `🤖 LLM 분석 재생성 옵션\n\n` +
        `기존 세트의 부품들에 대한 LLM 분석 데이터가 있습니다.\n\n` +
        `• "확인" 클릭: 기존 LLM 분석 데이터를 삭제하고 새로 생성\n` +
        `• "취소" 클릭: 기존 LLM 분석 데이터를 유지\n\n` +
        `새로운 LLM 분석을 생성하시겠습니까?`
      )
      
      try {
        saving.value = true
        successMessage.value = '기존 세트 데이터를 삭제하는 중...'
        
        // 기존 세트 삭제 (LLM 분석 데이터 삭제 옵션 포함)
        console.log('Deleting existing set and all related data...')
        const deleteSuccess = await deleteSetAndParts(existingSet.id, existingSet.set_num, shouldRegenerateLLM)
        if (!deleteSuccess) {
          throw new Error('기존 세트 삭제에 실패했습니다.')
        }
        
        // LLM 분석 재생성 플래그 설정
        if (shouldRegenerateLLM) {
          console.log('🔄 LLM 분석 재생성 모드 활성화')
          skipLLMAnalysis.value = false // LLM 분석 실행
        } else {
          console.log('⏭️ 기존 LLM 분석 데이터 유지')
          skipLLMAnalysis.value = true // LLM 분석 건너뛰기
        }
        
        successMessage.value = '기존 데이터 삭제 완료. 새 데이터를 저장하는 중...'
        
        // 배치 처리 실행
        const result = await batchProcessSet(selectedSet.value, setParts.value, {
          forceUpload: false
        })

        console.log(`Force resave completed:`, result)

        // 백그라운드 LLM 분석 시작 (이미지 마이그레이션 완료 후)
        if (!skipLLMAnalysis.value && result.savedParts > 0) {
          console.log(`🖼️ 이미지 마이그레이션 완료 후 AI 분석 시작...`)
          
          // 이미지 마이그레이션 완료 대기 (폴링 방식)
          const { triggerFullMigration } = useAutoImageMigration()
          try {
            console.log(`🔄 전체 이미지 마이그레이션 시작...`)
            const migrationResult = await triggerFullMigration()
            console.log(`✅ 이미지 마이그레이션 트리거 완료:`, migrationResult)
            
            // 폴링 방식으로 마이그레이션 완료 대기 (최대 2분)
            const migrationComplete = await waitForMigrationComplete(
              selectedSet.value.set_num,
              120000, // 최대 2분
              2000    // 2초마다 확인
            )
            
            if (migrationComplete) {
              console.log(`🤖 이미지 마이그레이션 완료, LLM 분석 시작 (${result.savedParts}개 부품)`)
            } else {
              console.log(`⚠️ 마이그레이션 타임아웃, 원본 이미지로 LLM 분석 시작`)
              
              // Slack 알림: 마이그레이션 타임아웃
              const status = { uploaded: result.processedImages || 0, total: result.totalParts || 0 }
              await alertMigrationFailed(selectedSet.value.set_num, status, '마이그레이션 타임아웃 (120초 초과)')
            }
            
            const taskId = await startBackgroundAnalysis(selectedSet.value, setParts.value)
            console.log(`📋 Background task started: ${taskId}`)
            successMessage.value = migrationComplete
              ? `🎉 세트 강제 재저장 완료!\n\n🤖 자동 처리 시작:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성 (768차원)\n• 데이터베이스 저장\n\n⏱️ 예상 소요 시간: ${setParts.value.length * 2}초\n📋 작업 ID: ${taskId}`
              : `🎉 세트 강제 재저장 완료!\n\n🤖 자동 처리 시작:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성 (768차원)\n• 데이터베이스 저장\n\n⏱️ 예상 소요 시간: ${setParts.value.length * 2}초\n📋 작업 ID: ${taskId}`
          } catch (migrationError) {
            console.warn(`⚠️ 이미지 마이그레이션 실패: ${migrationError.message}`)
            
            // Slack 알림: 마이그레이션 실패
            await alertMigrationFailed(
              selectedSet.value.set_num,
              { uploaded: 0, total: result.savedParts || 0 },
              migrationError.message
            )
            
            // 마이그레이션 실패해도 AI 분석은 계속 진행 (원본 이미지로)
            console.log(`🤖 원본 이미지로 백그라운드 LLM 분석 시작...`)
            const taskId = await startBackgroundAnalysis(selectedSet.value, setParts.value)
            console.log(`📋 Background task started: ${taskId}`)
            successMessage.value = `🎉 세트 강제 재저장 완료!\n\n🤖 자동 처리 시작:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성 (768차원)\n• 데이터베이스 저장\n\n⏱️ 예상 소요 시간: ${setParts.value.length * 2}초\n📋 작업 ID: ${taskId}`
          }
        } else if (skipLLMAnalysis.value) {
          console.log(`⚡ LLM 분석 건너뛰기 (빠른 저장 모드)`)
          successMessage.value = `세트 강제 재저장 완료! (빠른 저장 모드)`
        }

        // 작업 로그 저장
        await saveOperationLog({
          operation_type: 'set_force_resave',
          target_type: 'set',
          target_id: result.set.id,
          status: result.failedParts === 0 ? 'success' : 'partial_success',
          message: `세트 ${selectedSet.value.set_num} 강제 재저장 완료. 성공: ${result.savedParts}개, 실패: ${result.failedParts}개`,
          metadata: {
            set_num: selectedSet.value.set_num,
            total_parts: setParts.value.length,
            saved_parts: result.savedParts,
            failed_parts: result.failedParts,
            processed_images: result.processedImages,
            failed_images: result.failedImages,
            set_image: result.setImage
          }
        })

        console.log(`Force resave completed: ${result.savedParts} parts, ${result.processedImages} images`)
        
      } catch (err) {
        console.error('Force resave failed:', err)
        error.value = `강제 재저장 실패: ${err.message}`
      } finally {
        saving.value = false
      }
    }

    // 기존 세트 중복 체크
    const checkExistingSet = async (setNum) => {
      try {
        const { data, error } = await supabase
          .from('lego_sets')
          .select('id, set_num, name, year, num_parts, created_at')
          .eq('set_num', setNum)
          .maybeSingle()
        
        if (error) {
          console.log('Error checking existing set:', error)
          return null
        }
        
        return data
      } catch (err) {
        console.error('Failed to check existing set:', err)
        return null
      }
    }

    const saveSetToDatabase = async () => {
      if (!selectedSet.value) return
      
      // 1. 기존 세트 중복 체크
      const existingSet = await checkExistingSet(selectedSet.value.set_num)
      let isUpdate = false
      
      if (existingSet) {
        const shouldUpdate = confirm(
          `이미 등록된 세트가 있습니다!\n\n` +
          `기존 세트: ${existingSet.name} (${existingSet.set_num})\n` +
          `등록일: ${new Date(existingSet.created_at).toLocaleDateString('ko-KR')}\n` +
          `부품 수: ${existingSet.num_parts}개\n\n` +
          `새로운 세트: ${selectedSet.value.name}\n` +
          `부품 수: ${selectedSet.value.num_parts}개\n\n` +
          `기존 데이터를 업데이트하시겠습니까?`
        )
        
        if (!shouldUpdate) {
          console.log('User cancelled update')
          return
        }
        
        isUpdate = true
        
        // 기존 데이터 삭제 후 새로 저장
        console.log('Deleting existing set data...')
        try {
          // 부품 관계 삭제
          const { error: deletePartsError } = await supabase
            .from('set_parts')
            .delete()
            .eq('set_id', existingSet.id)
          
          if (deletePartsError) {
            console.warn('Failed to delete set_parts, but continuing with update:', deletePartsError)
            // 삭제 실패해도 계속 진행 (중복 체크 로직이 처리)
          } else {
            console.log('Set parts deleted successfully')
          }
          
          // 세트 정보 삭제
          const { error: deleteSetError } = await supabase
            .from('lego_sets')
            .delete()
            .eq('id', existingSet.id)
          
          if (deleteSetError) {
            console.warn('Failed to delete lego_sets, but continuing with update:', deleteSetError)
            // 삭제 실패해도 계속 진행
          } else {
            console.log('Lego set deleted successfully')
          }
          
          console.log('Existing data deletion attempted')
        } catch (err) {
          console.error('Error during deletion, but continuing with update:', err)
          // 삭제 실패해도 계속 진행 (중복 체크 로직이 처리)
        }
      }
      
      // 백그라운드 작업으로 저장 시작
      const taskId = startBackgroundTask(
        `세트 ${selectedSet.value.set_num} ${isUpdate ? '업데이트' : '저장'}`,
        async (task) => {
          const savedParts = []
          const failedParts = []
          
          try {
            // 1. 세트 정보 저장
            const savedSet = await saveLegoSet(selectedSet.value)
            console.log('Set saved:', savedSet)

            // 1.5. 세트 이미지 WebP 변환 (백그라운드에서 실행)
            try {
              console.log(`🖼️ Converting set image to WebP for ${selectedSet.value.set_num}...`)
              console.log(`🖼️ Set image URL: ${selectedSet.value.set_img_url}`)
              
              const webpResult = await convertSetImageToWebP(selectedSet.value)
              if (webpResult) {
                console.log(`✅ Set image converted to WebP: ${selectedSet.value.set_num}`)
                console.log(`✅ WebP URL: ${webpResult.webpUrl}`)
                console.log(`✅ File path: ${webpResult.path}`)
              } else {
                console.log(`⚠️ Set image WebP conversion failed: ${selectedSet.value.set_num}`)
              }
            } catch (imageError) {
              console.warn(`⚠️ Set image WebP conversion failed for ${selectedSet.value.set_num}:`, imageError)
              // 이미지 변환 실패해도 세트 저장은 계속 진행
            }

            // 2. 부품 정보 저장 (각 부품별로 오류 처리)
            if (setParts.value.length > 0) {
              console.log(`🔍 DEBUG: Starting to save ${setParts.value.length} parts from API...`)
              console.log(`🔍 DEBUG: First few parts:`, setParts.value.slice(0, 3).map(p => ({
                part_num: p.part.part_num,
                color: p.color.name,
                quantity: p.quantity
              })))
              
              for (let i = 0; i < setParts.value.length; i++) {
                const partData = setParts.value[i]
                try {
                  console.log(`Saving part ${i + 1}/${setParts.value.length}: ${partData.part.part_num}`)
                  
                  // 진행상황 업데이트
                  updateTaskProgress(taskId, i + 1, setParts.value.length)
                  
                  // 부품 정보 저장
                  const savedPart = await saveLegoPart(partData.part)
                  console.log(`Part saved: ${savedPart.part_num}`)
                  
                  // 색상 정보 저장
                  const savedColor = await saveLegoColor(partData.color)
                  console.log(`Color saved: ${savedColor.name}`)
                  
                  // 세트-부품 관계 저장
                  const savedSetPart = await saveSetPart(
                    savedSet.id,
                    savedPart.part_num,  // part_id는 part_num (character varying)
                    savedColor.color_id, // color_id는 integer
                    partData.quantity,
                    partData.is_spare || false,
                    partData.element_id,
                    partData.num_sets || 1
                  )
                  console.log(`Set-part relationship saved for ${partData.part.part_num}`)
                  
                  // 이미지 업로드 (백그라운드에서 실행)
                  try {
                    console.log(`🖼️ Uploading image for ${partData.part.part_num} (element_id: ${partData.element_id})...`)
                    
                    // element_id가 있으면 Rebrickable API에서 element_id 기반 이미지 URL 가져오기
                    let imageUrl = partData.part.part_img_url
                    if (partData.element_id) {
                      try {
                        const { getElement } = useRebrickable()
                        const elementData = await getElement(partData.element_id)
                        if (elementData?.element_img_url || elementData?.part_img_url) {
                          imageUrl = elementData.element_img_url || elementData.part_img_url
                          console.log(`✅ element_id ${partData.element_id} 기반 이미지 URL 획득:`, imageUrl)
                        }
                      } catch (elementErr) {
                        console.warn(`⚠️ element_id ${partData.element_id} 이미지 URL 가져오기 실패, 기본 part_img_url 사용:`, elementErr)
                      }
                    }
                    
                    const imageResult = await processRebrickableImage(
                      imageUrl,
                      partData.part.part_num,
                      partData.color.id,
                      { elementId: partData.element_id || null } // element_id 전달
                    )
                    
                    if (imageResult.uploadedUrl) {
                      console.log(`💾 Saving image metadata for ${partData.part.part_num}...`)
                      await saveImageMetadata({
                        original_url: imageUrl,
                        supabase_url: imageResult.uploadedUrl,
                        file_path: imageResult.path,
                        file_name: imageResult.filename || `${partData.part.part_num}_${partData.color.id}.webp`,
                        part_num: partData.part.part_num,
                        color_id: partData.color.id,
                        element_id: partData.element_id || null,
                        set_num: selectedSet.value?.set_num
                      })
                      console.log(`✅ Image metadata saved for ${partData.part.part_num} (element_id: ${partData.element_id})`)
                    }
                  } catch (imageError) {
                    console.warn(`⚠️ Image upload failed for ${partData.part.part_num}:`, imageError)
                    // 이미지 업로드 실패해도 부품 저장은 계속 진행
                  }
                  
                  savedParts.push({
                    part_num: partData.part.part_num,
                    color: partData.color.name,
                    quantity: partData.quantity
                  })
                  
                } catch (partErr) {
                  console.error(`Failed to save part ${partData.part.part_num}:`, partErr)
                  failedParts.push({
                    part_num: partData.part.part_num,
                    color: partData.color.name,
                    error: partErr.message
                  })
                }
              }
              
              console.log(`🔍 DEBUG: Save completed - Success: ${savedParts.length}, Failed: ${failedParts.length}`)
              console.log(`🔍 DEBUG: Failed parts:`, failedParts)
              
              // 🤖 백그라운드 LLM 분석 + CLIP 임베딩 자동화
              if (!skipLLMAnalysis.value && savedParts.length > 0) {
                console.log(`🤖 백그라운드 LLM 분석 + CLIP 임베딩 자동화 시작 (${savedParts.length}개 부품)`)
                const taskId = await startBackgroundAnalysis(selectedSet.value, setParts.value)
                console.log(`📋 Background task started: ${taskId}`)
                successMessage.value = `🎉 세트 저장 완료!\n\n🤖 자동 처리 시작:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성 (768차원)\n• 데이터베이스 저장\n\n⏱️ 예상 소요 시간: ${savedParts.length * 2}초\n📋 작업 ID: ${taskId}\n\n⚠️ 다음 단계 필수: Semantic Vector 생성\n→ 메타데이터 관리 페이지 > Semantic Vector 탭에서 생성하세요.\n→ 신규 등록 부품 필터를 사용하면 빠르게 찾을 수 있습니다.`
              } else if (skipLLMAnalysis.value) {
                console.log(`⚡ LLM 분석 건너뛰기 (빠른 저장 모드)`)
                successMessage.value = `세트 저장 완료! (빠른 저장 모드)`
              }
            }

            // 3. 작업 로그 저장
            await saveOperationLog({
              operation_type: 'set_import',
              target_type: 'set',
              target_id: savedSet.id,
              status: savedParts.length === setParts.value.length ? 'success' : 'partial_success',
              message: `세트 ${selectedSet.value.set_num} 저장 완료. 성공: ${savedParts.length}개, 실패: ${failedParts.length}개`,
              metadata: {
                set_num: selectedSet.value.set_num,
                total_parts: setParts.value.length,
                saved_parts: savedParts.length,
                failed_parts: failedParts.length,
                failed_details: failedParts
              }
            })

            console.log(`Save completed: ${savedParts.length} successful, ${failedParts.length} failed`)
            console.log('Failed parts details:', failedParts)
            
            return {
              savedParts,
              failedParts,
              setNum: selectedSet.value.set_num
            }
            
          } catch (err) {
            console.error('Failed to save set:', err)
            throw err
          }
        }
      )
      
      // 즉시 성공 메시지 표시 (백그라운드에서 작업 진행)
      const message = isUpdate 
        ? `세트 ${selectedSet.value.set_num} 업데이트가 백그라운드에서 시작되었습니다. 페이지를 이동해도 작업이 계속됩니다.`
        : `세트 ${selectedSet.value.set_num} 저장이 백그라운드에서 시작되었습니다. 페이지를 이동해도 작업이 계속됩니다.`
      successMessage.value = message
      
      // 작업 완료 후 결과 처리 (선택사항)
      setTimeout(async () => {
        try {
          const task = getRunningTasks().find(t => t.id === taskId)
          if (task && task.status === 'completed') {
            const result = task.result
            if (result.failedParts.length === 0) {
              const action = isUpdate ? '업데이트' : '저장'
              successMessage.value = `세트 ${result.setNum} 및 ${result.savedParts.length}개 부품 정보가 성공적으로 ${action}되었습니다.`
            } else {
              const action = isUpdate ? '업데이트' : '저장'
              successMessage.value = `세트 ${result.setNum} ${action} 완료. 성공: ${result.savedParts.length}개, 실패: ${result.failedParts.length}개`
              error.value = `실패한 부품들: ${result.failedParts.map(p => `${p.part_num}(${p.color})`).join(', ')}`
            }
          }
        } catch (err) {
          console.error('Error processing task result:', err)
        }
      }, 1000)
    }

    const exportPartsData = () => {
      if (setParts.value.length === 0) return
      
      const data = setParts.value.map(part => ({
        part_num: part.part.part_num,
        name: part.part.name,
        color: part.color.name,
        quantity: part.quantity,
        image_url: part.part.part_img_url
      }))
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedSet.value.set_num}_parts.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    // 기본 이미지 로드 함수
    const getDefaultPartImage = async () => {
      try {
        // Supabase에서 기본 부품 이미지 로드
        const { data, error } = await supabase
          .from('parts_master_features')
          .select('image_url, webp_image_url')
          .eq('part_num', '3001') // 기본 부품 (2x4 브릭)
          .single()
        
        if (error) throw error
        
        return data.webp_image_url || data.image_url || getDefaultPartImage()
        
      } catch (error) {
        console.error('기본 부품 이미지 로드 실패:', error)
        return getDefaultPartImage()
      }
    }

    // 실제 이미지 로드 함수
    const getRealPartImage = async (partId) => {
      try {
        if (!partId) return getDefaultPartImage()
        
        // Supabase에서 실제 부품 이미지 로드
        const { data, error } = await supabase
          .from('parts_master_features')
          .select('image_url, webp_image_url')
          .eq('part_id', partId)
          .single()
        
        if (error) throw error
        
        // WebP 우선, 일반 이미지 폴백
        return data.webp_image_url || data.image_url || getDefaultPartImage()
        
      } catch (error) {
        console.error('실제 부품 이미지 로드 실패:', error)
        return getDefaultPartImage()
      }
    }

    const handleImageError = (event) => {
      // 미니피규어 이미지 오류 처리
      if (event.target.closest('.minifig-card')) {
        event.target.style.display = 'none'
        const noImageDiv = event.target.nextElementSibling
        if (noImageDiv && noImageDiv.classList.contains('no-image')) {
          noImageDiv.style.display = 'flex'
        }
      } else {
        // 일반 부품 이미지 오류 처리
        getRealPartImage(part.part_id).then(imageUrl => {
          event.target.src = imageUrl
        })
      }
    }

    // 백그라운드 WebP 변환 함수 (UI 없이 자동 실행)
    const convertSetImageToWebP = async (set) => {
      try {
        if (!set.set_img_url) {
          console.warn(`세트 ${set.set_num}에 이미지 URL이 없습니다.`)
          return null
        }

        console.log(`🖼️ Starting set image conversion for ${set.set_num}`)
        console.log(`🖼️ Original URL: ${set.set_img_url}`)
        
        // WebP 파일명 생성
        const webpFileName = `${set.set_num}_set.webp`
        const uploadPath = 'lego_sets_images'
        
        console.log(`🖼️ Target filename: ${webpFileName}`)
        console.log(`🖼️ Upload path: ${uploadPath}`)
        
        // 이미지 다운로드 및 WebP 변환
        console.log(`🖼️ Calling uploadImageFromUrl...`)
        const result = await uploadImageFromUrl(
          set.set_img_url,
          webpFileName,
          uploadPath
        )
        
        console.log(`🖼️ uploadImageFromUrl result:`, result)
        
        if (result && result.url) {
          console.log(`✅ Set image upload successful!`)
          console.log(`✅ WebP URL: ${result.url}`)
          console.log(`✅ File path: ${result.path}`)
          // 세트 이미지 메타데이터 저장
          await saveSetImageMetadata({
            set_num: set.set_num,
            original_url: set.set_img_url,
            supabase_url: result.url,
            file_path: result.path,
            file_name: webpFileName,
            set_id: set.id
          })
          
          // lego_sets 테이블의 webp_image_url 필드 업데이트
          try {
            console.log(`🔄 Updating lego_sets table for ${set.set_num}...`)
            console.log(`🔄 WebP URL to save: ${result.url}`)
            
            const { error: updateError } = await supabase
              .from('lego_sets')
              .update({ webp_image_url: result.url })
              .eq('set_num', set.set_num)
            
            if (updateError) {
              console.error(`❌ lego_sets webp_image_url 업데이트 실패: ${updateError.message}`)
              console.error(`❌ Update details:`, {
                setNum: set.set_num,
                webpUrl: result.url,
                error: updateError
              })
            } else {
              console.log(`✅ lego_sets webp_image_url 업데이트 완료: ${set.set_num}`)
              console.log(`✅ Saved WebP URL: ${result.url}`)
            }
          } catch (updateErr) {
            console.error(`❌ lego_sets webp_image_url 업데이트 중 오류: ${updateErr.message}`)
            console.error(`❌ Update error details:`, updateErr)
          }
          
          return {
            originalUrl: set.set_img_url,
            webpUrl: result.url,
            filename: webpFileName,
            path: result.path
          }
        }
        
        return null
      } catch (err) {
        return null
      }
    }

    // 세트 이미지 메타데이터 저장
    const saveSetImageMetadata = async (imageData) => {
      try {
        const { error } = await supabase
          .from('set_images')
          .upsert([imageData], { 
            onConflict: 'set_num',
            returning: 'minimal' 
          })

        if (error) {
          // 조용히 실패 처리
        }
      } catch (err) {
        // 조용히 실패 처리
      }
    }

    // 배치 처리 함수 (새로운 빠른 저장)
    const saveSetBatch = async () => {
      if (!selectedSet.value || !setParts.value.length) {
        console.error('No set or parts selected')
        return
      }

      try {
        saving.value = true
        successMessage.value = ''

        console.log(`Starting batch save process for set ${selectedSet.value.set_num}...`)
        console.log(`Parts to save: ${setParts.value.length}`)

        // 중복 세트 체크
        const existingSet = await checkSetExists(selectedSet.value.set_num)
        if (existingSet) {
          const shouldReplace = confirm(
            `⚠️ 중복된 레고 세트가 발견되었습니다!\n\n` +
            `📦 기존 세트 정보:\n` +
            `   • 이름: ${existingSet.name}\n` +
            `   • 세트 번호: ${existingSet.set_num}\n` +
            `   • 등록일: ${new Date(existingSet.created_at).toLocaleDateString('ko-KR')}\n` +
            `   • 부품 수: ${existingSet.num_parts}개\n\n` +
            `🆕 새로운 세트 정보:\n` +
            `   • 이름: ${selectedSet.value.name}\n` +
            `   • 세트 번호: ${selectedSet.value.set_num}\n` +
            `   • 부품 수: ${selectedSet.value.num_parts}개\n\n` +
            `⚠️ 주의: 기존 데이터를 삭제하고 새로 저장하시겠습니까?\n` +
            `(기존 데이터는 완전히 삭제되며 되돌릴 수 없습니다)`
          )
          
          if (!shouldReplace) {
            console.log('User cancelled duplicate set replacement')
            successMessage.value = '중복 세트 등록이 취소되었습니다.'
            return
          }
          
          // LLM 분석 재생성 여부 확인
          const shouldRegenerateLLM = confirm(
            `🤖 LLM 분석 재생성 옵션\n\n` +
            `기존 세트의 부품들에 대한 LLM 분석 데이터가 있습니다.\n\n` +
            `• "확인" 클릭: 기존 LLM 분석 데이터를 삭제하고 새로 생성\n` +
            `• "취소" 클릭: 기존 LLM 분석 데이터를 유지\n\n` +
            `새로운 LLM 분석을 생성하시겠습니까?`
          )
          
          // 기존 세트 삭제 (LLM 분석 데이터 삭제 옵션 포함)
          console.log('Deleting existing set and all related data...')
          const deleteSuccess = await deleteSetAndParts(existingSet.id, existingSet.set_num, shouldRegenerateLLM)
          if (!deleteSuccess) {
            throw new Error('기존 세트 삭제에 실패했습니다.')
          }
          
          // LLM 분석 재생성 플래그 설정
          if (shouldRegenerateLLM) {
            console.log('🔄 LLM 분석 재생성 모드 활성화')
            skipLLMAnalysis.value = false // LLM 분석 실행
          } else {
            console.log('⏭️ 기존 LLM 분석 데이터 유지')
            skipLLMAnalysis.value = true // LLM 분석 건너뛰기
          }
          
          successMessage.value = '기존 세트 데이터를 삭제했습니다. 새 데이터를 저장합니다...'
        }

        // 배치 처리 실행
        const result = await batchProcessSet(selectedSet.value, setParts.value)

        console.log(`Batch processing completed:`, result)

        // 백그라운드 LLM 분석 시작
        console.log(`🔍 skipLLMAnalysis.value = ${skipLLMAnalysis.value}`)
        console.log(`🔍 result.totalParts = ${result.totalParts}`)
        
        // ✅ 최적화: 이미지 마이그레이션과 LLM 분석 분리 (독립 실행)
        const { triggerFullMigration } = useAutoImageMigration()
        
    // ✅ 이미지 마이그레이션은 항상 실행 (백그라운드, 강제 재업로드)
    if (result.totalParts > 0) {
      console.log(`🖼️ 백그라운드 이미지 마이그레이션 시작 (강제 업로드)...`)
      
      // 캐시 초기화 후 강제 재업로드
      const { clearCache } = useAutoImageMigration()
      clearCache()
      console.log(`🧹 이미지 마이그레이션 캐시 초기화 완료`)
      
      triggerFullMigration({ force: true }) // 강제 재업로드 옵션 추가
        .then(migrationResult => {
          console.log(`✅ 이미지 마이그레이션 완료:`, migrationResult)
        })
        .catch(migrationError => {
          console.warn(`⚠️ 이미지 마이그레이션 실패: ${migrationError.message}`)
          alertMigrationFailed(
            selectedSet.value.set_num,
            { uploaded: 0, total: result.totalParts || 0 },
            migrationError.message
          )
        })
    }
        
        // ✅ LLM 분석은 조건부 실행
        if (!skipLLMAnalysis.value && result.totalParts > 0) {
          console.log(`🤖 백그라운드 LLM 분석 시작...`)
          const taskId = await startBackgroundAnalysis(selectedSet.value, setParts.value)
          console.log(`📋 Background LLM task started: ${taskId}`)
          successMessage.value = `세트 저장 완료! 백그라운드에서 이미지 마이그레이션과 LLM 분석을 진행합니다. (작업 ID: ${taskId})`
        } else if (skipLLMAnalysis.value) {
          console.log(`⚡ LLM 분석 건너뛰기 (빠른 저장 모드)`)
          successMessage.value = `세트 저장 완료! 백그라운드에서 이미지 마이그레이션을 진행합니다.`
        } else {
          console.log(`⚠️ 부품이 저장되지 않아 LLM 분석 건너뜀`)
          successMessage.value = `세트 저장 완료!`
        }

        // 작업 로그 저장
        await saveOperationLog({
          operation_type: 'set_import',
          target_type: 'set',
          target_id: result.set.id,
          status: 'success',
          message: `세트 ${selectedSet.value.set_num} 배치 저장 완료. 총 부품: ${result.totalParts}개, 관계: ${result.insertedRelationships}개`,
          metadata: {
            set_num: selectedSet.value.set_num,
            total_parts: result.totalParts,
            inserted_relationships: result.insertedRelationships,
            set_image: result.setImage
          }
        })

        console.log(`Batch save completed: ${result.totalParts} parts, ${result.insertedRelationships} relationships`)
        
      } catch (err) {
        console.error('Batch save failed:', err)
        error.value = `저장 실패: ${err.message}`
      } finally {
        saving.value = false
      }
    }

    // 기존 buildMasterDataForSet 함수는 백그라운드 작업으로 대체됨

    // 백그라운드 작업 상태
    const runningTasks = computed(() => getRunningTasks())
    const llmRunningTasks = computed(() => getLLMRunningTasks())
    const queueStatus = computed(() => getQueueStatus())

    // 모달 관련 함수들
    const closeProgressModal = () => {
      showProgressModal.value = false
    }

    // 모달 표시 조건
    const shouldShowModal = computed(() => {
      return batchLoading.value || 
             (!skipLLMAnalysis.value && masterDataProgress.value > 0) ||
             runningTasks.value.length > 0 ||
             llmRunningTasks.value.length > 0
    })

    // 모달 표시 상태 감시 (자동 닫힘 방지)
    watch(shouldShowModal, (newValue) => { // // 🔧 수정됨
      if (newValue) {
        showProgressModal.value = true
      }
      // false일 때는 사용자가 X 버튼으로 닫을 때까지 유지
    }, { immediate: true })

    return {
      searchQuery,
      searchResults,
      selectedSet,
      setParts,
      loading,
      loadingParts,
      downloading,
      saving,
      error,
      successMessage,
      isLocalData,
      partsCountValidation,
      partsStats,
      categorizedParts,
      skipLLMAnalysis,
      masterDataProgress,
      processing,
      showProgressModal,
      closeProgressModal,
      searchSets,
      selectSet,
      loadSetParts,
      downloadPartImage,
      downloadAllPartImages,
      saveSetToDatabase,
      saveSetBatch,
      forceResaveSet,
      exportPartsData,
      handleImageError,
      runningTasks,
      llmRunningTasks,
      queueStatus,
      batchLoading,
      batchProgress,
      batchCurrentStep,
      batchError,
      isSingleSetNumber,
      formatSetNumber,
      calculatePartsTotal,
      validatePartsCount,
      calculatePartsStats,
      categorizeParts,
      setMinifigs
    }
  }
}
</script>

<style scoped>
.lego-set-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  color: #333;
  margin-bottom: 0.5rem;
}

.search-section {
  margin-bottom: 2rem;
}

.search-box {
  display: flex;
  gap: 1rem;
  max-width: 600px;
  margin: 0 auto;
}

.search-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}

.search-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.search-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-results h3 {
  margin-bottom: 1rem;
  color: #333;
}

.data-source-info {
  margin-bottom: 1rem;
}

.source-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-right: 0.5rem;
}

.source-badge.local {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.source-badge.api {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.sets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.set-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s;
  overflow: hidden;
}

.set-card:hover {
  transform: translateY(-5px);
}

.set-card.existing-set {
  border: 2px solid #ffc107;
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
}

.set-card.existing-set:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(255, 193, 7, 0.3);
}

.set-image {
  height: 200px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  position: relative;
}

.set-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.duplicate-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 193, 7, 0.9);
  color: #856404;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.duplicate-icon {
  font-size: 0.8rem;
}

.duplicate-text {
  white-space: nowrap;
}

.duplicate-info {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 193, 7, 0.1);
  border-radius: 6px;
  border-left: 3px solid #ffc107;
}

.duplicate-date {
  font-size: 0.8rem;
  color: #856404;
  margin: 0;
  font-weight: 500;
}

.set-info {
  padding: 1rem;
}

.set-info h4 {
  margin-bottom: 0.5rem;
  color: #333;
  font-size: 1.1rem;
}

.set-number {
  font-weight: 600;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.set-year, .set-pieces {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.selected-set {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.set-main-info {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
}

.set-large-image {
  width: 200px;
  height: 200px;
  object-fit: contain;
  background: #f8f9fa;
  border-radius: 8px;
}

.set-details-text h2 {
  color: #333;
  margin-bottom: 1rem;
}

.set-details-text p {
  margin-bottom: 0.5rem;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.parts-section {
  margin-top: 2rem;
}

.parts-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.part-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e1e5e9;
}

.part-image {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  background: white;
  border-radius: 6px;
}

.part-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.part-info h4 {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.part-info p {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.part-actions {
  margin-top: 0.5rem;
}

.spare-part {
  color: #856404;
  background: rgba(255, 193, 7, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: inline-block;
}


.spare-info {
  color: #856404;
  font-weight: 600;
}

.validation-info {
  font-weight: 600;
  font-size: 0.9rem;
  margin-left: 0.5rem;
}

.validation-info.match {
  color: #28a745;
}

.validation-info.mismatch {
  color: #dc3545;
}

.parts-category {
  margin-bottom: 2rem;
}

.category-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.minifig-title {
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
  color: white;
  border: 2px solid #ff5252;
}

.spare-title {
  background: linear-gradient(135deg, #ffc107 0%, #ffd54f 100%);
  color: #856404;
  border: 2px solid #ffb300;
}

.regular-title {
  background: linear-gradient(135deg, #4fc3f7 0%, #81d4fa 100%);
  color: #01579b;
  border: 2px solid #29b6f6;
}

.minifig-card {
  border: 2px solid #ff6b6b;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%);
}

.minifig-link {
  color: #ff6b6b;
  text-decoration: none;
  font-weight: bold;
}

.minifig-link:hover {
  color: #e53e3e;
  text-decoration: underline;
}

.no-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 1rem;
}

.no-image-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.7;
}

.no-image-text {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
  text-align: center;
}

.spare-card {
  border: 2px solid #ffc107;
  background: linear-gradient(135deg, #fffbf0 0%, #fff3cd 100%);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-block;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-info {
  background: #17a2b8;
  color: white;
}


.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.success-message {
  background: #efe;
  color: #363;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
}

/* 마스터 데이터 구축 옵션 스타일 */
.master-data-option {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  color: #495057;
}

.checkbox-label input[type="checkbox"] {
  margin-right: 0.5rem;
  transform: scale(1.2);
}

.form-help {
  display: block;
  margin-top: 0.5rem;
  color: #6c757d;
  font-size: 0.875rem;
}

/* 마스터 데이터 진행률 스타일 */
.master-data-progress {
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.master-data-progress h4 {
  margin: 0 0 0.5rem 0;
  color: #1976d2;
}

.master-data-progress .progress {
  position: relative;
  background: #f5f5f5;
  border-radius: 4px;
  height: 24px;
  margin: 0.5rem 0;
}

.master-data-progress .progress-bar {
  background: linear-gradient(90deg, #2196f3, #21cbf3);
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.master-data-progress .progress span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
}

.background-tasks {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.background-tasks h4 {
  margin: 0 0 1rem 0;
  color: #495057;
}

.task-item {
  margin-bottom: 1rem;
}

.task-item:last-child {
  margin-bottom: 0;
}

.task-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.task-name {
  font-weight: 600;
  color: #495057;
}

.task-progress {
  font-size: 0.9rem;
  color: #6c757d;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  transition: width 0.3s ease;
}

/* 배치 처리 진행률 스타일 */
.batch-processing-progress {
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #e8f5e8, #f0f8f0);
  border-radius: 8px;
  border: 1px solid #c8e6c9;
}

.batch-processing-progress h4 {
  margin: 0 0 15px 0;
  color: #2e7d32;
  font-weight: 600;
}

.batch-processing-progress .progress {
  position: relative;
  background: #f5f5f5;
  border-radius: 4px;
  height: 24px;
  margin: 0.5rem 0;
}

.batch-processing-progress .progress-bar {
  background: linear-gradient(90deg, #4caf50, #2e7d32);
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.batch-processing-progress .progress span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
}

.processing-errors {
  margin-top: 8px;
  padding: 6px 8px;
  background: #ffebee;
  border-radius: 4px;
  border-left: 3px solid #f44336;
}

.processing-errors small {
  color: #d32f2f;
  font-weight: 500;
}

/* LLM 백그라운드 작업 스타일 */
.llm-background-tasks {
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
  border-radius: 8px;
  border: 1px solid #bbdefb;
}

.llm-background-tasks h4 {
  margin: 0 0 15px 0;
  color: #3f51b5;
  font-weight: 600;
}

.queue-status {
  margin-bottom: 15px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  font-size: 0.9em;
  color: #424242;
  text-align: center;
}

.llm-task-item {
  margin-bottom: 12px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #c5cae9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.llm-task-item .task-name {
  color: #3f51b5;
  font-weight: 600;
}

.llm-task-item .task-progress {
  color: #5c6bc0;
}

.llm-task-item .progress-fill {
  background: linear-gradient(90deg, #3f51b5, #1a237e);
}

.task-errors {
  margin-top: 8px;
  padding: 6px 8px;
  background: #ffebee;
  border-radius: 4px;
  border-left: 3px solid #f44336;
}

.task-errors small {
  color: #d32f2f;
  font-weight: 500;
}

@media (max-width: 768px) {
  .set-main-info {
    flex-direction: column;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .parts-controls {
    flex-direction: column;
  }
}

/* 진행률 모달 스타일 */
.progress-modal-overlay {
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

.progress-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.progress-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e5e9;
}

.progress-modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f5f5f5;
}

.progress-modal-content {
  padding: 24px;
}

.progress-section {
  margin-bottom: 24px;
}

.progress-section:last-child {
  margin-bottom: 0;
}

.progress-section h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
}

.queue-status {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 0.9rem;
  color: #6c757d;
}
</style>
