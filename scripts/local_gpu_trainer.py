#!/usr/bin/env python3
"""
🧱 BrickBox 로컬 GPU 학습 스크립트
GTX 750 Ti 최적화 설정 포함
"""

import os
import sys
import torch
import logging
from pathlib import Path
from ultralytics import YOLO
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LocalGPUTrainer:
    """로컬 GPU 학습 클래스"""
    
    def __init__(self):
        self.device = self.setup_device()
        self.setup_memory_optimization()
    
    def setup_device(self):
        """GPU 디바이스 설정"""
        if torch.cuda.is_available():
            device = 'cuda'
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
            logger.info(f"🚀 GPU 사용 가능: {gpu_name} ({gpu_memory:.1f}GB)")
            
            # GTX 750 Ti 최적화
            if "750" in gpu_name:
                logger.warning("⚠️ GTX 750 Ti 감지 - 메모리 최적화 모드 활성화")
                torch.cuda.set_per_process_memory_fraction(0.7)  # 70% 메모리 사용
        else:
            device = 'cpu'
            logger.warning("⚠️ GPU를 사용할 수 없습니다. CPU로 학습합니다.")
        
        return device
    
    def setup_memory_optimization(self):
        """메모리 최적화 설정"""
        if torch.cuda.is_available():
            # 메모리 할당 전략 설정
            os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:256'
            torch.cuda.empty_cache()
            logger.info("🔧 GPU 메모리 최적화 설정 완료")
    
    def train_yolo_model(self, dataset_path: str, model_size: str = 'n'):
        """YOLO 모델 학습"""
        logger.info(f"🚀 YOLO{model_size} 모델 학습 시작")
        
        # 모델 크기별 설정 (GTX 750 Ti 최적화)
        model_configs = {
            'n': {'model': 'yolo11n.pt', 'batch': 4, 'imgsz': 416},   # 가장 가벼움
            's': {'model': 'yolo11s.pt', 'batch': 2, 'imgsz': 416},   # 중간
            'm': {'model': 'yolo11m.pt', 'batch': 1, 'imgsz': 320},   # 무거움
        }
        
        config = model_configs.get(model_size, model_configs['n'])
        
        # YOLO 모델 초기화
        model = YOLO(config['model'])
        
        # 학습 설정
        training_name = f'brickbox_local_{model_size}_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
        
        logger.info(f"📊 학습 설정:")
        logger.info(f"   - 모델: {config['model']}")
        logger.info(f"   - 배치 크기: {config['batch']}")
        logger.info(f"   - 이미지 크기: {config['imgsz']}")
        logger.info(f"   - 디바이스: {self.device}")
        
        try:
            # 학습 실행
            results = model.train(
                data=dataset_path,
                epochs=50,  # GTX 750 Ti용으로 에포크 수 조정
                batch=config['batch'],
                imgsz=config['imgsz'],
                device=self.device,
                project='./output/local_training',
                name=training_name,
                save=True,
                plots=True,
                val=True,
                patience=10,
                save_period=10,
                # 메모리 최적화 옵션
                workers=2,  # CPU 워커 수 제한
                cache=True,  # 데이터 캐싱
                amp=True,    # 자동 혼합 정밀도
            )
            
            logger.info("✅ 학습 완료!")
            return results
            
        except RuntimeError as e:
            if "out of memory" in str(e):
                logger.error("❌ GPU 메모리 부족 - 배치 크기를 더 줄이거나 모델 크기를 변경하세요")
                logger.info("💡 해결 방법:")
                logger.info("   - model_size를 'n'으로 변경")
                logger.info("   - imgsz를 320으로 변경")
                logger.info("   - batch를 1로 변경")
            else:
                logger.error(f"❌ 학습 실패: {e}")
            raise

def main():
    """메인 실행 함수"""
    if len(sys.argv) < 2:
        print("사용법: python local_gpu_trainer.py <dataset.yaml> [model_size]")
        print("모델 크기: n (가장 가벼움), s (중간), m (무거움)")
        sys.exit(1)
    
    dataset_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else 'n'
    
    try:
        trainer = LocalGPUTrainer()
        results = trainer.train_yolo_model(dataset_path, model_size)
        print("🎉 로컬 GPU 학습 완료!")
        
    except Exception as e:
        logger.error(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
