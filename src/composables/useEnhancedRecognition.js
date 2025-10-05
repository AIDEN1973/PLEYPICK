import { ref } from 'vue'
import { usePartClassification } from './usePartClassification'
import { useFeatureFlipComparison } from './useFeatureFlipComparison'
import { useSemanticAnalysis } from './useSemanticAnalysis'

// 통합 인식 파이프라인
export function useEnhancedRecognition() {
  const loading = ref(false)
  const error = ref(null)
  const processing = ref(false)

  // 3-Tier 시스템 초기화
  const partClassification = usePartClassification()
  const featureFlipComparison = useFeatureFlipComparison()
  const semanticAnalysis = useSemanticAnalysis()

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

      // 5. 향상된 유사도 계산
      console.log('📈 Step 4: Enhanced similarity calculation...')
      const finalConfidence = featureFlipComparison.calculateEnhancedSimilarity(
        flipComparison,
        enhancedMetadata
      )

      // 6. 결과 통합
      const result = {
        confidence: finalConfidence,
        isFlipped: flipComparison.isFlipped,
        orientation_locked: enhancedMetadata.orientation_sensitive,
        method: flipComparison.method,
        tier: tierClassification.tier,
        metadata: enhancedMetadata,
        flipSignals: flipComparison.flipSignals,
        normalSimilarity: flipComparison.normal,
        flippedSimilarity: flipComparison.flipped
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

  return {
    loading,
    error,
    processing,
    enhancedRecognitionPipeline,
    processBatchRecognition,
    filterByConfidence,
    sortByConfidence,
    generateStatistics
  }
}
