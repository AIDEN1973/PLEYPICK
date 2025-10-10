@echo off
REM 🏪 BrickBox 매장 등록 스크립트
REM 사용법: register-store.bat [매장ID] [매장명] [위치] [연락처]

setlocal enabledelayedexpansion

REM 매개변수 확인
if "%1"=="" (
    echo ❌ 사용법: register-store.bat [매장ID] [매장명] [위치] [연락처]
    echo    예시: register-store.bat store_004 "신촌점" "서울시 서대문구 신촌로 123" "010-4567-8901"
    exit /b 1
)

set STORE_ID=%1
set STORE_NAME=%2
set STORE_LOCATION=%3
set STORE_CONTACT=%4

if "%STORE_NAME%"=="" set STORE_NAME=새매장
if "%STORE_LOCATION%"=="" set STORE_LOCATION=위치미설정
if "%STORE_CONTACT%"=="" set STORE_CONTACT=연락처미설정

echo 🏪 BrickBox 매장 등록 시작
echo 📋 매장 정보:
echo    ID: %STORE_ID%
echo    이름: %STORE_NAME%
echo    위치: %STORE_LOCATION%
echo    연락처: %STORE_CONTACT%
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

REM 매장 등록 요청
echo 📤 매장 등록 요청 전송 중...

curl -X POST "%CENTRAL_SERVER_URL%/api/stores/register" ^
    -H "Content-Type: application/json" ^
    -d "{\"storeId\":\"%STORE_ID%\",\"storeName\":\"%STORE_NAME%\",\"location\":\"%STORE_LOCATION%\",\"contact\":\"%STORE_CONTACT%\",\"config\":{\"ip\":\"localhost\",\"port\":\"3003\",\"deployment_method\":\"http\",\"pilot_eligible\":true}}" ^
    --silent --show-error

if errorlevel 1 (
    echo ❌ 매장 등록 실패
    exit /b 1
)

echo ✅ 매장 등록 완료

REM 매장별 클라이언트 설정 파일 생성
echo 📝 매장 클라이언트 설정 파일 생성...

set CONFIG_FILE=store-client-config.json
echo {> %CONFIG_FILE%
echo   "storeId": "%STORE_ID%",>> %CONFIG_FILE%
echo   "storeName": "%STORE_NAME%",>> %CONFIG_FILE%
echo   "centralServerUrl": "%CENTRAL_SERVER_URL%",>> %CONFIG_FILE%
echo   "location": "%STORE_LOCATION%",>> %CONFIG_FILE%
echo   "contact": "%STORE_CONTACT%",>> %CONFIG_FILE%
echo   "ip": "localhost",>> %CONFIG_FILE%
echo   "port": "3003",>> %CONFIG_FILE%
echo   "autoUpdate": true,>> %CONFIG_FILE%
echo   "pilotEligible": true>> %CONFIG_FILE%
echo }>> %CONFIG_FILE%

echo ✅ 설정 파일 생성: %CONFIG_FILE%

REM 매장별 클라이언트 시작 스크립트 생성
set START_SCRIPT=start-store-client.bat
echo @echo off> %START_SCRIPT%
echo REM 🏪 BrickBox 매장 클라이언트 시작>> %START_SCRIPT%
echo set STORE_ID=%STORE_ID%>> %START_SCRIPT%
echo set STORE_NAME=%STORE_NAME%>> %START_SCRIPT%
echo set CENTRAL_SERVER_URL=%CENTRAL_SERVER_URL%>> %START_SCRIPT%
echo set STORE_LOCATION=%STORE_LOCATION%>> %START_SCRIPT%
echo set STORE_CONTACT=%STORE_CONTACT%>> %START_SCRIPT%
echo.>> %START_SCRIPT%
echo node server/store-update-client.js>> %START_SCRIPT%

echo ✅ 시작 스크립트 생성: %START_SCRIPT%

echo.
echo 🎉 매장 등록 완료!
echo 📋 생성된 파일:
echo    - %CONFIG_FILE% (설정 파일)
echo    - %START_SCRIPT% (시작 스크립트)
echo.

echo 💡 다음 단계:
echo    1. %START_SCRIPT% 실행하여 매장 클라이언트 시작
echo    2. 중앙 서버에서 매장 상태 확인
echo    3. 모델 배포 테스트
echo.

echo 🚀 매장 클라이언트 시작하려면:
echo    %START_SCRIPT%
echo.

endlocal
echo ✅ 매장 등록 스크립트 완료
