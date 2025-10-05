-- Supabase Storage 버킷 생성 및 권한 설정
-- 이 스크립트는 Supabase 대시보드에서 실행하거나 SQL 에디터에서 실행하세요

-- 1. Storage 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lego_parts_images',
  'lego_parts_images', 
  true,
  52428800, -- 50MB 제한
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS 정책 설정 - 모든 사용자가 읽기 가능
CREATE POLICY "Public read access for lego parts images" ON storage.objects
FOR SELECT USING (bucket_id = 'lego_parts_images');

-- 3. RLS 정책 설정 - 인증된 사용자가 업로드 가능
CREATE POLICY "Authenticated users can upload lego parts images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 4. RLS 정책 설정 - 인증된 사용자가 업데이트 가능
CREATE POLICY "Authenticated users can update lego parts images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 5. RLS 정책 설정 - 인증된 사용자가 삭제 가능
CREATE POLICY "Authenticated users can delete lego parts images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 6. 버킷 존재 여부 확인
SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  created_at
FROM storage.buckets 
WHERE id = 'lego_parts_images';