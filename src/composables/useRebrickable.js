import { ref } from 'vue'

// 프로덕션 모드에서는 환경 변수 필수, 개발 모드에서는 fallback 허용
const REBRICKABLE_API_KEY = import.meta.env.VITE_REBRICKABLE_API_KEY || 
  (import.meta.env.PROD ? null : 'd966442dee02b69a7d05a63805216a85')
const REBRICKABLE_BASE_URL = 'https://rebrickable.com/api/v3'

// 프로덕션 환경에서는 디버그 로그 비활성화
if (import.meta.env.DEV) {
  console.log('Environment check:', {
    VITE_REBRICKABLE_API_KEY: REBRICKABLE_API_KEY ? 'Present' : 'Missing',
    allEnv: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
  })
}

// 프로덕션 모드에서 API 키 검증
if (import.meta.env.PROD && !REBRICKABLE_API_KEY) {
  console.error('❌ VITE_REBRICKABLE_API_KEY is required in production mode')
}

export function useRebrickable() {
  const loading = ref(false)
  const error = ref(null)

  // API 호출 헬퍼 함수 (Rate limit 처리 포함)
  const apiCall = async (endpoint, options = {}, retryCount = 0) => {
    loading.value = true
    error.value = null

    try {
      if (!REBRICKABLE_API_KEY) {
        const errorMsg = import.meta.env.PROD 
          ? 'VITE_REBRICKABLE_API_KEY 환경 변수가 설정되지 않았습니다. 프로덕션 모드에서는 필수입니다.'
          : 'Missing VITE_REBRICKABLE_API_KEY'
        throw new Error(errorMsg)
      }
      const url = `${REBRICKABLE_BASE_URL}${endpoint}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `key ${REBRICKABLE_API_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      })

      // 429 Rate Limit 처리
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || '60'
        const waitTime = parseInt(retryAfter) * 1000 || 60000
        
        if (retryCount < 3) {
          console.warn(`[Rebrickable] Rate limit (429). Waiting ${waitTime}ms before retry ${retryCount + 1}/3...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          return await apiCall(endpoint, options, retryCount + 1)
        } else {
          throw new Error(`API Error: 429 Too Many Requests (재시도 횟수 초과)`)
        }
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 레고 세트 검색
  const searchSets = async (query, page = 1, pageSize = 100) => {
    const params = new URLSearchParams({
      search: query,
      page: page.toString(),
      page_size: pageSize.toString()
    })
    
    return await apiCall(`/lego/sets/?${params}`)
  }

  // 세트 번호 정규화 (하이픈이 없으면 -1 추가)
  const normalizeSetNum = (setNum) => {
    if (!setNum) return setNum
    const trimmed = String(setNum).trim()
    // 이미 하이픈이 있으면 그대로 반환
    if (trimmed.includes('-')) {
      return trimmed
    }
    // 하이픈이 없으면 -1 추가
    return `${trimmed}-1`
  }

  // 특정 세트 정보 조회 (여러 변형 시도)
  const getSet = async (setNum) => {
    const normalized = normalizeSetNum(setNum)
    const variants = [normalized]
    
    // 원본 번호도 시도 (하이픈이 있는 경우)
    if (normalized !== setNum) {
      variants.unshift(setNum)
    }
    
    // 여러 변형 시도
    for (const variant of variants) {
      try {
        const result = await apiCall(`/lego/sets/${variant}/`)
        if (result) {
          return result
        }
      } catch (err) {
        // 404가 아니면 즉시 throw
        if (!err.message || !err.message.includes('404')) {
          throw err
        }
        // 404면 다음 변형 시도
        console.log(`[Rebrickable] 세트 ${variant} 없음, 다음 변형 시도`)
      }
    }
    
    // 모든 변형 실패
    throw new Error(`API Error: 404 세트를 찾을 수 없습니다`)
  }

  // 세트의 부품 목록 조회 (모든 부품 가져오기)
  const getSetParts = async (setNum) => {
    // 정규화된 세트 번호 사용
    const normalized = normalizeSetNum(setNum)
    const variants = [normalized]
    
    // 원본 번호도 시도 (하이픈이 있는 경우)
    if (normalized !== setNum) {
      variants.unshift(setNum)
    }
    
    const allParts = []
    let page = 1
    const pageSize = 1000 // 최대 페이지 크기로 설정
    let actualSetNum = normalized // 실제로 작동하는 세트 번호
    
    // 여러 변형 시도하여 첫 페이지 확인
    let firstPageResponse = null
    for (const variant of variants) {
      try {
        const params = new URLSearchParams({
          page: '1',
          page_size: pageSize.toString(),
          inc_part_details: '1',
          inc_color_details: '1'
        })
        
        firstPageResponse = await apiCall(`/lego/sets/${variant}/parts/?${params}`)
        actualSetNum = variant
        console.log(`[Rebrickable] 세트 ${variant} 부품 조회 성공`)
        break // 성공하면 루프 종료
      } catch (err) {
        // 404가 아니면 즉시 throw
        if (!err.message || !err.message.includes('404')) {
          throw err
        }
        // 404면 다음 변형 시도
        console.log(`[Rebrickable] 세트 ${variant} 부품 조회 실패, 다음 변형 시도`)
      }
    }
    
    if (!firstPageResponse) {
      throw new Error(`API Error: 404 세트 ${setNum}의 부품 정보를 찾을 수 없습니다`)
    }
    
    // 첫 페이지 결과 추가
    if (firstPageResponse.results && firstPageResponse.results.length > 0) {
      allParts.push(...firstPageResponse.results)
    }
    
    // 나머지 페이지 조회
    page = 2
    while (firstPageResponse.next) {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        inc_part_details: '1',
        inc_color_details: '1'
      })
      
      const response = await apiCall(`/lego/sets/${actualSetNum}/parts/?${params}`)
      
      if (response.results && response.results.length > 0) {
        allParts.push(...response.results)
        
        // 더 이상 페이지가 없으면 중단
        if (!response.next) {
          break
        }
        
        page++
      } else {
        break
      }
    }
    
    return {
      count: allParts.length,
      results: allParts
    }
  }

  const getSetInstructions = async (setNum) => { // 🔧 수정됨
    return await apiCall(`/lego/sets/${setNum}/instructions/`)
  }

  // 부품 정보 조회
  const getPart = async (partNum) => {
    return await apiCall(`/lego/parts/${partNum}/`)
  }

  // 부품 색상 정보 조회
  const getPartColors = async (partNum) => {
    return await apiCall(`/lego/parts/${partNum}/colors/`)
  }

  // 색상 목록 조회
  const getColors = async (page = 1, pageSize = 100) => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString()
    })
    
    return await apiCall(`/lego/colors/?${params}`)
  }

  // 여러 부품 정보를 한 번에 조회 (성능 최적화)
  const getMultipleParts = async (partNums) => {
    const params = new URLSearchParams({
      part_nums: partNums.join(','),
      inc_part_details: '1',
      inc_color_details: '1'
    })
    
    return await apiCall(`/lego/parts/?${params}`)
  }

  // 미니피규어 검색
  const searchMinifigs = async (query, page = 1, pageSize = 100) => {
    const params = new URLSearchParams({
      search: query,
      page: page.toString(),
      page_size: pageSize.toString()
    })
    
    return await apiCall(`/lego/minifigs/?${params}`)
  }

  // 특정 미니피규어 정보 조회
  const getMinifig = async (figNum) => {
    return await apiCall(`/lego/minifigs/${figNum}/`)
  }

  // element_id로 부품 정보 조회 (색상 포함)
  const getElement = async (elementId) => {
    return await apiCall(`/lego/elements/${elementId}/`)
  }

  // 미니피규어의 부품 목록 조회
  const getMinifigParts = async (figNum) => {
    const allParts = []
    let page = 1
    const pageSize = 1000
    
    while (true) {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        inc_part_details: '1',
        inc_color_details: '1'
      })
      
      const response = await apiCall(`/lego/minifigs/${figNum}/parts/?${params}`)
      
      if (response.results && response.results.length > 0) {
        allParts.push(...response.results)
        
        if (!response.next) {
          break
        }
        
        page++
      } else {
        break
      }
    }
    
    return {
      count: allParts.length,
      results: allParts
    }
  }

  // 세트에 포함된 미니피규어 조회
  const getSetMinifigs = async (setNum) => {
    const allMinifigs = []
    let page = 1
    const pageSize = 1000
    
    while (true) {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString()
      })
      
      const response = await apiCall(`/lego/sets/${setNum}/minifigs/?${params}`)
      
      if (response.results && response.results.length > 0) {
        allMinifigs.push(...response.results)
        
        if (!response.next) {
          break
        }
        
        page++
      } else {
        break
      }
    }
    
    return {
      count: allMinifigs.length,
      results: allMinifigs
    }
  }

  // 테마(시리즈) 목록 조회
  const getThemes = async (page = 1, pageSize = 100) => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString()
    })
    
    return await apiCall(`/lego/themes/?${params}`)
  }

  // 특정 테마(시리즈) 정보 조회
  const getTheme = async (themeId) => {
    return await apiCall(`/lego/themes/${themeId}/`)
  }

  // 테마별 세트 목록 조회
  const getThemeSets = async (themeId, page = 1, pageSize = 100) => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString()
    })
    
    return await apiCall(`/lego/themes/${themeId}/sets/?${params}`)
  }

  return {
    loading,
    error,
    searchSets,
    getSet,
    getSetParts,
    getSetInstructions, // 🔧 수정됨
    getPart,
    getPartColors,
    getColors,
    getMultipleParts,
    searchMinifigs,
    getMinifig,
    getElement,
    getMinifigParts,
    getSetMinifigs,
    getThemes,
    getTheme,
    getThemeSets
  }
}
