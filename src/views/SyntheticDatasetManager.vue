<template>
  <div class="synthetic-dataset-manager">
    <!-- 헤더 -->
    <div class="header">
      <h1>🧱 BrickBox 합성 데이터셋 관리</h1>
      <p>LDraw + Blender + Supabase 기반 자동 렌더링 파이프라인</p>
    </div>

    <!-- 탭 네비게이션 -->
    <div class="tab-navigation">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="['tab-button', { active: activeTab === tab.id }]"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
      </button>
    </div>

    <!-- 탭 컨텐츠 -->
    <div class="tab-content">
      <!-- 1. 설정 탭 -->
      <div v-if="activeTab === 'settings'" class="tab-panel">
        <div class="panel-header">
          <h2>⚙️ 시스템 설정</h2>
          <p>렌더링 및 학습 설정을 구성합니다</p>
        </div>

        <!-- 스키마 정보 -->
        <div class="info-card">
          <h3>📋 데이터 스키마 정보</h3>
          <div class="schema-details">
            <div class="schema-item">
              <span class="schema-label">어노테이션 스키마:</span>
              <span class="schema-value">v1.6.1</span>
              <small>3D 품질 지표, Occlusion 자동 산출 지원</small>
            </div>
            <div class="schema-item">
              <span class="schema-label">품질 기준:</span>
              <span class="schema-value">
                SSIM ≥0.96 | SNR ≥30dB | Reprojection ≤1.5px | Depth Score ≥0.85
              </span>
              <small>기술문서 3.1절, 어노테이션 6절 준수</small>
            </div>
            <div class="schema-item">
              <span class="schema-label">이미지 형식:</span>
              <span class="schema-value">
                PNG 무손실 렌더링 (SNR/선명도 보장) | EXR 깊이 맵 (ZIP 압축)
              </span>
              <small>기술문서 2.4절 준수</small>
            </div>
          </div>
        </div>

        <!-- 경로 설정 -->
        <div class="settings-card">
          <h3>📁 합성 데이터셋 경로 설정</h3>
          <div class="settings-controls">
            <div class="setting-item">
              <label class="setting-label">합성 데이터셋 루트 경로</label>
              <div class="path-input-group">
                <input 
                  type="text" 
                  v-model="syntheticRootPath" 
                  placeholder="예: ./output/synthetic 또는 E:/BrickBox/synthetic"
                  class="form-input path-input"
                  @keyup.enter="updatePathSetting"
                >
                <button 
                  @click="updatePathSetting" 
                  :disabled="isUpdatingPath || !syntheticRootPath || syntheticRootPath.trim() === ''"
                  class="btn btn-primary btn-sm"
                >
                  {{ isUpdatingPath ? '저장 중...' : '저장' }}
                </button>
              </div>
              <div class="path-info">
                <p class="info-text">
                  <strong>현재 경로:</strong> {{ currentPath || '로딩 중...' }}
                </p>
                <p class="info-text">
                  <strong>dataset_synthetic:</strong> {{ currentDatasetPath || '로딩 중...' }}
                </p>
                <small class="path-help">
                  절대 경로 권장 (예: E:/BrickBox/synthetic) | 상대 경로도 가능 (예: ./output/synthetic)
                  <br>
                  변경 후 서버 재시작이 필요합니다
                </small>
              </div>
            </div>
          </div>
        </div>

        <!-- 자동 학습 설정 -->
        <div class="settings-card">
          <h3>🤖 자동 학습 설정</h3>
          <div class="settings-controls">
            <div class="setting-item">
              <label class="toggle-label">
                <input 
                  type="checkbox" 
                  v-model="autoTrainingEnabled" 
                  @change="updateAutoTrainingSetting"
                  class="toggle-input"
                >
                <span class="toggle-slider"></span>
                <span class="toggle-text">
                  {{ autoTrainingEnabled ? '자동 학습 활성화' : '자동 학습 비활성화' }}
                </span>
              </label>
            </div>
            <div class="setting-info">
              <p v-if="autoTrainingEnabled" class="info-text enabled">
                ✅ 렌더링 완료 시 자동으로 데이터셋 준비 및 학습이 시작됩니다
              </p>
              <p v-else class="info-text disabled">
                ⏸️ 렌더링 완료 후 수동으로 데이터셋 준비 및 학습을 시작해야 합니다
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 렌더링 탭 -->
      <div v-if="activeTab === 'rendering'" class="tab-panel">
        <div class="panel-header">
          <h2>🎨 렌더링 관리</h2>
          <p>부품 및 세트 렌더링을 시작하고 진행 상황을 모니터링합니다</p>
        </div>

        <!-- 렌더링 컨트롤 -->
        <div class="rendering-controls">
          <div class="control-section">
            <h3>🎯 렌더링 시작</h3>
            <div class="render-options">
              <div class="render-type-selector">
                <label class="radio-label">
                  <input type="radio" v-model="renderType" value="single" class="radio-input">
                  <span class="radio-custom"></span>
                  <span class="radio-text">단일 부품 렌더링</span>
                </label>
                <label class="radio-label">
                  <input type="radio" v-model="renderType" value="set" class="radio-input">
                  <span class="radio-custom"></span>
                  <span class="radio-text">세트 렌더링</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 단일 부품 렌더링 -->
          <div v-if="renderType === 'single'" class="single-part-controls">
            <!-- 검색 타입 선택 -->
            <div class="search-type-selector">
              <label class="radio-label">
                <input type="radio" v-model="searchType" value="partNumber" class="radio-input" @change="onSearchTypeChange">
                <span class="radio-custom"></span>
                <span class="radio-text">부품 번호로 검색</span>
              </label>
              <label class="radio-label">
                <input type="radio" v-model="searchType" value="elementId" class="radio-input" @change="onSearchTypeChange">
                <span class="radio-custom"></span>
                <span class="radio-text">엘리먼트 ID로 검색</span>
              </label>
            </div>

            <!-- 부품 번호 검색 -->
            <div v-if="searchType === 'partNumber'" class="search-inputs">
            <div class="input-group">
              <label>부품 번호</label>
              <input 
                v-model="partNumber" 
                placeholder="예: 3001"
                class="form-input"
              >
            </div>
            <div class="input-group">
              <label>색상 ID</label>
              <input 
                v-model="colorId" 
                placeholder="예: 4 (빨강)"
                class="form-input"
              >
            </div>
            </div>

            <!-- 엘리먼트 ID 검색 -->
            <div v-if="searchType === 'elementId'" class="search-inputs">
              <div class="input-group">
                <label>엘리먼트 ID</label>
                <div class="input-with-button">
                  <input 
                    v-model="elementId" 
                    placeholder="예: 300121"
                    class="form-input"
                    @keyup.enter="searchByElementId"
                  >
                  <button 
                    @click="searchByElementId" 
                    :disabled="!elementId"
                    class="btn btn-secondary btn-sm"
                  >
                    🔍 검색
                  </button>
                </div>
                <small class="input-help">LEGO 엘리먼트 ID를 입력하세요 (예: 300121)</small>
              </div>
              <div class="input-group">
                <label>색상 ID (선택사항)</label>
                <input 
                  v-model="colorId" 
                  placeholder="예: 4 (빨강)"
                  class="form-input"
                >
                <small class="input-help">색상을 지정하지 않으면 기본 색상으로 렌더링됩니다</small>
              </div>
            </div>

            <!-- 검색 결과 표시 -->
            <div v-if="searchResults.length > 0" class="search-results">
              <h4>🔍 검색 결과</h4>
              <div class="results-list">
                <div 
                  v-for="result in searchResults" 
                  :key="result.element_id"
                  class="result-item"
                  @click="selectSearchResult(result)"
                >
                  <div class="result-info">
                    <span class="result-element-id">{{ result.element_id }}</span>
                    <span class="result-part-name">{{ result.part_name }}</span>
                    <span class="result-part-id">부품번호: {{ result.part_id }}</span>
                  </div>
                  <div class="result-actions">
                    <button class="btn btn-sm btn-primary">선택</button>
                  </div>
                </div>
              </div>
            </div>

            <button 
              @click="startSingleRendering" 
              :disabled="isRendering || (!partNumber && !elementId)"
              class="btn btn-primary"
            >
              🎨 단일 부품 렌더링 시작
            </button>
          </div>

          <!-- 세트 렌더링 -->
          <div v-if="renderType === 'set'" class="set-controls">
            <div class="input-group">
              <label>세트 번호</label>
              <input 
                v-model="setNumber" 
                placeholder="예: 10220"
                class="form-input"
              >
            </div>
            <button 
              @click="startSetRendering" 
              :disabled="isRendering || !setNumber"
              class="btn btn-primary"
            >
              🎨 세트 렌더링 시작
            </button>
          </div>
        </div>

        <!-- 렌더링 진행 상황 -->
        <div v-if="isRendering" class="rendering-progress">
          <h3>🔄 렌더링 진행 중</h3>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: renderProgress + '%' }"></div>
          </div>
          <p class="progress-text">{{ renderProgress }}% 완료</p>
          <div class="current-task">
            <p v-if="currentRenderingPart">
              현재 렌더링: {{ currentRenderingPart.partId }} ({{ currentRenderingPart.colorId }})
            </p>
          </div>
          <button @click="stopRendering" class="btn btn-danger">
            ⏹️ 렌더링 중지
          </button>
        </div>

        <!-- 렌더링 로그 -->
        <div class="rendering-logs">
          <h3>📋 렌더링 로그</h3>
          <div class="log-container">
            <div 
              v-for="(log, index) in renderLogs" 
              :key="index"
              :class="['log-entry', log.type]"
            >
              <span class="log-time">{{ new Date().toLocaleTimeString() }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 검증 탭 -->
      <div v-if="activeTab === 'validation'" class="tab-panel">
        <div class="panel-header">
          <h2>🔍 데이터 검증</h2>
          <p>렌더링된 데이터의 품질과 완성도를 검증합니다</p>
        </div>

        <div class="validation-controls">
          <button 
            @click="manualDataValidation" 
            :disabled="isRendering"
            class="btn btn-warning"
          >
            🔍 데이터 검증 실행
          </button>
          <p class="validation-info">
            💡 렌더링된 데이터의 품질과 완성도를 검증합니다
          </p>
        </div>

        <!-- 검증 결과 -->
        <div v-if="validationResults" class="validation-results">
          <!-- 요약 카드 -->
          <div class="validation-summary-cards">
            <div class="summary-card" :class="{ 'card-success': validationResults.success, 'card-error': !validationResults.success }">
              <div class="card-icon">{{ validationResults.success ? '✅' : '❌' }}</div>
              <div class="card-content">
                <div class="card-title">{{ validationResults.success ? '모든 검증 통과' : '검증 문제 발견' }}</div>
                <div class="card-subtitle">
                  {{ validationResults.errors?.length || 0 }}개 오류, {{ validationResults.warnings?.length || 0 }}개 경고
                </div>
              </div>
            </div>
            
            <div class="summary-card card-info">
              <div class="card-icon">📊</div>
              <div class="card-content">
                <div class="card-title">부품 통계</div>
                <div class="card-stats">
                  <span class="stat-badge">총 {{ validationResults.stats?.totalParts || 0 }}개</span>
                  <span class="stat-badge success">유효 {{ validationResults.stats?.validParts || 0 }}개</span>
                  <span class="stat-badge error">무효 {{ validationResults.stats?.invalidParts || 0 }}개</span>
                </div>
              </div>
            </div>
            
            <div class="summary-card card-info">
              <div class="card-icon">📁</div>
              <div class="card-content">
                <div class="card-title">파일 통계</div>
                <div class="card-stats">
                  <span class="stat-badge">이미지 {{ validationResults.stats?.totalImages || 0 }}개</span>
                  <span class="stat-badge">라벨 {{ validationResults.stats?.totalLabels || 0 }}개</span>
                  <span class="stat-badge">메타 {{ validationResults.stats?.totalMetadata || 0 }}개</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 검증 카테고리별 섹션 -->
          <div class="validation-categories">
            <!-- 파일 매칭 검증 -->
            <div class="validation-category" v-if="validationResults.fileMatching">
              <div class="category-header" :class="{ 'has-issues': (validationResults.fileMatching.unmatchedImages?.length > 0 || validationResults.fileMatching.unmatchedLabels?.length > 0) }">
                <div class="category-title">
                  <span class="category-icon">🔗</span>
                  <span>파일 매칭</span>
                  <span class="category-count success">{{ validationResults.fileMatching.matched || 0 }}개 매칭</span>
                </div>
                <div v-if="validationResults.fileMatching.unmatchedImages?.length > 0 || validationResults.fileMatching.unmatchedLabels?.length > 0" class="category-status error">
                  {{ (validationResults.fileMatching.unmatchedImages?.length || 0) + (validationResults.fileMatching.unmatchedLabels?.length || 0) }}개 문제
                </div>
              </div>
              
              <div v-if="validationResults.fileMatching.unmatchedImages?.length > 0 || validationResults.fileMatching.unmatchedLabels?.length > 0" class="category-content">
                <!-- 라벨이 없는 이미지 목록 -->
                <div v-if="validationResults.fileMatching.unmatchedImages && validationResults.fileMatching.unmatchedImages.length > 0" class="issue-section">
                  <div class="issue-header">
                    <span class="issue-icon">📝</span>
                    <span class="issue-title">라벨이 없는 이미지 ({{ validationResults.fileMatching.unmatchedImages.length }}개)</span>
                  </div>
                  <div class="issue-actions">
                    <button 
                      @click="generateMissingLabels('all')" 
                      :disabled="isGeneratingLabels"
                      class="btn-fix-all"
                    >
                      {{ isGeneratingLabels ? '생성 중...' : '모두 생성' }}
                    </button>
                  </div>
                  <div class="issue-list">
                    <div v-for="(imagePath, index) in validationResults.fileMatching.unmatchedImages" :key="index" class="issue-item-action">
                      <span class="issue-path">{{ imagePath }}</span>
                      <button 
                        @click="generateMissingLabels(imagePath)" 
                        :disabled="isGeneratingLabels"
                        class="btn-fix-single"
                      >
                        생성
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- 이미지가 없는 라벨 목록 -->
                <div v-if="validationResults.fileMatching.unmatchedLabels && validationResults.fileMatching.unmatchedLabels.length > 0" class="issue-section">
                  <div class="issue-header">
                    <span class="issue-icon">🖼️</span>
                    <span class="issue-title">이미지가 없는 라벨 ({{ validationResults.fileMatching.unmatchedLabels.length }}개)</span>
                  </div>
                  <div class="issue-list">
                    <div v-for="(labelPath, index) in validationResults.fileMatching.unmatchedLabels" :key="index" class="issue-item">
                      <span class="issue-path">{{ labelPath }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 이미지 검증 -->
            <div class="validation-category" v-if="validationResults.imageValidation">
              <div class="category-header" :class="{ 'has-issues': validationResults.imageValidation.errors?.length > 0 }">
                <div class="category-title">
                  <span class="category-icon">🖼️</span>
                  <span>이미지 파일 검증</span>
                  <span class="category-count success">{{ validationResults.imageValidation.valid || 0 }}개 유효</span>
                </div>
                <div v-if="validationResults.imageValidation.errors?.length > 0" class="category-status error">
                  {{ validationResults.imageValidation.errors.length }}개 오류
                </div>
              </div>
              
              <div v-if="validationResults.imageValidation.errors?.length > 0" class="category-content">
                <div class="issue-section">
                  <div class="issue-header">
                    <span class="issue-icon">⚠️</span>
                    <span class="issue-title">이미지 파일 오류 ({{ validationResults.imageValidation.errors.length }}개)</span>
                  </div>
                  <div class="issue-actions">
                    <button 
                      @click="fixImageErrors('all')" 
                      :disabled="isFixingImages"
                      class="btn-fix-all"
                    >
                      {{ isFixingImages ? '수정 중...' : '모두 수정' }}
                    </button>
                  </div>
                  <div class="issue-list">
                    <div v-for="(errorPath, index) in validationResults.imageValidation.errors" :key="index" class="issue-item-action">
                      <span class="issue-path">{{ errorPath }}</span>
                      <button 
                        @click="fixImageErrors(errorPath)" 
                        :disabled="isFixingImages"
                        class="btn-fix-single"
                      >
                        수정
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 메타데이터 검증 -->
            <div class="validation-category" v-if="validationResults.metadataValidation">
              <div class="category-header" :class="{ 'has-issues': validationResults.metadataValidation.errors?.length > 0 }">
                <div class="category-title">
                  <span class="category-icon">📄</span>
                  <span>메타데이터 JSON 검증</span>
                  <span class="category-count success">{{ validationResults.metadataValidation.valid || 0 }}개 유효</span>
                </div>
                <div v-if="validationResults.metadataValidation.errors?.length > 0" class="category-status error">
                  {{ validationResults.metadataValidation.errors.length }}개 오류
                </div>
              </div>
              
              <div v-if="validationResults.metadataValidation.errors?.length > 0" class="category-content">
                <div class="issue-section">
                  <div class="issue-header">
                    <span class="issue-icon">⚠️</span>
                    <span class="issue-title">JSON 오류 ({{ validationResults.metadataValidation.errors.length }}개)</span>
                  </div>
                  <div class="issue-actions">
                    <button 
                      @click="fixMetadataErrors('all')" 
                      :disabled="isFixingMetadata"
                      class="btn-fix-all"
                    >
                      {{ isFixingMetadata ? '수정 중...' : '모두 수정' }}
                    </button>
                  </div>
                  <div class="issue-list">
                    <div v-for="(errorPath, index) in validationResults.metadataValidation.errors" :key="index" class="issue-item-action">
                      <span class="issue-path">{{ errorPath }}</span>
                      <button 
                        @click="fixMetadataErrors(errorPath)" 
                        :disabled="isFixingMetadata"
                        class="btn-fix-single"
                      >
                        수정
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 이미지 개수 검증 -->
            <div class="validation-category" v-if="validationResults.insufficientImages && validationResults.insufficientImages.length > 0">
              <div class="category-header has-issues">
                <div class="category-title">
                  <span class="category-icon">📊</span>
                  <span>이미지 개수 검증</span>
                  <span class="category-count error">{{ validationResults.insufficientImages.length }}개 부족</span>
                </div>
              </div>
              
              <div class="category-content">
                <div class="issue-section">
                  <div class="issue-header">
                    <span class="issue-icon">⚠️</span>
                    <span class="issue-title">200개 미만 부품 ({{ validationResults.insufficientImages.length }}개)</span>
                  </div>
                  <div class="issue-actions">
                    <button 
                      @click="generateMissingImages('all')" 
                      :disabled="isGeneratingImages"
                      class="btn-fix-all"
                    >
                      {{ isGeneratingImages ? '생성 중...' : '모두 추가 렌더링' }}
                    </button>
                  </div>
                  <div class="issue-list">
                    <div v-for="(item, index) in validationResults.insufficientImages" :key="index" class="issue-item-action">
                      <div class="issue-path">{{ item.partId }}</div>
                      <div class="split-grid">
                        <div class="split-cell">
                          <span class="split-label">train</span>
                          <span class="split-value">{{ item.splits?.train?.current || 0 }}/{{ item.splits?.train?.expected || 0 }} (부족: {{ item.splits?.train?.missing || 0 }})</span>
                        </div>
                        <div class="split-cell">
                          <span class="split-label">val</span>
                          <span class="split-value">{{ item.splits?.val?.current || 0 }}/{{ item.splits?.val?.expected || 0 }} (부족: {{ item.splits?.val?.missing || 0 }})</span>
                        </div>
                        <div class="split-cell">
                          <span class="split-label">test</span>
                          <span class="split-value">{{ item.splits?.test?.current || 0 }}/{{ item.splits?.test?.expected || 0 }} (부족: {{ item.splits?.test?.missing || 0 }})</span>
                        </div>
                        <div class="split-total">
                          <span class="split-label">총합</span>
                          <span class="split-value">{{ item.total?.current || 0 }}/{{ item.total?.expected || 200 }} (부족: {{ item.total?.missing || 0 }})</span>
                        </div>
                      </div>
                      <button 
                        @click="generateMissingImages(item)" 
                        :disabled="isGeneratingImages"
                        class="btn-fix-single"
                      >
                        추가 렌더링
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 이미지 품질 검증 (WebP/PNG) -->
            <div class="validation-category" v-if="validationResults.webpQuality && (validationResults.webpQuality.invalid > 0 || validationResults.webpQuality.valid > 0)">
              <div class="category-header" :class="{ 'has-issues': validationResults.webpQuality.invalid > 0 }">
                <div class="category-title">
                  <span class="category-icon">🖼️</span>
                  <span>이미지 품질 검증 (PNG/WebP)</span>
                  <span class="category-count success">{{ validationResults.webpQuality.valid || 0 }}개 유효</span>
                </div>
                <div v-if="validationResults.webpQuality.invalid > 0" class="category-status error">
                  {{ validationResults.webpQuality.invalid }}개 오류
                </div>
              </div>
              
              <div v-if="validationResults.webpQuality.details && validationResults.webpQuality.details.length > 0" class="category-content">
                <div class="issue-section">
                  <div class="issue-header">
                    <span class="issue-icon">📊</span>
                    <span class="issue-title">이미지 품질 오류 ({{ validationResults.webpQuality.invalid }}개)</span>
                  </div>
                  <div class="webp-quality-details">
                    <div v-for="(detail, index) in validationResults.webpQuality.details" :key="index" class="webp-quality-item">
                      <div class="quality-path">{{ detail.path }}</div>
                      
                      <!-- 오류 메시지 표시 -->
                      <div v-if="detail.error" class="quality-error-message">
                        <span class="error-icon">❌</span>
                        <span class="error-text">{{ detail.error }}</span>
                      </div>
                      
                      <div v-if="detail.metrics" class="quality-metrics">
                        <div class="metric-row">
                          <span class="metric-label">해상도:</span>
                          <span class="metric-value" :class="{ 'metric-error': detail.metrics.resolution && (detail.metrics.resolution.width < 768 || detail.metrics.resolution.height < 768) }">
                            {{ detail.metrics.resolution?.width }}x{{ detail.metrics.resolution?.height }}
                            <span v-if="detail.metrics.resolution && (detail.metrics.resolution.width < 768 || detail.metrics.resolution.height < 768)" class="metric-note">(최소 768x768 필요)</span>
                          </span>
                        </div>
                        <div v-if="detail.metrics.sharpness !== undefined" class="metric-row">
                          <span class="metric-label">선명도:</span>
                          <span class="metric-value" :class="{ 'metric-warning': detail.metrics.sharpness < 50 }">
                            {{ detail.metrics.sharpness.toFixed(2) }} (참고: 50)
                          </span>
                        </div>
                        <div v-if="detail.metrics.snrEstimate !== undefined" class="metric-row">
                          <span class="metric-label">SNR:</span>
                          <span class="metric-value" :class="{ 'metric-warning': detail.metrics.snrEstimate < 30 }">
                            {{ detail.metrics.snrEstimate.toFixed(2) }}dB (참고: 30dB)
                          </span>
                        </div>
                        <div class="metric-row">
                          <span class="metric-label">ICC:</span>
                          <span class="metric-value" :class="{ 'metric-warning': !detail.metrics.hasIcc }">
                            {{ detail.metrics.hasIcc ? '있음' : '없음' }}
                            <span v-if="!detail.metrics.hasIcc" class="metric-note">(권장)</span>
                          </span>
                        </div>
                        <div class="metric-row">
                          <span class="metric-label">EXIF:</span>
                          <span class="metric-value" :class="{ 'metric-warning': !detail.metrics.hasExif }">
                            {{ detail.metrics.hasExif ? '있음' : '없음' }}
                            <span v-if="!detail.metrics.hasExif" class="metric-note">(권장)</span>
                          </span>
                        </div>
                        <div class="metric-row">
                          <span class="metric-label">색상 깊이:</span>
                          <span class="metric-value" :class="{ 'metric-warning': !detail.metrics.is8Bit }">
                            {{ detail.metrics.colorDepth || 'unknown' }}
                            <span v-if="!detail.metrics.is8Bit" class="metric-note">(권장: 8비트/uchar)</span>
                          </span>
                        </div>
                        <div v-if="detail.metrics.format === 'webp' && detail.metrics.webpQuality !== null && detail.metrics.webpQuality !== undefined" class="metric-row">
                          <span class="metric-label">WebP 품질(q):</span>
                          <span class="metric-value" :class="{ 'metric-warning': detail.metrics.webpQuality < 90 }">
                            {{ detail.metrics.webpQuality }} (권장: 90)
                          </span>
                        </div>
                        <div v-if="detail.metrics.format === 'webp' && detail.metrics.webpMethod !== null && detail.metrics.webpMethod !== undefined" class="metric-row">
                          <span class="metric-label">WebP 메서드(m):</span>
                          <span class="metric-value" :class="{ 'metric-warning': detail.metrics.webpMethod < 6 }">
                            {{ detail.metrics.webpMethod }} (권장: 6)
                          </span>
                        </div>
                        <div v-if="detail.metrics.format === 'png' && detail.metrics.format" class="metric-row">
                          <span class="metric-label">형식:</span>
                          <span class="metric-value">PNG (무손실)</span>
                        </div>
                      </div>
                      
                      <!-- 이슈 목록 표시 -->
                      <div v-if="detail.issues && detail.issues.length > 0" class="quality-issues">
                        <div class="issue-title">필수 검증 실패:</div>
                        <ul class="issue-list">
                          <li v-for="(issue, issueIndex) in detail.issues" :key="issueIndex" class="issue-item error">{{ issue }}</li>
                        </ul>
                      </div>
                      
                      <!-- 경고 목록 표시 -->
                      <div v-if="detail.warnings && detail.warnings.length > 0" class="quality-warnings">
                        <div class="issue-title">권장 사항 (학습에는 문제 없음):</div>
                        <ul class="issue-list">
                          <li v-for="(warning, warningIndex) in detail.warnings" :key="warningIndex" class="issue-item warning">{{ warning }}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 전체 오류 및 경고 -->
            <div v-if="(validationResults.errors && validationResults.errors.length > 0) || (validationResults.warnings && validationResults.warnings.length > 0)" class="validation-category">
              <div class="category-header has-issues">
                <div class="category-title">
                  <span class="category-icon">📋</span>
                  <span>전체 오류 및 경고</span>
                  <span class="category-count error" v-if="validationResults.errors?.length > 0">{{ validationResults.errors.length }}개 오류</span>
                  <span class="category-count warning" v-if="validationResults.warnings?.length > 0">{{ validationResults.warnings.length }}개 경고</span>
                </div>
              </div>
              
              <div class="category-content">
                <div v-if="validationResults.errors && validationResults.errors.length > 0" class="issue-section">
                  <div class="issue-header">
                    <span class="issue-icon">❌</span>
                    <span class="issue-title">오류 ({{ validationResults.errors.length }}개)</span>
                  </div>
                  <div class="issue-list">
                    <div v-for="(error, index) in validationResults.errors" :key="index" class="issue-item error">
                      {{ error }}
                    </div>
                  </div>
                </div>
                
                <div v-if="validationResults.warnings && validationResults.warnings.length > 0" class="issue-section">
                  <div class="issue-header">
                    <span class="issue-icon">⚠️</span>
                    <span class="issue-title">경고 ({{ validationResults.warnings.length }}개)</span>
                  </div>
                  <div class="issue-list">
                    <div v-for="(warning, index) in validationResults.warnings" :key="index" class="issue-item warning">
                      {{ warning }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 데이터셋 준비 탭 -->
      <div v-if="activeTab === 'dataset'" class="tab-panel">
        <div class="panel-header">
          <h2>📋 데이터셋 준비</h2>
          <p>렌더링된 데이터를 YOLO 학습용 데이터셋으로 변환합니다</p>
        </div>

        <div class="dataset-controls">
          <!-- 데이터셋 준비 모드 선택 -->
          <div class="dataset-mode-selection">
            <h4>🔄 데이터셋 준비 모드</h4>
            <div class="mode-options">
              <label class="mode-option">
                <input 
                  type="radio" 
                  v-model="datasetMode" 
                  value="incremental"
                  name="datasetMode"
                >
                <span class="mode-label">
                  <strong>🔄 증분 업데이트</strong>
                  <small>기존 데이터셋 유지하고 새 파일만 추가 (권장)</small>
                </span>
              </label>
              <label class="mode-option">
                <input 
                  type="radio" 
                  v-model="datasetMode" 
                  value="rebuild"
                  name="datasetMode"
                >
                <span class="mode-label">
                  <strong>🗑️ 완전 재생성</strong>
                  <small>기존 데이터셋 삭제하고 처음부터 재생성</small>
                </span>
              </label>
            </div>
          </div>

          <button 
            @click="manualDatasetPreparation"
            :disabled="isRendering"
            class="btn btn-primary"
          >
            📋 데이터셋 준비 실행
          </button>
          <p class="dataset-info">
            💡 {{ datasetMode === 'incremental' ? '기존 데이터셋에 새 파일만 추가합니다' : '기존 데이터셋을 완전히 삭제하고 새로 생성합니다' }}
          </p>
        </div>

        <!-- 데이터셋 준비 진행 상황 -->
        <div v-if="renderLogs.length > 0" class="dataset-logs">
          <h3>📋 데이터셋 준비 로그</h3>
          <div class="log-container">
            <div 
              v-for="(log, index) in renderLogs" 
              :key="index"
              :class="['log-entry', log.type]"
            >
              <span class="log-time">{{ new Date().toLocaleTimeString() }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>

        <!-- 데이터셋 버전 관리 -->
        <div class="dataset-version-management">
          <h3>📋 데이터셋 버전 관리</h3>
          
          <!-- 도움말 섹션 -->
          <div class="version-help">
            <div class="help-header">
              <h4>💡 버전 관리 도움말</h4>
              <button @click="toggleVersionHelp" class="help-toggle">
                {{ showVersionHelp ? '접기' : '펼치기' }}
              </button>
            </div>
            
            <div v-if="showVersionHelp" class="help-content">
              <div class="help-section">
                <h5>🔄 증분 업데이트 vs 완전 재생성</h5>
                <ul>
                  <li><strong>증분 업데이트</strong>: 기존 데이터를 보존하고 새 파일만 추가 (권장)</li>
                  <li><strong>완전 재생성</strong>: 기존 데이터를 삭제하고 처음부터 새로 생성</li>
                </ul>
              </div>
              
              <div class="help-section">
                <h5>📋 버전 관리 기능</h5>
                <ul>
                  <li><strong>📋 버전 목록</strong>: 모든 데이터셋 버전을 조회합니다</li>
                  <li><strong>💾 현재 버전 백업</strong>: 현재 데이터셋을 새 버전으로 백업합니다</li>
                  <li><strong>🔄 버전 전환</strong>: 다른 버전의 데이터셋으로 전환합니다</li>
                </ul>
              </div>
              
              <div class="help-section">
                <h5>⚠️ 주의사항</h5>
                <ul>
                  <li>버전 전환 시 현재 작업 중인 데이터가 변경될 수 있습니다</li>
                  <li>학습된 모델은 특정 데이터셋 버전에 의존할 수 있습니다</li>
                  <li>중요한 작업 전에는 반드시 백업을 생성하세요</li>
                </ul>
              </div>
              
              <div class="help-section">
                <h5>🎯 사용 시나리오</h5>
                <ul>
                  <li><strong>새 부품 추가</strong>: 증분 업데이트 모드 사용</li>
                  <li><strong>데이터 정리</strong>: 완전 재생성 모드 사용</li>
                  <li><strong>이전 버전 복구</strong>: 버전 전환 기능 사용</li>
                  <li><strong>안전한 실험</strong>: 백업 생성 후 작업</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="version-controls">
            <button @click="listDatasetVersions" class="btn btn-secondary">
              📋 버전 목록
            </button>
            <button @click="optimizeAndBackup" class="btn btn-success">
              🚀 최적화 + 백업 + Supabase 동기화
            </button>
            <button @click="switchDatasetVersion" class="btn btn-secondary" :disabled="!selectedVersion">
              🔄 버전 전환
            </button>
          </div>
          
          <div v-if="datasetVersions.length > 0" class="version-list">
            <h4>📋 데이터셋 버전 목록</h4>
            <div class="version-items">
              <div 
                v-for="version in datasetVersions" 
                :key="version.version"
                :class="['version-item', { 
                  'current': version.is_current,
                  'selected': selectedVersion === version.version
                }]"
                @click="selectVersion(version.version)"
              >
                <div class="version-header">
                  <span class="version-number">v{{ version.version }}</span>
                  <span v-if="version.is_current" class="current-badge">현재</span>
                  <span v-if="selectedVersion === version.version" class="selected-badge">선택됨</span>
                </div>
                <div class="version-info">
                  <div class="file-counts">
                    📊 {{ version.file_counts.total }}개 파일
                    (이미지: {{ version.file_counts.images }}, 라벨: {{ version.file_counts.labels }})
                  </div>
                  <div class="version-date">{{ formatDate(version.created_at) }}</div>
                  <div v-if="version.description" class="version-description">{{ version.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 데이터셋 구조 정보 -->
        <div class="dataset-structure">
          <h3>📁 데이터셋 구조</h3>
          <div class="structure-tree">
            <div class="folder-item">
              📁 output/synthetic/dataset_synthetic/
              <div class="folder-children">
                <div class="folder-item">
                  📁 {element_id}/
                  <div class="folder-children">
                    <div class="folder-item">📁 images/ (PNG 파일)</div>
                    <div class="folder-item">📁 labels/ (YOLO 형식)</div>
                    <div class="folder-item">📁 meta/ (JSON 메타데이터)</div>
                    <div class="folder-item">📁 meta-e/ (Essential JSON)</div>
                    <div class="folder-item">📁 depth/ (EXR 깊이 맵)</div>
                  </div>
                </div>
                <div class="folder-item">
                  <small>train/val/test split은 학습 시점에 동적 생성</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. 학습 탭 -->
      <div v-if="activeTab === 'training'" class="tab-panel">
        <div class="panel-header">
          <h2>🤖 YOLO 학습</h2>
          <p>로컬 PC에서 YOLO 모델을 학습합니다</p>
        </div>

        <div class="training-controls">
          <div class="training-info">
            <h3>💻 로컬 학습 명령어</h3>
            <div class="command-box">
              <code>python scripts/train_yolo_local.py --data output/synthetic/dataset_synthetic/data.yaml --epochs 100 --batch 16</code>
            </div>
          </div>

          <div class="training-status">
            <h3>📊 학습 상태</h3>
            <div class="status-indicator">
              <div class="status-dot" :class="trainingStatus"></div>
              <span>{{ trainingStatusText }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. 큐 관리 탭 -->
      <div v-if="activeTab === 'queue'" class="tab-panel">
        <div class="panel-header">
          <h2>🔄 Render Queue 관리</h2>
          <p>실패한 렌더링 작업을 모니터링하고 재처리합니다</p>
        </div>
        
        <RenderQueueManager />
      </div>

      <!-- 7. 에러 로그 탭 -->
      <div v-if="activeTab === 'logs'" class="tab-panel">
        <div class="panel-header">
          <h2>📋 에러 복구 로그</h2>
          <p>시스템 에러와 복구 작업을 모니터링합니다</p>
        </div>
        
        <ErrorRecoveryLogs />
      </div>

    </div>

    <!-- 알림 시스템 -->
    <div class="notifications-container">
      <div 
        v-for="notification in notifications" 
        :key="notification.id"
        class="notification"
        :class="`notification-${notification.type}`"
        @click="removeNotification(notification.id)"
      >
        <div class="notification-icon">
          <span v-if="notification.type === 'success'">✅</span>
          <span v-else-if="notification.type === 'error'">❌</span>
          <span v-else-if="notification.type === 'warning'">⚠️</span>
          <span v-else>ℹ️</span>
        </div>
        <div class="notification-content">
          <div class="notification-title">{{ notification.title }}</div>
          <div class="notification-message">{{ notification.message }}</div>
        </div>
        <button class="notification-close" @click.stop="removeNotification(notification.id)">
          ×
        </button>
      </div>
    </div>

    <!-- 진행률 모달 -->
    <div v-if="showProgressModal" class="progress-modal-overlay"> <!-- // 🔧 수정됨: 오버레이 클릭으로 닫히지 않도록 -->
      <div class="progress-modal" @click.stop>
        <div class="progress-header">
          <h3>{{ progressModalData.title || '🚀 통합 처리 진행 중' }}</h3> <!-- // 🔧 수정됨: 동적 타이틀 -->
          <button class="progress-close" @click="hideProgress">
            ×
          </button>
        </div>
        <div class="progress-content">
          <div v-if="progressSteps.length === 0" class="progress-linear"> <!-- // 🔧 수정됨: 단계 없을 때 기본 진행률 표시 -->
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (progressModalData.progress || 0) + '%' }"></div>
            </div>
            <div class="progress-status">
              <span class="status-text">{{ progressModalData.status }}</span>
              <span class="status-percent">{{ Math.round(progressModalData.progress || 0) }}%</span>
            </div>
            <div class="progress-message">{{ progressModalData.message }}</div>
          </div>
          <div class="progress-steps">
            <div 
              v-for="step in progressSteps" 
              :key="step.step"
              :class="['progress-step', step.status]"
            >
              <div class="step-icon">
                <span v-if="step.status === 'pending'">⏳</span>
                <span v-else-if="step.status === 'running'">🔄</span>
                <span v-else-if="step.status === 'completed'">✅</span>
                <span v-else-if="step.status === 'failed'">❌</span>
              </div>
              <div class="step-content">
                <div class="step-title">{{ step.title }}</div>
                <div class="step-status">
                  <span v-if="step.status === 'pending'">대기 중</span>
                  <span v-else-if="step.status === 'running'">진행 중...</span>
                  <span v-else-if="step.status === 'completed'">완료</span>
                  <span v-else-if="step.status === 'failed'">실패</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSupabase } from '@/composables/useSupabase'
import RenderQueueManager from '@/components/RenderQueueManager.vue'
import ErrorRecoveryLogs from '@/components/ErrorRecoveryLogs.vue'

// Supabase 클라이언트
const { supabase } = useSupabase()

// 탭 관리
const activeTab = ref('settings')
const tabs = ref([
  { id: 'settings', icon: '⚙️', label: '설정' },
  { id: 'rendering', icon: '🎨', label: '렌더링' },
  { id: 'validation', icon: '🔍', label: '검증' },
  { id: 'dataset', icon: '📋', label: '데이터셋' },
  { id: 'training', icon: '🤖', label: '학습' },
  { id: 'queue', icon: '🔄', label: '큐 관리' },
  { id: 'logs', icon: '📋', label: '에러 로그' },
])

// 경로 설정
const syntheticRootPath = ref('')
const currentPath = ref('')
const currentDatasetPath = ref('')
const isUpdatingPath = ref(false)

// 자동 학습 설정
const autoTrainingEnabled = ref(false)

// 렌더링 관련
const renderType = ref('single')
const searchType = ref('partNumber')
const partNumber = ref('')
const elementId = ref('')
const colorId = ref('')
const setNumber = ref('')
const searchResults = ref([])
const isRendering = ref(false)
const renderProgress = ref(0)
const currentRenderingPart = ref(null)
const renderLogs = ref([])

// 검증 관련
const validationResults = ref(null)
const isGeneratingLabels = ref(false)
const isFixingImages = ref(false)
const isFixingMetadata = ref(false)
const isGeneratingImages = ref(false)

// 데이터셋 관련
const datasetMode = ref('incremental') // 'incremental' 또는 'rebuild'
const datasetVersions = ref([])
const selectedVersion = ref(null)
const showVersionHelp = ref(false)

// 학습 관련
const trainingStatus = ref('idle')
const trainingStatusText = ref('대기 중')


// 알림 및 모달 관련
const notifications = ref([])
const showProgressModal = ref(false)
const progressSteps = ref([])
const progressModalData = ref({
  title: '',
  progress: 0,
  status: '',
  message: '',
  showCancel: false
})

// API 포트 관리
const syntheticApiPort = ref(null)

// 동적 포트 감지
const detectSyntheticApiPort = async () => {
  try {
    // 포트 정보 파일에서 포트 읽기
    const response = await fetch('/.synthetic-api-port.json')
    if (response.ok) {
      const portInfo = await response.json()
      syntheticApiPort.value = portInfo.port
      console.log(`🔍 Synthetic API 포트 감지: ${syntheticApiPort.value}`)
      return portInfo.port
    }
  } catch (error) {
    console.warn('포트 정보 파일 읽기 실패:', error.message)
  }
  
  // 포트 범위에서 사용 가능한 포트 찾기
  const possiblePorts = [3011, 3012, 3013, 3014, 3015]
  for (const port of possiblePorts) {
    try {
      const testResponse = await fetch(`http://localhost:${port}/api/synthetic/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000) // 1초 타임아웃
      })
      if (testResponse.ok) {
        syntheticApiPort.value = port
        console.log(`🔍 Synthetic API 포트 자동 감지: ${port}`)
        return port
      }
    } catch (error) {
      // 해당 포트에서 서버가 실행되지 않음
      continue
    }
  }
  
  // 기본 포트 사용
  syntheticApiPort.value = 3011
  console.log(`⚠️ 기본 포트 사용: ${syntheticApiPort.value}`)
  return 3011
}

// API URL 생성
const getSyntheticApiUrl = (endpoint) => {
  const port = syntheticApiPort.value || 3011
  return `http://localhost:${port}${endpoint}`
}

// API 호출 시 포트 재감지
const fetchWithPortDetection = async (endpoint, options = {}) => {
  // 포트가 설정되지 않은 경우 재감지
  if (!syntheticApiPort.value) {
    await detectSyntheticApiPort()
  }
  
  try {
    const url = getSyntheticApiUrl(endpoint)
    const response = await fetch(url, options)
    
    // 404 오류인 경우 포트 재감지 후 재시도
    if (response.status === 404) {
      console.warn(`포트 ${syntheticApiPort.value}에서 404 오류, 포트 재감지 시도...`)
      await detectSyntheticApiPort()
      const newUrl = getSyntheticApiUrl(endpoint)
      return await fetch(newUrl, options)
    }
    
    return response
  } catch (error) {
    // 네트워크 오류인 경우 포트 재감지 후 재시도
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      console.warn(`포트 ${syntheticApiPort.value}에서 네트워크 오류, 포트 재감지 시도...`)
      await detectSyntheticApiPort()
      const newUrl = getSyntheticApiUrl(endpoint)
      return await fetch(newUrl, options)
    }
    throw error
  }
}

// 알림 시스템
const addNotification = (type, title, message, duration = 5000) => {
  const notification = {
    id: Date.now(),
    type, // 'success', 'error', 'warning', 'info'
    title,
    message,
    timestamp: new Date()
  }
  
  notifications.value.push(notification)
  
  // 자동 제거
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(notification.id)
    }, duration)
  }
}

const removeNotification = (id) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

// 진행률 모달
const showProgress = (title, showCancel = false) => {
  progressModalData.value = {
    title,
    progress: 0,
    status: '시작 중...',
    message: '작업을 시작합니다...',
    showCancel
  }
  showProgressModal.value = true
}

const updateProgress = (progress, status, message) => {
  progressModalData.value.progress = progress
  progressModalData.value.status = status
  progressModalData.value.message = message
}

const hideProgress = () => { // // 🔧 수정됨: 수동 닫기만 허용
  showProgressModal.value = false
  progressModalData.value = {
    title: '',
    progress: 0,
    status: '',
    message: '',
    showCancel: false
  }
}

// 진행률 단계 업데이트
const updateProgressStep = (stepNumber, status) => {
  const step = progressSteps.value.find(s => s.step === stepNumber)
  if (step) {
    step.status = status
  }
}

// 자동 학습 설정 업데이트
const updateAutoTrainingSetting = async () => {
  try {
    const { data: existingData, error: selectError } = await supabase
      .from('automation_config')
      .select('*')
      .eq('config_key', 'auto_training_enabled')
      .single()
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.error('기존 설정 조회 실패:', selectError)
      return
    }
    
    let result
    if (existingData) {
      result = await supabase
        .from('automation_config')
        .update({
          config_value: autoTrainingEnabled.value.toString(),
          description: '자동 학습 활성화 설정',
          is_active: true
        })
        .eq('config_key', 'auto_training_enabled')
        .select()
    } else {
      result = await supabase
        .from('automation_config')
        .insert({
          config_key: 'auto_training_enabled',
          config_value: autoTrainingEnabled.value.toString(),
          description: '자동 학습 활성화 설정',
          is_active: true
        })
        .select()
    }
    
    if (result.error) {
      console.error('자동 학습 설정 업데이트 실패:', result.error)
    } else {
      console.log(`✅ 자동 학습 설정 업데이트: ${autoTrainingEnabled.value ? '활성화' : '비활성화'}`)
    }
  } catch (error) {
    console.error('자동 학습 설정 업데이트 실패:', error)
  }
}

// 엘리먼트 ID로 부품 검색
const searchByElementId = async () => {
  if (!elementId.value) return
  
  try {
    renderLogs.value.push({ type: 'info', message: `엘리먼트 ID ${elementId.value} 검색 중...` })
    
    const { data, error } = await supabase
      .from('parts_master_features')
      .select('part_id, part_name, element_id')
      .eq('element_id', String(elementId.value))
      .limit(10)

    if (error) {
      throw new Error(`검색 실패: ${error.message}`)
    }

    searchResults.value = data || []
    
    if (searchResults.value.length === 0) {
      renderLogs.value.push({ type: 'warning', message: `엘리먼트 ID ${elementId.value}에 해당하는 부품을 찾을 수 없습니다` })
    } else {
      renderLogs.value.push({ type: 'success', message: `${searchResults.value.length}개의 부품을 찾았습니다` })
    }
    
  } catch (error) {
    renderLogs.value.push({ type: 'error', message: `검색 오류: ${error.message}` })
    console.error('검색 오류:', error)
  }
}

// 검색 결과 선택
const selectSearchResult = (result) => {
  partNumber.value = result.part_id
  elementId.value = result.element_id
  searchResults.value = []
  renderLogs.value.push({ type: 'info', message: `선택됨: ${result.part_name} (${result.part_id})` })
}

// 검색 타입 변경 시 초기화
const onSearchTypeChange = () => {
  searchResults.value = []
  if (searchType.value === 'partNumber') {
    elementId.value = ''
  } else {
    partNumber.value = ''
  }
}

// 단일 부품 렌더링 시작
const startSingleRendering = async () => {
  if (!partNumber.value) {
    addNotification('warning', '입력 오류', '부품 번호를 입력해주세요.')
    return
  }
  
  isRendering.value = true
  renderProgress.value = 0
  renderLogs.value = []
  
  // 진행률 모달 표시
  showProgress('단일 부품 렌더링', true)
  addNotification('info', '렌더링 시작', `부품 ${partNumber.value} 렌더링을 시작합니다.`)
  
  try {
    console.log('🚀 렌더링 시작 - 부품:', partNumber.value, '엘리먼트:', elementId.value, '색상:', colorId.value)
    renderLogs.value.push({ type: 'info', message: `부품 ${partNumber.value} 렌더링 시작...` })
    updateProgress(10, 'API 호출 중...', '렌더링 요청을 전송하고 있습니다...')
    
    // 요청 데이터 로깅
    const requestData = {
      partId: partNumber.value,
      elementId: elementId.value,
      colorId: colorId.value,
      renderType: 'single'
    }
    console.log('📤 렌더링 요청 데이터:', requestData)
    
    // 실제 렌더링 API 호출
    const response = await fetchWithPortDetection('/api/synthetic/start-rendering', { // 🔧 수정됨
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })
    
    console.log('📡 API 응답 상태:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API 오류 응답:', errorText)
      throw new Error(`렌더링 API 오류: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    console.log('✅ API 응답 데이터:', result)
    
    updateProgress(20, '렌더링 엔진 초기화', 'Blender 렌더링 엔진을 초기화하고 있습니다...')
    renderLogs.value.push({ type: 'info', message: '🎨 Blender 렌더링 엔진 초기화 중...' })
    renderLogs.value.push({ type: 'info', message: '📐 3D 모델 로딩 중...' })
    
    // 실제 렌더링 진행률 모니터링
    const jobId = result.jobId
    console.log('🆔 작업 ID:', jobId)
    
    if (jobId) {
      await monitorRenderingProgress(jobId)
    } else {
      // 즉시 완료된 경우
      console.log('⚡ 즉시 완료된 렌더링')
      renderProgress.value = 100
      isRendering.value = false
      updateProgress(100, '완료', '렌더링이 완료되었습니다!')
      renderLogs.value.push({ type: 'success', message: '✅ 렌더링 완료!' })
      renderLogs.value.push({ type: 'info', message: `📊 생성된 파일: 이미지 ${result.imageCount || 5}개, 라벨 ${result.labelCount || 5}개, 메타데이터 1개` })
      addNotification('success', '렌더링 완료', `부품 ${partNumber.value} 렌더링이 성공적으로 완료되었습니다.`)
      /* 완료 후에도 사용자가 X를 누를 때까지 유지 */ // 🔧 수정됨
    }
    
  } catch (error) {
    console.error('💥 렌더링 오류 상세:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      partNumber: partNumber.value,
      elementId: elementId.value,
      colorId: colorId.value
    })
    
    renderLogs.value.push({ type: 'error', message: `렌더링 실패: ${error.message}` })
    isRendering.value = false
    updateProgress(0, '오류', `렌더링 실패: ${error.message}`)
    addNotification('error', '렌더링 실패', `부품 ${partNumber.value} 렌더링 중 오류가 발생했습니다.`)
    /* 오류 표시 후에도 수동 닫기 */ // 🔧 수정됨
  }
}

// 세트 렌더링 시작
const startSetRendering = async () => {
  if (!setNumber.value) {
    addNotification('warning', '입력 오류', '세트 번호를 입력해주세요.')
    return
  }
  
  isRendering.value = true
  renderProgress.value = 0
  renderLogs.value = []
  
  // 진행률 모달 표시
  showProgress('세트 렌더링', true)
  addNotification('info', '세트 렌더링 시작', `세트 ${setNumber.value} 렌더링을 시작합니다.`)
  
  try {
    renderLogs.value.push({ type: 'info', message: `세트 ${setNumber.value} 렌더링 시작...` })
    updateProgress(10, 'API 호출 중...', '렌더링 요청을 전송하고 있습니다...')
    
    // 실제 세트 렌더링 API 호출
    const response = await fetchWithPortDetection('/api/synthetic/start-rendering', { // 🔧 수정됨
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        setNumber: setNumber.value,
        renderType: 'set'
      })
    })
    
    if (!response.ok) {
      throw new Error(`세트 렌더링 API 오류: ${response.status}`)
    }
    
    const result = await response.json()
    updateProgress(20, '부품 목록 조회', '세트 부품 목록을 조회하고 있습니다...')
    renderLogs.value.push({ type: 'info', message: '🔍 세트 부품 목록 조회 중...' })
    renderLogs.value.push({ type: 'info', message: `📦 부품 ${result.partCount || 15}개 발견, 렌더링 준비 중...` })
    
    // 실제 세트 렌더링 진행률 모니터링
    const jobId = result.jobId
    if (jobId) {
      await monitorRenderingProgress(jobId)
    } else {
      // 즉시 완료된 경우
      renderProgress.value = 100
        isRendering.value = false
      updateProgress(100, '완료', '세트 렌더링이 완료되었습니다!')
        renderLogs.value.push({ type: 'success', message: '✅ 세트 렌더링 완료!' })
      renderLogs.value.push({ type: 'info', message: `📊 생성된 파일: 이미지 ${result.imageCount || 75}개, 라벨 ${result.labelCount || 75}개, 메타데이터 ${result.partCount || 15}개` })
      addNotification('success', '세트 렌더링 완료', `세트 ${setNumber.value} 렌더링이 성공적으로 완료되었습니다.`)
      /* 완료 후 수동 닫기 */ // 🔧 수정됨
      }
    
  } catch (error) {
    renderLogs.value.push({ type: 'error', message: `세트 렌더링 실패: ${error.message}` })
    isRendering.value = false
    updateProgress(0, '오류', `렌더링 실패: ${error.message}`)
    addNotification('error', '세트 렌더링 실패', `세트 ${setNumber.value} 렌더링 중 오류가 발생했습니다.`)
    /* 오류 후 수동 닫기 */ // 🔧 수정됨
  }
}

// 렌더링 진행률 모니터링
const monitorRenderingProgress = async (jobId) => {
  // [FIX] 세트 렌더링 시 106개 부품 처리 시간 고려하여 타임아웃 증가
  // 부품당 평균 20분 × 106개 = 약 35시간, 하지만 프론트엔드 모니터링은 2시간으로 제한
  // 백엔드 작업은 계속 진행되므로 프론트엔드 타임아웃은 모니터링만 중단
  const maxAttempts = 1440 // 2시간 타임아웃 (5초 간격 = 1440회)
  let attempts = 0
  
  console.log('📊 진행률 모니터링 시작 - 작업 ID:', jobId)
  
  while (isRendering.value && attempts < maxAttempts) {
    try {
      console.log(`🔄 진행률 확인 시도 ${attempts + 1}/${maxAttempts}`)
      const response = await fetchWithPortDetection(`/api/synthetic/progress/${jobId}`) // 🔧 수정됨
      
      console.log('📡 진행률 API 응답 상태:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ 진행률 API 오류:', errorText)
        throw new Error(`진행률 API 오류: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      console.log('📈 진행률 데이터:', data)
      
      renderProgress.value = data.progress || 0
      updateProgress(data.progress || 0, '렌더링 중...', `진행률: ${data.progress || 0}%`)
      renderLogs.value.push({ type: 'info', message: `🎨 렌더링 진행률: ${renderProgress.value}%` })
      
      // 로그 메시지도 콘솔에 출력
      if (data.logs && data.logs.length > 0) {
        data.logs.forEach(log => {
          console.log(`📝 렌더링 로그 [${log.type}]:`, log.message)
        })
        renderLogs.value.push(...data.logs)
      }
      
      if (data.status === 'completed') {
        console.log('✅ 렌더링 완료 감지')
        isRendering.value = false
        renderProgress.value = 100
        updateProgress(100, '완료', '렌더링이 완료되었습니다!')
        renderLogs.value.push({ type: 'success', message: '✅ 렌더링 완료!' })
        renderLogs.value.push({ type: 'info', message: `📊 생성된 파일: 이미지 ${data.imageCount || 5}개, 라벨 ${data.labelCount || 5}개, 메타데이터 1개` })
        addNotification('success', '렌더링 완료', '렌더링이 성공적으로 완료되었습니다.')
        /* 완료 후 수동 닫기 */ // 🔧 수정됨
        break
      } else if (data.status === 'failed') {
        console.error('❌ 렌더링 실패 감지:', data.error)
        isRendering.value = false
        updateProgress(0, '오류', `렌더링 실패: ${data.error || '알 수 없는 오류'}`)
        renderLogs.value.push({ type: 'error', message: `렌더링 실패: ${data.error || '알 수 없는 오류'}` })
        addNotification('error', '렌더링 실패', data.error || '알 수 없는 오류')
        /* 오류 후 수동 닫기 */ // 🔧 수정됨
        break
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)) // 5초 대기
      attempts++
    } catch (error) {
      console.error('💥 진행률 모니터링 오류:', {
        message: error.message,
        stack: error.stack,
        jobId: jobId,
        attempt: attempts + 1
      })
      
      renderLogs.value.push({ type: 'error', message: `진행률 모니터링 오류: ${error.message}` })
      updateProgress(0, '오류', `진행률 모니터링 오류: ${error.message}`)
      addNotification('error', '진행률 모니터링 오류', error.message)
      /* 모니터링 오류 후 수동 닫기 */ // 🔧 수정됨
      break
    }
  }
  
  if (attempts >= maxAttempts) {
    console.error('⏰ 렌더링 타임아웃 - 최대 시도 횟수 초과')
    isRendering.value = false
    updateProgress(0, '타임아웃', '렌더링 타임아웃: 최대 대기 시간을 초과했습니다')
    renderLogs.value.push({ type: 'error', message: '렌더링 타임아웃: 최대 대기 시간을 초과했습니다' })
    addNotification('error', '렌더링 타임아웃', '최대 대기 시간을 초과했습니다')
    /* 타임아웃 후 수동 닫기 */ // 🔧 수정됨
  }
}

