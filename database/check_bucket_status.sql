-- 버킷 상태 확인
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 버킷 존재 확인
SELECT 
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'lego_parts_images';

-- 2. 버킷 내 파일 개수 확인
SELECT COUNT(*) as file_count
FROM storage.objects 
WHERE bucket_id = 'lego_parts_images';

-- 3. 최근 업로드된 파일들 확인
SELECT 
    name,
    bucket_id,
    created_at,
    updated_at
FROM storage.objects 
WHERE bucket_id = 'lego_parts_images'
ORDER BY created_at DESC 
LIMIT 10;
