export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed' 
    })
  }

  try {
    const { jobId } = req.query

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'jobId is required'
      })
    }

    // 캐시 방지 헤더
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')

    // 실제 구현에서는 데이터베이스에서 작업 상태 조회
    // 현재는 시뮬레이션
    const progress = Math.min(100, Math.floor(Math.random() * 100))
    const status = progress < 100 ? 'running' : 'completed'

    res.json({
      success: true,
      progress,
      status,
      logs: [
        {
          timestamp: new Date().toISOString(),
          message: `렌더링 진행 중... ${progress}%`,
          type: 'info'
        }
      ]
    })

  } catch (error) {
    console.error('진행 상황 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
