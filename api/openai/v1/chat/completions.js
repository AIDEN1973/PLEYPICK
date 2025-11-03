// OpenAI Chat Completions API 프록시
// LLM 분석을 위한 OpenAI API 프록시

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// 현재 파일의 디렉토리 경로 가져오기
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 프로젝트 루트의 .env 파일 로드
dotenv.config({ path: join(__dirname, '../../../.env') })

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
    console.log('🤖 OpenAI Chat Completions API 프록시 호출됨:', {
      method: req.method,
      body: req.body,
      headers: req.headers
    })

    const { model, messages, temperature, max_tokens, response_format } = req.body

    // 입력값 검증
    if (!model || !messages) {
      console.warn('❌ 필수 파라미터 누락:', { model: !!model, messages: !!messages })
      return res.status(400).json({ 
        success: false,
        error: 'model과 messages가 필요합니다' 
      })
    }

    // OpenAI API 키 확인 (환경변수만 허용) // 🔧 수정됨
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
    
    if (!apiKey) {
      console.error('❌ OpenAI API 키가 설정되지 않음')
      return res.status(500).json({ 
        success: false,
        error: 'OpenAI API 키가 설정되지 않았습니다' 
      })
    }

    console.log('📊 OpenAI Chat Completions API 호출 시작:', { 
      model, 
      messagesCount: messages?.length || 0,
      temperature,
      max_tokens,
      response_format
    })

    // OpenAI API 호출 (GPT-5 nano 직접 사용)
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_completion_tokens: max_tokens || 300,
        response_format: response_format
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
    
    console.log('✅ OpenAI Chat Completions API 성공:', {
      model: data.model,
      choicesCount: data.choices?.length || 0,
      usage: data.usage
    })

    // 응답 반환
    res.status(200).json(data)

  } catch (error) {
    console.error('❌ Chat Completions API 프록시 오류:', error)
    res.status(500).json({ 
      success: false,
      error: error.message
    })
  }
}