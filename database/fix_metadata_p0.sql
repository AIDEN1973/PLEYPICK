-- ============================================
-- BrickBox 메타데이터 P0 수정 (긴급)
-- 실행 시간: 약 30초 (10건 기준)
-- 목적: 데이터 정합성 복구
-- ============================================

BEGIN;

-- 1. 현재 상태 확인
DO $$
DECLARE
    total_count INTEGER;
    broken_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM parts_master_features
    WHERE id BETWEEN 2124 AND 2133;
    
    SELECT COUNT(*) INTO broken_count
    FROM parts_master_features
    WHERE id BETWEEN 2124 AND 2133
      AND expected_stud_count = 0
      AND (feature_json->>'stud_count_top')::INTEGER > 0;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '총 부품 수: %', total_count;
    RAISE NOTICE '수정 필요: % 건 (%.1f%%)', broken_count, (broken_count::NUMERIC / total_count * 100);
    RAISE NOTICE '========================================';
END $$;

-- 2. 데이터 정합성 복구 (feature_json → DB 필드)
UPDATE parts_master_features
SET 
    expected_stud_count = COALESCE(
        (feature_json->>'stud_count_top')::INTEGER,
        expected_stud_count,
        0
    ),
    expected_hole_count = COALESCE(
        (feature_json->>'tube_count_bottom')::INTEGER,
        expected_hole_count,
        0
    ),
    stud_count_top = COALESCE(
        (feature_json->>'stud_count_top')::INTEGER,
        stud_count_top,
        0
    ),
    tube_count_bottom = COALESCE(
        (feature_json->>'tube_count_bottom')::INTEGER,
        tube_count_bottom,
        0
    ),
    updated_at = NOW()
WHERE id BETWEEN 2124 AND 2133
  AND expected_stud_count = 0;

-- 3. 검증
DO $$
DECLARE
    mismatch_count INTEGER;
    success_count INTEGER;
BEGIN
    -- 불일치 건수
    SELECT COUNT(*) INTO mismatch_count
    FROM parts_master_features
    WHERE id BETWEEN 2124 AND 2133
      AND (
          (feature_json->>'stud_count_top')::INTEGER != expected_stud_count
          OR (feature_json->>'tube_count_bottom')::INTEGER != expected_hole_count
      );
    
    -- 성공 건수
    SELECT COUNT(*) INTO success_count
    FROM parts_master_features
    WHERE id BETWEEN 2124 AND 2133
      AND expected_stud_count > 0;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 수정 완료: % 건', success_count;
    RAISE NOTICE '❌ 불일치: % 건', mismatch_count;
    RAISE NOTICE '========================================';
    
    IF mismatch_count > 0 THEN
        RAISE EXCEPTION '❌ 정합성 검증 실패: % 건 불일치', mismatch_count;
    END IF;
    
    RAISE NOTICE '✅ P0 수정 완료: 모든 필드 일치 확인';
END $$;

-- 4. 결과 확인
SELECT 
    part_id,
    part_name,
    (feature_json->>'stud_count_top')::INTEGER AS json_stud,
    expected_stud_count AS db_stud,
    (feature_json->>'tube_count_bottom')::INTEGER AS json_hole,
    expected_hole_count AS db_hole,
    CASE 
        WHEN (feature_json->>'stud_count_top')::INTEGER = expected_stud_count 
         AND (feature_json->>'tube_count_bottom')::INTEGER = expected_hole_count
        THEN '✅ OK' 
        ELSE '❌ FAIL' 
    END AS status
FROM parts_master_features
WHERE id BETWEEN 2124 AND 2133
ORDER BY id;

COMMIT;

-- 최종 메시지
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 P0 수정 완료!';
    RAISE NOTICE '다음 단계: python generate_embeddings.py';
    RAISE NOTICE '========================================';
END $$;

