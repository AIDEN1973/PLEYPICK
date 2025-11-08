import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useSupabase } from './useSupabase'
import localforage from 'localforage'

const INSPECTION_DB = 'brickbox_inspection'
const SESSION_STORE = 'inspection_sessions'
const ITEMS_STORE = 'inspection_items'

const sessionStore = localforage.createInstance({
  name: INSPECTION_DB,
  storeName: SESSION_STORE
})

const itemsStore = localforage.createInstance({
  name: INSPECTION_DB,
  storeName: ITEMS_STORE
})

const defaultSessionState = () => ({
  id: null,
  set_id: null,
  set_name: null,
  user_id: null,
  status: 'in_progress',
  progress: 0,
  started_at: null,
  last_saved_at: null,
  completed_at: null,
  is_synced: false,
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
  is_dirty: true,
  updated_at: new Date().toISOString(),
  shape_tag: '',
  expected_stud_count: null,
  usage_frequency: null,
  sequence_index: 0,
  part_img_url: null,
  ...overrides
}) // 🔧 수정됨

const SYNC_INTERVAL_MS = 30000
const RETRY_DELAY_MS = 15000
const CHANGE_DEBOUNCE_MS = 2000

const callInspectionApi = async ({ method = 'GET', body = null, query = {} }) => {
  const searchParams = new URLSearchParams(query)
  const endpoint = `/api/inspection${searchParams.toString() ? `?${searchParams}` : ''}`

  const response = await fetch(endpoint, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })

  let payload = null
  try {
    payload = await response.json()
  } catch (_) {
    payload = null
  }

  if (!response.ok) {
    const message = payload?.error || `Inspection API ${method} 실패`
    throw new Error(message)
  }

  return payload
}

