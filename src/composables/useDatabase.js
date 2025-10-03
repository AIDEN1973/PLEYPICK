import { ref } from 'vue'
import { supabase } from './useSupabase'

export function useDatabase() {
  const loading = ref(false)
  const error = ref(null)

  // 레고 세트 저장
  const saveLegoSet = async (setData) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('lego_sets')
        .upsert({
          set_num: setData.set_num,
          name: setData.name,
          year: setData.year,
          theme_id: setData.theme_id,
          num_parts: setData.num_parts,
          set_img_url: setData.set_img_url,
          set_url: setData.set_url,
          last_modified_date: setData.last_modified_date
        }, {
          onConflict: 'set_num'
        })
        .select()

      if (dbError) throw dbError
      return data[0]
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 레고 부품 저장
  const saveLegoPart = async (partData) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('lego_parts')
        .upsert({
          part_num: partData.part_num,
          name: partData.name,
          part_cat_id: partData.part_cat_id,
          part_url: partData.part_url,
          part_img_url: partData.part_img_url,
          external_ids: partData.external_ids,
          print_of: partData.print_of
        }, {
          onConflict: 'part_num'
        })
        .select()

      if (dbError) throw dbError
      return data[0]
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 색상 저장
  const saveLegoColor = async (colorData) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('lego_colors')
        .upsert({
          color_id: colorData.id,
          name: colorData.name,
          rgb: colorData.rgb,
          is_trans: colorData.is_trans,
          external_ids: colorData.external_ids
        }, {
          onConflict: 'color_id'
        })
        .select()

      if (dbError) throw dbError
      return data[0]
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 세트-부품 관계 저장
  const saveSetPart = async (setId, partId, colorId, quantity, isSpare = false, elementId = null, numSets = 1) => {
    loading.value = true
    error.value = null

    try {
      console.log(`Checking existing set-part relationship: set_id=${setId}, part_id=${partId}, color_id=${colorId}, element_id=${elementId}`)
      
      // 먼저 기존 데이터 확인
      const { data: existingData, error: checkError } = await supabase
        .from('set_parts')
        .select('id')
        .eq('set_id', setId)
        .eq('part_id', partId)
        .eq('color_id', colorId)
        .eq('element_id', elementId)

      if (checkError) {
        console.error('Error checking existing data:', checkError)
        throw checkError
      }

      if (existingData && existingData.length > 0) {
        // 기존 데이터가 있으면 업데이트
        console.log(`Updating existing set-part relationship: ${existingData[0].id}`)
        const { data, error: updateError } = await supabase
          .from('set_parts')
          .update({
            quantity: quantity,
            is_spare: isSpare,
            num_sets: numSets
          })
          .eq('id', existingData[0].id)
          .select()

        if (updateError) {
          console.error('Error updating set-part relationship:', updateError)
          throw updateError
        }
        console.log('Set-part relationship updated successfully')
        return data[0]
      } else {
        // 기존 데이터가 없으면 새로 삽입
        console.log('Inserting new set-part relationship')
        const { data, error: insertError } = await supabase
          .from('set_parts')
          .insert({
            set_id: setId,
            part_id: partId,
            color_id: colorId,
            quantity: quantity,
            is_spare: isSpare,
            element_id: elementId,
            num_sets: numSets
          })
          .select()

        if (insertError) {
          console.error('Error inserting set-part relationship:', insertError)
          throw insertError
        }
        console.log('Set-part relationship inserted successfully')
        return data[0]
      }
    } catch (err) {
      console.error('saveSetPart error:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 부품 이미지 정보 저장
  const savePartImage = async (imageData) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('part_images')
        .insert({
          part_id: imageData.part_id,
          color_id: imageData.color_id,
          original_url: imageData.original_url,
          uploaded_url: imageData.uploaded_url,
          local_path: imageData.local_path,
          filename: imageData.filename,
          file_size: imageData.file_size,
          image_width: imageData.image_width,
          image_height: imageData.image_height,
          download_status: imageData.download_status || 'pending',
          upload_status: imageData.upload_status || 'pending',
          error_message: imageData.error_message
        })
        .select()

      if (dbError) throw dbError
      return data[0]
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 작업 로그 저장
  const saveOperationLog = async (operationData) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('operation_logs')
        .insert({
          admin_user_id: operationData.admin_user_id,
          operation_type: operationData.operation_type,
          target_type: operationData.target_type,
          target_id: operationData.target_id,
          status: operationData.status,
          message: operationData.message,
          metadata: operationData.metadata
        })
        .select()

      if (dbError) throw dbError
      return data[0]
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 세트 목록 조회
  const getLegoSets = async (page = 1, pageSize = 50) => {
    loading.value = true
    error.value = null

    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error: dbError } = await supabase
        .from('lego_sets')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (dbError) throw dbError
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 특정 세트의 부품 목록 조회
  const getSetParts = async (setId) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('set_parts')
        .select(`
          *,
          lego_parts(*),
          lego_colors(*)
        `)
        .eq('set_id', setId)

      if (dbError) throw dbError
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 부품 이미지 목록 조회
  const getPartImages = async (partId, colorId = null) => {
    loading.value = true
    error.value = null

    try {
      let query = supabase
        .from('part_images')
        .select(`
          *,
          lego_parts(*),
          lego_colors(*)
        `)
        .eq('part_id', partId)

      if (colorId) {
        query = query.eq('color_id', colorId)
      }

      const { data, error: dbError } = await query

      if (dbError) throw dbError
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 작업 로그 조회
  const getOperationLogs = async (page = 1, pageSize = 50) => {
    loading.value = true
    error.value = null

    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error: dbError } = await supabase
        .from('operation_logs')
        .select(`
          *,
          admin_users(*)
        `)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (dbError) throw dbError
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    saveLegoSet,
    saveLegoPart,
    saveLegoColor,
    saveSetPart,
    savePartImage,
    saveOperationLog,
    getLegoSets,
    getSetParts,
    getPartImages,
    getOperationLogs
  }
}
