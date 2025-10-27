// 🧩 고급 부품명 파싱 시스템 - 확장 가능한 패턴 기반
// 무수히 다양한 레고 부품명을 처리하기 위한 유연한 시스템

/**
 * 패턴 기반 부품명 파싱 시스템
 * 새로운 부품명 패턴이 발견되면 자동으로 학습하고 확장
 */

// 🔍 패턴 정의 시스템
export const PATTERN_DEFINITIONS = {
  // 크기 패턴 (정규식 기반)
  dimensions: [
    { pattern: /(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+(?:\/\d+)?))?/gi, type: 'standard' },
    { pattern: /(\d+)\s+x\s+(\d+)(?:\s+x\s+(\d+(?:\/\d+)?))?/gi, type: 'spaced' },
    { pattern: /(\d+)\s*-\s*(\d+)/gi, type: 'range' },
    { pattern: /(\d+)\s*\/\s*(\d+)/gi, type: 'fraction' }
  ],
  
  // 형태 패턴 (키워드 기반)
  shapes: [
    { keywords: ['brick', '브릭'], tag: 'brick', priority: 1 },
    { keywords: ['plate', '플레이트'], tag: 'plate', priority: 1 },
    { keywords: ['tile', '타일'], tag: 'tile', priority: 1 },
    { keywords: ['slope', '경사'], tag: 'slope', priority: 1 },
    { keywords: ['panel', '패널'], tag: 'panel', priority: 1 },
    { keywords: ['wedge', '웨지'], tag: 'wedge', priority: 1 },
    { keywords: ['cylinder', '실린더'], tag: 'cylinder', priority: 1 },
    { keywords: ['cone', '콘'], tag: 'cone', priority: 1 },
    { keywords: ['arch', '아치'], tag: 'arch', priority: 1 },
    { keywords: ['round', '라운드'], tag: 'round', priority: 1 },
    { keywords: ['dish', '디시'], tag: 'dish', priority: 1 },
    { keywords: ['hinge', '힌지'], tag: 'hinge', priority: 1 },
    { keywords: ['clip', '클립'], tag: 'clip', priority: 1 },
    { keywords: ['bar', '바'], tag: 'bar', priority: 1 },
    { keywords: ['fence', '펜스'], tag: 'fence', priority: 1 },
    { keywords: ['door', '도어'], tag: 'door', priority: 1 },
    { keywords: ['window', '윈도우'], tag: 'window', priority: 1 },
    { keywords: ['roof', '루프'], tag: 'roof', priority: 1 },
    { keywords: ['bracket', '브래킷'], tag: 'bracket', priority: 1 },
    { keywords: ['steering', '스티어링'], tag: 'steering', priority: 1 },
    { keywords: ['stand', '스탠드'], tag: 'stand', priority: 1 },
    { keywords: ['corner', '코너'], tag: 'corner', priority: 2 },
    { keywords: ['inverted', '인버티드'], tag: 'inverted', priority: 2 },
    { keywords: ['curved', '커브드'], tag: 'curved', priority: 2 },
    { keywords: ['special', '스페셜'], tag: 'special', priority: 2 }
  ],
  
  // 특성 패턴 (조건부)
  features: [
    { keywords: ['stud', '스터드'], type: 'stud' },
    { keywords: ['no studs', 'no stud', '스터드 없음'], type: 'no_studs' },
    { keywords: ['open stud', '열린 스터드'], type: 'open_stud' },
    { keywords: ['center stud', '중앙 스터드'], type: 'center_stud' },
    { keywords: ['clip', '클립'], type: 'clip' },
    { keywords: ['horizontal', '수평'], type: 'horizontal' },
    { keywords: ['vertical', '수직'], type: 'vertical' },
    { keywords: ['open', '열린'], type: 'open' },
    { keywords: ['closed', '닫힌'], type: 'closed' },
    { keywords: ['double', '더블'], type: 'double' },
    { keywords: ['single', '싱글'], type: 'single' },
    { keywords: ['groove', '그루브'], type: 'groove' },
    { keywords: ['channel', '채널'], type: 'channel' },
    { keywords: ['slot', '슬롯'], type: 'slot' }
  ],
  
  // 색상 패턴
  colors: [
    { keywords: ['black', '검은', '블랙'], color: 'black' },
    { keywords: ['white', '흰', '화이트'], color: 'white' },
    { keywords: ['red', '빨간', '레드'], color: 'red' },
    { keywords: ['blue', '파란', '블루'], color: 'blue' },
    { keywords: ['green', '초록', '그린'], color: 'green' },
    { keywords: ['yellow', '노란', '옐로우'], color: 'yellow' },
    { keywords: ['orange', '주황', '오렌지'], color: 'orange' },
    { keywords: ['purple', '보라', '퍼플'], color: 'purple' },
    { keywords: ['pink', '분홍', '핑크'], color: 'pink' },
    { keywords: ['brown', '갈색', '브라운'], color: 'brown' },
    { keywords: ['gray', 'grey', '회색', '그레이'], color: 'gray' },
    { keywords: ['transparent', '투명', '트랜스패런트'], color: 'transparent' }
  ],
  
  // 시리즈 패턴
  series: [
    { keywords: ['duplo', '듀플로'], series: 'duplo' },
    { keywords: ['technic', '테크닉'], series: 'technic' },
    { keywords: ['bionicle', '바이오니클'], series: 'bionicle' },
    { keywords: ['minifig', '미니피그'], series: 'minifig' },
    { keywords: ['animal', '동물'], series: 'animal' },
    { keywords: ['plant', '식물'], series: 'plant' }
  ]
}

