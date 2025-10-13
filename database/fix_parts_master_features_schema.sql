-- parts_master_features 테이블 스키마 수정
-- 기술문서 요구사항에 맞게 누락된 필드들 추가

-- 1. 누락된 필드들 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS shape_tag VARCHAR(50),
ADD COLUMN IF NOT EXISTS scale VARCHAR(20),
ADD COLUMN IF NOT EXISTS stud_pattern VARCHAR(20),
ADD COLUMN IF NOT EXISTS tube_pattern VARCHAR(20),
ADD COLUMN IF NOT EXISTS bbox_ratio REAL[],
ADD COLUMN IF NOT EXISTS area_px INTEGER,
ADD COLUMN IF NOT EXISTS orientation VARCHAR(20),
ADD COLUMN IF NOT EXISTS texture_class VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS top_color_rgb REAL[],
ADD COLUMN IF NOT EXISTS underside_type VARCHAR(20);

-- 2. 기존 필드명 수정 (기술문서와 일치시키기)
-- stud_count_top -> expected_stud_count (이미 있음)
-- tube_count_bottom -> expected_hole_count (이미 있음)

-- 3. 이미지 품질 필드들 확인 및 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS image_quality_ssim REAL,
ADD COLUMN IF NOT EXISTS image_quality_snr REAL,
ADD COLUMN IF NOT EXISTS image_quality_q REAL,
ADD COLUMN IF NOT EXISTS image_quality_resolution INTEGER;

-- 4. 메타데이터 소스 필드 추가
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS meta_source VARCHAR(50) DEFAULT 'llm_analysis_v1';

-- 5. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_shape_tag ON parts_master_features(shape_tag);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_scale ON parts_master_features(scale);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_orientation ON parts_master_features(orientation);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_texture_class ON parts_master_features(texture_class);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_meta_source ON parts_master_features(meta_source);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_stud_pattern ON parts_master_features(stud_pattern);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_tube_pattern ON parts_master_features(tube_pattern);

-- 6. 제약조건 추가 (데이터 품질 보장)
-- 기존 제약조건 삭제 후 재생성
DO $$ 
BEGIN
    -- shape_tag 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_shape_tag' AND table_name = 'parts_master_features') THEN
        ALTER TABLE parts_master_features 
        ADD CONSTRAINT chk_shape_tag 
        CHECK (shape_tag IN ('plate', 'brick', 'tile', 'slope', 'technic', 'minifig', 'duplo', 'unknown'));
    END IF;
    
    -- scale 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_scale' AND table_name = 'parts_master_features') THEN
        ALTER TABLE parts_master_features 
        ADD CONSTRAINT chk_scale 
        CHECK (scale IN ('duplo', 'system', 'minifig', 'technic'));
    END IF;
    
    -- orientation 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_orientation' AND table_name = 'parts_master_features') THEN
        ALTER TABLE parts_master_features 
        ADD CONSTRAINT chk_orientation 
        CHECK (orientation IN ('top', 'side', 'bottom'));
    END IF;
    
    -- texture_class 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_texture_class' AND table_name = 'parts_master_features') THEN
        ALTER TABLE parts_master_features 
        ADD CONSTRAINT chk_texture_class 
        CHECK (texture_class IN ('matte', 'glossy', 'transparent', 'metallic'));
    END IF;
    
    -- underside_type 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_underside_type' AND table_name = 'parts_master_features') THEN
        ALTER TABLE parts_master_features 
        ADD CONSTRAINT chk_underside_type 
        CHECK (underside_type IN ('solid_tube', 'hollow', 'mixed'));
    END IF;
    
    -- image_quality_ssim 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_image_quality_ssim' AND table_name = 'parts_master_features') THEN
        ALTER TABLE parts_master_features 
        ADD CONSTRAINT chk_image_quality_ssim 
        CHECK (image_quality_ssim IS NULL OR (image_quality_ssim >= 0.0 AND image_quality_ssim <= 1.0));
    END IF;
    
    -- image_quality_snr 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_image_quality_snr' AND table_name = 'parts_master_features') THEN
        ALTER TABLE parts_master_features 
        ADD CONSTRAINT chk_image_quality_snr 
        CHECK (image_quality_snr IS NULL OR image_quality_snr >= 0.0);
    END IF;
    
    -- image_quality_q 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_image_quality_q' AND table_name = 'parts_master_features') THEN
        ALTER TABLE parts_master_features 
        ADD CONSTRAINT chk_image_quality_q 
        CHECK (image_quality_q IS NULL OR (image_quality_q >= 0.0 AND image_quality_q <= 1.0));
    END IF;
END $$;

-- 8. 기존 데이터 마이그레이션 (필요시)
-- shape_tag 필드가 비어있는 경우 feature_json에서 추출
UPDATE parts_master_features 
SET shape_tag = COALESCE(
  feature_json->>'shape_tag',
  CASE 
    WHEN feature_json->>'shape' ILIKE '%plate%' THEN 'plate'
    WHEN feature_json->>'shape' ILIKE '%brick%' THEN 'brick'
    WHEN feature_json->>'shape' ILIKE '%tile%' THEN 'tile'
    WHEN feature_json->>'shape' ILIKE '%slope%' THEN 'slope'
    WHEN feature_json->>'shape' ILIKE '%technic%' THEN 'technic'
    ELSE 'unknown'
  END
)
WHERE shape_tag IS NULL;

-- scale 필드 마이그레이션
UPDATE parts_master_features 
SET scale = COALESCE(
  feature_json->>'scale',
  feature_json->>'scale_type',
  CASE 
    WHEN feature_json->>'size_category' ILIKE '%duplo%' THEN 'duplo'
    WHEN feature_json->>'size_category' ILIKE '%minifig%' THEN 'minifig'
    WHEN feature_json->>'size_category' ILIKE '%technic%' THEN 'technic'
    ELSE 'system'
  END
)
WHERE scale IS NULL;

-- 9. 통계 정보 업데이트
ANALYZE parts_master_features;

-- 10. 스키마 수정 완료 확인
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'parts_master_features' 
  AND column_name IN (
    'shape_tag', 'scale', 'stud_pattern', 'tube_pattern', 'bbox_ratio', 
    'area_px', 'orientation', 'texture_class', 'is_printed', 
    'top_color_rgb', 'underside_type', 'image_quality_ssim', 
    'image_quality_snr', 'image_quality_q', 'image_quality_resolution', 
    'meta_source'
  )
ORDER BY column_name;
