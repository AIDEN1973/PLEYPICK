-- 🔧 synthetic_dataset 테이블에 set_num 컬럼 추가

-- set_num 컬럼 추가
ALTER TABLE synthetic_dataset 
ADD COLUMN IF NOT EXISTS set_num VARCHAR(50);

-- set_num 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_synthetic_dataset_set_num ON synthetic_dataset(set_num);

-- 기존 데이터에 대한 set_num 업데이트 (metadata에서 추출)
UPDATE synthetic_dataset 
SET set_num = metadata->>'set_num'
WHERE set_num IS NULL 
AND metadata IS NOT NULL 
AND metadata->>'set_num' IS NOT NULL;

-- 완료 메시지
SELECT '✅ synthetic_dataset 테이블에 set_num 컬럼 추가 완료!' as status;
