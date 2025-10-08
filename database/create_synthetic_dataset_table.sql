-- 🧱 BrickBox 합성 데이터셋 메타데이터 관리 테이블
-- LDraw → Blender → Supabase 파이프라인에서 생성된 합성 데이터의 메타데이터를 저장

-- 1. 합성 데이터셋 메인 테이블
CREATE TABLE IF NOT EXISTS synthetic_dataset (
    id SERIAL PRIMARY KEY,
    part_id VARCHAR(20) NOT NULL,
    image_url TEXT,
    annotation_url TEXT,
    image_path TEXT,
    annotation_path TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 부품별 통계 테이블
CREATE TABLE IF NOT EXISTS synthetic_part_stats (
    part_id VARCHAR(20) PRIMARY KEY,
    total_images INTEGER DEFAULT 0,
    total_annotations INTEGER DEFAULT 0,
    color_distribution JSONB,
    angle_distribution JSONB,
    background_distribution JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 렌더링 설정 테이블
CREATE TABLE IF NOT EXISTS synthetic_render_configs (
    id SERIAL PRIMARY KEY,
    config_name VARCHAR(100) NOT NULL,
    render_settings JSONB NOT NULL,
    material_settings JSONB,
    lighting_settings JSONB,
    background_settings JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_synthetic_dataset_part_id ON synthetic_dataset(part_id);
CREATE INDEX IF NOT EXISTS idx_synthetic_dataset_created_at ON synthetic_dataset(created_at);
CREATE INDEX IF NOT EXISTS idx_synthetic_dataset_metadata ON synthetic_dataset USING GIN(metadata);

-- 5. RLS 정책 설정
ALTER TABLE synthetic_dataset ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_part_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_render_configs ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책
CREATE POLICY "Public read access for synthetic_dataset" ON synthetic_dataset
FOR SELECT USING (true);

CREATE POLICY "Public read access for synthetic_part_stats" ON synthetic_part_stats
FOR SELECT USING (true);

CREATE POLICY "Public read access for synthetic_render_configs" ON synthetic_render_configs
FOR SELECT USING (true);

-- 인증된 사용자 쓰기 정책
CREATE POLICY "Authenticated insert for synthetic_dataset" ON synthetic_dataset
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update for synthetic_dataset" ON synthetic_dataset
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert for synthetic_part_stats" ON synthetic_part_stats
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update for synthetic_part_stats" ON synthetic_part_stats
FOR UPDATE USING (auth.role() = 'authenticated');

-- 6. 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_synthetic_part_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 부품별 통계 업데이트
    INSERT INTO synthetic_part_stats (part_id, total_images, total_annotations, last_updated)
    VALUES (NEW.part_id, 1, 1, NOW())
    ON CONFLICT (part_id) 
    DO UPDATE SET 
        total_images = synthetic_part_stats.total_images + 1,
        total_annotations = synthetic_part_stats.total_annotations + 1,
        last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 트리거 생성
CREATE TRIGGER trigger_update_part_stats
    AFTER INSERT ON synthetic_dataset
    FOR EACH ROW
    EXECUTE FUNCTION update_synthetic_part_stats();

-- 8. 기본 렌더링 설정 삽입
INSERT INTO synthetic_render_configs (config_name, render_settings, material_settings, lighting_settings, background_settings)
VALUES (
    'default_yolo_training',
    '{
        "resolution": [640, 640],
        "samples": 64,
        "engine": "cycles",
        "file_format": "PNG"
    }',
    '{
        "lego_colors": {
            "red": [0.8, 0.1, 0.1, 1.0],
            "blue": [0.1, 0.3, 0.8, 1.0],
            "green": [0.1, 0.7, 0.2, 1.0],
            "yellow": [0.9, 0.8, 0.1, 1.0],
            "white": [0.95, 0.95, 0.95, 1.0],
            "black": [0.1, 0.1, 0.1, 1.0]
        },
        "material_properties": {
            "metallic": 0.0,
            "roughness": 0.3
        }
    }',
    '{
        "key_light": {
            "type": "SUN",
            "energy": 3.0,
            "color": [1.0, 0.95, 0.8]
        },
        "fill_light": {
            "type": "AREA",
            "energy": 1.5,
            "color": [0.8, 0.9, 1.0]
        }
    }',
    '{
        "background_types": ["solid_white", "solid_black", "gradient", "checkerboard"],
        "default_strength": 1.0
    }'
) ON CONFLICT DO NOTHING;

-- 9. 테이블 생성 확인
SELECT 'synthetic_dataset' as table_name, COUNT(*) as record_count FROM synthetic_dataset
UNION ALL
SELECT 'synthetic_part_stats' as table_name, COUNT(*) as record_count FROM synthetic_part_stats
UNION ALL
SELECT 'synthetic_render_configs' as table_name, COUNT(*) as record_count FROM synthetic_render_configs;
