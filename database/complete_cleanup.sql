-- 완전한 데이터 정리 스크립트
-- 주의: 이 스크립트는 모든 set_parts 데이터를 삭제합니다.

-- 1. 모든 set_parts 데이터 삭제
DELETE FROM set_parts;

-- 2. 모든 lego_sets 데이터 삭제
DELETE FROM lego_sets;

-- 3. 모든 lego_parts 데이터 삭제
DELETE FROM lego_parts;

-- 4. 모든 lego_colors 데이터 삭제
DELETE FROM lego_colors;

-- 5. UNIQUE 제약 조건 제거
ALTER TABLE set_parts DROP CONSTRAINT IF EXISTS set_parts_unique_constraint;
ALTER TABLE set_parts DROP CONSTRAINT IF EXISTS set_parts_set_id_part_id_color_id_element_id_key;
ALTER TABLE set_parts DROP CONSTRAINT IF EXISTS unique_set_part_color_element;

-- 6. 확인
SELECT COUNT(*) as remaining_set_parts FROM set_parts;
SELECT COUNT(*) as remaining_lego_sets FROM lego_sets;
SELECT COUNT(*) as remaining_lego_parts FROM lego_parts;
SELECT COUNT(*) as remaining_lego_colors FROM lego_colors;
