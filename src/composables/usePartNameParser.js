// 🧩 부품명 파싱 및 정보 추출 유틸리티
// 다양한 부품명에서 구조화된 정보를 추출하는 함수들

/**
 * 부품명에서 크기 정보 추출 (예: "1 x 2", "2x4", "1x1x2/3")
 * @param {string} partName - 부품명
 * @returns {Object} 크기 정보
 */
export function extractDimensions(partName) {
  const patterns = [
    // 1x2, 2x4, 1x1x2/3 등
    /(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+(?:\/\d+)?))?/gi,
    // 1 x 2, 2 x 4 등 (공백 포함)
    /(\d+)\s+x\s+(\d+)(?:\s+x\s+(\d+(?:\/\d+)?))?/gi
  ]
  
  for (const pattern of patterns) {
    const match = partName.match(pattern)
    if (match) {
      const [, width, length, height] = match[0].split(/[x\s]+/).map(s => s.trim())
      return {
        width: parseInt(width) || 0,
        length: parseInt(length) || 0,
        height: height ? (height.includes('/') ? parseFloat(eval(height)) : parseInt(height)) : null,
        raw: match[0]
      }
    }
  }
  
  return { width: 0, length: 0, height: null, raw: null }
}

/**
 * 부품명에서 형태 키워드 추출
 * @param {string} partName - 부품명
 * @returns {Object} 형태 정보
 */
export function extractShapeKeywords(partName) {
  const name = partName.toLowerCase()
  
  return {
    // 기본 형태
    isBrick: /brick/.test(name),
    isPlate: /plate/.test(name),
    isTile: /tile/.test(name),
    isSlope: /slope/.test(name),
    isPanel: /panel/.test(name),
    isWedge: /wedge/.test(name),
    isCylinder: /cylinder/.test(name),
    isCone: /cone/.test(name),
    isArch: /arch/.test(name),
    isRound: /round/.test(name),
    isDish: /dish/.test(name),
    isHinge: /hinge/.test(name),
    isClip: /clip/.test(name),
    isBar: /bar/.test(name),
    isFence: /fence/.test(name),
    isDoor: /door/.test(name),
    isWindow: /window/.test(name),
    isRoof: /roof/.test(name),
    
    // 특수 형태
    isBracket: /bracket/.test(name),
    isCorner: /corner/.test(name),
    isCurved: /curved/.test(name),
    isInverted: /inverted/.test(name),
    isSpecial: /special/.test(name),
    isSteering: /steering/.test(name),
    isStand: /stand/.test(name),
    
    // 스터드 관련
    hasStuds: /stud/.test(name),
    noStuds: /no studs?/.test(name),
    openStud: /open stud/.test(name),
    centerStud: /center stud/.test(name),
    
    // 클립 관련
    hasClips: /clip/.test(name),
    horizontalClips: /horizontal.*clip/.test(name),
    verticalClips: /vertical.*clip/.test(name),
    openClips: /open.*clip/.test(name),
    
    // 색상 정보
    hasColor: /black|white|red|blue|green|yellow|orange|purple|pink|brown|gray|grey/.test(name),
    color: extractColor(name),
    
    // 기타 특성
    isDouble: /double/.test(name),
    isSingle: /single/.test(name),
    isOpen: /open/.test(name),
    isClosed: /closed/.test(name),
    isHorizontal: /horizontal/.test(name),
    isVertical: /vertical/.test(name)
  }
}

/**
 * 부품명에서 색상 정보 추출
 * @param {string} partName - 부품명
 * @returns {string|null} 색상명
 */
export function extractColor(partName) {
  const colorMap = {
    'black': 'black',
    'white': 'white', 
    'red': 'red',
    'blue': 'blue',
    'green': 'green',
    'yellow': 'yellow',
    'orange': 'orange',
    'purple': 'purple',
    'pink': 'pink',
    'brown': 'brown',
    'gray': 'gray',
    'grey': 'gray'
  }
  
  const name = partName.toLowerCase()
  for (const [color, value] of Object.entries(colorMap)) {
    if (name.includes(color)) {
      return value
    }
  }
  return null
}

/**
 * 부품명에서 시리즈 정보 추출
 * @param {string} partName - 부품명
 * @returns {string} 시리즈명
 */
export function extractSeries(partName) {
  const name = partName.toLowerCase()
  
  if (name.includes('duplo')) return 'duplo'
  if (name.includes('technic')) return 'technic'
  if (name.includes('bionicle')) return 'bionicle'
  if (name.includes('minifig')) return 'minifig'
  if (name.includes('animal')) return 'animal'
  if (name.includes('plant')) return 'plant'
  
  return 'system'
}

/**
 * 부품명에서 shape_tag 결정
 * @param {string} partName - 부품명
 * @returns {string} shape_tag
 */
