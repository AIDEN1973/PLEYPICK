@echo off
chcp 65001 >nul
echo WebP File Path Fix Starting...
echo.

REM Python Virtual Environment Activation
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo Virtual environment not found. Using system Python.
)

REM Check Required Packages
echo Checking required packages...
python -c "import supabase" 2>nul
if errorlevel 1 (
    echo Installing required packages...
    pip install supabase aiohttp python-dotenv
)

REM Run WebP Path Fix Script
echo Running WebP path fix script...
cd /d "%~dp0.."
python scripts\fix_webp_storage_path.py

echo.
echo Path fix completed!
pause
