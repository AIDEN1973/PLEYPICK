-- ============================================
-- 샘플 10건 임베딩 상태 리셋
-- ============================================

-- 샘플 데이터(ID 2124-2133) 임베딩 상태를 pending으로 변경
UPDATE parts_master_features
SET 
    embedding_status = 'pending',
    updated_at = NOW()
WHERE id BETWEEN 2124 AND 2133;

-- 결과 확인
SELECT 
    id,
    part_id,
    feature_text,
    embedding_status,
    LEFT(clip_text_emb::TEXT, 50) AS emb_preview
FROM parts_master_features
WHERE id BETWEEN 2124 AND 2133
ORDER BY id;

