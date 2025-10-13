-- RLS 정책을 임시로 비활성화하여 데이터 삭제 가능하게 만들기
-- 이 스크립트는 데이터 초기화를 위해 RLS를 임시로 비활성화합니다

-- 1. synthetic_dataset 테이블의 RLS 비활성화
ALTER TABLE synthetic_dataset DISABLE ROW LEVEL SECURITY;

-- 2. synthetic_part_stats 테이블의 RLS 비활성화  
ALTER TABLE synthetic_part_stats DISABLE ROW LEVEL SECURITY;

-- 3. 모든 데이터 삭제
DELETE FROM synthetic_dataset;
DELETE FROM synthetic_part_stats;

-- 4. RLS 다시 활성화 (보안을 위해)
ALTER TABLE synthetic_dataset ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_part_stats ENABLE ROW LEVEL SECURITY;

-- 5. 삭제 확인
SELECT 'synthetic_dataset' as table_name, COUNT(*) as remaining_records FROM synthetic_dataset
UNION ALL
SELECT 'synthetic_part_stats' as table_name, COUNT(*) as remaining_records FROM synthetic_part_stats;
