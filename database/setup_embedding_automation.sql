-- ============================================
-- BrickBox 임베딩 자동화 시스템
-- 실행 시간: 약 10초
-- 목적: 트리거 기반 자동 임베딩 생성
-- ============================================

BEGIN;

-- 1. embedding_status 컬럼 추가
ALTER TABLE parts_master_features
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending';

-- 기존 레코드 상태 설정
-- clip_text_emb가 vector 타입이므로 TEXT로 캐스팅하여 확인
UPDATE parts_master_features
SET embedding_status = CASE
    -- 임베딩이 NULL인 경우
    WHEN clip_text_emb IS NULL THEN 'pending'
    -- 임베딩이 0 벡터인 경우 (TEXT로 변환하여 확인)
    WHEN clip_text_emb::TEXT LIKE '[0,0,0,0%' THEN 'pending'
    -- 정상 임베딩 (completed)
    ELSE 'completed'
END
WHERE embedding_status IS NULL OR embedding_status = '';

-- 2. 인덱스 추가 (워커 성능)
CREATE INDEX IF NOT EXISTS idx_embedding_status 
ON parts_master_features (embedding_status)
WHERE embedding_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_embedding_updated
ON parts_master_features (updated_at DESC)
WHERE embedding_status = 'pending';

-- 3. 트리거 함수 생성
CREATE OR REPLACE FUNCTION trg_embedding_pending()
RETURNS TRIGGER AS $$
BEGIN
    -- feature_text가 변경되거나 새로 생성되면 pending 설정
    IF TG_OP = 'INSERT' THEN
        IF NEW.feature_text IS NOT NULL AND NEW.feature_text != '' THEN
            NEW.embedding_status = 'pending';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.feature_text IS DISTINCT FROM OLD.feature_text THEN
            NEW.embedding_status = 'pending';
            RAISE NOTICE '임베딩 재생성 예약: part_id=%, feature_text=%', 
                NEW.part_id, LEFT(NEW.feature_text, 30);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성
DROP TRIGGER IF EXISTS trg_auto_embedding ON parts_master_features;
CREATE TRIGGER trg_auto_embedding
BEFORE INSERT OR UPDATE OF feature_text ON parts_master_features
FOR EACH ROW
EXECUTE FUNCTION trg_embedding_pending();

-- 5. 통계 뷰 생성
CREATE OR REPLACE VIEW v_embedding_status AS
SELECT 
    embedding_status,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM parts_master_features
GROUP BY embedding_status
ORDER BY count DESC;

-- 6. 작업 큐 뷰 생성 (워커용)
CREATE OR REPLACE VIEW v_embedding_queue AS
SELECT 
    id,
    part_id,
    color_id,
    feature_text,
    recognition_hints,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) AS age_seconds
FROM parts_master_features
WHERE embedding_status = 'pending'
  AND feature_text IS NOT NULL
  AND feature_text != ''
ORDER BY updated_at ASC
LIMIT 1000;

COMMIT;

-- 7. 결과 확인
SELECT 
    '========================================' AS separator
UNION ALL
SELECT '임베딩 자동화 시스템 설정 완료'
UNION ALL
SELECT '========================================'
UNION ALL
SELECT 
    'embedding_status 컬럼: ✅ 추가됨'
UNION ALL
SELECT 
    '트리거 함수: ✅ trg_embedding_pending()'
UNION ALL
SELECT 
    '트리거: ✅ trg_auto_embedding'
UNION ALL
SELECT 
    '인덱스: ✅ idx_embedding_status, idx_embedding_updated'
UNION ALL
SELECT 
    '뷰: ✅ v_embedding_status, v_embedding_queue'
UNION ALL
SELECT '========================================';

-- 8. 상태 확인
SELECT * FROM v_embedding_status;

-- 9. 큐 샘플 확인
SELECT 
    part_id,
    LEFT(feature_text, 40) AS feature_text,
    age_seconds,
    CASE 
        WHEN age_seconds < 60 THEN '🟢 신규'
        WHEN age_seconds < 3600 THEN '🟡 1시간 이내'
        ELSE '🔴 오래됨'
    END AS priority
FROM v_embedding_queue
LIMIT 5;

-- 성공 메시지
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 임베딩 자동화 시스템 준비 완료!';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계:';
    RAISE NOTICE '  1. python scripts/embedding_worker.py';
    RAISE NOTICE '  2. 워커가 pending 항목 자동 처리';
    RAISE NOTICE '';
    RAISE NOTICE '상태 확인:';
    RAISE NOTICE '  SELECT * FROM v_embedding_status;';
    RAISE NOTICE '  SELECT * FROM v_embedding_queue LIMIT 10;';
    RAISE NOTICE '========================================';
END $$;

