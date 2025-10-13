-- 테이블을 안전하게 비우는 함수 생성
-- RLS 정책을 우회하여 데이터를 삭제할 수 있습니다

CREATE OR REPLACE FUNCTION truncate_table(table_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- 테이블 존재 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = $1
  ) THEN
    RETURN 'Table ' || $1 || ' does not exist';
  END IF;
  
  -- 테이블 비우기
  EXECUTE 'DELETE FROM ' || $1;
  
  -- 시퀀스 리셋 (해당하는 경우)
  IF EXISTS (
    SELECT 1 FROM information_schema.sequences 
    WHERE sequence_name = $1 || '_id_seq'
  ) THEN
    EXECUTE 'ALTER SEQUENCE ' || $1 || '_id_seq RESTART WITH 1';
  END IF;
  
  RETURN 'Table ' || $1 || ' truncated successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION truncate_table(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION truncate_table(TEXT) TO anon;
