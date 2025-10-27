import { ref, reactive } from 'vue'
import { useSupabase } from './useSupabase'

export function useMasterPartsMatching() {
  const { supabase } = useSupabase()
  const targetParts = ref([])
  const masterParts = ref([])
  const isLoaded = ref(false)
  const referenceImageCache = new Map()

  // 타겟 세트 부품 로드
  const loadTargetSetParts = async (setNum) => {
    try {
      console.log(`Loading target parts for set: ${setNum}`)
      
      // 1단계: 정확한 매치 시도
      let legoSet = null
      try {
        const { data: exactMatch, error: exactError } = await supabase
          .from('lego_sets')
          .select('id, set_num, name')
          .eq('set_num', setNum)
          .limit(1)
        
        if (exactError) throw exactError
        if (exactMatch && exactMatch.length > 0) {
          legoSet = exactMatch[0]
          console.log('Exact match found:', legoSet)
        }
      } catch (error) {
        console.log('Exact match failed for:', setNum)
      }

      // 2단계: 기본 번호로 시도 (예: 76270-1 -> 76270)
      if (!legoSet) {
        const baseSetNum = setNum.split('-')[0]
        try {
          const { data: baseMatch, error: baseError } = await supabase
            .from('lego_sets')
            .select('id, set_num, name')
            .eq('set_num', baseSetNum)
            .limit(1)
          
          if (baseError) throw baseError
          if (baseMatch && baseMatch.length > 0) {
            legoSet = baseMatch[0]
            console.log('Base match found:', legoSet)
          }
        } catch (error) {
          console.log('Base match failed for:', baseSetNum)
        }
      }

      // 3단계: LIKE 패턴으로 시도
      if (!legoSet) {
        try {
          const { data: likeMatch, error: likeError } = await supabase
            .from('lego_sets')
            .select('id, set_num, name')
            .like('set_num', `${setNum}%`)
            .limit(1)
          
          if (likeError) throw likeError
          if (likeMatch && likeMatch.length > 0) {
            legoSet = likeMatch[0]
            console.log('Found set with LIKE:', legoSet.set_num)
          }
        } catch (error) {
          console.log('LIKE pattern failed for:', setNum)
        }
      }

      if (!legoSet) {
        throw new Error(`Set ${setNum} not found`)
      }

      console.log('Found lego set:', legoSet)

      // 세트 부품 로드
      const { data: setParts, error: setPartsError } = await supabase
        .from('set_parts')
        .select(`
          part_id,
          color_id,
          quantity,
          element_id,
          lego_parts(part_num, name),
          lego_colors(color_id, name, rgb)
        `)
        .eq('set_id', legoSet.id)

      if (setPartsError) throw setPartsError

      console.log('Set parts found:', setParts.length)
      console.log('Sample set part:', setParts[0])

      targetParts.value = setParts || []
      
      // 부품 ID와 색상 ID 수집
      const partIds = setParts.map(sp => sp.part_id)
      const colorIds = setParts.map(sp => sp.color_id)

      console.log('Part IDs to search:', partIds)
      console.log('Color IDs to search:', colorIds)

      // 마스터 부품 데이터는 set_parts에서 이미 로드됨
      console.log('Using set parts as master data')
      masterParts.value = setParts || []
      isLoaded.value = true

        return {
        targetParts: targetParts.value,
        masterParts: masterParts.value,
        legoSet
      }
    } catch (error) {
      console.error('Error loading target set parts:', error)
      throw error
    }
  }

  // 사용 가능한 세트 목록 가져오기
  const getAvailableSets = async () => {
    try {
      const { data, error } = await supabase
        .from('lego_sets')
        .select('set_num, name')
        .limit(20)
        .order('set_num')
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching available sets:', error)
      return []
    }
  }

  // 최적화된 이미지 분석 (성능 우선)
  const analyzeImageForParts = (imageBase64) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        // 이미지 크기 제한 (성능 최적화)
        const maxSize = 300
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = Math.floor(img.width * scale)
        canvas.height = Math.floor(img.height * scale)
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // 캔버스 크기 검증
        if (canvas.width === 0 || canvas.height === 0) {
          console.warn('Canvas has zero dimensions, using fallback features')
          resolve({ color: [0.5, 0.5, 0.5], shape: [0.5, 0.5, 0.5] })
          return
        }
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const features = performFastImageAnalysis(imageData.data, canvas.width, canvas.height)
        // 종횡비(가로/세로) 추가
        features.aspectRatio = canvas.width > 0 && canvas.height > 0 ? canvas.width / canvas.height : 1
        
        resolve(features)
      }
      img.src = imageBase64
    })
  }

  // 빠른 이미지 분석
  const performFastImageAnalysis = (data, width, height) => {
    let totalR = 0, totalG = 0, totalB = 0
    let edgeCount = 0
    const step = Math.max(1, Math.floor(width * height / 500)) // 샘플링 증가
    
    // 색상 및 엣지 분석
    for (let i = 0; i < data.length; i += step * 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      totalR += r
      totalG += g
      totalB += b
      
      // 간단한 엣지 검출
      if (i + step * 4 < data.length) {
        const current = (r + g + b) / 3
        const next = (data[i + step * 4] + data[i + step * 4 + 1] + data[i + step * 4 + 2]) / 3
        if (Math.abs(current - next) > 30) {
          edgeCount++
        }
      }
    }
    
    const pixelCount = Math.floor(data.length / 4 / step)
    
    return {
      avgColor: {
        r: Math.round(totalR / pixelCount),
        g: Math.round(totalG / pixelCount),
        b: Math.round(totalB / pixelCount)
      },
      edgeCount: Math.min(edgeCount, 1000), // 최대값 제한
      brightness: (totalR + totalG + totalB) / (pixelCount * 3) / 255,
      contrast: 0.7, // 기본값
      complexity: Math.min(edgeCount / 100, 1)
    }
  }

  // 빠른 색상 유사도 계산
  const calculateFastColorSimilarity = (imageColor, targetColor) => {
    try {
      if (!targetColor || !targetColor.rgb) return 0.5
      if (!imageColor || typeof imageColor.r !== 'number' || typeof imageColor.g !== 'number' || typeof imageColor.b !== 'number') {
        console.warn('Invalid imageColor, using fallback')
        return 0.5
      }
      
      const targetRgb = parseRgbColor(targetColor.rgb)
      if (!targetRgb) return 0.5
      
      const distance = Math.sqrt(
        Math.pow(imageColor.r - targetRgb.r, 2) +
        Math.pow(imageColor.g - targetRgb.g, 2) +
        Math.pow(imageColor.b - targetRgb.b, 2)
      )
      
      return Math.max(0, 1 - distance / 441) // 441 = sqrt(255^2 * 3)
    } catch (error) {
      console.error('Color similarity error:', error)
      return 0.5
    }
  }

  // RGB 색상 파싱
  const parseRgbColor = (rgbString) => {
    if (!rgbString) return null
    
    const hex = rgbString.replace('#', '')
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      }
    }
    return null
  }

  // 간단한 크기 유사도
  const calculateSimpleSizeSimilarity = (edgeCount, targetPart) => {
    // 기본 크기 추정 (엣지 수 기반)
    const estimatedSize = Math.min(edgeCount / 50, 1)
    return Math.max(0.3, 1 - Math.abs(estimatedSize - 0.5))
  }

  // 기본 형상 유사도
  const calculateBasicShapeSimilarity = (imageFeatures, targetPart) => {
    // 복잡도 기반 형상 유사도
    return Math.max(0.3, imageFeatures.complexity)
  }

  // 부품명 기반 텍스트 유사도 계산
  const calculateTextSimilarity = (imageFeatures, targetPart) => {
    try {
      const partName = targetPart.lego_parts?.name?.toLowerCase() || ''
      if (!partName) return 0.5
      
      // 간단한 키워드 매칭 (실제로는 더 정교한 NLP 필요)
      const commonKeywords = ['brick', 'plate', 'tile', 'slope', 'round', 'square', 'rectangular']
      const hasKeyword = commonKeywords.some(keyword => partName.includes(keyword))
      
      // 복잡도와 키워드 매칭 조합
      const complexityMatch = imageFeatures.complexity > 0.7 ? 0.8 : 0.6
      const keywordMatch = hasKeyword ? 0.9 : 0.7
      
      return (complexityMatch + keywordMatch) / 2
    } catch (error) {
      console.error('Text similarity calculation error:', error)
      return 0.5
    }
  }

  // 메타데이터 기반 유사도 (카테고리/종횡비 힌트 활용)
  const calculateMetadataSimilarity = (imageFeatures, targetPart) => {
    try {
      const name = (targetPart.lego_parts?.name || '').toLowerCase()
      const ar = imageFeatures.aspectRatio ?? 1
      // 이름 기반 카테고리 추정
      const isPlate = name.includes('plate')
      const isTile = name.includes('tile')
      const isSlope = name.includes('slope')
      const isBrick = name.includes('brick')

      // 종횡비 힌트: plate/타일은 대체로 가로로 길쭉(ar>=1.6) 또는 얇은 형태
      let aspectScore = 0.5
      if (isPlate || isTile) {
        if (ar >= 1.6) aspectScore = 0.9
        else if (ar >= 1.2) aspectScore = 0.75
        else aspectScore = 0.55
      } else if (isBrick) {
        if (ar >= 0.8 && ar <= 1.5) aspectScore = 0.8
        else aspectScore = 0.6
      } else if (isSlope) {
        // 경사류는 대체로 중간 비율
        if (ar >= 1.2 && ar <= 2.2) aspectScore = 0.75
        else aspectScore = 0.6
      }

      // 이름 카테고리 매칭 점수
      const categoryScore = (isPlate || isTile || isBrick || isSlope) ? 0.8 : 0.6

      return Math.max(0, Math.min(1, (aspectScore * 0.6 + categoryScore * 0.4)))
    } catch (error) {
      console.error('Metadata similarity error:', error)
      return 0.5
    }
  }

  // 수량 정보 검증 (가중치 없이 존재 여부만 확인)
  const validateQuantity = (targetPart) => {
    try {
      const quantity = targetPart.quantity || 0
      // 수량이 0보다 크면 해당 세트에 존재하는 부품
      return quantity > 0
    } catch (error) {
      console.error('Quantity validation error:', error)
      return false
    }
  }

  // 부품 이미지 URL 조회 (Storage 직접 접근)
  const getPartImageUrl = async (partId, colorId) => {
    try {
      // 먼저 part_images 테이블에서 조회 시도
      const { data: partImages, error } = await supabase
        .from('part_images')
        .select('uploaded_url')
        .eq('part_id', partId)
        .eq('color_id', colorId)
        .not('uploaded_url', 'is', null)
        .limit(1)
      
      if (!error && partImages?.[0]?.uploaded_url) {
        return partImages[0].uploaded_url
      }
      
      // part_images에 없으면 Storage URL 직접 생성
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
      if (supabaseUrl) {
        const bucketName = 'lego_parts_images'
        const fileName = `${partId}_${colorId}.webp`
        const directUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
        
        // 이미지 존재 여부 확인
        try {
          const response = await fetch(directUrl, { method: 'HEAD' })
          if (response.ok) {
            console.log(`✅ Found image in Storage: ${fileName}`)
            return directUrl
          }
        } catch (fetchError) {
          console.log(`❌ Image not found in Storage: ${fileName}`)
        }
      }
      
      return null
    } catch (error) {
      console.warn('Error in getPartImageUrl:', error)
      return null
    }
  }

  // Supabase Storage 이미지와 유사도 계산
  const calculateImageSimilarity = async (capturedImage, targetPart) => {
    try {
      // part_images 테이블에서 이미지 URL 조회
      const imageUrl = await getPartImageUrl(targetPart.part_id, targetPart.color_id)
      if (!imageUrl) {
        console.log('No reference image available for part:', targetPart.lego_parts?.name)
        return 0.5 // 기본값
      }

      // Supabase Storage 이미지 로드
      const referenceImage = await loadImageFromStorage(imageUrl)
      if (!referenceImage) {
        console.warn('Failed to load reference image:', imageUrl)
        return 0.5
      }

      // 이미지 유사도 계산 (간단한 픽셀 기반 비교)
      const similarity = await compareImages(capturedImage, referenceImage)
      console.log(`Image similarity for ${targetPart.lego_parts?.name}: ${similarity.toFixed(3)}`)
      
      return similarity
    } catch (error) {
      console.error('Image similarity calculation error:', error)
      return 0.5
    }
  }

  // Supabase Storage에서 이미지 로드
  const loadImageFromStorage = async (imageUrl) => {
    try {
      if (referenceImageCache.has(imageUrl)) {
        return referenceImageCache.get(imageUrl)
      }
      const p = new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous' // CORS 설정
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageUrl
      })
      referenceImageCache.set(imageUrl, p)
      return p
    } catch (error) {
      console.error('Failed to load image from storage:', error)
      return null
    }
  }

  // 두 이미지 비교 (간단한 픽셀 기반)
  const compareImages = async (capturedImageBase64, referenceImage) => {
    try {
      // 촬영한 이미지를 Image 객체로 변환
      const capturedImage = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Failed to load captured image'))
        img.src = capturedImageBase64
      })

      const canvas1 = document.createElement('canvas')
      const canvas2 = document.createElement('canvas')
      const ctx1 = canvas1.getContext('2d')
      const ctx2 = canvas2.getContext('2d')

      // 이미지 크기 통일 (64x64로 리사이즈)
      const size = 64
      canvas1.width = canvas2.width = size
      canvas1.height = canvas2.height = size

      ctx1.drawImage(capturedImage, 0, 0, size, size)
      ctx2.drawImage(referenceImage, 0, 0, size, size)

      const data1 = ctx1.getImageData(0, 0, size, size).data
      const data2 = ctx2.getImageData(0, 0, size, size).data

      // 픽셀별 차이 계산
      let totalDiff = 0
      for (let i = 0; i < data1.length; i += 4) {
        const r1 = data1[i]
        const g1 = data1[i + 1]
        const b1 = data1[i + 2]
        const r2 = data2[i]
        const g2 = data2[i + 1]
        const b2 = data2[i + 2]

        const diff = Math.sqrt(
          Math.pow(r1 - r2, 2) + 
          Math.pow(g1 - g2, 2) + 
          Math.pow(b1 - b2, 2)
        )
        totalDiff += diff
      }

      // 유사도 계산 (0-1 범위)
      const maxDiff = Math.sqrt(3 * 255 * 255) * (size * size)
      const similarity = Math.max(0, 1 - (totalDiff / maxDiff))
      
      return similarity
    } catch (error) {
      console.error('Image comparison error:', error)
      return 0.5
    }
  }

  // 최적화된 유사도 계산 (메타데이터 + 이미지 활용 강화)
  const calculateRealSimilarity = async (imageFeatures, targetPart, capturedImage) => {
    try {
      const colorSimilarity = calculateFastColorSimilarity(imageFeatures.avgColor, targetPart.lego_colors)
      const sizeSimilarity = calculateSimpleSizeSimilarity(imageFeatures.edgeCount, targetPart)
      const shapeSimilarity = calculateBasicShapeSimilarity(imageFeatures, targetPart)
      
      // 부품명 기반 텍스트 유사도 (간단한 키워드 매칭)
      const textSimilarity = calculateTextSimilarity(imageFeatures, targetPart)
      
      // Supabase Storage 이미지와 유사도 계산 (임시 비활성화 - Storage 동기화 필요)
      let imageSimilarity = 0.5
      try {
        imageSimilarity = await calculateImageSimilarity(capturedImage, targetPart)
      } catch (error) {
        console.log(`Using fallback image similarity for ${targetPart.lego_parts?.name}`)
        // 이미지가 없으면 색상+형상 유사도로 추정
        imageSimilarity = (colorSimilarity + shapeSimilarity) / 2
      }
      
      // 수량 정보 검증 (해당 세트에 존재하는 부품인지 확인)
      const isValidPart = validateQuantity(targetPart)
      
      // 메타데이터 유사도 계산
      const metadataSimilarity = calculateMetadataSimilarity(imageFeatures, targetPart)

      // 가중 평균으로 최종 유사도 계산 (메타데이터 포함)
      const similarity = (
        colorSimilarity * 0.30 +
        sizeSimilarity * 0.25 +
        shapeSimilarity * 0.15 +
        textSimilarity * 0.10 +
        imageSimilarity * 0.15 +
        metadataSimilarity * 0.05
      )

      return {
        similarity: Math.max(0, Math.min(1, similarity)),
        colorMatch: colorSimilarity,
        sizeMatch: sizeSimilarity,
        shapeMatch: shapeSimilarity,
        textMatch: textSimilarity,
        imageMatch: imageSimilarity,
        metadataMatch: metadataSimilarity,
        isValidPart: isValidPart,
        // 메타데이터 정보 추가
        partInfo: {
          partNum: targetPart.lego_parts?.part_num,
          partName: targetPart.lego_parts?.name,
          colorName: targetPart.lego_colors?.name,
          quantity: targetPart.quantity,
          imageUrl: await getPartImageUrl(targetPart.part_id, targetPart.color_id)
        }
      }
    } catch (error) {
      console.error('Error calculating similarity:', error)
      return {
        similarity: 0.5,
        colorMatch: 0.5,
        sizeMatch: 0.5,
        shapeMatch: 0.5,
        textMatch: 0.5,
        imageMatch: 0.5,
        isValidPart: false
      }
    }
  }

  // 색상 기반 타겟 필터링
  const filterTargetsByNearestColor = (imageColor, targetParts) => {
    const colorSimilarities = targetParts.map(part => ({
      part,
      colorSimilarity: calculateFastColorSimilarity(imageColor, part.lego_colors)
    }))
    
    colorSimilarities.sort((a, b) => b.colorSimilarity - a.colorSimilarity)
    
    const topCount = Math.min(10, colorSimilarities.length)
    return colorSimilarities.slice(0, topCount).map(item => item.part)
  }

  // 실제 이미지 기반 부품 매칭
  const matchDetectedPart = async (imageBase64) => {
    try {
      console.log('🔍 Analyzing real image for parts...')
      // 입력 이미지 유효성(최소 크기) 확인
      const dimOk = await (async () => {
        try {
          const probe = await new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve({ w: img.width, h: img.height })
            img.onerror = () => resolve({ w: 0, h: 0 })
            img.src = imageBase64
          })
          return probe.w >= 32 && probe.h >= 32
        } catch (_) { return false }
      })()
      if (!dimOk) {
        console.warn('Skipped crop (too small/invalid)')
        return []
      }
      
      // 실제 이미지 분석
      const imageFeatures = await analyzeImageForParts(imageBase64)
      console.log('Extracting real image features')
      
      // 타겟 부품이 없으면 빈 배열 반환
      if (!targetParts.value || targetParts.value.length === 0) {
        console.log('No target parts available')
        return []
      }
      
      // 색상 기반 필터링
      let filteredTargets = filterTargetsByNearestColor(imageFeatures.avgColor, targetParts.value)
      console.log(`Filtered to ${filteredTargets.length} color-similar targets`)

      // 메타데이터 기반 2차 필터: 종횡비가 큰 경우 plate 계열 우선
      const nameIncludes = (p, kw) => (p.lego_parts?.name || '').toLowerCase().includes(kw)
      if ((imageFeatures.aspectRatio ?? 1) >= 1.6) {
        const plateFav = filteredTargets.filter(p => nameIncludes(p, 'plate'))
        if (plateFav.length >= 3) {
          filteredTargets = plateFav
          console.log(`Metadata filter applied (plate favored): ${filteredTargets.length}` )
        }
      }
      
      // 유사도 계산 (이미지 포함)
      const similarities = await Promise.all(filteredTargets.map(async targetPart => {
        const similarity = await calculateRealSimilarity(imageFeatures, targetPart, imageBase64)
        return {
          part: targetPart,
          similarity: similarity.similarity,
          confidence: similarity.similarity * 0.7 + similarity.colorMatch * 0.3,
          colorMatch: similarity.colorMatch,
          sizeMatch: similarity.sizeMatch,
          shapeMatch: similarity.shapeMatch,
          imageMatch: similarity.imageMatch
        }
      }))
      
      // 저유사도 제거 및 상위 후보 선택
      const pruned = similarities.filter(s => (s.similarity ?? 0) >= 0.6 || (s.imageMatch ?? 0) >= 0.6)
      pruned.sort((a, b) => b.similarity - a.similarity)
      const topCandidates = (pruned.length > 0 ? pruned : similarities).slice(0, 1)
      
      console.log(`Found ${topCandidates.length} candidates`)
      return topCandidates
    } catch (error) {
      console.error('Error in real image matching:', error)
      return []
    }
  }

  return {
    targetParts,
    masterParts,
    isLoaded,
    loadTargetSetParts,
    getAvailableSets,
    matchDetectedPart
  }
}

