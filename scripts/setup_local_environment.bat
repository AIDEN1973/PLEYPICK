@echo off
echo 🧱 BrickBox 로컬 학습 환경 설정
echo.

REM Python 버전 확인
python --version
if errorlevel 1 (
    echo ❌ Python이 설치되지 않았습니다.
    echo    Python 3.8 이상을 설치해주세요: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 가상환경 생성 (선택사항)
echo 📦 가상환경 생성 중...
if not exist "venv" (
    python -m venv venv
    echo ✅ 가상환경 생성 완료
) else (
    echo ℹ️ 가상환경이 이미 존재합니다
)

REM 가상환경 활성화
echo 🔄 가상환경 활성화 중...
call venv\Scripts\activate.bat

REM 환경 설정 스크립트 실행
echo 🚀 로컬 학습 환경 설정 시작...
python scripts\setup_local_training.py

if errorlevel 1 (
    echo ❌ 환경 설정 실패!
    pause
    exit /b 1
)

echo.
echo 🎉 로컬 학습 환경 설정 완료!
echo.
echo 📋 다음 단계:
echo 1. .env 파일에서 Supabase 설정을 입력하세요
echo 2. 데이터셋을 data/synthetic/ 디렉토리에 준비하세요
echo 3. 대시보드에서 학습을 시작하거나 다음 명령어를 사용하세요:
echo    python scripts\local_yolo_training.py --set_num 76917
echo.
echo 💡 도움이 필요하면 README_LOCAL_TRAINING.md를 참고하세요!

pause
