# 모든 테이블 part_name 상태 검증 결과

## 검증 요약

### 현재 상태

| 테이블 | 총 레코드 | part_id == part_name | part_id != part_name | 상태 |
|--------|----------|---------------------|---------------------|------|
| **parts_master** | 93 | 0개 (0.0%) | 93개 | ✅ 정상 (이미 업데이트됨) |
| **parts_master_features** | 100+ | 100개 (100.0%) | 0개 | ❌ 업데이트 필요 |
| **parts_master_core** | - | - | - | 확인 중 |
| **unified_category_view** | 100+ | 100개 (100.0%) | 0개 | ⚠️ 뷰 (기본 테이블 업데이트 필요) |
| **store_inventory** | - | - | - | 확인 필요 |

---

## 검증 상세

### 1. parts_master 테이블

**상태**: ✅ 정상
- `part_id == part_name`: 0% (모두 업데이트됨)
- `lego_parts.name`과 일치 확인됨
- 예시: "11841c03" → "Duplo Car Base 2 x 6 - 4 White Wheels with Black Tires on 4 Fixed Axles"

### 2. parts_master_features 테이블

**상태**: ❌ 업데이트 필요
- `part_id == part_name`: 100%
- 모든 레코드에서 `part_name`이 `part_id`와 동일
- **즉시 업데이트 권장**

### 3. parts_master_core 테이블

**상태**: 확인 중
- 데이터 없거나 접근 불가

### 4. unified_category_view 테이블

**상태**: ⚠️ 뷰 (업데이트 불필요)
- 뷰이므로 직접 업데이트 불가
- 기본 테이블(`parts_master_features` 등) 업데이트 시 자동 반영

### 5. store_inventory 테이블

**상태**: 확인 필요
- `part_name` 컬럼 존재 확인됨
- 데이터 확인 필요

---

## part_name 컬럼이 있는 모든 테이블

스키마 분석 결과:

### 실제 테이블
1. `parts_master` - ✅ 업데이트됨
2. `parts_master_features` - ❌ 업데이트 필요
3. `parts_master_core` - 확인 필요
4. `store_inventory` - 확인 필요
5. `unknown_category_logs` - 확인 필요

### 뷰 (View)
- `unified_category_view`
- `v_confusions_compatibility`
- `v_element_id_search`
- `v_embedding_status`
- `v_feature_minimal`
- `v_metadata_status`
- `v_unknown_parts_detail`

**참고**: 뷰는 기본 테이블의 데이터를 참조하므로 직접 업데이트 불필요

---

## 업데이트 SQL 쿼리

### 1. parts_master_features 업데이트 (필수)

```sql
-- 업데이트 전 확인
SELECT 
    COUNT(*) AS total,
    COUNT(CASE WHEN part_name = part_id THEN 1 END) AS needs_update,
    COUNT(CASE WHEN part_name != part_id THEN 1 END) AS already_updated
FROM parts_master_features pmf
JOIN lego_parts lp ON pmf.part_id = lp.part_num
WHERE lp.name IS NOT NULL;

-- 업데이트 실행
UPDATE parts_master_features pmf
SET part_name = lp.name,
    updated_at = NOW()
FROM lego_parts lp
WHERE pmf.part_id = lp.part_num
  AND pmf.part_name = pmf.part_id  -- part_id와 동일한 경우만
  AND lp.name IS NOT NULL;

-- 업데이트 결과 확인
SELECT 
    COUNT(*) AS total_updated,
    COUNT(CASE WHEN part_name = part_id THEN 1 END) AS still_identical,
    COUNT(CASE WHEN part_name != part_id AND part_name IS NOT NULL THEN 1 END) AS updated_successfully
FROM parts_master_features pmf
JOIN lego_parts lp ON pmf.part_id = lp.part_num
WHERE lp.name IS NOT NULL;
```

### 2. parts_master_core 업데이트 (데이터 확인 후)

```sql
-- 데이터 확인
SELECT 
    COUNT(*) AS total,
    COUNT(CASE WHEN part_name = part_id THEN 1 END) AS needs_update
FROM parts_master_core pmc
JOIN lego_parts lp ON pmc.part_id = lp.part_num
WHERE lp.name IS NOT NULL;

-- 업데이트 실행 (필요시)
UPDATE parts_master_core pmc
SET part_name = lp.name,
    updated_at = NOW()
FROM lego_parts lp
WHERE pmc.part_id = lp.part_num
  AND (pmc.part_name = pmc.part_id OR pmc.part_name IS NULL)
  AND lp.name IS NOT NULL;
```

