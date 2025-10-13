import { ref } from 'vue'
import { supabase } from './useSupabase'

export function useBatchProcessing() {
  const loading = ref(false)
  const progress = ref(0)
  const currentStep = ref('')
  const error = ref(null)

  // 진짜 배치 처리 함수
  const batchProcessSet = async (setData, parts) => {
    loading.value = true
      progress.value = 0
    currentStep.value = '세트 정보 저장 중...'
    error.value = null

    try {
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
          set_url: setData.set_url
        }, { onConflict: 'set_num' })
        .select()
        .single()
      
      if (setError) {
        console.error('❌ Failed to save set:', setError)
        throw setError
      }
      
      console.log('✅ Set saved:', savedSet)
      progress.value = 10

      // 2. 배치 처리: 모든 부품과 색상을 한 번에 저장
      console.log(`🚀 Starting batch processing for ${parts.length} parts...`)
      
      // 중복 체크를 위한 캐시
      const existingSetParts = new Set()
      
      // 2-1. 중복 제거 후 모든 부품 정보를 한 번에 upsert
      const uniqueParts = new Map()
      parts.forEach(partData => {
        const partNum = partData.part.part_num
        if (!uniqueParts.has(partNum)) {
          uniqueParts.set(partNum, {
            part_num: partData.part.part_num,
            name: partData.part.name,
            part_cat_id: partData.part.part_cat_id,
            part_img_url: partData.part.part_img_url,
            external_ids: partData.part.external_ids
          })
        }
      })
      
      const partsToUpsert = Array.from(uniqueParts.values())
      console.log(`📦 Deduplicated: ${parts.length} → ${partsToUpsert.length} unique parts`)
      
      console.log(`📦 Batch upserting ${partsToUpsert.length} parts...`)
      const { data: savedParts, error: partsError } = await supabase
        .from('lego_parts')
        .upsert(partsToUpsert, { onConflict: 'part_num' })
        .select()
      
      if (partsError) {
        console.error('❌ Batch parts upsert failed:', partsError)
        throw partsError
      }
      console.log(`✅ Batch upserted ${savedParts.length} parts`)
      progress.value = 30
      
      // 2-2. 중복 제거 후 모든 색상 정보를 한 번에 upsert
      const uniqueColors = new Map()
      parts.forEach(partData => {
        const colorId = partData.color.id
        if (!uniqueColors.has(colorId)) {
          uniqueColors.set(colorId, {
            color_id: partData.color.id,
            name: partData.color.name,
            rgb: partData.color.rgb,
            is_trans: partData.color.is_trans
          })
        }
      })
      
      const colorsToUpsert = Array.from(uniqueColors.values())
      console.log(`🎨 Deduplicated: ${parts.length} → ${colorsToUpsert.length} unique colors`)
      
      console.log(`🎨 Batch upserting ${colorsToUpsert.length} colors...`)
      const { data: savedColors, error: colorsError } = await supabase
        .from('lego_colors')
        .upsert(colorsToUpsert, { onConflict: 'color_id' })
        .select()
      
      if (colorsError) {
        console.error('❌ Batch colors upsert failed:', colorsError)
        throw colorsError
      }
      console.log(`✅ Batch upserted ${savedColors.length} colors`)
      progress.value = 50
      
      // ✅ 중복 제거: 같은 (set_id, part_id, color_id) 조합을 병합하고 수량 합산
      const setPartsMap = new Map()
      
      parts.forEach(partData => {
        const key = `${savedSet.id}_${partData.part.part_num}_${partData.color.id}`
        
        if (setPartsMap.has(key)) {
          // 중복된 경우: 수량 합산
          const existing = setPartsMap.get(key)
          existing.quantity += partData.quantity
          // is_spare: 하나라도 spare가 아니면 false
          if (!partData.is_spare) {
            existing.is_spare = false
          }
          // element_id, inv_part_id: 우선순위 (null이 아닌 값 선택)
          if (!existing.element_id && partData.element_id) {
            existing.element_id = partData.element_id
          }
          if (!existing.inv_part_id && partData.inv_part_id) {
            existing.inv_part_id = partData.inv_part_id
          }
        } else {
          // 새로운 조합
          setPartsMap.set(key, {
            set_id: savedSet.id,
            part_id: partData.part.part_num,
            color_id: partData.color.id,
            quantity: partData.quantity,
            is_spare: partData.is_spare || false,
            element_id: partData.element_id,
            inv_part_id: partData.inv_part_id
          })
        }
      })
      
      const setPartsToUpsert = Array.from(setPartsMap.values())
      console.log(`🔗 Deduplicated: ${parts.length} → ${setPartsToUpsert.length} unique relationships`)
      
      console.log(`🔗 Batch upserting ${setPartsToUpsert.length} set-part relationships...`)
      const { data: savedSetParts, error: setPartsError } = await supabase
        .from('set_parts')
        .upsert(setPartsToUpsert, { 
          onConflict: 'set_id,part_id,color_id',
          ignoreDuplicates: false // 업데이트 허용
        })
        .select()
      
      if (setPartsError) {
        console.error('❌ Batch set-parts upsert failed:', setPartsError)
        throw setPartsError
      }
      console.log(`✅ Batch upserted ${savedSetParts.length} set-part relationships`)
      
      progress.value = 100
      currentStep.value = '완료!'
      
      return {
        set: savedSet,
        parts: parts.map(partData => ({
          part_num: partData.part.part_num,
          color: partData.color.name,
          quantity: partData.quantity
        })),
        totalParts: parts.length,
        insertedRelationships: savedSetParts.length // ✅ upsert 결과로 변경
      }

    } catch (err) {
      console.error('Batch processing failed:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }
  
  return {
    loading,
    progress,
    currentStep,
    error,
    batchProcessSet
  }
}