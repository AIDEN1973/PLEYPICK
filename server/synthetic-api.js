import express from 'express'
import cors from 'cors'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import net from 'net'

// 환경 변수 로드
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// 인코딩 설정
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// CORS 설정 (localhost:3000에서의 요청 허용)
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  credentials: true
}))
// 캐시 비활성화 (ETag로 304 반환 방지)
app.set('etag', false)
// 정적 파일 제공: 생성된 합성 이미지 제공 (프록시 경로 하위로 제공)
app.use('/api/synthetic/static', express.static(path.join(__dirname, '..', 'output')))

// Supabase 클라이언트 설정
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
  console.error('VITE_SUPABASE_URL:', supabaseUrl)
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '설정됨' : '설정되지 않음')
  console.error('⚠️ 서버를 계속 실행하지만 Supabase 기능이 제한됩니다.')
  // process.exit(1) // 서버 다운 방지
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 렌더링 작업 관리
const activeJobs = new Map()

// 자동 복구 시스템 상태 관리
const autoRecoveryStatus = {
  isActive: false,
  serverMonitor: {
    running: false,
    lastCheck: null,
    retryCount: 0,
    maxRetries: 5
  },
  autoRecovery: {
    running: false,
    lastStateCheck: null,
    renderingResumed: false
  },
  logs: []
}

// 포트 관리 시스템
const portManager = {
  currentPort: null,
  portHistory: [],
  portConflicts: [],
  autoRecoveryPort: null,
  isPortMonitoring: false
}

// 데이터셋 변환 작업 관리
const conversionJobs = new Map()
const conversionProgress = new Map()

// 렌더링 시작 API
app.post('/api/synthetic/start-rendering', async (req, res) => {
  try {
    const { mode, partId, setNum, imageCount } = req.body
    // Blender 스크립트 인수 호환: medium -> normal 매핑
    const qualityRaw = req.body.quality
    const quality = qualityRaw === 'medium' ? 'normal' : qualityRaw
    
    const jobId = `job_${Date.now()}`
    const job = {
      id: jobId,
      status: 'running',
      progress: 0,
      config: req.body,
      startTime: new Date(),
      logs: []
    }
    
    activeJobs.set(jobId, job)
    
    // 실제 Blender 렌더링 시작
    console.log('🎨 실제 Blender 렌더링 시작:', { partId, imageCount, quality })
    
    // Blender 렌더링 프로세스 시작
    startBlenderRendering(job)
    
    res.json({
      success: true,
      jobId,
      message: '렌더링이 시작되었습니다'
    })
    
  } catch (error) {
    console.error('렌더링 시작 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 헬스체크 API
app.get('/api/synthetic/health', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    activeJobs: activeJobs.size
  })
})

// 서버 상태 확인 API
app.get('/api/synthetic/status', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    activeJobs: activeJobs.size,
    version: '1.0.0'
  })
})

