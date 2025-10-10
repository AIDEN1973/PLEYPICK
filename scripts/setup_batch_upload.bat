@echo off
echo 🚀 BrickBox 일괄 업로드 환경 설정
echo =====================================

echo.
echo 📋 1단계: 기존 렌더링 스크립트 백업
if exist "scripts\render_ldraw_to_supabase.py" (
    if not exist "scripts\render_ldraw_to_supabase.py.backup" (
        copy "scripts\render_ldraw_to_supabase.py" "scripts\render_ldraw_to_supabase.py.backup"
        echo ✅ 원본 스크립트 백업 생성
    ) else (
        echo ✅ 백업 파일이 이미 존재합니다
    )
) else (
    echo ❌ 렌더링 스크립트를 찾을 수 없습니다
    pause
    exit /b 1
)

echo.
echo 🔧 2단계: 렌더링 스크립트 수정
python scripts\modify_render_script.py
if %errorlevel% neq 0 (
    echo ❌ 스크립트 수정 실패
    pause
    exit /b 1
)

echo.
echo 📦 3단계: 일괄 업로드 의존성 설치
pip install supabase
pip install requests
pip install tqdm

echo.
echo 📁 4단계: 디렉토리 구조 생성
if not exist "output\renders" mkdir output\renders
if not exist "output\backup" mkdir output\backup

echo.
echo ✅ 일괄 업로드 환경 설정 완료!
echo.
echo 📋 사용 방법:
echo    1. 렌더링 실행: python scripts/render_ldraw_to_supabase.py ...
echo    2. 일괄 업로드: scripts\run_batch_upload.bat
echo    3. 수동 업로드: python scripts/batch_upload_renderings.py output/renders
echo.
echo 💡 장점:
echo    - 네트워크 오류 시 재시도 가능
echo    - 렌더링 속도 향상 (업로드 지연 없음)
echo    - 중복 업로드 방지
echo    - 백업 자동 생성
echo.
pause
