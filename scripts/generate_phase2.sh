#!/bin/bash
# 🧱 BrickBox 2단계: 확장 부품 합성 데이터셋 생성
# 부품 수: 500개
# 부품당 이미지: 500장
# 예상 용량: 18.75GB

echo "🚀 2단계: 확장 부품 렌더링 시작"

# LDraw에서 자동으로 부품 목록 생성
python scripts/sync_ldraw_to_supabase.py --ldraw-path C:/LDraw

# 상위 500개 부품 선택하여 렌더링
python scripts/synthetic_dataset_pipeline.py \
    --part-list "auto" \
    --max-images 500 \
    --batch-size 20 \
    --output-dir "./output/synthetic/phase2"

echo "✅ 2단계 완료: 18.75GB 생성"
