import { ref } from 'vue'
import { supabase } from './useSupabase'

// LLM API 설정 (하이브리드 전략용)
const LLM_CONFIG = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || 'your-actual-api-key-here',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  maxTokens: 1000,
  temperature: 0.1
}

// 환경 변수 디버깅 (프로덕션에서도 표시)
console.log('🔍 Environment Debug:', {
  VITE_OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY ? 'Present' : 'Missing',
  process_env: process.env.VITE_OPENAI_API_KEY ? 'Present' : 'Missing',
  apiKey: LLM_CONFIG.apiKey ? 'Present' : 'Missing',
  allEnv: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
})

// 하이브리드 설정: 1차(4o-mini) 결과가 모호하면 2차(4.1-mini)로 보강
const HYBRID_CONFIG = {
  enabled: false,
  secondaryModel: 'gpt-4.1-mini'
}

// OpenAI 텍스트 임베딩 설정 (사전 분석된 feature_text용)
const CLIP_CONFIG = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  baseUrl: 'https://api.openai.com/v1',
  model: 'text-embedding-3-small',
  dimensions: 768
}

// 개별 함수들을 export하기 위해 함수들을 밖으로 이동
export async function analyzePartWithLLM(part) {
  try {
    // API 키 검증
    if (!LLM_CONFIG.apiKey || LLM_CONFIG.apiKey === 'undefined') {
      console.warn('⚠️ OpenAI API key is missing, skipping LLM analysis')
      console.warn('🔍 Environment check:', {
        VITE_OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY ? 'Present' : 'Missing',
        process_env: process.env.VITE_OPENAI_API_KEY ? 'Present' : 'Missing',
        allEnv: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
      })
      return createDefaultAnalysis(part)
    }
    
    if (import.meta.env.DEV) {
      console.log('분석할 부품 정보:', part)
    }
    
    // 부품 정보 확인 및 정리
    const partName = part.part?.name || part.name || 'Unknown'
    const partNum = part.part_num || part.part?.part_num || 'Unknown'
    const partImgUrl = part.part?.part_img_url || part.part_img_url || null
    const colorName = part.color?.name || part.color_name || 'Unknown'
    const colorId = part.color?.id ?? part.color_id ?? null
    const elementId = part.element_id || part.inv_part_id || null
    
    // 레고 공식 부품번호 확인 (external_ids에서 추출)
    const externalIds = part.part?.external_ids || part.external_ids || {}
    const legoPartNumber = externalIds.lego || externalIds.Lego || null
    
    if (import.meta.env.DEV) {
      console.log('정리된 부품 정보:', { partName, partNum, partImgUrl, legoPartNumber })
    }
    
    // 이미지 URL이 없으면 기본 분석만 수행
    if (!partImgUrl) {
      console.warn(`부품 ${partNum}의 이미지 URL이 없습니다. 텍스트만으로 분석합니다.`)
      return createTextOnlyAnalysis(part, partName, partNum)
    }
    
    const prompt = `다음 레고 부품을 분석하여 JSON 형태로만 응답하세요. 다른 설명 없이 JSON만 반환하세요.

부품 정보:
- 부품명: ${partName}
- 부품 번호: ${partNum}
${legoPartNumber ? `- 레고 공식 부품번호: ${legoPartNumber}` : ''}
 - 색상: ${colorName}${colorId !== null ? ` (ID: ${colorId})` : ''}
 ${elementId ? `- 엘리먼트 ID: ${elementId}` : ''}

응답 형식:
{
  "shape": "부품의 기본 형태",
  "center_stud": true/false,
  "groove": true/false,
  "connection": "연결 방식",
  "function": "주요 기능",
  "feature_text": "부품 특징을 설명하는 텍스트",
  "recognition_hints": {
    "top_view": "위에서 본 모습",
    "side_view": "옆에서 본 모습",
    "unique_features": ["고유 특징들"]
  },
  "similar_parts": ["유사한 부품 번호들"],
  "distinguishing_features": ["구별되는 특징들"],
  "stud_count_top": 0,
  "tube_count_bottom": 0,
  "size_category": "duplo|system|minifig|technic",
  "keypoints": ["식별에 중요한 형상 포인트(모서리, 슬롯, 홈, 핀 위치 등)"],
  "confusions": ["혼동되기 쉬운 유사 부품 번호들"],
  "color_expectation": "이미지상 색상 관찰 요약 (빛/각도 영향 배제)",
  "confidence": 0.95
}

신뢰도(confidence) 기준:
- 0.9-1.0: 매우 명확한 부품 (기본 블록, 플레이트 등)
- 0.7-0.9: 비교적 명확한 부품 (특수 부품, 장식 요소)
- 0.5-0.7: 애매한 부품 (복잡한 형태, 인쇄가 있는 부품)
- 0.3-0.5: 불확실한 부품 (이미지가 흐리거나 각도가 나쁨)
- 0.0-0.3: 분석 불가능 (이미지 없음 또는 너무 흐림)`

    const requestBody = {
      model: LLM_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: partImgUrl,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: LLM_CONFIG.maxTokens,
      temperature: LLM_CONFIG.temperature,
      response_format: { type: 'json_object' }
    }

    if (import.meta.env.DEV) {
      console.log('API 요청 정보:', {
        model: LLM_CONFIG.model,
        apiKey: LLM_CONFIG.apiKey ? '설정됨' : '없음',
        imageUrl: partImgUrl,
        promptLength: prompt.length
      })
    }

    const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API 오류 응답:', errorText)
      throw new Error(`LLM API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    if (import.meta.env.DEV) {
      console.log('LLM raw response:', data)
    }
    
    // 응답 구조 확인
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('응답 구조 오류:', data)
      return createDefaultAnalysis(part)
    }
    
    // JSON 응답 강제 모드: content는 JSON 문자열이어야 함
    let parsed
    try {
      parsed = JSON.parse(data.choices[0].message.content)
    } catch (e) {
      // 예외적으로 포맷이 어긋나는 경우 기존 파서로 폴백
      const llmResponse = data.choices[0].message.content || ''
      let jsonText = llmResponse
      const jsonBlockMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1].trim()
      } else {
        const jsonObjectMatch = llmResponse.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) jsonText = jsonObjectMatch[0]
      }
      try {
        parsed = JSON.parse(jsonText)
      } catch (err) {
        console.error('JSON 파싱 실패:', err)
        return createDefaultAnalysis(part, partName, partNum)
      }
    }

    // 1차 결과
    parsed.part_num = partNum

    // 하이브리드 보강 트리거: 낮은 confidence(<0.8), feature_text 짧음(<40자), key 필드 누락 시
    const needRefine = HYBRID_CONFIG.enabled && (
      (typeof parsed.confidence === 'number' && parsed.confidence < 0.8) ||
      (!parsed.feature_text || String(parsed.feature_text).length < 40) ||
      !parsed.recognition_hints || !parsed.distinguishing_features || !parsed.similar_parts
    )

    if (!needRefine) return parsed

    // 2차 모델(4.1-mini)로 보강 요청
    const refinePrompt = `다음 JSON을 보강하세요. 누락된 필드를 채우고, plate/brick의 stud/tube, 각도(있다면), 색상명(표준명), 혼동되는 유사부품을 구체적으로 기술하세요. JSON만 응답.

원본 JSON:\n${JSON.stringify(parsed)}`

    const refineBody = {
      model: HYBRID_CONFIG.secondaryModel,
      messages: [ { role: 'user', content: [ { type: 'text', text: refinePrompt } ] } ],
      max_tokens: LLM_CONFIG.maxTokens,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    }

    const refineResp = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LLM_CONFIG.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(refineBody)
    })

    if (!refineResp.ok) return parsed
    let refined
    try {
      const refineData = await refineResp.json()
      refined = JSON.parse(refineData.choices[0].message.content)
    } catch {
      return parsed
    }

    // 병합: 2차 값이 있으면 우선, 없으면 1차 유지
    const merged = {
      ...parsed,
      ...refined,
      recognition_hints: { ...(parsed.recognition_hints || {}), ...(refined.recognition_hints || {}) },
      similar_parts: Array.isArray(refined?.similar_parts) && refined.similar_parts.length > 0 ? refined.similar_parts : parsed.similar_parts,
      distinguishing_features: Array.isArray(refined?.distinguishing_features) && refined.distinguishing_features.length > 0 ? refined.distinguishing_features : parsed.distinguishing_features
    }
    merged.part_num = partNum
    return merged
    
  } catch (error) {
    console.error('LLM 분석 실패:', error)
    return createDefaultAnalysis(part)
  }
}

// 기본 분석 결과 생성
function createDefaultAnalysis(part, partName = null, partNum = null) {
  const name = partName || part.part?.name || part.name || 'Unknown'
  const num = partNum || part.part_num || part.part?.part_num || 'Unknown'
  
  return {
    shape: `분석 실패: ${name}`,
    center_stud: false,
    groove: false,
    connection: 'unknown',
    function: 'unknown',
    feature_text: `부품 ${num}의 자동 생성된 기본 설명`,
    recognition_hints: {
      top_view: '기본 형태',
      side_view: '기본 형태',
      unique_features: ['기본 특징']
    },
    similar_parts: [],
    distinguishing_features: ['기본 특징'],
    confidence: 0.1,
    part_num: num
  }
}

// 텍스트만으로 분석
function createTextOnlyAnalysis(part, partName, partNum) {
  return {
    shape: `텍스트 분석: ${partName}`,
    center_stud: false,
    groove: false,
    connection: 'unknown',
    function: 'unknown',
    feature_text: `부품 ${partNum}의 텍스트 기반 기본 설명`,
    recognition_hints: {
      top_view: '텍스트 기반 추정',
      side_view: '텍스트 기반 추정',
      unique_features: ['텍스트 기반 특징']
    },
    similar_parts: [],
    distinguishing_features: ['텍스트 기반 특징'],
    confidence: 0.3,
    part_num: partNum
  }
}

// 임베딩 생성 함수 export
// 텍스트 임베딩 배치 + 캐시
export async function generateTextEmbeddingsBatch(analysisResults) {
  const results = []

  // 0) 입력 데이터 중복 제거: (part_num, color_id) 조합 기준으로 중복 제거
  const uniqueResults = []
  const seenEmbeddingKeys = new Set()
  
  for (const item of analysisResults) {
    const partNum = item.part_num || 'unknown'
    const colorId = item.color_id !== undefined ? item.color_id : (item.color?.id !== undefined ? item.color.id : null)
    const key = `${partNum}_${colorId}`
    
    if (!seenEmbeddingKeys.has(key)) {
      seenEmbeddingKeys.add(key)
      uniqueResults.push(item)
    } else {
      console.warn(`⚠️ Duplicate embedding input found for part_num=${partNum}, color_id=${colorId}, skipping`)
    }
  }
  
  console.log(`📊 Embedding input deduplication: ${analysisResults.length} -> ${uniqueResults.length} results`)
  analysisResults = uniqueResults

  // 1) 기존 임베딩 보유/feature_text 누락 선분류
  const needsEmbedding = []
  for (const item of analysisResults) {
    const partNum = item.part_num || 'unknown'
    if (item.has_embedding === true) {
      console.log(`⏭️ Skipping embedding for ${partNum} - already has embedding`)
      results.push({ part_num: partNum, embedding: item.existing_embedding || null, feature_text: item.feature_text })
      continue
    }
    if (!item.feature_text) {
      console.warn(`⚠️ No feature text for ${partNum}, skipping embedding`)
      results.push({ part_num: partNum, embedding: null, error: 'feature_text missing' })
      continue
    }
    needsEmbedding.push(item)
  }

  if (needsEmbedding.length === 0) return results

  // 2) 텍스트 해시 캐시로 중복 제거
  const textToIndices = new Map()
  const uniqueTexts = []
  needsEmbedding.forEach((item, idx) => {
    const key = stableTextKey(item.feature_text)
    if (!textToIndices.has(key)) {
      textToIndices.set(key, [])
      uniqueTexts.push(item.feature_text)
    }
    textToIndices.get(key).push(idx)
  })

  // 3) OpenAI Embeddings API 다중 입력 배치 호출
  try {
    const response = await fetch(`${CLIP_CONFIG.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLIP_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CLIP_CONFIG.model,
        input: uniqueTexts,
        dimensions: CLIP_CONFIG.dimensions
      })
    })

    if (!response.ok) throw new Error(`Embedding API Error: ${response.status}`)
    const data = await response.json()

    // 4) 결과 매핑: 동일 텍스트 공유 인덱스에 동일 임베딩 복제
    uniqueTexts.forEach((text, uIdx) => {
      const embedding = data.data[uIdx].embedding
      const targetIndices = textToIndices.get(stableTextKey(text))
      for (const idx of targetIndices) {
        const src = needsEmbedding[idx]
        const enhancedText = buildEnhancedEmbeddingText({
          partName: src.part?.name,
          partNum: src.part_num,
          colorName: src.color?.name,
          featureText: src.feature_text,
          keypoints: src.keypoints,
          distinguishing: src.distinguishing_features,
          legoPartNumber: src.part?.external_ids?.lego || src.part?.external_ids?.Lego || null
        })
        results.push({ part_num: src.part_num || 'unknown', embedding, feature_text: enhancedText })
      }
    })
  } catch (error) {
    console.error('❌ Batch embeddings failed:', error)
    // 실패 시 개별 호출 폴백(최소한의 품질 유지)
    for (const src of needsEmbedding) {
      try {
        const r = await fetch(`${CLIP_CONFIG.baseUrl}/embeddings`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${CLIP_CONFIG.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: CLIP_CONFIG.model, input: src.feature_text, dimensions: CLIP_CONFIG.dimensions })
        })
        if (!r.ok) throw new Error(`Embedding API Error: ${r.status}`)
        const j = await r.json()
        const enhancedText = buildEnhancedEmbeddingText({
          partName: src.part?.name,
          partNum: src.part_num,
          colorName: src.color?.name,
          featureText: src.feature_text,
          keypoints: src.keypoints,
          distinguishing: src.distinguishing_features,
          legoPartNumber: src.part?.external_ids?.lego || src.part?.external_ids?.Lego || null
        })
        results.push({ part_num: src.part_num || 'unknown', embedding: j.data[0].embedding, feature_text: enhancedText })
      } catch (e) {
        results.push({ part_num: src.part_num || 'unknown', embedding: null, error: e.message })
      }
    }
  }

  return results
}

