#!/usr/bin/env python3
"""
BrickBox 데이터셋 버전 관리 시스템
- 데이터셋 버전 추적
- 자동 백업 및 복구
- 모델-데이터셋 연결 관리
"""

import os
import sys
import json
import shutil
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import argparse

# UTF-8 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 환경변수 설정
os.environ['PYTHONIOENCODING'] = 'utf-8'
os.environ['LANG'] = 'ko_KR.UTF-8'
os.environ['LC_ALL'] = 'ko_KR.UTF-8'

class DatasetVersionManager:
    """데이터셋 버전 관리 클래스"""
    
    def __init__(self, base_dir: str = "output"):
        self.base_dir = Path(base_dir)
        self.datasets_dir = self.base_dir / "datasets"
        self.metadata_file = self.base_dir / "dataset_versions.json"
        self.current_link = self.datasets_dir / "current"
        
        # 디렉토리 생성
        self.datasets_dir.mkdir(parents=True, exist_ok=True)
        
        # 메타데이터 로드
        self.metadata = self._load_metadata()
    
    def _load_metadata(self) -> Dict:
        """버전 메타데이터 로드"""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "versions": {},
            "current_version": None,
            "created_at": datetime.now().isoformat()
        }
    
    def _save_metadata(self):
        """버전 메타데이터 저장"""
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f, indent=2, ensure_ascii=False, separators=(',', ': '))
    
    def _calculate_dataset_hash(self, dataset_path: Path) -> str:
        """데이터셋 해시 계산"""
        hash_md5 = hashlib.md5()
        
        # 모든 파일의 해시를 계산
        for file_path in sorted(dataset_path.rglob("*")):
            if file_path.is_file():
                with open(file_path, "rb") as f:
                    for chunk in iter(lambda: f.read(4096), b""):
                        hash_md5.update(chunk)
        
        return hash_md5.hexdigest()
    
    def _count_files_in_dataset(self, dataset_path: Path) -> Dict:
        """데이터셋 파일 개수 계산"""
        images = 0
        labels = 0
        metadata = 0
        
        if (dataset_path / "images" / "train").exists():
            images += len(list((dataset_path / "images" / "train").glob("*.webp")))
        if (dataset_path / "images" / "val").exists():
            images += len(list((dataset_path / "images" / "val").glob("*.webp")))
        if (dataset_path / "labels" / "train").exists():
            labels += len(list((dataset_path / "labels" / "train").glob("*.txt")))
        if (dataset_path / "labels" / "val").exists():
            labels += len(list((dataset_path / "labels" / "val").glob("*.txt")))
        if (dataset_path / "metadata").exists():
            metadata += len(list((dataset_path / "metadata").glob("*.json")))
        
        return {
            "images": images,
            "labels": labels,
            "metadata": metadata,
            "total": images + labels + metadata
        }
    
    def _count_files(self, dataset_path: Path) -> Dict:
        """데이터셋 파일 개수 계산"""
        counts = {
            "images": 0,
            "labels": 0,
            "metadata": 0,
            "total": 0
        }
        
        for split in ["train", "val"]:
            images_dir = dataset_path / "images" / split
            labels_dir = dataset_path / "labels" / split
            
            if images_dir.exists():
                counts["images"] += len(list(images_dir.glob("*.webp")))
            if labels_dir.exists():
                counts["labels"] += len(list(labels_dir.glob("*.txt")))
        
        metadata_dir = dataset_path / "metadata"
        if metadata_dir.exists():
            counts["metadata"] = len(list(metadata_dir.glob("*.json")))
        
        counts["total"] = counts["images"] + counts["labels"] + counts["metadata"]
        return counts
    
    def create_version(self, source_path: str, version: str = None, description: str = "") -> str:
        """새 데이터셋 버전 생성"""
        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"소스 경로가 존재하지 않습니다: {source_path}")
        
        # 버전 번호 자동 생성
        if version is None:
            existing_versions = list(self.metadata["versions"].keys())
            if existing_versions:
                last_version = max([float(v) for v in existing_versions])
                version = f"{last_version + 0.1:.1f}"
            else:
                version = "1.0"
        
        version_dir = self.datasets_dir / f"v{version}"
        
        # 기존 버전이 있으면 삭제
        if version_dir.exists():
            shutil.rmtree(version_dir)
        
        # 데이터셋 복사
        print(f"[INFO] 데이터셋 버전 {version} 생성 중...")
        shutil.copytree(source, version_dir)
        
        # 해시 계산
        dataset_hash = self._calculate_dataset_hash(version_dir)
        
        # 파일 개수 계산
        file_counts = self._count_files(version_dir)
        
        # 메타데이터 업데이트
        version_info = {
            "version": version,
            "path": str(version_dir),
            "created_at": datetime.now().isoformat(),
            "description": description,
            "dataset_hash": dataset_hash,
            "file_counts": file_counts,
            "source_path": str(source)
        }
        
        self.metadata["versions"][version] = version_info
        self.metadata["current_version"] = version
        
        # current 심볼릭 링크 업데이트
        if self.current_link.exists():
            self.current_link.unlink()
        # Windows에서는 심볼릭 링크 대신 복사 사용
        try:
            self.current_link.symlink_to(version_dir)
        except OSError:
            # 심볼릭 링크 실패 시 복사 사용
            shutil.copytree(version_dir, self.current_link)
        
        # 메타데이터 저장
        self._save_metadata()
        
        print(f"[SUCCESS] 데이터셋 버전 {version} 생성 완료")
        print(f"📊 파일 개수: {file_counts}")
        print(f"🔗 현재 버전: v{version}")
        
        return version
    
    def switch_version(self, version: str) -> bool:
        """데이터셋 버전 전환"""
        if version not in self.metadata["versions"]:
            print(f"[ERROR] 버전 {version}이 존재하지 않습니다")
            return False
        
        version_info = self.metadata["versions"][version]
        version_dir = Path(version_info["path"])
        
        if not version_dir.exists():
            print(f"[ERROR] 버전 {version}의 데이터셋이 존재하지 않습니다")
            return False
        
        print(f"[INFO] 버전 {version}으로 전환 중...")
        
        # 기존 current 폴더 강제 삭제
        if self.current_link.exists():
            try:
                if self.current_link.is_symlink():
                    self.current_link.unlink()
                else:
                    shutil.rmtree(self.current_link)
            except PermissionError:
                print("[WARNING] current 폴더 삭제 권한 없음, 강제 삭제 시도...")
                import stat
                def force_remove_readonly(func, path, exc):
                    if os.path.exists(path):
                        os.chmod(path, stat.S_IWRITE)
                        func(path)
                shutil.rmtree(self.current_link, onerror=force_remove_readonly)
        
        # Windows에서는 심볼릭 링크 대신 복사 사용
        try:
            self.current_link.symlink_to(version_dir)
        except OSError:
            # 심볼릭 링크 실패 시 복사 사용
            shutil.copytree(version_dir, self.current_link)
        
        # dataset_synthetic 폴더도 업데이트
        dataset_synthetic_path = self.base_dir / "dataset_synthetic"
        if dataset_synthetic_path.exists():
            shutil.rmtree(dataset_synthetic_path)
        shutil.copytree(version_dir, dataset_synthetic_path)
        
        # 메타데이터 업데이트
        self.metadata["current_version"] = version
        self._save_metadata()
        
        print(f"[SUCCESS] 현재 버전을 v{version}으로 전환했습니다")
        return True
    
    def list_versions(self) -> List[Dict]:
        """버전 목록 조회"""
        versions = []
        # metadata["versions"]가 리스트인 경우 처리
        if isinstance(self.metadata["versions"], list):
            for version_info in self.metadata["versions"]:
                versions.append({
                    "version": version_info.get("version", "unknown"),
                    "created_at": version_info.get("created_at", ""),
                    "description": version_info.get("description", ""),
                    "file_counts": version_info.get("file_counts", {}),
                    "is_current": version_info.get("version") == self.metadata.get("current_version")
                })
        else:
            # 기존 딕셔너리 형태 처리
            for version, info in self.metadata["versions"].items():
                versions.append({
                    "version": version,
                    "created_at": info["created_at"],
                    "description": info.get("description", ""),
                    "file_counts": info["file_counts"],
                    "is_current": version == self.metadata["current_version"]
                })
        
        return sorted(versions, key=lambda x: float(x["version"]), reverse=True)
    
    def get_current_version(self) -> Optional[str]:
        """현재 버전 조회"""
        return self.metadata.get("current_version")
    
    def get_current_path(self) -> Optional[Path]:
        """현재 데이터셋 경로 조회"""
        current_version = self.get_current_version()
        if current_version and current_version in self.metadata["versions"]:
            return Path(self.metadata["versions"][current_version]["path"])
        return None
    
    def delete_version(self, version: str) -> bool:
        """버전 삭제"""
        if version not in self.metadata["versions"]:
            print(f"[ERROR] 버전 {version}이 존재하지 않습니다")
            return False
        
        # 현재 버전은 삭제 불가
        if version == self.metadata["current_version"]:
            print(f"[ERROR] 현재 버전 {version}은 삭제할 수 없습니다")
            return False
        
        version_info = self.metadata["versions"][version]
        version_dir = Path(version_info["path"])
        
        # 디렉토리 삭제
        if version_dir.exists():
            shutil.rmtree(version_dir)
        
        # 메타데이터에서 제거
        del self.metadata["versions"][version]
        self._save_metadata()
        
        print(f"[SUCCESS] 버전 {version} 삭제 완료")
        return True
    
    def backup_current(self, description: str = "") -> str:
        """현재 데이터셋 백업"""
        # 현재 활성화된 데이터셋 경로 확인
        current_dataset_path = None
        
        if self.current_link.exists():
            current_dataset_path = self.current_link.resolve() if self.current_link.is_symlink() else self.current_link
        elif (self.base_dir / "dataset_synthetic").exists():
            current_dataset_path = self.base_dir / "dataset_synthetic"
        
        if not current_dataset_path or not current_dataset_path.exists():
            print("[ERROR] 현재 활성화된 데이터셋이 없습니다. 먼저 데이터셋을 준비하세요.")
            return None
        
        print(f"[INFO] 현재 데이터셋 백업 중: {current_dataset_path}")
        
        # 새 버전 번호 생성
        existing_versions = list(self.metadata["versions"].keys())
        if existing_versions:
            last_version = max([float(v) for v in existing_versions])
            new_version = f"{last_version + 0.1:.1f}"
        else:
            new_version = "1.0"
        
        version_dir = self.datasets_dir / f"v{new_version}"
        
        # 기존 버전이 있으면 삭제
        if version_dir.exists():
            shutil.rmtree(version_dir)
        
        # 데이터셋 복사
        print(f"[INFO] 데이터셋 버전 {new_version} 생성 중...")
        shutil.copytree(current_dataset_path, version_dir)
        
        # 해시 계산
        dataset_hash = self._calculate_dataset_hash(version_dir)
        
        # 파일 개수 계산
        file_counts = self._count_files_in_dataset(version_dir)
        
        # 버전 정보 저장 (절대 경로 사용)
        version_info = {
            "version": new_version,
            "path": str(version_dir),
            "created_at": datetime.now().isoformat(),
            "description": description,
            "dataset_hash": dataset_hash,
            "file_counts": file_counts,
            "source_path": str(current_dataset_path)
        }
        
        self.metadata["versions"][new_version] = version_info
        
        # 기존 current 폴더 강제 삭제
        if self.current_link.exists():
            try:
                if self.current_link.is_symlink():
                    self.current_link.unlink()
                else:
                    shutil.rmtree(self.current_link)
            except PermissionError:
                print("[WARNING] current 폴더 삭제 권한 없음, 강제 삭제 시도...")
                import stat
                def force_remove_readonly(func, path, exc):
                    if os.path.exists(path):
                        os.chmod(path, stat.S_IWRITE)
                        func(path)
                shutil.rmtree(self.current_link, onerror=force_remove_readonly)
        
        # Windows에서는 심볼릭 링크 대신 복사 사용
        try:
            self.current_link.symlink_to(version_dir)
        except OSError:
            # 심볼릭 링크 실패 시 복사 사용
            shutil.copytree(version_dir, self.current_link)
        
        # dataset_synthetic 폴더도 업데이트
        dataset_synthetic_path = self.base_dir / "dataset_synthetic"
        if dataset_synthetic_path.exists():
            shutil.rmtree(dataset_synthetic_path)
        shutil.copytree(version_dir, dataset_synthetic_path)
        
        # 메타데이터 저장
        self._save_metadata()
        
        print(f"[SUCCESS] 현재 데이터셋이 v{new_version}으로 백업되었습니다")
        return new_version

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='BrickBox 데이터셋 버전 관리')
    parser.add_argument('--base-dir', default='output', help='기본 디렉토리')
    parser.add_argument('--action', choices=['create', 'list', 'switch', 'delete', 'backup'], 
                       required=True, help='실행할 작업')
    parser.add_argument('--version', help='버전 번호')
    parser.add_argument('--source', help='소스 경로 (create 시)')
    parser.add_argument('--description', default='', help='설명')
    
    args = parser.parse_args()
    
    manager = DatasetVersionManager(args.base_dir)
    
    try:
        if args.action == 'create':
            if not args.source:
                print("[ERROR] --source 옵션이 필요합니다")
                sys.exit(1)
            version = manager.create_version(args.source, args.version, args.description)
            print(f"[SUCCESS] 버전 {version} 생성 완료")
            
        elif args.action == 'list':
            versions = manager.list_versions()
            print("📋 데이터셋 버전 목록:")
            for v in versions:
                status = " (현재)" if v["is_current"] else ""
                print(f"  v{v['version']}{status}: {v['file_counts']['total']}개 파일 - {v['created_at']}")
                if v['description']:
                    print(f"    설명: {v['description']}")
            
            # JSON 출력 (API용)
            import json
            print(json.dumps(versions, ensure_ascii=False, indent=2))
            
        elif args.action == 'switch':
            if not args.version:
                print("[ERROR] --version 옵션이 필요합니다")
                sys.exit(1)
            success = manager.switch_version(args.version)
            if not success:
                sys.exit(1)
                
        elif args.action == 'delete':
            if not args.version:
                print("[ERROR] --version 옵션이 필요합니다")
                sys.exit(1)
            success = manager.delete_version(args.version)
            if not success:
                sys.exit(1)
                
        elif args.action == 'backup':
            try:
                print(f"[INFO] 백업 시작: {args.description}")
                version = manager.backup_current(args.description)
                if version:
                    print(f"[SUCCESS] 현재 데이터셋을 v{version}으로 백업했습니다")
                else:
                    print("[ERROR] 백업 실패")
                    sys.exit(1)
            except Exception as e:
                print(f"[ERROR] 백업 중 오류: {e}")
                import traceback
                traceback.print_exc()
                sys.exit(1)
                
    except Exception as e:
        print(f"[ERROR] 오류: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
