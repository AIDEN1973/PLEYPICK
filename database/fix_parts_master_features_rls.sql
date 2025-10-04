-- parts_master_features 테이블 RLS 정책 수정

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "parts_master_features_read_policy" ON public.parts_master_features;
DROP POLICY IF EXISTS "parts_master_features_insert_policy" ON public.parts_master_features;
DROP POLICY IF EXISTS "parts_master_features_update_policy" ON public.parts_master_features;
DROP POLICY IF EXISTS "parts_master_features_delete_policy" ON public.parts_master_features;

-- 2. RLS 활성화 확인
ALTER TABLE public.parts_master_features ENABLE ROW LEVEL SECURITY;

-- 3. 새로운 정책 생성 (더 관대한 정책)
-- 모든 사용자에게 읽기 권한
CREATE POLICY "Allow all read access" ON public.parts_master_features
FOR SELECT USING (true);

-- 모든 사용자에게 삽입 권한
CREATE POLICY "Allow all insert access" ON public.parts_master_features
FOR INSERT WITH CHECK (true);

-- 모든 사용자에게 업데이트 권한
CREATE POLICY "Allow all update access" ON public.parts_master_features
FOR UPDATE USING (true);

-- 모든 사용자에게 삭제 권한
CREATE POLICY "Allow all delete access" ON public.parts_master_features
FOR DELETE USING (true);

-- 4. 정책 확인
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'parts_master_features';
