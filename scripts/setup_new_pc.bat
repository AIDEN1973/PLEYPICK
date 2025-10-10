@echo off
echo 🚀 BrickBox 새 PC 환경 설정 가이드
echo =====================================

echo.
echo 📋 1단계: Python 환경 확인
python --version
if %errorlevel% neq 0 (
    echo ❌ Python이 설치되지 않았습니다. Python 3.8-3.11을 설치하세요.
    echo    다운로드: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo.
echo 📦 2단계: Git 클론 (처음 설치하는 경우)
if not exist "brickbox" (
    echo 📥 BrickBox 프로젝트 클론 중...
    git clone https://github.com/your-username/brickbox.git
    cd brickbox
) else (
    echo ✅ BrickBox 프로젝트가 이미 존재합니다.
    cd brickbox
)

echo.
echo 🔄 3단계: 최신 코드 동기화
git pull origin main

echo.
echo 📦 4단계: 가상환경 생성 (권장)
python -m venv venv
call venv\Scripts\activate.bat

echo.
echo 🧱 5단계: BrickBox 의존성 설치
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install ultralytics
pip install opencv-python
pip install matplotlib seaborn
pip install pandas numpy
pip install pillow
pip install supabase
pip install python-dotenv
pip install tqdm
pip install onnxruntime
pip install pyyaml
pip install requests

echo.
echo 🔧 6단계: GPU 설정 확인
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}'); print(f'GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB' if torch.cuda.is_available() else 'N/A')"

echo.
echo 📁 7단계: 디렉토리 구조 생성
mkdir data\brickbox_dataset\images 2>nul
mkdir data\brickbox_dataset\labels 2>nul
mkdir output\local_training 2>nul

echo.
echo ✅ 새 PC 환경 설정 완료!
echo.
echo 🚀 사용법:
echo    1. 가상환경 활성화: venv\Scripts\activate.bat
echo    2. 데이터 준비: jupyter notebook scripts/brickbox_yolo_automated_training.ipynb
echo    3. 학습 실행: scripts\run_local_training.bat
echo.
pause
