#!/usr/bin/env python3
"""
자동 모델 배포 시스템
성능 개선 시 모델을 자동으로 배포하는 시스템
"""

import os
import sys
import json
import logging
import shutil
from pathlib import Path
from datetime import datetime
import argparse

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/auto_deployment.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class AutoDeployment:
    def __init__(self, config_path=None):
        self.config_path = config_path or 'config/auto_deployment.json'
        self.load_config()
        
    def load_config(self):
        """설정 파일 로드"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self.config = json.load(f)
            else:
                self.config = self.get_default_config()
                self.save_config()
        except Exception as e:
            logger.error(f"설정 파일 로드 실패: {e}")
            self.config = self.get_default_config()
    
    def get_default_config(self):
        """기본 설정 반환"""
        return {
            "current_model_path": "models/current_model.pt",
            "backup_dir": "models/backup",
            "deployment_dir": "models/deployed",
            "min_improvement": 0.005,
            "min_mAP50": 0.5,
            "backup_previous": True,
            "create_version": True,
            "notify_deployment": True,
            "deployment_checks": [
                "model_exists",
                "performance_improvement",
                "minimum_performance"
            ]
        }
    
    def save_config(self):
        """설정 파일 저장"""
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def check_deployment_prerequisites(self, new_model_path, new_metrics):
        """배포 전제 조건 확인"""
        logger.info("배포 전제 조건 확인 중...")
        
        checks = []
        
        # 1. 모델 파일 존재 확인
        if not os.path.exists(new_model_path):
            checks.append({"check": "model_exists", "passed": False, "message": f"새 모델 파일을 찾을 수 없습니다: {new_model_path}"})
        else:
            checks.append({"check": "model_exists", "passed": True, "message": "모델 파일 존재 확인"})
        
        # 2. 성능 개선 확인
        current_metrics = self.get_current_model_metrics()
        if current_metrics:
            improvement = new_metrics.get('mAP50', 0) - current_metrics.get('mAP50', 0)
            if improvement >= self.config['min_improvement']:
                checks.append({"check": "performance_improvement", "passed": True, "message": f"성능 개선 확인: +{improvement:.4f}"})
            else:
                checks.append({"check": "performance_improvement", "passed": False, "message": f"성능 개선 부족: +{improvement:.4f} < {self.config['min_improvement']}"})
        else:
            checks.append({"check": "performance_improvement", "passed": True, "message": "현재 모델 메트릭 없음, 첫 배포"})
        
        # 3. 최소 성능 기준 확인
        mAP50 = new_metrics.get('mAP50', 0)
        if mAP50 >= self.config['min_mAP50']:
            checks.append({"check": "minimum_performance", "passed": True, "message": f"최소 성능 기준 충족: mAP50={mAP50:.4f}"})
        else:
            checks.append({"check": "minimum_performance", "passed": False, "message": f"최소 성능 기준 미달: mAP50={mAP50:.4f} < {self.config['min_mAP50']}"})
        
        # 전체 결과 확인
        all_passed = all(check['passed'] for check in checks)
        
        logger.info(f"배포 전제 조건 확인 완료: {'통과' if all_passed else '실패'}")
        for check in checks:
            status = "✓" if check['passed'] else "✗"
            logger.info(f"  {status} {check['check']}: {check['message']}")
        
        return all_passed, checks
    
    def get_current_model_metrics(self):
        """현재 모델 메트릭 조회"""
        try:
            metrics_file = "models/current_metrics.json"
            if os.path.exists(metrics_file):
                with open(metrics_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"현재 모델 메트릭 조회 실패: {e}")
        return None
    
    def backup_current_model(self):
        """현재 모델 백업"""
        if not self.config['backup_previous']:
            return None
        
        logger.info("현재 모델 백업 중...")
        
        # 백업 디렉토리 생성
        backup_dir = self.config['backup_dir']
        os.makedirs(backup_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(backup_dir, f"model_backup_{timestamp}")
        os.makedirs(backup_path, exist_ok=True)
        
        # 현재 모델 백업
        current_model = self.config['current_model_path']
        if os.path.exists(current_model):
            backup_model_path = os.path.join(backup_path, "model.pt")
            shutil.copy2(current_model, backup_model_path)
            logger.info(f"모델 백업: {backup_model_path}")
        
        # 현재 메트릭 백업
        current_metrics = "models/current_metrics.json"
        if os.path.exists(current_metrics):
            backup_metrics_path = os.path.join(backup_path, "metrics.json")
            shutil.copy2(current_metrics, backup_metrics_path)
            logger.info(f"메트릭 백업: {backup_metrics_path}")
        
        # 배포 로그 백업
        deployment_log = "models/deployment_log.json"
        if os.path.exists(deployment_log):
            backup_log_path = os.path.join(backup_path, "deployment_log.json")
            shutil.copy2(deployment_log, backup_log_path)
            logger.info(f"배포 로그 백업: {backup_log_path}")
        
        return backup_path
    
    def deploy_new_model(self, new_model_path, new_metrics):
        """새 모델 배포"""
        logger.info("새 모델 배포 중...")
        
        # 배포 디렉토리 생성
        deployment_dir = self.config['deployment_dir']
        os.makedirs(deployment_dir, exist_ok=True)
        
        # 새 모델을 현재 모델로 복사
        current_model_path = self.config['current_model_path']
        shutil.copy2(new_model_path, current_model_path)
        logger.info(f"새 모델 배포: {current_model_path}")
        
        # 메트릭 저장
        metrics_file = "models/current_metrics.json"
        with open(metrics_file, 'w', encoding='utf-8') as f:
            json.dump(new_metrics, f, indent=2, ensure_ascii=False)
        logger.info(f"메트릭 저장: {metrics_file}")
        
        # 배포 로그 업데이트
        self.update_deployment_log(new_model_path, new_metrics)
        
        return current_model_path
    
    def update_deployment_log(self, model_path, metrics):
        """배포 로그 업데이트"""
        logger.info("배포 로그 업데이트 중...")
        
        deployment_log = {
            "timestamp": datetime.now().isoformat(),
            "model_path": model_path,
            "metrics": metrics,
            "deployment_type": "auto"
        }
        
        log_file = "models/deployment_log.json"
        deployments = []
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                deployments = json.load(f)
        
        deployments.append(deployment_log)
        
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(deployments, f, indent=2, ensure_ascii=False)
        
        logger.info(f"배포 로그 업데이트: {log_file}")
    
    def create_model_version(self, model_path, metrics):
        """모델 버전 생성"""
        if not self.config['create_version']:
            return None
        
        logger.info("모델 버전 생성 중...")
        
        # 버전 디렉토리 생성
        version_dir = f"models/versions/v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        os.makedirs(version_dir, exist_ok=True)
        
        # 모델 복사
        version_model_path = os.path.join(version_dir, "model.pt")
        shutil.copy2(model_path, version_model_path)
        
        # 메트릭 저장
        version_metrics_path = os.path.join(version_dir, "metrics.json")
        with open(version_metrics_path, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
        
        # 버전 정보 저장
        version_info = {
            "version": datetime.now().strftime('%Y%m%d_%H%M%S'),
            "timestamp": datetime.now().isoformat(),
            "model_path": version_model_path,
            "metrics": metrics
        }
        
        version_info_path = os.path.join(version_dir, "version_info.json")
        with open(version_info_path, 'w', encoding='utf-8') as f:
            json.dump(version_info, f, indent=2, ensure_ascii=False)
        
        logger.info(f"모델 버전 생성: {version_dir}")
        return version_dir
    
    def notify_deployment(self, model_path, metrics, backup_path):
        """배포 알림"""
        if not self.config['notify_deployment']:
            return
        
        logger.info("배포 알림 전송 중...")
        
        # 알림 메시지 구성
        message = f"""
