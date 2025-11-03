# 깊이 맵 및 PnP 재투영 RMS 구현 완료 보고서

## 구현 완료 항목

### 1. 깊이 맵 렌더링 활성화
**파일**: `scripts/render_ldraw_to_supabase.py`

**구현 내용**:
- `_setup_depth_map_rendering()`: Blender Compositor에 깊이 맵 출력 노드 추가
- Render Layers의 Depth 출력을 EXR 파일로 저장
- EXR 형식 (32-bit float, ZIP 압축)

**위치**: `scripts/render_ldraw_to_supabase.py:976-1040`

### 2. 카메라 파라미터 추출
**파일**: `scripts/render_ldraw_to_supabase.py`

**구현 내용**:
- `_extract_camera_parameters()`: 카메라 내부/외부 파라미터 추출
- 내부 파라미터 (K 행렬): Blender 카메라 설정에서 계산
- 외부 파라미터 (R, t): 카메라 월드 변환 행렬에서 추출
- 왜곡 계수: Brown-Conrady 모델 (렌더링에는 왜곡 없음, 기본값 0)

**위치**: `scripts/render_ldraw_to_supabase.py:1072-1163`

### 3. 깊이 맵 파일 저장
**파일**: `scripts/render_ldraw_to_supabase.py`

**구현 내용**:
- `_configure_depth_output_path()`: 깊이 맵 출력 경로 설정
- `_locate_rendered_depth_map()`: 렌더된 깊이 맵 파일 찾기
- 저장 위치: `output/synthetic/{element_id}/depth/{uid}.exr`

**위치**: 
- `scripts/render_ldraw_to_supabase.py:1042-1070`
- `scripts/render_ldraw_to_supabase.py:1165-1216`
- `scripts/render_ldraw_to_supabase.py:5747-5781`

### 4. PnP 재투영 RMS 계산
**파일**: `scripts/render_ldraw_to_supabase.py`

**구현 내용**:
- `_calculate_rms()`: 기술문서 어노테이션.txt:260-269 기준 구현
- 3D 모델 버텍스에서 특징점 추출
- `cv2.solvePnPRansac()` 실행 (SOLVEPNP_SQPNP, 300 iterations, RANSAC)
- 재투영 오차 RMS 계산

**위치**: `scripts/render_ldraw_to_supabase.py:2056-2146`

### 5. 깊이 맵 검증 알고리즘
**파일**: `scripts/render_ldraw_to_supabase.py`

**구현 내용**:
- `_calculate_depth_score()`: 깊이 맵 파일 읽기 및 검증
- `_validate_depth_map_exr()`: 기술문서 어노테이션.txt:287-303 기준 구현
  - 유효 픽셀 비율 (40%)
  - 깊이 분산 (30%)
  - 엣지 부드러움 (30%)
- OpenEXR 모듈 사용 (EXR 파일 읽기)

**위치**: 
- `scripts/render_ldraw_to_supabase.py:2148-2212`
- `scripts/render_ldraw_to_supabase.py:2244-2289`

### 6. 품질 기준 복원
**파일**: `scripts/render_ldraw_to_supabase.py`

**수정 위치**:
- `_validate_render_quality()`: RMS ≤1.5px, depth ≥0.85 복원
- `_calculate_qa_flag()`: RMS ≤1.5px 기준 복원
- `_create_e2_metadata()`: QA 플래그 기준 복원
- `_flag_qa_fail()`: Auto-Requeue 기준 복원 (RMS >1.5px)

**기술문서 기준** (어노테이션.txt:319):
```
qa_flag='PASS' AND ssim ≥ 0.96 AND snr ≥ 30 
AND reprojection_rms ≤ 1.5 AND depth_quality_score ≥ 0.85
```

## 구현 세부사항

### 깊이 맵 렌더링 설정

**Compositor 노드 구성**:
1. Render Layers 노드: Depth 출력 사용
2. Composite 노드: 기본 이미지 출력
3. Output File 노드 (DepthOutput): EXR 형식 깊이 맵 저장

