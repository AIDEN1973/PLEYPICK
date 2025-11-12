import { ref, reactive } from 'vue'
import { useHungarianAssignment } from './useHungarianAssignment.js'
import { useBOMConstraint } from './useBOMConstraint.js'
import { useFAISSTwoStageSearch } from './useFAISSTwoStageSearch.js'
import { useAdaptiveFusion } from './useAdaptiveFusion.js'

/**
 * 통합 파이프라인 구현 (기술문서 전체 아키텍처)
 * YOLO → FAISS → Adaptive Fusion → BOM 제약 → 헝가리안 할당
 */
export function useIntegratedPipeline() {
  const loading = ref(false)
  const error = ref(null)
  const pipelineStats = reactive({
    totalFrames: 0,
    successfulDetections: 0,
    bomViolations: 0,
    hungarianAssignments: 0,
    averageProcessingTime: 0
  })

  // 하위 모듈 초기화
  const hungarianAssignment = useHungarianAssignment()
  const bomConstraint = useBOMConstraint()
  const faissSearch = useFAISSTwoStageSearch()
  const adaptiveFusion = useAdaptiveFusion()

  // 통합 파이프라인 설정
  const pipelineConfig = {
    // 기술문서 핵심 설계 철학
    designPhilosophy: {
      detectionIsNotIdentification: true,  // 탐지/식별 분리
      closedWorldByBOM: true,             // BOM 제약 폐쇄 환경
      searchSmallAdaptively: true,        // Two-Stage + Fusion 동적 가중
      compressSmart: true                 // WebP q=90 + SSIM 0.965
    },
    
    // 파이프라인 단계별 설정
    stages: {
      detection: {
        enabled: true,
        model: 'YOLO11s-seg',
        confidence: 0.15,
        iou: 0.60,
        maxDetections: 1200
      },
      
      embedding: {
        enabled: true,
        clipEnabled: true,
        fgcEnabled: false,  // 연구 단계
        batchSize: 64
      },
      
      search: {
        enabled: true,
        twoStage: true,
        stage1TopK: 5,
        stage2TopK: 10
      },
      
      fusion: {
        enabled: true,
        adaptive: true,
        autoTuning: true
      },
      
      bomConstraint: {
        enabled: true,
        strictMode: true,
        trackUsage: true
      },
      
      assignment: {
        enabled: true,
        hungarian: true,
        hierarchical: true,
        async: true
      }
    },
    
    // 성능 최적화
    performance: {
      parallelProcessing: true,
      batchSize: 32,
      cacheEnabled: true,
      gpuAcceleration: true
    }
  }

  /**
   * 통합 파이프라인 실행
   */
  const executePipeline = async (frameData, setNum) => {
    const startTime = performance.now()
    
    try {
      loading.value = true
      error.value = null
      
      console.log(`🚀 통합 파이프라인 시작: 세트 ${setNum}`)
      
      // 1. BOM 데이터 로드
      console.log('📋 Step 1: BOM 데이터 로드')
      const bomResult = await bomConstraint.loadBOMData(setNum)
      if (!bomResult.success) {
        throw new Error(`BOM 데이터 로드 실패: ${bomResult.error}`)
      }
      
      // 2. 탐지 (YOLO) - 실제 구현에서는 YOLO 모델 호출
      console.log('🎯 Step 2: 객체 탐지 (YOLO)')
      const detections = await performDetection(frameData)
      
      if (detections.length === 0) {
        console.log('🔍 탐지된 객체가 없습니다')
        return {
          success: true,
          detections: [],
          assignments: [],
          stats: { processingTime: performance.now() - startTime }
        }
      }
      
      // 3. 임베딩 추출
      console.log('🧠 Step 3: 임베딩 추출')
      const embeddings = await extractEmbeddings(detections)
      
      // 4. FAISS Two-Stage 검색
      console.log('🔍 Step 4: FAISS Two-Stage 검색')
      const searchResults = await performTwoStageSearch(embeddings)
      
      // 5. Adaptive Fusion
      console.log('🔄 Step 5: Adaptive Fusion')
      const fusionResults = await performAdaptiveFusion(searchResults, detections)
      
      // 6. BOM 제약 필터링
      console.log('📋 Step 6: BOM 제약 필터링')
      const bomFilteredResults = bomConstraint.filterByBOMConstraints(fusionResults)
      
      // 7. 헝가리안 할당
      console.log('🎯 Step 7: 헝가리안 할당')
      const assignmentResult = await hungarianAssignment.performAssignment(
        detections,
        bomFilteredResults,
        bomConstraint.bomState
      )
      
      // 8. 결과 통합 및 통계 업데이트
      const processingTime = performance.now() - startTime
      updatePipelineStats(assignmentResult, processingTime)
      
      console.log(`✅ 통합 파이프라인 완료: ${processingTime.toFixed(2)}ms`)
      
      return {
        success: true,
        detections,
        assignments: assignmentResult.assignments,
        hold: assignmentResult.hold,
        bomStatus: bomConstraint.getBOMStatus(),
        stats: {
          processingTime,
          detectionCount: detections.length,
          assignmentCount: assignmentResult.assignments.length,
          holdCount: assignmentResult.hold.length
        }
      }
      
    } catch (err) {
      console.error('❌ 통합 파이프라인 실패:', err)
      error.value = err.message
      return {
        success: false,
        error: err.message,
        stats: { processingTime: performance.now() - startTime }
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * 객체 탐지 (YOLO) - 모의 구현
   */
  const performDetection = async (frameData) => {
    // TODO: 실제 YOLO 모델 호출
    // 현재는 모의 탐지 결과 반환
    return [
      {
        id: 'det_001',
        bbox: { x: 100, y: 100, width: 200, height: 200 },
        confidence: 0.95,
        class: 'lego_part'
      },
      {
        id: 'det_002', 
        bbox: { x: 300, y: 150, width: 180, height: 180 },
        confidence: 0.87,
        class: 'lego_part'
      },
      {
        id: 'det_003',
        bbox: { x: 500, y: 200, width: 160, height: 160 },
        confidence: 0.92,
        class: 'lego_part'
      }
    ]
  }

  /**
   * 임베딩 추출 - 모의 구현
   */
  const extractEmbeddings = async (detections) => {
    // TODO: 실제 CLIP/FGC 모델 호출
    // 현재는 모의 임베딩 반환
    return detections.map(detection => ({
      ...detection,
      clipEmbedding: new Array(512).fill(0).map(() => Math.random()),
      fgcEmbedding: new Array(2048).fill(0).map(() => Math.random())
    }))
  }

  /**
   * Two-Stage 검색 - 모의 구현
   */
  const performTwoStageSearch = async (embeddings) => {
    // TODO: 실제 FAISS 검색 호출
    // 현재는 모의 검색 결과 반환
    return embeddings.map(embedding => ({
      ...embedding,
      candidates: [
        { part_id: '3001', color_id: 1, element_id: '300101', similarity: 0.95 },
        { part_id: '3002', color_id: 1, element_id: '300201', similarity: 0.87 },
        { part_id: '3003', color_id: 1, element_id: '300301', similarity: 0.82 }
      ]
    }))
  }

  /**
   * Adaptive Fusion - 모의 구현
   */
  const performAdaptiveFusion = async (searchResults, detections) => {
    // TODO: 실제 Adaptive Fusion 호출
    // 현재는 모의 Fusion 결과 반환
    return searchResults.map(result => ({
      ...result,
      sim_final: result.candidates[0]?.similarity || 0.0,
      fusionWeights: { img: 0.65, meta: 0.25, txt: 0.15 }
    }))
  }

  /**
   * 파이프라인 통계 업데이트
   */
  const updatePipelineStats = (assignmentResult, processingTime) => {
    pipelineStats.totalFrames++
    pipelineStats.successfulDetections += assignmentResult.assignments.length
    pipelineStats.hungarianAssignments += assignmentResult.assignments.length
    pipelineStats.averageProcessingTime = 
      (pipelineStats.averageProcessingTime + processingTime) / 2
  }

  /**
   * 파이프라인 상태 조회
   */
  const getPipelineStatus = () => {
    return {
      loading: loading.value,
      error: error.value,
      stats: { ...pipelineStats },
      bomStatus: bomConstraint.getBOMStatus(),
      hungarianStats: hungarianAssignment.assignmentStats,
      fusionStats: adaptiveFusion.fusionStats
    }
  }

  /**
   * 파이프라인 리셋
   */
  const resetPipeline = () => {
    loading.value = false
    error.value = null
    
    // 통계 리셋
    Object.keys(pipelineStats).forEach(key => {
      pipelineStats[key] = 0
    })
    
    // 하위 모듈 리셋
    bomConstraint.bomState.parts.clear()
    bomConstraint.bomState.colors.clear()
    bomConstraint.bomState.elements.clear()
    
    console.log('🔄 파이프라인 리셋 완료')
  }

  return {
    loading,
    error,
    pipelineStats,
    pipelineConfig,
    executePipeline,
    getPipelineStatus,
    resetPipeline,
    
    // 하위 모듈 노출 (필요시 직접 접근)
    hungarianAssignment,
    bomConstraint,
    faissSearch,
    adaptiveFusion
  }
}


















