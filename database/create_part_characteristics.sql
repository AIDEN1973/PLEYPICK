-- 부품 특징 정보 테이블 생성
-- LLM 분석 결과와 CLIP 임베딩을 저장하는 핵심 테이블

CREATE TABLE IF NOT EXISTS part_characteristics (
  id SERIAL PRIMARY KEY,
  part_num VARCHAR(20) NOT NULL,
  set_num VARCHAR(20) NOT NULL,
  color_id INTEGER NOT NULL,
  
  -- LLM 분석 결과 (JSONB)
  llm_visual_features JSONB,
  llm_geometric_features JSONB,
  llm_recognition_hints JSONB,
  llm_confidence FLOAT DEFAULT 0.0,
  
  -- CLIP 임베딩 (벡터)
  clip_embedding VECTOR(768),
  
  -- 성능 최적화 필드
  detection_priority FLOAT DEFAULT 1.0,
  color_variations JSONB,
  size_characteristics JSONB,
  
  -- 운영 지표
  auto_approval_rate FLOAT DEFAULT 0.0,
  manual_review_rate FLOAT DEFAULT 0.0,
  retake_rate FLOAT DEFAULT 0.0,
  
  -- 메타데이터
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_analyzed_at TIMESTAMP,
  
  -- 외래키
  CONSTRAINT fk_part_characteristics_part 
    FOREIGN KEY (part_num) REFERENCES lego_parts(part_num),
  CONSTRAINT fk_part_characteristics_color 
    FOREIGN KEY (color_id) REFERENCES lego_colors(color_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_part_characteristics_set_num 
  ON part_characteristics(set_num);

CREATE INDEX IF NOT EXISTS idx_part_characteristics_part_color 
  ON part_characteristics(part_num, color_id);

CREATE INDEX IF NOT EXISTS idx_part_characteristics_priority 
  ON part_characteristics(detection_priority DESC);

-- CLIP 임베딩 벡터 인덱스 (코사인 유사도 검색용)
CREATE INDEX IF NOT EXISTS idx_part_characteristics_embedding 
  ON part_characteristics USING ivfflat (clip_embedding vector_cosine_ops)
  WITH (lists = 100);

-- JSONB 필드 인덱스
CREATE INDEX IF NOT EXISTS idx_part_characteristics_visual 
  ON part_characteristics USING gin (llm_visual_features);

CREATE INDEX IF NOT EXISTS idx_part_characteristics_geometric 
  ON part_characteristics USING gin (llm_geometric_features);

-- RLS (Row Level Security) 설정
ALTER TABLE part_characteristics ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "part_characteristics_read_policy" ON part_characteristics
  FOR SELECT USING (true);

-- 인증된 사용자만 쓰기 가능
CREATE POLICY "part_characteristics_write_policy" ON part_characteristics
  FOR ALL USING (auth.role() = 'authenticated');

-- 부품별 특징 통계 뷰
CREATE OR REPLACE VIEW part_characteristics_stats AS
SELECT 
  set_num,
  COUNT(*) as total_parts,
  AVG(llm_confidence) as avg_confidence,
  AVG(detection_priority) as avg_priority,
  AVG(auto_approval_rate) as avg_auto_approval,
  COUNT(CASE WHEN clip_embedding IS NOT NULL THEN 1 END) as embedded_parts,
  COUNT(CASE WHEN llm_visual_features IS NOT NULL THEN 1 END) as analyzed_parts
FROM part_characteristics
GROUP BY set_num;

-- 부품 특징 분석 상태 확인 함수
CREATE OR REPLACE FUNCTION get_part_analysis_status(set_num_param VARCHAR)
RETURNS TABLE (
  part_num VARCHAR,
  color_id INTEGER,
  has_llm_analysis BOOLEAN,
  has_clip_embedding BOOLEAN,
  detection_priority FLOAT,
  last_analyzed_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.part_num,
    pc.color_id,
    (pc.llm_visual_features IS NOT NULL) as has_llm_analysis,
    (pc.clip_embedding IS NOT NULL) as has_clip_embedding,
    pc.detection_priority,
    pc.last_analyzed_at
  FROM part_characteristics pc
  WHERE pc.set_num = set_num_param
  ORDER BY pc.detection_priority DESC;
END;
$$ LANGUAGE plpgsql;
