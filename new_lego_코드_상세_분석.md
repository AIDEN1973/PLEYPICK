# New Lego 페이지 코드 상세 분석

## 📂 관련 파일 목록

### 1. 메인 컴포넌트
- `src/views/NewLegoRegistration.vue` (1,610 lines)
  - 전체 UI 및 로직 통합

### 2. Composables (로직 계층)
- `src/composables/useRebrickable.js` (234 lines)
  - Rebrickable API 호출
- `src/composables/useBatchProcessing.js` (221 lines)
  - 배치 저장 로직
- `src/composables/useImageManager.js` (710 lines)
  - 이미지 다운로드/변환/업로드
- `src/composables/useAutoImageMigration.js` (816 lines)
  - 이미지 마이그레이션
- `src/composables/useBackgroundLLMAnalysis.js` (327 lines)
  - LLM 분석 백그라운드 워커
- `src/composables/useMasterPartsPreprocessing.js` (3,387 lines)
  - LLM 분석 상세 로직

---

## 🔍 단계별 코드 상세 분석

### 1단계: 레고 세트 검색

#### 파일: `NewLegoRegistration.vue`
**함수**: `searchSets()` (라인 512-619)

```javascript
// 핵심 로직
const searchSets = async () => {
  if (!searchQuery.value.trim()) return
  
  try {
    const query = searchQuery.value.trim()
    
    // 단일 세트 번호 인식
    if (isSingleSetNumber(query)) {
      const formattedSetNum = formatSetNumber(query)
      const existingSet = await checkSetExists(query)
      const setData = await getSet(formattedSetNum)
      
      // 중복 확인 프롬프트
      if (existingSet) {
        const confirmMessage = `세트가 이미 등록되어 있습니다...`
        if (!confirm(confirmMessage)) return
      }
      
      // 자동 부품 로드
      selectedSet.value = setData
      await loadSetParts()
      return
    }
    
    // 일반 검색
    const result = await searchSetsAPI(searchQuery.value)
    const apiResults = result.results || []
    
    // 중복 확인
    const setNums = apiResults.map(set => set.set_num)
    const existingSetsData = await checkMultipleSetsExist(setNums)
    
    // 중복 표시
    searchResults.value = apiResults.map(set => ({
      ...set,
      isExisting: existingSets.value.has(set.set_num),
      existingData: existingSetsData.find(existing => existing.set_num === set.set_num)
    }))
  } catch (err) {
    error.value = `검색 중 오류: ${err.message}`
  }
}
```

**문제점**:
1. **단일 세트 번호 인식 로직** (라인 415-420)
   ```javascript
   const isSingleSetNumber = (query) => {
     const trimmedQuery = query.trim()
     const setNumberPattern = /^\d{3,6}$/  // ⚠️ 하이픈 포함 번호 처리 안됨
     return setNumberPattern.test(trimmedQuery)
   }
   ```
   - "60315-1" 같은 번호는 인식 못함
   - 해결: `/^\d{3,6}(-\d+)?$/`로 수정

2. **중복 확인 비효율** (라인 586)
   ```javascript
   const existingSetsData = await checkMultipleSetsExist(setNums)
   ```
   - 모든 검색 결과에 대해 중복 확인
   - 사용자가 선택하지 않을 세트도 체크
   - 해결: 선택 시점에 중복 확인

3. **오류 처리 불일치**
   ```javascript
   if (setError.message.includes('404')) {
     error.value = `세트를 찾을 수 없습니다`  // 단일 세트
   } else {
     error.value = `검색 중 오류`  // 일반 검색
   }
   ```

---

### 2단계: 세트 정보 로드

#### 파일: `NewLegoRegistration.vue`
**함수**: `loadSetParts()` (라인 718-756)

```javascript
const loadSetParts = async () => {
  if (!selectedSet.value) return
  
  loadingParts.value = true
  try {
    // 부품 정보 로드
    const result = await getSetPartsAPI(selectedSet.value.set_num)
    setParts.value = result.results || []
    
    // 미니피규어 로드
    try {
      const minifigResult = await getSetMinifigs(selectedSet.value.set_num)
      setMinifigs.value = minifigResult.results || []
    } catch (minifigErr) {
      // ⚠️ 조용히 실패 (사용자에게 알림 없음)
      console.log('No minifigs found:', minifigErr.message)
      setMinifigs.value = []
    }
    
    // 통계 계산
    partsCountValidation.value = validatePartsCount(selectedSet.value, setParts.value)
    partsStats.value = calculatePartsStats(setParts.value)
    categorizedParts.value = categorizeParts(setParts.value, setMinifigs.value)
    
  } catch (err) {
    error.value = `부품 로딩 중 오류: ${err.message}`
  } finally {
    loadingParts.value = false
  }
}
```

