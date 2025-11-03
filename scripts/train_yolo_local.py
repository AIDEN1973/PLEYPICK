#!/usr/bin/env python3
"""
BrickBox 로컬 PC YOLO 학습 스크립트
렌더링된 데이터셋을 사용하여 로컬 PC에서 YOLO 모델 학습
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime
import argparse

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("[WARNING] ultralytics 패키지가 설치되지 않았습니다.")
    print("설치 명령어: pip install ultralytics")

class LocalYOLOTrainer:
    """로컬 PC YOLO 학습 클래스"""
    
    def __init__(self, data_path: str, output_dir: str = None):
        self.data_path = Path(data_path)
        self.output_dir = Path(output_dir) if output_dir else project_root / "output" / "training"
        self.model_dir = self.output_dir / "models"
        self.log_dir = self.output_dir / "logs"
        
        # 디렉토리 생성
        self.create_directories()
        
        # 로깅 설정
        self.setup_logging()
        
        # YOLO 모델 초기화
        self.model = None
        if YOLO_AVAILABLE:
            self.model = YOLO('yolov8n.pt')  # YOLOv8 nano 모델 사용
        
    def create_directories(self):
        """필요한 디렉토리 생성"""
        directories = [self.output_dir, self.model_dir, self.log_dir]
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            print(f"디렉토리 생성: {directory}")
    
    def setup_logging(self):
        """로깅 설정"""
        log_file = self.log_dir / f"training_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"학습 로그 파일: {log_file}")
    
    def validate_dataset(self) -> bool:
        """데이터셋 유효성 검사"""
        self.logger.info("데이터셋 유효성 검사 중...")
        
        if not self.data_path.exists():
            self.logger.error(f"데이터셋 파일 없음: {self.data_path}")
            return False
        
        # YAML 파일 내용 확인
        try:
            import yaml
            with open(self.data_path, 'r', encoding='utf-8') as f:
                data_config = yaml.safe_load(f)
            
            # 필수 경로 확인
            base_path = Path(data_config.get('path', ''))
            train_path = base_path / data_config.get('train', 'images/train')
            val_path = base_path / data_config.get('val', 'images/val')
            
            if not train_path.exists():
                self.logger.error(f"훈련 이미지 경로 없음: {train_path}")
                return False
            
            # 이미지 파일 개수 확인
            train_images = list(train_path.glob("*.webp")) + list(train_path.glob("*.jpg")) + list(train_path.glob("*.png"))
            self.logger.info(f"훈련 이미지 개수: {len(train_images)}")
            
            if len(train_images) == 0:
                self.logger.error("훈련 이미지가 없습니다")
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"데이터셋 검사 실패: {e}")
            return False
    
    def train_model(self, epochs: int = 100, batch_size: int = 16, imgsz: int = 640) -> dict:
        """YOLO 모델 학습"""
        if not YOLO_AVAILABLE:
            self.logger.error("YOLO 패키지가 설치되지 않았습니다")
            return {"success": False, "error": "YOLO package not available"}
        
        if not self.model:
            self.logger.error("YOLO 모델 초기화 실패")
            return {"success": False, "error": "YOLO model initialization failed"}
        
        try:
            self.logger.info("YOLO 모델 학습 시작...")
            self.logger.info(f"데이터셋: {self.data_path}")
            self.logger.info(f"에포크: {epochs}")
            self.logger.info(f"배치 크기: {batch_size}")
            self.logger.info(f"이미지 크기: {imgsz}")
            
            # 학습 시작
            start_time = time.time()
            
            results = self.model.train(
                data=str(self.data_path),
                epochs=epochs,
                batch=batch_size,
                imgsz=imgsz,
                project=str(self.model_dir),
                name=f"lego_training_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                save=True,
                save_period=10,  # 10 에포크마다 저장
                device='cpu',  # GPU 사용 시 'cuda'로 변경
                workers=4,
                patience=20,  # 조기 종료
                verbose=True
            )
            
            end_time = time.time()
            training_time = end_time - start_time
            
            # 학습 결과 저장
            training_results = {
                "success": True,
                "training_time": training_time,
                "epochs_completed": epochs,
                "model_path": str(self.model_dir / f"lego_training_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
                "results": results,
                "start_time": datetime.fromtimestamp(start_time).isoformat(),
                "end_time": datetime.fromtimestamp(end_time).isoformat()
            }
            
            # 결과를 JSON 파일로 저장
            results_file = self.log_dir / f"training_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(results_file, 'w', encoding='utf-8') as f:
                json.dump(training_results, f, indent=2, ensure_ascii=False, default=str)
            
            self.logger.info(f"학습 완료! 소요 시간: {training_time:.2f}초")
            self.logger.info(f"모델 저장 위치: {training_results['model_path']}")
            self.logger.info(f"결과 파일: {results_file}")
            
            return training_results
            
        except Exception as e:
            self.logger.error(f"학습 실패: {e}")
            return {"success": False, "error": str(e)}
    
    def evaluate_model(self, model_path: str) -> dict:
        """학습된 모델 평가"""
        try:
            self.logger.info(f"모델 평가 시작: {model_path}")
            
            # 학습된 모델 로드
            trained_model = YOLO(model_path)
            
            # 검증 데이터셋으로 평가
            results = trained_model.val(data=str(self.data_path))
            
            evaluation_results = {
                "success": True,
                "model_path": model_path,
                "mAP50": results.box.map50 if hasattr(results, 'box') else 0,
                "mAP50-95": results.box.map if hasattr(results, 'box') else 0,
                "precision": results.box.mp if hasattr(results, 'box') else 0,
                "recall": results.box.mr if hasattr(results, 'box') else 0
            }
            
            self.logger.info(f"평가 완료 - mAP50: {evaluation_results['mAP50']:.3f}")
            
            return evaluation_results
            
        except Exception as e:
            self.logger.error(f"모델 평가 실패: {e}")
            return {"success": False, "error": str(e)}

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='로컬 PC YOLO 학습')
    parser.add_argument('--data', type=str, required=True, help='데이터셋 YAML 파일 경로')
    parser.add_argument('--epochs', type=int, default=100, help='학습 에포크 수')
    parser.add_argument('--batch', type=int, default=16, help='배치 크기')
    parser.add_argument('--imgsz', type=int, default=640, help='이미지 크기')
    parser.add_argument('--output', type=str, help='출력 디렉토리')
    parser.add_argument('--evaluate', action='store_true', help='학습 후 모델 평가')
    
    args = parser.parse_args()
    
    # 학습기 초기화
    trainer = LocalYOLOTrainer(args.data, args.output)
    
    try:
        # 1. 데이터셋 유효성 검사
        if not trainer.validate_dataset():
            print("[ERROR] 데이터셋 검사 실패")
            sys.exit(1)
        
        # 2. 모델 학습
        training_results = trainer.train_model(
            epochs=args.epochs,
            batch_size=args.batch,
            imgsz=args.imgsz
        )
        
        if not training_results.get('success', False):
            print(f"[ERROR] 학습 실패: {training_results.get('error', 'Unknown error')}")
            sys.exit(1)
        
        print("✅ 학습 완료!")
        print(f"모델 저장 위치: {training_results['model_path']}")
        
        # 3. 모델 평가 (선택사항)
        if args.evaluate:
            evaluation_results = trainer.evaluate_model(training_results['model_path'])
            if evaluation_results.get('success', False):
                print(f"📊 평가 결과 - mAP50: {evaluation_results['mAP50']:.3f}")
            else:
                print(f"[ERROR] 평가 실패: {evaluation_results.get('error', 'Unknown error')}")
        
    except Exception as e:
        print(f"[ERROR] 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
