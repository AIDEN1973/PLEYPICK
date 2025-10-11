-- Supabase 실시간 구독 활성화 스크립트
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 1. training_jobs 테이블에 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE training_jobs;

-- 2. training_metrics 테이블에 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE training_metrics;

-- 3. model_registry 테이블에 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE model_registry;

-- 4. RLS (Row Level Security) 정책 확인 및 설정
-- training_jobs 테이블 RLS 확인
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('training_jobs', 'training_metrics', 'model_registry');

-- RLS가 활성화되어 있지 않다면 활성화
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;

-- 5. 기본 RLS 정책 생성 (모든 사용자가 읽기/쓰기 가능)
-- training_jobs 정책
CREATE POLICY "Enable all access for training_jobs" ON training_jobs
    FOR ALL USING (true) WITH CHECK (true);

-- training_metrics 정책
CREATE POLICY "Enable all access for training_metrics" ON training_metrics
    FOR ALL USING (true) WITH CHECK (true);

-- model_registry 정책
CREATE POLICY "Enable all access for model_registry" ON model_registry
    FOR ALL USING (true) WITH CHECK (true);

-- 6. 실시간 구독 상태 확인
SELECT 
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('training_jobs', 'training_metrics', 'model_registry');

-- 7. 실시간 구독이 활성화된 테이블 목록 확인
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('training_jobs', 'training_metrics', 'model_registry');
