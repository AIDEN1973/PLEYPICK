-- ============================================
-- 임베딩 차원 수정: 512 → 768
-- CLIP ViT-L/14 모델 (768차원) 사용
-- ============================================

-- 1단계: 의존 뷰 삭제 (모두)
DROP VIEW IF EXISTS v_feature_audit CASCADE;
DROP VIEW IF EXISTS v_feature_runtime CASCADE;
DROP VIEW IF EXISTS v_metadata_status CASCADE;
DROP VIEW IF EXISTS v_embedding_status CASCADE;

-- 2단계: RPC 함수 수정 (768차원)
DROP FUNCTION IF EXISTS update_part_embedding(INTEGER, TEXT);

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

-- 권한 부여
GRANT EXECUTE ON FUNCTION update_part_embedding(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_part_embedding(INTEGER, TEXT) TO service_role;

-- 3단계: 컬럼 타입 변경 (512 → 768, 기존 데이터 NULL로 초기화)
ALTER TABLE parts_master_features 
    ALTER COLUMN clip_text_emb TYPE vector(768) 
    USING NULL;

ALTER TABLE parts_master_features 
    ALTER COLUMN semantic_vector TYPE vector(768) 
    USING NULL;

-- 4단계: 모든 상태를 pending으로 변경 (재생성 필요)
UPDATE parts_master_features
SET 
    embedding_status = 'pending',
    updated_at = NOW()
WHERE feature_text IS NOT NULL AND feature_text != '';

-- 5단계: 뷰 재생성

-- v_feature_runtime 뷰
CREATE OR REPLACE VIEW v_feature_runtime AS
SELECT 
    pmf.id,
    pmf.part_id,
    pmf.part_name,
    pmf.part_category,
    pmf.color_id,
    pmf.feature_json,
    pmf.feature_text,
    pmf.clip_text_emb,
    pmf.recognition_hints,
    pmf.similar_parts,
    pmf.distinguishing_features,
    pmf.confidence,
    pmf.usage_frequency,
    pmf.detection_accuracy,
    pmf.created_at,
    pmf.updated_at,
    pmf.version,
    pmf.tier,
    pmf.orientation_sensitive,
    pmf.flip_tolerance,
    pmf.semantic_complexity,
    pmf.complexity_level,
    pmf.has_stud,
    pmf.groove,
    pmf.center_stud,
    pmf.key_features,
    pmf.flip_score,
    pmf.is_flipped,
    pmf.orientation_locked,
    pmf.normal_similarity,
    pmf.flipped_similarity,
    pmf.semantic_score,
    pmf.method,
    pmf.rotation_invariance,
    pmf.angle_step,
    pmf.polar_transform,
    pmf.radial_profile,
    pmf.teeth_count,
    pmf.pitch_periodicity,
    pmf.circular_array,
    pmf.round_shape_score,
    pmf.center_stud_score,
    pmf.groove_score,
    pmf.stud_count_score,
    pmf.tube_pattern_score,
    pmf.hole_count_score,
    pmf.symmetry_score,
    pmf.edge_quality_score,
    pmf.texture_score,
    pmf.color_score,
    pmf.pattern_score,
    pmf.voting_total_score,
    pmf.core_matches,
    pmf.core_bonus,
    pmf.confusion_penalty,
    pmf.applied_penalties,
    pmf.confusion_groups,
    pmf.aliases,
    pmf.expected_stud_count,
    pmf.expected_hole_count,
    pmf.underside_tube_pattern,
    pmf.primary_signal,
    pmf.precision_score,
    pmf.recall_score,
    pmf.top2_margin,
    pmf.review_ratio,
    pmf.last_updated,
    pmf.image_quality_mu,
    pmf.image_quality_sigma,
    pmf.image_quality_lv,
    pmf.image_quality_snr,
    pmf.image_quality_resolution,
    pmf.image_quality_q,
    pmf.tier_weights_geo,
    pmf.tier_weights_struct,
    pmf.tier_weights_sem,
    pmf.score_geo,
    pmf.score_struct,
    pmf.score_sem,
    pmf.score_final,
    pmf.meta_em,
    pmf.meta_penalty,
    pmf.meta_m,
    pmf.decision_status,
    pmf.decision_threshold,
    pmf.shape_tag,
    pmf.scale,
    pmf.stud_count_top,
    pmf.tube_count_bottom,
    pmf.stud_pattern,
    pmf.tube_pattern,
    pmf.hole_count,
    pmf.topo_applicable,
    pmf.confusions,
    pmf.texture_class,
    pmf.is_printed,
    pmf.top_color_rgb,
    pmf.underside_type,
    pmf.semantic_vector,
    pmf.feature_text_score,
    pmf.image_quality_ssim,
    pmf.meta_source,
    pmf.area_px,
    pmf.bbox_ratio,
    pmf.orientation,
    pmf.render_id,
    pmf.set_id,
    pmf.element_id,
    pmf.image_quality,
    pmf.scale_type,
    lc.name AS color_name,
    lc.rgb AS color_rgb,
    lc.is_trans AS color_is_transparent
FROM parts_master_features pmf
LEFT JOIN lego_colors lc ON pmf.color_id = lc.color_id;

-- v_feature_audit 뷰
CREATE OR REPLACE VIEW v_feature_audit AS
SELECT 
    pmf.id,
    pmf.part_id,
    pmf.part_name,
    pmf.part_category,
    pmf.color_id,
    pmf.feature_json,
    pmf.feature_text,
    pmf.clip_text_emb,
    pmf.recognition_hints,
    pmf.similar_parts,
    pmf.distinguishing_features,
    pmf.confidence,
    pmf.usage_frequency,
    pmf.detection_accuracy,
    pmf.created_at,
    pmf.updated_at,
    pmf.version,
    pmf.tier,
    pmf.orientation_sensitive,
    pmf.flip_tolerance,
    pmf.semantic_complexity,
    pmf.complexity_level,
    pmf.has_stud,
    pmf.groove,
    pmf.center_stud,
    pmf.key_features,
    pmf.flip_score,
    pmf.is_flipped,
    pmf.orientation_locked,
    pmf.normal_similarity,
    pmf.flipped_similarity,
    pmf.semantic_score,
    pmf.method,
    pmf.rotation_invariance,
    pmf.angle_step,
    pmf.polar_transform,
    pmf.radial_profile,
    pmf.teeth_count,
    pmf.pitch_periodicity,
    pmf.circular_array,
    pmf.round_shape_score,
    pmf.center_stud_score,
    pmf.groove_score,
    pmf.stud_count_score,
    pmf.tube_pattern_score,
    pmf.hole_count_score,
    pmf.symmetry_score,
    pmf.edge_quality_score,
    pmf.texture_score,
    pmf.color_score,
    pmf.pattern_score,
    pmf.voting_total_score,
    pmf.core_matches,
    pmf.core_bonus,
    pmf.confusion_penalty,
    pmf.applied_penalties,
    pmf.confusion_groups,
    pmf.aliases,
    pmf.expected_stud_count,
    pmf.expected_hole_count,
    pmf.underside_tube_pattern,
    pmf.primary_signal,
    pmf.precision_score,
    pmf.recall_score,
    pmf.top2_margin,
    pmf.review_ratio,
    pmf.last_updated,
    pmf.image_quality_mu,
    pmf.image_quality_sigma,
    pmf.image_quality_lv,
    pmf.image_quality_snr,
    pmf.image_quality_resolution,
    pmf.image_quality_q,
    pmf.tier_weights_geo,
    pmf.tier_weights_struct,
    pmf.tier_weights_sem,
    pmf.score_geo,
    pmf.score_struct,
    pmf.score_sem,
    pmf.score_final,
    pmf.meta_em,
    pmf.meta_penalty,
    pmf.meta_m,
    pmf.decision_status,
    pmf.decision_threshold,
    pmf.shape_tag,
    pmf.scale,
    pmf.stud_count_top,
    pmf.tube_count_bottom,
    pmf.stud_pattern,
    pmf.tube_pattern,
    pmf.hole_count,
    pmf.topo_applicable,
    pmf.confusions,
    pmf.texture_class,
    pmf.is_printed,
    pmf.top_color_rgb,
    pmf.underside_type,
    pmf.semantic_vector,
    pmf.feature_text_score,
    pmf.image_quality_ssim,
    pmf.meta_source,
    pmf.area_px,
    pmf.bbox_ratio,
    pmf.orientation,
    pmf.render_id,
    pmf.set_id,
    pmf.element_id,
    pmf.image_quality,
    pmf.scale_type,
    ol.operation_type,
    ol.created_at AS operation_timestamp,
    ol.admin_user_id AS operation_user,
    ol.message AS operation_details,
    ol.status AS operation_status,
    ol.metadata AS operation_metadata
FROM parts_master_features pmf
LEFT JOIN operation_logs ol ON pmf.part_id::text = ol.target_id::text;

-- 6단계: 확인
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'parts_master_features' 
    AND column_name IN ('clip_text_emb', 'semantic_vector');

-- 통계
SELECT 
    embedding_status,
    COUNT(*) as count
FROM parts_master_features
GROUP BY embedding_status
ORDER BY embedding_status;

-- 7단계: 관리용 뷰 재생성 (v_metadata_status, v_embedding_status)
-- 이 뷰들은 메타데이터 관리 UI에서 사용됩니다
-- 자세한 내용은 create_metadata_management_views.sql 참고

-- v_metadata_status 뷰
CREATE VIEW v_metadata_status AS
SELECT 
    pmf.id,
    pmf.part_id,
    pmf.part_name,
    pmf.color_id,
    lc.name AS color_name,
    lc.rgb AS color_rgb,
    pmf.feature_text,
    pmf.recognition_hints,
    pmf.feature_json,
    pmf.updated_at,
    pmf.created_at,
    CASE 
        WHEN pmf.feature_text IS NOT NULL AND pmf.feature_text != '' 
            AND pmf.feature_json IS NOT NULL 
        THEN 'completed'
        WHEN pmf.feature_text IS NULL OR pmf.feature_text = ''
        THEN 'missing'
        ELSE 'error'
    END AS metadata_status,
    COALESCE(pmf.feature_text_score::numeric, 0) AS quality_score,
    pmf.meta_source
FROM parts_master_features pmf
LEFT JOIN lego_colors lc ON pmf.color_id = lc.color_id
ORDER BY pmf.id DESC;

-- v_embedding_status 뷰
CREATE VIEW v_embedding_status AS
SELECT 
    pmf.id,
    pmf.part_id,
    pmf.part_name,
    pmf.color_id,
    lc.name AS color_name,
    lc.rgb AS color_rgb,
    pmf.feature_text,
    pmf.embedding_status,
    pmf.clip_text_emb,
    pmf.semantic_vector,
    pmf.updated_at,
    pmf.created_at,
    CASE 
        WHEN pmf.clip_text_emb IS NOT NULL 
        THEN array_length(pmf.clip_text_emb::real[], 1)
        ELSE NULL
    END AS embedding_dimension,
    CASE 
        WHEN pmf.clip_text_emb IS NOT NULL 
            AND pmf.clip_text_emb::TEXT LIKE '[0,0,0,0%'
        THEN true
        ELSE false
    END AS is_zero_vector
FROM parts_master_features pmf
LEFT JOIN lego_colors lc ON pmf.color_id = lc.color_id
ORDER BY pmf.id DESC;

-- 8단계: RPC 함수 재생성
-- get_metadata_stats, get_embedding_stats, request_embedding_generation 등
DROP FUNCTION IF EXISTS get_metadata_stats();
DROP FUNCTION IF EXISTS get_embedding_stats();
DROP FUNCTION IF EXISTS request_metadata_generation(INTEGER[]);
DROP FUNCTION IF EXISTS request_embedding_generation(INTEGER[]);
DROP FUNCTION IF EXISTS retry_failed_embeddings();

CREATE FUNCTION get_metadata_stats()
RETURNS TABLE(
    status TEXT,
    count BIGINT,
    percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        metadata_status::TEXT,
        COUNT(*)::BIGINT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
    FROM v_metadata_status
    GROUP BY metadata_status
    ORDER BY 
        CASE metadata_status
            WHEN 'completed' THEN 1
            WHEN 'error' THEN 2
            WHEN 'missing' THEN 3
        END;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_embedding_stats()
RETURNS TABLE(
    status TEXT,
    count BIGINT,
    percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(embedding_status, 'missing')::TEXT,
        COUNT(*)::BIGINT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
    FROM v_embedding_status
    GROUP BY embedding_status
    ORDER BY 
        CASE COALESCE(embedding_status, 'missing')
            WHEN 'completed' THEN 1
            WHEN 'pending' THEN 2
            WHEN 'failed' THEN 3
            WHEN 'missing' THEN 4
        END;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION request_metadata_generation(
    p_part_ids INTEGER[]
)
RETURNS TABLE(
    id INTEGER,
    part_id TEXT,
    status TEXT,
    message TEXT
) AS $$
BEGIN
    UPDATE parts_master_features
    SET 
        meta_source = 'manual_request',
        updated_at = NOW()
    WHERE id = ANY(p_part_ids);
    
    RETURN QUERY
    SELECT 
        pmf.id,
        pmf.part_id,
        'requested'::TEXT,
        '수동 생성 요청됨 - 워커가 처리합니다'::TEXT
    FROM parts_master_features pmf
    WHERE pmf.id = ANY(p_part_ids);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION request_embedding_generation(
    p_part_ids INTEGER[]
)
RETURNS TABLE(
    id INTEGER,
    part_id TEXT,
    status TEXT,
    message TEXT
) AS $$
BEGIN
    UPDATE parts_master_features
    SET 
        embedding_status = 'pending',
        updated_at = NOW()
    WHERE id = ANY(p_part_ids)
        AND feature_text IS NOT NULL 
        AND feature_text != '';
    
    RETURN QUERY
    SELECT 
        pmf.id,
        pmf.part_id,
        'pending'::TEXT,
        '임베딩 생성 대기열에 추가됨'::TEXT
    FROM parts_master_features pmf
    WHERE pmf.id = ANY(p_part_ids)
        AND pmf.feature_text IS NOT NULL 
        AND pmf.feature_text != '';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION retry_failed_embeddings()
RETURNS TABLE(
    count BIGINT,
    message TEXT
) AS $$
DECLARE
    affected_count BIGINT;
BEGIN
    WITH updated AS (
        UPDATE parts_master_features
        SET 
            embedding_status = 'pending',
            updated_at = NOW()
        WHERE embedding_status = 'failed'
        RETURNING id
    )
    SELECT COUNT(*) INTO affected_count FROM updated;
    
    RETURN QUERY
    SELECT 
        affected_count,
        format('%s개 항목을 재시도 대기열에 추가했습니다', affected_count)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 768차원으로 변경 완료';
    RAISE NOTICE '   - RPC 함수: update_part_embedding(768)';
    RAISE NOTICE '   - DB 컬럼: vector(768)';
    RAISE NOTICE '   - 모든 임베딩: pending 상태';
    RAISE NOTICE '   - v_metadata_status 뷰 재생성';
    RAISE NOTICE '   - v_embedding_status 뷰 재생성';
    RAISE NOTICE '   - 관리용 RPC 함수 재생성';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 다음 단계:';
    RAISE NOTICE '   1. 프론트엔드 새로고침 (Ctrl+Shift+R)';
    RAISE NOTICE '   2. 워커 재시작 (npm run dev)';
    RAISE NOTICE '   3. 메타데이터 관리 UI 확인';
    RAISE NOTICE '========================================';
END $$;

