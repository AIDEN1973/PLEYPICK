<template>
  <div class="set-instructions-page">
    <div class="page-header">
      <h1>세트 설명서</h1>
      <p>레고번호를 입력하여 해당 세트의 공식 설명서를 확인할 수 있습니다.</p>
    </div>

    <div class="set-instructions-content">
      <div class="search-section">
        <div class="setup-card">
          <div class="card-body">
            <div class="form-group">
              <label>레고번호를 입력하세요.</label>
              <div class="set-search-wrapper" ref="setDropdownRef">
                <div class="set-search-input-row" ref="searchInputRef">
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
                <!-- 검색 툴팁 -->
                <div v-if="searchTooltip" class="search-tooltip">
                  <span>{{ searchTooltip }}</span>
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
                      <div class="option-content">
                        <div class="option-image-wrapper" :data-set-num="set.set_num">
                          <img
                            v-if="set.webp_image_url || set.set_img_url"
                            :src="set.webp_image_url || set.set_img_url"
                            :alt="set.name || set.set_num"
                            :data-set-id="set.id"
                            class="option-set-image"
                            @error="handleSetImageError($event, set)"
                            loading="eager"
                            crossorigin="anonymous"
                          />
                          <div v-else class="option-no-image">이미지 없음</div>
                        </div>
                        <div class="option-info">
                          <span class="option-set-num">{{ formatSetNumber(set.set_num) }}</span>
                          <span class="option-set-title">{{ [set.theme_name, set.name].filter(Boolean).join(' ') || (set.name || '') }}</span>
                          <span class="option-set-parts">부품수 : {{ resolvePartCount(set) }}개</span>
                        </div>
                      </div>
                    </button>
                  </div>
                </transition>
                <div v-if="selectedSetId && selectedSet" class="selected-set-info">
                  <button class="close-result-button" @click="resetPage" title="초기화">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                  <div class="selected-set-row">
                    <div class="selected-set-thumb-wrapper">
                      <img
                        v-if="selectedSet.webp_image_url || selectedSet.set_img_url"
                        :src="selectedSet.webp_image_url || selectedSet.set_img_url"
                        :alt="selectedSet.name || selectedSet.set_num"
                        class="selected-set-thumb"
                        @error="handleSelectedSetImageError"
                      />
                      <div v-else class="selected-set-no-image">이미지 없음</div>
                    </div>
                    <div class="selected-set-text">
                      <div class="selected-set-number">{{ formatSetNumber(selectedSet.set_num) }}</div>
                      <div class="selected-set-meta">
                        <span v-if="selectedSet.theme_name" class="selected-set-theme">{{ selectedSet.theme_name }}</span>
                        <span v-if="selectedSet.name" class="selected-set-name">{{ selectedSet.name }}</span>
                      </div>
                      <span class="selected-set-parts">부품수 : {{ resolvePartCount(selectedSet) }}개</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showStoreSetsSection"
        class="store-sets-section"
      >
        <div class="result-header">
          <h3>레고 리스트</h3>
          <span class="result-count">(총 {{ storeSetsCount }}개)</span><!-- // 🔧 수정됨 -->
        </div>
        <div class="sets-grid">
          <div
            v-for="set in paginatedStoreSets"
            :key="set.id || set.set_num"
            class="set-card"
          >
            <div class="set-image">
              <img
                v-if="set.image_url"
                :src="set.image_url"
                :alt="set.name || set.set_num"
              />
              <div v-else class="no-image">이미지 없음</div>
            </div>
            <div class="set-info">
              <div class="set-name-container">
                <span class="set-number-badge">{{ formatSetNumber(set.set_num) }}</span>
                <div class="set-name-wrapper">
                  <span v-if="set.theme_name" class="set-theme-name">{{ set.theme_name }}</span>
                  <span v-if="set.theme_name && set.name" class="set-name-divider">|</span>
                  <span v-if="set.name" class="set-name-text">{{ set.name }}</span>
                </div>
              </div>
              <div class="set-stats">
                <span class="set-quantity">부품수 : {{ resolvePartCount(set) }}개</span>
                <span v-if="set.quantity" class="inventory-badge">재고: {{ set.quantity }}개</span>
              </div>
              <div class="set-actions">
                <button
                  type="button"
                  class="instruction-card-button"
                  @click.stop="viewInstructionsFromStore(set)"
                >
                  설명서 보기
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="totalPages > 1" class="pagination">
          <button
            class="pagination-button"
            :class="{ disabled: currentPage === 1 }"
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
          >
            이전
          </button>
          <div class="pagination-numbers">
            <span
              v-for="page in visiblePages"
              :key="page"
            >
              <button
                v-if="page !== '...'"
                class="pagination-number"
                :class="{ active: page === currentPage }"
                @click="goToPage(page)"
              >
                {{ page }}
              </button>
              <span v-else class="pagination-ellipsis">...</span>
            </span>
          </div>
          <button
            class="pagination-button"
            :class="{ disabled: currentPage === totalPages }"
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
          >
            다음
          </button>
        </div>
      </div>

      <div v-if="instructionLoading" class="loading-state">로딩 중...</div>
      <div v-else-if="instructionError" class="error-state">{{ instructionError }}</div>
      <div v-else-if="!instructionLoading && selectedSet && instructions.length === 0" class="empty-state">설명서를 찾을 수 없습니다.</div>
      <div v-if="!instructionLoading && instructions.length > 0" class="instructions-section">
        <div class="instructions-header">
          <h2>설명서 목록</h2>
          <p>{{ instructions.length }}개 설명서를 찾았습니다.</p>
        </div>
        <div class="instructions-grid">
          <div
            v-for="instruction in instructions"
            :key="instruction.id"
            class="instruction-card"
          >
              <div v-if="instruction.thumbnail" class="instruction-thumbnail">
                <img
                  :src="instruction.thumbnail"
                  :alt="instruction.title"
                  @error="handleThumbnailError"
                />
              </div>
            <div v-else class="instruction-thumbnail-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
              <div class="instruction-info">
                <h3 class="instruction-title">{{ instruction.title }}</h3>
                <p v-if="instruction.description" class="instruction-description">{{ instruction.description }}</p>
                <div class="instruction-meta">
                <span v-if="instruction.source" class="instruction-source">{{ instruction.source }}</span>
                <span v-if="instruction.fileSize" class="instruction-size">{{ instruction.fileSize }}</span>
              </div>
            </div>
            <div class="instruction-actions">
              <a
                class="download-button"
                :href="instruction.url"
                target="_blank"
                rel="noopener"
              >
                다운로드
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'
import { formatSetNumber } from '../utils/setDisplay'

