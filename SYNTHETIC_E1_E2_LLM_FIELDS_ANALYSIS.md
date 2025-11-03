# 합성 렌더링 E1/E2 메타 LLM 필드 필요성 분석

## 분석 목적
합성 렌더링으로 생성된 E1/E2 메타데이터에 LLM 기반 필드(`shape_tag`, `series`, `stud_count_top`, `tube_count_bottom` 등) 추가가 필요한지 객관적·정밀 분석

---

## 1. E1/E2 메타데이터 용도 확인

### 기술문서 정의
**database/메타데이터.txt:36**:
> Edge/운영 권장: Essential JSON(E2) 사용, Full은 오프라인 QA·분석용.

**결론**: 
- **E2 (Essential)**: Edge/운영 환경에서 실제 사용 (경량화)
- **E1 (Full)**: 오프라인 QA 및 분석용 (상세 메타)

---

## 2. 학습 단계에서의 사용 여부

### YOLO 학습 입력 데이터
**AI_TRAINING_VS_INFERENCE_EMBEDDINGS.md:22-35**:
- 이미지: WebP 형식
- 라벨: YOLO 형식 (bbox + polygon)
- **메타데이터 JSON**: ❌ **사용하지 않음**

**scripts/prepare_training_dataset.py:176-185**:
- 메타데이터는 복사만 함 (`shutil.copy2`)
- 학습 스크립트에서 읽지 않음
- YOLO 학습에는 이미지와 라벨만 사용

**결론**: 
- 학습 단계에서는 **E1/E2 메타 불필요**
- LLM 필드 추가 **불필요**

---

## 3. 추론 단계에서의 사용 여부

### 데이터 소스 확인

**src/views/HybridDetection.vue:3627-3654**:
```javascript
const { data } = await supabase
  .from('parts_master_features')  // ← DB 테이블에서 조회
  .select(`
    part_id,
    part_name,
    feature_json,  // ← 여기에 LLM 필드 포함
    clip_text_emb,
    semantic_vector,
    recognition_hints,
    confidence
  `)
  .in('part_id', bomIds)
```

**src/views/HybridDetection.vue:2072-2073**:
```javascript
color_lab: aiMetadata.feature_json?.color || null,
size_stud: aiMetadata.feature_json?.size || null,
```

**src/composables/useAdaptiveFusion.js:193-208**:
```javascript
const adjustWeightsByPartType = (partMetadata) => {
  // stud_count_top 사용
  if (partMetadata.stud_count_top <= 1) {
    adjustedWeights.meta = 0.20
    adjustedWeights.txt = 0.20
  }
  else if (partMetadata.stud_count_top >= 2) {
    adjustedWeights.meta = 0.30
    adjustedWeights.txt = 0.10
  }
}

const calculateTopoPenalty = (queryMask, partMetadata) => {
  // tube_count_bottom 사용
  const tubeCount = partMetadata.tube_count_bottom || 0
  // ...
}
```

**database/기술문서.txt:191-195**:
```
5.3 topo_penalty & area_consistency

topo_applicable=true인 파츠에서 상면 구멍 수 vs 하부 튜브 수 비교
차이 0 → 0 / 차이 1 → -0.03 / 차이 ≥2 → -0.06~-0.08
```

**결론**:
- 추론 단계에서는 **`parts_master_features` 테이블**에서 메타 조회
- **E1/E2 JSON 파일을 직접 읽지 않음**
- LLM 필드는 **DB 테이블의 `feature_json`**에 저장되어 사용됨

---

## 4. 데이터 흐름 분석

### 합성 데이터셋 생성 → 학습 → 추론 흐름

```
[합성 렌더링]
  ↓
E1/E2 메타 생성 (렌더링 메타만)
  ↓
prepare_training_dataset.py
  ↓
학습 데이터셋 준비 (메타 복사, 사용 안 함)
  ↓
YOLO 학습 (이미지 + 라벨만)
  ↓
모델 저장
  ↓
[추론 단계]
  ↓
parts_master_features 테이블 조회  ← 여기서 LLM 필드 사용
  ↓
Adaptive Fusion (stud_count_top, tube_count_bottom 등 사용)
```

**핵심 발견**:
- E1/E2 파일은 학습 데이터셋에 복사되지만 **실제로 사용되지 않음**
- 추론은 **DB 테이블에서 직접 조회**
- E1/E2 파일과 DB 테이블은 **분리된 데이터 소스**

---

## 5. LLM 필드의 실제 사용처

### 필수 사용 위치

**1. Adaptive Fusion 가중치 조정**:
- `stud_count_top` → 메타/텍스트 가중치 조정
- 기술문서 5.2: 타일/프린트 vs 스터드/튜브 구분

**2. Topo Penalty 계산**:
- `tube_count_bottom` → 토폴로지 페널티 계산
- 기술문서 5.3: 상면 구멍 vs 하부 튜브 비교

