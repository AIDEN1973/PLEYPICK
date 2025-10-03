-- 저장된 이미지 메타데이터 확인
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 전체 이미지 개수 확인
SELECT COUNT(*) as total_images FROM image_metadata;

-- 2. 최근 저장된 이미지들 확인
SELECT 
    part_num,
    color_id,
    file_name,
    supabase_url,
    created_at
FROM image_metadata 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. 부품별 이미지 개수 확인
SELECT 
    part_num,
    COUNT(*) as image_count
FROM image_metadata 
GROUP BY part_num 
ORDER BY image_count DESC 
LIMIT 10;

-- 4. 특정 부품의 이미지 확인 (예: 3001)
SELECT 
    part_num,
    color_id,
    file_name,
    supabase_url,
    created_at
FROM image_metadata 
WHERE part_num = '3001'
ORDER BY created_at DESC;
