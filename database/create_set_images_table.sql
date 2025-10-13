-- set_images 테이블 생성 (세트 WebP 이미지 메타데이터 저장)
-- NewLegoRegistration.vue > saveSetImageMetadata 사용에 맞춘 스키마

CREATE TABLE IF NOT EXISTS public.set_images (
  id            bigserial PRIMARY KEY,
  set_num       varchar(32) NOT NULL,
  original_url  text,
  supabase_url  text,
  file_path     text,
  file_name     text,
  set_id        uuid REFERENCES public.lego_sets(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 중복 저장 방지: set_num 고유
CREATE UNIQUE INDEX IF NOT EXISTS uq_set_images_set_num ON public.set_images(set_num);
CREATE INDEX IF NOT EXISTS idx_set_images_set_id ON public.set_images(set_id);

-- updated_at 자동 갱신 트리거 (선택)
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
    RETURNS trigger AS $trigger$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
  END IF;
END $func$;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_images_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_set_images_set_updated_at
    BEFORE UPDATE ON public.set_images
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();
  END IF;
END $trigger$;


