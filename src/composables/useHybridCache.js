import { ref, reactive } from 'vue'
import { useSupabase } from './useSupabase'

/**
 * 하이브리드 캐시 시스템
 * - 본사(Supabase) + 매장(로컬) 하이브리드 구조
 * - 버전 관리 + 증분 동기화
 * - 트래픽 최소화 + 빠른 로컬 처리
 * - IndexedDB를 사용한 실제 로컬 저장소
 */
export function useHybridCache() {
  const { supabase } = useSupabase()
  const loading = ref(false)
  const error = ref(null)
  
  // IndexedDB 설정
  const DB_NAME = 'BrickBoxCache'
  const DB_VERSION = 1
  const STORES = {
    VERSIONS: 'versions',
    IMAGES: 'images',
    VECTORS: 'vectors'
  }
  
  // 로컬 캐시 상태
  const cacheState = reactive({
    localVersion: null,
    remoteVersion: null,
    totalSize: 0,
    lastSync: null,
    syncStatus: 'idle', // idle, checking, downloading, ready
    db: null
  })

  // IndexedDB 초기화
  const initIndexedDB = async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        cacheState.db = request.result
        resolve(request.result)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        // 버전 정보 저장소
        if (!db.objectStoreNames.contains(STORES.VERSIONS)) {
          const versionStore = db.createObjectStore(STORES.VERSIONS, { keyPath: 'id' })
          versionStore.createIndex('version', 'version', { unique: true })
        }
        
        // 이미지 저장소
        if (!db.objectStoreNames.contains(STORES.IMAGES)) {
          const imageStore = db.createObjectStore(STORES.IMAGES, { keyPath: 'id' })
          imageStore.createIndex('partId', 'partId', { unique: false })
          imageStore.createIndex('colorId', 'colorId', { unique: false })
          imageStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
        
        // 벡터 저장소
        if (!db.objectStoreNames.contains(STORES.VECTORS)) {
          const vectorStore = db.createObjectStore(STORES.VECTORS, { keyPath: 'id' })
          vectorStore.createIndex('partId', 'partId', { unique: false })
          vectorStore.createIndex('colorId', 'colorId', { unique: false })
        }
      }
    })
  }

  // IndexedDB 초기화 확인
  const ensureDB = async () => {
    if (!cacheState.db) {
      await initIndexedDB()
    }
    return cacheState.db
  }

  // 로컬 버전 정보 저장
  const saveLocalVersion = async (versionData) => {
    try {
      const db = await ensureDB()
      const transaction = db.transaction([STORES.VERSIONS], 'readwrite')
      const store = transaction.objectStore(STORES.VERSIONS)
      
      const versionRecord = {
        id: 'current',
        version: versionData.version,
        hash: versionData.hash,
        total_parts: versionData.total_parts,
        total_size: versionData.total_size,
        updated_at: versionData.updated_at
      }
      
      await new Promise((resolve, reject) => {
        const request = store.put(versionRecord)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
      
      console.log('📝 로컬 버전 저장 완료:', versionData.version)
    } catch (err) {
      console.error('❌ 로컬 버전 저장 실패:', err)
      throw err
    }
  }

  // 로컬 버전 정보 조회
  const getLocalVersion = async () => {
    try {
      const db = await ensureDB()
      const transaction = db.transaction([STORES.VERSIONS], 'readonly')
      const store = transaction.objectStore(STORES.VERSIONS)
      
      return new Promise((resolve, reject) => {
        const request = store.get('current')
        request.onsuccess = () => {
          if (request.result) {
            cacheState.localVersion = request.result.version
            resolve(request.result.version)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('로컬 버전 조회 실패:', err)
      return null
    }
  }

  // 이미지 로컬 저장
  const saveImageToLocal = async (partId, colorId, imageBlob) => {
    try {
      const db = await ensureDB()
      const transaction = db.transaction([STORES.IMAGES], 'readwrite')
      const store = transaction.objectStore(STORES.IMAGES)
      
      const imageRecord = {
        id: `${partId}_${colorId}`,
        partId,
        colorId,
        image: imageBlob,
        timestamp: Date.now(),
        size: imageBlob.size
      }
      
      await new Promise((resolve, reject) => {
        const request = store.put(imageRecord)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
      
      // 캐시 크기 업데이트
      cacheState.totalSize += imageBlob.size
      
      console.log(`📦 이미지 로컬 저장: ${partId}/${colorId} (${Math.round(imageBlob.size/1024)}KB)`)
      return true
    } catch (err) {
      console.error(`❌ 이미지 저장 실패: ${partId}/${colorId}`, err)
      return false
    }
  }

  // 로컬에서 이미지 조회
  const getImageFromLocal = async (partId, colorId) => {
    try {
      const db = await ensureDB()
      const transaction = db.transaction([STORES.IMAGES], 'readonly')
      const store = transaction.objectStore(STORES.IMAGES)
      
      return new Promise((resolve, reject) => {
        const request = store.get(`${partId}_${colorId}`)
        request.onsuccess = () => {
          if (request.result) {
            resolve({
              found: true,
              blob: request.result.image,
              size: request.result.size,
              timestamp: request.result.timestamp
            })
          } else {
            resolve({ found: false })
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn(`로컬 이미지 조회 실패: ${partId}/${colorId}`, err)
      return { found: false }
    }
  }

  // 벡터 데이터 로컬 저장
  const saveVectorToLocal = async (partId, colorId, vectorData) => {
    try {
      const db = await ensureDB()
      const transaction = db.transaction([STORES.VECTORS], 'readwrite')
      const store = transaction.objectStore(STORES.VECTORS)
      
      const vectorRecord = {
        id: `${partId}_${colorId}`,
        partId,
        colorId,
        shape_vector: vectorData.shape_vector,
        color_lab: vectorData.color_lab,
        size_stud: vectorData.size_stud,
        clip_embedding: vectorData.clip_embedding,
        timestamp: Date.now()
      }
      
      await new Promise((resolve, reject) => {
        const request = store.put(vectorRecord)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
      
      console.log(`📊 벡터 로컬 저장: ${partId}/${colorId}`)
      return true
    } catch (err) {
      console.error(`❌ 벡터 저장 실패: ${partId}/${colorId}`, err)
      return false
    }
  }

  // 로컬에서 벡터 조회
  const getVectorFromLocal = async (partId, colorId) => {
    try {
      const db = await ensureDB()
      const transaction = db.transaction([STORES.VECTORS], 'readonly')
      const store = transaction.objectStore(STORES.VECTORS)
      
      return new Promise((resolve, reject) => {
        const request = store.get(`${partId}_${colorId}`)
        request.onsuccess = () => {
          if (request.result) {
            resolve({
              found: true,
              shape_vector: request.result.shape_vector,
              color_lab: request.result.color_lab,
              size_stud: request.result.size_stud,
              clip_embedding: request.result.clip_embedding
            })
          } else {
            resolve({ found: false })
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn(`로컬 벡터 조회 실패: ${partId}/${colorId}`, err)
      return { found: false }
    }
  }

  // 버전 정보 조회
  const checkVersion = async () => {
    try {
      console.log('🔍 버전 체크 시작...')
      
      // IndexedDB 초기화
      await ensureDB()
      
      // 1. 로컬 버전 확인
      const localVersion = await getLocalVersion()
      cacheState.localVersion = localVersion
      
      // 2. 원격 버전 확인 (실제 데이터베이스 사용)
      const { data: remoteData, error: remoteError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (remoteError) {
        console.warn('원격 버전 조회 실패, 기본값 사용:', remoteError.message)
        const defaultData = {
          version: 'v1.0.0',
          hash: 'default-hash',
          total_parts: 0,
          total_size: 0,
          created_at: new Date().toISOString()
        }
        cacheState.remoteVersion = defaultData
        return {
          local: localVersion,
          remote: defaultData.version,
          needsUpdate: localVersion !== defaultData.version,
          remoteData: defaultData
        }
      }
      
      const versionData = {
        version: `v${remoteData.set_num}`,
        hash: remoteData.id,
        total_parts: 0,
        total_size: 0,
        created_at: remoteData.created_at
      }
      cacheState.remoteVersion = versionData
      
      console.log(`📊 로컬 버전: ${localVersion || '없음'}`)
      console.log(`📊 원격 버전: ${versionData.version}`)
      
      return {
        local: localVersion,
        remote: versionData.version,
        needsUpdate: localVersion !== versionData.version,
        remoteData: versionData
      }
      
    } catch (err) {
      console.error('❌ 버전 체크 실패:', err)
      throw err
    }
  }


  // 증분 동기화 (변경된 부품만)
  const syncIncremental = async (remoteData) => {
    try {
      cacheState.syncStatus = 'downloading'
      console.log('📦 증분 동기화 시작...')
      
      // 1. 변경된 부품 목록 조회 (실제 데이터베이스 사용)
      const { data: changedParts, error: partsError } = await supabase
        .from('set_parts')
        .select('part_id, color_id, quantity, lego_parts(name), lego_colors(name)')
        .limit(10) // 최근 10개 부품만
      
      if (partsError) {
        console.warn('부품 조회 실패:', partsError.message)
        return {
          success: 0,
          total: 0,
          version: remoteData.version
        }
      }
      
      const processedParts = changedParts.map(part => ({
        part_id: part.part_id,
        color_id: part.color_id,
        change_type: 'added',
        file_hash: `${part.part_id}-${part.color_id}`
      }))
      
      console.log('📦 실제 변경된 부품:', processedParts.length)
      
      // 2. 변경된 부품만 다운로드하고 로컬에 저장
      const downloadPromises = processedParts.map(async (part) => {
        try {
          // 실제 Supabase Storage에서 다운로드 시도
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('lego_parts_images')
            .download(`${part.part_id}/${part.color_id}.jpg`)
          
          if (downloadError) {
            console.log(`📦 이미지 없음 (정상): ${part.part_id}/${part.color_id} - 아직 렌더링되지 않음`)
            return {
              part_id: part.part_id,
              color_id: part.color_id,
              size: 0,
              hash: part.file_hash,
              status: 'not_rendered'
            }
          }
          
          const blob = new Blob([fileData], { type: 'image/jpeg' })
          console.log(`📦 실제 다운로드: ${part.part_id}/${part.color_id}.jpg (${Math.round(blob.size/1024)}KB)`)
          
          // 로컬 IndexedDB에 저장
          const saved = await saveImageToLocal(part.part_id, part.color_id, blob)
          
          return {
            part_id: part.part_id,
            color_id: part.color_id,
            size: blob.size,
            hash: part.file_hash,
            status: saved ? 'downloaded' : 'save_failed'
          }
        } catch (err) {
          console.log(`📦 다운로드 실패 (정상): ${part.part_id} - ${err.message}`)
          return {
            part_id: part.part_id,
            color_id: part.color_id,
            size: 0,
            hash: part.file_hash,
            status: 'error'
          }
        }
      })
      
      const results = await Promise.all(downloadPromises)
      const successCount = results.filter(r => r && r.status === 'downloaded').length
      const notRenderedCount = results.filter(r => r && r.status === 'not_rendered').length
      const errorCount = results.filter(r => r && r.status === 'error').length
      
      // 3. 벡터 메타데이터 다운로드 및 로컬 저장
      await downloadVectors(remoteData.version)
      
      // 4. 로컬 버전 업데이트
      await saveLocalVersion(remoteData)
      
      cacheState.syncStatus = 'ready'
      cacheState.lastSync = new Date()
      
      console.log(`✅ 증분 동기화 완료: ${successCount}개 다운로드, ${notRenderedCount}개 미렌더링, ${errorCount}개 오류`)
      
      return {
        success: successCount,
        notRendered: notRenderedCount,
        errors: errorCount,
        total: processedParts.length,
        version: remoteData.version
      }
      
    } catch (err) {
      cacheState.syncStatus = 'idle'
      console.error('❌ 증분 동기화 실패:', err)
      throw err
    }
  }

  // 벡터 메타데이터 다운로드 및 로컬 저장
  const downloadVectors = async (version) => {
    try {
      console.log('📊 실제 벡터 메타데이터 다운로드...')
      
      const { data: vectorsData, error: vectorsError } = await supabase
        .from('parts_master_features')
        .select('part_id, color_id, feature_json, clip_text_emb')
        .limit(10) // 최근 10개만
      
      if (vectorsError) {
        console.warn('벡터 데이터 조회 실패:', vectorsError.message)
        return
      }
      
      // 각 벡터를 로컬에 저장
      const savePromises = vectorsData.map(async (vector) => {
        const vectorData = {
          shape_vector: vector.feature_json?.shape_vector || null,
          color_lab: vector.feature_json?.color_lab || null,
          size_stud: vector.feature_json?.size_stud || null,
          clip_embedding: vector.clip_text_emb || null
        }
        
        return await saveVectorToLocal(vector.part_id, vector.color_id, vectorData)
      })
      
      const results = await Promise.all(savePromises)
      const successCount = results.filter(r => r === true).length
      
      console.log(`📊 벡터 메타데이터 로컬 저장: ${successCount}/${vectorsData.length}개 성공`)
      
    } catch (err) {
      console.warn('📊 벡터 다운로드 실패:', err.message)
    }
  }

  // 로컬 캐시에서 부품 검색 (실제 IndexedDB 검색)
  const searchLocalCache = async (partId, colorId) => {
    try {
      // 이미지 검색
      const imageResult = await getImageFromLocal(partId, colorId)
      
      if (imageResult.found) {
        return {
          found: true,
          image: imageResult.blob,
          size: imageResult.size,
          timestamp: imageResult.timestamp,
          cached: true
        }
      } else {
        return {
          found: false,
          cached: false
        }
      }
      
    } catch (err) {
      console.warn(`🔍 로컬 캐시 검색 실패: ${partId}/${colorId}`, err)
      return {
        found: false,
        cached: false
      }
    }
  }

  // 하이브리드 매칭 (로컬 우선, 원격 fallback)
  const hybridMatching = async (detections, setMetadata) => {
    try {
      console.log('🔄 하이브리드 매칭 시작...')
      
      const matches = []
      const missingSlots = []
      
      for (const detection of detections) {
        let bestMatch = null
        let bestScore = 0
        
        for (const part of setMetadata) {
          // 1. 로컬 캐시에서 검색
          const localResult = await searchLocalCache(part.part_id, part.color_id)
          
          if (localResult.found) {
            // 로컬에서 벡터 비교
            const score = await compareLocalVectors(detection, part)
            if (score > bestScore) {
              bestScore = score
              bestMatch = { ...part, score, source: 'local' }
            }
          } else {
            // 원격에서 벡터만 가져와서 비교 (이미지 다운로드 없음)
            const score = await compareRemoteVectors(detection, part)
            if (score > bestScore) {
              bestScore = score
              bestMatch = { ...part, score, source: 'remote' }
            }
          }
        }
        
        if (bestMatch && bestScore > 0.6) {
          matches.push(bestMatch)
        }
      }
      
      console.log(`🔄 하이브리드 매칭 완료: ${matches.length}개 매칭`)
      console.log(`📊 로컬 매칭: ${matches.filter(m => m.source === 'local').length}개`)
      console.log(`📊 원격 매칭: ${matches.filter(m => m.source === 'remote').length}개`)
      
      return { matches, missingSlots }
      
    } catch (err) {
      console.error('❌ 하이브리드 매칭 실패:', err)
      throw err
    }
  }

  // 로컬 벡터 비교 (실제 로컬 벡터 사용)
  const compareLocalVectors = async (detection, part) => {
    try {
    console.log(`🔍 로컬 벡터 비교: ${part.part_id}`)
      
      // 로컬에서 벡터 데이터 조회
      const vectorResult = await getVectorFromLocal(part.part_id, part.color_id)
      
      if (!vectorResult.found) {
        console.log(`❌ 로컬 벡터 없음: ${part.part_id}`)
        return 0.3 // 기본값
      }
      
      // 실제 벡터 유사도 계산
      const similarity = calculateVectorSimilarity(detection.features, {
        shape_vector: vectorResult.shape_vector,
        color_lab: vectorResult.color_lab,
        size_stud: vectorResult.size_stud
      })
      
      console.log(`📊 로컬 벡터 유사도: ${similarity.toFixed(3)}`)
      return similarity
      
    } catch (err) {
      console.warn(`로컬 벡터 비교 실패: ${part.part_id}`, err)
      return 0.3
    }
  }

  // 원격 벡터 비교 (Supabase에서 벡터만 조회)
  const compareRemoteVectors = async (detection, part) => {
    try {
      // Supabase에서 벡터 데이터만 조회
      const { data: vectorData, error: vectorError } = await supabase
        .from('parts_master_features')
        .select('feature_json, clip_text_emb')
        .eq('part_id', part.part_id)
        .eq('color_id', part.color_id)
        .single()
      
      if (vectorError || !vectorData) {
        return 0.2
      }
      
      // 벡터 유사도 계산
      const similarity = calculateVectorSimilarity(detection.features, {
        shape_vector: vectorData.feature_json?.shape_vector,
        color_lab: vectorData.feature_json?.color_lab,
        size_stud: vectorData.feature_json?.size_stud
      })
      
      return similarity
      
    } catch (err) {
      console.warn(`원격 벡터 비교 실패: ${part.part_id}`, err)
      return 0.2
    }
  }

  // 벡터 유사도 계산 함수
  const calculateVectorSimilarity = (detectedFeatures, partFeatures) => {
    if (!detectedFeatures || !partFeatures) return 0.3
    
    try {
      // 1. Shape 벡터 유사도 (cosine similarity)
      const shapeSim = calculateCosineSimilarity(
        detectedFeatures.shape_vector,
        partFeatures.shape_vector
      )
      
      // 2. 색상 유사도 (Lab ΔE)
      const colorSim = calculateColorSimilarity(
        detectedFeatures.color_lab,
        partFeatures.color_lab
      )
      
      // 3. 크기 유사도
      const sizeSim = calculateSizeSimilarity(
        detectedFeatures.size_stud,
        partFeatures.size_stud
      )
      
      // 4. 가중 평균
      const weights = { shape: 0.5, color: 0.3, size: 0.2 }
      const similarity = (
        shapeSim * weights.shape +
        colorSim * weights.color +
        sizeSim * weights.size
      )
      
      return Math.max(0, Math.min(1, similarity))
      
    } catch (err) {
      console.warn('벡터 유사도 계산 실패:', err)
      return 0.3
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
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)
    return magnitude > 0 ? dotProduct / magnitude : 0
  }

  // 색상 유사도 계산 (Lab ΔE)
  const calculateColorSimilarity = (lab1, lab2) => {
    if (!lab1 || !lab2) return 0.5
    
    const deltaE = Math.sqrt(
      Math.pow(lab1.L - lab2.L, 2) +
      Math.pow(lab1.a - lab2.a, 2) +
      Math.pow(lab1.b - lab2.b, 2)
    )
    
    return Math.max(0, 1 - (deltaE / 20))
  }

  // 크기 유사도 계산
  const calculateSizeSimilarity = (size1, size2) => {
    if (!size1 || !size2) return 0.5
    
    const ratio = Math.min(size1, size2) / Math.max(size1, size2)
    return ratio > 0.8 ? 1 : ratio
  }

  // 캐시 통계
  const getCacheStats = () => {
    return {
      localVersion: cacheState.localVersion,
      remoteVersion: cacheState.remoteVersion?.version || cacheState.remoteVersion,
      syncStatus: cacheState.syncStatus,
      lastSync: cacheState.lastSync,
      totalSize: cacheState.totalSize
    }
  }

  // 캐시 정리 (실제 IndexedDB 정리)
  const clearCache = async () => {
    try {
      console.log('🗑️ 캐시 정리 시작...')
      
      const db = await ensureDB()
      
      // 모든 저장소 정리
      const clearPromises = Object.values(STORES).map(storeName => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([storeName], 'readwrite')
          const store = transaction.objectStore(storeName)
          const request = store.clear()
          
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      })
      
      await Promise.all(clearPromises)
      
      // 상태 초기화
      cacheState.localVersion = null
      cacheState.totalSize = 0
      cacheState.lastSync = null
      cacheState.syncStatus = 'idle'
      
      console.log('✅ 캐시 정리 완료')
    } catch (err) {
      console.error('❌ 캐시 정리 실패:', err)
      throw err
    }
  }

  // 자동 동기화 (앱 시작 시)
  const autoSync = async () => {
    try {
      console.log('🔄 자동 동기화 시작...')
      
      const versionInfo = await checkVersion()
      
      if (versionInfo.needsUpdate) {
        console.log('📦 업데이트 필요, 증분 동기화 시작...')
        const result = await syncIncremental(versionInfo.remoteData)
        return result
      } else {
        console.log('✅ 최신 버전, 동기화 불필요')
        cacheState.syncStatus = 'ready'
        return null // 동기화 불필요
      }
      
    } catch (err) {
      console.error('❌ 자동 동기화 실패:', err)
      cacheState.syncStatus = 'idle'
      throw err
    }
  }

  return {
    loading,
    error,
    cacheState,
    checkVersion,
    syncIncremental,
    searchLocalCache,
    hybridMatching,
    getCacheStats,
    clearCache,
    autoSync,
    // 새로운 로컬 저장/로드 함수들
    saveImageToLocal,
    getImageFromLocal,
    saveVectorToLocal,
    getVectorFromLocal,
    saveLocalVersion,
    getLocalVersion,
    // 벡터 비교 함수들
    compareLocalVectors,
    compareRemoteVectors,
    calculateVectorSimilarity,
    // 로컬 캐시 검색 함수
    searchLocalCache
  }
}
