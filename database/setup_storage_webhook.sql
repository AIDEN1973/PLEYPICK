-- Supabase Storage 자동 동기화 설정
-- Storage에 이미지 업로드 시 part_images 테이블에 자동으로 데이터 생성

-- 1. Storage 이벤트를 처리하는 함수 생성
CREATE OR REPLACE FUNCTION handle_storage_upload()
RETURNS TRIGGER AS $$
DECLARE
  bucket_name TEXT := 'lego_parts_images';
  supabase_url TEXT := 'https://npferbxuxocbfnfbpcnz.supabase.co';
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
      CONCAT(supabase_url, '/storage/v1/object/public/', bucket_name, '/', file_name),
      CONCAT(supabase_url, '/storage/v1/object/public/', bucket_name, '/', file_name),
      file_name,
      'completed',
      NOW()
    )
    ON CONFLICT (part_id, color_id) 
    DO UPDATE SET 
      uploaded_url = EXCLUDED.uploaded_url,
      upload_status = 'completed',
      updated_at = NOW();
    
    RAISE NOTICE 'Auto-synced image: % -> part_id: %, color_id: %', file_name, part_id, color_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Storage 이벤트 트리거 생성
-- Storage에 파일이 업로드될 때마다 자동으로 실행
CREATE TRIGGER storage_upload_trigger
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'lego_parts_images')
  EXECUTE FUNCTION handle_storage_upload();

-- 3. 기존 이미지들 수동 동기화 (한 번만 실행)
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
  CONCAT('https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego_parts_images/', sp.part_id, '_', sp.color_id, '.jpg') as original_url,
  CONCAT('https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego_parts_images/', sp.part_id, '_', sp.color_id, '.jpg') as uploaded_url,
  CONCAT(sp.part_id, '_', sp.color_id, '.jpg') as filename,
  'completed' as upload_status,
  NOW() as created_at
FROM set_parts sp
WHERE sp.set_id = '9bb0e47a-66ce-4bcf-94fb-32b61ab6d726'  -- 76917 세트
  AND NOT EXISTS (
    SELECT 1 FROM part_images pi 
    WHERE pi.part_id = sp.part_id 
      AND pi.color_id = sp.color_id
  )
ON CONFLICT (part_id, color_id) DO NOTHING;

-- 4. 동기화 결과 확인
SELECT 
  COUNT(*) as total_images,
  COUNT(*) FILTER (WHERE upload_status = 'completed') as completed_images
FROM part_images pi
JOIN set_parts sp ON pi.part_id = sp.part_id AND pi.color_id = sp.color_id
WHERE sp.set_id = '9bb0e47a-66ce-4bcf-94fb-32b61ab6d726';

-- 5. 샘플 데이터 확인
SELECT 
  pi.part_id,
  pi.color_id,
  pi.uploaded_url,
  lp.name as part_name,
  lc.name as color_name
FROM part_images pi
JOIN lego_parts lp ON pi.part_id = lp.part_num
JOIN lego_colors lc ON pi.color_id = lc.color_id
JOIN set_parts sp ON pi.part_id = sp.part_id AND pi.color_id = sp.color_id
WHERE sp.set_id = '9bb0e47a-66ce-4bcf-94fb-32b61ab6d726'
LIMIT 5;
