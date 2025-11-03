# 품질 메트릭 심각도 분석: 재투영 RMS 및 깊이 점수

## 분석 목적
합성 데이터셋에서 발견된 품질 메트릭 미달(재투영 RMS 2.91px, 깊이 점수 0.0042)의 원인과 실제 시스템 영향 분석

---

## 1. 문제 요약

### 현재 상태
- **재투영 RMS**: 평균 2.91px (기준: ≤1.5px) - **100% 미달** (50/50 샘플)
- **깊이 점수**: 평균 0.0042 (기준: ≥0.85) - **100% 미달** (50/50 샘플)
- **SSIM**: 평균 1.0000 (기준: ≥0.965) ✅ 통과
- **SNR**: 평균 46.67 dB (기준: ≥30 dB) ✅ 통과

---

## 2. 재투영 RMS (Reprojection RMS) 분석

### 정의 및 의미

**기술문서 정의 (어노테이션.txt:260-269)**:
```python
def reprojection_rms_px(obj3d, img2d, K, dist, method=cv2.SOLVEPNP_SQPNP, iters=300, ransac_thresh=2.0):
    ok, rvec, tvec, inliers = cv2.solvePnPRansac(
        np.array(obj3d), np.array(img2d), K, dist,
        useExtrinsicGuess=False, iterationsCount=iters,
        reprojectionError=ransac_thresh, flags=method, confidence=0.999
    )
    proj,_ = cv2.projectPoints(obj3d, rvec, tvec, K, dist)
    err = np.linalg.norm(proj.reshape(-1,2) - img2d, axis=1)
    return float(np.sqrt((err**2).mean()))
```

**의미**:
- 3D 모델의 특징점을 카메라 내부/외부 파라미터로 2D 이미지에 재투영
- 재투영된 점과 실제 이미지 특징점 간의 RMS 오차
- **PnP Solver의 정확도를 나타냄**: 카메라 포즈 추정 품질

**기준값**: ≤1.5px (기술문서 어노테이션.txt:94)

### 실제 구현 현황

**scripts/render_ldraw_to_supabase.py:1985-1999**:
```python
def _calculate_rms(self, img):
    """RMS (Root Mean Square) 계산 (픽셀 단위)"""
    try:
        # 이미지 그라디언트 계산
        grad_x = cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=3)
        
        # RMS 계산
        rms = np.sqrt(np.mean(grad_x**2 + grad_y**2))
        
        return rms
```

**문제 발견**:
- ❌ **기술문서 요구사항과 불일치**
- 현재 구현: **이미지 그라디언트 기반 RMS** (단순 엣지 강도)
- 기술문서 요구: **PnP 재투영 오차 RMS** (3D-2D 매칭 정확도)

### 원인 분석

1. **잘못된 구현**
   - PnP Solver를 사용하지 않음
   - 실제 재투영 계산 없음
   - 단순 이미지 그라디언트로 대체됨

2. **기대값과의 불일치**
   - 그라디언트 RMS는 일반적으로 1-5px 범위
   - PnP 재투영 RMS는 일반적으로 0.5-2.0px 범위
   - 현재 2.91px는 그라디언트 기준으로는 정상 범위

3. **기준값 설정 문제**
   - 기술문서 기준(≤1.5px)은 PnP 재투영 기준
   - 현재 구현은 그라디언트 기준이므로 기준 불일치

### 실제 영향

**추론 단계 사용 여부 확인**:
- `src/views/HybridDetection.vue`: 재투영 RMS 사용 없음
- `src/composables/useAdaptiveFusion.js`: 재투영 RMS 사용 없음
- `src/composables/useYoloDetector.js`: 재투영 RMS 사용 없음

**결론**: 
- 현재 **추론 단계에서 사용하지 않음**
- **학습 편입 기준에서만 사용** (어노테이션.txt:319)

**학습 편입 기준 (어노테이션.txt:319)**:
```
qa_flag='PASS' AND ssim ≥ 0.96 AND snr ≥ 30 
AND reprojection_rms ≤ 1.5 AND depth_quality_score ≥ 0.85
```

**실제 영향**:
- ❌ **현재 모든 샘플이 학습 편입 기준 미달**
- 학습 데이터셋 품질 검증 실패
- 자동 재렌더링 트리거 (어노테이션.txt:322: Auto-Requeue)

