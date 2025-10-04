-- 스키마 수정 후 검증 쿼리

-- 1. 모든 테이블의 part_id 컬럼 타입 확인
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE column_name = 'part_id' 
ORDER BY table_name;

-- 2. 모든 테이블의 color_id 컬럼 타입 확인
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE column_name = 'color_id' 
ORDER BY table_name;

-- 3. parts_master_features 테이블의 제약 조건 확인
SELECT 
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints 
WHERE table_name = 'parts_master_features';

-- 4. parts_master_features 테이블의 인덱스 확인
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'parts_master_features';

-- 5. 데이터 타입 일관성 검증
SELECT 
  'part_id' as column_type,
  COUNT(DISTINCT data_type) as type_variations,
  STRING_AGG(DISTINCT data_type, ', ') as all_types
FROM information_schema.columns 
WHERE column_name = 'part_id'

UNION ALL

SELECT 
  'color_id' as column_type,
  COUNT(DISTINCT data_type) as type_variations,
  STRING_AGG(DISTINCT data_type, ', ') as all_types
FROM information_schema.columns 
WHERE column_name = 'color_id';
