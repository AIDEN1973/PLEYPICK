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
        # 제외할 디렉토리
        if any(exclude in file_path for exclude in ['node_modules', '.git', '__pycache__', '.venv', 'temp']):
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # 주요 이모지 패턴 검사 (내부 스크립트 이모지 포함 금지)
            emojis = ['🔍', '[OK]', '❌', '⚠️', '💡', '📤', '🔧', '📦', '🔌', '⏳', '🚀', '📡', '🎯', '📁']
            
            found_emojis = []
            for emoji in emojis:
                if emoji in content:
                    found_emojis.append(emoji)
            
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
