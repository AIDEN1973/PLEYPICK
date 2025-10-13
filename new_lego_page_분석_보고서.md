# New Lego 페이지 전체 로직 분석 보고서

## 📋 개요
`http://localhost:3000/new-lego` 페이지의 전체 프로세스를 정밀 분석한 결과입니다.

---

## 🔄 전체 프로세스 흐름

### 1단계: 레고 세트 검색 (Search)
**파일**: `src/views/NewLegoRegistration.vue` - `searchSets()` 함수

#### 동작:
1. **검색 쿼리 유형 판단**
   - 단일 세트 번호 (`isSingleSetNumber()`)
     - 패턴: 3-6자리 숫자 (`/^\d{3,6}$/`)
     - 예: "60315" → "60315-1" 형식으로 변환 (`formatSetNumber()`)
   - 일반 검색 (이름/번호 혼합)

2. **API 호출**
   - **단일 세트**: `getSet(formattedSetNum)` 직접 호출
   - **일반 검색**: `searchSetsAPI(query)` → 최대 100개 결과
   
3. **중복 확인**
   - `checkSetExists()` / `checkMultipleSetsExist()`
   - DB에 이미 등록된 세트는 노란색 배지 표시

4. **자동 부품 로드**
   - 단일 세트인 경우 `loadSetParts()` 자동 실행

**문제점**:
- 단일 세트 번호 인식 로직이 정확하지 않을 수 있음 (하이픈 포함 번호 처리)
- API 오류 처리가 일관적이지 않음

---

### 2단계: 세트 정보 로드 (Load Set Details)
**파일**: `src/views/NewLegoRegistration.vue` - `loadSetParts()` 함수

#### 동작:
1. **부품 정보 조회**
   - `getSetPartsAPI(setNum)` → Rebrickable API 호출
   - 페이징 처리: 1000개씩, `inc_part_details=1`, `inc_color_details=1`
   - 모든 페이지를 순회하여 전체 부품 로드

2. **미니피규어 정보 조회**
   - `getSetMinifigs(setNum)` → 별도 API 호출
   - 실패 시 빈 배열로 처리

3. **부품 통계 계산**
   - `validatePartsCount()`: 부품 수량 검증 (스페어 부품 제외)
   - `calculatePartsStats()`: 총 종류, 수량, 스페어 개수
   - `categorizeParts()`: 일반/스페어/미니피규어 분류

**문제점**:
- 미니피규어 오류 처리가 조용히 실패 (사용자에게 알림 없음)
- API 호출이 순차적으로 진행되어 느림

---

### 3단계: 세트 정보 저장 (Save Set)
**파일**: `src/composables/useBatchProcessing.js` - `batchProcessSet()` 함수

#### 동작:
1. **세트 정보 저장**
   ```javascript
   supabase.from('lego_sets').upsert({
     set_num, name, year, theme_id, num_parts, 
     set_img_url, set_url
   }, { onConflict: 'set_num' })
   ```
   - `upsert` 사용으로 중복 자동 처리
   - 진행률: 10%

2. **부품 정보 배치 저장**
   - **중복 제거**: `Map`으로 고유한 부품만 추출
   - **배치 Upsert**: 모든 부품을 한 번에 저장
   ```javascript
   supabase.from('lego_parts').upsert(partsToUpsert, 
     { onConflict: 'part_num' })
   ```
   - 진행률: 30%

3. **색상 정보 배치 저장**
   - **중복 제거**: `Map`으로 고유한 색상만 추출
   - **배치 Upsert**: 모든 색상을 한 번에 저장
   ```javascript
   supabase.from('lego_colors').upsert(colorsToUpsert, 
     { onConflict: 'color_id' })
   ```
   - 진행률: 50%

4. **부품-세트 관계 저장**
   - **기존 관계 확인**: `set_parts` 테이블에서 중복 체크
   - **새 관계만 삽입**: `INSERT`로 신규 관계만 추가
   - 진행률: 100%

**문제점**:
- 이미지 업로드가 배치 처리에 포함되지 않음
- 중복 체크 로직이 복잡하고 비효율적 (부품-색상 조합마다 확인)
- 트랜잭션 처리 없음 (실패 시 일부만 저장될 수 있음)

---

### 4단계: 부품 이미지 WebP 변환 및 저장
**파일**: `src/composables/useImageManager.js` - `processRebrickableImage()` 함수

#### 동작:
1. **중복 확인**
   - `checkPartImageDuplicate(partNum, colorId)`
   - DB와 Storage에서 이미지 존재 여부 확인
   - 중복이면 업로드 스킵

2. **이미지 다운로드**
   - **1차 시도**: 프록시를 통한 다운로드 (`/api/upload/proxy-image`)
   - **2차 시도**: 직접 다운로드 (`fetch(imageUrl)`)
   
