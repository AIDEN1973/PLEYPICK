// OpenAI Embeddings API 프록시
// CLIP 임베딩 생성을 위한 OpenAI API 프록시

import dotenv from 'dotenv'
dotenv.config()

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    })
  }

  try {
    console.log('🔗 OpenAI Embeddings API 프록시 호출됨:', {
      method: req.method,
      body: req.body,
      headers: req.headers
    })

    const { model, input, dimensions } = req.body

    // 입력값 검증
    if (!model || !input) {
      console.warn('❌ 필수 파라미터 누락:', { model: !!model, input: !!input })
      return res.status(400).json({ 
        success: false,
        error: 'model과 input이 필요합니다' 
      })
    }

    // OpenAI API 키 확인
    const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('❌ OpenAI API 키가 설정되지 않음')
      return res.status(500).json({ 
        success: false,
        error: 'OpenAI API 키가 설정되지 않았습니다' 
      })
    }

    console.log('📊 OpenAI Embeddings API 호출 시작:', { 
      model, 
      inputType: Array.isArray(input) ? 'array' : 'string',
      inputLength: Array.isArray(input) ? input.length : 1,
      dimensions 
    })

    // OpenAI API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'text-embedding-3-small',
        input: input,
        dimensions: dimensions || 768
      })
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('❌ OpenAI API 오류:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        error: errorText
      })
      return res.status(openaiResponse.status).json({ 
        success: false,
        error: `OpenAI API Error: ${openaiResponse.status}`,
        details: errorText
      })
    }

    const data = await openaiResponse.json()
    
    console.log('✅ OpenAI Embeddings API 성공:', {
      model: data.model,
      dataCount: data.data?.length || 0,
      usage: data.usage
    })

    // 응답 반환
    res.status(200).json(data)

  } catch (error) {
    console.error('❌ Embeddings API 프록시 오류:', error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
}
