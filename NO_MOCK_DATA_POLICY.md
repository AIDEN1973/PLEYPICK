# 🚫 목업/더미 데이터 사용 금지 규정

## 📋 정책 개요

**BrickBox 시스템에서는 모든 목업, 더미, 테스트 데이터 사용을 엄격히 금지합니다.**

## ❌ 금지된 데이터 유형

### 1. **목업 데이터 (Mock Data)**
```javascript
// ❌ 금지
const mockData = [
  { id: 1, name: 'test', value: 'dummy' },
  { id: 2, name: 'sample', value: 'fake' }
]

// ✅ 허용
const realData = await loadFromDatabase()
```

### 2. **더미 데이터 (Dummy Data)**
```javascript
// ❌ 금지
const dummyUsers = [
  { id: 'user1', name: 'John Doe' },
  { id: 'user2', name: 'Jane Smith' }
]

// ✅ 허용
const users = await supabase.from('users').select('*')
```

### 3. **테스트 데이터 (Test Data)**
```javascript
// ❌ 금지
const testImages = ['test1.jpg', 'test2.jpg']
const testResults = { accuracy: 0.95, latency: 100 }

// ✅ 허용
const images = await loadRealImages()
const results = await measureRealPerformance()
```

### 4. **하드코딩된 데이터 (Hardcoded Data)**
```javascript
// ❌ 금지
const staticConfig = {
  modelPath: '/static/models/fake_model.onnx',
  sampleData: { part1: 'brick', part2: 'plate' }
}

// ✅ 허용
const config = await loadConfigFromDB()
const data = await loadRealDataFromAPI()
```

### 5. **랜덤 생성 데이터 (Random Generated Data)**
```javascript
// ❌ 금지
const randomData = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  value: Math.random() * 100,
  name: `item_${i}`
}))

// ✅ 허용
const realData = await fetchRealDataFromDatabase()
```

## ✅ 허용된 데이터 소스

### 1. **데이터베이스 연결**
```javascript
// Supabase 연결
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('condition', value)
```

### 2. **API 엔드포인트**
```javascript
// 실제 API 호출
const response = await fetch('/api/real-endpoint')
const data = await response.json()
```

### 3. **파일 시스템**
```javascript
// 실제 파일 로드
const fileData = await fetch('/real-file.json')
const content = await fileData.json()
```

### 4. **환경 변수**
```javascript
// 환경 설정
const apiUrl = process.env.VITE_API_URL
const dbConfig = process.env.VITE_DB_CONFIG
```

## 🔍 검증 방법

### 1. **코드 리뷰 체크리스트**
- [ ] `Math.random()` 사용 여부
- [ ] 하드코딩된 배열/객체 존재 여부
- [ ] `mock`, `dummy`, `fake`, `test` 키워드 사용 여부
- [ ] 실제 데이터베이스 연결 확인
- [ ] API 엔드포인트 실제 존재 확인

### 2. **자동 검증 스크립트**
```bash
# 목업 데이터 검색
grep -r "Math\.random\|dummy\|fake\|mock\|test.*data" src/
grep -r "const.*=.*\[.*\]" src/composables/
grep -r "hardcoded\|static.*data" src/
```

### 3. **런타임 검증**
```javascript
// 데이터 소스 검증
const validateDataSource = (data) => {
  if (data.some(item => item.id.includes('mock'))) {
    throw new Error('목업 데이터 감지됨')
  }
  if (data.some(item => item.value === Math.random())) {
    throw new Error('랜덤 데이터 감지됨')
  }
  return true
}
```

## 🚨 위반 시 조치

### 1. **코드 리뷰 단계**
- 목업 데이터 발견 시 즉시 수정 요청
- 실제 데이터 연결 방법 제시
- 재검토 필수

### 2. **배포 전 검증**
- 자동 검증 스크립트 실행
- 목업 데이터 발견 시 배포 중단
- 수정 후 재검증 필수

### 3. **운영 중 모니터링**
- 실시간 데이터 품질 모니터링
- 목업 데이터 사용 시 알림
- 즉시 수정 조치

## 📊 실제 데이터 연결 가이드

### 1. **데이터베이스 테이블 생성**
```sql
-- 검증 샘플 테이블
CREATE TABLE validation_samples (
    id SERIAL PRIMARY KEY,
    image_path VARCHAR(500) NOT NULL,
    ground_truth VARCHAR(100) NOT NULL,
    part_id VARCHAR(50),
    set_id VARCHAR(50),
    element_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 테스트 이미지 테이블
CREATE TABLE test_images (
    id SERIAL PRIMARY KEY,
    image_path VARCHAR(500) NOT NULL,
    part_id VARCHAR(50),
    set_id VARCHAR(50),
    element_id VARCHAR(50),
    image_data BYTEA,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. **실제 데이터 로드 함수**
```javascript
// 실제 데이터 로드
const loadRealData = async () => {
  try {
    const { data, error } = await supabase
      .from('real_table')
      .select('*')
      .eq('is_active', true)
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('실제 데이터 로드 실패:', error)
    throw error
  }
}
```

### 3. **성능 측정 함수**
```javascript
// 실제 성능 측정
const measureRealPerformance = async (model, data) => {
  const startTime = performance.now()
  const results = await model.process(data)
  const endTime = performance.now()
  
  return {
    latency: endTime - startTime,
    accuracy: calculateRealAccuracy(results),
    results: results
  }
}
```

## 🎯 구현 체크리스트

### 1. **기존 목업 데이터 제거**
- [ ] `Math.random()` 사용 제거
- [ ] 하드코딩된 배열/객체 제거
- [ ] 더미 함수 제거
- [ ] 테스트 데이터 제거

### 2. **실제 데이터 연결**
- [ ] 데이터베이스 테이블 생성
- [ ] API 엔드포인트 구현
- [ ] 실제 데이터 로드 함수 구현
- [ ] 성능 측정 함수 구현

### 3. **검증 시스템 구축**
- [ ] 자동 검증 스크립트 구현
- [ ] 런타임 검증 함수 구현
- [ ] 모니터링 시스템 구축
- [ ] 알림 시스템 구축

## 📈 품질 보장

### 1. **데이터 품질**
- 실제 데이터베이스 연결 확인
- 데이터 무결성 검증
- 성능 지표 실시간 측정
- 오류 처리 및 로깅

### 2. **시스템 안정성**
- 목업 데이터 의존성 제거
- 실제 환경 테스트
- 성능 벤치마크 측정
- 사용자 경험 개선

## 🚀 다음 단계

1. **기존 목업 데이터 완전 제거**
2. **실제 데이터베이스 스키마 구축**
3. **API 엔드포인트 구현**
4. **검증 시스템 구축**
5. **모니터링 시스템 구축**

---

**⚠️ 중요: 이 정책은 BrickBox 시스템의 데이터 품질과 신뢰성을 보장하기 위한 필수 규정입니다. 모든 개발자는 이 정책을 준수해야 합니다.**
