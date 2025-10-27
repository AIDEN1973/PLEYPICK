<template>
  <div class="dataset-converter">
    <div class="header">
      <h1>📊 데이터셋 변환</h1>
      <p>렌더링된 이미지를 YOLO 학습용 데이터셋으로 변환합니다.</p>
    </div>

    <!-- 상태 표시 -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-content">
          <span class="stat-label">소스 이미지:</span>
          <span class="stat-value">{{ datasetStats.sourceImages }}개</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <span class="stat-label">변환 완료:</span>
          <span class="stat-value">{{ datasetStats.convertedImages }}개</span>
        </div>
      </div>
    </div>

    <!-- 변환 컨트롤 -->
    <div class="conversion-controls">
      <!-- 변환 타입 선택 -->
      <div class="conversion-type-selector">
        <h3>🔄 변환 타입 선택</h3>
        <div class="type-options">
          <label class="type-option" :class="{ 'selected': conversionType === 'all' }">
            <input 
              type="radio" 
              v-model="conversionType" 
              value="all"
              :disabled="isConverting"
            >
            <div class="option-content">
              <div class="option-icon">🌐</div>
              <div class="option-text">
                <div class="option-title">전체 변환</div>
                <div class="option-description">모든 렌더링된 이미지를 변환합니다</div>
              </div>
            </div>
          </label>
          
          <label class="type-option" :class="{ 'selected': conversionType === 'parts' }">
            <input 
              type="radio" 
              v-model="conversionType" 
              value="parts"
              :disabled="isConverting"
            >
            <div class="option-content">
              <div class="option-icon">🧩</div>
              <div class="option-text">
                <div class="option-title">부품단위 변환</div>
                <div class="option-description">개별 부품 이미지만 변환합니다</div>
              </div>
            </div>
          </label>
          
          <label class="type-option" :class="{ 'selected': conversionType === 'sets' }">
            <input 
              type="radio" 
              v-model="conversionType" 
              value="sets"
              :disabled="isConverting"
            >
            <div class="option-content">
              <div class="option-icon">📦</div>
              <div class="option-text">
                <div class="option-title">세트단위 변환</div>
                <div class="option-description">세트 이미지만 변환합니다</div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <!-- 부품/세트 선택 -->
      <div v-if="conversionType === 'parts' || conversionType === 'sets'" class="item-selector">
        <h3>{{ conversionType === 'parts' ? '🧩 부품 선택' : '📦 세트 선택' }}</h3>
        
        <!-- 검색 및 필터 -->
        <div class="search-controls">
          <div class="search-input">
            <input 
              type="text" 
              v-model="searchQuery"
              :placeholder="conversionType === 'parts' ? '부품 ID, 이름, 형태로 검색...' : '세트 번호, 이름으로 검색...'"
              @input="debouncedSearch"
              :disabled="isConverting"
            >
            <span class="search-icon">🔍</span>
          </div>
          
          <div class="filter-controls">
            <select v-model="sortBy" :disabled="isConverting">
              <option value="id">{{ conversionType === 'parts' ? '부품 ID' : '세트 번호' }}</option>
              <option value="name">이름</option>
              <option value="year" v-if="conversionType === 'sets'">연도</option>
            </select>
          </div>
        </div>

        <!-- 로딩 상태 -->
        <div v-if="loadingItems" class="loading-state">
          <div class="spinner"></div>
          <span>{{ conversionType === 'parts' ? '부품 목록을 불러오는 중...' : '세트 목록을 불러오는 중...' }}</span>
        </div>

        <!-- 아이템 목록 -->
        <div v-else class="items-list">
          <div class="items-grid">
            <div 
              v-for="item in filteredItems" 
              :key="item.id || item.part_id"
              class="item-card"
              :class="{ 'selected': isItemSelected(item) }"
              @click="toggleItemSelection(item)"
            >
              <div class="item-header">
                <div class="item-id">{{ item.part_id || item.set_num }}</div>
                <div class="item-checkbox">
                  <input 
                    type="checkbox" 
                    :checked="isItemSelected(item)"
                    @change="toggleItemSelection(item)"
                  >
                </div>
              </div>
              
              <div class="item-content">
                <div class="item-name">{{ item.name || item.part_name || item.shape_tag }}</div>
                <div class="item-details">
                  <span v-if="conversionType === 'parts'" class="detail-item">
                    <span class="detail-label">색상:</span>
                    <span class="detail-value" :style="{ color: item.color_rgb }">
                      {{ item.color_name }}
                    </span>
                  </span>
                  <span v-if="conversionType === 'sets'" class="detail-item">
                    <span class="detail-label">연도:</span>
                    <span class="detail-value">{{ item.year }}</span>
                  </span>
                  <span v-if="conversionType === 'sets'" class="detail-item">
                    <span class="detail-label">부품 수:</span>
                    <span class="detail-value">{{ item.num_parts }}개</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 페이지네이션 -->
          <div v-if="pagination.total > pagination.limit" class="pagination">
            <button 
              @click="loadPreviousPage"
              :disabled="pagination.offset === 0 || loadingItems"
              class="btn btn-secondary"
            >
              이전
            </button>
            
            <span class="page-info">
              {{ Math.floor(pagination.offset / pagination.limit) + 1 }} / 
              {{ Math.ceil(pagination.total / pagination.limit) }} 페이지
            </span>
            
            <button 
              @click="loadNextPage"
              :disabled="!pagination.hasMore || loadingItems"
              class="btn btn-secondary"
            >
              다음
            </button>
          </div>
        </div>

        <!-- 선택된 아이템 요약 -->
        <div v-if="selectedItems.length > 0" class="selected-summary">
          <h4>선택된 {{ conversionType === 'parts' ? '부품' : '세트' }} ({{ selectedItems.length }}개)</h4>
          <div class="selected-items">
            <div 
              v-for="item in selectedItems.slice(0, 5)" 
              :key="item.id || item.part_id"
              class="selected-item"
            >
              {{ item.part_id || item.set_num }} - {{ item.name || item.part_name || item.shape_tag }}
            </div>
            <div v-if="selectedItems.length > 5" class="more-items">
              ... 외 {{ selectedItems.length - 5 }}개
            </div>
          </div>
        </div>
      </div>

      <div class="control-buttons">
        <button
          @click="startConversion"
          :disabled="isConverting || !hasRenderedData"
          :class="{ 'btn-disabled': isConverting || !hasRenderedData }"
          class="btn btn-primary"
        >
          <span v-if="isConverting">
            🔄 변환 중... ({{ conversionProgress }}%)
          </span>
          <span v-else>
            🚀 데이터셋 변환 시작
          </span>
        </button>

        <button
          @click="stopConversion"
          :disabled="!isConverting"
          :class="{ 'btn-disabled': !isConverting }"
          class="btn btn-secondary"
        >
          ⏹️ 변환 중지
        </button>

        <button
          @click="downloadDataset"
          :disabled="!hasConvertedData"
          :class="{ 'btn-disabled': !hasConvertedData }"
          class="btn btn-success"
        >
          📁 데이터셋 정보 조회
        </button>
      </div>

      <!-- 변환 진행률 표시 -->
      <div v-if="isConverting" class="conversion-progress">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: conversionProgress + '%' }"
          ></div>
        </div>
        <p class="progress-text">{{ conversionStatus }}</p>
      </div>

      <!-- 변환 로그 -->
      <div class="conversion-logs">
        <h4>변환 로그</h4>
        <div class="log-container">
          <div 
            v-for="(log, index) in conversionLogs" 
            :key="index"
            :class="['log-entry', `log-${log.type}`]"
          >
            <span class="log-time">{{ log.time }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 데이터셋 정보 -->
    <div v-if="hasConvertedData" class="dataset-info">
      <h3>📦 변환된 데이터셋 정보</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">총 이미지 수:</span>
          <span class="info-value">{{ datasetStats.convertedImages }}개</span>
        </div>
        <div class="info-item">
          <span class="info-label">변환 상태:</span>
          <span class="info-value success">✅ 완료</span>
        </div>
        <div class="info-item">
          <span class="info-label">변환 시간:</span>
          <span class="info-value">{{ conversionTime }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import { useSupabase } from '@/composables/useSupabase'

export default {
  name: 'DatasetConverter',
  setup() {
    // Supabase 클라이언트
    const { supabase } = useSupabase()
    
    // 데이터셋 변환 관련 상태
    const isConverting = ref(false)
    const conversionProgress = ref(0)
    const conversionStatus = ref('대기 중')
    const conversionLogs = ref([])
    const currentJobId = ref(null)
    const conversionType = ref('all') // 'all', 'parts', 'sets'
    const datasetStats = ref({
      sourceImages: 0,
      convertedImages: 0,
      progress: 0
    })
    const hasConvertedData = ref(false)

    // 부품/세트 선택 관련 상태
    const loadingItems = ref(false)
    const searchQuery = ref('')
    const sortBy = ref('id')
    const items = ref([])
    const selectedItems = ref([])
    const pagination = ref({
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false
    })
    const searchTimeout = ref(null)

    const hasRenderedData = computed(() => datasetStats.value.sourceImages > 0)
    const conversionTime = ref('')

    // 필터링된 아이템 목록
    const filteredItems = computed(() => {
      return items.value.filter(item => {
        if (!searchQuery.value) return true
        
        const searchLower = searchQuery.value.toLowerCase()
        if (conversionType.value === 'parts') {
          return (
            item.part_id?.toLowerCase().includes(searchLower) ||
            item.shape_tag?.toLowerCase().includes(searchLower) ||
            item.feature_text?.toLowerCase().includes(searchLower) ||
            item.color_name?.toLowerCase().includes(searchLower)
          )
        } else {
          return (
            item.set_num?.toLowerCase().includes(searchLower) ||
            item.name?.toLowerCase().includes(searchLower) ||
            item.theme_name?.toLowerCase().includes(searchLower)
          )
        }
      })
    })

    // 로그 추가 함수
    const addConversionLog = (message, type = 'info') => {
      const log = {
        time: new Date().toLocaleTimeString(),
        message,
        type
      }
      conversionLogs.value.push(log)
      
      // 로그가 너무 많아지면 오래된 것 제거
      if (conversionLogs.value.length > 100) {
        conversionLogs.value = conversionLogs.value.slice(-50)
      }
    }

    // 소스 이미지 확인
    const checkSourceImages = async () => {
      try {
        const response = await fetch('/api/dataset/source-count')
        
        if (!response.ok) {
          throw new Error(`API 오류: ${response.status}`)
        }
        
        const text = await response.text()
        if (!text.trim()) {
          return 0
        }
        
        // JSON 파싱 시도
        try {
          const data = JSON.parse(text)
          return data.count || 0
        } catch (parseError) {
          console.warn('JSON 파싱 실패, 텍스트 응답으로 처리:', parseError)
          // HTML 응답인 경우 0 반환
          if (text.includes('<html>') || text.includes('<!DOCTYPE')) {
            return 0
          }
          // 숫자만 있는 경우 파싱 시도
          const numberMatch = text.match(/\d+/)
          return numberMatch ? parseInt(numberMatch[0]) : 0
        }
      } catch (error) {
        console.error('Source count check error:', error)
        return 0
      }
    }

    // 부품/세트 목록 로드 (직접 Supabase 사용)
    const loadItems = async (reset = true) => {
      if (conversionType.value === 'all') return
      
      try {
        loadingItems.value = true
        
        // 기존 Supabase 클라이언트 사용
        
        if (conversionType.value === 'parts') {
          // 부품 목록 조회
          let query = supabase
            .from('parts_master_features')
            .select(`
              part_id,
              color_id,
              part_name,
              shape_tag,
              feature_text,
              confidence
            `)
            .order('part_id')
            .range(
              reset ? 0 : pagination.value.offset, 
              (reset ? 0 : pagination.value.offset) + pagination.value.limit - 1
            )

          // 검색어가 있으면 필터링
          if (searchQuery.value) {
            query = query.or(`part_id.ilike.%${searchQuery.value}%,shape_tag.ilike.%${searchQuery.value}%,feature_text.ilike.%${searchQuery.value}%`)
          }

          const { data: parts, error } = await query

          if (error) {
            throw error
          }

          // 색상 정보 일괄 조회
          const colorIds = [...new Set(parts.map(part => part.color_id))]
          const { data: colorsData } = await supabase
            .from('lego_colors')
            .select('color_id, name, rgb')
            .in('color_id', colorIds)

          // 색상 정보 맵 생성
          const colorMap = new Map()
          if (colorsData) {
            colorsData.forEach(color => {
              colorMap.set(color.color_id, { name: color.name, rgb: color.rgb })
            })
          }

          // 부품별 색상 정보 추가
          const partsWithColors = parts.map(part => {
            const colorInfo = colorMap.get(part.color_id) || { name: 'Unknown', rgb: '#000000' }
            return {
              ...part,
              color_name: colorInfo.name,
              color_rgb: colorInfo.rgb
            }
          })

          // 총 개수 조회
          const { count } = await supabase
            .from('parts_master_features')
            .select('*', { count: 'exact', head: true })

          if (reset) {
            items.value = partsWithColors
            pagination.value.offset = 0
          } else {
            items.value = [...items.value, ...partsWithColors]
          }
          
          pagination.value = {
            ...pagination.value,
            total: count || 0,
            hasMore: (pagination.value.offset + pagination.value.limit) < (count || 0),
            offset: reset ? 0 : pagination.value.offset
          }
          
        } else if (conversionType.value === 'sets') {
          // 세트 목록 조회
          let query = supabase
            .from('lego_sets')
            .select(`
              id,
              set_num,
              name,
              year,
              theme_id,
              num_parts,
              set_img_url
            `)
            .order('set_num')
            .range(
              reset ? 0 : pagination.value.offset, 
              (reset ? 0 : pagination.value.offset) + pagination.value.limit - 1
            )

          // 검색어가 있으면 필터링
          if (searchQuery.value) {
            query = query.or(`set_num.ilike.%${searchQuery.value}%,name.ilike.%${searchQuery.value}%`)
          }

          const { data: sets, error } = await query

          if (error) {
            throw error
          }

          // 테마 정보 일괄 조회
          const themeIds = [...new Set(sets.map(set => set.theme_id))]
          const { data: themesData } = await supabase
            .from('lego_themes')
            .select('theme_id, name')
            .in('theme_id', themeIds)

          // 테마 정보 맵 생성
          const themeMap = new Map()
          if (themesData) {
            themesData.forEach(theme => {
              themeMap.set(theme.theme_id, theme.name)
            })
          }

          // 세트별 테마 정보 추가
          const setsWithThemes = sets.map(set => {
            const themeName = themeMap.get(set.theme_id) || 'Unknown'
            return {
              ...set,
              theme_name: themeName
            }
          })

          // 총 개수 조회
          const { count } = await supabase
            .from('lego_sets')
            .select('*', { count: 'exact', head: true })

          if (reset) {
            items.value = setsWithThemes
            pagination.value.offset = 0
          } else {
            items.value = [...items.value, ...setsWithThemes]
          }
          
          pagination.value = {
            ...pagination.value,
            total: count || 0,
            hasMore: (pagination.value.offset + pagination.value.limit) < (count || 0),
            offset: reset ? 0 : pagination.value.offset
          }
        }
        
      } catch (error) {
        addConversionLog(`목록 로드 오류: ${error.message}`, 'error')
      } finally {
        loadingItems.value = false
      }
    }

    // 검색 디바운싱
    const debouncedSearch = () => {
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value)
      }
      
      searchTimeout.value = setTimeout(() => {
        loadItems(true)
      }, 500)
    }

    // 아이템 선택 토글
    const toggleItemSelection = (item) => {
      const index = selectedItems.value.findIndex(selected => 
        (selected.id || selected.part_id) === (item.id || item.part_id)
      )
      
      if (index > -1) {
        selectedItems.value.splice(index, 1)
      } else {
        selectedItems.value.push(item)
      }
    }

    // 아이템 선택 상태 확인
    const isItemSelected = (item) => {
      return selectedItems.value.some(selected => 
        (selected.id || selected.part_id) === (item.id || item.part_id)
      )
    }

    // 페이지네이션
    const loadNextPage = () => {
      if (pagination.value.hasMore) {
        pagination.value.offset += pagination.value.limit
        loadItems(false)
      }
    }

    const loadPreviousPage = () => {
      if (pagination.value.offset > 0) {
        pagination.value.offset = Math.max(0, pagination.value.offset - pagination.value.limit)
        loadItems(true)
      }
    }

    // 데이터셋 변환 시작
    const startConversion = async () => {
      try {
        isConverting.value = true
        conversionStatus.value = '변환 시작...'
        const startTime = new Date()
        
        addConversionLog('데이터셋 변환을 시작합니다.', 'info')

        // 프로덕션 환경 체크
        if (import.meta.env.PROD) {
          addConversionLog('⚠️ 프로덕션 환경에서는 데이터셋 변환이 제한됩니다.', 'warning')
          isConverting.value = false
          return
        }

        // 렌더링된 이미지 확인
        const sourceCount = await checkSourceImages()
        datasetStats.value.sourceImages = sourceCount
        
        if (sourceCount === 0) {
          addConversionLog('변환할 이미지가 없습니다. 먼저 렌더링을 완료하세요.', 'error')
          isConverting.value = false
          return
        }

        // 데이터셋 변환 API 호출
        const conversionTypeText = {
          'all': '전체',
          'parts': '부품단위',
          'sets': '세트단위'
        }
        
        // 선택된 아이템 검증
        if ((conversionType.value === 'parts' || conversionType.value === 'sets') && selectedItems.value.length === 0) {
          addConversionLog('변환할 부품이나 세트를 선택해주세요.', 'error')
          isConverting.value = false
          return
        }

        addConversionLog(`${conversionTypeText[conversionType.value]} 변환을 시작합니다...`, 'info')
        
        // 선택된 아이템 정보 추가
        const requestBody = {
          sourcePath: 'output/synthetic',
          targetPath: 'data/brickbox_dataset',
          format: 'yolo',
          conversionType: conversionType.value
        }

        if (conversionType.value === 'parts' && selectedItems.value.length > 0) {
          requestBody.selectedParts = selectedItems.value.map(item => ({
            part_id: item.part_id,
            color_id: item.color_id,
            element_id: item.element_id
          }))
          addConversionLog(`선택된 부품 ${selectedItems.value.length}개를 변환합니다.`, 'info')
        } else if (conversionType.value === 'sets' && selectedItems.value.length > 0) {
          requestBody.selectedSets = selectedItems.value.map(item => ({
            set_id: item.id,
            set_num: item.set_num
          }))
          addConversionLog(`선택된 세트 ${selectedItems.value.length}개를 변환합니다.`, 'info')
        }

        const response = await fetch('/api/dataset/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          throw new Error(`변환 실패: ${response.statusText}`)
        }

        const result = await response.json()
        
        // jobId 저장
        currentJobId.value = result.jobId
        
        // 변환 진행률 모니터링 시작
        await monitorConversionProgress()
        
        const endTime = new Date()
        conversionTime.value = `${Math.round((endTime - startTime) / 1000)}초`

      } catch (error) {
        addConversionLog(`변환 중 오류 발생: ${error.message}`, 'error')
      } finally {
        isConverting.value = false
      }
    }

    // 변환 중지
    const stopConversion = () => {
      isConverting.value = false
      currentJobId.value = null
      addConversionLog('데이터셋 변환이 중지되었습니다.', 'warning')
    }

    // 경로 복사 함수
    const copyPathToClipboard = async (path) => {
      try {
        await navigator.clipboard.writeText(path)
        addConversionLog('✅ 경로가 클립보드에 복사되었습니다!', 'success')
      } catch (error) {
        addConversionLog('❌ 경로 복사 실패: 수동으로 복사해주세요.', 'error')
      }
    }

    // 데이터셋 다운로드
    const downloadDataset = async () => {
      try {
        addConversionLog('데이터셋 정보를 조회합니다...', 'info')
        
        const response = await fetch('/api/dataset/download', {
          method: 'GET'
        })

        if (!response.ok) {
          const errorData = await response.json()
          if (response.status === 404) {
            addConversionLog('데이터셋이 아직 생성되지 않았습니다. 먼저 변환을 완료하세요.', 'error')
            return
          } else {
            throw new Error(`조회 실패: ${errorData.error || response.statusText}`)
          }
        }

        const data = await response.json()
        
        if (data.success) {
          addConversionLog('데이터셋 폴더 구조 정보를 받았습니다.', 'success')
          
          // 경로를 강조하여 표시
          addConversionLog('📍 데이터셋 저장 경로:', 'info')
          addConversionLog(`📂 ${data.datasetPath}`, 'success')
          addConversionLog('', 'info') // 빈 줄
          
          // 폴더 구조 정보 표시
          if (data.structure && data.structure.length > 0) {
            addConversionLog('📁 데이터셋 구조:', 'info')
            const displayStructure = (items, depth = 0) => {
              items.forEach(item => {
                const indent = '  '.repeat(depth)
                if (item.type === 'directory') {
                  addConversionLog(`${indent}📁 ${item.name}/`, 'info')
                  if (item.children) {
                    displayStructure(item.children, depth + 1)
                  }
                } else {
                  const sizeKB = (item.size / 1024).toFixed(1)
                  addConversionLog(`${indent}📄 ${item.name} (${sizeKB}KB)`, 'info')
                }
              })
            }
            displayStructure(data.structure)
            addConversionLog('', 'info') // 빈 줄
          }
          
          // 사용 방법 안내
          if (data.instructions) {
            addConversionLog('📋 사용 방법:', 'info')
            data.instructions.forEach((instruction, index) => {
              addConversionLog(`${index + 1}. ${instruction}`, 'info')
            })
            addConversionLog('', 'info') // 빈 줄
          }
          
          // 경로 복사 안내
          addConversionLog('💡 위 경로를 복사하여 파일 탐색기에서 열어주세요.', 'warning')
          addConversionLog('📋 경로 복사: Ctrl+C로 복사 가능', 'info')
          
          // 경로를 클립보드에 복사
          await copyPathToClipboard(data.datasetPath)
        } else {
          addConversionLog(`데이터셋 조회 실패: ${data.error}`, 'error')
        }
        
      } catch (error) {
        addConversionLog(`조회 중 오류 발생: ${error.message}`, 'error')
      }
    }

    // 변환 진행률 모니터링
    const monitorConversionProgress = async () => {
      if (!currentJobId.value) {
        addConversionLog('작업 ID가 없습니다.', 'error')
        return
      }

      let attempts = 0
      const maxAttempts = 100

      while (isConverting.value && attempts < maxAttempts) {
        try {
          const response = await fetch(`/api/dataset/progress?jobId=${currentJobId.value}`)
          const data = await response.json()
          
          if (!data.success) {
            addConversionLog(`진행률 조회 실패: ${data.error}`, 'error')
            break
          }
          
          conversionStatus.value = data.status || '변환 중...'
          conversionProgress.value = data.progress || 0
          datasetStats.value.progress = conversionProgress.value

          if (data.logs && data.logs.length > 0) {
            data.logs.forEach(log => {
              addConversionLog(log.message, log.type)
            })
          }

          if (data.progress >= 100) {
            hasConvertedData.value = true
            datasetStats.value.convertedImages = datasetStats.value.sourceImages
            isConverting.value = false
            addConversionLog('데이터셋 변환이 완료되었습니다!', 'success')
            break
          }

          await new Promise(resolve => setTimeout(resolve, 5000)) // 5초 대기
          attempts++
        } catch (error) {
          addConversionLog(`진행률 모니터링 오류: ${error.message}`, 'error')
          break
        }
      }
    }

    // 변환 타입 변경 감지
    watch(conversionType, (newType) => {
      if (newType === 'parts' || newType === 'sets') {
        selectedItems.value = [] // 선택 초기화
        loadItems(true)
      }
    })

    onMounted(async () => {
      // 초기 데이터 로드
      const sourceCount = await checkSourceImages()
      datasetStats.value.sourceImages = sourceCount
      
      if (sourceCount > 0) {
        addConversionLog('렌더링된 이미지를 발견했습니다. 변환을 시작할 수 있습니다.', 'info')
      } else {
        addConversionLog('렌더링된 이미지가 없습니다. 먼저 합성 데이터셋 페이지에서 렌더링을 완료하세요.', 'warning')
      }
    })

    return {
      // 상태
      datasetStats,
      isConverting,
      conversionProgress,
      conversionStatus,
      conversionLogs,
      hasConvertedData,
      hasRenderedData,
      conversionTime,
      conversionType,
      
      // 부품/세트 선택 관련
      loadingItems,
      searchQuery,
      sortBy,
      items,
      selectedItems,
      pagination,
      filteredItems,

      // 메서드
      startConversion,
      stopConversion,
      downloadDataset,
      copyPathToClipboard,
      addConversionLog,
      loadItems,
      debouncedSearch,
      toggleItemSelection,
      isItemSelected,
      loadNextPage,
      loadPreviousPage
    }
  }
}
</script>

