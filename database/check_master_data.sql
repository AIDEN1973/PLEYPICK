-- parts_master_features 테이블의 데이터 확인
SELECT 
  part_id, 
  color_id, 
  feature_json->>'shape' as shape,
  confidence,
  created_at
FROM parts_master_features 
WHERE part_id IN ('3437', '53920pr0003', '109575pr0002', '98233', '3118', '40666', '84210pr0002', '110432pr0001', '35114')
ORDER BY part_id, color_id;

-- 총 레코드 수 확인
SELECT COUNT(*) as total_records FROM parts_master_features;

-- 최근 생성된 레코드 확인
SELECT 
  part_id, 
  color_id, 
  created_at,
  feature_json->>'shape' as shape
FROM parts_master_features 
ORDER BY created_at DESC 
LIMIT 20;
