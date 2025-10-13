-- 모든 메타데이터 관리 뷰 수정
-- 1. RPC 파라미터 이름 수정 (UI에서 part_ids 사용)
-- 2. color_name 필드 추가 (lego_colors JOIN)
-- 3. embedding_dimension 필드 추가

-- 기존 뷰 삭제
DROP VIEW IF EXISTS v_metadata_status CASCADE;
DROP VIEW IF EXISTS v_embedding_status CASCADE;

-- 1. AI 메타데이터 상태 뷰
CREATE VIEW v_metadata_status AS
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
    WHEN pmf.feature_json IS NOT NULL AND pmf.feature_text IS NOT NULL THEN 'completed'
    WHEN pmf.feature_json IS NULL AND pmf.feature_text IS NULL THEN 'missing'
    ELSE 'error'
  END as metadata_status
FROM parts_master_features pmf
LEFT JOIN lego_colors lc ON pmf.color_id = lc.color_id
ORDER BY pmf.id DESC;

-- 2. CLIP 임베딩 상태 뷰
CREATE VIEW v_embedding_status AS
SELECT 
  pmf.id,
  pmf.part_id,
  pmf.part_name,
  pmf.color_id,
  lc.name as color_name,
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

-- 확인 쿼리
SELECT 
  '=== 뷰 업데이트 완료 ===' as message
UNION ALL
SELECT 
  'v_metadata_status: ' || COUNT(*)::text || ' records' 
FROM v_metadata_status
UNION ALL
SELECT 
  'v_embedding_status: ' || COUNT(*)::text || ' records'
FROM v_embedding_status;

-- 통계 확인
SELECT 
  '=== 메타데이터 통계 ===' as category,
  '' as status,
  '' as count
UNION ALL
SELECT 
  'Metadata',
  metadata_status,
  COUNT(*)::text
FROM v_metadata_status
GROUP BY metadata_status
UNION ALL
SELECT 
  '=== 임베딩 통계 ===' as category,
  '' as status,
  '' as count
UNION ALL
SELECT 
  'Embedding',
  embedding_status,
  COUNT(*)::text
FROM v_embedding_status
GROUP BY embedding_status;

