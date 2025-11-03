# part_id 32028 데이터 검증 결과

## 검증 일시
2025-01-XX

## 기본 정보
- **part_id**: 32028
- **color_id**: 1
- **part_name**: 32028
- **confidence**: 0.95 ✅
- **usage_frequency**: 0

---

## 1. feature_json 검증

### ✅ 정상
- **shape_tag**: "plate"
- **stud_count_top**: 2
- **tube_count_bottom**: 0
- **confusions**: ["3001", "3004"]
- **recognition_hints**: 존재
- **feature_text**: "이 부품은 문 레일이 있는 1x2 플레이트로, 다양한 모델에 사용됩니다."

### LLM 생성 메타데이터 포함
- `recognition_hints.ko`: 한국어 설명 ✅
- `recognition_hints.top_view`: 상단 뷰 설명 ✅
- `recognition_hints.side_view`: 측면 뷰 설명 ✅
- `recognition_hints.unique_features`: 고유 특징 배열 ✅

---

## 2. clip_text_emb 검증

### ✅ 추정 정상
- **차원**: 768 (예상)
- **값 범위**: -0.xx ~ 0.xx (정상 범위)
- **제로 벡터**: 아님 (norm >= 0.01 추정)

### 검증 필요
- 전체 768차원 데이터로 norm 계산 필요
- 정규화 여부 확인 필요

---

## 3. semantic_vector 검증

### ⚠️ 제로 패딩 의심

#### 앞부분 (0~512차원)
- **값 범위**: -0.xx ~ 0.xx (정상)
- **norm**: 정상 범위 추정

#### 중반부/후반부 (512~768차원)
- **값 범위**: 0.000xxx ~ 0.00xxx (매우 작음)
- **평균 절댓값**: < 0.001 (매우 작음)
- **제로 패딩 가능성**: 높음

### 문제점
테이블 데이터에서 semantic_vector 후반부 값을 보면:
- `...-0.00023146534, -0.0034383864, 0.0015006918, -0.0019232443, -0.00082542334, ...`
- 값들이 매우 작아짐 (0.001 수준 이하)

이는 `useMasterPartsPreprocessing.js`의 `expandTo768Dimensions` 함수에서:
1. FGC 벡터 512D를 768D로 확장할 때
2. 앞 256차원을 0.1 스케일로 반복하여 768D 생성
3. L2 정규화 수행

하지만 후반부 256차원이 원본 512D의 앞 256차원의 0.1 스케일이므로, 이미 작은 값이 더 작아질 수 있음.

---

## 4. recognition_hints 검증

### ✅ 정상
```json
{
  "ko": "이 부품은 문 레일이 있는 1x2 플레이트로, 다양한 모델에 사용됩니다.",
  "top_view": "상단에서 보면 두 개의 스터드가 나열되어 있으며, 한쪽에 레일이 있습니다.",
  "side_view": "옆에서 보면 비교적 얇은 두께를 가지며, 레일 부분이 드러납니다.",
  "unique_features": [
    "문 레일 기능",
    "특별한 블루 컬러",
    "다양한 조립 부품과 호환"
  ]
}
```

---

## 종합 판단

### ✅ 정상 항목
1. **feature_json**: LLM 생성 메타데이터 정상 포함
2. **recognition_hints**: 인식 힌트 정상
3. **clip_text_emb**: 제로 벡터 아님 (추정)

### ⚠️ 주의 필요
1. **semantic_vector**: 후반부 제로 패딩 가능성

---

## 권장 조치

### 즉시 조치
1. **semantic_vector 정밀 검증**:
   ```sql
   SELECT 
       part_id,
       color_id,
       array_length(semantic_vector::text::integer[], 1) as dim,
       -- 후반부 256차원 norm 계산
       (SELECT sqrt(sum(power(v::numeric, 2))) 
        FROM unnest(semantic_vector[513:768]) v) as back_256_norm
   FROM parts_master_features
   WHERE part_id = '32028' AND color_id = 1;
   ```

2. **제로 패딩 발견 시**:
   - 메타데이터 관리 페이지 > Semantic Vector 탭
   - "제로 패딩 수정" 기능 실행

### 장기 조치
1. `useMasterPartsPreprocessing.js`의 `expandTo768Dimensions` 함수 개선 검토
2. Semantic Vector 생성 시 후반부 값 검증 로직 추가

---

## 참고

### 식별 단계에서 사용되는 데이터
- **feature_json**: LLM 생성 메타데이터 (shape_tag, stud_count_top 등)
- **clip_text_emb**: FAISS Stage-1 검색용 (주 사용)
- **semantic_vector**: FAISS Stage-2 폴백용 (clip_text_emb 없을 때)
- **recognition_hints**: 인식 힌트

### 데이터 소스
- **테이블**: `parts_master_features`
- **로컬 JSON 파일**: 사용하지 않음 (식별 단계에서 DB 직접 조회)