export function determineShapeTag(partName) {
  const keywords = extractShapeKeywords(partName)
  
  // 우선순위별 shape_tag 결정
  if (keywords.isBracket) return 'bracket'
  if (keywords.isSteering) return 'steering'
  if (keywords.isStand) return 'stand'
  if (keywords.isBrick) return 'brick'
  if (keywords.isPlate) return 'plate'
  if (keywords.isTile) return 'tile'
  if (keywords.isSlope) return 'slope'
  if (keywords.isPanel) return 'panel'
  if (keywords.isWedge) return 'wedge'
  if (keywords.isCylinder) return 'cylinder'
  if (keywords.isCone) return 'cone'
  if (keywords.isArch) return 'arch'
  if (keywords.isRound) return 'round'
  if (keywords.isDish) return 'dish'
  if (keywords.isHinge) return 'hinge'
  if (keywords.isClip) return 'clip'
  if (keywords.isBar) return 'bar'
  if (keywords.isFence) return 'fence'
  if (keywords.isDoor) return 'door'
  if (keywords.isWindow) return 'window'
  if (keywords.isRoof) return 'roof'
  
  return 'unknown'
}

/**
 * 부품명에서 스터드 개수 추정
 * @param {string} partName - 부품명
 * @returns {Object} 스터드 정보
 */
export function estimateStudCount(partName) {
  const dimensions = extractDimensions(partName)
  const keywords = extractShapeKeywords(partName)
  
  let studCount = 0
  
  if (keywords.isBrick && dimensions.width && dimensions.length) {
    studCount = dimensions.width * dimensions.length
  } else if (keywords.isPlate && dimensions.width && dimensions.length) {
    studCount = dimensions.width * dimensions.length
  } else if (keywords.isTile && dimensions.width && dimensions.length) {
    studCount = dimensions.width * dimensions.length
  }
  
  return {
    top: keywords.noStuds ? 0 : studCount,
    bottom: 0,
    center: keywords.centerStud || keywords.openStud,
    hasStuds: !keywords.noStuds && studCount > 0
  }
}

/**
 * 부품명에서 튜브 개수 추정
 * @param {string} partName - 부품명
 * @returns {number} 튜브 개수
 */
export function estimateTubeCount(partName) {
  const dimensions = extractDimensions(partName)
  const keywords = extractShapeKeywords(partName)
  
  if (keywords.isBrick && dimensions.width && dimensions.length) {
    return dimensions.width * dimensions.length
  }
  
  return 0
}

/**
 * 부품명에서 홈(groove) 존재 여부 추정
 * @param {string} partName - 부품명
 * @returns {boolean} 홈 존재 여부
 */
export function estimateGroove(partName) {
  const name = partName.toLowerCase()
  return /groove|channel|slot/.test(name)
}

/**
 * 부품명에서 혼동 가능한 부품 추정
 * @param {string} partName - 부품명
 * @returns {Array} 혼동 가능한 부품 목록
 */
export function estimateConfusions(partName) {
  const keywords = extractShapeKeywords(partName)
  const dimensions = extractDimensions(partName)
  const confusions = []
  
  // 크기 기반 혼동 부품
  if (dimensions.width && dimensions.length) {
    const size = `${dimensions.width}x${dimensions.length}`
    
    if (keywords.isBrick) {
      confusions.push(`${size} plate`, `${size} tile`)
    } else if (keywords.isPlate) {
      confusions.push(`${size} brick`, `${size} tile`)
    } else if (keywords.isTile) {
      confusions.push(`${size} brick`, `${size} plate`)
    }
  }
  
  // 형태 기반 혼동 부품
  if (keywords.isCurved) {
    confusions.push('straight version')
  }
  if (keywords.isInverted) {
    confusions.push('normal version')
  }
  if (keywords.isCorner) {
    confusions.push('straight version')
  }
  
  return confusions
}

/**
 * 부품명에서 구별되는 특징 추출
 * @param {string} partName - 부품명
 * @returns {Array} 구별되는 특징 목록
 */
export function extractDistinguishingFeatures(partName) {
  const keywords = extractShapeKeywords(partName)
  const dimensions = extractDimensions(partName)
  const features = []
  
  // 크기 특징
  if (dimensions.raw) {
    features.push(`${dimensions.raw} size`)
  }
  
  // 형태 특징
  if (keywords.isCurved) features.push('curved shape')
  if (keywords.isInverted) features.push('inverted design')
  if (keywords.isCorner) features.push('corner piece')
  if (keywords.isDouble) features.push('double design')
  if (keywords.isSpecial) features.push('special design')
  
  // 스터드 특징
  if (keywords.noStuds) features.push('no studs')
  if (keywords.openStud) features.push('open stud')
  if (keywords.centerStud) features.push('center stud')
  
  // 클립 특징
  if (keywords.hasClips) features.push('with clips')
  if (keywords.horizontalClips) features.push('horizontal clips')
  if (keywords.verticalClips) features.push('vertical clips')
  if (keywords.openClips) features.push('open clips')
  
  // 색상 특징
  if (keywords.color) features.push(`${keywords.color} color`)
  
  // 기타 특징
  if (keywords.isSteering) features.push('steering function')
  if (keywords.isStand) features.push('stand function')
  if (keywords.isOpen) features.push('open design')
  if (keywords.isClosed) features.push('closed design')
  
  return features
}

