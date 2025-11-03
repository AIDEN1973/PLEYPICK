# 파일별 파이프라인 단계 사용 현황

## 요약

| 파일 타입 | 학습 단계 | 탐지 단계 | 식별 단계 | 품질 검증 |
|----------|---------|---------|---------|----------|
| **WebP 이미지** | ✅ 필수 | ✅ 필수 | ❌ 불필요 | ❌ 불필요 |
| **TXT 라벨** | ✅ 필수 | ❌ 불필요 | ❌ 불필요 | ❌ 불필요 |
| **E1 JSON** | ❌ 불필요 | ❌ 불필요 | ❌ 불필요 | ✅ 필요 (오프라인 QA) |
| **E2 JSON** | ❌ 불필요 | ❌ 불필요 | ❌ 불필요 | ✅ 필요 (Edge 최적화) |
| **EXR 깊이 맵** | ❌ 불필요 | ❌ 불필요 | ❌ 불필요 | ✅ 필요 (품질 검증) |

---

## 상세 분석

### 1. WebP 이미지 파일

#### 학습 단계: ✅ 필수
- **사용 위치**: `scripts/local_yolo_training.py`, `scripts/prepare_training_dataset.py`
- **목적**: YOLO 모델 학습 입력 데이터
- **용도**: 픽셀 데이터를 통해 bbox + polygon 학습
- **형식**: WebP lossy q=90 (기술문서.txt:87)

#### 탐지 단계: ✅ 필수
- **사용 위치**: `src/composables/useYoloDetector.js`, `src/views/HybridDetection.vue`
- **목적**: YOLO 모델 추론 입력
- **파이프라인**:
  ```
  실제 이미지 (WebP)
    ↓
  YOLO(1-class seg) → bbox+mask
  ```

#### 식별 단계: ❌ 불필요
- YOLO 탐지 후 식별은 임베딩 기반이므로 원본 이미지 불필요
- 단, tight-crop된 객체 이미지는 CLIP 임베딩 추출에 사용 (메모리 내)

---

### 2. TXT 라벨 파일

#### 학습 단계: ✅ 필수
- **사용 위치**: `scripts/prepare_training_dataset.py:21-45`
- **목적**: YOLO 지도 학습의 Ground Truth
- **형식**: `class_id center_x center_y width height [polygon_coords]`
- **용도**: 이미지 픽셀 → 좌표 매핑 학습

#### 탐지 단계: ❌ 불필요
- YOLO 추론은 이미지만 필요, 라벨 불필요

#### 식별 단계: ❌ 불필요
- 식별은 벡터 유사도 기반, 라벨 불필요

---

### 3. E1 JSON (Full Meta)

#### 학습 단계: ❌ 불필요
- **확인 위치**: `scripts/prepare_training_dataset.py:176-185`
- **상태**: 메타데이터는 복사만 함, 학습 스크립트에서 읽지 않음
- **이유**: YOLO 학습은 이미지 + 라벨만 필요

#### 탐지 단계: ❌ 불필요
- YOLO 탐지는 이미지만 사용

#### 식별 단계: ❌ 불필요
- **확인 위치**: `src/views/HybridDetection.vue:3642-3654`
- **실제 데이터 소스**: Supabase DB `parts_master_features` 테이블
- **이유**: 로컬 JSON 파일이 아닌 DB에서 직접 조회

#### 품질 검증 단계: ✅ 필요 (오프라인 QA)
- **용도**: 오프라인 품질 분석 및 검증
- **기술문서**: "Full은 오프라인 QA·분석용" (메타데이터.txt:36)

---

### 4. E2 JSON (Essential Meta)

#### 학습 단계: ❌ 불필요
- E1과 동일 (학습에는 메타데이터 불필요)

#### 탐지 단계: ❌ 불필요
- YOLO 탐지는 이미지만 사용

#### 식별 단계: ❌ 불필요
- **확인 위치**: `src/views/HybridDetection.vue:3642-3654`
- **실제 데이터 소스**: Supabase DB에서 조회
- **이유**: 로컬 파일이 아닌 DB 테이블 사용

#### 품질 검증 단계: ✅ 필요 (Edge 최적화)
- **용도**: Edge/운영 환경 최적화용 경량 메타데이터
- **기술문서**: "Edge/운영 권장: Essential JSON(E2) 사용" (메타데이터.txt:36)
- **용도**: 오프라인 QA 및 분석용

