import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
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
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 렌더링 작업 관리
const activeJobs = new Map()

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
    const contentType = m[1] || 'image/jpeg'
    const buffer = Buffer.from(m[2], 'base64')

    // 경로: captures/<setNum>/<partId>/<timestamp>.jpg
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0,14)
    const ext = contentType.includes('png') ? 'png' : 'jpg'
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
  const resolution = job.config.resolution || '768x768'
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

// 서버 시작
const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`🧱 BrickBox 합성 데이터셋 API 서버가 포트 ${PORT}에서 실행 중입니다`)
})

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
    const imageFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.png'))

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

export default app
