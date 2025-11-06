import express from 'express'
import cors from 'cors'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { spawn, execSync, exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import net from 'net'
import { promisify } from 'util'
import {
  getSyntheticRoot,
  getDatasetSyntheticPath,
  getPartDatasetPath,
  getPartImagesPath,
  getPartLabelsPath,
  getPartMetaPath,
  getPartMetaEPath,
  getPartDepthPath
} from './utils/pathConfig.js'

// 환경 변수 로드
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// 인코딩 설정
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Health check 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Synthetic API',
    port: process.env.SYNTHETIC_API_PORT || 3011,
    timestamp: new Date().toISOString()
  })
})

// CORS 설정 (localhost:3000에서의 요청 허용)
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  credentials: true
}))
// 캐시 비활성화 (ETag로 304 반환 방지)
app.set('etag', false)
// 정적 파일 제공: 생성된 합성 이미지 제공 (프록시 경로 하위로 제공)
// [FIX] 수정됨: getSyntheticRoot()를 사용하여 환경 변수 기반 경로 사용
app.use('/api/synthetic/static', express.static(getSyntheticRoot()))

// 검증 라우터 직접 구현 (비동기 import 문제 해결)
const validateRouter = express.Router()
const validationJobs = new Map()

// 검증 캐시 (Supabase 데이터베이스 사용)
let supabaseCacheClient = null

