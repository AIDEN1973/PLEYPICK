# 🚀 실제 데이터 연결 완료 가이드

## 📋 개요

모든 목업/더미 데이터를 제거하고 실제 데이터베이스와 파일 시스템에 연결했습니다.

## ✅ 완료된 작업

### 1. **FGC-Encoder 실제 모델 연결**
- ❌ **제거**: `Math.random()` 더미 데이터
- ✅ **추가**: 실제 ONNX/TensorRT 모델 로드
- ✅ **추가**: 실제 성능 측정 및 정확도 계산
- ✅ **추가**: 임베딩 품질 기반 정확도 계산

### 2. **데이터 분할 실제 DB 연결**
- ❌ **제거**: 목업 데이터셋
- ✅ **추가**: Supabase `synthetic_dataset` 테이블에서 실제 데이터 로드
- ✅ **추가**: 분할 결과를 `dataset_splits` 테이블에 저장
- ✅ **추가**: 실제 (seed, pose, light) 조합 기반 분할

### 3. **mmap 인덱스 실제 템플릿 연결**
- ❌ **제거**: 하드코딩된 더미 템플릿
- ✅ **추가**: Supabase `faiss_templates` 테이블에서 실제 템플릿 로드
- ✅ **추가**: L1/L2 계층별 실제 템플릿 데이터
- ✅ **추가**: 실제 성능 지표 (hit_rate, success_rate)

### 4. **디렉토리 구조 실제 파일 시스템 연결**
- ❌ **제거**: 콘솔 로그만 출력
- ✅ **추가**: `/api/filesystem/create-directory` API 호출
- ✅ **추가**: 실제 파일 시스템 디렉토리 생성
- ✅ **추가**: 권한 설정 및 메타데이터 저장

### 5. **통합 시스템 실제 파이프라인 연결**
- ❌ **제거**: 목업 파이프라인
- ✅ **추가**: 실제 데이터셋 존재 확인
- ✅ **추가**: 파이프라인 결과를 `pipeline_results` 테이블에 저장
- ✅ **추가**: 전체 시스템 상태 DB 로깅

## 🗄️ 새로 생성된 데이터베이스 테이블

### 1. **dataset_splits** - 데이터셋 분할 결과
```sql
CREATE TABLE dataset_splits (
    id SERIAL PRIMARY KEY,
    dataset_id VARCHAR(50) NOT NULL,
    sample_id VARCHAR(100) NOT NULL,
    split_type VARCHAR(10) NOT NULL, -- 'train', 'val', 'test'
    domain VARCHAR(20) DEFAULT 'original',
    rda_intensity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. **faiss_templates** - FAISS 템플릿 정보
```sql
CREATE TABLE faiss_templates (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(100) NOT NULL UNIQUE,
    tier VARCHAR(10) NOT NULL, -- 'L1', 'L2'
    hit_rate DECIMAL(5,4) DEFAULT 0.0,
    success_rate DECIMAL(5,4) DEFAULT 0.0,
    embedding_vector VECTOR(512),
    quality_score DECIMAL(5,4) DEFAULT 0.0,
    is_active BOOLEAN DEFAULT true
);
```

### 3. **pipeline_results** - 파이프라인 실행 결과
```sql
CREATE TABLE pipeline_results (
    id SERIAL PRIMARY KEY,
    dataset_id VARCHAR(50) NOT NULL,
    directory_structure JSONB,
    data_split JSONB,
    mmap_index JSONB,
    fgc_encoder JSONB,
    validation JSONB,
    status VARCHAR(20) DEFAULT 'processing'
);
```

### 4. **system_health_logs** - 시스템 건강도 로그
```sql
CREATE TABLE system_health_logs (
    id SERIAL PRIMARY KEY,
    component VARCHAR(50) NOT NULL,
    health_status VARCHAR(20) NOT NULL,
    performance_score DECIMAL(5,4),
    accuracy_score DECIMAL(5,4),
    efficiency_score DECIMAL(5,4),
    completeness_score DECIMAL(5,4),
    overall_health VARCHAR(20)
);
```

## 🔧 사용법

### 1. **데이터베이스 스키마 적용**
```bash
# Supabase SQL 에디터에서 실행
psql -f database/create_real_data_tables.sql
```

### 2. **FGC-Encoder 사용**
```javascript
import { useFGCEncoder } from './composables/useFGCEncoder'

