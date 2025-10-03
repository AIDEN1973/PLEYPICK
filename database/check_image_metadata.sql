-- image_metadata 테이블 확인
SELECT COUNT(*) as total_images FROM image_metadata;

-- 샘플 데이터 확인
SELECT 
    part_num,
    color_id,
    supabase_url,
    file_name,
    created_at
FROM image_metadata 
ORDER BY created_at DESC 
LIMIT 10;

-- 부품별 이미지 개수 확인
SELECT 
    part_num,
    COUNT(*) as image_count
FROM image_metadata 
GROUP BY part_num 
ORDER BY image_count DESC 
LIMIT 10;
