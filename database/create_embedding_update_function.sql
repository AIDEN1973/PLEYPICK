-- ============================================
-- 임베딩 업데이트 함수 생성
-- ============================================

CREATE OR REPLACE FUNCTION update_part_embedding(
    p_id INTEGER,
    p_embedding TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE parts_master_features
    SET 
        clip_text_emb = p_embedding::vector(768),
        semantic_vector = p_embedding::vector(768),
        embedding_status = 'completed',
        updated_at = NOW()
    WHERE id = p_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 권한 부여 (필요한 경우)
GRANT EXECUTE ON FUNCTION update_part_embedding(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_part_embedding(INTEGER, TEXT) TO service_role;
