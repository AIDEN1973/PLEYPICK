#!/usr/bin/env python3
"""이모지 사용 검사 스크립트 - NO_EMOJI_POLICY.md 정책 준수 확인"""

import os
import re
import glob
from pathlib import Path

# 금지된 이모지 패턴
EMOJI_PATTERNS = [
    r'[🔍✅[ERROR][WARNING]💡📤[FIX]📦🔌[WAIT]🚀]',  # 주요 이모지
    r'[🎯📊📋[FIX]🚨📝🔄]',  # 추가 이모지
    r'[🧱🎨🎭🎪🎯🎲]',  # 기타 이모지
]

# 허용된 ASCII 태그
ALLOWED_TAGS = [
    '[OK]', '[ERROR]', '[WARNING]', '[INFO]', '[CHECK]',
    '[UPLOAD]', '[FIX]', '[BUCKET]', '[CONNECT]', '[WAIT]',
    '[START]', '[BUCKET]', '[CONNECT]', '[WAIT]', '[START]'
]

def check_file_for_emojis(file_path):
    """파일에서 이모지 사용 검사"""
    try:
        # 다양한 인코딩으로 시도
        encodings = ['utf-8', 'cp949', 'latin-1']
        content = None
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            return None
        
        violations = []
        for pattern in EMOJI_PATTERNS:
            matches = re.findall(pattern, content)
            if matches:
                violations.extend(matches)
        
        if violations:
            return {
                'file': file_path,
                'violations': list(set(violations)),
                'count': len(violations)
            }
        return None
        
    except Exception as e:
        return None

def scan_directory(directory):
    """디렉토리 내 모든 파일 스캔"""
    violations = []
    
    # 검사할 파일 확장자
    extensions = ['*.py', '*.js', '*.ts', '*.md', '*.txt', '*.sh', '*.bat']
    
    for ext in extensions:
        pattern = os.path.join(directory, '**', ext)
        files = glob.glob(pattern, recursive=True)
        
        for file_path in files:
            # 제외할 디렉토리
            if any(exclude in file_path for exclude in ['node_modules', '.git', '__pycache__', '.venv']):
                continue
                
            result = check_file_for_emojis(file_path)
            if result:
                violations.append(result)
    
    return violations

def generate_report(violations):
    """위반 사항 리포트 생성"""
    if not violations:
        print("\n[OK] 이모지 사용 위반 없음 - 정책 준수 완료!")
        return True
    
    print(f"\n[ERROR] 이모지 사용 위반 발견: {len(violations)}개 파일")
    print("=" * 60)
    
    for violation in violations:
        print(f"\n파일: {violation['file']}")
        print(f"위반 수: {violation['count']}개")
        # 이모지를 ASCII로 변환하여 출력
        emoji_list = []
        for emoji in violation['violations']:
            emoji_list.append(f"'{emoji}'")
        print(f"발견된 이모지: {', '.join(emoji_list)}")
        print("-" * 40)
    
    print(f"\n[INFO] ASCII 태그 사용 권장:")
    for tag in ALLOWED_TAGS:
        print(f"  - {tag}")
    
    return False

def main():
    """메인 실행 함수"""
    print("=== 이모지 사용 검사 시작 ===")
    print("정책: NO_EMOJI_POLICY.md")
    print("대상: BrickBox 프로젝트 전체")
    
    # 현재 디렉토리 스캔
    current_dir = os.getcwd()
    print(f"스캔 디렉토리: {current_dir}")
    
    # 이모지 사용 검사
    violations = scan_directory(current_dir)
    
    # 리포트 생성
    is_compliant = generate_report(violations)
    
    if is_compliant:
        print("\n[SUCCESS] 모든 파일이 이모지 사용 금지 정책을 준수합니다!")
        exit(0)
    else:
        print("\n[FAILURE] 이모지 사용 위반이 발견되었습니다.")
        print("NO_EMOJI_POLICY.md를 참조하여 ASCII 태그로 교체하세요.")
        exit(1)

if __name__ == "__main__":
    main()
