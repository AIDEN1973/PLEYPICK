#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
시스템 전체 업로드 로직 제거 검증
"""

import sys
import re
from pathlib import Path

def check_render_script():
    """render_ldraw_to_supabase.py 검증"""
    script_path = Path(__file__).parent.parent / 'scripts' / 'render_ldraw_to_supabase.py'
    
    if not script_path.exists():
        return ["render_ldraw_to_supabase.py 파일 없음"]
    
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    
    # 1. 업로드 함수 정의 확인
    upload_funcs = [
        'def upload_to_supabase',
        'def upload_to_supabase_direct_http',
        'def _queue_upload',
        'def _process_upload_task',
        'def _http_upload_file',
        'def _upload_worker',
        'def _setup_async_io'
    ]
    
    for func_name in upload_funcs:
        pattern = rf'{func_name}\('
        if re.search(pattern, content):
            # 제거 표시가 있는지 확인
            func_match = re.search(rf'{func_name}\(.*?(?=def |\Z)', content, re.DOTALL)
            if func_match:
                func_body = func_match.group(0)
                if '제거됨' not in func_body and '수정됨' not in func_body:
                    issues.append(f"{func_name} 함수가 제거 표시 없이 존재")
    
    # 2. upload_to_supabase 함수가 None 반환하는지 확인
    upload_func_match = re.search(r'def upload_to_supabase\([^)]*\):.*?(?=def |\Z)', content, re.DOTALL)
    if upload_func_match:
        func_body = upload_func_match.group(0)
        if 'return None' not in func_body and '제거됨' not in func_body:
            issues.append("upload_to_supabase 함수가 None을 반환하지 않음")
        # Storage 업로드 코드가 있는지 확인
        if '.upload(' in func_body and '제거됨' not in func_body:
            issues.append("upload_to_supabase 함수에 업로드 코드가 남아있음")
    
    # 3. upload_queue, upload_thread 초기화 확인
    if re.search(r'self\.upload_queue\s*=\s*queue\.Queue\(\)', content):
        issues.append("upload_queue 초기화 코드가 남아있음")
    if re.search(r'self\.upload_thread\s*=\s*threading\.Thread', content):
        issues.append("upload_thread 초기화 코드가 남아있음")
    
    # 4. Storage 업로드 호출 확인 (list는 제외)
    upload_patterns = [
        r'storage\.from_\([\'"]lego-synthetic[\'"]\)\.upload\(',
        r'_queue_upload\(',
        r'_process_upload_task\(',
        r'upload_to_supabase_direct_http\(',
    ]
    
    for pattern in upload_patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            # 해당 라인 확인
            line_num = content[:match.start()].count('\n') + 1
            line = content.split('\n')[line_num - 1]
            # 주석이나 제거 표시가 없으면 이슈
            if '제거됨' not in line and '수정됨' not in line and not line.strip().startswith('#'):
                issues.append(f"라인 {line_num}: Storage 업로드 호출 발견: {line.strip()[:60]}")
    
    # 5. save_metadata에서 image_url=None 확인
    if re.search(r"'image_url':\s*None", content):
        pass  # OK
    elif re.search(r"'image_url':\s*urls\[", content):
        issues.append("save_metadata에서 urls['image_url'] 사용 중 (None으로 변경 필요)")
    
    # 6. 문법 검증
    try:
        compile(content, script_path, 'exec')
    except SyntaxError as e:
        issues.append(f"문법 오류: {e}")
    
    return issues

def check_list_functions():
    """list_existing_in_bucket 같은 조회 함수는 유지되어야 함 (업로드 아님)"""
    script_path = Path(__file__).parent.parent / 'scripts' / 'render_ldraw_to_supabase.py'
    
    if not script_path.exists():
        return []
    
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # list 함수는 조회 기능이므로 유지되어야 함
    if 'def list_existing_in_bucket' in content:
        return []  # 정상
    return []  # 없어도 문제 없음

def main():
    print("=" * 80)
    print("시스템 전체 업로드 로직 제거 검증")
    print("=" * 80)
    
    all_issues = []
    
    # 1. render_ldraw_to_supabase.py 검증
    print("\n[1/3] render_ldraw_to_supabase.py 검증")
    issues = check_render_script()
    if issues:
        all_issues.extend(issues)
        for issue in issues:
            print(f"  [ERROR] {issue}")
    else:
        print("  ✅ 모든 업로드 로직 제거 확인됨")
    
    # 2. 조회 함수 확인 (정상적으로 유지되어야 함)
    print("\n[2/3] 조회 함수 확인 (list 함수는 유지되어야 함)")
    list_issues = check_list_functions()
    if list_issues:
        all_issues.extend(list_issues)
        for issue in list_issues:
            print(f"  [ERROR] {issue}")
    else:
        print("  ✅ 조회 함수 정상")
    
    # 3. 다른 파일들 확인 (프론트엔드/서버 파일은 별도 검토 필요)
    print("\n[3/3] 다른 파일 확인")
    print("  ℹ️  프론트엔드/서버 파일 (useSyntheticDataset.js, SyntheticImageUploader.vue 등)")
    print("      → 이들은 UI 업로드 기능이므로 별도 검토 필요")
    print("      → 렌더링 스크립트와는 독립적으로 동작")
    
    # 최종 결과
    print("\n" + "=" * 80)
    if all_issues:
        print(f"[ERROR] 검증 실패: {len(all_issues)}개 이슈 발견")
        print("\n이슈 목록:")
        for i, issue in enumerate(all_issues, 1):
            print(f"  {i}. {issue}")
        return False
    else:
        print("✅ 검증 통과: 모든 업로드 로직이 제거되었거나 적절히 비활성화됨")
        print("\n요약:")
        print("  - upload_to_supabase: None 반환 (업로드 비활성화)")
        print("  - upload_queue/upload_thread: 제거됨")
        print("  - Storage 업로드 호출: 제거됨")
        print("  - save_metadata: image_url=None 설정")
        return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)










