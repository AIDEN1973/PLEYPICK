import express from 'express'
import cors from 'cors'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config()

const app = express()
// 고정 포트 3004 사용 (근본 문제 해결)
const PORT = 3004

// Supabase 클라이언트 설정
const supabaseUrl = process.env.SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
const supabase = createClient(supabaseUrl, supabaseKey)

// 미들웨어 설정
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

console.log(`🖼️ WebP 이미지 API 서버 시작 중...`)
console.log(`📄 포트 설정 파일에서 읽기: ${PORT}`)

// Supabase Storage 이미지 프록시 엔드포인트 (OpenAI API 호환)
app.get('/api/supabase/image/:bucket/*', async (req, res) => {
  try {
    const { bucket } = req.params
    const filePath = req.params[0] || ''
    
    console.log(`🖼️ Supabase Storage 이미지 프록시 요청: ${bucket}/${filePath}`)
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }
    
    // Supabase Storage에서 이미지 다운로드
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath)
    
    if (error) {
      console.error(`❌ Supabase Storage 이미지 다운로드 오류:`, error)
      return res.status(404).json({ 
        error: `Image not found: ${error.message}`,
        details: error
      })
    }
    
    // 이미지 데이터를 스트림으로 전송
    const arrayBuffer = await data.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Content-Type 설정
    const contentType = filePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    
    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    
    console.log(`✅ Supabase Storage 이미지 프록시 성공: ${filePath} (${buffer.length} bytes)`)
    res.send(buffer)
    
  } catch (error) {
    console.error('❌ Supabase Storage 이미지 프록시 오류:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
})

// Rebrickable 이미지 → WebP 변환 프록시
app.get('/api/upload/proxy-image', async (req, res) => {
  try {
    const sourceUrl = String(req.query.url || '').trim()
    if (!sourceUrl) return res.status(400).json({ error: 'url query required' })

    console.log(`🖼️ Rebrickable 이미지 → WebP 변환 요청: ${sourceUrl}`)
    
    // URL 검증: element_id 추출 및 로깅
    const elementIdMatch = sourceUrl.match(/\/elements\/(\d+)\.jpg/)
    if (elementIdMatch) {
      const elementId = elementIdMatch[1]
      console.log(`📋 URL에서 추출한 Element ID: ${elementId}`)
    }

    const resp = await fetch(sourceUrl, { 
      headers: { 
        'Accept': 'image/*', 
        'User-Agent': 'BrickBox/1.0' 
      } 
    })
    
    if (!resp.ok) {
      console.error(`❌ 원본 이미지 다운로드 실패: ${resp.status} (URL: ${sourceUrl})`)
      return res.status(resp.status).json({ error: 'source fetch failed' })
    }
    
    console.log(`✅ 원본 이미지 다운로드 성공: ${resp.status} (URL: ${sourceUrl})`)

    const arr = await resp.arrayBuffer()
    const buffer = Buffer.from(arr)
    
    console.log(`📦 다운로드된 이미지 크기: ${buffer.length} bytes`)

    // WebP 변환
    const webp = await sharp(buffer)
      .webp({ 
        quality: 80, 
        effort: 4 
      })
      .toBuffer()

    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000',
      'Content-Length': webp.length,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    
    console.log(`✅ WebP 변환 완료: ${webp.length} bytes`)
    res.end(webp)
    
  } catch (e) {
    console.error('❌ WebP 변환 오류:', e)
    res.status(500).json({ error: 'proxy failed' })
  }
})

// 일반 이미지 프록시 (CORS 해결)
app.get('/api/proxy/*', async (req, res) => {
  try {
    const targetPath = req.params[0]
    const targetUrl = `https://cdn.rebrickable.com/${targetPath}`
    
    console.log(`🖼️ Rebrickable 프록시 요청: ${targetUrl}`)
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'BrickBox/1.0',
        'Accept': 'image/*'
      }
    })
    
    if (!response.ok) {
      console.error(`❌ Rebrickable 이미지 다운로드 실패: ${response.status}`)
      return res.status(response.status).json({ error: 'Image not found' })
    }
    
    const imageBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(imageBuffer)
    
    // Content-Type 설정
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    
    console.log(`✅ Rebrickable 프록시 성공: ${buffer.length} bytes`)
    res.send(buffer)
    
  } catch (error) {
    console.error('❌ Rebrickable 프록시 오류:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
})

// Rebrickable API 프록시 (CORS 해결)
app.get('/api/rebrickable/*', async (req, res) => {
  try {
    const apiPath = req.params[0]
    // URL에서 쿼리 스트링 추출 (endpoint에 포함된 쿼리 파라미터 포함)
    const queryIndex = req.originalUrl.indexOf('?')
    const queryString = queryIndex !== -1 ? req.originalUrl.substring(queryIndex) : ''
    const targetUrl = `https://rebrickable.com/api/v3/${apiPath}${queryString}`
    
    const apiKey = process.env.VITE_REBRICKABLE_API_KEY || 'd966442dee02b69a7d05a63805216a85'
    
    console.log(`📡 Rebrickable API 프록시 요청: ${targetUrl}`)
    
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `key ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BrickBox/1.0'
      }
    })
    
    // 429 Rate Limit 처리
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || '60'
      console.warn(`⚠️ Rate limit (429). Retry-After: ${retryAfter}s`)
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      })
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: parseInt(retryAfter)
      })
    }
    
    if (!response.ok) {
      console.error(`❌ Rebrickable API 호출 실패: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      })
      return res.status(response.status).json({ 
        error: `API Error: ${response.status} ${response.statusText}`,
        details: errorText
      })
    }
    
    const data = await response.json()
    
    res.set({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'public, max-age=300'
    })
    
    console.log(`✅ Rebrickable API 프록시 성공: ${response.status}`)
    res.json(data)
    
  } catch (error) {
    console.error('❌ Rebrickable API 프록시 오류:', error)
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
})

// OPTIONS 요청 처리 (CORS preflight)
app.options('/api/rebrickable/*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  })
  res.sendStatus(204)
})

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'WebP Image API',
    port: PORT,
    timestamp: new Date().toISOString()
  })
})

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 WebP 이미지 API 서버가 포트 ${PORT}에서 실행 중입니다`)
  console.log(`📡 API 엔드포인트:`)
  console.log(`  - Supabase Storage: http://localhost:${PORT}/api/supabase/image/lego_parts_images/`)
  console.log(`  - Rebrickable → WebP: http://localhost:${PORT}/api/upload/proxy-image`)
  console.log(`  - Rebrickable 프록시: http://localhost:${PORT}/api/proxy/`)
  console.log(`  - Rebrickable API: http://localhost:${PORT}/api/rebrickable/`)
  console.log(`🏥 헬스 체크: http://localhost:${PORT}/health`)
})

// 포트 정보 저장
import fs from 'fs'
const portInfo = {
  port: PORT,
  service: 'webp-image-api',
  startTime: new Date().toISOString()
}
fs.writeFileSync('.webp-image-port.json', JSON.stringify(portInfo, null, 2))
console.log(`📄 포트 정보 저장: .webp-image-port.json`)