function stableTextKey(text) {
  return String(text).trim().toLowerCase()
}

// 표준 태그 정규화 (검색·후처리 최적화)
function normalizeShapeTag(raw) {
  const t = String(raw || '').toLowerCase()
  if (/(plate|플레이트)/.test(t)) return 'plate'
  if (/(brick|브릭)/.test(t)) return 'brick'
  if (/(slope|경사)/.test(t)) return 'slope'
  if (/(tile|타일)/.test(t)) return 'tile'
  if (/(animal|동물)/.test(t)) return 'animal_figure'
  if (/(leaf|plant|잎|식물)/.test(t)) return 'plant_leaf'
  if (/(technic|테크닉)/.test(t)) return 'technic'
  return t || 'unknown'
}

function normalizeFunctionTag(raw) {
  const t = String(raw || '').toLowerCase()
  if (/(basic|기본|building|구성)/.test(t)) return 'building'
  if (/(decoration|장식)/.test(t)) return 'decoration'
  if (/(figure|피규어)/.test(t)) return 'figure'
  if (/(slope|경사)/.test(t)) return 'slope'
  return t || 'unknown'
}

// CLIP 스타일 문구(짧고 핵심어 위주)로 변환
function clipifyPhrases(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map(s => String(s || '').toLowerCase().trim())
    .filter(Boolean)
    .map(s => s
      .replace(/\b(with|and|the|of|for|a|an|in|on|to|by|from)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    )
    .map(s => s.length > 40 ? s.slice(0, 40) : s)
}

function buildEnhancedEmbeddingText({ partName, partNum, colorName, featureText, keypoints, distinguishing, legoPartNumber }) {
  const header = [
    partName ? `name:${partName}` : null,
    partNum ? `part:${partNum}` : null,
    legoPartNumber ? `lego:${legoPartNumber}` : null,
    colorName ? `color:${colorName}` : null
  ].filter(Boolean).join(' ')

  const keypointsText = Array.isArray(keypoints) && keypoints.length > 0
    ? ` keypoints:${keypoints.join('|')}`
    : ''
  const distinguishingText = Array.isArray(distinguishing) && distinguishing.length > 0
    ? ` distinguishing:${distinguishing.join('|')}`
    : ''

  return `${header} features:${featureText || ''}${keypointsText}${distinguishingText}`.trim()
}

// 데이터베이스 저장 함수 export
export async function saveToMasterPartsDB(analysisResults) {
  try {
    // 0) 입력 데이터 중복 제거: (part_num, color_id) 조합 기준으로 중복 제거
    const uniqueResults = []
    const seenAnalysisKeys = new Set()
    
    for (const result of analysisResults) {
      const partNum = result.part_num || 'unknown'
      const colorId = result.color_id !== undefined ? result.color_id : (result.color?.id !== undefined ? result.color.id : null)
      const key = `${partNum}_${colorId}`
      
      if (!seenAnalysisKeys.has(key)) {
        seenAnalysisKeys.add(key)
        uniqueResults.push(result)
      } else {
        console.warn(`⚠️ Duplicate analysis result found for part_num=${partNum}, color_id=${colorId}, skipping`)
      }
    }
    
    console.log(`📊 Input deduplication: ${analysisResults.length} -> ${uniqueResults.length} results`)
    analysisResults = uniqueResults

    // 1) 누락 임베딩 보충: embedding 없는 결과들만 배치 생성
    const missingEmb = analysisResults.filter(r => !Array.isArray(r.embedding) || r.embedding.length === 0)
    if (missingEmb.length > 0) {
      try {
        const embResults = await generateTextEmbeddingsBatch(missingEmb)
        const embMap = new Map()
        for (const e of embResults) {
          if (Array.isArray(e.embedding)) embMap.set(e.part_num, e.embedding)
        }
        analysisResults.forEach(r => {
          if (!Array.isArray(r.embedding) || r.embedding.length === 0) {
            const emb = embMap.get(r.part_num)
            if (emb) r.embedding = emb
          }
        })
      } catch (e) {
        console.warn('⚠️ Failed to backfill embeddings; proceeding without some embeddings', e)
      }
    }

    // color_id 확정: result.color_id 또는 result.color?.id에서 추출, 없으면 저장 스킵
    const mapped = analysisResults.map(result => {
      const resolvedColorId = (result.color_id !== undefined && result.color_id !== null)
        ? result.color_id
        : (result.color?.id !== undefined ? result.color.id : null)

      // 태그 정규화 + CLIP 스타일 문구 변환
      const normalizedShape = normalizeShapeTag(result.shape)
      const normalizedFunction = normalizeFunctionTag(result.function)
      const clipDistinguishing = clipifyPhrases(result.distinguishing_features)
      const clipHints = {
        ...result.recognition_hints,
        unique_features: clipifyPhrases(result.recognition_hints?.unique_features)
      }

      return {
        part_id: result.part_num,
        part_name: result.part?.name || 'Unknown',
        part_category: result.part?.part_cat_id || null,
        color_id: resolvedColorId,
        feature_json: {
          shape: result.shape,
          center_stud: result.center_stud,
          groove: result.groove,
          connection: result.connection,
          function: result.function,
          recognition_hints: result.recognition_hints,
          similar_parts: result.similar_parts,
          distinguishing_features: result.distinguishing_features,
          shape_tag: normalizedShape,
          function_tag: normalizedFunction,
          clip_distinguishing: clipDistinguishing,
          clip_unique_features: clipHints.unique_features
        },
        feature_text: result.feature_text,
        clip_text_emb: Array.isArray(result.embedding) ? result.embedding : null,
        // 별도 컬럼으로도 저장하여 검색 최적화
        recognition_hints: result.recognition_hints || null,
        similar_parts: result.similar_parts || null,
        distinguishing_features: clipDistinguishing || null,
        confidence: result.confidence || 0.5
      }
    })

    // color_id가 없는 레코드는 저장 스킵 (중복/재분석 유발 방지)
    const validRecords = mapped.filter(r => r.color_id !== null && r.color_id !== undefined)
    const skipped = mapped.length - validRecords.length

    // 중복 제거: (part_id, color_id) 조합이 중복되는 경우 마지막 것만 유지
    const uniqueRecords = []
    const seenRecordKeys = new Set()
    
    // 역순으로 순회하여 중복된 키의 경우 마지막(최신) 레코드만 유지
    for (let i = validRecords.length - 1; i >= 0; i--) {
      const record = validRecords[i]
      const key = `${record.part_id}_${record.color_id}`
      
      if (!seenRecordKeys.has(key)) {
        seenRecordKeys.add(key)
        uniqueRecords.unshift(record) // 순서 유지를 위해 unshift 사용
      } else {
        console.warn(`⚠️ Duplicate record found for part_id=${record.part_id}, color_id=${record.color_id}, skipping`)
      }
    }

    const records = uniqueRecords
    const duplicatesRemoved = validRecords.length - records.length

    console.log(`💾 Saving ${records.length} records to parts_master_features...`)
    if (skipped > 0) {
      console.warn(`⚠️ Skipping ${skipped} records without color_id to avoid null-color duplicates`)
    }
    if (duplicatesRemoved > 0) {
      console.warn(`⚠️ Removed ${duplicatesRemoved} duplicate records to avoid constraint violations`)
    }
    
    const { data, error } = await supabase
      .from('parts_master_features')
      .upsert(records, { 
        onConflict: 'part_id,color_id',
        ignoreDuplicates: false 
      })

    if (error) throw error

    console.log(`✅ Successfully saved ${records.length} records to parts_master_features`)
    
    // 캐시 업데이트
    records.forEach(record => {
      const cacheKey = `${record.part_id}_${record.color_id}`
      const result = {
        part_num: record.part_id,
        color_id: record.color_id,
        shape: record.feature_json?.shape || 'unknown',
        center_stud: record.feature_json?.center_stud || false,
        groove: record.feature_json?.groove || false,
        connection: record.feature_json?.connection || 'unknown',
        function: record.feature_json?.function || 'unknown',
        feature_text: record.feature_text,
        recognition_hints: record.feature_json?.recognition_hints || {},
        similar_parts: record.feature_json?.similar_parts || [],
        distinguishing_features: record.feature_json?.distinguishing_features || [],
        confidence: record.confidence || 0.5,
        embedding: record.clip_text_emb
      }
      analysisCache.set(cacheKey, result)
    })
    
    return { success: true, count: records.length }
    
  } catch (error) {
    console.error('❌ Database save failed:', error)
    throw error
  }
}

// 기존 분석 확인 함수 export
export async function checkExistingAnalysis(partNum, colorId) {
  try {
    const cacheKey = `${partNum}_${colorId}`
    console.log(`🔍 Checking existing analysis for ${partNum} (color: ${colorId})`)
    
    // colorId가 없으면, null-color로 저장된 기존 레코리도 존재로 간주하여 즉시 스킵
    if (colorId === null || colorId === undefined) {
      console.warn(`⚠️ colorId is missing for ${partNum}; treating as existing to avoid duplicate LLM runs`)
      return { part_num: partNum, color_id: null, feature_text: '', embedding: null }
    }

    // 1. 먼저 캐시에서 확인
    if (analysisCache.has(cacheKey)) {
      console.log(`✅ Found in cache for ${partNum} (color: ${colorId})`)
      return analysisCache.get(cacheKey)
    }
    
    // 2. 데이터베이스에서 확인
    const { data, error: dbError } = await supabase
      .from('parts_master_features')
      .select('part_id, color_id, feature_json, feature_text, clip_text_emb, confidence')
      .eq('part_id', partNum)
      .eq('color_id', parseInt(colorId))
      .maybeSingle()
    
    console.log(`🔍 Query result for ${partNum} (color: ${colorId}):`, { data, error: dbError })

    if (dbError) {
      console.warn(`⚠️ Database error checking existing analysis:`, dbError)
      return null // 오류 시 새로 분석
    }
    
    // 데이터가 없는 경우
    if (!data) {
      console.log(`📝 No existing analysis found for ${partNum} (color: ${colorId})`)
      return null
    }
    
    console.log(`✅ Found existing analysis for ${partNum} (color: ${colorId})`)
    console.log(`📊 Existing data: part_id=${data.part_id}, confidence=${data.confidence}, has_embedding=${!!data.clip_text_emb}`)
    
    // part_id가 null인 경우 처리
    if (!data.part_id) {
      console.log(`⚠️ Found record but part_id is null for ${partNum} (color: ${colorId}), skipping`)
      return null
    }
    
    // 기존 분석 결과를 현재 형식으로 변환
    const result = {
      part_num: data.part_id,
      color_id: data.color_id,
      shape: data.feature_json?.shape || 'unknown',
      center_stud: data.feature_json?.center_stud || false,
      groove: data.feature_json?.groove || false,
      connection: data.feature_json?.connection || 'unknown',
      function: data.feature_json?.function || 'unknown',
      feature_text: data.feature_text,
      recognition_hints: data.feature_json?.recognition_hints || {},
      similar_parts: data.feature_json?.similar_parts || [],
      distinguishing_features: data.feature_json?.distinguishing_features || [],
      confidence: data.confidence || 0.5,
      embedding: data.clip_text_emb,
      has_embedding: !!data.clip_text_emb,
      existing_embedding: data.clip_text_emb
    }
    
    // 캐시에 저장
    analysisCache.set(cacheKey, result)
    return result
    
  } catch (error) {
    console.error('❌ Check existing analysis failed:', error)
    return null
  }
}

// 전역 캐시로 중복 체크
const analysisCache = new Map()

export function useMasterPartsPreprocessing() {
  const loading = ref(false)
  const error = ref(null)
  const processing = ref(false)
  const progress = ref(0)

  // 모든 Rebrickable 부품 수집
  const collectAllRebrickableParts = async () => {
    loading.value = true
    error.value = null

    try {
      const allParts = []
      let page = 1
      const pageSize = 1000

      while (true) {
        const response = await fetch(`https://rebrickable.com/api/v3/lego/parts/?page=${page}&page_size=${pageSize}`, {
          headers: {
            'Authorization': `key ${import.meta.env.VITE_REBRICKABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) break

        const data = await response.json()
        if (!data.results || data.results.length === 0) break

        allParts.push(...data.results)
        page++

        // API 제한 고려
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Collected ${allParts.length} parts from Rebrickable`)
      return allParts
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 부품별 LLM 분석 (배치 처리)
  const analyzePartsBatch = async (parts, batchSize = 10) => {
    processing.value = true
    error.value = null
    progress.value = 0

    try {
      const results = []
      const errors = []

      for (let i = 0; i < parts.length; i += batchSize) {
        const batch = parts.slice(i, i + batchSize)
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(parts.length / batchSize)}`)

        const batchPromises = batch.map(async (part, index) => {
          try {
            const analysis = await analyzePartWithLLM(part)
            return { part, analysis, success: true }
          } catch (err) {
            console.error(`Failed to analyze part ${part.part_num}:`, err)
            return { part, error: err.message, success: false }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        
        for (const result of batchResults) {
          if (result.success) {
            results.push(result)
          } else {
            errors.push(result)
          }
        }

        // 진행률 업데이트
        progress.value = Math.round((i + batchSize) / parts.length * 100)

        // API 제한을 위한 지연
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      return { results, errors }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      processing.value = false
    }
  }

  // 개별 부품 LLM 분석 (하이브리드 전략 A단계)
  const analyzePartWithLLM = async (part) => {
    try {
      if (import.meta.env.DEV) {
      console.log('분석할 부품 정보:', part)
    }
      
      // 부품 정보 확인 및 정리
      const partName = part.part?.name || part.name || 'Unknown'
      const partNum = part.part_num || part.part?.part_num || 'Unknown'
      const partImgUrl = part.part?.part_img_url || part.part_img_url || null
      
      console.log('정리된 부품 정보:', { partName, partNum, partImgUrl })
      
      // 이미지 URL이 없으면 기본 분석만 수행
      if (!partImgUrl) {
        console.warn(`부품 ${partNum}의 이미지 URL이 없습니다. 텍스트만으로 분석합니다.`)
        return createTextOnlyAnalysis(part, partName, partNum)
      }
      
      const prompt = `다음 레고 부품을 분석하여 JSON 형태로만 응답해주세요. 다른 설명 없이 JSON만 반환하세요.

부품 정보:
- 부품명: ${partName}
- 부품 번호: ${partNum}

응답 형식:
{
  "shape": "부품의 기본 형태",
  "center_stud": true/false,
  "groove": true/false,
  "connection": "연결 방식",
  "function": "주요 기능",
  "feature_text": "부품 특징을 설명하는 텍스트",
  "recognition_hints": {
    "top_view": "위에서 본 모습",
    "side_view": "옆에서 본 모습",
    "unique_features": ["고유 특징들"]
  },
  "similar_parts": ["유사한 부품 번호들"],
  "distinguishing_features": ["구별되는 특징들"],
  "confidence": 0.95
}

신뢰도(confidence) 기준:
- 0.9-1.0: 매우 명확한 부품 (기본 블록, 플레이트 등)
- 0.7-0.9: 비교적 명확한 부품 (특수 부품, 장식 요소)
- 0.5-0.7: 애매한 부품 (복잡한 형태, 인쇄가 있는 부품)
- 0.3-0.5: 불확실한 부품 (이미지가 흐리거나 각도가 나쁨)
- 0.0-0.3: 분석 불가능 (이미지 없음 또는 너무 흐림)`

      const requestBody = {
        model: LLM_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: partImgUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: LLM_CONFIG.maxTokens,
        temperature: LLM_CONFIG.temperature
      }

      console.log('API 요청 정보:', {
        model: LLM_CONFIG.model,
        apiKey: LLM_CONFIG.apiKey ? '설정됨' : '없음',
        imageUrl: partImgUrl,
        promptLength: prompt.length
      })

      const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API 오류 응답:', errorText)
        throw new Error(`LLM API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      if (import.meta.env.DEV) {
      console.log('LLM raw response:', data)
    }
      
      // 응답 구조 확인
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('응답 구조 오류:', data)
        return createDefaultAnalysis(part)
      }
      
      const llmResponse = data.choices[0].message.content
      console.log('LLM 응답 내용:', llmResponse)

      // JSON 부분만 추출 (```json ... ``` 또는 { ... } 패턴 찾기)
      let jsonText = llmResponse
      
      // ```json ... ``` 패턴 찾기
      const jsonBlockMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1].trim()
        console.log('추출된 JSON 블록:', jsonText)
      } else {
        // ```json 패턴이 없으면 { ... } 패턴 찾기
        const jsonObjectMatch = llmResponse.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) {
          jsonText = jsonObjectMatch[0]
          console.log('추출된 JSON 객체:', jsonText)
        }
      }

      // JSON 파싱
      let analysisResult
      try {
        analysisResult = JSON.parse(jsonText)
        // part_num 추가 (LLM 응답에는 없으므로 수동 추가)
        analysisResult.part_num = partNum
        console.log('파싱된 분석 결과:', analysisResult)
      } catch (parseError) {
        console.error('JSON 파싱 실패:', parseError)
        console.log('추출된 JSON 텍스트:', jsonText)
        console.log('원본 응답:', llmResponse)
        // JSON 파싱 실패 시 기본 구조 반환
        analysisResult = createDefaultAnalysis(part)
        analysisResult.part_num = partNum
      }

      return analysisResult
    } catch (err) {
      console.error('LLM analysis failed:', err)
      return createDefaultAnalysis(part)
    }
  }

  // 기본 분석 결과 생성 (하이브리드 전략용)
  const createDefaultAnalysis = (part) => {
    const partNum = part.part_num || part.part?.part_num || 'unknown'
    return {
      part_num: partNum,
      shape: `분석 실패: ${part.name || part.part?.name}`,
      center_stud: false,
      groove: false,
      connection: 'unknown',
      function: 'unknown',
      feature_text: `분석 실패: ${part.name || part.part?.name}`,
      recognition_hints: {
        top_view: '분석 실패',
        side_view: '분석 실패',
        unique_features: []
      },
      similar_parts: [],
      distinguishing_features: [],
      confidence: 0.3
    }
  }

  // 텍스트만으로 분석 (이미지 URL이 없을 때)
  const createTextOnlyAnalysis = (part, partName, partNum) => {
    return {
      part_num: partNum,
      shape: `텍스트 분석: ${partName}`,
      center_stud: false,
      groove: false,
      connection: 'unknown',
      function: 'unknown',
      feature_text: `텍스트 분석: ${partName}`,
      recognition_hints: {
        top_view: '이미지 없음',
        side_view: '이미지 없음',
        unique_features: []
      },
      similar_parts: [],
      distinguishing_features: [],
      confidence: 0.3
    }
  }

  // CLIP 텍스트 임베딩 생성 (하이브리드 전략용)
  const generateClipTextEmbedding = async (featureText) => {
    try {
      if (!CLIP_CONFIG.apiKey) {
        throw new Error('Missing VITE_OPENAI_API_KEY')
      }
      const response = await fetch(`${CLIP_CONFIG.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLIP_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: CLIP_CONFIG.model,
          input: featureText,
          dimensions: CLIP_CONFIG.dimensions
        })
      })

      if (!response.ok) {
        throw new Error(`CLIP API Error: ${response.status}`)
      }

      const data = await response.json()
      return data.data[0].embedding
    } catch (err) {
      console.error('CLIP text embedding generation failed:', err)
      throw err
    }
  }

  // CLIP 이미지 임베딩 생성 (실시간 매칭용)
  const generateClipImageEmbedding = async (imageUrl) => {
    try {
      // 이미지 임베딩은 서버/외부 API에서 처리해야 합니다.
      // 환경변수: VITE_CLIP_IMAGE_API_URL (POST base64 or URL)
      const endpoint = import.meta.env.VITE_CLIP_IMAGE_API_URL
      if (!endpoint) {
        throw new Error('Missing VITE_CLIP_IMAGE_API_URL')
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, dimensions: CLIP_CONFIG.dimensions })
      })
      if (!response.ok) throw new Error(`Image embedding API Error: ${response.status}`)
      const data = await response.json()
      if (!data.embedding) throw new Error('Image embedding API response missing embedding')
      return data.embedding
    } catch (err) {
      console.error('CLIP image embedding generation failed:', err)
      throw err
    }
  }

  // 마스터 부품 DB에 저장 (하이브리드 전략용)
  const saveToMasterPartsDB = async (analysisResults) => {
    try {
      const records = analysisResults.map(result => ({
        part_id: result.part_num,
        part_name: result.part?.name || 'Unknown',
        part_category: result.part?.part_cat_id || null,
        color_id: result.color?.id || null,
        feature_json: {
          shape: result.shape,
          center_stud: result.center_stud,
          groove: result.groove,
          connection: result.connection,
          function: result.function
        },
        feature_text: result.feature_text,
        clip_text_emb: result.clip_text_emb,
        recognition_hints: result.recognition_hints,
        similar_parts: result.similar_parts,
        distinguishing_features: result.distinguishing_features,
        confidence: result.confidence,
        usage_frequency: 0,
        detection_accuracy: 0.0,
        created_at: new Date().toISOString()
      }))

      const { data, error: dbError } = await supabase
        .from('parts_master_features')
        .upsert(records, {
          onConflict: 'part_id,color_id'
        })
        .select()

      if (dbError) throw dbError
      return data
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 전체 마스터 DB 구축 프로세스
  const buildMasterPartsDatabase = async () => {
    processing.value = true
    error.value = null
    progress.value = 0

    try {
      console.log('Starting master parts database construction...')

      // 1. 모든 Rebrickable 부품 수집
      console.log('Step 1: Collecting all Rebrickable parts...')
      const allParts = await collectAllRebrickableParts()
      console.log(`Collected ${allParts.length} parts`)

      // 2. 부품별 LLM 분석 (배치 처리)
      console.log('Step 2: Analyzing parts with LLM...')
      const analysisResults = await analyzePartsBatch(allParts, 5) // 작은 배치 크기
      console.log(`Analyzed ${analysisResults.results.length} parts successfully`)
      console.log(`Failed to analyze ${analysisResults.errors.length} parts`)

      // 3. CLIP 텍스트 임베딩 생성
      console.log('Step 3: Generating CLIP text embeddings...')
      const embeddingResults = await generateTextEmbeddingsBatch(analysisResults.results)

      // 4. 마스터 DB에 저장
      console.log('Step 4: Saving to master database...')
      const savedRecords = await saveToMasterPartsDB(embeddingResults)

      console.log(`Master parts database construction completed!`)
      console.log(`Total records saved: ${savedRecords.length}`)

      return {
        totalParts: allParts.length,
        analyzedParts: analysisResults.results.length,
        failedParts: analysisResults.errors.length,
        savedRecords: savedRecords.length
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      processing.value = false
    }
  }

  // CLIP 텍스트 임베딩 배치 생성 (하이브리드 전략용)
  const generateTextEmbeddingsBatch = async (analysisResults) => {
    const results = []

    for (const result of analysisResults) {
      try {
        // part_num 확인 및 처리
        const partNum = result.part_num || 'unknown'
        
        if (!result.feature_text) {
          console.warn(`부품 ${partNum}의 feature_text가 없습니다.`)
          results.push({
            ...result,
            clip_text_emb: null
          })
          continue
        }

        const textEmbedding = await generateClipTextEmbedding(result.feature_text)
        results.push({
          ...result,
          clip_text_emb: textEmbedding
        })
      } catch (err) {
        const partNum = result.part_num || 'unknown'
        console.error(`Failed to generate text embedding for ${partNum}:`, err)
        results.push({
          ...result,
          clip_text_emb: null
        })
      }
    }

    return results
  }

  // 마스터 DB 상태 확인 (하이브리드 전략용)
  const checkMasterDBStatus = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('parts_master_features')
        .select('part_id, created_at, confidence, usage_frequency, detection_accuracy')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (dbError) throw dbError

      const stats = {
        totalRecords: data.length,
        averageConfidence: data.reduce((sum, record) => sum + (record.confidence || 0), 0) / data.length,
        lastUpdated: data[0]?.created_at,
        highConfidence: data.filter(r => r.confidence > 0.8).length,
        lowConfidence: data.filter(r => r.confidence < 0.5).length,
        averageUsageFrequency: data.reduce((sum, record) => sum + (record.usage_frequency || 0), 0) / data.length,
        averageDetectionAccuracy: data.reduce((sum, record) => sum + (record.detection_accuracy || 0), 0) / data.length
      }

      return stats
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 기존 분석 결과 확인 (중복 방지용)
  const checkExistingAnalysis = async (partColorPairs) => {
    try {
      const { data, error: dbError } = await supabase
        .from('parts_master_features')
        .select('part_id, color_id, feature_json, feature_text, clip_text_emb, confidence')
        .in('part_id', partColorPairs.map(p => p.part_num))
        .in('color_id', partColorPairs.map(p => p.color_id))

      if (dbError) throw dbError
      
      // 기존 분석 결과를 현재 형식으로 변환
      const existingResults = data.map(record => ({
        part_num: record.part_id,
        color_id: record.color_id,
        shape: record.feature_json?.shape || 'unknown',
        center_stud: record.feature_json?.center_stud || false,
        groove: record.feature_json?.groove || false,
        connection: record.feature_json?.connection || 'unknown',
        function: record.feature_json?.function || 'unknown',
        feature_text: record.feature_text,
        recognition_hints: record.feature_json?.recognition_hints || {},
        similar_parts: record.feature_json?.similar_parts || [],
        distinguishing_features: record.feature_json?.distinguishing_features || [],
        confidence: record.confidence,
        clip_text_emb: record.clip_text_emb,
        is_existing: true // 기존 분석 결과임을 표시
      }))
      
      console.log(`기존 분석 결과 ${existingResults.length}개 발견`)
      return existingResults
    } catch (err) {
      console.error('기존 분석 결과 확인 실패:', err)
      return []
    }
  }

  return {
    loading,
    error,
    processing,
    progress,
    collectAllRebrickableParts,
    analyzePartsBatch,
    analyzePartWithLLM,
    generateClipTextEmbedding,
    generateClipImageEmbedding,
    saveToMasterPartsDB,
    buildMasterPartsDatabase,
    generateTextEmbeddingsBatch,
    checkMasterDBStatus,
    checkExistingAnalysis
  }
}
