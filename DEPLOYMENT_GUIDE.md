# 🚀 BrickBox 다중 PC 배포 가이드

## 📋 개요
다른 PC에서 BrickBox 프로젝트를 설정하고 사용하는 방법을 안내합니다.

## 🔄 Git 동기화 vs 환경 설정

### ✅ Git으로 자동 동기화되는 것들
- 소스 코드 (Python 스크립트, 노트북)
- 설정 파일 (YAML, JSON)
- 배치 파일 (.bat)
- 문서 (README, 가이드)

### ❌ Git으로 자동 동기화되지 않는 것들
- Python 패키지 설치
- 가상환경 설정
- GPU 드라이버
- 데이터셋 파일 (용량이 큼)

## 🖥️ 새 PC에서 환경 설정

### 방법 1: 자동 설정 (권장)
```bash
# 1. 프로젝트 클론
git clone https://github.com/your-username/brickbox.git
cd brickbox

# 2. 자동 환경 설정 실행
scripts\setup_new_pc.bat
```

### 방법 2: 수동 설정
```bash
# 1. Python 설치 (3.8-3.11)
# https://www.python.org/downloads/

# 2. Git 설치
# https://git-scm.com/downloads

# 3. 프로젝트 클론
git clone https://github.com/your-username/brickbox.git
cd brickbox

# 4. 가상환경 생성
python -m venv venv
venv\Scripts\activate.bat

# 5. 의존성 설치
pip install -r requirements.txt
```

## 🔄 기존 PC에서 환경 동기화

### 코드 변경사항 동기화
```bash
# 최신 코드 다운로드
git pull origin main

# 환경 동기화
scripts\sync_environment.bat
```

### 데이터 동기화 (선택사항)
```bash
# Supabase에서 데이터 다운로드
jupyter notebook scripts/brickbox_yolo_automated_training.ipynb
```

## 📁 디렉토리 구조

```
brickbox/
├── .git/                    # Git 저장소 (자동 동기화)
├── .gitignore              # Git 무시 파일 (자동 동기화)
├── scripts/                # 스크립트 파일들 (자동 동기화)
│   ├── setup_new_pc.bat    # 새 PC 설정
│   ├── sync_environment.bat # 환경 동기화
│   ├── run_local_training.bat # 학습 실행
│   └── local_gpu_trainer.py # 학습 스크립트
├── data/                   # 데이터 디렉토리 (Git 무시)
│   └── brickbox_dataset/   # 학습 데이터
├── output/                 # 학습 결과 (Git 무시)
├── venv/                   # 가상환경 (Git 무시)
└── README_LOCAL_TRAINING.md # 로컬 학습 가이드
```

## 🚀 사용 시나리오

### 시나리오 1: 개발 PC → 학습 PC
```bash
# 개발 PC에서
git add .
git commit -m "로컬 학습 환경 설정 추가"
git push origin main

# 학습 PC에서
git pull origin main
scripts\sync_environment.bat
```

### 시나리오 2: 여러 PC에서 협업
```bash
# PC A에서 변경
git add .
git commit -m "GPU 최적화 설정 개선"
git push origin main

# PC B에서 동기화
git pull origin main
scripts\sync_environment.bat
```

### 시나리오 3: 새 PC 설정
```bash
# 새 PC에서
git clone https://github.com/your-username/brickbox.git
cd brickbox
scripts\setup_new_pc.bat
```

## 🔧 문제 해결

### Git 동기화 문제
```bash
# 충돌 해결
git stash
git pull origin main
git stash pop

# 강제 동기화 (주의!)
git reset --hard origin/main
```

### 환경 설정 문제
```bash
# 가상환경 재생성
rmdir /s venv
python -m venv venv
venv\Scripts\activate.bat
scripts\sync_environment.bat
```

### GPU 인식 문제
```bash
# CUDA 설치 확인
nvidia-smi

# PyTorch CUDA 지원 확인
python -c "import torch; print(torch.cuda.is_available())"
```

## 📊 PC별 최적화 설정

### 고성능 PC (RTX 3070+)
```python
# local_gpu_trainer.py에서 설정
model_configs = {
    'n': {'batch': 32, 'imgsz': 640, 'epochs': 100},
    's': {'batch': 24, 'imgsz': 640, 'epochs': 100},
    'm': {'batch': 16, 'imgsz': 640, 'epochs': 80},
}
```

### 중간급 PC (RTX 2060-2070)
```python
# local_gpu_trainer.py에서 설정
model_configs = {
    'n': {'batch': 16, 'imgsz': 640, 'epochs': 100},
    's': {'batch': 12, 'imgsz': 640, 'epochs': 100},
    'm': {'batch': 8, 'imgsz': 640, 'epochs': 80},
}
```

### 저사양 PC (GTX 1060-1660)
```python
# local_gpu_trainer.py에서 설정
model_configs = {
    'n': {'batch': 8, 'imgsz': 512, 'epochs': 80},
    's': {'batch': 4, 'imgsz': 512, 'epochs': 60},
    'm': {'batch': 2, 'imgsz': 416, 'epochs': 50},
}
```

## 🎯 권장 워크플로우

### 1. 개발 단계
```bash
# 개발 PC에서 코드 작성 및 테스트
git add .
git commit -m "기능 추가"
git push origin main
```

### 2. 학습 단계
```bash
# 학습 PC에서
git pull origin main
scripts\sync_environment.bat
scripts\run_local_training.bat
```

### 3. 결과 공유
```bash
# 학습 결과를 Supabase에 업로드 (자동)
# 모델 레지스트리 업데이트 (자동)
```

## 📝 체크리스트

### 새 PC 설정 시
- [ ] Python 3.8-3.11 설치
- [ ] Git 설치
- [ ] NVIDIA 드라이버 설치
- [ ] 프로젝트 클론
- [ ] 환경 설정 실행
- [ ] GPU 인식 확인
- [ ] 테스트 실행

### 기존 PC 동기화 시
- [ ] Git pull 실행
- [ ] 환경 동기화 실행
- [ ] 의존성 확인
- [ ] GPU 설정 확인
- [ ] 테스트 실행

## 🎉 완료!

이제 여러 PC에서 BrickBox 프로젝트를 효율적으로 관리할 수 있습니다!

**핵심 포인트**:
- Git으로 코드는 자동 동기화
- 환경 설정은 수동으로 해야 함
- PC별 GPU 성능에 맞게 설정 조정
- 정기적으로 `git pull` + `sync_environment.bat` 실행
