-- 향상된 인식 시스템을 위한 parts_master_features 테이블 확장

-- 1. 부품 분류 관련 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'GEOMETRY',
ADD COLUMN IF NOT EXISTS orientation_sensitive BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS flip_tolerance DECIMAL(3,2) DEFAULT 0.4,
ADD COLUMN IF NOT EXISTS semantic_complexity DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(10) DEFAULT 'low';

-- 2. 향상된 메타데이터 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS has_stud BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS groove BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS center_stud BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS key_features TEXT[] DEFAULT '{}';

-- 3. Flip 관련 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS flip_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS is_flipped BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS orientation_locked BOOLEAN DEFAULT false;

-- 4. 향상된 신뢰도 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS normal_similarity DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS flipped_similarity DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS semantic_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS method VARCHAR(50) DEFAULT 'geometric';

-- 5. 회전/반전 불변 특징 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS rotation_invariance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS angle_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS polar_transform BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS radial_profile BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS teeth_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pitch_periodicity BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS circular_array BOOLEAN DEFAULT false;

-- 6. 멀티-어트리뷰트 투표 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS round_shape_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS center_stud_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS groove_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS stud_count_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS tube_pattern_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS hole_count_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS symmetry_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS edge_quality_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS texture_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS color_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS pattern_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS voting_total_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS core_matches INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS core_bonus DECIMAL(3,2) DEFAULT 0.0;

-- 7. 혼동군 페널티 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS confusion_penalty DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS applied_penalties JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS confusion_groups TEXT[] DEFAULT '{}';

-- 8. 향상된 메타데이터 JSON 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS feature_json JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS expected_stud_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_hole_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS underside_tube_pattern VARCHAR(50) DEFAULT '',
ADD COLUMN IF NOT EXISTS primary_signal VARCHAR(50) DEFAULT '';

-- 9. 품질 지표 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS precision_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS recall_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS top2_margin DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS review_ratio DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 10. 운영용 품질 지표 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS image_quality_mu DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS image_quality_sigma DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS image_quality_lv DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS image_quality_snr DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS image_quality_resolution INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_quality_q DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS tier_weights_geo DECIMAL(3,2) DEFAULT 0.6,
ADD COLUMN IF NOT EXISTS tier_weights_struct DECIMAL(3,2) DEFAULT 0.2,
ADD COLUMN IF NOT EXISTS tier_weights_sem DECIMAL(3,2) DEFAULT 0.2,
ADD COLUMN IF NOT EXISTS score_geo DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS score_struct DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS score_sem DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS score_final DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS meta_em DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS meta_penalty DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS meta_m DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS decision_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS decision_threshold DECIMAL(3,2) DEFAULT 0.0;

-- 11. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_tier ON parts_master_features(tier);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_orientation_sensitive ON parts_master_features(orientation_sensitive);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_complexity ON parts_master_features(semantic_complexity);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_rotation_invariance ON parts_master_features(rotation_invariance);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_voting_score ON parts_master_features(voting_total_score);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_confusion_penalty ON parts_master_features(confusion_penalty);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_last_updated ON parts_master_features(last_updated);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_method ON parts_master_features(method);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_decision_status ON parts_master_features(decision_status);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_image_quality_q ON parts_master_features(image_quality_q);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_score_final ON parts_master_features(score_final);

-- 6. 기존 데이터 업데이트 (기본값 설정)
UPDATE parts_master_features 
SET 
  tier = CASE 
    WHEN part_id LIKE '%head%' OR part_id LIKE '%face%' OR part_id LIKE '%lion%' THEN 'SEMANTIC'
    WHEN part_id LIKE '%technic%' OR part_id LIKE '%gear%' OR part_id LIKE '%axle%' THEN 'STRUCTURAL'
    ELSE 'GEOMETRY'
  END,
  orientation_sensitive = CASE 
    WHEN part_id LIKE '%head%' OR part_id LIKE '%face%' OR part_id LIKE '%lion%' THEN true
    WHEN part_id LIKE '%technic%' OR part_id LIKE '%gear%' THEN false
    ELSE true
  END,
  flip_tolerance = CASE 
    WHEN part_id LIKE '%head%' OR part_id LIKE '%face%' OR part_id LIKE '%lion%' THEN 0.1
    WHEN part_id LIKE '%technic%' OR part_id LIKE '%gear%' THEN 0.3
    ELSE 0.4
  END,
  has_stud = CASE 
    WHEN part_id LIKE '%stud%' OR part_id LIKE '%plate%' OR part_id LIKE '%brick%' THEN true
    ELSE false
  END,
  groove = CASE 
    WHEN part_id LIKE '%groove%' OR part_id LIKE '%tile%' THEN true
    ELSE false
  END,
  center_stud = CASE 
    WHEN part_id LIKE '%center%' AND part_id LIKE '%stud%' THEN true
    ELSE false
  END
WHERE tier = 'GEOMETRY' OR tier IS NULL;

-- 7. 복잡도 레벨 업데이트
UPDATE parts_master_features 
SET 
  complexity_level = CASE 
    WHEN semantic_complexity > 0.7 THEN 'high'
    WHEN semantic_complexity > 0.4 THEN 'medium'
    ELSE 'low'
  END;

-- 8. 통계 정보 조회 함수
CREATE OR REPLACE FUNCTION get_enhanced_recognition_stats()
RETURNS TABLE (
  total_parts BIGINT,
  geometry_parts BIGINT,
  structural_parts BIGINT,
  semantic_parts BIGINT,
  orientation_sensitive_parts BIGINT,
  high_complexity_parts BIGINT,
  average_confidence DECIMAL(5,3)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_parts,
    COUNT(*) FILTER (WHERE tier = 'GEOMETRY') as geometry_parts,
    COUNT(*) FILTER (WHERE tier = 'STRUCTURAL') as structural_parts,
    COUNT(*) FILTER (WHERE tier = 'SEMANTIC') as semantic_parts,
    COUNT(*) FILTER (WHERE orientation_sensitive = true) as orientation_sensitive_parts,
    COUNT(*) FILTER (WHERE complexity_level = 'high') as high_complexity_parts,
    ROUND(AVG(confidence)::numeric, 3) as average_confidence
  FROM parts_master_features;
END;
$$ LANGUAGE plpgsql;

-- 9. 향상된 검색 함수
CREATE OR REPLACE FUNCTION search_parts_by_tier(
  search_tier VARCHAR(20),
  min_confidence DECIMAL(3,2) DEFAULT 0.6
)
RETURNS TABLE (
  part_id VARCHAR(20),
  color_id INTEGER,
  tier VARCHAR(20),
  confidence DECIMAL(3,2),
  method VARCHAR(50),
  is_flipped BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pmf.part_id,
    pmf.color_id,
    pmf.tier,
    pmf.confidence,
    pmf.method,
    pmf.is_flipped
  FROM parts_master_features pmf
  WHERE pmf.tier = search_tier
    AND pmf.confidence >= min_confidence
  ORDER BY pmf.confidence DESC;
END;
$$ LANGUAGE plpgsql;

-- 10. 통계 정보 확인
SELECT get_enhanced_recognition_stats();
