-- Supabase Storage의 모든 이미지 삭제
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. lego_parts_images 버킷의 모든 파일 삭제
DELETE FROM storage.objects 
WHERE bucket_id = 'lego_parts_images';

-- 2. image_metadata 테이블의 모든 데이터 삭제
DELETE FROM image_metadata;

-- 3. 삭제 결과 확인
SELECT COUNT(*) as remaining_objects FROM storage.objects WHERE bucket_id = 'lego_parts_images';
SELECT COUNT(*) as remaining_metadata FROM image_metadata;

-- 4. 버킷 상태 확인
SELECT 
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'lego_parts_images';

-- 5. 최근 파일들 확인 (삭제 후 빈 결과여야 함)
SELECT 
    name,
    bucket_id,
    created_at
FROM storage.objects 
WHERE bucket_id = 'lego_parts_images'
ORDER BY created_at DESC 
LIMIT 5;
