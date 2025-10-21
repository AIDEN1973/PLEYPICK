// 백그라운드 워커 서비스
// LLM 분석, 이미지 처리, CLIP 임베딩 생성 등 백그라운드 작업 처리

import express from 'express'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 포트 자동 할당 함수 (실제 포트 확인)
async function findAvailablePort(startPort = 3006, endPort = 3015) {
  const net = await import('net')
  
  for (let port = startPort; port <= endPort; port++) {
    try {
      await new Promise((resolve, reject) => {
        const server = net.default.createServer()
        
        server.listen(port, () => {
          server.close(() => {
            resolve(port)
          })
        })
        
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is in use`))
          } else {
            reject(err)
          }
        })
      })
      
      return port
    } catch (error) {
      if (port === endPort) {
        throw new Error(`No available ports found between ${startPort} and ${endPort}`)
      }
      continue
    }
  }
}

// 워커 포트 설정
let WORKER_PORT

// 서버 시작 함수
async function startWorkerServer() {
  try {
    // 포트 관리 시스템에서 포트 가져오기
    try {
      // 포트 설정 파일에서 읽기
      const portConfigPath = path.join(process.cwd(), '.port-config.json');
      if (fs.existsSync(portConfigPath)) {
        const portConfig = JSON.parse(fs.readFileSync(portConfigPath, 'utf8'));
        WORKER_PORT = portConfig.worker;
        console.log(`📄 포트 설정 파일에서 읽기: ${WORKER_PORT}`);
      } else {
        // 포트 설정 파일이 없으면 자동 할당
        WORKER_PORT = await findAvailablePort();
        console.log(`🔍 사용 가능한 포트 찾기: ${WORKER_PORT}`);
      }
    } catch (error) {
      console.error('❌ 포트 할당 실패:', error.message);
      WORKER_PORT = process.env.WORKER_PORT || 3020;
      console.log(`⚠️ 기본 포트 사용: ${WORKER_PORT}`);
    }
console.log('🔧 백그라운드 워커 서비스 시작...');
console.log(`⚙️ 워커 포트: ${WORKER_PORT}`);

    // Express 앱 생성
    const app = express()
    app.use(express.json())
    
    // CORS 설정
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
      } else {
        next()
      }
    })

    // Supabase 클라이언트
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
    )

    // OpenAI API 설정
    const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY
    const OPENAI_BASE_URL = process.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'

    // CLIP 임베딩 생성 함수
    async function generateClipEmbedding(text) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다')
    }

    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 768
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.data[0].embedding
  } catch (error) {
    console.error('CLIP 임베딩 생성 실패:', error)
    throw error
  }
}

// 임베딩 생성 워커
async function processEmbeddingQueue() {
  try {
    // 대기 중인 임베딩 작업 조회
    const { data: queueItems, error } = await supabase
      .from('v_embedding_status')
      .select('*')
      .eq('embedding_status', 'pending')
      .limit(10)

    if (error) {
      console.error('임베딩 큐 조회 실패:', error)
      return
    }

    if (!queueItems || queueItems.length === 0) {
      return
    }

    console.log(`🔄 ${queueItems.length}개 임베딩 작업 처리 시작...`)

    for (const item of queueItems) {
      try {
        // 상태를 처리 중으로 변경
        await supabase
          .from('parts_master_features')
          .update({ embedding_status: 'processing' })
          .eq('id', item.id)

        if (!item.feature_text) {
          console.log(`⚠️ Part ${item.part_id}: Feature text 없음, 건너뛰기`)
          await supabase
            .from('parts_master_features')
            .update({ embedding_status: 'failed' })
            .eq('id', item.id)
          continue
        }

        console.log(`🧠 Part ${item.part_id}: CLIP 임베딩 생성 중...`)
        
        // CLIP 임베딩 생성
        const embedding = await generateClipEmbedding(item.feature_text)
        
        // 데이터베이스에 저장
        const { error: updateError } = await supabase
          .from('parts_master_features')
          .update({
            clip_text_emb: embedding,
            embedding_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)

        if (updateError) {
          console.error(`❌ Part ${item.part_id}: DB 업데이트 실패`, updateError)
          await supabase
            .from('parts_master_features')
            .update({ embedding_status: 'failed' })
            .eq('id', item.id)
        } else {
          console.log(`✅ Part ${item.part_id}: CLIP 임베딩 생성 완료`)
        }

        // API 호출 제한을 위한 대기
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`❌ Part ${item.part_id}: 임베딩 생성 실패`, error)
        await supabase
          .from('parts_master_features')
          .update({ embedding_status: 'failed' })
          .eq('id', item.id)
      }
    }

  } catch (error) {
    console.error('임베딩 큐 처리 실패:', error)
  }
}

// 워커 상태 API
app.get('/api/worker/health', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    port: WORKER_PORT
  })
})

// 수동 임베딩 생성 API
app.post('/api/worker/generate-embedding', async (req, res) => {
  try {
    const { partId, featureText } = req.body
    
    if (!partId || !featureText) {
      return res.status(400).json({ error: 'partId와 featureText가 필요합니다' })
    }

    console.log(`🔄 수동 임베딩 생성: ${partId}`)
    
    const embedding = await generateClipEmbedding(featureText)
    
    res.json({
      success: true,
      partId,
      dimensions: embedding.length,
      embedding: embedding.slice(0, 10) // 처음 10개만 반환
    })

  } catch (error) {
    console.error('수동 임베딩 생성 실패:', error)
    res.status(500).json({ error: error.message })
  }
})

    // 서버 시작
    app.listen(WORKER_PORT, () => {
      console.log(`✅ 백그라운드 워커 서비스 준비 완료 (포트: ${WORKER_PORT})`)
      
      // 포트 정보를 파일에 저장 (프론트엔드에서 읽기 위해)
      const portInfo = {
        port: WORKER_PORT,
        timestamp: new Date().toISOString(),
        service: 'worker'
      }
      
      try {
        fs.writeFileSync('.worker-port.json', JSON.stringify(portInfo, null, 2))
        console.log(`📄 포트 정보 저장: .worker-port.json`)
      } catch (err) {
        console.warn('포트 정보 저장 실패:', err.message)
      }
    })

    // 주기적으로 임베딩 큐 처리 (30초마다)
    setInterval(processEmbeddingQueue, 30000)

    // 시작 시 한 번 실행
    processEmbeddingQueue()

  } catch (error) {
    console.error('❌ 워커 서버 시작 실패:', error)
    process.exit(1)
  }
}

// 워커 서버 시작
startWorkerServer()
