-- part_images 테이블 자동 동기화 설정
-- Storage에 이미지 업로드 시 part_images 테이블에 자동으로 데이터 생성

-- 1. part_images 테이블에 자동 동기화 함수 생성
CREATE OR REPLACE FUNCTION sync_to_part_images()
RETURNS TRIGGER AS $$
DECLARE
  file_name TEXT;
  part_id TEXT;
  color_id INTEGER;
  image_url TEXT;
BEGIN
  -- Storage 이벤트에서 파일명 추출
  file_name := NEW.name;
  
  -- 파일명에서 part_id와 color_id 추출 (형식: part_id_color_id.jpg)
  IF file_name ~ '^[^_]+_[0-9]+\.jpg$' THEN
    part_id := SPLIT_PART(file_name, '_', 1);
    color_id := CAST(SPLIT_PART(SPLIT_PART(file_name, '_', 2), '.', 1) AS INTEGER);
    
    -- 이미지 URL 생성
    image_url := CONCAT('https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego_parts_images/images/', file_name);
    
    -- part_images 테이블에 자동 등록
    INSERT INTO part_images (
      part_id,
      color_id,
      original_url,
      uploaded_url,
      filename,
      upload_status,
      created_at
    ) VALUES (
      part_id,
      color_id,
      image_url,
      image_url,
      file_name,
      'completed',
      NOW()
    )
    ON CONFLICT (part_id, color_id) 
    DO UPDATE SET 
      uploaded_url = EXCLUDED.uploaded_url,
      upload_status = 'completed',
      updated_at = NOW();
    
    RAISE NOTICE 'Auto-synced to part_images: % -> part_id: %, color_id: %', file_name, part_id, color_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Storage 이벤트 트리거 생성
DROP TRIGGER IF EXISTS auto_sync_to_part_images ON storage.objects;
CREATE TRIGGER auto_sync_to_part_images
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'lego_parts_images' AND NEW.name LIKE 'images/%')
  EXECUTE FUNCTION sync_to_part_images();

-- 3. part_images 중복 정리 및 유니크 인덱스 생성
--    ON CONFLICT (part_id, color_id)가 동작하도록 사전 정리
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY part_id, color_id
           ORDER BY updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id DESC
         ) AS rn
  FROM part_images
)
DELETE FROM part_images
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 유니크 인덱스(제약 대체) 생성: 중복 없을 때만 생성됨
CREATE UNIQUE INDEX IF NOT EXISTS ux_part_images_part_color ON part_images(part_id, color_id);

-- 4. 기존 이미지들 수동 동기화 (한 번만 실행)
INSERT INTO part_images (
  part_id,
  color_id,
  original_url,
  uploaded_url,
  filename,
  upload_status,
  created_at
)
SELECT 
  sp.part_id,
  sp.color_id,
  CONCAT('https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego_parts_images/images/', sp.part_id, '_', sp.color_id, '.jpg') as original_url,
  CONCAT('https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego_parts_images/images/', sp.part_id, '_', sp.color_id, '.jpg') as uploaded_url,
  CONCAT(sp.part_id, '_', sp.color_id, '.jpg') as filename,
  'completed' as upload_status,
  NOW() as created_at
FROM set_parts sp
WHERE sp.set_id = 'c6c9e88d-44c8-4584-8bbc-f9042e8fc163'  -- 현재 세트 ID
  AND NOT EXISTS (
    SELECT 1 FROM part_images pi 
    WHERE pi.part_id = sp.part_id 
      AND pi.color_id = sp.color_id
  )
ON CONFLICT (part_id, color_id) DO NOTHING;

-- 3-1. 공개 읽기 정책 및 RLS 활성화 (HEAD 400 방지)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='public_read_lego_parts_images'
  ) THEN
    CREATE POLICY public_read_lego_parts_images ON storage.objects
    FOR SELECT USING (bucket_id = 'lego_parts_images');
  END IF;
END $$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. 동기화 결과 확인
SELECT 
  COUNT(*) as total_images,
  COUNT(*) FILTER (WHERE upload_status = 'completed') as completed_images
FROM part_images pi
JOIN set_parts sp ON pi.part_id = sp.part_id AND pi.color_id = sp.color_id
WHERE sp.set_id = 'c6c9e88d-44c8-4584-8bbc-f9042e8fc163';
