@echo off
echo 🖼️ 세트 WebP 메타데이터 생성 시작...
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
python -c "import supabase" 2>nul
if errorlevel 1 (
    echo 📦 필요한 패키지 설치 중...
    pip install supabase python-dotenv
)

REM SQL 파일 실행
echo 🔄 WebP 메타데이터 생성 중...
echo.
echo ⚠️  주의: Supabase URL을 실제 프로젝트 URL로 변경하세요!
echo.
echo SQL 파일을 Supabase SQL Editor에서 실행하세요:
echo scripts\create_set_webp_metadata.sql
echo.

pause
