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
  
  // 🔧 수정됨: .single() 제거하여 빈 결과를 안전하게 처리
  if (error || !lastTraining || lastTraining.length === 0) {
    return null
  }
  
  return lastTraining[0].completed_at
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

    // 🔧 수정됨: 요청 본문에서 렌더링 완료 정보 확인
    const requestBody = await req.json().catch(() => ({}))
    const isRenderingComplete = !!(requestBody.job_id || requestBody.part_id || requestBody.set_num)
    
    // 🔧 수정됨: auto_training_enabled 설정 확인
    const { data: autoTrainingConfig, error: configError } = await supabase
      .from('automation_config')
      .select('config_value')
      .eq('config_key', 'auto_training_enabled')
      .eq('is_active', true)
      .maybeSingle() // 🔧 수정됨: .single() 대신 .maybeSingle() 사용하여 안전하게 처리
    
    // 🔧 수정됨: JSONB 타입 고려하여 문자열 또는 boolean 모두 처리
    const configValue = autoTrainingConfig?.config_value
    const autoTrainingEnabled = !configError && (
      configValue === 'true' || 
      configValue === true || 
      (typeof configValue === 'object' && configValue !== null && (configValue as any).value === true)
    )
    
    if (!autoTrainingEnabled && !isRenderingComplete) {
      return new Response(JSON.stringify({
        success: false,
        message: '자동 학습이 비활성화되어 있습니다',
        auto_training_enabled: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 🔧 수정됨: 렌더링 완료 모드가 아닐 때만 데이터 조회 (최적화)
    let newData: any[] | null = null
    if (!isRenderingComplete) {
      // 1. 데이터 변경 감지 (렌더링 완료 모드가 아닐 때만)
      const { data: fetchedData, error: dataError } = await supabase
        .from('synthetic_dataset')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 최근 24시간
        .limit(100)

      if (dataError) {
        throw new Error(`데이터 조회 실패: ${dataError.message}`)
      }
      
      newData = fetchedData
    }

    // 2. 학습 조건 확인
    const hasRunningJob = await checkRunningJobs(supabase)
    const lastTrainingTime = await getLastTrainingTime(supabase)
    const timeSinceLastTraining = lastTrainingTime ? 
      (Date.now() - new Date(lastTrainingTime).getTime()) / (1000 * 60 * 60) : 24 // 시간 단위
    
    // 🔧 수정됨: 렌더링 완료 시 즉시 실행, 아니면 기존 조건 확인
    let finalShouldTrain = false
    if (isRenderingComplete) {
      // 렌더링 완료 모드: 자동 학습 활성화되어 있으면 즉시 실행
      if (autoTrainingEnabled) {
        finalShouldTrain = !hasRunningJob && timeSinceLastTraining >= 0.1 // 최소 6분 간격
        console.log('🚀 렌더링 완료 트리거 모드: 즉시 학습 실행')
      } else {
        console.log('⏸️ 렌더링 완료되었으나 자동 학습이 비활성화되어 있어 학습을 시작하지 않습니다')
        finalShouldTrain = false
      }
    } else {
      // 일반 모드: 대규모 데이터 기준
      const shouldTrain = newData ? newData.length >= 1000 : false // 1000개 이상 새 데이터
      finalShouldTrain = shouldTrain && !hasRunningJob && timeSinceLastTraining >= 1
    }
    
    console.log(`📊 새 데이터 개수: ${newData?.length || 0}`)
    console.log(`🎯 학습 조건: ${finalShouldTrain ? '충족' : '미충족'}`)
    console.log(`⏰ 마지막 학습: ${timeSinceLastTraining.toFixed(1)}시간 전`)
    console.log(`🔄 실행 중인 작업: ${hasRunningJob ? '있음' : '없음'}`)
    console.log(`🤖 자동 학습 활성화: ${autoTrainingEnabled}`)
    console.log(`🎨 렌더링 완료 모드: ${isRenderingComplete}`)

    if (!finalShouldTrain) {
      // 🔧 수정됨: 렌더링 완료 모드별 메시지 구분
      let message = '학습 조건 미충족'
      if (isRenderingComplete) {
        if (!autoTrainingEnabled) {
          message = '렌더링 완료되었으나 자동 학습이 비활성화되어 있어 학습을 시작하지 않습니다'
        } else {
          message = '학습 조건 미충족 (실행 중인 작업 있음 또는 최근 학습됨)'
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: message,
        new_data_count: newData?.length || 0,
        threshold: isRenderingComplete ? '즉시 실행 (조건 완화)' : 1000,
        auto_training_enabled: autoTrainingEnabled,
        rendering_complete: isRenderingComplete
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
        new_data_count: newData?.length || 0,
        rendering_complete: isRenderingComplete,
        job_id: requestBody.job_id || null,
        part_id: requestBody.part_id || null,
        element_id: requestBody.element_id || null,
        set_num: requestBody.set_num || null,
        completed_parts: requestBody.completed_parts || null,
        failed_parts: requestBody.failed_parts || null
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

    // 🔧 수정됨: 실제 학습 실행 API 호출
    // 학습 실행 서버 URL 설정 (환경 변수 또는 기본값)
    const trainingServerUrl = Deno.env.get('TRAINING_EXECUTOR_URL') || 'http://localhost:3012'
    
    let trainingStarted = false
    let trainingError: string | null = null
    
    // 학습 실행 서버 호출 시도
    try {
      console.log(`🚀 학습 실행 서버 호출: ${trainingServerUrl}/api/training/execute`)
      
      // part_id 또는 element_id, set_num 추출 (렌더링 완료 정보에서)
      const partId = requestBody.part_id || requestBody.element_id || null
      const setNum = requestBody.set_num || null
      
      // 🔧 수정됨: 부품별 학습 또는 세트 전체 학습
      if (partId) {
        // 부품별 학습 실행
        console.log(`📦 부품별 학습 실행: ${partId}`)
        const trainingResponse = await fetch(`${trainingServerUrl}/api/training/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('TRAINING_API_KEY') || ''}`
          },
          body: JSON.stringify({
            jobId: jobData.id,
            partId: partId,
            modelStage: 'stage1',
            epochs: (trainingJob.config as any).epochs || 100,
            batchSize: (trainingJob.config as any).batch_size || 16,
            imageSize: (trainingJob.config as any).imgsz || 640,
            device: (trainingJob.config as any).device || 'cuda'
          })
        })
        
        if (trainingResponse.ok) {
          const trainingResult = await trainingResponse.json()
          console.log('✅ 학습 실행 서버 응답:', trainingResult)
          trainingStarted = true
          
          // 학습 작업 상태를 'running'으로 업데이트
          await supabase
            .from('training_jobs')
            .update({
              status: 'running',
              started_at: new Date().toISOString()
            })
            .eq('id', jobData.id)
        } else {
          const errorText = await trainingResponse.text()
          console.warn('⚠️ 학습 실행 서버 호출 실패:', errorText)
          trainingError = errorText
          
          // 학습 작업 상태를 'pending'으로 유지 (재시도 가능)
          await supabase
            .from('training_jobs')
            .update({
              status: 'pending',
              error_message: `학습 실행 서버 호출 실패: ${errorText}`
            })
            .eq('id', jobData.id)
        }
      } else if (setNum) {
        // 🔧 수정됨: 세트 전체 학습 실행 (synthetic-api.js 호출)
        console.log(`🎯 세트 전체 학습 실행: ${setNum}`)
        const syntheticApiUrl = Deno.env.get('SYNTHETIC_API_URL') || 'http://localhost:3011'
        
        const trainingResponse = await fetch(`${syntheticApiUrl}/api/synthetic/training/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('TRAINING_API_KEY') || ''}`
          },
          body: JSON.stringify({
            job_id: jobData.id,
            set_num: setNum,
            config: {
              epochs: (trainingJob.config as any).epochs || 100,
              batch_size: (trainingJob.config as any).batch_size || 16,
              imgsz: (trainingJob.config as any).imgsz || 640,
              device: (trainingJob.config as any).device || 'cuda'
            }
          })
        })
        
        if (trainingResponse.ok) {
          const trainingResult = await trainingResponse.json()
          console.log('✅ 세트 학습 실행 서버 응답:', trainingResult)
          trainingStarted = true
          
          // 학습 작업 상태를 'running'으로 업데이트
          await supabase
            .from('training_jobs')
            .update({
              status: 'running',
              started_at: new Date().toISOString()
            })
            .eq('id', jobData.id)
        } else {
          const errorText = await trainingResponse.text()
          console.warn('⚠️ 세트 학습 실행 서버 호출 실패:', errorText)
          trainingError = errorText
          
          // 학습 작업 상태를 'pending'으로 유지
          await supabase
            .from('training_jobs')
            .update({
              status: 'pending',
              error_message: `세트 학습 실행 서버 호출 실패: ${errorText}`
            })
            .eq('id', jobData.id)
        }
      } else {
        console.warn('⚠️ part_id, element_id 또는 set_num이 없어 학습 실행 스킵')
        // 정보가 없는 경우 상태를 'pending'으로 유지
        await supabase
          .from('training_jobs')
          .update({
            status: 'pending',
            error_message: 'part_id, element_id 또는 set_num이 없어 학습을 시작할 수 없습니다'
          })
          .eq('id', jobData.id)
      }
    } catch (fetchError) {
      console.error('❌ 학습 실행 서버 호출 오류:', fetchError)
      trainingError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      
      // 학습 작업 상태 업데이트
      await supabase
        .from('training_jobs')
        .update({
          status: 'pending',
          error_message: `학습 실행 서버 연결 실패: ${trainingError}`
        })
        .eq('id', jobData.id)
    }
    
    // 6. 알림 전송 (선택사항)
    const { data: config } = await supabase
      .from('automation_config')
      .select('*')
      .eq('config_key', 'notification_webhook')
      .maybeSingle() // 🔧 수정됨: .single() 대신 .maybeSingle() 사용

    // 🔧 수정됨: notification_webhook 구조에 맞게 url 존재 여부로 체크
    const webhookUrl = typeof config?.config_value === 'object' && config.config_value !== null
      ? (config.config_value as any).url 
      : null
    
    if (webhookUrl) {
      // 웹훅 알림 전송
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trainingStarted ? '자동 학습이 시작되었습니다' : '자동 학습 시작 실패',
            job_id: jobData.id,
            new_data_count: newData?.length || 0,
            training_started: trainingStarted,
            error: trainingError
          })
        })
      } catch (e) {
        console.log('알림 전송 실패:', e)
      }
    }

    return new Response(JSON.stringify({
      success: trainingStarted,
      message: trainingStarted ? '자동 학습이 시작되었습니다' : '학습 실행 서버 호출 실패 (작업은 생성되었으며 수동 실행 가능)',
      job_id: jobData.id,
      new_data_count: newData?.length || 0,
      training_started: trainingStarted,
      training_error: trainingError,
      training_server_url: trainingServerUrl
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
