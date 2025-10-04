-- 0단계: 기존 외래키 제약 조건 제거 (먼저 실행)

-- 1. set_parts 테이블의 기존 외래키 제약 제거
ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS set_parts_part_id_fkey;

ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS set_parts_color_id_fkey;

ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS fk_set_parts_part_id;

ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS fk_set_parts_color_id;

-- 2. parts_master_features 테이블의 기존 외래키 제약 제거
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS fk_parts_master_features_part_id;

ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS fk_parts_master_features_color_id;

-- 3. part_images 테이블의 기존 외래키 제약 제거
ALTER TABLE part_images 
DROP CONSTRAINT IF EXISTS fk_part_images_part_id;

ALTER TABLE part_images 
DROP CONSTRAINT IF EXISTS fk_part_images_color_id;

-- 4. UNIQUE 제약 제거
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS unique_part_color;

-- 5. 모든 외래키 제약 조건 확인
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints AS tc 
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('set_parts', 'parts_master_features', 'part_images')
ORDER BY tc.table_name, tc.constraint_name;
