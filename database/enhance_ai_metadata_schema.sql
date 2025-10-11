-- AI 메타데이터 스키마 확장 (기술문서 7.2 스키마 준수)
-- parts_master_features 테이블에 기술문서 명시 필드들 추가

-- 1. 기본 식별자 필드 (이미 존재)
-- set_id, element_id, part_id, color_id, render_id

-- 2. 형상 관련 필드 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS shape_tag VARCHAR(50),
ADD COLUMN IF NOT EXISTS scale VARCHAR(20) DEFAULT 'system',
ADD COLUMN IF NOT EXISTS stud_count_top INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tube_count_bottom INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS center_stud BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS groove BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stud_pattern VARCHAR(50),
ADD COLUMN IF NOT EXISTS tube_pattern VARCHAR(50),
ADD COLUMN IF NOT EXISTS hole_count INTEGER DEFAULT 0;

-- 3. 토포로지 및 혼동군 필드 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS topo_applicable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confusions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS distinguishing_features TEXT[] DEFAULT '{}';

-- 4. 텍스처 및 색상 필드 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS texture_class VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS top_color_rgb DECIMAL(3,2)[],
ADD COLUMN IF NOT EXISTS underside_type VARCHAR(50);

-- 5. 임베딩 및 품질 필드 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS semantic_vector VECTOR(512),
ADD COLUMN IF NOT EXISTS feature_text_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS image_quality_ssim DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS image_quality_snr DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS image_quality_q DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS image_quality_resolution INTEGER;

-- 6. 메타데이터 출처 및 버전 관리
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS meta_source VARCHAR(100),
ADD COLUMN IF NOT EXISTS area_px INTEGER,
ADD COLUMN IF NOT EXISTS bbox_ratio DECIMAL(3,2)[],
ADD COLUMN IF NOT EXISTS orientation VARCHAR(20);

-- 7. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_parts_master_features_shape_tag 
  ON parts_master_features(shape_tag);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_stud_count 
  ON parts_master_features(stud_count_top);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_tube_count 
  ON parts_master_features(tube_count_bottom);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_topo_applicable 
  ON parts_master_features(topo_applicable);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_confusions 
  ON parts_master_features USING gin(confusions);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_semantic_vector 
  ON parts_master_features USING ivfflat (semantic_vector vector_cosine_ops)
  WITH (lists = 100);

-- 8. JSONB 필드 인덱스 (수정: jsonb_build_object 제거)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_image_quality_ssim 
  ON parts_master_features (image_quality_ssim) 
  WHERE image_quality_ssim IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parts_master_features_image_quality_snr 
  ON parts_master_features (image_quality_snr) 
  WHERE image_quality_snr IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parts_master_features_image_quality_q 
  ON parts_master_features (image_quality_q) 
  WHERE image_quality_q IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parts_master_features_image_quality_resolution 
  ON parts_master_features (image_quality_resolution) 
  WHERE image_quality_resolution IS NOT NULL;

-- 9. 기술문서 7.2 스키마 완전 준수를 위한 추가 필드 (중복 제거)
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS render_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS set_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS element_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS expected_stud_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_hole_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clip_text_emb VECTOR(1536),
ADD COLUMN IF NOT EXISTS image_quality JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 10. 추가 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_parts_master_features_render_id 
  ON parts_master_features(render_id);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_expected_stud_count 
  ON parts_master_features(expected_stud_count);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_expected_hole_count 
  ON parts_master_features(expected_hole_count);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_meta_source 
  ON parts_master_features(meta_source);

-- 11. 복합 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_parts_master_features_part_color 
  ON parts_master_features(part_id, color_id);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_shape_topo 
  ON parts_master_features(shape_tag, topo_applicable);

-- 12. 품질 지표 인덱스
CREATE INDEX IF NOT EXISTS idx_parts_master_features_quality_score 
  ON parts_master_features(feature_text_score DESC);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_created_at 
  ON parts_master_features(created_at DESC);

