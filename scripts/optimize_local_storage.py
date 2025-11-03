#!/usr/bin/env python3
"""
로컬 Storage 최적화 스크립트
- 중복 파일을 공통 폴더로 이동
- 버전별 매니페스트 생성
- 심볼릭 링크 또는 하드 링크 사용
"""

import os
import sys
import json
import hashlib
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set

# UTF-8 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 환경변수 설정
os.environ['PYTHONIOENCODING'] = 'utf-8'
os.environ['LANG'] = 'ko_KR.UTF-8'
os.environ['LC_ALL'] = 'ko_KR.UTF-8'
os.environ['PYTHONUTF8'] = '1'

def calculate_file_hash(file_path):
    """파일 해시 계산"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def scan_version_files(version_path):
    """버전 폴더의 파일 스캔"""
    files_info = {}
    version_path = Path(version_path)
    
    if not version_path.exists():
        return files_info
    
    for file_path in version_path.rglob("*"):
        if file_path.is_file():
            relative_path = str(file_path.relative_to(version_path)).replace("\\", "/")
            file_hash = calculate_file_hash(file_path)
            file_size = file_path.stat().st_size
            
            files_info[relative_path] = {
                'path': file_path,
                'hash': file_hash,
                'size': file_size,
                'relative_path': relative_path
            }
    
    return files_info

def create_optimized_structure(base_dir):
    """최적화된 로컬 구조 생성"""
    base_dir = Path(base_dir)
    
    # 최적화된 구조 생성
    common_dir = base_dir / "common"
    unique_dir = base_dir / "unique"
    manifests_dir = base_dir / "manifests"
    
    common_dir.mkdir(exist_ok=True)
    unique_dir.mkdir(exist_ok=True)
    manifests_dir.mkdir(exist_ok=True)
    
    return common_dir, unique_dir, manifests_dir

def calculate_dataset_hash(version_files):
    """데이터셋 전체 해시 계산"""
    all_hashes = []
    for files_info in version_files.values():
        for file_info in files_info.values():
            all_hashes.append(file_info['hash'])
    
    # 해시들을 정렬하여 일관성 보장
    all_hashes.sort()
    
    # 전체 해시 문자열 생성
    combined_hash = ''.join(all_hashes)
    
    # SHA-256으로 최종 해시 계산
    import hashlib
    return hashlib.sha256(combined_hash.encode()).hexdigest()

def optimize_local_versions(base_dir):
    """로컬 버전 최적화"""
    base_dir = Path(base_dir)
    versions_dir = base_dir / "datasets"
    
    if not versions_dir.exists():
        print("[ERROR] datasets 폴더가 존재하지 않습니다.")
        return False
    
    # 모든 버전 폴더 스캔
    all_files = {}
    version_files = {}
    
    for version_dir in versions_dir.iterdir():
        if version_dir.is_dir() and version_dir.name.startswith('v'):
            version_name = version_dir.name
            print(f"[SCAN] 버전 {version_name} 스캔 중...")
            
            files_info = scan_version_files(version_dir)
            version_files[version_name] = files_info
            all_files.update(files_info)
            
            print(f"[SCAN] 버전 {version_name}: {len(files_info)}개 파일")
    
    print(f"[INFO] 전체 파일: {len(all_files)}개")
    
    # 데이터셋 해시 계산
    dataset_hash = calculate_dataset_hash(version_files)
    print(f"[INFO] 데이터셋 해시: {dataset_hash[:16]}...")
    
    # 해시별 파일 그룹화
    hash_groups = {}
    for file_info in all_files.values():
        file_hash = file_info['hash']
        if file_hash not in hash_groups:
            hash_groups[file_hash] = []
        hash_groups[file_hash].append(file_info)
    
    # 최적화된 구조 생성
    common_dir, unique_dir, manifests_dir = create_optimized_structure(base_dir)
    
    # 공통 파일과 고유 파일 분류
    common_files = {}
    unique_files = {}
    file_mapping = {}
    
    for file_hash, file_list in hash_groups.items():
        if len(file_list) > 1:  # 중복 파일
            # 첫 번째 파일을 공통 파일로 이동
            first_file = file_list[0]
            common_path = common_dir / file_hash / first_file['relative_path']
            common_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 파일 이동
            shutil.move(str(first_file['path']), str(common_path))
            common_files[file_hash] = str(common_path)
            
            print(f"[COMMON] {file_hash[:8]}... → {common_path}")
            
            # 모든 중복 파일을 공통 파일로 매핑
            for file_info in file_list:
                file_mapping[file_info['relative_path']] = {
                    'type': 'common',
                    'path': str(common_path),
                    'hash': file_hash
                }
        else:  # 고유 파일
            file_info = file_list[0]
            unique_path = unique_dir / file_hash / file_info['relative_path']
            unique_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 파일 이동
            shutil.move(str(file_info['path']), str(unique_path))
            unique_files[file_hash] = str(unique_path)
            
            file_mapping[file_info['relative_path']] = {
                'type': 'unique',
                'path': str(unique_path),
                'hash': file_hash
            }
            
            print(f"[UNIQUE] {file_info['relative_path']} → {unique_path}")
    
    # 각 버전별 매니페스트 생성
    for version_name, files_info in version_files.items():
        # 버전별 해시 계산
        version_hashes = [file_info['hash'] for file_info in files_info.values()]
        version_hashes.sort()
        version_hash = hashlib.sha256(''.join(version_hashes).encode()).hexdigest()
        
        manifest = {
            'version': version_name,
            'created_at': datetime.now().isoformat(),
            'dataset_hash': version_hash,
            'files': {},
            'common_files': {},
            'unique_files': {}
        }
        
        for relative_path, file_info in files_info.items():
            if relative_path in file_mapping:
                mapping = file_mapping[relative_path]
                manifest['files'][relative_path] = {
                    'path': mapping['path'],
                    'hash': mapping['hash'],
                    'type': mapping['type']
                }
                
                if mapping['type'] == 'common':
                    manifest['common_files'][relative_path] = mapping['path']
                else:
                    manifest['unique_files'][relative_path] = mapping['path']
        
        # 매니페스트 저장
        manifest_path = manifests_dir / f"{version_name}.json"
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        
        print(f"[MANIFEST] {version_name} 매니페스트 생성: {manifest_path}")
    
    print(f"[INFO] 공통 파일: {len(common_files)}개")
    print(f"[INFO] 고유 파일: {len(unique_files)}개")
    print(f"[INFO] 최적화 완료!")
    
    return True

def restore_version_from_manifest(version_name, base_dir):
    """매니페스트에서 버전 복원"""
    base_dir = Path(base_dir)
    manifests_dir = base_dir / "manifests"
    manifest_path = manifests_dir / f"{version_name}.json"
    
    if not manifest_path.exists():
        print(f"[ERROR] {version_name} 매니페스트가 없습니다.")
        return False
    
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    # 버전 폴더 생성
    version_dir = base_dir / "datasets" / version_name
    version_dir.mkdir(parents=True, exist_ok=True)
    
    # 파일 복원
    for relative_path, file_info in manifest['files'].items():
        target_path = version_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        source_path = Path(file_info['path'])
        if source_path.exists():
            # 심볼릭 링크 생성 (Windows에서는 복사)
            try:
                if os.name == 'nt':  # Windows
                    shutil.copy2(str(source_path), str(target_path))
                else:  # Unix/Linux
                    target_path.symlink_to(source_path)
            except OSError:
                # 심볼릭 링크 실패 시 복사
                shutil.copy2(str(source_path), str(target_path))
            
            print(f"[RESTORE] {relative_path} → {target_path}")
        else:
            print(f"[ERROR] 소스 파일이 없습니다: {source_path}")
    
    print(f"[SUCCESS] {version_name} 복원 완료")
    return True

def main():
    """메인 함수"""
    print("[INFO] 로컬 Storage 최적화 시작")
    
    base_dir = Path("output")
    if not base_dir.exists():
        print("[ERROR] output 폴더가 존재하지 않습니다.")
        return 1
    
    # 최적화 실행
    if optimize_local_versions(base_dir):
        print("[SUCCESS] 로컬 Storage 최적화 완료!")
        print("[INFO] 중복 파일이 공통 폴더로 이동되었습니다.")
        print("[INFO] 각 버전은 매니페스트로 관리됩니다.")
    else:
        print("[ERROR] 로컬 Storage 최적화 실패")
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
