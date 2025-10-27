// 🧩 부품명 패턴 확장 시스템
// 새로운 부품명 패턴을 자동으로 학습하고 확장하는 시스템

/**
 * 패턴 확장 전략
 * 1. 규칙 기반 패턴 (정확한 매칭)
 * 2. 퍼지 매칭 (부분 일치)
 * 3. 컨텍스트 분석 (문맥 고려)
 * 4. 머신러닝 기반 학습 (패턴 자동 발견)
 */

// 🔍 확장 가능한 패턴 정의
export const EXTENSIBLE_PATTERNS = {
  // 크기 패턴 (정규식 기반, 확장 가능)
  dimensions: {
    // 기본 크기 패턴
    basic: [
      { pattern: /(\d+)\s*x\s*(\d+)/gi, type: '2d', confidence: 0.9 },
      { pattern: /(\d+)\s*x\s*(\d+)\s*x\s*(\d+(?:\/\d+)?)/gi, type: '3d', confidence: 0.9 },
      { pattern: /(\d+)\s+x\s+(\d+)/gi, type: '2d_spaced', confidence: 0.8 },
      { pattern: /(\d+)\s+x\s+(\d+)\s+x\s+(\d+(?:\/\d+)?)/gi, type: '3d_spaced', confidence: 0.8 }
    ],
    
    // 특수 크기 패턴
    special: [
      { pattern: /(\d+)\s*-\s*(\d+)/gi, type: 'range', confidence: 0.7 },
      { pattern: /(\d+)\s*\/\s*(\d+)/gi, type: 'fraction', confidence: 0.7 },
      { pattern: /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/gi, type: 'decimal', confidence: 0.8 },
      { pattern: /(\d+)\s*L/gi, type: 'length', confidence: 0.6 }
    ],
    
    // 단위 패턴
    units: [
      { pattern: /(\d+(?:\.\d+)?)\s*mm/gi, type: 'millimeter', confidence: 0.9 },
      { pattern: /(\d+(?:\.\d+)?)\s*cm/gi, type: 'centimeter', confidence: 0.9 },
      { pattern: /(\d+(?:\.\d+)?)\s*in/gi, type: 'inch', confidence: 0.9 }
    ]
  },
  
  // 형태 패턴 (키워드 기반, 확장 가능)
  shapes: {
    // 기본 형태
    basic: [
      { keywords: ['brick', '브릭'], tag: 'brick', priority: 1, confidence: 0.9 },
      { keywords: ['plate', '플레이트'], tag: 'plate', priority: 1, confidence: 0.9 },
      { keywords: ['tile', '타일'], tag: 'tile', priority: 1, confidence: 0.9 },
      { keywords: ['slope', '경사'], tag: 'slope', priority: 1, confidence: 0.9 },
      { keywords: ['panel', '패널'], tag: 'panel', priority: 1, confidence: 0.9 },
      { keywords: ['wedge', '웨지'], tag: 'wedge', priority: 1, confidence: 0.9 },
      { keywords: ['cylinder', '실린더'], tag: 'cylinder', priority: 1, confidence: 0.9 },
      { keywords: ['cone', '콘'], tag: 'cone', priority: 1, confidence: 0.9 },
      { keywords: ['arch', '아치'], tag: 'arch', priority: 1, confidence: 0.9 },
      { keywords: ['round', '라운드'], tag: 'round', priority: 1, confidence: 0.9 },
      { keywords: ['dish', '디시'], tag: 'dish', priority: 1, confidence: 0.9 },
      { keywords: ['hinge', '힌지'], tag: 'hinge', priority: 1, confidence: 0.9 },
      { keywords: ['clip', '클립'], tag: 'clip', priority: 1, confidence: 0.9 },
      { keywords: ['bar', '바'], tag: 'bar', priority: 1, confidence: 0.9 },
      { keywords: ['fence', '펜스'], tag: 'fence', priority: 1, confidence: 0.9 },
      { keywords: ['door', '도어'], tag: 'door', priority: 1, confidence: 0.9 },
      { keywords: ['window', '윈도우'], tag: 'window', priority: 1, confidence: 0.9 },
      { keywords: ['roof', '루프'], tag: 'roof', priority: 1, confidence: 0.9 }
    ],
    
    // 특수 형태
    special: [
      { keywords: ['bracket', '브래킷'], tag: 'bracket', priority: 2, confidence: 0.8 },
      { keywords: ['steering', '스티어링'], tag: 'steering', priority: 2, confidence: 0.8 },
      { keywords: ['stand', '스탠드'], tag: 'stand', priority: 2, confidence: 0.8 },
      { keywords: ['corner', '코너'], tag: 'corner', priority: 2, confidence: 0.8 },
      { keywords: ['inverted', '인버티드'], tag: 'inverted', priority: 2, confidence: 0.8 },
      { keywords: ['curved', '커브드'], tag: 'curved', priority: 2, confidence: 0.8 },
      { keywords: ['special', '스페셜'], tag: 'special', priority: 2, confidence: 0.8 },
      { keywords: ['double', '더블'], tag: 'double', priority: 2, confidence: 0.8 },
      { keywords: ['single', '싱글'], tag: 'single', priority: 2, confidence: 0.8 }
    ],
    
    // 복합 형태
    compound: [
      { keywords: ['hinge plate', '힌지 플레이트'], tag: 'hinge_plate', priority: 3, confidence: 0.9 },
      { keywords: ['slope brick', '경사 브릭'], tag: 'slope_brick', priority: 3, confidence: 0.9 },
      { keywords: ['corner brick', '코너 브릭'], tag: 'corner_brick', priority: 3, confidence: 0.9 },
      { keywords: ['round plate', '라운드 플레이트'], tag: 'round_plate', priority: 3, confidence: 0.9 },
      { keywords: ['roof tile', '루프 타일'], tag: 'roof_tile', priority: 3, confidence: 0.9 }
    ]
  },
  
  // 특성 패턴 (조건부, 확장 가능)
  features: {
    // 스터드 관련
    studs: [
      { keywords: ['stud', '스터드'], type: 'stud', confidence: 0.8 },
      { keywords: ['no studs', 'no stud', '스터드 없음'], type: 'no_studs', confidence: 0.9 },
      { keywords: ['open stud', '열린 스터드'], type: 'open_stud', confidence: 0.9 },
      { keywords: ['center stud', '중앙 스터드'], type: 'center_stud', confidence: 0.9 },
      { keywords: ['stud on top', '상단 스터드'], type: 'stud_top', confidence: 0.8 },
      { keywords: ['stud on bottom', '하단 스터드'], type: 'stud_bottom', confidence: 0.8 }
    ],
    
    // 클립 관련
    clips: [
      { keywords: ['clip', '클립'], type: 'clip', confidence: 0.8 },
      { keywords: ['clips', '클립들'], type: 'clips', confidence: 0.8 },
      { keywords: ['horizontal clip', '수평 클립'], type: 'horizontal_clip', confidence: 0.9 },
      { keywords: ['vertical clip', '수직 클립'], type: 'vertical_clip', confidence: 0.9 },
      { keywords: ['open clip', '열린 클립'], type: 'open_clip', confidence: 0.9 },
      { keywords: ['closed clip', '닫힌 클립'], type: 'closed_clip', confidence: 0.9 }
    ],
    
    // 연결 관련
    connections: [
      { keywords: ['hinge', '힌지'], type: 'hinge', confidence: 0.8 },
      { keywords: ['ball joint', '볼 조인트'], type: 'ball_joint', confidence: 0.9 },
      { keywords: ['socket', '소켓'], type: 'socket', confidence: 0.8 },
      { keywords: ['pin', '핀'], type: 'pin', confidence: 0.8 },
      { keywords: ['axle', '액슬'], type: 'axle', confidence: 0.8 },
      { keywords: ['connector', '커넥터'], type: 'connector', confidence: 0.8 }
    ],
    
    // 표면 관련
    surface: [
      { keywords: ['smooth', '매끄러운'], type: 'smooth', confidence: 0.8 },
      { keywords: ['textured', '텍스처'], type: 'textured', confidence: 0.8 },
      { keywords: ['grooved', '홈이 있는'], type: 'grooved', confidence: 0.8 },
      { keywords: ['ridged', '릿지'], type: 'ridged', confidence: 0.8 },
      { keywords: ['patterned', '패턴'], type: 'patterned', confidence: 0.8 }
    ],
    
    // 방향 관련
    orientation: [
      { keywords: ['left', '왼쪽'], type: 'left', confidence: 0.8 },
      { keywords: ['right', '오른쪽'], type: 'right', confidence: 0.8 },
      { keywords: ['up', '위'], type: 'up', confidence: 0.8 },
      { keywords: ['down', '아래'], type: 'down', confidence: 0.8 },
      { keywords: ['horizontal', '수평'], type: 'horizontal', confidence: 0.8 },
      { keywords: ['vertical', '수직'], type: 'vertical', confidence: 0.8 }
    ]
  },
  
  // 색상 패턴 (확장 가능)
  colors: {
    // 기본 색상
    basic: [
      { keywords: ['black', '검은', '블랙'], color: 'black', confidence: 0.9 },
      { keywords: ['white', '흰', '화이트'], color: 'white', confidence: 0.9 },
      { keywords: ['red', '빨간', '레드'], color: 'red', confidence: 0.9 },
      { keywords: ['blue', '파란', '블루'], color: 'blue', confidence: 0.9 },
      { keywords: ['green', '초록', '그린'], color: 'green', confidence: 0.9 },
      { keywords: ['yellow', '노란', '옐로우'], color: 'yellow', confidence: 0.9 },
      { keywords: ['orange', '주황', '오렌지'], color: 'orange', confidence: 0.9 },
      { keywords: ['purple', '보라', '퍼플'], color: 'purple', confidence: 0.9 },
      { keywords: ['pink', '분홍', '핑크'], color: 'pink', confidence: 0.9 },
      { keywords: ['brown', '갈색', '브라운'], color: 'brown', confidence: 0.9 },
      { keywords: ['gray', 'grey', '회색', '그레이'], color: 'gray', confidence: 0.9 }
    ],
    
    // 특수 색상
    special: [
      { keywords: ['transparent', '투명', '트랜스패런트'], color: 'transparent', confidence: 0.9 },
      { keywords: ['metallic', '메탈릭'], color: 'metallic', confidence: 0.8 },
      { keywords: ['pearl', '펄'], color: 'pearl', confidence: 0.8 },
      { keywords: ['chrome', '크롬'], color: 'chrome', confidence: 0.8 },
      { keywords: ['glow', '글로우'], color: 'glow', confidence: 0.8 },
      { keywords: ['fluorescent', '형광'], color: 'fluorescent', confidence: 0.8 }
    ],
    
    // 복합 색상
    compound: [
      { keywords: ['transparent red', '투명 빨간'], color: 'transparent_red', confidence: 0.9 },
      { keywords: ['metallic gold', '메탈릭 골드'], color: 'metallic_gold', confidence: 0.9 },
      { keywords: ['pearl white', '펄 화이트'], color: 'pearl_white', confidence: 0.9 },
      { keywords: ['chrome silver', '크롬 실버'], color: 'chrome_silver', confidence: 0.9 }
    ]
  },
  
  // 시리즈 패턴 (확장 가능)
  series: {
    // 기본 시리즈
    basic: [
      { keywords: ['duplo', '듀플로'], series: 'duplo', confidence: 0.9 },
      { keywords: ['technic', '테크닉'], series: 'technic', confidence: 0.9 },
      { keywords: ['bionicle', '바이오니클'], series: 'bionicle', confidence: 0.9 },
      { keywords: ['minifig', '미니피그'], series: 'minifig', confidence: 0.9 },
      { keywords: ['animal', '동물'], series: 'animal', confidence: 0.8 },
      { keywords: ['plant', '식물'], series: 'plant', confidence: 0.8 }
    ],
    
    // 특수 시리즈
    special: [
      { keywords: ['friends', '프렌즈'], series: 'friends', confidence: 0.8 },
      { keywords: ['creator', '크리에이터'], series: 'creator', confidence: 0.8 },
      { keywords: ['city', '시티'], series: 'city', confidence: 0.8 },
      { keywords: ['ninjago', '닌자고'], series: 'ninjago', confidence: 0.8 },
      { keywords: ['star wars', '스타워즈'], series: 'star_wars', confidence: 0.8 }
    ]
  }
}

