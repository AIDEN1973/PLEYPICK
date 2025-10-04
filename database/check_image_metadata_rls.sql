-- image_metadata 테이블 RLS 정책 확인 및 생성

-- 1. 현재 RLS 정책 확인
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'image_metadata';

-- 2. RLS 활성화 확인
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'image_metadata';

-- 3. 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "image_metadata_read_policy" ON image_metadata;
DROP POLICY IF EXISTS "image_metadata_insert_policy" ON image_metadata;
DROP POLICY IF EXISTS "image_metadata_update_policy" ON image_metadata;
DROP POLICY IF EXISTS "image_metadata_delete_policy" ON image_metadata;

-- 4. RLS 활성화
ALTER TABLE image_metadata ENABLE ROW LEVEL SECURITY;

-- 5. 기본 정책 생성
-- 읽기 정책 (모든 사용자)
CREATE POLICY "image_metadata_read_policy" ON image_metadata
FOR SELECT USING (true);

-- 삽입 정책 (인증된 사용자)
CREATE POLICY "image_metadata_insert_policy" ON image_metadata
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 업데이트 정책 (인증된 사용자)
CREATE POLICY "image_metadata_update_policy" ON image_metadata
FOR UPDATE USING (auth.role() = 'authenticated');

-- 삭제 정책 (인증된 사용자)
CREATE POLICY "image_metadata_delete_policy" ON image_metadata
FOR DELETE USING (auth.role() = 'authenticated');

-- 6. 정책 확인
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'image_metadata';
