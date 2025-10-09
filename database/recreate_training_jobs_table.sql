-- 🔧 training_jobs 테이블 완전 재생성
-- ON CONFLICT 문제 완전 해결

-- 1. 기존 테이블 백업 (데이터 보존)
CREATE TABLE IF NOT EXISTS training_jobs_backup AS 
SELECT * FROM training_jobs;

-- 2. 기존 테이블 삭제
DROP TABLE IF EXISTS training_jobs CASCADE;

-- 3. 새로운 테이블 생성 (UNIQUE 제약조건 포함)
CREATE TABLE training_jobs (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(255) NOT NULL UNIQUE,  -- UNIQUE 제약조건 직접 추가
    dataset_id INTEGER,
    colab_session_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    config JSONB DEFAULT '{}',
    progress JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_created_at ON training_jobs(created_at);

-- 5. RLS 정책 설정
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모든 사용자)
CREATE POLICY "Anyone can read training_jobs" ON training_jobs FOR SELECT USING (true);

-- 관리 권한 (서비스 역할)
CREATE POLICY "Service role can manage training_jobs" ON training_jobs 
FOR ALL USING (auth.role() = 'service_role');

-- 6. 완료 메시지
SELECT '✅ training_jobs 테이블 재생성 완료!' as status;
