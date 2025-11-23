import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useSupabase } from './useSupabase'
import { fetchSetMetadata } from '../utils/setDisplay'

const applyMetadataToSession = (target, meta) => {
  if (!target || !meta) return
  if (meta.set_num && !target.set_num) {
    target.set_num = meta.set_num
  }
  if (meta.theme_name && !target.set_theme_name) {
    target.set_theme_name = meta.theme_name
  }
  if (meta.set_name && !target.set_name) {
    target.set_name = meta.set_name
  }
}

const hydrateSessionSetMetadata = async (supabase, target) => {
  if (!target?.set_id) return
  try {
    const metadataMap = await fetchSetMetadata(supabase, [target.set_id])
    const meta = metadataMap.get(target.set_id) || null
    applyMetadataToSession(target, meta)
  } catch (err) {
    console.warn('세트 메타데이터 로드 실패:', err)
  }
}

const defaultSessionState = () => ({
  id: null,
  set_id: null,
  set_name: null,
  set_num: null,
  set_theme_name: null,
  user_id: null,
  status: 'in_progress',
  progress: 0,
  started_at: null,
  last_saved_at: null,
  completed_at: null,
  updated_at: null
})

const createItemState = (overrides = {}) => ({
  id: crypto.randomUUID(),
  session_id: null,
  part_id: null,
  color_id: null,
  element_id: null,
  part_name: '',
  color_name: '',
  color_rgb: null,
  total_count: 0,
  checked_count: 0,
  status: 'pending',
  notes: '',
  updated_at: new Date().toISOString(),
  shape_tag: '',
  expected_stud_count: null,
  usage_frequency: null,
  sequence_index: 0,
  part_img_url: null,
  ...overrides
})

const SYNC_INTERVAL_MS = 30000
const RETRY_DELAY_MS = 15000
const CHANGE_DEBOUNCE_MS = 2000

