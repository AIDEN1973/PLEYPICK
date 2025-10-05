-- 간단한 복잡도 업데이트 (WHERE 조건 완화)
-- 모든 레코드에 대해 복잡도 재계산

UPDATE parts_master_features 
SET 
  complexity_level = CASE 
    WHEN (
      -- studCount (가중치: 0.1)
      (CASE WHEN feature_json->>'stud_count_top' ~ '^[0-9]+$' THEN (feature_json->>'stud_count_top')::int ELSE 0 END) * 0.1 +
      
      -- specialFeatures (가중치: 0.2)
      (CASE WHEN jsonb_array_length(feature_json->'distinguishing_features') IS NOT NULL THEN jsonb_array_length(feature_json->'distinguishing_features') ELSE 0 END) * 0.2 +
      
      -- descriptionLength (가중치: 1000)
      (CASE WHEN length(COALESCE(feature_text, '')) > 0 THEN length(COALESCE(feature_text, '')) ELSE 0 END) / 1000.0 +
      
      -- hasPrint (가중치: 0.3)
      (CASE WHEN COALESCE(part_name, '') ILIKE '%print%' OR COALESCE(part_name, '') ILIKE '%decorated%' THEN 0.3 ELSE 0 END) +
      
      -- hasAnimal (가중치: 0.4)
      (CASE WHEN COALESCE(part_name, '') ILIKE '%animal%' OR COALESCE(part_name, '') ILIKE '%dolphin%' OR COALESCE(part_name, '') ILIKE '%dog%' OR COALESCE(part_name, '') ILIKE '%crab%' OR COALESCE(part_name, '') ILIKE '%fern%' OR COALESCE(part_name, '') ILIKE '%flower%' OR COALESCE(part_name, '') ILIKE '%plant%' THEN 0.4 ELSE 0 END) +
      
      -- hasFood (가중치: 0.4)
      (CASE WHEN COALESCE(part_name, '') ILIKE '%food%' OR COALESCE(part_name, '') ILIKE '%hot dog%' OR COALESCE(part_name, '') ILIKE '%bun%' OR COALESCE(part_name, '') ILIKE '%cone%' OR COALESCE(part_name, '') ILIKE '%pizza%' THEN 0.4 ELSE 0 END) +
      
      -- hasEquipment (가중치: 0.3)
      (CASE WHEN COALESCE(part_name, '') ILIKE '%equipment%' OR COALESCE(part_name, '') ILIKE '%shovel%' OR COALESCE(part_name, '') ILIKE '%oar%' OR COALESCE(part_name, '') ILIKE '%goblet%' OR COALESCE(part_name, '') ILIKE '%umbrella%' OR COALESCE(part_name, '') ILIKE '%glasses%' THEN 0.3 ELSE 0 END) +
      
      -- hasSports (가중치: 0.4)
      (CASE WHEN COALESCE(part_name, '') ILIKE '%sports%' OR COALESCE(part_name, '') ILIKE '%surfboard%' OR COALESCE(part_name, '') ILIKE '%shuttle%' THEN 0.4 ELSE 0 END) +
      
      -- hasStorage (가중치: 0.3)
      (CASE WHEN COALESCE(part_name, '') ILIKE '%storage%' OR COALESCE(part_name, '') ILIKE '%case%' OR COALESCE(part_name, '') ILIKE '%divider%' THEN 0.3 ELSE 0 END) +
      
      -- hasSticker (가중치: 0.2)
      (CASE WHEN COALESCE(part_name, '') ILIKE '%sticker%' OR COALESCE(part_name, '') ILIKE '%sheet%' THEN 0.2 ELSE 0 END) +
      
      -- hasTechnic (가중치: 0.2)
      (CASE WHEN COALESCE(part_name, '') ILIKE '%technic%' OR COALESCE(part_name, '') ILIKE '%beam%' OR COALESCE(part_name, '') ILIKE '%axle%' OR COALESCE(part_name, '') ILIKE '%pin%' OR COALESCE(part_name, '') ILIKE '%connector%' OR COALESCE(part_name, '') ILIKE '%hub%' OR COALESCE(part_name, '') ILIKE '%bush%' THEN 0.2 ELSE 0 END)
    ) > 0.35 THEN 'high'
    WHEN (
      -- 동일한 계산식
      (CASE WHEN feature_json->>'stud_count_top' ~ '^[0-9]+$' THEN (feature_json->>'stud_count_top')::int ELSE 0 END) * 0.1 +
      (CASE WHEN jsonb_array_length(feature_json->'distinguishing_features') IS NOT NULL THEN jsonb_array_length(feature_json->'distinguishing_features') ELSE 0 END) * 0.2 +
      (CASE WHEN length(COALESCE(feature_text, '')) > 0 THEN length(COALESCE(feature_text, '')) ELSE 0 END) / 1000.0 +
      (CASE WHEN COALESCE(part_name, '') ILIKE '%print%' OR COALESCE(part_name, '') ILIKE '%decorated%' THEN 0.3 ELSE 0 END) +
      (CASE WHEN COALESCE(part_name, '') ILIKE '%animal%' OR COALESCE(part_name, '') ILIKE '%dolphin%' OR COALESCE(part_name, '') ILIKE '%dog%' OR COALESCE(part_name, '') ILIKE '%crab%' OR COALESCE(part_name, '') ILIKE '%fern%' OR COALESCE(part_name, '') ILIKE '%flower%' OR COALESCE(part_name, '') ILIKE '%plant%' THEN 0.4 ELSE 0 END) +
      (CASE WHEN COALESCE(part_name, '') ILIKE '%food%' OR COALESCE(part_name, '') ILIKE '%hot dog%' OR COALESCE(part_name, '') ILIKE '%bun%' OR COALESCE(part_name, '') ILIKE '%cone%' OR COALESCE(part_name, '') ILIKE '%pizza%' THEN 0.4 ELSE 0 END) +
      (CASE WHEN COALESCE(part_name, '') ILIKE '%equipment%' OR COALESCE(part_name, '') ILIKE '%shovel%' OR COALESCE(part_name, '') ILIKE '%oar%' OR COALESCE(part_name, '') ILIKE '%goblet%' OR COALESCE(part_name, '') ILIKE '%umbrella%' OR COALESCE(part_name, '') ILIKE '%glasses%' THEN 0.3 ELSE 0 END) +
      (CASE WHEN COALESCE(part_name, '') ILIKE '%sports%' OR COALESCE(part_name, '') ILIKE '%surfboard%' OR COALESCE(part_name, '') ILIKE '%shuttle%' THEN 0.4 ELSE 0 END) +
      (CASE WHEN COALESCE(part_name, '') ILIKE '%storage%' OR COALESCE(part_name, '') ILIKE '%case%' OR COALESCE(part_name, '') ILIKE '%divider%' THEN 0.3 ELSE 0 END) +
      (CASE WHEN COALESCE(part_name, '') ILIKE '%sticker%' OR COALESCE(part_name, '') ILIKE '%sheet%' THEN 0.2 ELSE 0 END) +
      (CASE WHEN COALESCE(part_name, '') ILIKE '%technic%' OR COALESCE(part_name, '') ILIKE '%beam%' OR COALESCE(part_name, '') ILIKE '%axle%' OR COALESCE(part_name, '') ILIKE '%pin%' OR COALESCE(part_name, '') ILIKE '%connector%' OR COALESCE(part_name, '') ILIKE '%hub%' OR COALESCE(part_name, '') ILIKE '%bush%' THEN 0.2 ELSE 0 END)
    ) > 0.15 THEN 'medium'
    ELSE 'low'
  END,
  
  semantic_complexity = GREATEST(0, LEAST(1, 
    (CASE WHEN feature_json->>'stud_count_top' ~ '^[0-9]+$' THEN (feature_json->>'stud_count_top')::int ELSE 0 END) * 0.1 +
    (CASE WHEN jsonb_array_length(feature_json->'distinguishing_features') IS NOT NULL THEN jsonb_array_length(feature_json->'distinguishing_features') ELSE 0 END) * 0.2 +
    (CASE WHEN length(COALESCE(feature_text, '')) > 0 THEN length(COALESCE(feature_text, '')) ELSE 0 END) / 1000.0 +
    (CASE WHEN COALESCE(part_name, '') ILIKE '%print%' OR COALESCE(part_name, '') ILIKE '%decorated%' THEN 0.3 ELSE 0 END) +
    (CASE WHEN COALESCE(part_name, '') ILIKE '%animal%' OR COALESCE(part_name, '') ILIKE '%dolphin%' OR COALESCE(part_name, '') ILIKE '%dog%' OR COALESCE(part_name, '') ILIKE '%crab%' OR COALESCE(part_name, '') ILIKE '%fern%' OR COALESCE(part_name, '') ILIKE '%flower%' OR COALESCE(part_name, '') ILIKE '%plant%' THEN 0.4 ELSE 0 END) +
    (CASE WHEN COALESCE(part_name, '') ILIKE '%food%' OR COALESCE(part_name, '') ILIKE '%hot dog%' OR COALESCE(part_name, '') ILIKE '%bun%' OR COALESCE(part_name, '') ILIKE '%cone%' OR COALESCE(part_name, '') ILIKE '%pizza%' THEN 0.4 ELSE 0 END) +
    (CASE WHEN COALESCE(part_name, '') ILIKE '%equipment%' OR COALESCE(part_name, '') ILIKE '%shovel%' OR COALESCE(part_name, '') ILIKE '%oar%' OR COALESCE(part_name, '') ILIKE '%goblet%' OR COALESCE(part_name, '') ILIKE '%umbrella%' OR COALESCE(part_name, '') ILIKE '%glasses%' THEN 0.3 ELSE 0 END) +
    (CASE WHEN COALESCE(part_name, '') ILIKE '%sports%' OR COALESCE(part_name, '') ILIKE '%surfboard%' OR COALESCE(part_name, '') ILIKE '%shuttle%' THEN 0.4 ELSE 0 END) +
    (CASE WHEN COALESCE(part_name, '') ILIKE '%storage%' OR COALESCE(part_name, '') ILIKE '%case%' OR COALESCE(part_name, '') ILIKE '%divider%' THEN 0.3 ELSE 0 END) +
    (CASE WHEN COALESCE(part_name, '') ILIKE '%sticker%' OR COALESCE(part_name, '') ILIKE '%sheet%' THEN 0.2 ELSE 0 END) +
    (CASE WHEN COALESCE(part_name, '') ILIKE '%technic%' OR COALESCE(part_name, '') ILIKE '%beam%' OR COALESCE(part_name, '') ILIKE '%axle%' OR COALESCE(part_name, '') ILIKE '%pin%' OR COALESCE(part_name, '') ILIKE '%connector%' OR COALESCE(part_name, '') ILIKE '%hub%' OR COALESCE(part_name, '') ILIKE '%bush%' THEN 0.2 ELSE 0 END)
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
