#!/usr/bin/env python3
"""
🧱 BrickBox 로컬 학습 환경 빠른 설정
다른 PC에서 쉽게 환경을 설정할 수 있는 원클릭 스크립트
"""

import os
import sys
import subprocess
import platform
from pathlib import Path

def run_command(command, description=""):
    """명령어 실행 및 결과 확인"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} 완료")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} 실패: {e}")
        return False

def check_python():
    """Python 설치 확인"""
    print("🐍 Python 설치 확인 중...")
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8 이상이 필요합니다.")
        print("📥 Python 설치: https://www.python.org/downloads/")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} 확인됨")
    return True

def install_packages():
    """필수 패키지 설치"""
    packages = [
        "ultralytics",
        "torch",
        "torchvision", 
        "supabase",
        "pyyaml",
        "opencv-python",
        "pillow",
        "matplotlib",
        "seaborn",
        "pandas",
        "numpy",
        "requests",
        "scipy"
    ]
    
    print("📦 필수 패키지 설치 중...")
    for package in packages:
        if not run_command(f"pip install --user {package}", f"{package} 설치"):
            print(f"⚠️ {package} 설치 실패, 계속 진행...")
    
    return True

def create_directories():
    """필요한 디렉토리 생성"""
    print("📁 디렉토리 구조 생성 중...")
    
    directories = [
        "data/synthetic",
        "data/ldraw", 
        "data/parts",
        "data/materials",
        "data/colors",
        "runs/train",
        "runs/val",
        "runs/predict",
        "models",
        "logs"
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"✅ {directory} 생성")
    
    return True

def create_config_files():
    """설정 파일 생성"""
    print("⚙️ 설정 파일 생성 중...")
    
    # .env.example 파일
    env_content = """# BrickBox 로컬 학습 환경 설정
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# 로컬 학습 설정
LOCAL_TRAINING_ENABLED=true
DEFAULT_DEVICE=auto
DEFAULT_EPOCHS=100
DEFAULT_BATCH_SIZE=16
DEFAULT_IMG_SIZE=640

# GPU 설정
CUDA_VISIBLE_DEVICES=0
"""
    
    with open(".env.example", "w", encoding="utf-8") as f:
        f.write(env_content)
    print("✅ .env.example 생성")
    
    # 학습 설정 파일
    config_content = """# 로컬 학습 설정
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
    
  # 데이터셋 설정
  dataset:
    path: "data/synthetic"
    train_split: 0.8
    val_split: 0.1
    test_split: 0.1
    
  # 모델 설정
  model:
    architecture: "yolo11n"
    pretrained: true
    freeze_backbone: false
    
  # 최적화 설정
  optimization:
    learning_rate: 0.01
    weight_decay: 0.0005
    momentum: 0.937
    scheduler: "cosine"
"""
    
    with open("local_training_config.yaml", "w", encoding="utf-8") as f:
        f.write(config_content)
    print("✅ local_training_config.yaml 생성")
    
    return True

# 테스트 데이터셋 생성 함수 제거됨
    
    return True

def create_quick_start_guide():
    """빠른 시작 가이드 생성"""
    guide_content = """# 🧱 BrickBox 로컬 학습 빠른 시작 가이드

## 🚀 즉시 시작하기

### 1. 환경 설정 (완료됨)
✅ Python 설치 확인
✅ 필수 패키지 설치
✅ 디렉토리 구조 생성
✅ 설정 파일 생성

### 2. Supabase 설정
```bash
# .env.example을 .env로 복사
cp .env.example .env

# .env 파일을 편집하여 Supabase 정보 입력
# VITE_SUPABASE_URL=your_actual_supabase_url
# VITE_SUPABASE_ANON_KEY=your_actual_supabase_key
```

### 3. 학습 시작

#### 방법 A: 대시보드 사용 (권장)
1. 브라우저에서 BrickBox 대시보드 열기
2. "자동화된 학습" 탭 클릭
3. 세트 번호 입력 (예: 76917)
4. "학습 시작" 버튼 클릭
5. 터미널에서 제공된 명령어 실행

#### 방법 B: 직접 실행
```bash
# 실제 학습
python scripts/local_yolo_training.py --set_num 76917 --epochs 100 --batch_size 16

# 본격적인 학습 (2-3시간)
python scripts/local_yolo_training.py --set_num 76917 --epochs 100 --batch_size 16
```

## 📊 시스템 요구사항

### 최소 요구사항
- Python 3.8+
- 8GB RAM
- 10GB 저장공간

### 권장 요구사항  
- NVIDIA GPU (CUDA 지원)
- 16GB RAM
- 50GB 저장공간

## 🔧 문제 해결

### 패키지 설치 오류
```bash
# 권한 문제 시
pip install --user package_name

# 가상환경 사용
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 또는
venv\\Scripts\\activate  # Windows
```

### GPU 사용 불가
- NVIDIA 드라이버 설치 확인
- CUDA 설치 확인
- PyTorch CUDA 버전 설치

## 📞 지원

문제가 발생하면:
1. 로그 파일 확인: training.log
2. 시스템 요구사항 확인
3. GitHub Issues에 문의

---
🎉 즐거운 학습 되세요!
"""
    
    with open("QUICK_START.md", "w", encoding="utf-8") as f:
        f.write(guide_content)
    print("✅ QUICK_START.md 생성")
    
    return True

def main():
    """메인 설정 함수"""
    print("🧱 BrickBox 로컬 학습 환경 빠른 설정")
    print("=" * 50)
    
    # 1. Python 확인
    if not check_python():
        return False
    
    # 2. 패키지 설치
    if not install_packages():
        print("⚠️ 일부 패키지 설치에 실패했지만 계속 진행합니다")
    
    # 3. 디렉토리 생성
    if not create_directories():
        return False
    
    # 4. 설정 파일 생성
    if not create_config_files():
        return False
    
    # 5. 테스트 데이터셋 생성 제거됨
    
    # 6. 빠른 시작 가이드 생성
    create_quick_start_guide()
    
    print("=" * 50)
    print("🎉 로컬 학습 환경 설정 완료!")
    print()
    print("📋 다음 단계:")
    print("1. .env.example을 .env로 복사하고 Supabase 정보 입력")
    print("2. 실제 데이터를 data/synthetic/ 폴더에 준비")
    print("3. 대시보드에서 '학습 시작' 클릭 또는 직접 실행")
    print()
    print("📖 자세한 가이드: QUICK_START.md 파일을 확인하세요")
    print("💡 도움이 필요하면 GitHub Issues에 문의하세요!")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
