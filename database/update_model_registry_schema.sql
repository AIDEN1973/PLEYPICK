-- 🔧 model_registry 테이블 구조 수정
-- 노트북의 필드명에 맞게 수정

-- 기존 테이블 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'model_registry';

-- 필요한 컬럼 추가 (없는 경우만)
ALTER TABLE model_registry 
ADD COLUMN IF NOT EXISTS model_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS model_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS model_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS model_path TEXT,
ADD COLUMN IF NOT EXISTS pt_model_path TEXT,
ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- 기존 컬럼명 변경 (필요한 경우)
-- ALTER TABLE model_registry RENAME COLUMN model_url TO model_path;

-- 완료 메시지
SELECT '✅ model_registry 테이블 구조 확인/수정 완료!' as status;
