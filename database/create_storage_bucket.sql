-- Supabase Storage 버킷 생성 및 설정

-- 1. Storage 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lego_parts_images',
  'lego_parts_images', 
  true,
  52428800, -- 50MB 제한
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 합성 데이터 전용 공개 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lego-synthetic',
  'lego-synthetic',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- 실촬영 전용 비공개 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lego-captures',
  'lego-captures',
  false,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage 정책 설정 (공개 읽기 허용)
CREATE POLICY "Public Access (legacy)" ON storage.objects
FOR SELECT USING (bucket_id = 'lego_parts_images');

CREATE POLICY "Authenticated Upload (legacy)" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Update (legacy)" ON storage.objects
FOR UPDATE WITH CHECK (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Delete (legacy)" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- lego-synthetic: 공개 읽기 + 인증 업로드/수정/삭제
CREATE POLICY "Public Access (synthetic)" ON storage.objects
FOR SELECT USING (bucket_id = 'lego-synthetic');

CREATE POLICY "Authenticated Upload (synthetic)" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lego-synthetic'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Update (synthetic)" ON storage.objects
FOR UPDATE WITH CHECK (
  bucket_id = 'lego-synthetic'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Delete (synthetic)" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lego-synthetic'
  AND auth.role() = 'authenticated'
);

-- lego-captures: 비공개, 인증 사용자 읽기/쓰기만 허용(공개 미허용)
CREATE POLICY "Authenticated Read (captures)" ON storage.objects
FOR SELECT USING (
  bucket_id = 'lego-captures' AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Upload (captures)" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lego-captures' AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Update (captures)" ON storage.objects
FOR UPDATE WITH CHECK (
  bucket_id = 'lego-captures' AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Delete (captures)" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lego-captures' AND auth.role() = 'authenticated'
);

-- 3. 버킷 생성 확인
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE id IN ('lego_parts_images','lego-synthetic','lego-captures');