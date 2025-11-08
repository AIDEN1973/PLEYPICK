import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

const methodNotAllowed = (res) => res.status(405).json({ success: false, error: 'Method not allowed' })

const ensureClient = (res) => {
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase credentials not configured' })
    return false
  }
  return true
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  switch (req.method) {
    case 'POST':
      return await handleCreateSession(req, res)
    case 'PUT':
      return await handleUpsertItems(req, res)
    case 'GET':
      return await handleFetchSession(req, res)
    default:
      return methodNotAllowed(res)
  }
}

async function handleCreateSession(req, res) {
  if (!ensureClient(res)) return

  const {
    set_id,
    user_id,
    session_id,
    started_at,
    last_saved_at,
    progress,
    status,
    completed_at,
    missing_count,
    duration_seconds
  } = req.body || {}

  if (!set_id || !user_id || !session_id) {
    return res.status(400).json({ success: false, error: 'set_id, user_id, session_id는 필수입니다.' })
  }

  try {
    const sessionPayload = {
      id: session_id,
      set_id,
      user_id,
      status: status || 'in_progress',
      started_at: started_at || new Date().toISOString(),
      last_saved_at: last_saved_at || new Date().toISOString(),
      is_synced: true,
      updated_at: new Date().toISOString()
    }

    if (typeof progress === 'number') {
      sessionPayload.progress = progress
    }

    if (completed_at !== undefined) {
      sessionPayload.completed_at = completed_at
    }

    // 누락 부품 수 및 소요 시간 (계산된 값, 선택적 저장)
    if (typeof missing_count === 'number') {
      sessionPayload.missing_count = missing_count
    }
    if (typeof duration_seconds === 'number') {
      sessionPayload.duration_seconds = duration_seconds
    }

    const { error } = await supabase
      .from('inspection_sessions')
      .upsert(sessionPayload, { onConflict: 'id' })

    if (error) throw error

    return res.status(200).json({ success: true, session: sessionPayload })
  } catch (error) {
    console.error('[inspection:create] 실패', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}

async function handleUpsertItems(req, res) {
  if (!ensureClient(res)) return

  const { session_id, items } = req.body || {}

  if (!session_id || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'session_id와 items 배열이 필요합니다.' })
  }

  if (items.length === 0) {
    return res.status(200).json({ success: true, items: [] })
  }

  try {
    const sanitizedItems = items.map((item) => ({
      id: item.id || undefined,
      session_id,
      part_id: item.part_id,
      color_id: item.color_id,
      element_id: item.element_id || null,
      checked_count: item.checked_count ?? 0,
      total_count: item.total_count,
      status: item.status || 'pending',
      notes: item.notes || null,
      is_dirty: false,
      updated_at: item.updated_at || new Date().toISOString()
    }))

    // 디버깅: 저장되는 아이템 상태 확인
    const statusCounts = sanitizedItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {})
    console.log(`[API] 세션 ${session_id.substring(0, 8)}... ${sanitizedItems.length}개 아이템 저장, 상태 분포:`, statusCounts)

    const { data, error } = await supabase
      .from('inspection_items')
      .upsert(sanitizedItems, { onConflict: 'id' })
      .select()

    if (error) throw error

    // 디버깅: 저장 후 반환되는 데이터 상태 확인
    if (data && data.length > 0) {
      const savedStatusCounts = data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      }, {})
      console.log(`[API] 저장 완료 후 반환 데이터 상태 분포:`, savedStatusCounts)
    }

    return res.status(200).json({ success: true, items: data || [] })
  } catch (error) {
    console.error('[inspection:upsertItems] 실패', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}

async function handleFetchSession(req, res) {
  if (!ensureClient(res)) return

  const { session_id } = req.query

  if (!session_id) {
    return res.status(400).json({ success: false, error: 'session_id 쿼리 파라미터가 필요합니다.' })
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('inspection_sessions')
      .select('*')
      .eq('id', session_id)
      .maybeSingle()

    if (sessionError) throw sessionError

    if (!sessionData) {
      return res.status(404).json({ success: false, error: '세션을 찾을 수 없습니다.' })
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('inspection_items')
      .select('*')
      .eq('session_id', session_id)

    if (itemsError) throw itemsError

    return res.status(200).json({ success: true, session: sessionData, items: itemsData ?? [] })
  } catch (error) {
    console.error('[inspection:fetch] 실패', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}