// 렌더링 중지
const stopRendering = () => {
  isRendering.value = false
  renderLogs.value.push({ type: 'warning', message: '렌더링이 중지되었습니다' })
}

// 데이터 검증
const manualDataValidation = async () => {
  try {
    console.log('[검증] 수동 검증 시작') // 🔧 수정됨
    renderLogs.value.push({ type: 'info', message: '데이터 검증 시작...' })
    addNotification('info', '데이터 검증 시작', '데이터 검증을 시작합니다...')
    showProgress('데이터 검증', false)
    updateProgress(10, 'API 호출 중...', '검증 API를 호출하고 있습니다...')
    
    // 실제 파일 검증 API 호출
    console.log('🔍 검증 API 호출 시작...')
    console.debug('[검증] 요청 페이로드', { // 🔧 수정됨
      sourcePath: 'output/synthetic',
      validateImages: true,
      validateLabels: true,
      validateMetadata: true,
      checkFileIntegrity: true,
      validateBucketSync: true,
      bucketName: 'lego-synthetic'
    })
    const response = await fetchWithPortDetection('/api/synthetic/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourcePath: 'output/synthetic',
        validateImages: true,
        validateLabels: true,
        validateMetadata: true,
        checkFileIntegrity: true,
        validateWebPQuality: true,
        validateBucketSync: true,
        bucketName: 'lego-synthetic'
      })
    })
    
    console.log('📡 검증 API 응답:', response.status, response.statusText) // 🔧 수정됨
    
    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[검증] API 오류 본문:', errText) // 🔧 수정됨
      throw new Error(`검증 API 오류: ${response.status}`)
    }
    
    const result = await response.json()
    console.debug('[검증] 초기 응답 JSON', result) // 🔧 수정됨
    updateProgress(30, '폴더 구조 검증', '렌더링된 폴더 구조를 검증하고 있습니다...')
    renderLogs.value.push({ type: 'info', message: '📁 output/synthetic 폴더 구조 검증 중...' })
    
    // 검증 진행률 모니터링
    if (result.jobId) {
      await monitorValidationProgress(result.jobId)
    } else {
      // 즉시 완료된 경우
      updateProgress(100, '완료', '데이터 검증이 완료되었습니다!')
      renderLogs.value.push({ type: 'success', message: '✅ 데이터 검증 완료!' })
      renderLogs.value.push({ type: 'info', message: `📊 검증 결과: 이미지 ${result.imageCount || 0}개, 라벨 ${result.labelCount || 0}개, 메타데이터 ${result.metadataCount || 0}개` })
      
      // 검증 결과 표시
      if (result.validationResults) {
        const { errors, warnings, stats } = result.validationResults
        
        if (errors && errors.length > 0) {
          renderLogs.value.push({ type: 'error', message: `❌ 검증 오류: ${errors.length}개` })
          errors.forEach(error => {
            renderLogs.value.push({ type: 'error', message: `  • ${error}` })
          })
        }
        
        if (warnings && warnings.length > 0) {
          renderLogs.value.push({ type: 'warning', message: `⚠️ 경고: ${warnings.length}개` })
          warnings.forEach(warning => {
            renderLogs.value.push({ type: 'warning', message: `  • ${warning}` })
          })
        }
        
        if (stats) {
          renderLogs.value.push({ type: 'info', message: `📈 통계: 총 부품 ${stats.totalParts}개, 유효 ${stats.validParts}개, 무효 ${stats.invalidParts}개` })
        }
      }
      
      // 검증 결과를 validationResults에 저장
      if (result.validationResults) {
        const { errors, warnings, stats, fileMatching, imageValidation, metadataValidation, insufficientImages, webpQuality } = result.validationResults
        validationResults.value = {
          success: errors.length === 0,
          stats: {
            totalParts: stats.totalParts || 0,
            validParts: stats.validParts || 0,
            invalidParts: stats.invalidParts || 0,
            totalImages: stats.totalImages || 0,
            totalLabels: stats.totalLabels || 0,
            totalMetadata: stats.totalMetadata || 0
          },
          errors: errors || [],
          warnings: warnings || [],
          fileMatching: fileMatching || { matched: 0, unmatchedImages: [], unmatchedLabels: [] },
          imageValidation: imageValidation || { valid: 0, invalid: 0, errors: [] },
          metadataValidation: metadataValidation || { valid: 0, invalid: 0, errors: [] },
          insufficientImages: insufficientImages || [],
          webpQuality: webpQuality || { valid: 0, invalid: 0, errors: [], details: [] },
          bucketSync: result.validationResults?.bucketSync || null
        }
      }
      
      addNotification('success', '데이터 검증 완료', `이미지 ${result.imageCount || 0}개, 라벨 ${result.labelCount || 0}개, 메타데이터 ${result.metadataCount || 0}개가 검증되었습니다.`)
      /* 완료 후 수동 닫기 */ // 🔧 수정됨
    }
    
  } catch (error) {
    console.error('[검증] 예외 발생:', error) // 🔧 수정됨
    renderLogs.value.push({ type: 'error', message: `검증 실패: ${error.message}` })
    updateProgress(0, '오류', `검증 실패: ${error.message}`)
    addNotification('error', '데이터 검증 실패', error.message)
    /* 실패 후 수동 닫기 */ // 🔧 수정됨
  }
}

