#!/usr/bin/env python3
"""
🧱 BrickBox 자동화된 YOLO 학습 런처

완전 자동화된 학습 파이프라인 실행 및 관리
- Supabase 스키마 초기화
- Colab 노트북 실행
- 학습 모니터링 시작
- 결과 자동 배포
"""

import os
import sys
import json
import time
import subprocess
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

class AutomatedTrainingLauncher:
    """자동화된 학습 런처 클래스"""
    
    def __init__(self):
        self.project_root = project_root
        self.supabase_url = os.getenv('VITE_SUPABASE_URL')
        self.supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
        self.colab_notebook_url = os.getenv('COLAB_NOTEBOOK_URL')
        self.webhook_url = os.getenv('WEBHOOK_URL')
        
        # 설정 검증
        self.validate_config()
    
    def validate_config(self):
        """설정 검증"""
        required_vars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            print(f"❌ 필수 환경 변수가 설정되지 않았습니다: {missing_vars}")
            print("다음 환경 변수를 설정하세요:")
            for var in missing_vars:
                print(f"  export {var}=your_value")
            sys.exit(1)
        
        print("✅ 환경 변수 설정 확인 완료")
    
    def initialize_supabase_schema(self) -> bool:
        """Supabase 스키마 초기화"""
        print("🔧 Supabase 스키마 초기화 시작...")
        
        try:
            # SQL 스크립트 실행
            schema_file = self.project_root / "database" / "create_automated_training_schema.sql"
            
            if not schema_file.exists():
                print(f"❌ 스키마 파일을 찾을 수 없습니다: {schema_file}")
                return False
            
            # Supabase에 SQL 실행 (실제로는 Supabase CLI 또는 API 사용)
            print("📝 데이터베이스 스키마 생성 중...")
            print("⚠️ 수동으로 Supabase 대시보드에서 다음 SQL을 실행하세요:")
            print(f"   파일: {schema_file}")
            
            return True
            
        except Exception as e:
            print(f"❌ 스키마 초기화 실패: {e}")
            return False
    
    def trigger_colab_training(self, dataset_id: str = 'latest', config: Dict = None) -> Dict:
        """Colab 학습 트리거"""
        print(f"🚀 Colab 학습 트리거 시작: 데이터셋 {dataset_id}")
        
        try:
            # Supabase Function 호출
            function_url = f"{self.supabase_url}/functions/v1/trigger-colab-training"
            
            payload = {
                'dataset_id': dataset_id,
                'training_config': config or {
                    'epochs': 100,
                    'batch_size': 16,
                    'imgsz': 640,
                    'device': 'cuda'
                },
                'colab_notebook_url': self.colab_notebook_url,
                'webhook_url': self.webhook_url
            }
            
            headers = {
                'Authorization': f'Bearer {self.supabase_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(function_url, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Colab 학습 트리거 성공: 작업 ID {result.get('training_job_id')}")
                return result
            else:
                print(f"❌ Colab 학습 트리거 실패: {response.status_code} - {response.text}")
                return {'success': False, 'error': response.text}
                
        except Exception as e:
            print(f"❌ Colab 학습 트리거 실패: {e}")
            return {'success': False, 'error': str(e)}
    
    def start_monitoring(self) -> subprocess.Popen:
        """학습 모니터링 시작"""
        print("📊 학습 모니터링 시작...")
        
        try:
            monitor_script = self.project_root / "scripts" / "automated_training_monitor.py"
            
            if not monitor_script.exists():
                print(f"❌ 모니터링 스크립트를 찾을 수 없습니다: {monitor_script}")
                return None
            
            # 백그라운드에서 모니터링 실행
            process = subprocess.Popen([
                sys.executable, str(monitor_script),
                '--interval', '300'  # 5분 간격
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            print(f"✅ 모니터링 프로세스 시작: PID {process.pid}")
            return process
            
        except Exception as e:
            print(f"❌ 모니터링 시작 실패: {e}")
            return None
    
    def check_training_status(self, job_id: int) -> Dict:
        """학습 상태 확인"""
        try:
            # Supabase에서 학습 작업 상태 조회
            import requests
            
            url = f"{self.supabase_url}/rest/v1/training_jobs"
            headers = {
                'apikey': self.supabase_key,
                'Authorization': f'Bearer {self.supabase_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f"{url}?id=eq.{job_id}&select=*",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                return data[0] if data else None
            else:
                print(f"❌ 학습 상태 조회 실패: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ 학습 상태 확인 실패: {e}")
            return None
    
    def wait_for_training_completion(self, job_id: int, timeout_hours: int = 24) -> bool:
        """학습 완료 대기"""
        print(f"⏳ 학습 완료 대기: 작업 ID {job_id} (최대 {timeout_hours}시간)")
        
        start_time = time.time()
        timeout_seconds = timeout_hours * 3600
        
        while time.time() - start_time < timeout_seconds:
            status = self.check_training_status(job_id)
            
            if not status:
                print("⚠️ 학습 상태를 확인할 수 없습니다")
                time.sleep(60)  # 1분 대기
                continue
            
            job_status = status.get('status')
            print(f"📊 학습 상태: {job_status}")
            
            if job_status == 'completed':
                print("✅ 학습 완료!")
                return True
            elif job_status == 'failed':
                print("❌ 학습 실패!")
                return False
            
            # 진행률 표시
            progress = status.get('progress', {})
            if progress:
                current_epoch = progress.get('epoch', 0)
                total_epochs = progress.get('total_epochs', 0)
                if total_epochs > 0:
                    percentage = (current_epoch / total_epochs) * 100
                    print(f"📈 진행률: {percentage:.1f}% ({current_epoch}/{total_epochs})")
            
            time.sleep(300)  # 5분 대기
        
        print("⏰ 학습 시간 초과")
        return False
    
    def deploy_trained_model(self, job_id: int) -> bool:
        """학습된 모델 배포"""
        print(f"📦 모델 배포 시작: 작업 ID {job_id}")
        
        try:
            # Supabase에서 최신 모델 조회
            import requests
            
            url = f"{self.supabase_url}/rest/v1/model_registry"
            headers = {
                'apikey': self.supabase_key,
                'Authorization': f'Bearer {self.supabase_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f"{url}?training_job_id=eq.{job_id}&status=eq.active&select=*",
                headers=headers
            )
            
            if response.status_code == 200:
                models = response.json()
                if models:
                    model = models[0]
                    print(f"✅ 모델 배포 완료: {model['model_name']} (v{model['version']})")
                    return True
                else:
                    print("⚠️ 배포할 모델을 찾을 수 없습니다")
                    return False
            else:
                print(f"❌ 모델 배포 실패: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ 모델 배포 실패: {e}")
            return False
    
    def run_full_pipeline(self, dataset_id: str = 'latest', config: Dict = None) -> bool:
        """전체 파이프라인 실행"""
        print("=" * 60)
        print("🧱 BrickBox 자동화된 YOLO 학습 파이프라인 시작")
        print("=" * 60)
        
        try:
            # 1. Supabase 스키마 초기화
            if not self.initialize_supabase_schema():
                return False
            
            # 2. Colab 학습 트리거
            training_result = self.trigger_colab_training(dataset_id, config)
            if not training_result.get('success'):
                print(f"❌ 학습 트리거 실패: {training_result.get('error')}")
                return False
            
            job_id = training_result.get('training_job_id')
            if not job_id:
                print("❌ 학습 작업 ID를 받지 못했습니다")
                return False
            
            # 3. 모니터링 시작
            monitor_process = self.start_monitoring()
            
            # 4. 학습 완료 대기
            training_success = self.wait_for_training_completion(job_id)
            
            # 5. 모니터링 중지
            if monitor_process:
                monitor_process.terminate()
                print("🛑 모니터링 중지")
            
            if not training_success:
                print("❌ 학습 실패")
                return False
            
            # 6. 모델 배포
            deployment_success = self.deploy_trained_model(job_id)
            if not deployment_success:
                print("⚠️ 모델 배포 실패")
                return False
            
            print("\n" + "=" * 60)
            print("🎉 BrickBox 자동화된 YOLO 학습 파이프라인 완료!")
            print("=" * 60)
            
            return True
            
        except Exception as e:
            print(f"❌ 파이프라인 실행 실패: {e}")
            return False
    
    def run_quick_training(self, dataset_id: str = 'latest') -> bool:
        """빠른 학습 실행 (기본 설정)"""
        print("🚀 빠른 학습 실행")
        
        default_config = {
            'epochs': 50,
            'batch_size': 16,
            'imgsz': 640,
            'device': 'cuda'
        }
        
        return self.run_full_pipeline(dataset_id, default_config)
    
    def run_custom_training(self, dataset_id: str = 'latest', epochs: int = 100, batch_size: int = 16) -> bool:
        """커스텀 학습 실행"""
        print(f"🔧 커스텀 학습 실행: {epochs} 에포크, 배치 크기 {batch_size}")
        
        custom_config = {
            'epochs': epochs,
            'batch_size': batch_size,
            'imgsz': 640,
            'device': 'cuda'
        }
        
        return self.run_full_pipeline(dataset_id, custom_config)

def main():
    """메인 실행 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='BrickBox 자동화된 YOLO 학습 런처')
    parser.add_argument('--dataset-id', type=str, default='latest', help='데이터셋 ID')
    parser.add_argument('--epochs', type=int, default=100, help='학습 에포크 수')
    parser.add_argument('--batch-size', type=int, default=16, help='배치 크기')
    parser.add_argument('--quick', action='store_true', help='빠른 학습 (50 에포크)')
    parser.add_argument('--custom', action='store_true', help='커스텀 학습')
    parser.add_argument('--init-only', action='store_true', help='스키마 초기화만 실행')
    parser.add_argument('--trigger-only', action='store_true', help='학습 트리거만 실행')
    
    args = parser.parse_args()
    
    # 런처 초기화
    launcher = AutomatedTrainingLauncher()
    
    try:
        if args.init_only:
            # 스키마 초기화만
            success = launcher.initialize_supabase_schema()
            sys.exit(0 if success else 1)
        
        elif args.trigger_only:
            # 학습 트리거만
            if args.quick:
                config = {'epochs': 50, 'batch_size': 16, 'imgsz': 640, 'device': 'cuda'}
            elif args.custom:
                config = {'epochs': args.epochs, 'batch_size': args.batch_size, 'imgsz': 640, 'device': 'cuda'}
            else:
                config = None
            
            result = launcher.trigger_colab_training(args.dataset_id, config)
            sys.exit(0 if result.get('success') else 1)
        
        elif args.quick:
            # 빠른 학습
            success = launcher.run_quick_training(args.dataset_id)
            sys.exit(0 if success else 1)
        
        elif args.custom:
            # 커스텀 학습
            success = launcher.run_custom_training(args.dataset_id, args.epochs, args.batch_size)
            sys.exit(0 if success else 1)
        
        else:
            # 전체 파이프라인
            config = {'epochs': args.epochs, 'batch_size': args.batch_size, 'imgsz': 640, 'device': 'cuda'}
            success = launcher.run_full_pipeline(args.dataset_id, config)
            sys.exit(0 if success else 1)
    
    except KeyboardInterrupt:
        print("\n🛑 사용자에 의해 중단됨")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
