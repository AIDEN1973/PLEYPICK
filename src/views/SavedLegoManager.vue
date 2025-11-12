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
          
          <button @click="clearStorage" :disabled="loading" class="btn btn-warning">
            🗑️ Storage 정리
          </button>
          
          <button @click="resetDatabase" :disabled="loading" class="btn btn-info">
            🗄️ DB 초기화
          </button>
          
          <button @click="resetProjectData" :disabled="loading" class="btn btn-danger">
            🔄 전체 초기화
          </button>
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
          <h3>WebP 이미지</h3>
          <p class="stat-number">{{ processedImages }}</p>
          <p class="stat-subtitle">{{ totalSets > 0 ? Math.round((processedImages / totalSets) * 100) : 0 }}% 변환됨</p>
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
              :src="getSetImageUrl(set)" 
              :alt="set.name"
              @error="handleImageError"
            />
            <!-- WebP 이미지 표시 배지 -->
            <div v-if="set.webp_image_url" class="webp-badge">
              🖼️ WebP
            </div>
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
                  :src="getSetImageUrl(set)" 
                  :alt="set.name"
                  class="set-thumbnail"
                  @error="handleImageError"
                />
                <!-- WebP 이미지 표시 배지 -->
                <div v-if="set.webp_image_url" class="webp-badge-small">
                  🖼️
                </div>
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
      
      <!-- ✅ 더 보기 버튼 -->
      <div v-if="savedSets.length < totalSets" class="load-more-section">
        <button @click="loadMore" :disabled="loading" class="btn btn-secondary load-more-btn">
          {{ loading ? '로딩 중...' : `더 보기 (${savedSets.length} / ${totalSets})` }}
        </button>
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
              <img 
                :src="getSetImageUrl(selectedSet)" 
                :alt="selectedSet.name" 
                class="set-large-image" 
              />
              <!-- WebP 이미지 표시 배지 -->
              <div v-if="selectedSet.webp_image_url" class="webp-badge-large">
                🖼️ WebP 이미지
              </div>
              <div class="set-details-text">
                <p><strong>세트 번호:</strong> {{ selectedSet.set_num }}</p>
                <p><strong>연도:</strong> {{ selectedSet.year }}</p>
                <p><strong>부품 수:</strong> {{ selectedSet.num_parts }}개</p>
                <p><strong>테마 ID:</strong> {{ selectedSet.theme_id }}</p>
                <p><strong>등록일:</strong> {{ formatDate(selectedSet.created_at) }}</p>
              </div>
            </div>

            <!-- 배치 로딩 진행률 -->
            <div v-if="getLoadingStatus().loading" class="batch-loading-progress">
              <h4>⚡ 부품 데이터 로딩 중...</h4>
              <div class="progress">
                <div class="progress-bar" :style="{ width: getLoadingStatus().progress + '%' }"></div>
                <span>{{ getLoadingStatus().progress }}%</span>
              </div>
              <small>{{ getLoadingStatus().currentStep }}</small>
              <div v-if="getLoadingStatus().errors.length > 0" class="loading-errors">
                <small>오류: {{ getLoadingStatus().errors.length }}개</small>
              </div>
            </div>


            <!-- 부품 목록 -->
            <div v-if="setParts.length > 0" class="parts-section">
              <h3>부품 목록 ({{ uniquePartsCount }}개 고유 부품, 총 {{ setParts.length }}개 항목) - 배치 로딩됨</h3>
              <div class="parts-grid">
                <div 
                  v-for="part in setParts" 
                  :key="`${part.lego_parts.part_num}-${part.lego_colors.color_id}`"
                  class="part-card"
                >
                  <div class="part-image" @click="toggleMetadata(part)">
                    <img 
                      :src="getPartImageUrl(part)" 
                      :alt="part.lego_parts.name"
                      @error="handleImageError"
                      :title="part.supabase_image_url ? 'Supabase Storage에서 로드됨' : '프록시를 통해 로드됨'"
                    />
                    <div v-if="part.metadata" class="image-source-badge metadata-badge">
                      🧠 메타데이터
                    </div>
                    <div v-else class="image-source-badge no-metadata-badge">
                      📝 메타데이터 없음
                    </div>
                    
                    <!-- 메타데이터 툴팁 -->
                    <div v-if="hoveredPart && hoveredPart.lego_parts.part_num === part.lego_parts.part_num && hoveredPart.lego_colors.color_id === part.lego_colors.color_id" 
                         class="metadata-tooltip">
                      <div class="tooltip-content">
                        <h4>🧠 LLM 분석 결과</h4>
                        <p class="tooltip-hint">💡 클릭하여 닫기</p>
                        <div v-if="part.metadata" class="metadata-details">
                          <p><strong>형태:</strong> {{ getSmartShape(part.metadata, part.lego_parts?.name) }}</p>
                          <p><strong>기능:</strong> {{ getDisplayValue(part.metadata.feature_json?.function || part.metadata.feature_json?.function_tag) }}</p>
                          <p><strong>연결방식:</strong> {{ getDisplayValue(part.metadata.feature_json?.connection) }}</p>
                          <p><strong>스케일:</strong> {{ getSmartScale(part.metadata, part.lego_parts?.name) }}</p>
                          <p><strong>중심 스터드:</strong> {{ part.metadata.feature_json?.center_stud ? '✅ 있음' : '❌ 없음' }}</p>
                          <p><strong>홈:</strong> {{ part.metadata.feature_json?.groove ? '✅ 있음' : '❌ 없음' }}</p>
                          <p><strong>신뢰도:</strong> {{ Math.round((part.metadata.confidence || 0) * 100) }}%</p>
                          <!-- 디버깅용: 실제 메타데이터 구조 확인 -->
                          <details style="margin-top: 10px; font-size: 0.8rem; color: #ccc;">
                            <summary>🔍 디버깅 정보</summary>
                            <div style="margin-bottom: 10px;">
                              <strong>부품 이름:</strong> {{ part.lego_parts?.name || '없음' }}
                            </div>
                            <pre style="white-space: pre-wrap; word-break: break-all;">{{ JSON.stringify(part.metadata, null, 2) }}</pre>
                          </details>
                          <div v-if="part.metadata.feature_json?.recognition_hints" class="recognition-hints">
                            <p><strong>인식 힌트:</strong></p>
                            <ul>
                              <li v-if="part.metadata.feature_json.recognition_hints.top_view">
                                <strong>위에서:</strong> {{ part.metadata.feature_json.recognition_hints.top_view }}
                              </li>
                              <li v-if="part.metadata.feature_json.recognition_hints.side_view">
                                <strong>옆에서:</strong> {{ part.metadata.feature_json.recognition_hints.side_view }}
                              </li>
                              <li v-if="part.metadata.feature_json.recognition_hints.unique_features">
                                <strong>고유 특징:</strong> {{ part.metadata.feature_json.recognition_hints.unique_features.join(', ') }}
                              </li>
                            </ul>
                          </div>
                          <div v-if="part.metadata.feature_json?.similar_parts && part.metadata.feature_json.similar_parts.length > 0" class="similar-parts">
                            <p><strong>유사 부품:</strong> {{ part.metadata.feature_json.similar_parts.join(', ') }}</p>
                          </div>
                          <div v-if="part.metadata.feature_json?.distinguishing_features && part.metadata.feature_json.distinguishing_features.length > 0" class="distinguishing-features">
                            <p><strong>구별 특징:</strong> {{ part.metadata.feature_json.distinguishing_features.join(', ') }}</p>
                          </div>
                          <div v-if="part.metadata.feature_json?.feature_text" class="feature-text">
                            <p><strong>특징 설명:</strong></p>
                            <p class="feature-description">{{ part.metadata.feature_json.feature_text }}</p>
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
                    <p v-if="part.element_id" class="element-id-info">
                      <strong>Element ID:</strong> 
                      <span class="element-id-badge">{{ part.element_id }}</span>
                      <router-link :to="`/element-search?q=${part.element_id}`" class="element-search-link" title="Element ID로 검색">
                        🔍
                      </router-link>
                    </p>
                    <p><strong>색상:</strong> {{ part.lego_colors.name }}</p>
                    <p><strong>수량:</strong> {{ part.quantity }}개</p>
                    
                    <!-- 메타데이터 생성 버튼 -->
                    <div class="metadata-actions">
                      <button 
                        v-if="!part.metadata" 
                        @click="generatePartMetadata(part)"
                        :disabled="metadataGenerating[`${part.lego_parts.part_num}-${part.lego_colors.color_id}`]"
                        class="btn btn-sm btn-primary metadata-generate-btn"
                      >
                        <span v-if="metadataGenerating[`${part.lego_parts.part_num}-${part.lego_colors.color_id}`]">
                          🤖 생성 중...
                        </span>
                        <span v-else>
                          🧠 메타데이터 생성
                        </span>
                      </button>
                      <button 
                        v-else
                        @click="regeneratePartMetadata(part)"
                        :disabled="metadataGenerating[`${part.lego_parts.part_num}-${part.lego_colors.color_id}`]"
                        class="btn btn-sm btn-secondary metadata-regenerate-btn"
                      >
                        <span v-if="metadataGenerating[`${part.lego_parts.part_num}-${part.lego_colors.color_id}`]">
                          🔄 재생성 중...
                        </span>
                        <span v-else>
                          🔄 메타데이터 재생성
                        </span>
                      </button>
                    </div>
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
import { useImageManager } from '../composables/useImageManager'
import { useBatchPartLoading } from '../composables/useBatchPartLoading'
import { useBackgroundLLMAnalysis } from '../composables/useBackgroundLLMAnalysis'

