-- 🔍 BrickBox 모니터링 시스템 테이블 생성
-- SLO 지표 및 성능 모니터링을 위한 테이블들

-- 1. 검출 결과 테이블
CREATE TABLE IF NOT EXISTS detection_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL,
    small_parts_detected INTEGER DEFAULT 0,
    total_small_parts INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    total_detections INTEGER DEFAULT 0,
    processing_time_ms INTEGER DEFAULT 0,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인식 결과 테이블
CREATE TABLE IF NOT EXISTS recognition_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    total_attempts INTEGER DEFAULT 1,
    is_held BOOLEAN DEFAULT false,
    entered_stage2 BOOLEAN DEFAULT false,
    confidence_score DECIMAL(4,3),
    processing_time_ms INTEGER DEFAULT 0,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 처리 성능 메트릭 테이블
CREATE TABLE IF NOT EXISTS processing_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL,
    processing_time_ms INTEGER DEFAULT 0,
    webp_decode_time_ms INTEGER DEFAULT 0,
    faiss_stage1_time_ms INTEGER DEFAULT 0,
    faiss_stage2_time_ms INTEGER DEFAULT 0,
    memory_usage_mb INTEGER DEFAULT 0,
    cpu_usage_percent DECIMAL(5,2) DEFAULT 0.0,
    gpu_usage_percent DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 인덱스 통계 테이블
CREATE TABLE IF NOT EXISTS index_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    index_size_bytes BIGINT DEFAULT 0,
    total_templates INTEGER DEFAULT 0,
    l1_templates INTEGER DEFAULT 0,
    l2_templates INTEGER DEFAULT 0,
    last_rebuild_at TIMESTAMP WITH TIME ZONE,
    rebuild_duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 시스템 상태 테이블
CREATE TABLE IF NOT EXISTS system_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_usage_percent DECIMAL(5,2) DEFAULT 0.0,
    cpu_usage_percent DECIMAL(5,2) DEFAULT 0.0,
    disk_usage_percent DECIMAL(5,2) DEFAULT 0.0,
    network_latency_ms INTEGER DEFAULT 0,
    active_sessions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_detection_results_created_at ON detection_results(created_at);
CREATE INDEX IF NOT EXISTS idx_detection_results_session_id ON detection_results(session_id);

CREATE INDEX IF NOT EXISTS idx_recognition_results_created_at ON recognition_results(created_at);
CREATE INDEX IF NOT EXISTS idx_recognition_results_session_id ON recognition_results(session_id);

CREATE INDEX IF NOT EXISTS idx_processing_metrics_created_at ON processing_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_session_id ON processing_metrics(session_id);

CREATE INDEX IF NOT EXISTS idx_index_statistics_created_at ON index_statistics(created_at);

CREATE INDEX IF NOT EXISTS idx_system_status_created_at ON system_status(created_at);

-- RLS 정책 설정
ALTER TABLE detection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognition_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모든 사용자)
CREATE POLICY "Anyone can read detection_results" ON detection_results FOR SELECT USING (true);
CREATE POLICY "Anyone can read recognition_results" ON recognition_results FOR SELECT USING (true);
CREATE POLICY "Anyone can read processing_metrics" ON processing_metrics FOR SELECT USING (true);
CREATE POLICY "Anyone can read index_statistics" ON index_statistics FOR SELECT USING (true);
CREATE POLICY "Anyone can read system_status" ON system_status FOR SELECT USING (true);

-- 관리 권한 (서비스 역할)
CREATE POLICY "Service role can manage detection_results" ON detection_results 
FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage recognition_results" ON recognition_results 
FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage processing_metrics" ON processing_metrics 
FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage index_statistics" ON index_statistics 
FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage system_status" ON system_status 
FOR ALL USING (auth.role() = 'service_role');

-- 샘플 데이터 제거됨 (프로덕션 환경)

-- 샘플 데이터 제거됨 (프로덕션 환경)

-- 완료 메시지
SELECT '✅ 모니터링 테이블 생성 완료!' as status;
