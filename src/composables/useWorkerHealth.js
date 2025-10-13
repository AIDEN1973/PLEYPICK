/**
 * 🏥 워커 헬스체크 시스템
 * 
 * 백그라운드 워커 (LLM 분석, 임베딩 생성) 상태를 모니터링
 * - 워커 상태 확인 (running/stopped/unknown)
 * - 큐 크기 추적
 * - 처리량 통계
 */

import { ref, computed } from 'vue'
import { supabase } from './useSupabase'
import { useSlackAlert } from './useSlackAlert'

// 전역 상태
const workerStatus = ref('unknown')
const lastHeartbeat = ref(null)
const queueSize = ref(0)
const processedToday = ref(0)
const lastCheckTime = ref(null)
const lastAlertTime = ref(null) // 중복 알림 방지

export function useWorkerHealth() {
  const heartbeatTimeoutMs = 60000 // 1분 이내면 running
  const alertCooldownMs = 300000 // 5분에 한 번만 알림
  const { alertWorkerStopped } = useSlackAlert()

  /**
   * 워커 헬스체크 실행
   */
  const checkWorkerHealth = async () => {
    try {
      lastCheckTime.value = new Date()
      
      // 1. 임베딩 워커 상태 확인
      const { data: embeddingData, error: embeddingError } = await supabase
        .from('embedding_worker_status')
        .select('*')
        .maybeSingle()

      if (embeddingError && embeddingError.code !== 'PGRST116') {
        console.warn('임베딩 워커 상태 테이블이 없습니다. (선택사항)')
      }

      // 2. LLM 분석 큐 상태 확인
      const { count: pendingCount, error: countError } = await supabase
        .from('parts_master_features')
        .select('*', { count: 'exact', head: true })
        .is('feature_text', null)

      if (!countError) {
        queueSize.value = pendingCount || 0
      }

      // 3. 오늘 처리된 항목 수
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { count: todayCount, error: todayError } = await supabase
        .from('parts_master_features')
        .select('*', { count: 'exact', head: true })
        .not('feature_text', 'is', null)
        .gte('updated_at', today.toISOString())

      if (!todayError) {
        processedToday.value = todayCount || 0
      }

      // 4. 워커 상태 판단
      if (embeddingData) {
        const heartbeatTime = new Date(embeddingData.last_heartbeat)
        lastHeartbeat.value = heartbeatTime
        
        const diff = Date.now() - heartbeatTime.getTime()
        
        if (diff < heartbeatTimeoutMs) {
          workerStatus.value = 'running'
          lastAlertTime.value = null // 다시 running이면 알림 쿨다운 리셋
        } else {
          workerStatus.value = 'stopped'
          
          // Slack 알림: 워커 중지 (쿨다운 적용)
          const shouldAlert = !lastAlertTime.value || 
            (Date.now() - lastAlertTime.value > alertCooldownMs)
          
          if (shouldAlert) {
            await alertWorkerStopped('임베딩 워커', embeddingData.last_heartbeat)
            lastAlertTime.value = Date.now()
          }
        }
      } else {
        // 워커 상태 테이블이 없으면 큐 크기로 추정
        if (queueSize.value > 0) {
          workerStatus.value = 'unknown' // 큐가 있지만 워커 상태 불명
        } else {
          workerStatus.value = 'idle' // 큐가 없음
        }
      }

      console.log(`🏥 워커 헬스체크 완료:`, {
        status: workerStatus.value,
        queueSize: queueSize.value,
        processedToday: processedToday.value,
        lastHeartbeat: lastHeartbeat.value
      })

      return {
        status: workerStatus.value,
        queueSize: queueSize.value,
        processedToday: processedToday.value,
        lastHeartbeat: lastHeartbeat.value,
        lastCheckTime: lastCheckTime.value
      }
      
    } catch (err) {
      console.error('워커 헬스체크 실패:', err)
      workerStatus.value = 'error'
      
      return {
        status: 'error',
        error: err.message,
        lastCheckTime: lastCheckTime.value
      }
    }
  }

  /**
   * 워커 시작 요청 (수동)
   */
  const requestWorkerStart = async () => {
    try {
      console.log('🚀 워커 시작 요청...')
      
      // 워커 시작 요청 (실제 구현은 서버 측에서 처리)
      const { data, error } = await supabase
        .from('worker_commands')
        .insert({
          command: 'start',
          requested_at: new Date().toISOString(),
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        console.warn('워커 명령 테이블이 없습니다. 수동으로 워커를 시작하세요.')
        return { success: false, message: '워커 명령 테이블이 없습니다.' }
      }

      console.log('✅ 워커 시작 요청 완료:', data)
      return { success: true, data }
      
    } catch (err) {
      console.error('워커 시작 요청 실패:', err)
      return { success: false, error: err.message }
    }
  }

  /**
   * 워커 중지 요청 (수동)
   */
  const requestWorkerStop = async () => {
    try {
      console.log('⏹️ 워커 중지 요청...')
      
      const { data, error } = await supabase
        .from('worker_commands')
        .insert({
          command: 'stop',
          requested_at: new Date().toISOString(),
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        console.warn('워커 명령 테이블이 없습니다.')
        return { success: false, message: '워커 명령 테이블이 없습니다.' }
      }

      console.log('✅ 워커 중지 요청 완료:', data)
      return { success: true, data }
      
    } catch (err) {
      console.error('워커 중지 요청 실패:', err)
      return { success: false, error: err.message }
    }
  }

  /**
   * 통계 요약
   */
  const healthSummary = computed(() => {
    const statusEmoji = {
      running: '🟢',
      stopped: '🔴',
      idle: '🟡',
      unknown: '⚪',
      error: '❌'
    }

    return {
      emoji: statusEmoji[workerStatus.value] || '❓',
      status: workerStatus.value,
      statusText: {
        running: '실행 중',
        stopped: '중지됨',
        idle: '대기 중',
        unknown: '상태 불명',
        error: '오류'
      }[workerStatus.value] || '알 수 없음',
      queueSize: queueSize.value,
      processedToday: processedToday.value,
      lastHeartbeat: lastHeartbeat.value,
      lastCheckTime: lastCheckTime.value
    }
  })

  return {
    workerStatus,
    lastHeartbeat,
    queueSize,
    processedToday,
    lastCheckTime,
    healthSummary,
    checkWorkerHealth,
    requestWorkerStart,
    requestWorkerStop
  }
}

/**
 * 자동 헬스체크 인터벌 시작
 */
export function startAutoHealthCheck(intervalMs = 30000) {
  const { checkWorkerHealth } = useWorkerHealth()
  
  // 즉시 1회 실행
  checkWorkerHealth()
  
  const intervalId = setInterval(() => {
    checkWorkerHealth()
  }, intervalMs) // 기본 30초마다 실행
  
  console.log(`🏥 자동 헬스체크 시작 (${intervalMs / 1000}초마다)`)
  
  return () => {
    clearInterval(intervalId)
    console.log(`⏹️ 자동 헬스체크 중지`)
  }
}