export default {
  name: 'SetInstructions',
  setup() {
    const { supabase, user } = useSupabase()
    const { getStoreInfoByEmail, getStoreInventory } = useSupabasePleyon()

    const loading = ref(false)
    const instructionLoading = ref(false)
    const instructionError = ref(null)
    const instructions = ref([])
    const setSearchQuery = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0)
    const selectedSet = ref(null)
    const selectedSetId = ref('')
    const showSetDropdown = ref(false)
    const setDropdownRef = ref(null)
    const searchInputRef = ref(null)

    const storeInventory = ref([])
    const storeInfo = ref(null)
    const storeSets = ref([])
    const storeSetsCount = computed(() => storeSets.value.length) // 🔧 수정됨
    const currentPage = ref(1)
    const itemsPerPage = 40

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'

    const DEFAULT_THUMBNAIL = 'https://www.lego.com/cdn/product-assets/product.bi.core.img/6602638.png?format=webply&fit=crop&quality=75&width=230&height=230&dpr=1'

    const deriveThumbnailFromPdfUrl = (pdfUrl) => {
      if (!pdfUrl) return null
      const match = pdfUrl.match(/product\.bi\.core\.pdf\/(\d+)\.pdf/i)
      if (!match) return null
      const assetId = match[1]
      return `https://www.lego.com/cdn/product-assets/product.bi.core.img/${assetId}.png?format=webply&fit=crop&quality=75&width=230&height=230&dpr=1`
    }

    // 간단한 메모리 캐시 (세트 번호별로 캐싱)
    const instructionCache = new Map()
    const setSearchCache = new Map()
    const CACHE_TTL = 5 * 60 * 1000 // 5분

    const fetchLegoInstructionsFromWeb = async (setNum, fallbackThumbnail = null) => { // 🔧 수정됨
      // 캐시 확인
      const cacheKey = `${setNum}-${fallbackThumbnail || ''}`
      const cached = instructionCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('[SetInstructions] 캐시에서 설명서 로드:', setNum)
        return cached.data
      }

      const locales = ['en-au', 'en-us', 'en-gb', 'ko-kr']
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      try {
        for (const locale of locales) {
          const legoPath = `${locale}/service/buildinginstructions/${setNum}`
          
          // 프로덕션/개발 모드에 따라 프록시 URL 결정
          const isDev = import.meta.env.DEV
          let proxyUrl
          
          if (isDev) {
            // 개발 모드: 로컬 프록시 서버 사용 (Vite 프록시)
            proxyUrl = `/api/lego-instructions/${legoPath}`
          } else {
            // 프로덕션 모드: Vercel 서버리스 함수 사용
            proxyUrl = `/api/lego-instructions/${legoPath}`
          }
          
          console.log('[SetInstructions] 프록시 URL 시도:', proxyUrl, `(locale: ${locale})`)
          
          try {
            const response = await fetch(proxyUrl, {
              headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              signal: controller.signal
            })

            if (!response.ok) {
              console.warn(`[SetInstructions] Locale ${locale} 실패: ${response.status}`)
              continue
            }

            const html = await response.text()
            console.log(`[SetInstructions] Locale ${locale} HTML 길이:`, html.length)

            // window.__INITIAL_STATE__ 에서 설명서 정보 추출
            const instructionEntries = []
            const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s)
            if (initialStateMatch) {
              try {
                const stateData = JSON.parse(initialStateMatch[1])
                const candidates = stateData?.instructions || stateData?.buildingInstructions || stateData?.product?.instructions || []
                if (Array.isArray(candidates) && candidates.length > 0) {
                  candidates.forEach((inst, index) => {
                    const url = inst?.url || inst?.pdfUrl || inst?.downloadUrl || inst?.pdf || null
                    if (!url || !url.includes('.pdf')) return
                    const pdfUrl = url.startsWith('http') ? url : `https://www.lego.com${url}`
                    const resolvedThumbnail = inst?.thumbnail || inst?.image || inst?.thumbnailUrl || deriveThumbnailFromPdfUrl(pdfUrl) || fallbackThumbnail || DEFAULT_THUMBNAIL
                    instructionEntries.push({
                      id: pdfUrl || `instruction-${index}`,
                      title: inst?.title || inst?.name || `Building Instructions ${setNum} - Part ${index + 1}`,
                      description: inst?.description || null,
                      url: pdfUrl,
                      thumbnail: resolvedThumbnail,
                      source: 'LEGO.com',
                      fileSize: inst?.fileSize || null
                    })
                  })
                }
              } catch (err) {
                console.warn(`[SetInstructions] Locale ${locale} 초기 상태 JSON 파싱 실패:`, err)
              }
            }

            if (instructionEntries.length > 0) {
              clearTimeout(timeoutId)
              // 캐시에 저장
              instructionCache.set(cacheKey, {
                data: instructionEntries,
                timestamp: Date.now()
              })
              console.log(`[SetInstructions] Locale ${locale}에서 설명서 찾음:`, instructionEntries.length, '개')
              return instructionEntries
            }

            // JSON-LD 스크립트 태그에서 설명서 데이터 추출 시도
            const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gs)
            for (const jsonLdMatch of jsonLdMatches) {
              try {
                const jsonLdData = JSON.parse(jsonLdMatch[1])
                if (jsonLdData['@type'] === 'Product' && jsonLdData.offers) {
                  const offers = Array.isArray(jsonLdData.offers) ? jsonLdData.offers : [jsonLdData.offers]
                  offers.forEach((offer, index) => {
                    if (offer.url && offer.url.includes('.pdf')) {
                      instructionEntries.push({
                        id: offer.url || `instruction-ld-${index}`,
                        title: `Building Instructions ${setNum} - Part ${index + 1}`,
                        description: null,
                        url: offer.url,
                        thumbnail: deriveThumbnailFromPdfUrl(offer.url) || fallbackThumbnail || DEFAULT_THUMBNAIL,
                        source: 'LEGO.com',
                        fileSize: null
                      })
                    }
                  })
                }
              } catch (e) {
                // JSON-LD 파싱 실패 시 무시
              }
            }

            if (instructionEntries.length > 0) {
              clearTimeout(timeoutId)
              instructionCache.set(cacheKey, {
                data: instructionEntries,
                timestamp: Date.now()
              })
              console.log(`[SetInstructions] Locale ${locale} JSON-LD에서 설명서 찾음:`, instructionEntries.length, '개')
              return instructionEntries
            }

            // 빠른 PDF URL 추출 (정규식만 사용)
            const pdfRegex = /https?:\/\/[^"'\\s]*\/cdn\/product-assets\/product\.bi\.core\.pdf\/\d+\.pdf/gi
            const matches = [...html.matchAll(pdfRegex)]
            let urls = [...new Set(matches.map(m => m[0]).filter(Boolean))]

            if (urls.length === 0) {
              // 더 넓은 패턴 시도
              const broadRegex = /https?:\/\/[^"'\\s]*\/cdn\/product-assets\/[^"'\\s]*\.pdf/gi
              const broadMatches = [...html.matchAll(broadRegex)]
              urls = [...new Set(broadMatches.map(m => m[0]).filter(Boolean))]
            }

            // 상대 경로도 시도
            if (urls.length === 0) {
              const relativeRegex = /\/cdn\/product-assets\/product\.bi\.core\.pdf\/\d+\.pdf/gi
              const relativeMatches = [...html.matchAll(relativeRegex)]
              urls = relativeMatches.map(m => `https://www.lego.com${m[0]}`)
            }

            const uniqueUrls = [...new Set(urls)]
            if (uniqueUrls.length > 0) {
              const result = uniqueUrls.map((url, index) => {
                const derivedThumbnail = deriveThumbnailFromPdfUrl(url) || fallbackThumbnail || DEFAULT_THUMBNAIL
                return {
                  id: `${setNum}-pdf-${index}`,
                  title: `Building Instructions ${setNum} - Part ${index + 1}`,
                  description: null,
                  url,
                  thumbnail: derivedThumbnail,
                  source: 'LEGO.com',
                  fileSize: null
                }
              })

              clearTimeout(timeoutId)
              // 캐시에 저장
              instructionCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
              })
              console.log(`[SetInstructions] Locale ${locale} 정규식에서 설명서 찾음:`, result.length, '개')
              return result
            }
          } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') {
              throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
            }
            console.warn(`[SetInstructions] Locale ${locale} fetch 오류:`, fetchErr)
            continue
          }
        }

        // 모든 로케일에서 실패
        clearTimeout(timeoutId)
        console.warn('[SetInstructions] 모든 로케일에서 설명서를 찾지 못함:', setNum)
        return []
      } catch (err) {
        clearTimeout(timeoutId)
        if (err.name === 'AbortError') {
          throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
        }
        throw err
      }
    }

    const createManualSetFromQuery = (query) => { // 🔧 수정됨
      const value = String(query || '').trim()
      if (!value) return null
      return {
        id: `manual-${value}`,
        set_num: value,
        name: null,
        theme_name: null,
        num_parts: null,
        part_count: null,
        webp_image_url: null,
        set_img_url: null
      }
    }

    const resolvePartCount = (set) => { // 🔧 수정됨
      if (!set) return 0
      const candidates = [set.part_count, set.num_parts]
      for (const value of candidates) {
        if (value === null || value === undefined) continue
        const numeric = Number(value)
        if (Number.isFinite(numeric)) {
          return numeric
        }
      }
      return 0
    }

    const resetPage = () => {
      setSearchQuery.value = ''
      selectedSetId.value = ''
      selectedSet.value = null
      searchResults.value = []
      searchResultsKey.value++
      showSetDropdown.value = false
      instructions.value = []
      instructionError.value = null
    }

    // 전체 레고 세트 로드 (매장 인벤토리 필터 제거)
    const loadStoreInventory = async () => {
      console.log('[SetInstructions] 전체 레고 세트 로드 시작')
      // 매장 계정 필터 없이 전체 세트 로드
      await loadStoreSets()
    }

    const loadStoreSets = async () => {
      try {
        loading.value = true
        
        // 전체 레고 세트 조회 (페이지네이션으로 처리)
        const batchSize = 1000
        let allSetsData = []
        let offset = 0
        let hasMore = true
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url, created_at')
            .order('created_at', { ascending: false })
            .range(offset, offset + batchSize - 1)
          
          if (error) {
            console.error('[SetInstructions] lego_sets 조회 오류:', error)
            throw error
          }
          
          if (data && data.length > 0) {
            allSetsData.push(...data)
            offset += batchSize
            hasMore = data.length === batchSize
          } else {
            hasMore = false
          }
        }

        if (!allSetsData.length) {
          storeSets.value = []
          loading.value = false
          return
        }

        const themeIds = [...new Set(allSetsData.map(s => s.theme_id).filter(Boolean))]
        let themeMap = new Map()
        if (themeIds.length) {
          const { data: themesData, error: themesError } = await supabase
            .from('lego_themes')
            .select('theme_id, name')
            .in('theme_id', themeIds)

          if (!themesError && themesData) {
            themeMap = new Map(themesData.map(t => [t.theme_id, t.name]))
          }
        }

        storeSets.value = allSetsData
          .map(set => {
            const normalizedImage =
              set.webp_image_url ||
              set.set_img_url ||
              null
            return {
              id: set.id,
              set_num: set.set_num,
              name: set.name,
              theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
              image_url: normalizedImage,
              webp_image_url: set.webp_image_url || null,
              set_img_url: set.set_img_url || null,
              num_parts: set.num_parts || null,
              part_count: resolvePartCount(set),
              quantity: 0
            }
          })
          // 최근 등록 순으로 정렬 (created_at 기준, 이미 DB에서 정렬됨)
          // 추가 정렬 불필요

        currentPage.value = 1
        loading.value = false
        console.log('[SetInstructions] 전체 레고 세트 로드 완료:', storeSets.value.length, '개')
      } catch (err) {
        console.error('[SetInstructions] 전체 레고 세트 로드 실패:', err)
        storeSets.value = []
        loading.value = false
      }
    }

    const totalPages = computed(() => Math.ceil(storeSets.value.length / itemsPerPage) || 0)

    const paginatedStoreSets = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage
      return storeSets.value.slice(start, start + itemsPerPage)
    })

    const visiblePages = computed(() => {
      const pages = []
      const total = totalPages.value
      const current = currentPage.value

      if (total <= 7) {
        for (let i = 1; i <= total; i++) {
          pages.push(i)
        }
      } else if (current <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(total)
      } else if (current >= total - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = total - 4; i <= total; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = current - 1; i <= current + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(total)
      }

      return pages
    })

    const goToPage = (page) => {
      if (typeof page !== 'number') return
      if (page < 1 || page > totalPages.value || page === currentPage.value) return
      currentPage.value = page
    }

    const showStoreSetsSection = computed(() => {
      return (
        !loading.value &&
        !instructionLoading.value &&
        !setSearchQuery.value.trim() &&
        !selectedSetId.value &&
        storeSets.value.length > 0
      )
    })

    const viewInstructionsFromStore = (set) => {
      if (!set) return
      const normalizedSet = {
        ...set,
        webp_image_url: set.webp_image_url || set.image_url || null,
        set_img_url: set.set_img_url || set.image_url || null
      }
      handleSelectSet(normalizedSet)
    }

    const getSetNumberForApi = (setNum) => { // 🔧 수정됨
      if (!setNum) return ''
      const value = String(setNum).trim()
      if (!value) return ''
      return value.includes('-') ? value : `${value}-1`
    }

    const formatFileSize = (bytes) => { // 🔧 수정됨
      if (!bytes || Number.isNaN(Number(bytes))) return null
      const size = Number(bytes)
      if (size < 1024) return `${size} B`
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
      if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }

    const normalizeImageUrl = (set) => { // 🔧 수정됨
      if (!set) return set
      let webpImageUrl = set.webp_image_url
      if (webpImageUrl) {
        if (!webpImageUrl.startsWith('http')) {
          if (webpImageUrl.startsWith('/storage/')) {
            webpImageUrl = `${supabaseUrl}${webpImageUrl}`
          } else if (webpImageUrl.startsWith('storage/')) {
            webpImageUrl = `${supabaseUrl}/${webpImageUrl}`
          }
        }
      } else if (set.set_img_url) {
        webpImageUrl = set.set_img_url
      }
      return {
        ...set,
        webp_image_url: webpImageUrl,
        part_count: resolvePartCount(set)
      }
    }

    const isCacheValid = (entry) => entry && (Date.now() - entry.timestamp < CACHE_TTL)

    const searchSets = async () => { // 🔧 수정됨
      if (!setSearchQuery.value.trim()) {
        searchResults.value = []
        showSetDropdown.value = false
        return
      }

      try {
        loading.value = true
        const query = setSearchQuery.value.trim()
        const mainSetNum = query.split('-')[0]
        const cacheKey = `${query}:${mainSetNum}`
        const cached = setSearchCache.get(cacheKey)
        if (isCacheValid(cached)) {
          searchResults.value = cached.data
          showSetDropdown.value = searchResults.value.length > 0
          loading.value = false
          return
        }

        let results = []

        const [exactMatchResult, mainMatchResult] = await Promise.allSettled([
          supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
          .eq('set_num', query)
            .limit(20),
          supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .eq('set_num', mainSetNum)
            .limit(20)
        ])

        const exactMatch =
          exactMatchResult.status === 'fulfilled' && !exactMatchResult.value.error
            ? exactMatchResult.value.data || []
            : []
        const mainMatch =
          mainMatchResult.status === 'fulfilled' && !mainMatchResult.value.error
            ? mainMatchResult.value.data || []
            : []

        if (exactMatch.length > 0) {
          results = exactMatch
        } else if (mainMatch.length > 0) {
            results = mainMatch
          } else {
            const { data: likeMatch, error: likeError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
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
        } else if (
          (exactMatchResult.status === 'rejected') ||
          (mainMatchResult.status === 'rejected')
        ) {
          console.warn('[SetInstructions] set 검색 실패:', {
            exact: exactMatchResult.status === 'rejected' ? exactMatchResult.reason : null,
            main: mainMatchResult.status === 'rejected' ? mainMatchResult.reason : null
          })
        }

        results = results.map(set => normalizeImageUrl(set))

        // 캐시에 저장
        setSearchCache.set(cacheKey, {
          data: results,
          timestamp: Date.now()
        })

        searchResults.value = results
        searchResultsKey.value++
        showSetDropdown.value = searchResults.value.length > 0
      } catch (err) {
        console.error('설명서용 세트 검색 실패:', err)
        searchResults.value = []
        showSetDropdown.value = false
      } finally {
        loading.value = false
      }
    }

    const fetchInstructions = async (set) => { // 🔧 수정됨
      if (!set) {
        console.warn('[SetInstructions] fetchInstructions: set이 없습니다')
        return
      }
      
      console.log('[SetInstructions] fetchInstructions 시작:', { set_num: set.set_num, set })
      instructionLoading.value = true
      instructionError.value = null
      instructions.value = []

      try {
        const mainSetNum = formatSetNumber(set.set_num)
        console.log('[SetInstructions] 포맷된 세트 번호:', mainSetNum)
        
        const fallbackThumbnail = set.webp_image_url || set.set_img_url || null
        const downloadableInstructions = await fetchLegoInstructionsFromWeb(mainSetNum, fallbackThumbnail)
        instructions.value = downloadableInstructions
        if (instructions.value.length === 0) {
          instructionError.value = '다운로드 가능한 설명서를 찾을 수 없습니다.'
        }
      } catch (err) {
        console.error('[SetInstructions] 설명서 조회 실패:', err)
        instructionError.value = err?.message || '설명서를 불러오는데 실패했습니다.'
      } finally {
        instructionLoading.value = false
        console.log('[SetInstructions] fetchInstructions 완료:', {
          instructionsCount: instructions.value.length,
          error: instructionError.value
        })
      }
    }

    const searchTooltip = ref('')
    let searchTooltipTimer = null

    const showSearchTooltip = (message) => {
      if (searchTooltipTimer) {
        clearTimeout(searchTooltipTimer)
      }
      searchTooltip.value = message
      searchTooltipTimer = setTimeout(() => {
        searchTooltip.value = ''
        searchTooltipTimer = null
      }, 3000)
    }

    const handleSearchEnter = async () => { // 🔧 수정됨
      const query = setSearchQuery.value.trim()
      if (!query) {
        searchResults.value = []
        showSetDropdown.value = false
        showSearchTooltip('검색어를 입력해주세요.')
        return
      }

      await searchSets()

      if (searchResults.value.length === 1) {
        handleSelectSet(searchResults.value[0])
      } else if (searchResults.value.length > 0) {
        showSetDropdown.value = true
      } else {
        const manualSet = createManualSetFromQuery(query)
        if (manualSet) {
          selectedSet.value = manualSet
          selectedSetId.value = manualSet.id
          setSearchQuery.value = ''
          searchResults.value = []
          showSetDropdown.value = false
          fetchInstructions(manualSet)
        }
      }
    }

    const handleSearchBlur = () => { // 🔧 수정됨
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    const handleSelectSet = (set) => { // 🔧 수정됨
      selectedSet.value = set
      selectedSetId.value = set.id
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      fetchInstructions(set)
    }

    const handleSetImageError = (event) => { // 🔧 수정됨
      const img = event.target
      const wrapper = img.closest('.option-image-wrapper')
      if (wrapper) {
        img.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;'
        let noImageDiv = wrapper.querySelector('.option-no-image')
        if (!noImageDiv) {
          noImageDiv = document.createElement('div')
          noImageDiv.className = 'option-no-image'
          noImageDiv.textContent = '이미지 없음'
          wrapper.appendChild(noImageDiv)
        }
        noImageDiv.style.cssText = 'display: flex !important; z-index: 2 !important;'
      }
    }

    const handleSelectedSetImageError = (event) => { // 🔧 수정됨
      event.target.style.display = 'none'
      const wrapper = event.target.closest('.selected-set-thumb-wrapper')
      if (wrapper) {
        const placeholder = document.createElement('div')
        placeholder.className = 'selected-set-no-image'
        placeholder.textContent = '이미지 없음'
        wrapper.appendChild(placeholder)
      }
    }

    const handleThumbnailError = (event) => { // 🔧 수정됨
      event.target.style.display = 'none'
    }

    watch(user, async (newUser) => {
      // 로그인 상태와 관계없이 전체 레고 세트 로드
      await loadStoreInventory()
    }, { immediate: true })

    return {
      loading,
      instructionLoading,
      instructionError,
      instructions,
      setSearchQuery,
      searchResults,
      searchResultsKey,
      selectedSet,
      selectedSetId,
      showSetDropdown,
      setDropdownRef,
      formatSetNumber,
      resolvePartCount,
      handleSearchEnter,
      handleSearchBlur,
      handleSelectSet,
      searchTooltip,
      searchInputRef,
      handleSetImageError,
      handleSelectedSetImageError,
      handleThumbnailError,
      resetPage,
      storeSets,
      storeSetsCount, // 🔧 수정됨
      paginatedStoreSets,
      visiblePages,
      totalPages,
      currentPage,
      goToPage,
      showStoreSetsSection,
      viewInstructionsFromStore
    }
  }
}
</script>

