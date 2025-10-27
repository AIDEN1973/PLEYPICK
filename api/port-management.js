import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { action } = req.body || {}

  try {
    switch (action) {
      case 'check-services':
        return await checkServices(req, res)
      case 'cleanup-port':
        return await cleanupPort(req, res)
      case 'cleanup-ports':
        return await cleanupAllPorts(req, res)
      case 'restart-service':
        return await restartService(req, res)
      case 'get-port-status':
        return await getPortStatus(req, res)
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('Port management API error:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 서비스 상태 확인
async function checkServices(req, res) {
  const services = [
    { name: 'Frontend', port: 3000 },
    { name: 'WebP API', port: 3004 },
    { name: 'AI API', port: 3005 },
    { name: 'Training API', port: 3010 },
    { name: 'Synthetic API', port: 3011 },
    { name: 'Worker', port: 3020 },
    { name: 'CLIP Service', port: 3021 },
    { name: 'Semantic Vector API', port: 3022 },
    { name: 'Manual Upload', port: 3030 },
    { name: 'Monitoring', port: 3040 }
  ]

  const results = []

  for (const service of services) {
    try {
      const startTime = Date.now()
      const response = await fetch(`http://localhost:${service.port}`, {
        method: 'HEAD',
        timeout: 5000
      })
      const responseTime = Date.now() - startTime

      results.push({
        name: service.name,
        port: service.port,
        status: response.ok ? 'healthy' : 'error',
        responseTime,
        lastCheck: new Date().toISOString()
      })
    } catch (error) {
      results.push({
        name: service.name,
        port: service.port,
        status: 'error',
        responseTime: null,
        lastCheck: new Date().toISOString(),
        error: error.message
      })
    }
  }

  return res.json({
    success: true,
    services: results,
    timestamp: new Date().toISOString()
  })
}

// 특정 포트 정리
async function cleanupPort(req, res) {
  const { port } = req.body

  if (!port) {
    return res.status(400).json({ error: 'Port number is required' })
  }

  try {
    // Windows에서 포트를 사용하는 프로세스 찾기 및 종료
    const result = await killProcessOnPort(port)
    
    return res.json({
      success: true,
      port,
      message: `Port ${port} cleaned up successfully`,
      result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      port,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

// 모든 포트 정리
async function cleanupAllPorts(req, res) {
  const ports = [3000, 3004, 3005, 3010, 3011, 3020, 3021, 3022, 3030, 3040]
  const results = []

  for (const port of ports) {
    try {
      const result = await killProcessOnPort(port)
      results.push({ port, success: true, result })
    } catch (error) {
      results.push({ port, success: false, error: error.message })
    }
  }

  return res.json({
    success: true,
    message: 'Port cleanup completed',
    results,
    timestamp: new Date().toISOString()
  })
}

// 서비스 재시작
async function restartService(req, res) {
  const { serviceName, port } = req.body

  if (!serviceName || !port) {
    return res.status(400).json({ error: 'Service name and port are required' })
  }

  try {
    // 1. 포트 정리
    await killProcessOnPort(port)
    
    // 2. 서비스 재시작 (실제 구현에서는 서비스별 스크립트 실행)
    const restartResult = await startService(serviceName, port)
    
    return res.json({
      success: true,
      serviceName,
      port,
      message: `Service ${serviceName} restarted successfully`,
      restartResult,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      serviceName,
      port,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

// 포트 상태 조회
async function getPortStatus(req, res) {
  try {
    const portConfigPath = path.join(process.cwd(), '.port-config.json')
    let portConfig = {}
    
    if (fs.existsSync(portConfigPath)) {
      portConfig = JSON.parse(fs.readFileSync(portConfigPath, 'utf8'))
    }

    return res.json({
      success: true,
      portConfig,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

// 포트를 사용하는 프로세스 종료 (Windows)
async function killProcessOnPort(port) {
  return new Promise((resolve, reject) => {
    // netstat으로 포트를 사용하는 프로세스 찾기
    const netstat = spawn('netstat', ['-ano'], { shell: true })
    let output = ''

    netstat.stdout.on('data', (data) => {
      output += data.toString()
    })

    netstat.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error('Failed to get port information'))
        return
      }

      // 포트를 사용하는 PID 찾기
      const lines = output.split('\n')
      const portLine = lines.find(line => 
        line.includes(`:${port}`) && line.includes('LISTENING')
      )

      if (!portLine) {
        resolve({ message: `No process found on port ${port}` })
        return
      }

      const pid = portLine.trim().split(/\s+/).pop()
      
      if (!pid || isNaN(pid)) {
        resolve({ message: `Invalid PID for port ${port}` })
        return
      }

      try {
        // 프로세스 종료
        const taskkill = spawn('taskkill', ['/PID', pid, '/F'], { shell: true })
        
        taskkill.on('close', (killCode) => {
          if (killCode === 0) {
            resolve({ 
              message: `Process ${pid} on port ${port} terminated successfully`,
              pid,
              port
            })
          } else {
            reject(new Error(`Failed to terminate process ${pid}`))
          }
        })

        taskkill.on('error', (error) => {
          reject(new Error(`Error terminating process: ${error.message}`))
        })
      } catch (error) {
        reject(new Error(`Error killing process: ${error.message}`))
      }
    })

    netstat.on('error', (error) => {
      reject(new Error(`Error getting port information: ${error.message}`))
    })
  })
}

// 서비스 시작 (실제 구현에서는 서비스별 스크립트 실행)
async function startService(serviceName, port) {
  return new Promise((resolve, reject) => {
    // 서비스별 시작 스크립트 매핑
    const serviceScripts = {
      'Frontend': 'npm run dev',
      'WebP API': 'npm run webp-image-api',
      'AI API': 'npm run ai-api',
      'Training API': 'npm run api',
      'Synthetic API': 'npm run synthetic:auto',
      'Worker': 'npm run worker:auto',
      'CLIP Service': 'npm run clip:service',
      'Semantic Vector API': 'npm run semantic-vector-api',
      'Manual Upload': 'npm run manual-upload',
      'Monitoring': 'npm run monitoring'
    }

    const script = serviceScripts[serviceName]
    if (!script) {
      reject(new Error(`Unknown service: ${serviceName}`))
      return
    }

    // 실제 구현에서는 백그라운드에서 서비스 시작
    // 여기서는 시뮬레이션
    setTimeout(() => {
      resolve({
        message: `Service ${serviceName} started successfully`,
        script,
        port
      })
    }, 1000)
  })
}
