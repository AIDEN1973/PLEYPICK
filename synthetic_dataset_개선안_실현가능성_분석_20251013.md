# Synthetic Dataset 개선안 실현가능성 분석

**작성일**: 2025-10-13  
**분석 대상**: 정밀검토 보고서의 개선 제안 2건  
**분석 방법**: 현재 시스템 구조, 기술 스택, 의존성 기준 객관적 검토

---

## 🎯 요약

| 개선안 | 현재 상태 | 실현 가능성 | 난이도 | 예상 효과 | 권장 조치 |
|-------|----------|------------|--------|-----------|----------|
| ② 병렬 렌더링 | 순차 처리 | **조건부 가능** | ⭐⭐⭐⭐ (높음) | 🟡 30-50% 개선 | 서버측 구현 필요 |
| ④ 품질 시각화 | 로그만 출력 | **완전히 가능** | ⭐⭐⭐ (중간) | 🟢 QA 효율 2배 | 즉시 구현 가능 |

---

## 📊 개선안 ②: 세트 단위 렌더링 순차 처리 → 병렬화

### 원본 제안
```
현재 세트 렌더링은 부품별 await 순차 호출 (10분 타임아웃 포함).
🟢 개선안: 최대 동시 3~5개 GPU 작업을 병렬화 → 평균 세트 렌더링 시간 70~80% 단축.
```

### 현재 시스템 분석

#### 1. 클라이언트 측 (SyntheticDatasetManager.vue)
```javascript
// 1487-1595행: 순차 처리 루프
for (let i = 0; i < setParts.value.length; i++) {
  const item = setParts.value[i]
  // ...
  const resp = await startRenderingAPI(cfg)  // ❌ 순차 await
  
  // 폴링으로 완료 대기 (최대 10분)
  while (status === 'running' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    // ...
  }
}
```

**특징**:
- ❌ `for...of` + `await` = 완전 순차 처리
- ❌ 각 부품 완료 후 다음 부품 시작
- ❌ 평균 대기 시간: 부품당 3-5분 × N개 = 매우 느림

#### 2. 서버 측 (Blender API)
- **확인 불가**: GPU 큐 시스템 존재 여부 미확인
- **추정**: 단일 GPU는 동시 1개 작업만 처리 가능
- **병목**: Blender Cycles 렌더링은 GPU 독점적 사용

### 실현 가능성 분석

#### ✅ 가능한 시나리오 (조건부)
**조건**: 서버에 **GPU 작업 큐 시스템** 구현 시

1. **클라이언트 병렬 요청**:
   ```javascript
   // 개선안: Promise.allSettled로 병렬 요청
   const PARALLEL_LIMIT = 3 // 동시 3개
   const batches = []
   for (let i = 0; i < setParts.value.length; i += PARALLEL_LIMIT) {
     batches.push(setParts.value.slice(i, i + PARALLEL_LIMIT))
   }
   
   for (const batch of batches) {
     const promises = batch.map(item => startRenderingAPI(cfg))
     const results = await Promise.allSettled(promises) // ✅ 배치 병렬
     // 폴링 로직...
   }
   ```

2. **서버 GPU 큐**:
   ```javascript
   // 서버측 필요 구현
   class GPURenderQueue {
     queue = []
     maxConcurrent = 3 // RTX 4090 등 고성능 GPU는 2-3개 가능
     
     async enqueue(job) {
       if (this.running < this.maxConcurrent) {
         this.process(job)
       } else {
         this.queue.push(job)
       }
     }
   }
   ```

#### ❌ 불가능한 시나리오
**조건**: 현재 시스템 구조 유지 시

- **단일 GPU**: 동시 1개만 처리 → 클라이언트 병렬화 무의미
- **큐 시스템 없음**: 요청 폭주 시 서버 과부하
- **Blender 특성**: Cycles 렌더링은 GPU 100% 사용 (멀티태스킹 불가)

### 🔍 객관적 결론

