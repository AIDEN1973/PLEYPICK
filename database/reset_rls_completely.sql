-- RLS 정책 완전 리셋
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. RLS 비활성화
ALTER TABLE image_metadata DISABLE ROW LEVEL SECURITY;

-- 2. 모든 정책 삭제
DROP POLICY IF EXISTS "Allow all read access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Allow all insert access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Allow all update access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Allow all delete access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Public read access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can insert image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can update image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can delete image_metadata" ON image_metadata;

-- 3. RLS 다시 활성화
ALTER TABLE image_metadata ENABLE ROW LEVEL SECURITY;

-- 4. 간단한 정책 생성
CREATE POLICY "Allow all operations on image_metadata" ON image_metadata
FOR ALL USING (true) WITH CHECK (true);

-- 5. 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'image_metadata';

SELECT 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'image_metadata';
