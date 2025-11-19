<template>
  <div class="part-to-set-search-page">
    <div class="layout-container">
      <div class="page-header">
        <h1>부품으로 세트찾기</h1>
        <p>부품번호를 입력하여 해당 부품이 포함된 세트를 찾을 수 있습니다</p>
      </div>

      <div class="search-content">
      <div class="search-section">
        <div class="setup-card">
          <div class="card-body">
            <div class="form-group">
              <label for="element-id-input">부품번호를 입력하세요.</label>
              <div class="set-search-wrapper">
                <div class="set-search-input-row">
                  <div class="set-search-input-wrapper">
                    <input
                      id="element-id-input"
                      v-model="elementIdInput"
                      type="text"
                      class="set-search-input"
                      placeholder="예 : 306923"
                      @keyup.enter="searchByElementId"
                      :disabled="loading"
                    />
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M14 14L11.1 11.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <button
                    @click="searchByElementId"
                    class="search-button"
                    :disabled="!elementIdInput || loading"
                  >
                    {{ loading ? '검색 중...' : '검색' }}
                  </button>
                </div>
                <div v-if="searchResult" class="result-part-card">
                  <div class="part-image-container">
                    <img
                      v-if="searchResult.part_image_url"
                      :src="searchResult.part_image_url"
                      :alt="searchResult.part_name"
                      class="part-image"
                      @error="handlePartImageError"
                    />
                    <div v-else class="no-part-image">이미지 없음</div>
                  </div>
                  <div class="part-info">
                    <div v-if="searchResult.element_id" class="element-id-badge">
                      {{ searchResult.element_id }}
                    </div>
                    <div class="part-name-text">{{ searchResult.part_name }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="searchResult" class="result-section">
        <div class="result-header"><h3>검색결과</h3></div><!-- // 🔧 수정됨 -->
        <div v-if="searchResult.sets && searchResult.sets.length > 0" class="sets-grid">
          <div
            v-for="set in searchResult.sets"
            :key="set.id"
            class="set-card"
            @click="openSetPartsModal(set)"
          >
            <div class="set-image">
              <img
                v-if="set.image_url"
                :src="set.image_url"
                :alt="set.name"
                @error="handleImageError"
              />
              <div v-else class="no-image">이미지 없음</div>
            </div>
            <div class="set-info">
              <h4 class="set-name">{{ formatSetDisplay(set.set_num, set.theme_name, set.name) }}</h4>
              <p class="set-quantity">수량: {{ set.quantity }}개</p>
            </div>
          </div>
        </div>
        <div v-else class="empty-result">
          <p>해당 부품이 포함된 세트를 찾을 수 없습니다.</p>
        </div>

        <div v-if="searchResult.alternatives && searchResult.alternatives.length > 0 && searchResult.alternatives[0].colors && searchResult.alternatives[0].colors.length > 0" class="alternatives-section">
          <div class="alternative-group">
            <h4 class="alternative-title">유사부품 (동일 모양, 다른 색상)</h4>
            <div class="alternative-parts-grid">
              <div
                v-for="color in searchResult.alternatives[0].colors"
                :key="color.color_id"
                class="alternative-part-card"
                :data-part-id="searchResult.alternatives[0].part_id"
                :data-color-id="color.color_id"
                @click="searchByAlternativeElementId(color.element_id)"
              >
                <div class="card-header">
                  <div class="part-info">
                    <div v-if="color.element_id" class="element-id">{{ color.element_id }}</div>
                    <h4 class="part-name">{{ searchResult.alternatives[0].part_name }}</h4>
                    <span 
                      class="color-badge"
                      :style="{ 
                        backgroundColor: getColorRgb(color.rgb) || '#ccc'
                      }"
                    >
                      {{ color.name || color.color_id }}
                    </span>
                  </div>
                </div>
                <div class="card-body">
                  <div class="part-image-section">
                    <img
                      v-if="color.image_url"
                      :src="color.image_url"
                      :alt="searchResult.alternatives[0].part_name"
                      @error="handlePartImageError"
                      class="part-image"
                    />
                    <div v-else class="no-part-image">이미지 없음</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- 세트 부품 리스트 모달 -->
    <div v-if="showSetPartsModal" class="modal-overlay" @click.self="closeSetPartsModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ selectedSet ? formatSetDisplay(selectedSet.set_num, selectedSet.theme_name, selectedSet.name) : '' }}</h3>
          <button class="modal-close-button" @click="closeSetPartsModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="setPartsLoading" class="loading-message">로딩 중...</div>
          <div v-else-if="setPartsError" class="error-message">{{ setPartsError }}</div>
          <div v-else-if="setParts && setParts.length > 0" class="set-parts-list">
            <div class="parts-grid">
              <div
                v-for="(part, index) in setParts"
                :key="`${part.part_id}-${part.color_id}-${index}`"
                class="part-item"
              >
                <div class="part-image-wrapper">
                  <img
                    v-if="part.image_url"
                    :src="part.image_url"
                    :alt="part.part_name"
                    @error="handlePartImageError"
                    class="part-thumbnail"
                  />
                  <div v-else class="no-part-image-small">이미지 없음</div>
                </div>
                <div class="part-details">
                  <div class="part-name">{{ part.part_name }}</div>
                  <div class="part-info-row">
                    <span class="part-id">Part: {{ part.part_id }}</span>
                    <span v-if="part.element_id" class="element-id">Element: {{ part.element_id }}</span>
                  </div>
                  <div class="part-info-row">
                    <span class="color-name" :style="{ color: getColorRgb(part.color_rgb) || '#1f2937' }">
                      {{ part.color_name }}
                    </span>
                    <span class="color-id">Color ID: {{ part.color_id }}</span>
                  </div>
                  <div class="quantity-badge">수량: {{ part.quantity }}개</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-message">부품이 없습니다.</div>
        </div>
      </div>
    </div>
    
    <!-- 부품 정보 동기화 모달 -->
    <SetPartsSyncModal
      :show="showSyncModal"
      :set-num="syncSetNum"
      :syncing="syncing"
      :sync-progress="syncProgress"
      :sync-status="syncStatus"
      :completed="syncCompleted"
      :parts-count="syncPartsCount"
      :error="syncError"
      @confirm="handleSyncConfirm"
      @cancel="handleSyncCancel"
      @close="handleSyncClose"
      @retry="handleSyncRetry"
    />
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router' // 🔧 수정됨
import { useSupabase } from '../composables/useSupabase'
import { usePartSearch } from '../composables/usePartSearch'
import { usePleyonInventorySync } from '../composables/usePleyonInventorySync'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'
import { useRebrickable } from '../composables/useRebrickable'
import SetPartsSyncModal from '../components/SetPartsSyncModal.vue'
import { formatSetDisplay } from '../utils/setDisplay'

