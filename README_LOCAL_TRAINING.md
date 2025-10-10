# 🧱 BrickBox 로컬 PC 학습 가이드 (RTX 2070 SUPER 최적화)

## 💻 시스템 사양
- **프로세서**: AMD Ryzen 7 3700X 8-Core Processor 3.59 GHz
- **RAM**: 16.0GB
- **GPU**: NVIDIA GeForce RTX 2070 SUPER (8 GB)
- **저장소**: 466 GB SSD

## 🚀 빠른 시작

### 1단계: 환경 설정
```bash
# RTX 2070 SUPER 최적화 환경 설정
scripts\setup_local_gpu.bat
```

### 2단계: 데이터셋 준비
```bash
# Jupyter 노트북 실행하여 데이터 다운로드
jupyter notebook scripts/brickbox_yolo_automated_training.ipynb
```

### 3단계: 로컬 PC 학습 실행
```bash
# RTX 2070 SUPER 최적화 학습 실행
scripts\run_local_training.bat
```

### 4단계: GPU 모니터링 (선택사항)
```bash
# GPU 사용량 모니터링
scripts\monitor_gpu.bat
```

## 📊 RTX 2070 SUPER 최적화 설정

### 모델별 설정
| 모델 | 배치 크기 | 이미지 크기 | 에포크 | 예상 시간 |
|------|-----------|-------------|--------|-----------|
| YOLO11n | 16 | 640x640 | 100 | ~2시간 |
| YOLO11s | 12 | 640x640 | 100 | ~3시간 |
| YOLO11m | 8 | 640x640 | 80 | ~4시간 |

### 메모리 최적화
- **GPU 메모리 사용률**: 90% (7.2GB/8GB)
- **메모리 할당 전략**: max_split_size_mb:512
- **자동 혼합 정밀도**: 활성화 (AMP)

### CPU 최적화
- **워커 수**: 4 (AMD Ryzen 7 3700X 8코어)
- **데이터 캐싱**: 활성화
- **코사인 학습률**: 활성화

## 🔧 문제 해결

### GPU 메모리 부족
```bash
# 해결 방법
1. 배치 크기 줄이기: batch=8
2. 이미지 크기 줄이기: imgsz=512
3. 모델 크기 줄이기: YOLO11n 사용
```

### 학습 속도 개선
```bash
# 최적화 설정
- workers=4 (CPU 워커 수)
- cache=True (데이터 캐싱)
- amp=True (자동 혼합 정밀도)
```

## 📁 디렉토리 구조

```
brickbox/
├── data/
│   └── brickbox_dataset/
│       ├── images/
│       ├── labels/
│       └── dataset.yaml
├── output/
│   └── local_training/
│       └── brickbox_rtx2070super_n_YYYYMMDD_HHMMSS/
│           ├── weights/
│           │   ├── best.pt
│           │   └── best.onnx
│           └── results/
├── scripts/
│   ├── setup_local_gpu.bat
│   ├── run_local_training.bat
│   ├── monitor_gpu.bat
│   └── local_gpu_trainer.py
└── scripts/
    └── brickbox_yolo_automated_training.ipynb
```

## 🎯 학습 결과

### 성능 지표
- **mAP50**: 0.85+ (목표)
- **mAP50-95**: 0.65+ (목표)
- **Precision**: 0.90+ (목표)
- **Recall**: 0.85+ (목표)

### 모델 파일
- **학습 모델**: `best.pt` (PyTorch)
- **추론 모델**: `best.onnx` (ONNX)
- **모델 크기**: ~6MB (YOLO11n)

## 📊 모니터링

### GPU 사용량 확인
```bash
nvidia-smi -l 1
```

### 학습 진행 상황
```bash
# TensorBoard 실행
tensorboard --logdir output/local_training
```

## 🚀 고급 설정

### 커스텀 학습 설정
```python
# scripts/local_gpu_trainer.py 수정
model_configs = {
    'n': {'model': 'yolo11n.pt', 'batch': 20, 'imgsz': 640, 'epochs': 150},  # 더 큰 배치
    's': {'model': 'yolo11s.pt', 'batch': 16, 'imgsz': 640, 'epochs': 120},  # 더 많은 에포크
}
```

### 데이터 증강 설정
```yaml
# data/brickbox_dataset/dataset.yaml
augment: true
hsv_h: 0.015
hsv_s: 0.7
hsv_v: 0.4
degrees: 0.0
translate: 0.1
scale: 0.5
shear: 0.0
perspective: 0.0
flipud: 0.0
fliplr: 0.5
mosaic: 1.0
mixup: 0.0
```

## 🎉 완료!

이제 로컬 PC에서 RTX 2070 SUPER를 활용하여 BrickBox YOLO 모델을 학습할 수 있습니다!

**주의사항**:
- 학습 중에는 다른 GPU 집약적인 작업을 피하세요
- 충분한 저장 공간(50GB+)을 확보하세요
- 정기적으로 GPU 온도를 확인하세요
