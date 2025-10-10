-- 기존 세트들의 WebP 메타데이터 생성
-- lego_parts_images/lego_sets_images/ 경로에 저장된 WebP 이미지 정보

INSERT INTO image_metadata (original_url, supabase_url, file_path, file_name, set_num)
SELECT 
    s.set_img_url as original_url,
    CONCAT(
        'https://your-project.supabase.co/storage/v1/object/public/lego_parts_images/lego_sets_images/',
        s.set_num,
        '_set.webp'
    ) as supabase_url,
    CONCAT('lego_sets_images/', s.set_num, '_set.webp') as file_path,
    CONCAT(s.set_num, '_set.webp') as file_name,
    s.set_num
FROM lego_sets s
WHERE s.set_img_url IS NOT NULL
ON CONFLICT (set_num) DO UPDATE SET
    supabase_url = EXCLUDED.supabase_url,
    file_path = EXCLUDED.file_path,
    file_name = EXCLUDED.file_name;

-- 결과 확인
SELECT 
    set_num,
    original_url,
    supabase_url,
    file_path,
    file_name
FROM image_metadata 
WHERE set_num IS NOT NULL
ORDER BY created_at DESC;
