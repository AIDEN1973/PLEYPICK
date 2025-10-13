# 🔧 메타데이터 관리 UI 설치 수정

**문제**: 뷰 및 RPC 함수 누락으로 404 에러 발생  
**해결**: `create_metadata_management_views.sql` 실행 필요

---

## ❌ 발생한 에러

```
POST .../rpc/get_embedding_stats 404 (Not Found)
GET .../v_embedding_status 404 (Not Found)

에러 메시지:
Could not find the table 'public.v_embedding_status' in the schema cache
```

**원인**: 메타데이터와 임베딩 탭에 필요한 DB 뷰와 RPC 함수가 생성되지 않음

---

## ✅ 해결 방법

### Step 1: 누락된 SQL 파일 실행
```bash
psql -f database/create_metadata_management_views.sql
```

**생성되는 객체:**
- ✅ `v_metadata_status` - AI 메타데이터 상태 뷰
- ✅ `v_embedding_status` - CLIP 임베딩 상태 뷰
- ✅ `get_metadata_stats()` - 메타데이터 통계 RPC
- ✅ `get_embedding_stats()` - 임베딩 통계 RPC
- ✅ `request_metadata_generation()` - 메타데이터 생성 요청
- ✅ `request_embedding_generation()` - 임베딩 생성 요청
- ✅ `retry_failed_embeddings()` - 실패 항목 재시도
- ✅ `request_missing_embeddings()` - 미생성 항목 요청

### Step 2: 브라우저 새로고침
```
http://localhost:3000/metadata-management
→ F5 또는 Ctrl+R
```

---

## 📋 완전한 설치 순서 (처음부터)

```bash
# 1. 기본 카테고리 시스템
psql -f database/create_part_categories_table.sql
psql -f database/fix_part_category_constraint.sql
psql -f database/migrate_part_categories.sql

# 2. 모니터링 시스템
psql -f database/create_category_monitoring.sql

# 3. 메타데이터 관리 UI (누락되었던 것!)
psql -f database/create_metadata_management_views.sql

# 4. 프론트엔드 빌드
npm run build
# 또는
npm run dev
```

---

## 🔍 검증

### 1. DB 객체 확인
```sql
-- 뷰 확인
\dv v_metadata_status
\dv v_embedding_status

-- RPC 함수 확인
\df get_metadata_stats
\df get_embedding_stats

-- 통계 조회 테스트
SELECT get_metadata_stats();
SELECT get_embedding_stats();
```

### 2. UI 확인
```
http://localhost:3000/metadata-management

체크리스트:
- [ ] 📝 AI 메타데이터 탭 - 에러 없이 로드
- [ ] 🧠 CLIP 임베딩 탭 - 에러 없이 로드
- [ ] 🔧 프롬프트 설정 탭 - 정상 작동
- [ ] 📊 카테고리 모니터링 탭 - 정상 작동
```

---

## 🎯 각 탭 설명

### 1. 📝 AI 메타데이터 탭
- **기능**: AI 메타데이터 생성 상태 확인
- **의존**: `v_metadata_status` 뷰, `get_metadata_stats()` RPC
- **상태**: completed / missing / error

### 2. 🧠 CLIP 임베딩 탭
- **기능**: CLIP 임베딩 생성 상태 확인
- **의존**: `v_embedding_status` 뷰, `get_embedding_stats()` RPC
- **상태**: completed / pending / no_text

### 3. 🔧 프롬프트 설정 탭
- **기능**: AI 메타데이터 생성 프롬프트 관리
- **의존**: `metadata_prompt_configs` 테이블
- **기능**: 프롬프트 조회/수정/저장

### 4. 📊 카테고리 모니터링 탭
- **기능**: Unknown 카테고리 로그 분석
- **의존**: `unknown_category_logs` 테이블, `v_part_categories_stats` 뷰
- **서브탭**: 요약 / 상세 / 분기 리포트 / 등록된 카테고리

---

## 📊 전체 SQL 파일 목록 (순서대로)

| # | 파일명 | 설명 | 필수 |
|---|--------|------|------|
| 1 | `create_part_categories_table.sql` | 기본 30개 카테고리 | ✅ |
| 2 | `fix_part_category_constraint.sql` | 제약 조건 수정 | ✅ |
| 3 | `migrate_part_categories.sql` | 데이터 마이그레이션 | ✅ |
| 4 | `create_category_monitoring.sql` | 모니터링 시스템 | ✅ |
| 5 | `create_metadata_management_views.sql` | 메타데이터 UI | ✅ |

**모두 실행해야 완전한 시스템!**

---

## 🔧 문제 해결

### 여전히 404 에러
```bash
# 1. Supabase 캐시 갱신
# Supabase 대시보드 → Database → Schema Cache → Refresh

# 2. 뷰 재생성
psql -c "DROP VIEW IF EXISTS v_metadata_status CASCADE;"
psql -c "DROP VIEW IF EXISTS v_embedding_status CASCADE;"
psql -f database/create_metadata_management_views.sql

# 3. 브라우저 캐시 삭제
Ctrl+Shift+R (하드 리프레시)
```

### RPC 함수 실행 오류
```sql
-- 함수 재생성
DROP FUNCTION IF EXISTS get_metadata_stats();
DROP FUNCTION IF EXISTS get_embedding_stats();

-- SQL 파일 재실행
\i database/create_metadata_management_views.sql
```

### 권한 오류
```sql
-- RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'parts_master_features';

-- 읽기 권한 확인
SELECT COUNT(*) FROM parts_master_features;
```

---

## ✅ 최종 확인

모든 SQL 실행 후:

```bash
# 1. DB 검증
psql -c "SELECT get_metadata_stats();"
psql -c "SELECT get_embedding_stats();"
psql -c "SELECT COUNT(*) FROM v_metadata_status;"
psql -c "SELECT COUNT(*) FROM v_embedding_status;"
psql -c "SELECT COUNT(*) FROM v_part_categories_stats;"

# 2. UI 접속
http://localhost:3000/metadata-management

# 3. 각 탭 순회
📝 → 🧠 → 🔧 → 📊

# 4. 콘솔 에러 확인
F12 → Console 탭 → 에러 없어야 함
```

---

## 🎉 성공!

모든 탭이 에러 없이 로드되면 성공입니다!

```
✅ 📝 AI 메타데이터 - 통계 표시
✅ 🧠 CLIP 임베딩 - 통계 표시
✅ 🔧 프롬프트 설정 - 설정 로드
✅ 📊 카테고리 모니터링 - 통계 표시
```

---

**이제 완벽한 메타데이터 관리 시스템입니다!** 🚀

