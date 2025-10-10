@echo off
echo 🚀 기존 레고 세트 WebP 변환 시작...
echo.

REM Python 가상환경 활성화
if exist "venv\Scripts\activate.bat" (
    echo 📦 가상환경 활성화 중...
    call venv\Scripts\activate.bat
) else (
    echo ⚠️ 가상환경이 없습니다. 시스템 Python을 사용합니다.
)

REM 필요한 패키지 설치 확인
echo 📋 필요한 패키지 확인 중...
python -c "import supabase, aiohttp, PIL" 2>nul
if errorlevel 1 (
    echo 📦 필요한 패키지 설치 중...
    pip install supabase aiohttp pillow python-dotenv
)

REM WebP 변환 스크립트 실행
echo 🔄 WebP 변환 스크립트 실행 중...
python scripts\convert_existing_sets_to_webp.py

echo.
echo ✅ 변환 완료!
pause
