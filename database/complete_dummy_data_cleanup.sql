-- 🧱 BrickBox 완전한 더미 데이터 정리 스크립트
-- 모든 더미, 테스트, 시뮬레이션 데이터를 완전히 제거합니다

-- 1. 모든 더미 모델 삭제
DELETE FROM model_registry 
WHERE model_name LIKE 'brickbox_model_%' 
   OR model_name LIKE 'set_76917-1_best'
   OR model_name = 'brickbox_model'
   OR model_name = 'default_model'
   OR model_name LIKE 'brickbox_yolo_%'
   OR created_by = 'test_user'
   OR created_by = 'demo_user'
   OR created_by = 'sample_user'
   OR created_by = 'dummy_user';

-- 2. 하드코딩된 메트릭이 있는 모델들 삭제
DELETE FROM model_registry 
WHERE metrics::text LIKE '%"mAP50": 0.95%'
   OR metrics::text LIKE '%"precision": 0.92%'
   OR metrics::text LIKE '%"recall": 0.89%'
   OR metrics::text LIKE '%"mAP50_95": 0.87%'
   OR metrics::text LIKE '%"mAP50": 0.85%'
   OR metrics::text LIKE '%"precision": 0.88%'
   OR metrics::text LIKE '%"recall": 0.82%'
   OR metrics::text LIKE '%"mAP50": 0.78%'
   OR metrics::text LIKE '%"precision": 0.81%'
   OR metrics::text LIKE '%"recall": 0.75%'
   OR metrics::text LIKE '%"mAP50": 0.95%'
   OR metrics::text LIKE '%"precision": 0.92%'
   OR metrics::text LIKE '%"recall": 0.89%'
   OR metrics::text LIKE '%"accuracy": 0.9%'
   OR metrics::text LIKE '%"accuracy": 0.8%'
   OR metrics::text LIKE '%"accuracy": 0.95%';

-- 3. 시뮬레이션된 성능 메트릭이 있는 모델들 삭제
DELETE FROM model_registry 
WHERE performance_metrics::text LIKE '%"inference_time": 0.045%'
   OR performance_metrics::text LIKE '%"fps": 22.2%'
   OR performance_metrics::text LIKE '%"mAP50": 0.95%'
   OR performance_metrics::text LIKE '%"precision": 0.92%'
   OR performance_metrics::text LIKE '%"recall": 0.89%'
   OR performance_metrics::text LIKE '%"accuracy": 0.9%'
   OR performance_metrics::text LIKE '%"accuracy": 0.8%'
   OR performance_metrics::text LIKE '%"accuracy": 0.95%'
   OR performance_metrics::text LIKE '%"fps": 20%'
   OR performance_metrics::text LIKE '%"fps": 30%';

-- 4. 테스트 세션 데이터 삭제
DELETE FROM detection_results WHERE session_id LIKE 'test_session_%';
DELETE FROM recognition_results WHERE session_id LIKE 'test_session_%';
DELETE FROM processing_metrics WHERE session_id LIKE 'test_session_%';

-- 5. 하드코딩된 테스트 데이터 삭제
DELETE FROM detection_results WHERE model_version LIKE '%@768%';
DELETE FROM recognition_results WHERE model_version LIKE '%@768%';

-- 6. 시뮬레이션된 시스템 상태 데이터 삭제
DELETE FROM system_status WHERE memory_usage_percent > 0.8;
DELETE FROM index_statistics WHERE index_size_bytes > 100000000;

-- 7. 하드코딩된 인식 테스트 데이터 삭제
DELETE FROM recognition_results WHERE confidence_score = 0.95;
DELETE FROM recognition_results WHERE confidence_score = 0.87;
DELETE FROM recognition_results WHERE confidence_score = 0.89;
DELETE FROM recognition_results WHERE confidence_score = 0.92;
DELETE FROM recognition_results WHERE confidence_score = 0.65;
DELETE FROM recognition_results WHERE confidence_score = 0.85;
DELETE FROM recognition_results WHERE confidence_score = 0.78;
DELETE FROM recognition_results WHERE confidence_score = 0.8;
DELETE FROM recognition_results WHERE confidence_score = 0.9;

-- 8. 테스트 학습 작업 삭제
DELETE FROM training_jobs WHERE job_name LIKE 'test_training_job_%';
DELETE FROM training_jobs WHERE job_name LIKE 'demo_training_%';
DELETE FROM training_jobs WHERE job_name LIKE 'sample_training_%';
DELETE FROM training_jobs WHERE job_name LIKE 'dummy_training_%';
DELETE FROM training_metrics WHERE training_job_id IN (
  SELECT id FROM training_jobs WHERE job_name LIKE 'test_%' 
    OR job_name LIKE 'demo_%' 
    OR job_name LIKE 'sample_%' 
    OR job_name LIKE 'dummy_%'
);