/**
 * 패턴 확장 시스템
 * 새로운 부품명 패턴을 자동으로 학습하고 확장
 */
export class PatternExpansionSystem {
  constructor() {
    this.learnedPatterns = new Map()
    this.confidenceThreshold = 0.6
    this.expansionThreshold = 0.8
  }
  
  /**
   * 새로운 패턴 학습
   * @param {string} partName - 부품명
   * @param {Object} analysisResult - 분석 결과
   */
  learnNewPattern(partName, analysisResult) {
    const patterns = this.extractNewPatterns(partName, analysisResult)
    
    patterns.forEach(pattern => {
      const key = `${pattern.category}_${pattern.type}`
      if (!this.learnedPatterns.has(key)) {
        this.learnedPatterns.set(key, [])
      }
      
      const existingPatterns = this.learnedPatterns.get(key)
      const existingPattern = existingPatterns.find(p => p.pattern === pattern.pattern)
      
      if (existingPattern) {
        existingPattern.count++
        existingPattern.confidence = Math.min(1.0, existingPattern.confidence + 0.1)
        existingPattern.examples.push(partName)
      } else {
        existingPatterns.push({
          pattern: pattern.pattern,
          count: 1,
          confidence: 0.5,
          examples: [partName],
          category: pattern.category,
          type: pattern.type
        })
      }
    })
  }
  
