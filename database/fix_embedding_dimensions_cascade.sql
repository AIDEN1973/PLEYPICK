-- ============================================
-- 임베딩 차원 수정: 768 → 512 (CASCADE 방식)
-- (CLIP vit-base-patch32는 512차원)
-- ============================================

-- 주의: 이 스크립트는 의존 뷰를 모두 삭제합니다!
-- 실행 전 반드시 뷰 정의를 백업하세요!

-- 1. 모든 의존 뷰 정보 출력
DO $$
DECLARE
    view_record RECORD;
BEGIN
    RAISE NOTICE '=== 삭제될 뷰 목록 ===';
    FOR view_record IN
        SELECT DISTINCT
            dependent_view.relname AS view_name
        FROM pg_depend 
        JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
        JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
        JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
        JOIN pg_attribute ON pg_depend.refobjid = pg_attribute.attrelid 
            AND pg_depend.refobjsubid = pg_attribute.attnum 
        WHERE 
            source_table.relname = 'parts_master_features'
            AND pg_attribute.attname IN ('clip_text_emb', 'semantic_vector')
            AND dependent_view.relkind = 'v'
    LOOP
        RAISE NOTICE '  - %', view_record.view_name;
    END LOOP;
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

-- 3. 컬럼 타입 변경 (기존 데이터는 초기화됨)
-- 주의: 기존 임베딩 데이터가 모두 NULL로 초기화됩니다!
ALTER TABLE parts_master_features 
    ALTER COLUMN clip_text_emb TYPE vector(512) 
    USING NULL;

ALTER TABLE parts_master_features 
    ALTER COLUMN semantic_vector TYPE vector(512) 
    USING NULL;

-- 4. 모든 상태를 pending으로 변경 (재생성 필요)
UPDATE parts_master_features
SET 
    embedding_status = 'pending',
    updated_at = NOW()
WHERE embedding_status IS NOT NULL;

-- 5. 확인
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'parts_master_features' 
    AND column_name IN ('clip_text_emb', 'semantic_vector');

-- 6. 통계
SELECT 
    embedding_status,
    COUNT(*) as count
FROM parts_master_features
GROUP BY embedding_status
ORDER BY embedding_status;

