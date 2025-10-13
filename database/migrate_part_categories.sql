-- ============================================================================
-- part_category 데이터 마이그레이션
-- ============================================================================
-- 목적: 기존 데이터를 새로운 카테고리 ID로 마이그레이션
-- 작성일: 2025-10-13
-- 버전: 1.0
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔄 part_category 데이터 마이그레이션 시작...';
END $$;

-- 1. 백업 테이블 생성
DO $$
BEGIN
  -- 백업 테이블이 없으면 생성
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'parts_master_features_category_backup') THEN
    CREATE TABLE parts_master_features_category_backup AS
    SELECT id, part_id, color_id, part_category, updated_at
    FROM parts_master_features;
    
    RAISE NOTICE '  ✓ 백업 테이블 생성 완료: parts_master_features_category_backup';
  ELSE
    RAISE NOTICE '  ℹ 백업 테이블이 이미 존재함';
  END IF;
END $$;

-- 2. 기존 part_category 값 마이그레이션
-- 구 매핑 → 신 매핑
DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- animal_figure: 8 → 21
  UPDATE parts_master_features
  SET part_category = 21
  WHERE part_category = 8;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '  ✓ animal_figure: 8 → 21 (% 건)', updated_count;
  END IF;
  
  -- plant_leaf: 9 → 22
  UPDATE parts_master_features
  SET part_category = 22
  WHERE part_category = 9;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '  ✓ plant_leaf: 9 → 22 (% 건)', updated_count;
  END IF;
  
  -- unknown: 0 → 99 (일관성 개선)
  UPDATE parts_master_features
  SET part_category = 99
  WHERE part_category = 0;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '  ✓ unknown: 0 → 99 (% 건)', updated_count;
  END IF;
  
  -- 나머지는 그대로 유지 (1-7: plate, brick, tile, slope, panel, wedge, cylinder)
  RAISE NOTICE '  ✓ 기본 카테고리 (1-7) 유지';
END $$;

-- 3. shape_tag 기반 자동 카테고리 할당 (part_category가 NULL인 경우)
DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- shape_tag가 있는데 part_category가 NULL인 경우
  UPDATE parts_master_features pmf
  SET part_category = pc.id
  FROM part_categories pc
  WHERE pmf.shape_tag = pc.code
    AND pmf.part_category IS NULL
    AND pmf.shape_tag IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '  ✓ shape_tag 기반 자동 할당 (% 건)', updated_count;
  END IF;
END $$;

-- 4. part_name 기반 추론 (shape_tag와 part_category 모두 NULL인 경우)
DO $$
DECLARE
  updated_count INTEGER := 0;
  total_inferred INTEGER := 0;
BEGIN
  -- plate
  UPDATE parts_master_features
  SET part_category = 1, shape_tag = 'plate'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%plate%' OR LOWER(part_name) LIKE '%플레이트%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  -- brick
  UPDATE parts_master_features
  SET part_category = 2, shape_tag = 'brick'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%brick%' OR LOWER(part_name) LIKE '%브릭%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  -- tile
  UPDATE parts_master_features
  SET part_category = 3, shape_tag = 'tile'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%tile%' OR LOWER(part_name) LIKE '%타일%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  -- slope
  UPDATE parts_master_features
  SET part_category = 4, shape_tag = 'slope'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%slope%' OR LOWER(part_name) LIKE '%경사%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  -- wedge
  UPDATE parts_master_features
  SET part_category = 6, shape_tag = 'wedge'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%wedge%' OR LOWER(part_name) LIKE '%쐐기%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  -- arch
  UPDATE parts_master_features
  SET part_category = 9, shape_tag = 'arch'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%arch%' OR LOWER(part_name) LIKE '%아치%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  -- wheel
  UPDATE parts_master_features
  SET part_category = 23, shape_tag = 'wheel'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%wheel%' OR LOWER(part_name) LIKE '%바퀴%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  -- animal
  UPDATE parts_master_features
  SET part_category = 21, shape_tag = 'animal_figure'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%animal%' OR LOWER(part_name) LIKE '%동물%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  -- plant
  UPDATE parts_master_features
  SET part_category = 22, shape_tag = 'plant_leaf'
  WHERE part_category IS NULL 
    AND (LOWER(part_name) LIKE '%plant%' OR LOWER(part_name) LIKE '%leaf%' 
         OR LOWER(part_name) LIKE '%식물%' OR LOWER(part_name) LIKE '%잎%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  total_inferred := total_inferred + updated_count;
  
  IF total_inferred > 0 THEN
    RAISE NOTICE '  ✓ part_name 기반 추론 (% 건)', total_inferred;
  END IF;
END $$;

-- 5. 나머지는 unknown (99)으로 설정
DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  UPDATE parts_master_features
  SET part_category = 99, shape_tag = 'unknown'
  WHERE part_category IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '  ✓ 나머지 unknown 설정 (% 건)', updated_count;
  END IF;
END $$;

-- 6. 통계 업데이트
ANALYZE parts_master_features;

-- 7. 완료 메시지 및 마이그레이션 결과
DO $$
DECLARE
  total_parts INTEGER;
  category_distribution TEXT;
BEGIN
  SELECT COUNT(*) INTO total_parts FROM parts_master_features;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ 데이터 마이그레이션 완료!';
  RAISE NOTICE '📊 카테고리별 분포:';
  
  FOR category_distribution IN
    SELECT 
      '  - ' || COALESCE(pc.display_name, 'NULL') || ' (' || COALESCE(pc.code, 'null') || '): ' || COUNT(pmf.id) || ' 건'
    FROM parts_master_features pmf
    LEFT JOIN part_categories pc ON pmf.part_category = pc.id
    GROUP BY pc.display_name, pc.code, pc.sort_order
    ORDER BY pc.sort_order NULLS LAST
  LOOP
    RAISE NOTICE '%', category_distribution;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '💾 백업 테이블: parts_master_features_category_backup';
  RAISE NOTICE '   (마이그레이션 검증 후 삭제 가능)';
END $$;

-- 8. 검증 쿼리
SELECT 
  '마이그레이션 완료' as status,
  pc.display_name as category,
  pc.code,
  COUNT(pmf.id) as count
FROM parts_master_features pmf
LEFT JOIN part_categories pc ON pmf.part_category = pc.id
GROUP BY pc.id, pc.display_name, pc.code, pc.sort_order
ORDER BY pc.sort_order NULLS LAST;

