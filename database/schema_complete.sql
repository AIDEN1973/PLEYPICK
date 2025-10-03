-- BrickBox 레고 부품 검수 시스템 - 완전한 Rebrickable API 호환 스키마
-- 실제 API 응답 분석을 바탕으로 모든 필드를 포함한 완전한 스키마

-- ==============================================
-- 1. 레고 세트 테이블 (완전한 Rebrickable API 호환)
-- ==============================================
CREATE TABLE lego_sets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 기본 식별자
    set_num VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    
    -- 시간 정보
    year INTEGER,
    year_from INTEGER,
    year_to INTEGER,
    
    -- 분류 정보
    theme_id INTEGER,
    parent_set_num VARCHAR(50),
    
    -- 부품 정보
    num_parts INTEGER,
    
    -- URL 정보
    set_img_url TEXT,
    set_url TEXT,
    
    -- 물리적 속성
    weight DECIMAL(10,3),
    dimensions JSONB, -- {length, width, height}
    
    -- 상태 정보
    availability VARCHAR(50), -- 'Available', 'Discontinued', etc.
    barcode VARCHAR(50),
    
    -- 메타데이터
    instructions_count INTEGER,
    additional_image_count INTEGER,
    last_modified_date TIMESTAMP,
    last_modified_dt TIMESTAMP,
    
    -- 외부 시스템 연동
    external_ids JSONB, -- BrickLink, BrickOwl, LEGO 등의 외부 ID
    
    -- 태그 및 기타
    tags TEXT[],
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 2. 레고 부품 테이블 (완전한 Rebrickable API 호환)
-- ==============================================
CREATE TABLE lego_parts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 기본 식별자
    part_num VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    
    -- 분류 정보
    part_cat_id INTEGER,
    material_id INTEGER,
    part_material VARCHAR(100),
    
    -- 시간 정보
    year_from INTEGER,
    year_to INTEGER,
    
    -- URL 정보
    part_url TEXT,
    part_img_url TEXT,
    
    -- 물리적 속성
    weight DECIMAL(10,3),
    dimensions JSONB, -- {length, width, height}
    
    -- 상태 정보
    is_obsolete BOOLEAN DEFAULT FALSE,
    is_alternate BOOLEAN DEFAULT FALSE,
    is_counterpart BOOLEAN DEFAULT FALSE,
    is_spare BOOLEAN DEFAULT FALSE,
    
    -- 외부 시스템 연동
    external_ids JSONB, -- BrickLink, BrickOwl, LEGO 등의 외부 ID
    print_of VARCHAR(50),
    
    -- 태그 및 기타
    tags TEXT[],
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 3. 색상 테이블 (완전한 Rebrickable API 호환)
-- ==============================================
CREATE TABLE lego_colors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 기본 식별자
    color_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    
    -- 색상 정보
    rgb VARCHAR(7),
    hex_code VARCHAR(7),
    
    -- 색상 속성 (모든 Rebrickable 색상 속성 포함)
    is_trans BOOLEAN DEFAULT FALSE,
    is_metallic BOOLEAN DEFAULT FALSE,
    is_glow BOOLEAN DEFAULT FALSE,
    is_fabric BOOLEAN DEFAULT FALSE,
    is_chrome BOOLEAN DEFAULT FALSE,
    is_pearl BOOLEAN DEFAULT FALSE,
    is_satin BOOLEAN DEFAULT FALSE,
    is_matte BOOLEAN DEFAULT FALSE,
    is_glitter BOOLEAN DEFAULT FALSE,
    is_speckle BOOLEAN DEFAULT FALSE,
    is_iridescent BOOLEAN DEFAULT FALSE,
    is_flip_flop BOOLEAN DEFAULT FALSE,
    is_milky BOOLEAN DEFAULT FALSE,
    is_modulex BOOLEAN DEFAULT FALSE,
    is_glow_in_dark BOOLEAN DEFAULT FALSE,
    
    -- 외부 시스템 연동
    external_ids JSONB, -- BrickLink, BrickOwl, LEGO 등의 외부 ID
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 4. 테마 테이블 (완전한 Rebrickable API 호환)
-- ==============================================
CREATE TABLE lego_themes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 기본 식별자
    theme_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    
    -- 계층 구조
    parent_id INTEGER,
    is_subtheme BOOLEAN DEFAULT FALSE,
    
    -- URL 정보
    theme_url TEXT,
    theme_img_url TEXT,
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 5. 부품 카테고리 테이블 (새로 추가)
-- ==============================================
CREATE TABLE lego_part_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 기본 식별자
    part_cat_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    
    -- URL 정보
    part_cat_url TEXT,
    part_cat_img_url TEXT,
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 6. 재질 테이블 (새로 추가)
-- ==============================================
CREATE TABLE lego_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 기본 식별자
    material_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    
    -- 재질 속성
    material_type VARCHAR(100), -- 'Plastic', 'Metal', 'Fabric', etc.
    is_biodegradable BOOLEAN DEFAULT FALSE,
    is_recyclable BOOLEAN DEFAULT FALSE,
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 7. 세트-부품 관계 테이블 (개선된 버전)
-- ==============================================
CREATE TABLE set_parts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 관계 식별자
    set_id UUID REFERENCES lego_sets(id) ON DELETE CASCADE,
    part_id UUID REFERENCES lego_parts(id) ON DELETE CASCADE,
    color_id UUID REFERENCES lego_colors(id) ON DELETE CASCADE,
    
    -- 수량 정보
    quantity INTEGER NOT NULL DEFAULT 1,
    num_sets INTEGER DEFAULT 1,
    
    -- 부품 상태
    is_spare BOOLEAN DEFAULT FALSE,
    is_alternate BOOLEAN DEFAULT FALSE,
    is_counterpart BOOLEAN DEFAULT FALSE,
    
    -- 요소 정보
    element_id VARCHAR(50),
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(set_id, part_id, color_id, element_id)
);

