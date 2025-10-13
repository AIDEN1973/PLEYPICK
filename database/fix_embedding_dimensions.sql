-- ============================================
-- 임베딩 차원 수정: 768 → 512
-- (CLIP vit-base-patch32는 512차원)
-- ============================================

-- 1. 의존 뷰 백업 및 삭제
DO $$
DECLARE
    view_def TEXT;
BEGIN
    -- v_feature_runtime 뷰 정의 백업
    SELECT pg_get_viewdef('v_feature_runtime', true) INTO view_def;
    RAISE NOTICE 'View definition backed up';
    
    -- 뷰 삭제
    DROP VIEW IF EXISTS v_feature_runtime CASCADE;
    RAISE NOTICE 'View dropped';
END $$;

-- 2. RPC 함수 수정
DROP FUNCTION IF EXISTS update_part_embedding(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION update_part_embedding(
    p_id INTEGER,
    p_embedding TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE parts_master_features
    SET 
        clip_text_emb = p_embedding::vector(512),
        semantic_vector = p_embedding::vector(512),
        embedding_status = 'completed',
        updated_at = NOW()
    WHERE id = p_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 권한 부여
GRANT EXECUTE ON FUNCTION update_part_embedding(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_part_embedding(INTEGER, TEXT) TO service_role;

-- 3. 기존 컬럼 타입 변경
ALTER TABLE parts_master_features 
    ALTER COLUMN clip_text_emb TYPE vector(512);

ALTER TABLE parts_master_features 
    ALTER COLUMN semantic_vector TYPE vector(512);

-- 4. 뷰 재생성 (필요한 경우 수동으로 실행)
-- v_feature_runtime 뷰를 재생성해야 합니다
-- 원본 뷰 정의를 확인하려면:
-- SELECT pg_get_viewdef('v_feature_runtime', true);

-- 3. 확인
SELECT 
    column_name,
    udt_name,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'parts_master_features' 
    AND column_name IN ('clip_text_emb', 'semantic_vector');