모델 자동 배포 완료

새 모델: {model_path}
성능 메트릭:
- mAP50: {metrics.get('mAP50', 0):.4f}
- Precision: {metrics.get('precision', 0):.4f}
- Recall: {metrics.get('recall', 0):.4f}
- F1: {metrics.get('f1', 0):.4f}

백업 위치: {backup_path}
배포 시간: {datetime.now().isoformat()}
        """
        
        # 알림 로그 저장
        notification_log = {
            "timestamp": datetime.now().isoformat(),
            "type": "deployment",
            "message": message,
            "model_path": model_path,
            "metrics": metrics
        }
        
        notification_file = "logs/deployment_notifications.json"
        notifications = []
        if os.path.exists(notification_file):
            with open(notification_file, 'r', encoding='utf-8') as f:
                notifications = json.load(f)
        
        notifications.append(notification_log)
        
        with open(notification_file, 'w', encoding='utf-8') as f:
            json.dump(notifications, f, indent=2, ensure_ascii=False)
        
        logger.info("배포 알림 저장 완료")
    
    def deploy_model(self, new_model_path, new_metrics):
        """모델 배포 실행"""
        try:
            logger.info(f"모델 배포 시작: {new_model_path}")
            
            # 1. 배포 전제 조건 확인
            can_deploy, checks = self.check_deployment_prerequisites(new_model_path, new_metrics)
            if not can_deploy:
                logger.warning("배포 전제 조건 미충족, 배포 중단")
                return {
                    "status": "failed",
                    "reason": "prerequisites_not_met",
                    "checks": checks
                }
            
            # 2. 현재 모델 백업
            backup_path = self.backup_current_model()
            
            # 3. 새 모델 배포
            deployed_model_path = self.deploy_new_model(new_model_path, new_metrics)
            
            # 4. 모델 버전 생성
            version_path = self.create_model_version(new_model_path, new_metrics)
            
            # 5. 배포 알림
            self.notify_deployment(deployed_model_path, new_metrics, backup_path)
            
            logger.info("모델 배포 완료")
            return {
                "status": "success",
                "deployed_model_path": deployed_model_path,
                "backup_path": backup_path,
                "version_path": version_path,
                "metrics": new_metrics,
                "checks": checks
            }
            
        except Exception as e:
            logger.error(f"모델 배포 실패: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }

def main():
    parser = argparse.ArgumentParser(description='자동 모델 배포')
    parser.add_argument('--model', required=True, help='배포할 모델 파일 경로')
    parser.add_argument('--metrics', required=True, help='모델 메트릭 JSON 파일 경로')
    parser.add_argument('--config', help='설정 파일 경로')
    
    args = parser.parse_args()
    
    # 로그 디렉토리 생성
    os.makedirs('logs', exist_ok=True)
    
    # 메트릭 로드
    try:
        with open(args.metrics, 'r', encoding='utf-8') as f:
            metrics = json.load(f)
    except Exception as e:
        logger.error(f"메트릭 파일 로드 실패: {e}")
        sys.exit(1)
    
    # 자동 배포 실행
    deployment = AutoDeployment(args.config)
    result = deployment.deploy_model(args.model, metrics)
    
    # 결과 출력
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 성공/실패에 따른 종료 코드
    sys.exit(0 if result['status'] == 'success' else 1)

if __name__ == "__main__":
    main()


