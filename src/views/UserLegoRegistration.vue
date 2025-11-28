<template>
  <div class="user-lego-registration-page">
    <div class="page-header">
      <h1>레고등록</h1>
      <p>레고 세트 번호를 검색하여 등록할 수 있습니다.</p>
    </div>

    <div class="registration-content" :class="{ 'disabled': isPleyonUser }">
      <!-- 검색 섹션 -->
      <div class="search-section">
        <div class="setup-card">
          <div class="card-body">
            <div class="form-group">
              <label>레고번호를 입력하세요. (일괄 등록: 쉼표 또는 띄어쓰기로 구분)</label>
              <div class="set-search-wrapper">
                <div class="set-search-input-row">
                  <div class="set-search-input-wrapper">
                    <input
                      type="text"
                      v-model="setSearchQuery"
                      @keyup.enter="handleSearchEnter"
                      @blur="handleSearchBlur"
                      placeholder="예 : 76917 또는 76917, 76918, 76919 또는 76917 76918"
                      class="set-search-input"
                      :disabled="loading || isPleyonUser"
                    />
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M14 14L11.1 11.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <button
                    type="button"
                    @click="handleSearchEnter"
                    class="search-button"
                    :disabled="loading || isPleyonUser"
                  >
                    검색
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 등록된 레고리스트 -->
      <div v-if="!loading && registeredSets.length > 0" class="registered-sets-section">
        <div class="result-header">
          <h3>등록된 레고 리스트</h3>
          <span class="result-count">(총 {{ registeredSets.length }}개)</span>
        </div>
        <div class="registered-sets-table-container">
          <table class="registered-sets-table">
            <thead>
              <tr>
                <th>제품번호</th>
                <th>시리즈</th>
                <th>제품명</th>
                <th>부품수</th>
                <th>등록일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="set in registeredSets"
                :key="set.id"
                class="registered-set-row"
              >
                <td class="set-number-cell">
                  {{ formatSetNumber(set.set_num) || '세트번호 없음' }}
                </td>
                <td class="set-theme-cell">
                  {{ set.theme_name || '-' }}
                </td>
                <td class="set-name-cell">
                  {{ set.name || '-' }}
                </td>
                <td class="set-parts-cell">
                  {{ set.num_parts || 0 }}개
                </td>
                <td class="set-date-cell">
                  {{ formatDate(set.created_at) }}
                </td>
                <td class="set-actions-cell">
                  <button @click.stop="deleteRegisteredSet(set.id)" class="btn-delete">
                    삭제
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else-if="!loading && registeredSets.length === 0 && !isPleyonUser" class="empty-state">
        <p>등록된 레고 세트가 없습니다.</p>
      </div>
    </div>

    <!-- 플레이온 동기화 계정 안내 -->
    <div v-if="isPleyonUser" class="pleyon-notice-section">
      <div class="notice-card">
        <div class="notice-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>
        <div class="notice-content">
          <h3>플레이온 동기화 계정</h3>
          <p>플레이온과 동기화된 계정은 자동으로 레고 세트 정보가 등록됩니다.</p>
          <p v-if="storeInfo?.store" class="store-name">매장명: {{ storeInfo.store.name }}</p>
        </div>
      </div>
    </div>

    <!-- 검색 결과 모달 -->
    <div v-if="showSearchModal" class="modal-overlay" @click="closeSearchModal">
      <div class="modal-content search-modal-content" @click.stop>
        <div class="modal-header">
          <h3>레고 검색 결과</h3>
          <button 
            type="button" 
            class="modal-close-btn" 
            @click="closeSearchModal" 
            aria-label="모달 닫기"
          >
            &times;
          </button>
        </div>
        <div class="modal-body">
          <!-- 검색 진행 중 -->
          <div v-if="searching" class="search-progress">
            <div class="progress-info">
              <p>{{ searchProgressText }}</p>
              <div class="progress-bar-container">
                <div class="progress-bar">
                  <div 
                    class="progress-fill" 
                    :style="{ width: `${searchProgressPercent}%` }"
                  ></div>
                </div>
                <span class="progress-text">{{ searchProgressPercent }}%</span>
              </div>
            </div>
          </div>

          <!-- 등록 결과 -->
          <div v-else-if="registrationResults.length > 0" class="registration-results-table-wrapper">
            <div class="results-count">등록 결과: {{ registrationResults.length }}개</div>
            <div class="registration-results-scroll">
              <table class="registration-results-table">
                <thead>
                  <tr>
                    <th>제품번호</th>
                    <th>시리즈</th>
                    <th>제품명</th>
                    <th>부품수</th>
                    <th>등록 상태</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(result, index) in registrationResults"
                    :key="`${result.set_num || index}-${index}`"
                  >
                    <td>{{ formatSetNumber(result.set_num) || '-' }}</td>
                    <td>{{ result.theme_name || '-' }}</td>
                    <td>{{ result.name || '-' }}</td>
                    <td>{{ result.num_parts || 0 }}개</td>
                    <td class="result-status-cell">
                      <span class="result-status-badge" :class="result.status">
                        {{ getStatusLabel(result.status) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 결과 없음 -->
          <div v-else class="no-results">
            <p>등록 결과가 없습니다.</p>
          </div>
        </div>
        <div class="modal-footer" v-if="!searching">
          <div class="modal-actions single">
            <button @click="closeSearchModal" class="btn-confirm">닫기</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useRebrickable } from '../composables/useRebrickable'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'

const { supabase, user } = useSupabase()
const { getSet } = useRebrickable()
const { getStoreInfoByEmail } = useSupabasePleyon()

const loading = ref(false)
const error = ref(null)
const successMessage = ref(null)
const setSearchQuery = ref('')
const registrationResults = ref([])
const registeredSets = ref([])
const isPleyonUser = ref(false)
const storeInfo = ref(null)
const showSearchModal = ref(false)
const searching = ref(false)
const searchProgressText = ref('')
const searchProgressPercent = ref(0)

// 검색 결과 포맷팅
const formatSetNumber = (setNum) => {
  if (!setNum) return ''
  return String(setNum).replace(/-\d+$/, '').trim()
}

// 날짜 포맷팅
const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 🔧 수정됨: 브릭박스 DB 우선 검색 및 자동 등록을 위한 필드 목록
const SET_SELECT_FIELDS = 'id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url'

const buildSetNumVariants = (rawSetNum) => {
  const trimmed = String(rawSetNum || '').trim()
  if (!trimmed) return []

  const variants = new Set()
  variants.add(trimmed)

  const upperTrimmed = trimmed.toUpperCase()
  if (upperTrimmed !== trimmed) {
    variants.add(upperTrimmed)
  }

  const mainSetNum = trimmed.split('-')[0]
  if (mainSetNum) {
    variants.add(mainSetNum)
    const upperMain = mainSetNum.toUpperCase()
    variants.add(upperMain)

    if (!trimmed.includes('-')) {
      variants.add(`${mainSetNum}-1`)
      variants.add(`${upperMain}-1`)
    } else if (mainSetNum !== trimmed) {
      variants.add(`${mainSetNum}-1`)
    }
  }

  return [...variants].filter(Boolean)
}

const prioritizeDbMatches = (matches, variants, mainSetNum) => {
  if (!matches || matches.length === 0) return []
  const priorityOrder = [...new Set([
    ...variants,
    mainSetNum,
    mainSetNum ? `${mainSetNum}-1` : null
  ].filter(Boolean))]

  const priorityMap = new Map(priorityOrder.map((variant, index) => [variant, index]))
  const fallbackPriority = priorityOrder.length

  return [...matches].sort((a, b) => {
    const priorityA = priorityMap.get(a.set_num) ?? fallbackPriority
    const priorityB = priorityMap.get(b.set_num) ?? fallbackPriority
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    return (a.set_num || '').localeCompare(b.set_num || '')
  })
}

const fetchDbMatchesByVariants = async (rawSetNum) => {
  const trimmed = String(rawSetNum || '').trim()
  if (!trimmed) return []

  const mainSetNum = trimmed.split('-')[0]
  const variants = buildSetNumVariants(trimmed)
  const uniqueVariants = [...new Set(variants)]

  let matches = []

  if (uniqueVariants.length > 0) {
    const { data, error } = await supabase
      .from('lego_sets')
      .select(SET_SELECT_FIELDS)
      .in('set_num', uniqueVariants)

    if (!error && data && data.length > 0) {
      matches = data
    }
  }

  if ((!matches || matches.length === 0) && mainSetNum) {
    const { data: likeMatch, error: likeError } = await supabase
      .from('lego_sets')
      .select(SET_SELECT_FIELDS)
      .ilike('set_num', `${mainSetNum}%`)
      .order('set_num')
      .limit(20)

    if (!likeError && likeMatch && likeMatch.length > 0) {
      matches = likeMatch
    }
  }

  return prioritizeDbMatches(matches, uniqueVariants, mainSetNum)
}

const attachThemeNames = async (sets) => {
  if (!sets || sets.length === 0) return []
  const themeIds = [...new Set(sets.map(set => set.theme_id).filter(Boolean))]

  if (themeIds.length === 0) {
    return sets.map(set => ({ ...set, theme_name: set.theme_name || null }))
  }

  const { data: themesData, error: themesError } = await supabase
    .from('lego_themes')
    .select('theme_id, name')
    .in('theme_id', themeIds)

  if (themesError || !themesData) {
    return sets.map(set => ({ ...set, theme_name: set.theme_name || null }))
  }

  const themeMap = new Map(themesData.map(theme => [theme.theme_id, theme.name]))
  return sets.map(set => ({
    ...set,
    theme_name: set.theme_id ? (themeMap.get(set.theme_id) || set.theme_name || null) : (set.theme_name || null)
  }))
}

const buildNotFoundEntry = (setNum) => ({
  set_num: String(setNum || '').trim(),
  name: null,
  theme_name: null,
  num_parts: 0,
  status: 'error',
  message: '세트를 찾을 수 없습니다.'
})

const getStatusLabel = (status) => {
  switch (status) {
    case 'success':
      return '등록완료'
    case 'duplicate':
      return '중복'
    case 'error':
    default:
      return '등록실패'
  }
}

// 🔧 수정됨: 검색 직후 자동 등록 처리
const registerSetsAutomatically = async (sets) => {
  if (!user.value) {
    error.value = '로그인이 필요합니다.'
    return sets.map(set => ({
      set_num: set.set_num,
      name: set.name,
      theme_name: set.theme_name || null,
      num_parts: set.num_parts || 0,
      status: 'error',
      message: '로그인이 필요합니다.'
    }))
  }

  if (!sets || sets.length === 0) {
    return []
  }

  const normalizedSets = sets
    .map(set => ({
      ...set,
      set_num: set.set_num ? String(set.set_num).trim() : ''
    }))
    .filter(set => !!set.set_num)

  const setNums = normalizedSets.map(set => set.set_num)

  try {
    const { data: existingRows, error: existingError } = await supabase
      .from('user_lego_sets')
      .select('set_num')
      .eq('user_id', user.value.id)
      .in('set_num', setNums)

    if (existingError) throw existingError

    const existingSetNums = new Set((existingRows || []).map(row => row.set_num))
    const insertQueue = []
    const seenForInsert = new Set()

    normalizedSets.forEach(set => {
      if (existingSetNums.has(set.set_num)) {
        return
      }
      if (seenForInsert.has(set.set_num)) {
        return
      }
      seenForInsert.add(set.set_num)
      insertQueue.push(set)
    })

    let insertedSetNums = new Set()

    if (insertQueue.length > 0) {
      const payload = insertQueue.map(set => ({
        user_id: user.value.id,
        set_num: set.set_num,
        name: set.name,
        theme_id: set.theme_id,
        num_parts: set.num_parts || 0,
        set_img_url: set.set_img_url || null,
        webp_image_url: set.webp_image_url || null,
        created_at: new Date().toISOString()
      }))

      const { data, error: insertError } = await supabase
        .from('user_lego_sets')
        .insert(payload)
        .select('set_num')

      if (insertError) throw insertError

      insertedSetNums = new Set((data || []).map(row => row.set_num))
      await loadRegisteredSets()

      const newCount = insertedSetNums.size
      const duplicateCount = normalizedSets.length - newCount
      successMessage.value = duplicateCount > 0
        ? `등록완료 ${newCount}개, 중복 ${duplicateCount}개`
        : `${newCount}개 세트가 등록되었습니다.`
    }

    const processedCounts = new Map()

    return normalizedSets.map(set => {
      const currentCount = processedCounts.get(set.set_num) || 0
      processedCounts.set(set.set_num, currentCount + 1)

      if (insertedSetNums.has(set.set_num) && currentCount === 0) {
        return {
          set_num: set.set_num,
          name: set.name,
          theme_name: set.theme_name || null,
          num_parts: set.num_parts || 0,
          status: 'success',
          message: '등록 완료'
        }
      }

      if (existingSetNums.has(set.set_num)) {
        return {
          set_num: set.set_num,
          name: set.name,
          theme_name: set.theme_name || null,
          num_parts: set.num_parts || 0,
          status: 'duplicate',
          message: '이미 등록된 세트입니다.'
        }
      }

      if (currentCount > 0) {
        return {
          set_num: set.set_num,
          name: set.name,
          theme_name: set.theme_name || null,
          num_parts: set.num_parts || 0,
          status: 'duplicate',
          message: '동일한 세트가 반복 입력되었습니다.'
        }
      }

      return {
        set_num: set.set_num,
        name: set.name,
        theme_name: set.theme_name || null,
        num_parts: set.num_parts || 0,
        status: 'error',
        message: '등록 처리에 실패했습니다.'
      }
    })
  } catch (err) {
    console.error('자동 등록 실패:', err)
    error.value = '등록 중 오류가 발생했습니다.'
    return normalizedSets.map(set => ({
      set_num: set.set_num,
      name: set.name,
      theme_name: set.theme_name || null,
      num_parts: set.num_parts || 0,
      status: 'error',
      message: err.message || '등록 실패'
    }))
  }
}

// 검색 실행
const handleSearchEnter = async () => {
  if (isPleyonUser.value) {
    error.value = '플레이온 동기화 계정은 수동 등록이 불가능합니다.'
    return
  }

  if (!setSearchQuery.value.trim()) {
    registrationResults.value = []
    return
  }

  const query = setSearchQuery.value.trim()
  
  // 모달 열기
  showSearchModal.value = true
  searching.value = true
  searchProgressPercent.value = 0
  searchProgressText.value = '등록 준비 중...'
  registrationResults.value = []
  successMessage.value = null
  error.value = null
  
  // 일괄 등록 모드 (쉼표 또는 띄어쓰기로 구분)
  const hasComma = query.includes(',')
  const hasMultipleSpaces = query.split(/\s+/).filter(s => s.trim().length > 0).length > 1
  
  if (hasComma || hasMultipleSpaces) {
    // 쉼표와 띄어쓰기 모두로 분리
    const setNumbers = query
      .split(/[,\s]+/)  // 쉼표 또는 하나 이상의 공백으로 분리
      .map(s => s.trim())
      .filter(Boolean)
    
    if (setNumbers.length > 0) {
      await searchMultipleSets(setNumbers)
    }
    return
  }

  // 단일 검색
  await searchSingleSet(query)
}

// 단일 세트 검색 후 자동 등록
const searchSingleSet = async (query) => {
  try {
    loading.value = true
    error.value = null
    searching.value = true
    searchProgressText.value = '등록 대상 확인 중...'
    searchProgressPercent.value = 25

    registrationResults.value = []

    const dbMatches = await fetchDbMatchesByVariants(query)
    let foundSets = []

    if (dbMatches.length > 0) {
      searchProgressText.value = '등록 대상 데이터 정리 중...'
      searchProgressPercent.value = 55
      foundSets = await attachThemeNames(dbMatches)
    } else {
      searchProgressText.value = '등록 대상 추가 확인 중...'
      searchProgressPercent.value = 65
      try {
        const setData = await getSet(query)
        if (setData) {
          foundSets = [{
            set_num: setData.set_num,
            name: setData.name,
            num_parts: setData.num_parts,
            set_img_url: setData.set_img_url,
            theme_id: setData.theme_id,
            webp_image_url: null,
            theme_name: null
          }]
        }
      } catch (apiError) {
        const is404 = apiError.is404 || (apiError.message && apiError.message.includes('404'))
        if (!is404) {
          console.warn('Rebrickable API 검색 실패:', apiError)
        }
      }
    }

    const notFoundEntries = []
    if (!foundSets || foundSets.length === 0) {
      notFoundEntries.push(buildNotFoundEntry(query))
    }

    let registrationEntries = []
    if (foundSets.length > 0) {
      searchProgressText.value = '등록 처리 중...'
      searchProgressPercent.value = 85
      registrationEntries = await registerSetsAutomatically(foundSets)
    }

    registrationResults.value = [...registrationEntries, ...notFoundEntries]

    searchProgressPercent.value = 100
    searchProgressText.value = '등록 절차 완료'
    await new Promise(resolve => setTimeout(resolve, 300))
    searching.value = false
  } catch (err) {
    console.error('등록 실패:', err)
    error.value = '등록 처리 중 오류가 발생했습니다.'
    registrationResults.value = [{
      set_num: query,
      name: null,
      theme_name: null,
      num_parts: 0,
      status: 'error',
      message: err.message || '등록 처리 중 오류가 발생했습니다.'
    }]
    searching.value = false
  } finally {
    loading.value = false
  }
}

// 일괄 검색
const searchMultipleSets = async (setNumbers) => {
  try {
    loading.value = true
    error.value = null
    searching.value = true
    registrationResults.value = []
    successMessage.value = null
    searchProgressText.value = '등록 준비 중...'
    searchProgressPercent.value = 0

    const total = setNumbers.length
    const foundSets = []
    const notFoundEntries = []
    
    for (let i = 0; i < setNumbers.length; i++) {
      const setNum = String(setNumbers[i]).trim()
      if (!setNum) continue

      const current = i + 1
      searchProgressText.value = `등록 처리 중... (${current}/${total})`
      searchProgressPercent.value = Math.round((current / total) * 70)
      
      try {
        const dbMatches = await fetchDbMatchesByVariants(setNum)
        if (dbMatches.length > 0) {
          const [enrichedSet] = await attachThemeNames([dbMatches[0]])
          foundSets.push(enrichedSet)
          continue
        }

        try {
          const setData = await getSet(setNum)
          if (setData) {
            foundSets.push({
              set_num: setData.set_num,
              name: setData.name,
              num_parts: setData.num_parts,
              set_img_url: setData.set_img_url,
              theme_id: setData.theme_id,
              webp_image_url: null,
              theme_name: null
            })
          } else {
            notFoundEntries.push(buildNotFoundEntry(setNum))
          }
        } catch (apiError) {
          const is404 = apiError.is404 || (apiError.message && apiError.message.includes('404'))
          if (!is404) {
            console.warn(`세트 ${setNum} 검색 실패:`, apiError)
          }
          notFoundEntries.push(buildNotFoundEntry(setNum))
        }
      } catch (err) {
        console.warn(`세트 ${setNum} 처리 실패:`, err)
        notFoundEntries.push({
          ...buildNotFoundEntry(setNum),
          message: err.message || '처리 중 오류가 발생했습니다.'
        })
      }
    }

    let registrationEntries = []
    if (foundSets.length > 0) {
      searchProgressText.value = '등록 반영 중...'
      searchProgressPercent.value = 85
      registrationEntries = await registerSetsAutomatically(foundSets)
    }

    registrationResults.value = [...registrationEntries, ...notFoundEntries]

    searchProgressPercent.value = 100
    searchProgressText.value = '등록 절차 완료'
    await new Promise(resolve => setTimeout(resolve, 300))
    searching.value = false
  } catch (err) {
    console.error('일괄 등록 실패:', err)
    error.value = '일괄 등록 처리 중 오류가 발생했습니다.'
    registrationResults.value = [{
      set_num: '',
      name: null,
      theme_name: null,
      num_parts: 0,
      status: 'error',
      message: err.message || '등록 처리 중 오류가 발생했습니다.'
    }]
    searching.value = false
  } finally {
    loading.value = false
  }
}

// 검색 입력 블러 처리
const handleSearchBlur = () => {
  // 모달 사용으로 블러 처리 불필요
}

// 모달 닫기
const closeSearchModal = () => {
  if (!searching.value) {
    showSearchModal.value = false
    registrationResults.value = []
  }
}

// 선택 확인
// 등록된 세트 목록 로드
const loadRegisteredSets = async () => {
  if (!user.value) {
    registeredSets.value = []
    return
  }

  try {
    loading.value = true
    error.value = null

    const { data, error: fetchError } = await supabase
      .from('user_lego_sets')
      .select('*')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })

    if (fetchError) throw fetchError

    // 테마 정보 조회
    if (data && data.length > 0) {
      const themeIds = [...new Set(data.map(s => s.theme_id).filter(Boolean))]
      if (themeIds.length > 0) {
        const { data: themesData } = await supabase
          .from('lego_themes')
          .select('theme_id, name')
          .in('theme_id', themeIds)

        if (themesData) {
          const themeMap = new Map(themesData.map(t => [t.theme_id, t.name]))
          registeredSets.value = data.map(set => ({
            ...set,
            theme_name: themeMap.get(set.theme_id) || null
          }))
        } else {
          registeredSets.value = data
        }
      } else {
        registeredSets.value = data
      }
    } else {
      registeredSets.value = []
    }
  } catch (err) {
    console.error('등록된 세트 목록 로드 실패:', err)
    error.value = '등록된 세트 목록을 불러오는데 실패했습니다.'
    registeredSets.value = []
  } finally {
    loading.value = false
  }
}

