export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 경로 파라미터 추출 (예: en-au/service/buildinginstructions/71813)
    const path = req.query.path || []
    const pathString = Array.isArray(path) ? path.join('/') : path
    
    if (!pathString) {
      return res.status(400).json({ error: 'Path is required' })
    }
    
    const targetUrl = `https://www.lego.com/${pathString}`
    
    console.log(`📄 LEGO 설명서 프록시 요청: ${targetUrl}`)

    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.lego.com/'
      },
      timeout: 10000
    })

    if (!response.ok) {
      console.error(`❌ LEGO 설명서 프록시 호출 실패: ${response.status} ${response.statusText}`)
      return res.status(response.status).json({
        error: `LEGO API Error: ${response.status} ${response.statusText}`
      })
    }

    const html = await response.text()

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')

    console.log(`✅ LEGO 설명서 프록시 성공: ${response.status}`)
    return res.status(200).send(html)

  } catch (error) {
    console.error('❌ LEGO 설명서 프록시 오류:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

