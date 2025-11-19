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
          placeholder="레고 세트 번호 또는 이름을 검색하세요... (여러 세트: 띄어쓰기 또는 콤마로 구분)"
          @keyup.enter="handleSearchOrBatch"
          class="search-input"
        />
        <button @click="handleSearchOrBatch" :disabled="loading || batchProcessing" class="search-btn">
          {{ loading ? '검색 중...' : batchProcessing ? '일괄 등록 중...' : '검색' }}
        </button>
        <button 
          v-if="hasMultipleSetNumbers(searchQuery)" 
          @click="batchRegisterSets" 
          :disabled="loading || batchProcessing" 
          class="batch-btn"
        >
          {{ batchProcessing ? `일괄 등록 중... (${batchRegisterProgress.current}/${batchRegisterProgress.total})` : '일괄 등록' }}
        </button>
      </div>
      
      <!-- LLM 분석 옵션 -->
      <div class="master-data-option">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="skipLLMAnalysis"
            :disabled="loading || processing"
          />
          <span class="checkmark"></span>
          ⚡ 빠른 저장 (LLM 분석 + CLIP 임베딩 건너뛰기)
        </label>
        <small class="form-help">
          체크하면 기본 데이터만 저장하고 LLM 분석 + CLIP 임베딩을 건너뜁니다. (기본값: 체크됨 = 빠른 저장 모드)
        </small>
      </div>
      
      <!-- 피규어 정보만 등록 버튼 -->
      <div class="minifig-only-option">
        <button 
          @click="registerMinifigsOnly" 
          :disabled="loading || batchProcessing || minifigOnlyProcessing" 
          class="minifig-only-btn"
        >
          {{ minifigOnlyProcessing ? `피규어 등록 중... (${minifigOnlyProgress.current}/${minifigOnlyProgress.total})` : '🧸 피규어 정보만 등록' }}
        </button>
        <small class="form-help">
          저장된 모든 세트의 피규어 정보를 일괄 등록합니다.
        </small>
      </div>
    </div>

    <!-- 검색 결과 (단일 제품 번호가 아닌 경우에만 표시) -->
    <div v-if="searchResults.length > 0 && !isSingleSetNumber(searchQuery)" class="search-results">
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
          :class="{ 'existing-set': set.isExisting }"
          @click="selectSet(set)"
        >
          <div class="set-image">
            <img 
              :src="set.set_img_url" 
              :alt="set.name"
              @error="handleImageError"
            />
            <div v-if="set.isExisting" class="duplicate-badge">
              <span class="duplicate-icon">⚠️</span>
              <span class="duplicate-text">이미 등록됨</span>
            </div>
          </div>
          <div class="set-info">
            <h4>{{ set.name }}</h4>
            <p class="set-number">{{ set.set_num }}</p>
            <p class="set-year">{{ set.year }}</p>
            <p class="set-pieces">{{ set.num_parts }}개 부품</p>
            <div v-if="set.isExisting" class="duplicate-info">
              <p class="duplicate-date">등록일: {{ new Date(set.existingData.created_at).toLocaleDateString() }}</p>
            </div>
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
              <button @click="saveSetBatch" :disabled="saving" class="btn btn-secondary">
                {{ saving ? '배치 저장 중...' : '⚡ 빠른 배치 저장' }}
              </button>
              <button @click="forceResaveSet" :disabled="saving" class="btn btn-warning">
                {{ saving ? '재저장 중...' : '강제 재저장 (기존 데이터 삭제 후 저장)' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 부품 목록 -->
      <div v-if="setParts.length > 0" class="parts-section">
        <h3 v-if="partsStats">
          부품 목록 {{ partsStats.totalTypes }}종, {{ partsStats.nonSpareQuantity }}개
          <span v-if="partsStats.spareCount > 0" class="spare-info">, 스페어부품 {{ partsStats.spareCount }}개</span>
          <span v-if="partsCountValidation" class="validation-info" :class="{ 'match': partsCountValidation.isMatch, 'mismatch': !partsCountValidation.isMatch }">
            {{ partsCountValidation.isMatch ? '✅ 부품 수량 일치' : '⚠️ 부품 수량 불일치' }}
          </span>
          - API에서 로드됨
        </h3>
        
        <!-- 등록 검증 정보 -->
        <div v-if="registrationVerification" class="registration-verification">
          <h4>등록 검증 결과</h4>
          <div class="verification-details">
            <div class="verification-item">
              <span class="label">API 부품 수:</span>
              <span class="value">{{ registrationVerification.apiPartsCount }}개</span>
            </div>
            <div class="verification-item" :class="{ 'match': registrationVerification.partsMatch, 'mismatch': !registrationVerification.partsMatch }">
              <span class="label">등록된 부품 수:</span>
              <span class="value">
                {{ registrationVerification.registeredPartsCount }}개
                <span v-if="!registrationVerification.partsMatch" class="warning">⚠️ 불일치</span>
                <span v-else class="success">✅ 일치</span>
              </span>
            </div>
            <div class="verification-item" :class="{ 'match': registrationVerification.imagesMatch, 'mismatch': !registrationVerification.imagesMatch }">
              <span class="label">이미지 개수:</span>
              <span class="value">
                {{ registrationVerification.uniqueImagesCount }}개
                <span v-if="!registrationVerification.imagesMatch" class="warning">⚠️ 불일치</span>
                <span v-else class="success">✅ 일치</span>
              </span>
            </div>
            <div class="verification-item">
              <span class="label">part_images:</span>
              <span class="value">{{ registrationVerification.partImagesCount }}개</span>
            </div>
            <div class="verification-item">
              <span class="label">image_metadata:</span>
              <span class="value">{{ registrationVerification.metadataImagesCount }}개</span>
            </div>
            <div class="verification-summary" :class="{ 'all-match': registrationVerification.allMatch, 'not-match': !registrationVerification.allMatch }">
              <strong v-if="registrationVerification.allMatch">✅ 모든 검증 통과</strong>
              <strong v-else>⚠️ 검증 불일치 발견</strong>
            </div>
          </div>
        </div>
        <h3 v-else>부품 목록 ({{ setParts.length }}개) - API에서 로드됨</h3>
        <div class="parts-controls">
          <button @click="downloadAllPartImages" :disabled="downloading" class="btn btn-success">
            {{ downloading ? '이미지 다운로드 중...' : '모든 부품 이미지 다운로드' }}
          </button>
          <button @click="exportPartsData" class="btn btn-info">
            부품 데이터 내보내기
          </button>
        </div>
        
        <!-- 일반 부품 섹션 -->
        <div v-if="categorizedParts && categorizedParts.regularParts.length > 0" class="parts-category">
          <h4 class="category-title regular-title">🧱 일반 부품 ({{ categorizedParts.regularParts.length }}종)</h4>
          <div class="parts-grid">
            <div 
              v-for="part in categorizedParts.regularParts" 
              :key="`${part.part.part_num}-${part.color_id}`"
              class="part-card"
            >
              <div class="part-image">
                <img 
                  :src="getPartImageUrl(part)" 
                  :alt="part.part.name"
                  @error="(event) => handleImageError(event, part)"
                />
              </div>
              <div class="part-info">
                <h4>{{ part.part.name }}</h4>
                <p><strong>부품 번호:</strong> {{ part.part.part_num }}</p>
                <p v-if="part.element_id" class="element-id-info">
                  <strong>Element ID:</strong> 
                  <span class="element-id-badge">{{ part.element_id }}</span>
                  <router-link :to="`/element-search?q=${part.element_id}`" class="element-search-link" title="Element ID로 검색">
                    🔍
                  </router-link>
                </p>
                <p><strong>색상:</strong> {{ part.color.name }}</p>
                <p><strong>수량:</strong> {{ part.quantity }}개</p>
                <div class="part-actions">
                  <button 
                    @click="downloadPartImage(part)" 
                    :disabled="downloading"
                    class="btn btn-sm btn-primary"
                  >
                    이미지 다운로드
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 미니피규어 섹션 -->
        <div v-if="setMinifigs && setMinifigs.length > 0" class="parts-category">
          <h4 class="category-title minifig-title">🧸 미니피규어 ({{ setMinifigs.length }}종)</h4>
          <div class="parts-grid">
            <div 
              v-for="minifig in setMinifigs" 
              :key="minifig.set_num"
              class="part-card minifig-card"
            >
              <div class="part-image">
                <img 
                  v-if="minifig.set_img_url"
                  :src="minifig.set_img_url" 
                  :alt="minifig.name"
                  @error="handleImageError"
                />
                <div 
                  v-if="!minifig.set_img_url" 
                  class="no-image"
                >
                  <div class="no-image-icon">🧸</div>
                  <div class="no-image-text">이미지 없음</div>
                </div>
                <div 
                  v-else
                  class="no-image" 
                  style="display: none;"
                >
                  <div class="no-image-icon">🧸</div>
                  <div class="no-image-text">이미지 로딩 실패</div>
                </div>
              </div>
              <div class="part-info">
                <h4>{{ minifig.name }}</h4>
                <p><strong>미니피규어 번호:</strong> {{ minifig.set_num }}</p>
                <p><strong>부품 수:</strong> {{ minifig.num_parts }}개</p>
                <div class="part-actions">
                  <a 
                    v-if="minifig.set_url" 
                    :href="minifig.set_url" 
                    target="_blank" 
                    class="btn btn-sm btn-info"
                  >
                    상세 보기
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 스페어 부품 섹션 -->
        <div v-if="categorizedParts && categorizedParts.spareParts.length > 0" class="parts-category">
          <h4 class="category-title spare-title">🔧 스페어 부품 ({{ categorizedParts.spareParts.length }}종)</h4>
          <div class="parts-grid">
            <div 
              v-for="part in categorizedParts.spareParts" 
              :key="`${part.part.part_num}-${part.color_id}`"
              class="part-card spare-card"
            >
              <div class="part-image">
                <img 
                  :src="getPartImageUrl(part)" 
                  :alt="part.part.name"
                  @error="(event) => handleImageError(event, part)"
                />
              </div>
              <div class="part-info">
                <h4>{{ part.part.name }}</h4>
                <p><strong>부품 번호:</strong> {{ part.part.part_num }}</p>
                <p v-if="part.element_id" class="element-id-info">
                  <strong>Element ID:</strong> 
                  <span class="element-id-badge">{{ part.element_id }}</span>
                  <router-link :to="`/element-search?q=${part.element_id}`" class="element-search-link" title="Element ID로 검색">
                    🔍
                  </router-link>
                </p>
                <p><strong>색상:</strong> {{ part.color.name }}</p>
                <p><strong>수량:</strong> {{ part.quantity }}개</p>
                <p class="spare-part"><strong>스페어 부품</strong></p>
                <div class="part-actions">
                  <button 
                    @click="downloadPartImage(part)" 
                    :disabled="downloading"
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
    </div>

    <!-- 에러 메시지 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 성공 메시지 -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- 중복 세트 처리 선택 모달 -->
    <div v-if="showDuplicateModal" class="duplicate-modal-overlay" @click.self="handleCloseDuplicateModal">
      <div class="duplicate-modal" @click.stop>
        <div class="duplicate-modal-header">
          <h3>⚠️ 중복된 세트 발견</h3>
          <button @click="handleCloseDuplicateModal" class="close-btn">&times;</button>
        </div>
        
        <div class="duplicate-modal-content">
          <div class="duplicate-info">
            <h4>기존 세트 정보</h4>
            <div class="info-item">
              <strong>세트명:</strong> {{ duplicateSetInfo.existingName }}
            </div>
            <div class="info-item">
              <strong>세트 번호:</strong> {{ duplicateSetInfo.existingSetNum }}
            </div>
            <div class="info-item">
              <strong>등록일:</strong> {{ duplicateSetInfo.existingDate }}
            </div>
            <div class="info-item">
              <strong>부품 수:</strong> {{ duplicateSetInfo.existingParts }}개
            </div>
          </div>
          
          <div class="duplicate-info">
            <h4>새로운 세트 정보</h4>
            <div class="info-item">
              <strong>세트명:</strong> {{ duplicateSetInfo.newName }}
            </div>
            <div class="info-item">
              <strong>세트 번호:</strong> {{ duplicateSetInfo.newSetNum }}
            </div>
            <div class="info-item">
              <strong>부품 수:</strong> {{ duplicateSetInfo.newParts }}개
            </div>
          </div>
          
          <div class="duplicate-options">
            <h4>처리 방법을 선택하세요:</h4>
            <button 
              @click="handleDuplicateOption('missing')" 
              class="option-btn missing-btn"
            >
              📦 누락 부품만 등록
            </button>
            <button 
              @click="handleDuplicateOption('replace')" 
              class="option-btn replace-btn"
            >
              🔄 전체 삭제 후 새로 등록
            </button>
            <button 
              @click="handleDuplicateOption('cancel')" 
              class="option-btn cancel-btn"
            >
              ❌ 취소
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 진행률 모달 -->
    <div v-if="showProgressModal" class="progress-modal-overlay" @click.self="handleCloseModal">
      <div class="progress-modal" @click.stop>
        <div class="progress-modal-header">
          <h3>🚀 레고 저장 진행 중</h3>
          <div class="modal-actions">
            <button 
              v-if="runningTasks.length > 0" 
              @click="handleStopAllTasks" 
              class="stop-btn"
              :disabled="isStopping"
            >
              {{ isStopping ? '중지 중...' : '⏹️ 중지' }}
            </button>
            <button @click="handleCloseModal" class="close-btn">&times;</button>
          </div>
        </div>
        
        <div class="progress-modal-content">
          <!-- 배치 처리 진행률 -->
          <div v-if="batchLoading" class="progress-section">
            <h4>⚡ 배치 처리 중...</h4>
            <div class="progress">
              <div class="progress-bar" :style="{ width: batchProgress + '%' }"></div>
              <span>{{ batchProgress }}%</span>
            </div>
            <small>{{ batchCurrentStep }}</small>
            <div v-if="batchError" class="processing-errors">
              <small>오류: {{ batchError }}</small>
            </div>
          </div>

          <!-- 일괄 등록 진행률 -->
          <div v-if="batchProcessing" class="progress-section">
            <h4>⚡ 일괄 등록 진행 중</h4>
            <div v-if="batchRegisterProgress.total > 0" class="lego-product-info">
              <div class="product-header">
                <h5 class="product-name">{{ batchRegisterProgress.currentSetName || '일괄 등록' }}</h5>
                <span class="product-number">{{ batchRegisterProgress.currentSet || '' }}</span>
              </div>
              <div class="product-stats">
                <span class="stat-item">
                  <strong>세트 진행:</strong> {{ batchRegisterProgress.current }}/{{ batchRegisterProgress.total }}
                </span>
                <span class="stat-item" v-if="batchRegisterProgress.currentSetParts > 0">
                  <strong>전체 부품:</strong> {{ batchRegisterProgress.currentSetParts }}개
                </span>
                <span class="stat-item" v-if="batchRegisterProgress.currentSetSavedParts > 0">
                  <strong>저장된 부품:</strong> {{ batchRegisterProgress.currentSetSavedParts }}/{{ batchRegisterProgress.currentSetParts }}개
                </span>
                <span class="stat-item">
                  <strong>전체 진행률:</strong> {{ Math.round((batchRegisterProgress.current / batchRegisterProgress.total) * 100) }}%
                </span>
                <span class="stat-item" v-if="batchRegisterProgress.currentSetParts > 0 && batchRegisterProgress.currentSetSavedParts > 0">
                  <strong>부품 진행률:</strong> {{ Math.round((batchRegisterProgress.currentSetSavedParts / batchRegisterProgress.currentSetParts) * 100) }}%
                </span>
              </div>
            </div>
            <div class="progress">
              <div class="progress-bar" :style="{ width: batchRegisterProgress.total > 0 ? Math.round((batchRegisterProgress.current / batchRegisterProgress.total) * 100) + '%' : '0%' }"></div>
              <span>{{ batchRegisterProgress.total > 0 ? Math.round((batchRegisterProgress.current / batchRegisterProgress.total) * 100) : 0 }}%</span>
            </div>
            <small v-if="batchRegisterProgress.currentSetName">
              {{ batchRegisterProgress.currentSetName }} ({{ batchRegisterProgress.currentSet }}) - 
              세트 {{ batchRegisterProgress.current }}/{{ batchRegisterProgress.total }} 처리 중
              <span v-if="batchRegisterProgress.currentSetParts > 0">
                - 부품 {{ batchRegisterProgress.currentSetSavedParts }}/{{ batchRegisterProgress.currentSetParts }}개 저장됨
              </span>
            </small>
            <small v-else>
              세트 {{ batchRegisterProgress.current }}/{{ batchRegisterProgress.total }} 처리 중...
            </small>
          </div>

          <!-- LLM 분석 진행률 -->
          <div v-if="!skipLLMAnalysis && masterDataProgress > 0" class="progress-section">
            <h4>🤖 AI 메타데이터 생성 중...</h4>
            <div class="progress">
              <div class="progress-bar" :style="{ width: masterDataProgress + '%' }"></div>
              <span>{{ masterDataProgress }}%</span>
            </div>
            <small>LLM 분석 및 CLIP 임베딩 생성 중... (고품질 메타데이터)</small>
          </div>

          <!-- 백그라운드 작업 상태 -->
          <div v-if="runningTasks.length > 0" class="progress-section">
            <h4>🔄 저장 작업 진행 중</h4>
            <div v-for="task in runningTasks" :key="task.id" class="task-item">
              <!-- 레고 제품 정보 -->
              <div v-if="task.setNum || task.setName" class="lego-product-info">
                <div class="product-header">
                  <h5 class="product-name">{{ task.setName || '레고 세트' }}</h5>
                  <span v-if="task.setNum" class="product-number">{{ task.setNum }}</span>
                </div>
                <div class="product-stats">
                  <span class="stat-item">
                    <strong>전체 부품:</strong> {{ task.totalParts || task.total }}개
                  </span>
                  <span class="stat-item">
                    <strong>저장된 부품:</strong> {{ task.savedParts || task.current }}개
                  </span>
                  <span class="stat-item">
                    <strong>진행률:</strong> {{ task.progress }}%
                  </span>
                </div>
              </div>
              
              <!-- 작업 정보 -->
              <div class="task-info">
                <span class="task-name">{{ task.name }}</span>
                <span class="task-progress">{{ task.current }}/{{ task.total }} ({{ task.progress }}%)</span>
              </div>
              
              <!-- 진행률 바 -->
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
              </div>
              
              <!-- 중지 버튼 -->
              <div class="task-actions">
                <button 
                  @click="handleStopTask(task.id)" 
                  class="task-stop-btn"
                  :disabled="task.status === 'cancelled' || task.status === 'completed'"
                >
                  {{ task.status === 'cancelled' ? '중지됨' : '⏹️ 중지' }}
                </button>
              </div>
              
              <!-- 상태 표시 -->
              <div v-if="task.status === 'cancelled'" class="task-status cancelled">
                작업이 중지되었습니다.
              </div>
              <div v-if="task.error" class="task-status error">
                오류: {{ task.error.message || task.error }}
              </div>
            </div>
          </div>

          <!-- 백그라운드 LLM 분석 상태 -->
          <div v-if="llmRunningTasks.length > 0" class="progress-section">
            <h4>🤖 LLM 분석 진행 중</h4>
            <div class="queue-status">
              <span>대기: {{ queueStatus.pending }} | 실행: {{ queueStatus.running }} | 완료: {{ queueStatus.completed }} | 실패: {{ queueStatus.failed }}</span>
            </div>
            <div v-for="task in llmRunningTasks" :key="task.id" class="llm-task-item">
              <div class="task-info">
                <span class="task-name">{{ task.setName }} ({{ task.setNum }})</span>
                <span class="task-progress">{{ task.processedParts }}/{{ task.totalParts }} ({{ task.progress }}%)</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
              </div>
              <div v-if="task.errors.length > 0" class="task-errors">
                <small v-for="error in task.errors" :key="error">{{ error }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import { useRebrickable } from '../composables/useRebrickable'
import { useImageManager } from '../composables/useImageManager'
import { useDatabase } from '../composables/useDatabase'
import { useBackgroundTasks } from '../composables/useBackgroundTasks'
import { supabase } from '../composables/useSupabase'
import { 
  analyzePartWithLLM, 
  generateTextEmbeddingsBatch, 
  saveToMasterPartsDB,
  checkExistingAnalysis 
} from '../composables/useMasterPartsPreprocessing'
import { useBackgroundLLMAnalysis } from '../composables/useBackgroundLLMAnalysis'
import { useBatchProcessing } from '../composables/useBatchProcessing'
import { useAutoImageMigration } from '../composables/useAutoImageMigration'
import { waitForMigrationComplete } from '../composables/useMigrationStatus'
import { useSlackAlert } from '../composables/useSlackAlert'

export default {
  name: 'LegoSetManager',
  setup() {
    const { 
      loading, 
      error, 
      searchSets: searchSetsAPI, 
      getSet, 
      getSetParts: getSetPartsAPI,
      getSetMinifigs,
      getElement
    } = useRebrickable()
    
    const { 
      downloading, 
      processRebrickableImage, 
      processMultipleImages,
      saveImageMetadata,
      uploadImageFromUrl,
      checkPartImageDuplicate,
      checkPartImageDuplicateByElementId,
      upsertPartImage
    } = useImageManager()

    const {
      saveLegoSet,
      saveLegoPart,
      saveLegoColor,
      saveSetPart,
      savePartImage,
      saveOperationLog,
      getLegoSets,
      getSetParts,
      checkSetExists,
      checkMultipleSetsExist,
      deleteSetAndParts
    } = useDatabase()

    const {
      startBackgroundTask,
      updateTaskProgress,
      completeTask,
      failTask,
      cancelTask,
      getRunningTasks
    } = useBackgroundTasks()

    const {
      startBackgroundAnalysis,
      getRunningTasks: getLLMRunningTasks,
      getTaskStatus,
      getQueueStatus,
      isProcessing: isLLMProcessing
    } = useBackgroundLLMAnalysis()

    const {
      batchProcessSet,
      loading: batchLoading,
      progress: batchProgress,
      currentStep: batchCurrentStep,
      error: batchError
    } = useBatchProcessing()

    const {
      alertMigrationFailed,
      alertBatchProcessingFailed
    } = useSlackAlert()

    const searchQuery = ref('')
    const searchResults = ref([])
    const selectedSet = ref(null)
    const setParts = ref([])
    const loadingParts = ref(false)
    const saving = ref(false)
    const successMessage = ref('')
    const isLocalData = ref(false)
    const existingSets = ref(new Set()) // 이미 등록된 세트 번호들을 저장
    const partsCountValidation = ref(null) // 부품 수량 검증 정보
    const partsStats = ref(null) // 부품 통계 정보
    const categorizedParts = ref(null) // 부품 분류 정보
    const setMinifigs = ref([]) // 세트의 미니피규어 정보
    const registrationVerification = ref(null) // 등록 검증 정보 (부품 수, 등록된 부품 정보, 이미지 개수)
    const skipLLMAnalysis = ref(true) // LLM 분석 건너뛰기 옵션 (기본값: true = 빠른 저장 모드)
    const masterDataProgress = ref(0) // LLM 분석 진행률
    const processing = ref(false) // 전체 처리 상태
    const showProgressModal = ref(false) // 진행률 모달 표시 여부
    const showDuplicateModal = ref(false) // 중복 세트 처리 모달 표시 여부
    const duplicateSetInfo = ref({
      existingName: '',
      existingSetNum: '',
      existingDate: '',
      existingParts: 0,
      newName: '',
      newSetNum: '',
      newParts: 0,
      existingSet: null,
      resolve: null // Promise resolve 함수
    })
    const batchProcessing = ref(false) // 일괄 등록 진행 중 여부
    const batchRegisterProgress = ref({ 
      current: 0, 
      total: 0, 
      currentSet: '', 
      currentSetName: '', 
      currentSetParts: 0, 
      currentSetSavedParts: 0 
    }) // 일괄 등록 진행률
    const minifigOnlyProcessing = ref(false) // 피규어 정보만 등록 진행 중 여부
    const minifigOnlyProgress = ref({ current: 0, total: 0, currentSet: '' }) // 피규어 정보만 등록 진행률

    // 여러 세트 번호가 있는지 확인하는 함수
    const hasMultipleSetNumbers = (query) => {
      if (!query || !query.trim()) return false
      const trimmed = query.trim()
      // 띄어쓰기 또는 콤마로 구분된 세트 번호 패턴 확인
      const parts = trimmed.split(/[\s,]+/).filter(p => p.trim())
      if (parts.length < 2) return false
      // 각 부분이 세트 번호 패턴인지 확인
      const setNumberPattern = /^\d{3,6}(-\d+)?$/
      return parts.every(part => setNumberPattern.test(part.trim()))
    }

    // 세트 번호 목록 파싱
    const parseSetNumbers = (query) => {
      if (!query || !query.trim()) return []
      const trimmed = query.trim()
      const parts = trimmed.split(/[\s,]+/).filter(p => p.trim())
      return parts.map(p => p.trim())
    }

    // 단일 제품 번호인지 확인하는 함수
    const isSingleSetNumber = (query) => {
      const trimmedQuery = query.trim()
      // 레고 세트 번호 패턴: 숫자로만 구성되고 3-6자리, 선택적으로 하이픈과 버전 번호 포함
      // 예: "60315", "60315-1", "10497-1"
      const setNumberPattern = /^\d{3,6}(-\d+)?$/
      return setNumberPattern.test(trimmedQuery)
    }

    // 세트 번호를 Rebrickable API 형식으로 변환
    const formatSetNumber = (setNum) => {
      // 이미 -1이 포함되어 있으면 그대로 반환
      if (setNum.includes('-')) {
        return setNum
      }
      // -1 접미사 추가
      return `${setNum}-1`
    }

    // 부품 수량 합계 계산 (스페어 부품 제외)
    const calculatePartsTotal = (parts) => {
      if (!parts || parts.length === 0) return 0
      
      return parts.reduce((total, part) => {
        // 스페어 부품이 아닌 경우에만 수량 추가
        if (!part.is_spare) {
          return total + (part.quantity || 0)
        }
        return total
      }, 0)
    }

    // 부품 수량 검증
    const validatePartsCount = (setInfo, parts) => {
      const expectedCount = setInfo.num_parts || 0
      const actualCount = calculatePartsTotal(parts)
      const spareCount = parts ? parts.filter(part => part.is_spare).length : 0
      
      return {
        expected: expectedCount,
        actual: actualCount,
        spare: spareCount,
        isMatch: expectedCount === actualCount,
        difference: expectedCount - actualCount
      }
    }

    // 등록 검증: 부품 수, 등록된 부품 정보 개수, 이미지 개수 확인
    const verifyRegistration = async (setNum) => {
      try {
        // 1. API에서 가져온 부품 수
        const apiPartsCount = setParts.value.length
        const apiPartsTotalQuantity = calculatePartsTotal(setParts.value)

        // 2. DB에 등록된 부품 정보 개수 (set_parts 테이블)
        const { data: registeredParts, error: registeredPartsError } = await supabase
          .from('set_parts')
          .select('id', { count: 'exact' })
          .eq('set_id', (await supabase.from('lego_sets').select('id').eq('set_num', setNum).maybeSingle()).data?.id)

        let registeredPartsCount = 0
        if (!registeredPartsError && registeredParts) {
          const { count } = await supabase
            .from('set_parts')
            .select('*', { count: 'exact', head: true })
            .eq('set_id', (await supabase.from('lego_sets').select('id').eq('set_num', setNum).maybeSingle()).data?.id)
          registeredPartsCount = count || 0
        }

        // 더 정확한 방법: set_num으로 직접 조회
        const { data: setData } = await supabase
          .from('lego_sets')
          .select('id')
          .eq('set_num', setNum)
          .maybeSingle()

        if (setData?.id) {
          const { count: registeredCount } = await supabase
            .from('set_parts')
            .select('*', { count: 'exact', head: true })
            .eq('set_id', setData.id)
          
          registeredPartsCount = registeredCount || 0
        }

        // 3. 이미지 개수 (part_images + image_metadata)
        const { count: partImagesCount } = await supabase
          .from('part_images')
          .select('*', { count: 'exact', head: true })
          .in('part_id', setParts.value.map(p => p.part.part_num))
          .not('uploaded_url', 'is', null)

        const { count: metadataImagesCount } = await supabase
          .from('image_metadata')
          .select('*', { count: 'exact', head: true })
          .eq('set_num', setNum)
          .not('supabase_url', 'is', null)

        // 중복 제거를 위해 실제 이미지가 있는 부품 수 계산
        const partsWithImages = new Set()
        
        // part_images에서 이미지가 있는 부품 수집
        if (partImagesCount > 0) {
          const { data: partImages } = await supabase
            .from('part_images')
            .select('part_id, color_id, element_id')
            .in('part_id', setParts.value.map(p => p.part.part_num))
            .not('uploaded_url', 'is', null)
          
          if (partImages) {
            partImages.forEach(img => {
              const key = img.element_id ? `element_${img.element_id}` : `${img.part_id}_${img.color_id}`
              partsWithImages.add(key)
            })
          }
        }

        // image_metadata에서 이미지가 있는 부품 수집
        if (metadataImagesCount > 0) {
          const { data: metadataImages } = await supabase
            .from('image_metadata')
            .select('part_num, color_id, element_id')
            .eq('set_num', setNum)
            .not('supabase_url', 'is', null)
          
          if (metadataImages) {
            metadataImages.forEach(img => {
              const key = img.element_id ? `element_${img.element_id}` : `${img.part_num}_${img.color_id}`
              partsWithImages.add(key)
            })
          }
        }

        const uniqueImagesCount = partsWithImages.size

        return {
          apiPartsCount,
          apiPartsTotalQuantity,
          registeredPartsCount,
          partImagesCount: partImagesCount || 0,
          metadataImagesCount: metadataImagesCount || 0,
          uniqueImagesCount,
          partsMatch: apiPartsCount === registeredPartsCount,
          imagesMatch: apiPartsCount === uniqueImagesCount,
          allMatch: apiPartsCount === registeredPartsCount && apiPartsCount === uniqueImagesCount
        }
      } catch (error) {
        console.error('등록 검증 실패:', error)
        return null
      }
    }

    // 부품 통계 계산
    const calculatePartsStats = (parts) => {
      if (!parts || parts.length === 0) {
        return {
          totalTypes: 0,
          totalQuantity: 0,
          spareCount: 0,
          nonSpareQuantity: 0
        }
      }

      const totalTypes = parts.length
      const totalQuantity = parts.reduce((sum, part) => sum + (part.quantity || 0), 0)
      const spareCount = parts.filter(part => part.is_spare).length
      const nonSpareQuantity = parts.reduce((sum, part) => {
        // 스페어 부품이 아닌 경우에만 수량 추가
        if (!part.is_spare) {
          return sum + (part.quantity || 0)
        }
        return sum
      }, 0)

      return {
        totalTypes,
        totalQuantity,
        spareCount,
        nonSpareQuantity
      }
    }

    // 미니피규어와 스페어 부품 구분 (API 기반)
    const categorizeParts = (parts, minifigs) => {
      if (!parts || parts.length === 0) {
        return {
          minifigures: [],
          spareParts: [],
          regularParts: []
        }
      }

      // API에서 가져온 미니피규어 정보 사용
      const minifigures = minifigs || []
      const spareParts = parts.filter(part => part.is_spare)
      const regularParts = parts.filter(part => !part.is_spare)

      return {
        minifigures,
        spareParts,
        regularParts
      }
    }

    // 검색 또는 일괄 등록 처리
    const handleSearchOrBatch = async () => {
      if (!searchQuery.value.trim()) return
      
      // 여러 세트 번호가 있으면 일괄 등록
      if (hasMultipleSetNumbers(searchQuery.value)) {
        await batchRegisterSets()
        return
      }
      
      // 단일 검색
      await searchSets()
    }

    const searchSets = async () => {
      if (!searchQuery.value.trim()) return
      
      try {
        const query = searchQuery.value.trim()
        
        // 단일 제품 번호인지 확인
        if (isSingleSetNumber(query)) {
          console.log('Single set number detected, fetching directly...')
          
          try {
            // 세트 번호를 Rebrickable API 형식으로 변환
            const formattedSetNum = formatSetNumber(query)
            console.log(`Formatted set number: ${query} -> ${formattedSetNum}`)
            
            // 중복 확인 (원본 번호로 확인)
            const existingSet = await checkSetExists(query)
            
            // 바로 세트 정보 가져오기 (변환된 번호로)
            const setData = await getSet(formattedSetNum)
            
            // 중복 정보 추가
            const setWithDuplicateInfo = {
              ...setData,
              isExisting: !!existingSet,
              existingData: existingSet
            }
            
            // 중복된 세트인지 확인
            if (setWithDuplicateInfo.isExisting) {
              const confirmMessage = `"${setData.name}" (${setData.set_num}) 세트는 이미 데이터베이스에 등록되어 있습니다.\n등록일: ${new Date(existingSet.created_at).toLocaleDateString()}\n\n계속 진행하시겠습니까?`
              if (!confirm(confirmMessage)) {
                return
              }
            }
            
            // 바로 세트 선택 처리
            selectedSet.value = setData
            setParts.value = []
            searchResults.value = [] // 검색 결과 목록은 비우기
            isLocalData.value = false
            
            // 자동으로 부품 목록 로드
            console.log('Auto-loading parts for direct set selection...')
            await loadSetParts()
            
            console.log('Direct set selection completed')
            return
          } catch (setError) {
            console.error('Failed to fetch set:', setError)
            if (setError.message.includes('404')) {
              error.value = `세트 번호 "${query}"에 해당하는 레고 세트를 찾을 수 없습니다. 올바른 세트 번호인지 확인해주세요.`
            } else {
              error.value = `세트 정보를 가져오는 중 오류가 발생했습니다: ${setError.message}`
            }
            return
          }
        }
        
        // 일반 검색 (여러 결과)
        console.log('Searching Rebrickable API...')
        const result = await searchSetsAPI(searchQuery.value)
        const apiResults = result.results || []
        
        // 검색 결과가 없는 경우
        if (apiResults.length === 0) {
          searchResults.value = []
          error.value = `"${query}"에 대한 검색 결과가 없습니다. 다른 키워드로 검색해보세요.`
          return
        }
        
        // 검색 결과에서 중복 확인
        console.log('Checking for existing sets in database...')
        const setNums = apiResults.map(set => set.set_num)
        const existingSetsData = await checkMultipleSetsExist(setNums)
        
        // 이미 등록된 세트 번호들을 Set에 저장
        existingSets.value = new Set(existingSetsData.map(set => set.set_num))
        console.log('Existing sets found:', Array.from(existingSets.value))
        
        // 검색 결과에 중복 정보 추가
        searchResults.value = apiResults.map(set => ({
          ...set,
          isExisting: existingSets.value.has(set.set_num),
          existingData: existingSetsData.find(existing => existing.set_num === set.set_num)
        }))
        
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
        // 중복된 세트인지 확인
        if (set.isExisting) {
          const confirmMessage = `"${set.name}" (${set.set_num}) 세트는 이미 데이터베이스에 등록되어 있습니다.\n등록일: ${new Date(set.existingData.created_at).toLocaleDateString()}\n\n계속 진행하시겠습니까?`
          if (!confirm(confirmMessage)) {
            return
          }
        }
        
        // 임시로 API에서만 가져오기 (데이터베이스 스키마 생성 후 로컬 검색 활성화)
        console.log('Fetching from Rebrickable API...')
        const result = await getSet(set.set_num)
        selectedSet.value = result
        setParts.value = []
        
        // 자동으로 부품 목록 로드
        console.log('Auto-loading parts for set selection...')
        await loadSetParts()
        
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
          .maybeSingle()

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

    // 부품 이미지 URL 가져오기 (템플릿 표시용)
    // 실제 저장 시에는 element_id 기반으로 처리되므로, 표시용으로는 part_img_url 사용
    const getPartImageUrl = (part) => {
      return part.part?.part_img_url || ''
    }

    const loadSetParts = async () => {
      if (!selectedSet.value) return
      
      loadingParts.value = true
      try {
        console.log(`Loading all parts for set ${selectedSet.value.set_num}...`)
        
        // ✅ 부품과 미니피규어 정보를 병렬로 로드 (성능 개선)
        const [partsResult, minifigsResult] = await Promise.allSettled([
          getSetPartsAPI(selectedSet.value.set_num),
          getSetMinifigs(selectedSet.value.set_num)
        ])
        
        // 부품 정보 처리
        if (partsResult.status === 'fulfilled') {
          const parts = partsResult.value.results || []
          
          // element_id가 있는 부품에 대해 element_img_url 가져오기 (선택적, 성능 고려)
          // 템플릿에서 필요할 때만 로드하도록 getPartImageUrl 함수 사용
          setParts.value = parts
          console.log(`✅ Loaded ${setParts.value.length} parts`)
        } else {
          console.error('❌ Failed to load parts:', partsResult.reason)
          setParts.value = []
        }
        
        // 미니피규어 정보 처리
        if (minifigsResult.status === 'fulfilled') {
          setMinifigs.value = minifigsResult.value.results || []
          console.log(`✅ Loaded ${setMinifigs.value.length} minifigs`)
        } else {
          console.log('ℹ️ No minifigs found for this set:', minifigsResult.reason?.message)
          setMinifigs.value = []
        }
        
        // 부품 수량 검증
        partsCountValidation.value = validatePartsCount(selectedSet.value, setParts.value)
        console.log('Parts count validation:', partsCountValidation.value)
        
        // 부품 통계 계산
        partsStats.value = calculatePartsStats(setParts.value)
        console.log('Parts stats:', partsStats.value)
        
        // 부품 분류 (미니피규어 정보 포함)
        categorizedParts.value = categorizeParts(setParts.value, setMinifigs.value)
        console.log('Categorized parts:', categorizedParts.value)
      } catch (err) {
        console.error('Failed to load parts:', err)
        error.value = `부품 로딩 중 오류가 발생했습니다: ${err.message}`
      } finally {
        loadingParts.value = false
      }
    }

    const downloadPartImage = async (part) => {
      try {
        console.log(`🖼️ Downloading image for part ${part.part.part_num}...`)
        
        // element_id 우선 사용 (가장 정확한 색상 매칭)
        let imageUrl = null
        let imageSource = 'unknown'
        
        // element_id가 있으면 Rebrickable API에서 색상 정보 포함하여 조회
        let effectiveColorId = part.color.id
        let elementData = null
        
        if (part.element_id) {
          try {
            const { getElement } = useRebrickable()
            elementData = await getElement(part.element_id)
            
            // Element ID는 색상 정보를 포함하므로, API에서 가져온 색상 정보를 사용
            if (elementData?.color?.id) {
              effectiveColorId = elementData.color.id
              console.log(`✅ element_id ${part.element_id}의 실제 색상: ${elementData.color.name} (ID: ${effectiveColorId})`)
            }
            
            if (elementData?.element_img_url) {
              imageUrl = elementData.element_img_url
              imageSource = 'element_id'
              console.log(`✅ element_id ${part.element_id} 기반 이미지 URL 획득`)
            } else if (elementData?.part_img_url) {
              imageUrl = elementData.part_img_url
              imageSource = 'element_id_part_img'
              console.log(`⚠️ element_id 이미지 없음, part_img_url 사용`)
            }
          } catch (elementErr) {
            console.warn(`⚠️ element_id ${part.element_id} 이미지 조회 실패:`, elementErr)
          }
        }
        
        // element_id 실패 시 part_img_url 사용 (fallback)
        if (!imageUrl) {
          imageUrl = part.part.part_img_url
          imageSource = 'part_num'
          console.warn(`⚠️ part_num 기반 이미지 사용 (색상 정보 없을 수 있음)`)
        }
        
        // element_id 검증 및 정규화
        const validElementId = (part.element_id && 
          part.element_id !== 'null' && 
          part.element_id !== 'undefined' && 
          String(part.element_id).trim() !== '' &&
          part.element_id !== 0) 
          ? String(part.element_id).trim() 
          : null
        
        console.log(`[NewLego] downloadPartImage: part_num=${part.part.part_num}, color_id=${effectiveColorId} (element_id 색상 사용), element_id=${validElementId || '없음'}`)
        
        const result = await processRebrickableImage(
          imageUrl,
          part.part.part_num,
          effectiveColorId,
          { elementId: validElementId, imageSource }
        )
        
        console.log(`🖼️ Image processing result:`, result)
        
        // 이미지 메타데이터를 Supabase에 저장 (API에서 가져온 색상 정보 사용)
        if (result.uploadedUrl) {
          console.log(`💾 Saving image metadata for ${part.part.part_num}...`)
          await saveImageMetadata({
            original_url: imageUrl,
            supabase_url: result.uploadedUrl,
            file_path: result.path,
            file_name: result.filename,
            part_num: part.part.part_num,
            color_id: effectiveColorId,
            element_id: part.element_id || null,
            set_num: selectedSet.value?.set_num
          })
          console.log(`✅ Image metadata saved for ${part.part.part_num}`)
        } else {
          console.log(`❌ No uploaded URL for ${part.part.part_num}, skipping metadata save`)
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
      
      // downloading 상태는 useImageManager에서 자동 관리됨
      successMessage.value = ''
      error.value = ''
      
      try {
        console.log(`🖼️ Starting bulk image download for ${setParts.value.length} parts...`)
        
        // ✅ 배치 병렬 처리 (10개씩)
        const BATCH_SIZE = 10
        const batches = []
        for (let i = 0; i < setParts.value.length; i += BATCH_SIZE) {
          batches.push(setParts.value.slice(i, i + BATCH_SIZE))
        }
        
        const results = []
        const errors = []
        let processedCount = 0
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex]
          console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} images)...`)
          
          // 배치 내 이미지를 병렬로 처리
          const batchResults = await Promise.allSettled(
            batch.map(async (part) => {
              try {
                // element_id 우선 사용 (가장 정확한 색상 매칭)
                let imageUrl = null
                let imageSource = 'unknown'
                
                // element_id가 있으면 Rebrickable API에서 색상 정보 포함하여 조회
                let effectiveColorId = part.color.id
                let elementData = null
                
                if (part.element_id) {
                  try {
                    const { getElement } = useRebrickable()
                    elementData = await getElement(part.element_id)
                    
                    // Element ID는 색상 정보를 포함하므로, API에서 가져온 색상 정보를 사용
                    if (elementData?.color?.id) {
                      effectiveColorId = elementData.color.id
                      console.log(`✅ element_id ${part.element_id}의 실제 색상: ${elementData.color.name} (ID: ${effectiveColorId})`)
                    }
                    
                    if (elementData?.element_img_url) {
                      imageUrl = elementData.element_img_url
                      imageSource = 'element_id'
                    } else if (elementData?.part_img_url) {
                      imageUrl = elementData.part_img_url
                      imageSource = 'element_id_part_img'
                    }
                  } catch (elementErr) {
                    console.warn(`⚠️ element_id ${part.element_id} 이미지 조회 실패:`, elementErr)
                  }
                }
                
                // element_id 실패 시 part_img_url 사용 (fallback)
                if (!imageUrl) {
                  imageUrl = part.part.part_img_url
                  imageSource = 'part_num'
                }
                
                // element_id 검증 및 정규화
                const validElementId = (part.element_id && 
                  part.element_id !== 'null' && 
                  part.element_id !== 'undefined' && 
                  String(part.element_id).trim() !== '' &&
                  part.element_id !== 0) 
                  ? String(part.element_id).trim() 
                  : null
                
                console.log(`[NewLego] downloadAllPartImages: part_num=${part.part.part_num}, color_id=${effectiveColorId} (element_id 색상 사용), element_id=${validElementId || '없음'}`)
                
                const result = await processRebrickableImage(
                  imageUrl,
                  part.part.part_num,
                  effectiveColorId,
                  { elementId: validElementId, imageSource }
                )
                
                // 이미지 메타데이터를 Supabase에 저장 (API에서 가져온 색상 정보 사용)
                if (result.uploadedUrl) {
                  await saveImageMetadata({
                    original_url: imageUrl,
                    supabase_url: result.uploadedUrl,
                    file_path: result.path,
                    file_name: result.filename,
                    part_num: part.part.part_num,
                    color_id: effectiveColorId,
                    element_id: part.element_id || null,
                    set_num: selectedSet.value?.set_num
                  })
                }
                
                return {
                  partNum: part.part.part_num,
                  result: result
                }
              } catch (err) {
                throw {
                  partNum: part.part.part_num,
                  error: err.message
                }
              }
            })
          )
          
          // 배치 결과 처리
          batchResults.forEach((promiseResult, index) => {
            processedCount++
            console.log(`🖼️ Processing image ${processedCount}/${setParts.value.length}`)
            
            if (promiseResult.status === 'fulfilled') {
              results.push(promiseResult.value)
            } else {
              errors.push(promiseResult.reason)
            }
          })
          
          // 진행률 업데이트 (UI에 표시 가능)
          const progress = Math.round((processedCount / setParts.value.length) * 100)
          console.log(`📊 Progress: ${progress}%`)
        }
        
        console.log(`🖼️ Bulk image processing completed: ${results.length} successful, ${errors.length} failed`)
        
        successMessage.value = `${results.length}개 이미지가 성공적으로 처리되었습니다. ${errors.length}개 오류가 발생했습니다.`
        
        if (errors.length > 0) {
          error.value = `실패한 부품들: ${errors.map(e => e.partNum).join(', ')}`
        }
        
      } catch (err) {
        console.error('Failed to process images:', err)
        error.value = `이미지 처리 중 오류가 발생했습니다: ${err.message}`
      } finally {
        // downloading 상태는 useImageManager에서 자동 관리됨
      }
    }

    // 강제 재저장 (기존 데이터 삭제 후 저장)
    const forceResaveSet = async () => {
      if (!selectedSet.value) return
      
      // 중복 세트 확인
      const existingSet = await checkSetExists(selectedSet.value.set_num)
      if (!existingSet) {
        successMessage.value = '기존 세트가 없습니다. 일반 저장을 사용하세요.'
        return
      }
      
      // 중복 세트 처리 모달 표시 (강제 재저장은 항상 replace 모드)
      const userChoice = await showDuplicateSetModal(existingSet, selectedSet.value)
      
      if (userChoice === 'cancel') {
        console.log('User cancelled force resave')
        return
      }
      
      let shouldRegenerateLLM = false
      if (userChoice === 'replace') {
        // LLM 분석 재생성 여부는 기본값으로 false (기존 데이터 유지)
        // 필요시 나중에 별도 옵션으로 추가 가능
        shouldRegenerateLLM = false
      } else {
        // missing 모드는 강제 재저장에서 사용하지 않음
        successMessage.value = '강제 재저장은 전체 삭제 후 새로 등록만 가능합니다.'
        return
      }
      
      try {
        saving.value = true
        successMessage.value = '기존 세트 데이터를 삭제하는 중...'
        
        // 기존 세트 삭제 (LLM 분석 데이터 삭제 옵션 포함)
        console.log('Deleting existing set and all related data...')
        const deleteSuccess = await deleteSetAndParts(existingSet.id, existingSet.set_num, shouldRegenerateLLM)
        if (!deleteSuccess) {
          throw new Error('기존 세트 삭제에 실패했습니다.')
        }
        
        // LLM 분석 재생성 플래그 설정
        if (shouldRegenerateLLM) {
          console.log('🔄 LLM 분석 재생성 모드 활성화')
          skipLLMAnalysis.value = false // LLM 분석 실행
        } else {
          console.log('⏭️ 기존 LLM 분석 데이터 유지')
          skipLLMAnalysis.value = true // LLM 분석 건너뛰기
        }
        
        successMessage.value = '기존 데이터 삭제 완료. 새 데이터를 저장하는 중...'
        
        // 예비부품 필터링 및 피규어 추가
        const nonSpareParts = setParts.value.filter(part => !part.is_spare)
        
        // 피규어를 부품 형태로 변환
        const minifigParts = (setMinifigs.value || []).map(minifig => ({
          part: {
            part_num: minifig.set_num,
            name: minifig.name || `Minifig ${minifig.set_num}`,
            part_cat_id: null,
            part_img_url: minifig.set_img_url || minifig.part_img_url || null
          },
          color: {
            id: 0,
            color_id: 0,
            name: 'Not Applicable',
            rgb: null,
            is_trans: false
          },
          quantity: minifig.quantity || 1,
          is_spare: false,
          element_id: null
        }))
        
        const partsToSave = [...nonSpareParts, ...minifigParts]
        console.log(`🔍 강제 재저장: 일반 부품 ${nonSpareParts.length}개 (예비부품 제외) + 피규어 ${minifigParts.length}개 = 총 ${partsToSave.length}개`)
        
        // 배치 처리 실행
        const result = await batchProcessSet(selectedSet.value, partsToSave, {
          forceUpload: false
        })

        console.log(`Force resave completed:`, result)

        // result 구조에 맞게 변수 추출
        const savedParts = result.insertedRelationships || result.totalParts || 0
        const processedImages = 0 // batchProcessSet은 이미지 처리를 하지 않음
        const failedParts = 0
        const failedImages = 0

        // 백그라운드 LLM 분석 시작 (이미지 마이그레이션 완료 후)
        if (!skipLLMAnalysis.value && savedParts > 0) {
          console.log(`🖼️ 이미지 마이그레이션 완료 후 AI 분석 시작...`)
          
          // 이미지 마이그레이션 완료 대기 (폴링 방식)
          const { triggerFullMigration } = useAutoImageMigration()
          try {
            console.log(`🔄 전체 이미지 마이그레이션 시작...`)
            const migrationResult = await triggerFullMigration()
            console.log(`✅ 이미지 마이그레이션 트리거 완료:`, migrationResult)
            
            // 폴링 방식으로 마이그레이션 완료 대기 (최대 2분)
            const migrationComplete = await waitForMigrationComplete(
              selectedSet.value.set_num,
              120000, // 최대 2분
              2000    // 2초마다 확인
            )
            
            if (migrationComplete) {
              console.log(`🤖 이미지 마이그레이션 완료, LLM 분석 시작 (${savedParts}개 부품)`)
            } else {
              console.log(`⚠️ 마이그레이션 타임아웃, 원본 이미지로 LLM 분석 시작`)
              
              // Slack 알림: 마이그레이션 타임아웃
              const status = { uploaded: processedImages || 0, total: result.totalParts || 0 }
              await alertMigrationFailed(selectedSet.value.set_num, status, '마이그레이션 타임아웃 (120초 초과)')
            }
            
            const taskId = await startBackgroundAnalysis(selectedSet.value, setParts.value)
            console.log(`📋 Background task started: ${taskId}`)
            successMessage.value = migrationComplete
              ? `🎉 세트 강제 재저장 완료!\n\n🤖 자동 처리 시작:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성 (768차원)\n• 데이터베이스 저장\n\n⏱️ 예상 소요 시간: ${setParts.value.length * 2}초\n📋 작업 ID: ${taskId}`
              : `🎉 세트 강제 재저장 완료!\n\n🤖 자동 처리 시작:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성 (768차원)\n• 데이터베이스 저장\n\n⏱️ 예상 소요 시간: ${setParts.value.length * 2}초\n📋 작업 ID: ${taskId}`
          } catch (migrationError) {
            console.warn(`⚠️ 이미지 마이그레이션 실패: ${migrationError.message}`)
            
            // Slack 알림: 마이그레이션 실패
            await alertMigrationFailed(
              selectedSet.value.set_num,
              { uploaded: 0, total: savedParts || 0 },
              migrationError.message
            )
            
            // 마이그레이션 실패해도 AI 분석은 계속 진행 (원본 이미지로)
            console.log(`🤖 원본 이미지로 백그라운드 LLM 분석 시작...`)
            const taskId = await startBackgroundAnalysis(selectedSet.value, setParts.value)
            console.log(`📋 Background task started: ${taskId}`)
            successMessage.value = `🎉 세트 강제 재저장 완료!\n\n🤖 자동 처리 시작:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성 (768차원)\n• 데이터베이스 저장\n\n⏱️ 예상 소요 시간: ${setParts.value.length * 2}초\n📋 작업 ID: ${taskId}`
          }
        } else if (skipLLMAnalysis.value) {
          console.log(`⚡ LLM 분석 건너뛰기 (빠른 저장 모드)`)
          successMessage.value = `세트 강제 재저장 완료! (빠른 저장 모드)`
        }

        // 작업 로그 저장
        await saveOperationLog({
          operation_type: 'set_force_resave',
          target_type: 'set',
          target_id: result.set.id,
          status: failedParts === 0 ? 'success' : 'partial_success',
          message: `세트 ${selectedSet.value.set_num} 강제 재저장 완료. 성공: ${savedParts}개, 실패: ${failedParts}개`,
          metadata: {
            set_num: selectedSet.value.set_num,
            total_parts: setParts.value.length,
            saved_parts: savedParts,
            failed_parts: failedParts,
            processed_images: processedImages,
            failed_images: failedImages,
            set_image: null
          }
        })

        console.log(`Force resave completed: ${savedParts} parts, ${processedImages} images`)
        
      } catch (err) {
        console.error('Force resave failed:', err)
        error.value = `강제 재저장 실패: ${err.message}`
      } finally {
        saving.value = false
      }
    }

    // 기존 세트 중복 체크
    const checkExistingSet = async (setNum) => {
      try {
        const { data, error } = await supabase
          .from('lego_sets')
          .select('id, set_num, name, year, num_parts, created_at')
          .eq('set_num', setNum)
          .maybeSingle()
        
        if (error) {
          console.log('Error checking existing set:', error)
          return null
        }
        
        return data
      } catch (err) {
        console.error('Failed to check existing set:', err)
        return null
      }
    }

    const saveSetToDatabase = async () => {
      if (!selectedSet.value) return
      
      // 1. 기존 세트 중복 체크
      const existingSet = await checkExistingSet(selectedSet.value.set_num)
      let isUpdate = false
      let missingOnly = false
      
      if (existingSet) {
        // 중복 세트 처리 모달 표시
        const userChoice = await showDuplicateSetModal(existingSet, selectedSet.value)
        
        if (userChoice === 'cancel') {
          console.log('User cancelled duplicate set handling')
          return
        }
        
        if (userChoice === 'replace') {
          isUpdate = true
          
          // 기존 데이터 삭제 후 새로 저장
          console.log('Deleting existing set data...')
          try {
            // 부품 관계 삭제
            const { error: deletePartsError } = await supabase
              .from('set_parts')
              .delete()
              .eq('set_id', existingSet.id)
            
            if (deletePartsError) {
              console.warn('Failed to delete set_parts, but continuing with update:', deletePartsError)
              // 삭제 실패해도 계속 진행 (중복 체크 로직이 처리)
            } else {
              console.log('Set parts deleted successfully')
            }
            
            // 세트 정보 삭제
            const { error: deleteSetError } = await supabase
              .from('lego_sets')
              .delete()
              .eq('id', existingSet.id)
            
            if (deleteSetError) {
              console.warn('Failed to delete lego_sets, but continuing with update:', deleteSetError)
              // 삭제 실패해도 계속 진행
            } else {
              console.log('Lego set deleted successfully')
            }
            
            console.log('Existing data deletion attempted')
          } catch (err) {
            console.error('Error during deletion, but continuing with update:', err)
            // 삭제 실패해도 계속 진행 (중복 체크 로직이 처리)
          }
        } else if (userChoice === 'missing') {
          missingOnly = true
          console.log('Missing parts only mode - will add only missing parts')
        }
      }
      
      // 백그라운드 작업으로 저장 시작
      const nonSpareParts = setParts.value.filter(part => !part.is_spare)
      const totalPartsToSave = nonSpareParts.length + (setMinifigs.value?.length || 0)
      
      const taskId = startBackgroundTask(
        `세트 ${selectedSet.value.set_num} ${isUpdate ? '업데이트' : '저장'}`,
        async (task, checkCancelled) => {
          // 작업에 레고 제품 정보 설정
          task.setNum = selectedSet.value.set_num
          task.setName = selectedSet.value.name
          task.totalParts = totalPartsToSave
          task.savedParts = 0
          
          const savedParts = []
          const failedParts = []
          
          try {
            checkCancelled()
            
            // 1. 세트 정보 저장
            const savedSet = await saveLegoSet(selectedSet.value)
            console.log('Set saved:', savedSet)

            // 1.5. 세트 이미지 WebP 변환 (백그라운드에서 실행)
            try {
              checkCancelled()
              console.log(`🖼️ Converting set image to WebP for ${selectedSet.value.set_num}...`)
              console.log(`🖼️ Set image URL: ${selectedSet.value.set_img_url}`)
              
              const webpResult = await convertSetImageToWebP(selectedSet.value)
              if (webpResult) {
                console.log(`✅ Set image converted to WebP: ${selectedSet.value.set_num}`)
                console.log(`✅ WebP URL: ${webpResult.webpUrl}`)
                console.log(`✅ File path: ${webpResult.path}`)
              } else {
                console.log(`⚠️ Set image WebP conversion failed: ${selectedSet.value.set_num}`)
              }
            } catch (imageError) {
              console.warn(`⚠️ Set image WebP conversion failed for ${selectedSet.value.set_num}:`, imageError)
              // 이미지 변환 실패해도 세트 저장은 계속 진행
            }

            // 2. 부품 정보 저장 (예비부품 제외, 피규어 포함)
            // 예비부품 필터링은 이미 위에서 처리됨
            
            // 누락 부품만 등록 모드인 경우 기존 부품 확인
            let partsToSave = nonSpareParts
            if (missingOnly && existingSet) {
              try {
                checkCancelled()
                console.log('📦 누락 부품만 등록 모드: 기존 부품 확인 중...')
                const { data: existingSetParts } = await supabase
                  .from('set_parts')
                  .select('part_id, color_id, element_id')
                  .eq('set_id', existingSet.id)
                
                if (existingSetParts && existingSetParts.length > 0) {
                  // 기존 부품 키 생성 (part_id + color_id + element_id 조합)
                  const existingPartKeys = new Set(
                    existingSetParts.map(sp => 
                      `${sp.part_id}_${sp.color_id}_${sp.element_id || 'null'}`
                    )
                  )
                  
                  // 누락된 부품만 필터링
                  const missingParts = nonSpareParts.filter(part => {
                    const partKey = `${part.part.part_num}_${part.color.id}_${part.element_id || 'null'}`
                    return !existingPartKeys.has(partKey)
                  })
                  
                  console.log(`📦 누락 부품 필터링 완료: 전체 ${nonSpareParts.length}개 중 ${missingParts.length}개 누락`)
                  
                  // 이미지가 없는 부품만 추가 필터링
                  console.log('🖼️ 이미지가 없는 부품만 필터링 중...')
                  const partsWithoutImage = []
                  for (const part of missingParts) {
                    checkCancelled()
                    let hasImage = false
                    
                    try {
                      if (part.element_id) {
                        const imageCheck = await checkPartImageDuplicateByElementId(part.element_id)
                        hasImage = imageCheck && (imageCheck === true || (typeof imageCheck === 'object' && imageCheck.exists === true))
                      } else {
                        hasImage = await checkPartImageDuplicate(part.part.part_num, part.color.id)
                      }
                      
                      if (!hasImage) {
                        partsWithoutImage.push(part)
                        console.log(`🖼️ 이미지 없는 부품: ${part.part.part_num} (color: ${part.color.id}, element: ${part.element_id || '없음'})`)
                      } else {
                        console.log(`✅ 이미지 있는 부품 스킵: ${part.part.part_num} (color: ${part.color.id}, element: ${part.element_id || '없음'})`)
                      }
                    } catch (imageCheckErr) {
                      console.warn(`⚠️ 이미지 확인 실패, 부품 포함: ${part.part.part_num}`, imageCheckErr)
                      // 확인 실패 시 포함 (안전하게 처리)
                      partsWithoutImage.push(part)
                    }
                  }
                  
                  partsToSave = partsWithoutImage
                  console.log(`🖼️ 이미지 없는 부품 필터링 완료: ${missingParts.length}개 중 ${partsWithoutImage.length}개 이미지 없음`)
                  
                  // 작업의 전체 부품수 업데이트
                  task.totalParts = partsToSave.length + (setMinifigs.value?.length || 0)
                } else {
                  console.log('📦 기존 부품이 없어 전체 부품 등록')
                }
              } catch (err) {
                console.warn('⚠️ 기존 부품 확인 실패, 전체 부품 등록:', err)
                partsToSave = nonSpareParts
              }
            }
            
            if (partsToSave.length > 0 || (setMinifigs.value && setMinifigs.value.length > 0)) {
              console.log(`🔍 DEBUG: Starting to save ${partsToSave.length} regular parts (예비부품 제외) + ${setMinifigs.value?.length || 0} minifigs from API...`)
              console.log(`🔍 DEBUG: First few parts:`, partsToSave.slice(0, 3).map(p => ({
                part_num: p.part.part_num,
                color: p.color.name,
                quantity: p.quantity,
                is_spare: p.is_spare
              })))
              
              let savedIndex = 0
              const totalPartsToSave = partsToSave.length + (setMinifigs.value?.length || 0)
              
              // 일반 부품 저장 (예비부품 제외)
              for (let i = 0; i < partsToSave.length; i++) {
                checkCancelled()
                
                const partData = partsToSave[i]
                try {
                  savedIndex++
                  console.log(`Saving part ${savedIndex}/${totalPartsToSave}: ${partData.part.part_num} (예비부품 아님)`)
                  
                  // 진행상황 업데이트
                  updateTaskProgress(taskId, savedIndex, totalPartsToSave, savedIndex)
                  
                  // 부품 정보 저장
                  const savedPart = await saveLegoPart(partData.part)
                  console.log(`Part saved: ${savedPart.part_num}`)
                  
                  // element_id가 있으면 Rebrickable API에서 정확한 색상 정보 가져오기 (set_parts 저장 전)
                  let effectiveColorId = partData.color.id
                  let elementData = null
                  
                  if (partData.element_id) {
                    try {
                      const { getElement } = useRebrickable()
                      // Rate Limit 방지: API 호출 간 최소 간격 유지 (단일 등록은 순차 처리이므로 간단한 딜레이)
                      await new Promise(resolve => setTimeout(resolve, 1100))
                      elementData = await getElement(partData.element_id)
                      
                      // Element ID는 색상 정보를 포함하므로, API에서 가져온 색상 정보를 사용
                      if (elementData?.color?.id) {
                        effectiveColorId = elementData.color.id
                        console.log(`✅ element_id ${partData.element_id}의 실제 색상: ${elementData.color.name} (ID: ${effectiveColorId})`)
                        
                        // 색상 불일치 감지 및 경고
                        if (effectiveColorId !== partData.color.id) {
                          console.warn(`⚠️ 색상 불일치 감지: partData.color.id=${partData.color.id}, elementData.color.id=${effectiveColorId}`)
                          console.warn(`⚠️ element_id 기반 색상(${effectiveColorId})을 사용합니다.`)
                        }
                      }
                    } catch (elementErr) {
                      console.warn(`⚠️ element_id ${partData.element_id} 색상 조회 실패:`, elementErr)
                      // 실패 시 원본 색상 사용
                    }
                  }
                  
                  // 색상 정보 저장 (effectiveColorId 사용)
                  const colorToSave = elementData?.color || partData.color
                  const savedColor = await saveLegoColor(colorToSave)
                  console.log(`Color saved: ${savedColor.name} (ID: ${savedColor.color_id})`)
                  
                  // 세트-부품 관계 저장 (effectiveColorId 사용 - 핵심 수정)
                  const savedSetPart = await saveSetPart(
                    savedSet.id,
                    savedPart.part_num,  // part_id는 part_num (character varying)
                    effectiveColorId,   // element_id 기반 색상 사용 (핵심 수정)
                    partData.quantity,
                    partData.is_spare || false,
                    partData.element_id,
                    partData.num_sets || 1
                  )
                  console.log(`Set-part relationship saved for ${partData.part.part_num} (color_id: ${effectiveColorId})`)
                  
                  // 이미지 업로드 (백그라운드에서 실행)
                  try {
                    console.log(`🖼️ Uploading image for ${partData.part.part_num} (element_id: ${partData.element_id})...`)
                    
                    // element_id 우선 사용 (가장 정확한 색상 매칭)
                    let imageUrl = null
                    let imageSource = 'unknown'
                    
                    // elementData가 이미 조회되었으면 재사용
                    if (elementData) {
                      if (elementData?.element_img_url) {
                        imageUrl = elementData.element_img_url
                        imageSource = 'element_id'
                        console.log(`✅ element_id ${partData.element_id} 기반 이미지 URL 획득:`, imageUrl)
                      } else if (elementData?.part_img_url) {
                        imageUrl = elementData.part_img_url
                        imageSource = 'element_id_part_img'
                        console.log(`⚠️ element_id 이미지 없음, part_img_url 사용`)
                      }
                    } else if (partData.element_id) {
                      // elementData가 없으면 다시 조회
                      try {
                        const { getElement } = useRebrickable()
                        // Rate Limit 방지: API 호출 간 최소 간격 유지
                        await new Promise(resolve => setTimeout(resolve, 1100))
                        elementData = await getElement(partData.element_id)
                        
                        if (elementData?.element_img_url) {
                          imageUrl = elementData.element_img_url
                          imageSource = 'element_id'
                          console.log(`✅ element_id ${partData.element_id} 기반 이미지 URL 획득:`, imageUrl)
                        } else if (elementData?.part_img_url) {
                          imageUrl = elementData.part_img_url
                          imageSource = 'element_id_part_img'
                          console.log(`⚠️ element_id 이미지 없음, part_img_url 사용`)
                        }
                      } catch (elementErr) {
                        console.warn(`⚠️ element_id ${partData.element_id} 이미지 조회 실패:`, elementErr)
                      }
                    }
                    
                    // element_id 실패 시 part_img_url 사용 (fallback)
                    if (!imageUrl) {
                      imageUrl = partData.part.part_img_url
                      imageSource = 'part_num'
                      console.warn(`⚠️ part_num 기반 이미지 사용 (색상 정보 없을 수 있음)`)
                    }
                    
                    // element_id가 유효한 값인지 확인 (null, undefined, 빈 문자열, 0 제외)
                    const validElementId = (partData.element_id && 
                      partData.element_id !== 'null' && 
                      partData.element_id !== 'undefined' && 
                      String(partData.element_id).trim() !== '' &&
                      partData.element_id !== 0) 
                      ? String(partData.element_id).trim() 
                      : null
                    
                    console.log(`[NewLego] saveSetToDatabase 이미지 저장: part_num=${partData.part.part_num}, color_id=${effectiveColorId} (element_id 색상 사용), element_id=${validElementId || '없음'}`)
                    
                    try {
                      const imageResult = await processRebrickableImage(
                        imageUrl,
                        partData.part.part_num,
                        effectiveColorId,
                        { elementId: validElementId, imageSource }
                      )
                      
                      if (imageResult.uploadedUrl) {
                        console.log(`💾 Saving image metadata for ${partData.part.part_num}...`)
                        await saveImageMetadata({
                          original_url: imageUrl,
                          supabase_url: imageResult.uploadedUrl,
                          file_path: imageResult.path,
                          file_name: imageResult.filename || (validElementId ? `${String(validElementId)}.webp` : `${partData.part.part_num}_${effectiveColorId}.webp`),
                          part_num: partData.part.part_num,
                          color_id: effectiveColorId, // element_id 기반 색상 사용 (핵심 수정)
                          element_id: validElementId,
                          set_num: selectedSet.value?.set_num
                        })
                        console.log(`✅ Image metadata saved for ${partData.part.part_num} (element_id: ${validElementId || '없음'}, color_id: ${effectiveColorId})`)
                      } else if (imageResult.isDuplicate) {
                        console.log(`⏭️ 이미지 중복으로 건너뜀: ${partData.part.part_num} (element_id: ${validElementId || '없음'})`)
                        // 중복 이미지는 이미 버킷에 저장되어 있으므로 추가 작업 불필요
                      } else {
                        console.warn(`⚠️ 이미지 업로드 실패 (uploadedUrl 없음): ${partData.part.part_num} (element_id: ${validElementId || '없음'})`)
                        // 프로덕션 모드에서 실패한 이미지 추적을 위한 상세 로그
                        console.error(`[NewLego] 이미지 업로드 실패 상세:`, {
                          partNum: partData.part.part_num,
                          colorId: effectiveColorId,
                          elementId: validElementId,
                          imageUrl: imageUrl,
                          result: imageResult
                        })
                      }
                    } catch (imageError) {
                      // 프로덕션 모드에서 이미지 업로드 실패 시 상세 로그
                      console.error(`[NewLego] 이미지 업로드 중 오류 발생:`, {
                        partNum: partData.part.part_num,
                        colorId: effectiveColorId,
                        elementId: validElementId,
                        imageUrl: imageUrl,
                        error: imageError.message,
                        stack: imageError.stack
                      })
                      // 이미지 업로드 실패해도 부품 저장은 계속 진행
                    }
                  } catch (imageUploadErr) {
                    console.warn(`⚠️ 이미지 업로드 중 오류 발생 (외부):`, imageUploadErr)
                    // 이미지 업로드 실패해도 부품 저장은 계속 진행
                  }
                  
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
              
              // 피규어 저장 (예비부품 아님)
              if (setMinifigs.value && setMinifigs.value.length > 0) {
                console.log(`🧸 Starting to save ${setMinifigs.value.length} minifigs...`)
                
                for (let i = 0; i < setMinifigs.value.length; i++) {
                  checkCancelled()
                  
                  const minifig = setMinifigs.value[i]
                  try {
                    savedIndex++
                    console.log(`Saving minifig ${savedIndex}/${totalPartsToSave}: ${minifig.set_num}`)
                    
                    // 진행상황 업데이트
                    updateTaskProgress(taskId, savedIndex, totalPartsToSave, savedIndex)
                    
                    // 피규어는 부품으로 저장 (part_num은 set_num 사용)
                    const minifigPart = {
                      part_num: minifig.set_num,
                      name: minifig.name || `Minifig ${minifig.set_num}`,
                      part_cat_id: null,
                      part_img_url: minifig.set_img_url || minifig.part_img_url || null
                    }
                    
                    const savedPart = await saveLegoPart(minifigPart)
                    console.log(`Minifig part saved: ${savedPart.part_num}`)
                    
                    // 피규어 색상 정보 (기본값: 0 = Not Applicable)
                    const minifigColor = {
                      id: 0,
                      color_id: 0,
                      name: 'Not Applicable',
                      rgb: null,
                      is_trans: false
                    }
                    
                    const savedColor = await saveLegoColor(minifigColor)
                    console.log(`Minifig color saved: ${savedColor.name} (ID: ${savedColor.color_id})`)
                    
                    // 세트-피규어 관계 저장 (is_spare: false)
                    const savedSetPart = await saveSetPart(
                      savedSet.id,
                      savedPart.part_num,
                      savedColor.color_id,
                      minifig.quantity || 1,
                      false, // 예비부품 아님
                      null, // element_id 없음
                      minifig.num_sets || 1
                    )
                    console.log(`Set-minifig relationship saved for ${minifig.set_num}`)
                    
                    // 피규어 이미지 업로드
                    const minifigImageUrl = minifig.set_img_url || minifig.part_img_url
                    if (minifigImageUrl) {
                      try {
                        console.log(`🖼️ Uploading image for minifig ${minifig.set_num}...`)
                        
                        const imageResult = await processRebrickableImage(
                          minifigImageUrl,
                          savedPart.part_num,
                          savedColor.color_id,
                          { elementId: null, imageSource: 'minifig' }
                        )
                        
                        if (imageResult.uploadedUrl) {
                          console.log(`💾 Saving image metadata for minifig ${minifig.set_num}...`)
                          await saveImageMetadata({
                            original_url: minifigImageUrl,
                            supabase_url: imageResult.uploadedUrl,
                            file_path: imageResult.path,
                            file_name: imageResult.filename || `${savedPart.part_num}_${savedColor.color_id}.webp`,
                            part_num: savedPart.part_num,
                            color_id: savedColor.color_id,
                            element_id: null,
                            set_num: selectedSet.value?.set_num
                          })
                          console.log(`✅ Image metadata saved for minifig ${minifig.set_num}`)
                        } else if (imageResult.isDuplicate) {
                          console.log(`⏭️ 이미지 중복으로 건너뜀: minifig ${minifig.set_num}`)
                        } else {
                          console.warn(`⚠️ 이미지 업로드 실패 (uploadedUrl 없음): minifig ${minifig.set_num}`)
                        }
                      } catch (imageError) {
                        console.warn(`⚠️ Image upload failed for minifig ${minifig.set_num}:`, imageError)
                      }
                    }
                    
                    savedParts.push({
                      part_num: minifig.set_num,
                      color: 'Minifig',
                      quantity: minifig.quantity || 1
                    })
                    
                  } catch (minifigErr) {
                    console.error(`Failed to save minifig ${minifig.set_num}:`, minifigErr)
                    failedParts.push({
                      part_num: minifig.set_num,
                      color: 'Minifig',
                      error: minifigErr.message
                    })
                  }
                }
              }
              
              console.log(`🔍 DEBUG: Save completed - Success: ${savedParts.length}, Failed: ${failedParts.length}`)
              console.log(`🔍 DEBUG: Failed parts:`, failedParts)
              
              // 🤖 백그라운드 LLM 분석 + CLIP 임베딩 자동화
              if (!skipLLMAnalysis.value && savedParts.length > 0) {
                console.log(`🤖 백그라운드 LLM 분석 + CLIP 임베딩 자동화 시작 (${savedParts.length}개 부품)`)
                const taskId = await startBackgroundAnalysis(selectedSet.value, setParts.value)
                console.log(`📋 Background task started: ${taskId}`)
                successMessage.value = `🎉 세트 저장 완료!\n\n🤖 자동 처리 시작:\n• LLM 메타데이터 생성\n• CLIP 임베딩 생성 (768차원)\n• 데이터베이스 저장\n\n⏱️ 예상 소요 시간: ${savedParts.length * 2}초\n📋 작업 ID: ${taskId}\n\n⚠️ 다음 단계 필수: Semantic Vector 생성\n→ 메타데이터 관리 페이지 > Semantic Vector 탭에서 생성하세요.\n→ 신규 등록 부품 필터를 사용하면 빠르게 찾을 수 있습니다.`
              } else if (skipLLMAnalysis.value) {
                console.log(`⚡ LLM 분석 건너뛰기 (빠른 저장 모드)`)
                successMessage.value = `세트 저장 완료! (빠른 저장 모드)`
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

            console.log(`Save completed: ${savedParts.length} successful, ${failedParts.length} failed`)
            console.log('Failed parts details:', failedParts)
            
            // 등록 검증 실행
            try {
              const verification = await verifyRegistration(selectedSet.value.set_num)
              registrationVerification.value = verification
              if (verification) {
                console.log('등록 검증 결과:', verification)
                if (!verification.allMatch) {
                  console.warn('⚠️ 등록 검증 불일치:', {
                    'API 부품 수': verification.apiPartsCount,
                    '등록된 부품 수': verification.registeredPartsCount,
                    '이미지 개수': verification.uniqueImagesCount
                  })
                }
              }
            } catch (verifyError) {
              console.error('등록 검증 실패:', verifyError)
            }
            
            return {
              savedParts,
              failedParts,
              setNum: selectedSet.value.set_num
            }
            
          } catch (err) {
            console.error('Failed to save set:', err)
            throw err
          }
        }
      )
      
      // 즉시 성공 메시지 표시 (백그라운드에서 작업 진행)
      const message = isUpdate 
        ? `세트 ${selectedSet.value.set_num} 업데이트가 백그라운드에서 시작되었습니다. 페이지를 이동해도 작업이 계속됩니다.`
        : `세트 ${selectedSet.value.set_num} 저장이 백그라운드에서 시작되었습니다. 페이지를 이동해도 작업이 계속됩니다.`
      successMessage.value = message
      
      // 작업 완료 후 결과 처리 (선택사항)
      setTimeout(async () => {
        try {
          const task = getRunningTasks().find(t => t.id === taskId)
          if (task && task.status === 'completed') {
            const result = task.result
            if (result.failedParts.length === 0) {
              const action = isUpdate ? '업데이트' : '저장'
              successMessage.value = `세트 ${result.setNum} 및 ${result.savedParts.length}개 부품 정보가 성공적으로 ${action}되었습니다.`
            } else {
              const action = isUpdate ? '업데이트' : '저장'
              successMessage.value = `세트 ${result.setNum} ${action} 완료. 성공: ${result.savedParts.length}개, 실패: ${result.failedParts.length}개`
              error.value = `실패한 부품들: ${result.failedParts.map(p => `${p.part_num}(${p.color})`).join(', ')}`
            }
          }
        } catch (err) {
          console.error('Error processing task result:', err)
        }
      }, 1000)
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

    // 기본 이미지 로드 함수
    const getDefaultPartImage = async () => {
      try {
        // part_images 테이블에서 기본 부품 이미지 로드 (part_id: 3001)
        const { data, error } = await supabase
          .from('part_images')
          .select('uploaded_url')
          .eq('part_id', '3001')
          .not('uploaded_url', 'is', null)
          .maybeSingle()
        
        if (!error && data?.uploaded_url) {
          return data.uploaded_url
        }
        
        // 없으면 lego_parts에서 part_img_url 사용
        const { data: partData, error: partError } = await supabase
          .from('lego_parts')
          .select('part_img_url')
          .eq('part_num', '3001')
          .maybeSingle()
        
        if (!partError && partData?.part_img_url) {
          return `/api/upload/proxy-image?url=${encodeURIComponent(partData.part_img_url)}`
        }
        
        return null
        
      } catch (error) {
        console.error('기본 부품 이미지 로드 실패:', error)
        return null
      }
    }

    // 실제 이미지 로드 함수
    const getRealPartImage = async (partNum) => {
      try {
        if (!partNum) return null
        
        // 1. part_images 테이블에서 이미지 조회 (part_id로)
        const { data: partImage, error: partImageError } = await supabase
          .from('part_images')
          .select('uploaded_url')
          .eq('part_id', partNum)
          .not('uploaded_url', 'is', null)
          .maybeSingle()
        
        if (!partImageError && partImage?.uploaded_url) {
          return partImage.uploaded_url
        }
        
        // 2. lego_parts에서 part_img_url 사용
        const { data: partData, error: partError } = await supabase
          .from('lego_parts')
          .select('part_img_url')
          .eq('part_num', partNum)
          .maybeSingle()
        
        if (!partError && partData?.part_img_url) {
          return `/api/upload/proxy-image?url=${encodeURIComponent(partData.part_img_url)}`
        }
        
        // 3. image_metadata에서 조회
        const { data: imageMetadata, error: metadataError } = await supabase
          .from('image_metadata')
          .select('supabase_url')
          .eq('part_num', partNum)
          .not('supabase_url', 'is', null)
          .maybeSingle()
        
        if (!metadataError && imageMetadata?.supabase_url) {
          return imageMetadata.supabase_url
        }
        
        return null
        
      } catch (error) {
        console.error('실제 부품 이미지 로드 실패:', error)
        return null
      }
    }

    const handleImageError = (event, part = null) => {
      // 미니피규어 이미지 오류 처리
      if (event.target.closest('.minifig-card')) {
        event.target.style.display = 'none'
        const noImageDiv = event.target.nextElementSibling
        if (noImageDiv && noImageDiv.classList.contains('no-image')) {
          noImageDiv.style.display = 'flex'
        }
      } else {
        // 일반 부품 이미지 오류 처리
        if (part && part.part && part.part.part_num) {
          getRealPartImage(part.part.part_num).then(imageUrl => {
            if (imageUrl) {
              event.target.src = imageUrl
            }
          }).catch(err => {
            console.warn('이미지 로드 실패:', err)
          })
        } else {
          // 부품 정보가 없으면 기본 이미지로 대체
          event.target.style.display = 'none'
        }
      }
    }

    // 백그라운드 WebP 변환 함수 (UI 없이 자동 실행)
    const convertSetImageToWebP = async (set) => {
      try {
        if (!set.set_img_url) {
          console.warn(`세트 ${set.set_num}에 이미지 URL이 없습니다.`)
          return null
        }

        console.log(`🖼️ Starting set image conversion for ${set.set_num}`)
        console.log(`🖼️ Original URL: ${set.set_img_url}`)
        
        // WebP 파일명 생성
        const webpFileName = `${set.set_num}_set.webp`
        const uploadPath = 'lego_sets_images'
        
        console.log(`🖼️ Target filename: ${webpFileName}`)
        console.log(`🖼️ Upload path: ${uploadPath}`)
        
        // 이미지 다운로드 및 WebP 변환
        console.log(`🖼️ Calling uploadImageFromUrl...`)
        const result = await uploadImageFromUrl(
          set.set_img_url,
          webpFileName,
          uploadPath
        )
        
        console.log(`🖼️ uploadImageFromUrl result:`, result)
        
        if (result && result.url) {
          console.log(`✅ Set image upload successful!`)
          console.log(`✅ WebP URL: ${result.url}`)
          console.log(`✅ File path: ${result.path}`)
          // 세트 이미지 메타데이터 저장
          await saveSetImageMetadata({
            set_num: set.set_num,
            original_url: set.set_img_url,
            supabase_url: result.url,
            file_path: result.path,
            file_name: webpFileName,
            set_id: set.id
          })
          
          // lego_sets 테이블의 webp_image_url 필드 업데이트
          try {
            console.log(`🔄 Updating lego_sets table for ${set.set_num}...`)
            console.log(`🔄 WebP URL to save: ${result.url}`)
            
            const { error: updateError } = await supabase
              .from('lego_sets')
              .update({ webp_image_url: result.url })
              .eq('set_num', set.set_num)
            
            if (updateError) {
              console.error(`❌ lego_sets webp_image_url 업데이트 실패: ${updateError.message}`)
              console.error(`❌ Update details:`, {
                setNum: set.set_num,
                webpUrl: result.url,
                error: updateError
              })
            } else {
              console.log(`✅ lego_sets webp_image_url 업데이트 완료: ${set.set_num}`)
              console.log(`✅ Saved WebP URL: ${result.url}`)
            }
          } catch (updateErr) {
            console.error(`❌ lego_sets webp_image_url 업데이트 중 오류: ${updateErr.message}`)
            console.error(`❌ Update error details:`, updateErr)
          }
          
          return {
            originalUrl: set.set_img_url,
            webpUrl: result.url,
            filename: webpFileName,
            path: result.path
          }
        }
        
        return null
      } catch (err) {
        return null
      }
    }

    // 세트 이미지 메타데이터 저장
    const saveSetImageMetadata = async (imageData) => {
      try {
        const { error } = await supabase
          .from('set_images')
          .upsert([imageData], { 
            onConflict: 'set_num',
            returning: 'minimal' 
          })

        if (error) {
          // 조용히 실패 처리
        }
      } catch (err) {
        // 조용히 실패 처리
      }
    }

    // 일괄 등록 함수
    const batchRegisterSets = async () => {
      if (!searchQuery.value.trim()) return
      
      const setNumbers = parseSetNumbers(searchQuery.value)
      if (setNumbers.length === 0) {
        error.value = '유효한 세트 번호를 입력해주세요.'
        return
      }

      try {
        batchProcessing.value = true
        batchRegisterProgress.value = { 
          current: 0, 
          total: setNumbers.length, 
          currentSet: '', 
          currentSetName: '', 
          currentSetParts: 0, 
          currentSetSavedParts: 0 
        }
        showProgressModal.value = true
        error.value = ''
        successMessage.value = ''

        const results = {
          success: [],
          failed: [],
          skipped: []
        }

        for (let i = 0; i < setNumbers.length; i++) {
          const setNum = setNumbers[i]
          batchRegisterProgress.value.current = i + 1
          batchRegisterProgress.value.currentSet = setNum
          batchRegisterProgress.value.currentSetName = ''
          batchRegisterProgress.value.currentSetParts = 0
          batchRegisterProgress.value.currentSetSavedParts = 0

          try {
            // API 호출 간 딜레이 (Rate Limit 방지: 분당 60회 제한)
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1100)) // 1.1초 대기
            }

            // 세트 번호 정규화
            const formattedSetNum = formatSetNumber(setNum)
            
            // 중복 확인 (원본 번호와 변환된 번호 모두 확인)
            // 1. 원본 번호로 확인
            const existingSetOriginal = await checkSetExists(setNum)
            
            // 2. 변환된 번호로 확인 (다를 경우만)
            let existingSetFormatted = null
            if (formattedSetNum !== setNum) {
              existingSetFormatted = await checkSetExists(formattedSetNum)
            }
            
            // 3. 역변환도 확인 (예: 입력 "72045-1"이고 DB에 "72045"로 저장된 경우)
            let existingSetReverse = null
            if (setNum.includes('-')) {
              const reverseSetNum = setNum.split('-')[0] // 하이픈 앞부분만
              if (reverseSetNum !== setNum) {
                existingSetReverse = await checkSetExists(reverseSetNum)
              }
            }
            
            const existingSet = existingSetOriginal || existingSetFormatted || existingSetReverse
            
            if (existingSet) {
              // 중복 세트 처리 모달 표시
              const setInfo = await getSet(formattedSetNum)
              if (!setInfo) {
                results.failed.push({ setNum, reason: '세트 정보를 가져올 수 없습니다' })
                continue
              }
              
              const userChoice = await showDuplicateSetModal(existingSet, setInfo)
              
              if (userChoice === 'cancel') {
                results.skipped.push({ setNum, reason: '사용자 취소' })
                continue
              }
              
              let shouldReplace = false
              let missingOnly = false
              
              if (userChoice === 'replace') {
                shouldReplace = true
                // 기존 데이터 삭제 후 새로 저장
                console.log(`세트 ${setNum} 기존 데이터 삭제 중...`)
                try {
                  const { error: deletePartsError } = await supabase
                    .from('set_parts')
                    .delete()
                    .eq('set_id', existingSet.id)
                  
                  if (deletePartsError) {
                    console.warn('Failed to delete set_parts:', deletePartsError)
                  }
                  
                  const { error: deleteSetError } = await supabase
                    .from('lego_sets')
                    .delete()
                    .eq('id', existingSet.id)
                  
                  if (deleteSetError) {
                    console.warn('Failed to delete lego_sets:', deleteSetError)
                  }
                } catch (err) {
                  console.error('Error during deletion:', err)
                }
              } else if (userChoice === 'missing') {
                missingOnly = true
                console.log(`세트 ${setNum} 누락 부품만 등록 모드`)
              }
              
              console.log(`세트 ${setNum} (또는 ${formattedSetNum})는 이미 등록되어 있습니다. 부품 이미지 확인 중...`)
              
              // 중복된 세트의 부품 이미지 확인 및 누락된 이미지 다운로드 (replace 모드가 아닐 때만)
              if (!shouldReplace) {
                try {
                  // API 호출 간 딜레이 (Rate Limit 방지)
                  await new Promise(resolve => setTimeout(resolve, 1100)) // 1.1초 대기
                
                  // 부품 정보 가져오기
                  const partsResult = await getSetPartsAPI(formattedSetNum)
                  const parts = partsResult.results || []
                  
                  if (parts.length > 0) {
                    let imageProcessedCount = 0
                    let imageSkippedCount = 0
                    const BATCH_SIZE = 10
                    
                    // Rebrickable API Rate Limit 방지: element_id 조회를 순차 처리하기 위한 락
                    let duplicateCheckApiLock = Promise.resolve()
                    let duplicateCheckLastApiCall = 0
                    const MIN_API_INTERVAL = 1100
                    
                    for (let imgIdx = 0; imgIdx < parts.length; imgIdx += BATCH_SIZE) {
                      const batch = parts.slice(imgIdx, imgIdx + BATCH_SIZE)
                      
                      await Promise.allSettled(
                        batch.map(async (part) => {
                          try {
                            const partImgUrl = part?.part?.part_img_url || part?.part_img_url
                            if (!partImgUrl) {
                              return
                            }
                            
                            // element_id 검증
                            const validElementId = (part.element_id && 
                              part.element_id !== 'null' && 
                              part.element_id !== 'undefined' && 
                              String(part.element_id).trim() !== '' &&
                              part.element_id !== 0) 
                              ? String(part.element_id).trim() 
                              : null
                            
                            // part_num과 color_id 추출
                            const partNum = part?.part?.part_num || part?.part_num
                            const colorId = part?.color?.id || part?.color_id
                            
                            if (!partNum || colorId === undefined) {
                              return
                            }
                            
                            // 이미지 중복 확인
                            const isDuplicate = validElementId
                              ? await checkPartImageDuplicateByElementId(validElementId)
                              : await checkPartImageDuplicate(partNum, colorId)
                            
                            // Storage에 이미지가 있지만 part_images 테이블에 기록이 없을 수 있음
                            // Storage URL을 확인하고 part_images 테이블에 기록 추가
                            if (isDuplicate) {
                              // Storage에 이미지가 있는지 확인하고 part_images 테이블에 기록 추가
                              try {
                                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                                  (import.meta.env.PROD ? null : 'https://npferbxuxocbfnfbpcnz.supabase.co')
                                
                                if (!supabaseUrl) {
                                  throw new Error('VITE_SUPABASE_URL 환경 변수가 설정되지 않았습니다. 프로덕션 모드에서는 필수입니다.')
                                }
                                const bucketName = 'lego_parts_images'
                                const fileName = validElementId 
                                  ? `${String(validElementId)}.webp`
                                  : `${partNum}_${colorId}.webp`
                                const storageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
                                
                                // Storage에 실제로 이미지가 있는지 확인
                                const storageCheck = await fetch(storageUrl, { method: 'HEAD' })
                                if (storageCheck.ok) {
                                  // part_images 테이블에 기록이 있는지 확인
                                  let existingRecord = null
                                  if (validElementId) {
                                    const { data } = await supabase
                                      .from('part_images')
                                      .select('part_id')
                                      .eq('element_id', String(validElementId))
                                      .maybeSingle()
                                    existingRecord = data
                                  } else {
                                    const { data } = await supabase
                                      .from('part_images')
                                      .select('part_id')
                                      .eq('part_id', String(partNum))
                                      .eq('color_id', colorId)
                                      .maybeSingle()
                                    existingRecord = data
                                  }
                                  
                                  if (!existingRecord) {
                                    // Storage에 이미지가 있지만 DB에 기록이 없으면 추가
                                    console.log(`[BatchRegister] ✅ Storage에 이미지 있음, part_images 테이블에 기록 추가: ${fileName}`)
                                    await upsertPartImage({
                                      partNum,
                                      colorId,
                                      uploadedUrl: storageUrl,
                                      filename: fileName,
                                      elementId: validElementId
                                    })
                                    imageProcessedCount++ // DB 기록 추가로 카운트
                                    console.log(`[BatchRegister] ✅ part_images 테이블 기록 완료: ${fileName}`)
                                  } else {
                                    console.log(`[BatchRegister] 이미 part_images 테이블에 기록 있음: ${fileName}`)
                                    imageSkippedCount++
                                  }
                                } else {
                                  console.log(`[BatchRegister] Storage에 이미지 없음: ${fileName}`)
                                  imageSkippedCount++
                                }
                              } catch (syncError) {
                                console.warn(`[BatchRegister] part_images 동기화 실패:`, syncError)
                                imageSkippedCount++
                              }
                              return
                            }
                            
                            // 이미지가 없으면 다운로드
                            let imageUrl = null
                            let imageSource = 'unknown'
                            let effectiveColorId = colorId
                            let elementData = null
                            
                            if (validElementId) {
                              try {
                                // Rate Limit 방지: 락을 사용하여 순차 처리
                                duplicateCheckApiLock = duplicateCheckApiLock.then(async () => {
                                  const timeSinceLastCall = Date.now() - duplicateCheckLastApiCall
                                  if (timeSinceLastCall < MIN_API_INTERVAL) {
                                    const waitTime = MIN_API_INTERVAL - timeSinceLastCall
                                    await new Promise(resolve => setTimeout(resolve, waitTime))
                                  }
                                  
                                  duplicateCheckLastApiCall = Date.now()
                                  return await getElement(validElementId)
                                }).catch(err => {
                                  console.warn(`[BatchRegister] element_id ${validElementId} API 호출 실패:`, err)
                                  return null
                                })
                                
                                elementData = await duplicateCheckApiLock
                                
                                // Element ID는 색상 정보를 포함하므로, API에서 가져온 색상 정보를 사용
                                if (elementData?.color?.id) {
                                  effectiveColorId = elementData.color.id
                                  console.log(`✅ element_id ${validElementId}의 실제 색상: ${elementData.color.name} (ID: ${effectiveColorId})`)
                                  
                                  // 색상 불일치 감지 및 경고
                                  if (effectiveColorId !== colorId) {
                                    console.warn(`⚠️ 색상 불일치 감지: part.color.id=${colorId}, elementData.color.id=${effectiveColorId}`)
                                    console.warn(`⚠️ element_id 기반 색상(${effectiveColorId})을 사용합니다.`)
                                  }
                                }
                                
                                if (elementData?.element_img_url) {
                                  imageUrl = elementData.element_img_url
                                  imageSource = 'element_id'
                                } else if (elementData?.part_img_url) {
                                  imageUrl = elementData.part_img_url
                                  imageSource = 'element_id_part_img'
                                }
                              } catch (elementErr) {
                                console.warn(`[BatchRegister] element_id ${validElementId} 이미지 조회 실패:`, elementErr)
                              }
                            }
                            
                            if (!imageUrl) {
                              imageUrl = partImgUrl
                              imageSource = 'part_num'
                            }
                            
                            // 이미지 처리
                            const imageResult = await processRebrickableImage(
                              imageUrl,
                              partNum,
                              effectiveColorId, // element_id 기반 색상 사용 (핵심 수정)
                              { elementId: validElementId, imageSource }
                            )
                            
                            // 이미지 메타데이터 저장
                            if (imageResult.uploadedUrl) {
                              console.log(`[BatchRegister] 이미지 메타데이터 저장 시작: ${imageResult.filename}`)
                              try {
                                await saveImageMetadata({
                                  original_url: imageUrl,
                                  supabase_url: imageResult.uploadedUrl,
                                  file_path: imageResult.path,
                                  file_name: imageResult.filename,
                                  part_num: partNum,
                                  color_id: effectiveColorId, // element_id 기반 색상 사용 (핵심 수정)
                                  element_id: validElementId,
                                  set_num: existingSet.set_num
                                })
                                imageProcessedCount++
                                console.log(`[BatchRegister] ✅ 이미지 메타데이터 저장 완료: ${imageResult.filename}`)
                              } catch (metadataError) {
                                console.error(`[BatchRegister] 이미지 메타데이터 저장 실패: ${imageResult.filename}`, metadataError)
                              }
                            } else {
                              console.warn(`[BatchRegister] uploadedUrl이 없어 메타데이터 저장 건너뜀: ${partNum}_${colorId}`)
                            }
                          } catch (imageError) {
                            const partNum = part?.part?.part_num || part?.part_num || 'unknown'
                            console.warn(`[BatchRegister] 세트 ${setNum} 부품 ${partNum} 이미지 처리 실패:`, imageError)
                          }
                        })
                      )
                      
                      // 배치 간 딜레이
                      if (imgIdx + BATCH_SIZE < parts.length) {
                        await new Promise(resolve => setTimeout(resolve, 500))
                      }
                    }
                    
                    console.log(`세트 ${setNum} 부품 이미지 확인 완료: 새로 다운로드 ${imageProcessedCount}개, 이미 존재 ${imageSkippedCount}개`)
                    
                    results.skipped.push({ 
                      setNum, 
                      reason: '이미 등록됨',
                      existingSetNum: existingSet.set_num,
                      imagesProcessed: imageProcessedCount,
                      imagesSkipped: imageSkippedCount
                    })
                  } else {
                    results.skipped.push({ 
                      setNum, 
                      reason: '이미 등록됨 (부품 정보 없음)',
                      existingSetNum: existingSet.set_num
                    })
                  }
                } catch (imageCheckError) {
                  console.warn(`세트 ${setNum} 부품 이미지 확인 실패:`, imageCheckError)
                  results.skipped.push({ 
                    setNum, 
                    reason: '이미 등록됨 (이미지 확인 실패)',
                    existingSetNum: existingSet.set_num
                  })
                }
              }
              
              continue
            }

            // 세트 정보 가져오기
            const setData = await getSet(formattedSetNum)
            if (!setData) {
              results.failed.push({ setNum, reason: '세트 정보를 가져올 수 없습니다' })
              continue
            }
            
            // 세트 정보 업데이트
            batchRegisterProgress.value.currentSetName = setData.name || ''
            batchRegisterProgress.value.currentSet = setData.set_num || setNum
            
            // API 호출 간 딜레이 (Rate Limit 방지)
            await new Promise(resolve => setTimeout(resolve, 1100)) // 1.1초 대기
            
            // 부품 정보 가져오기
            const partsResult = await getSetPartsAPI(formattedSetNum)
            const parts = partsResult.results || []

            if (parts.length === 0) {
              console.warn(`세트 ${setNum}의 부품 정보를 가져올 수 없습니다.`)
              results.failed.push({ setNum, reason: '부품 정보 없음' })
              continue
            }

            // 단일 등록과 동일한 방식으로 저장
            const savedParts = []
            const failedParts = []
            
            try {
              // 1. 세트 정보 저장
              const savedSet = await saveLegoSet(setData)
              console.log(`세트 ${setNum} 저장 완료:`, savedSet)

              // 1.5. 세트 이미지 WebP 변환 (단일 등록과 동일)
              try {
                console.log(`🖼️ Converting set image to WebP for ${setData.set_num}...`)
                const webpResult = await convertSetImageToWebP(setData)
                if (webpResult) {
                  console.log(`✅ Set image converted to WebP: ${setData.set_num}`)
                } else {
                  console.log(`⚠️ Set image WebP conversion failed: ${setData.set_num}`)
                }
              } catch (imageError) {
                console.warn(`⚠️ Set image WebP conversion failed for ${setData.set_num}:`, imageError)
              }

              // 2. 부품 정보 저장 (예비부품 제외, 피규어 포함)
              // 예비부품 필터링
              let nonSpareParts = parts.filter(part => !part.is_spare)
              
              // 누락 부품만 등록 모드인 경우 기존 부품 및 이미지 확인
              if (missingOnly && existingSet) {
                try {
                  console.log(`📦 [일괄 등록] 누락 부품만 등록 모드: 기존 부품 확인 중...`)
                  const { data: existingSetParts } = await supabase
                    .from('set_parts')
                    .select('part_id, color_id, element_id')
                    .eq('set_id', existingSet.id)
                  
                  if (existingSetParts && existingSetParts.length > 0) {
                    // 기존 부품 키 생성
                    const existingPartKeys = new Set(
                      existingSetParts.map(sp => 
                        `${sp.part_id}_${sp.color_id}_${sp.element_id || 'null'}`
                      )
                    )
                    
                    // 누락된 부품만 필터링
                    const missingParts = nonSpareParts.filter(part => {
                      const partKey = `${part.part.part_num}_${part.color.id}_${part.element_id || 'null'}`
                      return !existingPartKeys.has(partKey)
                    })
                    
                    console.log(`📦 [일괄 등록] 누락 부품 필터링 완료: 전체 ${nonSpareParts.length}개 중 ${missingParts.length}개 누락`)
                    
                    // 이미지가 없는 부품만 추가 필터링
                    console.log('🖼️ [일괄 등록] 이미지가 없는 부품만 필터링 중...')
                    const partsWithoutImage = []
                    for (const part of missingParts) {
                      let hasImage = false
                      
                      try {
                        if (part.element_id) {
                          const imageCheck = await checkPartImageDuplicateByElementId(part.element_id)
                          hasImage = imageCheck && (imageCheck === true || (typeof imageCheck === 'object' && imageCheck.exists === true))
                        } else {
                          hasImage = await checkPartImageDuplicate(part.part.part_num, part.color.id)
                        }
                        
                        if (!hasImage) {
                          partsWithoutImage.push(part)
                          console.log(`🖼️ [일괄 등록] 이미지 없는 부품: ${part.part.part_num} (color: ${part.color.id}, element: ${part.element_id || '없음'})`)
                        } else {
                          console.log(`✅ [일괄 등록] 이미지 있는 부품 스킵: ${part.part.part_num} (color: ${part.color.id}, element: ${part.element_id || '없음'})`)
                        }
                      } catch (imageCheckErr) {
                        console.warn(`⚠️ [일괄 등록] 이미지 확인 실패, 부품 포함: ${part.part.part_num}`, imageCheckErr)
                        // 확인 실패 시 포함 (안전하게 처리)
                        partsWithoutImage.push(part)
                      }
                    }
                    
                    nonSpareParts = partsWithoutImage
                    console.log(`🖼️ [일괄 등록] 이미지 없는 부품 필터링 완료: ${missingParts.length}개 중 ${partsWithoutImage.length}개 이미지 없음`)
                  } else {
                    console.log('📦 [일괄 등록] 기존 부품이 없어 전체 부품 등록')
                  }
                } catch (err) {
                  console.warn('⚠️ [일괄 등록] 기존 부품 확인 실패, 전체 부품 등록:', err)
                }
              }
              
              // 피규어 정보 가져오기 (Rate Limit 방지: API 호출 간 딜레이)
              let minifigs = []
              try {
                // API 호출 간 딜레이
                await new Promise(resolve => setTimeout(resolve, 1100))
                
                const minifigsResult = await Promise.allSettled([
                  getSetMinifigs(setNum)
                ])
                if (minifigsResult[0].status === 'fulfilled') {
                  minifigs = minifigsResult[0].value?.results || []
                  console.log(`[BatchRegister] Loaded ${minifigs.length} minifigs for set ${setNum}`)
                  if (minifigs.length > 0) {
                    console.log(`[BatchRegister] Minifigs details:`, minifigs.map(m => `${m.set_num} (${m.name})`))
                  }
                } else {
                  console.error(`[BatchRegister] Failed to load minifigs for set ${setNum}:`, minifigsResult[0].reason)
                  console.error(`[BatchRegister] Error details:`, minifigsResult[0].reason?.message || minifigsResult[0].reason)
                }
              } catch (minifigsErr) {
                console.warn(`[BatchRegister] Failed to load minifigs for set ${setNum}:`, minifigsErr)
              }
              
              const totalPartsToSave = nonSpareParts.length + minifigs.length
              batchRegisterProgress.value.currentSetParts = totalPartsToSave
              batchRegisterProgress.value.currentSetSavedParts = 0
              console.log(`🔍 DEBUG: Starting to save ${nonSpareParts.length} regular parts (예비부품 제외) + ${minifigs.length} minifigs for set ${setNum}...`)
              
              // 배치 처리: 부품과 색상을 먼저 배치로 저장
              const BATCH_SIZE = 50
              const imagePromises = []
              
              // Rebrickable API Rate Limit 방지: element_id 조회를 순차 처리하기 위한 락
              let apiCallLock = Promise.resolve()
              let lastApiCallTime = 0
              const MIN_API_INTERVAL = 1100 // 최소 1.1초 간격 (Rate Limit: 분당 60회)
              
              // 1단계: 모든 부품과 색상을 배치로 저장
              for (let batchStart = 0; batchStart < nonSpareParts.length; batchStart += BATCH_SIZE) {
                const batch = nonSpareParts.slice(batchStart, batchStart + BATCH_SIZE)
                const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
                const totalBatches = Math.ceil(nonSpareParts.length / BATCH_SIZE)
                
                batchRegisterProgress.value.currentSet = `${setNum} (부품 배치: ${batchNum}/${totalBatches})`
                
                // 배치 내 병렬 처리 (단, element_id 조회는 순차 처리)
                await Promise.allSettled(
                  batch.map(async (partData, batchIndex) => {
                    try {
                      // 부품 정보 저장
                      const savedPart = await saveLegoPart(partData.part)
                      
                      // element_id가 있으면 Rebrickable API에서 정확한 색상 정보 가져오기 (Rate Limit 고려)
                      let effectiveColorId = partData.color.id
                      let elementData = null
                      
                      if (partData.element_id) {
                        try {
                          // Rate Limit 방지: 락을 사용하여 순차 처리
                          apiCallLock = apiCallLock.then(async () => {
                            const timeSinceLastCall = Date.now() - lastApiCallTime
                            if (timeSinceLastCall < MIN_API_INTERVAL) {
                              const waitTime = MIN_API_INTERVAL - timeSinceLastCall
                              await new Promise(resolve => setTimeout(resolve, waitTime))
                            }
                            
                            lastApiCallTime = Date.now()
                            return await getElement(partData.element_id)
                          }).catch(err => {
                            console.warn(`[BatchRegister] element_id ${partData.element_id} API 호출 실패:`, err)
                            return null
                          })
                          
                          elementData = await apiCallLock
                          
                          if (elementData?.color?.id) {
                            effectiveColorId = elementData.color.id
                          }
                        } catch (elementErr) {
                          console.warn(`[BatchRegister] element_id ${partData.element_id} 색상 조회 실패:`, elementErr)
                        }
                      }
                      
                      // 색상 정보 저장
                      const colorToSave = elementData?.color || partData.color
                      const savedColor = await saveLegoColor(colorToSave)
                      
                      // 세트-부품 관계 저장
                      await saveSetPart(
                        savedSet.id,
                        savedPart.part_num,
                        effectiveColorId,
                        partData.quantity,
                        partData.is_spare || false,
                        partData.element_id || null,
                        partData.num_sets || 1
                      )
                      
                      // 진행률 업데이트
                      batchRegisterProgress.value.currentSetSavedParts++
                      
                      // 이미지 처리는 백그라운드로 (비동기)
                      const imagePromise = (async () => {
                        try {
                          let imageUrl = null
                          let imageSource = 'unknown'
                          
                          if (elementData) {
                            imageUrl = elementData?.element_img_url || elementData?.part_img_url
                            imageSource = elementData?.element_img_url ? 'element_id' : 'element_id_part_img'
                          } else if (partData.element_id) {
                            try {
                              // Rate Limit 방지: 락을 사용하여 순차 처리
                              apiCallLock = apiCallLock.then(async () => {
                                const timeSinceLastCall = Date.now() - lastApiCallTime
                                if (timeSinceLastCall < MIN_API_INTERVAL) {
                                  const waitTime = MIN_API_INTERVAL - timeSinceLastCall
                                  await new Promise(resolve => setTimeout(resolve, waitTime))
                                }
                                
                                lastApiCallTime = Date.now()
                                return await getElement(partData.element_id)
                              }).catch(err => {
                                console.warn(`[BatchRegister] element_id 이미지 조회 실패:`, err)
                                return null
                              })
                              
                              const elData = await apiCallLock
                              if (elData) {
                                imageUrl = elData?.element_img_url || elData?.part_img_url
                                imageSource = elData?.element_img_url ? 'element_id' : 'element_id_part_img'
                              }
                            } catch (err) {
                              console.warn(`[BatchRegister] element_id 이미지 조회 실패:`, err)
                            }
                          }
                          
                          if (!imageUrl) {
                            imageUrl = partData.part.part_img_url
                            imageSource = 'part_num'
                          }
                          
                          const validElementId = (partData.element_id && 
                            partData.element_id !== 'null' && 
                            partData.element_id !== 'undefined' && 
                            String(partData.element_id).trim() !== '' &&
                            partData.element_id !== 0) 
                            ? String(partData.element_id).trim() 
                            : null
                          
                          const imageResult = await processRebrickableImage(
                            imageUrl,
                            partData.part.part_num,
                            effectiveColorId,
                            { elementId: validElementId, imageSource }
                          )
                          
                          if (imageResult.uploadedUrl) {
                            await saveImageMetadata({
                              original_url: imageUrl,
                              supabase_url: imageResult.uploadedUrl,
                              file_path: imageResult.path,
                              file_name: imageResult.filename || (validElementId ? `${String(validElementId)}.webp` : `${partData.part.part_num}_${effectiveColorId}.webp`),
                              part_num: partData.part.part_num,
                              color_id: effectiveColorId,
                              element_id: validElementId,
                              set_num: setData.set_num
                            })
                          } else if (!imageResult.isDuplicate) {
                            // 프로덕션 모드에서 실패한 이미지 추적
                            console.error(`[BatchRegister] 이미지 업로드 실패 상세:`, {
                              partNum: partData.part.part_num,
                              colorId: effectiveColorId,
                              elementId: validElementId,
                              imageUrl: imageUrl,
                              result: imageResult
                            })
                          }
                        } catch (imageError) {
                          // 프로덕션 모드에서 이미지 업로드 실패 시 상세 로그
                          console.error(`[BatchRegister] 이미지 업로드 중 오류 발생:`, {
                            partNum: partData.part.part_num,
                            colorId: effectiveColorId,
                            elementId: validElementId,
                            imageUrl: imageUrl,
                            error: imageError.message,
                            stack: imageError.stack
                          })
                        }
                      })()
                      
                      imagePromises.push(imagePromise)
                      
                      savedParts.push({
                        part_num: partData.part.part_num,
                        color: partData.color.name,
                        quantity: partData.quantity
                      })
                      
                    } catch (partErr) {
                      console.error(`[BatchRegister] Failed to save part ${partData.part.part_num}:`, partErr)
                      failedParts.push({
                        part_num: partData.part.part_num,
                        color: partData.color.name,
                        error: partErr.message
                      })
                    }
                  })
                )
                
                // 배치 간 대기 (DB 부하 및 Rate Limit 방지)
                if (batchStart + BATCH_SIZE < nonSpareParts.length) {
                  await new Promise(resolve => setTimeout(resolve, 500))
                }
              }
              
              // 이미지 업로드는 백그라운드에서 병렬 처리
              console.log(`[BatchRegister] 이미지 업로드를 백그라운드에서 처리 중... (${imagePromises.length}개)`)
              Promise.allSettled(imagePromises).then(() => {
                console.log(`[BatchRegister] 모든 이미지 업로드 완료`)
              })
              
              // 피규어 저장 (예비부품 아님) - 배치 처리
              if (minifigs && minifigs.length > 0) {
                console.log(`[BatchRegister] 🧸 Starting to save ${minifigs.length} minifigs for set ${setNum}...`)
                
                batchRegisterProgress.value.currentSet = `${setNum} (피규어 저장 중...)`
                
                // 피규어 색상 정보 (모든 피규어 공통)
                const minifigColor = {
                  id: 0,
                  color_id: 0,
                  name: 'Not Applicable',
                  rgb: null,
                  is_trans: false
                }
                const savedColor = await saveLegoColor(minifigColor)
                
                // 피규어 배치 저장
                await Promise.allSettled(
                  minifigs.map(async (minifig) => {
                    try {
                      // 피규어는 부품으로 저장 (part_num은 set_num 사용)
                      const minifigPart = {
                        part_num: minifig.set_num,
                        name: minifig.name || `Minifig ${minifig.set_num}`,
                        part_cat_id: null,
                        part_img_url: minifig.set_img_url || minifig.part_img_url || null
                      }
                      
                      const savedPart = await saveLegoPart(minifigPart)
                      console.log(`[BatchRegister] Minifig part saved: ${savedPart.part_num}`)
                      
                      // 세트-피규어 관계 저장
                      const savedSetPart = await saveSetPart(
                        savedSet.id,
                        savedPart.part_num,
                        savedColor.color_id,
                        minifig.quantity || 1,
                        false, // 예비부품 아님
                        null, // element_id 없음
                        minifig.num_sets || 1
                      )
                      
                      // 진행률 업데이트
                      batchRegisterProgress.value.currentSetSavedParts++
                      
                      console.log(`[BatchRegister] Set-minifig relationship saved for ${minifig.set_num}:`, savedSetPart)
                      
                      // 피규어 이미지 업로드 (백그라운드)
                      const minifigImageUrl = minifig.set_img_url || minifig.part_img_url
                      if (minifigImageUrl) {
                        (async () => {
                          try {
                            const imageResult = await processRebrickableImage(
                              minifigImageUrl,
                              savedPart.part_num,
                              savedColor.color_id,
                              { elementId: null, imageSource: 'minifig' }
                            )
                            
                            if (imageResult.uploadedUrl) {
                              await saveImageMetadata({
                                original_url: minifigImageUrl,
                                supabase_url: imageResult.uploadedUrl,
                                file_path: imageResult.path,
                                file_name: imageResult.filename || `${savedPart.part_num}_${savedColor.color_id}.webp`,
                                part_num: savedPart.part_num,
                                color_id: savedColor.color_id,
                                element_id: null,
                                set_num: setData.set_num
                              })
                            }
                          } catch (imageError) {
                            console.warn(`[BatchRegister] Image upload failed for minifig ${minifig.set_num}:`, imageError)
                          }
                        })()
                      }
                      
                      savedParts.push({
                        part_num: minifig.set_num,
                        color: 'Minifig',
                        quantity: minifig.quantity || 1
                      })
                      
                    } catch (minifigErr) {
                      console.error(`[BatchRegister] Failed to save minifig ${minifig.set_num}:`, minifigErr)
                      failedParts.push({
                        part_num: minifig.set_num,
                        color: 'Minifig',
                        error: minifigErr.message
                      })
                    }
                  })
                )
                
                const savedMinifigsCount = savedParts.filter(p => p.color === 'Minifig').length
                const failedMinifigsCount = failedParts.filter(p => p.color === 'Minifig').length
                console.log(`[BatchRegister] 피규어 저장 완료: 성공 ${savedMinifigsCount}개, 실패 ${failedMinifigsCount}개`)
              } else {
                console.log(`[BatchRegister] 세트 ${setNum}에 피규어 없음 (minifigs.length: ${minifigs?.length || 0})`)
              }
              
              const regularPartsCount = savedParts.filter(p => p.color !== 'Minifig').length
              const minifigsCount = savedParts.filter(p => p.color === 'Minifig').length
              console.log(`[BatchRegister] 세트 ${setNum} 저장 완료 - 성공: ${savedParts.length}개 (일반부품: ${regularPartsCount}개, 피규어: ${minifigsCount}개), 실패: ${failedParts.length}개`)
              
              // 🤖 백그라운드 LLM 분석 + CLIP 임베딩 자동화 (단일 등록과 동일)
              if (!skipLLMAnalysis.value && savedParts.length > 0) {
                console.log(`🤖 백그라운드 LLM 분석 + CLIP 임베딩 자동화 시작 (${savedParts.length}개 부품)`)
                const taskId = await startBackgroundAnalysis(setData, parts)
                console.log(`📋 Background task started: ${taskId}`)
              } else if (skipLLMAnalysis.value) {
                console.log(`⚡ LLM 분석 건너뛰기 (빠른 저장 모드)`)
              }

              // 3. 작업 로그 저장 (단일 등록과 동일)
              await saveOperationLog({
                operation_type: 'set_import',
                target_type: 'set',
                target_id: savedSet.id,
                status: savedParts.length === parts.length ? 'success' : 'partial_success',
                message: `세트 ${setData.set_num} 저장 완료. 성공: ${savedParts.length}개, 실패: ${failedParts.length}개`,
                metadata: {
                  set_num: setData.set_num,
                  total_parts: parts.length,
                  saved_parts: savedParts.length,
                  failed_parts: failedParts.length,
                  failed_details: failedParts
                }
              })

              results.success.push({ 
                setNum, 
                name: setData.name, 
                savedParts: savedParts.length,
                failedParts: failedParts.length
              })
              
            } catch (setSaveError) {
              console.error(`[BatchRegister] 세트 ${setNum} 저장 실패:`, setSaveError)
              results.failed.push({ 
                setNum, 
                reason: setSaveError.message || '세트 저장 실패' 
              })
            }

          } catch (setError) {
            console.error(`세트 ${setNum} 등록 실패:`, setError)
            results.failed.push({ 
              setNum, 
              reason: setError.message || '알 수 없는 오류' 
            })
          }
        }

        // 결과 요약
        const summary = `일괄 등록 완료:\n` +
          `✅ 성공: ${results.success.length}개\n` +
          `❌ 실패: ${results.failed.length}개\n` +
          `⏭️ 건너뜀: ${results.skipped.length}개`
        
        if (results.failed.length > 0) {
          const failedList = results.failed.map(f => `  - ${f.setNum}: ${f.reason}`).join('\n')
          error.value = `${summary}\n\n실패한 세트:\n${failedList}`
        } else {
          successMessage.value = summary
        }

        console.log('일괄 등록 결과:', results)

      } catch (err) {
        console.error('일괄 등록 중 오류:', err)
        error.value = `일괄 등록 중 오류가 발생했습니다: ${err.message}`
      } finally {
        batchProcessing.value = false
        batchRegisterProgress.value = { 
          current: 0, 
          total: 0, 
          currentSet: '', 
          currentSetName: '', 
          currentSetParts: 0, 
          currentSetSavedParts: 0 
        }
      }
    }

    // 피규어 정보만 등록 함수
    const registerMinifigsOnly = async () => {
      const confirmMessage = `저장된 모든 세트의 피규어 정보를 일괄 등록하시겠습니까?\n\n이 작업은 시간이 걸릴 수 있습니다.`
      
      if (!confirm(confirmMessage)) {
        return
      }

      try {
        minifigOnlyProcessing.value = true
        minifigOnlyProgress.value = { current: 0, total: 0, currentSet: '' }
        error.value = ''
        successMessage.value = ''

        // 저장된 모든 세트 목록 가져오기
        console.log('[MinifigOnly] 저장된 세트 목록 조회 중...')
        let allSets = []
        let page = 1
        const pageSize = 100
        
        while (true) {
          const sets = await getLegoSets(page, pageSize)
          if (!sets || sets.length === 0) break
          allSets = [...allSets, ...sets]
          if (sets.length < pageSize) break
          page++
        }

        console.log(`[MinifigOnly] 총 ${allSets.length}개 세트 발견`)

        if (allSets.length === 0) {
          error.value = '저장된 세트가 없습니다.'
          return
        }

        minifigOnlyProgress.value.total = allSets.length

        const results = {
          success: [],
          failed: [],
          skipped: []
        }

        // 피규어 색상 정보 (모든 피규어 공통)
        const minifigColor = {
          id: 0,
          color_id: 0,
          name: 'Not Applicable',
          rgb: null,
          is_trans: false
        }
        const savedColor = await saveLegoColor(minifigColor)

        for (let i = 0; i < allSets.length; i++) {
          const savedSet = allSets[i]
          minifigOnlyProgress.value.current = i + 1
          minifigOnlyProgress.value.currentSet = savedSet.set_num

          try {
            // Rate Limit 방지: API 호출 간 딜레이
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1100))
            }

            // 피규어 정보 가져오기
            const minifigsResult = await getSetMinifigs(savedSet.set_num)
            const minifigs = minifigsResult?.results || []

            if (minifigs.length === 0) {
              console.log(`[MinifigOnly] 세트 ${savedSet.set_num}에 피규어 없음`)
              results.skipped.push({ 
                setNum: savedSet.set_num, 
                reason: '피규어 없음' 
              })
              continue
            }

            console.log(`[MinifigOnly] 세트 ${savedSet.set_num}: ${minifigs.length}개 피규어 발견`)

            // 피규어 배치 저장
            const savedMinifigs = []
            const failedMinifigs = []

            await Promise.allSettled(
              minifigs.map(async (minifig) => {
                try {
                  // 피규어는 부품으로 저장 (part_num은 set_num 사용)
                  const minifigPart = {
                    part_num: minifig.set_num,
                    name: minifig.name || `Minifig ${minifig.set_num}`,
                    part_cat_id: null,
                    part_img_url: minifig.set_img_url || minifig.part_img_url || null
                  }
                  
                  const savedPart = await saveLegoPart(minifigPart)
                  
                  // 세트-피규어 관계 저장 (중복 체크)
                  await saveSetPart(
                    savedSet.id,
                    savedPart.part_num,
                    savedColor.color_id,
                    minifig.quantity || 1,
                    false, // 예비부품 아님
                    null, // element_id 없음
                    minifig.num_sets || 1
                  )
                  
                  // 피규어 이미지 업로드 (백그라운드)
                  const minifigImageUrl = minifig.set_img_url || minifig.part_img_url
                  if (minifigImageUrl) {
                    (async () => {
                      try {
                        const imageResult = await processRebrickableImage(
                          minifigImageUrl,
                          savedPart.part_num,
                          savedColor.color_id,
                          { elementId: null, imageSource: 'minifig' }
                        )
                        
                        if (imageResult.uploadedUrl) {
                          await saveImageMetadata({
                            original_url: minifigImageUrl,
                            supabase_url: imageResult.uploadedUrl,
                            file_path: imageResult.path,
                            file_name: imageResult.filename || `${savedPart.part_num}_${savedColor.color_id}.webp`,
                            part_num: savedPart.part_num,
                            color_id: savedColor.color_id,
                            element_id: null,
                            set_num: savedSet.set_num
                          })
                        }
                      } catch (imageError) {
                        console.warn(`[MinifigOnly] Image upload failed for minifig ${minifig.set_num}:`, imageError)
                      }
                    })()
                  }
                  
                  savedMinifigs.push({
                    part_num: minifig.set_num,
                    name: minifig.name
                  })
                  
                } catch (minifigErr) {
                  console.error(`[MinifigOnly] Failed to save minifig ${minifig.set_num}:`, minifigErr)
                  failedMinifigs.push({
                    part_num: minifig.set_num,
                    error: minifigErr.message
                  })
                }
              })
            )

            if (savedMinifigs.length > 0) {
              results.success.push({ 
                setNum: savedSet.set_num, 
                minifigsCount: savedMinifigs.length 
              })
            }
            if (failedMinifigs.length > 0) {
              results.failed.push({ 
                setNum: savedSet.set_num, 
                reason: `${failedMinifigs.length}개 피규어 저장 실패` 
              })
            }

          } catch (setError) {
            console.error(`[MinifigOnly] 세트 ${savedSet.set_num} 처리 실패:`, setError)
            results.failed.push({ 
              setNum: savedSet.set_num, 
              reason: setError.message || '알 수 없는 오류' 
            })
          }
        }

        // 결과 요약
        const summary = `피규어 정보 등록 완료:\n` +
          `✅ 성공: ${results.success.length}개 세트\n` +
          `❌ 실패: ${results.failed.length}개 세트\n` +
          `⏭️ 건너뜀: ${results.skipped.length}개 세트`
        
        if (results.failed.length > 0) {
          const failedList = results.failed.map(f => `  - ${f.setNum}: ${f.reason}`).join('\n')
          error.value = `${summary}\n\n실패한 세트:\n${failedList}`
        } else {
          successMessage.value = summary
        }

        console.log('[MinifigOnly] 피규어 정보 등록 결과:', results)

      } catch (err) {
        console.error('[MinifigOnly] 피규어 정보 등록 중 오류:', err)
        error.value = `피규어 정보 등록 중 오류가 발생했습니다: ${err.message}`
      } finally {
        minifigOnlyProcessing.value = false
        minifigOnlyProgress.value = { current: 0, total: 0, currentSet: '' }
      }
    }

    // 배치 처리 함수 (새로운 빠른 저장)
    const saveSetBatch = async () => {
      if (!selectedSet.value || !setParts.value.length) {
        console.error('No set or parts selected')
        return
      }

      try {
        saving.value = true
        successMessage.value = ''

        console.log(`Starting batch save process for set ${selectedSet.value.set_num}...`)
        console.log(`Parts to save: ${setParts.value.length}`)

        // 중복 세트 체크
        const existingSet = await checkSetExists(selectedSet.value.set_num)
        let missingOnly = false
        
        if (existingSet) {
          // 중복 세트 처리 모달 표시
          const userChoice = await showDuplicateSetModal(existingSet, selectedSet.value)
          
          if (userChoice === 'cancel') {
            console.log('User cancelled duplicate set replacement')
            successMessage.value = '중복 세트 등록이 취소되었습니다.'
            return
          }
          
          let shouldRegenerateLLM = false
          if (userChoice === 'replace') {
            // 기존 세트 삭제 (LLM 분석 데이터는 기본적으로 유지)
            console.log('Deleting existing set and all related data...')
            const deleteSuccess = await deleteSetAndParts(existingSet.id, existingSet.set_num, shouldRegenerateLLM)
            if (!deleteSuccess) {
              throw new Error('기존 세트 삭제에 실패했습니다.')
            }
            
            // LLM 분석 재생성 플래그 설정 (기본값: 유지)
            skipLLMAnalysis.value = true // LLM 분석 건너뛰기 (기존 데이터 유지)
            
            successMessage.value = '기존 세트 데이터를 삭제했습니다. 새 데이터를 저장합니다...'
          } else if (userChoice === 'missing') {
            // 누락 부품만 등록 모드
            missingOnly = true
            console.log('Missing parts only mode - will add only missing parts')
            // 기존 세트는 삭제하지 않음
          }
        }

        // 예비부품 필터링 및 피규어 추가
        const nonSpareParts = setParts.value.filter(part => !part.is_spare)
        
        // 피규어를 부품 형태로 변환
        const minifigParts = (setMinifigs.value || []).map(minifig => ({
          part: {
            part_num: minifig.set_num,
            name: minifig.name || `Minifig ${minifig.set_num}`,
            part_cat_id: null,
            part_img_url: minifig.set_img_url || minifig.part_img_url || null
          },
          color: {
            id: 0,
            color_id: 0,
            name: 'Not Applicable',
            rgb: null,
            is_trans: false
          },
          quantity: minifig.quantity || 1,
          is_spare: false,
          element_id: null
        }))
        
        // 누락 부품만 등록 모드인 경우 기존 부품 확인
        let partsToSave = [...nonSpareParts, ...minifigParts]
        if (missingOnly && existingSet) {
          try {
            console.log('📦 누락 부품만 등록 모드: 기존 부품 확인 중...')
            const { data: existingSetParts } = await supabase
              .from('set_parts')
              .select('part_id, color_id, element_id')
              .eq('set_id', existingSet.id)
            
            if (existingSetParts && existingSetParts.length > 0) {
              // 기존 부품 키 생성 (part_id + color_id + element_id 조합)
              const existingPartKeys = new Set(
                existingSetParts.map(sp => 
                  `${sp.part_id}_${sp.color_id}_${sp.element_id || 'null'}`
                )
              )
              
              // 누락된 부품만 필터링
              const missingRegularParts = nonSpareParts.filter(part => {
                const partKey = `${part.part.id}_${part.color.id}_${part.element_id || 'null'}`
                return !existingPartKeys.has(partKey)
              })
              
              console.log(`📦 누락 부품 필터링 완료: 전체 ${nonSpareParts.length}개 중 ${missingRegularParts.length}개 누락`)
              
              // 이미지가 없는 부품만 추가 필터링
              console.log('🖼️ 이미지가 없는 부품만 필터링 중...')
              const partsWithoutImage = []
              for (const part of missingRegularParts) {
                let hasImage = false
                
                try {
                  if (part.element_id) {
                    const imageCheck = await checkPartImageDuplicateByElementId(part.element_id)
                    hasImage = imageCheck && (imageCheck === true || (typeof imageCheck === 'object' && imageCheck.exists === true))
                  } else {
                    hasImage = await checkPartImageDuplicate(part.part.part_num, part.color.id)
                  }
                  
                  if (!hasImage) {
                    partsWithoutImage.push(part)
                    console.log(`🖼️ 이미지 없는 부품: ${part.part.part_num} (color: ${part.color.id}, element: ${part.element_id || '없음'})`)
                  } else {
                    console.log(`✅ 이미지 있는 부품 스킵: ${part.part.part_num} (color: ${part.color.id}, element: ${part.element_id || '없음'})`)
                  }
                } catch (imageCheckErr) {
                  console.warn(`⚠️ 이미지 확인 실패, 부품 포함: ${part.part.part_num}`, imageCheckErr)
                  // 확인 실패 시 포함 (안전하게 처리)
                  partsWithoutImage.push(part)
                }
              }
              
              partsToSave = [...partsWithoutImage, ...minifigParts]
              console.log(`🖼️ 이미지 없는 부품 필터링 완료: ${missingRegularParts.length}개 중 ${partsWithoutImage.length}개 이미지 없음`)
            } else {
              console.log('📦 기존 부품이 없어 전체 부품 등록')
            }
          } catch (err) {
            console.warn('⚠️ 기존 부품 확인 실패, 전체 부품 등록:', err)
            partsToSave = [...nonSpareParts, ...minifigParts]
          }
        }
        console.log(`🔍 배치 저장: 일반 부품 ${nonSpareParts.length}개 (예비부품 제외) + 피규어 ${minifigParts.length}개 = 총 ${partsToSave.length}개`)
        
        // 배치 처리 실행
        const result = await batchProcessSet(selectedSet.value, partsToSave)

        console.log(`Batch processing completed:`, result)

        // 백그라운드 LLM 분석 시작
        console.log(`🔍 skipLLMAnalysis.value = ${skipLLMAnalysis.value}`)
        console.log(`🔍 result.totalParts = ${result.totalParts}`)
        
        // ✅ 최적화: 이미지 마이그레이션과 LLM 분석 분리 (독립 실행)
        const { triggerFullMigration } = useAutoImageMigration()
        
    // ✅ 이미지 마이그레이션은 항상 실행 (백그라운드, 강제 재업로드)
    if (result.totalParts > 0) {
      console.log(`🖼️ 백그라운드 이미지 마이그레이션 시작 (강제 업로드)...`)
      
      // 캐시 초기화 후 강제 재업로드
      const { clearCache } = useAutoImageMigration()
      clearCache()
      console.log(`🧹 이미지 마이그레이션 캐시 초기화 완료`)
      
      triggerFullMigration({ force: true }) // 강제 재업로드 옵션 추가
        .then(migrationResult => {
          console.log(`✅ 이미지 마이그레이션 완료:`, migrationResult)
        })
        .catch(migrationError => {
          console.warn(`⚠️ 이미지 마이그레이션 실패: ${migrationError.message}`)
          alertMigrationFailed(
            selectedSet.value.set_num,
            { uploaded: 0, total: result.totalParts || 0 },
            migrationError.message
          )
        })
    }
        
        // ✅ LLM 분석은 조건부 실행
        if (!skipLLMAnalysis.value && result.totalParts > 0) {
          console.log(`🤖 백그라운드 LLM 분석 시작...`)
          const taskId = await startBackgroundAnalysis(selectedSet.value, setParts.value)
          console.log(`📋 Background LLM task started: ${taskId}`)
          successMessage.value = `세트 저장 완료! 백그라운드에서 이미지 마이그레이션과 LLM 분석을 진행합니다. (작업 ID: ${taskId})`
        } else if (skipLLMAnalysis.value) {
          console.log(`⚡ LLM 분석 건너뛰기 (빠른 저장 모드)`)
          successMessage.value = `세트 저장 완료! 백그라운드에서 이미지 마이그레이션을 진행합니다.`
        } else {
          console.log(`⚠️ 부품이 저장되지 않아 LLM 분석 건너뜀`)
          successMessage.value = `세트 저장 완료!`
        }

        // 작업 로그 저장
        await saveOperationLog({
          operation_type: 'set_import',
          target_type: 'set',
          target_id: result.set.id,
          status: 'success',
          message: `세트 ${selectedSet.value.set_num} 배치 저장 완료. 총 부품: ${result.totalParts}개, 관계: ${result.insertedRelationships}개`,
          metadata: {
            set_num: selectedSet.value.set_num,
            total_parts: result.totalParts,
            inserted_relationships: result.insertedRelationships,
            set_image: result.setImage
          }
        })

        console.log(`Batch save completed: ${result.totalParts} parts, ${result.insertedRelationships} relationships`)
        
      } catch (err) {
        console.error('Batch save failed:', err)
        error.value = `저장 실패: ${err.message}`
      } finally {
        saving.value = false
      }
    }

    // 기존 buildMasterDataForSet 함수는 백그라운드 작업으로 대체됨

    // 백그라운드 작업 상태
    const runningTasks = computed(() => getRunningTasks())
    const llmRunningTasks = computed(() => getLLMRunningTasks())
    const queueStatus = computed(() => getQueueStatus())

    // 중지 상태
    const isStopping = ref(false)
    
    // 모달 관련 함수들
    const closeProgressModal = () => {
      // 실행 중인 작업이 있으면 확인 후 닫기
      if (runningTasks.value.length > 0) {
        const hasRunning = runningTasks.value.some(t => t.status === 'running')
        if (hasRunning) {
          if (!confirm('진행 중인 작업이 있습니다. 정말 닫으시겠습니까? (작업은 백그라운드에서 계속 진행됩니다)')) {
            return
          }
        }
      }
      showProgressModal.value = false
    }
    
    // 모달 닫기 (오버레이 클릭 시)
    const handleCloseModal = () => {
      closeProgressModal()
    }
    
    // 개별 작업 중지
    const handleStopTask = (taskId) => {
      if (confirm('이 작업을 중지하시겠습니까?')) {
        const success = cancelTask(taskId)
        if (success) {
          console.log(`작업 ${taskId} 중지됨`)
        }
      }
    }
    
    // 모든 작업 중지
    const handleStopAllTasks = () => {
      if (confirm('모든 진행 중인 작업을 중지하시겠습니까?')) {
        isStopping.value = true
        runningTasks.value.forEach(task => {
          if (task.status === 'running') {
            cancelTask(task.id)
          }
        })
        setTimeout(() => {
          isStopping.value = false
        }, 1000)
      }
    }
    
    // 중복 세트 모달 닫기
    const handleCloseDuplicateModal = () => {
      if (duplicateSetInfo.value.resolve) {
        duplicateSetInfo.value.resolve('cancel')
        duplicateSetInfo.value.resolve = null
      }
      showDuplicateModal.value = false
    }
    
    // 중복 세트 처리 옵션 선택
    const handleDuplicateOption = (option) => {
      if (duplicateSetInfo.value.resolve) {
        duplicateSetInfo.value.resolve(option)
        duplicateSetInfo.value.resolve = null
      }
      showDuplicateModal.value = false
    }
    
    // 중복 세트 처리 모달 표시 (Promise 반환)
    const showDuplicateSetModal = (existingSet, newSet) => {
      return new Promise((resolve) => {
        duplicateSetInfo.value = {
          existingName: existingSet.name || '',
          existingSetNum: existingSet.set_num || '',
          existingDate: existingSet.created_at 
            ? new Date(existingSet.created_at).toLocaleDateString('ko-KR')
            : '',
          existingParts: existingSet.num_parts || 0,
          newName: newSet.name || '',
          newSetNum: newSet.set_num || '',
          newParts: newSet.num_parts || 0,
          existingSet: existingSet,
          resolve: resolve
        }
        showDuplicateModal.value = true
      })
    }

    // 모달 표시 조건
    const shouldShowModal = computed(() => {
      return batchLoading.value || 
             batchProcessing.value ||
             (!skipLLMAnalysis.value && masterDataProgress.value > 0) ||
             runningTasks.value.length > 0 ||
             llmRunningTasks.value.length > 0
    })

    // 모달 표시 상태 감시 (자동 닫힘 방지)
    watch(shouldShowModal, (newValue) => { // // 🔧 수정됨
      if (newValue) {
        showProgressModal.value = true
      }
      // false일 때는 사용자가 X 버튼으로 닫을 때까지 유지
    }, { immediate: true })

    return {
      searchQuery,
      searchResults,
      selectedSet,
      setParts,
      loading,
      loadingParts,
      downloading,
      saving,
      error,
      successMessage,
      isLocalData,
      partsCountValidation,
      verifyRegistration,
      registrationVerification,
      partsStats,
      categorizedParts,
      skipLLMAnalysis,
      masterDataProgress,
      processing,
      showProgressModal,
      showDuplicateModal,
      duplicateSetInfo,
      handleCloseModal,
      handleCloseDuplicateModal,
      handleDuplicateOption,
      handleStopTask,
      handleStopAllTasks,
      isStopping,
      searchSets,
      selectSet,
      loadSetParts,
      downloadPartImage,
      downloadAllPartImages,
      saveSetToDatabase,
      saveSetBatch,
      forceResaveSet,
      exportPartsData,
      handleImageError,
      runningTasks,
      llmRunningTasks,
      queueStatus,
      batchLoading,
      batchProgress,
      batchCurrentStep,
      batchError,
      handleSearchOrBatch,
      batchRegisterSets,
      registerMinifigsOnly,
      hasMultipleSetNumbers,
      batchProcessing,
      minifigOnlyProcessing,
      minifigOnlyProgress,
      batchRegisterProgress,
      isSingleSetNumber,
      formatSetNumber,
      calculatePartsTotal,
      validatePartsCount,
      calculatePartsStats,
      categorizeParts,
      setMinifigs,
      getPartImageUrl
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

.batch-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.batch-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.batch-btn:disabled {
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

.set-card.existing-set {
  border: 2px solid #ffc107;
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
}

.set-card.existing-set:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(255, 193, 7, 0.3);
}

.set-image {
  height: 200px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  position: relative;
}

.set-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.duplicate-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 193, 7, 0.9);
  color: #856404;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.duplicate-icon {
  font-size: 0.8rem;
}

.duplicate-text {
  white-space: nowrap;
}

.duplicate-info {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 193, 7, 0.1);
  border-radius: 6px;
  border-left: 3px solid #ffc107;
}

.duplicate-date {
  font-size: 0.8rem;
  color: #856404;
  margin: 0;
  font-weight: 500;
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
  display: flex;
  flex-direction: column;
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

.part-card .part-info {
  display: block !important;
  width: 100% !important;
  margin-top: 0.5rem !important;
  visibility: visible !important;
  opacity: 1 !important;
  height: auto !important;
  min-height: auto !important;
  overflow: visible !important;
}

.part-card .part-info h4 {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  color: #333;
  display: block !important;
}

.part-card .part-info p {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
  display: block !important;
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

.part-actions {
  margin-top: 0.5rem;
}

.spare-part {
  color: #856404;
  background: rgba(255, 193, 7, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: inline-block;
}


.spare-info {
  color: #856404;
  font-weight: 600;
}

.validation-info {
  font-weight: 600;
  font-size: 0.9rem;
  margin-left: 0.5rem;
}

.validation-info.match {
  color: #28a745;
}

.validation-info.mismatch {
  color: #dc3545;
}

.parts-category {
  margin-bottom: 2rem;
}

.category-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.minifig-title {
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
  color: white;
  border: 2px solid #ff5252;
}

.spare-title {
  background: linear-gradient(135deg, #ffc107 0%, #ffd54f 100%);
  color: #856404;
  border: 2px solid #ffb300;
}

.regular-title {
  background: linear-gradient(135deg, #4fc3f7 0%, #81d4fa 100%);
  color: #01579b;
  border: 2px solid #29b6f6;
}

.minifig-card {
  border: 2px solid #ff6b6b;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%);
}

.minifig-link {
  color: #ff6b6b;
  text-decoration: none;
  font-weight: bold;
}

.minifig-link:hover {
  color: #e53e3e;
  text-decoration: underline;
}

.no-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 1rem;
}

.no-image-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.7;
}

.no-image-text {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
  text-align: center;
}

.spare-card {
  border: 2px solid #ffc107;
  background: linear-gradient(135deg, #fffbf0 0%, #fff3cd 100%);
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

/* 마스터 데이터 구축 옵션 스타일 */
.master-data-option {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  color: #495057;
}

.checkbox-label input[type="checkbox"] {
  margin-right: 0.5rem;
  transform: scale(1.2);
}

.form-help {
  display: block;
  margin-top: 0.5rem;
  color: #6c757d;
  font-size: 0.875rem;
}

/* 마스터 데이터 진행률 스타일 */
.master-data-progress {
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.master-data-progress h4 {
  margin: 0 0 0.5rem 0;
  color: #1976d2;
}

.master-data-progress .progress {
  position: relative;
  background: #f5f5f5;
  border-radius: 4px;
  height: 24px;
  margin: 0.5rem 0;
}

.master-data-progress .progress-bar {
  background: linear-gradient(90deg, #2196f3, #21cbf3);
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.master-data-progress .progress span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
}

.background-tasks {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.background-tasks h4 {
  margin: 0 0 1rem 0;
  color: #495057;
}

.task-item {
  margin-bottom: 1.5rem;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.task-item:last-child {
  margin-bottom: 0;
}

/* 레고 제품 정보 스타일 */
.lego-product-info {
  margin-bottom: 12px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.product-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #212529;
}

.product-number {
  font-size: 0.875rem;
  color: #6c757d;
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.product-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-item {
  font-size: 0.875rem;
  color: #495057;
}

.stat-item strong {
  color: #212529;
  margin-right: 4px;
}

.task-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.task-name {
  font-weight: 600;
  color: #495057;
}

.task-progress {
  font-size: 0.9rem;
  color: #6c757d;
}

.task-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.task-stop-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.task-stop-btn:hover:not(:disabled) {
  background: #c82333;
}

.task-stop-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.task-status {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.875rem;
}

.task-status.cancelled {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.task-status.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  transition: width 0.3s ease;
}

/* 피규어 정보만 등록 버튼 스타일 */
.minifig-only-option {
  margin-top: 1rem;
  padding: 1rem;
  background: #fff5f5;
  border-radius: 8px;
  border: 1px solid #ffd6d6;
}

.minifig-only-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
}

.minifig-only-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #ee5a6f 0%, #ff6b6b 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(255, 107, 107, 0.4);
}

.minifig-only-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 배치 처리 진행률 스타일 */
.batch-processing-progress {
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #e8f5e8, #f0f8f0);
  border-radius: 8px;
  border: 1px solid #c8e6c9;
}

.batch-processing-progress h4 {
  margin: 0 0 15px 0;
  color: #2e7d32;
  font-weight: 600;
}

.batch-processing-progress .progress {
  position: relative;
  background: #f5f5f5;
  border-radius: 4px;
  height: 24px;
  margin: 0.5rem 0;
}

.batch-processing-progress .progress-bar {
  background: linear-gradient(90deg, #4caf50, #2e7d32);
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.batch-processing-progress .progress span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
}

.processing-errors {
  margin-top: 8px;
  padding: 6px 8px;
  background: #ffebee;
  border-radius: 4px;
  border-left: 3px solid #f44336;
}

.processing-errors small {
  color: #d32f2f;
  font-weight: 500;
}

/* LLM 백그라운드 작업 스타일 */
.llm-background-tasks {
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
  border-radius: 8px;
  border: 1px solid #bbdefb;
}

.llm-background-tasks h4 {
  margin: 0 0 15px 0;
  color: #3f51b5;
  font-weight: 600;
}

.queue-status {
  margin-bottom: 15px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  font-size: 0.9em;
  color: #424242;
  text-align: center;
}

.llm-task-item {
  margin-bottom: 12px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #c5cae9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.llm-task-item .task-name {
  color: #3f51b5;
  font-weight: 600;
}

.llm-task-item .task-progress {
  color: #5c6bc0;
}

.llm-task-item .progress-fill {
  background: linear-gradient(90deg, #3f51b5, #1a237e);
}

.task-errors {
  margin-top: 8px;
  padding: 6px 8px;
  background: #ffebee;
  border-radius: 4px;
  border-left: 3px solid #f44336;
}

.task-errors small {
  color: #d32f2f;
  font-weight: 500;
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

/* 진행률 모달 스타일 */
.progress-modal-overlay {
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

.progress-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.progress-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e5e9;
}

.progress-modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.modal-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f5f5f5;
}

.stop-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.stop-btn:hover:not(:disabled) {
  background: #c82333;
}

.stop-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.progress-modal-content {
  padding: 24px;
}

.progress-section {
  margin-bottom: 24px;
}

.progress-section:last-child {
  margin-bottom: 0;
}

.progress-section h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
}

.queue-status {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 0.9rem;
  color: #6c757d;
}

/* 중복 세트 처리 모달 스타일 */
.duplicate-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.duplicate-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.duplicate-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e5e9;
}

.duplicate-modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.duplicate-modal-content {
  padding: 24px;
}

.duplicate-info {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.duplicate-info h4 {
  margin: 0 0 12px 0;
  color: #495057;
  font-size: 1rem;
  font-weight: 600;
}

.info-item {
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #6c757d;
}

.info-item strong {
  color: #212529;
  margin-right: 8px;
}

.duplicate-options {
  margin-top: 24px;
}

.duplicate-options h4 {
  margin: 0 0 16px 0;
  color: #495057;
  font-size: 1rem;
  font-weight: 600;
}

.option-btn {
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 12px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.option-btn:last-child {
  margin-bottom: 0;
}

.missing-btn {
  background: #e7f3ff;
  color: #0066cc;
  border: 2px solid #b3d9ff;
}

.missing-btn:hover {
  background: #d0e7ff;
  border-color: #80c1ff;
}

.replace-btn {
  background: #fff3cd;
  color: #856404;
  border: 2px solid #ffeaa7;
}

.replace-btn:hover {
  background: #ffe69c;
  border-color: #ffd43b;
}

.cancel-btn {
  background: #f8d7da;
  color: #721c24;
  border: 2px solid #f5c6cb;
}

.cancel-btn:hover {
  background: #f1b0b7;
  border-color: #f5c6cb;
}
</style>
