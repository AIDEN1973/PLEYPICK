/**
 * Semantic Vector API 서버
 * FGC Encoder를 사용한 semantic_vector 생성 서비스
 * 포트: 3022
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// CORS 설정
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 고정 포트 3022 사용 (근본 문제 해결)
const PORT = 3022
console.log(`🔒 고정 포트 사용: ${PORT}`)

// 이미지 전처리 함수 (ONNX용)
async function preprocessImageForONNX(imageData) {
  try {
    // ArrayBuffer를 Sharp로 처리
    const image = sharp(Buffer.from(imageData))
    
    // 224x224로 리사이징
    const resized = await image
      .resize(224, 224)
      .removeAlpha()
      .raw()
      .toBuffer()
    
    // RGB 데이터를 Float32Array로 변환 및 정규화
    const tensor = new Float32Array(1 * 3 * 224 * 224)
    
    // ImageNet 표준 정규화
    const mean = [0.485, 0.456, 0.406]
    const std = [0.229, 0.224, 0.225]
    
    for (let i = 0; i < 224; i++) {
      for (let j = 0; j < 224; j++) {
        const pixelIndex = (i * 224 + j) * 3
        const r = resized[pixelIndex] / 255
        const g = resized[pixelIndex + 1] / 255
        const b = resized[pixelIndex + 2] / 255
        
        // 정규화 적용
        const normalizedR = (r - mean[0]) / std[0]
        const normalizedG = (g - mean[1]) / std[1]
        const normalizedB = (b - mean[2]) / std[2]
        
        // ONNX 형식으로 변환 [1, 3, 224, 224]
        tensor[0 * 224 * 224 + 0 * 224 * 224 + i * 224 + j] = normalizedR
        tensor[0 * 224 * 224 + 1 * 224 * 224 + i * 224 + j] = normalizedG
        tensor[0 * 224 * 224 + 2 * 224 * 224 + i * 224 + j] = normalizedB
      }
    }
    
    return tensor
  } catch (error) {
    console.error('❌ 이미지 전처리 실패:', error)
    throw error
  }
}

// 헬스 체크 엔드포인트
app.get('/health', async (req, res) => {
  try {
    // FGC Encoder 모델 상태 확인
    let modelStatus = {
      loaded: false,
      method: 'Unknown'
    }
    
    try {
      // 서버 환경에서 ONNX Runtime Node 사용
      const ort = await import('onnxruntime-node')
      
      // 모델 파일 경로 (__dirname 기준으로 안정화)
      const modelPath = path.join(__dirname, '..', 'public', 'models', 'fgc_encoder.onnx')
      
      console.log(`🔍 [헬스체크] 모델 경로: ${modelPath}`)
      console.log(`🔍 [헬스체크] 현재 작업 디렉토리: ${process.cwd()}`)
      console.log(`🔍 [헬스체크] __dirname: ${__dirname}`)
      
      // 모델 파일 존재 확인
      if (!fs.existsSync(modelPath)) {
        throw new Error(`모델 파일이 존재하지 않습니다: ${modelPath}`)
      }
      
      console.log(`✅ [헬스체크] 모델 파일 존재 확인`)
      
      // ONNX 세션 생성 테스트
      const session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
      })
      
      modelStatus = {
        loaded: true,
        method: 'FGC-Encoder (ONNX)'
      }
      
      // 세션 정리
      await session.release()
      
    } catch (error) {
      modelStatus = {
        loaded: false,
        method: 'FGC-Encoder (더미)',
        error: error.message
      }
    }
    
    res.json({
      status: 'healthy',
      service: 'semantic-vector-api',
      port: PORT,
      model_loaded: modelStatus.loaded,
      method: modelStatus.method,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'semantic-vector-api',
      port: PORT,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// 이미지 프록시 엔드포인트 (CORS 우회)
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'Missing image URL' })
  }

  try {
    console.log(`🔄 [프록시] 이미지 다운로드: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    res.setHeader('Content-Type', contentType || 'application/octet-stream')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    
    // 이미지 데이터 스트리밍
    response.body.pipeTo(res.writable)

  } catch (error) {
    console.error('❌ [프록시] 이미지 다운로드 실패:', error.message)
    res.status(500).json({ error: 'Failed to proxy image' })
  }
})

// semantic_vector 생성 엔드포인트
app.post('/api/semantic-vector', async (req, res) => {
  try {
    const { imageUrl, partId, colorId } = req.body

    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing imageUrl' })
    }

    console.log(`🚀 [Semantic Vector] 생성 시작: ${partId} (${colorId})`)
    console.log(`🖼️ [Semantic Vector] 이미지 URL: ${imageUrl}`)

    // 1. 이미지 다운로드
    let imageResponse
    try {
      imageResponse = await fetch(imageUrl)
    } catch (corsError) {
      console.warn(`⚠️ [Semantic Vector] 직접 다운로드 실패 (CORS): ${corsError.message}`)
      
      // 프록시를 통한 다운로드 시도
      const proxyUrl = `http://localhost:${PORT}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
      console.log(`🔄 [Semantic Vector] 프록시 다운로드 시도: ${proxyUrl}`)
      
      imageResponse = await fetch(proxyUrl)
    }

    if (!imageResponse.ok) {
      throw new Error(`Image download failed: ${imageResponse.status}`)
    }

    const imageBlob = await imageResponse.blob()
    const imageData = await imageBlob.arrayBuffer()
    console.log(`✅ [Semantic Vector] 이미지 다운로드 완료: ${imageData.byteLength} bytes`)

    // 2. FGC Encoder 초기화 및 임베딩 생성
    console.log(`🔍 [Semantic Vector] FGC Encoder 초기화...`)
    
    let fgcEmbedding
    let method = 'Unknown'
    
    try {
      // 서버 환경에서 ONNX Runtime Node 사용
      const ort = await import('onnxruntime-node')
      
      // 모델 파일 경로 (__dirname 기준으로 안정화)
      const modelPath = path.join(__dirname, '..', 'public', 'models', 'fgc_encoder.onnx')
      
      console.log(`🔍 [Semantic Vector] ONNX 모델 로드: ${modelPath}`)
      console.log(`🔍 [Semantic Vector] 현재 작업 디렉토리: ${process.cwd()}`)
      console.log(`🔍 [Semantic Vector] __dirname: ${__dirname}`)
      
      // ONNX 세션 생성
      const session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
      })
      
      console.log(`✅ [Semantic Vector] ONNX 모델 로드 성공:`, {
        inputNames: session.inputNames,
        outputNames: session.outputNames
      })
      
      // 이미지 전처리 (224x224 RGB)
      const processedImage = await preprocessImageForONNX(imageData)
      
      // ONNX 추론 실행 (Tensor 형태) // 🔧 수정됨
      const inputTensor = new ort.Tensor('float32', processedImage, [1, 3, 224, 224]) // 🔧 수정됨
      const results = await session.run({ [session.inputNames[0]]: inputTensor }) // 🔧 수정됨
      
      // 결과 추출 및 정규화 // 🔧 수정됨
      const rawEmbedding = Array.from(results[session.outputNames[0]].data)
      let norm = Math.sqrt(rawEmbedding.reduce((sum, val) => sum + val * val, 0))
      if (!isFinite(norm) || norm === 0) { norm = 1 } // 🔧 수정됨
      fgcEmbedding = rawEmbedding.map(val => val / norm)
      
      method = 'FGC-Encoder (ONNX)'
      console.log(`✅ [Semantic Vector] 실제 FGC Encoder 사용: ${method}`)
      
    } catch (error) {
      console.error(`❌ [Semantic Vector] FGC Encoder 초기화 실패: ${error.message}`)
      console.log(`🔄 [Semantic Vector] 더미 모델로 폴백...`)
      
      // 더미 FGC 임베딩 생성 (512차원)
      fgcEmbedding = Array.from({ length: 512 }, () => Math.random() * 2 - 1)
      method = 'FGC-Encoder (더미)'
    }
    
    // L2 정규화 // 🔧 수정됨
    let norm = Math.sqrt(fgcEmbedding.reduce((sum, val) => sum + val * val, 0))
    if (!isFinite(norm) || norm === 0) { norm = 1 } // 🔧 수정됨
    const normalizedFGC = fgcEmbedding.map(val => val / norm)
    
    console.log(`✅ [Semantic Vector] FGC 임베딩 생성 완료: ${normalizedFGC.length}D (${method})`)

    // 3. Semantic Vector는 512차원 유지 (0-padding 제거)
    const semanticVector = normalizedFGC
    
    console.log(`✅ [Semantic Vector] semantic_vector 생성 완료: ${semanticVector.length}D`)

    res.json({
      success: true,
      semanticVector: semanticVector,
      dimensions: semanticVector.length,
      partId: partId,
      colorId: colorId,
      method: method,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error(`❌ [Semantic Vector] 생성 실패:`, error.message)
    res.status(500).json({
      success: false,
      error: error.message,
      partId: req.body.partId,
      colorId: req.body.colorId
    })
  }
})

// 벡터 정규화 엔드포인트
app.post('/api/normalize-vector', (req, res) => {
  try {
    const { vector } = req.body

    if (!vector || !Array.isArray(vector)) {
      return res.status(400).json({ error: 'Invalid vector format' })
    }

    // L2 정규화
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    const normalizedVector = vector.map(val => val / norm)

    res.json({
      success: true,
      normalizedVector: normalizedVector,
      originalNorm: norm,
      dimensions: vector.length
    })

  } catch (error) {
    console.error('❌ [벡터 정규화] 실패:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 Semantic Vector API 서버 시작됨`)
  console.log(`📡 포트: ${PORT}`)
  console.log(`🌐 URL: http://localhost:${PORT}`)
  console.log(`📋 엔드포인트:`)
  console.log(`   GET  /health - 헬스 체크`)
  console.log(`   GET  /api/proxy-image - 이미지 프록시`)
  console.log(`   POST /api/semantic-vector - semantic_vector 생성`)
  console.log(`   POST /api/normalize-vector - 벡터 정규화`)
  console.log(`⏰ 시작 시간: ${new Date().toISOString()}`)
})

// 에러 처리
process.on('uncaughtException', (error) => {
  console.error('❌ [Uncaught Exception]:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [Unhandled Rejection]:', reason)
  process.exit(1)
})
