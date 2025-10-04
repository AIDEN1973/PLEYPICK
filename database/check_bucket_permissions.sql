-- 버킷 권한 및 정책 확인

-- 1. 버킷 정보 확인
SELECT 
  id, 
  name, 
  public, 
  file_size_limit, 
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id = 'lego_parts_images';

-- 2. 현재 사용자 확인
SELECT auth.uid() as current_user_id, auth.role() as current_role;

-- 3. Storage 객체 접근 테스트
SELECT COUNT(*) as object_count 
FROM storage.objects 
WHERE bucket_id = 'lego_parts_images';

-- 4. RLS 상태 확인
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 5. 정책 목록 확인
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';