/**
 * 동적 패턴 학습 시스템
 * 새로운 부품명 패턴을 발견하면 자동으로 학습
 */
export class PatternLearner {
  constructor() {
    this.learnedPatterns = new Map()
    this.confidenceThreshold = 0.7
  }
  
  /**
   * 새로운 부품명 패턴 학습
   * @param {string} partName - 부품명
   * @param {Object} analysisResult - 분석 결과
   */
  learnPattern(partName, analysisResult) {
    const patterns = this.extractPatterns(partName)
    
    patterns.forEach(pattern => {
      const key = pattern.type
      if (!this.learnedPatterns.has(key)) {
        this.learnedPatterns.set(key, [])
      }
      
      const existingPatterns = this.learnedPatterns.get(key)
      const existingPattern = existingPatterns.find(p => p.pattern === pattern.pattern)
      
      if (existingPattern) {
        existingPattern.count++
        existingPattern.confidence = Math.min(1.0, existingPattern.confidence + 0.1)
      } else {
        existingPatterns.push({
          pattern: pattern.pattern,
          count: 1,
          confidence: 0.5,
          examples: [partName]
        })
      }
    })
  }
  
  /**
   * 부품명에서 패턴 추출
   * @param {string} partName - 부품명
   * @returns {Array} 추출된 패턴들
   */
  extractPatterns(partName) {
    const patterns = []
    
    // 크기 패턴 추출
    PATTERN_DEFINITIONS.dimensions.forEach(def => {
      const matches = partName.match(def.pattern)
      if (matches) {
        patterns.push({
          type: 'dimension',
          pattern: def.pattern.source,
          matches: matches,
          confidence: 0.8
        })
      }
    })
    
    // 형태 패턴 추출
    PATTERN_DEFINITIONS.shapes.forEach(def => {
      def.keywords.forEach(keyword => {
        if (partName.toLowerCase().includes(keyword.toLowerCase())) {
          patterns.push({
            type: 'shape',
            pattern: keyword,
            tag: def.tag,
            priority: def.priority,
            confidence: 0.9
          })
        }
      })
    })
    
    return patterns
  }
  
  /**
   * 학습된 패턴으로 부품명 분석
   * @param {string} partName - 부품명
   * @returns {Object} 분석 결과
   */
  analyzeWithLearnedPatterns(partName) {
    const results = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.0
    }
    
