<template>
  <div class="pleyon-layout">
    <div class="layout-container">
      <main class="main-panel">
        <header class="panel-header">
          <div class="header-left">
            <h1>유사부품 찾기</h1>
          </div>
        </header>

        <div class="panel-content">
          <div class="search-section">
            <div class="search-card">
              <div class="card-header">
                <h3>엘리먼트 ID 검색</h3>
                <p>엘리먼트 ID를 입력하여 동일한 모양의 다른 색상 부품을 찾을 수 있습니다</p>
              </div>
              <div class="card-body">
                <div class="form-group">
                  <label for="element-id-input">엘리먼트 ID</label>
                  <div class="search-input-group">
                    <input
                      id="element-id-input"
                      v-model="elementIdInput"
                      type="text"
                      class="search-input"
                      placeholder="예: 306923"
                      @keyup.enter="searchAlternativeParts"
                      :disabled="loading"
                    />
                    <button
                      @click="searchAlternativeParts"
                      class="search-button"
                      :disabled="!elementIdInput || loading"
                    >
                      {{ loading ? '검색 중...' : '검색' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div v-if="searchResult" class="result-section">
            <div class="result-header">
              <h3>검색 결과</h3>
              <div class="result-info">
                <span class="part-name">{{ searchResult.part_name }}</span>
                <span class="part-color">현재 색상: {{ searchResult.current_color_name }}</span>
              </div>
            </div>

            <div v-if="searchResult.alternatives && searchResult.alternatives.length > 0" class="alternatives-section">
              <div v-for="(alternative, index) in searchResult.alternatives" :key="index" class="alternative-group">
                <h4 class="alternative-title">대체 색상</h4>
                <div class="colors-grid">
                  <div
                    v-for="color in alternative.colors"
                    :key="color.color_id"
                    class="color-card"
                    :style="{ backgroundColor: getColorRgb(color.rgb) || '#f3f4f6' }"
                  >
                    <div class="color-info">
                      <span class="color-name">{{ color.name }}</span>
                      <span class="color-id">Color ID: {{ color.color_id }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-result">
              <p>동일한 모양의 다른 색상 부품을 찾을 수 없습니다.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { usePartSearch } from '../composables/usePartSearch'

export default {
  name: 'AlternativePartsSearch',
  setup() {
    const { supabase } = useSupabase()
    const { findAlternativeParts, loading } = usePartSearch()

    const elementIdInput = ref('')
    const searchResult = ref(null)
    const error = ref(null)

    const searchAlternativeParts = async () => {
      if (!elementIdInput.value.trim()) {
        error.value = '엘리먼트 ID를 입력해주세요.'
        return
      }

      try {
        error.value = null
        searchResult.value = null

        // element_id로 set_parts에서 part_id와 color_id 조회
        const { data: setPart, error: setPartError } = await supabase
          .from('set_parts')
          .select('part_id, color_id')
          .eq('element_id', String(elementIdInput.value.trim()))
          .limit(1)
          .maybeSingle()

        if (setPartError) {
          throw new Error(`데이터베이스 조회 실패: ${setPartError.message}`)
        }

        if (!setPart) {
          error.value = `엘리먼트 ID "${elementIdInput.value.trim()}"를 찾을 수 없습니다.`
          return
        }

        // 부품 정보 가져오기
        const { data: partInfo, error: partError } = await supabase
          .from('lego_parts')
          .select('part_num, name')
          .eq('part_num', setPart.part_id)
          .maybeSingle()

        if (partError) {
          throw new Error(`부품 정보 조회 실패: ${partError.message}`)
        }

        // 현재 색상 정보 가져오기
        const { data: currentColorInfo, error: currentColorError } = await supabase
          .from('lego_colors')
          .select('color_id, name')
          .eq('color_id', setPart.color_id)
          .maybeSingle()

        if (currentColorError) {
          throw new Error(`색상 정보 조회 실패: ${currentColorError.message}`)
        }

        // 대체 부품 찾기
        const alternatives = await findAlternativeParts(setPart.part_id, setPart.color_id)

        searchResult.value = {
          element_id: elementIdInput.value.trim(),
          part_id: setPart.part_id,
          color_id: setPart.color_id,
          part_name: partInfo?.name || setPart.part_id,
          current_color_name: currentColorInfo?.name || `Color ${setPart.color_id}`,
          alternatives: alternatives
        }
      } catch (err) {
        error.value = err.message || '검색 중 오류가 발생했습니다.'
        console.error('검색 실패:', err)
      }
    }

    const getColorRgb = (rgb) => {
      if (!rgb) return null
      let rgbStr = String(rgb).trim()
      if (rgbStr && !rgbStr.startsWith('#')) {
        rgbStr = `#${rgbStr}`
      }
      return rgbStr || null
    }

    return {
      elementIdInput,
      searchResult,
      error,
      loading,
      searchAlternativeParts,
      getColorRgb
    }
  }
}
</script>

<style scoped>
.pleyon-layout {
  min-height: 100vh;
  background: transparent;
}

.layout-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.main-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.panel-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h1 {
  font-size: 1.75rem;
  font-weight: bold;
  color: #1f2937;
}

.panel-content {
  padding: 2rem;
}

.search-section {
  margin-bottom: 2rem;
}

.search-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  padding: 1.5rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.card-header h3 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.card-header p {
  font-size: 0.875rem;
  color: #6b7280;
}

.card-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.search-input-group {
  display: flex;
  gap: 0.75rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.search-button {
  padding: 0.75rem 2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-button:hover:not(:disabled) {
  background: #2563eb;
}

.search-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.error-message {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  margin-bottom: 2rem;
}

.result-section {
  margin-top: 2rem;
}

.result-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.result-header h3 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 0.75rem;
}

.result-info {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.part-name {
  font-size: 1rem;
  font-weight: 500;
  color: #1f2937;
}

.part-color {
  padding: 0.25rem 0.75rem;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #6b7280;
}

.alternatives-section {
  margin-top: 1.5rem;
}

.alternative-group {
  margin-bottom: 2rem;
}

.alternative-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.colors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.color-card {
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.color-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.color-info {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.color-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.color-id {
  font-size: 0.875rem;
  color: #6b7280;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.empty-result {
  padding: 3rem;
  text-align: center;
  color: #6b7280;
}

@media (max-width: 768px) {
  .layout-container {
    padding: 1rem;
  }

  .panel-content {
    padding: 1rem;
  }

  .colors-grid {
    grid-template-columns: 1fr;
  }

  .search-input-group {
    flex-direction: column;
  }

  .search-button {
    width: 100%;
  }
}
</style>

