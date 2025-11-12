<template>
  <div class="set-parts-page">
    <div class="page-header">
      <h1>세트부품</h1>
      <p>세트번호를 입력하여 해당 세트의 부품 정보를 확인할 수 있습니다.</p>
    </div>

    <div class="set-parts-content">
      <div class="search-section">
        <div class="setup-card">
          <div class="card-body">
            <div class="form-group">
              <label>레고번호를 입력하세요.</label>
              <div class="set-search-wrapper" ref="setDropdownRef">
                <div class="set-search-input-row">
                  <div class="set-search-input-wrapper">
                    <input
                      type="text"
                      v-model="setSearchQuery"
                      @keyup.enter="handleSearchEnter"
                      @blur="handleSearchBlur"
                      placeholder="예 : 76917"
                      class="set-search-input"
                      :disabled="loading"
                    />
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M14 14L11.1 11.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <button
                    type="button"
                    @click="handleSearchEnter"
                    class="search-button"
                    :disabled="loading"
                  >
                    검색
                  </button>
                </div>

                <transition name="select-fade">
                  <div v-if="showSetDropdown && searchResults.length > 0" :key="`dropdown-${searchResultsKey}`" class="custom-select-dropdown">
                    <button
                      v-for="(set, index) in searchResults"
                      :key="`${set.id}-${set.set_num}-${searchResultsKey}-${index}`"
                      type="button"
                      class="custom-select-option"
                      :class="{ active: selectedSetId === set.id }"
                      @click="handleSelectSet(set)"
                    >
                      <div class="option-row option-row-meta">
                        <span class="option-value option-set-display">{{ formatSetDisplay(set.set_num, set.theme_name, set.name) }}</span>
                      </div>
                      <div class="option-row">
                        <span class="option-label">제품명:</span>
                        <span class="option-value">{{ set.name || '' }}</span>
                      </div>
                    </button>
                  </div>
                </transition>
                <div v-if="selectedSetId && selectedSet" class="selected-set-info">
                  <span class="selected-set-display">{{ formatSetDisplay(selectedSet.set_num, selectedSet.theme_name, selectedSet.name) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <span>로딩 중...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>

      <div v-if="!loading && !error && selectedSet && parts.length > 0" class="parts-section">
        <div class="parts-grid">
          <div
            v-for="part in parts"
            :key="`${part.part_id}-${part.color_id}`"
            class="part-card"
          >
            <div class="part-image-container">
              <img
                v-if="part.image_url"
                :src="part.image_url"
                :alt="part.part_name"
                class="part-image"
                @error="handleImageError"
              />
              <div v-else class="no-part-image">이미지 없음</div>
            </div>
            <div class="part-info">
              <div v-if="part.element_id" class="element-id-badge" :style="{ backgroundColor: getColorRgb(part.color_rgb) || '#f3f4f6', color: getContrastColor(part.color_rgb) }">
                {{ part.element_id }}
              </div>
              <div class="part-name-text">{{ part.part_name }}</div>
              <div class="part-color-text">{{ part.color_name }}</div>
              <div class="quantity-badge">수량: {{ part.quantity }}개</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { formatSetDisplay } from '../utils/setDisplay'

export default {
  name: 'SetParts',
  setup() {
    const { supabase } = useSupabase()

    const loading = ref(false)
    const error = ref(null)
    const parts = ref([])
    const selectedSetId = ref('')
    const setSearchQuery = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0)
    const selectedSet = ref(null)
    const showSetDropdown = ref(false)
    const setDropdownRef = ref(null)

    const searchSets = async () => {
      if (!setSearchQuery.value.trim()) {
        searchResults.value = []
        showSetDropdown.value = false
        return
      }

      try {
        const query = setSearchQuery.value.trim()
        const mainSetNum = query.split('-')[0]
        let results = []
        
        // 1단계: 정확한 매칭 시도
        const { data: exactMatch, error: exactError } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id')
          .eq('set_num', query)
          .limit(20)

        if (!exactError && exactMatch && exactMatch.length > 0) {
          results = exactMatch
        } else {
          // 2단계: 메인 세트 번호로 정확히 일치
          const { data: mainMatch, error: mainError } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id')
            .eq('set_num', mainSetNum)
            .limit(20)

          if (!mainError && mainMatch && mainMatch.length > 0) {
            results = mainMatch
          } else {
            // 3단계: LIKE 패턴으로 검색
            const { data: likeMatch, error: likeError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id')
              .ilike('set_num', `${mainSetNum}%`)
              .order('set_num')
              .limit(20)

            if (!likeError && likeMatch && likeMatch.length > 0) {
              results = likeMatch.filter(set => set.set_num === mainSetNum)
              
              if (results.length === 0 && likeMatch.length > 0) {
                const withoutHyphen = likeMatch.filter(set => !set.set_num.includes('-'))
                if (withoutHyphen.length > 0) {
                  results = [withoutHyphen.sort((a, b) => a.set_num.length - b.set_num.length)[0]]
                } else {
                  results = [likeMatch[0]]
                }
              }
            }
          }
        }

        // 테마 정보 조회
        if (results.length > 0) {
          const themeIds = [...new Set(results.map(set => set.theme_id).filter(Boolean))]
          
          if (themeIds.length > 0) {
            const { data: themesData, error: themesError } = await supabase
              .from('lego_themes')
              .select('theme_id, name')
              .in('theme_id', themeIds)

            if (!themesError && themesData && themesData.length > 0) {
              const themeMap = new Map(themesData.map(theme => [theme.theme_id, theme.name]))
              
              results = results.map(set => ({
                ...set,
                theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null
              }))
            } else {
              results = results.map(set => ({ ...set, theme_name: null }))
            }
          } else {
            results = results.map(set => ({ ...set, theme_name: null }))
          }
        }

        searchResults.value = results
        searchResultsKey.value++
        
        if (searchResults.value.length > 0) {
          showSetDropdown.value = true
        } else {
          showSetDropdown.value = false
        }
      } catch (err) {
        console.error('세트 검색 실패:', err)
        searchResults.value = []
        showSetDropdown.value = false
      }
    }

    const handleSearchEnter = async () => {
      if (!setSearchQuery.value.trim()) {
        searchResults.value = []
        showSetDropdown.value = false
        return
      }
      
      await searchSets()
      
      if (searchResults.value.length === 1) {
        handleSelectSet(searchResults.value[0])
      } else if (searchResults.value.length > 0) {
        showSetDropdown.value = true
      }
    }

    const handleSearchBlur = () => {
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    const handleSelectSet = (set) => {
      selectedSet.value = set
      selectedSetId.value = set.id
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      loadSetParts()
    }

    const loadSetParts = async () => {
      if (!selectedSetId.value) return

      try {
        loading.value = true
        error.value = null

        // 세트의 모든 부품 조회
        const { data: partsData, error: partsError } = await supabase
          .from('set_parts')
          .select('part_id, color_id, quantity, element_id')
          .eq('set_id', selectedSetId.value)

        if (partsError) throw partsError

        if (!partsData || partsData.length === 0) {
          parts.value = []
          return
        }

        // 부품 정보 조회
        const partIds = [...new Set(partsData.map(p => p.part_id).filter(Boolean))]
        const { data: partsInfo, error: partsInfoError } = await supabase
          .from('lego_parts')
          .select('part_num, name, part_img_url')
          .in('part_num', partIds)

        if (partsInfoError) throw partsInfoError

        // 색상 정보 조회
        const colorIds = [...new Set(partsData.map(p => p.color_id).filter(Boolean))]
        const { data: colorsInfo, error: colorsError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .in('color_id', colorIds)

        if (colorsError) throw colorsError

        const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
        const colorsInfoMap = new Map(colorsInfo.map(c => [c.color_id, c]))

        // element_id 목록 수집
        const elementIds = [...new Set(partsData.map(p => p.element_id).filter(Boolean))].map(id => String(id))
        
        // element_id 기반 이미지 조회
        const elementImageMap = new Map()
        if (elementIds.length > 0) {
          const { data: elementImages, error: elementImagesError } = await supabase
            .from('part_images')
            .select('element_id, uploaded_url')
            .in('element_id', elementIds)
            .not('uploaded_url', 'is', null)

          if (!elementImagesError && elementImages) {
            elementImages.forEach(img => {
              if (img.element_id && img.uploaded_url) {
                elementImageMap.set(String(img.element_id), img.uploaded_url)
              }
            })
          }
        }

        // part_id + color_id 기반 이미지 조회
        const partColorImageMap = new Map()
        const itemsWithoutElementId = partsData.filter(p => !p.element_id)
        if (itemsWithoutElementId.length > 0) {
          const partColorKeys = itemsWithoutElementId.map(p => `${p.part_id}_${p.color_id}`)
          const uniqueKeys = [...new Set(partColorKeys)]
          
          for (const key of uniqueKeys) {
            const [partId, colorId] = key.split('_')
            const { data: partImage, error: partImageError } = await supabase
              .from('part_images')
              .select('uploaded_url')
              .eq('part_id', partId)
              .eq('color_id', parseInt(colorId))
              .maybeSingle()

            if (!partImageError && partImage?.uploaded_url) {
              partColorImageMap.set(key, partImage.uploaded_url)
            }
          }
        }

        // 부품 데이터 구성
        const partsWithData = partsData.map(part => {
          const partInfo = partsInfoMap.get(part.part_id)
          const colorInfo = colorsInfoMap.get(part.color_id)

          // 이미지 URL 결정: element_id 우선, 없으면 part_id + color_id, 마지막으로 part_img_url
          let imageUrl = null
          if (part.element_id && elementImageMap.has(String(part.element_id))) {
            imageUrl = elementImageMap.get(String(part.element_id))
          } else if (!part.element_id) {
            const key = `${part.part_id}_${part.color_id}`
            if (partColorImageMap.has(key)) {
              imageUrl = partColorImageMap.get(key)
            }
          }

          if (!imageUrl && partInfo?.part_img_url) {
            imageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(partInfo.part_img_url)}`
          }

          return {
            part_id: part.part_id,
            color_id: part.color_id,
            element_id: part.element_id,
            quantity: part.quantity,
            part_name: partInfo?.name || part.part_id,
            color_name: colorInfo?.name || `Color ${part.color_id}`,
            color_rgb: colorInfo?.rgb || null,
            image_url: imageUrl
          }
        })

        parts.value = partsWithData
      } catch (err) {
        console.error('세트 부품 로드 실패:', err)
        error.value = '세트 부품을 불러오는데 실패했습니다'
      } finally {
        loading.value = false
      }
    }

    const handleImageError = (event) => {
      event.target.style.display = 'none'
    }

    const getColorRgb = (rgb) => {
      if (!rgb) return null
      let rgbStr = String(rgb).trim()
      if (rgbStr && !rgbStr.startsWith('#')) {
        rgbStr = `#${rgbStr}`
      }
      return rgbStr || null
    }

    const getContrastColor = (rgb) => {
      if (!rgb) return '#1f2937'
      
      let rgbStr = String(rgb).trim()
      if (rgbStr && !rgbStr.startsWith('#')) {
        rgbStr = `#${rgbStr}`
      }
      
      if (!rgbStr || rgbStr.length !== 7) return '#1f2937'
      
      const r = parseInt(rgbStr.substring(1, 3), 16)
      const g = parseInt(rgbStr.substring(3, 5), 16)
      const b = parseInt(rgbStr.substring(5, 7), 16)
      
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      
      return brightness > 128 ? '#1f2937' : '#ffffff'
    }

    return {
      loading,
      error,
      parts,
      selectedSetId,
      setSearchQuery,
      searchResults,
      searchResultsKey,
      selectedSet,
      showSetDropdown,
      setDropdownRef,
      handleSearchEnter,
      handleSearchBlur,
      handleSelectSet,
      handleImageError,
      formatSetDisplay,
      getColorRgb,
      getContrastColor
    }
  }
}
</script>

<style scoped>
.set-parts-page {
  min-height: 100vh;
  background: #f9fafb;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
  padding: 0;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
  text-align: center;
}

.page-header p {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
  text-align: center;
}

.set-parts-content {
  max-width: 1400px;
  margin: 0 auto;
}

.search-section {
  max-width: 800px;
  margin: 0 auto 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0;
}

.setup-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.card-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 0rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
  line-height: normal;
  letter-spacing: normal;
  font-family: inherit;
}

.set-search-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.set-search-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  position: relative;
}

.set-search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.set-search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

.set-search-input:hover {
  border-color: #9ca3af;
}

.set-search-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.set-search-input:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.8;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  flex-shrink: 0;
}

.set-search-input:focus + .search-icon {
  color: #2563eb;
}

.search-button {
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.search-button:hover {
  background: #1d4ed8;
}

.search-button:active {
  background: #1e40af;
}

.search-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.selected-set-info {
  margin-top: 0.75rem;
  margin-bottom: 0;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.selected-set-display {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.custom-select-dropdown {
  position: relative;
  width: 100%;
  max-height: 260px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 18px 36px -12px rgba(15, 23, 42, 0.25);
  z-index: 20;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.custom-select-option {
  width: 100%;
  text-align: left;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.custom-select-option:hover {
  background: #f5f7ff;
}

.custom-select-option.active {
  background: #e0e7ff;
  color: #1d4ed8;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
  width: 100%;
  font-size: 0.875rem;
  line-height: 1.5;
}

.option-row:last-child {
  margin-bottom: 0;
}

.option-row-meta {
  gap: 0.375rem;
}

.option-set-display {
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}

.option-label {
  font-weight: 600;
  color: #6b7280;
  min-width: 60px;
  flex-shrink: 0;
}

.option-value {
  color: #111827;
  word-break: break-word;
  flex: 1;
}

.select-fade-enter-active,
.select-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.select-fade-enter-from,
.select-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #6b7280;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.error-state {
  color: #dc2626;
}

.parts-section {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.part-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.part-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.part-image-container {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #ffffff;
}

.part-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 1rem;
}

.no-part-image {
  color: #9ca3af;
  font-size: 0.875rem;
}

.part-info {
  padding: 1rem;
}

.element-id-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: bold;
  margin-bottom: 0.75rem;
  width: fit-content;
}

.part-name-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.part-color-text {
  font-size: 0.8125rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.quantity-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #3b82f6;
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
}

@media (max-width: 1024px) {
  .parts-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }
}

@media (max-width: 768px) {
  .set-parts-page {
    padding: 1rem;
  }

  .page-header {
    margin-bottom: 1rem;
    padding: 0;
  }

  .page-header h1 {
    font-size: 1.25rem !important;
  }

  .page-header p {
    font-size: 0.875rem !important;
  }

  .search-section {
    max-width: 100%;
    margin-bottom: 1.5rem;
    padding: 0;
  }

  .card-body {
    padding: 1rem;
  }

  .set-search-input-row {
    flex-direction: row;
    gap: 0.5rem;
  }

  .search-button {
    width: auto;
    white-space: nowrap;
  }

  .set-search-input {
    font-size: 0.9375rem !important;
  }

  .search-button {
    font-size: 0.875rem !important;
  }

  .parts-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
  }

  .part-image-container {
    height: 160px;
  }

  .part-info {
    padding: 0.875rem;
  }

  .element-id-badge {
    font-size: 0.8125rem !important;
    padding: 0.1875rem 0.625rem;
    margin-bottom: 0.625rem;
  }

  .part-name-text {
    font-size: 0.8125rem !important;
    margin-bottom: 0.5rem;
  }

  .part-color-text {
    font-size: 0.75rem !important;
  }
}
</style>

