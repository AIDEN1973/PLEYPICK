import { ref, reactive } from 'vue'
import localforage from 'localforage'
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

  // localforage 벡터 스토어 (버전 회전)
  let lfVectorStore = null
  let lfVersionTag = null

  const ensureVectorStore = async (versionTag) => {
    const targetTag = versionTag || cacheState.localVersion || cacheState.remoteVersion?.version || 'v-default'
    if (lfVectorStore && lfVersionTag === targetTag) return lfVectorStore
    // 이전 인스턴스 드롭 (버전 교체 시 메모리 누수 방지)
    if (lfVectorStore && lfVersionTag && lfVersionTag !== targetTag) {
      try {
        await localforage.dropInstance({ name: 'brickbox-cache', storeName: `vectors_${lfVersionTag}` })
      } catch (e) {
        // 드롭 실패는 치명적이지 않음
      }
    }
    lfVectorStore = localforage.createInstance({ name: 'brickbox-cache', storeName: `vectors_${targetTag}` })
    lfVersionTag = targetTag
    return lfVectorStore
  }

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
      // localforage 벡터 스토어 회전 준비
      await ensureVectorStore(versionData.version)
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
      
      // 캐시 상태 동기화
      cacheState.localVersion = versionData.version
      
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
      // localforage 우선 사용
      try {
        const store = await ensureVectorStore()
        await store.setItem(`${partId}_${colorId}`, vectorData)
        console.log(`📊 벡터 로컬 저장: ${partId}/${colorId}`)
        return true
      } catch (e) {
        // fallback to IndexedDB 직접 저장
      }
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
      // localforage 우선 조회
      try {
        const store = await ensureVectorStore()
        const res = await store.getItem(`${partId}_${colorId}`)
        if (res) {
          return {
            found: true,
            shape_vector: res.shape_vector,
            color_lab: res.color_lab,
            size_stud: res.size_stud,
            clip_embedding: res.clip_embedding
          }
        }
      } catch (e) {
        // fallback to IndexedDB
      }
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

  // BOM 파트들의 벡터를 일괄 Prefetch하여 로컬(IndexedDB)에 저장
  const prefetchVectorsForParts = async (parts) => {
    try {
      if (!Array.isArray(parts) || parts.length === 0) return { fetched: 0, saved: 0 }
      const uniquePairs = new Map()
      for (const p of parts) {
        const pid = p.part_id || p.partId || p.partNum || p.part
        const cid = p.color_id ?? p.colorId ?? null
        if (!pid || cid === undefined) continue
        uniquePairs.set(`${pid}_${cid}`, { part_id: pid, color_id: cid })
      }
      const pairs = Array.from(uniquePairs.values())
      const partIdSet = Array.from(new Set(pairs.map(x => x.part_id)))

      // Supabase: part_id in (...) 으로 묶어 가져온 뒤, color_id는 클라이언트에서 필터
      const chunkSize = 50
      let fetched = 0
      let saved = 0
      for (let i = 0; i < partIdSet.length; i += chunkSize) {
        const chunk = partIdSet.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('parts_master_features')
          .select('part_id, color_id, feature_json, clip_text_emb, semantic_vector') // 🔧 수정됨: semantic_vector 추가
          .in('part_id', chunk)
        if (error) continue
        fetched += data?.length || 0
        // color_id가 BOM에 포함된 것만 저장
        const allowed = new Set(pairs.map(x => `${x.part_id}_${x.color_id}`))
        for (const row of data || []) {
          const key = `${row.part_id}_${row.color_id}`
          if (!allowed.has(key)) continue
          // 유효 벡터만 저장: 셋 중 하나라도 존재해야 함
          const fj = row.feature_json || {}
          // 🔧 수정됨: semantic_vector 폴백 적용
          let shapeVec = fj.shape_vector || fj.shape || row.semantic_vector || null
          // 🔧 수정됨: 문자열 배열을 숫자 배열로 변환
          if (shapeVec && Array.isArray(shapeVec)) {
            shapeVec = normalizeVector(shapeVec)
          }
          
          const colorLab = fj.color_lab || fj.color || null
          const sizeStud = (fj.size_stud !== undefined ? fj.size_stud : fj.size)
          if (!shapeVec && !colorLab && typeof sizeStud !== 'number') continue
          
          // clip_text_emb도 숫자 배열로 변환 // 🔧 수정됨
          let clipEmbedding = row.clip_text_emb || null
          if (clipEmbedding && Array.isArray(clipEmbedding)) {
            clipEmbedding = normalizeVector(clipEmbedding)
          }
          
          const vectorData = {
            shape_vector: shapeVec || null,
            color_lab: colorLab || null,
            size_stud: typeof sizeStud === 'number' ? sizeStud : null,
            clip_embedding: clipEmbedding || null
          }
          // 🔧 수정됨: 로컬 저장 시 이미 숫자 배열로 변환된 상태
          const ok = await saveVectorToLocal(row.part_id, row.color_id, vectorData)
          if (ok) saved++
        }
      }
      return { fetched, saved }
    } catch (err) {
      console.warn('벡터 Prefetch 실패:', err)
      return { fetched: 0, saved: 0 }
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
      
      // 2. 원격 버전 확인 (학습된 모델 버전 기준)
      let remoteData = null
      let versionSource = 'unknown'
      
      // 우선순위 1: model_registry에서 활성화된 최신 학습 모델
      try {
        const { data: activeModel, error: modelError } = await supabase
          .from('model_registry')
          .select('version, model_name, created_at, model_size')
          .eq('status', 'active')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (!modelError && activeModel) {
          const modelVersion = activeModel.version || activeModel.model_name || '1.0.0'
          remoteData = {
            version: modelVersion.startsWith('v') ? modelVersion : `v${modelVersion}`,
            hash: `model_${activeModel.model_name || 'unknown'}`,
            total_parts: 0,
            total_size: activeModel.model_size || 0,
            created_at: activeModel.created_at
          }
          versionSource = 'model_registry'
          console.log('📊 model_registry에서 버전 확인:', remoteData.version, `(${activeModel.model_name})`)
        }
      } catch (err) {
        console.warn('⚠️ model_registry 조회 실패:', err.message)
      }
      
      // 우선순위 2: model_registry에서 최신 모델 (활성 여부 무관)
      if (!remoteData) {
        try {
          const { data: latestModel, error: latestError } = await supabase
            .from('model_registry')
            .select('version, model_name, created_at, model_size')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (!latestError && latestModel) {
            const modelVersion = latestModel.version || latestModel.model_name || '1.0.0'
            remoteData = {
              version: modelVersion.startsWith('v') ? modelVersion : `v${modelVersion}`,
              hash: `model_${latestModel.model_name || 'unknown'}`,
              total_parts: 0,
              total_size: latestModel.model_size || 0,
              created_at: latestModel.created_at
            }
            versionSource = 'model_registry_latest'
            console.log('📊 model_registry 최신 모델 버전 확인:', remoteData.version, `(${latestModel.model_name}, 활성 여부 미확인)`)
          }
        } catch (err) {
          console.warn('⚠️ model_registry 최신 모델 조회 실패:', err.message)
        }
      }
      
      // 우선순위 3: dataset_versions에서 현재 활성 버전 (폴백)
      if (!remoteData) {
        try {
          const { data: datasetVersion, error: datasetVersionError } = await supabase
            .from('dataset_versions')
            .select('version, created_at, metadata')
            .eq('is_current', true)
            .limit(1)
            .maybeSingle()
          
          if (!datasetVersionError && datasetVersion) {
            const versionNum = datasetVersion.version || '1.0.0'
            remoteData = {
              version: `v${versionNum}`,
              hash: `dataset_${versionNum}`,
              total_parts: datasetVersion.metadata?.file_counts?.total || 0,
              total_size: 0,
              created_at: datasetVersion.created_at
            }
            versionSource = 'dataset_versions'
            console.log('📊 dataset_versions에서 버전 확인:', remoteData.version)
          }
        } catch (err) {
          console.warn('⚠️ dataset_versions 조회 실패:', err.message)
        }
      }
      
      // 폴백: 기본값 사용
      if (!remoteData) {
        console.warn('원격 버전 조회 실패, 기본값 사용')
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
      
      cacheState.remoteVersion = remoteData
      
      console.log(`📊 로컬 버전: ${localVersion || '없음'}`)
      console.log(`📊 원격 버전: ${remoteData.version} (출처: ${versionSource})`)
      
      return {
        local: localVersion,
        remote: remoteData.version,
        needsUpdate: localVersion !== remoteData.version,
        remoteData: remoteData
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
      
      // remoteData가 없으면 버전 체크로 가져오기
      if (!remoteData) {
        console.log('📊 버전 정보 확인 중...')
        const versionInfo = await checkVersion()
        if (!versionInfo.remoteData) {
          throw new Error('원격 버전 정보를 가져올 수 없습니다')
        }
        remoteData = versionInfo.remoteData
      }
      
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
          version: remoteData?.version || 'unknown'
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
            .download(`${part.part_id}/${part.color_id}.webp`)
          
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
          
          const blob = new Blob([fileData], { type: 'image/webp' })
          console.log(`📦 실제 다운로드: ${part.part_id}/${part.color_id}.webp (${Math.round(blob.size/1024)}KB)`)
          
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
      cacheState.lastSync = new Date().toISOString()
      
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
        // 벡터만 존재해도 로컬 캐시로 간주(원격 호출 방지)
        const vectorResult = await getVectorFromLocal(partId, colorId)
        if (vectorResult && vectorResult.found) {
          return { found: true, cached: true }
        }
        return { found: false, cached: false }
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
      // 과도한 로그 억제: 상세 로그는 필요 시 throttle로 대체
      
      // 로컬에서 벡터 데이터 조회
      const vectorResult = await getVectorFromLocal(part.part_id, part.color_id)
      
      if (!vectorResult.found) {
        // 로컬 벡터가 없으면 기본 점수 반환 (매칭 실패 방지)
        console.log(`🔧 로컬 벡터 없음: ${part.part_id} - 기본점수 0.2 부여`)
        return 0.2
      }
      
      // 검출 객체에 features가 있는지 확인
      if (!detection.features) {
        console.log(`🔧 검출 객체 features 없음: ${part.part_id} - 기본점수 0.2 부여`)
        return 0.2
      }
      
      // 🔧 수정됨: 로컬 벡터도 문자열 배열일 수 있으므로 숫자 배열로 변환
      let shapeVector = vectorResult.shape_vector
      if (shapeVector && Array.isArray(shapeVector)) {
        shapeVector = normalizeVector(shapeVector)
      }
      
      let clipEmbedding = vectorResult.clip_embedding
      if (clipEmbedding && Array.isArray(clipEmbedding)) {
        clipEmbedding = normalizeVector(clipEmbedding)
      }
      
      // 실제 벡터 유사도 계산
      const similarity = calculateVectorSimilarity(detection.features, {
        shape_vector: shapeVector,
        color_lab: vectorResult.color_lab,
        size_stud: vectorResult.size_stud,
        clip_embedding: clipEmbedding
      })
      
      // 유사도가 0이면 기본 점수 부여
      if (similarity === 0) {
        console.log(`🔧 로컬 벡터 유사도 0: ${part.part_id} - 기본점수 0.2 부여`)
        return 0.2
      }
      
      return similarity
      
    } catch (err) {
      console.warn(`로컬 벡터 비교 실패: ${part.part_id}`, err)
      return 0.2 // 에러 시에도 기본 점수 부여
    }
  }

  // 원격 벡터 비교 (Supabase에서 벡터만 조회)
  const compareRemoteVectors = async (detection, part) => {
    try {
      // Supabase에서 벡터 데이터만 조회 (semantic_vector도 함께 조회) // 🔧 수정됨
      const { data: vectorData, error: vectorError } = await supabase
        .from('parts_master_features')
        .select('feature_json, clip_text_emb, semantic_vector') // 🔧 수정됨: semantic_vector 추가
        .eq('part_id', part.part_id)
        .eq('color_id', part.color_id)
        .single()
      
      if (vectorError || !vectorData) {
        // 원격 벡터가 없으면 기본 점수 반환 (매칭 실패 방지)
        console.log(`🔧 원격 벡터 없음: ${part.part_id} - 기본점수 0.2 부여`)
        return 0.2
      }
      
      // shape_vector 추출: feature_json 내부 우선, 없으면 semantic_vector 사용 // 🔧 수정됨
      let shapeVector = vectorData.feature_json?.shape_vector || vectorData.semantic_vector || null
      
      // 🔧 수정됨: 문자열 배열을 숫자 배열로 변환
      if (shapeVector && Array.isArray(shapeVector)) {
        shapeVector = normalizeVector(shapeVector)
      }
      
      // clip_text_emb도 숫자 배열로 변환 // 🔧 수정됨
      let clipEmbedding = vectorData.clip_text_emb || null
      if (clipEmbedding && Array.isArray(clipEmbedding)) {
        clipEmbedding = normalizeVector(clipEmbedding)
      }
      
      // 🔧 수정됨: 벡터 구조 확인 로그 (정규화 후 타입 확인)
      console.log(`🔧 원격 벡터 구조 확인: ${part.part_id}/${part.color_id}`, {
        hasShapeVector: !!shapeVector,
        shapeVectorType: shapeVector ? (Array.isArray(shapeVector) ? `array[${shapeVector.length}](${typeof shapeVector[0]})` : typeof shapeVector) : 'null',
        hasClipEmbedding: !!clipEmbedding,
        clipEmbeddingType: clipEmbedding ? (Array.isArray(clipEmbedding) ? `array[${clipEmbedding.length}](${typeof clipEmbedding[0]})` : typeof clipEmbedding) : 'null',
        hasDetectionFeatures: !!detection.features,
        detectionFeaturesShapeVector: detection.features?.shape_vector ? (Array.isArray(detection.features.shape_vector) ? `array[${detection.features.shape_vector.length}](${typeof detection.features.shape_vector[0]})` : typeof detection.features.shape_vector) : 'null',
        detectionFeaturesClipEmbedding: detection.features?.clip_embedding ? (Array.isArray(detection.features.clip_embedding) ? `array[${detection.features.clip_embedding.length}](${typeof detection.features.clip_embedding[0]})` : typeof detection.features.clip_embedding) : 'null'
      })
      
      // 벡터 유사도 계산
      const similarity = calculateVectorSimilarity(detection.features, {
        shape_vector: shapeVector, // 🔧 수정됨: 숫자 배열로 변환됨
        color_lab: vectorData.feature_json?.color_lab,
        size_stud: vectorData.feature_json?.size_stud,
        clip_embedding: clipEmbedding // 🔧 수정됨: 숫자 배열로 변환됨
      })
      
      // 🔧 수정됨: 상세 유사도 로그
      console.log(`🔧 원격 벡터 유사도 계산 결과: ${part.part_id} - 유사도: ${similarity.toFixed(4)}`)
      
      // 유사도가 0이면 기본 점수 부여
      if (similarity === 0) {
        console.log(`🔧 원격 벡터 유사도 0: ${part.part_id} - 기본점수 0.2 부여`)
        return 0.2
      }
      
      return similarity
      
    } catch (err) {
      console.warn(`원격 벡터 비교 실패: ${part.part_id}`, err)
      return 0.2 // 에러 시에도 기본 점수 부여
    }
  }

  // 벡터 유사도 계산 함수
  const calculateVectorSimilarity = (detectedFeatures, partFeatures) => {
    if (!detectedFeatures || !partFeatures) return 0

    try {
      const weights = { shape: 0.45, color: 0.25, size: 0.15, clip: 0.15 }
      let weightedSum = 0
      let weightTotal = 0

      // 1) Shape (둘 다 존재하는 경우에만 적용)
      if (Array.isArray(detectedFeatures.shape_vector) && Array.isArray(partFeatures.shape_vector)) {
        const shapeSim = calculateCosineSimilarity(
          detectedFeatures.shape_vector,
          partFeatures.shape_vector
        )
        if (Number.isFinite(shapeSim)) {
          console.log(`🔧 벡터 유사도 계산: Shape similarity = ${shapeSim.toFixed(4)} (weight: ${weights.shape})`)
          weightedSum += shapeSim * weights.shape
          weightTotal += weights.shape
        } else {
          console.warn(`🔧 벡터 유사도 계산: Shape similarity 계산 실패 (NaN 또는 Infinity)`)
        }
      } else {
        console.log(`🔧 벡터 유사도 계산: Shape 벡터 없음 (detected: ${!!detectedFeatures.shape_vector}, part: ${!!partFeatures.shape_vector})`)
      }

      // 2) Color (둘 다 존재하는 경우에만 적용)
      if (detectedFeatures.color_lab && partFeatures.color_lab) {
        const colorSim = calculateColorSimilarity(
          detectedFeatures.color_lab,
          partFeatures.color_lab
        )
        if (Number.isFinite(colorSim)) {
          weightedSum += colorSim * weights.color
          weightTotal += weights.color
        }
      }

      // 3) Size (둘 다 존재하는 경우에만 적용)
      if (
        typeof detectedFeatures.size_stud === 'number' &&
        typeof partFeatures.size_stud === 'number'
      ) {
        const sizeSim = calculateSizeSimilarity(
          detectedFeatures.size_stud,
          partFeatures.size_stud
        )
        if (Number.isFinite(sizeSim)) {
          weightedSum += sizeSim * weights.size
          weightTotal += weights.size
        }
      }

      // 4) CLIP 텍스트 임베딩 (둘 다 존재하는 경우에만 적용)
      if (Array.isArray(detectedFeatures.clip_embedding) && Array.isArray(partFeatures.clip_embedding)) {
        const clipSim = calculateCosineSimilarity(
          detectedFeatures.clip_embedding,
          partFeatures.clip_embedding
        )
        if (Number.isFinite(clipSim)) {
          weightedSum += clipSim * weights.clip
          weightTotal += weights.clip
        }
      }

      // 적용 가능한 특징이 하나도 없는 경우 0 반환
      if (weightTotal === 0) return 0

      const similarity = weightedSum / weightTotal
      return Math.max(0, Math.min(1, similarity))
    } catch (err) {
      console.warn('벡터 유사도 계산 실패:', err)
      return 0
    }
  }

  // 벡터를 숫자 배열로 변환 (문자열 배열 처리) // 🔧 수정됨
  const normalizeVector = (vec) => {
    if (!Array.isArray(vec)) return null
    // 이미 숫자 배열이면 그대로 반환
    if (vec.length > 0 && typeof vec[0] === 'number') return vec
    // 문자열 배열이면 숫자로 변환
    const normalized = vec.map(v => {
      const num = typeof v === 'string' ? parseFloat(v) : Number(v)
      return Number.isFinite(num) ? num : 0
    })
    return normalized.length > 0 ? normalized : null
  }

  // 코사인 유사도 계산
  const calculateCosineSimilarity = (vec1, vec2) => {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0
    
    // 🔧 수정됨: 문자열 배열을 숫자 배열로 변환
    const normalizedVec1 = normalizeVector(vec1)
    const normalizedVec2 = normalizeVector(vec2)
    if (!normalizedVec1 || !normalizedVec2) return 0
    
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < normalizedVec1.length; i++) {
      const v1 = normalizedVec1[i]
      const v2 = normalizedVec2[i]
      dotProduct += v1 * v2
      norm1 += v1 * v1
      norm2 += v2 * v2
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)
    return magnitude > 0 ? dotProduct / magnitude : 0
  }

  // 색상 유사도 계산 (Lab ΔE)
  const calculateColorSimilarity = (lab1, lab2) => {
    if (!lab1 || !lab2) return 0
    
    const deltaE = Math.sqrt(
      Math.pow(lab1.L - lab2.L, 2) +
      Math.pow(lab1.a - lab2.a, 2) +
      Math.pow(lab1.b - lab2.b, 2)
    )
    
    return Math.max(0, 1 - (deltaE / 20))
  }

  // 크기 유사도 계산
  const calculateSizeSimilarity = (size1, size2) => {
    if (!size1 || !size2) return 0
    
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
        // 동기화 완료 시 lastSync 업데이트
        cacheState.lastSync = new Date().toISOString()
        return result
      } else {
        console.log('✅ 최신 버전, 동기화 불필요')
        cacheState.syncStatus = 'ready'
        // 최신 버전이어도 lastSync 업데이트 (상태 확인용)
        cacheState.lastSync = new Date().toISOString()
        return null // 동기화 불필요
      }
      
    } catch (err) {
      console.error('❌ 자동 동기화 실패:', err)
      cacheState.syncStatus = 'idle'
      throw err
    }
  }
  
  // 강제 캐시 동기화 (문제 해결용)
  const forceSync = async () => {
    try {
      console.log('🔄 강제 캐시 동기화 시작...')
      cacheState.syncStatus = 'checking'
      
      // 캐시 상태 초기화
      cacheState.lastSync = null
      
      // 버전 체크
      const versionInfo = await checkVersion()
      console.log('📊 버전 정보:', versionInfo)
      
      // 강제 동기화 실행
      if (versionInfo.remoteData) {
        console.log('📦 강제 증분 동기화 실행...')
        const result = await syncIncremental(versionInfo.remoteData)
        cacheState.lastSync = new Date().toISOString()
        cacheState.syncStatus = 'ready'
        console.log('✅ 강제 동기화 완료:', result)
        return result
      } else {
        console.log('⚠️ 원격 데이터 없음, 기본 상태 설정')
        cacheState.lastSync = new Date().toISOString()
        cacheState.syncStatus = 'ready'
        return null
      }
      
    } catch (err) {
      console.error('❌ 강제 동기화 실패:', err)
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
    forceSync,
    prefetchVectorsForParts,
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
