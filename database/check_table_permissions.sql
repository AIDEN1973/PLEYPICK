-- image_metadata 테이블 권한 확인
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 테이블 존재 확인
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'image_metadata';

-- 2. 컬럼 정보 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'image_metadata'
ORDER BY ordinal_position;

-- 3. 인덱스 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'image_metadata';

-- 4. 테이블 권한 확인
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'image_metadata';
