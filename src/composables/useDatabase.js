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

  // 세트-부품 관계 저장 (중복 방지)
  const saveSetPart = async (setId, partId, colorId, quantity, isSpare = false, elementId = null, numSets = 1) => {
    loading.value = true
    error.value = null

    try {
      console.log(`Inserting set-part relationship: set_id=${setId}, part_id=${partId}, color_id=${colorId}, element_id=${elementId}`)

      // 1) 기존 존재 여부 확인 (set_id + part_id + color_id 기준)
      const { data: existing, error: existError } = await supabase
        .from('set_parts')
        .select('id, quantity')
        .eq('set_id', setId)
        .eq('part_id', partId)
        .eq('color_id', colorId)
        .maybeSingle()

      if (existError) {
        console.warn('Warning checking existing set-part:', existError)
        // PGRST116: multiple or no rows when requesting object → 중복이 이미 존재하는 케이스로 간주하고 스킵
        if (existError.code === 'PGRST116') {
          console.log('Duplicate set-part detected by PGRST116, skipping insert')
          return { id: 'duplicate', set_id: setId, part_id: partId, color_id: colorId }
        }
      }

      if (existing) {
        console.log('Duplicate set-part detected, skipping insert')
        return { id: existing.id, set_id: setId, part_id: partId, color_id: colorId, quantity: existing.quantity }
      }

      // 2) 신규 삽입
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
        // 중복 오류는 무시하고 계속 진행
        if (insertError.code === '23505') {
          console.log('Duplicate entry ignored, continuing...')
          return { id: 'duplicate', set_id: setId, part_id: partId, color_id: colorId }
        }
        throw insertError
      }
      console.log('Set-part relationship inserted successfully')
      return data[0]
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

  // 특정 세트의 부품 목록 조회 (모든 부품 가져오기)
  const getSetParts = async (setId) => {
    loading.value = true
    error.value = null

    try {
      console.log(`Loading parts for set ID: ${setId}`)
      
      // 방법 1: 단순하게 모든 데이터 가져오기 (제한 없이)
      const { data, error: dbError, count } = await supabase
        .from('set_parts')
        .select(`
          *,
          lego_parts(*),
          lego_colors(*)
        `, { count: 'exact' })
        .eq('set_id', setId)

      if (dbError) {
        console.error('Database error:', dbError)
        throw dbError
      }

      console.log(`Direct query returned ${data ? data.length : 0} parts`)
      console.log(`Total count in database: ${count}`)

      // 만약 제한이 있다면 페이지네이션으로 다시 시도
      if (data && data.length < count) {
        console.log('Direct query returned fewer results than expected, trying pagination...')
        
        const allParts = []
        let from = 0
        const pageSize = 1000
        let hasMore = true
        let pageCount = 0

        while (hasMore && pageCount < 5) { // 최대 5페이지까지만
          pageCount++
          console.log(`Fetching page ${pageCount}, range: ${from} to ${from + pageSize - 1}`)
          
          const { data: pageData, error: pageError } = await supabase
            .from('set_parts')
            .select(`
              *,
              lego_parts(*),
              lego_colors(*)
            `)
            .eq('set_id', setId)
            .range(from, from + pageSize - 1)

          if (pageError) {
            console.error('Page error:', pageError)
            throw pageError
          }

          console.log(`Page ${pageCount} returned ${pageData ? pageData.length : 0} parts`)

          if (pageData && pageData.length > 0) {
            allParts.push(...pageData)
            console.log(`Total parts collected so far: ${allParts.length}`)
            from += pageSize
            
            if (pageData.length < pageSize) {
              hasMore = false
              console.log('No more data available, stopping pagination')
            }
          } else {
            hasMore = false
            console.log('No data returned, stopping pagination')
          }
        }

        console.log(`Pagination result: Loaded ${allParts.length} parts for set ${setId}`)
        return allParts
      }

      console.log(`Final result: Loaded ${data ? data.length : 0} parts for set ${setId}`)
      return data || []
      
    } catch (err) {
      console.error('Error loading set parts:', err)
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

  // 이미 등록된 세트인지 확인
  const checkSetExists = async (setNum) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name, created_at')
        .eq('set_num', setNum)
        .maybeSingle()

      if (dbError) throw dbError
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 여러 세트의 등록 상태를 한 번에 확인
  const checkMultipleSetsExist = async (setNums) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name, created_at')
        .in('set_num', setNums)

      if (dbError) throw dbError
      return data || []
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
    getOperationLogs,
    checkSetExists,
    checkMultipleSetsExist
  }
}
