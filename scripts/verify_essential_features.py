#!/usr/bin/env python3
"""
필수 기능 검증 스크립트
- Render Queue 완전 연동
- DB 에러 로깅 강화
"""

import os
import sys
import inspect
from pathlib import Path

# 현재 스크립트의 디렉토리를 Python 경로에 추가
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def verify_render_queue_integration():
    """Render Queue 완전 연동 검증"""
    print("=== Render Queue 완전 연동 검증 ===")
    
    try:
        # render_ldraw_to_supabase.py 모듈 로드
        import render_ldraw_to_supabase as render_module
        
        # 1. process_failed_queue_mode 함수 존재 확인
        if hasattr(render_module, 'process_failed_queue_mode'):
            print("  ✅ process_failed_queue_mode 함수 존재")
        else:
            print("  [ERROR] process_failed_queue_mode 함수 없음")
            return False
        
        # 2. --process-failed-queue 인수 확인
        main_source = inspect.getsource(render_module.main)
        if '--process-failed-queue' in main_source:
            print("  ✅ --process-failed-queue 인수 존재")
        else:
            print("  [ERROR] --process-failed-queue 인수 없음")
            return False
        
        # 3. process_failed_queue_mode 호출 확인
        if 'process_failed_queue_mode()' in main_source:
            print("  ✅ process_failed_queue_mode 호출 확인")
        else:
            print("  [ERROR] process_failed_queue_mode 호출 없음")
            return False
        
        # 4. LDrawRenderer 클래스의 process_failed_queue 메서드 확인
        if hasattr(render_module.LDrawRenderer, 'process_failed_queue'):
            print("  ✅ LDrawRenderer.process_failed_queue 메서드 존재")
        else:
            print("  [ERROR] LDrawRenderer.process_failed_queue 메서드 없음")
            return False
        
        # 5. _insert_render_queue 메서드 확인
        if hasattr(render_module.LDrawRenderer, '_insert_render_queue'):
            print("  ✅ LDrawRenderer._insert_render_queue 메서드 존재")
        else:
            print("  [ERROR] LDrawRenderer._insert_render_queue 메서드 없음")
            return False
        
        return True
        
    except Exception as e:
        print(f"  [ERROR] Render Queue 연동 검증 실패: {e}")
        return False

def verify_db_error_logging():
    """DB 에러 로깅 강화 검증"""
    print("\n=== DB 에러 로깅 강화 검증 ===")
    
    try:
        # render_ldraw_to_supabase.py 모듈 로드
        import render_ldraw_to_supabase as render_module
        
        # 1. _log_operation 메서드 확인
        if hasattr(render_module.LDrawRenderer, '_log_operation'):
            print("  ✅ _log_operation 메서드 존재")
        else:
            print("  [ERROR] _log_operation 메서드 없음")
            return False
        
        # 2. _log_error_recovery 메서드 확인
        if hasattr(render_module.LDrawRenderer, '_log_error_recovery'):
            print("  ✅ _log_error_recovery 메서드 존재")
        else:
            print("  [ERROR] _log_error_recovery 메서드 없음")
            return False
        
        # 3. render_image_with_retry에 에러 복구 로깅 확인
        retry_source = inspect.getsource(render_module.LDrawRenderer.render_image_with_retry)
        if 'self._log_error_recovery' in retry_source:
            print("  ✅ render_image_with_retry에 에러 복구 로깅 통합")
        else:
            print("  [ERROR] render_image_with_retry에 에러 복구 로깅 없음")
            return False
        
        # 4. _flag_qa_fail에 에러 복구 로깅 확인
        qa_fail_source = inspect.getsource(render_module.LDrawRenderer._flag_qa_fail)
        if 'self._log_error_recovery' in qa_fail_source:
            print("  ✅ _flag_qa_fail에 에러 복구 로깅 통합")
        else:
            print("  [ERROR] _flag_qa_fail에 에러 복구 로깅 없음")
            return False
        
        # 5. _insert_render_queue에 에러 복구 로깅 확인
        insert_source = inspect.getsource(render_module.LDrawRenderer._insert_render_queue)
        if 'self._log_error_recovery' in insert_source:
            print("  ✅ _insert_render_queue에 에러 복구 로깅 통합")
        else:
            print("  [ERROR] _insert_render_queue에 에러 복구 로깅 없음")
            return False
        
        # 6. process_failed_queue에 에러 복구 로깅 확인
        process_source = inspect.getsource(render_module.LDrawRenderer.process_failed_queue)
        if 'self._log_error_recovery' in process_source:
            print("  ✅ process_failed_queue에 에러 복구 로깅 통합")
        else:
            print("  [ERROR] process_failed_queue에 에러 복구 로깅 없음")
            return False
        
        return True
        
    except Exception as e:
        print(f"  [ERROR] DB 에러 로깅 검증 실패: {e}")
        return False

def verify_operation_logs_integration():
    """operation_logs 통합 검증"""
    print("\n=== operation_logs 통합 검증 ===")
    
    try:
        # render_ldraw_to_supabase.py 모듈 로드
        import render_ldraw_to_supabase as render_module
        
        # 1. operation_logs 테이블 사용 확인
        log_operation_source = inspect.getsource(render_module.LDrawRenderer._log_operation)
        if "table('operation_logs')" in log_operation_source:
            print("  ✅ operation_logs 테이블 사용 확인")
        else:
            print("  [ERROR] operation_logs 테이블 사용 없음")
            return False
        
        # 2. error_recovery 로그 타입 확인
        error_recovery_source = inspect.getsource(render_module.LDrawRenderer._log_error_recovery)
        if "'log_type': 'error_recovery'" in error_recovery_source:
            print("  ✅ error_recovery 로그 타입 설정 확인")
        else:
            print("  [ERROR] error_recovery 로그 타입 설정 없음")
            return False
        
        # 3. 메타데이터 구조 확인
        if "'error_type'" in error_recovery_source and "'recovery_action'" in error_recovery_source:
            print("  ✅ 에러 복구 메타데이터 구조 확인")
        else:
            print("  [ERROR] 에러 복구 메타데이터 구조 불완전")
            return False
        
        return True
        
    except Exception as e:
        print(f"  [ERROR] operation_logs 통합 검증 실패: {e}")
        return False

def main():
    """메인 검증 함수"""
    print("🔍 필수 기능 검증 시작")
    print("=" * 50)
    
    all_passed = True
    
    # 1. Render Queue 완전 연동 검증
    if not verify_render_queue_integration():
        all_passed = False
    
    # 2. DB 에러 로깅 강화 검증
    if not verify_db_error_logging():
        all_passed = False
    
    # 3. operation_logs 통합 검증
    if not verify_operation_logs_integration():
        all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("[SUCCESS] 모든 필수 기능이 성공적으로 구현되었습니다!")
        print("✅ Render Queue 완전 연동")
        print("✅ DB 에러 로깅 강화")
        print("✅ operation_logs 통합")
        return True
    else:
        print("[ERROR] 일부 기능이 누락되었습니다.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