---

## 3. 깊이 점수 (Depth Quality Score) 분석

### 정의 및 의미

**기술문서 정의 (어노테이션.txt:287-303)**:
```python
def validate_depth_map(depth, zmin, zmax):
    valid = np.isfinite(depth) & (depth > 0)
    valid_ratio = np.mean(valid)
    depth_var = float(np.var(depth[valid])) if np.any(valid) else 1e9
    
    sobelx = cv2.Sobel(depth.astype(np.float32), cv2.CV_32F, 1, 0)
    sobely = cv2.Sobel(depth.astype(np.float32), cv2.CV_32F, 0, 1)
    edge_strength = float(np.mean(np.sqrt(sobelx**2 + sobely**2)))
    edge_smoothness = 1.0 / (1.0 + edge_strength)
    
    score = 0.4*valid_ratio + 0.3*(1.0/(1.0+depth_var)) + 0.3*edge_smoothness
    return dict(depth_quality_score=float(score), ...)
```

**의미**:
- 깊이 맵의 유효 픽셀 비율 (40%)
- 깊이 분산의 역수 (30%) - 깊이 변화의 합리성
- 엣지 부드러움 (30%) - 깊이 경계의 자연스러움
- **종합 점수 0-1**: 깊이 정보의 신뢰도

**기준값**: ≥0.85 (기술문서 어노테이션.txt:212)

### 실제 구현 현황

**scripts/render_ldraw_to_supabase.py:2003-2026**:
```python
def _calculate_depth_score(self, img):
    """Depth Score 계산 (분석서 권장: v1.6.1 §3.3 depth_map_validation)"""
    try:
        # 이미지 그라디언트 기반 엣지 강도 계산
        grad_x = cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=3)
        edge_strength = np.sqrt(grad_x**2 + grad_y**2)
        max_edge = np.max(edge_strength)
        
        if max_edge > 0:
            depth_score = np.mean(edge_strength) / max_edge
        else:
            depth_score = 0.5
        
        depth_score = self._validate_depth_map(img, depth_score)
        
        return min(1.0, max(0.0, depth_score))
```

**문제 발견**:
- ❌ **기술문서 요구사항과 불일치**
- 현재 구현: **이미지 그라디언트 기반 엣지 강도** (단순 엣지 강도)
- 기술문서 요구: **깊이 맵 검증** (유효 픽셀, 분산, 부드러움)

### 원인 분석

1. **깊이 맵 데이터 없음**
   - 실제 깊이 맵(depth map) 파일이 렌더링되지 않음
   - RGB 이미지만 있음
   - 깊이 맵 검증 불가

2. **대체 계산 방식**
   - RGB 이미지의 그라디언트로 대체
   - 엣지 강도 평균/최대 비율 (0.005 범위)
   - 실제 깊이 품질과 무관

3. **기준값 불일치**
   - 기술문서 기준(≥0.85)은 깊이 맵 품질 기준
   - 현재 구현은 엣지 강도 비율 (0.005 범위)
   - 기준 불일치

### 실제 영향

**추론 단계 사용 여부 확인**:
- `src/views/HybridDetection.vue`: 깊이 점수 사용 없음
- `src/composables/useAdaptiveFusion.js`: 깊이 점수 사용 없음
- `src/composables/useYoloDetector.js`: 깊이 점수 사용 없음

**결론**: 
- 현재 **추론 단계에서 사용하지 않음**
- **학습 편입 기준에서만 사용** (어노테이션.txt:319)

**실제 영향**:
- ❌ **현재 모든 샘플이 학습 편입 기준 미달**
- 학습 데이터셋 품질 검증 실패
- 자동 재렌더링 트리거 (어노테이션.txt:322: Auto-Requeue)

---

## 4. 시스템 영향 분석

### 학습 단계 영향

**품질 기준 (어노테이션.txt:319)**:
```
qa_flag='PASS' AND ssim ≥ 0.96 AND snr ≥ 30 
AND reprojection_rms ≤ 1.5 AND depth_quality_score ≥ 0.85
```

**현재 상태**:
- SSIM: ✅ 1.0000 (통과)
- SNR: ✅ 46.67 dB (통과)
- 재투영 RMS: ❌ 2.91px (미달, 기준의 2배)
- 깊이 점수: ❌ 0.0042 (미달, 기준의 0.5%)