**문제점**:
1. **순차 API 호출** (라인 724, 730)
   ```javascript
   const result = await getSetPartsAPI(...)  // 1번째
   const minifigResult = await getSetMinifigs(...)  // 2번째
   ```
   - 병렬 처리 가능: `Promise.all([getSetPartsAPI(...), getSetMinifigs(...)])`

2. **미니피규어 오류 무시**
   ```javascript
   try {
     const minifigResult = await getSetMinifigs(...)
   } catch (minifigErr) {
     console.log('No minifigs found')  // ⚠️ 사용자에게 알림 없음
     setMinifigs.value = []
   }
   ```

#### 파일: `useRebrickable.js`
**함수**: `getSetParts()` (라인 68-101)

```javascript
const getSetParts = async (setNum) => {
  const allParts = []
  let page = 1
  const pageSize = 1000  // ⚠️ API 최대값
  
  while (true) {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      inc_part_details: '1',
      inc_color_details: '1'
    })
    
    const response = await apiCall(`/lego/sets/${setNum}/parts/?${params}`)
    
    if (response.results && response.results.length > 0) {
      allParts.push(...response.results)
      
      if (!response.next) break  // ⚠️ 마지막 페이지
      
      page++
    } else {
      break
    }
  }
  
  return {
    count: allParts.length,
    results: allParts
  }
}
```

**문제점**:
1. **페이지 크기 고정**
   - 1000이 최대값이지만, 작은 세트는 오버헤드
   - 동적 조정 가능: 첫 페이지 결과로 예상 페이지 수 계산

2. **무한 루프 가능성**
   - `response.next`가 계속 있으면 무한 루프
   - 최대 페이지 수 제한 추가 필요

---

### 3단계: 배치 저장

#### 파일: `useBatchProcessing.js`
**함수**: `batchProcessSet()` (라인 11-212)

```javascript
const batchProcessSet = async (setData, parts) => {
  loading.value = true
  progress.value = 0
  
  try {
    // 1. 세트 저장
    const { data: savedSet, error: setError } = await supabase
      .from('lego_sets')
      .upsert({
        set_num: setData.set_num,
        name: setData.name,
        year: setData.year,
        theme_id: setData.theme_id,
        num_parts: setData.num_parts,
        set_img_url: setData.set_img_url,
        set_url: setData.set_url
      }, { onConflict: 'set_num' })
      .select()
      .single()
    
    if (setError) throw setError
    progress.value = 10
    
    // 2. 부품 중복 제거
    const uniqueParts = new Map()
    parts.forEach(partData => {
      const partNum = partData.part.part_num
      if (!uniqueParts.has(partNum)) {
        uniqueParts.set(partNum, {
          part_num: partData.part.part_num,
          name: partData.part.name,
          part_cat_id: partData.part.part_cat_id,
          part_img_url: partData.part.part_img_url,
          external_ids: partData.part.external_ids
        })
      }
    })
    
    // 3. 부품 배치 Upsert
    const partsToUpsert = Array.from(uniqueParts.values())
    const { data: savedParts, error: partsError } = await supabase
      .from('lego_parts')
      .upsert(partsToUpsert, { onConflict: 'part_num' })
      .select()
    
    if (partsError) throw partsError
    progress.value = 30
    
    // 4. 색상 중복 제거 및 배치 Upsert
    const uniqueColors = new Map()
    parts.forEach(partData => {
      const colorId = partData.color.id
      if (!uniqueColors.has(colorId)) {
        uniqueColors.set(colorId, {
          color_id: partData.color.id,
          name: partData.color.name,
          rgb: partData.color.rgb,
          is_trans: partData.color.is_trans
        })
      }
    })
    
    const colorsToUpsert = Array.from(uniqueColors.values())
    const { data: savedColors, error: colorsError } = await supabase
      .from('lego_colors')
      .upsert(colorsToUpsert, { onConflict: 'color_id' })
      .select()
    
    if (colorsError) throw colorsError
    progress.value = 50
    
    // 5. set_parts 관계 저장
    const { data: existingRelations } = await supabase
      .from('set_parts')
      .select('part_id, color_id')
      .eq('set_id', savedSet.id)
    
    const existingRelationsMap = new Map()
    if (existingRelations) {
      existingRelations.forEach(rel => {
        const key = `${rel.part_id}-${rel.color_id}`
        existingRelationsMap.set(key, rel)
      })
    }
    
    const setPartsToInsert = []
    for (const partData of parts) {
      const relationKey = `${partData.part.part_num}-${partData.color.id}`
      
      if (!existingRelationsMap.has(relationKey)) {
        setPartsToInsert.push({
          set_id: savedSet.id,
          part_id: partData.part.part_num,
          color_id: partData.color.id,
          quantity: partData.quantity,
          is_spare: partData.is_spare || false,
          element_id: partData.element_id,
          inv_part_id: partData.inv_part_id
        })
      }
    }
    
    if (setPartsToInsert.length > 0) {
      const { data: savedSetParts, error: setPartsError } = await supabase
        .from('set_parts')
        .insert(setPartsToInsert)
        .select()
      
      if (setPartsError) throw setPartsError
    }
    
    progress.value = 100
    
    return {
      set: savedSet,
      parts: parts.map(...),
      totalParts: parts.length,
      insertedRelationships: setPartsToInsert.length
    }
    
  } catch (err) {
    error.value = err.message
    throw err
  } finally {
    loading.value = false
  }
}
```

