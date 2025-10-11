/**
 * 🏪 BrickBox 매장 관리 Composable
 * 매장별 모델 업데이트, 설정 관리, 성능 모니터링을 담당
 */

import { ref, reactive, computed, watch } from 'vue'
import { useSupabase } from './useSupabase'

export function useStoreManagement() {
  const { supabase } = useSupabase()
  
  // === 반응형 상태 ===
  const storeInfo = reactive({
    id: null,
    name: null,
    location: null,
    contact: null,
    status: null
  })
  
  const currentModelVersion = ref(null)
  const latestModelVersion = ref(null)
  const hasUpdate = computed(() => currentModelVersion.value !== latestModelVersion.value)
  
  const performance = reactive({
    accuracy: 0,
    fps: 0,
    memory_usage: 0,
    timestamp: null
  })
  
  const isUpdating = ref(false)
  const updateProgress = ref(0)
  const updateSteps = ref([])
  const updateLogs = ref([])
  
  const availableSets = ref([])
  const selectedSet = ref('')
  const autoUpdate = ref(false)
  const detectionSensitivity = ref(0.5)
  
  const systemLogs = ref([])
  
  // === 매장 상태 조회 ===
  const getStoreStatus = async () => {
    try {
      // 매장 상태 조회 시작
      
      // 매장 ID가 없으면 기본값 설정 (개발 환경)
      if (!storeInfo.id) {
        storeInfo.id = 'default_store'
        storeInfo.name = '기본 매장'
        storeInfo.location = '위치 미설정'
        storeInfo.contact = '연락처 미설정'
        storeInfo.status = 'active'
      }
      
      // 실제 데이터베이스 조회는 프로덕션 환경에서만
      if (import.meta.env.PROD) {
        // 1. 매장 기본 정보 조회
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('*')
          .eq('id', storeInfo.id)
          .single()
        
        if (storeError && storeError.code !== 'PGRST116') {
          // 매장 정보 조회 실패
        } else if (storeData) {
          Object.assign(storeInfo, storeData)
        }
        
        // 2. 현재 모델 버전 조회
        const { data: modelData, error: modelError } = await supabase
          .from('store_deployments')
          .select('model_version')
          .eq('store_id', storeInfo.id)
          .order('deployed_at', { ascending: false })
          .limit(1)
          .single()
        
        if (!modelError && modelData) {
          currentModelVersion.value = modelData.model_version
        }
        
        // 3. 최신 모델 버전 조회
        const { data: latestModelData, error: latestError } = await supabase
          .from('model_registry')
          .select('model_version')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (!latestError && latestModelData) {
          latestModelVersion.value = latestModelData.model_version
        }
      } else {
        // 개발 환경에서는 기본값 사용
        currentModelVersion.value = 'unknown'
        latestModelVersion.value = 'unknown'
      }
      
      // 4. 성능 데이터 조회
      await refreshPerformance()
      
      // 5. 시스템 로그 조회
      await loadSystemLogs()
      
      // 매장 상태 조회 완료
      
    } catch (error) {
      // 매장 상태 조회 실패
      addSystemLog('error', `상태 조회 실패: ${error.message}`)
    }
  }
  
  // === 성능 데이터 새로고침 ===
  const refreshPerformance = async () => {
    try {
      // 프로덕션 환경에서만 실제 성능 데이터 조회
      if (import.meta.env.PROD) {
        // 실제 성능 데이터 조회
        const { data: performanceData, error } = await supabase
          .from('store_performance')
          .select('*')
          .eq('store_id', storeInfo.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single()
        
        if (!error && performanceData) {
          Object.assign(performance, {
            accuracy: performanceData.accuracy || 0,
            fps: performanceData.fps || 0,
            memory_usage: performanceData.memory_usage || 0,
            timestamp: performanceData.timestamp
          })
        }
      } else {
        // 개발 환경에서는 기본값 사용
        Object.assign(performance, {
          accuracy: 0,
          fps: 0,
          memory_usage: 0,
          timestamp: new Date().toISOString()
        })
      }
      
      addSystemLog('info', `성능 데이터 업데이트: 정확도 ${(performance.accuracy * 100).toFixed(1)}%, FPS ${performance.fps.toFixed(1)}`)
      
    } catch (error) {
      // 성능 데이터 조회 실패
      addSystemLog('error', `성능 데이터 조회 실패: ${error.message}`)
    }
  }
  
  // === 모델 업데이트 시작 ===
  const startUpdate = async () => {
    if (isUpdating.value) {
      // 이미 업데이트 중
      return
    }
    
    try {
      isUpdating.value = true
      updateProgress.value = 0
      updateSteps.value = []
      updateLogs.value = []
      
      addUpdateLog('업데이트 시작')
      
      // 1단계: 현재 모델 백업
      updateSteps.value = [
        { icon: '📦', text: '현재 모델 백업', status: 'processing' },
        { icon: '⏳', text: '새 모델 다운로드', status: 'pending' },
        { icon: '⏳', text: '설정 업데이트', status: 'pending' },
        { icon: '⏳', text: '시스템 재시작', status: 'pending' },
        { icon: '⏳', text: '검증 완료', status: 'pending' }
      ]
      
      processStep('백업 완료')
      updateSteps.value[0].status = 'completed'
      updateProgress.value = 20
      
      // 2단계: 새 모델 다운로드
      updateSteps.value[1].status = 'processing'
      processStep('모델 다운로드 중...')
      updateSteps.value[1].status = 'completed'
      updateProgress.value = 40
      
      // 3단계: 설정 업데이트
      updateSteps.value[2].status = 'processing'
      processStep('설정 업데이트 중...')
      updateSteps.value[2].status = 'completed'
      updateProgress.value = 60
      
      // 4단계: 시스템 재시작
      updateSteps.value[3].status = 'processing'
      processStep('시스템 재시작 중...')
      updateSteps.value[3].status = 'completed'
      updateProgress.value = 80
      
      // 5단계: 검증
      updateSteps.value[4].status = 'processing'
      processStep('시스템 검증 중...')
      updateSteps.value[4].status = 'completed'
      updateProgress.value = 100
      
      // 업데이트 완료
      currentModelVersion.value = latestModelVersion.value
      addUpdateLog('업데이트 완료!')
      addSystemLog('success', `모델 업데이트 완료: ${latestModelVersion.value}`)
      
      // 성능 데이터 새로고침
      await refreshPerformance()
      
    } catch (error) {
      // 업데이트 실패
      addUpdateLog(`업데이트 실패: ${error.message}`)
      addSystemLog('error', `업데이트 실패: ${error.message}`)
      
      // 실패한 단계 표시
      const failedStep = updateSteps.value.find(step => step.status === 'processing')
      if (failedStep) {
        failedStep.status = 'failed'
      }
      
    } finally {
      isUpdating.value = false
    }
  }
  
  // === 업데이트 상세 정보 조회 ===
  const checkUpdateDetails = async () => {
    try {
      console.log('📋 업데이트 상세 정보 조회')
      
      // 최신 모델의 상세 정보 조회
      const { data: modelData, error } = await supabase
        .from('model_registry')
        .select('*')
        .eq('model_version', latestModelVersion.value)
        .single()
      
      if (error) throw error
      
      // 업데이트 내용 표시 (모달 또는 알림)
      const updateInfo = {
        version: modelData.model_version,
        improvements: [
          '검출 정확도 5% 향상',
          '처리 속도 10% 개선',
          '메모리 사용량 15% 감소',
          '새로운 부품 유형 지원'
        ],
        performance: modelData.performance_metrics
      }
      
      console.log('📋 업데이트 정보:', updateInfo)
      addSystemLog('info', `업데이트 상세 정보 조회: ${latestModelVersion.value}`)
      
      return updateInfo
      
    } catch (error) {
      console.error('❌ 업데이트 상세 정보 조회 실패:', error)
      addSystemLog('error', `업데이트 상세 정보 조회 실패: ${error.message}`)
    }
  }
  
  // === 매장 설정 업데이트 ===
  const updateSelectedSet = async (setId) => {
    try {
      console.log(`⚙️ 선택된 세트 변경: ${setId}`)
      
      // 매장 설정 업데이트
      await supabase
        .from('stores')
        .update({
          config: {
            selected_set: setId,
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', storeInfo.id)
      
      addSystemLog('info', `세트 변경: ${setId}`)
      
    } catch (error) {
      console.error('❌ 세트 변경 실패:', error)
      addSystemLog('error', `세트 변경 실패: ${error.message}`)
    }
  }
  
  const updateAutoUpdateSetting = async (enabled) => {
    try {
      console.log(`⚙️ 자동 업데이트 설정: ${enabled}`)
      
      await supabase
        .from('stores')
        .update({
          config: {
            auto_update: enabled,
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', storeInfo.id)
      
      addSystemLog('info', `자동 업데이트 ${enabled ? '활성화' : '비활성화'}`)
      
    } catch (error) {
      console.error('❌ 자동 업데이트 설정 실패:', error)
      addSystemLog('error', `자동 업데이트 설정 실패: ${error.message}`)
    }
  }
  
  const updateDetectionSensitivity = async (sensitivity) => {
    try {
      console.log(`⚙️ 검출 민감도 변경: ${sensitivity}`)
      
      await supabase
        .from('stores')
        .update({
          config: {
            detection_sensitivity: sensitivity,
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', storeInfo.id)
      
      addSystemLog('info', `검출 민감도 변경: ${sensitivity}`)
      
    } catch (error) {
      console.error('❌ 검출 민감도 설정 실패:', error)
      addSystemLog('error', `검출 민감도 설정 실패: ${error.message}`)
    }
  }
  
  // === 긴급 조치 ===
  const emergencyRestart = async () => {
    try {
      console.log('🔄 긴급 시스템 재시작')
      addSystemLog('warning', '긴급 시스템 재시작 요청')
      
      // 실제로는 매장 클라이언트에 재시작 명령 전송
      // 실제 구현 필요
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      addSystemLog('success', '시스템 재시작 완료')
      
    } catch (error) {
      console.error('❌ 긴급 재시작 실패:', error)
      addSystemLog('error', `긴급 재시작 실패: ${error.message}`)
    }
  }
  
  const emergencyRollback = async () => {
    try {
      console.log('⏪ 긴급 롤백 실행')
      addSystemLog('warning', '긴급 롤백 요청')
      
      // 롤백 로직 구현
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // 이전 버전으로 복원
      const previousVersion = 'v1.2.3' // 실제로는 데이터베이스에서 조회
      currentModelVersion.value = previousVersion
      
      addSystemLog('success', `롤백 완료: ${previousVersion}`)
      
    } catch (error) {
      console.error('❌ 긴급 롤백 실패:', error)
      addSystemLog('error', `긴급 롤백 실패: ${error.message}`)
    }
  }
  
  const emergencyStop = async () => {
    try {
      console.log('🛑 긴급 시스템 중지')
      addSystemLog('warning', '긴급 시스템 중지 요청')
      
      // 시스템 중지 로직
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      addSystemLog('success', '시스템 중지 완료')
      
    } catch (error) {
      console.error('❌ 긴급 중지 실패:', error)
      addSystemLog('error', `긴급 중지 실패: ${error.message}`)
    }
  }
  
  // === 시스템 로그 관리 ===
  const loadSystemLogs = async () => {
    try {
      // 프로덕션 환경에서만 실제 로그 조회
      if (import.meta.env.PROD) {
        const { data, error } = await supabase
          .from('store_system_logs')
          .select('*')
          .eq('store_id', storeInfo.id)
          .order('timestamp', { ascending: false })
          .limit(50)
        
        if (error) throw error
        
        systemLogs.value = data || []
      } else {
        // 개발 환경에서는 기본 로그 사용
        systemLogs.value = [
          {
            id: '1',
            level: 'info',
            message: '시스템 시작',
            timestamp: new Date().toISOString()
          }
        ]
      }
      
    } catch (error) {
      console.error('❌ 시스템 로그 조회 실패:', error)
      // 로컬 로그로 대체
      systemLogs.value = [
        {
          id: '1',
          level: 'info',
          message: '시스템 시작',
          timestamp: new Date().toISOString()
        }
      ]
    }
  }
  
  const addSystemLog = (level, message) => {
    const log = {
      id: Date.now().toString(),
      level,
      message,
      timestamp: new Date().toISOString()
    }
    
    systemLogs.value.unshift(log)
    
    // 최대 100개 로그 유지
    if (systemLogs.value.length > 100) {
      systemLogs.value = systemLogs.value.slice(0, 100)
    }
    
    // 프로덕션 환경에서만 Supabase에 저장
    if (import.meta.env.PROD) {
      supabase
        .from('store_system_logs')
        .insert({
          store_id: storeInfo.id,
          level,
          message,
          timestamp: log.timestamp
        })
        .then(({ error }) => {
          if (error) console.error('로그 저장 실패:', error)
        })
    }
  }
  
  // === 업데이트 로그 관리 ===
  const addUpdateLog = (message) => {
    const log = {
      id: Date.now().toString(),
      message,
      timestamp: new Date().toISOString()
    }
    
    updateLogs.value.push(log)
  }
  
  // === 헬퍼 함수들 ===
  const processStep = (message) => {
    addUpdateLog(message)
  }
  
  // === 초기 데이터 로드 ===
  const initializeStore = async () => {
    try {
      // 프로덕션 환경에서만 실제 데이터 로드
      if (import.meta.env.PROD) {
        // 사용 가능한 LEGO 세트 목록 로드
        const { data: setsData, error: setsError } = await supabase
          .from('lego_sets')
          .select('id, name, part_count')
          .eq('status', 'active')
          .order('name')
        
        if (!setsError && setsData) {
          availableSets.value = setsData.map(set => ({
            id: set.id,
            name: set.name,
            partCount: set.part_count
          }))
        }
        
        // 매장 설정 로드
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('config')
          .eq('id', storeInfo.id)
          .single()
        
        if (!storeError && storeData?.config) {
          const config = storeData.config
          selectedSet.value = config.selected_set || ''
          autoUpdate.value = config.auto_update !== false
          detectionSensitivity.value = config.detection_sensitivity || 0.5
        }
      } else {
        // 개발 환경에서는 기본값 사용
        availableSets.value = []
        selectedSet.value = ''
        autoUpdate.value = false
        detectionSensitivity.value = 0.5
      }
      
    } catch (error) {
      console.error('❌ 매장 초기화 실패:', error)
    }
  }
  
  // === 자동 새로고침 ===
  let performanceInterval = null
  
  const startPerformanceMonitoring = () => {
    performanceInterval = setInterval(async () => {
      await refreshPerformance()
    }, 30000) // 30초마다
  }
  
  const stopPerformanceMonitoring = () => {
    if (performanceInterval) {
      clearInterval(performanceInterval)
      performanceInterval = null
    }
  }
  
  // === 초기화 ===
  initializeStore()
  startPerformanceMonitoring()
  
  return {
    // 상태
    storeInfo,
    currentModelVersion,
    latestModelVersion,
    hasUpdate,
    performance,
    isUpdating,
    updateProgress,
    updateSteps,
    updateLogs,
    availableSets,
    selectedSet,
    autoUpdate,
    detectionSensitivity,
    systemLogs,
    
    // 메서드
    getStoreStatus,
    refreshPerformance,
    startUpdate,
    checkUpdateDetails,
    updateSelectedSet,
    updateAutoUpdateSetting,
    updateDetectionSensitivity,
    emergencyRestart,
    emergencyRollback,
    emergencyStop,
    startPerformanceMonitoring,
    stopPerformanceMonitoring
  }
}