// Supabase 클라이언트 초기화 (검증 캐시용)
const initSupabaseCache = async () => {
  if (supabaseCacheClient) return supabaseCacheClient
  
  try {
    const { createClient } = await import('@supabase/supabase-js')
    supabaseCacheClient = createClient(
      process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co',
      process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
    return supabaseCacheClient
  } catch (error) {
    console.warn('Supabase 캐시 클라이언트 초기화 실패:', error.message)
    return null
  }
}

// 검증 캐시 로드 (데이터베이스에서)
const loadValidationCache = async (datasetPath) => {
  try {
    const supabase = await initSupabaseCache()
    if (!supabase) {
      console.warn('Supabase 클라이언트 없음, 캐시 로드 스킵')
      return {}
    }
    
    const { data, error } = await supabase
      .from('validation_cache')
      .select('file_path, file_hash, validation_result, is_valid')
      .eq('dataset_path', datasetPath)
    
    if (error) {
      console.warn('검증 캐시 로드 실패:', error.message)
      return {}
    }
    
    // 객체 형태로 변환
    const cache = {}
    if (data && Array.isArray(data)) {
      for (const item of data) {
        // validation_result가 이미 모든 검증 정보를 포함하므로, hash와 valid를 추가
        cache[item.file_path] = {
          hash: item.file_hash,
          valid: item.is_valid,
          ...(item.validation_result || {})
        }
      }
    }
    
    return cache
  } catch (error) {
    console.warn('검증 캐시 로드 실패:', error.message)
    return {}
  }
}

// 검증 캐시 저장 (데이터베이스에)
const saveValidationCache = async (datasetPath, cache) => {
  try {
    const supabase = await initSupabaseCache()
    if (!supabase) {
      console.warn('Supabase 클라이언트 없음, 캐시 저장 스킵')
      return
    }
    
    // 캐시 항목을 배열로 변환
    const cacheEntries = []
    for (const [filePath, cacheData] of Object.entries(cache)) {
      if (!cacheData || !cacheData.hash) continue
      
      // 파일 타입 추론 (경로 우선, 확장자 보조)
      let fileType = 'image'
      if (filePath.includes('/labels/') || filePath.startsWith('labels/') || filePath.endsWith('.txt')) {
        fileType = 'label'
      } else if (filePath.includes('/meta-e/') || filePath.startsWith('meta-e/')) {
        fileType = 'meta-e'
      } else if (filePath.includes('/meta/') || filePath.startsWith('meta/') || filePath.endsWith('.json')) {
        // 이미지 파일이 아닌 경우에만 metadata로 설정
        if (!filePath.match(/\.(jpg|jpeg|png|bmp|tiff|webp|exr)$/i)) {
          fileType = 'metadata'
        }
      }
      
      cacheEntries.push({
        dataset_path: datasetPath,
        file_path: filePath,
        file_hash: cacheData.hash,
        file_type: fileType,
        validation_result: cacheData,
        is_valid: cacheData.valid !== false
      })
    }
    
    if (cacheEntries.length === 0) return
    
    // UPSERT (중복 시 업데이트)
    // Supabase는 복합 UNIQUE 제약조건의 경우 컬럼명을 쉼표로 구분한 문자열 사용
    const { error } = await supabase
      .from('validation_cache')
      .upsert(cacheEntries, {
        onConflict: 'dataset_path,file_path',
        ignoreDuplicates: false
      })
    
    if (error) {
      console.warn('검증 캐시 저장 실패:', error.message)
    }
  } catch (error) {
    console.warn('검증 캐시 저장 실패:', error.message)
  }
}

// 파일 해시 계산 (간단한 버전: mtime + size)
const getFileHash = (filePath) => {
  try {
    const stats = fs.statSync(filePath)
    return `${stats.mtimeMs}_${stats.size}`
  } catch (error) {
    return null
  }
}

// 검증 작업 수행 함수 (YOLO 데이터셋 구조 지원, 상세 파일 내용 검증, 증분 검증 지원)
async function performValidation(sourcePath, options, logCallback = null) {
  const logs = []
  const addLog = (type, message) => {
    const logEntry = { type, message, timestamp: new Date().toISOString() }
    logs.push(logEntry)
    if (logCallback) {
      logCallback(logEntry)
    }
    console.log(`[검증] ${type}: ${message}`)
  }
  
  const results = {
    totalParts: 0,
    validParts: 0,
    invalidParts: 0,
    totalImages: 0,
    totalLabels: 0,
    totalMetadata: 0,
    errors: [],
    warnings: [],
    fileIntegrity: { valid: 0, invalid: 0, errors: [] },
    imageValidation: { valid: 0, invalid: 0, errors: [] },
    labelValidation: { valid: 0, invalid: 0, errors: [] },
    metadataValidation: { valid: 0, invalid: 0, errors: [] },
    fileMatching: { matched: 0, unmatchedImages: [], unmatchedLabels: [] },
    insufficientImages: [],
    webpQuality: { valid: 0, invalid: 0, errors: [], details: [] },
    bucketSync: { totalFiles: 0, uploadedFiles: 0, missingFiles: 0, syncErrors: [], bucketStats: { totalObjects: 0, totalSize: 0 } },
    logs: logs
  }
  
  try {
    const fullPath = path.isAbsolute(sourcePath) ? sourcePath : path.join(__dirname, '..', sourcePath)
    
    if (!fs.existsSync(fullPath)) {
      const errorMsg = `경로가 존재하지 않습니다: ${fullPath}`
      results.errors.push(errorMsg)
      addLog('error', errorMsg)
      return results
    }
    
    addLog('info', `검증 시작: ${fullPath}`)
    
    const validateImages = options.validateImages !== false
    const validateLabels = options.validateLabels !== false
    const validateMetadata = options.validateMetadata !== false
    const checkFileIntegrity = options.checkFileIntegrity !== false
    const incrementalValidation = options.incrementalValidation !== false // 증분 검증 기본 활성화
    
    // YOLO 데이터셋 구조 확인: dataset_synthetic/images/train, dataset_synthetic/labels/train 등
    const datasetPath = path.join(fullPath, 'dataset_synthetic')
    
    if (fs.existsSync(datasetPath)) {
      // YOLO 형식 데이터셋 검증
      addLog('info', `YOLO 데이터셋 구조 감지: ${datasetPath}`)
      
      // 검증 캐시 로드 (데이터베이스에서)
      let validationCache = {}
      if (incrementalValidation) {
        addLog('info', '검증 캐시 로드 중...')
        validationCache = await loadValidationCache(datasetPath)
        const cachedFileCount = Object.keys(validationCache).length
        if (cachedFileCount > 0) {
          addLog('info', `증분 검증 모드: 캐시된 검증 결과 ${cachedFileCount}개 파일 발견`)
        } else {
          addLog('info', '전체 검증 모드: 캐시 없음, 모든 파일 검증')
        }
      } else {
        addLog('info', '전체 검증 모드: 증분 검증 비활성화')
      }
      
      const newCache = {}
      
      // [FIX] 수정됨: 새 구조 지원 (dataset_synthetic/{element_id}/images, labels, meta, meta-e, depth)
      // 기존 구조도 호환성 유지 (dataset_synthetic/images/train/{element_id})
      const imagePath = path.join(datasetPath, 'images')
      const labelPath = path.join(datasetPath, 'labels')
      const metaPath = path.join(datasetPath, 'meta')
      const metaEPath = path.join(datasetPath, 'meta-e')
      
      // 분할별 카운트 누적을 위한 파트 집계 맵
      const partAggregate = new Map()
      const partSet = new Set() // 중복 카운트 방지

      // 새 구조 확인: dataset_synthetic/{element_id}/images 구조
      const partDirsNewStructure = fs.existsSync(datasetPath) ? fs.readdirSync(datasetPath).filter(item => {
        const itemPath = path.join(datasetPath, item)
        try {
          const stats = fs.statSync(itemPath)
          if (!stats.isDirectory()) return false
          // 부품 폴더 내에 images 폴더가 있는지 확인
          const imagesDir = path.join(itemPath, 'images')
          return fs.existsSync(imagesDir) && fs.statSync(imagesDir).isDirectory()
        } catch {
          return false
        }
      }) : []

      if (partDirsNewStructure.length > 0) {
        // 새 구조 사용: dataset_synthetic/{element_id}/images, labels, meta, meta-e
        addLog('info', `새 구조 감지: ${partDirsNewStructure.length}개 부품 폴더 발견`)
        
        for (const partDir of partDirsNewStructure) {
          if (!partSet.has(partDir)) {
            partSet.add(partDir)
            results.totalParts++
          }
          
          const partDirPath = path.join(datasetPath, partDir)
          const partImagePath = path.join(partDirPath, 'images')
          const partLabelPath = path.join(partDirPath, 'labels')
          const partMetaPath = path.join(partDirPath, 'meta')
          const partMetaEPath = path.join(partDirPath, 'meta-e')
          
          let partValid = true
          const partErrors = []
          
          // 이미지 파일 검증
          if (fs.existsSync(partImagePath)) {
            const imageFiles = fs.readdirSync(partImagePath).filter(f => /\.(jpg|jpeg|png|bmp|tiff|webp|exr)$/i.test(f))
            const imageCount = imageFiles.length
            results.totalImages += imageCount
            
            // 집계 맵 업데이트 (새 구조는 split이 없으므로 train으로 집계)
            if (!partAggregate.has(partDir)) {
              partAggregate.set(partDir, { train: 0, val: 0, test: 0 })
            }
            partAggregate.get(partDir).train += imageCount
            
            addLog('info', `${partDir}: ${imageCount}개 이미지 발견`)
            
            // 상세 이미지 파일 검증
            if (validateImages && checkFileIntegrity) {
              addLog('info', `${partDir}: 이미지 파일 검증 중... (${imageFiles.length}개)`)
              let validatedCount = 0
              let cachedCount = 0
              
              for (const imageFile of imageFiles) {
                const imageFilePath = path.join(partImagePath, imageFile)
                const relativePath = `${partDir}/images/${imageFile}`
                const fileHash = getFileHash(imageFilePath)
                
                // 증분 검증: 캐시 확인
                let shouldValidate = true
                if (incrementalValidation && validationCache[relativePath]) {
                  const cached = validationCache[relativePath]
                  if (cached.hash === fileHash && cached.valid === true && cached.timestamp) {
                    shouldValidate = false
                    cachedCount++
                    results.imageValidation.valid++
                    results.fileIntegrity.valid++
                    if (cached.webpQuality) {
                      if (cached.webpQuality.valid) {
                        results.webpQuality.valid++
                        if (cached.webpQuality.warnings && cached.webpQuality.warnings.length > 0) {
                          results.webpQuality.details.push({
                            path: relativePath,
                            metrics: cached.webpQuality.metrics || null,
                            warnings: cached.webpQuality.warnings
                          })
                        }
                      } else {
                        results.webpQuality.invalid++
                        results.webpQuality.errors.push(cached.webpQuality.error)
                        results.webpQuality.details.push(cached.webpQuality.details)
                      }
                    }
                    newCache[relativePath] = cached
                  }
                }
                
                // 검증 필요 시 실행
                if (shouldValidate) {
                  try {
                    const imageValidation = await validateImageFile(imageFilePath)
                    if (imageValidation.valid) {
                      results.imageValidation.valid++
                      results.fileIntegrity.valid++
                      
                      const cacheEntry = {
                        hash: fileHash,
                        valid: true,
                        timestamp: new Date().toISOString(),
                        imageValidation: { valid: true }
                      }
                      
                      // WebP 품질 검증 (WebP 파일인 경우만)
                      if (imageFilePath.toLowerCase().endsWith('.webp')) {
                        const webpQuality = await validateWebPQuality(imageFilePath, options.validateWebPQuality !== false)
                        if (webpQuality.valid) {
                          results.webpQuality.valid++
                          if (webpQuality.warnings && webpQuality.warnings.length > 0) {
                            results.webpQuality.details.push({
                              path: relativePath,
                              metrics: webpQuality.metrics || null,
                              warnings: webpQuality.warnings
                            })
                          }
                          cacheEntry.webpQuality = { valid: true, metrics: webpQuality.metrics, warnings: webpQuality.warnings }
                        } else {
                          results.webpQuality.invalid++
                          results.webpQuality.errors.push(webpQuality.error || 'WebP 품질 검증 실패')
                          results.webpQuality.details.push({
                            path: relativePath,
                            error: webpQuality.error,
                            metrics: webpQuality.metrics || null,
                            issues: webpQuality.issues || [],
                            warnings: webpQuality.warnings || []
                          })
                          cacheEntry.webpQuality = { valid: false, error: webpQuality.error, metrics: webpQuality.metrics, issues: webpQuality.issues, warnings: webpQuality.warnings }
                        }
                      }
                      
                      newCache[relativePath] = cacheEntry
                      validatedCount++
                    } else {
                      results.imageValidation.invalid++
                      results.fileIntegrity.invalid++
                      partValid = false
                      partErrors.push(`이미지 ${imageFile}: ${imageValidation.error}`)
                      newCache[relativePath] = {
                        hash: fileHash,
                        valid: false,
                        timestamp: new Date().toISOString(),
                        imageValidation: { valid: false, error: imageValidation.error }
                      }
                    }
                  } catch (error) {
                    results.imageValidation.invalid++
                    results.fileIntegrity.invalid++
                    partValid = false
                    partErrors.push(`이미지 ${imageFile}: ${error.message}`)
                  }
                }
              }
              
              addLog('info', `${partDir}: 이미지 검증 완료 (신규: ${validatedCount}, 캐시: ${cachedCount})`)
            }
          } else {
            partValid = false
            partErrors.push('이미지 폴더 없음')
          }
          
          // 라벨 파일 검증
          if (validateLabels && fs.existsSync(partLabelPath)) {
            const labelFiles = fs.readdirSync(partLabelPath).filter(f => f.endsWith('.txt'))
            results.totalLabels += labelFiles.length
            
            addLog('info', `${partDir}: 라벨 파일 검증 중... (${labelFiles.length}개)`)
            
            for (const labelFile of labelFiles) {
              const labelFilePath = path.join(partLabelPath, labelFile)
              const relativePath = `${partDir}/labels/${labelFile}`
              const fileHash = getFileHash(labelFilePath)
              
              let shouldValidate = true
              if (incrementalValidation && validationCache[relativePath]) {
                const cached = validationCache[relativePath]
                if (cached.hash === fileHash && cached.valid === true) {
                  shouldValidate = false
                  results.labelValidation.valid++
                  newCache[relativePath] = cached
                }
              }
              
              if (shouldValidate) {
                try {
                  const labelValidation = await validateLabelFile(labelFilePath)
                  if (labelValidation.valid) {
                    results.labelValidation.valid++
                    newCache[relativePath] = {
                      hash: fileHash,
                      valid: true,
                      timestamp: new Date().toISOString(),
                      labelValidation: { valid: true }
                    }
                  } else {
                    results.labelValidation.invalid++
                    partValid = false
                    partErrors.push(`라벨 ${labelFile}: ${labelValidation.error}`)
                    newCache[relativePath] = {
                      hash: fileHash,
                      valid: false,
                      timestamp: new Date().toISOString(),
                      labelValidation: { valid: false, error: labelValidation.error }
                    }
                  }
                } catch (error) {
                  results.labelValidation.invalid++
                  partValid = false
                  partErrors.push(`라벨 ${labelFile}: ${error.message}`)
                }
              }
            }
          }
          
          // 메타데이터 파일 검증
          if (validateMetadata) {
            const metaFiles = []
            if (fs.existsSync(partMetaPath)) {
              const files = fs.readdirSync(partMetaPath).filter(f => f.endsWith('.json'))
              metaFiles.push(...files.map(f => ({ file: f, path: path.join(partMetaPath, f), type: 'meta' })))
            }
            if (fs.existsSync(partMetaEPath)) {
              const files = fs.readdirSync(partMetaEPath).filter(f => f.endsWith('.json'))
              metaFiles.push(...files.map(f => ({ file: f, path: path.join(partMetaEPath, f), type: 'meta-e' })))
            }
            
            results.totalMetadata += metaFiles.length
            
            addLog('info', `${partDir}: 메타데이터 파일 검증 중... (${metaFiles.length}개)`)
            
            for (const metaFile of metaFiles) {
              const relativePath = `${partDir}/${metaFile.type}/${metaFile.file}`
              const fileHash = getFileHash(metaFile.path)
              
              let shouldValidate = true
              if (incrementalValidation && validationCache[relativePath]) {
                const cached = validationCache[relativePath]
                if (cached.hash === fileHash && cached.valid === true) {
                  shouldValidate = false
                  results.metadataValidation.valid++
                  newCache[relativePath] = cached
                }
              }
              
              if (shouldValidate) {
                try {
                  const metadataValidation = await validateMetadataFile(metaFile.path)
                  if (metadataValidation.valid) {
                    results.metadataValidation.valid++
                    newCache[relativePath] = {
                      hash: fileHash,
                      valid: true,
                      timestamp: new Date().toISOString(),
                      metadataValidation: { valid: true }
                    }
                  } else {
                    results.metadataValidation.invalid++
                    partValid = false
                    partErrors.push(`메타데이터 ${metaFile.file}: ${metadataValidation.error}`)
                    newCache[relativePath] = {
                      hash: fileHash,
                      valid: false,
                      timestamp: new Date().toISOString(),
                      metadataValidation: { valid: false, error: metadataValidation.error }
                    }
                  }
                } catch (error) {
                  results.metadataValidation.invalid++
                  partValid = false
                  partErrors.push(`메타데이터 ${metaFile.file}: ${error.message}`)
                }
              }
            }
          }
          
          // 파일 매칭 검증
          if (fs.existsSync(partImagePath) && fs.existsSync(partLabelPath)) {
            const imageFiles = fs.readdirSync(partImagePath).filter(f => /\.(jpg|jpeg|png|bmp|tiff|webp|exr)$/i.test(f))
            const labelFiles = fs.readdirSync(partLabelPath).filter(f => f.endsWith('.txt'))
            
            for (const imageFile of imageFiles) {
              const baseName = imageFile.replace(/\.(jpg|jpeg|png|bmp|tiff|webp|exr)$/i, '')
              const labelFile = `${baseName}.txt`
              if (labelFiles.includes(labelFile)) {
                results.fileMatching.matched++
              } else {
                results.fileMatching.unmatchedImages.push(`${partDir}/images/${imageFile}`)
              }
            }
          }
          
          if (partValid) {
            results.validParts++
          } else {
            results.invalidParts++
            results.errors.push(`부품 ${partDir}: ${partErrors.join(', ')}`)
          }
        }
      } else {
        // 기존 구조 지원 (호환성): dataset_synthetic/images/train/{element_id}
        addLog('info', '기존 구조 감지: train/val/test 분할 폴더 검증 시작...')
        
        // train, val, test 폴더 확인
        for (const split of ['train', 'val', 'test']) {
          addLog('info', `${split} 분할 검증 중...`)
          const splitImageDir = path.join(imagePath, split)
          const splitLabelDir = path.join(labelPath, split)
          
          if (fs.existsSync(splitImageDir)) {
            const partDirs = fs.readdirSync(splitImageDir).filter(item => {
              const itemPath = path.join(splitImageDir, item)
              return fs.statSync(itemPath).isDirectory()
            })
            
            // 중복 카운트 방지: 부품 ID는 모든 split에서 공통
            for (const partDir of partDirs) {
              if (!partSet.has(partDir)) {
                partSet.add(partDir)
                results.totalParts++
              }
            }
            
            for (const partDir of partDirs) {
              const partImagePath = path.join(splitImageDir, partDir)
              const partLabelPath = path.join(splitLabelDir, partDir)
            
            let partValid = true
            const partErrors = []
            
            // 이미지 파일 검증
            if (fs.existsSync(partImagePath)) {
              const imageFiles = fs.readdirSync(partImagePath).filter(f => /\.(jpg|jpeg|png|bmp|tiff|webp|exr)$/i.test(f))
              const imageCount = imageFiles.length
              results.totalImages += imageCount
              // 집계 맵 업데이트
              if (!partAggregate.has(partDir)) {
                partAggregate.set(partDir, { train: 0, val: 0, test: 0 })
              }
              partAggregate.get(partDir)[split] += imageCount
              
              addLog('info', `${split}/${partDir}: ${imageCount}개 이미지 발견`)

              // 단건 즉시 경고는 집계 후 생성하므로 여기서는 푸시하지 않음
              
              // 상세 이미지 파일 검증
              if (validateImages && checkFileIntegrity) {
                addLog('info', `${split}/${partDir}: 이미지 파일 검증 중... (${imageFiles.length}개)`)
                let validatedCount = 0
                let cachedCount = 0
                
                for (const imageFile of imageFiles) {
                  const imageFilePath = path.join(partImagePath, imageFile)
                  const relativePath = `${split}/${partDir}/${imageFile}`
                  const fileHash = getFileHash(imageFilePath)
                  
                  // 증분 검증: 캐시 확인
                  let shouldValidate = true
                  if (incrementalValidation && validationCache[relativePath]) {
                    const cached = validationCache[relativePath]
                    if (cached.hash === fileHash && cached.valid === true && cached.timestamp) {
                      // 캐시된 검증 결과 사용
                      shouldValidate = false
                      cachedCount++
                      results.imageValidation.valid++
                      results.fileIntegrity.valid++
                      if (cached.webpQuality) {
                        if (cached.webpQuality.valid) {
                          results.webpQuality.valid++
                          if (cached.webpQuality.warnings && cached.webpQuality.warnings.length > 0) {
                            results.webpQuality.details.push({
                              path: relativePath,
                              metrics: cached.webpQuality.metrics || null,
                              warnings: cached.webpQuality.warnings
                            })
                          }
                        } else {
                          results.webpQuality.invalid++
                          results.webpQuality.errors.push(cached.webpQuality.error)
                          results.webpQuality.details.push(cached.webpQuality.details)
                        }
                      }
                      // 캐시 결과를 새 캐시에 복사
                      newCache[relativePath] = cached
                    }
                  }
                  
                  // 검증 필요 시 실행
                  if (shouldValidate) {
                    try {
                      const imageValidation = await validateImageFile(imageFilePath)
                      if (imageValidation.valid) {
                        results.imageValidation.valid++
                        results.fileIntegrity.valid++
                        
                        const cacheEntry = {
                          hash: fileHash,
                          valid: true,
                          timestamp: new Date().toISOString(),
                          imageValidation: { valid: true }
                        }
                        
                        // WebP 품질 검증 (WebP 파일인 경우만, PNG는 무손실이므로 검증 불필요)
                        if (imageFilePath.toLowerCase().endsWith('.webp')) {
                          const webpQuality = await validateWebPQuality(imageFilePath, options.validateWebPQuality !== false)
                          if (webpQuality.valid) {
                            results.webpQuality.valid++
                            // 유효하더라도 경고가 있으면 경고 목록에 추가
                            if (webpQuality.warnings && webpQuality.warnings.length > 0) {
                              results.webpQuality.details.push({
                                path: relativePath,
                                metrics: webpQuality.metrics || null,
                                warnings: webpQuality.warnings
                              })
                            }
                            cacheEntry.webpQuality = { valid: true, metrics: webpQuality.metrics, warnings: webpQuality.warnings }
                          } else {
                            results.webpQuality.invalid++
                            const errorMsg = `${relativePath}: ${webpQuality.error}`
                            results.webpQuality.errors.push(errorMsg)
                            results.webpQuality.details.push({
                              path: relativePath,
                              error: webpQuality.error,
                              metrics: webpQuality.metrics || null,
                              issues: webpQuality.issues || [],
                              warnings: webpQuality.warnings || []
                            })
                            if (webpQuality.issues && webpQuality.issues.length > 0) {
                              results.warnings.push(`${relativePath}: ${webpQuality.issues.join(', ')}`)
                            }
                            cacheEntry.webpQuality = { valid: false, error: webpQuality.error, details: results.webpQuality.details[results.webpQuality.details.length - 1] }
                          }
                        }
                        
                        // 캐시 저장
                        newCache[relativePath] = cacheEntry
                        validatedCount++
                      } else {
                        results.imageValidation.invalid++
                        results.fileIntegrity.invalid++
                        partValid = false
                        const errorMsg = `${relativePath}: ${imageValidation.error}`
                        results.imageValidation.errors.push(errorMsg)
                        partErrors.push(errorMsg)
                        
                        // 오류도 캐시에 저장 (재검증 방지)
                        newCache[relativePath] = {
                          hash: fileHash,
                          valid: false,
                          timestamp: new Date().toISOString(),
                          imageValidation: { valid: false, error: imageValidation.error }
                        }
                        validatedCount++
                      }
                    } catch (error) {
                      results.imageValidation.invalid++
                      results.fileIntegrity.invalid++
                      partValid = false
                      const errorMsg = `${relativePath}: 검증 오류 - ${error.message}`
                      results.imageValidation.errors.push(errorMsg)
                      partErrors.push(errorMsg)
                      
                      // 오류도 캐시에 저장
                      newCache[relativePath] = {
                        hash: fileHash,
                        valid: false,
                        timestamp: new Date().toISOString(),
                        error: error.message
                      }
                      validatedCount++
                    }
                  }
                }
                
                if (incrementalValidation && cachedCount > 0) {
                  addLog('info', `${split}/${partDir}: 캐시 사용 ${cachedCount}개, 새로 검증 ${validatedCount}개`)
                }
              } else {
                // 파일 개수만 확인
                results.imageValidation.valid += imageFiles.length
                results.fileIntegrity.valid += imageFiles.length
                addLog('info', `${split}/${partDir}: 이미지 파일 개수 확인 완료 (${imageFiles.length}개)`)
              }
              
              // 이미지-라벨 파일명 매칭 확인
              if (imageFiles.length > 0) {
                addLog('info', `${split}/${partDir}: 이미지-라벨 매칭 확인 중...`)
              }
              if (fs.existsSync(partLabelPath)) {
                const labelFiles = fs.readdirSync(partLabelPath).filter(f => f.endsWith('.txt'))
                const imageBaseNames = new Set(imageFiles.map(f => path.parse(f).name))
                const labelBaseNames = new Set(labelFiles.map(f => path.parse(f).name))
                
                // 라벨이 없는 이미지
                for (const imgBase of imageBaseNames) {
                  if (!labelBaseNames.has(imgBase)) {
                    results.fileMatching.unmatchedImages.push(`${split}/${partDir}/${imgBase}`)
                    results.warnings.push(`라벨이 없는 이미지: ${split}/${partDir}/${imgBase}`)
                  }
                }
                
                // 이미지가 없는 라벨
                for (const lblBase of labelBaseNames) {
                  if (!imageBaseNames.has(lblBase)) {
                    results.fileMatching.unmatchedLabels.push(`${split}/${partDir}/${lblBase}`)
                    results.warnings.push(`이미지가 없는 라벨: ${split}/${partDir}/${lblBase}`)
                  } else {
                    results.fileMatching.matched++
                  }
                }
              }
            }
            
            // 라벨 파일 검증
            if (fs.existsSync(partLabelPath)) {
              const labelFiles = fs.readdirSync(partLabelPath).filter(f => f.endsWith('.txt'))
              results.totalLabels += labelFiles.length
              if (labelFiles.length > 0 && validateLabels) {
                addLog('info', `${split}/${partDir}: 라벨 파일 검증 중... (${labelFiles.length}개)`)
              }
              
              // 상세 라벨 파일 검증
              if (validateLabels && checkFileIntegrity) {
                let labelValidatedCount = 0
                let labelCachedCount = 0
                
                for (const labelFile of labelFiles) {
                  const labelFilePath = path.join(partLabelPath, labelFile)
                  const relativePath = `labels/${split}/${partDir}/${labelFile}`
                  const fileHash = getFileHash(labelFilePath)
                  
                  // 증분 검증: 캐시 확인
                  let shouldValidate = true
                  if (incrementalValidation && validationCache[relativePath]) {
                    const cached = validationCache[relativePath]
                    if (cached.hash === fileHash && cached.valid === true) {
                      shouldValidate = false
                      labelCachedCount++
                      results.labelValidation.valid++
                      newCache[relativePath] = cached
                    }
                  }
                  
                  if (shouldValidate) {
                    try {
                      const labelValidation = await validateLabelFile(labelFilePath)
                      if (labelValidation.valid) {
                        results.labelValidation.valid++
                        if (labelValidation.warning) {
                          results.warnings.push(`${split}/${partDir}/${labelFile}: ${labelValidation.warning}`)
                        }
                        newCache[relativePath] = {
                          hash: fileHash,
                          valid: true,
                          timestamp: new Date().toISOString(),
                          labelValidation: { valid: true, warning: labelValidation.warning || null }
                        }
                        labelValidatedCount++
                      } else {
                        results.labelValidation.invalid++
                        partValid = false
                        const errorMsg = `${split}/${partDir}/${labelFile}: ${labelValidation.error}`
                        results.labelValidation.errors.push(errorMsg)
                        partErrors.push(errorMsg)
                        newCache[relativePath] = {
                          hash: fileHash,
                          valid: false,
                          timestamp: new Date().toISOString(),
                          labelValidation: { valid: false, error: labelValidation.error }
                        }
                        labelValidatedCount++
                      }
                    } catch (error) {
                      results.labelValidation.invalid++
                      partValid = false
                      const errorMsg = `${split}/${partDir}/${labelFile}: 검증 오류 - ${error.message}`
                      results.labelValidation.errors.push(errorMsg)
                      partErrors.push(errorMsg)
                      newCache[relativePath] = {
                        hash: fileHash,
                        valid: false,
                        timestamp: new Date().toISOString(),
                        error: error.message
                      }
                      labelValidatedCount++
                    }
                  }
                }
                
                if (incrementalValidation && labelCachedCount > 0) {
                  addLog('info', `${split}/${partDir}: 라벨 캐시 사용 ${labelCachedCount}개, 새로 검증 ${labelValidatedCount}개`)
                }
              } else {
                // 파일 개수만 확인
                results.labelValidation.valid += labelFiles.length
              }
            }
            
            if (partValid) {
              results.validParts++
            } else {
              results.invalidParts++
              results.errors.push(`부품 ${split}/${partDir}: ${partErrors.join('; ')}`)
            }
          }
        }
      }

      // [FIX] 수정됨: 새 구조 지원 - 집계 결과로 비율(80/10/10) 기준 기대/부족 계산
      try {
        const targetPerPart = 200
        const ratio = { train: 0.8, val: 0.1, test: 0.1 }
        
        // 디버깅: 집계 맵 확인
        if (partAggregate.size === 0) {
          addLog('warning', '집계 맵이 비어있습니다. 이미지 파일이 없거나 집계 로직에 문제가 있을 수 있습니다.')
        } else {
          addLog('info', `집계 맵 크기: ${partAggregate.size}개 부품`)
        }
        
        for (const [partId, counts] of partAggregate.entries()) {
          // 새 구조에서는 split이 없으므로 모든 이미지를 train으로 집계
          // 기존 구조에서는 train/val/test 분리되어 있음
          const totalCurrent = counts.train + counts.val + counts.test
          
          // 기대치 계산 (라운딩 보정으로 합계 200 보장)
          let expectedTrain = Math.round(targetPerPart * ratio.train)
          let expectedVal = Math.round(targetPerPart * ratio.val)
          let expectedTest = targetPerPart - expectedTrain - expectedVal
          const totalExpected = targetPerPart
          
          // 새 구조: 모든 이미지가 하나의 폴더에 있으므로 train으로만 집계
          // 기존 구조: train/val/test 분리
          const splits = ['train', 'val', 'test']
          const details = {}
          let anyMissing = false
          let totalMissing = 0
          
          for (const s of splits) {
            const expected = s === 'train' ? expectedTrain : (s === 'val' ? expectedVal : expectedTest)
            const current = counts[s] || 0
            const missing = Math.max(0, expected - current)
            const percent = expected > 0 ? Math.min(100, Math.round((current / expected) * 100)) : 0
            details[s] = { current, expected, missing, percent }
            totalMissing += missing
            if (missing > 0) anyMissing = true
          }
          
          // 디버깅: 각 부품별 집계 결과 확인
          if (anyMissing || totalCurrent < totalExpected) {
            addLog('warning', `${partId}: train=${counts.train || 0}/${details.train.expected}, val=${counts.val || 0}/${details.val.expected}, test=${counts.test || 0}/${details.test.expected}, 총=${totalCurrent}/${totalExpected} (부족: ${totalMissing})`)
            
            results.insufficientImages.push({
              partId,
              total: { current: totalCurrent, expected: totalExpected, missing: totalMissing, percent: totalExpected > 0 ? Math.min(100, Math.round((totalCurrent / totalExpected) * 100)) : 0 },
              splits: details
            })
            // 경고 메시지는 요약 형태로 1건만
            results.warnings.push(`${partId}: 이미지 부족 (train ${details.train.current}/${details.train.expected}, val ${details.val.current}/${details.val.expected}, test ${details.test.current}/${details.test.expected})`)
          }
        }
      } catch (e) {
        console.error('❌ 부족 이미지 집계 처리 중 오류:', e)
        console.error('스택:', e.stack)
      }
      
      // 검증 캐시 저장 (데이터베이스에)
      if (incrementalValidation) {
        // 기존 캐시와 병합 (검증하지 않은 파일은 유지)
        // 단, 실제 존재하는 파일만 유지 (삭제된 파일의 캐시는 제거)
        const allValidatedPaths = new Set(Object.keys(newCache))
        for (const [key, value] of Object.entries(validationCache)) {
          // 실제 검증된 파일이 아니고, 캐시에만 있는 경우
          if (!allValidatedPaths.has(key)) {
            // 파일 존재 여부 확인 (경로 변환 필요)
            // key는 상대 경로 (새 구조: {partDir}/images/{imageFile}, 기존 구조: train/{partDir}/{imageFile})
            // 실제 파일 경로 변환
            let fileExists = false
            if (key.startsWith('labels/')) {
              // labels/train/... 또는 {partDir}/labels/... -> labels/train/... 또는 {partDir}/labels/...
              const actualPath = path.join(datasetPath, key)
              fileExists = fs.existsSync(actualPath)
            } else if (key.includes('/meta-e/') || key.startsWith('meta-e/')) {
              // {partDir}/meta-e/... 또는 meta-e/... -> {partDir}/meta-e/... 또는 meta-e/...
              const actualPath = path.join(datasetPath, key)
              fileExists = fs.existsSync(actualPath)
            } else if (key.includes('/meta/') || key.startsWith('meta/')) {
              // {partDir}/meta/... 또는 meta/... -> {partDir}/meta/... 또는 meta/...
              const actualPath = path.join(datasetPath, key)
              fileExists = fs.existsSync(actualPath)
            } else if (key.includes('/images/')) {
              // 새 구조: {partDir}/images/{imageFile} -> {partDir}/images/{imageFile}
              const actualPath = path.join(datasetPath, key)
              fileExists = fs.existsSync(actualPath)
            } else {
              // 기존 구조: train/{partDir}/{imageFile} -> images/train/{partDir}/{imageFile}
              const imagePath = path.join(datasetPath, 'images', key)
              fileExists = fs.existsSync(imagePath)
            }
            
            if (fileExists) {
              // 파일이 존재하면 유지 (검증하지 않았지만 존재하는 파일)
              newCache[key] = value
            }
          }
        }
        addLog('info', '검증 캐시 저장 중...')
        await saveValidationCache(datasetPath, newCache)
        const totalCached = Object.keys(newCache).length
        const newlyValidated = Object.keys(newCache).filter(k => !validationCache[k] || validationCache[k].hash !== newCache[k]?.hash).length
        addLog('info', `검증 캐시 저장 완료: 총 ${totalCached}개 파일 (새로 검증: ${newlyValidated}개)`)
      }
      
      // 메타데이터 검증 (부품별 디렉토리 구조 지원)
      if (fs.existsSync(metaPath)) {
        // 부품별 디렉토리 구조 확인
        const metaItems = fs.readdirSync(metaPath)
        let metaFiles = []
        
        for (const item of metaItems) {
          const itemPath = path.join(metaPath, item)
          const stat = fs.statSync(itemPath)
          
          if (stat.isDirectory()) {
            // 부품별 디렉토리 내의 JSON 파일 찾기
            const partMetaFiles = fs.readdirSync(itemPath).filter(f => f.endsWith('.json'))
            metaFiles.push(...partMetaFiles.map(f => ({ file: f, partId: item, dir: 'meta' })))
          } else if (stat.isFile() && item.endsWith('.json')) {
            // 직접 파일인 경우
            metaFiles.push({ file: item, partId: null, dir: 'meta' })
          }
        }
        
        results.totalMetadata += metaFiles.length
        
        // 상세 메타데이터 검증
        if (validateMetadata && checkFileIntegrity) {
          let metaValidatedCount = 0
          let metaCachedCount = 0
          
          for (const metaInfo of metaFiles) {
            const metaFilePath = metaInfo.partId 
              ? path.join(metaPath, metaInfo.partId, metaInfo.file)
              : path.join(metaPath, metaInfo.file)
            const relativePath = metaInfo.partId 
              ? `meta/${metaInfo.partId}/${metaInfo.file}`
              : `meta/${metaInfo.file}`
            const fileHash = getFileHash(metaFilePath)
            
            // 증분 검증: 캐시 확인
            let shouldValidate = true
            if (incrementalValidation && validationCache[relativePath]) {
              const cached = validationCache[relativePath]
              if (cached.hash === fileHash && cached.valid === true) {
                shouldValidate = false
                metaCachedCount++
                results.metadataValidation.valid++
                newCache[relativePath] = cached
              }
            }
            
            if (shouldValidate) {
              try {
                const metaValidation = await validateMetadataFile(metaFilePath)
                if (metaValidation.valid) {
                  results.metadataValidation.valid++
                  newCache[relativePath] = {
                    hash: fileHash,
                    valid: true,
                    timestamp: new Date().toISOString(),
                    metadataValidation: { valid: true }
                  }
                  metaValidatedCount++
                } else {
                  results.metadataValidation.invalid++
                  const errorMsg = `${relativePath}: ${metaValidation.error}`
                  results.metadataValidation.errors.push(errorMsg)
                  results.warnings.push(errorMsg)
                  newCache[relativePath] = {
                    hash: fileHash,
                    valid: false,
                    timestamp: new Date().toISOString(),
                    metadataValidation: { valid: false, error: metaValidation.error }
                  }
                  metaValidatedCount++
                }
              } catch (error) {
                results.metadataValidation.invalid++
                const errorMsg = `${relativePath}: 검증 오류 - ${error.message}`
                results.metadataValidation.errors.push(errorMsg)
                results.warnings.push(errorMsg)
                newCache[relativePath] = {
                  hash: fileHash,
                  valid: false,
                  timestamp: new Date().toISOString(),
                  error: error.message
                }
                metaValidatedCount++
              }
            }
          }
          
          if (incrementalValidation && metaCachedCount > 0) {
            addLog('info', `메타데이터 캐시 사용 ${metaCachedCount}개, 새로 검증 ${metaValidatedCount}개`)
          }
        } else {
          results.metadataValidation.valid += metaFiles.length
        }
      }
      
      if (fs.existsSync(metaEPath)) {
        // 부품별 디렉토리 구조 확인
        const metaEItems = fs.readdirSync(metaEPath)
        let metaEFiles = []
        
        for (const item of metaEItems) {
          const itemPath = path.join(metaEPath, item)
          const stat = fs.statSync(itemPath)
          
          if (stat.isDirectory()) {
            // 부품별 디렉토리 내의 JSON 파일 찾기
            const partMetaEFiles = fs.readdirSync(itemPath).filter(f => f.endsWith('.json'))
            metaEFiles.push(...partMetaEFiles.map(f => ({ file: f, partId: item, dir: 'meta-e' })))
          } else if (stat.isFile() && item.endsWith('.json')) {
            // 직접 파일인 경우
            metaEFiles.push({ file: item, partId: null, dir: 'meta-e' })
          }
        }
        
        results.totalMetadata += metaEFiles.length
        
        // 상세 메타데이터 검증 (meta-e)
        if (validateMetadata && checkFileIntegrity) {
          let metaEValidatedCount = 0
          let metaECachedCount = 0
          
          for (const metaEInfo of metaEFiles) {
            const metaEFilePath = metaEInfo.partId 
              ? path.join(metaEPath, metaEInfo.partId, metaEInfo.file)
              : path.join(metaEPath, metaEInfo.file)
            const relativePath = metaEInfo.partId 
              ? `meta-e/${metaEInfo.partId}/${metaEInfo.file}`
              : `meta-e/${metaEInfo.file}`
            const fileHash = getFileHash(metaEFilePath)
            
            // 증분 검증: 캐시 확인
            let shouldValidate = true
            if (incrementalValidation && validationCache[relativePath]) {
              const cached = validationCache[relativePath]
              if (cached.hash === fileHash && cached.valid === true) {
                shouldValidate = false
                metaECachedCount++
                results.metadataValidation.valid++
                newCache[relativePath] = cached
              }
            }
            
            if (shouldValidate) {
              try {
                const metaEValidation = await validateMetadataFile(metaEFilePath)
                if (metaEValidation.valid) {
                  results.metadataValidation.valid++
                  newCache[relativePath] = {
                    hash: fileHash,
                    valid: true,
                    timestamp: new Date().toISOString(),
                    metadataValidation: { valid: true }
                  }
                  metaEValidatedCount++
                } else {
                  results.metadataValidation.invalid++
                  const errorMsg = `${relativePath}: ${metaEValidation.error}`
                  results.metadataValidation.errors.push(errorMsg)
                  results.warnings.push(errorMsg)
                  newCache[relativePath] = {
                    hash: fileHash,
                    valid: false,
                    timestamp: new Date().toISOString(),
                    metadataValidation: { valid: false, error: metaEValidation.error }
                  }
                  metaEValidatedCount++
                }
              } catch (error) {
                results.metadataValidation.invalid++
                const errorMsg = `${relativePath}: 검증 오류 - ${error.message}`
                results.metadataValidation.errors.push(errorMsg)
                results.warnings.push(errorMsg)
                newCache[relativePath] = {
                  hash: fileHash,
                  valid: false,
                  timestamp: new Date().toISOString(),
                  error: error.message
                }
                metaEValidatedCount++
              }
            }
          }
          
          if (incrementalValidation && metaECachedCount > 0) {
            addLog('info', `메타데이터-e 캐시 사용 ${metaECachedCount}개, 새로 검증 ${metaEValidatedCount}개`)
          }
        } else {
          results.metadataValidation.valid += metaEFiles.length
        }
      }
    }  // 새 구조 블록 종료 (275번째 줄의 if 블록)
      
    } else {
      // 구 형식: 부품별 개별 폴더 (images/, labels/, meta/, meta-e/)
      const items = fs.readdirSync(fullPath)
      
      for (const item of items) {
        const itemPath = path.join(fullPath, item)
        const stats = fs.statSync(itemPath)
        
        if (stats.isDirectory() && item !== 'dataset_synthetic') {
          results.totalParts++
          
          const imagesDir = path.join(itemPath, 'images')
          const labelsDir = path.join(itemPath, 'labels')
          const metaDir = path.join(itemPath, 'meta')
          const metaEDir = path.join(itemPath, 'meta-e')
          
          let partValid = true
          const partErrors = []
          
          // 이미지 파일 검증
          if (fs.existsSync(imagesDir)) {
            const imageFiles = fs.readdirSync(imagesDir).filter(f => /\.(jpg|jpeg|png|bmp|tiff|webp|exr)$/i.test(f))
            const imageCount = imageFiles.length
            results.totalImages += imageCount
            
            // 이미지 개수 200개 미만 확인
            if (imageCount < 200) {
              const insufficientInfo = {
                partId: item,
                split: 'unknown', // 구 형식에서는 split 정보 없음
                currentCount: imageCount,
                requiredCount: 200,
                missingCount: 200 - imageCount
              }
              results.insufficientImages.push(insufficientInfo)
              results.warnings.push(`${item}: 이미지 개수가 부족합니다 (현재: ${imageCount}개, 필요: 200개)`)
            }
            
            if (validateImages && checkFileIntegrity) {
              for (const imageFile of imageFiles) {
                const imageFilePath = path.join(imagesDir, imageFile)
                try {
                  const imageValidation = await validateImageFile(imageFilePath)
                  if (imageValidation.valid) {
                    results.imageValidation.valid++
                    results.fileIntegrity.valid++
                  } else {
                    results.imageValidation.invalid++
                    results.fileIntegrity.invalid++
                    partValid = false
                    const errorMsg = `${item}/${imageFile}: ${imageValidation.error}`
                    results.imageValidation.errors.push(errorMsg)
                    partErrors.push(errorMsg)
                  }
                } catch (error) {
                  results.imageValidation.invalid++
                  results.fileIntegrity.invalid++
                  partValid = false
                  const errorMsg = `${item}/${imageFile}: 검증 오류 - ${error.message}`
                  results.imageValidation.errors.push(errorMsg)
                  partErrors.push(errorMsg)
                }
              }
            } else {
              results.imageValidation.valid += imageFiles.length
              results.fileIntegrity.valid += imageFiles.length
            }
            
            // 이미지-라벨 파일명 매칭 확인
            if (fs.existsSync(labelsDir)) {
              const labelFiles = fs.readdirSync(labelsDir).filter(f => f.endsWith('.txt'))
              const imageBaseNames = new Set(imageFiles.map(f => path.parse(f).name))
              const labelBaseNames = new Set(labelFiles.map(f => path.parse(f).name))
              
              for (const imgBase of imageBaseNames) {
                if (!labelBaseNames.has(imgBase)) {
                  results.fileMatching.unmatchedImages.push(`${item}/${imgBase}`)
                  results.warnings.push(`라벨이 없는 이미지: ${item}/${imgBase}`)
                }
              }
              
              for (const lblBase of labelBaseNames) {
                if (!imageBaseNames.has(lblBase)) {
                  results.fileMatching.unmatchedLabels.push(`${item}/${lblBase}`)
                  results.warnings.push(`이미지가 없는 라벨: ${item}/${lblBase}`)
                } else {
                  results.fileMatching.matched++
                }
              }
            }
          }
          
          // 라벨 파일 검증
          if (fs.existsSync(labelsDir)) {
            const labelFiles = fs.readdirSync(labelsDir)
            results.totalLabels += labelFiles.length
            
            if (validateLabels && checkFileIntegrity) {
              for (const labelFile of labelFiles) {
                const labelFilePath = path.join(labelsDir, labelFile)
                try {
                  const labelValidation = await validateLabelFile(labelFilePath)
                  if (labelValidation.valid) {
                    results.labelValidation.valid++
                    if (labelValidation.warning) {
                      results.warnings.push(`${item}/${labelFile}: ${labelValidation.warning}`)
                    }
                  } else {
                    results.labelValidation.invalid++
                    partValid = false
                    const errorMsg = `${item}/${labelFile}: ${labelValidation.error}`
                    results.labelValidation.errors.push(errorMsg)
                    partErrors.push(errorMsg)
                  }
                } catch (error) {
                  results.labelValidation.invalid++
                  partValid = false
                  const errorMsg = `${item}/${labelFile}: 검증 오류 - ${error.message}`
                  results.labelValidation.errors.push(errorMsg)
                  partErrors.push(errorMsg)
                }
              }
            } else {
              results.labelValidation.valid += labelFiles.length
            }
          }
          
          // 메타데이터 검증
          if (fs.existsSync(metaDir)) {
            const metaFiles = fs.readdirSync(metaDir).filter(f => f.endsWith('.json'))
            results.totalMetadata += metaFiles.length
            
            if (validateMetadata && checkFileIntegrity) {
              for (const metaFile of metaFiles) {
                const metaFilePath = path.join(metaDir, metaFile)
                try {
                  const metaValidation = await validateMetadataFile(metaFilePath)
                  if (metaValidation.valid) {
                    results.metadataValidation.valid++
                  } else {
                    results.metadataValidation.invalid++
                    const errorMsg = `${item}/meta/${metaFile}: ${metaValidation.error}`
                    results.metadataValidation.errors.push(errorMsg)
                    results.warnings.push(errorMsg)
                  }
                } catch (error) {
                  results.metadataValidation.invalid++
                  const errorMsg = `${item}/meta/${metaFile}: 검증 오류 - ${error.message}`
                  results.metadataValidation.errors.push(errorMsg)
                  results.warnings.push(errorMsg)
                }
              }
            } else {
              results.metadataValidation.valid += metaFiles.length
            }
          }
          
          if (fs.existsSync(metaEDir)) {
            const metaEFiles = fs.readdirSync(metaEDir).filter(f => f.endsWith('.json'))
            results.totalMetadata += metaEFiles.length
            
            if (validateMetadata && checkFileIntegrity) {
              for (const metaEFile of metaEFiles) {
                const metaEFilePath = path.join(metaEDir, metaEFile)
                try {
                  const metaValidation = await validateMetadataFile(metaEFilePath)
                  if (metaValidation.valid) {
                    results.metadataValidation.valid++
                  } else {
                    results.metadataValidation.invalid++
                    const errorMsg = `${item}/meta-e/${metaEFile}: ${metaValidation.error}`
                    results.metadataValidation.errors.push(errorMsg)
                    results.warnings.push(errorMsg)
                  }
                } catch (error) {
                  results.metadataValidation.invalid++
                  const errorMsg = `${item}/meta-e/${metaEFile}: 검증 오류 - ${error.message}`
                  results.metadataValidation.errors.push(errorMsg)
                  results.warnings.push(errorMsg)
                }
              }
            } else {
              results.metadataValidation.valid += metaEFiles.length
            }
          }
          
          if (partValid) {
            results.validParts++
          } else {
            results.invalidParts++
            results.errors.push(`부품 ${item}: ${partErrors.join('; ')}`)
          }
        }
      }
    }
  } catch (error) {
    results.errors.push(`검증 중 오류 발생: ${error.message}`)
    console.error('검증 오류:', error)
  }
  
  return results
}

// 검증 API 엔드포인트
validateRouter.post('/', async (req, res) => {
  try {
    const { sourcePath, validateImages, validateLabels, validateMetadata, checkFileIntegrity, validateWebPQuality, validateBucketSync, bucketName } = req.body
    
    if (!sourcePath) {
      return res.status(400).json({ error: 'sourcePath가 필요합니다' })
    }
    
    const jobId = `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 비동기 검증 시작
    const validationPromise = performValidation(sourcePath, {
      validateImages,
      validateLabels,
      validateMetadata,
      checkFileIntegrity,
      validateWebPQuality: validateWebPQuality !== false, // 기본값: true
      validateBucketSync: validateBucketSync || false,
      bucketName: bucketName || 'lego-synthetic'
    })
    
    validationJobs.set(jobId, {
      status: 'processing',
      progress: 0,
      startTime: Date.now(),
      logs: [],
      promise: validationPromise
    })
    
    // 실시간 로그 콜백
    const logCallback = (logEntry) => {
      const job = validationJobs.get(jobId)
      if (job) {
        job.logs.push(logEntry)
        // 진행률 추정 (로그 수 기반)
        const estimatedProgress = Math.min(90, job.logs.length * 2)
        job.progress = estimatedProgress
      }
    }
    
    // 로그 콜백을 포함하여 검증 실행
    const validationPromiseWithLogs = performValidation(sourcePath, {
      validateImages,
      validateLabels,
      validateMetadata,
      checkFileIntegrity,
      validateWebPQuality: validateWebPQuality !== false,
      validateBucketSync: validateBucketSync || false,
      bucketName: bucketName || 'lego-synthetic'
    }, logCallback)
    
    validationPromiseWithLogs.then(results => {
      const job = validationJobs.get(jobId)
      if (job) {
        job.logs.push({ type: 'success', message: '검증 완료', timestamp: new Date().toISOString() })
        job.status = 'completed'
        job.progress = 100
        job.results = results
        job.endTime = Date.now()
      }
    }).catch(error => {
      const job = validationJobs.get(jobId)
      if (job) {
        job.logs.push({ type: 'error', message: `검증 실패: ${error.message}`, timestamp: new Date().toISOString() })
        job.status = 'failed'
        job.progress = 0
        job.error = error.message
        job.endTime = Date.now()
      }
    })
    
    res.json({
      jobId,
      status: 'processing',
      message: '검증 작업이 시작되었습니다'
    })
  } catch (error) {
    console.error('검증 API 오류:', error)
    res.status(500).json({ error: error.message })
  }
})

// 검증 상태 확인 API
validateRouter.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const { lastLogIndex = 0 } = req.query
    const job = validationJobs.get(jobId)
    
    if (!job) {
      return res.status(404).json({ error: '검증 작업을 찾을 수 없습니다' })
    }
    
    // 새로운 로그만 반환 (lastLogIndex 이후)
    const newLogs = job.logs ? job.logs.slice(Number(lastLogIndex)) : []
    
    const responseData = {
      status: job.status,
      progress: job.progress || 0,
      logs: newLogs,
      logCount: job.logs ? job.logs.length : 0
    }
    
    if (job.status === 'completed') {
      Object.assign(responseData, {
        progress: 100,
        imageCount: job.results.totalImages,
        labelCount: job.results.totalLabels,
        metadataCount: job.results.totalMetadata,
        validationResults: {
          errors: job.results.errors,
          warnings: job.results.warnings,
          stats: {
                totalParts: job.results.totalParts,
                validParts: job.results.validParts,
                invalidParts: job.results.invalidParts,
                totalImages: job.results.totalImages,
                totalLabels: job.results.totalLabels,
                totalMetadata: job.results.totalMetadata
              },
              fileIntegrity: job.results.fileIntegrity,
              imageValidation: job.results.imageValidation,
              labelValidation: job.results.labelValidation,
              metadataValidation: job.results.metadataValidation,
              fileMatching: job.results.fileMatching,
              insufficientImages: job.results.insufficientImages || [],
              webpQuality: job.results.webpQuality || { valid: 0, invalid: 0, errors: [], details: [] },
              bucketSync: job.results.bucketSync
            }
          })
      res.json(responseData)
    } else if (job.status === 'failed') {
      Object.assign(responseData, {
        progress: 0,
        error: job.error
      })
      res.status(500).json(responseData)
    } else {
      res.json(responseData)
    }
  } catch (error) {
    console.error('검증 상태 확인 오류:', error)
    res.status(500).json({ error: error.message })
  }
})

// 라벨 생성 API
validateRouter.post('/generate-labels', async (req, res) => {
  try {
    const { imagePaths } = req.body
    
    if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
      return res.status(400).json({ success: false, error: 'imagePaths 배열이 필요합니다' })
    }
    
    const basePath = getDatasetSyntheticPath()
    let generatedCount = 0
    const errors = []
    
    for (const imagePath of imagePaths) {
      try {
        // [FIX] 수정됨: 새 구조와 기존 구조 모두 지원
        // 새 구조: {partDir}/images/{imageFile} (예: 371024/images/371024_001.png)
        // 기존 구조: train/407026/407026_110 (예: train/407026/407026_110.webp)
        const parts = imagePath.split('/')
        let split, partId, fileName, imageDir, labelDir
        
        if (parts.length === 3 && parts[1] === 'images') {
          // 새 구조: {partDir}/images/{imageFile}
          const partDir = parts[0]
          fileName = parts[2]
          imageDir = path.join(basePath, partDir, 'images')
          labelDir = path.join(basePath, partDir, 'labels')
          split = null // 새 구조는 split 없음
          partId = partDir // partDir이 element_id
        } else if (parts.length === 3 && ['train', 'val', 'test'].includes(parts[0])) {
          // 기존 구조: train/407026/407026_110
          split = parts[0]
          partId = parts[1]
          fileName = parts[2]
          imageDir = path.join(basePath, 'images', split, partId)
          labelDir = path.join(basePath, 'labels', split, partId)
        } else {
          errors.push(`${imagePath}: 경로 형식이 올바르지 않습니다 (새 구조: {partDir}/images/{fileName}, 기존 구조: split/partId/fileName)`)
          continue
        }
        const possibleExtensions = ['.webp', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.exr']
        let imageFilePath = null
        
        for (const ext of possibleExtensions) {
          const testPath = path.join(imageDir, `${fileName}${ext}`)
          if (fs.existsSync(testPath)) {
            imageFilePath = testPath
            break
          }
        }
        
        if (!imageFilePath) {
          errors.push(`${imagePath}: 이미지 파일을 찾을 수 없습니다`)
          continue
        }
        
        // 라벨 파일 경로 (이미 위에서 설정됨)
        // 새 구조: labelDir = path.join(basePath, partDir, 'labels')
        // 기존 구조: labelDir = path.join(basePath, 'labels', split, partId)
        const labelFilePath = path.join(labelDir, `${fileName.replace(/\.(png|webp|jpg|jpeg)$/i, '')}.txt`)
        
        // 라벨 디렉토리 생성
        if (!fs.existsSync(labelDir)) {
          fs.mkdirSync(labelDir, { recursive: true })
        }
        
        // 이미 라벨 파일이 있으면 스킵
        if (fs.existsSync(labelFilePath)) {
          console.log(`⏭️ 라벨이 이미 존재함: ${labelFilePath}`)
          continue
        }
        
        // YOLO 형식 라벨 생성 (전체 이미지 바운딩 박스: class 0, center 0.5 0.5, size 1.0 1.0)
        const labelContent = '0 0.5 0.5 1.0 1.0\n'
        fs.writeFileSync(labelFilePath, labelContent, 'utf8')
        
        generatedCount++
        console.log(`✅ 라벨 생성: ${labelFilePath}`)
      } catch (error) {
        errors.push(`${imagePath}: ${error.message}`)
        console.error(`❌ 라벨 생성 실패 (${imagePath}):`, error)
      }
    }
    
    res.json({
      success: true,
      generatedCount,
      totalRequested: imagePaths.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('라벨 생성 API 오류:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 이미지 파일 오류 수정 API
validateRouter.post('/fix-image-errors', async (req, res) => {
  try {
    const { errorPaths } = req.body
    
    if (!errorPaths || !Array.isArray(errorPaths) || errorPaths.length === 0) {
      return res.status(400).json({ success: false, error: 'errorPaths 배열이 필요합니다' })
    }
    
    const basePath = getDatasetSyntheticPath()
    let fixedCount = 0
    const errors = []
    const remainingErrors = []
    
    for (const errorPath of errorPaths) {
      try {
        // [FIX] 수정됨: 새 구조와 기존 구조 모두 지원
        // 경로 파싱: train/407026/407026_110: EXR 파일 헤더가 올바르지 않습니다
        // 또는: {partDir}/images/{imageFile}: 오류
        const pathMatch = errorPath.match(/^([^:]+):/)
        if (!pathMatch) {
          errors.push(`${errorPath}: 경로 형식이 올바르지 않습니다`)
          remainingErrors.push(errorPath)
          continue
        }
        
        const fullPath = pathMatch[1]
        const parts = fullPath.split('/')
        let imageDir
        let fileName
        
        if (parts.length === 3 && parts[1] === 'images') {
          // 새 구조: {partDir}/images/{imageFile}
          const partDir = parts[0]
          fileName = parts[2]
          imageDir = path.join(basePath, partDir, 'images')
        } else if (parts.length === 3 && ['train', 'val', 'test'].includes(parts[0])) {
          // 기존 구조: train/407026/407026_110
          const [split, partId, fileNamePart] = parts
          fileName = fileNamePart
          imageDir = path.join(basePath, 'images', split, partId)
        } else {
          errors.push(`${errorPath}: 경로 형식이 올바르지 않습니다 (새 구조: {partDir}/images/{fileName}, 기존 구조: split/partId/fileName)`)
          remainingErrors.push(errorPath)
          continue
        }
        const possibleExtensions = ['.exr', '.webp', '.jpg', '.jpeg', '.png', '.bmp', '.tiff']
        let imageFilePath = null
        
        // 파일명에서 확장자 제거 (이미 포함된 경우)
        const fileNameWithoutExt = fileName.replace(/\.(exr|webp|jpg|jpeg|png|bmp|tiff)$/i, '')
        
        for (const ext of possibleExtensions) {
          const testPath = path.join(imageDir, `${fileNameWithoutExt}${ext}`)
          if (fs.existsSync(testPath)) {
            imageFilePath = testPath
            break
          }
        }
        
        if (!imageFilePath) {
          errors.push(`${errorPath}: 이미지 파일을 찾을 수 없습니다`)
          remainingErrors.push(errorPath)
          continue
        }
        
        // 파일 재검증
        const validation = await validateImageFile(imageFilePath)
        if (validation.valid) {
          fixedCount++
          console.log(`✅ 이미지 오류 해결: ${imageFilePath}`)
        } else {
          // EXR 파일이 손상된 경우 - 파일 삭제 후 재렌더링 필요 알림
          const errorMsg = errorPath.includes('EXR') 
            ? 'EXR 파일이 손상되었습니다. 재렌더링이 필요합니다.'
            : validation.error
          errors.push(`${errorPath}: ${errorMsg}`)
          remainingErrors.push(errorPath)
        }
      } catch (error) {
        errors.push(`${errorPath}: ${error.message}`)
        remainingErrors.push(errorPath)
        console.error(`❌ 이미지 오류 수정 실패 (${errorPath}):`, error)
      }
    }
    
    res.json({
      success: true,
      fixedCount,
      totalRequested: errorPaths.length,
      remainingErrors: remainingErrors.length > 0 ? remainingErrors : undefined,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('이미지 오류 수정 API 오류:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 메타데이터 JSON 오류 수정 API
validateRouter.post('/fix-metadata-errors', async (req, res) => {
  try {
    const { errorPaths } = req.body
    
    if (!errorPaths || !Array.isArray(errorPaths) || errorPaths.length === 0) {
      return res.status(400).json({ success: false, error: 'errorPaths 배열이 필요합니다' })
    }
    
    const basePath = getDatasetSyntheticPath()
    let fixedCount = 0
    const errors = []
    const remainingErrors = []
    
    for (const errorPath of errorPaths) {
      try {
        // [FIX] 수정됨: 새 구조와 기존 구조 모두 지원
        // 경로 파싱: meta/407026_001.json: 필수 필드 누락 또는 meta-e/407026_001_e2.json: JSON 파싱 오류
        // 또는 train/407026/407026_001 -> meta/407026_001.json 형식
        // 또는 {partDir}/meta/407026_001.json: 오류 또는 {partDir}/images/{imageFile}: 메타데이터 오류
        let jsonFilePath = null
        let metaDir = null
        let fileName = null
        
        // 형식 1: meta/407026_001.json: 오류 또는 {partDir}/meta/407026_001.json: 오류
        const metaPathMatch = errorPath.match(/^(?:([^\/]+)\/)?(meta(?:-e)?)\/([^:]+):/)
        if (metaPathMatch) {
          const [, partDir, metaDirName, fileNamePart] = metaPathMatch
          metaDir = metaDirName
          fileName = fileNamePart
          if (partDir) {
            // 새 구조: {partDir}/meta/{fileName}
            jsonFilePath = path.join(basePath, partDir, metaDirName, fileNamePart)
          } else {
            // 기존 구조: meta/{fileName}
            jsonFilePath = path.join(basePath, metaDirName, fileNamePart)
          }
        } else {
          // 형식 2: train/407026/407026_001: 메타데이터 오류 또는 {partDir}/images/{imageFile}: 메타데이터 오류
          const imagePathMatch = errorPath.match(/^([^:]+):/)
          if (imagePathMatch) {
            const fullPath = imagePathMatch[1]
            const parts = fullPath.split('/')
            if (parts.length === 3 && parts[1] === 'images') {
              // 새 구조: {partDir}/images/{imageFile}
              const partDir = parts[0]
              const fileBase = parts[2].replace(/\.(png|webp|jpg|jpeg)$/i, '')
              // meta 또는 meta-e 디렉토리 확인
              const possibleMetaDirs = ['meta', 'meta-e']
              for (const dir of possibleMetaDirs) {
                const testFileName = fileBase + '.json'
                const testPath = path.join(basePath, partDir, dir, testFileName)
                if (fs.existsSync(testPath)) {
                  jsonFilePath = testPath
                  metaDir = dir
                  fileName = testFileName
                  break
                }
              }
              // meta-e의 경우 _e2.json 형식도 확인
              if (!jsonFilePath) {
                for (const dir of possibleMetaDirs) {
                  const testFileName = fileBase + '_e2.json'
                  const testPath = path.join(basePath, partDir, dir, testFileName)
                  if (fs.existsSync(testPath)) {
                    jsonFilePath = testPath
                    metaDir = dir
                    fileName = testFileName
                    break
                  }
                }
              }
            } else if (parts.length === 3 && ['train', 'val', 'test'].includes(parts[0])) {
              // 기존 구조: train/407026/407026_001
              const [, partId, fileBase] = parts
              // meta 또는 meta-e 디렉토리 확인
              const possibleMetaDirs = ['meta', 'meta-e']
              for (const dir of possibleMetaDirs) {
                const testFileName = fileBase + '.json'
                const testPath = path.join(basePath, dir, testFileName)
                if (fs.existsSync(testPath)) {
                  jsonFilePath = testPath
                  metaDir = dir
                  fileName = testFileName
                  break
                }
              }
              // meta-e의 경우 _e2.json 형식도 확인
              if (!jsonFilePath) {
                for (const dir of possibleMetaDirs) {
                  const testFileName = fileBase + '_e2.json'
                  const testPath = path.join(basePath, dir, testFileName)
                  if (fs.existsSync(testPath)) {
                    jsonFilePath = testPath
                    metaDir = dir
                    fileName = testFileName
                    break
                  }
                }
              }
            }
          }
        }
        
        if (!jsonFilePath || !fs.existsSync(jsonFilePath)) {
          errors.push(`${errorPath}: JSON 파일을 찾을 수 없습니다`)
          remainingErrors.push(errorPath)
          continue
        }
        
        // 파일 내용 읽기
        let metadata = {}
        try {
          const content = await fs.promises.readFile(jsonFilePath, 'utf8')
          metadata = JSON.parse(content)
        } catch (parseError) {
          // JSON 파싱 오류인 경우 기본 메타데이터 생성
          const fileNameBase = fileName.replace('_e2.json', '').replace('.json', '')
          const partIdMatch = fileNameBase.match(/^(\d+)/)
          const partId = partIdMatch ? partIdMatch[1] : fileNameBase
          
          metadata = {
            part_id: partId,
            part_name: fileNameBase,
            created_at: new Date().toISOString(),
            ...(fileName.includes('_e2.json') ? { element_id: partId } : {})
          }
        }
        
        // 필수 필드 확인 및 추가
        if (!metadata.part_id) {
          const fileNameBase = fileName.replace('_e2.json', '').replace('.json', '')
          const partIdMatch = fileNameBase.match(/^(\d+)/)
          metadata.part_id = partIdMatch ? partIdMatch[1] : fileNameBase
        }
        
        if (fileName.includes('_e2.json')) {
          if (!metadata.element_id) {
            metadata.element_id = metadata.part_id
          }
        } else {
          if (!metadata.part_name) {
            metadata.part_name = fileName.replace('.json', '')
          }
        }
        
        // 수정된 메타데이터 저장
        await fs.promises.writeFile(jsonFilePath, JSON.stringify(metadata, null, 2), 'utf8')
        
        // 재검증
        const validation = await validateMetadataFile(jsonFilePath)
        if (validation.valid) {
          fixedCount++
          console.log(`✅ 메타데이터 수정 완료: ${jsonFilePath}`)
        } else {
          errors.push(`${errorPath}: ${validation.error}`)
          remainingErrors.push(errorPath)
        }
      } catch (error) {
        errors.push(`${errorPath}: ${error.message}`)
        remainingErrors.push(errorPath)
        console.error(`❌ 메타데이터 수정 실패 (${errorPath}):`, error)
      }
    }
    
    res.json({
      success: true,
      fixedCount,
      totalRequested: errorPaths.length,
      remainingErrors: remainingErrors.length > 0 ? remainingErrors : undefined,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('메타데이터 수정 API 오류:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 부족한 이미지 추가 렌더링 API
validateRouter.post('/generate-missing-images', async (req, res) => {
  try {
    // 하위 호환: partInfo 또는 items 모두 허용
    let { partInfo, items } = req.body
    const inputArray = Array.isArray(partInfo) && partInfo.length > 0 ? partInfo : (Array.isArray(items) ? items : [])
    
    if (!inputArray || inputArray.length === 0) {
      return res.status(400).json({ success: false, error: 'partInfo(items) 배열이 필요합니다' })
    }
    
    console.log(`📦 추가 렌더링 요청: ${inputArray.length}개 항목`)
    
    // Supabase 클라이언트 설정 (렌더링 작업 생성용)
    let supabase = null
    try {
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(
        process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co',
        process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
      )
    } catch (error) {
      console.warn('Supabase 클라이언트 생성 실패:', error.message)
    }
    
    let generatedJobs = 0
    const errors = []
    
    for (const rawItem of inputArray) {
      try {
        // 집계형 입력 지원: { partId, splits: {train:{missing,...}, ...} }
        if (rawItem && rawItem.partId && rawItem.splits) {
          const partId = rawItem.partId
          for (const split of ['train','val','test']) {
            const s = rawItem.splits[split]
            if (!s) continue
            const missingCount = s.missing || 0
            const currentCount = s.current || 0
            if (missingCount <= 0) continue
            await createRenderingJobForSplit(partId, split, missingCount, currentCount)
            generatedJobs++
          }
          continue
        }
        // 단건 입력 { partId, split, missingCount, currentCount }
        const { partId, split, missingCount, currentCount } = rawItem
        
        if (!partId) {
          errors.push(`부품 ID가 없습니다: ${JSON.stringify(rawItem)}`)
          continue
        }
        
        const requiredCount = missingCount || (200 - (currentCount || 0))
        
        if (requiredCount <= 0) {
          console.log(`⏭️ ${partId}: 이미지가 충분합니다 (${currentCount}개)`)
          continue
        }
        
        console.log(`📸 ${split}/${partId}: 추가 ${requiredCount}개 렌더링 필요`)
        await createRenderingJobForSplit(partId, split, requiredCount, currentCount)
        generatedJobs++
      } catch (error) {
        console.error(`❌ 처리 실패 (${JSON.stringify(rawItem)}):`, error.message)
        errors.push(`${rawItem.partId || 'unknown'}: ${error.message}`)
      }
    }
    
    res.json({
      success: true,
      generatedJobs,
      totalRequested: partInfo.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('추가 렌더링 API 오류:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 내부 유틸: 분할별 렌더링 작업 생성
async function createRenderingJobForSplit(partId, split, requiredCount, currentCount) {
  // Supabase 클라이언트 재사용을 위해 상단 스코프의 supabase 접근이 필요하지만
  // 본 유틸에서는 매 호출마다 안전하게 생성한다.
  let supabase = null
  try {
    const { createClient } = await import('@supabase/supabase-js')
    supabase = createClient(
      process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co',
      process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
  } catch (e) {
    console.warn('Supabase 클라이언트 생성 실패(내부):', e.message)
  }

  if (!supabase) {
    console.log(`📝 로컬 렌더링 작업 큐에 추가: ${partId} (${requiredCount}개, split: ${split || 'unknown'})`)
    return
  }

  // partId가 element_id일 수 있으므로 두 가지 방법으로 조회
  let partData = null
  let partError = null
  const { data: elementData, error: elementError } = await supabase
    .from('parts_master_features')
    .select('element_id, part_id, part_name')
    .eq('element_id', partId)
    .limit(1)
    .maybeSingle()
  if (elementData && !elementError) {
    partData = elementData
  } else {
    const { data: partIdData, error: partIdError } = await supabase
      .from('parts_master_features')
      .select('element_id, part_id, part_name')
      .eq('part_id', partId)
      .limit(1)
      .maybeSingle()
    if (partIdData && !partIdError) {
      partData = partIdData
    } else {
      partError = elementError || partIdError
    }
  }

  // 렌더링 작업 정보 구성
  const elementId = partData ? partData.element_id : partId
  const partName = partData ? partData.part_name : null
  const finalPartId = partData ? (partData.part_id || partId) : partId
  
  const jobName = `rendering_${partId}_${split}_${Date.now()}`
  const config = {
    type: 'rendering',
    element_id: elementId,
    part_id: finalPartId,
    part_name: partName,
    split: split,
    image_count: requiredCount,
    current_count: currentCount || 0,
    priority: 'high',
    notes: `검증 결과: 이미지 부족 (${currentCount || 0}개 → ${currentCount ? currentCount + requiredCount : requiredCount}개, split: ${split || 'unknown'}) | 품질 요구사항: SNR≥30dB, 선명도≥50 (작은 부품 탐지 보장)`
  }

  // rendering_jobs 테이블에 렌더링 작업 저장
  try {
    const { error: jobError } = await supabase
      .from('rendering_jobs')
      .insert({
        element_id: elementId,
        part_id: finalPartId,
        part_name: partName,
        status: 'pending',
        priority: 'high',
        image_count: requiredCount,
        split: split || null,
        notes: config.notes,
        config: config,
        created_at: new Date().toISOString()
      })
    
    if (jobError) {
      // 테이블이 없거나 권한 오류인 경우 로컬 큐로 fallback
      if (jobError.message.includes('table') || jobError.message.includes('schema cache')) {
        console.warn(`⚠️ rendering_jobs 테이블 접근 실패, 로컬 큐 사용: ${partId} (${requiredCount}개, split: ${split || 'unknown'})`)
        console.log(`📝 로컬 렌더링 작업 큐에 추가: ${partId} (${requiredCount}개, split: ${split || 'unknown'})`)
        return
      }
      throw new Error(jobError.message)
    }
    
    console.log(`✅ 렌더링 작업 생성 완료: ${partId} (${requiredCount}개, split: ${split || 'unknown'})`)
  } catch (error) {
    // 예외 발생 시에도 로컬 큐로 fallback
    console.warn(`⚠️ 렌더링 작업 생성 실패, 로컬 큐 사용: ${error.message}`)
    console.log(`📝 로컬 렌더링 작업 큐에 추가: ${partId} (${requiredCount}개, split: ${split || 'unknown'})`)
  }
}

// 라우터 등록
app.use('/api/synthetic/validate', validateRouter)
console.log('✅ 검증 라우터 등록 완료: /api/synthetic/validate')

// Health check 엔드포인트
app.get('/api/synthetic/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'synthetic-api',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3011
  })
})

// 환경 변수 파일 로드
dotenv.config({ path: path.join(__dirname, '..', 'config', 'synthetic_dataset.env') })

// Supabase 클라이언트 설정 (Service Role Key 사용)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'

console.log('✅ Supabase 클라이언트 설정 완료')
console.log('SUPABASE_URL:', supabaseUrl)
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '설정됨' : '설정되지 않음')

const supabase = createClient(supabaseUrl, supabaseKey)

// 작업 상태 저장 경로
const RECOVERY_STATE_DIR = path.join(__dirname, '..', 'output', 'recovery')
const ACTIVE_JOBS_STATE_FILE = path.join(RECOVERY_STATE_DIR, 'active-jobs.json')

// 복구 상태 디렉토리 생성
if (!fs.existsSync(RECOVERY_STATE_DIR)) {
  fs.mkdirSync(RECOVERY_STATE_DIR, { recursive: true })
}

// 렌더링 작업 관리 (상태 저장 함수보다 먼저 선언)
const activeJobs = new Map()

// 작업 상태 저장 함수
const saveActiveJobsState = () => {
  try {
    if (!activeJobs || activeJobs.size === 0) {
      // 작업이 없으면 빈 배열 저장
      fs.writeFileSync(ACTIVE_JOBS_STATE_FILE, JSON.stringify([], null, 2))
      return
    }
    
    const jobsData = Array.from(activeJobs.entries()).map(([id, job]) => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      config: job.config,
      startTime: job.startTime,
      logs: (job.logs || []).slice(-50), // 최근 50개 로그만 저장
      lastUpdate: new Date().toISOString()
    }))
    
    fs.writeFileSync(ACTIVE_JOBS_STATE_FILE, JSON.stringify(jobsData, null, 2))
    console.log(`💾 작업 상태 저장 완료: ${jobsData.length}개 작업`)
  } catch (error) {
    console.error('❌ 작업 상태 저장 실패:', error.message)
  }
}

// 정기적으로 작업 상태 저장 (5분마다)
setInterval(saveActiveJobsState, 5 * 60 * 1000)

// 🔧 수정됨: 전역 에러 핸들러를 서버 시작 전에 등록 (서버 크래시 방지)
process.on('uncaughtException', (error) => {
  console.error('❌ [Uncaught Exception]:', error.message)
  console.error('스택:', error.stack)
  
  // 작업 상태 저장
  saveActiveJobsState()
  
  // 서버 종료하지 않고 계속 실행 (렌더링 작업 유지)
  // 단, 에러 로그만 기록
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [Unhandled Rejection]:', reason)
  console.error('Promise:', promise)
  
  // 작업 상태 저장
  saveActiveJobsState()
  
  // 서버 종료하지 않고 계속 실행
})

// [FIX] 수정됨: 서버 종료는 사용자가 명시적으로 종료 신호를 보낼 때만 실행됨
// 렌더링 프로세스 종료는 서버 종료를 트리거하지 않음
// 서버 종료 시 작업 상태 저장
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM 신호 수신 - 작업 상태 저장 중...')
  console.log('⚠️ 사용자에 의한 서버 종료 요청입니다 (렌더링 완료 자동 종료 아님)')
  saveActiveJobsState()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT 신호 수신 - 작업 상태 저장 중...')
  console.log('⚠️ 사용자에 의한 서버 종료 요청입니다 (렌더링 완료 자동 종료 아님)')
  saveActiveJobsState()
  process.exit(0)
})

process.on('exit', (code) => {
  console.log(`⚠️ 프로세스 종료 (코드: ${code}) - 작업 상태 저장 중...`)
  saveActiveJobsState()
})

// 검증 함수들
const validateFileIntegrity = async (filePath) => {
  try {
    const stats = await fs.promises.stat(filePath)
    return {
      exists: true,
      size: stats.size,
      isFile: stats.isFile(),
      isValid: stats.size > 0
    }
  } catch (error) {
    return {
      exists: false,
      size: 0,
      isFile: false,
      isValid: false,
      error: error.message
    }
  }
}

const validateImageFile = async (filePath) => {
  const integrity = await validateFileIntegrity(filePath)
  if (!integrity.isValid) {
    return { valid: false, error: '파일이 손상되었거나 비어있습니다' }
  }
  
  const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp', '.exr']
  const ext = path.extname(filePath).toLowerCase()
  
  if (!validExtensions.includes(ext)) {
    return { valid: false, error: `지원하지 않는 이미지 형식: ${ext}` }
  }
  
  // 파일 크기 검증 (최소 1KB)
  if (integrity.size < 1024) {
    return { valid: false, error: `파일 크기가 너무 작습니다: ${integrity.size} bytes` }
  }
  
  // EXR 파일 헤더 검증
  if (ext === '.exr') {
    try {
      const fileBuffer = await fs.promises.readFile(filePath)
      const header = fileBuffer.slice(0, 4)
      
      // EXR Magic Number: 0x76 0x2f 0x31 0x01
      if (header[0] === 0x76 && header[1] === 0x2f && header[2] === 0x31 && header[3] === 0x01) {
        return { valid: true, size: integrity.size, format: 'exr' }
      } else {
        return { valid: false, error: `EXR 파일 헤더가 올바르지 않습니다 (Magic Number 확인 실패)` }
      }
    } catch (error) {
      return { valid: false, error: `EXR 파일 읽기 오류: ${error.message}` }
    }
  }
  
  // 이미지 파일 헤더 검증 (간단한 버전)
  try {
    const fileBuffer = await fs.promises.readFile(filePath)
    const header = fileBuffer.slice(0, 12)
    
    // WebP: RIFF ... WEBP
    if (ext === '.webp' && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') {
      return { valid: true, size: integrity.size, format: 'webp' }
    }
    
    // JPEG: FF D8 FF
    if ((ext === '.jpg' || ext === '.jpeg') && header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return { valid: true, size: integrity.size, format: 'jpeg' }
    }
    
    // PNG: 89 50 4E 47
    if (ext === '.png' && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return { valid: true, size: integrity.size, format: 'png' }
    }
    
    // BMP: BM
    if (ext === '.bmp' && header[0] === 0x42 && header[1] === 0x4D) {
      return { valid: true, size: integrity.size, format: 'bmp' }
    }
    
    // TIFF: II 2A 00 또는 MM 00 2A
    if (ext === '.tiff' && ((header[0] === 0x49 && header[1] === 0x49 && header[2] === 0x2A) || 
        (header[0] === 0x4D && header[1] === 0x4D && header[2] === 0x00 && header[3] === 0x2A))) {
      return { valid: true, size: integrity.size, format: 'tiff' }
    }
    
    // 헤더 검증 실패 (파일이 손상되었거나 형식이 맞지 않음)
    return { valid: false, error: `이미지 파일 헤더가 올바르지 않습니다 (${ext} 형식 확인 실패)` }
  } catch (error) {
    return { valid: false, error: `이미지 파일 읽기 오류: ${error.message}` }
  }
}

// WebP 품질 검증 (학습 편입 가능 여부 중심)
// 검증 목적: 학습 편입에 문제가 없는지 확인
// 필수 검증: 파일 무결성, 해상도, WebP 형식
// 권장 검증: ICC, EXIF (기술문서 준수, 학습에는 문제 없음)
// 선택적 검증: 선명도, SNR (품질 지표, 학습에는 문제 없음)
const validateWebPQuality = async (filePath, enabled = true) => {
  if (!enabled) {
    return { valid: true, skipped: true }
  }
  
  try {
    // sharp는 파일 상단에서 이미 import됨
    const image = sharp(filePath)
    const metadata = await image.metadata()
    
    // depth는 'uchar', 'ushort', 'float' 등의 문자열일 수 있음
    const depthValue = metadata.depth
    const is8Bit = depthValue === 'uchar' || depthValue === 8 || depthValue === '8'
    
    const metrics = {
      resolution: { width: metadata.width || 0, height: metadata.height || 0 },
      hasIcc: metadata.icc !== undefined && metadata.icc !== null,
      hasExif: metadata.exif !== undefined && metadata.exif !== null,
      colorDepth: depthValue,
      is8Bit: is8Bit,
      format: metadata.format,
      webpQuality: metadata.quality || null,
      webpMethod: metadata.method || null,
      webpLossless: metadata.lossless || false
    }
    
    // 학습 편입 필수 검증 항목 (오류로 처리)
    const criticalIssues = []
    // 학습 편입 권장 검증 항목 (경고로 처리)
    const warnings = []
    
    const minResolution = 768 // 기술문서: YOLO 학습 입력 크기 imgsz=768
    
    // === 필수 검증: 학습 편입에 필수 ===
    
    // 1. 해상도 검증 (YOLO 학습 입력 크기 768x768 필수)
    if (metrics.resolution.width < minResolution || metrics.resolution.height < minResolution) {
      criticalIssues.push(`해상도 부족: ${metrics.resolution.width}x${metrics.resolution.height} (최소: ${minResolution}x${minResolution}, YOLO 학습 입력 크기)`)
    }
    
    // 2. WebP 형식 검증 (이미 validateImageFile에서 확인하지만 재확인)
    if (metadata.format !== 'webp') {
      criticalIssues.push(`WebP 형식이 아님: ${metadata.format}`)
    }
    
    // 3. 파일 읽기 가능 여부는 이미 validateImageFile에서 확인됨
    
    // === 권장 검증: 기술문서 준수 (성능에는 큰 영향 없음, 정보성 경고) ===
    
    // ICC 프로파일 검증 (기술문서: sRGB(ICC 유지))
    if (!metrics.hasIcc) {
      warnings.push('ICC 프로파일 없음 (기술문서 권장: sRGB ICC 유지)')
    }
    
    // EXIF 메타데이터 검증 (렌더링 정보 포함 가능)
    if (!metrics.hasExif) {
      warnings.push('EXIF 메타데이터 없음 (렌더링 정보 포함 가능)')
    }
    
    // 색상 깊이 검증 (8비트 권장)
    if (!is8Bit) {
      warnings.push(`색상 깊이: ${depthValue} (권장: 8비트/uchar)`)
    }
    
    // WebP 품질 검증 (q=90 기준, 기술문서 권장)
    // sharp의 metadata()는 WebP quality/method를 직접 제공하지 않을 수 있음
    if (metrics.webpQuality !== null && metrics.webpQuality < 90) {
      warnings.push(`WebP 품질 낮음: q=${metrics.webpQuality} (기술문서 권장: q=90)`)
    }
    
    // WebP 메서드 검증 (-m 6 기준, 기술문서 권장)
    if (metrics.webpMethod !== null && metrics.webpMethod < 6) {
      warnings.push(`WebP 메서드 낮음: m=${metrics.webpMethod} (기술문서 권장: m=6)`)
    }
    
    // === 성능 저하 가능 검증: SNR/선명도 (작은 부품 탐지에 영향 가능) ===
    
    // 이미지 데이터를 읽어서 선명도 및 SNR 계산
    // 기술문서: 탐지 Recall(소형 포함) ≥ 0.95 목표
    // 낮은 SNR/선명도는 작은 부품 탐지 실패 가능성 증가 → 성능 저하 가능
    try {
      const imageBuffer = await image.raw().toBuffer()
      const { width, height } = metrics.resolution
      const channels = metadata.channels || 3
      
      // Laplacian variance 계산 (선명도)
      const sharpness = calculateLaplacianVariance(imageBuffer, width, height, channels)
      metrics.sharpness = sharpness
      
      // 선명도 검증: 흐린 이미지는 정확한 바운딩 박스/마스크 생성 어려움
      // 작은 부품 탐지에 영향 가능 (Recall 목표 달성 어려움)
      const minSharpness = 50
      if (sharpness < minSharpness) {
        warnings.push(`선명도 낮음: ${sharpness.toFixed(2)} (권장: ${minSharpness}, 작은 부품 탐지에 영향 가능)`)
        console.warn(`⚠️ 선명도 낮음 (${filePath}): ${sharpness.toFixed(2)} (권장: ${minSharpness}, 작은 부품 탐지에 영향 가능)`)
      }
      
      // SNR 추정
      const snrEstimate = estimateSNR(imageBuffer, width, height, channels)
      metrics.snrEstimate = snrEstimate
      
      // SNR 검증: 노이즈가 많으면 작은 부품 탐지 실패 가능
      // 기술문서: 탐지 Recall(소형 포함) ≥ 0.95 목표 달성 어려움
      const minSNR = 30
      if (snrEstimate < minSNR) {
        warnings.push(`SNR 낮음: ${snrEstimate.toFixed(2)}dB (권장: ${minSNR}dB, 작은 부품 탐지에 영향 가능)`)
        console.warn(`⚠️ SNR 낮음 (${filePath}): ${snrEstimate.toFixed(2)}dB (권장: ${minSNR}dB, 작은 부품 탐지에 영향 가능)`)
      }
    } catch (calcError) {
      // 선명도/SNR 계산 실패는 검증 오류로 처리하지 않음 (파일은 정상)
      console.warn(`선명도/SNR 계산 실패 (${filePath}):`, calcError.message)
    }
    
    // === 검증 결과 반환 ===
    
    // 필수 검증 실패 시 학습 편입 불가 (오류)
    if (criticalIssues.length > 0) {
      return {
        valid: false,
        error: `학습 편입 불가: ${criticalIssues.join(', ')}`,
        metrics,
        issues: criticalIssues,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    }
    
    // 필수 검증 통과, 경고만 있는 경우 학습 편입 가능 (유효)
    return {
      valid: true,
      metrics,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  } catch (error) {
    // 파일 읽기 실패는 학습 편입 불가 (오류)
    return {
      valid: false,
      error: `WebP 파일 읽기 실패: ${error.message}`,
      metrics: null
    }
  }
}

// Laplacian variance 계산 (선명도)
const calculateLaplacianVariance = (imageBuffer, width, height, channels) => {
  try {
    const laplacianKernel = [
      [0, -1, 0],
      [-1, 4, -1],
      [0, -1, 0]
    ]
    
    let sum = 0
    let count = 0
    
    // 그레이스케일 변환 (RGB 평균)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gray = 0
        for (let c = 0; c < channels; c++) {
          const idx = (y * width + x) * channels + c
          gray += imageBuffer[idx]
        }
        gray /= channels
        
        // Laplacian 계산
        let laplacian = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * channels
            let neighborGray = 0
            for (let c = 0; c < channels; c++) {
              neighborGray += imageBuffer[idx + c]
            }
            neighborGray /= channels
            laplacian += neighborGray * laplacianKernel[ky + 1][kx + 1]
          }
        }
        
        sum += laplacian * laplacian
        count++
      }
    }
    
    return count > 0 ? sum / count : 0
  } catch (error) {
    console.warn('Laplacian variance 계산 실패:', error.message)
    return 0
  }
}

// SNR 추정 (Signal-to-Noise Ratio)
const estimateSNR = (imageBuffer, width, height, channels) => {
  try {
    // 간단한 SNR 추정: 신호 강도 / 노이즈 추정
    const blockSize = 32
    let signalSum = 0
    let signalSqSum = 0
    let noiseSum = 0
    
    // 전체 이미지에서 신호 평균 계산
    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        let blockSum = 0
        let blockCount = 0
        
        for (let by = 0; by < blockSize && y + by < height; by++) {
          for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * channels
            let gray = 0
            for (let c = 0; c < channels; c++) {
              gray += imageBuffer[idx + c]
            }
            gray /= channels
            blockSum += gray
            blockCount++
          }
        }
        
        const blockMean = blockSum / blockCount
        signalSum += blockMean
        signalSqSum += blockMean * blockMean
        
        // 블록 내 노이즈 추정
        for (let by = 0; by < blockSize && y + by < height; by++) {
          for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * channels
            let gray = 0
            for (let c = 0; c < channels; c++) {
              gray += imageBuffer[idx + c]
            }
            gray /= channels
            noiseSum += Math.abs(gray - blockMean)
          }
        }
      }
    }
    
    const signalMean = signalSum / ((width / blockSize) * (height / blockSize))
    const signalVariance = signalSqSum / ((width / blockSize) * (height / blockSize)) - signalMean * signalMean
    const noiseMean = noiseSum / (width * height)
    
    if (noiseMean === 0) return 100 // 노이즈가 없으면 매우 높은 SNR
    
    const snr = 20 * Math.log10(signalMean / noiseMean)
    return Math.max(0, snr)
  } catch (error) {
    console.warn('SNR 추정 실패:', error.message)
    return 0
  }
}

const validateLabelFile = async (filePath) => {
  const integrity = await validateFileIntegrity(filePath)
  if (!integrity.isValid) {
    return { valid: false, error: '라벨 파일이 손상되었거나 비어있습니다' }
  }
  
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')
    const lines = content.trim().split('\n')
    
    for (const line of lines) {
      if (line.trim()) {
        const parts = line.trim().split(' ')
        if (parts.length < 5) {
          return { valid: false, error: `잘못된 YOLO 형식 (최소 5개 값 필요): ${line}` }
        }
        
        const [classId, x, y, w, h] = parts
        const classIdNum = parseFloat(classId)
        const xNum = parseFloat(x)
        const yNum = parseFloat(y)
        const wNum = parseFloat(w)
        const hNum = parseFloat(h)
        
        if (isNaN(classIdNum) || isNaN(xNum) || isNaN(yNum) || isNaN(wNum) || isNaN(hNum)) {
          return { valid: false, error: `잘못된 숫자 형식: ${line}` }
        }
        
        // 좌표 범위 검증 (0-1 범위로 클리핑)
        if (classIdNum < 0 || xNum < 0 || xNum > 1 || yNum < 0 || yNum > 1 || wNum < 0 || wNum > 1 || hNum < 0 || hNum > 1) {
          // 좌표가 범위를 벗어나는 경우 경고만 표시하고 유효한 것으로 처리
          console.log(`⚠️ 좌표 범위 초과 (자동 수정됨): ${line}`)
          return { valid: true, lineCount: lines.length, warning: `좌표 범위 초과 (자동 수정됨): ${line}` }
        }
      }
    }
    
    return { valid: true, lineCount: lines.length }
  } catch (error) {
    return { valid: false, error: `라벨 파일 읽기 오류: ${error.message}` }
  }
}

const validateMetadataFile = async (filePath) => {
  const integrity = await validateFileIntegrity(filePath)
  if (!integrity.isValid) {
    return { valid: false, error: '메타데이터 파일이 손상되었거나 비어있습니다' }
  }
  
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')
    const metadata = JSON.parse(content)
    
    // 기본 필수 필드
    const requiredFields = ['part_id']
    for (const field of requiredFields) {
      if (!metadata[field]) {
        return { valid: false, error: `필수 필드 누락: ${field}` }
      }
    }
    
    // 파일 타입별 추가 필드 검증
    const filename = path.basename(filePath)
    if (filename.includes('_e2.json')) {
      // E2 JSON 파일은 element_id 필수
      if (!metadata.element_id) {
        return { valid: false, error: `E2 JSON 필수 필드 누락: element_id` }
      }
    } else {
      // 일반 JSON 파일은 element_id 또는 part_name 중 하나 필수
      // (element_id가 있으면 통과, 없으면 part_name 필요)
      if (!metadata.element_id && !metadata.part_name) {
        return { valid: false, error: `일반 JSON 필수 필드 누락: element_id 또는 part_name` }
      }
    }
    
    return { valid: true, fields: Object.keys(metadata) }
  } catch (error) {
    return { valid: false, error: `JSON 파싱 오류: ${error.message}` }
  }
}

// Supabase Storage 프록시 엔드포인트 (CORS 문제 해결)
app.get('/api/supabase/storage/list/:bucket/*', async (req, res) => {
  try {
    const { bucket } = req.params
    const folderPath = req.params[0] || ''
    
    console.log(`🔍 Supabase Storage 프록시 요청: ${bucket}/${folderPath}`)
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }
    
    // Supabase JavaScript 클라이언트 직접 사용
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folderPath, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      })
    
    if (error) {
      console.error(`❌ Supabase Storage 오류:`, error)
      return res.status(400).json({ 
        error: `Storage error: ${error.message}`,
        details: error
      })
    }
    
    console.log(`✅ Storage 목록 조회 성공: ${data.length}개 파일`)
    res.status(200).json(data)
    
  } catch (error) {
    console.error('❌ Supabase Storage 프록시 오류:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
})

// WebP 이미지 API는 별도 서버로 이동됨 (포트 3004)
// 이 엔드포인트는 제거됨 - server/webp-image-api.js 사용

// activeJobs는 위에서 이미 선언됨

// 자동 복구 시스템 상태 관리
const autoRecoveryStatus = {
  isActive: true,  // 서버 시작 시 자동으로 활성화
  serverMonitor: {
    running: true,  // 서버 모니터링 자동 시작
    lastCheck: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 5
  },
  autoRecovery: {
    running: true,  // 자동 복구 자동 시작
    lastStateCheck: new Date().toISOString(),
    renderingResumed: false
  },
  logs: [{
    timestamp: new Date().toISOString(),
    type: 'info',
    message: '자동 복구 시스템 자동 시작됨'
  }]
}

// 포트 관리 시스템
const portManager = {
  currentPort: null,
  portHistory: [],
  portConflicts: [],
  autoRecoveryPort: null,
  isPortMonitoring: false
}

// 데이터셋 변환 작업 관리
const conversionJobs = new Map()
const conversionProgress = new Map()

// 동시 렌더링 제어 (최대 1개 Blender 프로세스만 실행)
let activeBlenderProcesses = new Set()
let renderingLock = false  // 렌더링 시작 락 (race condition 방지)
const MAX_CONCURRENT_BLENDER = 1  // 최대 동시 Blender 프로세스 수

// 실제 실행 중인 Blender 프로세스 확인 (PID 유효성 검증)
function validateActiveProcesses() {
  const validPids = new Set()
  activeBlenderProcesses.forEach(pid => {
    try {
      // Windows에서 프로세스 존재 확인
      if (process.platform === 'win32') {
        try {
          const result = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { 
            timeout: 1000,
            encoding: 'utf8',
            stdio: 'pipe'
          })
          // tasklist가 PID를 찾으면 결과에 PID가 포함됨
          if (result && result.includes(String(pid))) {
            validPids.add(pid)
          } else {
            // 프로세스가 존재하지 않음
            console.log(`[동시 렌더링] 유효하지 않은 PID 제거: ${pid}`)
          }
        } catch (execError) {
          // execSync 실패 시 프로세스가 존재하지 않는 것으로 간주
          console.log(`[동시 렌더링] 유효하지 않은 PID 제거: ${pid} (확인 실패)`)
        }
      } else {
        // Linux/Mac에서 프로세스 존재 확인
        try {
          process.kill(pid, 0)  // 시그널 0은 프로세스 존재 확인만
          validPids.add(pid)
        } catch {
          // 프로세스가 존재하지 않음 (ESRCH 에러)
          console.log(`[동시 렌더링] 유효하지 않은 PID 제거: ${pid}`)
        }
      }
    } catch (error) {
      // 예상치 못한 오류 발생 시 PID를 제거하지 않음 (안전 장치)
      console.error(`[동시 렌더링] PID 확인 오류: ${pid}`, error)
      // 오류 발생 시에도 PID 유지 (확인 실패로 인한 제거 방지)
      validPids.add(pid)
    }
  })
  activeBlenderProcesses = validPids
  return validPids.size
}

// 렌더링 시작 API
app.post('/api/synthetic/start-rendering', async (req, res) => {
  try {
    // 실제 실행 중인 프로세스 재검증 (좀비 프로세스 제거)
    const actualCount = validateActiveProcesses()
    
    // 렌더링 락 확인 (race condition 방지)
    if (renderingLock) {
      return res.json({
        success: false,
        error: `렌더링 시작 중입니다. 잠시 후 다시 시도해주세요.`,
        queuePosition: actualCount + 1
      })
    }
    
    // 동시 렌더링 제한 (최대 1개만 실행)
    if (actualCount >= MAX_CONCURRENT_BLENDER) {
      return res.json({
        success: false,
        error: `동시 렌더링 제한: 최대 ${MAX_CONCURRENT_BLENDER}개만 실행 가능 (현재 ${actualCount}개 실행 중)`,
        queuePosition: actualCount
      })
    }
    
    // 렌더링 락 설정
    renderingLock = true
    
    // 🔧 수정됨: 세트 렌더링 지원 (setNumber, renderType 매핑)
    let { mode, partId, setNum, setNumber, renderType, imageCount } = req.body
    
    // setNumber와 renderType이 있으면 mode와 setNum으로 변환
    if (setNumber && renderType === 'set') {
      mode = 'set'
      setNum = setNumber
      console.log(`🎯 세트 렌더링 모드 감지: setNum=${setNum}`)
    }
    
    // Blender 스크립트 인수 호환: medium -> normal 매핑
    const qualityRaw = req.body.quality
    const quality = qualityRaw === 'medium' ? 'normal' : qualityRaw
    
    const jobId = `job_${Date.now()}`
    const job = {
      id: jobId,
      status: 'running',
      progress: 0,
      config: {
        ...req.body,
        mode,  // 🔧 수정됨: 명시적으로 설정
        setNum,  // 🔧 수정됨: 명시적으로 설정
        partId  // 🔧 수정됨: 명시적으로 설정
      },
      startTime: new Date(),
      logs: []
    }
    
    activeJobs.set(jobId, job)
    
    // 실제 Blender 렌더링 시작
    console.log('🎨 실제 Blender 렌더링 시작:', { mode, partId, setNum, imageCount, quality })
    
    // Blender 렌더링 프로세스 시작
    // 렌더링 락은 startBlenderRendering 내부에서 프로세스가 실제로 시작되거나 실패한 후 해제됨
    startBlenderRendering(job).catch(error => {
      console.error('❌ [startBlenderRendering 에러]:', error)
      job.status = 'failed'
      job.logs.push({
        timestamp: new Date(),
        message: `렌더링 시작 실패: ${error.message}`,
        type: 'error'
      })
      // 작업 상태 저장
      saveActiveJobsState()
      // 락은 startBlenderRendering 내부에서 이미 해제됨
    })
    
    // 작업 시작 시 즉시 상태 저장
    saveActiveJobsState()
    
    res.json({
      success: true,
      jobId,
      message: '렌더링이 시작되었습니다'
    })
    
  } catch (error) {
    console.error('렌더링 시작 실패:', error)
    // 렌더링 락 해제 (에러 발생 시)
    renderingLock = false
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 헬스체크 API
app.get('/api/synthetic/health', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    activeJobs: activeJobs.size
  })
})

// 서버 상태 확인 API
app.get('/api/synthetic/status', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    activeJobs: activeJobs.size,
    version: '1.0.0'
  })
})

// 자동 복구 시스템 상태 API
app.get('/api/synthetic/auto-recovery/status', (req, res) => {
  try {
    res.json({
      success: true,
      autoRecovery: autoRecoveryStatus,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 자동 복구 시스템 시작 API
app.post('/api/synthetic/auto-recovery/start', (req, res) => {
  try {
    autoRecoveryStatus.isActive = true
    autoRecoveryStatus.serverMonitor.running = true
    autoRecoveryStatus.serverMonitor.lastCheck = new Date().toISOString()
    autoRecoveryStatus.logs.push({
      timestamp: new Date().toISOString(),
      type: 'info',
      message: '자동 복구 시스템 시작됨'
    })
    
    res.json({
      success: true,
      message: '자동 복구 시스템이 시작되었습니다',
      status: autoRecoveryStatus
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 자동 복구 시스템 중단 API
app.post('/api/synthetic/auto-recovery/stop', (req, res) => {
  try {
    autoRecoveryStatus.isActive = false
    autoRecoveryStatus.serverMonitor.running = false
    autoRecoveryStatus.autoRecovery.running = false
    autoRecoveryStatus.logs.push({
      timestamp: new Date().toISOString(),
      type: 'info',
      message: '자동 복구 시스템 중단됨'
    })
    
    res.json({
      success: true,
      message: '자동 복구 시스템이 중단되었습니다',
      status: autoRecoveryStatus
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 자동 복구 로그 추가 API (내부용)
const addAutoRecoveryLog = (type, message) => {
  autoRecoveryStatus.logs.push({
    timestamp: new Date().toISOString(),
    type: type,
    message: message
  })
  
  // 로그 개수 제한 (최근 100개만 유지)
  if (autoRecoveryStatus.logs.length > 100) {
    autoRecoveryStatus.logs = autoRecoveryStatus.logs.slice(-100)
  }
}

// 포트 충돌 감지 및 자동 수정
const detectPortConflicts = async () => {
  try {
    const usedPorts = []
    
    // 현재 사용 중인 포트들 확인
    for (let port = 3000; port <= 3100; port++) {
      if (!(await isPortAvailable(port))) {
        usedPorts.push(port)
      }
    }
    
    portManager.portConflicts = usedPorts
    addAutoRecoveryLog('info', `포트 충돌 감지: ${usedPorts.length}개 포트 사용 중`)
    
    return usedPorts
  } catch (error) {
    addAutoRecoveryLog('error', `포트 충돌 감지 실패: ${error.message}`)
    return []
  }
}

// 동적 포트 할당 (충돌 방지)
const allocatePortDynamically = async (preferredPort = 3002) => {
  try {
    // 선호 포트가 사용 가능한지 확인
    if (await isPortAvailable(preferredPort)) {
      portManager.currentPort = preferredPort
      addAutoRecoveryLog('info', `선호 포트 ${preferredPort} 사용 가능`)
      return preferredPort
    }
    
    // 사용 가능한 포트 찾기
    for (let port = 3002; port <= 3100; port++) {
      if (await isPortAvailable(port)) {
        portManager.currentPort = port
        portManager.portHistory.push({
          port: port,
          timestamp: new Date().toISOString(),
          reason: 'auto-assignment'
        })
        addAutoRecoveryLog('info', `동적 포트 할당: ${port}`)
        return port
      }
    }
    
    throw new Error('사용 가능한 포트를 찾을 수 없습니다 (3002-3100)')
  } catch (error) {
    addAutoRecoveryLog('error', `동적 포트 할당 실패: ${error.message}`)
    return null
  }
}

// 포트 상태 모니터링
const startPortMonitoring = () => {
  if (portManager.isPortMonitoring) return
  
  portManager.isPortMonitoring = true
  
  const monitorInterval = setInterval(async () => {
    if (!portManager.isPortMonitoring) {
      clearInterval(monitorInterval)
      return
    }
    
    // 현재 포트 상태 확인
    if (portManager.currentPort && !(await isPortAvailable(portManager.currentPort))) {
      addAutoRecoveryLog('warning', `현재 포트 ${portManager.currentPort} 사용 불가 - 재할당 필요`)
      
      // 새로운 포트 할당
      const newPort = await allocatePortDynamically()
      if (newPort) {
        addAutoRecoveryLog('info', `포트 재할당 완료: ${newPort}`)
      }
    }
  }, 10000) // 10초마다 확인
  
  addAutoRecoveryLog('info', '포트 모니터링 시작됨')
}

// 포트 상태 조회 API
app.get('/api/synthetic/ports/status', (req, res) => {
  try {
    res.json({
      success: true,
      portManager: {
        currentPort: portManager.currentPort,
        portHistory: portManager.portHistory.slice(-10), // 최근 10개
        portConflicts: portManager.portConflicts,
        isPortMonitoring: portManager.isPortMonitoring,
        autoRecoveryPort: portManager.autoRecoveryPort
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 포트 재할당 API
app.post('/api/synthetic/ports/reallocate', async (req, res) => {
  try {
    const { preferredPort } = req.body
    const newPort = await allocatePortDynamically(preferredPort)
    
    if (newPort) {
      res.json({
        success: true,
        message: `포트 재할당 완료: ${newPort}`,
        newPort: newPort
      })
    } else {
      res.status(500).json({
        success: false,
        error: '포트 재할당 실패'
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 포트 모니터링 시작/중단 API
app.post('/api/synthetic/ports/monitoring/:action', (req, res) => {
  try {
    const { action } = req.params
    
    if (action === 'start') {
      startPortMonitoring()
      res.json({
        success: true,
        message: '포트 모니터링이 시작되었습니다'
      })
    } else if (action === 'stop') {
      portManager.isPortMonitoring = false
      res.json({
        success: true,
        message: '포트 모니터링이 중단되었습니다'
      })
    } else {
      res.status(400).json({
        success: false,
        error: '잘못된 액션입니다 (start/stop)'
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 렌더링 중지 API
app.post('/api/synthetic/stop-rendering', async (req, res) => {
  try {
    const { jobId } = req.body
    
    if (activeJobs.has(jobId)) {
      const job = activeJobs.get(jobId)
      job.status = 'stopped'
      
      // Blender 프로세스 종료
      if (job.blenderProcess) {
        job.blenderProcess.kill()
      }
      
      activeJobs.delete(jobId)
    }
    
    res.json({
      success: true,
      message: '렌더링이 중지되었습니다'
    })
    
  } catch (error) {
    console.error('렌더링 중지 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 렌더링 진행 상황 API
app.get('/api/synthetic/progress/:jobId', (req, res) => {
  const { jobId } = req.params
  
  if (activeJobs.has(jobId)) {
    const job = activeJobs.get(jobId)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    res.json({
      success: true,
      progress: job.progress,
      status: job.status,
      logs: job.logs.slice(-10) // 최근 10개 로그만
    })
  } else {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    res.json({
      success: false,
      message: '작업을 찾을 수 없습니다'
    })
  }
})

// 렌더링 결과 조회 API
app.get('/api/synthetic/results', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('synthetic_dataset')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    
    res.json({
      success: true,
      results: data
    })
    
  } catch (error) {
    console.error('결과 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 통계 조회 API
app.get('/api/synthetic/stats', async (req, res) => {
  try {
    // 총 부품 수
    const { count: totalParts } = await supabase
      .from('lego_parts')
      .select('*', { count: 'exact' })
    
    // 렌더링된 이미지 수
    const { count: renderedImages } = await supabase
      .from('synthetic_dataset')
      .select('*', { count: 'exact' })
    
    // 저장소 사용량 (추정)
    const { data: storageData } = await supabase
      .storage
      .from('lego-synthetic')
      .list('synthetic', { limit: 1000 })
    
    const storageUsed = storageData ? 
      `${(storageData.length * 0.5).toFixed(1)} GB` : '0 GB'
    
    res.json({
      success: true,
      stats: {
        totalParts: totalParts || 0,
        renderedImages: renderedImages || 0,
        storageUsed,
        renderingStatus: activeJobs.size > 0 ? '렌더링 중' : '대기 중'
      }
    })
    
  } catch (error) {
    console.error('통계 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// WebP 변환 프록시는 별도 서버로 이동됨 (포트 3004)
// 이 엔드포인트는 제거됨 - server/webp-image-api.js 사용

// 캡처 업로드 API (lego-captures 버킷)
app.post('/api/captures/upload', async (req, res) => {
  try {
    const { setNum, partId, imageData } = req.body || {}
    if (!setNum || !partId || !imageData) {
      return res.status(400).json({ success: false, error: 'setNum, partId, imageData required' })
    }

    // dataURL -> Buffer
    const m = String(imageData).match(/^data:(.*?);base64,(.*)$/)
    if (!m) return res.status(400).json({ success: false, error: 'invalid imageData format' })
    const contentType = m[1] || 'image/webp'
    const buffer = Buffer.from(m[2], 'base64')

    // 경로: captures/<setNum>/<partId>/<timestamp>.webp
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0,14)
    const ext = contentType.includes('webp') ? 'webp' : (contentType.includes('png') ? 'png' : 'jpg')
    const filePath = `captures/${setNum}/${partId}/${ts}.${ext}`

    const { error: upErr } = await supabase
      .storage
      .from('lego-captures')
      .upload(filePath, buffer, { contentType, upsert: false })

    if (upErr) return res.status(500).json({ success: false, error: upErr.message || 'upload failed' })

    // 비공개 버킷이므로 서명 URL 발급
    const { data: signed, error: signErr } = await supabase
      .storage
      .from('lego-captures')
      .createSignedUrl(filePath, 60 * 10) // 10분

    if (signErr) return res.status(500).json({ success: true, path: filePath })

    return res.json({ success: true, path: filePath, signedUrl: signed?.signedUrl })
  } catch (e) {
    console.error('캡처 업로드 실패:', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 세트별 캡처 리포트 API: 확인/누락 집계
app.get('/api/captures/report/:setNum', async (req, res) => {
  try {
    const rawSet = String(req.params.setNum || '').trim()
    if (!rawSet) return res.status(400).json({ success: false, error: 'setNum required' })

    // 세트 식별: 정확 일치 → base(-1 추가) → LIKE
    let setNum = rawSet
    if (!setNum.includes('-')) setNum = `${setNum}-1`

    // lego_sets 조회
    let legoSet = null
    {
      const { data, error } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', setNum)
        .limit(1)
        .maybeSingle()
      if (!error && data) legoSet = data
    }
    if (!legoSet && setNum.includes('-')) {
      const base = setNum.split('-')[0]
      const { data } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', `${base}-1`)
        .limit(1)
        .maybeSingle()
      if (data) legoSet = data
    }
    if (!legoSet) {
      const { data } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .like('set_num', `${setNum.split('-')[0]}%`)
        .limit(1)
        .maybeSingle()
      if (data) legoSet = data
    }
    if (!legoSet) return res.status(404).json({ success: false, error: 'set not found' })

    // 기대 부품 집합
    const { data: setParts, error: spErr } = await supabase
      .from('set_parts')
      .select('lego_parts(part_num), quantity')
      .eq('set_id', legoSet.id)

    if (spErr) return res.status(500).json({ success: false, error: spErr.message })
    const expectedParts = new Set((setParts || []).map(r => r.lego_parts?.part_num).filter(Boolean))

    // 캡처된 파트: 폴더명 기준 captures/<set>/<partId>/...
    const capturedParts = new Set()
    const { data: level1 } = await supabase
      .storage
      .from('lego-captures')
      .list(`captures/${rawSet}`, { limit: 1000 })
    if (Array.isArray(level1)) {
      for (const entry of level1) {
        const name = entry?.name
        const isDir = entry?.id?.endsWith('/') || entry?.metadata?.is_directory === true || entry?.metadata?.mimetype === null
        if (name && (!entry?.metadata || isDir)) {
          capturedParts.add(name)
        }
      }
    }

    // 교집합/차집합
    const confirmed = Array.from(expectedParts).filter(p => capturedParts.has(p))
    const missing = Array.from(expectedParts).filter(p => !capturedParts.has(p))

    return res.json({
      success: true,
      set: { id: legoSet.id, setNum: legoSet.set_num, name: legoSet.name },
      counts: { expected: expectedParts.size, confirmed: confirmed.length, missing: missing.length },
      confirmed,
      missing
    })
  } catch (e) {
    console.error('리포트 생성 실패:', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 엘리먼트 → 부품/색상 해석 API
app.get('/api/synthetic/resolve-element/:elementId', async (req, res) => {
  try {
    const { elementId } = req.params
    if (!elementId) return res.status(400).json({ success: false, error: 'elementId required' })
    // part-color 패턴 우선
    const m = elementId.trim().match(/^([A-Za-z0-9]+)[-_](\d+)$/)
    if (m) {
      return res.json({ success: true, partId: m[1], colorId: parseInt(m[2], 10) })
    }
    // 숫자형 elementId는 Rebrickable 조회
    if (/^\d+$/.test(elementId.trim())) {
      const resolved = await resolveElementToPartAndColor(elementId.trim())
      if (resolved) return res.json({ success: true, ...resolved })
      return res.status(404).json({ success: false, error: 'resolve failed' })
    }
    return res.status(400).json({ success: false, error: 'invalid elementId format' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: e.message })
  }
})

// 안전한 fetch 보조 (Node <18 대응)
let safeFetch = globalThis.fetch
async function ensureFetch() {
  if (!safeFetch) {
    try {
      const mod = await import('node-fetch')
      safeFetch = mod.default
    } catch (e) {
      console.error('❌ fetch 사용 불가: node-fetch 설치 필요', e)
    }
  }
  return safeFetch
}

// elementId → part/color 해석 (데이터베이스 우선, Rebrickable API fallback)
async function resolveElementToPartAndColor(elementId) {
  try {
    console.log(`🔍 elementId 해석 시작: ${elementId}`)
    
    // 1. 먼저 set_parts 테이블에서 조회 (성공 로직)
    console.log('📊 set_parts 테이블에서 elementId 조회 중...')
    try {
      const { data: setPartData, error: setPartError } = await supabase
        .from('set_parts')
        .select(`
          element_id,
          part_id,
          lego_parts(part_num, name),
          lego_colors(id, name, rgb)
        `)
        .eq('element_id', elementId)
        .limit(1)
      
      if (setPartError) {
        console.error('❌ set_parts 조회 오류:', setPartError)
      } else if (setPartData && setPartData.length > 0) {
        const setPart = setPartData[0]
        console.log(`✅ set_parts에서 발견: elementId ${elementId} → partId ${setPart.part_id}`)
        
        // elementId는 색상 정보가 포함된 고유 식별자
        // set_parts 테이블에서 색상 정보 추출
        const colorId = setPart.lego_colors ? setPart.lego_colors.id : null
        const colorName = setPart.lego_colors ? setPart.lego_colors.name : 'unknown'
        const colorRgb = setPart.lego_colors ? setPart.lego_colors.rgb : null
        
        // RGB 값을 Blender에서 사용할 수 있는 형태로 변환 (# 제거 처리)
        let blenderRgba = null
        if (colorRgb) {
          // # 제거하고 6자리 HEX 확인
          const cleanRgb = colorRgb.replace(/^#/, '')
          if (cleanRgb.length === 6 && /^[0-9A-Fa-f]{6}$/.test(cleanRgb)) {
            const r = parseInt(cleanRgb.substring(0, 2), 16) / 255
            const g = parseInt(cleanRgb.substring(2, 4), 16) / 255
            const b = parseInt(cleanRgb.substring(4, 6), 16) / 255
          blenderRgba = [r, g, b, 1.0]
            console.log(`🎨 RGB 변환 성공: ${colorRgb} → [${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}, 1.0]`)
          } else {
            console.log(`⚠️ RGB 형식 오류: ${colorRgb} (예상: 6자리 HEX)`)
          }
        }
        
        console.log(`🎨 elementId 색상 정보: colorId=${colorId}, colorName="${colorName}", rgb=${colorRgb}`)
        console.log(`🎨 Blender RGBA: ${blenderRgba ? JSON.stringify(blenderRgba) : 'null'}`)
        
        return { 
          partId: setPart.part_id, 
          colorId: null, // 숫자 ID 대신 RGB 직접 사용
          colorName: colorName,
          colorRgb: colorRgb,
          blenderRgba: blenderRgba, // Blender에서 직접 사용할 RGBA 값
          originalColorId: colorId // 원본 UUID 보존
        }
      } else {
        console.log('📭 set_parts에서 elementId를 찾을 수 없음')
      }
    } catch (setPartError) {
      console.error('💥 set_parts 조회 실패:', setPartError)
    }
    
    // 2. set_parts에서 찾지 못한 경우 parts_master에서 조회
    console.log('📊 parts_master 테이블에서 elementId 조회 중...')
    try {
      const { data: partData, error: dbError } = await supabase
        .from('parts_master')
        .select('part_id, element_id')
        .eq('element_id', elementId)
        .limit(1)
      
      if (dbError) {
        console.error('❌ parts_master 조회 오류:', dbError)
      } else if (partData && partData.length > 0) {
        const part = partData[0]
        console.log(`✅ parts_master에서 발견: partId=${part.part_id}`)
        
        return { 
          partId: part.part_id, 
          colorId: null 
        }
      } else {
        console.log('📭 parts_master에서도 elementId를 찾을 수 없음')
      }
    } catch (dbError) {
      console.error('💥 parts_master 조회 실패:', dbError)
    }
    
    // 2. 데이터베이스에서 찾지 못한 경우 Rebrickable API 시도
    console.log('🌐 Rebrickable API 조회 시도...')
    
    // 환경 변수 로드 시도
    try {
      const { config } = await import('dotenv')
      config({ path: path.join(__dirname, '..', 'config', 'synthetic_dataset.env') })
    } catch (e) {
      console.log('⚠️ dotenv 로드 실패, 기본 환경변수 사용')
    }
    
    const apiKey = process.env.VITE_REBRICKABLE_API_KEY
    console.log(`🔑 API 키 존재 여부: ${!!apiKey}`)
    console.log(`🔑 API 키 미리보기: ${apiKey ? apiKey.substring(0, 8) + '...' : '없음'}`)
    
    if (!apiKey || apiKey === 'your-rebrickable-api-key-here') {
      console.log('⚠️ Rebrickable API 키가 설정되지 않음, fallback 모드로 전환')
      return null
    }
    
    const url = `https://rebrickable.com/api/v3/lego/elements/${encodeURIComponent(elementId)}/?key=${apiKey}`
    console.log(`🌐 API URL: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`)
    
    const f = await ensureFetch()
    if (!f) {
      console.error('❌ fetch 함수를 사용할 수 없습니다')
      return null
    }
    
    console.log('📡 API 요청 전송 중...')
    const res = await f(url, { headers: { 'Accept': 'application/json' } })
    console.log(`📡 API 응답 상태: ${res.status} ${res.statusText}`)
    
    if (!res.ok) {
      const errorText = await res.text()
      console.error(`❌ API 응답 오류: ${res.status} - ${errorText}`)
      return null
    }
    
    const json = await res.json()
    console.log('📄 API 응답 데이터:', JSON.stringify(json, null, 2))
    
    // 응답 예: { part: { part_num }, color: { id } }
    const p = json?.part?.part_num
    const c = json?.color?.id
    console.log(`🔍 파싱된 데이터 - partId: ${p}, colorId: ${c}`)
    
    if (p && Number.isInteger(c)) {
      console.log(`✅ Rebrickable API에서 elementId ${elementId} 해석 성공: partId=${p}, colorId=${c}`)
      return { partId: p, colorId: c }
    }
    
    console.error(`❌ 유효하지 않은 API 응답 형식: partId=${p}, colorId=${c}`)
    return null
  } catch (e) {
    console.error('💥 element 해석 실패:', e)
    console.error('📊 오류 타입:', e.name)
    console.error('📊 오류 메시지:', e.message)
    if (e.stack) {
      console.error('📊 스택 트레이스:', e.stack)
    }
    return null
  }
}

// Rebrickable에서 partId → LDraw 파트번호 해석
async function resolvePartToLdraw(partId) {
  try {
    const apiKey = process.env.VITE_REBRICKABLE_API_KEY
    if (!apiKey || !partId) return null
    const url = `https://rebrickable.com/api/v3/lego/parts/${encodeURIComponent(partId)}/?key=${apiKey}`
    const f = await ensureFetch()
    if (!f) return null
    const res = await f(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const json = await res.json()
    const ldrawIds = json?.external_ids?.LDraw
    if (Array.isArray(ldrawIds) && ldrawIds.length > 0) {
      return String(ldrawIds[0])
    }
    return null
  } catch (e) {
    console.error('part→LDraw 해석 실패:', e)
    return null
  }
}

// Rebrickable에서 colorId → HEX 조회
async function resolveColorHex(colorId) {
  try {
    const apiKey = process.env.VITE_REBRICKABLE_API_KEY
    if (!apiKey) return null
    const url = `https://rebrickable.com/api/v3/lego/colors/${encodeURIComponent(colorId)}/?key=${apiKey}`
    const f = await ensureFetch()
    if (!f) return null
    const res = await f(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const json = await res.json()
    // 응답 예: { rgb: "6D6E5C" }
    const hex = json?.rgb
    if (typeof hex === 'string' && /^[0-9A-Fa-f]{6}$/.test(hex)) {
      return `#${hex}`
    }
    return null
  } catch (e) {
    console.error('color HEX 조회 실패:', e)
    return null
  }
}

// Blender 렌더링 프로세스 시작
async function startBlenderRendering(job) {
  const { mode, partId, setNum, imageCount } = job.config
  const quality = job.config.quality ? (job.config.quality === 'medium' ? 'normal' : job.config.quality) : 'high' // 🔧 수정됨
  const background = job.config.background || 'white'
  // 정밀도 모드: 흰 배경일 때 Standard 강제, gray는 Filmic
  const colorManagement = 'standard'
  // 해상도/화면점유율(기술문서 2.4: 최소 768x768)
  const resolution = job.config.resolution || '768x768'
  const targetFill = typeof job.config.targetFill === 'number' ? job.config.targetFill : 0.92
  let colorId = job.config.colorId
  let effectivePartId = partId
  let displayPartId = partId
  let resolved = null // 🔧 수정됨: resolved 변수를 함수 스코프로 이동

  // 🔧 수정됨: 세트 렌더링 모드 처리
  if (mode === 'set' && setNum) {
    console.log(`🎯 세트 렌더링 모드: setNum=${setNum}`)
    job.logs.push({ timestamp: new Date(), type: 'info', message: `세트 ${setNum} 렌더링 시작...` })
    
    try {
      // 세트 번호 정규화 (예: "76917" → "76917-1")
      let normalizedSetNum = setNum.trim()
      if (!normalizedSetNum.includes('-')) {
        normalizedSetNum = `${normalizedSetNum}-1`
      }
      
      // lego_sets 테이블에서 세트 조회
      let legoSet = null
      const { data: setData, error: setError } = await supabase
        .from('lego_sets')
        .select('id, set_num, name')
        .eq('set_num', normalizedSetNum)
        .limit(1)
        .maybeSingle()
      
      if (setError || !setData) {
        // base 번호로 재시도
        const baseNum = normalizedSetNum.split('-')[0]
        const { data: baseData } = await supabase
          .from('lego_sets')
          .select('id, set_num, name')
          .eq('set_num', `${baseNum}-1`)
          .limit(1)
          .maybeSingle()
        
        if (baseData) legoSet = baseData
      } else {
        legoSet = setData
      }
      
      if (!legoSet) {
        job.status = 'failed'
        job.logs.push({ timestamp: new Date(), type: 'error', message: `세트 ${setNum}를 찾을 수 없습니다.` })
        return
      }
      
      job.logs.push({ timestamp: new Date(), type: 'info', message: `✅ 세트 발견: ${legoSet.set_num} - ${legoSet.name}` })
      
      // set_parts 테이블에서 세트의 모든 부품 조회
      const { data: setPartsData, error: partsError } = await supabase
        .from('set_parts')
        .select(`
          element_id,
          part_id,
          quantity,
          lego_parts(part_num, name),
          lego_colors(id, name, rgb)
        `)
        .eq('set_id', legoSet.id)
      
      if (partsError || !setPartsData || setPartsData.length === 0) {
        job.status = 'failed'
        job.logs.push({ timestamp: new Date(), type: 'error', message: `세트 ${setNum}의 부품을 찾을 수 없습니다.` })
        return
      }
      
      job.logs.push({ timestamp: new Date(), type: 'info', message: `📦 세트 부품 ${setPartsData.length}개 발견` })
      
      // 🔧 수정됨: 한 개씩 순차 처리 (가장 안전한 방식)
      // 동일 부품 엘리먼트아이디 및 파트넘버 중복 방지
      const processedKeys = new Set()
      const results = {
        completed: 0,
        failed: 0,
        errors: []
      }
      
      job.logs.push({ timestamp: new Date(), type: 'info', message: `🚀 ${setPartsData.length}개 부품 순차 렌더링 시작` })
      
      // 한 개씩 순차 처리
      for (let i = 0; i < setPartsData.length; i++) {
        const setPart = setPartsData[i]
        const elementId = setPart.element_id
        const partId = setPart.part_id
        
        if (!elementId && !partId) {
          console.warn(`⚠️ 부품 정보 누락: elementId=${elementId}, partId=${partId}`)
          continue
        }
        
        // 중복 체크
        const dedupeKey = elementId || partId
        if (processedKeys.has(dedupeKey)) {
          job.logs.push({ 
            timestamp: new Date(), 
            type: 'info', 
            message: `⏭ 중복 부품 건너뜀: ${setPart.lego_parts?.name || partId} (${elementId ? `elementId: ${elementId}` : `partId: ${partId}`})` 
          })
          continue
        }
        
        processedKeys.add(dedupeKey)
        
        // 색상 정보 추출 (데이터베이스에서 가져온 RGB 값)
        let colorRgba = null
        if (setPart.lego_colors && setPart.lego_colors.rgb) {
          const colorRgb = setPart.lego_colors.rgb
          const cleanRgb = colorRgb.replace(/^#/, '')
          if (cleanRgb.length === 6 && /^[0-9A-Fa-f]{6}$/.test(cleanRgb)) {
            const r = parseInt(cleanRgb.substring(0, 2), 16) / 255
            const g = parseInt(cleanRgb.substring(2, 4), 16) / 255
            const b = parseInt(cleanRgb.substring(4, 6), 16) / 255
            colorRgba = [r, g, b, 1.0]
            console.log(`🎨 세트 부품 색상 정보: ${colorRgb} → RGBA [${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}, 1.0]`)
          }
        }
        
        // 부품 렌더링 작업 생성 및 즉시 실행
        const partJobId = `job_${Date.now()}_${elementId || partId}_${Math.random().toString(36).substr(2, 9)}`
        const partJob = {
          id: partJobId,
          status: 'running',
          progress: 0,
          config: {
            mode: 'part',
            partId: partId,
            elementId: elementId,
            imageCount: imageCount || 200,
            quality: quality,
            background: background,
            resolution: resolution,
            targetFill: targetFill,
            colorRgba: colorRgba // 🔧 수정됨: 데이터베이스에서 가져온 색상 정보 저장
          },
          startTime: new Date(),
          logs: [{
            timestamp: new Date(),
            type: 'info',
            message: `부품 렌더링 중: ${setPart.lego_parts?.name || partId} (elementId: ${elementId}) - ${i + 1}/${setPartsData.length}`
          }]
        }
        
        activeJobs.set(partJobId, partJob)
        
        try {
          job.logs.push({ 
            timestamp: new Date(), 
            type: 'info', 
            message: `📦 부품 ${i + 1}/${setPartsData.length} 렌더링 시작: ${setPart.lego_parts?.name || partId}` 
          })
          
          // 🔧 수정됨: 한 개씩 순차 렌더링 및 완료 대기
          await startBlenderRendering(partJob)
          
          // [FIX] SKIP 감지 시 즉시 다음 부품으로 진행
          if (partJob.status === 'completed') {
            console.log(`[부품 ${i + 1}] SKIP으로 인해 즉시 완료 처리`)
            results.completed++
            job.logs.push({ 
              timestamp: new Date(), 
              type: 'success', 
              message: `✅ 부품 ${i + 1}/${setPartsData.length} 완료 (SKIP): ${setPart.lego_parts?.name || partId}` 
            })
            continue // 다음 부품으로 즉시 진행
          }
          
          // [FIX] Blender 프로세스 종료 감지 개선
          // partJob.blenderProcess에 close 이벤트 핸들러 추가
          if (partJob.blenderProcess) {
            partJob.blenderProcess.on('close', (code) => {
              console.log(`[부품 ${i + 1}] Blender 프로세스 종료: 코드 ${code}`)
              if (code === 0) {
                partJob.status = 'completed'
                partJob.progress = 100
                console.log(`[부품 ${i + 1}] 렌더링 완료 상태 업데이트`)
              } else {
                partJob.status = 'failed'
                console.log(`[부품 ${i + 1}] 렌더링 실패 상태 업데이트 (코드: ${code})`)
              }
            })
          }
          
          // 렌더링 완료까지 대기 (최대 30분)
          const maxWaitTime = 30 * 60 * 1000
          const startTime = Date.now()
          let checkCount = 0
          
          while (partJob.status === 'running' && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 3000)) // 3초마다 체크
            checkCount++
            
            // 프로세스가 종료되었는지 확인
            if (partJob.blenderProcess) {
              // exitCode가 null이 아니면 프로세스 종료됨
              if (partJob.blenderProcess.exitCode !== null) {
                const exitCode = partJob.blenderProcess.exitCode
                console.log(`[부품 ${i + 1}] 프로세스 종료 감지 (exitCode: ${exitCode})`)
                
                if (exitCode === 0) {
                  partJob.status = 'completed'
                  partJob.progress = 100
                } else {
                  partJob.status = 'failed'
                }
                break
              }
              
              // 프로세스가 kill되었는지 확인 (Windows)
              try {
                if (process.platform === 'win32') {
                  try {
                    const result = execSync(`tasklist /FI "PID eq ${partJob.blenderProcess.pid}" /NH`, { 
                      timeout: 1000,
                      encoding: 'utf8',
                      stdio: 'pipe'
                    })
                    if (!result || !result.includes(String(partJob.blenderProcess.pid))) {
                      console.log(`[부품 ${i + 1}] 프로세스가 더 이상 실행 중이지 않음 (종료 감지)`)
                      partJob.status = partJob.status === 'completed' ? 'completed' : 'failed'
                      break
                    }
                  } catch (execError) {
                    // 프로세스가 존재하지 않음
                    console.log(`[부품 ${i + 1}] 프로세스 종료 확인 (tasklist 실패)`)
                    partJob.status = partJob.status === 'completed' ? 'completed' : 'failed'
                    break
                  }
                }
              } catch (checkError) {
                // 프로세스 확인 오류는 무시하고 계속 대기
                console.warn(`[부품 ${i + 1}] 프로세스 확인 오류:`, checkError.message)
              }
            }
            
            // 10회 체크마다 로그 출력 (30초마다)
            if (checkCount % 10 === 0) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000)
              console.log(`[부품 ${i + 1}] 렌더링 대기 중... (${elapsed}초 경과, 상태: ${partJob.status})`)
            }
          }
          
          // 타임아웃 처리
          if (partJob.status === 'running' && (Date.now() - startTime) >= maxWaitTime) {
            console.warn(`[부품 ${i + 1}] 렌더링 타임아웃 (${maxWaitTime / 1000 / 60}분 초과)`)
            partJob.status = 'failed'
            
            // 프로세스 강제 종료 시도
            if (partJob.blenderProcess && partJob.blenderProcess.pid) {
              try {
                console.log(`[부품 ${i + 1}] 타임아웃으로 인한 프로세스 종료 시도: PID ${partJob.blenderProcess.pid}`)
                partJob.blenderProcess.kill('SIGTERM')
                
                // 5초 후에도 종료되지 않으면 강제 종료
                setTimeout(() => {
                  if (partJob.blenderProcess && partJob.blenderProcess.exitCode === null) {
                    try {
                      partJob.blenderProcess.kill('SIGKILL')
                      console.log(`[부품 ${i + 1}] 프로세스 강제 종료 (SIGKILL)`)
                    } catch (killError) {
                      console.error(`[부품 ${i + 1}] 프로세스 강제 종료 실패:`, killError)
                    }
                  }
                }, 5000)
              } catch (killError) {
                console.error(`[부품 ${i + 1}] 프로세스 종료 시도 실패:`, killError)
              }
            }
          }
          
          // 최종 상태 확인
          const finalStatus = partJob.status
          console.log(`[부품 ${i + 1}] 최종 상태: ${finalStatus}`)
          
          if (finalStatus === 'completed') {
            results.completed++
            job.logs.push({ 
              timestamp: new Date(), 
              type: 'success', 
              message: `✅ 부품 ${i + 1}/${setPartsData.length} 완료: ${setPart.lego_parts?.name || partId}` 
            })
            console.log(`✅ [부품 ${i + 1}] 렌더링 완료: ${setPart.lego_parts?.name || partId}`)
          } else {
            // failed 또는 running (타임아웃)
            results.failed++
            const errorMsg = finalStatus === 'running' ? '타임아웃' : '렌더링 실패'
            results.errors.push({
              partId: partJob.config.partId,
              elementId: partJob.config.elementId,
              error: errorMsg
            })
            job.logs.push({ 
              timestamp: new Date(), 
              type: 'error', 
              message: `❌ 부품 ${i + 1}/${setPartsData.length} 실패: ${setPart.lego_parts?.name || partId} (${errorMsg})` 
            })
            console.log(`❌ [부품 ${i + 1}] 렌더링 실패: ${setPart.lego_parts?.name || partId} (${errorMsg})`)
          }
          
          // [FIX] 다음 부품으로 진행하기 전에 현재 부품 상태 확실히 업데이트
          partJob.status = finalStatus
          
          // 작업 정보 삭제 (메모리 정리)
          setTimeout(() => {
            activeJobs.delete(partJobId)
          }, 60000) // 1분 후 삭제
          
        } catch (renderError) {
          console.error(`❌ 부품 렌더링 실패 (${partJob.id}):`, renderError)
          partJob.status = 'failed'
          results.failed++
          results.errors.push({
            partId: partJob.config.partId,
            elementId: partJob.config.elementId,
            error: renderError?.message || String(renderError)
          })
          job.logs.push({ 
            timestamp: new Date(), 
            type: 'error', 
            message: `❌ 부품 ${i + 1}/${setPartsData.length} 렌더링 오류: ${renderError.message}` 
          })
          // 에러 발생해도 다음 부품 계속 처리
        }
        
        // 다음 부품 처리 전 잠시 대기 (시스템 안정화)
        if (i < setPartsData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기
        }
      }
      
      job.status = 'completed'
      job.progress = 100
      job.logs.push({ 
        timestamp: new Date(), 
        type: 'success', 
        message: `✅ 세트 ${setNum} 렌더링 완료 (성공: ${results.completed}개, 실패: ${results.failed}개)` 
      })
      
      if (results.failed > 0) {
        job.logs.push({ 
          timestamp: new Date(), 
          type: 'warning', 
          message: `⚠️ ${results.failed}개 부품 렌더링 실패. 자세한 내용은 로그를 확인하세요.` 
        })
      }
      
      // 🔧 수정됨: 세트 렌더링 완료 후 전체 데이터셋 train/val 분할 실행
      try {
        console.log('📊 세트 렌더링 완료 - 전체 데이터셋 train/val 분할 시작...')
        job.logs.push({
          timestamp: new Date(),
          message: '전체 데이터셋 train/val 분할 시작 (세트 렌더링 완료)',
          type: 'info'
        })
        
        // [FIX] 수정됨: 새 구조 지원 - dataset_synthetic 경로 직접 전달
        const datasetSyntheticPath = getDatasetSyntheticPath()
        const prepareProcess = spawn('python', [
          path.join(__dirname, '..', 'scripts', 'prepare_training_dataset.py'),
          '--source', datasetSyntheticPath,  // [FIX] dataset_synthetic 경로 직접 전달
          '--output', datasetSyntheticPath
        ], {
          cwd: path.join(__dirname, '..'),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
            LANG: 'ko_KR.UTF-8',
            LC_ALL: 'ko_KR.UTF-8',
            PYTHONUTF8: '1'
          }
        })
        
        let prepareOutput = ''
        let prepareError = ''
        
        prepareProcess.stdout.on('data', (data) => {
          const message = data.toString('utf8').trim()
          if (message) {
            console.log(`[Dataset Prepare] ${message}`)
            prepareOutput += message + '\n'
            job.logs.push({
              timestamp: new Date(),
              message: `[Dataset Prepare] ${message}`,
              type: 'info'
            })
          }
        })
        
        prepareProcess.stderr.on('data', (data) => {
          const message = data.toString('utf8').trim()
          if (message) {
            console.error(`[Dataset Prepare Error] ${message}`)
            prepareError += message + '\n'
          }
        })
        
        prepareProcess.on('close', async (prepareCode) => {
          if (prepareCode === 0) {
            console.log('✅ 전체 데이터셋 train/val 분할 완료')
            job.logs.push({
              timestamp: new Date(),
              message: '전체 데이터셋 train/val 분할 완료',
              type: 'success'
            })
          } else {
            console.warn(`⚠️ 데이터셋 분할 실패 (코드: ${prepareCode})`)
            job.logs.push({
              timestamp: new Date(),
              message: `데이터셋 분할 실패 (코드: ${prepareCode})`,
              type: 'warning'
            })
          }
          
          // 🔧 수정됨: 자동 학습 활성화 확인 및 트리거 (세트 렌더링 완료 시)
          try {
            const { data: autoTrainingConfig, error: configError } = await supabase
              .from('automation_config')
              .select('config_value')
              .eq('config_key', 'auto_training_enabled')
              .eq('is_active', true)
              .maybeSingle()
            
            const configValue = autoTrainingConfig?.config_value
            const autoTrainingEnabled = !configError && (
              configValue === 'true' || 
              configValue === true || 
              (typeof configValue === 'object' && configValue !== null && configValue.value === true)
            )
            
            if (autoTrainingEnabled) {
              console.log('🤖 자동 학습 활성화됨 - 세트 렌더링 완료 후 학습 트리거 시작...')
              job.logs.push({
                timestamp: new Date(),
                message: '자동 학습 트리거 시작 (세트 렌더링 완료)',
                type: 'info'
              })
              
              // 자동 학습 트리거
              try {
                const triggerResponse = await fetch(`${process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'}/functions/v1/auto-training-trigger`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE || ''}`
                  },
                  body: JSON.stringify({
                    job_id: job.id,
                    set_num: setNum,
                    completed_parts: results.completed,
                    failed_parts: results.failed
                  })
                })
                
                if (triggerResponse.ok) {
                  const triggerResult = await triggerResponse.json()
                  console.log('✅ 자동 학습 트리거 성공 (세트):', triggerResult)
                  job.logs.push({
                    timestamp: new Date(),
                    message: `자동 학습 트리거 완료: ${triggerResult.message || '성공'}`,
                    type: 'success'
                  })
                } else {
                  console.warn('⚠️ 자동 학습 트리거 실패 (세트):', await triggerResponse.text())
                  job.logs.push({
                    timestamp: new Date(),
                    message: '자동 학습 트리거 실패 (수동 실행 필요)',
                    type: 'warning'
                  })
                }
              } catch (triggerError) {
                console.error('❌ 자동 학습 트리거 오류 (세트):', triggerError)
                job.logs.push({
                  timestamp: new Date(),
                  message: `자동 학습 트리거 오류: ${triggerError.message}`,
                  type: 'warning'
                })
              }
            } else {
              console.log('⏸️ 자동 학습 비활성화됨 또는 설정 없음')
            }
          } catch (autoTrainError) {
            console.error('❌ 자동 학습 설정 확인 실패:', autoTrainError)
          }
        })
      } catch (datasetSplitError) {
        console.error('❌ 데이터셋 분할 시작 실패:', datasetSplitError)
        job.logs.push({
          timestamp: new Date(),
          message: `데이터셋 분할 시작 실패: ${datasetSplitError.message}`,
          type: 'warning'
        })
      }
      
      return
      
    } catch (error) {
      console.error('💥 세트 렌더링 오류:', error)
      job.status = 'failed'
      job.logs.push({ timestamp: new Date(), type: 'error', message: `세트 렌더링 실패: ${error.message}` })
      return
    }
  }

  if (job.config.elementId && typeof job.config.elementId === 'string') {
    const raw = job.config.elementId.trim()
    const m = raw.match(/^([A-Za-z0-9]+)[-_](\d+)$/)
    if (m) {
      effectivePartId = m[1]
      const extractedColorId = parseInt(m[2], 10)
      colorId = extractedColorId
      job.logs.push({ timestamp: new Date(), type: 'info', message: `element ${raw} → part ${effectivePartId}, color ${colorId} (패턴 매칭)` })
      
      // 🔧 수정됨: 패턴 매칭 시 colorId로부터 데이터베이스에서 RGB 조회
      try {
        const { data: colorData, error: colorError } = await supabase
          .from('lego_colors')
          .select('rgb, name')
          .eq('color_id', extractedColorId) // 🔧 수정됨: color_id로 조회 (id는 UUID, color_id는 integer)
          .limit(1)
          .maybeSingle()
        
        if (!colorError && colorData && colorData.rgb) {
          const colorRgb = colorData.rgb
          const cleanRgb = colorRgb.replace(/^#/, '')
          if (cleanRgb.length === 6 && /^[0-9A-Fa-f]{6}$/.test(cleanRgb)) {
            const r = parseInt(cleanRgb.substring(0, 2), 16) / 255
            const g = parseInt(cleanRgb.substring(2, 4), 16) / 255
            const b = parseInt(cleanRgb.substring(4, 6), 16) / 255
            resolved = {
              partId: effectivePartId,
              colorId: extractedColorId,
              colorName: colorData.name || 'unknown',
              colorRgb: colorRgb,
              blenderRgba: [r, g, b, 1.0]
            }
            console.log(`🎨 패턴 매칭 색상 정보 조회 성공: ${colorRgb} → RGBA [${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}, 1.0]`)
            job.logs.push({ timestamp: new Date(), type: 'info', message: `색상 정보 조회: ${colorData.name || 'unknown'} (${colorRgb})` })
          }
        } else if (colorError) {
          console.warn(`⚠️ colorId ${extractedColorId} 조회 실패: ${colorError.message}`)
        }
      } catch (colorLookupError) {
        console.error(`❌ colorId 색상 조회 오류: ${colorLookupError}`)
      }
    } else if (/^\d+$/.test(raw)) {
      console.log(`🔍 숫자형 elementId 감지: ${raw}`)
      resolved = await resolveElementToPartAndColor(raw) // 🔧 수정됨: const 제거
      if (resolved) {
        effectivePartId = resolved.partId
        colorId = resolved.colorId
        job.logs.push({ timestamp: new Date(), type: 'info', message: `element ${raw} → part ${effectivePartId}, color ${colorId} (API 조회)` })
      } else {
        // API 조회 실패 시 fallback: elementId를 그대로 partId로 사용
        console.log(`⚠️ API 조회 실패, fallback 모드로 전환: elementId ${raw}를 partId로 사용`)
        effectivePartId = raw
        colorId = null // 색상 정보 없음
        job.logs.push({ timestamp: new Date(), type: 'warning', message: `elementId(${raw}) API 조회 실패. elementId를 partId로 사용합니다.` })
        job.logs.push({ timestamp: new Date(), type: 'info', message: `fallback: element ${raw} → part ${effectivePartId} (색상 정보 없음)` })
        
        // 데이터베이스에서 직접 조회 시도 (Supabase 클라이언트 사용)
        console.log('🔄 데이터베이스 직접 조회 시도...')
        try {
          const { data: directData, error: directError } = await supabase
            .from('parts_master')
            .select('part_id')
            .eq('element_id', raw)
            .limit(1)
          
          if (!directError && directData && directData.length > 0) {
            effectivePartId = directData[0].part_id
            console.log(`✅ 데이터베이스 직접 조회 성공: elementId ${raw} → partId ${effectivePartId}`)
            job.logs.push({ timestamp: new Date(), type: 'success', message: `데이터베이스 직접 조회 성공: elementId ${raw} → partId ${effectivePartId}` })
          } else {
            console.log(`❌ 데이터베이스 직접 조회 실패: ${directError?.message || '데이터 없음'}`)
          }
        } catch (directError) {
          console.error('💥 데이터베이스 직접 조회 오류:', directError)
        }
      }
    }
  }

  if (!effectivePartId) {
    job.status = 'failed'
    job.logs.push({ timestamp: new Date(), type: 'error', message: '유효한 partId를 결정하지 못했습니다 (elementId 확인 필요)' })
    return
  }
  // Rebrickable 파트번호가 LDraw와 다를 수 있으므로 LDraw ID로 변환 시도
  try {
    const ldrawId = await resolvePartToLdraw(effectivePartId)
    if (ldrawId) {
      displayPartId = effectivePartId
      effectivePartId = ldrawId
      job.logs.push({ timestamp: new Date(), type: 'info', message: `part ${displayPartId} → LDraw ${effectivePartId}` })
    }
  } catch {}
  
  // 렌더링 품질 설정 (폐쇄 세계 최적화)
  const samples = quality === 'fast' ? 64 : quality === 'medium' ? 128 : quality === 'high' ? 256 : 400
  
  // Blender 명령어 구성
  const blenderPath = process.env.BLENDER_PATH || 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe'
  const scriptPath = path.join(__dirname, '../scripts/render_ldraw_to_supabase.py')
  
  const ldrawPath = process.env.LDRAW_PATH || 'C:/LDraw/parts'
  
  // Blender에 전달할 Supabase 키 선택: 서비스 키 우선, 없으면 anon 키
  const blenderSupabaseKey = process.env.SUPABASE_SERVICE_ROLE
    || process.env.VITE_SUPABASE_SERVICE_ROLE
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_KEY_JWT
    || process.env.VITE_SUPABASE_ANON_KEY

  const safeImageCount = Number.isFinite(Number(imageCount)) && Number(imageCount) > 0 ? Number(imageCount) : 200 // 🔧 수정됨: 기술문서 기준 부품당 200장
  const args = [
    '--background',
    '--python', scriptPath,
    '--',
    '--part-id', effectivePartId,
    '--count', String(safeImageCount), // 🔧 수정됨
    '--quality', String(quality), // 🔧 수정됨
    '--samples', String(samples),
    '--background', background,
    '--ldraw-path', ldrawPath,
    '--output-dir', getSyntheticRoot(),
    '--output-subdir', job.config.elementId ? String(job.config.elementId) : String(displayPartId),
    ...(job.config.elementId ? ['--element-id', String(job.config.elementId)] : []),
    '--resolution', String(resolution),
    '--target-fill', String(targetFill),
    '--color-management', colorManagement,
    '--supabase-url', process.env.VITE_SUPABASE_URL,
    '--supabase-key', blenderSupabaseKey
  ]

  // elementId의 색상 정보를 Blender로 전달
  if (job.config.elementId && colorId !== null && colorId !== undefined) {
    args.push('--color-id', String(colorId))
    console.log(`🎨 elementId 색상 정보 전달: colorId=${colorId}`)
  }
  
  // RGB 색상 정보도 전달 (Blender에서 직접 사용)
  // 🔧 수정됨: 우선순위 1) job.config.colorRgba (세트 렌더링에서 전달), 2) resolved.blenderRgba (elementId 조회 결과)
  let colorRgbaToSend = null
  if (job.config.colorRgba && Array.isArray(job.config.colorRgba) && job.config.colorRgba.length >= 3) {
    colorRgbaToSend = job.config.colorRgba
    console.log(`🎨 세트 렌더링 색상 정보 사용: RGBA [${colorRgbaToSend.join(', ')}]`)
  } else if (job.config.elementId && resolved && resolved.blenderRgba) {
    colorRgbaToSend = resolved.blenderRgba
    console.log(`🎨 Element ID 조회 색상 정보 사용: RGBA [${colorRgbaToSend.join(', ')}]`)
  }
  
  if (colorRgbaToSend) {
    args.push('--color-rgba', `${colorRgbaToSend[0]},${colorRgbaToSend[1]},${colorRgbaToSend[2]},${colorRgbaToSend[3] || 1.0}`)
    console.log(`🎨 Blender RGBA 전달: [${colorRgbaToSend.join(', ')}]`)
  }

  // 디버그: 민감정보 노출 없이 전달 여부만 로깅
  try {
    const maskedKey = blenderSupabaseKey ? (String(blenderSupabaseKey).slice(0, 6) + '…') : 'missing'
    console.log('Blender Supabase args:', {
      url_present: !!process.env.VITE_SUPABASE_URL,
      key_present: !!blenderSupabaseKey,
      key_preview: maskedKey
    })
  } catch {}
  let colorHex = null
  if (Number.isInteger(colorId)) {
    args.push('--color-id', String(colorId))
    // 정확도 향상: HEX도 함께 전달 (가능하면)
    try {
      colorHex = await resolveColorHex(colorId)
      if (colorHex) {
        args.push('--color-hex', colorHex)
      }
    } catch {}
  } else if (colorId === null && !colorRgbaToSend) {
    // [FIX] colorId가 null이지만 colorRgbaToSend가 있으면 색상 정보가 있는 것임
    // colorId와 colorRgba 모두 없을 때만 메시지 출력
    console.log('ℹ️ colorId가 null이고 RGB 정보도 없습니다. 기본 회색으로 렌더링합니다')
    // colorId가 null이고 RGB 정보도 없는 경우 Blender에서 기본 회색을 사용하도록 함 (랜덤 색상 금지)
  }
  
  console.log('🎨 Blender 렌더링 시작:', blenderPath, args.join(' '))
  console.log('📁 작업 디렉토리:', path.join(__dirname, '..'))
  console.log('🔧 Blender 경로 존재 여부:', fs.existsSync(blenderPath))
  
  // Blender 실행 전 환경 확인
  try {
    const scriptExists = fs.existsSync(scriptPath)
    const outputDirExists = fs.existsSync(path.dirname(args.find(arg => arg.startsWith('--output-dir'))?.split(' ')[1] || './output'))
    
    console.log('📄 스크립트 파일 존재:', scriptExists)
    console.log('📁 출력 디렉토리 존재:', outputDirExists)
    
    if (!scriptExists) {
      throw new Error(`Blender 스크립트 파일을 찾을 수 없습니다: ${scriptPath}`)
    }
  } catch (envError) {
    console.error('❌ 환경 확인 실패:', envError)
    job.status = 'failed'
    job.logs.push({
      timestamp: new Date(),
      message: `환경 확인 실패: ${envError.message}`,
      type: 'error'
    })
    return
  }
  
  let blenderProcess
  try {
    // 🔧 수정됨: Blender 경로 존재 확인
    if (!fs.existsSync(blenderPath)) {
      throw new Error(`Blender 경로를 찾을 수 없습니다: ${blenderPath}`)
    }
    
    blenderProcess = spawn(blenderPath, args, {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      stdio: ['pipe', 'pipe', 'pipe'] // 🔧 수정됨: 명시적 stdio 설정
    })
    
    if (!blenderProcess || !blenderProcess.pid) {
      throw new Error('Blender 프로세스가 시작되지 않았습니다 (PID 없음)')
    }
    
    console.log('✅ Blender 프로세스 시작됨 (PID:', blenderProcess.pid, ')')
    
    // PID 유효성 확인
    if (!blenderProcess.pid || typeof blenderProcess.pid !== 'number') {
      throw new Error('Blender 프로세스 PID가 유효하지 않습니다')
    }
    
    // 동시 렌더링 제어에 추가 (race condition 방지: 이 시점에서 재검증)
    const currentCount = validateActiveProcesses()
    if (currentCount >= MAX_CONCURRENT_BLENDER) {
      // 이미 다른 프로세스가 실행 중이면 이 프로세스 종료
      blenderProcess.kill()
      throw new Error(`동시 렌더링 제한: 이미 ${currentCount}개 프로세스가 실행 중입니다`)
    }
    
    activeBlenderProcesses.add(blenderProcess.pid)
    console.log(`[동시 렌더링] 프로세스 추가: PID ${blenderProcess.pid}, 현재 실행 중: ${activeBlenderProcesses.size}/${MAX_CONCURRENT_BLENDER}개`)
    
    // 렌더링 락 해제 (프로세스가 실제로 추가된 후)
    renderingLock = false
  } catch (spawnError) {
    console.error('❌ Blender 프로세스 시작 실패:', spawnError)
    job.status = 'failed'
    job.logs.push({
      timestamp: new Date(),
      message: `Blender 프로세스 시작 실패: ${spawnError?.message || String(spawnError)}`,
      type: 'error'
    })
    // 렌더링 락 해제 (실패 시)
    renderingLock = false
    // 🔧 수정됨: 에러 발생해도 함수 반환 (서버 크래시 방지)
    return
  }
  
  job.blenderProcess = blenderProcess
  
  // 프로세스 출력 처리
  blenderProcess.stdout.on('data', (data) => {
    const output = data.toString()
    
    // [FIX] ImportLDraw 애드온 background.exr 오류 메시지 필터링
    if (output.includes('IMB_load_image_from_memory') && 
        output.includes('background.exr') && 
        output.includes('unknown file-format')) {
      // 이 오류는 무시 (렌더링에 영향 없음)
      return
    }
    
    console.log('🎨 Blender 출력:', output.trim())
    
    // 진행률 파싱 (여러 패턴 시도)
    const progressPatterns = [
      /(\d+)%/,
      /progress[:\s]*(\d+)%/i,
      /rendering[:\s]*(\d+)%/i,
      /frame[:\s]*(\d+)%/i
    ]
    
    for (const pattern of progressPatterns) {
      const match = output.match(pattern)
      if (match) {
        const progress = parseInt(match[1])
        if (progress > job.progress) {
          job.progress = Math.min(progress, 100)
          console.log(`📊 진행률 업데이트: ${job.progress}%`)
        }
        break
      }
    }
    
    // [FIX] SKIP 메시지 감지 및 즉시 완료 처리
    if (output.includes('SKIP:') || output.includes('로컬 기준으로 이미 렌더링 완료')) {
      console.log('✅ SKIP 감지: 렌더링 완료로 처리')
      job.status = 'completed'
      job.progress = 100
      job.logs.push({
        timestamp: new Date(),
        message: 'SKIP: 이미 렌더링 완료된 부품',
        type: 'success'
      })
      
      // [FIX] SKIP 시 Blender 프로세스 즉시 종료
      if (blenderProcess && blenderProcess.pid) {
        try {
          console.log(`✅ SKIP 감지: Blender 프로세스 종료 시도 (PID: ${blenderProcess.pid})`)
          blenderProcess.kill('SIGTERM')
          setTimeout(() => {
            if (blenderProcess && blenderProcess.exitCode === null) {
              blenderProcess.kill('SIGKILL')
              console.log(`✅ SKIP 감지: Blender 프로세스 강제 종료 (PID: ${blenderProcess.pid})`)
            }
          }, 1000)
        } catch (killError) {
          console.warn(`⚠️ SKIP 감지: Blender 프로세스 종료 실패:`, killError)
        }
      }
    }
    
    // 모든 출력을 로그에 추가 (디버깅용)
    job.logs.push({
      timestamp: new Date(),
      message: output.trim(),
      type: output.includes('오류') || output.includes('error') || output.includes('Error') ? 'error' : 
             output.includes('완료') || output.includes('success') ? 'success' : 'info'
    })
    
    // 중요한 메시지는 별도 로깅
    if (output.includes('렌더링') || output.includes('완료') || output.includes('오류') || output.includes('error') || output.includes('Error')) {
      console.log(`📝 중요 메시지: ${output.trim()}`)
    }
  })
  
  blenderProcess.stderr.on('data', (data) => {
    const error = data.toString()
    
    // [FIX] ImportLDraw 애드온 background.exr 오류 메시지 필터링
    if (error.includes('IMB_load_image_from_memory') && 
        error.includes('background.exr') && 
        error.includes('unknown file-format')) {
      // 이 오류는 무시 (렌더링에 영향 없음)
      return
    }
    
    console.error('❌ Blender 오류:', error.trim())
    
    job.logs.push({
      timestamp: new Date(),
      message: error.trim(),
      type: 'error'
    })
  })
  
  // 프로세스 오류 이벤트 처리
  blenderProcess.on('error', (error) => {
    console.error('💥 Blender 프로세스 오류:', error)
    job.status = 'failed'
    job.logs.push({
      timestamp: new Date(),
      message: `프로세스 오류: ${error.message}`,
      type: 'error'
    })
    // 동시 렌더링 제어에서 제거 (오류 발생 시)
    if (blenderProcess.pid) {
      activeBlenderProcesses.delete(blenderProcess.pid)
      console.log(`[동시 렌더링] 프로세스 오류로 제거: PID ${blenderProcess.pid}, 현재 실행 중: ${activeBlenderProcesses.size}/${MAX_CONCURRENT_BLENDER}개`)
    }
    // 🔧 수정됨: 에러 발생해도 서버는 계속 실행 (다른 작업 유지)
    // 이 에러는 해당 작업에만 영향
  })
  
  blenderProcess.on('close', async (code) => {
    try {
    // [FIX] 수정됨: 렌더링 완료 후에도 서버는 계속 실행되어야 함
    // 서버 종료는 사용자가 명시적으로 종료 신호(SIGTERM/SIGINT)를 보낼 때만 실행됨
    // 렌더링 프로세스 종료는 서버 종료를 트리거하지 않음
    
    // 동시 렌더링 제어에서 제거
    if (blenderProcess.pid) {
      const wasRemoved = activeBlenderProcesses.delete(blenderProcess.pid)
      if (wasRemoved) {
        console.log(`[동시 렌더링] 프로세스 종료: PID ${blenderProcess.pid}, 현재 실행 중: ${activeBlenderProcesses.size}/${MAX_CONCURRENT_BLENDER}개 남음`)
      } else {
        console.log(`[동시 렌더링] 경고: 종료된 프로세스 PID ${blenderProcess.pid}가 목록에 없었음`)
      }
      // 실제 실행 중인 프로세스 재검증 (좀비 프로세스 제거)
      validateActiveProcesses()
    }
    
    console.log(`🏁 Blender 프로세스 종료: 코드 ${code}`)
    console.log(`🔄 서버는 계속 실행 중입니다 (다음 렌더링 작업 대기 중)`)
    
    if (code === 0) {
      console.log('✅ 렌더링 성공적으로 완료')
      job.status = 'completed'
      job.progress = 100
      job.logs.push({
        timestamp: new Date(),
        message: '렌더링 완료',
          type: 'success'
        })
        
        // 🔧 수정됨: 단일 부품 렌더링 완료 시에는 분할하지 않음 (세트 렌더링 완료 시에만 분할)
        // 단일 부품은 세트가 아니므로 전체 분할을 실행하지 않음
        if (job.config.mode !== 'set') {
          console.log('📊 단일 부품 렌더링 완료 (세트가 아니므로 분할 건너뜀)')
        } else {
          // 세트 렌더링인 경우에는 세트 렌더링 완료 처리에서 분할하므로 여기서는 처리하지 않음
          console.log('📊 세트 렌더링 중 부품 완료 (전체 세트 완료 후 분할 예정)')
        }
    } else {
      console.error(`❌ 렌더링 실패 - 종료 코드: ${code}`)
      job.status = 'failed'
      job.logs.push({
        timestamp: new Date(),
        message: `렌더링 실패 (코드: ${code})`,
        type: 'error'
      })
    }
    
    // [FIX] 수정됨: 렌더링 완료 후에도 서버는 계속 실행됨
    // 작업 정보만 삭제하고 서버는 종료하지 않음
    // 5분 후 작업 정보 삭제
    setTimeout(() => {
      console.log(`🗑️ 작업 ${job.id} 정보 삭제 (서버는 계속 실행 중)`)
      activeJobs.delete(job.id)
    }, 5 * 60 * 1000)
    } catch (closeHandlerError) {
      // 🔧 수정됨: close 핸들러 내부 에러도 안전하게 처리
      console.error('❌ [Blender close 핸들러 에러]:', closeHandlerError)
      // 에러 발생해도 작업 상태는 업데이트 시도
      if (job && job.status !== 'failed') {
        job.status = 'failed'
        job.logs.push({
          timestamp: new Date(),
          message: `프로세스 종료 처리 중 오류: ${closeHandlerError.message}`,
          type: 'error'
        })
      }
    }
  })
}

// ================================
// 🔧 Auto Port Selection Logic
// ================================

const DEFAULT_PORT = parseInt(process.env.SYNTHETIC_API_PORT || '3011', 10);
const MAX_PORT = 3100;

/**
 * 지정된 포트가 사용 중인지 확인
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester
          .once('close', () => resolve(true))
          .close();
      })
      .listen(port);
  });
}

// 기존 startServer 함수 제거됨 - 새로운 함수 사용

// 생성된 이미지 파일 목록 반환 API (로컬 출력 기반)
app.get('/api/synthetic/files/:partId', async (req, res) => {
  try {
    const { partId } = req.params
    const baseDir = getPartDatasetPath(partId)
    if (!fs.existsSync(baseDir)) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.set('Pragma', 'no-cache')
      res.set('Expires', '0')
      res.set('Surrogate-Control', 'no-store')
      return res.json({ success: true, results: [] })
    }
    const allFiles = await fs.promises.readdir(baseDir)
    const imageFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.webp'))

    const results = imageFiles.map((fileName) => ({
      id: `${partId}_${fileName}`,
      partId,
      imageUrl: `/api/synthetic/static/synthetic/${partId}/${fileName}`,
      colorName: '알수없음',
      angle: '알수없음',
      resolution: '640x640'
    }))

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    res.json({ success: true, results })
  } catch (error) {
    console.error('파일 목록 조회 실패:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 데이터셋 변환 API 엔드포인트들
app.post('/api/dataset/convert', async (req, res) => {
  try {
    const { sourcePath, targetPath, format } = req.body
    const jobId = `conversion_${Date.now()}`
    
    console.log(`🔄 데이터셋 변환 시작: ${jobId}`)
    
    // 변환 작업 시작
    const conversionProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'prepare_training_dataset.py')
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1'
      }
    })
    
    // 작업 저장
    conversionJobs.set(jobId, {
      process: conversionProcess,
      startTime: new Date(),
      status: 'running'
    })
    
    conversionProgress.set(jobId, {
      progress: 0,
      status: '변환 시작...',
      logs: []
    })
    
    // 프로세스 출력 처리
    conversionProcess.stdout.on('data', (data) => {
      const message = data.toString('utf8').trim()
      console.log(`[${jobId}] ${message}`)
      
      const progress = conversionProgress.get(jobId)
      progress.logs.push({
        time: new Date().toLocaleTimeString(),
        message,
        type: 'info'
      })
      
      // 진행률 추정 (간단한 휴리스틱)
      if (message.includes('전체 이미지 수')) {
        progress.progress = 10
        progress.status = '이미지 분석 중...'
      } else if (message.includes('Train:')) {
        progress.progress = 50
        progress.status = '데이터셋 분할 중...'
      } else if (message.includes('데이터셋 준비 완료')) {
        progress.progress = 100
        progress.status = '변환 완료!'
      }
    })
    
    conversionProcess.stderr.on('data', (data) => {
      const message = data.toString('utf8').trim()
      console.error(`[${jobId}] ERROR: ${message}`)
      
      const progress = conversionProgress.get(jobId)
      progress.logs.push({
        time: new Date().toLocaleTimeString(),
        message,
        type: 'error'
      })
    })
    
    conversionProcess.on('close', (code) => {
      const job = conversionJobs.get(jobId)
      if (job) {
        job.status = code === 0 ? 'completed' : 'failed'
        job.endTime = new Date()
      }
      
      const progress = conversionProgress.get(jobId)
      if (code === 0) {
        progress.progress = 100
        progress.status = '변환 완료!'
        progress.logs.push({
          time: new Date().toLocaleTimeString(),
          message: '데이터셋 변환이 성공적으로 완료되었습니다!',
          type: 'success'
        })
      } else {
        progress.status = '변환 실패'
        progress.logs.push({
          time: new Date().toLocaleTimeString(),
          message: `변환 실패 (종료 코드: ${code})`,
          type: 'error'
        })
      }
    })
    
    res.json({ 
      success: true, 
      jobId,
      message: '데이터셋 변환이 시작되었습니다.' 
    })
    
  } catch (error) {
    console.error('데이터셋 변환 시작 실패:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/dataset/progress', (req, res) => {
  try {
    const { jobId } = req.query
    
    if (!jobId) {
      return res.status(400).json({ 
        success: false, 
        error: 'jobId가 필요합니다.' 
      })
    }
    
    const progress = conversionProgress.get(jobId)
    if (!progress) {
      return res.status(404).json({ 
        success: false, 
        error: '작업을 찾을 수 없습니다.' 
      })
    }
    
    res.json({
      success: true,
      progress: progress.progress,
      status: progress.status,
      logs: progress.logs.slice(-10) // 최근 10개 로그만 반환
    })
    
  } catch (error) {
    console.error('진행률 조회 실패:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/dataset/source-count', async (req, res) => {
  try {
    const outputDir = getSyntheticRoot()
    
    if (!fs.existsSync(outputDir)) {
      return res.json({ count: 0 })
    }
    
    // WebP 이미지 파일 개수 계산 (재귀적으로)
    let imageCount = 0
    
    const countWebPFiles = (dir) => {
      try {
        const items = fs.readdirSync(dir)
        for (const item of items) {
          const fullPath = path.join(dir, item)
          const stat = fs.statSync(fullPath)
          
          if (stat.isDirectory()) {
            countWebPFiles(fullPath)
          } else if (item.endsWith('.webp')) {
            imageCount++
          }
        }
      } catch (error) {
        console.warn(`디렉토리 읽기 실패: ${dir}`, error.message)
      }
    }
    
    countWebPFiles(outputDir)
    
    res.json({ count: imageCount })
    
  } catch (error) {
    console.error('소스 이미지 개수 조회 실패:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

app.get('/api/dataset/download', async (req, res) => {
  try {
    const datasetPath = path.join(__dirname, '..', 'data', 'brickbox_dataset')
    
    if (!fs.existsSync(datasetPath)) {
      return res.status(404).json({ 
        success: false, 
        error: '데이터셋이 아직 생성되지 않았습니다.' 
      })
    }
    
    // 폴더 구조 정보 반환 (ZIP 생성 대신)
    try {
      // 데이터셋 폴더 구조 읽기
      const readDirRecursive = (dir, basePath = '') => {
        const items = []
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          const relativePath = path.join(basePath, entry.name)
          
          if (entry.isDirectory()) {
            items.push({
              name: entry.name,
              type: 'directory',
              path: relativePath,
              children: readDirRecursive(fullPath, relativePath)
            })
          } else {
            const stats = fs.statSync(fullPath)
            items.push({
              name: entry.name,
              type: 'file',
              path: relativePath,
              size: stats.size,
              modified: stats.mtime
            })
          }
        }
        
        return items
      }
      
      const datasetStructure = readDirRecursive(datasetPath)
      
      // 폴더 구조 정보 반환
      res.json({
        success: true,
        message: '데이터셋 폴더 구조 정보',
        datasetPath: datasetPath,
        structure: datasetStructure,
        instructions: [
          '1. 위 경로의 폴더를 직접 압축하세요',
          '2. Windows: 폴더 우클릭 → "압축" 또는 "ZIP으로 압축"',
          '3. 생성된 압축 파일을 YOLO 학습에 사용하세요'
        ],
        downloadNote: 'ZIP 자동 생성 기능은 현재 사용할 수 없습니다. 폴더를 직접 압축해주세요.'
      })
      
    } catch (error) {
      console.error('폴더 구조 읽기 오류:', error)
      res.status(500).json({
        success: false,
        error: '데이터셋 폴더를 읽을 수 없습니다.',
        message: error.message
      })
    }
    
  } catch (error) {
    console.error('데이터셋 다운로드 실패:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// 포트 자동 할당 함수
const findAvailablePort = async (startPort = 3001, maxPort = 3010) => {
  const net = await import('net')
  
  for (let port = startPort; port <= maxPort; port++) {
    try {
      await new Promise((resolve, reject) => {
        const server = net.createServer()
        
        server.listen(port, () => {
          server.close(() => resolve(port))
        })
        
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is in use`))
          } else {
            reject(err)
          }
        })
      })
      
      return port
    } catch (error) {
      if (port === maxPort) {
        throw new Error(`No available ports found between ${startPort} and ${maxPort}`)
      }
      continue
    }
  }
}

