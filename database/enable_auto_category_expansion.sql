-- ============================================================================
-- 카테고리 자동 확장 시스템 (선택 기능)
-- ============================================================================
-- 목적: 새로운 shape_tag 발견 시 자동으로 카테고리 등록
-- 작성일: 2025-10-13
-- 상태: 선택 사항 (필요시 실행)
-- ============================================================================

-- 1. 대기 중인 카테고리 테이블 생성
CREATE TABLE IF NOT EXISTS pending_categories (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(50),
  display_name_ko VARCHAR(50),
  suggested_category_type VARCHAR(20) DEFAULT 'shape',
  source VARCHAR(50),                    -- 'llm_analysis' | 'part_name_inference' | 'manual'
  first_seen_part_id VARCHAR(20),        -- 처음 발견된 부품 ID
  occurrence_count INTEGER DEFAULT 1,     -- 발견 횟수
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(100)
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_pending_categories_code ON pending_categories(code);
CREATE INDEX IF NOT EXISTS idx_pending_categories_status ON pending_categories(status);
CREATE INDEX IF NOT EXISTS idx_pending_categories_count ON pending_categories(occurrence_count DESC);

-- 3. 자동 등록 함수 (임계값 기반)
CREATE OR REPLACE FUNCTION auto_approve_frequent_categories()
RETURNS INTEGER AS $$
DECLARE
  approved_count INTEGER := 0;
  pending_record RECORD;
  next_id INTEGER;
BEGIN
  -- 발견 횟수 10회 이상인 카테고리 자동 승인
  FOR pending_record IN
    SELECT * FROM pending_categories
    WHERE status = 'pending'
      AND occurrence_count >= 10
      AND NOT EXISTS (
        SELECT 1 FROM part_categories WHERE code = pending_record.code
      )
  LOOP
    -- 다음 사용 가능한 ID 찾기 (30-98 범위)
    SELECT COALESCE(MAX(id), 29) + 1 INTO next_id
    FROM part_categories
    WHERE id < 99;
    
    -- ID가 99에 도달하면 중단
    IF next_id >= 99 THEN
      RAISE NOTICE '⚠️ 카테고리 ID 범위 초과 (최대 98)';
      EXIT;
    END IF;
    
    -- part_categories에 추가
    INSERT INTO part_categories (
      id, code, display_name, display_name_ko, 
      category_type, is_active, sort_order
    ) VALUES (
      next_id,
      pending_record.code,
      pending_record.display_name,
      pending_record.display_name_ko,
      pending_record.suggested_category_type,
      TRUE,
      next_id
    );
    
    -- pending_categories 상태 업데이트
    UPDATE pending_categories
    SET status = 'approved',
        reviewed_at = NOW(),
        reviewed_by = 'auto_system'
    WHERE id = pending_record.id;
    
    approved_count := approved_count + 1;
    RAISE NOTICE '✅ 자동 승인: % (ID: %, 발견 횟수: %)', 
      pending_record.code, next_id, pending_record.occurrence_count;
  END LOOP;
  
  RETURN approved_count;
END;
$$ LANGUAGE plpgsql;

-- 4. 카테고리 제안 함수 (코드에서 호출)
CREATE OR REPLACE FUNCTION suggest_new_category(
  p_code VARCHAR(30),
  p_display_name VARCHAR(50),
  p_display_name_ko VARCHAR(50),
  p_source VARCHAR(50),
  p_part_id VARCHAR(20)
)
RETURNS VOID AS $$
BEGIN
  -- 이미 존재하는 카테고리인지 확인
  IF EXISTS (SELECT 1 FROM part_categories WHERE code = p_code) THEN
    RETURN;
  END IF;
  
  -- pending_categories에 추가 또는 카운트 증가
  INSERT INTO pending_categories (
    code, display_name, display_name_ko, 
    source, first_seen_part_id, occurrence_count
  ) VALUES (
    p_code, p_display_name, p_display_name_ko,
    p_source, p_part_id, 1
  )
  ON CONFLICT (code) DO UPDATE SET
    occurrence_count = pending_categories.occurrence_count + 1;
    
  -- 임계값 도달 시 자동 승인
  IF (SELECT occurrence_count FROM pending_categories WHERE code = p_code) >= 10 THEN
    PERFORM auto_approve_frequent_categories();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. 통계 뷰
CREATE OR REPLACE VIEW v_pending_categories_stats AS
SELECT 
  pc.code,
  pc.display_name,
  pc.display_name_ko,
  pc.source,
  pc.occurrence_count,
  pc.status,
  pc.created_at,
  COUNT(pmf.id) as matching_parts_count
FROM pending_categories pc
LEFT JOIN parts_master_features pmf ON pmf.shape_tag = pc.code
WHERE pc.status = 'pending'
GROUP BY pc.id, pc.code, pc.display_name, pc.display_name_ko, 
         pc.source, pc.occurrence_count, pc.status, pc.created_at
ORDER BY pc.occurrence_count DESC;

-- 6. 관리자용 승인 함수
CREATE OR REPLACE FUNCTION approve_pending_category(
  p_code VARCHAR(30),
  p_reviewer VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
  next_id INTEGER;
  pending_record RECORD;
BEGIN
  -- pending 레코드 조회
  SELECT * INTO pending_record FROM pending_categories
  WHERE code = p_code AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE NOTICE '⚠️ 대기 중인 카테고리 없음: %', p_code;
    RETURN FALSE;
  END IF;
  
  -- 다음 ID 찾기
  SELECT COALESCE(MAX(id), 29) + 1 INTO next_id
  FROM part_categories
  WHERE id < 99;
  
  IF next_id >= 99 THEN
    RAISE EXCEPTION '카테고리 ID 범위 초과 (최대 98)';
  END IF;
  
  -- part_categories에 추가
  INSERT INTO part_categories (
    id, code, display_name, display_name_ko, 
    category_type, is_active, sort_order
  ) VALUES (
    next_id,
    pending_record.code,
    pending_record.display_name,
    pending_record.display_name_ko,
    pending_record.suggested_category_type,
    TRUE,
    next_id
  );
  
  -- pending 상태 업데이트
  UPDATE pending_categories
  SET status = 'approved',
      reviewed_at = NOW(),
      reviewed_by = p_reviewer
  WHERE code = p_code;
  
  RAISE NOTICE '✅ 승인 완료: % (ID: %)', p_code, next_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS 정책
ALTER TABLE pending_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_categories_read_policy" ON pending_categories;
CREATE POLICY "pending_categories_read_policy" ON pending_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pending_categories_write_policy" ON pending_categories;
CREATE POLICY "pending_categories_write_policy" ON pending_categories
  FOR ALL USING (auth.role() = 'authenticated');

-- 8. 사용 예시 (주석)
/*
-- 코드에서 새 카테고리 제안
SELECT suggest_new_category(
  'propeller_blade',           -- code
  'Propeller Blade',           -- display_name
  '프로펠러 날개',              -- display_name_ko
  'llm_analysis',              -- source
  '12345'                      -- part_id
);

-- 자동 승인 실행 (10회 이상 발견된 카테고리)
SELECT auto_approve_frequent_categories();

-- 관리자 수동 승인
SELECT approve_pending_category('propeller_blade', 'admin@example.com');

-- 대기 중인 카테고리 조회
SELECT * FROM v_pending_categories_stats;

-- 대기 중인 카테고리 거부
UPDATE pending_categories
SET status = 'rejected', reviewed_at = NOW(), reviewed_by = 'admin'
WHERE code = 'invalid_category';
*/

-- 9. 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ 카테고리 자동 확장 시스템 설치 완료!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 기능:';
  RAISE NOTICE '  1. 새 shape_tag 발견 시 pending_categories에 자동 추가';
  RAISE NOTICE '  2. 발견 횟수 10회 이상 시 자동 승인 (auto_approve_frequent_categories)';
  RAISE NOTICE '  3. 관리자 수동 승인 (approve_pending_category)';
  RAISE NOTICE '  4. 통계 뷰 (v_pending_categories_stats)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 주의: 코드 수정 필요 (useMasterPartsPreprocessing.js)';
  RAISE NOTICE '  → suggest_new_category() 호출 로직 추가';
END $$;

