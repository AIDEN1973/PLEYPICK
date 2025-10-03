-- Rebrickable API 모든 필드를 수용하기 위한 마이그레이션 스크립트

-- 1. lego_sets 테이블에 추가 필드들
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS parent_set_num VARCHAR(50);
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3);
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS dimensions JSONB;
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS availability VARCHAR(50);
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS barcode VARCHAR(50);
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS instructions_count INTEGER;
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS additional_image_count INTEGER;
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS last_modified_dt TIMESTAMP;
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS external_ids JSONB;
ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS tags TEXT[];

-- 2. lego_parts 테이블에 추가 필드들
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS material_id INTEGER;
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS part_material VARCHAR(100);
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3);
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS dimensions JSONB;
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS is_obsolete BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS is_alternate BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS is_counterpart BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS is_spare BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_parts ADD COLUMN IF NOT EXISTS tags TEXT[];

-- 3. lego_colors 테이블에 추가 필드들
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS hex_code VARCHAR(7);
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_metallic BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_glow BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_fabric BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_chrome BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_pearl BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_satin BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_matte BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_glitter BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_speckle BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_iridescent BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_flip_flop BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_milky BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_modulex BOOLEAN DEFAULT FALSE;
ALTER TABLE lego_colors ADD COLUMN IF NOT EXISTS is_glow_in_dark BOOLEAN DEFAULT FALSE;

-- 4. lego_themes 테이블 생성
CREATE TABLE IF NOT EXISTS lego_themes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    theme_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    parent_id INTEGER,
    theme_url TEXT,
    theme_img_url TEXT,
    is_subtheme BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 추가 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_lego_sets_parent_set_num ON lego_sets(parent_set_num);
CREATE INDEX IF NOT EXISTS idx_lego_sets_availability ON lego_sets(availability);
CREATE INDEX IF NOT EXISTS idx_lego_parts_material_id ON lego_parts(material_id);
CREATE INDEX IF NOT EXISTS idx_lego_parts_is_obsolete ON lego_parts(is_obsolete);
CREATE INDEX IF NOT EXISTS idx_lego_colors_is_trans ON lego_colors(is_trans);
CREATE INDEX IF NOT EXISTS idx_lego_colors_is_metallic ON lego_colors(is_metallic);
CREATE INDEX IF NOT EXISTS idx_lego_themes_theme_id ON lego_themes(theme_id);
CREATE INDEX IF NOT EXISTS idx_lego_themes_parent_id ON lego_themes(parent_id);

-- 6. RLS 정책 추가
ALTER TABLE lego_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin users can access all data" ON lego_themes FOR ALL USING (true);

-- 7. 트리거 추가
CREATE TRIGGER update_lego_themes_updated_at 
    BEFORE UPDATE ON lego_themes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. 코멘트 추가
COMMENT ON TABLE lego_sets IS 'Rebrickable API의 모든 세트 정보를 저장하는 테이블';
COMMENT ON TABLE lego_parts IS 'Rebrickable API의 모든 부품 정보를 저장하는 테이블';
COMMENT ON TABLE lego_colors IS 'Rebrickable API의 모든 색상 정보를 저장하는 테이블';
COMMENT ON TABLE lego_themes IS 'Rebrickable API의 모든 테마 정보를 저장하는 테이블';
COMMENT ON TABLE set_parts IS '세트와 부품 간의 관계를 저장하는 테이블';
COMMENT ON TABLE part_images IS '부품 이미지 관리 정보를 저장하는 테이블';