-- ==============================================
-- 8. 이미지 관리 테이블 (개선된 버전)
-- ==============================================
CREATE TABLE part_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 관계 식별자
    part_id UUID REFERENCES lego_parts(id) ON DELETE CASCADE,
    color_id UUID REFERENCES lego_colors(id) ON DELETE CASCADE,
    
    -- 이미지 정보
    original_url TEXT NOT NULL,
    uploaded_url TEXT,
    local_path TEXT,
    filename VARCHAR(255),
    
    -- 이미지 메타데이터
    file_size INTEGER,
    image_width INTEGER,
    image_height INTEGER,
    image_format VARCHAR(10), -- 'jpg', 'png', 'gif', etc.
    
    -- 처리 상태
    download_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    upload_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    error_message TEXT,
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 9. 관리자 사용자 테이블
-- ==============================================
CREATE TABLE admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin', -- admin, super_admin
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 10. 작업 로그 테이블
-- ==============================================
CREATE TABLE operation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES admin_users(id),
    operation_type VARCHAR(50) NOT NULL, -- set_import, part_import, image_download, image_upload
    target_type VARCHAR(50), -- set, part, image
    target_id UUID,
    status VARCHAR(20) NOT NULL, -- success, failed, in_progress
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 인덱스 생성 (성능 최적화)
-- ==============================================

-- 세트 테이블 인덱스
CREATE INDEX idx_lego_sets_set_num ON lego_sets(set_num);
CREATE INDEX idx_lego_sets_theme_id ON lego_sets(theme_id);
CREATE INDEX idx_lego_sets_year ON lego_sets(year);
CREATE INDEX idx_lego_sets_year_from ON lego_sets(year_from);
CREATE INDEX idx_lego_sets_year_to ON lego_sets(year_to);
CREATE INDEX idx_lego_sets_parent_set_num ON lego_sets(parent_set_num);
CREATE INDEX idx_lego_sets_availability ON lego_sets(availability);
CREATE INDEX idx_lego_sets_num_parts ON lego_sets(num_parts);

-- 부품 테이블 인덱스
CREATE INDEX idx_lego_parts_part_num ON lego_parts(part_num);
CREATE INDEX idx_lego_parts_part_cat_id ON lego_parts(part_cat_id);
CREATE INDEX idx_lego_parts_material_id ON lego_parts(material_id);
CREATE INDEX idx_lego_parts_year_from ON lego_parts(year_from);
CREATE INDEX idx_lego_parts_year_to ON lego_parts(year_to);
CREATE INDEX idx_lego_parts_is_obsolete ON lego_parts(is_obsolete);

