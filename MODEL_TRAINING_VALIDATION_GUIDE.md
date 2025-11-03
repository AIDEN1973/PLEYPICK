# 모델 학습 검증 및 버전 관리 가이드

## 개요

BrickBox의 YOLO 모델 학습이 정확하게 이루어졌는지, 그리고 기존 모델 버전을 어떻게 검증할 수 있는지에 대한 종합 가이드입니다.

---

## 1. 학습 정확성 검증

### 1.1 학습 중 메트릭 모니터링

**위치**: `training_metrics` 테이블

**저장되는 메트릭**:
- `mAP50`: IoU 0.5 기준 평균 정밀도
- `mAP50_95`: IoU 0.5~0.95 평균 정밀도
- `precision`: 정밀도
- `recall`: 재현율
- `f1_score`: F1 점수
- `train_loss`: 학습 손실
- `val_loss`: 검증 손실
- `box_loss`, `seg_loss`, `cls_loss`, `dfl_loss`: 세부 손실

**확인 방법**:

```sql
-- 특정 학습 작업의 메트릭 히스토리 조회
SELECT 
    epoch,
    mAP50,
    mAP50_95,
    precision,
    recall,
    train_loss,
    val_loss,
    timestamp
FROM training_metrics
WHERE training_job_id = <job_id>
ORDER BY epoch ASC;
```

**검증 기준** (기술문서.txt):
- **소형 Recall**: ≥ 0.95 (SLO)
- **Top-1@BOM**: ≥ 0.97 (SLO)
- **mAP50**: 일반적으로 0.90 이상 권장
- **mAP50-95**: 일반적으로 0.60 이상 권장

### 1.2 학습 완료 시 최종 메트릭

**위치**: `training_jobs.final_metrics` (JSONB)

**코드 위치**: `scripts/local_yolo_training.py:1222-1240`

```python
final_metrics = {
    'mAP50': float(getattr(results.box, 'map50', 0.0)),
    'mAP50_95': float(getattr(results.box, 'map', 0.0)),
    'precision': float(getattr(results.box, 'mp', 0.0)),
    'recall': float(getattr(results.box, 'mr', 0.0))
}
```

**확인 방법**:

```sql
-- 최종 메트릭 조회
SELECT 
    id,
    job_name,
    status,
    config->'partId' as part_id,
    progress->'percent' as progress_percent,
    config->'final_metrics' as final_metrics,
    completed_at
FROM training_jobs
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 10;
```

### 1.3 EarlyStopping 검증

**위치**: `src/composables/useYOLOEarlyStopping.js`

**기준**: 15 epoch 내 mAP 개선 < 0.1% → 조기 종료 (기술문서.txt 3.1)

**확인 방법**:

```sql
-- EarlyStopping 발생 여부 확인
SELECT 
    tj.id,
    tj.job_name,
    EXTRACT(EPOCH FROM (tj.completed_at - tj.started_at)) / 60 as duration_minutes,
    (SELECT COUNT(*) FROM training_metrics WHERE training_job_id = tj.id) as total_epochs,
    (SELECT MAX(epoch) FROM training_metrics WHERE training_job_id = tj.id) as last_epoch
FROM training_jobs tj
WHERE tj.status = 'completed'
ORDER BY tj.completed_at DESC;
```

**검증 포인트**:
- 총 에폭 수가 설정한 최대 에폭보다 적으면 EarlyStopping 발생
- 마지막 몇 개 에폭의 mAP 개선량 < 0.1% 확인

---

## 2. 모델 버전 관리 및 검증

### 2.1 모델 레지스트리

**위치**: `model_registry` 테이블

**주요 필드**:
- `version`: 모델 버전 (고유)
- `model_name`: 모델 이름
- `model_url`: Supabase Storage URL
- `metrics`: 성능 메트릭 (JSONB)
- `status`: 상태 (`active`, `inactive`, `deprecated`, `failed`)
- `training_job_id`: 연결된 학습 작업 ID

**확인 방법**:

