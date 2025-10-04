-- pgvector 확장 활성화
-- Supabase에서는 이미 활성화되어 있을 수 있지만, 로컬 PostgreSQL에서는 필요

-- 1. pgvector 확장 설치 (로컬 PostgreSQL의 경우)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 확장 상태 확인
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 3. 벡터 타입 사용 가능 여부 확인
SELECT typname FROM pg_type WHERE typname = 'vector';

-- 4. 벡터 연산자 확인
SELECT oprname, oprleft::regtype, oprright::regtype 
FROM pg_operator 
WHERE oprname IN ('<->', '<#>', '<=>') 
AND oprleft::regtype::text LIKE '%vector%';