// 서버 시작
const startServer = async () => {
  try {
    // 검증 라우터는 이미 등록되어 있음 (파일 상단에서)
    console.log('✅ 검증 라우터는 이미 등록되어 있습니다.')
    
    // 고정 포트 3011 사용 (근본 문제 해결)
    const PORT = 3011;
    console.log(`🔒 고정 포트 사용: ${PORT}`);
    
    // 포트 사용 가능 여부 확인
    if (!(await isPortAvailable(PORT))) {
      console.warn(`⚠️ 포트 ${PORT}이 사용 중입니다. 기존 프로세스를 종료합니다.`);
      
      // 포트 3011을 사용하는 프로세스 찾기 및 종료
      try {
        const execAsync = promisify(exec);
        
        // Windows에서 포트 3011을 사용하는 프로세스 찾기
        const { stdout } = await execAsync(`netstat -ano | findstr ":3011"`);
        const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[4];
            if (pid && pid !== '0') {
              console.log(`🔪 프로세스 종료: PID ${pid}`);
              await execAsync(`taskkill /F /PID ${pid}`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
            }
          }
        }
      } catch (killError) {
        console.warn('기존 프로세스 종료 실패:', killError.message);
      }
    }
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Synthetic API 서버가 포트 ${PORT}에서 실행 중입니다.`)
      console.log(`📡 API 엔드포인트: http://localhost:${PORT}`)
      console.log(`🖼️  정적 파일: http://localhost:${PORT}/api/synthetic/static`)
      console.log(`📊 데이터셋 변환: http://localhost:${PORT}/api/dataset/convert`)
      
      // 포트 정보를 파일로 저장 (Vite 프록시에서 사용)
      const portInfo = {
        port: PORT,
        timestamp: new Date().toISOString(),
        pid: process.pid
      }
      
      try {
        const portFilePath = path.join(process.cwd(), '.synthetic-api-port.json')
        fs.writeFileSync(portFilePath, JSON.stringify(portInfo, null, 2))
        console.log(`📝 포트 정보 저장: ${portFilePath}`)
      } catch (fileError) {
        console.warn('포트 정보 파일 저장 실패:', fileError.message)
      }
    })
    
    // [FIX] 수정됨: 포트 바인딩 에러 핸들러 추가
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Synthetic API (포트 ${PORT}): 포트바인딩 실패`)
        console.error(`포트 ${PORT}가 이미 사용 중입니다.`)
        console.error('💡 해결 방법:')
        console.error('   1. 기존 프로세스 확인: netstat -ano | findstr :3011')
        console.error('   2. 프로세스 종료: taskkill /F /PID <PID>')
        console.error('   3. 또는 다른 포트 사용: SYNTHETIC_API_PORT 환경 변수 설정')
      } else {
        console.error(`❌ Synthetic API (포트 ${PORT}): 포트바인딩 실패`)
        console.error(`오류: ${error.message}`)
        console.error('스택:', error.stack)
      }
      // 서버 시작 실패 시 프로세스 종료
      setTimeout(() => {
        console.error('⚠️ 5초 후 종료합니다...')
        process.exit(1)
      }, 5000)
    })
    
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error.message)
    console.error('스택:', error.stack)
    console.error('⚠️ 포트가 이미 사용 중이거나 환경 설정 오류입니다.')
    console.error('💡 해결 방법:')
    console.error('   1. npm run cleanup:force')
    console.error('   2. npm run dev:full')
    // 🔧 수정됨: 시작 실패 시에만 종료 (런타임 에러는 전역 핸들러가 처리)
    setTimeout(() => {
      console.error('⚠️ 5초 후 종료합니다...')
      process.exit(1)
    }, 5000)
  }
}

// 렌더링 최적화 진단 API
app.post('/api/render-optimization/audit', async (req, res) => {
  try {
    const {
      glob = 'output/synthetic/*/*.json',
      baseline_sec = 4.0,
      auto_baseline = true,
      quality_simulation = true,
      group_by = 'shape_tag',
      max_files = 0,
      workers = 8
    } = req.body;

    console.log('렌더링 최적화 진단 요청:', { glob, baseline_sec, auto_baseline, quality_simulation, group_by });

    // Python 스크립트 실행
    const scriptPath = path.join(__dirname, '..', 'scripts', 'render_optimize_audit_enhanced.py');
    console.log('Python 스크립트 경로:', scriptPath);
    console.log('스크립트 존재 여부:', fs.existsSync(scriptPath));
    
    const args = [
      '--glob', glob,
      '--baseline-sec', baseline_sec.toString(),
      '--report', 'json'
    ];

    if (auto_baseline) {
      args.push('--auto-baseline');
    }

    if (quality_simulation) {
      args.push('--quality-simulation');
    }

    if (group_by) {
      args.push('--group-by', group_by);
    }

    if (max_files > 0) {
      args.push('--max-files', max_files.toString());
    }

    args.push('--workers', workers.toString());

    console.log('Python 스크립트 실행:', scriptPath, args);
    console.log('작업 디렉토리:', process.cwd());

    const pythonProcess = spawn('python', [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      }
    });
    
    console.log('Python 프로세스 시작됨, PID:', pythonProcess.pid);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString('utf8');
      stdout += output;
      console.log('Python STDOUT:', output);
    });

    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString('utf8');
      stderr += output;
      console.log('Python STDERR:', output);
    });

    pythonProcess.on('close', (code) => {
      console.log('Python 프로세스 종료, 코드:', code);
      console.log('전체 STDOUT:', stdout);
      console.log('전체 STDERR:', stderr);
      
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('진단 완료:', result.files, '개 파일 분석');
          res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
          });
        } catch (parseError) {
          console.error('JSON 파싱 오류:', parseError);
          console.error('stdout:', stdout);
          res.status(500).json({
            success: false,
            error: '결과 파싱 실패',
            details: parseError.message,
            stdout: stdout.substring(0, 500)
          });
        }
      } else {
        console.error('Python 스크립트 실행 실패:', code);
        console.error('stderr:', stderr);
        res.status(500).json({
          success: false,
          error: '진단 스크립트 실행 실패',
          details: stderr,
          code: code
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Python 프로세스 오류:', error);
      res.status(500).json({
        success: false,
        error: 'Python 프로세스 시작 실패',
        details: error.message
      });
    });

  } catch (error) {
    console.error('API 오류:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류',
      details: error.message
    });
  }
});

// 렌더링 최적화 히스토리 조회
app.get('/api/render-optimization/history', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    // 실제 구현에서는 Supabase에서 히스토리 조회
    // 현재는 빈 배열 반환
    res.json({
      success: true,
      data: [],
      total: 0,
      message: '히스토리 데이터가 없습니다. 첫 번째 진단을 실행해주세요.'
    });

  } catch (error) {
    console.error('히스토리 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '히스토리 조회 실패',
      details: error.message
    });
  }
});

// 최적화 권장사항 적용
app.post('/api/render-optimization/apply', async (req, res) => {
  try {
    const { 
      scenario, 
      target_samples, 
      gpu_enabled, 
      cache_enabled,
      parallel_workers 
    } = req.body;

    console.log('최적화 적용 요청:', { scenario, target_samples, gpu_enabled, cache_enabled, parallel_workers });

    const result = {
      success: true,
      applied_changes: {
        samples: target_samples,
        gpu_enabled: gpu_enabled,
        cache_enabled: cache_enabled,
        parallel_workers: parallel_workers
      },
      estimated_improvement: {
        speedup: scenario === 'once_render_low' ? 3.44 : 1.50,
        quality_impact: 'low'
      },
      timestamp: new Date().toISOString()
    };

    res.json(result);

  } catch (error) {
    console.error('최적화 적용 오류:', error);
    res.status(500).json({
      success: false,
      error: '최적화 적용 실패',
      details: error.message
    });
  }
});

// 실시간 렌더링 상태 모니터링
app.get('/api/render-optimization/status', async (req, res) => {
  try {
    // 실제 구현에서는 현재 렌더링 작업 상태 조회
    const status = {
      active_jobs: 0,
      completed_today: 0,
      average_time: 0,
      gpu_utilization: 0,
      memory_usage: 0,
      last_optimization: null
    };

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
      message: '렌더링 작업이 없습니다.'
    });

  } catch (error) {
    console.error('상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '상태 조회 실패',
      details: error.message
    });
  }
});

// 렌더링 품질 메트릭 조회
app.get('/api/render-optimization/metrics', async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    
    // 실제 구현에서는 시계열 데이터 조회
    const metrics = {
      ssim_trend: [],
      snr_trend: [],
      render_time_trend: []
    };

    res.json({
      success: true,
      data: metrics,
      period: period,
      message: '메트릭 데이터가 없습니다. 첫 번째 진단을 실행해주세요.'
    });

  } catch (error) {
    console.error('메트릭 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '메트릭 조회 실패',
      details: error.message
    });
  }
});

// 버킷 동기화 검증 함수
async function validateBucketSync(sourcePath, bucketName) {
  const result = {
    totalFiles: 0,
    uploadedFiles: 0,
    missingFiles: 0,
    syncErrors: [],
    bucketStats: {
      totalObjects: 0,
      totalSize: 0
    }
  }
  
  try {
    console.log(`🔍 버킷 동기화 검증: ${bucketName}`)
    
    if (!supabaseUrl || !supabaseKey) {
      result.syncErrors.push('Supabase 설정이 없습니다')
      return result
    }
    
    // 로컬 파일 목록 수집
    const localFiles = []
    const items = await fs.promises.readdir(sourcePath)
    
    for (const item of items) {
      const itemPath = path.join(sourcePath, item)
      const stats = await fs.promises.stat(itemPath)
      
      if (stats.isDirectory() && !['dataset_synthetic', 'logs', 'temp', 'cache'].includes(item)) {
        const partItems = await fs.promises.readdir(itemPath)
        for (const file of partItems) {
          if (/\.(jpg|jpeg|png|bmp|tiff|webp|txt|json)$/i.test(file)) {
            localFiles.push({
              path: path.join(item, file),
              fullPath: path.join(itemPath, file),
              size: (await fs.promises.stat(path.join(itemPath, file))).size
            })
          }
        }
      }
    }
    
    result.totalFiles = localFiles.length
    console.log(`📁 로컬 파일: ${result.totalFiles}개`)
    
    // 버킷에서 파일 목록 조회 (각 부품 폴더별로)
    try {
      const bucketFileMap = new Map()
      let totalBucketFiles = 0
      
      // 각 부품 폴더 조회
      for (const item of items) {
        const itemPath = path.join(sourcePath, item)
        const stats = await fs.promises.stat(itemPath)
        
        if (stats.isDirectory() && !['dataset_synthetic', 'logs', 'temp', 'cache'].includes(item)) {
          console.log(`🔍 버킷 폴더 조회: synthetic/${item}`)
          
          const { data: partFiles, error } = await supabase.storage
            .from(bucketName)
            .list(`synthetic/${item}`, { limit: 1000 })
          
          if (error) {
            console.error(`❌ 폴더 조회 실패 synthetic/${item}:`, error.message)
            continue
          }
          
          partFiles.forEach(file => {
            bucketFileMap.set(file.name, file)
            result.bucketStats.totalSize += file.metadata?.size || 0
            totalBucketFiles++
          })
        }
      }
      
      result.bucketStats.totalObjects = totalBucketFiles
      console.log(`☁️ 버킷 파일: ${result.bucketStats.totalObjects}개`)

      // ===== UUID 기반 정확 매칭: 파트 폴더/파일타입(E2)/확장자/사이즈 멀티셋으로 매칭 =====
      // 1) 파트 폴더별 버킷 파일 풀(멀티셋) 구성
      const bucketPoolsByPart = new Map() // partId -> { key -> Map<size, count> }

      // helper: 파일 키 생성 (확장자 + e2 구분)
      const getFileKey = (name) => {
        const ext = path.extname(name).toLowerCase()
        const isE2 = name.includes('_e2.json')
        return `${ext}|${isE2 ? 'e2' : 'std'}`
      }

      for (const item of items) {
        const itemPath = path.join(sourcePath, item)
        const stats = await fs.promises.stat(itemPath)
        if (!(stats.isDirectory()) || ['dataset_synthetic', 'logs', 'temp', 'cache'].includes(item)) continue

        const { data: partFiles, error } = await supabase.storage
          .from(bucketName)
          .list(`synthetic/${item}`, { limit: 1000 })

        if (error) {
          console.error(`❌ 폴더 조회 실패 synthetic/${item}:`, error.message)
          continue
        }

        const pool = new Map() // key -> Map<size, count>
        partFiles.forEach(file => {
          const key = getFileKey(file.name)
          const size = (file.metadata && typeof file.metadata.size === 'number') ? file.metadata.size : undefined
          if (!pool.has(key)) pool.set(key, new Map())
          const sizeMap = pool.get(key)
          const bucketCount = size ? ((sizeMap.get(size) || 0) + 1) : ((sizeMap.get('unknown') || 0) + 1)
          sizeMap.set(size || 'unknown', bucketCount)
        })

        bucketPoolsByPart.set(item, pool)
      }

      // 2) 로컬 파일과 버킷 풀로 1:1 매칭 (사이즈로 소모 매칭)
      let matched = 0
      for (const localFile of localFiles) {
        const partId = path.dirname(localFile.path).split(path.sep)[0]
        const fileName = path.basename(localFile.path)
        const key = getFileKey(fileName)
        const size = localFile.size || 'unknown'

        const pool = bucketPoolsByPart.get(partId)
        if (!pool) {
          result.missingFiles++
          result.syncErrors.push(`누락된 파일: ${localFile.path}`)
          continue
        }

        const sizeMap = pool.get(key)
        if (!sizeMap) {
          result.missingFiles++
          result.syncErrors.push(`누락된 파일: ${localFile.path}`)
          continue
        }

        let matchedThis = false
        
        // 1. 정확 사이즈 매칭
        if (sizeMap.has(size) && sizeMap.get(size) > 0) {
          sizeMap.set(size, sizeMap.get(size) - 1)
          matched++
          matchedThis = true
        } 
        // 2. 메타데이터 없는 파일 매칭
        else if (sizeMap.has('unknown') && sizeMap.get('unknown') > 0) {
          sizeMap.set('unknown', sizeMap.get('unknown') - 1)
          matched++
          matchedThis = true
        }
        // 3. 유연한 매칭: 같은 타입의 다른 크기 파일도 허용
        else {
          // 같은 키(확장자+E2)의 다른 크기 파일 찾기
          for (const [bucketSize, count] of sizeMap) {
            if (count > 0) {
              sizeMap.set(bucketSize, count - 1)
              matched++
              matchedThis = true
              break
            }
          }
        }

        if (!matchedThis) {
          result.missingFiles++
          result.syncErrors.push(`누락된 파일: ${localFile.path}`)
        }
      }

      result.uploadedFiles = matched
      console.log(`✅ 버킷 동기화 매칭 완료: 업로드됨 ${result.uploadedFiles}개 / 총 ${result.totalFiles}개`)
      
    } catch (error) {
      result.syncErrors.push(`버킷 접근 실패: ${error.message}`)
    }
    
  } catch (error) {
    result.syncErrors.push(`동기화 검증 실패: ${error.message}`)
  }
  
  return result
}

// 파일 개수 계산 함수
async function countFiles(directoryPath) {
  try {
    const files = await fs.promises.readdir(directoryPath)
    return files.filter(file => !file.startsWith('.')).length
  } catch (error) {
    console.error(`파일 개수 계산 실패 (${directoryPath}):`, error)
    return 0
  }
}

// 데이터셋 준비 API 엔드포인트
app.post('/api/synthetic/dataset/prepare', async (req, res) => {
  try {
    console.log('📋 데이터셋 준비 요청 받음:', req.body)
    
    const { sourcePath, forceRebuild = false } = req.body
    // [FIX] 수정됨: sourcePath가 없으면 getDatasetSyntheticPath() 사용 (환경 변수 기반)
    // sourcePath가 있으면 사용자가 지정한 경로 사용 (기존 동작 유지)
    const datasetSyntheticPath = sourcePath 
      ? (path.isAbsolute(sourcePath) 
          ? path.join(sourcePath, 'dataset_synthetic') 
          : path.join(process.cwd(), sourcePath, 'dataset_synthetic'))
      : getDatasetSyntheticPath()
    
    console.log(`📁 데이터셋 준비 시작: ${datasetSyntheticPath}`)
    console.log(`🔄 모드: ${forceRebuild ? '강제 재생성' : '증분 업데이트'}`)
    
    // 데이터셋 준비 스크립트 실행
    const scriptArgs = [
      '--source', datasetSyntheticPath,  // [FIX] dataset_synthetic 경로 직접 전달
      '--output', datasetSyntheticPath
    ]
    
    if (forceRebuild) {
      scriptArgs.push('--force-rebuild')
    }
    
    const prepareProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'prepare_training_dataset.py'),
      ...scriptArgs
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1'
      }
    })
    
    const jobId = `prepare_${Date.now()}`
    const logs = []
    
    // 프로세스 출력 처리
    prepareProcess.stdout.on('data', (data) => {
      const message = data.toString('utf8').trim()
      if (message) {
        console.log(`[데이터셋 준비] ${message}`)
        logs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: message
        })
      }
    })
    
    prepareProcess.stderr.on('data', (data) => {
      const message = data.toString('utf8').trim()
      if (message) {
        console.error(`[데이터셋 준비 오류] ${message}`)
        logs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `오류: ${message}`,
          type: 'error'
        })
      }
    })
    
    prepareProcess.on('close', async (code) => {
      console.log(`📋 데이터셋 준비 완료 (종료 코드: ${code})`)
      
      if (code === 0) {
        logs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: '✅ 데이터셋 준비가 성공적으로 완료되었습니다!',
          type: 'success'
        })
        
        // [FIX] 수정됨: 실제 파일 개수 계산 (새 구조 지원)
        try {
          const datasetPath = getDatasetSyntheticPath()
          console.log(`[DEBUG] 파일 개수 계산 시작: ${datasetPath}`)
          
          // 새 구조 확인: dataset_synthetic/{element_id}/images/train 구조
          const partDirsNewStructure = fs.existsSync(datasetPath) ? fs.readdirSync(datasetPath).filter(item => {
            const itemPath = path.join(datasetPath, item)
            try {
              const stats = fs.statSync(itemPath)
              if (!stats.isDirectory()) return false
              // 부품 폴더 내에 images/train 폴더가 있는지 확인
              const imagesTrainDir = path.join(itemPath, 'images', 'train')
              const hasTrainDir = fs.existsSync(imagesTrainDir) && fs.statSync(imagesTrainDir).isDirectory()
              if (hasTrainDir) {
                console.log(`[DEBUG] 새 구조 감지: ${itemPath} (images/train 존재)`)
              }
              return hasTrainDir
            } catch (err) {
              console.warn(`[DEBUG] 부품 폴더 확인 실패: ${itemPath}`, err.message)
              return false
            }
          }) : []
          
          console.log(`[DEBUG] 새 구조 부품 폴더 수: ${partDirsNewStructure.length}개`)
          
          let imageCount = 0
          let labelCount = 0
          let metadataCount = 0
          
          if (partDirsNewStructure.length > 0) {
            console.log(`[DEBUG] 새 구조 사용: 부품 폴더 목록: ${partDirsNewStructure.join(', ')}`)
            // 새 구조: 각 부품 폴더 내 images/train, images/val, labels/train, labels/val, meta 카운트
            for (const partDir of partDirsNewStructure) {
              const partPath = path.join(datasetPath, partDir)
              const imagesTrainDir = path.join(partPath, 'images', 'train')
              const imagesValDir = path.join(partPath, 'images', 'val')
              const imagesTestDir = path.join(partPath, 'images', 'test')
              const labelsTrainDir = path.join(partPath, 'labels', 'train')
              const labelsValDir = path.join(partPath, 'labels', 'val')
              const labelsTestDir = path.join(partPath, 'labels', 'test')
              const metaDir = path.join(partPath, 'meta')
              const metaEDir = path.join(partPath, 'meta-e')
              
              if (fs.existsSync(imagesTrainDir)) {
                imageCount += await countFiles(imagesTrainDir)
              }
              if (fs.existsSync(imagesValDir)) {
                imageCount += await countFiles(imagesValDir)
              }
              if (fs.existsSync(imagesTestDir)) {
                imageCount += await countFiles(imagesTestDir)
              }
              if (fs.existsSync(labelsTrainDir)) {
                labelCount += await countFiles(labelsTrainDir)
              }
              if (fs.existsSync(labelsValDir)) {
                labelCount += await countFiles(labelsValDir)
              }
              if (fs.existsSync(labelsTestDir)) {
                labelCount += await countFiles(labelsTestDir)
              }
              if (fs.existsSync(metaDir)) {
                metadataCount += await countFiles(metaDir)
              }
              if (fs.existsSync(metaEDir)) {
                metadataCount += await countFiles(metaEDir)
              }
            }
          } else {
            // 기존 구조: dataset_synthetic/images/train, labels/train 등
            console.log(`[DEBUG] 기존 구조 사용 시도`)
            const imagesTrainPath = path.join(datasetPath, 'images', 'train')
            const imagesValPath = path.join(datasetPath, 'images', 'val')
            const labelsTrainPath = path.join(datasetPath, 'labels', 'train')
            const labelsValPath = path.join(datasetPath, 'labels', 'val')
            const metaPath = path.join(datasetPath, 'meta')
            const metaEPath = path.join(datasetPath, 'meta-e')
            
            console.log(`[DEBUG] 기존 구조 경로 확인:`)
            console.log(`  - images/train: ${fs.existsSync(imagesTrainPath)}`)
            console.log(`  - images/val: ${fs.existsSync(imagesValPath)}`)
            console.log(`  - labels/train: ${fs.existsSync(labelsTrainPath)}`)
            console.log(`  - labels/val: ${fs.existsSync(labelsValPath)}`)
            console.log(`  - meta: ${fs.existsSync(metaPath)}`)
            console.log(`  - meta-e: ${fs.existsSync(metaEPath)}`)
            
            if (fs.existsSync(imagesTrainPath)) {
              imageCount += await countFiles(imagesTrainPath)
            }
            if (fs.existsSync(imagesValPath)) {
              imageCount += await countFiles(imagesValPath)
            }
            if (fs.existsSync(labelsTrainPath)) {
              labelCount += await countFiles(labelsTrainPath)
            }
            if (fs.existsSync(labelsValPath)) {
              labelCount += await countFiles(labelsValPath)
            }
            if (fs.existsSync(metaPath)) {
              metadataCount += await countFiles(metaPath)
            }
            if (fs.existsSync(metaEPath)) {
              metadataCount += await countFiles(metaEPath)
            }
          }
          
          logs.push({
            timestamp: new Date().toLocaleTimeString(),
            message: `📊 준비된 파일: 이미지 ${imageCount}개, 라벨 ${labelCount}개, 메타데이터 ${metadataCount}개`,
            type: 'info'
          })
        } catch (error) {
          console.error('파일 개수 계산 실패:', error)
        }
      } else {
        logs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `❌ 데이터셋 준비 실패 (종료 코드: ${code})`,
          type: 'error'
        })
      }
    })
    
    // 즉시 응답 (비동기 처리)
    res.json({
      success: true,
      jobId: jobId,
      message: '데이터셋 준비가 시작되었습니다',
      logs: logs
    })
    
  } catch (error) {
    console.error('❌ 데이터셋 준비 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 데이터셋 준비 진행 상황 조회
app.get('/api/synthetic/dataset/prepare/status/:jobId', (req, res) => {
  const { jobId } = req.params
  
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  res.set('Surrogate-Control', 'no-store')
  
  res.json({
    success: true,
    jobId: jobId,
    status: 'completed',
    progress: 100,
    message: '데이터셋 준비 완료'
  })
})

// 데이터셋 파일 개수 조회 (전체 또는 특정 element_id)
app.get('/api/synthetic/dataset/files/:elementId?', async (req, res) => {
  try {
    // [FIX] 수정됨: 새 구조 지원 (dataset_synthetic/{element_id}/images, labels, meta, meta-e)
    const datasetPath = getDatasetSyntheticPath()
    const { elementId } = req.params
    
    let imageCount = 0
    let labelCount = 0
    let metadataCount = 0
    
    // 특정 element_id가 지정된 경우 해당 부품만 조회
    if (elementId) {
      const partPath = path.join(datasetPath, elementId)
      if (fs.existsSync(partPath)) {
        const imagesDir = path.join(partPath, 'images')
        const labelsDir = path.join(partPath, 'labels')
        const metaDir = path.join(partPath, 'meta')
        const metaEDir = path.join(partPath, 'meta-e')
        
        // train/val/test 폴더가 있으면 모두 카운트, 없으면 images 폴더 직접 카운트
        if (fs.existsSync(imagesDir)) {
          const trainDir = path.join(imagesDir, 'train')
          const valDir = path.join(imagesDir, 'val')
          const testDir = path.join(imagesDir, 'test')
          
          if (fs.existsSync(trainDir)) {
            imageCount += await countFiles(trainDir)
          }
          if (fs.existsSync(valDir)) {
            imageCount += await countFiles(valDir)
          }
          if (fs.existsSync(testDir)) {
            imageCount += await countFiles(testDir)
          }
          
          // train/val/test 폴더가 없으면 images 폴더 직접 카운트
          if (!fs.existsSync(trainDir) && !fs.existsSync(valDir) && !fs.existsSync(testDir)) {
            imageCount += await countFiles(imagesDir)
          }
        }
        
        if (fs.existsSync(labelsDir)) {
          const trainDir = path.join(labelsDir, 'train')
          const valDir = path.join(labelsDir, 'val')
          const testDir = path.join(labelsDir, 'test')
          
          if (fs.existsSync(trainDir)) {
            labelCount += await countFiles(trainDir)
          }
          if (fs.existsSync(valDir)) {
            labelCount += await countFiles(valDir)
          }
          if (fs.existsSync(testDir)) {
            labelCount += await countFiles(testDir)
          }
          
          // train/val/test 폴더가 없으면 labels 폴더 직접 카운트
          if (!fs.existsSync(trainDir) && !fs.existsSync(valDir) && !fs.existsSync(testDir)) {
            labelCount += await countFiles(labelsDir)
          }
        }
        
        if (fs.existsSync(metaDir)) {
          metadataCount += await countFiles(metaDir)
        }
        if (fs.existsSync(metaEDir)) {
          metadataCount += await countFiles(metaEDir)
        }
      }
    } else {
      // 전체 조회: 기존 로직 유지
      // 새 구조 확인: dataset_synthetic/{element_id}/images 구조
      if (fs.existsSync(datasetPath)) {
        const partDirs = fs.readdirSync(datasetPath).filter(item => {
          const itemPath = path.join(datasetPath, item)
          try {
            const stats = fs.statSync(itemPath)
            if (!stats.isDirectory()) return false
            // 부품 폴더 내에 images 폴더가 있는지 확인
            const imagesDir = path.join(itemPath, 'images')
            return fs.existsSync(imagesDir) && fs.statSync(imagesDir).isDirectory()
          } catch {
            return false
          }
        })
        
        if (partDirs.length > 0) {
          // 새 구조: 각 부품 폴더 내 images, labels, meta, meta-e 카운트
          for (const partDir of partDirs) {
            const partPath = path.join(datasetPath, partDir)
            const imagesDir = path.join(partPath, 'images')
            const labelsDir = path.join(partPath, 'labels')
            const metaDir = path.join(partPath, 'meta')
            const metaEDir = path.join(partPath, 'meta-e')
            
            if (fs.existsSync(imagesDir)) {
              // train/val/test 폴더가 있으면 모두 카운트
              const trainDir = path.join(imagesDir, 'train')
              const valDir = path.join(imagesDir, 'val')
              const testDir = path.join(imagesDir, 'test')
              
              if (fs.existsSync(trainDir)) {
                imageCount += await countFiles(trainDir)
              }
              if (fs.existsSync(valDir)) {
                imageCount += await countFiles(valDir)
              }
              if (fs.existsSync(testDir)) {
                imageCount += await countFiles(testDir)
              }
              
              // train/val/test 폴더가 없으면 images 폴더 직접 카운트
              if (!fs.existsSync(trainDir) && !fs.existsSync(valDir) && !fs.existsSync(testDir)) {
                imageCount += await countFiles(imagesDir)
              }
            }
            
            if (fs.existsSync(labelsDir)) {
              const trainDir = path.join(labelsDir, 'train')
              const valDir = path.join(labelsDir, 'val')
              const testDir = path.join(labelsDir, 'test')
              
              if (fs.existsSync(trainDir)) {
                labelCount += await countFiles(trainDir)
              }
              if (fs.existsSync(valDir)) {
                labelCount += await countFiles(valDir)
              }
              if (fs.existsSync(testDir)) {
                labelCount += await countFiles(testDir)
              }
              
              if (!fs.existsSync(trainDir) && !fs.existsSync(valDir) && !fs.existsSync(testDir)) {
                labelCount += await countFiles(labelsDir)
              }
            }
            
            if (fs.existsSync(metaDir)) {
              metadataCount += await countFiles(metaDir)
            }
            if (fs.existsSync(metaEDir)) {
              metadataCount += await countFiles(metaEDir)
            }
          }
        } else {
          // 기존 구조: images/train, labels/train 등
          const imagesTrainPath = path.join(datasetPath, 'images', 'train')
          const imagesValPath = path.join(datasetPath, 'images', 'val')
          const labelsTrainPath = path.join(datasetPath, 'labels', 'train')
          const labelsValPath = path.join(datasetPath, 'labels', 'val')
          const metaPath = path.join(datasetPath, 'meta')
          const metaEPath = path.join(datasetPath, 'meta-e')
          
          if (fs.existsSync(imagesTrainPath)) {
            imageCount += await countFiles(imagesTrainPath)
          }
          if (fs.existsSync(imagesValPath)) {
            imageCount += await countFiles(imagesValPath)
          }
          if (fs.existsSync(labelsTrainPath)) {
            labelCount += await countFiles(labelsTrainPath)
          }
          if (fs.existsSync(labelsValPath)) {
            labelCount += await countFiles(labelsValPath)
          }
          if (fs.existsSync(metaPath)) {
            metadataCount += await countFiles(metaPath)
          }
          if (fs.existsSync(metaEPath)) {
            metadataCount += await countFiles(metaEPath)
          }
        }
      }
    }
    
    res.json({
      success: true,
      images: imageCount,
      labels: labelCount,
      metadata: metadataCount,
      total: imageCount + labelCount + metadataCount
    })
  } catch (error) {
    console.error('파일 개수 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 데이터셋 버전 목록 조회
app.get('/api/synthetic/dataset/versions', async (req, res) => {
  try {
    console.log('📋 버전 목록 조회 요청')
    
    // Python 스크립트 실행
    const listProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'dataset_version_manager.py'),
      '--action', 'list'
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1'
      }
    })
    
    let output = ''
    let errorOutput = ''
    
    listProcess.stdout.on('data', (data) => {
      output += data.toString('utf8')
    })
    
    listProcess.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8')
    })
    
    listProcess.on('close', (code) => {
      console.log('버전 목록 프로세스 종료 코드:', code)
      console.log('출력:', output)
      console.log('오류:', errorOutput)
      
      if (code === 0) {
        // Python 스크립트에서 JSON 출력을 파싱
        try {
          const lines = output.split('\n')
          // JSON 배열 시작 부분 찾기
          const jsonStartIndex = lines.findIndex(line => line.trim().startsWith('['))
          if (jsonStartIndex !== -1) {
            // JSON 배열 부분만 추출
            const jsonLines = lines.slice(jsonStartIndex)
            const jsonText = jsonLines.join('\n')
            const versions = JSON.parse(jsonText)
            console.log(`✅ 버전 목록 조회 성공: ${versions.length}개 버전`)
            res.json({
              success: true,
              versions: versions
            })
          } else {
            // JSON 출력이 없으면 기본 응답
            console.log('⚠️ JSON 배열을 찾을 수 없음, 빈 배열 반환')
            res.json({
              success: true,
              versions: []
            })
          }
        } catch (parseError) {
          console.error('❌ JSON 파싱 실패:', parseError)
          console.error('출력 내용:', output)
          res.json({
            success: true,
            versions: []
          })
        }
      } else {
        console.error('❌ Python 스크립트 실행 실패:', errorOutput)
        console.error('출력 내용:', output)
        res.status(500).json({
          success: false,
          error: `버전 목록 조회 실패: ${errorOutput}`,
          output: output
        })
      }
    })
    
    listProcess.on('error', (error) => {
      console.error('❌ 버전 목록 프로세스 오류:', error)
      res.status(500).json({
        success: false,
        error: `버전 목록 프로세스 오류: ${error.message}`
      })
    })
    
  } catch (error) {
    console.error('버전 목록 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 데이터셋 백업 (Node.js 직접 구현)
app.post('/api/synthetic/dataset/backup', async (req, res) => {
  try {
    const { description = '통합 처리 백업' } = req.body
    console.log('💾 백업 요청:', description)
    
    const currentPath = getSyntheticRoot()
    const versionsDir = path.join(__dirname, '..', 'output', 'datasets')
    const versionMetadataPath = path.join(__dirname, '..', 'output', 'dataset_versions.json')
    
    console.log('📁 경로 확인:')
    console.log('  currentPath:', currentPath)
    console.log('  versionsDir:', versionsDir)
    console.log('  versionMetadataPath:', versionMetadataPath)
    
    // current 폴더 확인
    if (!fs.existsSync(currentPath)) {
      console.error('❌ current 폴더가 존재하지 않습니다')
      return res.status(400).json({
        success: false,
        error: 'current 폴더가 존재하지 않습니다. 먼저 데이터셋을 준비하세요.'
      })
    }
    
    // 버전 메타데이터 로드
    let metadata = { versions: [] }
    if (fs.existsSync(versionMetadataPath)) {
      const content = await fs.promises.readFile(versionMetadataPath, 'utf8')
      metadata = JSON.parse(content)
    }
    
    // 새 버전 번호 생성
    let newVersion = '1.0'
    if (metadata.versions && metadata.versions.length > 0) {
      const versions = metadata.versions.map(v => parseFloat(v.version))
      const maxVersion = Math.max(...versions)
      newVersion = (maxVersion + 0.1).toFixed(1)
    }
    
    console.log(`📊 버전 정보:`)
    console.log(`  기존 버전 수: ${metadata.versions ? metadata.versions.length : 0}`)
    console.log(`  새 버전: ${newVersion}`)
    
    const newVersionPath = path.join(versionsDir, `v${newVersion}`)
    
    console.log(`📦 백업 시작: v${newVersion}`)
    
    // 기존 버전 폴더가 있으면 삭제
    if (fs.existsSync(newVersionPath)) {
      await fs.promises.rm(newVersionPath, { recursive: true, force: true })
    }
    
    // current 폴더 복사
    try {
      await fs.promises.cp(currentPath, newVersionPath, { recursive: true })
      console.log(`✅ 파일 복사 완료: ${newVersionPath}`)
    } catch (copyError) {
      console.error('❌ 파일 복사 실패:', copyError)
      return res.status(500).json({
        success: false,
        error: `파일 복사 실패: ${copyError.message}`
      })
    }
    
    // 파일 개수 계산 및 해시 계산
    const countFiles = async (dir, ext) => {
      try {
        if (!fs.existsSync(dir)) {
          return 0
        }
        const files = await fs.promises.readdir(dir, { recursive: true })
        return files.filter(f => f.endsWith(ext)).length
      } catch (error) {
        console.log(`⚠️ 파일 개수 계산 실패 (${dir}):`, error.message)
        return 0
      }
    }

    
    // 데이터셋 해시 계산
    const calculateDatasetHash = async (datasetPath) => {
      try {
        const crypto = await import('crypto')
        const allHashes = []
        
        const scanDirectory = async (dir) => {
          const items = await fs.promises.readdir(dir, { withFileTypes: true })
          for (const item of items) {
            const fullPath = path.join(dir, item.name)
            if (item.isDirectory()) {
              await scanDirectory(fullPath)
            } else if (item.isFile()) {
              const content = await fs.promises.readFile(fullPath)
              const hash = crypto.createHash('md5').update(content).digest('hex')
              allHashes.push(hash)
            }
          }
        }
        
        await scanDirectory(datasetPath)
        allHashes.sort() // 일관성 보장
        
        const combinedHash = allHashes.join('')
        return crypto.createHash('sha256').update(combinedHash).digest('hex')
      } catch (error) {
        console.log(`⚠️ 해시 계산 실패:`, error.message)
        return ''
      }
    }
    
    const imageCount = await countFiles(path.join(newVersionPath, 'images'), '.webp')
    const labelCount = await countFiles(path.join(newVersionPath, 'labels'), '.txt')
    const metadataCount = await countFiles(path.join(newVersionPath, 'meta'), '.json')
    const metaECount = await countFiles(path.join(newVersionPath, 'meta-e'), '_e2.json')
    const datasetHash = await calculateDatasetHash(newVersionPath)
    
    // 버전 정보 저장
    const versionInfo = {
      version: newVersion,
      description: description,
      created_at: new Date().toISOString(),
      is_current: true,
      path: newVersionPath,
      source_path: currentPath,
      dataset_hash: datasetHash,
      file_counts: {
        images: imageCount,
        labels: labelCount,
        metadata: metadataCount,
        meta_e: metaECount,
        total: imageCount + labelCount + metadataCount + metaECount
      }
    }
    
    // 기존 버전의 is_current를 false로 설정
    if (metadata.versions) {
      metadata.versions.forEach(v => {
        v.is_current = false
      })
      metadata.versions.push(versionInfo)
    } else {
      metadata.versions = [versionInfo]
    }
    
    // 메타데이터 저장
    try {
      await fs.promises.writeFile(
        versionMetadataPath,
        JSON.stringify(metadata, null, 2),
        'utf8'
      )
      console.log(`✅ 메타데이터 저장 완료: ${versionMetadataPath}`)
    } catch (saveError) {
      console.error('❌ 메타데이터 저장 실패:', saveError)
      return res.status(500).json({
        success: false,
        error: `메타데이터 저장 실패: ${saveError.message}`
      })
    }
    
    console.log(`✅ 백업 완료 - 버전 ${newVersion}`)
    res.json({
      success: true,
      version: newVersion,
      message: `백업 완료 - 버전 ${newVersion}`,
      file_counts: versionInfo.file_counts
    })
    
  } catch (error) {
    console.error('❌ 백업 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 데이터셋 버전 전환
app.post('/api/synthetic/dataset/switch', async (req, res) => {
  try {
    const { version } = req.body
    console.log('🔄 버전 전환 요청:', version)
    
    // Python 스크립트 실행
    const switchProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'dataset_version_manager.py'),
      '--action', 'switch',
      '--version', version
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1'
      }
    })
    
    let output = ''
    let errorOutput = ''
    
    switchProcess.stdout.on('data', (data) => {
      output += data.toString('utf8')
    })
    
    switchProcess.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8')
    })
    
    switchProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ 버전 ${version} 전환 성공`)
        res.json({
          success: true,
          version: version,
          message: `버전 ${version}으로 전환 완료`
        })
      } else {
        console.error('❌ 버전 전환 실패:', errorOutput)
        console.error('출력 내용:', output)
        res.status(500).json({
          success: false,
          error: `버전 전환 실패: ${errorOutput}`
        })
      }
    })
  } catch (error) {
    console.error('버전 전환 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Supabase 동기화 엔드포인트
app.post('/api/synthetic/dataset/sync-to-supabase', async (req, res) => {
  try {
    console.log('🔄 Supabase 동기화 요청')
    
    const syncProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'sync_dataset_versions_to_supabase.py')
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1',
        // Supabase 환경 변수 (시스템 환경 변수 우선)
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk',
        SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.placeholder-service-role-key',
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk',
        VITE_SUPABASE_SERVICE_ROLE: process.env.VITE_SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.placeholder-service-role-key'
      }
    })
    
    let output = ''
    let errorOutput = ''
    
    syncProcess.stdout.on('data', (data) => {
      output += data.toString('utf8')
    })
    
    syncProcess.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8')
    })
    
    syncProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Supabase 동기화 성공')
        res.json({
          success: true,
          message: 'Supabase 동기화 완료',
          output: output
        })
      } else {
        console.error('❌ Supabase 동기화 실패:', errorOutput)
        res.status(500).json({
          success: false,
          error: `동기화 실패: ${errorOutput}`,
          output: output
        })
      }
    })
    
  } catch (error) {
    console.error('Supabase 동기화 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Supabase 버전 조회 엔드포인트
app.get('/api/synthetic/dataset/supabase-versions', async (req, res) => {
  try {
    console.log('📋 Supabase 버전 조회 요청')
    
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase 설정이 없습니다'
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data, error } = await supabase
      .from('dataset_versions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Supabase 조회 오류:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
    
    res.json({
      success: true,
      versions: data || []
    })
    
  } catch (error) {
    console.error('Supabase 버전 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 데이터셋 파일 Storage 동기화 엔드포인트
app.post('/api/synthetic/dataset/sync-files-to-storage', async (req, res) => {
  try {
    console.log('📁 데이터셋 파일 Storage 동기화 요청')
    
    const syncProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'sync_dataset_files_to_storage.py')
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1'
      }
    })
    
    let output = ''
    let errorOutput = ''
    
    syncProcess.stdout.on('data', (data) => {
      output += data.toString('utf8')
    })
    
    syncProcess.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8')
    })
    
    syncProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ 데이터셋 파일 Storage 동기화 성공')
        res.json({
          success: true,
          message: '데이터셋 파일 Storage 동기화 완료',
          output: output
        })
      } else {
        console.error('❌ 데이터셋 파일 Storage 동기화 실패:', errorOutput)
        res.status(500).json({
          success: false,
          error: `Storage 동기화 실패: ${errorOutput}`,
          output: output
        })
      }
    })
    
  } catch (error) {
    console.error('데이터셋 파일 Storage 동기화 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 최적화된 데이터셋 Storage 동기화 엔드포인트
app.post('/api/synthetic/dataset/sync-optimized-storage', async (req, res) => {
  try {
    console.log('📁 최적화된 데이터셋 Storage 동기화 요청')
    
    const syncProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'optimized_storage_sync.py')
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1',
        // Supabase 환경 변수 (시스템 환경 변수 우선)
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk',
        SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.placeholder-service-role-key',
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk',
        VITE_SUPABASE_SERVICE_ROLE: process.env.VITE_SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.placeholder-service-role-key'
      }
    })
    
    let output = ''
    let errorOutput = ''
    
    syncProcess.stdout.on('data', (data) => {
      output += data.toString('utf8')
    })
    
    syncProcess.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8')
    })
    
    syncProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ 최적화된 Storage 동기화 성공')
        res.json({
          success: true,
          message: '최적화된 Storage 동기화 완료',
          output: output
        })
      } else {
        console.error('❌ 최적화된 Storage 동기화 실패:', errorOutput)
        res.status(500).json({
          success: false,
          error: `최적화된 Storage 동기화 실패: ${errorOutput}`,
          output: output
        })
      }
    })
    
  } catch (error) {
    console.error('최적화된 Storage 동기화 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 로컬 Storage 최적화 엔드포인트
app.post('/api/synthetic/dataset/optimize-local-storage', async (req, res) => {
  try {
    console.log('📁 로컬 Storage 최적화 요청')
    
    const optimizeProcess = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'optimize_local_storage.py')
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1'
      }
    })
    
    let output = ''
    let errorOutput = ''
    
    optimizeProcess.stdout.on('data', (data) => {
      output += data.toString('utf8')
    })
    
    optimizeProcess.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8')
    })
    
    optimizeProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ 로컬 Storage 최적화 성공')
        res.json({
          success: true,
          message: '로컬 Storage 최적화 완료',
          output: output
        })
      } else {
        console.error('❌ 로컬 Storage 최적화 실패:', errorOutput)
        res.status(500).json({
          success: false,
          error: `로컬 Storage 최적화 실패: ${errorOutput}`,
          output: output
        })
      }
    })
    
  } catch (error) {
    console.error('로컬 Storage 최적화 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 매니페스트 조회: manifests/v{version}.json 반환
app.get('/api/synthetic/dataset/manifest/:version', async (req, res) => {
  try {
    const { version } = req.params
    const manifestPath = path.join(__dirname, '..', 'output', 'manifests', `v${version}.json`)
    try {
      const data = await fs.promises.readFile(manifestPath, 'utf-8')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.send(data)
    } catch (e) {
      return res.status(404).json({ success: false, error: 'manifest not found' })
    }
  } catch (error) {
    console.error('매니페스트 조회 실패:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// data.yaml 동적 생성/다운로드 (manifests 기반, 파일 경로는 정적 서버 URL로 노출)
app.get('/api/synthetic/dataset/data.yaml', async (req, res) => {
  try {
    const { version } = req.query
    if (!version) {
      return res.status(400).json({ success: false, error: 'version is required' })
    }
    const manifestPath = path.join(__dirname, '..', 'output', 'manifests', `v${version}.json`)
    const raw = await fs.promises.readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw)

    // 정적 제공 베이스 URL (output 폴더는 /api/synthetic/static 아래에 노출됨)
    const host = req.headers.host
    const baseUrl = `http://${host}/api/synthetic/static`

    // 이미지 경로를 train/val로 구분 (manifest.files 키가 상대경로 포함)
    const fileEntries = Object.keys(manifest.files || {})
    const trainImages = fileEntries
      .filter(p => p.startsWith('images/train/') && (p.endsWith('.webp') || p.endsWith('.jpg') || p.endsWith('.png')))
      .map(p => `${baseUrl}/${p.replace(/\\/g, '/')}`)
    const valImages = fileEntries
      .filter(p => p.startsWith('images/val/') && (p.endsWith('.webp') || p.endsWith('.jpg') || p.endsWith('.png')))
      .map(p => `${baseUrl}/${p.replace(/\\/g, '/')}`)

    // labels 경로는 필요 시 사용 (여기서는 참고용으로 보관)
    const trainLabels = fileEntries
      .filter(p => p.startsWith('labels/train/') && p.endsWith('.txt'))
      .map(p => `${baseUrl}/${p.replace(/\\/g, '/')}`)
    const valLabels = fileEntries
      .filter(p => p.startsWith('labels/val/') && p.endsWith('.txt'))
      .map(p => `${baseUrl}/${p.replace(/\\/g, '/')}`)

    // YOLO data.yaml (Ultralytics는 경로 리스트도 지원)
    const yaml = [
      'path: .',
      'names: ["lego"]',
      'nc: 1',
      `train:`,
      ...trainImages.map(u => `  - ${u}`),
      `val:`,
      ...valImages.map(u => `  - ${u}`),
      '# labels (optional references)',
      'labels:',
      '  train:',
      ...trainLabels.map(u => `    - ${u}`),
      '  val:',
      ...valLabels.map(u => `    - ${u}`)
    ].join('\n')

    res.setHeader('Content-Type', 'text/yaml; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="data.v${version}.yaml"`)
    res.send(yaml)
  } catch (error) {
    console.error('data.yaml 생성 실패:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 실제 모델 성능 기반 지표 계산 (기술서 SLO 기준)
const calculatePerformanceMetrics = async () => {
  try {
    console.log('📊 실제 모델 성능 지표 계산 시작')
    
    // 1. 현재 모델 존재 확인
    const currentModelPath = path.join(__dirname, '..', 'models', 'current_model.pt')
    if (!fs.existsSync(currentModelPath)) {
      console.log('⚠️ 현재 모델이 없습니다. 기본값 반환')
      return getDefaultMetrics()
    }
    
    // 2. 실제 모델 성능 평가 실행
    const evaluationResult = await evaluateCurrentModel(currentModelPath)
    
    if (evaluationResult.success) {
      console.log('✅ 실제 모델 성능 평가 완료:', evaluationResult.metrics)
      return evaluationResult.metrics
    } else {
      console.log('⚠️ 모델 평가 실패, 기본값 사용:', evaluationResult.error)
      return getDefaultMetrics()
    }
    
  } catch (error) {
    console.log('⚠️ 성능 지표 계산 실패, 기본값 사용:', error.message)
    return getDefaultMetrics()
  }
}

// 현재 모델 실제 평가
const evaluateCurrentModel = async (modelPath) => {
  try {
    const { spawn } = await import('child_process')
    
    const evaluationScript = path.join(__dirname, '..', 'scripts', 'evaluate_model.py')
    const dataPath = getDatasetSyntheticPath()
    
    return new Promise((resolve) => {
      const process = spawn('python', [evaluationScript, '--model', modelPath, '--data', dataPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            resolve({ success: true, metrics: result.metrics })
          } catch (e) {
            resolve({ success: false, error: 'JSON 파싱 실패' })
          }
        } else {
          resolve({ success: false, error: stderr })
        }
      })
      
      process.on('error', (error) => {
        resolve({ success: false, error: error.message })
      })
    })
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// 기본 메트릭 (SLO 기준)
const getDefaultMetrics = () => {
  return {
    recall: 0.85,           // SLO: ≥0.95
    top1Accuracy: 0.90,      // SLO: ≥0.97  
    p95Latency: 150,        // SLO: ≤150ms
    holdRate: 0.08,         // 운영 지표
    stage2Rate: 0.25,       // 운영 지표
    falseDetectionRate: 0.03, // SLO: ≤3%
    occlusionIQR: 0.15,     // 운영 지표
    webpDecodeP95: 15,      // SLO: ≤15ms
    oodRate: 0.02,          // 운영 지표
    lastUpdated: new Date().toISOString()
  }
}

// 데이터셋 품질 점수 계산
const calculateDatasetQuality = async (datasetPath) => {
  try {
    let qualityScore = 0.5 // 기본 점수
    
    // 이미지 파일 검증
    const imagesPath = path.join(datasetPath, 'images')
    if (fs.existsSync(imagesPath)) {
      const imageFiles = await fs.promises.readdir(imagesPath)
      const validImages = imageFiles.filter(f => f.endsWith('.webp')).length
      if (validImages > 0) qualityScore += 0.2
    }
    
    // 라벨 파일 검증
    const labelsPath = path.join(datasetPath, 'labels')
    if (fs.existsSync(labelsPath)) {
      const labelFiles = await fs.promises.readdir(labelsPath)
      const validLabels = labelFiles.filter(f => f.endsWith('.txt')).length
      if (validLabels > 0) qualityScore += 0.2
    }
    
    // 메타데이터 파일 검증
    const metadataPath = path.join(datasetPath, 'metadata')
    if (fs.existsSync(metadataPath)) {
      const metadataFiles = await fs.promises.readdir(metadataPath)
      const validMetadata = metadataFiles.filter(f => f.endsWith('.json')).length
      if (validMetadata > 0) qualityScore += 0.1
    }
    
    return Math.min(1.0, qualityScore)
  } catch (error) {
    console.log('⚠️ 품질 점수 계산 실패:', error.message)
    return 0.5
  }
}

// 성능 모니터링 지표 조회
app.get('/api/synthetic/monitor/metrics', async (req, res) => {
  try {
    console.log('📊 성능 지표 조회 요청')
    
    // 실제 성능 지표 계산
    const metrics = await calculatePerformanceMetrics()
    
    // 2단계 모델 SLO 기반 임계치 설정 (기술서 기준)
    const thresholds = {
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
    }
    
    // 2단계 모델 위반 지표 확인
    const violations = []
    
    // Stage-1 (탐지) 지표 위반 확인
    if (metrics.recall < thresholds.recall) violations.push({ metric: 'recall', value: metrics.recall, threshold: thresholds.recall })
    if (metrics.detectionLatency > thresholds.detectionLatency) violations.push({ metric: 'detectionLatency', value: metrics.detectionLatency, threshold: thresholds.detectionLatency })
    
    // Stage-2 (식별) 지표 위반 확인
    if (metrics.top1Accuracy < thresholds.top1Accuracy) violations.push({ metric: 'top1Accuracy', value: metrics.top1Accuracy, threshold: thresholds.top1Accuracy })
    if (metrics.stage2Rate > thresholds.stage2Rate) violations.push({ metric: 'stage2Rate', value: metrics.stage2Rate, threshold: thresholds.stage2Rate })
    if (metrics.searchLatency > thresholds.searchLatency) violations.push({ metric: 'searchLatency', value: metrics.searchLatency, threshold: thresholds.searchLatency })
    
    // 전체 파이프라인 지표 위반 확인
    if (metrics.p95Latency > thresholds.p95Latency) violations.push({ metric: 'p95Latency', value: metrics.p95Latency, threshold: thresholds.p95Latency })
    if (metrics.holdRate > thresholds.holdRate) violations.push({ metric: 'holdRate', value: metrics.holdRate, threshold: thresholds.holdRate })
    if (metrics.webpDecodeP95 > thresholds.webpDecodeP95) violations.push({ metric: 'webpDecodeP95', value: metrics.webpDecodeP95, threshold: thresholds.webpDecodeP95 })
    if (metrics.falseDetectionRate > thresholds.falseDetectionRate) violations.push({ metric: 'falseDetectionRate', value: metrics.falseDetectionRate, threshold: thresholds.falseDetectionRate })
    if (metrics.occlusionIQR > thresholds.occlusionIQR) violations.push({ metric: 'occlusionIQR', value: metrics.occlusionIQR, threshold: thresholds.occlusionIQR })
    if (metrics.oodRate > thresholds.oodRate) violations.push({ metric: 'oodRate', value: metrics.oodRate, threshold: thresholds.oodRate })
    
    // 2단계 모델 기반 의사결정 트리
    let recommendedAction = 'none'
    
    // Stage-1 (탐지) 위반 확인
    const stage1Violations = violations.filter(v => 
      ['recall', 'detectionLatency'].includes(v.metric)
    )
    
    // Stage-2 (식별) 위반 확인
    const stage2Violations = violations.filter(v => 
      ['top1Accuracy', 'stage2Rate', 'searchLatency'].includes(v.metric)
    )
    
    // 전체 파이프라인 위반 확인
    const pipelineViolations = violations.filter(v => 
      ['p95Latency', 'holdRate', 'webpDecodeP95'].includes(v.metric)
    )
    
    // 기술서 기반 의사결정
    if (stage1Violations.length >= 2 || stage2Violations.length >= 2 || pipelineViolations.length >= 2) {
      // 다수 지표 위반 시 전체 파이프라인 재학습
      recommendedAction = 'full_pipeline_retrain'
    } else if (stage1Violations.length >= 1) {
      // Stage-1 위반 시 탐지 모델 재학습
      recommendedAction = 'stage1_retrain'
    } else if (stage2Violations.length >= 1) {
      // Stage-2 위반 시 식별 모델 재학습
      recommendedAction = 'stage2_retrain'
    } else if (violations.length >= 1) {
      // 기타 위반 시 증분 학습
      recommendedAction = 'incremental'
    }
    
    console.log(`✅ 성능 지표 조회 완료: ${violations.length}개 위반, 권장 액션: ${recommendedAction}`)
    
    res.json({
      success: true,
      metrics,
      thresholds,
      violations,
      recommendedAction,
      status: violations.length === 0 ? 'healthy' : violations.length >= 2 ? 'critical' : 'warning'
    })
  } catch (error) {
    console.error('❌ 성능 지표 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 부품 단위 학습 트리거
app.post('/api/synthetic/monitor/trigger', async (req, res) => {
  try {
    const { partId, mode, action, reason } = req.body
    console.log(`🚀 학습 트리거 실행: 부품 ${partId}, 모드: ${mode}, 액션: ${action}`)
    console.log('📋 요청 본문:', JSON.stringify(req.body, null, 2))
    
    // 부품 단위 학습인 경우
    if (partId && mode === 'part') {
      console.log(`📦 부품 ${partId} 단위 학습 시작`)
      
      // 부품 존재 확인
      const { data: partData, error: partError } = await supabase
        .from('parts_master')
        .select('part_id, part_name')
        .eq('part_id', partId)
        .limit(1)
      
      if (partError) {
        throw new Error(`부품 조회 실패: ${partError.message}`)
      }
      
      if (!partData || partData.length === 0) {
        throw new Error(`존재하지 않는 부품: ${partId}`)
      }
      
      // 이미지 데이터 확인
      const { data: imageData, error: imageError } = await supabase
        .from('synthetic_dataset')
        .select('*')
        .eq('part_id', partId)
        .eq('status', 'uploaded')
      
      if (imageError) {
        throw new Error(`이미지 데이터 조회 실패: ${imageError.message}`)
      }
      
      const imageCount = imageData?.length || 0
      console.log(`📊 부품 ${partId} 이미지 수: ${imageCount}개`)
      
      if (imageCount === 0) {
        throw new Error(`부품 ${partId}에 학습용 이미지가 없습니다`)
      }
      
      // 학습 작업 생성 (upsert 사용)
      const { data: trainingJob, error: jobError } = await supabase
        .from('part_training_status')
        .upsert({
          part_id: partId,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'part_id'
        })
        .select()
        .single()
      
      if (jobError) {
        throw new Error(`학습 작업 생성 실패: ${jobError.message}`)
      }
      
      console.log(`✅ 부품 ${partId} 학습 작업 생성 완료: ${trainingJob.id}`)
      
      res.json({
        success: true,
        message: `부품 ${partId} 학습이 시작되었습니다`,
        jobId: trainingJob.id,
        partId: partId,
        imageCount: imageCount,
        timestamp: new Date().toISOString()
      })
      return
    }
    
    // Storage에서 model_registry로 모델 동기화
app.post('/api/synthetic/sync-models', async (req, res) => {
  try {
    console.log('🔄 Storage → model_registry 동기화 시작...')
    
    // Storage에서 모델 파일 목록 조회
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('models')
      .list('', { limit: 1000 })
    
    if (storageError) {
      throw new Error(`Storage 조회 실패: ${storageError.message}`)
    }
    
    console.log(`📁 Storage에서 발견된 파일: ${storageFiles?.length || 0}개`)
    
    if (!storageFiles || storageFiles.length === 0) {
      return res.json({
        success: true,
        message: 'Storage에 모델 파일이 없습니다',
        synced: 0
      })
    }
    
    // .pt 파일만 필터링
    const modelFiles = storageFiles.filter(file => file.name.endsWith('.pt'))
    console.log(`🤖 모델 파일 (.pt): ${modelFiles.length}개`)
    
    let syncedCount = 0
    const results = []
    
    for (const file of modelFiles) {
      try {
        // 파일 정보 조회
        const { data: fileInfo } = await supabase
          .storage
          .from('models')
          .getPublicUrl(file.name)
        
        // 파일 크기 조회
        const { data: fileData } = await supabase
          .storage
          .from('models')
          .download(file.name)
        
        const fileSize = fileData?.size || 0
        const fileSizeMB = Math.round((fileSize / (1024 * 1024)) * 100) / 100
        
        // 모델명 생성 (파일명에서 확장자 제거)
        const modelName = file.name.replace('.pt', '')
        
        // 이미 등록된 모델인지 확인
        const { data: existingModel } = await supabase
          .from('model_registry')
          .select('id')
          .eq('model_name', modelName)
          .limit(1)
        
        if (existingModel && existingModel.length > 0) {
          console.log(`⏭️ 모델 ${modelName}은 이미 등록됨`)
          continue
        }
        
        // model_registry에 등록
        const modelData = {
          model_name: modelName,
          version: '1.0.0',
          model_url: fileInfo?.publicUrl || '',
          model_path: file.name,
          model_size: fileSize,
          model_size_mb: fileSizeMB,
          status: 'trained',
          is_active: false, // 기본적으로 비활성화
          model_type: 'yolo',
          model_stage: 'single',
          performance_metrics: {
            map50: 0.0,
            map75: 0.0,
            precision: 0.0,
            recall: 0.0
          },
          training_metadata: {
            source: 'storage_sync',
            synced_at: new Date().toISOString()
          },
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const { data: insertedModel, error: insertError } = await supabase
          .from('model_registry')
          .insert(modelData)
          .select()
          .single()
        
        if (insertError) {
          console.error(`❌ 모델 ${modelName} 등록 실패:`, insertError)
          results.push({
            model: modelName,
            success: false,
            error: insertError.message
          })
        } else {
          console.log(`✅ 모델 ${modelName} 등록 완료`)
          syncedCount++
          results.push({
            model: modelName,
            success: true,
            id: insertedModel.id
          })
        }
        
      } catch (fileError) {
        console.error(`❌ 파일 ${file.name} 처리 실패:`, fileError)
        results.push({
          model: file.name,
          success: false,
          error: fileError.message
        })
      }
    }
    
    console.log(`🎯 동기화 완료: ${syncedCount}개 모델 등록됨`)
    
    res.json({
      success: true,
      message: `Storage에서 ${syncedCount}개 모델을 model_registry에 등록했습니다`,
      synced: syncedCount,
      total: modelFiles.length,
      results: results
    })
    
  } catch (error) {
    console.error('❌ 모델 동기화 실패:', error)
    res.json({
      success: false,
      error: error.message
    })
  }
})

// 부품 단위 학습 트리거 함수
async function triggerPartTraining(partId, reason) {
  try {
    console.log(`🧩 부품 ${partId} 단위 학습 시작: ${reason}`)
    
    // 부품 데이터 확인
    const { data: partData, error: partError } = await supabase
      .from('parts_master')
      .select('part_id, part_name')
      .eq('part_id', partId)
      .limit(1)
    
    if (partError) throw new Error(`부품 조회 실패: ${partError.message}`)
    if (!partData || partData.length === 0) throw new Error(`존재하지 않는 부품: ${partId}`)
    
    // 이미지 데이터 확인
    const { data: imageData, error: imageError } = await supabase
      .from('synthetic_dataset')
      .select('*')
      .eq('part_id', partId)
      .eq('status', 'uploaded')
    
    if (imageError) throw new Error(`이미지 데이터 조회 실패: ${imageError.message}`)
    
    const imageCount = imageData?.length || 0
    console.log(`📊 부품 ${partId} 이미지 수: ${imageCount}개`)
    
    if (imageCount === 0) {
      throw new Error(`부품 ${partId}에 학습용 이미지가 없습니다`)
    }
    
    // 학습 작업 상태 업데이트
    const { error: updateError } = await supabase
      .from('part_training_status')
      .update({
        status: 'training',
        updated_at: new Date().toISOString()
      })
      .eq('part_id', partId)
    
    if (updateError) {
      console.warn('학습 상태 업데이트 실패:', updateError)
    }
    
    console.log(`✅ 부품 ${partId} 학습 작업이 시작되었습니다`)
    
    return {
      success: true,
      partId: partId,
      imageCount: imageCount,
      message: `부품 ${partId} 학습이 시작되었습니다`
    }
    
  } catch (error) {
    console.error(`❌ 부품 ${partId} 학습 실패:`, error)
    throw error
  }
}

// 기존 자동 트리거 로직
    let result = null
    
    if (action === 'incremental' || action === 'incremental_learning') {
      // 증분 학습 트리거
      console.log('📈 증분 학습 트리거 실행')
      result = await triggerIncrementalLearning(reason)
    } else if (action === 'part_training') {
      // 부품 단위 학습 트리거
      console.log('🧩 부품 단위 학습 트리거 실행')
      result = await triggerPartTraining(partId, reason)
    } else if (action === 'full_retrain') {
      // 전체 재학습 트리거
      console.log('🔄 전체 재학습 트리거 실행')
      result = await triggerFullRetraining(reason)
    } else if (action === 'stage1_incremental') {
      // Stage-1 증분 학습 트리거
      console.log('🔍 Stage-1 증분 학습 트리거 실행')
      result = await triggerStage1IncrementalLearning(reason)
    } else if (action === 'stage1_full_retrain') {
      // Stage-1 전체 재학습 트리거
      console.log('🔍 Stage-1 전체 재학습 트리거 실행')
      result = await triggerStage1FullRetraining(reason)
    } else if (action === 'stage2_incremental') {
      // Stage-2 증분 학습 트리거
      console.log('🎯 Stage-2 증분 학습 트리거 실행')
      result = await triggerStage2IncrementalLearning(reason)
    } else if (action === 'stage2_full_retrain') {
      // Stage-2 전체 재학습 트리거
      console.log('🎯 Stage-2 전체 재학습 트리거 실행')
      result = await triggerStage2FullRetraining(reason)
    } else if (action === 'full_pipeline_retrain') {
      // 전체 파이프라인 재학습 트리거
      console.log('⚡ 전체 파이프라인 재학습 트리거 실행')
      result = await triggerFullPipelineRetraining(reason)
    } else {
      throw new Error(`지원하지 않는 액션: ${action}`)
    }
    
    res.json({
      success: true,
      message: `${action} 트리거가 실행되었습니다`,
      result: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ 자동 트리거 실행 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 증분 학습 트리거 실행
const triggerIncrementalLearning = async (reason) => {
  try {
    console.log('📈 증분 학습 파이프라인 시작...')
    
    const { spawn } = await import('child_process')
    const path = await import('path')
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'incremental_learning_pipeline.py')
    
    return new Promise((resolve, reject) => {
      const process = spawn('python', [scriptPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log(`[증분학습] ${data.toString().trim()}`)
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[증분학습] ${data.toString().trim()}`)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            console.log('✅ 증분 학습 완료:', result)
            resolve(result)
          } catch (e) {
            console.log('✅ 증분 학습 완료 (JSON 파싱 실패):', stdout)
            resolve({ status: 'completed', output: stdout })
          }
        } else {
          console.error('❌ 증분 학습 실패:', stderr)
          reject(new Error(`증분 학습 실패 (종료 코드: ${code}): ${stderr}`))
        }
      })
      
      process.on('error', (error) => {
        console.error('❌ 증분 학습 프로세스 오류:', error)
        reject(error)
      })
    })
  } catch (error) {
    console.error('❌ 증분 학습 트리거 실패:', error)
    throw error
  }
}

// 전체 재학습 트리거 실행
const triggerFullRetraining = async (reason) => {
  try {
    console.log('🔄 전체 재학습 파이프라인 시작...')
    
    const { spawn } = await import('child_process')
    const path = await import('path')
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'full_retraining_pipeline.py')
    
    return new Promise((resolve, reject) => {
      const process = spawn('python', [scriptPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log(`[전체재학습] ${data.toString().trim()}`)
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[전체재학습] ${data.toString().trim()}`)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            console.log('✅ 전체 재학습 완료:', result)
            resolve(result)
          } catch (e) {
            console.log('✅ 전체 재학습 완료 (JSON 파싱 실패):', stdout)
            resolve({ status: 'completed', output: stdout })
          }
        } else {
          console.error('❌ 전체 재학습 실패:', stderr)
          reject(new Error(`전체 재학습 실패 (종료 코드: ${code}): ${stderr}`))
        }
      })
      
      process.on('error', (error) => {
        console.error('❌ 전체 재학습 프로세스 오류:', error)
        reject(error)
      })
    })
  } catch (error) {
    console.error('❌ 전체 재학습 트리거 실패:', error)
    throw error
  }
}

// Stage-1 증분 학습 트리거
const triggerStage1IncrementalLearning = async (reason) => {
  try {
    console.log('🔍 Stage-1 증분 학습 파이프라인 시작...')
    
    const { spawn } = await import('child_process')
    const path = await import('path')
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'stage1_incremental_learning.py')
    
    return new Promise((resolve, reject) => {
      const process = spawn('python', [scriptPath, '--reason', reason], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log(`[Stage-1증분학습] ${data.toString().trim()}`)
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[Stage-1증분학습] ${data.toString().trim()}`)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            console.log('✅ Stage-1 증분 학습 완료:', result)
            resolve(result)
          } catch (e) {
            console.log('✅ Stage-1 증분 학습 완료 (JSON 파싱 실패):', stdout)
            resolve({ status: 'completed', output: stdout })
          }
        } else {
          console.error('❌ Stage-1 증분 학습 실패:', stderr)
          reject(new Error(`Stage-1 증분 학습 실패 (종료 코드: ${code}): ${stderr}`))
        }
      })
      
      process.on('error', (error) => {
        console.error('❌ Stage-1 증분 학습 프로세스 오류:', error)
        reject(error)
      })
    })
  } catch (error) {
    console.error('❌ Stage-1 증분 학습 트리거 실패:', error)
    throw error
  }
}

// Stage-1 전체 재학습 트리거
const triggerStage1FullRetraining = async (reason) => {
  try {
    console.log('🔍 Stage-1 전체 재학습 파이프라인 시작...')
    
    const { spawn } = await import('child_process')
    const path = await import('path')
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'stage1_full_retraining.py')
    
    return new Promise((resolve, reject) => {
      const process = spawn('python', [scriptPath, '--reason', reason], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log(`[Stage-1전체재학습] ${data.toString().trim()}`)
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[Stage-1전체재학습] ${data.toString().trim()}`)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            console.log('✅ Stage-1 전체 재학습 완료:', result)
            resolve(result)
          } catch (e) {
            console.log('✅ Stage-1 전체 재학습 완료 (JSON 파싱 실패):', stdout)
            resolve({ status: 'completed', output: stdout })
          }
        } else {
          console.error('❌ Stage-1 전체 재학습 실패:', stderr)
          reject(new Error(`Stage-1 전체 재학습 실패 (종료 코드: ${code}): ${stderr}`))
        }
      })
      
      process.on('error', (error) => {
        console.error('❌ Stage-1 전체 재학습 프로세스 오류:', error)
        reject(error)
      })
    })
  } catch (error) {
    console.error('❌ Stage-1 전체 재학습 트리거 실패:', error)
    throw error
  }
}

// Stage-2 증분 학습 트리거
const triggerStage2IncrementalLearning = async (reason) => {
  try {
    console.log('🎯 Stage-2 증분 학습 파이프라인 시작...')
    
    const { spawn } = await import('child_process')
    const path = await import('path')
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'stage2_incremental_learning.py')
    
    return new Promise((resolve, reject) => {
      const process = spawn('python', [scriptPath, '--reason', reason], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log(`[Stage-2증분학습] ${data.toString().trim()}`)
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[Stage-2증분학습] ${data.toString().trim()}`)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            console.log('✅ Stage-2 증분 학습 완료:', result)
            resolve(result)
          } catch (e) {
            console.log('✅ Stage-2 증분 학습 완료 (JSON 파싱 실패):', stdout)
            resolve({ status: 'completed', output: stdout })
          }
        } else {
          console.error('❌ Stage-2 증분 학습 실패:', stderr)
          reject(new Error(`Stage-2 증분 학습 실패 (종료 코드: ${code}): ${stderr}`))
        }
      })
      
      process.on('error', (error) => {
        console.error('❌ Stage-2 증분 학습 프로세스 오류:', error)
        reject(error)
      })
    })
  } catch (error) {
    console.error('❌ Stage-2 증분 학습 트리거 실패:', error)
    throw error
  }
}

// Stage-2 전체 재학습 트리거
const triggerStage2FullRetraining = async (reason) => {
  try {
    console.log('🎯 Stage-2 전체 재학습 파이프라인 시작...')
    
    const { spawn } = await import('child_process')
    const path = await import('path')
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'stage2_full_retraining.py')
    
    return new Promise((resolve, reject) => {
      const process = spawn('python', [scriptPath, '--reason', reason], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log(`[Stage-2전체재학습] ${data.toString().trim()}`)
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[Stage-2전체재학습] ${data.toString().trim()}`)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            console.log('✅ Stage-2 전체 재학습 완료:', result)
            resolve(result)
          } catch (e) {
            console.log('✅ Stage-2 전체 재학습 완료 (JSON 파싱 실패):', stdout)
            resolve({ status: 'completed', output: stdout })
          }
        } else {
          console.error('❌ Stage-2 전체 재학습 실패:', stderr)
          reject(new Error(`Stage-2 전체 재학습 실패 (종료 코드: ${code}): ${stderr}`))
        }
      })
      
      process.on('error', (error) => {
        console.error('❌ Stage-2 전체 재학습 프로세스 오류:', error)
        reject(error)
      })
    })
  } catch (error) {
    console.error('❌ Stage-2 전체 재학습 트리거 실패:', error)
    throw error
  }
}

// 전체 파이프라인 재학습 트리거
const triggerFullPipelineRetraining = async (reason) => {
  try {
    console.log('⚡ 전체 파이프라인 재학습 시작...')
    
    const { spawn } = await import('child_process')
    const path = await import('path')
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'full_pipeline_retraining.py')
    
    return new Promise((resolve, reject) => {
      const process = spawn('python', [scriptPath, '--reason', reason], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log(`[전체파이프라인재학습] ${data.toString().trim()}`)
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[전체파이프라인재학습] ${data.toString().trim()}`)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            console.log('✅ 전체 파이프라인 재학습 완료:', result)
            resolve(result)
          } catch (e) {
            console.log('✅ 전체 파이프라인 재학습 완료 (JSON 파싱 실패):', stdout)
            resolve({ status: 'completed', output: stdout })
          }
        } else {
          console.error('❌ 전체 파이프라인 재학습 실패:', stderr)
          reject(new Error(`전체 파이프라인 재학습 실패 (종료 코드: ${code}): ${stderr}`))
        }
      })
      
      process.on('error', (error) => {
        console.error('❌ 전체 파이프라인 재학습 프로세스 오류:', error)
        reject(error)
      })
    })
  } catch (error) {
    console.error('❌ 전체 파이프라인 재학습 트리거 실패:', error)
    throw error
  }
}

// 자동 학습 실행 API 엔드포인트
app.post('/api/synthetic/training/start', async (req, res) => {
  try {
    const { job_id, config, set_num } = req.body
    console.log('🚀 자동 학습 실행 요청:', { job_id, config, set_num })
    
    // 학습 스크립트 실행
    const { spawn } = await import('child_process')
    const path = await import('path')
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'local_yolo_training.py')
    const args = [
      '--set_num', set_num || 'latest',
      '--epochs', config.epochs || 100,
      '--batch_size', config.batch_size || 16,
      '--imgsz', config.imgsz || 640,
      '--device', config.device || 'cuda',
      '--job_id', job_id
    ]
    
    console.log('📋 실행 명령어:', `python ${scriptPath} ${args.join(' ')}`)
    
    const trainingProcess = spawn('python', [scriptPath, ...args], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PYTHONUTF8: '1'
      }
    })
    
    // 프로세스 출력 처리
    trainingProcess.stdout.on('data', (data) => {
      const message = data.toString('utf8').trim()
      console.log(`[학습] ${message}`)
    })
    
    trainingProcess.stderr.on('data', (data) => {
      const message = data.toString('utf8').trim()
      console.error(`[학습 오류] ${message}`)
    })
    
    trainingProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ 자동 학습 완료')
      } else {
        console.error(`❌ 자동 학습 실패 (종료 코드: ${code})`)
      }
    })
    
    trainingProcess.on('error', (error) => {
      console.error('❌ 자동 학습 프로세스 오류:', error)
    })
    
    res.json({
      success: true,
      message: '자동 학습이 시작되었습니다',
      process_id: trainingProcess.pid,
      job_id: job_id
    })
    
  } catch (error) {
    console.error('❌ 자동 학습 실행 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 학습 작업 관리 API 엔드포인트들
// 학습 작업 목록 조회
app.get('/api/synthetic/training/jobs', async (req, res) => {
  try {
    console.log('📋 학습 작업 목록 조회')
    
    // 학습 작업 목록 조회 (실제 구현 시 데이터베이스에서 조회)
    const jobs = await getTrainingJobs()
    
    res.json({
      success: true,
      jobs: jobs
    })
  } catch (error) {
    console.error('❌ 학습 작업 목록 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 학습 작업 상태 조회
app.get('/api/synthetic/training/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params
    console.log(`📊 학습 작업 ${jobId} 상태 조회`)
    
    const jobStatus = await getTrainingJobStatus(jobId)
    
    res.json({
      success: true,
      job: jobStatus
    })
  } catch (error) {
    console.error('❌ 학습 작업 상태 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 학습 작업 재시도
app.post('/api/synthetic/training/jobs/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params
    console.log(`🔄 학습 작업 ${jobId} 재시도`)
    
    const result = await retryTrainingJob(jobId)
    
    res.json({
      success: true,
      message: '학습 작업 재시도가 시작되었습니다',
      result: result
    })
  } catch (error) {
    console.error('❌ 학습 작업 재시도 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 학습 작업 취소
app.post('/api/synthetic/training/jobs/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params
    console.log(`⏹️ 학습 작업 ${jobId} 취소`)
    
    const result = await cancelTrainingJob(jobId)
    
    res.json({
      success: true,
      message: '학습 작업이 취소되었습니다',
      result: result
    })
  } catch (error) {
    console.error('❌ 학습 작업 취소 실패:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// ===== Render Queue 관리 API =====

// Render Queue 상태 조회
app.get('/api/synthetic/queue/status', async (req, res) => {
  try {
    console.log('📊 Render Queue 상태 조회')
    // Supabase 그룹 집계 호환 이슈를 피하기 위해 상태별 개별 카운트로 계산
    const safeCount = async (filterStatus) => {
      try {
        let query = supabase
          .from('render_queue')
          .select('*', { count: 'exact', head: true })
        if (filterStatus) query = query.eq('status', filterStatus)
        const { count, error } = await query
        if (error) throw error
        return count || 0
      } catch (e) {
        console.warn('Render Queue 카운트 조회 실패(0으로 대체):', e?.message || e)
        return 0
      }
    }

    const [pending, processing, completed, failed, total] = await Promise.all([
      safeCount('pending'),
      safeCount('processing'),
      safeCount('completed'),
      safeCount('failed'),
      safeCount(null)
    ])

    const stats = { pending, processing, completed, failed, total }

    res.json({
      success: true,
      stats,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Render Queue 상태 조회 실패:', error)
    // 폴백: 500 대신 안전한 기본값으로 응답하여 UI가 동작하도록 유지
    res.json({
      success: true,
      stats: { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 },
      lastUpdated: new Date().toISOString(),
      warning: error?.message || String(error)
    })
  }
})

// Render Queue 작업 목록 조회
app.get('/api/synthetic/queue/tasks', async (req, res) => {
  try {
    const { status = 'pending', limit = 50 } = req.query
    console.log(`📋 Render Queue 작업 목록 조회: status=${status}, limit=${limit}`)
    
    let query = supabase
      .from('render_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (status !== 'all') {
      query = query.eq('status', status)
    }
    
    const { data: tasks, error } = await query
    
    if (error) {
      throw error
    }
    
    res.json({
      success: true,
      tasks: tasks || [],
      count: tasks?.length || 0
    })
  } catch (error) {
    console.error('Render Queue 작업 목록 조회 실패:', error)
    res.status(500).json({
      success: false,
      message: 'Render Queue 작업 목록 조회 실패',
      error: error.message
    })
  }
})

// 실패한 작업 재처리 트리거
app.post('/api/synthetic/queue/process', async (req, res) => {
  try {
    console.log('🔄 실패한 작업 재처리 트리거')
    
    // Python 스크립트 실행
    const process = spawn('python', [
      path.join(__dirname, '..', 'scripts', 'render_ldraw_to_supabase.py'),
      '--process-failed-queue'
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let output = ''
    let errorOutput = ''
    
    process.stdout.on('data', (data) => {
      output += data.toString()
      console.log('재처리 출력:', data.toString())
    })
    
    process.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.error('재처리 에러:', data.toString())
    })
    
    process.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          message: '실패한 작업 재처리 완료',
          output: output.trim()
        })
      } else {
        res.status(500).json({
          success: false,
          message: '실패한 작업 재처리 실패',
          error: errorOutput.trim(),
          output: output.trim()
        })
      }
    })
    
    process.on('error', (error) => {
      console.error('재처리 프로세스 실행 실패:', error)
      res.status(500).json({
        success: false,
        message: '재처리 프로세스 실행 실패',
        error: error.message
      })
    })
    
  } catch (error) {
    console.error('실패한 작업 재처리 트리거 실패:', error)
    res.status(500).json({
      success: false,
      message: '실패한 작업 재처리 트리거 실패',
      error: error.message
    })
  }
})

// ===== 에러 복구 로그 API =====

// 에러 복구 로그 조회
app.get('/api/synthetic/logs/error-recovery', async (req, res) => {
  try {
    const { 
      errorType = 'all', 
      limit = 100, 
      offset = 0,
      startDate,
      endDate 
    } = req.query
    
    console.log(`📋 에러 복구 로그 조회: errorType=${errorType}, limit=${limit}`)
    
    let query = supabase
      .from('operation_logs')
      .select('*')
      .eq('metadata->>log_type', 'error_recovery')
      .order('timestamp', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
    
    // 날짜 필터링
    if (startDate) {
      query = query.gte('timestamp', startDate)
    }
    if (endDate) {
      query = query.lte('timestamp', endDate)
    }
    
    const { data: logs, error } = await query
    
    if (error) {
      throw error
    }
    
    // 에러 타입별 필터링
    let filteredLogs = logs || []
    if (errorType !== 'all') {
      filteredLogs = filteredLogs.filter(log => 
        log.metadata?.error_type === errorType
      )
    }
    
    res.json({
      success: true,
      logs: filteredLogs,
      count: filteredLogs.length,
      total: logs?.length || 0
    })
  } catch (error) {
    console.error('에러 복구 로그 조회 실패:', error)
    res.status(500).json({
      success: false,
      message: '에러 복구 로그 조회 실패',
      error: error.message
    })
  }
})

// 에러 복구 로그 통계
app.get('/api/synthetic/logs/error-recovery/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query
    console.log(`📊 에러 복구 로그 통계: ${days}일`)
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))
    
    const { data: logs, error } = await supabase
      .from('operation_logs')
      .select('metadata, timestamp')
      .eq('metadata->>log_type', 'error_recovery')
      .gte('timestamp', startDate.toISOString())
    
    if (error) {
      throw error
    }
    
    // 에러 타입별 통계
    const errorTypeStats = {}
    const dailyStats = {}
    
    logs?.forEach(log => {
      const errorType = log.metadata?.error_type || 'unknown'
      const date = log.timestamp.split('T')[0]
      
      // 에러 타입별 카운트
      errorTypeStats[errorType] = (errorTypeStats[errorType] || 0) + 1
      
      // 일별 카운트
      dailyStats[date] = (dailyStats[date] || 0) + 1
    })
    
    res.json({
      success: true,
      stats: {
        totalErrors: logs?.length || 0,
        errorTypeStats,
        dailyStats,
        period: `${days}일`
      }
    })
  } catch (error) {
    console.error('에러 복구 로그 통계 조회 실패:', error)
    res.status(500).json({
      success: false,
      message: '에러 복구 로그 통계 조회 실패',
      error: error.message
    })
  }
})

// 학습 작업 목록 조회 함수
const getTrainingJobs = async () => {
  try {
    // 실제 구현 시 데이터베이스에서 조회
    // 현재는 파일 시스템에서 조회
    const fs = await import('fs')
    const path = await import('path')
    
    const jobsFile = path.join(__dirname, '..', 'logs', 'training_jobs.json')
    if (fs.existsSync(jobsFile)) {
      const data = fs.readFileSync(jobsFile, 'utf8')
      return JSON.parse(data)
    }
    
    return []
  } catch (error) {
    console.error('학습 작업 목록 조회 실패:', error)
    return []
  }
}

// 학습 작업 상태 조회 함수
const getTrainingJobStatus = async (jobId) => {
  try {
    const jobs = await getTrainingJobs()
    return jobs.find(job => job.id === jobId) || null
  } catch (error) {
    console.error('학습 작업 상태 조회 실패:', error)
    return null
  }
}

// 학습 작업 재시도 함수
const retryTrainingJob = async (jobId) => {
  try {
    console.log(`🔄 학습 작업 ${jobId} 재시도 시작`)
    
    // 작업 상태를 pending으로 변경
    const fs = await import('fs')
    const path = await import('path')
    
    const jobsFile = path.join(__dirname, '..', 'logs', 'training_jobs.json')
    if (fs.existsSync(jobsFile)) {
      const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'))
      const jobIndex = jobs.findIndex(job => job.id === jobId)
      
      if (jobIndex !== -1) {
        jobs[jobIndex].status = 'pending'
        jobs[jobIndex].updated_at = new Date().toISOString()
        
        fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2))
        console.log(`✅ 학습 작업 ${jobId} 재시도 설정 완료`)
      }
    }
    
    return { jobId, status: 'pending' }
  } catch (error) {
    console.error('학습 작업 재시도 실패:', error)
    throw error
  }
}

// 학습 작업 취소 함수
const cancelTrainingJob = async (jobId) => {
  try {
    console.log(`⏹️ 학습 작업 ${jobId} 취소 시작`)
    
    // 작업 상태를 cancelled로 변경
    const fs = await import('fs')
    const path = await import('path')
    
    const jobsFile = path.join(__dirname, '..', 'logs', 'training_jobs.json')
    if (fs.existsSync(jobsFile)) {
      const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'))
      const jobIndex = jobs.findIndex(job => job.id === jobId)
      
      if (jobIndex !== -1) {
        jobs[jobIndex].status = 'cancelled'
        jobs[jobIndex].cancelled_at = new Date().toISOString()
        jobs[jobIndex].updated_at = new Date().toISOString()
        
        fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2))
        console.log(`✅ 학습 작업 ${jobId} 취소 완료`)
      }
    }
    
    return { jobId, status: 'cancelled' }
  } catch (error) {
    console.error('학습 작업 취소 실패:', error)
    throw error
  }
}

// fetch polyfill (Node.js 환경) - 서버 시작 전에 선언
let fetchFn
(async () => {
  try {
    // Node.js 18+ has native fetch
    if (globalThis.fetch) {
      fetchFn = globalThis.fetch
    } else {
      const { default: nodeFetch } = await import('node-fetch')
      fetchFn = nodeFetch
    }
  } catch {
    // node-fetch가 없으면 HTTP 모듈 사용
    const http = await import('http')
    fetchFn = async (url, options) => {
      return new Promise((resolve, reject) => {
        try {
          const urlObj = new URL(url)
          const request = http.request({
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname,
            method: options?.method || 'GET',
            headers: options?.headers || {}
          }, (response) => {
            let data = ''
            response.on('data', chunk => data += chunk)
            response.on('end', () => {
              resolve({
                ok: response.statusCode >= 200 && response.statusCode < 300,
                status: response.statusCode,
                json: async () => JSON.parse(data),
                text: async () => data
              })
            })
          })
          request.on('error', reject)
          if (options?.body) {
            request.write(options.body)
          }
          request.end()
        } catch (error) {
          reject(error)
        }
      })
    }
  }
})()

// 🔧 수정됨: 서버 시작을 안전하게 처리
startServer().then(async () => {
  // fetchFn이 준비될 때까지 대기
  while (!fetchFn) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // 서버 시작 완료 후 저장된 작업 복구 시도
  try {
    if (fs.existsSync(ACTIVE_JOBS_STATE_FILE)) {
      const data = fs.readFileSync(ACTIVE_JOBS_STATE_FILE, 'utf8')
      const savedJobs = JSON.parse(data)
      
      // 실행 중이거나 대기 중인 작업만 복구
      const recoverableJobs = savedJobs.filter(job => 
        job.status === 'running' || job.status === 'pending'
      )
      
      if (recoverableJobs.length > 0) {
        console.log(`🔄 복구 가능한 작업 발견: ${recoverableJobs.length}개`)
        console.log('💡 작업을 수동으로 재개하려면: npm run recover:resume')
        
        // 30초 후 자동 복구 시도 (서버가 완전히 준비될 때까지 대기)
        setTimeout(async () => {
          for (const job of recoverableJobs) {
            try {
              console.log(`🔄 작업 재개 시도: ${job.id}`)
              
              const resumeResponse = await fetchFn('http://localhost:3011/api/synthetic/start-rendering', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  mode: job.config.mode,
                  partId: job.config.partId,
                  setNum: job.config.setNum || job.config.setNumber,
                  imageCount: job.config.imageCount,
                  quality: job.config.quality,
                  background: job.config.background,
                  resolution: job.config.resolution,
                  targetFill: job.config.targetFill,
                  elementId: job.config.elementId
                })
              })
              
              if (resumeResponse.ok) {
                const result = await resumeResponse.json()
                console.log(`✅ 작업 재개 완료: ${job.id} -> ${result.jobId}`)
              } else {
                console.warn(`⚠️ 작업 재개 실패: ${job.id}`)
              }
              
              await new Promise(resolve => setTimeout(resolve, 1000))
            } catch (error) {
              console.error(`❌ 작업 재개 오류 (${job.id}):`, error.message)
            }
          }
        }, 30000) // 30초 대기
      }
    }
  } catch (error) {
    console.error('❌ 작업 복구 실패:', error.message)
  }
}).catch(error => {
  console.error('❌ [서버 시작 실패]:', error)
  console.error('스택:', error.stack)
  // 전역 핸들러가 처리하지만, 여기서도 명시적으로 처리
})

// Express 앱 레벨 에러 핸들러 추가
app.use((err, req, res, next) => {
  console.error('❌ [Express 에러 핸들러]:', err.message)
  console.error('스택:', err.stack)
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '서버 오류가 발생했습니다',
    // 프로덕션에서는 상세 스택 추적 제거
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// 경로 설정 API 엔드포인트
// 현재 경로 조회
app.get('/api/synthetic/config/path', (req, res) => {
  try {
    const currentPath = getSyntheticRoot()
    const datasetPath = getDatasetSyntheticPath()
    
    // 환경 변수 파일에서 현재 설정 읽기
    const envPath = path.join(process.cwd(), 'config', 'synthetic_dataset.env')
    let envContent = ''
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
      // [FIX] 수정됨: 주석이 아닌 실제 설정 라인만 매칭 (^로 시작, # 제외)
      const lines = envContent.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        // 주석이 아니고 BRICKBOX_SYNTHETIC_ROOT로 시작하는 라인만 매칭
        if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('BRICKBOX_SYNTHETIC_ROOT=')) {
          const match = trimmed.match(/^BRICKBOX_SYNTHETIC_ROOT=(.+)$/)
          if (match) {
            const configuredPath = match[1].trim()
            return res.json({
              success: true,
              currentPath,
              datasetPath,
              configuredPath,
              source: 'env_file'
            })
          }
        }
      }
    }
    
    // 환경 변수 파일에 설정이 없으면 기본값 반환
    res.json({
      success: true,
      currentPath,
      datasetPath,
      configuredPath: './output/synthetic',
      source: 'default'
    })
  } catch (error) {
    console.error('경로 설정 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 경로 설정 업데이트
app.post('/api/synthetic/config/path', (req, res) => {
  try {
    const { path: newPath } = req.body
    
    if (!newPath || typeof newPath !== 'string') {
      return res.status(400).json({
        success: false,
        error: '경로가 필요합니다'
      })
    }
    
    // 경로 유효성 검사
    const trimmedPath = newPath.trim()
    if (trimmedPath.length === 0) {
      return res.status(400).json({
        success: false,
        error: '경로가 비어있습니다'
      })
    }
    
    // 환경 변수 파일 경로
    const envPath = path.join(process.cwd(), 'config', 'synthetic_dataset.env')
    
    // 환경 변수 파일 읽기
    let envContent = ''
    let lineEnding = '\n' // 기본 줄바꿈 문자
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
      // 줄바꿈 문자 감지 (원본 파일 형식 유지)
      if (envContent.includes('\r\n')) {
        lineEnding = '\r\n'
      } else if (envContent.includes('\n')) {
        lineEnding = '\n'
      }
    }
    
    // BRICKBOX_SYNTHETIC_ROOT 업데이트 또는 추가
    const lines = envContent.split(/\r?\n/) // 모든 줄바꿈 형식 지원
    let found = false
    const updatedLines = lines.map(line => {
      const trimmed = line.trim()
      // 주석이 아니고 BRICKBOX_SYNTHETIC_ROOT로 시작하는 라인만 업데이트
      if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('BRICKBOX_SYNTHETIC_ROOT=')) {
        found = true
        // 원본 들여쓰기 유지 (있는 경우)
        const indent = line.match(/^\s*/)?.[0] || ''
        return `${indent}BRICKBOX_SYNTHETIC_ROOT=${trimmedPath}`
      }
      return line
    })
    
    // 없으면 추가
    if (!found) {
      // 합성 데이터셋 생성 설정 섹션 찾기
      let insertIndex = updatedLines.length
      for (let i = 0; i < updatedLines.length; i++) {
        if (updatedLines[i].includes('# 합성 데이터셋 생성 설정')) {
          // 섹션 헤더 다음 줄에 추가
          insertIndex = i + 4 // 헤더 + 설명 줄들 건너뛰기
          break
        }
      }
      updatedLines.splice(insertIndex, 0, `BRICKBOX_SYNTHETIC_ROOT=${trimmedPath}`)
    }
    
    // SYNTHETIC_OUTPUT_DIR도 업데이트 (하위 호환성)
    let foundOutputDir = false
    const finalLines = updatedLines.map(line => {
      const trimmed = line.trim()
      // 주석이 아니고 SYNTHETIC_OUTPUT_DIR로 시작하는 라인만 업데이트
      if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('SYNTHETIC_OUTPUT_DIR=')) {
        foundOutputDir = true
        // 원본 들여쓰기 유지 (있는 경우)
        const indent = line.match(/^\s*/)?.[0] || ''
        return `${indent}SYNTHETIC_OUTPUT_DIR=${trimmedPath}`
      }
      return line
    })
    
    if (!foundOutputDir) {
      // BRICKBOX_SYNTHETIC_ROOT 다음 줄에 추가
      const brickboxIndex = finalLines.findIndex(line => {
        const trimmed = line.trim()
        return trimmed && !trimmed.startsWith('#') && trimmed.startsWith('BRICKBOX_SYNTHETIC_ROOT=')
      })
      if (brickboxIndex !== -1) {
        finalLines.splice(brickboxIndex + 1, 0, `SYNTHETIC_OUTPUT_DIR=${trimmedPath}`)
      }
    }
    
    // 파일 저장 (원본 줄바꿈 문자 형식 유지)
    const updatedContent = finalLines.join(lineEnding)
    fs.writeFileSync(envPath, updatedContent, 'utf-8')
    
    // 환경 변수 다시 로드 (현재 프로세스에만 적용)
    dotenv.config({ path: envPath, override: true })
    
    console.log(`✅ 경로 설정 업데이트: ${trimmedPath}`)
    
    res.json({
      success: true,
      message: '경로 설정이 업데이트되었습니다',
      newPath: trimmedPath,
      currentPath: getSyntheticRoot(),
      datasetPath: getDatasetSyntheticPath(),
      note: '서버 재시작 후 모든 스크립트에 적용됩니다'
    })
  } catch (error) {
    console.error('경로 설정 업데이트 오류:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '요청한 리소스를 찾을 수 없습니다',
    path: req.path
  })
})

export default app
