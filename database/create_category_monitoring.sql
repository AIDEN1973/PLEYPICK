-- ============================================================================
-- 카테고리 모니터링 시스템 (로그 기반 확장용)
-- ============================================================================
-- 목적: unknown 카테고리 로그 수집 및 분석 (분기별 검토용)
-- 특징: 폐쇄환경 최적화, 자동 확장 없음, 수동 검토 지원
-- 작성일: 2025-10-13
-- ============================================================================

-- 1. unknown 카테고리 로그 테이블
CREATE TABLE IF NOT EXISTS unknown_category_logs (
  id SERIAL PRIMARY KEY,
  shape_tag VARCHAR(50) NOT NULL,
  part_id VARCHAR(20),
  part_name VARCHAR(255),
  part_category INTEGER,            -- 현재 할당된 카테고리 (99=unknown)
  detected_count INTEGER DEFAULT 1,  -- 동일 part_id의 검출 횟수
  first_detected_at TIMESTAMP DEFAULT NOW(),
  last_detected_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,                    -- 추가 정보 (이미지 경로, 신뢰도 등)
  
  -- 중복 방지
  UNIQUE(part_id, shape_tag)
);

-- 2. 인덱스 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_unknown_logs_shape_tag 
  ON unknown_category_logs(shape_tag);
  
