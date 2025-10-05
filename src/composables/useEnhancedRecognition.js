import { ref } from 'vue'
import { usePartClassification } from './usePartClassification'
import { useFeatureFlipComparison } from './useFeatureFlipComparison'
import { useSemanticAnalysis } from './useSemanticAnalysis'
import { useMultiAttributeVoting } from './useMultiAttributeVoting'
import { useConfusionMatrix } from './useConfusionMatrix'

// 통합 인식 파이프라인
export function useEnhancedRecognition() {
  const loading = ref(false)
  const error = ref(null)
  const processing = ref(false)

  // 3-Tier 시스템 초기화
  const partClassification = usePartClassification()
  const featureFlipComparison = useFeatureFlipComparison()
  const semanticAnalysis = useSemanticAnalysis()
  const multiAttributeVoting = useMultiAttributeVoting()
  const confusionMatrix = useConfusionMatrix()

  // 향상된 인식 파이프라인
  const enhancedRecognitionPipeline = async (inputImage, partData) => {
    try {
      processing.value = true
      error.value = null

      console.log('🔍 Starting enhanced recognition pipeline...')

      // 1. 부품 유형 분류
      console.log('📊 Step 1: Part classification...')
      const tierClassification = partClassification.classifyPartTier(partData)
      console.log(`Classified as: ${tierClassification.tier}`)

      // 2. 향상된 메타데이터 생성
      const enhancedMetadata = partClassification.generateEnhancedMetadata(partData, tierClassification)
      console.log('Enhanced metadata:', enhancedMetadata)

      // 3. 조형형 부품 특화 처리
      let sculptedResult = null
      if (tierClassification.tier === 'SEMANTIC') {
        console.log('🎨 Step 2: Sculpted part analysis...')
        sculptedResult = await semanticAnalysis.handleSculptedParts(inputImage, partData)
        
        if (sculptedResult) {
          return {
            confidence: sculptedResult.confidence,
            isFlipped: false, // 조형형은 flip 허용 안 함
            orientation_locked: true,
            method: 'semantic',
            tier: tierClassification.tier,
            metadata: enhancedMetadata,
            details: sculptedResult.details
          }
        }
      }

      // 4. Feature-space Flip 비교
      console.log('🔄 Step 3: Feature flip comparison...')
      const flipComparison = await featureFlipComparison.compareWithFlippedFeature(
        inputImage, 
        partData
      )
      console.log('Flip comparison result:', flipComparison)

      // 5. 멀티-어트리뷰트 투표 (새로 추가)
      console.log('🗳️ Step 5: Multi-Attribute Voting...')
      const votingResults = await multiAttributeVoting.performMultiAttributeVoting(inputImage, [partData])
      const votingScore = votingResults[0]?.voting_score || { totalScore: 0 }

      // 6. 혼동군 페널티 적용 (새로 추가)
      console.log('🔍 Step 6: Applying confusion penalties...')
      const penalizedResults = await confusionMatrix.applyConfusionPenalty(votingResults)
      const penalizedScore = penalizedResults[0]?.confidence || 0

      // 7. 향상된 유사도 계산 (개선된 버전)
      console.log('📈 Step 7: Enhanced similarity calculation...')
      const weights = {
        flip: 0.3,      // Feature-space flip 비교
        voting: 0.4,     // 멀티-어트리뷰트 투표
        semantic: 0.2,   // 의미적 분석
        metadata: 0.1    // 메타데이터 보정
      }

      // 각 방법별 점수 계산
      const flipScore = flipComparison.confidence
      const semanticScore = sculptedResult?.confidence || 0
      const metadataBonus = calculateMetadataBonus(enhancedMetadata)

      // 가중 평균으로 최종 confidence 계산
      const finalConfidence = (
        flipScore * weights.flip +
        penalizedScore * weights.voting +
        semanticScore * weights.semantic +
        metadataBonus * weights.metadata
      )

      // 복잡도에 따른 가중치 (개선된 버전)
      let adjustedConfidence = finalConfidence
      if (enhancedMetadata.complexity_level === 'high') {
        adjustedConfidence *= 0.85 // 복잡한 부품은 더 보수적으로
      } else if (enhancedMetadata.complexity_level === 'low') {
        adjustedConfidence *= 1.1 // 단순한 부품은 더 자신감 있게
      }

      // 8. 결과 통합 (개선된 버전)
      const result = {
        confidence: Math.min(adjustedConfidence, 1.0),
        isFlipped: flipComparison.isFlipped,
        orientation_locked: enhancedMetadata.orientation_sensitive,
        method: 'enhanced_multi_attribute',
        tier: tierClassification.tier,
        metadata: enhancedMetadata,
        flipSignals: flipComparison.flipSignals,
        normalSimilarity: flipComparison.normal,
        flippedSimilarity: flipComparison.flipped,
        votingScore: votingScore,
        penalizedScore: penalizedScore,
        confusionPenalty: penalizedResults[0]?.confusion_penalty || 0,
        weights: weights
      }

      console.log('✅ Enhanced recognition completed:', result)
      return result

    } catch (err) {
      error.value = err.message
      console.error('Enhanced recognition failed:', err)
      throw err
    } finally {
      processing.value = false
    }
  }

  // 배치 처리
  const processBatchRecognition = async (inputImages, partsData) => {
    try {
      processing.value = true
      const results = []

      console.log(`🔄 Processing batch recognition for ${inputImages.length} images...`)

      for (let i = 0; i < inputImages.length; i++) {
        const inputImage = inputImages[i]
        const partData = partsData[i]

        try {
          const result = await enhancedRecognitionPipeline(inputImage, partData)
          results.push({
            index: i,
            success: true,
            result: result,
            error: null
          })
        } catch (err) {
          results.push({
            index: i,
            success: false,
            result: null,
            error: err.message
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      console.log(`✅ Batch processing completed: ${successCount}/${results.length} successful`)

      return {
        results,
        successCount,
        failureCount: results.length - successCount,
        successRate: successCount / results.length
      }

    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      processing.value = false
    }
  }

  // 신뢰도 기반 필터링
  const filterByConfidence = (results, threshold = 0.6) => {
    return results.filter(result => 
      result.success && result.result.confidence >= threshold
    )
  }

  // 결과 정렬 (신뢰도 기준)
  const sortByConfidence = (results) => {
    return results.sort((a, b) => 
      (b.result?.confidence || 0) - (a.result?.confidence || 0)
    )
  }

  // 통계 정보 생성
  const generateStatistics = (results) => {
    const successful = results.filter(r => r.success)
    const total = results.length

    if (total === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        averageConfidence: 0,
        tierDistribution: {},
        methodDistribution: {}
      }
    }

    const confidences = successful.map(r => r.result.confidence)
    const averageConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length

    const tierDistribution = {}
    const methodDistribution = {}

    successful.forEach(result => {
      const tier = result.result.tier
      const method = result.result.method

      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1
      methodDistribution[method] = (methodDistribution[method] || 0) + 1
    })

    return {
      total,
      successful: successful.length,
      failed: total - successful.length,
      successRate: successful.length / total,
      averageConfidence,
      tierDistribution,
      methodDistribution
    }
  }

  // 메타데이터 보너스 계산 (새로 추가)
  const calculateMetadataBonus = (metadata) => {
    let bonus = 0
    
    // 핵심 특징 일치 보너스
    if (metadata.has_stud) bonus += 0.1
    if (metadata.groove) bonus += 0.1
    if (metadata.center_stud) bonus += 0.15
    
    // 복잡도에 따른 보너스
    if (metadata.complexity_level === 'high') bonus += 0.05
    if (metadata.complexity_level === 'low') bonus += 0.1
    
    // 회전 불변 특징 보너스
    if (metadata.rotation_invariance) bonus += 0.05
    
    return Math.min(bonus, 0.3) // 최대 0.3 보너스
  }

  return {
    loading,
    error,
    processing,
    enhancedRecognitionPipeline,
    processBatchRecognition,
    filterByConfidence,
    sortByConfidence,
    generateStatistics,
    calculateMetadataBonus
  }
}
