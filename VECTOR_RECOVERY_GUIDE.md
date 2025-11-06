# 벡터 임베딩 복구 가이드

## 개요

마이그레이션 중 손실된 `clip_text_emb` 또는 `semantic_vector` 데이터를 원본 문자열에서 복구합니다.

## 준비 사항

원본 벡터 문자열이 있어야 합니다. 형식:
- JSON 배열: `"[-0.036482,0.0131217,0.0377621,...]"`
- 쉼표 구분: `"-0.036482,0.0131217,0.0377621,..."`
- 공백 포함 가능: `"[ -0.036482 , 0.0131217 , ... ]"`

**중요**: 벡터는 정확히 768개의 숫자여야 합니다.

## 방법 1: SQL 함수 사용 (권장)

### 단계 1: 복구 함수 생성

```sql
-- scripts/recover_embedding_from_string.sql 파일의
-- "범용 복구 함수" 섹션을 실행하여 함수 생성
```

### 단계 2: 복구 실행

```sql
-- clip_text_emb 복구
SELECT recover_vector_from_string(
  '[-0.036482,0.0131217,0.0377621,...]',  -- 원본 문자열 (768개 숫자)
  'parts_master_features',
  '32028',      -- part_id
  1,            -- color_id
  NULL,         -- record_id (또는 3388)
  'clip_text_emb'
);

-- semantic_vector 복구
SELECT recover_vector_from_string(
  '[원본_문자열_여기]',  -- 원본 문자열 (768개 숫자)
  'parts_master_features',
  '32028',
  1,
  NULL,
  'semantic_vector'
);
```

### 단계 3: 복구 확인

```sql
SELECT 
  id,
  part_id,
  color_id,
  clip_text_emb IS NOT NULL AS clip_ok,
  semantic_vector IS NOT NULL AS semantic_ok,
  array_length(clip_text_emb::real[], 1) AS clip_dim,
  array_length(semantic_vector::real[], 1) AS semantic_dim
FROM parts_master_features
WHERE part_id = '32028' AND color_id = 1;
```

## 방법 2: 직접 UPDATE 쿼리

```sql
-- clip_text_emb 직접 복구
UPDATE parts_master_features
SET clip_text_emb = (
  SELECT array_agg(real_val::real ORDER BY ordinality)::vector(768)
  FROM unnest(
    string_to_array(
      TRIM(BOTH '[]' FROM '[-0.036482,0.0131217,...]'),  -- 원본 문자열 교체
      ','
    )
  ) WITH ORDINALITY AS t(val, ordinality)
  CROSS JOIN LATERAL (
    SELECT TRIM(val) AS real_val
  ) AS cleaned
  WHERE TRIM(val) ~ '^-?[0-9]+\.?[0-9]*([Ee][+-]?[0-9]+)?$'
)
WHERE part_id = '32028' AND color_id = 1;
```

## 방법 3: Python 스크립트 사용

### 단계 1: 환경변수 설정

```bash
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
```

### 단계 2: 단일 복구

```bash
python scripts/recover_embedding_from_string.py \
  32028 \
  1 \
  "[-0.036482,0.0131217,...]" \
  clip_text_emb \
  3388
```

### 단계 3: 파일에서 일괄 복구

1. `scripts/recovery_data_template.json`을 복사하여 수정
2. 원본 문자열 입력 (768개 숫자)
3. 실행:

```bash
python scripts/recover_embedding_from_string.py --file recovery_data.json
```

## 복구 전 체크리스트

- [ ] 원본 벡터 문자열 확인 (768개 숫자)
- [ ] 복구 대상 레코드 식별 (part_id, color_id 또는 id)
- [ ] 복구할 컬럼 확인 (clip_text_emb 또는 semantic_vector)
- [ ] 백업 권장 (복구 전 현재 상태 저장)

## 주의사항

1. **차원 검증**: 벡터는 정확히 768차원이어야 합니다
2. **숫자 형식**: 정수, 소수, 과학 표기법 모두 지원
3. **NULL 처리**: 원본이 없거나 파싱 실패 시 NULL 유지
4. **트랜잭션**: 대량 복구 시 트랜잭션 사용 권장

## 문제 해결

### "벡터 차원 불일치" 오류
- 원본 문자열이 768개 숫자인지 확인
- 공백이나 잘못된 구분자 확인

### "레코드를 찾을 수 없음" 오류
- part_id, color_id 또는 id가 정확한지 확인
- Supabase 쿼리로 레코드 존재 여부 확인

### "벡터 파싱 실패" 오류
- 문자열 형식 확인 (대괄호, 쉼표 등)
- 숫자가 아닌 문자가 포함되지 않았는지 확인