```sql
-- 활성 모델 조회
SELECT * FROM active_models;

-- 또는 직접 조회
SELECT 
    id,
    version,
    model_name,
    model_url,
    metrics->'mAP50' as map50,
    metrics->'mAP50_95' as map50_95,
    status,
    created_at
FROM model_registry
WHERE status = 'active'
ORDER BY created_at DESC;
```

### 2.2 모델 버전 비교

**위치**: `src/composables/useModelVersionChecker.js`

**기능**:
- 현재 사용 중인 모델 확인
- 최신 모델 버전 확인
- 성능 메트릭 비교
- 자동 업데이트 감지

**사용 예시**:

```javascript
import { useModelVersionChecker } from '@/composables/useModelVersionChecker'

const {
  currentModel,
  latestModel,
  hasUpdate,
  comparePerformanceMetrics,
  updateToLatestModel
} = useModelVersionChecker()

// 현재 모델 정보 확인
await getCurrentModel()

// 최신 모델 확인
await checkLatestModel()

// 성능 비교
if (hasUpdate.value) {
  await comparePerformanceMetrics()
}
```

**성능 메트릭 비교**:

```javascript
const improvements = {
  mAP50: (latestMetrics.mAP50 || 0) - (currentMetrics.mAP50 || 0),
  mAP50_95: (latestMetrics.mAP50_95 || 0) - (currentMetrics.mAP50_95 || 0),
  precision: (latestMetrics.precision || 0) - (currentMetrics.precision || 0),
  recall: (latestMetrics.recall || 0) - (currentMetrics.recall || 0)
}
```

### 2.3 모델 히스토리 추적

**확인 방법**:

```sql
-- 모델 히스토리 조회
SELECT 
    mr.id,
    mr.version,
    mr.model_name,
    mr.metrics,
    mr.status,
    mr.created_at,
    tj.job_name,
    tj.completed_at
FROM model_registry mr
LEFT JOIN training_jobs tj ON mr.training_job_id = tj.id
ORDER BY mr.created_at DESC
LIMIT 20;
```

---

## 3. 학습 작업 상태 검증

### 3.1 학습 작업 상태 확인

**위치**: `training_jobs` 테이블

**상태 종류**:
- `pending`: 대기 중
- `running`: 실행 중
- `training`: 학습 중
- `completed`: 완료
- `failed`: 실패
- `cancelled`: 취소됨

**확인 방법**:

```sql
-- 학습 작업 상태 조회
SELECT 
    id,
    job_name,
    status,
    config->'partId' as part_id,
    config->'modelStage' as stage,
    config->'epochs' as epochs,
    progress->'percent' as progress_percent,
    progress->'current_epoch' as current_epoch,
    error_message,
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (completed_at - started_at)) / 60 as duration_minutes
FROM training_jobs
ORDER BY created_at DESC
LIMIT 20;
```

### 3.2 실시간 학습 진행률 확인

**위치**: `server/training-executor.js::parseAndSaveMetrics`

**저장 주기**: 매 에폭마다 메트릭 저장

**확인 방법**:

```sql
-- 최근 에폭 메트릭 조회
SELECT 
    epoch,
    mAP50,
    mAP50_95,
    train_loss,
    val_loss,
    timestamp
FROM training_metrics
WHERE training_job_id = <job_id>
ORDER BY epoch DESC
LIMIT 10;
```

---

## 4. 모델 성능 검증 (추론 단계)

### 4.1 벤치마크 기준

**위치**: `src/composables/useYOLOModelUpgrade.js`

**기준** (기술문서.txt 4.1):
- **소형 Recall**: ≥ 0.95
- **FPS**: ≥ 5
- **테스트 세트**: 대표 세트 3종
- **테스트 프레임**: 세트당 500프레임

**검증 순서**:
1. `yolo11m-seg@768` 벤치마크
2. 미달 시 `yolo11m-seg@960` 벤치마크
3. 여전히 미달 시 `yolov8-l-seg@768` 승급

### 4.2 실제 성능 모니터링

**위치**: `src/views/AutomatedTrainingDashboard.vue`

