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

      // 1단계: set_parts에서 set_id 목록 가져오기
      let query = supabase
        .from('set_parts')
        .select('set_id, quantity')
        .eq('part_id', partId)

      if (colorId !== null) {
        query = query.eq('color_id', colorId)
      }

      const { data: setPartsData, error: setPartsError } = await query

      if (setPartsError) throw setPartsError

      if (!setPartsData || setPartsData.length === 0) {
        return []
      }

      // 중복 제거
      const uniqueSetIds = [...new Set(setPartsData.map(sp => sp.set_id))]
      const quantityMap = new Map()
      setPartsData.forEach(sp => {
        if (!quantityMap.has(sp.set_id)) {
          quantityMap.set(sp.set_id, sp.quantity)
        }
      })

      // 2단계: lego_sets에서 세트 정보 가져오기
      const { data: setsData, error: setsError } = await supabase
        .from('lego_sets')
        .select('id, name, set_num, theme_id, webp_image_url')
        .in('id', uniqueSetIds)

      if (setsError) throw setsError

      const themeIds = [...new Set((setsData || []).map(set => set.theme_id).filter(Boolean))]
      let themeMap = new Map()

      if (themeIds.length > 0) {
        const { data: themesData, error: themesError } = await supabase
          .from('lego_themes')
          .select('theme_id, name')
          .in('theme_id', themeIds)

        if (themesError) throw themesError
        themeMap = new Map((themesData || []).map(theme => [theme.theme_id, theme.name]))
      }

      // 결과 정리
      const result = (setsData || []).map(set => ({
        id: set.id,
        name: set.name,
        set_num: set.set_num,
        theme_id: set.theme_id || null,
        theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
        image_url: set.webp_image_url,
        quantity: quantityMap.get(set.id) || 0
      }))

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
  const findAlternativeParts = async (partId, currentColorId = null) => {
    try {
      loading.value = true
      error.value = null

      // 동일 part_id를 가진 다른 색상 부품 찾기 (set_parts에서)
      const { data: partColors, error: colorsError } = await supabase
        .from('set_parts')
        .select('color_id, lego_colors:color_id (color_id, name, rgb)')
        .eq('part_id', partId)
        .limit(100)

      if (colorsError) throw colorsError

      if (!partColors || partColors.length === 0) {
        return []
      }

      // 현재 색상 제외하고 다른 색상만 필터링
      const alternativeColors = partColors
        .filter(pc => currentColorId === null || pc.color_id !== currentColorId)
        .map(pc => ({
          color_id: pc.color_id,
          name: pc.lego_colors?.name || `Color ${pc.color_id}`,
          rgb: pc.lego_colors?.rgb || null
        }))

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

