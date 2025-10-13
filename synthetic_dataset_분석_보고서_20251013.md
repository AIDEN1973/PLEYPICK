# Synthetic Dataset 페이지 정합성 분석 보고서

**작성일**: 2025-10-13  
**분석 대상**: http://localhost:3000/synthetic-dataset  
**문서 기준**: 기술문서.txt v1.2, 어노테이션.txt v1.6.1

## 📋 분석 개요

SyntheticDatasetManager.vue 페이지와 기술문서(v1.2), 어노테이션 스키마(v1.6.1)를 비교 분석하여 정합성, 오류, 개선사항을 도출했습니다.

---

## ✅ 정합성 확인 (일치 항목)

### 1. **렌더링 설정**
- ✅ 해상도 옵션: 640x640, 768x768, 960x960, 1024x1024 - **일치**
- ✅ 품질 설정: fast/medium/high/ultra - **일치**
- ✅ 적응형 샘플링 시스템 표시 (256-480샘플) - **UI 표시됨**
- ✅ 이미지 수 기본값: 200장 - **일치**
- ✅ 배경색: auto/gray/white - **일치**

### 2. **중복 방지 시스템**
- ✅ elementId 기반 중복 체크 - **구현됨**
- ✅ 스토리지 폴더 기반 검증 - **구현됨**
- ✅ 배치 처리 최적화 (STORAGE_BATCH_SIZE=6) - **구현됨**
- ✅ DUP_MIN_FILES=150 기준 - **구현됨**

### 3. **세트 렌더링**
- ✅ 세트 단위 렌더링 기능 - **구현됨**
- ✅ BOM 기반 부품 로드 - **구현됨**
- ✅ 렌더링 진행 상태 추적 - **구현됨**

### 4. **자동 학습 기능**
- ✅ 자동 학습 활성화/비활성화 토글 - **구현됨**
- ✅ automation_config 테이블 연동 - **구현됨**
- ✅ 렌더링 완료 시 자동 학습 트리거 - **구현됨**

---

## ❌ 불일치 및 오류 사항

### 1. **WebP 형식 누락** 🔴 **심각**
**문제**: 기술문서에서는 WebP q=90 사용을 명시했으나, 페이지에는 WebP 관련 설정이 전혀 없음

**기술문서 (2.4절)**:
```
학습 이미지: WebP lossy q=90, -m 6, -af on, sRGB(ICC 유지)
템플릿/하드 템플릿: lossless 권장(대안: q=95 + 임계 보정)
```

**현재 코드**: WebP 관련 설정 없음

**영향**: 
- 스토리지 용량 60-70% 절감 효과 미달
- 기술문서 명시 사항 미구현

---

### 2. **어노테이션 스키마 미반영** 🔴 **심각**
**문제**: 어노테이션.txt v1.6.1의 스키마가 메타데이터 구조에 반영되지 않음

**어노테이션 스키마 v1.6.1 주요 필드**:
```json
{
  "schema_version": "1.6.1",
  "quality_3d": {
    "pnp_method": "SOLVEPNP_SQPNP",
    "reprojection_error_rms_px": 1.25,
    "depth_map_validation": {...}
  },
  "domain_context": {
    "complexity_metric": {
      "occlusion_ratio": 0.42,
      "occluded_by_parts": [...]
    }
  }
}
```

**현재 구현**: 기본 메타데이터만 저장, 3D 품질 지표 누락

**영향**:
- 3D 포즈 정확도 검증 불가
- Occlusion 정보 미수집
- Depth map 품질 평가 불가

---

### 3. **파라미터 불일치** 🟡 **중간**

#### 3.1 YOLO 설정 불일치
**기술문서 (4.2절)**:
- conf=0.15, iou=0.60, max_det=1200, imgsz=768

**현재 구현**:
- 설정값이 API 서버에서만 관리됨
- UI에서 확인/조정 불가

