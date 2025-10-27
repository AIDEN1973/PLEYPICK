#!/usr/bin/env node
/**
 * BrickBox 모니터링 API 서버
 * - 서비스 상태 모니터링
 * - 헬스체크 통합 관리
 * - 성능 메트릭 수집
 */

import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { resolve, join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

console.log('📊 BrickBox 모니터링 API 서버 시작')
console.log('='.repeat(50))

// 환경 변수 로드
// 고정 포트 3040 사용 (근본 문제 해결)
const PORT = 3040
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE

// Supabase 클라이언트 설정
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Express 앱 설정
const app = express()
app.use(cors())
app.use(express.json())

// 서비스 포트 설정
const SERVICES = {
  frontend: 3000,
  webpApi: 3004,
  aiApi: 3005,
  trainingApi: 3010,
  syntheticApi: 3011,
  trainingExecutor: 3012,
  worker: 3020,
  clipService: 3021,
  semanticVectorApi: 3022,
  manualUploadApi: 3030,
  monitoring: 3040,
  blenderApi: 5003
}

/**
 * 서비스 헬스체크 함수
 */
async function checkServiceHealth(serviceName, port) {
  try {
    const response = await fetch(`http://localhost:${port}`, {
      method: 'HEAD',
      timeout: 3000
    })
    
    return {
      name: serviceName,
      port,
      status: response.ok ? 'healthy' : 'unhealthy',
      statusCode: response.status,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      name: serviceName,
      port,
      status: 'unreachable',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 포트 바인딩 확인 (OS별 명령)
 */
async function isPortBound(port) {
  try {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? `netstat -an | findstr :${port}` : `lsof -i :${port}`
    const { stdout } = await execAsync(cmd)
    return stdout.trim().length > 0
  } catch (_e) {
    return false
  }
}

/**
 * HTTP 도달성 확인 (경로 지정)
 */
async function isHttpHealthy(port, path = '/') {
  try {
    const res = await fetch(`http://localhost:${port}${path}`, { method: 'GET' })
    return res.ok || res.status === 404
  } catch (_e) {
    return false
  }
}

/**
 * 모든 서비스 상태 확인
 */
async function getAllServicesStatus() {
  const healthChecks = await Promise.all(
    Object.entries(SERVICES).map(([name, port]) => 
      checkServiceHealth(name, port)
    )
  )
  
  const healthyCount = healthChecks.filter(h => h.status === 'healthy').length
  const totalCount = healthChecks.length
  
  return {
    overall: {
      status: healthyCount === totalCount ? 'all_healthy' : 'partial_failure',
      healthyServices: healthyCount,
      totalServices: totalCount,
      timestamp: new Date().toISOString()
    },
    services: healthChecks
  }
}

/**
 * 데이터베이스 연결 상태 확인
 */
async function checkDatabaseHealth() {
  try {
    const { data, error } = await supabase
      .from('parts_master')
      .select('count')
      .limit(1)
    
    if (error) throw error
    
    return {
      status: 'connected',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

// API 엔드포인트

/**
 * 기본 헬스체크
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'monitoring-api',
    timestamp: new Date().toISOString()
  })
})

/**
 * 모든 서비스 상태 조회
 */
app.get('/api/monitoring/services', async (req, res) => {
  try {
    const status = await getAllServicesStatus()
    res.json(status)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check services status',
      message: error.message
    })
  }
})

/**
 * 통합 포트 상태 (/api/port-status)
 * - 프론트엔드 PortManagement가 사용하는 간단화된 포맷으로 반환
 */
app.get('/api/port-status', async (req, res) => {
  try {
    // .port-config.json 우선 사용
    let runtimePorts = {}
    try {
      const configPath = join(process.cwd(), '.port-config.json')
      if (fs.existsSync(configPath)) {
        runtimePorts = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        console.log('🔍 로드된 포트 설정:', Object.keys(runtimePorts))
        console.log('🔍 trainingExecutor:', runtimePorts.trainingExecutor)
        console.log('🔍 blenderApi:', runtimePorts.blenderApi)
      }
    } catch (e) {
      console.error('❌ 포트 설정 로드 실패:', e.message)
    }

    const services = [
      { name: 'Frontend', port: runtimePorts.frontend || SERVICES.frontend, description: 'Vue.js 프론트엔드' },
      { name: 'WebP API', port: runtimePorts.webpImageApi || SERVICES.webpApi, description: 'WebP 이미지 API' },
      { name: 'AI API', port: runtimePorts.aiApi || SERVICES.aiApi, description: 'AI 추론 API' },
      { name: 'Training API', port: runtimePorts.trainingApi || SERVICES.trainingApi, description: 'AI 학습 API' },
      { name: 'Synthetic API', port: runtimePorts.syntheticApi || SERVICES.syntheticApi, description: '합성 데이터셋 API' },
      { name: 'Training Executor', port: runtimePorts.trainingExecutor || SERVICES.trainingExecutor, description: '학습 실행 서버' },
      { name: 'Worker', port: runtimePorts.worker || SERVICES.worker, description: '백그라운드 워커' },
      { name: 'CLIP Service', port: runtimePorts.clipService || SERVICES.clipService, description: 'CLIP 임베딩 서비스' },
      { name: 'Semantic Vector API', port: runtimePorts.semanticVectorApi || SERVICES.semanticVectorApi, description: 'Semantic Vector API' },
      { name: 'Manual Upload', port: runtimePorts.manualUploadApi || SERVICES.manualUploadApi, description: '수동 업로드 API' },
      { name: 'Monitoring', port: runtimePorts.monitoring || SERVICES.monitoring, description: '모니터링 대시보드' },
      { name: 'Blender API', port: runtimePorts.blenderApi || SERVICES.blenderApi, description: 'Blender 렌더링 API' }
    ]

    // 서비스 배열 필터링 제거 - 모든 서비스 포함
    console.log('🔍 전체 서비스 수:', services.length)
    console.log('🔍 서비스 목록:', services.map(s => s.name).join(', '))

    console.log('🔍 포트 상태 확인 서비스 목록:', services.map(s => `${s.name}:${s.port}`).join(', '))
    console.log('🔍 Training Executor 포트:', services.find(s => s.name === 'Training Executor')?.port)
    console.log('🔍 Blender API 포트:', services.find(s => s.name === 'Blender API')?.port)

    const checks = await Promise.all(services.map(async (svc) => {
      const start = Date.now()
      const bound = await isPortBound(svc.port)
      let httpOk = false
      if (bound) {
        // 서비스별 적절한 엔드포인트 설정
        let path = '/'
        if (svc.name === 'Semantic Vector API' || svc.name === 'Monitoring' || 
            svc.name === 'AI API' || svc.name === 'Training API' || 
            svc.name === 'Synthetic API' || svc.name === 'Worker' || 
            svc.name === 'Manual Upload' || svc.name === 'Blender API') {
          path = '/health'
        } else if (svc.name === 'Training Executor') {
          path = '/api/training/running'
        } else if (svc.name === 'CLIP Service') {
          path = '/'
        }
        
        httpOk = await isHttpHealthy(svc.port, path)
        console.log(`🔍 ${svc.name} (포트 ${svc.port}): 포트바인딩=${bound}, HTTP=${httpOk}, 경로=${path}`)
      } else {
        console.log(`❌ ${svc.name} (포트 ${svc.port}): 포트바인딩 실패`)
      }
      const ok = bound && httpOk
      return {
        name: svc.name,
        port: svc.port,
        description: svc.description,
        status: ok ? 'healthy' : 'error',
        responseTime: Date.now() - start,
        lastCheck: new Date().toLocaleTimeString(),
        portBound: bound,
        httpHealthy: httpOk
      }
    }))

    console.log('🔍 최종 체크 결과:', checks.length, '개 서비스')
    console.log('🔍 체크된 서비스:', checks.map(c => c.name).join(', '))
    
    // Training Executor와 Blender API가 포함되어 있는지 확인
    const trainingExecutor = checks.find(c => c.name === 'Training Executor')
    const blenderApi = checks.find(c => c.name === 'Blender API')
    console.log('🔍 Training Executor 체크 결과:', trainingExecutor ? `${trainingExecutor.name}:${trainingExecutor.status}` : '없음')
    console.log('🔍 Blender API 체크 결과:', blenderApi ? `${blenderApi.name}:${blenderApi.status}` : '없음')
    
    // 모든 서비스를 응답에 포함시키기 위해 필터링 제거
    const allServices = checks
    
    // 디버깅: 응답에 포함될 서비스 목록 확인
    console.log('🔍 응답에 포함될 서비스 수:', allServices.length)
    console.log('🔍 응답에 포함될 서비스:', allServices.map(s => s.name).join(', '))
    
    // Training Executor와 Blender API가 응답에 포함되어 있는지 최종 확인
    const responseTrainingExecutor = allServices.find(s => s.name === 'Training Executor')
    const responseBlenderApi = allServices.find(s => s.name === 'Blender API')
    console.log('🔍 응답 Training Executor:', responseTrainingExecutor ? `${responseTrainingExecutor.name}:${responseTrainingExecutor.status}` : '없음')
    console.log('🔍 응답 Blender API:', responseBlenderApi ? `${responseBlenderApi.name}:${responseBlenderApi.status}` : '없음')

    const healthy = allServices.filter(c => c.status === 'healthy').length
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: { total: allServices.length, healthy, failed: allServices.length - healthy },
      services: allServices
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * 데이터베이스 상태 조회
 */
app.get('/api/monitoring/database', async (req, res) => {
  try {
    const dbStatus = await checkDatabaseHealth()
    res.json(dbStatus)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check database status',
      message: error.message
    })
  }
})

/**
 * 통합 상태 대시보드
 */
app.get('/api/monitoring/dashboard', async (req, res) => {
  try {
    const [servicesStatus, dbStatus] = await Promise.all([
      getAllServicesStatus(),
      checkDatabaseHealth()
    ])
    
    res.json({
      timestamp: new Date().toISOString(),
      services: servicesStatus,
      database: dbStatus,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate dashboard',
      message: error.message
    })
  }
})

/**
 * 서비스별 상세 정보
 */
app.get('/api/monitoring/services/:serviceName', async (req, res) => {
  const { serviceName } = req.params
  const port = SERVICES[serviceName]
  
  if (!port) {
    return res.status(404).json({
      error: 'Service not found',
      availableServices: Object.keys(SERVICES)
    })
  }
  
  try {
    const status = await checkServiceHealth(serviceName, port)
    res.json(status)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check service status',
      message: error.message
    })
  }
})

/**
 * 포트 정보 저장
 */
const savePortInfo = () => {
  const portInfo = {
    port: PORT,
    timestamp: new Date().toISOString(),
    service: 'monitoring-api'
  }
  
  try {
    fs.writeFileSync(
      resolve(process.cwd(), '.monitoring-api-port.json'),
      JSON.stringify(portInfo, null, 2)
    )
    console.log('📝 포트 정보 저장: .monitoring-api-port.json')
  } catch (error) {
    console.warn('⚠️ 포트 정보 저장 실패:', error.message)
  }
}

// 서버 시작
app.listen(PORT, () => {
  console.log('🚀 모니터링 API 서버가 포트', PORT, '에서 실행 중입니다')
  console.log('📡 API 엔드포인트:')
  console.log('  - 헬스체크: http://localhost:' + PORT + '/health')
  console.log('  - 서비스 상태: http://localhost:' + PORT + '/api/monitoring/services')
  console.log('  - 데이터베이스 상태: http://localhost:' + PORT + '/api/monitoring/database')
  console.log('  - 통합 대시보드: http://localhost:' + PORT + '/api/monitoring/dashboard')
  
  savePortInfo()
  
  console.log('✅ 모니터링 API 서버 시작 완료')
})

// 에러 처리
process.on('uncaughtException', (error) => {
  console.error('❌ 예상치 못한 오류:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('❌ 처리되지 않은 Promise 거부:', reason)
  process.exit(1)
})

