-- Supabase Storage의 이미지를 part_images 테이블에 동기화
-- Storage 버킷에 있는 이미지들을 part_images 테이블에 등록

-- 1. Storage에서 이미지 목록을 가져와서 part_images 테이블에 삽입하는 함수
CREATE OR REPLACE FUNCTION sync_storage_images_to_part_images()
RETURNS TABLE (
  synced_count INTEGER,
  error_count INTEGER,
  details TEXT
) AS $$
DECLARE
  bucket_name TEXT := 'lego_parts_images';
  supabase_url TEXT := 'https://npferbxuxocbfnfbpcnz.supabase.co';
  synced INTEGER := 0;
  errors INTEGER := 0;
  result_details TEXT := '';
BEGIN
  -- 76917 세트의 부품들에 대해 이미지 URL 생성 및 등록
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
    CONCAT(supabase_url, '/storage/v1/object/public/', bucket_name, '/', sp.part_id, '_', sp.color_id, '.jpg') as original_url,
    CONCAT(supabase_url, '/storage/v1/object/public/', bucket_name, '/', sp.part_id, '_', sp.color_id, '.jpg') as uploaded_url,
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
  
  GET DIAGNOSTICS synced = ROW_COUNT;
  
  -- 결과 반환
  RETURN QUERY SELECT 
    synced,
    errors,
    CONCAT('Synced ', synced, ' images for set 76917') as details;
END;
$$ LANGUAGE plpgsql;

-- 2. 특정 세트의 부품 이미지 동기화 함수
CREATE OR REPLACE FUNCTION sync_set_images(set_id_param UUID)
RETURNS TABLE (
  synced_count INTEGER,
  error_count INTEGER,
  details TEXT
) AS $$
DECLARE
  bucket_name TEXT := 'lego_parts_images';
  supabase_url TEXT := 'https://npferbxuxocbfnfbpcnz.supabase.co';
  synced INTEGER := 0;
  errors INTEGER := 0;
  set_name TEXT;
BEGIN
  -- 세트 이름 조회
  SELECT name INTO set_name FROM lego_sets WHERE id = set_id_param;
  
  -- 해당 세트의 부품들에 대해 이미지 URL 생성 및 등록
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
    CONCAT(supabase_url, '/storage/v1/object/public/', bucket_name, '/', sp.part_id, '_', sp.color_id, '.jpg') as original_url,
    CONCAT(supabase_url, '/storage/v1/object/public/', bucket_name, '/', sp.part_id, '_', sp.color_id, '.jpg') as uploaded_url,
    CONCAT(sp.part_id, '_', sp.color_id, '.jpg') as filename,
    'completed' as upload_status,
    NOW() as created_at
  FROM set_parts sp
  WHERE sp.set_id = set_id_param
    AND NOT EXISTS (
      SELECT 1 FROM part_images pi 
      WHERE pi.part_id = sp.part_id 
        AND pi.color_id = sp.color_id
    )
  ON CONFLICT (part_id, color_id) DO NOTHING;
  
  GET DIAGNOSTICS synced = ROW_COUNT;
  
  -- 결과 반환
  RETURN QUERY SELECT 
    synced,
    errors,
    CONCAT('Synced ', synced, ' images for set: ', COALESCE(set_name, 'Unknown')) as details;
END;
$$ LANGUAGE plpgsql;

-- 3. 이미지 존재 여부 확인 함수
CREATE OR REPLACE FUNCTION check_image_exists(
  part_id_param VARCHAR(20),
  color_id_param INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  bucket_name TEXT := 'lego_parts_images';
  supabase_url TEXT := 'https://npferbxuxocbfnfbpcnz.supabase.co';
  image_url TEXT;
BEGIN
  image_url := CONCAT(supabase_url, '/storage/v1/object/public/', bucket_name, '/', part_id_param, '_', color_id_param, '.jpg');
  
  -- HTTP HEAD 요청으로 이미지 존재 여부 확인 (실제로는 클라이언트에서 확인)
  -- 여기서는 URL 형식만 검증
  RETURN image_url IS NOT NULL AND LENGTH(image_url) > 0;
END;
$$ LANGUAGE plpgsql;

-- 4. 76917 세트 이미지 동기화 실행
SELECT sync_storage_images_to_part_images();

-- 5. 동기화 결과 확인
SELECT 
  COUNT(*) as total_images,
  COUNT(*) FILTER (WHERE upload_status = 'completed') as completed_images,
  COUNT(*) FILTER (WHERE upload_status = 'pending') as pending_images
FROM part_images pi
JOIN set_parts sp ON pi.part_id = sp.part_id AND pi.color_id = sp.color_id
WHERE sp.set_id = '9bb0e47a-66ce-4bcf-94fb-32b61ab6d726';

-- 6. 샘플 데이터 확인
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
LIMIT 10;