<style scoped>
/* 검색 툴팁 스타일 */
.set-search-wrapper {
  position: relative;
  overflow: visible;
}

.search-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: #1f2937;
  color: #ffffff;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  z-index: 10000;
  font-size: 0.875rem;
  white-space: nowrap;
  animation: slideInTooltip 0.3s ease;
}

.search-tooltip::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 1rem;
  border: 6px solid transparent;
  border-bottom-color: #1f2937;
}

@keyframes slideInTooltip {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.set-instructions-page {
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

.set-instructions-content {
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
  overflow: visible;
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
  overflow: visible;
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
  transition: background-color 0.15s ease, color 0.15s ease;
}

.custom-select-option:hover {
  background: #f5f7ff;
}

.custom-select-option.active {
  background: #e0e7ff;
  color: #1d4ed8;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 1.5rem; /* // 🔧 수정됨 */
  width: 100%;
}

.option-image-wrapper {
  width: 80px;
  height: 80px;
  min-width: 80px;
  min-height: 80px;
  flex-shrink: 0;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.option-set-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.5rem;
}

.option-no-image {
  color: #9ca3af;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.5rem;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.option-set-num {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.option-set-title {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.875rem;
  color: #374151;
}

.option-set-parts {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: #6b7280;
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
  gap: 0.5rem;
  position: relative;
}

.close-result-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 22px; /* // 🔧 수정됨 */
  height: 22px; /* // 🔧 수정됨 */
  background: #ffffff; /* // 🔧 수정됨 */
  border: 1px solid #e5e7eb; /* // 🔧 수정됨 */
  border-radius: 9999px; /* // 🔧 수정됨 */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #4b5563; /* // 🔧 수정됨 */
  transition: all 0.2s ease;
  padding: 0;
  z-index: 10;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06); /* // 🔧 수정됨 */
}