/**
 * 부품명에서 인식 힌트 생성
 * @param {string} partName - 부품명
 * @returns {Object} 인식 힌트
 */
export function generateRecognitionHints(partName) {
  const keywords = extractShapeKeywords(partName)
  const dimensions = extractDimensions(partName)
  const features = extractDistinguishingFeatures(partName)
  
  let hint = ''
  
  // 기본 형태 설명
  if (keywords.isBrick) hint += '브릭 형태의 '
  else if (keywords.isPlate) hint += '플레이트 형태의 '
  else if (keywords.isTile) hint += '타일 형태의 '
  else if (keywords.isBracket) hint += '브래킷 형태의 '
  else if (keywords.isSteering) hint += '스티어링 형태의 '
  
  // 크기 정보
  if (dimensions.raw) {
    hint += `${dimensions.raw} 크기의 `
  }
  
  // 특수 특징
  if (keywords.isCurved) hint += '곡선형 '
  if (keywords.isInverted) hint += '뒤집힌 '
  if (keywords.isCorner) hint += '모서리 '
  if (keywords.isDouble) hint += '이중 '
  if (keywords.isSpecial) hint += '특수 '
  
  // 스터드 정보
  if (keywords.noStuds) hint += '스터드 없는 '
  if (keywords.openStud) hint += '열린 스터드가 있는 '
  if (keywords.centerStud) hint += '중앙 스터드가 있는 '
  
  // 클립 정보
  if (keywords.hasClips) hint += '클립이 있는 '
  if (keywords.horizontalClips) hint += '수평 클립이 있는 '
  if (keywords.verticalClips) hint += '수직 클립이 있는 '
  
  // 색상 정보
  if (keywords.color) hint += `${keywords.color}색 `
  
  hint += '레고 부품'
  
  return {
    ko: hint,
    en: partName,
    lang: 'ko',
    top_view: keywords.isBrick ? '상단에서 보면 스터드가 보임' : '상단에서 보면 평평함',
    side_view: keywords.isCurved ? '측면에서 보면 곡선형' : '측면에서 보면 직선형',
    unique_features: features
  }
}

/**
 * 부품명 전체 분석 함수
 * @param {string} partName - 부품명
 * @returns {Object} 전체 분석 결과
 */
export function analyzePartName(partName) {
  const dimensions = extractDimensions(partName)
  const keywords = extractShapeKeywords(partName)
  const series = extractSeries(partName)
  const shapeTag = determineShapeTag(partName)
  const studInfo = estimateStudCount(partName)
  const tubeCount = estimateTubeCount(partName)
  const hasGroove = estimateGroove(partName)
  const confusions = estimateConfusions(partName)
  const features = extractDistinguishingFeatures(partName)
  const hints = generateRecognitionHints(partName)
  
  return {
    partName,
    dimensions,
    keywords,
    series,
    shapeTag,
    studInfo,
    tubeCount,
    hasGroove,
    confusions,
    features,
    hints,
    
    // LLM 프롬프트용 요약
    summary: {
      type: shapeTag,
      size: dimensions.raw,
      special: features.filter(f => f.includes('special') || f.includes('curved') || f.includes('inverted')),
      studs: studInfo.hasStuds ? `${studInfo.top}개` : '없음',
      clips: keywords.hasClips ? '있음' : '없음',
      color: keywords.color || '미지정'
    }
  }
}

// 테스트 함수
export function testPartNameParsing() {
  const testNames = [
    'Bracket 1 x 1 - 1 x 2 Inverted',
    'Brick 2 x 2 Corner', 
    'Brick Curved 1 x 1 x 2/3 Double Curved Top, No Studs',
    'Plate 1 x 1 x 2/3 with Open Stud',
    'Plate Special 1 x 2 with Clips Horizontal [Open O Clips]',
    'Steering Stand 1 x 2 with Black Steering Wheel'
  ]
  
  console.log('🧩 부품명 파싱 테스트 결과:')
  testNames.forEach(name => {
    const result = analyzePartName(name)
    console.log(`\n📦 ${name}`)
    console.log(`   형태: ${result.shapeTag}`)
    console.log(`   크기: ${result.dimensions.raw}`)
    console.log(`   스터드: ${result.studInfo.top}개`)
    console.log(`   특징: ${result.features.join(', ')}`)
    console.log(`   인식힌트: ${result.hints.ko}`)
  })
}

