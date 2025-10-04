-- lego_parts_images 스토리지의 모든 파일 삭제
DELETE FROM storage.objects WHERE bucket_id = 'lego_parts_images';
