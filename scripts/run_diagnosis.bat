@echo off
echo 🔍 BrickBox 업로드 문제 진단
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
echo 📁 2단계: 로컬 output 폴더 확인
if not exist "output\renders" (
    echo ❌ 로컬 output 폴더가 없습니다: output\renders
    echo    먼저 렌더링 작업을 실행하세요.
    pause
    exit /b 1
)

echo ✅ 로컬 output 폴더 확인됨: output\renders

echo.
echo 🔍 3단계: 업로드 문제 진단 실행
python scripts\diagnose_upload_issue.py output\renders

if %errorlevel% neq 0 (
    echo ❌ 진단 실행 실패
    pause
    exit /b 1
)

echo.
echo ✅ 진단 완료!
echo 📄 상세 리포트: upload_diagnosis_YYYYMMDD_HHMMSS.json
echo.
pause
