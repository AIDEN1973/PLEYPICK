@echo off
chcp 65001 >nul
echo 🚀 모든 부품 이미지를 Supabase Storage로 마이그레이션
echo =====================================================

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python이 설치되지 않았습니다.
    echo    Python을 설치하고 다시 시도해주세요.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ❌ .env 파일을 찾을 수 없습니다.
    echo    환경 변수를 설정하고 다시 시도해주세요.
    pause
    exit /b 1
)

REM Check if required packages are installed
echo 📦 필요한 패키지 확인 중...
python -c "import supabase, requests, PIL" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 필요한 패키지가 설치되지 않았습니다.
    echo    다음 명령어로 설치해주세요:
    echo    pip install supabase requests pillow
    pause
    exit /b 1
)

echo ✅ 환경 확인 완료
echo.

REM Run migration script
echo 🔄 마이그레이션 스크립트 실행 중...
python scripts\migrate_all_images_to_supabase.py

if %errorlevel% neq 0 (
    echo ❌ 마이그레이션 실패
    pause
    exit /b 1
)

echo.
echo ✅ 마이그레이션 완료!
echo 📄 상세 로그는 migration_log_*.json 파일을 확인하세요.
echo.
pause