### 3. store_inventory 업데이트 (데이터 확인 후)

```sql
-- 데이터 확인
SELECT 
    COUNT(*) AS total,
    COUNT(CASE WHEN part_name = part_id THEN 1 END) AS needs_update
FROM store_inventory si
JOIN lego_parts lp ON si.part_id = lp.part_num
WHERE lp.name IS NOT NULL;

-- 업데이트 실행 (필요시)
UPDATE store_inventory si
SET part_name = lp.name
FROM lego_parts lp
WHERE si.part_id = lp.part_num
  AND (si.part_name = si.part_id OR si.part_name IS NULL)
  AND lp.name IS NOT NULL;
```

### 4. unknown_category_logs 업데이트 (선택적)

```sql
-- 데이터 확인
SELECT 
    COUNT(*) AS total,
    COUNT(CASE WHEN part_name = part_id THEN 1 END) AS needs_update
FROM unknown_category_logs ucl
JOIN lego_parts lp ON ucl.part_id = lp.part_num
WHERE lp.name IS NOT NULL;

-- 업데이트 실행 (필요시)
UPDATE unknown_category_logs ucl
SET part_name = lp.name
FROM lego_parts lp
WHERE ucl.part_id = lp.part_num
  AND (ucl.part_name = ucl.part_id OR ucl.part_name IS NULL)
  AND lp.name IS NOT NULL;
```

---

## 통합 업데이트 스크립트

```sql
-- ============================================================================
-- 통합 part_name 업데이트 스크립트
-- ============================================================================

BEGIN;

-- 1. parts_master_features (필수)
UPDATE parts_master_features pmf
SET part_name = lp.name,
    updated_at = NOW()
FROM lego_parts lp
WHERE pmf.part_id = lp.part_num
  AND pmf.part_name = pmf.part_id
  AND lp.name IS NOT NULL;

-- 2. parts_master_core (데이터 있을 경우)
UPDATE parts_master_core pmc
SET part_name = lp.name,
    updated_at = NOW()
FROM lego_parts lp
WHERE pmc.part_id = lp.part_num
  AND (pmc.part_name = pmc.part_id OR pmc.part_name IS NULL)
  AND lp.name IS NOT NULL;

-- 3. store_inventory (데이터 있을 경우)
UPDATE store_inventory si
SET part_name = lp.name
FROM lego_parts lp
WHERE si.part_id = lp.part_num
  AND (si.part_name = si.part_id OR si.part_name IS NULL)
  AND lp.name IS NOT NULL;

-- 4. unknown_category_logs (선택적)
UPDATE unknown_category_logs ucl
SET part_name = lp.name
FROM lego_parts lp
WHERE ucl.part_id = lp.part_num
  AND (ucl.part_name = ucl.part_id OR ucl.part_name IS NULL)
  AND lp.name IS NOT NULL;

COMMIT;

-- 업데이트 결과 검증
SELECT 
    'parts_master_features' AS table_name,
    COUNT(*) AS total,
    COUNT(CASE WHEN part_name = part_id THEN 1 END) AS still_identical,
    COUNT(CASE WHEN part_name != part_id THEN 1 END) AS updated
FROM parts_master_features pmf
JOIN lego_parts lp ON pmf.part_id = lp.part_num
WHERE lp.name IS NOT NULL;
```

---

## 최종 권장 사항

### 우선순위 1: parts_master_features (필수)

**즉시 업데이트 필요**
- 100% 레코드에서 `part_name == part_id`
- 가장 중요하고 많이 사용되는 테이블

### 우선순위 2: 기타 테이블 (데이터 확인 후)

- `parts_master_core`: 데이터 존재 여부 확인 후 업데이트
- `store_inventory`: 데이터 확인 후 업데이트
- `unknown_category_logs`: 선택적 업데이트

### 우선순위 3: 뷰 (업데이트 불필요)

- 뷰는 기본 테이블 업데이트 시 자동 반영
- 추가 작업 불필요

---

## 결론

**현재 상태**:
- ✅ `parts_master`: 정상 (업데이트 완료)
- ❌ `parts_master_features`: 업데이트 필요 (100% 동일)
- ⚠️ 기타 테이블: 데이터 확인 후 업데이트

**권장 조치**:
1. `parts_master_features` 즉시 업데이트 (우선순위 최상)
2. 기타 테이블 데이터 확인 후 필요시 업데이트
3. 코드 수정: 앞으로 `part_name`이 `part_id`와 동일하게 저장되지 않도록