const callNotesApi = async ({ method = 'GET', body = null, query = {} }) => {
  const searchParams = new URLSearchParams(query)
  const endpoint = `/api/inspection/notes${searchParams.toString() ? `?${searchParams}` : ''}`

  const response = await fetch(endpoint, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })

  let payload = null
  try {
    payload = await response.json()
  } catch (_) {
    payload = null
  }

  if (!response.ok) {
    const message = payload?.error || `Inspection notes API ${method} 실패`
    throw new Error(message)
  }

  return payload
}

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
        .select('id, name, set_num')
        .eq('id', setId)
        .single()

      if (setError) throw setError

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
        
        // 디버깅: 특정 element_id인 경우 로그
        if (part.element_id === '6335317' || part.element_id === '306923') {
          console.log(`[loadSetParts] element_id ${part.element_id} 발견:`, {
            part_id: part.part_id,
            color_id: part.color_id,
            colorInfo: colorInfo,
            rgb: colorInfo?.rgb,
            color_name: colorInfo?.name,
            rawPart: part // 원본 데이터 확인
          })
          
          // 같은 part_id를 가진 다른 color_id가 있는지 확인
          const samePartDifferentColor = partsData.filter(p => 
            p.part_id === part.part_id && p.color_id !== part.color_id
          )
          if (samePartDifferentColor.length > 0) {
            console.warn(`[loadSetParts] element_id ${part.element_id}: 같은 part_id(${part.part_id})에 다른 color_id가 있습니다:`, 
              samePartDifferentColor.map(p => ({ element_id: p.element_id, color_id: p.color_id }))
            )
          }
        }
        
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
          is_dirty: false,
          updated_at: new Date().toISOString(),
          shape_tag: masterMap.get(part.part_id)?.shape_tag || '',
          expected_stud_count: masterMap.get(part.part_id)?.expected_stud_count ?? null,
          usage_frequency: masterMap.get(part.part_id)?.usage_frequency ?? null,
          sequence_index: index
        })
      })

      return {
        setInfo: setData,
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

      if (!user.value) throw new Error('로그인이 필요합니다')

      // 🔧 수정됨: 기존 'in_progress' 세션 확인 및 처리
      try {
        const { data: existingSessions, error: checkError } = await supabase
          .from('inspection_sessions')
          .select('id, status')
          .eq('set_id', setId)
          .eq('user_id', user.value.id)
          .eq('status', 'in_progress')
          .limit(1)

        if (!checkError && existingSessions && existingSessions.length > 0) {
          const existingSession = existingSessions[0]
          // 기존 세션을 'paused'로 변경
          await supabase
            .from('inspection_sessions')
            .update({ status: 'paused', updated_at: new Date().toISOString() })
            .eq('id', existingSession.id)
        }
      } catch (err) {
        console.warn('기존 세션 확인 실패:', err)
      }

      const { setInfo, items: setItems } = await loadSetParts(setId)

      const newSession = {
        id: crypto.randomUUID(),
        set_id: setId,
        set_name: setInfo.name,
        user_id: user.value.id,
        status: 'in_progress',
        progress: 0,
        started_at: new Date().toISOString(),
        last_saved_at: new Date().toISOString(),
        completed_at: null,
    is_synced: false,
    updated_at: new Date().toISOString()
      }

      Object.assign(session, newSession)
      items.value = setItems.map(item => ({
        ...item,
        session_id: newSession.id,
        id: crypto.randomUUID()
      }))

      await saveToLocal()

      try { // 🔧 수정됨
        await syncToServer({ forceFullSync: true })
        await loadFromServer(newSession.id)
      } catch (err) {
        console.warn('초기 동기화 실패: 오프라인 모드로 전환합니다.', err)
        lastSyncError.value = err.message
      }

      await loadSetNotes(newSession.set_id)

      startAutoSyncTimer()

      return newSession
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadSession = async (sessionId) => {
    try {
      loading.value = true
      error.value = null

      const localSession = await sessionStore.getItem(sessionId)
      const localItems = await itemsStore.getItem(sessionId)

      if (localSession) {
        const previousSetName = session.set_name
        Object.assign(session, localSession)
        if (!session.set_name && previousSetName) {
          session.set_name = previousSetName
        }
      }

      if (localItems) {
        items.value = localItems.map(item => ({
          ...item,
          is_dirty: item.is_dirty ?? false
        }))
      }

      await loadFromServer(sessionId)
      await loadSetNotes(session.set_id)
      startAutoSyncTimer()

      return { session, items: items.value }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadFromServer = async (sessionId) => {
    try {
      const data = await callInspectionApi({ method: 'GET', query: { session_id: sessionId } })

      if (data?.session) {
        const preservedName = session.set_name
        const currentUpdatedAt = session.updated_at ? new Date(session.updated_at).getTime() : 0
        const incomingUpdatedAt = data.session.updated_at ? new Date(data.session.updated_at).getTime() : 0

        if (incomingUpdatedAt >= currentUpdatedAt) {
          Object.assign(session, data.session)
        }

        if (!session.set_name && preservedName) {
          session.set_name = preservedName
        }
      }

      if (Array.isArray(data?.items)) {
        const localMap = new Map(items.value.map(localItem => [`${localItem.part_id}_${localItem.color_id}`, localItem]))
        const mergedItems = data.items.map(remoteItem => {
          const key = `${remoteItem.part_id}_${remoteItem.color_id}`
          const localItem = localMap.get(key)

          if (!localItem) {
            // 새 아이템인 경우 서버 데이터로 생성하되, 메타데이터 보강 필요
            return createItemState({
              ...remoteItem,
              id: remoteItem.id,
              session_id: remoteItem.session_id || sessionId,
              notes: remoteItem.notes || '',
              is_dirty: false
            })
          }

          const remoteUpdated = remoteItem.updated_at ? new Date(remoteItem.updated_at).getTime() : 0
          const localUpdated = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0

          if (localItem.is_dirty && localUpdated >= remoteUpdated) {
            // 로컬이 더 최신이면 로컬 데이터 유지하되, part_id와 color_id는 서버와 일치해야 함
            return {
              ...localItem,
              part_id: remoteItem.part_id, // 서버의 part_id로 확정
              color_id: remoteItem.color_id, // 서버의 color_id로 확정
              is_dirty: true
            }
          }

          // 서버가 더 최신이거나 동일한 경우, 서버 데이터 우선하되 로컬 메타데이터 보존
          return {
            ...localItem,
            ...remoteItem,
            // 핵심 식별자: 서버 값으로 확정
            part_id: remoteItem.part_id,
            color_id: remoteItem.color_id,
            // 메타데이터: 로컬이 있으면 유지, 없으면 서버 값 사용
            part_name: localItem.part_name || remoteItem.part_name || '',
            color_name: localItem.color_name || remoteItem.color_name || `Color ${remoteItem.color_id}`,
            color_rgb: localItem.color_rgb || remoteItem.color_rgb || null,
            notes: remoteItem.notes ?? localItem.notes,
            shape_tag: localItem.shape_tag || remoteItem.shape_tag || '',
            expected_stud_count: localItem.expected_stud_count ?? remoteItem.expected_stud_count ?? null,
            usage_frequency: localItem.usage_frequency ?? remoteItem.usage_frequency ?? null,
            sequence_index: localItem.sequence_index ?? remoteItem.sequence_index ?? 0,
            is_dirty: false
          }
        })

        const remoteKeys = new Set(data.items.map(item => `${item.part_id}_${item.color_id}`))
        items.value
          .filter(localItem => !remoteKeys.has(`${localItem.part_id}_${localItem.color_id}`))
          .forEach(orphan => {
            mergedItems.push(orphan)
          })

        items.value = mergedItems
        
        // 병합 후 메타데이터 보강 (색상 정보 포함)
        await enrichItemsMetadata(items.value)
      }
    } catch (err) {
      console.warn('서버에서 세션 로드 실패:', err)
    }
  }

  const loadSetNotes = async (setId) => {
    if (!setId) {
      notes.value = []
      return
    }

    try {
      const data = await callNotesApi({ method: 'GET', query: { set_id: setId } })
      notes.value = Array.isArray(data?.notes) ? data.notes : []
    } catch (err) {
      console.error('세트 노트 로드 실패:', err)
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
      created_by: user.value.id
    }

    const data = await callNotesApi({ method: 'POST', body: payload })

    if (data?.note) {
      notes.value = [data.note, ...notes.value]
    }

    return data?.note
  }

  const deleteSetNote = async ({ noteId }) => {
    if (!noteId) return

    await callNotesApi({ method: 'DELETE', query: { note_id: noteId } })
    notes.value = notes.value.filter(note => note.id !== noteId)
  }

  const updateItem = (index, updates) => {
    const item = items.value[index]
    if (!item) return

    Object.assign(item, updates, {
      is_dirty: true,
      updated_at: new Date().toISOString()
    })
    updateProgress()
    saveToLocal()
    scheduleDebouncedSync()
  }

  const updateProgress = () => {
    const total = items.value.length
    const checked = items.value.filter(i => i.status === 'checked').length
    session.progress = total > 0 ? Math.round((checked / total) * 100) : 0
    session.is_dirty = true
    session.updated_at = new Date().toISOString()
  }

  const saveToLocal = async () => {
    try {
      const now = new Date().toISOString()
      session.last_saved_at = now
      session.updated_at = now

      const sessionSnapshot = JSON.parse(JSON.stringify(session)) // 🔧 수정됨
      const itemsSnapshot = items.value.map(item => ({ ...item })) // 🔧 수정됨

      await sessionStore.setItem(session.id, sessionSnapshot)
      await itemsStore.setItem(session.id, itemsSnapshot)
    } catch (err) {
      console.error('로컬 저장 실패:', err)
    }
  }

  const syncToServer = async ({ forceFullSync = false } = {}) => {
    try {
      if (!session.id || !user.value) return

      const dirtyItems = forceFullSync ? items.value : items.value.filter(item => item.is_dirty)
      if (dirtyItems.length === 0 && !session.is_dirty && !forceFullSync) return

      if (syncInProgress.value) {
        pendingSync.value = true
        return
      }

      syncInProgress.value = true
      pendingSync.value = false
      lastSyncError.value = null
      clearRetryTimer()

      await callInspectionApi({
        method: 'POST',
        body: {
          set_id: session.set_id,
          user_id: session.user_id || user.value.id,
          session_id: session.id,
          started_at: session.started_at,
          last_saved_at: session.last_saved_at,
          status: session.status,
          progress: session.progress,
          completed_at: session.completed_at,
          missing_count: session.missing_count,
          duration_seconds: session.duration_seconds
        }
      })

      // forceFullSync일 때는 모든 아이템을 전송
      if (dirtyItems.length > 0 || forceFullSync) {
        const itemsToSync = forceFullSync ? items.value : dirtyItems
        
        if (itemsToSync.length === 0) {
          console.warn(`[동기화] 동기화할 아이템이 없습니다. forceFullSync: ${forceFullSync}, dirtyItems: ${dirtyItems.length}, totalItems: ${items.value.length}`)
        } else {
          const itemsPayload = itemsToSync.map(item => {
            if (!item.id) {
              item.id = crypto.randomUUID()
            }
            return {
              id: item.id,
              part_id: item.part_id,
              color_id: item.color_id,
              element_id: item.element_id || null,
              checked_count: item.checked_count,
              total_count: item.total_count,
              status: item.status || 'pending',
              notes: item.notes || null,
              updated_at: item.updated_at || new Date().toISOString()
            }
          })

          // 디버깅: 전송되는 아이템 상태 확인
          const statusCounts = itemsPayload.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1
            return acc
          }, {})
          console.log(`[동기화] 세션 ${session.id.substring(0, 8)}... ${itemsPayload.length}개 아이템 전송 (forceFullSync: ${forceFullSync}), 상태 분포:`, statusCounts)

          await callInspectionApi({
            method: 'PUT',
            body: {
              session_id: session.id,
              items: itemsPayload
            }
          })

          itemsToSync.forEach(item => {
            item.is_dirty = false
          })
        }
      }

      session.user_id = user.value.id
      session.is_synced = true
      session.updated_at = new Date().toISOString()
      await saveToLocal()
      lastSyncAt.value = session.updated_at
    } catch (err) {
      console.error('서버 동기화 실패:', err)
      session.is_synced = false
      lastSyncError.value = err.message
      scheduleRetry()
      throw err
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
      session.is_dirty = true
      session.last_saved_at = new Date().toISOString()
      
      // 모든 아이템을 dirty로 표시하여 강제 동기화
      items.value.forEach(item => {
        item.is_dirty = true
      })
      
      await saveToLocal()
      
      console.log(`[임시 저장] 세션 ${session.id?.substring(0, 8)}... 시작, 총 아이템: ${items.value.length}`)
      const statusCounts = items.value.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      }, {})
      console.log(`[임시 저장] 로컬 상태 분포:`, statusCounts)
      
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
    session.is_dirty = true
    
    // 최종 progress 계산: (checked_count / total_count) * 100
    updateProgress()
    
    // 누락 부품 수 집계: COUNT(*) WHERE status='missing'
    const missingCount = items.value.filter(item => item.status === 'missing').length
    
    // 소요 시간 계산: completed_at - started_at
    const startedAt = session.started_at ? new Date(session.started_at).getTime() : Date.now()
    const completedAt = new Date(session.completed_at).getTime()
    const durationSeconds = Math.floor((completedAt - startedAt) / 1000)
    
    // 세션 메타데이터에 저장 (필요시 DB에 추가 컬럼으로 저장 가능)
    session.missing_count = missingCount
    session.duration_seconds = durationSeconds
    
    await saveToLocal()
    await syncToServer({ forceFullSync: true })
  }

  const resetSessionState = async ({ clearLocal = false } = {}) => {
    const currentId = session.id
    pendingSync.value = false
    syncInProgress.value = false
    lastSyncError.value = null
    lastSyncAt.value = null

    if (clearLocal && currentId) {
      try {
        await sessionStore.removeItem(currentId)
        await itemsStore.removeItem(currentId)
      } catch (err) {
        console.warn('로컬 세션 제거 실패:', err)
      }
    }

    Object.assign(session, defaultSessionState())
    items.value = []
    notes.value = []
  }

  const findLastSession = async () => {
    try {
      if (!user.value) return null

      // 1. 로컬 IndexedDB에서 먼저 확인
      const keys = await sessionStore.keys()
      if (keys.length > 0) {
        const sessions = await Promise.all(
          keys.map(key => sessionStore.getItem(key))
        )

        const userSessions = sessions.filter(s => 
          s && s.user_id === user.value?.id
        )

        if (userSessions.length > 0) {
          const lastSession = userSessions
            .filter(s => s.status === 'in_progress' || s.status === 'paused')
            .sort((a, b) => new Date(b.last_saved_at || b.started_at) - new Date(a.last_saved_at || a.started_at))[0]

          if (lastSession) {
            return lastSession
          }
        }
      }

      // 2. 로컬에 없으면 서버에서 진행 중인 세션 확인 (다른 단말기 동기화)
      try {
        const { data: serverSessions, error: serverError } = await supabase
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
          .eq('user_id', user.value.id)
          .in('status', ['in_progress', 'paused'])
          .order('last_saved_at', { ascending: false })
          .limit(1)

        if (!serverError && serverSessions && serverSessions.length > 0) {
          const serverSession = serverSessions[0]
          const sessionData = {
            id: serverSession.id,
            set_id: serverSession.set_id,
            set_name: serverSession.lego_sets?.name || '세트명 없음',
            user_id: user.value.id,
            status: serverSession.status,
            progress: serverSession.progress || 0,
            started_at: serverSession.started_at,
            last_saved_at: serverSession.last_saved_at,
            completed_at: serverSession.completed_at,
            is_synced: true,
            updated_at: serverSession.last_saved_at || serverSession.started_at
          }

          // 서버에서 찾은 세션을 로컬에도 저장
          await sessionStore.setItem(sessionData.id, sessionData)

          return sessionData
        }
      } catch (serverErr) {
        console.warn('서버에서 세션 찾기 실패:', serverErr)
      }

      return null
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
    saveToLocal,
    syncToServer,
    syncInProgress,
    lastSyncError,
    lastSyncAt
  }
}

