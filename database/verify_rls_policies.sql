-- RLS 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'image_metadata'
ORDER BY policyname;
