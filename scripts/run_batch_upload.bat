@echo off
echo 🚀 BrickBox 렌더링 일괄 업로드 실행
echo =====================================

echo.
echo 📋 1단계: 환경 확인
python -c "import supabase; print('✅ Supabase 라이브러리 확인됨')"
if %errorlevel% neq 0 (
    echo ❌ Supabase 라이브러리가 설치되지 않았습니다.
    echo    pip install supabase
    pause
    exit /b 1
)

echo.
echo 📁 2단계: 로컬 렌더링 폴더 확인
if not exist "output\renders" (
    echo ❌ 로컬 렌더링 폴더가 없습니다: output\renders
    echo    먼저 렌더링 작업을 실행하세요.
    pause
    exit /b 1
)

echo ✅ 로컬 렌더링 폴더 확인됨: output\renders

echo.
echo 🚀 3단계: 일괄 업로드 실행
echo    - 소스: output\renders
echo    - 배치 크기: 10개씩
echo    - 중복 확인: 활성화
echo    - 백업: 활성화

python scripts\batch_upload_renderings.py output\renders --batch-size 10

if %errorlevel% neq 0 (
    echo ❌ 일괄 업로드 실패
    pause
    exit /b 1
)

echo.
echo ✅ 일괄 업로드 완료!
echo 📊 결과 확인: Supabase synthetic_dataset 테이블
echo 📦 백업 폴더: output\backup_YYYYMMDD_HHMMSS
echo.
pause
