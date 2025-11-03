# 6313121 폴더 데이터 정밀 분석 결과

## 파일 현황

### 파일 카운트
- **images**: 5개 (6313121_000.webp ~ 6313121_004.webp)
- **labels**: 4개 (6313121_000.txt ~ 6313121_003.txt)
- **meta** (E1): 4개 (6313121_000.json ~ 6313121_003.json)
- **meta-e** (E2): 4개 (6313121_000_e2.json ~ 6313121_003_e2.json)
- **depth**: 5개 (6313121_000_0001.png ~ 6313121_004_0001.png)

## 발견된 문제점

### 1. 파일 수 불일치 (중요)
**문제**: `6313121_004`에 대한 labels, meta, meta-e 파일 누락

**상태**:
- Images: 5개 ✅
- Labels: 4개 ❌ (6313121_004 누락)
- Meta (E1): 4개 ❌ (6313121_004 누락)
- Meta-E (E2): 4개 ❌ (6313121_004 누락)
- Depth: 5개 ✅

**원인 추정**:
- 렌더링은 완료되었으나 후처리(어노테이션/메타데이터 생성) 단계에서 실패
- 에러 처리 후 다음 렌더링으로 진행되어 파일 미생성

**영향**:
- 데이터셋 불완전성
- 학습 데이터 불일치 (이미지는 있으나 라벨 없음)

### 2. 깊이 맵 형식 오류 (심각)
**문제**: 깊이 맵 파일이 PNG 형식으로 생성됨 (EXR이어야 함)

**현재 상태**:
- 파일명: `6313121_000_0001.png` (PNG 형식)
- 기대 형식: `6313121_000.exr` (EXR 형식)

**코드 확인**:
```python
# scripts/render_ldraw_to_supabase.py:1037
depth_output.format.file_format = 'OPEN_EXR'  # ✅ 코드는 올바름
```

**원인 추정**:
1. Blender OutputFile 노드의 형식 설정이 렌더링 시 덮어쓰여짐
2. 노드 설정이 제대로 적용되지 않음
3. `use_node_format = False` 설정으로 인해 기본 형식 사용

**영향**:
- 깊이 정보 손실: PNG는 최대 16비트, EXR은 32비트 부동소수점
- 깊이 맵 검증 불가: 어노테이션.txt 기준 EXR 필수
- Supabase Storage 업로드 시 형식 불일치 (`.exr` 기대하나 `.png` 업로드)

### 3. 깊이 맵 파일명 패턴 문제
**현재**: `{uid}_0001.png` (Blender 자동 번호 포함)
**기대**: `{uid}.exr` (단일 파일명)

**원인**:
- OutputFile 노드의 `file_slots[0].path` 설정이 `{prefix}_` 형식
- Blender가 자동으로 `_0001` 번호 추가

## 정상 동작 확인

### ✅ 디렉토리 구조
모든 필수 폴더 존재 (images, labels, meta, meta-e, depth)

### ✅ 기본 파일 매칭 (4개 파일)
- images ↔ labels: 4개 일치 (6313121_000 ~ 6313121_003)
- images ↔ meta: 4개 일치
- images ↔ meta-e: 4개 일치
- images ↔ depth: 5개 모두 존재 (파일명만 불일치)

### ✅ E1 JSON 스키마 (Full Meta)
- `schema_version`: "1.6.1" ✅
- `part_id`, `element_id` ✅
- `transform`, `material`, `bounding_box`, `polygon_uv` ✅
- `render_settings`, `camera_parameters` ✅
- `quality_metrics` ✅

### ✅ E2 JSON 스키마 (Essential Meta)
- `schema_version`: "1.6.1-E2" ✅
- `part_id`, `element_id` ✅
- `annotation` (bbox, segmentation) ✅
- `qa` 필드 ✅
  - `reprojection_rms_px`: 32.66px (기준: ≤1.5px) ❌
  - `depth_quality_score`: 0.002 (기준: ≥0.85) ❌
  - `qa_flag`: "FAIL_PNP" ❌

### ✅ YOLO 라벨 형식
- 형식: `class x_center y_center width height x1 y1 ... xn yn` ✅
- 좌표 정규화 확인: 모든 값 0~1 범위 ✅
- 세그멘테이션 폴리곤 포함 ✅

## 품질 메트릭 분석

### E2 JSON에서 확인된 품질 지표
```
reprojection_rms_px: 32.66px (기준: ≤1.5px) ❌ 100% 미달
depth_quality_score: 0.002 (기준: ≥0.85) ❌ 100% 미달
qa_flag: "FAIL_PNP"
qa_flag_runtime: "FAIL_QUALITY"
qa_flag_strict: "FAIL_QUALITY"
```

**원인**:
1. 깊이 맵이 PNG 형식이어서 실제 깊이 검증 불가
2. PnP 재투영 RMS 계산이 그래디언트 기반 폴백 사용 (PNG 깊이 맵 부재)

## 조치 사항

### 긴급 수정 필요

#### 1. 깊이 맵 형식 수정 (최우선)
**문제**: PNG로 저장되는 문제 해결

**수정 방안**:
1. OutputFile 노드 형식 강제 설정 확인
2. `use_node_format = True`로 변경 검토
3. 렌더링 전 형식 설정 재확인 로직 추가
4. 렌더링 후 실제 파일 형식 검증

#### 2. 파일 수 불일치 해결
**방안**:
- Option A: `6313121_004` 재렌더링 (권장)
- Option B: 누락된 파일 수동 생성 (비권장)

#### 3. 깊이 맵 파일명 패턴 수정
**방안**:
- OutputFile 노드의 `file_slots[0].path` 설정 개선
- 자동 번호 제거 또는 파일명 패턴 일치화

## 데이터 정합성 종합 평가

### 정상 동작 (60%)
- ✅ 디렉토리 구조
- ✅ 기본 파일 매칭 (4/5 파일)
- ✅ JSON 스키마
- ✅ 라벨 형식

### 문제 발생 (40%)
- ❌ 파일 수 불일치 (1개 누락)
- ❌ 깊이 맵 형식 오류 (PNG vs EXR)
- ❌ 품질 메트릭 미달 (깊이 맵 형식 오류로 인한)

## 권장 조치

1. **즉시 조치**: 깊이 맵 형식 수정 코드 적용
2. **재렌더링**: 전체 세트 재렌더링 권장 (깊이 맵 형식 수정 후)
3. **검증 강화**: 렌더링 후 자동 검증 스크립트 추가