-- 13. 식별 키 및 제약 (기술문서 7.3: set_id, element_id, color_id)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_set_id 
  ON parts_master_features(set_id);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_element_id 
  ON parts_master_features(element_id);

-- 세트/엘리먼트 기반 부분 유니크 제약 (NULL 허용 컬럼 대비 부분 인덱스)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pmf_set_element_color 
  ON parts_master_features(set_id, element_id, color_id)
  WHERE set_id IS NOT NULL AND element_id IS NOT NULL;

-- 14. 추가 메타 필드 (기술문서 5.3, 7.4)
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS scale_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS meta_penalty DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS semantic_score DECIMAL(3,2) DEFAULT 0.0;

-- 15. 식별 키 및 메타 필드 보강 (기술문서 7.2) - 중복 제거됨

-- 16. 부분 유니크 제약 (기술문서 7.2) - 중복 제거됨

-- 18. 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_set_element 
ON parts_master_features (set_id, element_id) 
WHERE set_id IS NOT NULL AND element_id IS NOT NULL;

-- 19. 성능 최적화 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_scale_type 
ON parts_master_features (scale_type) 
WHERE scale_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parts_master_features_meta_penalty 
ON parts_master_features (meta_penalty) 
WHERE meta_penalty > 0;

CREATE INDEX IF NOT EXISTS idx_parts_master_features_semantic_score 
ON parts_master_features (semantic_score) 
WHERE semantic_score > 0;

-- 20. 성능 최적화 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_performance 
ON parts_master_features (shape_tag, scale, stud_count_top, tube_count_bottom) 
WHERE shape_tag IS NOT NULL AND scale IS NOT NULL;

-- 21. 혼동군 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_confusions 
ON parts_master_features USING GIN (confusions) 
WHERE confusions IS NOT NULL;

-- 22. 구별 특징 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_distinguishing 
ON parts_master_features USING GIN (distinguishing_features) 
WHERE distinguishing_features IS NOT NULL;

-- 23. 시맨틱 벡터 인덱스 (기술문서 7.2) - IVFFlat 사용
CREATE INDEX IF NOT EXISTS idx_parts_master_features_semantic_vector 
ON parts_master_features USING ivfflat (semantic_vector vector_cosine_ops)
WITH (lists = 100)
WHERE semantic_vector IS NOT NULL;

-- 24. CLIP 텍스트 임베딩 인덱스 (기술문서 7.2) - IVFFlat 사용
CREATE INDEX IF NOT EXISTS idx_parts_master_features_clip_text_emb 
ON parts_master_features USING ivfflat (clip_text_emb vector_cosine_ops)
WITH (lists = 100)
WHERE clip_text_emb IS NOT NULL;

-- 25. 이미지 품질 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_image_quality 
ON parts_master_features USING GIN (image_quality) 
WHERE image_quality IS NOT NULL;

-- 26. 메타 소스 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_meta_source 
ON parts_master_features (meta_source) 
WHERE meta_source IS NOT NULL;

-- 27. 렌더 ID 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_render_id 
ON parts_master_features (render_id) 
WHERE render_id IS NOT NULL;

-- 28. 예상 스터드 수 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_expected_stud_count 
ON parts_master_features (expected_stud_count) 
WHERE expected_stud_count IS NOT NULL;

-- 29. 예상 구멍 수 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_expected_hole_count 
ON parts_master_features (expected_hole_count) 
WHERE expected_hole_count IS NOT NULL;

-- 30. 성능 최적화 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_performance_composite 
ON parts_master_features (shape_tag, scale, stud_count_top, tube_count_bottom, center_stud, groove) 
WHERE shape_tag IS NOT NULL AND scale IS NOT NULL;

-- 31. 혼동군 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_confusion_composite 
ON parts_master_features (shape_tag, confusions) 
WHERE shape_tag IS NOT NULL AND confusions IS NOT NULL;

