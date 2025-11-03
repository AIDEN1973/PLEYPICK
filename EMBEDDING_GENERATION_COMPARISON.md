# CLIP 임베딩 및 Semantic Vector 생성 경로 비교

## 개요

신규 레고 등록과 metadata-management 페이지의 일괄 생성이 동일한 데이터를 생성하는지 비교 분석합니다.

---

## 1. CLIP 임베딩 (clip_text_emb) 생성 비교

### 신규 레고 등록 경로
**파일**: `src/views/NewLegoRegistration.vue` → `src/composables/useBackgroundLLMAnalysis.js` → `server/worker.js`

**흐름**:
```
1. 사용자 "저장" 버튼 클릭
   ↓
2. startBackgroundAnalysis() 호출
   ↓
3. executeLLMAnalysis() 실행
   ↓
4. LLM 분석 완료 후 worker.js의 processEmbeddingQueue() 실행
   ↓
5. generateClipEmbedding() 함수 사용
```

**코드 위치**: `server/worker.js:121-160`
```javascript
async function generateClipEmbedding(text) {
  const response = await fetch(`${CLIP_SERVICE_URL}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: text,
      model: 'clip-vit-l/14',
      dimensions: 768
    })
  })
  // ... 제로벡터 검증
  return emb
}
```

**특징**:
- CLIP_SERVICE_URL: `process.env.CLIP_SERVICE_URL || 'http://localhost:3021'`
- 입력: `feature_text` (LLM이 생성한 텍스트)
- 제로벡터 검증: norm 체크 후 저장
- 저장: `parts_master_features.clip_text_emb` (VECTOR(768))

---

### metadata-management 일괄 생성 경로
**파일**: `src/components/EmbeddingTab.vue`

**흐름**:
```
1. 사용자 "일괄 생성 시작" 버튼 클릭
   ↓
2. generateBatchVectors() 실행
   ↓
