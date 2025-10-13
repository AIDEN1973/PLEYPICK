-- ============================================================================
-- 메타데이터 프롬프트 설정 테이블
-- ============================================================================
-- 목적: LLM 프롬프트 및 설정을 DB에서 중앙 관리
-- 작성일: 2025-10-13
-- ============================================================================

-- 1. 활성 설정 테이블 (현재 사용 중인 설정)
CREATE TABLE IF NOT EXISTS metadata_prompt_configs (
    id TEXT PRIMARY KEY DEFAULT 'active',
    
    -- 프롬프트 관련
    system_prompt TEXT NOT NULL,
    main_prompt TEXT NOT NULL,
    requirements TEXT,
    
    -- LLM 설정
    llm_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    llm_temperature NUMERIC(3,2) NOT NULL DEFAULT 0.1,
    llm_max_tokens INTEGER NOT NULL DEFAULT 1000,
    llm_timeout INTEGER NOT NULL DEFAULT 8000, -- milliseconds
    llm_enable_fallback BOOLEAN NOT NULL DEFAULT TRUE,
    llm_json_mode BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- 검증 규칙 (JSONB)
    validation_rules JSONB,
    
    -- 메타데이터
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 활성 설정이 하나만 존재하도록 제약 조건
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_config 
ON metadata_prompt_configs (id) WHERE is_active = TRUE;

-- 업데이트 시 updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_metadata_prompt_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER metadata_prompt_configs_updated_at_trigger
BEFORE UPDATE ON metadata_prompt_configs
FOR EACH ROW
EXECUTE FUNCTION update_metadata_prompt_configs_updated_at();

-- ============================================================================
-- 2. 프리셋 테이블 (미리 정의된 설정 템플릿)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metadata_prompt_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 프리셋 정보
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[],
    
    -- 프롬프트 관련
    system_prompt TEXT NOT NULL,
    main_prompt TEXT NOT NULL,
    requirements TEXT,
    
    -- LLM 설정 (JSONB로 유연하게 관리)
    llm_config JSONB NOT NULL,
    
    -- 검증 규칙 (JSONB)
    validation_rules JSONB,
    
    -- 메타데이터
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 프리셋 이름에 인덱스
CREATE INDEX IF NOT EXISTS idx_metadata_prompt_presets_name 
ON metadata_prompt_presets(name);

-- 태그 검색을 위한 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_metadata_prompt_presets_tags 
ON metadata_prompt_presets USING GIN(tags);

-- 업데이트 시 updated_at 자동 갱신 트리거
CREATE TRIGGER metadata_prompt_presets_updated_at_trigger
BEFORE UPDATE ON metadata_prompt_presets
FOR EACH ROW
EXECUTE FUNCTION update_metadata_prompt_configs_updated_at();

-- ============================================================================
-- 3. 초기 데이터 삽입
-- ============================================================================

-- 기본 활성 설정 (v2.1 개선된 버전)
INSERT INTO metadata_prompt_configs (
    id, 
    system_prompt, 
    main_prompt, 
    requirements,
    llm_model, 
    llm_temperature, 
    llm_max_tokens, 
    llm_timeout,
    llm_enable_fallback, 
    llm_json_mode, 
    validation_rules, 
    description
) VALUES (
    'active',
    '당신은 레고 부품 전문가입니다. 이미지를 분석하여 JSON 형식으로 응답하세요.',
    '부품 정보:
- 부품명: ${partName}
- 부품 번호: ${partNum}
- 색상: ${colorName}

다음 JSON 형식으로 정확히 응답해주세요:

{
  "part_id": "${partNum}",
  "shape_tag": "plate, brick, tile, slope, panel, wedge, cylinder, cone, arch, round, dish, minifig_part, unknown 중 하나 (순수 형태만)",
  "series": "system, duplo, technic, bionicle, unknown 중 하나 (부품명에서 추출)",
  "stud_count_top": 상단 스터드 개수 (숫자),
  "tube_count_bottom": 하단 튜브 개수 (숫자),
  "center_stud": 중앙 스터드 여부 (true/false),
  "groove": 홈 존재 여부 (true/false),
  "confusions": ["유사한_부품1", "유사한_부품2"],
  "distinguishing_features": ["구별되는 특징1", "구별되는 특징2"],
  "recognition_hints": {
    "ko": "한국어 상세 설명 (최소 20자, 자연스러운 문장)",
    "top_view": "위에서 본 모습 설명",
    "side_view": "옆에서 본 모습 설명",
    "unique_features": ["고유 특징1", "고유 특징2"]
  }
}',
    '필수 요구사항:
- shape_tag: 순수 형태만 분류 (duplo, technic 등 시리즈명 제외)
- series: 부품명에서 시리즈 추출 (Duplo → duplo, Technic → technic, 없으면 system)
- recognition_hints.ko: 반드시 20자 이상의 자연스러운 한국어 설명
- confusions: 최소 1개 이상의 유사 부품 ID
- 모든 배열은 반드시 ]로 닫기
- JSON 외 다른 텍스트 절대 금지',
    'gpt-4o-mini',
    0.1,
    1000,
    8000,
    TRUE,
    TRUE,
    '{"requireRecognitionHints": true, "minRecognitionHintsLength": 20, "requireConfusions": true, "minConfusions": 1, "requireDistinguishingFeatures": true, "minDistinguishingFeatures": 2, "autoDetectPrinted": true, "structuredRecognitionHints": true, "removePartNumFromFeatureText": true, "requiredFields": ["part_id", "shape_tag", "stud_count_top", "tube_count_bottom", "center_stud", "groove", "confusions", "distinguishing_features", "recognition_hints"]}',
    '시스템 초기 기본 설정 (v2.1)'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 프리셋 1: v2.1 기본 설정
-- ============================================================================
INSERT INTO metadata_prompt_presets (
    name, 
    description, 
    tags, 
    system_prompt, 
    main_prompt, 
    requirements, 
    llm_config, 
    validation_rules, 
    is_public
) VALUES (
    'v2.1 기본 설정',
    '현재 시스템의 기본 설정 (개선된 프롬프트, 성능/품질 균형)',
    ARRAY['default', 'v2.1', 'recommended', 'balanced'],
    '당신은 레고 부품 전문가입니다. 이미지를 분석하여 JSON 형식으로 응답하세요.',
    '부품 정보:
- 부품명: ${partName}
- 부품 번호: ${partNum}
- 색상: ${colorName}

다음 JSON 형식으로 정확히 응답해주세요:

{
  "part_id": "${partNum}",
  "shape_tag": "plate, brick, tile, slope, panel, wedge, cylinder, cone, arch, round, dish, minifig_part, unknown 중 하나 (순수 형태만)",
  "series": "system, duplo, technic, bionicle, unknown 중 하나 (부품명에서 추출)",
  "stud_count_top": 상단 스터드 개수 (숫자),
  "tube_count_bottom": 하단 튜브 개수 (숫자),
  "center_stud": 중앙 스터드 여부 (true/false),
  "groove": 홈 존재 여부 (true/false),
  "confusions": ["유사한_부품1", "유사한_부품2"],
  "distinguishing_features": ["구별되는 특징1", "구별되는 특징2"],
  "recognition_hints": {
    "ko": "한국어 상세 설명 (최소 20자, 자연스러운 문장)",
    "top_view": "위에서 본 모습 설명",
    "side_view": "옆에서 본 모습 설명",
    "unique_features": ["고유 특징1", "고유 특징2"]
  }
}',
    '필수 요구사항:
- shape_tag: 순수 형태만 분류 (duplo, technic 등 시리즈명 제외)
- series: 부품명에서 시리즈 추출 (Duplo → duplo, Technic → technic, 없으면 system)
- recognition_hints.ko: 반드시 20자 이상의 자연스러운 한국어 설명
- confusions: 최소 1개 이상의 유사 부품 ID
- 모든 배열은 반드시 ]로 닫기
- JSON 외 다른 텍스트 절대 금지',
    '{"model": "gpt-4o-mini", "temperature": 0.1, "maxTokens": 1000, "timeout": 8000, "enableFallback": true, "jsonMode": true}',
    '{"requireRecognitionHints": true, "minRecognitionHintsLength": 20, "requireConfusions": true, "minConfusions": 1, "requireDistinguishingFeatures": true, "minDistinguishingFeatures": 2, "autoDetectPrinted": true, "structuredRecognitionHints": true, "removePartNumFromFeatureText": true}',
    TRUE
);

