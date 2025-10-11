<template>
  <div class="hybrid-detection">
    <div class="header">
      <h1>🎯 부품 검출 시스템</h1>
      <p>로컬 캐시 + 원격 데이터베이스 하이브리드 구조로 최적화</p>
    </div>

    <!-- 아키텍처 설명 -->
    <div class="architecture-info">
      <h2>🏗️ 하이브리드 아키텍처</h2>
      <div class="architecture-grid">
        <div class="arch-card">
          <div class="arch-icon">🏢</div>
          <h3>본사 (Supabase)</h3>
          <ul>
            <li>모든 기준 렌더링 이미지</li>
            <li>CLIP/Feature 벡터 관리</li>
            <li>버전 태그 관리</li>
            <li>중앙 제어 & 보안</li>
          </ul>
        </div>
        <div class="arch-card">
          <div class="arch-icon">🏪</div>
          <h3>매장 (로컬 캐시)</h3>
          <ul>
            <li>필요한 부품만 로컬 저장</li>
            <li>빠른 로컬 I/O 처리</li>
            <li>오프라인 동작 가능</li>
            <li>증분 동기화</li>
          </ul>
        </div>
        <div class="arch-card">
          <div class="arch-icon">⚡</div>
          <h3>하이브리드 장점</h3>
          <ul>
            <li>트래픽 거의 0</li>
            <li>매우 빠른 처리</li>
            <li>자동 동기화</li>
            <li>안전한 버전 관리</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 캐시 상태 -->
    <div class="cache-status-panel">
      <h2>📦 캐시 상태</h2>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">로컬 버전:</span>
          <span class="status-value">{{ cacheStats.localVersion || '없음' }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">원격 버전:</span>
          <span class="status-value">{{ getRemoteVersionDisplay }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">동기화 상태:</span>
          <span class="status-value" :class="getSyncStatusClass()">{{ getSyncStatusText() }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">마지막 동기화:</span>
          <span class="status-value">{{ formatDate(cacheStats.lastSync) }}</span>
        </div>
      </div>
      
      <div class="cache-actions">
        <button @click="checkVersionAction" class="btn-secondary" :disabled="loading">
          🔍 버전 체크
        </button>
        <button @click="syncIncrementalAction" class="btn-primary" :disabled="!needsUpdate">
          📦 증분 동기화
        </button>
        <button @click="autoSyncAction" class="btn-success" :disabled="loading">
          🔄 자동 동기화
        </button>
        <button @click="clearCache" class="btn-warning">
          🗑️ 캐시 정리
        </button>
      </div>
    </div>

    <!-- 동기화 결과 -->
    <div class="sync-result-panel" v-if="syncResult">
      <h2>📊 동기화 결과</h2>
      <div class="result-stats">
        <div class="result-item success">
          <div class="result-icon">✅</div>
          <div class="result-content">
            <h3>{{ syncResult.success }}</h3>
            <p>성공한 부품</p>
          </div>
        </div>
        <div class="result-item info">
          <div class="result-icon">📦</div>
          <div class="result-content">
            <h3>{{ syncResult.total }}</h3>
            <p>총 부품 수</p>
          </div>
        </div>
        <div class="result-item version">
          <div class="result-icon">🏷️</div>
          <div class="result-content">
            <h3>{{ syncResult.version }}</h3>
            <p>버전</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 검출 설정 -->
    <div class="detection-panel">
      <h2>🎯 하이브리드 검출</h2>
      
      <div class="config-grid">
        <div class="config-group">
          <label>세트 번호</label>
          <input 
            v-model="setNumber" 
            placeholder="세트 번호 입력"
            @keyup.enter="loadSetMetadata"
          />
          <button @click="loadSetMetadata" class="btn-secondary">메타데이터 로드</button>
        </div>

        <div class="config-group">
          <label>검출 모드</label>
          <div class="detection-mode-info">
            <span class="mode-badge">🎯 폐쇄 환경 하이브리드</span>
            <small>BOM 부품을 기준으로 검출된 객체에서 정확한 매칭 수행</small>
          </div>
        </div>

        <div class="config-group">
          <label>BOM 필터</label>
          <div class="checkbox-group">
            <label>
              <input type="checkbox" v-model="filters.classWhitelist" />
              BOM 클래스만 허용
            </label>
            <label>
              <input type="checkbox" v-model="filters.colorWhitelist" />
              BOM 색상 우선
            </label>
            <label>
              <input type="checkbox" v-model="filters.allowAlternates" />
              대체 부품 허용
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- BOM 정보 -->
    <div class="bom-panel" v-if="bomParts.length > 0">
      <h2>📋 BOM 정보</h2>
      <div class="bom-stats">
        <div class="stat-item">
          <span class="stat-label">총 부품 수:</span>
          <span class="stat-value">{{ bomParts.length }}개</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">색상 수:</span>
          <span class="stat-value">{{ bomColors.length }}개</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">여분 부품:</span>
          <span class="stat-value">{{ sparePartsCount }}개</span>
        </div>
      </div>
      
      <!-- BOM 부품 목록 (상태별 색상) -->
      <div class="bom-parts-list">
        <h3>📦 BOM 부품 목록</h3>
        <div class="parts-grid">
          <div 
            v-for="(part, idx) in bomParts" 
            :key="idx"
            class="part-item"
            :class="getBOMPartStatus(part)"
          >
            <div class="part-icon" :class="getBOMPartStatus(part)">
              {{ getBOMPartIcon(part) }}
            </div>
            <div class="part-content">
              <div class="part-name">{{ part.part_name }}</div>
              <div class="part-details">
                <span class="part-id">{{ part.part_id }}</span>
                <span class="part-color">{{ part.color_name }}</span>
                <span class="part-quantity">수량: {{ part.quantity }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 카메라 컨트롤 -->
    <div class="camera-panel">
      <h2>📷 하이브리드 검출</h2>
      
      <div class="camera-controls">
        <button 
          @click="toggleCamera" 
          :class="cameraActive ? 'btn-danger' : 'btn-primary'"
        >
          {{ cameraActive ? '카메라 중지' : '카메라 시작' }}
        </button>
        
        <button 
          @click="hybridDetect" 
          :disabled="!cameraActive || !setMetadata"
          class="btn-primary"
        >
          🔄 하이브리드 검출
        </button>
        
        <button 
          @click="startRealtimeDetection" 
          :disabled="!cameraActive || realtimeActive"
          class="btn-info"
        >
          🎯 실시간 검출 {{ realtimeActive ? '(실행 중)' : '' }}
        </button>
        
        <button 
          @click="stopRealtimeDetection" 
          :disabled="!realtimeActive"
          class="btn-warning"
        >
          ⏹️ 실시간 중지
        </button>

        <!-- 업로드 기반 검출 -->
        <label class="btn-secondary" style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
          📤 이미지 업로드
          <input type="file" accept="image/*" @change="onUploadImage" style="display:none;" />
        </label>
        <button 
          @click="hybridDetectFromUpload" 
          :disabled="!uploadedImageData || !setMetadata"
          class="btn-secondary"
        >
          🔎 업로드로 검출
        </button>
      </div>

      <!-- 진행률 표시 -->
      <div class="progress" v-if="progress.total > 0">
        <div class="progress-bar" :style="{ width: Math.round((progress.done / progress.total) * 100) + '%'}"></div>
        <span class="progress-text">{{ Math.round((progress.done / progress.total) * 100) }}%</span>
      </div>

      <!-- 카메라 비디오 -->
      <div class="camera-container" v-show="cameraActive">
        <video 
          ref="cameraVideo" 
          autoplay 
          muted 
          playsinline
          class="camera-video"
        ></video>
        <!-- 실시간 바운딩 박스 오버레이 -->
        <canvas ref="bboxCanvas" class="bbox-overlay" v-if="realtimeDetections.length > 0"></canvas>
        <div class="camera-status" v-if="cameraActive">
          <span class="status-indicator">●</span>
          하이브리드 모드 활성화
        </div>
      </div>

      <!-- 업로드 프리뷰 -->
      <div class="camera-container" v-if="uploadedImageData && !cameraActive" style="margin-top:12px;">
        <img :src="uploadedImageData" alt="uploaded preview" class="camera-video" />
        <!-- 업로드 이미지용 바운딩 박스 -->
        <canvas ref="uploadBboxCanvas" class="bbox-overlay" v-if="uploadDetections.length > 0"></canvas>
      </div>
      
    <!-- 실시간 검출 상태 -->
    <div class="realtime-status" v-if="realtimeActive">
      <div class="status-indicator">
        <div class="pulse-dot"></div>
        <span>레고 부품 실시간 검출 중... ({{ realtimeDetections.length }}개 부품)</span>
      </div>
      <div class="fps-counter">FPS: {{ currentFPS }}</div>
      <div class="system-info">
        <small>해상도: {{ cameraVideo?.videoWidth || 0 }}x{{ cameraVideo?.videoHeight || 0 }}</small>
        <small>레고 특성 필터링 활성화</small>
      </div>
    </div>
    </div>

    <!-- 검출 결과 -->
    <div class="results-panel" v-if="detectionResults" ref="resultsPanelRef">
      <h2>🎯 하이브리드 검출 결과</h2>
      
      <!-- 성능 지표 -->
      <div class="performance-metrics">
        <div class="metric-card local">
          <div class="metric-icon">🏪</div>
          <div class="metric-content">
            <h3>{{ performanceMetrics.localMatches }}</h3>
            <p>로컬 매칭</p>
          </div>
        </div>
        
        <div class="metric-card remote">
          <div class="metric-icon">🌐</div>
          <div class="metric-content">
            <h3>{{ performanceMetrics.remoteMatches }}</h3>
            <p>원격 매칭</p>
          </div>
        </div>
        
        <div class="metric-card speed">
          <div class="metric-icon">⚡</div>
          <div class="metric-content">
            <h3>{{ performanceMetrics.processingTime }}ms</h3>
            <p>처리 시간</p>
          </div>
        </div>
        
        <div class="metric-card traffic">
          <div class="metric-icon">💰</div>
          <div class="metric-content">
            <h3>{{ performanceMetrics.trafficUsed }}MB</h3>
            <p>트래픽 사용량</p>
          </div>
        </div>
      </div>

      <!-- 결과 통계 -->
      <div class="results-stats">
        <div class="stat-card success">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <h3>{{ detectionResults.matches.length }}</h3>
            <p>매칭된 부품</p>
          </div>
        </div>
        
        <div class="stat-card error">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <h3>{{ detectionResults.quantityInfo?.totalMissing || 0 }}</h3>
            <p>누락된 부품</p>
            <small>{{ detectionResults.missingParts.length }}개 부품 유형</small>
          </div>
        </div>
      </div>

      <!-- 하이브리드 + BOM 기반 검출 결과 -->
      <div class="bom-results" v-if="detectionResults.isBOMBased">
        <h3>🎯 폐쇄 환경 하이브리드 검출 결과</h3>
        <div class="bom-summary">
          <div class="bom-stat success">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <h4>{{ detectionResults.quantityInfo?.totalFound || detectionResults.matches.length }}</h4>
              <p>검출된 부품</p>
              <small>{{ detectionResults.quantityInfo?.totalRequired || 0 }}개 중</small>
            </div>
          </div>
          <div class="bom-stat error">
            <div class="stat-icon">❌</div>
            <div class="stat-content">
              <h4>{{ detectionResults.quantityInfo?.totalMissing || 0 }}</h4>
              <p>누락된 부품</p>
              <small>{{ detectionResults.missingParts.length }}개 부품</small>
            </div>
          </div>
          <div class="bom-stat info">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <h4>{{ Math.round(((detectionResults.quantityInfo?.totalFound || 0) / (detectionResults.quantityInfo?.totalRequired || 1)) * 100) }}%</h4>
              <p>수량 검출률</p>
              <small>수량 기준</small>
            </div>
          </div>
        </div>
      </div>

      <!-- 수량별 누락 분석 -->
      <div class="quantity-analysis" v-if="detectionResults.missingParts.length > 0">
        <h3>📊 수량별 누락 분석</h3>
        <div class="missing-parts-list">
          <div 
            v-for="(part, index) in detectionResults.missingParts" 
            :key="index"
            class="missing-part-item"
            :class="part.match_status"
          >
            <div class="part-info">
              <div class="part-name">{{ part.part_name || part.part_id }}</div>
              <div class="part-color">{{ part.color_name }}</div>
            </div>
            <div class="quantity-info">
              <div class="quantity-status">
                <span class="found">{{ part.quantity_found || 0 }}</span>
                <span class="separator">/</span>
                <span class="required">{{ part.quantity_required || part.quantity_missing }}</span>
              </div>
              <div class="status-badge" :class="part.match_status">
                {{ part.match_status === 'complete' ? '완전' : part.match_status === 'partial' ? '부분' : '누락' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 매칭된 부품 목록 (클릭 가능) -->
      <div class="matches-list" v-if="detectionResults.matches.length > 0">
        <h3>✅ 매칭된 부품</h3>
        <div class="match-grid">
          <div 
            v-for="(match, idx) in detectionResults.matches" 
            :key="idx"
            class="match-item"
            @click="onClickMatch(match)"
          >
            <div class="match-icon">✅</div>
            <div class="match-content">
              <div class="match-title">
                <strong>{{ match.part_id }}</strong> — {{ match.part_name }}
              </div>
              <div class="match-details">
                <span class="match-color">{{ match.color_name }}</span>
                <span class="match-score">점수: {{ match.score?.toFixed(3) || 'N/A' }}</span>
                <span class="match-source" :class="match.source">{{ match.source === 'local' ? '🏪 로컬' : '🌐 원격' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 매칭 소스 분석 -->
      <div class="source-analysis" v-if="detectionResults.matches.length > 0">
        <h3>📊 매칭 소스 분석</h3>
        <div class="source-chart">
          <div class="source-bar">
            <div class="source-label">로컬 캐시</div>
            <div class="source-bar-fill" :style="{ width: getLocalPercentage() + '%' }">
              {{ performanceMetrics.localMatches }}개
            </div>
          </div>
          <div class="source-bar">
            <div class="source-label">원격 서버</div>
            <div class="source-bar-fill remote" :style="{ width: getRemotePercentage() + '%' }">
              {{ performanceMetrics.remoteMatches }}개
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 매치 미리보기 모달 -->
    <div class="preview-modal" v-if="selectedMatch" @click="selectedMatch = null">
      <div class="preview-content" @click.stop>
        <div class="preview-header">
          <h3>🔍 부품 미리보기</h3>
          <button @click="selectedMatch = null" class="btn-close">×</button>
        </div>
        <div class="preview-body">
          <div class="preview-info">
            <h4>{{ selectedMatch.part_name }}</h4>
            <p><strong>부품 ID:</strong> {{ selectedMatch.part_id }}</p>
            <p><strong>색상:</strong> {{ selectedMatch.color_name }}</p>
            <p><strong>매칭 점수:</strong> {{ selectedMatch.score?.toFixed(3) || 'N/A' }}</p>
            <p><strong>소스:</strong> {{ selectedMatch.source === 'local' ? '🏪 로컬 캐시' : '🌐 원격 서버' }}</p>
          </div>
          <div class="preview-image">
            <img v-if="matchPreviewImage" :src="matchPreviewImage" alt="부품 이미지" />
            <div v-else class="no-image">
              <p>이미지 없음</p>
              <small>로컬 캐시에 이미지가 없거나 아직 렌더링되지 않았습니다.</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 로딩 상태 -->
    <div class="loading-overlay" v-if="loading">
      <div class="loading-spinner"></div>
      <p>{{ loadingText }}</p>
    </div>

    <!-- 에러 메시지 -->
    <div class="error-message" v-if="error">
      <p>❌ {{ error }}</p>
      <button @click="error = null" class="btn-small">닫기</button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useHybridCache } from '../composables/useHybridCache'
import { useSupabase } from '../composables/useSupabase'

export default {
  name: 'HybridDetection',
  setup() {
    const { 
      loading, 
      error, 
      cacheState,
      checkVersion,
      syncIncremental,
      hybridMatching,
      getCacheStats,
      clearCache,
      autoSync,
      forceSync,
      searchLocalCache,
      compareLocalVectors,
      compareRemoteVectors,
      prefetchVectorsForParts
    } = useHybridCache()

    // 반응형 데이터
    const setNumber = ref('')
    const detectionMode = ref('hybrid-bom') // 하이브리드 + BOM 기반으로 고정
    const cameraActive = ref(false)
    const cameraVideo = ref(null)
    let cameraStream = null
    const uploadedImageData = ref(null)
    const selectedMatch = ref(null)
    const matchPreviewImage = ref(null)

    // 폐쇄 세계 검출 필터
    const filters = ref({
      classWhitelist: true,
      colorWhitelist: true,
      allowAlternates: false
    })

    // BOM 데이터
    const bomParts = ref([])
    const bomColors = ref([])
    const sparePartsCount = ref(0)

    // 상태 데이터
    const setMetadata = ref(null)
    const syncResult = ref(null)
    const detectionResults = ref(null)
    const progress = ref({ done: 0, total: 0 })
    const resultsPanelRef = ref(null)
    const performanceMetrics = ref({
      localMatches: 0,
      remoteMatches: 0,
      processingTime: 0,
      trafficUsed: 0
    })

    const loadingText = ref('처리 중...')

    // 로그 스로틀링/샘플링 유틸
    const lastLogTime = new Map()
    const throttleLog = (key, msg, intervalMs = 1000) => {
      const now = Date.now()
      const prev = lastLogTime.get(key) || 0
      if (now - prev >= intervalMs) {
        lastLogTime.set(key, now)
        console.log(msg)
      }
    }

    // LRU 캐시 헬퍼
    const createLRU = (maxSize) => {
      const map = new Map()
      const get = (k) => {
        if (!map.has(k)) return undefined
        const v = map.get(k)
        map.delete(k)
        map.set(k, v)
        return v
      }
      const set = (k, v) => {
        if (map.has(k)) map.delete(k)
        map.set(k, v)
        if (map.size > maxSize) {
          const oldestKey = map.keys().next().value
          map.delete(oldestKey)
        }
      }
      const clear = () => map.clear()
      const has = (k) => map.has(k)
      return { get, set, clear, has }
    }

    // 제한 병렬 실행 유틸리티
    const runWithConcurrencyLimit = async (items, limit, taskFn) => {
      const results = new Array(items.length)
      let idx = 0
      const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
        while (true) {
          const current = idx++
          if (current >= items.length) break
          results[current] = await taskFn(items[current], current)
        }
      })
      await Promise.all(workers)
      return results
    }

    // 계산된 속성
    const needsUpdate = computed(() => {
      return cacheState.localVersion !== cacheState.remoteVersion
    })

    // 메서드
    const loadSetMetadata = async () => {
      if (!setNumber.value) return
      
      try {
        loading.value = true
        loadingText.value = '메타데이터 로드 중...'
        
        console.log(`📊 세트 메타데이터 로드: ${setNumber.value}`)
        
        // 실제 메타데이터 로드 (Supabase에서)
        const { useMasterPartsMatching } = await import('../composables/useMasterPartsMatching')
        const { loadTargetSetParts } = useMasterPartsMatching()
        
        const result = await loadTargetSetParts(setNumber.value)
        setMetadata.value = {
          setInfo: result.legoSet,
          partsMetadata: result.targetParts.map(part => ({
            part_id: part.part_id,
            color_id: part.color_id,
            quantity: part.quantity,
            part_name: part.lego_parts?.name || 'Unknown',
            color_name: part.lego_colors?.name || 'Unknown'
          }))
        }

        // BOM 데이터 로드 (하이브리드 + BOM 기반)
        await loadBOMData(result.targetParts)

        // BOM 파트 벡터를 사전 로드하여 원격 조회를 최소화
        try {
          loadingText.value = '벡터 사전 로드 중...'
          const pre = await prefetchVectorsForParts(result.targetParts)
          console.log(`📊 벡터 Prefetch: fetched=${pre.fetched}, saved=${pre.saved}`)
        } catch (e) {
          console.warn('벡터 Prefetch 경고:', e.message)
        }
        
        console.log('✅ 메타데이터 로드 완료')
      } catch (err) {
        console.error('❌ 메타데이터 로드 실패:', err)
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    // 폐쇄 세계 BOM 데이터 로드
    const loadBOMData = async (targetParts) => {
      try {
        console.log('📋 BOM 데이터 로드 중...')
        
        // BOM 부품 목록 구성
        bomParts.value = targetParts.map(part => ({
          part_id: part.part_id,
          color_id: part.color_id,
          quantity: part.quantity,
          part_name: part.lego_parts?.name || 'Unknown',
          color_name: part.lego_colors?.name || 'Unknown'
        }))
        
        // 색상 목록 추출
        const colorSet = new Set(targetParts.map(p => p.color_id))
        bomColors.value = Array.from(colorSet).map(colorId => ({
          color_id: colorId,
          name: targetParts.find(p => p.color_id === colorId)?.lego_colors?.name || 'Unknown'
        }))
        
        // 여분 부품 계산 (실제 구현에서는 데이터베이스에서 조회)
        sparePartsCount.value = Math.floor(bomParts.value.length * 0.1) // 10% 여분 부품 가정
        
        console.log(`✅ BOM 데이터 로드 완료: ${bomParts.value.length}개 부품, ${bomColors.value.length}개 색상`)
        
      } catch (err) {
        console.error('❌ BOM 데이터 로드 실패:', err)
      }
    }

    // 폐쇄 환경 필터 적용
    const applyClosedWorldFilters = (partsMetadata) => {
      try {
        console.log('🔍 폐쇄 환경 필터 적용 중...')
        
        // 폐쇄 환경에서는 BOM 부품만 검출 대상
        // partsMetadata는 이미 BOM 부품들이므로 필터링이 필요 없음
        console.log(`📋 폐쇄 환경: BOM 부품 ${partsMetadata.length}개가 검출 대상`)
        
        // BOM 필터 옵션 적용 (향후 확장용)
        if (filters.value.classWhitelist) {
          console.log('📋 BOM 클래스 필터: 활성화')
        }
        
        if (filters.value.colorWhitelist) {
          console.log('🎨 BOM 색상 필터: 활성화')
        }
        
        if (!filters.value.allowAlternates) {
          console.log('🚫 대체 부품 제외: 활성화')
        }
        
        console.log(`✅ 폐쇄 환경 필터 완료: ${partsMetadata.length}개 부품`)
        return partsMetadata
        
      } catch (err) {
        console.error('❌ 폐쇄 환경 필터 실패:', err)
        return partsMetadata // 필터 실패 시 원본 반환
      }
    }

    // 폐쇄 환경 하이브리드 검출 수행 (수량 고려)
    const performBOMBasedHybridDetection = async (detections, bomMetadata) => {
      try {
        console.log('🎯 폐쇄 환경 하이브리드 검출 시작...')
        
        const matches = []
        const missingSlots = []
        const usedDetections = new Set() // 사용된 검출 객체 추적
        const processedParts = new Set() // 처리된 부품 추적
        const vectorCache = createLRU(5000) // LRU 캐시(최대 5k)
        progress.value = { done: 0, total: bomMetadata.reduce((s, p) => s + (p.quantity || 1), 0) }
        
        // 실제 검출된 객체 수 확인
        const availableDetections = detections.length
        console.log(`🔍 사용 가능한 검출 객체: ${availableDetections}개`)
        
        // BOM의 각 부품에 대해 수량만큼 검출된 객체에서 찾기
        for (const bomPart of bomMetadata) {
          const requiredQuantity = bomPart.quantity || 1
          const foundMatches = []
          const partKey = `${bomPart.part_id}/${bomPart.color_id}`
          
          // 중복 로그 방지
          if (!processedParts.has(partKey)) {
            throttleLog(`part-${partKey}`, `🔍 BOM 부품 검색: ${bomPart.part_id} (${bomPart.color_name}) - 필요 수량: ${requiredQuantity}개`, 1500)
            processedParts.add(partKey)
          }
          
          // 현실적인 수량 제한: 사용 가능한 검출 객체 수를 초과하지 않음 (더 엄격하게)
          const maxAttempts = Math.min(requiredQuantity, Math.min(availableDetections, 3)) // 최대 3개만 매칭 시도
          
          // 필요한 수량만큼 반복하여 매칭 시도
          for (let q = 0; q < maxAttempts; q++) {
            let bestMatch = null
            let bestScore = 0
            let bestDetectionIndex = -1
            let bestSource = null

            // 후보 스코어를 제한 병렬(6)로 계산
            const candidates = detections.map((d, i) => ({ d, i })).filter(c => !usedDetections.has(c.i))
            const scored = await runWithConcurrencyLimit(candidates, 6, async (cand) => {
              const i = cand.i
              const detection = cand.d
              const cacheKey = `${partKey}/${i}`
              let hybridScore = 0
              let source = null
              if (vectorCache.has(cacheKey)) {
                const cached = vectorCache.get(cacheKey)
                hybridScore = cached.score
                source = cached.source
              } else {
                const localResult = await searchLocalCache(bomPart.part_id, bomPart.color_id)
                if (localResult.found) {
                  // 실제 로컬 벡터 비교 시도
                  try {
                    hybridScore = await compareLocalVectors(detection, bomPart)
                    source = 'local'
                  } catch (err) {
                    console.warn('로컬 벡터 비교 실패, fallback 0 사용:', err)
                    hybridScore = 0
                    source = 'local'
                  }
                } else {
                  // 실제 원격 벡터 비교 시도
                  try {
                    hybridScore = await compareRemoteVectors(detection, bomPart)
                    source = 'remote'
                  } catch (err) {
                    console.warn('원격 벡터 비교 실패, fallback 0 사용:', err)
                    hybridScore = 0
                    source = 'remote'
                  }
                }
                vectorCache.set(cacheKey, { score: hybridScore, source })
              }
              const bomScore = await calculateBOMMatchScore(detection, bomPart)
              const combinedScore = (hybridScore * 0.6) + (bomScore * 0.4)
              return { i, detection, combinedScore, source, hybridScore, bomScore }
            })

            // 최고 점수 선택(임계값 대폭 완화: 0.01)
            for (const s of scored) {
              if (s && s.combinedScore > bestScore && s.combinedScore > 0.01) {
                bestScore = s.combinedScore
                bestMatch = {
                  ...bomPart,
                  detection: s.detection,
                  score: s.combinedScore,
                  source: s.source,
                  hybridScore: s.hybridScore,
                  bomScore: s.bomScore,
                  instanceNumber: q + 1,
                  totalRequired: requiredQuantity
                }
                bestDetectionIndex = s.i
                bestSource = s.source
              }
            }
            
            // 중복 매칭 방지: 이미 사용된 검출 객체는 제외
            if (bestMatch && usedDetections.has(bestDetectionIndex)) {
              console.log(`⚠️ 중복 매칭 방지: ${bomPart.part_id} - 검출 객체 ${bestDetectionIndex} 이미 사용됨`)
              bestMatch = null
              bestDetectionIndex = -1
            }
            
            // 매칭 실패 시 디버깅 정보 출력
            if (!bestMatch && scored.length > 0) {
              const maxScore = Math.max(...scored.map(s => s.combinedScore))
              console.log(`🔍 매칭 실패 디버깅: ${bomPart.part_id} - 최고점수: ${maxScore.toFixed(4)}, 임계값: 0.01`)
              if (scored.length <= 3) {
                console.log('🔍 상세 점수:', scored.map(s => ({
                  hybridScore: s.hybridScore?.toFixed(4),
                  bomScore: s.bomScore?.toFixed(4),
                  combinedScore: s.combinedScore?.toFixed(4)
                })))
              }
            }
            
            if (bestMatch) {
              foundMatches.push(bestMatch)
              usedDetections.add(bestDetectionIndex) // 사용된 검출 객체 표시
              throttleLog(`match-${partKey}`, `✅ 폐쇄 환경 매칭: ${bomPart.part_id} (${bomPart.color_name}) - ${q + 1}/${requiredQuantity} - 점수: ${bestMatch.score.toFixed(3)} (${bestSource})`, 1000)
            } else {
              // 이 수량에서 매칭 실패
              throttleLog(`miss-${partKey}`, `❌ 매칭 실패: ${bomPart.part_id} (${bomPart.color_name}) - ${q + 1}/${requiredQuantity}`, 1000)
              break // 더 이상 매칭 시도하지 않음
            }
          }
          
          // 매칭 결과 처리
          if (foundMatches.length === requiredQuantity) {
            // 모든 수량 매칭 성공
            matches.push(...foundMatches)
            console.log(`✅ 완전 매칭: ${bomPart.part_id} (${bomPart.color_name}) - ${foundMatches.length}/${requiredQuantity}개`)
          } else if (foundMatches.length > 0) {
            // 부분 매칭 (일부만 찾음)
            matches.push(...foundMatches)
            const missingCount = requiredQuantity - foundMatches.length
            missingSlots.push({
              part_id: bomPart.part_id,
              color_id: bomPart.color_id,
              part_name: bomPart.part_name,
              color_name: bomPart.color_name,
              quantity: missingCount,
              reason: 'partial_match',
              found: foundMatches.length,
              required: requiredQuantity
            })
            console.log(`⚠️ 부분 매칭: ${bomPart.part_id} (${bomPart.color_name}) - ${foundMatches.length}/${requiredQuantity}개 (누락: ${missingCount}개)`)
          } else {
            // 완전 누락
            missingSlots.push({
              part_id: bomPart.part_id,
              color_id: bomPart.color_id,
              part_name: bomPart.part_name,
              color_name: bomPart.color_name,
              quantity: requiredQuantity,
              reason: 'not_detected_in_bom',
              found: 0,
              required: requiredQuantity
            })
            console.log(`❌ 완전 누락: ${bomPart.part_id} (${bomPart.color_name}) - 0/${requiredQuantity}개`)
          }
          
          // 검출 객체 부족으로 인한 제한 표시
          if (maxAttempts < requiredQuantity) {
            console.log(`⚠️ 검출 객체 부족: ${bomPart.part_id} - 최대 ${maxAttempts}개만 매칭 시도 (필요: ${requiredQuantity}개)`)
          }
          // 진행률 업데이트
          progress.value.done += foundMatches.length
        }
        
        console.log(`🎯 폐쇄 환경 하이브리드 검출 완료: ${matches.length}개 매칭, ${missingSlots.length}개 누락`)
        
        // 매칭 결과 상세 분석
        const uniqueDetections = new Set(matches.map(m => m.detection?.id)).size
        const totalRequired = bomMetadata.reduce((sum, p) => sum + (p.quantity || 1), 0)
        console.log(`📊 매칭 분석: 실제 검출 객체 ${uniqueDetections}개, 총 필요 수량 ${totalRequired}개, 매칭된 수량 ${matches.length}개`)
        
        return { matches, missingSlots }
        
      } catch (err) {
        console.error('❌ 폐쇄 환경 하이브리드 검출 실패:', err)
        throw err
      }
    }

    // BOM 기반 검출 수행 (기존 함수 유지)
    const performBOMBasedDetection = async (detections, bomMetadata) => {
      try {
        console.log('🎯 BOM 기반 검출 시작...')
        
        const matches = []
        const missingSlots = []
        
        // BOM에서 각 부품별로 검출 수행
        for (const bomPart of bomMetadata) {
          let bestMatch = null
          let bestScore = 0
          
          // 검출된 객체들 중에서 BOM 부품과 매칭 시도
          for (const detection of detections) {
            // BOM 부품과 검출된 객체의 매칭 점수 계산
            const score = await calculateBOMMatchScore(detection, bomPart)
            
            if (score > bestScore && score > 0.6) {
              bestScore = score
              bestMatch = {
                ...bomPart,
                detection: detection,
                score: score,
                source: 'bom-based'
              }
            }
          }
          
          if (bestMatch) {
            matches.push(bestMatch)
            console.log(`✅ BOM 매칭: ${bomPart.part_id} (${bomPart.color_name}) - 점수: ${bestScore.toFixed(3)}`)
          } else {
            // BOM에 있지만 검출되지 않은 부품 = 누락
            missingSlots.push({
              part_id: bomPart.part_id,
              color_id: bomPart.color_id,
              part_name: bomPart.part_name,
              color_name: bomPart.color_name,
              quantity: bomPart.quantity,
              reason: 'not_detected_in_bom'
            })
            console.log(`❌ BOM 누락: ${bomPart.part_id} (${bomPart.color_name})`)
          }
        }
        
        console.log(`🎯 BOM 기반 검출 완료: ${matches.length}개 매칭, ${missingSlots.length}개 누락`)
        
        return { matches, missingSlots }
        
      } catch (err) {
        console.error('❌ BOM 기반 검출 실패:', err)
        throw err
      }
    }

    // BOM 매칭 점수 계산 (관대한 fallback 포함)
    const calculateBOMMatchScore = async (detection, bomPart) => {
      try {
        let score = 0
        
        // 벡터 유사도: useHybridCache의 비교 로직을 그대로 사용
        const localResult = await searchLocalCache(bomPart.part_id, bomPart.color_id)
        let hybridScore = 0
        if (localResult.found) {
          hybridScore = await compareLocalVectors(detection, bomPart)
        } else {
          hybridScore = await compareRemoteVectors(detection, bomPart)
        }
        
        // 벡터 비교가 실패한 경우 기본 점수 부여
        if (hybridScore === 0) {
          // 검출된 객체가 있으면 기본 점수 부여 (0.3)
          score = 0.3
          console.log(`🔧 BOM 매칭 fallback: ${bomPart.part_id} - 기본점수 0.3 부여`)
        } else {
          score = hybridScore
        }
        
        // 안전 클램프
        if (!Number.isFinite(score)) score = 0.3
        return Math.max(0.1, Math.min(1, score)) // 최소 0.1 보장
        
      } catch (err) {
        console.error('❌ BOM 매칭 점수 계산 실패:', err)
        return 0.3 // 에러 시에도 기본 점수 부여
      }
    }

    // 코사인 유사도 계산
    const calculateCosineSimilarity = (vec1, vec2) => {
      if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0
      
      let dotProduct = 0
      let norm1 = 0
      let norm2 = 0
      
      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i]
        norm1 += vec1[i] * vec1[i]
        norm2 += vec2[i] * vec2[i]
      }
      
      return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
    }

    // 색상 유사도 계산 (Lab 색상 공간)
    const calculateColorSimilarity = (lab1, lab2) => {
      if (!lab1 || !lab2) return 0
      
      const deltaL = lab1.L - lab2.L
      const deltaA = lab1.a - lab2.a
      const deltaB = lab1.b - lab2.b
      
      const deltaE = Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB)
      
      // Delta E < 5는 거의 동일한 색상으로 간주
      return Math.max(0, 1 - (deltaE / 50))
    }

    // 크기 유사도 계산
    const calculateSizeSimilarity = (size1, size2) => {
      if (!size1 || !size2) return 0
      
      const ratio = Math.min(size1, size2) / Math.max(size1, size2)
      return ratio
    }

    // 위치 유사도 계산
    const calculatePositionSimilarity = (bbox1, bbox2) => {
      if (!bbox1 || !bbox2) return 0
      
      const center1 = { x: (bbox1.x1 + bbox1.x2) / 2, y: (bbox1.y1 + bbox1.y2) / 2 }
      const center2 = { x: (bbox2.x1 + bbox2.x2) / 2, y: (bbox2.y1 + bbox2.y2) / 2 }
      
      const distance = Math.sqrt(
        Math.pow(center1.x - center2.x, 2) + Math.pow(center1.y - center2.y, 2)
      )
      
      // 거리가 가까울수록 높은 점수
      return Math.max(0, 1 - (distance / 100))
    }

    const checkVersionAction = async () => {
      try {
        loading.value = true
        loadingText.value = '버전 체크 중...'
        
        const versionInfo = await checkVersion()
        // cacheStats는 computed로 자동 업데이트됨
        
        if (versionInfo.needsUpdate) {
          console.log('📦 업데이트 필요')
        } else {
          console.log('✅ 최신 버전')
        }
      } catch (err) {
        console.error('❌ 버전 체크 실패:', err)
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    const syncIncrementalAction = async () => {
      try {
        loading.value = true
        loadingText.value = '증분 동기화 중...'
        
        const result = await syncIncremental()
        syncResult.value = result
        // cacheStats는 computed로 자동 업데이트됨
        
        console.log('✅ 증분 동기화 완료')
      } catch (err) {
        console.error('❌ 증분 동기화 실패:', err)
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    const autoSyncAction = async () => {
      try {
        loading.value = true
        loadingText.value = '자동 동기화 중...'
        
        const result = await autoSync()
        // cacheStats는 computed로 자동 업데이트됨
        
        console.log('✅ 자동 동기화 완료')
        
        // 결과가 있는 경우에만 로그 출력
        if (result && typeof result === 'object') {
          console.log(`📊 동기화 결과: ${result.success || 0}개 다운로드, ${result.notRendered || 0}개 미렌더링, ${result.errors || 0}개 오류`)
        } else {
          console.log('📊 동기화 결과: 최신 버전 유지 (동기화 불필요)')
        }
      } catch (err) {
        console.error('❌ 자동 동기화 실패:', err)
        error.value = err.message
      } finally {
        loading.value = false
      }
    }
    
    // 강제 캐시 동기화 (문제 해결용)
    const forceSyncAction = async () => {
      try {
        loading.value = true
        loadingText.value = '강제 동기화 중...'
        
        const result = await forceSync()
        console.log('✅ 강제 동기화 완료')
        console.log(`📊 강제 동기화 결과:`, result)
        
        // 캐시 상태 새로고침
        await loadSetMetadata()
        
      } catch (err) {
        console.error('❌ 강제 동기화 실패:', err)
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    const toggleCamera = async () => {
      if (cameraActive.value) {
        await stopCamera()
      } else {
        await startCamera()
      }
    }

    const startCamera = async () => {
      try {
        console.log('📷 카메라 시작 중...')
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: 'environment' }
          } 
        })
        
        cameraStream = stream
        cameraActive.value = true
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const videoElement = cameraVideo.value
        if (videoElement) {
          videoElement.srcObject = stream
          await videoElement.play()
          console.log('✅ 카메라 시작 완료')
        }
      } catch (err) {
        console.error('❌ 카메라 시작 실패:', err)
        error.value = `카메라 접근 실패: ${err.message}`
        cameraActive.value = false
      }
    }

    const stopCamera = async () => {
      try {
        console.log('📷 카메라 중지 중...')
        
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop())
          cameraStream = null
        }
        
        if (cameraVideo.value) {
          cameraVideo.value.srcObject = null
        }
        
        cameraActive.value = false
        console.log('✅ 카메라 중지 완료')
      } catch (err) {
        console.error('❌ 카메라 중지 실패:', err)
      }
    }

    const hybridDetect = async () => {
      if (!cameraVideo.value || !cameraActive.value || !setMetadata.value) {
        console.log('❌ 카메라 또는 메타데이터가 준비되지 않았습니다')
        return
      }
      
      try {
        loading.value = true
        loadingText.value = '하이브리드 검출 중...'
        const startTime = Date.now()
        
        console.log('🔄 하이브리드 검출 시작...')
        console.log('📷 카메라 상태:', {
          cameraActive: cameraActive.value,
          videoElement: !!cameraVideo.value,
          videoWidth: cameraVideo.value?.videoWidth,
          videoHeight: cameraVideo.value?.videoHeight,
          setMetadata: !!setMetadata.value
        })
        
        // 프레임 캡처 (캔버스 재사용)
        if (!window.__hybridCanvas) {
          window.__hybridCanvas = document.createElement('canvas')
          window.__hybridCtx = window.__hybridCanvas.getContext('2d')
        }
        const canvas = window.__hybridCanvas
        const ctx = window.__hybridCtx
        // YOLO 입력 다운스케일(성능 최적화): 960x540 기준, 원본 비율 보존
        const srcW = cameraVideo.value.videoWidth || 1280
        const srcH = cameraVideo.value.videoHeight || 720
        const targetW = 960
        const targetH = Math.round(srcH * (targetW / srcW))
        canvas.width = targetW
        canvas.height = targetH
        ctx.drawImage(cameraVideo.value, 0, 0)
        
        const imageData = canvas.toDataURL('image/webp', 0.8)
        console.log('📸 이미지 캡처 완료:', {
          canvasSize: `${canvas.width}x${canvas.height}`,
          imageDataLength: imageData.length,
          imageDataStart: imageData.substring(0, 50) + '...'
        })
        
        // 실제 YOLO 검출 (실제 구현에서는 YOLO + CLIP 사용)
        const { useOptimizedRealtimeDetection } = await import('../composables/useOptimizedRealtimeDetection')
        const { detectPartsWithYOLO } = useOptimizedRealtimeDetection()
        console.log('🔍 YOLO 검출 시작...')
        let detections = []
        let detectionMethod = 'unknown'
        
        try {
          detections = await detectPartsWithYOLO(imageData)
          detectionMethod = 'YOLO'
          console.log('✅ YOLO 검출 성공:', {
            detectionCount: detections.length,
            detections: detections.map(d => ({
              id: d.id,
              confidence: d.confidence,
              boundingBox: d.boundingBox
            }))
          })
        } catch (yoloError) {
          console.warn('❌ YOLO 검출 실패, 휴리스틱 검출로 전환:', yoloError)
          detectionMethod = '휴리스틱'
          // YOLO 실패 시 휴리스틱 검출 사용
          detections = await detectObjectsSimple(imageData, srcW, srcH)
          console.log('🔍 휴리스틱 검출 결과:', {
            detectionCount: detections.length,
            detections: detections.map(d => ({
              id: d.id,
              x: d.x,
              y: d.y,
              width: d.width,
              height: d.height,
              confidence: d.confidence
            }))
          })
        }
        
        console.log(`📊 검출 방법: ${detectionMethod}, 검출된 객체: ${detections.length}개`)
        
        // YOLO 검출 결과 필터링 (신뢰도가 높은 상위 5개만 사용)
        if (detectionMethod === 'YOLO' && detections.length > 5) {
          const filteredDetections = detections
            .filter(d => d.confidence > 0.8) // 신뢰도 0.8 이상만
            .slice(0, 5) // 최대 5개만
            .map(d => ({
              ...d,
              x: d.boundingBox.x * srcW,
              y: d.boundingBox.y * srcH,
              width: d.boundingBox.width * srcW,
              height: d.boundingBox.height * srcH
            }))
          
          console.log(`🔍 YOLO 필터링: ${detections.length}개 → ${filteredDetections.length}개 (신뢰도 > 0.8)`)
          detections = filteredDetections
        }
        
        // 검출 결과가 없으면 전체 이미지를 하나의 객체로 처리
        if (detections.length === 0) {
          console.log('⚠️ 검출 결과 없음, 전체 이미지를 객체로 처리')
          detections = [{
            id: crypto.randomUUID(),
            boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
            confidence: 0.5,
            image: imageData,
            timestamp: new Date().toISOString()
          }]
        }
        
        // AI 메타데이터를 활용한 검출 결과 향상 (최적화: 상위 5개만 처리)
        console.log('🤖 AI 메타데이터 조회 시작...')
        const topDetections = detections
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5) // 상위 5개만 처리하여 성능 최적화
        
        console.log(`🤖 상위 ${topDetections.length}개 검출에 대해 AI 메타데이터 조회`)
        
        // BOM 부품 목록을 한 번만 가져와서 재사용
        const bomPartIds = bomParts.value?.map(part => part.part_id) || []
        console.log(`🤖 BOM 부품 목록: ${bomPartIds.length}개 부품`)
        
        const enhancedDetections = await Promise.all(topDetections.map(async (detection, index) => {
          try {
            console.log(`🤖 검출 ${index + 1}/${topDetections.length} AI 메타데이터 조회 중...`)
            // AI 메타데이터 조회 (parts_master_features 테이블)
            const aiMetadata = await getAIMetadataForDetection(detection, bomParts.value)
            console.log(`🤖 검출 ${index + 1} AI 메타데이터:`, {
              found: !!aiMetadata,
              part_id: aiMetadata?.part_id,
              confidence: aiMetadata?.confidence,
              hasFeatures: !!aiMetadata?.feature_json
            })
            
            return {
              ...detection,
              // 목업 제거: 메타데이터가 없으면 features는 비워 두고 점수는 0 처리
              features: aiMetadata ? {
                shape_vector: aiMetadata.clip_text_emb || null,
                color_lab: aiMetadata.feature_json?.color || null,
                size_stud: aiMetadata.feature_json?.size || null,
                clip_embedding: aiMetadata.clip_text_emb || null
              } : null,
              ai_metadata: aiMetadata,
              confidence_boost: aiMetadata?.detection_priority || 1.0
            }
          } catch (err) {
            console.warn(`🤖 검출 ${index + 1} AI 메타데이터 조회 실패:`, err.message)
            return {
              ...detection,
              features: null,
              ai_metadata: null,
              confidence_boost: 1.0
            }
          }
        }))
        
        // 나머지 검출들은 기본 처리
        const remainingDetections = detections.slice(10).map(detection => ({
          ...detection,
          features: null,
          ai_metadata: null,
          confidence_boost: 1.0
        }))
        
        const allEnhancedDetections = [...enhancedDetections, ...remainingDetections]
        
        console.log('🤖 AI 메타데이터 처리 완료:', {
          totalCount: allEnhancedDetections.length,
          withFeatures: allEnhancedDetections.filter(d => d.features).length,
          topProcessed: enhancedDetections.length
        })
        
        // 폐쇄 환경 하이브리드 검출
        console.log('🎯 폐쇄 환경 하이브리드 검출 시작...')
        
        // 1. 폐쇄 환경 필터 적용 (BOM 부품만 검출 대상)
        const closedWorldMetadata = applyClosedWorldFilters(setMetadata.value.partsMetadata)
        
        // 2. 폐쇄 환경 하이브리드 매칭 수행
        console.log('🎯 BOM 기반 하이브리드 매칭 시작:', {
          enhancedDetections: allEnhancedDetections.length,
          closedWorldMetadata: closedWorldMetadata.length
        })
        const closedWorldResult = await performBOMBasedHybridDetection(allEnhancedDetections, closedWorldMetadata)
        
        // 3. 폐쇄 환경 결과 사용
        const matches = closedWorldResult.matches
        const missingSlots = closedWorldResult.missingSlots
        
        console.log(`🎯 폐쇄 환경 하이브리드 검출 완료: ${matches.length}개 매칭, ${missingSlots.length}개 누락`)
        console.log('🎯 매칭 상세:', {
          matches: matches.map(m => ({
            part_id: m.part_id,
            color_id: m.color_id,
            score: m.score,
            source: m.source
          })),
          missingSlots: missingSlots.map(s => ({
            part_id: s.part_id,
            color_id: s.color_id
          }))
        })
        
        const processingTime = Date.now() - startTime
        
        // 매칭 소스 분석
        const localMatches = matches.filter(m => m.source === 'local').length
        const remoteMatches = matches.filter(m => m.source === 'remote').length
        
        // 결과 저장 (수량 정보 포함)
        detectionResults.value = {
          matches,
          missingParts: missingSlots.map(slot => ({
            part_id: slot.part_id,
            color_id: slot.color_id,
            part_name: slot.part_name,
            color_name: slot.color_name,
            quantity_missing: slot.quantity || 1,
            quantity_found: slot.found || 0,
            quantity_required: slot.required || slot.quantity || 1,
            confidence: 'high',
            reason: slot.reason || 'not_detected',
            match_status: slot.found > 0 ? (slot.found === slot.required ? 'complete' : 'partial') : 'missing'
          })),
          detectionMode: 'hybrid-bom',
          isBOMBased: true,
          isHybridBased: true,
          quantityInfo: {
            totalRequired: matches.reduce((sum, m) => sum + (m.totalRequired || 1), 0),
            totalFound: matches.length,
            totalMissing: missingSlots.reduce((sum, s) => sum + (s.quantity || 0), 0)
          }
        }
        
        // 성능 지표 업데이트
        performanceMetrics.value = {
          localMatches,
          remoteMatches,
          processingTime,
          trafficUsed: remoteMatches * 0.1 // 원격 매칭당 0.1MB
        }
        
        console.log('✅ 하이브리드 검출 완료')
        console.log(`🏪 로컬 매칭: ${localMatches}개`)
        console.log(`🌐 원격 매칭: ${remoteMatches}개`)
        console.log(`⚡ 처리 시간: ${processingTime}ms`)
        // 결과 패널로 자동 스크롤
        requestAnimationFrame(() => {
          const el = resultsPanelRef.value
          if (el && typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        })
        
      } catch (err) {
        console.error('❌ 하이브리드 검출 실패:', err)
        error.value = `검출 실패: ${err.message}`
      } finally {
        loading.value = false
      }
    }

    // 업로드 이미지 핸들러
    const onUploadImage = async (e) => {
      try {
        const file = e.target.files && e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        uploadedImageData.value = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        console.log('📤 업로드 이미지 로드 완료')
      } catch (err) {
        console.warn('업로드 이미지 로드 실패:', err)
        error.value = `업로드 실패: ${err.message}`
      }
    }

    // 업로드 이미지 기반 검출
    const hybridDetectFromUpload = async () => {
      if (!uploadedImageData.value || !setMetadata.value) {
        console.log('❌ 업로드 이미지 또는 메타데이터가 준비되지 않았습니다')
        return
      }
      try {
        loading.value = true
        loadingText.value = '업로드 이미지 검출 중...'
        const startTime = Date.now()

        // 업로드 이미지를 다운스케일하여 YOLO에 입력
        if (!window.__hybridCanvas) {
          window.__hybridCanvas = document.createElement('canvas')
          window.__hybridCtx = window.__hybridCanvas.getContext('2d')
        }
        const canvas = window.__hybridCanvas
        const ctx = window.__hybridCtx

        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = uploadedImageData.value
        })

        const srcW = img.width || 1280
        const srcH = img.height || 720
        const targetW = 960
        const targetH = Math.round(srcH * (targetW / srcW))
        canvas.width = targetW
        canvas.height = targetH
        ctx.drawImage(img, 0, 0, targetW, targetH)
        const imageData = canvas.toDataURL('image/webp', 0.8)

        const { useOptimizedRealtimeDetection } = await import('../composables/useOptimizedRealtimeDetection')
        const { detectPartsWithYOLO } = useOptimizedRealtimeDetection()
        const detections = await detectPartsWithYOLO(imageData)

        const enhancedDetections = await Promise.all(detections.map(async (detection) => {
          const aiMetadata = await getAIMetadataForDetection(detection, bomParts.value)
          return {
            ...detection,
            features: aiMetadata ? {
              shape_vector: aiMetadata.clip_text_emb || null,
              color_lab: aiMetadata.feature_json?.color || null,
              size_stud: aiMetadata.feature_json?.size || null
            } : null,
            ai_metadata: aiMetadata
          }
        }))

        const closedWorldMetadata = applyClosedWorldFilters(setMetadata.value.partsMetadata)
        const closedWorldResult = await performBOMBasedHybridDetection(enhancedDetections, closedWorldMetadata)

        const matches = closedWorldResult.matches
        const missingSlots = closedWorldResult.missingSlots
        const processingTime = Date.now() - startTime
        const localMatches = matches.filter(m => m.source === 'local').length
        const remoteMatches = matches.filter(m => m.source === 'remote').length

        detectionResults.value = {
          matches,
          missingParts: missingSlots.map(slot => ({
            part_id: slot.part_id,
            color_id: slot.color_id,
            part_name: slot.part_name,
            color_name: slot.color_name,
            quantity_missing: slot.quantity || 1,
            quantity_found: slot.found || 0,
            quantity_required: slot.required || slot.quantity || 1,
            confidence: 'high',
            reason: slot.reason || 'not_detected',
            match_status: slot.found > 0 ? (slot.found === slot.required ? 'complete' : 'partial') : 'missing'
          })),
          detectionMode: 'hybrid-bom',
          isBOMBased: true,
          isHybridBased: true,
          quantityInfo: {
            totalRequired: matches.reduce((sum, m) => sum + (m.totalRequired || 1), 0),
            totalFound: matches.length,
            totalMissing: missingSlots.reduce((sum, s) => sum + (s.quantity || 0), 0)
          }
        }

        performanceMetrics.value = {
          localMatches,
          remoteMatches,
          processingTime,
          trafficUsed: remoteMatches * 0.1
        }
        console.log('✅ 업로드 이미지 하이브리드 검출 완료')
      } catch (err) {
        console.error('❌ 업로드 검출 실패:', err)
        error.value = `업로드 검출 실패: ${err.message}`
      } finally {
        loading.value = false
      }
    }

    const getSyncStatusClass = () => {
      switch (cacheState.syncStatus) {
        case 'ready': return 'status-ready'
        case 'downloading': return 'status-downloading'
        case 'checking': return 'status-checking'
        default: return 'status-idle'
      }
    }

    const getSyncStatusText = () => {
      switch (cacheState.syncStatus) {
        case 'ready': return '준비됨'
        case 'downloading': return '다운로드 중'
        case 'checking': return '확인 중'
        default: return '대기 중'
      }
    }

    const getLocalPercentage = () => {
      const total = performanceMetrics.value.localMatches + performanceMetrics.value.remoteMatches
      return total > 0 ? Math.round((performanceMetrics.value.localMatches / total) * 100) : 0
    }

    const getRemotePercentage = () => {
      const total = performanceMetrics.value.localMatches + performanceMetrics.value.remoteMatches
      return total > 0 ? Math.round((performanceMetrics.value.remoteMatches / total) * 100) : 0
    }

    const formatDate = (date) => {
      if (!date) return '없음'
      return new Date(date).toLocaleString()
    }

    // 매치 클릭 핸들러 (미리보기)
    const onClickMatch = async (match) => {
      try {
        selectedMatch.value = match
        console.log('🔍 매치 미리보기:', match.part_id, match.color_id)
        
        // 로컬 캐시에서 이미지 조회
        const localResult = await searchLocalCache(match.part_id, match.color_id)
        if (localResult.found && localResult.image) {
          // 로컬 이미지 사용
          const url = URL.createObjectURL(localResult.image)
          matchPreviewImage.value = url
          console.log('🏪 로컬 캐시 이미지 사용')
        } else {
          // 원격 이미지 다운로드 (실제 구현에서는 Supabase Storage에서)
          console.log('🌐 원격 이미지 다운로드 필요')
          matchPreviewImage.value = null
        }
      } catch (err) {
        console.warn('매치 미리보기 실패:', err)
      }
    }

    // BOM 부품 상태 확인
    const getBOMPartStatus = (part) => {
      if (!detectionResults.value) return 'unknown'
      
      const foundMatches = detectionResults.value.matches.filter(m => 
        m.part_id === part.part_id && m.color_id === part.color_id
      )
      
      if (foundMatches.length === 0) return 'missing'
      if (foundMatches.length >= part.quantity) return 'complete'
      return 'partial'
    }

    // BOM 부품 아이콘
    const getBOMPartIcon = (part) => {
      const status = getBOMPartStatus(part)
      switch (status) {
        case 'complete': return '✅'
        case 'partial': return '⚠️'
        case 'missing': return '❌'
        default: return '❓'
      }
    }

    // cacheStats computed 속성 생성
    const cacheStats = computed(() => getCacheStats())

    const getRemoteVersionDisplay = computed(() => {
      if (!cacheStats.value.remoteVersion) return '확인 중...'
      
      // 객체인 경우 버전 정보만 추출
      if (typeof cacheStats.value.remoteVersion === 'object') {
        return cacheStats.value.remoteVersion.version || 'v1.0.0'
      }
      
      // 문자열인 경우 그대로 반환
      return cacheStats.value.remoteVersion
    })

    // 실시간 검출 관련 상태
    const realtimeActive = ref(false)
    const realtimeDetections = ref([])
    const uploadDetections = ref([])
    const currentFPS = ref(0)
    const bboxCanvas = ref(null)
    const uploadBboxCanvas = ref(null)
    let realtimeInterval = null
    let fpsCounter = 0
    let lastFpsTime = Date.now()

    // 실시간 검출 시작
    const startRealtimeDetection = async () => {
      if (!cameraVideo.value || !setMetadata.value) {
        console.log('❌ 카메라 또는 메타데이터가 준비되지 않았습니다')
        return
      }
      
      // 카메라 비디오가 준비되었는지 확인
      if (cameraVideo.value.videoWidth === 0 || cameraVideo.value.videoHeight === 0) {
        console.log('❌ 카메라 비디오가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.')
        return
      }
      
      realtimeActive.value = true
      realtimeDetections.value = []
      
      console.log('🎯 실시간 검출 시작')
      console.log(`📹 비디오 크기: ${cameraVideo.value.videoWidth}x${cameraVideo.value.videoHeight}`)
      console.log(`📊 메타데이터: ${setMetadata.value ? '준비됨' : '없음'}`)
      console.log(`🎨 바운딩 박스 캔버스: ${bboxCanvas.value ? '준비됨' : '없음'}`)
      
      // 실시간 검출 루프 (10fps로 낮춤 - 안정성 향상)
      realtimeInterval = setInterval(async () => {
        if (!realtimeActive.value || !cameraVideo.value) return
        
        try {
          // 프레임 캡처
          if (!window.__realtimeCanvas) {
            window.__realtimeCanvas = document.createElement('canvas')
            window.__realtimeCtx = window.__realtimeCanvas.getContext('2d')
          }
          const canvas = window.__realtimeCanvas
          const ctx = window.__realtimeCtx
          
          const srcW = cameraVideo.value.videoWidth || 1280
          const srcH = cameraVideo.value.videoHeight || 720
          const targetW = 320  // 더 작은 해상도로 성능 향상
          const targetH = Math.round(srcH * (targetW / srcW))
          
          canvas.width = targetW
          canvas.height = targetH
          ctx.drawImage(cameraVideo.value, 0, 0, targetW, targetH)
          
          const imageData = canvas.toDataURL('image/webp', 0.8)
          
          // 간단한 객체 검출 (YOLO 대신 휴리스틱 방식)
          const detections = await detectObjectsSimple(imageData, srcW, srcH)
          
          console.log(`🔍 실시간 검출된 객체: ${detections.length}개`)
          if (detections.length > 0) {
            console.log('✅ 레고 부품 검출 성공!')
            console.log('🔍 실시간 검출 결과:', detections.map(d => ({
              id: d.id,
              x: d.x,
              y: d.y,
              width: d.width,
              height: d.height,
              confidence: d.confidence,
              legoScore: d.legoCharacteristics?.legoScore || 'N/A'
            })))
          } else {
            console.log('❌ 실시간 검출 결과 없음 - 레고 부품이 감지되지 않았습니다')
            console.log('💡 해결 방법:')
            console.log('   1. 레고 부품을 카메라에 더 가까이 가져가세요')
            console.log('   2. 조명을 더 밝게 해주세요')
            console.log('   3. 레고 부품이 화면 중앙에 오도록 조정하세요')
          }
          
          // 렌더링된 JSON 파일의 polygon_uv 활용
          let enhancedDetections = detections
          
          try {
            // AI 메타데이터와 매칭하여 실제 렌더링된 polygon_uv 사용
            enhancedDetections = await enhanceDetectionWithRenderedPolygonUV(detections)
            console.log(`🎨 렌더링 JSON 활용: ${enhancedDetections.length}개`)
          } catch (err) {
            console.warn('렌더링 JSON 활용 실패, 기본 윤곽선 사용:', err)
            
            // 폴백: 기본 사각형 윤곽선 생성
            enhancedDetections = detections.map(detection => {
              const centerX = detection.x + detection.width / 2
              const centerY = detection.y + detection.height / 2
              const halfW = detection.width / 2
              const halfH = detection.height / 2
              
              const polygon_uv = [
                [centerX - halfW, centerY - halfH],
                [centerX + halfW, centerY - halfH],
                [centerX + halfW, centerY + halfH],
                [centerX - halfW, centerY + halfH]
              ]
              
              return { ...detection, polygon_uv: polygon_uv }
            })
          }
          
          realtimeDetections.value = enhancedDetections
          
          // 바운딩 박스 그리기
          drawBoundingBoxes()
          
          // FPS 계산
          fpsCounter++
          const now = Date.now()
          if (now - lastFpsTime >= 1000) {
            currentFPS.value = fpsCounter
            fpsCounter = 0
            lastFpsTime = now
          }
          
        } catch (err) {
          console.warn('실시간 검출 오류:', err)
          // 에러가 발생해도 실시간 검출을 계속 진행
        }
      }, 100) // 10fps로 낮춤
    }

    // 간단한 객체 검출 (YOLO 대신 사용)
    const detectObjectsSimple = async (imageData, srcW, srcH) => {
      console.log('🔍 휴리스틱 검출 시작...')
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          console.log('📸 이미지 로드 완료:', {
            width: img.width,
            height: img.height,
            srcW: srcW,
            srcH: srcH
          })
          
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          console.log('🔍 이미지 데이터 추출:', {
            width: imageData.width,
            height: imageData.height,
            dataLength: imageData.data.length
          })
          
          const objects = detectObjectsInImage(imageData, srcW, srcH)
          console.log('🔍 휴리스틱 검출 완료:', {
            objectCount: objects.length,
            objects: objects.map(obj => ({
              id: obj.id,
              x: obj.x,
              y: obj.y,
              width: obj.width,
              height: obj.height,
              confidence: obj.confidence
            }))
          })
          resolve(objects)
        }
        img.onerror = (error) => {
          console.warn('❌ 이미지 로드 실패, 더미 객체 생성:', error)
          // 이미지 로드 실패 시 더미 객체 생성
          resolve([{
            x: srcW * 0.1,
            y: srcH * 0.1,
            width: srcW * 0.3,
            height: srcH * 0.3,
            confidence: 0.7,
            id: 'detection-1'
          }])
        }
        img.src = imageData
      })
    }

    // 이미지에서 객체 검출 (polygon_uv 윤곽선 생성)
    const detectObjectsInImage = (imageData, srcW, srcH) => {
      const data = imageData.data
      const width = imageData.width
      const height = imageData.height
      
      // 스케일 팩터 계산
      const scaleX = srcW / width
      const scaleY = srcH / height
      
      console.log(`🔍 이미지 분석: ${width}x${height}, 원본: ${srcW}x${srcH}, 스케일: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`)
      
      // 멀티스케일 적응형 윈도우
      const SCALES = [48, 72, 96] // 3단계 윈도우 크기
      const objects = []
      let totalWindows = 0
      let validWindows = 0
      let legoWindows = 0
      
      console.log(`🔍 멀티스케일 검출 시작: ${SCALES.length}개 스케일 (${SCALES.join(', ')}px)`)
      
      // 히스테리시스 필터링을 위한 이전 프레임 데이터
      if (!window.detectionHistory) {
        window.detectionHistory = new Map()
      }
      
      for (const windowSize of SCALES) {
        const stride = Math.floor(windowSize / 3) // 윈도우의 1/3 간격
        let scaleWindows = 0
        let scaleValid = 0
        let scaleLego = 0
        
        console.log(`🔍 스케일 ${windowSize}px 검출 시작 (stride: ${stride}px)`)
        
        for (let y = 0; y <= height - windowSize; y += stride) {
          for (let x = 0; x <= width - windowSize; x += stride) {
            totalWindows++
            scaleWindows++
            
            const variance = calculateColorVariance(data, x, y, windowSize, windowSize, width)
            
            // 적응형 임계값 (μ + 0.5σ) - 더 엄격한 필터링
            const adaptiveThreshold = calculateAdaptiveThreshold(variance, windowSize)
            
            if (variance > adaptiveThreshold) {
              validWindows++
              scaleValid++
              
              // 레고 부품 특성 검증
              const legoCharacteristics = analyzeLegoCharacteristics(data, x, y, windowSize, windowSize, width, height)
              
              if (legoCharacteristics.isLegoPart) {
                legoWindows++
                scaleLego++
                
                const key = `${x}-${y}-${windowSize}`
                const history = window.detectionHistory.get(key) || { count: 0, lastSeen: 0 }
                
                // 히스테리시스: 1프레임만 통과해도 검출 (즉시 검출)
                history.count++
                history.lastSeen = Date.now()
                
                if (history.count >= 1) {
                  console.log(`🎯 레고 부품 발견: (${x}, ${y}) ${windowSize}x${windowSize}, 분산: ${variance.toFixed(1)}, 특성: ${legoCharacteristics.reason}`)
                  
                  // polygon_uv 윤곽선 생성
                  const polygon_uv = generatePolygonUV(data, x, y, windowSize, windowSize, width, height, srcW, srcH)
                  
                  // 업스케일된 좌표로 변환
                  const upscaledX = x * scaleX
                  const upscaledY = y * scaleY
                  const upscaledW = windowSize * scaleX
                  const upscaledH = windowSize * scaleY
                  
                  objects.push({
                    x: upscaledX,
                    y: upscaledY,
                    width: upscaledW,
                    height: upscaledH,
                    confidence: Math.min(0.9, variance / 1000) * legoCharacteristics.confidenceBoost,
                    id: `lego-${x}-${y}-${windowSize}`,
                    polygon_uv: polygon_uv,
                    windowSize: windowSize,
                    variance: variance,
                    legoCharacteristics: legoCharacteristics
                  })
                }
                
                window.detectionHistory.set(key, history)
              } else {
                console.log(`❌ 레고 부품 아님: (${x}, ${y}) ${windowSize}x${windowSize}, 이유: ${legoCharacteristics.reason}`)
              }
            }
          }
        }
        
        console.log(`📊 스케일 ${windowSize}px 결과: ${scaleWindows}개 윈도우, ${scaleValid}개 유효, ${scaleLego}개 레고`)
      }
      
      // 오래된 히스토리 정리 (5초 이상)
      const now = Date.now()
      for (const [key, history] of window.detectionHistory.entries()) {
        if (now - history.lastSeen > 5000) {
          window.detectionHistory.delete(key)
        }
      }
      
      console.log(`🔍 발견된 객체: ${objects.length}개`)
      console.log(`📊 검출 통계: 총 ${totalWindows}개 윈도우, ${validWindows}개 유효, ${legoWindows}개 레고 부품`)
      
      // IoU 기반 중복 제거
      const mergedObjects = mergeOverlappingObjects(objects)
      console.log(`🔗 중복 제거: ${objects.length}개 → ${mergedObjects.length}개`)
      console.log(`🔍 중복 제거 후: ${mergedObjects.length}개`)
      
      // 객체가 없으면 전체 이미지를 하나의 객체로 처리
      if (mergedObjects.length === 0) {
        console.log('🔍 객체 없음, 폴백 객체 생성')
        const fallbackPolygon = generateFallbackPolygon(srcW, srcH)
        mergedObjects.push({
          x: srcW * 0.1,
          y: srcH * 0.1,
          width: srcW * 0.8,
          height: srcH * 0.8,
          confidence: 0.6,
          id: 'fallback-1',
          polygon_uv: fallbackPolygon
        })
      }
      
      // 최종 8-12개로 조정 (기존 5개에서 증가)
      return mergedObjects.slice(0, 12)
    }

    // polygon_uv 윤곽선 생성 (실제 부품 윤곽선)
    const generatePolygonUV = (data, startX, startY, width, height, imageWidth, imageHeight, srcW, srcH) => {
      console.log(`🎨 윤곽선 생성: (${startX}, ${startY}) ${width}x${height}`)
      
      const points = []
      const step = 2 // 2px 간격으로 더 세밀하게 윤곽선 추출
      
      // 윤곽선 추출: 엣지 감지 기반
      for (let y = startY; y < startX + height; y += step) {
        for (let x = startX; x < startX + width; x += step) {
          if (isEdgePoint(data, x, y, imageWidth, imageHeight)) {
            const u = x / imageWidth
            const v = y / imageHeight
            points.push([u, v])
          }
        }
      }
      
      console.log(`🎨 엣지 포인트: ${points.length}개`)
      
      // Convex Hull 계산으로 윤곽선 단순화
      let hull = points
      if (points.length >= 3) {
        hull = calculateConvexHull(points)
        console.log(`🎨 Convex Hull: ${hull.length}개 점`)
        
        // RDP 알고리즘으로 다각형 간소화 개선
        const diagonal = Math.hypot(width, height)
        const epsilon = Math.max(1.0, diagonal * 0.015) // bbox 대각선의 1.5%
        
        hull = ramerDouglasPeucker(hull, epsilon)
        console.log(`🎨 RDP 간소화: ${hull.length}개 점 (epsilon: ${epsilon.toFixed(2)})`)
        
        // 최소 꼭짓점 수 보장
        const minVerts = Math.max(6, Math.ceil(diagonal * 0.008))
        if (hull.length < minVerts) {
          const relaxedEpsilon = diagonal * 0.008
          hull = ramerDouglasPeucker(points, relaxedEpsilon)
          console.log(`🎨 완화된 RDP: ${hull.length}개 점 (epsilon: ${relaxedEpsilon.toFixed(2)})`)
        }
      } else {
        // 포인트가 부족하면 사각형 윤곽선 생성
        const centerX = (startX + width / 2) / imageWidth
        const centerY = (startY + height / 2) / imageHeight
        const halfW = (width / 2) / imageWidth
        const halfH = (height / 2) / imageHeight
        
        hull = [
          [centerX - halfW, centerY - halfH],
          [centerX + halfW, centerY - halfH],
          [centerX + halfW, centerY + halfH],
          [centerX - halfW, centerY + halfH]
        ]
        console.log(`🎨 사각형 윤곽선 생성: ${hull.length}개 점`)
      }
      
      // 최대 24개 점으로 제한 (기존 20에서 증가)
      if (hull.length > 24) {
        const step = Math.ceil(hull.length / 24)
        hull = hull.filter((_, index) => index % step === 0)
      }
      
      console.log(`🎨 최종 윤곽선: ${hull.length}개 점`)
      return hull
    }

    // 엣지 포인트 감지 (개선된 버전)
    const isEdgePoint = (data, x, y, imageWidth, imageHeight) => {
      if (x < 1 || x >= imageWidth - 1 || y < 1 || y >= imageHeight - 1) return false
      
      const idx = (y * imageWidth + x) * 4
      const current = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      
      // Sobel + Laplacian 혼합 엣지 감지
      const sobelX = calculateSobelX(data, x, y, imageWidth, imageHeight)
      const sobelY = calculateSobelY(data, x, y, imageWidth, imageHeight)
      const sobelMagnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY)
      
      const laplacian = calculateLaplacian(data, x, y, imageWidth, imageHeight)
      
      // 혼합 엣지 강도
      const edgeStrength = sobelMagnitude * 0.7 + Math.abs(laplacian) * 0.3
      
      // 적응형 임계값 (윈도우 크기 비례)
      const adaptiveThreshold = Math.max(8, imageWidth * 0.02) // 이미지 너비의 2%
      
      return edgeStrength > adaptiveThreshold
    }

    // Sobel X 방향 계산
    const calculateSobelX = (data, x, y, imageWidth, imageHeight) => {
      if (x < 1 || x >= imageWidth - 1 || y < 1 || y >= imageHeight - 1) return 0
      
      const getGray = (px, py) => {
        const idx = (py * imageWidth + px) * 4
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      }
      
      const gx = 
        -1 * getGray(x-1, y-1) + 1 * getGray(x+1, y-1) +
        -2 * getGray(x-1, y)   + 2 * getGray(x+1, y) +
        -1 * getGray(x-1, y+1) + 1 * getGray(x+1, y+1)
      
      return gx
    }

    // Sobel Y 방향 계산
    const calculateSobelY = (data, x, y, imageWidth, imageHeight) => {
      if (x < 1 || x >= imageWidth - 1 || y < 1 || y >= imageHeight - 1) return 0
      
      const getGray = (px, py) => {
        const idx = (py * imageWidth + px) * 4
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      }
      
      const gy = 
        -1 * getGray(x-1, y-1) - 2 * getGray(x, y-1) - 1 * getGray(x+1, y-1) +
         1 * getGray(x-1, y+1) + 2 * getGray(x, y+1) + 1 * getGray(x+1, y+1)
      
      return gy
    }

    // Laplacian 계산
    const calculateLaplacian = (data, x, y, imageWidth, imageHeight) => {
      if (x < 1 || x >= imageWidth - 1 || y < 1 || y >= imageHeight - 1) return 0
      
      const getGray = (px, py) => {
        const idx = (py * imageWidth + px) * 4
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      }
      
      const center = getGray(x, y)
      const laplacian = 
        getGray(x-1, y) + getGray(x+1, y) + 
        getGray(x, y-1) + getGray(x, y+1) - 4 * center
      
      return laplacian
    }

    // Ramer-Douglas-Peucker 알고리즘
    const ramerDouglasPeucker = (points, epsilon) => {
      if (points.length <= 2) return points
      
      let maxDistance = 0
      let maxIndex = 0
      const end = points.length - 1
      
      for (let i = 1; i < end; i++) {
        const distance = perpendicularDistance(points[i], points[0], points[end])
        if (distance > maxDistance) {
          maxDistance = distance
          maxIndex = i
        }
      }
      
      if (maxDistance > epsilon) {
        const left = ramerDouglasPeucker(points.slice(0, maxIndex + 1), epsilon)
        const right = ramerDouglasPeucker(points.slice(maxIndex), epsilon)
        return left.slice(0, -1).concat(right)
      } else {
        return [points[0], points[end]]
      }
    }

    // 점과 선분 사이의 수직 거리
    const perpendicularDistance = (point, lineStart, lineEnd) => {
      const [px, py] = point
      const [x1, y1] = lineStart
      const [x2, y2] = lineEnd
      
      const A = px - x1
      const B = py - y1
      const C = x2 - x1
      const D = y2 - y1
      
      const dot = A * C + B * D
      const lenSq = C * C + D * D
      
      if (lenSq === 0) return Math.sqrt(A * A + B * B)
      
      const param = dot / lenSq
      
      let xx, yy
      if (param < 0) {
        xx = x1
        yy = y1
      } else if (param > 1) {
        xx = x2
        yy = y2
      } else {
        xx = x1 + param * C
        yy = y1 + param * D
      }
      
      const dx = px - xx
      const dy = py - yy
      return Math.sqrt(dx * dx + dy * dy)
    }

    // Convex Hull 계산 (Graham Scan)
    const calculateConvexHull = (points) => {
      if (points.length < 3) return points
      
      // 기준점 찾기 (y가 가장 작은 점)
      let pivot = points[0]
      for (const point of points) {
        if (point[1] < pivot[1] || (point[1] === pivot[1] && point[0] < pivot[0])) {
          pivot = point
        }
      }
      
      // 각도 기준으로 정렬
      const sortedPoints = points
        .filter(p => p !== pivot)
        .sort((a, b) => {
          const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0])
          const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0])
          return angleA - angleB
        })
      
      const hull = [pivot]
      
      for (const point of sortedPoints) {
        while (hull.length > 1 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
          hull.pop()
        }
        hull.push(point)
      }
      
      return hull
    }

    // 외적 계산
    const crossProduct = (O, A, B) => {
      return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0])
    }

    // 폴백 폴리곤 생성 (사각형)
    const generateFallbackPolygon = (srcW, srcH) => {
      return [
        [0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]
      ]
    }

    // 색상 분산 계산
    const calculateColorVariance = (data, startX, startY, width, height, imageWidth) => {
      let sum = 0
      let count = 0
      const values = []
      
      for (let y = startY; y < startY + height && y < data.length / (imageWidth * 4); y++) {
        for (let x = startX; x < startX + width && x < imageWidth; x++) {
          const idx = (y * imageWidth + x) * 4
          if (idx + 2 < data.length) {
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
            values.push(gray)
            sum += gray
            count++
          }
        }
      }
      
      if (count === 0) return 0
      
      const mean = sum / count
      let variance = 0
      values.forEach(val => {
        variance += Math.pow(val - mean, 2)
      })
      
      return variance / count
    }

    // 적응형 임계값 계산 (μ + 0.3σ)
    const calculateAdaptiveThreshold = (variance, windowSize) => {
      // 윈도우 크기에 비례한 기본 임계값 (더 엄격하게)
      const baseThreshold = windowSize * windowSize * 0.3 // 윈도우 면적의 30%
      
      // 히스토리 기반 적응형 조정
      if (!window.varianceHistory) {
        window.varianceHistory = []
      }
      
      window.varianceHistory.push(variance)
      if (window.varianceHistory.length > 100) {
        window.varianceHistory.shift() // 최대 100개 유지
      }
      
      if (window.varianceHistory.length < 10) {
        return baseThreshold
      }
      
      // 평균과 표준편차 계산
      const mean = window.varianceHistory.reduce((sum, val) => sum + val, 0) / window.varianceHistory.length
      const varianceSum = window.varianceHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0)
      const stdDev = Math.sqrt(varianceSum / window.varianceHistory.length)
      
      // μ + 0.5σ 임계값 (엄격한 필터링)
      const adaptiveThreshold = mean + 0.5 * stdDev
      
      return Math.max(baseThreshold, adaptiveThreshold)
    }

    // IoU 기반 중복 제거
    const mergeOverlappingObjects = (objects) => {
      if (objects.length === 0) return objects
      
      // confidence 기준으로 정렬
      const sorted = objects.sort((a, b) => b.confidence - a.confidence)
      const merged = []
      const used = new Set()
      
      for (let i = 0; i < sorted.length; i++) {
        if (used.has(i)) continue
        
        const current = sorted[i]
        const mergedObj = { ...current }
        const mergedFrom = [current.id]
        
        // IoU > 0.5인 객체들 병합
        for (let j = i + 1; j < sorted.length; j++) {
          if (used.has(j)) continue
          
          const other = sorted[j]
          const iou = calculateIoU(current, other)
          
          if (iou > 0.5) {
            // 더 큰 바운딩 박스로 병합
            mergedObj.x = Math.min(mergedObj.x, other.x)
            mergedObj.y = Math.min(mergedObj.y, other.y)
            mergedObj.width = Math.max(mergedObj.x + mergedObj.width, other.x + other.width) - mergedObj.x
            mergedObj.height = Math.max(mergedObj.y + mergedObj.height, other.y + other.height) - mergedObj.y
            
            // confidence는 평균
            mergedObj.confidence = (mergedObj.confidence + other.confidence) / 2
            mergedFrom.push(other.id)
            used.add(j)
          }
        }
        
        merged.push(mergedObj)
        used.add(i)
        
        if (mergedFrom.length > 1) {
          console.log(`🔗 병합: ${mergedFrom.join(', ')} → IoU 기반`)
        }
      }
      
      return merged
    }

    // IoU 계산
    const calculateIoU = (box1, box2) => {
      const x1 = Math.max(box1.x, box2.x)
      const y1 = Math.max(box1.y, box2.y)
      const x2 = Math.min(box1.x + box1.width, box2.x + box2.width)
      const y2 = Math.min(box1.y + box1.height, box2.y + box2.height)
      
      if (x2 <= x1 || y2 <= y1) return 0
      
      const intersection = (x2 - x1) * (y2 - y1)
      const area1 = box1.width * box1.height
      const area2 = box2.width * box2.height
      const union = area1 + area2 - intersection
      
      return intersection / union
    }

    // 레고 부품 특성 분석
    const analyzeLegoCharacteristics = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      const characteristics = {
        isLegoPart: false,
        reason: '',
        confidenceBoost: 1.0,
        colorCount: 0,
        edgeDensity: 0,
        aspectRatio: 0,
        compactness: 0
      }
      
      // 1. 크기 필터링 (레고 부품에 적합한 크기 범위)
      const area = width * height
      const minArea = 30 * 30 // 최소 30x30 픽셀 (너무 작은 노이즈 제거)
      const maxArea = 150 * 150 // 최대 150x150 픽셀 (너무 큰 배경 제거)
      
      if (area < minArea) {
        characteristics.reason = '너무 작음'
        return characteristics
      }
      
      if (area > maxArea) {
        characteristics.reason = '너무 큼'
        return characteristics
      }
      
      // 2. 종횡비 검사 (레고 부품은 보통 정사각형에 가까움)
      const aspectRatio = Math.max(width, height) / Math.min(width, height)
      characteristics.aspectRatio = aspectRatio
      
      if (aspectRatio > 2.5) { // 더 엄격한 종횡비 제한
        characteristics.reason = '종횡비 과다'
        return characteristics
      }
      
      // 2.5. 투명/흰색 부품 특별 처리
      const transparencyCheck = checkTransparencyOrWhite(data, startX, startY, width, height, imageWidth, imageHeight)
      if (transparencyCheck.isTransparent || transparencyCheck.isWhiteOnWhite) {
        // 투명/흰색 부품은 더 엄격한 조건 적용
        if (aspectRatio > 2.0) {
          characteristics.reason = '투명/흰색 부품 종횡비 과다'
          return characteristics
        }
      }
      
      // 3. 색상 다양성 검사 (레고 부품은 보통 1-5가지 색상)
      const colorAnalysis = analyzeColorDiversity(data, startX, startY, width, height, imageWidth, imageHeight)
      characteristics.colorCount = colorAnalysis.distinctColors
      
      // 색상 임계값을 엄격하게 설정 (레고 부품은 보통 1-3색)
      if (colorAnalysis.distinctColors > 8) {
        characteristics.reason = '색상 과다'
        return characteristics
      }
      
      if (colorAnalysis.distinctColors < 1) {
        characteristics.reason = '색상 부족'
        return characteristics
      }
      
      // 4. 엣지 밀도 검사 (레고 부품은 명확한 윤곽선)
      const edgeDensity = calculateEdgeDensity(data, startX, startY, width, height, imageWidth, imageHeight)
      characteristics.edgeDensity = edgeDensity
      
      // 윤곽선 품질 기반 레고 부품 판단
      const polygonQuality = analyzePolygonQuality(data, startX, startY, width, height, imageWidth, imageHeight)
      characteristics.polygonQuality = polygonQuality
      
      // 엣지 밀도와 윤곽선 품질을 종합적으로 판단
      if (edgeDensity < 0.1 && polygonQuality.score < 0.3) {
        characteristics.reason = '윤곽선 품질 부족'
        return characteristics
      }
      
      // 5. 컴팩트니스 검사 (레고 부품은 비교적 조밀함)
      const compactness = calculateCompactness(data, startX, startY, width, height, imageWidth, imageHeight)
      characteristics.compactness = compactness
      
      // 컴팩트니스 임계값을 엄격하게 설정
      if (compactness < 0.3) {
        characteristics.reason = '컴팩트니스 부족'
        return characteristics
      }
      
      // 6. 텍스처 일관성 검사 (레고 부품은 매끄러운 표면)
      const textureConsistency = calculateTextureConsistency(data, startX, startY, width, height, imageWidth, imageHeight)
      
      // 텍스처 일관성 임계값을 엄격하게 설정
      if (textureConsistency < 0.4) {
        characteristics.reason = '텍스처 불일치'
        return characteristics
      }
      
      // 7. 레고 부품 특성 점수 계산
      let legoScore = 0
      
      // 투명/흰색 부품 보너스 점수
      if (transparencyCheck.isTransparent) {
        legoScore += 0.1 // 투명 부품 보너스
      }
      if (transparencyCheck.isWhiteOnWhite) {
        legoScore += 0.1 // 흰색 부품 보너스
      }
      
      // 색상 점수 (1-5색: 높은 점수, 6-8색: 중간 점수)
      if (colorAnalysis.distinctColors >= 1 && colorAnalysis.distinctColors <= 5) {
        legoScore += 0.3
      } else if (colorAnalysis.distinctColors <= 8) {
        legoScore += 0.2
      } else if (colorAnalysis.distinctColors <= 12) {
        legoScore += 0.1
      }
      
      // 엣지 밀도 점수
      if (edgeDensity >= 0.2) {
        legoScore += 0.3
      } else if (edgeDensity >= 0.1) {
        legoScore += 0.2
      }
      
      // 종횡비 점수 (정사각형에 가까울수록 높은 점수)
      if (aspectRatio <= 1.5) {
        legoScore += 0.2
      } else if (aspectRatio <= 2.0) {
        legoScore += 0.1
      }
      
      // 컴팩트니스 점수
      if (compactness >= 0.6) {
        legoScore += 0.2
      } else if (compactness >= 0.4) {
        legoScore += 0.1
      }
      
      // 최종 판정 (임계값을 엄격하게 설정: 0.2 → 0.6)
      if (legoScore >= 0.6) {
        characteristics.isLegoPart = true
        characteristics.reason = `레고 부품 (점수: ${legoScore.toFixed(2)})`
        characteristics.confidenceBoost = 1.0 + (legoScore - 0.6) * 0.5 // 0.6-1.0 범위
      } else {
        characteristics.reason = `레고 부품 아님 (점수: ${legoScore.toFixed(2)})`
      }
      
      return characteristics
    }

    // 윤곽선 품질 분석 (레고 부품 인식 기준)
    const analyzePolygonQuality = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      const quality = {
        score: 0,
        edgeContinuity: 0,
        shapeRegularity: 0,
        cornerSharpness: 0,
        symmetry: 0
      }
      
      // 1. 엣지 연속성 검사
      const edgePoints = []
      for (let y = startY; y < startY + height; y += 2) {
        for (let x = startX; x < startX + width; x += 2) {
          if (isEdgePoint(data, x, y, imageWidth, imageHeight)) {
            edgePoints.push({ x, y })
          }
        }
      }
      
      // 엣지 포인트 밀도
      const edgeDensity = edgePoints.length / (width * height / 4)
      quality.edgeContinuity = Math.min(1, edgeDensity * 10)
      
      // 2. 모양 규칙성 검사 (레고 부품은 기하학적 형태)
      const aspectRatio = Math.max(width, height) / Math.min(width, height)
      quality.shapeRegularity = aspectRatio <= 2.0 ? 1.0 : Math.max(0, 1 - (aspectRatio - 2.0) * 0.5)
      
      // 3. 모서리 선명도 검사
      const cornerSharpness = calculateCornerSharpness(data, startX, startY, width, height, imageWidth, imageHeight)
      quality.cornerSharpness = cornerSharpness
      
      // 4. 대칭성 검사 (레고 부품은 대체로 대칭적)
      const symmetry = calculateSymmetry(data, startX, startY, width, height, imageWidth, imageHeight)
      quality.symmetry = symmetry
      
      // 종합 점수 계산
      quality.score = (
        quality.edgeContinuity * 0.3 +
        quality.shapeRegularity * 0.25 +
        quality.cornerSharpness * 0.25 +
        quality.symmetry * 0.2
      )
      
      console.log(`🎨 윤곽선 품질: ${quality.score.toFixed(3)} (연속성: ${quality.edgeContinuity.toFixed(3)}, 규칙성: ${quality.shapeRegularity.toFixed(3)}, 선명도: ${quality.cornerSharpness.toFixed(3)}, 대칭성: ${quality.symmetry.toFixed(3)})`)
      
      return quality
    }
    
    // 모서리 선명도 계산
    const calculateCornerSharpness = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      const corners = [
        { x: startX, y: startY }, // 좌상
        { x: startX + width - 1, y: startY }, // 우상
        { x: startX, y: startY + height - 1 }, // 좌하
        { x: startX + width - 1, y: startY + height - 1 } // 우하
      ]
      
      let totalSharpness = 0
      for (const corner of corners) {
        const sharpness = calculateGradientMagnitude(data, corner.x, corner.y, imageWidth, imageHeight)
        totalSharpness += sharpness
      }
      
      return Math.min(1, totalSharpness / 4 / 50) // 정규화
    }
    
    // 대칭성 계산
    const calculateSymmetry = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      const centerX = startX + width / 2
      const centerY = startY + height / 2
      
      let horizontalSymmetry = 0
      let verticalSymmetry = 0
      
      // 수평 대칭성
      for (let y = startY; y < startY + height; y += 2) {
        for (let x = startX; x < centerX; x += 2) {
          const leftIdx = (y * imageWidth + x) * 4
          const rightIdx = (y * imageWidth + (2 * centerX - x)) * 4
          
          if (rightIdx < data.length) {
            const leftBrightness = (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3
            const rightBrightness = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3
            const diff = Math.abs(leftBrightness - rightBrightness)
            horizontalSymmetry += Math.max(0, 1 - diff / 255)
          }
        }
      }
      
      // 수직 대칭성
      for (let y = startY; y < centerY; y += 2) {
        for (let x = startX; x < startX + width; x += 2) {
          const topIdx = (y * imageWidth + x) * 4
          const bottomIdx = ((2 * centerY - y) * imageWidth + x) * 4
          
          if (bottomIdx < data.length) {
            const topBrightness = (data[topIdx] + data[topIdx + 1] + data[topIdx + 2]) / 3
            const bottomBrightness = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3
            const diff = Math.abs(topBrightness - bottomBrightness)
            verticalSymmetry += Math.max(0, 1 - diff / 255)
          }
        }
      }
      
      const totalPixels = (width * height) / 4
      return (horizontalSymmetry + verticalSymmetry) / (2 * totalPixels)
    }
    
    // 그라디언트 크기 계산
    const calculateGradientMagnitude = (data, x, y, imageWidth, imageHeight) => {
      if (x < 1 || x >= imageWidth - 1 || y < 1 || y >= imageHeight - 1) return 0
      
      const gx = calculateSobelX(data, x, y, imageWidth, imageHeight)
      const gy = calculateSobelY(data, x, y, imageWidth, imageHeight)
      return Math.sqrt(gx * gx + gy * gy)
    }

    // 색상 다양성 분석 (개선된 버전)
    const analyzeColorDiversity = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      const colorSet = new Set()
      const step = Math.max(2, Math.floor(width / 8)) // 샘플링 간격을 더 넓게
      
      for (let y = startY; y < startY + height; y += step) {
        for (let x = startX; x < startX + width; x += step) {
          const idx = (y * imageWidth + x) * 4
          if (idx + 2 < data.length) {
            // 더 큰 양자화 단계로 색상 수 줄이기 (32 → 64)
            const r = Math.floor(data[idx] / 64) * 64
            const g = Math.floor(data[idx + 1] / 64) * 64
            const b = Math.floor(data[idx + 2] / 64) * 64
            colorSet.add(`${r},${g},${b}`)
          }
        }
      }
      
      return {
        distinctColors: colorSet.size,
        colors: Array.from(colorSet)
      }
    }

    // 엣지 밀도 계산
    const calculateEdgeDensity = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      let edgeCount = 0
      let totalPixels = 0
      
      for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
          totalPixels++
          if (isEdgePoint(data, x, y, imageWidth, imageHeight)) {
            edgeCount++
          }
        }
      }
      
      return edgeCount / totalPixels
    }

    // 컴팩트니스 계산 (객체의 조밀함)
    const calculateCompactness = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      let objectPixels = 0
      let totalPixels = width * height
      
      // 객체 픽셀 수 계산 (배경과 구분)
      const threshold = 128 // 중간값 임계값
      
      for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
          const idx = (y * imageWidth + x) * 4
          if (idx + 2 < data.length) {
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
            if (gray < threshold) { // 어두운 픽셀을 객체로 간주
              objectPixels++
            }
          }
        }
      }
      
      return objectPixels / totalPixels
    }

    // 투명/흰색 부품 검사
    const checkTransparencyOrWhite = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      let transparentPixels = 0
      let whitePixels = 0
      let totalPixels = 0
      
      for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
          const idx = (y * imageWidth + x) * 4
          if (idx + 3 < data.length) {
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const a = data[idx + 3]
            
            totalPixels++
            
            // 투명도 검사 (알파 값이 낮음)
            if (a < 200) {
              transparentPixels++
            }
            
            // 흰색 검사 (RGB가 모두 높고 비슷함)
            if (r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
              whitePixels++
            }
          }
        }
      }
      
      const transparencyRatio = transparentPixels / totalPixels
      const whiteRatio = whitePixels / totalPixels
      
      return {
        isTransparent: transparencyRatio > 0.3, // 30% 이상 투명
        isWhiteOnWhite: whiteRatio > 0.7, // 70% 이상 흰색
        transparencyRatio,
        whiteRatio
      }
    }

    // 텍스처 일관성 계산
    const calculateTextureConsistency = (data, startX, startY, width, height, imageWidth, imageHeight) => {
      const step = Math.max(1, Math.floor(width / 8))
      const samples = []
      
      // 샘플링
      for (let y = startY; y < startY + height; y += step) {
        for (let x = startX; x < startX + width; x += step) {
          const idx = (y * imageWidth + x) * 4
          if (idx + 2 < data.length) {
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
            samples.push(gray)
          }
        }
      }
      
      if (samples.length < 2) return 0
      
      // 표준편차 계산 (낮을수록 일관성 높음)
      const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length
      const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length
      const stdDev = Math.sqrt(variance)
      
      // 일관성 점수 (표준편차가 낮을수록 높은 점수)
      return Math.max(0, 1 - stdDev / 128) // 0-1 범위로 정규화
    }

    // 실시간 검출 중지
    const stopRealtimeDetection = () => {
      realtimeActive.value = false
      if (realtimeInterval) {
        clearInterval(realtimeInterval)
        realtimeInterval = null
      }
      realtimeDetections.value = []
      currentFPS.value = 0
      console.log('⏹️ 실시간 검출 중지')
    }

    // AI 메타데이터 조회 함수 (최적화됨)
    const getAIMetadataForDetection = async (detection, bomData) => {
      try {
        const { supabase } = useSupabase()
        
        // BOM 부품 ID 목록 (전달받은 bomData 사용)
        const bomIds = bomData?.map(part => part.part_id) || []
        
        if (bomIds.length === 0) {
          console.warn('🤖 BOM ID가 없어 AI 메타데이터 조회 불가')
          console.log('🤖 BOM 데이터 상태:', { bomData: !!bomData, bomIds: bomIds.length })
          return null
        }
        
        console.log(`🤖 AI 메타데이터 조회: ${bomIds.length}개 BOM 부품 대상`)
        
        const { data, error } = await supabase
          .from('parts_master_features')
          .select(`
            part_id,
            part_name,
            feature_json,
            clip_text_emb,
            recognition_hints,
            confidence,
            usage_frequency
          `)
          .in('part_id', bomIds)
          .order('confidence', { ascending: false })
          .limit(3) // 성능 최적화: 상위 3개만 조회
        
        if (error) {
          console.warn('🤖 AI 메타데이터 조회 실패:', error)
          return null
        }
        
        console.log(`🤖 AI 메타데이터 조회 결과: ${data?.length || 0}개`)
        
        // 검출된 객체와 가장 유사한 부품 찾기 (간단한 휴리스틱)
        if (data && data.length > 0) {
          const bestMatch = data[0] // 우선순위가 높은 부품
          console.log(`🤖 선택된 AI 메타데이터: ${bestMatch.part_id} (confidence: ${bestMatch.confidence})`)
          return {
            ...bestMatch,
            color_characteristics: bestMatch.feature_json?.color || null,
            size_characteristics: bestMatch.feature_json?.size || null
          }
        }
        
        console.log('🤖 AI 메타데이터 없음')
        return null
      } catch (err) {
        console.warn('🤖 AI 메타데이터 조회 오류:', err)
        return null
      }
    }

    // 렌더링된 JSON 파일에서 polygon_uv 로드
    const loadPolygonUVFromRenderedData = async (partId, colorId) => {
      try {
        const { supabase } = useSupabase()
        
        // 렌더링된 이미지 메타데이터에서 polygon_uv 조회
        const { data, error } = await supabase
          .from('image_metadata')
          .select('polygon_uv, metadata_json')
          .eq('part_id', partId)
          .eq('color_id', colorId)
          .limit(1)
        
        if (error) {
          console.warn('polygon_uv 로드 실패:', error)
          return null
        }
        
        if (data && data.length > 0) {
          const record = data[0]
          // polygon_uv가 직접 저장되어 있거나 metadata_json에 있는지 확인
          if (record.polygon_uv) {
            return record.polygon_uv
          } else if (record.metadata_json?.polygon_uv) {
            return record.metadata_json.polygon_uv
          }
        }
        
        return null
      } catch (err) {
        console.warn('polygon_uv 로드 오류:', err)
        return null
      }
    }

    // 렌더링된 JSON 파일의 polygon_uv를 활용한 검출 강화
    const enhanceDetectionWithRenderedPolygonUV = async (detections) => {
      const enhancedDetections = []
      
      for (const detection of detections) {
        try {
          // 레고 부품 특성에서 부품 정보 추출
          const legoCharacteristics = detection.legoCharacteristics
          
          if (legoCharacteristics && legoCharacteristics.isLegoPart) {
            // AI 메타데이터에서 정확한 부품 정보 가져오기
            const aiMetadata = await getAIMetadataForDetection(detection, bomParts.value)
            
            if (aiMetadata && aiMetadata.part_id) {
              console.log(`🔍 렌더링 JSON 조회: ${aiMetadata.part_id}/${aiMetadata.color_id}`)
              
              // 렌더링된 이미지에서 실제 polygon_uv 로드
              const polygonUV = await loadPolygonUVFromRenderedData(aiMetadata.part_id, aiMetadata.color_id)
              
              if (polygonUV && polygonUV.length >= 3) {
                console.log(`✅ 렌더링 polygon_uv 발견: ${polygonUV.length}개 점`)
                
                // UV 좌표를 픽셀 좌표로 변환
                const videoWidth = cameraVideo.value?.videoWidth || 1280
                const videoHeight = cameraVideo.value?.videoHeight || 720
                
                // bbox 기준 좌표계로 사상 (정확한 정합)
                const bbox = detection?.bbox || { x: 0, y: 0, width: videoWidth, height: videoHeight }
                const pixelPolygon = polygonUV.map(([u, v]) => [
                  bbox.x + u * bbox.width,
                  bbox.y + v * bbox.height
                ])
                
                enhancedDetections.push({
                  ...detection,
                  polygon_uv: pixelPolygon,
                  ai_metadata: aiMetadata,
                  confidence_boost: (aiMetadata.detection_priority || 1.0) * legoCharacteristics.confidenceBoost,
                  rendered_polygon: true
                })
              } else {
                console.log(`⚠️ 렌더링 polygon_uv 없음, 기본 윤곽선 사용`)
                // 렌더링된 polygon_uv가 없으면 기본 윤곽선 사용
                const centerX = detection.x + detection.width / 2
                const centerY = detection.y + detection.height / 2
                const halfW = detection.width / 2
                const halfH = detection.height / 2
                
                const fallbackPolygon = [
                  [centerX - halfW, centerY - halfH],
                  [centerX + halfW, centerY - halfH],
                  [centerX + halfW, centerY + halfH],
                  [centerX - halfW, centerY + halfH]
                ]
                
                enhancedDetections.push({
                  ...detection,
                  polygon_uv: fallbackPolygon,
                  ai_metadata: aiMetadata,
                  confidence_boost: (aiMetadata.detection_priority || 1.0) * legoCharacteristics.confidenceBoost,
                  rendered_polygon: false
                })
              }
            } else {
              console.log(`⚠️ AI 메타데이터 없음, 기본 윤곽선 사용`)
              // AI 메타데이터가 없으면 기본 윤곽선 사용
              const centerX = detection.x + detection.width / 2
              const centerY = detection.y + detection.height / 2
              const halfW = detection.width / 2
              const halfH = detection.height / 2
              
              const fallbackPolygon = [
                [centerX - halfW, centerY - halfH],
                [centerX + halfW, centerY - halfH],
                [centerX + halfW, centerY + halfH],
                [centerX - halfW, centerY + halfH]
              ]
              
              enhancedDetections.push({
                ...detection,
                polygon_uv: fallbackPolygon,
                rendered_polygon: false
              })
            }
          } else {
            // 레고 부품이 아니면 기본 검출 결과 사용
            enhancedDetections.push(detection)
          }
        } catch (err) {
          console.warn('렌더링 JSON 활용 실패:', err)
          enhancedDetections.push(detection)
        }
      }
      
      return enhancedDetections
    }

    // 실제 부품의 polygon_uv를 검출 결과에 적용 (기존 함수 유지)
    const enhanceDetectionWithPolygonUV = async (detections) => {
      const enhancedDetections = []
      
      for (const detection of detections) {
        try {
          // AI 메타데이터에서 부품 정보 가져오기
          const aiMetadata = await getAIMetadataForDetection(detection, bomParts.value)
          
          if (aiMetadata && aiMetadata.part_id) {
            // 실제 부품의 polygon_uv 로드
            const polygonUV = await loadPolygonUVFromRenderedData(aiMetadata.part_id, aiMetadata.color_id)
            
            if (polygonUV && polygonUV.length >= 3) {
              // UV 좌표를 픽셀 좌표로 변환
              const videoWidth = cameraVideo.value?.videoWidth || 1280
              const videoHeight = cameraVideo.value?.videoHeight || 720
              
              const bbox = detection?.bbox || { x: 0, y: 0, width: videoWidth, height: videoHeight }
              const pixelPolygon = polygonUV.map(([u, v]) => [
                bbox.x + u * bbox.width,
                bbox.y + v * bbox.height
              ])
              
              enhancedDetections.push({
                ...detection,
                polygon_uv: pixelPolygon,
                ai_metadata: aiMetadata,
                confidence_boost: aiMetadata.detection_priority || 1.0
              })
            } else {
              // polygon_uv가 없으면 기본 검출 결과 사용
              enhancedDetections.push({
                ...detection,
                ai_metadata: aiMetadata,
                confidence_boost: aiMetadata.detection_priority || 1.0
              })
            }
          } else {
            // AI 메타데이터가 없으면 기본 검출 결과 사용
            enhancedDetections.push(detection)
          }
        } catch (err) {
          console.warn('polygon_uv 강화 실패:', err)
          enhancedDetections.push(detection)
        }
      }
      
      return enhancedDetections
    }

    // polygon_uv 윤곽선 그리기
    const drawBoundingBoxes = () => {
      if (!bboxCanvas.value || !cameraVideo.value) {
        console.log('❌ 바운딩 박스 캔버스 또는 카메라가 준비되지 않았습니다')
        return
      }
      
      const canvas = bboxCanvas.value
      const ctx = canvas.getContext('2d')
      const video = cameraVideo.value
      
      // 캔버스 크기를 비디오와 맞춤
      const videoWidth = video.videoWidth || 1280
      const videoHeight = video.videoHeight || 720
      
      canvas.width = videoWidth
      canvas.height = videoHeight
      canvas.style.width = videoWidth + 'px'
      canvas.style.height = videoHeight + 'px'
      
      // 캔버스 초기화
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      console.log(`🎨 polygon_uv 윤곽선 그리기: ${realtimeDetections.value.length}개 객체`)
      
      // polygon_uv 윤곽선 그리기
      realtimeDetections.value.forEach((detection, index) => {
        const { x, y, width, height, confidence, ai_metadata, polygon_uv } = detection
        
        console.log(`🎨 객체 ${index + 1}:`, { x, y, width, height, confidence, polygon_uv: polygon_uv?.length || 0 })
        
        // 좌표가 유효한지 확인
        if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
          console.warn('❌ 유효하지 않은 좌표:', detection)
          return
        }
        
        // AI 메타데이터가 있으면 색상 변경
        const hasAIMetadata = ai_metadata && ai_metadata.detection_priority > 0.5
        const isRenderedPolygon = detection.rendered_polygon
        const alpha = Math.min(confidence * 2, 1)
        
        // polygon_uv 윤곽선 그리기
        if (polygon_uv && polygon_uv.length >= 3) {
          console.log(`🎨 윤곽선 그리기: ${polygon_uv.length}개 점 ${isRenderedPolygon ? '(렌더링)' : '(실시간)'}`)
          
          // 렌더링된 polygon_uv는 파란색, 실시간은 노란색
          let strokeColor, fillColor
          if (hasAIMetadata) {
            strokeColor = '0, 255, 0' // AI 메타데이터: 녹색
            fillColor = '0, 255, 0'
          } else if (isRenderedPolygon) {
            strokeColor = '0, 150, 255' // 렌더링된 polygon_uv: 파란색
            fillColor = '0, 150, 255'
          } else {
            strokeColor = '255, 255, 0' // 실시간 윤곽선: 노란색
            fillColor = '255, 255, 0'
          }
          
          ctx.strokeStyle = `rgba(${strokeColor}, ${alpha})`
          ctx.fillStyle = `rgba(${fillColor}, ${alpha * 0.1})`
          ctx.lineWidth = hasAIMetadata ? 3 : (isRenderedPolygon ? 2.5 : 2)
          
          // 폴리곤 경로 시작
          ctx.beginPath()
          
          // 첫 번째 점으로 이동 (UV 좌표를 픽셀 좌표로 변환)
          const firstPoint = polygon_uv[0]
          const startX = firstPoint[0] * videoWidth
          const startY = firstPoint[1] * videoHeight
          ctx.moveTo(startX, startY)
          
          // 나머지 점들을 연결
          for (let i = 1; i < polygon_uv.length; i++) {
            const point = polygon_uv[i]
            const pointX = point[0] * videoWidth
            const pointY = point[1] * videoHeight
            ctx.lineTo(pointX, pointY)
          }
          
          // 폴리곤 닫기
          ctx.closePath()
          
          // 윤곽선과 채우기 그리기
          ctx.fill()
          ctx.stroke()
          
          // 중심점 표시
          const centerX = x + width / 2
          const centerY = y + height / 2
          ctx.fillStyle = `rgba(${hasAIMetadata ? '0, 255, 0' : '255, 255, 0'}, ${alpha})`
          ctx.beginPath()
          ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI)
          ctx.fill()
        } else {
          console.log(`🎨 기본 바운딩 박스 그리기 (polygon_uv 없음)`)
          // polygon_uv가 없으면 기본 바운딩 박스 그리기
          ctx.strokeStyle = `rgba(${hasAIMetadata ? '0, 255, 0' : '255, 255, 0'}, ${alpha})`
          ctx.lineWidth = hasAIMetadata ? 3 : 2
          ctx.strokeRect(x, y, width, height)
          
          // 강제로 윤곽선 생성 (사각형)
          const centerX = x + width / 2
          const centerY = y + height / 2
          const halfW = width / 2
          const halfH = height / 2
          
          ctx.beginPath()
          ctx.moveTo(centerX - halfW, centerY - halfH)
          ctx.lineTo(centerX + halfW, centerY - halfH)
          ctx.lineTo(centerX + halfW, centerY + halfH)
          ctx.lineTo(centerX - halfW, centerY + halfH)
          ctx.closePath()
          ctx.stroke()
        }
        
        // 라벨 배경
        const legoInfo = detection.legoCharacteristics
        const labelText = hasAIMetadata 
          ? `AI: ${ai_metadata.part_name || '부품'} (${(confidence * 100).toFixed(1)}%)`
          : legoInfo 
            ? `레고: ${legoInfo.reason} ${isRenderedPolygon ? '(렌더링)' : '(실시간)'} (${(confidence * 100).toFixed(1)}%)`
            : `객체 ${index + 1} (${(confidence * 100).toFixed(1)}%)`
        
        ctx.font = '12px Arial'
        const textMetrics = ctx.measureText(labelText)
        const labelWidth = textMetrics.width + 8
        const labelHeight = 20
        
        // 라벨 배경 그리기
        ctx.fillStyle = `rgba(${hasAIMetadata ? '0, 255, 0' : '255, 255, 0'}, ${alpha * 0.8})`
        ctx.fillRect(x, y - labelHeight, labelWidth, labelHeight)
        
        // 라벨 텍스트
        ctx.fillStyle = 'white'
        ctx.fillText(labelText, x + 4, y - 6)
      })
    }

    // 생명주기
    onMounted(async () => {
      console.log('🔄 하이브리드 누락 검출 시스템 초기화')
      
      // 앱 시작 시 자동 동기화
      try {
        await autoSyncAction()
      } catch (err) {
        console.warn('자동 동기화 실패:', err.message)
      }

      // localStorage 자가 점검
      try {
        const STORAGE_KEY = 'hybrid_ls_storage_test'
        const payload = { t: Date.now(), ok: true }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
        const readBack = localStorage.getItem(STORAGE_KEY)
        const ok = !!readBack
        if (ok) localStorage.removeItem(STORAGE_KEY)
      } catch (e) {
        // localStorage self-check 실패
      }
    })

    onUnmounted(() => {
      stopCamera()
      stopRealtimeDetection()
    })

    return {
      loading,
      error,
      setNumber,
      detectionMode,
      cameraActive,
      cameraVideo,
      uploadedImageData,
      setMetadata,
      syncResult,
      detectionResults,
      performanceMetrics,
      progress,
      cacheStats,
      needsUpdate,
      loadingText,
      // 폐쇄 세계 검출 관련
      filters,
      bomParts,
      bomColors,
      sparePartsCount,
      // 메서드
      loadSetMetadata,
      loadBOMData,
      applyClosedWorldFilters,
      performBOMBasedHybridDetection,
      performBOMBasedDetection,
      calculateBOMMatchScore,
      // 하이브리드 캐시 함수들
      searchLocalCache,
      compareLocalVectors,
      compareRemoteVectors,
      checkVersionAction,
      syncIncrementalAction,
      autoSyncAction,
      forceSyncAction,
      toggleCamera,
      hybridDetect,
      onUploadImage,
      hybridDetectFromUpload,
      getSyncStatusClass,
      getSyncStatusText,
      getLocalPercentage,
      getRemotePercentage,
      formatDate,
      resultsPanelRef,
      getRemoteVersionDisplay,
      // 매치 미리보기 관련
      selectedMatch,
      matchPreviewImage,
      onClickMatch,
      // BOM 상태 관련
      getBOMPartStatus,
      getBOMPartIcon,
      // 실시간 검출 관련
      realtimeActive,
      realtimeDetections,
      uploadDetections,
      currentFPS,
      bboxCanvas,
      uploadBboxCanvas,
      startRealtimeDetection,
      stopRealtimeDetection,
      drawBoundingBoxes,
      getAIMetadataForDetection,
      loadPolygonUVFromRenderedData,
      enhanceDetectionWithPolygonUV,
      enhanceDetectionWithRenderedPolygonUV
    }
  }
}
</script>

