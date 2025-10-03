-- set_parts 테이블의 UNIQUE 제약조건 추가
-- 이 스크립트는 Supabase Dashboard의 SQL Editor에서 실행하세요

-- 1. 기존 UNIQUE 제약조건 확인
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name
FROM 
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
WHERE 
    tc.table_name = 'set_parts' 
    AND tc.constraint_type = 'UNIQUE';

-- 2. set_parts 테이블에 UNIQUE 제약조건 추가
ALTER TABLE set_parts 
ADD CONSTRAINT set_parts_unique_constraint 
UNIQUE (set_id, part_id, color_id, element_id);

-- 3. 제약조건 확인
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name
FROM 
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
WHERE 
    tc.table_name = 'set_parts' 
    AND tc.constraint_type = 'UNIQUE';

-- 완료 메시지
SELECT 'set_parts 테이블에 UNIQUE 제약조건이 성공적으로 추가되었습니다.' as message;
