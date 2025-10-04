-- 1단계: UUID를 안전하게 정수로 변환

-- 먼저 현재 데이터 확인
SELECT 'set_parts' as table_name, part_id, color_id, pg_typeof(part_id) as part_id_type, pg_typeof(color_id) as color_id_type 
FROM set_parts LIMIT 3;

SELECT 'part_images' as table_name, part_id, color_id, pg_typeof(part_id) as part_id_type, pg_typeof(color_id) as color_id_type 
FROM part_images LIMIT 3;

-- 1. set_parts 테이블의 part_id를 character varying으로 변경
ALTER TABLE set_parts 
ALTER COLUMN part_id TYPE character varying USING part_id::text;

-- 2. set_parts 테이블의 color_id를 integer로 변경
-- UUID를 정수로 변환하는 더 안전한 방법
ALTER TABLE set_parts 
ALTER COLUMN color_id TYPE integer USING 
  CASE 
    WHEN color_id IS NULL THEN NULL
    ELSE abs(hashtext(color_id::text)) % 2147483647  -- PostgreSQL INT_MAX 범위 내에서
  END;

-- 3. part_images 테이블의 part_id를 character varying으로 변경
ALTER TABLE part_images 
ALTER COLUMN part_id TYPE character varying USING part_id::text;

-- 4. part_images 테이블의 color_id를 integer로 변경
ALTER TABLE part_images 
ALTER COLUMN color_id TYPE integer USING 
  CASE 
    WHEN color_id IS NULL THEN NULL
    ELSE abs(hashtext(color_id::text)) % 2147483647  -- PostgreSQL INT_MAX 범위 내에서
  END;

-- 5. parts_master_features 테이블에 UNIQUE 제약 추가
-- 기존 제약 조건이 있으면 제거 후 추가
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS unique_part_color;

ALTER TABLE parts_master_features 
ADD CONSTRAINT unique_part_color UNIQUE (part_id, color_id);

-- 변환 후 데이터 확인
SELECT 'set_parts' as table_name, part_id, color_id, pg_typeof(part_id) as part_id_type, pg_typeof(color_id) as color_id_type 
FROM set_parts LIMIT 3;

SELECT 'part_images' as table_name, part_id, color_id, pg_typeof(part_id) as part_id_type, pg_typeof(color_id) as color_id_type 
FROM part_images LIMIT 3;
