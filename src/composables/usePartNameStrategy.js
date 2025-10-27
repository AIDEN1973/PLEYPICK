// 🧩 부품명 처리 전략 시스템
// 무수히 다양한 부품명을 처리하기 위한 전략적 접근

/**
 * 부품명 처리 전략
 * 1. 규칙 기반 (Rule-based) - 정확한 매칭
 * 2. 퍼지 매칭 (Fuzzy Matching) - 부분 일치
 * 3. 컨텍스트 분석 (Context Analysis) - 문맥 고려
 * 4. 머신러닝 (Machine Learning) - 패턴 자동 발견
 * 5. 하이브리드 (Hybrid) - 모든 방법 통합
 */

// 🎯 전략별 처리 방법
export const PROCESSING_STRATEGIES = {
  // 1. 규칙 기반 처리
  ruleBased: {
    name: '규칙 기반',
    description: '정확한 키워드 매칭으로 빠르고 정확한 분석',
    pros: ['빠른 처리', '높은 정확도', '예측 가능'],
    cons: ['새로운 패턴 처리 불가', '유연성 부족'],
    useCase: '기본적인 부품명 패턴',
    confidence: 0.9
  },
  
  // 2. 퍼지 매칭
  fuzzyMatching: {
    name: '퍼지 매칭',
    description: '부분 일치를 통한 유연한 분석',
    pros: ['오타 허용', '유연한 매칭', '부분 일치'],
    cons: ['처리 시간 증가', '오탐 가능성'],
    useCase: '오타가 있거나 부분적으로 일치하는 부품명',
    confidence: 0.7
  },
  
  // 3. 컨텍스트 분석
  contextAnalysis: {
    name: '컨텍스트 분석',
    description: '문맥을 고려한 지능적 분석',
    pros: ['문맥 이해', '복합 패턴 처리', '높은 정확도'],
    cons: ['복잡한 로직', '처리 시간 증가'],
    useCase: '복잡한 구조의 부품명',
    confidence: 0.8
  },
  
  // 4. 머신러닝
  machineLearning: {
    name: '머신러닝',
    description: '패턴 자동 발견 및 학습',
    pros: ['자동 학습', '새로운 패턴 처리', '지속적 개선'],
    cons: ['초기 학습 필요', '복잡한 구현', '설명 불가능'],
    useCase: '새로운 패턴이 지속적으로 발견되는 경우',
    confidence: 0.6
  },
  
  // 5. 하이브리드
  hybrid: {
    name: '하이브리드',
    description: '모든 방법을 통합한 최적의 분석',
    pros: ['최고의 정확도', '모든 패턴 처리', '지속적 개선'],
    cons: ['복잡한 구현', '높은 계산 비용'],
    useCase: '모든 종류의 부품명 처리',
    confidence: 0.85
  }
}

/**
 * 전략 선택 시스템
 * 부품명의 특성에 따라 최적의 처리 전략을 선택
 */
export class StrategySelector {
  constructor() {
    this.strategies = PROCESSING_STRATEGIES
    this.selectionRules = [
      // 규칙 기반 선택 규칙
      {
        condition: (partName) => this.isStandardPattern(partName),
        strategy: 'ruleBased',
        confidence: 0.9
      },
      
      // 퍼지 매칭 선택 규칙
      {
        condition: (partName) => this.hasTypos(partName) || this.isPartialMatch(partName),
        strategy: 'fuzzyMatching',
        confidence: 0.7
      },
      
      // 컨텍스트 분석 선택 규칙
      {
        condition: (partName) => this.isComplexPattern(partName),
        strategy: 'contextAnalysis',
        confidence: 0.8
      },
      
      // 머신러닝 선택 규칙
      {
        condition: (partName) => this.isUnknownPattern(partName),
        strategy: 'machineLearning',
        confidence: 0.6
      }
    ]
  }
  
  /**
   * 최적의 전략 선택
   * @param {string} partName - 부품명
   * @returns {Object} 선택된 전략
   */
  selectStrategy(partName) {
    for (const rule of this.selectionRules) {
      if (rule.condition(partName)) {
        return {
          strategy: this.strategies[rule.strategy],
          confidence: rule.confidence,
          reason: this.getSelectionReason(partName, rule.strategy)
        }
      }
    }
    
    // 기본값: 하이브리드
    return {
      strategy: this.strategies.hybrid,
      confidence: 0.85,
      reason: '기본 하이브리드 전략'
    }
  }
  
