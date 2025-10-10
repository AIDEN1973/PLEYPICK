@echo off
echo 🚀 BrickBox 드래그 앤 드롭 업로드
echo =====================================

echo.
echo 📋 사용법:
echo    1. 이 배치 파일을 실행
echo    2. 업로드할 폴더를 이 창에 드래그 앤 드롭
echo    3. Enter 키를 눌러 업로드 시작
echo.

:input_loop
echo 📁 업로드할 폴더 경로를 입력하거나 드래그 앤 드롭하세요:
set /p folder_path="폴더 경로: "

if "%folder_path%"=="" (
    echo ❌ 폴더 경로가 입력되지 않았습니다.
    goto input_loop
)

if not exist "%folder_path%" (
    echo ❌ 폴더가 존재하지 않습니다: %folder_path%
    goto input_loop
)

echo.
echo 📊 폴더 확인: %folder_path%
echo.

:options_menu
echo 📋 업로드 옵션을 선택하세요:
echo    1. 기본 업로드 (폴더명으로 업로드)
echo    2. 데이터베이스 동기화 포함
echo    3. Part ID 지정 업로드
echo    4. 취소
echo.
set /p choice="선택 (1-4): "

if "%choice%"=="1" (
    echo 🚀 기본 업로드 시작...
    python scripts\manual_upload_supabase.py "%folder_path%"
    goto end
)

if "%choice%"=="2" (
    echo 🚀 데이터베이스 동기화 포함 업로드 시작...
    python scripts\manual_upload_supabase.py "%folder_path%" --sync-db
    goto end
)

if "%choice%"=="3" (
    set /p part_id="Part ID를 입력하세요: "
    if "%part_id%"=="" (
        echo ❌ Part ID가 입력되지 않았습니다.
        goto options_menu
    )
    echo 🚀 Part ID 지정 업로드 시작...
    python scripts\manual_upload_supabase.py "%folder_path%" --sync-db --part-id %part_id%
    goto end
)

if "%choice%"=="4" (
    echo ❌ 업로드가 취소되었습니다.
    goto end
)

echo ❌ 잘못된 선택입니다.
goto options_menu

:end
echo.
echo ✅ 작업 완료!
echo.
pause
