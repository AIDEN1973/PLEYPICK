import { ref } from 'vue'
import { useSupabase } from './useSupabase'

export function usePartSearch() {
  const { supabase } = useSupabase()
  const loading = ref(false)
  const error = ref(null)

  // 1. 부품으로 세트 찾기
  const findSetsByPart = async (partId, colorId = null) => {
    try {
      loading.value = true
      error.value = null

      // 입력값 검증
      if (!partId) {
        console.warn('[usePartSearch] partId가 없습니다')
        return []
      }

      console.log('[usePartSearch] findSetsByPart 시작:', { partId, colorId })

      // 1단계: set_parts에서 set_id 목록 가져오기 (최소 컬럼만 조회)
      let query = supabase
        .from('set_parts')
        .select('set_id, quantity')
        .eq('part_id', String(partId))

      if (colorId !== null && colorId !== undefined) {
        query = query.eq('color_id', colorId)
      }

      // 대량 데이터를 위한 최적화: limit 제거하여 모든 결과 조회
      const { data: setPartsData, error: setPartsError } = await query

      if (setPartsError) {
        console.error('[usePartSearch] set_parts 조회 에러:', setPartsError)
        throw setPartsError
      }

      if (!setPartsData || setPartsData.length === 0) {
        console.log('[usePartSearch] set_parts 결과 없음:', { partId, colorId })
        return []
      }

      // 중복 제거 및 유효한 set_id만 필터링
      const uniqueSetIds = [...new Set(
        setPartsData
          .map(sp => sp.set_id)
          .filter(id => id !== null && id !== undefined && id !== '')
      )]

      if (uniqueSetIds.length === 0) {
        console.warn('[usePartSearch] 유효한 set_id가 없습니다')
        return []
      }

      console.log('[usePartSearch] uniqueSetIds:', uniqueSetIds.length, '개')

      const quantityMap = new Map()
      setPartsData.forEach(sp => {
        if (sp.set_id && !quantityMap.has(sp.set_id)) {
          quantityMap.set(sp.set_id, sp.quantity || 0)
        }
      })

      // 2단계: lego_sets에서 세트 정보 가져오기
      // Supabase의 .in()은 최대 100개까지만 지원하므로 분할 처리
      // 모든 배치를 병렬로 처리하여 최대 속도 확보
      const batchSize = 100
      const totalBatches = Math.ceil(uniqueSetIds.length / batchSize)
      const maxConcurrent = Math.min(20, totalBatches) // 최대 20개 동시 처리 (3000개면 30배치 → 20개씩 처리)
      
      console.log(`[usePartSearch] lego_sets 배치 조회 시작: ${uniqueSetIds.length}개 → ${totalBatches}개 배치 (동시 처리: ${maxConcurrent})`)
      
      // 모든 배치를 생성
      const allBatchPromises = []
      for (let i = 0; i < uniqueSetIds.length; i += batchSize) {
        const batch = uniqueSetIds.slice(i, i + batchSize)
        if (batch.length > 0) {
          allBatchPromises.push(
            supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, webp_image_url')
              .in('id', batch)
              .then(({ data: batchData, error: setsError }) => {
                if (setsError) {
                  const batchNum = Math.floor(i / batchSize) + 1
                  console.error(`[usePartSearch] lego_sets 조회 에러 (배치 ${batchNum}/${totalBatches}):`, setsError)
                  throw setsError
                }
                return batchData || []
              })
          )
        }
      }
      
      // 배치를 그룹으로 나누어 병렬 처리 (메모리 부하 방지)
      const setsData = []
      for (let i = 0; i < allBatchPromises.length; i += maxConcurrent) {
        const batchGroup = allBatchPromises.slice(i, i + maxConcurrent)
        const batchResults = await Promise.all(batchGroup)
        batchResults.forEach(result => {
          if (result && result.length > 0) {
            setsData.push(...result)
          }
        })
        
        // 진행 상황 로깅 (큰 데이터셋만)
        if (totalBatches > 10 && (i + maxConcurrent) < allBatchPromises.length) {
          const processed = Math.min(i + maxConcurrent, allBatchPromises.length)
          console.log(`[usePartSearch] 진행: ${processed}/${totalBatches} 배치 완료 (${setsData.length}개 세트)`)
        }
      }

      console.log(`[usePartSearch] lego_sets 조회 완료: ${setsData.length}개 세트`)

      if (setsData.length === 0) {
        console.log('[usePartSearch] lego_sets 결과 없음')
        return []
      }

      const themeIds = [...new Set(setsData.map(set => set.theme_id).filter(Boolean))]
      let themeMap = new Map()

      if (themeIds.length > 0) {
        // theme_id도 배치 처리 (전체 병렬 처리)
        const themeBatchSize = 100
        const themeTotalBatches = Math.ceil(themeIds.length / themeBatchSize)
        const themeMaxConcurrent = Math.min(20, themeTotalBatches)
        
        // 모든 테마 배치를 생성
        const allThemeBatchPromises = []
        for (let i = 0; i < themeIds.length; i += themeBatchSize) {
          const batch = themeIds.slice(i, i + themeBatchSize)
          if (batch.length > 0) {
            allThemeBatchPromises.push(
              supabase
                .from('lego_themes')
                .select('theme_id, name')
                .in('theme_id', batch)
                .then(({ data: batchThemes, error: themesError }) => {
                  if (themesError) {
                    const batchNum = Math.floor(i / themeBatchSize) + 1
                    console.error(`[usePartSearch] lego_themes 조회 에러 (배치 ${batchNum}/${themeTotalBatches}):`, themesError)
                    throw themesError
                  }
                  return batchThemes || []
                })
            )
          }
        }
        
        // 테마 배치를 그룹으로 나누어 병렬 처리
        const themesData = []
        for (let i = 0; i < allThemeBatchPromises.length; i += themeMaxConcurrent) {
          const themeBatchGroup = allThemeBatchPromises.slice(i, i + themeMaxConcurrent)
          const themeBatchResults = await Promise.all(themeBatchGroup)
          themeBatchResults.forEach(result => {
            if (result && result.length > 0) {
              themesData.push(...result)
            }
          })
        }
        
        themeMap = new Map(themesData.map(theme => [theme.theme_id, theme.name]))
      }

      // 결과 정리
      const result = setsData.map(set => ({
        id: set.id,
        name: set.name || 'Unknown',
        set_num: set.set_num || '',
        theme_id: set.theme_id || null,
        theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
        image_url: set.webp_image_url || null,
        quantity: quantityMap.get(set.id) || 0
      }))

      console.log('[usePartSearch] findSetsByPart 완료:', result.length, '개 세트')
      return result
    } catch (err) {
      error.value = err.message
      console.error('부품으로 세트 찾기 실패:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  // 2. 부품으로 대체부품 찾기 (동일 모양, 색상만 다른 부품)
  const findAlternativeParts = async (partId, currentColorId = null, excludeSetId = null) => {
    try {
      loading.value = true
      error.value = null

      // 동일 part_id를 가진 다른 색상 부품 찾기 (set_parts에서)
      // 현재 세트를 제외하고 조회
      let query = supabase
        .from('set_parts')
        .select('color_id, set_id')
        .eq('part_id', partId)
      
      // 현재 세트를 제외
      if (excludeSetId) {
        query = query.neq('set_id', excludeSetId)
      }
      
      const { data: partColors, error: colorsError } = await query.limit(100)

      if (colorsError) {
        console.error('[usePartSearch] set_parts 조회 오류:', colorsError)
        throw colorsError
      }

      if (!partColors || partColors.length === 0) {
        console.log('[usePartSearch] 대체부품 없음: part_id=', partId)
        return []
      }

      console.log('[usePartSearch] partColors 샘플:', partColors.slice(0, 3))

      // 모든 색상 ID 수집 (현재 색상 포함)
      // color_id: 0도 유효한 색상이므로 filter(Boolean) 대신 null/undefined만 필터링
      const allColorIds = [...new Set(
        partColors
          .map(pc => pc.color_id)
          .filter(id => id !== null && id !== undefined)
      )]
      console.log('[usePartSearch] allColorIds (현재 색상 포함):', allColorIds)

      // 현재 색상 제외하고 다른 색상만 필터링
      const uniqueColorIds = [...new Set(
        partColors
          .filter(pc => {
            const isDifferent = currentColorId === null || 
              (pc.color_id !== null && pc.color_id !== undefined && pc.color_id !== currentColorId)
            console.log('[usePartSearch] 색상 필터링:', {
              color_id: pc.color_id,
              currentColorId: currentColorId,
              isDifferent: isDifferent
            })
            return isDifferent
          })
          .map(pc => pc.color_id)
          .filter(id => id !== null && id !== undefined)
      )]

      console.log('[usePartSearch] uniqueColorIds (현재 색상 제외):', uniqueColorIds)

      let alternativeColors = []

      if (uniqueColorIds.length > 0) {
        // lego_colors에서 색상 정보 조회
        const { data: legoColors, error: legoColorsError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .in('color_id', uniqueColorIds)

        if (legoColorsError) {
          console.error('[usePartSearch] lego_colors 조회 오류:', legoColorsError)
          throw legoColorsError
        }

        console.log('[usePartSearch] legoColors:', legoColors)

        // 색상 정보 매핑
        const colorMap = new Map((legoColors || []).map(c => [c.color_id, c]))

        // 모든 색상의 element_id를 한 번에 배치 조회 (현재 세트 제외)
        const elementIdMap = new Map()
        if (uniqueColorIds.length > 0) {
          let batchQuery = supabase
            .from('set_parts')
            .select('color_id, element_id')
            .eq('part_id', partId)
            .in('color_id', uniqueColorIds)
            .not('element_id', 'is', null)
          
          // 현재 세트를 제외
          if (excludeSetId) {
            batchQuery = batchQuery.neq('set_id', excludeSetId)
          }
          
          const { data: allSetParts, error: setPartsError } = await batchQuery.limit(100)

          if (!setPartsError && allSetParts) {
            // 각 color_id별 첫 번째 element_id만 사용 (중복 제거)
            allSetParts.forEach(sp => {
              if (sp.element_id && !elementIdMap.has(sp.color_id)) {
                elementIdMap.set(sp.color_id, sp.element_id)
              }
            })
          }
        }

        // 대체 색상 배열 생성
        alternativeColors = uniqueColorIds.map(colorId => {
          const colorInfo = colorMap.get(colorId)
          return {
            color_id: colorId,
            name: colorInfo?.name || `Color ${colorId}`,
            rgb: colorInfo?.rgb || null,
            element_id: elementIdMap.get(colorId) || null
          }
        })

        console.log('[usePartSearch] alternativeColors:', alternativeColors)
      } else {
        // 대체 색상이 없으면 빈 배열 반환 (현재 색상과 동일한 부품만 있는 경우)
        console.log('[usePartSearch] 대체 색상 없음: part_id=', partId, 'currentColorId=', currentColorId, 'allColorIds=', allColorIds)
        alternativeColors = []
      }

      // 대체 색상이 없으면 빈 배열 반환
      if (alternativeColors.length === 0) {
        console.log('[usePartSearch] 대체 색상이 없어 빈 배열 반환')
        return []
      }

      // 부품 정보 가져오기
      const { data: partInfo, error: partError } = await supabase
        .from('lego_parts')
        .select('part_num, name, part_img_url')
        .eq('part_num', partId)
        .single()

      if (partError) throw partError

      // 결과 정리 (동일 부품, 다른 색상들)
      const alternatives = [{
        part_id: partId,
        part_name: partInfo?.name || partId,
        part_img_url: partInfo?.part_img_url || null,
        colors: alternativeColors,
        is_same_part: true
      }]

      return alternatives
    } catch (err) {
      error.value = err.message
      console.error('대체부품 찾기 실패:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  // 3. 세트별 희귀부품 찾기
  const findRarePartsInSet = async (setId) => {
    try {
      loading.value = true
      error.value = null

      // 세트의 부품 목록 가져오기
      const { data: setParts, error: setPartsError } = await supabase
        .from('set_parts')
        .select('part_id, color_id, quantity')
        .eq('set_id', setId)

      if (setPartsError) throw setPartsError

      const partIds = [...new Set(setParts.map(sp => sp.part_id))]

      // parts_master에서 usage_frequency가 낮은 부품 찾기 (희귀도 높음)
      const { data: masterParts, error: masterError } = await supabase
        .from('parts_master')
        .select('part_id, shape_tag, usage_frequency')
        .in('part_id', partIds)
        .not('usage_frequency', 'is', null)
        .order('usage_frequency', { ascending: true })
        .limit(50)

      if (masterError) throw masterError

      // 부품 정보 가져오기
      const { data: partsInfo, error: partsInfoError } = await supabase
        .from('lego_parts')
        .select('part_num, name, part_img_url')
        .in('part_num', partIds)

      if (partsInfoError) throw partsInfoError

      const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
      const masterMap = new Map(masterParts.map(m => [m.part_id, m]))

      // 희귀도 기준으로 정렬 (usage_frequency가 낮을수록 희귀)
      const rareParts = setParts
        .map(sp => {
          const master = masterMap.get(sp.part_id)
          const partInfo = partsInfoMap.get(sp.part_id)
          return {
            part_id: sp.part_id,
            color_id: sp.color_id,
            quantity: sp.quantity,
            part_name: partInfo?.name || sp.part_id,
            part_img_url: partInfo?.part_img_url || null,
            usage_frequency: master?.usage_frequency ?? null,
            shape_tag: master?.shape_tag || ''
          }
        })
        .filter(p => p.usage_frequency !== null)
        .sort((a, b) => (a.usage_frequency ?? 999) - (b.usage_frequency ?? 999))
        .slice(0, 20) // 상위 20개만

      return rareParts
    } catch (err) {
      error.value = err.message
      console.error('희귀부품 찾기 실패:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    findSetsByPart,
    findAlternativeParts,
    findRarePartsInSet
  }
}

