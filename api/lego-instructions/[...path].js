export default async function handler(req, res) {
  console.log(`[LEGO Instructions API] 요청 수신:`, {
    method: req.method,
    url: req.url,
    query: req.query,
    path: req.query.path
  })
  
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
    
    console.log(`[LEGO Instructions API] 경로 파싱:`, { path, pathString })
    
    if (!pathString) {
      console.error(`[LEGO Instructions API] 경로가 없음`)
      return res.status(400).json({ error: 'Path is required' })
    }
    
    const targetUrl = `https://www.lego.com/${pathString}`
    
    console.log(`📄 LEGO 설명서 프록시 요청: ${targetUrl}`)

    // 타임아웃 설정 (AbortController 사용)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.lego.com/'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        clearTimeout(timeoutId)
        console.error(`❌ LEGO 설명서 프록시 호출 실패: ${response.status} ${response.statusText}`)
        return res.status(response.status).json({
          error: `LEGO API Error: ${response.status} ${response.statusText}`
        })
      }

      const html = await response.text()
      
      // HTML이 너무 짧으면 에러 페이지일 가능성
      if (html.length < 1000) {
        console.warn(`⚠️ LEGO 설명서 프록시 응답이 너무 짧음 (${html.length}바이트)`)
        console.warn(`응답 샘플:`, html.substring(0, 500))
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=300')

      console.log(`✅ LEGO 설명서 프록시 성공: ${response.status}, HTML 길이: ${html.length}바이트`)
      
      // 응답 본문이 너무 짧으면 에러일 가능성
      if (html.length < 1000) {
        console.warn(`⚠️ 응답이 너무 짧음, 샘플:`, html.substring(0, 500))
      }
      
      return res.status(200).send(html)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.error('❌ LEGO 설명서 프록시 타임아웃')
        return res.status(504).json({
          error: 'Request timeout',
          details: 'LEGO.com 서버 응답 시간 초과'
        })
      }
      throw fetchError
    }

  } catch (error) {
    console.error('❌ LEGO 설명서 프록시 오류:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
}

