import { ref, reactive } from 'vue'
import { supabase } from './useSupabase'
import { analyzePartWithLLM, generateTextEmbeddingsBatch, saveToMasterPartsDB } from './useMasterPartsPreprocessing'

/**
 * 백그라운드 LLM 분석 시스템
 * - OpenAI API 리밋 준수 (RPM: 500-1000, TPM: 40,000-80,000)
 * - 지수 백오프 재시도
 * - 작업 큐 관리
 */

// OpenAI API 리밋 설정
const API_LIMITS = {
  requestsPerMinute: 500, // 보수적으로 500 RPM 설정
  tokensPerMinute: 40000, // 보수적으로 40K TPM 설정
  maxConcurrent: 3, // 동시 요청 최대 3개
  requestDelay: 2000, // 요청 간 2초 대기
  retryDelay: 5000, // 재시도 시 5초 대기
  maxRetries: 3
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

export function useBackgroundLLMAnalysis() {
  
  /**
   * 백그라운드 LLM 분석 작업 시작
   */
  const startBackgroundAnalysis = async (setData, parts) => {
    console.log(`🚀 Starting background LLM analysis for set ${setData.set_num}`)
    console.log(`🔍 DEBUG: Set data:`, setData)
    console.log(`🔍 DEBUG: Parts count:`, parts.length)
    console.log(`🔍 DEBUG: First few parts:`, parts.slice(0, 3))
    
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
      errors: []
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
   * LLM 분석 실행
   */
  const executeLLMAnalysis = async (task) => {
    try {
      task.status = 'running'
      task.startTime = Date.now()
      
      console.log(`🤖 Starting background LLM analysis for ${task.setNum} (${task.totalParts} parts)`)
      
      // 1단계: LLM 분석 (리밋 준수)
      const analysisResults = []
      const batchSize = 1 // 한 번에 1개씩 처리
      
      for (let i = 0; i < task.parts.length; i++) {
        const part = task.parts[i]
        
        try {
          // 기존 분석 확인 (개발 모드에서는 강제 재실행)
          const existing = await checkExistingAnalysis(part.part.part_num, part.color.id)
          if (existing && !import.meta.env.DEV) {
            console.log(`⏭️ Skipping existing analysis for ${part.part.part_num}`)
            analysisResults.push({ ...existing, part: part.part, color: part.color })
            task.processedParts++
            task.progress = Math.round((task.processedParts / task.totalParts) * 50)
            continue
          } else if (existing && import.meta.env.DEV) {
            console.log(`🔄 DEV MODE: Re-analyzing existing part ${part.part.part_num}`)
          }
          
          // LLM 분석 실행 (리밋 준수)
          console.log(`🧠 Analyzing part ${i + 1}/${task.totalParts}: ${part.part.part_num}`)
          const analysis = await analyzePartWithRetry(part)
          
          if (analysis) {
            analysisResults.push({ ...analysis, part: part.part, color: part.color })
            task.processedParts++
          } else {
            task.failedParts++
            task.errors.push(`Failed to analyze ${part.part.part_num}`)
          }
          
          // 진행률 업데이트
          task.progress = Math.round((task.processedParts / task.totalParts) * 50)
          
          // API 리밋 준수: 요청 간 대기
          if (i < task.parts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, API_LIMITS.requestDelay))
          }
          
        } catch (error) {
          console.error(`❌ Analysis failed for ${part.part.part_num}:`, error)
          task.failedParts++
          task.errors.push(`Error analyzing ${part.part.part_num}: ${error.message}`)
        }
      }
      
      console.log(`✅ LLM analysis completed: ${analysisResults.length} parts analyzed`)
      
      // 2단계: 임베딩 생성
      console.log(`🔢 Generating embeddings...`)
      const needsEmbedding = analysisResults.filter(result => !result.embedding)
      
      if (needsEmbedding.length > 0) {
        const embeddingResults = await generateTextEmbeddingsBatch(needsEmbedding)
        console.log(`✅ Embeddings generated: ${embeddingResults.length} parts`)
        
        // 임베딩 결과 매핑
        let embeddingIndex = 0
        const combinedResults = analysisResults.map(analysis => {
          if (!analysis.embedding && embeddingIndex < embeddingResults.length) {
            return {
              ...analysis,
              embedding: embeddingResults[embeddingIndex++]
            }
          }
          return analysis
        })
        
        // 3단계: 데이터베이스 저장
        console.log(`💾 Saving to database...`)
        await saveToMasterPartsDB(combinedResults)
        console.log(`✅ Master data saved to database`)
      }
      
      task.progress = 100
      task.status = 'completed'
      task.endTime = Date.now()
      
      console.log(`🎉 Background LLM analysis completed for ${task.setNum}!`)
      
    } catch (error) {
      console.error(`❌ Background LLM analysis failed for ${task.setNum}:`, error)
      task.status = 'failed'
      task.errors.push(error.message)
    } finally {
      moveTaskToCompleted(task)
    }
  }
  
  /**
   * 재시도 로직이 포함된 LLM 분석
   */
  const analyzePartWithRetry = async (part, retryCount = 0) => {
    try {
      return await analyzePartWithLLM(part)
    } catch (error) {
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        if (retryCount < API_LIMITS.maxRetries) {
          const delay = API_LIMITS.retryDelay * Math.pow(2, retryCount) // 지수 백오프
          console.warn(`⏳ Rate limit hit, retrying in ${delay}ms (attempt ${retryCount + 1})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return await analyzePartWithRetry(part, retryCount + 1)
        }
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
    isProcessing
  }
}