  /**
   * 표준 패턴 확인
   * @param {string} partName - 부품명
   * @returns {boolean} 표준 패턴 여부
   */
  isStandardPattern(partName) {
    const standardPatterns = [
      /^\w+\s+\d+\s*x\s*\d+$/i,  // Brick 2x4
      /^\w+\s+\d+\s*x\s*\d+\s*x\s*\d+$/i,  // Brick 2x4x1
      /^\w+\s+\d+\s*L$/i,  // Bar 3L
      /^\w+\s+\d+\s*mm$/i  // Plate 5mm
    ]
    
    return standardPatterns.some(pattern => pattern.test(partName))
  }
  
  /**
   * 오타 확인
   * @param {string} partName - 부품명
   * @returns {boolean} 오타 여부
   */
  hasTypos(partName) {
    const commonTypos = [
      'brik', 'brick',  // brik -> brick
      'plte', 'plate',  // plte -> plate
      'tle', 'tile',   // tle -> tile
      'slpe', 'slope'  // slpe -> slope
    ]
    
    return commonTypos.some(typo => partName.toLowerCase().includes(typo))
  }
  
  /**
   * 부분 일치 확인
   * @param {string} partName - 부품명
   * @returns {boolean} 부분 일치 여부
   */
  isPartialMatch(partName) {
    const partialPatterns = [
      /^\w+\s+\d+$/,  // Brick 2
      /^\w+\s+\d+\s*x$/,  // Brick 2x
      /^\w+\s+\d+\s*x\s*\d+\s*x$/,  // Brick 2x4x
      /^\w+\s+\d+\s*L$/,  // Bar 3L
      /^\w+\s+\d+\s*mm$/  // Plate 5mm
    ]
    
    return partialPatterns.some(pattern => pattern.test(partName))
  }
  
  /**
   * 복잡한 패턴 확인
   * @param {string} partName - 부품명
   * @returns {boolean} 복잡한 패턴 여부
   */
  isComplexPattern(partName) {
    const complexIndicators = [
      /with\s+\w+/i,  // with stud
      /and\s+\w+/i,   // and clip
      /or\s+\w+/i,    // or stud
      /,\s*\w+/i,     // comma separated
      /\[\w+\]/i,     // brackets
      /\(\w+\)/i      // parentheses
    ]
    
    return complexIndicators.some(indicator => indicator.test(partName))
  }
  
  /**
   * 알 수 없는 패턴 확인
   * @param {string} partName - 부품명
   * @returns {boolean} 알 수 없는 패턴 여부
   */
  isUnknownPattern(partName) {
    const knownPatterns = [
      'brick', 'plate', 'tile', 'slope', 'panel', 'wedge',
      'cylinder', 'cone', 'arch', 'round', 'dish', 'hinge',
      'clip', 'bar', 'fence', 'door', 'window', 'roof'
    ]
    
    const hasKnownPattern = knownPatterns.some(pattern => 
      partName.toLowerCase().includes(pattern)
    )
    
    return !hasKnownPattern
  }
  
  /**
   * 선택 이유 설명
   * @param {string} partName - 부품명
   * @param {string} strategy - 선택된 전략
   * @returns {string} 선택 이유
   */
  getSelectionReason(partName, strategy) {
    const reasons = {
      ruleBased: '표준 패턴으로 빠른 처리 가능',
      fuzzyMatching: '오타나 부분 일치로 퍼지 매칭 필요',
      contextAnalysis: '복잡한 구조로 컨텍스트 분석 필요',
      machineLearning: '알 수 없는 패턴으로 머신러닝 필요',
      hybrid: '모든 방법을 통합한 최적의 분석'
    }
    
    return reasons[strategy] || '알 수 없는 이유'
  }
}

/**
 * 부품명 처리 파이프라인
 * 여러 전략을 순차적으로 적용하여 최적의 결과 도출
 */
export class PartNameProcessingPipeline {
  constructor() {
    this.strategySelector = new StrategySelector()
    this.processors = new Map()
    this.fallbackProcessor = null
  }
  
  /**
   * 부품명 처리
   * @param {string} partName - 부품명
   * @returns {Object} 처리 결과
   */
  process(partName) {
    // 1. 전략 선택
    const selectedStrategy = this.strategySelector.selectStrategy(partName)
    
    // 2. 선택된 전략으로 처리
    let result = this.processWithStrategy(partName, selectedStrategy.strategy)
    
    // 3. 결과 검증
    if (!this.isValidResult(result)) {
      // 4. 대체 전략 시도
      result = this.tryFallbackStrategies(partName)
    }
    
    // 5. 결과 후처리
    result = this.postProcessResult(result, partName)
    
    return {
      ...result,
      strategy: selectedStrategy.strategy.name,
      confidence: selectedStrategy.confidence,
      reason: selectedStrategy.reason
    }
  }
  
