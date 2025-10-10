@echo off
chcp 65001 >nul
echo Adding webp_image_url column to lego_sets table...
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
    pip install supabase python-dotenv
)

REM Run SQL Script
echo Adding webp_image_url column...
python -c "
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('VITE_SUPABASE_URL'), os.getenv('VITE_SUPABASE_ANON_KEY'))

# Read SQL file
with open('scripts/add_webp_column.sql', 'r', encoding='utf-8') as f:
    sql_content = f.read()

# Execute SQL
result = supabase.rpc('exec_sql', {'sql': sql_content})
print('SQL execution result:', result)
"

echo.
echo Column addition completed!
pause
