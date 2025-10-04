-- Supabase Storage 버킷 생성 (간단 버전)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lego_parts_images', 'lego_parts_images', true);