**SLO 기준** (기술문서.txt 1.3):
- 탐지 Recall(소형 포함): ≥ 0.95
- 식별 Top-1@BOM: ≥ 0.97
- 오검출률: ≤ 3%
- 보류율: ≤ 5%
- 평균 지연: 100-150ms/frame
- WebP 디코딩 p95: ≤ 15ms/frame

**확인 방법**:

```javascript
// AutomatedTrainingDashboard에서 실시간 모니터링
const performanceMetrics = {
  recall: 0.95,              // SLO: ≥ 0.95
  top1Accuracy: 0.97,         // SLO: ≥ 0.97
  detectionLatency: 120,     // SLO: 100-150ms
  searchLatency: 12,         // SLO: ≤ 15ms
  p95Latency: 145,           // SLO: ≤ 150ms
  holdRate: 0.03,            // SLO: ≤ 5%
  webpDecodeP95: 14          // SLO: ≤ 15ms
}
```

---

## 5. 종합 검증 체크리스트

### 5.1 학습 전 검증

- [ ] 데이터셋 준비 완료 (이미지 + 라벨)
- [ ] Train/Val 분할 확인 (80/20 또는 80/10/10)
- [ ] 중복 제거 완료 (SSIM ≥ 0.965)
- [ ] WebP 인코딩 품질 확인 (q=90)

### 5.2 학습 중 검증

- [ ] 학습 작업 상태: `training`
- [ ] 메트릭이 `training_metrics`에 저장되는지 확인
- [ ] 에폭별 mAP50, mAP50-95 증가 추세 확인
- [ ] train_loss 감소 추세 확인
- [ ] val_loss 감소 추세 확인
- [ ] EarlyStopping 조건 확인 (15 epoch, 0.1% 개선)

### 5.3 학습 완료 후 검증

- [ ] 학습 작업 상태: `completed`
- [ ] 최종 메트릭 확인:
  - [ ] mAP50 ≥ 0.90
  - [ ] mAP50-95 ≥ 0.60
  - [ ] recall ≥ 0.95 (소형 포함)
- [ ] 모델 파일 저장 확인:
  - [ ] PyTorch 모델 (.pt)
  - [ ] ONNX 모델 (.onnx)
- [ ] `model_registry`에 등록 확인
- [ ] Supabase Storage 업로드 확인

### 5.4 모델 버전 검증

- [ ] 현재 활성 모델 확인 (`model_registry.status = 'active'`)
- [ ] 모델 URL 접근 가능 여부 확인
- [ ] 성능 메트릭이 `metrics` JSONB에 저장되었는지 확인
- [ ] 학습 작업 ID 연결 확인 (`training_job_id`)

### 5.5 배포 전 검증

- [ ] 벤치마크 테스트 통과:
  - [ ] 소형 Recall ≥ 0.95
  - [ ] FPS ≥ 5
- [ ] 실제 데이터셋 테스트:
  - [ ] Top-1@BOM ≥ 0.97
  - [ ] 오검출률 ≤ 3%
  - [ ] 보류율 ≤ 5%
- [ ] 성능 지표 확인:
  - [ ] 평균 지연 100-150ms
  - [ ] WebP 디코딩 p95 ≤ 15ms

---

## 6. 문제 해결

### 6.1 학습이 완료되지 않는 경우

**확인 사항**:
1. 학습 작업 상태 확인:
   ```sql
   SELECT status, error_message FROM training_jobs WHERE id = <job_id>;
   ```

2. 학습 로그 확인:
   ```sql
   SELECT * FROM training_metrics WHERE training_job_id = <job_id> ORDER BY epoch DESC LIMIT 5;
   ```

3. 에러 메시지 확인:
   - `training_jobs.error_message` 확인
   - Python 학습 스크립트 로그 확인

### 6.2 모델이 등록되지 않는 경우

**확인 사항**:
1. 모델 파일 존재 확인:
   ```bash
   ls -lh public/models/*.onnx
   ```

2. Supabase Storage 업로드 확인:
   ```sql
   SELECT * FROM storage.objects WHERE bucket_id = 'models' ORDER BY created_at DESC LIMIT 5;
   ```

