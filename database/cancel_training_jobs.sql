-- 🧱 기존 학습 작업 취소
-- Supabase SQL Editor에서 실행

-- 1. 실행 중인 학습 작업들을 cancelled로 변경
UPDATE training_jobs 
SET 
    status = 'cancelled',
    error_message = '사용자에 의해 취소됨',
    updated_at = NOW()
WHERE status IN ('pending', 'running');

-- 2. 취소된 작업들 확인
SELECT 
    id,
    job_name,
    status,
    started_at,
    completed_at,
    error_message,
    created_at
FROM training_jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. 기존 메트릭 정리 (선택사항)
-- DELETE FROM training_metrics WHERE training_job_id IN (SELECT id FROM training_jobs WHERE status = 'cancelled');

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 기존 학습 작업 취소 완료!';
    RAISE NOTICE '🔄 이제 새로운 학습을 시작할 수 있습니다.';
END $$;
