#!/usr/bin/env node
/**
 * BrickBox 메타데이터 후처리 워커 (HTTP 서버 포함)
 * 
 * function, connection, area_px, shape 등 계산 필드를 자동으로 채웁니다.
 * HTTP 서버를 통해 상태 모니터링 및 제어 가능
 * 
 * 실행 방법:
 *   npm install @supabase/supabase-js dotenv express cors
 *   node scripts/postprocess_worker.js
 * 
 * 환경 변수:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   POSTPROCESS_PORT (기본값: 3021)
 * 
 * 종료:
 *   Ctrl+C
 */

import { createClient } from '@supabase/supabase-js'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config()

// 설정
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
const BATCH_SIZE = 50 // 한 번에 처리할 부품 수
const POLL_INTERVAL = 30000 // 30초마다 확인
const PORT = process.env.POSTPROCESS_PORT || 3021 // HTTP 서버 포트
// ✅ UPDATE_CONDITION 제거 (쿼리에서 직접 조건 지정)

// 종료 플래그
let shutdownFlag = false

// 워커 상태 추적
let workerStats = {
  startTime: new Date().toISOString(),
  totalProcessed: 0,
  lastProcessTime: null,
  isRunning: false,
  currentBatch: 0,
  errors: 0
}

// ============================================
// 매핑 테이블
// ============================================

// shape_tag → function 매핑 (데이터베이스 기반)
const FUNCTION_MAP = {
  // 기본 형태 (building block)
  'plate': 'building_block',
  'brick': 'building_block',
  'tile': 'building_block',
  'slope': 'building_block',
  'panel': 'building_block',
  'wedge': 'building_block',
  'inverted': 'building_block',
  'baseplate': 'foundation', // 베이스플레이트 추가
  
  // 원형/곡면 (building block)
  'cylinder': 'building_block',
  'cone': 'building_block',
  'arch': 'building_block',
  'round': 'building_block',
  'dish': 'building_block',
  'roof': 'building_block',
  
  // 연결 부품 (connector)
  'hinge': 'connector',
  'clip': 'connector',
  'bar': 'connector',
  
  // 기계 부품 (mechanical)
  'gear': 'mechanical',
  'axle': 'mechanical',
  'wheel': 'movement',
  'tire': 'movement',
  
  // 장식/구조 (decoration/structure)
  'fence': 'structure',
  'door': 'structure',
  'window': 'structure',
  'wing': 'decoration',
  'propeller': 'mechanical',
  
  // 특수 부품
  'minifig_part': 'minifigure',
  'animal_figure': 'decoration',
  'plant_leaf': 'decoration',
  'chain': 'connector',
  
  // 레거시 호환
  'technic': 'mechanical',
  'minifig': 'minifigure',
  'duplo': 'building_block',
  
  // 기본값
  'unknown': 'unknown'
}

// shape_tag → connection 매핑
const CONNECTION_MAP = {
  // 스터드 연결
  'plate': 'stud_connection',
  'brick': 'stud_connection',
  'tile': 'stud_connection',
  'slope': 'stud_connection',
  'panel': 'stud_connection',
  'wedge': 'stud_connection',
  'cylinder': 'stud_connection',
  'cone': 'stud_connection',
  'arch': 'stud_connection',
  'round': 'stud_connection',
  'dish': 'stud_connection',
  'roof': 'stud_connection',
  'inverted': 'stud_connection',
  'baseplate': 'stud_connection', // 베이스플레이트 추가
  
  // 특수 연결
  'hinge': 'hinge_connection',
  'clip': 'clip_connection',
  'bar': 'bar_connection',
  'fence': 'bar_connection',
  'axle': 'axle_connection',
  'gear': 'axle_connection',
  'chain': 'chain_connection',
  
  // 움직임 부품
  'wheel': 'axle_connection',
  'tire': 'friction_fit',
  
  // 장식/미니피규어
  'door': 'hinge_connection',
  'window': 'clip_connection',
  'wing': 'clip_connection',
  'propeller': 'axle_connection',
  'minifig_part': 'ball_joint',
  'animal_figure': 'integrated',
  'plant_leaf': 'bar_connection',
  
  // 레거시
  'technic': 'pin_connection',
  'minifig': 'ball_joint',
  'duplo': 'stud_connection',
  
  // 기본값
  'unknown': 'unknown'
}

// ============================================
// HTTP 서버 설정
// ============================================

