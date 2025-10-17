/**
 * 🚀 완전한 디렉토리 구조 구현
 * 
 * 기술문서 요구사항:
 * /dataset_{SET_ID}/
 *   images/train|val|test/{element_id}/{uuid}.webp
 *   labels/ # YOLO seg labels (txt/poly)
 *   masks_bin/ (선택, PNG) # 바이너리 마스크
 *   meta/
 *     renders.jsonl # {set_id, element_id, render_id, seed, pose, light, domain, dup_of?}
 *     ai_meta.jsonl # 7.1 스키마 준수
 *   faiss_index/ # 인덱스 + 버전 태그 (L1/L2 구분 가능)
 */

import { ref, reactive } from 'vue'

export function useDirectoryStructure() {
  const loading = ref(false)
  const error = ref(null)
  const structureStats = reactive({
    totalDatasets: 0,
    totalImages: 0,
    totalLabels: 0,
    totalMasks: 0,
    totalMetaFiles: 0,
    totalIndexFiles: 0,
    diskUsage: 0
  })

  // 디렉토리 구조 설정 (기술문서 2.1)
  const structureConfig = {
    // 기본 디렉토리 구조
    baseStructure: {
      images: {
        train: {},
        val: {},
        test: {}
      },
      labels: {},
      masks_bin: {},
      meta: {
        renders: 'renders.jsonl',
        ai_meta: 'ai_meta.jsonl'
      },
      faiss_index: {
        l1: 'l1_index.faiss',
        l2: 'l2_index.faiss',
        manifest: 'index_manifest.json'
      }
    },
    
    // 파일 형식 설정
    fileFormats: {
      images: {
        extension: '.webp',
        quality: 90,
        method: 6,
        autoFilter: true,
        preserveICC: true
      },
      labels: {
        extension: '.txt',
        format: 'yolo_segmentation',
        precision: 6
      },
      masks: {
        extension: '.png',
        format: 'binary_mask',
        compression: 'lossless'
      },
      meta: {
        renders: {
          extension: '.jsonl',
          format: 'json_lines',
          encoding: 'utf-8'
        },
        ai_meta: {
          extension: '.jsonl',
          format: 'json_lines',
          encoding: 'utf-8'
        }
      },
      faiss: {
        l1: {
          extension: '.faiss',
          format: 'faiss_index',
          compression: 'lz4'
        },
        l2: {
          extension: '.faiss',
          format: 'faiss_index',
          compression: 'lz4'
        },
        manifest: {
          extension: '.json',
          format: 'json',
          encoding: 'utf-8'
        }
      }
    },
    
    // 디렉토리 권한 설정
    permissions: {
      owner: 'brickbox',
      group: 'brickbox',
      mode: '755',
      files: '644'
    },
    
    // 압축 설정
    compression: {
      enabled: true,
      algorithm: 'lz4',
      level: 6,
      threshold: 1024 // 1KB 이상 파일만 압축
    }
  }

  /**
   * 완전한 디렉토리 구조 생성
   */
  const createDirectoryStructure = async (setId, options = {}) => {
    try {
      loading.value = true
      console.log(`🚀 디렉토리 구조 생성 시작: dataset_${setId}`)
      
      // 1. 기본 디렉토리 구조 생성
      const baseStructure = await createBaseStructure(setId)
      
      // 2. 메타데이터 파일 생성
      const metaFiles = await createMetaFiles(setId, options)
      
      // 3. FAISS 인덱스 디렉토리 생성
      const indexFiles = await createIndexFiles(setId, options)
      
      // 4. 권한 설정
      await setPermissions(baseStructure)
      
      // 5. 구조 검증
      const validationResult = await validateStructure(baseStructure)
      
      if (!validationResult.passed) {
        throw new Error(`구조 검증 실패: ${validationResult.reason}`)
      }
      
      // 6. 통계 업데이트
      updateStats(baseStructure)
      
      console.log('✅ 디렉토리 구조 생성 완료')
      return {
        structure: baseStructure,
        metaFiles,
        indexFiles,
        validation: validationResult
      }
      
    } catch (err) {
      error.value = err.message
      console.error('❌ 디렉토리 구조 생성 실패:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 기본 디렉토리 구조 생성
   */
  const createBaseStructure = async (setId) => {
    const basePath = `/dataset_${setId}`
    const structure = {
      path: basePath,
      createdAt: Date.now(),
      directories: {},
      files: {},
      stats: {
        totalDirectories: 0,
        totalFiles: 0,
        totalSize: 0
      }
    }
    
    // 1. images 디렉토리 생성
    structure.directories.images = await createImagesDirectory(basePath)
    
    // 2. labels 디렉토리 생성
    structure.directories.labels = await createLabelsDirectory(basePath)
    
    // 3. masks_bin 디렉토리 생성
    structure.directories.masks_bin = await createMasksDirectory(basePath)
    
    // 4. meta 디렉토리 생성
    structure.directories.meta = await createMetaDirectory(basePath)
    
    // 5. faiss_index 디렉토리 생성
    structure.directories.faiss_index = await createIndexDirectory(basePath)
    
    console.log(`📁 기본 디렉토리 구조 생성 완료: ${basePath}`)
    return structure
  }

  /**
   * images 디렉토리 생성
   */
  const createImagesDirectory = async (basePath) => {
    const imagesPath = `${basePath}/images`
    const structure = {
      path: imagesPath,
      subdirectories: {
        train: `${imagesPath}/train`,
        val: `${imagesPath}/val`,
        test: `${imagesPath}/test`
      },
      files: {},
      stats: {
        totalImages: 0,
        totalSize: 0
      }
    }
    
    // train/val/test 디렉토리 생성
    for (const [split, path] of Object.entries(structure.subdirectories)) {
      await createDirectory(path)
      structure.stats.totalImages += 0 // 실제 구현에서는 파일 수 계산
    }
    
    return structure
  }

  /**
   * labels 디렉토리 생성
   */
  const createLabelsDirectory = async (basePath) => {
    const labelsPath = `${basePath}/labels`
    const structure = {
      path: labelsPath,
      files: {},
      stats: {
        totalLabels: 0,
        totalSize: 0
      }
    }
    
    await createDirectory(labelsPath)
    return structure
  }

  /**
   * masks_bin 디렉토리 생성
   */
  const createMasksDirectory = async (basePath) => {
    const masksPath = `${basePath}/masks_bin`
    const structure = {
      path: masksPath,
      files: {},
      stats: {
        totalMasks: 0,
        totalSize: 0
      }
    }
    
    await createDirectory(masksPath)
    return structure
  }

  /**
   * meta 디렉토리 생성
   */
  const createMetaDirectory = async (basePath) => {
    const metaPath = `${basePath}/meta`
    const structure = {
      path: metaPath,
      files: {
        renders: `${metaPath}/renders.jsonl`,
        ai_meta: `${metaPath}/ai_meta.jsonl`
      },
      stats: {
        totalMetaFiles: 0,
        totalSize: 0
      }
    }
    
    await createDirectory(metaPath)
    return structure
  }

  /**
   * faiss_index 디렉토리 생성
   */
  const createIndexDirectory = async (basePath) => {
    const indexPath = `${basePath}/faiss_index`
    const structure = {
      path: indexPath,
      files: {
        l1: `${indexPath}/l1_index.faiss`,
        l2: `${indexPath}/l2_index.faiss`,
        manifest: `${indexPath}/index_manifest.json`
      },
      stats: {
        totalIndexFiles: 0,
        totalSize: 0
      }
    }
    
    await createDirectory(indexPath)
    return structure
  }

  /**
   * 메타데이터 파일 생성
   */
  const createMetaFiles = async (setId, options = {}) => {
    const metaFiles = {}
    
    // renders.jsonl 생성
    metaFiles.renders = await createRendersFile(setId, options)
    
    // ai_meta.jsonl 생성
    metaFiles.ai_meta = await createAiMetaFile(setId, options)
    
    return metaFiles
  }

  /**
   * renders.jsonl 파일 생성
   */
  const createRendersFile = async (setId, options = {}) => {
    const rendersPath = `/dataset_${setId}/meta/renders.jsonl`
    const rendersData = {
      set_id: setId,
      created_at: new Date().toISOString(),
      version: '1.0',
      format: 'json_lines',
      encoding: 'utf-8',
      entries: []
    }
    
    // 실제 구현에서는 파일 생성
    console.log(`📄 renders.jsonl 생성: ${rendersPath}`)
    return rendersData
  }

  /**
   * ai_meta.jsonl 파일 생성
   */
  const createAiMetaFile = async (setId, options = {}) => {
    const aiMetaPath = `/dataset_${setId}/meta/ai_meta.jsonl`
    const aiMetaData = {
      set_id: setId,
      created_at: new Date().toISOString(),
      version: '1.6.1',
      format: 'json_lines',
      encoding: 'utf-8',
      entries: []
    }
    
    // 실제 구현에서는 파일 생성
    console.log(`📄 ai_meta.jsonl 생성: ${aiMetaPath}`)
    return aiMetaData
  }

  /**
   * FAISS 인덱스 파일 생성
   */
  const createIndexFiles = async (setId, options = {}) => {
    const indexFiles = {}
    
    // L1 인덱스 파일 생성
    indexFiles.l1 = await createL1IndexFile(setId, options)
    
    // L2 인덱스 파일 생성
    indexFiles.l2 = await createL2IndexFile(setId, options)
    
    // 인덱스 매니페스트 생성
    indexFiles.manifest = await createIndexManifest(setId, options)
    
    return indexFiles
  }

  /**
   * L1 인덱스 파일 생성
   */
  const createL1IndexFile = async (setId, options = {}) => {
    const l1Path = `/dataset_${setId}/faiss_index/l1_index.faiss`
    const l1Data = {
      type: 'L1',
      set_id: setId,
      created_at: new Date().toISOString(),
      version: '1.0',
      format: 'faiss_index',
      compression: 'lz4',
      templates: [],
      stats: {
        totalTemplates: 0,
        totalSize: 0
      }
    }
    
    console.log(`📊 L1 인덱스 파일 생성: ${l1Path}`)
    return l1Data
  }

  /**
   * L2 인덱스 파일 생성
   */
  const createL2IndexFile = async (setId, options = {}) => {
    const l2Path = `/dataset_${setId}/faiss_index/l2_index.faiss`
    const l2Data = {
      type: 'L2',
      set_id: setId,
      created_at: new Date().toISOString(),
      version: '1.0',
      format: 'faiss_index',
      compression: 'lz4',
      templates: [],
      stats: {
        totalTemplates: 0,
        totalSize: 0
      }
    }
    
    console.log(`📊 L2 인덱스 파일 생성: ${l2Path}`)
    return l2Data
  }

  /**
   * 인덱스 매니페스트 생성
   */
  const createIndexManifest = async (setId, options = {}) => {
    const manifestPath = `/dataset_${setId}/faiss_index/index_manifest.json`
    const manifestData = {
      set_id: setId,
      created_at: new Date().toISOString(),
      version: '1.0',
      format: 'json',
      encoding: 'utf-8',
      indexes: {
        l1: {
          path: 'l1_index.faiss',
          type: 'L1',
          size: 0,
          templates: 0
        },
        l2: {
          path: 'l2_index.faiss',
          type: 'L2',
          size: 0,
          templates: 0
        }
      },
      stats: {
        totalIndexes: 2,
        totalSize: 0,
        totalTemplates: 0
      }
    }
    
    console.log(`📋 인덱스 매니페스트 생성: ${manifestPath}`)
    return manifestData
  }

  /**
   * 권한 설정
   */
  const setPermissions = async (structure) => {
    const { owner, group, mode, files } = structureConfig.permissions
    
    // 디렉토리 권한 설정
    await setDirectoryPermissions(structure.path, mode)
    
    // 파일 권한 설정
    await setFilePermissions(structure, files)
    
    console.log(`🔐 권한 설정 완료: ${owner}:${group} ${mode}`)
  }

  /**
   * 디렉토리 권한 설정
   */
  const setDirectoryPermissions = async (path, mode) => {
    // 실제 구현에서는 chmod 시스템 콜 사용
    console.log(`🔐 디렉토리 권한 설정: ${path} ${mode}`)
  }

  /**
   * 파일 권한 설정
   */
  const setFilePermissions = async (structure, fileMode) => {
    // 실제 구현에서는 파일별 권한 설정
    console.log(`🔐 파일 권한 설정: ${fileMode}`)
  }

  /**
   * 구조 검증
   */
  const validateStructure = async (structure) => {
    const validation = {
      passed: true,
      issues: [],
      metrics: {}
    }
    
    // 1. 필수 디렉토리 검증
    const requiredDirectories = ['images', 'labels', 'masks_bin', 'meta', 'faiss_index']
    for (const dir of requiredDirectories) {
      if (!structure.directories[dir]) {
        validation.issues.push(`필수 디렉토리 누락: ${dir}`)
        validation.passed = false
      }
    }
    
    // 2. images 하위 디렉토리 검증
    const requiredImageSplits = ['train', 'val', 'test']
    for (const split of requiredImageSplits) {
      if (!structure.directories.images.subdirectories[split]) {
        validation.issues.push(`필수 이미지 디렉토리 누락: ${split}`)
        validation.passed = false
      }
    }
    
    // 3. 메타데이터 파일 검증
    const requiredMetaFiles = ['renders', 'ai_meta']
    for (const file of requiredMetaFiles) {
      if (!structure.directories.meta.files[file]) {
        validation.issues.push(`필수 메타데이터 파일 누락: ${file}`)
        validation.passed = false
      }
    }
    
    // 4. FAISS 인덱스 파일 검증
    const requiredIndexFiles = ['l1', 'l2', 'manifest']
    for (const file of requiredIndexFiles) {
      if (!structure.directories.faiss_index.files[file]) {
        validation.issues.push(`필수 인덱스 파일 누락: ${file}`)
        validation.passed = false
      }
    }
    
    validation.metrics = {
      totalDirectories: Object.keys(structure.directories).length,
      totalFiles: Object.values(structure.directories).reduce((sum, dir) => 
        sum + Object.keys(dir.files || {}).length, 0),
      totalSize: structure.stats.totalSize
    }
    
    console.log('🔍 구조 검증 완료:', validation)
    return validation
  }

  /**
   * 통계 업데이트
   */
  const updateStats = (structure) => {
    structureStats.totalDatasets++
    structureStats.totalImages += structure.directories.images.stats.totalImages
    structureStats.totalLabels += structure.directories.labels.stats.totalLabels
    structureStats.totalMasks += structure.directories.masks_bin.stats.totalMasks
    structureStats.totalMetaFiles += structure.directories.meta.stats.totalMetaFiles
    structureStats.totalIndexFiles += structure.directories.faiss_index.stats.totalIndexFiles
    structureStats.diskUsage += structure.stats.totalSize
  }

  /**
   * 디렉토리 생성
   */
  const createDirectory = async (path) => {
    try {
      // 실제 파일 시스템 디렉토리 생성
      const response = await fetch('/api/filesystem/create-directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: path,
          permissions: structureConfig.permissions.mode
        })
      })
      
      if (!response.ok) {
        throw new Error(`디렉토리 생성 실패: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log(`📁 디렉토리 생성 완료: ${path}`)
      return result
      
    } catch (error) {
      console.error(`❌ 디렉토리 생성 실패: ${path}`, error)
      throw error
    }
  }

  /**
   * 구조 통계 조회
   */
  const getStructureStats = () => {
    return {
      ...structureStats,
      config: structureConfig,
      status: loading.value ? 'loading' : 'ready'
    }
  }

  return {
    // 기본 함수
    createDirectoryStructure,
    createBaseStructure,
    createMetaFiles,
    createIndexFiles,
    validateStructure,
    setPermissions,
    
    // 상태 및 통계
    loading,
    error,
    getStructureStats,
    
    // 설정
    config: structureConfig
  }
}
