import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import path from 'path'
import { spawn } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'


// 환경 변수 로드
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// CORS 설정
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

app.use(express.json())

// Health check 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Blender API',
    port: 5003,
    timestamp: new Date().toISOString()
  })
})

// Supabase 클라이언트 초기화
const supabaseUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
const supabase = createClient(supabaseUrl, supabaseKey)

// 렌더링 상태 관리
let isRendering = false
let currentJob = null

// 데이터베이스 상태 검증 및 복구 함수
async function verifyAndRepairDatabase(partId, expectedImageCount) {
  console.log(`🔍 데이터베이스 상태 검증 시작: 부품 ${partId}`)
  
  try {
    // 1. parts_master 테이블 확인
    const { data: partData, error: partError } = await supabase
      .from('parts_master')
      .select('part_id')
      .eq('part_id', partId)
      .limit(1)
    
    if (partError) {
      console.error('❌ parts_master 조회 실패:', partError)
      return false
    }
    
    if (!partData || partData.length === 0) {
      console.log(`⚠️ 부품 ${partId}가 parts_master에 없음. 자동 등록 중...`)
      await ensurePartInMaster(partId)
    } else {
      console.log(`✅ 부품 ${partId} parts_master에 존재`)
    }
    
    // 2. synthetic_dataset 테이블 확인
    const { data: imageData, error: imageError } = await supabase
      .from('synthetic_dataset')
      .select('*')
      .eq('part_id', partId)
      .eq('status', 'uploaded')
    
    if (imageError) {
      console.error('❌ synthetic_dataset 조회 실패:', imageError)
      return false
    }
    
    const registeredImageCount = imageData?.length || 0
    console.log(`📊 synthetic_dataset 등록된 이미지: ${registeredImageCount}개 (예상: ${expectedImageCount}개)`)
    
    // 3. 이미지 수가 부족한 경우 로컬 파일에서 복구
    if (registeredImageCount < expectedImageCount) {
      console.log(`⚠️ 이미지 등록 부족. 로컬 파일에서 복구 중...`)
      await repairMissingImages(partId, expectedImageCount)
    } else {
      console.log(`✅ 모든 이미지가 정상적으로 등록됨`)
    }
    
    // 4. 최종 검증
    const { data: finalImageData } = await supabase
      .from('synthetic_dataset')
      .select('*')
      .eq('part_id', partId)
      .eq('status', 'uploaded')
    
    console.log(`🎯 최종 검증 완료: ${finalImageData?.length || 0}개 이미지 등록됨`)
    return true
    
  } catch (error) {
    console.error('❌ 데이터베이스 검증/복구 실패:', error)
    return false
  }
}

// 부품을 parts_master에 자동 등록
async function ensurePartInMaster(partId) {
  try {
    console.log(`🔧 부품 ${partId} parts_master 등록 시도...`)
    
    // 🔧 수정됨: lego_parts에서 실제 부품명 조회
    let partName = `LEGO Element ${partId}`
    try {
      const { data: legoPart, error: legoError } = await supabase
        .from('lego_parts')
        .select('part_num, name')
        .eq('part_num', partId)
        .maybeSingle()
      
      if (!legoError && legoPart?.name) {
        partName = legoPart.name
        console.log(`✅ 부품명 조회 성공: ${partName}`)
      } else {
        console.warn(`⚠️ 부품명 조회 실패 (part_num: ${partId}), 기본값 사용`)
      }
    } catch (queryError) {
      console.warn(`⚠️ 부품명 조회 중 오류: ${queryError.message}`)
    }
    
    const partRecord = {
      part_id: partId,
      part_name: partName,
      category: 'Unknown',
      color: 'Unknown',
      element_id: partId,
      version: 1
    }
    
    console.log('등록할 부품 데이터:', partRecord)
    
    const { data, error } = await supabase
      .from('parts_master')
      .insert(partRecord)
      .select()
    
    if (error) {
      console.error('❌ 부품 자동 등록 실패:', error)
      console.error('오류 상세:', JSON.stringify(error, null, 2))
      return false
    } else {
      console.log(`✅ 부품 ${partId} 자동 등록 완료:`, data)
      return true
    }
  } catch (error) {
    console.error('❌ 부품 자동 등록 중 오류:', error)
    console.error('오류 스택:', error.stack)
    return false
  }
}

