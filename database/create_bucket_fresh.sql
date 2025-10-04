-- 새로운 lego_parts_images 버킷 생성

-- 1. 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lego_parts_images',
  'lego_parts_images', 
  true,  -- 공개 버킷
  52428800,  -- 50MB 파일 크기 제한
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']  -- 허용된 이미지 타입
);

-- 2. 버킷 생성 확인
SELECT * FROM storage.buckets WHERE id = 'lego_parts_images';

-- 3. 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Public read access for lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete lego_parts_images" ON storage.objects;

-- 4. 기본 정책 생성
-- 공개 읽기 정책
CREATE POLICY "Public read access for lego_parts_images" ON storage.objects
FOR SELECT USING (bucket_id = 'lego_parts_images');

-- 인증된 사용자 업로드 정책
CREATE POLICY "Authenticated users can upload to lego_parts_images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 인증된 사용자 업데이트 정책
CREATE POLICY "Authenticated users can update lego_parts_images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 인증된 사용자 삭제 정책
CREATE POLICY "Authenticated users can delete lego_parts_images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 5. 정책 확인
SELECT policyname, cmd, roles FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' 
AND policyname LIKE '%lego_parts_images%';
