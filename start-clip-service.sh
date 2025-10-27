#!/bin/bash

echo "🚀 CLIP 임베딩 서비스 시작..."
echo

# Python 환경 확인
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3가 설치되지 않았습니다. Python 3.8+ 설치 후 다시 시도하세요."
    exit 1
fi

# 의존성 설치
echo "📦 CLIP 서비스 의존성 설치 중..."
pip3 install -r server/requirements-clip.txt

if [ $? -ne 0 ]; then
    echo "❌ 의존성 설치 실패"
    exit 1
fi

# 환경 변수 설정
export CLIP_SERVICE_PORT=3021
export CLIP_SERVICE_HOST=0.0.0.0

echo "✅ CLIP 서비스 시작 (포트: $CLIP_SERVICE_PORT)"
echo "📊 모델: CLIP ViT-L/14, 차원: 768"
echo "🌐 URL: http://localhost:$CLIP_SERVICE_PORT"
echo

# CLIP 서비스 시작
cd server
python3 clip-embedding-service.py
