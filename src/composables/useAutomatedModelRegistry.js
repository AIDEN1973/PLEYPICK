/**
 * 🧱 BrickBox 자동화된 모델 레지스트리 관리
 * 
 * Supabase model_registry와 연동하여 자동으로 최신 모델을 로드하고 관리
 * - 실시간 모델 상태 모니터링
 * - 자동 모델 업데이트
 * - 성능 메트릭 추적
 * - 모델 버전 관리
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSupabase } from './useSupabase'

const { supabase } = useSupabase()

export const useAutomatedModelRegistry = () => {
  // 상태 관리
  const currentModel = ref(null)
  const modelHistory = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const isConnected = ref(false)
  
  // 실시간 구독
  let modelSubscription = null
  let trainingSubscription = null

  /**
   * 최신 활성 모델 가져오기
   */
  const fetchLatestModel = async () => {
    try {
      isLoading.value = true
      error.value = null

      const { data, error: fetchError } = await supabase
        .from('model_registry')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) {
        throw new Error(`모델 조회 실패: ${fetchError.message}`)
      }

      if (data && data.length > 0) {
        currentModel.value = data[0]
        console.log(`✅ 최신 모델 로드: ${data[0].model_name} (v${data[0].version})`)
      } else {
        console.warn('⚠️ 활성 모델이 없습니다')
        currentModel.value = null
      }

    } catch (err) {
      error.value = err.message
      console.error('❌ 모델 로드 실패:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 모델 히스토리 가져오기
   */
  const fetchModelHistory = async (limit = 10) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('model_registry')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fetchError) {
        throw new Error(`모델 히스토리 조회 실패: ${fetchError.message}`)
      }

      // 각 모델에 대해 training_jobs 정보 추가
      if (data) {
        for (let model of data) {
          if (model.training_job_id) {
            try {
              const { data: jobData } = await supabase
                .from('training_jobs')
                .select('job_name, status, started_at, completed_at')
                .eq('id', model.training_job_id)
                .single()
              
              if (jobData) {
                model.training_job = jobData
              }
            } catch (jobError) {
              console.warn(`⚠️ 학습 작업 정보 로드 실패 (ID: ${model.training_job_id}):`, jobError)
            }
          }
        }
      }

      modelHistory.value = data || []
      console.log(`📊 모델 히스토리 로드: ${data?.length || 0}개 모델`)

    } catch (err) {
      console.error('❌ 모델 히스토리 로드 실패:', err)
    }
  }

  /**
   * 모델 성능 메트릭 가져오기
   */
  const fetchModelMetrics = async (modelId) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('training_metrics')
        .select('*')
        .eq('training_job_id', modelId)
        .order('epoch', { ascending: true })

      if (fetchError) {
        throw new Error(`메트릭 조회 실패: ${fetchError.message}`)
      }

      return data || []

    } catch (err) {
      console.error('❌ 모델 메트릭 로드 실패:', err)
      return []
    }
  }

  /**
   * 모델 활성화
   */
  const activateModel = async (modelId) => {
    try {
      isLoading.value = true

      // 기존 활성 모델 비활성화
      const { error: deactivateError } = await supabase
        .from('model_registry')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('is_active', true)

      if (deactivateError) {
        console.warn('⚠️ 기존 모델 비활성화 실패:', deactivateError)
      }

      // 새 모델 활성화
      const { error: activateError } = await supabase
        .from('model_registry')
        .update({ 
          is_active: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', modelId)

      if (activateError) {
        throw new Error(`모델 활성화 실패: ${activateError.message}`)
      }

      // 최신 모델 다시 로드
      await fetchLatestModel()
      console.log(`✅ 모델 활성화 완료: ID ${modelId}`)

    } catch (err) {
      error.value = err.message
      console.error('❌ 모델 활성화 실패:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 모델 성능 평가
   */
  const evaluateModelPerformance = (metrics) => {
    const thresholds = {
      mAP50: 0.0,
      mAP50_95: 0.0,
      precision: 0.0,
      recall: 0.0,
      f1_score: 0.8
    }

    const evaluation = {
      overall: 'good',
      issues: [],
      recommendations: []
    }

    // 각 메트릭 평가
    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const value = metrics[metric] || 0
      if (value < threshold) {
        evaluation.issues.push(`${metric}: ${value.toFixed(3)} < ${threshold}`)
        evaluation.overall = 'poor'
      }
    })

    // 권장사항 생성
    if (evaluation.issues.length > 0) {
      evaluation.recommendations.push('더 많은 데이터로 재학습을 고려하세요')
      evaluation.recommendations.push('데이터 증강 기법을 적용해보세요')
      evaluation.recommendations.push('하이퍼파라미터 튜닝을 시도해보세요')
    }

    return evaluation
  }

  /**
   * 실시간 모델 업데이트 구독
   */
  const subscribeToModelUpdates = () => {
    // 모델 레지스트리 변경 구독
    modelSubscription = supabase
      .channel('model_registry_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'model_registry'
      }, (payload) => {
        console.log('📡 모델 레지스트리 변경 감지:', payload)
        
        // 최신 모델 다시 로드
        fetchLatestModel()
      })
      .subscribe()

    // 학습 작업 상태 변경 구독
    trainingSubscription = supabase
      .channel('training_jobs_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'training_jobs'
      }, (payload) => {
        console.log('📡 학습 작업 상태 변경 감지:', payload)
        
        // 모델 히스토리 다시 로드
        fetchModelHistory()
      })
      .subscribe()

    isConnected.value = true
    console.log('✅ 실시간 구독 시작')
  }

  /**
   * 구독 해제
   */
  const unsubscribeFromUpdates = () => {
    if (modelSubscription) {
      supabase.removeChannel(modelSubscription)
      modelSubscription = null
    }
    
    if (trainingSubscription) {
      supabase.removeChannel(trainingSubscription)
      trainingSubscription = null
    }

    isConnected.value = false
    console.log('🔌 실시간 구독 해제')
  }

  /**
   * 로컬 PC 학습 작업 시작
   */
  const startTraining = async (datasetId = 'latest', config = {}) => {
    try {
      isLoading.value = true
      error.value = null

      console.log('🚀 로컬 PC 학습 시작...')
      console.log('📊 학습 설정:', config)

      // 로컬 학습 작업 생성
      const trainingJob = {
        job_name: `local_training_${Date.now()}`,
        status: 'pending',
        training_config: {
          epochs: config.epochs || 100,
          batch_size: config.batch_size || 16,
          imgsz: config.imgsz || 640,
          device: config.device || 'cuda',
          set_num: config.set_num,
          training_type: 'local' // 로컬 학습 표시
        },
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }

      // 데이터베이스에 학습 작업 기록
      const { data: jobData, error: jobError } = await supabase
        .from('training_jobs')
        .insert(trainingJob)
        .select()
        .single()

      if (jobError) {
        throw new Error(`학습 작업 생성 실패: ${jobError.message}`)
      }

      console.log(`✅ 로컬 학습 작업 생성: ID ${jobData.id}`)

      // 로컬 학습 스크립트 실행 안내
      const localTrainingGuide = `
🎯 로컬 PC 학습 시작!

📋 실행 방법:
1. 터미널/명령 프롬프트를 열어주세요
2. 프로젝트 루트 디렉토리로 이동하세요
3. 다음 명령어를 실행하세요:

cd scripts
python local_yolo_training.py --set_num ${config.set_num || 'latest'} --epochs ${config.epochs || 100}

📊 학습 진행 상황:
- 학습 상태는 대시보드에서 실시간으로 확인할 수 있습니다
- 완료 후 자동으로 모델이 업로드됩니다
- 예상 소요 시간: 2-3시간 (GPU 사용 시)

💡 팁:
- GPU가 있다면 CUDA를 사용하여 더 빠른 학습이 가능합니다
- CPU만 있다면 시간이 더 오래 걸릴 수 있습니다
      `

      // 사용자 안내 표시
      setTimeout(() => {
        alert(localTrainingGuide)
      }, 1000)

      return {
        success: true,
        training_job_id: jobData.id,
        job_name: jobData.job_name,
        training_type: 'local',
        guide: localTrainingGuide
      }

    } catch (err) {
      error.value = err.message
      console.error('❌ 로컬 학습 시작 실패:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 계산된 속성
  const hasActiveModel = computed(() => currentModel.value !== null)
  const modelPerformance = computed(() => {
    if (!currentModel.value?.metrics) return null
    return evaluateModelPerformance(currentModel.value.metrics)
  })
  const modelSizeFormatted = computed(() => {
    if (!currentModel.value?.model_size) return 'N/A'
    const sizeMB = currentModel.value.model_size / 1024 / 1024
    return `${sizeMB.toFixed(1)}MB`
  })

  // 생명주기 훅
  onMounted(async () => {
    await fetchLatestModel()
    await fetchModelHistory()
    subscribeToModelUpdates()
  })

  onUnmounted(() => {
    unsubscribeFromUpdates()
  })

  return {
    // 상태
    currentModel,
    modelHistory,
    isLoading,
    error,
    isConnected,
    
    // 계산된 속성
    hasActiveModel,
    modelPerformance,
    modelSizeFormatted,
    
    // 메서드
    fetchLatestModel,
    fetchModelHistory,
    fetchModelMetrics,
    activateModel,
    evaluateModelPerformance,
    startTraining,
    subscribeToModelUpdates,
    unsubscribeFromUpdates
  }
}
