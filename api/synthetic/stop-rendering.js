export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed' 
    })
  }

  try {
    const { jobId } = req.body

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'jobId is required'
      })
    }

    // 실제 구현에서는 데이터베이스에서 작업 중지
    console.log('🛑 렌더링 중지 요청:', jobId)

    res.json({
      success: true,
      message: '렌더링이 중지되었습니다',
      jobId
    })

  } catch (error) {
    console.error('렌더링 중지 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
