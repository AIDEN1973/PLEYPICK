-- 임베딩 상태 뷰 수정
-- UI에서 필요한 embedding_status, embedding_dimension, color_name 필드 추가

DROP VIEW IF EXISTS v_embedding_status;

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

-- 확인
SELECT 
  '임베딩 뷰 업데이트 완료' as message,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE embedding_status = 'completed') as completed,
  COUNT(*) FILTER (WHERE embedding_status = 'pending') as pending,
  COUNT(*) FILTER (WHERE embedding_status = 'no_text') as no_text
FROM v_embedding_status;

