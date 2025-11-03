#!/usr/bin/env python3
"""
증분 학습 파이프라인
새로운 데이터만으로 모델을 업데이트하는 시스템
"""

import os
import sys
import json
import logging
import subprocess
from pathlib import Path
from datetime import datetime
import argparse

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/incremental_learning.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class IncrementalLearningPipeline:
    def __init__(self, config_path=None):
        self.config_path = config_path or 'config/incremental_learning.json'
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
            "model_path": "models/current_model.pt",
            "new_data_path": "output/synthetic/dataset_synthetic",
            "output_path": "models/incremental",
            "epochs": 100,
            "batch_size": 16,
            "learning_rate": 0.001,
            "device": "cuda",
            "imgsz": 640,
            "patience": 10,
            "save_period": 10,
            "validation_split": 0.2,
            "min_improvement": 0.001
        }
    
    def save_config(self):
        """설정 파일 저장"""
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def check_prerequisites(self):
        """전제 조건 확인"""
        logger.info("전제 조건 확인 중...")
        
        # 현재 모델 존재 확인
        if not os.path.exists(self.config['model_path']):
            raise FileNotFoundError(f"현재 모델을 찾을 수 없습니다: {self.config['model_path']}")
        
        # 새 데이터 존재 확인
        if not os.path.exists(self.config['new_data_path']):
            raise FileNotFoundError(f"새 데이터를 찾을 수 없습니다: {self.config['new_data_path']}")
        
        # YOLO 학습 스크립트 존재 확인
        yolo_script = "scripts/train_yolo_incremental.py"
        if not os.path.exists(yolo_script):
            raise FileNotFoundError(f"YOLO 학습 스크립트를 찾을 수 없습니다: {yolo_script}")
        
        logger.info("전제 조건 확인 완료")
        return True
    
    def prepare_incremental_data(self):
        """증분 학습용 데이터 준비"""
        logger.info("증분 학습용 데이터 준비 중...")
        
        # 새 데이터에서 기존 모델로 검증되지 않은 데이터만 추출
        validation_script = "scripts/validate_new_data.py"
        if os.path.exists(validation_script):
            try:
                result = subprocess.run([
                    sys.executable, validation_script,
                    "--model_path", self.config['model_path'],
                    "--data_path", self.config['new_data_path'],
                    "--output_path", "temp/incremental_data"
                ], capture_output=True, text=True, check=True)
                
                logger.info("새 데이터 검증 완료")
                return "temp/incremental_data"
            except subprocess.CalledProcessError as e:
                logger.warning(f"새 데이터 검증 실패, 전체 데이터 사용: {e}")
        
        # 검증 스크립트가 없으면 전체 새 데이터 사용
        return self.config['new_data_path']
    
    def run_incremental_training(self, data_path):
        """증분 학습 실행"""
        logger.info("증분 학습 시작...")
        
        # 출력 디렉토리 생성
        os.makedirs(self.config['output_path'], exist_ok=True)
        
        # YOLO 증분 학습 명령어 구성
        cmd = [
            sys.executable, "scripts/train_yolo_incremental.py",
            "--model", self.config['model_path'],
            "--data", data_path,
            "--epochs", str(self.config['epochs']),
            "--batch", str(self.config['batch_size']),
            "--lr", str(self.config['learning_rate']),
            "--device", self.config['device'],
            "--imgsz", str(self.config['imgsz']),
            "--patience", str(self.config['patience']),
            "--save-period", str(self.config['save_period']),
            "--project", self.config['output_path'],
            "--name", f"incremental_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        ]
        
        logger.info(f"학습 명령어: {' '.join(cmd)}")
        
        try:
            # 학습 실행
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            logger.info("증분 학습 완료")
            return result.stdout
        except subprocess.CalledProcessError as e:
            logger.error(f"증분 학습 실패: {e}")
            logger.error(f"오류 출력: {e.stderr}")
            raise
    
    def evaluate_model(self, model_path):
        """모델 성능 평가"""
        logger.info("모델 성능 평가 중...")
        
        evaluation_script = "scripts/evaluate_model.py"
        if os.path.exists(evaluation_script):
            try:
                result = subprocess.run([
                    sys.executable, evaluation_script,
                    "--model", model_path,
                    "--data", self.config['new_data_path']
                ], capture_output=True, text=True, check=True)
                
                # 평가 결과 파싱
                metrics = self.parse_evaluation_results(result.stdout)
                logger.info(f"평가 결과: {metrics}")
                return metrics
            except subprocess.CalledProcessError as e:
                logger.error(f"모델 평가 실패: {e}")
                return None
        else:
            logger.warning("평가 스크립트가 없습니다. 기본 메트릭 반환")
            return {"mAP50": 0.0, "precision": 0.0, "recall": 0.0}
    
    def parse_evaluation_results(self, output):
        """평가 결과 파싱"""
        metrics = {}
        for line in output.split('\n'):
            if 'mAP50' in line:
                try:
                    metrics['mAP50'] = float(line.split(':')[1].strip())
                except:
                    pass
            elif 'Precision' in line:
                try:
                    metrics['precision'] = float(line.split(':')[1].strip())
                except:
                    pass
            elif 'Recall' in line:
                try:
                    metrics['recall'] = float(line.split(':')[1].strip())
                except:
                    pass
        return metrics
    
    def should_deploy_model(self, metrics):
        """모델 배포 여부 결정"""
        if not metrics:
            return False
        
        # 성능 개선 확인
        current_metrics = self.get_current_model_metrics()
        if not current_metrics:
            return True  # 현재 모델 메트릭이 없으면 배포
        
        improvement = metrics.get('mAP50', 0) - current_metrics.get('mAP50', 0)
        return improvement >= self.config['min_improvement']
    
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
    
    def deploy_model(self, model_path, metrics):
        """모델 배포"""
        logger.info("모델 배포 중...")
        
        # 현재 모델 백업
        backup_path = f"models/backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pt"
        if os.path.exists(self.config['model_path']):
            os.rename(self.config['model_path'], backup_path)
            logger.info(f"현재 모델 백업: {backup_path}")
        
        # 새 모델 배포
        os.rename(model_path, self.config['model_path'])
        logger.info(f"새 모델 배포: {model_path}")
        
        # 메트릭 저장
        metrics_file = "models/current_metrics.json"
        with open(metrics_file, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
        
        # 배포 로그 저장
        deployment_log = {
            "timestamp": datetime.now().isoformat(),
            "model_path": model_path,
            "metrics": metrics,
            "backup_path": backup_path
        }
        
        log_file = "models/deployment_log.json"
        deployments = []
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                deployments = json.load(f)
        
        deployments.append(deployment_log)
        
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(deployments, f, indent=2, ensure_ascii=False)
        
        logger.info("모델 배포 완료")
        return True
    
    def run_pipeline(self):
        """증분 학습 파이프라인 실행"""
        try:
            logger.info("증분 학습 파이프라인 시작")
            
            # 1. 전제 조건 확인
            self.check_prerequisites()
            
            # 2. 증분 학습용 데이터 준비
            data_path = self.prepare_incremental_data()
            
            # 3. 증분 학습 실행
            training_output = self.run_incremental_training(data_path)
            
            # 4. 학습된 모델 경로 찾기
            model_path = self.find_trained_model()
            if not model_path:
                raise FileNotFoundError("학습된 모델을 찾을 수 없습니다")
            
            # 5. 모델 성능 평가
            metrics = self.evaluate_model(model_path)
            
            # 6. 배포 여부 결정 및 배포
            if self.should_deploy_model(metrics):
                self.deploy_model(model_path, metrics)
                logger.info("증분 학습 파이프라인 완료 - 모델 배포됨")
                return {"status": "success", "deployed": True, "metrics": metrics}
            else:
                logger.info("증분 학습 파이프라인 완료 - 성능 개선 부족으로 배포하지 않음")
                return {"status": "success", "deployed": False, "metrics": metrics}
                
        except Exception as e:
            logger.error(f"증분 학습 파이프라인 실패: {e}")
            return {"status": "failed", "error": str(e)}
    
    def find_trained_model(self):
        """학습된 모델 파일 찾기"""
        output_dir = Path(self.config['output_path'])
        if not output_dir.exists():
            return None
        
        # 가장 최근의 weights/best.pt 파일 찾기
        for weights_dir in output_dir.glob("**/weights"):
            best_model = weights_dir / "best.pt"
            if best_model.exists():
                return str(best_model)
        
        return None

def main():
    parser = argparse.ArgumentParser(description='증분 학습 파이프라인')
    parser.add_argument('--config', help='설정 파일 경로')
    parser.add_argument('--data_path', help='새 데이터 경로')
    parser.add_argument('--model_path', help='현재 모델 경로')
    
    args = parser.parse_args()
    
    # 로그 디렉토리 생성
    os.makedirs('logs', exist_ok=True)
    
    # 파이프라인 실행
    pipeline = IncrementalLearningPipeline(args.config)
    
    # 명령행 인수로 설정 오버라이드
    if args.data_path:
        pipeline.config['new_data_path'] = args.data_path
    if args.model_path:
        pipeline.config['model_path'] = args.model_path
    
    result = pipeline.run_pipeline()
    
    # 결과 출력
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 성공/실패에 따른 종료 코드
    sys.exit(0 if result['status'] == 'success' else 1)

if __name__ == "__main__":
    main()


