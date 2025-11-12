import { ref, reactive } from 'vue'
import { supabase } from './useSupabase'
import { analyzePartWithLLM, generateTextEmbeddingsBatch, saveToMasterPartsDB } from './useMasterPartsPreprocessing'
import { useAutoImageMigration } from './useAutoImageMigration'
import { useRateLimitMonitor } from './useRateLimitMonitor'

/**
 * 백그라운드 LLM 분석 시스템
 * - OpenAI API 리밋 준수 (RPM: 500-1000, TPM: 40,000-80,000)
 * - 지수 백오프 재시도
 * - 작업 큐 관리
 */

// OpenAI API 리밋 설정 (메모리 누수 방지)
const API_LIMITS = {
  requestsPerMinute: 100, // 100 RPM으로 대폭 감소
  tokensPerMinute: 50000, // 50K TPM으로 대폭 감소
  maxConcurrent: 1, // 동시 요청 1개로 제한 (안정성 우선)
  requestDelay: 2000, // 요청 간 2초로 증가
  retryDelay: 5000, // 재시도 시 5초로 증가
  maxRetries: 2, // 재시도 횟수 감소
  rateLimitRetryDelay: 60000, // Rate limit 시 60초 대기
  maxRateLimitRetries: 3 // Rate limit 재시도 횟수 감소
}

// 작업 큐 상태
const taskQueue = reactive({
  pending: [],
  running: [],
  completed: [],
  failed: []
})

// 현재 실행 중인 작업
const currentTasks = ref(new Map())
const isProcessing = ref(false)

// Rate limit 방지를 위한 요청 간격 관리
let lastRequestTime = 0
const minRequestInterval = 500 // 최소 0.5초 간격으로 단축

