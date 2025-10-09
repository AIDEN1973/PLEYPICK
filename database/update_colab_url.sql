-- 🧱 Colab 노트북 URL 업데이트
-- 실제 Colab URL로 변경하세요

UPDATE automation_config 
SET config_value = '{"url": "https://colab.research.google.com/drive/1f0yXB7hMkoePz5XpLl1LPPpdxPIdpvj4", "name": "BrickBox YOLO Training"}'
WHERE config_key = 'colab_notebook_url';

-- 업데이트 확인
SELECT config_key, config_value 
FROM automation_config 
WHERE config_key = 'colab_notebook_url';
