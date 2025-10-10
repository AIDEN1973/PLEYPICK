# 🚀 BrickBox 2단계 하이브리드 YOLO11s-seg 시스템 아키텍처

## 📊 시스템 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                    BrickBox 폐쇄환경 시스템                      │
├─────────────────────────────────────────────────────────────────┤
│  📱 사용자 인터페이스 (Vue.js)                                  │
│  ├── HybridDetection.vue (2단계 검출 UI)                       │
│  ├── RealTimeMonitoring.vue (실시간 모니터링)                  │
│  └── ModelManagement.vue (모델 관리)                           │
├─────────────────────────────────────────────────────────────────┤
│  🧠 2단계 하이브리드 검출 엔진                                  │
│  ├── 1차: YOLO11n-seg (빠른 스캔)                              │
│  │   ├── 전체 영역 스캔 (45-55 FPS)                            │
│  │   ├── 누락 후보 영역 식별                                   │
│  │   └── <2GB VRAM 사용                                        │
│  └── 2차: YOLO11s-seg (정밀 검증)                              │
│      ├── 후보 영역 정밀 검증 (25-30 FPS)                       │
│      ├── 픽셀 단위 마스크 생성                                  │
│      └── 3-4GB VRAM 사용                                       │
├─────────────────────────────────────────────────────────────────┤
│  🗄️ 데이터베이스 (Supabase)                                    │
│  ├── model_registry (하이브리드 모델 관리)                      │
│  ├── active_models (활성 모델 상태)                            │
│  ├── training_jobs (학습 작업 관리)                             │
│  └── detection_logs (검출 결과 로그)                            │
├─────────────────────────────────────────────────────────────────┤
│  🎯 학습 파이프라인                                            │
│  ├── 합성 데이터셋 생성 (20,000개)                              │
│  ├── Train/Val 분할 (80/20)                                    │
│  ├── YOLO11n-seg 학습 (1차 모델)                              │
│  ├── YOLO11s-seg 학습 (2차 모델)                              │
│  └── ONNX 변환 및 배포                                         │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 2단계 검출 프로세스

### **1단계: 빠른 스캔 (YOLO11n-seg)**
```javascript
// 1차 검출: 전체 영역 빠른 스캔
const stage1Results = await yolo11n.detect(image, {
  confThreshold: 0.3,  // 낮은 임계값으로 후보 식별
  maxDetections: 50    // 많은 후보 수집
});

// 누락 후보 영역 식별
const suspiciousRegions = stage1Results.filter(detection => 
  detection.confidence < 0.7 || detection.area < threshold
);
```

### **2단계: 정밀 검증 (YOLO11s-seg)**
```javascript
// 2차 검증: 후보 영역만 정밀 검사
if (suspiciousRegions.length > 0) {
  const stage2Results = await yolo11s.detect(candidateRegions, {
    confThreshold: 0.5,  // 높은 임계값으로 정확한 판정
    segmentation: true   // 픽셀 단위 마스크 생성
  });
  
  // 최종 누락 판정
  const missingParts = stage2Results.filter(detection => 
    detection.confidence > 0.8 && detection.mask.area < expectedArea
  );
}
```

## 🎯 모델별 역할 분담

| 모델 | 역할 | 성능 | 사용 시점 |
|------|------|------|-----------|
| **YOLO11n-seg** | 빠른 전체 스캔 | 45-55 FPS | 항상 실행 |
| **YOLO11s-seg** | 정밀 검증 | 25-30 FPS | 후보 발견 시만 |

## 🗄️ 데이터베이스 스키마 확장

### **model_registry 테이블 확장**
```sql
-- 하이브리드 모델 지원을 위한 컬럼 추가
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS model_stage VARCHAR(20); -- 'stage1', 'stage2'
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS hybrid_config JSONB DEFAULT '{}';
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS memory_usage INTEGER; -- VRAM 사용량
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS fps_performance DECIMAL(5,2); -- FPS 성능
```

### **active_models 테이블 확장**
```sql
-- 2단계 모델 관리
ALTER TABLE active_models ADD COLUMN IF NOT EXISTS stage1_model_id INTEGER;
ALTER TABLE active_models ADD COLUMN IF NOT EXISTS stage2_model_id INTEGER;
ALTER TABLE active_models ADD COLUMN IF NOT EXISTS hybrid_mode BOOLEAN DEFAULT false;
```

## 🚀 성능 최적화 전략

### **메모리 관리**
- **동적 로딩**: 필요시에만 2차 모델 로드
- **모델 캐싱**: 자주 사용되는 모델 메모리 유지
- **VRAM 모니터링**: 실시간 메모리 사용량 추적

### **처리 최적화**
- **병렬 처리**: 1차/2차 검출 동시 실행
- **영역 기반 처리**: 후보 영역만 2차 검증
- **결과 캐싱**: 동일 영역 중복 검증 방지

## 📈 예상 성능 향상

| 항목 | 기존 (단일 모델) | 하이브리드 | 개선율 |
|------|------------------|------------|--------|
| **전체 FPS** | 25-30 | 45-55 (1차) | +80% |
| **정확도** | 85% | 95% (2차 검증) | +12% |
| **메모리 효율** | 고정 사용 | 동적 사용 | +40% |
| **누락 검출** | 90% | 98% | +9% |

## 🔧 구현 단계

1. **데이터베이스 스키마 업데이트**
2. **1차 모델 (YOLO11n-seg) 구현**
3. **2차 모델 (YOLO11s-seg) 구현**
4. **하이브리드 검출 엔진 개발**
5. **UI 업데이트 (2단계 결과 표시)**
6. **성능 모니터링 시스템**
7. **학습 파이프라인 업데이트**

## 🎯 최종 목표

**"빠르고 정확한 LEGO 부품 누락 검출"**
- **속도**: 45+ FPS 실시간 처리
- **정확도**: 95%+ 누락 검출률
- **효율성**: 동적 메모리 관리
- **확장성**: BrickBox 스키마와 완벽 연동
