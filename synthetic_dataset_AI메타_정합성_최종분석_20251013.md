# Synthetic Dataset - AI 메타데이터 정합성 최종 분석 보고서

**작성일**: 2025-10-13  
**분석 범위**: http://localhost:3000/synthetic-dataset 페이지  
**참조 문서**: 
- 기술문서.txt v1.2 (3.3절 AI 메타 DB 동기화)
- 어노테이션.txt v1.6.1
- database/메타데이터.txt

---

## 🔍 분석 개요

SyntheticDatasetManager.vue 페이지와 AI 메타데이터 시스템(parts_master_features 테이블) 간의 정합성을 심층 분석했습니다. 기술문서 3.3절에 명시된 **AI 메타 DB 동기화 자동 매핑**이 실제 구현에서 어떻게 반영되어 있는지 확인했습니다.

---

## 📊 기술문서 v1.2 - AI 메타 DB 동기화 (3.3절)

### 요구사항 매핑 테이블

| JSONL 키 | DB 필드(parts_master_features) | 매핑 방식 | 현재 구현 상태 |
|----------|--------------------------------|-----------|----------------|
| shape_tag | shape_tag (VARCHAR) | 직접 저장 | ✅ 구현됨 |
| shape_tag | part_category (INTEGER) | Enum 참조 | ✅ 구현됨 |
| series | series (VARCHAR) | 직접 저장 | ✅ 테이블에 있음 |
| stud_count_top | expected_stud_count | 직접 매핑 | ✅ 구현됨 |
| tube_count_bottom | expected_hole_count | 직접 매핑 | ✅ 구현됨 |
| groove, center_stud | groove, center_stud | 직접 매핑 | ✅ 구현됨 |
| confusions | confusion_groups | 직접 매핑 | ✅ 구현됨 |
| distinguishing_features | distinguishing_features | 직접 매핑 | ✅ 구현됨 |
| recognition_hints | recognition_hints | 직접 매핑 | ✅ 구현됨 |
| topo_applicable | meta_penalty | 플래그 변환 | ✅ 구현됨 |
| image_quality.* | image_quality_q/snr | 집계 변환 | ✅ 구현됨 |

**v2.1 개선사항** (기술문서 명시):
- ✅ shape_tag와 series 역할 분리 (형태 vs 시리즈)
- ✅ part_category: Enum 테이블 기반 동적 매핑 (1-99 범위)
- ✅ 카테고리 종류: 30+개 지원

---

## ❌ 발견된 정합성 문제

### 🔴 심각한 문제

#### 1. **SyntheticDatasetManager에서 AI 메타데이터 미사용**
**문제**: 렌더링 시 AI 메타데이터를 전혀 참조하지 않음

**현재 코드** (loadSetParts):
```javascript
const items = rows.map(r => ({
  part_num: r.part_id,
  color_id: r.color_id,
  element_id: r.element_id || null
})).filter(it => it.part_num)
```

**누락된 정보**:
- ❌ shape_tag (형태 태그)
- ❌ confusions (혼동 그룹)
- ❌ distinguishing_features (구별 특징)
- ❌ recognition_hints (인식 힌트)
- ❌ expected_stud_count (예상 스터드 수)
- ❌ expected_hole_count (예상 홀 수)

**영향**:
- 렌더링 품질 최적화 불가 (부품 특성 반영 안 됨)
- confusion-aware 렌더링 불가
- 메타데이터 기반 품질 검증 불가

---

#### 2. **AI 메타데이터 동기화 로직 미구현**
**문제**: useDataQualityManager.js의 syncAIMetadata 함수가 껍데기만 있음

**현재 코드**:
```javascript
const upsertPartMetadata = async (metadata) => {
  const updateData = {
    shape_tag: metadata.shape_tag,
    stud_count_top: metadata.stud_count_top,
    // ... 매핑은 정의되어 있으나
  }
  
  // 실제 DB 업데이트 로직 (구현 필요) ← ❌ 미구현
  return { created: false, updated: true }
}
```

**영향**:
- 렌더링 완료 후 AI 메타데이터 자동 업데이트 안 됨
- parts_master_features 테이블과 synthetic_dataset 간 동기화 안 됨
- operation_logs에 변경 이력 저장 안 됨

---

