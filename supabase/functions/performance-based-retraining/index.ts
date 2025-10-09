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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 현재 모델 성능 확인
    const { data: currentModel, error: modelError } = await supabase
      .from('model_registry')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (modelError || !currentModel) {
      return new Response(JSON.stringify({
        success: false,
        message: '활성 모델을 찾을 수 없습니다'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. 성능 메트릭 분석
    const performance = currentModel.performance_metrics || {}
    const mAP50 = performance.mAP50 || 0
    const precision = performance.precision || 0
    const recall = performance.recall || 0

    // 3. 성능 기준 확인
    const performanceThreshold = 0.6 // 60% 이하 시 재학습
    const needsRetraining = mAP50 < performanceThreshold

    console.log(`📊 현재 모델 성능:`)
    console.log(`  - mAP50: ${mAP50.toFixed(3)}`)
    console.log(`  - Precision: ${precision.toFixed(3)}`)
    console.log(`  - Recall: ${recall.toFixed(3)}`)
    console.log(`  - 재학습 필요: ${needsRetraining ? '예' : '아니오'}`)

    if (!needsRetraining) {
      return new Response(JSON.stringify({
        success: true,
        message: '성능이 양호하여 재학습이 필요하지 않습니다',
        performance: {
          mAP50,
          precision,
          recall,
          threshold: performanceThreshold
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. 재학습 작업 생성
    const retrainingJob = {
      job_name: `performance_retraining_${new Date().toISOString().replace(/[:.]/g, '-')}`,
      dataset_id: null,
      status: 'pending',
      config: {
        epochs: 150, // 재학습은 더 많은 에포크
        batch_size: 16,
        imgsz: 640,
        device: 'cuda',
        retraining_trigger: 'performance_degradation',
        previous_mAP50: mAP50,
        target_mAP50: 0.8
      },
      progress: {},
      error_message: null
    }

    const { data: jobData, error: jobError } = await supabase
      .from('training_jobs')
      .insert(retrainingJob)
      .select()
      .single()

    if (jobError) {
      throw new Error(`재학습 작업 생성 실패: ${jobError.message}`)
    }

    // 5. 성능 기반 재학습 로그
    await supabase
      .from('auto_training_logs')
      .insert({
        log_type: 'performance_retraining',
        message: `성능 저하로 인한 재학습 시작 (mAP50: ${mAP50.toFixed(3)})`,
        data: {
          job_id: jobData.id,
          previous_performance: performance,
          retraining_config: retrainingJob.config
        }
      })

    // 6. 알림 전송
    const { data: config } = await supabase
      .from('automation_config')
      .select('*')
      .eq('config_key', 'auto_training_notifications')
      .single()

    if (config?.config_value?.enabled) {
      try {
        await fetch(config.config_value.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '모델 성능 저하로 인한 자동 재학습이 시작되었습니다',
            job_id: jobData.id,
            current_performance: performance,
            retraining_reason: 'performance_degradation'
          })
        })
      } catch (e) {
        console.log('알림 전송 실패:', e)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: '성능 기반 재학습이 시작되었습니다',
      job_id: jobData.id,
      current_performance: performance,
      retraining_config: retrainingJob.config
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('성능 기반 재학습 실패:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
