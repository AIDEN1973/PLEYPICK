-- 🧱 BrickBox 세트 단위 학습 상태 테이블 (간단 버전)

-- 세트별 학습 상태 테이블
CREATE TABLE IF NOT EXISTS set_training_status (
    id SERIAL PRIMARY KEY,
    set_num VARCHAR(50) NOT NULL UNIQUE, -- 레고 세트 번호 (예: 76917)
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'rendering', 'training', 'completed', 'failed'
    trained_model_id INTEGER REFERENCES model_registry(id), -- 학습 완료된 모델 ID
    trained_at TIMESTAMP WITH TIME ZONE, -- 학습 완료 시간
    last_rendered_at TIMESTAMP WITH TIME ZONE, -- 마지막 렌더링 시간
    total_parts_in_set INTEGER, -- 세트 내 총 부품 수
    unique_parts_trained INTEGER DEFAULT 0, -- 학습된 고유 부품 수
    is_available_for_inspection BOOLEAN DEFAULT false, -- 검수 가능 여부
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_set_training_status_set_num ON set_training_status(set_num);
CREATE INDEX IF NOT EXISTS idx_set_training_status_status ON set_training_status(status);
CREATE INDEX IF NOT EXISTS idx_set_training_status_inspection ON set_training_status(is_available_for_inspection);

-- RLS 정책 설정
ALTER TABLE set_training_status ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모든 사용자)
CREATE POLICY "Anyone can read set_training_status" ON set_training_status FOR SELECT USING (true);

-- 관리 권한 (서비스 역할)
CREATE POLICY "Service role can manage set_training_status" ON set_training_status FOR ALL USING (auth.role() = 'service_role');

-- 완료 메시지
SELECT '✅ set_training_status 테이블 생성 완료!' as status;
