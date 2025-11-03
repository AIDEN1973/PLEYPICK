# 모델 모니터링 페이지 개선 및 검증 기능 통합

## 변경 사항 요약

### 1. 필드명 불일치 수정

**문제**: DB 스키마와 코드에서 사용하는 필드명이 불일치하여 NaN 표시

**수정 내용**:
- `is_active` → `status = 'active'`로 변경
- `performance_metrics` → `metrics` JSONB 필드 읽기
- `model_version` → `version` 필드 매핑
- `model_type` 기본값 설정 ('yolo')

**파일**: `src/composables/useModelVersionChecker.js`

### 2. 메트릭 표시 개선

**문제**: metrics 필드가 null/undefined일 때 NaN 표시

**수정 내용**:
- `formatMetric()` 함수 추가 (NaN 처리)
- `validation_*` 접두사 메트릭 우선 사용
- "데이터 없음" 표시 추가

**파일**: `src/views/ModelMonitoringDashboard.vue`

### 3. 모델 검증 기능 통합

**추가 기능**:
- 모델 검증 버튼 추가
- 실시간 진행률 표시 (Server-Sent Events)
- 검증 결과 표시 및 자동 새로고침
- 검증 메트릭 DB 자동 업데이트

**API 엔드포인트**: `POST /api/training/validate/:modelId`

**파일**:
- `server/training-executor.js`: 검증 API 추가
- `src/views/ModelMonitoringDashboard.vue`: UI 통합
- `scripts/validate_registered_model.py`: 검증 스크립트

---

## 사용 방법

### 1. 모델 검증 실행

**UI에서**:
1. 모델 모니터링 페이지 접속: `http://localhost:3000/model-monitoring`
2. "🔍 모델 검증 실행" 버튼 클릭
3. 진행률 및 결과 확인

**API에서**:
```bash
curl -X POST http://localhost:3012/api/training/validate/1
```

### 2. 검증 결과 확인

**UI에서**: 성능 메트릭 섹션에 검증 결과 자동 표시

**DB에서**:
```sql
SELECT 
    version,
    model_name,
    metrics->'validation_mAP50' as validation_map50,
    metrics->'validation_mAP50_95' as validation_map50_95,
    metrics->'validation_precision' as validation_precision,
    metrics->'validation_recall' as validation_recall,
    metrics->'last_validated' as last_validated
FROM model_registry
WHERE status = 'active';
```

---

## 기술 세부사항

### 1. 데이터 정규화

**문제**: DB 필드명과 프론트엔드에서 기대하는 필드명 불일치

**해결**:
```javascript
// useModelVersionChecker.js에서 정규화
currentModel.value = {
  ...modelData,
  model_version: modelData.version,        // version → model_version
  model_type: modelData.model_type || 'yolo',
  is_active: modelData.status === 'active', // status → is_active
  performance_metrics: modelData.metrics || {} // metrics → performance_metrics
}
```

### 2. 메트릭 우선순위

1. `validation_mAP50` (검증 메트릭, 최우선)
2. `mAP50` (학습 메트릭, 폴백)
3. `0` (기본값)

### 3. Server-Sent Events (SSE)

**진행률 전송**:
- 10%: 모델 파일 다운로드 중
- 30%: 모델 다운로드 완료
- 50%: 모델 평가 실행 중
- 90%: 평가 완료, 결과 처리 중
- 100%: 검증 완료

**응답 형식**:
```
data: {"progress": 50, "status": "모델 평가 실행 중..."}
data: {"progress": 100, "complete": true, "success": true, "metrics": {...}}
```

---

## 환경 설정

**필수 환경 변수**:
```bash
# 학습 실행 서버 포트 (기본: 3012)
VITE_TRAINING_API_URL=http://localhost:3012

# Supabase 설정
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 검증 프로세스

```
사용자 "검증 실행" 클릭
  ↓
프론트엔드: POST /api/training/validate/:modelId
  ↓
서버: 모델 정보 조회 (model_registry)
  ↓
Python 스크립트 실행: validate_registered_model.py
  ├─ 모델 파일 다운로드 (Supabase Storage)
  ├─ 테스트 데이터셋 준비
  ├─ YOLO model.val() 실행
  └─ 메트릭 추출 (mAP50, mAP50-95, precision, recall)
  ↓
서버: 메트릭 파싱 및 DB 업데이트
  ├─ model_registry.metrics 업데이트
  └─ validation_* 접두사로 저장
  ↓
프론트엔드: 결과 표시 및 자동 새로고침
```

---

## 참고

- `MODEL_TRAINING_VALIDATION_GUIDE.md`: 상세 검증 가이드
- `scripts/validate_registered_model.py`: 검증 스크립트
- `server/training-executor.js`: 검증 API 구현
- `src/views/ModelMonitoringDashboard.vue`: UI 구현