-- ============================================================================
-- 프리셋 2: 06a13fe 초기 비전
-- ============================================================================
INSERT INTO metadata_prompt_presets (
    name, 
    description, 
    tags, 
    system_prompt, 
    main_prompt, 
    requirements, 
    llm_config, 
    validation_rules, 
    is_public
) VALUES (
    '06a13fe 초기 비전',
    '비전 테스트 초기 버전의 프롬프트 (상세한 구조, 고품질)',
    ARRAY['legacy', '06a13fe', 'detailed'],
    '당신은 레고 부품 분석 전문가입니다. 부품 이미지를 분석하여 구조화된 특징 정보를 제공해주세요.',
    '부품 정보:
- 부품명: ${partName}
- 색상: ${colorName}
- 부품 번호: ${partNum}

다음 JSON 구조로 상세한 분석 결과를 제공해주세요:
{
  "visual_features": {
    "shape_description": "부품의 모양에 대한 상세 설명",
    "key_identifiers": ["주요 식별 특징들"],
    "distinguishing_marks": ["구별되는 마크나 로고"],
    "color_analysis": {
      "primary_color": "주 색상",
      "color_consistency": "색상 일관성",
      "finish_type": "표면 마감 유형"
    }
  },
  "geometric_features": {
    "dimensions": "크기 정보",
    "shape_type": "형태 유형",
    "stud_count": "스터드 개수",
    "tube_count": "튜브 개수",
    "height": "높이",
    "symmetry": "대칭성"
  },
  "recognition_hints": {
    "top_view": "상단에서 본 모습",
    "side_view": "측면에서 본 모습", 
    "bottom_view": "하단에서 본 모습",
    "unique_features": ["고유한 특징들"],
    "common_confusions": ["혼동하기 쉬운 부품들"]
  },
  "confidence": 0.95
}',
    NULL,
    '{"model": "gpt-4o", "temperature": 0.3, "maxTokens": 1000, "timeout": 15000, "enableFallback": false, "jsonMode": false}',
    '{"requireRecognitionHints": true, "minRecognitionHintsLength": 20, "structuredRecognitionHints": true}',
    TRUE
);

