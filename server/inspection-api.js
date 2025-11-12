import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const PORT = Number(process.env.INSPECTION_API_PORT) || 3045
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

console.log('[Inspection API] 환경 변수 확인:')
console.log('  SUPABASE_URL:', SUPABASE_URL ? `${SUPABASE_URL.substring(0, 30)}...` : 'NOT SET')
console.log('  SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? `${SUPABASE_SERVICE_KEY.substring(0, 20)}...` : 'NOT SET')

if (!SUPABASE_SERVICE_KEY) {
  console.warn('[Inspection API] SUPABASE 서비스 키가 설정되지 않았습니다. 읽기 전용 모드로 동작할 수 있습니다.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

const NOTE_TYPES = new Set(['missing_frequent', 'caution', 'tip', 'general'])

const scrub = (payload) => {
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value
    }
    return acc
  }, {})
}

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Inspection API',
    port: PORT,
    timestamp: new Date().toISOString()
  })
})

app.get('/api/inspection', async (req, res) => {
  const sessionId = req.query.session_id

  if (!sessionId) {
    return res.status(400).json({ error: 'session_id is required' })
  }

  try {
    if (!SUPABASE_SERVICE_KEY) {
      console.error('[Inspection API] SUPABASE_SERVICE_KEY가 설정되지 않았습니다.')
      return res.status(500).json({ error: 'Supabase 서비스 키가 설정되지 않았습니다' })
    }

    const { data: session, error: sessionError } = await supabase
      .from('inspection_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionError) {
      console.error('[Inspection API] 세션 조회 실패:', sessionError)
      return res.status(500).json({ error: sessionError.message, code: sessionError.code })
    }

    if (!session) {
      return res.json({ session: null, items: [] })
    }

    const { data: items, error: itemsError } = await supabase
      .from('inspection_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: true })

    if (itemsError) {
      console.error('[Inspection API] 아이템 조회 실패:', itemsError)
      return res.status(500).json({ error: itemsError.message, code: itemsError.code })
    }

    return res.json({ session, items: items || [] })
  } catch (error) {
    console.error('[Inspection API] GET /api/inspection 실패:', error)
    return res.status(500).json({ error: error.message || 'failed_to_fetch_session' })
  }
})

app.post('/api/inspection', async (req, res) => {
  const {
    session_id: sessionId,
    set_id: setId,
    user_id: userId,
    status = 'in_progress',
    progress = 0,
    started_at: startedAt,
    last_saved_at: lastSavedAt,
    completed_at: completedAt,
    is_synced: isSynced = false,
    device_local_id: deviceLocalId
  } = req.body || {}

  if (!sessionId || !setId || !userId) {
    return res.status(400).json({ error: 'session_id, set_id, user_id are required' })
  }

  console.log('[Inspection API] POST /api/inspection - 세션 생성/업데이트:', { sessionId, setId, userId })

  try {
    const now = new Date().toISOString()
    const payload = scrub({
      id: sessionId,
      set_id: setId,
      user_id: userId,
      status,
      progress,
      started_at: startedAt || now,
      last_saved_at: lastSavedAt || now,
      completed_at: completedAt || null,
      device_local_id: deviceLocalId || null,
      updated_at: now
    })

    const { data, error } = await supabase
      .from('inspection_sessions')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error('[Inspection API] Supabase 오류:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log('[Inspection API] POST /api/inspection - 성공')
    return res.json({ session: data })
  } catch (error) {
    console.error('[Inspection API] POST /api/inspection 실패:', error)
    return res.status(500).json({ error: 'failed_to_upsert_session' })
  }
})

app.put('/api/inspection', async (req, res) => {
  const { session_id: sessionId, items } = req.body || {}

  if (!sessionId) {
    return res.status(400).json({ error: 'session_id is required' })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.json({ items: [] })
  }

  try {
    const now = new Date().toISOString()
const sanitizedItems = items.map((item) => scrub({
      id: item.id || randomUUID(),
      session_id: sessionId,
      part_id: item.part_id,
      color_id: item.color_id,
      element_id: item.element_id ?? null,
      checked_count: item.checked_count ?? 0,
      total_count: item.total_count ?? 0,
      status: item.status || 'pending',
      notes: item.notes ?? null,
      is_dirty: false, // 🔧 수정됨
      updated_at: item.updated_at || now
    }))

    const { data, error } = await supabase
      .from('inspection_items')
      .upsert(sanitizedItems, { onConflict: 'id' })
      .select()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ items: data || [] })
  } catch (error) {
    console.error('[Inspection API] PUT /api/inspection 실패:', error)
    return res.status(500).json({ error: 'failed_to_upsert_items' })
  }
})

app.get('/api/inspection/notes', async (req, res) => {
  const setId = req.query.set_id

  if (!setId) {
    return res.status(400).json({ error: 'set_id is required' })
  }

  console.log('[Inspection API] GET /api/inspection/notes - 노트 조회:', { setId })

  try {
    if (!SUPABASE_SERVICE_KEY) {
      console.error('[Inspection API] SUPABASE_SERVICE_KEY가 설정되지 않았습니다.')
      return res.status(500).json({ error: 'Supabase 서비스 키가 설정되지 않았습니다' })
    }

    const { data, error } = await supabase
      .from('set_inspection_notes')
      .select('*')
      .eq('set_id', setId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Inspection API] Supabase 오류 (notes):', error)
      return res.status(500).json({ error: error.message, code: error.code })
    }

    console.log(`[Inspection API] GET /api/inspection/notes - 성공, ${data?.length || 0}개 노트`)
    return res.json({ notes: data || [] })
  } catch (error) {
    console.error('[Inspection API] GET /api/inspection/notes 실패:', error)
    return res.status(500).json({ error: error.message || 'failed_to_fetch_notes' })
  }
})

app.post('/api/inspection/notes', async (req, res) => {
  const {
    set_id: setId,
    note_type: noteType,
    note_text: noteText,
    part_id: partId = null,
    created_by: createdBy
  } = req.body || {}

  if (!setId || !noteType || !noteText || !createdBy) {
    return res.status(400).json({ error: 'set_id, note_type, note_text, created_by are required' })
  }

  if (!NOTE_TYPES.has(noteType)) {
    return res.status(400).json({ error: 'invalid_note_type' })
  }

  try {
    const now = new Date().toISOString()
    const payload = scrub({
      set_id: setId,
      note_type: noteType,
      note_text: noteText,
      part_id: partId,
      created_by: createdBy,
      created_at: now,
      updated_at: now
    })

    const { data, error } = await supabase
      .from('set_inspection_notes')
      .insert(payload)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ note: data })
  } catch (error) {
    console.error('[Inspection API] POST /api/inspection/notes 실패:', error)
    return res.status(500).json({ error: 'failed_to_create_note' })
  }
})

app.delete('/api/inspection/notes', async (req, res) => {
  const noteId = req.query.note_id

  if (!noteId) {
    return res.status(400).json({ error: 'note_id is required' })
  }

  try {
    const { error } = await supabase
      .from('set_inspection_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true })
  } catch (error) {
    console.error('[Inspection API] DELETE /api/inspection/notes 실패:', error)
    return res.status(500).json({ error: 'failed_to_delete_note' })
  }
})

app.listen(PORT, () => {
  console.log(`🧱 Inspection API 서버가 포트 ${PORT}에서 실행 중입니다.`)
})