  /**
   * 전략별 처리
   * @param {string} partName - 부품명
   * @param {Object} strategy - 선택된 전략
   * @returns {Object} 처리 결과
   */
  processWithStrategy(partName, strategy) {
    switch (strategy.name) {
      case '규칙 기반':
        return this.processRuleBased(partName)
      case '퍼지 매칭':
        return this.processFuzzyMatching(partName)
      case '컨텍스트 분석':
        return this.processContextAnalysis(partName)
      case '머신러닝':
        return this.processMachineLearning(partName)
      case '하이브리드':
        return this.processHybrid(partName)
      default:
        return this.processHybrid(partName)
    }
  }
  
  /**
   * 규칙 기반 처리
   * @param {string} partName - 부품명
   * @returns {Object} 처리 결과
   */
  processRuleBased(partName) {
    // 기본 패턴 매칭
    const result = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.9
    }
    
    // 크기 패턴 매칭
    const dimensionMatch = partName.match(/(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+(?:\/\d+)?))?/i)
    if (dimensionMatch) {
      result.dimensions = {
        raw: dimensionMatch[0],
        width: parseInt(dimensionMatch[1]),
        length: parseInt(dimensionMatch[2]),
        height: dimensionMatch[3] ? (dimensionMatch[3].includes('/') ? eval(dimensionMatch[3]) : parseInt(dimensionMatch[3])) : null
      }
    }
    
    // 형태 패턴 매칭
    const shapeKeywords = ['brick', 'plate', 'tile', 'slope', 'panel', 'wedge', 'cylinder', 'cone', 'arch', 'round', 'dish', 'hinge', 'clip', 'bar', 'fence', 'door', 'window', 'roof']
    shapeKeywords.forEach(keyword => {
      if (partName.toLowerCase().includes(keyword)) {
        result.shapes.push({
          tag: keyword,
          confidence: 0.9
        })
      }
    })
    
    return result
  }
  
  /**
   * 퍼지 매칭 처리
   * @param {string} partName - 부품명
   * @returns {Object} 처리 결과
   */
  processFuzzyMatching(partName) {
    // 퍼지 매칭 로직 구현
    const result = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.7
    }
    
    // 퍼지 매칭으로 형태 찾기
    const shapeKeywords = ['brick', 'plate', 'tile', 'slope', 'panel', 'wedge', 'cylinder', 'cone', 'arch', 'round', 'dish', 'hinge', 'clip', 'bar', 'fence', 'door', 'window', 'roof']
    shapeKeywords.forEach(keyword => {
      const similarity = this.calculateSimilarity(partName.toLowerCase(), keyword)
      if (similarity >= 0.6) {
        result.shapes.push({
          tag: keyword,
          confidence: similarity
        })
      }
    })
    
    return result
  }
  
  /**
   * 컨텍스트 분석 처리
   * @param {string} partName - 부품명
   * @returns {Object} 처리 결과
   */
  processContextAnalysis(partName) {
    // 컨텍스트 분석 로직 구현
    const result = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.8
    }
    
    // 컨텍스트 규칙 적용
    const contextRules = [
      {
        pattern: /(\d+)\s*x\s*(\d+)\s+(brick|plate|tile)/i,
        handler: (match) => ({
          dimensions: { width: parseInt(match[1]), length: parseInt(match[2]) },
          shapes: [{ tag: match[3], confidence: 0.9 }]
        })
      },
      {
        pattern: /(with|and|or)\s+(\w+)/i,
        handler: (match) => ({
          features: [{ type: match[2], confidence: 0.8 }]
        })
      }
    ]
    
    contextRules.forEach(rule => {
      const match = partName.match(rule.pattern)
      if (match) {
        const analysis = rule.handler(match)
        Object.assign(result, analysis)
      }
    })
    
    return result
  }
  
  /**
   * 머신러닝 처리
   * @param {string} partName - 부품명
   * @returns {Object} 처리 결과
   */
  processMachineLearning(partName) {
    // 머신러닝 로직 구현 (현재는 기본값)
    const result = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.6
    }
    
    // 기본 패턴 시도
    const basicResult = this.processRuleBased(partName)
    if (basicResult.shapes.length > 0) {
      result.shapes = basicResult.shapes
      result.confidence = 0.6
    }
    
    return result
  }
  
  /**
   * 하이브리드 처리
   * @param {string} partName - 부품명
   * @returns {Object} 처리 결과
   */
  processHybrid(partName) {
    // 모든 전략을 통합한 처리
    const results = [
      this.processRuleBased(partName),
      this.processFuzzyMatching(partName),
      this.processContextAnalysis(partName),
      this.processMachineLearning(partName)
    ]
    
    // 결과 통합
    const integratedResult = this.integrateResults(results)
    
    return {
      ...integratedResult,
      confidence: 0.85
    }
  }
  
  /**
   * 결과 통합
   * @param {Array} results - 여러 전략의 결과
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
      if (analysis.dimensions && (!result.dimensions || analysis.confidence > result.confidence)) {
        result.dimensions = analysis.dimensions
      }
      
      if (analysis.shapes && analysis.shapes.length > 0) {
        result.shapes = [...result.shapes, ...analysis.shapes]
      }
      
      if (analysis.features && analysis.features.length > 0) {
        result.features = [...result.features, ...analysis.features]
      }
      
      if (analysis.colors && analysis.colors.length > 0) {
        result.colors = [...result.colors, ...analysis.colors]
      }
      
      if (analysis.series && analysis.series !== 'system') {
        result.series = analysis.series
      }
      
      result.confidence = Math.max(result.confidence, analysis.confidence)
    })
    
    // 중복 제거
    result.shapes = this.deduplicate(result.shapes, 'tag')
    result.features = this.deduplicate(result.features, 'type')
    result.colors = this.deduplicate(result.colors, 'color')
    
    return result
  }
  
  /**
   * 대체 전략 시도
   * @param {string} partName - 부품명
   * @returns {Object} 처리 결과
   */
  tryFallbackStrategies(partName) {
    // 대체 전략들 시도
    const fallbackStrategies = [
      this.processFuzzyMatching(partName),
      this.processContextAnalysis(partName),
      this.processMachineLearning(partName)
    ]
    
    // 가장 좋은 결과 선택
    let bestResult = fallbackStrategies[0]
    fallbackStrategies.forEach(result => {
      if (result.confidence > bestResult.confidence) {
        bestResult = result
      }
    })
    
    return bestResult
  }
  
  /**
   * 결과 검증
   * @param {Object} result - 처리 결과
   * @returns {boolean} 유효성 여부
   */
  isValidResult(result) {
    return result && (
      result.dimensions ||
      result.shapes.length > 0 ||
      result.features.length > 0 ||
      result.colors.length > 0 ||
      result.series !== 'system'
    )
  }
  
  /**
   * 결과 후처리
   * @param {Object} result - 처리 결과
   * @param {string} partName - 부품명
   * @returns {Object} 후처리된 결과
   */
  postProcessResult(result, partName) {
    // 신뢰도 조정
    if (result.shapes.length > 0) {
      result.confidence = Math.max(result.confidence, 0.7)
    }
    
    // 기본값 설정
    if (!result.series) {
      result.series = 'system'
    }
    
    return result
  }
  
  /**
   * 문자열 유사도 계산
   * @param {string} str1 - 문자열 1
   * @param {string} str2 - 문자열 2
   * @returns {number} 유사도 (0-1)
   */
  calculateSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length)
    if (maxLength === 0) return 1.0
    
    const distance = this.levenshteinDistance(str1, str2)
    return 1 - (distance / maxLength)
  }
  
  /**
   * Levenshtein 거리 계산
   * @param {string} str1 - 문자열 1
   * @param {string} str2 - 문자열 2
   * @returns {number} 거리
   */
  levenshteinDistance(str1, str2) {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
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
}

