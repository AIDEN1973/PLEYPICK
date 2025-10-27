-- parts_master_features 테이블 RLS 정책 수정
-- 403 Forbidden 오류 해결을 위한 권한 설정

-- 1. 기존 RLS 정책 확인 및 정리
DROP POLICY IF EXISTS parts_master_features_policy ON parts_master_features;

-- 2. RLS 활성화 (이미 활성화되어 있을 수 있음)
ALTER TABLE parts_master_features ENABLE ROW LEVEL SECURITY;

-- 3. 새로운 RLS 정책 생성 (authenticated 사용자에게 모든 권한 부여)
CREATE POLICY parts_master_features_policy ON parts_master_features
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 4. 추가 권한 설정
GRANT SELECT, INSERT, UPDATE, DELETE ON parts_master_features TO authenticated;
GRANT USAGE ON SEQUENCE parts_master_features_id_seq TO authenticated;

-- 5. 서비스 역할 권한 (백엔드 작업용)
GRANT SELECT, INSERT, UPDATE, DELETE ON parts_master_features TO service_role;
GRANT USAGE ON SEQUENCE parts_master_features_id_seq TO service_role;

-- 6. 인덱스 권한
GRANT SELECT ON parts_master_features TO anon;
GRANT SELECT ON parts_master_features TO authenticated;

-- 7. 확인 쿼리
-- 테이블 RLS 상태 확인
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'parts_master_features';

-- 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'parts_master_features';