# 🚀 BrickBox 로컬 학습 배포 가이드

다른 PC에서 BrickBox 로컬 학습 환경을 쉽게 설정하는 방법을 안내합니다.

## 🎯 원클릭 설치 (권장)

### Windows
```cmd
# 1. 프로젝트 다운로드
git clone https://github.com/your-repo/brickbox.git
cd brickbox

# 2. 자동 설치 실행
scripts\install_local_training.bat
```

### Linux/macOS
```bash
# 1. 프로젝트 다운로드
git clone https://github.com/your-repo/brickbox.git
cd brickbox

# 2. 실행 권한 부여
chmod +x scripts/install_local_training.sh

# 3. 자동 설치 실행
./scripts/install_local_training.sh
```

### Python 스크립트 (모든 OS)
```bash
# 1. 프로젝트 다운로드
git clone https://github.com/your-repo/brickbox.git
cd brickbox

# 2. Python 자동 설치
python scripts/quick_setup.py
```

## 📋 수동 설치

### 1. 시스템 요구사항 확인
- **Python**: 3.8 이상
- **RAM**: 8GB 이상 (권장 16GB)
- **저장공간**: 10GB 이상 (권장 50GB)
- **GPU**: NVIDIA GPU 권장 (CUDA 지원)

### 2. Python 설치
- [Python 공식 사이트](https://www.python.org/downloads/)에서 다운로드
- 설치 시 "Add Python to PATH" 체크박스 선택

### 3. 프로젝트 설정
```bash
# 프로젝트 클론
git clone https://github.com/your-repo/brickbox.git
cd brickbox

# 가상환경 생성 (선택사항)
python -m venv venv

# 가상환경 활성화
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### 4. 필수 패키지 설치
```bash
# pip 업그레이드
python -m pip install --upgrade pip

# 필수 패키지 설치
pip install ultralytics torch torchvision
pip install supabase pyyaml
pip install opencv-python pillow
pip install pandas numpy matplotlib seaborn
pip install requests scipy
```

### 5. 디렉토리 구조 생성
```bash
# 필요한 디렉토리 생성
python -c "
import os
dirs = ['data/synthetic', 'data/ldraw', 'data/parts', 'data/materials', 'data/colors', 
        'runs/train', 'runs/val', 'runs/predict', 'models', 'logs']
for d in dirs: os.makedirs(d, exist_ok=True)
print('✅ 디렉토리 구조 생성 완료')
"
```

### 6. 설정 파일 생성
```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집하여 Supabase 정보 입력
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🧪 테스트 실행

### 1. 테스트 데이터셋 생성
```bash
python data/synthetic/test_dataset.py
```

### 2. 간단한 학습 테스트
```bash
# 3분 정도의 빠른 테스트
python scripts/local_yolo_training.py --set_num test_dataset --epochs 3 --batch_size 2
```

### 3. 대시보드 테스트
```bash
# 개발 서버 시작
npm run dev

# 브라우저에서 http://localhost:3000 접속
# "자동화된 학습" 탭에서 테스트
```

## 🔧 문제 해결

### 패키지 설치 오류
```bash
# 권한 문제 시
pip install --user package_name

# 특정 버전 설치
pip install torch==2.0.0 torchvision==0.15.0

# 가상환경 사용
python -m venv venv
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows
```

### GPU 사용 불가
```bash
# CUDA 설치 확인
python -c "import torch; print(torch.cuda.is_available())"

# CUDA 버전 확인
nvidia-smi

# PyTorch CUDA 버전 설치
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

### 메모리 부족
```bash
# 배치 크기 줄이기
python scripts/local_yolo_training.py --batch_size 4

# 이미지 크기 줄이기
python scripts/local_yolo_training.py --imgsz 416
```

## 📊 성능 최적화

### GPU 사용 시
```bash
# CUDA 사용 확인
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"

# GPU 메모리 확인
python -c "import torch; print(f'GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB')"
```

### CPU 사용 시
```bash
# CPU 코어 수 확인
python -c "import os; print(f'CPU cores: {os.cpu_count()}')"

# 워커 수 조정
python scripts/local_yolo_training.py --workers 4
```

## 🚀 배포 체크리스트

### 설치 전 확인사항
- [ ] Python 3.8+ 설치됨
- [ ] 충분한 저장공간 확보 (50GB 권장)
- [ ] GPU 드라이버 설치 (GPU 사용 시)
- [ ] 인터넷 연결 확인

### 설치 후 확인사항
- [ ] 모든 패키지 설치 완료
- [ ] 디렉토리 구조 생성됨
- [ ] .env 파일 설정 완료
- [ ] 테스트 데이터셋 생성됨
- [ ] 간단한 학습 테스트 성공

### 운영 환경 확인사항
- [ ] Supabase 연결 정상
- [ ] 실제 데이터셋 준비됨
- [ ] 학습 스크립트 정상 작동
- [ ] 대시보드 접속 가능
- [ ] 모델 업로드 정상

## 📞 지원 및 문의

### 자주 묻는 질문
1. **Q: GPU가 없어도 학습이 가능한가요?**
   A: 네, CPU로도 학습이 가능하지만 시간이 더 오래 걸립니다.

2. **Q: 메모리가 부족하면 어떻게 하나요?**
   A: 배치 크기와 이미지 크기를 줄여서 메모리 사용량을 줄일 수 있습니다.

3. **Q: 학습이 중단되면 어떻게 하나요?**
   A: `--resume` 옵션을 사용하여 중단된 지점부터 재개할 수 있습니다.

### 문제 신고
- GitHub Issues: [링크]
- 이메일: support@brickbox.com
- Discord: [링크]

---
🎉 즐거운 BrickBox 학습 되세요!
