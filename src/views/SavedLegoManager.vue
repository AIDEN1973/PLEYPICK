<template>
  <div class="saved-lego-manager">
    <div class="header">
      <h1>저장된 레고 관리</h1>
      <p>데이터베이스에 저장된 레고 세트들을 관리합니다.</p>
    </div>

    <!-- 필터 및 검색 -->
    <div class="filter-section">
      <div class="filter-controls">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="세트 번호 또는 이름으로 검색..."
            @keyup.enter="searchSavedSets"
            class="search-input"
          />
          <button @click="searchSavedSets" :disabled="loading" class="search-btn">
            {{ loading ? '검색 중...' : '검색' }}
          </button>
        </div>
        
        <div class="filter-options">
          <select v-model="selectedTheme" @change="filterByTheme" class="filter-select">
            <option value="">모든 테마</option>
            <option v-for="theme in themes" :key="theme.id" :value="theme.id">
              {{ theme.name }}
            </option>
          </select>
          
          <select v-model="selectedYear" @change="filterByYear" class="filter-select">
            <option value="">모든 연도</option>
            <option v-for="year in years" :key="year" :value="year">
              {{ year }}년
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- 통계 정보 -->
    <div class="stats-section">
      <div class="stat-cards">
        <div class="stat-card">
          <h3>총 세트 수</h3>
          <p class="stat-number">{{ totalSets }}</p>
        </div>
        <div class="stat-card">
          <h3>총 부품 수</h3>
          <p class="stat-number">{{ totalParts }}</p>
        </div>
        <div class="stat-card">
          <h3>이미지 처리 완료</h3>
          <p class="stat-number">{{ processedImages }}</p>
        </div>
      </div>
    </div>

    <!-- 저장된 세트 목록 -->
    <div v-if="savedSets.length > 0" class="saved-sets">
      <div class="sets-header">
        <h3>저장된 레고 세트 ({{ savedSets.length }}개)</h3>
        <div class="view-controls">
          <button 
            @click="viewMode = 'grid'" 
            :class="{ active: viewMode === 'grid' }"
            class="view-btn"
          >
            격자 보기
          </button>
          <button 
            @click="viewMode = 'list'" 
            :class="{ active: viewMode === 'list' }"
            class="view-btn"
          >
            목록 보기
          </button>
        </div>
      </div>

      <!-- 격자 보기 -->
      <div v-if="viewMode === 'grid'" class="sets-grid">
        <div 
          v-for="set in savedSets" 
          :key="set.id"
          class="set-card"
          @click="selectSet(set)"
        >
          <div class="set-image">
            <img 
              :src="set.set_img_url" 
              :alt="set.name"
              @error="handleImageError"
            />
          </div>
          <div class="set-info">
            <h4>{{ set.name }}</h4>
            <p class="set-number">{{ set.set_num }}</p>
            <p class="set-year">{{ set.year }}년</p>
            <p class="set-pieces">{{ set.num_parts }}개 부품</p>
            <div class="set-actions">
              <button @click.stop="viewSetDetails(set)" class="btn btn-sm btn-primary">
                상세보기
              </button>
              <button @click.stop="deleteSet(set)" class="btn btn-sm btn-danger">
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 목록 보기 -->
      <div v-else class="sets-list">
        <table class="sets-table">
          <thead>
            <tr>
              <th>이미지</th>
              <th>세트 번호</th>
              <th>이름</th>
              <th>연도</th>
              <th>부품 수</th>
              <th>등록일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="set in savedSets" :key="set.id">
              <td>
                <img 
                  :src="set.set_img_url" 
                  :alt="set.name"
                  class="set-thumbnail"
                  @error="handleImageError"
                />
              </td>
              <td>{{ set.set_num }}</td>
              <td>{{ set.name }}</td>
              <td>{{ set.year }}</td>
              <td>{{ set.num_parts }}</td>
              <td>{{ formatDate(set.created_at) }}</td>
              <td>
                <button @click="viewSetDetails(set)" class="btn btn-sm btn-primary">
                  상세
                </button>
                <button @click="deleteSet(set)" class="btn btn-sm btn-danger">
                  삭제
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 빈 상태 -->
    <div v-else-if="!loading" class="empty-state">
      <div class="empty-icon">📦</div>
      <h3>저장된 레고 세트가 없습니다</h3>
      <p>새로운 레고 세트를 등록해보세요.</p>
      <router-link to="/new-lego" class="btn btn-primary">
        신규 레고 등록
      </router-link>
    </div>

    <!-- 선택된 세트 상세 정보 모달 -->
    <div v-if="selectedSet" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ selectedSet.name }}</h2>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="set-details">
            <div class="set-main-info">
              <img :src="selectedSet.set_img_url" :alt="selectedSet.name" class="set-large-image" />
              <div class="set-details-text">
                <p><strong>세트 번호:</strong> {{ selectedSet.set_num }}</p>
                <p><strong>연도:</strong> {{ selectedSet.year }}</p>
                <p><strong>부품 수:</strong> {{ selectedSet.num_parts }}개</p>
                <p><strong>테마 ID:</strong> {{ selectedSet.theme_id }}</p>
                <p><strong>등록일:</strong> {{ formatDate(selectedSet.created_at) }}</p>
              </div>
            </div>

            <!-- 부품 목록 -->
            <div v-if="setParts.length > 0" class="parts-section">
              <h3>부품 목록 ({{ uniquePartsCount }}개 고유 부품, 총 {{ setParts.length }}개 항목) - DB에서 로드됨</h3>
              <div class="parts-grid">
                <div 
                  v-for="part in setParts" 
                  :key="`${part.lego_parts.part_num}-${part.lego_colors.color_id}`"
                  class="part-card"
                >
                  <div class="part-image" @mouseenter="showMetadata(part)" @mouseleave="hideMetadata">
                    <img 
                      :src="part.supabase_image_url || part.lego_parts.part_img_url" 
                      :alt="part.lego_parts.name"
                      @error="handleImageError"
                      :title="part.supabase_image_url ? 'Supabase Storage에서 로드됨' : 'Rebrickable CDN에서 로드됨'"
                    />
                    <div v-if="part.supabase_image_url" class="image-source-badge">
                      📦 Supabase
                    </div>
                    <div v-else class="image-source-badge">
                      🌐 CDN
                    </div>
                    
                    <!-- 메타데이터 툴팁 -->
                    <div v-if="hoveredPart && hoveredPart.lego_parts.part_num === part.lego_parts.part_num && hoveredPart.lego_colors.color_id === part.lego_colors.color_id" 
                         class="metadata-tooltip">
                      <div class="tooltip-content">
                        <h4>🧠 LLM 분석 결과</h4>
                        <div v-if="part.metadata" class="metadata-details">
                          <p><strong>형태:</strong> {{ part.metadata.shape }}</p>
                          <p><strong>기능:</strong> {{ part.metadata.function }}</p>
                          <p><strong>연결방식:</strong> {{ part.metadata.connection }}</p>
                          <p><strong>중심 스터드:</strong> {{ part.metadata.center_stud ? '있음' : '없음' }}</p>
                          <p><strong>홈:</strong> {{ part.metadata.groove ? '있음' : '없음' }}</p>
                          <p><strong>신뢰도:</strong> {{ Math.round(part.metadata.confidence * 100) }}%</p>
                          <div v-if="part.metadata.recognition_hints" class="recognition-hints">
                            <p><strong>인식 힌트:</strong></p>
                            <ul>
                              <li v-if="part.metadata.recognition_hints.top_view">
                                <strong>위에서:</strong> {{ part.metadata.recognition_hints.top_view }}
                              </li>
                              <li v-if="part.metadata.recognition_hints.side_view">
                                <strong>옆에서:</strong> {{ part.metadata.recognition_hints.side_view }}
                              </li>
                              <li v-if="part.metadata.recognition_hints.unique_features">
                                <strong>고유 특징:</strong> {{ part.metadata.recognition_hints.unique_features.join(', ') }}
                              </li>
                            </ul>
                          </div>
                          <div v-if="part.metadata.similar_parts && part.metadata.similar_parts.length > 0" class="similar-parts">
                            <p><strong>유사 부품:</strong> {{ part.metadata.similar_parts.join(', ') }}</p>
                          </div>
                          <div v-if="part.metadata.distinguishing_features && part.metadata.distinguishing_features.length > 0" class="distinguishing-features">
                            <p><strong>구별 특징:</strong> {{ part.metadata.distinguishing_features.join(', ') }}</p>
                          </div>
                          <div v-if="part.metadata.feature_text" class="feature-text">
                            <p><strong>특징 설명:</strong></p>
                            <p class="feature-description">{{ part.metadata.feature_text }}</p>
                          </div>
                        </div>
                        <div v-else class="no-metadata">
                          <p>🤖 LLM 분석 데이터가 없습니다</p>
                          <p class="small-text">이 부품은 아직 AI 분석이 완료되지 않았습니다.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="part-info">
                    <h4>{{ part.lego_parts.name }}</h4>
                    <p><strong>부품 번호:</strong> {{ part.lego_parts.part_num }}</p>
                    <p><strong>색상:</strong> {{ part.lego_colors.name }}</p>
                    <p><strong>수량:</strong> {{ part.quantity }}개</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 에러 메시지 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 성공 메시지 -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useDatabase } from '../composables/useDatabase'
