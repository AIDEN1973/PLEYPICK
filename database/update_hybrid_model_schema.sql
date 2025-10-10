-- 🚀 BrickBox 2단계 하이브리드 YOLO11s-seg 시스템 스키마 업데이트

-- 1. model_registry 테이블 확장 (하이브리드 모델 지원)
ALTER TABLE model_registry 
ADD COLUMN IF NOT EXISTS model_stage VARCHAR(20) DEFAULT 'single', -- 'stage1', 'stage2', 'single'
ADD COLUMN IF NOT EXISTS hybrid_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS memory_usage INTEGER DEFAULT 0, -- VRAM 사용량 (MB)
ADD COLUMN IF NOT EXISTS fps_performance DECIMAL(5,2) DEFAULT 0.0, -- FPS 성능
ADD COLUMN IF NOT EXISTS segmentation_support BOOLEAN DEFAULT false, -- Segmentation 지원 여부
ADD COLUMN IF NOT EXISTS model_size_mb DECIMAL(8,2) DEFAULT 0.0; -- 모델 파일 크기 (MB)

-- 2. active_models 테이블 확장 (2단계 모델 관리)
ALTER TABLE active_models 
ADD COLUMN IF NOT EXISTS stage1_model_id INTEGER REFERENCES model_registry(id),
ADD COLUMN IF NOT EXISTS stage2_model_id INTEGER REFERENCES model_registry(id),
ADD COLUMN IF NOT EXISTS hybrid_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stage1_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stage2_config JSONB DEFAULT '{}';

-- 3. 하이브리드 검출 로그 테이블 생성
CREATE TABLE IF NOT EXISTS hybrid_detection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL,
    stage1_results JSONB DEFAULT '{}', -- 1차 검출 결과
    stage2_results JSONB DEFAULT '{}', -- 2차 검증 결과
    final_results JSONB DEFAULT '{}',  -- 최종 누락 판정
    processing_time_ms INTEGER DEFAULT 0, -- 전체 처리 시간
    memory_usage_mb INTEGER DEFAULT 0,   -- 메모리 사용량
    fps_achieved DECIMAL(5,2) DEFAULT 0.0, -- 달성 FPS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 하이브리드 모델 성능 테이블 생성
CREATE TABLE IF NOT EXISTS hybrid_model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_stage VARCHAR(20) NOT NULL, -- 'stage1', 'stage2'
    model_id INTEGER REFERENCES model_registry(id),
    fps_avg DECIMAL(5,2) DEFAULT 0.0,
    memory_avg_mb INTEGER DEFAULT 0,
    accuracy_score DECIMAL(5,4) DEFAULT 0.0,
    detection_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_model_registry_stage ON model_registry(model_stage);
CREATE INDEX IF NOT EXISTS idx_model_registry_segmentation ON model_registry(segmentation_support);
CREATE INDEX IF NOT EXISTS idx_hybrid_detection_logs_session ON hybrid_detection_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_hybrid_detection_logs_created ON hybrid_detection_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_hybrid_performance_stage ON hybrid_model_performance(model_stage);

-- 6. RLS 정책 설정
ALTER TABLE hybrid_detection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hybrid_model_performance ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모든 사용자)
CREATE POLICY "Anyone can read hybrid_detection_logs" ON hybrid_detection_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can read hybrid_model_performance" ON hybrid_model_performance FOR SELECT USING (true);

-- 관리 권한 (서비스 역할)
CREATE POLICY "Service role can manage hybrid_detection_logs" ON hybrid_detection_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage hybrid_model_performance" ON hybrid_model_performance FOR ALL USING (auth.role() = 'service_role');

-- 7. 컬럼 설명 추가
COMMENT ON COLUMN model_registry.model_stage IS '모델 단계: stage1(1차), stage2(2차), single(단일)';
COMMENT ON COLUMN model_registry.hybrid_config IS '하이브리드 모델 설정 (임계값, 성능 파라미터 등)';
COMMENT ON COLUMN model_registry.memory_usage IS 'VRAM 사용량 (MB)';
COMMENT ON COLUMN model_registry.fps_performance IS 'FPS 성능 지표';
COMMENT ON COLUMN model_registry.segmentation_support IS 'Segmentation 지원 여부';
COMMENT ON COLUMN active_models.hybrid_mode IS '하이브리드 모드 활성화 여부';

-- 8. 초기 하이브리드 모델 설정
INSERT INTO model_registry (
    model_name, model_version, model_type, model_stage, 
    segmentation_support, memory_usage, fps_performance, model_size_mb,
    hybrid_config, is_active, created_at
) VALUES 
(
    'yolo11n-seg', '1.0.0', 'segmentation', 'stage1',
    true, 2000, 50.0, 5.2,
    '{"conf_threshold": 0.3, "max_detections": 50, "input_size": 640}',
    true, NOW()
),
(
    'yolo11s-seg', '1.0.0', 'segmentation', 'stage2', 
    true, 4000, 27.5, 21.5,
    '{"conf_threshold": 0.5, "max_detections": 20, "input_size": 640}',
    true, NOW()
)
ON CONFLICT (model_name, model_version) DO UPDATE SET
    model_stage = EXCLUDED.model_stage,
    segmentation_support = EXCLUDED.segmentation_support,
    memory_usage = EXCLUDED.memory_usage,
    fps_performance = EXCLUDED.fps_performance,
    model_size_mb = EXCLUDED.model_size_mb,
    hybrid_config = EXCLUDED.hybrid_config,
    updated_at = NOW();

-- 9. 활성 하이브리드 모델 설정
UPDATE active_models SET
    hybrid_mode = true,
    stage1_model_id = (SELECT id FROM model_registry WHERE model_name = 'yolo11n-seg' AND model_stage = 'stage1'),
    stage2_model_id = (SELECT id FROM model_registry WHERE model_name = 'yolo11s-seg' AND model_stage = 'stage2'),
    stage1_config = '{"enabled": true, "auto_load": true}',
    stage2_config = '{"enabled": true, "auto_load": false, "trigger_threshold": 0.3}',
    updated_at = NOW()
WHERE id = 1 OR id = (SELECT id FROM active_models LIMIT 1);

-- 완료 메시지
SELECT '✅ BrickBox 2단계 하이브리드 시스템 스키마 업데이트 완료!' as status;