<style scoped>
.hybrid-detection {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
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

.architecture-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
}

.architecture-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.arch-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 20px;
}

.arch-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.arch-card h3 {
  margin: 10px 0;
  font-size: 18px;
}

.arch-card ul {
  margin: 10px 0;
  padding-left: 20px;
}

.arch-card li {
  margin: 5px 0;
  opacity: 0.9;
}

.cache-status-panel, .sync-result-panel, .detection-panel, .camera-panel, .results-panel {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.status-label {
  font-weight: 600;
  color: #2c3e50;
}

.status-value {
  font-size: 16px;
  font-weight: bold;
}

.status-ready { color: #27ae60; }
.status-downloading { color: #f39c12; }
.status-checking { color: #3498db; }
.status-idle { color: #95a5a6; }

/* 진행률 바 */
.progress {
  position: relative;
  width: 100%;
  height: 24px;
  background: #ecf0f1;
  border-radius: 12px;
  overflow: hidden;
  margin: 16px 0;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 12px;
}

/* 매치 그리드 */
.match-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.match-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.match-item:hover {
  background: #e3f2fd;
  border-color: #2196f3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15);
}

.match-icon {
  font-size: 20px;
  margin-right: 12px;
}

.match-content {
  flex: 1;
}

.match-title {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.match-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #7f8c8d;
}

.match-source.local { color: #27ae60; }
.match-source.remote { color: #e74c3c; }

/* BOM 부품 그리드 */
.parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.part-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.part-item.complete {
  background: #d4edda;
  border-color: #c3e6cb;
}

.part-item.partial {
  background: #fff3cd;
  border-color: #ffeaa7;
}

.part-item.missing {
  background: #f8d7da;
  border-color: #f5c6cb;
}

.part-item.unknown {
  background: #f8f9fa;
  border-color: #e9ecef;
}

.part-icon {
  font-size: 20px;
  margin-right: 12px;
}

.part-content {
  flex: 1;
}

.part-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.part-details {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #7f8c8d;
}

/* 미리보기 모달 */
.preview-modal {
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

.preview-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.preview-header h3 {
  margin: 0;
  color: #2c3e50;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #7f8c8d;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  color: #e74c3c;
}

.preview-body {
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.preview-info h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
}

.preview-info p {
  margin: 8px 0;
  color: #7f8c8d;
}

.preview-image {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 8px;
  min-height: 200px;
}

.preview-image img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}

.no-image {
  text-align: center;
  color: #7f8c8d;
}

.no-image p {
  margin: 0 0 8px 0;
  font-weight: 600;
}

.no-image small {
  font-size: 12px;
}

.cache-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.result-item.success {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
  color: white;
}

.result-item.info {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
}

.result-item.version {
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
  color: white;
}

.result-icon {
  font-size: 32px;
}

.result-content h3 {
  font-size: 24px;
  margin: 0;
}

.result-content p {
  margin: 5px 0 0 0;
  opacity: 0.9;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-group label {
  font-weight: 600;
  color: #2c3e50;
}

.config-group input, .config-group select {
  padding: 10px;
  border: 2px solid #e1e8ed;
  border-radius: 8px;
  font-size: 14px;
}

.camera-controls {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.camera-container {
  position: relative;
  max-width: 640px;
  margin: 0 auto;
  border: 2px solid #e1e8ed;
  border-radius: 12px;
  overflow: hidden;
}

/* 실시간 바운딩 박스 오버레이 */
.bbox-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

/* 실시간 검출 상태 */
.realtime-status {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px 20px;
  border-radius: 8px;
  margin: 15px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.realtime-status .status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pulse-dot {
  width: 12px;
  height: 12px;
  background: #00ff00;
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}

.fps-counter {
  font-weight: bold;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.2);
  padding: 5px 10px;
  border-radius: 15px;
}

.camera-video {
  width: 100%;
  height: auto;
  display: block;
  background: #000;
}

.camera-status {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-indicator {
  color: #27ae60;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 폐쇄 세계 검출 스타일 */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  margin: 0;
}

.detection-mode-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.mode-badge {
  display: inline-block;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 14px;
}

.detection-mode-info small {
  color: #7f8c8d;
  font-size: 12px;
  line-height: 1.4;
}

.bom-panel {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  border-left: 4px solid #e74c3c;
}

.bom-panel h2 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
}

.bom-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.stat-item {
  background: white;
  border-radius: 6px;
  padding: 15px;
  text-align: center;
  border: 1px solid #e1e8ed;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #7f8c8d;
  margin-bottom: 5px;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #2c3e50;
}

/* BOM 기반 검출 결과 스타일 */
.bom-results {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  border-left: 4px solid #e74c3c;
}

.bom-results h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
}

.bom-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.bom-stat {
  background: white;
  border-radius: 8px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2px solid transparent;
}

.bom-stat.success {
  border-color: #27ae60;
}

.bom-stat.error {
  border-color: #e74c3c;
}

.bom-stat.info {
  border-color: #3498db;
}

.bom-stat .stat-icon {
  font-size: 24px;
}

.bom-stat .stat-content h4 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
}

.bom-stat .stat-content p {
  margin: 5px 0 0 0;
  font-size: 12px;
  color: #7f8c8d;
}

/* 수량별 누락 분석 스타일 */
.quantity-analysis {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  border-left: 4px solid #e74c3c;
}

.quantity-analysis h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
}

.missing-parts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.missing-part-item {
  background: white;
  border-radius: 6px;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 2px solid transparent;
}

.missing-part-item.complete {
  border-color: #27ae60;
  background: #d5f4e6;
}

.missing-part-item.partial {
  border-color: #f39c12;
  background: #fef5e7;
}

.missing-part-item.missing {
  border-color: #e74c3c;
  background: #fadbd8;
}

.part-info {
  flex: 1;
}

.part-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.part-color {
  font-size: 12px;
  color: #7f8c8d;
}

.quantity-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.quantity-status {
  display: flex;
  align-items: center;
  gap: 2px;
  font-weight: 600;
}

.quantity-status .found {
  color: #27ae60;
}

.quantity-status .separator {
  color: #7f8c8d;
}

.quantity-status .required {
  color: #2c3e50;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.complete {
  background: #27ae60;
  color: white;
}

.status-badge.partial {
  background: #f39c12;
  color: white;
}

.status-badge.missing {
  background: #e74c3c;
  color: white;
}

.performance-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 12px;
  color: white;
}

.metric-card.local {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
}

.metric-card.remote {
  background: linear-gradient(135deg, #3498db, #2980b9);
}

.metric-card.speed {
  background: linear-gradient(135deg, #f39c12, #e67e22);
}

.metric-card.traffic {
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
}

.metric-icon {
  font-size: 32px;
}

.metric-content h3 {
  font-size: 24px;
  margin: 0;
}

.metric-content p {
  margin: 5px 0 0 0;
  opacity: 0.9;
}

.results-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.stat-card.success {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
  color: white;
}

.stat-card.error {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
}

.stat-icon {
  font-size: 32px;
}

.stat-content h3 {
  font-size: 24px;
  margin: 0;
}

.stat-content p {
  margin: 5px 0 0 0;
  opacity: 0.9;
}

.source-analysis {
  margin-top: 30px;
}

.source-chart {
  margin-top: 15px;
}

.source-bar {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.source-label {
  width: 120px;
  font-weight: 600;
  color: #2c3e50;
}

.source-bar-fill {
  height: 30px;
  background: linear-gradient(135deg, #27ae60, #2ecc71);
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  transition: width 0.3s ease;
}

.source-bar-fill.remote {
  background: linear-gradient(135deg, #3498db, #2980b9);
}

.btn-primary, .btn-secondary, .btn-success, .btn-warning, .btn-danger {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-warning {
  background: #f39c12;
  color: white;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #e74c3c;
  color: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 15px;
}

@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .architecture-grid {
    grid-template-columns: 1fr;
  }
  
  .performance-metrics {
    grid-template-columns: 1fr;
  }
  
  .cache-actions {
    flex-direction: column;
  }
}
</style>
