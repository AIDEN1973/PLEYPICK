# part_id 32028 점수 필드 초기값 검증 결과

## 검증 결과 요약

### ⚠️ 초기값 확인

- **총 점수 필드 수**: 16개
- **0.50 값 개수**: 15개 (93.8%)
- **고유 값 개수**: 2개 (0.44, 0.50)
- **초기값 의심**: 예

---

## 점수 필드 상세 분석

### 1. 현재 값 분석

| 필드 | 현재 값 | 초기값 의심 |
|------|---------|-------------|
| flip_score | 0.50 | ✅ 예 |
| normal_similarity | 0.50 | ✅ 예 |
| flipped_similarity | 0.50 | ✅ 예 |
| **semantic_score** | **0.44** | ❌ 아니오 (일치) |
| round_shape_score | 0.50 | ✅ 예 |
| center_stud_score | 0.50 | ✅ 예 |
| groove_score | 0.50 | ✅ 예 |
| stud_count_score | 0.50 | ✅ 예 |
| tube_pattern_score | 0.50 | ✅ 예 |
| hole_count_score | 0.50 | ✅ 예 |
| symmetry_score | 0.50 | ✅ 예 |
| edge_quality_score | 0.50 | ✅ 예 |
| texture_score | 0.50 | ✅ 예 |
| color_score | 0.50 | ✅ 예 |
| pattern_score | 0.50 | ✅ 예 |
| voting_total_score | 0.50 | ✅ 예 |

### 2. 샘플 데이터 비교 분석

**샘플 크기**: 100개 레코드

**분석 결과**:
- 모든 점수 필드가 샘플에서도 **100% 0.50** 값
- 샘플 평균: 0.5000
- 샘플 범위: [0.5000, 0.5000]
- 샘플 고유값 수: 1개 (0.50만 존재)

**결론**: 데이터베이스 전체에서 점수 필드들이 초기값(0.50)으로 설정되어 있음

---

## feature_json과 점수 필드 대조 분석

### 1. groove_score vs feature_json.groove

- **groove_score**: 0.50
- **feature_json.groove**: `true`
- **불일치**: `groove=true`인데 `groove_score=0.50` (중립값)
- **의미**: 실제 groove 특성이 있는데 점수가 초기값

### 2. center_stud_score vs feature_json.center_stud

- **center_stud_score**: 0.50
- **feature_json.center_stud**: `false`
- **일치**: `center_stud=false`이므로 `center_stud_score=0.50` (중립값)은 합리적

### 3. stud_count_score vs feature_json.stud_count_top

- **stud_count_score**: 0.50
- **feature_json.stud_count_top**: `2`
- **불일치**: `stud_count_top=2`인데 `stud_count_score=0.50` (중립값)
- **의미**: 실제 스터드가 2개인데 점수가 초기값

### 4. semantic_score vs feature_json.feature_text_score

- **semantic_score**: 0.44
- **feature_json.feature_text_score**: 0.43999999999999995
- **일치**: 두 값이 거의 동일 (계산된 값으로 보임)

---

## 코드 분석 결과

### 초기값 설정 위치

`src/composables/useMasterPartsPreprocessing.js:3725-3746`

```javascript
// 점수/수치 필드 기본값 (0-1 범위 중심의 보수적 기본값)
const numOr = (v, d) => (typeof v === 'number' ? v : d)
validated.semantic_score = numOr(validated.semantic_score, 0.5)
validated.flip_score = numOr(validated.flip_score, 0.5)
validated.normal_similarity = numOr(validated.normal_similarity, 0.5)
validated.flipped_similarity = numOr(validated.flipped_similarity, 0.5)
validated.round_shape_score = numOr(validated.round_shape_score, 0.5)
validated.center_stud_score = numOr(validated.center_stud_score, 0.5)
validated.groove_score = numOr(validated.groove_score, 0.5)
validated.stud_count_score = numOr(validated.stud_count_score, 0.5)
validated.tube_pattern_score = numOr(validated.tube_pattern_score, 0.5)
validated.hole_count_score = numOr(validated.hole_count_score, 0.5)
validated.symmetry_score = numOr(validated.symmetry_score, 0.5)
validated.edge_quality_score = numOr(validated.edge_quality_score, 0.5)
validated.texture_score = numOr(validated.texture_score, 0.5)
validated.color_score = numOr(validated.color_score, 0.5)
validated.pattern_score = numOr(validated.pattern_score, 0.5)
validated.voting_total_score = numOr(validated.voting_total_score, 0.5)
```

**의미**: 
- 점수 필드가 `undefined` 또는 `null`인 경우 기본값 0.5 설정
- 현재 데이터는 실제 계산값이 아닌 기본값으로 보임

---

## 최종 결론

### ✅ 초기값 확인됨

1. **15/16 필드가 초기값(0.50)**: 
   - 대부분의 점수 필드가 계산되지 않고 기본값으로 설정됨
   
2. **1/16 필드만 계산값**:
   - `semantic_score`: 0.44 (feature_json.feature_text_score와 일치)

3. **feature_json과 불일치**:
   - `groove_score=0.50` vs `feature_json.groove=true` ❌
   - `stud_count_score=0.50` vs `feature_json.stud_count_top=2` ❌

### 영향도 분석

**현재 상태의 문제점**:
1. 점수 필드가 실제 부품 특성을 반영하지 않음
2. `groove_score`, `stud_count_score` 등이 실제 데이터와 불일치
3. 멀티 어트리뷰트 투표 시스템에서 정확한 점수 계산 불가능

**기능적 영향**:
- ✅ 식별 파이프라인은 주로 `clip_text_emb`와 `semantic_vector` 사용
- ✅ 점수 필드는 보조적인 역할 (주요 기능에 직접적 영향 제한적)
- ⚠️ 향후 멀티 어트리뷰트 투표 시스템 사용 시 정확도 저하 가능

---

## 권장 사항

### 1. 즉시 조치 필요 없음
- 현재 식별 파이프라인은 벡터 임베딩 중심으로 동작
- 점수 필드는 보조 역할로 영향도 낮음

### 2. 장기적 개선 권장
1. **점수 필드 재계산**:
   - `feature_json` 데이터 기반으로 실제 점수 계산
   - `groove_score`: `groove=true` → 높은 점수 (예: 0.8~0.9)
   - `stud_count_score`: `stud_count_top` 기반 계산

2. **멀티 어트리뷰트 투표 활성화 시**:
   - 점수 필드 값이 실제 부품 특성과 일치해야 함
   - 재계산 또는 업데이트 스크립트 실행 필요

3. **데이터 일관성 유지**:
   - `feature_json`과 점수 필드 간 일관성 보장
   - 데이터 업데이트 시 자동 동기화 메커니즘 구현

---

## 결론

**현재 상태**: 점수 필드가 초기값(0.50)으로 설정되어 있으나, 식별 파이프라인 기능에는 큰 영향 없음

**장기적 개선**: 멀티 어트리뷰트 투표 시스템 활용 시 점수 필드 재계산 권장

