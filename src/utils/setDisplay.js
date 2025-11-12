export const formatSetNumber = (setNum) => {
  if (setNum === null || setNum === undefined) return ''
  const value = String(setNum).trim()
  if (!value) return ''
  return value.split('-')[0]
}

export const formatThemeName = (themeName) => {
  if (!themeName) return ''
  const value = String(themeName).trim()
  return value || ''
}

export const formatSetDisplay = (setNum, themeName, setName) => {
  const parts = []
  const number = formatSetNumber(setNum)
  const theme = formatThemeName(themeName)
  const name = setName && String(setName).trim() ? String(setName).trim() : ''

  if (number) parts.push(number)
  if (theme) parts.push(theme)
  if (name) parts.push(name)

  if (parts.length === 0) {
    return '세트명 없음'
  }

  return parts.join(' ')
}

export const fetchSetMetadata = async (supabase, setIds) => {
  const metadataMap = new Map()

  if (!setIds || setIds.length === 0) {
    return metadataMap
  }

  const uniqueIds = Array.from(new Set(setIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return metadataMap
  }

  const { data: setsData, error: setsError } = await supabase
    .from('lego_sets')
    .select('id, name, set_num, theme_id')
    .in('id', uniqueIds)

  if (setsError) {
    console.error('세트 메타데이터 조회 실패:', setsError)
    return metadataMap
  }

  const themeIds = Array.from(
    new Set((setsData || []).map(set => set.theme_id).filter(Boolean))
  )

  let themeMap = new Map()
  if (themeIds.length > 0) {
    const { data: themesData, error: themesError } = await supabase
      .from('lego_themes')
      .select('theme_id, name')
      .in('theme_id', themeIds)

    if (themesError) {
      console.error('테마 메타데이터 조회 실패:', themesError)
    } else if (themesData) {
      themeMap = new Map(themesData.map(theme => [theme.theme_id, theme.name]))
    }
  }

  ;(setsData || []).forEach(set => {
    metadataMap.set(set.id, {
      set_name: set.name || '',
      set_num: set.set_num || '',
      theme_id: set.theme_id || null,
      theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null
    })
  })

  return metadataMap
}


