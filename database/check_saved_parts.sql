-- 저장된 부품 수 확인 쿼리
-- Supabase Dashboard의 SQL Editor에서 실행하세요

-- 1. 특정 세트의 저장된 부품 수 확인
SELECT 
    ls.set_num,
    ls.name as set_name,
    COUNT(sp.id) as saved_parts_count
FROM lego_sets ls
LEFT JOIN set_parts sp ON ls.id = sp.set_id
WHERE ls.set_num = '21247-1'
GROUP BY ls.id, ls.set_num, ls.name;

-- 2. 세트별 저장된 부품 상세 정보
SELECT 
    ls.set_num,
    ls.name as set_name,
    lp.part_num,
    lc.name as color_name,
    sp.quantity,
    sp.element_id
FROM lego_sets ls
JOIN set_parts sp ON ls.id = sp.set_id
JOIN lego_parts lp ON sp.part_id = lp.id
JOIN lego_colors lc ON sp.color_id = lc.id
WHERE ls.set_num = '21247-1'
ORDER BY lp.part_num, lc.name;

-- 3. 전체 저장된 세트 목록
SELECT 
    set_num,
    name,
    year,
    num_parts,
    created_at
FROM lego_sets
ORDER BY created_at DESC;

-- 4. 최근 저장된 세트의 부품 통계
SELECT 
    ls.set_num,
    ls.name,
    COUNT(DISTINCT sp.part_id) as unique_parts,
    COUNT(sp.id) as total_part_entries,
    SUM(sp.quantity) as total_quantity
FROM lego_sets ls
LEFT JOIN set_parts sp ON ls.id = sp.set_id
WHERE ls.set_num = '21247-1'
GROUP BY ls.id, ls.set_num, ls.name;
