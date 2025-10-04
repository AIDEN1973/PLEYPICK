-- 4단계: 외래키 제약 조건 확인

-- 1. 모든 외래키 제약 조건 확인
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('set_parts', 'parts_master_features', 'part_images')
ORDER BY tc.table_name, tc.constraint_name;

-- 2. 데이터 무결성 확인 (참조하는 데이터가 존재하는지)
SELECT 
  'set_parts' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN part_id IS NOT NULL THEN 1 END) as has_part_id,
  COUNT(CASE WHEN color_id IS NOT NULL THEN 1 END) as has_color_id
FROM set_parts

UNION ALL

SELECT 
  'parts_master_features' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN part_id IS NOT NULL THEN 1 END) as has_part_id,
  COUNT(CASE WHEN color_id IS NOT NULL THEN 1 END) as has_color_id
FROM parts_master_features;
