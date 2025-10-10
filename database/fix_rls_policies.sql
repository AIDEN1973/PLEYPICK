-- 🔧 RLS 정책 수정 - 학습 완료 후 업로드 문제 해결
-- 모델 레지스트리 및 스토리지 업로드 권한 문제를 해결합니다.

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "Service role can manage model_registry" ON model_registry;
DROP POLICY IF EXISTS "Anyone can read model_registry" ON model_registry;
DROP POLICY IF EXISTS "Authenticated users can insert models" ON model_registry;

-- 2. model_registry 테이블 RLS 정책 재생성
CREATE POLICY "Anyone can read model_registry" ON model_registry FOR SELECT USING (true);

CREATE POLICY "Service role can manage model_registry" ON model_registry FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert models" ON model_registry FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. storage.objects 정책 수정
DROP POLICY IF EXISTS "Public model access" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage models" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload models" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update models" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete models" ON storage.objects;

-- 4. storage.objects 새로운 정책 생성
CREATE POLICY "Public model access" ON storage.objects FOR SELECT USING (bucket_id = 'models');

CREATE POLICY "Service role can manage models" ON storage.objects FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can upload models" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'models' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update models" ON storage.objects FOR UPDATE WITH CHECK (
  bucket_id = 'models' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete models" ON storage.objects FOR DELETE USING (
  bucket_id = 'models' 
  AND auth.role() = 'authenticated'
);

-- 5. training_jobs 테이블 정책 확인 및 수정
DROP POLICY IF EXISTS "Service role can manage training_jobs" ON training_jobs;
DROP POLICY IF EXISTS "Anyone can read training_jobs" ON training_jobs;
DROP POLICY IF EXISTS "Authenticated users can insert training_jobs" ON training_jobs;

CREATE POLICY "Anyone can read training_jobs" ON training_jobs FOR SELECT USING (true);

CREATE POLICY "Service role can manage training_jobs" ON training_jobs FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert training_jobs" ON training_jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ RLS 정책 수정 완료!';
    RAISE NOTICE '🔐 model_registry 테이블 정책이 업데이트되었습니다.';
    RAISE NOTICE '📦 storage.objects 정책이 업데이트되었습니다.';
    RAISE NOTICE '📊 training_jobs 테이블 정책이 업데이트되었습니다.';
END $$;
