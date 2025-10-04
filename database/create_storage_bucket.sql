-- Supabase Storage 버킷 생성
-- 이 스크립트는 Supabase Dashboard의 Storage 섹션에서 실행하거나
-- Supabase CLI를 통해 실행해야 합니다.

-- 1. lego_parts_images 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lego_parts_images',
  'lego_parts_images', 
  true,  -- 공개 버킷으로 설정
  52428800,  -- 50MB 파일 크기 제한
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']  -- 허용된 이미지 타입
);

-- 2. 버킷 정책 설정 (공개 읽기 허용)
CREATE POLICY "Public read access for lego_parts_images" ON storage.objects
FOR SELECT USING (bucket_id = 'lego_parts_images');

-- 3. 인증된 사용자 업로드 정책
CREATE POLICY "Authenticated users can upload to lego_parts_images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 4. 인증된 사용자 업데이트 정책 (덮어쓰기 허용)
CREATE POLICY "Authenticated users can update lego_parts_images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 5. 인증된 사용자 삭제 정책
CREATE POLICY "Authenticated users can delete lego_parts_images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 6. 버킷 존재 확인
SELECT * FROM storage.buckets WHERE id = 'lego_parts_images';
