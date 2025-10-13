-- ============================================================================
-- part_category 제약 조건 수정
-- ============================================================================
-- 목적: CHECK 제약 제거 및 Foreign Key 추가
-- 작성일: 2025-10-13
-- 버전: 1.0
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔧 part_category 제약 조건 수정 시작...';
END $$;

-- 1. 기존 CHECK 제약 제거 (0-7 제한 해제)
DO $$
BEGIN
  -- CHECK 제약 존재 확인 및 제거
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_part_category' 
    AND conrelid = 'parts_master_features'::regclass
  ) THEN
    ALTER TABLE parts_master_features DROP CONSTRAINT chk_part_category;
    RAISE NOTICE '  ✓ 기존 CHECK 제약 (0-7) 제거 완료';
  ELSE
    RAISE NOTICE '  ℹ CHECK 제약이 존재하지 않음 (이미 제거됨)';
  END IF;
END $$;

-- 2. Foreign Key 추가 (part_categories 테이블 참조)
DO $$
BEGIN
  -- Foreign Key 존재 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_part_category' 
    AND conrelid = 'parts_master_features'::regclass
  ) THEN
    -- part_categories 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'part_categories') THEN
      ALTER TABLE parts_master_features
      ADD CONSTRAINT fk_part_category
      FOREIGN KEY (part_category) 
      REFERENCES part_categories(id)
      ON DELETE SET NULL;
      
      RAISE NOTICE '  ✓ Foreign Key 제약 추가 완료';
    ELSE
      RAISE NOTICE '  ⚠ part_categories 테이블이 없음 - Foreign Key 추가 건너뜀';
      RAISE NOTICE '  ℹ create_part_categories_table.sql을 먼저 실행하세요';
    END IF;
  ELSE
    RAISE NOTICE '  ℹ Foreign Key가 이미 존재함';
  END IF;
END $$;

-- 3. 인덱스 생성 (이미 있으면 스킵)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_part_category 
ON parts_master_features(part_category);

DO $$
BEGIN
  RAISE NOTICE '  ✓ 인덱스 확인 완료';
END $$;

-- 4. 편의 뷰 생성 (부품과 카테고리 JOIN)
CREATE OR REPLACE VIEW v_parts_with_category AS
SELECT 
  pmf.*,
  pc.code as category_code,
  pc.display_name as category_name,
  pc.display_name_ko as category_name_ko,
  pc.category_type,
  pc.description as category_description
FROM parts_master_features pmf
LEFT JOIN part_categories pc ON pmf.part_category = pc.id;

DO $$
BEGIN
  RAISE NOTICE '  ✓ 편의 뷰 (v_parts_with_category) 생성 완료';
END $$;

-- 5. 완료 메시지 및 통계
DO $$
DECLARE
  total_parts INTEGER;
  parts_with_category INTEGER;
  parts_without_category INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_parts FROM parts_master_features;
  SELECT COUNT(*) INTO parts_with_category FROM parts_master_features WHERE part_category IS NOT NULL;
  SELECT COUNT(*) INTO parts_without_category FROM parts_master_features WHERE part_category IS NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ part_category 제약 조건 수정 완료!';
  RAISE NOTICE '📊 통계:';
  RAISE NOTICE '  - 전체 부품 수: %', total_parts;
  RAISE NOTICE '  - 카테고리 있음: %', parts_with_category;
  RAISE NOTICE '  - 카테고리 없음: %', parts_without_category;
END $$;

-- 6. 검증 쿼리
SELECT 
  '제약 조건 수정 완료' as status,
  COUNT(*) as total_parts,
  COUNT(CASE WHEN part_category IS NOT NULL THEN 1 END) as parts_with_category,
  COUNT(CASE WHEN part_category IS NULL THEN 1 END) as parts_without_category
FROM parts_master_features;

