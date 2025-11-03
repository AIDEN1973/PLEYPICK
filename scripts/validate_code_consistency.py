#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
part_name 자동 insert 코드 정합성 검증 스크립트
"""

import sys
import os
import re
from pathlib import Path

def validate_code_file(file_path):
    """코드 파일 정합성 검증"""
    issues = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
            
        # 1. lego_parts 조회 로직 확인
        if 'useMasterPartsPreprocessing.js' in str(file_path):
            # partNameMap 사용 확인
            if 'partNameMap' in content:
                if 'partNameMap.get(' in content:
                    print(f"  ✅ partNameMap 사용 확인")
                else:
                    issues.append("partNameMap이 정의되었지만 사용되지 않음")
            
            # 일괄 조회 로직 확인
            if 'lego_parts' in content and '.in(' in content:
                print(f"  ✅ lego_parts 일괄 조회 확인")
            else:
                issues.append("lego_parts 일괄 조회 로직 누락 가능성")
            
            # part_name 설정 로직 확인
            part_name_patterns = [
                r'part_name:\s*partName',
                r'part_name:\s*partNameMap\.get',
                r'part_name:\s*realPartInfo\.part_name'
            ]
            found_pattern = False
            for pattern in part_name_patterns:
                if re.search(pattern, content):
                    found_pattern = True
                    break
            
            if found_pattern:
                print(f"  ✅ part_name 설정 로직 확인")
            else:
                issues.append("part_name 설정 로직 누락")
            
            # part_id와 동일하게 설정하는 코드 확인 (문제 패턴)
            problem_patterns = [
                r'part_name:\s*part_id',
                r'part_name:\s*result\.part_num',
                r'part_name:\s*element\.part_id',
                r'part_name.*==.*part_id'
            ]
            for pattern in problem_patterns:
                matches = re.finditer(pattern, content)
                for match in matches:
                    line_num = content[:match.start()].count('\n') + 1
                    issues.append(f"라인 {line_num}: part_name이 part_id와 동일하게 설정될 가능성 ({match.group()})")
        
        elif 'blender-api.js' in str(file_path):
            # ensurePartInMaster 함수 확인
            if 'ensurePartInMaster' in content:
                # lego_parts 조회 확인
                if 'lego_parts' in content and 'maybeSingle' in content:
                    print(f"  ✅ ensurePartInMaster에서 lego_parts 조회 확인")
                else:
                    issues.append("ensurePartInMaster에서 lego_parts 조회 누락")
                
                # 하드코딩된 part_name 확인
                if 'LEGO Element ${partId}' in content:
                    # 기본값으로만 사용되는지 확인 (fallback)
                    if 'legoPart?.name' in content or 'legoPart.name' in content:
                        print(f"  ✅ 기본값은 fallback으로만 사용 확인")
                    else:
                        issues.append("하드코딩된 part_name이 기본값으로 사용될 가능성")
        
        return issues
        
    except Exception as e:
        return [f"파일 읽기 오류: {e}"]

def main():
    """메인 검증 함수"""
    print("=" * 80)
    print("part_name 자동 insert 코드 정합성 검증")
    print("=" * 80)
    
    project_root = Path(__file__).parent.parent
    
    # 검증할 파일 목록
    files_to_check = [
        project_root / 'src' / 'composables' / 'useMasterPartsPreprocessing.js',
        project_root / 'server' / 'blender-api.js'
    ]
    
    all_issues = []
    
    for file_path in files_to_check:
        print(f"\n[{file_path.name}] 검증 중...")
        
        if not file_path.exists():
            print(f"  [ERROR] 파일이 존재하지 않음: {file_path}")
            continue
        
        issues = validate_code_file(file_path)
        
        if issues:
            all_issues.extend([f"{file_path.name}: {issue}" for issue in issues])
            for issue in issues:
                print(f"  [WARNING] {issue}")
        else:
            print(f"  ✅ 정합성 확인 완료")
    
    print("\n" + "=" * 80)
    print("검증 결과 요약")
    print("=" * 80)
    
    if all_issues:
        print(f"\n[ERROR] {len(all_issues)}개 이슈 발견:")
        for issue in all_issues:
            print(f"  - {issue}")
        return 1
    else:
        print("\n✅ 모든 검증 통과")
        return 0

if __name__ == '__main__':
    sys.exit(main())

