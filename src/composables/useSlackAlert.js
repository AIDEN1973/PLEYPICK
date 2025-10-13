/**
 * 🔔 Slack 오류 알림 시스템
 * 
 * 주요 오류 발생 시 Slack으로 알림을 전송
 * - LLM 분석 실패
 * - 이미지 마이그레이션 실패
 * - 워커 중지 알림
 * - DB 오류
 */

import { ref } from 'vue'

// Slack Webhook URL (환경 변수에서 로드)
const webhookUrl = ref(import.meta.env.VITE_SLACK_WEBHOOK_URL)
const alertsEnabled = ref(!!webhookUrl.value)

export function useSlackAlert() {
  /**
   * Slack 알림 전송
   * 
   * @param {Object} options - 알림 옵션
   * @param {string} options.level - 알림 레벨 (error/warning/info)
   * @param {string} options.title - 알림 제목
   * @param {string} options.message - 알림 메시지
   * @param {Object} options.metadata - 추가 메타데이터
   * @param {string} options.context - 발생 위치 (파일명, 함수명)
   */
  const sendSlackAlert = async ({
    level = 'error',
    title,
    message,
    metadata = {},
    context = ''
  }) => {
    // Slack 알림이 비활성화된 경우 무시
    if (!alertsEnabled.value || !webhookUrl.value) {
      console.log('📢 Slack 알림 비활성화 (환경 변수 미설정)')
      return { success: false, reason: 'disabled' }
    }

    try {
      const emoji = {
        error: '🚨',
        warning: '⚠️',
        info: 'ℹ️',
        success: '✅'
      }[level] || '📢'

      const color = {
        error: '#FF0000',
        warning: '#FFA500',
        info: '#0000FF',
        success: '#00FF00'
      }[level] || '#808080'

      const now = new Date()
      const timestamp = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })

      // Slack 메시지 페이로드
      const payload = {
        text: `${emoji} *BrickBox 알림*`,
        attachments: [
          {
            color: color,
            title: title,
            text: message,
            fields: [
              {
                title: '발생 시간',
                value: timestamp,
                short: true
              },
              {
                title: '레벨',
                value: level.toUpperCase(),
                short: true
              }
            ],
            footer: 'BrickBox 메타데이터 시스템',
            footer_icon: 'https://platform.slack-edge.com/img/default_application_icon.png',
            ts: Math.floor(now.getTime() / 1000)
          }
        ]
      }

      // 컨텍스트 추가
      if (context) {
        payload.attachments[0].fields.push({
          title: '위치',
          value: `\`${context}\``,
          short: false
        })
      }

      // 메타데이터 추가
      if (Object.keys(metadata).length > 0) {
        const metadataStr = JSON.stringify(metadata, null, 2)
        payload.attachments[0].fields.push({
          title: '상세 정보',
          value: `\`\`\`${metadataStr}\`\`\``,
          short: false
        })
      }

      // Slack Webhook 호출
      const response = await fetch(webhookUrl.value, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Slack API 오류: ${response.status} ${response.statusText}`)
      }

      console.log(`✅ Slack 알림 전송 완료: ${title}`)
      return { success: true, timestamp }

    } catch (err) {
      console.error('❌ Slack 알림 전송 실패:', err)
      return { success: false, error: err.message }
    }
  }

  /**
   * LLM 분석 실패 알림
   */
  const alertLLMAnalysisFailed = async (partId, errorMessage, retryCount = 0) => {
    return await sendSlackAlert({
      level: 'error',
      title: '🤖 LLM 분석 실패',
      message: `부품 ${partId}의 LLM 메타데이터 분석이 실패했습니다.`,
      metadata: {
        part_id: partId,
        error: errorMessage,
        retry_count: retryCount,
        max_retries: 3
      },
      context: 'useMasterPartsPreprocessing.js → analyzePartWithLLM()'
    })
  }

  /**
   * 이미지 마이그레이션 실패 알림
   */
  const alertMigrationFailed = async (setNum, stats, errorMessage) => {
    return await sendSlackAlert({
      level: 'warning',
      title: '🖼️ 이미지 마이그레이션 타임아웃',
      message: `세트 ${setNum}의 이미지 마이그레이션이 타임아웃되었습니다.\n원본 이미지로 LLM 분석을 진행합니다.`,
      metadata: {
        set_num: setNum,
        uploaded: stats.uploaded || 0,
        total: stats.total || 0,
        completion_rate: stats.total ? `${Math.round((stats.uploaded / stats.total) * 100)}%` : '0%',
        error: errorMessage
      },
      context: 'NewLegoRegistration.vue → waitForMigrationComplete()'
    })
  }

  /**
   * 워커 중지 알림
   */
  const alertWorkerStopped = async (workerType, lastHeartbeat) => {
    const timeSinceHeartbeat = lastHeartbeat 
      ? Math.round((Date.now() - new Date(lastHeartbeat).getTime()) / 1000 / 60)
      : 'N/A'

    return await sendSlackAlert({
      level: 'error',
      title: '⏹️ 워커 중지 감지',
      message: `${workerType} 워커가 중지되었습니다.\n마지막 하트비트: ${timeSinceHeartbeat}분 전`,
      metadata: {
        worker_type: workerType,
        last_heartbeat: lastHeartbeat,
        time_since_heartbeat: `${timeSinceHeartbeat} minutes`
      },
      context: 'useWorkerHealth.js → checkWorkerHealth()'
    })
  }

  /**
   * DB 오류 알림
   */
  const alertDatabaseError = async (operation, errorMessage, query = '') => {
    return await sendSlackAlert({
      level: 'error',
      title: '💾 데이터베이스 오류',
      message: `DB 작업 중 오류가 발생했습니다: ${operation}`,
      metadata: {
        operation,
        error: errorMessage,
        query: query.substring(0, 200) // 쿼리 최대 200자
      },
      context: 'Supabase'
    })
  }

  /**
   * 배치 처리 실패 알림
   */
  const alertBatchProcessingFailed = async (setNum, stats, errors) => {
    return await sendSlackAlert({
      level: 'warning',
      title: '📦 배치 처리 실패',
      message: `세트 ${setNum}의 배치 저장 중 일부 부품이 실패했습니다.`,
      metadata: {
        set_num: setNum,
        total_parts: stats.total || 0,
        saved_parts: stats.saved || 0,
        failed_parts: stats.failed || 0,
        failure_rate: stats.total ? `${Math.round((stats.failed / stats.total) * 100)}%` : '0%',
        sample_errors: errors.slice(0, 3) // 최대 3개 샘플
      },
      context: 'useBatchProcessing.js → batchProcessSet()'
    })
  }

  /**
   * 성공 알림 (중요한 작업 완료 시)
   */
  const alertSuccess = async (title, message, metadata = {}) => {
    return await sendSlackAlert({
      level: 'success',
      title,
      message,
      metadata,
      context: ''
    })
  }

  /**
   * 정보 알림
   */
  const alertInfo = async (title, message, metadata = {}) => {
    return await sendSlackAlert({
      level: 'info',
      title,
      message,
      metadata,
      context: ''
    })
  }

  /**
   * Slack 연결 테스트
   */
  const testSlackConnection = async () => {
    return await sendSlackAlert({
      level: 'info',
      title: '🧪 Slack 연결 테스트',
      message: 'BrickBox 메타데이터 시스템의 Slack 알림 시스템이 정상 작동합니다.',
      metadata: {
        timestamp: new Date().toISOString(),
        environment: import.meta.env.MODE || 'development'
      },
      context: 'useSlackAlert.js → testSlackConnection()'
    })
  }

  return {
    alertsEnabled,
    sendSlackAlert,
    alertLLMAnalysisFailed,
    alertMigrationFailed,
    alertWorkerStopped,
    alertDatabaseError,
    alertBatchProcessingFailed,
    alertSuccess,
    alertInfo,
    testSlackConnection
  }
}

/**
 * Slack Webhook URL 설정
 * (환경 변수 업데이트 시 호출)
 */
export function setSlackWebhookUrl(url) {
  webhookUrl.value = url
  alertsEnabled.value = !!url
  console.log('✅ Slack Webhook URL 업데이트:', url ? '설정됨' : '해제됨')
}

