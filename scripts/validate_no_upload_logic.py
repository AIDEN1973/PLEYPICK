#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
업로드 로직 제거 검증 스크립트
"""

import sys
import re
from pathlib import Path

def validate_no_upload_logic():
    """업로드 로직이 완전히 제거되었는지 검증"""
    script_path = Path(__file__).parent.parent / 'scripts' / 'render_ldraw_to_supabase.py'
    
    if not script_path.exists():
        print(f"[ERROR] 파일이 존재하지 않음: {script_path}")
        return False
    
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    
    # 1. upload_to_supabase 함수 확인 (None 반환만 해야 함)
    upload_func_pattern = r'def upload_to_supabase\([^)]*\):.*?(?=def |\Z)'
    upload_func_match = re.search(upload_func_pattern, content, re.DOTALL)
    
    if upload_func_match:
        func_content = upload_func_match.group(0)
        
        # Storage 업로드 관련 코드가 있는지 확인
        upload_keywords = [
            'storage.from_',
            'lego-synthetic',
            '.upload(',
            '_queue_upload',
            '_process_upload_task',
            '_http_upload_file',
            'upload_queue',
            'upload_thread'
        ]
        
        for keyword in upload_keywords:
            if keyword in func_content and '제거됨' not in func_content and '수정됨' not in func_content:
                issues.append(f"upload_to_supabase 함수에 업로드 관련 코드 발견: {keyword}")
    
    # 2. 제거된 함수들이 호출되지 않는지 확인
    removed_functions = [
        '_queue_upload',
        '_process_upload_task',
        '_http_upload_file',
        '_upload_worker',
        '_setup_async_io',
        'upload_to_supabase_direct_http'
    ]
    
    for func_name in removed_functions:
        # 함수 호출 패턴 검색 (함수 정의는 제외)
        pattern = rf'[^_]\.{func_name}\('
        matches = re.findall(pattern, content)
        if matches:
            issues.append(f"제거된 함수 호출 발견: {func_name}()")
    
    # 3. upload_queue, upload_thread 초기화 제거 확인
    if 'self.upload_queue = queue.Queue()' in content or 'self.upload_queue = Queue()' in content:
        issues.append("upload_queue 초기화 코드가 남아있음")
    
    if 'self.upload_thread = threading.Thread' in content:
        issues.append("upload_thread 초기화 코드가 남아있음")
    
    # 4. lego-synthetic bucket 직접 사용 확인
    if 'lego-synthetic' in content and '.upload(' in content:
        issues.append("lego-synthetic bucket 업로드 코드가 남아있음")
    
    # 5. save_metadata에서 image_url=None 확인
    if 'image_url' in content:
        save_metadata_pattern = r'def save_metadata\([^)]*\):.*?(?=def |\Z)'
        save_metadata_match = re.search(save_metadata_pattern, content, re.DOTALL)
        if save_metadata_match:
            metadata_func = save_metadata_match.group(0)
            if "'image_url': urls['image_url']" in metadata_func or '"image_url": urls["image_url"]' in metadata_func:
                issues.append("save_metadata에서 urls['image_url'] 사용 발견 (None으로 변경 필요)")
    
    # 결과 출력
    print("=" * 80)
    print("업로드 로직 제거 검증")
    print("=" * 80)
    
    if issues:
        print(f"\n[경고] {len(issues)}개 이슈 발견:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("\n[OK] 모든 업로드 로직 제거 확인됨")
        return True

if __name__ == '__main__':
    success = validate_no_upload_logic()
    sys.exit(0 if success else 1)











<<<<<<< HEAD
=======

>>>>>>> 87039ac2483fb2cfc80115fa29c3e4f844a1454b