// 검증 진행률 모니터링
const monitorValidationProgress = async (jobId) => {
  const maxAttempts = 300 // 25분 타임아웃 (5초 간격)
  let attempts = 0
  let lastProgress = -1
  let lastStep = ''
  let stalledCount = 0
  const STALLED_THRESHOLD = 6
  let lastLogIndex = 0 // 마지막으로 받은 로그 인덱스
  
  while (attempts < maxAttempts) {
    try {
      console.log(`[검증] 폴링 시도 ${attempts + 1}/${maxAttempts} (jobId=${jobId})`)
      // 마지막 로그 인덱스를 쿼리 파라미터로 전달
      const response = await fetchWithPortDetection(`/api/synthetic/validate/status/${jobId}?lastLogIndex=${lastLogIndex}`)
      const data = await response.json()
      console.debug('[검증] 폴링 응답 JSON', data)
      
      // 새로운 로그 추가
      if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
        data.logs.forEach(log => {
          renderLogs.value.push({ type: log.type || 'info', message: log.message })
        })
        lastLogIndex = data.logCount || lastLogIndex + data.logs.length
      }
      
      // 진행률 업데이트
      if (data.progress !== undefined && data.progress !== lastProgress) {
        lastProgress = data.progress
        updateProgress(data.progress, '검증 진행 중', `진행률: ${data.progress}%`)
      }
      
      if (data.status === 'completed') {
        updateProgress(100, '완료', '데이터 검증이 완료되었습니다!')
        renderLogs.value.push({ type: 'success', message: '✅ 데이터 검증 완료!' })
        renderLogs.value.push({ type: 'info', message: `📊 검증 결과: 이미지 ${data.imageCount || 0}개, 라벨 ${data.labelCount || 0}개, 메타데이터 ${data.metadataCount || 0}개` })
        
        // 검증 결과 표시
        if (data.validationResults) {
          const { errors, warnings, stats } = data.validationResults
          
          if (errors && errors.length > 0) {
            errors.forEach(error => {
              renderLogs.value.push({ type: 'error', message: `❌ ${error}` })
            })
          }
          
          if (warnings && warnings.length > 0) {
            warnings.forEach(warning => {
              renderLogs.value.push({ type: 'warning', message: `⚠️ ${warning}` })
            })
          }
          
          // 검증 결과 저장
          validationResults.value = {
      success: errors.length === 0,
      stats: {
              totalParts: stats.totalParts || 0,
              validParts: stats.validParts || 0,
              invalidParts: stats.invalidParts || 0,
              totalImages: stats.totalImages || 0,
              totalLabels: stats.totalLabels || 0,
              totalMetadata: stats.totalMetadata || 0
            },
            errors: errors || [],
            warnings: warnings || [],
            fileMatching: data.validationResults?.fileMatching || { matched: 0, unmatchedImages: [], unmatchedLabels: [] },
            imageValidation: data.validationResults?.imageValidation || { valid: 0, invalid: 0, errors: [] },
            metadataValidation: data.validationResults?.metadataValidation || { valid: 0, invalid: 0, errors: [] },
            insufficientImages: data.validationResults?.insufficientImages || [],
            webpQuality: data.validationResults?.webpQuality || { valid: 0, invalid: 0, errors: [], details: [] },
            bucketSync: data.validationResults?.bucketSync || null
          }
        }
        
        addNotification('success', '데이터 검증 완료', `이미지 ${data.imageCount || 0}개, 라벨 ${data.labelCount || 0}개, 메타데이터 ${data.metadataCount || 0}개가 검증되었습니다.`)
        /* 완료 후 수동 닫기 */ // 🔧 수정됨
        break
      } else if (data.status === 'failed') {
        updateProgress(0, '오류', `데이터 검증 실패: ${data.error || '알 수 없는 오류'}`)
        renderLogs.value.push({ type: 'error', message: `데이터 검증 실패: ${data.error || '알 수 없는 오류'}` })
        addNotification('error', '데이터 검증 실패', data.error || '알 수 없는 오류')
        /* 실패 후 수동 닫기 */ // 🔧 수정됨
        break
      }
      
      updateProgress(data.progress || 0, data.currentStep || '검증 중...', `경로: output/synthetic · 진행률: ${data.progress || 0}%`) // 🔧 수정됨
      renderLogs.value.push({ type: 'info', message: `🔍 데이터 검증 진행률: ${data.progress || 0}%` })
      
      if (data.currentStep) {
        renderLogs.value.push({ type: 'info', message: `📋 현재 단계: ${data.currentStep}` })
        console.log('[검증] 현재 단계:', data.currentStep) // 🔧 수정됨
      }

      // 정체 감지 및 상세 조회 // 🔧 수정됨
      const curProgress = data.progress ?? -1
      const curStep = data.currentStep || ''
      if (curProgress === lastProgress && curStep === lastStep) {
        stalledCount++
        if (stalledCount === STALLED_THRESHOLD) {
          console.warn('[검증] 진행률/단계 정체 감지. 상세 상태 조회 시도')
          renderLogs.value.push({ type: 'warning', message: '⏸️ 진행 정체 감지: 상세 상태 조회 중...' })
          try {
            const verboseResp = await fetchWithPortDetection(`/api/synthetic/validate/status/${jobId}?verbose=1`)
            const verboseData = await verboseResp.json().catch(() => ({}))
            console.debug('[검증] 상세 상태', verboseData)
            if (verboseData?.logs?.length) {
              verboseData.logs.slice(-20).forEach((msg) => {
                renderLogs.value.push({ type: 'info', message: `🔎 서버 로그: ${msg}` })
              })
            }
            // 폴더 구조 힌트 출력 (정체시 1회)
            renderLogs.value.push({ type: 'info', message: '📁 예상 폴더 구조 힌트:' }) // 🔧 수정됨
            renderLogs.value.push({ type: 'info', message: '  • output/synthetic/<part_id>/images/*.webp' })
            renderLogs.value.push({ type: 'info', message: '  • output/synthetic/<part_id>/labels/*.txt' })
            renderLogs.value.push({ type: 'info', message: '  • output/synthetic/<part_id>/meta/*.json' })
            renderLogs.value.push({ type: 'info', message: '  • 또는 dataset_synthetic/images|labels|meta/ 하위 구조' })
          } catch (e) {
            console.error('[검증] 상세 상태 조회 실패', e)
          }
        }
      } else {
        stalledCount = 0
        lastProgress = curProgress
        lastStep = curStep
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)) // 5초 대기
      attempts++
  } catch (error) {
      renderLogs.value.push({ type: 'error', message: `검증 모니터링 오류: ${error.message}` })
      updateProgress(0, '오류', `검증 모니터링 오류: ${error.message}`)
      addNotification('error', '검증 모니터링 오류', error.message)
      /* 모니터링 오류 후 수동 닫기 */ // 🔧 수정됨
      break
    }
  }
  
  if (attempts >= maxAttempts) {
    console.warn('[검증] 타임아웃 도달. 마지막 상태 조회 시도') // 🔧 수정됨
    updateProgress(0, '타임아웃', '데이터 검증 타임아웃: 최대 대기 시간을 초과했습니다')
    renderLogs.value.push({ type: 'error', message: '데이터 검증 타임아웃: 최대 대기 시간을 초과했습니다' })
    addNotification('error', '데이터 검증 타임아웃', '최대 대기 시간을 초과했습니다')

    try {
      const lastResp = await fetchWithPortDetection(`/api/synthetic/validate/status/${jobId}`)
      const lastData = await lastResp.json().catch(() => ({}))
      console.debug('[검증] 타임아웃 직전 상태', lastData) // 🔧 수정됨
      if (lastData?.logs?.length) {
        lastData.logs.slice(-20).forEach((msg) => {
          renderLogs.value.push({ type: 'info', message: `🔎 서버 로그: ${msg}` })
        })
      }
    } catch (e) {
      console.error('[검증] 타임아웃 후 상태 조회 실패:', e) // 🔧 수정됨
    }
    /* 타임아웃 후 수동 닫기 */ // 🔧 수정됨
  }
}

