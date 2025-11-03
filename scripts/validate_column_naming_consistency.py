#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
테이블 간 컬럼명 일관성 검증 스크립트
"""

import sys
import os
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 환경변수 관리 시스템 사용
try:
    from scripts.env_integration import get_supabase_config, apply_environment
    ENV_MANAGER_AVAILABLE = True
except ImportError as e:
    ENV_MANAGER_AVAILABLE = False

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

def get_table_columns(supabase, table_name):
    """테이블의 컬럼 정보 조회"""
    try:
        # 정보 스키마 조회 (PostgreSQL)
        query = f"""
        SELECT 
            column_name, 
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = '{table_name}'
        ORDER BY ordinal_position;
        """
        
        # Supabase는 직접 SQL 실행을 지원하지 않으므로 샘플 데이터로 스키마 추론
        # 대신 실제 데이터 샘플을 조회하여 키 확인
        response = supabase.table(table_name).select('*').limit(1).execute()
        
        if response.data and len(response.data) > 0:
            return list(response.data[0].keys())
        return []
    except Exception as e:
        print(f"테이블 {table_name} 컬럼 조회 실패: {e}")
        return []

def main():
    """메인 검증 함수"""
    print("=" * 80)
    print("테이블 간 컬럼명 일관성 검증")
    print("=" * 80)
    
    supabase = setup_supabase()
    
    # 검증 대상 테이블
    target_tables = ['parts_master', 'parts_master_features', 'set_parts']
    
    # 관심 컬럼
    key_columns = ['part_id', 'part_num', 'element_id', 'part_name']
    
    print("\n[1] 테이블별 컬럼명 확인...\n")
    
    table_columns = {}
    for table in target_tables:
        print(f"{table}:")
        try:
            response = supabase.table(table).select('*').limit(1).execute()
            if response.data and len(response.data) > 0:
                columns = list(response.data[0].keys())
                table_columns[table] = columns
                
                # 관심 컬럼만 필터링
                relevant_columns = [col for col in columns if any(key in col.lower() for key in ['part', 'element', 'id', 'name'])]
                for col in relevant_columns:
                    print(f"  - {col}")
            else:
                print(f"  데이터 없음")
                table_columns[table] = []
        except Exception as e:
            print(f"  오류: {e}")
            table_columns[table] = []
        print()
    
    print("\n[2] 컬럼명 일관성 분석...\n")
    
    # 각 키 컬럼이 어떤 테이블에 있는지 확인
    column_presence = {}
    for col in key_columns:
        column_presence[col] = []
        for table in target_tables:
            if col in table_columns.get(table, []):
                column_presence[col].append(table)
    
    print("컬럼별 존재 테이블:")
    for col, tables in column_presence.items():
        if tables:
            print(f"  {col}: {', '.join(tables)}")
            if len(tables) < len(target_tables):
                missing = [t for t in target_tables if t not in tables]
                print(f"    [WARNING] 누락 테이블: {', '.join(missing)}")
        else:
            print(f"  {col}: 없음")
    print()
    
    print("\n[3] JOIN 가능성 분석...\n")
    
    # part_id로 JOIN 가능한지 확인
    if 'part_id' in column_presence and len(column_presence['part_id']) == len(target_tables):
        print("✅ part_id: 모든 테이블에 존재 (JOIN 가능)")
    else:
        print("[WARNING] part_id: 일부 테이블에만 존재")
        print(f"   존재 테이블: {', '.join(column_presence.get('part_id', []))}")
    
    # element_id로 JOIN 가능한지 확인
    if 'element_id' in column_presence and len(column_presence['element_id']) >= 2:
        print("✅ element_id: 2개 이상 테이블에 존재")
        print(f"   존재 테이블: {', '.join(column_presence.get('element_id', []))}")
    else:
        print("[WARNING] element_id: JOIN에 부적합 (1개 이하 테이블에만 존재)")
    
    print("\n[4] 잠재적 문제점 분석...\n")
    
    issues = []
    
    # part_id와 part_num 혼용 확인
    has_part_id = any('part_id' in table_columns.get(t, []) for t in target_tables)
    has_part_num = any('part_num' in table_columns.get(t, []) for t in target_tables)
    
    if has_part_id and has_part_num:
        issues.append("[WARNING] part_id와 part_num이 혼용됨 - 의미 일치 확인 필요")
    
    # element_id 일관성
    element_id_tables = column_presence.get('element_id', [])
    if len(element_id_tables) > 0 and len(element_id_tables) < len(target_tables):
        issues.append(f"[WARNING] element_id가 일부 테이블({', '.join(element_id_tables)})에만 존재")
    
    if issues:
        for issue in issues:
            print(f"  {issue}")
    else:
        print("  ✅ 특별한 문제점 없음")
    
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

