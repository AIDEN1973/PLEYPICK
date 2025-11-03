#!/usr/bin/env python3
"""이모지 사용 검사 스크립트 - 간단 버전"""

import os
import glob

def check_emojis_simple():
    """간단한 이모지 검사"""
    print("=== 이모지 사용 검사 (간단 버전) ===")
    print("정책: NO_EMOJI_POLICY.md")
    
    # 주요 Python 파일만 검사
    python_files = glob.glob("**/*.py", recursive=True)
    
    emoji_count = 0
    file_count = 0
    
    for file_path in python_files:
        # 제외할 디렉토리/파일 (venv 포함, 자기 검사 스크립트 제외)
        if any(exclude in file_path for exclude in ['node_modules', '.git', '__pycache__', '.venv', 'venv', 'temp']):
            continue
        base = os.path.basename(file_path)
        if base in ('check_emojis_simple.py', 'check_emojis.py'):
            continue

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # 실제 이모지 문자만 검사 (ASCII 태그는 검사하지 않음)
            emojis = ['🔍', '❌', '⚠️', '💡', '📤', '[FIX]', '📦', '🔌', '⏳', '🚀', '[NETWORK]', '🎯', '[DIR]', '📋', '[SUCCESS]']
            
            found_emojis = [e for e in emojis if e in content]
            
            if found_emojis:
                print(f"[FOUND] {file_path}")
                print(f"  이모지: {found_emojis}")
                emoji_count += len(found_emojis)
                file_count += 1
                
        except Exception:
            continue
    
    print(f"\n=== 검사 결과 ===")
    print(f"검사된 파일: {len(python_files)}개")
    print(f"이모지 발견 파일: {file_count}개")
    print(f"총 이모지 수: {emoji_count}개")
    
    if emoji_count == 0:
        print("\n[OK] 이모지 사용 위반 없음!")
        return True
    else:
        print(f"\n[ERROR] {emoji_count}개의 이모지 발견")
        print("NO_EMOJI_POLICY.md를 참조하여 ASCII 태그로 교체하세요.")
        return False

if __name__ == "__main__":
    success = check_emojis_simple()
    exit(0 if success else 1)
