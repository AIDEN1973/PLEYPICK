<template>
  <div class="part-manager">
    <div class="header">
      <h1>부품 정보 관리</h1>
      <p>데이터베이스에 저장된 레고 부품 정보를 조회하고 관리합니다.</p>
    </div>

    <!-- 검색 및 필터 -->
    <div class="filter-section">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="부품 번호 또는 이름으로 검색..."
          @keyup.enter="searchParts"
          class="search-input"
        />
        <button @click="searchParts" :disabled="loading" class="search-btn">
          {{ loading ? '검색 중...' : '검색' }}
        </button>
      </div>
      
      <div class="filter-options">
        <select v-model="selectedCategory" @change="filterByCategory" class="filter-select">
          <option value="">모든 카테고리</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- 통계 정보 -->
    <div class="stats-section">
      <div class="stat-cards">
        <div class="stat-card">
          <h3>총 부품 수</h3>
          <p class="stat-number">{{ totalParts }}</p>
        </div>
        <div class="stat-card">
          <h3>이미지 등록</h3>
          <p class="stat-number">{{ partsWithImages }}</p>
          <p class="stat-subtitle">{{ totalParts > 0 ? Math.round((partsWithImages / totalParts) * 100) : 0 }}% 등록됨</p>
        </div>
        <div class="stat-card">
          <h3>메타데이터</h3>
          <p class="stat-number">{{ partsWithMetadata }}</p>
          <p class="stat-subtitle">{{ totalParts > 0 ? Math.round((partsWithMetadata / totalParts) * 100) : 0 }}% 분석됨</p>
        </div>
      </div>
      <div class="stats-actions">
        <button 
          @click="checkMissingImages('missing')" 
          :disabled="loading || syncingMissingImages"
          class="sync-btn"
        >
          {{ syncingMissingImages ? `재등록 중... (${syncProgress.current}/${syncProgress.total})` : '누락 이미지 재등록' }}
        </button>
        <button 
          @click="checkMissingImages('all')" 
          :disabled="loading || syncingMissingImages"
          class="sync-btn secondary"
        >
          전체 이미지 강제 재등록
        </button>
        <button 
          @click="checkMissingImages('part')"
          :disabled="loading || syncingMissingImages"
          class="sync-btn secondary"
        >
          엘리먼트 이미지로 재등록
        </button>
        <span v-if="missingImagesCount > 0" class="missing-count">
          누락: {{ missingImagesCount }}개
        </span>
      </div>
    </div>

    <!-- 부품 목록 -->
    <div v-if="parts.length > 0" class="parts-section">
      <div class="parts-header">
        <h3>부품 목록 ({{ parts.length }}개)</h3>
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
      <div v-if="viewMode === 'grid'" class="parts-grid">
        <div 
          v-for="part in parts" 
          :key="part.part_num"
          class="part-card"
          @click="selectPart(part)"
        >
          <div class="card-header">
            <div class="part-info">
              <div class="element-id">
                {{ part.element_id || part.part_num }}
              </div>
              <h4 class="part-name">{{ part.name }}</h4>
              <div class="part-details">
                <span 
                  v-if="part.color_name || part.color_id"
                  class="color-badge"
                  :style="{ 
                    backgroundColor: getColorRgb(part.color_rgb) || '#ccc',
                    color: getColorTextColor(part.color_rgb)
                  }"
                >
                  {{ formatColorName(part.color_name) || `Color ${part.color_id}` }}
                </span>
                <span v-if="part.set_count > 0" class="set-count-badge">
                  포함 세트: {{ part.set_count }}개
                </span>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="part-image-section">
              <img 
                v-if="part.imageUrl"
                :src="part.imageUrl" 
                :alt="part.name"
                class="part-image"
                @error="handleImageError"
              />
              <div v-else class="no-part-image">이미지 없음</div>
            </div>
            <div 
              v-if="canReuploadElementImage(part)"
              class="reupload-action"
              @click.stop
            >
              <button
                class="reupload-btn"
                :disabled="part.reuploading"
                @click.stop="reRegisterImageWithElement(part, $event)"
              >
                {{ part.reuploading ? '재등록 중...' : '엘리먼트 이미지 재등록' }}
              </button>
              <p v-if="part.reuploadError" class="reupload-status error">
                {{ part.reuploadError }}
              </p>
              <p v-else-if="part.reuploadMessage" class="reupload-status success">
                {{ part.reuploadMessage }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 목록 보기 -->
      <div v-if="viewMode === 'list'" class="parts-list">
        <table class="parts-table">
          <thead>
            <tr>
              <th>이미지</th>
              <th>부품 번호</th>
              <th>이름</th>
              <th>카테고리</th>
              <th>색상 수</th>
              <th>포함 세트</th>
              <th>메타데이터</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="part in parts" 
              :key="part.part_num"
              @click="selectPart(part)"
              class="part-row"
            >
              <td>
                <div class="part-image-wrapper">
                  <img 
                    :src="part.imageUrl || ''" 
                    :alt="part.name"
                    class="part-thumbnail"
                    @error="handleImageError"
                  />
                </div>
              </td>
              <td><strong>{{ part.part_num }}</strong></td>
              <td>{{ part.name }}</td>
              <td>{{ part.category_name || '-' }}</td>
              <td>{{ part.color_count || 0 }}</td>
              <td>{{ part.set_count || 0 }}</td>
              <td>
                <span v-if="part.hasMetadata" class="badge badge-success">있음</span>
                <span v-else class="badge badge-warning">없음</span>
              </td>
              <td>
                <button @click.stop="viewPartDetails(part)" class="btn btn-sm btn-primary">
                  상세보기
                </button>
                <div 
                  v-if="canReuploadElementImage(part)"
                  class="reupload-action list"
                >
                  <button
                    class="reupload-btn"
                    :disabled="part.reuploading"
                    @click.stop="reRegisterImageWithElement(part, $event)"
                  >
                    {{ part.reuploading ? '재등록 중...' : '엘리먼트 이미지 재등록' }}
                  </button>
                  <p v-if="part.reuploadError" class="reupload-status error">
                    {{ part.reuploadError }}
                  </p>
                  <p v-else-if="part.reuploadMessage" class="reupload-status success">
                    {{ part.reuploadMessage }}
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 검색 결과 없음 -->
    <div v-else-if="!loading && searchQuery" class="empty-state">
      <p>검색 결과가 없습니다.</p>
    </div>

    <!-- 로딩 중 -->
    <div v-if="loading" class="loading-state">
      <p>로딩 중...</p>
    </div>

    <!-- 부품 상세 정보 모달 -->
    <div v-if="selectedPartDetail" class="modal-overlay" @click="closePartDetail">
      <div class="modal-content modal-large" @click.stop>
        <div class="modal-header">
          <h2>{{ selectedPartDetail.name }}</h2>
          <button @click="closePartDetail" class="close-btn">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="part-detail-main">
            <div class="part-detail-image">
              <img 
                :src="selectedPartDetail?.imageUrl || ''" 
                :alt="selectedPartDetail?.name"
                @error="handleImageError"
              />
            </div>
            <div class="part-detail-info">
              <p><strong>부품 번호:</strong> {{ selectedPartDetail.part_num }}</p>
              <p v-if="selectedPartDetail.category_name"><strong>카테고리:</strong> {{ selectedPartDetail.category_name }}</p>
              <p v-if="selectedPartDetail.part_cat_id"><strong>카테고리 ID:</strong> {{ selectedPartDetail.part_cat_id }}</p>
            </div>
          </div>

          <!-- 색상별 정보 -->
          <div v-if="partColors.length > 0" class="part-colors-section">
            <h3>색상별 정보 ({{ partColors.length }}개)</h3>
            <div class="colors-grid">
              <div 
                v-for="colorInfo in partColors" 
                :key="`${selectedPartDetail.part_num}-${colorInfo.color_id}`"
                class="color-card"
              >
                <div class="color-image color-image-wrapper">
                  <img 
                    :src="colorInfo.imageUrl || ''" 
                    :alt="colorInfo.color_name"
                    @error="handleImageError"
                  />
                </div>
                <div class="color-info">
                  <p><strong>색상:</strong> {{ formatColorName(colorInfo.color_name) || colorInfo.color_name }}</p>
                  <p v-if="colorInfo.element_id"><strong>Element ID:</strong> {{ colorInfo.element_id }}</p>
                  <p v-if="colorInfo.set_count > 0"><strong>포함 세트:</strong> {{ colorInfo.set_count }}개</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 포함된 세트 목록 -->
          <div v-if="partSets.length > 0" class="part-sets-section">
            <h3>포함된 세트 ({{ partSets.length }}개)</h3>
            <div class="sets-grid">
              <div 
                v-for="set in partSets" 
                :key="set.set_id"
                class="set-card-small"
                @click="goToSet(set.set_num)"
              >
                <img 
                  v-if="set.set_img_url"
                  :src="set.set_img_url" 
                  :alt="set.name"
                  class="set-thumbnail"
                />
                <div class="set-info-small">
                  <p><strong>{{ set.set_num }}</strong></p>
                  <p>{{ set.name }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 메타데이터 정보 -->
          <div v-if="partMetadata" class="part-metadata-section">
            <h3>메타데이터 정보</h3>
            <div class="metadata-content">
              <p v-if="partMetadata.shape_tag"><strong>형태:</strong> {{ partMetadata.shape_tag }}</p>
              <p v-if="partMetadata.function"><strong>기능:</strong> {{ partMetadata.function }}</p>
              <p v-if="partMetadata.connection"><strong>연결방식:</strong> {{ partMetadata.connection }}</p>
              <p v-if="partMetadata.center_stud !== undefined">
                <strong>중심 스터드:</strong> {{ partMetadata.center_stud ? '있음' : '없음' }}
              </p>
              <p v-if="partMetadata.groove !== undefined">
                <strong>홈:</strong> {{ partMetadata.groove ? '있음' : '없음' }}
              </p>
              <div v-if="partMetadata.recognition_hints" class="recognition-hints">
                <p><strong>인식 힌트:</strong></p>
                <ul>
                  <li v-if="partMetadata.recognition_hints.top_view">
                    <strong>위에서:</strong> {{ partMetadata.recognition_hints.top_view }}
                  </li>
                  <li v-if="partMetadata.recognition_hints.side_view">
                    <strong>옆에서:</strong> {{ partMetadata.recognition_hints.side_view }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- 페이지네이션 (항상 표시) -->
    <div v-if="totalCount > 0" class="pagination">
      <button 
        @click="loadAllParts(currentPage - 1)" 
        :disabled="currentPage === 1 || loading"
        class="page-btn page-btn-nav"
      >
        이전
      </button>
      
      <div class="page-numbers">
        <button
          v-for="page in visiblePages"
          :key="page"
          @click="loadAllParts(page)"
          :disabled="loading"
          :class="['page-number-btn', { active: page === currentPage }]"
        >
          {{ page }}
        </button>
      </div>
      
      <button 
        @click="loadAllParts(currentPage + 1)" 
        :disabled="currentPage >= totalPages || loading"
        class="page-btn page-btn-nav"
      >
        다음
      </button>
      
      <span class="page-info">
        (총 {{ totalCount }}개)
      </span>
    </div>

    <!-- 누락 이미지 재등록 모달 -->
    <div v-if="showSyncModal" class="modal-overlay" @click.self="closeSyncModal">
      <div class="sync-modal">
        <div class="sync-modal-header">
          <h2>누락 이미지 재등록</h2>
          <button @click="closeSyncModal" class="close-btn">×</button>
        </div>
        <div class="sync-modal-content">
          <div v-if="syncProgress.total > 0" class="sync-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }"
              ></div>
            </div>
            <p class="progress-text">
              진행 중: {{ syncProgress.current }} / {{ syncProgress.total }} ({{ Math.round((syncProgress.current / syncProgress.total) * 100) }}%)
            </p>
            <p v-if="syncProgress.currentItem" class="current-item">
              현재: element_id {{ syncProgress.currentItem }}
            </p>
          </div>
          <div v-if="syncResults.success > 0 || syncResults.failed > 0" class="sync-results">
            <p class="success-count">성공: {{ syncResults.success }}개</p>
            <p class="failed-count">실패: {{ syncResults.failed }}개</p>
          </div>
          <div v-if="syncError" class="sync-error">
            <p>오류: {{ syncError }}</p>
          </div>
        </div>
        <div class="sync-modal-footer">
          <button 
            v-if="!syncingMissingImages && syncProgress.total > 0" 
            @click="closeSyncModal" 
            class="sync-btn"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { useBatchPartLoading } from '../composables/useBatchPartLoading'
import { useImageManager } from '../composables/useImageManager'
import { useRebrickable } from '../composables/useRebrickable'

const router = useRouter()
const { supabase } = useSupabase()
const { getSupabaseImageUrl } = useBatchPartLoading()
const { checkPartImageDuplicateByElementId, checkPartImageDuplicate, processRebrickableImage, upsertPartImage } = useImageManager()
const { getElement } = useRebrickable()

const loading = ref(false)
const searchQuery = ref('')
const parts = ref([])
const selectedPartDetail = ref(null)
const partColors = ref([])
const partSets = ref([])
const partMetadata = ref(null)
const viewMode = ref('grid')
const selectedCategory = ref('')
const categories = ref([])
const categoryCache = ref(new Map()) // 카테고리 캐시 (무한 반복 방지)

const totalParts = ref(0)
const partsWithImages = ref(0)
const partsWithMetadata = ref(0)

// 누락 이미지 재등록 관련
const missingImagesCount = ref(0)
const syncingMissingImages = ref(false)
const showSyncModal = ref(false)
const syncProgress = ref({
  current: 0,
  total: 0,
  currentItem: null
})
const syncResults = ref({
  success: 0,
  failed: 0
})
const syncError = ref(null)

// 페이지네이션
const currentPage = ref(1)
const itemsPerPage = ref(100) // 페이지당 100개
const totalCount = ref(0)

const FETCH_CHUNK_SIZE = 20

const fetchSetPartColorData = async (partIds = [], { requireElementId = true } = {}) => {
  if (!Array.isArray(partIds) || partIds.length === 0) return []
  
  const results = []
  for (let i = 0; i < partIds.length; i += FETCH_CHUNK_SIZE) {
    const chunk = partIds.slice(i, i + FETCH_CHUNK_SIZE).filter(Boolean)
    if (chunk.length === 0) continue
    
    try {
      let query = supabase
        .from('set_parts')
        .select('part_id, element_id, color_id, lego_colors(name, rgb)')
        .in('part_id', chunk)
      
      if (requireElementId) {
        query = query.not('element_id', 'is', null)
      } else {
        query = query.is('element_id', null)
      }
      
      const { data, error } = await query
      if (error) {
        console.warn(`[PartManager] set_parts 색상 조회 실패: ${error.message}`)
        continue
      }
      
      if (data && Array.isArray(data)) {
        results.push(...data)
      }
    } catch (err) {
      console.warn('[PartManager] set_parts 색상 조회 중 오류:', err)
    }
  }
  
  return results
}

const fetchAllElementSetParts = async () => {
  const elementIdMap = new Map()
  const partColorToElementMap = new Map()
  const elementItems = []
  let offset = 0
  const limit = 1000
  
  while (true) {
    const { data, error } = await supabase
      .from('set_parts')
      .select('part_id, color_id, element_id, lego_colors(name, rgb)')
      .not('element_id', 'is', null)
      .range(offset, offset + limit - 1)
    
    if (error) throw new Error(`set_parts(element) 조회 실패: ${error.message}`)
    if (!data || data.length === 0) break
    
    data.forEach(sp => {
      if (!sp?.element_id) return
      const elementId = String(sp.element_id)
      if (!elementIdMap.has(elementId)) {
        const item = {
          element_id: elementId,
          part_id: sp.part_id,
          color_id: sp.color_id,
          color_name: sp.lego_colors?.name || null,
          color_rgb: sp.lego_colors?.rgb || null
        }
        elementIdMap.set(elementId, item)
        elementItems.push(item)
      }
      
      if (sp.part_id && typeof sp.color_id === 'number') {
        partColorToElementMap.set(`${sp.part_id}_${sp.color_id}`, elementIdMap.get(elementId))
      }
    })
    
    if (data.length < limit) break
    offset += limit
  }
  
  return { elementIdMap, elementItems, partColorToElementMap }
}

const fetchPartImageRecords = async () => {
  const existingElementIds = new Set()
  const partOnlyImageRecords = []
  let offset = 0
  const limit = 1000
  
  while (true) {
    const { data, error } = await supabase
      .from('part_images')
      .select('part_id, color_id, element_id, uploaded_url')
      .not('uploaded_url', 'is', null)
      .range(offset, offset + limit - 1)
    
    if (error) throw new Error(`part_images 조회 실패: ${error.message}`)
    if (!data || data.length === 0) break
    
    data.forEach(img => {
      if (!img?.uploaded_url || (!img.uploaded_url.endsWith('.webp') && !img.uploaded_url.includes('.webp'))) return
      
      if (img.element_id) {
        existingElementIds.add(String(img.element_id))
      } else if (img.part_id && typeof img.color_id === 'number') {
        partOnlyImageRecords.push({
          part_id: img.part_id,
          color_id: img.color_id
        })
      }
    })
    
    if (data.length < limit) break
    offset += limit
  }
  
  return { existingElementIds, partOnlyImageRecords }
}

const collectElementReuploadTargets = async (mode = 'missing') => {
  const uiTargets = new Map()
  if (mode === 'part') {
    (parts.value || [])
      .filter(part => part?.needsElementImage && part.element_id)
      .forEach(part => {
        uiTargets.set(String(part.element_id), {
          element_id: String(part.element_id),
          part_id: part.part_num,
          color_id: typeof part.color_id === 'number' ? part.color_id : null,
          color_name: part.color_name || null,
          color_rgb: part.color_rgb || null
        })
      })
  }
  
  const { elementItems, partColorToElementMap } = await fetchAllElementSetParts()
  const { existingElementIds, partOnlyImageRecords } = await fetchPartImageRecords()
  
  if (mode === 'all') {
    elementItems.forEach(item => uiTargets.set(item.element_id, item))
    return Array.from(uiTargets.values())
  }
  
  if (mode === 'missing') {
    elementItems
      .filter(item => !existingElementIds.has(item.element_id))
      .forEach(item => uiTargets.set(item.element_id, item))
    return Array.from(uiTargets.values())
  }
  
  if (mode === 'part') {
    partOnlyImageRecords.forEach(record => {
      const target = partColorToElementMap.get(`${record.part_id}_${record.color_id}`)
      if (target) {
        uiTargets.set(target.element_id, target)
      }
    })
    return Array.from(uiTargets.values())
  }
  
  return []
}

// 페이지네이션 계산
const totalPages = computed(() => {
  if (totalCount.value === 0) return 1
  return Math.ceil(totalCount.value / itemsPerPage.value)
})

// 표시할 페이지 번호 목록 계산
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages = []
  
  // 최대 10개의 페이지 번호 표시
  const maxVisible = 10
  let start = Math.max(1, current - Math.floor(maxVisible / 2))
  let end = Math.min(total, start + maxVisible - 1)
  
  // 끝에 도달했을 때 시작점 조정
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

// 부품 검색
const searchParts = async () => {
  const trimmedQuery = searchQuery.value.trim()
  
  if (!trimmedQuery) {
    loadAllParts()
    return
  }

  try {
    loading.value = true
    
    const searchResults = []
    const partNumSet = new Set()
    
    const baseQuery = supabase
      .from('lego_parts')
      .select('part_num, name, part_cat_id')
      .limit(100)
    
    if (/^\d+$/.test(trimmedQuery)) {
      baseQuery.ilike('part_num', `%${trimmedQuery}%`)
    } else {
      baseQuery.ilike('name', `%${trimmedQuery}%`)
    }
    
    if (selectedCategory.value) {
      baseQuery.eq('part_cat_id', selectedCategory.value)
    }
    
    const { data: partData, error: partError } = await baseQuery
    if (partError) throw partError
    
    if (partData) {
      partData.forEach(part => {
        if (!partNumSet.has(part.part_num)) {
          partNumSet.add(part.part_num)
          searchResults.push(part)
        }
      })
    }
    
    // element_id 검색 (정확 일치)
    if (/^\d+$/.test(trimmedQuery)) {
      const { data: elementMatches, error: elementError } = await supabase
        .from('set_parts')
        .select('part_id')
        .eq('element_id', trimmedQuery)
      
      if (elementError) {
        console.warn('[PartManager] element_id 검색 실패:', elementError)
      } else if (elementMatches && elementMatches.length > 0) {
        const elementPartNums = [...new Set(elementMatches.map(sp => sp.part_id).filter(Boolean))]
        if (elementPartNums.length > 0) {
          let elementPartQuery = supabase
            .from('lego_parts')
            .select('part_num, name, part_cat_id')
            .in('part_num', elementPartNums)
          
          if (selectedCategory.value) {
            elementPartQuery = elementPartQuery.eq('part_cat_id', selectedCategory.value)
          }
          
          const { data: partsByElement, error: partsByElementError } = await elementPartQuery
          if (partsByElementError) {
            console.warn('[PartManager] element_id로 부품 조회 실패:', partsByElementError)
          } else if (partsByElement) {
            partsByElement.forEach(part => {
              if (!partNumSet.has(part.part_num)) {
                partNumSet.add(part.part_num)
                searchResults.push(part)
              }
            })
          }
        }
      }
    }
    
    if (searchResults.length === 0) {
      parts.value = []
      return
    }

    // 부품별 추가 정보 조회
    const partsWithStats = await Promise.all(
      searchResults.map(async (part) => {
        // 색상 수 조회
        const { count: colorCount } = await supabase
          .from('set_parts')
          .select('color_id', { count: 'exact', head: true })
          .eq('part_id', part.part_num)

        // 세트 수 조회
        const { count: setCount } = await supabase
          .from('set_parts')
          .select('set_id', { count: 'exact', head: true })
          .eq('part_id', part.part_num)

        // 메타데이터 존재 여부
        const { count: metadataCount } = await supabase
          .from('parts_master_features')
          .select('part_id', { count: 'exact', head: true })
          .eq('part_id', part.part_num)

        // 카테고리 이름 조회 (캐시 사용)
        let categoryName = null
        if (part.part_cat_id) {
          // 캐시에서 먼저 확인
          if (categoryCache.value.has(part.part_cat_id)) {
            categoryName = categoryCache.value.get(part.part_cat_id)
          } else {
            // 캐시에 없으면 조회 (404 오류 처리)
            try {
              const { data: categoryData, error: categoryError } = await supabase
                .from('part_categories')
                .select('display_name_ko, display_name, code')
                .eq('id', part.part_cat_id)
                .maybeSingle()
              
              if (!categoryError && categoryData) {
                categoryName = categoryData.display_name_ko || categoryData.display_name || categoryData.code || null
                categoryCache.value.set(part.part_cat_id, categoryName)
              }
            } catch (err) {
              // 404 오류 등은 무시 (카테고리가 없을 수 있음)
              console.warn(`카테고리 조회 실패 (part_cat_id: ${part.part_cat_id}):`, err.message)
            }
          }
        }

        // 이미지 URL 미리 로드
        const imageUrl = await getPartImageUrl(part)
        const imageSource = imageUrl ? 'part' : ''
        
        return {
          ...part,
          color_count: colorCount || 0,
          set_count: setCount || 0,
          hasMetadata: (metadataCount || 0) > 0,
          category_name: categoryName,
          imageUrl: imageUrl || '',
          imageSource,
          element_id: null,
          color_id: null,
          color_name: null,
          color_rgb: null,
          needsElementImage: imageSource === 'part',
          reuploading: false,
          reuploadMessage: '',
          reuploadError: ''
        }
      })
    )

    parts.value = partsWithStats
  } catch (err) {
    console.error('부품 검색 실패:', err)
  } finally {
    loading.value = false
  }
}

// 모든 부품 로드 (페이지네이션 지원)
const loadAllParts = async (page = 1) => {
  try {
    loading.value = true
    currentPage.value = page
    
    const from = (page - 1) * itemsPerPage.value
    const to = from + itemsPerPage.value - 1
    
    // 부품 목록 조회 (페이지네이션)
    const { data, error, count } = await supabase
      .from('lego_parts')
      .select('part_num, name, part_cat_id, part_img_url', { count: 'exact' })
      .range(from, to)
      .order('part_num', { ascending: true })

    if (error) throw error

    totalCount.value = count || 0
    totalParts.value = count || 0

    // 통계 정보 조회 (한 번만) - element_id 기준으로 정확한 비교
    if (page === 1) {
      try {
        // 1. 총 부품 수: set_parts 테이블의 고유한 element_id 개수 (정확한 비교를 위해)
        let totalElementIds = 0
        let totalElementIdsOffset = 0
        const totalElementIdsLimit = 1000
        const totalElementIdsSet = new Set()
        
        while (true) {
          const { data: setPartsData, error: setPartsError } = await supabase
            .from('set_parts')
            .select('element_id')
            .not('element_id', 'is', null)
            .range(totalElementIdsOffset, totalElementIdsOffset + totalElementIdsLimit - 1)
          
          if (setPartsError) {
            console.warn('set_parts 조회 실패, lego_parts 기준으로 대체:', setPartsError)
            break
          }
          
          if (!setPartsData || setPartsData.length === 0) {
            break
          }
          
          setPartsData.forEach(sp => {
            if (sp.element_id) {
              totalElementIdsSet.add(String(sp.element_id))
            }
          })
          
          if (setPartsData.length < totalElementIdsLimit) {
            break
          }
          
          totalElementIdsOffset += totalElementIdsLimit
        }
        
        totalElementIds = totalElementIdsSet.size
        
        // element_id가 없으면 lego_parts 기준으로 대체 (하위 호환성)
        if (totalElementIds === 0) {
          totalElementIds = count || 0
        }
        
        // 2. 이미지 등록 수: part_images 테이블의 고유한 element_id 개수 (WebP만)
        let allPartImages = []
        let partImagesOffset = 0
        const partImagesLimit = 1000
        
        while (true) {
          const { data: partImagesBatch, error: partImagesError } = await supabase
            .from('part_images')
            .select('element_id, uploaded_url')
            .not('uploaded_url', 'is', null)
            .range(partImagesOffset, partImagesOffset + partImagesLimit - 1)
          
          if (partImagesError) {
            console.error('part_images 조회 실패:', partImagesError)
            break
          }
          
          if (!partImagesBatch || partImagesBatch.length === 0) {
            break
          }
          
          allPartImages = allPartImages.concat(partImagesBatch)
          
          if (partImagesBatch.length < partImagesLimit) {
            break
          }
          
          partImagesOffset += partImagesLimit
        }
        
        const uniqueElementIdsWithImages = new Set()
        if (allPartImages.length > 0) {
          allPartImages.forEach(img => {
            // WebP 파일만 카운트하고 element_id가 있는 것만
            if (img.element_id && img.uploaded_url && 
                (img.uploaded_url.endsWith('.webp') || img.uploaded_url.includes('.webp'))) {
              uniqueElementIdsWithImages.add(String(img.element_id))
            }
          })
        }
        
        // 3. 메타데이터가 있는 고유한 부품 수 (part_id 기준, 하위 호환성)
        const { data: allMetadata, error: allMetadataError } = await supabase
          .from('parts_master_features')
          .select('part_id')
        
        let uniquePartIdsWithMetadata = 0
        if (allMetadata && !allMetadataError) {
          const uniqueSet = new Set()
          allMetadata.forEach(m => {
            if (m.part_id) {
              uniqueSet.add(m.part_id)
            }
          })
          uniquePartIdsWithMetadata = uniqueSet.size
        }
        
        // 통계 업데이트 (element_id 기준)
        totalParts.value = totalElementIds // element_id 기준 총 부품 수
        partsWithImages.value = uniqueElementIdsWithImages.size // element_id 기준 이미지 등록 수
        partsWithMetadata.value = uniquePartIdsWithMetadata // part_id 기준 메타데이터 (하위 호환성)
        
        console.log(`[PartManager] 통계 (element_id 기준): 총 ${totalElementIds}개, 이미지 ${uniqueElementIdsWithImages.size}개`)
      } catch (err) {
        console.error('통계 정보 조회 실패:', err)
        // 오류 발생 시 기본값 유지
      }
    }

    if (!data || data.length === 0) {
      parts.value = []
      return
    }

    // 부품 번호 목록
    const partNums = data.map(p => p.part_num)
    
    // 배치로 통계 정보 조회 (N+1 쿼리 문제 해결)
    const [colorCountsResult, setCountsResult, metadataPartsResult, partImagesResult, elementIdsResult, noElementIdsResult] = await Promise.all([
      // 색상 수 (부품별)
      supabase
        .from('set_parts')
        .select('part_id, color_id')
        .in('part_id', partNums),
      // 세트 수 (부품별)
      supabase
        .from('set_parts')
        .select('part_id, set_id')
        .in('part_id', partNums),
      // 메타데이터 존재 여부
      supabase
        .from('parts_master_features')
        .select('part_id')
        .in('part_id', partNums),
      // 이미지 URL (배치 조회)
      supabase
        .from('part_images')
        .select('part_id, uploaded_url, element_id, color_id')
        .in('part_id', partNums)
        .not('uploaded_url', 'is', null),
      // element_id 및 색상 정보 조회 (부품별)
      fetchSetPartColorData(partNums, { requireElementId: true }),
      // element_id가 없는 부품의 색상 정보 조회
      fetchSetPartColorData(partNums, { requireElementId: false })
    ])

    // 통계 정보를 Map으로 변환
    const colorCountMap = new Map()
    const setCountMap = new Map()
    const metadataSet = new Set()
    const imageUrlMap = new Map()
    const elementIdMap = new Map() // 부품별 첫 번째 element_id

    if (colorCountsResult.data) {
      colorCountsResult.data.forEach(sp => {
        const count = colorCountMap.get(sp.part_id) || 0
        colorCountMap.set(sp.part_id, count + 1)
      })
    }

    if (setCountsResult.data) {
      setCountsResult.data.forEach(sp => {
        const count = setCountMap.get(sp.part_id) || 0
        setCountMap.set(sp.part_id, count + 1)
      })
    }

    if (metadataPartsResult.data) {
      metadataPartsResult.data.forEach(m => metadataSet.add(m.part_id))
    }

    if (partImagesResult.data) {
      partImagesResult.data.forEach(img => {
        if (img.uploaded_url && (img.uploaded_url.endsWith('.webp') || img.uploaded_url.includes('.webp'))) {
          if (!imageUrlMap.has(img.part_id)) {
            imageUrlMap.set(img.part_id, img.uploaded_url)
          }
        }
      })
    }

    const elementColorMap = new Map() // part_id -> { element_id, color_id, color_name, color_rgb }
    
    // 1단계: part_images에서 실제 이미지가 있는 element_id를 먼저 수집 (우선순위)
    const partImagesElementMap = new Map() // part_id -> element_id (실제 이미지가 있는)
    if (partImagesResult.data) {
      partImagesResult.data.forEach(img => {
        if (img.element_id && img.uploaded_url && 
            (img.uploaded_url.endsWith('.webp') || img.uploaded_url.includes('.webp'))) {
          if (!partImagesElementMap.has(img.part_id)) {
            partImagesElementMap.set(img.part_id, String(img.element_id))
          }
        }
      })
    }
    
    // 2단계: set_parts에서 색상 정보 매핑 (이미지가 있는 element_id 우선)
    if (Array.isArray(elementIdsResult) && elementIdsResult.length > 0) {
      // 먼저 이미지가 있는 element_id의 색상 정보를 찾아서 저장
      elementIdsResult.forEach(sp => {
        if (sp.element_id) {
          const imageElementId = partImagesElementMap.get(sp.part_id)
          // 이미지가 있는 element_id와 일치하면 우선 저장
          if (imageElementId && String(sp.element_id) === imageElementId && !elementColorMap.has(sp.part_id)) {
            elementColorMap.set(sp.part_id, {
              element_id: String(sp.element_id),
              color_id: sp.color_id,
              color_name: sp.lego_colors?.name || null,
              color_rgb: sp.lego_colors?.rgb || null
            })
          }
        }
      })
      
      // 이미지가 없는 부품은 첫 번째 element_id 사용 (기존 로직)
      elementIdsResult.forEach(sp => {
        if (!elementColorMap.has(sp.part_id) && sp.element_id) {
          elementColorMap.set(sp.part_id, {
            element_id: String(sp.element_id),
            color_id: sp.color_id,
            color_name: sp.lego_colors?.name || null,
            color_rgb: sp.lego_colors?.rgb || null
          })
        }
      })
    }
    
    // 3단계: element_id 정보가 없는 부품에 대해 part_images에서 element_id 추출
    if (partImagesResult.data) {
      partImagesResult.data.forEach(img => {
        if (!elementColorMap.has(img.part_id) && img.element_id) {
          elementColorMap.set(img.part_id, {
            element_id: String(img.element_id),
            color_id: typeof img.color_id === 'number' ? img.color_id : null,
            color_name: null,
            color_rgb: null
          })
        }
      })
    }

    // element_id가 없는 부품의 색상 정보 매핑
    if (Array.isArray(noElementIdsResult) && noElementIdsResult.length > 0) {
      noElementIdsResult.forEach(sp => {
        if (!elementColorMap.has(sp.part_id)) {
          elementColorMap.set(sp.part_id, {
            element_id: null,
            color_id: sp.color_id,
            color_name: sp.lego_colors?.name || null,
            color_rgb: sp.lego_colors?.rgb || null
          })
        }
      })
    }

    // 부품 데이터 구성 (비동기 이미지 URL 조회 포함)
    const partsWithStats = await Promise.all(
      data.map(async (part) => {
        // 카테고리 이름 조회 (캐시 사용)
        let categoryName = null
        if (part.part_cat_id) {
          if (categoryCache.value.has(part.part_cat_id)) {
            categoryName = categoryCache.value.get(part.part_cat_id)
          }
        }

        const elementColorInfo = elementColorMap.get(part.part_num) || null
        
        // 이미지 URL (element_id 기준으로 조회)
        let imageUrl = ''
        let imageSource = ''
        let finalColorInfo = elementColorInfo
        
        if (elementColorInfo?.element_id) {
          // element_id로 색상 정보 먼저 조회 (정확한 색상 정보 확인)
          const colorInfo = await getColorInfoFromElementId(elementColorInfo.element_id)
          if (colorInfo) {
            finalColorInfo = {
              ...elementColorInfo,
              color_id: colorInfo.color_id,
              color_name: colorInfo.color_name,
              color_rgb: colorInfo.color_rgb
            }
            
            // element_id와 color_id를 함께 사용하여 이미지 조회 (정확한 색상 매칭)
            try {
              const { data: partImageWithColor, error: colorImageError } = await supabase
                .from('part_images')
                .select('uploaded_url')
                .eq('element_id', String(elementColorInfo.element_id))
                .eq('color_id', colorInfo.color_id)
                .not('uploaded_url', 'is', null)
                .maybeSingle()
              
              if (!colorImageError && partImageWithColor?.uploaded_url) {
                const url = partImageWithColor.uploaded_url
                if (url.endsWith('.webp') || url.includes('.webp')) {
                  imageUrl = url
                  imageSource = 'element'
                }
              }
              
              // element_id + color_id로 찾지 못한 경우 element_id만으로 조회 (fallback)
              if (!imageUrl) {
                const elementImageUrl = await getColorPartImageUrlByElementId(elementColorInfo.element_id)
                if (elementImageUrl && (elementImageUrl.endsWith('.webp') || elementImageUrl.includes('.webp'))) {
                  imageUrl = elementImageUrl
                  imageSource = 'element'
                }
              }
            } catch (err) {
              // 조용히 무시
            }
          } else {
            // 색상 정보를 찾지 못한 경우 element_id만으로 이미지 조회
            try {
              const elementImageUrl = await getColorPartImageUrlByElementId(elementColorInfo.element_id)
              if (elementImageUrl && (elementImageUrl.endsWith('.webp') || elementImageUrl.includes('.webp'))) {
                imageUrl = elementImageUrl
                imageSource = 'element'
              }
            } catch (err) {
              // 조용히 무시
            }
          }
        }
        
        // element_id로 찾지 못한 경우 part_id로 fallback
        if (!imageUrl) {
          let fallbackUrl = imageUrlMap.get(part.part_num) || ''
          if (fallbackUrl && !fallbackUrl.endsWith('.webp') && !fallbackUrl.includes('.webp')) {
            fallbackUrl = ''
          }
          if (fallbackUrl) {
            imageUrl = fallbackUrl
            imageSource = 'part'
          }
        }
        
        return {
          ...part,
          color_count: colorCountMap.get(part.part_num) || 0,
          set_count: setCountMap.get(part.part_num) || 0,
          hasMetadata: metadataSet.has(part.part_num),
          category_name: categoryName,
          imageUrl: imageUrl || '',
          imageSource,
          element_id: finalColorInfo?.element_id || null,
          color_id: finalColorInfo?.color_id || null,
          color_name: finalColorInfo?.color_name || null,
          color_rgb: finalColorInfo?.color_rgb || null,
          needsElementImage: Boolean(finalColorInfo?.element_id && imageSource === 'part'),
          reuploading: false,
          reuploadMessage: '',
          reuploadError: ''
        }
      })
    )

    parts.value = partsWithStats
  } catch (err) {
    console.error('부품 로드 실패:', err)
  } finally {
    loading.value = false
  }
}

// 파트 카드에서 엘리먼트 이미지 재등록 버튼 노출 조건
const canReuploadElementImage = (part) => {
  if (!part) return false
  return Boolean(part.element_id && part.needsElementImage)
}

// 단일 부품 이미지를 element_id 기반으로 재등록
const reRegisterImageWithElement = async (part, event = null) => {
  if (event) {
    event.stopPropagation()
  }
  if (!part || !part.element_id || part.reuploading) return
  
  part.reuploading = true
  part.reuploadError = ''
  part.reuploadMessage = ''
  
  try {
    const elementData = await getElement(part.element_id)
    const imageUrl = elementData?.element_img_url || elementData?.part_img_url || null
    if (!imageUrl) {
      throw new Error('Rebrickable에서 이미지 URL을 찾을 수 없습니다.')
    }
    
    // Element ID는 색상 정보를 포함하므로, API에서 가져온 색상 정보를 사용 (핵심 수정)
    let effectiveColorId = part.color_id
    if (elementData?.color?.id) {
      effectiveColorId = elementData.color.id
      console.log(`✅ element_id ${part.element_id}의 실제 색상: ${elementData.color.name} (ID: ${effectiveColorId})`)
      
      // 색상 불일치 감지 및 경고
      if (effectiveColorId !== part.color_id) {
        console.warn(`⚠️ 색상 불일치 감지: part.color_id=${part.color_id}, elementData.color.id=${effectiveColorId}`)
        console.warn(`⚠️ element_id 기반 색상(${effectiveColorId})을 사용합니다.`)
      }
      
      // part 객체 업데이트
      part.color_id = effectiveColorId
      part.color_name = elementData.color.name
      part.color_rgb = elementData.color.rgb
    } else if (effectiveColorId === null || effectiveColorId === undefined) {
      // elementData에 color 정보가 없으면 기존 방식 사용
      const colorInfo = await getColorInfoFromElementId(part.element_id)
      if (!colorInfo || colorInfo.color_id === null || colorInfo.color_id === undefined) {
        throw new Error('색상 정보를 찾을 수 없습니다.')
      }
      effectiveColorId = colorInfo.color_id
      part.color_id = colorInfo.color_id
      part.color_name = colorInfo.color_name
      part.color_rgb = colorInfo.color_rgb
    }
    
    const normalizedColorId = typeof effectiveColorId === 'number' ? effectiveColorId : parseInt(effectiveColorId, 10)
    if (Number.isNaN(normalizedColorId)) {
      throw new Error('유효한 색상 ID가 없습니다.')
    }
    
    const result = await processRebrickableImage(
      imageUrl,
      part.part_num,
      normalizedColorId,
      {
        elementId: part.element_id,
        forceUpload: true
      }
    )
    
    if (!result?.uploadedUrl) {
      throw new Error('이미지 업로드에 실패했습니다.')
    }
    
    await upsertPartImage({
      partNum: part.part_num,
      colorId: normalizedColorId,
      uploadedUrl: result.uploadedUrl,
      filename: result.filename,
      elementId: part.element_id
    })
    
    part.imageUrl = result.uploadedUrl
    part.imageSource = 'element'
    part.needsElementImage = false
    part.reuploadMessage = '재등록 완료'
    
    setTimeout(() => {
      part.reuploadMessage = ''
    }, 3000)
  } catch (err) {
    part.reuploadError = err?.message || '재등록 실패'
  } finally {
    part.reuploading = false
  }
}

// 부품 선택
const selectPart = (part) => {
  viewPartDetails(part)
}

// element_id로 색상 정보 조회 (set_parts에서)
const getColorInfoFromElementId = async (elementId) => {
  if (!elementId) return null
  
  try {
    const { data: setPart, error } = await supabase
      .from('set_parts')
      .select('color_id, lego_colors(name, rgb)')
      .eq('element_id', String(elementId))
      .limit(1)
      .maybeSingle()
    
    if (error || !setPart) return null
    
    return {
      color_id: setPart.color_id,
      color_name: setPart.lego_colors?.name || null,
      color_rgb: setPart.lego_colors?.rgb || null
    }
  } catch (err) {
    console.error('getColorInfoFromElementId 오류:', err)
    return null
  }
}

// 부품 상세 정보 조회 (element_id 기준으로 색상 정보 처리)
const viewPartDetails = async (part) => {
  try {
    selectedPartDetail.value = part

    // element_id별 정보 조회 (element_id가 고유 색상 정보를 포함)
    const { data: setPartsData } = await supabase
      .from('set_parts')
      .select('color_id, element_id, set_id')
      .eq('part_id', part.part_num)
      .not('element_id', 'is', null)

    if (setPartsData) {
      // element_id별로 그룹화 (같은 element_id는 같은 color_id를 가짐)
      const elementIdMap = new Map() // element_id -> { color_id, set_count, set_ids }
      const setIds = new Set()

      setPartsData.forEach(sp => {
        setIds.add(sp.set_id)
        const eid = String(sp.element_id)
        
        if (!elementIdMap.has(eid)) {
          elementIdMap.set(eid, {
            element_id: eid,
            color_id: sp.color_id,
            set_count: 0,
            set_ids: new Set()
          })
        }
        elementIdMap.get(eid).set_count++
        elementIdMap.get(eid).set_ids.add(sp.set_id)
      })

      // element_id별 색상 정보 조회 (set_parts에서 color_id 가져오기)
      const elementIds = Array.from(elementIdMap.keys())
      const { data: setPartsWithColors } = await supabase
        .from('set_parts')
        .select('element_id, color_id, lego_colors(name, rgb)')
        .in('element_id', elementIds)
        .not('element_id', 'is', null)

      // 색상 정보 매핑 생성
      const colorInfoMap = new Map()
      if (setPartsWithColors) {
        setPartsWithColors.forEach(sp => {
          const eid = String(sp.element_id)
          if (!colorInfoMap.has(eid)) {
            colorInfoMap.set(eid, {
              color_id: sp.color_id,
              color_name: sp.lego_colors?.name || null,
              color_rgb: sp.lego_colors?.rgb || null
            })
          }
        })
      }

      // 색상별 정보 배열 생성 (element_id 기준, 최대 20개로 제한)
      const limitedElementIds = elementIds.slice(0, 20)
      partColors.value = await Promise.all(
        limitedElementIds.map(async (elementId) => {
          const elementInfo = elementIdMap.get(elementId)
          const colorInfo = colorInfoMap.get(elementId) || { color_id: elementInfo.color_id, color_name: null, color_rgb: null }
          
          try {
            // 이미지 URL 조회 (element_id + color_id 함께 사용하여 정확한 색상 매칭)
            let imageUrl = null
            
            // element_id + color_id로 먼저 조회
            if (colorInfo.color_id !== null && colorInfo.color_id !== undefined) {
              try {
                const { data: partImageWithColor, error: colorImageError } = await supabase
                  .from('part_images')
                  .select('uploaded_url')
                  .eq('element_id', String(elementId))
                  .eq('color_id', colorInfo.color_id)
                  .not('uploaded_url', 'is', null)
                  .maybeSingle()
                
                if (!colorImageError && partImageWithColor?.uploaded_url) {
                  const url = partImageWithColor.uploaded_url
                  if (url.endsWith('.webp') || url.includes('.webp')) {
                    imageUrl = url
                  }
                }
              } catch (colorQueryErr) {
                // 조용히 무시
              }
            }
            
            // element_id + color_id로 찾지 못한 경우 element_id만으로 조회 (fallback)
            if (!imageUrl) {
              try {
                imageUrl = await Promise.race([
                  getColorPartImageUrlByElementId(elementId),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                ])
              } catch (fallbackErr) {
                // 타임아웃이나 오류 시 무시
              }
            }
            
            return {
              element_id: elementId,
              color_id: colorInfo.color_id,
              color_name: colorInfo.color_name || `색상 ${colorInfo.color_id}`,
              color_rgb: colorInfo.color_rgb,
              set_count: elementInfo.set_count,
              imageUrl: imageUrl || ''
            }
          } catch (err) {
            // 타임아웃이나 오류 시 기본값 반환
            return {
              element_id: elementId,
              color_id: colorInfo.color_id,
              color_name: colorInfo.color_name || `색상 ${colorInfo.color_id}`,
              color_rgb: colorInfo.color_rgb,
              set_count: elementInfo.set_count,
              imageUrl: ''
            }
          }
        })
      )
      
      if (elementIds.length > 20) {
        console.warn(`element_id가 너무 많아 처음 20개만 표시합니다. (전체: ${elementIds.length}개)`)
      }

      // 포함된 세트 정보 조회
      const { data: setsData } = await supabase
        .from('lego_sets')
        .select('id, set_num, name, set_img_url')
        .in('id', Array.from(setIds))

      partSets.value = setsData || []
    }

    // 메타데이터 조회
    const { data: metadataData } = await supabase
      .from('parts_master_features')
      .select('feature_json, recognition_hints')
      .eq('part_id', part.part_num)
      .maybeSingle()

    if (metadataData) {
      const featureJson = typeof metadataData.feature_json === 'string' 
        ? JSON.parse(metadataData.feature_json) 
        : metadataData.feature_json
      
      partMetadata.value = {
        ...featureJson,
        recognition_hints: metadataData.recognition_hints
      }
    } else {
      partMetadata.value = null
    }
  } catch (err) {
    console.error('부품 상세 정보 조회 실패:', err)
  }
}

// 부품 이미지 URL (WebP만 반환, 이미지 등록 여부 확인을 위해)
const getPartImageUrl = async (part) => {
  if (!part || !part.part_num) return ''
  
  // 1. Supabase Storage에서 기본 부품 이미지 확인 (color_id=0 또는 첫 번째 색상)
  try {
    // part_images 테이블에서 기본 이미지 확인
    const { data: partImage } = await supabase
      .from('part_images')
      .select('uploaded_url')
      .eq('part_id', part.part_num)
      .not('uploaded_url', 'is', null)
      .limit(1)
      .maybeSingle()
    
    if (partImage?.uploaded_url) {
      const url = partImage.uploaded_url
      // WebP 파일만 반환
      if (url.endsWith('.webp') || url.includes('.webp')) {
        return url
      }
      // WebP가 아니면 빈 문자열 반환 (이미지 미등록)
    }
    
    // image_metadata 테이블에서 확인
    const { data: imageMetadata } = await supabase
      .from('image_metadata')
      .select('supabase_url')
      .eq('part_num', part.part_num)
      .not('supabase_url', 'is', null)
      .limit(1)
      .maybeSingle()
    
    if (imageMetadata?.supabase_url) {
      const url = imageMetadata.supabase_url
      // WebP 파일만 반환
      if (url.endsWith('.webp') || url.includes('.webp')) {
        return url
      }
    }
  } catch (err) {
    // 조용히 무시
  }
  
  // 2. getSupabaseImageUrl로 추가 확인
  try {
    const supabaseUrl = await getSupabaseImageUrl(part.part_num, 0, null)
    // WebP 파일만 반환
    if (supabaseUrl && (supabaseUrl.endsWith('.webp') || supabaseUrl.includes('.webp'))) {
      return supabaseUrl
    }
  } catch (err) {
    // 조용히 무시
  }
  
  // WebP가 아니면 빈 문자열 반환 (이미지 미등록으로 표시)
  return ''
}

// element_id만으로 이미지 URL 조회 (element_id가 고유 색상 정보를 포함)
// element_id는 고유하므로, set_parts에서 정확한 color_id를 가져와서 함께 조회
const getColorPartImageUrlByElementId = async (elementId) => {
  if (!elementId) return null
  
  try {
    // 1. set_parts에서 element_id의 정확한 color_id 조회 (element_id는 고유하므로 하나만 나옴)
    const { data: setPart, error: setPartError } = await supabase
      .from('set_parts')
      .select('color_id')
      .eq('element_id', String(elementId))
      .limit(1)
      .maybeSingle()
    
    const correctColorId = setPart?.color_id
    
    // 2. part_images에서 element_id + color_id로 정확한 색상 이미지 조회
    if (correctColorId !== null && correctColorId !== undefined) {
      const { data: partImage, error } = await supabase
        .from('part_images')
        .select('uploaded_url')
        .eq('element_id', String(elementId))
        .eq('color_id', correctColorId)
        .not('uploaded_url', 'is', null)
        .maybeSingle()
      
      if (!error && partImage?.uploaded_url) {
        // WebP 파일만 반환
        if (partImage.uploaded_url.endsWith('.webp') || partImage.uploaded_url.includes('.webp')) {
          return partImage.uploaded_url
        }
      }
    }
    
    // 3. element_id + color_id로 찾지 못한 경우, set_parts의 정확한 color_id와 일치하는 이미지만 조회
    // (같은 element_id로 여러 color_id가 저장되어 있을 수 있으므로, 정확한 color_id와 일치하는 것만 선택)
    if (correctColorId !== null && correctColorId !== undefined) {
      // element_id만으로 조회하되, 여러 개가 나오면 정확한 color_id와 일치하는 것만 선택
      const { data: partImageFallback, error: fallbackError } = await supabase
        .from('part_images')
        .select('uploaded_url, color_id')
        .eq('element_id', String(elementId))
        .eq('color_id', correctColorId) // 정확한 color_id와 일치하는 것만
        .not('uploaded_url', 'is', null)
        .maybeSingle()
      
      if (!fallbackError && partImageFallback?.uploaded_url) {
        // WebP 파일만 반환
        if (partImageFallback.uploaded_url.endsWith('.webp') || partImageFallback.uploaded_url.includes('.webp')) {
          return partImageFallback.uploaded_url
        }
      }
    }
    
    // 4. image_metadata에서 element_id로 조회
    const { data: imageMetadata, error: metadataError } = await supabase
      .from('image_metadata')
      .select('supabase_url')
      .eq('element_id', String(elementId))
      .not('supabase_url', 'is', null)
      .maybeSingle()
    
    if (!metadataError && imageMetadata?.supabase_url) {
      if (imageMetadata.supabase_url.endsWith('.webp') || imageMetadata.supabase_url.includes('.webp')) {
        return imageMetadata.supabase_url
      }
    }
    
    return null
  } catch (err) {
    console.error('getColorPartImageUrlByElementId 오류:', err)
    return null
  }
}

// 하위 호환성을 위한 함수 (기존 코드에서 사용 중)
const getColorPartImageUrl = async (partNum, colorId, elementId) => {
  // element_id가 있으면 element_id만 사용
  if (elementId) {
    return await getColorPartImageUrlByElementId(elementId)
  }
  
  // element_id가 없으면 기존 방식 (partNum + colorId)
  let url = null
  url = await getSupabaseImageUrl(partNum, colorId, null)
  
  // WebP 파일만 반환
  if (url && (url.endsWith('.webp') || url.includes('.webp'))) {
    return url
  }
  
  return ''
}

// 색상명 포맷팅 (No Color/Any Color -> Any Color)
const formatColorName = (colorName) => {
  if (!colorName) return null
  const name = String(colorName).trim()
  const lowerName = name.toLowerCase()
  // No Color, Any Color, No Color/Any Color 등을 모두 Any Color로 변환
  // 슬래시, 공백 등 다양한 형태 처리
  if (lowerName === 'no color' || 
      lowerName === 'any color' || 
      (lowerName.includes('no color') && lowerName.includes('any color'))) {
    return 'Any Color'
  }
  // 원본이 "No Color/Any Color" 형태인 경우도 처리
  if (name.includes('No Color') && name.includes('Any Color')) {
    return 'Any Color'
  }
  return name
}

// RGB 색상 포맷팅 (SetParts와 동일)
const getColorRgb = (rgb) => {
  if (!rgb) return null
  let rgbStr = String(rgb).trim()
  if (!rgbStr || rgbStr === 'null' || rgbStr === 'undefined' || rgbStr === 'None') {
    return null
  }
  if (!rgbStr.startsWith('#')) {
    rgbStr = `#${rgbStr}`
  }
  return rgbStr.length === 7 ? rgbStr.toUpperCase() : null
}

const getColorTextColor = (rgb) => {
  if (!rgb) return '#ffffff'
  let rgbStr = String(rgb).trim()
  if (!rgbStr || rgbStr === 'null' || rgbStr === 'undefined' || rgbStr === 'None') {
    return '#ffffff'
  }
  if (!rgbStr.startsWith('#')) {
    rgbStr = `#${rgbStr}`
  }
  
  // 화이트 색상 판단 (#FFFFFF, #ffffff, FFFFFF 등)
  const normalized = rgbStr.toUpperCase()
  if (normalized === '#FFFFFF' || normalized === '#FFF' || normalized === 'FFFFFF' || normalized === 'FFF') {
    return '#6b7280' // 그레이
  }
  
  // RGB 값으로 화이트 판단 (255, 255, 255에 가까운 경우)
  if (normalized.length === 7 && normalized.startsWith('#')) {
    const r = parseInt(normalized.substring(1, 3), 16)
    const g = parseInt(normalized.substring(3, 5), 16)
    const b = parseInt(normalized.substring(5, 7), 16)
    
    // 밝기가 240 이상이면 화이트로 간주
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    if (brightness >= 240) {
      return '#6b7280' // 그레이
    }
  }
  
  return '#ffffff' // 기본값 (흰색 텍스트)
}

// 이미지 오류 처리 (무한 반복 방지)
const handleImageError = (event) => {
  const img = event.target
  // 이미 처리된 경우 무시 (무한 반복 방지)
  if (img.dataset.errorHandled === 'true') {
    img.style.display = 'none'
    return
  }
  
  // 첫 번째 오류 시 이미지 숨김
  img.dataset.errorHandled = 'true'
  img.style.display = 'none'
  
  // 부모 요소에 placeholder 표시
  const wrapper = img.closest('.color-image-wrapper, .part-image-wrapper')
  if (wrapper) {
    let placeholder = wrapper.querySelector('.no-image-placeholder')
    if (!placeholder) {
      placeholder = document.createElement('div')
      placeholder.className = 'no-image-placeholder'
      placeholder.textContent = '이미지 없음'
      wrapper.appendChild(placeholder)
    }
    placeholder.style.display = 'flex'
  }
}

// 카테고리 필터
const filterByCategory = () => {
  searchParts()
}

// 카테고리 목록 로드
const loadCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('part_categories')
      .select('id, display_name_ko, display_name, code')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('카테고리 로드 실패:', error)
      return
    }
    
    // 카테고리 목록 설정
    categories.value = (data || []).map(cat => ({
      id: cat.id,
      name: cat.display_name_ko || cat.display_name || cat.code || `카테고리 ${cat.id}`,
      code: cat.code
    }))
    
    // 캐시에도 저장
    data.forEach(cat => {
      const name = cat.display_name_ko || cat.display_name || cat.code || null
      if (name) {
        categoryCache.value.set(cat.id, name)
      }
    })
  } catch (err) {
    console.error('카테고리 로드 실패:', err)
  }
}

