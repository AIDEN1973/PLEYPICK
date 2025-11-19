import { ref } from 'vue'
import { supabase } from './useSupabase'
import { useRebrickable } from './useRebrickable'

export function usePartCharacteristics() {
  const loading = ref(false)
  const error = ref(null)
  const analyzing = ref(false)

  // LLM API 키 (실제 환경에서는 환경변수로 관리)
  const LLM_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || 'your-openai-api-key'
  const LLM_BASE_URL = 'https://api.openai.com/v1'

  // LLM API 호출 헬퍼 (Vision API 지원)
  const callLLM = async (messages, model = 'gpt-4o-mini') => {
    try {
      const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_completion_tokens: 1000,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        throw new Error(`LLM API Error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (err) {
      console.error('LLM API call failed:', err)
      throw err
    }
  }

  // CLIP 임베딩 생성 (실제로는 CLIP API 또는 로컬 모델 사용)
  const generateClipEmbedding = async (imageUrl) => {
    try {
      // 실제 구현에서는 CLIP 모델을 사용
      // 여기서는 더미 벡터 반환
      // 실제 임베딩 생성 필요
      throw new Error('Part embedding generation not implemented')
    } catch (err) {
      console.error('CLIP embedding generation failed:', err)
      throw err
    }
  }

  // 부품 특징 LLM 분석 (Vision API 지원)
  const analyzePartWithLLM = async (partData, imageUrl = null) => {
    analyzing.value = true
    error.value = null

    try {
      // 이미지 URL 우선순위 설정 (WebP 우선 사용)
      let finalImageUrl = imageUrl || null
      
      // WebP 이미지 우선 사용 로직
      if (partData.supabase_image_url) {
        finalImageUrl = partData.supabase_image_url
        console.log(`✅ Supabase Storage WebP 이미지 사용: ${finalImageUrl}`)
      } else if (partData.llm_image_url) {
        finalImageUrl = partData.llm_image_url
        console.log(`✅ LLM 분석용 WebP 이미지 사용: ${finalImageUrl}`)
      }
      
      // element_id가 있고 이미지가 없으면 Rebrickable API에서 element_img_url 가져오기
      if (!finalImageUrl && partData.element_id) {
        try {
          const { getElement } = useRebrickable()
          const elementData = await getElement(partData.element_id)
          if (elementData?.element_img_url) {
            finalImageUrl = elementData.element_img_url
            console.log(`✅ element_id ${partData.element_id} 기반 이미지 URL 획득: ${finalImageUrl}`)
          } else if (elementData?.part_img_url) {
            finalImageUrl = elementData.part_img_url
            console.log(`⚠️ element_id 이미지 없음, part_img_url 사용`)
          }
        } catch (elementErr) {
          console.warn(`⚠️ element_id ${partData.element_id} 이미지 조회 실패:`, elementErr)
        }
      }
      
      // element_id 실패 시 part_img_url 사용 (fallback)
      if (!finalImageUrl) {
        finalImageUrl = partData.part?.part_img_url || partData.part_img_url
        if (finalImageUrl) {
          console.log(`⚠️ WebP 없음, Rebrickable 원본 사용: ${finalImageUrl}`)
        } else {
          console.warn(`⚠️ 이미지 URL을 찾을 수 없습니다.`)
        }
      }

      const messages = [
        {
          role: 'system',
          content: `당신은 레고 부품 분석 전문가입니다. 
          부품 이미지를 분석하여 구조화된 특징 정보를 제공해주세요.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
부품 정보:
- 부품명: ${partData.part.name}
- 색상: ${partData.color.name}
- 부품 번호: ${partData.part.part_num}

다음 JSON 구조로 응답해주세요:
{
  "visual_features": {
    "shape_description": "부품의 모양 설명",
    "key_identifiers": ["주요 식별 특징들"],
    "distinguishing_marks": ["구별되는 마크나 로고"],
    "color_characteristics": {
      "primary": "주 색상",
      "rgb": "RGB 값",
      "transparency": false,
      "finish": "표면 마감"
    }
  },
  "geometric_features": {
    "dimensions": "크기 정보",
    "height": "높이",
    "stud_count": "스터드 개수",
    "tube_count": "튜브 개수",
    "shape_type": "형태 유형"
  },
  "recognition_hints": {
    "top_view": "상단에서 본 모습",
    "side_view": "측면에서 본 모습",
    "bottom_view": "하단에서 본 모습",
    "unique_features": ["고유한 특징들"]
  },
  "confidence": 0.95
}`
            },
            {
              type: 'image_url',
              image_url: {
                url: finalImageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ]

      const llmResponse = await callLLM(messages)
      
      // JSON 파싱
      let analysisResult
      try {
        analysisResult = JSON.parse(llmResponse)
      } catch (parseError) {
        // JSON 파싱 실패 시 기본 구조 반환
        analysisResult = {
          visual_features: {
            shape_description: "분석 실패",
            key_identifiers: [],
            distinguishing_marks: [],
            color_characteristics: {
              primary: partData.color.name,
              rgb: partData.color.rgb,
              transparency: partData.color.is_trans,
              finish: "unknown"
            }
          },
          geometric_features: {
            dimensions: "unknown",
            height: "unknown",
            stud_count: 0,
            tube_count: 0,
            shape_type: "unknown"
          },
          recognition_hints: {
            top_view: "분석 실패",
            side_view: "분석 실패",
            bottom_view: "분석 실패",
            unique_features: []
          },
          confidence: 0.5
        }
      }

      return analysisResult
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      analyzing.value = false
    }
  }

  // 부품 특징 정보 저장
  const savePartCharacteristics = async (partNum, setNum, colorId, characteristics) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('part_characteristics')
        .upsert({
          part_num: partNum,
          set_num: setNum,
          color_id: colorId,
          llm_visual_features: characteristics.visual_features,
          llm_geometric_features: characteristics.geometric_features,
          llm_recognition_hints: characteristics.recognition_hints,
          llm_confidence: characteristics.confidence,
          last_analyzed_at: new Date().toISOString()
        }, {
          onConflict: 'part_num,set_num,color_id'
        })
        .select()

      if (dbError) throw dbError
      return data[0]
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // CLIP 임베딩 저장
  const saveClipEmbedding = async (partNum, setNum, colorId, embedding) => {
    try {
      const { data, error: dbError } = await supabase
        .from('part_characteristics')
        .update({
          clip_embedding: embedding,
          updated_at: new Date().toISOString()
        })
        .eq('part_num', partNum)
        .eq('set_num', setNum)
        .eq('color_id', colorId)
        .select()

      if (dbError) throw dbError
      return data[0]
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 부품별 특징 정보 조회
  const getPartCharacteristics = async (setNum) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('part_characteristics')
        .select(`
          *,
          lego_parts(*),
          lego_colors(*)
        `)
        .eq('set_num', setNum)
        .order('detection_priority', { ascending: false })

      if (dbError) throw dbError
      return data || []
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 부품 특징 분석 상태 확인
  const getAnalysisStatus = async (setNum) => {
    try {
      const { data, error: dbError } = await supabase
        .rpc('get_part_analysis_status', {
          set_num_param: setNum
        })

      if (dbError) throw dbError
      return data || []
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 세트별 부품 특징 일괄 분석
  const analyzeSetParts = async (setNum, setParts) => {
    analyzing.value = true
    error.value = null

    try {
      const results = []
      const errors = []

      for (const part of setParts) {
        try {
          console.log(`Analyzing part: ${part.part.part_num} (${part.color.name})`)
          
          // 이미지 URL 결정: element_id가 있으면 Rebrickable API에서 element_img_url 가져오기
          let imageUrl = part.supabase_image_url || part.llm_image_url || null
          
          // element_id가 있고 이미지가 없으면 Rebrickable API에서 element_img_url 가져오기
          if (!imageUrl && part.element_id) {
            try {
              const { getElement } = useRebrickable()
              const elementData = await getElement(part.element_id)
              if (elementData?.element_img_url) {
                imageUrl = elementData.element_img_url
              } else if (elementData?.part_img_url) {
                imageUrl = elementData.part_img_url
              }
            } catch (elementErr) {
              console.warn(`⚠️ element_id ${part.element_id} 이미지 조회 실패:`, elementErr)
            }
          }
          
          // element_id 실패 시 part_img_url 사용 (fallback)
          if (!imageUrl) {
            imageUrl = part.part.part_img_url
          }
          
          // LLM 분석 (WebP 이미지 전달)
          const llmAnalysis = await analyzePartWithLLM(part, imageUrl)
          
          // 특징 정보 저장
          const savedCharacteristics = await savePartCharacteristics(
            part.part.part_num,
            setNum,
            part.color.id,
            llmAnalysis
          )
          
          // CLIP 임베딩 생성 및 저장 (WebP 우선 사용)
          const embedding = await generateClipEmbedding(imageUrl)
          await saveClipEmbedding(
            part.part.part_num,
            setNum,
            part.color.id,
            embedding
          )
          
          results.push({
            part_num: part.part.part_num,
            color_id: part.color.id,
            status: 'completed',
            characteristics: savedCharacteristics
          })
          
          // API 호출 제한을 위한 지연
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (partError) {
          console.error(`Failed to analyze part ${part.part.part_num}:`, partError)
          errors.push({
            part_num: part.part.part_num,
            color_id: part.color.id,
            error: partError.message
          })
        }
      }

      return { results, errors }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      analyzing.value = false
    }
  }

  // 우선순위 계산 (자주 보이는 부품 우선)
  const calculateDetectionPriority = (part) => {
    let priority = 1.0
    
    // 수량이 많은 부품 우선
    if (part.quantity > 5) priority += 0.3
    else if (part.quantity > 2) priority += 0.2
    
    // 기본 부품 우선 (브릭, 플레이트 등)
    const basicParts = ['brick', 'plate', 'tile']
    const partName = part.part.name.toLowerCase()
    if (basicParts.some(basic => partName.includes(basic))) {
      priority += 0.2
    }
    
    // 색상별 우선순위 (밝은 색상 우선)
    const brightColors = ['white', 'yellow', 'red', 'blue']
    if (brightColors.includes(part.color.name.toLowerCase())) {
      priority += 0.1
    }
    
    return Math.min(priority, 2.0) // 최대 2.0
  }

  // 부품별 우선순위 업데이트
  const updateDetectionPriorities = async (setNum, setParts) => {
    try {
      const updates = setParts.map(part => ({
        part_num: part.part.part_num,
        set_num: setNum,
        color_id: part.color.id,
        detection_priority: calculateDetectionPriority(part)
      }))

      for (const update of updates) {
        await supabase
          .from('part_characteristics')
          .upsert(update, {
            onConflict: 'part_num,set_num,color_id'
          })
      }

      return updates
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  return {
    loading,
    error,
    analyzing,
    analyzePartWithLLM,
    savePartCharacteristics,
    saveClipEmbedding,
    getPartCharacteristics,
    getAnalysisStatus,
    analyzeSetParts,
    calculateDetectionPriority,
    updateDetectionPriorities
  }
}
