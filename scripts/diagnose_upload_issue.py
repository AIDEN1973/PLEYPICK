#!/usr/bin/env python3
"""
🔍 로컬 output 폴더 생성 vs Supabase 버킷 업로드 실패 진단 스크립트
"""

import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime
from supabase import create_client, Client

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class UploadDiagnostic:
    """업로드 문제 진단 클래스"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase: Client = create_client(supabase_url, supabase_key)
    
    def check_local_output(self, output_dir: str) -> dict:
        """로컬 output 폴더 상태 확인"""
        output_path = Path(output_dir)
        
        if not output_path.exists():
            return {
                'exists': False,
                'message': f'로컬 output 폴더가 존재하지 않습니다: {output_dir}'
            }
        
        # 폴더별 파일 개수 확인
        folders_info = {}
        total_files = 0
        
        for folder in output_path.iterdir():
            if folder.is_dir():
                files = list(folder.glob('*'))
                file_count = len(files)
                total_files += file_count
                
                folders_info[folder.name] = {
                    'path': str(folder),
                    'file_count': file_count,
                    'files': [f.name for f in files[:10]]  # 처음 10개 파일명만
                }
        
        return {
            'exists': True,
            'path': str(output_path),
            'total_folders': len(folders_info),
            'total_files': total_files,
            'folders': folders_info
        }
    
    def check_supabase_connection(self) -> dict:
        """Supabase 연결 상태 확인"""
        try:
            # 간단한 쿼리로 연결 테스트
            result = self.supabase.table('synthetic_dataset').select('*').limit(1).execute()
            
            return {
                'connected': True,
                'message': 'Supabase 연결 성공',
                'test_query': 'OK'
            }
        except Exception as e:
            return {
                'connected': False,
                'message': f'Supabase 연결 실패: {e}',
                'error': str(e)
            }
    
    def check_supabase_storage(self) -> dict:
        """Supabase Storage 상태 확인"""
        try:
            # 버킷 목록 확인
            buckets = ['lego-synthetic', 'lego_synthetic']
            bucket_status = {}
            
            for bucket in buckets:
                try:
                    result = self.supabase.storage.from_(bucket).list('synthetic', limit=10)
                    bucket_status[bucket] = {
                        'exists': True,
                        'file_count': len(result) if result else 0,
                        'files': [f.get('name', 'unknown') for f in result[:5]] if result else []
                    }
                except Exception as e:
                    bucket_status[bucket] = {
                        'exists': False,
                        'error': str(e)
                    }
            
            return {
                'success': True,
                'buckets': bucket_status
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Storage 확인 실패: {e}',
                'error': str(e)
            }
    
    def check_upload_history(self) -> dict:
        """업로드 이력 확인"""
        try:
            # 최근 업로드된 파일 조회
            result = self.supabase.table('synthetic_dataset').select('*').order('created_at', {'ascending': False}).limit(20).execute()
            
            if result.data:
                return {
                    'success': True,
                    'recent_uploads': len(result.data),
                    'latest_upload': result.data[0].get('created_at'),
                    'sample_files': [item.get('part_id') for item in result.data[:5]]
                }
            else:
                return {
                    'success': True,
                    'recent_uploads': 0,
                    'message': '업로드 이력이 없습니다'
                }
                
        except Exception as e:
            return {
                'success': False,
                'message': f'업로드 이력 조회 실패: {e}',
                'error': str(e)
            }
    
    def check_render_script_config(self) -> dict:
        """렌더링 스크립트 설정 확인"""
        render_script_path = Path('scripts/render_ldraw_to_supabase.py')
        
        if not render_script_path.exists():
            return {
                'exists': False,
                'message': '렌더링 스크립트를 찾을 수 없습니다'
            }
        
        try:
            with open(render_script_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 실시간 업로드 비활성화 확인
            upload_disabled = '# self.upload_to_supabase' in content
            local_save_enabled = '로컬 저장 완료' in content
            batch_upload_guide = '일괄 업로드 실행' in content
            
            return {
                'exists': True,
                'upload_disabled': upload_disabled,
                'local_save_enabled': local_save_enabled,
                'batch_upload_guide': batch_upload_guide,
                'status': '로컬 저장 모드' if upload_disabled else '실시간 업로드 모드'
            }
            
        except Exception as e:
            return {
                'exists': True,
                'error': f'스크립트 분석 실패: {e}'
            }
    
    def diagnose_upload_issue(self, output_dir: str) -> dict:
        """업로드 문제 종합 진단"""
        logger.info("🔍 업로드 문제 진단 시작...")
        
        diagnosis = {
            'timestamp': datetime.now().isoformat(),
            'output_dir': output_dir,
            'issues': [],
            'recommendations': []
        }
        
        # 1. 로컬 output 폴더 확인
        logger.info("📁 로컬 output 폴더 확인 중...")
        local_status = self.check_local_output(output_dir)
        diagnosis['local_status'] = local_status
        
        if not local_status['exists']:
            diagnosis['issues'].append("로컬 output 폴더가 존재하지 않습니다")
            diagnosis['recommendations'].append("렌더링 작업을 먼저 실행하세요")
            return diagnosis
        
        # 2. Supabase 연결 확인
        logger.info("🔗 Supabase 연결 확인 중...")
        connection_status = self.check_supabase_connection()
        diagnosis['connection_status'] = connection_status
        
        if not connection_status['connected']:
            diagnosis['issues'].append("Supabase 연결 실패")
            diagnosis['recommendations'].append("Supabase URL과 키를 확인하세요")
            return diagnosis
        
        # 3. Supabase Storage 확인
        logger.info("☁️ Supabase Storage 확인 중...")
        storage_status = self.check_supabase_storage()
        diagnosis['storage_status'] = storage_status
        
        if not storage_status['success']:
            diagnosis['issues'].append("Supabase Storage 접근 실패")
            diagnosis['recommendations'].append("Storage 권한을 확인하세요")
        
        # 4. 업로드 이력 확인
        logger.info("📊 업로드 이력 확인 중...")
        upload_history = self.check_upload_history()
        diagnosis['upload_history'] = upload_history
        
        if upload_history['success'] and upload_history['recent_uploads'] == 0:
            diagnosis['issues'].append("업로드 이력이 없습니다")
            diagnosis['recommendations'].append("수동으로 업로드를 실행하세요")
        
        # 5. 렌더링 스크립트 설정 확인
        logger.info("⚙️ 렌더링 스크립트 설정 확인 중...")
        script_config = self.check_render_script_config()
        diagnosis['script_config'] = script_config
        
        if script_config.get('upload_disabled'):
            diagnosis['issues'].append("실시간 업로드가 비활성화되어 있습니다")
            diagnosis['recommendations'].append("일괄 업로드를 실행하세요: python scripts/batch_upload_renderings.py output/renders")
        
        # 6. 종합 분석
        if len(diagnosis['issues']) == 0:
            diagnosis['summary'] = "모든 시스템이 정상입니다"
        else:
            diagnosis['summary'] = f"{len(diagnosis['issues'])}개의 문제가 발견되었습니다"
        
        return diagnosis
    
    def print_diagnosis_report(self, diagnosis: dict):
        """진단 결과 리포트 출력"""
        print("\n" + "="*60)
        print("🔍 업로드 문제 진단 결과")
        print("="*60)
        
        print(f"📅 진단 시간: {diagnosis['timestamp']}")
        print(f"📁 대상 폴더: {diagnosis['output_dir']}")
        print(f"📊 종합 결과: {diagnosis['summary']}")
        
        # 로컬 상태
        local = diagnosis['local_status']
        print(f"\n📁 로컬 output 폴더:")
        if local['exists']:
            print(f"  ✅ 존재함: {local['path']}")
            print(f"  📊 폴더 수: {local['total_folders']}개")
            print(f"  📄 파일 수: {local['total_files']}개")
        else:
            print(f"  ❌ {local['message']}")
        
        # 연결 상태
        conn = diagnosis['connection_status']
        print(f"\n🔗 Supabase 연결:")
        if conn['connected']:
            print(f"  ✅ {conn['message']}")
        else:
            print(f"  ❌ {conn['message']}")
        
        # Storage 상태
        storage = diagnosis['storage_status']
        print(f"\n☁️ Supabase Storage:")
        if storage['success']:
            for bucket, status in storage['buckets'].items():
                if status['exists']:
                    print(f"  ✅ {bucket}: {status['file_count']}개 파일")
                else:
                    print(f"  ❌ {bucket}: {status['error']}")
        else:
            print(f"  ❌ {storage['message']}")
        
        # 업로드 이력
        history = diagnosis['upload_history']
        print(f"\n📊 업로드 이력:")
        if history['success']:
            print(f"  📄 최근 업로드: {history['recent_uploads']}개")
            if history.get('latest_upload'):
                print(f"  🕒 최신 업로드: {history['latest_upload']}")
        else:
            print(f"  ❌ {history['message']}")
        
        # 스크립트 설정
        script = diagnosis['script_config']
        print(f"\n⚙️ 렌더링 스크립트:")
        if script['exists']:
            print(f"  📄 상태: {script['status']}")
            if script.get('upload_disabled'):
                print(f"  ⚠️ 실시간 업로드 비활성화됨")
        else:
            print(f"  ❌ {script['message']}")
        
        # 문제점 및 해결책
        if diagnosis['issues']:
            print(f"\n🚨 발견된 문제점:")
            for i, issue in enumerate(diagnosis['issues'], 1):
                print(f"  {i}. {issue}")
            
            print(f"\n💡 해결 방법:")
            for i, rec in enumerate(diagnosis['recommendations'], 1):
                print(f"  {i}. {rec}")
        else:
            print(f"\n✅ 모든 시스템이 정상입니다!")
        
        print("="*60)

def main():
    """메인 실행 함수"""
    if len(sys.argv) < 2:
        print("사용법: python diagnose_upload_issue.py <output_dir>")
        print("예시: python diagnose_upload_issue.py output/renders")
        sys.exit(1)
    
    output_dir = sys.argv[1]
    
    # Supabase 설정
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk')
    
    try:
        # 진단 실행
        diagnostic = UploadDiagnostic(supabase_url, supabase_key)
        diagnosis = diagnostic.diagnose_upload_issue(output_dir)
        
        # 결과 출력
        diagnostic.print_diagnosis_report(diagnosis)
        
        # JSON 파일로 저장
        report_file = f"upload_diagnosis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(diagnosis, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"\n📄 상세 리포트 저장: {report_file}")
        
    except Exception as e:
        logger.error(f"❌ 진단 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
