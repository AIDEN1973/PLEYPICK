# VECTOR 마이그레이션 실행 가이드

## 실행 방법

### Supabase SQL Editor에서 한 번에 실행

1. **Supabase Dashboard 접속**
   - https://app.supabase.com 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴: `SQL Editor` 클릭
   - `New query` 클릭

3. **마이그레이션 SQL 복사 & 실행**
   - `supabase/migrations/20251101_convert_vectors_to_vector_type.sql` 파일 전체 내용 복사
   - SQL Editor에 붙여넣기
   - `Run` 버튼 클릭 또는 `Ctrl+Enter`

## 실행 시간 예상

- 데이터 1,000건: 약 1-2분
- 데이터 10,000건: 약 10-20분
- 데이터 100,000건: 약 1-2시간

**주의**: 데이터 변환 단계(3단계)에서 레코드 수에 비례하여 시간이 소요됩니다.

## 실행 단계

마이그레이션은 다음 순서로 자동 실행됩니다:

1. ✅ pgvector 확장 설치
2. ✅ 임시 컬럼 생성 (`clip_text_emb_new`, `semantic_vector_new`)
3. ⏳ 기존 데이터 변환 (ARRAY → VECTOR) - **시간 소요 구간**
4. ✅ 의존 뷰 삭제 (`v_embedding_status` 등)
5. ✅ 기존 컬럼 삭제 및 새 컬럼으로 교체
6. ✅ 의존 뷰 재생성
7. ✅ HNSW 인덱스 생성
8. ✅ 벡터 관련 함수 생성/업데이트
9. ✅ 변환 완료 로그 출력

## 실행 중 확인 사항

### 진행 상황 모니터링

실행 중 `Messages` 탭에서 다음 로그를 확인할 수 있습니다:

```
변환 대상: N개 레코드
진행 중: 100/N (clip: X, semantic: Y)
진행 중: 200/N (clip: X, semantic: Y)
...
변환 완료: N개 레코드 처리 (clip: X, semantic: Y)
변환 완료: clip_text_emb=N개, semantic_vector=N개
```

### 에러 발생 시

- `clip_text_emb 변환 실패 (id: X): ...` 메시지가 나타나면 해당 레코드는 건너뛰고 계속 진행됩니다.
- 전체 마이그레이션이 실패하지 않고 부분적으로 변환됩니다.

## 실제 데이터 형식 처리

제공된 데이터 예시:
```json
{
  "clip_text_emb": "[-0.036482,0.0131217,0.0377621,...]",
  "semantic_vector": null
}
```

마이그레이션 SQL은 다음 형식을 모두 처리합니다:
1. **PostgreSQL 배열 타입** (`text[]`, `real[]`): `unnest()`로 직접 변환
2. **JSON 배열 문자열** (`"[-0.036482,0.0131217,...]"`): `TRIM()` 및 `string_to_array()`로 파싱

변환 실패 시 해당 레코드는 건너뛰고 계속 진행됩니다.

## 실행 후 검증

### 1. 컬럼 타입 확인

```sql
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns
WHERE table_name = 'parts_master_features'
  AND column_name IN ('clip_text_emb', 'semantic_vector');
```

**예상 결과**:
- `clip_text_emb`: `USER-DEFINED` / `vector`
- `semantic_vector`: `USER-DEFINED` / `vector`

### 2. 데이터 개수 확인

```sql
SELECT 
  COUNT(*) FILTER (WHERE clip_text_emb IS NOT NULL) AS clip_count,
  COUNT(*) FILTER (WHERE semantic_vector IS NOT NULL) AS semantic_count,
  COUNT(*) AS total_count
FROM parts_master_features;
```

### 3. HNSW 인덱스 확인

```sql
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'parts_master_features'
  AND indexname LIKE '%hnsw%';
```

**예상 결과**:
- `idx_clip_text_emb_hnsw`
- `idx_semantic_vector_hnsw`

### 4. 뷰 재생성 확인

```sql
SELECT * FROM v_embedding_status LIMIT 5;
```

## 주의사항

1. **백업 권장**: 대량 데이터의 경우 마이그레이션 전 백업을 권장합니다.
2. **트랜잭션 사용 금지**: 이 마이그레이션은 여러 DDL 작업을 포함하므로 트랜잭션으로 감싸지 마세요.
3. **동시 실행 금지**: 마이그레이션 실행 중에는 다른 데이터 수정 작업을 피하세요.
4. **실행 시간**: 큰 데이터셋의 경우 실행 중 페이지를 닫지 마세요.

## 문제 해결

### "extension vector does not exist" 오류
- Supabase 프로젝트에서 pgvector 확장을 먼저 설치해야 합니다.
- 1단계(`CREATE EXTENSION IF NOT EXISTS vector;`)가 정상 실행되었는지 확인하세요.

### "column does not exist" 오류
- 마이그레이션을 중간에 중단했다가 다시 실행하는 경우 발생할 수 있습니다.
- 임시 컬럼(`clip_text_emb_new`, `semantic_vector_new`)이 이미 생성되어 있는지 확인하세요.

### 변환 실패 레코드가 많은 경우
- `scripts/migrate_vectors_to_vector_type.py`를 사용하여 개별 재변환을 시도할 수 있습니다.

---

**실행 준비 완료**: 모든 단계가 한 번에 실행되도록 설계되었습니다. ✅

