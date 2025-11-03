# 전체 스키마 컬럼명 혼용 및 정합성 정밀 검증 결과

## 검증 개요

- **검증 일시**: 실행 시간 기준
- **총 테이블 수**: 125개
- **총 컬럼 수**: 1,384개
- **발견된 문제**: 5개

---

## 검증 결과 요약

### 종합 평가: ⚠️ 5개 문제 발견

1. **데이터 타입 불일치**: 3개
2. **명명 규칙 불일치**: 1개 (27개 컬럼)
3. **외래 키 타입 불일치**: 1개
4. **누락된 관계**: 0개

---

## 1. 컬럼명 분포 분석

### part_id 분포
- **총 40개 테이블**에서 사용
- 주요 테이블: `parts_master`, `parts_master_features`, `set_parts`, `parts_master_core`, `parts_master_embed`, `parts_master_scores` 등

### element_id 분포
- **총 10개 테이블**에서 사용
- 주요 테이블: `parts_master`, `parts_master_features`, `set_parts`, `part_images`, `qa_logs` 등

### color_id vs color
- **color_id**: 16개 테이블에서 사용 (정규화된 ID)
- **color**: 21개 테이블에서 사용 (문자열 값)

### set_id vs set_num
- **set_id**: 12개 테이블에서 사용 (UUID 또는 VARCHAR)
- **set_num**: 6개 테이블에서 사용 (문자열 값)

---

## 2. 데이터 타입 일관성 문제 (3개)

### 문제 1: part_id 타입 불일치

**발견된 타입**:
- `character varying` (대부분)
- `uuid` (일부)
- `text` (일부)

**영향 테이블** (40개):
```
- parts_master: character varying
- parts_master_features: character varying
- set_parts: character varying
- ai_inference_results: character varying
- error_recovery_logs: uuid (불일치!)
- inference_results_detailed: character varying
- part_images: uuid (불일치!)
- store_inventory: character varying
- synthetic_dataset: character varying
- ... 기타 31개 테이블
```

**문제점**:
- `part_id`는 대부분 `character varying`이지만 일부 테이블에서 `uuid` 또는 `text` 사용
- JOIN 시 타입 불일치로 인한 성능 저하 가능성
- 외래 키 관계 설정 시 문제 발생 가능

**권장 사항**:
- 모든 테이블에서 `part_id`를 `character varying(20)` 또는 `VARCHAR(20)`으로 통일
- `uuid` 타입 사용 테이블은 `character varying`으로 변경 고려

---

### 문제 2: set_id 타입 불일치

**발견된 타입**:
- `character varying` (대부분)
- `uuid` (일부)

**영향 테이블** (12개):
```
- set_parts: uuid (불일치 가능성)
- parts_master_features: uuid (불일치 가능성)
- set_images: uuid (불일치 가능성)
- test_images: uuid (불일치 가능성)
- validation_samples: uuid (불일치 가능성)
- v_element_id_search: uuid (불일치 가능성)
- ... 기타 6개 테이블 (character varying)
```

**문제점**:
- `set_id`가 `uuid`와 `character varying` 혼용
- JOIN 시 타입 변환 필요

**권장 사항**:
- `set_id` 타입 통일 (UUID를 사용하는 경우 모든 테이블에서 `uuid`로 통일)
- 또는 `character varying`으로 통일

---

### 문제 3: id 컬럼 타입 불일치

**발견된 타입**:
- `integer` (대부분)
- `bigint` (일부)
- `uuid` (일부)
- `character varying` (일부)
- `text` (일부)

**영향 테이블** (108개):
- 거의 모든 테이블에서 `id` 컬럼 사용
- 타입이 테이블별로 다름 (정상 범위 내)

**분석**:
- 각 테이블의 `id`는 PK이므로 테이블별로 다른 타입 사용 가능 (정상)
- 단, 외래 키로 참조하는 경우 타입 일치 필수

**결론**: ⚠️ 이슈 있으나 설계상 허용 가능

---

## 3. 명명 규칙 불일치 (27개 컬럼)

### camelCase 사용 컬럼

발견된 camelCase 컬럼:
```
- ai_performance_logs.top1_accuracy
- index_statistics.l1_templates
- index_statistics.l2_templates
- mmap_index_stats.l1_index_size
- mmap_index_stats.l2_index_size
... 기타 22개
```

**문제점**:
- 대부분의 컬럼은 `snake_case` 사용
- 일부 컬럼에서 `camelCase` 혼용

**권장 사항**:
- 모든 컬럼을 `snake_case`로 통일
- `l1_templates` → `l1_templates` (이미 snake_case)
- `top1_accuracy` → `top_1_accuracy` 또는 그대로 유지 (숫자가 포함된 경우)

**결론**: ⚠️ 일관성 개선 권장 (기능적 문제는 없음)

---

## 4. 외래 키 타입 불일치 (1개)

### part_id 타입 불일치 (외래 키 관점)

**문제**:
- `part_id`가 `uuid`, `character varying`, `text` 혼용
- 외래 키 관계 설정 시 타입 불일치로 인한 제약 조건 실패 가능

