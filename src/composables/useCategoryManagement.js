import { ref, reactive } from 'vue'
import { supabase } from './useSupabase'

/**
 * 카테고리 관리 시스템
 * - 데이터베이스 기반 카테고리 조회
 * - 카테고리 없는 경우 처리
 * - 카테고리 제안 및 추가
 */
export function useCategoryManagement() {
  const loading = ref(false)
  const error = ref(null)
  const categories = ref([])
  const pendingCategories = ref([]) // 승인 대기 중인 카테고리

  // 카테고리 타입별 매핑
  const CATEGORY_TYPE_MAP = {
    'shape': 'building_block',
    'function': 'mechanical', 
    'connection': 'stud_connection',
    'color': 'decoration'
  }

  /**
   * 모든 활성 카테고리 조회
   */
  const fetchCategories = async () => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: fetchError } = await supabase
        .from('part_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (fetchError) throw fetchError
      
      categories.value = data || []
      console.log(`✅ 카테고리 조회 완료: ${categories.value.length}개`)
      
      return categories.value
    } catch (err) {
      error.value = err.message
      console.error('❌ 카테고리 조회 실패:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 특정 shape_tag에 대한 카테고리 검색
   */
  const findCategoryByCode = (code) => {
    return categories.value.find(cat => cat.code === code)
  }

  /**
   * 카테고리가 없는 경우 처리
   */
  const handleMissingCategory = async (shapeTag, partName, categoryType = 'shape') => {
    console.log(`🔍 [카테고리 없음] ${shapeTag} (${categoryType})`)
    
    // 1. 유사한 카테고리 검색
    const similarCategories = findSimilarCategories(shapeTag, categoryType)
    
    // 2. 제안 카테고리 생성
    const suggestedCategory = {
      code: shapeTag,
      display_name: partName || shapeTag,
      display_name_ko: partName || shapeTag,
      category_type: categoryType,
      description: `자동 생성된 ${categoryType} 카테고리`,
      parent_id: null,
      is_active: false, // 승인 전까지 비활성
      sort_order: categories.value.length + 1,
      suggested_by: 'system',
      suggested_at: new Date().toISOString()
    }

    // 3. 대기 목록에 추가
    pendingCategories.value.push(suggestedCategory)
    
    return {
      category: null,
      similar: similarCategories,
      suggested: suggestedCategory,
      needsApproval: true
    }
  }

  /**
   * 유사한 카테고리 검색
   */
  const findSimilarCategories = (shapeTag, categoryType) => {
    const similar = categories.value.filter(cat => 
      cat.category_type === categoryType &&
      (
        cat.code.toLowerCase().includes(shapeTag.toLowerCase()) ||
        cat.display_name.toLowerCase().includes(shapeTag.toLowerCase()) ||
        cat.display_name_ko.includes(shapeTag)
      )
    )
    
    return similar.slice(0, 3) // 최대 3개 제안
  }

  /**
   * 새 카테고리 제안
   */
  const suggestNewCategory = async (categoryData) => {
    try {
      const { data, error: insertError } = await supabase
        .from('part_categories')
        .insert({
          ...categoryData,
          is_active: false,
          suggested_by: 'user',
          suggested_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) throw insertError
      
      console.log(`✅ 카테고리 제안 완료: ${categoryData.code}`)
      return data
    } catch (err) {
      console.error('❌ 카테고리 제안 실패:', err)
      throw err
    }
  }

  /**
   * 카테고리 승인 (관리자용)
   */
  const approveCategory = async (categoryId) => {
    try {
      const { data, error: updateError } = await supabase
        .from('part_categories')
        .update({ 
          is_active: true,
          approved_at: new Date().toISOString()
        })
        .eq('id', categoryId)
        .select()
        .single()

      if (updateError) throw updateError
      
      // 로컬 상태 업데이트
      const index = pendingCategories.value.findIndex(cat => cat.id === categoryId)
      if (index !== -1) {
        pendingCategories.value.splice(index, 1)
        categories.value.push(data)
      }
      
      console.log(`✅ 카테고리 승인 완료: ${data.code}`)
      return data
    } catch (err) {
      console.error('❌ 카테고리 승인 실패:', err)
      throw err
    }
  }

  /**
   * 카테고리 거부 (관리자용)
   */
  const rejectCategory = async (categoryId, reason = '') => {
    try {
      const { error: updateError } = await supabase
        .from('part_categories')
        .update({ 
          is_active: false,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', categoryId)

      if (updateError) throw updateError
      
      // 로컬 상태에서 제거
      const index = pendingCategories.value.findIndex(cat => cat.id === categoryId)
      if (index !== -1) {
        pendingCategories.value.splice(index, 1)
      }
      
      console.log(`✅ 카테고리 거부 완료: ${categoryId}`)
    } catch (err) {
      console.error('❌ 카테고리 거부 실패:', err)
      throw err
    }
  }

  /**
   * 카테고리 자동 매핑 제안
   */
  const suggestAutoMapping = (shapeTag, partName) => {
    const suggestions = []
    
    // 이름 기반 추론
    const nameLower = partName.toLowerCase()
    
    if (nameLower.includes('wheel') || nameLower.includes('gear')) {
      suggestions.push({
        function: 'mechanical',
        connection: 'axle_connection',
        confidence: 0.9
      })
    }
    
    if (nameLower.includes('brick') || nameLower.includes('plate')) {
      suggestions.push({
        function: 'building_block',
        connection: 'stud_connection',
        confidence: 0.8
      })
    }
    
    if (nameLower.includes('minifig') || nameLower.includes('figure')) {
      suggestions.push({
        function: 'minifigure',
        connection: 'ball_connection',
        confidence: 0.9
      })
    }
    
    return suggestions
  }

  return {
    // 상태
    loading,
    error,
    categories,
    pendingCategories,
    
    // 메서드
    fetchCategories,
    findCategoryByCode,
    handleMissingCategory,
    suggestNewCategory,
    approveCategory,
    rejectCategory,
    suggestAutoMapping
  }
}

