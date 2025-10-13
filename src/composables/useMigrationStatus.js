/**
 * 🖼️ 이미지 마이그레이션 상태 확인
 * 
 * 이미지 마이그레이션 완료를 확인하는 폴링 시스템
 * - 하드코딩 대기 시간 제거
 * - 실제 마이그레이션 완료 확인
 * - 타임아웃 처리
 */

import { supabase } from './useSupabase'

/**
 * 이미지 마이그레이션 상태 확인
 */
export async function checkMigrationStatus(setNum) {
  try {
    // 간소화된 로직: image_metadata 테이블만 사용
    // (set_parts 테이블 의존성 제거)
    
    // 1. 해당 세트의 이미지 메타데이터 확인
    // ✅ webp_ready 컬럼 제거 (스키마에 없음)
    const { data: imageData, error: imageError } = await supabase
      .from('image_metadata')
      .select('id, original_url, supabase_url')
      .like('original_url', `%/${setNum}-%`)
      .limit(100) // 최대 100개까지만 확인

    if (imageError) {
      console.warn('⚠️ image_metadata 조회 실패, 완료로 간주:', imageError.message)
      // 오류 발생 시 완료로 간주하고 LLM 분석 진행
      return {
        total: 1,
        uploaded: 1,
        completed: true
      }
    }

    // 데이터가 없으면 즉시 완료로 간주 (마이그레이션 불필요)
    if (!imageData || imageData.length === 0) {
      console.log('📊 이미지 메타데이터 없음, 마이그레이션 완료로 간주')
      return {
        total: 0,
        uploaded: 0,
        completed: true
      }
    }

    // 2. WebP 준비된 이미지 카운트 (supabase_url 존재 여부로 판단)
    const total = imageData.length
    const uploaded = imageData.filter(img => 
      img.supabase_url && img.supabase_url.trim() !== ''
    ).length

    const completionRate = total > 0 ? uploaded / total : 1
    const completed = completionRate >= 0.8 // 80% 이상이면 완료

    return {
      total,
      uploaded,
      completed,
      completionRate: Math.round(completionRate * 100)
    }
    
  } catch (err) {
    console.error('❌ 마이그레이션 상태 확인 실패:', err)
    // 오류 시 완료로 간주하고 진행
    return {
      total: 1,
      uploaded: 1,
      completed: true,
      error: err.message
    }
  }
}

/**
 * 이미지 마이그레이션 완료 대기 (폴링 방식)
 * 
 * @param {string} setNum - 세트 번호
 * @param {number} maxWaitMs - 최대 대기 시간 (ms)
 * @param {number} checkIntervalMs - 체크 간격 (ms)
 * @returns {Promise<boolean>} - 완료 여부
 */
export async function waitForMigrationComplete(
  setNum,
  maxWaitMs = 120000, // 기본 2분
  checkIntervalMs = 2000 // 기본 2초마다 확인
) {
  const startTime = Date.now()
  
  console.log(`⏳ 이미지 마이그레이션 완료 대기 시작... (최대 ${maxWaitMs / 1000}초)`)

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkMigrationStatus(setNum)
    
    if (status.total > 0) {
      const progress = status.completionRate || Math.round((status.uploaded / status.total) * 100)
      console.log(`📊 마이그레이션 진행률: ${status.uploaded}/${status.total} (${progress}%)`)
    } else {
      console.log(`📊 마이그레이션 확인 중... (메타데이터 대기)`)
    }
    
    if (status.completed) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`✅ 이미지 마이그레이션 완료! (${elapsed}초 소요)`)
      return true
    }
    
    // 대기
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
  }
  
  // 타임아웃
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.warn(`⚠️ 이미지 마이그레이션 타임아웃 (${elapsed}초 소요)`)
  console.warn(`   원본 이미지로 LLM 분석을 진행합니다.`)
  
  return false
}

/**
 * 간소화된 대기 (기존 코드와의 호환성)
 */
export async function waitForMigration(maxWaitMs = 120000) {
  // 세트 번호 없이 호출된 경우 기본 대기
  console.log(`⏳ 이미지 마이그레이션 기본 대기... (${maxWaitMs / 1000}초)`)
  
  const startTime = Date.now()
  const checkInterval = 2000
  
  while (Date.now() - startTime < maxWaitMs) {
    // 전체 마이그레이션 큐 확인 (선택적)
    try {
      const { count, error } = await supabase
        .from('image_migration_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      
      if (!error && count === 0) {
        console.log(`✅ 마이그레이션 큐가 비었습니다.`)
        return true
      }
    } catch {
      // 테이블이 없으면 무시
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }
  
  console.warn(`⚠️ 마이그레이션 대기 타임아웃`)
  return false
}

