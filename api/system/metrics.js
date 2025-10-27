// 시스템 메트릭 수집 API
const os = require('os')

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 간단한 시스템 메트릭 반환
    const metrics = {
      cpu_usage: 0,
      memory_usage: 0,
      gpu_usage: 0,
      timestamp: new Date().toISOString()
    }
    
    return res.status(200).json(metrics)

  } catch (error) {
    console.error('시스템 메트릭 수집 실패:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}

