-- 외래키 제약 조건 제거 (문제 발생 시 사용)

-- 1. set_parts 테이블의 외래키 제약 제거
ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS fk_set_parts_part_id;

ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS fk_set_parts_color_id;

-- 2. parts_master_features 테이블의 외래키 제약 제거
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS fk_parts_master_features_part_id;

ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS fk_parts_master_features_color_id;

-- 3. part_images 테이블의 외래키 제약 제거
ALTER TABLE part_images 
DROP CONSTRAINT IF EXISTS fk_part_images_part_id;

ALTER TABLE part_images 
DROP CONSTRAINT IF EXISTS fk_part_images_color_id;

-- 4. UNIQUE 제약도 제거 (필요시)
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS unique_part_color;