  /**
   * 새로운 패턴 추출
   * @param {string} partName - 부품명
   * @param {Object} analysisResult - 분석 결과
   * @returns {Array} 새로운 패턴들
   */
  extractNewPatterns(partName, analysisResult) {
    const patterns = []
    
    // 크기 패턴 추출
    if (analysisResult.dimensions) {
      const dimensionPattern = this.extractDimensionPattern(partName)
      if (dimensionPattern) {
        patterns.push({
          category: 'dimension',
          type: dimensionPattern.type,
          pattern: dimensionPattern.pattern,
          confidence: dimensionPattern.confidence
        })
      }
    }
    
    // 형태 패턴 추출
    if (analysisResult.shapes && analysisResult.shapes.length > 0) {
      analysisResult.shapes.forEach(shape => {
        const shapePattern = this.extractShapePattern(partName, shape)
        if (shapePattern) {
          patterns.push({
            category: 'shape',
            type: shape.tag,
            pattern: shapePattern.pattern,
            confidence: shapePattern.confidence
          })
        }
      })
    }
    
    // 특성 패턴 추출
    if (analysisResult.features && analysisResult.features.length > 0) {
      analysisResult.features.forEach(feature => {
        const featurePattern = this.extractFeaturePattern(partName, feature)
        if (featurePattern) {
          patterns.push({
            category: 'feature',
            type: feature.type,
            pattern: featurePattern.pattern,
            confidence: featurePattern.confidence
          })
        }
      })
    }
    
    return patterns
  }
  