// 라벨이 없는 이미지에 대한 라벨 생성
const generateMissingLabels = async (imagePath) => {
  try {
    isGeneratingLabels.value = true
    
    if (imagePath === 'all') {
      // 모든 라벨 생성
      const unmatchedImages = validationResults.value?.fileMatching?.unmatchedImages || []
      
      if (unmatchedImages.length === 0) {
        addNotification('info', '알림', '생성할 라벨이 없습니다.')
        return
      }
      
      addNotification('info', '라벨 생성 시작', `${unmatchedImages.length}개 이미지에 대한 라벨을 생성합니다.`)
      
      const response = await fetchWithPortDetection('/api/synthetic/validate/generate-labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imagePaths: unmatchedImages
        })
      })
      
      if (!response.ok) {
        throw new Error(`라벨 생성 실패: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        addNotification('success', '라벨 생성 완료', `${result.generatedCount}개 라벨이 생성되었습니다.`)
        
        // 검증 결과 업데이트 (생성된 라벨 제거)
        if (validationResults.value?.fileMatching) {
          validationResults.value.fileMatching.unmatchedImages = []
          validationResults.value.fileMatching.matched += result.generatedCount
        }
      } else {
        throw new Error(result.error || '라벨 생성 실패')
      }
    } else {
      // 단일 이미지 라벨 생성
      addNotification('info', '라벨 생성 시작', `${imagePath}에 대한 라벨을 생성합니다.`)
      
      const response = await fetchWithPortDetection('/api/synthetic/validate/generate-labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imagePaths: [imagePath]
        })
      })
      
      if (!response.ok) {
        throw new Error(`라벨 생성 실패: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        addNotification('success', '라벨 생성 완료', `${imagePath}에 대한 라벨이 생성되었습니다.`)
        
        // 검증 결과 업데이트 (생성된 라벨 제거)
        if (validationResults.value?.fileMatching) {
          const index = validationResults.value.fileMatching.unmatchedImages.indexOf(imagePath)
          if (index > -1) {
            validationResults.value.fileMatching.unmatchedImages.splice(index, 1)
            validationResults.value.fileMatching.matched++
          }
        }
      } else {
        throw new Error(result.error || '라벨 생성 실패')
      }
    }
  } catch (error) {
    console.error('라벨 생성 오류:', error)
    addNotification('error', '라벨 생성 실패', error.message)
  } finally {
    isGeneratingLabels.value = false
  }
}

