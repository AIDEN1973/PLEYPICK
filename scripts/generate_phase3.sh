#!/bin/bash
# 🧱 BrickBox 3단계: 전체 부품 합성 데이터셋 생성
# 부품 수: 1000개
# 부품당 이미지: 1000장
# 예상 용량: 75.0GB

echo "🚀 3단계: 전체 부품 렌더링 시작"

# 전체 부품 렌더링
python scripts/synthetic_dataset_pipeline.py \
    --part-list "all" \
    --max-images 1000 \
    --batch-size 50 \
    --output-dir "./output/synthetic/phase3"

echo "✅ 3단계 완료: 75.0GB 생성"
