# [SEARCH] Synthetic Dataset 렌더링 중복 체크 로직 분석

## [INFO] 개요
`http://localhost:3000/synthetic-dataset`에서 렌더링 시 중복 파일/폴더 체크 로직을 분석한 결과입니다.

## [TARGET] 중복 체크 전략

### 1. 다층 중복 체크 시스템
```
1단계: 스토리지 폴더 기반 체크 (실시간)
2단계: 데이터베이스 기반 체크 (백업)
3단계: 세션 기반 체크 (메모리)
```

### 2. 키 생성 로직
```javascript
// Element ID 우선순위
elementId = element_id || (part_num + '-' + color_id) || part_num

// 최종 키 생성
elementKey = `${elementId}-${colorId || 'default'}`
```

## [FIX] 핵심 설정값

### 중복 체크 임계값
```javascript
const DUP_MIN_FILES = 150        // 폴더 내 최소 파일 수 (중복 판정 기준)
const STORAGE_BATCH_SIZE = 6     // 스토리지 폴더 검증 배치 크기
const POLL_INTERVAL_MS = 3000    // 진행 폴링 간격
const TIMEOUT_MAX_ATTEMPTS = 300 // 최대 시도 횟수 (15분)
```

## [START] 중복 체크 프로세스

### 1단계: 스토리지 기반 중복 체크
```javascript
const getRenderedKeysFromStorage = async (parts) => {
  // 1. 폴더 키 매핑 생성
  const folderKeyToElementKeys = new Map()
  for (const p of parts) {
    const partNum = p.part_num
    const colorId = p.color_id ?? null
    const elementId = p.element_id ?? null
    const folderKey = elementId || partNum
    const elementKey = `${elementId || partNum}-${colorId || 'default'}`
    
    // 폴더별로 elementKey 집합 구성
    folderKeyToElementKeys.set(folderKey, elementKey)
  }
  
  // 2. 배치 병렬 처리로 폴더 존재 확인
  const batchSize = STORAGE_BATCH_SIZE // 6개씩 처리
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchPromises = batchKeys.map(async (folderKey) => {
      const exists = await folderExists(`synthetic/${folderKey}/`)
      return { folderKey, exists }
    })
    
    const batchResults = await Promise.all(batchPromises)
    // 결과 처리...
  }
}
```

### 2단계: 폴더 존재 확인 로직
```javascript
const folderExists = async (folderPath) => {
  // 두 개 버킷 후보 확인
  const candidateBuckets = ['lego_synthetic', 'lego-synthetic']
  
  for (const bucket of candidateBuckets) {
    try {
      const { data: folderData, error } = await supabase.storage
        .from(bucket)
        .list(folderPath, { limit: DUP_MIN_FILES }) // 150개 파일 확인
      
      // 최소 파일 수 기준으로 존재 판정
      if (!error && Array.isArray(folderData) && folderData.length >= DUP_MIN_FILES) {
        return true
      }
    } catch (_) {
      // 다음 버킷 후보로 계속 시도
    }
  }
  return false
}
```

### 3단계: 데이터베이스 기반 중복 체크
```javascript
const getRenderedPartsFromDB = async () => {
  // synthetic_dataset 테이블에서 렌더링된 부품 조회
  const { data, error } = await supabase
    .from('synthetic_dataset')
    .select('part_id, metadata')
    .not('part_id', 'is', null)
  
  // 고유한 부품별로 그룹화
  const uniqueParts = new Map()
  for (const item of data) {
    const elementId = item.metadata?.element_id || null
    const colorId = item.metadata?.color_id || null
    const partId = item.part_id
    
    const productKey = elementId || partId
    const colorKey = colorId || 'default'
    const fullKey = `${productKey}-${colorKey}`
    
    uniqueParts.set(folderKey, {
      elementId, partId, colorId, fullKey, folderKey
    })
  }
  
  // 각 부품의 폴더 존재 여부 확인
  for (const [, partInfo] of uniqueParts) {
    const candidates = [partInfo.elementId, partInfo.partId].filter(Boolean)
    for (const candidate of candidates) {
      const folderPath = `synthetic/${candidate}/`
      const exists = await folderExists(folderPath)
      if (exists) {
        validKeys.add(`${candidate}-${partInfo.colorId || 'default'}`)
        break
      }
    }
  }
}
```

## [SEARCH] 중복 체크 세부 로직

### Element ID 우선순위
```javascript
// 1순위: element_id (LDraw Element ID)
// 2순위: part_num + '-' + color_id (조합 ID)
// 3순위: part_num (기본 Part Number)

const elementId = elementIdRaw || 
  (partNum && Number.isInteger(colorId) ? `${partNum}-${colorId}` : partNum)
```

