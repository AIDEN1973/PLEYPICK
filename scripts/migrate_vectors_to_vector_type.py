#!/usr/bin/env python3
"""
VECTOR 타입 마이그레이션 스크립트
기존 ARRAY 타입 데이터를 VECTOR(768)로 변환
"""

import os
import sys
from supabase import create_client, Client
import numpy as np
from typing import List, Optional

# 환경 변수에서 Supabase 정보 로드
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not supabase_key:
    print("[ERROR] 환경 변수 설정 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

def convert_array_to_vector(array_data) -> Optional[List[float]]:
    """문자열 배열을 숫자 배열로 변환"""
    if not array_data or not isinstance(array_data, list):
        return None
    
    try:
        # 문자열을 숫자로 변환
        vector = []
        for item in array_data:
            if isinstance(item, str):
                val = float(item)
            elif isinstance(item, (int, float)):
                val = float(item)
            else:
                return None
            vector.append(val)
        
        # 768차원 검증
        if len(vector) != 768:
            return None
        
        return vector
    except (ValueError, TypeError) as e:
        print(f"[WARNING] 변환 실패: {e}")
        return None

def migrate_vectors():
    """ARRAY 타입 데이터를 VECTOR(768)로 마이그레이션"""
    print("[START] VECTOR 타입 마이그레이션 시작...")
    
    # 1. 기존 데이터 조회
    print("📊 기존 데이터 조회 중...")
    response = supabase.table('parts_master_features') \
        .select('id, part_id, color_id, clip_text_emb, semantic_vector') \
        .not_.is_('clip_text_emb', 'null') \
        .or_('semantic_vector.not.is.null') \
        .limit(1000) \
        .execute()
    
    total = len(response.data)
    print(f"📊 총 {total}개 레코드 발견")
    
    if total == 0:
        print("[OK] 마이그레이션할 데이터 없음")
        return
    
    # 2. 변환 및 업데이트
    success_count = 0
    error_count = 0
    
    for i, record in enumerate(response.data):
        part_id = record.get('part_id')
        color_id = record.get('color_id')
        record_id = record.get('id')
        
        update_data = {}
        
        # clip_text_emb 변환
        if record.get('clip_text_emb'):
            clip_vector = convert_array_to_vector(record['clip_text_emb'])
            if clip_vector:
                update_data['clip_text_emb'] = clip_vector
            else:
                print(f"[WARNING] clip_text_emb 변환 실패: {part_id}/{color_id}")
        
        # semantic_vector 변환
        if record.get('semantic_vector'):
            semantic_vector = convert_array_to_vector(record['semantic_vector'])
            if semantic_vector:
                update_data['semantic_vector'] = semantic_vector
            else:
                print(f"[WARNING] semantic_vector 변환 실패: {part_id}/{color_id}")
        
        # 업데이트 실행
        if update_data:
            try:
                supabase.table('parts_master_features') \
                    .update(update_data) \
                    .eq('id', record_id) \
                    .execute()
                success_count += 1
                
                if (i + 1) % 100 == 0:
                    print(f"📊 진행 중: {i + 1}/{total} ({success_count}개 성공, {error_count}개 실패)")
            except Exception as e:
                error_count += 1
                print(f"[ERROR] 업데이트 실패 ({part_id}/{color_id}): {e}")
    
    print(f"\n[OK] 마이그레이션 완료:")
    print(f"   - 성공: {success_count}개")
    print(f"   - 실패: {error_count}개")
    print(f"   - 총계: {total}개")

if __name__ == '__main__':
    migrate_vectors()








