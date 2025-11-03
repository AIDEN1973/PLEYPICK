// AI 추론 API 엔드포인트 (Node.js 서버용)
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3005 // 고정 포트

// CORS 설정
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// JSON 파싱 미들웨어
app.use(express.json())

// Health check 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'AI API',
    port: PORT,
    timestamp: new Date().toISOString()
  })
})

// OpenAI API 프록시 엔드포인트
app.post('/api/openai/v1/chat/completions', async (req, res) => {
  try {
    console.log('🤖 OpenAI API 프록시 호출됨:', {
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

    console.log('📊 OpenAI API 호출 시작:', { 
      model, 
      messagesCount: messages?.length || 0,
      temperature,
      max_tokens,
      response_format
    })

    // OpenAI API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_completion_tokens: max_tokens || 4000, // 토큰 수 증가
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
    
    console.log('✅ OpenAI API 성공:', {
      model: data.model,
      choicesCount: data.choices?.length || 0,
      usage: data.usage
    })

    // 응답 반환
    res.status(200).json(data)

  } catch (error) {
    console.error('❌ OpenAI API 프록시 오류:', error)
    res.status(500).json({ 
      success: false,
      error: error.message
    })
  }
})

// OpenAI Embeddings API 프록시 엔드포인트
app.post('/api/openai/v1/embeddings', async (req, res) => {
  try {
    console.log('🔗 OpenAI Embeddings API 프록시 호출됨:', {
      method: req.method,
      body: req.body,
      headers: req.headers
    })

    const { model, input } = req.body

    // 입력값 검증
    if (!model || !input) {
      console.warn('❌ 필수 파라미터 누락:', { model: !!model, input: !!input })
      return res.status(400).json({ 
        success: false,
        error: 'model과 input이 필요합니다' 
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

    console.log('📊 OpenAI Embeddings API 호출 시작:', { 
      model, 
      inputType: Array.isArray(input) ? 'array' : typeof input,
      inputLength: Array.isArray(input) ? input.length : 1
    })

    // OpenAI API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        input: input
      })
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('❌ OpenAI Embeddings API 오류:', {
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
    console.error('❌ OpenAI Embeddings API 프록시 오류:', error)
    res.status(500).json({ 
      success: false,
      error: error.message
    })
  }
})

// AI 추론 엔드포인트
app.post('/api/ai/inference', async (req, res) => {
  try {
    console.log('🤖 AI 추론 API 호출됨:', {
      method: req.method,
      body: req.body,
      headers: req.headers
    })

    const { image_url, part_id } = req.body

    // 입력값 검증
    if (!image_url || !part_id) {
      console.warn('❌ 필수 파라미터 누락:', { image_url: !!image_url, part_id: !!part_id })
      return res.status(400).json({ 
        success: false,
        error: 'image_url과 part_id가 필요합니다' 
      })
    }

    console.log('📊 AI 추론 시작:', { image_url, part_id })

    // 실제 AI 추론 로직 (현재는 시뮬레이션)
    const startTime = Date.now()
    
    // 간단한 지연 시뮬레이션 (실제 AI 추론 시간)
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const processingTime = Date.now() - startTime

    // AI 추론 결과 시뮬레이션
    const inferenceResult = {
      accuracy: Math.random() * 0.2 + 0.8, // 0.8 ~ 1.0 사이의 정확도
      detected_parts: Math.floor(Math.random() * 3) + 1, // 1 ~ 3개 부품
      predictions: [
        {
          type: 'detection',
          class: 'lego_part',
          confidence: Math.random() * 0.2 + 0.8,
          bbox: [100, 100, 200, 200],
          part_id: part_id
        }
      ],
      processing_time: processingTime,
      model_version: '1.0.0',
      inference_method: 'simulation'
    }

    console.log('✅ AI 추론 완료:', {
      accuracy: inferenceResult.accuracy,
      detected_parts: inferenceResult.detected_parts,
      processing_time: inferenceResult.processing_time
    })

    return res.status(200).json({
      success: true,
      accuracy: inferenceResult.accuracy,
      detected_parts: inferenceResult.detected_parts,
      predictions: inferenceResult.predictions,
      processing_time: inferenceResult.processing_time,
      model_version: inferenceResult.model_version,
      inference_method: inferenceResult.inference_method
    })

  } catch (error) {
    console.error('❌ AI 추론 실패:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// 실제 사용 중인 모델 정보를 저장할 변수
let currentModel = null
let modelLoaded = false

// 모델 정보 업데이트 함수
async function updateModelInfo() {
  try {
    // OpenAI API 키 확인 (환경변수만 허용) // 🔧 수정됨
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
    
    if (!apiKey) {
      console.warn('⚠️ OpenAI API 키가 설정되지 않음')
      return
    }

    // 실제 API 호출로 모델 정보 확인
    const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1
      })
    })

    if (testResponse.ok) {
      const data = await testResponse.json()
      currentModel = data.model || 'gpt-4o-mini'
      modelLoaded = true
      console.log(`✅ 모델 정보 업데이트: ${currentModel}`)
    } else {
      console.warn('⚠️ 모델 정보 확인 실패')
      currentModel = 'gpt-4o-mini'
      modelLoaded = false
    }
  } catch (error) {
    console.warn('⚠️ 모델 정보 업데이트 오류:', error.message)
    currentModel = 'gpt-4o-mini'
    modelLoaded = false
  }
}

// 서버 시작 시 모델 정보 업데이트
updateModelInfo()

// 헬스 체크 엔드포인트
app.get('/api/ai/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    model_loaded: modelLoaded,
    method: currentModel || 'gpt-4o-mini'
  })
})

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'API 엔드포인트를 찾을 수 없습니다' 
  })
})

// 에러 핸들러
app.use((error, req, res, next) => {
  console.error('❌ 서버 에러:', error)
  res.status(500).json({ 
    success: false, 
    error: error.message 
  })
})

// PORT는 이미 6번째 줄에서 선언됨

app.listen(PORT, () => {
  console.log(`🚀 AI 추론 API 서버가 포트 ${PORT}에서 실행 중입니다`)
  console.log(`📡 API 엔드포인트: http://localhost:${PORT}/api/ai/inference`)
  console.log(`🏥 헬스 체크: http://localhost:${PORT}/api/ai/health`)
})

export default app