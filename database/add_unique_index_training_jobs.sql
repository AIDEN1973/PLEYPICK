-- 🔒 training_jobs.job_name 고유 인덱스 추가
-- ON CONFLICT (job_name) 사용 시 필요

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_jobs_job_name_unique
ON training_jobs (job_name);

-- 완료 메시지
SELECT '✅ training_jobs.job_name 고유 인덱스 생성/확인 완료' AS status;