// 모달 닫기
const closePartDetail = () => {
  selectedPartDetail.value = null
  partColors.value = []
  partSets.value = []
  partMetadata.value = null
}

// 세트로 이동
const goToSet = (setNum) => {
  router.push(`/set-parts?set=${setNum}`)
}

// 누락 이미지 재등록 관련 함수
const checkMissingImages = async (mode = 'missing') => {
  try {
    if (syncingMissingImages.value) return
    
    let modeLabel = '누락 이미지 재등록'
    if (mode === 'all') {
      modeLabel = '전체 강제 재등록'
    } else if (mode === 'part') {
      modeLabel = '엘리먼트 이미지로 재등록'
    }
    
    syncingMissingImages.value = true
    showSyncModal.value = true
    syncError.value = null
    syncResults.value = { success: 0, failed: 0 }
    
    console.log(`[PartManager] ${modeLabel} 작업 준비 중...`)
    
    const targetElementItems = await collectElementReuploadTargets(mode)
    
    if (mode === 'missing') {
      missingImagesCount.value = targetElementItems.length
    }
    
    if (targetElementItems.length === 0) {
      syncError.value = mode === 'missing'
        ? '누락된 이미지가 없습니다.'
        : mode === 'part'
          ? '현재 페이지에서 엘리먼트 이미지 재등록 버튼이 표시된 부품이 없습니다.'
          : '재등록할 대상이 없습니다.'
      syncingMissingImages.value = false
      return
    }
    
    syncProgress.value = {
      current: 0,
      total: targetElementItems.length,
      currentItem: null
    }
    
    const batchSize = 2
    let rateLimitDetected = false
    const forceUpload = mode !== 'missing'
    
    for (let i = 0; i < targetElementItems.length; i += batchSize) {
      const batch = targetElementItems.slice(i, i + batchSize)
      
      if (rateLimitDetected && i > 0) {
        console.log(`[PartManager] Rate limit 감지됨, 5초 대기 후 계속...`)
        syncProgress.value.currentItem = `Rate limit 대기 중...`
        await new Promise(resolve => setTimeout(resolve, 5000))
        rateLimitDetected = false
      } else if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      await Promise.allSettled(
        batch.map(async (item, batchIndex) => {
          try {
            syncProgress.value.currentItem = item.element_id
            
            const elementData = await getElement(item.element_id)
            let imageUrl = null
            if (elementData?.element_img_url) {
              imageUrl = elementData.element_img_url
            } else if (elementData?.part_img_url) {
              imageUrl = elementData.part_img_url
            }
            
            if (!imageUrl) {
              throw new Error('이미지 URL을 찾을 수 없습니다.')
            }
            
            // Element ID는 색상 정보를 포함하므로, API에서 가져온 색상 정보를 사용 (핵심 수정)
            let effectiveColorId = item.color_id
            if (elementData?.color?.id) {
              effectiveColorId = elementData.color.id
              console.log(`✅ element_id ${item.element_id}의 실제 색상: ${elementData.color.name} (ID: ${effectiveColorId})`)
              
              // 색상 불일치 감지 및 경고
              if (effectiveColorId !== item.color_id) {
                console.warn(`⚠️ 색상 불일치 감지: item.color_id=${item.color_id}, elementData.color.id=${effectiveColorId}`)
                console.warn(`⚠️ element_id 기반 색상(${effectiveColorId})을 사용합니다.`)
              }
            }
            
            const result = await processRebrickableImage(
              imageUrl,
              item.part_id,
              effectiveColorId, // element_id 기반 색상 사용 (핵심 수정)
              {
                elementId: item.element_id,
                forceUpload
              }
            )
            
            if (result.uploadedUrl) {
              await upsertPartImage({
                partNum: item.part_id,
                colorId: effectiveColorId, // element_id 기반 색상 사용 (핵심 수정)
                uploadedUrl: result.uploadedUrl,
                filename: result.filename,
                elementId: item.element_id
              })
              
              syncResults.value.success++
              console.log(`[PartManager] ✅ element_id ${item.element_id} 재등록 완료 (${i + batchIndex + 1}/${targetElementItems.length}) [${modeLabel}]`)
            } else {
              throw new Error('이미지 업로드 실패')
            }
          } catch (err) {
            console.error(`[PartManager] ❌ element_id ${item.element_id} 재등록 실패 (${modeLabel}):`, err)
            
            const errorMessage = err.message || err.toString() || ''
            if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('Rate limit')) {
              rateLimitDetected = true
            }
            
            syncResults.value.failed++
          } finally {
            syncProgress.value.current++
          }
        })
      )
    }
    
    console.log(`[PartManager] ${modeLabel} 완료: 성공 ${syncResults.value.success}개, 실패 ${syncResults.value.failed}개`)
    
    await loadStats()
    if (mode === 'part') {
      await loadAllParts(currentPage.value)
    }
    
  } catch (err) {
    console.error('[PartManager] 누락 이미지 재등록 오류:', err)
    syncError.value = err.message || '알 수 없는 오류가 발생했습니다.'
  } finally {
    syncingMissingImages.value = false
  }
}

