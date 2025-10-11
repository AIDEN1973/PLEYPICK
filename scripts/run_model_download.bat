@echo off
chcp 65001 >nul
echo 🚀 학습된 YOLO 모델 다운로드 가이드
echo =====================================

echo.
echo 📋 Colab에서 모델을 다운로드하는 방법:
echo.
echo 1️⃣ Colab에서 다음 코드를 실행하세요:
echo.
echo    # Google Drive 마운트
echo    from google.colab import drive
echo    drive.mount('/content/drive')
echo.
echo    # 모델 파일을 Drive에 복사
echo    import shutil
echo    shutil.copy('/content/brickbox_yolo/set_76917-1/weights/best.pt', 
echo                '/content/drive/MyDrive/brickbox_models/set_76917-1_best.pt')
echo    shutil.copy('/content/brickbox_yolo/set_76917-1/weights/last.pt', 
echo                '/content/drive/MyDrive/brickbox_models/set_76917-1_last.pt')
echo.
echo    # ONNX 변환
echo    from ultralytics import YOLO
echo    model = YOLO('/content/brickbox_yolo/set_76917-1/weights/best.pt')
echo    model.export(format='onnx', imgsz=640)
echo.
echo    # ONNX 파일도 Drive에 복사
echo    shutil.copy('/content/brickbox_yolo/set_76917-1/weights/best.onnx', 
echo                '/content/drive/MyDrive/brickbox_models/set_76917-1_best.onnx')
echo.
echo 2️⃣ Google Drive에서 파일을 다운로드하세요:
echo    - set_76917-1_best.pt
echo    - set_76917-1_last.pt
echo    - set_76917-1_best.onnx
echo.
echo 3️⃣ 다운로드한 파일을 다음 위치에 저장하세요:
echo    - public/models/set_76917-1_best.pt
echo    - public/models/set_76917-1_last.pt
echo    - public/models/set_76917-1_best.onnx
echo.
echo 4️⃣ 파일 저장 후 다음 명령어로 배포하세요:
echo    python scripts/deploy_trained_model.py
echo.
pause
