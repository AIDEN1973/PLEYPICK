-- 기술문서 요구사항에 맞는 누락된 컬럼들 추가
-- parts_master_features 테이블에 필수 컬럼들 추가

-- 1. part_category 컬럼 추가 (One-hot 인코딩용)
ALTER TABLE parts_master_features
ADD COLUMN IF NOT EXISTS part_category INTEGER DEFAULT 0;

-- 2. meta_penalty 컬럼 추가 (토포로지 플래그)
ALTER TABLE parts_master_features
ADD COLUMN IF NOT EXISTS meta_penalty BOOLEAN DEFAULT FALSE;

-- 3. set_id, element_id, render_id 컬럼들 추가 (기본키)
ALTER TABLE parts_master_features
ADD COLUMN IF NOT EXISTS set_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS element_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS render_id UUID;

-- 4. expected_stud_count, expected_hole_count 컬럼들 추가 (기술문서 매핑)
ALTER TABLE parts_master_features
ADD COLUMN IF NOT EXISTS expected_stud_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_hole_count INTEGER DEFAULT 0;

-- 4. created_at 컬럼 추가 (생성 시간)
ALTER TABLE parts_master_features
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_part_category ON parts_master_features(part_category);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_meta_penalty ON parts_master_features(meta_penalty);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_set_id ON parts_master_features(set_id);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_element_id ON parts_master_features(element_id);
CREATE INDEX IF NOT EXISTS idx_parts_master_features_render_id ON parts_master_features(render_id);

-- 6. 제약조건 추가 (데이터 품질 보장)
-- part_category 제약조건 (0-7 범위)
ALTER TABLE parts_master_features
ADD CONSTRAINT IF NOT EXISTS chk_part_category
CHECK (part_category >= 0 AND part_category <= 7);

-- 7. 기존 데이터 마이그레이션
-- shape_tag를 기반으로 part_category 설정
UPDATE parts_master_features
SET part_category = CASE
  WHEN shape_tag = 'plate' THEN 1
  WHEN shape_tag = 'brick' THEN 2
  WHEN shape_tag = 'tile' THEN 3
  WHEN shape_tag = 'slope' THEN 4
  WHEN shape_tag = 'technic' THEN 5
  WHEN shape_tag = 'minifig' THEN 6
  WHEN shape_tag = 'duplo' THEN 7
  ELSE 0
END
WHERE part_category IS NULL OR part_category = 0;

-- topo_applicable을 기반으로 meta_penalty 설정
UPDATE parts_master_features
SET meta_penalty = COALESCE(
  (feature_json->>'topo_applicable')::boolean,
  false
)
WHERE meta_penalty IS NULL;

-- 8. 통계 정보 업데이트
ANALYZE parts_master_features;

-- 9. 스키마 수정 완료 확인
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'parts_master_features'
  AND column_name IN (
    'part_category', 'meta_penalty', 'set_id', 'element_id', 
    'render_id', 'created_at'
  )
ORDER BY column_name;
