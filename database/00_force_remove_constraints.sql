-- 0단계: 강제로 모든 외래키 제약 조건 제거

-- 1. 모든 테이블의 외래키 제약 조건 확인
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints AS tc 
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('set_parts', 'parts_master_features', 'part_images', 'lego_parts', 'lego_colors')
ORDER BY tc.table_name, tc.constraint_name;

-- 2. set_parts 테이블의 모든 외래키 제약 제거
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'set_parts' 
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE set_parts DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
    END LOOP;
END $$;

-- 3. parts_master_features 테이블의 모든 외래키 제약 제거
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'parts_master_features' 
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE parts_master_features DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
    END LOOP;
END $$;

-- 4. part_images 테이블의 모든 외래키 제약 제거
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'part_images' 
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE part_images DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
    END LOOP;
END $$;

-- 5. UNIQUE 제약 제거
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS unique_part_color;

-- 6. 제거 후 상태 확인
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints AS tc 
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('set_parts', 'parts_master_features', 'part_images')
ORDER BY tc.table_name, tc.constraint_name;
