@echo off
echo 🔄 BrickBox 환경 동기화 (다른 PC에서)
echo =====================================

echo.
echo 📥 1단계: 최신 코드 다운로드
git pull origin main

echo.
echo 📦 2단계: 새로운 의존성 확인 및 설치
pip install --upgrade pip

echo    - PyTorch CUDA 지원 확인
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

echo    - BrickBox 필수 패키지 확인
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
echo 🔧 3단계: GPU 환경 확인
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}'); print(f'GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB' if torch.cuda.is_available() else 'N/A')"

echo.
echo 📁 4단계: 디렉토리 구조 확인
if not exist "data\brickbox_dataset" mkdir data\brickbox_dataset
if not exist "data\brickbox_dataset\images" mkdir data\brickbox_dataset\images
if not exist "data\brickbox_dataset\labels" mkdir data\brickbox_dataset\labels
if not exist "output\local_training" mkdir output\local_training

echo.
echo ✅ 환경 동기화 완료!
echo.
echo 🚀 다음 단계:
echo    1. 데이터 준비: jupyter notebook scripts/brickbox_yolo_automated_training.ipynb
echo    2. 학습 실행: scripts\run_local_training.bat
echo.
pause
