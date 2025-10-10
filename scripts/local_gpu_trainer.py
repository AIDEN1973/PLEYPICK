#!/usr/bin/env python3
"""
🧱 BrickBox 로컬 GPU 학습 스크립트 (RTX 2070 SUPER 최적화)
AMD Ryzen 7 3700X + RTX 2070 SUPER 8GB 최적화 설정
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
    """로컬 GPU 학습 클래스 (RTX 2070 SUPER 최적화)"""
    
    def __init__(self):
        self.device = self.setup_device()
        self.setup_memory_optimization()
    
    def setup_device(self):
        """GPU 디바이스 설정 (RTX 2070 SUPER 최적화)"""
        if torch.cuda.is_available():
            device = 'cuda'
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
            logger.info(f"🚀 GPU 사용 가능: {gpu_name} ({gpu_memory:.1f}GB)")
            
            # RTX 2070 SUPER 최적화
            if gpu_memory >= 8:  # 8GB 이상
                logger.info("✅ RTX 2070 SUPER 감지 - 고성능 모드 활성화")
                torch.cuda.set_per_process_memory_fraction(0.9)  # 90% 메모리 사용
            elif gpu_memory >= 4:  # 4GB 이상
                logger.info("⚠️ 중간급 GPU 감지 - 균형 모드 활성화")
                torch.cuda.set_per_process_memory_fraction(0.8)  # 80% 메모리 사용
            else:
                logger.warning("⚠️ 저사양 GPU 감지 - 메모리 최적화 모드 활성화")
                torch.cuda.set_per_process_memory_fraction(0.7)  # 70% 메모리 사용
        else:
            device = 'cpu'
            logger.warning("⚠️ GPU를 사용할 수 없습니다. CPU로 학습합니다.")
        
        return device
    
    def setup_memory_optimization(self):
        """메모리 최적화 설정 (RTX 2070 SUPER 최적화)"""
        if torch.cuda.is_available():
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
            
            if gpu_memory >= 8:  # RTX 2070 SUPER
                os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
            else:
                os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:256'
            
            torch.cuda.empty_cache()
            logger.info("🔧 GPU 메모리 최적화 설정 완료")
    
    def train_yolo_model(self, dataset_path: str, model_size: str = 'n'):
        """YOLO 모델 학습 (RTX 2070 SUPER 최적화)"""
        logger.info(f"🚀 YOLO{model_size} 모델 학습 시작 (RTX 2070 SUPER 최적화)")
        
        # RTX 2070 SUPER 최적화 설정
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3 if torch.cuda.is_available() else 0
        
        if gpu_memory >= 8:  # RTX 2070 SUPER
            model_configs = {
                'n': {'model': 'yolo11n.pt', 'batch': 16, 'imgsz': 640, 'epochs': 100},   # 고성능
                's': {'model': 'yolo11s.pt', 'batch': 12, 'imgsz': 640, 'epochs': 100},   # 중간
                'm': {'model': 'yolo11m.pt', 'batch': 8, 'imgsz': 640, 'epochs': 80},     # 무거움
            }
        elif gpu_memory >= 4:  # 중간급 GPU
            model_configs = {
                'n': {'model': 'yolo11n.pt', 'batch': 8, 'imgsz': 512, 'epochs': 80},
                's': {'model': 'yolo11s.pt', 'batch': 4, 'imgsz': 512, 'epochs': 60},
                'm': {'model': 'yolo11m.pt', 'batch': 2, 'imgsz': 416, 'epochs': 50},
            }
        else:  # 저사양 GPU
            model_configs = {
                'n': {'model': 'yolo11n.pt', 'batch': 4, 'imgsz': 416, 'epochs': 50},
                's': {'model': 'yolo11s.pt', 'batch': 2, 'imgsz': 416, 'epochs': 40},
                'm': {'model': 'yolo11m.pt', 'batch': 1, 'imgsz': 320, 'epochs': 30},
            }
        
        config = model_configs.get(model_size, model_configs['n'])
        
        # YOLO 모델 초기화
        model = YOLO(config['model'])
        
        # 학습 설정
        training_name = f'brickbox_rtx2070super_{model_size}_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
        
        logger.info(f"📊 RTX 2070 SUPER 학습 설정:")
        logger.info(f"   - 모델: {config['model']}")
        logger.info(f"   - 배치 크기: {config['batch']}")
        logger.info(f"   - 이미지 크기: {config['imgsz']}")
        logger.info(f"   - 에포크: {config['epochs']}")
        logger.info(f"   - 디바이스: {self.device}")
        
        try:
            # 학습 실행 (RTX 2070 SUPER 최적화)
            results = model.train(
                data=dataset_path,
                epochs=config['epochs'],
                batch=config['batch'],
                imgsz=config['imgsz'],
                device=self.device,
                project='./output/local_training',
                name=training_name,
                save=True,
                plots=True,
                val=True,
                patience=15,
                save_period=10,
                # RTX 2070 SUPER 최적화 옵션
                workers=4,  # AMD Ryzen 7 3700X 8코어 최적화
                cache=True,  # 데이터 캐싱
                amp=True,    # 자동 혼합 정밀도
                cos_lr=True, # 코사인 학습률 스케줄링
                close_mosaic=10,  # 마지막 10 에포크에서 모자이크 비활성화
            )
            
            logger.info("✅ RTX 2070 SUPER 학습 완료!")
            return results
            
        except RuntimeError as e:
            if "out of memory" in str(e):
                logger.error("❌ GPU 메모리 부족 - 배치 크기를 더 줄이거나 모델 크기를 변경하세요")
                logger.info("💡 RTX 2070 SUPER 해결 방법:")
                logger.info("   - model_size를 'n'으로 변경")
                logger.info("   - imgsz를 512로 변경")
                logger.info("   - batch를 8로 변경")
            else:
                logger.error(f"❌ 학습 실패: {e}")
            raise

def main():
    """메인 실행 함수"""
    if len(sys.argv) < 2:
        print("사용법: python local_gpu_trainer.py <dataset.yaml> [model_size]")
        print("모델 크기: n (가장 가벼움), s (중간), m (무거움)")
        print("RTX 2070 SUPER 최적화: n 권장")
        sys.exit(1)
    
    dataset_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else 'n'
    
    try:
        trainer = LocalGPUTrainer()
        results = trainer.train_yolo_model(dataset_path, model_size)
        print("🎉 RTX 2070 SUPER 로컬 GPU 학습 완료!")
        
    except Exception as e:
        logger.error(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
