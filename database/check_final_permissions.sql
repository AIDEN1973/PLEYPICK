-- 최종 권한 및 상태 확인
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 테이블 존재 및 RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'image_metadata';

-- 2. 컬럼 정보 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'image_metadata'
ORDER BY ordinal_position;

-- 3. 테이블 권한 확인
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'image_metadata';

-- 4. 간단한 조회 테스트
SELECT COUNT(*) as total_records FROM image_metadata;

-- 5. 특정 부품 조회 테스트
SELECT 
    part_num,
    color_id,
    supabase_url
FROM image_metadata 
WHERE part_num = '3003' 
LIMIT 3;