    // 학습된 패턴 적용
    this.learnedPatterns.forEach((patterns, type) => {
      patterns.forEach(pattern => {
        if (pattern.confidence >= this.confidenceThreshold) {
          const match = partName.match(new RegExp(pattern.pattern, 'gi'))
          if (match) {
            results[type] = match
            results.confidence = Math.max(results.confidence, pattern.confidence)
          }
        }
      })
    })
    
    return results
  }
}

/**
 * 퍼지 매칭 시스템
 * 부품명의 부분 일치를 통한 유연한 분석
 */
export class FuzzyMatcher {
  constructor() {
    this.threshold = 0.6
  }
  
  /**
   * 퍼지 매칭으로 키워드 찾기
   * @param {string} text - 검색할 텍스트
   * @param {Array} keywords - 키워드 목록
   * @returns {Array} 매칭된 키워드들
   */
  fuzzyMatch(text, keywords) {
    const matches = []
    
    keywords.forEach(keyword => {
      const similarity = this.calculateSimilarity(text.toLowerCase(), keyword.toLowerCase())
      if (similarity >= this.threshold) {
        matches.push({
          keyword,
          similarity,
          confidence: similarity
        })
      }
    })
    
    return matches.sort((a, b) => b.similarity - a.similarity)
  }
  
  /**
   * 문자열 유사도 계산 (Levenshtein 거리 기반)
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
}

/**
 * 컨텍스트 기반 분석 시스템
 * 부품명의 문맥을 고려한 지능적 분석
 */
export class ContextAnalyzer {
  constructor() {
    this.contextRules = [
      // 크기 + 형태 조합 규칙
      {
        pattern: /(\d+)\s*x\s*(\d+)\s+(brick|plate|tile)/i,
        handler: (match) => ({
          dimensions: { width: parseInt(match[1]), length: parseInt(match[2]) },
          shape: match[3],
          confidence: 0.9
        })
      },
      
      // 특수 형태 + 크기 조합 규칙
      {
        pattern: /(corner|inverted|curved|special)\s+(\d+)\s*x\s*(\d+)/i,
        handler: (match) => ({
          special: match[1],
          dimensions: { width: parseInt(match[2]), length: parseInt(match[3]) },
          confidence: 0.8
        })
      },
      
      // 스터드 정보 + 크기 조합 규칙
      {
        pattern: /(no studs|open stud|center stud).*?(\d+)\s*x\s*(\d+)/i,
        handler: (match) => ({
          studInfo: match[1],
          dimensions: { width: parseInt(match[2]), length: parseInt(match[3]) },
          confidence: 0.85
        })
      }
    ]
  }
  
  /**
   * 컨텍스트 기반 분석
   * @param {string} partName - 부품명
   * @returns {Object} 분석 결과
   */
  analyzeContext(partName) {
    const results = {
      dimensions: null,
      shapes: [],
      features: [],
      confidence: 0.0
    }
    
    this.contextRules.forEach(rule => {
      const match = partName.match(rule.pattern)
      if (match) {
        const analysis = rule.handler(match)
        Object.assign(results, analysis)
        results.confidence = Math.max(results.confidence, analysis.confidence)
      }
    })
    
    return results
  }
}

/**
 * 통합 부품명 분석 시스템
 * 모든 분석 방법을 통합하여 최적의 결과 제공
 */
export class IntegratedPartNameAnalyzer {
  constructor() {
    this.patternLearner = new PatternLearner()
    this.fuzzyMatcher = new FuzzyMatcher()
    this.contextAnalyzer = new ContextAnalyzer()
  }
  
