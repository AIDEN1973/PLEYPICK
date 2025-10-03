-- image_metadata 테이블만 생성하는 스크립트
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 이미지 메타데이터 테이블 생성
CREATE TABLE IF NOT EXISTS image_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_url TEXT NOT NULL,
  supabase_url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  part_num VARCHAR(50),
  color_id INTEGER,
  set_num VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_image_metadata_part_num ON image_metadata(part_num);
CREATE INDEX IF NOT EXISTS idx_image_metadata_color_id ON image_metadata(color_id);
CREATE INDEX IF NOT EXISTS idx_image_metadata_set_num ON image_metadata(set_num);
CREATE INDEX IF NOT EXISTS idx_image_metadata_created_at ON image_metadata(created_at);

-- 3. RLS 정책 설정
ALTER TABLE image_metadata ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Public read access for image_metadata" ON image_metadata
FOR SELECT USING (true);

-- 인증된 사용자만 삽입 가능
CREATE POLICY "Authenticated users can insert image_metadata" ON image_metadata
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자만 업데이트 가능
CREATE POLICY "Authenticated users can update image_metadata" ON image_metadata
FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자만 삭제 가능
CREATE POLICY "Authenticated users can delete image_metadata" ON image_metadata
FOR DELETE USING (auth.role() = 'authenticated');

-- 4. 업데이트 트리거 추가
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_image_metadata_updated_at 
  BEFORE UPDATE ON image_metadata 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 5. 확인
SELECT 'image_metadata table created successfully' as status;
