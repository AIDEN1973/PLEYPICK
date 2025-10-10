@echo off
echo 📊 BrickBox 로컬 PC GPU 모니터링 (RTX 2070 SUPER)
echo ================================================

echo.
echo 🔍 GPU 상태 모니터링 시작...
echo    - GPU 사용률, 메모리 사용량, 온도 확인
echo    - 1초마다 업데이트
echo    - Ctrl+C로 종료
echo.

nvidia-smi -l 1

pause