3. **WebP 변환**
   ```javascript
   // Canvas로 이미지 로드
   const img = new Image()
   img.src = URL.createObjectURL(blob)
   
   // 크기 조정 (최대 800px)
   const maxSize = 800
   
   // WebP 변환 (품질 90%)
   canvas.toBlob(resolve, 'image/webp', 0.90)
   ```

4. **Supabase Storage 업로드**
   - 파일명: `{partNum}_{colorId}.webp`
   - 경로: `lego_parts_images/images/`
   - `upsert: true` (덮어쓰기 허용)

5. **메타데이터 저장**
   - `part_images` 테이블 업데이트
   - `image_metadata` 테이블 삽입 (선택적)

**문제점**:
- 프록시 오류 처리가 복잡하고 불안정
- 이미지 다운로드 실패 시 원본 URL 사용 (일관성 없음)
- 순차 처리로 속도가 매우 느림 (100개 부품 = 100번 순차 업로드)
- WebP 품질 설정이 중복 (0.90 vs 0.6)

---

### 5단계: 이미지 마이그레이션 (Migration)
**파일**: `src/composables/useAutoImageMigration.js` - `triggerFullMigration()` 함수

#### 동작:
1. **마이그레이션 대상 조회**
   ```javascript
   // 모든 부품 조회 (외래 키 제약 조건 문제로 단계별 조회)
   const setParts = await supabase.from('set_parts')
     .select('part_id, color_id').limit(100)
   
   const legoParts = await supabase.from('lego_parts')
     .select('part_num, part_img_url')
     .in('part_num', partIds)
   ```

2. **배치 마이그레이션**
   - 동시 실행 수: 4개 (기본값)
   - 워커 패턴으로 병렬 처리
   
3. **개별 마이그레이션 프로세스**
   - **캐시 확인**: `migrationCache.has(cacheKey)`
   - **Storage 확인**: `checkExistingSupabaseImage()`
   - **이미지 다운로드**: 여러 방법 시도
     1. Vite 프록시 (`/api/proxy`)
     2. API 프록시 (`/api/upload/proxy-image`)
     3. 직접 다운로드
   - **WebP 변환**: 품질 90%, 최대 800px
   - **Storage 업로드**: `upsert: true`
   - **DB 등록**: `part_images`, `image_metadata`

4. **마이그레이션 완료 대기**
   - `waitForMigrationComplete()`: 폴링 방식
   - 최대 2분 (120초), 2초마다 확인
   - 타임아웃 시 원본 이미지로 진행

**문제점**:
- 외래 키 제약 조건 문제로 조회 로직이 비효율적
- 100개 제한으로 전체 마이그레이션 불가능
- 폴링 방식이 비효율적 (웹소켓/이벤트 방식 필요)
- 마이그레이션 실패 시 원본 URL로 fallback (혼재 가능)

---

### 6단계: LLM 분석 (Background Analysis)
**파일**: `src/composables/useBackgroundLLMAnalysis.js` - `startBackgroundAnalysis()` 함수

#### 동작:
1. **작업 큐 생성**
   ```javascript
   const task = {
     id: `llm-analysis-${setNum}-${Date.now()}`,
     setNum, setName, parts,
     status: 'pending',
     totalParts, processedParts: 0,
     errors: []
   }
   taskQueue.pending.push(task)
   ```

2. **백그라운드 처리 시작**
   - 최대 동시 작업: 3개
   - 요청 간 대기: 2초 (API 리밋 준수)

3. **LLM 분석 실행**
   ```javascript
   for (const part of parts) {
     // 기존 분석 확인
     const existing = await checkExistingAnalysis(partNum, colorId)
     
     // LLM 분석 (재시도 포함)
     const analysis = await analyzePartWithRetry(part)
     
     // API 리밋 대기
     await sleep(2000)
   }
   ```

4. **임베딩 생성**
   - `generateTextEmbeddingsBatch()` 호출
   - 배치 처리로 효율성 향상

5. **데이터베이스 저장**
   - `saveToMasterPartsDB()` 호출
   - `parts_master_features` 테이블에 저장
   - 768차원 벡터 저장

**문제점**:
- 순차 처리로 매우 느림 (100개 부품 = 200초 이상)
- API 리밋에 너무 보수적 (2초 대기는 과도)
- 재시도 로직이 지수 백오프 방식이지만 최대 3번으로 제한적
- 개발 모드에서 기존 분석 무시 (`import.meta.env.DEV`)

---

## 🚨 주요 문제점 요약