**3. Area Consistency 보너스**:
- `area_px` → 면적 일치 보너스
- 기술문서 5.3: 예상 면적 ±30% 범위 확인

**4. BOM 제약 필터링**:
- `shape_tag`, `series` → 부품 카테고리 필터링
- (간접 사용 가능)

### 데이터 소스
- **사용 위치**: `parts_master_features.feature_json`
- **저장 위치**: DB 테이블 (신규 레고 등록 시 LLM 분석으로 생성)
- **E1/E2 파일**: 사용하지 않음

---

## 6. 객관적 필요성 분석

### 시나리오별 검증

#### 시나리오 A: 합성 데이터셋만 있는 경우 (현재 상태)
- E1/E2에 LLM 필드 없음
- 학습: ✅ 정상 (이미지+라벨만 사용)
- 추론: ❌ **실패** (`parts_master_features`에 LLM 필드 없음)
- **결과**: 추론 단계에서 Adaptive Fusion 실패, 식별 품질 저하

#### 시나리오 B: E1/E2에 LLM 필드 추가 (검토 중)
- E1/E2에 LLM 필드 추가
- 학습: ✅ 정상 (사용하지 않음)
- 추론: ❌ **여전히 실패** (`parts_master_features` 사용, E1/E2 파일 읽지 않음)
- **결과**: E1/E2에 추가해도 추론에는 영향 없음

#### 시나리오 C: DB 테이블에 LLM 필드 존재 (권장)
- `parts_master_features.feature_json`에 LLM 필드 존재
- 학습: ✅ 정상
- 추론: ✅ **정상** (DB에서 조회하여 사용)
- **결과**: 추론 단계 정상 작동

---

## 7. 기술문서 준수 현황

### 기술문서 요구사항
**database/메타데이터.txt:38-46**:
> AI 메타데이터 스키마(운영형) — 필수 14, 선택 확장
> 
> 필수 필드(LLM 또는 규칙 기반 직접 생성 · 14개):
> - shape_tag, series, stud_count_top, tube_count_bottom, center_stud, groove
> - confusions, distinguishing_features, recognition_hints

**용도**: `parts_master_features` 테이블 저장용

**E1/E2 파일에 대한 요구사항**: 기술문서에 명시 없음

---

## 8. 최종 결론

### E1/E2 메타에 LLM 필드 추가 필요성

**결론: ❌ 불필요**

**이유**:

1. **학습 단계**: YOLO는 이미지+라벨만 사용, 메타 불필요
2. **추론 단계**: `parts_master_features` DB 테이블에서 직접 조회
3. **E1/E2 파일**: 추론 파이프라인에서 직접 읽지 않음
4. **기술문서**: E1/E2에 LLM 필드 요구사항 없음

### 올바른 해결 방법

**대신 해야 할 일**:

1. **신규 레고 등록 시 LLM 분석 실행** (이미 자동화됨)
   - `parts_master_features` 테이블에 LLM 필드 자동 저장
   - 추론 단계에서 정상 사용 가능

2. **합성 데이터셋 부품에 대한 LLM 분석** (필요 시)
   - 메타데이터 관리 페이지에서 수동 실행
   - 또는 배치 스크립트로 일괄 처리
   - **목적**: DB 테이블 업데이트 (E1/E2 파일 업데이트 아님)

3. **E1/E2 파일은 현재 상태 유지**
   - 렌더링 메타만 포함 (정상)
   - 기술문서 요구사항 준수

---

## 9. 추가 고려사항

### 만약 E1/E2 파일을 직접 사용하려면?
- 추론 파이프라인 수정 필요 (현재는 DB만 사용)
- 기술문서 아키텍처 변경 필요
- 성능 저하 가능성 (파일 I/O vs DB 조회)

### 권장 사항
- **현재 아키텍처 유지**: DB 중심 설계가 더 효율적
- **E1/E2 파일**: 오프라인 QA/분석용으로만 사용 (기술문서 준수)
- **LLM 필드**: DB 테이블에만 저장 (이미 구현됨)

---

## 요약

| 항목 | E1/E2에 LLM 필드 추가 | 필요성 |
|------|---------------------|--------|
| 학습 단계 | 사용하지 않음 | ❌ 불필요 |
| 추론 단계 | DB 테이블 사용 (파일 읽지 않음) | ❌ 불필요 |
| 기술문서 | E1/E2에 LLM 필드 요구사항 없음 | ❌ 불필요 |
| 현재 용도 | 오프라인 QA/분석용 | ❌ 불필요 |

**최종 판정: 추가 불필요**

E1/E2 메타에 LLM 필드를 추가해도 시스템 동작에는 전혀 영향을 주지 않습니다. 
추론은 DB 테이블에서만 조회하므로, LLM 필드는 `parts_master_features` 테이블에만 있으면 충분합니다.