// 이미지 파일 오류 수정 (EXR 등)
const fixImageErrors = async (errorPath) => {
  try {
    isFixingImages.value = true
    
    if (errorPath === 'all') {
      const imageErrors = validationResults.value?.imageValidation?.errors || []
      
      if (imageErrors.length === 0) {
        addNotification('info', '알림', '수정할 이미지 오류가 없습니다.')
        return
      }
      
      addNotification('info', '이미지 오류 확인 시작', `${imageErrors.length}개 이미지 오류를 확인합니다.`)
      
      const response = await fetchWithPortDetection('/api/synthetic/validate/fix-image-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errorPaths: imageErrors
        })
      })
      
      if (!response.ok) {
        throw new Error(`이미지 오류 수정 실패: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        addNotification('success', '이미지 오류 확인 완료', `${result.fixedCount}개 이미지가 수정되었습니다.`)
        
        // 검증 결과 업데이트
        if (validationResults.value?.imageValidation) {
          validationResults.value.imageValidation.errors = result.remainingErrors || []
          validationResults.value.imageValidation.valid += result.fixedCount
          validationResults.value.imageValidation.invalid -= result.fixedCount
        }
      } else {
        throw new Error(result.error || '이미지 오류 수정 실패')
      }
    } else {
      addNotification('info', '이미지 오류 확인 시작', `${errorPath} 오류를 확인합니다.`)
      
      const response = await fetchWithPortDetection('/api/synthetic/validate/fix-image-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errorPaths: [errorPath]
        })
      })
      
      if (!response.ok) {
        throw new Error(`이미지 오류 수정 실패: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        addNotification('success', '이미지 오류 확인 완료', `${errorPath} 오류가 수정되었습니다.`)
        
        // 검증 결과 업데이트
        if (validationResults.value?.imageValidation) {
          const index = validationResults.value.imageValidation.errors.indexOf(errorPath)
          if (index > -1) {
            validationResults.value.imageValidation.errors.splice(index, 1)
            validationResults.value.imageValidation.valid++
            validationResults.value.imageValidation.invalid--
          }
        }
      } else {
        throw new Error(result.error || '이미지 오류 수정 실패')
      }
    }
  } catch (error) {
    console.error('이미지 오류 수정 오류:', error)
    addNotification('error', '이미지 오류 수정 실패', error.message)
  } finally {
    isFixingImages.value = false
  }
}