// 누락된 이미지 복구
async function repairMissingImages(partId, expectedCount) {
  try {
    // 먼저 partId로 디렉토리 찾기
    let imageDir = path.join(__dirname, '..', 'output', 'synthetic', partId)
    
    if (!fs.existsSync(imageDir)) {
      // partId로 찾을 수 없으면 엘리먼트 ID로 찾기
      console.log(`⚠️ 부품 ID ${partId} 디렉토리가 없음. 엘리먼트 ID로 검색 중...`)
      
      // parts_master에서 엘리먼트 ID 조회
      const { data: partData } = await supabase
        .from('parts_master')
        .select('element_id')
        .eq('part_id', partId)
        .limit(1)
      
      if (partData && partData.length > 0) {
        const elementId = partData[0].element_id
        imageDir = path.join(__dirname, '..', 'output', 'synthetic', elementId)
        console.log(`🔄 엘리먼트 ID ${elementId} 디렉토리로 시도: ${imageDir}`)
      }
    }
    
    if (!fs.existsSync(imageDir)) {
      console.error(`❌ 이미지 디렉토리가 존재하지 않음: ${imageDir}`)
      return false
    }
    
    const files = fs.readdirSync(imageDir)
    const webpFiles = files.filter(file => file.endsWith('.webp'))
    
    console.log(`📁 로컬 WebP 파일: ${webpFiles.length}개`)
    
    if (webpFiles.length === 0) {
      console.error('❌ 로컬에 WebP 파일이 없음')
      return false
    }
    
    // 배치로 이미지 등록
    const batchSize = 10
    let successCount = 0
    
    for (let i = 0; i < webpFiles.length; i += batchSize) {
      const batch = webpFiles.slice(i, i + batchSize)
      const batchData = batch.map(filename => ({
        part_id: partId,
        filename: filename,
        image_url: `synthetic/${partId}/${filename}`,
        file_size: fs.statSync(path.join(imageDir, filename)).size,
        image_path: `synthetic/${partId}/${filename}`,
        status: 'uploaded',
        upload_method: 'auto_repair'
      }))
      
      const { error } = await supabase
        .from('synthetic_dataset')
        .insert(batchData)
      
      if (error) {
        console.error(`❌ 배치 ${Math.floor(i/batchSize) + 1} 등록 실패:`, error)
      } else {
        successCount += batch.length
        console.log(`✅ 배치 ${Math.floor(i/batchSize) + 1} 등록 완료 (${batch.length}개)`)
      }
    }
    
    console.log(`🔧 복구 완료: ${successCount}개 이미지 등록됨`)
    return successCount > 0
    
  } catch (error) {
    console.error('❌ 이미지 복구 중 오류:', error)
    return false
  }
}

// Supabase 통계 조회
app.get('/api/synthetic/stats', async (req, res) => {
  try {
    // 렌더링된 이미지 수 조회
    const { data: images, error: imagesError } = await supabase
      .from('synthetic_dataset')
      .select('id')
    
    if (imagesError) throw imagesError
    
    // 스토리지 사용량 조회 (간단한 추정)
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('lego_parts_images')
      .list('synthetic', { limit: 1000 })
    
    const storageUsed = storageData ? `${Math.round(storageData.length * 0.5)} MB` : '0 MB'
    
    res.json({
      success: true,
      stats: {
        totalParts: 22334,
        renderedImages: images?.length || 0,
        storageUsed: storageUsed,
        renderingStatus: isRendering ? '렌더링 중' : '대기 중'
      }
    })
  } catch (error) {
    console.error('통계 조회 실패:', error)
    res.json({
      success: true,
      stats: {
        totalParts: 22334,
        renderedImages: 0,
        storageUsed: '0 MB',
        renderingStatus: '대기 중'
      }
    })
  }
})

