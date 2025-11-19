import { ref } from 'vue'
import { supabase } from './useSupabase'

export function useDatabase() {
  const loading = ref(false)
  const error = ref(null)


  // 중복 세트 삭제 (재등록 시)
  const deleteSetAndParts = async (setId, setNum, deleteLLMAnalysis = false) => {
    try {
      // 1. 부품 이미지 삭제
      const { data: setParts, error: partsError } = await supabase
        .from('set_parts')
        .select('part_id, color_id')
        .eq('set_id', setId)

      if (!partsError && setParts) {
        // Storage 버킷에서 실제 파일들 삭제
        console.log('🗂️ Storage 버킷에서 이미지 파일 삭제 중...')
        
        // 먼저 Storage 버킷의 현재 파일 목록 확인
        try {
          const { data: bucketFiles, error: listError } = await supabase.storage
            .from('lego_parts_images')
            .list('images', { limit: 1000 })
          
          if (listError) {
            console.warn('⚠️ Storage 버킷 목록 조회 실패:', listError)
          } else {
            console.log('📁 Storage 버킷 현재 파일 수:', bucketFiles?.length || 0)
            console.log('📁 Storage 버킷 파일 샘플:', bucketFiles?.slice(0, 5)?.map(f => f.name))
          }
        } catch (listErr) {
          console.warn('⚠️ Storage 버킷 목록 조회 중 오류:', listErr)
        }
        
        const filesToDelete = []
        
        for (const part of setParts) {
          try {
            // part_images 테이블에서 파일 경로 조회
            const { data: partImages, error: imagesError } = await supabase
              .from('part_images')
              .select('uploaded_url, local_path, filename')
              .eq('part_id', part.part_id)
              .eq('color_id', part.color_id)
            
            if (imagesError) {
              console.warn(`⚠️ part_images 조회 실패 (${part.part_id}, ${part.color_id}):`, imagesError.message)
              continue // 다음 부품으로 넘어감
            }
            
            if (partImages && partImages.length > 0) {
              for (const image of partImages) {
                // uploaded_url에서 파일 경로 추출
                if (image.uploaded_url) {
                  // URL에서 파일 경로 추출 (예: https://...supabase.co/storage/v1/object/public/lego_parts_images/images/3001_72.webp)
                  const urlParts = image.uploaded_url.split('/')
                  const fileName = urlParts[urlParts.length - 1]
                  if (fileName) {
                    filesToDelete.push(`images/${fileName}`)
                  }
                }
                // local_path가 있다면 사용
                else if (image.local_path) {
                  filesToDelete.push(image.local_path)
                }
                // filename만 있다면 기본 경로 사용
                else if (image.filename) {
                  filesToDelete.push(`images/${image.filename}`)
                }
              }
            }
          } catch (partError) {
            console.warn(`⚠️ 부품 ${part.part_id} 이미지 조회 중 오류:`, partError.message)
            continue // 다음 부품으로 넘어감
          }
        }
        
        // Storage에서 파일들 삭제
        if (filesToDelete.length > 0) {
          console.log('🗑️ 삭제할 파일 목록:', filesToDelete)
          try {
            const { data: deleteData, error: deleteError } = await supabase.storage
              .from('lego_parts_images')
              .remove(filesToDelete)
            
            if (deleteError) {
              console.error('❌ Storage 파일 삭제 실패:', deleteError)
              console.error('삭제 실패한 파일들:', filesToDelete)
            } else {
              console.log(`✅ Storage에서 ${filesToDelete.length}개 파일 삭제 완료`)
              console.log('삭제된 파일들:', deleteData)
            }
          } catch (storageError) {
            console.error('❌ Storage 파일 삭제 중 예외 발생:', storageError)
            console.error('삭제 시도한 파일들:', filesToDelete)
          }
        } else {
          console.log('ℹ️ 삭제할 Storage 파일이 없습니다.')
        }
        
        // part_images 테이블에서 관련 이미지 삭제
        for (const part of setParts) {
          try {
            const { error: deleteError } = await supabase
              .from('part_images')
              .delete()
              .eq('part_id', part.part_id)
              .eq('color_id', part.color_id)
            
            if (deleteError) {
              console.warn(`⚠️ part_images 삭제 실패 (${part.part_id}, ${part.color_id}):`, deleteError.message)
            }
          } catch (deleteErr) {
            console.warn(`⚠️ 부품 ${part.part_id} 이미지 메타데이터 삭제 중 오류:`, deleteErr.message)
          }
        }
        
        // LLM 분석 데이터 삭제 (옵션)
        if (deleteLLMAnalysis) {
          console.log('🧠 LLM 분석 데이터 삭제 중...')
          for (const part of setParts) {
            try {
              const { error: llmDeleteError } = await supabase
                .from('parts_master_features')
                .delete()
                .eq('part_id', part.part_id)
                .eq('color_id', part.color_id)
              
              if (llmDeleteError) {
                console.warn(`⚠️ LLM 분석 데이터 삭제 실패 (${part.part_id}, ${part.color_id}):`, llmDeleteError.message)
              }
            } catch (llmErr) {
              console.warn(`⚠️ 부품 ${part.part_id} LLM 데이터 삭제 중 오류:`, llmErr.message)
            }
          }
          console.log('✅ LLM 분석 데이터 삭제 완료')
        }
      }

      // 2. 세트 이미지도 Storage에서 삭제
      console.log('🖼️ 세트 이미지 삭제 중...')
      try {
        const { data: setData, error: setError } = await supabase
          .from('lego_sets')
          .select('set_img_url, webp_image_url')
          .eq('id', setId)
          .single()
        
        if (!setError && setData) {
          const setFilesToDelete = []
          
          // WebP 이미지가 있다면 삭제 대상에 추가
          if (setData.webp_image_url) {
            // URL에서 파일 경로 추출
            const urlParts = setData.webp_image_url.split('/')
            const fileName = urlParts[urlParts.length - 1]
            if (fileName) {
              setFilesToDelete.push(`sets/${fileName}`)
            }
          }
          
          if (setFilesToDelete.length > 0) {
            console.log('🗑️ 삭제할 세트 이미지 목록:', setFilesToDelete)
            const { data: deleteSetData, error: deleteSetError } = await supabase.storage
              .from('lego_parts_images')
              .remove(setFilesToDelete)
            
            if (deleteSetError) {
              console.error('❌ 세트 이미지 삭제 실패:', deleteSetError)
              console.error('삭제 실패한 세트 이미지들:', setFilesToDelete)
            } else {
              console.log(`✅ 세트 이미지 ${setFilesToDelete.length}개 삭제 완료`)
              console.log('삭제된 세트 이미지들:', deleteSetData)
            }
          } else {
            console.log('ℹ️ 삭제할 세트 이미지가 없습니다.')
          }
        }
      } catch (setImageError) {
        console.warn('⚠️ 세트 이미지 삭제 중 오류:', setImageError)
      }

      // 3. set_parts 삭제
      await supabase
        .from('set_parts')
        .delete()
        .eq('set_id', setId)

      // 4. 세트 삭제
      await supabase
        .from('lego_sets')
        .delete()
        .eq('id', setId)

      console.log(`✅ Deleted existing set ${setNum} and all related data`)
      return true
    } catch (err) {
      console.error('Error deleting existing set:', err)
      return false
    }
  }

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
          last_modified_dt: setData.last_modified_date || setData.last_modified_dt
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

      // 1) element_id가 있는 경우, 전역적으로 element_id 기준으로 중복 체크 (다른 세트에 이미 등록된 경우)
      if (elementId) {
        // 먼저 현재 세트에서 동일 element_id가 있는지 확인
        const { data: existingInSet, error: setElementError } = await supabase
          .from('set_parts')
          .select('id, quantity, part_id, color_id')
          .eq('set_id', setId)
          .eq('element_id', elementId)
          .maybeSingle()

        if (setElementError && setElementError.code !== 'PGRST116') {
          console.warn('Warning checking existing set-part by element_id in set:', setElementError)
        }

        if (existingInSet) {
          console.log(`Duplicate set-part detected by element_id=${elementId} in same set, skipping insert`)
          return { id: existingInSet.id, set_id: setId, part_id: existingInSet.part_id, color_id: existingInSet.color_id, quantity: existingInSet.quantity }
        }

        // 다른 세트에서 동일 element_id가 이미 등록되어 있는지 확인
        const { data: existingInOtherSet, error: globalElementError } = await supabase
          .from('set_parts')
          .select('id, set_id, part_id, color_id')
          .eq('element_id', elementId)
          .neq('set_id', setId)
          .limit(1)
          .maybeSingle()

        if (globalElementError && globalElementError.code !== 'PGRST116') {
          console.warn('Warning checking existing set-part by element_id globally:', globalElementError)
        }

        if (existingInOtherSet) {
          console.log(`⚠️ 동일 element_id=${elementId} 부품이 다른 세트(set_id=${existingInOtherSet.set_id})에 이미 등록되어 있습니다. 세트-부품 관계만 저장합니다.`)
          // 다른 세트에 이미 등록되어 있어도 현재 세트의 set_parts에는 저장해야 함
          // (세트별 부품 정보는 필요하므로)
        }
      }

      // 2) element_id가 없거나 element_id 기준으로 중복이 없는 경우, set_id + part_id + color_id 기준으로 중복 체크
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

  // 부품 이미지 정보 저장 (element_id 지원)
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
          error_message: imageData.error_message,
          ...(imageData.element_id && { element_id: String(imageData.element_id) })
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

  // 작업 로그 저장 (완전 비활성화 - RLS 정책 문제)
  const saveOperationLog = async (operationData) => {
    // operation_logs 테이블의 RLS 정책 문제로 인해 완전히 비활성화
    // 콘솔에만 로그 출력하여 디버깅 가능
    console.log('📝 Operation log (disabled due to RLS policy):', {
      operation_type: operationData.operation_type,
      target_type: operationData.target_type,
      status: operationData.status,
      message: operationData.message?.substring(0, 100) + '...'
    })
    return null
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
        .select('*, webp_image_url, theme_id')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (dbError) throw dbError
      
      // theme 정보를 별도로 조회
      const themeIds = [...new Set((data || []).map(s => s.theme_id).filter(Boolean))]
      let themesMap = new Map()
      if (themeIds.length > 0) {
        const { data: themesData } = await supabase
          .from('lego_themes')
          .select('theme_id, name')
          .in('theme_id', themeIds)
        
        if (themesData) {
          themesMap = new Map(themesData.map(t => [t.theme_id, t.name]))
        }
      }
      
      // theme_name 추가
      return (data || []).map(set => ({
        ...set,
        theme_name: set.theme_id ? themesMap.get(set.theme_id) : null
      }))
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
      // 외래 키 제약 조건 제거로 인한 관계 인식 문제 해결을 위해 단계별 조회
      const { data: setParts, error: setPartsError, count } = await supabase
        .from('set_parts')
        .select('*', { count: 'exact' })
        .eq('set_id', setId)
      
      if (setPartsError) {
        console.error('Database error:', setPartsError)
        throw setPartsError
      }
      
      if (!setParts || setParts.length === 0) {
        return { data: [], count: 0 }
      }
      
      // part_id와 color_id 목록 추출
      const partIds = [...new Set(setParts.map(sp => sp.part_id))]
      const colorIds = [...new Set(setParts.map(sp => sp.color_id))]
      
      // lego_parts와 lego_colors 별도 조회
      const { data: legoParts, error: legoPartsError } = await supabase
        .from('lego_parts')
        .select('part_num, name, part_cat_id, part_img_url')
        .in('part_num', partIds)
      
      const { data: legoColors, error: legoColorsError } = await supabase
        .from('lego_colors')
        .select('color_id, name, rgb')
        .in('color_id', colorIds)
      
      if (legoPartsError || legoColorsError) {
        console.error('Related data error:', legoPartsError || legoColorsError)
        throw legoPartsError || legoColorsError
      }
      
      // 데이터 조합
      const data = setParts.map(sp => ({
        ...sp,
        lego_parts: legoParts.find(lp => lp.part_num === sp.part_id),
        lego_colors: legoColors.find(lc => lc.color_id === sp.color_id)
      }))

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

  // 부품 이미지 목록 조회 (element_id 우선 지원)
  const getPartImages = async (partId, colorId = null, elementId = null) => {
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

      // element_id가 있으면 element_id로 우선 조회
      if (elementId) {
        query = query.eq('element_id', String(elementId))
      } else {
        // element_id가 없으면 part_id + color_id로 조회
        query = query.eq('part_id', partId)
        if (colorId) {
          query = query.eq('color_id', colorId)
        }
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
    try {
      const { data, error: dbError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name, year, num_parts, created_at')
        .eq('set_num', setNum)
        .maybeSingle()

      if (dbError) throw dbError
      return data
    } catch (err) {
      console.error('Error checking set existence:', err)
      return null
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

  // 모든 Storage 버킷 정리 (models 버킷 제외)
  const clearAllStorageBuckets = async () => {
    try {
      console.log('🧹 모든 Storage 버킷 정리 시작...')
      
      const bucketsToClean = [
        'lego_parts_images',
        'lego-synthetic',
        'temp',
        'uploads'
      ]
      
      const results = {
        totalFiles: 0,
        deletedFiles: 0,
        errors: []
      }
      
      for (const bucketName of bucketsToClean) {
        console.log(`🗂️ ${bucketName} 버킷 정리 중...`)
        
        try {
          // 버킷의 루트 레벨 항목 조회
          const { data: rootItems, error: listError } = await supabase.storage
            .from(bucketName)
            .list('', { limit: 10000 })
          
          if (listError) {
            console.warn(`⚠️ ${bucketName} 버킷 목록 조회 실패:`, listError)
            results.errors.push(`${bucketName}: ${listError.message}`)
            continue
          }
          
          if (!rootItems || rootItems.length === 0) {
            console.log(`✅ ${bucketName} 버킷이 이미 비어있습니다.`)
            continue
          }
          
          console.log(`📁 ${bucketName} 버킷에서 ${rootItems.length}개 루트 항목 발견`)
          
          // 알려진 폴더 구조를 직접 탐색
          const allFilePaths = []
          const knownFolders = ['images', 'sets', 'synthetic', 'temp', 'uploads']
          
          for (const folderName of knownFolders) {
            console.log(`🔍 알려진 폴더 탐색: ${folderName}`)
            
            try {
              const { data: folderItems, error: folderError } = await supabase.storage
                .from(bucketName)
                .list(folderName, { limit: 1000 })
              
              if (folderError) {
                console.log(`❌ 폴더 ${folderName} 접근 실패:`, folderError.message)
                continue
              }
              
              if (!folderItems || folderItems.length === 0) {
                console.log(`📁 빈 폴더: ${folderName}`)
                continue
              }
              
              console.log(`📁 폴더 ${folderName}에서 ${folderItems.length}개 항목 발견`)
              
              for (const item of folderItems) {
                const fullPath = `${folderName}/${item.name}`
                console.log(`📄 항목: ${item.name}, 전체 경로: ${fullPath}`)
                console.log(`📄 메타데이터:`, item)
                
                if (item.metadata?.size > 0) {
                  allFilePaths.push(fullPath)
                  console.log(`✅ 파일 추가: ${fullPath}`)
                } else {
                  // 하위 폴더인 경우 더 깊이 탐색
                  console.log(`📁 하위 폴더 탐색: ${fullPath}`)
                  
                  try {
                    const { data: subItems, error: subError } = await supabase.storage
                      .from(bucketName)
                      .list(fullPath, { limit: 1000 })
                    
                    if (subError) {
                      console.log(`❌ 하위 폴더 ${fullPath} 접근 실패:`, subError.message)
                    } else if (subItems && subItems.length > 0) {
                      console.log(`📁 하위 폴더 ${fullPath}에서 ${subItems.length}개 항목 발견`)
                      
                      for (const subItem of subItems) {
                        const subPath = `${fullPath}/${subItem.name}`
                        console.log(`📄 하위 항목: ${subItem.name}, 전체 경로: ${subPath}`)
                        
                        if (subItem.metadata?.size > 0) {
                          allFilePaths.push(subPath)
                          console.log(`✅ 하위 파일 추가: ${subPath}`)
                        } else {
                          console.log(`📁 하위 폴더 또는 빈 항목: ${subPath}`)
                        }
                      }
                    } else {
                      console.log(`📁 빈 하위 폴더: ${fullPath}`)
                    }
                  } catch (subError) {
                    console.log(`❌ 하위 폴더 ${fullPath} 탐색 중 오류:`, subError.message)
                  }
                }
              }
            } catch (error) {
              console.log(`❌ 폴더 ${folderName} 탐색 중 오류:`, error.message)
            }
          }
          
          console.log(`📋 수집된 파일 경로: ${allFilePaths.length}개`)
          console.log(`📋 파일 목록:`, allFilePaths)
          
          results.totalFiles += allFilePaths.length
          
          if (allFilePaths.length > 0) {
            console.log(`🗑️ ${bucketName} 버킷에서 ${allFilePaths.length}개 파일 삭제 중...`)
            
            // 배치로 파일 삭제 (한 번에 10개씩으로 줄임)
            const batchSize = 10
            for (let i = 0; i < allFilePaths.length; i += batchSize) {
              const batch = allFilePaths.slice(i, i + batchSize)
              console.log(`🗑️ 삭제 시도: ${batch.join(', ')}`)
              
              const { data: deleteData, error: deleteError } = await supabase.storage
                .from(bucketName)
                .remove(batch)
              
              console.log(`삭제 결과:`, { deleteData, deleteError })
              
              if (deleteError) {
                console.error(`❌ ${bucketName} 버킷 파일 삭제 실패:`, deleteError)
                console.error(`실패한 파일들:`, batch)
                results.errors.push(`${bucketName}: ${deleteError.message}`)
              } else {
                console.log(`✅ ${bucketName} 버킷에서 ${batch.length}개 파일 삭제 완료`)
                console.log(`삭제된 파일들:`, deleteData)
                results.deletedFiles += batch.length
              }
              
              // API 호출 제한 방지
              if (i + batchSize < allFilePaths.length) {
                await new Promise(resolve => setTimeout(resolve, 200))
              }
            }
          }
          
        } catch (bucketError) {
          console.error(`❌ ${bucketName} 버킷 처리 중 오류:`, bucketError)
          results.errors.push(`${bucketName}: ${bucketError.message}`)
        }
      }
      
      console.log('🎉 Storage 버킷 정리 완료!')
      console.log(`📊 총 ${results.totalFiles}개 파일 중 ${results.deletedFiles}개 삭제`)
      
      if (results.errors.length > 0) {
        console.warn('⚠️ 일부 오류 발생:', results.errors)
      }
      
      return results
      
    } catch (error) {
      console.error('❌ Storage 버킷 정리 중 오류:', error)
      throw error
    }
  }

  // 데이터베이스만 초기화 (Storage 제외)
  const resetDatabaseOnly = async () => {
    try {
      console.log('🔄 데이터베이스 초기화 시작...')
      
      const results = {
        deletedRecords: 0,
        errors: [],
        steps: []
      }
      
      // 데이터베이스 테이블 정리 (외래키 순서 고려)
      const tablesToClean = [
        // 의존성이 있는 테이블들부터 삭제
        'parts_master_features',  // LLM 분석 데이터
        'part_images',            // 부품 이미지 메타데이터
        'set_parts',              // 세트-부품 관계
        'lego_sets',              // 레고 세트
        'lego_parts',             // 레고 부품
        'lego_colors',            // 레고 색상
        'operation_logs',         // 작업 로그
        'image_metadata',         // 이미지 메타데이터
        'set_training_status',    // 훈련 상태
        'training_jobs',          // 훈련 작업
        'training_metrics',       // 훈련 메트릭
        'model_registry'          // 모델 레지스트리
      ]
      
      // 모든 테이블을 정상적인 방식으로 삭제
      const allTablesToClean = [
        // 의존성이 있는 테이블들부터 삭제
        'parts_master_features',  // LLM 분석 데이터
        'part_images',            // 부품 이미지 메타데이터
        'set_parts',              // 세트-부품 관계
        'lego_sets',              // 레고 세트
        'lego_parts',             // 레고 부품
        'lego_colors',            // 레고 색상
        'operation_logs',         // 작업 로그
        'synthetic_dataset',      // 합성 데이터셋
        'synthetic_part_stats',   // 합성 부품 통계
        'image_metadata',         // 이미지 메타데이터
        'set_training_status',    // 훈련 상태
        'training_jobs',          // 훈련 작업
        'training_metrics',       // 훈련 메트릭
        'model_registry'          // 모델 레지스트리
      ]
      
      // 모든 테이블을 하나의 루프에서 처리
      for (const tableName of allTablesToClean) {
        console.log(`🗑️ ${tableName} 테이블 정리 중...`)
        
        try {
          // 먼저 현재 레코드 수 확인
          const { count: beforeCount, error: beforeError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true })
          
          console.log(`📊 ${tableName} 삭제 전 레코드 수: ${beforeCount || 0}개`)
          
          if (beforeCount === 0) {
            console.log(`⏭️ ${tableName} 테이블이 이미 비어있습니다.`)
            results.steps.push(`${tableName}: 이미 비어있음`)
            continue
          }
          
          // 간단한 조건으로 모든 레코드 삭제 시도
          let deleteQuery = supabase.from(tableName).delete()
          
          // 테이블별로 적절한 조건 사용
          if (tableName === 'parts_master_features' || 
              tableName === 'set_training_status' || 
              tableName === 'training_jobs' || 
              tableName === 'training_metrics' || 
              tableName === 'model_registry' ||
              tableName === 'synthetic_dataset') {
            // integer ID 테이블들
            deleteQuery = deleteQuery.gte('id', 0)
          } else if (tableName === 'synthetic_part_stats') {
            // synthetic_part_stats는 특별한 처리
            deleteQuery = deleteQuery.not('part_id', 'is', null)
          } else {
            // UUID ID 테이블들
            deleteQuery = deleteQuery.neq('id', '00000000-0000-0000-0000-000000000000')
          }
          
          const { count, error: deleteError } = await deleteQuery
          
          if (deleteError) {
            console.error(`❌ ${tableName} 테이블 정리 실패:`, deleteError)
            results.errors.push(`${tableName}: ${deleteError.message}`)
          } else {
            console.log(`✅ ${tableName} 테이블 정리 완료`)
            
            // 실제 삭제 확인을 위해 레코드 수 조회
            try {
              const { count: remainingCount, error: countError } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true })
              
              if (countError) {
                console.warn(`⚠️ ${tableName} 레코드 수 확인 실패:`, countError.message)
              } else {
                console.log(`📊 ${tableName} 남은 레코드 수: ${remainingCount || 0}개`)
                if (remainingCount > 0) {
                  console.warn(`⚠️ ${tableName} 테이블에 ${remainingCount}개 레코드가 남아있습니다!`)
                  results.errors.push(`${tableName}: ${remainingCount}개 레코드가 남아있음`)
                }
              }
            } catch (countErr) {
              console.warn(`⚠️ ${tableName} 레코드 수 확인 중 오류:`, countErr.message)
            }
            
            results.steps.push(`${tableName}: 테이블 정리 완료`)
          }
        } catch (tableError) {
          console.error(`❌ ${tableName} 테이블 처리 중 오류:`, tableError)
          results.errors.push(`${tableName}: ${tableError.message}`)
        }
      }
      
      // 3. 시퀀스 리셋 (PostgreSQL 시퀀스) - 건너뛰기
      console.log('⏭️ 시퀀스 리셋 건너뛰기 (RPC 함수 없음)')
      results.steps.push('시퀀스 리셋 건너뛰기')
      
      console.log('🎉 데이터베이스 초기화 완료!')
      console.log(`📊 처리된 단계: ${results.steps.length}개`)
      console.log(`❌ 오류: ${results.errors.length}개`)
      
      if (results.errors.length > 0) {
        console.warn('⚠️ 일부 오류 발생:', results.errors)
      }
      
      return results
      
    } catch (error) {
      console.error('❌ 데이터베이스 초기화 중 오류:', error)
      throw error
    }
  }

  // 프로젝트 데이터 완전 초기화 (Storage + Database)
  const resetAllProjectData = async () => {
    try {
      console.log('🔄 프로젝트 데이터 완전 초기화 시작...')
      
      const results = {
        deletedRecords: 0,
        errors: [],
        steps: []
      }
      
      // 1. Storage 버킷 정리 (models 제외)
      console.log('🗂️ Storage 버킷 정리 중...')
      try {
        const storageResults = await clearAllStorageBuckets()
        results.deletedRecords += storageResults.deletedFiles
        results.steps.push(`Storage: ${storageResults.deletedFiles}개 파일 삭제`)
      } catch (storageError) {
        console.error('Storage 정리 실패:', storageError)
        results.errors.push(`Storage: ${storageError.message}`)
      }
      
      // 2. 데이터베이스 초기화
      console.log('🗄️ 데이터베이스 초기화 중...')
      try {
        const dbResults = await resetDatabaseOnly()
        results.steps.push(...dbResults.steps)
        results.errors.push(...dbResults.errors)
      } catch (dbError) {
        console.error('데이터베이스 초기화 실패:', dbError)
        results.errors.push(`Database: ${dbError.message}`)
      }
      
      console.log('🎉 프로젝트 데이터 초기화 완료!')
      console.log(`📊 처리된 단계: ${results.steps.length}개`)
      console.log(`❌ 오류: ${results.errors.length}개`)
      
      if (results.errors.length > 0) {
        console.warn('⚠️ 일부 오류 발생:', results.errors)
      }
      
      return results
      
    } catch (error) {
      console.error('❌ 프로젝트 데이터 초기화 중 오류:', error)
      throw error
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
    checkMultipleSetsExist,
    deleteSetAndParts,
    clearAllStorageBuckets,
    resetDatabaseOnly,
    resetAllProjectData
  }
}
