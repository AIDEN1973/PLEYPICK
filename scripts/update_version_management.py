#!/usr/bin/env python3
"""
버전 관리 시스템 업데이트 스크립트
새로운 완벽한 폴더 구조에 맞게 버전 관리 시스템을 업데이트
"""

import os
import shutil
import json
from pathlib import Path
from datetime import datetime

def update_version_management_system():
    """버전 관리 시스템을 새로운 폴더 구조에 맞게 업데이트"""
    print("=" * 60)
    print("버전 관리 시스템 업데이트")
    print("=" * 60)
    
    # 경로 설정
    output_dir = Path("output")
    datasets_dir = output_dir / "datasets"
    synthetic_dir = output_dir / "synthetic"
    versions_file = output_dir / "dataset_versions.json"
    
    print(f"[INFO] 경로 확인:")
    print(f"  datasets: {datasets_dir}")
    print(f"  synthetic: {synthetic_dir}")
    print(f"  versions: {versions_file}")
    
    # 1. 기존 버전 메타데이터 백업
    if versions_file.exists():
        backup_file = versions_file.with_suffix(f".backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        shutil.copy2(versions_file, backup_file)
        print(f"[BACKUP] 기존 버전 메타데이터 백업: {backup_file}")
    
    # 2. 새로운 폴더 구조 확인
    synthetic_synthetic_dir = synthetic_dir / "synthetic"
    if not synthetic_synthetic_dir.exists():
        print(f"[ERROR] 새로운 폴더 구조가 없습니다: {synthetic_synthetic_dir}")
        return False
    
    print(f"[OK] 새로운 폴더 구조 확인: {synthetic_synthetic_dir}")
    
    # 3. 기존 current 폴더를 새로운 구조로 마이그레이션
    current_dir = datasets_dir / "current"
    if current_dir.exists():
        print(f"[MIGRATE] 기존 current 폴더 마이그레이션 중...")
        
        # 기존 구조를 새로운 구조로 변환
        migrate_old_structure_to_new(current_dir, synthetic_synthetic_dir)
        print(f"[OK] 마이그레이션 완료")
    else:
        print(f"[INFO] 기존 current 폴더가 없습니다. 새로 생성합니다.")
        synthetic_synthetic_dir.mkdir(parents=True, exist_ok=True)
    
    # 4. 버전 메타데이터 업데이트
    update_version_metadata(versions_file, synthetic_synthetic_dir)
    
    # 5. 기존 버전들도 새로운 구조로 변환 (선택사항)
    convert_existing_versions(datasets_dir)
    
    print("\n" + "=" * 60)
    print("버전 관리 시스템 업데이트 완료!")
    print("=" * 60)
    print("새로운 구조:")
    print("output/synthetic/synthetic/  # 현재 활성 데이터셋")
    print("output/datasets/v1.x/       # 버전별 백업")
    print("output/dataset_versions.json # 버전 메타데이터")
    
    return True

def migrate_old_structure_to_new(old_dir, new_dir):
    """기존 구조를 새로운 구조로 마이그레이션"""
    try:
        # 기존 구조: images/, labels/, metadata/
        # 새로운 구조: images/, labels/, meta/, meta-e/
        
        old_images = old_dir / "images"
        old_labels = old_dir / "labels"
        old_metadata = old_dir / "metadata"
        
        new_images = new_dir / "images"
        new_labels = new_dir / "labels"
        new_meta = new_dir / "meta"
        new_meta_e = new_dir / "meta-e"
        
        # 폴더 생성
        for folder in [new_images, new_labels, new_meta, new_meta_e]:
            folder.mkdir(parents=True, exist_ok=True)
        
        # 파일 복사
        if old_images.exists():
            copy_files(old_images, new_images, "*.webp")
            print(f"  - 이미지 파일 복사: {old_images} → {new_images}")
        
        if old_labels.exists():
            copy_files(old_labels, new_labels, "*.txt")
            print(f"  - 라벨 파일 복사: {old_labels} → {new_labels}")
        
        if old_metadata.exists():
            copy_files(old_metadata, new_meta, "*.json")
            print(f"  - 메타데이터 파일 복사: {old_metadata} → {new_meta}")
        
        # dataset.yaml 생성
        dataset_yaml = new_dir / "dataset.yaml"
        create_dataset_yaml(dataset_yaml, new_dir)
        
        print(f"[OK] 마이그레이션 완료: {old_dir} → {new_dir}")
        
    except Exception as e:
        print(f"[ERROR] 마이그레이션 실패: {e}")
        raise

def copy_files(src_dir, dst_dir, pattern):
    """파일 복사"""
    import glob
    
    src_path = Path(src_dir)
    dst_path = Path(dst_dir)
    
    if not src_path.exists():
        return
    
    files = list(src_path.glob(pattern))
    for file in files:
        dst_file = dst_path / file.name
        shutil.copy2(file, dst_file)

def create_dataset_yaml(yaml_path, dataset_dir):
    """dataset.yaml 생성"""
    yaml_content = f"""path: {dataset_dir.absolute()}
train: images
val: images
test: images
nc: 1
names: ['lego_part']
"""
    
    with open(yaml_path, 'w', encoding='utf-8') as f:
        f.write(yaml_content)
    
    print(f"  - dataset.yaml 생성: {yaml_path}")

def update_version_metadata(versions_file, current_path):
    """버전 메타데이터 업데이트"""
    try:
        # 기존 메타데이터 로드
        if versions_file.exists():
            with open(versions_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        else:
            metadata = {"versions": []}
        
        # 현재 버전 정보 업데이트
        if metadata.get("versions"):
            for version in metadata["versions"]:
                if version.get("is_current", False):
                    version["path"] = str(current_path)
                    version["source_path"] = str(current_path)
                    print(f"[UPDATE] 현재 버전 경로 업데이트: {version['version']}")
        
        # 메타데이터 저장
        with open(versions_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        print(f"[OK] 버전 메타데이터 업데이트: {versions_file}")
        
    except Exception as e:
        print(f"[ERROR] 버전 메타데이터 업데이트 실패: {e}")

def convert_existing_versions(datasets_dir):
    """기존 버전들을 새로운 구조로 변환"""
    try:
        versions_dir = Path(datasets_dir)
        if not versions_dir.exists():
            return
        
        version_folders = [f for f in versions_dir.iterdir() if f.is_dir() and f.name.startswith('v')]
        
        print(f"[CONVERT] 기존 버전 변환: {len(version_folders)}개")
        
        for version_folder in version_folders:
            try:
                # 각 버전 폴더를 새로운 구조로 변환
                convert_version_folder(version_folder)
                print(f"  - {version_folder.name} 변환 완료")
            except Exception as e:
                print(f"  - {version_folder.name} 변환 실패: {e}")
        
    except Exception as e:
        print(f"[ERROR] 기존 버전 변환 실패: {e}")

def convert_version_folder(version_folder):
    """개별 버전 폴더를 새로운 구조로 변환"""
    # 기존 구조 확인
    old_images = version_folder / "images"
    old_labels = version_folder / "labels"
    old_metadata = version_folder / "metadata"
    
    # 새로운 구조 생성
    new_meta = version_folder / "meta"
    new_meta_e = version_folder / "meta-e"
    
    # 폴더 생성
    new_meta.mkdir(exist_ok=True)
    new_meta_e.mkdir(exist_ok=True)
    
    # 메타데이터 파일 이동
    if old_metadata.exists():
        copy_files(old_metadata, new_meta, "*.json")
    
    # dataset.yaml 생성
    dataset_yaml = version_folder / "dataset.yaml"
    create_dataset_yaml(dataset_yaml, version_folder)

def main():
    """메인 실행 함수"""
    try:
        success = update_version_management_system()
        if success:
            print("\n✅ 버전 관리 시스템 업데이트 성공!")
            print("\n다음 단계:")
            print("1. 새로운 폴더 구조로 렌더링 실행")
            print("2. 버전 백업 테스트")
            print("3. 기존 데이터와의 호환성 확인")
        else:
            print("\n[ERROR] 버전 관리 시스템 업데이트 실패!")
        
        return success
        
    except Exception as e:
        print(f"\n[ERROR] 업데이트 중 오류 발생: {e}")
        return False

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)

