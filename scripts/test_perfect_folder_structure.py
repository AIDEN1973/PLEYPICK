#!/usr/bin/env python3
"""
완벽한 폴더 구조 렌더링 테스트 스크립트
output/synthetic/엘리먼트ID/images|labels|meta|meta-e/ 구조로 자동 저장
"""

import os
import sys
import subprocess
from pathlib import Path

def test_perfect_folder_structure():
    """완벽한 폴더 구조 렌더링 테스트"""
    print("=" * 60)
    print("완벽한 폴더 구조 렌더링 테스트")
    print("=" * 60)
    
    # 테스트용 부품 ID (존재하는 부품 사용)
    test_part_id = "003238a"
    test_element_id = "003238a"
    
    print(f"[TEST] 테스트 부품: {test_part_id} (element_id: {test_element_id})")
    
    # 기존 테스트 데이터 정리 (올바른 경로)
    test_output_dir = Path("output/synthetic") / test_element_id
    if test_output_dir.exists():
        print(f"[CLEANUP] 기존 테스트 데이터 정리: {test_output_dir}")
        import shutil
        shutil.rmtree(test_output_dir)
    
    # 렌더링 명령어 구성
    render_cmd = [
        "python", "scripts/render_ldraw_to_supabase.py",
        "--part-id", test_part_id,
        "--element-id", test_element_id,
        "--output-dir", "output/synthetic",
        "--count", "5",  # 5개만 테스트
        "--resolution", "640",
        "--samples", "32"
    ]
    
    print(f"[RENDER] 렌더링 명령어: {' '.join(render_cmd)}")
    
    try:
        # 렌더링 실행
        result = subprocess.run(render_cmd, capture_output=True, text=True, cwd=".")
        
        if result.returncode == 0:
            print("[SUCCESS] 렌더링 완료!")
            print("STDOUT:", result.stdout)
        else:
            print("[ERROR] 렌더링 실패!")
            print("STDERR:", result.stderr)
            return False
            
    except Exception as e:
        print(f"[ERROR] 렌더링 실행 실패: {e}")
        return False
    
    # 폴더 구조 검증
    print("\n" + "=" * 60)
    print("폴더 구조 검증")
    print("=" * 60)
    
    expected_structure = {
        "images": test_output_dir / "images",
        "labels": test_output_dir / "labels", 
        "meta": test_output_dir / "meta",
        "meta-e": test_output_dir / "meta-e"
    }
    
    all_good = True
    
    for folder_name, folder_path in expected_structure.items():
        if folder_path.exists():
            file_count = len(list(folder_path.glob("*")))
            print(f"[OK] {folder_name}/: {file_count}개 파일")
        else:
            print(f"[ERROR] {folder_name}/: 폴더 없음")
            all_good = False
    
    # 파일 타입 검증
    print("\n파일 타입 검증:")
    
    # 이미지 파일 검증
    image_files = list((test_output_dir / "images").glob("*.webp"))
    print(f"  - WebP 이미지: {len(image_files)}개")
    
    # 라벨 파일 검증
    label_files = list((test_output_dir / "labels").glob("*.txt"))
    print(f"  - YOLO 라벨: {len(label_files)}개")
    
    # 메타데이터 JSON 검증
    json_files = list((test_output_dir / "meta").glob("*.json"))
    print(f"  - 메타데이터 JSON: {len(json_files)}개")
    
    # E2 메타데이터 JSON 검증
    e2_json_files = list((test_output_dir / "meta-e").glob("*_e2.json"))
    print(f"  - E2 메타데이터 JSON: {len(e2_json_files)}개")
    
    # 파일명 일치 검증
    print("\n파일명 일치 검증:")
    base_names = set()
    
    for image_file in image_files:
        base_name = image_file.stem
        base_names.add(base_name)
        
        # 해당하는 라벨 파일 확인
        label_file = test_output_dir / "labels" / f"{base_name}.txt"
        json_file = test_output_dir / "meta" / f"{base_name}.json"
        e2_json_file = test_output_dir / "meta-e" / f"{base_name}_e2.json"
        
        if not label_file.exists():
            print(f"  [WARN] {base_name}: 라벨 파일 없음")
        if not json_file.exists():
            print(f"  [WARN] {base_name}: JSON 파일 없음")
        if not e2_json_file.exists():
            print(f"  [WARN] {base_name}: E2 JSON 파일 없음")
    
    print(f"  [OK] 총 {len(base_names)}개 파일 세트 확인")
    
    # dataset.yaml 생성 테스트
    print("\ndataset.yaml 생성 테스트:")
    dataset_yaml = test_output_dir / "dataset.yaml"
    if dataset_yaml.exists():
        print(f"  [OK] dataset.yaml 생성됨: {dataset_yaml}")
        
        # YAML 내용 확인
        import yaml
        with open(dataset_yaml, 'r', encoding='utf-8') as f:
            yaml_content = yaml.safe_load(f)
        
        print(f"  - 경로: {yaml_content.get('path', 'N/A')}")
        print(f"  - 훈련: {yaml_content.get('train', 'N/A')}")
        print(f"  - 검증: {yaml_content.get('val', 'N/A')}")
        print(f"  - 테스트: {yaml_content.get('test', 'N/A')}")
        print(f"  - 클래스 수: {yaml_content.get('nc', 'N/A')}")
        print(f"  - 클래스명: {yaml_content.get('names', 'N/A')}")
    else:
        print(f"  [ERROR] dataset.yaml 없음")
        all_good = False
    
    # 최종 결과
    print("\n" + "=" * 60)
    if all_good:
        print("[SUCCESS] 완벽한 폴더 구조 테스트 성공!")
        print("렌더링 시 자동으로 다음 구조로 저장됩니다:")
        print("output/synthetic/엘리먼트ID/")
        print("├── images/          # WebP 이미지")
        print("├── labels/          # YOLO 라벨 (.txt)")
        print("├── meta/            # 전체 메타데이터 (.json)")
        print("├── meta-e/          # Essential 메타데이터 (_e2.json)")
        print("└── dataset.yaml     # YOLO 데이터셋 설정")
    else:
        print("[FAILED] 완벽한 폴더 구조 테스트 실패!")
        print("렌더링 스크립트를 확인해주세요.")
    
    return all_good

if __name__ == "__main__":
    success = test_perfect_folder_structure()
    sys.exit(0 if success else 1)