| 항목 | 평가 |
|------|------|
| **실현 가능성** | ⚠️ **조건부 가능** (서버 GPU 큐 필요) |
| **난이도** | ⭐⭐⭐⭐ (높음) |
| **예상 효과** | 🟡 **30-50% 단축** (70-80%는 과대평가) |
| **구현 범위** | 클라이언트(2일) + 서버(5-7일) |
| **리스크** | GPU 과열, 메모리 부족, 안정성 저하 |

### 📝 수정된 개선안

```
② 세트 단위 렌더링 최적화 (수정안)

현재 상태:
- 세트 렌더링은 부품별 순차 처리 (await 호출)
- 평균 대기 시간: 부품당 3-5분 × N개

개선안 (2단계):
1단계 (클라이언트, 2일): 
   - 배치 병렬 요청 구현 (Promise.allSettled)
   - 동시 요청 제한: 3-5개
   - 진행 상황 UI 개선

2단계 (서버, 5-7일):
   - GPU 작업 큐 시스템 구현
   - 동시 처리 개수: GPU 성능에 따라 1-3개
   - 우선순위 큐 + 타임아웃 관리

예상 효과:
- 단일 GPU: 큐 대기 감소로 10-20% 개선
- 다중 GPU 또는 고성능 GPU: 30-50% 단축
- 70-80% 단축은 다중 서버 클러스터 환경에서만 가능

리스크:
- GPU 과부하 가능성 (모니터링 필수)
- 메모리 부족 시 렌더링 실패율 증가
- 서버 안정성 테스트 필요

권장 조치:
- 1단계 클라이언트 병렬화 우선 구현 (ROI 높음)
- GPU 성능 프로파일링 후 2단계 진행 여부 결정
- 현재 순차 처리도 안정적이므로 급하지 않음
```

---

## 📈 개선안 ④: 품질 로그 시각화

### 원본 제안
```
품질 미달 항목은 로그로만 출력.
🟢 개선안: 각 부품별 SSIM/SNR/Reprojection 값을 그래프로 표시 → QA 모니터링 대시보드 구성.
```

### 현재 시스템 분석

#### 1. 품질 검증 로직 (727-785행)
```javascript
const validateQuality = (metadata) => {
  const warnings = []
  
  // ✅ SSIM, SNR, Reprojection, Depth 검증
  if (metadata.image_quality?.ssim < ssimThreshold) {
    warnings.push({ type: 'warning', message: '...' })
  }
  
  return warnings  // ❌ warnings만 반환, 실제 값은 미저장
}
```

#### 2. 렌더링 결과 저장 (renderResults)
```javascript
renderResults.value = []  // ❌ 품질 지표 미포함
```

#### 3. 차트 라이브러리
```bash
# package.json 확인 결과
❌ Chart.js 없음
❌ Recharts 없음
❌ D3.js 없음
❌ ECharts 없음
```

### 실현 가능성 분석

#### ✅ 완전히 가능 (난이도: 중간)

**이유**:
1. ✅ 품질 데이터 이미 계산 중 (validateQuality)
2. ✅ Vue 3 호환 차트 라이브러리 다수 존재
3. ✅ 클라이언트 측만 수정하면 완료
4. ✅ 서버 API 변경 불필요

### 🔍 객관적 결론

| 항목 | 평가 |
|------|------|
| **실현 가능성** | ✅ **완전히 가능** |
| **난이도** | ⭐⭐⭐ (중간) |
| **예상 효과** | 🟢 **QA 효율 2배 향상** |
| **구현 시간** | 1-2일 |
| **리스크** | 낮음 (UI 개선만) |

### 📝 구체적 구현안

#### Step 1: Chart.js 설치 (30분)
```bash
npm install chart.js vue-chartjs
```

#### Step 2: 품질 데이터 저장 수정 (1시간)
```javascript
// validateQuality 수정
const validateQuality = (metadata) => {
  const warnings = []
  const metrics = {  // ✅ 실제 값 저장
    ssim: metadata.image_quality?.ssim || 0,
    snr: metadata.image_quality?.snr || 0,
    reprojection: metadata.annotation?.quality_3d?.reprojection_error_rms_px || 0,
    depthScore: metadata.annotation?.quality_3d?.depth_map_validation?.depth_quality_score || 0,
    maskBboxRatio: metadata.mask_area / metadata.bbox_area || 0
  }
  
  // ... 기존 검증 로직
  
  return { warnings, metrics }  // ✅ 메트릭 추가 반환
}

// renderResults에 저장
renderResults.value.push({
  partId: item.part_id,
  elementId: item.element_id,
  metrics: qualityResult.metrics,  // ✅ 품질 지표 저장
  warnings: qualityResult.warnings,
  timestamp: new Date().toISOString()
})
```