// 등록된 세트 삭제
const deleteRegisteredSet = async (setId) => {
  if (!confirm('이 레고 세트를 삭제하시겠습니까?')) {
    return
  }

  try {
    const { error: deleteError } = await supabase
      .from('user_lego_sets')
      .delete()
      .eq('id', setId)
      .eq('user_id', user.value.id)

    if (deleteError) throw deleteError

    successMessage.value = '레고 세트가 삭제되었습니다.'
    await loadRegisteredSets()
  } catch (err) {
    console.error('삭제 실패:', err)
    error.value = '삭제 중 오류가 발생했습니다.'
  }
}

// 플레이온 계정 확인
const checkPleyonAccount = async () => {
  if (!user.value) {
    isPleyonUser.value = false
    storeInfo.value = null
    return
  }

  try {
    const pleyonStoreInfo = await getStoreInfoByEmail(user.value.email)
    if (pleyonStoreInfo && pleyonStoreInfo.store) {
      isPleyonUser.value = true
      storeInfo.value = pleyonStoreInfo
    } else {
      isPleyonUser.value = false
      storeInfo.value = null
    }
  } catch (err) {
    console.error('플레이온 계정 확인 실패:', err)
    isPleyonUser.value = false
    storeInfo.value = null
  }
}

// 사용자 변경 감지
watch(user, async (newUser) => {
  if (newUser) {
    await checkPleyonAccount()
    loadRegisteredSets()
  } else {
    isPleyonUser.value = false
    storeInfo.value = null
    registeredSets.value = []
  }
}, { immediate: true })