  /**
   * 통합 부품명 분석
   * @param {string} partName - 부품명
   * @returns {Object} 통합 분석 결과
   */
  analyze(partName) {
    // 1. 기본 패턴 분석
    const basicAnalysis = this.analyzeBasicPatterns(partName)
    
    // 2. 학습된 패턴 분석
    const learnedAnalysis = this.patternLearner.analyzeWithLearnedPatterns(partName)
    
    // 3. 퍼지 매칭 분석
    const fuzzyAnalysis = this.analyzeFuzzyPatterns(partName)
    
    // 4. 컨텍스트 분석
    const contextAnalysis = this.contextAnalyzer.analyzeContext(partName)
    
    // 5. 결과 통합 및 신뢰도 계산
    const integratedResult = this.integrateResults([
      basicAnalysis,
      learnedAnalysis,
      fuzzyAnalysis,
      contextAnalysis
    ])
    
    // 6. 학습 데이터 업데이트
    this.patternLearner.learnPattern(partName, integratedResult)
    
    return integratedResult
  }
  
  /**
   * 기본 패턴 분석
   * @param {string} partName - 부품명
   * @returns {Object} 기본 분석 결과
   */
  analyzeBasicPatterns(partName) {
    const result = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.0
    }
    
    // 크기 패턴 분석
    PATTERN_DEFINITIONS.dimensions.forEach(def => {
      const match = partName.match(def.pattern)
      if (match) {
        result.dimensions = {
          raw: match[0],
          width: parseInt(match[1]),
          length: parseInt(match[2]),
          height: match[3] ? (match[3].includes('/') ? eval(match[3]) : parseInt(match[3])) : null
        }
        result.confidence = Math.max(result.confidence, 0.8)
      }
    })
    
    // 형태 패턴 분석
    PATTERN_DEFINITIONS.shapes.forEach(def => {
      def.keywords.forEach(keyword => {
        if (partName.toLowerCase().includes(keyword.toLowerCase())) {
          result.shapes.push({
            tag: def.tag,
            keyword,
            priority: def.priority,
            confidence: 0.9
          })
        }
      })
    })
    
    // 특성 패턴 분석
    PATTERN_DEFINITIONS.features.forEach(def => {
      def.keywords.forEach(keyword => {
        if (partName.toLowerCase().includes(keyword.toLowerCase())) {
          result.features.push({
            type: def.type,
            keyword,
            confidence: 0.8
          })
        }
      })
    })
    
    // 색상 패턴 분석
    PATTERN_DEFINITIONS.colors.forEach(def => {
      def.keywords.forEach(keyword => {
        if (partName.toLowerCase().includes(keyword.toLowerCase())) {
          result.colors.push({
            color: def.color,
            keyword,
            confidence: 0.9
          })
        }
      })
    })
    
    // 시리즈 패턴 분석
    PATTERN_DEFINITIONS.series.forEach(def => {
      def.keywords.forEach(keyword => {
        if (partName.toLowerCase().includes(keyword.toLowerCase())) {
          result.series = def.series
          result.confidence = Math.max(result.confidence, 0.9)
        }
      })
    })
    
    return result
  }
  
  /**
   * 퍼지 매칭 분석
   * @param {string} partName - 부품명
   * @returns {Object} 퍼지 분석 결과
   */
  analyzeFuzzyPatterns(partName) {
    const result = {
      shapes: [],
      features: [],
      colors: [],
      confidence: 0.0
    }
    
    // 퍼지 매칭으로 형태 찾기
    const shapeKeywords = PATTERN_DEFINITIONS.shapes.flatMap(def => def.keywords)
    const shapeMatches = this.fuzzyMatcher.fuzzyMatch(partName, shapeKeywords)
    shapeMatches.forEach(match => {
      const shapeDef = PATTERN_DEFINITIONS.shapes.find(def => 
        def.keywords.includes(match.keyword)
      )
      if (shapeDef) {
        result.shapes.push({
          tag: shapeDef.tag,
          keyword: match.keyword,
          confidence: match.confidence
        })
      }
    })
    
    // 퍼지 매칭으로 특성 찾기
    const featureKeywords = PATTERN_DEFINITIONS.features.flatMap(def => def.keywords)
    const featureMatches = this.fuzzyMatcher.fuzzyMatch(partName, featureKeywords)
    featureMatches.forEach(match => {
      const featureDef = PATTERN_DEFINITIONS.features.find(def => 
        def.keywords.includes(match.keyword)
      )
      if (featureDef) {
        result.features.push({
          type: featureDef.type,
          keyword: match.keyword,
          confidence: match.confidence
        })
      }
    })
    
    return result
  }
  
