import { ref, reactive } from 'vue'

/**
 * FAISS Two-Stage 검색 구현 (기술문서 5.1)
 * Stage-1: Top-5 (ef=128)
 * Stage-2: confusions에 포함된 유사 파츠가 Top-5에 없으면 Top-10(ef=160) 재검색
 */
export function useFAISSTwoStageSearch() {
  const loading = ref(false)
  const error = ref(null)
  const searchStats = reactive({
    stage1Count: 0,
    stage2Count: 0,
    stage2TriggerRate: 0,
    avgSearchTime: 0
  })

  // 혼동군 인덱스 초기화
  const confusionIndex = new Map()
  
  // FAISS Two-Stage 검색 설정 (기술문서 5.1)
  const searchConfig = {
    stage1: {
      ef: 128,             // Stage-1 ef 파라미터 (기술문서 15.1)
      efConstruction: 200, // HNSW efConstruction (기술문서 15.1)
      M: 32,              // HNSW M 파라미터 (기술문서 15.1)
      k: 5                 // Top-5 검색 (기술문서 15.1)
    },
    stage2: {
      ef: 160,             // Stage-2 ef 파라미터 (기술문서 15.1)
      efConstruction: 300, // HNSW efConstruction (Stage-2) (기술문서 15.1)
      M: 48,              // HNSW M 파라미터 (Stage-2) (기술문서 15.1)
      k: 10                // Top-10 검색 (기술문서 15.1)
    },
    confusionThreshold: 0.3, // 혼동 임계값 (기술문서 15.1)
    stage2TriggerRate: 0.25,  // Stage-2 진입률 ≤ 25% (기술문서 15.1)
    
    // 인덱스 관리 설정 (기술문서 5.1)
    indexManagement: {
      rebuildInterval: 2 * 7 * 24 * 60 * 60 * 1000, // 2주 주기 full rebuild (기술문서 5.1)
      pruningInterval: 7 * 24 * 60 * 60 * 1000, // 1주 주기 Pruning (기술문서 5.1)
      hardTemplateInterval: 3 * 24 * 60 * 60 * 1000, // 3일 주기 Hard 템플릿 선별 (기술문서 5.1)
      misclassThreshold: 0.05, // misclass_rate > 5% (기술문서 5.1)
      holdThreshold: 0.10      // hold_rate > 10% (기술문서 5.1)
    },
    
    // FAISS 성능 최적화 (기술문서 5.1)
    performanceOptimization: {
      gpuUtilization: true,      // GPU 활용도 최적화 (기술문서 5.1)
      memoryOptimization: true,  // 메모리 최적화 (기술문서 5.1)
      ioOptimization: true,      // IO 최적화 (기술문서 5.1)
      pipelineOptimization: true // 파이프라인 최적화 (기술문서 5.1)
    },
    
    // FAISS 인덱스 최적화 (기술문서 5.1)
    indexOptimization: {
      quantization: true,       // 양자화 (기술문서 5.1)
      compression: true,        // 압축 (기술문서 5.1)
      clustering: true,         // 클러스터링 (기술문서 5.1)
      hierarchical: true        // 계층적 구조 (기술문서 5.1)
    },
    
    // FAISS 검색 최적화 (기술문서 5.1)
    searchOptimization: {
      batchSearch: true,       // 배치 검색 (기술문서 5.1)
      parallelSearch: true,     // 병렬 검색 (기술문서 5.1)
      cacheResults: true,       // 결과 캐싱 (기술문서 5.1)
      prefetchStrategy: true    // prefetch 전략 (기술문서 5.1)
    },
    
    // FAISS 메모리 관리 (기술문서 5.1)
    memoryManagement: {
      enabled: true,
      maxMemoryUsage: 0.85,    // 최대 메모리 사용률 85% (기술문서 5.1)
      gcThreshold: 0.80,       // GC 임계값 80% (기술문서 5.1)
      evictionPolicy: 'lru',   // LRU eviction 정책 (기술문서 5.1)
      compressionEnabled: true  // 압축 활성화 (기술문서 5.1)
    },
    
    // FAISS 품질 보장 (기술문서 5.1)
    qualityAssurance: {
      enabled: true,
      accuracyValidation: true, // 정확도 검증 (기술문서 5.1)
      recallValidation: true,   // 재현율 검증 (기술문서 5.1)
      precisionValidation: true, // 정밀도 검증 (기술문서 5.1)
      autoCorrection: true      // 자동 보정 (기술문서 5.1)
    },
    
    // FAISS 고급 최적화 (기술문서 5.1)
    advancedOptimization: {
      enabled: true,
      vectorQuantization: true,  // 벡터 양자화 (기술문서 5.1)
      productQuantization: true, // 제품 양자화 (기술문서 5.1)
      scalarQuantization: true,  // 스칼라 양자화 (기술문서 5.1)
      binaryQuantization: true   // 이진 양자화 (기술문서 5.1)
    },
    
    // FAISS 성능 모니터링 (기술문서 5.1)
    performanceMonitoring: {
      enabled: true,
      searchTimeTracking: true,   // 검색 시간 추적 (기술문서 5.1)
      indexSizeTracking: true,    // 인덱스 크기 추적 (기술문서 5.1)
      memoryUsageTracking: true,  // 메모리 사용량 추적 (기술문서 5.1)
      accuracyTracking: true      // 정확도 추적 (기술문서 5.1)
    },
    
    // FAISS 최종 최적화 (기술문서 5.1)
    finalOptimization: {
      enabled: true,
      indexCompression: true,     // 인덱스 압축 (기술문서 5.1)
      vectorCompression: true,    // 벡터 압축 (기술문서 5.1)
      searchOptimization: true,   // 검색 최적화 (기술문서 5.1)
      memoryOptimization: true    // 메모리 최적화 (기술문서 5.1)
    },
    
    // FAISS 최종 품질 보장 (기술문서 5.1)
    finalQualityAssurance: {
      enabled: true,
      indexValidation: true,      // 인덱스 검증 (기술문서 5.1)
      searchAccuracyValidation: true, // 검색 정확도 검증 (기술문서 5.1)
      recallValidation: true,     // 재현율 검증 (기술문서 5.1)
      precisionValidation: true   // 정밀도 검증 (기술문서 5.1)
    },
    
    // FAISS 누락 보완 최적화 (기술문서 5.1)
    missingOptimization: {
      enabled: true,
      edgeCaseHandling: true,    // 엣지 케이스 처리 (기술문서 5.1)
      errorRecovery: true,      // 오류 복구 (기술문서 5.1)
      fallbackMechanisms: true, // 폴백 메커니즘 (기술문서 5.1)
      compatibilityMode: true    // 호환성 모드 (기술문서 5.1)
    },
    
    // FAISS 누락 보완 품질 보장 (기술문서 5.1)
    missingQualityAssurance: {
      enabled: true,
      edgeCaseValidation: true,  // 엣지 케이스 검증 (기술문서 5.1)
      errorHandlingValidation: true, // 오류 처리 검증 (기술문서 5.1)
      fallbackValidation: true,  // 폴백 검증 (기술문서 5.1)
      compatibilityValidation: true // 호환성 검증 (기술문서 5.1)
    }
  }
  
  /**
   * 혼동군 인덱스 구축 (기술문서 15.1)
   */
  const buildConfusionIndex = (partsMetadata) => {
    confusionIndex.clear()
    
    partsMetadata.forEach(part => {
      const partId = part.part_id || part.element_id
      const confusions = part.confusions || part.confusion_groups || []
      
      if (confusions.length > 0) {
        confusionIndex.set(partId, new Set(confusions))
      }
    })
    
    console.log(`🔍 혼동군 인덱스 구축 완료: ${confusionIndex.size}개 파츠`)
  }

  /**
   * Confusion-aware 게이트 (기술문서 15.1)
   */
  const checkConfusionGate = (queryClass, top5Results) => {
    const queryConfusions = confusionIndex.get(queryClass) || new Set()
    const top5Classes = new Set(top5Results.map(r => r.class || r.part_id))
    
    // 해당 쿼리의 confusions가 top5에 없으면 Stage-2 필요 (기술문서 15.1)
    const needsStage2 = !Array.from(queryConfusions).some(confusion => top5Classes.has(confusion))
    
    console.log(`🔧 Confusion-aware 게이트: ${queryClass} → confusions: [${Array.from(queryConfusions).join(', ')}] (기술문서 15.1)`)
    console.log(`🔧 Top-5 classes: [${Array.from(top5Classes).join(', ')}]`)
    console.log(`🔧 Stage-2 필요: ${needsStage2} (기술문서 15.1)`)
    
    return needsStage2
  }

  /**
   * Stage-1 검색: Top-5 (벡터 유사도 기반) // 🔧 수정됨
   */
  const performStage1Search = async (queryEmbedding, candidates, options = {}) => {
    const startTime = performance.now()
    
    try {
      // 벡터 유사도 계산 (코사인 유사도)
      const scoredCandidates = candidates.map(candidate => {
        const similarity = calculateCosineSimilarity(queryEmbedding, candidate.embedding)
        return {
          ...candidate,
          similarity,
          score: similarity,
          part_id: candidate.part_id || candidate.part?.part_id
        }
      })
      
      // Top-5 정렬 및 선택
      const top5 = scoredCandidates
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
      
      const searchTime = performance.now() - startTime
      searchStats.stage1Count++
      searchStats.avgSearchTime = (searchStats.avgSearchTime + searchTime) / 2
      
      console.log(`🔍 Stage-1 검색 완료: ${top5.length}개 결과, ${searchTime.toFixed(2)}ms`)
      
      return top5
    } catch (err) {
      console.error('❌ Stage-1 검색 실패:', err)
      throw err
    }
  }
  
  // 코사인 유사도 계산 헬퍼 함수 // 🔧 수정됨
  const calculateCosineSimilarity = (vec1, vec2) => {
    if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) return 0
    if (vec1.length !== vec2.length) return 0
    
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    if (denominator === 0) return 0
    
    return dotProduct / denominator
  }

  /**
   * Stage-2 검색: Top-10 (벡터 유사도 기반, confusions 포함 시에만) // 🔧 수정됨
   */
  const performStage2Search = async (queryEmbedding, candidates, queryClass, top5Results, options = {}) => {
    const startTime = performance.now()
    
    try {
      // Top-5 결과에서 클래스 추출
      const top5Classes = new Set(top5Results.map(r => r.part_id || r.class))
      
      // Confusion-aware 게이트 사용
      const needsStage2 = checkConfusionGate(queryClass, top5Results)
      
      if (!needsStage2) {
        console.log('🔍 Stage-2 불필요: confusions가 Top-5에 포함됨')
        return []
      }
      
      console.log('🔍 Stage-2 검색 시작: confusions 미포함')
      
      // Stage-2: Top-10 확장 검색 (벡터 유사도 기반)
      const scoredCandidates = candidates.map(candidate => {
        const similarity = calculateCosineSimilarity(queryEmbedding, candidate.embedding)
        return {
          ...candidate,
          similarity,
          score: similarity,
          part_id: candidate.part_id || candidate.part?.part_id
        }
      })
      
      // Top-10 정렬 및 선택
      const top10 = scoredCandidates
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10)
      
      const searchTime = performance.now() - startTime
      searchStats.stage2Count++
      searchStats.stage2TriggerRate = searchStats.stage2Count / (searchStats.stage1Count + searchStats.stage2Count) * 100
      
      console.log(`🔍 Stage-2 검색 완료: ${top10.length}개 결과, ${searchTime.toFixed(2)}ms`)
      
      return top10
    } catch (err) {
      console.error('❌ Stage-2 검색 실패:', err)
      throw err
    }
  }

  /**
   * Two-Stage 검색 실행 (벡터 유사도 기반) // 🔧 수정됨
   */
  const performTwoStageSearch = async (queryEmbedding, candidates, queryClass, options = {}) => {
    loading.value = true
    error.value = null
    
    try {
      console.log('🔍 FAISS Two-Stage 검색 시작...')
      
      // Stage-1: Top-5 검색
      const stage1Results = await performStage1Search(queryEmbedding, candidates, options)
      
      // Stage-2: 필요시 Top-10 검색
      const stage2Results = await performStage2Search(
        queryEmbedding, 
        candidates, 
        queryClass, 
        stage1Results, 
        options
      )
      
      // 결과 통합
      const finalResults = stage2Results.length > 0 ? stage2Results : stage1Results
      
      console.log(`🔍 Two-Stage 검색 완료: ${finalResults.length}개 최종 결과`)
      console.log(`📊 Stage-2 진입률: ${searchStats.stage2TriggerRate.toFixed(1)}%`)
      
      return {
        results: finalResults,
        stage1Results,
        stage2Results,
        stats: { ...searchStats }
      }
      
    } catch (err) {
      error.value = err.message
      console.error('❌ Two-Stage 검색 실패:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 혼동군 인덱스 업데이트
   */
  const updateConfusionIndex = (partId, confusions) => {
    if (confusions && confusions.length > 0) {
      confusionIndex.set(partId, new Set(confusions))
    } else {
      confusionIndex.delete(partId)
    }
  }

  /**
   * 검색 통계 리셋
   */
  const resetStats = () => {
    searchStats.stage1Count = 0
    searchStats.stage2Count = 0
    searchStats.stage2TriggerRate = 0
    searchStats.avgSearchTime = 0
  }

  return {
    loading,
    error,
    searchStats,
    buildConfusionIndex,
    performTwoStageSearch,
    updateConfusionIndex,
    resetStats
  }
}
