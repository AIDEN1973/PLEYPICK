#!/usr/bin/env python3
"""
🔧 수정된 학습 완료 후 처리 스크립트
RLS 정책 문제를 해결한 버전
"""

import os
import sys
import json
import logging
import requests
from datetime import datetime
from pathlib import Path

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def fix_supabase_upload_issues():
    """Supabase 업로드 문제 해결"""
    logger.info("🔧 Supabase 업로드 문제 해결 시작...")
    
    # 환경 변수 확인
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    if not supabase_key:
        logger.error("❌ VITE_SUPABASE_SERVICE_ROLE 환경 변수가 설정되지 않았습니다.")
        return False
    
    try:
        # 1. RLS 정책 수정을 위한 SQL 실행
        sql_commands = [
            # 기존 정책 삭제
            "DROP POLICY IF EXISTS \"Service role can manage model_registry\" ON model_registry;",
            "DROP POLICY IF EXISTS \"Anyone can read model_registry\" ON model_registry;",
            "DROP POLICY IF EXISTS \"Authenticated users can insert models\" ON model_registry;",
            
            # 새로운 정책 생성
            "CREATE POLICY \"Anyone can read model_registry\" ON model_registry FOR SELECT USING (true);",
            "CREATE POLICY \"Service role can manage model_registry\" ON model_registry FOR ALL USING (auth.role() = 'service_role');",
            "CREATE POLICY \"Authenticated users can insert models\" ON model_registry FOR INSERT WITH CHECK (auth.role() = 'authenticated');",
        ]
        
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
                logger.warning(f"⚠️ SQL 실행 실패: {sql[:50]}...")
            else:
                logger.info(f"✅ SQL 실행 성공: {sql[:50]}...")
        
        logger.info("✅ RLS 정책 수정 완료!")
        return True
        
    except Exception as e:
        logger.error(f"❌ RLS 정책 수정 실패: {e}")
        return False

def upload_model_to_supabase(model_path: str, model_name: str):
    """Supabase에 모델 업로드"""
    logger.info(f"📦 모델 업로드: {model_name}")
    
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    try:
        # 모델 파일 읽기
        with open(model_path, 'rb') as f:
            model_data = f.read()
        
        # Supabase Storage에 업로드
        response = requests.post(
            f"{supabase_url}/storage/v1/object/models/{model_name}",
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
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

def update_model_registry(model_data: dict):
    """모델 레지스트리 업데이트"""
    logger.info("📊 모델 레지스트리 업데이트...")
    
    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
    supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    try:
        response = requests.post(
            f"{supabase_url}/rest/v1/model_registry",
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
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

def main():
    """메인 실행 함수"""
    logger.info("🚀 수정된 학습 완료 후 처리 시작...")
    
    # 학습 결과 정보 (실제 값으로 대체)
    training_name = "brickbox_s_seg_20251010_034224"
    model_type = "segmentation"
    
    # 모델 파일 경로
    best_model_path = f"/content/brickbox_yolo/{training_name}/weights/best.pt"
    onnx_model_path = f"/content/brickbox_yolo/{training_name}/weights/best.onnx"
    
    # 1. RLS 정책 수정
    if not fix_supabase_upload_issues():
        logger.error("❌ RLS 정책 수정 실패")
        return
    
    # 2. 모델 파일 업로드
    pt_upload_success = False
    onnx_upload_success = False
    
    if os.path.exists(best_model_path):
        pt_upload_success = upload_model_to_supabase(best_model_path, f"{training_name}/best.pt")
    
    if os.path.exists(onnx_model_path):
        onnx_upload_success = upload_model_to_supabase(onnx_model_path, f"{training_name}/best.onnx")
    
    # 3. 모델 레지스트리 업데이트
    model_registry_data = {
        'model_name': f'brickbox_yolo_{model_type}',
        'model_version': '1.0.0',
        'model_type': model_type,
        'model_path': f'{training_name}/best.onnx' if onnx_upload_success else None,
        'pt_model_path': f'{training_name}/best.pt' if pt_upload_success else None,
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
            'model_type': model_type,
            'created_at': datetime.now().isoformat()
        }
    }
    
    if update_model_registry(model_registry_data):
        logger.info("🎉 모든 업로드 작업 완료!")
    else:
        logger.error("❌ 모델 레지스트리 업데이트 실패")

if __name__ == "__main__":
    main()
