-- 복잡도 재계산 (게이트 적용 버전)
-- 실제 복잡도 신호가 있을 때만 Medium/High 부여

UPDATE parts_master_features
SET
  complexity_level = CASE
    -- 0) 단순 부품 강제 Low (구조 신호 없을 때)
    WHEN (
      COALESCE(part_name,'') ~* '(glasses|accessory|hose|headlight|open\s*stud|tile|plate|bar\s*\d*L|round\s*1\s*x\s*1)'
      AND COALESCE(teeth_count, 0) = 0
      AND COALESCE(expected_hole_count, 0) = 0
    ) THEN 'low'

    -- 1) High 조건
    WHEN (
      -- Technic/기어류: 강한 구조 신호가 충분할 때만 High
      COALESCE(part_name,'') ~* '(technic|gear|axle|pin|connector|beam|bush|hub)'
      AND (
        COALESCE(jsonb_array_length(feature_json->'distinguishing_features'), 0) >= 3
        OR COALESCE(teeth_count, 0) >= 10
        OR COALESCE(expected_hole_count, 0) >= 4
        OR (
          COALESCE(jsonb_array_length(feature_json->'distinguishing_features'), 0) >= 2
          AND length(COALESCE(feature_text, '')) >= 90
        )
      )
    ) OR (
      -- 조형/동물/얼굴류: 구분 피처가 충분하고 텍스트 단서가 풍부할 때만 High
      COALESCE(part_name,'') ~* '(head|face|lion|animal|dolphin|dog|crab|fern|flower|plant)'
      AND COALESCE(jsonb_array_length(feature_json->'distinguishing_features'), 0) >= 3
      AND length(COALESCE(feature_text, '')) >= 80
    ) THEN 'high'

    -- 2) Medium 조건
    WHEN (
      -- Technic/구조 신호가 있으나 High 기준은 미달: Medium
      COALESCE(part_name,'') ~* '(technic|gear|axle|pin|connector|beam)'
      AND (
        COALESCE(jsonb_array_length(feature_json->'distinguishing_features'), 0) >= 3
        OR COALESCE(teeth_count, 0) >= 6
        OR COALESCE(expected_hole_count, 0) >= 2
      )
      AND length(COALESCE(feature_text, '')) >= 60
    ) OR (
      -- 프린트/스티커류는 독자적으로 복잡도를 올리지 않음. 충분한 피처+텍스트가 있을 때만 Medium
      COALESCE(part_name,'') ~* '(print|decorated|sticker|sheet)'
      AND COALESCE(jsonb_array_length(feature_json->'distinguishing_features'), 0) >= 3
      AND length(COALESCE(feature_text, '')) >= 70
    ) OR (
      -- 일반 부품: 최소 구분 피처 3개 이상 + 충분한 설명이 있을 때만 Medium
      COALESCE(jsonb_array_length(feature_json->'distinguishing_features'), 0) >= 3
      AND length(COALESCE(feature_text, '')) >= 60
    ) THEN 'medium'

    ELSE 'low'
  END,

  -- 수치형 복잡도: 실제 신호 중심의 보수적 가중치 (상향 기준에 맞춰 스케일 축소)
  semantic_complexity = LEAST(1.0, GREATEST(0.0,
    (CASE WHEN COALESCE(part_name,'') ~* '(technic|gear|axle|pin|connector|beam)' THEN 0.08 ELSE 0 END) +
    (CASE WHEN COALESCE(part_name,'') ~* '(head|face|lion|animal|dolphin|dog|crab|fern|flower|plant)' THEN 0.12 ELSE 0 END) +
    (LEAST(COALESCE(jsonb_array_length(feature_json->'distinguishing_features'), 0), 6) * 0.06) +
    (LEAST(length(COALESCE(feature_text, '')), 240) / 3000.0) +
    (CASE WHEN COALESCE(teeth_count, 0) >= 12 THEN 0.10 WHEN COALESCE(teeth_count, 0) >= 8 THEN 0.06 ELSE 0 END) +
    (CASE WHEN COALESCE(expected_hole_count, 0) >= 5 THEN 0.08 WHEN COALESCE(expected_hole_count, 0) >= 3 THEN 0.05 ELSE 0 END)
  ));

-- 업데이트 결과 확인
SELECT 
  complexity_level,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM parts_master_features 
GROUP BY complexity_level 
ORDER BY 
  CASE complexity_level 
    WHEN 'high' THEN 3 
    WHEN 'medium' THEN 2 
    WHEN 'low' THEN 1 
  END;

-- 전체 통계 확인
SELECT get_enhanced_recognition_stats();