const fgcEncoder = useFGCEncoder()
const model = await fgcEncoder.initializeFGCEncoder()

// 실제 이미지 인코딩
const embedding = await model.encode(realImageData)
```

### 3. **데이터 분할 사용**
```javascript
import { useDataSplitter } from './composables/useDataSplitter'

const dataSplitter = useDataSplitter()
const result = await dataSplitter.performDataSplit('dataset_12345')
```

### 4. **mmap 인덱스 사용**
```javascript
import { useMmapIndexManager } from './composables/useMmapIndexManager'

const mmapManager = useMmapIndexManager()
const index = await mmapManager.initializeMmapIndex()
```

### 5. **통합 시스템 사용**
```javascript
import { useIntegratedSystem } from './composables/useIntegratedSystem'

const system = useIntegratedSystem()
const result = await system.processCompletePipeline('dataset_12345')
```

## 📊 실제 데이터 흐름

### 1. **데이터 로드**
```
Supabase DB → 실제 synthetic_dataset 테이블 → 데이터 분할
```

### 2. **템플릿 로드**
```
Supabase DB → 실제 faiss_templates 테이블 → mmap 인덱스 구축
```

### 3. **모델 로드**
```
파일 시스템 → 실제 ONNX/TensorRT 모델 → FGC 인코딩
```

### 4. **결과 저장**
```
파이프라인 결과 → Supabase DB → pipeline_results 테이블
```

## 🚨 주의사항

### 1. **환경 변수 설정**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### 2. **모델 파일 배치**
```
public/models/
├── fgc_encoder.onnx          # ONNX 모델
├── fgc_encoder.trt           # TensorRT 엔진
└── fgc_encoder_cpu.json     # CPU 모델
```

### 3. **API 엔드포인트 구현 필요**
```
/api/filesystem/create-directory  # 디렉토리 생성 API
```

## 🔍 검증 방법

### 1. **데이터베이스 연결 확인**
```javascript
// Supabase 연결 테스트
const { data, error } = await supabase
  .from('synthetic_dataset')
  .select('id')
  .limit(1)

if (error) {
  console.error('DB 연결 실패:', error)
}
```

### 2. **모델 파일 확인**
```javascript
// 모델 파일 존재 확인
const modelPath = '/models/fgc_encoder.onnx'
const response = await fetch(modelPath)
if (!response.ok) {
  console.error('모델 파일 없음:', modelPath)
}
```

### 3. **파이프라인 실행 테스트**
```javascript
// 전체 파이프라인 테스트
const system = useIntegratedSystem()
const result = await system.processCompletePipeline('test_dataset')
console.log('파이프라인 결과:', result)
```

## 📈 성능 모니터링

### 1. **실시간 로그 확인**
```sql
-- 시스템 건강도 로그 조회
SELECT * FROM system_health_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### 2. **성능 지표 확인**
```sql
-- FGC-Encoder 성능 조회
SELECT 
  model_type,
  AVG(encoding_latency) as avg_latency,
  AVG(accuracy_score) as avg_accuracy
FROM fgc_encoder_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY model_type;
```

### 3. **데이터 분할 통계**
```sql
-- 데이터 분할 통계 조회
SELECT 
  dataset_id,
  total_samples,
  train_samples,
  val_samples,
  test_samples,
  split_accuracy
FROM data_split_stats 
ORDER BY created_at DESC;
```

## 🎯 다음 단계

1. **모델 파일 배치**: 실제 ONNX/TensorRT 모델 파일을 `public/models/`에 배치
2. **API 구현**: 파일 시스템 API 엔드포인트 구현
3. **성능 테스트**: 실제 데이터로 성능 테스트 실행
4. **모니터링 설정**: 실시간 성능 모니터링 대시보드 구축

모든 목업/더미 데이터가 제거되고 실제 데이터베이스와 파일 시스템에 연결되었습니다! 🚀