function setupHttpServer() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // 헬스체크 엔드포인트
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'postprocess-worker',
      timestamp: new Date().toISOString(),
      stats: workerStats
    })
  })

  // 워커 상태 조회
  app.get('/api/worker/status', (req, res) => {
    res.json({
      ...workerStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    })
  })

  // 워커 제어 (시작/정지)
  app.post('/api/worker/control', (req, res) => {
    const { action } = req.body
    
    if (action === 'start') {
      workerStats.isRunning = true
      res.json({ message: '워커 시작됨', status: 'running' })
    } else if (action === 'stop') {
      workerStats.isRunning = false
      res.json({ message: '워커 정지됨', status: 'stopped' })
    } else if (action === 'reset') {
      workerStats.totalProcessed = 0
      workerStats.errors = 0
      workerStats.currentBatch = 0
      res.json({ message: '워커 통계 초기화됨' })
    } else {
      res.status(400).json({ error: 'Invalid action. Use: start, stop, reset' })
    }
  })

  // 처리 통계 조회
  app.get('/api/worker/stats', (req, res) => {
    const uptime = process.uptime()
    const avgProcessingRate = workerStats.totalProcessed / (uptime / 60) // 분당 처리량
    
    res.json({
      ...workerStats,
      uptime: uptime,
      avgProcessingRate: Math.round(avgProcessingRate * 100) / 100,
      memory: process.memoryUsage()
    })
  })

  return app
}

// ============================================
// 초기화
// ============================================

function initialize() {
  console.log('='.repeat(60))
  console.log('[WORKER] BrickBox 후처리 워커 시작 (HTTP 서버 포함)')
  console.log('='.repeat(60))
  console.log(`[TIME] 시작 시간: ${new Date().toISOString()}`)
  console.log(`[BATCH] 배치 크기: ${BATCH_SIZE}`)
  console.log(`[POLL] 폴링 주기: ${POLL_INTERVAL / 1000}초`)
  console.log(`[HTTP] 서버 포트: ${PORT}`)
  console.log('')

  // 환경 변수 확인
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[ERROR] 환경 변수 설정 필요:')
    console.error('  VITE_SUPABASE_URL 또는 SUPABASE_URL')
    console.error('  VITE_SUPABASE_ANON_KEY 또는 SUPABASE_KEY')
    process.exit(1)
  }
  
  console.log('[INFO] Supabase 연결 정보:')
  console.log(`  URL: ${SUPABASE_URL}`)
  console.log(`  KEY: ${SUPABASE_KEY ? '설정됨' : '설정되지 않음'}`)

  // Supabase 클라이언트 생성
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  console.log('[OK] Supabase 연결 완료')
  
  // HTTP 서버 시작
  const app = setupHttpServer()
  const server = app.listen(PORT, () => {
    console.log(`[HTTP] 서버 시작: http://localhost:${PORT}`)
    console.log(`[HTTP] 헬스체크: http://localhost:${PORT}/health`)
    console.log(`[HTTP] 상태 조회: http://localhost:${PORT}/api/worker/status`)
    console.log(`[HTTP] 통계 조회: http://localhost:${PORT}/api/worker/stats`)
  })
  
  console.log('')
  console.log('='.repeat(60))
  console.log('[RUN] 워커 실행 중... (Ctrl+C로 종료)')
  console.log('='.repeat(60))
  console.log('')

  return { supabase, server }
}

// ============================================
// 후처리 로직
// ============================================

/**
 * shape_tag 텍스트 기반 추론
 */
function inferShapeTagFromText(featureText, distinguishingFeatures, partName = '') {
  const text = (featureText || '').toLowerCase()
  const features = (distinguishingFeatures || []).join(' ').toLowerCase()
  const name = (partName || '').toLowerCase()
  const combined = `${text} ${features} ${name}`

  // 동물 피규어 감지
  if (combined.includes('동물') || combined.includes('animal') || 
      combined.includes('호랑이') || combined.includes('펭귄') || 
      combined.includes('figure') || combined.includes('피규어')) {
    return 'animal_figure'
  }
  
  // 브릭/블록 감지
  if (combined.includes('브릭') || combined.includes('brick') || 
      combined.includes('블록') || combined.includes('block') ||
      combined.includes('2x2') || combined.includes('2x4')) {
    return 'brick'
  }
  
  // 플레이트 감지
  if (combined.includes('플레이트') || combined.includes('plate') ||
      combined.includes('평평') || combined.includes('flat')) {
    return 'plate'
  }
  
  // 타일 감지
  if (combined.includes('타일') || combined.includes('tile') ||
      combined.includes('얇은')) {
    return 'tile'
  }
  
  // 슬로프 감지
  if (combined.includes('경사') || combined.includes('slope') ||
      combined.includes('기울')) {
    return 'slope'
  }
  
  // 미니피그 부품 감지
  if (combined.includes('미니피그') || combined.includes('minifig') ||
      combined.includes('머리') || combined.includes('몸통') ||
      combined.includes('다리') || combined.includes('헬멧')) {
    return 'minifig_part'
  }
  
  // 기본값: 브릭으로 분류
  return 'brick'
}