// 메타데이터 JSON 오류 수정
const fixMetadataErrors = async (errorPath) => {
  try {
    isFixingMetadata.value = true
    
    if (errorPath === 'all') {
      const metadataErrors = validationResults.value?.metadataValidation?.errors || []
      
      if (metadataErrors.length === 0) {
        addNotification('info', '알림', '수정할 메타데이터 오류가 없습니다.')
        return
      }
      
      addNotification('info', '메타데이터 수정 시작', `${metadataErrors.length}개 JSON 파일을 수정합니다.`)
      
      const response = await fetchWithPortDetection('/api/synthetic/validate/fix-metadata-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errorPaths: metadataErrors
        })
      })
      
      if (!response.ok) {
        throw new Error(`메타데이터 수정 실패: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        addNotification('success', '메타데이터 수정 완료', `${result.fixedCount}개 JSON 파일이 수정되었습니다.`)
        
        // 검증 결과 업데이트
        if (validationResults.value?.metadataValidation) {
          validationResults.value.metadataValidation.errors = result.remainingErrors || []
          validationResults.value.metadataValidation.valid += result.fixedCount
          validationResults.value.metadataValidation.invalid -= result.fixedCount
        }
      } else {
        throw new Error(result.error || '메타데이터 수정 실패')
      }
    } else {
      addNotification('info', '메타데이터 수정 시작', `${errorPath}를 수정합니다.`)
      
      const response = await fetchWithPortDetection('/api/synthetic/validate/fix-metadata-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errorPaths: [errorPath]
        })
      })
      
      if (!response.ok) {
        throw new Error(`메타데이터 수정 실패: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        addNotification('success', '메타데이터 수정 완료', `${errorPath}가 수정되었습니다.`)
        
        // 검증 결과 업데이트
        if (validationResults.value?.metadataValidation) {
          const index = validationResults.value.metadataValidation.errors.indexOf(errorPath)
          if (index > -1) {
            validationResults.value.metadataValidation.errors.splice(index, 1)
            validationResults.value.metadataValidation.valid++
            validationResults.value.metadataValidation.invalid--
          }
        }
      } else {
        throw new Error(result.error || '메타데이터 수정 실패')
      }
    }
  } catch (error) {
    console.error('메타데이터 수정 오류:', error)
    addNotification('error', '메타데이터 수정 실패', error.message)
  } finally {
    isFixingMetadata.value = false
  }
}

// 부족한 이미지 추가 렌더링
const generateMissingImages = async (item) => {
  try {
    isGeneratingImages.value = true
    
    if (item === 'all') {
      const insufficientImages = validationResults.value?.insufficientImages || []
      
      if (insufficientImages.length === 0) {
        addNotification('info', '알림', '추가 렌더링이 필요한 부품이 없습니다.')
        return
      }
      
      addNotification('info', '추가 렌더링 시작', `${insufficientImages.length}개 부품에 대한 추가 렌더링을 시작합니다.`)
      
      const response = await fetchWithPortDetection('/api/synthetic/validate/generate-missing-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partInfo: insufficientImages
        })
      })
      
      if (!response.ok) {
        throw new Error(`추가 렌더링 실패: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        addNotification('success', '추가 렌더링 작업 생성 완료', `${result.generatedJobs}개 작업이 생성되었습니다.`)
        
        renderLogs.value.push({ type: 'info', message: `추가 렌더링 작업 생성: ${result.generatedJobs}개` })
        // 검증 재실행하여 업데이트된 결과 반영
        await manualDataValidation()
      } else {
        throw new Error(result.error || '추가 렌더링 실패')
      }
    } else {
      addNotification('info', '추가 렌더링 시작', `${item.split}/${item.partId}에 대한 추가 렌더링을 시작합니다. (부족: ${item.missingCount}개)`)
      
      const response = await fetchWithPortDetection('/api/synthetic/validate/generate-missing-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partInfo: [item]
        })
      })
      
      if (!response.ok) {
        throw new Error(`추가 렌더링 실패: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        addNotification('success', '추가 렌더링 작업 생성 완료', `${item.split}/${item.partId}에 대한 렌더링 작업이 생성되었습니다.`)
        
        renderLogs.value.push({ type: 'info', message: `추가 렌더링 작업 생성: ${item.split}/${item.partId}` })
        // 검증 재실행하여 업데이트된 결과 반영
        await manualDataValidation()
      } else {
        throw new Error(result.error || '추가 렌더링 실패')
      }
    }
  } catch (error) {
    console.error('추가 렌더링 오류:', error)
    addNotification('error', '추가 렌더링 실패', error.message)
  } finally {
    isGeneratingImages.value = false
  }
}

// 데이터셋 준비
const manualDatasetPreparation = async () => {
  try {
    renderLogs.value.push({ type: 'info', message: '데이터셋 준비 시작...' })
    addNotification('info', '데이터셋 준비 시작', '데이터셋 준비를 시작합니다...')
    showProgress('데이터셋 준비', true)
    updateProgress(10, 'API 호출 중...', '데이터셋 준비 요청을 전송하고 있습니다...')
    
    // 실제 데이터셋 준비 API 호출
    const response = await fetchWithPortDetection('/api/synthetic/dataset/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourcePath: 'output/synthetic',
        targetPath: 'output/synthetic/dataset_synthetic',
        format: 'yolo',
        forceRebuild: datasetMode.value === 'rebuild'  // 선택된 모드에 따라 결정
      })
    })
    
    if (!response.ok) {
      throw new Error(`데이터셋 준비 API 오류: ${response.status}`)
    }
    
    const result = await response.json()
    updateProgress(20, '폴더 구조 생성', 'dataset_synthetic 폴더 구조를 생성하고 있습니다...')
    renderLogs.value.push({ type: 'info', message: '📁 dataset_synthetic 폴더 구조 생성 중...' })
    renderLogs.value.push({ type: 'info', message: '📄 data.yaml 파일 생성 중...' })
    renderLogs.value.push({ type: 'info', message: '🔄 렌더링된 데이터 복사 중...' })
    
    // 실제 데이터셋 준비 진행률 모니터링
    console.log('📋 API 응답 결과:', result)
    console.log('📋 jobId 존재 여부:', !!result.jobId)
    
    if (result.jobId) {
      console.log('🔄 모니터링 경로 실행')
      await monitorDatasetPreparation(result.jobId)
    } else {
      console.log('🚀 즉시 완료 경로 실행')
      updateProgress(100, '완료', '데이터셋 준비가 완료되었습니다!')
    renderLogs.value.push({ type: 'success', message: '✅ 데이터셋 준비 완료!' })
      
      // 실제 파일 개수 계산
      console.log('🔍 파일 개수 계산 시작 (즉시 완료 경로)')
      try {
        const fileCounts = await calculateDatasetFiles()
        console.log('📊 계산된 파일 개수:', fileCounts)
        renderLogs.value.push({ type: 'info', message: `📊 준비된 파일: 이미지 ${fileCounts.images}개, 라벨 ${fileCounts.labels}개, 메타데이터 ${fileCounts.metadata}개` })
        addNotification('success', '데이터셋 준비 완료', `이미지 ${fileCounts.images}개, 라벨 ${fileCounts.labels}개, 메타데이터 ${fileCounts.metadata}개가 준비되었습니다.`)
      } catch (error) {
        console.error('파일 개수 계산 오류:', error)
        renderLogs.value.push({ type: 'info', message: `📊 준비된 파일: 이미지 ${result.imageCount || 0}개, 라벨 ${result.labelCount || 0}개, 메타데이터 ${result.metadataCount || 0}개` })
        addNotification('success', '데이터셋 준비 완료', `이미지 ${result.imageCount || 0}개, 라벨 ${result.labelCount || 0}개, 메타데이터 ${result.metadataCount || 0}개가 준비되었습니다.`)
      }
      
      /* 완료 후 수동 닫기 */ // 🔧 수정됨
    }
    
  } catch (error) {
    renderLogs.value.push({ type: 'error', message: `데이터셋 준비 실패: ${error.message}` })
    updateProgress(0, '오류', `데이터셋 준비 실패: ${error.message}`)
    addNotification('error', '데이터셋 준비 실패', error.message)
    /* 실패 후 수동 닫기 */ // 🔧 수정됨
  }
}

// 직접 파일 개수 계산 (폴백 방법)
const calculateFilesDirectly = async () => {
  try {
    // 데이터셋 준비 API를 통해 파일 개수 조회
    const response = await fetchWithPortDetection('/api/synthetic/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourcePath: 'output/synthetic/dataset_synthetic',
        validateImages: true,
        validateLabels: true,
        validateMetadata: true,
        checkFileIntegrity: false
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.validationResults) {
        const { stats } = data.validationResults
        return {
          images: stats?.totalImages || 0,
          labels: stats?.totalLabels || 0,
          metadata: stats?.totalMetadata || 0
        }
      }
    }
  } catch (error) {
    console.error('직접 계산 실패:', error)
  }
  
  // 최종 폴백: 기본값
  return { images: 0, labels: 0, metadata: 0 }
}

// 데이터셋 버전 관리 함수들
const listDatasetVersions = async () => {
  try {
    const response = await fetchWithPortDetection('/api/synthetic/dataset/versions', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      datasetVersions.value = data.versions || []
      addNotification('success', '버전 목록 조회', `${datasetVersions.value.length}개 버전을 찾았습니다`)
    } else {
      addNotification('error', '버전 목록 조회 실패', '버전 목록을 가져올 수 없습니다')
    }
  } catch (error) {
    console.error('버전 목록 조회 실패:', error)
    addNotification('error', '버전 목록 조회 실패', error.message)
  }
}

const backupCurrentDataset = async () => {
  try {
    const response = await fetchWithPortDetection('/api/synthetic/dataset/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: `백업 - ${new Date().toLocaleString()}`
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      addNotification('success', '백업 완료', `버전 ${data.version}으로 백업되었습니다`)
      await listDatasetVersions() // 목록 새로고침
    } else {
      addNotification('error', '백업 실패', '데이터셋 백업에 실패했습니다')
    }
  } catch (error) {
    console.error('백업 실패:', error)
    addNotification('error', '백업 실패', error.message)
  }
}

const selectVersion = (version) => {
  selectedVersion.value = version
  addNotification('info', '버전 선택', `버전 ${version}이 선택되었습니다`)
}

