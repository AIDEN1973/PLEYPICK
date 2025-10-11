#!/usr/bin/env python3
"""
🤖 BrickBox 로컬 PC 자동 모델 배포 시스템

- 로컬 훈련 완료 시 자동으로 모델 배포
- 성능 메트릭 기반 자동 승인/거부
- Supabase Storage 자동 업로드
- 모델 레지스트리 자동 업데이트
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
import glob

# 로깅 설정
os.makedirs('logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/local_auto_deployment.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class LocalAutoModelDeployment:
    def __init__(self):
        # 환경 변수 로드
        self.load_env_vars()
        
        self.models_bucket = 'models'
        
        # 로컬 모델 경로 설정
        self.local_model_paths = {
            'best_onnx': 'runs/detect/train/best.onnx',
            'best_pt': 'runs/detect/train/best.pt',
            'last_pt': 'runs/detect/train/last.pt'
        }
        
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
    
    def load_env_vars(self):
        """환경 변수 로드"""
        try:
            with open('.env', 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key] = value
        except FileNotFoundError:
            logger.warning("⚠️ .env 파일을 찾을 수 없습니다.")
        
        self.supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
        self.supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
        
        if not self.supabase_key:
            logger.error("❌ VITE_SUPABASE_SERVICE_ROLE 환경 변수가 설정되지 않았습니다.")
            sys.exit(1)
    
    def find_latest_training_results(self) -> Optional[Dict]:
        """최신 훈련 결과 찾기"""
        try:
            logger.info("🔍 최신 훈련 결과 확인 중...")
            
            # runs/detect/train 폴더에서 최신 결과 찾기
            train_dirs = glob.glob('runs/detect/train*')
            if not train_dirs:
                logger.info("📭 훈련 결과 폴더 없음")
                return None
            
            # 가장 최근 폴더 선택
            latest_dir = max(train_dirs, key=os.path.getctime)
            logger.info(f"📁 최신 훈련 폴더: {latest_dir}")
            
            # 모델 파일 확인
            model_files = {
                'best_onnx': os.path.join(latest_dir, 'best.onnx'),
                'best_pt': os.path.join(latest_dir, 'best.pt'),
                'last_pt': os.path.join(latest_dir, 'last.pt')
            }
            
            existing_files = {k: v for k, v in model_files.items() if os.path.exists(v)}
            
            if not existing_files:
                logger.warning("⚠️ 모델 파일을 찾을 수 없습니다.")
                return None
            
            # results.csv에서 성능 메트릭 읽기
            results_csv = os.path.join(latest_dir, 'results.csv')
            performance_metrics = self.parse_results_csv(results_csv)
            
            # 훈련 정보 수집
            training_info = {
                'training_dir': latest_dir,
                'model_files': existing_files,
                'performance_metrics': performance_metrics,
                'created_at': datetime.fromtimestamp(os.path.getctime(latest_dir)).isoformat(),
                'training_name': os.path.basename(latest_dir)
            }
            
            logger.info(f"✅ 훈련 결과 발견: {training_info['training_name']}")
            logger.info(f"📊 성능 메트릭: {performance_metrics}")
            
            return training_info
            
        except Exception as e:
            logger.error(f"❌ 훈련 결과 확인 실패: {e}")
            return None
    
    def parse_results_csv(self, results_csv: str) -> Dict:
        """results.csv에서 성능 메트릭 파싱"""
        try:
            if not os.path.exists(results_csv):
                logger.warning(f"⚠️ results.csv 없음: {results_csv}")
                return {}
            
            import pandas as pd
            
            # CSV 파일 읽기
            df = pd.read_csv(results_csv)
            
            # 마지막 행의 메트릭 사용
            last_row = df.iloc[-1]
            
            metrics = {
                'mAP50': last_row.get('metrics/mAP50(B)', 0.0),
                'mAP50_95': last_row.get('metrics/mAP50-95(B)', 0.0),
                'precision': last_row.get('metrics/precision(B)', 0.0),
                'recall': last_row.get('metrics/recall(B)', 0.0)
            }
            
            logger.info(f"📈 파싱된 메트릭: {metrics}")
            return metrics
            
        except Exception as e:
            logger.error(f"❌ results.csv 파싱 실패: {e}")
            return {}
    
    def evaluate_model_performance(self, metrics: Dict) -> Dict:
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
    
    def deploy_model(self, training_info: Dict) -> bool:
        """모델 배포 실행"""
        try:
            logger.info("🚀 모델 배포 시작...")
            
            # 1. 성능 메트릭 확인
            metrics = training_info.get('performance_metrics', {})
            evaluation = self.evaluate_model_performance(metrics)
            
            if not evaluation['all_metrics_pass']:
                logger.warning("⚠️ 최소 성능 기준 미달로 배포 중단")
                logger.warning(f"   성능 체크: {evaluation['performance_check']}")
                return False
            
            # 2. ONNX 모델 업로드 (우선순위)
            onnx_path = training_info['model_files'].get('best_onnx')
            if not onnx_path:
                logger.error("❌ ONNX 모델 파일 없음")
                return False
            
            model_name = f"set_76917-1_best.onnx"
            public_url = self.upload_model_to_storage(onnx_path, model_name)
            
            if not public_url:
                logger.error("❌ ONNX 모델 업로드 실패")
                return False
            
            # 3. PyTorch 모델도 업로드 (백업용)
            pt_path = training_info['model_files'].get('best_pt')
            if pt_path:
                pt_model_name = f"set_76917-1_best.pt"
                pt_public_url = self.upload_model_to_storage(pt_path, pt_model_name)
                if pt_public_url:
                    logger.info(f"✅ PyTorch 모델도 업로드 완료: {pt_public_url}")
            
            # 4. 모델 레지스트리 업데이트
            model_data = {
                'model_name': f"brickbox_yolo_local_{training_info['training_name']}",
                'model_version': datetime.now().strftime('%Y%m%d_%H%M%S'),
                'model_type': 'yolo11n-seg',
                'model_path': public_url,
                'performance_metrics': metrics,
                'is_active': True,
                'training_job_id': training_info['training_name'],
                'auto_deployed': True,
                'deployment_timestamp': datetime.now().isoformat(),
                'deployment_source': 'local_pc'
            }
            
            success = self.update_model_registry(model_data)
            
            if success:
                logger.info("🎉 로컬 모델 배포 완료!")
                
                # 5. 배포 알림
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
            
            notification = {
                'message': f"🤖 로컬 PC에서 새 모델 배포 완료: {model_data['model_name']}",
                'version': model_data['model_version'],
                'performance': model_data['performance_metrics'],
                'timestamp': model_data['deployment_timestamp'],
                'source': 'local_pc'
            }
            
            logger.info(f"📢 배포 알림: {notification}")
            
        except Exception as e:
            logger.error(f"❌ 배포 알림 전송 실패: {e}")
    
    def run_auto_deployment(self):
        """자동 배포 실행"""
        try:
            logger.info("🤖 로컬 PC 자동 모델 배포 시작...")
            
            # 1. 최신 훈련 결과 확인
            training_info = self.find_latest_training_results()
            if not training_info:
                logger.info("📭 배포할 훈련 결과 없음")
                return
            
            # 2. 모델 배포
            success = self.deploy_model(training_info)
            
            if success:
                logger.info("🎉 로컬 PC 자동 배포 완료!")
            else:
                logger.error("❌ 로컬 PC 자동 배포 실패")
                
        except Exception as e:
            logger.error(f"❌ 자동 배포 실행 실패: {e}")

def main():
    """메인 실행 함수"""
    deployment = LocalAutoModelDeployment()
    deployment.run_auto_deployment()

if __name__ == "__main__":
    main()
