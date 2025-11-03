#!/usr/bin/env python3
"""
qa_logs 테이블 컬럼 확인 스크립트
"""

import os
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 통합 환경변수 관리 시스템 사용
try:
    from scripts.env_integration import get_supabase_config, apply_environment
    apply_environment()
    supabase_config = get_supabase_config()
    supabase_url = supabase_config['url']
    supabase_key = supabase_config['anon_key']
    print("통합 환경변수 관리 시스템을 사용합니다.")
except ImportError:
    # 폴백: 기존 방식
    print("통합 환경변수 관리 시스템을 사용할 수 없습니다. 기본 방식을 사용합니다.")
    from dotenv import load_dotenv
    load_dotenv()
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')

from supabase import create_client

def main():
    
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