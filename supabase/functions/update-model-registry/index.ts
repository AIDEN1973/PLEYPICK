// 🧱 BrickBox 모델 레지스트리 업데이트
// Colab에서 학습 완료 후 모델 등록 및 활성화

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

interface ModelRegistrationRequest {
  training_job_id: number
  model_name: string
  model_url: string
  model_size: number
  metrics: {
    mAP50?: number
    mAP50_95?: number
    precision?: number
    recall?: number
    f1_score?: number
    training_time?: number
  }
  version?: string
  auto_activate?: boolean
}

serve(async (req: Request) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 요청 데이터 파싱
    const {
      training_job_id,
      model_name,
      model_url,
      model_size,
      metrics,
      version,
      auto_activate = true
    }: ModelRegistrationRequest = await req.json()

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`📝 모델 등록 시작: ${model_name}`)

    // 1. 학습 작업 존재 확인
    const { data: training_job, error: jobError } = await supabase
      .from('training_jobs')
      .select('*')
      .eq('id', training_job_id)
      .single()

    if (jobError || !training_job) {
      throw new Error(`학습 작업 ID ${training_job_id}를 찾을 수 없습니다`)
    }

    console.log(`📊 학습 작업 확인: ${training_job.job_name}`)

    // 2. 모델 버전 생성
    const modelVersion = version || `v${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`

    // 3. 기존 모델 비활성화 (새 모델이 활성화될 경우)
    if (auto_activate) {
      const { error: deactivateError } = await supabase
        .from('model_registry')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('status', 'active')

      if (deactivateError) {
        console.warn('⚠️ 기존 모델 비활성화 실패:', deactivateError)
      } else {
        console.log('✅ 기존 모델 비활성화 완료')
      }
    }

    // 4. 새 모델 등록
    const { data: new_model, error: modelError } = await supabase
      .from('model_registry')
      .insert({
        version: modelVersion,
        model_name: model_name,
        model_url: model_url,
        model_size: model_size,
        metrics: metrics,
        training_job_id: training_job_id,
        status: auto_activate ? 'active' : 'inactive',
        created_by: 'colab_automation'
      })
      .select()
      .single()

    if (modelError || !new_model) {
      throw new Error(`모델 등록 실패: ${modelError?.message}`)
    }

    console.log(`✅ 모델 등록 완료: ID ${new_model.id}, 버전 ${modelVersion}`)

    // 5. 학습 작업 완료 상태 업데이트
    const { error: updateJobError } = await supabase
      .from('training_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: {
          final_epoch: 'completed',
          model_id: new_model.id,
          model_version: modelVersion
        }
      })
      .eq('id', training_job_id)

    if (updateJobError) {
      console.warn('⚠️ 학습 작업 상태 업데이트 실패:', updateJobError)
    }

    // 6. 성능 기준 확인 및 알림
    const performanceThreshold = {
      mAP50: 0.7,
      precision: 0.8,
      recall: 0.8
    }

    const meetsThreshold = 
      (metrics.mAP50 || 0) >= performanceThreshold.mAP50 &&
      (metrics.precision || 0) >= performanceThreshold.precision &&
      (metrics.recall || 0) >= performanceThreshold.recall

    if (!meetsThreshold) {
      console.warn('⚠️ 모델 성능이 기준치에 미달합니다')
      
      // 성능 부족 알림 (웹훅)
      const webhookUrl = Deno.env.get('WEBHOOK_URL')
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'model_performance_low',
              model_id: new_model.id,
              model_version: modelVersion,
              metrics: metrics,
              thresholds: performanceThreshold
            })
          })
        } catch (webhookError) {
          console.warn('⚠️ 성능 알림 웹훅 실패:', webhookError)
        }
      }
    }

    // 7. 모델 정리 정책 적용
    await cleanupOldModels(supabase)

    // 8. 응답 반환
    const response = {
      success: true,
      model_id: new_model.id,
      model_version: modelVersion,
      model_url: model_url,
      status: auto_activate ? 'active' : 'inactive',
      metrics: metrics,
      message: '모델이 성공적으로 등록되었습니다'
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('❌ 모델 등록 실패:', error)
    
    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: '모델 등록에 실패했습니다'
    }

    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// 오래된 모델 정리 함수
async function cleanupOldModels(supabase: any) {
  try {
    // 자동 정리 설정 확인
    const { data: config } = await supabase
      .from('automation_config')
      .select('config_value')
      .eq('config_key', 'model_retention')
      .single()

    if (!config?.config_value?.auto_cleanup) {
      return
    }

    const maxVersions = config.config_value.max_versions || 10

    // 오래된 모델 조회 (활성 모델 제외)
    const { data: oldModels } = await supabase
      .from('model_registry')
      .select('id, version, created_at')
      .eq('status', 'inactive')
      .order('created_at', { ascending: false })
      .range(maxVersions, 999)

    if (oldModels && oldModels.length > 0) {
      const modelIds = oldModels.map((m: any) => m.id)
      
      // 오래된 모델 삭제
      const { error: deleteError } = await supabase
        .from('model_registry')
        .delete()
        .in('id', modelIds)

      if (deleteError) {
        console.warn('⚠️ 오래된 모델 정리 실패:', deleteError)
      } else {
        console.log(`🗑️ 오래된 모델 ${oldModels.length}개 정리 완료`)
      }
    }

  } catch (error) {
    console.warn('⚠️ 모델 정리 실패:', error)
  }
}
