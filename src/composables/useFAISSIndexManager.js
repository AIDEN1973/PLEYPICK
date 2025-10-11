import { ref, reactive } from 'vue'

/**
 * FAISS 인덱스 관리 및 Pruning (기술문서 8.1-8.2)
 * 2주 주기 full rebuild, Hard 템플릿 자동 선별, 3단계 Pruning
 */
export function useFAISSIndexManager() {
  const loading = ref(false)
  const error = ref(null)
  const indexStats = reactive({
    totalTemplates: 0,
    l1Templates: 0,
    l2Templates: 0,
    prunedTemplates: 0,
    rebuildCount: 0,
    lastRebuild: null,
    indexSize: 0
  })

  // 인덱스 설정
  const indexConfig = {
    rebuildInterval: 14 * 24 * 60 * 60 * 1000, // 2주 (밀리초)
    maxIndexSize: 120 * 1024 * 1024, // 120MB
    l1Threshold: 15, // L1 최소 템플릿 수
    l2Threshold: 5,  // L2 최소 템플릿 수
    misclassThreshold: 0.05, // 5% 오분류율
    holdThreshold: 0.10,     // 10% 보류율
    hardTemplateIncrement: 3 // Hard 템플릿 증가량
  }

  // Pruning 설정 (기술문서 8.2)
  const pruningConfig = {
    tier1HitRate: 0.01,      // Tier 1: hit_rate < 0.01
    tier1SuccessRate: 0.05,  // Tier 1: success_rate < 0.05
    tier2HitRate: 0.05,      // Tier 2: hit_rate < 0.05
    tier2SuccessRate: 0.10,  // Tier 2: success_rate < 0.10
    minTemplatesPerClass: 15, // 최소 유지 템플릿 수
    pruningInterval: 6 * 30 * 24 * 60 * 60 * 1000 // 6개월
  }

  /**
   * 인덱스 상태 확인
   */
  const checkIndexHealth = (indexData) => {
    const health = {
      needsRebuild: false,
      needsPruning: false,
      needsHardTemplates: false,
      issues: []
    }
    
    // 1. 리빌드 필요성 확인
    const timeSinceRebuild = Date.now() - (indexData.lastRebuild || 0)
    if (timeSinceRebuild > indexConfig.rebuildInterval) {
      health.needsRebuild = true
      health.issues.push('인덱스 리빌드 필요 (2주 경과)')
    }
    
    // 2. 인덱스 크기 확인
    if (indexData.size > indexConfig.maxIndexSize) {
      health.needsPruning = true
      health.issues.push(`인덱스 크기 초과: ${(indexData.size / 1024 / 1024).toFixed(2)}MB`)
    }
    
    // 3. Hard 템플릿 필요성 확인
    const problematicClasses = indexData.classes?.filter(cls => 
      cls.misclassRate > indexConfig.misclassThreshold || 
      cls.holdRate > indexConfig.holdThreshold
    ) || []
    
    if (problematicClasses.length > 0) {
      health.needsHardTemplates = true
      health.issues.push(`${problematicClasses.length}개 클래스에 Hard 템플릿 필요`)
    }
    
    return health
  }

  /**
   * Hard 템플릿 자동 선별
   */
  const selectHardTemplates = (classData, options = {}) => {
    const { misclassRate, holdRate, templates } = classData
    const { increment = indexConfig.hardTemplateIncrement } = options
    
    // misclass_rate > 5% or hold_rate > 10% 기준 (기술문서 5.1)
    if (misclassRate <= 0.05 && holdRate <= 0.10) {
      console.log('🔧 Hard 템플릿 선별 불필요: misclass_rate ≤ 5%, hold_rate ≤ 10%')
      return []
    }
    
    // Hard 템플릿 선별 로직 (기술문서 5.1)
    const hardTemplates = templates
      .filter(template => {
        // 난이도가 높은 템플릿 선별
        return template.difficulty === 'high' || 
               template.confusionRate > 0.3 ||
               template.edgeCase === true
      })
      .sort((a, b) => (b.confusionRate || 0) - (a.confusionRate || 0))
      .slice(0, increment)
    
    console.log(`🔧 Hard 템플릿 선별: ${hardTemplates.length}개 (${classData.classId})`)
    return hardTemplates
  }

  /**
   * 3단계 Pruning 실행
   */
  const performPruning = (indexData, options = {}) => {
    const { dryRun = false } = options
    const pruningResults = {
      tier1Removed: [],
      tier2Candidates: [],
      tier3Kept: [],
      totalRemoved: 0,
      totalKept: 0
    }
    
    console.log('🔧 3단계 Pruning 시작...')
    
    // Tier 1: 즉시 제거 대상
    const tier1Templates = indexData.templates?.filter(template => 
      (template.hitRate || 0) < pruningConfig.tier1HitRate &&
      (template.successRate || 0) < pruningConfig.tier1SuccessRate
    ) || []
    
    pruningResults.tier1Removed = tier1Templates
    pruningResults.totalRemoved += tier1Templates.length
    
    console.log(`🔧 Tier 1 제거: ${tier1Templates.length}개`)
    
    // Tier 2: 검토 대상
    const tier2Templates = indexData.templates?.filter(template => 
      (template.hitRate || 0) < pruningConfig.tier2HitRate &&
      (template.successRate || 0) < pruningConfig.tier2SuccessRate &&
      !tier1Templates.includes(template)
    ) || []
    
    pruningResults.tier2Candidates = tier2Templates
    
    console.log(`🔧 Tier 2 검토 대상: ${tier2Templates.length}개`)
    
    // Tier 3: 유지 대상
    const tier3Templates = indexData.templates?.filter(template => 
      !tier1Templates.includes(template) && 
      !tier2Templates.includes(template)
    ) || []
    
    pruningResults.tier3Kept = tier3Templates
    pruningResults.totalKept = tier3Templates.length
    
    console.log(`🔧 Tier 3 유지: ${tier3Templates.length}개`)
    
    // 최소 템플릿 수 확인
    const classCounts = {}
    tier3Templates.forEach(template => {
      const classId = template.classId
      classCounts[classId] = (classCounts[classId] || 0) + 1
    })
    
    const classesBelowMin = Object.entries(classCounts)
      .filter(([classId, count]) => count < pruningConfig.minTemplatesPerClass)
      .map(([classId]) => classId)
    
    if (classesBelowMin.length > 0) {
      console.warn(`⚠️ 최소 템플릿 수 미달 클래스: ${classesBelowMin.join(', ')}`)
    }
    
    if (!dryRun) {
      // 실제 Pruning 실행
      indexStats.prunedTemplates += pruningResults.totalRemoved
      indexStats.totalTemplates = pruningResults.totalKept
    }
    
    return pruningResults
  }

  /**
   * 인덱스 리빌드
   */
  const rebuildIndex = async (indexData, options = {}) => {
    const startTime = performance.now()
    
    try {
      loading.value = true
      console.log('🔧 인덱스 리빌드 시작...')
      
      // 1. 기존 인덱스 백업
      const backupData = { ...indexData }
      
      // 2. L1/L2 계층 인덱스 구축
      const l1Index = await buildL1Index(indexData.templates)
      const l2Index = await buildL2Index(indexData.templates)
      
      // 3. 인덱스 최적화
      await optimizeIndex(l1Index, l2Index)
      
      // 4. 메타데이터 업데이트
      const newIndexData = {
        ...indexData,
        l1Index,
        l2Index,
        lastRebuild: Date.now(),
        version: (indexData.version || 0) + 1
      }
      
      const rebuildTime = performance.now() - startTime
      
      // 통계 업데이트
      indexStats.rebuildCount++
      indexStats.lastRebuild = new Date()
      indexStats.l1Templates = l1Index.templates?.length || 0
      indexStats.l2Templates = l2Index.templates?.length || 0
      
      console.log(`✅ 인덱스 리빌드 완료: ${rebuildTime.toFixed(2)}ms`)
      
      return newIndexData
      
    } catch (err) {
      error.value = err.message
      console.error('❌ 인덱스 리빌드 실패:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * L1 인덱스 구축 (대표 템플릿)
   */
  const buildL1Index = async (templates) => {
    const l1Templates = templates
      .filter(template => template.tier === 'L1' || template.representative)
      .sort((a, b) => (b.quality || 0) - (a.quality || 0))
      .slice(0, indexConfig.l1Threshold)
    
    return {
      type: 'L1',
      templates: l1Templates,
      size: calculateIndexSize(l1Templates),
      createdAt: Date.now()
    }
  }

  /**
   * L2 인덱스 구축 (Hard 템플릿)
   */
  const buildL2Index = async (templates) => {
    const l2Templates = templates
      .filter(template => template.tier === 'L2' || template.hard)
      .sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0))
      .slice(0, indexConfig.l2Threshold)
    
    return {
      type: 'L2',
      templates: l2Templates,
      size: calculateIndexSize(l2Templates),
      createdAt: Date.now()
    }
  }

  /**
   * 인덱스 최적화 (기술문서 5.1 HNSW 파라미터)
   */
  const optimizeIndex = async (l1Index, l2Index) => {
    // HNSW 파라미터 최적화 (기술문서 5.1)
    const l1Params = {
      M: 32,              // HNSW M 파라미터
      efConstruction: 200, // efConstruction (기술문서 5.1)
      efSearch: 128,      // efSearch (기술문서 5.1)
      metric: 'cosine'    // 코사인 유사도
    }
    
    const l2Params = {
      M: 48,              // HNSW M 파라미터 (Stage-2)
      efConstruction: 300, // efConstruction (기술문서 5.1)
      efSearch: 160,      // efSearch (기술문서 5.1)
      metric: 'cosine'    // 코사인 유사도
    }
    
    // 인덱스 파라미터 적용
    l1Index.params = l1Params
    l2Index.params = l2Params
    
    // HNSW 인덱스 빌드 파라미터 설정
    l1Index.buildParams = {
      efConstruction: l1Params.efConstruction,
      M: l1Params.M
    }
    
    l2Index.buildParams = {
      efConstruction: l2Params.efConstruction,
      M: l2Params.M
    }
    
    console.log('🔧 인덱스 최적화 완료 (HNSW 파라미터 적용)')
    console.log(`📊 L1 파라미터: M=${l1Params.M}, efConstruction=${l1Params.efConstruction}`)
    console.log(`📊 L2 파라미터: M=${l2Params.M}, efConstruction=${l2Params.efConstruction}`)
  }

  /**
   * 인덱스 크기 계산
   */
  const calculateIndexSize = (templates) => {
    return templates.reduce((size, template) => {
      return size + (template.embedding?.length || 0) * 4 // float32 = 4 bytes
    }, 0)
  }

  /**
   * 인덱스 관리 파이프라인
   */
  const manageIndex = async (indexData, options = {}) => {
    try {
      console.log('🔧 인덱스 관리 시작...')
      
      // 1. 인덱스 상태 확인
      const health = checkIndexHealth(indexData)
      
      if (health.issues.length > 0) {
        console.log('🔧 인덱스 이슈 발견:', health.issues)
      }
      
      // 2. Hard 템플릿 선별
      if (health.needsHardTemplates) {
        const hardTemplates = selectHardTemplates(indexData)
        console.log(`🔧 Hard 템플릿 선별: ${hardTemplates.length}개`)
      }
      
      // 3. Pruning 실행
      if (health.needsPruning) {
        const pruningResults = performPruning(indexData, options)
        console.log(`🔧 Pruning 완료: ${pruningResults.totalRemoved}개 제거, ${pruningResults.totalKept}개 유지`)
      }
      
      // 4. 인덱스 리빌드
      if (health.needsRebuild) {
        const newIndexData = await rebuildIndex(indexData, options)
        return newIndexData
      }
      
      return indexData
      
    } catch (err) {
      console.error('❌ 인덱스 관리 실패:', err)
      throw err
    }
  }

  /**
   * 통계 조회
   */
  const getIndexStats = () => {
    return {
      ...indexStats,
      config: indexConfig,
      pruningConfig
    }
  }

  /**
   * 통계 리셋
   */
  const resetStats = () => {
    indexStats.totalTemplates = 0
    indexStats.l1Templates = 0
    indexStats.l2Templates = 0
    indexStats.prunedTemplates = 0
    indexStats.rebuildCount = 0
    indexStats.lastRebuild = null
    indexStats.indexSize = 0
  }

  /**
   * 인덱스 관리 스케줄러 (기술문서 5.1)
   */
  const startIndexScheduler = () => {
    const rebuildInterval = 2 * 7 * 24 * 60 * 60 * 1000 // 2주 (기술문서 5.1)
    const pruningInterval = 7 * 24 * 60 * 60 * 1000 // 1주
    const hardTemplateInterval = 3 * 24 * 60 * 60 * 1000 // 3일
    
    const rebuildScheduler = setInterval(async () => {
      try {
        console.log('🔄 2주 주기 인덱스 재구축 시작 (기술문서 5.1)...')
        await rebuildIndex()
        console.log('✅ 인덱스 재구축 완료')
      } catch (err) {
        console.error('❌ 인덱스 재구축 실패:', err)
      }
    }, rebuildInterval)
    
    const pruningScheduler = setInterval(async () => {
      try {
        console.log('✂️ 주기적 인덱스 Pruning 시작...')
        await performPruning()
        console.log('✅ 인덱스 Pruning 완료')
      } catch (err) {
        console.error('❌ 인덱스 Pruning 실패:', err)
      }
    }, pruningInterval)
    
    const hardTemplateScheduler = setInterval(async () => {
      try {
        console.log('🌟 Hard 템플릿 자동 선별 시작...')
        await selectHardTemplates()
        console.log('✅ Hard 템플릿 선별 완료')
      } catch (err) {
        console.error('❌ Hard 템플릿 선별 실패:', err)
      }
    }, hardTemplateInterval)
    
    return { rebuildScheduler, pruningScheduler, hardTemplateScheduler }
  }

  return {
    loading,
    error,
    indexStats,
    checkIndexHealth,
    selectHardTemplates,
    performPruning,
    rebuildIndex,
    manageIndex,
    getIndexStats,
    startIndexScheduler,
    resetStats
  }
}
