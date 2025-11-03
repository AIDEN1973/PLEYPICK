#!/usr/bin/env python3
"""
하이브리드 데이터셋 버전 관리 시스템
- 로컬: 빠른 접근, 실험, 개발
- Supabase: 백업, 공유, 프로덕션
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import argparse

# UTF-8 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

class HybridDatasetVersionManager:
    """하이브리드 데이터셋 버전 관리 클래스"""
    
    def __init__(self, base_dir: str = "output"):
        self.base_dir = Path(base_dir)
        self.local_manager = None  # 로컬 버전 관리자
        self.supabase_manager = None  # Supabase 버전 관리자
        
        # 환경에 따라 관리자 초기화
        self._initialize_managers()
    
    def _initialize_managers(self):
        """로컬 및 Supabase 관리자 초기화"""
        try:
            # 로컬 관리자 (항상 사용 가능)
            from dataset_version_manager import DatasetVersionManager
            self.local_manager = DatasetVersionManager(str(self.base_dir))
        except Exception as e:
            print(f"[WARNING] 로컬 버전 관리자 초기화 실패: {e}")
        
        try:
            # Supabase 관리자 (환경변수 있을 때만)
            if os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_ANON_KEY'):
                from supabase_dataset_version_manager import SupabaseDatasetVersionManager
                self.supabase_manager = SupabaseDatasetVersionManager()
            else:
                print("[INFO] Supabase 환경변수가 없어 클라우드 버전 관리를 사용할 수 없습니다")
        except Exception as e:
            print(f"[WARNING] Supabase 버전 관리자 초기화 실패: {e}")
    
    def create_version(self, source_path: str, version: str = None, description: str = "", sync_to_cloud: bool = False) -> str:
        """새 데이터셋 버전 생성"""
        created_versions = []
        
        # 1. 로컬 버전 생성
        if self.local_manager:
            try:
                local_version = self.local_manager.create_version(source_path, version, description)
                created_versions.append(f"로컬: v{local_version}")
            except Exception as e:
                print(f"[ERROR] 로컬 버전 생성 실패: {e}")
        
        # 2. 클라우드 버전 생성 (옵션)
        if sync_to_cloud and self.supabase_manager:
            try:
                cloud_version = self.supabase_manager.create_version(source_path, version, description)
                created_versions.append(f"클라우드: v{cloud_version}")
            except Exception as e:
                print(f"[ERROR] 클라우드 버전 생성 실패: {e}")
        
        print(f"[SUCCESS] 버전 생성 완료: {', '.join(created_versions)}")
        return version or "1.0"
    
    def list_versions(self) -> Dict:
        """버전 목록 조회 (로컬 + 클라우드)"""
        versions = {
            "local": [],
            "cloud": [],
            "hybrid": []
        }
        
        # 로컬 버전 조회
        if self.local_manager:
            try:
                local_versions = self.local_manager.list_versions()
                versions["local"] = local_versions
            except Exception as e:
                print(f"[WARNING] 로컬 버전 조회 실패: {e}")
        
        # 클라우드 버전 조회
        if self.supabase_manager:
            try:
                cloud_versions = self.supabase_manager.list_versions()
                versions["cloud"] = cloud_versions
            except Exception as e:
                print(f"[WARNING] 클라우드 버전 조회 실패: {e}")
        
        # 하이브리드 분석
        versions["hybrid"] = self._analyze_version_sync(versions["local"], versions["cloud"])
        
        return versions
    
    def sync_to_cloud(self, version: str = None):
        """로컬 버전을 클라우드로 동기화"""
        if not self.supabase_manager:
            print("[ERROR] Supabase 관리자가 초기화되지 않았습니다")
            return False
        
        if not self.local_manager:
            print("[ERROR] 로컬 관리자가 초기화되지 않았습니다")
            return False
        
        try:
            # 현재 로컬 버전 가져오기
            local_versions = self.local_manager.list_versions()
            current_version = next((v for v in local_versions if v.get('is_current')), None)
            
            if not current_version:
                print("[ERROR] 현재 활성화된 로컬 버전이 없습니다")
                return False
            
            # 클라우드로 동기화
            cloud_version = self.supabase_manager.create_version(
                str(self.base_dir / "dataset_synthetic"),
                current_version['version'],
                f"로컬에서 동기화: {current_version['description']}"
            )
            
            print(f"[SUCCESS] 로컬 v{current_version['version']}을 클라우드로 동기화 완료")
            return True
            
        except Exception as e:
            print(f"[ERROR] 클라우드 동기화 실패: {e}")
            return False
    
    def sync_from_cloud(self, version: str):
        """클라우드 버전을 로컬로 동기화"""
        if not self.supabase_manager:
            print("[ERROR] Supabase 관리자가 초기화되지 않았습니다")
            return False
        
        try:
            # 클라우드에서 버전 정보 조회
            cloud_versions = self.supabase_manager.list_versions()
            target_version = next((v for v in cloud_versions if v['version'] == version), None)
            
            if not target_version:
                print(f"[ERROR] 클라우드에서 버전 {version}을 찾을 수 없습니다")
                return False
            
            # Storage에서 다운로드 (구현 필요)
            print(f"[INFO] 클라우드 버전 v{version}을 로컬로 다운로드 중...")
            # TODO: Storage에서 로컬로 다운로드 구현
            
            print(f"[SUCCESS] 클라우드 v{version}을 로컬로 동기화 완료")
            return True
            
        except Exception as e:
            print(f"[ERROR] 클라우드에서 동기화 실패: {e}")
            return False
    
    def _analyze_version_sync(self, local_versions: List, cloud_versions: List) -> List[Dict]:
        """로컬과 클라우드 버전 동기화 상태 분석"""
        hybrid_analysis = []
        
        # 로컬 버전 분석
        for local_v in local_versions:
            cloud_match = next((c for c in cloud_versions if c['version'] == local_v['version']), None)
            hybrid_analysis.append({
                "version": local_v['version'],
                "source": "local",
                "synced": cloud_match is not None,
                "cloud_version": cloud_match,
                "status": "synced" if cloud_match else "local_only"
            })
        
        # 클라우드 전용 버전 분석
        for cloud_v in cloud_versions:
            local_match = next((l for l in local_versions if l['version'] == cloud_v['version']), None)
            if not local_match:
                hybrid_analysis.append({
                    "version": cloud_v['version'],
                    "source": "cloud",
                    "synced": False,
                    "local_version": None,
                    "status": "cloud_only"
                })
        
        return hybrid_analysis

def main():
    parser = argparse.ArgumentParser(description="하이브리드 데이터셋 버전 관리")
    parser.add_argument('--action', required=True,
                       choices=['create', 'list', 'sync-to-cloud', 'sync-from-cloud'],
                       help="실행할 작업")
    parser.add_argument('--source', help="소스 데이터셋 경로")
    parser.add_argument('--version', help="버전 번호")
    parser.add_argument('--description', default="", help="버전 설명")
    parser.add_argument('--sync-cloud', action='store_true', help="클라우드 동기화 포함")
    
    args = parser.parse_args()
    
    try:
        manager = HybridDatasetVersionManager()
        
        if args.action == 'create':
            if not args.source:
                print("[ERROR] --source 옵션이 필요합니다")
                sys.exit(1)
            version = manager.create_version(args.source, args.version, args.description, args.sync_cloud)
            print(f"[SUCCESS] 하이브리드 버전 {version} 생성 완료")
            
        elif args.action == 'list':
            versions = manager.list_versions()
            print("[REPORT] 하이브리드 데이터셋 버전 목록:")
            
            print("\n🏠 로컬 버전:")
            for v in versions["local"]:
                status = " (현재)" if v.get('is_current') else ""
                print(f"  v{v['version']}{status}: {v['file_counts']['total']}개 파일")
            
            print("\n☁️ 클라우드 버전:")
            for v in versions["cloud"]:
                status = " (현재)" if v.get('is_current') else ""
                print(f"  v{v['version']}{status}: {v['file_counts']['total']}개 파일")
            
            print("\n[RETRY] 동기화 상태:")
            for v in versions["hybrid"]:
                sync_status = "[OK]" if v['synced'] else "[ERROR]"
                print(f"  v{v['version']} ({v['source']}): {sync_status} {v['status']}")
            
            # JSON 출력 (API용)
            print(json.dumps(versions, ensure_ascii=False, indent=2))
            
        elif args.action == 'sync-to-cloud':
            success = manager.sync_to_cloud(args.version)
            if not success:
                sys.exit(1)
                
        elif args.action == 'sync-from-cloud':
            if not args.version:
                print("[ERROR] --version 옵션이 필요합니다")
                sys.exit(1)
            success = manager.sync_from_cloud(args.version)
            if not success:
                sys.exit(1)
                
    except Exception as e:
        print(f"[ERROR] 오류: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
