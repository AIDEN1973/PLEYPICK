#!/usr/bin/env python3
"""
🧱 BrickBox 렌더링 일괄 업로드 스크립트
로컬 output 폴더의 렌더링 이미지를 렌더링 완료 후 일괄 업로드
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
import requests
from supabase import create_client, Client

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BatchUploadManager:
    """렌더링 일괄 업로드 관리자"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.upload_queue = []
        self.upload_results = []
    
    def scan_local_renderings(self, output_dir: str) -> List[Dict]:
        """로컬 렌더링 결과 스캔"""
        output_path = Path(output_dir)
        if not output_path.exists():
            logger.warning(f"로컬 output 폴더가 존재하지 않습니다: {output_dir}")
            return []
        
        renderings = []
        
        # 렌더링 폴더 스캔
        for part_folder in output_path.iterdir():
            if part_folder.is_dir():
                part_id = part_folder.name
                
                # 이미지 파일 스캔
                image_files = list(part_folder.glob("*.png")) + list(part_folder.glob("*.jpg"))
                annotation_files = list(part_folder.glob("*.txt"))
                metadata_files = list(part_folder.glob("*.json"))
                
                for image_file in image_files:
                    # 해당하는 어노테이션 파일 찾기
                    annotation_file = None
                    for ann_file in annotation_files:
                        if ann_file.stem == image_file.stem:
                            annotation_file = ann_file
                            break
                    
                    # 메타데이터 파일 찾기
                    metadata_file = None
                    for meta_file in metadata_files:
                        if meta_file.stem == image_file.stem:
                            metadata_file = meta_file
                            break
                    
                    rendering_info = {
                        'part_id': part_id,
                        'image_path': str(image_file),
                        'annotation_path': str(annotation_file) if annotation_file else None,
                        'metadata_path': str(metadata_file) if metadata_file else None,
                        'filename': image_file.name,
                        'size': image_file.stat().st_size,
                        'created_at': datetime.fromtimestamp(image_file.stat().st_ctime)
                    }
                    
                    renderings.append(rendering_info)
        
        logger.info(f"📊 로컬 렌더링 스캔 완료: {len(renderings)}개 파일")
        return renderings
    
    def check_existing_uploads(self, renderings: List[Dict]) -> List[Dict]:
        """이미 업로드된 파일 확인"""
        logger.info("🔍 기존 업로드 파일 확인 중...")
        
        # Supabase에서 기존 파일 목록 조회
        existing_files = set()
        try:
            # synthetic_dataset 테이블에서 기존 파일 확인
            result = self.supabase.table('synthetic_dataset').select('image_url').execute()
            
            for row in result.data:
                if row.get('image_url'):
                    # URL에서 파일명 추출
                    filename = row['image_url'].split('/')[-1]
                    existing_files.add(filename)
            
            logger.info(f"📋 기존 업로드 파일: {len(existing_files)}개")
            
        except Exception as e:
            logger.warning(f"⚠️ 기존 파일 확인 실패: {e}")
        
        # 업로드할 파일 필터링
        upload_queue = []
        for rendering in renderings:
            if rendering['filename'] not in existing_files:
                upload_queue.append(rendering)
            else:
                logger.info(f"⏭️ 이미 업로드됨: {rendering['filename']}")
        
        logger.info(f"📤 업로드 대기: {len(upload_queue)}개 파일")
        return upload_queue
    
    def upload_single_rendering(self, rendering: Dict) -> bool:
        """단일 렌더링 파일 업로드"""
        try:
            part_id = rendering['part_id']
            image_path = rendering['image_path']
            annotation_path = rendering['annotation_path']
            metadata_path = rendering['metadata_path']
            filename = rendering['filename']
            
            logger.info(f"📤 업로드 중: {filename}")
            
            # 이미지 업로드
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            image_supabase_path = f"synthetic/{part_id}/{filename}"
            image_result = self.supabase.storage.from_('lego-synthetic').upload(
                image_supabase_path,
                image_data,
                file_options={"content-type": "image/png", "upsert": True}
            )
            
            if hasattr(image_result, 'error') and image_result.error:
                raise Exception(f"이미지 업로드 실패: {image_result.error}")
            
            # 공개 URL 생성
            image_url_data = self.supabase.storage.from_('lego-synthetic').getPublicUrl(image_supabase_path)
            image_url = image_url_data.publicUrl
            
            # 어노테이션 업로드 (있는 경우)
            annotation_url = None
            if annotation_path and os.path.exists(annotation_path):
                with open(annotation_path, 'rb') as f:
                    annotation_data = f.read()
                
                annotation_filename = os.path.basename(annotation_path)
                annotation_supabase_path = f"synthetic/{part_id}/{annotation_filename}"
                annotation_result = self.supabase.storage.from_('lego-synthetic').upload(
                    annotation_supabase_path,
                    annotation_data,
                    file_options={"content-type": "text/plain", "upsert": True}
                )
                
                if not (hasattr(annotation_result, 'error') and annotation_result.error):
                    annotation_url_data = self.supabase.storage.from_('lego-synthetic').getPublicUrl(annotation_supabase_path)
                    annotation_url = annotation_url_data.publicUrl
            
            # 메타데이터 로드 (있는 경우)
            metadata = {}
            if metadata_path and os.path.exists(metadata_path):
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
            
            # synthetic_dataset 테이블에 레코드 삽입
            dataset_record = {
                'part_id': part_id,
                'image_url': image_url,
                'annotation_url': annotation_url,
                'metadata': metadata,
                'created_at': datetime.now().isoformat(),
                'status': 'completed'
            }
            
            insert_result = self.supabase.table('synthetic_dataset').insert(dataset_record).execute()
            
            if hasattr(insert_result, 'error') and insert_result.error:
                raise Exception(f"데이터베이스 삽입 실패: {insert_result.error}")
            
            logger.info(f"✅ 업로드 완료: {filename}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 업로드 실패 {filename}: {e}")
            return False
    
    def batch_upload(self, output_dir: str, batch_size: int = 10) -> Dict:
        """일괄 업로드 실행"""
        logger.info("🚀 렌더링 일괄 업로드 시작")
        
        # 1. 로컬 렌더링 스캔
        renderings = self.scan_local_renderings(output_dir)
        if not renderings:
            logger.warning("📭 업로드할 렌더링 파일이 없습니다")
            return {'success': False, 'message': '업로드할 파일 없음'}
        
        # 2. 기존 업로드 확인
        upload_queue = self.check_existing_uploads(renderings)
        if not upload_queue:
            logger.info("✅ 모든 파일이 이미 업로드되었습니다")
            return {'success': True, 'message': '모든 파일이 이미 업로드됨'}
        
        # 3. 배치 업로드 실행
        success_count = 0
        fail_count = 0
        
        for i in range(0, len(upload_queue), batch_size):
            batch = upload_queue[i:i+batch_size]
            logger.info(f"📦 배치 {i//batch_size + 1} 처리 중 ({len(batch)}개 파일)")
            
            for rendering in batch:
                if self.upload_single_rendering(rendering):
                    success_count += 1
                else:
                    fail_count += 1
                
                # 배치 간 잠시 대기 (API 제한 방지)
                time.sleep(0.5)
            
            # 배치 간 대기
            if i + batch_size < len(upload_queue):
                logger.info(f"⏳ 다음 배치까지 대기 중...")
                time.sleep(2)
        
        # 4. 결과 요약
        result = {
            'success': fail_count == 0,
            'total_files': len(upload_queue),
            'success_count': success_count,
            'fail_count': fail_count,
            'message': f'업로드 완료: {success_count}개 성공, {fail_count}개 실패'
        }
        
        logger.info(f"🎉 일괄 업로드 완료: {result['message']}")
        return result
    
    def cleanup_local_files(self, output_dir: str, keep_backup: bool = True) -> bool:
        """로컬 파일 정리 (선택사항)"""
        try:
            if keep_backup:
                # 백업 폴더로 이동
                backup_dir = Path(output_dir).parent / f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                backup_dir.mkdir(exist_ok=True)
                shutil.move(output_dir, backup_dir)
                logger.info(f"📦 로컬 파일을 백업 폴더로 이동: {backup_dir}")
            else:
                # 완전 삭제
                shutil.rmtree(output_dir)
                logger.info(f"🗑️ 로컬 파일 삭제: {output_dir}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 로컬 파일 정리 실패: {e}")
            return False

