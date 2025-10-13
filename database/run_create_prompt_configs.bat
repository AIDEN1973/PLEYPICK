@echo off
REM ================================================
REM 메타데이터 프롬프트 설정 테이블 생성 스크립트
REM ================================================

echo 🚀 메타데이터 프롬프트 설정 테이블 생성 시작...
echo.

REM Supabase 연결 정보 확인
if "%SUPABASE_DB_URL%"=="" (
    echo ❌ 오류: SUPABASE_DB_URL 환경 변수가 설정되지 않았습니다.
    echo.
    echo 다음 명령으로 설정하세요:
    echo set SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
    pause
    exit /b 1
)

echo ✅ Supabase 연결 정보 확인 완료
echo.

REM SQL 파일 실행
echo 📝 SQL 스크립트 실행 중...
psql %SUPABASE_DB_URL% -f "%~dp0create_metadata_prompt_configs_table.sql"

if %errorlevel% neq 0 (
    echo.
    echo ❌ 오류: SQL 스크립트 실행 실패
    pause
    exit /b 1
)

echo.
echo ✅ 메타데이터 프롬프트 설정 테이블 생성 완료!
echo.
echo 📊 테이블 확인:
psql %SUPABASE_DB_URL% -c "SELECT id, version, llm_model, llm_temperature, llm_max_tokens FROM metadata_prompt_configs WHERE is_active = true;"

echo.
echo 📦 프리셋 확인:
psql %SUPABASE_DB_URL% -c "SELECT name, description, tags FROM metadata_prompt_presets WHERE is_public = true;"

echo.
echo 🎉 설정 완료! 이제 http://localhost:5173/metadata-prompt-editor 에서 사용하세요.
pause

