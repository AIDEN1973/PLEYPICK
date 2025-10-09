-- 🔍 training_jobs 테이블 상태 확인 및 수정

-- 1. 현재 제약조건 확인
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'training_jobs'::regclass
AND contype = 'u';

-- 2. job_name 컬럼의 인덱스 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'training_jobs'
AND indexdef LIKE '%job_name%';

-- 3. 기존 UNIQUE 제약조건 삭제 (있다면)
ALTER TABLE training_jobs DROP CONSTRAINT IF EXISTS unique_training_jobs_job_name;

-- 4. 새로운 UNIQUE 제약조건 추가
ALTER TABLE training_jobs 
ADD CONSTRAINT unique_training_jobs_job_name UNIQUE (job_name);

-- 5. 제약조건 확인
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'training_jobs'::regclass
AND contype = 'u';

-- 완료 메시지
SELECT '✅ training_jobs UNIQUE 제약조건 설정 완료!' as status;