export function useBackgroundLLMAnalysis() {
  
  // Rate limit 모니터 초기화
  const rateLimitMonitor = useRateLimitMonitor()
  
  /**
   * Rate limit 방지를 위한 요청 간격 강제
   */
  const enforceRequestInterval = async () => {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    
    if (timeSinceLastRequest < minRequestInterval) {
      const waitTime = minRequestInterval - timeSinceLastRequest
      // 대기 시간이 짧으면 로그 제거
      if (waitTime > 100) {
        console.log(`⏳ Rate limit 방지: ${waitTime}ms 대기 중...`)
      }
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    lastRequestTime = Date.now()
  }
  
  /**
   * 백그라운드 LLM 분석 작업 시작
   */
  const startBackgroundAnalysis = async (setData, parts) => {
    console.log(`🚀 Starting background LLM analysis for set ${setData.set_num}`)
    console.log(`🔍 DEBUG: Set data:`, setData)
    console.log(`🔍 DEBUG: Parts count:`, parts.length)
    console.log(`🔍 DEBUG: First few parts:`, parts.slice(0, 3))
    
    // 이미지 마이그레이션 시스템 초기화 (한 번만 초기화)
    if (!window.imageMigrationInstance) {
      window.imageMigrationInstance = useAutoImageMigration()
    }
    const imageMigration = window.imageMigrationInstance
    
    const taskId = `llm-analysis-${setData.set_num}-${Date.now()}`
    
    const task = {
      id: taskId,
      setNum: setData.set_num,
      setName: setData.name,
      parts: parts,
      status: 'pending',
      progress: 0,
      startTime: null,
      endTime: null,
      totalParts: parts.length,
      processedParts: 0,
      failedParts: 0,
      errors: [],
      imageMigration: imageMigration // 이미지 마이그레이션 시스템 추가
    }
    
    console.log(`📋 Created task:`, task)
    
    // 작업 큐에 추가
    taskQueue.pending.push(task)
    console.log(`📋 Task added to queue. Queue length:`, taskQueue.pending.length)
    
    // 백그라운드 처리 시작 (비동기)
    processTaskQueue()
    
    return taskId
  }
  
  /**
   * 작업 큐 처리
   */
  const processTaskQueue = async () => {
    if (isProcessing.value) return
    if (taskQueue.pending.length === 0) return
    
    isProcessing.value = true
    
    try {
      while (taskQueue.pending.length > 0 && currentTasks.value.size < API_LIMITS.maxConcurrent) {
        const task = taskQueue.pending.shift()
        taskQueue.running.push(task)
        currentTasks.value.set(task.id, task)
        
        // 백그라운드에서 실행
        executeLLMAnalysis(task).catch(error => {
          console.error(`Task ${task.id} failed:`, error)
          task.status = 'failed'
          task.errors.push(error.message)
          moveTaskToCompleted(task)
        })
      }
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * LLM 분석 실행 (배치 처리)
   */
  const executeLLMAnalysis = async (task) => {
    const analysisStartTime = Date.now()
    
    try {
      task.status = 'running'
      task.startTime = Date.now()
      
      console.log(`🤖 [LLM 분석 시작] ${task.setNum} (${task.totalParts}개 부품)`)
      console.log(`⏰ [시작 시간] ${new Date().toLocaleTimeString()}`)
      
      // ✅ 1단계: LLM 분석 (배치 크기 엄격 제한)
      const analysisResults = []
      const BATCH_SIZE = 2 // 한 번에 2개씩 처리 (무한루프 완전 방지)
      
      // 배치 생성
      const batches = []
      for (let i = 0; i < task.parts.length; i += BATCH_SIZE) {
        batches.push(task.parts.slice(i, i + BATCH_SIZE))
      }
      
      console.log(`📦 Created ${batches.length} batches of ${BATCH_SIZE} parts each`)
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} parts)...`)
        
        // 배치 내 부품을 순차 처리 (무한루프 완전 방지)
        const CONCURRENT_LIMIT = 1
        const batchResults = []
        
        for (let i = 0; i < batch.length; i += CONCURRENT_LIMIT) {
          const concurrentBatch = batch.slice(i, i + CONCURRENT_LIMIT)
          
          // 동시 처리 전에 요청 간격 제어
          await enforceRequestInterval()
          
          const concurrentResults = await Promise.allSettled(
            concurrentBatch.map(async (part) => {
            try {
              // 기존 분석 확인 (개발 모드에서는 강제 재실행)
              const existing = await checkExistingAnalysis(part.part.part_num, part.color.id)
              if (existing && !import.meta.env.DEV) {
                console.log(`⏭️ Skipping existing analysis for ${part.part.part_num}`)
                return { ...existing, part: part.part, color: part.color, skipped: true }
              } else if (existing && import.meta.env.DEV) {
                console.log(`🔄 DEV MODE: Re-analyzing existing part ${part.part.part_num}`)
              }
              
              // 이미지 URL 가져오기 (버킷 이미지 우선 사용, element_id 우선)
              let imageUrl = null
              let imageSource = 'unknown'
              const elementId = part.element_id || null
              
              // 1. part_images에서 uploaded_url 조회 (element_id 우선, 최신 버킷 이미지)
              if (elementId) {
                const { data: partImageByElement } = await supabase
                  .from('part_images')
                  .select('uploaded_url')
                  .eq('element_id', String(elementId))
                  .not('uploaded_url', 'is', null)
                  .maybeSingle()
                
                if (partImageByElement?.uploaded_url) {
                  imageUrl = partImageByElement.uploaded_url
                  imageSource = 'part_images_element_id'
                  console.log(`✅ Supabase Storage 버킷 이미지 사용 (element_id): ${imageUrl}`)
                }
              }
              
              // element_id로 찾지 못했거나 element_id가 없으면 part_id + color_id로 조회
              if (!imageUrl) {
                const { data: partImage } = await supabase
                  .from('part_images')
                  .select('uploaded_url')
                  .eq('part_id', part.part.part_num)
                  .eq('color_id', part.color.id)
                  .maybeSingle()
                
                if (partImage?.uploaded_url) {
                  imageUrl = partImage.uploaded_url
                  imageSource = 'part_images'
                  console.log(`✅ Supabase Storage 버킷 이미지 사용: ${imageUrl}`)
                }
              }
              
              if (!imageUrl) {
                // 2. image_metadata에서 supabase_url 조회 (element_id 우선, 과거 호환)
                if (elementId) {
                  const { data: imageMetaByElement } = await supabase
                    .from('image_metadata')
                    .select('supabase_url')
                    .eq('element_id', String(elementId))
                    .not('supabase_url', 'is', null)
                    .maybeSingle()
                  
                  if (imageMetaByElement?.supabase_url) {
                    imageUrl = imageMetaByElement.supabase_url
                    imageSource = 'image_metadata_element_id'
                    console.log(`✅ image_metadata 버킷 이미지 사용 (element_id): ${imageUrl}`)
                  }
                }
                
                // element_id로 찾지 못했거나 element_id가 없으면 part_num + color_id로 조회
                if (!imageUrl) {
                  const { data: imageMeta } = await supabase
                    .from('image_metadata')
                    .select('supabase_url')
                    .eq('part_num', part.part.part_num)
                    .eq('color_id', part.color.id)
                    .maybeSingle()
                  
                  if (imageMeta?.supabase_url) {
                    imageUrl = imageMeta.supabase_url
                    imageSource = 'image_metadata'
                    console.log(`✅ image_metadata 버킷 이미지 사용: ${imageUrl}`)
                  }
                }
                
                if (!imageUrl) {
                  // 3. 이미지 마이그레이션 완료 대기 (최대 3초)
                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
                  const bucketName = 'lego_parts_images'
                  const fileName = elementId ? `${String(elementId)}.webp` : `${part.part.part_num}_${part.color.id}.webp`
                  const storageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
                  
                  console.log(`⏳ 이미지 마이그레이션 완료 대기 중... (${part.part.part_num})`)
                  
                  // 이미지 마이그레이션 완료 대기 (최대 5초, 500ms 간격)
                  let imageExists = false
                  for (let attempt = 0; attempt < 10; attempt++) {
                    try {
                      const response = await fetch(storageUrl, { 
                        method: 'HEAD', // HEAD 요청으로 더 빠른 확인
                        signal: AbortSignal.timeout(1000) // 1초 타임아웃
                      })
                      
                      if (response.ok) {
                        const contentType = response.headers.get('content-type')
                        const contentLength = response.headers.get('content-length')
                        const isImage = contentType && contentType.includes('image/')
                        const hasContent = contentLength && parseInt(contentLength) > 0
                        
                        if (isImage && hasContent) {
                          imageUrl = storageUrl
                          imageSource = 'storage_verified'
                          imageExists = true
                          console.log(`✅ Supabase Storage 버킷 이미지 사용(대기 후): ${imageUrl}`)
                          break
                        }
                      }
                      
                      console.log(`⏳ 이미지 마이그레이션 대기 중... (${attempt + 1}/10)`)
                      await new Promise(resolve => setTimeout(resolve, 500)) // 500ms 대기
                    } catch (fetchError) {
                      console.log(`⏳ 이미지 마이그레이션 대기 중... (${attempt + 1}/10) - ${fetchError.message}`)
                      await new Promise(resolve => setTimeout(resolve, 500)) // 500ms 대기
                    }
                  }
                  
                  if (!imageExists) {
                    // 4. 생성된 Storage URL 사용 (가정)
                    imageUrl = storageUrl
                    imageSource = 'generated_url'
                    console.log(`⚠️ 생성된 Storage URL (가정): ${imageUrl}`)
                  }
                }
              }
              
              // 이미지 URL이 없으면 건너뛰기
              if (!imageUrl) {
                console.warn(`⚠️ ${part.part.part_num} 이미지 URL 없음, 건너뛰기`)
                throw new Error('이미지 URL 없음')
              }
              
              // part 객체에 이미지 URL 추가 (WebP 우선 사용)
              const partWithImage = {
                ...part,
                supabase_image_url: imageUrl,
                image_url: imageUrl,
                llm_image_url: imageUrl, // LLM 분석용 WebP 이미지
                image_source: imageSource // 이미지 소스 추적
              }
              
              // LLM 분석 실행 (재시도 포함)
              console.log(`🧠 Analyzing ${part.part.part_num} (이미지 소스: ${imageSource})`)
              const analysis = await analyzePartWithRetry(partWithImage)
              
              if (!analysis) {
                throw new Error(`Analysis returned null for ${part.part.part_num}`)
              }
              
              return { ...analysis, part: part.part, color: part.color }
            } catch (error) {
              throw {
                partNum: part.part.part_num,
                error: error.message
              }
            }
            })
          )
          
          batchResults.push(...concurrentResults)
        }
        
        // 배치 결과 처리
        batchResults.forEach((promiseResult) => {
          if (promiseResult.status === 'fulfilled') {
            analysisResults.push(promiseResult.value)
            if (!promiseResult.value.skipped) {
              task.processedParts++
            }
          } else {
            task.failedParts++
            task.errors.push(`Error analyzing ${promiseResult.reason.partNum}: ${promiseResult.reason.error}`)
          }
        })
        
        // 진행률 업데이트
        task.progress = Math.round((task.processedParts / task.totalParts) * 50)
        
        // 배치 간 대기 (API 리밋 준수) - 배치당 3초로 증가
        if (batchIndex < batches.length - 1) {
          console.log(`⏳ 배치 간 대기 중... (${API_LIMITS.requestDelay}ms)`)
          await new Promise(resolve => setTimeout(resolve, API_LIMITS.requestDelay))
        }
      }
      
      console.log(`✅ LLM analysis completed: ${analysisResults.length} parts analyzed`)

      // 🤖 백그라운드 LLM 분석: 메타데이터 저장 후 자동 임베딩 생성
      console.log(`💾 Saving analysis results to database (embedding queued as pending)...`)
      await saveToMasterPartsDB(analysisResults)
      console.log(`✅ Master data saved to database (worker will generate embeddings)`)

      // 🤖 백그라운드 LLM 분석: 자동 임베딩 큐에 추가
      try {
        console.log('📥 Queueing CLIP embeddings for saved parts (pending)...')
        const uniquePairs = new Set()
        for (const r of analysisResults) {
          const partNum = r.part_num || r.part?.part_num
          const colorId = (r.color_id !== undefined && r.color_id !== null)
            ? r.color_id
            : (r.color?.id !== undefined ? r.color.id : 0)
          if (!partNum) continue
          uniquePairs.add(`${partNum}__${colorId}`)
        }

        const updates = []
        for (const key of uniquePairs) {
          const [partNum, colorIdStr] = key.split('__')
          const colorId = Number(colorIdStr)
          updates.push(
            supabase
              .from('parts_master_features')
              .update({ embedding_status: 'pending', updated_at: new Date().toISOString() })
              .eq('part_id', partNum)
              .eq('color_id', colorId)
              .is('clip_text_emb', null)
          )
        }
        const results = await Promise.allSettled(updates)
        const ok = results.filter(r => r.status === 'fulfilled').length
        console.log(`✅ Embedding queued: ${ok}/${updates.length}`)
      } catch (queueErr) {
        console.warn('⚠️ Failed to queue embeddings:', queueErr?.message)
      }

      console.log(`✅ Master data saved; worker will generate embeddings automatically`) // 🔧 수정됨
      
      task.progress = 100
      task.status = 'completed'
      task.endTime = Date.now()
      
      const totalTime = Date.now() - analysisStartTime
      console.log(`🎉 [LLM 분석 완료] ${task.setNum} - 총 소요시간: ${Math.round(totalTime / 1000)}초`)
      console.log(`⏰ [완료 시간] ${new Date().toLocaleTimeString()}`)
      
    } catch (error) {
      console.error(`❌ Background LLM analysis failed for ${task.setNum}:`, error)
      task.status = 'failed'
      task.errors.push(error.message)
    } finally {
      moveTaskToCompleted(task)
    }
  }
  
  /**
   * 재시도 로직이 포함된 LLM 분석 (강화된 Rate Limit 처리)
   */
  const analyzePartWithRetry = async (part, retryCount = 0, rateLimitRetryCount = 0) => {
    try {
      // Rate limit 방지를 위한 요청 간격 강제
      await enforceRequestInterval()
      
      const result = await analyzePartWithLLM(part)
      
      // 성공적인 요청 통계 업데이트 (대략적인 토큰 수 추정)
      rateLimitMonitor.updateRequestStats(1000) // 평균 1000 토큰으로 추정
      
      // 결과가 null인 경우 (JSON 파싱 실패 등) 재시도
      if (result === null && retryCount < API_LIMITS.maxRetries) {
        console.warn(`⚠️ LLM 분석 결과가 null, 재시도 중... (시도 ${retryCount + 1})`)
        const delay = API_LIMITS.retryDelay * Math.pow(2, retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        return await analyzePartWithRetry(part, retryCount + 1, rateLimitRetryCount)
      }
      
      return result
    } catch (error) {
      // Rate limit 오류 처리 (별도 카운터 사용)
      if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('Rate limit')) {
        if (rateLimitRetryCount < API_LIMITS.maxRateLimitRetries) {
          // Rate limit 모니터에 오류 전달
          const waitTime = rateLimitMonitor.handleRateLimitError(error)
          
          console.warn(`⏳ Rate limit exceeded. Waiting ${waitTime}ms (${(waitTime/1000).toFixed(1)}s) - 시도 ${rateLimitRetryCount + 1}/${API_LIMITS.maxRateLimitRetries}`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          return await analyzePartWithRetry(part, retryCount, rateLimitRetryCount + 1)
        } else {
          console.error(`❌ Rate limit 재시도 한계 도달 (${API_LIMITS.maxRateLimitRetries}회)`)
          throw new Error(`Rate limit 재시도 한계 도달: ${error.message}`)
        }
      }
      
      // 일반 오류 재시도
      if (retryCount < API_LIMITS.maxRetries) {
        const delay = API_LIMITS.retryDelay * Math.pow(2, retryCount)
        console.warn(`⚠️ API 오류, 재시도 중... (${delay}ms 후 시도 ${retryCount + 1})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return await analyzePartWithRetry(part, retryCount + 1, rateLimitRetryCount)
      }
      
      throw error
    }
  }
  
  /**
   * 기존 분석 확인
   */
  const checkExistingAnalysis = async (partNum, colorId) => {
    try {
      const { data, error } = await supabase
        .from('parts_master_features')
        .select('part_id,color_id,feature_json,feature_text,confidence,recognition_hints,similar_parts,distinguishing_features,has_stud,groove,center_stud')
        .eq('part_id', partNum)
        .eq('color_id', colorId)
        .maybeSingle()
      
      return error ? null : data
    } catch {
      return null
    }
  }
  
  /**
   * 작업을 완료 목록으로 이동
   */
  const moveTaskToCompleted = (task) => {
    const runningIndex = taskQueue.running.findIndex(t => t.id === task.id)
    if (runningIndex !== -1) {
      taskQueue.running.splice(runningIndex, 1)
    }
    
    if (task.status === 'completed') {
      taskQueue.completed.push(task)
    } else {
      taskQueue.failed.push(task)
    }
    
    currentTasks.value.delete(task.id)
    
    // 다음 작업 처리
    processTaskQueue()
  }
  
  /**
   * 실행 중인 작업 조회
   */
  const getRunningTasks = () => {
    return Array.from(currentTasks.value.values())
  }
  
  /**
   * 작업 상태 조회
   */
  const getTaskStatus = (taskId) => {
    return currentTasks.value.get(taskId) || 
           taskQueue.completed.find(t => t.id === taskId) ||
           taskQueue.failed.find(t => t.id === taskId)
  }
  
  /**
   * 작업 큐 상태 조회
   */
  const getQueueStatus = () => {
    return {
      pending: taskQueue.pending.length,
      running: taskQueue.running.length,
      completed: taskQueue.completed.length,
      failed: taskQueue.failed.length,
      total: taskQueue.pending.length + taskQueue.running.length + taskQueue.completed.length + taskQueue.failed.length
    }
  }
  
  /**
   * 작업 큐 초기화
   */
  const clearQueue = () => {
    taskQueue.pending = []
    taskQueue.running = []
    taskQueue.completed = []
    taskQueue.failed = []
    currentTasks.value.clear()
  }
  
  return {
    startBackgroundAnalysis,
    getRunningTasks,
    getTaskStatus,
    getQueueStatus,
    clearQueue,
    isProcessing,
    // Rate limit 정보 제공
    getRateLimitInfo: () => ({
      limits: API_LIMITS,
      lastRequestTime,
      minRequestInterval
    }),
    // Rate limit 모니터 노출
    rateLimitMonitor
  }
}
