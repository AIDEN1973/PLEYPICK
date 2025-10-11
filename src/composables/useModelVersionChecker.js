/**
 * 🤖 BrickBox 모델 버전 자동 확인 시스템
 * 
 * - 실시간 모델 버전 모니터링
 * - 자동 모델 업데이트 감지
 * - 성능 메트릭 비교
 * - 롤백 기능
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from './useSupabase'

export function useModelVersionChecker() {
  // 상태 관리
  const currentModel = ref(null)
  const latestModel = ref(null)
  const modelHistory = ref([])
  const isChecking = ref(false)
  const hasUpdate = ref(false)
  const updateAvailable = ref(false)
  
  // 모니터링 설정
  const checkInterval = ref(30000) // 30초마다 체크
  const autoUpdate = ref(false)
  const performanceThreshold = ref(0.05) // 5% 성능 향상 시 자동 업데이트
  
  let checkTimer = null
  let modelSubscription = null
  
  /**
   * 현재 사용 중인 모델 정보 가져오기
   */
  const getCurrentModel = async () => {
    try {
      // 현재 코드에서 사용 중인 모델 경로 확인
      const currentPath = import.meta.env.VITE_DEFAULT_MODEL_URL || 'https://your-supabase-url.supabase.co/storage/v1/object/public/models/your-model-path/default_model.onnx'
      
      // 모델 레지스트리에서 해당 모델 정보 조회 (URL 인코딩 문제 해결)
      const { data, error } = await supabase
        .from('model_registry')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) {
        console.warn('⚠️ 모델 레지스트리 조회 실패:', error)
        currentModel.value = null
        return
      }
      
      // 배열에서 첫 번째 요소 추출
      const modelData = Array.isArray(data) ? data[0] : data
      currentModel.value = modelData || null
      
      console.log('📋 현재 모델:', currentModel.value)
      console.log('📊 원본 데이터:', { data, error, isArray: Array.isArray(data), length: Array.isArray(data) ? data.length : 'N/A' })
      
    } catch (error) {
      console.error('❌ 현재 모델 조회 실패:', error)
    }
  }
  
  /**
   * 최신 모델 정보 확인
   */
  const checkLatestModel = async () => {
    try {
      isChecking.value = true
      
      const { data, error } = await supabase
        .from('model_registry')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) {
        console.warn('⚠️ 최신 모델 조회 실패:', error)
        return
      }
      
      // 배열에서 첫 번째 요소 추출
      const modelData = Array.isArray(data) ? data[0] : data
      if (modelData) {
        latestModel.value = modelData
        
        // 버전 비교
        if (currentModel.value && latestModel.value) {
          const currentVersion = currentModel.value.model_version || currentModel.value.created_at
          const latestVersion = latestModel.value.model_version || latestModel.value.created_at
          
          hasUpdate.value = latestVersion > currentVersion
          updateAvailable.value = hasUpdate.value
          
          if (hasUpdate.value) {
            console.log('🔄 모델 업데이트 감지!')
            console.log(`   현재: ${currentVersion}`)
            console.log(`   최신: ${latestVersion}`)
            
            // 성능 메트릭 비교
            await comparePerformanceMetrics()
          }
        }
      }
      
    } catch (error) {
      console.error('❌ 최신 모델 확인 실패:', error)
    } finally {
      isChecking.value = false
    }
  }
  
  /**
   * 성능 메트릭 비교
   */
  const comparePerformanceMetrics = async () => {
    if (!currentModel.value || !latestModel.value) return
    
    const currentMetrics = currentModel.value.performance_metrics || {}
    const latestMetrics = latestModel.value.performance_metrics || {}
    
    const improvements = {
      mAP50: (latestMetrics.mAP50 || 0) - (currentMetrics.mAP50 || 0),
      mAP50_95: (latestMetrics.mAP50_95 || 0) - (currentMetrics.mAP50_95 || 0),
      precision: (latestMetrics.precision || 0) - (currentMetrics.precision || 0),
      recall: (latestMetrics.recall || 0) - (currentMetrics.recall || 0)
    }
    
    const avgImprovement = Object.values(improvements).reduce((sum, val) => sum + val, 0) / Object.keys(improvements).length
    
    console.log('📊 성능 메트릭 비교:', {
      improvements,
      avgImprovement: avgImprovement.toFixed(3)
    })
    
    // 자동 업데이트 조건 확인
    if (autoUpdate.value && avgImprovement >= performanceThreshold.value) {
      console.log('🚀 자동 업데이트 조건 충족!')
      await updateToLatestModel()
    }
  }
  
  /**
   * 최신 모델로 업데이트
   */
  const updateToLatestModel = async () => {
    if (!latestModel.value) return
    
    try {
      console.log('🔄 최신 모델로 업데이트 중...')
      
      // 1. 현재 모델 비활성화
      if (currentModel.value) {
        await supabase
          .from('model_registry')
          .update({ is_active: false })
          .eq('id', currentModel.value.id)
      }
      
      // 2. 최신 모델 활성화
      await supabase
        .from('model_registry')
        .update({ is_active: true })
        .eq('id', latestModel.value.id)
      
      // 3. 현재 모델 정보 업데이트
      currentModel.value = latestModel.value
      hasUpdate.value = false
      updateAvailable.value = false
      
      // 4. 모델 히스토리에 추가
      modelHistory.value.unshift({
        timestamp: new Date().toISOString(),
        action: 'model_updated',
        from: currentModel.value.model_version,
        to: latestModel.value.model_version,
        performance_improvement: latestModel.value.performance_metrics
      })
      
      console.log('✅ 모델 업데이트 완료!')
      
      // 5. 웹 애플리케이션 새로고침 (필요시)
      if (confirm('모델이 업데이트되었습니다. 페이지를 새로고침하시겠습니까?')) {
        window.location.reload()
      }
      
    } catch (error) {
      console.error('❌ 모델 업데이트 실패:', error)
    }
  }
  
  /**
   * 모델 히스토리 가져오기
   */
  const getModelHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('model_registry')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) throw error
      
      modelHistory.value = data || []
      
    } catch (error) {
      console.error('❌ 모델 히스토리 조회 실패:', error)
    }
  }
  
  /**
   * 실시간 모델 변경 감지
   */
  const startRealtimeMonitoring = () => {
    if (modelSubscription) return
    
    modelSubscription = supabase
      .channel('model_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'model_registry' },
        (payload) => {
          console.log('🔔 모델 변경 감지:', payload)
          checkLatestModel()
        }
      )
      .subscribe()
  }
  
  /**
   * 주기적 모델 확인 시작
   */
  const startPeriodicCheck = () => {
    if (checkTimer) return
    
    checkTimer = setInterval(() => {
      if (!isChecking.value) {
        checkLatestModel()
      }
    }, checkInterval.value)
    
    console.log(`⏰ 주기적 모델 확인 시작 (${checkInterval.value / 1000}초 간격)`)
  }
  
  /**
   * 주기적 모델 확인 중지
   */
  const stopPeriodicCheck = () => {
    if (checkTimer) {
      clearInterval(checkTimer)
      checkTimer = null
      console.log('⏹️ 주기적 모델 확인 중지')
    }
  }
  
  /**
   * 모든 모니터링 중지
   */
  const stopMonitoring = () => {
    stopPeriodicCheck()
    
    if (modelSubscription) {
      supabase.removeChannel(modelSubscription)
      modelSubscription = null
    }
  }
  
  // 계산된 속성
  const modelStatus = computed(() => {
    if (!currentModel.value) return 'no_model'
    if (hasUpdate.value) return 'update_available'
    return 'up_to_date'
  })
  
  const statusText = computed(() => {
    switch (modelStatus.value) {
      case 'update_available': return '업데이트 가능'
      case 'up_to_date': return '최신 버전'
      case 'no_model': return '모델 없음'
      default: return '알 수 없음'
    }
  })
  
  const statusClass = computed(() => {
    switch (modelStatus.value) {
      case 'update_available': return 'status-warning'
      case 'up_to_date': return 'status-success'
      case 'no_model': return 'status-secondary'
      default: return 'status-unknown'
    }
  })
  
  // 생명주기
  onMounted(async () => {
    await getCurrentModel()
    await checkLatestModel()
    await getModelHistory()
    
    // 모니터링 시작
    startRealtimeMonitoring()
    startPeriodicCheck()
  })
  
  onUnmounted(() => {
    stopMonitoring()
  })
  
  return {
    // 상태
    currentModel,
    latestModel,
    modelHistory,
    isChecking,
    hasUpdate,
    updateAvailable,
    
    // 설정
    checkInterval,
    autoUpdate,
    performanceThreshold,
    
    // 계산된 속성
    modelStatus,
    statusText,
    statusClass,
    
    // 메서드
    getCurrentModel,
    checkLatestModel,
    updateToLatestModel,
    getModelHistory,
    startPeriodicCheck,
    stopPeriodicCheck,
    startRealtimeMonitoring,
    stopMonitoring
  }
}
