-- BrickBox: Storage 버킷 동기화(트리거/함수/정책) 정리 스크립트
-- 목적: storage.objects 에 걸린 동기화 트리거/함수/정책만 제거
-- 주의: 버킷과 데이터(part_images, image_metadata 등)는 삭제하지 않음

-- 1) 트리거 제거 (존재 시에만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='storage' AND c.relname='objects' AND t.tgname='auto_sync_to_part_images'
  ) THEN
    EXECUTE 'DROP TRIGGER auto_sync_to_part_images ON storage.objects';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='storage' AND c.relname='objects' AND t.tgname='auto_sync_storage_images'
  ) THEN
    EXECUTE 'DROP TRIGGER auto_sync_storage_images ON storage.objects';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='storage' AND c.relname='objects' AND t.tgname='storage_upload_trigger'
  ) THEN
    EXECUTE 'DROP TRIGGER storage_upload_trigger ON storage.objects';
  END IF;
END $$;

-- 2) 함수 제거 (존재 시에만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='sync_to_part_images'
  ) THEN
    EXECUTE 'DROP FUNCTION public.sync_to_part_images()';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='auto_sync_part_image'
  ) THEN
    EXECUTE 'DROP FUNCTION public.auto_sync_part_image()';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='handle_storage_upload'
  ) THEN
    EXECUTE 'DROP FUNCTION public.handle_storage_upload()';
  END IF;
END $$;

-- 3) 정책 제거 (존재 시에만) - 공개 읽기 정책 등
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='public_read_lego_parts_images'
  ) THEN
    EXECUTE 'DROP POLICY public_read_lego_parts_images ON storage.objects';
  END IF;
END $$;

-- 4) RLS 설정은 유지(선택). RLS 비활성화가 필요하면 아래 주석 해제
-- ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- 5) 참고: part_images 유니크 인덱스/데이터는 유지
--    애플리케이션 레벨 업서트(useImageManager.js)로 동기화합니다.

-- 상태 확인용
SELECT 'removed_triggers' AS step,
       ARRAY(
         SELECT t.tgname FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname='storage' AND c.relname='objects'
       ) AS remaining_triggers;


