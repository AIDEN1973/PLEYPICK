#!/bin/bash
# BrickBox Embedding Worker Starter (Linux/Mac)

echo "========================================"
echo "BrickBox Embedding Worker"
echo "========================================"
echo ""

# 환경 변수 설정
export SUPABASE_URL="https://npferbxuxocbfnfbpcnz.supabase.co"
export SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00"
export PYTHONIOENCODING="utf-8"

echo "Starting worker..."
echo "Press Ctrl+C to stop"
echo ""

python3 scripts/embedding_worker.py