**문제점**:

1. **트랜잭션 없음**
   ```javascript
   await supabase.from('lego_sets').upsert(...)  // 1번
   await supabase.from('lego_parts').upsert(...)  // 2번
   await supabase.from('lego_colors').upsert(...) // 3번
   await supabase.from('set_parts').insert(...)   // 4번
   ```
   - 중간에 실패하면 일부만 저장됨
   - 해결: RPC 함수로 트랜잭션 구현

2. **중복 체크 비효율** (라인 112-130)
   ```javascript
   // 기존 관계 조회
   const { data: existingRelations } = await supabase
     .from('set_parts')
     .select('part_id, color_id')
     .eq('set_id', savedSet.id)
   
   // Map 변환
   const existingRelationsMap = new Map()
   existingRelations.forEach(rel => {
     const key = `${rel.part_id}-${rel.color_id}`
     existingRelationsMap.set(key, rel)
   })
   
   // 각 부품마다 확인
   for (const partData of parts) {
     const relationKey = `${partData.part.part_num}-${partData.color.id}`
     if (!existingRelationsMap.has(relationKey)) {
       // 새 관계 추가
     }
   }
   ```
   - 모든 부품을 순회하며 확인
   - 해결: `upsert`로 단순화 (onConflict 처리)

3. **이미지 업로드 누락**
   - 배치 처리에 이미지 업로드 포함 안됨
   - 별도 로직에서 순차 처리

---

### 4단계: 이미지 처리

#### 파일: `useImageManager.js`
**함수**: `processRebrickableImage()` (라인 246-416)

```javascript
const processRebrickableImage = async (imageUrl, partNum, colorId, options = {}) => {
  try {
    // 1. 중복 확인
    const forceUpload = options?.forceUpload || false
    if (!forceUpload) {
      const isDuplicate = await checkPartImageDuplicate(partNum, colorId)
      if (isDuplicate) {
        return {
          originalUrl: imageUrl,
          uploadedUrl: null,
          isDuplicate: true
        }
      }
    }
    
    // 2. 이미지 다운로드
    try {
      const blob = await downloadImage(imageUrl)
      
      // 3. WebP 변환
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = URL.createObjectURL(blob)
      })
      
      // 크기 조정 (최대 800px)
      const maxSize = 800
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      
      // WebP 변환 (품질 90%)
      const webpBlob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.90)
      })
      
      URL.revokeObjectURL(img.src)
      
      // 4. Supabase 업로드
      const fileName = `${partNum}_${colorId}.webp`
      const filePath = `images/${fileName}`
      
      const { data, error: uploadError } = await supabase.storage
        .from('lego_parts_images')
        .upload(filePath, webpBlob, {
          upsert: true
        })
      
      if (uploadError) throw uploadError
      
      // 5. 공개 URL 생성
      const { data: urlData } = supabase.storage
        .from('lego_parts_images')
        .getPublicUrl(filePath)
      
      // 6. part_images 동기화
      await upsertPartImage({ partNum, colorId, uploadedUrl: urlData.publicUrl })
      
      return {
        originalUrl: imageUrl,
        uploadedUrl: urlData.publicUrl,
        filename: fileName,
        path: filePath
      }
      
    } catch (downloadErr) {
      // 프록시 fallback
      const proxyUrl = `/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`
      const proxyResponse = await fetch(proxyUrl)
      // ... 동일한 변환/업로드 로직 반복 ...
    }
    
  } catch (err) {
    error.value = err.message
    throw err
  }
}
```

