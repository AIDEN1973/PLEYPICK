import { ref } from 'vue'
import { supabase } from './useSupabase'

/**
 * Element ID 검색 Composable
 * Element ID로 해당 부품이 포함된 세트를 검색하거나
 * 통합 검색(Element ID + 세트 번호/이름)을 제공
 */
export function useElementIdSearch() {
  const loading = ref(false)
  const error = ref(null)
  const searchResults = ref([])

  /**
   * Element ID로 세트 검색
   * @param {string} elementId - Element ID (예: '4500574')
   * @returns {Promise<Array>} 검색 결과 배열
   */
  const searchByElementId = async (elementId) => {
    if (!elementId || !elementId.trim()) {
      error.value = 'Element ID를 입력해주세요.'
      return []
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await supabase
        .rpc('search_sets_by_element_id', {
          p_element_id: elementId.trim()
        })

      if (rpcError) {
        throw rpcError
      }

      searchResults.value = data || []
      
      if (data && data.length > 0) {
        console.log(`✅ Element ID "${elementId}" 검색 완료: ${data.length}개 세트 발견`)
      } else {
        console.log(`ℹ️ Element ID "${elementId}"를 포함한 세트가 없습니다.`)
        error.value = `Element ID "${elementId}"를 포함한 세트를 찾을 수 없습니다.`
      }

      return data || []
    } catch (err) {
      console.error('Element ID 검색 실패:', err)
      error.value = `검색 중 오류가 발생했습니다: ${err.message}`
      searchResults.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 부품 번호 + 색상 ID로 Element ID 조회
   * @param {string} partId - 부품 번호 (예: '3001')
   * @param {number} colorId - 색상 ID (예: 1)
   * @returns {Promise<Array>} Element ID 목록
   */
  const getElementIdsByPartColor = async (partId, colorId) => {
    if (!partId || colorId === undefined) {
      error.value = '부품 번호와 색상 ID가 필요합니다.'
      return []
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_element_ids_by_part_color', {
          p_part_id: partId,
          p_color_id: colorId
        })

      if (rpcError) {
        throw rpcError
      }

      console.log(`✅ 부품 ${partId} (색상: ${colorId})의 Element ID 조회 완료: ${data?.length || 0}개`)
      return data || []
    } catch (err) {
      console.error('Element ID 조회 실패:', err)
      error.value = `조회 중 오류가 발생했습니다: ${err.message}`
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 통합 검색: Element ID 또는 세트 번호/이름
   * @param {string} query - 검색어 (Element ID, 세트 번호, 세트 이름)
   * @returns {Promise<Object>} { type: 'element_id' | 'set_search', results: Array }
   */
  const universalSearch = async (query) => {
    if (!query || !query.trim()) {
      error.value = '검색어를 입력해주세요.'
      return { type: null, results: [] }
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await supabase
        .rpc('universal_set_search', {
          p_query: query.trim()
        })

      if (rpcError) {
        throw rpcError
      }

      const searchType = data && data.length > 0 ? data[0].search_type : null
      searchResults.value = data || []

      if (searchType === 'element_id') {
        console.log(`✅ Element ID "${query}" 검색 완료: ${data.length}개 세트`)
      } else if (searchType === 'set_search') {
        console.log(`✅ 세트 검색 "${query}" 완료: ${data.length}개 결과`)
      } else {
        console.log(`ℹ️ "${query}"에 대한 검색 결과 없음`)
        error.value = `"${query}"에 대한 검색 결과가 없습니다.`
      }

      return {
        type: searchType,
        results: data || []
      }
    } catch (err) {
      console.error('통합 검색 실패:', err)
      error.value = `검색 중 오류가 발생했습니다: ${err.message}`
      searchResults.value = []
      return { type: null, results: [] }
    } finally {
      loading.value = false
    }
  }

  /**
   * Element ID 뷰에서 검색
   * @param {string} elementId - Element ID
   * @returns {Promise<Array>} 검색 결과
   */
  const searchFromView = async (elementId) => {
    if (!elementId || !elementId.trim()) {
      return []
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: queryError } = await supabase
        .from('v_element_id_search')
        .select('*')
        .eq('element_id', elementId.trim())

      if (queryError) {
        throw queryError
      }

      return data || []
    } catch (err) {
      console.error('Element ID 뷰 조회 실패:', err)
      error.value = `조회 중 오류가 발생했습니다: ${err.message}`
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Element ID 존재 여부 확인
   * @param {string} elementId - Element ID
   * @returns {Promise<boolean>} 존재 여부
   */
  const elementIdExists = async (elementId) => {
    if (!elementId) return false

    try {
      const { data, error } = await supabase
        .from('set_parts')
        .select('element_id')
        .eq('element_id', elementId.trim())
        .limit(1)

      return !error && data && data.length > 0
    } catch (err) {
      console.error('Element ID 확인 실패:', err)
      return false
    }
  }

  return {
    loading,
    error,
    searchResults,
    searchByElementId,
    getElementIdsByPartColor,
    universalSearch,
    searchFromView,
    elementIdExists
  }
}

