-- 잘못된 이미지 메타데이터 삭제
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. Rebrickable CDN URL로 저장된 잘못된 데이터 삭제
DELETE FROM image_metadata 
WHERE supabase_url LIKE '%cdn.rebrickable.com%';

-- 2. 삭제된 데이터 개수 확인
SELECT COUNT(*) as remaining_images FROM image_metadata;

-- 3. 남은 데이터 확인
SELECT 
    part_num,
    color_id,
    file_name,
    supabase_url,
    created_at
FROM image_metadata 
ORDER BY created_at DESC 
LIMIT 5;
