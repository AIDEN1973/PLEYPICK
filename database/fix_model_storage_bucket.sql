-- 🔧 모델 스토리지 버킷 및 권한 문제 해결

-- 1. 기존 models 버킷에 정책 추가 (이미 존재하는 버킷 사용)
-- models 버킷에 대한 정책이 없을 수 있으므로 추가

CREATE POLICY "Public model access" ON storage.objects 
FOR SELECT USING (bucket_id = 'models');

CREATE POLICY "Service role can manage models" ON storage.objects 
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can upload models" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'models' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update models" ON storage.objects 
FOR UPDATE WITH CHECK (
  bucket_id = 'models' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete models" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'models' 
  AND auth.role() = 'authenticated'
);

-- 2. model_registry 테이블 RLS 정책 수정
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Service role can manage model_registry" ON model_registry;
DROP POLICY IF EXISTS "Anyone can read model_registry" ON model_registry;

-- 새로운 정책 생성
CREATE POLICY "Anyone can read model_registry" ON model_registry FOR SELECT USING (true);

CREATE POLICY "Service role can manage model_registry" ON model_registry FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert models" ON model_registry FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. training_jobs 테이블 RLS 정책 확인 및 수정
DROP POLICY IF EXISTS "Service role can manage training_jobs" ON training_jobs;
DROP POLICY IF EXISTS "Anyone can read training_jobs" ON training_jobs;

CREATE POLICY "Anyone can read training_jobs" ON training_jobs FOR SELECT USING (true);
CREATE POLICY "Service role can manage training_jobs" ON training_jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated users can insert training_jobs" ON training_jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 모델 스토리지 버킷 및 권한 설정 완료!';
    RAISE NOTICE '📦 기존 models 버킷에 정책이 추가되었습니다.';
    RAISE NOTICE '🔐 RLS 정책이 업데이트되었습니다.';
END $$;