<style scoped>
.dataset-converter {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.header p {
  font-size: 1.1rem;
  color: #7f8c8d;
}

/* 상태 표시 */
.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
}

/* 변환 컨트롤 */
.conversion-controls {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

/* 변환 타입 선택 */
.conversion-type-selector {
  margin-bottom: 2rem;
}

.conversion-type-selector h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.type-option {
  display: block;
  cursor: pointer;
  border: 2px solid #ecf0f1;
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  background: #f8f9fa;
}

.type-option:hover {
  border-color: #3498db;
  background: #e3f2fd;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.2);
}

.type-option.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.type-option input[type="radio"] {
  display: none;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.option-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.option-text {
  flex: 1;
}

.option-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.option-description {
  font-size: 0.9rem;
  opacity: 0.8;
}

.type-option.selected .option-description {
  opacity: 0.9;
}

/* 부품/세트 선택 */
.item-selector {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.item-selector h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.search-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.search-input {
  position: relative;
  flex: 1;
}

.search-input input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.search-input input:focus {
  outline: none;
  border-color: #667eea;
}

.search-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.2rem;
  color: #6c757d;
}

.filter-controls select {
  padding: 0.75rem 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  color: #6c757d;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.items-list {
  max-height: 400px;
  overflow-y: auto;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.item-card {
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.item-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.item-card.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.item-id {
  font-weight: 600;
  font-size: 0.9rem;
  color: #6c757d;
}

.item-card.selected .item-id {
  color: rgba(255, 255, 255, 0.9);
}

.item-checkbox input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-name {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.detail-label {
  color: #6c757d;
  font-weight: 500;
}

.detail-value {
  font-weight: 600;
}

.item-card.selected .detail-label {
  color: rgba(255, 255, 255, 0.8);
}

.item-card.selected .detail-value {
  color: white;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid #e9ecef;
}

.page-info {
  font-size: 0.9rem;
  color: #6c757d;
}

.selected-summary {
  margin-top: 1rem;
  padding: 1rem;
  background: #e3f2fd;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.selected-summary h4 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.selected-items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.selected-item {
  font-size: 0.9rem;
  color: #495057;
  padding: 0.25rem 0;
}

.more-items {
  font-size: 0.85rem;
  color: #6c757d;
  font-style: italic;
}

.control-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(.btn-disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #e74c3c;
  color: white;
}

.btn-secondary:hover:not(.btn-disabled) {
  background: #c0392b;
  transform: translateY(-2px);
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover:not(.btn-disabled) {
  background: #229954;
  transform: translateY(-2px);
}

.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* 진행률 표시 */
.conversion-progress {
  margin-bottom: 2rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  color: #7f8c8d;
  font-weight: 500;
}

/* 변환 로그 */
.conversion-logs h4 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.log-container {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #ecf0f1;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  font-size: 0.8rem;
  color: #7f8c8d;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-info {
  color: #3498db;
}

.log-success {
  color: #27ae60;
}

.log-warning {
  color: #f39c12;
}

.log-error {
  color: #e74c3c;
}

/* 데이터셋 정보 */
.dataset-info {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.dataset-info h3 {
  color: #2c3e50;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.info-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
}

.info-value.success {
  color: #27ae60;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .dataset-converter {
    padding: 1rem;
  }

  .header h1 {
    font-size: 2rem;
  }

  .control-buttons {
    flex-direction: column;
  }

  .btn {
    justify-content: center;
  }

  .stats-section {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .type-options {
    grid-template-columns: 1fr;
  }

  .option-content {
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }

  .option-icon {
    font-size: 1.5rem;
  }

  .search-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .items-grid {
    grid-template-columns: 1fr;
  }

  .item-card {
    padding: 0.75rem;
  }

  .pagination {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
