-- ============================================================================
-- 부품 카테고리 Enum 테이블 생성
-- ============================================================================
-- 목적: 확장 가능한 카테고리 관리 시스템
-- 작성일: 2025-10-13
-- 버전: 1.0
-- ============================================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS part_categories (
  id INTEGER PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,        -- 코드에서 사용하는 키 ('plate', 'brick', ...)
  display_name VARCHAR(50) NOT NULL,       -- 표시명 ('Plate', 'Brick', ...)
  display_name_ko VARCHAR(50),             -- 한글 표시명 (다국어 지원)
  description TEXT,                        -- 설명
  category_type VARCHAR(20) DEFAULT 'shape', -- 'shape' | 'series'
  parent_id INTEGER REFERENCES part_categories(id), -- 계층 구조 지원 (향후 확장)
  is_active BOOLEAN DEFAULT TRUE,          -- 활성화 상태
  sort_order INTEGER DEFAULT 0,            -- 정렬 순서
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 기본 shape 카테고리 삽입 (형태 분류)
INSERT INTO part_categories (id, code, display_name, display_name_ko, description, category_type, sort_order) VALUES
-- 기본 형태 (1-19)
(1, 'plate', 'Plate', '플레이트', '평평한 플레이트 부품', 'shape', 1),
(2, 'brick', 'Brick', '브릭', '기본 브릭 부품', 'shape', 2),
(3, 'tile', 'Tile', '타일', '스터드 없는 타일 부품', 'shape', 3),
(4, 'slope', 'Slope', '슬로프', '경사 부품', 'shape', 4),
(5, 'panel', 'Panel', '패널', '패널 부품', 'shape', 5),
(6, 'wedge', 'Wedge', '쐐기', '쐐기 부품', 'shape', 6),
(7, 'cylinder', 'Cylinder', '원기둥', '원기둥 부품', 'shape', 7),
(8, 'cone', 'Cone', '원뿔', '원뿔 부품', 'shape', 8),
(9, 'arch', 'Arch', '아치', '아치 부품', 'shape', 9),
(10, 'round', 'Round', '둥근 부품', '둥근 형태의 부품', 'shape', 10),
(11, 'dish', 'Dish', '접시', '접시 형태의 부품', 'shape', 11),
(12, 'hinge', 'Hinge', '힌지', '힌지 부품', 'shape', 12),
(13, 'clip', 'Clip', '클립', '클립 부품', 'shape', 13),
(14, 'bar', 'Bar', '바', '바 형태의 부품', 'shape', 14),
(15, 'fence', 'Fence', '펜스', '펜스 부품', 'shape', 15),
(16, 'door', 'Door', '문', '문 부품', 'shape', 16),
(17, 'window', 'Window', '창문', '창문 부품', 'shape', 17),
(18, 'roof', 'Roof', '지붕', '지붕 부품', 'shape', 18),
(19, 'inverted', 'Inverted', '역전', '역전 형태 부품', 'shape', 19),

-- 특수 카테고리 (20-29)
(20, 'minifig_part', 'Minifig Part', '미니피규어', '미니피규어 관련 부품', 'shape', 20),
(21, 'animal_figure', 'Animal Figure', '동물', '동물 피규어', 'shape', 21),
(22, 'plant_leaf', 'Plant/Leaf', '식물/잎', '식물 및 잎 부품', 'shape', 22),
(23, 'wheel', 'Wheel', '바퀴', '바퀴 부품', 'shape', 23),
(24, 'tire', 'Tire', '타이어', '타이어 부품', 'shape', 24),
(25, 'wing', 'Wing', '날개', '날개 부품', 'shape', 25),
(26, 'propeller', 'Propeller', '프로펠러', '프로펠러 부품', 'shape', 26),
(27, 'gear', 'Gear', '기어', '기어 부품', 'shape', 27),
(28, 'chain', 'Chain', '체인', '체인 부품', 'shape', 28),
(29, 'axle', 'Axle', '축', '축 부품', 'shape', 29),

-- 미래 확장 여유 (30-98)
-- ... 필요시 추가

-- 특수 값
(99, 'unknown', 'Unknown', '알 수 없음', '분류되지 않은 부품', 'shape', 999)
ON CONFLICT (id) DO NOTHING;

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_part_categories_code ON part_categories(code);
CREATE INDEX IF NOT EXISTS idx_part_categories_type ON part_categories(category_type);
CREATE INDEX IF NOT EXISTS idx_part_categories_active ON part_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_part_categories_sort ON part_categories(sort_order);

-- 4. 업데이트 트리거 (updated_at 자동 갱신)
CREATE OR REPLACE FUNCTION update_part_categories_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS part_categories_update_trigger ON part_categories;
CREATE TRIGGER part_categories_update_trigger
BEFORE UPDATE ON part_categories
FOR EACH ROW
EXECUTE FUNCTION update_part_categories_timestamp();

-- 5. 통계 뷰 생성
CREATE OR REPLACE VIEW v_part_categories_stats AS
SELECT 
  pc.id,
  pc.code,
  pc.display_name,
  pc.display_name_ko,
  pc.category_type,
  pc.is_active,
  COUNT(pmf.id) as part_count,
  AVG(pmf.confidence) as avg_confidence,
  MAX(pmf.updated_at) as last_part_update
FROM part_categories pc
LEFT JOIN parts_master_features pmf ON pmf.part_category = pc.id
WHERE pc.is_active = TRUE
GROUP BY pc.id, pc.code, pc.display_name, pc.display_name_ko, pc.category_type, pc.is_active
ORDER BY pc.sort_order;

-- 6. RLS (Row Level Security) 설정
ALTER TABLE part_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "part_categories_read_policy" ON part_categories;
CREATE POLICY "part_categories_read_policy" ON part_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "part_categories_write_policy" ON part_categories;
CREATE POLICY "part_categories_write_policy" ON part_categories
  FOR ALL USING (auth.role() = 'authenticated');

-- 7. 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ part_categories 테이블 생성 완료';
  RAISE NOTICE '📊 등록된 카테고리 수: %', (SELECT COUNT(*) FROM part_categories);
END $$;

-- 8. 검증 쿼리
SELECT 
  '카테고리 테이블 생성 완료' as status,
  COUNT(*) as total_categories,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_categories
FROM part_categories;

