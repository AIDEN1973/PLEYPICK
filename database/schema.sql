-- BrickBox 레고 부품 검수 시스템 데이터베이스 스키마

-- 레고 세트 테이블
CREATE TABLE lego_sets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    set_num VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    year INTEGER,
    theme_id INTEGER,
    num_parts INTEGER,
    set_img_url TEXT,
    set_url TEXT,
    last_modified_date TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 레고 부품 테이블
CREATE TABLE lego_parts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    part_num VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    part_cat_id INTEGER,
    part_url TEXT,
    part_img_url TEXT,
    external_ids JSONB,
    print_of VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 색상 테이블
CREATE TABLE lego_colors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    color_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    rgb VARCHAR(7),
    is_trans BOOLEAN DEFAULT FALSE,
    external_ids JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 세트-부품 관계 테이블 (세트에 포함된 부품들)
CREATE TABLE set_parts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    set_id UUID REFERENCES lego_sets(id) ON DELETE CASCADE,
    part_id UUID REFERENCES lego_parts(id) ON DELETE CASCADE,
    color_id UUID REFERENCES lego_colors(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    is_spare BOOLEAN DEFAULT FALSE,
    element_id VARCHAR(50),
    num_sets INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(set_id, part_id, color_id)
);

-- 이미지 관리 테이블
CREATE TABLE part_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    part_id UUID REFERENCES lego_parts(id) ON DELETE CASCADE,
    color_id UUID REFERENCES lego_colors(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    uploaded_url TEXT,
    local_path TEXT,
    filename VARCHAR(255),
    file_size INTEGER,
    image_width INTEGER,
    image_height INTEGER,
    download_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    upload_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 관리자 사용자 테이블 (프랜차이즈 본사 관리자)
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

-- 작업 로그 테이블
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

-- 인덱스 생성
CREATE INDEX idx_lego_sets_set_num ON lego_sets(set_num);
CREATE INDEX idx_lego_sets_theme_id ON lego_sets(theme_id);
CREATE INDEX idx_lego_sets_year ON lego_sets(year);

CREATE INDEX idx_lego_parts_part_num ON lego_parts(part_num);
CREATE INDEX idx_lego_parts_part_cat_id ON lego_parts(part_cat_id);

CREATE INDEX idx_lego_colors_color_id ON lego_colors(color_id);

CREATE INDEX idx_set_parts_set_id ON set_parts(set_id);
CREATE INDEX idx_set_parts_part_id ON set_parts(part_id);
CREATE INDEX idx_set_parts_color_id ON set_parts(color_id);

CREATE INDEX idx_part_images_part_id ON part_images(part_id);
CREATE INDEX idx_part_images_color_id ON part_images(color_id);
CREATE INDEX idx_part_images_download_status ON part_images(download_status);
CREATE INDEX idx_part_images_upload_status ON part_images(upload_status);

CREATE INDEX idx_operation_logs_admin_user_id ON operation_logs(admin_user_id);
CREATE INDEX idx_operation_logs_operation_type ON operation_logs(operation_type);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE lego_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 데이터에 접근 가능
CREATE POLICY "Admin users can access all data" ON lego_sets FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON lego_parts FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON lego_colors FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON set_parts FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON part_images FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON admin_users FOR ALL USING (true);
CREATE POLICY "Admin users can access all data" ON operation_logs FOR ALL USING (true);

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 설정
CREATE TRIGGER update_lego_sets_updated_at BEFORE UPDATE ON lego_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lego_parts_updated_at BEFORE UPDATE ON lego_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lego_colors_updated_at BEFORE UPDATE ON lego_colors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_part_images_updated_at BEFORE UPDATE ON part_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
