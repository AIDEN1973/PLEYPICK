#!/usr/bin/env python3
"""
🚀 수정된 업로드 스크립트 실행
학습 완료 후 Supabase 업로드 문제를 해결합니다.
"""

import os
import sys
import json
import requests
import logging
from datetime import datetime
from pathlib import Path

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def execute_sql_policy_fix():
    """SQL 정책 수정 실행"""
    logger.info("🔧 SQL 정책 수정 실행...")
    
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    if not supabase_key:
        logger.error("❌ VITE_SUPABASE_SERVICE_ROLE 환경 변수가 설정되지 않았습니다.")
        return False
    
    # SQL 정책 수정 명령어들
    sql_commands = [
        # 기존 정책 삭제
        "DROP POLICY IF EXISTS \"Service role can manage model_registry\" ON model_registry;",
        "DROP POLICY IF EXISTS \"Anyone can read model_registry\" ON model_registry;",
        "DROP POLICY IF EXISTS \"Authenticated users can insert models\" ON model_registry;",
        
        # 새로운 정책 생성
        "CREATE POLICY \"Anyone can read model_registry\" ON model_registry FOR SELECT USING (true);",
        "CREATE POLICY \"Service role can manage model_registry\" ON model_registry FOR ALL USING (auth.role() = 'service_role');",
        "CREATE POLICY \"Authenticated users can insert models\" ON model_registry FOR INSERT WITH CHECK (auth.role() = 'authenticated');",
        
        # storage.objects 정책 수정
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
                f"{supabase_url}/rest/v1/rpc/exec_sql",
                headers={
                    'apikey': supabase_key,
                    'Authorization': f'Bearer {supabase_key}',
                    'Content-Type': 'application/json'
                },
                json={'sql': sql}
            )
            
            if response.status_code not in [200, 201]:
                logger.warning(f"⚠️ SQL 실행 실패: {sql[:50]}... - {response.status_code}")
            else:
                logger.info(f"✅ SQL 실행 성공: {sql[:50]}...")
        
        logger.info("✅ SQL 정책 수정 완료!")
        return True
        
    except Exception as e:
        logger.error(f"❌ SQL 정책 수정 실패: {e}")
        return False

def upload_model_files():
    """모델 파일 업로드"""
    logger.info("📦 모델 파일 업로드 시작...")
    
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    # 학습 결과 정보
    training_name = "brickbox_s_seg_20251010_034224"
    model_files = [
        {
            'path': f'/content/brickbox_yolo/{training_name}/weights/best.pt',
            'name': f'{training_name}/best.pt'
        },
        {
            'path': f'/content/brickbox_yolo/{training_name}/weights/best.onnx',
            'name': f'{training_name}/best.onnx'
        }
    ]
    
    upload_results = {}
    
    for model_file in model_files:
        if os.path.exists(model_file['path']):
            try:
                with open(model_file['path'], 'rb') as f:
                    model_data = f.read()
                
                response = requests.post(
                    f"{supabase_url}/storage/v1/object/models/{model_file['name']}",
                    headers={
                        'apikey': supabase_key,
                        'Authorization': f'Bearer {supabase_key}',
                        'Content-Type': 'application/octet-stream'
                    },
                    data=model_data
                )
                
                if response.status_code in [200, 201]:
                    logger.info(f"✅ 모델 업로드 성공: {model_file['name']}")
                    upload_results[model_file['name']] = True
                else:
                    logger.error(f"❌ 모델 업로드 실패: {model_file['name']} - {response.status_code}")
                    upload_results[model_file['name']] = False
                    
            except Exception as e:
                logger.error(f"❌ 모델 업로드 실패: {model_file['name']} - {e}")
                upload_results[model_file['name']] = False
        else:
            logger.warning(f"⚠️ 모델 파일을 찾을 수 없습니다: {model_file['path']}")
            upload_results[model_file['name']] = False
    
    return upload_results

def update_model_registry():
    """모델 레지스트리 업데이트"""
    logger.info("📊 모델 레지스트리 업데이트...")
    
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    training_name = "brickbox_s_seg_20251010_034224"
    
    model_registry_data = {
        'model_name': 'brickbox_yolo_segmentation',
        'model_version': '1.0.0',
        'model_type': 'segmentation',
        'model_path': f'{training_name}/best.onnx',
        'pt_model_path': f'{training_name}/best.pt',
        'performance_metrics': {
            'mAP50': 0.872,
            'mAP50-95': 0.575,
            'precision': 0.712,
            'recall': 0.61
        },
        'is_active': True,
        'model_size_mb': 20.5,
        'segmentation_support': True,
        'model_stage': 'single',
        'training_metadata': {
            'training_name': training_name,
            'model_type': 'segmentation',
            'created_at': datetime.now().isoformat()
        }
    }
    
    try:
        response = requests.post(
            f"{supabase_url}/rest/v1/model_registry",
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
                'Content-Type': 'application/json'
            },
            json=model_registry_data
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

def main():
    """메인 실행 함수"""
    logger.info("🚀 수정된 업로드 스크립트 실행 시작...")
    
    # 1. SQL 정책 수정
    if not execute_sql_policy_fix():
        logger.error("❌ SQL 정책 수정 실패")
        return
    
    # 2. 모델 파일 업로드
    upload_results = upload_model_files()
    
    # 3. 모델 레지스트리 업데이트
    if update_model_registry():
        logger.info("🎉 모든 업로드 작업 완료!")
        
        # 결과 요약
        logger.info("📊 업로드 결과 요약:")
        for model_name, success in upload_results.items():
            status = "✅ 성공" if success else "❌ 실패"
            logger.info(f"  - {model_name}: {status}")
    else:
        logger.error("❌ 모델 레지스트리 업데이트 실패")

if __name__ == "__main__":
    main()
