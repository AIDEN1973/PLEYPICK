-- RLS 완전 비활성화
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. RLS 비활성화
ALTER TABLE image_metadata DISABLE ROW LEVEL SECURITY;

-- 2. 모든 정책 삭제
DROP POLICY IF EXISTS "Allow all operations on image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Allow all read access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Allow all insert access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Allow all update access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Allow all delete access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Public read access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can insert image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can update image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can delete image_metadata" ON image_metadata;

-- 3. 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'image_metadata';

-- 4. 정책 확인 (0개여야 함)
SELECT COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'image_metadata';
