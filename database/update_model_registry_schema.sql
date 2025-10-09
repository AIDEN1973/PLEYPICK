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
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS training_metadata JSONB DEFAULT '{}';

-- 기존 컬럼명 변경 (필요한 경우)
-- ALTER TABLE model_registry RENAME COLUMN model_url TO model_path;

-- training_metadata 컬럼을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_model_registry_training_metadata_gin 
ON model_registry USING GIN (training_metadata);

-- 세트 번호로 검색할 수 있는 인덱스 생성 (B-tree 인덱스 사용)
CREATE INDEX IF NOT EXISTS idx_model_registry_training_metadata_set_num 
ON model_registry ((training_metadata->>'set_num'));

-- 컬럼 설명 추가
COMMENT ON COLUMN model_registry.training_metadata IS '학습 메타데이터 (세트 번호, 학습된 부품 목록 등)';

-- 완료 메시지
SELECT '✅ model_registry 테이블 구조 확인/수정 완료!' as status;
