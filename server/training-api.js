import express from 'express'
import { spawn, exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import http from 'http'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
global.io = io

io.on('connection', (socket) => {
  console.log('🔌 socket connected', socket.id)
})

const PORT = process.env.TRAINING_API_PORT || 3002

// CORS 설정
app.use(cors())
app.use(express.json())

// Supabase 클라이언트
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE
)

// 활성 학습 프로세스 관리
const activeProcesses = new Map()

// 학습 시작 API
app.post('/api/training/start', async (req, res) => {
  try {
    const { datasetPath, config } = req.body
    
    // 입력 검증
    if (!datasetPath) {
      return res.status(400).json({ error: '데이터셋 경로가 필요합니다' })
    }
    
    // 데이터셋 경로 확인
    if (!fs.existsSync(datasetPath)) {
      return res.status(400).json({ error: '데이터셋 경로가 존재하지 않습니다' })
    }
    
    // 학습 작업 생성
    const { data: jobData, error: jobError } = await supabase
      .from('training_jobs')
      .insert({
        job_name: `web_ui_training_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`,
        status: 'pending',
        config: { ...config, dataset_path: datasetPath, training_type: 'web_ui_hybrid' },
        progress: {}
      })
      .select()
      .single()
    
    if (jobError) {
      throw new Error(`학습 작업 생성 실패: ${jobError.message}`)
    }
    
    // Python 스크립트 실행
    const scriptPath = path.join(__dirname, '..', 'scripts', 'hybrid_yolo_training_pipeline.py')
    const args = [
      datasetPath,
      '--epochs', config.epochs || 100,
      '--batch_size', config.batch_size || 16,
      '--imgsz', config.imgsz || 768,
      '--device', config.device || 'auto',
      '--job_id', jobData.id
    ]
    
    console.log(`🚀 학습 시작: python ${scriptPath} ${args.join(' ')}`)
    
    const trainingProcess = spawn('python', [scriptPath, ...args.map(String)], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    // 프로세스 ID 저장
    activeProcesses.set(jobData.id, {
      process: trainingProcess,
      jobId: jobData.id,
      startTime: new Date(),
      config: config
    })
    
    // 실시간 로그 처리
    trainingProcess.stdout.on('data', (data) => {
      const log = data.toString()
      console.log(`[학습 로그] ${log}`)
      
      // WebSocket으로 실시간 전송
      if (global.io) {
        global.io.emit('training_log', {
          jobId: jobData.id,
          log: log,
          timestamp: new Date().toISOString()
        })
      }
      
      // 진행률 파싱
      const progressMatch = log.match(/epoch\s+(\d+)\/(\d+)/i)
      if (progressMatch) {
        const currentEpoch = parseInt(progressMatch[1])
        const totalEpochs = parseInt(progressMatch[2])
        const progress = (currentEpoch / totalEpochs) * 100
        
        // Supabase 진행률 업데이트
        supabase
          .from('training_jobs')
          .update({
            progress: {
              current_epoch: currentEpoch,
              total_epochs: totalEpochs,
              progress_percent: progress
            }
          })
          .eq('id', jobData.id)
          .then(() => {
            if (global.io) {
              global.io.emit('training_progress', {
                jobId: jobData.id,
                progress: progress,
                currentEpoch: currentEpoch,
                totalEpochs: totalEpochs
              })
            }
          })
      }
    })
    
    trainingProcess.stderr.on('data', async (data) => {
      const error = data.toString()
      console.error(`[학습 오류] ${error}`)
      
      // 오류 메시지를 training_jobs.error_message에 누적 저장
      try {
        const { data: jobRow } = await supabase
          .from('training_jobs')
          .select('error_message')
          .eq('id', jobData.id)
          .single()
        const prev = jobRow?.error_message || ''
        await supabase
          .from('training_jobs')
          .update({ error_message: (prev ? `${prev}\n` : '') + error.trim() })
          .eq('id', jobData.id)
      } catch {}
      
      if (global.io) {
        global.io.emit('training_error', {
          jobId: jobData.id,
          error: error,
          timestamp: new Date().toISOString()
        })
      }
    })
    
    // 학습 완료 처리
    trainingProcess.on('close', async (code) => {
      console.log(`학습 프로세스 종료: 코드 ${code}`)
      
      const processInfo = activeProcesses.get(jobData.id)
      if (processInfo) {
        activeProcesses.delete(jobData.id)
      }
      
      if (code === 0) {
        // 성공
        await supabase
          .from('training_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobData.id)
        
        if (global.io) {
          global.io.emit('training_complete', {
            jobId: jobData.id,
            success: true,
            message: '학습이 성공적으로 완료되었습니다'
          })
        }
      } else {
        // 실패
        await supabase
          .from('training_jobs')
          .update({
            status: 'failed',
            error_message: `학습 프로세스가 코드 ${code}로 종료되었습니다`,
            completed_at: new Date().toISOString()
          })
          .eq('id', jobData.id)
        
        if (global.io) {
          global.io.emit('training_complete', {
            jobId: jobData.id,
            success: false,
            message: `학습이 실패했습니다 (코드: ${code})`
          })
        }
      }
    })
    
    // 학습 시작 상태 업데이트
    await supabase
      .from('training_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', jobData.id)
    
    res.json({
      success: true,
      jobId: jobData.id,
      message: '학습이 시작되었습니다'
    })
    
  } catch (error) {
    console.error('학습 시작 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 학습 중단 API
app.post('/api/training/stop/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    
    const processInfo = activeProcesses.get(jobId)
    if (!processInfo) {
      return res.status(404).json({ error: '활성 학습 프로세스를 찾을 수 없습니다' })
    }
    
    // 프로세스 종료
    processInfo.process.kill('SIGTERM')
    
    // 상태 업데이트
    await supabase
      .from('training_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    activeProcesses.delete(jobId)
    
    if (global.io) {
      global.io.emit('training_stopped', {
        jobId: jobId,
        message: '학습이 중단되었습니다'
      })
    }
    
    res.json({
      success: true,
      message: '학습이 중단되었습니다'
    })
    
  } catch (error) {
    console.error('학습 중단 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 학습 상태 확인 API
app.get('/api/training/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    
    const { data: jobData, error } = await supabase
      .from('training_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (error) {
      throw new Error(`학습 작업 조회 실패: ${error.message}`)
    }
    
    const isActive = activeProcesses.has(jobId)
    
    res.json({
      success: true,
      job: jobData,
      isActive: isActive
    })
    
  } catch (error) {
    console.error('학습 상태 확인 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 활성 학습 목록 API
app.get('/api/training/active', (req, res) => {
  const activeJobs = Array.from(activeProcesses.values()).map(process => ({
    jobId: process.jobId,
    startTime: process.startTime,
    config: process.config
  }))
  
  res.json({
    success: true,
    activeJobs: activeJobs
  })
})

// 학습 작업 목록 API
app.get('/api/training/jobs', async (req, res) => {
  try {
    const { data: jobs, error } = await supabase
      .from('training_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (error) {
      throw new Error(`학습 작업 목록 조회 실패: ${error.message}`)
    }
    
    res.json({
      success: true,
      jobs: jobs
    })
    
  } catch (error) {
    console.error('학습 작업 목록 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 서버 시작
server.listen(PORT, () => {
  console.log(`🚀 학습 API 서버 시작: http://localhost:${PORT}`)
})

// WebSocket 설정 (이미 위에서 초기화됨)

export default app
