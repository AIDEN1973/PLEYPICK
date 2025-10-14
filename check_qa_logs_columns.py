#!/usr/bin/env python3
"""
qa_logs 테이블 컬럼 확인 스크립트
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
    
    try:
        result = supabase.rpc('exec_sql', {
            'sql': "SELECT column_name FROM information_schema.columns WHERE table_name = 'qa_logs' ORDER BY column_name;"
        })
        print("qa_logs 테이블의 현재 컬럼들:")
        if result and hasattr(result, 'data'):
            for col in result.data:
                print(f"  - {col['column_name']}")
        else:
            print("컬럼 정보를 가져올 수 없습니다.")
    except Exception as e:
        print(f"오류: {e}")

if __name__ == "__main__":
    main()