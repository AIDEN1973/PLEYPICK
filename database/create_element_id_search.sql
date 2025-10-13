-- Element ID로 레고 세트 검색 기능
-- Element ID를 입력하면 해당 부품이 포함된 모든 세트를 반환

-- 1. Element ID로 세트 검색 함수
CREATE OR REPLACE FUNCTION search_sets_by_element_id(p_element_id VARCHAR)
RETURNS TABLE(
  set_id UUID,
  set_num VARCHAR,
  set_name VARCHAR,
  set_year INTEGER,
  num_parts INTEGER,
  theme_id INTEGER,
  set_img_url TEXT,
  webp_image_url TEXT,
  part_id VARCHAR,
  part_name VARCHAR,
  color_id INTEGER,
  color_name VARCHAR,
  quantity INTEGER,
  is_spare BOOLEAN,
  element_id VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.id as set_id,
    ls.set_num,
    ls.name as set_name,
    ls.year as set_year,
    ls.num_parts,
    ls.theme_id,
    ls.set_img_url,
    ls.webp_image_url,
    sp.part_id,
    lp.name as part_name,
    sp.color_id,
    lc.name as color_name,
    sp.quantity,
    sp.is_spare,
    sp.element_id,
    sp.created_at
  FROM set_parts sp
  INNER JOIN lego_sets ls ON sp.set_id = ls.id
  LEFT JOIN lego_parts lp ON sp.part_id = lp.part_num
  LEFT JOIN lego_colors lc ON sp.color_id = lc.color_id
  WHERE sp.element_id = p_element_id
  ORDER BY ls.year DESC, ls.set_num;
END;
$$ LANGUAGE plpgsql;

-- 2. 부품 번호 + 색상 ID로 Element ID 조회 함수
CREATE OR REPLACE FUNCTION get_element_ids_by_part_color(
  p_part_id VARCHAR,
  p_color_id INTEGER
)
RETURNS TABLE(
  element_id VARCHAR,
  set_num VARCHAR,
  set_name VARCHAR,
  quantity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.element_id,
    ls.set_num,
    ls.name as set_name,
    sp.quantity
  FROM set_parts sp
  INNER JOIN lego_sets ls ON sp.set_id = ls.id
  WHERE sp.part_id = p_part_id 
    AND sp.color_id = p_color_id
    AND sp.element_id IS NOT NULL
  ORDER BY ls.year DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. Element ID 검색 뷰 (빠른 조회용)
CREATE OR REPLACE VIEW v_element_id_search AS
SELECT 
  sp.element_id,
  sp.part_id,
  lp.name as part_name,
  sp.color_id,
  lc.name as color_name,
  sp.set_id,
  ls.set_num,
  ls.name as set_name,
  ls.year as set_year,
  sp.quantity,
  sp.is_spare
FROM set_parts sp
INNER JOIN lego_sets ls ON sp.set_id = ls.id
LEFT JOIN lego_parts lp ON sp.part_id = lp.part_num
LEFT JOIN lego_colors lc ON sp.color_id = lc.color_id
WHERE sp.element_id IS NOT NULL
ORDER BY ls.year DESC, ls.set_num;

-- 4. Element ID 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_set_parts_element_id ON set_parts(element_id) WHERE element_id IS NOT NULL;

-- 5. 복합 검색: Element ID 또는 세트 번호/이름으로 검색
CREATE OR REPLACE FUNCTION universal_set_search(p_query VARCHAR)
RETURNS TABLE(
  search_type VARCHAR,
  set_id UUID,
  set_num VARCHAR,
  set_name VARCHAR,
  set_year INTEGER,
  num_parts INTEGER,
  set_img_url TEXT,
  webp_image_url TEXT,
  matched_element_id VARCHAR,
  matched_part_id VARCHAR,
  matched_part_name VARCHAR
) AS $$
BEGIN
  -- Element ID로 먼저 검색 시도
  IF EXISTS (SELECT 1 FROM set_parts WHERE element_id = p_query) THEN
    RETURN QUERY
    SELECT 
      'element_id'::VARCHAR as search_type,
      ls.id as set_id,
      ls.set_num,
      ls.name as set_name,
      ls.year as set_year,
      ls.num_parts,
      ls.set_img_url,
      ls.webp_image_url,
      sp.element_id as matched_element_id,
      sp.part_id as matched_part_id,
      lp.name as matched_part_name
    FROM set_parts sp
    INNER JOIN lego_sets ls ON sp.set_id = ls.id
    LEFT JOIN lego_parts lp ON sp.part_id = lp.part_num
    WHERE sp.element_id = p_query
    ORDER BY ls.year DESC;
  ELSE
    -- Element ID가 없으면 세트 번호/이름으로 검색
    RETURN QUERY
    SELECT 
      'set_search'::VARCHAR as search_type,
      ls.id as set_id,
      ls.set_num,
      ls.name as set_name,
      ls.year as set_year,
      ls.num_parts,
      ls.set_img_url,
      ls.webp_image_url,
      NULL::VARCHAR as matched_element_id,
      NULL::VARCHAR as matched_part_id,
      NULL::VARCHAR as matched_part_name
    FROM lego_sets ls
    WHERE ls.set_num ILIKE '%' || p_query || '%'
       OR ls.name ILIKE '%' || p_query || '%'
    ORDER BY ls.year DESC
    LIMIT 100;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. 테스트 쿼리 예제
-- Element ID로 검색:
-- SELECT * FROM search_sets_by_element_id('4500574');

-- 부품 번호 + 색상으로 Element ID 찾기:
-- SELECT * FROM get_element_ids_by_part_color('3001', 1);

-- 복합 검색:
-- SELECT * FROM universal_set_search('4500574'); -- Element ID
-- SELECT * FROM universal_set_search('60315');   -- 세트 번호

-- 뷰 조회:
-- SELECT * FROM v_element_id_search WHERE element_id = '4500574';

-- 7. 통계 정보
SELECT 
  'Element ID 검색 시스템 구축 완료' as message,
  COUNT(DISTINCT element_id) as total_element_ids,
  COUNT(*) as total_records,
  COUNT(DISTINCT set_id) as affected_sets
FROM set_parts
WHERE element_id IS NOT NULL;

