-- 🚀 자동 실행 노트북 URL 업데이트

-- 기존 설정 확인
SELECT config_key, config_value, description, is_active 
FROM automation_config 
WHERE config_key = 'colab_notebook_url';

-- 자동 실행 노트북 URL로 업데이트
UPDATE automation_config 
SET config_value = '{"url": "https://colab.research.google.com/drive/15W7b-Q50q881zhLcml84ksj7MUiQkR6h", "name": "BrickBox YOLO Auto Training"}',
    description = '자동 실행 노트북 URL (Cell 4 완료 후 자동으로 Cell 5, 6 실행)',
    updated_at = NOW()
WHERE config_key = 'colab_notebook_url';

-- 업데이트 확인
SELECT config_key, config_value, description, is_active, updated_at
FROM automation_config 
WHERE config_key = 'colab_notebook_url';

-- 설정 완료 메시지
SELECT '✅ 자동 실행 노트북 URL 업데이트 완료!' as status;
