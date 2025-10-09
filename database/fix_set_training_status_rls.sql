-- 🔧 set_training_status 테이블 RLS 정책 수정

-- 기존 정책 모두 삭제 (모든 가능한 정책명 확인)
DROP POLICY IF EXISTS "Anyone can read set_training_status" ON set_training_status;
DROP POLICY IF EXISTS "Service role can manage set_training_status" ON set_training_status;
DROP POLICY IF EXISTS "Anyone can manage set_training_status" ON set_training_status;
DROP POLICY IF EXISTS "Public read access for set_training_status" ON set_training_status;
DROP POLICY IF EXISTS "Service role can manage set_training_status" ON set_training_status;

-- RLS 비활성화 후 재활성화 (정책 초기화)
ALTER TABLE set_training_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE set_training_status ENABLE ROW LEVEL SECURITY;

-- 새로운 정책 생성
-- 1. 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can read set_training_status" ON set_training_status FOR SELECT USING (true);

-- 2. 모든 사용자가 쓰기 가능 (세트 학습 상태 관리용)
CREATE POLICY "Anyone can manage set_training_status" ON set_training_status FOR ALL USING (true);

-- 완료 메시지
SELECT '✅ set_training_status RLS 정책 수정 완료!' as status;
