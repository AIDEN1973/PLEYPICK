-- 기존 세트 데이터 삭제 (21247-1)
-- 주의: 이 쿼리는 기존 데이터를 완전히 삭제합니다.

-- 1. 먼저 해당 세트의 ID 확인
SELECT id, set_num, name FROM lego_sets WHERE set_num = '21247-1';

-- 2. 해당 세트의 부품 관계 삭제
DELETE FROM set_parts 
WHERE set_id = (SELECT id FROM lego_sets WHERE set_num = '21247-1');

-- 3. 세트 정보 삭제
DELETE FROM lego_sets 
WHERE set_num = '21247-1';

-- 4. 삭제 확인
SELECT COUNT(*) as remaining_parts FROM set_parts 
WHERE set_id = (SELECT id FROM lego_sets WHERE set_num = '21247-1');
