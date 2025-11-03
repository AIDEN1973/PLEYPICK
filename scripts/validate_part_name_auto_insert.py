#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
part_name 자동 insert 검증 스크립트
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

def validate_part_name_insert():
    """part_name 자동 insert 검증"""
    print("=" * 80)
    print("part_name 자동 insert 검증")
    print("=" * 80)
    
    supabase = setup_supabase()
    
    # 최근 생성된 레코드 확인 (최근 1시간 내)
    print("\n[1] 최근 생성된 parts_master_features 레코드 확인...")
    try:
        from datetime import datetime, timedelta
        one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
        
        response = supabase.table('parts_master_features')\
            .select('part_id, part_name, created_at')\
            .gte('created_at', one_hour_ago)\
            .order('created_at', desc=True)\
            .limit(10)\
            .execute()
        
        if response.data:
            print(f"\n  최근 1시간 내 생성된 레코드: {len(response.data)}개")
            
            # lego_parts와 비교
            part_ids = [r.get('part_id') for r in response.data if r.get('part_id')]
            
            if part_ids:
                lego_response = supabase.table('lego_parts')\
                    .select('part_num, name')\
                    .in_('part_num', part_ids)\
                    .execute()
                
                lego_name_map = {lp.get('part_num'): lp.get('name') for lp in lego_response.data}
                
                print("\n  검증 결과:")
                all_valid = True
                for record in response.data:
                    part_id = record.get('part_id')
                    part_name = record.get('part_name')
                    lego_name = lego_name_map.get(part_id)
                    
                    if not lego_name:
                        status = "[SKIP] lego_parts에 없음"
                    elif part_name == lego_name:
                        status = "[OK] lego_parts와 일치"
                    elif part_name == part_id:
                        status = "[FAIL] part_id와 동일"
                        all_valid = False
                    else:
                        status = "[CHECK] 다른 값"
                    
                    print(f"    {part_id}: part_name={part_name[:50]}")
                    if lego_name:
                        print(f"      lego_parts.name={lego_name[:50]}")
                    print(f"      상태: {status}")
                
                if all_valid:
                    print("\n  [결과] 모든 레코드가 정상입니다.")
                else:
                    print("\n  [경고] 일부 레코드에서 part_name이 part_id와 동일합니다.")
        else:
            print("  최근 생성된 레코드가 없습니다.")
            
    except Exception as e:
        print(f"  오류: {e}")
    
    # parts_master도 확인
    print("\n[2] 최근 생성된 parts_master 레코드 확인...")
    try:
        response = supabase.table('parts_master')\
            .select('part_id, part_name, created_at')\
            .gte('created_at', one_hour_ago)\
            .order('created_at', desc=True)\
            .limit(10)\
            .execute()
        
        if response.data:
            print(f"\n  최근 1시간 내 생성된 레코드: {len(response.data)}개")
            
            part_ids = [r.get('part_id') for r in response.data if r.get('part_id')]
            
            if part_ids:
                lego_response = supabase.table('lego_parts')\
                    .select('part_num, name')\
                    .in_('part_num', part_ids)\
                    .execute()
                
                lego_name_map = {lp.get('part_num'): lp.get('name') for lp in lego_response.data}
                
                print("\n  검증 결과:")
                for record in response.data:
                    part_id = record.get('part_id')
                    part_name = record.get('part_name')
                    lego_name = lego_name_map.get(part_id)
                    
                    if not lego_name:
                        status = "[SKIP] lego_parts에 없음"
                    elif part_name == lego_name:
                        status = "[OK] lego_parts와 일치"
                    elif part_name == part_id:
                        status = "[FAIL] part_id와 동일"
                    else:
                        status = "[CHECK] 다른 값"
                    
                    print(f"    {part_id}: part_name={part_name[:50]} {status}")
        else:
            print("  최근 생성된 레코드가 없습니다.")
            
    except Exception as e:
        print(f"  오류: {e}")
    
    print("\n" + "=" * 80)
    print("검증 완료")
    print("=" * 80)
    print("\n참고:")
    print("- 최근 생성된 레코드가 없으면 정상적인 상황입니다.")
    print("- 새로운 데이터가 생성되면 자동으로 검증됩니다.")

if __name__ == '__main__':
    try:
        validate_part_name_insert()
    except Exception as e:
        print(f"오류 발생: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