export default {
  name: 'SavedLegoManager',
  setup() {
    const {
      loading,
      error,
      getLegoSets,
      getSetParts,
      deleteSetAndParts,
      clearAllStorageBuckets,
      resetDatabaseOnly,
      resetAllProjectData
    } = useDatabase()

    const {
      processRebrickableImage,
      uploadImageFromUrl,
      saveImageMetadata
    } = useImageManager()

    const {
      batchLoadParts,
      getLoadingStatus,
      resetLoading
    } = useBatchPartLoading()

    const {
      startBackgroundAnalysis
    } = useBackgroundLLMAnalysis()


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
    
    // ✅ 메타데이터 생성 상태
    const metadataGenerating = ref({})
    
    // ✅ 페이지네이션 상태
    const currentPage = ref(1)
    const itemsPerPage = ref(50) // 한번에 50개씩 로드
    const totalCount = ref(0)

    // ✅ 최적화: 통계는 DB에서 직접 조회
    const totalSets = ref(0)
    const totalParts = ref(0)
    const processedImages = ref(0)
    
    // 통계 정보 로드
    const loadStats = async () => {
      try {
        // 총 세트 수
        const { count: setsCount } = await supabase
          .from('lego_sets')
          .select('*', { count: 'exact', head: true })
        totalSets.value = setsCount || 0
        
        // 총 부품 수 (sum)
        const { data: partsSumData } = await supabase
          .from('lego_sets')
          .select('num_parts')
        totalParts.value = partsSumData?.reduce((sum, set) => sum + (set.num_parts || 0), 0) || 0
        
        // WebP 변환 이미지 수
        const { count: webpCount } = await supabase
          .from('lego_sets')
          .select('*', { count: 'exact', head: true })
          .not('webp_image_url', 'is', null)
        processedImages.value = webpCount || 0
      } catch (err) {
        console.error('통계 로드 실패:', err)
      }
    }
    

    // ✅ 최적화: 페이지네이션 추가
    const loadSavedSets = async (page = 1, limit = 50) => {
      try {
        const sets = await getLegoSets(page, limit)
        
        // ✅ 최적화: N+1 쿼리 제거 - 이미 DB에서 webp_image_url을 가져왔으므로 추가 쿼리 불필요
        const setsWithWebPImages = sets.map(set => ({
          ...set,
          display_image_url: set.webp_image_url || set.set_img_url // WebP 우선, 없으면 원본
        }))
        
        if (page === 1) {
          savedSets.value = setsWithWebPImages
        } else {
          savedSets.value = [...savedSets.value, ...setsWithWebPImages]
        }
        
        extractThemesAndYears(savedSets.value)
        currentPage.value = page
        
        console.log(`✅ 페이지 ${page}: ${sets.length}개 세트 로드 (총 ${savedSets.value.length}개)`)
      } catch (err) {
        console.error('Failed to load saved sets:', err)
      }
    }
    
    // ✅ 무한 스크롤: 더 로드하기
    const loadMore = async () => {
      if (savedSets.value.length < totalSets.value) {
        await loadSavedSets(currentPage.value + 1, itemsPerPage.value)
      }
    }

    // 세트의 WebP 이미지 URL 조회
    const getSetWebPImageUrl = async (setNum) => {
      try {
        console.log(`🔍 WebP 이미지 URL 조회 중: ${setNum}`)
        
        // 1) lego_sets 테이블에서 WebP 이미지 URL 조회
        const { data: setImageData, error: setImageError } = await supabase
          .from('lego_sets')
          .select('webp_image_url')
          .eq('set_num', setNum)
          .not('webp_image_url', 'is', null)
          .maybeSingle()

        if (!setImageError && setImageData?.webp_image_url) {
          console.log(`✅ lego_sets에서 WebP URL 발견: ${setImageData.webp_image_url}`)
          return setImageData.webp_image_url
        }

        // 2) set_images 테이블에서 우선 조회 (메타 보조 테이블)
        const { data: setImgRow, error: setImgErr } = await supabase
          .from('set_images')
          .select('supabase_url')
          .eq('set_num', setNum)
          .maybeSingle()
        if (!setImgErr && setImgRow?.supabase_url) {
          console.log(`✅ set_images에서 WebP URL 발견: ${setImgRow.supabase_url}`)
          return setImgRow.supabase_url
        }

        // 3) Supabase Storage에서 직접 확인 (여러 버킷과 경로 시도)
        const webpFileName = `${setNum}_set.webp`
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
        
        // ✅ 레고 세트 이미지 경로: lego_parts_images > lego_sets_images 폴더만 확인
        const imageUrl = `${supabaseUrl}/storage/v1/object/public/lego_parts_images/lego_sets_images/${webpFileName}`
        console.log(`🔍 Storage에서 WebP 파일 확인 (GET Range): ${imageUrl}`)
        
        try {
          const resp = await fetch(imageUrl, { headers: { Range: 'bytes=0-0' } })
          if (resp.ok || resp.status === 206) {
            console.log(`✅ Storage에서 WebP 파일 발견: ${imageUrl}`)
            console.log(`📁 실제 경로: lego_parts_images/lego_sets_images/${webpFileName}`)
            return imageUrl
          }
          console.log(`❌ lego_parts_images/lego_sets_images/${webpFileName}에서 WebP 파일 없음: ${resp.status}`)
        } catch (fetchError) {
          console.log(`❌ lego_parts_images/lego_sets_images/${webpFileName} 확인 실패: ${fetchError.message}`)
        }
        
        console.log(`⚠️ 모든 경로에서 세트 이미지를 찾을 수 없음: ${setNum}`)
        
        // ✅ 세트 이미지가 없는 경우 Rebrickable에서 가져와서 WebP로 변환
        try {
          console.log(`🔄 Rebrickable에서 세트 이미지 다운로드 시도: ${setNum}`)
          const rebrickableUrl = `https://cdn.rebrickable.com/media/sets/${setNum}.jpg`
          
          // Rebrickable 이미지를 WebP로 변환하여 Storage에 저장
          const webpImageUrl = await convertAndUploadSetImage(setNum, rebrickableUrl)
          if (webpImageUrl) {
            console.log(`✅ 세트 이미지 생성 완료: ${webpImageUrl}`)
            return webpImageUrl
          }
        } catch (convertError) {
          console.warn(`⚠️ 세트 이미지 변환 실패: ${convertError.message}`)
        }
        
        // 최종 폴백: Rebrickable 원본 이미지 사용
        return `https://cdn.rebrickable.com/media/sets/${setNum}.jpg`
      } catch (err) {
        console.error(`❌ WebP 이미지 URL 조회 실패: ${err.message}`)
        return null
      }
    }

    // ✅ Rebrickable 이미지를 WebP로 변환하여 Storage에 업로드
    const convertAndUploadSetImage = async (setNum, rebrickableUrl) => {
      try {
        // 1. Rebrickable에서 이미지 다운로드 (CORS 우회를 위해 프록시 사용)
        const imagePath = rebrickableUrl.replace('https://cdn.rebrickable.com/media/', '')
        const proxyUrl = `/api/proxy/media/${imagePath}`
        const response = await fetch(proxyUrl)
        if (!response.ok) {
          throw new Error(`Rebrickable 이미지 다운로드 실패: ${response.status}`)
        }
        
        const imageBlob = await response.blob()
        
        // 2. Canvas를 사용하여 WebP로 변환
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        
        return new Promise((resolve, reject) => {
          img.onload = async () => {
            try {
              // Canvas 크기 설정 (최대 800px)
              const maxSize = 800
              const ratio = Math.min(maxSize / img.width, maxSize / img.height)
              canvas.width = img.width * ratio
              canvas.height = img.height * ratio
              
              // 이미지 그리기
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              
              // WebP로 변환 (품질 90%)
              canvas.toBlob(async (webpBlob) => {
                try {
                  // 3. Supabase Storage에 업로드 (올바른 경로: lego_parts_images/lego_sets_images/)
                  const fileName = `${setNum}_set.webp`
                  const filePath = `lego_sets_images/${fileName}`  // ✅ lego_parts_images/lego_sets_images/ 경로
                  
                  const { data, error } = await supabase.storage
                    .from('lego_parts_images')
                    .upload(filePath, webpBlob, {
                      contentType: 'image/webp',
                      upsert: true
                    })
                  
                  if (error) {
                    throw new Error(`Storage 업로드 실패: ${error.message}`)
                  }
                  
                  // 4. 공개 URL 반환
                  const { data: urlData } = supabase.storage
                    .from('lego_parts_images')
                    .getPublicUrl(filePath)
                  
                  console.log(`✅ 세트 이미지 WebP 변환 및 업로드 완료: ${urlData.publicUrl}`)
                  resolve(urlData.publicUrl)
                } catch (uploadError) {
                  console.error(`❌ Storage 업로드 실패: ${uploadError.message}`)
                  reject(uploadError)
                }
              }, 'image/webp', 0.9)
            } catch (canvasError) {
              console.error(`❌ Canvas 변환 실패: ${canvasError.message}`)
              reject(canvasError)
            }
          }
          
          img.onerror = () => {
            reject(new Error('이미지 로드 실패'))
          }
          
          img.src = URL.createObjectURL(imageBlob)
        })
      } catch (error) {
        console.error(`❌ 세트 이미지 변환 실패: ${error.message}`)
        throw error
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

    // 세트 선택 (배치 로딩)
    const selectSet = async (set) => {
      try {
        selectedSet.value = set
        resetLoading()
        
        console.log(`🚀 Starting batch load for set ${set.set_num} (ID: ${set.id})`)
        
        // 배치 로딩 실행 (초고속 최적화)
        const result = await batchLoadParts(set.id, {
          batchSize: 100 // 100개씩 배치 처리 (초고속)
        })
        
        console.log(`✅ Batch load completed: ${result.parts?.length || 0} parts loaded`)
        console.log(`📊 Loading stats:`, result.loadingState)
        
        if (result.errors?.length > 0) {
          console.warn(`⚠️ ${result.errors.length} errors during batch load:`, result.errors)
        }
        
        setParts.value = result.parts || []
        
        // ✅ 최적화: 메타데이터를 비동기로 백그라운드 로드 (부품 표시를 차단하지 않음)
        console.log(`🧠 Background loading AI metadata for ${result.parts?.length || 0} parts...`)
        getBatchPartMetadata(result.parts || []).then(metadataMap => {
          // 각 부품에 메타데이터 할당
          (result.parts || []).forEach(part => {
            const partNum = part.lego_parts?.part_num || part.part_id
            const colorId = part.lego_colors?.id || part.color_id
            const key = `${partNum}_${colorId}`
            
            if (metadataMap[key]) {
              part.metadata = metadataMap[key]
            }
          })
          
          const metadataCount = Object.keys(metadataMap).length
          console.log(`✅ AI metadata loading completed: ${metadataCount}개 매칭됨`)
        }).catch(err => {
          console.error('메타데이터 백그라운드 로딩 실패:', err)
        })
        
      } catch (err) {
        console.error('Failed to batch load set parts:', err)
      }
    }

    // Supabase Storage에서 이미지 URL 조회 (element_id 우선, part_images 우선, 다음 image_metadata)
    const getSupabaseImageUrl = async (partNum, colorId, elementId = null) => {
      try {
        // 1) element_id가 있으면 element_id로 먼저 조회
        if (elementId) {
          const { data: piByElement, error: piElementErr } = await supabase
            .from('part_images')
            .select('uploaded_url')
            .eq('element_id', String(elementId))
            .maybeSingle()

          if (!piElementErr && piByElement?.uploaded_url) return piByElement.uploaded_url
        }

        // 2) part_images에서 part_id + color_id로 조회
        const { data: pi, error: piErr } = await supabase
          .from('part_images')
          .select('uploaded_url')
          .eq('part_id', partNum)
          .eq('color_id', colorId)
          .maybeSingle()

        if (!piErr && pi?.uploaded_url) return pi.uploaded_url

        // 3) 과거 기록 호환: image_metadata.supabase_url 조회 (element_id 우선)
        if (elementId) {
          const { data: imByElement, error: imElementErr } = await supabase
            .from('image_metadata')
            .select('supabase_url')
            .eq('element_id', String(elementId))
            .not('supabase_url', 'is', null)
            .maybeSingle()

          if (!imElementErr && imByElement?.supabase_url) return imByElement.supabase_url
        }

        // element_id로 찾지 못했거나 element_id가 없으면 part_num + color_id로 조회
        const { data: im, error: imErr } = await supabase
          .from('image_metadata')
          .select('supabase_url')
          .eq('part_num', partNum)
          .eq('color_id', colorId)
          .not('supabase_url', 'is', null)
          .maybeSingle()

        if (!imErr && im?.supabase_url) return im.supabase_url

        return null
      } catch (err) {
        console.error('Error fetching Supabase image URL:', err)
        return null
      }
    }

    // 부품 이미지 URL 생성 (CORS 우회)
    const getPartImageUrl = (part) => {
      // 1. Supabase Storage 이미지가 있으면 우선 사용
      if (part.supabase_image_url) {
        return part.supabase_image_url
      }
      
      // 2. Rebrickable CDN URL을 프록시를 통해 로드
      if (part.lego_parts?.part_img_url) {
        // 프록시 서버를 통해 이미지 로드
        return `/api/upload/proxy-image?url=${encodeURIComponent(part.lego_parts.part_img_url)}`
      }
      
      // 3. 실제 이미지 로드 시도
      return getRealSetImage(set.set_num)
    }

    // LLM 분석 메타데이터 조회
    // ✅ 배치 메타데이터 로딩 (N+1 쿼리 방지)
    const getBatchPartMetadata = async (parts) => {
      try {
        // 부품 ID와 색상 ID 조합 생성
        const partColorPairs = parts
          .map(part => ({
            part_id: part.lego_parts?.part_num || part.part_id,
            color_id: part.lego_colors?.id || part.color_id
          }))
          .filter(p => p.part_id && p.color_id !== undefined)
        
        if (partColorPairs.length === 0) return {}
        
        // 모든 part_id 추출
        const partIds = [...new Set(partColorPairs.map(p => p.part_id))]
        
        console.log(`🔍 배치 메타데이터 조회 중: ${partIds.length}개 부품`)
        
        // ✅ 단일 쿼리로 모든 메타데이터 가져오기
        const { data, error } = await supabase
          .from('parts_master_features')
          .select('*')
          .in('part_id', partIds)
        
        if (error) {
          console.warn('❌ 배치 메타데이터 조회 실패:', error)
          return {}
        }
        
        // Map으로 변환 (빠른 조회를 위해)
        const metadataMap = {}
        data?.forEach(item => {
          const key = `${item.part_id}_${item.color_id}`
          metadataMap[key] = item
        })
        
        console.log(`✅ 배치 메타데이터 로드 완료: ${data?.length || 0}개`)
        return metadataMap
        
      } catch (err) {
        console.error('배치 메타데이터 조회 오류:', err)
        return {}
      }
    }
    
    const getPartMetadata = async (partNum, colorId) => {
      try {
        console.log(`🔍 Querying metadata for part_id='${partNum}', color_id=${colorId}`)
        
        const { data, error } = await supabase
          .from('parts_master_features')
          .select('*')
          .eq('part_id', partNum)
          .eq('color_id', colorId)
          .maybeSingle()

        if (error) {
          console.warn(`❌ Query error for ${partNum} (color: ${colorId}):`, error)
          return null
        }

        if (!data) {
          console.log(`ℹ️ No data returned for ${partNum} (color: ${colorId})`)
          return null
        }
        
        console.log(`✅ Metadata found for ${partNum} (color: ${colorId}):`, data)

        // feature_json 파싱하여 메타데이터 구성
        let processedMeta = null
        if (data.feature_json) {
          try {
            const featureData = typeof data.feature_json === 'string' 
              ? JSON.parse(data.feature_json) 
              : data.feature_json
            
            // feature_json의 구조를 올바르게 매핑
            processedMeta = {
              feature_json: {
                function: featureData.function || featureData.function_tag,
                connection: featureData.connection,
                shape_tag: featureData.shape_tag,
                center_stud: featureData.center_stud,
                groove: featureData.groove,
                area_px: featureData.area_px,
                // feature_json 내부의 데이터 우선 사용
                recognition_hints: featureData.recognition_hints || data.recognition_hints,
                similar_parts: featureData.similar_parts || data.similar_parts,
                distinguishing_features: featureData.distinguishing_features || data.distinguishing_features,
                feature_text: featureData.feature_text || data.feature_text
              },
              feature_text: featureData.feature_text || data.feature_text,
              confidence: data.confidence,
              recognition_hints: featureData.recognition_hints || data.recognition_hints,
              similar_parts: featureData.similar_parts || data.similar_parts,
              distinguishing_features: featureData.distinguishing_features || data.distinguishing_features,
              has_stud: data.has_stud,
              groove: data.groove,
              center_stud: data.center_stud
            }
          } catch (parseError) {
            console.warn(`Failed to parse feature_json for ${partNum}:`, parseError)
            processedMeta = {
              feature_json: {
                function: 'unknown',
                connection: 'unknown',
                shape_tag: 'unknown',
                center_stud: false,
                groove: false
              },
              feature_text: data.feature_text,
              confidence: data.confidence,
              recognition_hints: data.recognition_hints,
              similar_parts: data.similar_parts,
              distinguishing_features: data.distinguishing_features,
              has_stud: data.has_stud,
              groove: data.groove,
              center_stud: data.center_stud
            }
          }
        } else {
          // feature_json이 없으면 기본 메타데이터만 사용
          processedMeta = {
            feature_json: {
              function: 'unknown',
              connection: 'unknown',
              shape_tag: 'unknown',
              center_stud: false,
              groove: false
            },
            feature_text: data.feature_text,
            confidence: data.confidence,
            recognition_hints: data.recognition_hints,
            similar_parts: data.similar_parts,
            distinguishing_features: data.distinguishing_features,
            has_stud: data.has_stud,
            groove: data.groove,
            center_stud: data.center_stud
          }
        }

        return processedMeta
      } catch (err) {
        console.error('Error fetching part metadata:', err)
        return null
      }
    }


    // 메타데이터 툴팁 토글
    const toggleMetadata = (part) => {
      if (hoveredPart.value && 
          hoveredPart.value.lego_parts.part_num === part.lego_parts.part_num && 
          hoveredPart.value.lego_colors.color_id === part.lego_colors.color_id) {
        // 같은 부품을 다시 클릭하면 숨기기
        hoveredPart.value = null
      } else {
        // 다른 부품을 클릭하거나 처음 클릭하면 표시
        hoveredPart.value = part
      }
    }

    // 세트 상세보기
    const viewSetDetails = (set) => {
      selectSet(set)
    }

    // 세트 삭제 (관련 데이터 모두 삭제)
    const deleteSet = async (set) => {
      if (!confirm(`"${set.name}" 세트와 관련된 모든 데이터(부품, 이미지, 메타데이터)를 삭제하시겠습니까?`)) return
      
      try {
        loading.value = true
        successMessage.value = '세트와 관련 데이터를 삭제하는 중...'
        
        // deleteSetAndParts 함수 사용 (관련 데이터 모두 삭제)
        const deleteSuccess = await deleteSetAndParts(set.id, set.set_num, true) // LLM 분석 데이터도 삭제
        
        if (!deleteSuccess) {
          throw new Error('세트 삭제에 실패했습니다.')
        }
        
        // 목록에서 제거
        savedSets.value = savedSets.value.filter(s => s.id !== set.id)
        successMessage.value = '세트와 관련된 모든 데이터가 성공적으로 삭제되었습니다.'
        
      } catch (err) {
        console.error('Failed to delete set:', err)
        error.value = '삭제 중 오류가 발생했습니다: ' + err.message
      } finally {
        loading.value = false
      }
    }

    // 모달 닫기
    const closeModal = () => {
      selectedSet.value = null
      setParts.value = []
    }

    // Storage 버킷 정리
    const clearStorage = async () => {
      if (!confirm('모든 Storage 버킷의 데이터를 삭제하시겠습니까?\n(models 버킷 제외)\n\n⚠️ 이 작업은 되돌릴 수 없습니다!')) return
      
      try {
        loading.value = true
        successMessage.value = 'Storage 버킷 정리 중...'
        
        const results = await clearAllStorageBuckets()
        
        successMessage.value = `Storage 정리 완료! ${results.totalFiles}개 파일 중 ${results.deletedFiles}개 삭제됨`
        
        if (results.errors.length > 0) {
          console.warn('일부 오류 발생:', results.errors)
          successMessage.value += ` (${results.errors.length}개 오류 발생)`
        }
        
      } catch (err) {
        console.error('Storage 정리 실패:', err)
        error.value = 'Storage 정리 중 오류가 발생했습니다: ' + err.message
      } finally {
        loading.value = false
      }
    }

    // 데이터베이스만 초기화 (Storage 제외)
    const resetDatabase = async () => {
      if (!confirm('데이터베이스를 초기화하시겠습니까?\n\n삭제될 데이터:\n• 모든 레고 세트 및 부품 정보\n• 모든 이미지 메타데이터\n• LLM 분석 데이터\n• 훈련 데이터 및 모델\n• 작업 로그\n\n⚠️ 이 작업은 되돌릴 수 없습니다!')) return
      
      try {
        loading.value = true
        successMessage.value = '데이터베이스 초기화 중...'
        
        const results = await resetDatabaseOnly()
        
        successMessage.value = `데이터베이스 초기화 완료! ${results.steps.length}개 단계 처리됨`
        
        if (results.errors.length > 0) {
          console.warn('일부 오류 발생:', results.errors)
          successMessage.value += ` (${results.errors.length}개 오류 발생)`
        }
        
        // 목록 새로고침
        await loadSavedSets()
        
      } catch (err) {
        console.error('데이터베이스 초기화 실패:', err)
        error.value = '데이터베이스 초기화 중 오류가 발생했습니다: ' + err.message
      } finally {
        loading.value = false
      }
    }

    // 프로젝트 데이터 완전 초기화
    const resetProjectData = async () => {
      if (!confirm('프로젝트 데이터를 완전히 초기화하시겠습니까?\n\n삭제될 데이터:\n• 모든 Storage 파일 (models 제외)\n• 모든 레고 세트 및 부품 정보\n• 모든 이미지 및 메타데이터\n• LLM 분석 데이터\n• 훈련 데이터 및 모델\n• 작업 로그\n\n⚠️ 이 작업은 되돌릴 수 없습니다!')) return
      
      try {
        loading.value = true
        successMessage.value = '프로젝트 데이터 초기화 중...'
        
        const results = await resetAllProjectData()
        
        successMessage.value = `프로젝트 초기화 완료! ${results.steps.length}개 단계 처리됨`
        
        if (results.errors.length > 0) {
          console.warn('일부 오류 발생:', results.errors)
          successMessage.value += ` (${results.errors.length}개 오류 발생)`
        }
        
        // 목록 새로고침
        await loadSavedSets()
        
      } catch (err) {
        console.error('프로젝트 초기화 실패:', err)
        error.value = '프로젝트 초기화 중 오류가 발생했습니다: ' + err.message
      } finally {
        loading.value = false
      }
    }

    // 날짜 포맷팅
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('ko-KR')
    }

    // 이미지 오류 처리
    const handleImageError = (event) => {
      const img = event.target
      
      // 세트 이미지 오류 처리
      const set = savedSets.value.find(s => 
        s.display_image_url === img.src || s.set_img_url === img.src || s.webp_image_url === img.src
      )
      
      if (set) {
        console.log(`🖼️ 이미지 로드 실패: ${set.set_num}, 현재 src: ${img.src}`)
        
        if (set.webp_image_url && img.src === set.webp_image_url) {
          // WebP 이미지 로드 실패 시 원본 이미지로 폴백
          console.log(`🔄 WebP 이미지 실패, 원본으로 폴백: ${set.set_num}`)
          img.src = set.set_img_url
        } else if (set.display_image_url && img.src === set.display_image_url) {
          // 표시 이미지 로드 실패 시 원본으로 폴백
          console.log(`🔄 표시 이미지 실패, 원본으로 폴백: ${set.set_num}`)
          img.src = set.set_img_url
        } else if (img.src === set.set_img_url) {
          // 원본 이미지도 실패 시 플레이스홀더
          console.log(`🔄 원본 이미지도 실패, 플레이스홀더 사용: ${set.set_num}`)
          getRealSetImage(set.set_num).then(imageUrl => {
            img.src = imageUrl
          })
        } else {
          // 알 수 없는 이미지 실패 시 플레이스홀더
          console.log(`🔄 알 수 없는 이미지 실패, 플레이스홀더 사용: ${set.set_num}`)
          getRealSetImage(set.set_num).then(imageUrl => {
            img.src = imageUrl
          })
        }
        return
      }
      
      // 부품 이미지 오류 처리
      const part = setParts.value.find(p => 
        p.supabase_image_url === img.src || p.lego_parts.part_img_url === img.src
      )
      
      if (part && part.supabase_image_url && img.src === part.supabase_image_url) {
        // Supabase 이미지 로드 실패 시 Rebrickable CDN으로 폴백
        console.log(`🔄 Supabase 이미지 실패, CDN으로 폴백: ${part.lego_parts.part_num}`)
        img.src = part.lego_parts.part_img_url
      } else {
        // 모든 이미지 로드 실패 시 플레이스홀더
        console.log(`🔄 모든 이미지 실패, 플레이스홀더 사용`)
        getRealSetImage(set.set_num).then(imageUrl => {
          img.src = imageUrl
        })
      }
    }

    // 고유 부품 수 계산
    const uniquePartsCount = computed(() => {
      if (!setParts.value || setParts.value.length === 0) return 0
      const uniqueParts = new Set(setParts.value.map(part => part.lego_parts.part_num))
      return uniqueParts.size
    })

    // 메타데이터 표시값 헬퍼 함수
    const getDisplayValue = (value, fieldType = null) => {
      if (!value || value === '' || value === 'unknown') {
        return '정보 없음'
      }
      
      // 영문 값을 한글로 변환
      const translations = {
        // 기본 형태
        'plate': '플레이트',
        'brick': '브릭',
        'tile': '타일',
        'slope': '경사',
        'round': '둥근',
        'technic': '테크닉',
        'hinge': '힌지',
        'clip': '클립',
        'bar': '막대',
        'connector': '연결',
        'wedge': '쐐기',
        'panel': '패널',
        'system': '시스템',
        'duplo': '듀플로',
        'stud': '스터드',
        'tube': '튜브',
        'solid_tube': '단단한 튜브',
        'hollow': '속이 빈',
        'reinforced': '보강된',
        'animal': '동물',
        'figure': '피규어',
        'minifig': '미니피규어',
        'plant': '식물',
        'vehicle': '차량',
        // 추가 형태
        'animal_figure': '동물 피규어',
        'unknown': '정보 없음',
        // 기능
        'building_block': '건축 블록',
        'decoration': '장식',
        'functional': '기능적',
        'structural': '구조적',
        // 연결방식
        'stud_connection': '스터드 연결',
        'integrated': '통합형',
        'clip_connection': '클립 연결',
        'hinge_connection': '힌지 연결'
      }
      
      const lowercaseValue = value.toLowerCase()
      
      // "duplo"는 스케일로만 표시되어야 함
      if (fieldType === 'shape' && lowercaseValue === 'duplo') {
        return '정보 없음'
      }
      
      return translations[lowercaseValue] || value
    }
    
    // 스마트 메타데이터 추출 (부품 이름에서 힌트)
    const getSmartScale = (metadata, partName) => {
      // 부품 이름에 Duplo가 있으면 듀플로
      if (partName && partName.toLowerCase().includes('duplo')) {
        return '듀플로'
      }
      return getDisplayValue(metadata.feature_json?.scale_type || metadata.feature_json?.scale)
    }
    
    const getSmartShape = (metadata, partName) => {
      // 여러 경로에서 형태 정보 추출
      const rawShape = metadata.feature_json?.shape_tag || 
                      metadata.feature_json?.shape || 
                      metadata.shape_tag || 
                      metadata.shape
      
      // "duplo"는 스케일이므로 형태로 사용하지 않음
      if (rawShape && rawShape.toLowerCase() === 'duplo') {
        // 부품 이름에서 힌트 추출
        if (partName) {
          if (partName.toLowerCase().includes('animal')) return '동물'
          if (partName.toLowerCase().includes('figure')) return '피규어'
          if (partName.toLowerCase().includes('brick')) return '브릭'
          if (partName.toLowerCase().includes('plate')) return '플레이트'
        }
        return '정보 없음'
      }
      
      return getDisplayValue(rawShape, 'shape')
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
        
        return data.webp_image_url || data.set_img_url || getDefaultSetImage()
        
      } catch (error) {
        console.error('기본 세트 이미지 로드 실패:', error)
        return getDefaultSetImage()
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
        return data.webp_image_url || data.set_img_url || getDefaultSetImage()
        
      } catch (error) {
        console.error('실제 세트 이미지 로드 실패:', error)
        return getDefaultSetImage()
      }
    }

    // 세트 이미지 URL 우선순위 함수
    const getSetImageUrl = (set) => {
      if (!set) return getDefaultSetImage()
      
      // 1. WebP 이미지 우선 (스토리지에서)
      if (set.webp_image_url) {
        return set.webp_image_url
      }
      
      // 2. display_image_url (기존 처리된 이미지)
      if (set.display_image_url) {
        return set.display_image_url
      }
      
      // 3. 원본 이미지 URL
      if (set.set_img_url) {
        return set.set_img_url
      }
      
      // 4. 기본 이미지
      return getDefaultSetImage()
    }

    // ✅ 메타데이터 상태 폴링 함수
    const pollMetadataStatus = async (part, maxAttempts = 30, interval = 2000) => {
      const partKey = `${part.lego_parts.part_num}-${part.lego_colors.color_id}`
      let attempts = 0
      
      const poll = async () => {
        try {
          attempts++
          console.log(`🔍 메타데이터 상태 확인 (${attempts}/${maxAttempts}): ${part.lego_parts.part_num}`)
          
          // 메타데이터 조회
          const { data: metadata, error } = await supabase
            .from('parts_master_features')
            .select('*')
            .eq('part_id', part.lego_parts.part_num)
            .eq('color_id', part.lego_colors.color_id)
            .single()
          
          if (metadata && !error) {
            // ✅ 메타데이터 생성 완료 - UI 즉시 업데이트
            part.metadata = metadata
            console.log(`✅ 메타데이터 생성 완료: ${part.lego_parts.part_num}`)
            successMessage.value = `메타데이터 생성 완료!\n부품: ${part.lego_parts.name}`
            
            setTimeout(() => {
              successMessage.value = ''
            }, 3000)
            return true
          }
          
          if (attempts >= maxAttempts) {
            console.log(`⏰ 메타데이터 생성 타임아웃: ${part.lego_parts.part_num}`)
            successMessage.value = `메타데이터 생성이 시간 초과되었습니다. 백그라운드에서 계속 진행 중입니다.`
            setTimeout(() => {
              successMessage.value = ''
            }, 5000)
            return false
          }
          
          // 다음 폴링 예약
          setTimeout(poll, interval)
          
        } catch (error) {
          console.error('메타데이터 상태 확인 실패:', error)
          if (attempts >= maxAttempts) {
            return false
          }
          setTimeout(poll, interval)
        }
      }
      
      // 첫 번째 폴링 시작
      setTimeout(poll, interval)
    }

    // ✅ 개별 부품 메타데이터 생성
    const generatePartMetadata = async (part) => {
      const partKey = `${part.lego_parts.part_num}-${part.lego_colors.color_id}`
      
      try {
        metadataGenerating.value[partKey] = true
        
        console.log(`🧠 메타데이터 생성 시작: ${part.lego_parts.part_num}`)
        
        // 백그라운드 분석을 위한 부품 데이터 준비
        const partData = {
          part: {
            part_num: part.lego_parts.part_num,
            name: part.lego_parts.name
          },
          color: {
            id: part.lego_colors.color_id,
            name: part.lego_colors.name
          }
        }
        
        // 백그라운드 분석 시작
        const setData = {
          set_num: 'individual-metadata',
          name: '개별 메타데이터 생성',
          id: 'individual-' + Date.now()
        }
        
        const taskId = await startBackgroundAnalysis(setData, [partData])
        
        console.log(`📋 백그라운드 작업 시작: ${taskId}`)
        
        successMessage.value = `🤖 백그라운드 LLM 분석 시작!\n\n📋 작업 ID: ${taskId}\n🧱 부품: ${part.lego_parts.name}\n\n🤖 자동 처리:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성\n• 데이터베이스 저장`
        
        // ✅ 메타데이터 상태 폴링 시작 (즉시 반응형 업데이트)
        pollMetadataStatus(part)
        
        // 3초 후 메시지 제거
        setTimeout(() => {
          successMessage.value = ''
        }, 5000)
        
      } catch (error) {
        console.error('메타데이터 생성 실패:', error)
        successMessage.value = `메타데이터 생성 실패: ${error.message}`
        
        setTimeout(() => {
          successMessage.value = ''
        }, 5000)
      } finally {
        metadataGenerating.value[partKey] = false
      }
    }

    // ✅ 개별 부품 메타데이터 재생성
    const regeneratePartMetadata = async (part) => {
      const partKey = `${part.lego_parts.part_num}-${part.lego_colors.color_id}`
      
      try {
        metadataGenerating.value[partKey] = true
        
        console.log(`🔄 메타데이터 재생성 시작: ${part.lego_parts.part_num}`)
        
        // ✅ 즉시 UI 업데이트: 기존 메타데이터 제거
        part.metadata = null
        console.log(`🔄 UI에서 기존 메타데이터 제거됨`)
        
        // 기존 메타데이터 삭제
        const { error: deleteError } = await supabase
          .from('parts_master_features')
          .delete()
          .eq('part_id', part.lego_parts.part_num)
          .eq('color_id', part.lego_colors.color_id)
        
        if (deleteError) {
          console.error('기존 메타데이터 삭제 실패:', deleteError)
        } else {
          console.log(`✅ DB에서 기존 메타데이터 삭제 완료`)
        }
        
        // 새로운 메타데이터 생성
        await generatePartMetadata(part)
        
      } catch (error) {
        console.error('메타데이터 재생성 실패:', error)
        successMessage.value = `메타데이터 재생성 실패: ${error.message}`
        
        setTimeout(() => {
          successMessage.value = ''
        }, 5000)
      } finally {
        metadataGenerating.value[partKey] = false
      }
    }

    onMounted(async () => {
      // ✅ 최적화: 통계와 세트 병렬 로드
      await Promise.all([
        loadStats(),
        loadSavedSets(1, itemsPerPage.value)
      ])
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
      toggleMetadata,
      getLoadingStatus,
      clearStorage,
      resetDatabase,
      resetProjectData,
      getPartImageUrl,
      getSetImageUrl,
      getDisplayValue,
      getSmartScale,
      getSmartShape,
      loadMore, // ✅ 무한 스크롤 함수 추가
      currentPage,
      itemsPerPage,
      // ✅ 메타데이터 생성 함수들
      generatePartMetadata,
      regeneratePartMetadata,
      metadataGenerating
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
  align-items: center;
  flex-wrap: wrap;
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

.stat-subtitle {
  font-size: 0.8rem;
  color: #28a745;
  font-weight: 600;
  margin: 0.25rem 0 0 0;
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

/* ✅ 더 보기 버튼 */
.load-more-section {
  margin: 2rem 0;
  text-align: center;
}

.load-more-btn {
  min-width: 200px;
  padding: 0.75rem 2rem;
  font-size: 1rem;
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

/* 배치 로딩 진행률 스타일 */
.batch-loading-progress {
  margin: 20px 0;
  padding: 15px;
  background: linear-gradient(135deg, #e8f5e8, #f0f8f0);
  border-radius: 8px;
  border: 1px solid #c8e6c9;
}

.batch-loading-progress h4 {
  margin: 0 0 15px 0;
  color: #2e7d32;
  font-weight: 600;
}

.batch-loading-progress .progress {
  position: relative;
  background: #f5f5f5;
  border-radius: 4px;
  height: 24px;
  margin: 0.5rem 0;
}

.batch-loading-progress .progress-bar {
  background: linear-gradient(90deg, #4caf50, #2e7d32);
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.batch-loading-progress .progress span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
}

.loading-errors {
  margin-top: 8px;
  padding: 6px 8px;
  background: #ffebee;
  border-radius: 4px;
  border-left: 3px solid #f44336;
}

.loading-errors small {
  color: #d32f2f;
  font-weight: 500;
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
  transition: transform 0.2s ease;
}

.part-image:hover {
  transform: scale(1.05);
}

/* WebP 배지 스타일 */
.webp-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
  z-index: 10;
}

.webp-badge-small {
  position: absolute;
  top: 2px;
  right: 2px;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 0.6rem;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(40, 167, 69, 0.3);
  z-index: 10;
}

.webp-badge-large {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  padding: 8px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  z-index: 10;
}

.set-image, .set-thumbnail, .set-large-image {
  position: relative;
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
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.metadata-badge {
  background: linear-gradient(135deg, #2196f3, #1976d2);
  color: white;
}

.no-metadata-badge {
  background: linear-gradient(135deg, #9e9e9e, #757575);
  color: white;
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

/* Element ID 스타일 */
.element-id-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.element-id-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-block;
}

.element-search-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #f8f9fa;
  border-radius: 50%;
  text-decoration: none;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.element-search-link:hover {
  background: #667eea;
  transform: scale(1.1);
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
  pointer-events: auto;
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
  cursor: default;
}

.tooltip-content details {
  cursor: pointer;
  margin-top: 10px;
  padding: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 6px;
}

.tooltip-content details summary {
  cursor: pointer;
  user-select: none;
  font-size: 0.8rem;
  color: #ccc;
  list-style-position: outside;
  padding-left: 4px;
}

.tooltip-content details summary:hover {
  color: #fff;
}

.tooltip-content details[open] summary {
  margin-bottom: 8px;
  color: #fff;
}

.tooltip-content details pre {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.7rem;
  background: rgba(0,0,0,0.3);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.tooltip-content h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: #fff;
  text-align: center;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 0.5rem;
}

.tooltip-hint {
  margin: 0 0 0.5rem 0;
  color: #ccc;
  font-size: 0.8rem;
  font-style: italic;
  text-align: center;
  background: rgba(255,255,255,0.1);
  padding: 0.25rem;
  border-radius: 4px;
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

/* ✅ 메타데이터 액션 버튼 스타일 */
.metadata-actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.metadata-generate-btn,
.metadata-regenerate-btn {
  font-size: 0.8rem;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.metadata-generate-btn {
  background: linear-gradient(135deg, #2196f3, #1976d2);
  color: white;
}

.metadata-generate-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1976d2, #1565c0);
  transform: translateY(-1px);
}

.metadata-regenerate-btn {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: white;
}

.metadata-regenerate-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #f57c00, #ef6c00);
  transform: translateY(-1px);
}

.metadata-generate-btn:disabled,
.metadata-regenerate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
