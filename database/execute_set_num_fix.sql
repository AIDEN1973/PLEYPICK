-- 🔧 synthetic_dataset 테이블에 set_num 컬럼 추가 (직접 실행)

-- set_num 컬럼 추가
ALTER TABLE synthetic_dataset 
ADD COLUMN IF NOT EXISTS set_num VARCHAR(50);

-- set_num 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_synthetic_dataset_set_num ON synthetic_dataset(set_num);

-- 완료 메시지
SELECT '✅ synthetic_dataset 테이블에 set_num 컬럼 추가 완료!' as status;
