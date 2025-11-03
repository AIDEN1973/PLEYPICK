# 식별 단계 DB 테이블 분석

## 사용 테이블

### `parts_master_features`
- **목적**: 부품 마스터 데이터 및 AI 메타데이터 저장
- **용도**: 식별 단계에서 벡터 유사도 검색 및 메타데이터 조회

## 주요 컬럼 (식별 단계에서 사용)

### 1. 기본 식별자
- `part_id` (VARCHAR): 부품 번호 (예: "32028")
- `color_id` (INTEGER): 색상 ID (예: 0 = Black)
- `part_name` (VARCHAR): 부품명

### 2. AI 메타데이터
- `feature_json` (JSONB): LLM 생성 메타데이터
  - `shape_tag`: 부품 형태 태그
  - `series`: 시리즈 (system, duplo, technic 등)
  - `stud_count_top`: 상단 스터드 개수
  - `tube_count_bottom`: 하단 튜브 개수
  - `confusions`: 유사한 부품 목록
  - `distinguishing_features`: 구별되는 특징
  - 기타 LLM 생성 필드

### 3. 벡터 임베딩
- `clip_text_emb` (VECTOR(768) 또는 ARRAY): CLIP 텍스트 임베딩 (768차원)
  - **용도**: FAISS Stage-1 (Coarse Search) 주 사용
  - **우선순위**: 최우선
  
- `semantic_vector` (VECTOR(768) 또는 ARRAY): Semantic Vector (768차원)
  - **용도**: 폴백 또는 Stage-2 (Fine Search) 보조
  - **우선순위**: clip_text_emb가 없을 때 사용

### 4. 인식 힌트
- `recognition_hints` (JSONB): 인식 힌트 정보
  - `ko`: 한국어 설명
  - `top_view`: 위에서 본 모습
  - `side_view`: 옆에서 본 모습
  - `unique_features`: 고유 특징

### 5. 신뢰도 및 통계
- `confidence` (DOUBLE): 신뢰도 점수
- `usage_frequency` (INTEGER): 사용 빈도

## 식별 단계 쿼리 패턴

### 패턴 1: 단일 부품 조회
```sql
SELECT 
    part_id, color_id, part_name,
    feature_json, clip_text_emb, semantic_vector,
    recognition_hints, confidence, usage_frequency
FROM parts_master_features
WHERE part_id = '32028'
ORDER BY color_id, confidence DESC;
```

### 패턴 2: BOM 부품 목록 조회 (IN 절)
```sql
SELECT 
    part_id, color_id, feature_json,
    clip_text_emb, semantic_vector
FROM parts_master_features
WHERE part_id IN ('32028', '3001', '3002')  -- BOM 부품 목록
ORDER BY part_id, color_id;
```

### 패턴 3: 벡터 유사도 검색 전 준비
```sql
SELECT 
    part_id, color_id,
    clip_text_emb,  -- Stage-1 검색용
    semantic_vector, -- Stage-2 폴백용
    feature_json
FROM parts_master_features
WHERE part_id = '32028'
  AND (clip_text_emb IS NOT NULL OR semantic_vector IS NOT NULL);
```

## 코드에서의 사용 위치

### HybridDetection.vue:3642-3654
```javascript
const { data } = await supabase
  .from('parts_master_features')
  .select(`
    part_id,
    part_name,
    feature_json,      // ← LLM 메타데이터
    clip_text_emb,     // ← FAISS 검색용
    semantic_vector,    // ← 폴백용
    recognition_hints,
    confidence,
    usage_frequency
  `)
  .in('part_id', bomIds)  // BOM 부품 목록
  .order('confidence', { ascending: false })
  .limit(3);
```

### useHybridCache.js:330-333
```javascript
const { data } = await supabase
  .from('parts_master_features')
  .select('part_id, color_id, feature_json, clip_text_emb, semantic_vector')
  .in('part_id', chunk);
```

## part_id 32028 기준 예시 쿼리

```sql
-- 기본 조회
SELECT * FROM parts_master_features WHERE part_id = '32028';

-- feature_json 상세 조회
SELECT 
    part_id,
    color_id,
    feature_json->>'shape_tag' as shape_tag,
    feature_json->>'series' as series,
    (feature_json->>'stud_count_top')::integer as stud_count_top
FROM parts_master_features
WHERE part_id = '32028';
```

## 로컬 JSON 파일과의 관계

### 로컬 E1/E2 JSON 파일
- **용도**: 품질 검증 및 오프라인 분석
- **식별 단계**: 사용하지 않음

### DB 테이블 (parts_master_features)
- **용도**: 실시간 식별 단계
- **데이터 소스**: LLM 분석 후 DB에 저장된 메타데이터
- **식별 단계**: 필수 (벡터 검색 및 메타데이터 조회)

## 결론

식별 단계에서는 **로컬 JSON 파일을 읽지 않고**, **`parts_master_features` 테이블에서 직접 조회**합니다.

- 로컬 JSON: 품질 검증용
- DB 테이블: 실시간 식별용

