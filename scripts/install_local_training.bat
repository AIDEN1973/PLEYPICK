@echo off
echo 🧱 BrickBox 로컬 학습 환경 자동 설치
echo ================================================
echo.

REM 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ 관리자 권한 확인됨
) else (
    echo ⚠️ 관리자 권한이 필요할 수 있습니다
    echo    일부 패키지 설치 시 권한 문제가 발생할 수 있습니다
)

REM Python 설치 확인
python --version >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Python이 설치되어 있습니다
    python --version
) else (
    echo ❌ Python이 설치되지 않았습니다
    echo.
    echo 📥 Python 설치 방법:
    echo 1. https://www.python.org/downloads/ 방문
    echo 2. "Download Python 3.13.x" 클릭
    echo 3. 설치 시 "Add Python to PATH" 체크박스 선택
    echo 4. 설치 완료 후 이 스크립트를 다시 실행하세요
    echo.
    pause
    exit /b 1
)

echo.
echo 📦 필수 패키지 설치 중...
echo.

REM pip 업그레이드
python -m pip install --upgrade pip

REM 필수 패키지 설치 (권한 문제 시 --user 옵션 사용)
echo 🔧 YOLO 및 머신러닝 패키지 설치...
python -m pip install --user ultralytics torch torchvision

echo 🔧 데이터 처리 패키지 설치...
python -m pip install --user pandas numpy matplotlib seaborn

echo 🔧 이미지 처리 패키지 설치...
python -m pip install --user opencv-python pillow

echo 🔧 데이터베이스 패키지 설치...
python -m pip install --user supabase pyyaml

echo 🔧 기타 유틸리티 설치...
python -m pip install --user requests scipy

echo.
echo 📁 디렉토리 구조 생성 중...
python -c "import os; os.makedirs('data/synthetic', exist_ok=True); os.makedirs('data/ldraw', exist_ok=True); os.makedirs('data/parts', exist_ok=True); os.makedirs('data/materials', exist_ok=True); os.makedirs('data/colors', exist_ok=True); os.makedirs('runs/train', exist_ok=True); os.makedirs('runs/val', exist_ok=True); os.makedirs('runs/predict', exist_ok=True); os.makedirs('models', exist_ok=True); os.makedirs('logs', exist_ok=True); print('✅ 디렉토리 구조 생성 완료')"

echo.
echo ⚙️ 설정 파일 생성 중...

REM 환경 설정 파일 생성
echo # BrickBox 로컬 학습 환경 설정 > .env.example
echo VITE_SUPABASE_URL=your_supabase_url_here >> .env.example
echo VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here >> .env.example
echo. >> .env.example
echo # 로컬 학습 설정 >> .env.example
echo LOCAL_TRAINING_ENABLED=true >> .env.example
echo DEFAULT_DEVICE=auto >> .env.example
echo DEFAULT_EPOCHS=100 >> .env.example
echo DEFAULT_BATCH_SIZE=16 >> .env.example
echo DEFAULT_IMG_SIZE=640 >> .env.example
echo. >> .env.example
echo # GPU 설정 >> .env.example
echo CUDA_VISIBLE_DEVICES=0 >> .env.example

echo ✅ .env.example 파일 생성 완료

REM 테스트 데이터셋 생성 제거됨

echo.
echo 🎉 로컬 학습 환경 설치 완료!
echo.
echo 📋 다음 단계:
echo 1. .env.example 파일을 .env로 복사하고 Supabase 정보를 입력하세요
echo 2. 실제 데이터를 data/synthetic/ 폴더에 준비하세요
echo 3. 다음 명령어로 학습을 시작하세요:
echo    python scripts/local_yolo_training.py --set_num 76917 --epochs 100
echo.
echo 💡 또는 대시보드에서 '학습 시작' 버튼을 클릭하세요!
echo.
pause
