<template>
  <div class="missing-parts-page">
    <div class="page-header">
      <h1>누락부품</h1>
      <p>세트별 누락된 부품을 확인할 수 있는 페이지입니다.</p>
    </div>

    <div class="missing-parts-content">
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
                      <span class="option-set-num">{{ formatSetNumber(set.set_num) }}</span>
                      <span class="option-set-title">{{ [set.theme_name, set.name].filter(Boolean).join(' ') || (set.name || '') }}</span>
                      <span class="option-set-parts">부품수 : {{ resolvePartCount(set) }}개</span>
                    </button>
                  </div>
                </transition>
                <div v-if="selectedSetId && selectedSet" class="selected-set-info">
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

      <div v-if="loading" class="loading-state">
        <span>로딩 중...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>

      <div v-if="!loading && !error && missingPartsBySet.length > 0" class="missing-parts-list">
        <div
          v-for="setGroup in missingPartsBySet"
          :key="setGroup.set_id"
          class="set-group"
        >
          <div class="set-group-header">
            <div class="set-title">
              <div v-if="setGroup.sessionInfo" class="session-stats">
                <span v-if="setGroup.sessionInfo.status" class="stat-badge status" :class="`status-${setGroup.sessionInfo.status}`">
                  {{ statusLabel(setGroup.sessionInfo.status) }}
                </span>
                <span v-if="setGroup.sessionInfo.progress !== undefined" class="stat-badge progress">{{ setGroup.sessionInfo.progress }}%</span>
                <span v-if="setGroup.missing_parts.length > 0" class="stat-badge missing">
                  {{ setGroup.missing_parts.length }}개 분류, 총 {{ setGroup.total_missing_count }}개
                </span>
                <span v-if="setGroup.sessionInfo.completed_at || setGroup.sessionInfo.last_saved_at" class="stat-badge time">
                  {{ formatTime(setGroup.sessionInfo.completed_at || setGroup.sessionInfo.last_saved_at) }}
                </span>
              </div>
            </div>
          </div>

          <div class="parts-grid">
            <div
              v-for="part in setGroup.missing_parts"
              :key="`${part.part_id}-${part.color_id}`"
              class="part-card"
            >
              <div class="card-header">
                <div class="part-info">
                  <div v-if="part.element_id" class="element-id">
                    {{ part.element_id }}
                  </div>
                  <h4 class="part-name">{{ part.part_name }}</h4>
                  <span 
                    class="color-badge"
                    :style="{ 
                      backgroundColor: getColorRgb(part.color_rgb) || '#ccc'
                    }"
                  >
                    {{ (part.color_name && part.color_name.trim()) ? part.color_name : `Color ${part.color_id}` }}
                  </span>
                </div>
              </div>
              <div class="card-body">
                <div class="part-image-section">
                  <img
                    v-if="part.supabase_image_url"
                    :src="part.supabase_image_url"
                    :alt="part.part_name"
                    class="part-image"
                    @error="handleImageError($event)"
                  />
                  <div v-else class="no-part-image">이미지 없음</div>
                </div>
                <div class="quantity-section">
                  <div class="quantity-badge">{{ part.missing_count }}개</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabase } from '../composables/useSupabase'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'
import { usePleyonInventorySync } from '../composables/usePleyonInventorySync'
import { formatSetDisplay, formatSetNumber, fetchSetMetadata } from '../utils/setDisplay'