-- ============================================================================
-- 프리셋 3: 고품질 (GPT-4o)
-- ============================================================================
INSERT INTO metadata_prompt_presets (
    name, 
    description, 
    tags, 
    system_prompt, 
    main_prompt, 
    requirements, 
    llm_config, 
    validation_rules, 
    is_public
) VALUES (
    '고품질 (GPT-4o)',
    'GPT-4o 모델을 사용하여 최고 품질의 메타데이터를 생성 (비용 높음)',
    ARRAY['premium', 'gpt-4o', 'high-quality'],
    '당신은 레고 부품 전문가입니다. 이미지를 분석하여 매우 상세하고 정확한 JSON 형식으로 응답하세요.',
    '부품 정보:
- 부품명: ${partName}
- 부품 번호: ${partNum}
- 색상: ${colorName}

다음 JSON 형식으로 매우 상세하고 정확하게 응답해주세요:

{
  "part_id": "${partNum}",
  "shape_tag": "plate, brick, tile, slope, panel, wedge, cylinder, cone, arch, round, dish, minifig_part, unknown 중 하나 (순수 형태만)",
  "series": "system, duplo, technic, bionicle, unknown 중 하나 (부품명에서 추출)",
  "stud_count_top": 상단 스터드 개수 (숫자), 
  "tube_count_bottom": 하단 튜브 개수 (숫자),
  "center_stud": 중앙 스터드 여부 (true/false),
  "groove": 홈 존재 여부 (true/false),
  "confusions": ["유사한_부품1", "유사한_부품2", "유사한_부품3"],
  "distinguishing_features": ["구별되는 특징1", "구별되는 특징2", "구별되는 특징3"],
  "recognition_hints": {
    "ko": "한국어 상세 설명 (최소 50자, 매우 자연스러운 문장)",
    "en": "English detailed description (min 50 chars)",
    "top_view": "위에서 본 모습에 대한 상세 설명",
    "side_view": "옆에서 본 모습에 대한 상세 설명",
    "bottom_view": "아래에서 본 모습에 대한 상세 설명",
    "unique_features": ["고유 특징1", "고유 특징2", "고유 특징3"]
  },
  "feature_text": "부품의 핵심 특징을 요약한 자연스러운 한국어 문장 (최소 30자)",
  "semantic_vector_description": "부품의 시각적/의미적 특징을 설명하는 텍스트 (임베딩용)"
}',
    '필수 요구사항:
- shape_tag: 정확한 부품 유형 분류
- recognition_hints.ko: 반드시 50자 이상의 자연스러운 한국어 설명
- feature_text: 반드시 30자 이상의 자연스러운 한국어 요약
- confusions: 최소 3개 이상의 유사 부품 ID
- 모든 배열은 반드시 ]로 닫기
- JSON 외 다른 텍스트 절대 금지',
    '{"model": "gpt-4o", "temperature": 0.2, "maxTokens": 2000, "timeout": 20000, "enableFallback": false, "jsonMode": true}',
    '{"requireRecognitionHints": true, "minRecognitionHintsLength": 50, "requireConfusions": true, "minConfusions": 3, "requireDistinguishingFeatures": true, "minDistinguishingFeatures": 3, "autoDetectPrinted": true, "structuredRecognitionHints": true, "removePartNumFromFeatureText": true}',
    TRUE
);