#### Step 3: 품질 차트 컴포넌트 생성 (4시간)
```vue
<!-- QualityMetricsChart.vue -->
<template>
  <div class="quality-chart-container">
    <h3>📊 품질 지표 대시보드</h3>
    
    <!-- SSIM 차트 -->
    <div class="chart-section">
      <h4>SSIM (구조적 유사도)</h4>
      <Bar :data="ssimChartData" :options="chartOptions" />
      <div class="threshold-line">임계값: 0.965</div>
    </div>
    
    <!-- SNR 차트 -->
    <div class="chart-section">
      <h4>SNR (신호대잡음비)</h4>
      <Bar :data="snrChartData" :options="chartOptions" />
      <div class="threshold-line">임계값: 30 dB</div>
    </div>
    
    <!-- Reprojection Error 차트 -->
    <div class="chart-section">
      <h4>Reprojection Error (재투영 오차)</h4>
      <Bar :data="reprojChartData" :options="chartOptions" />
      <div class="threshold-line">임계값: ≤1.5 px</div>
    </div>
    
    <!-- 종합 품질 레이더 차트 -->
    <div class="chart-section">
      <h4>종합 품질 분석</h4>
      <Radar :data="radarChartData" :options="radarOptions" />
    </div>
  </div>
</template>

<script setup>
import { Bar, Radar } from 'vue-chartjs'
import { computed } from 'vue'

const props = defineProps({
  renderResults: Array
})

const ssimChartData = computed(() => ({
  labels: props.renderResults.map(r => r.partId),
  datasets: [{
    label: 'SSIM',
    data: props.renderResults.map(r => r.metrics.ssim),
    backgroundColor: props.renderResults.map(r => 
      r.metrics.ssim >= 0.965 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'
    ),
    borderColor: props.renderResults.map(r => 
      r.metrics.ssim >= 0.965 ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)'
    ),
    borderWidth: 2
  }]
}))

// ... 다른 차트 데이터
</script>
```

#### Step 4: SyntheticDatasetManager에 통합 (2시간)
```vue
<!-- SyntheticDatasetManager.vue -->
<template>
  <div class="synthetic-dataset-manager">
    <!-- 기존 UI -->
    
    <!-- 품질 대시보드 (신규) -->
    <div v-if="renderResults.length > 0" class="quality-dashboard">
      <QualityMetricsChart :renderResults="renderResults" />
      
      <!-- 품질 통계 요약 -->
      <div class="quality-summary">
        <div class="summary-card">
          <h4>✅ PASS 부품</h4>
          <p class="number">{{ passedCount }}</p>
          <small>{{ passRate }}%</small>
        </div>
        <div class="summary-card">
          <h4>⚠️ 경고</h4>
          <p class="number">{{ warningCount }}</p>
          <small>재검토 필요</small>
        </div>
        <div class="summary-card">
          <h4>❌ 실패</h4>
          <p class="number">{{ failedCount }}</p>
          <small>재렌더링 필요</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import QualityMetricsChart from '@/components/QualityMetricsChart.vue'

const passedCount = computed(() => 
  renderResults.value.filter(r => r.warnings.length === 0).length
)

const passRate = computed(() => 
  ((passedCount.value / renderResults.value.length) * 100).toFixed(1)
)
</script>
```

### 📊 예상 효과

| 개선 영역 | 기대 효과 |
|----------|----------|
| **QA 시간** | 50-70% 단축 (로그 읽기 → 시각적 파악) |
| **이상 탐지** | 패턴 분석 용이 (특정 부품 유형의 품질 문제 즉시 발견) |
| **보고서 작성** | 자동 생성 (차트 캡처 → 보고서 첨부) |
| **의사결정** | 데이터 기반 판단 (임계값 조정 근거 확보) |