-- 32. 구별 특징 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_distinguishing_composite 
ON parts_master_features (shape_tag, distinguishing_features) 
WHERE shape_tag IS NOT NULL AND distinguishing_features IS NOT NULL;

-- 33. 시맨틱 벡터 복합 인덱스 (기술문서 7.2) - VECTOR 타입은 별도 인덱스로 분리
CREATE INDEX IF NOT EXISTS idx_parts_master_features_semantic_composite 
ON parts_master_features (shape_tag) 
WHERE shape_tag IS NOT NULL;

-- 34. CLIP 텍스트 임베딩 복합 인덱스 (기술문서 7.2) - VECTOR 타입은 별도 인덱스로 분리
CREATE INDEX IF NOT EXISTS idx_parts_master_features_clip_composite 
ON parts_master_features (shape_tag) 
WHERE shape_tag IS NOT NULL;

-- 35. 이미지 품질 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_image_quality_composite 
ON parts_master_features (shape_tag, image_quality) 
WHERE shape_tag IS NOT NULL AND image_quality IS NOT NULL;

-- 36. 메타 소스 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_meta_source_composite 
ON parts_master_features (shape_tag, meta_source) 
WHERE shape_tag IS NOT NULL AND meta_source IS NOT NULL;

-- 37. 렌더 ID 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_render_id_composite 
ON parts_master_features (shape_tag, render_id) 
WHERE shape_tag IS NOT NULL AND render_id IS NOT NULL;

-- 38. 예상 스터드/구멍 수 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_expected_composite 
ON parts_master_features (shape_tag, expected_stud_count, expected_hole_count) 
WHERE shape_tag IS NOT NULL AND expected_stud_count IS NOT NULL AND expected_hole_count IS NOT NULL;

-- 39. 성능 최적화 고급 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_advanced_performance 
ON parts_master_features (shape_tag, scale, stud_count_top, tube_count_bottom, center_stud, groove, stud_pattern, tube_pattern) 
WHERE shape_tag IS NOT NULL AND scale IS NOT NULL;

-- 40. 혼동군 고급 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_advanced_confusion 
ON parts_master_features (shape_tag, confusions, distinguishing_features) 
WHERE shape_tag IS NOT NULL AND confusions IS NOT NULL AND distinguishing_features IS NOT NULL;

-- 41. 시맨틱 고급 복합 인덱스 (기술문서 7.2) - VECTOR 타입은 별도 인덱스로 분리
CREATE INDEX IF NOT EXISTS idx_parts_master_features_advanced_semantic 
ON parts_master_features (shape_tag, texture_class, is_printed, top_color_rgb, underside_type) 
WHERE shape_tag IS NOT NULL;

-- 42. 이미지 품질 고급 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_advanced_image_quality 
ON parts_master_features (shape_tag, image_quality, meta_source, render_id) 
WHERE shape_tag IS NOT NULL AND image_quality IS NOT NULL AND meta_source IS NOT NULL AND render_id IS NOT NULL;

-- 43. 예상 값 고급 복합 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_advanced_expected 
ON parts_master_features (shape_tag, expected_stud_count, expected_hole_count, scale_type, meta_penalty, semantic_score) 
WHERE shape_tag IS NOT NULL AND expected_stud_count IS NOT NULL AND expected_hole_count IS NOT NULL AND scale_type IS NOT NULL;

-- 44. 절대적 성능 최적화 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_absolute_performance 
ON parts_master_features (shape_tag, scale, stud_count_top, tube_count_bottom, center_stud, groove, stud_pattern, tube_pattern, hole_count, topo_applicable) 
WHERE shape_tag IS NOT NULL AND scale IS NOT NULL;

-- 45. 절대적 혼동군 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_absolute_confusion 
ON parts_master_features (shape_tag, confusions, distinguishing_features, texture_class, is_printed, top_color_rgb, underside_type) 
WHERE shape_tag IS NOT NULL AND confusions IS NOT NULL;

