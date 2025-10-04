-- 간단한 Storage 정책 설정 (권한이 있는 경우만)

-- 1. 현재 정책 확인
SELECT policyname, cmd, roles, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 2. RLS 상태 확인
SELECT rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 3. 현재 사용자 확인
SELECT current_user, session_user;