export function useInspectionSession() {
  const { supabase, user } = useSupabase()
  const loading = ref(false)
  const error = ref(null)

  const session = reactive(defaultSessionState())

  const items = ref([])
  const gridColumns = ref(1)
  const syncInProgress = ref(false)
  const pendingSync = ref(false)
  const lastSyncError = ref(null)
  const lastSyncAt = ref(null)
  const notes = ref([])

  let autoSyncTimer = null
  let retryTimer = null
  let changeDebounceTimer = null

  const loadSetParts = async (setId) => {
    try {
      loading.value = true
      error.value = null

      const { data: setData, error: setError } = await supabase
        .from('lego_sets')
        .select('id, name, set_num, theme_id')
        .eq('id', setId)
        .single()

      if (setError) throw setError

      let themeName = null
      if (setData?.theme_id) {
        const { data: themeData, error: themeError } = await supabase
          .from('lego_themes')
          .select('theme_id, name')
          .eq('theme_id', setData.theme_id)
          .maybeSingle()

        if (themeError) {
          console.warn('테마 정보 조회 실패:', themeError)
        } else {
          themeName = themeData?.name || null
        }
      }

      const { data: partsData, error: partsError } = await supabase
        .from('set_parts')
        .select('part_id, color_id, quantity, element_id')
        .eq('set_id', setId)
        .not('color_id', 'is', null) // color_id가 null인 것 제외

      if (partsError) throw partsError

      const { data: partsInfo, error: partsInfoError } = await supabase
        .from('lego_parts')
        .select('part_num, name, part_img_url')
        .in('part_num', [...new Set(partsData.map(p => p.part_id).filter(Boolean))])

      if (partsInfoError) throw partsInfoError

      // color_id로 lego_colors에서 rgb 조회
      const uniqueColorIds = [...new Set(partsData.map(p => p.color_id).filter(id => id !== null && id !== undefined))]
      const { data: colorsInfo, error: colorsError } = await supabase
        .from('lego_colors')
        .select('color_id, name, rgb')
        .in('color_id', uniqueColorIds)

      if (colorsError) throw colorsError

      const { data: masterInfo, error: masterError } = await supabase
        .from('parts_master')
        .select('part_id, shape_tag, expected_stud_count, usage_frequency')
        .in('part_id', [...new Set(partsData.map(p => p.part_id))])

      if (masterError) throw masterError

      const partsMap = new Map(partsInfo.map(p => [p.part_num, p]))
      const colorsMap = new Map(colorsInfo.map(c => [c.color_id, c]))
      const masterMap = new Map((masterInfo || []).map(m => [m.part_id, m]))

      const inspectionItems = partsData.map((part, index) => {
        const partInfo = partsMap.get(part.part_id)
        const colorInfo = colorsMap.get(part.color_id)
        
        
        return createItemState({
          part_id: part.part_id,
          color_id: part.color_id,
          element_id: part.element_id,
          part_name: partInfo?.name || part.part_id,
          color_name: colorInfo?.name || `Color ${part.color_id}`,
          color_rgb: colorInfo?.rgb || null, // lego_colors에서 가져온 rgb
          part_img_url: partInfo?.part_img_url || null,
          total_count: part.quantity,
          checked_count: 0,
          status: 'pending',
          notes: '',
          updated_at: new Date().toISOString(),
          shape_tag: masterMap.get(part.part_id)?.shape_tag || '',
          expected_stud_count: masterMap.get(part.part_id)?.expected_stud_count ?? null,
          usage_frequency: masterMap.get(part.part_id)?.usage_frequency ?? null,
          sequence_index: index
        })
      })

      return {
        setInfo: {
          ...setData,
          theme_name: themeName
        },
        items: inspectionItems
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const enrichItemsMetadata = async (itemList) => {
    if (!itemList || itemList.length === 0) return

    const partIds = [...new Set(itemList.map(item => item.part_id).filter(Boolean))]
    const colorIds = [...new Set(itemList.map(item => item.color_id).filter(id => id !== null && id !== undefined))]

    let partsMap = new Map()
    let colorsMap = new Map()
    let masterMap = new Map()

    if (partIds.length > 0) {
      const [partsResponse, masterResponse] = await Promise.all([
        supabase
          .from('lego_parts')
          .select('part_num, name')
          .in('part_num', partIds),
        supabase
          .from('parts_master')
          .select('part_id, shape_tag, expected_stud_count, usage_frequency')
          .in('part_id', partIds)
      ])

      if (partsResponse.error) {
        throw partsResponse.error
      }

      if (masterResponse.error) {
        throw masterResponse.error
      }

      partsMap = new Map((partsResponse.data || []).map(p => [p.part_num, p]))
      masterMap = new Map((masterResponse.data || []).map(m => [m.part_id, m]))
    }

    if (colorIds.length > 0) {
      const { data: colorsInfo, error: colorsError } = await supabase
        .from('lego_colors')
        .select('color_id, name, rgb')
        .in('color_id', colorIds)

      if (colorsError) {
        throw colorsError
      }

      colorsMap = new Map((colorsInfo || []).map(c => [c.color_id, c]))
    }

    itemList.forEach((item, index) => {
      if (!item) return
      
      // part_id가 없으면 스킵 (color_id는 0일 수도 있으므로 null/undefined만 체크)
      if (!item.part_id || item.color_id === null || item.color_id === undefined) {
        console.warn(`[enrichItemsMetadata] 아이템에 part_id 또는 color_id가 없습니다:`, item)
        return
      }
      
      // 부품명 보강
      if (!item.part_name) {
        const partInfo = partsMap.get(item.part_id)
        if (partInfo) {
          item.part_name = partInfo.name
        } else {
          console.warn(`[enrichItemsMetadata] part_id ${item.part_id}에 대한 부품 정보를 찾을 수 없습니다.`)
        }
      }

      // 색상명 보강
      if (!item.color_name) {
        const colorInfo = colorsMap.get(item.color_id)
        if (colorInfo) {
          item.color_name = colorInfo.name
        } else {
          console.warn(`[enrichItemsMetadata] color_id ${item.color_id}에 대한 색상 정보를 찾을 수 없습니다.`)
          item.color_name = `Color ${item.color_id}`
        }
      }

      // RGB 보강
      if (!item.color_rgb) {
        const colorInfo = colorsMap.get(item.color_id)
        if (colorInfo && colorInfo.rgb) {
          item.color_rgb = colorInfo.rgb
        } else {
          console.warn(`[enrichItemsMetadata] color_id ${item.color_id}에 대한 RGB 정보를 찾을 수 없습니다.`)
        }
      } else {
        // RGB가 이미 있으면, 해당 color_id의 RGB와 일치하는지 검증
        const colorInfo = colorsMap.get(item.color_id)
        if (colorInfo && colorInfo.rgb && item.color_rgb !== colorInfo.rgb) {
          console.warn(`[enrichItemsMetadata] color_id ${item.color_id}의 RGB 불일치: 저장된 값=${item.color_rgb}, DB 값=${colorInfo.rgb}. DB 값으로 업데이트합니다.`)
          item.color_rgb = colorInfo.rgb
        }
      }

      // 메타데이터 보강
      if (!item.shape_tag || item.shape_tag.length === 0) {
        const masterInfo = masterMap.get(item.part_id)
        if (masterInfo) {
          item.shape_tag = masterInfo.shape_tag || ''
          item.expected_stud_count = masterInfo.expected_stud_count ?? item.expected_stud_count
          item.usage_frequency = masterInfo.usage_frequency ?? item.usage_frequency
        }
      }

      if (item.sequence_index === undefined || item.sequence_index === null) {
        item.sequence_index = index
      }

      if (!item.updated_at) {
        item.updated_at = new Date().toISOString()
      }
    })
  }

  const createSession = async (setId) => {
    try {
      loading.value = true
      error.value = null

      if (!user.value) {
        // 로그인 필요 에러는 error.value에 설정하지 않음 (모달로 처리)
        throw new Error('로그인이 필요합니다')
      }

      // 동일 제품의 모든 활성 세션을 paused로 변경 (하나의 진행 상태만 유지)
      try {
        const { data: existingSessions, error: checkError } = await supabase
          .from('inspection_sessions')
          .select('id, status')
          .eq('set_id', setId)
          .eq('user_id', user.value.id)
          .in('status', ['in_progress', 'paused'])

        if (!checkError && existingSessions && existingSessions.length > 0) {
          // 모든 활성 세션을 paused로 변경
          const sessionIds = existingSessions.map(s => s.id)
          await supabase
            .from('inspection_sessions')
            .update({ status: 'paused', updated_at: new Date().toISOString() })
            .in('id', sessionIds)
          
          console.log(`[세션 생성] 동일 제품의 ${sessionIds.length}개 활성 세션을 paused로 변경`)
        }
      } catch (err) {
        console.warn('기존 세션 확인 실패:', err)
      }

      const { setInfo, items: setItems } = await loadSetParts(setId)

      const newSession = {
        id: crypto.randomUUID(),
        set_id: setId,
        set_name: setInfo.name,
        set_num: setInfo.set_num || null,
        set_theme_name: setInfo.theme_name || null,
        user_id: user.value.id,
        status: 'in_progress',
        progress: 0,
        started_at: new Date().toISOString(),
        last_saved_at: new Date().toISOString(),
        completed_at: null,
        updated_at: new Date().toISOString()
      }

      Object.assign(session, newSession)
      items.value = setItems.map(item => ({
        ...item,
        session_id: newSession.id,
        id: crypto.randomUUID(),
      }))

      session.last_saved_at = new Date().toISOString()
      session.updated_at = session.last_saved_at

      await syncToServer({ forceFullSync: true })

      await loadSetNotes(newSession.set_id)

      startAutoSyncTimer()

      return newSession
    } catch (err) {
      // 로그인 필요 에러는 error.value에 설정하지 않음 (모달로 처리)
      if (!err.message || !err.message.includes('로그인이 필요')) {
        error.value = err.message
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadSession = async (sessionId) => {
    try {
      loading.value = true
      error.value = null

      const { data: sessionData, error: sessionError } = await supabase
        .from('inspection_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle()

      if (sessionError) throw sessionError
      if (!sessionData) {
        throw new Error('세션을 찾을 수 없습니다')
      }

      Object.assign(session, defaultSessionState(), sessionData)
      session.last_saved_at = session.last_saved_at || session.updated_at || new Date().toISOString()

      await hydrateSessionSetMetadata(supabase, session)

      const { data: itemsData, error: itemsError } = await supabase
        .from('inspection_items')
        .select('*')
        .eq('session_id', sessionId)
        .order('updated_at', { ascending: true })

      if (itemsError) throw itemsError

      const normalizedItems = (itemsData || []).map((remoteItem, index) =>
        createItemState({
          ...remoteItem,
          id: remoteItem.id || crypto.randomUUID(),
          session_id: remoteItem.session_id || sessionId,
          sequence_index: remoteItem.sequence_index ?? index,
          updated_at: remoteItem.updated_at || new Date().toISOString()
        })
      )

      await enrichItemsMetadata(normalizedItems)
      items.value = normalizedItems

      // 세션 로드 후 동일 제품의 다른 활성 세션을 paused로 변경 (하나의 진행 상태만 유지)
      if (session.set_id && user.value) {
        try {
          const { data: otherSessions, error: checkError } = await supabase
            .from('inspection_sessions')
            .select('id, status')
            .eq('set_id', session.set_id)
            .eq('user_id', user.value.id)
            .in('status', ['in_progress', 'paused'])
            .neq('id', sessionId)

          if (!checkError && otherSessions && otherSessions.length > 0) {
            const otherSessionIds = otherSessions.map(s => s.id)
            await supabase
              .from('inspection_sessions')
              .update({ status: 'paused', updated_at: new Date().toISOString() })
              .in('id', otherSessionIds)
            
            console.log(`[세션 로드] 동일 제품의 ${otherSessionIds.length}개 활성 세션을 paused로 변경`)
          }
        } catch (err) {
          console.warn('동일 제품 세션 확인 실패:', err)
        }
      }

      try {
        await loadSetNotes(session.set_id)
      } catch (err) {
        // 노트 로드 실패 시 빈 배열로 계속 진행 (조용히 처리)
        if (import.meta.env.DEV) {
          console.warn('세트 노트 로드 실패:', err.message)
        }
        notes.value = []
      }

      startAutoSyncTimer()

      return { session, items: items.value }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadSetNotes = async (setId) => {
    if (!setId) {
      notes.value = []
      return
    }

    try {
      const { data, error: notesError } = await supabase
        .from('set_inspection_notes')
        .select('*')
        .eq('set_id', setId)
        .order('created_at', { ascending: false })

      if (notesError) throw notesError

      notes.value = Array.isArray(data) ? data : []
    } catch (err) {
      // 개발 환경에서만 에러 출력
      if (import.meta.env.DEV) {
        console.warn('세트 노트 로드 실패:', err.message)
      }
      notes.value = []
    }
  }

  const addSetNote = async ({ setId, noteType, noteText, partId }) => {
    if (!setId || !user.value) throw new Error('노트를 추가하려면 세션 정보가 필요합니다')

    const payload = {
      set_id: setId,
      note_type: noteType,
      note_text: noteText,
      part_id: partId || null,
      created_by: user.value.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error: insertError } = await supabase
      .from('set_inspection_notes')
      .insert(payload)
      .select()
      .single()

    if (insertError) throw insertError

    if (data) {
      notes.value = [data, ...notes.value]
    }

    return data
  }

  const deleteSetNote = async ({ noteId }) => {
    if (!noteId) return

    const { error: deleteError } = await supabase
      .from('set_inspection_notes')
      .delete()
      .eq('id', noteId)

    if (deleteError) throw deleteError

    notes.value = notes.value.filter(note => note.id !== noteId)
  }

  const updateItem = (index, updates) => {
    const item = items.value[index]
    if (!item) return

    Object.assign(item, updates, {
      updated_at: new Date().toISOString()
    })
    session.last_active_item_id = item.id
    updateProgress()
    session.last_saved_at = new Date().toISOString()
    session.updated_at = session.last_saved_at
    scheduleDebouncedSync()
  }

  const updateProgress = () => {
    const total = items.value.length
    const checked = items.value.filter(i => i.status === 'checked').length
    session.progress = total > 0 ? Math.round((checked / total) * 100) : 0
    session.updated_at = new Date().toISOString()
  }

  const syncToServer = async ({ forceFullSync = false } = {}) => {
    try {
      if (!session.id || !user.value) return

      if (syncInProgress.value) {
        pendingSync.value = true
        return
      }

      syncInProgress.value = true
      pendingSync.value = false
      lastSyncError.value = null
      clearRetryTimer()

      const now = new Date().toISOString()
      session.last_saved_at = now
      session.updated_at = now

      const sessionUserId = session.user_id || user.value.id
      const sessionPayload = {
        id: session.id,
        set_id: session.set_id,
        user_id: sessionUserId,
        status: session.status,
        progress: session.progress,
        started_at: session.started_at || now,
        last_saved_at: session.last_saved_at,
        completed_at: session.completed_at,
        updated_at: session.updated_at
      }

      const { error: sessionError } = await supabase
        .from('inspection_sessions')
        .upsert(sessionPayload, { onConflict: 'id' })

      if (sessionError) throw sessionError

      session.user_id = sessionUserId

      // 세션 상태가 in_progress로 동기화된 경우, 동일 제품의 다른 활성 세션을 paused로 변경
      if (session.status === 'in_progress' && session.set_id && user.value) {
        try {
          const { data: otherSessions, error: checkError } = await supabase
            .from('inspection_sessions')
            .select('id, status')
            .eq('set_id', session.set_id)
            .eq('user_id', user.value.id)
            .in('status', ['in_progress', 'paused'])
            .neq('id', session.id)

          if (!checkError && otherSessions && otherSessions.length > 0) {
            const otherSessionIds = otherSessions.map(s => s.id)
            await supabase
              .from('inspection_sessions')
              .update({ status: 'paused', updated_at: new Date().toISOString() })
              .in('id', otherSessionIds)

            console.log(`[세션 동기화] 동일 제품의 ${otherSessionIds.length}개 활성 세션을 paused로 변경`)
          }
        } catch (err) {
          console.warn('동일 제품 세션 확인 실패:', err)
        }
      }

      if (items.value.length > 0) {
        const itemsPayload = items.value.map(item => ({
          id: item.id || crypto.randomUUID(),
          session_id: session.id,
          part_id: item.part_id,
          color_id: item.color_id,
          element_id: item.element_id || null,
          checked_count: item.checked_count,
          total_count: item.total_count,
          status: item.status || 'pending',
          notes: item.notes || null,
          updated_at: item.updated_at || new Date().toISOString()
        }))

        const { error: itemsError } = await supabase
          .from('inspection_items')
          .upsert(itemsPayload, { onConflict: 'id' })

        if (itemsError) throw itemsError
      }

      session.user_id = user.value.id
      lastSyncAt.value = session.updated_at
    } catch (err) {
      console.error('서버 동기화 실패:', err)
      lastSyncError.value = err.message
      // 프로덕션 모드에서는 재시도 스케줄링하지 않음
      if (import.meta.env.DEV) {
        scheduleRetry()
      }
    } finally {
      syncInProgress.value = false
      if (pendingSync.value) {
        pendingSync.value = false
        queueMicrotask(() => {
          syncToServer().catch(() => {})
        })
      }
    }
  }

  const pauseSession = async () => {
    try {
      session.status = 'paused'
      session.last_saved_at = new Date().toISOString()
      
      console.log(`[임시 저장] 세션 ${session.id?.substring(0, 8)}... 시작, 총 아이템: ${items.value.length}`)
      const statusCounts = items.value.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      }, {})
      console.log(`[임시 저장] 상태 분포:`, statusCounts)

      await syncToServer({ forceFullSync: true })
      
      console.log(`[임시 저장] 완료`)
    } catch (err) {
      console.error('[임시 저장] 실패:', err)
      throw err
    }
  }

  const completeSession = async () => {
    session.status = 'completed'
    session.completed_at = new Date().toISOString()
    
    // 최종 progress 계산: (checked_count / total_count) * 100
    updateProgress()
    
    // 누락 부품 수 집계: COUNT(*) WHERE status='missing'
    const missingCount = items.value.filter(item => item.status === 'missing').length
    
    // 소요 시간 계산: completed_at - started_at
    const startedAt = session.started_at ? new Date(session.started_at).getTime() : Date.now()
    const completedAt = new Date(session.completed_at).getTime()
    const durationSeconds = Math.floor((completedAt - startedAt) / 1000)
    
    // 세션 메타데이터에 저장
    session.missing_count = missingCount
    session.duration_seconds = durationSeconds
    
    await syncToServer({ forceFullSync: true })
  }

  const completeSessionById = async (sessionId) => {
    if (!sessionId) return

    try {
      // 서버에 완료 상태 업데이트
      const { error } = await supabase
        .from('inspection_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (error) {
        console.warn('서버 세션 완료 처리 실패:', error)
      }
    } catch (err) {
      console.error('세션 완료 처리 실패:', err)
      throw err
    }
  }

  const resetSessionState = async () => {
    pendingSync.value = false
    syncInProgress.value = false
    lastSyncError.value = null
    lastSyncAt.value = null

    Object.assign(session, defaultSessionState())
    items.value = []
    notes.value = []
  }

  const findLastSession = async (userId = null) => {
    try {
      const targetUserId = userId || user.value?.id

      if (!targetUserId) {
        return null
      }

      const currentSessionId = session.id

      let query = supabase
        .from('inspection_sessions')
        .select(`
          id,
          set_id,
          status,
          progress,
          started_at,
          last_saved_at,
          completed_at,
          lego_sets:set_id (
            name,
            set_num
          )
        `)
        .eq('user_id', targetUserId)
        .in('status', ['in_progress', 'paused'])
        .order('last_saved_at', { ascending: false })
        .limit(1)

      if (currentSessionId) {
        query = query.neq('id', currentSessionId)
      }

      const { data: serverSessions, error: serverError } = await query

      if (serverError) {
        console.warn('[findLastSession] 서버 쿼리 오류', serverError)
        return null
      }

      if (!serverSessions || serverSessions.length === 0) {
        return null
      }

      const serverSession = serverSessions[0]
          const sessionData = {
            id: serverSession.id,
            set_id: serverSession.set_id,
            set_name: serverSession.lego_sets?.name || '세트명 없음',
            user_id: targetUserId,
            status: serverSession.status,
            progress: serverSession.progress || 0,
            started_at: serverSession.started_at,
            last_saved_at: serverSession.last_saved_at,
            completed_at: serverSession.completed_at,
            updated_at: serverSession.last_saved_at || serverSession.started_at
          }

      await hydrateSessionSetMetadata(supabase, sessionData)
      return sessionData
    } catch (err) {
      console.error('마지막 세션 찾기 실패:', err)
      return null
    }
  }

  const progress = computed(() => session.progress)
  const missingCount = computed(() => 
    items.value.filter(i => i.status === 'missing').length
  )

  const startAutoSyncTimer = () => {
    clearAutoSyncTimer()
    if (!session.id) return
    autoSyncTimer = setInterval(() => {
      syncToServer().catch(() => {})
    }, SYNC_INTERVAL_MS)
  }

  const clearAutoSyncTimer = () => {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer)
      autoSyncTimer = null
    }
  }

  const scheduleRetry = () => {
    if (retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      syncToServer().catch(() => {})
    }, RETRY_DELAY_MS)
  }

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const scheduleDebouncedSync = () => {
    if (changeDebounceTimer) {
      clearTimeout(changeDebounceTimer)
    }
    changeDebounceTimer = setTimeout(() => {
      changeDebounceTimer = null
      syncToServer().catch(() => {})
    }, CHANGE_DEBOUNCE_MS)
  }

  watch(() => session.id, (newId, oldId) => {
    if (newId && newId !== oldId) {
      startAutoSyncTimer()
    }
    if (!newId) {
      clearAutoSyncTimer()
      clearRetryTimer()
    }
  })

  watch(() => session.set_id, (newSetId) => {
    if (newSetId) {
      loadSetNotes(newSetId).catch(() => {})
    } else {
      notes.value = []
    }
  })

  onUnmounted(() => {
    clearAutoSyncTimer()
    clearRetryTimer()
    if (changeDebounceTimer) {
      clearTimeout(changeDebounceTimer)
      changeDebounceTimer = null
    }
  })

  return {
    loading,
    error,
    session,
    items,
    gridColumns,
    progress,
    missingCount,
    notes,
    createSession,
    loadSession,
    updateItem,
    pauseSession,
    completeSession,
    loadSetNotes,
    addSetNote,
    deleteSetNote,
    resetSessionState,
    findLastSession,
    completeSessionById,
    syncToServer,
    syncInProgress,
    lastSyncError,
    lastSyncAt
  }
}