-- 46. 절대적 시맨틱 인덱스 (기술문서 7.2) - VECTOR 타입은 별도 인덱스로 분리
CREATE INDEX IF NOT EXISTS idx_parts_master_features_absolute_semantic 
ON parts_master_features (shape_tag, feature_text_score, semantic_score) 
WHERE shape_tag IS NOT NULL;

-- 47. 절대적 이미지 품질 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_absolute_image_quality 
ON parts_master_features (shape_tag, image_quality, image_quality_ssim, image_quality_snr, image_quality_q, image_quality_resolution, area_px, bbox_ratio, orientation) 
WHERE shape_tag IS NOT NULL AND image_quality IS NOT NULL;

-- 48. 절대적 메타데이터 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_absolute_metadata 
ON parts_master_features (shape_tag, meta_source, render_id, set_id, element_id, scale_type, meta_penalty) 
WHERE shape_tag IS NOT NULL AND meta_source IS NOT NULL;

-- 49. 최종 성능 최적화 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_final_performance 
ON parts_master_features (shape_tag, scale, stud_count_top, tube_count_bottom, center_stud, groove, stud_pattern, tube_pattern, hole_count, topo_applicable, confusions, distinguishing_features) 
WHERE shape_tag IS NOT NULL AND scale IS NOT NULL;

-- 50. 최종 시맨틱 인덱스 (기술문서 7.2) - VECTOR 타입은 별도 인덱스로 분리
CREATE INDEX IF NOT EXISTS idx_parts_master_features_final_semantic 
ON parts_master_features (shape_tag, feature_text_score, semantic_score, texture_class, is_printed, top_color_rgb, underside_type) 
WHERE shape_tag IS NOT NULL;

-- 51. 최종 이미지 품질 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_final_image_quality 
ON parts_master_features (shape_tag, image_quality, image_quality_ssim, image_quality_snr, image_quality_q, image_quality_resolution, area_px, bbox_ratio, orientation, meta_source, render_id) 
WHERE shape_tag IS NOT NULL AND image_quality IS NOT NULL;

-- 52. 최종 메타데이터 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_final_metadata 
ON parts_master_features (shape_tag, meta_source, render_id, set_id, element_id, scale_type, meta_penalty, expected_stud_count, expected_hole_count) 
WHERE shape_tag IS NOT NULL AND meta_source IS NOT NULL;

-- 53. 누락 보완 성능 최적화 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_missing_performance 
ON parts_master_features (shape_tag, scale, stud_count_top, tube_count_bottom, center_stud, groove, stud_pattern, tube_pattern, hole_count, topo_applicable, confusions, distinguishing_features, texture_class, is_printed, top_color_rgb, underside_type) 
WHERE shape_tag IS NOT NULL AND scale IS NOT NULL;

-- 54. 누락 보완 시맨틱 인덱스 (기술문서 7.2) - VECTOR 타입은 별도 인덱스로 분리
CREATE INDEX IF NOT EXISTS idx_parts_master_features_missing_semantic 
ON parts_master_features (shape_tag, feature_text_score, semantic_score, texture_class, is_printed, top_color_rgb, underside_type, meta_source, render_id) 
WHERE shape_tag IS NOT NULL;

-- 55. 누락 보완 이미지 품질 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_missing_image_quality 
ON parts_master_features (shape_tag, image_quality, image_quality_ssim, image_quality_snr, image_quality_q, image_quality_resolution, area_px, bbox_ratio, orientation, meta_source, render_id, set_id, element_id) 
WHERE shape_tag IS NOT NULL AND image_quality IS NOT NULL;

-- 56. 누락 보완 메타데이터 인덱스 (기술문서 7.2)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_missing_metadata 
ON parts_master_features (shape_tag, meta_source, render_id, set_id, element_id, scale_type, meta_penalty, expected_stud_count, expected_hole_count, semantic_score, feature_text_score) 
WHERE shape_tag IS NOT NULL AND meta_source IS NOT NULL;
