import { ref } from 'vue'

// 조형형 부품 감지 및 의미적 유사도 계산
export function useSemanticAnalysis() {
  const loading = ref(false)
  const error = ref(null)

  // 조형형 부품 감지
  const detectSculptedPart = async (imageUrl, partData) => {
    try {
      loading.value = true
      
      // 1. 텍스트 기반 조형형 감지
      const textBasedDetection = detectSculptedByText(partData)
      
      // 2. 이미지 기반 복잡도 분석
      const imageComplexity = await analyzeImageComplexity(imageUrl)
      
      // 3. 특징 기반 조형형 감지
      const featureBasedDetection = detectSculptedByFeatures(partData)
      
      // 종합 판단
      const isSculpted = (
        textBasedDetection.score > 0.7 ||
        imageComplexity.score > 0.6 ||
        featureBasedDetection.score > 0.6
      )
      
      return {
        isSculpted,
        confidence: Math.max(
          textBasedDetection.score,
          imageComplexity.score,
          featureBasedDetection.score
        ),
        details: {
          text: textBasedDetection,
          image: imageComplexity,
          features: featureBasedDetection
        }
      }
    } catch (err) {
      error.value = err.message
      return { isSculpted: false, confidence: 0, details: {} }
    } finally {
      loading.value = false
    }
  }

  // 텍스트 기반 조형형 감지
  const detectSculptedByText = (partData) => {
    const name = partData.name?.toLowerCase() || ''
    const description = partData.description?.toLowerCase() || ''
    
    // 조형형 키워드
    const sculptedKeywords = [
      'head', 'face', 'lion', 'animal', 'figure', 'sculpted',
      'curved', 'slope', 'decorative', 'print', 'pattern',
      'grill', 'swirled', 'special', 'round', 'vintage'
    ]
    
    // 키워드 매칭 점수 계산
    let score = 0
    const matchedKeywords = []
    
    sculptedKeywords.forEach(keyword => {
      if (name.includes(keyword) || description.includes(keyword)) {
        score += 0.1
        matchedKeywords.push(keyword)
      }
    })
    
    return {
      score: Math.min(score, 1.0),
      matchedKeywords,
      method: 'text_analysis'
    }
  }

  // 이미지 복잡도 분석
  const analyzeImageComplexity = async (imageUrl) => {
    try {
      // 실제 구현에서는 이미지 처리 라이브러리 사용
      // 여기서는 시뮬레이션
      const complexity = {
        texture_entropy: Math.random() * 0.5 + 0.3,
        edge_diversity: Math.random() * 0.5 + 0.3,
        shape_irregularity: Math.random() * 0.5 + 0.3,
        color_variation: Math.random() * 0.5 + 0.3
      }
      
      const score = (
        complexity.texture_entropy * 0.3 +
        complexity.edge_diversity * 0.3 +
        complexity.shape_irregularity * 0.2 +
        complexity.color_variation * 0.2
      )
      
      return {
        score,
        details: complexity,
        method: 'image_complexity'
      }
    } catch (err) {
      return { score: 0, details: {}, method: 'image_complexity' }
    }
  }

  // 특징 기반 조형형 감지
  const detectSculptedByFeatures = (partData) => {
    const features = partData.feature_json || {}
    
    // 조형형 특징들
    const sculptedFeatures = [
      'curved', 'slope', 'special', 'round', 'decorative',
      'print', 'pattern', 'grill', 'swirled'
    ]
    
    let score = 0
    const matchedFeatures = []
    
    sculptedFeatures.forEach(feature => {
      if (features[feature] || partData.name?.toLowerCase().includes(feature)) {
        score += 0.15
        matchedFeatures.push(feature)
      }
    })
    
    return {
      score: Math.min(score, 1.0),
      matchedFeatures,
      method: 'feature_analysis'
    }
  }

  // 의미적 유사도 계산 (개선된 버전 - 이미지 기반 의미 키포인트 추가)
  const calculateSemanticSimilarity = async (inputImage, partData) => {
    try {
      loading.value = true
      
      // 1. CLIP 텍스트 임베딩 생성
      const textEmbedding = await generateTextEmbedding(partData.description || partData.name)
      
      // 2. CLIP 이미지 임베딩 생성
      const imageEmbedding = await generateClipEmbedding(inputImage)
      
      // 3. 코사인 유사도 계산
      const textSimilarity = cosineSimilarity(imageEmbedding, textEmbedding)
      
      // 4. 키워드 기반 유사도
      const keywordSimilarity = calculateKeywordSimilarity(inputImage, partData)
      
      // 5. 이미지 기반 의미 키포인트 분석 (새로 추가)
      const semanticKeypoints = await analyzeSemanticKeypoints(inputImage, partData)
      
      // 6. 대칭축 및 상대 위치 분석 (새로 추가)
      const symmetryAnalysis = await analyzeSymmetryAndPosition(inputImage)
      
      // 7. 종합 의미적 유사도 (개선된 가중치)
      const semanticScore = (
        textSimilarity * 0.4 +           // 텍스트 유사도 (의존성 감소)
        keywordSimilarity * 0.2 +       // 키워드 유사도
        semanticKeypoints.score * 0.3 +  // 의미 키포인트 (새로 추가)
        symmetryAnalysis.score * 0.1     // 대칭성 분석 (새로 추가)
      )
      
      return {
        score: semanticScore,
        textSimilarity,
        keywordSimilarity,
        semanticKeypoints,
        symmetryAnalysis,
        method: 'enhanced_semantic_comparison'
      }
    } catch (err) {
      error.value = err.message
      return { score: 0, textSimilarity: 0, keywordSimilarity: 0, method: 'enhanced_semantic_comparison' }
    } finally {
      loading.value = false
    }
  }

  // 텍스트 임베딩 생성
  const generateTextEmbedding = async (text) => {
    // 실제 구현에서는 OpenAI API 사용
    // 여기서는 시뮬레이션
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
  }

  // CLIP 이미지 임베딩 생성
  const generateClipEmbedding = async (imageUrl) => {
    // 실제 구현에서는 CLIP 모델 사용
    // 여기서는 시뮬레이션
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
  }

  // 키워드 기반 유사도
  const calculateKeywordSimilarity = async (inputImage, partData) => {
    // 이미지에서 추출된 키워드와 부품 설명의 키워드 비교
    const imageKeywords = await extractImageKeywords(inputImage)
    const partKeywords = extractPartKeywords(partData)
    
    // 키워드 겹침 비율 계산
    const intersection = imageKeywords.filter(k => partKeywords.includes(k))
    const union = [...new Set([...imageKeywords, ...partKeywords])]
    
    return intersection.length / union.length
  }

  // 이미지에서 키워드 추출
  const extractImageKeywords = async (imageUrl) => {
    // 실제 구현에서는 이미지 분석 AI 사용
    // 여기서는 시뮬레이션
    return ['round', 'curved', 'stud', 'groove']
  }

  // 부품에서 키워드 추출
  const extractPartKeywords = (partData) => {
    const name = partData.name?.toLowerCase() || ''
    const description = partData.description?.toLowerCase() || ''
    
    const keywords = []
    const keywordList = [
      'round', 'curved', 'stud', 'groove', 'hole', 'slope',
      'special', 'decorative', 'print', 'pattern', 'grill'
    ]
    
    keywordList.forEach(keyword => {
      if (name.includes(keyword) || description.includes(keyword)) {
        keywords.push(keyword)
      }
    })
    
    return keywords
  }

  // 의미 키포인트 분석 (새로 추가)
  const analyzeSemanticKeypoints = async (inputImage, partData) => {
    try {
      // 실제 구현에서는 Grad-CAM, 의미적 키포인트 감지 사용
      // 눈, 입, 갈기, 귀 등의 상대 위치 분석
      const keypoints = {
        eyes: await detectEyes(inputImage),
        mouth: await detectMouth(inputImage),
        mane: await detectMane(inputImage),
        ears: await detectEars(inputImage)
      }
      
      // 키포인트 간 상대 위치 일관성 검사
      const positionConsistency = calculatePositionConsistency(keypoints)
      
      return {
        score: positionConsistency,
        keypoints,
        method: 'semantic_keypoints'
      }
    } catch (err) {
      return { score: 0, keypoints: {}, method: 'semantic_keypoints' }
    }
  }

  // 대칭축 및 상대 위치 분석 (새로 추가)
  const analyzeSymmetryAndPosition = async (inputImage) => {
    try {
      // 실제 구현에서는 대칭축 감지, 상대 위치 분석 사용
      const symmetryMap = await generateSymmetryMap(inputImage)
      const symmetryScore = calculateSymmetryScore(symmetryMap)
      
      return {
        score: symmetryScore,
        symmetryMap,
        method: 'symmetry_analysis'
      }
    } catch (err) {
      return { score: 0, symmetryMap: null, method: 'symmetry_analysis' }
    }
  }

  // 개별 키포인트 감지 함수들
  const detectEyes = async (imageUrl) => ({ x: 0, y: 0, confidence: 0.8 })
  const detectMouth = async (imageUrl) => ({ x: 0, y: 0, confidence: 0.7 })
  const detectMane = async (imageUrl) => ({ x: 0, y: 0, confidence: 0.6 })
  const detectEars = async (imageUrl) => ({ x: 0, y: 0, confidence: 0.5 })

  // 위치 일관성 계산
  const calculatePositionConsistency = (keypoints) => {
    // 실제 구현에서는 키포인트 간 상대 위치 일관성 계산
    return Math.random() * 0.5 + 0.3
  }

  // 대칭축 맵 생성
  const generateSymmetryMap = async (imageUrl) => {
    // 실제 구현에서는 대칭축 감지 알고리즘 사용
    return { axis: 'vertical', confidence: 0.8 }
  }

  // 대칭성 점수 계산
  const calculateSymmetryScore = (symmetryMap) => {
    // 실제 구현에서는 대칭성 분석 알고리즘 사용
    return Math.random() * 0.5 + 0.3
  }

  // 코사인 유사도 계산
  const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }
    
    if (normA === 0 || normB === 0) return 0
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  // 조형형 부품 특화 처리
  const handleSculptedParts = async (inputImage, partData) => {
    const sculptedDetection = await detectSculptedPart(inputImage, partData)
    
    if (sculptedDetection.isSculpted) {
      const semanticSimilarity = await calculateSemanticSimilarity(inputImage, partData)
      
      return {
        confidence: 0.7 * semanticSimilarity.score + 0.3 * sculptedDetection.confidence,
        orientation_locked: true, // 조형형은 flip 허용 안 함
        method: 'semantic',
        details: {
          sculpted: sculptedDetection,
          semantic: semanticSimilarity
        }
      }
    }
    
    return null
  }

  return {
    loading,
    error,
    detectSculptedPart,
    calculateSemanticSimilarity,
    handleSculptedParts,
    detectSculptedByText,
    analyzeImageComplexity,
    detectSculptedByFeatures
  }
}
