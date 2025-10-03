# Supabase Storage 버킷 생성 방법

## 방법 1: Supabase Dashboard 사용 (권장)

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택: `npferbxuxocbfnfbpcnz`

2. **Storage 메뉴로 이동**
   - 왼쪽 메뉴에서 "Storage" 클릭

3. **새 버킷 생성**
   - "New bucket" 버튼 클릭
   - 버킷 이름: `lego_parts_images`
   - Public bucket: ✅ 체크 (공개 버킷으로 설정)
   - File size limit: `50 MB`
   - Allowed MIME types: `image/jpeg,image/png,image/gif,image/webp`

4. **RLS 정책 설정**
   - 버킷 생성 후 "Policies" 탭으로 이동
   - 다음 정책들을 추가:

## 방법 2: SQL Editor 사용

Supabase Dashboard의 SQL Editor에서 다음 SQL을 실행:

```sql
-- 1. lego_parts_images 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lego_parts_images',
  'lego_parts_images',
  true,
  52428800, -- 50MB 제한
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- 2. 버킷에 대한 RLS 정책 설정
-- 모든 사용자가 읽기 가능
CREATE POLICY "Public read access for lego_parts_images" ON storage.objects
FOR SELECT USING (bucket_id = 'lego_parts_images');

-- 인증된 사용자만 업로드 가능
CREATE POLICY "Authenticated users can upload to lego_parts_images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 인증된 사용자만 업데이트 가능
CREATE POLICY "Authenticated users can update lego_parts_images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);

-- 인증된 사용자만 삭제 가능
CREATE POLICY "Authenticated users can delete lego_parts_images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lego_parts_images' 
  AND auth.role() = 'authenticated'
);
```

## 방법 3: 자동 생성 스크립트

프로젝트 루트에서 다음 명령어 실행:

```bash
# Supabase CLI 설치 (필요시)
npm install -g supabase

# Supabase에 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref npferbxuxocbfnfbpcnz

# SQL 스크립트 실행
supabase db reset --db-url "postgresql://postgres:[YOUR_PASSWORD]@db.npferbxuxocbfnfbpcnz.supabase.co:5432/postgres" --file database/setup_storage.sql
```

## 확인 방법

버킷이 생성되었는지 확인:

1. Supabase Dashboard → Storage
2. `lego_parts_images` 버킷이 목록에 표시되는지 확인
3. 버킷을 클릭하여 파일 업로드 테스트
