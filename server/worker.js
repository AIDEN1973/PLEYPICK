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

// 고정 포트 3020 사용 (근본 문제 해결)
const WORKER_PORT = 3020;
console.log(`🔒 고정 포트 사용: ${WORKER_PORT}`);

// 서버 시작 함수
async function startWorkerServer() {
  try {
    // 포트 사용 가능 여부 확인 및 기존 프로세스 종료
    if (!(await findAvailablePort(WORKER_PORT, WORKER_PORT))) {
      console.warn(`⚠️ 포트 ${WORKER_PORT}이 사용 중입니다. 기존 프로세스를 종료합니다.`);
      
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const { stdout } = await execAsync(`netstat -ano | findstr ":${WORKER_PORT}"`);
        const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[4];
            if (pid && pid !== '0') {
              console.log(`🔪 프로세스 종료: PID ${pid}`);
              await execAsync(`taskkill /F /PID ${pid}`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      } catch (killError) {
        console.warn('기존 프로세스 종료 실패:', killError.message);
      }
    }
console.log('🔧 백그라운드 워커 서비스 시작...');
console.log(`⚙️ 워커 포트: ${WORKER_PORT}`);

    // Express 앱 생성
    const app = express()
    app.use(express.json())
    
    // Health check 엔드포인트
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'Worker',
        port: process.env.WORKER_PORT || 3020,
        timestamp: new Date().toISOString()
      })
    })
    
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
    const supabaseUrl = process.env.SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
    const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 임베딩 서비스 설정
const EMBEDDING_PROVIDER = 'clip' // 🔧 수정됨: CLIP 서비스 사용 (최신 torch + transformers로 해결)
// 🔧 수정됨: CLIP 서비스 기본 포트를 3021로 고정 (3022는 Semantic Vector API)
const CLIP_SERVICE_URL = process.env.CLIP_SERVICE_URL || 'http://localhost:3021'
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY
const OPENAI_BASE_URL = process.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'

    // CLIP 임베딩 생성 함수 (통합)
    async function generateClipEmbedding(text) {
      try {
        if (EMBEDDING_PROVIDER === 'clip') {
          // CLIP 서비스 사용
          const response = await fetch(`${CLIP_SERVICE_URL}/v1/embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              input: text,
              model: 'clip-vit-l/14',
              dimensions: 768
            })
          })

          if (!response.ok) {
            throw new Error(`CLIP 서비스 오류: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()
          const emb = data?.data?.[0]?.embedding || []

          // 제로 벡터/빈 벡터 방지
          const norm = Array.isArray(emb) ? Math.sqrt(emb.reduce((s, v) => s + v * v, 0)) : 0
          if (!Array.isArray(emb) || emb.length === 0 || norm === 0) {
            throw new Error('CLIP embedding is zero or empty')
          }

          console.log(`✅ CLIP embedding generated: ${emb.length}D, norm=${norm.toFixed(4)}`)
          return emb
        }

        // 🔧 수정됨: OpenAI 폴백 제거 (강제 실패)
        throw new Error('EMBEDDING_PROVIDER는 clip만 허용됩니다')
      } catch (error) {
        console.error('임베딩 생성 실패:', error)
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
        
        // 🔧 제로벡터 최종 검증 (이중 체크)
        const finalNorm = Array.isArray(embedding) ? Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) : 0
        if (!Array.isArray(embedding) || embedding.length === 0 || finalNorm === 0) {
          throw new Error('제로벡터 감지: 임베딩 생성 실패')
        }
        
        console.log(`✅ Part ${item.part_id}: 임베딩 검증 완료 (norm=${finalNorm.toFixed(4)})`)
        
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
        console.error(`❌ Part ${item.part_id}: 임베딩 생성 실패`, error) // 🔧 수정됨
        // 실패 시 제로/빈 벡터 저장 금지, 상태만 failed로 표시
        await supabase // 🔧 수정됨
          .from('parts_master_features') // 🔧 수정됨
          .update({ embedding_status: 'failed', updated_at: new Date().toISOString() }) // 🔧 수정됨
          .eq('id', item.id) // 🔧 수정됨
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
