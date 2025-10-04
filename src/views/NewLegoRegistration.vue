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
      
      <!-- 마스터 데이터 구축 옵션 -->
      <div class="master-data-option">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="buildMasterData"
            :disabled="loading || processing"
          />
          <span class="checkmark"></span>
          ⚡ 빠른 저장 (LLM 분석 건너뛰기)
        </label>
        <small class="form-help">
          체크하면 기본 데이터만 저장하고 LLM 분석을 건너뜁니다. (기본값: LLM 분석 실행)
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
              <button @click="saveSetToDatabase" :disabled="saving" class="btn btn-secondary">
                {{ saving ? '저장 중...' : '데이터베이스에 저장' }}
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

    <!-- 마스터 데이터 구축 진행률 -->
    <div v-if="!buildMasterData && masterDataProgress > 0" class="master-data-progress">
      <h4>🤖 마스터 데이터 구축 중...</h4>
      <div class="progress">
        <div class="progress-bar" :style="{ width: masterDataProgress + '%' }"></div>
        <span>{{ masterDataProgress }}%</span>
      </div>
      <small>LLM 분석 및 임베딩 생성 중... (품질 유지)</small>
    </div>

    <!-- 백그라운드 작업 상태 -->
    <div v-if="runningTasks.length > 0" class="background-tasks">
      <h4>백그라운드 작업 중</h4>
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
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
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
      saveImageMetadata
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
      checkMultipleSetsExist
    } = useDatabase()

    const {
      startBackgroundTask,
      updateTaskProgress,
      completeTask,
      failTask,
      getRunningTasks
    } = useBackgroundTasks()

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
    const buildMasterData = ref(false) // 마스터 데이터 구축 옵션 (기본값: false = LLM 분석 실행)
    const masterDataProgress = ref(0) // 마스터 데이터 구축 진행률
    const processing = ref(false) // 전체 처리 상태

    // 단일 제품 번호인지 확인하는 함수
    const isSingleSetNumber = (query) => {
      const trimmedQuery = query.trim()
      // 레고 세트 번호 패턴: 숫자로만 구성되고 3-6자리
      const setNumberPattern = /^\d{3,6}$/
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
        const result = await getSetPartsAPI(selectedSet.value.set_num)
        setParts.value = result.results || []
        console.log(`Loaded ${setParts.value.length} parts`)
        
        // 미니피규어 정보 로드
        console.log(`Loading minifigs for set ${selectedSet.value.set_num}...`)
        try {
          const minifigResult = await getSetMinifigs(selectedSet.value.set_num)
          setMinifigs.value = minifigResult.results || []
          console.log(`Loaded ${setMinifigs.value.length} minifigs`)
        } catch (minifigErr) {
          console.log('No minifigs found for this set:', minifigErr.message)
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
        
        const results = []
        const errors = []
        
        for (let i = 0; i < setParts.value.length; i++) {
          const part = setParts.value[i]
          try {
            console.log(`🖼️ Processing image ${i + 1}/${setParts.value.length}: ${part.part.part_num}`)
            
            const result = await processRebrickableImage(
              part.part.part_img_url,
              part.part.part_num,
              part.color.id
            )
            
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
            
            results.push({
              partNum: part.part.part_num,
              result: result
            })
            
          } catch (err) {
            console.error(`Failed to process image for ${part.part.part_num}:`, err)
            errors.push({
              partNum: part.part.part_num,
              error: err.message
            })
          }
        }
        
        console.log(`🖼️ Bulk image processing completed: ${results.length} successful, ${errors.length} failed`)
        console.log('Results:', results)
        console.log('Errors:', errors)
        
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
      
      if (!confirm(`"${selectedSet.value.set_num}" 세트의 기존 데이터를 삭제하고 새로 저장하시겠습니까?`)) return
      
      try {
        // 1. 기존 세트 데이터 삭제 (set_num으로 검색)
        console.log('Deleting existing set data...')
        
        // 먼저 해당 세트의 ID를 찾기
        const { data: existingSet, error: findError } = await supabase
          .from('lego_sets')
          .select('id')
          .eq('set_num', selectedSet.value.set_num)
          .maybeSingle()
        
        if (findError && findError.code !== 'PGRST116') {
          console.log('No existing set found, proceeding with save...')
        } else if (existingSet) {
          // 부품 관계 삭제
          const { error: deletePartsError } = await supabase
            .from('set_parts')
            .delete()
            .eq('set_id', existingSet.id)
          
          if (deletePartsError) throw deletePartsError
          
          // 세트 정보 삭제
          const { error: deleteSetError } = await supabase
            .from('lego_sets')
            .delete()
            .eq('id', existingSet.id)
          
          if (deleteSetError) throw deleteSetError
          
          console.log('Existing data deleted successfully')
        }
        
        // 2. 새로 저장
        await saveSetToDatabase()
        
        successMessage.value = `세트 ${selectedSet.value.set_num}이 강제 재저장되었습니다.`
      } catch (err) {
        console.error('Force resave failed:', err)
        error.value = `강제 재저장 중 오류가 발생했습니다: ${err.message}`
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
                    console.log(`🖼️ Uploading image for ${partData.part.part_num}...`)
                    const imageResult = await processRebrickableImage(
                      partData.part.part_img_url,
                      partData.part.part_num,
                      partData.color.id
                    )
                    
                    if (imageResult.uploadedUrl) {
                      console.log(`💾 Saving image metadata for ${partData.part.part_num}...`)
                      await saveImageMetadata({
                        original_url: partData.part.part_img_url,
                        supabase_url: imageResult.uploadedUrl,
                        file_path: imageResult.path,
                        file_name: imageResult.filename,
                        part_num: partData.part.part_num,
                        color_id: partData.color.id,
                        set_num: selectedSet.value?.set_num
                      })
                      console.log(`✅ Image metadata saved for ${partData.part.part_num}`)
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
              
              // 마스터 데이터 구축 (기본적으로 실행, 체크 시 건너뛰기)
              if (!buildMasterData.value && savedParts.length > 0) {
                console.log(`🤖 Starting automatic master data build for ${savedParts.length} parts...`)
                await buildMasterDataForSet(setParts.value, selectedSet.value)
              } else if (buildMasterData.value) {
                console.log(`⚡ Skipping LLM analysis (quick save mode)`)
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
        event.target.src = '/placeholder-image.png'
      }
    }

    // 마스터 데이터 구축 함수
    const buildMasterDataForSet = async (parts, set) => {
      try {
        console.log(`🤖 Starting master data build for set ${set.set_num}...`)
        processing.value = true
        masterDataProgress.value = 0
        
        // 1단계: LLM 분석
        console.log(`🧠 Step 1: LLM analysis for ${parts.length} parts...`)
        const analysisResults = []
        const batchSize = 3 // 병렬 처리 배치 크기
        
        for (let i = 0; i < parts.length; i += batchSize) {
          const batch = parts.slice(i, i + batchSize)
          const batchPromises = batch.map(async (part, index) => {
            try {
              // 기존 분석 확인
              const existing = await checkExistingAnalysis(part.part.part_num, part.color.id)
              if (existing) {
                console.log(`⏭️ Skipping existing analysis for ${part.part.part_num} (color: ${part.color.id}) - already analyzed`)
                // 메타 정보 보강 (DB 저장 시 color_id 누락 방지)
                return { ...existing, part: part.part, color: part.color }
              }
              
              console.log(`🧠 Analyzing part ${i + index + 1}/${parts.length}: ${part.part.part_num}`)
              const analysis = await analyzePartWithLLM(part)
              // 메타 정보 포함하여 반환 (DB 저장에 color_id 반영)
              return { ...analysis, part: part.part, color: part.color }
            } catch (error) {
              console.error(`❌ LLM analysis failed for ${part.part.part_num}:`, error)
              return null
            }
          })
          
          const batchResults = await Promise.all(batchPromises)
          analysisResults.push(...batchResults.filter(result => result !== null))
          
          // 진행률 업데이트
          masterDataProgress.value = Math.round(((i + batchSize) / parts.length) * 50)
          
          // API 레이트 리밋 방지
          if (i + batchSize < parts.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        console.log(`✅ LLM analysis completed: ${analysisResults.length} parts analyzed`)
        
        // 2단계: 임베딩 생성 (기존 임베딩이 없는 경우만)
        console.log(`🔢 Step 2: Generating embeddings...`)
        const needsEmbedding = analysisResults.filter(result => !result.embedding)
        console.log(`📊 Parts needing embedding: ${needsEmbedding.length}/${analysisResults.length}`)
        
        const embeddingResults = await generateTextEmbeddingsBatch(needsEmbedding)
        console.log(`✅ Embeddings generated: ${embeddingResults.length} parts`)
        
        // 3단계: 데이터베이스 저장
        console.log(`💾 Step 3: Saving to database...`)
        
        // 임베딩 결과를 올바른 부품에 매핑
        let embeddingIndex = 0
        const combinedResults = analysisResults.map(analysis => {
          if (!analysis.embedding && embeddingIndex < embeddingResults.length) {
            return {
              ...analysis,
              embedding: embeddingResults[embeddingIndex++]
            }
          }
          return analysis
        })
        
        await saveToMasterPartsDB(combinedResults)
        console.log(`✅ Master data saved to database`)
        
        masterDataProgress.value = 100
        console.log(`🎉 Master data build completed for set ${set.set_num}!`)
        
      } catch (error) {
        console.error(`❌ Master data build failed:`, error)
        masterDataProgress.value = 0
      } finally {
        processing.value = false
      }
    }

    // 백그라운드 작업 상태
    const runningTasks = computed(() => getRunningTasks())

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
      buildMasterData,
      masterDataProgress,
      processing,
      searchSets,
      selectSet,
      loadSetParts,
      downloadPartImage,
      downloadAllPartImages,
      saveSetToDatabase,
      forceResaveSet,
      exportPartsData,
      handleImageError,
      runningTasks,
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
</style>
