-- 🏪 BrickBox 매장 관리 시스템 스키마

-- 1. 매장 정보 테이블
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    contact VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    config JSONB DEFAULT '{}',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_deployment_at TIMESTAMP WITH TIME ZONE,
    performance_score DECIMAL(3,2) DEFAULT 0.0,
    pilot_eligible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 매장별 모델 배포 기록
CREATE TABLE IF NOT EXISTS store_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(50) REFERENCES stores(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    model_id INTEGER REFERENCES model_registry(id) ON DELETE SET NULL,
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'deployed' CHECK (status IN ('pending', 'deployed', 'failed', 'rolled_back')),
    deployment_method VARCHAR(20) DEFAULT 'http',
    deployment_log JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 매장별 성능 데이터
CREATE TABLE IF NOT EXISTS store_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(50) REFERENCES stores(id) ON DELETE CASCADE,
    accuracy DECIMAL(5,2),
    fps DECIMAL(5,2),
    memory_usage INTEGER, -- MB
    cpu_usage DECIMAL(5,2),
    gpu_usage DECIMAL(5,2),
    detection_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 매장별 시스템 로그
CREATE TABLE IF NOT EXISTS store_system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(50) REFERENCES stores(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warning', 'error', 'success')),
    message TEXT NOT NULL,
    component VARCHAR(50), -- 'model', 'detection', 'update', etc.
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 배포 큐 (중앙 서버에서 매장별 배포 관리)
CREATE TABLE IF NOT EXISTS deployment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id INTEGER REFERENCES model_registry(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    target_stores JSONB DEFAULT '[]', -- 매장 ID 목록
    deployment_strategy VARCHAR(20) DEFAULT 'gradual' CHECK (deployment_strategy IN ('gradual', 'immediate', 'pilot')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    pilot_stores JSONB DEFAULT '[]', -- 파일럿 매장 목록
    pilot_results JSONB DEFAULT '{}', -- 파일럿 결과
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- 6. 매장별 업데이트 로그
CREATE TABLE IF NOT EXISTS store_update_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(50) REFERENCES stores(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'success', 'failed', 'rollback_success', 'rollback_failed')),
    model_version VARCHAR(50) NOT NULL,
    previous_version VARCHAR(50),
    error TEXT,
    deployment_package JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 매장별 모니터링 알림
CREATE TABLE IF NOT EXISTS store_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(50) REFERENCES stores(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'performance', 'error', 'update', 'maintenance'
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 매장별 설정 히스토리
CREATE TABLE IF NOT EXISTS store_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(50) REFERENCES stores(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    changed_by VARCHAR(100),
    change_reason TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_performance_score ON stores(performance_score);
CREATE INDEX IF NOT EXISTS idx_store_deployments_store_id ON store_deployments(store_id);
CREATE INDEX IF NOT EXISTS idx_store_deployments_deployed_at ON store_deployments(deployed_at);
CREATE INDEX IF NOT EXISTS idx_store_performance_store_id ON store_performance(store_id);
CREATE INDEX IF NOT EXISTS idx_store_performance_timestamp ON store_performance(timestamp);
CREATE INDEX IF NOT EXISTS idx_store_system_logs_store_id ON store_system_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_store_system_logs_timestamp ON store_system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_store_system_logs_level ON store_system_logs(level);
CREATE INDEX IF NOT EXISTS idx_deployment_queue_status ON deployment_queue(status);
CREATE INDEX IF NOT EXISTS idx_store_update_logs_store_id ON store_update_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_store_update_logs_timestamp ON store_update_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_store_alerts_store_id ON store_alerts(store_id);
CREATE INDEX IF NOT EXISTS idx_store_alerts_is_resolved ON store_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_store_config_history_store_id ON store_config_history(store_id);

-- RLS (Row Level Security) 정책
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_update_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_config_history ENABLE ROW LEVEL SECURITY;

-- 매장별 데이터 접근 정책 (서비스 역할만 전체 접근 가능)
CREATE POLICY "Service role can access all store data" ON stores
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all deployment data" ON store_deployments
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all performance data" ON store_performance
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all system logs" ON store_system_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all update logs" ON store_update_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all alerts" ON store_alerts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all config history" ON store_config_history
    FOR ALL USING (auth.role() = 'service_role');

-- 트리거: stores 테이블 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_stores_updated_at();

-- 트리거: 설정 변경 시 히스토리 자동 기록
CREATE OR REPLACE FUNCTION log_store_config_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- config 필드가 변경된 경우에만 히스토리 기록
    IF OLD.config IS DISTINCT FROM NEW.config THEN
        INSERT INTO store_config_history (
            store_id,
            config_key,
            old_value,
            new_value,
            changed_by,
            change_reason
        ) VALUES (
            NEW.id,
            'config',
            OLD.config,
            NEW.config,
            'system',
            'Configuration updated'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_store_config_changes
    AFTER UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION log_store_config_changes();

-- 샘플 데이터 삽입
INSERT INTO stores (id, name, location, contact, config) VALUES
('store_001', '강남점', '서울시 강남구 테헤란로 123', '010-1234-5678', '{"selected_set": "76917", "auto_update": true, "detection_sensitivity": 0.5}'),
('store_002', '홍대점', '서울시 마포구 홍익로 456', '010-2345-6789', '{"selected_set": "76917", "auto_update": true, "detection_sensitivity": 0.6}'),
('store_003', '명동점', '서울시 중구 명동길 789', '010-3456-7890', '{"selected_set": "76917", "auto_update": false, "detection_sensitivity": 0.7}')
ON CONFLICT (id) DO NOTHING;

-- 성능 데이터 샘플
INSERT INTO store_performance (store_id, accuracy, fps, memory_usage, detection_count, error_count) VALUES
('store_001', 92.5, 25.3, 450, 1250, 3),
('store_002', 89.2, 23.1, 380, 980, 7),
('store_003', 94.8, 27.6, 520, 1450, 2)
ON CONFLICT DO NOTHING;

-- 시스템 로그 샘플
INSERT INTO store_system_logs (store_id, level, message, component) VALUES
('store_001', 'info', '시스템 시작', 'system'),
('store_001', 'success', '모델 로드 완료', 'model'),
('store_001', 'info', '검출 시작', 'detection'),
('store_002', 'warning', '메모리 사용량 높음', 'performance'),
('store_003', 'error', '모델 로드 실패', 'model')
ON CONFLICT DO NOTHING;

SELECT '✅ BrickBox 매장 관리 시스템 스키마 생성 완료!' as status;
