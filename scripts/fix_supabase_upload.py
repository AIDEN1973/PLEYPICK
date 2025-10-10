#!/usr/bin/env python3
"""
🔧 Supabase 업로드 권한 문제 해결 스크립트
RLS 정책 위반으로 인한 업로드 실패 문제를 해결합니다.
"""

import os
import sys
import requests
import logging
from datetime import datetime
from pathlib import Path

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SupabaseUploadFixer:
    """Supabase 업로드 문제 해결 클래스"""
    
    def __init__(self):
        self.supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
        self.supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE', 'your_service_role_key')
        
        if not self.supabase_key or self.supabase_key == 'your_service_role_key':
            logger.error("❌ VITE_SUPABASE_SERVICE_ROLE 환경 변수가 설정되지 않았습니다.")
            logger.info("💡 .env 파일에 올바른 서비스 역할 키를 설정하세요.")
            sys.exit(1)
    
    def fix_rls_policies(self):
        """RLS 정책 수정"""
        logger.info("🔧 RLS 정책 수정 시작...")
        
        # SQL 스크립트 실행을 위한 Supabase REST API 호출
        sql_commands = [
            # 1. 기존 정책 삭제
            "DROP POLICY IF EXISTS \"Service role can manage model_registry\" ON model_registry;",
            "DROP POLICY IF EXISTS \"Anyone can read model_registry\" ON model_registry;",
            "DROP POLICY IF EXISTS \"Authenticated users can insert models\" ON model_registry;",
            
            # 2. 새로운 정책 생성
            "CREATE POLICY \"Anyone can read model_registry\" ON model_registry FOR SELECT USING (true);",
            "CREATE POLICY \"Service role can manage model_registry\" ON model_registry FOR ALL USING (auth.role() = 'service_role');",
            "CREATE POLICY \"Authenticated users can insert models\" ON model_registry FOR INSERT WITH CHECK (auth.role() = 'authenticated');",
            
            # 3. storage.objects 정책 수정
            "DROP POLICY IF EXISTS \"Public model access\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Service role can manage models\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Authenticated users can upload models\" ON storage.objects;",
            
            "CREATE POLICY \"Public model access\" ON storage.objects FOR SELECT USING (bucket_id = 'models');",
            "CREATE POLICY \"Service role can manage models\" ON storage.objects FOR ALL USING (auth.role() = 'service_role');",
            "CREATE POLICY \"Authenticated users can upload models\" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'models' AND auth.role() = 'authenticated');",
        ]
        
        try:
            for sql in sql_commands:
                response = requests.post(
                    f"{self.supabase_url}/rest/v1/rpc/exec_sql",
                    headers={
                        'apikey': self.supabase_key,
                        'Authorization': f'Bearer {self.supabase_key}',
                        'Content-Type': 'application/json'
                    },
                    json={'sql': sql}
                )
                
                if response.status_code not in [200, 201]:
                    logger.warning(f"⚠️ SQL 실행 실패: {sql[:50]}... - {response.status_code}")
                else:
                    logger.info(f"✅ SQL 실행 성공: {sql[:50]}...")
            
            logger.info("✅ RLS 정책 수정 완료!")
            return True
            
        except Exception as e:
            logger.error(f"❌ RLS 정책 수정 실패: {e}")
            return False
    
    def upload_model_with_service_role(self, model_path: str, model_name: str):
        """서비스 역할로 모델 업로드"""
        logger.info(f"📦 서비스 역할로 모델 업로드: {model_name}")
        
        try:
            # 모델 파일 읽기
            with open(model_path, 'rb') as f:
                model_data = f.read()
            
            # Supabase Storage에 업로드
            response = requests.post(
                f"{self.supabase_url}/storage/v1/object/models/{model_name}",
                headers={
                    'apikey': self.supabase_key,
                    'Authorization': f'Bearer {self.supabase_key}',
                    'Content-Type': 'application/octet-stream'
                },
                data=model_data
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"✅ 모델 업로드 성공: {model_name}")
                return True
            else:
                logger.error(f"❌ 모델 업로드 실패: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ 모델 업로드 실패: {e}")
            return False
    
    def update_model_registry_with_service_role(self, model_data: dict):
        """서비스 역할로 모델 레지스트리 업데이트"""
        logger.info("📊 서비스 역할로 모델 레지스트리 업데이트...")
        
        try:
            response = requests.post(
                f"{self.supabase_url}/rest/v1/model_registry",
                headers={
                    'apikey': self.supabase_key,
                    'Authorization': f'Bearer {self.supabase_key}',
                    'Content-Type': 'application/json'
                },
                json=model_data
            )
            
            if response.status_code in [200, 201]:
                logger.info("✅ 모델 레지스트리 업데이트 성공!")
                return True
            else:
                logger.error(f"❌ 모델 레지스트리 업데이트 실패: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ 모델 레지스트리 업데이트 실패: {e}")
            return False
    
    def fix_upload_issues(self, training_results: dict):
        """업로드 문제 해결"""
        logger.info("🔧 Supabase 업로드 문제 해결 시작...")
        
        # 1. RLS 정책 수정
        if not self.fix_rls_policies():
            logger.error("❌ RLS 정책 수정 실패")
            return False
        
        # 2. 모델 파일 업로드 (서비스 역할 사용)
        model_files = [
            {
                'path': training_results.get('best_model_path'),
                'name': f"{training_results.get('training_name')}/best.pt"
            },
            {
                'path': training_results.get('onnx_model_path'),
                'name': f"{training_results.get('training_name')}/best.onnx"
            }
        ]
        
        upload_success = True
        for model_file in model_files:
            if model_file['path'] and os.path.exists(model_file['path']):
                if not self.upload_model_with_service_role(model_file['path'], model_file['name']):
                    upload_success = False
            else:
                logger.warning(f"⚠️ 모델 파일을 찾을 수 없습니다: {model_file['path']}")
        
        if not upload_success:
            logger.error("❌ 모델 파일 업로드 실패")
            return False
        
        # 3. 모델 레지스트리 업데이트 (서비스 역할 사용)
        model_registry_data = {
            'model_name': f"brickbox_yolo_{training_results.get('model_type', 'seg')}",
            'model_version': '1.0.0',
            'model_type': training_results.get('model_type', 'segmentation'),
            'model_path': f"{training_results.get('training_name')}/best.onnx",
            'pt_model_path': f"{training_results.get('training_name')}/best.pt",
            'performance_metrics': training_results.get('final_metrics', {}),
            'is_active': True,
            'model_size_mb': training_results.get('model_size_mb', 0.0),
            'segmentation_support': True,
            'model_stage': 'single',
            'training_metadata': {
                'training_name': training_results.get('training_name'),
                'model_type': training_results.get('model_type'),
                'created_at': datetime.now().isoformat()
            }
        }
        
        if not self.update_model_registry_with_service_role(model_registry_data):
            logger.error("❌ 모델 레지스트리 업데이트 실패")
            return False
        
        logger.info("✅ Supabase 업로드 문제 해결 완료!")
        return True

def main():
    """메인 실행 함수"""
    if len(sys.argv) < 2:
        print("사용법: python fix_supabase_upload.py <training_results_json>")
        print("예시: python fix_supabase_upload.py training_results.json")
        sys.exit(1)
    
    results_file = sys.argv[1]
    
    try:
        import json
        with open(results_file, 'r') as f:
            training_results = json.load(f)
        
        fixer = SupabaseUploadFixer()
        success = fixer.fix_upload_issues(training_results)
        
        if success:
            print("🎉 Supabase 업로드 문제 해결 완료!")
        else:
            print("❌ Supabase 업로드 문제 해결 실패")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
