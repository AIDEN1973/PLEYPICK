#!/usr/bin/env node
/**
 * 제로벡터 즉시 수정 스크립트
 * - 모든 제로벡터를 NULL로 변경
 * - embedding_status를 'failed'로 설정
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInRcCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixZeroVectors() {
  try {
    console.log('🔍 제로벡터 검색 중...')
    
    // 제로벡터 검색 (모든 값이 "0"인 경우)
    const { data: zeroVectors, error: searchError } = await supabase
      .from('parts_master_features')
      .select('id, part_id, color_id, clip_text_emb')
      .not('clip_text_emb', 'is', null)
    
    if (searchError) {
      console.error('❌ 검색 오류:', searchError)
      return
    }
    
    console.log(`📊 총 ${zeroVectors.length}개 레코드 발견`)
    
    // 제로벡터 필터링
    const actualZeroVectors = zeroVectors.filter(record => {
      const emb = record.clip_text_emb
      if (!Array.isArray(emb)) return false
      
      // 모든 값이 "0"인지 확인
      return emb.every(val => val === "0" || val === 0)
    })
    
    console.log(`🎯 제로벡터: ${actualZeroVectors.length}개`)
    
    if (actualZeroVectors.length === 0) {
      console.log('✅ 제로벡터가 없습니다.')
      return
    }
    
    // 제로벡터를 NULL로 변경하고 상태를 'failed'로 설정
    const ids = actualZeroVectors.map(r => r.id)
    
    console.log('🔧 제로벡터 수정 중...')
    
    const { error: updateError } = await supabase
      .from('parts_master_features')
      .update({
        clip_text_emb: null,
        embedding_status: 'failed'
      })
      .in('id', ids)
    
    if (updateError) {
      console.error('❌ 업데이트 오류:', updateError)
      return
    }
    
    console.log(`✅ ${actualZeroVectors.length}개 제로벡터 수정 완료`)
    console.log('📝 수정된 레코드 ID:', ids.slice(0, 10).join(', '), ids.length > 10 ? '...' : '')
    
  } catch (error) {
    console.error('❌ 스크립트 오류:', error)
  }
}

fixZeroVectors()
