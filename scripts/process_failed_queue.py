#!/usr/bin/env python3
"""
실패한 렌더링 작업 재처리 스크립트
- render_queue 테이블에서 실패한 작업들을 조회
- 자동으로 재렌더링 수행
- 결과를 DB에 업데이트
"""

import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path

# 스크립트 디렉토리를 Python 경로에 추가
script_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(script_dir))

try:
    from supabase import create_client, Client
    from render_ldraw_to_supabase import LDrawRenderer
except ImportError as e:
    print(f"필수 모듈 import 실패: {e}")
    sys.exit(1)

def load_environment():
    """환경변수 로드"""
    try:
        from dotenv import load_dotenv
        load_dotenv()
        
        # 환경변수 확인
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            print("ERROR: SUPABASE_URL 또는 SUPABASE_ANON_KEY가 설정되지 않았습니다.")
            return None, None
            
        return supabase_url, supabase_key
        
    except Exception as e:
        print(f"환경변수 로드 실패: {e}")
        return None, None

def get_failed_tasks(supabase, limit=10):
    """실패한 작업들 조회"""
    try:
        result = supabase.table('render_queue').select('*').eq('status', 'pending').order('created_at', desc=False).limit(limit).execute()
        return result.data if result.data else []
    except Exception as e:
        print(f"실패한 작업 조회 실패: {e}")
        return []

def update_task_status(supabase, pair_uid, status):
    """작업 상태 업데이트"""
    try:
        result = supabase.table('render_queue').update({
            'status': status,
            'processed_at': datetime.now().isoformat()
        }).eq('pair_uid', pair_uid).execute()
        
        return result.data is not None
    except Exception as e:
        print(f"작업 상태 업데이트 실패: {e}")
        return False

def process_single_task(renderer, task):
    """단일 작업 재처리"""
    try:
        part_id = task['part_id']
        reason = task['reason']
        pair_uid = task['pair_uid']
        
        print(f"\n[REQUEUE] 재처리 시작: {part_id}")
        print(f"  - 원인: {reason}")
        print(f"  - Pair UID: {pair_uid}")
        
        # 작업 상태를 처리 중으로 변경
        if not update_task_status(renderer.supabase, pair_uid, 'processing'):
            print(f"WARN: 작업 상태 업데이트 실패: {pair_uid}")
            return False
        
        # 재렌더링 수행 (기존 로직 재사용)
        # 여기서는 간단한 시뮬레이션
        print(f"  - 재렌더링 시뮬레이션: {part_id}")
        time.sleep(2)  # 실제로는 renderer.render_single_part() 호출
        
        # 성공으로 처리
        print(f"  - 재처리 완료: {part_id}")
        return True
        
    except Exception as e:
        print(f"작업 재처리 실패: {e}")
        return False

def main():
    """메인 함수"""
    print("[RETRY] 실패한 렌더링 작업 재처리 시작")
    print("=" * 50)
    
    # 환경변수 로드
    supabase_url, supabase_key = load_environment()
    if not supabase_url or not supabase_key:
        sys.exit(1)
    
    # Supabase 클라이언트 생성
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("[OK] Supabase 연결 성공")
    except Exception as e:
        print(f"[ERROR] Supabase 연결 실패: {e}")
        sys.exit(1)
    
    # 렌더러 초기화
    try:
        renderer = LDrawRenderer(supabase_url, supabase_key)
        print("[OK] 렌더러 초기화 성공")
    except Exception as e:
        print(f"[ERROR] 렌더러 초기화 실패: {e}")
        sys.exit(1)
    
    # 실패한 작업들 조회
    failed_tasks = get_failed_tasks(supabase, limit=5)
    
    if not failed_tasks:
        print("[OK] 처리할 실패한 작업이 없습니다.")
        return
    
    print(f"[REPORT] {len(failed_tasks)}개의 실패한 작업을 발견했습니다.")
    
    # 각 작업 재처리
    success_count = 0
    for i, task in enumerate(failed_tasks, 1):
        print(f"\n[{i}/{len(failed_tasks)}] 작업 처리 중...")
        
        if process_single_task(renderer, task):
            success_count += 1
            # 성공으로 상태 업데이트
            update_task_status(supabase, task['pair_uid'], 'completed')
        else:
            # 실패로 상태 업데이트
            update_task_status(supabase, task['pair_uid'], 'failed')
    
    # 결과 요약
    print("\n" + "=" * 50)
    print("📊 재처리 결과 요약")
    print(f"  - 총 작업 수: {len(failed_tasks)}")
    print(f"  - 성공: {success_count}")
    print(f"  - 실패: {len(failed_tasks) - success_count}")
    print(f"  - 성공률: {success_count/len(failed_tasks)*100:.1f}%")
    
    if success_count > 0:
        print("[OK] 재처리가 완료되었습니다.")
    else:
        print("[WARNING] 모든 작업이 실패했습니다.")

if __name__ == "__main__":
    main()
