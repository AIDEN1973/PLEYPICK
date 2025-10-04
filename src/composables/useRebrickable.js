import { ref } from 'vue'

const REBRICKABLE_API_KEY = import.meta.env.VITE_REBRICKABLE_API_KEY
const REBRICKABLE_BASE_URL = 'https://rebrickable.com/api/v3'

export function useRebrickable() {
  const loading = ref(false)
  const error = ref(null)

  // API 호출 헬퍼 함수
  const apiCall = async (endpoint, options = {}) => {
    loading.value = true
    error.value = null

    try {
      if (!REBRICKABLE_API_KEY) {
        throw new Error('Missing VITE_REBRICKABLE_API_KEY')
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

  // 특정 세트 정보 조회
  const getSet = async (setNum) => {
    return await apiCall(`/lego/sets/${setNum}/`)
  }

  // 세트의 부품 목록 조회 (모든 부품 가져오기)
  const getSetParts = async (setNum) => {
    const allParts = []
    let page = 1
    const pageSize = 1000 // 최대 페이지 크기로 설정
    
    while (true) {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        inc_part_details: '1',
        inc_color_details: '1'
      })
      
      const response = await apiCall(`/lego/sets/${setNum}/parts/?${params}`)
      
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

  return {
    loading,
    error,
    searchSets,
    getSet,
    getSetParts,
    getPart,
    getPartColors,
    getColors,
    getMultipleParts,
    searchMinifigs,
    getMinifig,
    getMinifigParts,
    getSetMinifigs
  }
}