/**
 * 데이터베이스에서 part_categories 기반 function 추론
 */
async function inferFunctionFromDB(shapeTag, partName = '') {
  try {
    // 1차: 통합 카테고리 시스템 사용
    const { data: category, error } = await supabase
      .from('part_categories')
      .select('code, display_name, display_name_ko, category_type, function, connection')
      .eq('code', shapeTag)
      .eq('is_active', true)
      .single()
    
    if (!error && category) {
      // 데이터베이스에 function이 직접 저장되어 있음
      if (category.function) {
        console.log(`✅ [통합 DB] ${shapeTag} → ${category.function} (DB에서 직접 조회)`)
        return category.function
      }
      
      // 폴백: 기존 매핑 테이블 사용
      const categoryCode = category.code
      if (FUNCTION_MAP[categoryCode]) {
        console.log(`✅ [DB 매핑] ${shapeTag} → ${FUNCTION_MAP[categoryCode]} (매핑 테이블 사용)`)
        return FUNCTION_MAP[categoryCode]
      }
    }
  } catch (err) {
    console.warn(`⚠️ [DB 조회 실패] ${shapeTag}:`, err.message)
  }
  
  // 2차: 하드코딩된 매핑 사용 (폴백)
  const fallbackFunction = inferFunction(shapeTag, partName)
  
  // 3차: 최종 폴백 - shape_tag 기반 강제 매핑
  if (fallbackFunction === 'unknown') {
    console.log(`⚠️ [강제 매핑] ${shapeTag} → building_block (최종 폴백)`)
    return 'building_block'  // unknown 방지
  }
  
  return fallbackFunction
}

/**
 * function 추론 (폴백)
 */
function inferFunction(shapeTag, partName = '') {
  // 매핑 테이블에서 찾기
  const mapped = FUNCTION_MAP[shapeTag]
  if (mapped && mapped !== 'unknown') {
    return mapped
  }

  // part_name 기반 추가 추론
  const nameLower = partName.toLowerCase()
  
  if (nameLower.includes('gear') || nameLower.includes('cog')) {
    return 'mechanical'
  }
  if (nameLower.includes('wheel') || nameLower.includes('tire')) {
    return 'movement'
  }
  if (nameLower.includes('hinge') || nameLower.includes('joint')) {
    return 'connector'
  }
  if (nameLower.includes('minifig') || nameLower.includes('figure')) {
    return 'minifigure'
  }
  if (nameLower.includes('animal') || nameLower.includes('plant')) {
    return 'decoration'
  }
  if (nameLower.includes('door') || nameLower.includes('window')) {
    return 'structure'
  }

  return 'unknown'
}

/**
 * connection 추론
 */
function inferConnection(shapeTag, partName = '') {
  // 매핑 테이블에서 찾기
  const mapped = CONNECTION_MAP[shapeTag]
  if (mapped && mapped !== 'unknown') {
    return mapped
  }

  // part_name 기반 추가 추론
  const nameLower = partName.toLowerCase()
  
  if (nameLower.includes('hinge')) {
    return 'hinge_connection'
  }
  if (nameLower.includes('clip')) {
    return 'clip_connection'
  }
  if (nameLower.includes('bar') || nameLower.includes('pole')) {
    return 'bar_connection'
  }
  if (nameLower.includes('axle') || nameLower.includes('pin')) {
    return 'axle_connection'
  }
  if (nameLower.includes('stud') || nameLower.includes('plate') || nameLower.includes('brick')) {
    return 'stud_connection'
  }

  return 'unknown'
}

/**
 * area_px 계산 (bbox_ratio 기반)
 */