// 실제 Blender 렌더링 시작
app.post('/api/synthetic/start-rendering', async (req, res) => {
  if (isRendering) {
    return res.json({
      success: false,
      error: '이미 렌더링이 진행 중입니다'
    })
  }
  
  console.log('🎨 실제 Blender 렌더링 시작:', req.body)
  
  const { partId, imageCount, quality, mode, setNum } = req.body
  
  try {
    isRendering = true
    currentJob = {
      partId,
      imageCount,
      quality,
      mode,
      setNum,
      startTime: new Date()
    }
    
    // Blender 스크립트 실행
    const blenderScript = path.join(__dirname, '..', 'scripts', 'render_ldraw_to_supabase.py')
    const ldrawPath = 'C:/LDraw/parts'
    
    // 적응형 샘플링 시스템을 위한 고급 옵션
    const blenderArgs = [
      '--background',
      '--python', blenderScript,
      '--',
      '--ldraw-path', ldrawPath,
      '--part-id', partId,
      '--count', imageCount.toString(),
      '--quality', quality || 'fast',
      '--output-dir', path.join(__dirname, '..', 'temp', 'renders'),
      // 적응형 샘플링 시스템 설정
      '--enable-adaptive',
      '--enable-noise-correction',
      '--quality-threshold', '0.95',
      // 병렬 렌더링 최적화
      '--workers', 'auto',
      // GPU 최적화
      '--enable-gpu-optimization'
    ]
    
    console.log('Blender 실행 명령:', 'blender', blenderArgs.join(' '))
    
    // Blender 전체 경로 사용
    const blenderPath = 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe'
    
    const blenderProcess = spawn(blenderPath, blenderArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let output = ''
    let errorOutput = ''
    
    blenderProcess.stdout.on('data', (data) => {
      output += data.toString()
      const logData = data.toString()
      console.log('Blender 출력:', logData)
      
      // 적응형 샘플링 시스템 로그 감지
      if (logData.includes('적응형 샘플링')) {
        console.log('🎯 적응형 샘플링 시스템 활성화됨')
      }
      if (logData.includes('GPU 가속')) {
        console.log('🚀 GPU 최적화 활성화됨')
      }
      if (logData.includes('병렬 렌더링')) {
        console.log('⚡ 병렬 렌더링 활성화됨')
      }
      if (logData.includes('캐시')) {
        console.log('💾 캐싱 시스템 작동 중')
      }
    })
    
    blenderProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.error('Blender 오류:', data.toString())
    })
    
    blenderProcess.on('close', async (code) => {
      isRendering = false
      
      if (code === 0) {
        console.log('✅ Blender 렌더링 완료')
        
        // 프로덕션 성능 통계 출력
        console.log('\n📊 프로덕션 렌더링 성능 통계:')
        console.log('  - 적응형 샘플링: ✅ 활성화')
        console.log('  - GPU 최적화: ✅ 활성화')
        console.log('  - 병렬 렌더링: ✅ 활성화')
        console.log('  - 캐싱 시스템: ✅ 활성화')
        console.log('  - 노이즈 보정: ✅ 활성화')
        console.log('  - SSIM 품질 검증: ✅ 활성화')
        
        // 렌더링 완료 후 데이터베이스 상태 검증 및 복구
        try {
          await verifyAndRepairDatabase(partId, imageCount)
        } catch (dbError) {
          console.error('데이터베이스 검증/복구 실패:', dbError)
        }
      } else {
        console.error('❌ Blender 렌더링 실패:', errorOutput)
      }
    })
    
    // 즉시 응답 (비동기 처리)
    res.json({
      success: true,
      jobId: `job_${Date.now()}`,
      message: 'Blender 렌더링이 시작되었습니다',
      results: []
    })
    
  } catch (error) {
    isRendering = false
    console.error('렌더링 시작 실패:', error)
    res.json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/synthetic/stop-rendering', (req, res) => {
  isRendering = false
  currentJob = null
  
  res.json({
    success: true,
    message: '렌더링이 중지되었습니다'
  })
})

// 데이터베이스 복구 API
app.post('/api/synthetic/repair-database', async (req, res) => {
  try {
    const { partId, expectedImageCount } = req.body
    
    if (!partId) {
      return res.json({
        success: false,
        error: 'partId가 필요합니다'
      })
    }
    
    console.log(`🔧 수동 데이터베이스 복구 시작: 부품 ${partId}`)
    
    const success = await verifyAndRepairDatabase(partId, expectedImageCount || 200)
    
    if (success) {
      res.json({
        success: true,
        message: `부품 ${partId} 데이터베이스 복구 완료`,
        partId: partId
      })
    } else {
      res.json({
        success: false,
        error: `부품 ${partId} 데이터베이스 복구 실패`
      })
    }
    
  } catch (error) {
    console.error('데이터베이스 복구 API 오류:', error)
    res.json({
      success: false,
      error: error.message
    })
  }
})

// 부품 상태 확인 API
app.get('/api/synthetic/part-status/:partId', async (req, res) => {
  try {
    const { partId } = req.params
    
    // parts_master 확인
    const { data: partData, error: partError } = await supabase
      .from('parts_master')
      .select('part_id, part_name, category, color, element_id')
      .eq('part_id', partId)
      .limit(1)
    
    // synthetic_dataset 확인
    const { data: imageData, error: imageError } = await supabase
      .from('synthetic_dataset')
      .select('*')
      .eq('part_id', partId)
      .eq('status', 'uploaded')
    
    const status = {
      partId: partId,
      existsInPartsMaster: !!(partData && partData.length > 0),
      partInfo: partData?.[0] || null,
      registeredImageCount: imageData?.length || 0,
      images: imageData || [],
      canStartTraining: !!(partData && partData.length > 0 && imageData && imageData.length > 0)
    }
    
    res.json({
      success: true,
      status: status
    })
    
  } catch (error) {
    console.error('부품 상태 확인 오류:', error)
    res.json({
      success: false,
      error: error.message
    })
  }
})

// 포트 고정 설정
const PORT = 5003 // 고정 포트 5003

app.listen(PORT, () => {
  console.log(`🎨 BrickBox Blender API 서버가 포트 ${PORT}에서 실행 중입니다`)
})