3. `model_registry` 등록 확인:
   ```sql
   SELECT * FROM model_registry WHERE training_job_id = <job_id>;
   ```

### 6.3 모델 버전이 업데이트되지 않는 경우

**확인 사항**:
1. 현재 모델 확인:
   ```sql
   SELECT * FROM model_registry WHERE status = 'active';
   ```

2. 최신 모델 확인:
   ```sql
   SELECT * FROM model_registry ORDER BY created_at DESC LIMIT 1;
   ```

3. 성능 메트릭 비교:
   - `useModelVersionChecker` 사용
   - 성능 개선량 확인 (기본 임계값: 5%)

---

## 7. SQL 쿼리 모음

### 7.1 학습 작업 요약

```sql
-- 최근 학습 작업 요약
SELECT 
    tj.id,
    tj.job_name,
    tj.status,
    tj.config->'partId' as part_id,
    tj.progress->'percent' as progress,
    COUNT(tm.id) as metric_count,
    MAX(tm.epoch) as last_epoch,
    MAX(tm.mAP50) as best_map50,
    tj.completed_at
FROM training_jobs tj
LEFT JOIN training_metrics tm ON tj.id = tm.training_job_id
GROUP BY tj.id
ORDER BY tj.created_at DESC
LIMIT 10;
```

### 7.2 모델 성능 비교

```sql
-- 모델 성능 비교 (활성 vs 최신)
WITH active_model AS (
    SELECT * FROM model_registry WHERE status = 'active' LIMIT 1
),
latest_model AS (
    SELECT * FROM model_registry ORDER BY created_at DESC LIMIT 1
)
SELECT 
    'active' as type,
    version,
    metrics->'mAP50' as map50,
    metrics->'mAP50_95' as map50_95,
    metrics->'precision' as precision,
    metrics->'recall' as recall
FROM active_model
UNION ALL
SELECT 
    'latest' as type,
    version,
    metrics->'mAP50' as map50,
    metrics->'mAP50_95' as map50_95,
    metrics->'precision' as precision,
    metrics->'recall' as recall
FROM latest_model;
```

### 7.3 학습 메트릭 추이 분석

```sql
-- 학습 메트릭 추이 (에폭별)
SELECT 
    epoch,
    mAP50,
    mAP50_95,
    train_loss,
    val_loss,
    CASE 
        WHEN LAG(mAP50) OVER (ORDER BY epoch) IS NOT NULL 
        THEN mAP50 - LAG(mAP50) OVER (ORDER BY epoch)
        ELSE NULL 
    END as map50_improvement
FROM training_metrics
WHERE training_job_id = <job_id>
ORDER BY epoch;
```

---

## 8. 자동화 스크립트

### 8.1 학습 검증 스크립트

```python
# scripts/validate_training.py
import sys
from supabase import create_client
import os

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def validate_training(job_id):
    # 학습 작업 확인
    job = supabase.table('training_jobs').select('*').eq('id', job_id).single().execute()
    
    if job.data['status'] != 'completed':
        print(f"❌ 학습 미완료: {job.data['status']}")
        return False
    
    # 최종 메트릭 확인
    final_metrics = job.data.get('config', {}).get('final_metrics', {})
    
    checks = {
        'mAP50 ≥ 0.90': final_metrics.get('mAP50', 0) >= 0.90,
        'mAP50-95 ≥ 0.60': final_metrics.get('mAP50_95', 0) >= 0.60,
        'recall ≥ 0.95': final_metrics.get('recall', 0) >= 0.95
    }
    
    for check_name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"{status} {check_name}: {final_metrics.get(check_name.split()[0].lower(), 'N/A')}")
    
    return all(checks.values())

if __name__ == '__main__':
    job_id = int(sys.argv[1])
    result = validate_training(job_id)
    sys.exit(0 if result else 1)
```

### 8.2 모델 버전 검증 스크립트

