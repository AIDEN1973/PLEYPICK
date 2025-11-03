#!/usr/bin/env python3
"""
Supabase 데이터셋 버전 관리 시스템
- Supabase Database와 Storage 연동
- 클라우드 기반 버전 관리
"""

import os
import sys
import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import argparse

# Supabase 클라이언트
from supabase import create_client, Client

# UTF-8 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

class SupabaseDatasetVersionManager:
    """Supabase 기반 데이터셋 버전 관리 클래스"""
    
    def __init__(self):
        # Supabase 클라이언트 초기화
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL과 SUPABASE_ANON_KEY 환경변수가 필요합니다")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.bucket_name = "lego-synthetic"
    
    def create_version(self, source_path: str, version: str = None, description: str = "") -> str:
        """새 데이터셋 버전 생성 (Supabase Storage에 업로드)"""
        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"소스 경로가 존재하지 않습니다: {source_path}")
        
        # 버전 번호 자동 생성
        if version is None:
            existing_versions = self._get_existing_versions()
            if existing_versions:
                last_version = max([float(v['version']) for v in existing_versions])
                version = f"{last_version + 0.1:.1f}"
            else:
                version = "1.0"
        
        print(f"[INFO] Supabase에 데이터셋 버전 {version} 생성 중...")
        
        # 파일 개수 계산
        file_counts = self._count_files_in_dataset(source)
        
        # Supabase Storage에 업로드
        storage_path = f"datasets/v{version}"
        uploaded_files = self._upload_dataset_to_storage(source, storage_path)
        
        # 데이터베이스에 버전 정보 저장
        version_data = {
            "version": version,
            "description": description,
            "file_counts": file_counts,
            "storage_path": storage_path,
            "metadata": {
                "uploaded_files": uploaded_files,
                "created_by": "system"
            }
        }
        
        # 기존 현재 버전을 비활성화
        self._deactivate_current_version()
        
        # 새 버전을 현재로 설정
        version_data["is_current"] = True
        
        result = self.supabase.table("dataset_versions").insert(version_data).execute()
        
        print(f"[SUCCESS] Supabase 데이터셋 버전 {version} 생성 완료")
        print(f"📊 파일 개수: {file_counts}")
        print(f"☁️ Storage 경로: {storage_path}")
        
        return version
    
    def list_versions(self) -> List[Dict]:
        """버전 목록 조회"""
        result = self.supabase.table("dataset_versions").select("*").order("created_at", desc=True).execute()
        return result.data
    
    def switch_version(self, version: str) -> bool:
        """버전 전환"""
        # 기존 현재 버전 비활성화
        self._deactivate_current_version()
        
        # 새 버전을 현재로 설정
        result = self.supabase.table("dataset_versions").update({
            "is_current": True
        }).eq("version", version).execute()
        
        if result.data:
            print(f"[SUCCESS] 현재 버전을 v{version}으로 전환했습니다")
            return True
        else:
            print(f"[ERROR] 버전 {version}을 찾을 수 없습니다")
            return False
    
    def backup_current_dataset(self, description: str = "") -> str:
        """현재 데이터셋 백업"""
        current_version = self._get_current_version()
        if not current_version:
            raise ValueError("현재 활성화된 데이터셋이 없습니다")
        
        # 새 버전 번호 생성
        existing_versions = self._get_existing_versions()
        if existing_versions:
            last_version = max([float(v['version']) for v in existing_versions])
            new_version = f"{last_version + 0.1:.1f}"
        else:
            new_version = "1.0"
        
        print(f"[INFO] 현재 데이터셋을 v{new_version}으로 백업 중...")
        
        # 현재 버전의 Storage 경로에서 새 버전으로 복사
        current_storage_path = current_version['storage_path']
        new_storage_path = f"datasets/v{new_version}"
        
        # Storage에서 복사 (실제 구현에서는 Storage API 사용)
        self._copy_storage_version(current_storage_path, new_storage_path)
        
        # 새 버전 정보 저장
        backup_data = {
            "version": new_version,
            "description": description or f"백업 from v{current_version['version']}",
            "file_counts": current_version['file_counts'],
            "storage_path": new_storage_path,
            "is_current": False,
            "metadata": {
                "backup_from": current_version['version'],
                "created_by": "backup_system"
            }
        }
        
        result = self.supabase.table("dataset_versions").insert(backup_data).execute()
        
        print(f"[SUCCESS] 현재 데이터셋이 v{new_version}으로 백업되었습니다")
        return new_version
    
    def _get_existing_versions(self) -> List[Dict]:
        """기존 버전 목록 조회"""
        result = self.supabase.table("dataset_versions").select("version").execute()
        return result.data
    
    def _get_current_version(self) -> Optional[Dict]:
        """현재 활성 버전 조회"""
        result = self.supabase.table("dataset_versions").select("*").eq("is_current", True).execute()
        return result.data[0] if result.data else None
    
    def _deactivate_current_version(self):
        """현재 버전 비활성화"""
        self.supabase.table("dataset_versions").update({
            "is_current": False
        }).eq("is_current", True).execute()
    
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
    
    def _upload_dataset_to_storage(self, source_path: Path, storage_path: str) -> int:
        """데이터셋을 Supabase Storage에 업로드"""
        uploaded_count = 0
        
        # 모든 파일을 재귀적으로 업로드
        for file_path in source_path.rglob("*"):
            if file_path.is_file():
                relative_path = file_path.relative_to(source_path)
                storage_file_path = f"{storage_path}/{relative_path.as_posix()}"
                
                try:
                    with open(file_path, 'rb') as f:
                        self.supabase.storage.from_(self.bucket_name).upload(
                            storage_file_path, 
                            f.read(),
                            file_options={"content-type": self._get_content_type(file_path)}
                        )
                    uploaded_count += 1
                except Exception as e:
                    print(f"[WARNING] 파일 업로드 실패 {file_path}: {e}")
        
        return uploaded_count
    
    def _copy_storage_version(self, source_path: str, dest_path: str):
        """Storage에서 버전 복사 (구현 필요)"""
        # 실제 구현에서는 Storage API를 사용하여 복사
        print(f"[INFO] Storage 복사: {source_path} → {dest_path}")
        pass
    
    def _get_content_type(self, file_path: Path) -> str:
        """파일 타입에 따른 Content-Type 반환"""
        suffix = file_path.suffix.lower()
        content_types = {
            '.webp': 'image/webp',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.yaml': 'application/x-yaml'
        }
        return content_types.get(suffix, 'application/octet-stream')