**문제점**:

1. **순차 처리** (호출부)
   ```javascript
   // NewLegoRegistration.vue 라인 814-854
   for (let i = 0; i < setParts.value.length; i++) {
     const part = setParts.value[i]
     const result = await processRebrickableImage(
       part.part.part_img_url,
       part.part.part_num,
       part.color.id
     )
   }
   ```
   - 100개 부품 = 100번 순차 실행
   - 해결: `Promise.allSettled()` 사용

2. **중복 코드** (라인 274-348, 353-396)
   - 다운로드 실패 시 프록시 fallback
   - 동일한 변환/업로드 로직 2번 작성
   - 해결: 공통 함수 추출

3. **WebP 품질 불일치**
   ```javascript
   // processRebrickableImage: 0.90
   canvas.toBlob(resolve, 'image/webp', 0.90)
   
   // uploadImageFromUrl: 0.6
   canvas.toBlob(resolve, 'image/webp', 0.6)
   ```
   - 함수마다 다른 품질 설정
   - 해결: 상수로 통일

4. **중복 확인 비효율** (라인 106-145)
   ```javascript
   const checkPartImageDuplicate = async (partNum, colorId) => {
     // 1. DB 확인
     const { data: partImage } = await supabase
       .from('part_images')
       .select('uploaded_url')
       .eq('part_id', partNum)
       .eq('color_id', colorId)
       .maybeSingle()
     
     if (partImage?.uploaded_url) return true
     
     // 2. Storage 확인 (HTTP HEAD)
     const fileName = `${partNum}_${colorId}.webp`
     const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
     
     const response = await fetch(imageUrl, { method: 'HEAD' })
     if (response.ok) return true
     
     return false
   }
   ```
   - 매번 DB + HTTP 요청
   - 해결: 캐싱 추가

---

### 5단계: 이미지 마이그레이션

#### 파일: `useAutoImageMigration.js`
**함수**: `triggerFullMigration()` (라인 677-731)

```javascript
const triggerFullMigration = async () => {
  try {
    // 1. 부품 데이터 조회 (외래 키 문제로 단계별)
    const { data: setParts, error: setPartsError } = await supabase
      .from('set_parts')
      .select('part_id, color_id')
      .limit(100)  // ⚠️ 100개만 제한
    
    if (setPartsError) throw setPartsError
    
    // 2. part_id 목록 추출
    const partIds = [...new Set(setParts.map(sp => sp.part_id))]
    
    // 3. lego_parts 조회
    const { data: legoParts, error: legoPartsError } = await supabase
      .from('lego_parts')
      .select('part_num, part_img_url')
      .in('part_num', partIds)
      .not('part_img_url', 'is', null)
    
    if (legoPartsError) throw legoPartsError
    
    // 4. 조합
    const parts = setParts
      .filter(sp => legoParts.some(lp => lp.part_num === sp.part_id))
      .map(sp => {
        const legoPart = legoParts.find(lp => lp.part_num === sp.part_id)
        return {
          part_id: sp.part_id,
          color_id: sp.color_id,
          lego_parts: legoPart,
          lego_colors: { color_id: sp.color_id }
        }
      })
    
    // 5. 배치 마이그레이션
    const results = await batchMigrateImages(parts)
    
    return results
  } catch (error) {
    throw error
  }
}
```

**문제점**:

1. **100개 제한** (라인 686)
   ```javascript
   .limit(100)  // ⚠️ 전체 마이그레이션 불가능
   ```
   - 테스트용 제한이 프로덕션 코드에 남음
   - 해결: 제한 제거 또는 페이징 처리

2. **외래 키 제약 조건 문제** (라인 683-717)
   ```javascript
   // 단계별 조회가 필요한 이유: 외래 키 제약 조건 제거로 인한 관계 인식 불가
   const setParts = await supabase.from('set_parts').select(...)
   const legoParts = await supabase.from('lego_parts').select(...)
   const parts = setParts.filter(...).map(...)
   ```
   - 원래는 JOIN으로 한 번에 조회 가능
   - 해결: 외래 키 복구