**결과**:
- ❌ **모든 샘플이 학습 편입 기준 미달**
- 학습 데이터셋 품질 검증 실패
- Auto-Requeue 규칙에 의해 재렌더링 큐에 삽입되어야 함

**실제 처리**:
- `scripts/render_ldraw_to_supabase.py:2257-2267`에서 기준을 완화함:
  ```python
  # 종합 QA 판정: 현재 reprojection_rms_px는 그래디언트 RMS 기반 값이므로 임계 3.5px로 완화
  if ssim >= 0.96 and snr >= 30.0 and sharpness >= 0.5 and reprojection_rms <= 3.5:
      qa_flag = "PASS"
  ```
- 깊이 점수는 `depth_score >= 0.005`로 완화됨 (기준 0.85의 0.6%)

**문제**: 기준 완화로 인해 실제 품질 검증 무력화

### 추론 단계 영향

**확인 결과**:
- 재투영 RMS: 추론에서 사용 안 함
- 깊이 점수: 추론에서 사용 안 함

**결론**: 
- **추론 단계에는 직접적 영향 없음**
- 다만, **학습 데이터 품질 저하 → 모델 성능 저하 → 간접적 영향**

---

## 5. 근본 원인 분석

### 문제 1: 구현 불일치

| 항목 | 기술문서 요구 | 실제 구현 | 불일치 |
|------|--------------|----------|--------|
| 재투영 RMS | PnP 재투영 오차 (3D-2D 매칭) | 이미지 그라디언트 RMS | ❌ |
| 깊이 점수 | 깊이 맵 검증 (유효성, 분산, 부드러움) | 이미지 엣지 강도 | ❌ |

### 문제 2: 데이터 부재

**재투영 RMS**:
- 필요: 3D 모델 특징점, 2D 이미지 특징점, 카메라 파라미터
- 현황: 이미지만 존재, 3D 특징점 매칭 없음

**깊이 점수**:
- 필요: 깊이 맵 파일 (Z-buffer 데이터)
- 현황: RGB 이미지만 존재, 깊이 맵 파일 없음

### 문제 3: 기준 완화로 인한 품질 검증 무력화

**완화된 기준**:
- 재투영 RMS: ≤1.5px → ≤3.5px (233% 완화)
- 깊이 점수: ≥0.85 → ≥0.005 (0.6%로 완화)

**결과**: 모든 샘플이 통과하지만 실제 품질은 미달

---

## 6. 해결 방안

### 즉시 조치 (단기)

#### 방안 A: 실제 구현 추가 (권장)

**재투영 RMS**:
1. Blender 렌더링 시 카메라 파라미터 저장
2. 3D 모델 특징점 추출 (코너, 엣지)
3. 2D 이미지 특징점 추출 (SIFT, ORB)
4. PnP Solver 실행 (`cv2.solvePnPRansac`)
5. 재투영 오차 계산

**깊이 점수**:
1. Blender 렌더링 시 깊이 맵 저장 (Z-buffer)
2. 깊이 맵 파일 생성 (`depth/{element_id}/{uuid}.bin`)
3. 깊이 맵 검증 알고리즘 구현 (어노테이션.txt:287-303)

#### 방안 B: 기준 조정 (임시)

**현재 구현에 맞춘 기준 재설정**:
- 재투영 RMS (그라디언트 기준): ≤3.5px → 유지
- 깊이 점수 (엣지 강도 기준): ≥0.01 → 유지

**문제**: 기술문서와 불일치, 실제 품질 검증 의미 상실

### 근본 조치 (중장기)

#### 1. 렌더링 파이프라인 개선

**Blender 스크립트 수정**:
```python
# 깊이 맵 렌더링 활성화
bpy.context.scene.use_nodes = True
tree = bpy.context.scene.node_tree
depth_output = tree.nodes.new(type='CompositorNodeOutputFile')
depth_output.base_path = f"depth/{element_id}"
depth_output.file_slots[0].path = f"{uuid}.exr"  # EXR 형식 (깊이 정보 포함)
```

