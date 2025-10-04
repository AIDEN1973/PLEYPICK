-- 실시간 검출 로그 테이블
-- 부품 검출 과정과 결과를 추적하는 테이블

CREATE TABLE IF NOT EXISTS detection_logs (
  id SERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  set_num VARCHAR(20) NOT NULL,
  
  -- 검출된 부품 정보
  detected_part_id INTEGER,
  detected_part_num VARCHAR(20),
  detected_color_id INTEGER,
  
  -- 검출 과정 정보
  detection_stage VARCHAR(50), -- 'detected', 'filtered', 'matched', 'approved'
  confidence_score FLOAT,
  processing_time_ms INTEGER,
  
  -- 매칭 결과
  matched_part_num VARCHAR(20),
  matched_color_id INTEGER,
  similarity_score FLOAT,
  llm_score FLOAT,
  final_score FLOAT,
  
  -- 임계치 기반 결과
  threshold_result VARCHAR(20), -- 'auto_approved', 'manual_review', 'retake_required'
  auto_approved BOOLEAN DEFAULT FALSE,
  manual_reviewed BOOLEAN DEFAULT FALSE,
  
  -- 사용자 피드백
  user_feedback VARCHAR(20), -- 'correct', 'incorrect', 'retake'
  user_corrected_part_num VARCHAR(20),
  user_corrected_color_id INTEGER,
  
  -- 이미지 정보
  original_image_url TEXT,
  cropped_image_url TEXT,
  bounding_box JSONB, -- {x, y, width, height}
  
  -- 메타데이터
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- 외래키
  CONSTRAINT fk_detection_logs_part 
    FOREIGN KEY (detected_part_num) REFERENCES lego_parts(part_num),
  CONSTRAINT fk_detection_logs_color 
    FOREIGN KEY (detected_color_id) REFERENCES lego_colors(color_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_detection_logs_session 
  ON detection_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_detection_logs_set_num 
  ON detection_logs(set_num);

CREATE INDEX IF NOT EXISTS idx_detection_logs_created_at 
  ON detection_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_detection_logs_threshold_result 
  ON detection_logs(threshold_result);

CREATE INDEX IF NOT EXISTS idx_detection_logs_confidence 
  ON detection_logs(confidence_score DESC);

-- JSONB 필드 인덱스
CREATE INDEX IF NOT EXISTS idx_detection_logs_bounding_box 
  ON detection_logs USING gin (bounding_box);

-- RLS 설정
ALTER TABLE detection_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "detection_logs_read_policy" ON detection_logs
  FOR SELECT USING (true);

-- 인증된 사용자만 쓰기 가능
CREATE POLICY "detection_logs_write_policy" ON detection_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- 검출 세션 통계 뷰
CREATE OR REPLACE VIEW detection_session_stats AS
SELECT 
  session_id,
  set_num,
  COUNT(*) as total_detections,
  COUNT(CASE WHEN threshold_result = 'auto_approved' THEN 1 END) as auto_approved_count,
  COUNT(CASE WHEN threshold_result = 'manual_review' THEN 1 END) as manual_review_count,
  COUNT(CASE WHEN threshold_result = 'retake_required' THEN 1 END) as retake_count,
  AVG(confidence_score) as avg_confidence,
  AVG(processing_time_ms) as avg_processing_time,
  MIN(created_at) as session_start,
  MAX(created_at) as session_end
FROM detection_logs
GROUP BY session_id, set_num;

-- 정확도 분석 함수
CREATE OR REPLACE FUNCTION calculate_detection_accuracy(
  session_id_param UUID,
  start_date TIMESTAMP DEFAULT NULL,
  end_date TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
  total_detections BIGINT,
  correct_detections BIGINT,
  accuracy_rate FLOAT,
  auto_approval_rate FLOAT,
  manual_review_rate FLOAT,
  retake_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_detections,
    COUNT(CASE WHEN user_feedback = 'correct' OR (user_feedback IS NULL AND auto_approved = true) THEN 1 END) as correct_detections,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        COUNT(CASE WHEN user_feedback = 'correct' OR (user_feedback IS NULL AND auto_approved = true) THEN 1 END)::FLOAT / COUNT(*)::FLOAT
      ELSE 0 
    END as accuracy_rate,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        COUNT(CASE WHEN threshold_result = 'auto_approved' THEN 1 END)::FLOAT / COUNT(*)::FLOAT
      ELSE 0 
    END as auto_approval_rate,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        COUNT(CASE WHEN threshold_result = 'manual_review' THEN 1 END)::FLOAT / COUNT(*)::FLOAT
      ELSE 0 
    END as manual_review_rate,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        COUNT(CASE WHEN threshold_result = 'retake_required' THEN 1 END)::FLOAT / COUNT(*)::FLOAT
      ELSE 0 
    END as retake_rate
  FROM detection_logs
  WHERE 
    (session_id_param IS NULL OR session_id = session_id_param)
    AND (start_date IS NULL OR created_at >= start_date)
    AND (end_date IS NULL OR created_at <= end_date);
END;
$$ LANGUAGE plpgsql;
