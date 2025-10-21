<template>
  <div class="synthetic-dataset-manager">
    <div class="header">
      <h1>🧱 BrickBox 합성 데이터셋 관리</h1>
      <p>LDraw + Blender + Supabase 기반 자동 렌더링 파이프라인</p>
    </div>

    <!-- 스키마 버전 및 품질 기준 정보 -->
    <div class="schema-info-panel">
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
            SSIM ≥0.965 (WebP q=90) | SNR ≥30dB | Reprojection ≤1.5px | Depth Score ≥0.85
          </span>
          <small>기술문서 3.1절, 어노테이션 6절 준수</small>
        </div>
        <div class="schema-item">
          <span class="schema-label">WebP 정책:</span>
          <span class="schema-value">
            학습: q=90 (60-70% 절감) | 템플릿: lossless 또는 q=95
          </span>
          <small>기술문서 2.4절</small>
        </div>
      </div>
    </div>

    <!-- 자동 학습 설정 -->
    <div class="auto-training-settings">
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
            ✅ 렌더링 완료 시 자동으로 학습이 시작됩니다
          </p>
          <p v-else class="info-text disabled">
            ⏸️ 렌더링 완료 후 수동으로 학습을 시작해야 합니다
          </p>
        </div>
      </div>
      
      <!-- 세트 단위 학습 설정 -->
      <div class="set-training-settings">
        <h4>🎯 세트 단위 학습</h4>
        <div class="set-training-info">
          <p class="info-text">
            📊 세트별로 학습하여 중복을 방지하고 점진적으로 검수 가능한 세트를 확장합니다
          </p>
          <div class="set-stats">
            <div class="stat-item">
              <span class="stat-label">학습 완료 세트:</span>
              <span class="stat-value">{{ trainedSetsCount }}개</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">검수 가능 세트:</span>
              <span class="stat-value">{{ availableSetsCount }}개</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 통계 대시보드 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <h3>{{ stats.totalParts || 0 }}</h3>
          <p>총 부품 수</p>
          <small class="stat-subtitle">데이터베이스 기준</small>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎨</div>
        <div class="stat-content">
          <h3>{{ stats.renderedImages || 0 }}</h3>
          <p>렌더링된 이미지</p>
          <small class="stat-subtitle">합성 데이터셋</small>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">☁️</div>
        <div class="stat-content">
          <h3>{{ stats.storageUsed || '0 GB' }}</h3>
          <p>저장소 사용량</p>
          <small class="stat-subtitle">Supabase Storage</small>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-content">
          <h3>{{ stats.renderingStatus || '대기 중' }}</h3>
          <p>렌더링 상태</p>
          <small class="stat-subtitle">실시간 업데이트</small>
        </div>
      </div>
    </div>

    <!-- 중복 방지 상태 -->
    <div class="duplicate-prevention" v-if="renderedItems.size > 0 || setParts.length > 0 || databaseRenderedCount > 0">
      <h3>🛡️ 중복 방지 상태</h3>
      <div class="prevention-stats">
        <div class="stat-item">
          <span class="stat-label">이미 렌더링된 부품:</span>
          <span class="stat-value">{{ databaseRenderedCount }}개</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">렌더링 대상 부품:</span>
          <span class="stat-value">{{ setParts.length }}개</span>
        </div>
        <div class="stat-item" v-if="excludedCount > 0">
          <span class="stat-label">제외된 부품:</span>
          <span class="stat-value">{{ excludedCount }}개</span>
        </div>
      </div>
      <div class="prevention-actions">
        <button @click="clearRenderedItems" class="btn-secondary btn-small">
          🗑️ 렌더링 기록 초기화
        </button>
        <button @click="showRenderedItems" class="btn-secondary btn-small">
          📋 렌더링된 부품 목록
        </button>
        <button @click="retryFailedParts" class="btn-primary btn-small" v-if="failedParts.length > 0">
          🔄 실패한 부품 재시도 ({{ failedParts.length }}개)
        </button>
        <button @click="startAutoRecovery" class="btn-success btn-small" v-if="!autoRecoveryStatus.isActive">
          🛡️ 자동 복구 시작
        </button>
        <button @click="stopAutoRecovery" class="btn-warning btn-small" v-if="autoRecoveryStatus.isActive">
          🛑 자동 복구 중단
        </button>
        <button @click="startAutoRecoveryMonitoring" class="btn-info btn-small" v-if="!autoRecoveryMonitoring">
          📊 모니터링 시작
        </button>
        <button @click="stopAutoRecoveryMonitoring" class="btn-secondary btn-small" v-if="autoRecoveryMonitoring">
          📊 모니터링 중단
        </button>
        <button @click="reallocatePort" class="btn-warning btn-small">
          🔄 포트 재할당
        </button>
        <button @click="togglePortMonitoring('start')" class="btn-info btn-small" v-if="!portManagerStatus.isPortMonitoring">
          📡 포트 모니터링 시작
        </button>
        <button @click="togglePortMonitoring('stop')" class="btn-secondary btn-small" v-if="portManagerStatus.isPortMonitoring">
          📡 포트 모니터링 중단
        </button>
      </div>
    </div>

    <!-- 데이터셋 변환 안내 -->
    <div class="dataset-conversion-notice">
      <h3>📊 데이터셋 변환</h3>
        <div class="notice-content">
        <p>렌더링된 이미지를 YOLO 학습용 데이터셋으로 변환하려면 전용 페이지를 사용하세요.</p>
        <router-link to="/dataset-converter" class="btn btn-primary">
          📊 데이터셋 변환 페이지로 이동
        </router-link>
      </div>
    </div>

    <!-- 데이터 관리 -->
    <div class="data-management">
      <h3>🧹 데이터 관리</h3>
      <div class="management-actions">
        <button @click="cleanupInvalidData" @mousedown="console.log('허수 데이터 정리 버튼 클릭됨')" class="btn-warning btn-small" style="background: #f39c12 !important; color: white !important; border: none !important; padding: 8px 16px !important; border-radius: 8px !important; cursor: pointer !important; font-weight: 600 !important;">
          🧹 허수 데이터 정리
        </button>
        <button @click="clearRenderedItems" class="btn-secondary btn-small">
          🗑️ 렌더링 기록 초기화
        </button>
        <button @click="showRenderedItems" class="btn-secondary btn-small">
          📋 렌더링된 부품 목록
        </button>
      </div>
    </div>

    <!-- 렌더링 컨트롤 -->
    <div class="control-panel">
      <h2>🎯 렌더링 컨트롤</h2>
      
      <div class="render-options">
        <div class="option-group">
          <label>렌더링 모드</label>
          <select v-model="renderMode" @change="updateRenderSettings">
            <option value="single">단일 부품</option>
            <option value="set">레고 세트</option>
            <option value="batch">배치 렌더링</option>
          </select>
        </div>

        <div class="option-group" v-if="renderMode === 'single'">
          <label>부품 ID</label>
          <input 
            v-model="selectedPartId" 
            placeholder="부품 번호 입력"
            @input="validatePartId"
          />
          <div v-if="partValidation" class="validation-message">
            {{ partValidation }}
          </div>
        </div>

        <div class="option-group" v-if="renderMode === 'set'">
          <label>레고 세트 번호</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <input 
              v-model="selectedSetNum" 
              placeholder="세트 번호 입력" 
              @keyup.enter="loadSetParts"
            />
            <button class="btn-secondary" @click="loadSetParts">부품 로드 (DB)</button>
            <button class="btn-secondary" @click="loadAvailableSets">사용 가능한 세트 보기</button>
          </div>
          <div v-if="availableSets.length > 0" class="available-sets">
            <small>사용 가능한 세트: {{ availableSets.slice(0, 10).join(', ') }}{{ availableSets.length > 10 ? '...' : '' }}</small>
          </div>
        </div>

        <div class="option-group">
          <label>이미지 수</label>
          <input 
            type="number" 
            v-model="imageCount" 
            min="1" 
            max="300"
            placeholder="200"
          />
        </div>

        <div class="option-group">
          <label>렌더링 품질</label>
          <select v-model="renderQuality">
            <option value="fast">빠름 (적응형: 256-400샘플)</option>
            <option value="medium">보통 (적응형: 320-400샘플)</option>
            <option value="high">고품질 (적응형: 400-480샘플)</option>
            <option value="ultra">최고품질 (적응형: 400-480샘플)</option>
          </select>
          <div class="quality-info">
            <small>🎯 적응형 샘플링: 부품 복잡도에 따라 자동 조정</small>
          </div>
        </div>

        <div class="option-group">
          <label>배경색</label>
          <select v-model="background">
            <option value="auto">자동</option>
            <option value="gray">회색</option>
            <option value="white">흰색</option>
          </select>
        </div>

        <div class="option-group">
          <label>해상도</label>
          <select v-model="resolution">
            <option value="640x640">640x640</option>
            <option value="768x768">768x768</option>
            <option value="960x960">960x960</option>
            <option value="1024x1024">1024x1024 (권장)</option>
          </select>
        </div>

        <!-- WebP 인코딩 설정 (기술문서 2.4절) -->
        <div class="option-group">
          <label>WebP 품질</label>
          <select v-model="webpQuality">
            <option value="85">85 (빠름)</option>
            <option value="90">90 (권장, 기술문서 기준)</option>
            <option value="95">95 (고품질, 템플릿용)</option>
            <option value="100">100 (무손실)</option>
          </select>
          <small class="quality-info">📦 WebP q=90: PNG 대비 60-70% 절감</small>
        </div>

        <!-- RDA 설정 (기술문서 3.2절) -->
        <div class="option-group">
          <label>도메인 랜덤화 (RDA)</label>
          <select v-model="rdaStrength">
            <option value="none">사용 안 함</option>
            <option value="rda1">낮음 (RDA-1)</option>
            <option value="rda2">중간 (RDA-2, 기본)</option>
            <option value="rda3">높음 (RDA-3)</option>
          </select>
          <small class="quality-info">💡 조명/HDR/배경/렌즈 왜곡 적용 수준</small>
        </div>

        <!-- YOLO 고급 설정 -->
        <div class="option-group">
          <button @click="showAdvanced = !showAdvanced" class="btn-secondary btn-small">
            {{ showAdvanced ? '🔼 고급 설정 숨기기' : '🔽 YOLO 고급 설정 표시' }}
          </button>
        </div>
        
        <div v-if="showAdvanced" class="advanced-settings">
          <h4>🎯 YOLO 고급 설정 (기술문서 4.2절)</h4>
          <div class="advanced-grid">
            <div class="option-group">
              <label>Confidence 임계값</label>
              <input type="number" v-model.number="yoloConf" min="0.1" max="0.3" step="0.01" />
              <small>기본값: 0.15 (소형 부품 탐지)</small>
            </div>
            <div class="option-group">
              <label>IoU 임계값</label>
              <input type="number" v-model.number="yoloIou" min="0.4" max="0.7" step="0.05" />
              <small>기본값: 0.60 (중복 억제)</small>
            </div>
            <div class="option-group">
              <label>최대 검출 수</label>
              <input type="number" v-model.number="yoloMaxDet" min="500" max="2000" step="100" />
              <small>기본값: 1200 (밀집 프레임)</small>
            </div>
          </div>
        </div>

        <!-- 적응형 샘플링 정보 -->
        <div class="adaptive-info">
          <h4>🎯 적응형 샘플링 시스템</h4>
          <div class="adaptive-grid">
            <div class="adaptive-item">
              <span class="adaptive-label">단순 부품</span>
              <span class="adaptive-samples">256샘플</span>
              <small>(Plate/Tile)</small>
            </div>
            <div class="adaptive-item">
              <span class="adaptive-label">중간 부품</span>
              <span class="adaptive-samples">320샘플</span>
              <small>(Beam/Rod)</small>
            </div>
            <div class="adaptive-item">
              <span class="adaptive-label">복잡 부품</span>
              <span class="adaptive-samples">400샘플</span>
              <small>(Technic)</small>
            </div>
            <div class="adaptive-item">
              <span class="adaptive-label">투명/반사</span>
              <span class="adaptive-samples">480샘플</span>
              <small>(Glass/Crystal)</small>
            </div>
          </div>
          <div class="adaptive-features">
            <small>✨ 자동 복잡도 감지 • 실시간 노이즈 보정 • SSIM 품질 검증</small>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <button 
          @click="startRendering" 
          :disabled="!canStartRendering"
          class="btn-primary"
        >
          🚀 렌더링 시작
        </button>
        <button 
          v-if="renderMode === 'set'"
          @click="startSetRendering" 
          @mousedown="console.log('세트 전체 렌더링 버튼 클릭됨')"
          :disabled="isRendering || !selectedSetNum"
          class="btn-primary"
        >
          📦 세트 전체 렌더링
        </button>
        <button 
          @click="stopRendering" 
          :disabled="!isRendering"
          class="btn-danger"
        >
          ⏹️ 렌더링 중지
        </button>
        <button 
          @click="refreshStats" 
          class="btn-secondary"
        >
          🔄 새로고침
        </button>
      </div>
    </div>

    <!-- 렌더링 진행 상황 -->
    <div class="progress-panel" v-if="isRendering">
      <h3>📈 렌더링 진행 상황</h3>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${renderProgress}%` }"
        ></div>
      </div>
      <p>{{ renderProgress }}% 완료 ({{ currentImage }}/{{ totalImages }})</p>
      
      <!-- 자동 복구 시스템 상태 -->
      <div class="auto-recovery-status" v-if="autoRecoveryStatus.isActive || autoRecoveryMonitoring">
        <h4>🛡️ 자동 복구 시스템</h4>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">시스템:</span>
            <span class="status-value" :class="autoRecoveryStatus.isActive ? 'status-active' : 'status-inactive'">
              {{ autoRecoveryStatus.isActive ? '활성' : '비활성' }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">모니터:</span>
            <span class="status-value" :class="autoRecoveryStatus.serverMonitor.running ? 'status-active' : 'status-inactive'">
              {{ autoRecoveryStatus.serverMonitor.running ? '실행 중' : '중지됨' }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">재시도:</span>
            <span class="status-value">{{ autoRecoveryStatus.serverMonitor.retryCount }}/{{ autoRecoveryStatus.serverMonitor.maxRetries }}</span>
          </div>
        </div>
        
        <!-- 자동 복구 로그 -->
        <div class="auto-recovery-logs" v-if="autoRecoveryStatus.logs.length > 0">
          <h5>자동 복구 로그</h5>
          <div class="log-container">
            <div 
              v-for="(log, index) in autoRecoveryStatus.logs.slice(-5)" 
              :key="index"
              class="log-item"
              :class="`log-${log.type}`"
            >
              <span class="log-time">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 포트 관리 시스템 상태 -->
      <div class="port-management-status" v-if="portManagerStatus.currentPort || portManagerStatus.isPortMonitoring">
        <h4>🔌 포트 관리 시스템</h4>
        <div class="port-status-grid">
          <div class="port-status-item">
            <span class="port-label">현재 포트:</span>
            <span class="port-value">{{ portManagerStatus.currentPort || 'N/A' }}</span>
          </div>
          <div class="port-status-item">
            <span class="port-label">모니터링:</span>
            <span class="port-value" :class="portManagerStatus.isPortMonitoring ? 'status-active' : 'status-inactive'">
              {{ portManagerStatus.isPortMonitoring ? '활성' : '비활성' }}
            </span>
          </div>
          <div class="port-status-item">
            <span class="port-label">충돌 포트:</span>
            <span class="port-value">{{ portManagerStatus.portConflicts.length }}개</span>
          </div>
        </div>
        
        <!-- 포트 히스토리 -->
        <div class="port-history" v-if="portManagerStatus.portHistory.length > 0">
          <h5>포트 할당 히스토리</h5>
          <div class="history-container">
            <div 
              v-for="(entry, index) in portManagerStatus.portHistory.slice(-5)" 
              :key="index"
              class="history-item"
            >
              <span class="history-time">{{ new Date(entry.timestamp).toLocaleTimeString() }}</span>
              <span class="history-port">포트: {{ entry.port }}</span>
              <span class="history-reason">{{ entry.reason }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 현재 렌더링 중인 부품 정보 -->
      <div class="current-rendering" v-if="currentRenderingPart">
        <h4>🎯 현재 렌더링 중인 부품</h4>
        <div class="part-info">
          <div class="part-details">
            <span class="part-id">부품 ID: <strong>{{ currentRenderingPart.partId }}</strong></span>
            <span class="element-id">엘리먼트 ID: <strong>{{ currentRenderingPart.elementId || 'N/A' }}</strong></span>
            <span class="color-id">색상 ID: <strong>{{ currentRenderingPart.colorId || 'N/A' }}</strong></span>
            <span class="set-num">세트 번호: <strong>{{ currentRenderingPart.setNum || 'N/A' }}</strong></span>
          </div>
          <div class="rendering-stats">
            <span class="samples">샘플 수: <strong>{{ currentRenderingPart.samples || 'N/A' }}</strong></span>
            <span class="quality">품질: <strong>{{ currentRenderingPart.quality || 'N/A' }}</strong></span>
            <span class="resolution">해상도: <strong>{{ currentRenderingPart.resolution || 'N/A' }}</strong></span>
          </div>
        </div>
      </div>
      
      <div class="render-log">
        <div 
          v-for="(log, index) in renderLogs" 
          :key="index"
          class="log-entry"
          :class="log.type"
        >
          {{ log.message }}
        </div>
      </div>
    </div>
    
    <!-- 자동 복구 시스템 독립 상태 패널 -->
    <div class="auto-recovery-panel" v-if="!isRendering && (autoRecoveryStatus.isActive || autoRecoveryMonitoring)">
      <h3>🛡️ 자동 복구 시스템</h3>
      <div class="status-overview">
        <div class="status-card">
          <div class="status-header">
            <span class="status-title">시스템 상태</span>
            <span class="status-indicator" :class="autoRecoveryStatus.isActive ? 'indicator-active' : 'indicator-inactive'"></span>
          </div>
          <div class="status-content">
            <p>{{ autoRecoveryStatus.isActive ? '자동 복구 활성화됨' : '자동 복구 비활성화됨' }}</p>
          </div>
        </div>
        
        <div class="status-card">
          <div class="status-header">
            <span class="status-title">서버 모니터</span>
            <span class="status-indicator" :class="autoRecoveryStatus.serverMonitor.running ? 'indicator-active' : 'indicator-inactive'"></span>
          </div>
          <div class="status-content">
            <p>재시도: {{ autoRecoveryStatus.serverMonitor.retryCount }}/{{ autoRecoveryStatus.serverMonitor.maxRetries }}</p>
            <p v-if="autoRecoveryStatus.serverMonitor.lastCheck">
              마지막 확인: {{ new Date(autoRecoveryStatus.serverMonitor.lastCheck).toLocaleString() }}
            </p>
          </div>
        </div>
        
        <div class="status-card">
          <div class="status-header">
            <span class="status-title">자동 복구</span>
            <span class="status-indicator" :class="autoRecoveryStatus.autoRecovery.running ? 'indicator-active' : 'indicator-inactive'"></span>
          </div>
          <div class="status-content">
            <p>{{ autoRecoveryStatus.autoRecovery.renderingResumed ? '렌더링 복구됨' : '대기 중' }}</p>
            <p v-if="autoRecoveryStatus.autoRecovery.lastStateCheck">
              상태 확인: {{ new Date(autoRecoveryStatus.autoRecovery.lastStateCheck).toLocaleString() }}
            </p>
          </div>
        </div>
      </div>
      
      <!-- 자동 복구 로그 -->
      <div class="auto-recovery-logs" v-if="autoRecoveryStatus.logs.length > 0">
        <h4>자동 복구 로그</h4>
        <div class="log-container">
          <div 
            v-for="(log, index) in autoRecoveryStatus.logs.slice(-10)" 
            :key="index"
            class="log-item"
            :class="`log-${log.type}`"
          >
            <span class="log-time">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 품질 지표 대시보드 (신규) -->
    <QualityMetricsChart 
      v-if="renderResults.length > 0 && renderResults[0].metrics" 
      :renderResults="renderResults" 
    />

    <!-- 렌더링 결과 -->
    <div class="results-panel" v-if="renderResults.length > 0">
      <h3>🎨 렌더링 결과</h3>
      <div class="image-grid">
        <div 
          v-for="result in renderResults" 
          :key="result.id"
          class="image-card"
        >
          <img 
            :src="result.imageUrl" 
            :alt="result.partId"
            @click="openImageModal(result)"
          />
          <div class="image-info">
            <p><strong>{{ result.partId }}</strong></p>
            <p>{{ result.colorName }}</p>
            <p>{{ result.angle }}°</p>
          </div>
          <div class="image-actions">
            <button @click="downloadImage(result)" class="btn-small">
              📥 다운로드
            </button>
            <button @click="uploadToSupabase(result)" class="btn-small">
              ☁️ 업로드
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 렌더링 상태 요약 -->
    <div class="status-summary" v-if="completedParts.length > 0 || failedParts.length > 0">
      <h3>📊 렌더링 상태 요약</h3>
      
      <!-- 완료된 부품 -->
      <div class="completed-parts" v-if="completedParts.length > 0">
        <h4>✅ 완료된 부품 ({{ completedParts.length }}개)</h4>
        <div class="parts-list">
          <div 
            v-for="part in completedParts" 
            :key="`completed-${part.partId}-${part.colorId}`"
            class="part-item completed"
          >
            <div class="part-info">
              <span class="part-id"><strong>{{ part.partId }}</strong></span>
              <span class="element-id">엘리먼트: {{ part.elementId || 'N/A' }}</span>
              <span class="color-id">색상: {{ part.colorId || 'N/A' }}</span>
              <span class="set-num">세트: {{ part.setNum || 'N/A' }}</span>
            </div>
            <div class="part-stats">
              <span class="images">이미지: {{ part.imageCount || 0 }}개</span>
              <span class="samples">샘플: {{ part.samples || 'N/A' }}</span>
              <span class="quality">품질: {{ part.quality || 'N/A' }}</span>
            </div>
            <div class="part-status">
              <span class="status-badge success">완료</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 실패한 부품 -->
      <div class="failed-parts" v-if="failedParts.length > 0">
        <h4>❌ 실패한 부품 ({{ failedParts.length }}개)</h4>
        <div class="parts-list">
          <div 
            v-for="part in failedParts" 
            :key="`failed-${part.partId}-${part.colorId}`"
            class="part-item failed"
          >
            <div class="part-info">
              <span class="part-id"><strong>{{ part.partId }}</strong></span>
              <span class="element-id">엘리먼트: {{ part.elementId || 'N/A' }}</span>
              <span class="color-id">색상: {{ part.colorId || 'N/A' }}</span>
              <span class="set-num">세트: {{ part.setNum || 'N/A' }}</span>
            </div>
            <div class="part-stats">
              <span class="error">오류: {{ part.error || '알 수 없는 오류' }}</span>
              <span class="attempts">시도: {{ part.attempts || 1 }}회</span>
            </div>
            <div class="part-status">
              <span class="status-badge error">실패</span>
              <button @click="retrySinglePart(part)" class="btn-small btn-primary" style="margin-left: 10px;">
                🔄 재시도
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 이미지 모달 -->
    <div v-if="selectedImage" class="image-modal" @click="closeImageModal">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="closeImageModal">×</button>
        <img :src="selectedImage.imageUrl" :alt="selectedImage.partId" />
        <div class="modal-info">
          <h3>{{ selectedImage.partId }}</h3>
          <p>색상: {{ selectedImage.colorName }}</p>
          <p>회전: {{ selectedImage.angle }}°</p>
          <p>해상도: {{ selectedImage.resolution }}</p>
        </div>
      </div>
    </div>

    <!-- 배치 작업 관리 -->
    <div class="batch-management">
      <h3>📋 배치 작업 관리</h3>
      <div class="batch-queue">
        <div 
          v-for="job in batchJobs" 
          :key="job.id"
          class="job-card"
          :class="job.status"
        >
          <div class="job-info">
            <h4>{{ job.name }}</h4>
            <p>{{ job.description }}</p>
            <div class="job-progress">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{ width: `${job.progress}%` }"
                ></div>
              </div>
              <span>{{ job.progress }}%</span>
            </div>
          </div>
          <div class="job-actions">
            <button 
              v-if="job.status === 'pending'"
              @click="startJob(job)"
              class="btn-small"
            >
              ▶️ 시작
            </button>
            <button 
              v-if="job.status === 'running'"
              @click="pauseJob(job)"
              class="btn-small"
            >
              ⏸️ 일시정지
            </button>
            <button 
              v-if="job.status === 'paused'"
              @click="resumeJob(job)"
              class="btn-small"
            >
              ▶️ 재개
            </button>
            <button 
              @click="cancelJob(job)"
              class="btn-small btn-danger"
            >
              ❌ 취소
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useSyntheticDataset } from '@/composables/useSyntheticDataset'
import { useSupabase } from '@/composables/useSupabase'
import QualityMetricsChart from '@/components/QualityMetricsChart.vue'

export default {
  name: 'SyntheticDatasetManager',
  components: {
    QualityMetricsChart
  },
  setup() {
    // Supabase 클라이언트 초기화 (중복 방지)
    const { supabase } = useSupabase()
    
    const { 
      getStats,
      startRendering: startRenderingAPI,
      stopRendering: stopRenderingAPI,
      getRenderResults,
      uploadToSupabase: uploadToSupabaseAPI
    } = useSyntheticDataset()

    // 반응형 데이터
    const stats = ref({
      totalParts: 0,
      renderedImages: 0,
      storageUsed: '0 GB',
      renderingStatus: '대기 중'
    })

    const renderMode = ref('single')
    const selectedPartId = ref('')
    const selectedSetNum = ref('')
    const imageCount = ref(200)
    const renderQuality = ref('high')
    const background = ref('white')
    const resolution = ref('1024x1024')
    
    // WebP 설정 (기술문서 2.4절)
    const webpQuality = ref(90) // WebP lossy q=90
    const webpMethod = ref(6) // -m 6
    const webpAutoFilter = ref(true) // -af on
    
    // RDA (Render Domain Randomization) 설정 (기술문서 3.2절)
    const rdaStrength = ref('rda2') // none | rda1 | rda2 | rda3 (기본: rda2 - Train 80% 적용)
    
    // YOLO 고급 설정 (기술문서 4.2절)
    const yoloConf = ref(0.15)
    const yoloIou = ref(0.60)
    const yoloMaxDet = ref(1200)
    const showAdvanced = ref(false)
    
    const isRendering = ref(false)
    const renderProgress = ref(0)
    const currentImage = ref(0)
    const totalImages = ref(0)
    const renderLogs = ref([])
    const renderResults = ref([])
    const resolvedPartIdForFiles = ref('')
    
    // 자동 복구 시스템 상태
    const autoRecoveryStatus = ref({
      isActive: false,
      serverMonitor: {
        running: false,
        lastCheck: null,
        retryCount: 0,
        maxRetries: 5
      },
      autoRecovery: {
        running: false,
        lastStateCheck: null,
        renderingResumed: false
      },
      logs: []
    })
    
    // 자동 복구 시스템 모니터링
    const autoRecoveryMonitoring = ref(false)
    
    // 포트 관리 시스템 상태
    const portManagerStatus = ref({
      currentPort: null,
      portHistory: [],
      portConflicts: [],
      isPortMonitoring: false,
      autoRecoveryPort: null
    })
    
    // 렌더링 상태만 유지
    const hasRenderedData = ref(false)
    
    const availableSets = ref([])
    const setParts = ref([])
    const batchJobs = ref([])
    const selectedImage = ref(null)
    
    // 렌더링 상태 추적
    const currentRenderingPart = ref(null)
    const completedParts = ref([])
    const failedParts = ref([])
    
    // 중복 렌더링 방지를 위한 추적 시스템
    
    // 렌더링 완료 시 데이터셋 변환 가능하도록 설정
    const checkRenderedData = async () => {
      try {
        const response = await fetch('/api/dataset/source-count')
        const data = await response.json()
        const count = data.count || 0
        hasRenderedData.value = count > 0
      } catch (error) {
        console.error('Rendered data check error:', error)
        hasRenderedData.value = false
      }
    }
    
    // 컴포넌트 마운트 시 초기화
    onMounted(async () => {
      await checkRenderedData()
    })
    const renderedItems = ref(new Set()) // 이미 렌더링된 아이템 추적
    const duplicateCheck = ref(new Map()) // elementId + partNum 조합으로 중복 체크
    const excludedCount = ref(0) // 제외된 부품 수
    const databaseRenderedCount = ref(0) // 데이터베이스에서 렌더링된 부품 수

    // 세션 저장/복원
    const SESSION_KEY = 'synthetic_dataset_session_v1'
    let persistTimer = null

    // 렌더 파이프라인 튜닝 상수
    const POLL_INTERVAL_MS = 3000 // 진행 폴링 간격(표준화)
    const TIMEOUT_MAX_ATTEMPTS = 300 // 300 * 3s = 900초(10분)
    const STORAGE_BATCH_SIZE = 6 // 스토리지 폴더 검증 배치 크기 축소로 I/O 완화
    const DUP_MIN_FILES = 150 // 폴더 내 최소 파일 수 기준으로 중복 판정 강화

    const serializeSession = () => {
      try {
        const session = {
          renderMode: renderMode.value,
          selectedPartId: selectedPartId.value,
          selectedSetNum: selectedSetNum.value,
          imageCount: imageCount.value,
          renderQuality: renderQuality.value,
          background: background.value,
          resolution: resolution.value,
          // 배열/목록 상태
          setParts: Array.isArray(setParts.value) ? setParts.value : [],
          completedParts: Array.isArray(completedParts.value) ? completedParts.value : [],
          failedParts: Array.isArray(failedParts.value) ? failedParts.value : [],
          // Set/Map 직렬화
          renderedItems: Array.from(renderedItems.value || []),
          duplicateCheck: Array.from((duplicateCheck.value || new Map()).entries())
        }
        return JSON.stringify(session)
      } catch (e) {
        return null
      }
    }

    const persistSession = () => {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        const json = serializeSession()
        if (json) {
          try {
            localStorage.setItem(SESSION_KEY, json)
          } catch (_) {}
        }
      }, 250)
    }

    const loadSession = () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) return
        const s = JSON.parse(raw)
        if (!s || typeof s !== 'object') return

        if (s.renderMode) renderMode.value = s.renderMode
        if (typeof s.selectedPartId === 'string') selectedPartId.value = s.selectedPartId
        if (typeof s.selectedSetNum === 'string') selectedSetNum.value = s.selectedSetNum
        if (typeof s.imageCount === 'number') imageCount.value = s.imageCount
        if (typeof s.renderQuality === 'string') renderQuality.value = s.renderQuality
        if (typeof s.background === 'string') background.value = s.background
        if (typeof s.resolution === 'string') resolution.value = s.resolution

        if (Array.isArray(s.setParts)) setParts.value = s.setParts
        if (Array.isArray(s.completedParts)) completedParts.value = s.completedParts
        if (Array.isArray(s.failedParts)) failedParts.value = s.failedParts

        if (Array.isArray(s.renderedItems)) renderedItems.value = new Set(s.renderedItems)
        if (Array.isArray(s.duplicateCheck)) duplicateCheck.value = new Map(s.duplicateCheck)
      } catch (_) {}
    }

    // 변경 감지하여 자동 저장 (깊은 감시 필요 상태 포함)
    watch([
      renderMode,
      selectedPartId,
      selectedSetNum,
      imageCount,
      renderQuality,
      background,
      resolution,
      setParts,
      completedParts,
      failedParts
    ], persistSession, { deep: true })

    // 계산된 속성
    const canStartRendering = computed(() => {
      if (renderMode.value === 'single') {
        return selectedPartId.value && partValidation.value === '✅ 유효한 부품 ID'
      }
      if (renderMode.value === 'set') {
        return selectedSetNum.value
      }
      return true
    })

    const partValidation = ref('')

    // 품질에 따른 샘플 수 반환
    const getSamplesForQuality = (quality) => {
      const qualityMap = {
        'fast': '256-400 (적응형)',
        'medium': '320-400 (적응형)',
        'high': '400-480 (적응형)',
        'ultra': '400-480 (적응형)'
      }
      return qualityMap[quality] || '400'
    }

    // 품질 검증 로직 (기술문서 3.1절)
    const validateQuality = (metadata) => {
      const warnings = []
      
      // 품질 메트릭 추출 (시각화용)
      const metrics = {
        ssim: metadata?.image_quality?.ssim || 0,
        snr: metadata?.image_quality?.snr || 0,
        reprojection: metadata?.annotation?.quality_3d?.reprojection_error_rms_px || 0,
        depthScore: metadata?.annotation?.quality_3d?.depth_map_validation?.depth_quality_score || 0,
        maskBboxRatio: (metadata?.mask_area && metadata?.bbox_area) 
          ? metadata.mask_area / metadata.bbox_area 
          : 0
      }
      
      if (!metadata) return { warnings, metrics }
      
      // 1. 마스크/박스 비율 검증 (25~98% 범위)
      if (metadata.mask_area && metadata.bbox_area) {
        const maskBboxRatio = metadata.mask_area / metadata.bbox_area
        if (maskBboxRatio < 0.25 || maskBboxRatio > 0.98) {
          warnings.push({
            type: 'error',
            message: `마스크/박스 비율 이상: ${(maskBboxRatio * 100).toFixed(1)}% (정상범위: 25-98%)`
          })
        }
      }
      
      // 2. SSIM 검증 (WebP q=90 기준 0.965 이상)
      if (metadata.image_quality?.ssim) {
        const ssimThreshold = webpQuality.value === 90 ? 0.965 : 0.97
        if (metadata.image_quality.ssim < ssimThreshold) {
          warnings.push({
            type: 'warning',
            message: `SSIM 기준 미달: ${metadata.image_quality.ssim.toFixed(3)} (기준: ${ssimThreshold})`
          })
        }
      }
      
      // 3. SNR 검증 (30 이상)
      if (metadata.image_quality?.snr) {
        if (metadata.image_quality.snr < 30) {
          warnings.push({
            type: 'warning',
            message: `SNR 기준 미달: ${metadata.image_quality.snr.toFixed(1)} dB (기준: 30 dB)`
          })
        }
      }
      
      // 4. Reprojection Error 검증 (1.5px 이하)
      if (metadata.annotation?.quality_3d?.reprojection_error_rms_px) {
        if (metadata.annotation.quality_3d.reprojection_error_rms_px > 1.5) {
          warnings.push({
            type: 'error',
            message: `Reprojection 오차 초과: ${metadata.annotation.quality_3d.reprojection_error_rms_px.toFixed(2)}px (기준: ≤1.5px)`
          })
        }
      }
      
      // 5. Depth 품질 검증 (0.85 이상)
      if (metadata.annotation?.quality_3d?.depth_map_validation?.depth_quality_score) {
        if (metadata.annotation.quality_3d.depth_map_validation.depth_quality_score < 0.85) {
          warnings.push({
            type: 'warning',
            message: `Depth 품질 미달: ${metadata.annotation.quality_3d.depth_map_validation.depth_quality_score.toFixed(2)} (기준: ≥0.85)`
          })
        }
      }
      
      return { warnings, metrics }
    }

    // 중복 렌더링 체크 함수
    const isAlreadyRendered = (elementId, partNum, colorId) => {
      const key = `${elementId || partNum}-${colorId || 'default'}`
      return renderedItems.value.has(key) || duplicateCheck.value.has(key)
    }

    // 렌더링 완료 아이템 등록
    const markAsRendered = (elementId, partNum, colorId) => {
      const key = `${elementId || partNum}-${colorId || 'default'}`
      renderedItems.value.add(key)
      duplicateCheck.value.set(key, {
        elementId,
        partNum,
        colorId,
        renderedAt: new Date().toISOString()
      })
    }

    // 데이터베이스에서 이미 렌더링된 부품 조회 (폴더 기반 중복 체크)
    const getRenderedPartsFromDB = async () => {
      try {
        const { useSupabase } = await import('@/composables/useSupabase')
        const { supabase } = useSupabase()
        
        // 버킷 이름 후보 (환경에 따라 '_' 또는 '-' 사용 가능)
        const candidateBuckets = ['lego_synthetic', 'lego-synthetic']
        
        // 주어진 경로의 폴더가 어떤 버킷에 존재하는지 검사
        const folderExists = async (folderPath) => {
          for (const bucket of candidateBuckets) {
            try {
              const { data: folderData, error: folderError } = await supabase.storage
                .from(bucket)
                // 최소 파일 수 기준으로 존재 판정 강화
                .list(folderPath, { limit: DUP_MIN_FILES })
              if (!folderError && Array.isArray(folderData) && folderData.length >= DUP_MIN_FILES) {
                return true
              }
            } catch (_) {
              // 다음 버킷 후보로 계속 시도
            }
          }
          return false
        }
        
        // synthetic_dataset 테이블에서 렌더링된 부품 조회 (모두)
        const { data, error } = await supabase
          .from('synthetic_dataset')
          .select('part_id, metadata')
          .not('part_id', 'is', null)
        
        if (error) {
          console.warn('렌더링된 부품 조회 실패:', error)
          return new Set()
        }
        
        const validKeys = new Set()
        
        if (data) {
          console.log(`중복 체크 원본 레코드 수: ${data.length}`)
          // 고유한 부품별로 그룹화 (elementId 또는 part_id 기준)
          const uniqueParts = new Map()
          
          for (const item of data) {
            const elementId = item.metadata?.element_id || null
            const colorId = item.metadata?.color_id || null
            const partId = item.part_id
            
            // elementId가 있으면 elementId를, 없으면 partId를 사용
            const productKey = elementId || partId
            const colorKey = colorId || 'default'
            const fullKey = `${productKey}-${colorKey}`
            
            // 폴더 키는 elementId 우선, 없으면 partId 사용
            const folderKey = elementId || partId
            if (!uniqueParts.has(folderKey)) {
              uniqueParts.set(folderKey, {
                elementId,
                partId,
                colorId,
                fullKey,
                folderKey
              })
            }
          }
          
          console.log(`폴더 후보 고유 키 수: ${uniqueParts.size}`)
          // 각 고유 부품의 폴더 존재 여부 확인 (elementId와 partId 모두 시도)
          for (const [, partInfo] of uniqueParts) {
            try {
              const candidates = Array.from(new Set([partInfo.elementId, partInfo.partId].filter(Boolean)))
              let found = false
              for (const candidate of candidates) {
                const folderPath = `synthetic/${candidate}/`
                const exists = await folderExists(folderPath)
                if (exists) {
                  // 폴더가 존재하고 파일이 있으면 렌더링된 것으로 간주
                  validKeys.add(`${candidate}-${partInfo.colorId || 'default'}`)
                  console.log(`✅ 렌더링된 부품 확인: ${candidate} (${candidate}-${partInfo.colorId || 'default'})`)
                  found = true
                  break
                }
              }
              if (!found) {
                // 폴더가 존재하고 파일이 있으면 렌더링된 것으로 간주
                console.log(`❌ 폴더 없음: ${candidates.join(' | ')}`)
              }
            } catch (err) {
              console.warn('폴더 검증 실패', err)
            }
          }
        }
        
        console.log(`폴더 기반 중복 체크 완료: ${validKeys.size}개 부품이 이미 렌더링됨`)
        return validKeys
      } catch (error) {
        console.warn('렌더링된 부품 조회 중 오류:', error)
        return new Set()
      }
    }

    // 스토리지 폴더 기반으로, 주어진 파트 목록 중 이미 렌더링된 키(elementId/partNum)를 계산
    const getRenderedKeysFromStorage = async (parts) => {
      try {
        const { useSupabase } = await import('@/composables/useSupabase')
        const { supabase } = useSupabase()
        const candidateBuckets = ['lego_synthetic', 'lego-synthetic']
        const folderExists = async (folderPath) => {
          for (const bucket of candidateBuckets) {
            try {
              // CORS 문제 해결을 위한 백엔드 프록시 사용
              const proxyUrl = `/api/supabase/storage/list/${bucket}/${encodeURIComponent(folderPath)}`
              const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                }
              })
              
              if (response.ok) {
                const folderData = await response.json()
                if (Array.isArray(folderData) && folderData.length >= DUP_MIN_FILES) {
                  console.log(`✅ 폴더 확인: ${bucket}/${folderPath} (${folderData.length}개 파일)`)
                  return true
                }
              } else {
                console.warn(`⚠️ 프록시 요청 실패: ${response.status}`)
              }
            } catch (err) {
              console.warn(`⚠️ 버킷 ${bucket} 접근 실패:`, err.message)
              // 다음 버킷 후보 시도
            }
          }
          console.log(`❌ 폴더 없음: ${folderPath} (모든 버킷에서 확인됨)`)
          return false
        }
        // 폴더 키(elementId || part_num)별로 해당 파트들의 elementKey 집합을 구성
        const folderKeyToElementKeys = new Map()
        for (const p of parts || []) {
          const partNum = typeof p === 'string' ? p : p.part_num
          const colorId = typeof p === 'object' ? (p.color_id ?? null) : null
          const elementId = typeof p === 'object' ? (p.element_id ?? null) : null
          const folderKey = elementId || partNum
          const elementKey = `${elementId || partNum}-${colorId || 'default'}`
          if (!folderKey) continue
          if (!folderKeyToElementKeys.has(folderKey)) folderKeyToElementKeys.set(folderKey, new Set())
          folderKeyToElementKeys.get(folderKey).add(elementKey)
        }
        // 폴더 존재 확인 후, 존재하는 폴더의 elementKey들을 결과로 반환 (배치 병렬 처리)
        const renderedKeys = new Set()
        const folderKeys = Array.from(folderKeyToElementKeys.keys())
        const batchSize = STORAGE_BATCH_SIZE // 한 번에 처리할 폴더 수(완화)
        const totalBatches = Math.ceil(folderKeys.length / batchSize)
        
        console.log(`${folderKeys.length}개 폴더를 ${totalBatches}개 배치로 병렬 처리합니다`)
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIndex = batchIndex * batchSize
          const endIndex = Math.min(startIndex + batchSize, folderKeys.length)
          const batchKeys = folderKeys.slice(startIndex, endIndex)
          
          console.log(`배치 ${batchIndex + 1}/${totalBatches} 처리 중 (${batchKeys.length}개 폴더)`)
          
          // 배치 내에서 병렬 처리
          const batchPromises = batchKeys.map(async (folderKey) => {
            const exists = await folderExists(`synthetic/${folderKey}/`)
            return { folderKey, exists, keysSet: folderKeyToElementKeys.get(folderKey) }
          })
          
          // 배치 결과 대기
          const batchResults = await Promise.all(batchPromises)
          
          // 결과 처리
          batchResults.forEach(({ folderKey, exists, keysSet }) => {
            if (exists) {
              for (const k of keysSet) renderedKeys.add(k)
              console.log(`✅ 폴더 확인(렌더링됨): ${folderKey} → ${keysSet.size}개 키 추가`)
            } else {
              console.log(`❌ 폴더 없음: ${folderKey}`)
            }
          })
          
          // 진행률 표시
          const progress = Math.round(((batchIndex + 1) / totalBatches) * 100)
          console.log(`폴더 검증 진행률: ${progress}% (${batchIndex + 1}/${totalBatches} 배치 완료)`)
        }
        return renderedKeys
      } catch (e) {
        console.warn('스토리지 기반 렌더링 키 계산 실패:', e)
        return new Set()
      }
    }

    // 빠른 중복 제거 (데이터베이스 검증 없이)
    const getUniquePartsFast = async (parts, renderedKeys) => {
      console.log(`getUniquePartsFast 시작: 입력 부품 ${parts.length}개`)
      const unique = []
      const seen = new Set()
      
      for (const part of parts) {
        const partNum = typeof part === 'string' ? part : part.part_num
        const colorId = typeof part === 'object' ? (part.color_id ?? null) : null
        const elementId = typeof part === 'object' ? (part.element_id ?? null) : null
        
        // 엘리먼트 아이디 기반 키 생성
        const elementKey = `${elementId || partNum}-${colorId || 'default'}`
        
        // 중복 체크: 이미 처리된 부품만 체크
        if (!seen.has(elementKey) && !(renderedKeys && renderedKeys.has(elementKey))) {
          seen.add(elementKey)
          unique.push({
            part_num: partNum,
            color_id: colorId,
            element_id: elementId,
            unique_key: elementKey
          })
        } else if (renderedKeys && renderedKeys.has(elementKey)) {
          console.log(`이미 렌더링된 부품 제외(스토리지): ${partNum} (${elementId}) - 키: ${elementKey}`)
        } else {
          console.log(`중복 부품 제외: ${partNum} (${elementId}) - 키: ${elementKey}`)
        }
      }
      
      console.log(`getUniquePartsFast 완료: ${unique.length}개 반환`)
      return unique
    }

    // 중복 제거된 부품 목록 생성 (데이터베이스 기반)
    const getUniqueParts = async (parts) => {
      console.log(`getUniqueParts 시작: 입력 부품 ${parts.length}개`)
      const unique = []
      const seen = new Set()
      
      // 데이터베이스에서 이미 렌더링된 부품 조회
      console.log('데이터베이스에서 렌더링된 부품 조회 중...')
      const renderedKeys = await getRenderedPartsFromDB()
      console.log(`이미 렌더링된 부품: ${renderedKeys.size}개`)
      
      for (const part of parts) {
        const partNum = typeof part === 'string' ? part : part.part_num
        const colorId = typeof part === 'object' ? (part.color_id ?? null) : null
        const elementId = typeof part === 'object' ? (part.element_id ?? null) : null
        const key = `${elementId || partNum}-${colorId || 'default'}`
        
        // 엘리먼트 아이디 기반 키 생성 (버킷/로컬 저장 방식과 일치)
        const elementKey = `${elementId || partNum}-${colorId || 'default'}`
        
        // 중복 체크: 1) 이미 처리된 부품, 2) 데이터베이스에서 이미 렌더링된 부품
        if (!seen.has(elementKey) && !renderedKeys.has(elementKey)) {
          seen.add(elementKey)
          unique.push({
            part_num: partNum,
            color_id: colorId,
            element_id: elementId,
            unique_key: elementKey
          })
        } else if (renderedKeys.has(elementKey)) {
          console.log(`이미 렌더링된 부품 제외: ${partNum} (${elementId}) - 엘리먼트 키: ${elementKey}`)
        } else {
          console.log(`중복 부품 제외: ${partNum} (${elementId}) - 키: ${elementKey}`)
        }
      }
      
      console.log(`getUniqueParts 완료: ${unique.length}개 반환`)
      return unique
    }

    // 메서드
    const validatePartId = async () => {
      if (!selectedPartId.value) {
        partValidation.value = ''
        return
      }
      
      try {
        // 부품 ID 유효성 검사 로직
        const isValid = /^[0-9]+$/.test(selectedPartId.value)
        if (isValid) {
          partValidation.value = '✅ 유효한 부품 ID'
        } else {
          partValidation.value = '❌ 잘못된 부품 ID 형식'
        }
      } catch (error) {
        partValidation.value = '❌ 검증 실패'
      }
    }

    const loadAvailableSets = async () => {
      try {
        const { useSupabase } = await import('@/composables/useSupabase')
        const { supabase } = useSupabase()
        
        // synthetic_dataset에서 사용 가능한 세트 목록 조회
        const { data, error } = await supabase
          .from('synthetic_dataset')
          .select('set_num')
          .not('set_num', 'is', null)
          .order('set_num')
          .limit(50)
        
        if (error) {
          throw error
        }
        
        // 중복 제거하여 고유한 세트 목록 생성
        const uniqueSets = [...new Set(data.map(item => item.set_num))]
        availableSets.value = uniqueSets
        renderLogs.value.push({ 
          type: 'info', 
          message: `사용 가능한 세트 ${availableSets.value.length}개 로드됨` 
        })
        
      } catch (error) {
        console.error('사용 가능한 세트 로드 실패:', error)
        renderLogs.value.push({ 
          type: 'error', 
          message: `세트 목록 로드 실패: ${error.message}` 
        })
      }
    }

    const loadSetParts = async () => {
      if (!selectedSetNum.value) return
      
      try {
        // 저장된 데이터베이스에서 직접 로드 (CORS 문제 해결)
        console.log('세트 부품 로드 (데이터베이스):', selectedSetNum.value)
        const { useMasterPartsMatching } = await import('@/composables/useMasterPartsMatching')
        const { loadTargetSetParts } = useMasterPartsMatching()
        
        const result = await loadTargetSetParts(selectedSetNum.value)
        const rows = result.targetParts || []
        
        // element_id, part_num, color_id + AI 메타데이터 보존 (기술문서 3.3절)
        const items = rows.map(r => ({
          part_num: r.part_id,
          color_id: r.color_id,
          element_id: r.element_id || null,
          // AI 메타데이터 추가 (parts_master_features 연동)
          shape_tag: r.shape_tag || null,
          part_category: r.part_category || null,
          series: r.series || 'system',
          center_stud: r.center_stud || false,
          groove: r.groove || false,
          confusions: r.confusions || [],
          distinguishing_features: r.distinguishing_features || [],
          expected_stud_count: r.expected_stud_count || 0,
          expected_hole_count: r.expected_hole_count || 0,
          topo_applicable: r.topo_applicable || false,
          recognition_hints: r.recognition_hints || {}
        })).filter(it => it.part_num)
        
        console.log(`원본 부품 데이터: ${items.length}개`)
        console.log('첫 번째 부품 샘플:', items[0])
        
        // 스토리지 폴더 기반으로 현재 세트의 부품 중 이미 렌더링된 키 계산 (빠르고 정확)
        console.log('스토리지에서 렌더링된 부품 수 조회 중...')
        const storageRenderedKeys = await getRenderedKeysFromStorage(items)
        databaseRenderedCount.value = storageRenderedKeys.size
        console.log(`스토리지에서 렌더링된 부품: ${databaseRenderedCount.value}개`)
        
        // 중복 제거 (스토리지에서 이미 렌더링된 키 제외)
        console.log('getUniqueParts 함수 호출 시작 (빠른 모드)')
        const uniqueParts = await getUniquePartsFast(items, storageRenderedKeys)
        console.log(`getUniqueParts 결과: ${uniqueParts.length}개`)
        console.log('uniqueParts 샘플:', uniqueParts[0])
        
        setParts.value = uniqueParts
        console.log(`setParts.value 설정 완료: ${setParts.value.length}개`)
        
        excludedCount.value = items.length - uniqueParts.length
        console.log(`세트 부품 ${uniqueParts.length}개 준비 완료 (전체 ${items.length}개 중 ${excludedCount.value}개 제외됨)`)
        
        if (excludedCount.value > 0) {
          renderLogs.value.push({ 
            type: 'info', 
            message: `이미 렌더링된 부품 ${excludedCount.value}개가 제외되었습니다` 
          })
        } 
      } catch (error) {
        console.error('세트 부품 로드 실패:', error)
        renderLogs.value.push({ 
          type: 'error', 
          message: `세트 ${selectedSetNum.value}를 찾을 수 없습니다. '사용 가능한 세트 보기' 버튼을 클릭하여 올바른 세트 번호를 확인하세요.` 
        })
      }
    }

    const updateRenderSettings = () => {
      console.log('렌더링 설정 업데이트:', renderMode.value)
    }

    // 서버 연결 상태 확인
    const checkServerConnection = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/synthetic/status', { 
          timeout: 3000,
          signal: AbortSignal.timeout(3000)
        })
        return response.ok
      } catch (error) {
        console.warn('서버 연결 확인 실패:', error)
        return false
      }
    }
    
    // 자동 서버 재연결
    const autoReconnect = async (maxRetries = 5) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          console.log(`서버 재연결 시도 ${i + 1}/${maxRetries}`)
          
          // 서버 상태 확인
          if (await checkServerConnection()) {
            console.log('✅ 서버 연결 복구됨')
            return true
          }
          
          // 잠시 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 2000))
          
        } catch (error) {
          console.warn(`재연결 시도 ${i + 1} 실패:`, error)
        }
      }
      
      console.error('❌ 서버 재연결 실패')
      return false
    }
    
    // 자동 복구 시스템 상태 조회
    const fetchAutoRecoveryStatus = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/synthetic/auto-recovery/status', {
          timeout: 3000,
          signal: AbortSignal.timeout(3000)
        })
        
        if (response.ok) {
          const data = await response.json()
          autoRecoveryStatus.value = data.autoRecovery
          return true
        }
        return false
      } catch (error) {
        console.warn('자동 복구 상태 조회 실패:', error)
        return false
      }
    }
    
    // 자동 복구 시스템 시작
    const startAutoRecovery = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/synthetic/auto-recovery/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          autoRecoveryStatus.value = data.status
          renderLogs.value.push({
            type: 'success',
            message: '자동 복구 시스템이 시작되었습니다'
          })
          return true
        }
        return false
      } catch (error) {
        console.error('자동 복구 시스템 시작 실패:', error)
        renderLogs.value.push({
          type: 'error',
          message: `자동 복구 시스템 시작 실패: ${error.message}`
        })
        return false
      }
    }
    
    // 자동 복구 시스템 중단
    const stopAutoRecovery = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/synthetic/auto-recovery/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          autoRecoveryStatus.value = data.status
          renderLogs.value.push({
            type: 'info',
            message: '자동 복구 시스템이 중단되었습니다'
          })
          return true
        }
        return false
      } catch (error) {
        console.error('자동 복구 시스템 중단 실패:', error)
        renderLogs.value.push({
          type: 'error',
          message: `자동 복구 시스템 중단 실패: ${error.message}`
        })
        return false
      }
    }
    
    // 자동 복구 시스템 모니터링 시작
    const startAutoRecoveryMonitoring = () => {
      if (autoRecoveryMonitoring.value) return
      
      autoRecoveryMonitoring.value = true
      
      const monitorInterval = setInterval(async () => {
        if (!autoRecoveryMonitoring.value) {
          clearInterval(monitorInterval)
          return
        }
        
        await fetchAutoRecoveryStatus()
      }, 5000) // 5초마다 상태 업데이트
      
      renderLogs.value.push({
        type: 'info',
        message: '자동 복구 시스템 모니터링이 시작되었습니다'
      })
    }
    
    // 자동 복구 시스템 상태 실시간 업데이트
    const updateAutoRecoveryStatus = () => {
      if (autoRecoveryMonitoring.value) {
        fetchAutoRecoveryStatus()
      }
    }
    
    // 포트 상태 조회
    const fetchPortStatus = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/synthetic/ports/status', {
          timeout: 3000,
          signal: AbortSignal.timeout(3000)
        })
        
        if (response.ok) {
          const data = await response.json()
          portManagerStatus.value = data.portManager
          return true
        }
        return false
      } catch (error) {
        console.warn('포트 상태 조회 실패:', error)
        return false
      }
    }
    
    // 포트 재할당
    const reallocatePort = async (preferredPort = 3002) => {
      try {
        const response = await fetch('http://localhost:3002/api/synthetic/ports/reallocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredPort })
        })
        
        if (response.ok) {
          const data = await response.json()
          renderLogs.value.push({
            type: 'success',
            message: `포트 재할당 완료: ${data.newPort}`
          })
          await fetchPortStatus()
          return true
        }
        return false
      } catch (error) {
        console.error('포트 재할당 실패:', error)
        renderLogs.value.push({
          type: 'error',
          message: `포트 재할당 실패: ${error.message}`
        })
        return false
      }
    }
    
    // 포트 모니터링 시작/중단
    const togglePortMonitoring = async (action) => {
      try {
        const response = await fetch(`http://localhost:3002/api/synthetic/ports/monitoring/${action}`, {
          method: 'POST'
        })
        
        if (response.ok) {
          const data = await response.json()
          renderLogs.value.push({
            type: 'info',
            message: data.message
          })
          await fetchPortStatus()
          return true
        }
        return false
      } catch (error) {
        console.error('포트 모니터링 제어 실패:', error)
        renderLogs.value.push({
          type: 'error',
          message: `포트 모니터링 제어 실패: ${error.message}`
        })
        return false
      }
    }
    
    // 자동 복구 시스템 모니터링 중단
    const stopAutoRecoveryMonitoring = () => {
      autoRecoveryMonitoring.value = false
      renderLogs.value.push({
        type: 'info',
        message: '자동 복구 시스템 모니터링이 중단되었습니다'
      })
    }

    const startRendering = async () => {
      if (!canStartRendering.value) return
      
      // 서버 연결 확인
      if (!(await checkServerConnection())) {
        renderLogs.value.push({ 
          type: 'warning', 
          message: '서버 연결 실패. 자동 재연결 시도 중...' 
        })
        
        if (!(await autoReconnect())) {
          renderLogs.value.push({ 
            type: 'error', 
            message: '서버 재연결 실패. 수동으로 서버를 시작해주세요.' 
          })
          return
        }
      }
      
      // 세트 모드는 단일 호출 대신 배치 렌더링 플로우로 위임
      if (renderMode.value === 'set') {
        await startSetRendering()
        return
      }

      isRendering.value = true
      renderProgress.value = 0
      currentImage.value = 0
      totalImages.value = imageCount.value
      renderLogs.value = []
      
      try {
        // 단일 부품 모드에서 AI 메타데이터 가져오기 (옵션)
        let aiMetadata = null
        if (renderMode.value === 'single' && selectedPartId.value) {
          try {
            const { useSupabase } = await import('@/composables/useSupabase')
            const { supabase } = useSupabase()
            
        const { data: metaData } = await supabase
          .from('parts_master_features')
          .select('shape_tag, part_category, series, center_stud, groove, confusions, distinguishing_features, expected_stud_count, expected_hole_count, topo_applicable, recognition_hints')
          .eq('part_id', selectedPartId.value)
          .maybeSingle()
            
            if (metaData) {
              aiMetadata = metaData
            }
          } catch (err) {
            console.warn('AI 메타데이터 로드 실패:', err)
          }
        }

        const renderConfig = {
          mode: renderMode.value,
          partId: selectedPartId.value,
          setNum: selectedSetNum.value,
          imageCount: imageCount.value,
          quality: renderQuality.value,
          background: background.value,
          resolution: resolution.value,
          targetFill: 0.92,
          // WebP 설정 (기술문서 2.4절)
          webp: {
            quality: webpQuality.value,
            method: webpMethod.value,
            autoFilter: webpAutoFilter.value
          },
          // RDA 설정 (기술문서 3.2절)
          rda: {
            strength: rdaStrength.value
          },
          // YOLO 설정 (기술문서 4.2절)
          yolo: {
            conf: yoloConf.value,
            iou: yoloIou.value,
            maxDet: yoloMaxDet.value
          },
          // AI 메타데이터 (기술문서 3.3절 매핑)
          ...(aiMetadata ? {
            aiMeta: {
              shape_tag: aiMetadata.shape_tag,
              part_category: aiMetadata.part_category,
              series: aiMetadata.series,
              center_stud: aiMetadata.center_stud || false,
              groove: aiMetadata.groove || false,
              confusions: aiMetadata.confusions || [],
              distinguishing_features: aiMetadata.distinguishing_features || [],
              expected_stud_count: aiMetadata.expected_stud_count || 0,
              expected_hole_count: aiMetadata.expected_hole_count || 0,
              topo_applicable: aiMetadata.topo_applicable || false,
              recognition_hints: aiMetadata.recognition_hints || {}
            }
          } : {}),
          // 어노테이션 스키마 버전 명시
          schemaVersion: '1.6.1'
        }
        // 숫자만 입력된 경우는 엘리먼트 ID로 처리하도록 전송 값 보강
        if (renderMode.value === 'single' && selectedPartId.value && /^\d+$/.test(selectedPartId.value.trim())) {
          renderConfig.elementId = selectedPartId.value.trim()
          
          // 중복 렌더링 체크 (데이터베이스 기반)
          const renderedKeys = await getRenderedPartsFromDB()
          const elementKey = `${renderConfig.elementId || renderConfig.partId}-${renderConfig.colorId || 'default'}`
          
          if (renderedKeys.has(elementKey)) {
            renderLogs.value.push({ 
              type: 'warning', 
              message: `부품 ${renderConfig.partId} (${renderConfig.elementId}) - 이미 렌더링됨, 렌더링을 건너뜁니다` 
            })
            isRendering.value = false
            return
          }
          
          // 서버 해석 API 호출해 파일 조회용 partId 미리 확보
          try {
            const r = await fetch(`/api/synthetic/resolve-element/${renderConfig.elementId}`, { cache: 'no-store' })
            if (r.ok) {
              const j = await r.json()
              if (j && j.success && j.partId) {
                resolvedPartIdForFiles.value = j.partId
              }
            }
          } catch (e) {
            console.warn('elementId 해석 실패(클라이언트):', e)
          }
        }
        
        console.log('렌더링 시작:', renderConfig)
        
        // 현재 렌더링 부품 정보 설정
        currentRenderingPart.value = {
          partId: renderConfig.partId,
          elementId: renderConfig.elementId,
          colorId: renderConfig.colorId,
          setNum: renderConfig.setNum,
          samples: getSamplesForQuality(renderConfig.quality),
          quality: renderConfig.quality,
          resolution: renderConfig.resolution
        }
        
        // API 호출
        const response = await startRenderingAPI(renderConfig)
        
        // 서버에서 jobId를 반환하므로 폴링하며 파일 목록을 가져옴
        if (response && response.success && response.jobId) {
          const jobId = response.jobId
          renderLogs.value.push({ type: 'info', message: `작업 시작: ${jobId}` })
          // 2초 간격으로 진행상황과 파일 목록 확인
          const pollInterval = setInterval(async () => {
            try {
              // 진행상황
              // Synthetic API 서버 포트 동적 감지
              let syntheticPort = 3001 // 기본값
              try {
                const portResponse = await fetch('/.synthetic-api-port.json')
                if (portResponse.ok) {
                  const portData = await portResponse.json()
                  syntheticPort = portData.port
                }
              } catch (portError) {
                console.warn('Synthetic API 포트 정보 읽기 실패, 기본값 사용:', portError.message)
              }
              
              const progressRes = await fetch(`http://localhost:${syntheticPort}/api/synthetic/progress/${jobId}`, { 
                cache: 'no-store', 
                headers: { 'Cache-Control': 'no-cache' },
                signal: AbortSignal.timeout(5000) // 5초 타임아웃
              })
              const progressJson = await progressRes.json()
              if (progressJson && progressJson.success) {
                renderProgress.value = Math.round(progressJson.progress || 0)
                if (progressJson.logs) {
                  renderLogs.value.push(...progressJson.logs)
                }
              }
              // 파일 목록: 단일 부품 모드에서만 조회 (set 모드는 partId가 비어 404 발생 방지)
              const isSingleMode = renderMode.value === 'single'
              const fetchPart = resolvedPartIdForFiles.value || selectedPartId.value
              if (isSingleMode && fetchPart) {
                try {
                  const filesRes = await fetch(`http://localhost:3007/api/synthetic/files/${fetchPart}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
                  if (!filesRes.ok) {
                    // 404 등은 무시하고 다음 폴링으로
                    return
                  }
                  const filesJson = await filesRes.json()
                  if (filesJson && filesJson.success && Array.isArray(filesJson.results)) {
                    // 각 결과에 품질 메트릭 추가
                    renderResults.value = filesJson.results.map(result => {
                      const qualityResult = validateQuality(result.metadata)
                      return {
                        ...result,
                        warnings: qualityResult.warnings,
                        metrics: qualityResult.metrics,
                        partId: result.partId || result.part_id,
                        elementId: result.elementId || result.element_id
                      }
                    })
                    currentImage.value = filesJson.results.length
                    totalImages.value = imageCount.value
                  }
                } catch (e) {
                  // HTML 응답(JSON 파싱 실패) 등은 무시
                }
              }
              // 완료 조건
              if (progressJson && progressJson.status === 'completed') {
                // 렌더링 완료 시 통계 업데이트
                await refreshStats()
                clearInterval(pollInterval)
                isRendering.value = false
                renderProgress.value = 100
                renderLogs.value.push({ type: 'success', message: '렌더링 완료' })
                
                // 🚀 자동 학습 트리거
                await triggerAutoTraining()
                
                // 완료된 부품을 목록에 추가
                if (currentRenderingPart.value) {
                  const completedPart = {
                    ...currentRenderingPart.value,
                    imageCount: renderResults.value.length,
                    completedAt: new Date().toISOString()
                  }
                  completedParts.value.push(completedPart)
                  
                  // 렌더링 완료 아이템 등록 (중복 방지)
                  markAsRendered(
                    currentRenderingPart.value.elementId, 
                    currentRenderingPart.value.partId, 
                    currentRenderingPart.value.colorId
                  )
                  
                  currentRenderingPart.value = null
                }
              }
            } catch (e) {
              console.error(e)
            }
          }, POLL_INTERVAL_MS)
        } else {
          // 폴백: 기본값 사용
          simulateRendering()
        }
        
      } catch (error) {
        console.error('렌더링 시작 실패:', error)
        isRendering.value = false
      }
    }

    const simulateRendering = () => {
      const interval = setInterval(() => {
        if (renderProgress.value >= 100) {
          clearInterval(interval)
          isRendering.value = false
          loadRenderResults()
          return
        }
        
        renderProgress.value += 10
        currentImage.value = Math.floor((renderProgress.value / 100) * totalImages.value)
        
        renderLogs.value.push({
          type: 'info',
          message: `이미지 ${currentImage.value} 렌더링 완료`
        })
      }, POLL_INTERVAL_MS)
    }

    const stopRendering = async () => {
      try {
        await stopRenderingAPI()
        isRendering.value = false
        renderProgress.value = 0
        console.log('렌더링 중지')
      } catch (error) {
        console.error('렌더링 중지 실패:', error)
      }
    }

    // 세트 전체 배치 렌더링
    const startSetRendering = async () => {
      console.log('세트 전체 렌더링 시작')
      console.log('selectedSetNum:', selectedSetNum.value)
      console.log('setParts.length:', setParts.value.length)
      
      if (!selectedSetNum.value) {
        renderLogs.value.push({ 
          type: 'error', 
          message: '세트 번호를 입력해주세요' 
        })
        return
      }
      
      if (setParts.value.length === 0) {
        renderLogs.value.push({ 
          type: 'error', 
          message: '세트 부품이 로드되지 않았습니다. 먼저 "부품 로드 (DB)" 버튼을 클릭하세요' 
        })
        return
      }
      
      console.log('세트 렌더링 조건 통과, 렌더링 시작')
      isRendering.value = true
      renderLogs.value = []
      renderResults.value = []
      completedParts.value = []
      failedParts.value = []
      
      try {
        // 스토리지 폴더 기반으로 이번 세트에서 이미 렌더링된 키를 한 번만 계산
        console.log('스토리지 기반 중복 키 계산 중...')
        const renderedKeys = await getRenderedKeysFromStorage(setParts.value)
        console.log(`이미 렌더링된 부품(스토리지): ${renderedKeys.size}개`)
        
        for (let i = 0; i < setParts.value.length; i++) {
          const item = setParts.value[i]
          const partNum = typeof item === 'string' ? item : item.part_num
          const colorId = typeof item === 'object' ? (item.color_id ?? null) : null
          const elementIdRaw = typeof item === 'object' ? (item.element_id ?? null) : null
          // elementId 우선순위: element_id → (part_num + '-' + color_id) → part_num
          const elementId = elementIdRaw || (partNum && Number.isInteger(colorId) ? `${partNum}-${colorId}` : partNum)
          
          // 중복 렌더링 체크 (이미 조회된 데이터 사용)
          const elementKey = `${elementId || partNum}-${colorId || 'default'}`
          
          if (renderedKeys.has(elementKey)) {
            console.log(`중복 부품 발견: ${partNum} (${elementId}) - 키: ${elementKey}`)
            renderLogs.value.push({ 
              type: 'info', 
              message: `부품 ${i + 1}/${setParts.value.length}: ${partNum} (${elementId}) - 이미 렌더링됨, 건너뜀` 
            })
            continue
          }
          
          console.log(`새로운 부품 렌더링 시작: ${partNum} (${elementId}) - 키: ${elementKey}`)
          
          // 현재 렌더링 부품 정보 설정
          currentRenderingPart.value = {
            partId: partNum,
            elementId: elementId,
            colorId: colorId,
            setNum: selectedSetNum.value,
            samples: getSamplesForQuality(renderQuality.value),
            quality: renderQuality.value,
            resolution: resolution.value
          }
          
          const cfg = {
            mode: 'single',
            partId: partNum,
            setNum: selectedSetNum.value,
            imageCount: imageCount.value,
            quality: renderQuality.value,
            background: background.value,
            resolution: resolution.value,
            // WebP 설정
            webp: {
              quality: webpQuality.value,
              method: webpMethod.value,
              autoFilter: webpAutoFilter.value
            },
            // RDA 설정
            rda: {
              strength: rdaStrength.value
            },
            // YOLO 설정
            yolo: {
              conf: yoloConf.value,
              iou: yoloIou.value,
              maxDet: yoloMaxDet.value
            },
            // AI 메타데이터 (기술문서 3.3절 매핑)
            aiMeta: {
              shape_tag: item.shape_tag,
              part_category: item.part_category,
              series: item.series,
              center_stud: item.center_stud || false,
              groove: item.groove || false,
              confusions: item.confusions || [],
              distinguishing_features: item.distinguishing_features || [],
              expected_stud_count: item.expected_stud_count || 0,
              expected_hole_count: item.expected_hole_count || 0,
              topo_applicable: item.topo_applicable || false,
              recognition_hints: item.recognition_hints || {}
            },
            schemaVersion: '1.6.1',
            ...(elementId ? { elementId } : {}),
            ...(Number.isInteger(colorId) ? { colorId } : {})
          }
          
          renderLogs.value.push({ 
            type: 'info', 
            message: `부품 ${i + 1}/${setParts.value.length}: ${partNum} (${elementId}) 렌더링 시작` 
          })
          
          try {
            const resp = await startRenderingAPI(cfg)
            if (resp && resp.jobId) {
              const jobId = resp.jobId
              let status = 'running'
              let attempts = 0
              const maxAttempts = TIMEOUT_MAX_ATTEMPTS // 10분 타임아웃
              
              while (status === 'running' && attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
                try {
                  // Synthetic API 서버 포트 동적 감지
                  let syntheticPort = 3002 // 기본값
                  try {
                    const portResponse = await fetch('/.synthetic-api-port.json')
                    if (portResponse.ok) {
                      const portData = await portResponse.json()
                      syntheticPort = portData.port
                    }
                  } catch (portError) {
                    console.warn('Synthetic API 포트 정보 읽기 실패, 기본값 사용:', portError.message)
                  }
                  
                  const pRes = await fetch(`http://localhost:${syntheticPort}/api/synthetic/progress/${jobId}`, { cache: 'no-store' })
                  const pJson = await pRes.json()
                  status = pJson.status
                  attempts++
                  
                  // 진행 상황 로그
                  if (attempts % 10 === 0) {
                    renderLogs.value.push({ 
                      type: 'info', 
                      message: `부품 ${partNum} (${elementId}) 렌더링 진행 중... (${attempts}/${maxAttempts})` 
                    })
                  }
                } catch (fetchError) {
                  console.warn(`진행 상황 조회 실패 (시도 ${attempts}):`, fetchError)
                  attempts++
                }
              }
              
              if (status === 'completed') {
                // 완료된 부품 추가
                const completedPart = {
                  ...currentRenderingPart.value,
                  imageCount: imageCount.value,
                  completedAt: new Date().toISOString()
                }
                completedParts.value.push(completedPart)
                
                // 렌더링 완료 아이템 등록 (중복 방지)
                markAsRendered(elementId, partNum, colorId)
                
                renderLogs.value.push({ 
                  type: 'success', 
                  message: `부품 ${partNum} (${elementId}) 렌더링 완료` 
                })
              } else {
                // 실패한 부품 추가 (중복 방지에서 제외)
                const failedPart = {
                  ...currentRenderingPart.value,
                  error: `타임아웃 또는 오류 (상태: ${status})`,
                  attempts: attempts,
                  failedAt: new Date().toISOString()
                }
                failedParts.value.push(failedPart)
                
                // 실패한 부품은 중복 방지에서 제외 (재시도 가능하도록)
                renderLogs.value.push({ 
                  type: 'error', 
                  message: `부품 ${partNum} (${elementId}) 렌더링 실패 - 재시도 가능` 
                })
              }
            } else {
              // API 호출 실패
              const failedPart = {
                ...currentRenderingPart.value,
                error: 'API 호출 실패',
                attempts: 1,
                failedAt: new Date().toISOString()
              }
              failedParts.value.push(failedPart)
              renderLogs.value.push({ 
                type: 'error', 
                message: `부품 ${partNum} (${elementId}) API 호출 실패` 
              })
            }
          } catch (error) {
            // 렌더링 중 오류
            const failedPart = {
              ...currentRenderingPart.value,
              error: error.message || '알 수 없는 오류',
              attempts: 1,
              failedAt: new Date().toISOString()
            }
            failedParts.value.push(failedPart)
            renderLogs.value.push({ 
              type: 'error', 
              message: `부품 ${partNum} (${elementId}) 렌더링 오류: ${error.message}` 
            })
          }
          
          // 진행률 업데이트
          renderProgress.value = Math.round(((i + 1) / setParts.value.length) * 100)
        }
      } catch (e) {
        console.error('세트 렌더링 오류:', e)
        renderLogs.value.push({ 
          type: 'error', 
          message: `세트 렌더링 중 오류: ${e.message}` 
        })
      } finally {
        isRendering.value = false
        renderProgress.value = 100
        currentRenderingPart.value = null
        
        // 최종 요약
        renderLogs.value.push({
          type: 'info',
          message: `세트 렌더링 완료: 완료 ${completedParts.value.length}개, 실패 ${failedParts.value.length}개`
        })
        
        // 🚀 자동 학습 트리거 (세트 렌더링 완료 시)
        await triggerAutoTraining()
      }
    }

    // 🤖 자동 학습 설정
    const autoTrainingEnabled = ref(false)
    const trainedSetsCount = ref(0)
    const availableSetsCount = ref(0)
    
    // 자동 학습 설정 로드
    const loadAutoTrainingSetting = async () => {
      try {
        const { data, error } = await supabase
          .from('automation_config')
          .select('config_value')
          .eq('config_key', 'auto_training_enabled')
          .single()
        
        if (data && data.config_value) {
          autoTrainingEnabled.value = data.config_value.enabled || false
        }
      } catch (error) {
        console.error('자동 학습 설정 로드 실패:', error)
      }
    }
    
    // 세트 학습 통계 로드
    const loadSetTrainingStats = async () => {
      try {
        // 학습 완료된 세트 수 조회
        const { data: trainedData, error: trainedError } = await supabase
          .from('set_training_status')
          .select('id')
          .eq('status', 'completed')
        
        if (trainedError) {
          console.warn('set_training_status 테이블이 아직 생성되지 않았습니다:', trainedError.message)
          trainedSetsCount.value = 0
        } else if (trainedData) {
          trainedSetsCount.value = trainedData.length
        }
        
        // 검수 가능한 세트 수 조회
        const { data: availableData, error: availableError } = await supabase
          .from('set_training_status')
          .select('id')
          .eq('is_available_for_inspection', true)
        
        if (availableError) {
          console.warn('set_training_status 테이블이 아직 생성되지 않았습니다:', availableError.message)
          availableSetsCount.value = 0
        } else if (availableData) {
          availableSetsCount.value = availableData.length
        }
        
        console.log(`📊 세트 학습 통계: 학습 완료 ${trainedSetsCount.value}개, 검수 가능 ${availableSetsCount.value}개`)
      } catch (error) {
        console.error('세트 학습 통계 로드 실패:', error)
        // 오류 시 기본값 설정
        trainedSetsCount.value = 0
        availableSetsCount.value = 0
      }
    }
    
    // 자동 학습 설정 업데이트
    const updateAutoTrainingSetting = async () => {
      try {
        // 1. 기존 설정 확인
        const { data: existingData, error: selectError } = await supabase
          .from('automation_config')
          .select('*')
          .eq('config_key', 'auto_training_enabled')
          .single()
        
        if (selectError && selectError.code !== 'PGRST116') {
          console.error('기존 설정 조회 실패:', selectError)
        }
        
        let result
        if (existingData) {
          // 기존 설정이 있으면 업데이트
          const { data, error } = await supabase
            .from('automation_config')
            .update({
              config_value: { enabled: autoTrainingEnabled.value },
              description: '자동 학습 활성화 설정',
              is_active: true
            })
            .eq('config_key', 'auto_training_enabled')
            .select()
          
          result = { data, error }
        } else {
          // 기존 설정이 없으면 삽입
          const { data, error } = await supabase
            .from('automation_config')
            .insert({
              config_key: 'auto_training_enabled',
              config_value: { enabled: autoTrainingEnabled.value },
              description: '자동 학습 활성화 설정',
              is_active: true
            })
            .select()
          
          result = { data, error }
        }
        
        if (result.error) {
          console.error('자동 학습 설정 업데이트 실패:', result.error)
          renderLogs.value.push({ 
            type: 'error', 
            message: `❌ 자동 학습 설정 업데이트 실패: ${result.error.message}` 
          })
          return
        }
        
        console.log(`✅ 자동 학습 설정 업데이트: ${autoTrainingEnabled.value ? '활성화' : '비활성화'}`)
        renderLogs.value.push({ 
          type: 'success', 
          message: `🤖 자동 학습 ${autoTrainingEnabled.value ? '활성화' : '비활성화'}됨` 
        })
      } catch (error) {
        console.error('자동 학습 설정 업데이트 실패:', error)
        renderLogs.value.push({ 
          type: 'error', 
          message: `❌ 자동 학습 설정 업데이트 실패: ${error.message}` 
        })
      }
    }

    // 🚀 자동 학습 트리거 함수
    const triggerAutoTraining = async () => {
      // 자동 학습이 비활성화된 경우 스킵
      if (!autoTrainingEnabled.value) {
        console.log('⏸️ 자동 학습이 비활성화되어 있습니다')
        renderLogs.value.push({ 
          type: 'info', 
          message: '⏸️ 자동 학습이 비활성화되어 있습니다. 수동으로 학습을 시작하세요.' 
        })
        return
      }
      
      try {
        console.log('🚀 자동 학습 트리거 시작...')
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-training-trigger`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        })
        
        const result = await response.json()
        
        if (result.success) {
          console.log('✅ 자동 학습 트리거 성공:', result.message)
          renderLogs.value.push({ 
            type: 'success', 
            message: `🤖 자동 학습 시작: ${result.message}` 
          })
        } else {
          console.log('ℹ️ 자동 학습 조건 미충족:', result.message)
          renderLogs.value.push({ 
            type: 'info', 
            message: `ℹ️ 자동 학습 조건: ${result.message}` 
          })
        }
      } catch (error) {
        console.error('❌ 자동 학습 트리거 실패:', error)
        renderLogs.value.push({ 
          type: 'error', 
          message: `❌ 자동 학습 트리거 실패: ${error.message}` 
        })
      }
    }

    const loadRenderResults = async () => {
      try {
        // 렌더링 결과 로드
        renderResults.value = [
          {
            id: 1,
            partId: selectedPartId.value || '',
            imageUrl: await getRealPartImage(selectedPartId.value),
            colorName: '빨강',
            angle: '45°',
            resolution: '640x640'
          }
        ]
      } catch (error) {
        console.error('렌더링 결과 로드 실패:', error)
      }
    }

    const refreshStats = async () => {
      try {
        console.log('🔄 통계 새로고침 시작...')
        const newStats = await getStats()
        stats.value = newStats
        console.log('✅ 통계 새로고침 완료:', newStats)
        
        // 렌더링 상태 업데이트
        if (isRendering.value) {
          stats.value.renderingStatus = '렌더링 중'
        } else if (completedParts.value.length > 0) {
          stats.value.renderingStatus = '완료'
        } else {
          stats.value.renderingStatus = '대기 중'
        }
        
      } catch (error) {
        console.error('❌ 통계 새로고침 실패:', error)
        // 오류 시 기본값 설정
        stats.value = {
          totalParts: 0,
          renderedImages: 0,
          storageUsed: '0 GB',
          renderingStatus: '오류'
        }
      }
    }

    const openImageModal = (image) => {
      selectedImage.value = image
    }

    const closeImageModal = () => {
      selectedImage.value = null
    }

    const downloadImage = (result) => {
      console.log('이미지 다운로드:', result)
    }

    const uploadToSupabase = async (result) => {
      try {
        await uploadToSupabaseAPI(result)
        console.log('Supabase 업로드 완료:', result)
      } catch (error) {
        console.error('Supabase 업로드 실패:', error)
      }
    }

    const startJob = (job) => {
      job.status = 'running'
      console.log('작업 시작:', job)
    }

    const pauseJob = (job) => {
      job.status = 'paused'
      console.log('작업 일시정지:', job)
    }

    const resumeJob = (job) => {
      job.status = 'running'
      console.log('작업 재개:', job)
    }

    const cancelJob = (job) => {
      job.status = 'cancelled'
      console.log('작업 취소:', job)
    }

    // 중복 방지 관련 함수들
    const clearRenderedItems = () => {
      renderedItems.value.clear()
      duplicateCheck.value.clear()
      renderLogs.value.push({ 
        type: 'info', 
        message: '렌더링 기록이 초기화되었습니다' 
      })
    }

    const showRenderedItems = () => {
      const items = Array.from(duplicateCheck.value.values())
      console.log('렌더링된 부품 목록:', items)
      renderLogs.value.push({ 
        type: 'info', 
        message: `렌더링된 부품 ${items.length}개: ${items.map(item => `${item.partNum}(${item.elementId})`).join(', ')}` 
      })
    }

    // 허수 데이터 정리 (버킷 검증)
    const cleanupInvalidData = async () => {
      console.log('허수 데이터 정리 함수 호출됨')
      alert('허수 데이터 정리 함수가 호출되었습니다!')
      try {
        renderLogs.value.push({ 
          type: 'info', 
          message: '허수 데이터 정리 시작...' 
        })
        console.log('허수 데이터 정리 시작')
        
        console.log('Supabase 모듈 로드 중...')
        const { useSupabase } = await import('@/composables/useSupabase')
        console.log('Supabase 모듈 로드 완료')
        const { supabase } = useSupabase()
        console.log('Supabase 클라이언트 초기화 완료')
        
        // synthetic_dataset의 모든 레코드 조회 (전체 데이터) - 페이지네이션 처리
        console.log('synthetic_dataset 테이블 전체 조회 중...')
        let allData = []
        let page = 0
        const pageSize = 1000
        let hasMore = true
        
        while (hasMore) {
          console.log(`페이지 ${page + 1} 조회 중...`)
          const { data, error } = await supabase
            .from('synthetic_dataset')
            .select('id, part_id, metadata, image_url')
            .not('part_id', 'is', null)
            .order('id', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1)
          
          if (error) {
            throw error
          }
          
          if (data && data.length > 0) {
            allData = allData.concat(data)
            console.log(`페이지 ${page + 1} 완료: ${data.length}개 레코드 (누적: ${allData.length}개)`)
            page++
            
            // 페이지 크기보다 적으면 마지막 페이지
            if (data.length < pageSize) {
              hasMore = false
            }
          } else {
            hasMore = false
          }
        }
        
        const data = allData
        console.log(`전체 데이터베이스 조회 완료: 총 ${data.length}개 레코드`)
        
        const invalidRecords = []
        console.log(`총 ${data.length}개 레코드 검증 시작 (배치 처리)`)
        
        // 배치 크기 설정 (한 번에 처리할 레코드 수) - 전체 데이터 처리 최적화
        const batchSize = 100  // 더 큰 배치로 처리 속도 향상
        const totalBatches = Math.ceil(data.length / batchSize)
        
        console.log(`전체 ${data.length}개 레코드를 ${totalBatches}개 배치로 처리합니다`)
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIndex = batchIndex * batchSize
          const endIndex = Math.min(startIndex + batchSize, data.length)
          const batch = data.slice(startIndex, endIndex)
          
          console.log(`배치 ${batchIndex + 1}/${totalBatches} 처리 중 (${startIndex + 1}-${endIndex}번째 레코드)`)
          
          // 배치 내에서 병렬 처리
          const batchPromises = batch.map(async (item, index) => {
            const globalIndex = startIndex + index
            // 더 자주 진행률 표시 (50개마다)
            if (globalIndex % 50 === 0) {
              console.log(`진행률: ${globalIndex + 1}/${data.length} (${Math.round(((globalIndex + 1) / data.length) * 100)}%)`)
            }
            
            if (item.image_url) {
              try {
                // image_url이 전체 URL인 경우 상대 경로 추출
                let filePath = item.image_url
                if (item.image_url.includes('/storage/v1/object/public/lego-synthetic/')) {
                  filePath = item.image_url.split('/storage/v1/object/public/lego-synthetic/')[1]
                } else if (item.image_url.includes('/storage/v1/object/lego-synthetic/')) {
                  filePath = item.image_url.split('/storage/v1/object/lego-synthetic/')[1]
                }
                
                // lego-synthetic 버킷 > synthetic > 부품폴더 경로 확인
                const { data: fileData, error: fileError } = await supabase.storage
                  .from('lego-synthetic')
                  .download(filePath)
                
                if (fileError || !fileData) {
                  return { id: item.id, partId: item.part_id, reason: '파일 없음' }
                }
                return null // 파일 존재
              } catch (err) {
                return { id: item.id, partId: item.part_id, reason: '검증 실패' }
              }
            } else {
              return { id: item.id, partId: item.part_id, reason: 'image_url 없음' }
            }
          })
          
          // 배치 결과 대기
          const batchResults = await Promise.all(batchPromises)
          
          // 무효한 레코드 수집
          batchResults.forEach(result => {
            if (result) {
              invalidRecords.push(result.id)
              if (result.reason === '파일 없음') {
                console.warn(`버킷에 파일 없음: ${result.partId}`)
              }
            }
          })
          
          // 진행률 업데이트
          const progress = Math.round(((batchIndex + 1) / totalBatches) * 100)
          renderLogs.value.push({ 
            type: 'info', 
            message: `검증 진행률: ${progress}% (${batchIndex + 1}/${totalBatches} 배치 완료)` 
          })
        }
        
        console.log(`🎉 전체 검증 완료: 무효한 레코드 ${invalidRecords.length}개 발견 (총 ${data.length}개 중)`)
        
        // 무효한 레코드 삭제
        if (invalidRecords.length > 0) {
          console.log(`무효한 레코드 ${invalidRecords.length}개 삭제 시작`)
          const { error: deleteError } = await supabase
            .from('synthetic_dataset')
            .delete()
            .in('id', invalidRecords)
          
          if (deleteError) {
            console.error('삭제 오류:', deleteError)
            throw deleteError
          }
          
          console.log(`허수 데이터 ${invalidRecords.length}개 삭제 완료`)
          renderLogs.value.push({ 
            type: 'success', 
            message: `허수 데이터 ${invalidRecords.length}개 정리 완료` 
          })
        } else {
          console.log('정리할 허수 데이터가 없습니다')
          renderLogs.value.push({ 
            type: 'info', 
            message: '정리할 허수 데이터가 없습니다' 
          })
        }
        
      } catch (error) {
        console.error('허수 데이터 정리 실패:', error)
        renderLogs.value.push({ 
          type: 'error', 
          message: `허수 데이터 정리 실패: ${error.message}` 
        })
        alert(`허수 데이터 정리 실패: ${error.message}`)
      }
    }

    // 실패한 부품 재시도
    const retryFailedParts = async () => {
      if (failedParts.value.length === 0) {
        renderLogs.value.push({ 
          type: 'info', 
          message: '재시도할 실패한 부품이 없습니다' 
        })
        return
      }

      const retryParts = [...failedParts.value]
      failedParts.value = []
      
      renderLogs.value.push({ 
        type: 'info', 
        message: `실패한 부품 ${retryParts.length}개 재시도 시작` 
      })

      for (const failedPart of retryParts) {
        const { partId, elementId, colorId, setNum } = failedPart
        
        // 중복 체크 (재시도 시에는 제외)
        if (isAlreadyRendered(elementId, partId, colorId)) {
          renderLogs.value.push({ 
            type: 'info', 
            message: `부품 ${partId} (${elementId}) - 이미 렌더링됨, 재시도 건너뜀` 
          })
          continue
        }

        renderLogs.value.push({ 
          type: 'info', 
          message: `부품 ${partId} (${elementId}) 재시도 중...` 
        })

        // 재시도 로직 (간단한 버전)
        try {
          const retryConfig = {
            mode: 'single',
            partId: partId,
            setNum: setNum,
            imageCount: imageCount.value,
            quality: renderQuality.value,
            background: background.value,
            ...(elementId ? { elementId } : {}),
            ...(Number.isInteger(colorId) ? { colorId } : {})
          }

          const resp = await startRenderingAPI(retryConfig)
          if (resp && resp.jobId) {
            // 간단한 재시도 - 실제로는 더 복잡한 로직 필요
            renderLogs.value.push({ 
              type: 'success', 
              message: `부품 ${partId} (${elementId}) 재시도 작업 시작됨` 
            })
          }
        } catch (error) {
          renderLogs.value.push({ 
            type: 'error', 
            message: `부품 ${partId} (${elementId}) 재시도 실패: ${error.message}` 
          })
        }
      }
    }

    // 개별 부품 재시도
    const retrySinglePart = async (part) => {
      const { partId, elementId, colorId, setNum } = part
      
      renderLogs.value.push({ 
        type: 'info', 
        message: `부품 ${partId} (${elementId}) 개별 재시도 시작` 
      })

      try {
        const retryConfig = {
          mode: 'single',
          partId: partId,
          setNum: setNum,
          imageCount: imageCount.value,
          quality: renderQuality.value,
          background: background.value,
          ...(elementId ? { elementId } : {}),
          ...(Number.isInteger(colorId) ? { colorId } : {})
        }

        const resp = await startRenderingAPI(retryConfig)
        if (resp && resp.jobId) {
          // 실패한 부품 목록에서 제거
          const index = failedParts.value.findIndex(p => 
            p.partId === partId && p.elementId === elementId && p.colorId === colorId
          )
          if (index > -1) {
            failedParts.value.splice(index, 1)
          }
          
          renderLogs.value.push({ 
            type: 'success', 
            message: `부품 ${partId} (${elementId}) 재시도 작업 시작됨` 
          })
        }
      } catch (error) {
        renderLogs.value.push({ 
          type: 'error', 
          message: `부품 ${partId} (${elementId}) 재시도 실패: ${error.message}` 
        })
      }
    }

    // 기본 부품 이미지 로드 함수
    const getDefaultPartImage = async () => {
      try {
        // Supabase에서 기본 부품 이미지 로드
        const { data, error } = await supabase
          .from('parts_master_features')
          .select('image_url, webp_image_url')
          .eq('part_num', '3001') // 기본 부품 (2x4 브릭)
          .single()
        
        if (error) throw error
        
        return data.webp_image_url || data.image_url || getDefaultPartImage()
        
      } catch (error) {
        console.error('기본 부품 이미지 로드 실패:', error)
        return getDefaultPartImage()
      }
    }

    // 실제 이미지 로드 함수
    const getRealPartImage = async (partId) => {
      try {
        if (!partId) return getDefaultPartImage()
        
        // Supabase에서 실제 부품 이미지 로드
        const { data, error } = await supabase
          .from('parts_master_features')
          .select('image_url, webp_image_url')
          .eq('part_num', partId)
          .single()
        
        if (error) throw error
        
        // WebP 우선, 일반 이미지 폴백
        return data.webp_image_url || data.image_url || getDefaultPartImage()
        
      } catch (error) {
        console.error('실제 부품 이미지 로드 실패:', error)
        return getDefaultPartImage()
      }
    }

    // 생명주기
    onMounted(async () => {
      console.log('🚀 SyntheticDatasetManager 마운트됨')
      // 세션 복원 → 통계 로드
      loadSession()
      await refreshStats()
      await loadAutoTrainingSetting()
      await loadSetTrainingStats()
      
      // 자동 복구 시스템 상태 초기 로드
      await fetchAutoRecoveryStatus()
      
      // 포트 상태 초기 로드
      await fetchPortStatus()
      
      // 통계 디버깅
      console.log('📊 현재 통계:', stats.value)
      
      // 배치 작업 초기화
      batchJobs.value = [
        {
          id: 1,
          name: '1단계 배치 렌더링',
          description: '핵심 부품 100개 렌더링',
          status: 'pending',
          progress: 0
        },
        {
          id: 2,
          name: '2단계 배치 렌더링',
          description: '확장 부품 1,000개 렌더링',
          status: 'pending',
          progress: 0
        }
      ]
    })

    return {
      stats,
      renderMode,
      selectedPartId,
      selectedSetNum,
      imageCount,
      renderQuality,
      background,
      isRendering,
      renderProgress,
      currentImage,
      totalImages,
      renderLogs,
      renderResults,
      availableSets,
      setParts,
      batchJobs,
      selectedImage,
      canStartRendering,
      partValidation,
      currentRenderingPart,
      completedParts,
      failedParts,
      validatePartId,
      loadAvailableSets,
      loadSetParts,
      getUniquePartsFast,
      updateRenderSettings,
      startRendering,
      startSetRendering,
      stopRendering,
      refreshStats,
      openImageModal,
      closeImageModal,
      downloadImage,
      uploadToSupabase,
      startJob,
      pauseJob,
      resumeJob,
      cancelJob,
      resolution,
      renderedItems,
      duplicateCheck,
      excludedCount,
      databaseRenderedCount,
      clearRenderedItems,
      showRenderedItems,
      retryFailedParts,
      retrySinglePart,
      cleanupInvalidData,
      autoTrainingEnabled,
      updateAutoTrainingSetting,
      loadAutoTrainingSetting,
      loadSetTrainingStats,
      // 자동 복구 시스템 관련
      autoRecoveryStatus,
      autoRecoveryMonitoring,
      fetchAutoRecoveryStatus,
      startAutoRecovery,
      stopAutoRecovery,
      startAutoRecoveryMonitoring,
      stopAutoRecoveryMonitoring,
      updateAutoRecoveryStatus,
      // 포트 관리 시스템 관련
      portManagerStatus,
      fetchPortStatus,
      reallocatePort,
      togglePortMonitoring,
      trainedSetsCount,
      availableSetsCount,
      // 신규 설정 (기술문서 정합성)
      webpQuality,
      webpMethod,
      webpAutoFilter,
      rdaStrength,
      yoloConf,
      yoloIou,
      yoloMaxDet,
      showAdvanced,
      validateQuality,
      
      // 렌더링 상태만 유지
      hasRenderedData,
      checkRenderedData
    }
  }
}
</script>

<style scoped>
/* 자동 복구 시스템 UI 스타일 */
.auto-recovery-status {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.status-label {
  font-weight: 500;
  color: #495057;
}

.status-value {
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
}

.auto-recovery-logs {
  margin-top: 15px;
}

.auto-recovery-logs h4,
.auto-recovery-logs h5 {
  margin: 0 0 10px 0;
  color: #495057;
  font-size: 1.1em;
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 10px;
}

.log-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 0.9em;
}

.log-time {
  color: #6c757d;
  margin-right: 10px;
  font-size: 0.8em;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-info {
  background: #d1ecf1;
  color: #0c5460;
}

.log-success {
  background: #d4edda;
  color: #155724;
}

.log-warning {
  background: #fff3cd;
  color: #856404;
}

.log-error {
  background: #f8d7da;
  color: #721c24;
}

/* 자동 복구 독립 패널 */
.auto-recovery-panel {
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.auto-recovery-panel h3 {
  margin: 0 0 20px 0;
  color: #495057;
  font-size: 1.3em;
}

.status-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.status-card {
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.status-title {
  font-weight: 600;
  color: #495057;
  font-size: 1.1em;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #dee2e6;
}

.indicator-active {
  background: #28a745;
}

.indicator-inactive {
  background: #dc3545;
}

.status-content p {
  margin: 5px 0;
  color: #6c757d;
  font-size: 0.9em;
}

.status-content p:first-child {
  font-weight: 500;
  color: #495057;
}

/* 포트 관리 시스템 UI 스타일 */
.port-management-status {
  margin-top: 20px;
  padding: 15px;
  background: #f0f8ff;
  border-radius: 8px;
  border: 1px solid #b3d9ff;
}

.port-management-status h4 {
  margin: 0 0 15px 0;
  color: #0066cc;
  font-size: 1.2em;
}

.port-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.port-status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #b3d9ff;
}

.port-label {
  font-weight: 500;
  color: #0066cc;
}

.port-value {
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  background: #e6f3ff;
  color: #0066cc;
}

.port-history {
  margin-top: 15px;
}

.port-history h5 {
  margin: 0 0 10px 0;
  color: #0066cc;
  font-size: 1.1em;
}

.history-container {
  max-height: 150px;
  overflow-y: auto;
  background: white;
  border: 1px solid #b3d9ff;
  border-radius: 6px;
  padding: 10px;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 0.9em;
  background: #f8fcff;
  border: 1px solid #e6f3ff;
}

.history-time {
  color: #6c757d;
  margin-right: 10px;
  font-size: 0.8em;
  min-width: 80px;
}

.history-port {
  font-weight: 600;
  color: #0066cc;
  margin-right: 10px;
  min-width: 80px;
}

.history-reason {
  flex: 1;
  color: #495057;
  font-style: italic;
}
.synthetic-dataset-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  color: white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-card .stat-icon {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.stat-card .stat-content h3 {
  font-size: 2rem;
  font-weight: bold;
  margin: 0 0 5px 0;
}

.stat-card .stat-content p {
  font-size: 1rem;
  margin: 0 0 5px 0;
  opacity: 0.9;
}

.stat-card .stat-subtitle {
  font-size: 0.8rem;
  opacity: 0.7;
  display: block;
}

/* 자동 학습 설정 스타일 */
.auto-training-settings {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 30px;
}

.auto-training-settings h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
}

.settings-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.setting-item {
  display: flex;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 50px;
  height: 24px;
  background: #ccc;
  border-radius: 12px;
  margin-right: 12px;
  transition: background 0.3s;
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
  transition: transform 0.3s;
}

.toggle-input:checked + .toggle-slider {
  background: #4CAF50;
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(26px);
}

.toggle-text {
  font-weight: 500;
  color: #2c3e50;
}

.setting-info {
  margin-left: 62px;
}

.info-text {
  margin: 0;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 6px;
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

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.header p {
  color: #7f8c8d;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 32px;
}

.stat-content h3 {
  font-size: 24px;
  margin: 0;
  color: #2c3e50;
}

.stat-content p {
  margin: 5px 0 0 0;
  color: #7f8c8d;
  font-size: 14px;
}

.control-panel {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.control-panel h2 {
  margin-top: 0;
  color: #2c3e50;
}

.render-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 25px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-group label {
  font-weight: 600;
  color: #2c3e50;
}

.option-group input,
.option-group select {
  padding: 10px;
  border: 2px solid #e1e8ed;
  border-radius: 8px;
  font-size: 14px;
}

.option-group input:focus,
.option-group select:focus {
  outline: none;
  border-color: #3498db;
}

.validation-message {
  font-size: 12px;
  margin-top: 5px;
}

.quality-info {
  margin-top: 5px;
}

.quality-info small {
  color: #7f8c8d;
  font-style: italic;
}

.adaptive-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
  border-left: 4px solid #3498db;
}

.adaptive-info h4 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 16px;
}

.adaptive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.adaptive-item {
  background: white;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  border: 1px solid #e1e8ed;
}

.adaptive-label {
  display: block;
  font-weight: 600;
  color: #2c3e50;
  font-size: 12px;
  margin-bottom: 5px;
}

.adaptive-samples {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #3498db;
  margin-bottom: 2px;
}

.adaptive-item small {
  color: #7f8c8d;
  font-size: 10px;
}

.adaptive-features {
  text-align: center;
  margin-top: 10px;
}

.adaptive-features small {
  color: #27ae60;
  font-weight: 500;
}

/* 세트 단위 학습 설정 스타일 */
.set-training-settings {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.set-training-settings h4 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 16px;
}

.set-training-info {
  margin-bottom: 15px;
}

.set-training-info .info-text {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #2c3e50;
  line-height: 1.5;
}

.set-stats {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.set-stats .stat-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.set-stats .stat-label {
  font-size: 14px;
  color: #7f8c8d;
  font-weight: 500;
}

.set-stats .stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #3498db;
}

.available-sets {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #3498db;
}

.available-sets small {
  color: #2c3e50;
  font-size: 12px;
  line-height: 1.4;
}

.action-buttons {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.btn-primary {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-danger {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-danger:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
  border: none;
}

.btn-warning {
  background: #f39c12;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-warning:hover {
  background: #e67e22;
}

.btn-warning.btn-small {
  padding: 8px 16px;
  font-size: 14px;
}

.progress-panel {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #ecf0f1;
  border-radius: 10px;
  overflow: hidden;
  margin: 15px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.render-log {
  max-height: 200px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
}

.log-entry {
  padding: 5px 0;
  font-size: 14px;
}

.log-entry.info {
  color: #3498db;
}

.log-entry.success {
  color: #27ae60;
}

.log-entry.error {
  color: #e74c3c;
}

.log-entry.warning {
  color: #f39c12;
}

.results-panel {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.image-card {
  border: 2px solid #e1e8ed;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.image-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.image-card img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  cursor: pointer;
}

.image-info {
  padding: 15px;
}

.image-info p {
  margin: 5px 0;
  font-size: 14px;
}

.image-actions {
  display: flex;
  gap: 10px;
  padding: 15px;
  background: #f8f9fa;
}

.btn-small {
  background: #3498db;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  max-width: 80%;
  max-height: 80%;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(0,0,0,0.5);
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  z-index: 1001;
}

.modal-content img {
  width: 100%;
  height: auto;
  max-height: 60vh;
  object-fit: contain;
}

.modal-info {
  padding: 20px;
}

.batch-management {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.batch-queue {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 20px;
}

.job-card {
  border: 2px solid #e1e8ed;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.job-card.pending {
  border-color: #f39c12;
}

.job-card.running {
  border-color: #3498db;
}

.job-card.paused {
  border-color: #e67e22;
}

.job-card.completed {
  border-color: #27ae60;
}

.job-card.cancelled {
  border-color: #e74c3c;
}

.job-info h4 {
  margin: 0 0 5px 0;
  color: #2c3e50;
}

.job-info p {
  margin: 0 0 10px 0;
  color: #7f8c8d;
  font-size: 14px;
}

.job-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.job-progress .progress-bar {
  width: 200px;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
}

.job-progress .progress-fill {
  height: 100%;
  background: #3498db;
  transition: width 0.3s ease;
}

.job-actions {
  display: flex;
  gap: 10px;
}

/* 현재 렌더링 중인 부품 스타일 */
.current-rendering {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
  border-left: 4px solid #3498db;
}

.current-rendering h4 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 16px;
}

.part-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.part-details, .rendering-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.part-details span, .rendering-stats span {
  font-size: 14px;
  color: #2c3e50;
}

/* 중복 방지 상태 스타일 */
.duplicate-prevention {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 20px;
  border-left: 4px solid #f39c12;
}

.duplicate-prevention h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
}

.data-management {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.data-management h3 {
  margin-top: 0;
  color: #856404;
  font-size: 18px;
}

.management-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.prevention-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat-label {
  font-size: 14px;
  color: #7f8c8d;
  font-weight: 500;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #f39c12;
}

.prevention-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-small {
  background: #95a5a6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.btn-small:hover {
  background: #7f8c8d;
}

/* 렌더링 상태 요약 스타일 */
.status-summary {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.status-summary h3 {
  margin-top: 0;
  color: #2c3e50;
}

.completed-parts, .failed-parts {
  margin-bottom: 20px;
}

.completed-parts h4 {
  color: #27ae60;
  margin-bottom: 15px;
}

.failed-parts h4 {
  color: #e74c3c;
  margin-bottom: 15px;
}

.parts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.part-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  border: 2px solid #e1e8ed;
}

.part-item.completed {
  border-color: #27ae60;
  background: #f8fff8;
}

.part-item.failed {
  border-color: #e74c3c;
  background: #fff8f8;
}

.part-item .part-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.part-item .part-info span {
  font-size: 14px;
  color: #2c3e50;
}

.part-item .part-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0 15px;
}

.part-item .part-stats span {
  font-size: 12px;
  color: #7f8c8d;
}

.part-item .part-status {
  display: flex;
  align-items: center;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.success {
  background: #27ae60;
  color: white;
}

.status-badge.error {
  background: #e74c3c;
  color: white;
}

/* 스키마 정보 패널 스타일 */
.schema-info-panel {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 30px;
  color: white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.schema-info-panel h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: white;
}

.schema-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schema-item {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 12px 15px;
  backdrop-filter: blur(10px);
}

.schema-label {
  font-weight: 600;
  margin-right: 8px;
  display: inline-block;
  min-width: 120px;
}

.schema-value {
  font-weight: 400;
  opacity: 0.95;
}

.schema-item small {
  display: block;
  margin-top: 5px;
  opacity: 0.8;
  font-size: 12px;
}

/* 데이터셋 변환 섹션 스타일 */
/* 데이터셋 변환 안내 섹션 */
.dataset-conversion-notice {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  color: white;
  text-align: center;
}

.dataset-conversion-notice h3 {
  margin: 0 0 15px 0;
  font-size: 1.5rem;
  color: white;
}

.dataset-conversion-notice .notice-content p {
  margin: 0 0 20px 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.dataset-conversion-notice .btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  display: inline-block;
}

.dataset-conversion-notice .btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

/* 프로덕션 환경 안내 스타일 */
.production-notice {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.notice-header h4 {
  margin: 0 0 15px 0;
  color: #856404;
  font-size: 18px;
}

.notice-content p {
  margin: 0 0 15px 0;
  color: #856404;
  font-weight: 500;
}

.notice-content ul {
  margin: 0 0 20px 0;
  padding-left: 20px;
}

.notice-content li {
  margin: 5px 0;
  color: #856404;
}

.alternatives {
  background: white;
  border-radius: 6px;
  padding: 15px;
  border: 1px solid #ffeaa7;
}

.alternatives h5 {
  margin: 0 0 10px 0;
  color: #856404;
  font-size: 16px;
}

.alternatives ol {
  margin: 0;
  padding-left: 20px;
}

.alternatives li {
  margin: 8px 0;
  color: #856404;
}

.alternatives code {
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: #e74c3c;
}


/* 고급 설정 스타일 */
.advanced-settings {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
  border-left: 4px solid #3498db;
}

.advanced-settings h4 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 16px;
}

.advanced-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.advanced-grid .option-group {
  background: white;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #e1e8ed;
}

.advanced-grid .option-group input {
  width: 100%;
}

.advanced-grid .option-group small {
  display: block;
  margin-top: 5px;
  color: #7f8c8d;
  font-size: 11px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .render-options {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .part-info {
    grid-template-columns: 1fr;
  }
  
  .part-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .part-item .part-stats {
    margin: 0;
  }
  
  .advanced-grid {
    grid-template-columns: 1fr;
  }
}
</style>