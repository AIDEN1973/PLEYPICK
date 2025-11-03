# E1/E2 JSON vs DB 테이블 관계 명확화

## 문제
"E1/E2 JSON을 식별 단계에서 DB에서 직접 조회한다"는 표현이 오해의 소지가 있음

---

## 실제 상황

### E1/E2 JSON 파일의 저장 위치

#### E1 JSON (Full Meta)
- **로컬 파일**: `output/synthetic/{SET_ID}/meta/{element_id}/{uuid}.json`
- **DB 저장**: `synthetic_dataset.metadata` 필드 (JSONB)
- **식별 단계 사용**: ❌ 사용 안 함

#### E2 JSON (Essential Meta)
- **로컬 파일**: `output/synthetic/{SET_ID}/meta-e/{element_id}/{uuid}_e2.json`
- **DB 저장**: ❌ 저장되지 않음
- **식별 단계 사용**: ❌ 사용 안 함

---

## 식별 단계에서 실제 사용하는 데이터

### 테이블: `parts_master_features`

**E1/E2 JSON 파일이 아닌, 별도의 DB 테이블에서 조회**

```sql
SELECT 
    part_id,
    part_name,
    feature_json,        -- LLM 생성 메타데이터 (JSONB)
    clip_text_emb,       -- CLIP 임베딩 (768D 벡터)
    semantic_vector,     -- Semantic Vector (768D 벡터)
    recognition_hints,   -- 인식 힌트 (JSONB)
    confidence,
    usage_frequency
FROM parts_master_features
WHERE part_id IN ({bom_part_ids})
```

---

## 데이터 흐름

### 렌더링 → DB 저장
```
합성 렌더링
  ↓
E1 JSON 생성 (로컬 파일)
  ↓
synthetic_dataset.metadata 필드에 저장 (DB)
  ↓
parts_master_features.feature_json에 LLM 메타 추출하여 저장 (DB)
```

### 식별 단계 데이터 소스
```
식별 단계
  ↓
parts_master_features 테이블 조회 ✅
  ↓
feature_json, clip_text_emb, semantic_vector 사용
```

**중요**: E1/E2 JSON 파일은 읽지 않음

---

## 구분 요약

| 항목 | 로컬 파일 | DB 테이블 | 식별 단계 사용 |
|-----|---------|----------|--------------|
| **E1 JSON** | ✅ `output/synthetic/.../meta/*.json` | ✅ `synthetic_dataset.metadata` | ❌ 사용 안 함 |
| **E2 JSON** | ✅ `output/synthetic/.../meta-e/*_e2.json` | ❌ 없음 | ❌ 사용 안 함 |
| **AI 메타데이터** | ❌ 없음 | ✅ `parts_master_features.feature_json` | ✅ 사용 |
| **CLIP 임베딩** | ❌ 없음 | ✅ `parts_master_features.clip_text_emb` | ✅ 사용 |
| **Semantic Vector** | ❌ 없음 | ✅ `parts_master_features.semantic_vector` | ✅ 사용 |

---

## 결론

### 정확한 표현
- ❌ "E1/E2 JSON을 DB에서 조회"
- ✅ "`parts_master_features` 테이블에서 구조화된 데이터 조회"

### 실제 관계
1. E1 JSON의 일부 내용(LLM 메타데이터)이 `parts_master_features.feature_json`에 저장됨
2. 하지만 E1/E2 JSON 파일 자체는 식별 단계에서 읽지 않음
3. 식별 단계는 `parts_master_features` 테이블의 구조화된 컬럼들을 직접 조회

---

## 코드 확인

### 식별 단계 실제 코드
**`src/views/HybridDetection.vue:3642-3656`**:
```javascript
const { data } = await supabase
  .from('parts_master_features')  // ← E1/E2 JSON이 아닌 별도 테이블
  .select(`
    part_id,
    part_name,
    feature_json,      // ← E1 JSON의 일부 내용과 유사하나 구조 다름
    clip_text_emb,
    semantic_vector,
    recognition_hints,
    confidence,
    usage_frequency
  `)
  .in('part_id', bomIds)
```

### E1 JSON 저장 코드 (참고용)
**`scripts/render_ldraw_to_supabase.py:5503`**:
```python
metadata_record = {
    'part_id': part_id,
    'metadata': json.dumps(metadata),  # ← E1 JSON 전체를 synthetic_dataset.metadata에 저장
    ...
}
result = self.supabase.table('synthetic_dataset').insert(metadata_record).execute()
```

**주의**: `synthetic_dataset.metadata`는 식별 단계에서 조회하지 않음

