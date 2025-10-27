import { ref } from 'vue'
import { useCategoryManagement } from './useCategoryManagement'

/**
 * 카테고리 없는 경우 자동 처리 시스템
 * - 실시간 카테고리 감지
 * - 자동 제안 및 매핑
 * - 사용자 확인 및 승인
 */
export function useAutoCategoryHandler() {
  const { 
    fetchCategories, 
    findCategoryByCode, 
    handleMissingCategory,
    suggestAutoMapping 
  } = useCategoryManagement()

  const isProcessing = ref(false)
  const pendingItems = ref([])
  const autoSuggestions = ref([])

  /**
   * 부품 처리 시 카테고리 자동 감지
   */
  const processPartCategories = async (partData) => {
    const { part_num, shape_tag, part_name, feature_text } = partData
    
    console.log(`🔍 [카테고리 감지] ${part_num} (${shape_tag})`)
    
    const results = {
      shape: null,
      function: null,
      connection: null,
      needsApproval: false,
      suggestions: []
    }

    // 1. Shape 카테고리 확인
    const shapeCategory = findCategoryByCode(shape_tag)
    if (!shapeCategory) {
      console.log(`⚠️ [Shape 없음] ${shape_tag}`)
      const shapeResult = await handleMissingCategory(shape_tag, part_name, 'shape')
      results.shape = shapeResult
      results.needsApproval = true
    } else {
      results.shape = { category: shapeCategory, needsApproval: false }
    }

    // 2. Function 자동 추론
    const functionSuggestions = suggestAutoMapping(shape_tag, part_name)
    if (functionSuggestions.length > 0) {
      results.suggestions.push(...functionSuggestions)
      results.function = functionSuggestions[0] // 가장 높은 신뢰도
    }

    // 3. Connection 자동 추론
    if (results.function) {
      const connectionMap = {
        'mechanical': 'axle_connection',
        'building_block': 'stud_connection',
        'minifigure': 'ball_connection',
        'decoration': 'stud_connection',
        'connector': 'clip_connection'
      }
      
      results.connection = {
        type: connectionMap[results.function.function] || 'stud_connection',
        confidence: results.function.confidence * 0.9
      }
    }

    // 4. 승인 대기 목록에 추가
    if (results.needsApproval) {
      pendingItems.value.push({
        part_num,
        shape_tag,
        part_name,
        results,
        timestamp: new Date().toISOString()
      })
    }

    return results
  }

  /**
   * 자동 제안 승인
   */
  const approveAutoSuggestion = async (itemIndex, suggestionIndex) => {
    const item = pendingItems.value[itemIndex]
    const suggestion = item.results.suggestions[suggestionIndex]
    
    try {
      // 자동 매핑 적용
      console.log(`✅ [자동 승인] ${item.part_num}: ${suggestion.function}`)
      
      // TODO: 데이터베이스에 자동 매핑 결과 저장
      
      // 대기 목록에서 제거
      pendingItems.value.splice(itemIndex, 1)
      
      return true
    } catch (err) {
      console.error('❌ 자동 승인 실패:', err)
      return false
    }
  }

  /**
   * 수동 카테고리 지정
   */
  const setManualCategory = async (itemIndex, categoryData) => {
    const item = pendingItems.value[itemIndex]
    
    try {
      console.log(`✅ [수동 지정] ${item.part_num}: ${categoryData.function}`)
      
      // TODO: 데이터베이스에 수동 지정 결과 저장
      
      // 대기 목록에서 제거
      pendingItems.value.splice(itemIndex, 1)
      
      return true
    } catch (err) {
      console.error('❌ 수동 지정 실패:', err)
      return false
    }
  }

  /**
   * 일괄 처리
   */
  const processBatchCategories = async (partsData) => {
    isProcessing.value = true
    
    try {
      const results = []
      
      for (const part of partsData) {
        const result = await processPartCategories(part)
        results.push({
          part_num: part.part_num,
          result
        })
      }
      
      console.log(`✅ [일괄 처리] ${results.length}개 부품 처리 완료`)
      return results
    } catch (err) {
      console.error('❌ 일괄 처리 실패:', err)
      throw err
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * 대기 중인 항목 정리
   */
  const clearPendingItems = () => {
    pendingItems.value = []
    console.log('🧹 대기 중인 항목 정리 완료')
  }

  /**
   * 통계 정보
   */
  const getStats = () => {
    return {
      totalPending: pendingItems.value.length,
      needsApproval: pendingItems.value.filter(item => item.results.needsApproval).length,
      autoSuggestions: pendingItems.value.reduce((sum, item) => sum + item.results.suggestions.length, 0)
    }
  }

  return {
    // 상태
    isProcessing,
    pendingItems,
    autoSuggestions,
    
    // 메서드
    processPartCategories,
    approveAutoSuggestion,
    setManualCategory,
    processBatchCategories,
    clearPendingItems,
    getStats
  }
}