CREATE INDEX IF NOT EXISTS idx_unknown_logs_detected_at 
  ON unknown_category_logs(last_detected_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_unknown_logs_count 
  ON unknown_category_logs(detected_count DESC);

-- 3. 집계 뷰 (분기별 분석용)
CREATE OR REPLACE VIEW v_unknown_categories_summary AS
SELECT 
  ucl.shape_tag,
  COUNT(DISTINCT ucl.part_id) as unique_parts_count,
  SUM(ucl.detected_count) as total_detections,
  MIN(ucl.first_detected_at) as first_seen,
  MAX(ucl.last_detected_at) as last_seen,
  ARRAY_AGG(DISTINCT ucl.part_name ORDER BY ucl.part_name) 
    FILTER (WHERE ucl.part_name IS NOT NULL) as sample_part_names,
  AVG(ucl.detected_count) as avg_detections_per_part
FROM unknown_category_logs ucl
WHERE ucl.part_category = 99  -- unknown만
GROUP BY ucl.shape_tag
HAVING SUM(ucl.detected_count) >= 10  -- 10회 이상 검출된 것만
ORDER BY SUM(ucl.detected_count) DESC;

-- 4. 부품별 상세 뷰
CREATE OR REPLACE VIEW v_unknown_parts_detail AS
SELECT 
  ucl.part_id,
  ucl.part_name,
  ucl.shape_tag,
  ucl.detected_count,
  ucl.first_detected_at,
  ucl.last_detected_at,
  ucl.metadata
FROM unknown_category_logs ucl
WHERE ucl.part_category = 99
ORDER BY ucl.detected_count DESC, ucl.last_detected_at DESC;

-- 5. 로그 기록 함수 (코드에서 호출)
CREATE OR REPLACE FUNCTION log_unknown_category(
  p_shape_tag VARCHAR(50),
  p_part_id VARCHAR(20),
  p_part_name VARCHAR(255) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- 기존 레코드가 있으면 카운트 증가, 없으면 새로 추가
  INSERT INTO unknown_category_logs (
    shape_tag, part_id, part_name, part_category, 
    detected_count, metadata
  ) VALUES (
    p_shape_tag, p_part_id, p_part_name, 99, 
    1, p_metadata
  )
  ON CONFLICT (part_id, shape_tag) 
  DO UPDATE SET
    detected_count = unknown_category_logs.detected_count + 1,
    last_detected_at = NOW(),
    part_name = COALESCE(EXCLUDED.part_name, unknown_category_logs.part_name),
    metadata = COALESCE(EXCLUDED.metadata, unknown_category_logs.metadata);
END;
$$ LANGUAGE plpgsql;

-- 6. 분기별 리포트 생성 함수
CREATE OR REPLACE FUNCTION generate_category_review_report(
  p_min_detections INTEGER DEFAULT 10,
  p_date_from TIMESTAMP DEFAULT NOW() - INTERVAL '3 months'
)
RETURNS TABLE (
  shape_tag VARCHAR,
  parts_count BIGINT,
  total_detections BIGINT,
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  sample_parts TEXT[],
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ucl.shape_tag,
    COUNT(DISTINCT ucl.part_id)::BIGINT as parts_count,
    SUM(ucl.detected_count)::BIGINT as total_detections,
    MIN(ucl.first_detected_at) as first_seen,
    MAX(ucl.last_detected_at) as last_seen,
    ARRAY_AGG(DISTINCT ucl.part_name ORDER BY ucl.part_name) 
      FILTER (WHERE ucl.part_name IS NOT NULL)::TEXT[] as sample_parts,
    CASE 
      WHEN SUM(ucl.detected_count) >= 100 THEN '🔴 HIGH: 즉시 카테고리 추가 권장'
      WHEN SUM(ucl.detected_count) >= 50 THEN '🟡 MEDIUM: 다음 분기 검토'
      ELSE '🟢 LOW: 모니터링 계속'
    END as recommendation
  FROM unknown_category_logs ucl
  WHERE ucl.part_category = 99
    AND ucl.last_detected_at >= p_date_from
  GROUP BY ucl.shape_tag
  HAVING SUM(ucl.detected_count) >= p_min_detections
  ORDER BY SUM(ucl.detected_count) DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. 로그 정리 함수 (카테고리 추가 후 실행)
CREATE OR REPLACE FUNCTION cleanup_resolved_category_logs(
  p_shape_tag VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM unknown_category_logs
  WHERE shape_tag = p_shape_tag;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE '✅ 정리 완료: % (% 건 삭제)', p_shape_tag, deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 8. RLS 정책
ALTER TABLE unknown_category_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unknown_logs_read_policy" ON unknown_category_logs;
CREATE POLICY "unknown_logs_read_policy" ON unknown_category_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "unknown_logs_write_policy" ON unknown_category_logs;
CREATE POLICY "unknown_logs_write_policy" ON unknown_category_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- 9. 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ 카테고리 모니터링 시스템 설치 완료!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 주요 기능:';
  RAISE NOTICE '  1. unknown 카테고리 자동 로깅 (log_unknown_category)';
  RAISE NOTICE '  2. 집계 뷰 (v_unknown_categories_summary)';
  RAISE NOTICE '  3. 분기별 리포트 (generate_category_review_report)';
  RAISE NOTICE '  4. 로그 정리 (cleanup_resolved_category_logs)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 사용 예시:';
  RAISE NOTICE '  -- 분기별 리포트 생성';
  RAISE NOTICE '  SELECT * FROM generate_category_review_report();';
  RAISE NOTICE '';
  RAISE NOTICE '  -- 요약 조회';
  RAISE NOTICE '  SELECT * FROM v_unknown_categories_summary;';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 다음 단계: 코드에 로그 수집 추가 필요';
END $$;

-- 10. 샘플 쿼리 (주석)
/*
-- 분기별 리포트 생성 (최근 3개월, 10회 이상)
SELECT * FROM generate_category_review_report(10, NOW() - INTERVAL '3 months');

-- 모든 unknown 카테고리 요약
SELECT * FROM v_unknown_categories_summary;

-- 특정 shape_tag 상세
SELECT * FROM v_unknown_parts_detail WHERE shape_tag = 'connector';

-- 수동 로그 기록 (테스트)
SELECT log_unknown_category('test_shape', '12345', 'Test Part', '{"confidence": 0.5}'::jsonb);

-- 카테고리 추가 후 로그 정리
SELECT cleanup_resolved_category_logs('connector');

-- 최근 7일간 unknown 검출 트렌드
SELECT 
  DATE(last_detected_at) as date,
  COUNT(DISTINCT part_id) as unique_parts,
  SUM(detected_count) as total_detections
FROM unknown_category_logs
WHERE last_detected_at >= NOW() - INTERVAL '7 days'
  AND part_category = 99
GROUP BY DATE(last_detected_at)
ORDER BY date DESC;
*/

