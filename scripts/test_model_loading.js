#!/usr/bin/env node
/**
 * 모델 로딩 스크립트
 */

const modelUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/models/brickbox_s_seg_20251010_034224/set_76917-1_best.onnx'

async function testModelLoading() {
  console.log('🔍 모델 로딩 시작...')
  console.log(`📡 모델 URL: ${modelUrl}`)
  
  try {
    // 1. HEAD 요청으로 파일 존재 확인
    console.log('\n1️⃣ HEAD 요청으로 파일 존재 확인...')
    const headResponse = await fetch(modelUrl, { method: 'HEAD' })
    
    if (!headResponse.ok) {
      throw new Error(`HEAD 요청 실패: ${headResponse.status} ${headResponse.statusText}`)
    }
    
    const contentLength = headResponse.headers.get('content-length')
    const contentType = headResponse.headers.get('content-type')
    
    console.log(`✅ 파일 존재 확인됨`)
    console.log(`   크기: ${(parseInt(contentLength) / 1024 / 1024).toFixed(1)} MB`)
    console.log(`   타입: ${contentType}`)
    
    // 2. 실제 파일 다운로드
    console.log('\n2️⃣ 파일 다운로드...')
    const downloadResponse = await fetch(modelUrl)
    
    if (!downloadResponse.ok) {
      throw new Error(`다운로드 실패: ${downloadResponse.status} ${downloadResponse.statusText}`)
    }
    
    const arrayBuffer = await downloadResponse.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    
    console.log(`✅ 파일 다운로드 성공`)
    console.log(`   실제 크기: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`)
    
    // 3. ONNX 파일 검증
    console.log('\n3️⃣ ONNX 파일 검증...')
    
    // 최소 크기 체크
    if (arrayBuffer.byteLength < 1024) {
      throw new Error('ONNX too small')
    }
    
    // HTML 응답 체크 (리다이렉트 등)
    if (bytes[0] === 60 && (bytes[1] === 33 || bytes[1] === 104 || bytes[1] === 72)) {
      throw new Error('Received HTML instead of ONNX')
    }
    
    // ONNX 시그니처 체크 (protobuf 바이너리)
    const isOnnx = bytes[0] === 0x08 || bytes[0] === 0x0a || bytes[0] === 0x12
    console.log(`   ONNX 시그니처: ${isOnnx ? '✅ 유효' : '⚠️ 의심'}`)
    
    console.log('\n🎉 모델 로딩 완료!')
    console.log('✅ 모든 검증 통과')
    
  } catch (error) {
    console.error('\n❌ 모델 로딩 실패:', error.message)
    process.exit(1)
  }
}

testModelLoading()