onMounted(async () => {
  if (user.value) {
    await checkPleyonAccount()
    loadRegisteredSets()
  }
})
</script>

<style scoped>
.user-lego-registration-page {
  min-height: 100vh;
  background: #f9fafb;
  padding: 2rem;
}

.page-header {
  max-width: 1400px;
  margin: 0 auto 2rem;
  text-align: center;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.page-header p {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
}

.registration-content {
  max-width: 1400px;
  margin: 0 auto;
}

.search-section {
  max-width: 800px;
  margin: 0 auto 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0;
}

.setup-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: visible;
}

.card-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 0rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
  line-height: normal;
  letter-spacing: normal;
  font-family: inherit;
}

.set-search-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.set-search-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  position: relative;
}

.set-search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.set-search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

.set-search-input:hover {
  border-color: #9ca3af;
}

.set-search-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.set-search-input:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.8;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  flex-shrink: 0;
}

.set-search-input:focus + .search-icon {
  color: #2563eb;
}

.search-button {
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.search-button:hover {
  background: #1d4ed8;
}

.search-button:active {
  background: #1e40af;
}

.search-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.search-tooltip {
  padding: 0.5rem 0.75rem;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #92400e;
}

.custom-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
}

.custom-select-option {
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f3f4f6;
}

.custom-select-option:last-child {
  border-bottom: none;
}

