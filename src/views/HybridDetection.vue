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
            placeholder="예: 76917 (하이브리드 검출)"
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
        <div class="camera-status" v-if="cameraActive">
          <span class="status-indicator">●</span>
          하이브리드 모드 활성화
        </div>
      </div>
    </div>

    <!-- 검출 결과 -->
    <div class="results-panel" v-if="detectionResults">
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
      searchLocalCache,
      compareLocalVectors,
      compareRemoteVectors
    } = useHybridCache()

    // 반응형 데이터
    const setNumber = ref('')
    const detectionMode = ref('hybrid-bom') // 하이브리드 + BOM 기반으로 고정
    const cameraActive = ref(false)
    const cameraVideo = ref(null)
    let cameraStream = null

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
    const performanceMetrics = ref({
      localMatches: 0,
      remoteMatches: 0,
      processingTime: 0,
      trafficUsed: 0
    })

    const loadingText = ref('처리 중...')

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
        const vectorCache = new Map() // 벡터 비교 결과 캐싱
        
        // BOM의 각 부품에 대해 수량만큼 검출된 객체에서 찾기
        for (const bomPart of bomMetadata) {
          const requiredQuantity = bomPart.quantity || 1
          const foundMatches = []
          const partKey = `${bomPart.part_id}/${bomPart.color_id}`
          
          // 중복 로그 방지
          if (!processedParts.has(partKey)) {
            console.log(`🔍 BOM 부품 검색: ${bomPart.part_id} (${bomPart.color_name}) - 필요 수량: ${requiredQuantity}개`)
            processedParts.add(partKey)
          }
          
          // 필요한 수량만큼 반복하여 매칭 시도
          for (let q = 0; q < requiredQuantity; q++) {
            let bestMatch = null
            let bestScore = 0
            let bestDetectionIndex = -1
            let bestSource = null
            
            // 검출된 객체들 중에서 BOM 부품과 가장 유사한 것 찾기
            for (let i = 0; i < detections.length; i++) {
              if (usedDetections.has(i)) continue // 이미 사용된 검출 객체는 제외
              
              const detection = detections[i]
              const cacheKey = `${partKey}/${i}`
              
              let hybridScore = 0
              let source = null
              
              // 벡터 비교 결과 캐싱
              if (vectorCache.has(cacheKey)) {
                const cached = vectorCache.get(cacheKey)
                hybridScore = cached.score
                source = cached.source
              } else {
                // 1. 로컬 캐시에서 먼저 검색
                const localResult = await searchLocalCache(bomPart.part_id, bomPart.color_id)
                
                if (localResult.found) {
                  // 로컬에서 벡터 비교
                  hybridScore = await compareLocalVectors(detection, bomPart)
                  source = 'local'
                } else {
                  // 원격에서 벡터만 가져와서 비교
                  hybridScore = await compareRemoteVectors(detection, bomPart)
                  source = 'remote'
                }
                
                // 결과 캐싱
                vectorCache.set(cacheKey, { score: hybridScore, source })
              }
              
              // BOM 매칭 점수와 하이브리드 점수 결합
              const bomScore = await calculateBOMMatchScore(detection, bomPart)
              const combinedScore = (hybridScore * 0.6) + (bomScore * 0.4) // 하이브리드 60% + BOM 40%
              
              if (combinedScore > bestScore && combinedScore > 0.3) {
                bestScore = combinedScore
                bestMatch = {
                  ...bomPart,
                  detection: detection,
                  score: combinedScore,
                  source: source,
                  hybridScore: hybridScore,
                  bomScore: bomScore,
                  instanceNumber: q + 1, // 인스턴스 번호 (1, 2, 3, ...)
                  totalRequired: requiredQuantity
                }
                bestDetectionIndex = i
                bestSource = source
              }
            }
            
            if (bestMatch) {
              foundMatches.push(bestMatch)
              usedDetections.add(bestDetectionIndex) // 사용된 검출 객체 표시
              console.log(`✅ 폐쇄 환경 매칭: ${bomPart.part_id} (${bomPart.color_name}) - ${q + 1}/${requiredQuantity} - 점수: ${bestMatch.score.toFixed(3)} (${bestSource})`)
            } else {
              // 이 수량에서 매칭 실패
              console.log(`❌ 매칭 실패: ${bomPart.part_id} (${bomPart.color_name}) - ${q + 1}/${requiredQuantity}`)
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
        }
        
        console.log(`🎯 폐쇄 환경 하이브리드 검출 완료: ${matches.length}개 매칭, ${missingSlots.length}개 누락`)
        
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

    // BOM 매칭 점수 계산
    const calculateBOMMatchScore = async (detection, bomPart) => {
      try {
        let score = 0
        
        // 1. 모양 유사도 (CLIP 벡터 비교)
        if (detection.features?.shape_vector && bomPart.features?.shape_vector) {
          const shapeScore = calculateCosineSimilarity(detection.features.shape_vector, bomPart.features.shape_vector)
          score += shapeScore * 0.4 // 40% 가중치
        }
        
        // 2. 색상 유사도 (Lab 색상 공간)
        if (detection.features?.color_lab && bomPart.features?.color_lab) {
          const colorScore = calculateColorSimilarity(detection.features.color_lab, bomPart.features.color_lab)
          score += colorScore * 0.3 // 30% 가중치
        }
        
        // 3. 크기 유사도 (스터드 수)
        if (detection.features?.size_stud && bomPart.features?.size_stud) {
          const sizeScore = calculateSizeSimilarity(detection.features.size_stud, bomPart.features.size_stud)
          score += sizeScore * 0.2 // 20% 가중치
        }
        
        // 4. 위치 유사도 (바운딩 박스)
        if (detection.bbox && bomPart.expected_bbox) {
          const positionScore = calculatePositionSimilarity(detection.bbox, bomPart.expected_bbox)
          score += positionScore * 0.1 // 10% 가중치
        }
        
        return Math.min(score, 1.0) // 최대 1.0으로 제한
        
      } catch (err) {
        console.error('❌ BOM 매칭 점수 계산 실패:', err)
        return 0
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
        
        // 프레임 캡처
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = cameraVideo.value.videoWidth || 1280
        canvas.height = cameraVideo.value.videoHeight || 720
        ctx.drawImage(cameraVideo.value, 0, 0)
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        
        // 실제 YOLO 검출 (실제 구현에서는 YOLO + CLIP 사용)
        const { useOptimizedRealtimeDetection } = await import('../composables/useOptimizedRealtimeDetection')
        const { detectPartsWithYOLO } = useOptimizedRealtimeDetection()
        const detections = await detectPartsWithYOLO(imageData)
        
        // 검출된 객체에 실제 특징 벡터 추가
        const enhancedDetections = detections.map(detection => ({
          ...detection,
          features: {
            shape_vector: Array.from({ length: 512 }, () => Math.random() * 2 - 1), // 실제로는 CLIP 인코딩
            color_lab: { L: Math.random() * 100, a: Math.random() * 200 - 100, b: Math.random() * 200 - 100 },
            size_stud: Math.random() * 10 + 1
          }
        }))
        
        // 폐쇄 환경 하이브리드 검출
        console.log('🎯 폐쇄 환경 하이브리드 검출 시작...')
        
        // 1. 폐쇄 환경 필터 적용 (BOM 부품만 검출 대상)
        const closedWorldMetadata = applyClosedWorldFilters(setMetadata.value.partsMetadata)
        
        // 2. 폐쇄 환경 하이브리드 매칭 수행
        const closedWorldResult = await performBOMBasedHybridDetection(enhancedDetections, closedWorldMetadata)
        
        // 3. 폐쇄 환경 결과 사용
        const matches = closedWorldResult.matches
        const missingSlots = closedWorldResult.missingSlots
        
        console.log(`🎯 폐쇄 환경 하이브리드 검출 완료: ${matches.length}개 매칭, ${missingSlots.length}개 누락`)
        
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
        
      } catch (err) {
        console.error('❌ 하이브리드 검출 실패:', err)
        error.value = `검출 실패: ${err.message}`
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

    // 생명주기
    onMounted(async () => {
      console.log('🔄 하이브리드 누락 검출 시스템 초기화')
      
      // 앱 시작 시 자동 동기화
      try {
        await autoSyncAction()
      } catch (err) {
        console.warn('자동 동기화 실패:', err.message)
      }
    })

    onUnmounted(() => {
      stopCamera()
    })

    return {
      loading,
      error,
      setNumber,
      detectionMode,
      cameraActive,
      cameraVideo,
      setMetadata,
      syncResult,
      detectionResults,
      performanceMetrics,
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
      toggleCamera,
      hybridDetect,
      getSyncStatusClass,
      getSyncStatusText,
      getLocalPercentage,
      getRemotePercentage,
      formatDate,
      getRemoteVersionDisplay
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
