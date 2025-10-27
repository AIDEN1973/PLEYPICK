// 이미지 프록시 API - CORS 우회용
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' })
  }

  try {
    console.log(`🔄 Proxying image request: ${url}`)
    
    // 외부 이미지 다운로드
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Failed to fetch image: ${response.status}` 
      })
    }

    // 이미지 데이터를 클라이언트로 전달
    const imageBuffer = await response.arrayBuffer()
    
    // Content-Type 설정
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600') // 1시간 캐시
    
    return res.status(200).send(Buffer.from(imageBuffer))

  } catch (error) {
    console.error(`❌ Proxy image error:`, error)
    return res.status(500).json({ 
      error: `Proxy failed: ${error.message}` 
    })
  }
}