const closeSyncModal = () => {
  if (!syncingMissingImages.value) {
    showSyncModal.value = false
    syncProgress.value = { current: 0, total: 0, currentItem: null }
    syncResults.value = { success: 0, failed: 0 }
    syncError.value = null
  }
}

onMounted(async () => {
  await loadAllParts()
  await loadCategories()
  
  // 누락 이미지 개수 조회 (비동기, 백그라운드)
  checkMissingImagesCount()
})

const loadStats = async () => {
  await checkMissingImagesCount()
}

// 누락 이미지 개수만 조회 (재등록 없이) - loadStats와 동일한 로직 사용
const checkMissingImagesCount = async () => {
  try {
    // 1. set_parts에서 element_id가 있는 고유 개수 (loadStats와 동일)
    const totalElementIdsSet = new Set()
    let totalElementIdsOffset = 0
    const totalElementIdsLimit = 1000
    
    while (true) {
      const { data: setPartsData, error: setPartsError } = await supabase
        .from('set_parts')
        .select('element_id')
        .not('element_id', 'is', null)
        .range(totalElementIdsOffset, totalElementIdsOffset + totalElementIdsLimit - 1)
      
      if (setPartsError) {
        console.error('누락 이미지 개수 조회 실패 (set_parts):', setPartsError)
        break
      }
      
      if (!setPartsData || setPartsData.length === 0) {
        break
      }
      
      setPartsData.forEach(sp => {
        if (sp.element_id) {
          totalElementIdsSet.add(String(sp.element_id))
        }
      })
      
      if (setPartsData.length < totalElementIdsLimit) {
        break
      }
      
      totalElementIdsOffset += totalElementIdsLimit
    }
    
    const totalElementIds = totalElementIdsSet.size
    
    // 2. part_images에서 element_id가 있고 uploaded_url이 있고 WebP인 고유 개수 (loadStats와 동일)
    let allPartImages = []
    let partImagesOffset = 0
    const partImagesLimit = 1000
    
    while (true) {
      const { data: partImagesBatch, error: partImagesError } = await supabase
        .from('part_images')
        .select('element_id, uploaded_url')
        .not('uploaded_url', 'is', null)
        .range(partImagesOffset, partImagesOffset + partImagesLimit - 1)
      
      if (partImagesError) {
        console.error('누락 이미지 개수 조회 실패 (part_images):', partImagesError)
        break
      }
      
      if (!partImagesBatch || partImagesBatch.length === 0) {
        break
      }
      
      allPartImages = allPartImages.concat(partImagesBatch)
      
      if (partImagesBatch.length < partImagesLimit) {
        break
      }
      
      partImagesOffset += partImagesLimit
    }
    
    const uniqueElementIdsWithImages = new Set()
    if (allPartImages.length > 0) {
      allPartImages.forEach(img => {
        // WebP 파일만 카운트하고 element_id가 있는 것만 (loadStats와 동일)
        if (img.element_id && img.uploaded_url && 
            (img.uploaded_url.endsWith('.webp') || img.uploaded_url.includes('.webp'))) {
          uniqueElementIdsWithImages.add(String(img.element_id))
        }
      })
    }
    
    // 누락 개수 계산 (loadStats와 동일한 기준)
    const missingCount = totalElementIds - uniqueElementIdsWithImages.size
    
    missingImagesCount.value = missingCount
    console.log(`[PartManager] 누락 이미지 개수: ${missingCount}개 (총 ${totalElementIds}개 중 ${uniqueElementIdsWithImages.size}개 등록됨)`)
  } catch (err) {
    console.error('누락 이미지 개수 조회 오류:', err)
  }
}
</script>

