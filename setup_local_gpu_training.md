# 🚀 BrickBox 로컬 GPU 학습 환경 구축 가이드

## 📋 시스템 요구사항

### **최소 요구사항**
- **GPU**: NVIDIA GTX 1060 6GB 이상 (권장: RTX 3060 12GB 이상)
- **RAM**: 16GB 이상
- **저장공간**: 50GB 이상 여유공간
- **CUDA**: 11.8 이상
- **Python**: 3.8-3.11

### **현재 시스템 분석**
- **GPU**: NVIDIA GeForce GTX 750 Ti (2GB VRAM) ⚠️ **제한적**
- **CUDA**: 12.6 지원
- **PyTorch**: 2.8.0+cpu (CUDA 미지원)

---

## 🔧 1단계: CUDA 지원 PyTorch 설치

### **기존 PyTorch 제거**
```bash
pip uninstall torch torchvision torchaudio
```

### **CUDA 12.1 호환 PyTorch 설치**
```bash
# CUDA 12.1 버전 PyTorch 설치
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### **설치 확인**
```bash
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"
```

---

## 🧱 2단계: BrickBox 학습 환경 설정

### **필수 패키지 설치**
```bash
# YOLO 학습 패키지
pip install ultralytics
pip install opencv-python
pip install matplotlib
pip install seaborn

# 데이터 처리
pip install pandas
pip install numpy
pip install pillow

# Supabase 연동
pip install supabase
pip install python-dotenv

# 추가 유틸리티
pip install tqdm
pip install wandb  # 선택사항: 실험 추적
```

### **환경 변수 설정**
```bash
# .env 파일 생성
cat > .env << EOF
VITE_SUPABASE_URL=https://npferbxuxocbfnfbpcnz.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_SUPABASE_SERVICE_ROLE=your_service_key_here

# GPU 학습 설정
CUDA_VISIBLE_DEVICES=0
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
EOF
```

---

## 🎯 3단계: 로컬 학습 스크립트 생성

### **로컬 GPU 학습 스크립트**
```python
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
```

---

## 📊 4단계: 데이터셋 준비

### **YOLO 형식 데이터셋 구조**
```
dataset/
├── images/
│   ├── train/
│   ├── val/
│   └── test/
├── labels/
│   ├── train/
│   ├── val/
│   └── test/
└── data.yaml
```

### **data.yaml 파일 예시**
```yaml
path: ./dataset
train: images/train
val: images/val
test: images/test

nc: 1
names: ['lego_part']
```

---

## 🚀 5단계: 학습 실행

### **기본 학습 (GTX 750 Ti 최적화)**
```bash
# 가장 가벼운 모델로 학습
python local_gpu_trainer.py dataset/data.yaml n

# 중간 크기 모델로 학습 (메모리 여유 있을 때)
python local_gpu_trainer.py dataset/data.yaml s
```

### **학습 모니터링**
```bash
# 학습 진행 상황 확인
tensorboard --logdir ./output/local_training

# GPU 사용량 모니터링
nvidia-smi -l 1
```

---

## ⚠️ GTX 750 Ti 제한사항 및 해결책

### **메모리 제한 (2GB VRAM)**
- **배치 크기**: 최대 4 (YOLO11n 기준)
- **이미지 크기**: 416x416 권장
- **모델 크기**: YOLO11n만 권장

### **성능 최적화**
```python
# 메모리 절약 설정
torch.cuda.set_per_process_memory_fraction(0.7)
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:256'

# 학습 설정
batch_size = 2  # GTX 750 Ti용
imgsz = 416     # 작은 이미지 크기
workers = 2     # CPU 워커 수 제한
```

### **대안 솔루션**
1. **Google Colab 사용**: 무료 GPU (T4 16GB)
2. **클라우드 GPU**: AWS, GCP, Azure
3. **업그레이드**: RTX 3060 12GB 이상 권장

---

## 📈 6단계: 성능 모니터링

### **학습 진행 상황 확인**
```python
# 학습 중 메트릭 확인
import matplotlib.pyplot as plt
from ultralytics import YOLO

model = YOLO('path/to/best.pt')
results = model.val()

# 결과 시각화
results.plot()
```

### **모델 성능 평가**
```python
# 검증 데이터셋으로 성능 평가
metrics = model.val(data='dataset/data.yaml')
print(f"mAP50: {metrics.box.map50}")
print(f"mAP50-95: {metrics.box.map}")
```

---

## 🎯 7단계: 모델 배포

### **ONNX 변환**
```python
# 학습된 모델을 ONNX로 변환
model = YOLO('path/to/best.pt')
model.export(format='onnx', imgsz=416, optimize=True)
```

### **Supabase 업로드**
```python
# Supabase에 모델 업로드
from supabase import create_client

supabase = create_client(url, key)
with open('best.onnx', 'rb') as f:
    supabase.storage.from_('models').upload('local_model.onnx', f.read())
```

---

## 🔧 문제 해결

### **GPU 메모리 부족 오류**
```bash
# 해결 방법
1. 배치 크기 줄이기: batch=1
2. 이미지 크기 줄이기: imgsz=320
3. 모델 크기 줄이기: YOLO11n 사용
4. 메모리 정리: torch.cuda.empty_cache()
```

### **CUDA 버전 불일치**
```bash
# PyTorch 재설치
pip uninstall torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### **학습 속도 개선**
```python
# 혼합 정밀도 사용
amp=True

# 데이터 로딩 최적화
workers=4
cache=True

# GPU 메모리 최적화
torch.backends.cudnn.benchmark = True
```

---

## 📋 체크리스트

### **설치 확인**
- [ ] CUDA 지원 PyTorch 설치
- [ ] Ultralytics 설치
- [ ] GPU 인식 확인
- [ ] 데이터셋 준비

### **학습 실행**
- [ ] 메모리 최적화 설정
- [ ] 배치 크기 조정
- [ ] 학습 모니터링
- [ ] 결과 저장

### **배포**
- [ ] ONNX 변환
- [ ] Supabase 업로드
- [ ] 성능 테스트

---

## 🎉 완료!

이제 로컬 GPU 환경에서 BrickBox YOLO 모델을 학습할 수 있습니다!

**주의**: GTX 750 Ti는 메모리가 제한적이므로 YOLO11n 모델과 작은 배치 크기를 사용하세요.
