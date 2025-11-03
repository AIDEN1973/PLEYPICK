import { ref, reactive } from 'vue'

/**
 * BOM 제약 시스템 구현 (기술문서 핵심 설계 철학)
 * "Closed-World by BOM" - 세트별 폐쇄 환경 보장
 */
export function useBOMConstraint() {
  const loading = ref(false)
  const error = ref(null)
  const bomStats = reactive({
    totalSets: 0,
    activeConstraints: 0,
    violationsBlocked: 0,
    partsAllowed: 0
  })

  // BOM 제약 설정 (기술문서 기준)
  const bomConfig = {
    // 세트별 폐쇄 환경 (기술문서 핵심)
    closedWorld: {
      enabled: true,
      strictMode: true,  // BOM에 없는 부품 완전 차단
      allowUnknown: false // 알 수 없는 부품 허용 안함
    },
    
    // 수량 제한 관리
    quantityControl: {
      enabled: true,
      trackUsage: true,  // 사용량 실시간 추적
      preventOveruse: true // 초과 사용 방지
    },
    
    // 부품 검증 규칙
    validationRules: {
      partIdRequired: true,    // part_id 필수
      colorIdRequired: true,   // color_id 필수
      elementIdRequired: true, // element_id 필수
      validateExistence: true  // BOM 내 존재 여부 검증
    },
    
    // 성능 최적화
    performance: {
      cacheSize: 1000,        // BOM 캐시 크기
      cacheTimeout: 300000,   // 5분 캐시 유지
      batchValidation: true   // 배치 검증 활성화
    }
  }

  // BOM 상태 관리
  const bomState = reactive({
    currentSet: null,
    parts: new Map(),      // part_id -> {quantity, used, available}
    colors: new Map(),     // color_id -> {name, rgb}
    elements: new Map(),   // element_id -> {part_id, color_id}
    lastUpdated: null
  })

  /**
   * BOM 데이터 로드 (세트별)
   */
  const loadBOMData = async (setNum) => {
    try {
      loading.value = true
      error.value = null
      
      console.log(`📋 BOM 데이터 로드 시작: 세트 ${setNum}`)
      
      // TODO: 실제 Supabase에서 BOM 데이터 조회
      // 현재는 모의 데이터 사용
      const mockBOMData = generateMockBOMData(setNum)
      
      // BOM 상태 초기화
      bomState.currentSet = setNum
      bomState.parts.clear()
      bomState.colors.clear()
      bomState.elements.clear()
      
      // 부품 데이터 로드
      for (const part of mockBOMData.parts) {
        bomState.parts.set(part.part_id, {
          quantity: part.quantity,
          used: 0,
          available: part.quantity,
          color_id: part.color_id,
          element_id: part.element_id
        })
      }
      
      // 색상 데이터 로드
      for (const color of mockBOMData.colors) {
        bomState.colors.set(color.color_id, {
          name: color.name,
          rgb: color.rgb
        })
      }
      
      // Element ID 매핑
      for (const part of mockBOMData.parts) {
        if (part.element_id) {
          bomState.elements.set(part.element_id, {
            part_id: part.part_id,
            color_id: part.color_id
          })
        }
      }
      
      bomState.lastUpdated = new Date().toISOString()
      bomStats.totalSets++
      bomStats.activeConstraints = bomState.parts.size
      
      console.log(`✅ BOM 데이터 로드 완료: ${bomState.parts.size}개 부품, ${bomState.colors.size}개 색상`)
      
      return {
        success: true,
        partsCount: bomState.parts.size,
        colorsCount: bomState.colors.size,
        elementsCount: bomState.elements.size
      }
      
    } catch (err) {
      console.error('❌ BOM 데이터 로드 실패:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * 모의 BOM 데이터 생성 (테스트용)
   */
  const generateMockBOMData = (setNum) => {
    return {
      set_num: setNum,
      parts: [
        { part_id: '3001', color_id: 1, element_id: '300101', quantity: 4 },
        { part_id: '3002', color_id: 1, element_id: '300201', quantity: 2 },
        { part_id: '3003', color_id: 1, element_id: '300301', quantity: 6 },
        { part_id: '3004', color_id: 1, element_id: '300401', quantity: 8 },
        { part_id: '3001', color_id: 4, element_id: '300104', quantity: 2 },
        { part_id: '3002', color_id: 4, element_id: '300204', quantity: 1 },
        { part_id: '3005', color_id: 1, element_id: '300501', quantity: 4 },
        { part_id: '3006', color_id: 1, element_id: '300601', quantity: 2 },
        { part_id: '3007', color_id: 1, element_id: '300701', quantity: 3 },
        { part_id: '3008', color_id: 1, element_id: '300801', quantity: 1 }
      ],
      colors: [
        { color_id: 1, name: 'White', rgb: '#FFFFFF' },
        { color_id: 4, name: 'Bright Red', rgb: '#B40000' },
        { color_id: 7, name: 'Blue', rgb: '#0055BF' },
        { color_id: 11, name: 'Black', rgb: '#05131D' }
      ]
    }
  }

  /**
   * 부품 사용 가능 여부 검증 (기술문서 핵심)
   */
  const validatePartUsage = (partId, colorId, elementId) => {
    try {
      // 1. BOM에 부품이 있는지 확인
      const bomPart = bomState.parts.get(partId)
      if (!bomPart) {
        console.log(`❌ BOM 제약 위반: 부품 ${partId}가 BOM에 없음`)
        bomStats.violationsBlocked++
        return {
          allowed: false,
          reason: 'part_not_in_bom',
          message: `부품 ${partId}가 세트 ${bomState.currentSet}의 BOM에 없습니다`
        }
      }
      
      // 2. 색상이 일치하는지 확인
      if (bomPart.color_id !== colorId) {
        console.log(`❌ BOM 제약 위반: 부품 ${partId}의 색상 불일치 (BOM: ${bomPart.color_id}, 요청: ${colorId})`)
        bomStats.violationsBlocked++
        return {
          allowed: false,
          reason: 'color_mismatch',
          message: `부품 ${partId}의 색상이 BOM과 일치하지 않습니다`
        }
      }
      
      // 3. Element ID가 일치하는지 확인
      if (elementId && bomPart.element_id !== elementId) {
        console.log(`❌ BOM 제약 위반: 부품 ${partId}의 Element ID 불일치`)
        bomStats.violationsBlocked++
        return {
          allowed: false,
          reason: 'element_id_mismatch',
          message: `부품 ${partId}의 Element ID가 BOM과 일치하지 않습니다`
        }
      }
      
      // 4. 수량 제한 확인
      if (bomPart.used >= bomPart.quantity) {
        console.log(`❌ BOM 제약 위반: 부품 ${partId} 수량 초과 (사용: ${bomPart.used}/${bomPart.quantity})`)
        bomStats.violationsBlocked++
        return {
          allowed: false,
          reason: 'quantity_exceeded',
          message: `부품 ${partId}의 사용량이 BOM 수량을 초과했습니다`
        }
      }
      
      // 5. 모든 검증 통과
      console.log(`✅ BOM 제약 통과: 부품 ${partId} 사용 가능`)
      bomStats.partsAllowed++
      
      return {
        allowed: true,
        reason: 'valid',
        message: `부품 ${partId} 사용 가능`,
        available: bomPart.available,
        used: bomPart.used,
        total: bomPart.quantity
      }
      
    } catch (err) {
      console.error('❌ BOM 검증 실패:', err)
      return {
        allowed: false,
        reason: 'validation_error',
        message: `BOM 검증 중 오류 발생: ${err.message}`
      }
    }
  }

  /**
   * 부품 사용 등록 (수량 추적)
   */
  const registerPartUsage = (partId, colorId, elementId) => {
    try {
      const bomPart = bomState.parts.get(partId)
      if (!bomPart) {
        console.error(`❌ 부품 사용 등록 실패: ${partId}가 BOM에 없음`)
        return false
      }
      
      // 사용량 증가
      bomPart.used++
      bomPart.available = bomPart.quantity - bomPart.used
      
      console.log(`📝 부품 사용 등록: ${partId} (${bomPart.used}/${bomPart.quantity})`)
      
      return true
      
    } catch (err) {
      console.error('❌ 부품 사용 등록 실패:', err)
      return false
    }
  }

  /**
   * 부품 사용 해제 (수량 복원)
   */
  const unregisterPartUsage = (partId, colorId, elementId) => {
    try {
      const bomPart = bomState.parts.get(partId)
      if (!bomPart) {
        console.error(`❌ 부품 사용 해제 실패: ${partId}가 BOM에 없음`)
        return false
      }
      
      // 사용량 감소
      if (bomPart.used > 0) {
        bomPart.used--
        bomPart.available = bomPart.quantity - bomPart.used
        console.log(`📝 부품 사용 해제: ${partId} (${bomPart.used}/${bomPart.quantity})`)
      }
      
      return true
      
    } catch (err) {
      console.error('❌ 부품 사용 해제 실패:', err)
      return false
    }
  }

  /**
   * BOM 상태 조회
   */
  const getBOMStatus = () => {
    return {
      currentSet: bomState.currentSet,
      totalParts: bomState.parts.size,
      usedParts: Array.from(bomState.parts.values()).reduce((sum, part) => sum + part.used, 0),
      availableParts: Array.from(bomState.parts.values()).reduce((sum, part) => sum + part.available, 0),
      lastUpdated: bomState.lastUpdated,
      stats: { ...bomStats }
    }
  }

  /**
   * BOM 제약 검증 (배치)
   */
  const validateBatch = (detections) => {
    try {
      const results = []
      const violations = []
      
      for (const detection of detections) {
        const { part_id, color_id, element_id } = detection
        
        const validation = validatePartUsage(part_id, color_id, element_id)
        
        results.push({
          detection,
          validation,
          allowed: validation.allowed
        })
        
        if (!validation.allowed) {
          violations.push({
            detection,
            reason: validation.reason,
            message: validation.message
          })
        }
      }
      
      console.log(`🔍 배치 BOM 검증 완료: ${results.length}개 중 ${violations.length}개 위반`)
      
      return {
        results,
        violations,
        violationCount: violations.length,
        allowedCount: results.length - violations.length
      }
      
    } catch (err) {
      console.error('❌ 배치 BOM 검증 실패:', err)
      throw err
    }
  }

  /**
   * BOM 제약 필터링 (헝가리안 알고리즘과 연동)
   */
  const filterByBOMConstraints = (candidates) => {
    try {
      const filteredCandidates = []
      
      for (const candidate of candidates) {
        const { part_id, color_id, element_id } = candidate
        
        const validation = validatePartUsage(part_id, color_id, element_id)
        
        if (validation.allowed) {
          filteredCandidates.push({
            ...candidate,
            bomValidation: validation
          })
        } else {
          console.log(`🚫 BOM 제약으로 제외: ${part_id} (${validation.reason})`)
        }
      }
      
      console.log(`🔍 BOM 제약 필터링: ${candidates.length}개 → ${filteredCandidates.length}개`)
      
      return filteredCandidates
      
    } catch (err) {
      console.error('❌ BOM 제약 필터링 실패:', err)
      throw err
    }
  }

  return {
    loading,
    error,
    bomStats,
    bomConfig,
    bomState,
    loadBOMData,
    validatePartUsage,
    registerPartUsage,
    unregisterPartUsage,
    getBOMStatus,
    validateBatch,
    filterByBOMConstraints
  }
}












