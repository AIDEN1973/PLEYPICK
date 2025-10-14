#!/usr/bin/env python3
"""
qa_logs 테이블 권한 및 RLS 정책 설정 스크립트
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def main():
    load_dotenv()
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("Supabase 환경 변수가 설정되지 않았습니다.")
        sys.exit(1)
    
    supabase = create_client(supabase_url, supabase_key)
    
    # SQL 명령어들
    sql_commands = [
        "ALTER TABLE qa_logs ENABLE ROW LEVEL SECURITY;",
        """CREATE POLICY "qa_logs_select_policy" ON qa_logs
            FOR SELECT
            TO authenticated
            USING (true);""",
        """CREATE POLICY "qa_logs_insert_policy" ON qa_logs
            FOR INSERT
            TO authenticated
            WITH CHECK (true);""",
        """CREATE POLICY "qa_logs_update_policy" ON qa_logs
            FOR UPDATE
            TO authenticated
            USING (true)
            WITH CHECK (true);""",
        """CREATE POLICY "qa_logs_delete_policy" ON qa_logs
            FOR DELETE
            TO authenticated
            USING (true);""",
        """CREATE POLICY "qa_logs_anon_select_policy" ON qa_logs
            FOR SELECT
            TO anon
            USING (true);"""
    ]
    
    print("qa_logs 테이블 권한 설정 시작...")
    
    success_count = 0
    for i, sql in enumerate(sql_commands, 1):
        try:
            result = supabase.rpc('exec_sql', {'sql': sql})
            print(f"성공 {i}/{len(sql_commands)}: {sql[:50]}...")
            success_count += 1
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"이미 존재 {i}/{len(sql_commands)}: {sql[:50]}...")
                success_count += 1
            else:
                print(f"실패 {i}/{len(sql_commands)}: {sql[:50]}... - {e}")
    
    print(f"\nqa_logs 권한 설정 완료! ({success_count}/{len(sql_commands)} 성공)")
    
    # 테이블 RLS 상태 확인
    try:
        result = supabase.rpc('exec_sql', {
            'sql': "SELECT schemaname, tablename, rowsecurity, hasrules FROM pg_tables WHERE tablename = 'qa_logs';"
        })
        print("\nqa_logs 테이블 RLS 상태:")
        if result and hasattr(result, 'data'):
            for row in result.data:
                print(f"  - RLS 활성화: {row.get('hasrules', 'Unknown')}")
        else:
            print("RLS 상태를 확인할 수 없습니다.")
    except Exception as e:
        print(f"RLS 상태 확인 실패: {e}")

if __name__ == "__main__":
    main()
