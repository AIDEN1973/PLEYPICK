#!/bin/bash
echo "🧱 BrickBox 로컬 학습 환경 자동 설치"
echo "================================================"
echo

# Python 설치 확인
if command -v python3 &> /dev/null; then
    echo "✅ Python이 설치되어 있습니다"
    python3 --version
else
    echo "❌ Python이 설치되지 않았습니다"
    echo
    echo "📥 Python 설치 방법:"
    echo "Ubuntu/Debian: sudo apt update && sudo apt install python3 python3-pip"
    echo "CentOS/RHEL: sudo yum install python3 python3-pip"
    echo "macOS: brew install python3"
    echo "또는 https://www.python.org/downloads/ 에서 다운로드"
    echo
    exit 1
fi

# pip 업그레이드
echo "📦 pip 업그레이드 중..."
python3 -m pip install --upgrade pip --user

echo
echo "📦 필수 패키지 설치 중..."
echo

# 필수 패키지 설치
echo "🔧 YOLO 및 머신러닝 패키지 설치..."
python3 -m pip install --user ultralytics torch torchvision

echo "🔧 데이터 처리 패키지 설치..."
python3 -m pip install --user pandas numpy matplotlib seaborn

echo "🔧 이미지 처리 패키지 설치..."
python3 -m pip install --user opencv-python pillow

echo "🔧 데이터베이스 패키지 설치..."
python3 -m pip install --user supabase pyyaml

echo "🔧 기타 유틸리티 설치..."
python3 -m pip install --user requests scipy

echo
echo "📁 디렉토리 구조 생성 중..."
python3 -c "
import os
os.makedirs('data/synthetic', exist_ok=True)
os.makedirs('data/ldraw', exist_ok=True)
os.makedirs('data/parts', exist_ok=True)
os.makedirs('data/materials', exist_ok=True)
os.makedirs('data/colors', exist_ok=True)
os.makedirs('runs/train', exist_ok=True)
os.makedirs('runs/val', exist_ok=True)
os.makedirs('runs/predict', exist_ok=True)
os.makedirs('models', exist_ok=True)
os.makedirs('logs', exist_ok=True)
print('✅ 디렉토리 구조 생성 완료')
"

echo
echo "⚙️ 설정 파일 생성 중..."

# 환경 설정 파일 생성
cat > .env.example << EOF
# BrickBox 로컬 학습 환경 설정
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
EOF

echo "✅ .env.example 파일 생성 완료"

# 테스트 데이터셋 생성 제거됨

echo
echo "🎉 로컬 학습 환경 설치 완료!"
echo
echo "📋 다음 단계:"
echo "1. .env.example 파일을 .env로 복사하고 Supabase 정보를 입력하세요"
echo "2. 실제 데이터를 data/synthetic/ 폴더에 준비하세요"
echo "3. 다음 명령어로 학습을 시작하세요:"
echo "   python3 scripts/local_yolo_training.py --set_num 76917 --epochs 100"
echo
echo "💡 또는 대시보드에서 '학습 시작' 버튼을 클릭하세요!"
echo