function calculateAreaPx(bboxRatio, resolution = 768) {
  if (!Array.isArray(bboxRatio) || bboxRatio.length !== 2) {
    return 0
  }
  
  const [widthRatio, heightRatio] = bboxRatio
  const width = widthRatio * resolution
  const height = heightRatio * resolution
  
  return Math.round(width * height)
}

/**
 * shape 상세 추론 (선택사항)
 */
function inferDetailedShape(shapeTag, distinguishingFeatures = []) {
  if (!Array.isArray(distinguishingFeatures) || distinguishingFeatures.length === 0) {
    return ''
  }

  const featuresStr = distinguishingFeatures.join(' ').toLowerCase()

  // 특수 형태 감지
  if (featuresStr.includes('curved') || featuresStr.includes('곡선')) {
    return 'curved'
  }
  if (featuresStr.includes('angular') || featuresStr.includes('각진')) {
    return 'angular'
  }
  if (featuresStr.includes('rounded') || featuresStr.includes('둥근')) {
    return 'rounded'
  }

  return ''
}

// ============================================
// 큐 처리
// ============================================

/**
 * 후처리 대상 조회
 * ✅ JSON 필드 조건을 올바르게 처리 (PostgREST 구문)
 */
async function fetchPendingItems(supabase, limit = BATCH_SIZE) {
  try {
    console.log('[DEBUG] 큐 조회 시작...')
    
    // ✅ JSON 필드를 텍스트로 변환하여 비교 (->> 연산자 사용)
    // ✅ 최근 1시간 내 업데이트된 항목 제외 (중복 처리 방지)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('parts_master_features')
      .select('id, part_id, color_id, part_name, shape_tag, feature_text, distinguishing_features, bbox_ratio, feature_json, updated_at')
      .or(`feature_json->>function.eq.unknown,feature_json->>connection.eq.unknown`)
      .lt('updated_at', oneHourAgo)  // 1시간 이전 항목만
      .limit(limit)

    if (error) throw error
    
    console.log(`[DEBUG] 큐 조회 완료: ${data?.length || 0}개 항목`)
    if (data && data.length > 0) {
      console.log('[DEBUG] 샘플 데이터:', {
        id: data[0].id,
        part_id: data[0].part_id,
        shape_tag: data[0].shape_tag,
        feature_json: data[0].feature_json
      })
    }
    
    return data || []
  } catch (err) {
    console.error('[ERROR] 큐 조회 실패:', err.message)
    return []
  }
}

/**
 * 메타데이터 업데이트
 * ✅ 개별 update로 변경 (upsert의 not-null 제약 문제 해결)
 */
