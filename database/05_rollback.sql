-- 5단계: 문제 발생 시 롤백 스크립트

-- 1. 외래키 제약 조건 제거
ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS fk_set_parts_part_id;

ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS fk_set_parts_color_id;

ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS fk_parts_master_features_part_id;

ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS fk_parts_master_features_color_id;

ALTER TABLE part_images 
DROP CONSTRAINT IF EXISTS fk_part_images_part_id;

ALTER TABLE part_images 
DROP CONSTRAINT IF EXISTS fk_part_images_color_id;

-- 2. UNIQUE 제약 제거
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS unique_part_color;

-- 3. 데이터 타입 원복 (필요시)
-- 주의: 이 단계는 데이터 손실을 일으킬 수 있습니다
-- ALTER TABLE set_parts ALTER COLUMN part_id TYPE uuid USING part_id::uuid;
-- ALTER TABLE set_parts ALTER COLUMN color_id TYPE uuid USING color_id::uuid;
-- ALTER TABLE part_images ALTER COLUMN part_id TYPE uuid USING part_id::uuid;
-- ALTER TABLE part_images ALTER COLUMN color_id TYPE uuid USING color_id::uuid;
