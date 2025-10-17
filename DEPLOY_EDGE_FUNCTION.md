# 🚀 Edge Function 배포 가이드

## 1. Supabase CLI 설치
```bash
# Windows (PowerShell)
npm install -g supabase

# 또는 Scoop 사용
scoop install supabase
```

## 2. 로그인 및 프로젝트 연결
```bash
supabase login
supabase link --project-ref npferbxuxocbfnfbpcnz
```

## 3. Edge Function 배포
```bash
supabase functions deploy storage-sync --project-ref npferbxuxocbfnfbpcnz
```

## 4. Storage 이벤트 연결 (Supabase Dashboard)

### 4.1 Storage 설정
1. Supabase Dashboard → Storage → Settings
2. Webhooks 섹션에서 새 웹훅 추가:
   - **Event**: `Object Created`
   - **URL**: `https://npferbxuxocbfnfbpcnz.supabase.co/functions/v1/storage-sync`
   - **Headers**: 
     ```
     Authorization: Bearer YOUR_SERVICE_ROLE_KEY
     Content-Type: application/json
     ```

### 4.2 또는 SQL로 이벤트 연결
```sql
-- Storage 이벤트를 Edge Function에 연결
INSERT INTO storage.objects (bucket_id, name, path_tokens, metadata)
VALUES ('lego-synthetic', 'test', ARRAY['test'], '{}');

-- 웹훅 설정 (Supabase Dashboard에서 설정하는 것이 더 안전)
```

## 5. 테스트
```bash
# Edge Function 직접 테스트
curl -X POST https://npferbxuxocbfnfbpcnz.supabase.co/functions/v1/storage-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"bucket":"lego-synthetic","name":"synthetic/3001/test.webp","size":1234}]}'
```

## 6. 백그라운드 업로더 실행
```bash
# 환경변수 설정
set BRICKBOX_WATCH_DIR=C:\cursor\brickbox\output\synthetic
set VITE_SUPABASE_URL=https://npferbxuxocbfnfbpcnz.supabase.co
set SUPABASE_SERVICE_ROLE=YOUR_SERVICE_ROLE_KEY

# 백그라운드 업로더 실행
python scripts/bg_uploader_watch.py
```

## 7. 마이그레이션 실행
```bash
# DB 스키마 업데이트
supabase db push --project-ref npferbxuxocbfnfbpcnz
```

## 8. 확인 방법
1. **Storage**: `lego-synthetic` 버킷에 파일 업로드 확인
2. **DB**: `synthetic_dataset` 테이블에 레코드 자동 생성 확인
3. **실패 로그**: `synthetic_upload_failures`, `synthetic_sync_failures` 테이블 확인
4. **GUI**: "실패 업로드 목록", "실패 동기화 목록" 버튼으로 상태 확인

## 🔧 문제 해결
- **Edge Function 배포 실패**: Supabase CLI 버전 확인, 프로젝트 권한 확인
- **웹훅 연결 실패**: Service Role Key 권한, URL 형식 확인
- **업로드 실패**: 네트워크, 버킷 권한, 파일 경로 확인
- **동기화 실패**: DB 스키마, 트리거, 인덱스 확인

