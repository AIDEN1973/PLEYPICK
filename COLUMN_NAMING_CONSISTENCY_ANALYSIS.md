# 테이블 간 컬럼명 일관성 분석 결과

## 검증 요약

### ✅ 문제 없음 확인

검증 결과, 테이블 간 컬럼명 혼용은 **의도적인 설계**이며 **문제 없음**을 확인했습니다.

---

## 테이블별 컬럼 구조

### 1. parts_master
```
- id (PK)
- part_id ✅ (부품 ID)
- part_name ✅ (부품 이름)
- element_id ✅ (Rebrickable 엘리먼트 ID)
- category
- color
- shape_tag
- ...
```

**역할**: 부품 마스터 카탈로그 (기본 정보)

---

### 2. parts_master_features
```
- id (PK)
- part_id ✅ (부품 ID)
- part_name ✅ (부품 이름)
- color_id ✅ (색상 ID)
- element_id ✅ (Rebrickable 엘리먼트 ID)
- feature_json
- clip_text_emb
- semantic_vector
- ...
```

**역할**: 부품 AI 메타데이터 및 임베딩 (특징 정보)

---

### 3. set_parts
```
- id (PK)
- set_id ✅ (세트 ID)
- part_id ✅ (부품 ID)
- color_id ✅ (색상 ID)
- element_id ✅ (Rebrickable 엘리먼트 ID)
- quantity
- is_spare
- ...
```

**역할**: 세트-부품 관계 테이블 (M:N 관계)

---

## 컬럼명 일관성 분석

### 공통 컬럼 (JOIN 가능)

| 컬럼명 | parts_master | parts_master_features | set_parts | 상태 |
|--------|-------------|----------------------|-----------|------|
| **part_id** | ✅ | ✅ | ✅ | ✅ 모든 테이블에 존재 (JOIN 가능) |
| **element_id** | ✅ | ✅ | ✅ | ✅ 모든 테이블에 존재 (JOIN 가능) |
| **part_name** | ✅ | ✅ | ❌ | 정상 (set_parts는 관계 테이블) |
| **color_id** | ❌ | ✅ | ✅ | 정상 (parts_master는 color 문자열 사용) |

### 불일치 분석

#### 1. part_num vs part_id
- **part_num**: 어느 테이블에도 없음
  - 실제로는 `lego_parts` 테이블에 `part_num` 존재
  - `set_parts.part_id`는 `lego_parts.part_num`을 참조 (외래 키)
  
- **part_id**: 모든 부품 마스터 테이블에 공통 사용
  - `parts_master.part_id`
  - `parts_master_features.part_id`
  - `set_parts.part_id`

**결론**: ✅ 정상
- `part_id`는 통일되어 있음
- `part_num`은 `lego_parts` 테이블의 컬럼명 (별도 용도)

---

#### 2. element_id 일관성
- **모든 테이블에 존재**: ✅
  - `parts_master.element_id`
  - `parts_master_features.element_id`
  - `set_parts.element_id`

**결론**: ✅ 정상 (완전 일관)

---

#### 3. part_name 일관성
- **parts_master**: ✅ `part_name` 존재
- **parts_master_features**: ✅ `part_name` 존재
- **set_parts**: ❌ `part_name` 없음

**분석**:
- `set_parts`는 관계 테이블이므로 `part_name`이 필요 없음
- 필요 시 `lego_parts` 테이블 JOIN으로 획득 가능
- 실제 코드에서도 `set_parts` 조회 시 `lego_parts` JOIN 사용

**결론**: ✅ 정상 (의도적인 설계)

---

## JOIN 시나리오 검증

### 시나리오 1: parts_master ↔ parts_master_features
```sql
SELECT *
FROM parts_master pm
JOIN parts_master_features pmf 
  ON pm.part_id = pmf.part_id
WHERE pm.part_id = '32028';
```
**결과**: ✅ JOIN 가능 (`part_id` 공통)

---

