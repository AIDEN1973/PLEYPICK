#!/usr/bin/env python3
"""768차원 테스트 벡터 생성 및 SQL 파일 출력"""

import numpy as np

# 768차원 정규화된 벡터 생성
vec = np.random.randn(768)
vec = vec / np.linalg.norm(vec)  # L2 정규화

# SQL용 문자열 생성
vec_str = '[' + ','.join([f'{v:.6f}' for v in vec]) + ']'

# SQL 파일로 저장
sql_content = f"""-- 768차원 테스트 임베딩 업데이트
-- 벡터 차원: {len(vec)}
-- 노름: {np.linalg.norm(vec):.6f}

SELECT update_part_embedding(2124, '{vec_str}') AS result;

-- 결과 확인
SELECT 
    id,
    part_id,
    embedding_status,
    LEFT(clip_text_emb::TEXT, 100) AS emb_sample,
    array_length(clip_text_emb::real[], 1) AS dimension
FROM parts_master_features
WHERE id = 2124;
"""

# 파일로 저장
with open('database/test_embedding_update.sql', 'w', encoding='utf-8') as f:
    f.write(sql_content)

print("OK: database/test_embedding_update.sql file created")
print(f"   Dimension: {len(vec)}")
print(f"   Norm: {np.linalg.norm(vec):.6f}")

