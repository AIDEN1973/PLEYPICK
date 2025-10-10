@echo off
echo 🚀 BrickBox 로컬 PC 학습 실행 (RTX 2070 SUPER 최적화)
echo ========================================================

echo.
echo 📋 1단계: 환경 설정 확인
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}'); print(f'GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB' if torch.cuda.is_available() else 'N/A')"

echo.
echo 📦 2단계: 데이터셋 확인
if not exist "data\brickbox_dataset\dataset.yaml" (
    echo ❌ 데이터셋 파일이 없습니다. 먼저 노트북을 실행하여 데이터를 준비하세요.
    pause
    exit /b 1
)

echo ✅ 데이터셋 파일 확인됨: data\brickbox_dataset\dataset.yaml

echo.
echo 🚀 3단계: 로컬 PC 학습 시작 (RTX 2070 SUPER 최적화)
echo    - 모델: YOLO11n (가장 가벼움)
echo    - 배치 크기: 16 (8GB VRAM 최적화)
echo    - 이미지 크기: 640x640
echo    - 에포크: 100

python scripts/local_gpu_trainer.py data/brickbox_dataset/dataset.yaml n

echo.
echo ✅ 로컬 PC 학습 완료!
echo 📊 결과 확인: output/local_training/
echo.
pause