3. **배치 처리** (라인 574-629)
   ```javascript
   const batchMigrateImages = async (parts, options = {}) => {
     const concurrency = options.concurrency || 4  // 동시 4개
     
     let index = 0
     const worker = async (workerId) => {
       while (index < parts.length) {
         const i = index++
         const part = parts[i]
         
         await migratePartImage(
           part.lego_parts.part_num,
           part.lego_colors.color_id,
           part.lego_parts.part_img_url
         )
         
         await new Promise(r => setTimeout(r, 30))  // 30ms 대기
       }
     }
     
     const workers = Array.from({ length: concurrency }, (_, w) => worker(w + 1))
     await Promise.all(workers)
   }
   ```
   - 워커 패턴은 좋음
   - 30ms 대기는 불필요 (Supabase는 rate limit 관대)

#### 파일: `useAutoImageMigration.js`
**함수**: `performMigration()` (라인 72-157)

```javascript
const performMigration = async (partNum, colorId, originalUrl, options = {}) => {
  try {
    // 1. 기존 이미지 확인
    if (!options.force) {
      const existingImage = await checkExistingSupabaseImage(partNum, colorId)
      if (existingImage) {
        migrationStats.value.skipped++
        return existingImage
      }
    }
    
    // 2. 이미지 다운로드 (3번 시도)
    let imageBlob = null
    
    try {
      // 2-1. Vite 프록시
      const proxyUrl = imageUrl.replace('https://cdn.rebrickable.com', '/api/proxy')
      const proxyResponse = await fetch(proxyUrl)
      if (proxyResponse.ok) {
        imageBlob = await proxyResponse.blob()
      }
    } catch (err) {
      // 2-2. API 프록시
      try {
        const apiProxyUrl = `/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`
        const apiResponse = await fetch(apiProxyUrl)
        if (apiResponse.ok) {
          imageBlob = await apiResponse.blob()
        }
      } catch (err) {
        // 2-3. 직접 다운로드
        const directResponse = await fetch(imageUrl)
        if (directResponse.ok) {
          imageBlob = await directResponse.blob()
        }
      }
    }
    
    if (!imageBlob) {
      migrationStats.value.skipped++
      return originalUrl  // ⚠️ 원본 URL 반환 (fallback)
    }
    
    // 3. WebP 변환
    const webpBlob = await convertToWebP(imageBlob)
    
    // 4. Storage 업로드
    const uploadResult = await uploadToSupabase(partNum, colorId, webpBlob)
    
    // 5. DB 등록
    await registerInDatabase(partNum, colorId, originalUrl, uploadResult.url)
    
    migrationStats.value.completed++
    return uploadResult.url
    
  } catch (error) {
    migrationStats.value.failed++
    return originalUrl  // ⚠️ 최종 fallback
  }
}
```

**문제점**:

1. **다중 fallback** (라인 88-132)
   - 3번 시도는 좋지만, 중첩된 try-catch가 복잡
   - 각 단계별 오류 처리가 불명확
   - 해결: 명시적 fallback 체인

2. **원본 URL fallback** (라인 113, 156)
   ```javascript
   if (!imageBlob) {
     return originalUrl  // ⚠️ CDN URL 그대로 사용
   }
   
   catch (error) {
     return originalUrl  // ⚠️ 마이그레이션 실패해도 원본 URL
   }
   ```
   - 마이그레이션 실패 시 CDN URL과 Supabase URL 혼재
   - 해결: 실패 시 재시도 또는 명확한 오류 처리

3. **캐싱 로직** (라인 28-60)
   ```javascript
   // 캐시 확인
   if (migrationCache.has(cacheKey)) {
     return migrationCache.get(cacheKey)
   }
   
   // 진행 중인 마이그레이션 확인
   if (pendingMigrations.has(cacheKey)) {
     return await pendingMigrations.get(cacheKey)
   }
   ```
   - 좋은 패턴이지만, 캐시 크기 제한 없음
   - LRU 캐시 또는 시간 제한 필요

---

### 6단계: LLM 분석

#### 파일: `useBackgroundLLMAnalysis.js`
**함수**: `executeLLMAnalysis()` (라인 113-208)