def main():
    """메인 실행 함수"""
    if len(sys.argv) < 2:
        print("사용법: python batch_upload_renderings.py <output_dir> [--cleanup] [--batch-size N]")
        print("옵션:")
        print("  --cleanup: 업로드 후 로컬 파일 정리")
        print("  --batch-size N: 배치 크기 설정 (기본값: 10)")
        sys.exit(1)
    
    output_dir = sys.argv[1]
    cleanup = '--cleanup' in sys.argv
    batch_size = 10
    
    # 배치 크기 설정
    if '--batch-size' in sys.argv:
        try:
            batch_size_idx = sys.argv.index('--batch-size')
            batch_size = int(sys.argv[batch_size_idx + 1])
        except (ValueError, IndexError):
            logger.warning("⚠️ 잘못된 배치 크기, 기본값 사용")
    
    # Supabase 설정
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk')
    
    try:
        # 일괄 업로드 실행
        uploader = BatchUploadManager(supabase_url, supabase_key)
        result = uploader.batch_upload(output_dir, batch_size)
        
        if result['success']:
            logger.info("🎉 일괄 업로드 성공!")
            
            # 로컬 파일 정리 (선택사항)
            if cleanup:
                uploader.cleanup_local_files(output_dir, keep_backup=True)
        else:
            logger.error(f"❌ 일괄 업로드 실패: {result['message']}")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