// 전역 처리 파이프라인
export const globalPartNamePipeline = new PartNameProcessingPipeline()

/**
 * 부품명 처리 함수 (기존 함수와 호환)
 * @param {string} partName - 부품명
 * @returns {Object} 처리 결과
 */
export function processPartName(partName) {
  return globalPartNamePipeline.process(partName)
}

/**
 * 전략별 처리 테스트
 */
export function testProcessingStrategies() {
  const testNames = [
    'Brick 2x4',  // 규칙 기반
    'Brik 2x4',   // 퍼지 매칭
    'Brick 2x4 with Stud',  // 컨텍스트 분석
    'Unknown Part 123',  // 머신러닝
    'Bracket 1 x 1 - 1 x 2 Inverted'  // 하이브리드
  ]
  
  console.log('🧩 전략별 처리 테스트:')
  testNames.forEach(name => {
    const result = processPartName(name)
    console.log(`\n📦 ${name}`)
    console.log(`   전략: ${result.strategy}`)
    console.log(`   신뢰도: ${(result.confidence * 100).toFixed(1)}%`)
    console.log(`   이유: ${result.reason}`)
    console.log(`   형태: ${result.shapes.map(s => s.tag).join(', ')}`)
    console.log(`   크기: ${result.dimensions?.raw || '미지정'}`)
    console.log(`   특징: ${result.features.map(f => f.type).join(', ')}`)
  })
}

