@echo off
echo 🚀 BrickBox 빠른 업로드 (드래그 앤 드롭)
echo =====================================

echo.
echo 📋 사용법:
echo    1. 업로드할 폴더를 이 창에 드래그 앤 드롭
echo    2. 자동으로 업로드 시작
echo.

:upload_loop
echo 📁 업로드할 폴더를 드래그 앤 드롭하세요 (또는 경로 입력):
set /p folder_path=""

if "%folder_path%"=="" (
    echo ❌ 폴더가 선택되지 않았습니다.
    goto upload_loop
)

REM 따옴표 제거 (드래그 앤 드롭 시 자동으로 추가됨)
set folder_path=%folder_path:"=%

if not exist "%folder_path%" (
    echo ❌ 폴더가 존재하지 않습니다: %folder_path%
    goto upload_loop
)

echo.
echo 📊 업로드할 폴더: %folder_path%
echo.

REM 폴더 내 파일 개수 확인
set file_count=0
for /f %%i in ('dir "%folder_path%" /s /b ^| find /c /v ""') do set file_count=%%i

echo 📊 파일 개수: %file_count%개
echo.

echo 🚀 업로드 시작...
python scripts\manual_upload_supabase.py "%folder_path%"

if %errorlevel% neq 0 (
    echo ❌ 업로드 실패
    pause
    goto upload_loop
)

echo.
echo ✅ 업로드 완료!
echo.

REM 계속 업로드 여부 확인
echo 🔄 다른 폴더도 업로드하시겠습니까? (Y/N)
set /p continue="계속: "

if /i "%continue%"=="Y" (
    echo.
    goto upload_loop
)

echo.
echo 🎉 모든 업로드 완료!
echo.
pause
