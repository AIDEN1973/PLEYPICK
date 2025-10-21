import { ref, reactive } from 'vue'

/**
 * 데이터 품질 관리 및 QA 규칙 (기술문서 3.1-3.3)
 * 3단계 중복 제거, RDA 정책, AI 메타 DB 동기화
 */
export function useDataQualityManager() {
  const loading = ref(false)
  const error = ref(null)
  const qualityStats = reactive({
    totalImages: 0,
    duplicatesRemoved: 0,
    qualityIssues: 0,
    rdaApplied: 0,
    metaSyncCount: 0
  })

  // 품질 임계값 설정 (기술문서 3.1)
  const qualityThresholds = {
    // 라벨/마스크 QA 규칙
    maskAreaRatio: { min: 0.25, max: 0.98 }, // mask 면적 / bbox 면적
    topologyZScore: 3, // hole count Z-score > |3|
    earlyStoppingEpochs: 15, // 15 epoch 내 mAP 개선 < 0.1%
    earlyStoppingImprovement: 0.001, // 0.1%
    
    // 중복 제거 임계값 (기술문서 2.3)
    phashThreshold: 0.8, // pHash 유사도
    ssimThreshold: 0.965, // SSIM 임계 (WebP lossy 보정 - 기술문서 2.3)
    clipCosineThreshold: 0.85, // CLIP cosine 유사도
    // WebP SSIM 보정 (기술문서 2.3)
    webpSsimCorrection: {
      enabled: true,
      threshold: 0.965, // WebP lossy 보정 SSIM 임계값
      qualityFactor: 0.95, // 품질 보정 팩터
      lossyCompensation: true // 손실 압축 보정
    }
    
    // 이미지 품질 임계값
    ssimMin: 0.96, // SSIM ≥ 0.96
    snrMin: 35, // SNR ≥ 35 dB
    qualityMin: 0.90 // q ≥ 0.90
  }

  // RDA 설정 (기술문서 3.2)
  const rdaConfig = {
    trainRatio: 0.80, // Train 80%에 RDA 적용
    valTestRatio: 0.20, // Val/Test는 원본 중심
    domains: ['original', 'rda1', 'rda2', 'rda3'], // RDA 강도별
    seedPoseLight: true // (seed, pose, light) 조합 단위 분할
  }

  /**
   * 3단계 중복 제거 (기술문서 2.3)
   */
  const performDeduplication = async (imageDataset, options = {}) => {
    const { 
      phashThreshold = qualityThresholds.phashThreshold,
      ssimThreshold = qualityThresholds.ssimThreshold,
      clipThreshold = qualityThresholds.clipCosineThreshold
    } = options
    
    console.log('🔍 3단계 중복 제거 시작...')
    
    const duplicates = new Set()
    const processed = new Set()
    
    for (let i = 0; i < imageDataset.length; i++) {
      if (processed.has(i)) continue
      
      const current = imageDataset[i]
      const currentDuplicates = [i]
      
      for (let j = i + 1; j < imageDataset.length; j++) {
        if (processed.has(j)) continue
        
        const other = imageDataset[j]
        
        // 1단계: pHash 비교
        const phashSimilarity = await calculatePHashSimilarity(current, other)
        if (phashSimilarity < phashThreshold) continue
        
        // 2단계: SSIM 비교
        const ssimSimilarity = await calculateSSIMSimilarity(current, other)
        if (ssimSimilarity < ssimThreshold) continue
        
        // 3단계: CLIP cosine 유사도
        const clipSimilarity = await calculateCLIPSimilarity(current, other)
        if (clipSimilarity < clipThreshold) continue
        
        // 중복으로 판정
        currentDuplicates.push(j)
        processed.add(j)
      }
      
      if (currentDuplicates.length > 1) {
        // 중복 그룹에서 대표 선택 (품질이 가장 높은 것)
        const representative = selectRepresentative(currentDuplicates.map(idx => imageDataset[idx]))
        const toRemove = currentDuplicates.filter(idx => idx !== representative)
        
        toRemove.forEach(idx => {
          duplicates.add(idx)
          processed.add(idx)
        })
        
        console.log(`🔍 중복 그룹 발견: ${currentDuplicates.length}개 (대표: ${representative})`)
      }
      
      processed.add(i)
    }
    
    const duplicateIndices = Array.from(duplicates)
    qualityStats.duplicatesRemoved += duplicateIndices.length
    
    console.log(`✅ 중복 제거 완료: ${duplicateIndices.length}개 제거`)
    
    return {
      duplicates: duplicateIndices,
      remaining: imageDataset.filter((_, idx) => !duplicates.has(idx)),
      stats: { ...qualityStats }
    }
  }

  /**
   * pHash 유사도 계산
   */
  const calculatePHashSimilarity = async (img1, img2) => {
    // pHash 계산 로직 (구현 필요)
    // 실제로는 이미지 해시 라이브러리 사용
    // 실제 pHash 계산 로직 구현 필요
    throw new Error('pHash 계산 로직이 구현되지 않았습니다')
  }

  /**
   * SSIM 유사도 계산
   */
  const calculateSSIMSimilarity = async (img1, img2) => {
    // SSIM 계산 로직 (구현 필요)
    // 실제로는 SSIM 라이브러리 사용
    // 실제 pHash 계산 로직 구현 필요
    throw new Error('pHash 계산 로직이 구현되지 않았습니다')
  }

  /**
   * CLIP cosine 유사도 계산
   */
  const calculateCLIPSimilarity = async (img1, img2) => {
    // CLIP 임베딩 계산 및 cosine 유사도
    // 실제로는 CLIP 모델 사용
    // 실제 pHash 계산 로직 구현 필요
    throw new Error('pHash 계산 로직이 구현되지 않았습니다')
  }

  /**
   * 대표 이미지 선택
   */
  const selectRepresentative = (images) => {
    // 품질이 가장 높은 이미지 선택
    return images.reduce((best, current, index) => {
      const currentQuality = calculateImageQuality(current)
      const bestQuality = calculateImageQuality(best)
      return currentQuality > bestQuality ? index : best
    }, 0)
  }

  /**
   * 이미지 품질 계산
   */
  const calculateImageQuality = (image) => {
    // SSIM, SNR, 해상도 등을 종합한 품질 점수
    const ssim = image.quality?.ssim || 0.9
    const snr = image.quality?.snr || 30
    const resolution = image.width * image.height
    
    return (ssim * 0.4) + (snr / 100 * 0.3) + (resolution / 1000000 * 0.3)
  }

  /**
   * RDA 적용 (기술문서 3.2)
   */
  const applyRDA = async (imageDataset, options = {}) => {
    const { trainRatio = rdaConfig.trainRatio } = options
    
    console.log('🎨 RDA 적용 시작...')
    
    const trainCount = Math.floor(imageDataset.length * trainRatio)
    const trainImages = imageDataset.slice(0, trainCount)
    const valImages = imageDataset.slice(trainCount)
    
    // Train 이미지에 RDA 적용
    const rdaApplied = await Promise.all(
      trainImages.map(async (image, index) => {
        const rdaIntensity = 1 // 기본값 사용
        const rdaImage = await applyRDATransform(image, rdaIntensity)
        
        return {
          ...rdaImage,
          domain: `rda${rdaIntensity}`,
          originalIndex: index,
          rdaIntensity
        }
      })
    )
    
    // Val/Test는 원본 유지
    const valTestProcessed = valTestImages.map(image => ({
      ...image,
      domain: 'original'
    }))
    
    qualityStats.rdaApplied += rdaApplied.length
    
    console.log(`✅ RDA 적용 완료: ${rdaApplied.length}개 (Train), ${valTestProcessed.length}개 (Val/Test)`)
    
    return {
      train: rdaApplied,
      valTest: valTestProcessed,
      stats: { ...qualityStats }
    }
  }

  /**
   * RDA 변환 적용
   */
  const applyRDATransform = async (image, intensity) => {
    // 조명/HDR/스크래치/배경/렌즈왜곡 변환
    const transforms = [
      'lighting', 'hdr', 'scratch', 'background', 'lens_distortion'
    ]
    
    const selectedTransforms = transforms.slice(0, intensity)
    
    return {
      ...image,
      transforms: selectedTransforms,
      intensity
    }
  }

  /**
   * AI 메타 DB 동기화 (기술문서 3.3)
   */
  const syncAIMetadata = async (metadata, options = {}) => {
    console.log('🔄 AI 메타 DB 동기화 시작...')
    
    const syncResults = {
      updated: 0,
      created: 0,
      errors: 0
    }
    
    for (const meta of metadata) {
      try {
        // parts_master_features 업서트
        const result = await upsertPartMetadata(meta)
        
        if (result.created) {
          syncResults.created++
        } else {
          syncResults.updated++
        }
        
        // operation_logs에 변경 이력 저장
        await logMetadataChange(meta, result)
        
      } catch (err) {
        console.error('❌ 메타 동기화 실패:', err)
        syncResults.errors++
      }
    }
    
    qualityStats.metaSyncCount += syncResults.updated + syncResults.created
    
    console.log(`✅ AI 메타 DB 동기화 완료: ${syncResults.updated}개 업데이트, ${syncResults.created}개 생성`)
    
    return syncResults
  }

  /**
   * 부품 메타데이터 업서트
   */
  const upsertPartMetadata = async (metadata) => {
    // parts_master_features 테이블 업데이트
    const updateData = {
      shape_tag: metadata.shape_tag,
      stud_count_top: metadata.stud_count_top,
      tube_count_bottom: metadata.tube_count_bottom,
      center_stud: metadata.center_stud,
      groove: metadata.groove,
      confusions: metadata.confusions,
      distinguishing_features: metadata.distinguishing_features,
      recognition_hints: metadata.recognition_hints,
      feature_text_score: metadata.feature_text_score,
      image_quality_ssim: metadata.image_quality?.ssim,
      image_quality_snr: metadata.image_quality?.snr,
      image_quality_q: metadata.image_quality?.q,
      version: (metadata.version || 0) + 1
    }
    
    // 실제 DB 업데이트 로직 (구현 필요)
    return { created: false, updated: true }
  }

  /**
   * 메타데이터 변경 로그
   */
  const logMetadataChange = async (metadata, result) => {
    const logEntry = {
      operation_type: 'meta_update',
      status: 'completed',
      metadata: {
        part_id: metadata.part_id,
        element_id: metadata.element_id,
        change_type: result.created ? 'created' : 'updated',
        version: metadata.version,
        source: metadata.meta_source
      },
      timestamp: new Date().toISOString()
    }
    
    // operation_logs 테이블에 저장 (구현 필요)
    console.log('📝 메타 변경 로그:', logEntry)
  }

  /**
   * 품질 검증 실행
   */
  const validateQuality = async (imageDataset, options = {}) => {
    const issues = []
    
    for (const image of imageDataset) {
      // 1. 이미지 품질 검증
      if (image.quality?.ssim < qualityThresholds.ssimMin) {
        issues.push({
          type: 'low_ssim',
          imageId: image.id,
          value: image.quality.ssim,
          threshold: qualityThresholds.ssimMin
        })
      }
      
      if (image.quality?.snr < qualityThresholds.snrMin) {
        issues.push({
          type: 'low_snr',
          imageId: image.id,
          value: image.quality.snr,
          threshold: qualityThresholds.snrMin
        })
      }
      
      if (image.quality?.q < qualityThresholds.qualityMin) {
        issues.push({
          type: 'low_quality',
          imageId: image.id,
          value: image.quality.q,
          threshold: qualityThresholds.qualityMin
        })
      }
      
      // 2. 마스크/라벨 품질 검증
      if (image.mask && image.bbox) {
        const maskArea = image.mask.area
        const bboxArea = image.bbox.width * image.bbox.height
        const ratio = maskArea / bboxArea
        
        if (ratio < qualityThresholds.maskAreaRatio.min || 
            ratio > qualityThresholds.maskAreaRatio.max) {
          issues.push({
            type: 'invalid_mask_ratio',
            imageId: image.id,
            value: ratio,
            threshold: qualityThresholds.maskAreaRatio
          })
        }
      }
    }
    
    qualityStats.qualityIssues += issues.length
    
    console.log(`🔍 품질 검증 완료: ${issues.length}개 이슈 발견`)
    
    return {
      issues,
      stats: { ...qualityStats }
    }
  }

  /**
   * 통합 품질 관리 파이프라인
   */
  const runQualityPipeline = async (imageDataset, options = {}) => {
    try {
      loading.value = true
      
      console.log('🔍 데이터 품질 관리 파이프라인 시작...')
      
      // 1. 중복 제거
      const deduplicationResult = await performDeduplication(imageDataset, options)
      
      // 2. RDA 적용
      const rdaResult = await applyRDA(deduplicationResult.remaining, options)
      
      // 3. 품질 검증
      const qualityResult = await validateQuality(rdaResult.train.concat(rdaResult.valTest), options)
      
      // 4. AI 메타 동기화
      const syncResult = await syncAIMetadata(qualityResult.metadata || [], options)
      
      console.log('✅ 데이터 품질 관리 파이프라인 완료')
      
      return {
        deduplication: deduplicationResult,
        rda: rdaResult,
        quality: qualityResult,
        sync: syncResult,
        stats: { ...qualityStats }
      }
      
    } catch (err) {
      error.value = err.message
      console.error('❌ 품질 관리 파이프라인 실패:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 통계 조회
   */
  const getQualityStats = () => {
    return {
      ...qualityStats,
      thresholds: qualityThresholds,
      rdaConfig
    }
  }

  /**
   * 통계 리셋
   */
  const resetStats = () => {
    qualityStats.totalImages = 0
    qualityStats.duplicatesRemoved = 0
    qualityStats.qualityIssues = 0
    qualityStats.rdaApplied = 0
    qualityStats.metaSyncCount = 0
  }

  return {
    loading,
    error,
    qualityStats,
    performDeduplication,
    applyRDA,
    syncAIMetadata,
    validateQuality,
    runQualityPipeline,
    getQualityStats,
    resetStats
  }
}
