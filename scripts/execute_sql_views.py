#!/usr/bin/env python3
"""
Supabase에서 품질 회복 뷰 생성 스크립트
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def main():
    load_dotenv()
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    if not supabase_url or not supabase_key:
        print("[ERROR] Supabase 환경 변수가 설정되지 않았습니다.")
        sys.exit(1)
    
    supabase = create_client(supabase_url, supabase_key)
    
    # SQL 파일 읽기
    try:
        with open('scripts/create_quality_views.sql', 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print("[INFO] 품질 회복 뷰 생성 중...")
        
        # SQL을 개별 문장으로 분할
        sql_statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip() and not stmt.strip().startswith('--')]
        
        success_count = 0
        for i, sql_stmt in enumerate(sql_statements):
            try:
                if sql_stmt.upper().startswith('CREATE') or sql_stmt.upper().startswith('GRANT') or sql_stmt.upper().startswith('COMMENT'):
                    # DDL 문장은 직접 실행할 수 없으므로 스킵
                    print(f"[SKIP] DDL 문장 {i+1}: {sql_stmt[:50]}...")
                    continue
                else:
                    # 일반 쿼리 실행
                    result = supabase.rpc('exec_sql', {'sql': sql_stmt}).execute()
                    if result.data:
                        success_count += 1
                        print(f"[SUCCESS] 문장 {i+1} 실행 완료")
            except Exception as e:
                print(f"[WARNING] 문장 {i+1} 실행 실패: {e}")
        
        if success_count > 0:
            print(f"[SUCCESS] {success_count}개 문장 실행 완료!")
        else:
            print("[INFO] DDL 문장들은 Supabase Dashboard에서 수동으로 실행하세요.")
            print("[INFO] SQL 파일: scripts/create_quality_views.sql")
            
    except FileNotFoundError:
        print("[ERROR] scripts/create_quality_views.sql 파일을 찾을 수 없습니다.")
    except Exception as e:
        print(f"[ERROR] 뷰 생성 중 오류 발생: {e}")

if __name__ == "__main__":
    main()
