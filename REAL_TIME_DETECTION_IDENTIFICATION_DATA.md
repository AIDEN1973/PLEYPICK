# 실제 탐지 및 식별에 사용되는 데이터 (매장 환경)

## 개별 매장에서 레고 검수 시 사용하는 데이터

**핵심 원칙**: 로컬 파일 시스템에 의존하지 않고, 모든 데이터는 Supabase에서 가져옴

---

## 1. 탐지 단계 (Detection)

### 입력 데이터
- **실시간 이미지**: 매장에서 촬영한 이미지 (카메라 또는 업로드)
  - 형식: Base64 Data URL 또는 Blob
  - 처리: 메모리 내에서 처리 (파일 저장 불필요)

### YOLO 모델
- **소스**: Supabase Storage
- **테이블**: `model_registry`
  - 필드: `model_url`, `model_path`, `model_stage`
  - 조회 조건: `status = 'active'` AND `model_stage = 'stage1'` 또는 `'stage2'`
- **다운로드 경로**:
  ```
  {VITE_SUPABASE_URL}/storage/v1/object/public/models/{model_path}
  ```
- **형식**: ONNX 파일 (.onnx)
- **용도**: 
  - Stage 1: 빠른 전체 스캔 (conf=0.15)
  - Stage 2: 정밀 검증 (conf=0.5)

### 코드 위치
- `src/composables/useYoloDetector.js:148-209`
  ```javascript
  const { data: activeModel } = await supabase
    .from('model_registry')
    .select('model_url, model_path, model_name, model_stage')
    .eq('status', 'active')
    .eq('model_stage', stage)  // 'stage1' 또는 'stage2'
  ```

---

## 2. 식별 단계 (Identification)

### BOM 데이터 (Bill of Materials)
- **테이블**: `lego_sets`, `set_parts`
- **조회 방식**:
  ```sql
  -- 세트 번호로 조회
  SELECT * FROM lego_sets WHERE set_num = '76917'
  
  -- 세트의 부품 목록 조회
  SELECT 
    element_id,
    part_id,
    color_id,
    quantity,
    lego_parts(part_num, name),
    lego_colors(name, rgb)
  FROM set_parts
  WHERE set_id = {set_id}
  ```
- **용도**: 폐쇄 환경 검색 (BOM에 포함된 부품만 식별)

### AI 메타데이터 (식별용)
- **테이블**: `parts_master_features` (E1/E2 JSON 파일이 아님)
- **조회 필드**:
  ```sql
  SELECT 
    part_id,
    part_name,
    feature_json,        -- LLM 생성 메타 (shape_tag, stud_count_top 등)
    clip_text_emb,        -- CLIP 임베딩 (768D, FAISS 검색용)
    semantic_vector,      -- Semantic Vector (768D, 폴백용)
    recognition_hints,    -- 인식 힌트 (JSONB)
    confidence,
    usage_frequency
  FROM parts_master_features
  WHERE part_id IN ({bom_part_ids})
  ```
- **용도**: 
  - FAISS Two-Stage 검색 (Stage-1: clip_text_emb, Stage-2: semantic_vector)
  - Adaptive Fusion (feature_json의 메타데이터 사용)

**중요: E1/E2 JSON 파일과의 관계**
- **E1 JSON**: `synthetic_dataset.metadata` 필드에 저장되지만, 식별 단계에서는 사용 안 함
- **E2 JSON**: DB에 저장되지 않음 (로컬 파일만)
- **식별 단계**: `parts_master_features` 테이블에서 구조화된 데이터 조회
  - E1/E2 JSON 파일의 내용 중 일부(LLM 메타데이터)가 `parts_master_features.feature_json`에 저장됨
  - 하지만 E1/E2 JSON 파일 자체는 읽지 않음

### 코드 위치
- `src/views/HybridDetection.vue:3642-3654`
  ```javascript
  const { data } = await supabase
    .from('parts_master_features')
    .select(`
      part_id,
      part_name,
      feature_json,
      clip_text_emb,
      semantic_vector,
      recognition_hints,
      confidence,
      usage_frequency
    `)
    .in('part_id', bomIds)  // BOM 부품 ID 목록
  ```

---

## 3. 로컬 캐시 (선택적 최적화)

### IndexedDB 캐시
- **용도**: 네트워크 최적화 (선택적)
- **저장 데이터**: 벡터 임베딩 (clip_text_emb, semantic_vector)
- **테이블**: 로컬 IndexedDB
- **동작 방식**:
  1. BOM 부품 벡터를 사전 로드 (Prefetch)
  2. 로컬 캐시에 저장
  3. 식별 시 캐시 우선 사용, 없으면 DB 조회
- **코드 위치**: `src/composables/useHybridCache.js:311-372`

### 중요: 캐시는 선택적
- **캐시 없어도 동작**: DB에서 직접 조회 가능
- **캐시의 장점**: 네트워크 요청 감소, 속도 향상
- **캐시 실패 시**: 자동으로 DB 조회로 폴백

---

## 4. 데이터 흐름 (매장 환경)

### 전체 파이프라인
```
[1] 매장 촬영 이미지 (메모리)
    ↓
[2] YOLO 모델 다운로드 (Supabase Storage)
    ↓
[3] 탐지 실행 (bbox + mask)
    ↓
[4] 세트 번호 입력 → BOM 데이터 조회 (set_parts, lego_sets)
    ↓
[5] BOM 부품 벡터 사전 로드 (parts_master_features)
    ↓
[6] FAISS 검색 + Adaptive Fusion
    ↓
[7] 식별 결과 출력
```

