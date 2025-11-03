#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
모든 테이블의 part_name 상태 확인
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

def check_table_part_name(supabase, table_name):
    """테이블의 part_name 상태 확인"""
    try:
        # 샘플 데이터 조회
        response = supabase.table(table_name).select('part_id, part_name').limit(100).execute()
        
        if not response.data:
            return None
        
        total = len(response.data)
        identical = sum(1 for r in response.data if r.get('part_id') == r.get('part_name'))
        different = sum(1 for r in response.data if r.get('part_id') != r.get('part_name') and r.get('part_name'))
        null_count = sum(1 for r in response.data if r.get('part_name') is None)
        
        return {
            'table': table_name,
            'total': total,
            'identical': identical,
            'different': different,
            'null_count': null_count,
            'identical_pct': (identical / total * 100) if total > 0 else 0
        }
    except Exception as e:
        return {
            'table': table_name,
            'error': str(e)
        }

def main():
    """메인 함수"""
    print("=" * 80)
    print("모든 테이블의 part_name 상태 확인")
    print("=" * 80)
    
    supabase = setup_supabase()
    
    # part_name 컬럼이 있는 테이블 목록 (스키마에서 확인한 테이블들)
    tables_with_part_name = [
        'parts_master',
        'parts_master_features',
        'parts_master_core',
        'store_inventory',
        'unified_category_view'
    ]
    
    print("\n[1] 각 테이블별 part_name 상태 확인...\n")
    
    results = []
    for table in tables_with_part_name:
        print(f"  {table} 확인 중...")
        result = check_table_part_name(supabase, table)
        if result:
            results.append(result)
            if 'error' in result:
                print(f"    오류: {result['error']}")
            else:
                print(f"    총 {result['total']}개 레코드:")
                print(f"      part_id == part_name: {result['identical']}개 ({result['identical_pct']:.1f}%)")
                print(f"      part_id != part_name: {result['different']}개")
                print(f"      part_name이 NULL: {result['null_count']}개")
    
    print("\n[2] 요약 통계\n")
    print(f"{'테이블':<30} {'총 레코드':<12} {'동일':<10} {'다름':<10} {'NULL':<10} {'동일 비율':<10}")
    print("-" * 80)
    
    for result in results:
        if 'error' not in result:
            print(f"{result['table']:<30} {result['total']:<12} {result['identical']:<10} {result['different']:<10} {result['null_count']:<10} {result['identical_pct']:<10.1f}%")
    
    print("\n[3] lego_parts와 일치 여부 확인 (parts_master 샘플)\n")
    
    try:
        # parts_master 샘플
        pm_response = supabase.table('parts_master').select('part_id, part_name').limit(10).execute()
        
        if pm_response.data:
            part_ids = [r.get('part_id') for r in pm_response.data[:5] if r.get('part_id')]
            
            if part_ids:
                lp_response = supabase.table('lego_parts').select('part_num, name').in_('part_num', part_ids).execute()
                
                if lp_response.data:
                    print("  샘플 비교:")
                    for lego_part in lp_response.data:
                        part_num = lego_part.get('part_num')
                        lego_name = lego_part.get('name')
                        
                        pm_record = next((r for r in pm_response.data if r.get('part_id') == part_num), None)
                        pm_name = pm_record.get('part_name') if pm_record else None
                        
                        status = "일치" if pm_name == lego_name else ("part_id와 동일" if pm_name == part_num else "다름")
                        print(f"    {part_num}:")
                        print(f"      lego_parts.name: {lego_name[:60]}...")
                        print(f"      parts_master.part_name: {pm_name}")
                        print(f"      상태: {status}")
    except Exception as e:
        print(f"  오류: {e}")
    
    print("\n" + "=" * 80)
    print("검증 완료")
    print("=" * 80)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"오류 발생: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