#### 3.2 폴링 간격 불일치
**기술문서**: POLL_INTERVAL_MS = 3000 (표준화)
**현재 구현**: POLL_INTERVAL_MS = 3000 ✅ (일치)

#### 3.3 타임아웃 설정
**기술문서**: TIMEOUT_MAX_ATTEMPTS = 300 (10분)
**현재 구현**: TIMEOUT_MAX_ATTEMPTS = 300 ✅ (일치)

---

### 4. **RDA (Render Domain Randomization) 설정 누락** 🟡 **중간**
**문제**: 기술문서 3.2절의 RDA 설정이 UI에 없음

**기술문서 (3.2절)**:
```
Train 80%에 조명/HDR/스크래치/배경/렌즈왜곡
Val/Test는 원본 중심(일반화 평가)
domain=original|rdaX 태깅
```

**현재 구현**: RDA 관련 설정 옵션 없음

**영향**: 도메인 랜덤화 수준 조절 불가

---

### 5. **품질 검증 기준 미구현** 🟡 **중간**
**문제**: 기술문서 3.1절의 QA 규칙이 자동화되지 않음

**기술문서 (3.1절)**:
```
mask 면적 / bbox 면적: 25~98% 범위를 벗어나면 플래그
Topology: hole count Z-score > |3| → 리뷰 큐
EarlyStopping: 15 epoch 내 mAP 개선 < 0.1% → 조기 종료
```

**현재 구현**: 품질 검증 로직 없음

---

### 6. **Essential JSON (경량형) 미지원** 🟡 **중간**
**문제**: 어노테이션.txt 4절의 Essential JSON (v1.6.1-E2) 미구현

**어노테이션 (4절)**:
```json
{
  "schema_version": "1.6.1-E2",
  "pair_uid": "uuid-453601-199",
  "part_id": "4536",
  "annotation": {...},
  "qa": {...},
  "perf": {...}
}
```

**목표 용량**: 0.3-0.9 KB  
**현재**: Essential JSON 지원 안 함

**영향**: Edge 디바이스 최적화 불가

---

## 🔧 개선사항

### 1. **WebP 인코딩 설정 추가** (우선순위: 높음)
```javascript
// 렌더링 설정에 WebP 옵션 추가
const webpQuality = ref(90)  // 기본값 q=90
const webpMethod = ref(6)     // -m 6
const webpAutoFilter = ref(true)  // -af on
```

**UI 추가 위치**: 렌더링 품질 옵션 하단

---

### 2. **어노테이션 스키마 v1.6.1 반영** (우선순위: 높음)
```javascript
// 메타데이터에 3D 품질 지표 추가
const metadata = {
  schema_version: "1.6.1",
  quality_3d: {
    pnp_method: "SOLVEPNP_SQPNP",
    reprojection_error_rms_px: null,
    depth_map_validation: {
      valid_pixel_ratio: null,
      depth_quality_score: null
    }
  },
  domain_context: {
    complexity_metric: {
      occlusion_ratio: null,
      occluded_by_parts: []
    }
  }
}
```

---

### 3. **RDA 설정 UI 추가** (우선순위: 중간)
```vue
<div class="option-group">
  <label>도메인 랜덤화 (RDA)</label>
  <select v-model="rdaStrength">
    <option value="none">사용 안 함</option>
    <option value="rda1">낮음 (RDA-1)</option>
    <option value="rda2">중간 (RDA-2)</option>
    <option value="rda3">높음 (RDA-3)</option>
  </select>
  <small>조명/HDR/배경/렌즈 왜곡 적용 수준</small>
</div>
```

---

### 4. **실시간 품질 검증** (우선순위: 중간)
```javascript
// QA 자동 검증 함수
const validateQuality = (metadata) => {
  const warnings = []
  
  // 마스크/박스 비율 검증
  const maskBboxRatio = metadata.mask_area / metadata.bbox_area
  if (maskBboxRatio < 0.25 || maskBboxRatio > 0.98) {
    warnings.push('마스크/박스 비율 이상')
  }
  
  // SSIM 검증
  if (metadata.image_quality?.ssim < 0.965) {
    warnings.push('SSIM 기준 미달 (WebP q=90 기준 0.965)')
  }
  
  return warnings
}
```

