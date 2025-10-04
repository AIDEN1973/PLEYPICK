-- 중복 디렉토리 정리를 위한 스크립트
-- 이 스크립트는 Supabase Storage에서 실행해야 합니다

-- 1. lego_parts_images 버킷의 모든 파일 목록 확인
SELECT name, bucket_id, path_tokens, metadata 
FROM storage.objects 
WHERE bucket_id = 'lego_parts_images'
ORDER BY name;

-- 2. lego/ 디렉토리의 모든 파일을 images/로 이동 (수동으로 해야 함)
-- 3. lego_parts_images/ 디렉토리의 모든 파일을 images/로 이동 (수동으로 해야 함)
-- 4. 빈 디렉토리 삭제 (수동으로 해야 함)

-- 주의: 이 작업은 Supabase Storage UI에서 수동으로 수행해야 합니다
-- 또는 Supabase Storage API를 사용하여 파일을 이동해야 합니다
