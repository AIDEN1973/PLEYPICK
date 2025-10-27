# 🤖 백그라운드 LLM 분석 자동화 시스템

## 📋 개요

BrickBox 시스템을 **백그라운드 LLM 분석 방식**으로 완전 자동화했습니다.

### 🎯 핵심 특징

- ✅ **완전 자동화**: LLM 메타데이터 + CLIP 임베딩 한 번에 처리
- ✅ **백그라운드 처리**: 사용자 개입 없이 자동 실행
- ✅ **API 리밋 준수**: 자동 재시도 및 대기
- ✅ **실시간 모니터링**: 진행률 추적
- ✅ **큐 관리**: 여러 작업 동시 처리

---

## 🚀 사용법

### **방법 1: 메타데이터 관리 UI** (권장)

```
1. http://localhost:3000/metadata-management 접속
2. "AI 메타데이터" 탭 선택
3. "생성" 버튼 클릭
4. 백그라운드에서 자동 처리 완료 대기
```

**자동 처리 내용:**
- 🤖 LLM 메타데이터 생성 (feature_text, function, connection)
- 🧠 CLIP 임베딩 생성 (768차원)
- 💾 데이터베이스 저장
- 🔄 상태 업데이트

### **방법 2: 개별 부품 처리**

```
1. http://localhost:3000/new-lego 접속
2. 부품 등록 후 "메타데이터 생성" 버튼 클릭
3. 백그라운드에서 자동 처리
```

---

## 🔧 설정 및 설치

### **1단계: 데이터베이스 설정**

```sql
-- Supabase SQL Editor에서 실행
-- database/setup_background_llm_automation.sql
```

**생성되는 객체:**
- ✅ `embedding_status` 컬럼
- ✅ `trg_background_llm_analysis` 트리거
- ✅ `v_background_llm_queue` 뷰
- ✅ `v_background_llm_stats` 뷰
- ✅ 성능 최적화 인덱스

### **2단계: 워커 실행**

```bash
# CLIP 임베딩 워커 실행
node server/worker.js

# 또는 후처리 워커 실행
node scripts/postprocess_worker.js
```

### **3단계: CLIP 서비스 실행** (선택사항)

```bash
# CLIP 서비스 시작
python server/clip-embedding-service.py

# 또는 배치 파일 사용
start-clip-service.bat
```

---

## 📊 모니터링

### **상태 확인**

```sql
-- 전체 통계
SELECT * FROM v_background_llm_stats;

-- 처리 대기 중인 항목
SELECT * FROM v_background_llm_queue LIMIT 10;

-- 최근 처리된 항목
SELECT 
    part_id,
    feature_text,
    embedding_status,
    updated_at
FROM parts_master_features
WHERE embedding_status = 'completed'
ORDER BY updated_at DESC
LIMIT 10;
```

### **진행률 확인**

```sql
-- 완료율 계산
SELECT 
    ROUND(
        COUNT(*) FILTER (WHERE embedding_status = 'completed')::NUMERIC / 
        COUNT(*)::NUMERIC * 100, 2
    ) AS completion_rate
FROM parts_master_features;
```

---

## 🔄 자동화 플로우

```
1. 사용자가 "생성" 버튼 클릭
   ↓
2. 백그라운드 LLM 분석 시작
   ├─ LLM이 feature_text 생성
   ├─ function, connection 추론
   └─ parts_master_features에 저장
   ↓
3. 자동으로 embedding_status = 'pending' 설정
   ↓
4. 워커가 CLIP 임베딩 생성
   ├─ CLIP ViT-L/14 모델 사용
   ├─ 768차원 벡터 생성
   └─ clip_text_emb에 저장
   ↓
5. embedding_status = 'completed' 업데이트
```

---

## ⚙️ 설정 옵션

### **API 리밋 설정**

```javascript
// src/composables/useBackgroundLLMAnalysis.js
const API_LIMITS = {
  requestsPerMinute: 100,    // RPM 제한
  tokensPerMinute: 50000,    // TPM 제한
  maxConcurrent: 1,          // 동시 요청 수
  requestDelay: 2000,        // 요청 간 대기 (ms)
  retryDelay: 5000,          // 재시도 대기 (ms)
  maxRetries: 2              // 최대 재시도 횟수
}
```

### **워커 설정**

```javascript
// server/worker.js
const BATCH_SIZE = 10        // 배치 크기
const POLL_INTERVAL = 10000  // 폴링 주기 (ms)
const EMBEDDING_PROVIDER = 'clip'  // 임베딩 제공자
```

---

## 🔧 트러블슈팅

### **문제 1: 워커가 처리하지 않음**

```sql
-- 큐 확인
SELECT * FROM v_background_llm_queue LIMIT 10;

-- 수동으로 pending 설정
UPDATE parts_master_features
SET embedding_status = 'pending'
WHERE feature_text IS NOT NULL 
  AND (clip_text_emb IS NULL OR clip_text_emb::TEXT LIKE '[0,0,0,0%');
```

### **문제 2: API 리밋 초과**

```javascript
// API_LIMITS 설정 조정
requestsPerMinute: 50,  // 100 → 50으로 감소
requestDelay: 3000,     // 2000 → 3000으로 증가
```

### **문제 3: CLIP 서비스 연결 실패**

```bash
# CLIP 서비스 상태 확인
curl http://localhost:3021/health

# 서비스 재시작
python server/clip-embedding-service.py
```

---

## 📈 성능 최적화

### **처리 속도**

| 항목 수 | 예상 소요 시간 | 메모리 사용량 |
|---------|---------------|---------------|
| 10개    | ~20초         | ~100MB        |
| 50개    | ~2분          | ~200MB        |
| 100개   | ~4분          | ~300MB        |

### **확장 방법**

```bash
# 여러 워커 실행 (처리량 증가)
node server/worker.js &
node server/worker.js &
node server/worker.js &
```

---

## 🎯 체크리스트

- [ ] 데이터베이스 설정 완료
- [ ] 워커 실행 중
- [ ] CLIP 서비스 실행 중 (선택사항)
- [ ] 메타데이터 관리 UI 접근 가능
- [ ] 상태 모니터링 쿼리 확인
- [ ] API 리밋 설정 검토

---

**작성일**: 2025-10-25  
**버전**: 2.0  
**상태**: 프로덕션 준비 완료

---

## 🎉 완료!

이제 **백그라운드 LLM 분석 방식**으로 완전 자동화되었습니다!

- 🤖 **자동 메타데이터 생성**
- 🧠 **자동 CLIP 임베딩 생성**  
- 💾 **자동 데이터베이스 저장**
- 🔄 **자동 상태 관리**

사용자는 단순히 "생성" 버튼만 클릭하면 모든 처리가 백그라운드에서 자동으로 완료됩니다!
