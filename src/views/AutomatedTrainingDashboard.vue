<template>
  <div class="automated-training-dashboard">
    <!-- 학습 모니터링 모달 -->
    <TrainingMonitorModal
      :visible="trainingMonitorStore.isModalVisible"
      :training-job-id="String(trainingMonitorStore.currentTrainingJob || '')"
      @close="closeTrainingModal"
      @pause="pauseTraining"
      @resume="resumeTraining"
      @stop="stopTraining"
    />
    <!-- 상단 헤더 -->
    <header class="dashboard-header">
      <div class="header-content">
        <div class="header-title">
          <h1>🧱 BrickBox AI 학습 대시보드</h1>
          <p>자동화된 YOLO 학습 및 성능 모니터링 시스템</p>
        </div>
        <div class="header-status">
          <div class="status-indicator" :class="{ connected: isConnected }">
            <span class="status-dot"></span>
            <span>{{ isConnected ? '실시간 연결됨' : '연결 끊김' }}</span>
          </div>
          <button @click="refreshAllData" :disabled="isLoading" class="btn-refresh-all">
            <span class="refresh-icon">🔄</span>
            전체 새로고침
          </button>
        </div>
      </div>
    </header>

    <!-- 메인 대시보드 그리드 -->
    <div class="dashboard-grid">
      <!-- 시스템 상태 카드 -->
      <div class="status-card main-status">
        <div class="card-header">
          <h2>📊 시스템 상태</h2>
          <div class="status-badge" :class="systemStatus">
            {{ getPerformanceStatusText() }}
          </div>
        </div>
        <div class="status-content">
          <div class="status-metrics">
            <div class="metric-item">
              <span class="metric-label">활성 모델</span>
              <span class="metric-value">{{ currentModel ? currentModel.model_name : '없음' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">학습 작업</span>
              <span class="metric-value">{{ trainingJobs.length }}개</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">위반 지표</span>
              <span class="metric-value" :class="violations.length > 0 ? 'critical' : 'healthy'">
                {{ violations.length }}개
              </span>
            </div>
          </div>
          <div class="status-actions">
            <button @click="loadPerformanceMetrics" :disabled="isLoadingMetrics" class="btn-status">
              {{ isLoadingMetrics ? '로딩 중...' : '지표 새로고침' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 실시간 성능 모니터링 -->
      <div class="monitoring-card">
        <div class="card-header">
          <h2>⚡ 실시간 성능 모니터링</h2>
          <div class="monitoring-controls">
            <button @click="toggleAutoRefresh" class="btn-toggle" :class="{ active: autoRefreshEnabled }">
              {{ autoRefreshEnabled ? '자동 새로고침 ON' : '자동 새로고침 OFF' }}
            </button>
          </div>
        </div>
        <div class="monitoring-content">
          <!-- Stage-1 (탐지) 성능 -->
          <div class="stage-section">
            <h3>🔍 Stage-1: YOLO 탐지 성능</h3>
            <div class="metrics-row">
              <div class="metric-card" :class="getMetricStatus('recall')">
                <div class="metric-header">
                  <span class="metric-name">소형 Recall</span>
                  <span class="metric-value">
                    {{ performanceMetrics.recall > 0 ? performanceMetrics.recall.toFixed(3) : '데이터 없음' }}
                  </span>
                </div>
                <div class="metric-threshold">SLO: {{ performanceThresholds.recall }}</div>
              </div>
              <div class="metric-card" :class="getMetricStatus('detectionLatency')">
                <div class="metric-header">
                  <span class="metric-name">탐지 지연</span>
                  <span class="metric-value">
                    {{ performanceMetrics.detectionLatency > 0 ? performanceMetrics.detectionLatency + 'ms' : '데이터 없음' }}
                  </span>
                </div>
                <div class="metric-threshold">SLO: {{ performanceThresholds.detectionLatency }}ms</div>
              </div>
            </div>
          </div>

          <!-- Stage-2 (식별) 성능 -->
          <div class="stage-section">
            <h3>🎯 Stage-2: FAISS 식별 성능</h3>
            <div class="metrics-row">
              <div class="metric-card" :class="getMetricStatus('top1Accuracy')">
                <div class="metric-header">
                  <span class="metric-name">Top-1@BOM</span>
                  <span class="metric-value">
                    {{ performanceMetrics.top1Accuracy > 0 ? performanceMetrics.top1Accuracy.toFixed(3) : '데이터 없음' }}
                  </span>
                </div>
                <div class="metric-threshold">SLO: {{ performanceThresholds.top1Accuracy }}</div>
              </div>
              <div class="metric-card" :class="getMetricStatus('stage2Rate')">
                <div class="metric-header">
                  <span class="metric-name">Stage-2 진입률</span>
                  <span class="metric-value">
                    {{ performanceMetrics.stage2Rate > 0 ? (performanceMetrics.stage2Rate * 100).toFixed(1) + '%' : '데이터 없음' }}
                  </span>
                </div>
                <div class="metric-threshold">SLO: ≤ {{ (performanceThresholds.stage2Rate * 100) }}%</div>
              </div>
              <div class="metric-card" :class="getMetricStatus('searchLatency')">
                <div class="metric-header">
                  <span class="metric-name">검색 지연</span>
                  <span class="metric-value">
                    {{ performanceMetrics.searchLatency > 0 ? performanceMetrics.searchLatency + 'ms' : '데이터 없음' }}
                  </span>
                </div>
                <div class="metric-threshold">SLO: {{ performanceThresholds.searchLatency }}ms</div>
              </div>
            </div>
          </div>

          <!-- 전체 파이프라인 성능 -->
          <div class="stage-section">
            <h3>⚡ 전체 파이프라인 성능</h3>
            <div class="metrics-row">
              <div class="metric-card" :class="getMetricStatus('p95Latency')">
                <div class="metric-header">
                  <span class="metric-name">전체 지연 (p95)</span>
                  <span class="metric-value">
                    {{ performanceMetrics.p95Latency > 0 ? performanceMetrics.p95Latency + 'ms' : '데이터 없음' }}
                  </span>
                </div>
                <div class="metric-threshold">SLO: {{ performanceThresholds.p95Latency }}ms</div>
              </div>
              <div class="metric-card" :class="getMetricStatus('holdRate')">
                <div class="metric-header">
                  <span class="metric-name">보류율</span>
                  <span class="metric-value">
                    {{ performanceMetrics.holdRate > 0 ? (performanceMetrics.holdRate * 100).toFixed(1) + '%' : '데이터 없음' }}
                  </span>
                </div>
                <div class="metric-threshold">SLO: ≤ {{ (performanceThresholds.holdRate * 100) }}%</div>
              </div>
              <div class="metric-card" :class="getMetricStatus('webpDecodeP95')">
                <div class="metric-header">
                  <span class="metric-name">WebP 디코딩</span>
                  <span class="metric-value">
                    {{ performanceMetrics.webpDecodeP95 > 0 ? performanceMetrics.webpDecodeP95 + 'ms' : '데이터 없음' }}
                  </span>
                </div>
                <div class="metric-threshold">SLO: {{ performanceThresholds.webpDecodeP95 }}ms</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 학습 작업 관리 -->
      <div class="training-card">
        <div class="card-header">
          <h2>🚀 학습 작업 관리</h2>
          <div class="training-controls">
            <button @click="refreshTrainingJobs" :disabled="isLoading" class="btn-refresh">
              <span class="refresh-icon">🔄</span>
              새로고침
            </button>
          </div>
        </div>
        <div class="training-content">
          <!-- 현재 활성 작업 -->
          <div v-if="activeTrainingJobs.length > 0" class="active-jobs">
            <h3>🔄 진행 중인 작업</h3>
            <div class="job-list">
              <div v-for="job in activeTrainingJobs" :key="job.id" class="job-card active">
                <div class="job-header">
                  <h4>{{ job.job_name }}</h4>
                  <span class="job-status" :class="job.status">{{ job.status }}</span>
                </div>
                <div class="job-progress">
                  <div v-if="job.progress" class="progress-bar">
                    <div class="progress-fill" :style="{ width: getProgressPercentage(job) + '%' }"></div>
                  </div>
                  <div class="progress-info">
                    <span v-if="job.progress">에폭: {{ job.progress.current_epoch }} / {{ job.progress.final_epoch || '?' }}</span>
                    <span v-if="job.latest_metrics">mAP50: {{ (job.latest_metrics.metrics?.mAP50_B || 0).toFixed(3) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 최근 완료된 작업 -->
          <div v-if="completedTrainingJobs.length > 0" class="completed-jobs">
            <h3>✅ 최근 완료된 작업</h3>
            <div class="job-list">
              <div v-for="job in completedTrainingJobs.slice(0, 3)" :key="job.id" class="job-card completed">
                <div class="job-header">
                  <h4>{{ job.job_name }}</h4>
                  <span class="job-status" :class="job.status">{{ job.status }}</span>
                </div>
                <div class="job-metrics" v-if="job.progress?.final_metrics">
                  <div class="metric-item">
                    <span>mAP50(Box): {{ (job.progress.final_metrics.mAP50_B || 0).toFixed(3) }}</span>
                  </div>
                  <div class="metric-item">
                    <span>mAP50(Mask): {{ (job.progress.final_metrics.mAP50_M || 0).toFixed(3) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 작업이 없는 경우 -->
          <div v-if="trainingJobs.length === 0" class="no-jobs">
            <p>현재 학습 작업이 없습니다.</p>
            <p>새로운 학습을 시작하세요.</p>
          </div>
        </div>
      </div>

      <!-- 모델 관리 -->
      <div class="model-card">
        <div class="card-header">
          <h2>🏆 모델 관리</h2>
          <div class="model-controls">
            <button @click="refreshData" :disabled="isLoading" class="btn-refresh">
              <span class="refresh-icon">🔄</span>
              새로고침
            </button>
          </div>
        </div>
        <div class="model-content">
          <!-- 현재 활성 모델 -->
          <div v-if="currentModel" class="current-model">
            <h3>현재 활성 모델</h3>
            <div class="model-info">
              <div class="model-basic">
                <h4>{{ currentModel.model_name }}</h4>
                <span class="version">v{{ currentModel.version }}</span>
                <span class="status" :class="currentModel.status">{{ currentModel.status }}</span>
              </div>
              <div class="model-metrics">
                <div class="metric-item">
                  <span class="metric-label">mAP50</span>
                  <span class="metric-value">{{ (currentModel.metrics?.mAP50 || 0).toFixed(3) }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Precision</span>
                  <span class="metric-value">{{ (currentModel.metrics?.precision || 0).toFixed(3) }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Recall</span>
                  <span class="metric-value">{{ (currentModel.metrics?.recall || 0).toFixed(3) }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">모델 크기</span>
                  <span class="metric-value">{{ modelSizeFormatted }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 모델 히스토리 -->
          <div v-if="modelHistory.length > 0" class="model-history">
            <h3>모델 히스토리</h3>
            <div class="history-list">
              <div v-for="model in modelHistory.slice(0, 5)" :key="model.id" class="history-item" :class="{ active: model.status === 'active' }">
                <div class="model-info">
                  <h4>{{ model.model_name }}</h4>
                  <span class="version">v{{ model.version }}</span>
                  <span class="status" :class="model.status">{{ model.status }}</span>
                </div>
                <div class="model-actions">
                  <button v-if="model.status !== 'active'" @click="activateModel(model.id)" :disabled="isLoading" class="btn-activate">
                    활성화
                  </button>
                  <button @click="viewModelDetails(model)" class="btn-details">
                    상세보기
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 모델이 없는 경우 -->
          <div v-else class="no-model">
            <p>활성 모델이 없습니다</p>
            <p>새로운 학습을 통해 모델을 생성하거나 기존 모델을 활성화하세요.</p>
            <div class="model-actions">
              <button 
                @click="syncModelsFromStorage" 
                :disabled="isLoading"
                class="btn-sync-models"
              >
                🔄 Storage에서 모델 동기화
              </button>
              <button 
                @click="activateLatestModel" 
                :disabled="isLoading"
                class="btn-activate-model"
              >
                ⚡ 최신 모델 활성화
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 세트 단위 학습 -->
      <div class="set-training-card">
        <div class="card-header">
          <h2>🎯 세트 단위 학습</h2>
          <HelpTooltip 
            title="세트 단위 하이브리드 학습"
            content="특정 레고 세트의 부품들을 대상으로 1단계(YOLO11n-seg)와 2단계(YOLO11s-seg) 모델을 순차적으로 학습합니다. 빠른 스캔과 정밀 검증을 모두 지원합니다."
            :examples="['1단계: 빠른 스캔', '2단계: 정밀 검증', '하이브리드 시스템']"
          />
        </div>
        <div class="set-training-content">
          <!-- 학습 타입 선택 -->
          <div class="training-type-section">
            <h3>📚 학습 타입 선택</h3>
            <div class="training-type-options">
              <label class="training-type-option" :class="{ active: trainingType === 'set' }">
                <input 
                  type="radio" 
                  v-model="trainingType" 
                  value="set"
                  class="training-type-radio"
                />
                <div class="option-content">
                  <div class="option-icon">🎯</div>
                <div class="option-text">
                  <div class="option-title">세트 단위 학습</div>
                  <div class="option-description">특정 레고 세트의 모든 부품을 대상으로 학습 (세트 번호: 76917, 10220 등)</div>
                </div>
                </div>
              </label>
              <label class="training-type-option" :class="{ active: trainingType === 'part' }">
                <input 
                  type="radio" 
                  v-model="trainingType" 
                  value="part"
                  class="training-type-radio"
                />
                <div class="option-content">
                  <div class="option-icon">🧩</div>
                <div class="option-text">
                  <div class="option-title">부품 단위 학습</div>
                  <div class="option-description">특정 부품 ID 또는 엘리먼트 ID를 대상으로 개별 학습 (부품 ID: 3001, 엘리먼트 ID: 6335317 등)</div>
                </div>
                </div>
              </label>
            </div>
          </div>

          <!-- 학습 파라미터 설정 -->
          <div class="training-params-section">
            <h3>⚙️ 학습 파라미터 설정</h3>
            <div class="params-grid">
              <div class="param-group">
                <label for="epochs">에폭 수</label>
                <input 
                  id="epochs"
                  v-model.number="trainingParams.epochs" 
                  type="number" 
                  min="1" 
                  max="1000"
                  class="param-input"
                />
                <small class="param-help">학습 반복 횟수 (기술문서 권장: 100, Early Stopping=15)</small>
              </div>
              <div class="param-group">
                <label for="batchSize">배치 크기</label>
                <input 
                  id="batchSize"
                  v-model.number="trainingParams.batchSize" 
                  type="number" 
                  min="1" 
                  max="64"
                  class="param-input"
                />
                <small class="param-help">GPU 메모리에 따라 조정 (기술문서 권장: 16-32)</small>
              </div>
              <div class="param-group">
                <label for="imageSize">이미지 크기</label>
                <select 
                  id="imageSize"
                  v-model.number="trainingParams.imageSize" 
                  class="param-select"
                >
                  <option value="416">416px (빠름)</option>
                  <option value="512">512px (균형)</option>
                  <option value="640">640px (빠름)</option>
                  <option value="768">768px (기술문서 권장)</option>
                  <option value="960">960px (최고품질)</option>
                </select>
                <small class="param-help">이미지 해상도 (높을수록 정확하지만 느림)</small>
              </div>
              <div class="param-group">
                <label for="device">사용 디바이스</label>
                <select 
                  id="device"
                  v-model="trainingParams.device" 
                  class="param-select"
                >
                  <option value="cuda">GPU (CUDA)</option>
                  <option value="cpu">CPU</option>
                  <option value="auto">자동 선택</option>
                </select>
                <small class="param-help">학습에 사용할 디바이스</small>
              </div>
            </div>
            <div class="params-actions">
              <button @click="resetTrainingParams" class="btn-reset">기본값으로 초기화</button>
              <button @click="applyPreset('fast')" class="btn-preset fast">빠른 프로토타이핑 (10 에폭)</button>
              <button @click="applyPreset('balanced')" class="btn-preset balanced">기술문서 권장 (100 에폭)</button>
              <button @click="applyPreset('quality')" class="btn-preset quality">고품질 학습 (150 에폭)</button>
            </div>
          </div>

          <!-- 세트 단위 학습 입력 -->
          <div v-if="trainingType === 'set'" class="set-input-section">
            <div class="input-group">
              <label for="setNum">레고 세트 번호</label>
              <div class="input-row">
                <input 
                  id="setNum"
                  v-model="selectedSetNum" 
                  placeholder="세트 번호 입력 (예: 76917, 10220)"
                  class="set-input"
                />
                <button 
                  @click="loadSetInfo" 
                  :disabled="!selectedSetNum || isLoading"
                  class="btn-load"
                >
                  세트 정보 로드
                </button>
              </div>
              <div class="input-help">
                <small>💡 세트 번호는 보통 4-6자리 숫자입니다 (예: 76917, 10220)</small>
              </div>
            </div>
          </div>

          <!-- 부품 단위 학습 입력 -->
          <div v-if="trainingType === 'part'" class="part-input-section">
            <div class="hybrid-info">
              <h4>🧠 하이브리드 학습 시스템</h4>
              <p>1단계(YOLO11n-seg)와 2단계(YOLO11s-seg) 모델을 순차적으로 학습하여 빠른 스캔과 정밀 검증을 모두 지원합니다.</p>
            </div>
            <div class="input-group">
              <label for="partId">부품 ID 또는 엘리먼트 ID</label>
              <div class="input-row">
                <input 
                  id="partId"
                  v-model="selectedPartId" 
                  placeholder="부품 ID (예: 3001) 또는 엘리먼트 ID (예: 6211342)"
                  class="part-input"
                />
                <button 
                  @click="loadPartInfo" 
                  :disabled="!selectedPartId || isLoading"
                  class="btn-load"
                >
                  부품 정보 로드
                </button>
              </div>
              <div class="input-help">
                <small>💡 부품 ID (예: 3001) 또는 엘리먼트 ID (예: 6335317)를 입력하세요</small>
                <br>
                <small>🔍 엘리먼트 ID는 보통 7자리 이상의 숫자입니다</small>
              </div>
            </div>
          </div>

          <!-- 세트 정보 표시 -->
          <div v-if="trainingType === 'set' && setInfo" class="set-info">
            <h3>📦 {{ setInfo.set_num }} - {{ setInfo.set_name }}</h3>
            <div class="set-details">
              <div class="detail-item">
                <span class="label">총 부품 수</span>
                <span class="value">{{ setInfo.total_parts }}개</span>
              </div>
              <div class="detail-item">
                <span class="label">이미 학습된 부품</span>
                <span class="value">{{ setInfo.trained_parts }}개</span>
              </div>
              <div class="detail-item">
                <span class="label">새로 학습할 부품</span>
                <span class="value">{{ setInfo.new_parts }}개</span>
              </div>
              <div class="detail-item">
                <span class="label">학습 상태</span>
                <span class="value status" :class="setInfo.status">{{ getStatusText(setInfo.status) }}</span>
              </div>
            </div>
            <div class="set-actions">
              <button 
                @click="startSetTraining" 
                :disabled="!setInfo || isLoading || setInfo.new_parts === 0"
                class="btn-start-training"
              >
                🎯 세트 하이브리드 학습 시작
              </button>
              <button 
                @click="checkSetTrainingStatus" 
                :disabled="!selectedSetNum || isLoading"
                class="btn-check-status"
              >
                📊 학습 상태 확인
              </button>
            </div>
          </div>

        <!-- 부품 정보 표시 -->
        <div v-if="trainingType === 'part' && partInfo" class="part-info">
          <h3>🧩 {{ partInfo.part_id }} - {{ partInfo.part_name }}</h3>
          <div class="part-details">
            <div class="detail-item">
              <span class="label">입력 타입</span>
              <span class="value">{{ partInfo.input_type === 'element_id' ? '엘리먼트 ID' : '부품 ID' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">입력값</span>
              <span class="value">{{ partInfo.input_value }}</span>
            </div>
            <div class="detail-item">
              <span class="label">부품 ID</span>
              <span class="value">{{ partInfo.part_id }}</span>
            </div>
            <div v-if="partInfo.element_id" class="detail-item">
              <span class="label">엘리먼트 ID</span>
              <span class="value">{{ partInfo.element_id }}</span>
            </div>
            <div v-if="partInfo.input_type === 'element_id'" class="detail-item highlight">
              <span class="label">입력 변환</span>
              <span class="value">엘리먼트 ID {{ partInfo.input_value }} → 부품 ID {{ partInfo.part_id }}</span>
            </div>
            <div class="detail-item">
              <span class="label">부품명</span>
              <span class="value">{{ partInfo.part_name }}</span>
            </div>
            <div class="detail-item">
              <span class="label">이미지 수</span>
              <span class="value">{{ partInfo.image_count }}개</span>
            </div>
            <div class="detail-item">
              <span class="label">학습 상태</span>
              <span class="value status" :class="partInfo.status">{{ getStatusText(partInfo.status) }}</span>
            </div>
          </div>
            <div class="part-actions">
              <button 
                @click="startPartTraining" 
                :disabled="!partInfo || isLoading || partInfo.image_count === 0"
                class="btn-start-training"
              >
                🧩 부품 하이브리드 학습 시작
              </button>
              <button 
                @click="checkPartTrainingStatus" 
                :disabled="!selectedPartId || isLoading"
                class="btn-check-status"
              >
                📊 학습 상태 확인
              </button>
              <button 
                @click="repairPartDatabase" 
                :disabled="!selectedPartId || isLoading"
                class="btn-repair"
              >
                🔧 데이터베이스 복구
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 자동 트리거 설정 -->
      <div class="trigger-card">
        <div class="card-header">
          <h2>⚙️ 자동 트리거 설정</h2>
          <div class="trigger-info">
            <span v-if="violations.length === 0" class="info-success">
              모든 지표가 SLO 범위 내에 있습니다
            </span>
            <span v-else-if="violations.length === 1" class="info-warning">
              1개 지표가 SLO를 위반했습니다. 증분 학습을 고려하세요
            </span>
            <span v-else class="info-error">
              {{ violations.length }}개 지표가 SLO를 위반했습니다. 전체 재학습을 고려하세요
            </span>
          </div>
        </div>
        <div class="trigger-content">
          <!-- Stage-1 (탐지) 트리거 -->
          <div class="trigger-section">
            <h3>🔍 Stage-1 (YOLO 탐지) 재학습</h3>
            <div class="trigger-buttons">
              <button 
                @click="triggerStage1Incremental" 
                :disabled="!canTriggerStage1Incremental"
                class="btn-trigger incremental"
              >
                Stage-1 증분 학습
              </button>
              <button 
                @click="triggerStage1FullRetrain" 
                :disabled="!canTriggerStage1FullRetrain"
                class="btn-trigger full"
              >
                Stage-1 전체 재학습
              </button>
            </div>
          </div>

          <!-- Stage-2 (식별) 트리거 -->
          <div class="trigger-section">
            <h3>🎯 Stage-2 (FAISS 식별) 재학습</h3>
            <div class="trigger-buttons">
              <button 
                @click="triggerStage2Incremental" 
                :disabled="!canTriggerStage2Incremental"
                class="btn-trigger incremental"
              >
                Stage-2 증분 학습
              </button>
              <button 
                @click="triggerStage2FullRetrain" 
                :disabled="!canTriggerStage2FullRetrain"
                class="btn-trigger full"
              >
                Stage-2 전체 재학습
              </button>
            </div>
          </div>

          <!-- 전체 파이프라인 트리거 -->
          <div class="trigger-section">
            <h3>⚡ 전체 파이프라인 재학습</h3>
            <div class="trigger-buttons">
              <button 
                @click="triggerFullPipelineRetrain" 
                :disabled="!canTriggerFullPipelineRetrain"
                class="btn-trigger full-pipeline"
              >
                전체 파이프라인 재학습
              </button>
            </div>
          </div>

          <!-- 위반 지표 상세 -->
          <div v-if="violations.length > 0" class="violations-detail">
            <h3>⚠️ 위반 지표 상세</h3>
            <div class="violations-list">
              <div v-for="violation in violations" :key="violation" class="violation-item">
                <span class="violation-icon">⚠️</span>
                <span class="violation-name">{{ getViolationName(violation) }}</span>
                <span class="violation-value">{{ getViolationValue(violation) }}</span>
                <span class="violation-threshold">SLO: {{ getViolationThreshold(violation) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 에러 메시지 -->
    <div v-if="error" class="error-message">
      <h3>❌ 오류 발생</h3>
      <p>{{ error }}</p>
      <button @click="error = null" class="btn-close">닫기</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAutomatedModelRegistry } from '@/composables/useAutomatedModelRegistry.js'
import { useTrainingMonitorStore } from '@/stores/trainingMonitor.js'
import HelpTooltip from '../components/HelpTooltip.vue'
import TrainingMonitorModal from '../components/TrainingMonitorModal.vue'
import { useSupabase } from '../composables/useSupabase.js'

// 전역 Supabase 클라이언트 사용
const { supabase } = useSupabase()

// 모델 레지스트리 훅
const {
  currentModel,
  modelHistory,
  isLoading,
  error,
  isConnected,
  modelSizeFormatted,
  modelPerformance,
  fetchLatestModel,
  fetchModelHistory,
  activateModel,
  activateLatestModel,
  startTraining
} = useAutomatedModelRegistry()

// 학습 모니터링 스토어
const trainingMonitorStore = useTrainingMonitorStore()

// 로컬 상태
const trainingJobs = ref([])

// 세트 단위 학습 상태
const selectedSetNum = ref('')
const setInfo = ref(null)

// 부품 단위 학습 상태
const trainingType = ref('set') // 'set' 또는 'part'
const selectedPartId = ref('')
const partInfo = ref(null)

// 자동 새로고침 상태
const autoRefreshEnabled = ref(true)

// 학습 파라미터 설정 (기술문서 기준)
const trainingParams = ref({
  epochs: 100,
  batchSize: 16,
  imageSize: 768,
  device: 'cuda'
})

// 성능 모니터링 관련 (2단계 모델)
const performanceMetrics = ref({
  // Stage-1 (탐지) 성능 지표
  recall: 0.0,                    // 소형 Recall
  detectionLatency: 0,            // 탐지 지연 (YOLO11m-seg)
  
  // Stage-2 (식별) 성능 지표
  top1Accuracy: 0.0,             // Top-1@BOM
  stage2Rate: 0.0,               // Stage-2 진입률
  searchLatency: 0,               // 검색 지연 (FAISS)
  
  // 전체 파이프라인 성능 지표
  p95Latency: 0,                // 전체 지연 (p95)
  holdRate: 0.0,                 // 보류율
  webpDecodeP95: 0,              // WebP 디코딩
  falseDetectionRate: 0.0,       // 오탐지율
  occlusionIQR: 0.0,             // 오클루전 IQR
  oodRate: 0.0,                  // OOD 비율
  lastUpdated: new Date().toISOString()
})

const performanceThresholds = ref({
  // Stage-1 (탐지) SLO
  recall: 0.95,                   // SLO: 소형 Recall ≥0.95
  detectionLatency: 50,           // SLO: 탐지 지연 ≤50ms
  
  // Stage-2 (식별) SLO
  top1Accuracy: 0.97,             // SLO: Top-1@BOM ≥0.97
  stage2Rate: 0.25,               // SLO: Stage-2 진입률 ≤25%
  searchLatency: 15,              // SLO: 검색 지연 ≤15ms
  
  // 전체 파이프라인 SLO
  p95Latency: 150,                // SLO: 전체 지연 ≤150ms
  holdRate: 0.07,                 // SLO: 보류율 ≤7%
  webpDecodeP95: 15,              // SLO: WebP 디코드 ≤15ms
  falseDetectionRate: 0.03,       // SLO: 오탐지율 ≤3%
  occlusionIQR: 0.15,             // 운영 지표
  oodRate: 0.02                   // 운영 지표
})

const violations = ref([])
const systemStatus = ref('healthy')
const recommendedAction = ref('none')
const isLoadingMetrics = ref(false)

// 학습 작업 목록 조회
// 학습 파라미터 관련 메서드들
const resetTrainingParams = () => {
  trainingParams.value = {
    epochs: 100,
    batchSize: 16,
    imageSize: 768,
    device: 'cuda'
  }
}

const applyPreset = (preset) => {
  switch (preset) {
    case 'fast':
      // 빠른 프로토타이핑용 (기술문서 기준의 1/10)
      trainingParams.value = {
        epochs: 10,
        batchSize: 32,
        imageSize: 640,
        device: 'cuda'
      }
      break
    case 'balanced':
      // 기술문서 권장 기준
      trainingParams.value = {
        epochs: 100,
        batchSize: 16,
        imageSize: 768,
        device: 'cuda'
      }
      break
    case 'quality':
      // 고품질 학습 (기술문서 기준의 1.5배)
      trainingParams.value = {
        epochs: 150,
        batchSize: 8,
        imageSize: 960,
        device: 'cuda'
      }
      break
  }
}

const fetchTrainingJobs = async () => {
  try {
    // 학습 작업 목록 조회 시작
    
    // 간단한 쿼리로 training_jobs만 조회
    const { data: jobsData, error: jobsError } = await supabase
      .from('training_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (jobsError) {
      // training_jobs 조회 실패
      throw jobsError
    }
    
    // 조회된 작업 수 확인
    
    // 기본 데이터 처리
    trainingJobs.value = (jobsData || []).map(job => ({
      ...job,
      latest_metrics: null, // 메트릭은 별도 조회하지 않음
      status_info: getStatusInfo(job)
    }))
    
    // 학습 작업 목록 조회 완료
    // 작업 상태별 분포 확인
    
    // 메트릭이 필요한 경우 별도로 조회 (오류 방지를 위해 선택적)
    if (trainingJobs.value.length > 0) {
      // 메트릭 조회는 백그라운드에서 실행 (오류가 있어도 메인 기능에 영향 없음)
      fetchLatestMetrics().catch(error => {
        console.warn('⚠️ 메트릭 조회 실패 (무시됨):', error)
      })
    }
    
  } catch (err) {
    console.error('❌ 학습 작업 조회 실패:', err)
    trainingJobs.value = []
  }
}

// 최신 메트릭 조회 (별도 함수)
const fetchLatestMetrics = async () => {
  try {
    console.log('📊 최신 메트릭 조회 시작...')
    
    for (const job of trainingJobs.value) {
      if (job.status === 'running' || job.status === 'completed') {
        try {
          // 먼저 training_metrics 테이블이 존재하는지 확인
          const { data: metricsData, error: metricsError } = await supabase
            .from('training_metrics')
            .select('*')
            .eq('training_job_id', job.id)
            .order('created_at', { ascending: false })
            .limit(1)
          
          if (metricsError) {
            console.warn(`⚠️ 작업 ${job.id} 메트릭 조회 실패:`, metricsError.message)
            // 테이블이 없거나 권한 문제인 경우 기본값 설정
            job.latest_metrics = null
            continue
          }
          
          if (metricsData && metricsData.length > 0) {
            const metric = metricsData[0]
            job.latest_metrics = {
              epoch: metric.epoch || 0,
              metrics: {
                mAP50_B: metric.mAP50 || 0,
                mAP50_95_B: metric.mAP50_95 || 0,
                precision_B: metric.precision || 0,
                recall_B: metric.recall || 0
              },
              created_at: metric.created_at || metric.timestamp
            }
            console.log(`✅ 작업 ${job.id} 메트릭 로드: 에폭 ${metric.epoch}, mAP50=${metric.mAP50}`)
          } else {
            job.latest_metrics = null
            console.log(`ℹ️ 작업 ${job.id} 메트릭 데이터 없음`)
          }
        } catch (error) {
          console.warn(`⚠️ 작업 ${job.id} 메트릭 조회 실패:`, error)
          job.latest_metrics = null
        }
      }
    }
    
    console.log('✅ 최신 메트릭 조회 완료')
  } catch (error) {
    console.error('❌ 최신 메트릭 조회 실패:', error)
  }
}

// 상태별 정보 생성
const getStatusInfo = (job) => {
  const now = new Date()
  const created = new Date(job.created_at)
  const started = job.started_at ? new Date(job.started_at) : null
  const completed = job.completed_at ? new Date(job.completed_at) : null
  
  const info = {
    duration: null,
    is_stuck: false,
    should_retry: false
  }
  
  if (job.status === 'running' && started) {
    const runningTime = (now - started) / 1000 / 60 // 분 단위
    info.duration = `${Math.round(runningTime)}분`
    
    // 2시간 이상 실행 중이면 stuck으로 간주
    if (runningTime > 120) {
      info.is_stuck = true
    }
  }
  
  if (job.status === 'failed') {
    // 실패한 작업은 재시도 가능
    info.should_retry = true
  }
  
  return info
}

// 상태별 분포 계산
const getStatusDistribution = (jobs) => {
  const distribution = {}
  jobs.forEach(job => {
    distribution[job.status] = (distribution[job.status] || 0) + 1
  })
  return distribution
}

// 수동 새로고침 함수
const refreshTrainingJobs = async () => {
  try {
    console.log('🔄 학습 작업 수동 새로고침 시작...')
    isLoading.value = true
    await fetchTrainingJobs()
    console.log('✅ 학습 작업 수동 새로고침 완료')
  } catch (error) {
    console.error('❌ 학습 작업 수동 새로고침 실패:', error)
  } finally {
    isLoading.value = false
  }
}

// 학습 작업 재시도
const retryTrainingJob = async (jobId) => {
  try {
    console.log(`🔄 학습 작업 ${jobId} 재시도 시작...`)
    isLoading.value = true
    
    // 실패한 작업을 pending으로 변경
    const { error } = await supabase
      .from('training_jobs')
      .update({
        status: 'pending',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    if (error) throw error
    
    console.log('✅ 학습 작업 재시도 설정 완료')
    await fetchTrainingJobs() // 목록 새로고침
  } catch (error) {
    console.error('❌ 학습 작업 재시도 실패:', error)
  } finally {
    isLoading.value = false
  }
}



// 세트 정보 로드
const loadSetInfo = async () => {
  try {
    console.log(`📦 세트 ${selectedSetNum.value} 정보 로드 중...`)
    
    // 입력값 검증: 엘리먼트 ID 패턴 감지
    const inputValue = selectedSetNum.value.trim()
    if (inputValue.length >= 7 && /^\d+$/.test(inputValue)) {
      console.warn('⚠️ 입력값이 엘리먼트 ID로 보입니다. 부품 단위 학습을 사용하세요.')
      throw new Error(`입력값 "${inputValue}"은(는) 엘리먼트 ID입니다.\n\n💡 해결 방법:\n1. "부품 단위 학습"을 선택하세요\n2. 또는 올바른 세트 번호를 입력하세요 (예: 76917, 10220)`)
    }
    
    // 디버깅: 전체 세트 목록 확인
    const { data: allSets, error: allSetsError } = await supabase
      .from('lego_sets')
      .select('set_num, name')
      .limit(10)
    
    console.log('📋 전체 세트 목록 (최대 10개):', allSets)
    if (allSetsError) {
      console.error('❌ 전체 세트 조회 오류:', allSetsError)
    }
    
    // 1. 세트 부품 정보 조회 (3단계 매칭 로직 사용)
    let legoSet = null
    
    // 1단계: 정확한 매치 시도
    try {
      const { data: exactMatch, error: exactError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', selectedSetNum.value)
        .limit(1)
      
      if (exactError) throw exactError
      if (exactMatch && exactMatch.length > 0) {
        legoSet = exactMatch[0]
        console.log('정확한 매치 찾음:', legoSet)
      }
    } catch (error) {
      console.log('정확한 매치 실패:', selectedSetNum.value)
    }

    // 2단계: 기본 번호로 시도 (예: 76917-1 -> 76917)
    if (!legoSet) {
      const baseSetNum = selectedSetNum.value.split('-')[0]
      try {
        const { data: baseMatch, error: baseError } = await supabase
          .from('lego_sets')
          .select('id, set_num, name')
          .eq('set_num', baseSetNum)
          .limit(1)
        
        if (baseError) throw baseError
        if (baseMatch && baseMatch.length > 0) {
          legoSet = baseMatch[0]
          console.log('기본 번호 매치 찾음:', legoSet)
        }
      } catch (error) {
        console.log('기본 번호 매치 실패:', baseSetNum)
      }
    }

    // 3단계: LIKE 패턴으로 시도
    if (!legoSet) {
      try {
        const { data: likeMatch, error: likeError } = await supabase
          .from('lego_sets')
          .select('id, set_num, name')
          .like('set_num', `${selectedSetNum.value}%`)
          .limit(1)
        
        if (likeError) throw likeError
        if (likeMatch && likeMatch.length > 0) {
          legoSet = likeMatch[0]
          console.log('LIKE 패턴 매치 찾음:', legoSet)
        }
      } catch (error) {
        console.log('LIKE 패턴 매치 실패:', selectedSetNum.value)
      }
    }
    
    if (!legoSet) {
      const inputValue = selectedSetNum.value.trim()
      if (inputValue.length >= 7 && /^\d+$/.test(inputValue)) {
        throw new Error(`입력값 "${inputValue}"은(는) 엘리먼트 ID입니다.\n\n💡 해결 방법:\n1. "부품 단위 학습"을 선택하세요\n2. 또는 올바른 세트 번호를 입력하세요 (예: 76917, 10220)`)
      } else {
        throw new Error(`세트 "${selectedSetNum.value}"를 찾을 수 없습니다.\n\n💡 확인사항:\n1. 세트 번호가 올바른지 확인하세요 (예: 76917, 10220)\n2. 또는 "부품 단위 학습"을 사용하세요`)
      }
    }
    
    // 세트 부품 수 조회
    const { data: setParts, error: setPartsError } = await supabase
      .from('set_parts')
      .select('part_id')
      .eq('set_id', legoSet.id)
    
    if (setPartsError) {
      console.warn('세트 부품 조회 실패:', setPartsError)
    }
    
    const totalParts = setParts?.length || 0
    
    // 2. 세트 학습 상태 조회 (세트 번호 변형 처리, 안전 조회)
    let trainingStatus = null
    try {
      const baseSetNum = selectedSetNum.value.split('-')[0]
      const { data: statusRows, error: statusError } = await supabase
        .from('set_training_status')
        .select('*')
        .in('set_num', [selectedSetNum.value, baseSetNum])
        .order('updated_at', { ascending: false })
        .limit(1)
      
      if (statusError) {
        console.warn('세트 학습 상태 조회 실패:', statusError)
      } else if (statusRows && statusRows.length > 0) {
        trainingStatus = statusRows[0]
        console.log('세트 학습 상태:', trainingStatus)
      } else {
        console.log('세트 학습 상태 없음 (초기 상태)')
      }
    } catch (error) {
      console.warn('세트 학습 상태 조회 중 오류:', error)
      // 오류가 있어도 계속 진행
    }
    
    // 3. 이미 학습된 부품 수 조회 (세트 기준) - 부품 단위 학습 포함
    let trainedPartsCount = 0
    try {
      // 3-1) set_training_status.unique_parts_trained 우선 사용
      if (trainingStatus && typeof trainingStatus.unique_parts_trained === 'number') {
        trainedPartsCount = trainingStatus.unique_parts_trained
        console.log('unique_parts_trained 사용:', trainedPartsCount)
      } else {
        // 3-2) 세트 내 부품들 중 이미 학습된 부품 확인 (부품 단위 학습 포함)
        const setPartIds = setParts?.map(p => p.part_id) || []
        
        if (setPartIds.length > 0) {
          // 부품 단위 학습 상태 조회
          try {
            const { data: partTrainingData, error: partTrainingError } = await supabase
              .from('part_training_status')
              .select('part_id, status')
              .in('part_id', setPartIds)
              .eq('status', 'completed')
            
            if (partTrainingError) {
              console.warn('부품 학습 상태 조회 실패:', partTrainingError)
            } else {
              const trainedPartIds = partTrainingData?.map(p => p.part_id) || []
              trainedPartsCount = trainedPartIds.length
              console.log(`부품 단위 학습된 부품: ${trainedPartIds.length}개`, trainedPartIds)
            }
          } catch (error) {
            console.warn('부품 학습 상태 조회 중 오류:', error)
          }
          
          // 3-3) model_registry에서 세트별 학습 이력도 확인 (추가 보완)
          try {
            const baseSetNum = selectedSetNum.value.split('-')[0]
            const { data: modelRows, error: modelError } = await supabase
              .from('model_registry')
              .select('training_metadata, created_at')
              .contains('training_metadata', { set_num: baseSetNum })
              .order('created_at', { ascending: false })
              .limit(1)

            if (!modelError && modelRows && modelRows.length > 0) {
              const meta = modelRows[0]?.training_metadata || {}
              const modelTrainedParts = typeof meta.trained_parts_count === 'number'
                ? meta.trained_parts_count
                : Array.isArray(meta.trained_parts) ? meta.trained_parts.length : 0
              
              // 더 많은 학습된 부품 수를 사용 (부품 단위 + 세트 단위)
              trainedPartsCount = Math.max(trainedPartsCount, modelTrainedParts)
              console.log('model_registry 메타에서 추가 확인:', modelTrainedParts)
            }
          } catch (error) {
            console.warn('model_registry 조회 실패:', error)
          }
        }
      }
    } catch (e) {
      console.warn('학습된 부품 수 계산 중 오류:', e)
    }

    // 세트 정보 구성
    trainedPartsCount = Math.min(trainedPartsCount, totalParts)
    const newPartsCount = Math.max(0, totalParts - trainedPartsCount)
    
    setInfo.value = {
      set_num: selectedSetNum.value,
      set_name: legoSet.name,
      total_parts: totalParts,
      trained_parts: trainedPartsCount,
      new_parts: newPartsCount,
      status: trainingStatus?.status || 'pending',
      training_status: trainingStatus,
      lego_set: legoSet
    }
    
    console.log(`✅ 세트 정보 로드 완료: 총 ${totalParts}개, 학습됨 ${trainedPartsCount}개, 새로 학습할 ${newPartsCount}개`)
  } catch (err) {
    console.error('세트 정보 로드 실패:', err)
    setInfo.value = null
  }
}

// 세트 학습 시작
const startSetTraining = async () => {
  try {
    console.log(`🎯 세트 ${selectedSetNum.value} 학습 시작...`)
    
    // 1. 중복 부품 확인 및 스킵 처리
    const baseSetNum = selectedSetNum.value.split('-')[0]
    let setPartIds = []
    
    // 세트 부품 ID 조회
    if (setInfo.value.lego_set) {
      try {
        const { data: setPartsData, error: setPartsError } = await supabase
          .from('set_parts')
          .select('part_id')
          .eq('set_id', setInfo.value.lego_set.id)
        
        if (setPartsError) {
          console.warn('세트 부품 조회 실패:', setPartsError)
        } else {
          setPartIds = setPartsData?.map(p => p.part_id) || []
        }
      } catch (error) {
        console.warn('세트 부품 조회 중 오류:', error)
      }
    }
    
    let skipMessage = ''
    if (setPartIds.length > 0) {
      // 이미 학습된 부품 확인
      try {
        // 여러 부품 ID를 개별적으로 조회 (in() 메서드 대신)
        const trainedParts = []
        for (const partId of setPartIds) {
          try {
            const { data: partData, error: partError } = await supabase
              .from('part_training_status')
              .select('part_id, status')
              .eq('part_id', partId)
              .eq('status', 'completed')
            
            if (!partError && partData && partData.length > 0) {
              trainedParts.push(...partData)
            }
          } catch (error) {
            console.warn(`부품 ${partId} 상태 조회 실패:`, error)
          }
        }
        
        if (trainedParts.length > 0) {
          const trainedPartIds = trainedParts.map(p => p.part_id)
          const newPartIds = setPartIds.filter(id => !trainedPartIds.includes(id))
          
          if (trainedPartIds.length > 0) {
            skipMessage = `\n⏭️ 이미 학습된 부품 ${trainedPartIds.length}개 스킵: ${trainedPartIds.slice(0, 5).join(', ')}${trainedPartIds.length > 5 ? '...' : ''}`
            console.log(`⏭️ 스킵할 부품: ${trainedPartIds.length}개`, trainedPartIds)
          }
          
          if (newPartIds.length === 0) {
            alert(`🎯 세트 ${selectedSetNum.value}의 모든 부품이 이미 학습되었습니다!\n\n학습된 부품: ${trainedPartIds.length}개\n새로 학습할 부품: 0개`)
            return
          }
          
          console.log(`✅ 새로 학습할 부품: ${newPartIds.length}개`, newPartIds)
        }
      } catch (error) {
        console.warn('부품 학습 상태 확인 중 오류:', error)
      }
    }
    
    // 2. 세트 학습 상태 업데이트 (세트번호 정규화하여 저장)
    const { error: updateError } = await supabase
      .from('set_training_status')
      .upsert({
        set_num: baseSetNum,
        status: 'training',
        total_parts_in_set: setInfo.value.total_parts,
        last_rendered_at: new Date().toISOString()
      }, {
        onConflict: 'set_num'
      })
    
    if (updateError) {
      console.warn('세트 학습 상태 업데이트 실패:', updateError)
    }
    
    // 3. 로컬 PC 학습 시작 (하이브리드)
    await startTraining('latest', {
      epochs: trainingParams.value.epochs,
      batch_size: trainingParams.value.batchSize,
      imgsz: trainingParams.value.imageSize,
      device: trainingParams.value.device,
      set_num: selectedSetNum.value, // 세트 번호 전달
      training_type: 'local', // 로컬 학습 표시
      model_stage: 'hybrid' // 하이브리드 학습 (1단계 + 2단계)
    })
    
    // 3. 세트 정보 새로고침
    await loadSetInfo()
    await refreshData()
    
    console.log(`✅ 세트 ${selectedSetNum.value} 로컬 학습이 시작되었습니다!`)
    
    // 로컬 학습 안내 표시
    const localTrainingInfo = `
🎯 로컬 PC 학습이 시작되었습니다!${skipMessage}

📋 실행 방법:
1. 터미널/명령 프롬프트를 열어주세요
2. 프로젝트 루트 디렉토리로 이동하세요
3. 다음 명령어를 실행하세요:

cd scripts
python local_yolo_training.py --set_num ${selectedSetNum.value} --epochs ${trainingParams.epochs}

또는 배치 파일을 사용하세요:
run_local_training.bat ${selectedSetNum.value} ${trainingParams.epochs} ${trainingParams.batchSize} ${trainingParams.imageSize}

📊 학습 진행 상황:
- 학습 상태는 대시보드에서 실시간으로 확인할 수 있습니다
- 완료 후 자동으로 모델이 업로드됩니다
- 예상 소요 시간: 2-3시간 (GPU 사용 시)

💡 팁:
- GPU가 있다면 CUDA를 사용하여 더 빠른 학습이 가능합니다
- CPU만 있다면 시간이 더 오래 걸릴 수 있습니다
- 이미 학습된 부품은 자동으로 스킵됩니다

✅ part_training_status 테이블이 이미 존재합니다.
   부품별 학습 상태가 자동으로 추적됩니다.
    `
    
    setTimeout(() => {
      alert(localTrainingInfo)
    }, 1000)
  } catch (err) {
    console.error('세트 학습 시작 실패:', err)
  }
}

// 세트 학습 상태 확인
const checkSetTrainingStatus = async () => {
  try {
    console.log(`📊 세트 ${selectedSetNum.value} 학습 상태 확인 중...`)
    
    // 1. 세트 정보 로드
    await loadSetInfo()
    
    // 2. 최근 학습 작업 조회
    const { data: recentJobs, error: jobsError } = await supabase
      .from('training_jobs')
      .select('*')
      .eq('config->set_num', selectedSetNum.value)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (jobsError) {
      console.error('학습 작업 조회 실패:', jobsError)
      alert('학습 작업을 찾을 수 없습니다.')
      return
    }
    
    if (recentJobs && recentJobs.length > 0) {
      const latestJob = recentJobs[0]
      console.log('📋 최근 학습 작업:', latestJob)
      
      // 3. 학습 모니터링 모달 표시
      const trainingJob = {
        id: latestJob.id,
        status: latestJob.status,
        config: latestJob.config,
        progress: latestJob.progress
      }
      
      trainingMonitorStore.addTrainingJob(trainingJob)
      trainingMonitorStore.showModal(latestJob.id)
      trainingMonitorStore.saveToLocalStorage()
      
      console.log('✅ 학습 모니터링 모달 표시됨')
    } else {
      console.log('📋 학습 작업이 없습니다.')
      
      // 학습 작업이 없어도 모달을 표시 (빈 상태로)
      const emptyJob = {
        id: null,
        status: 'no_job',
        config: { set_num: selectedSetNum.value },
        progress: {}
      }
      
      trainingMonitorStore.addTrainingJob(emptyJob)
      trainingMonitorStore.showModal(null)
      trainingMonitorStore.saveToLocalStorage()
      
      console.log('✅ 빈 학습 모니터링 모달 표시됨')
    }
    
    console.log('✅ 세트 학습 상태 확인 완료')
  } catch (err) {
    console.error('세트 학습 상태 확인 실패:', err)
    alert(`학습 상태 확인 실패: ${err.message}`)
  }
}

// 부품 정보 로드
const loadPartInfo = async () => {
  try {
    console.log(`🧩 부품 ${selectedPartId.value} 정보 로드 중...`)
    
    // 입력값 검증
    const inputValue = selectedPartId.value.trim()
    if (!inputValue) {
      throw new Error('부품 ID 또는 엘리먼트 ID를 입력해주세요.')
    }
    
    // 입력값이 부품 ID인지 엘리먼트 ID인지 확인
    let partId = inputValue
    let isElementId = false
    
    // 🔧 수정됨: set_parts 테이블에서 직접 조회 (더 효율적)
    if (inputValue.length >= 7 && /^\d+$/.test(inputValue)) {
      console.log(`🔍 엘리먼트 ID 패턴 감지: ${inputValue}`)
      
      // set_parts에서 엘리먼트 ID로 조회 (부품 정보와 함께)
      const { data: elementData, error: elementError } = await supabase
        .from('set_parts')
        .select(`
          element_id,
          part_id,
          lego_parts(part_num, name),
          lego_colors(name, rgb)
        `)
        .eq('element_id', inputValue)
        .limit(1)
      
      if (!elementError && elementData && elementData.length > 0) {
        partId = elementData[0].part_id
        isElementId = true
        console.log(`✅ 엘리먼트 ID ${inputValue} → 부품 ID ${partId} 매핑됨`)
        console.log(`📦 부품 정보: ${elementData[0].lego_parts?.name} (${elementData[0].lego_colors?.name})`)
      } else {
        console.warn(`⚠️ 엘리먼트 ID ${inputValue}를 찾을 수 없습니다`)
        // 엘리먼트 ID로 찾지 못했지만 부품 ID로 시도
        console.log(`🔄 부품 ID로 시도: ${inputValue}`)
      }
    } else if (inputValue.length >= 7) {
      console.log(`🔍 긴 숫자 입력 감지: ${inputValue} (엘리먼트 ID일 가능성)`)
      
      // set_parts에서 엘리먼트 ID로 조회
      const { data: elementData, error: elementError } = await supabase
        .from('set_parts')
        .select(`
          element_id,
          part_id,
          lego_parts(part_num, name),
          lego_colors(name, rgb)
        `)
        .eq('element_id', inputValue)
        .limit(1)
      
      if (!elementError && elementData && elementData.length > 0) {
        partId = elementData[0].part_id
        isElementId = true
        console.log(`✅ 엘리먼트 ID ${inputValue} → 부품 ID ${partId} 매핑됨`)
        console.log(`📦 부품 정보: ${elementData[0].lego_parts?.name} (${elementData[0].lego_colors?.name})`)
      }
    }
    
    // 1. 부품 기본 정보 조회
    const { data: partData, error: partError } = await supabase
      .from('parts_master')
      .select('part_id, part_name, category, color, element_id')
      .eq('part_id', partId)
      .limit(1)
    
    if (partError) {
      throw new Error(`부품 정보 조회 실패: ${partError.message}`)
    }
    
    if (!partData || partData.length === 0) {
      // 엘리먼트 ID로 조회했는데도 실패한 경우
      if (isElementId) {
        throw new Error(`엘리먼트 ID ${inputValue}를 찾을 수 없습니다`)
      } else {
        throw new Error(`부품 ID ${inputValue}를 찾을 수 없습니다`)
      }
    }
    
    const part = partData[0]
    
    // 2. 부품 이미지 수 조회 (로컬 파일 시스템 기준)
    // [FIX] 수정됨: 새 구조 지원 - dataset_synthetic/{element_id}/images/ 폴더에서 파일 개수 확인
    let imageCount = 0
    try {
      // 엘리먼트 ID가 있으면 우선 사용, 없으면 part_id 사용
      const elementId = part.element_id || (isElementId ? inputValue : null)
      
      if (elementId) {
        // 새 구조: dataset_synthetic/{element_id}/images/ 폴더 확인
        // [FIX] 수정됨: 직접 API 호출 (포트 범위에서 서버 찾기)
        try {
          // 포트 범위에서 서버 찾기 (3011, 3012, 3013, 3014, 3015)
          const possiblePorts = [3011, 3012, 3013, 3014, 3015]
          let response = null
          let lastError = null
          
          for (const port of possiblePorts) {
            try {
              const testResponse = await fetch(`http://localhost:${port}/api/synthetic/dataset/files/${elementId}`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000) // 2초 타임아웃
              })
              if (testResponse.ok) {
                response = testResponse
                console.log(`[INFO] Synthetic API 포트 감지: ${port}`)
                break
              }
            } catch (err) {
              lastError = err
              continue
            }
          }
          
          if (response && response.ok) {
            const data = await response.json()
            imageCount = data.images || 0
            console.log(`[INFO] 로컬 파일 시스템에서 이미지 개수 조회: ${elementId} → ${imageCount}개`)
          } else {
            console.warn(`[WARN] 로컬 파일 시스템 조회 실패, 폴백: synthetic_dataset 테이블 조회`)
            // 폴백: synthetic_dataset 테이블 조회
            const { data: imageData, error: imageError } = await supabase
              .from('synthetic_dataset')
              .select('id')
              .eq('part_id', partId)
              .eq('status', 'uploaded')
            if (!imageError) {
              imageCount = imageData?.length || 0
            }
          }
        } catch (apiError) {
          console.warn('[WARN] API 호출 실패, 폴백: synthetic_dataset 테이블 조회', apiError)
          // 폴백: synthetic_dataset 테이블 조회
          const { data: imageData, error: imageError } = await supabase
            .from('synthetic_dataset')
            .select('id')
            .eq('part_id', partId)
            .eq('status', 'uploaded')
          if (!imageError) {
            imageCount = imageData?.length || 0
          }
        }
      } else {
        // 엘리먼트 ID가 없으면 기존 방식 사용 (synthetic_dataset 테이블)
        const { data: imageData, error: imageError } = await supabase
          .from('synthetic_dataset')
          .select('id')
          .eq('part_id', partId)
          .eq('status', 'uploaded')
        
        if (imageError) {
          console.warn('이미지 수 조회 실패:', imageError)
        }
        
        imageCount = imageData?.length || 0
      }
    } catch (err) {
      console.error('이미지 개수 조회 중 오류:', err)
      imageCount = 0
    }
    
    // 3. 부품 학습 상태 조회 (실제 part_id 사용)
    let trainingStatus = null
    try {
      // 엘리먼트 ID인 경우 매핑된 부품 ID로 조회
      const statusPartId = isElementId ? partId : partId
      
      const { data: statusRows, error: statusError } = await supabase
        .from('part_training_status')
        .select('*')
        .eq('part_id', statusPartId)
        .order('updated_at', { ascending: false })
        .limit(1)
      
      if (statusError) {
        console.warn('부품 학습 상태 조회 실패:', statusError)
      } else if (statusRows && statusRows.length > 0) {
        trainingStatus = statusRows[0]
        console.log('부품 학습 상태:', trainingStatus)
      } else {
        console.log('부품 학습 상태 없음 (초기 상태)')
        // 학습 상태가 없으면 기본값 설정
        trainingStatus = {
          part_id: statusPartId,
          status: 'not_started',
          last_trained_at: null
        }
      }
    } catch (error) {
      console.warn('부품 학습 상태 조회 중 오류:', error)
    }
    
    // 부품 정보 구성
    partInfo.value = {
      part_id: part.part_id,
      part_name: part.part_name,
      category: part.category,
      color: part.color,
      element_id: part.element_id,
      input_type: isElementId ? 'element_id' : 'part_id',
      input_value: inputValue,
      image_count: imageCount,
      status: trainingStatus?.status || 'pending',
      training_status: trainingStatus
    }
    
    const displayInfo = isElementId ? `엘리먼트 ID ${inputValue} → 부품 ID ${part.part_id}` : `부품 ID ${part.part_id}`
    console.log(`✅ 부품 정보 로드 완료: ${part.part_name} (${displayInfo}), 이미지 ${imageCount}개`)
  } catch (err) {
    console.error('부품 정보 로드 실패:', err)
    partInfo.value = null
  }
}

// Storage에서 모델 동기화
const syncModelsFromStorage = async () => {
  try {
    console.log('🔄 Storage에서 모델 동기화 시작...')
    isLoading.value = true
    
    const response = await fetch('http://localhost:3011/api/synthetic/sync-models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`동기화 실패: ${response.status}`)
    }
    
    const result = await response.json()
    
    if (result.success) {
      console.log('✅ 모델 동기화 완료:', result)
      
      // 모델 목록 새로고침
      await fetchLatestModel()
      await refreshData()
      
      alert(`🔄 모델 동기화 완료!\n\n${result.synced}개 모델이 등록되었습니다.\n총 ${result.total}개 파일 중 ${result.synced}개 동기화됨`)
    } else {
      throw new Error(result.error || '동기화 실패')
    }
    
  } catch (err) {
    console.error('❌ 모델 동기화 실패:', err)
    alert(`❌ 모델 동기화 실패: ${err.message}`)
  } finally {
    isLoading.value = false
  }
}

// 모달 관련 메서드
const closeTrainingModal = () => {
  trainingMonitorStore.hideModal()
  trainingMonitorStore.saveToLocalStorage()
}

const pauseTraining = async () => {
  console.log('⏸️ 학습 일시정지 요청')
  // TODO: 학습 일시정지 API 구현
  alert('학습 일시정지 기능은 준비 중입니다')
}

const resumeTraining = async () => {
  console.log('▶️ 학습 재개 요청')
  // TODO: 학습 재개 API 구현
  alert('학습 재개 기능은 준비 중입니다')
}

const stopTraining = async () => {
  if (!confirm('정말 학습을 중지하시겠습니까?')) return

  try {
    console.log('⏹️ 학습 중지 요청')
    
    const currentJobId = trainingMonitorStore.currentTrainingJob
    if (!currentJobId) {
      alert('중지할 학습 작업이 없습니다')
      return
    }

    const response = await fetch(`http://localhost:3012/api/training/stop/${currentJobId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`학습 중지 실패: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ 학습 중지 완료:', result)
    
    // 모달에서 작업 제거
    trainingMonitorStore.hideModal()
    trainingMonitorStore.saveToLocalStorage()
    
    alert('학습이 중지되었습니다')
    
  } catch (err) {
    console.error('❌ 학습 중지 실패:', err)
    alert(`학습 중지 실패: ${err.message}`)
  }
}

// 부품 학습 시작
const startPartTraining = async () => {
  try {
    console.log(`🧩 부품 ${selectedPartId.value} 학습 시작...`)
    
    // 실제 부품 ID 확인 (엘리먼트 ID인 경우 변환)
    let actualPartId = selectedPartId.value
    if (partInfo.value && partInfo.value.input_type === 'element_id') {
      actualPartId = partInfo.value.part_id
      console.log(`🔄 엘리먼트 ID ${selectedPartId.value} → 부품 ID ${actualPartId} 변환`)
    }
    
    // 1. 부품 학습 상태 업데이트 (실제 부품 ID 사용)
    const { error: updateError } = await supabase
      .from('part_training_status')
      .upsert({
        part_id: actualPartId,
        status: 'training',
        last_trained_at: new Date().toISOString()
      }, {
        onConflict: 'part_id'
      })
    
    if (updateError) {
      console.warn('부품 학습 상태 업데이트 실패:', updateError)
    }
    
    // 2. 로컬 PC 학습 시작 (실제 부품 ID 전달)
    const jobResult = await startTraining('latest', {
      epochs: trainingParams.value.epochs,
      batch_size: trainingParams.value.batchSize,
      imgsz: trainingParams.value.imageSize,
      device: trainingParams.value.device,
      partId: actualPartId, // 실제 부품 ID 전달 (partId로 수정)
      training_type: 'part', // 부품 학습 표시
      model_stage: 'hybrid' // 하이브리드 학습 (1단계 + 2단계)
    })
    
    // 학습 작업이 생성되면 모달 표시
    console.log('🔍 학습 결과 확인:', jobResult)
    
    if (jobResult && jobResult.training_job_id) {
      const trainingJob = {
        id: jobResult.training_job_id,
        status: 'training',
        config: {
          partId: actualPartId,
          model_stage: 'stage1',
          epochs: trainingParams.value.epochs,
          batch_size: trainingParams.value.batchSize,
          imgsz: trainingParams.value.imageSize,
          device: 'cuda'
        }
      }
      
      console.log('📝 학습 작업 추가:', trainingJob)
      trainingMonitorStore.addTrainingJob(trainingJob)
      
      console.log('👁️ 모달 표시 시도:', jobResult.training_job_id)
      trainingMonitorStore.showModal(jobResult.training_job_id)
      trainingMonitorStore.saveToLocalStorage()
      
      console.log('✅ 학습 모달 표시됨:', jobResult.training_job_id)
      console.log('🔍 모달 상태:', {
        isModalVisible: trainingMonitorStore.isModalVisible,
        currentTrainingJob: trainingMonitorStore.currentTrainingJob,
        trainingJobs: trainingMonitorStore.trainingJobs
      })
    } else {
      console.warn('⚠️ 학습 작업 생성 실패 또는 ID 없음:', jobResult)
    }
    
    // 3. 부품 정보 새로고침
    await loadPartInfo()
    await refreshData()
    
    console.log(`✅ 부품 ${selectedPartId.value} 로컬 학습이 시작되었습니다!`)
    
    // 로컬 학습 안내 표시
    const localTrainingInfo = `
🧩 부품 단위 로컬 PC 학습이 시작되었습니다!

📋 실행 방법:
1. 터미널/명령 프롬프트를 열어주세요
2. 프로젝트 루트 디렉토리로 이동하세요
3. 다음 명령어를 실행하세요:

cd scripts
python local_yolo_training.py --part_id ${selectedPartId.value} --epochs ${trainingParams.epochs}

또는 배치 파일을 사용하세요:
run_local_training.bat ${selectedPartId.value} ${trainingParams.epochs} ${trainingParams.batchSize} ${trainingParams.imageSize}

📊 학습 진행 상황:
- 학습 상태는 대시보드에서 실시간으로 확인할 수 있습니다
- 완료 후 자동으로 모델이 업로드됩니다
- 예상 소요 시간: 1-2시간 (GPU 사용 시)

💡 팁:
- 부품 단위 학습은 세트 단위보다 빠르게 완료됩니다
- GPU가 있다면 CUDA를 사용하여 더 빠른 학습이 가능합니다
    `
    
    setTimeout(() => {
      alert(localTrainingInfo)
    }, 1000)
  } catch (err) {
    console.error('부품 학습 시작 실패:', err)
  }
}

// 부품 학습 상태 확인
const checkPartTrainingStatus = async () => {
  try {
    console.log(`📊 부품 ${selectedPartId.value} 학습 상태 확인 중...`)
    
    // 1. 부품 정보 로드
    await loadPartInfo()
    
    // 2. 최근 학습 작업 조회 (모든 로컬 학습 작업)
    const { data: recentJobs, error: jobsError } = await supabase
      .from('training_jobs')
      .select('*')
      .or(`config->partId.eq.${selectedPartId.value},config->part_id.eq.${selectedPartId.value},config->training_type.eq.local`)
      .order('created_at', { ascending: false })
      .limit(10) // 최근 10개 작업 조회
    
    if (jobsError) {
      console.error('학습 작업 조회 실패:', jobsError)
      alert('학습 작업을 찾을 수 없습니다.')
      return
    }
    
    if (recentJobs && recentJobs.length > 0) {
      // 가장 최근의 활성 학습 작업 찾기 (training, running, pending 상태 우선)
      const activeJobs = recentJobs.filter(job => 
        ['training', 'running', 'pending'].includes(job.status)
      )
      
      const latestJob = activeJobs.length > 0 ? activeJobs[0] : recentJobs[0]
      console.log('📋 최근 학습 작업:', latestJob)
      console.log('📋 전체 작업 목록:', recentJobs.map(j => ({ id: j.id, status: j.status, created_at: j.created_at })))
      
      // 3. 학습 모니터링 모달 표시
      const trainingJob = {
        id: latestJob.id,
        status: latestJob.status,
        config: latestJob.config,
        progress: latestJob.progress
      }
      
      trainingMonitorStore.addTrainingJob(trainingJob)
      trainingMonitorStore.showModal(latestJob.id)
      trainingMonitorStore.saveToLocalStorage()
      
      console.log('✅ 학습 모니터링 모달 표시됨 (작업 ID:', latestJob.id, ')')
    } else {
      console.log('📋 학습 작업이 없습니다.')
      
      // 학습 작업이 없어도 모달을 표시 (빈 상태로)
      const emptyJob = {
        id: null,
        status: 'no_job',
        config: { partId: selectedPartId.value },
        progress: {}
      }
      
      trainingMonitorStore.addTrainingJob(emptyJob)
      trainingMonitorStore.showModal(null)
      trainingMonitorStore.saveToLocalStorage()
      
      console.log('✅ 빈 학습 모니터링 모달 표시됨')
    }
    
    console.log('✅ 부품 학습 상태 확인 완료')
  } catch (err) {
    console.error('부품 학습 상태 확인 실패:', err)
    alert(`학습 상태 확인 실패: ${err.message}`)
  }
}

// 부품 데이터베이스 복구
const repairPartDatabase = async () => {
  try {
    console.log(`🔧 부품 ${selectedPartId.value} 데이터베이스 복구 시작...`)
    isLoading.value = true
    
    // 실제 부품 ID 확인 (엘리먼트 ID인 경우 변환)
    let actualPartId = selectedPartId.value
    if (partInfo.value && partInfo.value.input_type === 'element_id') {
      actualPartId = partInfo.value.part_id
      console.log(`🔄 엘리먼트 ID ${selectedPartId.value} → 부품 ID ${actualPartId} 변환`)
    }
    
    // 데이터베이스 복구 API 호출
    const response = await fetch(`http://localhost:5003/api/synthetic/repair-database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partId: actualPartId,
        expectedImageCount: 200
      })
    })
    
    if (!response.ok) {
      throw new Error(`복구 API 호출 실패: ${response.status}`)
    }
    
    const result = await response.json()
    
    if (result.success) {
      console.log('✅ 데이터베이스 복구 완료')
      
      // 부품 정보 새로고침
      await loadPartInfo()
      await refreshData()
      
      alert(`🔧 데이터베이스 복구 완료!\n\n부품 ${actualPartId}이(가) 정상적으로 등록되었습니다.\n이제 부품학습시작 버튼을 사용할 수 있습니다.`)
    } else {
      throw new Error(result.error || '복구 실패')
    }
    
  } catch (err) {
    console.error('데이터베이스 복구 실패:', err)
    alert(`❌ 데이터베이스 복구 실패: ${err.message}`)
  } finally {
    isLoading.value = false
  }
}

// 상태 텍스트 변환
const getStatusText = (status) => {
  const statusMap = {
    'pending': '대기 중',
    'rendering': '렌더링 중',
    'training': '학습 중',
    'completed': '완료',
    'failed': '실패'
  }
  return statusMap[status] || status
}

// 데이터 새로고침
const refreshData = async () => {
  try {
    await fetchLatestModel()
    await fetchModelHistory()
    await fetchTrainingJobs()
  } catch (err) {
    console.error('데이터 새로고침 실패:', err)
  }
}

// 모델 상세보기
const viewModelDetails = (model) => {
  console.log('모델 상세 정보:', model)
  // 모달 또는 상세 페이지로 이동
}

// 날짜 포맷팅
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

// 성능 모니터링 함수들
const loadPerformanceMetrics = async () => {
  try {
    isLoadingMetrics.value = true
    console.log('📊 성능 지표 로드 중...')
    
    // 실제 데이터베이스에서 성능 지표 조회 (ai_performance_logs 테이블 사용)
    const { data: metricsData, error: metricsError } = await supabase
      .from('ai_performance_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (metricsError) {
      console.warn('⚠️ ai_performance_logs 테이블 조회 실패:', metricsError)
      // 기본값으로 설정
      performanceMetrics.value = {
        recall: 0.0,
        detectionLatency: 0,
        top1Accuracy: 0.0,
        stage2Rate: 0.0,
        searchLatency: 0,
        p95Latency: 0,
        holdRate: 0.0,
        webpDecodeP95: 0,
        falseDetectionRate: 0.0,
        occlusionIQR: 0.0,
        oodRate: 0.0,
        lastUpdated: new Date().toISOString()
      }
      return
    }
    
    if (metricsData && metricsData.length > 0) {
      // 최근 데이터로부터 성능 지표 계산
      const recentMetrics = metricsData[0]
      
      // 실제 데이터베이스 값으로 업데이트 (ai_performance_logs 테이블 스키마에 맞춤)
      performanceMetrics.value = {
        recall: recentMetrics.overall_accuracy || 0.0, // overall_accuracy를 recall로 사용
        detectionLatency: recentMetrics.avg_latency || 0,
        top1Accuracy: recentMetrics.top1_accuracy || 0.0,
        stage2Rate: 0.0, // ai_performance_logs에는 stage2_rate 데이터가 없음
        searchLatency: recentMetrics.avg_latency || 0, // avg_latency를 search_latency로 사용
        p95Latency: recentMetrics.avg_latency || 0,
        holdRate: 0.0, // ai_performance_logs에는 hold_rate 데이터가 없음
        webpDecodeP95: 0, // ai_performance_logs에는 webp_decode 데이터가 없음
        falseDetectionRate: recentMetrics.false_positive_rate || 0.0,
        occlusionIQR: 0.0, // ai_performance_logs에는 occlusion_iqr 데이터가 없음
        oodRate: 0.0, // ai_performance_logs에는 ood_rate 데이터가 없음
        lastUpdated: new Date().toISOString()
      }
      
      // 위반 지표 계산
      violations.value = []
      if (performanceMetrics.value.recall < performanceThresholds.value.recall) {
        violations.value.push('recall')
      }
      if (performanceMetrics.value.top1Accuracy < performanceThresholds.value.top1Accuracy) {
        violations.value.push('top1Accuracy')
      }
      if (performanceMetrics.value.p95Latency > performanceThresholds.value.p95Latency) {
        violations.value.push('p95Latency')
      }
      if (performanceMetrics.value.holdRate > performanceThresholds.value.holdRate) {
        violations.value.push('holdRate')
      }
      if (performanceMetrics.value.webpDecodeP95 > performanceThresholds.value.webpDecodeP95) {
        violations.value.push('webpDecodeP95')
      }
      if (performanceMetrics.value.falseDetectionRate > performanceThresholds.value.falseDetectionRate) {
        violations.value.push('falseDetectionRate')
      }
      
      // 시스템 상태 결정
      if (violations.value.length === 0) {
        systemStatus.value = 'healthy'
        recommendedAction.value = 'none'
      } else if (violations.value.length <= 2) {
        systemStatus.value = 'warning'
        recommendedAction.value = 'incremental'
      } else {
        systemStatus.value = 'critical'
        recommendedAction.value = 'full_retrain'
      }
      
      console.log('✅ 성능 지표 로드 완료:', performanceMetrics.value)
      console.log('📊 위반 지표:', violations.value)
    } else {
      console.log('ℹ️ 성능 지표 데이터가 없습니다. 기본값을 사용합니다.')
      // 데이터가 없는 경우 기본값 유지
    }
    
  } catch (error) {
    console.error('❌ 성능 지표 로드 실패:', error)
    // 오류 발생 시 기본값 유지
  } finally {
    isLoadingMetrics.value = false
  }
}

const triggerIncrementalLearning = async () => {
  try {
    console.log('📈 증분 학습 트리거 실행...')
    
    const response = await fetch('/api/synthetic/monitor/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'incremental',
        reason: '성능 지표 위반으로 인한 증분 학습 트리거'
      })
    })
    
    if (!response.ok) {
      throw new Error(`증분 학습 트리거 실패: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ 증분 학습 트리거 완료')
    } else {
      throw new Error(data.error || '증분 학습 트리거 실패')
    }
  } catch (error) {
    console.error('❌ 증분 학습 트리거 실패:', error)
  }
}

const triggerFullRetrain = async () => {
  try {
    console.log('🔄 전체 재학습 트리거 실행...')
    
    const response = await fetch('/api/synthetic/monitor/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'full_retrain',
        reason: '성능 지표 위반으로 인한 전체 재학습 트리거'
      })
    })
    
    if (!response.ok) {
      throw new Error(`전체 재학습 트리거 실패: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ 전체 재학습 트리거 완료')
    } else {
      throw new Error(data.error || '전체 재학습 트리거 실패')
    }
  } catch (error) {
    console.error('❌ 전체 재학습 트리거 실패:', error)
  }
}

// 2단계 모델 트리거 함수들
const triggerStage1Incremental = async () => {
  try {
    console.log('🔍 Stage-1 증분 학습 트리거 실행...')
    
    const response = await fetch('/api/synthetic/monitor/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'stage1_incremental',
        reason: 'Stage-1 (YOLO11m-seg) 성능 지표 위반으로 인한 증분 학습'
      })
    })
    
    if (!response.ok) {
      throw new Error(`Stage-1 증분 학습 트리거 실패: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Stage-1 증분 학습 트리거 완료')
    } else {
      throw new Error(data.error || 'Stage-1 증분 학습 트리거 실패')
    }
  } catch (error) {
    console.error('❌ Stage-1 증분 학습 트리거 실패:', error)
  }
}

const triggerStage1FullRetrain = async () => {
  try {
    console.log('🔍 Stage-1 전체 재학습 트리거 실행...')
    
    const response = await fetch('/api/synthetic/monitor/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'stage1_full_retrain',
        reason: 'Stage-1 (YOLO11m-seg) 성능 지표 위반으로 인한 전체 재학습'
      })
    })
    
    if (!response.ok) {
      throw new Error(`Stage-1 전체 재학습 트리거 실패: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Stage-1 전체 재학습 트리거 완료')
    } else {
      throw new Error(data.error || 'Stage-1 전체 재학습 트리거 실패')
    }
  } catch (error) {
    console.error('❌ Stage-1 전체 재학습 트리거 실패:', error)
  }
}

const triggerStage2Incremental = async () => {
  try {
    console.log('🎯 Stage-2 증분 학습 트리거 실행...')
    
    const response = await fetch('/api/synthetic/monitor/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'stage2_incremental',
        reason: 'Stage-2 (FAISS + Fusion) 성능 지표 위반으로 인한 증분 학습'
      })
    })
    
    if (!response.ok) {
      throw new Error(`Stage-2 증분 학습 트리거 실패: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Stage-2 증분 학습 트리거 완료')
    } else {
      throw new Error(data.error || 'Stage-2 증분 학습 트리거 실패')
    }
  } catch (error) {
    console.error('❌ Stage-2 증분 학습 트리거 실패:', error)
  }
}

const triggerStage2FullRetrain = async () => {
  try {
    console.log('🎯 Stage-2 전체 재학습 트리거 실행...')
    
    const response = await fetch('/api/synthetic/monitor/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'stage2_full_retrain',
        reason: 'Stage-2 (FAISS + Fusion) 성능 지표 위반으로 인한 전체 재학습'
      })
    })
    
    if (!response.ok) {
      throw new Error(`Stage-2 전체 재학습 트리거 실패: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Stage-2 전체 재학습 트리거 완료')
    } else {
      throw new Error(data.error || 'Stage-2 전체 재학습 트리거 실패')
    }
  } catch (error) {
    console.error('❌ Stage-2 전체 재학습 트리거 실패:', error)
  }
}

const triggerFullPipelineRetrain = async () => {
  try {
    console.log('⚡ 전체 파이프라인 재학습 트리거 실행...')
    
    const response = await fetch('/api/synthetic/monitor/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'full_pipeline_retrain',
        reason: '전체 파이프라인 성능 지표 위반으로 인한 전체 재학습'
      })
    })
    
    if (!response.ok) {
      throw new Error(`전체 파이프라인 재학습 트리거 실패: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ 전체 파이프라인 재학습 트리거 완료')
    } else {
      throw new Error(data.error || '전체 파이프라인 재학습 트리거 실패')
    }
  } catch (error) {
    console.error('❌ 전체 파이프라인 재학습 트리거 실패:', error)
  }
}

// 성능 모니터링 헬퍼 함수들
const getMetricStatus = (metricName) => {
  const metric = performanceMetrics.value[metricName]
  const threshold = performanceThresholds.value[metricName]
  
  if (metricName === 'p95Latency' || metricName === 'holdRate' || metricName === 'stage2Rate' || 
      metricName === 'falseDetectionRate' || metricName === 'occlusionIQR' || metricName === 'webpDecodeP95' || 
      metricName === 'oodRate') {
    // 높을수록 나쁜 지표들
    return metric > threshold ? 'critical' : 'healthy'
  } else {
    // 낮을수록 나쁜 지표들 (recall, top1Accuracy)
    return metric < threshold ? 'critical' : 'healthy'
  }
}

const getPerformanceStatusIcon = () => {
  switch (systemStatus.value) {
    case 'healthy': return '✅'
    case 'warning': return '⚠️'
    case 'critical': return '❌'
    default: return '❓'
  }
}

const getPerformanceStatusText = () => {
  switch (systemStatus.value) {
    case 'healthy': return '정상'
    case 'warning': return '주의'
    case 'critical': return '위험'
    default: return '알 수 없음'
  }
}

const getRecommendedActionText = () => {
  switch (recommendedAction.value) {
    case 'none': return '액션 불필요'
    case 'incremental': return '증분 학습 권장'
    case 'full_retrain': return '전체 재학습 권장'
    default: return '알 수 없음'
  }
}

const canTriggerIncremental = computed(() => {
  return recommendedAction.value === 'incremental' || recommendedAction.value === 'full_retrain'
})

const canTriggerFullRetrain = computed(() => {
  return recommendedAction.value === 'full_retrain'
})

// 2단계 모델 트리거 조건 함수들
const canTriggerStage1Incremental = computed(() => {
  // Stage-1 (탐지) 관련 지표 위반 시
  return violations.value.some(v => ['recall', 'detectionLatency'].includes(v.metric))
})

const canTriggerStage1FullRetrain = computed(() => {
  // Stage-1 (탐지) 관련 지표가 심각하게 위반 시
  return violations.value.some(v => 
    (v.metric === 'recall' && v.value < 0.90) || 
    (v.metric === 'detectionLatency' && v.value > 60)
  )
})

const canTriggerStage2Incremental = computed(() => {
  // Stage-2 (식별) 관련 지표 위반 시
  return violations.value.some(v => ['top1Accuracy', 'stage2Rate', 'searchLatency'].includes(v.metric))
})

const canTriggerStage2FullRetrain = computed(() => {
  // Stage-2 (식별) 관련 지표가 심각하게 위반 시
  return violations.value.some(v => 
    (v.metric === 'top1Accuracy' && v.value < 0.95) || 
    (v.metric === 'stage2Rate' && v.value > 0.30) ||
    (v.metric === 'searchLatency' && v.value > 20)
  )
})

const canTriggerFullPipelineRetrain = computed(() => {
  // 전체 파이프라인 관련 지표가 심각하게 위반 시
  return violations.value.some(v => 
    (v.metric === 'p95Latency' && v.value > 200) || 
    (v.metric === 'holdRate' && v.value > 0.10) ||
    (v.metric === 'webpDecodeP95' && v.value > 20)
  ) || violations.value.length >= 3
})

const getViolationName = (violation) => {
  const names = {
    // Stage-1 (탐지) 지표
    recall: '소형 Recall',
    detectionLatency: '탐지 지연',
    
    // Stage-2 (식별) 지표
    top1Accuracy: 'Top-1@BOM',
    stage2Rate: 'Stage-2 진입률',
    searchLatency: '검색 지연',
    
    // 전체 파이프라인 지표
    p95Latency: '전체 지연 (p95)',
    holdRate: '보류율',
    webpDecodeP95: 'WebP 디코딩',
    falseDetectionRate: '오탐지율',
    occlusionIQR: '오클루전 IQR',
    oodRate: 'OOD 비율'
  }
  return names[violation] || violation
}

const getViolationValue = (violation) => {
  const metric = performanceMetrics.value[violation]
  if (violation === 'p95Latency' || violation === 'webpDecodeP95') {
    return `${metric}ms`
  } else if (violation === 'holdRate' || violation === 'stage2Rate' || violation === 'falseDetectionRate' || 
             violation === 'occlusionIQR' || violation === 'oodRate') {
    return `${(metric * 100).toFixed(1)}%`
  } else {
    return metric.toFixed(3)
  }
}

const getViolationThreshold = (violation) => {
  const threshold = performanceThresholds.value[violation]
  if (violation === 'p95Latency' || violation === 'webpDecodeP95') {
    return `${threshold}ms`
  } else if (violation === 'holdRate' || violation === 'stage2Rate' || violation === 'falseDetectionRate' || 
             violation === 'occlusionIQR' || violation === 'oodRate') {
    return `${(threshold * 100).toFixed(1)}%`
  } else {
    return threshold.toFixed(3)
  }
}

const formatPerformanceTime = (dateString) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

// 새로운 computed 속성들
const activeTrainingJobs = computed(() => {
  return trainingJobs.value.filter(job => 
    job.status === 'running' || job.status === 'pending'
  )
})

const completedTrainingJobs = computed(() => {
  return trainingJobs.value.filter(job => 
    job.status === 'completed' || job.status === 'failed'
  )
})

// 새로운 메서드들
const refreshAllData = async () => {
  try {
    isLoading.value = true
    await Promise.all([
      refreshData(),
      loadPerformanceMetrics()
    ])
    console.log('✅ 전체 데이터 새로고침 완료')
  } catch (error) {
    console.error('❌ 전체 데이터 새로고침 실패:', error)
  } finally {
    isLoading.value = false
  }
}

const toggleAutoRefresh = () => {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const getProgressPercentage = (job) => {
  if (!job.progress || !job.progress.final_epoch) return 0
  const current = job.progress.current_epoch || 0
  const total = job.progress.final_epoch
  return Math.min((current / total) * 100, 100)
}

// 실시간 구독 설정
let subscriptionChannels = null
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const reconnectDelay = 5000 // 5초

const setupRealtimeSubscription = () => {
  console.log('🔄 실시간 구독 설정 시작...')
  
  // 기존 구독이 있으면 먼저 해제
  if (subscriptionChannels) {
    unsubscribeFromRealtime()
  }
  
  // training_jobs 테이블 실시간 구독
  const trainingJobsChannel = supabase
    .channel('training_jobs_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'training_jobs' },
      async (payload) => {
        console.log('🔄 학습 작업 상태 변경 감지:', payload)
        console.log('📊 변경된 데이터:', payload.new)
        await fetchTrainingJobs() // 학습 작업만 새로고침
        console.log('✅ 학습 작업 목록 새로고침 완료')
      }
    )
    .subscribe((status) => {
      console.log('📡 training_jobs 채널 구독 상태:', status)
      handleSubscriptionStatus('training_jobs', status)
    })

  // training_metrics 테이블 실시간 구독
  const trainingMetricsChannel = supabase
    .channel('training_metrics_changes')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'training_metrics' },
      async (payload) => {
        console.log('📊 새로운 메트릭 데이터 감지:', payload)
        await fetchTrainingJobs() // 학습 작업 새로고침
      }
    )
    .subscribe((status) => {
      console.log('📡 training_metrics 채널 구독 상태:', status)
      handleSubscriptionStatus('training_metrics', status)
    })

  // model_registry 테이블 실시간 구독
  const modelRegistryChannel = supabase
    .channel('model_registry_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'model_registry' },
      async (payload) => {
        console.log('🏆 모델 레지스트리 변경 감지:', payload)
        await refreshData() // 전체 데이터 새로고침
      }
    )
    .subscribe((status) => {
      console.log('📡 model_registry 채널 구독 상태:', status)
      handleSubscriptionStatus('model_registry', status)
    })

  subscriptionChannels = { trainingJobsChannel, trainingMetricsChannel, modelRegistryChannel }
  return subscriptionChannels
}

// 구독 상태 처리 및 재연결 로직
const handleSubscriptionStatus = (channelName, status) => {
  if (status === 'CHANNEL_ERROR') {
    console.error(`❌ ${channelName} 채널 오류 발생`)
    reconnectAttempts++
    
    if (reconnectAttempts <= maxReconnectAttempts) {
      console.log(`🔄 ${reconnectAttempts}/${maxReconnectAttempts} 재연결 시도 중... (${reconnectDelay/1000}초 후)`)
      setTimeout(() => {
        console.log(`🔄 ${channelName} 채널 재연결 시도...`)
        setupRealtimeSubscription()
      }, reconnectDelay)
    } else {
      console.error(`❌ ${channelName} 채널 최대 재연결 시도 횟수 초과. 실시간 구독을 비활성화합니다.`)
      // 실시간 구독 실패 시 자동 새로고침 간격을 더 짧게 설정
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval)
        autoRefreshInterval = setInterval(async () => {
          console.log('⏰ 실시간 구독 실패로 인한 자동 새로고침 실행...')
          await fetchTrainingJobs()
        }, 10000) // 10초로 단축
        console.log('🔄 자동 새로고침 간격을 10초로 단축했습니다.')
      }
    }
  } else if (status === 'SUBSCRIBED') {
    console.log(`✅ ${channelName} 채널 구독 성공`)
    reconnectAttempts = 0 // 성공 시 재연결 시도 횟수 리셋
  } else if (status === 'CLOSED') {
    console.log(`🔌 ${channelName} 채널 연결 종료`)
  } else if (status === 'TIMED_OUT') {
    console.log(`⏰ ${channelName} 채널 연결 시간 초과`)
  }
}

// 실시간 구독 해제
const unsubscribeFromRealtime = () => {
  if (subscriptionChannels) {
    console.log('🔌 실시간 구독 해제 중...')
    
    if (subscriptionChannels.trainingJobsChannel) {
      supabase.removeChannel(subscriptionChannels.trainingJobsChannel)
    }
    if (subscriptionChannels.trainingMetricsChannel) {
      supabase.removeChannel(subscriptionChannels.trainingMetricsChannel)
    }
    if (subscriptionChannels.modelRegistryChannel) {
      supabase.removeChannel(subscriptionChannels.modelRegistryChannel)
    }
    
    subscriptionChannels = null
    console.log('🔌 실시간 구독 해제 완료')
  }
}

// 자동 새로고침 설정
let autoRefreshInterval = null

const startAutoRefresh = () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
  }
  
  // 30초마다 자동 새로고침
  autoRefreshInterval = setInterval(async () => {
    console.log('⏰ 자동 새로고침 실행...')
    await fetchTrainingJobs()
  }, 30000)
  
  console.log('🔄 자동 새로고침 시작 (30초 간격)')
}

const stopAutoRefresh = () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
    autoRefreshInterval = null
    console.log('⏹️ 자동 새로고침 중지')
  }
}

// 초기화
onMounted(async () => {
  console.log('🚀 AutomatedTrainingDashboard 초기화 시작...')
  
  // 로컬 스토리지에서 학습 모니터 상태 복원
  trainingMonitorStore.loadFromLocalStorage()
  trainingMonitorStore.startAutoSave()
  
  // 실제 데이터 로드
  await refreshData()
  await loadPerformanceMetrics() // 성능 지표 로드
  await fetchTrainingJobs() // 학습 작업 로드
  
  setupRealtimeSubscription()
  startAutoRefresh() // 자동 새로고침 시작
  
  console.log('✅ AutomatedTrainingDashboard 초기화 완료')
})

// 컴포넌트 언마운트 시 정리
onUnmounted(() => {
  stopAutoRefresh()
  unsubscribeFromRealtime()
})
</script>

<style scoped>
.automated-training-dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 0;
  margin: 0;
}

/* 헤더 스타일 */
.dashboard-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 20px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1a202c;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-title p {
  margin: 4px 0 0 0;
  color: #718096;
  font-size: 14px;
  font-weight: 500;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #dc2626;
}

.status-indicator.connected {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc2626;
}

.status-indicator.connected .status-dot {
  background: #16a34a;
}

.btn-refresh-all {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh-all:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-refresh-all:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 메인 그리드 레이아웃 */
.dashboard-grid {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}

/* 카드 공통 스타일 */
.status-card,
.monitoring-card,
.training-card,
.model-card,
.set-training-card,
.trigger-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.status-card:hover,
.monitoring-card:hover,
.training-card:hover,
.model-card:hover,
.set-training-card:hover,
.trigger-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* 시스템 상태 카드 */
.status-card {
  grid-column: span 4;
}

.status-card.main-status {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1a202c;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.healthy {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status-badge.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.status-badge.critical {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-metrics {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}

.metric-label {
  font-size: 14px;
  color: #718096;
  font-weight: 500;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  color: #1a202c;
}

.metric-value.healthy {
  color: #16a34a;
}

.metric-value.critical {
  color: #dc2626;
}

.status-actions {
  display: flex;
  gap: 12px;
}

.btn-status {
  padding: 10px 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-status:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-status:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 실시간 성능 모니터링 카드 */
.monitoring-card {
  grid-column: span 8;
}

.monitoring-controls {
  display: flex;
  gap: 12px;
}

.btn-toggle {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-toggle.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: transparent;
}

.monitoring-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stage-section {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.stage-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.metric-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.metric-card.healthy {
  border-left: 4px solid #16a34a;
}

.metric-card.warning {
  border-left: 4px solid #d97706;
}

.metric-card.critical {
  border-left: 4px solid #dc2626;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.metric-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
}

.metric-value {
  font-size: 18px;
  font-weight: 700;
  color: #1a202c;
}

.metric-threshold {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
}

/* 학습 작업 관리 카드 */
.training-card {
  grid-column: span 6;
}

.training-controls {
  display: flex;
  gap: 12px;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.1);
}

.training-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.active-jobs,
.completed-jobs {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.active-jobs h3,
.completed-jobs h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.job-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.job-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.job-card.active {
  border-left: 4px solid #3b82f6;
}

.job-card.completed {
  border-left: 4px solid #16a34a;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.job-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.job-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.job-status.running {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.job-status.completed {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.job-status.failed {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.job-status.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.job-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #718096;
}

.job-metrics {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.job-metrics .metric-item {
  padding: 4px 0;
  background: none;
  font-size: 12px;
}

.no-jobs {
  text-align: center;
  padding: 40px 20px;
  color: #718096;
}

.no-jobs p {
  margin: 8px 0;
  font-size: 14px;
}

/* 모델 관리 카드 */
.model-card {
  grid-column: span 6;
}

.model-controls {
  display: flex;
  gap: 12px;
}

.model-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.current-model {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.current-model h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.model-basic {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.model-basic h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a202c;
}

.version {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status.active {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status.inactive {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.model-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.model-history {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.model-history h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.history-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.history-item.active {
  border-left: 4px solid #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.history-item .model-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-item .model-info h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
}

.model-actions {
  display: flex;
  gap: 8px;
}

.btn-activate,
.btn-details {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-activate {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-activate:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-details {
  background: rgba(0, 0, 0, 0.05);
  color: #1a202c;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-details:hover {
  background: rgba(0, 0, 0, 0.1);
}

.no-model {
  text-align: center;
  padding: 40px 20px;
  color: #718096;
}

.btn-activate-model {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 1rem;
  transition: all 0.3s ease;
}

.btn-activate-model:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-activate-model:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.model-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.btn-sync-models {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-sync-models:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-sync-models:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.no-model p {
  margin: 8px 0;
  font-size: 14px;
}

/* 세트 단위 학습 카드 */
.set-training-card {
  grid-column: span 6;
}

.set-training-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 학습 타입 선택 섹션 */
.training-type-section {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.training-type-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.training-type-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.training-type-option {
  flex: 1;
  min-width: 200px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.training-type-radio {
  display: none;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.training-type-option:hover .option-content {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.training-type-option.active .option-content {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.option-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}

.training-type-option.active .option-icon {
  background: rgba(59, 130, 246, 0.1);
}

.option-text {
  flex: 1;
}

.option-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 4px;
}

.option-description {
  font-size: 14px;
  color: #718096;
  line-height: 1.4;
}

.set-input-section,
.part-input-section {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.set-input,
.part-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.set-input:focus,
.part-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-help {
  margin-top: 8px;
}

.input-help small {
  display: block;
  padding: 4px 8px;
  background: #f0f8ff;
  border-radius: 4px;
  border-left: 3px solid #4a90e2;
  color: #2c5aa0;
  font-size: 0.85em;
}

.detail-item.highlight {
  background: #e8f5e8;
  border-left: 3px solid #28a745;
  padding: 8px 12px;
  border-radius: 4px;
  margin: 4px 0;
}

.detail-item.highlight .label {
  font-weight: 600;
  color: #155724;
}

.detail-item.highlight .value {
  color: #155724;
  font-weight: 500;
}

.btn-load {
  padding: 12px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-load:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-load:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.set-info,
.part-info {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.set-info h3,
.part-info h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a202c;
}

.set-details,
.part-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item .label {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
}

.detail-item .value {
  font-size: 16px;
  font-weight: 700;
  color: #1a202c;
}

.detail-item .value.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-block;
  width: fit-content;
}

.detail-item .value.status.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.detail-item .value.status.training {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.detail-item .value.status.completed {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.detail-item .value.status.failed {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.set-actions,
.part-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-start-training,
.btn-check-status,
.btn-repair {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-start-training {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-start-training:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-check-status {
  background: rgba(0, 0, 0, 0.05);
  color: #1a202c;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-check-status:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.1);
}

.btn-repair {
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: white;
}

.btn-repair:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);
}

.btn-start-training:disabled,
.btn-check-status:disabled,
.btn-repair:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 자동 트리거 설정 카드 */
.trigger-card {
  grid-column: span 6;
}

.trigger-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.info-success {
  color: #16a34a;
}

.info-warning {
  color: #d97706;
}

.info-error {
  color: #dc2626;
}

.trigger-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.trigger-section {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.trigger-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.trigger-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-trigger {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-trigger.incremental {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.btn-trigger.incremental:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.2);
  transform: translateY(-1px);
}

.btn-trigger.full {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.btn-trigger.full:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  transform: translateY(-1px);
}

.btn-trigger.full-pipeline {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-trigger.full-pipeline:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.violations-detail {
  background: rgba(239, 68, 68, 0.05);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(239, 68, 68, 0.1);
}

.violations-detail h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #dc2626;
}

.violations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.violation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.1);
}

.violation-icon {
  font-size: 16px;
}

.violation-name {
  font-weight: 600;
  color: #1a202c;
  min-width: 120px;
}

.violation-value {
  font-weight: 700;
  color: #dc2626;
  min-width: 80px;
}

.violation-threshold {
  font-size: 12px;
  color: #718096;
  flex: 1;
  text-align: right;
}

/* 에러 메시지 */
.error-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #dc2626;
  color: white;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(220, 38, 38, 0.3);
  z-index: 1000;
  max-width: 400px;
}

.error-message h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 700;
}

.error-message p {
  margin: 0 0 12px 0;
  font-size: 14px;
}

.btn-close {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 반응형 디자인 */
@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: repeat(8, 1fr);
  }
  
  .status-card {
    grid-column: span 8;
  }
  
  .monitoring-card {
    grid-column: span 8;
  }
  
  .training-card,
  .model-card,
  .set-training-card,
  .trigger-card {
    grid-column: span 4;
  }
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    padding: 16px;
  }
  
  .status-card,
  .monitoring-card,
  .training-card,
  .model-card,
  .set-training-card,
  .trigger-card {
    grid-column: span 1;
  }
  
  .header-content {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .header-status {
    width: 100%;
    justify-content: space-between;
  }
  
  .metrics-row {
    grid-template-columns: 1fr;
  }
  
  .set-details,
  .part-details {
    grid-template-columns: 1fr;
  }
  
  .input-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .set-actions,
  .part-actions {
    flex-direction: column;
  }
}

/* 학습 파라미터 설정 스타일 */
.training-params-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.training-params-section h3 {
  margin: 0 0 20px 0;
  color: #1f2937;
  font-size: 18px;
  font-weight: 600;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.param-group label {
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

.param-input,
.param-select {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.param-input:focus,
.param-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.param-help {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.4;
}

.params-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.btn-reset {
  padding: 8px 16px;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.btn-preset {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-preset.fast {
  background: #10b981;
  color: white;
}

.btn-preset.fast:hover {
  background: #059669;
}

.btn-preset.balanced {
  background: #3b82f6;
  color: white;
}

.btn-preset.balanced:hover {
  background: #2563eb;
}

.btn-preset.quality {
  background: #8b5cf6;
  color: white;
}

.btn-preset.quality:hover {
  background: #7c3aed;
}

@media (max-width: 768px) {
  .params-grid {
    grid-template-columns: 1fr;
  }
  
  .params-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .btn-preset,
  .btn-reset {
    width: 100%;
    text-align: center;
  }
  
  .trigger-buttons {
    flex-direction: column;
  }
  
  .training-type-options {
    flex-direction: column;
  }
  
  .training-type-option {
    min-width: auto;
  }
}

/* 하이브리드 학습 정보 스타일 */
.hybrid-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.hybrid-info h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.hybrid-info p {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.4;
}

@media (max-width: 480px) {
  .dashboard-header {
    padding: 16px 0;
  }
  
  .header-content {
    padding: 0 16px;
  }
  
  .header-title h1 {
    font-size: 24px;
  }
  
  .dashboard-grid {
    padding: 12px;
  }
  
  .status-card,
  .monitoring-card,
  .training-card,
  .model-card,
  .set-training-card,
  .trigger-card {
    padding: 16px;
  }
}


</style>
