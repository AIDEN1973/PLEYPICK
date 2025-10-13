-- set_parts 테이블 RLS 정책 수정
-- 406 Not Acceptable 오류 해결

-- 1. 기존 정책 확인 및 삭제
DROP POLICY IF EXISTS "Public read access for set_parts" ON public.set_parts;
DROP POLICY IF EXISTS "Users can insert set_parts" ON public.set_parts;
DROP POLICY IF EXISTS "Users can update set_parts" ON public.set_parts;
DROP POLICY IF EXISTS "Users can delete set_parts" ON public.set_parts;
DROP POLICY IF EXISTS "Allow all read access" ON public.set_parts;
DROP POLICY IF EXISTS "Allow all insert access" ON public.set_parts;
DROP POLICY IF EXISTS "Allow all update access" ON public.set_parts;
DROP POLICY IF EXISTS "Allow all delete access" ON public.set_parts;

-- 2. RLS 활성화 확인
ALTER TABLE public.set_parts ENABLE ROW LEVEL SECURITY;

-- 3. 새로운 정책 생성
-- 읽기 권한 (모든 사용자)
CREATE POLICY "Allow all read access" ON public.set_parts
FOR SELECT USING (true);

-- 삽입 권한 (모든 사용자)
CREATE POLICY "Allow all insert access" ON public.set_parts
FOR INSERT WITH CHECK (true);

-- 업데이트 권한 (모든 사용자)
CREATE POLICY "Allow all update access" ON public.set_parts
FOR UPDATE USING (true);

-- 삭제 권한 (모든 사용자)
CREATE POLICY "Allow all delete access" ON public.set_parts
FOR DELETE USING (true);

-- 4. 정책 확인
SELECT 
  policyname, 
  cmd, 
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'set_parts'
ORDER BY policyname;

-- 5. 테이블 RLS 상태 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'set_parts';
