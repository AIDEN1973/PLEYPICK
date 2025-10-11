#!/usr/bin/env python3
"""
🧱 BrickBox 수동 폴더 업로드 스크립트
로컬 폴더를 Supabase Storage에 한번에 업로드
"""

import os
import sys
import json
import time
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from supabase import create_client, Client

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ManualUploader:
    """수동 폴더 업로드 관리자"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase: Client = create_client(supabase_url, supabase_key)
    
    def upload_folder(self, local_folder: str, remote_folder: str = None) -> Dict:
        """폴더 전체를 Supabase에 업로드"""
        local_path = Path(local_folder)
        if not local_path.exists():
            logger.error(f"❌ 로컬 폴더가 존재하지 않습니다: {local_folder}")
            return {'success': False, 'message': '폴더가 존재하지 않음'}
        
        # 원격 폴더명 설정
        if not remote_folder:
            remote_folder = local_path.name
        
        logger.info(f"📁 폴더 업로드 시작: {local_folder} → {remote_folder}")
        
        # 파일 목록 수집
        files_to_upload = []
        for file_path in local_path.rglob('*'):
            if file_path.is_file():
                # 상대 경로 계산
                relative_path = file_path.relative_to(local_path)
                remote_path = f"{remote_folder}/{relative_path}".replace('\\', '/')
                
                files_to_upload.append({
                    'local_path': str(file_path),
                    'remote_path': remote_path,
                    'size': file_path.stat().st_size,
                    'name': file_path.name
                })
        
        logger.info(f"📊 업로드할 파일: {len(files_to_upload)}개")
        
        # 업로드 실행
        success_count = 0
        fail_count = 0
        failed_files = []
        
        for i, file_info in enumerate(files_to_upload, 1):
            try:
                logger.info(f"📤 업로드 중 ({i}/{len(files_to_upload)}): {file_info['name']}")
                
                # 파일 읽기
                with open(file_info['local_path'], 'rb') as f:
                    file_data = f.read()
                
                # MIME 타입 결정
                content_type = self._get_content_type(file_info['local_path'])
                
                # Supabase에 업로드
                result = self.supabase.storage.from_('lego-synthetic').upload(
                    file_info['remote_path'],
                    file_data,
                    file_options={
                        "content-type": content_type,
                        "upsert": True  # 덮어쓰기 허용
                    }
                )
                
                if hasattr(result, 'error') and result.error:
                    raise Exception(f"업로드 실패: {result.error}")
                
                success_count += 1
                logger.info(f"✅ 업로드 완료: {file_info['name']}")
                
                # 업로드 간 잠시 대기 (API 제한 방지)
                time.sleep(0.1)
                
            except Exception as e:
                fail_count += 1
                failed_files.append(file_info['name'])
                logger.error(f"❌ 업로드 실패 {file_info['name']}: {e}")
        
        # 결과 요약
        result = {
            'success': fail_count == 0,
            'total_files': len(files_to_upload),
            'success_count': success_count,
            'fail_count': fail_count,
            'failed_files': failed_files,
            'message': f'업로드 완료: {success_count}개 성공, {fail_count}개 실패'
        }
        
        logger.info(f"🎉 폴더 업로드 완료: {result['message']}")
        return result
    
    def _get_content_type(self, file_path: str) -> str:
        """파일 확장자에 따른 MIME 타입 결정"""
        ext = Path(file_path).suffix.lower()
        
        content_types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.csv': 'text/csv',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip',
            '.pt': 'application/octet-stream',
            '.onnx': 'application/octet-stream',
            '.pth': 'application/octet-stream'
        }
        
        return content_types.get(ext, 'application/octet-stream')
    
    def create_public_urls(self, remote_folder: str) -> List[Dict]:
        """업로드된 파일들의 공개 URL 생성"""
        try:
            # Supabase Storage에서 파일 목록 조회
            result = self.supabase.storage.from_('lego-synthetic').list(remote_folder)
            
            if hasattr(result, 'error') and result.error:
                logger.error(f"❌ 파일 목록 조회 실패: {result.error}")
                return []
            
            public_urls = []
            for file_info in result:
                if file_info.get('name'):
                    # 공개 URL 생성
                    url_data = self.supabase.storage.from_('lego-synthetic').getPublicUrl(f"{remote_folder}/{file_info['name']}")
                    
                    public_urls.append({
                        'name': file_info['name'],
                        'url': url_data.publicUrl,
                        'size': file_info.get('size', 0)
                    })
            
            logger.info(f"🔗 공개 URL 생성 완료: {len(public_urls)}개")
            return public_urls
            
        except Exception as e:
            logger.error(f"❌ 공개 URL 생성 실패: {e}")
            return []
    
    def sync_to_database(self, remote_folder: str, part_id: str = None) -> bool:
        """업로드된 파일들을 데이터베이스에 동기화"""
        try:
            # 공개 URL 생성
            public_urls = self.create_public_urls(remote_folder)
            
            if not public_urls:
                logger.warning("⚠️ 동기화할 파일이 없습니다")
                return False
            
            # 데이터베이스 레코드 생성
            records = []
            for url_info in public_urls:
                # Part ID 추출 (폴더명 또는 파일명에서)
                if not part_id:
                    part_id = remote_folder.split('/')[0]
                
                record = {
                    'part_id': part_id,
                    'image_url': url_info['url'],
                    'filename': url_info['name'],
                    'file_size': url_info['size'],
                    'created_at': datetime.now().isoformat(),
                    'status': 'completed',
                    'upload_method': 'manual_folder'
                }
                
                records.append(record)
            
            # 데이터베이스에 삽입
            insert_result = self.supabase.table('synthetic_dataset').insert(records).execute()
            
            if hasattr(insert_result, 'error') and insert_result.error:
                raise Exception(f"데이터베이스 동기화 실패: {insert_result.error}")
            
            logger.info(f"✅ 데이터베이스 동기화 완료: {len(records)}개 레코드")
            return True
            
        except Exception as e:
            logger.error(f"❌ 데이터베이스 동기화 실패: {e}")
            return False

def main():
    """메인 실행 함수"""
    if len(sys.argv) < 2:
        print("사용법: python manual_upload_supabase.py <local_folder> [remote_folder] [--sync-db] [--part-id ID]")
        print("옵션:")
        print("  --sync-db: 데이터베이스에 동기화")
        print("  --part-id ID: Part ID 설정")
        print("\n사용법:")
        print("  python manual_upload_supabase.py output/renders/3001")
        print("  python manual_upload_supabase.py output/renders/3001 3001_renders --sync-db --part-id 3001")
        sys.exit(1)
    
    local_folder = sys.argv[1]
    remote_folder = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else None
    sync_db = '--sync-db' in sys.argv
    part_id = None
    
    # Part ID 추출
    if '--part-id' in sys.argv:
        try:
            part_id_idx = sys.argv.index('--part-id')
            part_id = sys.argv[part_id_idx + 1]
        except (ValueError, IndexError):
            logger.warning("⚠️ 잘못된 Part ID, 자동 추출 시도")
    
    # Supabase 설정
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk')
    
    try:
        # 수동 업로드 실행
        uploader = ManualUploader(supabase_url, supabase_key)
        result = uploader.upload_folder(local_folder, remote_folder)
        
        if result['success']:
            logger.info("🎉 폴더 업로드 성공!")
            
            # 데이터베이스 동기화 (선택사항)
            if sync_db:
                if uploader.sync_to_database(remote_folder or Path(local_folder).name, part_id):
                    logger.info("✅ 데이터베이스 동기화 완료!")
                else:
                    logger.warning("⚠️ 데이터베이스 동기화 실패")
        else:
            logger.error(f"❌ 폴더 업로드 실패: {result['message']}")
            if result['failed_files']:
                logger.error(f"실패한 파일: {', '.join(result['failed_files'])}")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
