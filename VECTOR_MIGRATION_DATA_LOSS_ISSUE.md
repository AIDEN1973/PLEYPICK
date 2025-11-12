# VECTOR 마이그레이션 데이터 손실 이슈

## 문제 상황

마이그레이션 실행 후 `clip_text_emb`가 `null`로 변경됨:
- **이전 상태**: `clip_text_emb` = `"[-0.036482,0.0131217,0.0377621,...]"`
- **현재 상태**: `clip_text_emb` = `null`

## 가능한 원인

### 1. 변환 실패 후 원본 컬럼 삭제
마이그레이션 SQL의 5단계에서:
```sql
ALTER TABLE parts_master_features 
  DROP COLUMN IF EXISTS clip_text_emb,
  DROP COLUMN IF EXISTS semantic_vector;
```

**문제**: 변환이 실패한 레코드도 원본 컬럼이 삭제되어 데이터 손실 발생

### 2. 임시 컬럼에 데이터가 없는 경우
- 변환 실패 시 `clip_text_emb_new`가 `NULL`
- 원본 컬럼 삭제 후 `RENAME` 시 `NULL`로 교체됨

## 해결 방법

### 즉시 조치: 백업 확인
```sql
-- 임시 컬럼에 데이터가 남아있는지 확인
SELECT 
  id,
  part_id,
  color_id,
  clip_text_emb,
  clip_text_emb_new,
  semantic_vector,
  semantic_vector_new
FROM parts_master_features
WHERE id = 3388;
```

### 데이터 복구 방안

#### 옵션 1: 임시 컬럼 데이터 확인 및 복구
```sql
-- 임시 컬럼에 데이터가 있다면 원본으로 복구
UPDATE parts_master_features
SET 
  clip_text_emb = clip_text_emb_new,
  semantic_vector = semantic_vector_new
WHERE 
  clip_text_emb IS NULL 
  AND (clip_text_emb_new IS NOT NULL OR semantic_vector_new IS NOT NULL);
```

#### 옵션 2: 원본 데이터 백업에서 복구
- Supabase Point-in-Time Recovery 사용
- 또는 이전 백업에서 복구

### 근본 원인 수정

마이그레이션 SQL 수정 필요:
1. 변환 실패한 레코드는 원본 컬럼 유지
2. 또는 변환 실패 시 롤백

## 점검 쿼리

```sql
-- 변환 실패한 레코드 확인
SELECT 
  COUNT(*) FILTER (WHERE clip_text_emb IS NULL AND clip_text_emb_new IS NOT NULL) AS lost_clip,
  COUNT(*) FILTER (WHERE semantic_vector IS NULL AND semantic_vector_new IS NOT NULL) AS lost_semantic
FROM parts_master_features;

-- 임시 컬럼 상태 확인
SELECT 
  COUNT(*) FILTER (WHERE clip_text_emb_new IS NOT NULL) AS new_clip_count,
  COUNT(*) FILTER (WHERE semantic_vector_new IS NOT NULL) AS new_semantic_count
FROM parts_master_features;
```

---

**우선순위**: 🔴 높음 - 데이터 복구 필요














<<<<<<< HEAD
=======

>>>>>>> 87039ac2483fb2cfc80115fa29c3e4f844a1454b
