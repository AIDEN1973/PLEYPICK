# Semantic Vector 자동 생성 vs 수동 생성 비교 분석

## 현재 상태

### 신규 레고 등록 시
- ❌ **Semantic Vector 자동 생성 안 함**
- ✅ CLIP 임베딩만 자동 생성
- ✅ LLM 메타데이터 자동 생성

### metadata-management 페이지
- ✅ Semantic Vector 수동 생성 가능
- ✅ 일괄 생성 기능 제공

---

## 신규 레고 등록 시 Semantic Vector가 수동인 이유

### 1. 이미지 의존성 문제

**Semantic Vector 생성 요구사항**:
- 이미지 URL 필수 (FGC Encoder 사용)
- WebP 이미지 권장
- Supabase Storage 버킷 이미지 필요

**신규 등록 시 이미지 상태**:
```javascript
// useBackgroundLLMAnalysis.js:220-266
// 이미지 마이그레이션 완료 대기 (최대 5초, 10회 시도)
for (let attempt = 0; attempt < 10; attempt++) {
  const response = await fetch(storageUrl, { method: 'HEAD' })
  if (response.ok && isImage && hasContent) {
    imageUrl = storageUrl
    break
  }
  await new Promise(resolve => setTimeout(resolve, 500))
}

// 이미지가 없으면 건너뛰기
if (!imageUrl) {
  throw new Error('이미지 URL 없음')
}
```

**문제점**:
- 이미지 마이그레이션이 비동기로 진행 (최대 2분 소요)
- WebP 변환 시간 추가 소요
- 일부 부품은 이미지가 준비되지 않을 수 있음
- 실패 시 재시도 복잡도 증가

---

### 2. 리소스 소비

**FGC Encoder 요구사항**:
- GPU 권장 (CPU는 매우 느림)
- 별도 서비스 필요 (포트 3022)
- 이미지 처리 시간: ~1-3초/이미지
- 메모리: ~2-4GB (CLIP보다 큼)

**신규 등록 시 부하**:
```
세트당 평균 200개 부품 × 3초 = 600초 (10분)
큰 세트(500개 부품) = 25분
```

**CLIP 임베딩과 비교**:
```
CLIP 텍스트 임베딩: ~0.5초/부품
Semantic Vector: ~3초/부품 (6배 느림)
```

---

### 3. 실패 처리 복잡도

**이미지 URL 조회 실패 시나리오**:
1. part_images 테이블에 없음
2. image_metadata 테이블에 없음
3. 이미지 마이그레이션 미완료
4. Storage 버킷에 파일 없음

**자동 생성 시 처리**:
```javascript
// 각 부품마다 이미지 URL 조회 시도
// 실패 시 건너뛰기 또는 재시도
// 재시도 로직이 복잡해짐
```

**수동 생성 시 장점**:
- 사용자가 이미지 준비 상태 확인
- 실패한 부품만 선택적으로 재시도
- 진행 상황 실시간 확인 가능

---

### 4. 타이밍 이슈

**현재 플로우**:
```
1. 세트 저장
   ↓ (비동기)
2. 이미지 다운로드 및 WebP 변환 시작
   ↓ (최대 2분 대기)
3. 이미지 마이그레이션 완료 대기
   ↓
4. LLM 분석 시작 (이미지 필요)
   ↓
5. CLIP 임베딩 생성 (텍스트만 필요, 즉시 가능)
   ↓
6. ❌ Semantic Vector 생성 없음
```

**Semantic Vector 자동 생성 추가 시**:
```
... (위와 동일)
   ↓
5. CLIP 임베딩 생성
   ↓
6. Semantic Vector 생성 시작
   ├─ 이미지 URL 다시 조회
   ├─ FGC Encoder API 호출 (~3초/부품)
   ├─ 512D → 768D 확장
   └─ L2 정규화
```

**추가 소요 시간**: 부품당 평균 3초 + 네트워크 지연

---

## 자동 생성 vs 수동 생성 비교

### 자동 생성 (제안)

**장점**:
- ✅ 사용자 개입 불필요
- ✅ 신규 등록 즉시 완전한 데이터 준비
- ✅ 데이터 일관성 보장
- ✅ metadata-management와 동일한 데이터 생성

**단점**:
- ❌ 신규 등록 시간 2-3배 증가 (200개 부품 시 10-15분 추가)
- ❌ 이미지 미준비 시 대량 실패 가능
- ❌ GPU 리소스 지속적 사용
- ❌ 실패 처리 복잡도 증가
- ❌ 재시도 로직 필요 (이미지 대기 등)

**구현 복잡도**: 높음 (이미지 상태 체크, 재시도 로직, 에러 핸들링)

---

### 수동 생성 (현재)

**장점**:
- ✅ 사용자가 타이밍 제어 (이미지 준비 후 생성)
- ✅ 실패 감소 (이미지 준비 확인 후 진행)
- ✅ 리소스 관리 용이 (필요 시에만 생성)
- ✅ 진행 상황 실시간 모니터링
- ✅ 선택적 재시도 (실패한 부품만)

