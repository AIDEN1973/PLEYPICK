# 🧱 BrickBox 로컬 YOLO 학습 가이드

로컬 PC에서 YOLO 모델을 학습하는 방법을 안내합니다.

## 📋 시스템 요구사항

### 최소 요구사항
- **Python**: 3.8 이상
- **RAM**: 8GB 이상
- **저장공간**: 10GB 이상
- **OS**: Windows 10/11, macOS, Linux

### 권장 요구사항
- **GPU**: NVIDIA GPU (CUDA 지원)
- **VRAM**: 4GB 이상
- **RAM**: 16GB 이상
- **저장공간**: 50GB 이상

## 🚀 빠른 시작

### 1. 환경 설정
```bash
# 프로젝트 루트 디렉토리에서
python scripts/setup_local_training.py
```

### 2. Supabase 설정
`.env` 파일을 편집하여 Supabase 정보를 입력하세요:
```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. 데이터셋 준비
```
data/synthetic/
├── 76917/          # 레고 세트 번호
│   ├── images/
│   │   ├── train/
│   │   ├── val/
│   │   └── test/
│   └── labels/
│       ├── train/
│       ├── val/
│       └── test/
└── data.yaml
```

### 4. 학습 시작

#### 방법 1: 대시보드 사용
1. 브라우저에서 BrickBox 대시보드 열기
2. "자동화된 학습" 탭으로 이동
3. 세트 번호 입력 후 "학습 시작" 클릭
4. 터미널에서 제공된 명령어 실행

#### 방법 2: 직접 실행
```bash
# 기본 설정으로 학습
python scripts/local_yolo_training.py --set_num 76917

# 커스텀 설정으로 학습
python scripts/local_yolo_training.py \
  --set_num 76917 \
  --epochs 200 \
  --batch_size 32 \
  --imgsz 640 \
  --device cuda
```

#### 방법 3: 배치 파일 사용 (Windows)
```cmd
run_local_training.bat 76917 100 16 640
```

## ⚙️ 고급 설정

### GPU 설정
```python
# CUDA 사용 가능 여부 확인
import torch
print(f"CUDA 사용 가능: {torch.cuda.is_available()}")
print(f"GPU 개수: {torch.cuda.device_count()}")
print(f"GPU 이름: {torch.cuda.get_device_name(0)}")
```

### 학습 설정 커스터마이징
`local_training_config.yaml` 파일을 편집하여 학습 설정을 변경할 수 있습니다:

```yaml
training:
  default_epochs: 100
  default_batch_size: 16
  default_img_size: 640
  default_device: auto
  
  # GPU 설정
  gpu:
    enabled: true
    device_count: 1
    memory_fraction: 0.8
    
  # 최적화 설정
  optimization:
    learning_rate: 0.01
    weight_decay: 0.0005
    momentum: 0.937
```

## 📊 학습 모니터링

### 실시간 모니터링
- 대시보드에서 학습 진행 상황 확인
- 실시간 메트릭 업데이트
- 자동 모델 업로드

### 로그 확인
```bash
# 학습 로그 확인
tail -f training.log

# GPU 사용률 모니터링 (Linux/macOS)
watch -n 1 nvidia-smi
```

## 🔧 문제 해결

### 일반적인 문제

#### 1. CUDA 오류
```
RuntimeError: CUDA out of memory
```
**해결방법:**
- 배치 크기 줄이기: `--batch_size 8`
- 이미지 크기 줄이기: `--imgsz 416`
- GPU 메모리 정리

#### 2. 데이터셋 오류
```
FileNotFoundError: Dataset not found
```
**해결방법:**
- 데이터셋 경로 확인
- `data.yaml` 파일 존재 확인
- 이미지/라벨 파일 형식 확인

#### 3. 의존성 오류
```
ModuleNotFoundError: No module named 'ultralytics'
```
**해결방법:**
```bash
pip install ultralytics torch torchvision
```

### 성능 최적화

#### GPU 메모리 최적화
```python
# 배치 크기 자동 조정
import torch
gpu_memory = torch.cuda.get_device_properties(0).total_memory
if gpu_memory < 8e9:  # 8GB 미만
    batch_size = 8
else:
    batch_size = 16
```

#### CPU 사용 최적화
```python
# CPU 코어 수에 맞춰 워커 수 설정
import os
workers = min(os.cpu_count(), 8)
```

## 📈 성능 벤치마크

### 예상 학습 시간 (RTX 3080 기준)
- **100 에폭**: 2-3시간
- **200 에폭**: 4-6시간
- **500 에폭**: 10-15시간

### 메모리 사용량
- **GPU VRAM**: 4-8GB
- **시스템 RAM**: 8-16GB
- **디스크 공간**: 10-50GB

## 🎯 모델 성능 목표

### 권장 성능 지표
- **mAP50**: > 0.85
- **Precision**: > 0.80
- **Recall**: > 0.80
- **F1-Score**: > 0.80

### 성능 개선 팁
1. **데이터 증강**: 더 많은 변형 데이터 사용
2. **하이퍼파라미터 튜닝**: 학습률, 배치 크기 조정
3. **모델 아키텍처**: 더 큰 모델 사용 (YOLOv8m, YOLOv8l)
4. **학습 시간**: 더 많은 에폭으로 학습

## 📚 추가 자료

### 유용한 링크
- [Ultralytics YOLO 문서](https://docs.ultralytics.com/)
- [PyTorch 설치 가이드](https://pytorch.org/get-started/locally/)
- [CUDA 설치 가이드](https://developer.nvidia.com/cuda-downloads)

### 커뮤니티
- [GitHub Issues](https://github.com/your-repo/issues)
- [Discord 채널](https://discord.gg/your-server)
- [문서 사이트](https://docs.your-site.com)

## 🆘 지원

문제가 발생하면 다음을 확인하세요:

1. **로그 파일**: `training.log` 확인
2. **시스템 요구사항**: GPU, RAM, 디스크 공간
3. **의존성**: 모든 패키지가 올바르게 설치되었는지 확인
4. **데이터셋**: 형식과 경로가 올바른지 확인

추가 도움이 필요하면 GitHub Issues에 문의하세요!