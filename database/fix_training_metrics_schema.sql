-- 🔧 training_metrics 테이블 구조 수정
-- 노트북의 JSONB metrics 구조에 맞게 수정

-- 기존 테이블 삭제 (데이터가 있다면 백업 후)
DROP TABLE IF EXISTS training_metrics CASCADE;

-- 새로운 구조로 재생성
CREATE TABLE training_metrics (
    id SERIAL PRIMARY KEY,
    training_job_id INTEGER REFERENCES training_jobs(id),
    epoch INTEGER NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',  -- 모든 메트릭을 JSONB로 저장
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_training_metrics_job_id ON training_metrics(training_job_id);
CREATE INDEX IF NOT EXISTS idx_training_metrics_epoch ON training_metrics(epoch);
CREATE INDEX IF NOT EXISTS idx_training_metrics_created_at ON training_metrics(created_at);

-- RLS 정책 설정
ALTER TABLE training_metrics ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모든 사용자)
CREATE POLICY "Anyone can read training_metrics" ON training_metrics FOR SELECT USING (true);

-- 관리 권한 (서비스 역할)
CREATE POLICY "Service role can manage training_metrics" ON training_metrics 
FOR ALL USING (auth.role() = 'service_role');

-- 완료 메시지
SELECT '✅ training_metrics 테이블 구조 수정 완료!' as status;
