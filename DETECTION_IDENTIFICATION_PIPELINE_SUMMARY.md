# 실제 탐지 및 식별 파이프라인 요약

## 사용자 질문
"실제 탐지, 식별에 사용되는 데이터는 학습된 YOLO 모델, 이후에 AI 메타데이터와 CLIP 임베딩으로 식별하는거네? 맞니?"

**답변: ✅ 맞습니다!**

---

## 파이프라인 구조

### 1단계: 탐지 (Detection)
**사용 데이터**: **학습된 YOLO 모델**

#### 모델 정보
- **소스**: Supabase Storage (`model_registry` 테이블)
- **모델 타입**: 2단계 하이브리드 구조
  - **Stage 1 (YOLO11n-seg)**: 빠른 전체 스캔 (conf=0.10)
  - **Stage 2 (YOLO11s-seg)**: 정밀 검증 (conf=0.25)
- **형식**: ONNX 파일 (.onnx)
- **입력**: 실시간 이미지 (카메라 또는 업로드)
- **출력**: 바운딩 박스, 세그멘테이션, confidence

#### 코드 위치
- `src/composables/useOptimizedRealtimeDetection.js:128-168`
- `src/composables/useYoloDetector.js`

---

### 2단계: 식별 (Identification)
**사용 데이터**: **AI 메타데이터 + CLIP 임베딩**

#### 데이터 소스
- **테이블**: `parts_master_features`
- **조회 필드**:
  1. `feature_json`: LLM 생성 메타데이터
     - shape_tag, stud_count_top, tube_count_bottom
     - color, size, recognition_hints 등
  2. `clip_text_emb`: CLIP 임베딩 (768D)
     - 벡터 유사도 계산용 (코사인 유사도)
  3. `semantic_vector`: Semantic Vector (768D, 폴백용)

#### 식별 프로세스
1. **BOM 필터링**: `set_parts` 테이블에서 세트 부품 목록 조회
2. **AI 메타데이터 조회**: `parts_master_features`에서 BOM 부품의 메타데이터 조회
3. **벡터 유사도 계산**: 
   - 검출 객체의 `clip_embedding` vs DB의 `clip_text_emb`
   - 코사인 유사도 계산 (`calculateCosineSimilarity`)
   - 유사도 임계값: 0.75 이상
4. **Adaptive Fusion**: 
   - YOLO confidence + 벡터 유사도 + 메타데이터 특성 결합
   - 최종 점수 계산 및 매칭

#### 코드 위치
- `src/views/HybridDetection.vue:3627-3757` (`getAIMetadataForDetection`)
- `src/views/HybridDetection.vue:3726-3727` (코사인 유사도 계산)

---

## 데이터 흐름

```
실시간 이미지 (카메라/업로드)
  ↓
[탐지 단계]
  ↓
YOLO 모델 (ONNX) - Supabase Storage
  ↓
바운딩 박스 + 세그멘테이션 + confidence
  ↓
[식별 단계]
  ↓
BOM 부품 목록 (set_parts 테이블)
  ↓
AI 메타데이터 조회 (parts_master_features)
  - feature_json (LLM 메타데이터)
  - clip_text_emb (CLIP 임베딩 768D)
  - semantic_vector (폴백용 768D)
  ↓
벡터 유사도 계산 (코사인 유사도)
  ↓
Adaptive Fusion (최종 점수 계산)
  ↓
부품 식별 결과
```

---

## 정확한 답변

### 질문: "실제 탐지, 식별에 사용되는 데이터는 학습된 YOLO 모델, 이후에 AI 메타데이터와 CLIP 임베딩으로 식별하는거네?"

**답변: ✅ 맞습니다!**

#### 정확한 구조:
1. **탐지 (Detection)**:
   - ✅ **학습된 YOLO 모델** 사용 (2단계: Stage1 빠른 스캔, Stage2 정밀 검증)

2. **식별 (Identification)**:
   - ✅ **AI 메타데이터** (`feature_json`): LLM 생성 메타데이터
   - ✅ **CLIP 임베딩** (`clip_text_emb`): 벡터 유사도 계산용 (768D)
   - ✅ **Semantic Vector** (`semantic_vector`): 폴백용 (768D)

#### 추가 정보:
- **BOM 제약**: 식별은 BOM에 포함된 부품만 대상 (폐쇄 환경)
- **벡터 검색**: FAISS Two-Stage 검색 사용 (로컬 인덱스)
- **최종 매칭**: YOLO confidence + 벡터 유사도 + 메타데이터 특성 결합

---

## 관련 문서
- `REAL_TIME_DETECTION_IDENTIFICATION_DATA.md`: 상세 데이터 소스 설명
- `E1_E2_JSON_VS_DB_TABLE_CLARIFICATION.md`: DB 테이블과 JSON 파일 관계