export default {
  name: 'MissingParts',
  setup() {
    const { supabase, user } = useSupabase()
    const { getStoreInfoByEmail, getStoreInventory } = useSupabasePleyon()
    const { checkSetPartsExist, syncSetParts } = usePleyonInventorySync()
    const route = useRoute()

    const loading = ref(false)
    const error = ref(null)
    const missingParts = ref([])
    const selectedSetId = ref('')
    const setSearchQuery = ref('')
    const searchResults = ref([])
    const searchResultsKey = ref(0)
    const selectedSet = ref(null)
    const showSetDropdown = ref(false)
    const setDropdownRef = ref(null)
    const storeInventory = ref([])
    const storeInfo = ref(null)

    const sessionInfoMap = ref(new Map())

    const missingPartsBySet = computed(() => {
      const grouped = new Map()

      missingParts.value.forEach(part => {
        const key = part.set_id
        if (!grouped.has(key)) {
          grouped.set(key, {
            set_id: part.set_id,
            set_display_name: part.set_display_name,
            missing_parts: [],
            sessionInfo: sessionInfoMap.value.get(part.set_id) || null
          })
        }

        const existingPart = grouped.get(key).missing_parts.find(
          p => p.part_id === part.part_id && p.color_id === part.color_id
        )

        if (existingPart) {
          existingPart.missing_count += part.missing_count
        } else {
          grouped.get(key).missing_parts.push({
            part_id: part.part_id,
            color_id: part.color_id,
            element_id: part.element_id,
            part_name: part.part_name,
            color_name: part.color_name,
            color_rgb: part.color_rgb,
            part_img_url: part.part_img_url,
            missing_count: part.missing_count
          })
        }
      })

      return Array.from(grouped.values()).map(group => {
        const totalMissingCount = group.missing_parts.reduce((sum, part) => sum + part.missing_count, 0)
        return {
          ...group,
          total_missing_count: totalMissingCount
        }
      }).sort((a, b) => 
        a.set_display_name.localeCompare(b.set_display_name, 'ko')
      )
    })

    const loadStoreInventory = async () => {
      if (!user.value) {
        storeInfo.value = null
        storeInventory.value = []
        return
      }

      try {
        const storeData = await getStoreInfoByEmail(user.value.email)
        if (storeData && storeData.store) {
          storeInfo.value = storeData
          const inventoryData = await getStoreInventory(storeData.store.id)
          storeInventory.value = inventoryData || []
          console.log('[MissingParts] 매장 인벤토리 로드 완료:', storeInventory.value.length, '개')
        } else {
          storeInfo.value = null
          storeInventory.value = []
        }
      } catch (err) {
        console.error('[MissingParts] 매장 인벤토리 로드 실패:', err)
        storeInfo.value = null
        storeInventory.value = []
      }
    }

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

        // 매장 인벤토리에서만 검색
        if (storeInventory.value.length === 0) {
          await loadStoreInventory()
        }

        if (storeInventory.value.length === 0) {
          console.log('[MissingParts] 매장 인벤토리가 없습니다.')
          searchResults.value = []
          showSetDropdown.value = false
          return
        }

        // 매장 인벤토리의 세트 번호 목록 추출
        const inventorySetNumbers = storeInventory.value
          .map(item => {
            const legoSet = item.lego_sets
            if (!legoSet) return null
            if (Array.isArray(legoSet) && legoSet.length > 0) {
              return legoSet[0].number
            }
            if (!Array.isArray(legoSet)) {
              return legoSet.number
            }
            return null
          })
          .filter(Boolean)

        console.log('[MissingParts] 매장 인벤토리 세트 번호:', inventorySetNumbers.length, '개')

        // 1단계: 정확한 매칭 시도 (인벤토리 내에서만)
        const exactMatches = inventorySetNumbers.filter(num => num === query || num === mainSetNum)
        
        if (exactMatches.length > 0) {
          const matchedSetNums = [...new Set(exactMatches)]
          const { data: exactMatch, error: exactError } = await supabase
            .from('lego_sets')
            .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
            .in('set_num', matchedSetNums)
            .limit(20)

          if (!exactError && exactMatch && exactMatch.length > 0) {
            results = exactMatch
          }
        }

        // 2단계: LIKE 패턴으로 검색 (인벤토리 내에서만)
        if (results.length === 0) {
          const likeMatches = inventorySetNumbers.filter(num => 
            num.startsWith(mainSetNum) || num.includes(mainSetNum)
          )

          if (likeMatches.length > 0) {
            const matchedSetNums = [...new Set(likeMatches)]
            const { data: likeMatch, error: likeError } = await supabase
              .from('lego_sets')
              .select('id, name, set_num, theme_id, num_parts, webp_image_url, set_img_url')
              .in('set_num', matchedSetNums)
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
                theme_name: set.theme_id ? (themeMap.get(set.theme_id) || null) : null,
                part_count: set.num_parts || 0
              }))
            } else {
              results = results.map(set => ({
                ...set,
                theme_name: null,
                part_count: set.num_parts || 0
              }))
            }
          } else {
            results = results.map(set => ({
              ...set,
              theme_name: null,
              part_count: set.num_parts || 0
            }))
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
        console.error('[MissingParts] 세트 검색 실패:', err)
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
      // blur 이벤트가 드롭다운 클릭보다 먼저 발생할 수 있으므로 약간의 지연
      setTimeout(() => {
        showSetDropdown.value = false
      }, 200)
    }

    const handleSelectSet = async (set) => {
      selectedSet.value = set
      selectedSetId.value = set.id
      setSearchQuery.value = ''
      searchResults.value = []
      showSetDropdown.value = false
      
      // 부품 정보가 있는지 확인
      try {
        const partsStatus = await checkSetPartsExist(set.set_num)
        
        if (!partsStatus.partsExist) {
          // 부품 정보가 없으면 자동으로 동기화
          console.log(`[MissingParts] 세트 ${set.set_num}의 부품 정보가 없습니다. 자동 동기화 시작...`)
          error.value = `세트 ${set.set_num}의 부품 정보를 동기화하는 중입니다...`
          
          try {
            await syncSetParts(set.set_num, true)
            console.log(`[MissingParts] 세트 ${set.set_num} 부품 정보 동기화 완료`)
            error.value = null
          } catch (syncError) {
            console.error(`[MissingParts] 부품 정보 동기화 실패:`, syncError)
            error.value = `부품 정보 동기화 실패: ${syncError.message}. 수동으로 신규 레고 등록 페이지에서 등록해주세요.`
            return
          }
        }
      } catch (checkError) {
        console.error(`[MissingParts] 부품 정보 확인 실패:`, checkError)
        // 확인 실패해도 계속 진행
      }
      
      loadMissingParts()
    }

    const loadMissingParts = async () => {
      if (!user.value) return

      try {
        loading.value = true
        error.value = null

        // 일반 사용자는 자신의 세션만 조회
        // 관리자는 모든 세션 조회 가능하도록 구현
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id, role, is_active')
          .eq('email', user.value.email)
          .eq('is_active', true)
          .maybeSingle()
        
        const isAdmin = adminData && (adminData.role === 'admin' || adminData.role === 'super_admin')

        // URL 쿼리 파라미터에서 세션 ID 확인
        const sessionIdFromQuery = route.query.session

        let sessions = []

        if (sessionIdFromQuery && typeof sessionIdFromQuery === 'string') {
          // 특정 세션만 조회 (manual-inspection과 동일한 세션 사용)
          const { data: sessionData, error: sessionError } = await supabase
            .from('inspection_sessions')
            .select('id, set_id, status, completed_at, last_saved_at, started_at, progress')
            .eq('id', sessionIdFromQuery)
            .maybeSingle()

          if (sessionError) throw sessionError

          if (!sessionData) {
            missingParts.value = []
            return
          }

          // 관리자가 아니면 본인 세션만 확인
          if (!isAdmin && sessionData.user_id !== user.value.id) {
            missingParts.value = []
            return
          }

          sessions = [sessionData]
        } else {
          // 모든 상태의 세션 조회 (진행중, 임시저장, 완료)
          let sessionsQuery = supabase
            .from('inspection_sessions')
            .select('id, set_id, status, completed_at, last_saved_at, started_at, progress')
            .in('status', ['in_progress', 'paused', 'completed'])

          if (!isAdmin) {
            sessionsQuery = sessionsQuery.eq('user_id', user.value.id)
          }

          if (selectedSetId.value) {
            sessionsQuery = sessionsQuery.eq('set_id', selectedSetId.value)
          }

          const { data: allSessions, error: sessionsError } = await sessionsQuery

          if (sessionsError) throw sessionsError

          if (!allSessions || allSessions.length === 0) {
            missingParts.value = []
            return
          }

          // 각 set_id별로 가장 최신 세션만 선택
          // 우선순위: completed_at > last_saved_at > started_at
          const getSessionTimestamp = (session) => {
            if (session.completed_at) {
              return new Date(session.completed_at).getTime()
            }
            if (session.last_saved_at) {
              return new Date(session.last_saved_at).getTime()
            }
            if (session.started_at) {
              return new Date(session.started_at).getTime()
            }
            return 0
          }

          const latestSessionsBySet = new Map()
          allSessions.forEach(session => {
            const setId = session.set_id
            if (!setId) return

            const existing = latestSessionsBySet.get(setId)
            if (!existing) {
              latestSessionsBySet.set(setId, session)
            } else {
              const sessionTime = getSessionTimestamp(session)
              const existingTime = getSessionTimestamp(existing)
              if (sessionTime > existingTime) {
                latestSessionsBySet.set(setId, session)
              }
            }
          })

          sessions = Array.from(latestSessionsBySet.values())
        }
        const sessionIds = sessions.map(s => s.id)
        const setIds = [...new Set(sessions.map(s => s.set_id).filter(Boolean))]

        // 세션 정보를 세트별로 매핑
        sessionInfoMap.value.clear()
        sessions.forEach(session => {
          if (session.set_id) {
            sessionInfoMap.value.set(session.set_id, {
              status: session.status,
              completed_at: session.completed_at,
              last_saved_at: session.last_saved_at,
              progress: session.progress || 0
            })
          }
        })

        // 모든 아이템 조회 (누락 판단을 위해)
        const { data: items, error: itemsError } = await supabase
          .from('inspection_items')
          .select('session_id, part_id, color_id, element_id, total_count, checked_count, status')
          .in('session_id', sessionIds)

        if (itemsError) throw itemsError

        if (!items || items.length === 0) {
          missingParts.value = []
          return
        }

        // 누락 부품 필터링: ManualInspection.vue와 동일하게 status가 'missing'인 아이템만
        const missingItems = items.filter(item => item.status === 'missing')

        if (missingItems.length === 0) {
          missingParts.value = []
          return
        }

        // 세트 메타데이터 가져오기
        const metadataMap = await fetchSetMetadata(supabase, setIds)

        // 세션별 세트 매핑
        const sessionSetMap = new Map(sessions.map(s => [s.id, s.set_id]))

        // 부품 정보 가져오기
        const partIds = [...new Set(items.map(i => i.part_id).filter(Boolean))]
        const colorIds = [...new Set(items.map(i => i.color_id).filter(Boolean))]

        const { data: partsInfo, error: partsError } = await supabase
          .from('lego_parts')
          .select('part_num, name, part_img_url')
          .in('part_num', partIds)

        if (partsError) throw partsError

        const { data: colorsInfo, error: colorsError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .in('color_id', colorIds)

        if (colorsError) throw colorsError

        const partsMap = new Map((partsInfo || []).map(p => [p.part_num, p]))
        const colorsMap = new Map((colorsInfo || []).map(c => [c.color_id, c]))

        // element_id 목록 수집 (이미지 조회용)
        const elementIds = [...new Set(missingItems.map(i => i.element_id).filter(Boolean))].map(id => String(id))
        
        // element_id 기반 이미지 조회 (part_images 우선)
        const elementImageMap = new Map()
        if (elementIds && elementIds.length > 0) {
          const { data: elementImages, error: elementImagesError } = await supabase
            .from('part_images')
            .select('element_id, uploaded_url')
            .in('element_id', elementIds)
            .not('uploaded_url', 'is', null)

          if (!elementImagesError && elementImages) {
            elementImages.forEach(img => {
              if (img.element_id && img.uploaded_url) {
                // JPG는 무시, WebP만 사용
                if (!img.uploaded_url.toLowerCase().endsWith('.jpg')) {
                  elementImageMap.set(String(img.element_id), img.uploaded_url)
                }
              }
            })
          }
        }

        // element_id 기반 image_metadata fallback 조회 (part_images에 없는 경우만)
        const missingElementIds = (elementIds || []).filter(id => id && !elementImageMap.has(id))
        if (missingElementIds && missingElementIds.length > 0) {
          const { data: metadataImages, error: metadataError } = await supabase
            .from('image_metadata')
            .select('element_id, supabase_url')
            .in('element_id', missingElementIds)
            .not('supabase_url', 'is', null)

          if (!metadataError && metadataImages) {
            metadataImages.forEach(img => {
              if (img.element_id && img.supabase_url) {
                // JPG는 무시, WebP만 사용
                if (!img.supabase_url.toLowerCase().endsWith('.jpg')) {
                  elementImageMap.set(String(img.element_id), img.supabase_url)
                }
              }
            })
          }
        }

        // part_id + color_id 기반 이미지 조회 (element_id가 없는 경우용)
        const partColorImageMap = new Map()
        const itemsWithoutElementId = missingItems.filter(i => !i.element_id)
        if (itemsWithoutElementId && itemsWithoutElementId.length > 0) {
          const partIdsForImages = [...new Set(itemsWithoutElementId.map(i => i.part_id).filter(id => id !== null && id !== undefined && id !== ''))]
          const colorIdsForImages = [...new Set(itemsWithoutElementId.map(i => i.color_id).filter(id => id !== null && id !== undefined))]

          if (partIdsForImages && partIdsForImages.length > 0 && colorIdsForImages && colorIdsForImages.length > 0) {
            const { data: partImages, error: partImagesError } = await supabase
              .from('part_images')
              .select('part_id, color_id, uploaded_url')
              .in('part_id', partIdsForImages)
              .in('color_id', colorIdsForImages)
              .not('uploaded_url', 'is', null)

            if (!partImagesError && partImages) {
              partImages.forEach(img => {
                if (img.part_id && img.color_id && img.uploaded_url) {
                  const key = `${img.part_id}_${img.color_id}`
                  partColorImageMap.set(key, img.uploaded_url)
                }
              })
            }
          }
        }

        // 누락 부품 데이터 구성 (비동기 처리)
        const partsDataWithImages = await Promise.all(missingItems.map(async (item) => {
          const setId = sessionSetMap.get(item.session_id)
          const meta = metadataMap.get(setId) || {}
          const partInfo = partsMap.get(item.part_id)
          const colorInfo = colorsMap.get(item.color_id)

          // ManualInspection.vue와 동일한 로직: total_count - checked_count가 누락 개수
          const missingCount = Math.max(0, (item.total_count || 0) - (item.checked_count || 0))

          // 이미지 URL 결정: element_id 우선, 없으면 part_id + color_id, 없으면 표시 보류
          let imageUrl = null
          if (item.element_id && elementImageMap.has(String(item.element_id))) {
            imageUrl = elementImageMap.get(String(item.element_id))
          } else if (!item.element_id) {
            const key = `${item.part_id}_${item.color_id}`
            if (partColorImageMap.has(key)) {
              imageUrl = partColorImageMap.get(key)
            }
          }

          // 외부 API/Storage 직접 확인 제거: DB에 없으면 표시 보류 // 🔧 수정됨

          return {
            set_id: setId,
            set_display_name: formatSetDisplay(meta.set_num, meta.theme_name, meta.set_name || '세트명 없음'),
            part_id: item.part_id,
            color_id: item.color_id,
            element_id: item.element_id,
            part_name: partInfo?.name || item.part_id,
            color_name: colorInfo?.name || `Color ${item.color_id}`,
            color_rgb: colorInfo?.rgb || null,
            supabase_image_url: imageUrl || null, // 🔧 수정됨
            missing_count: missingCount
          }
        }))

        missingParts.value = partsDataWithImages
      } catch (err) {
        console.error('누락 부품 로드 실패:', err)
        error.value = '누락 부품을 불러오는데 실패했습니다'
      } finally {
        loading.value = false
      }
    }

    const handleImageError = (event) => {
      event.target.style.display = 'none'
      const placeholder = event.target.nextElementSibling
      if (placeholder) {
        placeholder.style.display = 'flex'
      }
    }

    const handleSelectedSetImageError = (event) => {
      const wrapper = event.target.closest('.selected-set-thumb-wrapper')
      if (wrapper) {
        const placeholder = document.createElement('div')
        placeholder.className = 'selected-set-no-image'
        placeholder.textContent = '이미지 없음'
        wrapper.appendChild(placeholder)
      }
      event.target.style.display = 'none'
    }

    const formatDate = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const formatTime = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      const now = new Date()
      const diff = now - date
      const minutes = Math.floor(diff / 60000)
      
      if (minutes < 1) return '방금 전'
      if (minutes < 60) return `${minutes}분 전`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${hours}시간 전`
      return formatDate(dateString)
    }

    const statusLabel = (status) => {
      const labels = {
        'in_progress': '진행 중',
        'paused': '임시저장',
        'completed': '완료'
      }
      return labels[status] || status
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

    const resolvePartCount = (set) => {
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

    // URL 쿼리 파라미터 변경 감지
    watch(() => route.query.session, async () => {
      await loadMissingParts()
    })

    watch(user, async (newUser) => {
      if (newUser) {
        await loadStoreInventory()
      } else {
        storeInfo.value = null
        storeInventory.value = []
      }
    }, { immediate: true })

    onMounted(async () => {
      if (user.value) {
        await loadStoreInventory()
      }
      await loadMissingParts()
    })

    return {
      loading,
      error,
      selectedSetId,
      missingPartsBySet,
      loadMissingParts,
      handleImageError,
      handleSelectedSetImageError,
      setSearchQuery,
      searchResults,
      searchResultsKey,
      selectedSet,
      showSetDropdown,
      setDropdownRef,
      handleSearchEnter,
      handleSearchBlur,
      handleSelectSet,
      formatSetDisplay,
      formatSetNumber,
      formatDate,
      formatTime,
      statusLabel,
      getColorRgb,
      getContrastColor,
      resolvePartCount
    }
  }
}
</script>

<style scoped>
.missing-parts-page {
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

.missing-parts-content {
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
  gap: 0.5rem;
}

.selected-set-display {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.selected-set-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
  color: #9ca3af;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.5rem;
  background: #f9fafb;
}

.selected-set-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
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
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #6b7280;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.missing-parts-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.set-group {
  padding: 0;
}

.set-group-header {
  margin-bottom: 1.75rem;
  padding-bottom: 1.25rem;
  border-bottom: 2px solid #f3f4f6;
  display: flex;
  justify-content: center;
}

.set-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.set-title h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.75rem 0;
  letter-spacing: -0.025em;
}

.session-stats {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: center;
}

.stat-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
}

.stat-badge.progress {
  background: #3b82f6;
  color: #ffffff;
}

.stat-badge.missing {
  background: #ef4444;
  color: #ffffff;
}

.stat-badge.time {
  background: #1f2937;
  color: #ffffff;
}

.stat-badge.status {
  background: #eab308;
  color: #ffffff;
}

.stat-badge.status.status-in_progress {
  background: #3b82f6;
  color: #ffffff;
}

.stat-badge.status.status-paused {
  background: #f97316;
  color: #ffffff;
}

.stat-badge.status.status-completed {
  background: #22c55e;
  color: #ffffff;
}

.missing-count {
  font-size: 0.875rem;
  color: #ef4444;
  font-weight: 600;
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

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
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

.part-card .card-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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

.part-card .quantity-section {
  display: flex;
  align-items: center;
  justify-content: center;
}

.part-card .quantity-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
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

@media (max-width: 768px) {
  .missing-parts-page {
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

  .set-group {
    padding: 0;
  }

  .set-group-header {
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
  }

  .set-title h3 {
    font-size: 1.125rem !important;
    margin-bottom: 0.625rem;
  }

  .session-stats {
    gap: 0.5rem;
  }

  .stat-badge {
    font-size: 0.8125rem;
    padding: 0.3125rem 0.625rem;
  }

  .parts-grid {
    grid-template-columns: 1fr;
  }

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
</style>

