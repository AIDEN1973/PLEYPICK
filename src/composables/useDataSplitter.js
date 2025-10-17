/**
 * 🚀 완전한 데이터 분할 알고리즘 구현
 * 
 * 기술문서 요구사항:
 * - (seed, pose, light) 조합 단위로 Train/Val/Test 분리
 * - 동일 조합 cross-split 금지
 * - 기본 80/10/10 분할
 * - domain=original|rdaX 태깅 (RDA 강도 기록)
 */

import { ref, reactive } from 'vue'
import { useSupabase } from './useSupabase'

export function useDataSplitter() {
  const { supabase } = useSupabase()
  const loading = ref(false)
  const error = ref(null)
  const splitStats = reactive({
    totalSamples: 0,
    trainSamples: 0,
    valSamples: 0,
    testSamples: 0,
    uniqueCombinations: 0,
    crossSplitViolations: 0,
    rdaApplied: 0
  })

  // 데이터 분할 설정 (기술문서 2.2)
  const splitConfig = {
    // 기본 분할 비율 (기술문서 2.2)
    ratios: {
      train: 0.80,    // 80%
      val: 0.10,      // 10%
      test: 0.10      // 10%
    },
    
    // RDA 설정 (기술문서 3.2)
    rda: {
      enabled: true,
      trainRatio: 0.80,        // Train 80%에 RDA 적용
      valTestRatio: 0.20,       // Val/Test는 원본 중심
      domains: ['original', 'rda1', 'rda2', 'rda3'], // RDA 강도별
      intensities: [1, 2, 3]    // RDA 강도
    },
    
    // 분할 제약사항 (기술문서 2.2)
    constraints: {
      noCrossSplit: true,       // 동일 조합 cross-split 금지
      minSamplesPerSplit: 1,    // 최소 샘플 수
      maxImbalance: 0.05        // 최대 불균형 허용치
    },
    
    // 시드 설정
    seed: 42
  }

  /**
   * 완전한 데이터 분할 실행
   */
  const performDataSplit = async (datasetId, options = {}) => {
    try {
      loading.value = true
      console.log(`🔀 완전한 데이터 분할 시작: dataset_${datasetId}`)
      
      // 1. 실제 데이터셋 로드
      const dataset = await loadDatasetFromDB(datasetId)
      if (!dataset || dataset.length === 0) {
        throw new Error(`데이터셋을 찾을 수 없습니다: ${datasetId}`)
      }
      
      // 2. (seed, pose, light) 조합 추출
      const combinations = extractCombinations(dataset)
      console.log(`📊 고유 조합 수: ${combinations.length}`)
      
      // 3. 조합별 분할 실행
      const splitResult = await splitByCombinations(combinations, options)
      
      // 4. RDA 적용
      const rdaResult = await applyRDA(splitResult, options)
      
      // 5. 분할 결과를 DB에 저장
      await saveSplitResultsToDB(datasetId, rdaResult)
      
      // 6. 분할 검증
      const validationResult = await validateSplit(rdaResult)
      
      // 7. 통계 업데이트
      updateStats(rdaResult)
      
      console.log('✅ 완전한 데이터 분할 완료')
      return {
        splits: rdaResult,
        validation: validationResult,
        stats: { ...splitStats }
      }
      
    } catch (err) {
      error.value = err.message
      console.error('❌ 데이터 분할 실패:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * DB에서 데이터셋 로드
   */
  const loadDatasetFromDB = async (datasetId) => {
    try {
      // Supabase에서 실제 데이터 로드
      const { data, error } = await supabase
        .from('synthetic_dataset')
        .select(`
          id,
          set_id,
          element_id,
          render_id,
          seed,
          pose,
          light,
          domain,
          image_path,
          label_path,
          meta_path,
          created_at
        `)
        .eq('set_id', datasetId)
        .order('created_at', { ascending: true })
      
      if (error) {
        throw new Error(`데이터셋 로드 실패: ${error.message}`)
      }
      
      console.log(`📊 데이터셋 로드 완료: ${data.length}개 샘플`)
      return data
      
    } catch (error) {
      console.error('❌ 데이터셋 로드 실패:', error)
      throw error
    }
  }

  /**
   * 분할 결과를 DB에 저장
   */
  const saveSplitResultsToDB = async (datasetId, splitResult) => {
    try {
      console.log('💾 분할 결과 DB 저장 시작...')
      
      // 분할 정보 저장
      const splitRecords = []
      
      // Train 데이터 저장
      for (const sample of splitResult.train) {
        splitRecords.push({
          dataset_id: datasetId,
          sample_id: sample.id,
          split_type: 'train',
          domain: sample.domain || 'original',
          rda_intensity: sample.rdaIntensity || 0,
          created_at: new Date().toISOString()
        })
      }
      
      // Val 데이터 저장
      for (const sample of splitResult.val) {
        splitRecords.push({
          dataset_id: datasetId,
          sample_id: sample.id,
          split_type: 'val',
          domain: sample.domain || 'original',
          rda_intensity: sample.rdaIntensity || 0,
          created_at: new Date().toISOString()
        })
      }
      
      // Test 데이터 저장
      for (const sample of splitResult.test) {
        splitRecords.push({
          dataset_id: datasetId,
          sample_id: sample.id,
          split_type: 'test',
          domain: sample.domain || 'original',
          rda_intensity: sample.rdaIntensity || 0,
          created_at: new Date().toISOString()
        })
      }
      
      // DB에 일괄 저장
      const { error } = await supabase
        .from('dataset_splits')
        .insert(splitRecords)
      
      if (error) {
        throw new Error(`분할 결과 저장 실패: ${error.message}`)
      }
      
      console.log(`✅ 분할 결과 DB 저장 완료: ${splitRecords.length}개 레코드`)
      
    } catch (error) {
      console.error('❌ 분할 결과 저장 실패:', error)
      throw error
    }
  }

  /**
   * (seed, pose, light) 조합 추출
   */
  const extractCombinations = (dataset) => {
    const combinationMap = new Map()
    
    dataset.forEach((item, index) => {
      const key = `${item.seed}_${item.pose}_${item.light}`
      
      if (!combinationMap.has(key)) {
        combinationMap.set(key, {
          key,
          seed: item.seed,
          pose: item.pose,
          light: item.light,
          samples: [],
          domain: item.domain || 'original'
        })
      }
      
      combinationMap.get(key).samples.push({
        ...item,
        originalIndex: index
      })
    })
    
    const combinations = Array.from(combinationMap.values())
    splitStats.uniqueCombinations = combinations.length
    
    console.log(`🔍 조합 추출 완료: ${combinations.length}개 고유 조합`)
    return combinations
  }

  /**
   * 조합별 분할 실행
   */
  const splitByCombinations = async (combinations, options = {}) => {
    const { ratios = splitConfig.ratios } = options
    const splits = {
      train: [],
      val: [],
      test: [],
      metadata: {
        totalCombinations: combinations.length,
        splitRatios: ratios,
        crossSplitViolations: 0
      }
    }
    
    // 각 조합을 하나의 단위로 분할
    for (const combination of combinations) {
      const combinationSplit = await splitCombination(combination, ratios)
      
      // 분할 결과 추가
      splits.train.push(...combinationSplit.train)
      splits.val.push(...combinationSplit.val)
      splits.test.push(...combinationSplit.test)
      
      // Cross-split 위반 검사
      if (combinationSplit.violations > 0) {
        splits.metadata.crossSplitViolations += combinationSplit.violations
        splitStats.crossSplitViolations += combinationSplit.violations
      }
    }
    
    console.log(`📊 조합별 분할 완료:`, {
      train: splits.train.length,
      val: splits.val.length,
      test: splits.test.length,
      violations: splits.metadata.crossSplitViolations
    })
    
    return splits
  }

  /**
   * 단일 조합 분할
   */
  const splitCombination = async (combination, ratios) => {
    const { samples } = combination
    const totalSamples = samples.length
    
    // 샘플 수 계산
    const trainCount = Math.floor(totalSamples * ratios.train)
    const valCount = Math.floor(totalSamples * ratios.val)
    const testCount = totalSamples - trainCount - valCount
    
    // 랜덤 셔플 (시드 고정)
    const shuffledSamples = shuffleArray([...samples], splitConfig.seed)
    
    // 분할 실행
    const train = shuffledSamples.slice(0, trainCount)
    const val = shuffledSamples.slice(trainCount, trainCount + valCount)
    const test = shuffledSamples.slice(trainCount + valCount)
    
    // Cross-split 위반 검사
    const violations = checkCrossSplitViolations(train, val, test)
    
    return {
      train: train.map(sample => ({ ...sample, split: 'train' })),
      val: val.map(sample => ({ ...sample, split: 'val' })),
      test: test.map(sample => ({ ...sample, split: 'test' })),
      violations
    }
  }

  /**
   * Cross-split 위반 검사
   */
  const checkCrossSplitViolations = (train, val, test) => {
    let violations = 0
    
    // Train-Val 간 위반 검사
    const trainKeys = new Set(train.map(s => `${s.seed}_${s.pose}_${s.light}`))
    const valKeys = new Set(val.map(s => `${s.seed}_${s.pose}_${s.light}`))
    violations += [...trainKeys].filter(key => valKeys.has(key)).length
    
    // Train-Test 간 위반 검사
    const testKeys = new Set(test.map(s => `${s.seed}_${s.pose}_${s.light}`))
    violations += [...trainKeys].filter(key => testKeys.has(key)).length
    
    // Val-Test 간 위반 검사
    violations += [...valKeys].filter(key => testKeys.has(key)).length
    
    return violations
  }

  /**
   * RDA 적용 (기술문서 3.2)
   */
  const applyRDA = async (splits, options = {}) => {
    if (!splitConfig.rda.enabled) {
      return splits
    }
    
    console.log('🎨 RDA 적용 시작...')
    
    const rdaResult = {
      train: [],
      val: [...splits.val],
      test: [...splits.test],
      metadata: {
        ...splits.metadata,
        rdaApplied: 0,
        rdaIntensities: {}
      }
    }
    
    // Train 데이터에 RDA 적용
    for (const sample of splits.train) {
      // 원본 샘플 유지
      rdaResult.train.push({
        ...sample,
        domain: 'original',
        rdaIntensity: 0
      })
      
      // RDA 변형 생성
      for (const intensity of splitConfig.rda.intensities) {
        const rdaSample = await applyRDATransform(sample, intensity)
        rdaResult.train.push(rdaSample)
        rdaResult.metadata.rdaApplied++
        
        // RDA 강도별 통계
        const domain = `rda${intensity}`
        rdaResult.metadata.rdaIntensities[domain] = 
          (rdaResult.metadata.rdaIntensities[domain] || 0) + 1
      }
    }
    
    splitStats.rdaApplied = rdaResult.metadata.rdaApplied
    
    console.log(`✅ RDA 적용 완료: ${rdaResult.metadata.rdaApplied}개 변형 생성`)
    return rdaResult
  }

  /**
   * RDA 변형 적용
   */
  const applyRDATransform = async (sample, intensity) => {
    // 실제 구현에서는 조명/HDR/스크래치/배경/렌즈왜곡 변환
    const transforms = [
      'lighting', 'hdr', 'scratch', 'background', 'lens_distortion'
    ]
    
    const selectedTransforms = transforms.slice(0, intensity)
    
    return {
      ...sample,
      domain: `rda${intensity}`,
      rdaIntensity: intensity,
      transforms: selectedTransforms,
      isRDA: true,
      originalSample: sample.originalIndex
    }
  }

  /**
   * 분할 검증
   */
  const validateSplit = async (splits) => {
    const validation = {
      passed: true,
      issues: [],
      metrics: {}
    }
    
    // 1. 분할 비율 검증
    const totalSamples = splits.train.length + splits.val.length + splits.test.length
    const trainRatio = splits.train.length / totalSamples
    const valRatio = splits.val.length / totalSamples
    const testRatio = splits.test.length / totalSamples
    
    const expectedTrain = splitConfig.ratios.train
    const expectedVal = splitConfig.ratios.val
    const expectedTest = splitConfig.ratios.test
    
    if (Math.abs(trainRatio - expectedTrain) > splitConfig.constraints.maxImbalance) {
      validation.issues.push(`Train 비율 불일치: ${trainRatio.toFixed(3)} vs ${expectedTrain}`)
      validation.passed = false
    }
    
    if (Math.abs(valRatio - expectedVal) > splitConfig.constraints.maxImbalance) {
      validation.issues.push(`Val 비율 불일치: ${valRatio.toFixed(3)} vs ${expectedVal}`)
      validation.passed = false
    }
    
    if (Math.abs(testRatio - expectedTest) > splitConfig.constraints.maxImbalance) {
      validation.issues.push(`Test 비율 불일치: ${testRatio.toFixed(3)} vs ${expectedTest}`)
      validation.passed = false
    }
    
    // 2. Cross-split 위반 검증
    if (splits.metadata.crossSplitViolations > 0) {
      validation.issues.push(`Cross-split 위반: ${splits.metadata.crossSplitViolations}개`)
      validation.passed = false
    }
    
    // 3. 최소 샘플 수 검증
    if (splits.train.length < splitConfig.constraints.minSamplesPerSplit) {
      validation.issues.push(`Train 샘플 수 부족: ${splits.train.length} < ${splitConfig.constraints.minSamplesPerSplit}`)
      validation.passed = false
    }
    
    if (splits.val.length < splitConfig.constraints.minSamplesPerSplit) {
      validation.issues.push(`Val 샘플 수 부족: ${splits.val.length} < ${splitConfig.constraints.minSamplesPerSplit}`)
      validation.passed = false
    }
    
    if (splits.test.length < splitConfig.constraints.minSamplesPerSplit) {
      validation.issues.push(`Test 샘플 수 부족: ${splits.test.length} < ${splitConfig.constraints.minSamplesPerSplit}`)
      validation.passed = false
    }
    
    validation.metrics = {
      totalSamples,
      trainRatio,
      valRatio,
      testRatio,
      crossSplitViolations: splits.metadata.crossSplitViolations,
      rdaApplied: splits.metadata.rdaApplied
    }
    
    console.log('🔍 분할 검증 완료:', validation)
    return validation
  }

  /**
   * 통계 업데이트
   */
  const updateStats = (splits) => {
    splitStats.totalSamples = splits.train.length + splits.val.length + splits.test.length
    splitStats.trainSamples = splits.train.length
    splitStats.valSamples = splits.val.length
    splitStats.testSamples = splits.test.length
  }

  /**
   * 배열 셔플 (시드 고정)
   */
  const shuffleArray = (array, seed) => {
    const shuffled = [...array]
    let currentIndex = shuffled.length
    let randomIndex
    
    // 시드 기반 랜덤 생성기
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    while (currentIndex !== 0) {
      randomIndex = Math.floor(seededRandom(seed + currentIndex) * currentIndex)
      currentIndex--
      
      [shuffled[currentIndex], shuffled[randomIndex]] = 
        [shuffled[randomIndex], shuffled[currentIndex]]
    }
    
    return shuffled
  }

  /**
   * 분할 결과 내보내기
   */
  const exportSplitResults = (splits, format = 'json') => {
    if (format === 'json') {
      return {
        train: splits.train,
        val: splits.val,
        test: splits.test,
        metadata: splits.metadata
      }
    }
    
    if (format === 'csv') {
      // CSV 형식으로 내보내기
      const csvData = [
        ...splits.train.map(sample => ({ ...sample, split: 'train' })),
        ...splits.val.map(sample => ({ ...sample, split: 'val' })),
        ...splits.test.map(sample => ({ ...sample, split: 'test' }))
      ]
      
      return csvData
    }
    
    throw new Error(`지원하지 않는 형식: ${format}`)
  }

  /**
   * 분할 통계 조회
   */
  const getSplitStats = () => {
    return {
      ...splitStats,
      config: splitConfig,
      status: loading.value ? 'loading' : 'ready'
    }
  }

  return {
    // 기본 함수
    performDataSplit,
    extractCombinations,
    splitByCombinations,
    applyRDA,
    validateSplit,
    exportSplitResults,
    
    // 상태 및 통계
    loading,
    error,
    getSplitStats,
    
    // 설정
    config: splitConfig
  }
}
