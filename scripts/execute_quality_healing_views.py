#!/usr/bin/env python3
"""
품질 회복 자동률 통계 뷰 실행 스크립트
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
    
    print("[INFO] 품질 회복 자동률 통계 뷰 설정 확인 중...")
    
    # 뷰 존재 여부 확인
    views_to_check = [
        'quality_healing_rate',
        'failure_recovery_analysis', 
        'quality_healing_trends',
        'part_quality_recovery_history',
        'auto_recovery_dashboard'
    ]
    
    existing_views = []
    for view_name in views_to_check:
        try:
            # 뷰 존재 여부 확인 (간단한 쿼리로 테스트)
            result = supabase.from_(view_name).select('*').limit(1).execute()
            existing_views.append(view_name)
            print(f"[SUCCESS] 뷰 '{view_name}' 존재 확인")
        except Exception as e:
            print(f"[WARNING] 뷰 '{view_name}' 확인 실패: {e}")
    
    has_views = len(existing_views) > 0
    
    if has_views:
        print("[SUCCESS] 품질 회복 자동률 통계 뷰가 존재합니다!")
        print("[VIEWS] 사용 가능한 뷰들:")
        for view in existing_views:
            print(f"   - {view}")
    else:
        print("[INFO] 뷰가 아직 생성되지 않았습니다. 대시보드는 기존 qa_logs 테이블을 사용합니다.")
        print("[INFO] SQL 뷰를 수동으로 생성하려면 create_quality_healing_rate_view.sql 파일을 참조하세요.")

if __name__ == "__main__":
    main()
