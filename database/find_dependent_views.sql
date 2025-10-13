-- ============================================
-- clip_text_emb 컬럼을 사용하는 모든 뷰 찾기
-- ============================================

SELECT DISTINCT
    dependent_view.relname AS view_name,
    pg_get_viewdef(dependent_view.oid, true) AS view_definition
FROM pg_depend 
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
JOIN pg_attribute ON pg_depend.refobjid = pg_attribute.attrelid 
    AND pg_depend.refobjsubid = pg_attribute.attnum 
WHERE 
    source_table.relname = 'parts_master_features'
    AND pg_attribute.attname IN ('clip_text_emb', 'semantic_vector')
    AND dependent_view.relkind = 'v'
ORDER BY view_name;

