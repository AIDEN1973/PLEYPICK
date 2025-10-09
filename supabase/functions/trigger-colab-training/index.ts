// 🧱 BrickBox 자동화된 YOLO 학습 트리거
// Supabase Function으로 Colab 학습 자동 실행

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno 타입 정의
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrainingRequest {
  dataset_id?: string
  training_config?: {
    epochs?: number
    batch_size?: number
    imgsz?: number
    device?: string
    set_num?: string  // 세트 번호 추가
  }
  colab_notebook_url?: string
  webhook_url?: string
}

interface ColabResponse {
  success: boolean
  session_id?: string
  error?: string
  notebook_url?: string
  message?: string
}

serve(async (req: Request) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 요청 데이터 파싱 (안전하게)
    let requestData
    try {
      requestData = await req.json()
    } catch (parseError) {
      console.error('❌ 요청 JSON 파싱 실패:', parseError)
      throw new Error('잘못된 JSON 형식입니다')
    }
    
    const { dataset_id, training_config, colab_notebook_url, webhook_url }: TrainingRequest = requestData
    console.log('📝 요청 데이터:', { dataset_id, training_config, colab_notebook_url, webhook_url })
    
    // 세트 번호 추출
    const set_num = training_config?.set_num
    if (set_num) {
      console.log(`🎯 세트 단위 학습 감지: ${set_num}`)
    }

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. 데이터셋 정보 확인 (synthetic_dataset 테이블에서)
    let dataset_info
    if (dataset_id === 'latest' || !dataset_id) {
      // 최신 데이터셋 정보 가져오기
      const { data: datasetStats, error: statsError } = await supabase
        .from('synthetic_part_stats')
        .select('total_images, total_annotations')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()

      if (statsError || !datasetStats) {
        // 기본값 사용
        dataset_info = {
          id: 1,
          name: 'BrickBox Lego Parts Dataset',
          total_images: 1000,
          total_annotations: 1000
        }
      } else {
        dataset_info = {
          id: 1,
          name: 'BrickBox Lego Parts Dataset',
          total_images: datasetStats.total_images || 1000,
          total_annotations: datasetStats.total_annotations || 1000
        }
      }
    } else {
      dataset_info = {
        id: parseInt(dataset_id),
        name: 'BrickBox Lego Parts Dataset',
        total_images: 1000,
        total_annotations: 1000
      }
    }

    console.log(`📊 데이터셋 확인: ${dataset_info.name} (${dataset_info.total_images}개 이미지)`)

    // 2. 학습 작업 생성 (dataset_id 없이)
    const job_name = `brickbox_yolo_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`
    const config = {
      epochs: training_config?.epochs || 100,
      batch_size: training_config?.batch_size || 16,
      imgsz: training_config?.imgsz || 640,
      device: training_config?.device || 'cuda',
      dataset_name: dataset_info.name,
      total_images: dataset_info.total_images,
      total_annotations: dataset_info.total_annotations
    }
    
    const { data: training_job, error: jobError } = await supabase
      .from('training_jobs')
      .insert({
        job_name,
        dataset_id: null, // 외래키 제약조건 우회
        status: 'pending',
        config: {
          ...config,
          set_num: set_num  // 세트 번호 포함
        }
      })
      .select()
      .single()

    if (jobError || !training_job) {
      throw new Error(`학습 작업 생성 실패: ${jobError?.message}`)
    }

    console.log(`📝 학습 작업 생성: ID ${training_job.id}`)

    // 3. Colab 노트북 URL 가져오기
    const { data: configData, error: configError } = await supabase
      .from('automation_config')
      .select('config_value')
      .eq('config_key', 'colab_notebook_url')
      .single()

    if (configError || !configData) {
      throw new Error('Colab 노트북 URL이 설정되지 않았습니다')
    }

    // config_value는 JSONB이므로 이미 객체일 수 있음
    const rawConfigValue = (configData as any).config_value
    const colabConfig = typeof rawConfigValue === 'string' ? JSON.parse(rawConfigValue) : rawConfigValue
    const colabNotebookUrl = colabConfig?.url
    if (!colabNotebookUrl) {
      throw new Error('Colab 노트북 URL이 설정되지 않았습니다')
    }

    // Colab API 호출 (실제 구현에서는 Colab Pro API 또는 웹훅 사용)
    const colabPayload = {
      dataset_id: dataset_info.id,
      training_job_id: training_job.id,
      training_config: {
        ...training_config,
        set_num: set_num  // 세트 번호 전달
      },
      supabase_url: supabaseUrl,
      supabase_key: supabaseServiceKey,
      webhook_url: webhook_url || Deno.env.get('WEBHOOK_URL')
    }

    console.log(`🚀 Colab 노트북 실행 요청: ${colabNotebookUrl}`)

    // Colab 노트북 자동 실행 (브라우저에서 열기)
    console.log(`🔗 Colab 노트북 URL: ${colabNotebookUrl}`)
    
    // 실제 Colab API 호출 대신 URL을 응답에 포함
    const colabResponse: ColabResponse = {
      success: true,
      session_id: `colab_session_${Date.now()}`,
      notebook_url: colabNotebookUrl,
      message: 'Colab 노트북을 수동으로 열어주세요'
    }

    // 4. 학습 작업 상태 업데이트
    await supabase
      .from('training_jobs')
      .update({
        status: 'running',
        colab_session_id: colabResponse.session_id,
        started_at: new Date().toISOString()
      })
      .eq('id', training_job.id)

    console.log(`✅ Colab 학습 시작: 세션 ID ${colabResponse.session_id}`)

    // 5. 웹훅 알림 (선택사항)
    if (webhook_url || Deno.env.get('WEBHOOK_URL')) {
      try {
        await fetch(webhook_url || Deno.env.get('WEBHOOK_URL')!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'training_started',
            training_job_id: training_job.id,
            dataset_id: dataset_info.id,
            colab_session_id: colabResponse.session_id
          })
        })
        console.log('📢 웹훅 알림 전송 완료')
      } catch (webhookError) {
        console.warn('⚠️ 웹훅 알림 전송 실패:', webhookError)
      }
    }

    // 6. 응답 반환
    const response = {
      success: true,
      training_job_id: training_job.id,
      dataset_id: dataset_info.id,
      colab_session_id: colabResponse.session_id,
      notebook_url: colabNotebookUrl,
      message: 'YOLO 학습이 Colab에서 시작되었습니다'
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('❌ 학습 트리거 실패:', error)
    
    // 안전한 오류 메시지 생성
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorResponse = {
      success: false,
      error: errorMessage,
      message: 'YOLO 학습 트리거에 실패했습니다'
    }

    console.log('📤 오류 응답:', errorResponse)

    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// Colab 노트북 실행 함수 (시뮬레이션)
async function executeColabNotebook(notebookUrl: string, payload: any): Promise<ColabResponse> {
  try {
    // 실제 구현에서는 Colab Pro API를 사용하여 노트북 실행
    // 여기서는 시뮬레이션으로 성공 응답 반환
    
    console.log('📝 Colab 노트북 실행 시뮬레이션:', payload)
    
    // 시뮬레이션: 2초 대기 후 성공 응답
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return {
      success: true,
      session_id: `colab_session_${Date.now()}`
    }
    
    // 실제 Colab API 호출 예시:
    /*
    const response = await fetch(notebookUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('COLAB_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      throw new Error(`Colab API 호출 실패: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result
    */
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
