-- 🔧 Colab 노트북 URL 설정
-- trigger-colab-training 함수에서 사용하는 노트북 URL 설정

-- 1. 기존 설정 확인
SELECT config_key, config_value 
FROM automation_config 
WHERE config_key = 'colab_notebook_url';

-- 2. Colab 노트북 URL 설정 (없으면 추가)
INSERT INTO automation_config (config_key, config_value, description, is_active)
VALUES (
  'colab_notebook_url',
  '{"url": "https://colab.research.google.com/drive/15W7b-Q50q881zhLcml84ksj7MUiQkR6h"}',
  'Colab 노트북 URL 설정',
  true
)
ON CONFLICT (config_key) 
DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 3. 설정 확인
SELECT config_key, config_value, description, is_active
FROM automation_config 
WHERE config_key = 'colab_notebook_url';

-- 완료 메시지
SELECT '✅ Colab 노트북 URL 설정 완료!' as status;
