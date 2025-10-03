-- image_metadata 테이블의 RLS 정책 수정
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Public read access for image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can insert image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can update image_metadata" ON image_metadata;
DROP POLICY IF EXISTS "Authenticated users can delete image_metadata" ON image_metadata;

-- 2. 새로운 RLS 정책 생성 (더 관대한 정책)
-- 모든 사용자가 읽기 가능
CREATE POLICY "Allow all read access for image_metadata" ON image_metadata
FOR SELECT USING (true);

-- 모든 사용자가 삽입 가능
CREATE POLICY "Allow all insert access for image_metadata" ON image_metadata
FOR INSERT WITH CHECK (true);

-- 모든 사용자가 업데이트 가능
CREATE POLICY "Allow all update access for image_metadata" ON image_metadata
FOR UPDATE USING (true);

-- 모든 사용자가 삭제 가능
CREATE POLICY "Allow all delete access for image_metadata" ON image_metadata
FOR DELETE USING (true);

-- 3. RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'image_metadata';

-- 4. 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'image_metadata';
