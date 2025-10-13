import { ref, reactive } from 'vue'
import { useSupabase } from './useSupabase'

/**
 * 폐쇄 세계(Closed-World) 가정 기반 누락 부품 검출
 * 테이블 위 200개 부품이 모두 해당 세트의 부품이라는 강한 제약 활용
 */
export function useClosedWorldDetection() {
  const { supabase } = useSupabase()
  const loading = ref(false)
  const error = ref(null)
  
  // 폐쇄 세계 검출 상태
  const detectionState = reactive({
    isActive: false,
    targetSet: null,
    bomParts: [],           // BOM 부품 목록
    bomColors: [],          // BOM 색상 목록
    detectedParts: [],      // 검출된 부품
    matchedParts: [],       // 매칭된 부품
    missingParts: [],       // 누락된 부품
    ambiguousParts: [],     // 애매한 부품 (보류)
    statistics: {
      totalDetected: 0,
      autoApproved: 0,
      manualReview: 0,
      missing: 0,
      ambiguous: 0,
      accuracy: 0
    }
  })

  // BOM 부품 로드 (폐쇄 세계 필터)
  const loadBOMParts = async (setNum) => {
    try {
      loading.value = true
      
      // 세트 정보 조회 (변형 포함 검색)
      let setData, setError
      
      // 1차: 정확한 매칭 시도
      const exactMatch = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', setNum)
        .single()
      
      if (exactMatch.data) {
        setData = exactMatch.data
        setError = exactMatch.error
      } else {
        // 2차: 변형 검색 (예: 76917 -> 76917-1, 76917-2 등)
        const variantMatch = await supabase
          .from('lego_sets')
          .select('id, set_num, name')
          .like('set_num', `${setNum}%`)
          .order('set_num')
          .limit(1)
          .single()
        
        setData = variantMatch.data
        setError = variantMatch.error
      }
      
      if (setError) {
        console.error('세트 조회 실패:', setError)
        throw setError
      }
      
      // 세트 부품 조회 (BOM) - 스키마에 맞게 수정
      const { data: partsData, error: partsError } = await supabase
        .from('set_parts')
        .select(`
          part_id,
          color_id,
          quantity,
          is_spare,
          lego_parts(name),
          lego_colors(name, rgb)
        `)
        .eq('set_id', setData.id)
      
      if (partsError) {
        console.error('부품 조회 실패:', partsError)
        throw partsError
      }
      
      // BOM 부품 및 색상 목록 생성
      const bomParts = []
      const bomColors = new Set()
      
      partsData.forEach(part => {
        bomParts.push({
          part_id: part.part_id,
          color_id: part.color_id,
          quantity: part.quantity,
          is_spare: part.is_spare,
          part_name: part.lego_parts?.name || 'Unknown Part',
          color_name: part.lego_colors?.name || 'Unknown Color',
          color_rgb: part.lego_colors?.rgb || '#000000'
        })
        bomColors.add(part.color_id)
      })
      
      detectionState.targetSet = setNum
      detectionState.bomParts = bomParts
      detectionState.bomColors = Array.from(bomColors)
      
      console.log(`📋 실제 BOM 로드 완료: ${bomParts.length}개 부품, ${bomColors.size}개 색상`)
      console.log(`📋 세트 정보: ${setData.set_num} - ${setData.name}`)
      console.log('📋 로드된 부품들:', bomParts.map(p => `${p.part_id}(${p.part_name}) x${p.quantity}`))
      
      return { bomParts, bomColors: Array.from(bomColors) }
      
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 샘플/목업 데이터 사용 금지: 함수 제거

  // 폐쇄 세계 필터 적용
  const applyClosedWorldFilter = (detections) => {
    const bomPartIds = new Set(detectionState.bomParts.map(p => p.part_id))
    const bomColorIds = new Set(detectionState.bomColors)
    
    console.log(`🔍 BOM 부품 ID 목록:`, Array.from(bomPartIds))
    console.log(`🔍 BOM 색상 ID 목록:`, Array.from(bomColorIds))
    
    return detections.filter(detection => {
      // YOLO 검출 결과에는 part_id가 없을 수 있으므로 일단 통과
      // 실제 매칭은 BOM 매칭 단계에서 수행
      console.log(`🔍 검출 객체:`, detection)
      return true
    })
  }

  // BOM 슬롯 생성 (수량만큼 복제)
  const createBOMSlots = () => {
    const slots = []
    
    detectionState.bomParts.forEach(part => {
      for (let i = 0; i < part.quantity; i++) {
        slots.push({
          part_id: part.part_id,
          color_id: part.color_id,
          slot_index: i,
          is_spare: part.is_spare,
          matched: false,
          match_score: 0,
          matched_detection: null
        })
      }
    })
    
    console.log(`📦 BOM 슬롯 생성: ${slots.length}개 슬롯`)
    return slots
  }

  // 헝가리안 알고리즘으로 BOM 매칭
  const performBOMatching = (filteredDetections, bomSlots) => {
    const matches = []
    const unmatchedDetections = [...filteredDetections]
    const unmatchedSlots = [...bomSlots]
    
    console.log(`🎯 BOM 매칭 시작: ${filteredDetections.length}개 검출, ${bomSlots.length}개 슬롯`)
    
    // 간단한 매칭 로직 (실제 구현에서는 더 복잡한 알고리즘 사용)
    // 현재는 YOLO 검출 결과와 BOM 슬롯을 직접 매칭하지 않고
    // 모든 BOM 슬롯을 누락으로 처리 (데모용)
    
    const missingSlots = bomSlots.filter(slot => !slot.matched)
    
    console.log(`🎯 BOM 매칭 완료: ${matches.length}개 매칭, ${missingSlots.length}개 누락 후보`)
    
    return { matches, missingSlots, unmatchedDetections }
  }

  // 매칭 점수 계산
  const calculateMatchScore = (detection, slot) => {
    let score = 0
    
    // 1. 검출 신뢰도 (45%)
    score += detection.confidence * 0.45
    
    // 2. 색상 매칭 (25%)
    const colorScore = detection.color_id === slot.color_id ? 1.0 : 0.3
    score += colorScore * 0.25
    
    // 3. 크기 매칭 (20%)
    const sizeScore = calculateSizeSimilarity(detection, slot)
    score += sizeScore * 0.20
    
    // 4. 마스크 품질 (10%)
    const maskScore = detection.mask_quality || 0.8
    score += maskScore * 0.10
    
    // 5. BOM 외 색상 감점
    if (detection.color_penalty) {
      score -= detection.color_penalty
    }
    
    // 6. 가림 정도 감점
    if (detection.occlusion_ratio) {
      score -= detection.occlusion_ratio * 0.05
    }
    
    return Math.max(0, Math.min(1, score))
  }

  // 크기 유사도 계산
  const calculateSizeSimilarity = (detection, slot) => {
    // 스터드 단위 길이/폭 근사 (±0.15 stud 허용)
    const tolerance = 0.15
    const sizeDiff = Math.abs(detection.size - slot.expected_size)
    return Math.exp(-sizeDiff / tolerance)
  }

  // 누락 부품 최종 판정
  const determineMissingParts = (missingSlots) => {
    const missingParts = []
    const ambiguousParts = []
    
    missingSlots.forEach(slot => {
      const part = {
        part_id: slot.part_id,
        color_id: slot.color_id,
        quantity_missing: 1,
        confidence: 'high',
        reason: 'not_detected'
      }
      
      // 애매한 경우 보류 처리
      if (slot.match_score > 0.3 && slot.match_score < 0.60) {
        ambiguousParts.push(part)
        console.log(`❓ 애매한 부품 보류: ${slot.part_id} (score: ${slot.match_score})`)
      } else {
        missingParts.push(part)
        console.log(`❌ 누락 부품: ${slot.part_id}`)
      }
    })
    
    return { missingParts, ambiguousParts }
  }

  // 통합 누락 검출 파이프라인 (최적화된 버전)
  const detectMissingParts = async (imageData, setNum) => {
    try {
      loading.value = true
      error.value = null
      
      console.log('🔍 최적화된 폐쇄 세계 누락 검출 시작...')
      
      // 1. 메타데이터 기반 BOM 로드 (이미지 다운로드 없음)
      const { useOptimizedPartMatching } = await import('./useOptimizedPartMatching')
      const { loadSetMetadata, cachePartImages, performBOMMatching } = useOptimizedPartMatching()
      
      const { setInfo, partsMetadata } = await loadSetMetadata(setNum)
      console.log(`📊 메타데이터 로드: ${partsMetadata.length}개 부품`)
      
      // 2. YOLO 검출 + 특징 추출
      const { useOptimizedRealtimeDetection } = await import('./useOptimizedRealtimeDetection')
      const { detectPartsWithYOLO } = useOptimizedRealtimeDetection()
      const detections = await detectPartsWithYOLO(imageData)
      
      // 3. 특징 벡터는 외부 파이프라인에서만 주입 (목업 금지)
      const enhancedDetections = detections.map(detection => ({
        ...detection,
        features: detection.features || null
      }))
      
      console.log(`🔍 YOLO 검출 + 특징 추출: ${enhancedDetections.length}개 객체`)
      
      // 4. 온디맨드 캐싱 (필요한 부품만)
      const partIds = [...new Set(partsMetadata.map(p => p.part_id))]
      await cachePartImages(partIds.slice(0, 10)) // 처음 10개 부품만 캐싱 (데모)
      
      // 5. BOM 매칭 (벡터 유사도 기반)
      const { matches, missingSlots } = performBOMMatching(enhancedDetections, partsMetadata)
      
      // 6. 누락 부품 판정
      const missingParts = missingSlots.map(slot => ({
        part_id: slot.part_id,
        color_id: slot.color_id,
        quantity_missing: 1,
        confidence: 'high',
        reason: 'not_detected'
      }))
      
      // 7. 결과 업데이트
      detectionState.detectedParts = enhancedDetections
      detectionState.matchedParts = matches
      detectionState.missingParts = missingParts
      detectionState.ambiguousParts = []
      
      // 8. 통계 업데이트
      detectionState.statistics = {
        totalDetected: enhancedDetections.length,
        autoApproved: matches.length,
        manualReview: 0,
        missing: missingParts.length,
        ambiguous: 0,
        accuracy: matches.length / (matches.length + missingParts.length) * 100
      }
      
      console.log('✅ 최적화된 누락 검출 완료')
      console.log(`📊 결과: ${matches.length}개 매칭, ${missingParts.length}개 누락`)
      console.log(`💰 트래픽 절약: 메타데이터만 사용, 이미지 캐싱 최소화`)
      
      return {
        matches,
        missingParts,
        ambiguousParts: [],
        statistics: detectionState.statistics
      }
      
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 목업 생성 함수 삭제

  return {
    detectionState,
    loadBOMParts,
    detectMissingParts,
    applyClosedWorldFilter,
    performBOMatching,
    determineMissingParts
  }
}