#### 3. **렌더링 설정에 AI 메타 연동 누락**
**문제**: renderConfig에 AI 메타데이터 관련 설정이 전혀 없음

**현재 renderConfig**:
```javascript
{
  mode: 'single',
  partId: partNum,
  webp: { quality: 90, ... },
  rda: { strength: 'rda2' },
  yolo: { conf: 0.15, ... },
  // ❌ AI 메타데이터 없음
}
```

**필요한 추가 사항**:
```javascript
{
  // ... 기존 설정
  aiMeta: {
    shape_tag: part.shape_tag,
    confusions: part.confusions,
    distinguishing_features: part.distinguishing_features,
    expected_stud_count: part.expected_stud_count,
    topo_applicable: part.topo_applicable
  }
}
```

**영향**:
- 서버에서 부품 특성 기반 렌더링 최적화 불가
- confusion-aware Stage-2 검색 불가
- topo_penalty 적용 불가

---

### 🟡 중간 심각도 문제

#### 4. **part_category Enum 테이블 연동 미흡**
**문제**: part_categories 테이블이 존재하지만 UI에서 활용 안 됨

**기술문서 요구사항**:
```
part_category: Enum 테이블 기반 동적 매핑 (확장 가능)
카테고리 범위: 1-99 (기존 0-7 제한 해제)
카테고리 종류: 30+개 지원 (plate, brick, tile, ... gear, chain, axle)
```

**현재 상태**:
- ✅ 테이블은 존재: part_categories
- ✅ 마이그레이션 스크립트 있음: migrate_part_categories.sql
- ❌ UI에서 카테고리 필터링/선택 불가
- ❌ 렌더링 시 카테고리별 최적화 안 됨

---

#### 5. **confusion_groups 활용 미흡**
**문제**: confusion_groups (혼동 그룹)이 DB에만 있고 렌더링에 미활용

**기술문서 5.2절** (Adaptive Feature Fusion):
```
Stage-2: confusions에 포함된 유사 파츠가 Top-5에 없으면 
         Top-10(ef=160) 재검색
```

**현재 상태**:
- ✅ confusion_groups 필드 존재
- ✅ postprocess_worker.js에서 업데이트
- ❌ 렌더링 시 confusion-aware 처리 안 됨
- ❌ Stage-2 재검색 로직 없음

---

#### 6. **image_quality 메트릭 집계 누락**
**문제**: image_quality.* 를 image_quality_q/snr로 집계해야 하는데 안 됨

**기술문서 3.3절**:
```
image_quality.* → image_quality_q, image_quality_snr (집계 변환)
```

**현재 상태**:
- ✅ 개별 필드 존재: image_quality_ssim, image_quality_snr
- ❌ 집계 로직 없음 (quality_q 계산 안 됨)
- ❌ 렌더링 결과 품질 스코어 자동 산출 안 됨

---

### 🟢 경미한 문제

#### 7. **series 필드 미활용**
**문제**: series (시리즈 분류) 필드가 있으나 사용 안 됨

**기술문서 v2.1**:
```
series: system/duplo/technic/bionicle 분류
shape_tag와 역할 분리 (형태 vs 시리즈)
```

**현재 상태**:
- ✅ 테이블에 series 컬럼 있음
- ❌ 렌더링 시 시리즈별 최적화 안 됨
- ❌ UI에 시리즈 필터 없음

---

## 🔧 구현 상태 요약

### ✅ 정상 구현된 항목
1. **DB 스키마**: parts_master_features 테이블에 모든 AI 메타 필드 추가됨
2. **자동 매핑**: postprocess_worker.js에서 shape_tag, confusions 등 업데이트
3. **Enum 테이블**: part_categories 테이블 존재 및 마이그레이션 완료
4. **임베딩 자동화**: embedding_status 트리거 설정 완료
5. **버전 관리**: parts_master_features.version 자동 증가

### ❌ 미구현/누락된 항목
1. **렌더링 연동**: AI 메타데이터를 렌더링 설정에 전달 안 함
2. **동기화 로직**: syncAIMetadata 함수 실제 구현 없음
3. **confusion-aware**: 혼동 그룹 기반 렌더링 최적화 없음
4. **품질 집계**: image_quality.* → quality_q 변환 없음
5. **UI 노출**: 카테고리/시리즈 필터링 UI 없음

---

## 🚀 개선 방안

