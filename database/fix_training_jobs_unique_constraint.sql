-- 🔧 training_jobs 테이블 UNIQUE 제약조건 추가
-- ON CONFLICT 오류 해결을 위한 고유 제약조건

-- 1. 기존 중복 데이터 확인
SELECT job_name, COUNT(*) as count
FROM training_jobs
GROUP BY job_name
HAVING COUNT(*) > 1;

-- 2. 중복 데이터가 있다면 최신 것만 남기고 삭제
WITH ranked_jobs AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY job_name ORDER BY created_at DESC) as rn
  FROM training_jobs
)
DELETE FROM training_jobs
WHERE id IN (
  SELECT id FROM ranked_jobs WHERE rn > 1
);

-- 3. job_name에 UNIQUE 제약조건 추가
ALTER TABLE training_jobs 
ADD CONSTRAINT unique_training_jobs_job_name UNIQUE (job_name);

-- 4. 완료 메시지
SELECT '✅ training_jobs.job_name UNIQUE 제약조건 추가 완료!' as status;