---

### 5. **Essential JSON 생성 옵션** (우선순위: 낮음)
```javascript
const generateEssentialJSON = (fullMeta) => {
  return {
    schema_version: "1.6.1-E2",
    pair_uid: fullMeta.pair_uid,
    part_id: fullMeta.part_id,
    annotation: {
      bbox_pixel_xyxy: fullMeta.annotation.bbox_pixel_xyxy,
      bbox_norm_xyxy: fullMeta.annotation.bbox_norm_xyxy,
      segmentation: {
        rle_base64: fullMeta.annotation.segmentation.rle_base64,
        compressed_size: fullMeta.annotation.segmentation.compressed_size
      }
    },
    qa: {
      qa_flag: fullMeta.integrity.qa_flag,
      reprojection_rms_px: fullMeta.annotation.quality_3d?.reprojection_error_rms_px
    },
    integrity: {
      validated_at: fullMeta.integrity.validated_at
    }
  }
}
```

---

### 6. **YOLO 설정 UI 노출** (우선순위: 낮음)
```vue
<div class="advanced-settings" v-if="showAdvanced">
  <h4>🎯 YOLO 고급 설정</h4>
  <div class="option-group">
    <label>Confidence 임계값</label>
    <input type="number" v-model="yoloConf" min="0.1" max="0.3" step="0.01" />
    <small>기본값: 0.15 (기술문서 4.2절)</small>
  </div>
  <div class="option-group">
    <label>IoU 임계값</label>
    <input type="number" v-model="yoloIou" min="0.4" max="0.7" step="0.05" />
    <small>기본값: 0.60</small>
  </div>
  <div class="option-group">
    <label>최대 검출 수</label>
    <input type="number" v-model="yoloMaxDet" min="500" max="2000" step="100" />
    <small>기본값: 1200</small>
  </div>
</div>
```

---

## 📊 우선순위별 작업 계획

### 🔴 긴급 (1-2일)
1. WebP 인코딩 설정 추가
2. 어노테이션 스키마 v1.6.1 반영

### 🟡 중요 (1주일)
3. RDA 설정 UI 추가
4. 실시간 품질 검증 구현
5. YOLO 설정 UI 노출

### 🟢 개선 (2주일)
6. Essential JSON 생성 옵션
7. 성능 로깅 세분화
8. 보안 거버넌스 UI

---

## 🎯 최종 권장사항

### 즉시 수정 필요
1. **WebP 지원 추가**: 스토리지 비용 60-70% 절감 효과 확보
2. **스키마 v1.6.1 반영**: 3D 품질 검증 기능 활성화

### 기능 보강 필요
3. **RDA 컨트롤**: 도메인 랜덤화 수준 조절
4. **품질 자동 검증**: 실시간 QA 플래그 생성
5. **고급 설정 노출**: YOLO 파라미터 조정 가능

### 장기 개선
6. **Essential JSON**: Edge 디바이스 최적화
7. **성능 대시보드**: 세분화된 메트릭 시각화
8. **접근 제어**: RLS 기반 보안 정책

---

## 📝 결론

SyntheticDatasetManager.vue는 기본적인 렌더링 파이프라인은 잘 구현되어 있으나, **WebP 지원**과 **어노테이션 스키마 v1.6.1** 같은 핵심 기술문서 요구사항이 누락되어 있습니다. 

특히:
- **WebP 미지원**으로 스토리지 최적화 효과 미달
- **3D 품질 지표 부재**로 정밀 검증 불가
- **RDA/QA 자동화 부재**로 데이터 품질 관리 수동화

위 개선사항을 단계적으로 적용하면 기술문서와 100% 정합성을 달성할 수 있습니다.

