-- ============================================================================
-- 메타데이터 관리 시스템 - 뷰 및 RPC 함수
-- ============================================================================
-- 목적: 메타데이터 관리 UI에 필요한 DB 객체 생성
-- 작성일: 2025-10-13
-- ============================================================================

-- 1. 기존 뷰 삭제 (CASCADE로 의존성도 함께 삭제)
DROP VIEW IF EXISTS v_metadata_status CASCADE;
DROP VIEW IF EXISTS v_embedding_status CASCADE;

-- 2. AI 메타데이터 상태 뷰
CREATE OR REPLACE VIEW v_metadata_status AS
SELECT 
  pmf.id,
  pmf.part_id,
  pmf.part_name,
  pmf.color_id,
  lc.name as color_name,
  pmf.feature_json,
  pmf.feature_text,
  pmf.confidence,
  pmf.confidence as quality_score,
  pmf.created_at,
  pmf.updated_at,
  CASE 
    WHEN pmf.feature_json IS NOT NULL 
         AND pmf.feature_json->>'function' IS NOT NULL 
         AND pmf.feature_json->>'function' != 'unknown'
         AND pmf.feature_json->>'connection' IS NOT NULL 
         AND pmf.feature_json->>'connection' != 'unknown' THEN 'completed'
    WHEN pmf.feature_json IS NULL THEN 'missing'
    WHEN pmf.feature_json->>'function' = 'unknown' OR pmf.feature_json->>'connection' = 'unknown' THEN 'missing'
    WHEN pmf.feature_json IS NOT NULL 
         AND pmf.feature_text IS NOT NULL 
         AND pmf.feature_text != '' THEN 'completed'
    WHEN pmf.feature_json IS NOT NULL 
         AND (pmf.feature_json->>'function' IS NOT NULL OR pmf.feature_json->>'connection' IS NOT NULL) THEN 'completed'
    ELSE 'error'
  END as metadata_status
FROM parts_master_features pmf
LEFT JOIN lego_colors lc ON pmf.color_id = lc.color_id
ORDER BY pmf.id DESC;

-- 3. CLIP 임베딩 상태 뷰
CREATE OR REPLACE VIEW v_embedding_status AS
SELECT 
  pmf.id,
  pmf.part_id,
  pmf.part_name,
  pmf.color_id,
  lc.name as color_name,
  lc.rgb as color_rgb,
  pmf.clip_text_emb,
  pmf.feature_text,
  pmf.confidence,
  pmf.created_at,
  pmf.updated_at,
  CASE 
    WHEN pmf.clip_text_emb IS NOT NULL THEN 'completed'
    WHEN pmf.feature_text IS NULL THEN 'no_text'
    ELSE 'pending'
  END as embedding_status,
  CASE 
    WHEN pmf.clip_text_emb IS NOT NULL THEN 768
    ELSE NULL
  END as embedding_dimension
FROM parts_master_features pmf
LEFT JOIN lego_colors lc ON pmf.color_id = lc.color_id
ORDER BY pmf.id DESC;

-- 4. 기존 RPC 함수 삭제
DROP FUNCTION IF EXISTS get_metadata_stats();
DROP FUNCTION IF EXISTS get_embedding_stats();
DROP FUNCTION IF EXISTS request_metadata_generation(INTEGER[]);
DROP FUNCTION IF EXISTS request_embedding_generation(INTEGER[]);
DROP FUNCTION IF EXISTS retry_failed_embeddings();
DROP FUNCTION IF EXISTS request_missing_embeddings();

-- 5. 메타데이터 통계 RPC 함수 (수정됨)
CREATE OR REPLACE FUNCTION get_metadata_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'completed', COUNT(*) FILTER (
      WHERE feature_json IS NOT NULL 
        AND feature_json->>'function' IS NOT NULL 
        AND feature_json->>'function' != 'unknown'
        AND feature_json->>'connection' IS NOT NULL 
        AND feature_json->>'connection' != 'unknown'
    ),
    'missing', COUNT(*) FILTER (
      WHERE feature_json IS NULL 
        OR feature_json->>'function' = 'unknown' 
        OR feature_json->>'connection' = 'unknown'
    ),
    'error', COUNT(*) FILTER (
      WHERE feature_json IS NOT NULL 
        AND feature_json->>'function' IS NULL
    ),
    'completion_rate', ROUND(
      COUNT(*) FILTER (
        WHERE feature_json IS NOT NULL 
          AND feature_json->>'function' IS NOT NULL 
          AND feature_json->>'function' != 'unknown'
          AND feature_json->>'connection' IS NOT NULL 
          AND feature_json->>'connection' != 'unknown'
      )::NUMERIC / 
      NULLIF(COUNT(*), 0) * 100, 2
    )
  ) INTO result
  FROM parts_master_features;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. 임베딩 통계 RPC 함수
