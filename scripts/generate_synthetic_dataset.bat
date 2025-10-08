@echo off
echo 🧱 BrickBox 합성 데이터셋 생성기
echo.

REM 환경 변수 로드
for /f "usebackq tokens=1,2 delims==" %%a in ("config/synthetic_dataset.env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

REM Python 스크립트 실행
python scripts/render_ldraw_to_supabase.py --part-id 3001 --count 10

pause
