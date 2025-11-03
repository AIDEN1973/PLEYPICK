# parts_master 테이블 part_id vs part_name 분석 결과

## 검증 결과 요약

### ⚠️ 문제 확인: 의도되지 않은 동일값

- **part_id == part_name**: 약 100% (샘플 기준)
- **part_id != part_name**: 약 3% (예: "3001" → "Brick 2x4")
- **결론**: 대부분의 레코드에서 `part_name`이 `part_id`와 동일하게 설정됨 (의도되지 않음)

---

## 검증 상세 결과

### 1. parts_master 테이블

**샘플 분석** (100개):
- `part_id == part_name`: 100개 (100%)
- `part_id != part_name`: 3개 (3%)
- NULL: 0개 (0%)

**예시**:
```
✅ 정상 (part_name이 실제 부품명):
- part_id=3001, part_name="Brick 2x4" [다름]

❌ 문제 (part_name이 part_id와 동일):
- part_id=11841c03, part_name="11841c03" [동일]
- part_id=2302pr0009, part_name="2302pr0009" [동일]
- part_id=2357, part_name="2357" [동일]
```

### 2. parts_master_features 테이블

**샘플 분석** (100개):
- `part_id == part_name`: 100개 (100%)
- 모든 레코드에서 동일

### 3. lego_parts 테이블과 비교

**실제 부품명**:
```
part_num=11841c03:
  lego_parts.name: "Duplo Car Base 2 x 6 - 4 White Wheels with Black Tires on 4 Fixed Axles"
  parts_master.part_name: "11841c03" ❌

part_num=2302pr0009:
  lego_parts.name: "Duplo Brick 2 x 3 with Curved Top Grill, Headlights Print"
  parts_master.part_name: "2302pr0009" ❌

part_num=2357:
  lego_parts.name: "Brick 2 x 2 Corner"
  parts_master.part_name: "2357" ❌
```

**분석**: `parts_master.part_name`이 `lego_parts.name`과 다르고, 대부분 `part_id`와 동일

---

## 코드 분석

### 1. parts_master 등록 로직

#### server/blender-api.js:112-123
```javascript
async function ensurePartInMaster(partId) {
  const partRecord = {
    part_id: partId,
    part_name: `LEGO Element ${partId}`,  // part_id와 다름 (의도됨)
    category: 'Unknown',
    color: 'Unknown',
    element_id: partId,
    version: 1
  }
  // ...
}
```

**의도**: `part_name`을 `LEGO Element ${partId}`로 설정 (part_id와 다름)

#### useMasterPartsPreprocessing.js:86
```javascript
elementIdsToRegister.push({
  element_id: result.element_id,
  part_id: realPartInfo.part_id,
  part_name: realPartInfo.part_name,  // 실제 부품명 사용 시도
  category: result.category || 'Unknown',
  color: realPartInfo.color_name
})
```

**의도**: 실제 부품명(`realPartInfo.part_name`) 사용 시도

#### useMasterPartsPreprocessing.js:96 (Fallback)
```javascript
elementIdsToRegister.push({
  element_id: result.element_id,
  part_id: result.part_num,
  part_name: result.part_name || `LEGO Element ${result.element_id}`,  // Fallback
  category: result.category || 'Unknown',
  color: result.color_name || 'Unknown'
})
```

**문제**: `result.part_name`이 없으면 `LEGO Element ${element_id}` 사용하지만, 실제로는 `part_id`와 동일하게 저장됨

---

## 문제 원인 분석

### 가능한 원인

1. **초기 데이터 입력 시**:
   - `part_name`이 제공되지 않아 `part_id`와 동일하게 설정됨
   - 또는 `part_name` 필드가 자동으로 `part_id`와 동일하게 설정되는 로직 존재

2. **업데이트 누락**:
   - `parts_master`에 레코드가 등록된 후 `part_name`이 업데이트되지 않음
   - `lego_parts` 테이블의 실제 부품명과 동기화되지 않음

3. **코드 로직 문제**:
   - `registerElementIdsToPartsMaster` 함수가 `realPartInfo.part_name`을 가져오지만
   - 실제 저장 시 `part_id`와 동일한 값이 저장됨

---

## 영향도 분석

### 기능적 영향

1. **UI 표시**:
   ```javascript
   // src/views/HybridDetection.vue:406
   <div class="part-name">{{ part.part_name || part.part_id }}</div>
   ```
   - `part_name`이 `part_id`와 동일하면 사용자에게 부품명 대신 ID가 표시됨
   - 가독성 저하

2. **검색/필터링**:
   - 부품명 기반 검색 시 문제 없음 (`part_name`이 `part_id`와 동일하므로)
   - 하지만 실제 부품명으로 검색 불가능

3. **데이터 일관성**:
   - `parts_master.part_name` != `lego_parts.name` (데이터 불일치)
   - 다른 테이블(`parts_master_features`)과 일관성 유지 필요

---

## 권장 조치 사항

### 즉시 조치 (권장)

#### 1. parts_master.part_name 업데이트 스크립트
```sql
-- lego_parts 테이블과 JOIN하여 part_name 업데이트
UPDATE parts_master pm
SET part_name = lp.name
FROM lego_parts lp
WHERE pm.part_id = lp.part_num
  AND (pm.part_name = pm.part_id OR pm.part_name IS NULL);

-- 업데이트 결과 확인
SELECT 
  pm.part_id,
  pm.part_name AS old_part_name,
  lp.name AS new_part_name,
  CASE WHEN pm.part_name = lp.name THEN 'OK' ELSE 'UPDATED' END AS status
FROM parts_master pm
JOIN lego_parts lp ON pm.part_id = lp.part_num
LIMIT 10;
```

#### 2. 코드 수정
```javascript
// useMasterPartsPreprocessing.js 수정
// registerElementIdsToPartsMaster 함수에서
// realPartInfo.part_name이 없을 때 part_id와 동일하게 설정하지 않도록

elementIdsToRegister.push({
  element_id: result.element_id,
  part_id: realPartInfo.part_id,
  part_name: realPartInfo.part_name || `LEGO Element ${result.element_id}`,  // part_id와 다름
  // ...
})
```

---

## 결론

### 현재 상태: ⚠️ 의도되지 않은 동일값

1. **원인**: `part_name`이 `part_id`와 동일하게 설정됨 (의도되지 않음)
2. **영향**: UI 표시 및 데이터 일관성 문제
3. **조치**: `lego_parts` 테이블과 JOIN하여 `part_name` 업데이트 권장

### 권장 사항

1. **즉시 조치**: `parts_master.part_name`을 `lego_parts.name`으로 업데이트
2. **코드 개선**: `part_name` 저장 로직 수정 (part_id와 동일하게 설정하지 않도록)
3. **데이터 정합성**: `parts_master_features.part_name`도 동일하게 업데이트 고려

