-- RLS 정책 수정 (즉시 적용)

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "parts_master_features_read_policy" ON parts_master_features;
DROP POLICY IF EXISTS "parts_master_features_write_policy" ON parts_master_features;

-- 2. 모든 사용자가 읽기 가능하도록 정책 생성
CREATE POLICY "parts_master_features_read_policy" ON parts_master_features
  FOR SELECT USING (true);

-- 3. 인증된 사용자만 쓰기 가능하도록 정책 생성  
CREATE POLICY "parts_master_features_write_policy" ON parts_master_features
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. 정책 확인
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'parts_master_features';
