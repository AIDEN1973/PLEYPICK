-- 1단계: 데이터 타입 수정 (안전한 방법)

-- 먼저 데이터 확인
SELECT 'set_parts' as table_name, part_id, color_id FROM set_parts LIMIT 5;
SELECT 'part_images' as table_name, part_id, color_id FROM part_images LIMIT 5;

-- 1. set_parts 테이블의 part_id를 character varying으로 변경
-- UUID를 문자열로 변환
ALTER TABLE set_parts 
ALTER COLUMN part_id TYPE character varying USING part_id::text;

-- 2. set_parts 테이블의 color_id를 integer로 변경
-- UUID를 정수로 변환 (UUID의 해시값 사용)
ALTER TABLE set_parts 
ALTER COLUMN color_id TYPE integer USING ('x' || substr(color_id::text, 1, 8))::bit(32)::int;

-- 3. part_images 테이블의 part_id를 character varying으로 변경
ALTER TABLE part_images 
ALTER COLUMN part_id TYPE character varying USING part_id::text;

-- 4. part_images 테이블의 color_id를 integer로 변경
ALTER TABLE part_images 
ALTER COLUMN color_id TYPE integer USING ('x' || substr(color_id::text, 1, 8))::bit(32)::int;

-- 5. parts_master_features 테이블에 UNIQUE 제약 추가
ALTER TABLE parts_master_features 
ADD CONSTRAINT unique_part_color UNIQUE (part_id, color_id);
