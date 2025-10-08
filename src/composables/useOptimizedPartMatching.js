import { ref, reactive } from 'vue'
import { useSupabase } from './useSupabase'

/**
 * 최적화된 부품 매칭 시스템
 * - 메타데이터 기반 비교 (이미지 다운로드 최소화)
 * - 온디맨드 캐싱 (필요한 부품만 로컬 저장)
 * - 벡터 유사도 계산 (CLIP/ViT 임베딩)
 */
export function useOptimizedPartMatching() {
  const { supabase } = useSupabase()
  const loading = ref(false)
  const error = ref(null)
  
  // 로컬 캐시 상태
  const cacheState = reactive({
    cachedParts: new Map(), // part_id -> { metadata, localImages }
    cacheSize: 0,
    lastUpdated: null
  })

  // 세트별 부품 메타데이터 로드 (이미지 없이)
  const loadSetMetadata = async (setNum) => {
    try {
      loading.value = true
      console.log(`📊 세트 메타데이터 로드: ${setNum}`)
      
      // 1. 세트 정보 조회
      const { data: setData, error: setError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', setNum)
        .single()
      
      if (setError) throw setError
      
      // 2. 부품 메타데이터만 조회 (이미지 URL 제외)
      const { data: partsData, error: partsError } = await supabase
        .from('set_parts')
        .select(`
          part_id,
          color_id,
          quantity,
          is_spare,
          lego_parts!inner(name, part_cat_id),
          lego_colors!inner(name, rgb)
        `)
        .eq('set_id', setData.id)
      
      if (partsError) throw partsError
      
      // 3. 부품별 특징 벡터 조회 (parts_master_features)
      const partIds = [...new Set(partsData.map(p => p.part_id))]
      const { data: featuresData, error: featuresError } = await supabase
        .from('parts_master_features')
        .select('part_id, color_id, feature_json, clip_text_emb, confidence')
        .in('part_id', partIds)
      
      if (featuresError) {
        console.warn('특징 데이터 조회 실패, 기본 메타데이터만 사용')
      }
      
      // 4. 메타데이터 구조화
      const metadata = partsData.map(part => {
        const features = featuresData?.find(f => 
          f.part_id === part.part_id && f.color_id === part.color_id
        )
        
        return {
          part_id: part.part_id,
          color_id: part.color_id,
          quantity: part.quantity,
          is_spare: part.is_spare,
          part_name: part.lego_parts?.name,
          color_name: part.lego_colors?.name,
          color_rgb: part.lego_colors?.rgb,
          // 특징 벡터 (있는 경우)
          shape_vector: features?.feature_json?.shape_vector,
          color_lab: features?.feature_json?.color_lab,
          size_stud: features?.feature_json?.size_stud,
          orientation_features: features?.feature_json?.orientation_features,
          confidence: features?.confidence || 0.5
        }
      })
      
      console.log(`📊 메타데이터 로드 완료: ${metadata.length}개 부품`)
      console.log(`📊 특징 벡터 포함: ${metadata.filter(m => m.shape_vector).length}개`)
      
      return {
        setInfo: setData,
        partsMetadata: metadata,
        totalParts: metadata.length,
        withFeatures: metadata.filter(m => m.shape_vector).length
      }
      
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 온디맨드 이미지 캐싱 (필요한 부품만)
  const cachePartImages = async (partIds, maxImagesPerPart = 3) => {
    try {
      console.log(`📦 온디맨드 캐싱 시작: ${partIds.length}개 부품`)
      
      const cachePromises = partIds.map(async (partId) => {
        if (cacheState.cachedParts.has(partId)) {
          console.log(`📦 이미 캐시됨: ${partId}`)
          return cacheState.cachedParts.get(partId)
        }
        
        try {
          // Supabase Storage에서 대표 이미지 1-3장 다운로드
          const { data: imageList, error: listError } = await supabase.storage
            .from('lego_parts_images')
            .list(`${partId}`, { limit: maxImagesPerPart })
          
          if (listError) throw listError
          
          const images = []
          for (const file of imageList.slice(0, maxImagesPerPart)) {
            const { data: imageData, error: downloadError } = await supabase.storage
              .from('lego_parts_images')
              .download(`${partId}/${file.name}`)
            
            if (!downloadError && imageData) {
              const blob = new Blob([imageData], { type: 'image/jpeg' })
              const url = URL.createObjectURL(blob)
              images.push({
                filename: file.name,
                url: url,
                size: blob.size
              })
            }
          }
          
          const cacheEntry = {
            partId,
            images,
            cachedAt: new Date(),
            size: images.reduce((sum, img) => sum + img.size, 0)
          }
          
          cacheState.cachedParts.set(partId, cacheEntry)
          cacheState.cacheSize += cacheEntry.size
          
          console.log(`📦 캐시 완료: ${partId} (${images.length}장, ${Math.round(cacheEntry.size/1024)}KB)`)
          return cacheEntry
          
        } catch (err) {
          console.warn(`📦 캐시 실패: ${partId}`, err.message)
          return null
        }
      })
      
      const results = await Promise.all(cachePromises)
      const successCount = results.filter(r => r !== null).length
      
      console.log(`📦 온디맨드 캐싱 완료: ${successCount}/${partIds.length}개 성공`)
      console.log(`📦 총 캐시 크기: ${Math.round(cacheState.cacheSize/1024/1024)}MB`)
      
      return results.filter(r => r !== null)
      
    } catch (err) {
      console.error('📦 캐싱 실패:', err)
      throw err
    }
  }

  // 벡터 유사도 계산 (메타데이터 기반)
  const calculateVectorSimilarity = (detectedFeatures, partMetadata) => {
    if (!detectedFeatures || !partMetadata.shape_vector) {
      return 0.3 // 기본값
    }
    
    try {
      // 1. Shape 벡터 유사도 (cosine similarity)
      const shapeSim = calculateCosineSimilarity(
        detectedFeatures.shape_vector,
        partMetadata.shape_vector
      )
      
      // 2. 색상 유사도 (Lab ΔE)
      const colorSim = calculateColorSimilarity(
        detectedFeatures.color_lab,
        partMetadata.color_lab
      )
      
      // 3. 크기 유사도 (스터드 단위)
      const sizeSim = calculateSizeSimilarity(
        detectedFeatures.size_stud,
        partMetadata.size_stud
      )
      
      // 4. 가중 평균
      const weights = { shape: 0.5, color: 0.3, size: 0.2 }
      const similarity = (
        shapeSim * weights.shape +
        colorSim * weights.color +
        sizeSim * weights.size
      )
      
      return Math.max(0, Math.min(1, similarity))
      
    } catch (err) {
      console.warn('벡터 유사도 계산 실패:', err)
      return 0.3
    }
  }

  // 코사인 유사도 계산
  const calculateCosineSimilarity = (vec1, vec2) => {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0
    
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)
    return magnitude > 0 ? dotProduct / magnitude : 0
  }

  // 색상 유사도 계산 (Lab ΔE)
  const calculateColorSimilarity = (lab1, lab2) => {
    if (!lab1 || !lab2) return 0.5
    
    const deltaE = Math.sqrt(
      Math.pow(lab1.L - lab2.L, 2) +
      Math.pow(lab1.a - lab2.a, 2) +
      Math.pow(lab1.b - lab2.b, 2)
    )
    
    // ΔE < 5: 매우 유사, ΔE > 20: 매우 다름
    return Math.max(0, 1 - (deltaE / 20))
  }

  // 크기 유사도 계산
  const calculateSizeSimilarity = (size1, size2) => {
    if (!size1 || !size2) return 0.5
    
    const ratio = Math.min(size1, size2) / Math.max(size1, size2)
    return ratio > 0.8 ? 1 : ratio
  }

  // BOM 기반 매칭 (헝가리안 알고리즘)
  const performBOMMatching = (detections, partsMetadata) => {
    console.log(`🎯 BOM 매칭 시작: ${detections.length}개 검출, ${partsMetadata.length}개 부품`)
    
    const matches = []
    const unmatchedSlots = []
    
    // BOM 슬롯 생성
    const bomSlots = []
    partsMetadata.forEach(part => {
      for (let i = 0; i < part.quantity; i++) {
        bomSlots.push({
          part_id: part.part_id,
          color_id: part.color_id,
          slot_index: i,
          metadata: part,
          matched: false,
          match_score: 0,
          matched_detection: null
        })
      }
    })
    
    // 각 검출과 BOM 슬롯 간의 유사도 계산
    const scores = []
    detections.forEach((detection, detIdx) => {
      bomSlots.forEach((slot, slotIdx) => {
        if (slot.matched) return
        
        const similarity = calculateVectorSimilarity(detection.features, slot.metadata)
        scores.push({
          detection: detIdx,
          slot: slotIdx,
          similarity: similarity,
          detection_data: detection,
          slot_data: slot
        })
      })
    })
    
    // 유사도 순으로 정렬
    scores.sort((a, b) => b.similarity - a.similarity)
    
    const usedDetections = new Set()
    const usedSlots = new Set()
    
    // 최적 매칭 수행
    scores.forEach(({ detection, slot, similarity, detection_data, slot_data }) => {
      if (usedDetections.has(detection) || usedSlots.has(slot)) return
      if (similarity < 0.6) return // 임계값
      
      // 매칭 성공
      slot_data.matched = true
      slot_data.match_score = similarity
      slot_data.matched_detection = detection_data
      
      usedDetections.add(detection)
      usedSlots.add(slot)
      
      matches.push({
        detection: detection_data,
        slot: slot_data,
        similarity: similarity
      })
    })
    
    // 미매칭 슬롯 = 누락 후보
    const missingSlots = bomSlots.filter(slot => !slot.matched)
    
    console.log(`🎯 BOM 매칭 완료: ${matches.length}개 매칭, ${missingSlots.length}개 누락`)
    
    return { matches, missingSlots }
  }

  // 캐시 정리
  const clearCache = () => {
    // Object URL 정리
    cacheState.cachedParts.forEach(entry => {
      entry.images.forEach(img => {
        URL.revokeObjectURL(img.url)
      })
    })
    
    cacheState.cachedParts.clear()
    cacheState.cacheSize = 0
    cacheState.lastUpdated = null
    
    console.log('📦 캐시 정리 완료')
  }

  // 캐시 통계
  const getCacheStats = () => {
    return {
      cachedParts: cacheState.cachedParts.size,
      cacheSize: Math.round(cacheState.cacheSize / 1024 / 1024 * 100) / 100, // MB
      lastUpdated: cacheState.lastUpdated
    }
  }

  return {
    loading,
    error,
    cacheState,
    loadSetMetadata,
    cachePartImages,
    calculateVectorSimilarity,
    performBOMMatching,
    clearCache,
    getCacheStats
  }
}
