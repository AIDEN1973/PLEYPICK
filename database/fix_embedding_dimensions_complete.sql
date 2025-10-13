-- ============================================
-- 임베딩 차원 수정: 768 → 512 (완전판)
-- CLIP vit-base-patch32는 512차원
-- ============================================

-- 1단계: 의존 뷰 삭제
DROP VIEW IF EXISTS v_feature_audit CASCADE;
DROP VIEW IF EXISTS v_feature_runtime CASCADE;

-- 2단계: RPC 함수 수정
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

-- 3단계: 컬럼 타입 변경 (기존 데이터 NULL로 초기화)
ALTER TABLE parts_master_features 
    ALTER COLUMN clip_text_emb TYPE vector(512) 
    USING NULL;

ALTER TABLE parts_master_features 
    ALTER COLUMN semantic_vector TYPE vector(512) 
    USING NULL;

-- 4단계: 모든 상태를 pending으로 변경
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