-- 색상 테이블 인덱스
CREATE INDEX idx_lego_colors_color_id ON lego_colors(color_id);
CREATE INDEX idx_lego_colors_is_trans ON lego_colors(is_trans);
CREATE INDEX idx_lego_colors_is_metallic ON lego_colors(is_metallic);
CREATE INDEX idx_lego_colors_is_glow ON lego_colors(is_glow);

-- 테마 테이블 인덱스
CREATE INDEX idx_lego_themes_theme_id ON lego_themes(theme_id);
CREATE INDEX idx_lego_themes_parent_id ON lego_themes(parent_id);
CREATE INDEX idx_lego_themes_is_subtheme ON lego_themes(is_subtheme);

-- 부품 카테고리 테이블 인덱스
CREATE INDEX idx_lego_part_categories_part_cat_id ON lego_part_categories(part_cat_id);

-- 재질 테이블 인덱스
CREATE INDEX idx_lego_materials_material_id ON lego_materials(material_id);
CREATE INDEX idx_lego_materials_material_type ON lego_materials(material_type);

-- 관계 테이블 인덱스
CREATE INDEX idx_set_parts_set_id ON set_parts(set_id);
CREATE INDEX idx_set_parts_part_id ON set_parts(part_id);
CREATE INDEX idx_set_parts_color_id ON set_parts(color_id);
CREATE INDEX idx_set_parts_element_id ON set_parts(element_id);

-- 이미지 테이블 인덱스
CREATE INDEX idx_part_images_part_id ON part_images(part_id);
CREATE INDEX idx_part_images_color_id ON part_images(color_id);
CREATE INDEX idx_part_images_download_status ON part_images(download_status);
CREATE INDEX idx_part_images_upload_status ON part_images(upload_status);

-- 로그 테이블 인덱스
CREATE INDEX idx_operation_logs_admin_user_id ON operation_logs(admin_user_id);
CREATE INDEX idx_operation_logs_operation_type ON operation_logs(operation_type);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);

-- ==============================================
-- RLS (Row Level Security) 정책 설정
-- ==============================================
ALTER TABLE lego_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_part_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 데이터에 접근 가능
CREATE POLICY "Admin users can access all data" ON lego_sets FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON lego_parts FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON lego_colors FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON lego_themes FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON lego_part_categories FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON lego_materials FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON set_parts FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON part_images FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON admin_users FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON operation_logs FOR ALL USING (true);

-- ==============================================
-- 업데이트 시간 자동 갱신 함수
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==============================================
-- 트리거 설정
-- ==============================================
CREATE TRIGGER update_lego_sets_updated_at BEFORE UPDATE ON lego_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lego_parts_updated_at BEFORE UPDATE ON lego_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lego_colors_updated_at BEFORE UPDATE ON lego_colors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lego_themes_updated_at BEFORE UPDATE ON lego_themes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lego_part_categories_updated_at BEFORE UPDATE ON lego_part_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lego_materials_updated_at BEFORE UPDATE ON lego_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_part_images_updated_at BEFORE UPDATE ON part_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 코멘트 추가
-- ==============================================
COMMENT ON TABLE lego_sets IS 'Rebrickable API의 모든 세트 정보를 저장하는 완전한 테이블';
COMMENT ON TABLE lego_parts IS 'Rebrickable API의 모든 부품 정보를 저장하는 완전한 테이블';
COMMENT ON TABLE lego_colors IS 'Rebrickable API의 모든 색상 정보를 저장하는 완전한 테이블';
COMMENT ON TABLE lego_themes IS 'Rebrickable API의 모든 테마 정보를 저장하는 완전한 테이블';
COMMENT ON TABLE lego_part_categories IS '부품 카테고리 정보를 저장하는 테이블';
COMMENT ON TABLE lego_materials IS '재질 정보를 저장하는 테이블';
COMMENT ON TABLE set_parts IS '세트와 부품 간의 관계를 저장하는 테이블';
COMMENT ON TABLE part_images IS '부품 이미지 관리 정보를 저장하는 테이블';
COMMENT ON TABLE admin_users IS '관리자 사용자 정보를 저장하는 테이블';
COMMENT ON TABLE operation_logs IS '작업 로그를 저장하는 테이블';
