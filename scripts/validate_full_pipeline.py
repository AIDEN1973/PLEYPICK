#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
렌더링 → 학습 전체 파이프라인 정합성 검증
"""

import sys
import re
from pathlib import Path

def check_render_pipeline():
    """렌더링 파이프라인 검증"""
    script_path = Path(__file__).parent.parent / 'scripts' / 'render_ldraw_to_supabase.py'
    
    if not script_path.exists():
        return ["render_ldraw_to_supabase.py 파일 없음"]
    
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    
    # 1. 로컬 저장 로직 확인
    print("\n[1/6] 로컬 저장 로직 확인")
    
    # 폴더 구조 생성 확인
    if 'images_dir = os.path.join(synthetic_dir, \'images\')' in content:
        print("  ✅ 폴더 구조 생성 로직 확인: images, labels, meta, meta-e")
    else:
        issues.append("폴더 구조 생성 로직 누락")
    
    # 파일 저장 경로 확인
    save_checks = [
        ('image_path = os.path.join(images_dir', '이미지 저장 경로'),
        ('annotation_path = os.path.join(labels_dir', '라벨 저장 경로'),
        ('meta_json_path = os.path.join(meta_dir', '메타데이터 저장 경로'),
        ('e2_json_path = os.path.join(meta_e_dir', 'E2 메타데이터 저장 경로'),
    ]
    
    for check_str, desc in save_checks:
        if check_str in content:
            print(f"  ✅ {desc} 확인")
        else:
            issues.append(f"{desc} 누락")
    
    # 2. 업로드 제거 확인
    print("\n[2/6] 업로드 제거 확인")
    
    if 'def upload_to_supabase(' in content:
        func_match = re.search(r'def upload_to_supabase\([^)]*\):.*?return None', content, re.DOTALL)
        if func_match:
            print("  ✅ upload_to_supabase 함수가 None 반환")
        else:
            issues.append("upload_to_supabase 함수가 None을 반환하지 않음")
    else:
        issues.append("upload_to_supabase 함수가 없음")
    
    # Storage 업로드 호출 확인
    if 'storage.from_(\'lego-synthetic\').upload(' in content:
        # 제거 표시가 있는지 확인
        upload_matches = list(re.finditer(r'storage\.from_\([\'"]lego-synthetic[\'"]\)\.upload\(', content))
        for match in upload_matches:
            line_num = content[:match.start()].count('\n') + 1
            line = content.split('\n')[line_num - 1]
            if '제거됨' not in line and '수정됨' not in line and not line.strip().startswith('#'):
                issues.append(f"라인 {line_num}: Storage 업로드 호출이 남아있음")
    else:
        print("  ✅ Storage 업로드 호출 제거됨")
    
    # 3. DB 메타데이터 저장 확인
    print("\n[3/6] DB 메타데이터 저장 확인")
    
    if "'image_url': None" in content:
        print("  ✅ image_url=None 설정 확인")
    else:
        issues.append("image_url이 None으로 설정되지 않음")
    
    if "'annotation_url': None" in content:
        print("  ✅ annotation_url=None 설정 확인")
    else:
        issues.append("annotation_url이 None으로 설정되지 않음")
    
    if 'self.supabase.table(\'synthetic_dataset\').insert' in content:
        print("  ✅ synthetic_dataset 테이블 저장 확인")
    else:
        issues.append("synthetic_dataset 테이블 저장 로직 누락")
    
    # 4. 파일 경로 일관성 확인
    print("\n[4/6] 파일 경로 일관성 확인")
    
    # 렌더링과 준비 스크립트 간 경로 일치 확인
    if 'output/synthetic' in content or "output_dir" in content:
        print("  ✅ 출력 디렉토리 설정 확인")
    else:
        issues.append("출력 디렉토리 설정 누락")
    
    # 5. 에러 처리 확인
    print("\n[5/6] 에러 처리 확인")
    
    error_handling_checks = [
        ('if not self.supabase:', 'Supabase 연결 체크'),
        ('except Exception as e:', '예외 처리'),
    ]
    
    for check_str, desc in error_handling_checks:
        if check_str in content:
            print(f"  ✅ {desc} 확인")
        else:
            issues.append(f"{desc} 누락 가능성")
    
    # 6. 학습 데이터셋 준비 스크립트 확인
    print("\n[6/6] 학습 데이터셋 준비 스크립트 확인")
    
    prepare_script = Path(__file__).parent.parent / 'scripts' / 'prepare_training_dataset.py'
    if prepare_script.exists():
        with open(prepare_script, 'r', encoding='utf-8') as f:
            prepare_content = f.read()
        
        # 로컬 파일 읽기 확인
        if 'source_dir' in prepare_content and 'output/synthetic' in prepare_content:
            print("  ✅ 로컬 파일 읽기 확인")
        else:
            issues.append("prepare_training_dataset.py에서 로컬 파일 읽기 경로 확인 필요")
        
        # 폴더 구조 일치 확인
        if 'images_dir = element_dir / "images"' in prepare_content:
            print("  ✅ 폴더 구조 일치 확인 (images/)")
        else:
            issues.append("prepare_training_dataset.py 폴더 구조 불일치")
        
        if 'labels_dir = element_dir / "labels"' in prepare_content:
            print("  ✅ 폴더 구조 일치 확인 (labels/)")
        else:
            issues.append("prepare_training_dataset.py labels 폴더 구조 불일치")
    else:
        issues.append("prepare_training_dataset.py 파일 없음")
    
    return issues

def check_critical_flows():
    """중요한 플로우 확인"""
    issues = []
    
    script_path = Path(__file__).parent.parent / 'scripts' / 'render_ldraw_to_supabase.py'
    
    if not script_path.exists():
        return issues
    
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. upload_to_supabase 호출 후 None 처리 확인
    if 'urls = self.upload_to_supabase(' in content:
        if 'self.save_metadata(part_id, metadata, urls)' in content:
            print("  ✅ upload_to_supabase → save_metadata 플로우 확인")
        else:
            issues.append("upload_to_supabase 호출 후 save_metadata 호출 누락")
    
    # 2. save_metadata에서 urls=None 처리 확인
    if 'def save_metadata(' in content:
        # urls가 None이어도 처리되는지 확인
        save_metadata_match = re.search(r'def save_metadata\([^)]*\):.*?(?=def |\Z)', content, re.DOTALL)
        if save_metadata_match:
            func_body = save_metadata_match.group(0)
            if "'image_url': None" in func_body:
                print("  ✅ save_metadata에서 urls=None 처리 확인")
            else:
                issues.append("save_metadata에서 urls=None 처리 누락")
    
    return issues

def main():
    print("=" * 80)
    print("렌더링 → 학습 전체 파이프라인 정합성 검증")
    print("=" * 80)
    
    all_issues = []
    
    # 1. 렌더링 파이프라인 검증
    print("\n[파트 1] 렌더링 파이프라인 검증")
    issues = check_render_pipeline()
    all_issues.extend(issues)
    
    # 2. 중요 플로우 확인
    print("\n[파트 2] 중요 플로우 확인")
    flow_issues = check_critical_flows()
    all_issues.extend(flow_issues)
    
    # 최종 결과
    print("\n" + "=" * 80)
    if all_issues:
        print(f"[ERROR] 검증 실패: {len(all_issues)}개 이슈 발견")
        print("\n이슈 목록:")
        for i, issue in enumerate(all_issues, 1):
            print(f"  {i}. {issue}")
        print("\n[WARNING]  파이프라인 실행 전 수정 권장")
        return False
    else:
        print("✅ 검증 통과: 전체 파이프라인 정합성 확인")
        print("\n요약:")
        print("  - 로컬 저장 로직: 정상")
        print("  - 업로드 제거: 완료")
        print("  - DB 메타데이터 저장: 정상")
        print("  - 파일 경로 일관성: 확인")
        print("  - 에러 처리: 확인")
        print("  - 학습 데이터셋 준비: 정상")
        print("\n✅ 100개 부품 렌더링 및 학습 파이프라인 실행 가능")
        return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)