.close-result-button:hover {
  background: #f9fafb; /* // 🔧 수정됨 */
  color: #374151; /* // 🔧 수정됨 */
  border-color: #d1d5db; /* // 🔧 수정됨 */
}

.close-result-button svg { /* // 🔧 수정됨 */
  width: 12px;
  height: 12px;
}

.close-result-button:active {
  transform: scale(0.95);
}

.selected-set-row {
  display: flex;
  align-items: center;
  gap: 1.25rem; /* // 🔧 수정됨 */
}

.selected-set-thumb-wrapper {
  width: 100px;
  height: 100px;
  min-width: 100px;
  min-height: 100px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.selected-set-thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  padding: 0.5rem;
}

.selected-set-no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #9ca3af;
  background: #f9fafb;
}

.selected-set-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.store-sets-section { /* // 🔧 수정됨 */
  margin-bottom: 3rem;
  width: 100%;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.result-header { /* // 🔧 수정됨 */
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.result-header h3 { /* // 🔧 수정됨 */
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.result-count { /* // 🔧 수정됨 */
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
}

.sets-grid { /* // 🔧 수정됨 */
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.5rem;
  max-width: 100%;
}

@media (min-width: 1400px) {
  .sets-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1200px) and (min-width: 900px) {
  .sets-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  }
}

@media (max-width: 900px) and (min-width: 600px) {
  .sets-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  }
}

@media (max-width: 1024px) {
  .sets-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

.set-card { /* // 🔧 수정됨 */
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: default;
  transition: none;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.set-card:hover { /* // 🔧 수정됨 */
  transform: none;
  box-shadow: none;
}

.set-image { /* // 🔧 수정됨 */
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.set-image img { /* // 🔧 수정됨 */
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.no-image { /* // 🔧 수정됨 */
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: center;
}

.set-info { /* // 🔧 수정됨 */
  padding: 1rem;
}

.set-name-container { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.set-number-badge { /* // 🔧 수정됨 */
  display: inline-block;
  padding: 0.375rem 0.75rem;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 20px;
  width: fit-content;
  line-height: 1.2;
}

.set-name-wrapper { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
  overflow: hidden;
}

.set-theme-name { /* // 🔧 수정됨 */
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  line-height: 1.4;
}

.set-name-divider { /* // 🔧 수정됨 */
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.875rem;
  color: #d1d5db;
  line-height: 1.4;
}

.set-name-text { /* // 🔧 수정됨 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.set-stats { /* // 🔧 수정됨 */
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.set-quantity { /* // 🔧 수정됨 */
  font-size: 0.875rem;
  color: #3b82f6;
  font-weight: 500;
  margin: 0;
}

.inventory-badge { /* // 🔧 수정됨 */
  font-size: 0.8125rem;
  color: #1f2937;
  background: #f3f4f6;
  border-radius: 9999px;
  padding: 0.25rem 0.75rem;
  width: fit-content;
}

.set-actions { /* // 🔧 수정됨 */
  margin-top: 0.75rem;
  display: flex;
  justify-content: flex-end;
}

.instruction-card-button { /* // 🔧 수정됨 */
  padding: 0.4375rem 0.9375rem;
  background: #ffffff;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.instruction-card-button:hover { /* // 🔧 수정됨 */
  background: #f9fafb;
  border-color: #9ca3af;
  color: #111827;
}

.instruction-card-button:active { /* // 🔧 수정됨 */
  transform: scale(0.96);
}

.pagination { /* // 🔧 수정됨 */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.pagination-button { /* // 🔧 수정됨 */
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-button.disabled,
.pagination-button:disabled { /* // 🔧 수정됨 */
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-numbers { /* // 🔧 수정됨 */
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pagination-number { /* // 🔧 수정됨 */
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-number.active { /* // 🔧 수정됨 */
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.pagination-ellipsis { /* // 🔧 수정됨 */
  color: #9ca3af;
  font-size: 0.875rem;
}

.selected-set-number {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
}

.selected-set-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  flex-wrap: wrap;
}

.selected-set-theme {
  font-weight: 500;
  color: #6b7280;
}

.selected-set-name {
  font-weight: 700;
  color: #374151;
  line-height: 1.4;
  word-break: break-word;
}

.selected-set-parts {
  display: block;
  font-size: 0.8125rem;
  color: #6b7280;
  margin-top: 0rem;
}

.loading-state,
.error-state,
.empty-state {
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

.instructions-section {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.instructions-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}

.instructions-header p {
  margin: 0.25rem 0 0;
  color: #6b7280;
}

.instructions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.instruction-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.instruction-card:hover {
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
  transform: translateY(-2px);
}

.instruction-thumbnail {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: transparent;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.instruction-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.5rem;
}

.instruction-thumbnail-placeholder {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: transparent;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.instruction-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.instruction-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.instruction-description {
  font-size: 0.875rem;
  color: #4b5563;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.instruction-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.instruction-source {
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  border-radius: 4px;
}

.instruction-size {
  color: #6b7280;
}

.instruction-actions {
  display: flex;
  justify-content: stretch;
  margin-top: auto;
}

.download-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.75rem 1rem;
  background: #2563eb;
  color: #ffffff;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s ease;
}

.download-button:hover {
  background: #1d4ed8;
}

@media (max-width: 768px) {
  .set-instructions-page {
    padding: 1rem;
  }

  .page-header {
    margin-bottom: 1rem;
  }

  .page-header h1 {
    font-size: 1.25rem;
  }

  .page-header p {
    font-size: 0.875rem;
  }

  .search-section {
    margin-bottom: 1.5rem;
  }

  .card-body {
    padding: 1rem;
  }

  .set-search-input-row {
    flex-direction: row;
  }

  .instructions-section {
    gap: 1rem;
  }

  .instructions-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }

  .instruction-card {
    padding: 1rem;
  }
}
</style>
