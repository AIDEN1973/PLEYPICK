#!/usr/bin/env node
/**
 * BrickBox 메타데이터 후처리 워커
 * 
 * function, connection, area_px, shape 등 계산 필드를 자동으로 채웁니다.
 * 
 * 실행 방법:
 *   npm install @supabase/supabase-js dotenv
 *   node scripts/postprocess_worker.js
 * 
 * 환경 변수:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * 
 * 종료:
 *   Ctrl+C
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config()

// 설정
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY
const BATCH_SIZE = 50 // 한 번에 처리할 부품 수
const POLL_INTERVAL = 30000 // 30초마다 확인
// ✅ UPDATE_CONDITION 제거 (쿼리에서 직접 조건 지정)

// 종료 플래그
let shutdownFlag = false

// ============================================
// 매핑 테이블
// ============================================

// shape_tag → function 매핑
const FUNCTION_MAP = {
  // 기본 형태 (building block)
  'plate': 'building_block',
  'brick': 'building_block',
  'tile': 'building_block',
  'slope': 'building_block',
  'panel': 'building_block',
  'wedge': 'building_block',
  'inverted': 'building_block',
  
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
// 초기화
// ============================================

function initialize() {
  console.log('='.repeat(60))
  console.log('[WORKER] BrickBox 후처리 워커 시작')
  console.log('='.repeat(60))
  console.log(`[TIME] 시작 시간: ${new Date().toISOString()}`)
  console.log(`[BATCH] 배치 크기: ${BATCH_SIZE}`)
  console.log(`[POLL] 폴링 주기: ${POLL_INTERVAL / 1000}초`)
  console.log('')

  // 환경 변수 확인
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[ERROR] 환경 변수 설정 필요:')
    console.error('  VITE_SUPABASE_URL')
    console.error('  VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  // Supabase 클라이언트 생성
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  console.log('[OK] Supabase 연결 완료')
  console.log('')
  console.log('='.repeat(60))
  console.log('[RUN] 워커 실행 중... (Ctrl+C로 종료)')
  console.log('='.repeat(60))
  console.log('')

  return supabase
}

// ============================================
// 후처리 로직
// ============================================

/**
 * function 추론
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
    // ✅ JSON 필드를 텍스트로 변환하여 비교 (->> 연산자 사용)
    const { data, error } = await supabase
      .from('parts_master_features')
      .select('id, part_id, color_id, part_name, shape_tag, distinguishing_features, bbox_ratio, feature_json')
      .or(`feature_json->>function.eq.unknown,feature_json->>connection.eq.unknown`)
      .limit(limit)

    if (error) throw error
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
      
      // 추론
      const functionValue = inferFunction(item.shape_tag, item.part_name)
      const connectionValue = inferConnection(item.shape_tag, item.part_name)
      const areaPx = calculateAreaPx(bboxRatio)
      const shape = inferDetailedShape(item.shape_tag, distinguishingFeatures)

      // feature_json 업데이트
      const featureJson = typeof item.feature_json === 'string' 
        ? JSON.parse(item.feature_json || '{}')
        : (item.feature_json || {})

      featureJson.function = functionValue
      featureJson.connection = connectionValue
      featureJson.area_px = areaPx
      if (shape) featureJson.shape = shape

      // ✅ 개별 update (part_id 보존)
      const { error } = await supabase
        .from('parts_master_features')
        .update({
          feature_json: featureJson,
          area_px: areaPx
        })
        .eq('id', item.id)

      if (error) {
        console.warn(`[WARN] 업데이트 실패 (id: ${item.id}):`, error.message)
        continue
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
    // 대상 조회
    const items = await fetchPendingItems(supabase)

    if (items.length === 0) {
      console.log(`[IDLE] 처리할 항목 없음 (${new Date().toLocaleTimeString('ko-KR')})`)
      return
    }

    console.log(`[PROCESSING] ${items.length}개 항목 처리 중...`)

    // 후처리 실행
    const updatedCount = await updateMetadata(supabase, items)

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

const supabase = initialize()
mainLoop(supabase).catch(err => {
  console.error('[FATAL] 워커 실행 실패:', err)
  process.exit(1)
})

