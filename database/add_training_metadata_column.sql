-- 🔧 model_registry 테이블에 training_metadata 컬럼 추가
-- 세트별 학습 메타데이터를 저장하기 위한 컬럼

-- training_metadata 컬럼 추가
ALTER TABLE model_registry 
ADD COLUMN IF NOT EXISTS training_metadata JSONB DEFAULT '{}';

-- 컬럼 설명 추가
COMMENT ON COLUMN model_registry.training_metadata IS '학습 메타데이터 (세트 번호, 학습된 부품 목록 등)';

-- 인덱스 생성 (JSONB 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_model_registry_training_metadata_gin 
ON model_registry USING GIN (training_metadata);

-- 세트 번호로 검색할 수 있는 인덱스 생성 (B-tree 인덱스 사용)
CREATE INDEX IF NOT EXISTS idx_model_registry_training_metadata_set_num 
ON model_registry ((training_metadata->>'set_num'));

-- 완료 메시지
SELECT '✅ model_registry.training_metadata 컬럼 추가 완료!' as status;
