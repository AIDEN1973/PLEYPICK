#!/bin/bash

# BrickBox 프로덕션 배포 스크립트

set -e

echo "🚀 BrickBox 프로덕션 배포 시작..."

# 환경 변수 확인
if [ ! -f .env.production ]; then
    echo "❌ .env.production 파일이 없습니다."
    echo "다음 환경 변수를 설정해주세요:"
    echo "- VITE_SUPABASE_URL"
    echo "- VITE_SUPABASE_SERVICE_ROLE"
    echo "- SLACK_WEBHOOK_URL"
    exit 1
fi

# Docker 설치 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되지 않았습니다."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose가 설치되지 않았습니다."
    exit 1
fi

# 기존 컨테이너 정리
echo "🧹 기존 컨테이너 정리 중..."
docker-compose -f docker-compose.production.yml down --remove-orphans

# 이미지 빌드
echo "🔨 Docker 이미지 빌드 중..."
docker-compose -f docker-compose.production.yml build --no-cache

# 컨테이너 시작
echo "🚀 컨테이너 시작 중..."
docker-compose -f docker-compose.production.yml up -d

# 헬스체크
echo "🏥 헬스체크 중..."
sleep 30

# 프론트엔드 확인
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ 프론트엔드 정상"
else
    echo "❌ 프론트엔드 오류"
fi

# 학습 API 확인
if curl -f http://localhost:3002/api/training/active > /dev/null 2>&1; then
    echo "✅ 학습 API 정상"
else
    echo "❌ 학습 API 오류"
fi

# 합성 API 확인
if curl -f http://localhost:3003/health > /dev/null 2>&1; then
    echo "✅ 합성 API 정상"
else
    echo "❌ 합성 API 오류"
fi

echo "🎉 BrickBox 프로덕션 배포 완료!"
echo "📊 접속 URL:"
echo "  - 프론트엔드: http://localhost:3000"
echo "  - 학습 API: http://localhost:3002"
echo "  - 합성 API: http://localhost:3003"

# 로그 확인
echo "📋 컨테이너 상태:"
docker-compose -f docker-compose.production.yml ps

echo "📋 로그 확인:"
echo "  docker-compose -f docker-compose.production.yml logs -f"
