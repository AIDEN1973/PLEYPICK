@echo off
chcp 65001 >nul
echo BrickBox Integrated Upload Tools
echo =====================================

echo.
echo Available Tools:
echo    1. Quick Drag and Drop Upload
echo    2. Options-based Upload
echo    3. Check Duplicate Files
echo    4. Auto Diagnosis (Integrated)
echo    5. Batch Upload
echo    6. Safe Upload
echo    7. Exit
echo.

:menu
set /p choice="Select option (1-7): "

if "%choice%"=="1" (
    echo.
    echo Quick Drag and Drop Upload
    echo =====================================
    scripts\quick_upload.bat
    goto menu
)

if "%choice%"=="2" (
    echo.
    echo Options-based Upload
    echo =====================================
    scripts\drag_drop_upload.bat
    goto menu
)

if "%choice%"=="3" (
    echo.
    echo Check Duplicate Files
    echo =====================================
    set /p folder_path="Enter folder path to check: "
    if "%folder_path%"=="" (
        echo Folder path not entered.
        goto menu
    )
    python scripts\check_duplicates.py "%folder_path%"
    pause
    goto menu
)

if "%choice%"=="4" (
    echo.
    echo Auto Diagnosis (Integrated)
    echo =====================================
    echo Step 1: Environment Check
    python -c "import supabase; print('Supabase library confirmed')"
    if %errorlevel% neq 0 (
        echo Supabase library not installed.
        echo Run: pip install supabase
        pause
        goto menu
    )
    
    echo.
    echo Step 2: Local output folder check
    if not exist "output\synthetic" (
        echo Local output folder not found: output\synthetic
        echo Run rendering process first.
        pause
        goto menu
    )
    
    echo Local output folder confirmed: output\synthetic
    
    echo.
    echo Step 3: Upload issue diagnosis
    python scripts\diagnose_upload_issue.py output\synthetic
    
    if %errorlevel% neq 0 (
        echo Diagnosis failed
        pause
        goto menu
    )
    
    echo.
    echo Diagnosis completed!
    echo Detailed report: upload_diagnosis_YYYYMMDD_HHMMSS.json
    echo.
    pause
    goto menu
)

if "%choice%"=="5" (
    echo.
    echo Batch Upload
    echo =====================================
    scripts\run_batch_upload.bat
    goto menu
)

if "%choice%"=="6" (
    echo.
    echo Safe Upload
    echo =====================================
    set /p folder_path="Enter folder path to upload: "
    if "%folder_path%"=="" (
        echo Folder path not entered.
        goto menu
    )
    python scripts\safe_upload_supabase.py "%folder_path%"
    pause
    goto menu
)

if "%choice%"=="7" (
    echo.
    echo Goodbye!
    exit /b 0
)

echo Invalid selection. Please choose 1-7.
goto menu