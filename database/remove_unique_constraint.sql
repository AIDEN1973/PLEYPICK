-- set_parts 테이블의 UNIQUE 제약 조건 제거
-- 이렇게 하면 중복 데이터를 허용하여 모든 부품이 저장됩니다.

-- 1. 기존 UNIQUE 제약 조건 삭제
ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS set_parts_set_id_part_id_color_id_element_id_key;

-- 2. 확인 쿼리
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'set_parts'::regclass 
AND contype = 'u';

-- 3. 현재 데이터 확인
SELECT COUNT(*) as total_parts FROM set_parts;
SELECT COUNT(DISTINCT set_id) as unique_sets FROM set_parts;
