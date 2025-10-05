export default async function handler(req, res) {
  const { path } = req.query
  const imagePath = Array.isArray(path) ? path.join('/') : path
  
  try {
    const targetUrl = `https://cdn.rebrickable.com/media/${imagePath}`
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'BrickBox/1.0',
        'Accept': 'image/*',
        ...req.headers
      }
    })
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image not found' })
    }
    
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    // 이미지 데이터 스트리밍
    const buffer = await response.arrayBuffer()
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    
    res.status(200).send(Buffer.from(buffer))
    
  } catch (error) {
    console.error('Proxy error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
}