-- ============================================================================
-- 프리셋 4: 빠른 처리 (GPT-4o-mini, 최소 비용)
-- ============================================================================
INSERT INTO metadata_prompt_presets (
    name, 
    description, 
    tags, 
    system_prompt, 
    main_prompt, 
    requirements, 
    llm_config, 
    validation_rules, 
    is_public
) VALUES (
    '빠른 처리 (최소 비용)',
    'GPT-4o-mini 모델을 사용하여 빠른 속도로 메타데이터를 생성 (비용 최소)',
    ARRAY['fast', 'gpt-4o-mini', 'low-cost', 'minimal'],
    '당신은 레고 부품 전문가입니다. 이미지를 분석하여 간결한 JSON 형식으로 응답하세요.',
    '부품 정보:
- 부품명: ${partName}
- 부품 번호: ${partNum}
- 색상: ${colorName}

다음 JSON 형식으로 간결하게 응답해주세요:

{
  "part_id": "${partNum}",
  "shape_tag": "plate, brick, tile, slope, panel, wedge, cylinder, cone, arch, round, dish, minifig_part, unknown 중 하나 (순수 형태만)",
  "series": "system, duplo, technic, bionicle, unknown 중 하나 (부품명에서 추출)",
  "stud_count_top": 상단 스터드 개수 (숫자),
  "tube_count_bottom": 하단 튜브 개수 (숫자),
  "center_stud": 중앙 스터드 여부 (true/false),
  "groove": 홈 존재 여부 (true/false),
  "confusions": ["유사한_부품1"],
  "distinguishing_features": ["구별되는 특징1"],
  "recognition_hints": {
    "ko": "한국어 간결 설명 (최소 10자)",
    "top_view": "",
    "side_view": "",
    "unique_features": []
  }
}',
    '필수 요구사항:
- shape_tag: 정확한 부품 유형 분류
- recognition_hints.ko: 반드시 10자 이상의 간결한 한국어 설명
- confusions: 최소 1개 이상의 유사 부품 ID
- 모든 배열은 반드시 ]로 닫기
- JSON 외 다른 텍스트 절대 금지',
    '{"model": "gpt-4o-mini", "temperature": 0.0, "maxTokens": 300, "timeout": 5000, "enableFallback": true, "jsonMode": true}',
    '{"requireRecognitionHints": true, "minRecognitionHintsLength": 10, "requireConfusions": true, "minConfusions": 1, "requireDistinguishingFeatures": true, "minDistinguishingFeatures": 1, "autoDetectPrinted": true, "structuredRecognitionHints": true, "removePartNumFromFeatureText": true}',
    TRUE
);

-- ============================================================================
-- 4. 권한 설정 (필요시 추가)
-- ============================================================================
-- RLS (Row Level Security) 활성화
ALTER TABLE metadata_prompt_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_prompt_presets ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 설정
CREATE POLICY "모든 사용자가 설정을 읽을 수 있음" 
ON metadata_prompt_configs FOR SELECT 
USING (true);

-- 인증된 사용자만 업데이트 가능
CREATE POLICY "인증된 사용자만 설정을 업데이트할 수 있음" 
ON metadata_prompt_configs FOR UPDATE 
USING (auth.role() = 'authenticated');

-- 모든 사용자가 공개 프리셋을 읽을 수 있음
CREATE POLICY "모든 사용자가 공개 프리셋을 읽을 수 있음" 
ON metadata_prompt_presets FOR SELECT 
USING (is_public = TRUE);

-- 인증된 사용자만 프리셋 생성 가능
CREATE POLICY "인증된 사용자만 프리셋을 생성할 수 있음" 
ON metadata_prompt_presets FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 완료!
-- ============================================================================
-- 실행 방법:
-- 1. Supabase Dashboard > SQL Editor
-- 2. 이 스크립트 전체 복사 & 붙여넣기
-- 3. Run 클릭
-- ============================================================================
