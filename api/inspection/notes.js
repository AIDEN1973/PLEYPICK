import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('[Inspection Notes API] Supabase credentials not configured')
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!supabase) {
    console.error('[Inspection Notes API] Supabase credentials not configured')
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  try {
    if (req.method === 'GET') {
      const { set_id } = req.query
      if (!set_id) {
        return res.status(400).json({ error: 'set_id는 필수입니다.' })
      }

      const { data, error } = await supabase
        .from('set_inspection_notes')
        .select('*')
        .eq('set_id', set_id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return res.status(200).json({ notes: data || [] })
    }

    if (req.method === 'POST') {
      const { set_id, note_type, note_text, part_id, created_by } = req.body || {}

      if (!set_id || !note_type || !note_text || !created_by) {
        return res.status(400).json({ error: 'set_id, note_type, note_text, created_by는 필수입니다.' })
      }

      const insertPayload = {
        set_id,
        note_type,
        note_text,
        part_id: part_id || null,
        created_by
      }

      const { data, error } = await supabase
        .from('set_inspection_notes')
        .insert(insertPayload)
        .select('*')
        .single()

      if (error) throw error

      return res.status(201).json({ note: data })
    }

    if (req.method === 'DELETE') {
      const { note_id } = req.query
      if (!note_id) {
        return res.status(400).json({ error: 'note_id는 필수입니다.' })
      }

      const { error } = await supabase
        .from('set_inspection_notes')
        .delete()
        .eq('id', note_id)

      if (error) throw error

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Inspection notes API 오류:', error)
    res.status(500).json({ error: error.message })
  }
}