  /**
   * 결과 통합
   * @param {Array} analyses - 분석 결과들
   * @returns {Object} 통합 결과
   */
  integrateResults(analyses) {
    const result = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.0
    }
    
    // 신뢰도 기반 결과 선택
    analyses.forEach(analysis => {
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
    
    // 중복 제거 및 정렬
    result.shapes = this.deduplicateAndSort(result.shapes, 'tag')
    result.features = this.deduplicateAndSort(result.features, 'type')
    result.colors = this.deduplicateAndSort(result.colors, 'color')
    
    return result
  }
  
  /**
   * 중복 제거 및 정렬
   * @param {Array} items - 항목들
   * @param {string} key - 정렬 키
   * @returns {Array} 정렬된 항목들
   */
  deduplicateAndSort(items, key) {
    const seen = new Set()
    return items
      .filter(item => {
        if (seen.has(item[key])) return false
        seen.add(item[key])
        return true
      })
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }
}

// 전역 분석기 인스턴스
export const globalPartNameAnalyzer = new IntegratedPartNameAnalyzer()

/**
 * 부품명 분석 함수 (기존 함수와 호환)
 * @param {string} partName - 부품명
 * @returns {Object} 분석 결과
 */
export function analyzePartNameAdvanced(partName) {
  return globalPartNameAnalyzer.analyze(partName)
}

/**
 * 테스트 함수
 */
export function testAdvancedPartNameParsing() {
  const testNames = [
    'Bracket 1 x 1 - 1 x 2 Inverted',
    'Brick 2 x 2 Corner',
    'Brick Curved 1 x 1 x 2/3 Double Curved Top, No Studs',
    'Plate 1 x 1 x 2/3 with Open Stud',
    'Plate Special 1 x 2 with Clips Horizontal [Open O Clips]',
    'Steering Stand 1 x 2 with Black Steering Wheel',
    // 새로운 복잡한 부품명들
    'Technic Axle 3L with Stop',
    'Minifig Head with Dual Sided Print',
    'Duplo Animal Elephant',
    'Bionicle Mask of Power',
    'Plant Leaf Large Palm',
    'Wheel 30.4 x 20 with Tread Pattern',
    'Hinge Plate 1 x 2 with 1 Finger',
    'Panel 1 x 2 x 1 with Rounded Corners',
    'Slope 30 1 x 1 x 2/3',
    'Wedge 4 x 2 Left',
    'Cylinder 1 x 1 with Stud',
    'Cone 1 x 1',
    'Arch 1 x 3',
    'Round Plate 1 x 1',
    'Dish 2 x 2 Inverted',
    'Bar 1L with Stop',
    'Fence 1 x 4 x 1',
    'Door 1 x 3 x 4 Right',
    'Window 1 x 2 x 2',
    'Roof Tile 1 x 2',
    'Transparent Red',
    'Glow in Dark',
    'Metallic Gold',
    'Pearl White',
    'Chrome Silver'
  ]
  
  console.log('🧩 고급 부품명 파싱 테스트 결과:')
  testNames.forEach(name => {
    const result = analyzePartNameAdvanced(name)
    console.log(`\n📦 ${name}`)
    console.log(`   형태: ${result.shapes.map(s => s.tag).join(', ')}`)
    console.log(`   크기: ${result.dimensions?.raw || '미지정'}`)
    console.log(`   특징: ${result.features.map(f => f.type).join(', ')}`)
    console.log(`   색상: ${result.colors.map(c => c.color).join(', ')}`)
    console.log(`   시리즈: ${result.series}`)
    console.log(`   신뢰도: ${(result.confidence * 100).toFixed(1)}%`)
  })
}