### 실제 사용 테이블 요약
| 단계 | 테이블 | 필드 | 용도 |
|-----|--------|------|------|
| **탐지** | `model_registry` | `model_url`, `model_path` | YOLO 모델 다운로드 |
| **BOM 로드** | `lego_sets` | `set_num`, `name` | 세트 정보 |
| **BOM 로드** | `set_parts` | `part_id`, `color_id`, `quantity` | 부품 목록 |
| **식별** | `parts_master_features` | `clip_text_emb`, `semantic_vector`, `feature_json` | 벡터 검색 및 메타데이터 |

---

## 5. 로컬 파일 불필요 항목

### ❌ 사용하지 않는 로컬 파일 (탐지/식별 단계)
1. **WebP 이미지** (합성 렌더링): 사용 안 함 (실시간 촬영 이미지만 사용)
2. **TXT 라벨**: YOLO 추론에는 라벨 불필요
3. **E1/E2 JSON 파일**: 로컬 파일 자체는 사용 안 함
   - **주의**: 식별 단계에서는 E1/E2 JSON 파일이 아닌 DB 테이블에서 직접 조회
   - **테이블**: `parts_master_features` (E1/E2 JSON과 다른 구조)
4. **EXR 깊이 맵**: 식별 단계에서 불필요

**E1/E2 JSON vs DB 테이블 구분**
- **E1 JSON 파일**: `synthetic_dataset.metadata` 필드에 저장되지만, 식별 단계에서 사용 안 함
- **E2 JSON 파일**: DB에 저장되지 않음 (로컬 파일만)
- **식별 단계 실제 사용**: `parts_master_features` 테이블
  - `feature_json`: LLM 생성 메타데이터 (E1 JSON의 일부 필드와 유사하나 구조 다름)
  - `clip_text_emb`: CLIP 임베딩 (FAISS 검색용)
  - `semantic_vector`: Semantic Vector (폴백용)
  - `recognition_hints`: 인식 힌트

**참고: TXT 라벨은 학습 단계에서만 사용됨**
- **학습 단계**: ✅ 필수 (Ground Truth)
  - YOLO 모델 학습 시 이미지와 함께 사용
  - 형식: `class_id center_x center_y width height [polygon_coords]`
  - 위치: `scripts/prepare_training_dataset.py`, `scripts/local_yolo_training.py`
- **탐지 단계**: ❌ 불필요 (YOLO 추론은 이미지만 필요)
- **식별 단계**: ❌ 불필요 (벡터 유사도 기반)

### ✅ 필요한 데이터 (모두 Supabase)
1. **YOLO 모델**: Supabase Storage
2. **BOM 데이터**: `lego_sets`, `set_parts` 테이블
3. **AI 메타데이터**: `parts_master_features` 테이블
4. **입력 이미지**: 메모리 내 처리 (파일 저장 불필요)

---

## 6. 확인 SQL 쿼리

### 활성 YOLO 모델 확인
```sql
SELECT 
    id,
    model_name,
    version,
    model_stage,
    model_url,
    model_path,
    status
FROM model_registry
WHERE status = 'active'
ORDER BY 
    CASE model_stage 
        WHEN 'stage1' THEN 1 
        WHEN 'stage2' THEN 2 
        ELSE 3 
    END,
    created_at DESC;
```

### BOM 데이터 확인
```sql
-- 세트 정보
SELECT set_num, name, year, num_parts
FROM lego_sets
WHERE set_num = '76917';

-- 세트 부품 목록
SELECT 
    sp.part_id,
    sp.color_id,
    sp.quantity,
    lp.name as part_name,
    lc.name as color_name
FROM set_parts sp
JOIN lego_sets ls ON sp.set_id = ls.id
LEFT JOIN lego_parts lp ON sp.part_id = lp.part_num
LEFT JOIN lego_colors lc ON sp.color_id = lc.id
WHERE ls.set_num = '76917';
```

### 식별 데이터 확인
```sql
-- BOM 부품의 AI 메타데이터
SELECT 
    part_id,
    color_id,
    feature_json->>'shape_tag' as shape_tag,
    feature_json->>'series' as series,
    array_length(clip_text_emb, 1) as clip_dim,
    array_length(semantic_vector, 1) as semantic_dim,
    confidence
FROM parts_master_features
WHERE part_id IN (
    SELECT DISTINCT part_id 
    FROM set_parts 
    WHERE set_id = (SELECT id FROM lego_sets WHERE set_num = '76917')
)
ORDER BY confidence DESC;
```

---

## 결론

### 필수 데이터 (모두 Supabase)
1. ✅ **YOLO 모델**: `model_registry` → Supabase Storage
2. ✅ **BOM 데이터**: `lego_sets`, `set_parts` 테이블
3. ✅ **AI 메타데이터**: `parts_master_features` 테이블
4. ✅ **입력 이미지**: 매장 촬영 (메모리 내 처리)

### 불필요한 데이터
- ❌ 로컬 파일 시스템 (합성 데이터셋 파일)
- ❌ 로컬 모델 파일 (첫 다운로드 후 메모리에 로드)
- ❌ 로컬 캐시 (선택적 최적화, 없어도 동작)

**매장 환경에서는 모든 데이터를 Supabase에서 가져오므로, 로컬 파일 시스템이 없어도 정상 동작합니다.**