import { supabase } from '../composables/useSupabase'

export default {
  name: 'SavedLegoManager',
  setup() {
    const {
      loading,
      error,
      getLegoSets,
      getSetParts
    } = useDatabase()

    const searchQuery = ref('')
    const savedSets = ref([])
    const selectedSet = ref(null)
    const setParts = ref([])
    const viewMode = ref('grid')
    const successMessage = ref('')
    const themes = ref([])
    const years = ref([])
    const selectedTheme = ref('')
    const selectedYear = ref('')
    const hoveredPart = ref(null)

    // 통계 정보
    const totalSets = computed(() => savedSets.value.length)
    const totalParts = computed(() => {
      return savedSets.value.reduce((sum, set) => sum + (set.num_parts || 0), 0)
    })
    const processedImages = computed(() => {
      // TODO: 실제 이미지 처리 완료 수 계산
      return 0
    })

    // 저장된 세트 로드
    const loadSavedSets = async () => {
      try {
        const sets = await getLegoSets(1, 1000) // 모든 세트 로드
        savedSets.value = sets
        extractThemesAndYears(sets)
      } catch (err) {
        console.error('Failed to load saved sets:', err)
      }
    }

    // 테마와 연도 추출
    const extractThemesAndYears = (sets) => {
      const themeSet = new Set()
      const yearSet = new Set()
      
      sets.forEach(set => {
        if (set.theme_id) themeSet.add(set.theme_id)
        if (set.year) yearSet.add(set.year)
      })
      
      themes.value = Array.from(themeSet).map(id => ({ id, name: `테마 ${id}` }))
      years.value = Array.from(yearSet).sort((a, b) => b - a)
    }

    // 검색
    const searchSavedSets = async () => {
      if (!searchQuery.value.trim()) {
        await loadSavedSets()
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('lego_sets')
          .select('*')
          .or(`set_num.ilike.%${searchQuery.value}%,name.ilike.%${searchQuery.value}%`)
          .order('created_at', { ascending: false })

        if (error) throw error
        savedSets.value = data || []
      } catch (err) {
        console.error('Search failed:', err)
      }
    }

    // 테마별 필터
    const filterByTheme = () => {
      if (!selectedTheme.value) {
        loadSavedSets()
        return
      }
      
      savedSets.value = savedSets.value.filter(set => set.theme_id == selectedTheme.value)
    }

    // 연도별 필터
    const filterByYear = () => {
      if (!selectedYear.value) {
        loadSavedSets()
        return
      }
      
      savedSets.value = savedSets.value.filter(set => set.year == selectedYear.value)
    }

    // 세트 선택
    const selectSet = async (set) => {
      try {
        selectedSet.value = set
        console.log(`🔍 DEBUG: Loading parts for set ${set.set_num} (ID: ${set.id})`)
        const parts = await getSetParts(set.id)
        console.log(`🔍 DEBUG: Loaded ${parts.length} parts from database`)
        console.log(`🔍 DEBUG: First few parts:`, parts.slice(0, 3).map(p => ({
          part_num: p.lego_parts.part_num,
          color: p.lego_colors.name,
          quantity: p.quantity
        })))
        
        // 각 부품의 Supabase Storage 이미지 URL 조회
        console.log(`🔍 DEBUG: Checking Supabase Storage images for ${parts.length} parts...`)
        // (part_num, color_id) 기준으로 중복 제거 (최초 항목만 유지)
        const seenKeys = new Set()
        const deduped = []
        for (const p of parts) {
          const key = `${p.lego_parts.part_num}__${p.lego_colors.color_id}`
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            deduped.push(p)
          }
        }

        const partsWithImages = await Promise.all(deduped.map(async (part) => {
          try {
            const imageUrl = await getSupabaseImageUrl(part.lego_parts.part_num, part.lego_colors.color_id)
            if (imageUrl) {
              console.log(`✅ Found Supabase image for ${part.lego_parts.part_num}: ${imageUrl}`)
            } else {
              console.log(`❌ No Supabase image for ${part.lego_parts.part_num}, using CDN`)
            }
            
            // LLM 분석 메타데이터 로드
            const metadata = await getPartMetadata(part.lego_parts.part_num, part.lego_colors.color_id)
            
            return {
              ...part,
              supabase_image_url: imageUrl,
              metadata: metadata
            }
          } catch (err) {
            console.warn(`Failed to get Supabase image for ${part.lego_parts.part_num}:`, err)
            return {
              ...part,
              supabase_image_url: null,
              metadata: null
            }
          }
        }))
        
        const supabaseImageCount = partsWithImages.filter(p => p.supabase_image_url).length
        console.log(`🔍 DEBUG: ${supabaseImageCount}/${parts.length} parts have Supabase Storage images`)
        
        setParts.value = partsWithImages
      } catch (err) {
        console.error('Failed to load set parts:', err)
      }
    }

    // Supabase Storage에서 이미지 URL 조회 (part_images 우선, 다음 image_metadata)
    const getSupabaseImageUrl = async (partNum, colorId) => {
      try {
        // 1) part_images에서 직접 조회 (앱 업서트 소스)
        const { data: pi, error: piErr } = await supabase
          .from('part_images')
          .select('uploaded_url')
          .eq('part_id', partNum)
          .eq('color_id', colorId)
          .maybeSingle()

        if (!piErr && pi?.uploaded_url) return pi.uploaded_url

        // 2) 과거 기록 호환: image_metadata.supabase_url 조회
        const { data: im, error: imErr } = await supabase
          .from('image_metadata')
          .select('supabase_url')
          .eq('part_num', partNum)
          .eq('color_id', colorId)
          .maybeSingle()

        if (!imErr && im?.supabase_url) return im.supabase_url

        return null
      } catch (err) {
        console.error('Error fetching Supabase image URL:', err)
        return null
      }
    }

    // LLM 분석 메타데이터 조회
    const getPartMetadata = async (partNum, colorId) => {
      try {
        const { data, error } = await supabase
          .from('parts_master_features')
          .select('feature_json, feature_text, confidence')
          .eq('part_id', partNum)
          .eq('color_id', colorId)
          .maybeSingle()

        if (error) {
          console.log(`No metadata found for ${partNum} (color: ${colorId})`)
          return null
        }

        if (!data) return null

        return {
          ...data.feature_json,
          feature_text: data.feature_text,
          confidence: data.confidence
        }
      } catch (err) {
        console.error('Error fetching part metadata:', err)
        return null
      }
    }

    // 메타데이터 툴팁 표시
    const showMetadata = (part) => {
      hoveredPart.value = part
    }

    // 메타데이터 툴팁 숨기기
    const hideMetadata = () => {
      hoveredPart.value = null
    }

    // 세트 상세보기
    const viewSetDetails = (set) => {
      selectSet(set)
    }

    // 세트 삭제
    const deleteSet = async (set) => {
      if (!confirm(`"${set.name}" 세트를 삭제하시겠습니까?`)) return
      
      try {
        const { error } = await supabase
          .from('lego_sets')
          .delete()
          .eq('id', set.id)

        if (error) throw error
        
        // 목록에서 제거
        savedSets.value = savedSets.value.filter(s => s.id !== set.id)
        successMessage.value = '세트가 성공적으로 삭제되었습니다.'
      } catch (err) {
        console.error('Failed to delete set:', err)
        error.value = '삭제 중 오류가 발생했습니다.'
      }
    }

    // 모달 닫기
    const closeModal = () => {
      selectedSet.value = null
      setParts.value = []
    }

    // 날짜 포맷팅
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('ko-KR')
    }

    // 이미지 오류 처리
    const handleImageError = (event) => {
      const img = event.target
      const part = setParts.value.find(p => 
        p.supabase_image_url === img.src || p.lego_parts.part_img_url === img.src
      )
      
      if (part && part.supabase_image_url && img.src === part.supabase_image_url) {
        // Supabase 이미지 로드 실패 시 Rebrickable CDN으로 폴백
        console.log(`Supabase image failed for ${part.lego_parts.part_num}, falling back to CDN`)
        img.src = part.lego_parts.part_img_url
      } else {
        // 모든 이미지 로드 실패 시 플레이스홀더
        img.src = '/placeholder-image.png'
      }
    }

    // 고유 부품 수 계산
    const uniquePartsCount = computed(() => {
      if (!setParts.value || setParts.value.length === 0) return 0
      const uniqueParts = new Set(setParts.value.map(part => part.lego_parts.part_num))
      return uniqueParts.size
    })

    onMounted(() => {
      loadSavedSets()
    })

    return {
      searchQuery,
      savedSets,
      selectedSet,
      setParts,
      viewMode,
      loading,
      error,
      successMessage,
      themes,
      years,
      selectedTheme,
      selectedYear,
      hoveredPart,
      totalSets,
      totalParts,
      processedImages,
      searchSavedSets,
      filterByTheme,
      filterByYear,
      selectSet,
      viewSetDetails,
      deleteSet,
      closeModal,
      formatDate,
      handleImageError,
      uniquePartsCount,
      showMetadata,
      hideMetadata
    }
  }
}
</script>

