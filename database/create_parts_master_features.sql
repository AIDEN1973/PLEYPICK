-- pgvector 확장 활성화 (필수)
CREATE EXTENSION IF NOT EXISTS vector;

-- 마스터 부품 특징 테이블 생성 (하이브리드 전략용)
-- LLM 사전 분석 결과와 CLIP 텍스트 임베딩을 저장하는 핵심 테이블

CREATE TABLE IF NOT EXISTS parts_master_features (
  id SERIAL PRIMARY KEY,
  part_id VARCHAR(20) NOT NULL,
  part_name VARCHAR(255),
  part_category INTEGER,
  color_id INTEGER,
  
  -- LLM 사전 분석 결과 (구조화된 feature)
  feature_json JSONB,
  feature_text TEXT,
  
  -- OpenAI 텍스트 임베딩 (사전 계산) - text-embedding-3-small 1536차
  clip_text_emb VECTOR(1536),
  
  -- 인식 힌트 및 관련 정보
  recognition_hints JSONB,
  similar_parts TEXT[],
  distinguishing_features TEXT[],
  
  -- 품질 지표
  confidence FLOAT DEFAULT 0.0,
  usage_frequency INTEGER DEFAULT 0,
  detection_accuracy FLOAT DEFAULT 0.0,
  
  -- 메타데이터
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  
  -- 인덱스
  UNIQUE(part_id, color_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_parts_master_features_part_id 
  ON parts_master_features(part_id);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_part_name 
  ON parts_master_features(part_name);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_confidence 
  ON parts_master_features(confidence DESC);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_usage_frequency 
  ON parts_master_features(usage_frequency DESC);

-- OpenAI 텍스트 임베딩 벡터 인덱스 (코사인 유사도 검색용)
CREATE INDEX IF NOT EXISTS idx_parts_master_features_clip_text_emb 
  ON parts_master_features USING ivfflat (clip_text_emb vector_cosine_ops)
  WITH (lists = 100);

-- JSONB 필드 인덱스
CREATE INDEX IF NOT EXISTS idx_parts_master_features_feature_json 
  ON parts_master_features USING gin (feature_json);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_recognition_hints 
  ON parts_master_features USING gin (recognition_hints);

-- RLS (Row Level Security) 설정
ALTER TABLE parts_master_features ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "parts_master_features_read_policy" ON parts_master_features;
DROP POLICY IF EXISTS "parts_master_features_write_policy" ON parts_master_features;

-- 모든 사용자가 읽기 가능
CREATE POLICY "parts_master_features_read_policy" ON parts_master_features
  FOR SELECT USING (true);

-- 인증된 사용자만 쓰기 가능
CREATE POLICY "parts_master_features_write_policy" ON parts_master_features
  FOR ALL USING (auth.role() = 'authenticated');

-- 마스터 부품 특징 통계 뷰
CREATE OR REPLACE VIEW parts_master_features_stats AS
SELECT 
  COUNT(*) as total_parts,
  AVG(confidence) as avg_confidence,
  AVG(usage_frequency) as avg_usage_frequency,
  AVG(detection_accuracy) as avg_detection_accuracy,
  COUNT(CASE WHEN clip_text_emb IS NOT NULL THEN 1 END) as embedded_parts,
  COUNT(CASE WHEN feature_json IS NOT NULL THEN 1 END) as analyzed_parts,
  COUNT(CASE WHEN confidence > 0.8 THEN 1 END) as high_confidence_parts,
  COUNT(CASE WHEN confidence < 0.5 THEN 1 END) as low_confidence_parts
FROM parts_master_features;

-- 부품 특징 검색 함수 (OpenAI 텍스트 임베딩 기반)
CREATE OR REPLACE FUNCTION search_parts_by_text_embedding(
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  part_id VARCHAR,
  part_name VARCHAR,
  similarity FLOAT,
  feature_text TEXT,
  confidence FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pmf.part_id,
    pmf.part_name,
    1 - (pmf.clip_text_emb <=> query_embedding) as similarity,
    pmf.feature_text,
    pmf.confidence
  FROM parts_master_features pmf
  WHERE pmf.clip_text_emb IS NOT NULL
    AND 1 - (pmf.clip_text_emb <=> query_embedding) >= similarity_threshold
  ORDER BY pmf.clip_text_emb <=> query_embedding
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 부품 특징 업데이트 함수 (사용 빈도 및 정확도)
CREATE OR REPLACE FUNCTION update_part_usage_stats(
  target_part_id VARCHAR,
  usage_increment INTEGER DEFAULT 1,
  accuracy_update FLOAT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE parts_master_features 
  SET 
    usage_frequency = usage_frequency + usage_increment,
    detection_accuracy = CASE 
      WHEN accuracy_update IS NOT NULL THEN 
        (detection_accuracy + accuracy_update) / 2
      ELSE detection_accuracy 
    END,
    updated_at = NOW()
  WHERE part_id = target_part_id;
END;
$$ LANGUAGE plpgsql;

-- 부품 특징 품질 분석 함수
CREATE OR REPLACE FUNCTION analyze_part_quality(
  target_part_id VARCHAR
)
RETURNS TABLE (
  part_id VARCHAR,
  quality_score FLOAT,
  confidence_level VARCHAR,
  usage_level VARCHAR,
  accuracy_level VARCHAR,
  recommendations TEXT[]
) AS $$
DECLARE
  part_record RECORD;
  quality_score FLOAT;
  confidence_level VARCHAR;
  usage_level VARCHAR;
  accuracy_level VARCHAR;
  recommendations TEXT[];
BEGIN
  SELECT * INTO part_record 
  FROM parts_master_features 
  WHERE part_id = target_part_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- 품질 점수 계산 (0-1 범위)
  quality_score := (
    COALESCE(part_record.confidence, 0) * 0.4 +
    LEAST(COALESCE(part_record.usage_frequency, 0) / 100.0, 1.0) * 0.3 +
    COALESCE(part_record.detection_accuracy, 0) * 0.3
  );
  
  -- 신뢰도 레벨
  confidence_level := CASE 
    WHEN part_record.confidence >= 0.9 THEN 'High'
    WHEN part_record.confidence >= 0.7 THEN 'Medium'
    ELSE 'Low'
  END;
  
  -- 사용 빈도 레벨
  usage_level := CASE 
    WHEN part_record.usage_frequency >= 50 THEN 'High'
    WHEN part_record.usage_frequency >= 10 THEN 'Medium'
    ELSE 'Low'
  END;
  
  -- 정확도 레벨
  accuracy_level := CASE 
    WHEN part_record.detection_accuracy >= 0.9 THEN 'High'
    WHEN part_record.detection_accuracy >= 0.7 THEN 'Medium'
    ELSE 'Low'
  END;
  
  -- 개선 권장사항
  recommendations := ARRAY[]::TEXT[];
  
  IF part_record.confidence < 0.7 THEN
    recommendations := array_append(recommendations, 'LLM 재분석 필요');
  END IF;
  
  IF part_record.usage_frequency < 5 THEN
    recommendations := array_append(recommendations, '사용 빈도 모니터링 필요');
  END IF;
  
  IF part_record.detection_accuracy < 0.7 THEN
    recommendations := array_append(recommendations, '검출 정확도 개선 필요');
  END IF;
  
  IF part_record.clip_text_emb IS NULL THEN
    recommendations := array_append(recommendations, 'CLIP 텍스트 임베딩 생성 필요');
  END IF;
  
  RETURN QUERY SELECT 
    part_record.part_id,
    quality_score,
    confidence_level,
    usage_level,
    accuracy_level,
    recommendations;
END;
$$ LANGUAGE plpgsql;
