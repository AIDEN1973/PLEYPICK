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
    // 캐시 방지 헤더
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')

    // 실제 구현에서는 Supabase에서 통계 조회
    // 현재는 시뮬레이션 데이터
    const stats = {
      totalParts: 106,
      renderedImages: 0,
      storageUsed: '0 GB',
      renderingStatus: '대기 중'
    }

    res.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('통계 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