CREATE FUNCTION get_embedding_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'completed', COUNT(*) FILTER (WHERE clip_text_emb IS NOT NULL),
    'pending', COUNT(*) FILTER (WHERE clip_text_emb IS NULL AND feature_text IS NOT NULL),
    'no_text', COUNT(*) FILTER (WHERE feature_text IS NULL),
    'completion_rate', ROUND(
      COUNT(*) FILTER (WHERE clip_text_emb IS NOT NULL)::NUMERIC / 
      NULLIF(COUNT(*), 0) * 100, 2
    )
  ) INTO result
  FROM parts_master_features;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. 메타데이터 생성 요청 RPC 함수 (실제 작동)
CREATE OR REPLACE FUNCTION request_metadata_generation(part_ids INTEGER[])
RETURNS JSON AS $$
DECLARE
  result JSON;
  updated_count INTEGER;
BEGIN
  -- 실제 메타데이터 생성: feature_json에 unknown 값을 설정하여 워커가 처리하도록 함
  UPDATE parts_master_features
  SET 
    feature_json = '{"function": "unknown", "connection": "unknown"}',
    feature_text = NULL,
    updated_at = NOW()
  WHERE id = ANY(part_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  SELECT json_build_object(
    'success', true,
    'count', updated_count,
    'message', updated_count || '개 항목의 메타데이터 생성을 요청했습니다. 워커가 자동으로 처리합니다.'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 8. 임베딩 생성 요청 RPC 함수 (실제 작동)
CREATE OR REPLACE FUNCTION request_embedding_generation(part_ids INTEGER[])
RETURNS JSON AS $$
DECLARE
  result JSON;
  updated_count INTEGER;
BEGIN
  -- 실제 임베딩 생성: clip_text_emb를 null로 설정하여 워커가 처리하도록 함
  UPDATE parts_master_features
  SET 
    clip_text_emb = NULL,
    semantic_vector = NULL,
    embedding_status = 'pending',
    updated_at = NOW()
  WHERE id = ANY(part_ids)
    AND feature_text IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  SELECT json_build_object(
    'success', true,
    'count', updated_count,
    'message', updated_count || '개 항목의 임베딩 생성을 요청했습니다. 워커가 자동으로 처리합니다.'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 9. 실패 임베딩 재시도 RPC 함수 (실제 작동)
CREATE OR REPLACE FUNCTION retry_failed_embeddings()
RETURNS JSON AS $$
DECLARE
  result JSON;
  retry_count INTEGER;
BEGIN
  -- 실패한 임베딩들을 다시 처리하도록 설정
  UPDATE parts_master_features
  SET 
    clip_text_emb = NULL,
    semantic_vector = NULL,
    embedding_status = 'pending',
    updated_at = NOW()
  WHERE embedding_status = 'failed'
    OR (feature_text IS NOT NULL AND clip_text_emb IS NULL);
  
  GET DIAGNOSTICS retry_count = ROW_COUNT;
  
  SELECT json_build_object(
    'success', true,
    'count', retry_count,
    'message', retry_count || '개 실패 항목의 재시도를 요청했습니다. 워커가 자동으로 처리합니다.'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 10. 미생성 임베딩 요청 RPC 함수 (실제 작동)
CREATE OR REPLACE FUNCTION request_missing_embeddings()
RETURNS JSON AS $$
DECLARE
  result JSON;
  missing_count INTEGER;
BEGIN
  -- 없음 임베딩들을 처리하도록 설정
  UPDATE parts_master_features
  SET 
    clip_text_emb = NULL,
    semantic_vector = NULL,
    embedding_status = 'pending',
    updated_at = NOW()
  WHERE feature_text IS NOT NULL
    AND (clip_text_emb IS NULL OR embedding_status IS NULL OR embedding_status = 'missing');
  
  GET DIAGNOSTICS missing_count = ROW_COUNT;
  
  SELECT json_build_object(
    'success', true,
    'count', missing_count,
    'message', missing_count || '개 없음 항목의 임베딩 생성을 요청했습니다. 워커가 자동으로 처리합니다.'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 11. RLS 정책 (읽기 허용)
ALTER TABLE parts_master_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parts_master_features_read_policy" ON parts_master_features;
CREATE POLICY "parts_master_features_read_policy" ON parts_master_features
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "parts_master_features_write_policy" ON parts_master_features;
CREATE POLICY "parts_master_features_write_policy" ON parts_master_features
  FOR ALL USING (auth.role() = 'authenticated');

-- 12. 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ 메타데이터 관리 뷰 및 RPC 함수 생성 완료!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 생성된 객체:';
  RAISE NOTICE '  - v_metadata_status (뷰)';
  RAISE NOTICE '  - v_embedding_status (뷰)';
  RAISE NOTICE '  - get_metadata_stats() (RPC)';
  RAISE NOTICE '  - get_embedding_stats() (RPC)';
  RAISE NOTICE '  - request_metadata_generation() (RPC)';
  RAISE NOTICE '  - request_embedding_generation() (RPC)';
  RAISE NOTICE '  - retry_failed_embeddings() (RPC)';
  RAISE NOTICE '  - request_missing_embeddings() (RPC)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 다음 단계: 브라우저 새로고침';
END $$;

-- ============================================================================
-- 카테고리 모니터링 시스템
-- ============================================================================

-- 13. unknown 카테고리 로그 테이블
CREATE TABLE IF NOT EXISTS unknown_category_logs (
  id SERIAL PRIMARY KEY,
  shape_tag VARCHAR(50) NOT NULL,
  part_id VARCHAR(20),
  part_name VARCHAR(255),
  part_category INTEGER DEFAULT 99,
  detected_count INTEGER DEFAULT 1,
  first_detected_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  last_detected_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(part_id, shape_tag)
);

CREATE INDEX IF NOT EXISTS idx_unknown_logs_shape_tag 
  ON unknown_category_logs(shape_tag);
CREATE INDEX IF NOT EXISTS idx_unknown_logs_detected_at 
  ON unknown_category_logs(last_detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_unknown_logs_count 
  ON unknown_category_logs(detected_count DESC);

-- 14. unknown 카테고리 집계 뷰
DROP VIEW IF EXISTS v_unknown_categories_summary CASCADE;
CREATE VIEW v_unknown_categories_summary AS
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
WHERE ucl.part_category = 99
GROUP BY ucl.shape_tag
HAVING SUM(ucl.detected_count) >= 10
ORDER BY SUM(ucl.detected_count) DESC;

-- 15. 등록된 카테고리 통계 뷰
DROP VIEW IF EXISTS v_part_categories_stats CASCADE;
CREATE VIEW v_part_categories_stats AS
SELECT 
  pc.id,
  pc.code,
  pc.display_name,
  pc.display_name_ko,
  pc.category_type,
  pc.sort_order,
  pc.is_active,
  COALESCE(COUNT(pmf.id), 0) as parts_count,
  pc.created_at,
  pc.updated_at
FROM part_categories pc
LEFT JOIN parts_master_features pmf ON pmf.part_category = pc.id
GROUP BY pc.id, pc.code, pc.display_name, pc.display_name_ko, 
         pc.category_type, pc.sort_order, pc.is_active, pc.created_at, pc.updated_at
ORDER BY pc.sort_order;

-- 16. 부품별 상세 뷰 (개선됨)
DROP VIEW IF EXISTS v_unknown_parts_detail CASCADE;
CREATE VIEW v_unknown_parts_detail AS
SELECT 
  COALESCE(pmf.part_id, ucl.part_id) as part_id,
  COALESCE(pmf.part_name, ucl.part_name) as part_name,
  ucl.shape_tag,
  ucl.detected_count,
  ucl.first_detected_at,
  ucl.last_detected_at,
  ucl.metadata
FROM unknown_category_logs ucl
LEFT JOIN parts_master_features pmf ON ucl.part_id = pmf.part_id
WHERE ucl.part_category = 99
ORDER BY ucl.detected_count DESC, ucl.last_detected_at DESC;

-- 17. 로그 기록 함수
DROP FUNCTION IF EXISTS log_unknown_category(VARCHAR, VARCHAR, VARCHAR, JSONB);
CREATE FUNCTION log_unknown_category(
  p_shape_tag VARCHAR,
  p_part_id VARCHAR,
  p_part_name VARCHAR DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
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

-- 18. 분기별 리포트 생성 함수
DROP FUNCTION IF EXISTS generate_category_review_report(INTEGER, TIMESTAMP);
CREATE FUNCTION generate_category_review_report(
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

-- 19. 로그 정리 함수
DROP FUNCTION IF EXISTS cleanup_resolved_category_logs(VARCHAR);
CREATE FUNCTION cleanup_resolved_category_logs(
  p_shape_tag VARCHAR
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM unknown_category_logs
  WHERE shape_tag = p_shape_tag;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 20. RLS 정책 (unknown_category_logs)
ALTER TABLE unknown_category_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unknown_logs_read_policy" ON unknown_category_logs;
CREATE POLICY "unknown_logs_read_policy" ON unknown_category_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "unknown_logs_write_policy" ON unknown_category_logs;
CREATE POLICY "unknown_logs_write_policy" ON unknown_category_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- 21. 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ 메타데이터 관리 + 카테고리 모니터링 시스템 생성 완료!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 메타데이터 관리:';
  RAISE NOTICE '  - v_metadata_status (뷰)';
  RAISE NOTICE '  - v_embedding_status (뷰)';
  RAISE NOTICE '  - get_metadata_stats() (RPC)';
  RAISE NOTICE '  - get_embedding_stats() (RPC)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 카테고리 모니터링:';
  RAISE NOTICE '  - v_unknown_categories_summary (뷰)';
  RAISE NOTICE '  - v_part_categories_stats (뷰)';
  RAISE NOTICE '  - v_unknown_parts_detail (뷰)';
  RAISE NOTICE '  - log_unknown_category() (RPC)';
  RAISE NOTICE '  - generate_category_review_report() (RPC)';
  RAISE NOTICE '  - cleanup_resolved_category_logs() (RPC)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 다음 단계: 브라우저 새로고침 (F5 또는 Ctrl+Shift+R)';
END $$;

-- 22. 테스트 쿼리
SELECT 'Metadata Stats:' as test, get_metadata_stats() as result
UNION ALL
SELECT 'Embedding Stats:', get_embedding_stats();