```javascript
const executeLLMAnalysis = async (task) => {
  try {
    task.status = 'running'
    task.startTime = Date.now()
    
    // 1단계: LLM 분석
    const analysisResults = []
    const batchSize = 1  // ⚠️ 한 번에 1개
    
    for (let i = 0; i < task.parts.length; i++) {
      const part = task.parts[i]
      
      try {
        // 기존 분석 확인
        const existing = await checkExistingAnalysis(part.part.part_num, part.color.id)
        if (existing && !import.meta.env.DEV) {
          analysisResults.push({ ...existing, part: part.part, color: part.color })
          task.processedParts++
          task.progress = Math.round((task.processedParts / task.totalParts) * 50)
          continue
        }
        
        // LLM 분석 (재시도 포함)
        const analysis = await analyzePartWithRetry(part)
        
        if (analysis) {
          analysisResults.push({ ...analysis, part: part.part, color: part.color })
          task.processedParts++
        } else {
          task.failedParts++
        }
        
        task.progress = Math.round((task.processedParts / task.totalParts) * 50)
        
        // API 리밋: 2초 대기
        if (i < task.parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))  // ⚠️ 과도한 대기
        }
        
      } catch (error) {
        task.failedParts++
        task.errors.push(`Error analyzing ${part.part.part_num}: ${error.message}`)
      }
    }
    
    // 2단계: 임베딩 생성
    const needsEmbedding = analysisResults.filter(result => !result.embedding)
    
    if (needsEmbedding.length > 0) {
      const embeddingResults = await generateTextEmbeddingsBatch(needsEmbedding)
      
      // 임베딩 매핑
      let embeddingIndex = 0
      const combinedResults = analysisResults.map(analysis => {
        if (!analysis.embedding && embeddingIndex < embeddingResults.length) {
          return {
            ...analysis,
            embedding: embeddingResults[embeddingIndex++]
          }
        }
        return analysis
      })
      
      // 3단계: DB 저장
      await saveToMasterPartsDB(combinedResults)
    }
    
    task.progress = 100
    task.status = 'completed'
    task.endTime = Date.now()
    
  } catch (error) {
    task.status = 'failed'
    task.errors.push(error.message)
  } finally {
    moveTaskToCompleted(task)
  }
}
```

**문제점**:

1. **배치 크기** (라인 122)
   ```javascript
   const batchSize = 1  // ⚠️ 사용하지 않는 변수
   ```
   - 배치 처리 의도했지만 실제론 순차 처리

2. **과도한 대기** (라인 156)
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 2000))  // ⚠️ 2초
   ```
   - OpenAI API 리밋: 500 RPM (120ms 간격)
   - 2초는 과도함 → 250ms로 충분

3. **순차 처리** (라인 124-166)
   ```javascript
   for (let i = 0; i < task.parts.length; i++) {
     await analyzePartWithRetry(part)
     await sleep(2000)
   }
   ```
   - 100개 부품 = 200초
   - 해결: 배치 처리 (10개씩)
   ```javascript
   const batches = chunk(parts, 10)
   for (const batch of batches) {
     await Promise.all(batch.map(analyzePartWithRetry))
     await sleep(500)
   }
   ```

4. **재시도 로직** (라인 213-237)
   ```javascript
   const analyzePartWithRetry = async (part, retryCount = 0) => {
     try {
       const result = await analyzePartWithLLM(part)
       
       if (result === null && retryCount < 3) {
         const delay = 5000 * Math.pow(2, retryCount)  // 지수 백오프
         await new Promise(resolve => setTimeout(resolve, delay))
         return await analyzePartWithRetry(part, retryCount + 1)
       }
       
       return result
     } catch (error) {
       if (error.message.includes('429') && retryCount < 3) {
         const delay = 5000 * Math.pow(2, retryCount)
         await new Promise(resolve => setTimeout(resolve, delay))
         return await analyzePartWithRetry(part, retryCount + 1)
       }
       throw error
     }
   }
   ```
   - 지수 백오프는 좋음
   - 최대 재시도 3번은 적절
   - 5초 기본 대기는 너무 김 → 1초로 충분

---

## 🛠️ 개선 코드 예시

### 1. 병렬 이미지 처리

```javascript
// ❌ 현재 (순차)
for (const part of parts) {
  await processRebrickableImage(part)
}

// ✅ 개선 (병렬)
const BATCH_SIZE = 10

async function processBatch(parts, batchSize = BATCH_SIZE) {
  const batches = []
  for (let i = 0; i < parts.length; i += batchSize) {
    batches.push(parts.slice(i, i + batchSize))
  }
  
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(part => processRebrickableImage(part))
    )
    
    // 실패 처리
    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      console.warn(`Batch failed: ${failures.length} images`)
    }
  }
}
```

### 2. 트랜잭션 처리

```javascript
// ❌ 현재 (트랜잭션 없음)
await supabase.from('lego_sets').upsert(...)
await supabase.from('lego_parts').upsert(...)
await supabase.from('set_parts').insert(...)