**EXR 설정**:
- 포맷: OPEN_EXR
- 색상 모드: RGB
- 비트 깊이: 32-bit float
- 압축: ZIP

### 카메라 파라미터 계산

**내부 파라미터 (K 행렬)**:
```python
fx = (focal_length_mm / pixel_size_x)
fy = (focal_length_mm / pixel_size_y)
cx = render_width / 2.0
cy = render_height / 2.0

K = [[fx, 0, cx],
     [0, fy, cy],
     [0, 0, 1]]
```

**외부 파라미터 (R, t)**:
- 회전 행렬: Blender 카메라 Euler 각도에서 변환
- 변위 벡터: 카메라 위치의 음수값

### PnP Solver 파라미터

**기술문서 기준** (어노테이션.txt:261-266):
- Method: `cv2.SOLVEPNP_SQPNP`
- Iterations: 300
- RANSAC Threshold: 2.0px
- Confidence: 0.999

### 깊이 맵 검증 공식

**기술문서 기준** (어노테이션.txt:300):
```python
score = 0.4 * valid_ratio + 0.3 * (1.0 / (1.0 + depth_var)) + 0.3 * edge_smoothness
```

**구성 요소**:
- `valid_ratio`: 유효 픽셀 비율 (≥0.95 기준)
- `depth_var`: 깊이 분산 (낮을수록 좋음)
- `edge_smoothness`: 엣지 부드러움 (1.0 / (1.0 + edge_strength))

## 의존성 추가 필요

### OpenEXR 라이브러리
깊이 맵 파일 읽기에 필요:
```bash
pip install OpenEXR
```

또는 Blender 환경에서:
```python
# Blender Python 환경에 OpenEXR 설치 필요
```

**폴백 처리**: OpenEXR이 없으면 이미지 기반 폴백 사용 (하위 호환성)

## 테스트 필요 사항

### 1. 깊이 맵 파일 생성 확인
- 렌더링 후 `output/synthetic/{element_id}/depth/{uid}.exr` 파일 존재 확인
- EXR 파일 형식 검증

### 2. PnP 재투영 RMS 검증
- 실제 PnP 계산이 수행되는지 확인
- RMS 값이 1.5px 이하인지 확인
- Inliers 비율 확인

### 3. 깊이 맵 검증 검증
- EXR 파일에서 깊이 맵 읽기 확인
- 검증 점수가 0.85 이상인지 확인
- 유효 픽셀 비율 확인

### 4. 품질 기준 적용 확인
- 기준 미달 샘플이 Auto-Requeue에 삽입되는지 확인
- QA 플래그가 올바르게 설정되는지 확인

## 예상 개선 효과

### 이전 상태
- 재투영 RMS: 평균 2.91px (그래디언트 기반, 실제 의미 없음)
- 깊이 점수: 평균 0.0042 (엣지 강도 기반, 실제 의미 없음)
- 기준 완화: RMS ≤3.5px, depth ≥0.005 (품질 검증 무력화)

### 구현 후 예상
- 재투영 RMS: 실제 PnP 재투영 오차 (≤1.5px 기준 적용)
- 깊이 점수: 실제 깊이 맵 품질 (≥0.85 기준 적용)
- 품질 검증: 기술문서 기준 준수

## 다음 단계

1. **OpenEXR 설치 확인**: Blender Python 환경에 OpenEXR 설치
2. **렌더링 테스트**: 실제 렌더링으로 깊이 맵 생성 확인
3. **품질 검증 테스트**: PnP RMS 및 깊이 맵 검증 작동 확인
4. **기존 데이터 재처리**: 기존 합성 데이터셋 재렌더링 (필요 시)

## 주의사항

1. **OpenEXR 의존성**: OpenEXR 모듈이 없으면 깊이 맵 검증이 폴백으로 전환됨
2. **PnP 계산 성능**: 모든 버텍스를 사용하면 성능 저하 가능, 필요 시 샘플링 고려
3. **깊이 맵 파일 크기**: EXR 파일은 용량이 큼, 저장 공간 고려 필요
4. **하위 호환성**: 폴백 로직 유지 (카메라 파라미터나 깊이 맵이 없어도 동작)

