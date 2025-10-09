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

// 헬퍼 함수들
async function checkRunningJobs(supabase: any): Promise<boolean> {
  const { data: runningJobs, error } = await supabase
    .from('training_jobs')
    .select('*')
    .in('status', ['pending', 'running'])
    .limit(1)
  
  if (error) {
    console.error('실행 중인 작업 조회 실패:', error)
    return false
  }
  
  return runningJobs && runningJobs.length > 0
}

async function getLastTrainingTime(supabase: any): Promise<string | null> {
  const { data: lastTraining, error } = await supabase
    .from('training_jobs')
    .select('completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !lastTraining) {
    return null
  }
  
  return lastTraining.completed_at
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 데이터 변경 감지
    const { data: newData, error: dataError } = await supabase
      .from('synthetic_dataset')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 최근 24시간
      .limit(100)

    if (dataError) {
      throw new Error(`데이터 조회 실패: ${dataError.message}`)
    }

    // 2. 학습 조건 확인 (대규모 시스템 최적화)
    const shouldTrain = newData && newData.length >= 1000 // 1000개 이상 새 데이터 (정밀 검수 시스템)
    const hasRunningJob = await checkRunningJobs(supabase)
    const lastTrainingTime = await getLastTrainingTime(supabase)
    const timeSinceLastTraining = lastTrainingTime ? 
      (Date.now() - new Date(lastTrainingTime).getTime()) / (1000 * 60 * 60) : 24 // 시간 단위
    
    const finalShouldTrain = shouldTrain && !hasRunningJob && timeSinceLastTraining >= 1
    
    console.log(`📊 새 데이터 개수: ${newData?.length || 0}`)
    console.log(`🎯 학습 조건: ${finalShouldTrain ? '충족' : '미충족'}`)
    console.log(`⏰ 마지막 학습: ${timeSinceLastTraining.toFixed(1)}시간 전`)
    console.log(`🔄 실행 중인 작업: ${hasRunningJob ? '있음' : '없음'}`)

    if (!finalShouldTrain) {
      return new Response(JSON.stringify({
        success: true,
        message: '학습 조건 미충족',
        new_data_count: newData?.length || 0,
        threshold: 1000
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. 실행 중인 작업 확인 (이미 위에서 처리됨)

    // 4. 자동 학습 작업 생성
    const trainingJob = {
      job_name: `auto_training_${new Date().toISOString().replace(/[:.]/g, '-')}`,
      dataset_id: null,
      status: 'pending',
      config: {
        epochs: 100,
        batch_size: 16,
        imgsz: 640,
        device: 'cuda',
        auto_triggered: true,
        new_data_count: newData.length
      },
      progress: {},
      error_message: null
    }

    const { data: jobData, error: jobError } = await supabase
      .from('training_jobs')
      .insert(trainingJob)
      .select()
      .single()

    if (jobError) {
      throw new Error(`학습 작업 생성 실패: ${jobError.message}`)
    }

    // 5. Colab 자동 실행
    const colabUrl = `https://colab.research.google.com/drive/1ApQY9JfoNOZ7zrpVdH9goduw3cJKDawn#scrollTo=njKo10PxFc48`
    
    // 6. 학습 작업 상태 업데이트
    await supabase
      .from('training_jobs')
      .update({
        status: 'running',
        colab_session_id: `auto_session_${Date.now()}`,
        started_at: new Date().toISOString()
      })
      .eq('id', jobData.id)

    // 7. 알림 전송 (선택사항)
    const { data: config } = await supabase
      .from('automation_config')
      .select('*')
      .eq('config_key', 'notification_webhook')
      .single()

    if (config?.config_value?.enabled) {
      // 웹훅 알림 전송
      try {
        await fetch(config.config_value.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '자동 학습이 시작되었습니다',
            job_id: jobData.id,
            new_data_count: newData.length,
            colab_url: colabUrl
          })
        })
      } catch (e) {
        console.log('알림 전송 실패:', e)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: '자동 학습이 시작되었습니다',
      job_id: jobData.id,
      new_data_count: newData.length,
      colab_url: colabUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('자동 학습 트리거 실패:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
