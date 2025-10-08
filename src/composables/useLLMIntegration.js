import { ref } from 'vue'

export function useLLMIntegration() {
  const loading = ref(false)
  const error = ref(null)
  const analyzing = ref(false)

  // LLM API 설정
  const LLM_CONFIG = {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'your-openai-api-key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.1
  }

  // LLM API 호출 헬퍼
  const callLLM = async (messages, options = {}) => {
    try {
      const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || LLM_CONFIG.model,
          messages: messages,
          max_tokens: options.maxTokens || LLM_CONFIG.maxTokens,
          temperature: options.temperature || LLM_CONFIG.temperature
        })
      })

      if (!response.ok) {
        throw new Error(`LLM API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (err) {
      console.error('LLM API call failed:', err)
      throw err
    }
  }

  // 부품 후보 재랭킹
  const rerankPartCandidates = async (detectedImage, candidates, setContext) => {
    analyzing.value = true
    error.value = null

    try {
      const candidateDescriptions = candidates.map((candidate, index) => 
        `${index + 1}. ${candidate.part?.name || '알 수 없는 부품'} (${candidate.color?.name || '알 수 없는 색상'}) - ${candidate.llm_visual_features?.shape_description || '설명 없음'}`
      ).join('\n')

      const messages = [
        {
          role: 'system',
          content: `당신은 레고 부품 인식 전문가입니다. 
          촬영된 부품 이미지와 후보 부품들을 비교하여 가장 유사한 부품을 선택하고, 
          그 이유를 상세히 설명해주세요.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
세트: ${setContext}
촬영된 부품 이미지를 분석하여 다음 후보 중 가장 유사한 부품을 선택해주세요:

${candidateDescriptions}

다음 JSON 형식으로 응답해주세요:
{
  "best_match_index": 1,
  "confidence": 0.95,
  "reasoning": "선택한 이유를 상세히 설명",
  "visual_analysis": "이미지에서 관찰된 특징들",
  "matching_features": ["매칭된 특징들"],
  "rejected_features": ["제외된 특징들과 이유"]
}`
            },
            {
              type: 'image_url',
              image_url: {
                url: detectedImage,
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
          best_match_index: 0,
          confidence: 0.5,
          reasoning: 'LLM 분석 실패',
          visual_analysis: '분석 불가',
          matching_features: [],
          rejected_features: []
        }
      }

      // 결과 검증 및 후처리
      if (analysisResult.best_match_index >= 0 && analysisResult.best_match_index < candidates.length) {
        const bestMatch = candidates[analysisResult.best_match_index]
        return {
          bestMatch,
          confidence: analysisResult.confidence,
          reasoning: analysisResult.reasoning,
          visualAnalysis: analysisResult.visual_analysis,
          matchingFeatures: analysisResult.matching_features,
          rejectedFeatures: analysisResult.rejected_features,
          allCandidates: candidates
        }
      } else {
        throw new Error('Invalid best match index from LLM')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      analyzing.value = false
    }
  }

  // 부품 특징 상세 분석
  const analyzePartCharacteristics = async (partImage, partMetadata) => {
    analyzing.value = true
    error.value = null

    try {
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
- 부품명: ${partMetadata.name}
- 색상: ${partMetadata.color}
- 부품 번호: ${partMetadata.part_num}

다음 JSON 구조로 상세한 분석 결과를 제공해주세요:
{
  "visual_features": {
    "shape_description": "부품의 모양에 대한 상세 설명",
    "key_identifiers": ["주요 식별 특징들"],
    "distinguishing_marks": ["구별되는 마크나 로고"],
    "surface_details": "표면의 세부 특징",
    "color_analysis": {
      "primary_color": "주 색상",
      "color_consistency": "색상 일관성",
      "finish_type": "표면 마감 유형"
    }
  },
  "geometric_features": {
    "dimensions": "크기 정보",
    "shape_type": "형태 유형",
    "stud_count": "스터드 개수",
    "tube_count": "튜브 개수",
    "height": "높이",
    "symmetry": "대칭성"
  },
  "recognition_hints": {
    "top_view": "상단에서 본 모습",
    "side_view": "측면에서 본 모습", 
    "bottom_view": "하단에서 본 모습",
    "unique_features": ["고유한 특징들"],
    "common_confusions": ["혼동하기 쉬운 부품들"]
  },
  "confidence": 0.95
}`
            },
            {
              type: 'image_url',
              image_url: {
                url: partImage,
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
            shape_description: '분석 실패',
            key_identifiers: [],
            distinguishing_marks: [],
            surface_details: '분석 실패',
            color_analysis: {
              primary_color: partMetadata.color,
              color_consistency: 'unknown',
              finish_type: 'unknown'
            }
          },
          geometric_features: {
            dimensions: 'unknown',
            shape_type: 'unknown',
            stud_count: 0,
            tube_count: 0,
            height: 'unknown',
            symmetry: 'unknown'
          },
          recognition_hints: {
            top_view: '분석 실패',
            side_view: '분석 실패',
            bottom_view: '분석 실패',
            unique_features: [],
            common_confusions: []
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

  // 검수 가이드 생성
  const generateInspectionGuidance = async (detectedPart, issues) => {
    analyzing.value = true
    error.value = null

    try {
      const messages = [
        {
          role: 'system',
          content: `당신은 레고 부품 검수 전문가입니다. 
          검출된 문제점을 분석하여 사용자에게 구체적인 가이드를 제공해주세요.`
        },
        {
          role: 'user',
          content: `
검출된 부품에서 발견된 문제점들:
${issues.map(issue => `- ${issue}`).join('\n')}

다음 정보를 포함한 검수 가이드를 제공해주세요:
{
  "issue_analysis": "문제점 분석",
  "guidance_message": "사용자에게 전달할 메시지",
  "recommended_actions": ["권장 행동들"],
  "camera_adjustments": "카메라 조정 방법",
  "lighting_suggestions": "조명 개선 방법",
  "retake_priority": "재촬영 우선순위 (high/medium/low)"
}`
        }
      ]

      const llmResponse = await callLLM(messages)
      
      // JSON 파싱
      let guidanceResult
      try {
        guidanceResult = JSON.parse(llmResponse)
      } catch (parseError) {
        // JSON 파싱 실패 시 기본 가이드 반환
        guidanceResult = {
          issue_analysis: '분석 실패',
          guidance_message: '카메라 각도를 조정해주세요.',
          recommended_actions: ['카메라 각도 조정', '조명 개선'],
          camera_adjustments: '부품이 더 명확하게 보이도록 각도를 조정하세요.',
          lighting_suggestions: '반사광을 피하고 균일한 조명을 사용하세요.',
          retake_priority: 'medium'
        }
      }

      return guidanceResult
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      analyzing.value = false
    }
  }

  // 혼동 부품 분석
  const analyzeConfusionPairs = async (part1, part2, detectedImage) => {
    analyzing.value = true
    error.value = null

    try {
      const messages = [
        {
          role: 'system',
          content: `당신은 레고 부품 구별 전문가입니다. 
          혼동하기 쉬운 두 부품을 비교하여 구별 방법을 제공해주세요.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
혼동되는 부품 쌍:
1. ${part1.name} (${part1.color})
2. ${part2.name} (${part2.color})

촬영된 이미지를 분석하여 어떤 부품인지 구별해주세요:
{
  "identified_part": 1,
  "confidence": 0.95,
  "distinguishing_features": ["구별되는 특징들"],
  "comparison_analysis": "비교 분석",
  "visual_evidence": "시각적 증거",
  "recommendations": "개선 권장사항"
}`
            },
            {
              type: 'image_url',
              image_url: {
                url: detectedImage,
                detail: 'high'
              }
            }
          ]
        }
      ]

      const llmResponse = await callLLM(messages)
      
      // JSON 파싱
      let confusionResult
      try {
        confusionResult = JSON.parse(llmResponse)
      } catch (parseError) {
        confusionResult = {
          identified_part: 1,
          confidence: 0.5,
          distinguishing_features: ['분석 실패'],
          comparison_analysis: '분석 실패',
          visual_evidence: '분석 실패',
          recommendations: ['재촬영 권장']
        }
      }

      return confusionResult
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      analyzing.value = false
    }
  }

  // 배치 분석 (여러 부품 동시 처리)
  const batchAnalyzeParts = async (partsData) => {
    analyzing.value = true
    error.value = null

    try {
      const results = []
      const errors = []

      // 병렬 처리 (API 제한 고려하여 배치 크기 제한)
      const batchSize = 3
      for (let i = 0; i < partsData.length; i += batchSize) {
        const batch = partsData.slice(i, i + batchSize)
        
        const batchPromises = batch.map(async (partData) => {
          try {
            const analysis = await analyzePartCharacteristics(
              partData.image, 
              partData.metadata
            )
            return { partData, analysis, success: true }
          } catch (err) {
            return { partData, error: err.message, success: false }
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

        // API 제한을 위한 지연
        if (i + batchSize < partsData.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
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

  // LLM 응답 검증
  const validateLLMResponse = (response, expectedFields) => {
    const missingFields = expectedFields.filter(field => !response[field])
    return {
      isValid: missingFields.length === 0,
      missingFields,
      confidence: response.confidence || 0
    }
  }

  // 응답 후처리
  const postProcessResponse = (response) => {
    // 신뢰도 정규화
    if (response.confidence > 1.0) response.confidence = 1.0
    if (response.confidence < 0.0) response.confidence = 0.0

    // 텍스트 정리
    if (response.reasoning) {
      response.reasoning = response.reasoning.trim()
    }

    return response
  }

  return {
    loading,
    error,
    analyzing,
    rerankPartCandidates,
    analyzePartCharacteristics,
    generateInspectionGuidance,
    analyzeConfusionPairs,
    batchAnalyzeParts,
    validateLLMResponse,
    postProcessResponse
  }
}
