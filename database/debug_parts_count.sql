-- 특정 세트의 부품 수 디버깅 쿼리
-- Supabase Dashboard의 SQL Editor에서 실행하세요

-- 1. 특정 세트의 부품 수 확인 (21247-1)
SELECT 
    ls.set_num,
    ls.name,
    COUNT(sp.id) as total_parts_count
FROM lego_sets ls
LEFT JOIN set_parts sp ON ls.id = sp.set_id
WHERE ls.set_num = '21247-1'
GROUP BY ls.id, ls.set_num, ls.name;

-- 2. 세트별 부품 수 상세 정보
SELECT 
    ls.set_num,
    ls.name,
    ls.num_parts as expected_parts,
    COUNT(sp.id) as actual_parts_in_db,
    COUNT(DISTINCT sp.part_id) as unique_parts,
    COUNT(DISTINCT sp.color_id) as unique_colors
FROM lego_sets ls
LEFT JOIN set_parts sp ON ls.id = sp.set_id
WHERE ls.set_num = '21247-1'
GROUP BY ls.id, ls.set_num, ls.name, ls.num_parts;

-- 3. 부품별 상세 정보 (처음 10개만)
SELECT 
    sp.id,
    lp.part_num,
    lp.name as part_name,
    lc.name as color_name,
    sp.quantity,
    sp.element_id
FROM lego_sets ls
JOIN set_parts sp ON ls.id = sp.set_id
JOIN lego_parts lp ON sp.part_id = lp.id
JOIN lego_colors lc ON sp.color_id = lc.id
WHERE ls.set_num = '21247-1'
ORDER BY lp.part_num, lc.name
LIMIT 10;

-- 4. 색상별 부품 수
SELECT 
    lc.name as color_name,
    COUNT(sp.id) as parts_count
FROM lego_sets ls
JOIN set_parts sp ON ls.id = sp.set_id
JOIN lego_colors lc ON sp.color_id = lc.id
WHERE ls.set_num = '21247-1'
GROUP BY lc.id, lc.name
ORDER BY parts_count DESC;

-- 5. 부품별 색상 수
SELECT 
    lp.part_num,
    lp.name as part_name,
    COUNT(DISTINCT sp.color_id) as color_variants,
    SUM(sp.quantity) as total_quantity
FROM lego_sets ls
JOIN set_parts sp ON ls.id = sp.set_id
JOIN lego_parts lp ON sp.part_id = lp.id
WHERE ls.set_num = '21247-1'
GROUP BY lp.id, lp.part_num, lp.name
ORDER BY color_variants DESC, total_quantity DESC;
