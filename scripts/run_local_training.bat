@echo off
echo 🧱 BrickBox 로컬 YOLO 학습 시작
echo.

REM 환경 변수 설정
set PYTHONPATH=%CD%
set CUDA_VISIBLE_DEVICES=0

REM Python 가상환경 활성화 (있는 경우)
if exist "venv\Scripts\activate.bat" (
    echo 📦 가상환경 활성화 중...
    call venv\Scripts\activate.bat
)

REM 필수 패키지 설치 확인
echo 🔍 필수 패키지 확인 중...
python -c "import ultralytics, torch, supabase" 2>nul
if errorlevel 1 (
    echo ⚠️ 필수 패키지가 설치되지 않았습니다. 설치를 시작합니다...
    pip install ultralytics torch torchvision supabase pyyaml
    if errorlevel 1 (
        echo ❌ 패키지 설치 실패!
        pause
        exit /b 1
    )
)

REM 환경 변수 로드
if exist ".env" (
    echo 📋 환경 변수 로드 중...
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        set %%a=%%b
    )
)

REM 학습 실행
echo 🚀 로컬 YOLO 학습 시작...
python scripts\local_yolo_training.py ^
    --set_num %1 ^
    --epochs %2 ^
    --batch_size %3 ^
    --imgsz %4 ^
    --device auto

if errorlevel 1 (
    echo ❌ 학습 실패!
    pause
    exit /b 1
) else (
    echo ✅ 학습 완료!
)

pause