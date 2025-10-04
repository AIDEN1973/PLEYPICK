-- 1. 현재 RLS 상태 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'parts_master_features';

-- 2. 현재 정책 확인
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'parts_master_features';

-- 3. 테이블 데이터 확인
SELECT COUNT(*) as total_records FROM parts_master_features;

-- 4. 샘플 데이터 확인
SELECT part_id, color_id, created_at 
FROM parts_master_features 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. RLS 완전히 비활성화
ALTER TABLE parts_master_features DISABLE ROW LEVEL SECURITY;

-- 6. 상태 재확인
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'parts_master_features';