.custom-select-option:hover {
  background: #f9fafb;
}

.custom-select-option.active {
  background: #eff6ff;
}

.option-content {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.option-image-wrapper {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-set-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.option-no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #9ca3af;
}

.option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.option-set-num {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.option-set-title {
  font-size: 0.875rem;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-set-parts {
  font-size: 0.75rem;
  color: #9ca3af;
}

.selected-sets-info {
  margin-top: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.selected-sets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.selected-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.clear-selection-button {
  padding: 0.25rem 0.5rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.clear-selection-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.selected-sets-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.selected-set-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.selected-set-thumb-wrapper {
  width: 50px;
  height: 50px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.selected-set-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.selected-set-no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #9ca3af;
}

.selected-set-text {
  flex: 1;
  min-width: 0;
}

.selected-set-number {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.25rem;
}

.selected-set-meta {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.selected-set-theme {
  margin-right: 0.5rem;
}

.selected-set-parts-info {
  font-size: 0.75rem;
  color: #9ca3af;
}

.remove-set-button {
  padding: 0.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #ef4444;
  transition: all 0.2s;
  border-radius: 4px;
}

.remove-set-button:hover {
  background: #fef2f2;
  color: #dc2626;
}

.register-button {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: #10b981;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.register-button:hover:not(:disabled) {
  background: #059669;
}

.register-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.registered-sets-section {
  margin-top: 2rem;
  width: 100%;
}

.result-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.result-header h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.result-count {
  font-size: 1rem;
  color: #6b7280;
}

.registered-sets-table-container {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  overflow-x: auto;
}

.registered-sets-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.registered-sets-table thead {
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
}

.registered-sets-table th {
  padding: 0.75rem 1rem;
  text-align: center;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
  white-space: nowrap;
}

.registered-sets-table tbody tr {
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.2s;
}

.registered-sets-table tbody tr:hover {
  background: #f9fafb;
}

.registered-sets-table tbody tr:last-child {
  border-bottom: none;
}

.registered-sets-table td {
  padding: 0.75rem 1rem;
  color: #111827;
  vertical-align: middle;
  text-align: center;
}

.set-number-cell {
  font-weight: 600;
  color: #2563eb;
}

.set-theme-cell {
  color: #6b7280;
}

.set-name-cell {
  color: #111827;
  font-weight: 500;
}

.set-parts-cell {
  color: #6b7280;
}

.set-date-cell {
  color: #6b7280;
}

.btn-delete {
  padding: 0.375rem 0.75rem;
  background: #ef4444;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-delete:hover {
  background: #dc2626;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.select-fade-enter-active,
.select-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.select-fade-enter-from,
.select-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.pleyon-notice-section {
  max-width: 800px;
  margin: 0 auto 2rem;
}

.notice-card {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.notice-icon {
  flex-shrink: 0;
  color: #d97706;
  margin-top: 0.25rem;
}

.notice-content {
  flex: 1;
}

.notice-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #92400e;
  margin: 0 0 0.5rem 0;
}

.notice-content p {
  font-size: 0.875rem;
  color: #78350f;
  margin: 0.25rem 0;
  line-height: 1.5;
}

.store-name {
  font-weight: 500;
  margin-top: 0.5rem;
}

.registration-content.disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* 검색 결과 모달 */
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
  padding: 1rem;
}

.search-modal-content {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* 검색 진행률 */
.search-progress {
  padding: 2rem 1rem;
  text-align: center;
}

.progress-info p {
  font-size: 1rem;
  color: #374151;
  margin-bottom: 1rem;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #2563eb;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #2563eb;
  min-width: 50px;
  text-align: right;
}

/* 검색 결과 리스트 */
.search-results-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.results-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.results-scroll {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  align-items: center;
}

.result-item:hover {
  border-color: #2563eb;
  background: #f9fafb;
}

.result-item.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.registration-result-item {
  cursor: default;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.result-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
}

.result-status.success {
  background: #dcfce7;
  color: #166534;
}

.result-status.error {
  background: #fee2e2;
  color: #991b1b;
}

.result-status.not_found {
  background: #fef3c7;
  color: #92400e;
}

.result-message {
  font-size: 0.8125rem;
  color: #6b7280;
}

.result-image-wrapper {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #9ca3af;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-set-num {
  font-size: 0.875rem;
  font-weight: 600;
  color: #2563eb;
  margin-bottom: 0.25rem;
}

.result-name {
  font-size: 0.875rem;
  color: #111827;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-parts {
  font-size: 0.75rem;
  color: #6b7280;
}

.result-check {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
}

.no-results {
  padding: 3rem 1rem;
  text-align: center;
  color: #6b7280;
}

/* 등록 결과 테이블 */
.registration-results-table-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.registration-results-scroll {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.registration-results-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.registration-results-table th,
.registration-results-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.875rem;
  text-align: center;
  word-break: break-word;
}

.registration-results-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  position: sticky;
  top: 0;
  z-index: 1;
}

.registration-results-table tr:last-child td {
  border-bottom: none;
}

.result-status-cell {
  min-width: 170px;
}

.result-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.125rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.result-status-badge.success {
  background: #dcfce7;
  color: #166534;
}

.result-status-badge.duplicate {
  background: #f3f4f6;
  color: #374151;
}

.result-status-badge.error {
  background: #fee2e2;
  color: #991b1b;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.selected-count-info {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
}

.modal-actions.single {
  justify-content: flex-end;
  width: 100%;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-confirm {
  padding: 0.5rem 1rem;
  background: #2563eb;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-confirm:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-confirm:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 1024px) {
  .search-section {
    max-width: 100%;
    margin-bottom: 1.5rem;
  }

  .result-section {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .user-lego-registration-page {
    padding: 1rem;
  }

  .page-header {
    margin-bottom: 1rem;
    padding: 1rem 0 0 0;
  }

  .page-header h1 {
    font-size: 1.25rem !important;
  }

  .page-header p {
    font-size: 0.875rem !important;
  }

  .search-section {
    max-width: 100%;
    margin-bottom: 1.5rem;
    padding: 0;
  }

  .result-header {
    margin-bottom: 1rem !important;
  }

  .result-header h3 {
    font-size: 1.125rem !important;
  }
}
</style>

