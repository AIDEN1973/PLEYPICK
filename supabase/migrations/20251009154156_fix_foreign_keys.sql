-- 🧱 BrickBox 외래키 관계 수정
-- model_registry와 training_jobs 간의 관계 설정

-- 기존 외래키 제약조건 제거 (있는 경우)
ALTER TABLE model_registry DROP CONSTRAINT IF EXISTS model_registry_training_job_id_fkey;
ALTER TABLE training_metrics DROP CONSTRAINT IF EXISTS training_metrics_training_job_id_fkey;

-- 외래키 제약조건 추가
ALTER TABLE model_registry 
ADD CONSTRAINT model_registry_training_job_id_fkey 
FOREIGN KEY (training_job_id) REFERENCES training_jobs(id) ON DELETE SET NULL;

ALTER TABLE training_metrics 
ADD CONSTRAINT training_metrics_training_job_id_fkey 
FOREIGN KEY (training_job_id) REFERENCES training_jobs(id) ON DELETE CASCADE;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_model_registry_training_job_id ON model_registry(training_job_id);
CREATE INDEX IF NOT EXISTS idx_training_metrics_training_job_id ON training_metrics(training_job_id);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 외래키 관계 설정 완료!';
    RAISE NOTICE '📊 model_registry.training_job_id → training_jobs.id';
    RAISE NOTICE '📊 training_metrics.training_job_id → training_jobs.id';
END $$;