// 자동 복구 시스템 상태 API
app.get('/api/synthetic/auto-recovery/status', (req, res) => {
  try {
    res.json({
      success: true,
      autoRecovery: autoRecoveryStatus,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 자동 복구 시스템 시작 API
app.post('/api/synthetic/auto-recovery/start', (req, res) => {
  try {
    autoRecoveryStatus.isActive = true
    autoRecoveryStatus.serverMonitor.running = true
    autoRecoveryStatus.serverMonitor.lastCheck = new Date().toISOString()
    autoRecoveryStatus.logs.push({
      timestamp: new Date().toISOString(),
      type: 'info',
      message: '자동 복구 시스템 시작됨'
    })
    
    res.json({
      success: true,
      message: '자동 복구 시스템이 시작되었습니다',
      status: autoRecoveryStatus
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 자동 복구 시스템 중단 API
app.post('/api/synthetic/auto-recovery/stop', (req, res) => {
  try {
    autoRecoveryStatus.isActive = false
    autoRecoveryStatus.serverMonitor.running = false
    autoRecoveryStatus.autoRecovery.running = false
    autoRecoveryStatus.logs.push({
      timestamp: new Date().toISOString(),
      type: 'info',
      message: '자동 복구 시스템 중단됨'
    })
    
    res.json({
      success: true,
      message: '자동 복구 시스템이 중단되었습니다',
      status: autoRecoveryStatus
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 자동 복구 로그 추가 API (내부용)
const addAutoRecoveryLog = (type, message) => {
  autoRecoveryStatus.logs.push({
    timestamp: new Date().toISOString(),
    type: type,
    message: message
  })
  
  // 로그 개수 제한 (최근 100개만 유지)
  if (autoRecoveryStatus.logs.length > 100) {
    autoRecoveryStatus.logs = autoRecoveryStatus.logs.slice(-100)
  }
}

// 포트 충돌 감지 및 자동 수정
const detectPortConflicts = async () => {
  try {
    const usedPorts = []
    
    // 현재 사용 중인 포트들 확인
    for (let port = 3000; port <= 3100; port++) {
      if (!(await isPortAvailable(port))) {
        usedPorts.push(port)
      }
    }
    
    portManager.portConflicts = usedPorts
    addAutoRecoveryLog('info', `포트 충돌 감지: ${usedPorts.length}개 포트 사용 중`)
    
    return usedPorts
  } catch (error) {
    addAutoRecoveryLog('error', `포트 충돌 감지 실패: ${error.message}`)
    return []
  }
}

// 동적 포트 할당 (충돌 방지)
const allocatePortDynamically = async (preferredPort = 3002) => {
  try {
    // 선호 포트가 사용 가능한지 확인
    if (await isPortAvailable(preferredPort)) {
      portManager.currentPort = preferredPort
      addAutoRecoveryLog('info', `선호 포트 ${preferredPort} 사용 가능`)
      return preferredPort
    }
    
    // 사용 가능한 포트 찾기
    for (let port = 3002; port <= 3100; port++) {
      if (await isPortAvailable(port)) {
        portManager.currentPort = port
        portManager.portHistory.push({
          port: port,
          timestamp: new Date().toISOString(),
          reason: 'auto-assignment'
        })
        addAutoRecoveryLog('info', `동적 포트 할당: ${port}`)
        return port
      }
    }
    
    throw new Error('사용 가능한 포트를 찾을 수 없습니다 (3002-3100)')
  } catch (error) {
    addAutoRecoveryLog('error', `동적 포트 할당 실패: ${error.message}`)
    return null
  }
}

// 포트 상태 모니터링
const startPortMonitoring = () => {
  if (portManager.isPortMonitoring) return
  
  portManager.isPortMonitoring = true
  
  const monitorInterval = setInterval(async () => {
    if (!portManager.isPortMonitoring) {
      clearInterval(monitorInterval)
      return
    }
    
    // 현재 포트 상태 확인
    if (portManager.currentPort && !(await isPortAvailable(portManager.currentPort))) {
      addAutoRecoveryLog('warning', `현재 포트 ${portManager.currentPort} 사용 불가 - 재할당 필요`)
      
      // 새로운 포트 할당
      const newPort = await allocatePortDynamically()
      if (newPort) {
        addAutoRecoveryLog('info', `포트 재할당 완료: ${newPort}`)
      }
    }
  }, 10000) // 10초마다 확인
  
  addAutoRecoveryLog('info', '포트 모니터링 시작됨')
}

// 포트 상태 조회 API
app.get('/api/synthetic/ports/status', (req, res) => {
  try {
    res.json({
      success: true,
      portManager: {
        currentPort: portManager.currentPort,
        portHistory: portManager.portHistory.slice(-10), // 최근 10개
        portConflicts: portManager.portConflicts,
        isPortMonitoring: portManager.isPortMonitoring,
        autoRecoveryPort: portManager.autoRecoveryPort
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 포트 재할당 API
app.post('/api/synthetic/ports/reallocate', async (req, res) => {
  try {
    const { preferredPort } = req.body
    const newPort = await allocatePortDynamically(preferredPort)
    
    if (newPort) {
      res.json({
        success: true,
        message: `포트 재할당 완료: ${newPort}`,
        newPort: newPort
      })
    } else {
      res.status(500).json({
        success: false,
        error: '포트 재할당 실패'
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 포트 모니터링 시작/중단 API
app.post('/api/synthetic/ports/monitoring/:action', (req, res) => {
  try {
    const { action } = req.params
    
    if (action === 'start') {
      startPortMonitoring()
      res.json({
        success: true,
        message: '포트 모니터링이 시작되었습니다'
      })
    } else if (action === 'stop') {
      portManager.isPortMonitoring = false
      res.json({
        success: true,
        message: '포트 모니터링이 중단되었습니다'
      })
    } else {
      res.status(400).json({
        success: false,
        error: '잘못된 액션입니다 (start/stop)'
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 렌더링 중지 API
app.post('/api/synthetic/stop-rendering', async (req, res) => {
  try {
    const { jobId } = req.body
    
    if (activeJobs.has(jobId)) {
      const job = activeJobs.get(jobId)
      job.status = 'stopped'
      
      // Blender 프로세스 종료
      if (job.blenderProcess) {
        job.blenderProcess.kill()
      }
      
      activeJobs.delete(jobId)
    }
    
    res.json({
      success: true,
      message: '렌더링이 중지되었습니다'
    })
    
  } catch (error) {
    console.error('렌더링 중지 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 렌더링 진행 상황 API
app.get('/api/synthetic/progress/:jobId', (req, res) => {
  const { jobId } = req.params
  
  if (activeJobs.has(jobId)) {
    const job = activeJobs.get(jobId)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    res.json({
      success: true,
      progress: job.progress,
      status: job.status,
      logs: job.logs.slice(-10) // 최근 10개 로그만
    })
  } else {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    res.json({
      success: false,
      message: '작업을 찾을 수 없습니다'
    })
  }
})

// 렌더링 결과 조회 API
app.get('/api/synthetic/results', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('synthetic_dataset')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    
    res.json({
      success: true,
      results: data
    })
    
  } catch (error) {
    console.error('결과 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 통계 조회 API
app.get('/api/synthetic/stats', async (req, res) => {
  try {
    // 총 부품 수
    const { count: totalParts } = await supabase
      .from('lego_parts')
      .select('*', { count: 'exact' })
    
    // 렌더링된 이미지 수
    const { count: renderedImages } = await supabase
      .from('synthetic_dataset')
      .select('*', { count: 'exact' })
    
    // 저장소 사용량 (추정)
    const { data: storageData } = await supabase
      .storage
      .from('lego-synthetic')
      .list('synthetic', { limit: 1000 })
    
    const storageUsed = storageData ? 
      `${(storageData.length * 0.5).toFixed(1)} GB` : '0 GB'
    
    res.json({
      success: true,
      stats: {
        totalParts: totalParts || 0,
        renderedImages: renderedImages || 0,
        storageUsed,
        renderingStatus: activeJobs.size > 0 ? '렌더링 중' : '대기 중'
      }
    })
    
  } catch (error) {
    console.error('통계 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Rebrickable 이미지 → WebP 변환 프록시
app.get('/api/upload/proxy-image', async (req, res) => {
  try {
    const sourceUrl = String(req.query.url || '').trim()
    if (!sourceUrl) return res.status(400).json({ error: 'url query required' })

    const f = await ensureFetch()
    if (!f) return res.status(500).json({ error: 'fetch unavailable' })

    const resp = await f(sourceUrl, { headers: { 'Accept': 'image/*', 'User-Agent': 'BrickBox/1.0' } })
    if (!resp.ok) return res.status(resp.status).json({ error: 'source fetch failed' })

    const arr = await resp.arrayBuffer()
    const buffer = Buffer.from(arr)

    const webp = await sharp(buffer).webp({ quality: 80, effort: 4 }).toBuffer()

    res.set('Content-Type', 'image/webp')
    res.set('Cache-Control', 'public, max-age=31536000')
    res.end(webp)
  } catch (e) {
    console.error('proxy-image error:', e)
    res.status(500).json({ error: 'proxy failed' })
  }
})

// 캡처 업로드 API (lego-captures 버킷)
app.post('/api/captures/upload', async (req, res) => {
  try {
    const { setNum, partId, imageData } = req.body || {}
    if (!setNum || !partId || !imageData) {
      return res.status(400).json({ success: false, error: 'setNum, partId, imageData required' })
    }

    // dataURL -> Buffer
    const m = String(imageData).match(/^data:(.*?);base64,(.*)$/)
    if (!m) return res.status(400).json({ success: false, error: 'invalid imageData format' })
    const contentType = m[1] || 'image/webp'
    const buffer = Buffer.from(m[2], 'base64')

    // 경로: captures/<setNum>/<partId>/<timestamp>.webp
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0,14)
    const ext = contentType.includes('webp') ? 'webp' : (contentType.includes('png') ? 'png' : 'jpg')
    const filePath = `captures/${setNum}/${partId}/${ts}.${ext}`

    const { error: upErr } = await supabase
      .storage
      .from('lego-captures')
      .upload(filePath, buffer, { contentType, upsert: false })

    if (upErr) return res.status(500).json({ success: false, error: upErr.message || 'upload failed' })

    // 비공개 버킷이므로 서명 URL 발급
    const { data: signed, error: signErr } = await supabase
      .storage
      .from('lego-captures')
      .createSignedUrl(filePath, 60 * 10) // 10분

    if (signErr) return res.status(500).json({ success: true, path: filePath })

    return res.json({ success: true, path: filePath, signedUrl: signed?.signedUrl })
  } catch (e) {
    console.error('캡처 업로드 실패:', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 세트별 캡처 리포트 API: 확인/누락 집계
app.get('/api/captures/report/:setNum', async (req, res) => {
  try {
    const rawSet = String(req.params.setNum || '').trim()
    if (!rawSet) return res.status(400).json({ success: false, error: 'setNum required' })

    // 세트 식별: 정확 일치 → base(-1 추가) → LIKE
    let setNum = rawSet
    if (!setNum.includes('-')) setNum = `${setNum}-1`

    // lego_sets 조회
    let legoSet = null
    {
      const { data, error } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', setNum)
        .limit(1)
        .maybeSingle()
      if (!error && data) legoSet = data
    }
    if (!legoSet && setNum.includes('-')) {
      const base = setNum.split('-')[0]
      const { data } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', `${base}-1`)
        .limit(1)
        .maybeSingle()
      if (data) legoSet = data
    }
    if (!legoSet) {
      const { data } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .like('set_num', `${setNum.split('-')[0]}%`)
        .limit(1)
        .maybeSingle()
      if (data) legoSet = data
    }
    if (!legoSet) return res.status(404).json({ success: false, error: 'set not found' })

    // 기대 부품 집합
    const { data: setParts, error: spErr } = await supabase
      .from('set_parts')
      .select('lego_parts(part_num), quantity')
      .eq('set_id', legoSet.id)

    if (spErr) return res.status(500).json({ success: false, error: spErr.message })
    const expectedParts = new Set((setParts || []).map(r => r.lego_parts?.part_num).filter(Boolean))

    // 캡처된 파트: 폴더명 기준 captures/<set>/<partId>/...
    const capturedParts = new Set()
    const { data: level1 } = await supabase
      .storage
      .from('lego-captures')
      .list(`captures/${rawSet}`, { limit: 1000 })
    if (Array.isArray(level1)) {
      for (const entry of level1) {
        const name = entry?.name
        const isDir = entry?.id?.endsWith('/') || entry?.metadata?.is_directory === true || entry?.metadata?.mimetype === null
        if (name && (!entry?.metadata || isDir)) {
          capturedParts.add(name)
        }
      }
    }

    // 교집합/차집합
    const confirmed = Array.from(expectedParts).filter(p => capturedParts.has(p))
    const missing = Array.from(expectedParts).filter(p => !capturedParts.has(p))

    return res.json({
      success: true,
      set: { id: legoSet.id, setNum: legoSet.set_num, name: legoSet.name },
      counts: { expected: expectedParts.size, confirmed: confirmed.length, missing: missing.length },
      confirmed,
      missing
    })
  } catch (e) {
    console.error('리포트 생성 실패:', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 엘리먼트 → 부품/색상 해석 API
app.get('/api/synthetic/resolve-element/:elementId', async (req, res) => {
  try {
    const { elementId } = req.params
    if (!elementId) return res.status(400).json({ success: false, error: 'elementId required' })
    // part-color 패턴 우선
    const m = elementId.trim().match(/^([A-Za-z0-9]+)[-_](\d+)$/)
    if (m) {
      return res.json({ success: true, partId: m[1], colorId: parseInt(m[2], 10) })
    }
    // 숫자형 elementId는 Rebrickable 조회
    if (/^\d+$/.test(elementId.trim())) {
      const resolved = await resolveElementToPartAndColor(elementId.trim())
      if (resolved) return res.json({ success: true, ...resolved })
      return res.status(404).json({ success: false, error: 'resolve failed' })
    }
    return res.status(400).json({ success: false, error: 'invalid elementId format' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 안전한 fetch 보조 (Node <18 대응)
let safeFetch = globalThis.fetch
async function ensureFetch() {
  if (!safeFetch) {
    try {
      const mod = await import('node-fetch')
      safeFetch = mod.default
    } catch (e) {
      console.error('❌ fetch 사용 불가: node-fetch 설치 필요', e)
    }
  }
  return safeFetch
}

// Rebrickable에서 elementId → part/color 해석
async function resolveElementToPartAndColor(elementId) {
  try {
    const apiKey = process.env.VITE_REBRICKABLE_API_KEY
    if (!apiKey) return null
    const url = `https://rebrickable.com/api/v3/lego/elements/${encodeURIComponent(elementId)}/?key=${apiKey}`
    const f = await ensureFetch()
    if (!f) return null
    const res = await f(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const json = await res.json()
    // 응답 예: { part: { part_num }, color: { id } }
    const p = json?.part?.part_num
    const c = json?.color?.id
    if (p && Number.isInteger(c)) return { partId: p, colorId: c }
    return null
  } catch (e) {
    console.error('element 해석 실패:', e)
    return null
  }
}

// Rebrickable에서 partId → LDraw 파트번호 해석
async function resolvePartToLdraw(partId) {
  try {
    const apiKey = process.env.VITE_REBRICKABLE_API_KEY
    if (!apiKey || !partId) return null
    const url = `https://rebrickable.com/api/v3/lego/parts/${encodeURIComponent(partId)}/?key=${apiKey}`
    const f = await ensureFetch()
    if (!f) return null
    const res = await f(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const json = await res.json()
    const ldrawIds = json?.external_ids?.LDraw
    if (Array.isArray(ldrawIds) && ldrawIds.length > 0) {
      return String(ldrawIds[0])
    }
    return null
  } catch (e) {
    console.error('part→LDraw 해석 실패:', e)
    return null
  }
}

// Rebrickable에서 colorId → HEX 조회
async function resolveColorHex(colorId) {
  try {
    const apiKey = process.env.VITE_REBRICKABLE_API_KEY
    if (!apiKey) return null
    const url = `https://rebrickable.com/api/v3/lego/colors/${encodeURIComponent(colorId)}/?key=${apiKey}`
    const f = await ensureFetch()
    if (!f) return null
    const res = await f(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const json = await res.json()
    // 응답 예: { rgb: "6D6E5C" }
    const hex = json?.rgb
    if (typeof hex === 'string' && /^[0-9A-Fa-f]{6}$/.test(hex)) {
      return `#${hex}`
    }
    return null
  } catch (e) {
    console.error('color HEX 조회 실패:', e)
    return null
  }
}

// Blender 렌더링 프로세스 시작
async function startBlenderRendering(job) {
  const { mode, partId, setNum, imageCount } = job.config
  const quality = job.config.quality === 'medium' ? 'normal' : job.config.quality
  const background = job.config.background || 'white'
  // 정밀도 모드: 흰 배경일 때 Standard 강제, gray는 Filmic
  const colorManagement = 'standard'
  // 해상도/화면점유율(기본 정밀 값)
  const resolution = job.config.resolution || '1024x1024'
  const targetFill = typeof job.config.targetFill === 'number' ? job.config.targetFill : 0.92
  let colorId = job.config.colorId
  let effectivePartId = partId
  let displayPartId = partId

  if (job.config.elementId && typeof job.config.elementId === 'string') {
    const raw = job.config.elementId.trim()
    const m = raw.match(/^([A-Za-z0-9]+)[-_](\d+)$/)
    if (m) {
      effectivePartId = m[1]
      colorId = parseInt(m[2], 10)
    } else if (/^\d+$/.test(raw)) {
      const resolved = await resolveElementToPartAndColor(raw)
      if (resolved) {
        effectivePartId = resolved.partId
        colorId = resolved.colorId
        job.logs.push({ timestamp: new Date(), type: 'info', message: `element ${raw} → part ${effectivePartId}, color ${colorId}` })
      } else {
        job.status = 'failed'
        job.logs.push({ timestamp: new Date(), type: 'error', message: `elementId(${raw}) 해석 실패. Rebrickable API 키/네트워크 확인.` })
        return
      }
    }
  }

  if (!effectivePartId) {
    job.status = 'failed'
    job.logs.push({ timestamp: new Date(), type: 'error', message: '유효한 partId를 결정하지 못했습니다 (elementId 확인 필요)' })
    return
  }
  // Rebrickable 파트번호가 LDraw와 다를 수 있으므로 LDraw ID로 변환 시도
  try {
    const ldrawId = await resolvePartToLdraw(effectivePartId)
    if (ldrawId) {
      displayPartId = effectivePartId
      effectivePartId = ldrawId
      job.logs.push({ timestamp: new Date(), type: 'info', message: `part ${displayPartId} → LDraw ${effectivePartId}` })
    }
  } catch {}
  
  // 렌더링 품질 설정 (폐쇄 세계 최적화)
  const samples = quality === 'fast' ? 64 : quality === 'medium' ? 128 : quality === 'high' ? 256 : 400
  
  // Blender 명령어 구성
  const blenderPath = process.env.BLENDER_PATH || 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe'
  const scriptPath = path.join(__dirname, '../scripts/render_ldraw_to_supabase.py')
  
  const ldrawPath = process.env.LDRAW_PATH || 'C:/LDraw/parts'
  
  // Blender에 전달할 Supabase 키 선택: 서비스 키 우선, 없으면 anon 키
  const blenderSupabaseKey = process.env.SUPABASE_SERVICE_ROLE
    || process.env.VITE_SUPABASE_SERVICE_ROLE
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_KEY_JWT
    || process.env.VITE_SUPABASE_ANON_KEY

  const args = [
    '--background',
    '--python', scriptPath,
    '--',
    '--part-id', effectivePartId,
    '--count', imageCount.toString(),
    '--quality', quality,
    '--samples', String(samples),
    '--background', background,
    '--ldraw-path', ldrawPath,
    '--output-dir', './output/synthetic',
    '--output-subdir', job.config.elementId ? String(job.config.elementId) : String(displayPartId),
    ...(job.config.elementId ? ['--element-id', String(job.config.elementId)] : []),
    '--resolution', String(resolution),
    '--target-fill', String(targetFill),
    '--color-management', colorManagement,
    '--supabase-url', process.env.VITE_SUPABASE_URL,
    '--supabase-key', blenderSupabaseKey
  ]

  // 디버그: 민감정보 노출 없이 전달 여부만 로깅
  try {
    const maskedKey = blenderSupabaseKey ? (String(blenderSupabaseKey).slice(0, 6) + '…') : 'missing'
    console.log('Blender Supabase args:', {
      url_present: !!process.env.VITE_SUPABASE_URL,
      key_present: !!blenderSupabaseKey,
      key_preview: maskedKey
    })
  } catch {}
  let colorHex = null
  if (Number.isInteger(colorId)) {
    args.push('--color-id', String(colorId))
    // 정확도 향상: HEX도 함께 전달 (가능하면)
    try {
      colorHex = await resolveColorHex(colorId)
      if (colorHex) {
        args.push('--color-hex', colorHex)
      }
    } catch {}
  }
  
  console.log('Blender 렌더링 시작:', blenderPath, args.join(' '))
  
  const blenderProcess = spawn(blenderPath, args, {
    cwd: path.join(__dirname, '..')
  })
  
  job.blenderProcess = blenderProcess
  
  // 프로세스 출력 처리
  blenderProcess.stdout.on('data', (data) => {
    const output = data.toString()
    console.log('Blender 출력:', output)
    
    // 진행률 파싱 (여러 패턴 시도)
    const progressPatterns = [
      /(\d+)%/,
      /progress[:\s]*(\d+)%/i,
      /rendering[:\s]*(\d+)%/i,
      /frame[:\s]*(\d+)%/i
    ]
    
    for (const pattern of progressPatterns) {
      const match = output.match(pattern)
      if (match) {
        const progress = parseInt(match[1])
        if (progress > job.progress) {
          job.progress = Math.min(progress, 100)
        }
        break
      }
    }
    
    // 로그 추가 (중요한 메시지만)
    if (output.includes('렌더링') || output.includes('완료') || output.includes('오류') || output.includes('error')) {
      job.logs.push({
        timestamp: new Date(),
        message: output.trim(),
        type: output.includes('오류') || output.includes('error') ? 'error' : 'info'
      })
    }
  })
  
  blenderProcess.stderr.on('data', (data) => {
    const error = data.toString()
    console.error('Blender 오류:', error)
    
    job.logs.push({
      timestamp: new Date(),
      message: error.trim(),
      type: 'error'
    })
  })
  
  blenderProcess.on('close', (code) => {
    console.log(`Blender 프로세스 종료: ${code}`)
    
    if (code === 0) {
      job.status = 'completed'
      job.progress = 100
      job.logs.push({
        timestamp: new Date(),
        message: '렌더링 완료',
        type: 'success'
      })
    } else {
      job.status = 'failed'
      job.logs.push({
        timestamp: new Date(),
        message: `렌더링 실패 (코드: ${code})`,
        type: 'error'
      })
    }
    
    // 5분 후 작업 정보 삭제
    setTimeout(() => {
      activeJobs.delete(job.id)
    }, 5 * 60 * 1000)
  })
}

// ================================
// 🔧 Auto Port Selection Logic
// ================================

const DEFAULT_PORT = parseInt(process.env.SYNTHETIC_PORT || '3007', 10);
const MAX_PORT = 3100;

/**
 * 지정된 포트가 사용 중인지 확인
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester
          .once('close', () => resolve(true))
          .close();
      })
      .listen(port);
  });
}

// 기존 startServer 함수 제거됨 - 새로운 함수 사용

// 생성된 이미지 파일 목록 반환 API (로컬 출력 기반)
app.get('/api/synthetic/files/:partId', async (req, res) => {
  try {
    const { partId } = req.params
    const baseDir = path.join(__dirname, '..', 'output', 'synthetic', partId)
    if (!fs.existsSync(baseDir)) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.set('Pragma', 'no-cache')
      res.set('Expires', '0')
      res.set('Surrogate-Control', 'no-store')
      return res.json({ success: true, results: [] })
    }
    const allFiles = await fs.promises.readdir(baseDir)
    const imageFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.webp'))

    const results = imageFiles.map((fileName) => ({
      id: `${partId}_${fileName}`,
      partId,
      imageUrl: `/api/synthetic/static/synthetic/${partId}/${fileName}`,
      colorName: '알수없음',
      angle: '알수없음',
      resolution: '640x640'
    }))

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    res.json({ success: true, results })
  } catch (error) {
    console.error('파일 목록 조회 실패:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 데이터셋 변환 API 엔드포인트들
app.post('/api/dataset/convert', async (req, res) => {
  try {
    const { sourcePath, targetPath, format } = req.body
    const jobId = `conversion_${Date.now()}`
    
    console.log(`🔄 데이터셋 변환 시작: ${jobId}`)
    
    // 변환 작업 시작
    const conversionProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'prepare_training_dataset.py')
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8'
      }
    })
    
    // 작업 저장
    conversionJobs.set(jobId, {
      process: conversionProcess,
      startTime: new Date(),
      status: 'running'
    })
    
    conversionProgress.set(jobId, {
      progress: 0,
      status: '변환 시작...',
      logs: []
    })
    
    // 프로세스 출력 처리
    conversionProcess.stdout.on('data', (data) => {
      const message = data.toString('utf8').trim()
      console.log(`[${jobId}] ${message}`)
      
      const progress = conversionProgress.get(jobId)
      progress.logs.push({
        time: new Date().toLocaleTimeString(),
        message,
        type: 'info'
      })
      
      // 진행률 추정 (간단한 휴리스틱)
      if (message.includes('전체 이미지 수')) {
        progress.progress = 10
        progress.status = '이미지 분석 중...'
      } else if (message.includes('Train:')) {
        progress.progress = 50
        progress.status = '데이터셋 분할 중...'
      } else if (message.includes('데이터셋 준비 완료')) {
        progress.progress = 100
        progress.status = '변환 완료!'
      }
    })
    
    conversionProcess.stderr.on('data', (data) => {
      const message = data.toString('utf8').trim()
      console.error(`[${jobId}] ERROR: ${message}`)
      
      const progress = conversionProgress.get(jobId)
      progress.logs.push({
        time: new Date().toLocaleTimeString(),
        message,
        type: 'error'
      })
    })
    
    conversionProcess.on('close', (code) => {
      const job = conversionJobs.get(jobId)
      if (job) {
        job.status = code === 0 ? 'completed' : 'failed'
        job.endTime = new Date()
      }
      
      const progress = conversionProgress.get(jobId)
      if (code === 0) {
        progress.progress = 100
        progress.status = '변환 완료!'
        progress.logs.push({
          time: new Date().toLocaleTimeString(),
          message: '데이터셋 변환이 성공적으로 완료되었습니다!',
          type: 'success'
        })
      } else {
        progress.status = '변환 실패'
        progress.logs.push({
          time: new Date().toLocaleTimeString(),
          message: `변환 실패 (종료 코드: ${code})`,
          type: 'error'
        })
      }
    })
    
    res.json({ 
      success: true, 
      jobId,
      message: '데이터셋 변환이 시작되었습니다.' 
    })
    
  } catch (error) {
    console.error('데이터셋 변환 시작 실패:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/dataset/progress', (req, res) => {
  try {
    const { jobId } = req.query
    
    if (!jobId) {
      return res.status(400).json({ 
        success: false, 
        error: 'jobId가 필요합니다.' 
      })
    }
    
    const progress = conversionProgress.get(jobId)
    if (!progress) {
      return res.status(404).json({ 
        success: false, 
        error: '작업을 찾을 수 없습니다.' 
      })
    }
    
    res.json({
      success: true,
      progress: progress.progress,
      status: progress.status,
      logs: progress.logs.slice(-10) // 최근 10개 로그만 반환
    })
    
  } catch (error) {
    console.error('진행률 조회 실패:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/dataset/source-count', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, '..', 'output', 'synthetic')
    
    if (!fs.existsSync(outputDir)) {
      return res.json({ count: 0 })
    }
    
    // WebP 이미지 파일 개수 계산 (재귀적으로)
    let imageCount = 0
    
    const countWebPFiles = (dir) => {
      try {
        const items = fs.readdirSync(dir)
        for (const item of items) {
          const fullPath = path.join(dir, item)
          const stat = fs.statSync(fullPath)
          
          if (stat.isDirectory()) {
            countWebPFiles(fullPath)
          } else if (item.endsWith('.webp')) {
            imageCount++
          }
        }
      } catch (error) {
        console.warn(`디렉토리 읽기 실패: ${dir}`, error.message)
      }
    }
    
    countWebPFiles(outputDir)
    
    res.json({ count: imageCount })
    
  } catch (error) {
    console.error('소스 이미지 개수 조회 실패:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/dataset/download', async (req, res) => {
  try {
    const datasetPath = path.join(__dirname, '..', 'data', 'brickbox_dataset')
    
    if (!fs.existsSync(datasetPath)) {
      return res.status(404).json({ 
        success: false, 
        error: '데이터셋이 아직 생성되지 않았습니다.' 
      })
    }
    
    // 폴더 구조 정보 반환 (ZIP 생성 대신)
    try {
      // 데이터셋 폴더 구조 읽기
      const readDirRecursive = (dir, basePath = '') => {
        const items = []
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          const relativePath = path.join(basePath, entry.name)
          
          if (entry.isDirectory()) {
            items.push({
              name: entry.name,
              type: 'directory',
              path: relativePath,
              children: readDirRecursive(fullPath, relativePath)
            })
          } else {
            const stats = fs.statSync(fullPath)
            items.push({
              name: entry.name,
              type: 'file',
              path: relativePath,
              size: stats.size,
              modified: stats.mtime
            })
          }
        }
        
        return items
      }
      
      const datasetStructure = readDirRecursive(datasetPath)
      
      // 폴더 구조 정보 반환
      res.json({
        success: true,
        message: '데이터셋 폴더 구조 정보',
        datasetPath: datasetPath,
        structure: datasetStructure,
        instructions: [
          '1. 위 경로의 폴더를 직접 압축하세요',
          '2. Windows: 폴더 우클릭 → "압축" 또는 "ZIP으로 압축"',
          '3. 생성된 압축 파일을 YOLO 학습에 사용하세요'
        ],
        downloadNote: 'ZIP 자동 생성 기능은 현재 사용할 수 없습니다. 폴더를 직접 압축해주세요.'
      })
      
    } catch (error) {
      console.error('폴더 구조 읽기 오류:', error)
      res.status(500).json({
        success: false,
        error: '데이터셋 폴더를 읽을 수 없습니다.',
        message: error.message
      })
    }
    
  } catch (error) {
    console.error('데이터셋 다운로드 실패:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// 포트 자동 할당 함수
const findAvailablePort = async (startPort = 3001, maxPort = 3010) => {
  const net = await import('net')
  
  for (let port = startPort; port <= maxPort; port++) {
    try {
      await new Promise((resolve, reject) => {
        const server = net.createServer()
        
        server.listen(port, () => {
          server.close(() => resolve(port))
        })
        
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is in use`))
          } else {
            reject(err)
          }
        })
      })
      
      return port
    } catch (error) {
      if (port === maxPort) {
        throw new Error(`No available ports found between ${startPort} and ${maxPort}`)
      }
      continue
    }
  }
}

// 서버 시작
const startServer = async () => {
  try {
    // 포트 관리 시스템에서 포트 가져오기
    let PORT;
    try {
      // 포트 충돌 감지
      await detectPortConflicts()
      
      // 포트 설정 파일에서 읽기
      const portConfigPath = path.join(process.cwd(), '.port-config.json');
      if (fs.existsSync(portConfigPath)) {
        const portConfig = JSON.parse(fs.readFileSync(portConfigPath, 'utf8'));
        PORT = portConfig.syntheticApi;
        console.log(`📄 포트 설정 파일에서 읽기: ${PORT}`);
      } else {
        // 동적 포트 할당 (충돌 방지)
        PORT = await allocatePortDynamically(3002);
        if (!PORT) {
          throw new Error('동적 포트 할당 실패');
        }
        console.log(`🔍 동적 포트 할당: ${PORT}`);
      }
      
      // 포트 모니터링 시작
      startPortMonitoring()
      
    } catch (error) {
      console.error('❌ 포트 할당 실패:', error.message);
      PORT = process.env.SYNTHETIC_API_PORT || 3002;
      console.log(`⚠️ 기본 포트 사용: ${PORT}`);
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Synthetic API 서버가 포트 ${PORT}에서 실행 중입니다.`)
      console.log(`📡 API 엔드포인트: http://localhost:${PORT}`)
      console.log(`🖼️  정적 파일: http://localhost:${PORT}/api/synthetic/static`)
      console.log(`📊 데이터셋 변환: http://localhost:${PORT}/api/dataset/convert`)
      
      // 포트 정보를 파일로 저장 (Vite 프록시에서 사용)
      const portInfo = {
        port: PORT,
        timestamp: new Date().toISOString(),
        pid: process.pid
      }
      
      try {
        const portFilePath = path.join(process.cwd(), '.synthetic-api-port.json')
        fs.writeFileSync(portFilePath, JSON.stringify(portInfo, null, 2))
        console.log(`📝 포트 정보 저장: ${portFilePath}`)
      } catch (fileError) {
        console.warn('포트 정보 파일 저장 실패:', fileError.message)
      }
    })
    
  } catch (error) {
    console.error('서버 시작 실패:', error.message)
    process.exit(1)
  }
}

// 렌더링 최적화 진단 API
app.post('/api/render-optimization/audit', async (req, res) => {
  try {
    const {
      glob = 'output/synthetic/*/*.json',
      baseline_sec = 4.0,
      auto_baseline = true,
      quality_simulation = true,
      group_by = 'shape_tag',
      max_files = 0,
      workers = 8
    } = req.body;

    console.log('렌더링 최적화 진단 요청:', { glob, baseline_sec, auto_baseline, quality_simulation, group_by });

    // Python 스크립트 실행
    const scriptPath = path.join(__dirname, '..', 'scripts', 'render_optimize_audit_enhanced.py');
    console.log('Python 스크립트 경로:', scriptPath);
    console.log('스크립트 존재 여부:', fs.existsSync(scriptPath));
    
    const args = [
      '--glob', glob,
      '--baseline-sec', baseline_sec.toString(),
      '--report', 'json'
    ];

    if (auto_baseline) {
      args.push('--auto-baseline');
    }

    if (quality_simulation) {
      args.push('--quality-simulation');
    }

    if (group_by) {
      args.push('--group-by', group_by);
    }

    if (max_files > 0) {
      args.push('--max-files', max_files.toString());
    }

    args.push('--workers', workers.toString());

    console.log('Python 스크립트 실행:', scriptPath, args);
    console.log('작업 디렉토리:', process.cwd());

    const pythonProcess = spawn('python', [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      }
    });
    
    console.log('Python 프로세스 시작됨, PID:', pythonProcess.pid);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString('utf8');
      stdout += output;
      console.log('Python STDOUT:', output);
    });

    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString('utf8');
      stderr += output;
      console.log('Python STDERR:', output);
    });

    pythonProcess.on('close', (code) => {
      console.log('Python 프로세스 종료, 코드:', code);
      console.log('전체 STDOUT:', stdout);
      console.log('전체 STDERR:', stderr);
      
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('진단 완료:', result.files, '개 파일 분석');
          res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
          });
        } catch (parseError) {
          console.error('JSON 파싱 오류:', parseError);
          console.error('stdout:', stdout);
          res.status(500).json({
            success: false,
            error: '결과 파싱 실패',
            details: parseError.message,
            stdout: stdout.substring(0, 500)
          });
        }
      } else {
        console.error('Python 스크립트 실행 실패:', code);
        console.error('stderr:', stderr);
        res.status(500).json({
          success: false,
          error: '진단 스크립트 실행 실패',
          details: stderr,
          code: code
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Python 프로세스 오류:', error);
      res.status(500).json({
        success: false,
        error: 'Python 프로세스 시작 실패',
        details: error.message
      });
    });

  } catch (error) {
    console.error('API 오류:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류',
      details: error.message
    });
  }
});

// 렌더링 최적화 히스토리 조회
app.get('/api/render-optimization/history', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    // 실제 구현에서는 Supabase에서 히스토리 조회
    // 현재는 빈 배열 반환
    res.json({
      success: true,
      data: [],
      total: 0,
      message: '히스토리 데이터가 없습니다. 첫 번째 진단을 실행해주세요.'
    });

  } catch (error) {
    console.error('히스토리 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '히스토리 조회 실패',
      details: error.message
    });
  }
});

// 최적화 권장사항 적용
app.post('/api/render-optimization/apply', async (req, res) => {
  try {
    const { 
      scenario, 
      target_samples, 
      gpu_enabled, 
      cache_enabled,
      parallel_workers 
    } = req.body;

    console.log('최적화 적용 요청:', { scenario, target_samples, gpu_enabled, cache_enabled, parallel_workers });

    const result = {
      success: true,
      applied_changes: {
        samples: target_samples,
        gpu_enabled: gpu_enabled,
        cache_enabled: cache_enabled,
        parallel_workers: parallel_workers
      },
      estimated_improvement: {
        speedup: scenario === 'once_render_low' ? 3.44 : 1.50,
        quality_impact: 'low'
      },
      timestamp: new Date().toISOString()
    };

    res.json(result);

  } catch (error) {
    console.error('최적화 적용 오류:', error);
    res.status(500).json({
      success: false,
      error: '최적화 적용 실패',
      details: error.message
    });
  }
});

// 실시간 렌더링 상태 모니터링
app.get('/api/render-optimization/status', async (req, res) => {
  try {
    // 실제 구현에서는 현재 렌더링 작업 상태 조회
    const status = {
      active_jobs: 0,
      completed_today: 0,
      average_time: 0,
      gpu_utilization: 0,
      memory_usage: 0,
      last_optimization: null
    };

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
      message: '렌더링 작업이 없습니다.'
    });

  } catch (error) {
    console.error('상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '상태 조회 실패',
      details: error.message
    });
  }
});

// 렌더링 품질 메트릭 조회
app.get('/api/render-optimization/metrics', async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    
    // 실제 구현에서는 시계열 데이터 조회
    const metrics = {
      ssim_trend: [],
      snr_trend: [],
      render_time_trend: []
    };

    res.json({
      success: true,
      data: metrics,
      period: period,
      message: '메트릭 데이터가 없습니다. 첫 번째 진단을 실행해주세요.'
    });

  } catch (error) {
    console.error('메트릭 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '메트릭 조회 실패',
      details: error.message
    });
  }
});

startServer()

export default app
