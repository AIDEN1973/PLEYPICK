-- lego_parts_images 버킷 완전 제거

-- 1. 버킷 내 모든 파일 삭제
DELETE FROM storage.objects WHERE bucket_id = 'lego_parts_images';

-- 2. 버킷 삭제
DELETE FROM storage.buckets WHERE id = 'lego_parts_images';

-- 3. 삭제 확인
SELECT COUNT(*) as remaining_objects FROM storage.objects WHERE bucket_id = 'lego_parts_images';
SELECT COUNT(*) as remaining_buckets FROM storage.buckets WHERE id = 'lego_parts_images';