### 키 생성 규칙
```javascript
// 최종 중복 체크 키
const elementKey = `${elementId || partNum}-${colorId || 'default'}`

// 예시:
// - element_id: "3001", color_id: 4 → "3001-4"
// - part_num: "3001", color_id: null → "3001-default"
// - element_id: null, part_num: "3001" → "3001-default"
```

### 폴더 구조 매핑
```
Supabase Storage:
lego-synthetic/synthetic/
├── 3001/                    # Part Number 기반
│   ├── 3001_000.png
│   └── 3001_001.png
├── 3001-4/                  # Part + Color 조합
│   ├── 3001-4_000.png
│   └── 3001-4_001.png
└── 3001-4-1/                # Element ID 기반
    ├── 3001-4-1_000.png
    └── 3001-4-1_001.png
```

## [FAST] 성능 최적화

### 배치 처리
```javascript
// 스토리지 폴더 검증을 6개씩 배치로 처리
const batchSize = STORAGE_BATCH_SIZE // 6
const totalBatches = Math.ceil(folderKeys.length / batchSize)

for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
  const batchKeys = folderKeys.slice(startIndex, endIndex)
  const batchPromises = batchKeys.map(async (folderKey) => {
    return await folderExists(`synthetic/${folderKey}/`)
  })
  
  const batchResults = await Promise.all(batchPromises)
  // 결과 처리...
}
```

### 최소 파일 수 기준
```javascript
// 폴더 내 최소 150개 파일이 있어야 "렌더링 완료"로 판정
const DUP_MIN_FILES = 150

if (folderData.length >= DUP_MIN_FILES) {
  return true // 렌더링 완료된 폴더
}
```

## 🚨 중복 체크 한계점

### 1. 파일 수 기준의 한계
- **문제**: 150개 미만의 파일이 있으면 "미완료"로 판정
- **해결**: 부분 렌더링 상태를 별도로 관리 필요

### 2. 버킷 이름 불일치
- **문제**: `lego_synthetic` vs `lego-synthetic` 버킷 이름 차이
- **해결**: 두 버킷 모두 확인하는 fallback 로직

### 3. 네트워크 지연
- **문제**: 스토리지 API 호출 지연으로 인한 성능 저하
- **해결**: 배치 처리와 캐싱으로 완화

## [STATS] 중복 체크 결과

### 로그 출력 예시
```
스토리지 기반 중복 키 계산 중...
이미 렌더링된 부품(스토리지): 45개
중복 부품 발견: 3001 (3001) - 키: 3001-default
부품 1/100: 3001 (3001) - 이미 렌더링됨, 건너뜀
새로운 부품 렌더링 시작: 3002 (3002) - 키: 3002-default
```

### 통계 정보
```javascript
console.log(`중복 체크 원본 레코드 수: ${data.length}`)
console.log(`폴더 후보 고유 키 수: ${uniqueParts.size}`)
console.log(`이미 렌더링된 부품(스토리지): ${renderedKeys.size}개`)
```

## [TARGET] 권장 개선사항

### 1. 중복 체크 정확도 향상
```javascript
// 파일 수 대신 파일명 패턴으로 완료 여부 판정
const isRenderingComplete = (files) => {
  const expectedPattern = /^\d+_\d{3}\.(png|jpg)$/
  return files.filter(f => expectedPattern.test(f.name)).length >= expectedCount
}
```

### 2. 캐싱 시스템 도입
```javascript
// 중복 체크 결과를 메모리에 캐싱
const duplicateCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5분
```

### 3. 진행률 표시 개선
```javascript
// 실시간 진행률 업데이트
const progress = Math.round(((batchIndex + 1) / totalBatches) * 100)
console.log(`폴더 검증 진행률: ${progress}%`)
```

## [SUCCESS] 결론

현재 시스템은 **3단계 중복 체크**로 매우 견고하게 설계되어 있습니다:

1. [OK] **스토리지 폴더 기반** - 실시간 중복 확인
2. [OK] **데이터베이스 기반** - 백업 중복 확인  
3. [OK] **세션 기반** - 메모리 중복 확인

**핵심 장점:**
- Element ID 우선순위로 정확한 중복 판정
- 배치 처리로 성능 최적화
- 다중 버킷 지원으로 안정성 확보
- 최소 파일 수 기준으로 완료 여부 판정

**개선 여지:**
- 부분 렌더링 상태 관리
- 캐싱 시스템 도입
- 진행률 표시 개선
