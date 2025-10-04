-- RLS 일시적으로 비활성화 (테스트용)
ALTER TABLE parts_master_features DISABLE ROW LEVEL SECURITY;

-- 상태 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'parts_master_features';
