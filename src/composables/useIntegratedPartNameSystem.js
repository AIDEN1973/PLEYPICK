// 🧩 통합 부품명 처리 시스템
// 기존 시스템과 새로운 고급 시스템을 통합한 완전한 솔루션

import { analyzePartName } from './usePartNameParser.js'
import { analyzePartNameAdvanced } from './useAdvancedPartNameParser.js'
import { processPartName } from './usePartNameStrategy.js'

/**
 * 통합 부품명 분석 시스템
 * 기존 시스템과 새로운 고급 시스템을 통합하여 최적의 결과 제공
 */
export class IntegratedPartNameSystem {
  constructor() {
    this.basicParser = analyzePartName
    this.advancedParser = analyzePartNameAdvanced
    this.strategyParser = processPartName
    this.fallbackEnabled = true
    this.performanceMode = 'balanced' // 'fast', 'balanced', 'accurate'
  }
  
  /**
   * 통합 부품명 분석
   * @param {string} partName - 부품명
   * @returns {Object} 통합 분석 결과
   */
  analyze(partName) {
    const startTime = performance.now()
    
    try {
      // 1. 성능 모드에 따른 처리 방법 선택
      let result
      switch (this.performanceMode) {
        case 'fast':
          result = this.analyzeFast(partName)
          break
        case 'accurate':
          result = this.analyzeAccurate(partName)
          break
        case 'balanced':
        default:
          result = this.analyzeBalanced(partName)
          break
      }
      
      const endTime = performance.now()
      result.processingTime = endTime - startTime
      result.method = this.performanceMode
      
      return result
      
    } catch (error) {
      console.error('❌ 통합 부품명 분석 실패:', error)
      
      // 폴백 처리
      if (this.fallbackEnabled) {
        return this.fallbackAnalysis(partName)
      }
      
      throw error
    }
  }
  
  /**
   * 빠른 분석 (기본 파서만 사용)
   * @param {string} partName - 부품명
   * @returns {Object} 분석 결과
   */
  analyzeFast(partName) {
    console.log('🚀 빠른 분석 모드')
    const result = this.basicParser(partName)
    
    return {
      ...result,
      method: 'fast',
      confidence: result.confidence || 0.8
    }
  }
  
  /**
   * 정확한 분석 (모든 파서 통합)
   * @param {string} partName - 부품명
   * @returns {Object} 분석 결과
   */
  analyzeAccurate(partName) {
    console.log('🎯 정확한 분석 모드')
    
    // 모든 파서로 분석
    const basicResult = this.basicParser(partName)
    const advancedResult = this.advancedParser(partName)
    const strategyResult = this.strategyParser(partName)
    
    // 결과 통합
    const integratedResult = this.integrateResults([
      basicResult,
      advancedResult,
      strategyResult
    ])
    
    return {
      ...integratedResult,
      method: 'accurate',
      confidence: Math.max(
        basicResult.confidence || 0,
        advancedResult.confidence || 0,
        strategyResult.confidence || 0
      )
    }
  }
  
  /**
   * 균형 분석 (전략적 선택)
   * @param {string} partName - 부품명
   * @returns {Object} 분석 결과
   */
  analyzeBalanced(partName) {
    console.log('⚖️ 균형 분석 모드')
    
    // 부품명 복잡도 평가
    const complexity = this.evaluateComplexity(partName)
    
    if (complexity === 'simple') {
      // 간단한 부품명은 기본 파서 사용
      return this.analyzeFast(partName)
    } else if (complexity === 'complex') {
      // 복잡한 부품명은 고급 파서 사용
      return this.analyzeAccurate(partName)
    } else {
      // 중간 복잡도는 전략 파서 사용
      return this.strategyParser(partName)
    }
  }
  
  /**
   * 부품명 복잡도 평가
   * @param {string} partName - 부품명
   * @returns {string} 복잡도 ('simple', 'medium', 'complex')
   */
  evaluateComplexity(partName) {
    const indicators = {
      simple: [
        /^\w+\s+\d+\s*x\s*\d+$/i,  // Brick 2x4
        /^\w+\s+\d+\s*L$/i,         // Bar 3L
        /^\w+\s+\d+\s*mm$/i         // Plate 5mm
      ],
      complex: [
        /with\s+\w+/i,              // with stud
        /and\s+\w+/i,                // and clip
        /or\s+\w+/i,                // or stud
        /,\s*\w+/i,                 // comma separated
        /\[\w+\]/i,                 // brackets
        /\(\w+\)/i,                 // parentheses
        /-\s*\w+/i,                 // dash separated
        /\/\s*\w+/i                 // slash separated
      ]
    }
    
    // 복잡한 패턴 확인
    if (indicators.complex.some(pattern => pattern.test(partName))) {
      return 'complex'
    }
    
    // 간단한 패턴 확인
    if (indicators.simple.some(pattern => pattern.test(partName))) {
      return 'simple'
    }
    
    return 'medium'
  }
  
  /**
   * 결과 통합
   * @param {Array} results - 여러 파서의 결과
   * @returns {Object} 통합된 결과
   */
  integrateResults(results) {
    const result = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.0
    }
    