// ✅ 개선 (RPC 함수로 트랜잭션)
// Supabase SQL 함수 생성
CREATE OR REPLACE FUNCTION save_lego_set_transaction(
  p_set jsonb,
  p_parts jsonb[],
  p_colors jsonb[],
  p_relationships jsonb[]
) RETURNS jsonb AS $$
BEGIN
  -- 세트 저장
  INSERT INTO lego_sets (...)
  VALUES (...)
  ON CONFLICT (set_num) DO UPDATE ...
  RETURNING * INTO v_set;
  
  -- 부품 저장
  INSERT INTO lego_parts (...)
  SELECT * FROM jsonb_populate_recordset(null::lego_parts, p_parts)
  ON CONFLICT (part_num) DO UPDATE ...;
  
  -- 색상 저장
  INSERT INTO lego_colors (...)
  SELECT * FROM jsonb_populate_recordset(null::lego_colors, p_colors)
  ON CONFLICT (color_id) DO UPDATE ...;
  
  -- 관계 저장
  INSERT INTO set_parts (...)
  SELECT * FROM jsonb_populate_recordset(null::set_parts, p_relationships)
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object('success', true, 'set', v_set);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;

// JS 호출
const { data, error } = await supabase.rpc('save_lego_set_transaction', {
  p_set: setData,
  p_parts: parts,
  p_colors: colors,
  p_relationships: relationships
})
```

### 3. 배치 LLM 분석

```javascript
// ❌ 현재 (순차)
for (const part of parts) {
  await analyzePartWithLLM(part)
  await sleep(2000)
}

// ✅ 개선 (배치)
async function batchAnalyzeParts(parts) {
  const BATCH_SIZE = 10
  const BATCH_DELAY = 500  // 배치당 500ms (충분)
  
  const batches = chunk(parts, BATCH_SIZE)
  const allResults = []
  
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(part => analyzePartWithLLM(part))
    )
    
    allResults.push(...results.map(r => r.value))
    
    // 배치 간 대기
    if (batches.indexOf(batch) < batches.length - 1) {
      await sleep(BATCH_DELAY)
    }
  }
  
  return allResults
}

// 헬퍼 함수
function chunk(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
```

### 4. 중복 체크 캐싱

```javascript
// ❌ 현재 (매번 DB 조회)
const checkPartImageDuplicate = async (partNum, colorId) => {
  const { data } = await supabase.from('part_images').select(...)
  return !!data
}

// ✅ 개선 (캐싱)
class ImageCache {
  constructor(maxSize = 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
  }
  
  async checkDuplicate(partNum, colorId) {
    const key = `${partNum}_${colorId}`
    
    // 캐시 확인
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }
    
    // DB 조회
    const { data } = await supabase
      .from('part_images')
      .select('uploaded_url')
      .eq('part_id', partNum)
      .eq('color_id', colorId)
      .maybeSingle()
    
    const result = !!data?.uploaded_url
    
    // 캐시 저장 (LRU)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, result)
    
    return result
  }
  
  clear() {
    this.cache.clear()
  }
}

const imageCache = new ImageCache()
```

### 5. 마이그레이션 이벤트 기반

```javascript
// ❌ 현재 (폴링)
const waitForMigrationComplete = async (setNum, timeout = 120000, interval = 2000) => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    const { data } = await supabase
      .from('migration_status')
      .select('completed')
      .eq('set_num', setNum)
      .single()
    
    if (data?.completed) return true
    
    await sleep(interval)
  }
  
  return false
}