  /**
   * 크기 패턴 추출
   * @param {string} partName - 부품명
   * @returns {Object} 크기 패턴
   */
  extractDimensionPattern(partName) {
    // 다양한 크기 패턴 시도
    const patterns = [
      { regex: /(\d+)\s*x\s*(\d+)/gi, type: '2d' },
      { regex: /(\d+)\s*x\s*(\d+)\s*x\s*(\d+(?:\/\d+)?)/gi, type: '3d' },
      { regex: /(\d+)\s+x\s+(\d+)/gi, type: '2d_spaced' },
      { regex: /(\d+)\s+x\s+(\d+)\s+x\s+(\d+(?:\/\d+)?)/gi, type: '3d_spaced' },
      { regex: /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/gi, type: 'decimal' },
      { regex: /(\d+)\s*L/gi, type: 'length' }
    ]
    
    for (const pattern of patterns) {
      const match = partName.match(pattern.regex)
      if (match) {
        return {
          pattern: pattern.regex.source,
          type: pattern.type,
          confidence: 0.8
        }
      }
    }
    
    return null
  }
  
  /**
   * 형태 패턴 추출
   * @param {string} partName - 부품명
   * @param {Object} shape - 형태 정보
   * @returns {Object} 형태 패턴
   */
  extractShapePattern(partName, shape) {
    // 형태 키워드 찾기
    const keywords = EXTENSIBLE_PATTERNS.shapes.basic
      .concat(EXTENSIBLE_PATTERNS.shapes.special)
      .concat(EXTENSIBLE_PATTERNS.shapes.compound)
    
    for (const keywordDef of keywords) {
      if (keywordDef.tag === shape.tag) {
        for (const keyword of keywordDef.keywords) {
          if (partName.toLowerCase().includes(keyword.toLowerCase())) {
            return {
              pattern: keyword,
              confidence: keywordDef.confidence
            }
          }
        }
      }
    }
    
    return null
  }
  