---

### 5. EXR 깊이 맵 파일

#### 학습 단계: ❌ 불필요
- **확인 위치**: `scripts/local_yolo_training.py`, `AI_TRAINING_VS_INFERENCE_EMBEDDINGS.md`
- **이유**: YOLO 학습은 이미지 + 라벨만 필요

#### 탐지 단계: ❌ 불필요
- **확인 위치**: `src/composables/useYoloDetector.js`, `src/views/HybridDetection.vue`
- **이유**: YOLO 탐지는 이미지 픽셀만 사용

#### 식별 단계: ❌ 불필요
- **확인 위치**: `src/views/HybridDetection.vue` (전체 코드 검색)
- **결과**: 깊이 맵 사용 코드 없음
- **이유**: 식별은 CLIP 임베딩 + FAISS 검색 기반

#### 품질 검증 단계: ✅ 필요
- **용도**: 렌더링 품질 검증
- **기술문서 기준**: 
  - 깊이 점수 계산 (어노테이션.txt:287-303)
  - 재투영 RMS 계산 (PnP Solver 기반)
- **검증 위치**: `scripts/render_ldraw_to_supabase.py:_calculate_depth_score()`
- **메타데이터 저장**: `quality_metrics.depth_score` (E1/E2 JSON)

---

## 파이프라인별 파일 사용 흐름

### 학습 파이프라인
```
합성 렌더링
  ↓
WebP 이미지 ✅
  ↓
TXT 라벨 ✅
  ↓
YOLO 학습
  ↓
모델 가중치 저장
```

**사용 파일**: WebP 이미지, TXT 라벨만 필요

---

### 탐지 파이프라인
```
실제 이미지 (WebP) ✅
  ↓
YOLO 탐지 (bbox + mask)
  ↓
검출 객체 반환
```

**사용 파일**: WebP 이미지만 필요

---

### 식별 파이프라인
```
YOLO 검출 객체 (bbox)
  ↓
tight-crop (메모리 내 이미지)
  ↓
CLIP 임베딩 추출
  ↓
Supabase DB 조회 (parts_master_features) ← JSON 파일 아님
  ↓
FAISS 검색 (BOM 서브셋)
  ↓
Adaptive Fusion
  ↓
최종 식별 결과
```

**사용 파일**: 로컬 파일 불필요, DB에서 조회

---

### 품질 검증 파이프라인
```
렌더링 완료
  ↓
WebP 이미지 ✅
  ↓
EXR 깊이 맵 ✅
  ↓
카메라 파라미터 (JSON)
  ↓
품질 메트릭 계산
  ├─ SSIM (이미지 기반)
  ├─ SNR (이미지 기반)
  ├─ 재투영 RMS (EXR 깊이 맵 기반)
  └─ 깊이 점수 (EXR 깊이 맵 기반)
  ↓
E1/E2 JSON 저장 ✅
```

**사용 파일**: WebP 이미지, EXR 깊이 맵, E1/E2 JSON 모두 필요

---

## 결론

### 학습 단계
- ✅ **필수**: WebP 이미지, TXT 라벨
- ❌ **불필요**: EXR, E1 JSON, E2 JSON

### 탐지 단계
- ✅ **필수**: WebP 이미지
- ❌ **불필요**: TXT 라벨, EXR, E1 JSON, E2 JSON

### 식별 단계
- ✅ **필수**: DB 테이블 (`parts_master_features`)
- ❌ **불필요**: 모든 로컬 파일 (WebP, TXT, JSON, EXR)

### 품질 검증 단계
- ✅ **필수**: WebP 이미지, EXR 깊이 맵, E1/E2 JSON
- ❌ **불필요**: TXT 라벨

---

## 핵심 정리

1. **EXR 깊이 맵**: 품질 검증 전용 (학습/탐지/식별 모두 불필요)
2. **JSON 파일**: 품질 검증 및 오프라인 분석용 (실시간 추론 불필요)
3. **TXT 라벨**: 학습 전용 (탐지/식별 불필요)
4. **WebP 이미지**: 학습 + 탐지 필수 (식별 단계에서는 메모리 내 crop 이미지 사용)

**참고**: 실시간 추론(탐지+식별)에서는 모든 로컬 파일을 사용하지 않고, DB에서 직접 조회합니다.

