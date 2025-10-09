-- 🧱 BrickBox 테스트 데이터 직접 삽입
-- Supabase SQL Editor에서 실행

-- 1. 기존 데이터 정리
DELETE FROM training_metrics;
DELETE FROM model_registry;
DELETE FROM training_jobs;

-- 2. 테스트 학습 작업 생성
INSERT INTO training_jobs (job_name, dataset_id, status, config, started_at, completed_at)
VALUES 
  ('test_training_job_1', 1, 'completed', '{"epochs": 100, "batch_size": 16}', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),
  ('test_training_job_2', 1, 'running', '{"epochs": 150, "batch_size": 32}', NOW() - INTERVAL '30 minutes', NULL);

-- 3. 테스트 모델 등록
INSERT INTO model_registry (version, model_name, model_url, model_size, metrics, training_job_id, status, created_by)
VALUES 
  ('v1.0.0', 'brickbox_yolo_v1', 'https://example.com/models/brickbox_yolo_v1.pt', 10485760, '{"mAP50": 0.85, "precision": 0.88, "recall": 0.82}', 1, 'active', 'test_user'),
  ('v0.9.0', 'brickbox_yolo_v0_9', 'https://example.com/models/brickbox_yolo_v0_9.pt', 10485760, '{"mAP50": 0.78, "precision": 0.81, "recall": 0.75}', 1, 'inactive', 'test_user');

-- 4. 테스트 학습 메트릭
INSERT INTO training_metrics (training_job_id, epoch, train_loss, val_loss, mAP50, mAP50_95, precision, recall, f1_score, learning_rate)
VALUES 
  (1, 1, 0.5, 0.6, 0.2, 0.1, 0.3, 0.25, 0.27, 0.01),
  (1, 10, 0.4, 0.5, 0.4, 0.25, 0.5, 0.45, 0.47, 0.008),
  (1, 50, 0.3, 0.4, 0.7, 0.5, 0.75, 0.7, 0.72, 0.005),
  (1, 100, 0.25, 0.35, 0.85, 0.65, 0.88, 0.82, 0.85, 0.001),
  (2, 1, 0.6, 0.7, 0.15, 0.08, 0.25, 0.2, 0.22, 0.01),
  (2, 25, 0.35, 0.45, 0.6, 0.4, 0.7, 0.65, 0.67, 0.005);

-- 5. 자동화 설정
INSERT INTO automation_config (config_key, config_value, description, is_active)
VALUES 
  ('colab_notebook_url', '{"url": "https://colab.research.google.com/drive/YOUR_NOTEBOOK_ID"}', 'Colab 노트북 URL', true),
  ('training_config', '{"epochs": 100, "batch_size": 16, "imgsz": 640, "device": "cuda"}', '기본 학습 설정', true),
  ('model_retention', '{"max_versions": 10, "auto_cleanup": true}', '모델 보관 정책', true),
  ('notification_webhook', '{"url": "https://your-webhook-url.com/training-complete"}', '학습 완료 알림 웹훅', true)
ON CONFLICT (config_key) DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;
