@echo off
chcp 65001 >nul
echo WebP Image Generation Starting...
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
python -c "import supabase, aiohttp, PIL" 2>nul
if errorlevel 1 (
    echo Installing required packages...
    pip install supabase aiohttp pillow python-dotenv
)

REM Run WebP Conversion Script
echo Running WebP conversion script...
cd /d "%~dp0.."
python scripts\generate_existing_webp_images.py

echo.
echo Conversion completed!
pause