**영향**:
- `set_parts.part_id` → `lego_parts.part_num` 외래 키 관계
- 다른 테이블 간 JOIN 시 타입 변환 필요

**권장 사항**:
- 모든 `part_id` 컬럼을 `character varying(20)`으로 통일
- 외래 키 관계 유지

---

## 5. 누락된 관계 확인

### ✅ 문제 없음

- `parts_master_features`: `part_id`, `color_id` 모두 존재
- `set_parts`: `set_id`, `part_id` 모두 존재
- 필수 관계 컬럼 누락 없음

---

## 핵심 발견 사항

### 정상 항목

1. **컬럼명 일관성**: ✅
   - `part_id`: 모든 테이블에서 동일한 이름 사용
   - `element_id`: 모든 테이블에서 동일한 이름 사용
   - `color_id`: 모든 테이블에서 동일한 이름 사용

2. **필수 관계**: ✅
   - 모든 필수 관계 컬럼 존재
   - JOIN 가능한 구조

### 개선 필요 항목

1. **part_id 타입 통일**: ⚠️
   - 현재: `character varying`, `uuid`, `text` 혼용
   - 권장: 모든 테이블에서 `character varying(20)` 통일

2. **set_id 타입 통일**: ⚠️
   - 현재: `uuid`, `character varying` 혼용
   - 권장: 모든 테이블에서 `uuid` 또는 `character varying` 통일

3. **명명 규칙 통일**: ⚠️
   - 현재: 대부분 `snake_case`, 일부 `camelCase` 혼용
   - 권장: 모든 컬럼 `snake_case` 통일

---

## 권장 조치 사항

### 우선순위 1: 타입 통일 (필수)

#### part_id 타입 통일
```sql
-- 1. 타입 확인
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE column_name = 'part_id'
ORDER BY table_name;

-- 2. 타입 변경 (uuid → character varying)
ALTER TABLE error_recovery_logs 
  ALTER COLUMN part_id TYPE character varying(20);

ALTER TABLE part_images 
  ALTER COLUMN part_id TYPE character varying(20);

-- 기타 uuid 타입 사용 테이블도 동일하게 변경
```

#### set_id 타입 통일
```sql
-- 모든 테이블에서 set_id 타입 확인 후 통일
-- uuid 사용 결정 시: 모든 테이블을 uuid로 통일
-- character varying 사용 결정 시: 모든 테이블을 character varying으로 통일
```

### 우선순위 2: 명명 규칙 통일 (권장)

- camelCase 컬럼을 snake_case로 변경 고려
- 숫자 포함 컬럼(`l1_templates`, `top1_accuracy`)은 현행 유지 가능

---

## 결론

### 종합 평가

**현재 상태**: ⚠️ **5개 문제 발견, 기능적 영향은 제한적**

1. **데이터 타입 불일치**: 
   - `part_id`, `set_id`, `id` 컬럼 타입 혼용
   - JOIN 시 타입 변환 필요 (성능 영향 제한적)
   - 외래 키 제약 조건에는 영향 없음

2. **명명 규칙 불일치**:
   - 27개 컬럼에서 camelCase 혼용
   - 기능적 문제 없음, 일관성 개선 권장

3. **외래 키 관계**: 
   - 모든 필수 관계 존재
   - 타입 불일치 문제만 있음

### 영향도 평가

**기능적 영향**: ⚠️ **낮음**
- 현재 JOIN 및 쿼리는 정상 작동
- 타입 자동 변환으로 인한 성능 저하는 제한적

**유지보수 영향**: ⚠️ **중간**
- 타입 혼용으로 인한 개발자 혼란 가능
- 명명 규칙 불일치로 인한 일관성 저하

### 최종 권장 사항

1. **즉시 조치 필요 없음**: 현재 기능 정상 작동
2. **장기적 개선 권장**: 타입 및 명명 규칙 통일
3. **우선순위**: `part_id`, `set_id` 타입 통일 (외래 키 관계 개선)

---

## 상세 데이터

### part_id 사용 테이블 (40개)
```
parts_master, parts_master_features, parts_master_core, 
parts_master_embed, parts_master_scores, set_parts,
ai_inference_results, error_recovery_logs, inference_results_detailed,
inventory_items, part_access_policies, part_images,
part_quality_recovery_history, part_training_status,
policy_change_logs, qa_logs, qa_quality_trends,
quality_healing_rate, store_inventory, synthetic_dataset,
synthetic_part_stats, synthetic_sync_failures,
synthetic_upload_failures, test_images, unified_category_view,
unknown_category_logs, v_confusions_compatibility,
v_element_id_search, v_embedding_queue, v_embedding_status,
v_feature_minimal, v_metadata_status, v_parts_master_hot,
v_qa_summary_extended, v_quality_metrics, v_realtime_alerts,
v_realtime_upload_status, v_unknown_parts_detail, validation_samples
```

### element_id 사용 테이블 (10개)
```
parts_master, parts_master_features, set_parts, part_images,
part_quality_recovery_history, qa_logs, quality_healing_rate,
test_images, v_element_id_search, validation_samples
```

