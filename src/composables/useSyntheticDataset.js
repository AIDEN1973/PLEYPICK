import { ref } from 'vue'
import { useSupabase } from './useSupabase'

export function useSyntheticDataset() {
  const { supabase } = useSupabase()
  
  // 통계 데이터 조회
  const getStats = async () => {
    try {
      // 총 부품 수 조회
      const partsResult = await supabase
        .from('lego_parts')
        .select('part_num', { count: 'exact' })
      
      // 렌더링된 이미지 수 조회
      const imagesResult = await supabase
        .from('synthetic_dataset')
        .select('id', { count: 'exact' })
      
      // 저장소 사용량 조회 (간단한 추정)
      const storageResult = await supabase
        .storage
        .from('lego-synthetic')
        .list('synthetic', { limit: 1000 })
      
      const storageUsed = storageResult.data ? 
        `${(storageResult.data.length * 0.5).toFixed(1)} GB` : '0 GB'
      
      return {
        totalParts: partsResult.count || 0,
        renderedImages: imagesResult.count || 0,
        storageUsed,
        renderingStatus: '대기 중'
      }
    } catch (error) {
      console.error('통계 조회 실패:', error)
      return {
        totalParts: 0,
        renderedImages: 0,
        storageUsed: '0 GB',
        renderingStatus: '오류'
      }
    }
  }
  
  // 렌더링 시작
  const startRendering = async (config) => {
    try {
      console.log('렌더링 시작:', config)
      
      // 실제 렌더링 로직은 백엔드에서 처리
      // 여기서는 시뮬레이션
      const apiUrl = import.meta.env.DEV 
        ? '/api/synthetic/start-rendering'
        : 'https://brickbox.vercel.app/api/synthetic/start-rendering'
      
      console.log('🔗 API URL:', apiUrl)
      console.log('📤 Request config:', config)
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })
      
      console.log('📥 Response status:', response.status)
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API 오류:', response.status, errorText)
        throw new Error(`렌더링 시작 실패: ${response.status}`)
      }
      
      const responseText = await response.text()
      console.log('📥 Response text:', responseText)
      
      try {
        const jsonData = JSON.parse(responseText)
        console.log('✅ JSON 파싱 성공:', jsonData)
        return jsonData
      } catch (parseError) {
        console.error('❌ JSON 파싱 실패:', parseError)
        console.error('📥 Raw response:', responseText)
        throw new Error('JSON 파싱 실패')
      }
    } catch (error) {
      console.error('렌더링 시작 실패:', error)
      throw error
    }
  }
  
  // 렌더링 중지
  const stopRendering = async () => {
    try {
      const apiUrl = import.meta.env.DEV 
        ? '/api/synthetic/stop-rendering'
        : 'https://brickbox.vercel.app/api/synthetic/stop-rendering'
      
      const response = await fetch(apiUrl, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('렌더링 중지 실패')
      }
      
      return await response.json()
    } catch (error) {
      console.error('렌더링 중지 실패:', error)
      throw error
    }
  }
  
  // 렌더링 결과 조회
  const getRenderResults = async (limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('synthetic_dataset')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('렌더링 결과 조회 실패:', error)
      return []
    }
  }
  
  // Supabase에 업로드
  const uploadToSupabase = async (result) => {
    try {
      // 이미지 파일을 Supabase Storage에 업로드
      const fileName = `${result.partId}_${Date.now()}.png`
      const filePath = `synthetic/${result.partId}/${fileName}`
      
      // 실제 파일 업로드 로직은 백엔드에서 처리
      const { data, error } = await supabase
        .storage
        .from('lego-synthetic')
        .upload(filePath, result.imageFile)
      
      if (error) throw error
      
      // 메타데이터를 데이터베이스에 저장
      const { data: insertData, error: insertError } = await supabase
        .from('synthetic_dataset')
        .insert({
          part_id: result.partId,
          image_url: data.path,
          metadata: {
            color: result.colorName,
            angle: result.angle,
            resolution: result.resolution,
            render_quality: result.quality
          }
        })
      
      if (insertError) throw insertError
      
      return insertData
    } catch (error) {
      console.error('Supabase 업로드 실패:', error)
      throw error
    }
  }
  
  // 배치 작업 조회
  const getBatchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('synthetic_render_configs')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('배치 작업 조회 실패:', error)
      return []
    }
  }
  
  // 배치 작업 생성
  const createBatchJob = async (jobConfig) => {
    try {
      const { data, error } = await supabase
        .from('synthetic_render_configs')
        .insert({
          config_name: jobConfig.name,
          render_settings: jobConfig.settings,
          is_active: true
        })
      
      if (error) throw error
      
      return data
    } catch (error) {
      console.error('배치 작업 생성 실패:', error)
      throw error
    }
  }
  
  // 렌더링 진행 상황 조회
  const getRenderProgress = async (jobId) => {
    try {
      // 실제 구현에서는 WebSocket이나 Server-Sent Events 사용
      const apiUrl = import.meta.env.DEV 
        ? `/api/synthetic/progress/${jobId}`
        : `https://brickbox.vercel.app/api/synthetic/progress/${jobId}`
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        throw new Error('진행 상황 조회 실패')
      }
      
      return await response.json()
    } catch (error) {
      console.error('진행 상황 조회 실패:', error)
      return { progress: 0, status: 'error' }
    }
  }
  
  return {
    getStats,
    startRendering,
    stopRendering,
    getRenderResults,
    uploadToSupabase,
    getBatchJobs,
    createBatchJob,
    getRenderProgress
  }
}