const switchDatasetVersion = async () => {
  if (!selectedVersion.value) {
    addNotification('warning', '버전 선택 필요', '전환할 버전을 선택해주세요')
    return
  }
  
  try {
    const response = await fetchWithPortDetection('/api/synthetic/dataset/switch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: selectedVersion.value
      })
    })
    
    if (response.ok) {
      addNotification('success', '버전 전환 완료', `버전 ${selectedVersion.value}으로 전환되었습니다`)
      await listDatasetVersions() // 목록 새로고침
      selectedVersion.value = null
    } else {
      addNotification('error', '버전 전환 실패', '버전 전환에 실패했습니다')
    }
  } catch (error) {
    console.error('버전 전환 실패:', error)
    addNotification('error', '버전 전환 실패', error.message)
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

const toggleVersionHelp = () => {
  showVersionHelp.value = !showVersionHelp.value
}




        // 최적화 + 백업 + Supabase 동기화 통합 함수
        const optimizeAndBackup = async () => {
          try {
            // 진행률 모달 표시
            showProgressModal.value = true
            progressSteps.value = [
              { step: 1, title: '현재 상태 백업', status: 'pending' },
              { step: 2, title: '로컬 Storage 최적화', status: 'pending' },
              { step: 3, title: 'Supabase 버전 동기화', status: 'pending' },
              { step: 4, title: 'Supabase Storage 동기화', status: 'pending' },
              { step: 5, title: '버전 목록 새로고침', status: 'pending' }
            ]
            
            addNotification('info', '통합 처리 시작', '백업 → 최적화 → Supabase 동기화를 실행합니다...')
            
            // 1단계: 현재 상태 백업
            updateProgressStep(1, 'running')
            console.log('📦 1단계: 현재 상태 백업 중...')
            const backupResponse = await fetchWithPortDetection('/api/synthetic/dataset/backup', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            })
            
            if (!backupResponse.ok) {
              throw new Error('백업 실패')
            }
            
            const backupData = await backupResponse.json()
            console.log('✅ 백업 완료:', backupData.message)
            updateProgressStep(1, 'completed')
            
            // 2단계: 로컬 Storage 최적화
            updateProgressStep(2, 'running')
            console.log('🚀 2단계: 로컬 Storage 최적화 중...')
            const optimizeResponse = await fetchWithPortDetection('/api/synthetic/dataset/optimize-local-storage', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            })
            
            if (!optimizeResponse.ok) {
              throw new Error('최적화 실패')
            }
            
            const optimizeData = await optimizeResponse.json()
            console.log('✅ 최적화 완료:', optimizeData.message)
            updateProgressStep(2, 'completed')
            
            // 3단계: Supabase 버전 동기화
            updateProgressStep(3, 'running')
            console.log('☁️ 3단계: Supabase 버전 동기화 중...')
            const syncResponse = await fetchWithPortDetection('/api/synthetic/dataset/sync-to-supabase', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            })
            
            if (!syncResponse.ok) {
              console.warn('⚠️ Supabase 동기화 실패 (계속 진행)')
              updateProgressStep(3, 'failed')
            } else {
              const syncData = await syncResponse.json()
              console.log('✅ Supabase 동기화 완료:', syncData.message)
              updateProgressStep(3, 'completed')
            }
            
            // 4단계: Supabase Storage 동기화
            updateProgressStep(4, 'running')
            console.log('📁 4단계: Supabase Storage 동기화 중...')
            const storageResponse = await fetchWithPortDetection('/api/synthetic/dataset/sync-optimized-storage', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            })
            
            if (!storageResponse.ok) {
              console.warn('⚠️ Supabase Storage 동기화 실패 (계속 진행)')
              updateProgressStep(4, 'failed')
            } else {
              const storageData = await storageResponse.json()
              console.log('✅ Supabase Storage 동기화 완료:', storageData.message)
              updateProgressStep(4, 'completed')
            }
            
            // 5단계: 버전 목록 새로고침
            updateProgressStep(5, 'running')
            console.log('🔄 5단계: 버전 목록 새로고침 중...')
            await listDatasetVersions()
            updateProgressStep(5, 'completed')
            
            // 진행률 모달 숨기기
            setTimeout(() => {
              showProgressModal.value = false
            }, 1000)
            
            addNotification('success', '통합 처리 완료', '백업, 최적화, Supabase 동기화가 모두 완료되었습니다!')
            console.log('🎉 통합 처리 완료!')
            
          } catch (error) {
            console.error('통합 처리 실패:', error)
            addNotification('error', '통합 처리 실패', error.message)
            showProgressModal.value = false
          }
        }






// 데이터셋 파일 개수 계산
const calculateDatasetFiles = async () => {
  try {
    console.log('🔍 파일 개수 계산 시작...')
    console.log('현재 포트:', syntheticApiPort.value)
    
    // 동적 포트 감지 사용
    const response = await fetchWithPortDetection('/api/synthetic/dataset/files', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    console.log('API 응답 상태:', response.status, response.statusText)
    
    if (response.ok) {
      const data = await response.json()
      console.log('파일 개수 조회 성공:', data)
      return {
        images: data.images || 0,
        labels: data.labels || 0,
        metadata: data.metadata || 0
      }
    } else {
      console.error('API 응답 오류:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('오류 내용:', errorText)
    }
  } catch (error) {
    console.error('파일 개수 계산 실패:', error)
    console.error('오류 상세:', error.message)
  }
  
  // 폴백: 직접 파일 개수 계산 시도
  console.log('API 호출 실패, 직접 파일 개수 계산 시도...')
  try {
    const directCounts = await calculateFilesDirectly()
    console.log('직접 계산 결과:', directCounts)
    return directCounts
  } catch (directError) {
    console.error('직접 계산도 실패:', directError)
    console.log('최종 폴백 값 반환: 0, 0, 0')
    return { images: 0, labels: 0, metadata: 0 }
  }
}

// 데이터셋 준비 진행률 모니터링
const monitorDatasetPreparation = async (jobId) => {
  const maxAttempts = 30 // 2.5분 타임아웃 (5초 간격)
  let attempts = 0
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetchWithPortDetection(`/api/synthetic/dataset/prepare/status/${jobId}`)
      const data = await response.json()
      
      if (data.status === 'completed') {
        console.log('🎯 모니터링 완료, 실제 파일 개수 계산 시작')
        updateProgress(100, '완료', '데이터셋 준비가 완료되었습니다!')
        renderLogs.value.push({ type: 'success', message: '✅ 데이터셋 준비 완료!' })
        
        // 실제 파일 개수 계산
        try {
          const fileCounts = await calculateDatasetFiles()
          console.log('📊 모니터링에서 계산된 파일 개수:', fileCounts)
          renderLogs.value.push({ type: 'info', message: `📊 준비된 파일: 이미지 ${fileCounts.images}개, 라벨 ${fileCounts.labels}개, 메타데이터 ${fileCounts.metadata}개` })
          addNotification('success', '데이터셋 준비 완료', `이미지 ${fileCounts.images}개, 라벨 ${fileCounts.labels}개, 메타데이터 ${fileCounts.metadata}개가 준비되었습니다.`)
        } catch (error) {
          console.error('모니터링에서 파일 개수 계산 오류:', error)
          renderLogs.value.push({ type: 'info', message: `📊 준비된 파일: 이미지 ${data.imageCount || 0}개, 라벨 ${data.labelCount || 0}개, 메타데이터 ${data.metadataCount || 0}개` })
          addNotification('success', '데이터셋 준비 완료', `이미지 ${data.imageCount || 0}개, 라벨 ${data.labelCount || 0}개, 메타데이터 ${data.metadataCount || 0}개가 준비되었습니다.`)
        }
        
        /* 완료 후 수동 닫기 */ // 🔧 수정됨
        break
      } else if (data.status === 'failed') {
        updateProgress(0, '오류', `데이터셋 준비 실패: ${data.error || '알 수 없는 오류'}`)
        renderLogs.value.push({ type: 'error', message: `데이터셋 준비 실패: ${data.error || '알 수 없는 오류'}` })
        addNotification('error', '데이터셋 준비 실패', data.error || '알 수 없는 오류')
        /* 실패 후 수동 닫기 */ // 🔧 수정됨
        break
      }
      
      updateProgress(data.progress || 0, '데이터셋 준비 중...', `진행률: ${data.progress || 0}%`)
      renderLogs.value.push({ type: 'info', message: `📋 데이터셋 준비 진행률: ${data.progress || 0}%` })
      await new Promise(resolve => setTimeout(resolve, 5000)) // 5초 대기
      attempts++
    } catch (error) {
      renderLogs.value.push({ type: 'error', message: `데이터셋 준비 모니터링 오류: ${error.message}` })
      updateProgress(0, '오류', `데이터셋 준비 모니터링 오류: ${error.message}`)
      addNotification('error', '데이터셋 준비 모니터링 오류', error.message)
      /* 모니터링 오류 후 수동 닫기 */ // 🔧 수정됨
      break
    }
  }
  
  if (attempts >= maxAttempts) {
    updateProgress(0, '타임아웃', '데이터셋 준비 타임아웃: 최대 대기 시간을 초과했습니다')
    renderLogs.value.push({ type: 'error', message: '데이터셋 준비 타임아웃: 최대 대기 시간을 초과했습니다' })
    addNotification('error', '데이터셋 준비 타임아웃', '최대 대기 시간을 초과했습니다')
    /* 타임아웃 후 수동 닫기 */ // 🔧 수정됨
  }
}

// 경로 설정 로드
const loadPathSetting = async () => {
  try {
    const response = await fetchWithPortDetection('/api/synthetic/config/path')
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        syntheticRootPath.value = data.configuredPath || data.currentPath || ''
        currentPath.value = data.currentPath || ''
        currentDatasetPath.value = data.datasetPath || ''
      }
    }
  } catch (error) {
    console.error('경로 설정 로드 실패:', error)
  }
}

// 경로 설정 업데이트
const updatePathSetting = async () => {
  if (!syntheticRootPath.value || isUpdatingPath.value) return
  
  try {
    isUpdatingPath.value = true
    const response = await fetchWithPortDetection('/api/synthetic/config/path', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: syntheticRootPath.value
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        currentPath.value = data.currentPath || ''
        currentDatasetPath.value = data.datasetPath || ''
        alert(`✅ 경로 설정이 업데이트되었습니다.\n\n새 경로: ${data.newPath}\n\n⚠️ 서버 재시작 후 모든 스크립트에 적용됩니다.`)
      } else {
        alert(`❌ 경로 설정 업데이트 실패: ${data.error || '알 수 없는 오류'}`)
      }
    } else {
      const data = await response.json()
      alert(`❌ 경로 설정 업데이트 실패: ${data.error || '서버 오류'}`)
    }
  } catch (error) {
    console.error('경로 설정 업데이트 실패:', error)
    alert(`❌ 경로 설정 업데이트 실패: ${error.message}`)
  } finally {
    isUpdatingPath.value = false
  }
}

// 컴포넌트 마운트 시 초기화
onMounted(async () => {
  try {
    // Synthetic API 포트 감지
    await detectSyntheticApiPort()
    
    // 경로 설정 로드
    await loadPathSetting()
    
    // 자동 학습 설정 로드
    const { data, error } = await supabase
      .from('automation_config')
      .select('config_value')
      .eq('config_key', 'auto_training_enabled')
      .single()
    
    if (data && data.config_value) {
      autoTrainingEnabled.value = data.config_value === 'true'
    }
  } catch (error) {
    console.error('초기화 실패:', error)
  }
})

</script>

<style scoped>
.synthetic-dataset-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* 헤더 */
.header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
}

.header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.header p {
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

/* 탭 네비게이션 */
.tab-navigation {
  display: flex;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 8px;
  margin-bottom: 30px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  position: relative;
}

.tab-button:hover {
  background: rgba(255,255,255,0.5);
}

.tab-button.active {
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  color: #667eea;
}

.tab-icon {
  font-size: 1.2rem;
}

.tab-label {
  font-size: 0.9rem;
}

.tab-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff4757;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
}

/* 탭 컨텐츠 */
.tab-content {
  min-height: 600px;
}

.tab-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-header {
  margin-bottom: 30px;
  text-align: center;
}

.panel-header h2 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 1.8rem;
}

.panel-header p {
  margin: 0;
  color: #7f8c8d;
  font-size: 1rem;
}

/* 카드 스타일 */
.info-card, .settings-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border: 1px solid #e9ecef;
}

.info-card h3, .settings-card h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
  font-size: 1.3rem;
}

/* 스키마 정보 */
.schema-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.schema-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.schema-label {
  font-weight: 600;
  color: #495057;
}