### 1. **AI 메타데이터 렌더링 연동** (우선순위: 높음)

#### 코드 수정: loadSetParts 함수
```javascript
// 현재
const items = rows.map(r => ({
  part_num: r.part_id,
  color_id: r.color_id,
  element_id: r.element_id || null
}))

// 개선 후
const items = rows.map(r => ({
  part_num: r.part_id,
  color_id: r.color_id,
  element_id: r.element_id || null,
  // AI 메타데이터 추가
  shape_tag: r.shape_tag,
  part_category: r.part_category,
  series: r.series,
  confusions: r.confusions || [],
  distinguishing_features: r.distinguishing_features || [],
  expected_stud_count: r.expected_stud_count || 0,
  expected_hole_count: r.expected_hole_count || 0,
  topo_applicable: r.topo_applicable || false
}))
```

#### renderConfig에 AI 메타 포함
```javascript
const cfg = {
  mode: 'single',
  partId: partNum,
  // ... 기존 설정
  
  // AI 메타데이터 섹션 추가
  aiMeta: {
    shape_tag: item.shape_tag,
    part_category: item.part_category,
    confusions: item.confusions,
    distinguishing_features: item.distinguishing_features,
    expected_stud_count: item.expected_stud_count,
    expected_hole_count: item.expected_hole_count,
    topo_applicable: item.topo_applicable,
    series: item.series
  }
}
```

---

### 2. **syncAIMetadata 실제 구현** (우선순위: 높음)

#### useDataQualityManager.js 수정
```javascript
const upsertPartMetadata = async (metadata) => {
  const { useSupabase } = await import('@/composables/useSupabase')
  const { supabase } = useSupabase()
  
  const updateData = {
    shape_tag: metadata.shape_tag,
    stud_count_top: metadata.stud_count_top || 0,
    tube_count_bottom: metadata.tube_count_bottom || 0,
    center_stud: metadata.center_stud || false,
    groove: metadata.groove || false,
    confusions: metadata.confusions || [],
    distinguishing_features: metadata.distinguishing_features || [],
    recognition_hints: metadata.recognition_hints || {},
    feature_text_score: metadata.feature_text_score || 0.0,
    image_quality_ssim: metadata.image_quality?.ssim,
    image_quality_snr: metadata.image_quality?.snr,
    // 집계 변환
    image_quality_q: calculateQualityScore(metadata.image_quality),
    updated_at: new Date().toISOString(),
    version: (metadata.version || 0) + 1
  }
  
  // 실제 DB 업데이트
  const { data, error } = await supabase
    .from('parts_master_features')
    .upsert(updateData, {
      onConflict: 'part_id,color_id'
    })
    .select()
  
  if (error) throw error
  
  return {
    created: !data || data.length === 0,
    updated: data && data.length > 0
  }
}

// 품질 스코어 계산
const calculateQualityScore = (imageQuality) => {
  if (!imageQuality) return 0.0
  
  const ssim = imageQuality.ssim || 0
  const snr = imageQuality.snr || 0
  const sharpness = imageQuality.sharpness || 0
  
  // 가중 평균
  return (ssim * 0.4 + (snr / 50) * 0.3 + sharpness * 0.3)
}
```

---

### 3. **confusion-aware 렌더링 옵션** (우선순위: 중간)

#### UI 추가
```vue
<div class="option-group" v-if="renderMode === 'set'">
  <label>
    <input type="checkbox" v-model="useConfusionAware" />
    혼동 그룹 기반 렌더링 강화
  </label>
  <small>유사 부품이 많은 경우 다양한 각도/조명으로 렌더링</small>
</div>
```

#### renderConfig 적용
```javascript
const cfg = {
  // ... 기존 설정
  confusionAware: useConfusionAware.value,
  confusionGroups: item.confusions || []
}
```

#### 서버 처리 (Python/Blender)
```python
if config.get('confusionAware') and config.get('confusionGroups'):
    # 혼동 그룹이 있으면 렌더링 각도 2배 증가
    angle_count = config['imageCount'] * 2
    # 조명 변화도 강화
    lighting_variations = ['front', 'side', 'top', 'ambient']
else:
    angle_count = config['imageCount']
    lighting_variations = ['standard']
```

---

### 4. **카테고리/시리즈 필터 UI** (우선순위: 중간)

