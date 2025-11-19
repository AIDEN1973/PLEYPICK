import { ref, reactive } from 'vue'
import { supabase } from './useSupabase'

/**
 * 부품 리스트 배치 로딩 시스템
 * - 부품 데이터 배치 조회
 * - 이미지 URL 배치 조회
 * - 메타데이터 배치 조회
 * - 가상 스크롤링 지원
 */

export function useBatchPartLoading() {
  const loading = ref(false)
  const progress = ref(0)
  const currentStep = ref('')
  const errors = ref([])
  
  // 로딩 상태
  const loadingState = reactive({
    total: 0,
    loaded: 0,
    currentBatch: 0,
    totalBatches: 0
  })
  
  /**
   * 부품 데이터 배치 로딩 (초고속 최적화)
   */
  const batchLoadParts = async (setId, options = {}) => {
    try {
      loading.value = true
      progress.value = 0
      currentStep.value = '부품 데이터 로딩 중...'
      errors.value = []
      
      // ✅ 외래 키 제약 조건 제거로 인한 JOIN 문제 해결: 단계별 조회
      currentStep.value = '부품 데이터 로딩 중...'
      
      // 1단계: set_parts 조회
      const { data: setParts, error: setPartsError } = await supabase
        .from('set_parts')
        .select('*')
        .eq('set_id', setId)
      
      if (setPartsError) {
        throw new Error(`Failed to load set_parts: ${setPartsError.message}`)
      }
      
      if (!setParts || setParts.length === 0) {
        return { parts: [], metadata: [] }
      }
      
      // 2단계: part_id 목록 추출
      const partIds = [...new Set(setParts.map(sp => sp.part_id))]
      const colorIds = [...new Set(setParts.map(sp => sp.color_id))]
      
      // 3단계: lego_parts 조회 (스키마에 맞는 컬럼만 선택)
      const { data: legoParts, error: legoPartsError } = await supabase
        .from('lego_parts')
        .select('part_num, name, part_cat_id, part_img_url')
        .in('part_num', partIds)
      
      if (legoPartsError) {
        throw new Error(`Failed to load lego_parts: ${legoPartsError.message}`)
      }
      
      // 4단계: lego_colors 조회
      const { data: legoColors, error: legoColorsError } = await supabase
        .from('lego_colors')
        .select('color_id, name, rgb, is_trans')
        .in('color_id', colorIds)
      
      if (legoColorsError) {
        throw new Error(`Failed to load lego_colors: ${legoColorsError.message}`)
      }
      
      // 5단계: 수동 데이터 조합
      const allParts = setParts.map(setPart => {
        const legoPart = legoParts.find(lp => lp.part_num === setPart.part_id)
        const legoColor = legoColors.find(lc => lc.color_id === setPart.color_id)
        
        return {
          ...setPart,
          lego_parts: legoPart || null,
          lego_colors: legoColor || null
        }
      })
      
      loadingState.total = allParts.length
      loadingState.loaded = allParts.length
      progress.value = 30
      
      console.log(`✅ Loaded ${allParts.length} parts with manual JOIN`)
      
      // 2. 모든 이미지 URL과 메타데이터를 한 번에 조회 (초고속)
      currentStep.value = '이미지 및 메타데이터 조회 중...'
      
      // 모든 부품의 part_num, color_id, element_id 추출
      const partKeys = allParts.map(part => ({
        part_num: part.lego_parts.part_num,
        color_id: part.lego_colors.color_id,
        element_id: part.element_id || null
      }))
      
      // 한 번에 모든 이미지 URL 조회
      const [imageUrls, metadataList] = await Promise.all([
        batchGetImageUrls(partKeys),
        batchGetMetadata(partKeys)
      ])
      
      // 결과를 부품에 매핑
      const partsWithData = allParts.map((part, index) => ({
        ...part,
        supabase_image_url: imageUrls[index] || null,
        metadata: metadataList[index] || null
      }))
      
      progress.value = 100
      currentStep.value = '완료!'
      
      return {
        parts: partsWithData,
        loadingState: { ...loadingState },
        errors: errors.value
      }
      
    } catch (error) {
      console.error('Batch load parts failed:', error)
      errors.value.push(error.message)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 이미지 URL 배치 조회
   */
  const batchLoadImages = async (parts) => {
    const batchSize = 10 // 이미지 조회는 10개씩
    const partsWithImages = []
    
    for (let i = 0; i < parts.length; i += batchSize) {
      const batch = parts.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (part) => {
        try {
          // Supabase Storage 이미지 URL 조회 (element_id 우선)
          const imageUrl = await getSupabaseImageUrl(
            part.lego_parts.part_num, 
            part.lego_colors.color_id,
            part.element_id || null
          )
          
          return {
            ...part,
            supabase_image_url: imageUrl
          }
        } catch (error) {
          console.warn(`Failed to get image for ${part.lego_parts.part_num}:`, error)
          return {
            ...part,
            supabase_image_url: null
          }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      partsWithImages.push(...batchResults)
      
      // 진행률 업데이트
      progress.value = 50 + Math.round((i + batchSize) / parts.length * 30)
      
      // 이미지 조회 부하 방지
      if (i + batchSize < parts.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    return partsWithImages
  }
  
  /**
   * 메타데이터 배치 조회
   */
  const batchLoadMetadata = async (parts) => {
    const batchSize = 15 // 메타데이터 조회는 15개씩
    const partsWithMetadata = []
    
    for (let i = 0; i < parts.length; i += batchSize) {
      const batch = parts.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (part) => {
        try {
          // LLM 분석 메타데이터 조회
          const metadata = await getPartMetadata(
            part.lego_parts.part_num, 
            part.lego_colors.color_id
          )
          
          return {
            ...part,
            metadata: metadata
          }
        } catch (error) {
          console.warn(`Failed to get metadata for ${part.lego_parts.part_num}:`, error)
          return {
            ...part,
            metadata: null
          }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      partsWithMetadata.push(...batchResults)
      
      // 진행률 업데이트
      progress.value = 80 + Math.round((i + batchSize) / parts.length * 20)
      
      // 메타데이터 조회 부하 방지
      if (i + batchSize < parts.length) {
        await new Promise(resolve => setTimeout(resolve, 30))
      }
    }
    
    return partsWithMetadata
  }
  
  /**
   * Supabase Storage에서 이미지 URL 조회 (element_id 우선, 초고속 최적화)
   */
  const getSupabaseImageUrl = async (partNum, colorId, elementId = null) => {
    try {
      // 1. element_id가 있으면 element_id로 먼저 조회
      if (elementId) {
        const { data: partImageByElement, error: elementError } = await supabase
          .from('part_images')
          .select('uploaded_url')
          .eq('element_id', String(elementId))
          .not('uploaded_url', 'is', null)
          .maybeSingle()
        
        if (!elementError && partImageByElement?.uploaded_url) {
          return partImageByElement.uploaded_url
        }
      }

      // 2. part_images 테이블에서 part_id + color_id로 조회
      const { data: partImage, error: partImageError } = await supabase
        .from('part_images')
        .select('uploaded_url')
        .eq('part_id', partNum)
        .eq('color_id', colorId)
        .not('uploaded_url', 'is', null)
        .maybeSingle()
      
      if (!partImageError && partImage?.uploaded_url) {
        return partImage.uploaded_url
      }

      // 3. image_metadata 테이블에서 fallback 조회 (element_id 우선)
      if (elementId) {
        const { data: imageMetadataByElement, error: metadataElementError } = await supabase
          .from('image_metadata')
          .select('supabase_url')
          .eq('element_id', String(elementId))
          .not('supabase_url', 'is', null)
          .maybeSingle()

        if (!metadataElementError && imageMetadataByElement?.supabase_url) {
          return imageMetadataByElement.supabase_url
        }
      }

      // element_id로 찾지 못했거나 element_id가 없으면 part_num + color_id로 조회
      const { data: imageMetadata, error: metadataError } = await supabase
        .from('image_metadata')
        .select('supabase_url')
        .eq('part_num', partNum)
        .eq('color_id', colorId)
        .not('supabase_url', 'is', null)
        .maybeSingle()

      if (!metadataError && imageMetadata?.supabase_url) {
        return imageMetadata.supabase_url
      }

      // 4. Storage에서 직접 확인 (element_id 우선, 파일명 기반)
      // 주의: HEAD 요청은 최소화하여 무한 반복 방지
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
      if (supabaseUrl) {
        const bucketName = 'lego_parts_images'
        const fileName = elementId ? `${String(elementId)}.webp` : `${partNum}_${colorId}.webp`
        const directUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
        
        // 이미지 존재 여부 확인 (타임아웃 설정으로 무한 대기 방지)
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 2000) // 2초 타임아웃
          
          const response = await fetch(directUrl, { 
            method: 'HEAD',
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (response.ok) {
            return directUrl
          }
        } catch (fetchError) {
          // 파일이 없거나 타임아웃이면 무시 (정상적인 경우)
          // 무한 반복 방지를 위해 로그 출력하지 않음
        }
      }
      
      return null
    } catch (error) {
      // 오류 발생 시 조용히 null 반환 (로그 없음)
      return null
    }
  }
  
  /**
   * 부품 메타데이터 조회 (초고속 최적화)
   */
  const getPartMetadata = async (partNum, colorId) => {
    try {
      const { data: metadata, error } = await supabase
        .from('parts_master_features')
        .select('*')
        .eq('part_id', partNum)
        .eq('color_id', colorId)
        .maybeSingle()
      
      if (error) {
        return null
      }
      
      return metadata
    } catch (error) {
      return null
    }
  }
  
  /**
   * 모든 이미지 URL을 한 번에 조회 (element_id 우선, 초고속)
   */
  const batchGetImageUrls = async (partKeys) => {
    try {
      const partIds = partKeys.map(key => key.part_num).filter(Boolean)
      const colorIds = partKeys.map(key => key.color_id).filter(Boolean)
      const elementIds = partKeys.map(key => key.element_id).filter(Boolean).map(id => String(id))
      
      // 1. element_id가 있는 경우: element_id로 먼저 조회
      const elementImageMap = new Map()
      if (elementIds.length > 0) {
        const { data: elementImages, error: elementImagesError } = await supabase
          .from('part_images')
          .select('element_id, uploaded_url')
          .in('element_id', elementIds)
          .not('uploaded_url', 'is', null)
        
        if (!elementImagesError && elementImages) {
          elementImages.forEach(img => {
            if (img.element_id && img.uploaded_url) {
              elementImageMap.set(String(img.element_id), img.uploaded_url)
            }
          })
        }
      }
      
      // 2. part_images 테이블에서 part_id + color_id로 조회
      const { data: partImages, error: partImagesError } = await supabase
        .from('part_images')
        .select('part_id, color_id, uploaded_url')
        .in('part_id', partIds)
        .in('color_id', colorIds)
        .not('uploaded_url', 'is', null)
      
      // 3. image_metadata 테이블에서 fallback 조회 (element_id 우선)
      const elementMetadataMap = new Map()
      if (elementIds.length > 0) {
        const { data: elementMetadataImages, error: elementMetadataError } = await supabase
          .from('image_metadata')
          .select('element_id, supabase_url')
          .in('element_id', elementIds)
          .not('supabase_url', 'is', null)
        
        if (!elementMetadataError && elementMetadataImages) {
          elementMetadataImages.forEach(img => {
            if (img.element_id && img.supabase_url) {
              elementMetadataMap.set(String(img.element_id), img.supabase_url)
            }
          })
        }
      }

      // element_id로 찾지 못한 경우 part_num + color_id로 조회
      const { data: metadataImages, error: metadataError } = await supabase
        .from('image_metadata')
        .select('part_num, color_id, supabase_url')
        .in('part_num', partIds)
        .in('color_id', colorIds)
        .not('supabase_url', 'is', null)
      
      if (partImagesError && metadataError && elementIds.length === 0) {
        return new Array(partKeys.length).fill(null)
      }
      
      // part_id와 color_id로 매핑
      const partColorImageMap = new Map()
      
      // part_images 결과 추가
      partImages?.forEach(img => {
        const key = `${img.part_id}_${img.color_id}`
        partColorImageMap.set(key, img.uploaded_url)
      })
      
      // image_metadata 결과 추가 (part_images에 없는 경우만)
      metadataImages?.forEach(img => {
        const key = `${img.part_num}_${img.color_id}`
        if (!partColorImageMap.has(key)) {
          partColorImageMap.set(key, img.supabase_url)
        }
      })
      
      return partKeys.map(key => {
        // element_id 우선 사용 (part_images 먼저, 없으면 image_metadata)
        if (key.element_id) {
          const elementIdStr = String(key.element_id)
          if (elementImageMap.has(elementIdStr)) {
            return elementImageMap.get(elementIdStr)
          }
          if (elementMetadataMap.has(elementIdStr)) {
            return elementMetadataMap.get(elementIdStr)
          }
        }
        // element_id가 없거나 찾지 못한 경우 part_id + color_id 사용
        const mapKey = `${key.part_num}_${key.color_id}`
        return partColorImageMap.get(mapKey) || null
      })
    } catch (error) {
      return new Array(partKeys.length).fill(null)
    }
  }
  
  /**
   * 모든 메타데이터를 한 번에 조회 (초고속)
   */
  const batchGetMetadata = async (partKeys) => {
    try {
      const partIds = partKeys.map(key => key.part_num)
      const colorIds = partKeys.map(key => key.color_id)
      
      const { data: metadata, error } = await supabase
        .from('parts_master_features')
        .select('*')
        .in('part_id', partIds)
        .in('color_id', colorIds)
      
      if (error) {
        return new Array(partKeys.length).fill(null)
      }
      
      // part_id와 color_id로 매핑하고 feature_json 파싱
      const metadataMap = new Map()
      metadata?.forEach(meta => {
        const key = `${meta.part_id}_${meta.color_id}`
        
        // feature_json이 있으면 파싱하여 메타데이터 구성
        let processedMeta = null
        if (meta.feature_json) {
          try {
            const featureData = typeof meta.feature_json === 'string' 
              ? JSON.parse(meta.feature_json) 
              : meta.feature_json
            
            processedMeta = {
              ...featureData,
              feature_text: meta.feature_text,
              confidence: meta.confidence,
              recognition_hints: meta.recognition_hints,
              similar_parts: meta.similar_parts,
              distinguishing_features: meta.distinguishing_features,
              has_stud: meta.has_stud,
              groove: meta.groove,
              center_stud: meta.center_stud
            }
          } catch (parseError) {
            console.warn(`Failed to parse feature_json for ${meta.part_id}:`, parseError)
            processedMeta = {
              feature_text: meta.feature_text,
              confidence: meta.confidence,
              recognition_hints: meta.recognition_hints,
              similar_parts: meta.similar_parts,
              distinguishing_features: meta.distinguishing_features,
              has_stud: meta.has_stud,
              groove: meta.groove,
              center_stud: meta.center_stud
            }
          }
        } else {
          // feature_json이 없으면 기본 메타데이터만 사용
          processedMeta = {
            feature_text: meta.feature_text,
            confidence: meta.confidence,
            recognition_hints: meta.recognition_hints,
            similar_parts: meta.similar_parts,
            distinguishing_features: meta.distinguishing_features,
            has_stud: meta.has_stud,
            groove: meta.groove,
            center_stud: meta.center_stud
          }
        }
        
        metadataMap.set(key, processedMeta)
      })
      
      return partKeys.map(key => {
        const mapKey = `${key.part_num}_${key.color_id}`
        return metadataMap.get(mapKey) || null
      })
    } catch (error) {
      return new Array(partKeys.length).fill(null)
    }
  }
  
  /**
   * 가상 스크롤링을 위한 부품 데이터 청크 로딩
   */
  const loadPartsChunk = async (setId, offset, limit) => {
    try {
      const { data: parts, error } = await supabase
        .from('set_parts')
        .select(`
          *,
          lego_parts!inner(*),
          lego_colors!inner(*)
        `)
        .eq('set_id', setId)
        .range(offset, offset + limit - 1)
        .order('id')
      
      if (error) throw error
      
      // 이미지 URL과 메타데이터 조회
      const partsWithData = await Promise.all(parts.map(async (part) => {
        const [imageUrl, metadata] = await Promise.all([
          getSupabaseImageUrl(part.lego_parts.part_num, part.lego_colors.color_id, part.element_id || null),
          getPartMetadata(part.lego_parts.part_num, part.lego_colors.color_id)
        ])
        
        return {
          ...part,
          supabase_image_url: imageUrl,
          metadata: metadata
        }
      }))
      
      return partsWithData
    } catch (error) {
      console.error('Load parts chunk failed:', error)
      throw error
    }
  }
  
  /**
   * 로딩 상태 조회
   */
  const getLoadingStatus = () => {
    return {
      loading: loading.value,
      progress: progress.value,
      currentStep: currentStep.value,
      loadingState: { ...loadingState },
      errors: errors.value
    }
  }
  
  /**
   * 로딩 상태 초기화
   */
  const resetLoading = () => {
    loading.value = false
    progress.value = 0
    currentStep.value = ''
    errors.value = []
    loadingState.total = 0
    loadingState.loaded = 0
    loadingState.currentBatch = 0
    loadingState.totalBatches = 0
  }
  
  return {
    batchLoadParts,
    loadPartsChunk,
    getLoadingStatus,
    resetLoading
  }
}
