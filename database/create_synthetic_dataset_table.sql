-- 🧱 synthetic_dataset 테이블 생성
-- Supabase SQL Editor에서 실행

-- synthetic_dataset 테이블 생성
CREATE TABLE IF NOT EXISTS synthetic_dataset (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_images INTEGER DEFAULT 0,
    total_annotations INTEGER DEFAULT 0,
    dataset_path VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system'
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_synthetic_dataset_status ON synthetic_dataset(status);
CREATE INDEX IF NOT EXISTS idx_synthetic_dataset_created_at ON synthetic_dataset(created_at);

-- RLS 정책 설정
ALTER TABLE synthetic_dataset ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can read synthetic_dataset" ON synthetic_dataset FOR SELECT USING (true);

-- 테스트 데이터 삽입
INSERT INTO synthetic_dataset (name, description, total_images, total_annotations, dataset_path, status)
VALUES 
  ('BrickBox Lego Parts Dataset', '레고 부품 합성 데이터셋', 1000, 1000, '/datasets/lego_parts', 'active'),
  ('Test Dataset', '테스트용 데이터셋', 100, 100, '/datasets/test', 'active')
ON CONFLICT DO NOTHING;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ synthetic_dataset 테이블 생성 완료!';
    RAISE NOTICE '📊 테스트 데이터: 2개 데이터셋';
END $$;