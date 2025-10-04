-- 업로드된 이미지 메타데이터 확인
SELECT 
    part_num,
    color_id,
    supabase_url,
    created_at
FROM image_metadata 
WHERE part_num IN ('3437', '40666', '84210pr0002', '110432pr0001', '35114')
ORDER BY created_at DESC;
