#!/usr/bin/env node
/**
 * 🧠 BrickBox 학습 실행 서버
 * 프론트엔드에서 직접 학습을 실행할 수 있는 API 서버
 */

import express from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// CORS 설정
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

app.use(express.json())

// Supabase 클라이언트 (Service Role Key 사용)
const supabase = createClient(
  'https://npferbxuxocbfnfbpcnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
)

// 실행 중인 학습 프로세스 관리
const runningProcesses = new Map()

// 서버 시작 시 중단된 학습 작업 복구
async function recoverInterruptedTrainings() {
  try {
    console.log('🔄 중단된 학습 작업 복구 중...')
    
    // running/training 상태의 작업들 조회
    const { data: interruptedJobs, error } = await supabase
      .from('training_jobs')
      .select('id, job_name, status, config, created_at')
      .in('status', ['running', 'training'])
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ 중단된 학습 작업 조회 실패:', error)
      return
    }
    
    if (!interruptedJobs || interruptedJobs.length === 0) {
      console.log('✅ 복구할 중단된 학습 작업이 없습니다.')
      return
    }
    
    console.log(`🔍 ${interruptedJobs.length}개의 중단된 학습 작업 발견`)
    
    for (const job of interruptedJobs) {
      try {
        // 작업 상태를 failed로 업데이트
        const { error: updateError } = await supabase
          .from('training_jobs')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
            error_message: '서버 재시작으로 인한 학습 중단'
          })
          .eq('id', job.id)
        
        if (updateError) {
          console.error(`❌ 작업 ${job.id} 상태 업데이트 실패:`, updateError)
        } else {
          console.log(`✅ 작업 ${job.id} (${job.job_name}) 상태를 failed로 업데이트`)
        }
      } catch (err) {
        console.error(`❌ 작업 ${job.id} 복구 실패:`, err)
      }
    }
    
    console.log('🔄 중단된 학습 작업 복구 완료')
  } catch (error) {
    console.error('❌ 학습 작업 복구 중 오류:', error)
  }
}

