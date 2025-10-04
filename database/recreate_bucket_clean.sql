-- 기존 정책 삭제 후 새로 생성

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Public read access for lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Public insert access for lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Public update access for lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access for lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to lego_parts_images" ON storage.objects;

-- 2. 기존 버킷 삭제
DELETE FROM storage.objects WHERE bucket_id = 'lego_parts_images';
DELETE FROM storage.buckets WHERE id = 'lego_parts_images';

-- 3. 새 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lego_parts_images',
  'lego_parts_images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- 4. 새 정책 생성
CREATE POLICY "Public read access for lego_parts_images" ON storage.objects
FOR SELECT USING (bucket_id = 'lego_parts_images');

CREATE POLICY "Public insert access for lego_parts_images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'lego_parts_images');

CREATE POLICY "Public update access for lego_parts_images" ON storage.objects
FOR UPDATE USING (bucket_id = 'lego_parts_images');

CREATE POLICY "Public delete access for lego_parts_images" ON storage.objects
FOR DELETE USING (bucket_id = 'lego_parts_images');

-- 5. 생성 확인
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'lego_parts_images';

SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' 
AND policyname LIKE '%lego_parts_images%';
