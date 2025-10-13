-- ============================================
-- BrickBox 메타데이터 P1 개선 (단기)
-- 실행 시간: 약 1분 (10건 기준)
-- 목적: 품질 개선 및 중복 제거
-- ============================================

BEGIN;

-- 1. feature_text 재생성 (템플릿 기반)
UPDATE parts_master_features
SET 
    feature_text = CASE 
        -- 듀플로 브릭
        WHEN part_id = '3437' AND color_id = 10 
        THEN '듀플로 2x4 브릭, 홈 없음, 평평한 표면'
        
        -- 프린트 플레이트
        WHEN part_id = '53920pr0003' 
        THEN '2x4 플레이트, 홈 없음, 프린트 디자인'
        
        WHEN part_id = '109575pr0002' 
        THEN '2x4 플레이트, 홈 없음, 프린트 디자인'
        
        -- 듀플로 브릭판
        WHEN part_id = '98233' 
        THEN '듀플로 2x6 브릭판, 홈 없음, 평평한 표면'
        
        -- 일반 플레이트
        WHEN part_id = '3118' 
        THEN '2x4 플레이트, 홈 없음, 평평한 표면'
        
        WHEN part_id = '40666' 
        THEN '2x4 플레이트, 홈 없음, 평평한 표면'
        
        WHEN part_id = '3437' AND color_id = 41 
        THEN '듀플로 2x4 브릭, 홈 없음, 평평한 표면'
        
        -- 듀플로 피규어
        WHEN part_id = '84210pr0002' 
        THEN '듀플로 아기 펭귄 피규어, 부리 프린트, 밝은 회색'
        
        WHEN part_id = '110432pr0001' 
        THEN '듀플로 펭귄 피규어, 검은색/흰색/노란색, 프린트'
        
        -- 경사 플레이트
        WHEN part_id = '35114' 
        THEN '2x4 경사 플레이트, 홈 없음, 각도형'
        
        ELSE feature_text
    END,
    updated_at = NOW()
WHERE id BETWEEN 2124 AND 2133;

-- 2. recognition_hints 보완 (영어 번역 추가)
UPDATE parts_master_features
SET 
    recognition_hints = recognition_hints || jsonb_build_object(
        'en', CASE 
            WHEN part_id LIKE '%3437%' THEN 'Duplo 2x4 brick, flat surface without groove'
            WHEN part_id LIKE '%98233%' THEN 'Duplo 2x6 brick plate, no groove, flat surface'
            WHEN part_id LIKE '%84210%' THEN 'Duplo baby penguin figure, beak print, bright bluish gray'
            WHEN part_id LIKE '%110432%' THEN 'Duplo penguin figure, black/white/yellow colors, printed'
            ELSE '2x4 plate, no groove, flat surface'
        END
    )
WHERE id BETWEEN 2124 AND 2133
  AND (recognition_hints->>'en' = '' OR recognition_hints->>'en' IS NULL);

-- 3. confusion_groups 정규화
UPDATE parts_master_features
SET 
    confusion_groups = ARRAY[confusions]
WHERE id BETWEEN 2124 AND 2133
  AND confusions IS NOT NULL
  AND array_length(confusions, 1) > 0
  AND (confusion_groups IS NULL OR confusion_groups = '{}');

-- 4. Zero 값 NULL 처리 (압축 효율)
UPDATE parts_master_features
SET 
    score_geo = NULLIF(score_geo::NUMERIC, 0),
    score_struct = NULLIF(score_struct::NUMERIC, 0),
    score_sem = NULLIF(score_sem::NUMERIC, 0),
    score_final = NULLIF(score_final::NUMERIC, 0),
    precision_score = NULLIF(precision_score::NUMERIC, 0),
    recall_score = NULLIF(recall_score::NUMERIC, 0),
    top2_margin = NULLIF(top2_margin::NUMERIC, 0),
    usage_frequency = NULLIF(usage_frequency, 0),
    detection_accuracy = NULLIF(detection_accuracy, 0),
    core_matches = NULLIF(core_matches, 0)
WHERE id BETWEEN 2124 AND 2133;

-- 5. 결과 확인
SELECT 
    '========================================' AS separator
UNION ALL
SELECT 'P1 개선 결과'
UNION ALL
SELECT '========================================'
UNION ALL
SELECT 
    'feature_text 품질: ' || 
    COUNT(CASE WHEN LENGTH(feature_text) > 20 THEN 1 END) || '/' || COUNT(*) || ' 건 양호'
FROM parts_master_features
WHERE id BETWEEN 2124 AND 2133
UNION ALL
SELECT 
    'recognition_hints 영어: ' ||
    COUNT(CASE WHEN recognition_hints->>'en' != '' THEN 1 END) || '/' || COUNT(*) || ' 건 추가'
FROM parts_master_features
WHERE id BETWEEN 2124 AND 2133
UNION ALL
SELECT 
    'confusion_groups 정규화: ' ||
    COUNT(CASE WHEN confusion_groups IS NOT NULL THEN 1 END) || '/' || COUNT(*) || ' 건 완료'
FROM parts_master_features
WHERE id BETWEEN 2124 AND 2133
UNION ALL
SELECT '========================================';

-- 6. 샘플 출력
SELECT 
    part_id,
    feature_text,
    recognition_hints->>'ko' AS hint_ko,
    recognition_hints->>'en' AS hint_en,
    confusion_groups
FROM parts_master_features
WHERE id BETWEEN 2124 AND 2133
ORDER BY id
LIMIT 3;

COMMIT;

-- 성공 메시지
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ P1 개선 완료!';
    RAISE NOTICE '  - feature_text 재생성';
    RAISE NOTICE '  - recognition_hints 영어 추가';
    RAISE NOTICE '  - confusion_groups 정규화';
    RAISE NOTICE '  - Zero 값 NULL 처리';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계 (선택):';
    RAISE NOTICE '  psql -f fix_metadata_p2.sql';
    RAISE NOTICE '========================================';
END $$;