### 시나리오 2: parts_master_features ↔ set_parts
```sql
SELECT *
FROM parts_master_features pmf
JOIN set_parts sp 
  ON pmf.part_id = sp.part_id 
  AND pmf.color_id = sp.color_id
WHERE sp.set_id = '76917';
```
**결과**: ✅ JOIN 가능 (`part_id`, `color_id` 공통)

---

### 시나리오 3: element_id 기반 조회
```sql
SELECT *
FROM parts_master_features pmf
JOIN set_parts sp 
  ON pmf.element_id = sp.element_id
WHERE pmf.element_id = '32028';
```
**결과**: ✅ JOIN 가능 (`element_id` 공통)

---

## 실제 코드 사용 현황

### 코드 예시 1: set_parts 조회 (useMasterPartsMatching.js)
```javascript
const { data: setParts } = await supabase
  .from('set_parts')
  .select(`
    part_id,        // ✅ part_id 사용
    color_id,
    element_id,     // ✅ element_id 사용
    quantity,
    lego_parts(part_num, name),  // part_name은 JOIN으로 획득
    lego_colors(color_id, name, rgb)
  `)
  .eq('set_id', legoSet.id)
```

**분석**: ✅ 정상
- `part_id`로 JOIN 가능
- `part_name`이 필요하면 `lego_parts` JOIN 사용

---

### 코드 예시 2: element_id 기반 조회 (useMasterPartsPreprocessing.js)
```javascript
const { data } = await supabase
  .from('set_parts')
  .select(`
    element_id,     // ✅ element_id 사용
    part_id,       // ✅ part_id 사용
    lego_parts(part_num, name),
    lego_colors(name, rgb)
  `)
  .eq('element_id', elementId)
```

**분석**: ✅ 정상
- `element_id`로 조회 가능
- `part_id`로 추가 JOIN 가능

---

## 외래 키 관계 확인

### set_parts 테이블 외래 키
```sql
-- set_parts.part_id -> lego_parts.part_num
FOREIGN KEY (part_id) REFERENCES lego_parts(part_num)

-- set_parts.color_id -> lego_colors.color_id
FOREIGN KEY (color_id) REFERENCES lego_colors(color_id)
```

**분석**:
- `set_parts.part_id`는 `lego_parts.part_num`을 참조
- `part_id` vs `part_num` 혼용이 아님
- 서로 다른 테이블의 서로 다른 컬럼명 (정상)

---

## 최종 결론

### ✅ 컬럼명 혼용은 문제 없음

1. **part_id**: 모든 테이블에 통일되어 있음 ✅
2. **element_id**: 모든 테이블에 통일되어 있음 ✅
3. **part_num**: `lego_parts` 테이블 전용 컬럼 (별도 용도) ✅
4. **part_name**: 관계 테이블(`set_parts`)에는 없음 (정상 설계) ✅

### 설계 원칙

1. **부품 마스터 테이블**: `part_id` 사용 (통일)
2. **관계 테이블**: `part_id`로 참조 (통일)
3. **외부 테이블**: `lego_parts.part_num` (별도 용도)
4. **엘리먼트 ID**: 모든 테이블에 `element_id` (통일)

---

## 권장 사항

### 현재 상태 유지 권장

1. ✅ 컬럼명이 각 테이블의 역할에 맞게 설계됨
2. ✅ JOIN이 정상적으로 작동함
3. ✅ 외래 키 관계가 올바르게 설정됨
4. ✅ 코드에서 일관되게 사용됨

### 추가 개선 사항 (선택적)

1. **문서화 강화**:
   - 각 테이블의 컬럼명 명명 규칙 문서화
   - JOIN 시나리오 예시 문서화

2. **타입 일관성**:
   - `part_id`: 모든 테이블에서 `VARCHAR` 타입 확인
   - `color_id`: 모든 테이블에서 `INTEGER` 타입 확인

---

## 결론

**컬럼명 혼용은 문제 없음**

- 각 테이블의 역할에 맞게 설계됨
- JOIN 시 필요한 컬럼은 모두 공통으로 존재
- 실제 코드에서 정상적으로 사용 중
- 추가 수정 불필요

