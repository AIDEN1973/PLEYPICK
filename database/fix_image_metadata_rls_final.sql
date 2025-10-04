-- image_metadata 테이블 RLS 정책 완전 수정

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "image_metadata_read_policy" ON public.image_metadata;
DROP POLICY IF EXISTS "image_metadata_insert_policy" ON public.image_metadata;
DROP POLICY IF EXISTS "image_metadata_update_policy" ON public.image_metadata;
DROP POLICY IF EXISTS "image_metadata_delete_policy" ON public.image_metadata;

-- 2. RLS 활성화 확인
ALTER TABLE public.image_metadata ENABLE ROW LEVEL SECURITY;

-- 3. 새로운 정책 생성 (더 관대한 정책)
-- 모든 사용자에게 읽기 권한
CREATE POLICY "Allow all read access" ON public.image_metadata
FOR SELECT USING (true);

-- 모든 사용자에게 삽입 권한
CREATE POLICY "Allow all insert access" ON public.image_metadata
FOR INSERT WITH CHECK (true);

-- 모든 사용자에게 업데이트 권한
CREATE POLICY "Allow all update access" ON public.image_metadata
FOR UPDATE USING (true);

-- 모든 사용자에게 삭제 권한
CREATE POLICY "Allow all delete access" ON public.image_metadata
FOR DELETE USING (true);

-- 4. 정책 확인
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'image_metadata';
