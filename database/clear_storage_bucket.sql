-- Supabase Storage 버킷의 모든 이미지 제거
-- lego_parts_images 버킷의 모든 파일 삭제

-- 1. part_images 테이블의 모든 데이터 삭제
DELETE FROM part_images;

-- 2. image_metadata 테이블의 모든 데이터 삭제 (중복 체크용)
DELETE FROM image_metadata;

-- 2. Storage 버킷의 모든 객체 삭제
-- 주의: 이 쿼리는 lego_parts_images 버킷의 모든 파일을 삭제합니다
DELETE FROM storage.objects 
WHERE bucket_id = 'lego_parts_images';

-- 3. 삭제 결과 확인
SELECT 
  COUNT(*) as remaining_files
FROM storage.objects 
WHERE bucket_id = 'lego_parts_images';

-- 4. part_images 테이블 확인
SELECT 
  COUNT(*) as remaining_records
FROM part_images;

-- 5. 버킷 상태 확인
SELECT 
  bucket_id,
  COUNT(*) as file_count
FROM storage.objects 
GROUP BY bucket_id;

-- 6. 완전 초기화 확인
SELECT 
  'Storage bucket cleared' as status,
  COUNT(*) as remaining_files
FROM storage.objects 
WHERE bucket_id = 'lego_parts_images'
UNION ALL
SELECT 
  'part_images table cleared' as status,
  COUNT(*) as remaining_records
FROM part_images;