.schema-value {
  font-family: 'Courier New', monospace;
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.schema-item small {
  color: #6c757d;
  font-size: 0.8rem;
}

/* 설정 컨트롤 */
.settings-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-weight: 500;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 50px;
  height: 24px;
  background: #ddd;
  border-radius: 24px;
  transition: all 0.3s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.toggle-input:checked + .toggle-slider {
  background: #667eea;
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(26px);
}

.setting-info {
  margin-top: 12px;
}

.info-text {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.9rem;
}

.info-text.enabled {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.info-text.disabled {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* 렌더링 컨트롤 */
.rendering-controls {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.control-section h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.render-options {
  margin-bottom: 24px;
}

.render-type-selector {
  display: flex;
  gap: 20px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
}

.radio-input {
  display: none;
}

.radio-custom {
  width: 20px;
  height: 20px;
  border: 2px solid #ddd;
  border-radius: 50%;
  position: relative;
  transition: all 0.3s ease;
}

.radio-input:checked + .radio-custom {
  border-color: #667eea;
}

.radio-input:checked + .radio-custom::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: #667eea;
  border-radius: 50%;
}

.single-part-controls, .set-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-weight: 600;
  color: #495057;
}

.form-input {
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
}

.path-input {
  flex: 1;
}

.path-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.path-info {
  margin-top: 10px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
}

.path-help {
  display: block;
  margin-top: 8px;
  color: #666;
  font-size: 0.85rem;
  line-height: 1.4;
}

.setting-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

/* 버튼 스타일 */
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
  transform: translateY(-2px);
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

/* 진행 상황 */
.rendering-progress {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin: 16px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-weight: 600;
  color: #495057;
  margin: 8px 0;
}

.current-task {
  margin: 16px 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

/* 로그 */
.rendering-logs {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.rendering-logs h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f8f9fa;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  font-size: 0.8rem;
  color: #6c757d;
  min-width: 80px;
}

.log-message {
  flex: 1;
  font-size: 0.9rem;
}

.log-entry.info .log-message {
  color: #495057;
}

.log-entry.success .log-message {
  color: #28a745;
}

.log-entry.warning .log-message {
  color: #ffc107;
}

.log-entry.error .log-message {
  color: #dc3545;
}

/* 검증 결과 */
.validation-controls {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.validation-info {
  margin: 12px 0 0 0;
  color: #6c757d;
  font-size: 0.9rem;
}

.validation-results {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.stat-label {
  font-weight: 600;
  color: #495057;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #2c3e50;
}

.stat-value.success {
  color: #28a745;
}

/* 데이터셋 구조 */
.dataset-controls {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.dataset-mode-selection {
  width: 100%;
  margin-bottom: 20px;
}

.dataset-mode-selection h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1.1rem;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f8f9fa;
}

.mode-option:hover {
  border-color: #007bff;
  background: #f0f8ff;
}

.mode-option input[type="radio"] {
  margin: 0;
  transform: scale(1.2);
}

.mode-option input[type="radio"]:checked + .mode-label {
  color: #007bff;
}

.mode-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mode-label strong {
  font-size: 1rem;
  color: #333;
}

.mode-label small {
  color: #666;
  font-size: 0.9rem;
}

/* 데이터셋 버전 관리 */
.dataset-version-management {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.dataset-version-management h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.version-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.version-list {
  margin-top: 20px;
}

.version-list h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1.1rem;
}

.version-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f8f9fa;
}

.version-item:hover {
  border-color: #007bff;
  background: #f0f8ff;
}

.version-item.current {
  border-color: #28a745;
  background: #f0fff4;
}

.version-item.selected {
  border-color: #007bff;
  background: #e3f2fd;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
  transform: scale(1.02);
}

.version-item.selected .version-number {
  color: #007bff;
  font-weight: bold;
}

.version-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.version-number {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
}

.current-badge {
  background: #28a745;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
}

.selected-badge {
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-counts {
  color: #666;
  font-size: 0.9rem;
}

.version-date {
  color: #999;
  font-size: 0.8rem;
}

.version-description {
  color: #555;
  font-size: 0.9rem;
  font-style: italic;
}

/* 진행률 모달 스타일 구식 정의 제거 */ /* // 🔧 수정됨 */

.progress-steps {
  margin-top: 20px;
}

.progress-step {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #e9ecef;
}

.progress-step:last-child {
  border-bottom: none;
}

.step-icon {
  font-size: 24px;
  margin-right: 15px;
  width: 30px;
  text-align: center;
}

.step-content {
  flex: 1;
}

.step-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
}

.step-status {
  font-size: 14px;
  color: #666;
}

.progress-step.pending .step-status {
  color: #999;
}

.progress-step.running .step-status {
  color: #007bff;
}

.progress-step.completed .step-status {
  color: #28a745;
}

.progress-step.failed .step-status {
  color: #dc3545;
}

/* 선형 진행률 UI 추가 */ /* // 🔧 수정됨 */
.progress-linear {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.progress-bar {
  width: 100%;
  height: 10px;
  background: #eef2f7;
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  transition: width 0.25s ease;
}

.progress-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #374151;
  font-weight: 500;
}

.progress-message {
  color: #6b7280;
  font-size: 0.9rem;
}

/* 도움말 섹션 */
.version-help {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  margin-bottom: 20px;
  overflow: hidden;
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #e3f2fd;
  border-bottom: 1px solid #e9ecef;
}

.help-header h4 {
  margin: 0;
  color: #1976d2;
  font-size: 1.1rem;
}

.help-toggle {
  background: #1976d2;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.help-toggle:hover {
  background: #1565c0;
}

.help-content {
  padding: 20px;
}

.help-section {
  margin-bottom: 20px;
}

.help-section:last-child {
  margin-bottom: 0;
}

.help-section h5 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
}

.help-section ul {
  margin: 0;
  padding-left: 20px;
}

.help-section li {
  margin-bottom: 8px;
  color: #555;
  line-height: 1.5;
}

.help-section li:last-child {
  margin-bottom: 0;
}

.help-section strong {
  color: #1976d2;
  font-weight: 600;
}

.dataset-info {
  margin: 12px 0 0 0;
  color: #6c757d;
  font-size: 0.9rem;
}

.dataset-structure {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.dataset-structure h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.structure-tree {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}

.folder-item, .file-item {
  padding: 4px 0;
  color: #495057;
}

.folder-children {
  margin-left: 20px;
  border-left: 1px solid #e9ecef;
  padding-left: 12px;
}

/* 학습 컨트롤 */
.training-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.training-info, .training-status {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.training-info h3, .training-status h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.command-box {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #495057;
  word-break: break-all;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6c757d;
}

.status-dot.idle {
  background: #6c757d;
}

.status-dot.running {
  background: #28a745;
  animation: pulse 2s infinite;
}

.status-dot.completed {
  background: #17a2b8;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* 검색 관련 스타일 */
.search-type-selector {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.search-inputs {
  margin-bottom: 20px;
}

.input-with-button {
  display: flex;
  gap: 10px;
  align-items: center;
}

.input-with-button .form-input {
  flex: 1;
}

.input-help {
  display: block;
  margin-top: 5px;
  color: #666;
  font-size: 0.85rem;
}

.search-results {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.search-results h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1.1rem;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-item:hover {
  background: #f0f8ff;
  border-color: #667eea;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-element-id {
  font-weight: bold;
  color: #667eea;
  font-size: 1.1rem;
}

.result-part-name {
  color: #333;
  font-size: 0.95rem;
}

.result-part-id {
  color: #666;
  font-size: 0.85rem;
}

.result-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .tab-navigation {
    flex-direction: column;
  }
  
  .tab-button {
    justify-content: flex-start;
  }
  
  .training-controls {
    grid-template-columns: 1fr;
  }
  
  .result-stats {
    grid-template-columns: 1fr;
  }
  
  .search-type-selector {
    flex-direction: column;
    gap: 10px;
  }
  
  .input-with-button {
    flex-direction: column;
    align-items: stretch;
  }
  
  .result-item {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .result-actions {
    justify-content: center;
  }
}

/* 알림 시스템 스타일 */
.notifications-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
}

.notification {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-left: 4px solid #ddd;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: slideIn 0.3s ease;
}

.notification:hover {
  transform: translateX(-5px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.notification-success {
  border-left-color: #10b981;
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
}

.notification-error {
  border-left-color: #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}

.notification-warning {
  border-left-color: #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.notification-info {
  border-left-color: #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

.notification-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.notification-close:hover {
  background: #f3f4f6;
  color: #374151;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
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
  z-index: 10001;
  animation: fadeIn 0.3s ease;
}

.progress-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.progress-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.progress-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.progress-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.progress-content {
  padding: 24px;
}

.progress-steps {
  margin-top: 20px;
}

.progress-step {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #e9ecef;
}

.progress-step:last-child {
  border-bottom: none;
}

.step-icon {
  font-size: 24px;
  margin-right: 15px;
  width: 30px;
  text-align: center;
}

.step-content {
  flex: 1;
}

.step-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
}

.step-status {
  font-size: 14px;
  color: #666;
}

.progress-step.pending .step-status {
  color: #999;
}

.progress-step.running .step-status {
  color: #007bff;
}

.progress-step.completed .step-status {
  color: #28a745;
}

.progress-step.failed .step-status {
  color: #dc3545;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 검증 탭 개선 스타일 */
.validation-tab {
  padding: 24px;
}

.validation-controls {
  margin-bottom: 24px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.btn-validate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
}

.btn-icon {
  font-size: 18px;
}

.validation-info {
  margin-top: 12px;
  color: #6b7280;
  font-size: 14px;
}

/* 요약 카드 */
.validation-summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 2px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.summary-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.summary-card.card-success {
  border-color: #10b981;
  background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%);
}

.summary-card.card-error {
  border-color: #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);
}

.summary-card.card-info {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
}

.card-icon {
  font-size: 32px;
  line-height: 1;
}

.card-content {
  flex: 1;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 14px;
  color: #6b7280;
}

.card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.stat-badge {
  padding: 4px 12px;
  background: #f3f4f6;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

.stat-badge.success {
  background: #d1fae5;
  color: #065f46;
}

.stat-badge.error {
  background: #fee2e2;
  color: #991b1b;
}

/* 검증 카테고리 */
.validation-categories {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.validation-category {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.category-header.has-issues {
  background: #fef2f2;
  border-bottom-color: #fecaca;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.category-icon {
  font-size: 20px;
}

.category-count {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #d1fae5;
  color: #065f46;
}

.category-count.success {
  background: #d1fae5;
  color: #065f46;
}

.category-count.error {
  background: #fee2e2;
  color: #991b1b;
}

.category-count.warning {
  background: #fef3c7;
  color: #92400e;
}

.category-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #fee2e2;
  color: #991b1b;
}

.category-content {
  padding: 20px;
}

/* 이슈 섹션 */
.issue-section {
  margin-bottom: 16px;
}

.issue-section:last-child {
  margin-bottom: 0;
}

.issue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.issue-icon {
  font-size: 18px;
}

.issue-title {
  flex: 1;
}

.issue-actions {
  margin-bottom: 12px;
}

.btn-fix-all {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-fix-all:hover:not(:disabled) {
  background: #2563eb;
}

.btn-fix-all:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.issue-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.issue-item {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
  color: #374151;
  font-family: 'Courier New', monospace;
}

.issue-item:last-child {
  border-bottom: none;
}

.issue-item.error {
  background: #fef2f2;
  color: #991b1b;
}

.issue-item.warning {
  background: #fffbeb;
  color: #92400e;
}

.issue-item-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.issue-item-action:last-child {
  border-bottom: none;
}

.issue-path {
  flex: 1;
  font-size: 13px;
  color: #374151;
  font-family: 'Courier New', monospace;
  word-break: break-all;
}

.btn-fix-single {
  padding: 4px 12px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-left: 12px;
  white-space: nowrap;
}

.btn-fix-single:hover:not(:disabled) {
  background: #059669;
}

.btn-fix-single:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.webp-quality-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bucket-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-box {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  text-align: center;
}

.stat-box.success {
  background: #ecfdf5;
  border-color: #10b981;
}

.stat-box.error {
  background: #fef2f2;
  border-color: #ef4444;
}

.stat-box .stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.stat-box .stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.stat-box.success .stat-value {
  color: #065f46;
}

.stat-box.error .stat-value {
  color: #991b1b;
}

.database-stats-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

/* 검증 결과 개선 스타일 */
.validation-summary {
  margin: 16px 0;
  padding: 12px;
  border-radius: 6px;
  background: #f8f9fa;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.summary-item.success {
  color: #10b981;
  background: #ecfdf5;
  padding: 8px 12px;
  border-radius: 4px;
}

.summary-item.error {
  color: #ef4444;
  background: #fef2f2;
  padding: 8px 12px;
  border-radius: 4px;
}

.summary-icon {
  font-size: 16px;
}

.validation-errors,
.validation-warnings {
  margin-top: 16px;
}

.validation-errors h5,
.validation-warnings h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.error-list,
.warning-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: white;
}

.error-item,
.warning-item {
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  line-height: 1.4;
}

.error-item {
  color: #dc2626;
  background: #fef2f2;
}

.warning-item {
  color: #d97706;
  background: #fffbeb;
}

.error-item:last-child,
.warning-item:last-child {
  border-bottom: none;
}

/* 라벨이 없는 이미지 섹션 */
.missing-labels-section,
.missing-images-section,
.image-errors-section,
.metadata-errors-section,
.insufficient-images-section,
.webp-quality-section {
  margin-top: 20px;
  padding: 16px;
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 8px;
}

.webp-quality-section {
  background: #fef3c7;
  border: 1px solid #f59e0b;
}

.webp-quality-summary {
  margin-bottom: 12px;
}

.quality-stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #78350f;
}

.stat-valid {
  color: #166534;
  font-weight: 600;
}

.stat-invalid {
  color: #dc2626;
  font-weight: 600;
}

.webp-quality-item {
  padding: 12px;
  margin-bottom: 8px;
  background: white;
  border: 1px solid #fde68a;
  border-radius: 4px;
}

.quality-path {
  font-weight: 600;
  color: #92400e;
  margin-bottom: 8px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.quality-metrics {
  margin-bottom: 8px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid #fef3c7;
}

.metric-row:last-child {
  border-bottom: none;
}

.metric-label {
  font-weight: 500;
  color: #78350f;
}

.metric-value {
  color: #166534;
  font-family: 'Courier New', monospace;
}

.metric-value.metric-warning {
  color: #d97706;
}

.metric-value.metric-error {
  color: #dc2626;
}

.quality-error-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-left: 4px solid #dc2626;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
}

.error-icon {
  font-size: 16px;
  color: #dc2626;
  flex-shrink: 0;
}

.error-text {
  color: #991b1b;
  font-weight: 500;
  flex: 1;
}

.metric-note {
  font-size: 11px;
  color: #6b7280;
  font-style: italic;
  margin-left: 4px;
}

.quality-issues {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #fde68a;
}

.quality-warnings {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #fde68a;
}

.issue-title {
  font-weight: 600;
  color: #dc2626;
  font-size: 12px;
  margin-bottom: 4px;
}

.issue-list {
  margin: 0;
  padding-left: 20px;
}

.issue-item {
  font-size: 12px;
  color: #991b1b;
  margin-bottom: 2px;
}

/* 분할별 표기 */
.split-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 6px 0 10px;
}

.split-cell, .split-total {
  background: #fff;
  border: 1px dashed #fde68a;
  border-radius: 4px;
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.split-total {
  grid-column: 1 / -1;
  background: #fffbeb;
}

.split-label {
  font-weight: 600;
  color: #92400e;
}

.split-value {
  font-family: 'Courier New', monospace;
  color: #334155;
}

.missing-labels-section h5,
.missing-images-section h5,
.image-errors-section h5,
.metadata-errors-section h5,
.insufficient-images-section h5 {
  margin: 0 0 12px 0;
  color: #92400e;
  font-size: 16px;
  font-weight: 600;
}

.missing-labels-controls {
  margin-bottom: 12px;
}

.btn-generate-all,
.btn-generate-single {
  padding: 8px 16px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-generate-all:hover:not(:disabled),
.btn-generate-single:hover:not(:disabled) {
  background: #d97706;
}

.btn-generate-all:disabled,
.btn-generate-single:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.btn-generate-all {
  margin-bottom: 12px;
}

.missing-labels-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #fde68a;
  border-radius: 4px;
  background: white;
}

.missing-label-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #fef3c7;
  font-size: 13px;
}

.missing-label-item:last-child {
  border-bottom: none;
}

.missing-label-item .label-path {
  flex: 1;
  color: #78350f;
  font-family: 'Courier New', monospace;
}

.btn-generate-single {
  padding: 4px 12px;
  font-size: 12px;
  margin-left: 12px;
}

/* 버킷 동기화 결과 스타일 */
.bucket-sync-results {
  margin-top: 20px;
  padding: 16px;
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 8px;
}

.bucket-sync-results h4 {
  margin: 0 0 12px 0;
  color: #0c4a6e;
  font-size: 16px;
  font-weight: 600;
}

.bucket-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.sync-errors {
  margin-top: 12px;
}

.sync-errors h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #dc2626;
}

.sync-error-list {
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #fecaca;
  border-radius: 4px;
  background: #fef2f2;
}

.sync-error-item {
  padding: 6px 12px;
  border-bottom: 1px solid #fecaca;
  font-size: 12px;
  line-height: 1.4;
  color: #dc2626;
}

.sync-error-item:last-child {
  border-bottom: none;
}

/* 데이터베이스 통계 스타일 */
.database-stats {
  margin-top: 16px;
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #22c55e;
  border-radius: 6px;
}

.database-stats h5 {
  margin: 0 0 8px 0;
  color: #166534;
  font-size: 14px;
  font-weight: 600;
}

</style>