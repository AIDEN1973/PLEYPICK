-- 간단한 쿼리로 테스트
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 기본 조회 테스트
SELECT COUNT(*) FROM image_metadata;

-- 2. 특정 부품 조회 테스트
SELECT 
    part_num,
    color_id,
    supabase_url
FROM image_metadata 
WHERE part_num = '3001' 
LIMIT 5;

-- 3. 색상별 조회 테스트
SELECT 
    part_num,
    color_id,
    supabase_url
FROM image_metadata 
WHERE color_id = 14 
LIMIT 5;

-- 4. 전체 데이터 샘플 조회
SELECT 
    part_num,
    color_id,
    supabase_url,
    created_at
FROM image_metadata 
ORDER BY created_at DESC 
LIMIT 10;
