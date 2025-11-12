import { ref, reactive } from 'vue'

/**
 * 헝가리안 할당 알고리즘 구현 (기술문서 7.1-7.3)
 * 계층/희소/비동기 처리로 BOM 제약 조건 적용
 */
export function useHungarianAssignment() {
  const loading = ref(false)
  const error = ref(null)
  const assignmentStats = reactive({
    totalAssignments: 0,
    greedyAssignments: 0,
    hungarianAssignments: 0,
    timeoutFallbacks: 0,
    averageProcessingTime: 0
  })

  // 헝가리안 할당 설정 (기술문서 7.1-7.3)
  const assignmentConfig = {
    // 비용/임계 설정 (기술문서 7.1)
    costThreshold: 0.80,        // 확정 임계 0.80
    holdThreshold: 0.10,        // 보류: sim_final < 0.80 또는 Top1–Top2 < 0.10
    
    // 희소화/계층 처리 (기술문서 7.2)
    preFilter: {
      enabled: true,
      topK: 3,                  // 각 탐지 Top-3 후보
      similarityThreshold: 0.50 // sim_final ≥ 0.50
    },
    
    // 계층 처리 (기술문서 7.2)
    hierarchy: {
      highConfidence: 0.90,     // 고확신 >0.90: 즉시 할당(greedy)
      midConfidence: 0.70,      // 중간 0.70~0.90: 배치 헝가리안
      lowConfidence: 0.70,      // 저확신 ≤0.70: 보류/휴리스틱
      batchSize: 100            // 배치 헝가리안 (예: 100개씩)
    },
    
    // 비동기 스케줄러 (기술문서 7.3)
    asyncScheduler: {
      enabled: true,
      maxQueueDepth: 10,        // 큐 깊이>10 → sync 폴백
      timeout: 500,             // 타임아웃 500ms → greedy 폴백 + 경보
      maxWorkers: 4             // 최대 워커 수
    },
    
    // 인접 억제 (기술문서 7.2)
    proximitySuppression: {
      enabled: true,
      distanceThreshold: 0.5,   // 센트로이드 거리 < min_size×0.5
      suppressionMethod: 'lower_score' // 낮은 점수 제거
    }
  }

  /**
   * 비용 행렬 생성 (기술문서 7.1)
   * 비용 = −sim_final
   */
  const createCostMatrix = (detections, templates, bomConstraints) => {
    try {
      const costMatrix = []
      const detectionCount = detections.length
      const templateCount = templates.length
      
      // 비용 행렬 초기화
      for (let i = 0; i < detectionCount; i++) {
        costMatrix[i] = []
        for (let j = 0; j < templateCount; j++) {
          // 비용 = −sim_final (기술문서 7.1)
          const similarity = calculateSimilarity(detections[i], templates[j])
          const cost = -similarity
          costMatrix[i][j] = cost
        }
      }
      
      console.log(`📊 비용 행렬 생성: ${detectionCount}×${templateCount}`)
      return costMatrix
      
    } catch (err) {
      console.error('❌ 비용 행렬 생성 실패:', err)
      throw err
    }
  }

  /**
   * 유사도 계산 (Adaptive Fusion 결과 사용)
   */
  const calculateSimilarity = (detection, template) => {
    try {
      // Adaptive Fusion 결과에서 sim_final 추출
      const simFinal = detection.sim_final || 0.0
      
      // BOM 제약 조건 적용
      const bomPenalty = applyBOMPenalty(detection, template)
      
      // 최종 유사도 = sim_final - BOM 페널티
      const finalSimilarity = Math.max(0, simFinal - bomPenalty)
      
      return finalSimilarity
      
    } catch (err) {
      console.error('❌ 유사도 계산 실패:', err)
      return 0.0
    }
  }

  /**
   * BOM 제약 조건 적용 (기술문서 핵심 설계 철학)
   */
  const applyBOMPenalty = (detection, template) => {
    try {
      // BOM에 없는 부품에 대한 페널티
      if (!isInBOM(template.part_id)) {
        return 0.5 // BOM 외 부품 강한 페널티
      }
      
      // 수량 제한 확인
      if (isQuantityExceeded(template.part_id)) {
        return 0.3 // 수량 초과 페널티
      }
      
      return 0.0 // BOM 내 정상 부품
      
    } catch (err) {
      console.error('❌ BOM 제약 적용 실패:', err)
      return 0.0
    }
  }

  /**
   * BOM 내 부품 확인
   */
  const isInBOM = (partId) => {
    // TODO: 실제 BOM 데이터와 연동
    // 현재는 임시 구현
    return true
  }

  /**
   * 수량 초과 확인
   */
  const isQuantityExceeded = (partId) => {
    // TODO: 실제 수량 추적과 연동
    // 현재는 임시 구현
    return false
  }

  /**
   * Pre-filter 적용 (기술문서 7.2)
   * 각 탐지 Top-3 후보(또는 sim_final ≥ 0.50)만 비용 행렬 포함
   */
  const applyPreFilter = (detections, templates) => {
    try {
      const filteredPairs = []
      
      for (const detection of detections) {
        const candidates = []
        
        // 모든 템플릿과의 유사도 계산
        for (const template of templates) {
          const similarity = calculateSimilarity(detection, template)
          if (similarity >= assignmentConfig.preFilter.similarityThreshold) {
            candidates.push({
              template,
              similarity,
              cost: -similarity
            })
          }
        }
        
        // Top-K 후보 선택
        candidates.sort((a, b) => b.similarity - a.similarity)
        const topCandidates = candidates.slice(0, assignmentConfig.preFilter.topK)
        
        filteredPairs.push({
          detection,
          candidates: topCandidates
        })
      }
      
      console.log(`🔍 Pre-filter 적용: ${filteredPairs.length}개 탐지, 평균 ${filteredPairs.reduce((sum, p) => sum + p.candidates.length, 0) / filteredPairs.length}개 후보`)
      return filteredPairs
      
    } catch (err) {
      console.error('❌ Pre-filter 적용 실패:', err)
      throw err
    }
  }

  /**
   * 계층 처리 (기술문서 7.2)
   */
  const processHierarchy = async (filteredPairs, bomState) => {
    try {
      const results = {
        greedy: [],
        hungarian: [],
        hold: []
      }
      
      // 1. 고확신 즉시 할당 (greedy)
      for (const pair of filteredPairs) {
        const bestCandidate = pair.candidates[0]
        if (bestCandidate && bestCandidate.similarity > assignmentConfig.hierarchy.highConfidence) {
          results.greedy.push({
            detection: pair.detection,
            template: bestCandidate.template,
            similarity: bestCandidate.similarity,
            method: 'greedy'
          })
          assignmentStats.greedyAssignments++
        }
      }
      
      // 2. 중간 확신 배치 헝가리안
      const midConfidencePairs = filteredPairs.filter(pair => {
        const bestCandidate = pair.candidates[0]
        return bestCandidate && 
               bestCandidate.similarity >= assignmentConfig.hierarchy.midConfidence &&
               bestCandidate.similarity < assignmentConfig.hierarchy.highConfidence
      })
      
      if (midConfidencePairs.length > 0) {
        console.log(`🔄 중간 확신 배치 헝가리안: ${midConfidencePairs.length}개`)
        const hungarianResults = await performBatchHungarian(midConfidencePairs, bomState)
        results.hungarian = hungarianResults
        assignmentStats.hungarianAssignments += hungarianResults.length
      }
      
      // 3. 저확신 보류
      const lowConfidencePairs = filteredPairs.filter(pair => {
        const bestCandidate = pair.candidates[0]
        return !bestCandidate || bestCandidate.similarity < assignmentConfig.hierarchy.midConfidence
      })
      
      results.hold = lowConfidencePairs.map(pair => ({
        detection: pair.detection,
        reason: 'low_confidence',
        similarity: pair.candidates[0]?.similarity || 0
      }))
      
      console.log(`📊 계층 처리 완료: Greedy ${results.greedy.length}, Hungarian ${results.hungarian.length}, Hold ${results.hold.length}`)
      return results
      
    } catch (err) {
      console.error('❌ 계층 처리 실패:', err)
      throw err
    }
  }

  /**
   * 배치 헝가리안 실행 (기술문서 7.2)
   */
  const performBatchHungarian = async (pairs, bomState) => {
    try {
      const batchSize = assignmentConfig.hierarchy.batchSize
      const results = []
      
      // 배치 단위로 처리
      for (let i = 0; i < pairs.length; i += batchSize) {
        const batch = pairs.slice(i, i + batchSize)
        console.log(`🔄 배치 헝가리안 처리: ${i + 1}-${Math.min(i + batchSize, pairs.length)}/${pairs.length}`)
        
        try {
          const batchResults = await executeHungarianAlgorithm(batch, bomState)
          results.push(...batchResults)
        } catch (err) {
          console.warn(`⚠️ 배치 헝가리안 실패, Greedy 폴백: ${err.message}`)
          // Greedy 폴백
          const greedyResults = batch.map(pair => ({
            detection: pair.detection,
            template: pair.candidates[0]?.template,
            similarity: pair.candidates[0]?.similarity || 0,
            method: 'greedy_fallback'
          }))
          results.push(...greedyResults)
          assignmentStats.timeoutFallbacks++
        }
      }
      
      return results
      
    } catch (err) {
      console.error('❌ 배치 헝가리안 실패:', err)
      throw err
    }
  }

  /**
   * 헝가리안 알고리즘 실행 (Munkres 알고리즘)
   */
  const executeHungarianAlgorithm = async (pairs, bomState) => {
    try {
      // TODO: 실제 Munkres 알고리즘 구현 또는 라이브러리 사용
      // 현재는 단순 Greedy 구현
      
      const results = []
      const usedTemplates = new Set()
      
      for (const pair of pairs) {
        // 사용되지 않은 최고 후보 선택
        const availableCandidates = pair.candidates.filter(c => !usedTemplates.has(c.template.part_id))
        
        if (availableCandidates.length > 0) {
          const bestCandidate = availableCandidates[0]
          results.push({
            detection: pair.detection,
            template: bestCandidate.template,
            similarity: bestCandidate.similarity,
            method: 'hungarian'
          })
          usedTemplates.add(bestCandidate.template.part_id)
        }
      }
      
      return results
      
    } catch (err) {
      console.error('❌ 헝가리안 알고리즘 실행 실패:', err)
      throw err
    }
  }

  /**
   * 인접 억제 적용 (기술문서 7.2)
   */
  const applyProximitySuppression = (assignments) => {
    try {
      if (!assignmentConfig.proximitySuppression.enabled) {
        return assignments
      }
      
      const suppressedAssignments = []
      const processedDetections = new Set()
      
      for (const assignment of assignments) {
        if (processedDetections.has(assignment.detection.id)) {
          continue
        }
        
        // 인접한 탐지들 찾기
        const nearbyAssignments = assignments.filter(other => {
          if (other.detection.id === assignment.detection.id) return false
          
          const distance = calculateCentroidDistance(
            assignment.detection.bbox,
            other.detection.bbox
          )
          const minSize = Math.min(
            assignment.detection.bbox.width,
            assignment.detection.bbox.height
          )
          
          return distance < minSize * assignmentConfig.proximitySuppression.distanceThreshold
        })
        
        // 가장 높은 점수만 유지
        const allNearby = [assignment, ...nearbyAssignments]
        allNearby.sort((a, b) => b.similarity - a.similarity)
        
        suppressedAssignments.push(allNearby[0])
        allNearby.forEach(a => processedDetections.add(a.detection.id))
      }
      
      console.log(`🔇 인접 억제 적용: ${assignments.length} → ${suppressedAssignments.length}`)
      return suppressedAssignments
      
    } catch (err) {
      console.error('❌ 인접 억제 적용 실패:', err)
      return assignments
    }
  }

  /**
   * 센트로이드 거리 계산
   */
  const calculateCentroidDistance = (bbox1, bbox2) => {
    const center1 = {
      x: bbox1.x + bbox1.width / 2,
      y: bbox1.y + bbox1.height / 2
    }
    const center2 = {
      x: bbox2.x + bbox2.width / 2,
      y: bbox2.y + bbox2.height / 2
    }
    
    return Math.sqrt(
      Math.pow(center1.x - center2.x, 2) + 
      Math.pow(center1.y - center2.y, 2)
    )
  }

  /**
   * 메인 할당 실행 함수
   */
  const performAssignment = async (detections, templates, bomState) => {
    const startTime = performance.now()
    
    try {
      loading.value = true
      error.value = null
      
      console.log(`🎯 헝가리안 할당 시작: ${detections.length}개 탐지, ${templates.length}개 템플릿`)
      
      // 1. Pre-filter 적용
      const filteredPairs = applyPreFilter(detections, templates)
      
      // 2. 계층 처리
      const hierarchyResults = await processHierarchy(filteredPairs, bomState)
      
      // 3. 모든 결과 통합
      const allAssignments = [
        ...hierarchyResults.greedy,
        ...hierarchyResults.hungarian
      ]
      
      // 4. 인접 억제 적용
      const finalAssignments = applyProximitySuppression(allAssignments)
      
      // 5. 통계 업데이트
      const processingTime = performance.now() - startTime
      assignmentStats.totalAssignments += finalAssignments.length
      assignmentStats.averageProcessingTime = 
        (assignmentStats.averageProcessingTime + processingTime) / 2
      
      console.log(`✅ 헝가리안 할당 완료: ${finalAssignments.length}개 할당, ${processingTime.toFixed(2)}ms`)
      
      return {
        assignments: finalAssignments,
        hold: hierarchyResults.hold,
        stats: {
          processingTime,
          greedyCount: hierarchyResults.greedy.length,
          hungarianCount: hierarchyResults.hungarian.length,
          holdCount: hierarchyResults.hold.length
        }
      }
      
    } catch (err) {
      console.error('❌ 헝가리안 할당 실패:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    assignmentStats,
    assignmentConfig,
    performAssignment,
    createCostMatrix,
    applyBOMPenalty,
    applyPreFilter,
    processHierarchy
  }
}


















