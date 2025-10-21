// Vercel Serverless Function for Progress Tracking
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { jobId } = req.query
    
    if (!jobId) {
      return res.status(400).json({ 
        success: false, 
        error: 'jobId is required' 
      })
    }
    
    // Vercel에서는 프로세스 상태 추적 불가
    // 대신 Supabase에서 작업 상태 조회
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
    
    // 작업 상태 조회 (예시)
    const { data, error } = await supabase
      .from('conversion_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single()
    
    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      })
    }
    
    return res.json({
      success: true,
      progress: data.progress || 0,
      status: data.status || 'unknown',
      logs: data.logs || []
    })
    
  } catch (error) {
    console.error('Progress tracking error:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