    // 신뢰도 기반 결과 선택
    results.forEach(analysis => {
      if (analysis && typeof analysis === 'object') {
        // 크기 정보 통합
        if (analysis.dimensions && (!result.dimensions || analysis.confidence > result.confidence)) {
          result.dimensions = analysis.dimensions
        }
        
        // 형태 정보 통합
        if (analysis.shapes && analysis.shapes.length > 0) {
          result.shapes = [...result.shapes, ...analysis.shapes]
        }
        
        // 특성 정보 통합
        if (analysis.features && analysis.features.length > 0) {
          result.features = [...result.features, ...analysis.features]
        }
        
        // 색상 정보 통합
        if (analysis.colors && analysis.colors.length > 0) {
          result.colors = [...result.colors, ...analysis.colors]
        }
        
        // 시리즈 정보 통합
        if (analysis.series && analysis.series !== 'system') {
          result.series = analysis.series
        }
        
        // 신뢰도 통합
        result.confidence = Math.max(result.confidence, analysis.confidence || 0)
      }
    })
    
    // 중복 제거
    result.shapes = this.deduplicate(result.shapes, 'tag')
    result.features = this.deduplicate(result.features, 'type')
    result.colors = this.deduplicate(result.colors, 'color')
    
    return result
  }
  
  /**
   * 폴백 분석
   * @param {string} partName - 부품명
   * @returns {Object} 폴백 분석 결과
   */
  fallbackAnalysis(partName) {
    console.log('🔄 폴백 분석 실행')
    
    // 기본값 반환
    return {
      dimensions: null,
      shapes: [{ tag: 'unknown', confidence: 0.1 }],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.1,
      method: 'fallback',
      error: '분석 실패, 기본값 사용'
    }
  }
  
  /**
   * 중복 제거
   * @param {Array} items - 항목들
   * @param {string} key - 정렬 키
   * @returns {Array} 중복 제거된 항목들
   */
  deduplicate(items, key) {
    const seen = new Set()
    return items.filter(item => {
      if (seen.has(item[key])) return false
      seen.add(item[key])
      return true
    })
  }
  
  /**
   * 성능 모드 설정
   * @param {string} mode - 성능 모드 ('fast', 'balanced', 'accurate')
   */
  setPerformanceMode(mode) {
    if (['fast', 'balanced', 'accurate'].includes(mode)) {
      this.performanceMode = mode
      console.log(`⚙️ 성능 모드 변경: ${mode}`)
    } else {
      console.warn('⚠️ 유효하지 않은 성능 모드:', mode)
    }
  }
  
  /**
   * 폴백 활성화/비활성화
   * @param {boolean} enabled - 폴백 활성화 여부
   */
  setFallbackEnabled(enabled) {
    this.fallbackEnabled = enabled
    console.log(`⚙️ 폴백 ${enabled ? '활성화' : '비활성화'}`)
  }
}

// 전역 통합 시스템 인스턴스
export const globalIntegratedSystem = new IntegratedPartNameSystem()

/**
 * 통합 부품명 분석 함수 (기존 함수와 호환)
 * @param {string} partName - 부품명
 * @returns {Object} 분석 결과
 */
export function analyzePartNameIntegrated(partName) {
  return globalIntegratedSystem.analyze(partName)
}

/**
 * 통합 시스템 테스트
 */
export function testIntegratedSystem() {
  const testNames = [
    'Brick 2x4',                                    // 간단한 패턴
    'Bracket 1 x 1 - 1 x 2 Inverted',              // 복잡한 패턴
    'Brick Curved 1 x 1 x 2/3 Double Curved Top, No Studs',  // 매우 복잡한 패턴
    'Plate Special 1 x 2 with Clips Horizontal [Open O Clips]',  // 특수 패턴
    'Steering Stand 1 x 2 with Black Steering Wheel',  // 복합 패턴
    'Unknown Part 123',                            // 알 수 없는 패턴
    'Brik 2x4',                                    // 오타 패턴
    'Technic Axle 3L with Stop',                   // 시리즈 패턴
    'Minifig Head with Dual Sided Print',         // 미니피그 패턴
    'Duplo Animal Elephant'                        // 듀플로 패턴
  ]
  
  console.log('🧩 통합 시스템 테스트:')
  
  // 성능 모드별 테스트
  const modes = ['fast', 'balanced', 'accurate']
  
  modes.forEach(mode => {
    console.log(`\n📊 ${mode.toUpperCase()} 모드 테스트:`)
    globalIntegratedSystem.setPerformanceMode(mode)
    
    testNames.forEach(name => {
      const result = analyzePartNameIntegrated(name)
      console.log(`   ${name}: ${result.method} (${result.processingTime?.toFixed(2)}ms, ${(result.confidence * 100).toFixed(1)}%)`)
    })
  })
  
  // 복잡도별 테스트
  console.log('\n📈 복잡도별 테스트:')
  testNames.forEach(name => {
    const complexity = globalIntegratedSystem.evaluateComplexity(name)
    const result = analyzePartNameIntegrated(name)
    console.log(`   ${name}: ${complexity} → ${result.method} (${(result.confidence * 100).toFixed(1)}%)`)
  })
}
