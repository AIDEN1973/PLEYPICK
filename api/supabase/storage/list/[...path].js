export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { path } = req.query
  const pathArray = Array.isArray(path) ? path : [path]
  const bucket = pathArray[0]
  const folderPath = pathArray.slice(1).join('/')
  
  if (!bucket) {
    return res.status(400).json({ error: 'Bucket name is required' })
  }
  
  try {
    console.log(`🔍 Supabase Storage 프록시 요청: ${bucket}/${folderPath}`)
    
    // Supabase Storage API 직접 호출
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseKey) {
      return res.status(500).json({ error: 'Supabase key not configured' })
    }
    
    const storageUrl = `${supabaseUrl}/storage/v1/object/list/${bucket}`
    const params = new URLSearchParams({
      prefix: folderPath,
      limit: '1000'
    })
    
    const response = await fetch(`${storageUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error(`❌ Supabase Storage API 오류: ${response.status}`)
      return res.status(response.status).json({ 
        error: `Storage API error: ${response.status}`,
        details: await response.text()
      })
    }
    
    const data = await response.json()
    console.log(`✅ Storage 목록 조회 성공: ${data.length}개 파일`)
    
    // CORS 헤더와 함께 데이터 반환
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(data)
    
  } catch (error) {
    console.error('❌ Supabase Storage 프록시 오류:', error)
    res.status(500).json({ 
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