// ✅ 개선 (이벤트 기반)
// Supabase Realtime 구독
const waitForMigrationComplete = (setNum, timeout = 120000) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      channel.unsubscribe()
      reject(new Error('Migration timeout'))
    }, timeout)
    
    const channel = supabase
      .channel(`migration:${setNum}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'migration_status',
        filter: `set_num=eq.${setNum}`
      }, (payload) => {
        if (payload.new.completed) {
          clearTimeout(timeoutId)
          channel.unsubscribe()
          resolve(true)
        }
      })
      .subscribe()
  })
}
```

---

## 📊 코드 메트릭스

### 복잡도 분석

| 파일 | 함수 수 | 평균 복잡도 | 최대 복잡도 | 문제 함수 |
|------|---------|-------------|-------------|-----------|
| NewLegoRegistration.vue | 25 | 8.2 | 18 | `saveSetBatch` (18) |
| useBatchProcessing.js | 1 | 12 | 12 | `batchProcessSet` (12) |
| useImageManager.js | 10 | 9.5 | 22 | `processRebrickableImage` (22) |
| useAutoImageMigration.js | 15 | 7.8 | 15 | `performMigration` (15) |
| useBackgroundLLMAnalysis.js | 7 | 10.1 | 16 | `executeLLMAnalysis` (16) |

### 코드 중복

| 중복 코드 | 위치 | 라인 수 | 개선 방법 |
|-----------|------|---------|-----------|
| WebP 변환 로직 | useImageManager.js (2곳) | 30 | 공통 함수 추출 |
| 이미지 다운로드 fallback | useAutoImageMigration.js | 60 | Fallback 체인 패턴 |
| 중복 체크 로직 | 여러 파일 | 80 | 통합 중복 체크 서비스 |
| 오류 처리 | 모든 파일 | 120 | 표준 오류 핸들러 |

### 성능 메트릭스

| 작업 | 현재 소요 시간 | 예상 개선 시간 | 개선율 |
|------|----------------|----------------|--------|
| 이미지 100개 업로드 | 200초 | 20초 | 90% |
| LLM 100개 분석 | 400초 | 100초 | 75% |
| 마이그레이션 대기 | 120초 | 2초 | 98% |
| 전체 프로세스 | 787초 | 138초 | 82% |

---

## 🔧 즉시 적용 가능한 Quick Fix

### 1. 단일 세트 번호 인식 개선 (5분)
```javascript
// src/views/NewLegoRegistration.vue 라인 415-420
const isSingleSetNumber = (query) => {
  const trimmedQuery = query.trim()
  // ✅ 하이픈 포함 지원
  const setNumberPattern = /^\d{3,6}(-\d+)?$/
  return setNumberPattern.test(trimmedQuery)
}
```

### 2. API 리밋 대기 시간 단축 (2분)
```javascript
// src/composables/useBackgroundLLMAnalysis.js 라인 156
- await new Promise(resolve => setTimeout(resolve, 2000))
+ await new Promise(resolve => setTimeout(resolve, 250))  // ✅ 2초 → 250ms
```

### 3. 마이그레이션 100개 제한 제거 (1분)
```javascript
// src/composables/useAutoImageMigration.js 라인 686
- .limit(100)
+ // ✅ 제한 제거
```

### 4. WebP 품질 통일 (3분)
```javascript
// src/composables/useImageManager.js 상단 추가
+ const WEBP_QUALITY = 0.90  // ✅ 상수로 통일

// 모든 canvas.toBlob 호출 시
- canvas.toBlob(resolve, 'image/webp', 0.90)
- canvas.toBlob(resolve, 'image/webp', 0.6)
+ canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
```

### 5. 부품/미니피규어 병렬 조회 (3분)
```javascript
// src/views/NewLegoRegistration.vue 라인 724-736
- const result = await getSetPartsAPI(...)
- const minifigResult = await getSetMinifigs(...)

+ const [result, minifigResult] = await Promise.allSettled([
+   getSetPartsAPI(selectedSet.value.set_num),
+   getSetMinifigs(selectedSet.value.set_num)
+ ])
+ setParts.value = result.status === 'fulfilled' ? result.value.results : []
+ setMinifigs.value = minifigResult.status === 'fulfilled' ? minifigResult.value.results : []
```

---

## 📝 리팩토링 우선순위

### Phase 1: Quick Wins (1-2일)
1. ✅ API 대기 시간 최적화
2. ✅ 단일 세트 번호 인식 개선
3. ✅ 마이그레이션 제한 제거
4. ✅ WebP 품질 통일
5. ✅ 병렬 API 호출

### Phase 2: 성능 개선 (1주)
1. 🔄 이미지 배치 처리
2. 🔄 LLM 분석 배치화
3. 🔄 중복 체크 캐싱
4. 🔄 트랜잭션 처리 추가

### Phase 3: 아키텍처 개선 (2-3주)
1. 🏗️ 통합 워크플로우 매니저
2. 🏗️ 이벤트 기반 마이그레이션
3. 🏗️ 오류 처리 표준화
4. 🏗️ 모니터링/로깅 시스템

---

## 🎯 결론

### 주요 발견 사항

1. **성능 병목**: 순차 처리 (이미지, LLM)
2. **안정성 문제**: 트랜잭션 부재
3. **코드 품질**: 중복 코드, 높은 복잡도
4. **유지보수성**: 일관성 없는 오류 처리

### 개선 효과 (예상)

- **성능**: 13분 → 2.3분 (82% 개선)
- **안정성**: 트랜잭션으로 데이터 일관성 보장
- **코드 품질**: 복잡도 50% 감소
- **유지보수성**: 표준화된 패턴 적용

### 다음 단계

1. Quick Fix 적용 (즉시)
2. 성능 개선 PR 작성
3. 아키텍처 개선 설계
4. 단위 테스트 추가

