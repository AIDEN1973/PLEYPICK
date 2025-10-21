// Vercel Serverless Function for Source Count
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Vercel에서는 로컬 파일 시스템 접근 불가
    // 대신 Supabase에서 메타데이터 조회
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'Supabase configuration missing' 
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // synthetic_dataset 테이블에서 렌더링된 이미지 수 조회
    const { count, error } = await supabase
      .from('synthetic_dataset')
      .select('*', { count: 'exact', head: true })
      .not('image_url', 'is', null)
    
    if (error) {
      throw error
    }
    
    return res.json({ count: count || 0 })
    
  } catch (error) {
    console.error('Source count error:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
