#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parts_master 테이블에서 part_id와 part_name 동일 여부 검증
"""

import sys
import os
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

try:
    from scripts.env_integration import get_supabase_config, apply_environment
    ENV_MANAGER_AVAILABLE = True
except ImportError:
    ENV_MANAGER_AVAILABLE = False
    import os

try:
    from supabase import create_client
except ImportError:
    print("[ERROR] Supabase 클라이언트가 설치되지 않았습니다.")
    sys.exit(1)

def setup_supabase():
    """Supabase 클라이언트 설정"""
    if ENV_MANAGER_AVAILABLE:
        apply_environment()
        supabase_config = get_supabase_config()
        url = supabase_config.get('url')
        key = supabase_config.get('service_role')
    else:
        url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    if not url or not key:
        raise ValueError("Supabase configuration not found")
    
    return create_client(url, key)

def main():
    """메인 검증 함수"""
    print("=" * 80)
    print("parts_master 테이블 part_id vs part_name 검증")
    print("=" * 80)
    
    supabase = setup_supabase()
    
    # 1. parts_master 데이터 샘플 조회
    print("\n[1] parts_master 데이터 샘플 조회...")
    try:
        response = supabase.table('parts_master').select('part_id, part_name').limit(100).execute()
        
        if not response.data:
            print("데이터가 없습니다.")
            return
        
        total_count = len(response.data)
        identical_count = 0
        different_count = 0
        null_name_count = 0
        
        print(f"\n  총 샘플 수: {total_count}개")
        print(f"\n  샘플 데이터 (처음 10개):")
        
        for i, record in enumerate(response.data[:10]):
            part_id = record.get('part_id')
            part_name = record.get('part_name')
            
            if part_name is None:
                null_name_count += 1
                status = "[NULL]"
            elif part_id == part_name:
                identical_count += 1
                status = "[동일]"
            else:
                different_count += 1
                status = "[다름]"
            
            print(f"    {i+1}. part_id={part_id}, part_name={part_name} {status}")
        
        # 전체 통계
        for record in response.data:
            part_id = record.get('part_id')
            part_name = record.get('part_name')
            
            if part_name is None:
                null_name_count += 1
            elif part_id == part_name:
                identical_count += 1
            else:
                different_count += 1
        
        print(f"\n  통계:")
        print(f"    part_id == part_name: {identical_count}개 ({identical_count/total_count*100:.1f}%)")
        print(f"    part_id != part_name: {different_count}개 ({different_count/total_count*100:.1f}%)")
        print(f"    part_name이 NULL: {null_name_count}개 ({null_name_count/total_count*100:.1f}%)")
        
    except Exception as e:
        print(f"오류: {e}")
        return
    
    # 2. parts_master_features와 비교
    print("\n[2] parts_master_features와 비교...")
    try:
        response_features = supabase.table('parts_master_features').select('part_id, part_name').limit(100).execute()
        
        if response_features.data:
            features_total = len(response_features.data)
            features_identical = sum(1 for r in response_features.data 
                                    if r.get('part_id') == r.get('part_name') and r.get('part_name') is not None)
            
            print(f"  parts_master_features 샘플 수: {features_total}개")
            print(f"  part_id == part_name: {features_identical}개 ({features_identical/features_total*100:.1f}%)")
            
            # 샘플 비교
            print(f"\n  샘플 비교 (처음 5개):")
            for i, record in enumerate(response_features.data[:5]):
                part_id = record.get('part_id')
                part_name = record.get('part_name')
                status = "[동일]" if part_id == part_name else "[다름]"
                print(f"    {i+1}. part_id={part_id}, part_name={part_name} {status}")
                
    except Exception as e:
        print(f"오류: {e}")
    
    # 3. part_name이 실제 부품명인지 확인 (lego_parts와 비교)
    print("\n[3] lego_parts 테이블과 비교...")
    try:
        # parts_master에서 part_id 샘플 가져오기
        sample_part_ids = [r.get('part_id') for r in response.data[:5] if r.get('part_id')]
        
        if sample_part_ids:
            lego_parts_response = supabase.table('lego_parts').select('part_num, name').in_('part_num', sample_part_ids).execute()
            
            if lego_parts_response.data:
                print(f"\n  lego_parts 비교:")
                for lego_part in lego_parts_response.data:
                    part_num = lego_part.get('part_num')
                    name = lego_part.get('name')
                    
                    # parts_master에서 해당 part_id 찾기
                    pm_record = next((r for r in response.data if r.get('part_id') == part_num), None)
                    pm_name = pm_record.get('part_name') if pm_record else None
                    
                    print(f"    part_num={part_num}:")
                    print(f"      lego_parts.name: {name}")
                    print(f"      parts_master.part_name: {pm_name}")
                    if pm_name and name:
                        if pm_name == name:
                            print(f"      [일치] parts_master.part_name = lego_parts.name")
                        elif pm_name == part_num:
                            print(f"      [parts_master.part_name = part_id]")
                        else:
                            print(f"      [다름]")
    except Exception as e:
        print(f"오류: {e}")
    
    # 4. 코드 분석 - part_name 설정 로직 확인
    print("\n[4] 분석 및 결론:")
    
    if identical_count > total_count * 0.9:
        print(f"  [결과] {identical_count/total_count*100:.1f}%의 레코드에서 part_id == part_name")
        print(f"  [의도 추정] part_name이 part_id와 동일하게 설정됨 (초기값 또는 기본값)")
        print(f"  [권장] part_name을 실제 부품명(lego_parts.name)으로 업데이트 고려")
    elif different_count > total_count * 0.5:
        print(f"  [결과] {different_count/total_count*100:.1f}%의 레코드에서 part_id != part_name")
        print(f"  [의도 추정] part_name이 실제 부품명으로 설정됨 (정상)")
    else:
        print(f"  [결과] 혼용 상태")
        print(f"  [의도 추정] part_name 설정 로직이 일관되지 않을 수 있음")
    
    print("\n" + "=" * 80)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"오류 발생: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