async function updateMetadata(supabase, items) {
  let successCount = 0
  
  for (const item of items) {
    try {
      const bboxRatio = item.bbox_ratio || [0.8, 0.8]
      const distinguishingFeatures = item.distinguishing_features || []
      
      // shape_tag가 unknown인 경우 텍스트 기반 추론
      let actualShapeTag = item.shape_tag
      if (actualShapeTag === 'unknown') {
        actualShapeTag = inferShapeTagFromText(
          item.feature_text,  // 테이블 컬럼에서 직접 가져오기
          item.distinguishing_features,  // 테이블 컬럼에서 직접 가져오기
          item.part_name
        )
        console.log(`[INFER] ${item.part_id}: unknown → ${actualShapeTag}`)
      }
      
      // 추론
      const functionValue = await inferFunctionFromDB(actualShapeTag, item.part_name)
      const connectionValue = inferConnection(actualShapeTag, item.part_name)
      
      // 새로운 카테고리 감지 시 로깅
      if (functionValue === 'unknown' || connectionValue === 'unknown') {
        console.log(`🔍 [새 카테고리 감지] ${actualShapeTag} (${item.part_id})`)
        
        // unknown_category_logs에 로깅 (RLS 정책으로 인해 조용히 실패)
        try {
          const { error: logError } = await supabase
            .from('unknown_category_logs')
            .upsert({
              shape_tag: actualShapeTag,
              part_id: item.part_id,
              part_name: item.part_name,
              detected_count: 1,
              first_detected_at: new Date().toISOString(),
              last_detected_at: new Date().toISOString(),
              metadata: {
                confidence: item.confidence || 0.0,
                source: 'postprocess_worker',
                feature_text: item.feature_text,
                distinguishing_features: item.distinguishing_features
              }
            }, { 
              onConflict: 'shape_tag',
              ignoreDuplicates: false 
            })
          
          if (!logError) {
            console.log(`✅ [새 카테고리 로그] ${actualShapeTag} 기록됨`)
          }
        } catch (err) {
          // RLS 정책으로 인한 실패는 조용히 무시
          console.log(`⚠️ [로그 실패] ${actualShapeTag} (RLS 정책)`)
        }
      }
      const areaPx = calculateAreaPx(bboxRatio)
      const shape = inferDetailedShape(actualShapeTag, distinguishingFeatures)

      // feature_json 업데이트
      const featureJson = typeof item.feature_json === 'string' 
        ? JSON.parse(item.feature_json || '{}')
        : (item.feature_json || {})

      featureJson.function = functionValue
      featureJson.connection = connectionValue
      featureJson.area_px = areaPx
      featureJson.shape_tag = actualShapeTag  // 추론된 shape_tag 업데이트
      if (shape) featureJson.shape = shape

      // ✅ 개별 update (part_id 보존)
      console.log(`[UPDATE] ID ${item.id} 업데이트 시도:`, {
        function: functionValue,
        connection: connectionValue,
        area_px: areaPx,
        shape_tag: actualShapeTag
      })
      
      // ✅ 처리 상태 추가 (중복 처리 방지)
      const { error } = await supabase
        .from('parts_master_features')
        .update({
          feature_json: featureJson,
          area_px: areaPx,
          shape_tag: actualShapeTag,  // DB의 shape_tag 컬럼도 업데이트
          processing_status: 'completed',  // 처리 완료 표시
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)

      if (error) {
        console.error(`[ERROR] 업데이트 실패 (id: ${item.id}):`, error)
        console.error(`[ERROR] 오류 상세:`, JSON.stringify(error, null, 2))
        continue
      } else {
        console.log(`[SUCCESS] ID ${item.id} 업데이트 성공`)
      }

      successCount++
    } catch (err) {
      console.warn(`[WARN] 항목 처리 실패 (id: ${item.id}):`, err.message)
    }
  }

  return successCount
}

// ============================================
// 메인 루프
// ============================================

async function processQueue(supabase) {
  try {
    // 워커가 정지 상태면 처리하지 않음
    if (!workerStats.isRunning) {
      return
    }

    // 대상 조회
    const items = await fetchPendingItems(supabase)

    if (items.length === 0) {
      console.log(`[IDLE] 처리할 항목 없음 (${new Date().toLocaleTimeString('ko-KR')})`)
      return
    }

    console.log(`[PROCESSING] ${items.length}개 항목 처리 중...`)
    workerStats.currentBatch = items.length
    workerStats.lastProcessTime = new Date().toISOString()

    // 후처리 실행
    const updatedCount = await updateMetadata(supabase, items)

    // 통계 업데이트
    workerStats.totalProcessed += updatedCount
    if (updatedCount < items.length) {
      workerStats.errors += (items.length - updatedCount)
    }

    console.log(`[SUCCESS] ${updatedCount}개 항목 업데이트 완료`)
    
    // 처리 내용 샘플 로그
    if (items.length > 0) {
      const sample = items[0]
      const func = inferFunction(sample.shape_tag, sample.part_name)
      const conn = inferConnection(sample.shape_tag, sample.part_name)
      console.log(`  └─ 샘플: ${sample.part_id} (${sample.shape_tag}) → function: ${func}, connection: ${conn}`)
    }

  } catch (err) {
    console.error('[ERROR] 처리 실패:', err.message)
    workerStats.errors++
  }
}

async function mainLoop(supabase) {
  while (!shutdownFlag) {
    await processQueue(supabase)
    
    // 대기
    if (!shutdownFlag) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
    }
  }

  console.log('[STOP] 워커 종료됨')
  process.exit(0)
}

// ============================================
// 시그널 핸들러
// ============================================

process.on('SIGINT', () => {
  console.log('\n[STOP] 종료 신호 수신... 정리 중...')
  shutdownFlag = true
})

process.on('SIGTERM', () => {
  console.log('\n[STOP] 종료 신호 수신... 정리 중...')
  shutdownFlag = true
})

// ============================================
// 실행
// ============================================

const { supabase, server } = initialize()

// 워커 시작 (기본적으로 실행 상태)
workerStats.isRunning = true

mainLoop(supabase).catch(err => {
  console.error('[FATAL] 워커 실행 실패:', err)
  process.exit(1)
})

// 서버 종료 시 워커도 종료
server.on('close', () => {
  console.log('[STOP] HTTP 서버 종료됨')
  shutdownFlag = true
})

