@echo off
chcp 65001 >nul
echo 🤖 BrickBox 로컬 PC 자동 모델 배포 시스템
echo =============================================

REM 환경 변수 확인
if not defined VITE_SUPABASE_URL (
    echo ❌ VITE_SUPABASE_URL 환경 변수가 설정되지 않았습니다.
    echo    .env 파일을 확인하세요.
    pause
    exit /b 1
)

if not defined VITE_SUPABASE_SERVICE_ROLE (
    echo ❌ VITE_SUPABASE_SERVICE_ROLE 환경 변수가 설정되지 않았습니다.
    echo    .env 파일을 확인하세요.
    pause
    exit /b 1
)

echo ✅ 환경 변수 확인 완료
echo.

REM 로컬 훈련 결과 확인
echo 🔍 로컬 훈련 결과 확인 중...
if not exist "runs\detect\train" (
    echo ❌ 훈련 결과 폴더가 없습니다: runs\detect\train
    echo    먼저 YOLO 훈련을 실행하세요.
    pause
    exit /b 1
)

echo ✅ 훈련 결과 폴더 확인됨
echo.

REM Python 스크립트 실행
echo 🚀 로컬 자동 배포 시작...
python scripts/local_auto_model_deployment.py

if %errorlevel% neq 0 (
    echo ❌ 로컬 자동 배포 실패
    pause
    exit /b 1
)

echo.
echo ✅ 로컬 자동 배포 완료!
echo 📊 배포 결과는 logs/local_auto_deployment.log에서 확인할 수 있습니다.
echo.
pause