### 1. **성능 문제**
- **순차 처리**: 이미지 업로드, LLM 분석이 모두 순차적
- **반복적인 API 호출**: 중복 확인, 마이그레이션 상태 체크
- **폴링 방식**: 마이그레이션 완료 대기가 비효율적

### 2. **안정성 문제**
- **트랜잭션 없음**: 저장 중 실패 시 일부만 저장될 수 있음
- **오류 처리 불일치**: 각 단계마다 오류 처리 방식이 다름
- **Fallback 혼재**: 원본 URL과 Supabase URL이 혼재

### 3. **중복 처리 문제**
- **다중 중복 체크**: 같은 데이터를 여러 곳에서 확인
- **캐시 미활용**: 이미 확인한 중복을 다시 확인
- **스키마 불일치**: `part_images`와 `image_metadata` 중복

### 4. **데이터 일관성 문제**
- **외래 키 제약 조건 제거**: 데이터 무결성 손상
- **마이그레이션 제한**: 100개만 처리하는 임의 제한
- **이미지 URL 혼재**: JPG/WebP/원본 URL 혼재

### 5. **사용자 경험 문제**
- **진행률 불일치**: 배치 처리와 LLM 분석의 진행률이 별도
- **오류 메시지 부족**: 실패 시 명확한 안내 없음
- **중복 확인 UI**: 사용자가 여러 번 확인 받아야 함

---

## 💡 개선 방향 제안

### 1단계: 검색 최적화
- [ ] 단일 세트 번호 인식 로직 개선 (하이픈 포함 처리)
- [ ] API 오류 처리 표준화
- [ ] 검색 결과 캐싱

### 2단계: 로드 최적화
- [ ] 부품/미니피규어 병렬 조회
- [ ] 페이징 최적화 (더 큰 페이지 크기)
- [ ] 오류 발생 시 사용자 알림

### 3단계: 저장 최적화
- [ ] 트랜잭션 처리 추가
- [ ] 이미지 업로드를 배치 처리에 통합
- [ ] 중복 체크 로직 단순화

### 4단계: 이미지 처리 최적화
- [ ] 병렬 업로드 (Promise.all)
- [ ] 업로드 실패 시 재시도 메커니즘
- [ ] WebP 품질 설정 일관성 유지
- [ ] 프록시 오류 처리 개선

### 5단계: 마이그레이션 최적화
- [ ] 외래 키 제약 조건 복구
- [ ] 100개 제한 제거
- [ ] 웹소켓/이벤트 기반 완료 감지
- [ ] 마이그레이션 상태 추적 개선

### 6단계: LLM 분석 최적화
- [ ] 배치 처리로 전환
- [ ] API 리밋 동적 조정
- [ ] 병렬 처리 (동시 요청 증가)
- [ ] 임베딩 생성 최적화

### 공통 개선 사항
- [ ] 통합 진행률 표시
- [ ] 오류 로깅 및 추적 시스템
- [ ] 성능 모니터링
- [ ] 단위 테스트 추가

---

## 📊 성능 분석

### 현재 소요 시간 (100개 부품 기준)
1. 검색: ~2초
2. 로드: ~5초
3. 저장: ~10초
4. 이미지 처리: ~200초 (2초 × 100개)
5. 마이그레이션: ~50초 (+ 120초 대기)
6. LLM 분석: ~400초 (4초 × 100개)

**총 예상 시간**: **~787초 (13분)**

### 개선 후 예상 시간
1. 검색: ~1초
2. 로드: ~2초 (병렬)
3. 저장: ~5초
4. 이미지 처리: ~20초 (병렬 10개씩)
5. 마이그레이션: ~10초 (병렬 + 이벤트)
6. LLM 분석: ~100초 (배치 + 병렬)

**총 예상 시간**: **~138초 (2.3분)** → **83% 개선**

---

## 🔧 즉시 수정이 필요한 critical 이슈

1. **트랜잭션 처리 부재** → 데이터 일관성 손상 가능
2. **순차 이미지 업로드** → 사용자 대기 시간 과다
3. **마이그레이션 100개 제한** → 기능 불완전
4. **외래 키 제약 조건 제거** → 데이터 무결성 손상
5. **폴링 방식 마이그레이션 대기** → 리소스 낭비

---

## 📝 결론

현재 `new-lego` 페이지의 로직은 **기능적으로는 작동하지만, 성능과 안정성 면에서 많은 개선이 필요**합니다.

특히:
- **순차 처리 → 병렬 처리** 전환이 가장 시급
- **트랜잭션 처리** 추가로 안정성 확보
- **중복 체크 로직** 단순화로 효율성 향상
- **오류 처리 표준화**로 사용자 경험 개선

이러한 개선을 통해 **13분 → 2.3분**으로 성능을 대폭 향상시킬 수 있습니다.

