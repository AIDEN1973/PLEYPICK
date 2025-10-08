#!/bin/bash
echo "🧱 BrickBox 합성 데이터셋 생성기"
echo

# 환경 변수 로드
export $(grep -v '^#' config/synthetic_dataset.env | xargs)

# Python 스크립트 실행
python scripts/render_ldraw_to_supabase.py --part-id 3001 --count 10
