# 벡터 저장 방식 분석 및 개선 제안

## 현재 상태

### 스키마 타입
```
parts_master_features.clip_text_emb: ARRAY
parts_master_features.semantic_vector: ARRAY
```

### 실제 저장/조회 동작
1. **저장 시**: 숫자 배열로 저장 (`update({ clip_text_emb: [0.1, 0.2, ...] })`)
2. **조회 시**: Supabase 클라이언트가 PostgreSQL ARRAY를 **JSON 문자열로 직렬화하여 반환**
   - 예: `"[0.1, 0.2, ...]"` (문자열)
3. **사용 시**: 매번 `JSON.parse()` 또는 `typeof === 'string'` 체크 후 파싱 필요

---

## 현재 방식의 문제점

### 1. 성능 오버헤드
- **파싱 비용**: 매 조회마다 JSON 문자열 → 배열 변환
- **메모리 사용**: 문자열이 배열보다 약 30-50% 더 큰 저장 공간 필요
- **타입 확인**: 코드 전반에 `typeof === 'string'` 체크 필요

### 2. 벡터 연산 제약
- **DB 레벨 벡터 연산 불가**: PostgreSQL ARRAY 타입은 벡터 유사도 검색 불가
- **인덱싱 불가**: 벡터 유사도 인덱스 생성 불가 (예: HNSW, IVF)
- **쿼리 성능 저하**: 전체 테이블 스캔 후 애플리케이션 레벨에서 계산

### 3. FAISS 검색 영향
- **현재**: 로컬 FAISS 인덱스 사용 (DB에서 전체 벡터 조회 후 로컬에서 검색)
- **문제**: 벡터 데이터 크기가 크면 네트워크 전송 비용 증가
- **조치**: 이미 로컬 캐싱(IndexedDB)으로 완화 중

---

## 개선 방안

### 방안 1: pgvector 확장 사용 (권장)

#### 장점
- ✅ **벡터 타입**: `vector(768)` 타입으로 벡터 연산 최적화
- ✅ **인덱싱**: HNSW, IVF-Flat 등 벡터 인덱스 지원
- ✅ **DB 레벨 검색**: `SELECT ... ORDER BY embedding <-> query_vector LIMIT 10` 가능
- ✅ **성능**: 애플리케이션 레벨 계산 불필요

#### 단점
- ⚠️ **Supabase 확장 설치 필요**: pgvector 확장 활성화 필요
- ⚠️ **마이그레이션 필요**: 기존 데이터 변환 필요

#### 구현 예시
```sql
-- 마이그레이션
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE parts_master_features 
  ALTER COLUMN clip_text_emb TYPE vector(768) USING clip_text_emb::vector,
  ALTER COLUMN semantic_vector TYPE vector(768) USING semantic_vector::vector;

-- 벡터 유사도 검색 (코사인 거리)
SELECT part_id, color_id, 
       1 - (clip_text_emb <=> $1::vector) AS similarity
FROM parts_master_features
WHERE clip_text_emb IS NOT NULL
ORDER BY clip_text_emb <=> $1::vector
LIMIT 10;
```

---

### 방안 2: JSONB 사용 (현재와 유사하나 개선)

#### 장점
- ✅ **타입 명확성**: JSONB 타입으로 의도 명확
- ✅ **인덱싱 가능**: GIN 인덱스로 일부 쿼리 최적화 가능
- ✅ **마이그레이션 간단**: 기존 데이터 유지

#### 단점
- ⚠️ **벡터 연산 여전히 불가**: 애플리케이션 레벨 계산 필요
- ⚠️ **파싱 비용 동일**: JSON 문자열 파싱 오버헤드 유지

#### 구현 예시
```sql
ALTER TABLE parts_master_features 
  ALTER COLUMN clip_text_emb TYPE jsonb USING clip_text_emb::jsonb,
  ALTER COLUMN semantic_vector TYPE jsonb USING semantic_vector::jsonb;

-- 인덱스 생성 (벡터 연산은 여전히 불가)
CREATE INDEX idx_clip_text_emb ON parts_master_features USING GIN (clip_text_emb);
```

---

### 방안 3: 현재 방식 유지 + 최적화

#### 현재 완화 조치
- ✅ **로컬 캐싱**: IndexedDB에 숫자 배열로 저장하여 파싱 최소화
- ✅ **파싱 로직 통합**: `normalizeVector()` 함수로 일관성 유지
- ✅ **FAISS 로컬 검색**: DB 직접 검색 대신 로컬 인덱스 사용

#### 추가 최적화 가능
- **벡터 압축**: 저장 시 압축 (예: Float32 → Int16 양자화)
- **배치 조회**: 여러 벡터를 한 번에 조회하여 파싱 최적화
- **타입 캐싱**: 파싱 결과를 메모리에 캐싱

---

## 권장 사항

### 단기 조치 (현재)
✅ **현재 방식 유지**: 이미 로컬 캐싱으로 완화됨
- 코드 전반에 파싱 로직 포함 (완료)
- 성능 영향 최소화됨

### 장기 조치 (권장)
✅ **pgvector 확장 도입**: 
- 벡터 유사도 검색 성능 향상
- DB 레벨 최적화 가능
- 벡터 인덱싱으로 대용량 데이터 처리 가능

---

## 결론

### 현재 상태: **문제 없음 (기능적으로 정상)**
- Supabase가 PostgreSQL ARRAY를 JSON 문자열로 반환하는 것은 **정상 동작**
- 파싱 로직으로 해결 가능
- 성능 오버헤드는 로컬 캐싱으로 완화됨

### 개선 여지: **성능 최적화**
- pgvector 확장 도입 시 벡터 연산 성능 크게 향상
- 대용량 데이터에서 차이 극명

### 즉시 조치 필요성: **없음**
- 현재 방식으로도 기능적으로 문제없음
- FAISS 로컬 검색 사용 중이므로 DB 레벨 벡터 연산 필요성 낮음

