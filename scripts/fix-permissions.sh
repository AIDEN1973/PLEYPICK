#!/bin/bash
# Vercel 빌드 환경에서 권한 문제 해결

echo "🔧 권한 문제 해결 중..."

# node_modules/.bin 디렉토리의 실행 권한 설정
chmod -R +x node_modules/.bin/

# vite 실행 파일에 실행 권한 부여
if [ -f "node_modules/.bin/vite" ]; then
    chmod +x node_modules/.bin/vite
    echo "✅ vite 실행 권한 설정 완료"
else
    echo "❌ vite 실행 파일을 찾을 수 없습니다"
fi

# npm 재설치 (권한 문제 해결)
npm install --force

echo "🚀 빌드 시작..."
npm run build:vercel
