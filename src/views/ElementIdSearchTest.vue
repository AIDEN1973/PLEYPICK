<template>
  <div class="element-search-test">
    <div class="header">
      <h1>🔍 Element ID 검색 테스트</h1>
      <p>Element ID로 해당 부품이 포함된 레고 세트를 검색합니다.</p>
    </div>

    <!-- 통합 검색 -->
    <div class="search-section">
      <h3>통합 검색 (Element ID / 세트 번호 / 세트 이름)</h3>
      <div class="search-box">
        <input
          v-model="universalQuery"
          type="text"
          placeholder="Element ID, 세트 번호, 또는 세트 이름을 입력하세요..."
          @keyup.enter="doUniversalSearch"
          class="search-input"
        />
        <button @click="doUniversalSearch" :disabled="loading" class="btn-search">
          {{ loading ? '검색 중...' : '통합 검색' }}
        </button>
      </div>
      <div class="search-hints">
        <span class="hint">💡 예: 4500574 (Element ID), 60315 (세트 번호), City (세트 이름)</span>
      </div>
    </div>

    <!-- Element ID 전용 검색 -->
    <div class="search-section">
      <h3>Element ID 전용 검색</h3>
      <div class="search-box">
        <input
          v-model="elementIdQuery"
          type="text"
          placeholder="Element ID를 입력하세요 (예: 4500574)"
          @keyup.enter="doElementIdSearch"
          class="search-input"
        />
        <button @click="doElementIdSearch" :disabled="loading" class="btn-search">
          {{ loading ? '검색 중...' : 'Element ID 검색' }}
        </button>
      </div>
    </div>

    <!-- 부품 번호 + 색상으로 Element ID 찾기 -->
    <div class="search-section">
      <h3>부품 번호 + 색상으로 Element ID 찾기</h3>
      <div class="search-box multi-input">
        <input
          v-model="partIdQuery"
          type="text"
          placeholder="부품 번호 (예: 3001)"
          class="search-input"
        />
        <input
          v-model.number="colorIdQuery"
          type="number"
          placeholder="색상 ID (예: 1)"
          class="search-input"
        />
        <button @click="doPartColorSearch" :disabled="loading" class="btn-search">
          {{ loading ? '검색 중...' : 'Element ID 조회' }}
        </button>
      </div>
    </div>

    <!-- 에러 메시지 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 검색 타입 표시 -->
    <div v-if="searchType" class="search-type-badge">
      {{ searchType === 'element_id' ? '🎯 Element ID로 검색됨' : '📦 세트 번호/이름으로 검색됨' }}
    </div>

    <!-- 통합 검색 결과 -->
    <div v-if="universalResults.length > 0" class="results-section">
      <h3>검색 결과 ({{ universalResults.length }}개)</h3>
      <div class="results-grid">
        <div v-for="result in universalResults" :key="result.set_id" class="result-card">
          <div class="result-image">
            <img 
              :src="getSetImageUrl(result)" 
              :alt="result.set_name"
              @error="handleImageError"
            />
          </div>
          <div class="result-info">
            <h4>{{ result.set_name }}</h4>
            <p class="set-number">세트: {{ result.set_num }}</p>
            <p class="set-year">연도: {{ result.set_year }}</p>
            <p class="num-parts">부품 수: {{ result.num_parts }}개</p>
            <div v-if="result.matched_element_id" class="matched-info">
              <p class="matched-element">
                <strong>매칭된 Element ID:</strong> {{ result.matched_element_id }}
              </p>
              <p class="matched-part">
                <strong>부품:</strong> {{ result.matched_part_id }} - {{ result.matched_part_name }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Element ID 검색 결과 -->
    <div v-if="elementIdResults.length > 0" class="results-section">
      <h3>Element ID 검색 결과 ({{ elementIdResults.length }}개 세트)</h3>
      <div class="element-results-table">
        <table>
          <thead>
            <tr>
              <th>세트 번호</th>
              <th>세트 이름</th>
              <th>연도</th>
              <th>부품 ID</th>
              <th>부품 이름</th>
              <th>색상</th>
              <th>수량</th>
              <th>예비</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in elementIdResults" :key="`${result.set_id}-${result.element_id}`">
              <td>{{ result.set_num }}</td>
              <td>{{ result.set_name }}</td>
              <td>{{ result.set_year }}</td>
              <td>{{ result.part_id }}</td>
              <td>{{ result.part_name }}</td>
              <td>{{ result.color_name }} ({{ result.color_id }})</td>
              <td>{{ result.quantity }}</td>
              <td>{{ result.is_spare ? '✓' : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 부품별 Element ID 조회 결과 -->
    <div v-if="partElementIds.length > 0" class="results-section">
      <h3>부품 {{ partIdQuery }} (색상: {{ colorIdQuery }})의 Element ID 목록</h3>
      <div class="element-ids-list">
        <div v-for="item in partElementIds" :key="item.element_id" class="element-id-item">
          <div class="element-id-badge">{{ item.element_id }}</div>
          <div class="element-id-details">
            <p><strong>세트:</strong> {{ item.set_num }} - {{ item.set_name }}</p>
            <p><strong>수량:</strong> {{ item.quantity }}개</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 빈 결과 -->
    <div v-if="!loading && showNoResults" class="no-results">
      <div class="no-results-icon">🔍</div>
      <h3>검색 결과가 없습니다</h3>
      <p>다른 검색어로 다시 시도해보세요.</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useElementIdSearch } from '../composables/useElementIdSearch'

export default {
  name: 'ElementIdSearchTest',
  setup() {
    const route = useRoute()
    
    const {
      loading,
      error,
      searchResults,
      searchByElementId,
      getElementIdsByPartColor,
      universalSearch
    } = useElementIdSearch()

    const universalQuery = ref('')
    const elementIdQuery = ref('')
    const partIdQuery = ref('')
    const colorIdQuery = ref('')

    const searchType = ref(null)
    const universalResults = ref([])
    const elementIdResults = ref([])
    const partElementIds = ref([])
    
    // ✅ 쿼리 파라미터로 자동 검색
    onMounted(() => {
      const queryParam = route.query.q
      if (queryParam) {
        universalQuery.value = queryParam
        doUniversalSearch()
      }
    })

    const showNoResults = computed(() => {
      return universalResults.value.length === 0 && 
             elementIdResults.value.length === 0 && 
             partElementIds.value.length === 0
    })

    const doUniversalSearch = async () => {
      if (!universalQuery.value.trim()) return

      universalResults.value = []
      elementIdResults.value = []
      partElementIds.value = []
      searchType.value = null

      const result = await universalSearch(universalQuery.value)
      if (result.results && result.results.length > 0) {
        searchType.value = result.type
        universalResults.value = result.results
      }
    }

    const doElementIdSearch = async () => {
      if (!elementIdQuery.value.trim()) return

      universalResults.value = []
      elementIdResults.value = []
      partElementIds.value = []
      searchType.value = null

      const results = await searchByElementId(elementIdQuery.value)
      if (results && results.length > 0) {
        elementIdResults.value = results
      }
    }

    const doPartColorSearch = async () => {
      if (!partIdQuery.value.trim() || !colorIdQuery.value) return

      universalResults.value = []
      elementIdResults.value = []
      partElementIds.value = []
      searchType.value = null

      const results = await getElementIdsByPartColor(partIdQuery.value, colorIdQuery.value)
      if (results && results.length > 0) {
        partElementIds.value = results
      }
    }

    // 기본 세트 이미지 로드 함수
    const getDefaultSetImage = async () => {
      try {
        // Supabase에서 기본 세트 이미지 로드
        const { data, error } = await supabase
          .from('lego_sets')
          .select('set_img_url, webp_image_url')
          .eq('set_num', '76917') // 기본 세트 (스피드 챔피언)
          .single()
        
        if (error) throw error
        
        return data.webp_image_url || data.set_img_url || await getDefaultSetImage()
        
      } catch (error) {
        console.error('기본 세트 이미지 로드 실패:', error)
        return await getDefaultSetImage()
      }
    }

    // 실제 이미지 로드 함수
    const getRealSetImage = async (setNum) => {
      try {
        if (!setNum) return getDefaultSetImage()
        
        // Supabase에서 실제 세트 이미지 로드
        const { data, error } = await supabase
          .from('lego_sets')
          .select('set_img_url, webp_image_url')
          .eq('set_num', setNum)
          .single()
        
        if (error) throw error
        
        // WebP 우선, 일반 이미지 폴백
        return data.webp_image_url || data.set_img_url || await getDefaultSetImage()
        
      } catch (error) {
        console.error('실제 세트 이미지 로드 실패:', error)
        return await getDefaultSetImage()
      }
    }

    const getSetImageUrl = (result) => {
      return result.webp_image_url || result.set_img_url || '/placeholder-image.png'
    }

    const handleImageError = (event) => {
      getRealSetImage(result.set_num).then(imageUrl => {
        event.target.src = imageUrl
      })
    }

    return {
      loading,
      error,
      universalQuery,
      elementIdQuery,
      partIdQuery,
      colorIdQuery,
      searchType,
      universalResults,
      elementIdResults,
      partElementIds,
      showNoResults,
      doUniversalSearch,
      doElementIdSearch,
      doPartColorSearch,
      handleImageError
    }
  }
}
</script>

<style scoped>
.element-search-test {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.header p {
  color: #7f8c8d;
}

.search-section {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.search-section h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.search-box {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.search-box.multi-input {
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  min-width: 150px;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}

.btn-search {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
}

.btn-search:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-search:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-hints {
  color: #7f8c8d;
  font-size: 0.9rem;
}

.hint {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.search-type-badge {
  background: #667eea;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  display: inline-block;
  margin-bottom: 1rem;
  font-weight: 600;
}

.results-section {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.results-section h3 {
  margin-bottom: 1.5rem;
  color: #2c3e50;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.result-card {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.result-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);
}

.result-image img {
  width: 100%;
  height: 200px;
  object-fit: contain;
  background: #f8f9fa;
}

.result-info {
  padding: 1rem;
}

.result-info h4 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.set-number, .set-year, .num-parts {
  margin: 0.25rem 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.matched-info {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e1e5e9;
}

.matched-element, .matched-part {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.element-results-table {
  overflow-x: auto;
}

.element-results-table table {
  width: 100%;
  border-collapse: collapse;
}

.element-results-table th {
  background: #f8f9fa;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #e1e5e9;
}

.element-results-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #e1e5e9;
}

.element-results-table tbody tr:hover {
  background: #f8f9fa;
}

.element-ids-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.element-id-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.element-id-badge {
  background: #667eea;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  font-family: monospace;
}

.element-id-details {
  flex: 1;
}

.element-id-details p {
  margin: 0.25rem 0;
  color: #2c3e50;
}

.no-results {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
}

.no-results-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.no-results h3 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.no-results p {
  color: #7f8c8d;
}
</style>

