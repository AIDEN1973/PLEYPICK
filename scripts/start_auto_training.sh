#!/bin/bash
# 🧱 BrickBox 자동 학습 시스템 시작 스크립트

echo "🚀 BrickBox 자동 학습 시스템 시작"
echo "=================================="

# 환경 변수 설정
export SUPABASE_URL="https://npferbxuxocbfnfbpcnz.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export NOTIFICATION_WEBHOOK_URL="https://your-webhook-url.com/training-notifications"

# Python 의존성 설치
echo "📦 Python 의존성 설치..."
pip install supabase schedule requests

# Supabase Functions 배포
echo "🚀 Supabase Functions 배포..."
npx supabase functions deploy auto-training-trigger

# 데이터베이스 설정 적용
echo "🗄️ 데이터베이스 설정 적용..."
npx supabase db push

# 자동 학습 모니터링 시작
echo "📊 자동 학습 모니터링 시작..."
python scripts/auto_training_monitor.py &

# 자동 학습 스케줄러 시작
echo "⏰ 자동 학습 스케줄러 시작..."
python scripts/auto_training_scheduler.py &

echo "✅ 자동 학습 시스템 시작 완료!"
echo "📊 모니터링: scripts/auto_training_monitor.py"
echo "⏰ 스케줄러: scripts/auto_training_scheduler.py"
echo "🔗 Colab 노트북: https://colab.research.google.com/drive/1ApQY9JfoNOZ7zrpVdH9goduw3cJKDawn"

# 프로세스 모니터링
echo "🔄 프로세스 모니터링 중... (Ctrl+C로 중단)"
wait
