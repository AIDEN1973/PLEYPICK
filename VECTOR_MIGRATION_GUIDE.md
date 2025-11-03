# VECTOR 타입 마이그레이션 가이드

## 개요

`parts_master_features` 테이블의 `semantic_vector`, `clip_text_emb` 컬럼을 `ARRAY` 타입에서 `VECTOR(768)` 타입으로 전환합니다.

## 기술문서 요구사항 준수

`database/메타데이터.txt` 명시:
- `VECTOR(768)` 타입 사용
- HNSW 인덱스 사용

## 마이그레이션 단계

### 1단계: 마이그레이션 실행 (Supabase SQL Editor)

```sql
-- supabase/migrations/20251101_convert_vectors_to_vector_type.sql 실행
```

**실행 내용:**
1. pgvector 확장 설치
2. 임시 컬럼 생성
3. 기존 데이터 변환 (ARRAY → VECTOR)
4. 의존 뷰 삭제 (CASCADE)
5. 기존 컬럼 삭제 및 새 컬럼으로 교체
6. 의존 뷰 재생성 (VECTOR 타입 지원)
7. HNSW 인덱스 생성
8. 벡터 관련 함수 생성/업데이트

**예상 소요 시간:**
- 데이터 1,000건: 약 1-2분
- 데이터 10,000건: 약 10-20분
- 데이터 100,000건: 약 1-2시간

### 2단계: 데이터 변환 스크립트 실행 (선택)

대용량 데이터의 경우 Python 스크립트 사용:

```bash
# 환경 변수 설정
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# 스크립트 실행
python scripts/migrate_vectors_to_vector_type.py
```

### 3단계: 검증

```sql
-- 1. 타입 확인
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'parts_master_features' 
    AND column_name IN ('clip_text_emb', 'semantic_vector');

-- 기대 결과:
-- clip_text_emb   | USER-DEFINED | vector
-- semantic_vector | USER-DEFINED | vector

-- 2. 벡터 개수 확인
SELECT 
    COUNT(*) FILTER (WHERE clip_text_emb IS NOT NULL) AS clip_count,
    COUNT(*) FILTER (WHERE semantic_vector IS NOT NULL) AS semantic_count
FROM parts_master_features;

-- 3. 인덱스 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'parts_master_features'
    AND indexname LIKE '%hnsw%';
```

## 코드 변경 사항

### 저장 시 (이미 수정 완료)

1. **`useMasterPartsPreprocessing.js`**:
   - 저장 전 숫자 배열로 변환
   - 문자열 요소가 있으면 숫자로 변환

2. **`EmbeddingTab.vue`**:
   - 임베딩 저장 시 숫자 배열로 변환

### 조회 시 (이미 수정 완료)

1. **`useHybridCache.js`**:
   - `normalizeVector()` 함수로 문자열 배열 → 숫자 배열 변환
   - VECTOR 타입은 숫자 배열로 반환되지만, 안전성을 위해 변환 로직 유지

## 주의사항

1. **마이그레이션 전 백업 필수**
2. **프로덕션 환경에서는 점진적 마이그레이션 권장**
3. **pgvector 확장이 설치되어 있어야 함** (Supabase는 기본 제공)

## 장점

1. ✅ 기술문서 요구사항 준수
2. ✅ HNSW 인덱스로 벡터 검색 성능 향상
3. ✅ 숫자 배열로 직접 저장되어 변환 오버헤드 제거
4. ✅ 벡터 연산 최적화

## 롤백 방법

마이그레이션 실패 시:

```sql
-- 1. 확장 제거 (필요시)
DROP EXTENSION IF EXISTS vector CASCADE;

-- 2. 컬럼 타입 복원 (데이터 백업에서 복원 필요)
ALTER TABLE parts_master_features 
  ALTER COLUMN clip_text_emb TYPE real[] USING clip_text_emb::real[];
  
ALTER TABLE parts_master_features 
  ALTER COLUMN semantic_vector TYPE real[] USING semantic_vector::real[];
```

---

**마이그레이션 완료 후**: 모든 벡터 저장/조회가 VECTOR(768) 타입으로 처리됩니다.

