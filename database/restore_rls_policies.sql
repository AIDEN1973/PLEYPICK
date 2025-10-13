-- RLS 정책 복원 및 보안 강화
-- 데이터 삭제 후 RLS 정책을 다시 적용합니다

-- 1. synthetic_dataset 테이블 RLS 정책 복원
ALTER TABLE synthetic_dataset ENABLE ROW LEVEL SECURITY;

-- synthetic_dataset 테이블에 대한 RLS 정책 생성
DROP POLICY IF EXISTS "Users can view synthetic_dataset" ON synthetic_dataset;
DROP POLICY IF EXISTS "Users can insert synthetic_dataset" ON synthetic_dataset;
DROP POLICY IF EXISTS "Users can update synthetic_dataset" ON synthetic_dataset;
DROP POLICY IF EXISTS "Users can delete synthetic_dataset" ON synthetic_dataset;

-- 읽기 정책: 인증된 사용자는 모든 데이터 조회 가능
CREATE POLICY "Users can view synthetic_dataset" ON synthetic_dataset
  FOR SELECT USING (auth.role() = 'authenticated');

-- 삽입 정책: 인증된 사용자는 데이터 삽입 가능
CREATE POLICY "Users can insert synthetic_dataset" ON synthetic_dataset
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 업데이트 정책: 인증된 사용자는 데이터 수정 가능
CREATE POLICY "Users can update synthetic_dataset" ON synthetic_dataset
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 삭제 정책: 인증된 사용자는 데이터 삭제 가능 (관리자만)
CREATE POLICY "Users can delete synthetic_dataset" ON synthetic_dataset
  FOR DELETE USING (auth.role() = 'authenticated');

-- 2. synthetic_part_stats 테이블 RLS 정책 복원
ALTER TABLE synthetic_part_stats ENABLE ROW LEVEL SECURITY;

-- synthetic_part_stats 테이블에 대한 RLS 정책 생성
DROP POLICY IF EXISTS "Users can view synthetic_part_stats" ON synthetic_part_stats;
DROP POLICY IF EXISTS "Users can insert synthetic_part_stats" ON synthetic_part_stats;
DROP POLICY IF EXISTS "Users can update synthetic_part_stats" ON synthetic_part_stats;
DROP POLICY IF EXISTS "Users can delete synthetic_part_stats" ON synthetic_part_stats;

-- 읽기 정책: 인증된 사용자는 모든 데이터 조회 가능
CREATE POLICY "Users can view synthetic_part_stats" ON synthetic_part_stats
  FOR SELECT USING (auth.role() = 'authenticated');

-- 삽입 정책: 인증된 사용자는 데이터 삽입 가능
CREATE POLICY "Users can insert synthetic_part_stats" ON synthetic_part_stats
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 업데이트 정책: 인증된 사용자는 데이터 수정 가능
CREATE POLICY "Users can update synthetic_part_stats" ON synthetic_part_stats
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 삭제 정책: 인증된 사용자는 데이터 삭제 가능 (관리자만)
CREATE POLICY "Users can delete synthetic_part_stats" ON synthetic_part_stats
  FOR DELETE USING (auth.role() = 'authenticated');

-- 3. 기타 테이블들의 RLS 정책도 확인 및 복원
-- lego_sets 테이블 RLS 정책 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lego_sets' AND policyname = 'Users can view lego_sets'
  ) THEN
    ALTER TABLE lego_sets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view lego_sets" ON lego_sets
      FOR SELECT USING (auth.role() = 'authenticated');
    CREATE POLICY "Users can insert lego_sets" ON lego_sets
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    CREATE POLICY "Users can update lego_sets" ON lego_sets
      FOR UPDATE USING (auth.role() = 'authenticated');
    CREATE POLICY "Users can delete lego_sets" ON lego_sets
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- lego_parts 테이블 RLS 정책 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lego_parts' AND policyname = 'Users can view lego_parts'
  ) THEN
    ALTER TABLE lego_parts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view lego_parts" ON lego_parts
      FOR SELECT USING (auth.role() = 'authenticated');
    CREATE POLICY "Users can insert lego_parts" ON lego_parts
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    CREATE POLICY "Users can update lego_parts" ON lego_parts
      FOR UPDATE USING (auth.role() = 'authenticated');
    CREATE POLICY "Users can delete lego_parts" ON lego_parts
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 4. RLS 정책 상태 확인
SELECT 
  t.schemaname,
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public' 
  AND t.tablename IN ('synthetic_dataset', 'synthetic_part_stats', 'lego_sets', 'lego_parts')
GROUP BY t.schemaname, t.tablename, t.rowsecurity
ORDER BY t.tablename;
