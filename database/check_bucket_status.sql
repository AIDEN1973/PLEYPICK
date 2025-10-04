-- Supabase Storage 버킷 상태 확인

-- 1. 버킷 존재 확인
SELECT * FROM storage.buckets WHERE id = 'lego_parts_images';

-- 2. 버킷 내 파일 목록 확인
SELECT * FROM storage.objects WHERE bucket_id = 'lego_parts_images' LIMIT 10;

-- 3. 정책 상태 확인
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
AND policyname LIKE '%lego_parts_images%';