// 학습 실행 API
app.post('/api/training/execute', async (req, res) => {
  try {
    const { 
      partId, 
      modelStage = 'stage1', 
      epochs = 50, 
      batchSize = 16, 
      imageSize = 640,
      device = 'cuda'
    } = req.body

    console.log(`🚀 학습 실행 요청: 부품 ${partId}, 단계 ${modelStage}`)

    // 학습 작업 생성
    const { data: trainingJob, error: jobError } = await supabase
      .from('training_jobs')
      .insert({
        job_name: `training_${partId}_${modelStage}_${Date.now()}`,
        status: 'pending',
        config: {
          partId,
          modelStage,
          epochs,
          batchSize,
          imageSize,
          device
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) {
      throw new Error(`학습 작업 생성 실패: ${jobError.message}`)
    }

    // parts_master에서 엘리먼트 ID 조회
    let elementId = partId
    try {
      const { data: partData } = await supabase
        .from('parts_master')
        .select('element_id')
        .eq('part_id', partId)
        .limit(1)
      
      if (partData && partData.length > 0) {
        elementId = partData[0].element_id
        console.log(`🔄 부품 ID ${partId} → 엘리먼트 ID ${elementId} 매핑됨`)
      }
    } catch (error) {
      console.warn('⚠️ 엘리먼트 ID 조회 실패, 부품 ID 사용:', error.message)
    }

            // 학습 스크립트 실행 (Python 3.11 사용)
            const scriptPath = path.join(__dirname, '..', 'scripts', 'local_yolo_training.py')
            const args = [
              '--part_id', elementId, // 엘리먼트 ID 사용
              '--model_stage', modelStage,
              '--epochs', epochs.toString(),
              '--batch_size', batchSize.toString(),
              '--imgsz', imageSize.toString(),
              '--device', device,
              '--job_id', trainingJob.id.toString()
            ]

            console.log(`📝 실행 명령: py -3.11 ${scriptPath} ${args.join(' ')}`)

            // Python 3.11 프로세스 시작 (GPU 가속 지원)
            const pythonProcess = spawn('py', ['-3.11', scriptPath, ...args], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // 프로세스 ID 저장
    runningProcesses.set(trainingJob.id, {
      process: pythonProcess,
      startTime: new Date(),
      partId,
      modelStage
    })

    // 학습 상태를 'training'으로 업데이트
    await supabase
      .from('training_jobs')
      .update({ 
        status: 'training',
        started_at: new Date().toISOString()
      })
      .eq('id', trainingJob.id)

    // 프로세스 출력 처리
    pythonProcess.stdout.on('data', async (data) => {
      const output = data.toString()
      console.log(`[학습 ${trainingJob.id}] ${output}`)
      
      // 메트릭 파싱 및 저장
      await parseAndSaveMetrics(trainingJob.id, output)
    })

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString()
      console.error(`[학습 ${trainingJob.id} 오류] ${error}`)
    })

    pythonProcess.on('close', async (code) => {
      console.log(`[학습 ${trainingJob.id}] 프로세스 종료, 코드: ${code}`)
      
      // 프로세스 제거
      runningProcesses.delete(trainingJob.id)
      
      // 학습 상태 업데이트
      const finalStatus = code === 0 ? 'completed' : 'failed'
      await supabase
        .from('training_jobs')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', trainingJob.id)
    })

    pythonProcess.on('error', async (error) => {
      console.error(`[학습 ${trainingJob.id}] 프로세스 오류:`, error)
      
      // 프로세스 제거
      runningProcesses.delete(trainingJob.id)
      
      // 학습 상태를 'failed'로 업데이트
      await supabase
        .from('training_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', trainingJob.id)
    })

    res.json({
      success: true,
      jobId: trainingJob.id,
      message: '학습이 시작되었습니다',
      processId: pythonProcess.pid
    })

  } catch (error) {
    console.error('❌ 학습 실행 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 학습 중지 API
app.post('/api/training/stop/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const processInfo = runningProcesses.get(parseInt(jobId))

    if (!processInfo) {
      return res.status(404).json({
        success: false,
        error: '실행 중인 학습을 찾을 수 없습니다'
      })
    }

    // 프로세스 종료
    processInfo.process.kill('SIGTERM')
    runningProcesses.delete(parseInt(jobId))

    // 상태 업데이트
    await supabase
      .from('training_jobs')
      .update({
        status: 'stopped',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    res.json({
      success: true,
      message: '학습이 중지되었습니다'
    })

  } catch (error) {
    console.error('❌ 학습 중지 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 실행 중인 학습 목록 API
app.get('/api/training/running', (req, res) => {
  const runningList = Array.from(runningProcesses.entries()).map(([jobId, info]) => ({
    jobId,
    partId: info.partId,
    modelStage: info.modelStage,
    startTime: info.startTime,
    pid: info.process.pid
  }))

  res.json({
    success: true,
    running: runningList
  })
})

// 메트릭 파싱 및 저장 함수
async function parseAndSaveMetrics(jobId, output) {
  try {
    // YOLO 학습 출력에서 메트릭 추출
    const metrics = {}
    
    // Box Loss 추출
    const boxLossMatch = output.match(/box_loss[:\s]+([\d.]+)/i)
    if (boxLossMatch) {
      metrics.box_loss = parseFloat(boxLossMatch[1])
    }

    // Seg Loss 추출
    const segLossMatch = output.match(/seg_loss[:\s]+([\d.]+)/i)
    if (segLossMatch) {
      metrics.seg_loss = parseFloat(segLossMatch[1])
    }

    // Cls Loss 추출
    const clsLossMatch = output.match(/cls_loss[:\s]+([\d.]+)/i)
    if (clsLossMatch) {
      metrics.cls_loss = parseFloat(clsLossMatch[1])
    }

    // DFL Loss 추출
    const dflLossMatch = output.match(/dfl_loss[:\s]+([\d.]+)/i)
    if (dflLossMatch) {
      metrics.dfl_loss = parseFloat(dflLossMatch[1])
    }

    // mAP50 추출
    const map50Match = output.match(/mAP50[:\s]+([\d.]+)/i)
    if (map50Match) {
      metrics.map50 = parseFloat(map50Match[1])
    }

    // mAP50-95 추출
    const map50_95Match = output.match(/mAP50-95[:\s]+([\d.]+)/i)
    if (map50_95Match) {
      metrics.map50_95 = parseFloat(map50_95Match[1])
    }

    // 에폭 정보 추출
    const epochMatch = output.match(/(\d+)\/(\d+)/)
    if (epochMatch) {
      metrics.current_epoch = parseInt(epochMatch[1])
      metrics.total_epochs = parseInt(epochMatch[2])
    }

    // 메트릭이 있으면 저장
    if (Object.keys(metrics).length > 0) {
      await supabase
        .from('training_metrics')
        .insert({
          job_id: jobId,
          ...metrics,
          created_at: new Date().toISOString()
        })

      // 학습 작업의 진행률 업데이트
      if (metrics.current_epoch && metrics.total_epochs) {
        const progress = Math.round((metrics.current_epoch / metrics.total_epochs) * 100)
        await supabase
          .from('training_jobs')
          .update({
            progress: progress,
            current_epoch: metrics.current_epoch
          })
          .eq('id', jobId)
      }
    }

  } catch (error) {
    console.error('메트릭 파싱 실패:', error)
  }
}

// 서버 시작
const PORT = process.env.TRAINING_EXECUTOR_PORT || 3012

app.listen(PORT, async () => {
  console.log(`🧠 BrickBox 학습 실행 서버가 포트 ${PORT}에서 실행 중입니다`)
  console.log(`📡 API 엔드포인트: http://localhost:${PORT}/api/training/`)
  
  // 서버 시작 시 중단된 학습 작업 복구
  await recoverInterruptedTrainings()
})

// 프로세스 종료 시 실행 중인 학습들 정리
process.on('SIGINT', () => {
  console.log('\n🛑 서버 종료 중... 실행 중인 학습들을 정리합니다.')
  
  for (const [jobId, processInfo] of runningProcesses) {
    console.log(`학습 ${jobId} 종료 중...`)
    processInfo.process.kill('SIGTERM')
  }
  
  process.exit(0)
})

export default app
