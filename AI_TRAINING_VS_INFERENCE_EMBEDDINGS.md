# AI 학습 vs 추론에서의 CLIP 임베딩 및 Semantic Vector 사용

## 요약

**학습 단계**: CLIP 임베딩과 Semantic Vector는 **직접 사용하지 않습니다**
- YOLO 학습은 이미지와 라벨(bbox, polygon)만 사용
- 학습 데이터셋 준비 시 임베딩 불필요

**추론 단계**: CLIP 임베딩과 Semantic Vector는 **필수로 사용됩니다**
- YOLO 탐지 후 식별(Identification)에 사용
- FAISS Two-Stage 검색에 사용
- Adaptive Fusion에 사용

---

## 1. AI 학습 단계

### YOLO 학습 파이프라인

**파일**: `scripts/local_yolo_training.py`, `scripts/prepare_training_dataset.py`

**학습 입력 데이터**:
- 이미지: WebP 형식 (합성 데이터)
- 라벨: YOLO 형식 (bbox + polygon)
  ```
  class_id center_x center_y width height [polygon_coords]
  ```

**학습 프로세스**:
```
1. 이미지 파일 수집 (output/synthetic/element_id/images/*.webp)
2. 라벨 파일 변환/복사 (JSON → YOLO txt)
3. Train/Val 분할 (80/20)
4. YOLOv8 모델 학습 (이미지 + 라벨만 사용)
```

**CLIP/Semantic Vector 사용 여부**: ❌ **사용 안 함**

**이유**:
- YOLO는 지도 학습(Supervised Learning)으로 이미지와 라벨만 필요
- 임베딩은 추론 단계에서 사용

---

## 2. 추론 단계 (Detection + Identification)

### Hybrid Detection 파이프라인

**파일**: `src/views/HybridDetection.vue`, `src/composables/useHybridCache.js`

**전체 흐름** (기술문서.txt 기준):
```
입력(WebP 프레임)
  ↓
YOLO(1-class seg) → bbox+mask (탐지)
  ↓
tight-crop(마스크 정규화)
  ↓
임베딩 추출: CLIP(운영 기본) / FGC(연구·보조)  ← 여기서 사용!
  ↓
FAISS(HNSW) 검색: BOM 서브셋 (Two-Stage)  ← 여기서 사용!
  ↓
Adaptive Fusion(img/meta/txt + topo_penalty)  ← 여기서 사용!
  ↓
BOM 제약 + 헝가리안 매칭
  ↓
누락/초과 산출
```

### CLIP 임베딩 사용 위치

**1. 검출 객체 임베딩 추출**:
```javascript
// HybridDetection.vue:1133-1140
let queryEmbedding = detection.features?.clip_embedding || 
                     detection.features?.shape_vector || 
                     null
```

**2. FAISS Two-Stage 검색**:
```javascript
// HybridDetection.vue:1153-1170
if (queryEmbedding && bomPartEmbedding && bomPartEmbedding.embedding) {
  // FAISS 검색 수행
  // CLIP 임베딩으로 벡터 유사도 계산
}
```

**3. BOM 매칭 점수 계산**:
```javascript
// HybridDetection.vue:1650-1666
const hybridScore = await compareLocalVectors(detection, bomPart)
// 또는
const hybridScore = await compareRemoteVectors(detection, bomPart)

// 최종 점수: YOLO 신뢰도(30%) + 벡터 유사도(70%)
score = (yoloConfidence * 0.3) + (hybridScore * 0.7)
```

### Semantic Vector 사용 위치

**1. 폴백 매칭**:
```javascript
// HybridDetection.vue:3703-3727
const queryEmbedding = detection.features.clip_embedding
const candidateEmbedding = candidate.clip_text_emb || candidate.semantic_vector

// 코사인 유사도 계산
const similarity = calculateCosineSimilarity(queryEmbedding, candidateEmbedding)
```

**2. Hybrid Cache (로컬 캐시)**:
```javascript
// useHybridCache.js:332-365
const { data } = await supabase
  .from('parts_master_features')
  .select('clip_text_emb, semantic_vector')

// semantic_vector 폴백 적용
let shapeVec = fj.shape_vector || fj.shape || row.semantic_vector || null
```

---

## 3. FAISS Two-Stage 검색