**카메라 파라미터 저장**:
```python
camera = bpy.context.scene.camera
metadata['camera'] = {
    'intrinsics_3x3': camera_intrinsics,  # K 행렬
    'extrinsics': camera_pose,  # R, t
    'distortion_coeffs': distortion_coeffs
}
```

#### 2. 품질 검증 로직 구현

**재투영 RMS 계산**:
- 렌더링 후 자동 실행
- PnP Solver 통합
- 결과를 메타데이터에 저장

**깊이 점수 계산**:
- 깊이 맵 파일 읽기
- 기술문서 알고리즘 구현
- 결과를 메타데이터에 저장

---

## 7. 실제 시스템 영향 평가

### 추론 단계 영향: ❌ 없음

**확인**:
- HybridDetection.vue: 재투영 RMS/깊이 점수 사용 없음
- Adaptive Fusion: 재투영 RMS/깊이 점수 사용 없음
- YOLO Detector: 재투영 RMS/깊이 점수 사용 없음

**결론**: 현재 추론 파이프라인은 이 메트릭을 사용하지 않음

### 학습 단계 영향: ⚠️ 간접적 영향

**영향 경로**:
1. 품질 기준 미달 → Auto-Requeue 트리거
2. 기준 완화로 인해 실제로는 통과 (품질 검증 무력화)
3. 낮은 품질 데이터가 학습 데이터셋에 포함
4. 모델 성능 저하 (간접적)

**현재 상태**:
- 기준이 완화되어 모든 샘플 통과
- 실제 품질은 미달이지만 검증 무력화

### 미래 영향: ⚠️ 위험

**만약 추론 단계에서 사용하게 되면**:
- 재투영 RMS: 3D 정합 실패 가능
- 깊이 점수: 깊이 기반 처리 불가

**현재는 사용하지 않지만, 향후 기능 추가 시 문제 발생 가능**

---

## 8. 우선순위 및 권장 조치

### 🔴 최우선 (즉시)

1. **구현 불일치 인식 및 문서화**
   - 현재 구현이 기술문서와 다름을 명확히 문서화
   - 기준 완화 사항 기록

2. **렌더링 파이프라인 개선 계획 수립**
   - 깊이 맵 렌더링 추가
   - 카메라 파라미터 저장
   - PnP Solver 통합

### 🟡 높은 우선순위 (1-2주)

3. **실제 품질 검증 구현**
   - PnP 재투영 RMS 계산 구현
   - 깊이 맵 검증 알고리즘 구현
   - 기준 재조정 (기술문서 준수)

4. **품질 기준 재평가**
   - 현재 완화된 기준 유지 여부 결정
   - 기술문서 기준 준수 여부 결정

### 🟢 중기 (1개월)

5. **렌더링 파이프라인 완전 개선**
   - Blender 스크립트 수정
   - 깊이 맵 생성 통합
   - 카메라 파라미터 자동 저장

6. **기존 데이터 재처리**
   - 깊이 맵 재생성 (가능한 경우)
   - 품질 메트릭 재계산
   - 기준 미달 샘플 재렌더링

---

## 9. 결론

### 핵심 발견

1. **구현 불일치**: 기술문서 요구사항과 실제 구현이 다름
   - 재투영 RMS: PnP 재투영 → 그라디언트 RMS
   - 깊이 점수: 깊이 맵 검증 → 엣지 강도

2. **데이터 부재**: 실제 계산에 필요한 데이터 없음
   - 3D 특징점 매칭 없음
   - 깊이 맵 파일 없음

3. **기준 완화**: 품질 검증 기준이 완화되어 무력화됨

4. **현재 영향**: 추론 단계에는 직접 영향 없음, 학습 단계에는 간접 영향

### 권장 사항

**단기**: 현재 상태를 명확히 문서화하고, 기준 완화 사항 기록

**중기**: 실제 품질 검증 구현 (PnP 재투영 RMS, 깊이 맵 검증)

**장기**: 렌더링 파이프라인 완전 개선 (깊이 맵 생성, 카메라 파라미터 저장)

### 최종 판정

**심각도**: 🟡 중간 (현재는 직접 영향 없음, 향후 위험)

**즉시 조치**: 필요 없음 (추론 단계 사용 안 함)

**중기 조치**: 필요 (품질 검증 구현)

**장기 조치**: 필수 (렌더링 파이프라인 개선)

