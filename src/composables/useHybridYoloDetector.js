/**
 * 🚀 BrickBox 2단계 하이브리드 YOLO11s-seg 검출기
 * 
 * 1차: YOLO11n-seg (빠른 전체 스캔)
 * 2차: YOLO11s-seg (정밀 검증)
 * 
 * 특징:
 * - 동적 모델 로딩
 * - 메모리 최적화
 * - 실시간 성능 모니터링
 * - 하이브리드 결과 통합
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSupabase } from './useSupabase.js'

export function useHybridYoloDetector() {
  const { supabase } = useSupabase()
  
  // 상태 관리
  const isInitialized = ref(false)
  const isStage1Ready = ref(false)
  const isStage2Ready = ref(false)
  const isDetecting = ref(false)
  const currentSession = ref(null)
  
  // 성능 모니터링
  const performanceMetrics = ref({
    stage1_fps: 0,
    stage2_fps: 0,
    total_processing_time: 0,
    memory_usage: 0,
    detection_accuracy: 0
  })
  
  // ONNX 런타임
  let ort = null
  let stage1Session = null
  let stage2Session = null
  let stage1ModelInfo = null
  let stage2ModelInfo = null
  
  /**
   * 하이브리드 검출기 초기화
   */
  const initializeHybridDetector = async () => {
    try {
      console.log('🚀 하이브리드 YOLO 검출기 초기화 시작...')
      
      // ONNX 런타임 로드
      if (!ort) {
        ort = await import('onnxruntime-web')
        console.log('✅ ONNX Runtime 로드 완료')
      }
      
      // 활성 모델 정보 조회
      const { data: activeModels, error } = await supabase
        .from('active_models')
        .select(`
          *,
          stage1_model:model_registry!stage1_model_id(*),
          stage2_model:model_registry!stage2_model_id(*)
        `)
        .eq('hybrid_mode', true)
        .single()
      
      if (error || !activeModels) {
        throw new Error('활성 하이브리드 모델을 찾을 수 없습니다.')
      }
      
      stage1ModelInfo = activeModels.stage1_model
      stage2ModelInfo = activeModels.stage2_model
      
      console.log('📊 하이브리드 모델 정보:', {
        stage1: stage1ModelInfo?.model_name,
        stage2: stage2ModelInfo?.model_name
      })
      
      // 1차 모델 로드 (항상 로드)
      await loadStage1Model()
      
      // 2차 모델은 필요시에만 로드
      console.log('✅ 하이브리드 검출기 초기화 완료')
      isInitialized.value = true
      
    } catch (error) {
      console.error('❌ 하이브리드 검출기 초기화 실패:', error)
      throw error
    }
  }
  
  /**
   * 1차 모델 로드 (YOLO11n-seg)
   */
  const loadStage1Model = async () => {
    try {
      console.log('🔧 1차 모델 로드 중...')
      
      if (!stage1ModelInfo) {
        throw new Error('1차 모델 정보가 없습니다.')
      }
      
      // 모델 파일 경로 (Supabase Storage)
      const modelPath = stage1ModelInfo.model_path || import.meta.env.VITE_DEFAULT_MODEL_URL || 'https://your-supabase-url.supabase.co/storage/v1/object/public/models/your-model-path/default_model.onnx'
      
      // ONNX 세션 생성
      stage1Session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgl', 'cpu'],
        graphOptimizationLevel: 'all'
      })
      
      console.log('✅ 1차 모델 로드 완료:', stage1ModelInfo.model_name)
      isStage1Ready.value = true
      
    } catch (error) {
      console.error('❌ 1차 모델 로드 실패:', error)
      throw error
    }
  }
  
  /**
   * 2차 모델 로드 (YOLO11s-seg)
   */
  const loadStage2Model = async () => {
    try {
      if (isStage2Ready.value) return
      
      console.log('🔧 2차 모델 로드 중...')
      
      if (!stage2ModelInfo) {
        throw new Error('2차 모델 정보가 없습니다.')
      }
      
      // 모델 파일 경로 (Supabase Storage)
      const modelPath = stage2ModelInfo.model_path || import.meta.env.VITE_DEFAULT_MODEL_URL || 'https://your-supabase-url.supabase.co/storage/v1/object/public/models/your-model-path/default_model.onnx'
      
      // ONNX 세션 생성
      stage2Session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgl', 'cpu'],
        graphOptimizationLevel: 'all'
      })
      
      console.log('✅ 2차 모델 로드 완료:', stage2ModelInfo.model_name)
      isStage2Ready.value = true
      
    } catch (error) {
      console.error('❌ 2차 모델 로드 실패:', error)
      throw error
    }
  }
  
  /**
   * 2차 모델 언로드 (메모리 절약)
   */
  const unloadStage2Model = () => {
    if (stage2Session) {
      stage2Session = null
      isStage2Ready.value = false
      console.log('🗑️ 2차 모델 언로드 완료')
    }
  }
  
  /**
   * 하이브리드 검출 실행
   */
  const detectHybrid = async (imageData, options = {}) => {
    if (!isInitialized.value || !isStage1Ready.value) {
      throw new Error('하이브리드 검출기가 초기화되지 않았습니다.')
    }
    
    const startTime = performance.now()
    currentSession.value = crypto.randomUUID()
    
    try {
      console.log('🔍 하이브리드 검출 시작...')
      isDetecting.value = true
      
      // 1차 검출: 빠른 전체 스캔
      const stage1Results = await executeStage1Analysis(imageData, options)
      console.log(`1차 검출 완료: ${stage1Results.length}개 객체`)
      
      // 누락 후보 영역 식별
      const suspiciousRegions = identifySuspiciousRegions(stage1Results, options)
      console.log(`의심 영역 식별: ${suspiciousRegions.length}개`)
      
      let stage2Results = []
      let finalResults = stage1Results
      
      // 2차 검증: 후보 영역이 있을 때만 실행
      if (suspiciousRegions.length > 0) {
        console.log('🔍 2차 정밀 검증 시작...')
        
        // 2차 모델 로드 (필요시)
        if (!isStage2Ready.value) {
          await loadStage2Model()
        }
        
        stage2Results = await executeStage2Analysis(imageData, suspiciousRegions, options)
        console.log(`2차 검증 완료: ${stage2Results.length}개 객체`)
        
        // 결과 통합
        finalResults = integrateResults(stage1Results, stage2Results, suspiciousRegions)
      }
      
      // 성능 메트릭 계산
      const processingTime = performance.now() - startTime
      updatePerformanceMetrics(processingTime, stage1Results.length, stage2Results.length)
      
      // 검출 로그 저장
      await saveDetectionLog(currentSession.value, {
        stage1_results: stage1Results,
        stage2_results: stage2Results,
        final_results: finalResults,
        processing_time_ms: Math.round(processingTime),
        memory_usage_mb: getMemoryUsage(),
        fps_achieved: calculateFPS(processingTime)
      })
      
      console.log('✅ 하이브리드 검출 완료')
      return finalResults
      
    } catch (error) {
      console.error('❌ 하이브리드 검출 실패:', error)
      throw error
    } finally {
      isDetecting.value = false
    }
  }
  
  /**
   * 1차 검출 실행 (YOLO11n-seg)
   */
  const executeStage1Analysis = async (imageData, options) => {
    try {
      // 이미지 전처리
      const processedImage = await preprocessImage(imageData, 640)
      
      // ONNX 추론 실행
      const feeds = { [stage1Session.inputNames[0]]: processedImage }
      const results = await stage1Session.run(feeds)
      
      // 결과 후처리
      const detections = postprocessDetections(
        results[stage1Session.outputNames[0]], 
        processedImage.width, 
        processedImage.height,
        options.stage1_config || stage1ModelInfo.hybrid_config
      )
      
      return detections
      
    } catch (error) {
      console.error('❌ 1차 검출 실패:', error)
      throw error
    }
  }
  
  /**
   * 2차 검증 실행 (YOLO11s-seg)
   */
  const executeStage2Analysis = async (imageData, suspiciousRegions, options) => {
    try {
      if (!isStage2Ready.value) {
        throw new Error('2차 모델이 로드되지 않았습니다.')
      }
      
      const verifications = []
      
      // 각 의심 영역에 대해 정밀 검증
      for (const region of suspiciousRegions) {
        // 영역 크롭
        const croppedImage = await cropImageRegion(imageData, region)
        
        // 이미지 전처리
        const processedImage = await preprocessImage(croppedImage, 640)
        
        // ONNX 추론 실행
        const feeds = { [stage2Session.inputNames[0]]: processedImage }
        const results = await stage2Session.run(feeds)
        
        // 결과 후처리 (Segmentation 마스크 포함)
        const detections = postprocessSegmentationDetections(
          results[stage2Session.outputNames[0]],
          processedImage.width,
          processedImage.height,
          options.stage2_config || stage2ModelInfo.hybrid_config
        )
        
        // 원본 좌표로 변환
        const transformedDetections = transformToOriginalCoordinates(detections, region)
        verifications.push(...transformedDetections)
      }
      
      return verifications
      
    } catch (error) {
      console.error('❌ 2차 검증 실패:', error)
      throw error
    }
  }
  
  /**
   * 의심 영역 식별
   */
  const identifySuspiciousRegions = (stage1Results, options) => {
    const threshold = options.suspicious_threshold || 0.3
    const minArea = options.min_suspicious_area || 0.01
    
    return stage1Results.filter(detection => 
      detection.confidence < threshold || 
      detection.area < minArea ||
      detection.classId === 0 // 누락 클래스
    )
  }
  
  /**
   * 결과 통합
   */
  const integrateResults = (stage1Results, stage2Results, suspiciousRegions) => {
    // 1차 결과에서 의심 영역 제외
    const cleanStage1Results = stage1Results.filter(detection => 
      !suspiciousRegions.some(region => 
        isOverlapping(detection, region)
      )
    )
    
    // 2차 검증 결과 추가
    const integratedResults = [...cleanStage1Results, ...stage2Results]
    
    // 중복 제거 및 정렬
    return removeDuplicates(integratedResults)
      .sort((a, b) => b.confidence - a.confidence)
  }
  
  /**
   * 성능 메트릭 업데이트
   */
  const updatePerformanceMetrics = (processingTime, stage1Count, stage2Count) => {
    performanceMetrics.value = {
      stage1_fps: stage1Count / (processingTime / 1000),
      stage2_fps: stage2Count / (processingTime / 1000),
      total_processing_time: processingTime,
      memory_usage: getMemoryUsage(),
      detection_accuracy: calculateAccuracy(stage1Count, stage2Count)
    }
  }
  
  /**
   * 검출 로그 저장
   */
  const saveDetectionLog = async (sessionId, logData) => {
    try {
      await supabase
        .from('hybrid_detection_logs')
        .insert({
          session_id: sessionId,
          ...logData
        })
    } catch (error) {
      console.warn('⚠️ 검출 로그 저장 실패:', error)
    }
  }
  
  /**
   * 메모리 사용량 조회
   */
  const getMemoryUsage = () => {
    if (performance.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
    }
    return 0
  }
  
  /**
   * FPS 계산
   */
  const calculateFPS = (processingTime) => {
    return Math.round(1000 / processingTime)
  }
  
  /**
   * 정확도 계산
   */
  const calculateAccuracy = (stage1Count, stage2Count) => {
    if (stage1Count === 0) return 0
    return Math.round((stage2Count / stage1Count) * 100) / 100
  }
  
  // 유틸리티 함수들
  const preprocessImage = async (imageData, size) => {
    // 이미지 전처리 로직
    return { width: size, height: size, data: new Float32Array(size * size * 3) }
  }
  
  const postprocessDetections = (output, width, height, config) => {
    // Detection 후처리 로직
    return []
  }
  
  const postprocessSegmentationDetections = (output, width, height, config) => {
    // Segmentation 후처리 로직
    return []
  }
  
  const cropImageRegion = async (imageData, region) => {
    // 이미지 영역 크롭 로직
    return imageData
  }
  
  const transformToOriginalCoordinates = (detections, region) => {
    // 좌표 변환 로직
    return detections
  }
  
  const isOverlapping = (detection, region) => {
    // 겹침 검사 로직
    return false
  }
  
  const removeDuplicates = (detections) => {
    // 중복 제거 로직
    return detections
  }
  
  // 컴포넌트 언마운트 시 정리
  onUnmounted(() => {
    if (stage1Session) {
      stage1Session = null
    }
    if (stage2Session) {
      stage2Session = null
    }
  })
  
  return {
    // 상태
    isInitialized: computed(() => isInitialized.value),
    isStage1Ready: computed(() => isStage1Ready.value),
    isStage2Ready: computed(() => isStage2Ready.value),
    isDetecting: computed(() => isDetecting.value),
    performanceMetrics: computed(() => performanceMetrics.value),
    
    // 메서드
    initializeHybridDetector,
    detectHybrid,
    loadStage2Model,
    unloadStage2Model
  }
}