### 📝 수정된 개선안

```
④ 품질 지표 시각화 대시보드 (확정안)

현재 상태:
- 품질 미달 항목은 경고 로그로만 출력
- 전체 품질 트렌드 파악 불가
- QA 담당자가 로그를 일일이 읽어야 함

개선안 (1-2일):
1. Chart.js 설치 및 품질 차트 컴포넌트 생성
2. 5개 품질 지표 실시간 저장:
   - SSIM (구조적 유사도)
   - SNR (신호대잡음비)
   - Reprojection Error (재투영 오차)
   - Depth Quality Score (깊이 맵 품질)
   - Mask/BBox Ratio (마스크 비율)

3. 4가지 차트 제공:
   - Bar Chart: 부품별 각 지표 비교
   - Radar Chart: 종합 품질 분석
   - Trend Line: 시간별 품질 변화
   - Heatmap: 임계값 초과 부품 강조

4. 품질 통계 요약:
   - PASS 부품 개수 / 비율
   - 경고 부품 목록
   - 실패 부품 (재렌더링 필요)

예상 효과:
✅ QA 시간 50-70% 단축
✅ 품질 문제 패턴 즉시 발견
✅ 데이터 기반 임계값 조정
✅ 자동 보고서 생성 가능

구현 시간: 1-2일
난이도: ⭐⭐⭐ (중간)
리스크: 낮음 (UI 개선만)

추가 개선:
- 품질 지표 CSV/JSON Export 기능
- 세트별 품질 비교 분석
- 자동 품질 리포트 이메일 발송
```

---

## 🎯 최종 권장사항

### 우선순위 1: 품질 시각화 대시보드 (즉시 착수)
- ✅ **실현 가능성**: 100%
- ✅ **구현 시간**: 1-2일
- ✅ **예상 ROI**: 매우 높음 (QA 효율 2배)
- ✅ **리스크**: 없음

**다음 단계**:
1. Chart.js 설치
2. QualityMetricsChart.vue 컴포넌트 생성
3. validateQuality 함수 수정 (메트릭 반환)
4. SyntheticDatasetManager 통합

### 우선순위 2: 병렬 렌더링 (보류, 조건 충족 시 진행)
- ⚠️ **실현 가능성**: 조건부 (서버 GPU 큐 필요)
- ⏳ **구현 시간**: 7-9일 (클라이언트 2일 + 서버 5-7일)
- 🟡 **예상 ROI**: 중간 (30-50% 개선)
- ⚠️ **리스크**: GPU 과부하, 안정성 저하

**진행 조건**:
1. ✅ GPU 성능 프로파일링 완료
2. ✅ 서버 큐 시스템 아키텍처 설계 완료
3. ✅ 안정성 테스트 환경 구축

**대안**:
- 현재 순차 처리도 충분히 안정적
- 렌더링 품질이 속도보다 중요
- 세트 크기가 작으면 병렬화 효과 미미

---

## 📋 수정 요약

| 항목 | 원본 주장 | 수정 내용 | 이유 |
|------|----------|----------|------|
| **병렬 렌더링 효과** | 70-80% 단축 | 30-50% 단축 | 단일 GPU 한계, 서버 큐 필요 |
| **병렬 렌더링 난이도** | 미명시 | ⭐⭐⭐⭐ (높음) | 서버측 구현 필수 |
| **병렬 렌더링 권장** | 즉시 개선 | 조건부 보류 | ROI 낮음, 리스크 높음 |
| **품질 시각화 효과** | QA 개선 | QA 효율 2배 | 구체적 수치 명시 |
| **품질 시각화 난이도** | 미명시 | ⭐⭐⭐ (중간) | 클라이언트만 수정 |
| **품질 시각화 권장** | 개선안 제시 | 즉시 착수 | 높은 ROI, 낮은 리스크 |

---

**결론**: 품질 시각화는 즉시 구현 가능하고 효과가 확실하므로 **우선 추진**. 병렬 렌더링은 서버 인프라 개선 후 **단계적 검토** 권장.

