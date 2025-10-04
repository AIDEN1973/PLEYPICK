-- Storage 정책 확인 및 수정

-- 1. 현재 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- 2. 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Public read access for lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update lego_parts_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete lego_parts_images" ON storage.objects;

-- 3. 새로운 정책 생성
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

-- 4. RLS 활성화 확인
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
