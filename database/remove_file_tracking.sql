-- Supabase에서 file_duplicates 관련 테이블과 함수 제거
-- 이 스크립트는 Supabase Dashboard의 SQL Editor에서 실행하세요

-- 1. 함수들 제거
DROP FUNCTION IF EXISTS get_duplicate_files(TEXT);
DROP FUNCTION IF EXISTS get_duplicate_stats();

-- 2. file_duplicates 테이블 제거 (CASCADE로 관련 객체들도 함께 제거)
DROP TABLE IF EXISTS file_duplicates CASCADE;

-- 3. 확인 쿼리 (실행 후 확인용)
-- 다음 쿼리들이 오류 없이 실행되면 제거가 완료된 것입니다:

-- 테이블 존재 확인 (결과가 없어야 함)
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'file_duplicates';

-- 함수 존재 확인 (결과가 없어야 함)
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_duplicate_files', 'get_duplicate_stats');

-- 완료 메시지
SELECT 'file_duplicates 테이블과 관련 함수들이 성공적으로 제거되었습니다.' as message;
