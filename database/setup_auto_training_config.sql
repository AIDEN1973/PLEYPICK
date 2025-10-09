-- 🧱 BrickBox 자동 학습 설정

-- 자동 학습 설정 테이블에 설정 추가
INSERT INTO automation_config (config_key, config_value, description, is_active) VALUES
('auto_training_enabled', '{"enabled": true, "threshold": 50, "check_interval": 300}', '자동 학습 활성화 설정', true),
('auto_training_schedule', '{"daily": "02:00", "weekly": "sunday 03:00", "hourly_check": true}', '자동 학습 스케줄 설정', true),
('auto_training_conditions', '{"min_data_count": 50, "min_interval_hours": 1, "performance_threshold": 0.6}', '자동 학습 조건 설정', true),
('auto_training_notifications', '{"enabled": true, "webhook_url": "https://your-webhook-url.com/training-notifications", "email_alerts": false}', '자동 학습 알림 설정', true),
('auto_training_performance', '{"monitor_interval": 1800, "retrain_threshold": 0.6, "performance_history_days": 7}', '성능 모니터링 설정', true);

-- 자동 학습 통계 테이블 생성
CREATE TABLE IF NOT EXISTS auto_training_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_training_runs INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,
    total_data_processed INTEGER DEFAULT 0,
    average_performance DECIMAL(5,3) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 자동 학습 로그 테이블 생성
CREATE TABLE IF NOT EXISTS auto_training_logs (
    id SERIAL PRIMARY KEY,
    log_type VARCHAR(50) NOT NULL, -- 'trigger', 'start', 'complete', 'error'
    message TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE auto_training_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_training_logs ENABLE ROW LEVEL SECURITY;

-- 자동 학습 통계 테이블 RLS 정책
CREATE POLICY "Anyone can read auto_training_stats" ON auto_training_stats FOR SELECT USING (true);
CREATE POLICY "Service role can manage auto_training_stats" ON auto_training_stats FOR ALL USING (auth.role() = 'service_role');

-- 자동 학습 로그 테이블 RLS 정책
CREATE POLICY "Anyone can read auto_training_logs" ON auto_training_logs FOR SELECT USING (true);
CREATE POLICY "Service role can manage auto_training_logs" ON auto_training_logs FOR ALL USING (auth.role() = 'service_role');

-- 자동 학습 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_auto_training_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 통계 업데이트 로직
    INSERT INTO auto_training_stats (date, total_training_runs, successful_runs, failed_runs)
    VALUES (CURRENT_DATE, 1, 
           CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
           CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END)
    ON CONFLICT (date) DO UPDATE SET
        total_training_runs = auto_training_stats.total_training_runs + 1,
        successful_runs = auto_training_stats.successful_runs + 
                         CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        failed_runs = auto_training_stats.failed_runs + 
                     CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 자동 학습 통계 트리거
CREATE TRIGGER auto_training_stats_trigger
    AFTER INSERT OR UPDATE ON training_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_auto_training_stats();

-- 자동 학습 로그 함수
CREATE OR REPLACE FUNCTION log_auto_training_event(
    p_log_type VARCHAR(50),
    p_message TEXT,
    p_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO auto_training_logs (log_type, message, data)
    VALUES (p_log_type, p_message, p_data);
END;
$$ LANGUAGE plpgsql;

-- 초기 설정 확인
SELECT '자동 학습 설정 완료' as status;