export default {
  name: 'PartToSetSearch',
  components: {
    SetPartsSyncModal
  },
  setup() {
    const { supabase, user } = useSupabase()
    const route = useRoute() // 🔧 수정됨
    const { findSetsByPart, findAlternativeParts, loading } = usePartSearch()
    const { checkSetPartsExist, syncSetParts, syncing, syncProgress, syncStatus, error: syncError } = usePleyonInventorySync()
    const { getStoreInfoByEmail, getStoreInventory } = useSupabasePleyon()

    const elementIdInput = ref('')
    const lastQuerySignature = ref('') // 🔧 수정됨
    const searchResult = ref(null)
    const error = ref(null)
    const showSetPartsModal = ref(false)
    const selectedSet = ref(null)
    const setParts = ref([])
    const setPartsLoading = ref(false)
    const setPartsError = ref(null)
    
    // 동기화 모달 관련
    const showSyncModal = ref(false)
    const syncSetNum = ref('')
    const syncCompleted = ref(false)
    const syncPartsCount = ref(0)
    
    // 매장 인벤토리 관련
    const storeInventory = ref([])
    const storeInfo = ref(null)
    
    // 매장 인벤토리 로드
    const loadStoreInventory = async () => {
      if (!user.value || !user.value.email) {
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
          console.log('[PartToSetSearch] 매장 인벤토리 로드 완료:', storeInventory.value.length, '개')
        } else {
          storeInfo.value = null
          storeInventory.value = []
        }
      } catch (err) {
        console.error('[PartToSetSearch] 매장 인벤토리 로드 실패:', err)
        storeInfo.value = null
        storeInventory.value = []
      }
    }
    
    const resolveElementIdByPart = async (partId, colorId = null) => { // 🔧 수정됨
      if (!partId) return null // 🔧 수정됨
      try {
        let elementQuery = supabase
          .from('set_parts')
          .select('element_id')
          .eq('part_id', partId)
          .not('element_id', 'is', null)
        
        if (colorId !== null && colorId !== undefined) {
          elementQuery = elementQuery.eq('color_id', colorId)
        }
        
        const { data, error } = await elementQuery
          .limit(1)
          .maybeSingle()
        
        if (error) {
          console.warn('[PartToSetSearch] element_id 조회 실패:', error)
          return null
        }
        
        return data?.element_id ? String(data.element_id) : null
      } catch (err) {
        console.error('[PartToSetSearch] element_id 해석 실패:', err)
        return null
      }
    }
    
    // 매장 인벤토리의 세트 번호 목록 추출
    const inventorySetNumbers = computed(() => {
      if (storeInventory.value.length === 0) {
        return new Set()
      }
      
      return new Set(
        storeInventory.value
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
      )
    })

    const searchByElementId = async () => {
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

        // 색상 정보 가져오기
        const { data: colorInfo, error: colorError } = await supabase
          .from('lego_colors')
          .select('color_id, name, rgb')
          .eq('color_id', setPart.color_id)
          .maybeSingle()

        if (colorError) {
          throw new Error(`색상 정보 조회 실패: ${colorError.message}`)
        }

        // 부품 이미지 URL 조회: element_id 우선, 없으면 part_id + color_id, 마지막으로 part_img_url
        let partImageUrl = null
        
        if (elementIdInput.value.trim()) {
          // element_id로 먼저 조회
          const { data: partImageByElement, error: elementError } = await supabase
            .from('part_images')
            .select('uploaded_url')
            .eq('element_id', String(elementIdInput.value.trim()))
            .maybeSingle()

          if (!elementError && partImageByElement?.uploaded_url) {
            partImageUrl = partImageByElement.uploaded_url
          }
        }

        // element_id로 찾지 못했으면 part_id + color_id로 조회
        if (!partImageUrl) {
          const { data: partImage, error: partImageError } = await supabase
            .from('part_images')
            .select('uploaded_url')
            .eq('part_id', setPart.part_id)
            .eq('color_id', setPart.color_id)
            .maybeSingle()

          if (!partImageError && partImage?.uploaded_url) {
            partImageUrl = partImage.uploaded_url
          }
        }

        // element_id가 있지만 이미지가 없으면 Rebrickable API에서 element_img_url 가져오기
        if (!partImageUrl && elementIdInput.value.trim()) {
          try {
            const { getElement } = useRebrickable()
            const elementData = await getElement(elementIdInput.value.trim())
            if (elementData?.element_img_url) {
              partImageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(elementData.element_img_url)}`
            } else if (elementData?.part_img_url) {
              partImageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(elementData.part_img_url)}`
            }
          } catch (elementErr) {
            console.warn(`⚠️ element_id ${elementIdInput.value.trim()} 이미지 조회 실패:`, elementErr)
          }
        }

        // element_id 실패 시 part_img_url 사용 (fallback)
        if (!partImageUrl && partInfo?.part_img_url) {
          partImageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(partInfo.part_img_url)}`
        }

        // 세트 찾기
        const allSets = await findSetsByPart(setPart.part_id, setPart.color_id)
        let sets = allSets
        
        // 매장 인벤토리가 있으면 매장 보유 세트만 필터링
        if (inventorySetNumbers.value.size > 0) {
          sets = allSets.filter(set => {
            const setNum = set.set_num
            // 세트 번호 정규화 (하이픈 제거하여 비교)
            const normalizedSetNum = setNum.replace(/-.*$/, '')
            return inventorySetNumbers.value.has(setNum) || inventorySetNumbers.value.has(normalizedSetNum)
          })
          console.log(`[PartToSetSearch] 매장 보유 세트 필터링: ${sets.length}개 (전체: ${allSets.length}개)`)
        } else {
          console.log('[PartToSetSearch] 매장 인벤토리가 없어 전체 세트 표시')
        }
        
        // 유사부품 찾기
        const alternatives = await findAlternativeParts(setPart.part_id, setPart.color_id)

        // 유사부품의 각 색상별 이미지 URL 및 엘리먼트 ID 로드
        if (alternatives && alternatives.length > 0 && alternatives[0].colors) {
          for (const color of alternatives[0].colors) {
            try {
              // 엘리먼트 ID 먼저 조회
              const { data: setPartData, error: setPartError } = await supabase
                .from('set_parts')
                .select('element_id')
                .eq('part_id', alternatives[0].part_id)
                .eq('color_id', color.color_id)
                .limit(1)
                .maybeSingle()

              if (!setPartError && setPartData?.element_id) {
                color.element_id = setPartData.element_id
              }

              // 이미지 URL 조회: element_id 우선, 없으면 part_id + color_id
              let imageUrl = null
              
              if (color.element_id) {
                // element_id로 먼저 조회
                const { data: partImageByElement, error: elementError } = await supabase
                  .from('part_images')
                  .select('uploaded_url')
                  .eq('element_id', String(color.element_id))
                  .maybeSingle()

                if (!elementError && partImageByElement?.uploaded_url) {
                  imageUrl = partImageByElement.uploaded_url
                }
              }

              // element_id로 찾지 못했으면 part_id + color_id로 조회
              if (!imageUrl) {
                const { data: partImage, error } = await supabase
                  .from('part_images')
                  .select('uploaded_url')
                  .eq('part_id', alternatives[0].part_id)
                  .eq('color_id', color.color_id)
                  .maybeSingle()

                if (!error && partImage?.uploaded_url) {
                  imageUrl = partImage.uploaded_url
                }
              }

              // element_id가 있지만 이미지가 없으면 Rebrickable API에서 element_img_url 가져오기
              if (!imageUrl && color.element_id) {
                try {
                  const { getElement } = useRebrickable()
                  const elementData = await getElement(color.element_id)
                  if (elementData?.element_img_url) {
                    imageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(elementData.element_img_url)}`
                  } else if (elementData?.part_img_url) {
                    imageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(elementData.part_img_url)}`
                  }
                } catch (elementErr) {
                  console.warn(`⚠️ element_id ${color.element_id} 이미지 조회 실패:`, elementErr)
                }
              }

              // part_images에서 찾지 못했으면 part_img_url 사용 (fallback)
              if (imageUrl) {
                color.image_url = imageUrl
              } else if (alternatives[0].part_img_url) {
                color.image_url = `/api/upload/proxy-image?url=${encodeURIComponent(alternatives[0].part_img_url)}`
              }
            } catch (err) {
              // element_id가 있지만 이미지가 없으면 Rebrickable API에서 element_img_url 가져오기
              if (color.element_id) {
                try {
                  const { getElement } = useRebrickable()
                  const elementData = await getElement(color.element_id)
                  if (elementData?.element_img_url) {
                    color.image_url = `/api/upload/proxy-image?url=${encodeURIComponent(elementData.element_img_url)}`
                  } else if (elementData?.part_img_url) {
                    color.image_url = `/api/upload/proxy-image?url=${encodeURIComponent(elementData.part_img_url)}`
                  } else if (alternatives[0].part_img_url) {
                    color.image_url = `/api/upload/proxy-image?url=${encodeURIComponent(alternatives[0].part_img_url)}`
                  }
                } catch (elementErr) {
                  console.warn(`⚠️ element_id ${color.element_id} 이미지 조회 실패:`, elementErr)
                  if (alternatives[0].part_img_url) {
                    color.image_url = `/api/upload/proxy-image?url=${encodeURIComponent(alternatives[0].part_img_url)}`
                  }
                }
              } else if (alternatives[0].part_img_url) {
                color.image_url = `/api/upload/proxy-image?url=${encodeURIComponent(alternatives[0].part_img_url)}`
              }
            }
          }
        }

        searchResult.value = {
          element_id: elementIdInput.value.trim(),
          part_id: setPart.part_id,
          color_id: setPart.color_id,
          part_name: partInfo?.name || setPart.part_id,
          color_name: colorInfo?.name || `Color ${setPart.color_id}`,
          color_rgb: colorInfo?.rgb || null,
          part_image_url: partImageUrl,
          sets: sets,
          alternatives: alternatives
        }
      } catch (err) {
        error.value = err.message || '검색 중 오류가 발생했습니다.'
        console.error('검색 실패:', err)
      }
    }

    const openSetPartsModal = async (set) => {
      selectedSet.value = set
      
      // 부품 정보가 있는지 확인
      try {
        const partsStatus = await checkSetPartsExist(set.set_num)
        
        if (!partsStatus.partsExist) {
          // 부품 정보가 없으면 모달 표시
          showSyncModal.value = true
          syncSetNum.value = set.set_num
          syncCompleted.value = false
          syncPartsCount.value = 0
          return
        }
      } catch (checkError) {
        console.error(`[PartToSetSearch] 부품 정보 확인 실패:`, checkError)
        // 확인 실패해도 계속 진행
      }
      
      showSetPartsModal.value = true
      setParts.value = []
      setPartsError.value = null
      setPartsLoading.value = true

      try {
        // 세트의 모든 부품 조회
        const { data: partsData, error: partsError } = await supabase
          .from('set_parts')
          .select('part_id, color_id, quantity, element_id')
          .eq('set_id', set.id)

        if (partsError) throw partsError

        if (!partsData || partsData.length === 0) {
          setParts.value = []
          setPartsLoading.value = false
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

        // 부품 이미지 URL 조회
        const partsInfoMap = new Map(partsInfo.map(p => [p.part_num, p]))
        const colorsInfoMap = new Map(colorsInfo.map(c => [c.color_id, c]))

        // 각 부품별 이미지 URL 조회
        const partsWithImages = await Promise.all(
          partsData.map(async (part) => {
            const partInfo = partsInfoMap.get(part.part_id)
            const colorInfo = colorsInfoMap.get(part.color_id)

            let imageUrl = null
            if (part.element_id) {
              // element_id로 이미지 조회
              const { data: partImage, error: imgError } = await supabase
                .from('part_images')
                .select('uploaded_url')
                .eq('element_id', String(part.element_id))
                .maybeSingle()

              if (!imgError && partImage?.uploaded_url) {
                imageUrl = partImage.uploaded_url
              }

              // part_images에 없으면 Storage에서 직접 확인
              if (!imageUrl) {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
                const fileName = `${String(part.element_id)}.webp`
                const directUrl = `${supabaseUrl}/storage/v1/object/public/lego_parts_images/images/${fileName}`
                try {
                  const response = await fetch(directUrl, { method: 'HEAD' })
                  if (response.ok) {
                    imageUrl = directUrl
                  }
                } catch (fetchError) {
                  // 파일이 없으면 무시
                }
              }
              
              // Storage에도 없으면 Rebrickable API에서 element_img_url 가져오기
              if (!imageUrl) {
                try {
                  const { getElement } = useRebrickable()
                  const elementData = await getElement(part.element_id)
                  if (elementData?.element_img_url) {
                    imageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(elementData.element_img_url)}`
                  } else if (elementData?.part_img_url) {
                    imageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(elementData.part_img_url)}`
                  }
                } catch (elementErr) {
                  console.warn(`⚠️ element_id ${part.element_id} 이미지 조회 실패:`, elementErr)
                }
              }
            }

            // element_id 실패 시 part_img_url 사용 (fallback)
            if (!imageUrl && partInfo?.part_img_url) {
              imageUrl = `/api/upload/proxy-image?url=${encodeURIComponent(partInfo.part_img_url)}`
            }

            return {
              part_id: part.part_id,
              color_id: part.color_id,
              quantity: part.quantity,
              element_id: part.element_id,
              part_name: partInfo?.name || part.part_id,
              color_name: colorInfo?.name || `Color ${part.color_id}`,
              color_rgb: colorInfo?.rgb || null,
              image_url: imageUrl
            }
          })
        )

        setParts.value = partsWithImages
      } catch (err) {
        setPartsError.value = err.message || '부품 목록을 불러오는 중 오류가 발생했습니다.'
        console.error('부품 목록 조회 실패:', err)
      } finally {
        setPartsLoading.value = false
      }
    }

    const closeSetPartsModal = () => {
      showSetPartsModal.value = false
      selectedSet.value = null
      setParts.value = []
      setPartsError.value = null
    }

    const searchByAlternativeElementId = async (elementId) => {
      if (!elementId) return
      
      elementIdInput.value = String(elementId)
      await searchByElementId()
      
      // 검색 결과로 스크롤
      setTimeout(() => {
      }, 100)
    }
    
    const searchByQueryParams = async () => { // 🔧 수정됨
      const { element, element_id: elementIdAlias, part, color } = route.query // 🔧 수정됨
      const signature = JSON.stringify({ element, elementIdAlias, part, color }) // 🔧 수정됨
      if (signature === lastQuerySignature.value) return // 🔧 수정됨
      lastQuerySignature.value = signature // 🔧 수정됨
      
      const elementParam = element ?? elementIdAlias // 🔧 수정됨
      if (elementParam) { // 🔧 수정됨
        const normalizedElementId = String(elementParam).trim() // 🔧 수정됨
        if (normalizedElementId) { // 🔧 수정됨
          elementIdInput.value = normalizedElementId // 🔧 수정됨
          await searchByElementId() // 🔧 수정됨
        }
        return // 🔧 수정됨
      }
      
      if (part) { // 🔧 수정됨
        const normalizedPartId = String(part).trim() // 🔧 수정됨
        if (!normalizedPartId) return // 🔧 수정됨
        const resolvedElementId = await resolveElementIdByPart(normalizedPartId, color ?? null) // 🔧 수정됨
        if (resolvedElementId) { // 🔧 수정됨
          elementIdInput.value = resolvedElementId // 🔧 수정됨
          await searchByElementId() // 🔧 수정됨
        }
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
      
      // RGB 값을 추출
      const r = parseInt(rgbStr.substring(1, 3), 16)
      const g = parseInt(rgbStr.substring(3, 5), 16)
      const b = parseInt(rgbStr.substring(5, 7), 16)
      
      // 상대적 밝기 계산 (0-255)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      
      // 밝기가 128보다 크면 어두운 텍스트, 작으면 밝은 텍스트
      return brightness > 128 ? '#1f2937' : '#ffffff'
    }

    const handlePartImageError = async (event) => {
      const img = event.target
      const partCard = img.closest('.alternative-part-card')
      if (!partCard) {
        // 검색 결과 이미지인 경우
        img.style.display = 'none'
        return
      }

      const colorId = partCard.dataset.colorId
      const partId = partCard.dataset.partId
      if (!colorId || !partId) {
        img.style.display = 'none'
        return
      }

      // 이미지 로드 실패 시 숨김 처리
      img.style.display = 'none'
    }

    const handleSyncConfirm = async () => {
      try {
        syncCompleted.value = false
        const result = await syncSetParts(syncSetNum.value, true)
        if (result && result.success) {
          syncCompleted.value = true
          syncPartsCount.value = result.partsCount || 0
        }
      } catch (err) {
        console.error('[PartToSetSearch] 동기화 실패:', err)
      }
    }
    
    const handleSyncClose = () => {
      showSyncModal.value = false
      syncSetNum.value = ''
      syncCompleted.value = false
      syncPartsCount.value = 0
      if (selectedSet.value) {
        openSetPartsModal(selectedSet.value)
      }
    }
    
    const handleSyncCancel = () => {
      showSyncModal.value = false
      syncSetNum.value = ''
      syncCompleted.value = false
      syncPartsCount.value = 0
    }
    
    const handleSyncRetry = () => {
      handleSyncConfirm()
    }

    // 사용자 변경 시 매장 인벤토리 로드
    watch(user, async (newUser) => {
      if (newUser) {
        await loadStoreInventory()
      } else {
        storeInfo.value = null
        storeInventory.value = []
      }
    }, { immediate: true })
    
    watch(() => route.query, () => { // 🔧 수정됨
      searchByQueryParams() // 🔧 수정됨
    }, { immediate: true }) // 🔧 수정됨
    
    onMounted(async () => {
      if (user.value) {
        await loadStoreInventory()
      }
    })

    return {
      elementIdInput,
      searchResult,
      error,
      loading,
      searchByElementId,
      openSetPartsModal,
      showSyncModal,
      syncSetNum,
      syncing,
      syncProgress,
      syncStatus,
      syncCompleted,
      syncPartsCount,
      syncError,
      handleSyncConfirm,
      handleSyncClose,
      handleSyncCancel,
      handleSyncRetry,
      closeSetPartsModal,
      searchByAlternativeElementId,
      handleImageError,
      getColorRgb,
      getContrastColor,
      handlePartImageError,
      showSetPartsModal,
      selectedSet,
      setParts,
      setPartsLoading,
      setPartsError,
      formatSetDisplay
    }
  }
}
</script>

<style scoped>
.part-to-set-search-page {
  min-height: 100vh;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  padding: 2rem;
}

.layout-container {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  margin-bottom: 2rem;
  padding: 0;
}

.search-content {
  flex: 1;
  padding: 0;
  overflow-y: auto;
  width: 100%;
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

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.card-header p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
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

.error-message {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  margin-bottom: 2rem;
}

.result-section {
  margin-top: 1.5rem;
  width: 100%;
  max-width: 100%;
}


.set-search-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-part-card {
  margin-top: 0.75rem;
  margin-bottom: 0;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}

.part-image-container {
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

.part-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  padding: 0.5rem;
}

.no-part-image {
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

.part-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.result-header {
  margin-bottom: 1rem;
}

.result-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}
/* // 🔧 수정됨 */

.element-id-badge {
  display: block;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #111827;
}

.part-name-text {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #374151;
  line-height: 1.4;
  word-break: break-word;
}

.part-color {
  padding: 0.25rem 0.75rem;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #6b7280;
}

.sets-grid {
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

.set-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.set-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.set-image {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.set-image img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.no-image {
  color: #9ca3af;
  font-size: 0.875rem;
}

.set-info {
  padding: 1rem;
}

.set-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.set-number {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.set-quantity {
  font-size: 0.875rem;
  color: #3b82f6;
  font-weight: 500;
}

.empty-result {
  padding: 3rem;
  text-align: center;
  color: #6b7280;
}

.alternatives-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.alternative-group {
  margin-bottom: 1rem;
}

.alternative-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.alternative-parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.5rem;
  max-width: 100%;
}

@media (min-width: 1400px) {
  .alternative-parts-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1200px) and (min-width: 900px) {
  .alternative-parts-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  }
}

@media (max-width: 900px) and (min-width: 600px) {
  .alternative-parts-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  }
}

.alternative-part-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
  cursor: pointer;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.alternative-part-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.alternative-part-card .card-header {
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

.alternative-part-card .part-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  width: 0;
}

.alternative-part-card .element-id {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.alternative-part-card .part-name {
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

.alternative-part-card .color-badge {
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

.alternative-part-card .card-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.alternative-part-card .part-image-section {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 0;
  min-height: 120px;
  background: transparent;
  border-radius: 8px;
}

.alternative-part-card .part-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}

.alternative-part-card .no-part-image {
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

.color-badge {
  padding: 0.75rem;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.color-name-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.color-id-text {
  font-size: 0.75rem;
  color: #6b7280;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

@media (max-width: 1024px) {
  .search-section {
    max-width: 100%;
    margin-bottom: 1.5rem;
  }

  .result-section {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .page-header {
    margin-bottom: 1rem;
    padding: 1rem 0 0 0;
  }

  .part-to-set-search-page {
    padding: 1rem;
  }

  .search-section {
    max-width: 100%;
    margin-bottom: 1.5rem;
    padding: 0;
  }

  .setup-card {
    border-radius: 8px;
  }

  .card-header {
    padding: 1rem;
  }

  .card-header h3 {
    font-size: 1rem;
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

  .sets-grid {
    grid-template-columns: 1fr;
  }

  .alternative-parts-grid {
    grid-template-columns: 1fr;
  }

  /* 본문 폰트 사이즈 조정 */
  .part-name {
    font-size: 0.9375rem !important;
  }

  .alternative-part-card {
    padding: 1rem;
  }

  .alternative-part-card .card-header {
    display: flex !important;
    flex-direction: row !important;
    align-items: flex-start !important;
    gap: 0.5rem !important;
    overflow: visible !important;
  }

  .alternative-part-card .part-info {
    width: auto !important;
    flex: 1 !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  .alternative-part-card .part-name {
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    font-size: 0.875rem !important;
  }

  .alternative-part-card .element-id {
    display: block !important;
    font-size: 0.875rem !important;
  }

  .alternative-part-card .color-badge {
    display: inline-block !important;
    font-size: 0.8125rem !important;
  }

  .alternative-part-card .part-image-section {
    min-height: 100px;
    padding: 0.75rem 0;
  }

  .alternative-part-card .part-image {
    max-height: 150px;
  }

  .page-header h1 {
    font-size: 1.25rem !important;
  }

  .page-header p {
    font-size: 0.875rem !important;
  }

  .card-header h3 {
    font-size: 1rem !important;
  }

  .card-header p {
    font-size: 0.8125rem !important;
  }

  .set-search-input {
    font-size: 0.9375rem !important;
  }

  .search-button {
    font-size: 0.875rem !important;
  }

  /* 추가 본문 폰트 사이즈 조정 */
  .part-name-text {
    font-size: 0.9375rem !important;
  }

  .color-name-text {
    font-size: 0.875rem !important;
  }

  .color-id-text {
    font-size: 0.75rem !important;
  }

  .result-header h3 {
    font-size: 1rem !important;
  }


  .part-image-container {
    width: 80px !important;
    height: 80px !important;
    min-width: 80px !important;
    min-height: 80px !important;
  }

  .part-info {
    gap: 0.25rem;
  }

  .element-id-badge {
    font-size: 0.8125rem !important;
  }

  .part-name-text {
    font-size: 0.875rem !important;
  }

  .set-info {
    font-size: 0.875rem !important;
  }

  .alternative-title {
    font-size: 0.9375rem !important;
  }

  .element-id-badge {
    font-size: 0.8125rem !important;
  }

  .set-name {
    font-size: 0.9375rem !important;
  }

  .set-number {
    font-size: 0.875rem !important;
  }

  .set-quantity {
    font-size: 0.875rem !important;
  }
}

/* 모달 스타일 */
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
  padding: 2rem;
}

.modal-container {
  background: white;
  border-radius: 8px;
  max-width: 90vw;
  max-height: 90vh;
  width: 1000px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

.modal-close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.modal-close-button:hover {
  color: #1f2937;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.loading-message,
.error-message,
.empty-message {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.error-message {
  color: #dc2626;
}

.set-parts-list {
  max-height: calc(90vh - 120px);
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.part-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  gap: 1rem;
}

.part-image-wrapper {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  background: #f3f4f6;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.part-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.5rem;
}

.no-part-image-small {
  color: #9ca3af;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.5rem;
}

.part-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.part-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.part-info-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: #6b7280;
}

.part-id,
.element-id {
  font-weight: 500;
}

.color-name {
  font-weight: 600;
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
  width: fit-content;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 1rem;
  }

  .modal-container {
    max-width: 100%;
    max-height: 100%;
  }

  .parts-grid {
    grid-template-columns: 1fr;
  }
}
</style>