**단점**:
- ❌ 사용자 개입 필요
- ❌ 데이터 불일치 가능 (일부 부품만 생성)
- ❌ 신규 등록 후 추가 작업 필요

**구현 복잡도**: 낮음 (현재 구현 유지)

---

## 권장 방안

### Option 1: 하이브리드 방식 (권장)

**특징**:
- 신규 등록 시 자동 생성 시도
- 실패 시 큐에 추가하여 나중에 재시도
- 사용자는 metadata-management에서 실패한 항목만 재시도

**구현**:
```javascript
// worker.js에 Semantic Vector 큐 추가
async function processSemanticVectorQueue() {
  const queueItems = await supabase
    .from('parts_master_features')
    .select('part_id, color_id')
    .is('semantic_vector', null)
    .not('clip_text_emb', 'is', null)
    .limit(10)
  
  for (const item of queueItems) {
    try {
      // 이미지 URL 조회
      const imageUrl = await getImageUrl(item.part_id, item.color_id)
      
      if (!imageUrl) {
        // 이미지 없으면 건너뛰기 (나중에 재시도)
        continue
      }
      
      // Semantic Vector 생성
      const semanticVector = await generateSemanticVector(imageUrl)
      
      // 저장
      await supabase
        .from('parts_master_features')
        .update({ semantic_vector: semanticVector })
        .eq('part_id', item.part_id)
        .eq('color_id', item.color_id)
    } catch (error) {
      // 실패 시 로그만 기록 (재시도 가능하도록)
      console.error(`Semantic Vector 생성 실패: ${item.part_id}`, error)
    }
  }
}
```

**장점**:
- ✅ 자동 생성 시도
- ✅ 실패 시 자동 재시도 가능
- ✅ 사용자가 실패 항목만 수동 재시도 가능
- ✅ 리소스 효율적 (이미지 준비된 것만 처리)

---

### Option 2: 지연 자동 생성

**특징**:
- 신규 등록 완료 후 백그라운드에서 자동 생성 시작
- 이미지 마이그레이션 완료 후 시작
- 사용자에게는 비동기로 진행

**구현**:
```javascript
// useBackgroundLLMAnalysis.js에 추가
// executeLLMAnalysis 완료 후
if (migrationComplete) {
  // Semantic Vector 생성 큐에 추가
  await queueSemanticVectors(analysisResults)
}
```

**장점**:
- ✅ 사용자 개입 불필요
- ✅ 이미지 준비 확인 후 생성
- ✅ 백그라운드 처리로 UI 블로킹 없음

---

### Option 3: 현재 유지 + 개선

**현재 방식 유지하되 개선**:
- metadata-management에서 "신규 등록 부품 자동 감지" 기능 추가
- 신규 등록 완료 시 알림: "Semantic Vector 생성을 권장합니다"
- 일괄 생성 버튼에 "신규 등록 부품만" 필터 추가

**장점**:
- ✅ 구현 간단
- ✅ 사용자가 제어
- ✅ 실패 감소

---

## 성능 영향 분석

### 신규 등록 시 소요 시간 비교

| 항목 | 현재 (CLIP만) | 자동 생성 추가 (CLIP + Semantic) |
|------|--------------|--------------------------------|
| LLM 분석 | 2-5분 (100개 부품) | 2-5분 |
| 이미지 마이그레이션 | 1-2분 | 1-2분 |
| CLIP 임베딩 | 1-2분 (백그라운드) | 1-2분 (백그라운드) |
| **Semantic Vector** | **없음** | **5-10분 (백그라운드)** |
| **총 소요 시간** | **4-9분** | **9-19분** |

**대용량 세트 (500개 부품)**:
- 현재: 10-15분
- 자동 생성 추가: 25-45분

---

## 최종 권장사항

### 단기: Option 3 (현재 유지 + UX 개선)
1. metadata-management에 "신규 등록 부품 필터" 추가
2. 신규 등록 완료 시 Semantic Vector 생성 안내
3. 일괄 생성 UI 개선 (진행률, 실패 항목 표시)

**이유**:
- 구현 간단
- 사용자가 이미지 준비 확인 후 생성 가능
- 실패 감소

### 중기: Option 1 (하이브리드 방식)
1. worker.js에 Semantic Vector 큐 추가
2. 이미지 준비된 부품만 자동 생성
3. 실패 항목은 metadata-management에서 재시도

**이유**:
- 자동화 + 사용자 제어 균형
- 리소스 효율적
- 실패 처리 개선

---

## 결론

**현재 수동 방식이 유지되는 이유**:
1. 이미지 의존성 (준비 시점 불확실)
2. 리소스 소비 (GPU, 처리 시간)
3. 실패 처리 복잡도
4. 사용자 제어 필요성

**자동 생성 시 고려사항**:
- 신규 등록 시간 2-3배 증가
- GPU 리소스 지속 사용
- 이미지 준비 확인 로직 필요
- 실패 시 재시도 메커니즘 필요

**권장**: 하이브리드 방식으로 점진적 개선

