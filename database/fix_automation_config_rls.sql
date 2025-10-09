-- 🔧 automation_config 테이블 RLS 정책 수정
-- 일반 사용자도 읽기/쓰기 가능하도록 수정

-- 기존 모든 정책 삭제
DROP POLICY IF EXISTS "Service role can manage automation_config" ON automation_config;
DROP POLICY IF EXISTS "Anyone can read automation_config" ON automation_config;
DROP POLICY IF EXISTS "Anyone can manage automation_config" ON automation_config;

-- 새로운 정책 생성
-- 1. 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can read automation_config" ON automation_config FOR SELECT USING (true);

-- 2. 모든 사용자가 쓰기 가능 (자동 학습 설정용)
CREATE POLICY "Anyone can manage automation_config" ON automation_config FOR ALL USING (true);

-- 완료 메시지
SELECT '✅ automation_config RLS 정책 수정 완료!' as status;
