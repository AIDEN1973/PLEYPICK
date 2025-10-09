-- 🧱 BrickBox 자동화된 YOLO 학습을 위한 Supabase 스키마
-- 완전 자동화된 Colab + Supabase 연동 시스템

-- 1. 모델 레지스트리 테이블 (모델 버전 관리)
CREATE TABLE IF NOT EXISTS model_registry (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    model_name VARCHAR(100) NOT NULL,
    model_url TEXT NOT NULL,
    model_size BIGINT,
    metrics JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'deprecated', 'failed')),
    dataset_id INTEGER REFERENCES synthetic_dataset(id),
    training_job_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system'
);

-- 2. 학습 작업 관리 테이블
CREATE TABLE IF NOT EXISTS training_jobs (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    dataset_id INTEGER REFERENCES synthetic_dataset(id),
    colab_session_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    config JSONB DEFAULT '{}',
    progress JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 학습 메트릭 히스토리 테이블
CREATE TABLE IF NOT EXISTS training_metrics (
    id SERIAL PRIMARY KEY,
    training_job_id INTEGER REFERENCES training_jobs(id),
    epoch INTEGER NOT NULL,
    train_loss FLOAT,
    val_loss FLOAT,
    mAP50 FLOAT,
    mAP50_95 FLOAT,
    precision FLOAT,
    recall FLOAT,
    f1_score FLOAT,
    learning_rate FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 자동화 설정 테이블
CREATE TABLE IF NOT EXISTS automation_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 알림 설정 테이블
CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    notification_type VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    webhook_url TEXT,
    email_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_model_registry_status ON model_registry(status);
CREATE INDEX IF NOT EXISTS idx_model_registry_created_at ON model_registry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_dataset_id ON training_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_training_metrics_job_id ON training_metrics(training_job_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 모델 레지스트리 정책
CREATE POLICY "Anyone can read model_registry" ON model_registry FOR SELECT USING (true);
CREATE POLICY "Service role can manage model_registry" ON model_registry FOR ALL USING (auth.role() = 'service_role');

-- 학습 작업 정책
CREATE POLICY "Anyone can read training_jobs" ON training_jobs FOR SELECT USING (true);
CREATE POLICY "Service role can manage training_jobs" ON training_jobs FOR ALL USING (auth.role() = 'service_role');

-- 학습 메트릭 정책
CREATE POLICY "Anyone can read training_metrics" ON training_metrics FOR SELECT USING (true);
CREATE POLICY "Service role can manage training_metrics" ON training_metrics FOR ALL USING (auth.role() = 'service_role');

-- 자동화 설정 정책
CREATE POLICY "Service role can manage automation_config" ON automation_config FOR ALL USING (auth.role() = 'service_role');

-- 알림 설정 정책
CREATE POLICY "Users can manage their own notifications" ON notification_settings FOR ALL USING (auth.uid() = user_id);

-- 기본 자동화 설정 삽입
INSERT INTO automation_config (config_key, config_value, description) VALUES
('colab_notebook_url', '{"url": "https://colab.research.google.com/drive/YOUR_NOTEBOOK_ID"}', 'Colab 노트북 URL'),
('training_config', '{"epochs": 100, "batch_size": 16, "imgsz": 640, "device": "cuda"}', '기본 학습 설정'),
('model_retention', '{"max_versions": 10, "auto_cleanup": true}', '모델 보관 정책'),
('notification_webhook', '{"url": "https://your-webhook-url.com/training-complete"}', '학습 완료 알림 웹훅')
ON CONFLICT (config_key) DO NOTHING;

-- 트리거 함수: 모델 레지스트리 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_model_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_registry_updated_at
    BEFORE UPDATE ON model_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_model_registry_updated_at();

-- 트리거 함수: 학습 작업 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_training_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_training_jobs_updated_at
    BEFORE UPDATE ON training_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_training_jobs_updated_at();

-- 트리거 함수: 새 모델 활성화 시 기존 모델 비활성화
CREATE OR REPLACE FUNCTION deactivate_old_models()
RETURNS TRIGGER AS $$
BEGIN
    -- 새 모델이 active로 설정될 때 기존 active 모델들을 inactive로 변경
    IF NEW.status = 'active' THEN
        UPDATE model_registry 
        SET status = 'inactive', updated_at = NOW()
        WHERE status = 'active' AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deactivate_old_models
    AFTER UPDATE ON model_registry
    FOR EACH ROW
    EXECUTE FUNCTION deactivate_old_models();

-- 뷰: 활성 모델 정보
CREATE OR REPLACE VIEW active_models AS
SELECT 
    mr.id,
    mr.version,
    mr.model_name,
    mr.model_url,
    mr.model_size,
    mr.metrics,
    mr.created_at,
    tj.job_name,
    tj.completed_at
FROM model_registry mr
LEFT JOIN training_jobs tj ON mr.training_job_id = tj.id
WHERE mr.status = 'active';

-- 뷰: 학습 작업 통계
CREATE OR REPLACE VIEW training_job_stats AS
SELECT 
    tj.id,
    tj.job_name,
    tj.status,
    tj.started_at,
    tj.completed_at,
    EXTRACT(EPOCH FROM (tj.completed_at - tj.started_at)) as duration_seconds,
    mr.version as model_version,
    mr.metrics
FROM training_jobs tj
LEFT JOIN model_registry mr ON tj.id = mr.training_job_id
ORDER BY tj.created_at DESC;

-- 함수: 최신 활성 모델 가져오기
CREATE OR REPLACE FUNCTION get_latest_active_model()
RETURNS TABLE (
    id INTEGER,
    version VARCHAR,
    model_name VARCHAR,
    model_url TEXT,
    model_size BIGINT,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.id,
        mr.version,
        mr.model_name,
        mr.model_url,
        mr.model_size,
        mr.metrics,
        mr.created_at
    FROM model_registry mr
    WHERE mr.status = 'active'
    ORDER BY mr.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 함수: 학습 작업 생성
CREATE OR REPLACE FUNCTION create_training_job(
    p_job_name VARCHAR,
    p_dataset_id INTEGER,
    p_config JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
    job_id INTEGER;
BEGIN
    INSERT INTO training_jobs (job_name, dataset_id, config, status)
    VALUES (p_job_name, p_dataset_id, p_config, 'pending')
    RETURNING id INTO job_id;
    
    RETURN job_id;
END;
$$ LANGUAGE plpgsql;

-- 함수: 모델 등록
CREATE OR REPLACE FUNCTION register_model(
    p_version VARCHAR,
    p_model_name VARCHAR,
    p_model_url TEXT,
    p_model_size BIGINT,
    p_metrics JSONB,
    p_training_job_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    model_id INTEGER;
BEGIN
    INSERT INTO model_registry (
        version, model_name, model_url, model_size, 
        metrics, training_job_id, status
    )
    VALUES (
        p_version, p_model_name, p_model_url, p_model_size,
        p_metrics, p_training_job_id, 'active'
    )
    RETURNING id INTO model_id;
    
    RETURN model_id;
END;
$$ LANGUAGE plpgsql;

-- Storage 버킷 생성 (이미 존재하는 경우 무시)
INSERT INTO storage.buckets (id, name, public) VALUES 
('datasets', 'datasets', true),
('models', 'models', true),
('training-logs', 'training-logs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정
CREATE POLICY "Public datasets access" ON storage.objects FOR SELECT USING (bucket_id = 'datasets');
CREATE POLICY "Public models access" ON storage.objects FOR SELECT USING (bucket_id = 'models');
CREATE POLICY "Service role can manage storage" ON storage.objects FOR ALL USING (auth.role() = 'service_role');

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ BrickBox 자동화된 YOLO 학습 스키마 생성 완료!';
    RAISE NOTICE '📊 생성된 테이블: model_registry, training_jobs, training_metrics, automation_config, notification_settings';
    RAISE NOTICE '🔧 생성된 함수: get_latest_active_model(), create_training_job(), register_model()';
    RAISE NOTICE '📦 Storage 버킷: datasets, models, training-logs';
END $$;
