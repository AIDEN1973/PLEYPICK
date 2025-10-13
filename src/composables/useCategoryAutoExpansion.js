// ============================================================================
// 카테고리 자동 확장 시스템 (선택 기능)
// ============================================================================
// 목적: 새로운 shape_tag 발견 시 자동으로 pending_categories에 제안
// 사용: useMasterPartsPreprocessing.js에서 import하여 사용
// ============================================================================

import { supabase } from './useSupabase'

/**
 * 새로운 카테고리 제안 (DB에 없는 shape_tag 발견 시)
 * @param {Object} options - 제안 옵션
 * @param {string} options.code - 카테고리 코드 (예: 'propeller_blade')
 * @param {string} options.displayName - 표시명 (예: 'Propeller Blade')
 * @param {string} options.displayNameKo - 한글 표시명 (예: '프로펠러 날개')
 * @param {string} options.source - 소스 ('llm_analysis' | 'part_name_inference' | 'manual')
 * @param {string} options.partId - 처음 발견된 부품 ID
 */
export async function suggestNewCategory({
  code,
  displayName,
  displayNameKo = '',
  source = 'llm_analysis',
  partId = ''
}) {
  try {
    // RPC 함수 호출 (suggest_new_category)
    const { error } = await supabase.rpc('suggest_new_category', {
      p_code: code,
      p_display_name: displayName,
      p_display_name_ko: displayNameKo,
      p_source: source,
      p_part_id: partId
    });

    if (error) {
      console.error('❌ 카테고리 제안 실패:', error);
      return false;
    }

    console.log(`✨ 새 카테고리 제안: ${code} (${displayName})`);
    return true;
  } catch (err) {
    console.error('❌ 카테고리 제안 오류:', err);
    return false;
  }
}

/**
 * 대기 중인 카테고리 목록 조회
 */
export async function getPendingCategories() {
  try {
    const { data, error } = await supabase
      .from('v_pending_categories_stats')
      .select('*')
      .order('occurrence_count', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('❌ 대기 카테고리 조회 실패:', err);
    return [];
  }
}

/**
 * 카테고리 수동 승인 (관리자용)
 */
export async function approvePendingCategory(code, reviewer = 'admin') {
  try {
    const { data, error } = await supabase.rpc('approve_pending_category', {
      p_code: code,
      p_reviewer: reviewer
    });

    if (error) throw error;
    console.log(`✅ 카테고리 승인: ${code}`);
    return data;
  } catch (err) {
    console.error('❌ 카테고리 승인 실패:', err);
    return false;
  }
}

/**
 * 자동 승인 실행 (10회 이상 발견된 카테고리)
 */
export async function autoApproveFrequentCategories() {
  try {
    const { data, error } = await supabase.rpc('auto_approve_frequent_categories');

    if (error) throw error;
    console.log(`✅ 자동 승인 완료: ${data}개 카테고리`);
    return data;
  } catch (err) {
    console.error('❌ 자동 승인 실패:', err);
    return 0;
  }
}

/**
 * 카테고리 거부 (관리자용)
 */
export async function rejectPendingCategory(code, reviewer = 'admin') {
  try {
    const { error } = await supabase
      .from('pending_categories')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer
      })
      .eq('code', code);

    if (error) throw error;
    console.log(`❌ 카테고리 거부: ${code}`);
    return true;
  } catch (err) {
    console.error('❌ 카테고리 거부 실패:', err);
    return false;
  }
}

/**
 * 카테고리 자동 확장 통합 (useMasterPartsPreprocessing.js에서 사용)
 * @param {string} shapeTag - LLM이 반환한 shape_tag
 * @param {Object} categoryMapping - 현재 카테고리 매핑
 * @param {Object} context - 부품 정보 (part_id, part_name 등)
 */
export async function handleUnknownCategory(shapeTag, categoryMapping, context = {}) {
  // 이미 매핑되어 있으면 스킵
  if (categoryMapping[shapeTag]) {
    return categoryMapping[shapeTag];
  }

  // unknown이면 스킵
  if (shapeTag === 'unknown') {
    return categoryMapping['unknown'] || 99;
  }

  // 새로운 카테고리 제안
  const displayName = shapeTag
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  await suggestNewCategory({
    code: shapeTag,
    displayName: displayName,
    displayNameKo: '', // TODO: 자동 번역 API 사용 가능
    source: 'llm_analysis',
    partId: context.part_id || ''
  });

  console.warn(`⚠️ 새 카테고리 제안됨: ${shapeTag} → pending_categories 테이블에 추가`);
  
  // unknown(99)으로 폴백
  return categoryMapping['unknown'] || 99;
}

/**
 * Composable로 export
 */
export function useCategoryAutoExpansion() {
  return {
    suggestNewCategory,
    getPendingCategories,
    approvePendingCategory,
    autoApproveFrequentCategories,
    rejectPendingCategory,
    handleUnknownCategory
  };
}

