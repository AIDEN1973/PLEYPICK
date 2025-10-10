@echo off
REM 🧱 BrickBox 매장별 모델 배포 스크립트
REM 사용법: deploy-to-stores.bat [모델버전] [배포전략] [대상매장]

setlocal enabledelayedexpansion

REM 매개변수 확인
if "%1"=="" (
    echo ❌ 사용법: deploy-to-stores.bat [모델버전] [배포전략] [대상매장]
    echo    예시: deploy-to-stores.bat v1.3.0 gradual all
    echo    예시: deploy-to-stores.bat v1.3.0 immediate store_001,store_002
    exit /b 1
)

set MODEL_VERSION=%1
set DEPLOYMENT_STRATEGY=%2
set TARGET_STORES=%3

if "%DEPLOYMENT_STRATEGY%"=="" set DEPLOYMENT_STRATEGY=gradual
if "%TARGET_STORES%"=="" set TARGET_STORES=all

echo 🚀 BrickBox 매장 배포 시작
echo 📦 모델 버전: %MODEL_VERSION%
echo 🎯 배포 전략: %DEPLOYMENT_STRATEGY%
echo 🏪 대상 매장: %TARGET_STORES%
echo.

REM 중앙 서버 URL 확인
set CENTRAL_SERVER_URL=http://localhost:3002
if "%BRICKBOX_CENTRAL_URL%" neq "" set CENTRAL_SERVER_URL=%BRICKBOX_CENTRAL_URL%

echo 🔍 중앙 서버 연결 확인: %CENTRAL_SERVER_URL%

REM 중앙 서버 연결 테스트
curl -s -f "%CENTRAL_SERVER_URL%/api/health" >nul 2>&1
if errorlevel 1 (
    echo ❌ 중앙 서버 연결 실패: %CENTRAL_SERVER_URL%
    echo 💡 중앙 서버가 실행 중인지 확인하세요
    exit /b 1
)

echo ✅ 중앙 서버 연결 성공

REM 배포 요청 전송
echo 📤 배포 요청 전송 중...

if "%TARGET_STORES%"=="all" (
    REM 전체 매장 배포
    curl -X POST "%CENTRAL_SERVER_URL%/api/stores/deploy-all" ^
        -H "Content-Type: application/json" ^
        -d "{\"modelVersion\":\"%MODEL_VERSION%\",\"deploymentStrategy\":\"%DEPLOYMENT_STRATEGY%\"}" ^
        --silent --show-error
) else (
    REM 특정 매장 배포
    for %%s in (%TARGET_STORES%) do (
        echo 🏪 매장 %%s 배포 중...
        curl -X POST "%CENTRAL_SERVER_URL%/api/stores/%%s/deploy" ^
            -H "Content-Type: application/json" ^
            -d "{\"modelVersion\":\"%MODEL_VERSION%\",\"forceUpdate\":true}" ^
            --silent --show-error
        
        if errorlevel 1 (
            echo ❌ 매장 %%s 배포 실패
        ) else (
            echo ✅ 매장 %%s 배포 완료
        )
        echo.
    )
)

if errorlevel 1 (
    echo ❌ 배포 요청 실패
    exit /b 1
)

echo ✅ 배포 요청 전송 완료

REM 배포 상태 모니터링
echo 📊 배포 상태 모니터링 시작...
echo.

:monitor_loop
timeout /t 10 /nobreak >nul

REM 배포 상태 조회
curl -s "%CENTRAL_SERVER_URL%/api/deployment/status" > temp_deployment_status.json 2>nul

if exist temp_deployment_status.json (
    REM JSON 파싱 (간단한 방법)
    findstr /C:"\"status\":" temp_deployment_status.json >nul
    if errorlevel 1 (
        echo ⏳ 배포 진행 중...
    ) else (
        echo ✅ 배포 완료 확인
        goto deployment_complete
    )
) else (
    echo ⏳ 배포 상태 확인 중...
)

goto monitor_loop

:deployment_complete
echo.
echo 🎉 매장 배포 완료!
echo 📊 배포 결과:
echo    - 모델 버전: %MODEL_VERSION%
echo    - 배포 전략: %DEPLOYMENT_STRATEGY%
echo    - 대상 매장: %TARGET_STORES%
echo.

REM 임시 파일 정리
if exist temp_deployment_status.json del temp_deployment_status.json

echo 💡 다음 단계:
echo    1. 매장별 성능 모니터링
echo    2. 사용자 피드백 수집
echo    3. 필요시 롤백 준비
echo.

endlocal
echo ✅ 배포 스크립트 완료