<style scoped>
.part-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: bold;
  color: #111827;
  margin-bottom: 0.5rem;
}

.header p {
  color: #6b7280;
}

.filter-section {
  margin-bottom: 2rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
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
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.search-btn {
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
}

.search-btn:hover {
  background: #1d4ed8;
}

.search-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.filter-select {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
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
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  text-align: center;
}

.stat-card h3 {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: #111827;
}

.stat-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.stats-actions {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sync-btn {
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.sync-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.sync-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.sync-btn.secondary {
  background: #4b5563;
}

.sync-btn.secondary:hover:not(:disabled) {
  background: #374151;
}

.missing-count {
  font-size: 0.875rem;
  color: #dc2626;
  font-weight: 500;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.sync-modal {
  background: white;
  border-radius: 0.5rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.sync-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.sync-modal-header h2 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #111827;
  margin: 0;
}

.sync-modal-content {
  padding: 1.5rem;
}

.sync-progress {
  margin-bottom: 1.5rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #2563eb;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.5rem 0;
}

.current-item {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 500;
  margin: 0.5rem 0;
}

.sync-results {
  margin-top: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.success-count {
  color: #059669;
  font-weight: 500;
  margin: 0.25rem 0;
}

.failed-count {
  color: #dc2626;
  font-weight: 500;
  margin: 0.25rem 0;
}

.sync-error {
  margin-top: 1rem;
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #dc2626;
}

.sync-modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.parts-section {
  margin-top: 2rem;
}

.parts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.parts-header h3 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #111827;
}

.view-controls {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.view-btn.active {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1.5rem;
  max-width: 100%;
}

@media (min-width: 1400px) {
  .parts-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (max-width: 1200px) and (min-width: 900px) {
  .parts-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 900px) and (min-width: 600px) {
  .parts-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1024px) {
  .parts-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 600px) {
  .parts-grid {
    grid-template-columns: 1fr;
  }
}

.part-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease-out;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  cursor: pointer;
}

.part-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.part-card .card-header {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

.part-card .part-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  width: 0;
}

.part-card .element-id {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.part-card .part-name {
  font-size: 1rem;
  font-weight: 500;
  color: #111827;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.part-card .part-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.part-card .part-num-text {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.part-card .color-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  border: none;
  width: fit-content;
}

.part-card .set-count-badge {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.part-card .card-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.reupload-action {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reupload-action.list {
  margin-top: 0.5rem;
}

.reupload-btn {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: #f3f4f6;
  color: #111827;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.reupload-btn:hover:not(:disabled) {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.reupload-btn:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.reupload-status {
  font-size: 0.75rem;
  margin: 0;
}

.reupload-status.success {
  color: #059669;
}

.reupload-status.error {
  color: #dc2626;
}

.part-card .part-image-section {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 0;
  min-height: 120px;
  background: transparent;
  border-radius: 8px;
}

.part-card .part-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}

.part-card .no-part-image {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.875rem;
  background: #f9fafb;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .part-card {
    padding: 1rem;
  }

  .part-card .card-header {
    display: flex !important;
    flex-direction: row !important;
    align-items: flex-start !important;
    gap: 0.5rem !important;
    overflow: visible !important;
  }

  .part-card .part-info {
    width: auto !important;
    flex: 1 !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  .part-card .part-name {
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    font-size: 0.875rem !important;
  }

  .part-card .element-id {
    display: block !important;
  }

  .part-card .color-badge {
    display: inline-block !important;
    font-size: 0.8125rem !important;
  }

  .part-card .part-image-section {
    min-height: 100px;
    padding: 0.75rem 0;
  }

  .part-card .part-image {
    max-height: 150px;
  }
}

.part-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.6;
  width: 100%;
  box-sizing: border-box;
}

.part-info-grid span {
  display: inline-block;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  vertical-align: top;
}

.part-info-grid strong {
  display: inline;
  color: #374151;
  margin-right: 0.25rem;
  font-weight: 600;
}

.parts-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 0.5rem;
  overflow: hidden;
}

.parts-table thead {
  background: #f9fafb;
}

.parts-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #111827;
  border-bottom: 2px solid #e5e7eb;
}

.parts-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.part-row {
  cursor: pointer;
}

.part-row:hover {
  background: #f9fafb;
}

.part-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: contain;
  background: #f3f4f6;
  border-radius: 0.25rem;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-success {
  background: #d1fae5;
  color: #065f46;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
  padding: 1rem;
  flex-wrap: wrap;
}

.page-btn-nav {
  padding: 0.5rem 1rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.2s;
}

.page-btn-nav:hover:not(:disabled) {
  background: #1d4ed8;
}

.page-btn-nav:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex-wrap: wrap;
}

.page-number-btn {
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0.5rem;
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-number-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #2563eb;
  color: #2563eb;
}

.page-number-btn.active {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
  font-weight: 600;
}

.page-number-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.page-info {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
  margin-left: 0.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 0.5rem;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-large {
  width: 90vw;
  max-width: 1200px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6b7280;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: #111827;
}

.modal-body {
  padding: 1.5rem;
}

.part-detail-main {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
}

.part-detail-image {
  flex-shrink: 0;
  width: 300px;
  height: 300px;
  background: #f3f4f6;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.part-detail-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.part-detail-info {
  flex: 1;
}

.part-detail-info p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.part-colors-section,
.part-sets-section,
.part-metadata-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.part-colors-section h3,
.part-sets-section h3,
.part-metadata-section h3 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #111827;
  margin-bottom: 1rem;
}

.colors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.color-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.color-image,
.color-image-wrapper {
  width: 100%;
  height: 150px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.color-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.part-image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-image-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: none;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  color: #9ca3af;
  font-size: 0.875rem;
  font-weight: 500;
}

.color-info {
  padding: 1rem;
}

.color-info p {
  font-size: 0.875rem;
  margin: 0.25rem 0;
}

.sets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.set-card-small {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
}

.set-card-small:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.set-thumbnail {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.set-info-small {
  padding: 1rem;
}

.set-info-small p {
  font-size: 0.875rem;
  margin: 0.25rem 0;
}

.metadata-content {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 0.5rem;
}

.metadata-content p {
  margin: 0.5rem 0;
}

.recognition-hints {
  margin-top: 1rem;
}

.recognition-hints ul {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.recognition-hints li {
  margin: 0.25rem 0;
}
</style>