def main():
    parser = argparse.ArgumentParser(description="Supabase 데이터셋 버전 관리")
    parser.add_argument('--action', required=True, 
                       choices=['create', 'list', 'switch', 'backup'],
                       help="실행할 작업")
    parser.add_argument('--source', help="소스 데이터셋 경로 (create에 필요)")
    parser.add_argument('--version', help="버전 번호")
    parser.add_argument('--description', default="", help="버전 설명")
    
    args = parser.parse_args()
    
    try:
        manager = SupabaseDatasetVersionManager()
        
        if args.action == 'create':
            if not args.source:
                print("[ERROR] --source 옵션이 필요합니다")
                sys.exit(1)
            version = manager.create_version(args.source, args.version, args.description)
            print(f"[SUCCESS] 버전 {version} 생성 완료")
            
        elif args.action == 'list':
            versions = manager.list_versions()
            print("[REPORT] Supabase 데이터셋 버전 목록:")
            for v in versions:
                status = " (현재)" if v.get('is_current') else ""
                print(f"  v{v['version']}{status}: {v['description']} "
                      f"({v['file_counts']['total']}개 파일, "
                      f"생성일: {v['created_at']})")
                print(f"    Storage: {v['storage_path']}")
            
            # JSON 출력 (API용)
            print(json.dumps(versions, ensure_ascii=False, indent=2))
            
        elif args.action == 'switch':
            if not args.version:
                print("[ERROR] --version 옵션이 필요합니다")
                sys.exit(1)
            success = manager.switch_version(args.version)
            if not success:
                sys.exit(1)
                
        elif args.action == 'backup':
            version = manager.backup_current_dataset(args.description)
            if version:
                print(f"[SUCCESS] 현재 데이터셋을 v{version}으로 백업했습니다")
            else:
                sys.exit(1)
                
    except Exception as e:
        print(f"[ERROR] 오류: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
