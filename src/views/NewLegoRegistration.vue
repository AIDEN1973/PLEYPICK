<template>
  <div class="lego-set-manager">
    <div class="header">
      <h1>신규 레고 등록</h1>
      <p>Rebrickable API를 통해 새로운 레고 세트를 검색하고 데이터베이스에 등록합니다.</p>
    </div>

    <!-- 세트 검색 -->
    <div class="search-section">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="레고 세트 번호 또는 이름을 검색하세요..."
          @keyup.enter="searchSets"
          class="search-input"
        />
        <button @click="searchSets" :disabled="loading" class="search-btn">
          {{ loading ? '검색 중...' : '검색' }}
        </button>
      </div>
    </div>

    <!-- 검색 결과 -->
    <div v-if="searchResults.length > 0" class="search-results">
      <h3>검색 결과 ({{ searchResults.length }}개)</h3>
      <div class="data-source-info">
        <span v-if="isLocalData" class="source-badge local">📁 로컬 데이터베이스</span>
        <span v-else class="source-badge api">🌐 Rebrickable API</span>
      </div>
      <div class="sets-grid">
        <div 
          v-for="set in searchResults" 
          :key="set.set_num"
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
            <p class="set-year">{{ set.year }}</p>
            <p class="set-pieces">{{ set.num_parts }}개 부품</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 선택된 세트 상세 정보 -->
    <div v-if="selectedSet" class="selected-set">
      <div class="set-details">
        <div class="set-main-info">
          <img :src="selectedSet.set_img_url" :alt="selectedSet.name" class="set-large-image" />
          <div class="set-details-text">
            <h2>{{ selectedSet.name }}</h2>
            <p><strong>세트 번호:</strong> {{ selectedSet.set_num }}</p>
            <p><strong>연도:</strong> {{ selectedSet.year }}</p>
            <p><strong>부품 수:</strong> {{ selectedSet.num_parts }}개</p>
            <p><strong>테마:</strong> {{ selectedSet.theme_id }}</p>
            <div class="action-buttons">
              <button @click="loadSetParts" :disabled="loadingParts" class="btn btn-primary">
                {{ loadingParts ? '모든 부품 로딩 중...' : '모든 부품 목록 보기' }}
              </button>
              <button @click="saveSetToDatabase" :disabled="saving" class="btn btn-secondary">
                {{ saving ? '저장 중...' : '데이터베이스에 저장' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 부품 목록 -->
      <div v-if="setParts.length > 0" class="parts-section">
        <h3>부품 목록 ({{ setParts.length }}개)</h3>
        <div class="parts-controls">
          <button @click="downloadAllPartImages" :disabled="downloadingImages" class="btn btn-success">
            {{ downloadingImages ? '이미지 다운로드 중...' : '모든 부품 이미지 다운로드' }}
          </button>
          <button @click="exportPartsData" class="btn btn-info">
            부품 데이터 내보내기
          </button>
        </div>
        
        <div class="parts-grid">
          <div 
            v-for="part in setParts" 
            :key="`${part.part.part_num}-${part.color_id}`"
            class="part-card"
          >
            <div class="part-image">
              <img 
                :src="part.part.part_img_url" 
                :alt="part.part.name"
                @error="handleImageError"
              />
            </div>
            <div class="part-info">
              <h4>{{ part.part.name }}</h4>
              <p><strong>부품 번호:</strong> {{ part.part.part_num }}</p>
              <p><strong>색상:</strong> {{ part.color.name }}</p>
              <p><strong>수량:</strong> {{ part.quantity }}개</p>
              <div class="part-actions">
                <button 
                  @click="downloadPartImage(part)" 
                  :disabled="downloadingImages"
                  class="btn btn-sm btn-primary"
                >
                  이미지 다운로드
                </button>
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
import { ref, onMounted } from 'vue'
import { useRebrickable } from '../composables/useRebrickable'
import { useImageManager } from '../composables/useImageManager'
import { useDatabase } from '../composables/useDatabase'
import { supabase } from '../composables/useSupabase'

export default {
  name: 'LegoSetManager',
  setup() {
    const { 
      loading, 
      error, 
      searchSets: searchSetsAPI, 
      getSet, 
      getSetParts: getSetPartsAPI 
    } = useRebrickable()
    
    const { 
      downloadingImages, 
      processRebrickableImage, 
      processMultipleImages,
      saveImageMetadata
    } = useImageManager()

    const {
      saveLegoSet,
      saveLegoPart,
      saveLegoColor,
      saveSetPart,
      savePartImage,
      saveOperationLog,
      getLegoSets,
      getSetParts
    } = useDatabase()

    const searchQuery = ref('')
    const searchResults = ref([])
    const selectedSet = ref(null)
    const setParts = ref([])
    const loadingParts = ref(false)
    const saving = ref(false)
    const successMessage = ref('')
    const isLocalData = ref(false)

    const searchSets = async () => {
      if (!searchQuery.value.trim()) return
      
      try {
        // 임시로 API에서만 검색 (데이터베이스 스키마 생성 후 로컬 검색 활성화)
        console.log('Searching Rebrickable API...')
        const result = await searchSetsAPI(searchQuery.value)
        searchResults.value = result.results || []
        isLocalData.value = false
        
        // TODO: 데이터베이스 스키마 생성 후 로컬 검색 활성화
        // 1. 먼저 Supabase에서 검색
        // const localResults = await searchLocalSets(searchQuery.value)
        // if (localResults.length > 0) {
        //   searchResults.value = localResults
        //   isLocalData.value = true
        //   console.log('Found in local database:', localResults.length, 'sets')
        // } else {
        //   // 2. 로컬에 없으면 Rebrickable API에서 검색
        //   console.log('Not found locally, searching Rebrickable API...')
        //   const result = await searchSetsAPI(searchQuery.value)
        //   searchResults.value = result.results || []
        //   isLocalData.value = false
        // }
      } catch (err) {
        console.error('Search failed:', err)
        error.value = `검색 중 오류가 발생했습니다: ${err.message}`
      }
    }

    // 로컬 데이터베이스에서 세트 검색
    const searchLocalSets = async (query) => {
      try {
        const { data, error } = await supabase
          .from('lego_sets')
          .select('*')
          .or(`set_num.ilike.%${query}%,name.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) throw error
        return data || []
      } catch (err) {
        console.error('Local search failed:', err)
        return []
      }
    }

    const selectSet = async (set) => {
      try {
        // 임시로 API에서만 가져오기 (데이터베이스 스키마 생성 후 로컬 검색 활성화)
        console.log('Fetching from Rebrickable API...')
        const result = await getSet(set.set_num)
        selectedSet.value = result
        setParts.value = []
        
        // TODO: 데이터베이스 스키마 생성 후 로컬 검색 활성화
        // 1. 먼저 로컬 데이터베이스에서 확인
        // const localSet = await getLocalSet(set.set_num)
        // if (localSet) {
        //   selectedSet.value = localSet
        //   console.log('Loaded from local database')
        //   // 로컬 부품 정보도 로드
        //   const localParts = await getLocalSetParts(localSet.id)
        //   setParts.value = localParts
        // } else {
        //   // 2. 로컬에 없으면 Rebrickable API에서 가져오기
        //   console.log('Not found locally, fetching from Rebrickable API...')
        //   const result = await getSet(set.set_num)
        //   selectedSet.value = result
        //   setParts.value = []
        // }
      } catch (err) {
        console.error('Failed to get set details:', err)
        error.value = `세트 정보를 가져오는 중 오류가 발생했습니다: ${err.message}`
      }
    }

    // 로컬 데이터베이스에서 세트 정보 가져오기
    const getLocalSet = async (setNum) => {
      try {
        const { data, error } = await supabase
          .from('lego_sets')
          .select('*')
          .eq('set_num', setNum)
          .single()

        if (error && error.code !== 'PGRST116') throw error
        return data
      } catch (err) {
        console.error('Failed to get local set:', err)
        return null
      }
    }

    // 로컬 데이터베이스에서 세트 부품 정보 가져오기
    const getLocalSetParts = async (setId) => {
      try {
        const { data, error } = await supabase
          .from('set_parts')
          .select(`
            *,
            lego_parts(*),
            lego_colors(*)
          `)
          .eq('set_id', setId)

        if (error) throw error
        return data || []
      } catch (err) {
        console.error('Failed to get local set parts:', err)
        return []
      }
    }

    const loadSetParts = async () => {
      if (!selectedSet.value) return
      
      loadingParts.value = true
      try {
        console.log(`Loading all parts for set ${selectedSet.value.set_num}...`)
        const result = await getSetPartsAPI(selectedSet.value.set_num)
        setParts.value = result.results || []
        console.log(`Loaded ${setParts.value.length} parts`)
      } catch (err) {
        console.error('Failed to load parts:', err)
        error.value = `부품 로딩 중 오류가 발생했습니다: ${err.message}`
      } finally {
        loadingParts.value = false
      }
    }

    const downloadPartImage = async (part) => {
      try {
        const result = await processRebrickableImage(
          part.part.part_img_url,
          part.part.part_num,
          part.color.id
        )
        
        // 이미지 메타데이터를 Supabase에 저장
        if (result.url) {
          await saveImageMetadata({
            original_url: part.part.part_img_url,
            supabase_url: result.url,
            file_path: result.path,
            file_name: result.filename,
            part_num: part.part.part_num,
            color_id: part.color.id,
            set_num: selectedSet.value?.set_num
          })
        }
        
        console.log('Image processed:', result)
        
        if (result.isDuplicate) {
          successMessage.value = `부품 ${part.part.part_num} 이미지가 이미 존재합니다. (파일명 중복으로 건너뛰기)`
        } else if (result.isLocal) {
          successMessage.value = `부품 ${part.part.part_num} 이미지가 로컬에 저장되었습니다. (서버 업로드 대기 중)`
        } else {
          successMessage.value = `부품 ${part.part.part_num} 이미지가 성공적으로 업로드되었습니다.`
        }
      } catch (err) {
        console.error('Failed to process image:', err)
        error.value = `이미지 처리 중 오류가 발생했습니다: ${err.message}`
      }
    }

    const downloadAllPartImages = async () => {
      if (setParts.value.length === 0) return
      
      const imageData = setParts.value.map(part => ({
        imageUrl: part.part.part_img_url,
        partNum: part.part.part_num,
        colorId: part.color.id
      }))
      
      try {
        const { results, errors } = await processMultipleImages(imageData)
        console.log('Processed images:', results)
        console.log('Errors:', errors)
        
        successMessage.value = `${results.length}개 이미지가 성공적으로 처리되었습니다. ${errors.length}개 오류가 발생했습니다.`
      } catch (err) {
        console.error('Failed to process images:', err)
      }
    }

    const saveSetToDatabase = async () => {
      if (!selectedSet.value) return
      
      saving.value = true
      const savedParts = []
      const failedParts = []
      
      try {
        // 1. 세트 정보 저장
        const savedSet = await saveLegoSet(selectedSet.value)
        console.log('Set saved:', savedSet)

        // 2. 부품 정보 저장 (각 부품별로 오류 처리)
        if (setParts.value.length > 0) {
          console.log(`Starting to save ${setParts.value.length} parts...`)
          
          for (let i = 0; i < setParts.value.length; i++) {
            const partData = setParts.value[i]
            try {
              console.log(`Saving part ${i + 1}/${setParts.value.length}: ${partData.part.part_num}`)
              
              // 부품 정보 저장
              const savedPart = await saveLegoPart(partData.part)
              console.log(`Part saved: ${savedPart.part_num}`)
              
              // 색상 정보 저장
              const savedColor = await saveLegoColor(partData.color)
              console.log(`Color saved: ${savedColor.name}`)
              
              // 세트-부품 관계 저장
              const savedSetPart = await saveSetPart(
                savedSet.id,
                savedPart.id,
                savedColor.id,
                partData.quantity,
                partData.is_spare || false,
                partData.element_id,
                partData.num_sets || 1
              )
              console.log(`Set-part relationship saved for ${partData.part.part_num}`)
              
              savedParts.push({
                part_num: partData.part.part_num,
                color: partData.color.name,
                quantity: partData.quantity
              })
              
            } catch (partErr) {
              console.error(`Failed to save part ${partData.part.part_num}:`, partErr)
              failedParts.push({
                part_num: partData.part.part_num,
                color: partData.color.name,
                error: partErr.message
              })
            }
          }
        }

        // 3. 작업 로그 저장
        await saveOperationLog({
          operation_type: 'set_import',
          target_type: 'set',
          target_id: savedSet.id,
          status: savedParts.length === setParts.value.length ? 'success' : 'partial_success',
          message: `세트 ${selectedSet.value.set_num} 저장 완료. 성공: ${savedParts.length}개, 실패: ${failedParts.length}개`,
          metadata: {
            set_num: selectedSet.value.set_num,
            total_parts: setParts.value.length,
            saved_parts: savedParts.length,
            failed_parts: failedParts.length,
            failed_details: failedParts
          }
        })

        // 4. 결과 메시지
        if (failedParts.length === 0) {
          successMessage.value = `세트 ${selectedSet.value.set_num} 및 ${savedParts.length}개 부품 정보가 성공적으로 저장되었습니다.`
        } else {
          successMessage.value = `세트 ${selectedSet.value.set_num} 저장 완료. 성공: ${savedParts.length}개, 실패: ${failedParts.length}개`
          error.value = `실패한 부품들: ${failedParts.map(p => `${p.part_num}(${p.color})`).join(', ')}`
        }
        
        console.log(`Save completed: ${savedParts.length} successful, ${failedParts.length} failed`)
        console.log('Failed parts details:', failedParts)
        
      } catch (err) {
        console.error('Failed to save set:', err)
        error.value = `저장 중 오류가 발생했습니다: ${err.message}`
      } finally {
        saving.value = false
      }
    }

    const exportPartsData = () => {
      if (setParts.value.length === 0) return
      
      const data = setParts.value.map(part => ({
        part_num: part.part.part_num,
        name: part.part.name,
        color: part.color.name,
        quantity: part.quantity,
        image_url: part.part.part_img_url
      }))
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedSet.value.set_num}_parts.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    const handleImageError = (event) => {
      event.target.src = '/placeholder-image.png'
    }

    return {
      searchQuery,
      searchResults,
      selectedSet,
      setParts,
      loading,
      loadingParts,
      downloadingImages,
      saving,
      error,
      successMessage,
      isLocalData,
      searchSets,
      selectSet,
      loadSetParts,
      downloadPartImage,
      downloadAllPartImages,
      saveSetToDatabase,
      exportPartsData,
      handleImageError
    }
  }
}
</script>

<style scoped>
.lego-set-manager {
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

.search-section {
  margin-bottom: 2rem;
}

.search-box {
  display: flex;
  gap: 1rem;
  max-width: 600px;
  margin: 0 auto;
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

.search-results h3 {
  margin-bottom: 1rem;
  color: #333;
}

.data-source-info {
  margin-bottom: 1rem;
}

.source-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-right: 0.5rem;
}

.source-badge.local {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.source-badge.api {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.sets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.set-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s;
  overflow: hidden;
}

.set-card:hover {
  transform: translateY(-5px);
}

.set-image {
  height: 200px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.set-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.set-info {
  padding: 1rem;
}

.set-info h4 {
  margin-bottom: 0.5rem;
  color: #333;
  font-size: 1.1rem;
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

.selected-set {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.set-main-info {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
}

.set-large-image {
  width: 200px;
  height: 200px;
  object-fit: contain;
  background: #f8f9fa;
  border-radius: 8px;
}

.set-details-text h2 {
  color: #333;
  margin-bottom: 1rem;
}

.set-details-text p {
  margin-bottom: 0.5rem;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.parts-section {
  margin-top: 2rem;
}

.parts-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.part-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e1e5e9;
}

.part-image {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  background: white;
  border-radius: 6px;
}

.part-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
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

.part-actions {
  margin-top: 0.5rem;
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

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-info {
  background: #17a2b8;
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

@media (max-width: 768px) {
  .set-main-info {
    flex-direction: column;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .parts-controls {
    flex-direction: column;
  }
}
</style>
