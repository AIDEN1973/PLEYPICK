-- 기존 레코드의 복잡도 재계산 및 업데이트
-- 개선된 복잡도 로직 적용

UPDATE parts_master_features 
SET 
  complexity_level = CASE 
    WHEN (
      -- studCount (개선된 가중치: 0.1)
      (CASE WHEN feature_json->>'stud_count_top' ~ '^[0-9]+$' THEN (feature_json->>'stud_count_top')::int ELSE 0 END) * 0.1 +
      
      -- specialFeatures (개선된 가중치: 0.2, 키워드 확장)
      (CASE WHEN jsonb_array_length(feature_json->'distinguishing_features') IS NOT NULL THEN jsonb_array_length(feature_json->'distinguishing_features') ELSE 0 END) * 0.2 +
      
      -- descriptionLength (개선된 가중치: 1000)
      (CASE WHEN length(feature_text) > 0 THEN length(feature_text) ELSE 0 END) / 1000.0 +
      
      -- hasPrint (조정된 가중치: 0.3)
      (CASE WHEN part_name ILIKE '%print%' OR part_name ILIKE '%decorated%' THEN 0.3 ELSE 0 END) +
      
      -- hasAnimal (증가된 가중치: 0.4)
      (CASE WHEN part_name ILIKE '%animal%' OR part_name ILIKE '%dolphin%' OR part_name ILIKE '%dog%' OR part_name ILIKE '%crab%' OR part_name ILIKE '%fern%' OR part_name ILIKE '%flower%' OR part_name ILIKE '%plant%' THEN 0.4 ELSE 0 END) +
      
      -- hasFood (증가된 가중치: 0.4)
      (CASE WHEN part_name ILIKE '%food%' OR part_name ILIKE '%hot dog%' OR part_name ILIKE '%bun%' OR part_name ILIKE '%cone%' OR part_name ILIKE '%pizza%' THEN 0.4 ELSE 0 END) +
      
      -- hasEquipment (증가된 가중치: 0.3)
      (CASE WHEN part_name ILIKE '%equipment%' OR part_name ILIKE '%shovel%' OR part_name ILIKE '%oar%' OR part_name ILIKE '%goblet%' OR part_name ILIKE '%umbrella%' OR part_name ILIKE '%glasses%' THEN 0.3 ELSE 0 END) +
      
      -- hasSports (증가된 가중치: 0.4)
      (CASE WHEN part_name ILIKE '%sports%' OR part_name ILIKE '%surfboard%' OR part_name ILIKE '%shuttle%' THEN 0.4 ELSE 0 END) +
      
      -- hasStorage (증가된 가중치: 0.3)
      (CASE WHEN part_name ILIKE '%storage%' OR part_name ILIKE '%case%' OR part_name ILIKE '%divider%' THEN 0.3 ELSE 0 END) +
      
      -- hasSticker (증가된 가중치: 0.2)
      (CASE WHEN part_name ILIKE '%sticker%' OR part_name ILIKE '%sheet%' THEN 0.2 ELSE 0 END) +
      
      -- hasTechnic (새로 추가: 0.2)
      (CASE WHEN part_name ILIKE '%technic%' OR part_name ILIKE '%beam%' OR part_name ILIKE '%axle%' OR part_name ILIKE '%pin%' OR part_name ILIKE '%connector%' OR part_name ILIKE '%hub%' OR part_name ILIKE '%bush%' THEN 0.2 ELSE 0 END)
    ) > 0.35 THEN 'high'
    WHEN (
      -- 동일한 계산식
      (CASE WHEN feature_json->>'stud_count_top' ~ '^[0-9]+$' THEN (feature_json->>'stud_count_top')::int ELSE 0 END) * 0.1 +
      (CASE WHEN jsonb_array_length(feature_json->'distinguishing_features') IS NOT NULL THEN jsonb_array_length(feature_json->'distinguishing_features') ELSE 0 END) * 0.2 +
      (CASE WHEN length(feature_text) > 0 THEN length(feature_text) ELSE 0 END) / 1000.0 +
      (CASE WHEN part_name ILIKE '%print%' OR part_name ILIKE '%decorated%' THEN 0.3 ELSE 0 END) +
      (CASE WHEN part_name ILIKE '%animal%' OR part_name ILIKE '%dolphin%' OR part_name ILIKE '%dog%' OR part_name ILIKE '%crab%' OR part_name ILIKE '%fern%' OR part_name ILIKE '%flower%' OR part_name ILIKE '%plant%' THEN 0.4 ELSE 0 END) +
      (CASE WHEN part_name ILIKE '%food%' OR part_name ILIKE '%hot dog%' OR part_name ILIKE '%bun%' OR part_name ILIKE '%cone%' OR part_name ILIKE '%pizza%' THEN 0.4 ELSE 0 END) +
      (CASE WHEN part_name ILIKE '%equipment%' OR part_name ILIKE '%shovel%' OR part_name ILIKE '%oar%' OR part_name ILIKE '%goblet%' OR part_name ILIKE '%umbrella%' OR part_name ILIKE '%glasses%' THEN 0.3 ELSE 0 END) +
      (CASE WHEN part_name ILIKE '%sports%' OR part_name ILIKE '%surfboard%' OR part_name ILIKE '%shuttle%' THEN 0.4 ELSE 0 END) +
      (CASE WHEN part_name ILIKE '%storage%' OR part_name ILIKE '%case%' OR part_name ILIKE '%divider%' THEN 0.3 ELSE 0 END) +
      (CASE WHEN part_name ILIKE '%sticker%' OR part_name ILIKE '%sheet%' THEN 0.2 ELSE 0 END) +
      (CASE WHEN part_name ILIKE '%technic%' OR part_name ILIKE '%beam%' OR part_name ILIKE '%axle%' OR part_name ILIKE '%pin%' OR part_name ILIKE '%connector%' OR part_name ILIKE '%hub%' OR part_name ILIKE '%bush%' THEN 0.2 ELSE 0 END)
    ) > 0.15 THEN 'medium'
    ELSE 'low'
  END,
  
  semantic_complexity = GREATEST(0, LEAST(1, 
    (CASE WHEN feature_json->>'stud_count_top' ~ '^[0-9]+$' THEN (feature_json->>'stud_count_top')::int ELSE 0 END) * 0.1 +
    (CASE WHEN jsonb_array_length(feature_json->'distinguishing_features') IS NOT NULL THEN jsonb_array_length(feature_json->'distinguishing_features') ELSE 0 END) * 0.2 +
    (CASE WHEN length(feature_text) > 0 THEN length(feature_text) ELSE 0 END) / 1000.0 +
    (CASE WHEN part_name ILIKE '%print%' OR part_name ILIKE '%decorated%' THEN 0.3 ELSE 0 END) +
    (CASE WHEN part_name ILIKE '%animal%' OR part_name ILIKE '%dolphin%' OR part_name ILIKE '%dog%' OR part_name ILIKE '%crab%' OR part_name ILIKE '%fern%' OR part_name ILIKE '%flower%' OR part_name ILIKE '%plant%' THEN 0.4 ELSE 0 END) +
    (CASE WHEN part_name ILIKE '%food%' OR part_name ILIKE '%hot dog%' OR part_name ILIKE '%bun%' OR part_name ILIKE '%cone%' OR part_name ILIKE '%pizza%' THEN 0.4 ELSE 0 END) +
    (CASE WHEN part_name ILIKE '%equipment%' OR part_name ILIKE '%shovel%' OR part_name ILIKE '%oar%' OR part_name ILIKE '%goblet%' OR part_name ILIKE '%umbrella%' OR part_name ILIKE '%glasses%' THEN 0.3 ELSE 0 END) +
    (CASE WHEN part_name ILIKE '%sports%' OR part_name ILIKE '%surfboard%' OR part_name ILIKE '%shuttle%' THEN 0.4 ELSE 0 END) +
    (CASE WHEN part_name ILIKE '%storage%' OR part_name ILIKE '%case%' OR part_name ILIKE '%divider%' THEN 0.3 ELSE 0 END) +
    (CASE WHEN part_name ILIKE '%sticker%' OR part_name ILIKE '%sheet%' THEN 0.2 ELSE 0 END) +
    (CASE WHEN part_name ILIKE '%technic%' OR part_name ILIKE '%beam%' OR part_name ILIKE '%axle%' OR part_name ILIKE '%pin%' OR part_name ILIKE '%connector%' OR part_name ILIKE '%hub%' OR part_name ILIKE '%bush%' THEN 0.2 ELSE 0 END)
  )
WHERE part_name IS NOT NULL 
  AND part_name != '' 
  AND feature_text IS NOT NULL 
  AND feature_text != ''
  AND feature_json IS NOT NULL;

-- 업데이트 결과 확인
SELECT 
  complexity_level,
  COUNT(*) as count,
  ROUND(AVG(semantic_complexity), 3) as avg_complexity,
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
