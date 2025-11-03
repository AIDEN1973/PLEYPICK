#!/usr/bin/env python3
"""
완벽한 폴더 구조로 렌더링하는 배치 스크립트
output/synthetic/엘리먼트ID/images|labels|meta|meta-e/ 구조로 자동 저장
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

def render_with_perfect_structure(part_id, element_id, count=100, resolution=640, samples=64):
    """완벽한 폴더 구조로 렌더링"""
    print("=" * 60)
    print("완벽한 폴더 구조 렌더링")
    print("=" * 60)
    print(f"부품 ID: {part_id}")
    print(f"엘리먼트 ID: {element_id}")
    print(f"렌더링 수: {count}")
    print(f"해상도: {resolution}")
    print(f"샘플 수: {samples}")
    
    # 출력 디렉토리 설정
    output_dir = Path("output/synthetic")
    element_dir = output_dir / element_id
    
    # 기존 데이터 정리 (선택사항)
    if element_dir.exists():
        print(f"[CLEANUP] 기존 데이터 정리: {element_dir}")
        import shutil
        shutil.rmtree(element_dir)
    
    # 렌더링 명령어 구성
    render_cmd = [
        "python", "scripts/render_ldraw_to_supabase.py",
        "--part-id", part_id,
        "--element-id", element_id,
        "--output-dir", str(output_dir),
        "--count", str(count),
        "--resolution", str(resolution),
        "--samples", str(samples)
    ]
    
    print(f"\n[RENDER] 렌더링 시작...")
    print(f"명령어: {' '.join(render_cmd)}")
    
    try:
        # 렌더링 실행
        result = subprocess.run(render_cmd, capture_output=True, text=True, cwd=".")
        
        if result.returncode == 0:
            print("[SUCCESS] 렌더링 완료!")
            
            # 폴더 구조 검증
            print("\n폴더 구조 검증:")
            expected_folders = ["images", "labels", "meta", "meta-e"]
            
            for folder_name in expected_folders:
                folder_path = element_dir / folder_name
                if folder_path.exists():
                    file_count = len(list(folder_path.glob("*")))
                    print(f"  ✅ {folder_name}/: {file_count}개 파일")
                else:
                    print(f"  [ERROR] {folder_name}/: 폴더 없음")
            
            # dataset.yaml 확인
            dataset_yaml = element_dir / "dataset.yaml"
            if dataset_yaml.exists():
                print(f"  ✅ dataset.yaml: 생성됨")
            else:
                print(f"  [ERROR] dataset.yaml: 없음")
            
            print(f"\n[COMPLETE] 완벽한 폴더 구조로 렌더링 완료!")
            print(f"경로: {element_dir}")
            
            return True
        else:
            print("[ERROR] 렌더링 실패!")
            print("STDERR:", result.stderr)
            return False
            
    except Exception as e:
        print(f"[ERROR] 렌더링 실행 실패: {e}")
        return False

def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description="완벽한 폴더 구조로 렌더링")
    parser.add_argument("--part-id", required=True, help="부품 ID")
    parser.add_argument("--element-id", required=True, help="엘리먼트 ID")
    parser.add_argument("--count", type=int, default=100, help="렌더링 수 (기본값: 100)")
    parser.add_argument("--resolution", type=int, default=640, help="해상도 (기본값: 640)")
    parser.add_argument("--samples", type=int, default=64, help="샘플 수 (기본값: 64)")
    
    args = parser.parse_args()
    
    success = render_with_perfect_structure(
        part_id=args.part_id,
        element_id=args.element_id,
        count=args.count,
        resolution=args.resolution,
        samples=args.samples
    )
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

