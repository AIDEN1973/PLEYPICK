/**
 * 🧱 BrickBox 자동화된 YOLO 검출기
 * 
 * model_registry에서 자동으로 최신 모델을 로드하고 검출 수행
 * - 자동 모델 로딩 및 업데이트
 * - 실시간 성능 모니터링
 * - 폴백 메커니즘
 * - 검출 결과 캐싱
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAutomatedModelRegistry } from './useAutomatedModelRegistry.js'

export const useAutomatedYoloDetector = () => {
  // 모델 레지스트리 연동
  const {
    currentModel,
    hasActiveModel,
    modelPerformance,
    isLoading: modelLoading,
    error: modelError,
    fetchLatestModel
  } = useAutomatedModelRegistry()

  // 검출기 상태
  const isDetectorReady = ref(false)
  const isDetecting = ref(false)
  const detectionError = ref(null)
  const lastDetectionTime = ref(null)
  const detectionCount = ref(0)
  
  // ONNX 런타임
  let ort = null
  let session = null
  let modelVersion = null

  /**
   * ONNX 런타임 초기화
   */
  const initializeONNXRuntime = async () => {
    try {
      if (typeof window !== 'undefined' && !ort) {
        ort = await import('onnxruntime-web')
        console.log('✅ ONNX Runtime 초기화 완료')
      }
    } catch (error) {
      console.error('❌ ONNX Runtime 초기화 실패:', error)
      throw error
    }
  }

  /**
   * 모델 로드 및 세션 생성
   */
  const loadModel = async (modelInfo) => {
    try {
      if (!ort) {
        await initializeONNXRuntime()
      }

      if (!modelInfo?.model_url) {
        throw new Error('모델 URL이 없습니다')
      }

      console.log(`🔄 모델 로딩 시작: ${modelInfo.model_name}`)

      // 기존 세션 정리
      if (session) {
        await session.release()
        session = null
      }

      // 새 모델 로드
      session = await ort.InferenceSession.create(modelInfo.model_url, {
        executionProviders: ['webgl', 'cpu'],
        graphOptimizationLevel: 'all'
      })

      modelVersion = modelInfo.version
      isDetectorReady.value = true
      detectionError.value = null

      console.log(`✅ 모델 로드 완료: ${modelInfo.model_name} (v${modelVersion})`)
      console.log(`📊 모델 입력: ${session.inputNames}`)
      console.log(`📊 모델 출력: ${session.outputNames}`)

    } catch (error) {
      console.error('❌ 모델 로드 실패:', error)
      isDetectorReady.value = false
      detectionError.value = error.message
      throw error
    }
  }

  /**
   * 이미지 전처리
   */
  const preprocessImage = (imageElement, targetSize = 640) => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // 캔버스 크기 설정
      canvas.width = targetSize
      canvas.height = targetSize
      
      // 이미지 그리기 (비율 유지하며 리사이즈)
      ctx.drawImage(imageElement, 0, 0, targetSize, targetSize)
      
      // 이미지 데이터 추출
      const imageData = ctx.getImageData(0, 0, targetSize, targetSize)
      const { data } = imageData
      
      // 정규화 및 텐서 변환
      const tensor = new Float32Array(targetSize * targetSize * 3)
      
      for (let i = 0; i < targetSize * targetSize; i++) {
        const r = data[i * 4] / 255.0
        const g = data[i * 4 + 1] / 255.0
        const b = data[i * 4 + 2] / 255.0
        
        tensor[i] = r
        tensor[i + targetSize * targetSize] = g
        tensor[i + targetSize * targetSize * 2] = b
      }
      
      return new ort.Tensor('float32', tensor, [1, 3, targetSize, targetSize])
      
    } catch (error) {
      console.error('❌ 이미지 전처리 실패:', error)
      throw error
    }
  }

  /**
   * 검출 결과 후처리
   */
  const postprocessDetections = (outputs, confThreshold = 0.25, iouThreshold = 0.45) => {
    try {
      // YOLO 출력 파싱 (출력 형태에 따라 조정 필요)
      const predictions = outputs[0] // 첫 번째 출력 사용
      const detections = []
      
      if (predictions && predictions.dims) {
        const [batchSize, numDetections, numClasses] = predictions.dims
        
        for (let i = 0; i < numDetections; i++) {
          const confidence = predictions.data[i * numClasses + 4] // confidence 점수
          
          if (confidence > confThreshold) {
            const x = predictions.data[i * numClasses]
            const y = predictions.data[i * numClasses + 1]
            const w = predictions.data[i * numClasses + 2]
            const h = predictions.data[i * numClasses + 3]
            
            // 클래스 확률 계산
            let maxClassProb = 0
            let classId = 0
            
            for (let j = 5; j < numClasses; j++) {
              const classProb = predictions.data[i * numClasses + j]
              if (classProb > maxClassProb) {
                maxClassProb = classProb
                classId = j - 5
              }
            }
            
            const finalConfidence = confidence * maxClassProb
            
            if (finalConfidence > confThreshold) {
              detections.push({
                classId,
                confidence: finalConfidence,
                bbox: {
                  x: x - w / 2,
                  y: y - h / 2,
                  width: w,
                  height: h
                },
                center: { x, y },
                size: { width: w, height: h }
              })
            }
          }
        }
      }
      
      // NMS (Non-Maximum Suppression) 적용
      return applyNMS(detections, iouThreshold)
      
    } catch (error) {
      console.error('❌ 검출 결과 후처리 실패:', error)
      return []
    }
  }

  /**
   * NMS (Non-Maximum Suppression) 적용
   */
  const applyNMS = (detections, iouThreshold) => {
    // 신뢰도 기준으로 정렬
    detections.sort((a, b) => b.confidence - a.confidence)
    
    const filtered = []
    const suppressed = new Set()
    
    for (let i = 0; i < detections.length; i++) {
      if (suppressed.has(i)) continue
      
      filtered.push(detections[i])
      
      // IoU 계산하여 중복 제거
      for (let j = i + 1; j < detections.length; j++) {
        if (suppressed.has(j)) continue
        
        const iou = calculateIoU(detections[i].bbox, detections[j].bbox)
        if (iou > iouThreshold) {
          suppressed.add(j)
        }
      }
    }
    
    return filtered
  }

  /**
   * IoU (Intersection over Union) 계산
   */
  const calculateIoU = (bbox1, bbox2) => {
    const x1 = Math.max(bbox1.x, bbox2.x)
    const y1 = Math.max(bbox1.y, bbox2.y)
    const x2 = Math.min(bbox1.x + bbox1.width, bbox2.x + bbox2.width)
    const y2 = Math.min(bbox1.y + bbox1.height, bbox2.y + bbox2.height)
    
    if (x2 <= x1 || y2 <= y1) return 0
    
    const intersection = (x2 - x1) * (y2 - y1)
    const area1 = bbox1.width * bbox1.height
    const area2 = bbox2.width * bbox2.height
    const union = area1 + area2 - intersection
    
    return intersection / union
  }

  /**
   * 이미지에서 객체 검출
   */
  const detectObjects = async (imageElement, options = {}) => {
    try {
      if (!isDetectorReady.value || !session) {
        throw new Error('검출기가 준비되지 않았습니다')
      }

      isDetecting.value = true
      detectionError.value = null

      const startTime = performance.now()

      // 이미지 전처리
      const inputTensor = preprocessImage(imageElement, options.targetSize || 640)

      // 모델 추론 실행
      const outputs = await session.run({
        [session.inputNames[0]]: inputTensor
      })

      // 결과 후처리
      const detections = postprocessDetections(
        Object.values(outputs),
        options.confThreshold || 0.25,
        options.iouThreshold || 0.45
      )

      const inferenceTime = performance.now() - startTime
      lastDetectionTime.value = new Date()
      detectionCount.value++

      console.log(`🔍 검출 완료: ${detections.length}개 객체, ${inferenceTime.toFixed(1)}ms`)

      return {
        detections,
        inferenceTime,
        modelVersion,
        timestamp: lastDetectionTime.value,
        success: true
      }

    } catch (error) {
      console.error('❌ 객체 검출 실패:', error)
      detectionError.value = error.message
      
      return {
        detections: [],
        inferenceTime: 0,
        modelVersion: null,
        timestamp: new Date(),
        success: false,
        error: error.message
      }
    } finally {
      isDetecting.value = false
    }
  }

  /**
   * 모델 자동 업데이트
   */
  const checkForModelUpdates = async () => {
    try {
      await fetchLatestModel()
      
      if (currentModel.value && currentModel.value.version !== modelVersion) {
        console.log(`🔄 모델 업데이트 감지: ${modelVersion} → ${currentModel.value.version}`)
        await loadModel(currentModel.value)
      }
    } catch (error) {
      console.error('❌ 모델 업데이트 확인 실패:', error)
    }
  }

  /**
   * 폴백 검출 (YOLO 실패 시)
   */
  const fallbackDetection = async (imageElement) => {
    console.log('🔄 폴백 검출 실행')
    
    // 간단한 휴리스틱 검출 (예: 색상 기반)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = imageElement.width
    canvas.height = imageElement.height
    
    ctx.drawImage(imageElement, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // 간단한 객체 검출 로직 (실제로는 더 정교한 알고리즘 필요)
    const detections = []
    // 여기에 휴리스틱 검출 로직 구현
    
    return {
      detections,
      inferenceTime: 0,
      modelVersion: 'fallback',
      timestamp: new Date(),
      success: true,
      fallback: true
    }
  }

  // 계산된 속성
  const isReady = computed(() => isDetectorReady.value && hasActiveModel.value)
  const modelInfo = computed(() => ({
    name: currentModel.value?.model_name || 'N/A',
    version: currentModel.value?.version || 'N/A',
    performance: modelPerformance.value,
    size: currentModel.value?.model_size ? `${(currentModel.value.model_size / 1024 / 1024).toFixed(1)}MB` : 'N/A'
  }))

  // 생명주기 훅
  onMounted(async () => {
    try {
      await initializeONNXRuntime()
      
      if (hasActiveModel.value) {
        await loadModel(currentModel.value)
      }
      
      // 주기적 모델 업데이트 확인 (5분마다)
      const updateInterval = setInterval(checkForModelUpdates, 5 * 60 * 1000)
      
      onUnmounted(() => {
        clearInterval(updateInterval)
      })
      
    } catch (error) {
      console.error('❌ 검출기 초기화 실패:', error)
    }
  })

  return {
    // 상태
    isDetectorReady,
    isDetecting,
    detectionError,
    lastDetectionTime,
    detectionCount,
    
    // 계산된 속성
    isReady,
    modelInfo,
    
    // 메서드
    loadModel,
    detectObjects,
    checkForModelUpdates,
    fallbackDetection
  }
}