  /**
   * 특성 패턴 추출
   * @param {string} partName - 부품명
   * @param {Object} feature - 특성 정보
   * @returns {Object} 특성 패턴
   */
  extractFeaturePattern(partName, feature) {
    // 특성 키워드 찾기
    const allFeatures = [
      ...EXTENSIBLE_PATTERNS.features.studs,
      ...EXTENSIBLE_PATTERNS.features.clips,
      ...EXTENSIBLE_PATTERNS.features.connections,
      ...EXTENSIBLE_PATTERNS.features.surface,
      ...EXTENSIBLE_PATTERNS.features.orientation
    ]
    
    for (const featureDef of allFeatures) {
      if (featureDef.type === feature.type) {
        for (const keyword of featureDef.keywords) {
          if (partName.toLowerCase().includes(keyword.toLowerCase())) {
            return {
              pattern: keyword,
              confidence: featureDef.confidence
            }
          }
        }
      }
    }
    
    return null
  }
  
  /**
   * 학습된 패턴으로 분석
   * @param {string} partName - 부품명
   * @returns {Object} 분석 결과
   */
  analyzeWithLearnedPatterns(partName) {
    const result = {
      dimensions: null,
      shapes: [],
      features: [],
      colors: [],
      series: 'system',
      confidence: 0.0
    }
    
    // 학습된 패턴 적용
    this.learnedPatterns.forEach((patterns, key) => {
      patterns.forEach(pattern => {
        if (pattern.confidence >= this.confidenceThreshold) {
          const match = partName.match(new RegExp(pattern.pattern, 'gi'))
          if (match) {
            const [category, type] = key.split('_')
            
            switch (category) {
              case 'dimension':
                result.dimensions = {
                  raw: match[0],
                  type: type,
                  confidence: pattern.confidence
                }
                break
              case 'shape':
                result.shapes.push({
                  tag: type,
                  confidence: pattern.confidence
                })
                break
              case 'feature':
                result.features.push({
                  type: type,
                  confidence: pattern.confidence
                })
                break
            }
            
            result.confidence = Math.max(result.confidence, pattern.confidence)
          }
        }
      })
    })
    
    return result
  }
  
  /**
   * 패턴 확장 제안
   * @returns {Array} 확장 제안 목록
   */
  getExpansionSuggestions() {
    const suggestions = []
    
    this.learnedPatterns.forEach((patterns, key) => {
      patterns.forEach(pattern => {
        if (pattern.count >= 3 && pattern.confidence >= this.expansionThreshold) {
          suggestions.push({
            category: key.split('_')[0],
            type: key.split('_')[1],
            pattern: pattern.pattern,
            count: pattern.count,
            confidence: pattern.confidence,
            examples: pattern.examples.slice(0, 3)
          })
        }
      })
    })
    
    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }
}

// 전역 패턴 확장 시스템
export const globalPatternExpansion = new PatternExpansionSystem()

/**
 * 패턴 확장 테스트
 */
export function testPatternExpansion() {
  const testNames = [
    'Bracket 1 x 1 - 1 x 2 Inverted',
    'Brick 2 x 2 Corner',
    'Brick Curved 1 x 1 x 2/3 Double Curved Top, No Studs',
    'Plate 1 x 1 x 2/3 with Open Stud',
    'Plate Special 1 x 2 with Clips Horizontal [Open O Clips]',
    'Steering Stand 1 x 2 with Black Steering Wheel',
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
  
  console.log('🧩 패턴 확장 시스템 테스트:')
  
  // 각 부품명에 대해 패턴 학습
  testNames.forEach(name => {
    const result = globalPatternExpansion.analyzeWithLearnedPatterns(name)
    globalPatternExpansion.learnNewPattern(name, result)
  })
  
  // 확장 제안 출력
  const suggestions = globalPatternExpansion.getExpansionSuggestions()
  console.log('\n📈 패턴 확장 제안:')
  suggestions.forEach(suggestion => {
    console.log(`   ${suggestion.category}.${suggestion.type}: ${suggestion.pattern} (${suggestion.count}회, ${(suggestion.confidence * 100).toFixed(1)}%)`)
    console.log(`     예시: ${suggestion.examples.join(', ')}`)
  })
}

