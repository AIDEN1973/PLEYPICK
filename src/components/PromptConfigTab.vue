<template>
  <div class="prompt-config-tab">
    <!-- 서브 탭 네비게이션 -->
    <div class="sub-tabs">
      <button 
        :class="['sub-tab', { active: activeSubTab === 'prompt' }]"
        @click="activeSubTab = 'prompt'"
      >
        📝 프롬프트 편집
      </button>
      <button 
        :class="['sub-tab', { active: activeSubTab === 'llm-config' }]"
        @click="activeSubTab = 'llm-config'"
      >
        ⚙️ LLM 설정
      </button>
      <button 
        :class="['sub-tab', { active: activeSubTab === 'validation' }]"
        @click="activeSubTab = 'validation'"
      >
        ✅ 검증 규칙
      </button>
      <button 
        :class="['sub-tab', { active: activeSubTab === 'test' }]"
        @click="activeSubTab = 'test'"
      >
        🧪 테스트
      </button>
      <button 
        :class="['sub-tab', { active: activeSubTab === 'presets' }]"
        @click="activeSubTab = 'presets'"
      >
        📦 프리셋
      </button>
    </div>

    <!-- 프롬프트 편집 탭 -->
    <div v-if="activeSubTab === 'prompt'" class="sub-tab-content">
      <div class="section">
        <h2>프롬프트 템플릿</h2>
        <p class="description">
          LLM에게 전달되는 프롬프트를 수정하세요. 변수: <code>${partName}</code>, <code>${partNum}</code>, <code>${colorName}</code>
        </p>
        
        <div class="prompt-editor">
          <label>시스템 프롬프트 (역할 정의)</label>
          <textarea 
            v-model="config.systemPrompt"
            rows="3"
            placeholder="당신은 레고 부품 전문가입니다..."
          ></textarea>

          <label>메인 프롬프트</label>
          <textarea 
            v-model="config.mainPrompt"
            rows="15"
            placeholder="이미지를 분석하여 JSON 형식으로 응답하세요..."
          ></textarea>

          <label>필수 요구사항</label>
          <textarea 
            v-model="config.requirements"
            rows="5"
            placeholder="- shape_tag: 정확한 부품 유형 분류..."
          ></textarea>
        </div>

        <div class="preview">
          <h3>프롬프트 미리보기</h3>
          <pre>{{ generateFullPrompt() }}</pre>
        </div>
      </div>
    </div>

    <!-- LLM 설정 탭 -->
    <div v-if="activeSubTab === 'llm-config'" class="sub-tab-content">
      <div class="section">
        <h2>LLM 모델 설정</h2>
        
        <div class="config-grid">
          <div class="config-item">
            <label>모델</label>
            <select v-model="config.llm.model">
              <option value="gpt-4o-mini">gpt-4o-mini (빠름, 저렴)</option>
              <option value="gpt-4o">gpt-4o (고품질)</option>
              <option value="gpt-4-turbo">gpt-4-turbo (균형)</option>
            </select>
            <small>gpt-4o-mini 권장 (성능/비용 최적)</small>
          </div>

          <div class="config-item">
            <label>Temperature ({{ config.llm.temperature }})</label>
            <input 
              type="range" 
              v-model.number="config.llm.temperature"
              min="0" 
              max="1" 
              step="0.1"
            />
            <small>0 = 결정론적, 1 = 창의적</small>
          </div>

          <div class="config-item">
            <label>Max Tokens</label>
            <input 
              type="number" 
              v-model.number="config.llm.maxTokens"
              min="100"
              max="2000"
              step="50"
            />
            <small>현재: {{ config.llm.maxTokens }} (권장: 300-500)</small>
          </div>

          <div class="config-item">
            <label>Timeout (초)</label>
            <input 
              type="number" 
              v-model.number="config.llm.timeout"
              min="3"
              max="30"
              step="1"
            />
            <small>API 응답 대기 시간 (권장: 8초)</small>
          </div>

          <div class="config-item">
            <label>
              <input type="checkbox" v-model="config.llm.enableFallback" />
              Fallback 활성화 (gpt-4o)
            </label>
            <small>실패 시 더 강력한 모델로 재시도</small>
          </div>

          <div class="config-item">
            <label>
              <input type="checkbox" v-model="config.llm.jsonMode" />
              JSON Mode 강제
            </label>
            <small>JSON 형식 응답 보장</small>
          </div>
        </div>

        <div class="cost-estimate">
          <h3>💰 예상 비용</h3>
          <p>모델: <strong>{{ config.llm.model }}</strong></p>
          <p>부품당 비용: <strong>${{ estimateCost() }}</strong></p>
          <p>1000개 부품: <strong>${{ (estimateCost() * 1000).toFixed(2) }}</strong></p>
        </div>
      </div>
    </div>

    <!-- 검증 규칙 탭 -->
    <div v-if="activeSubTab === 'validation'" class="sub-tab-content">
      <div class="section">
        <h2>필드 검증 규칙</h2>
        
        <div class="validation-rules">
          <div class="rule-item">
            <label>
              <input type="checkbox" v-model="config.validation.requireRecognitionHints" />
              recognition_hints.ko 필수 (최소 {{ config.validation.minRecognitionHintsLength }}자)
            </label>
            <input 
              type="number" 
              v-model.number="config.validation.minRecognitionHintsLength"
              min="10"
              max="100"
              :disabled="!config.validation.requireRecognitionHints"
            />
          </div>

          <div class="rule-item">
            <label>
              <input type="checkbox" v-model="config.validation.requireConfusions" />
              confusions 배열 필수 (최소 {{ config.validation.minConfusions }}개)
            </label>
            <input 
              type="number" 
              v-model.number="config.validation.minConfusions"
              min="0"
              max="5"
              :disabled="!config.validation.requireConfusions"
            />
          </div>

          <div class="rule-item">
            <label>
              <input type="checkbox" v-model="config.validation.requireDistinguishingFeatures" />
              distinguishing_features 필수 (최소 {{ config.validation.minDistinguishingFeatures }}개)
            </label>
            <input 
              type="number" 
              v-model.number="config.validation.minDistinguishingFeatures"
              min="1"
              max="5"
              :disabled="!config.validation.requireDistinguishingFeatures"
            />
          </div>

          <div class="rule-item">
            <label>
              <input type="checkbox" v-model="config.validation.autoDetectPrinted" />
              프린트 부품 자동 감지 (pr 패턴)
            </label>
            <small>부품번호에 'pr'이 포함되면 is_printed = true</small>
          </div>

          <div class="rule-item">
            <label>
              <input type="checkbox" v-model="config.validation.structuredRecognitionHints" />
              recognition_hints 구조화 강제 (객체)
            </label>
            <small>문자열이 아닌 객체 형식으로 저장</small>
          </div>

          <div class="rule-item">
            <label>
              <input type="checkbox" v-model="config.validation.removePartNumFromFeatureText" />
              feature_text에서 부품번호 제거
            </label>
            <small>자연스러운 텍스트 생성</small>
          </div>
        </div>
      </div>
    </div>

    <!-- 테스트 탭 -->
    <div v-if="activeSubTab === 'test'" class="sub-tab-content">
      <div class="section">
        <h2>프롬프트 테스트</h2>
        <p class="description">샘플 부품으로 현재 설정을 테스트하세요.</p>

        <div class="test-input">
          <h3>테스트 부품 정보</h3>
          <div class="input-grid">
            <div class="input-item">
              <label>부품번호</label>
              <input v-model="testPart.partNum" placeholder="3020" />
            </div>
            <div class="input-item">
              <label>부품명</label>
              <input v-model="testPart.partName" placeholder="Plate 2 x 4" />
            </div>
            <div class="input-item">
              <label>색상</label>
              <input v-model="testPart.colorName" placeholder="Black" />
            </div>
          </div>

          <button 
            @click="runTest" 
            :disabled="testing"
            class="btn btn-primary"
          >
            {{ testing ? '테스트 중...' : '🧪 프롬프트 테스트 실행' }}
          </button>
        </div>

        <div v-if="testResult" class="test-result">
          <h3>테스트 결과</h3>
          <div class="result-stats">
            <div class="stat">
              <span class="label">소요 시간:</span>
              <span class="value">{{ testResult.duration }}ms</span>
            </div>
            <div class="stat">
              <span class="label">토큰 사용:</span>
              <span class="value">{{ testResult.tokensUsed || 'N/A' }}</span>
            </div>
            <div class="stat">
              <span class="label">비용:</span>
              <span class="value">${{ testResult.cost || 'N/A' }}</span>
            </div>
          </div>

          <h4>생성된 프롬프트:</h4>
          <pre class="prompt-preview">{{ testResult.prompt }}</pre>

          <h4>LLM 응답 (시뮬레이션):</h4>
          <pre class="response-preview">{{ testResult.response }}</pre>

          <div v-if="testResult.validationErrors.length > 0" class="validation-errors">
            <h4>⚠️ 검증 오류:</h4>
            <ul>
              <li v-for="(error, idx) in testResult.validationErrors" :key="idx">
                {{ error }}
              </li>
            </ul>
          </div>
          <div v-else class="validation-success">
            <h4>✅ 검증 통과</h4>
          </div>
        </div>
      </div>
    </div>

    <!-- 프리셋 탭 -->
    <div v-if="activeSubTab === 'presets'" class="sub-tab-content">
      <div class="section">
        <h2>프리셋 관리</h2>
        <p class="description">DB에 저장된 공개 프리셋 목록입니다.</p>

        <div class="preset-list">
          <div v-for="preset in presets" :key="preset.name" class="preset-card">
            <div class="preset-header">
              <h3>{{ preset.name }}</h3>
              <div class="preset-tags">
                <span v-for="tag in preset.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>
            <p class="preset-desc">{{ preset.description }}</p>
            <div class="preset-info">
              <span>모델: {{ preset.config.llm.model }}</span>
              <span>토큰: {{ preset.config.llm.maxTokens }}</span>
              <span>Temperature: {{ preset.config.llm.temperature }}</span>
            </div>
            <button @click="loadPreset(preset)" class="btn btn-sm">
              불러오기
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 하단 액션 버튼 -->
    <div class="actions">
      <button @click="resetToDefault" class="btn btn-secondary">
        🔄 기본값으로 초기화
      </button>
      <button @click="saveConfig" class="btn btn-primary" :disabled="saving">
        {{ saving ? '저장 중...' : '💾 DB에 저장' }}
      </button>
    </div>

    <!-- 성공/에러 메시지 -->
    <div v-if="successMessage" class="message success">
      ✅ {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="message error">
      ❌ {{ errorMessage }}
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { supabase } from '../composables/useSupabase'

export default {
  name: 'PromptConfigTab',
  setup() {
    const activeSubTab = ref('prompt')
    const saving = ref(false)
    const testing = ref(false)
    const successMessage = ref('')
    const errorMessage = ref('')
    const presets = ref([])
    
    // 기본 설정 (v2.1)
    const defaultConfig = {
      systemPrompt: '당신은 레고 부품 전문가입니다. 이미지를 분석하여 JSON 형식으로 응답하세요.',
      mainPrompt: `레고 부품 정보:
- 부품명: \${partName}
- 부품 번호: \${partNum}
- 색상: \${colorName}

다음 JSON 형식으로 정확히 응답해주세요:

{
  "part_id": "\${partNum}",
  "shape_tag": "아래 30개 옵션 중 하나 선택 (코드명으로)",
  "series": "system 또는 duplo, technic, bionicle, friends, city, star_wars, creator, ninjago 중 하나 (해당 없으면 system)",
  "stud_count_top": 상단 스터드 개수 (숫자),
  "tube_count_bottom": 하단 튜브 개수 (숫자),
  "center_stud": 중앙 스터드 여부 (true/false),
  "groove": 홈 존재 여부 (true/false),
  "confusions": ["유사한_부품_번호1", "유사한_부품_번호2"],
  "distinguishing_features": ["이 부품만의 특징1", "이 부품만의 특징2"],
  "recognition_hints": {
    "ko": "한국어 상세 설명 (최소 20자, 자연스러운 문장으로 작성)",
    "top_view": "위에서 본 모습 상세 설명",
    "side_view": "옆에서 본 모습 상세 설명",
    "unique_features": ["고유 특징1", "고유 특징2", "고유 특징3"]
  }
}

shape_tag 선택 가능 옵션 (30개):
기본 형태 (1-19):
plate, brick, tile, slope, panel, wedge, cylinder, cone, arch, round, dish, hinge, clip, bar, fence, door, window, roof, inverted

특수 부품 (20-29):
minifig_part, animal_figure, plant_leaf, wheel, tire, wing, propeller, gear, chain, axle

분류 불가:
unknown`,
      requirements: `필수 요구사항:
- shape_tag: 위 30개 옵션 중 정확히 하나 선택 (코드명으로, 예: "plate", "brick", "gear")
- series: 시리즈 분류 (기본값: "system")
- recognition_hints.ko: 반드시 20자 이상의 자연스러운 한국어 설명
- confusions: 최소 1개 이상의 유사 부품 번호 (숫자만, 예: ["3001", "3004"])
- distinguishing_features: 최소 2개 이상의 구별되는 특징
- recognition_hints.unique_features: 최소 2개 이상
- 모든 배열은 반드시 ]로 닫기
- JSON 외 다른 텍스트 절대 금지 (\`\`\`json도 사용 금지)
- 숫자 필드는 따옴표 없이 순수 숫자로 작성`,
      llm: {
        model: 'gpt-4o-mini',
        temperature: 0.0,
        maxTokens: 300,
        timeout: 8,
        enableFallback: true,
        jsonMode: true
      },
      validation: {
        requireRecognitionHints: true,
        minRecognitionHintsLength: 20,
        requireConfusions: true,
        minConfusions: 1,
        requireDistinguishingFeatures: true,
        minDistinguishingFeatures: 2,
        autoDetectPrinted: true,
        structuredRecognitionHints: true,
        removePartNumFromFeatureText: true,
        requiredFields: [
          'part_id', 'shape_tag', 'stud_count_top', 'tube_count_bottom',
          'center_stud', 'groove', 'confusions', 'distinguishing_features',
          'recognition_hints'
        ]
      }
    }

    const config = reactive({ ...JSON.parse(JSON.stringify(defaultConfig)) })
    
    const testPart = reactive({
      partNum: '3020',
      partName: 'Plate 2 x 4',
      colorName: 'Black'
    })

    const testResult = ref(null)

    // 프롬프트 미리보기 생성
    const generateFullPrompt = () => {
      return `${config.systemPrompt}

${config.mainPrompt}

${config.requirements}`
    }

    // 비용 추정
    const estimateCost = () => {
      const costs = {
        'gpt-4o-mini': 0.00015,
        'gpt-4o': 0.0025,
        'gpt-4-turbo': 0.001
      }
      return (costs[config.llm.model] || 0.0001).toFixed(5)
    }

    // 테스트 실행
    const runTest = async () => {
      testing.value = true
      testResult.value = null
      errorMessage.value = ''
      
      try {
        const startTime = Date.now()
        
        const prompt = config.mainPrompt
          .replace(/\$\{partName\}/g, testPart.partName)
          .replace(/\$\{partNum\}/g, testPart.partNum)
          .replace(/\$\{colorName\}/g, testPart.colorName)
        
        const simulatedResponse = {
          part_id: testPart.partNum,
          shape_tag: 'plate',
          series: 'system',
          stud_count_top: 8,
          tube_count_bottom: 4,
          center_stud: false,
          groove: false,
          confusions: ['3022', '3031'],
          distinguishing_features: ['2x4 footprint', 'no groove'],
          recognition_hints: {
            ko: '2x4 크기의 평평한 플레이트, 상단 8개 스터드, 하단 4개 튜브',
            lang: 'ko',
            top_view: '2x4 배열의 8개 스터드',
            side_view: '얇고 평평한 직사각형',
            unique_features: ['평평한 표면', '홈 없음']
          }
        }
        
        const validationErrors = []
        
        if (config.validation.requireRecognitionHints) {
          const hintsKo = simulatedResponse.recognition_hints?.ko || ''
          if (hintsKo.length < config.validation.minRecognitionHintsLength) {
            validationErrors.push(`recognition_hints.ko가 너무 짧습니다 (${hintsKo.length}자 < ${config.validation.minRecognitionHintsLength}자)`)
          }
        }
        
        const duration = Date.now() - startTime
        
        testResult.value = {
          prompt: `${config.systemPrompt}\n\n${prompt}\n\n${config.requirements}`,
          response: JSON.stringify(simulatedResponse, null, 2),
          duration,
          tokensUsed: Math.ceil(prompt.length / 4),
          cost: (Math.ceil(prompt.length / 4) * parseFloat(estimateCost()) / 1000).toFixed(6),
          validationErrors
        }
        
        successMessage.value = '테스트 완료!'
        setTimeout(() => { successMessage.value = '' }, 3000)
        
      } catch (error) {
        errorMessage.value = `테스트 실패: ${error.message}`
      } finally {
        testing.value = false
      }
    }

    // 설정 저장
    const saveConfig = async () => {
      saving.value = true
      errorMessage.value = ''
      
      try {
        const { error } = await supabase
          .from('metadata_prompt_configs')
          .update({
            system_prompt: config.systemPrompt,
            main_prompt: config.mainPrompt,
            requirements: config.requirements,
            llm_model: config.llm.model,
            llm_temperature: config.llm.temperature,
            llm_max_tokens: config.llm.maxTokens,
            llm_timeout: config.llm.timeout,
            llm_enable_fallback: config.llm.enableFallback,
            llm_json_mode: config.llm.jsonMode,
            validation_rules: config.validation
          })
          .eq('id', 'active')
        
        if (error) throw error
        
        localStorage.setItem('metadata_prompt_config_cache', JSON.stringify(config))
        
        successMessage.value = 'DB에 저장되었습니다! 다음 메타데이터 생성부터 반영됩니다.'
        setTimeout(() => { successMessage.value = '' }, 5000)
        
      } catch (error) {
        errorMessage.value = `저장 실패: ${error.message}`
      } finally {
        saving.value = false
      }
    }

    // 초기화
    const resetToDefault = () => {
      if (confirm('기본값으로 초기화하시겠습니까?')) {
        Object.assign(config, JSON.parse(JSON.stringify(defaultConfig)))
        successMessage.value = '기본값으로 초기화되었습니다.'
        setTimeout(() => { successMessage.value = '' }, 3000)
      }
    }

    // 프리셋 로드
    const loadPreset = (preset) => {
      Object.assign(config, preset.config)
      successMessage.value = `${preset.name} 프리셋을 불러왔습니다.`
      setTimeout(() => { successMessage.value = '' }, 3000)
    }

    // DB에서 설정 로드
    const loadConfigFromDB = async () => {
      try {
        const { data, error } = await supabase
          .from('metadata_prompt_configs')
          .select('*')
          .eq('id', 'active')
          .single()
        
        if (error) throw error
        
        if (data) {
          config.systemPrompt = data.system_prompt
          config.mainPrompt = data.main_prompt
          config.requirements = data.requirements
          config.llm.model = data.llm_model
          config.llm.temperature = parseFloat(data.llm_temperature)
          config.llm.maxTokens = data.llm_max_tokens
          config.llm.timeout = data.llm_timeout
          config.llm.enableFallback = data.llm_enable_fallback
          config.llm.jsonMode = data.llm_json_mode
          config.validation = data.validation_rules
        }
      } catch (error) {
        console.error('설정 로드 실패:', error)
      }
    }

    // 프리셋 로드
    const loadPresetsFromDB = async () => {
      try {
        const { data, error } = await supabase
          .from('metadata_prompt_presets')
          .select('*')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
        
        if (error) throw error
        
        presets.value = (data || []).map(preset => ({
          name: preset.name,
          description: preset.description,
          tags: preset.tags || [],
          config: {
            systemPrompt: preset.system_prompt,
            mainPrompt: preset.main_prompt,
            requirements: preset.requirements,
            llm: preset.llm_config,
            validation: preset.validation_rules
          }
        }))
      } catch (error) {
        console.error('프리셋 로드 실패:', error)
      }
    }

    // ✅ 최적화: 초기화 시 데이터 로딩 병렬화
    onMounted(async () => {
      await Promise.all([
        loadConfigFromDB(),
        loadPresetsFromDB()
      ])
    })

    return {
      activeSubTab,
      config,
      saving,
      testing,
      successMessage,
      errorMessage,
      presets,
      testPart,
      testResult,
      generateFullPrompt,
      estimateCost,
      runTest,
      saveConfig,
      resetToDefault,
      loadPreset
    }
  }
}
</script>

<style scoped>
/* 기존 MetadataPromptEditor.vue의 스타일을 재사용하되 간소화 */
.prompt-config-tab {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.sub-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
  flex-wrap: wrap;
}

.sub-tab {
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 0.9em;
  color: #7f8c8d;
  transition: all 0.2s;
}

.sub-tab:hover {
  color: #3498db;
}

.sub-tab.active {
  color: #3498db;
  border-bottom-color: #3498db;
}

.sub-tab-content {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.section {
  margin-bottom: 20px;
}

.section h2 {
  font-size: 1.4em;
  margin-bottom: 10px;
  color: #2c3e50;
}

.description {
  color: #7f8c8d;
  margin-bottom: 15px;
}

.description code {
  background: #ecf0f1;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  color: #e74c3c;
}

.prompt-editor label {
  display: block;
  font-weight: 600;
  margin-top: 15px;
  margin-bottom: 5px;
  color: #2c3e50;
}

.prompt-editor textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.4;
  resize: vertical;
}

.preview {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.preview pre {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  white-space: pre-wrap;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.config-item label {
  display: block;
  font-weight: 600;
  margin-bottom: 5px;
  color: #2c3e50;
}

.config-item select,
.config-item input[type="number"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.config-item input[type="range"] {
  width: 100%;
}

.config-item small {
  display: block;
  margin-top: 4px;
  color: #95a5a6;
  font-size: 0.85em;
}

.cost-estimate {
  margin-top: 20px;
  padding: 15px;
  background: #e8f5e9;
  border-left: 4px solid #4caf50;
  border-radius: 4px;
}

.cost-estimate h3 {
  margin-bottom: 10px;
  color: #2e7d32;
}

.validation-rules {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 15px;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.rule-item label {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.rule-item input[type="number"] {
  width: 70px;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.test-input {
  margin-bottom: 20px;
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 15px;
}

.input-item label {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
}

.input-item input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.test-result {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.result-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  padding: 12px;
  background: white;
  border-radius: 4px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat .label {
  font-size: 0.85em;
  color: #7f8c8d;
}

.stat .value {
  font-size: 1.2em;
  font-weight: 700;
  color: #2c3e50;
}

.prompt-preview,
.response-preview {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  max-height: 300px;
  margin-top: 8px;
}

.validation-errors {
  margin-top: 15px;
  padding: 12px;
  background: #fee;
  border-left: 4px solid #e74c3c;
  border-radius: 4px;
}

.validation-success {
  margin-top: 15px;
  padding: 12px;
  background: #d5f4e6;
  border-left: 4px solid #2ecc71;
  border-radius: 4px;
}

.preset-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.preset-card {
  padding: 15px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  transition: all 0.2s;
}

.preset-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.preset-header h3 {
  font-size: 1.1em;
  color: #2c3e50;
  margin: 0;
}

.preset-tags {
  display: flex;
  gap: 4px;
}

.tag {
  padding: 2px 8px;
  background: #3498db;
  color: white;
  border-radius: 12px;
  font-size: 0.75em;
}

.preset-desc {
  color: #7f8c8d;
  font-size: 0.9em;
  margin-bottom: 10px;
}

.preset-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85em;
  color: #95a5a6;
  margin-bottom: 10px;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 0.95em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85em;
}

.message {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: slideIn 0.3s;
  z-index: 1000;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.message.success {
  background: #d5f4e6;
  color: #27ae60;
  border-left: 4px solid #2ecc71;
}

.message.error {
  background: #fee;
  color: #c0392b;
  border-left: 4px solid #e74c3c;
}
</style>