<style scoped>
.saved-lego-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  color: #333;
  margin-bottom: 0.5rem;
}

.filter-section {
  margin-bottom: 2rem;
}

.filter-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 300px;
}

.search-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}

.search-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.search-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.filter-options {
  display: flex;
  gap: 1rem;
}

.filter-select {
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
}

.stats-section {
  margin-bottom: 2rem;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card h3 {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
  margin: 0;
}

.saved-sets {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  padding: 2rem;
}

.sets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.sets-header h3 {
  color: #333;
  margin: 0;
}

.view-controls {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #e1e5e9;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.sets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.set-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid #e1e5e9;
  cursor: pointer;
  transition: transform 0.2s;
}

.set-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.set-image {
  height: 200px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.set-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.set-info h4 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.set-number {
  font-weight: 600;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.set-year, .set-pieces {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.set-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.sets-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.sets-table th,
.sets-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e1e5e9;
}

.sets-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.set-thumbnail {
  width: 50px;
  height: 50px;
  object-fit: contain;
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: #333;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #666;
  margin-bottom: 2rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e1e5e9;
}

.modal-header h2 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 1.5rem;
}

.set-details {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.set-main-info {
  display: flex;
  gap: 2rem;
}

.set-large-image {
  width: 200px;
  height: 200px;
  object-fit: contain;
  background: #f8f9fa;
  border-radius: 8px;
}

.set-details-text p {
  margin-bottom: 0.5rem;
  color: #666;
}

.parts-section h3 {
  color: #333;
  margin-bottom: 1rem;
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.part-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e1e5e9;
}

.part-image {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
  background: white;
  border-radius: 6px;
  position: relative;
  cursor: pointer;
}

.part-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-source-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
}

.part-info h4 {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.part-info p {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-block;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.success-message {
  background: #efe;
  color: #363;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
}

/* 메타데이터 툴팁 스타일 */
.metadata-tooltip {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
}

.tooltip-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  max-width: 350px;
  min-width: 300px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.tooltip-content h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: #fff;
  text-align: center;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 0.5rem;
}

.metadata-details p {
  margin: 0.5rem 0;
  color: #f8f9fa;
}

.metadata-details strong {
  color: #fff;
  font-weight: 600;
}

.recognition-hints,
.similar-parts,
.distinguishing-features,
.feature-text {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255,255,255,0.2);
}

.recognition-hints ul {
  margin: 0.5rem 0;
  padding-left: 1rem;
}

.recognition-hints li {
  margin: 0.25rem 0;
  color: #f8f9fa;
}

.feature-description {
  background: rgba(255,255,255,0.1);
  padding: 0.5rem;
  border-radius: 6px;
  margin-top: 0.5rem;
  font-style: italic;
  color: #e9ecef;
}

.no-metadata {
  text-align: center;
  color: #f8f9fa;
}

.no-metadata p {
  margin: 0.5rem 0;
}

.small-text {
  font-size: 0.8rem;
  color: #dee2e6;
}

@media (max-width: 768px) {
  .filter-controls {
    flex-direction: column;
  }
  
  .search-box {
    min-width: auto;
  }
  
  .set-main-info {
    flex-direction: column;
  }
  
  .sets-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .tooltip-content {
    max-width: 280px;
    min-width: 250px;
    font-size: 0.8rem;
  }
}
</style>
