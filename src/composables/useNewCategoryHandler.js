import { ref, computed } from 'vue'
import { supabase } from './useSupabase'

/**
 * 새로운 카테고리 처리 시스템
 * - 실시간 감지 및 로깅
 * - 자동 제안 및 승인
 * - 통계 및 모니터링
 */
export function useNewCategoryHandler() {
  const loading = ref(false)
  const error = ref(null)
  const stats = ref({
    total_unknown: 0,
    pending_count: 0,
    suggested_count: 0,
    approved_count: 0,
    rejected_count: 0,
    high_priority_count: 0
  })

  /**
   * 새로운 카테고리 로그 기록
   */
  const logUnknownCategory = async (shapeTag, context = {}) => {
    try {
      const { data, error: logError } = await supabase.rpc('log_unknown_category', {
        p_shape_tag: shapeTag,
        p_part_id: context.part_id || context.part_num || null,
        p_part_name: context.part_name || null,
        p_confidence: context.confidence || 0.0,
        p_source: context.source || 'llm_analysis',
        p_metadata: {
          timestamp: new Date().toISOString(),
          image_url: context.image_url,
          feature_text: context.feature_text,
          distinguishing_features: context.distinguishing_features
        }
      })

      if (logError) throw logError
      
      console.log(`📝 [새 카테고리 로그] ${shapeTag} (${context.part_id})`)
      return data
    } catch (err) {
      console.error('❌ 카테고리 로그 실패:', err)
      throw err
    }
  }

  /**
   * 새로운 카테고리 제안
   */
  const suggestNewCategory = async (categoryData) => {
    try {
      const { data, error: suggestError } = await supabase.rpc('suggest_new_category', {
        p_code: categoryData.code,
        p_display_name: categoryData.display_name,
        p_display_name_ko: categoryData.display_name_ko || '',
        p_source: categoryData.source || 'llm_analysis',
        p_part_id: categoryData.part_id || null
      })

      if (suggestError) throw suggestError
      
      console.log(`✨ [카테고리 제안] ${categoryData.code} → ${categoryData.display_name}`)
      return data
    } catch (err) {
      console.error('❌ 카테고리 제안 실패:', err)
      throw err
    }
  }

  /**
   * 카테고리 승인
   */
  const approveCategory = async (shapeTag, functionValue, connectionValue, reviewer = 'admin', notes = '') => {
    try {
      const { data, error: approveError } = await supabase.rpc('approve_new_category', {
        p_shape_tag: shapeTag,
        p_function: functionValue,
        p_connection: connectionValue,
        p_reviewer: reviewer,
        p_review_notes: notes
      })

      if (approveError) throw approveError
      
      console.log(`✅ [카테고리 승인] ${shapeTag} → ${functionValue}/${connectionValue}`)
      await fetchStats() // 통계 업데이트
      return data
    } catch (err) {
      console.error('❌ 카테고리 승인 실패:', err)
      throw err
    }
  }

  /**
   * 카테고리 거부
   */
  const rejectCategory = async (shapeTag, reviewer = 'admin', notes = '') => {
    try {
      const { data, error: rejectError } = await supabase.rpc('reject_new_category', {
        p_shape_tag: shapeTag,
        p_reviewer: reviewer,
        p_review_notes: notes
      })

      if (rejectError) throw rejectError
      
      console.log(`❌ [카테고리 거부] ${shapeTag}`)
      await fetchStats() // 통계 업데이트
      return data
    } catch (err) {
      console.error('❌ 카테고리 거부 실패:', err)
      throw err
    }
  }

  /**
   * 대기 중인 카테고리 목록 조회
   */
  const fetchPendingCategories = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('pending_categories_view')
        .select('*')
        .order('detection_count', { ascending: false })
        .order('confidence_score', { ascending: false })

      if (fetchError) throw fetchError
      
      return data || []
    } catch (err) {
      console.error('❌ 대기 카테고리 조회 실패:', err)
      throw err
    }
  }

  /**
   * 통계 조회
   */
  const fetchStats = async () => {
    try {
      const { data, error: statsError } = await supabase.rpc('get_category_expansion_stats')
      
      if (statsError) throw statsError
      
      stats.value = data[0] || {
        total_unknown: 0,
        pending_count: 0,
        suggested_count: 0,
        approved_count: 0,
        rejected_count: 0,
        high_priority_count: 0
      }
      
      return stats.value
    } catch (err) {
      console.error('❌ 통계 조회 실패:', err)
      throw err
    }
  }

  /**
   * 해결된 카테고리 로그 정리
   */
  const cleanupResolvedLogs = async (shapeTag) => {
    try {
      const { data, error: cleanupError } = await supabase.rpc('cleanup_resolved_category_logs', {
        p_shape_tag: shapeTag
      })

      if (cleanupError) throw cleanupError
      
      console.log(`🧹 [로그 정리] ${shapeTag} - ${data}개 레코드 정리됨`)
      await fetchStats() // 통계 업데이트
      return data
    } catch (err) {
      console.error('❌ 로그 정리 실패:', err)
      throw err
    }
  }

  /**
   * 자동 제안 생성 (AI 기반)
   */
  const generateAutoSuggestions = (shapeTag, partName, featureText) => {
    const suggestions = []
    
    // 이름 기반 추론
    const nameLower = partName.toLowerCase()
    const featureLower = featureText.toLowerCase()
    
    // 프로펠러 관련
    if (nameLower.includes('propeller') || nameLower.includes('blade') || 
        featureLower.includes('회전') || featureLower.includes('날개')) {
      suggestions.push({
        function: 'mechanical',
        connection: 'axle_connection',
        confidence: 0.9,
        reason: '프로펠러/날개 형태 감지'
      })
    }
    
    // 안테나 관련
    if (nameLower.includes('antenna') || nameLower.includes('antenna') ||
        featureLower.includes('안테나') || featureLower.includes('수신')) {
      suggestions.push({
        function: 'electrical',
        connection: 'stud_connection',
        confidence: 0.8,
        reason: '안테나/전자 부품 감지'
      })
    }
    
    // 태양광 패널 관련
    if (nameLower.includes('solar') || nameLower.includes('panel') ||
        featureLower.includes('태양') || featureLower.includes('광')) {
      suggestions.push({
        function: 'electrical',
        connection: 'stud_connection',
        confidence: 0.85,
        reason: '태양광 패널 감지'
      })
    }
    
    // 기본 추론
    if (suggestions.length === 0) {
      if (nameLower.includes('brick') || nameLower.includes('block')) {
        suggestions.push({
          function: 'building_block',
          connection: 'stud_connection',
          confidence: 0.7,
          reason: '기본 블록 형태'
        })
      } else {
        suggestions.push({
          function: 'unknown',
          connection: 'unknown',
          confidence: 0.5,
          reason: '자동 추론 불가'
        })
      }
    }
    
    return suggestions
  }

  /**
   * 통합 처리 (감지 → 로그 → 제안)
   */
  const handleNewCategory = async (shapeTag, context = {}) => {
    try {
      // 1. 로그 기록
      await logUnknownCategory(shapeTag, context)
      
      // 2. 자동 제안 생성
      const suggestions = generateAutoSuggestions(
        shapeTag, 
        context.part_name || '', 
        context.feature_text || ''
      )
      
      // 3. 가장 높은 신뢰도 제안으로 카테고리 제안
      const bestSuggestion = suggestions[0]
      if (bestSuggestion.confidence > 0.7) {
        await suggestNewCategory({
          code: shapeTag,
          display_name: shapeTag.split('_').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' '),
          display_name_ko: context.part_name || shapeTag,
          source: 'auto_suggestion',
          part_id: context.part_id
        })
      }
      
      return {
        logged: true,
        suggested: bestSuggestion.confidence > 0.7,
        suggestions: suggestions
      }
    } catch (err) {
      console.error('❌ 새 카테고리 처리 실패:', err)
      throw err
    }
  }

  // 계산된 속성
  const highPriorityCategories = computed(() => {
    return stats.value.high_priority_count
  })

  const needsAttention = computed(() => {
    return stats.value.pending_count + stats.value.suggested_count
  })

  return {
    // 상태
    loading,
    error,
    stats,
    
    // 계산된 속성
    highPriorityCategories,
    needsAttention,
    
    // 메서드
    logUnknownCategory,
    suggestNewCategory,
    approveCategory,
    rejectCategory,
    fetchPendingCategories,
    fetchStats,
    cleanupResolvedLogs,
    generateAutoSuggestions,
    handleNewCategory
  }
}

