@echo off
echo 🚀 BrickBox 로컬 GPU 학습 환경 설정 (RTX 2070 SUPER 최적화)
echo ========================================================

echo.
echo 📋 1단계: 기존 PyTorch 제거
pip uninstall torch torchvision torchaudio -y

echo.
echo 📦 2단계: CUDA 지원 PyTorch 설치 (RTX 2070 SUPER 최적화)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

echo.
echo 🧱 3단계: BrickBox 학습 패키지 설치
pip install ultralytics
pip install opencv-python
pip install matplotlib
pip install seaborn
pip install pandas
pip install numpy
pip install pillow
pip install supabase
pip install python-dotenv
pip install tqdm
pip install onnxruntime
pip install pyyaml
pip install requests

echo.
echo 🔧 4단계: RTX 2070 SUPER GPU 설정 확인
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}'); print(f'GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB' if torch.cuda.is_available() else 'N/A')"

echo.
echo ✅ RTX 2070 SUPER 로컬 GPU 학습 환경 설정 완료!
echo.
echo 🚀 사용법:
echo    python scripts/local_gpu_trainer.py data/brickbox_dataset/dataset.yaml n
echo.
echo 📊 모니터링:
echo    nvidia-smi -l 1
echo.
echo 💻 RTX 2070 SUPER 최적화 설정:
echo    - 배치 크기: 16 (8GB VRAM)
echo    - 이미지 크기: 640x640
echo    - 에포크: 100
echo.
pause
