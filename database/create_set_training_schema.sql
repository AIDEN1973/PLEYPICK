-- 🧱 BrickBox 세트 단위 학습 시스템 스키마

-- 1. 세트 정보 테이블
CREATE TABLE IF NOT EXISTS lego_sets (
    id SERIAL PRIMARY KEY,
    set_num VARCHAR(20) NOT NULL UNIQUE,
    set_name VARCHAR(200),
    parts JSONB NOT NULL DEFAULT '[]',  -- 부품 목록
    part_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 세트별 학습 상태 테이블
CREATE TABLE IF NOT EXISTS set_training_status (
    id SERIAL PRIMARY KEY,
    set_num VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, training, completed, failed
    trained_parts JSONB DEFAULT '[]',  -- 학습된 부품 목록
    new_parts JSONB DEFAULT '[]',      -- 새로 학습된 부품 목록
    total_parts INTEGER DEFAULT 0,
    training_started_at TIMESTAMP WITH TIME ZONE,
    training_completed_at TIMESTAMP WITH TIME ZONE,
    model_version VARCHAR(50),
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 학습 상태 관리 테이블
CREATE TABLE IF NOT EXISTS training_state (
    id VARCHAR(50) PRIMARY KEY,
    state JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 세트별 검수 가능 상태 테이블
CREATE TABLE IF NOT EXISTS set_inspection_status (
    id SERIAL PRIMARY KEY,
    set_num VARCHAR(20) NOT NULL,
    is_ready_for_inspection BOOLEAN DEFAULT false,
    trained_parts_count INTEGER DEFAULT 0,
    total_parts_count INTEGER DEFAULT 0,
    coverage_percentage DECIMAL(5,2) DEFAULT 0.0,
    last_trained_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_lego_sets_set_num ON lego_sets(set_num);
CREATE INDEX IF NOT EXISTS idx_set_training_status_set_num ON set_training_status(set_num);
CREATE INDEX IF NOT EXISTS idx_set_training_status_status ON set_training_status(status);
CREATE INDEX IF NOT EXISTS idx_set_inspection_status_set_num ON set_inspection_status(set_num);
CREATE INDEX IF NOT EXISTS idx_set_inspection_status_ready ON set_inspection_status(is_ready_for_inspection);

-- RLS 정책 설정
ALTER TABLE lego_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_training_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_inspection_status ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모든 사용자)
CREATE POLICY "Anyone can read lego_sets" ON lego_sets FOR SELECT USING (true);
CREATE POLICY "Anyone can read set_training_status" ON set_training_status FOR SELECT USING (true);
CREATE POLICY "Anyone can read training_state" ON training_state FOR SELECT USING (true);
CREATE POLICY "Anyone can read set_inspection_status" ON set_inspection_status FOR SELECT USING (true);

-- 관리 권한 (서비스 역할)
CREATE POLICY "Service role can manage lego_sets" ON lego_sets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage set_training_status" ON set_training_status FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage training_state" ON training_state FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage set_inspection_status" ON set_inspection_status FOR ALL USING (auth.role() = 'service_role');

-- 트리거 함수: 세트 학습 완료 시 검수 가능 상태 업데이트
CREATE OR REPLACE FUNCTION update_set_inspection_status()
RETURNS TRIGGER AS $$
BEGIN
    -- 세트 학습 완료 시 검수 가능 상태로 업데이트
    IF NEW.status = 'completed' THEN
        INSERT INTO set_inspection_status (
            set_num, 
            is_ready_for_inspection, 
            trained_parts_count,
            total_parts_count,
            coverage_percentage,
            last_trained_at
        ) VALUES (
            NEW.set_num,
            true,
            jsonb_array_length(NEW.trained_parts),
            NEW.total_parts,
            100.0,  -- 세트 학습 완료 시 100% 커버리지
            NEW.training_completed_at
        ) ON CONFLICT (set_num) DO UPDATE SET
            is_ready_for_inspection = true,
            trained_parts_count = jsonb_array_length(NEW.trained_parts),
            total_parts_count = NEW.total_parts,
            coverage_percentage = 100.0,
            last_trained_at = NEW.training_completed_at,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER set_training_completion_trigger
    AFTER UPDATE ON set_training_status
    FOR EACH ROW
    EXECUTE FUNCTION update_set_inspection_status();

-- 완료 메시지
SELECT '✅ BrickBox 세트 단위 학습 시스템 스키마 생성 완료!' as status;
