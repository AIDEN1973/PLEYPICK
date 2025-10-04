-- 버킷 상태 확인

-- 1. 버킷 존재 확인
SELECT id, name, public, created_at FROM storage.buckets WHERE id = 'lego_parts_images';

-- 2. 버킷 내 파일 확인
SELECT name, created_at FROM storage.objects WHERE bucket_id = 'lego_parts_images' ORDER BY created_at DESC LIMIT 10;

-- 3. 현재 사용자 확인
SELECT auth.uid() as user_id, auth.role() as user_role;

-- 4. Storage 정책 확인
SELECT policyname, cmd, roles FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' 
AND policyname LIKE '%lego_parts_images%';