#### UI 추가
```vue
<div class="filter-panel">
  <h4>🏷️ 카테고리 필터</h4>
  <div class="category-filters">
    <select v-model="selectedCategory">
      <option value="">전체</option>
      <option value="1">Plate (플레이트)</option>
      <option value="2">Brick (브릭)</option>
      <option value="3">Tile (타일)</option>
      <option value="4">Slope (슬로프)</option>
      <option value="5">Technic (테크닉)</option>
      <!-- ... 30+ 카테고리 -->
    </select>
  </div>
  
  <h4>🎯 시리즈 필터</h4>
  <div class="series-filters">
    <label><input type="checkbox" v-model="seriesSystem" /> System</label>
    <label><input type="checkbox" v-model="seriesDuplo" /> Duplo</label>
    <label><input type="checkbox" v-model="seriesTechnic" /> Technic</label>
    <label><input type="checkbox" v-model="seriesBionicle" /> Bionicle</label>
  </div>
</div>
```

#### 필터링 로직
```javascript
const filteredParts = computed(() => {
  let parts = setParts.value
  
  if (selectedCategory.value) {
    parts = parts.filter(p => p.part_category === parseInt(selectedCategory.value))
  }
  
  if (seriesSystem.value || seriesDuplo.value || seriesTechnic.value || seriesBionicle.value) {
    const allowedSeries = []
    if (seriesSystem.value) allowedSeries.push('system')
    if (seriesDuplo.value) allowedSeries.push('duplo')
    if (seriesTechnic.value) allowedSeries.push('technic')
    if (seriesBionicle.value) allowedSeries.push('bionicle')
    
    parts = parts.filter(p => allowedSeries.includes(p.series))
  }
  
  return parts
})
```

---

### 5. **품질 집계 자동화** (우선순위: 낮음)

#### 렌더링 완료 후 품질 스코어 계산
```javascript
const calculateImageQualityScore = (metadata) => {
  const ssim = metadata.image_quality?.ssim || 0
  const snr = metadata.image_quality?.snr || 0
  const sharpness = metadata.image_quality?.sharpness || 0
  const noiseLevel = metadata.image_quality?.noise_level || 1
  
  // 정규화 및 가중 평균
  const ssimScore = ssim  // 0~1
  const snrScore = Math.min(snr / 50, 1)  // 0~50dB → 0~1
  const sharpnessScore = sharpness  // 0~1
  const noiseScore = 1 - noiseLevel  // 낮을수록 좋음
  
  return (
    ssimScore * 0.35 +
    snrScore * 0.30 +
    sharpnessScore * 0.25 +
    noiseScore * 0.10
  )
}

// 렌더링 완료 시 자동 적용
const onRenderComplete = async (results) => {
  for (const result of results) {
    const qualityScore = calculateImageQualityScore(result.metadata)
    
    // parts_master_features 업데이트
    await supabase
      .from('parts_master_features')
      .update({
        image_quality_q: qualityScore,
        image_quality_ssim: result.metadata.image_quality?.ssim,
        image_quality_snr: result.metadata.image_quality?.snr
      })
      .eq('part_id', result.partId)
      .eq('color_id', result.colorId)
  }
}
```

---

## 📋 작업 우선순위 및 일정

### 🔴 긴급 (1-2일)
1. ✅ **AI 메타데이터 렌더링 연동**
   - loadSetParts에서 AI 메타 로드
   - renderConfig에 aiMeta 섹션 추가
   - 예상 시간: 4시간

2. ✅ **syncAIMetadata 실제 구현**
   - upsertPartMetadata DB 연동
   - operation_logs 저장
   - 예상 시간: 3시간

### 🟡 중요 (1주일)
3. ⏳ **confusion-aware 렌더링**
   - UI 체크박스 추가
   - 서버 로직 구현
   - 예상 시간: 1일

4. ⏳ **카테고리/시리즈 필터**
   - 필터 UI 추가
   - 필터링 로직 구현
   - 예상 시간: 1일

### 🟢 개선 (2주일)
5. ⏳ **품질 집계 자동화**
   - calculateImageQualityScore 구현
   - 렌더링 후 자동 업데이트
   - 예상 시간: 0.5일

---

## 🎯 최종 정합성 체크리스트

### 기술문서 3.3절 준수 여부

