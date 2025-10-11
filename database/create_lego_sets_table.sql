-- 🧱 BrickBox 레고 세트 테이블 생성
-- 누락 검출 시스템을 위한 기본 테이블 구조

-- 1. lego_sets 테이블 생성
CREATE TABLE IF NOT EXISTS lego_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_num VARCHAR(20) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    year INTEGER,
    theme TEXT,
    num_parts INTEGER,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. lego_parts 테이블 생성
CREATE TABLE IF NOT EXISTS lego_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_num VARCHAR(20) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    part_category_id INTEGER,
    part_material TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. lego_colors 테이블 생성
CREATE TABLE IF NOT EXISTS lego_colors (
    color_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    rgb VARCHAR(7),
    is_trans BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. set_parts 테이블 생성 (기존에 있을 수 있음)
CREATE TABLE IF NOT EXISTS set_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID REFERENCES lego_sets(id) ON DELETE CASCADE,
    part_id VARCHAR(20) NOT NULL,
    color_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    is_spare BOOLEAN DEFAULT FALSE,
    element_id VARCHAR(20),
    num_sets INTEGER DEFAULT 1,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_lego_sets_set_num ON lego_sets(set_num);
CREATE INDEX IF NOT EXISTS idx_lego_parts_part_num ON lego_parts(part_num);
CREATE INDEX IF NOT EXISTS idx_set_parts_set_id ON set_parts(set_id);
CREATE INDEX IF NOT EXISTS idx_set_parts_part_id ON set_parts(part_id);
CREATE INDEX IF NOT EXISTS idx_set_parts_color_id ON set_parts(color_id);

-- 6. RLS 정책 설정
ALTER TABLE lego_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lego_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_parts ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책
CREATE POLICY "Public read access for lego_sets" ON lego_sets
FOR SELECT USING (true);

CREATE POLICY "Public read access for lego_parts" ON lego_parts
FOR SELECT USING (true);

CREATE POLICY "Public read access for lego_colors" ON lego_colors
FOR SELECT USING (true);

CREATE POLICY "Public read access for set_parts" ON set_parts
FOR SELECT USING (true);

-- 7. 프로덕션 환경 - 샘플 데이터 제거됨

-- 9. 통계 확인
SELECT 
    'lego_sets' as table_name, 
    COUNT(*) as record_count 
FROM lego_sets
UNION ALL
SELECT 
    'lego_parts' as table_name, 
    COUNT(*) as record_count 
FROM lego_parts
UNION ALL
SELECT 
    'lego_colors' as table_name, 
    COUNT(*) as record_count 
FROM lego_colors
UNION ALL
SELECT 
    'set_parts' as table_name, 
    COUNT(*) as record_count 
FROM set_parts;





