import { ref, reactive } from 'vue'
import { supabase } from './useSupabase'
import { useImageManager } from './useImageManager'

/**
 * 배치 처리 시스템
 * - 부품 데이터 배치 저장
 * - 이미지 다운로드 배치 처리
 * - WebP 변환 배치 처리
 * - 데이터베이스 트랜잭션 최적화
 */

export function useBatchProcessing() {
  const { processRebrickableImage, uploadImageFromUrl } = useImageManager()
  
  const processing = ref(false)
  const progress = ref(0)
  const currentStep = ref('')
  const errors = ref([])
  
  /**
   * 부품 데이터 배치 저장
   */
  const batchSaveParts = async (parts, setId) => {
    try {
      processing.value = true
      currentStep.value = '부품 데이터 저장 중...'
      progress.value = 0
      errors.value = []
      
      const batchSize = 10 // 한 번에 10개씩 처리
      const savedParts = []
      const failedParts = []
      
      // 1. 부품 정보 순차 저장 (외래 키 제약 조건 준수)
      for (let i = 0; i < parts.length; i++) {
        const partData = parts[i]
        currentStep.value = `부품 데이터 저장 중... (${i + 1}/${parts.length})`
        
        try {
          // 트랜잭션 방식으로 모든 작업을 한 번에 처리
          console.log(`🔄 Processing part ${partData.part.part_num} in transaction...`)
          
          // 1. 부품 정보 저장
          const { data: savedPart, error: partError } = await supabase
            .from('lego_parts')
            .upsert({
              part_num: partData.part.part_num,
              name: partData.part.name,
              part_cat_id: partData.part.part_cat_id,
              part_img_url: partData.part.part_img_url,
              external_ids: partData.part.external_ids
            }, { onConflict: 'part_num' })
            .select()
            .single()
          
          if (partError) {
            console.error(`❌ Failed to save part ${partData.part.part_num}:`, partError)
            throw partError
          }
          
          // 2. 색상 정보 저장
          const { data: savedColor, error: colorError } = await supabase
            .from('lego_colors')
            .upsert({
              color_id: partData.color.id,
              name: partData.color.name,
              rgb: partData.color.rgb,
              is_trans: partData.color.is_trans
            }, { onConflict: 'color_id' })
            .select()
            .single()
          
          if (colorError) {
            console.error(`❌ Failed to save color ${partData.color.id}:`, colorError)
            throw colorError
          }
          
          // 3. 세트-부품 관계 저장 (INSERT만 사용, upsert 대신)
          // 주의: set_parts.part_id는 UUID가 아니라 lego_parts.part_num(varchar) 을 참조합니다
          console.log(`🔗 Inserting set-part relationship: set_id=${setId}, part_id=${partData.part.part_num}, color_id=${savedColor.color_id}`)
          const { data: savedSetPart, error: setPartError } = await supabase
            .from('set_parts')
            .insert({
              set_id: setId,
              part_id: partData.part.part_num,
              color_id: savedColor.color_id,
              quantity: partData.quantity,
              is_spare: partData.is_spare,
              element_id: partData.element_id,
              inv_part_id: partData.inv_part_id
            })
            .select()
            .single()
          
          if (setPartError) {
            // 중복 키 오류인 경우 무시 (이미 존재하는 관계)
            if (setPartError.code === '23505') {
              console.log(`⚠️ Set-part relationship already exists for ${partData.part.part_num}, skipping...`)
            } else {
              console.error(`❌ Failed to save set-part relationship for ${partData.part.part_num}:`, setPartError)
              throw setPartError
            }
          } else {
            console.log(`✅ Set-part relationship saved successfully for ${partData.part.part_num}`)
          }
            
          savedParts.push({
            part_num: partData.part.part_num,
            color: partData.color.name,
            quantity: partData.quantity
          })
          
        } catch (error) {
          console.error(`Failed to save part ${partData.part.part_num}:`, error)
          failedParts.push({
            part_num: partData.part.part_num,
            color: partData.color.name,
            error: error.message
          })
        }
        
        // 진행률 업데이트
        progress.value = Math.round(((i + 1) / parts.length) * 50)
        
        // API 부하 방지를 위한 짧은 대기
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      return { 
        savedParts: savedParts.map(p => p.part_num), 
        failedParts: failedParts.map(p => p.part_num) 
      }
      
    } catch (error) {
      console.error('Batch save parts failed:', error)
      errors.value.push(error.message)
      throw error
    } finally {
      processing.value = false
    }
  }
  
  /**
   * 이미지 배치 다운로드 및 WebP 변환
   */
  const batchProcessImages = async (parts, options = {}) => {
    try {
      processing.value = true
      currentStep.value = '이미지 처리 중...'
      progress.value = 50
      errors.value = []
      
      const batchSize = 5 // 이미지는 5개씩 처리
      const processedImages = []
      const failedImages = []
      
      for (let i = 0; i < parts.length; i += batchSize) {
        const batch = parts.slice(i, i + batchSize)
        currentStep.value = `이미지 처리 중... (${i + 1}/${parts.length})`
        
        const batchPromises = batch.map(async (partData) => {
          try {
            if (!partData.part.part_img_url) {
              return { part_num: partData.part.part_num, skipped: true }
            }
            
            // 이미지 다운로드 및 WebP 변환
            const result = await processRebrickableImage(
              partData.part.part_img_url,
              partData.part.part_num,
              partData.color.id,
              { forceUpload: options.forceUpload || false }
            )
            
            return {
              part_num: partData.part.part_num,
              color_id: partData.color.id,
              result: result,
              success: true
            }
            
          } catch (error) {
            console.error(`Failed to process image for ${partData.part.part_num}:`, error)
            return {
              part_num: partData.part.part_num,
              color_id: partData.color.id,
              error: error.message,
              success: false
            }
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        processedImages.push(...batchResults.filter(r => r.success))
        failedImages.push(...batchResults.filter(r => !r.success))
        
        // 진행률 업데이트
        progress.value = 50 + Math.round(((i + batchSize) / parts.length) * 40)
        
        // 이미지 처리 부하 방지
        if (i + batchSize < parts.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      
      return { processedImages, failedImages }
      
    } catch (error) {
      console.error('Batch process images failed:', error)
      errors.value.push(error.message)
      throw error
    } finally {
      processing.value = false
    }
  }
  
  /**
   * 세트 이미지 WebP 변환
   */
  const processSetImage = async (setData, options = {}) => {
    try {
      if (!setData.set_img_url) return null
      
      currentStep.value = '세트 이미지 처리 중...'
      
      const result = await uploadImageFromUrl(
        setData.set_img_url,
        `${setData.set_num}_set`,
        'lego_sets_images',
        { forceUpload: options.forceUpload || false }
      )
      
      return result
      
    } catch (error) {
      console.error('Set image processing failed:', error)
      errors.value.push(`세트 이미지 처리 실패: ${error.message}`)
      return null
    }
  }
  
  /**
   * 통합 배치 처리 (세트 + 부품 + 이미지)
   */
  const batchProcessSet = async (setData, parts, options = {}) => {
    try {
      processing.value = true
      progress.value = 0
      currentStep.value = '세트 데이터 저장 중...'
      errors.value = []
      
      // 1. 세트 정보 저장
      const { data: savedSet, error: setError } = await supabase
        .from('lego_sets')
        .upsert({
          set_num: setData.set_num,
          name: setData.name,
          year: setData.year,
          theme_id: setData.theme_id,
          num_parts: setData.num_parts,
          set_img_url: setData.set_img_url,
          set_url: setData.set_url,
          last_modified_dt: setData.last_modified_dt
        }, { onConflict: 'set_num' })
        .select()
        .single()
      
      if (setError) throw setError
      
      progress.value = 10
      currentStep.value = '부품 데이터 저장 중...'
      
      // 2. 부품 데이터 배치 저장
      const batchResult = await batchSaveParts(parts, savedSet.id)
      const savedParts = batchResult.savedParts || []
      const failedParts = batchResult.failedParts || []
      
      progress.value = 60
      currentStep.value = '이미지 처리 중...'
      
      // 3. 이미지 배치 처리 (병렬)
      const [imageResults, setImageResult] = await Promise.all([
        batchProcessImages(parts, options),
        processSetImage(setData, options)
      ])
      
      progress.value = 90
      currentStep.value = '완료 중...'
      
      // 4. WebP URL 업데이트
      if (setImageResult?.uploadedUrl) {
        await supabase
          .from('lego_sets')
          .update({ webp_image_url: setImageResult.uploadedUrl })
          .eq('id', savedSet.id)
      }
      
      progress.value = 100
      currentStep.value = '완료!'
      
      return {
        set: savedSet,
        savedParts: savedParts.length,
        failedParts: failedParts.length,
        processedImages: imageResults.processedImages.length,
        failedImages: imageResults.failedImages.length,
        setImage: setImageResult,
        errors: errors.value
      }
      
    } catch (error) {
      console.error('Batch process set failed:', error)
      errors.value.push(error.message)
      throw error
    } finally {
      processing.value = false
    }
  }
  
  /**
   * 진행률 및 상태 조회
   */
  const getProcessingStatus = () => {
    return {
      processing: processing.value,
      progress: progress.value,
      currentStep: currentStep.value,
      errors: errors.value
    }
  }
  
  /**
   * 처리 상태 초기화
   */
  const resetProcessing = () => {
    processing.value = false
    progress.value = 0
    currentStep.value = ''
    errors.value = []
  }
  
  return {
    batchProcessSet,
    batchSaveParts,
    batchProcessImages,
    processSetImage,
    getProcessingStatus,
    resetProcessing
  }
}
