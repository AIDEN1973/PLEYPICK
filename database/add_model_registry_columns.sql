-- 🔧 model_registry 테이블에 누락된 컬럼 추가

-- 1. model_size_mb 컬럼 추가
ALTER TABLE model_registry 
ADD COLUMN IF NOT EXISTS model_size_mb DECIMAL(8,2) DEFAULT 0.0;

-- 2. segmentation_support 컬럼 추가
ALTER TABLE model_registry 
ADD COLUMN IF NOT EXISTS segmentation_support BOOLEAN DEFAULT false;

-- 3. model_stage 컬럼 추가
ALTER TABLE model_registry 
ADD COLUMN IF NOT EXISTS model_stage VARCHAR(20) DEFAULT 'single';

-- 4. pt_model_path 컬럼 추가 (PyTorch 모델 경로)
ALTER TABLE model_registry 
ADD COLUMN IF NOT EXISTS pt_model_path TEXT;

-- 5. training_metadata 컬럼 추가
ALTER TABLE model_registry 
ADD COLUMN IF NOT EXISTS training_metadata JSONB DEFAULT '{}';

-- 6. 컬럼 설명 추가
COMMENT ON COLUMN model_registry.model_size_mb IS '모델 파일 크기 (MB)';
COMMENT ON COLUMN model_registry.segmentation_support IS 'Segmentation 지원 여부';
COMMENT ON COLUMN model_registry.model_stage IS '모델 단계: stage1, stage2, single';
COMMENT ON COLUMN model_registry.pt_model_path IS 'PyTorch 모델 파일 경로';
COMMENT ON COLUMN model_registry.training_metadata IS '학습 메타데이터 (세트 정보, 학습된 부품 등)';

-- 7. 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ model_registry 테이블 컬럼 추가 완료!';
    RAISE NOTICE '📊 추가된 컬럼: model_size_mb, segmentation_support, model_stage, pt_model_path, training_metadata';
END $$;