```python
# scripts/validate_model_version.py
import sys
from supabase import create_client
import os

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def validate_model_version(version):
    model = supabase.table('model_registry').select('*').eq('version', version).single().execute()
    
    if not model.data:
        print(f"❌ 모델 버전 {version} 없음")
        return False
    
    checks = {
        '모델 파일 존재': model.data.get('model_url') is not None,
        '메트릭 저장됨': model.data.get('metrics') is not None,
        '학습 작업 연결됨': model.data.get('training_job_id') is not None
    }
    
    for check_name, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"{status} {check_name}")
    
    return all(checks.values())

if __name__ == '__main__':
    version = sys.argv[1]
    result = validate_model_version(version)
    sys.exit(0 if result else 1)
```

---

## 9. 등록된 모델 정확도 검증

### 9.1 검증 스크립트 사용

**파일**: `scripts/validate_registered_model.py`

**기능**:
- 활성 모델 또는 특정 버전 모델 조회
- Supabase Storage에서 모델 파일 다운로드
- 테스트 데이터셋으로 평가 실행
- 성능 메트릭 계산 (mAP50, mAP50-95, precision, recall)
- `model_registry.metrics` 업데이트
- SLO 기준 자동 확인

**사용법**:

```bash
# 활성 모델 검증
python scripts/validate_registered_model.py

# 특정 버전 모델 검증
python scripts/validate_registered_model.py --version v1.0.0

# 커스텀 테스트 데이터셋 사용
python scripts/validate_registered_model.py --test-set output/dataset_custom

# CPU 사용
python scripts/validate_registered_model.py --device cpu
```

**필수 환경 변수**:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 9.2 검증 프로세스

1. **모델 조회**: `model_registry`에서 활성 모델 또는 지정 버전 조회
2. **모델 다운로드**: Supabase Storage에서 모델 파일(.pt) 다운로드
3. **테스트 데이터셋 준비**: `output/dataset_synthetic` 또는 지정 경로 사용
4. **평가 실행**: YOLO `model.val()` 실행
5. **메트릭 업데이트**: `model_registry.metrics`에 검증 결과 저장
6. **SLO 확인**: 
   - Recall ≥ 0.95
   - mAP50 ≥ 0.90
   - mAP50-95 ≥ 0.60

### 9.3 검증 결과 확인

**SQL 쿼리**:
```sql
-- 검증 메트릭 확인
SELECT 
    version,
    model_name,
    metrics->'validation_mAP50' as validation_map50,
    metrics->'validation_mAP50_95' as validation_map50_95,
    metrics->'validation_precision' as validation_precision,
    metrics->'validation_recall' as validation_recall,
    metrics->'last_validated' as last_validated
FROM model_registry
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 1;
```

**출력 예시**:
```
✅ 모델 발견:
   버전: v1.0.0
   이름: lego_yolo_set_76917
   URL: https://...
   상태: active

[DOWNLOAD] 모델 다운로드 중...
✅ 모델 다운로드 완료

[EVAL] 모델 평가 시작...
✅ 평가 완료:
   mAP50: 0.9245
   mAP50-95: 0.6789
   Precision: 0.9123
   Recall: 0.9654
   F1 Score: 0.9381

📊 SLO 기준 확인:
   ✅ Recall ≥ 0.95
   ✅ mAP50 ≥ 0.90
   ✅ mAP50-95 ≥ 0.60
```

### 9.4 주기적 검증 자동화

**cron 스크립트 예시**:
```bash
#!/bin/bash
# 매일 자정에 활성 모델 검증
0 0 * * * cd /path/to/brickbox && python scripts/validate_registered_model.py >> logs/validation.log 2>&1
```

---

## 참고

- **기술문서.txt**: SLO 기준 및 벤치마크 기준
- **scripts/local_yolo_training.py**: 학습 스크립트 및 메트릭 저장 로직
- **scripts/validate_registered_model.py**: 모델 정확도 검증 스크립트
- **src/composables/useModelVersionChecker.js**: 모델 버전 확인 로직
- **supabase/migrations/20251009151539_create_automated_training_schema.sql**: 데이터베이스 스키마