3. 제로벡터 검사 후 직접 CLIP 서비스 호출
```

**코드 위치**: `src/components/EmbeddingTab.vue:732-760`
```javascript
const response = await fetch(`${apiStatus.value.url}/v1/embeddings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: part.feature_text,
    model: 'clip-vit-l/14',
    dimensions: 768
  })
})
// ... 벡터 변환 및 저장
```

**특징**:
- API URL: `http://localhost:3021` (고정값)
- 입력: `feature_text` (DB에 저장된 기존 텍스트)
- 제로벡터 검증: 없음 (API 응답만 확인)
- 저장: `parts_master_features.clip_text_emb` (VECTOR(768))

---

### 비교 결과: CLIP 임베딩

| 항목 | 신규 레고 등록 | metadata-management 일괄 생성 |
|------|---------------|------------------------------|
| **API 엔드포인트** | `/v1/embeddings` | `/v1/embeddings` |
| **API URL** | `http://localhost:3021` (환경변수) | `http://localhost:3021` (고정값) |
| **모델** | `clip-vit-l/14` | `clip-vit-l/14` |
| **차원** | 768 | 768 |
| **입력 데이터** | LLM이 생성한 `feature_text` | DB에 저장된 `feature_text` |
| **제로벡터 검증** | ✅ 있음 (norm 체크) | ❌ 없음 |
| **벡터 변환** | ✅ 숫자 배열 보장 | ✅ 숫자 배열 보장 |
| **저장 방식** | worker.js에서 직접 저장 | 프론트엔드에서 Supabase 업데이트 |

**결론**: 
- ✅ **거의 동일**: 같은 CLIP 서비스를 사용하며 모델과 차원이 동일
- ⚠️ **차이점**: 
  1. 신규 등록은 worker.js에서 제로벡터 검증 후 저장
  2. metadata-management는 프론트엔드에서 직접 호출 및 저장
  3. 입력 텍스트 출처가 다를 수 있음 (LLM 생성 vs DB 저장값)

---

## 2. Semantic Vector 생성 비교

### 신규 레고 등록 경로
**현재 상태**: ❌ **생성 안 함**
- 신규 레고 등록 시 Semantic Vector는 생성되지 않습니다.
- CLIP 임베딩만 생성됩니다.

---

### metadata-management 일괄 생성 경로
**파일**: `src/components/SemanticVectorTab.vue`

**흐름**:
```
1. 사용자 "일괄 생성 시작" 버튼 클릭
   ↓
2. generateBatchVectors() 실행
   ↓
3. 이미지 URL 조회 (part_images 또는 lego_parts)
   ↓
4. /api/semantic-vector API 호출
   ↓
5. 512차원 FGC 벡터를 768차원으로 확장 (앞부분 반복 방식)
   ↓
6. L2 정규화 후 저장
```

**코드 위치**: `src/components/SemanticVectorTab.vue:1010-1070`
```javascript
const response = await fetch('/api/semantic-vector', {
  method: 'POST',
  body: JSON.stringify({
    imageUrl: imageUrl,
    partId: part.part_id,
    colorId: part.color_id
  })
})

// 512차원 → 768차원 확장
if (finalVector.length === 512) {
  const front256 = finalVector.slice(0, 256)
  const scale = 0.1
  const extended256 = front256.map(v => v * scale)
  finalVector = [...finalVector, ...extended256]
}

// L2 정규화
const norm = Math.sqrt(finalVector.reduce(...))
finalVector = finalVector.map(v => v / norm)
```

**비교 결과: Semantic Vector**

| 항목 | 신규 레고 등록 | metadata-management 일괄 생성 |
|------|---------------|------------------------------|
| **생성 여부** | ❌ 생성 안 함 | ✅ 생성함 |
| **API 엔드포인트** | N/A | `/api/semantic-vector` |
| **입력 데이터** | N/A | 이미지 URL |
| **차원 확장** | N/A | 512D → 768D (앞부분 반복) |
| **정규화** | N/A | ✅ L2 정규화 |

**결론**: 
- ⚠️ **차이 있음**: 신규 레고 등록 시 Semantic Vector는 생성되지 않습니다.
- metadata-management에서만 수동으로 생성 가능합니다.

---

## 3. 데이터 일관성 권장사항

### 현재 문제점
1. 신규 레고 등록 시 Semantic Vector 미생성
2. metadata-management에서 생성된 Semantic Vector와 신규 등록 시 생성되지 않아 데이터 불일치 가능

### 권장 수정사항

#### Option 1: 신규 등록 시 Semantic Vector도 자동 생성
`src/composables/useBackgroundLLMAnalysis.js` 또는 `server/worker.js`에 Semantic Vector 생성 로직 추가:

```javascript
// worker.js에 추가
async function generateSemanticVector(imageUrl, partId, colorId) {
  const response = await fetch(`${SEMANTIC_VECTOR_SERVICE_URL}/api/semantic-vector`, {
    method: 'POST',
    body: JSON.stringify({ imageUrl, partId, colorId })
  })
  // ... 512D → 768D 확장 및 정규화
  return expandedVector
}
```

#### Option 2: 두 경로의 CLIP 임베딩 검증 로직 통일
`EmbeddingTab.vue`에 제로벡터 검증 추가:

```javascript
// generateBatchVectors()에 추가
const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
if (norm < 0.01) {
  throw new Error('제로벡터 감지: 임베딩 생성 실패')
}
```

---

## 4. 최종 결론

### CLIP 임베딩 (clip_text_emb)
- ✅ **거의 동일**: 같은 API, 모델, 차원 사용
- ⚠️ **미세한 차이**: 검증 로직과 저장 경로가 다름

### Semantic Vector
- ❌ **불일치**: 신규 등록 시 생성 안 함, metadata-management에서만 생성

### 권장 조치
1. 두 경로의 제로벡터 검증 로직 통일
2. 신규 레고 등록 시 Semantic Vector도 자동 생성하도록 추가