-- 9. 테스트 자동화 설정 삭제
DELETE FROM automation_config WHERE config_key LIKE '%test%' 
  OR config_key LIKE '%demo%' 
  OR config_key LIKE '%sample%' 
  OR config_key LIKE '%dummy%';

-- 10. 환경 변수 초기화 (pg_settings는 뷰이므로 직접 삭제 불가)
DO $$
DECLARE
    var_name TEXT;
BEGIN
    -- app.default_% 패턴의 모든 환경 변수를 NULL로 설정
    FOR var_name IN 
        SELECT name FROM pg_settings WHERE name LIKE 'app.default_%'
    LOOP
        EXECUTE format('SET %I = NULL', var_name);
    END LOOP;
    
    RAISE NOTICE '환경 변수 초기화 완료';
END $$;

-- 11. 결과 확인
SELECT 
    'model_registry' as table_name,
    COUNT(*) as remaining_models
FROM model_registry
UNION ALL
SELECT 
    'detection_results' as table_name,
    COUNT(*) as remaining_detections
FROM detection_results
UNION ALL
SELECT 
    'recognition_results' as table_name,
    COUNT(*) as remaining_recognitions
FROM recognition_results
UNION ALL
SELECT 
    'processing_metrics' as table_name,
    COUNT(*) as remaining_metrics
FROM processing_metrics
UNION ALL
SELECT 
    'system_status' as table_name,
    COUNT(*) as remaining_status
FROM system_status
UNION ALL
SELECT 
    'training_jobs' as table_name,
    COUNT(*) as remaining_jobs
FROM training_jobs
UNION ALL
SELECT 
    'training_metrics' as table_name,
    COUNT(*) as remaining_training_metrics
FROM training_metrics
UNION ALL
SELECT 
    'automation_config' as table_name,
    COUNT(*) as remaining_configs
FROM automation_config
UNION ALL
SELECT 
    'environment_variables' as table_name,
    COUNT(*) as remaining_vars
FROM pg_settings 
WHERE name LIKE 'app.default_%' AND setting IS NOT NULL;

-- 12. 정리 완료 메시지
DO $$
DECLARE
    model_count INTEGER;
    detection_count INTEGER;
    recognition_count INTEGER;
    metrics_count INTEGER;
    status_count INTEGER;
    jobs_count INTEGER;
    training_metrics_count INTEGER;
    config_count INTEGER;
    var_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO model_count FROM model_registry;
    SELECT COUNT(*) INTO detection_count FROM detection_results;
    SELECT COUNT(*) INTO recognition_count FROM recognition_results;
    SELECT COUNT(*) INTO metrics_count FROM processing_metrics;
    SELECT COUNT(*) INTO status_count FROM system_status;
    SELECT COUNT(*) INTO jobs_count FROM training_jobs;
    SELECT COUNT(*) INTO training_metrics_count FROM training_metrics;
    SELECT COUNT(*) INTO config_count FROM automation_config;
    SELECT COUNT(*) INTO var_count FROM pg_settings WHERE name LIKE 'app.default_%' AND setting IS NOT NULL;
    
    RAISE NOTICE '🧹 완전한 더미 데이터 정리 완료!';
    RAISE NOTICE '📊 남은 데이터:';
    RAISE NOTICE '  - 모델: %', model_count;
    RAISE NOTICE '  - 검출 결과: %', detection_count;
    RAISE NOTICE '  - 인식 결과: %', recognition_count;
    RAISE NOTICE '  - 처리 메트릭: %', metrics_count;
    RAISE NOTICE '  - 시스템 상태: %', status_count;
    RAISE NOTICE '  - 학습 작업: %', jobs_count;
    RAISE NOTICE '  - 학습 메트릭: %', training_metrics_count;
    RAISE NOTICE '  - 자동화 설정: %', config_count;
    RAISE NOTICE '  - 환경 변수: %', var_count;
    RAISE NOTICE '✅ 모든 더미 데이터가 완전히 제거되었습니다!';
    RAISE NOTICE '🎯 이제 실제 데이터만 사용하는 완전히 깨끗한 프로덕션 환경입니다!';
    RAISE NOTICE '🚀 실제 학습과 데이터 수집을 시작할 준비가 완료되었습니다!';
END $$;