### Stage-1: Coarse Search (CLIP 임베딩 사용)

**목적**: BOM 내에서 빠른 후보 필터링

**입력**:
- Query: 검출 객체의 CLIP 임베딩 (768D)
- Database: BOM 부품들의 `clip_text_emb` (768D)

**출력**: Top-5 후보 (HNSW 인덱스 사용)

### Stage-2: Fine Search (Semantic Vector 사용, 선택적)

**목적**: 상세 유사도 계산 및 Fusion

**입력**:
- Query: 검출 객체의 Semantic Vector 또는 CLIP 임베딩
- Database: BOM 부품들의 `semantic_vector` 또는 `clip_text_emb`

**출력**: 최종 유사도 점수

---

## 4. Adaptive Feature Fusion

### Fusion 입력 데이터

**기술문서.txt**:
```
Adaptive Fusion(img/meta/txt + topo_penalty + area_consistency)
```

**사용되는 임베딩**:
1. **이미지 임베딩**: CLIP 임베딩 (검출 객체)
2. **메타데이터**: `clip_text_emb` (BOM 부품)
3. **Semantic Vector**: `semantic_vector` (폴백 또는 보조)

**Fusion 가중치**:
- YOLO 신뢰도: 30%
- 벡터 유사도: 70%

---

## 5. 왜 학습에는 필요 없나요?

### YOLO 학습 특성

**지도 학습 (Supervised Learning)**:
- 입력: 이미지 픽셀 데이터
- 출력: bbox 좌표 + polygon 좌표
- 학습 목표: 픽셀 → 좌표 매핑

**임베딩 불필요 이유**:
- YOLO는 이미지의 픽셀 정보만으로 학습 가능
- 라벨(bbox, polygon)이 학습 신호를 제공
- 임베딩은 식별(Identification)에만 필요

### 반면 추론에서는 왜 필요한가?

**식별(Identification) 문제**:
- YOLO는 "어디에 있는지"만 알려줌 (탐지)
- "무엇인지"는 임베딩 유사도로 판단 (식별)

**예시**:
```
YOLO 출력: bbox [100, 200, 50, 50] (어디에)
  ↓
CLIP 임베딩 추출
  ↓
FAISS 검색 → "이 부품은 '3001-0'입니다" (무엇인지)
```

---

## 6. 데이터 흐름 다이어그램

### 학습 파이프라인
```
합성 이미지 (WebP)
  ↓
라벨 변환 (JSON → YOLO txt)
  ↓
Train/Val 분할
  ↓
YOLO 학습
  ↓
모델 가중치 저장
```

### 추론 파이프라인
```
실제 이미지 (WebP)
  ↓
YOLO 탐지 (bbox + mask)
  ↓
검출 객체 crop
  ↓
CLIP 임베딩 추출  ← 필수
  ↓
BOM 부품 clip_text_emb 조회  ← 필수
  ↓
FAISS 검색 (Top-5)
  ↓
Semantic Vector 조회 (선택적)  ← 보조
  ↓
Adaptive Fusion
  ↓
헝가리안 매칭
  ↓
최종 식별 결과
```

---

## 7. 결론

### 학습 단계
- ❌ CLIP 임베딩: **불필요**
- ❌ Semantic Vector: **불필요**
- ✅ 이미지 + 라벨만 필요

### 추론 단계
- ✅ CLIP 임베딩: **필수**
- ✅ Semantic Vector: **보조/폴백**
- ✅ FAISS 검색: **필수**
- ✅ Adaptive Fusion: **필수**

### 권장 사항

**학습 전 확인**:
- [ ] 학습 이미지 준비 (WebP)
- [ ] 라벨 파일 준비 (YOLO 형식)
- [ ] Train/Val 분할 완료

**추론 전 확인**:
- [ ] CLIP 임베딩 생성 완료 (`clip_text_emb`)
- [ ] Semantic Vector 생성 완료 (`semantic_vector`, 선택적)
- [ ] FAISS 인덱스 구축 완료
- [ ] BOM 부품 메타데이터 준비

---

## 참고

- 기술문서.txt: "임베딩 추출: CLIP(운영 기본) / FGC(연구·보조)"
- HybridDetection.vue: FAISS Two-Stage + Adaptive Fusion 구현
- useHybridCache.js: 로컬 캐시 및 벡터 비교 로직