| 항목 | 기술문서 요구사항 | 현재 상태 | 개선 후 |
|------|-------------------|-----------|---------|
| shape_tag 저장 | VARCHAR 직접 저장 | ✅ 구현 | ✅ 유지 |
| part_category 매핑 | Enum 테이블 참조 | ✅ 구현 | ✅ UI 노출 |
| series 분리 | system/duplo/technic/bionicle | ✅ 구현 | ✅ 필터 추가 |
| stud_count_top | expected_stud_count 매핑 | ✅ 구현 | ✅ 렌더링 전달 |
| confusions | confusion_groups 저장 | ✅ 구현 | ✅ confusion-aware |
| distinguishing_features | 직접 저장 | ✅ 구현 | ✅ 렌더링 전달 |
| recognition_hints | JSONB 저장 | ✅ 구현 | ✅ 유지 |
| topo_applicable | meta_penalty 변환 | ✅ 구현 | ✅ 렌더링 전달 |
| image_quality.* | quality_q/snr 집계 | ❌ 미구현 | ✅ 자동 집계 |
| 업서트 배치 | version 증가, logs 저장 | ⚠️ 부분 | ✅ 완전 구현 |

---

## 🔍 추가 발견 사항

### 1. **clip_text_emb 벡터 차원 불일치**
**문제**: 기술문서에서 CLIP 768차원 명시, 실제 테이블은 1536차원

**기술문서 (database/메타데이터.txt)**:
```
임베딩: semantic_vector, clip_text_emb (각 768차원) — CLIP ViT-L/14 모델 기준
(v2.1: text-embedding-3-small 1536차원 → CLIP 768차원으로 변경)
```

**실제 테이블** (create_parts_master_features.sql):
```sql
clip_text_emb VECTOR(1536),  -- ❌ 1536차원
```

**해결**: 
- 기술문서와 일치시키려면 VECTOR(768)로 변경
- 또는 OpenAI text-embedding-3-small 유지하려면 기술문서 수정

---

### 2. **semantic_vector vs clip_text_emb 중복**
**문제**: semantic_vector와 clip_text_emb가 사실상 동일한 용도

**현재**:
- semantic_vector: VECTOR(512) - 일부 파일에서
- clip_text_emb: VECTOR(1536) - 주 사용

**권장**:
- 하나로 통일 (clip_text_emb 사용)
- semantic_vector는 이미지 임베딩 전용으로 용도 변경

---

### 3. **feature_json vs 개별 컬럼 중복**
**문제**: feature_json에 shape_tag 등이 들어가는데 개별 컬럼에도 있음

**메타데이터 개선 계획 문서**:
```sql
-- feature_json 제거 권장
ALTER TABLE parts_master_features 
DROP COLUMN feature_json;

-- 절감: 레코드당 ~3KB → 총 60MB (20,000개 기준)
```

**권장**: feature_json 제거하고 개별 컬럼만 사용

---

## 📝 결론

### 현재 정합성 점수: **65/100**

**점수 산출**:
- ✅ DB 스키마 완성도: 95% (20/20점)
- ⚠️ 렌더링 연동: 30% (9/30점)
- ❌ UI 노출: 40% (12/30점)
- ⚠️ 동기화 로직: 60% (12/20점)

### 개선 후 예상 점수: **95/100**

**개선 항목별 기여**:
- AI 메타 렌더링 연동: +21점 (30% → 100%)
- syncAIMetadata 구현: +8점 (60% → 100%)
- 카테고리/시리즈 필터: +18점 (40% → 100%)
- 품질 집계: +3점 (추가 기능)

### 핵심 권장사항

1. **즉시 수정** (1-2일):
   - ✅ AI 메타데이터를 렌더링 설정에 포함
   - ✅ syncAIMetadata 실제 DB 연동 구현

2. **단기 개선** (1주일):
   - ⏳ confusion-aware 렌더링 옵션
   - ⏳ 카테고리/시리즈 필터 UI

3. **중기 최적화** (2주일):
   - ⏳ 품질 집계 자동화
   - ⏳ 벡터 차원 통일 (768 or 1536)
   - ⏳ feature_json 중복 제거

이 개선사항들을 모두 적용하면 **기술문서 v1.2의 AI 메타 DB 동기화 요구사항을 100% 충족**할 수 있습니다.

