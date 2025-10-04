-- lego_parts_images 버킷 완전 삭제

-- 1. 버킷 내 모든 파일 삭제
DELETE FROM storage.objects 
WHERE bucket_id = 'lego_parts_images';

-- 2. 버킷 삭제
DELETE FROM storage.buckets 
WHERE id = 'lego_parts_images';

-- 3. 삭제 확인
SELECT id, name, public FROM storage.buckets WHERE id = 'lego_parts_images';
SELECT COUNT(*) as remaining_files FROM storage.objects WHERE bucket_id = 'lego_parts_images';
