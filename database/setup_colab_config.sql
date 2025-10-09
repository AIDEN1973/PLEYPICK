-- 🧱 BrickBox Colab 설정
-- Supabase SQL Editor에서 실행

-- 1. Colab 노트북 URL 설정 (실제 URL로 변경 필요)
INSERT INTO automation_config (config_key, config_value, description, is_active)
VALUES 
  ('colab_notebook_url', '{"url": "https://colab.research.google.com/drive/YOUR_NOTEBOOK_ID", "name": "BrickBox YOLO Training"}', 'Colab 노트북 URL', true)
ON CONFLICT (config_key) DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 2. 학습 설정
INSERT INTO automation_config (config_key, config_value, description, is_active)
VALUES 
  ('training_config', '{"epochs": 100, "batch_size": 16, "imgsz": 640, "device": "cuda", "patience": 20}', '기본 학습 설정', true)
ON CONFLICT (config_key) DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 3. 모델 보관 정책
INSERT INTO automation_config (config_key, config_value, description, is_active)
VALUES 
  ('model_retention', '{"max_versions": 10, "auto_cleanup": true, "keep_best": 3}', '모델 보관 정책', true)
ON CONFLICT (config_key) DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 4. 알림 설정
INSERT INTO automation_config (config_key, config_value, description, is_active)
VALUES 
  ('notification_webhook', '{"url": "https://your-webhook-url.com/training-complete", "enabled": false}', '학습 완료 알림 웹훅', true)
ON CONFLICT (config_key) DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 5. 설정 확인
SELECT config_key, config_value, description, is_active 
FROM automation_config 
ORDER BY config_key;
