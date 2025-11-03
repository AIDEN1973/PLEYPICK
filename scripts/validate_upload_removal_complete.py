#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
업로드 로직 완전 제거 검증 스크립트
"""

import sys
import re
from pathlib import Path

def check_file(file_path, checks):
    """파일을 검사하고 이슈 목록 반환"""
    if not file_path.exists():
        return [f"파일 없음: {file_path}"]
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    
    for check_name, patterns in checks.items():
        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
            if matches:
                # 주석이나 제거 표시가 있는지 확인
                for match in matches:
                    context_lines = content.split('\n')
                    for i, line in enumerate(context_lines):
                        if match in line:
                            # 주석 처리되었는지 또는 "제거됨" 표시가 있는지 확인
                            if '제거됨' not in line and '수정됨' not in line and not line.strip().startswith('#'):
                                # 함수 정의나 주석이 아닌 경우에만 이슈로 판단
                                if 'def ' not in line and '"""' not in line:
                                    issues.append(f"[{check_name}] {file_path.name}:{i+1}: {line.strip()[:80]}")
    
    return issues

def main():
    """전체 검증 수행"""
    print("=" * 80)
    print("업로드 로직 완전 제거 검증")
    print("=" * 80)
    
    script_path = Path(__file__).parent.parent / 'scripts' / 'render_ldraw_to_supabase.py'
    
    # 검증 항목 정의
    checks = {
        '업로드 함수 호출': [
            r'\.upload\([^)]*\)',
            r'_queue_upload\(',
            r'_process_upload_task\(',
            r'_http_upload_file\(',
            r'upload_to_supabase_direct_http\(',
        ],
        'Storage 업로드': [
            r'storage\.from_\([\'"]lego-synthetic[\'"]\)\.upload',
            r'storage\.from_\([\'"]lego-synthetic[\'"]\)\.upload',
        ],
        '업로드 큐/스레드': [
            r'self\.upload_queue\s*=',
            r'self\.upload_thread\s*=',
            r'upload_queue\.put\(',
            r'upload_queue\.get\(',
        ],
        '업로드 워커': [
            r'def _upload_worker',
            r'def _process_upload_task',
            r'def _http_upload_file',
            r'def _queue_upload',
            r'def _setup_async_io',
        ],
    }
    
    all_issues = []
    
    # 1. 메인 스크립트 검증
    print("\n[1/4] 메인 스크립트 검증: render_ldraw_to_supabase.py")
    issues = check_file(script_path, checks)
    if issues:
        all_issues.extend(issues)
        for issue in issues[:10]:  # 처음 10개만 표시
            print(f"  [WARNING]  {issue}")
        if len(issues) > 10:
            print(f"  ... 외 {len(issues) - 10}개")
    else:
        print("  ✅ 업로드 로직 제거 확인됨")
    
    # 2. upload_to_supabase 함수 내용 확인
    print("\n[2/4] upload_to_supabase 함수 내용 확인")
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    func_pattern = r'def upload_to_supabase\([^)]*\):.*?return None'
    if re.search(func_pattern, content, re.DOTALL):
        print("  ✅ upload_to_supabase 함수가 None 반환하도록 수정됨")
    else:
        all_issues.append("upload_to_supabase 함수가 None을 반환하지 않거나 업로드 로직이 남아있음")
        print("  [WARNING]  upload_to_supabase 함수 확인 필요")
    
    # 3. save_metadata에서 image_url=None 확인
    print("\n[3/4] save_metadata 함수 확인")
    save_metadata_pattern = r"'image_url':\s*None"
    if re.search(save_metadata_pattern, content):
        print("  ✅ save_metadata에서 image_url=None으로 설정됨")
    else:
        all_issues.append("save_metadata에서 image_url이 None으로 설정되지 않음")
        print("  [WARNING]  save_metadata 확인 필요")
    
    # 4. 코드 문법 검증
    print("\n[4/4] 코드 문법 검증")
    try:
        compile(open(script_path, encoding='utf-8').read(), script_path, 'exec')
        print("  ✅ Python 문법 오류 없음")
    except SyntaxError as e:
        all_issues.append(f"문법 오류: {e}")
        print(f"  [ERROR] 문법 오류: {e}")
    
    # 최종 결과
    print("\n" + "=" * 80)
    if all_issues:
        print(f"[ERROR] 검증 실패: {len(all_issues)}개 이슈 발견")
        return False
    else:
        print("✅ 모든 검증 통과")
        return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

