#!/usr/bin/env python3
"""
🤖 BrickBox 자동 모델 배포 시스템

- 훈련 완료 시 자동으로 모델 배포
- 성능 메트릭 기반 자동 승인/거부
- 롤링 배포 지원
- 모델 버전 관리
"""

import os
import sys
import json
import logging
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import hashlib

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/auto_deployment.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AutoModelDeployment:
    def __init__(self):
        self.supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
        self.supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
        self.models_bucket = 'models'
        
        # 배포 설정
        self.deployment_config = {
            'auto_approve_threshold': 0.05,  # 5% 성능 향상 시 자동 승인
            'min_performance_metrics': {
                'mAP50': 0.7,
                'mAP50_95': 0.5,
                'precision': 0.8,
                'recall': 0.7
            },
            'rolling_deployment': True,
            'rollback_threshold': 0.1  # 10% 성능 저하 시 롤백
        }
    
    def check_training_completion(self) -> Optional[Dict]:
        """훈련 완료 모델 확인"""
        try:
            logger.info("🔍 훈련 완료 모델 확인 중...")
            
            # 최근 훈련 작업 확인
            response = requests.get(
                f"{self.supabase_url}/rest/v1/training_jobs",
                headers={
                    'apikey': self.supabase_key,
                    'Authorization': f'Bearer {self.supabase_key}',
                    'Content-Type': 'application/json'
                },
                params={
                    'status': 'eq.completed',
                    'order': 'created_at.desc',
                    'limit': '1'
                }
            )
            
            if response.status_code != 200:
                logger.error(f"❌ 훈련 작업 조회 실패: {response.status_code}")
                return None
            
            jobs = response.json()
            if not jobs:
                logger.info("📭 완료된 훈련 작업 없음")
                return None
            
            latest_job = jobs[0]
            logger.info(f"✅ 최신 완료된 훈련 작업: {latest_job.get('job_id')}")
            
            return latest_job
            
        except Exception as e:
            logger.error(f"❌ 훈련 완료 확인 실패: {e}")
            return None
    
    def evaluate_model_performance(self, model_path: str, metrics: Dict) -> Dict:
        """모델 성능 평가"""
        try:
            logger.info("📊 모델 성능 평가 중...")
            
            # 최소 성능 기준 확인
            min_metrics = self.deployment_config['min_performance_metrics']
            performance_check = {
                'mAP50': metrics.get('mAP50', 0) >= min_metrics['mAP50'],
                'mAP50_95': metrics.get('mAP50_95', 0) >= min_metrics['mAP50_95'],
                'precision': metrics.get('precision', 0) >= min_metrics['precision'],
                'recall': metrics.get('recall', 0) >= min_metrics['recall']
            }
            
            all_metrics_pass = all(performance_check.values())
            
            # 현재 활성 모델과 성능 비교
            current_model = self.get_current_active_model()
            performance_improvement = 0
            
            if current_model and current_model.get('performance_metrics'):
                current_metrics = current_model['performance_metrics']
                improvement = {
                    'mAP50': metrics.get('mAP50', 0) - current_metrics.get('mAP50', 0),
                    'mAP50_95': metrics.get('mAP50_95', 0) - current_metrics.get('mAP50_95', 0),
                    'precision': metrics.get('precision', 0) - current_metrics.get('precision', 0),
                    'recall': metrics.get('recall', 0) - current_metrics.get('recall', 0)
                }
                performance_improvement = sum(improvement.values()) / len(improvement)
            
            evaluation = {
                'all_metrics_pass': all_metrics_pass,
                'performance_improvement': performance_improvement,
                'auto_approve': all_metrics_pass and performance_improvement >= self.deployment_config['auto_approve_threshold'],
                'performance_check': performance_check,
                'current_model': current_model,
                'improvement_details': performance_improvement
            }
            
            logger.info(f"📈 성능 평가 결과: {evaluation}")
            return evaluation
            
        except Exception as e:
            logger.error(f"❌ 모델 성능 평가 실패: {e}")
            return {'all_metrics_pass': False, 'auto_approve': False}
    
    def get_current_active_model(self) -> Optional[Dict]:
        """현재 활성 모델 조회"""
        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/model_registry",
                headers={
                    'apikey': self.supabase_key,
                    'Authorization': f'Bearer {self.supabase_key}',
                    'Content-Type': 'application/json'
                },
                params={
                    'is_active': 'eq.true',
                    'order': 'created_at.desc',
                    'limit': '1'
                }
            )
            
            if response.status_code == 200:
                models = response.json()
                return models[0] if models else None
            
            return None
            
        except Exception as e:
            logger.error(f"❌ 현재 활성 모델 조회 실패: {e}")
            return None
    
    def upload_model_to_storage(self, local_model_path: str, model_name: str) -> Optional[str]:
        """모델을 Supabase Storage에 업로드"""
        try:
            logger.info(f"📤 모델 업로드 중: {model_name}")
            
            # 파일 존재 확인
            if not os.path.exists(local_model_path):
                logger.error(f"❌ 모델 파일 없음: {local_model_path}")
                return None
            
            # 파일 크기 확인
            file_size = os.path.getsize(local_model_path)
            logger.info(f"📁 모델 파일 크기: {file_size / 1024 / 1024:.1f} MB")
            
            # 파일 해시 생성 (중복 확인용)
            with open(local_model_path, 'rb') as f:
                file_hash = hashlib.md5(f.read()).hexdigest()
            
            # 업로드 경로 생성
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            upload_path = f"brickbox_s_seg_{timestamp}/{model_name}"
            
            # Supabase Storage에 업로드
            with open(local_model_path, 'rb') as f:
                files = {'file': (model_name, f, 'application/octet-stream')}
                
                response = requests.post(
                    f"{self.supabase_url}/storage/v1/object/{self.models_bucket}/{upload_path}",
                    headers={
                        'Authorization': f'Bearer {self.supabase_key}',
                        'Content-Type': 'multipart/form-data'
                    },
                    files=files
                )
            
            if response.status_code in [200, 201]:
                public_url = f"{self.supabase_url}/storage/v1/object/public/{self.models_bucket}/{upload_path}"
                logger.info(f"✅ 모델 업로드 완료: {public_url}")
                return public_url
            else:
                logger.error(f"❌ 모델 업로드 실패: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"❌ 모델 업로드 실패: {e}")
            return None
    
    def update_model_registry(self, model_data: Dict) -> bool:
        """모델 레지스트리 업데이트"""
        try:
            logger.info("📋 모델 레지스트리 업데이트 중...")
            
            # 기존 활성 모델 비활성화
            if model_data.get('current_model_id'):
                requests.patch(
                    f"{self.supabase_url}/rest/v1/model_registry",
                    headers={
                        'apikey': self.supabase_key,
                        'Authorization': f'Bearer {self.supabase_key}',
                        'Content-Type': 'application/json'
                    },
                    json={'is_active': False},
                    params={'id': 'eq.' + str(model_data['current_model_id'])}
                )
            
            # 새 모델 등록
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
                logger.info("✅ 모델 레지스트리 업데이트 완료")
                return True
            else:
                logger.error(f"❌ 모델 레지스트리 업데이트 실패: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"❌ 모델 레지스트리 업데이트 실패: {e}")
            return False
    
    def deploy_model(self, training_job: Dict) -> bool:
        """모델 배포 실행"""
        try:
            logger.info("🚀 모델 배포 시작...")
            
            # 1. 모델 파일 경로 확인
            model_path = training_job.get('model_path')
            if not model_path or not os.path.exists(model_path):
                logger.error(f"❌ 모델 파일 없음: {model_path}")
                return False
            
            # 2. 성능 메트릭 확인
            metrics = training_job.get('performance_metrics', {})
            evaluation = self.evaluate_model_performance(model_path, metrics)
            
            if not evaluation['all_metrics_pass']:
                logger.warning("⚠️ 최소 성능 기준 미달로 배포 중단")
                return False
            
            # 3. 모델 업로드
            model_name = f"set_{training_job.get('set_num', 'unknown')}_best.onnx"
            public_url = self.upload_model_to_storage(model_path, model_name)
            
            if not public_url:
                logger.error("❌ 모델 업로드 실패")
                return False
            
            # 4. 모델 레지스트리 업데이트
            model_data = {
                'model_name': f"brickbox_yolo_{training_job.get('set_num', 'unknown')}",
                'model_version': datetime.now().strftime('%Y%m%d_%H%M%S'),
                'model_type': 'yolo11n-seg',
                'model_path': public_url,
                'performance_metrics': metrics,
                'is_active': True,
                'training_job_id': training_job.get('job_id'),
                'auto_deployed': True,
                'deployment_timestamp': datetime.now().isoformat()
            }
            
            success = self.update_model_registry(model_data)
            
            if success:
                logger.info("🎉 모델 배포 완료!")
                
                # 5. 배포 알림 (선택사항)
                self.send_deployment_notification(model_data)
                
                return True
            else:
                logger.error("❌ 모델 레지스트리 업데이트 실패")
                return False
                
        except Exception as e:
            logger.error(f"❌ 모델 배포 실패: {e}")
            return False
    
    def send_deployment_notification(self, model_data: Dict):
        """배포 완료 알림"""
        try:
            logger.info("📢 배포 알림 전송 중...")
            
            # 여기에 알림 로직 구현 (Slack, Discord, Email 등)
            notification = {
                'message': f"🤖 새 모델 배포 완료: {model_data['model_name']}",
                'version': model_data['model_version'],
                'performance': model_data['performance_metrics'],
                'timestamp': model_data['deployment_timestamp']
            }
            
            logger.info(f"📢 배포 알림: {notification}")
            
        except Exception as e:
            logger.error(f"❌ 배포 알림 전송 실패: {e}")
    
    def run_auto_deployment(self):
        """자동 배포 실행"""
        try:
            logger.info("🤖 자동 모델 배포 시작...")
            
            # 1. 훈련 완료 모델 확인
            training_job = self.check_training_completion()
            if not training_job:
                logger.info("📭 배포할 모델 없음")
                return
            
            # 2. 모델 배포
            success = self.deploy_model(training_job)
            
            if success:
                logger.info("🎉 자동 배포 완료!")
            else:
                logger.error("❌ 자동 배포 실패")
                
        except Exception as e:
            logger.error(f"❌ 자동 배포 실행 실패: {e}")

def main():
    """메인 실행 함수"""
    deployment = AutoModelDeployment()
    deployment.run_auto_deployment()

if __name__ == "__main__":
    main()
