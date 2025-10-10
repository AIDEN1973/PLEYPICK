-- lego_sets 테이블에 webp_image_url 컬럼 추가
ALTER TABLE lego_sets 
ADD COLUMN IF NOT EXISTS webp_image_url TEXT;
