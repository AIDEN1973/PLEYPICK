-- set_parts 테이블에 image_url 컬럼 추가
-- 이미지 유사도 계산을 위한 Supabase Storage 이미지 URL 저장

-- 1. set_parts 테이블에 image_url 컬럼 추가
ALTER TABLE set_parts 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN set_parts.image_url IS 'Supabase Storage에 저장된 부품 이미지 URL';

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_set_parts_image_url ON set_parts(image_url) WHERE image_url IS NOT NULL;

-- 4. 기존 데이터에 대한 기본 이미지 URL 생성 함수
CREATE OR REPLACE FUNCTION generate_default_image_url(
  part_id_param VARCHAR(20),
  color_id_param INTEGER
)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
  file_name TEXT;
BEGIN
  -- Supabase Storage 기본 URL (환경변수에서 가져와야 함)
  base_url := 'https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego_parts_images';
  
  -- 파일명 생성: part_id_color_id.jpg
  file_name := part_id_param || '_' || color_id_param || '.jpg';
  
  -- 전체 URL 반환
  RETURN base_url || '/' || file_name;
END;
$$ LANGUAGE plpgsql;

-- 5. 기존 데이터에 기본 이미지 URL 설정 (선택사항)
-- UPDATE set_parts 
-- SET image_url = generate_default_image_url(part_id, color_id)
-- WHERE image_url IS NULL;

-- 6. 이미지 URL 유효성 검사 함수
CREATE OR REPLACE FUNCTION validate_image_url(url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- 기본적인 URL 형식 검사
  IF url IS NULL OR url = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Supabase Storage URL 형식 검사
  IF url LIKE 'https://%.supabase.co/storage/v1/object/public/lego_parts_images/%' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. 이미지 URL이 있는 부품 조회 함수
CREATE OR REPLACE FUNCTION get_parts_with_images(set_id_param UUID)
RETURNS TABLE (
  part_id VARCHAR(20),
  color_id INTEGER,
  quantity INTEGER,
  image_url TEXT,
  part_name TEXT,
  color_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.part_id,
    sp.color_id,
    sp.quantity,
    sp.image_url,
    lp.name as part_name,
    lc.name as color_name
  FROM set_parts sp
  LEFT JOIN lego_parts lp ON sp.part_id = lp.part_num
  LEFT JOIN lego_colors lc ON sp.color_id = lc.color_id
  WHERE sp.set_id = set_id_param
    AND sp.image_url IS NOT NULL
    AND validate_image_url(sp.image_url) = TRUE
  ORDER BY sp.quantity DESC, lp.name;
END;
$$ LANGUAGE plpgsql;

-- 8. 통계 정보 조회 함수
CREATE OR REPLACE FUNCTION get_image_coverage_stats()
RETURNS TABLE (
  total_parts BIGINT,
  parts_with_images BIGINT,
  coverage_percentage DECIMAL(5,2),
  sets_with_images BIGINT,
  total_sets BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_parts,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL AND validate_image_url(image_url)) as parts_with_images,
    ROUND(
      (COUNT(*) FILTER (WHERE image_url IS NOT NULL AND validate_image_url(image_url))::DECIMAL / COUNT(*)) * 100, 
      2
    ) as coverage_percentage,
    COUNT(DISTINCT set_id) FILTER (WHERE image_url IS NOT NULL AND validate_image_url(image_url)) as sets_with_images,
    COUNT(DISTINCT set_id) as total_sets
  FROM set_parts;
END;
$$ LANGUAGE plpgsql;

-- 9. 샘플 데이터 삽입 (테스트용)
-- INSERT INTO set_parts (set_id, part_id, color_id, quantity, image_url)
-- VALUES 
--   ('9bb0e47a-66ce-4bcf-94fb-32b61ab6d726', '3024', 0, 10, 'https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego_parts_images/3024_0.jpg'),
--   ('9bb0e47a-66ce-4bcf-94fb-32b61ab6d726', '3023', 0, 5, 'https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego_parts_images/3023_0.jpg');

-- 10. 통계 확인
SELECT get_image_coverage_stats();
