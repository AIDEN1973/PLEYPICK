import express from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Supabase 클라이언트 설정
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'
const supabase = createClient(supabaseUrl, supabaseKey)

// 검증 작업 상태 저장
const validationJobs = new Map()

// Supabase Storage 버킷 검증
const validateBucketSync = async (localFiles, bucketName = 'synthetic-images') => {
  const results = {
    totalFiles: localFiles.length,
    uploadedFiles: 0,
    missingFiles: 0,
    syncErrors: [],
    bucketStats: {
      totalObjects: 0,
      totalSize: 0
    },
    databaseStats: {
      totalRecords: 0,
      uploadedRecords: 0,
      missingRecords: 0
    }
  }
  
  try {
    // 버킷의 모든 객체 목록 가져오기
    const { data: bucketObjects, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
    
    if (listError) {
      results.syncErrors.push(`버킷 목록 조회 실패: ${listError.message}`)
      return results
    }
    
    results.bucketStats.totalObjects = bucketObjects.length
    
    // 데이터베이스 synthetic_dataset 테이블 검증
    try {
      const { data: dbRecords, error: dbError } = await supabase
        .from('synthetic_dataset')
        .select('part_id, image_url, annotation_url, status')
        .eq('status', 'uploaded')
      
      if (dbError) {
        results.syncErrors.push(`데이터베이스 조회 실패: ${dbError.message}`)
      } else {
        results.databaseStats.totalRecords = dbRecords.length
        results.databaseStats.uploadedRecords = dbRecords.filter(record => 
          record.image_url && record.annotation_url
        ).length
        results.databaseStats.missingRecords = dbRecords.length - results.databaseStats.uploadedRecords
      }
    } catch (error) {
      results.syncErrors.push(`데이터베이스 검증 오류: ${error.message}`)
    }
    
    // 각 로컬 파일에 대해 버킷 동기화 상태 확인
    for (const localFile of localFiles) {
      try {
        // 로컬 파일의 상대 경로를 버킷 경로로 변환
        const bucketPath = localFile.relativePath.replace(/\\/g, '/')
        
        // 버킷에서 해당 파일 존재 확인
        const { data: fileData, error: fileError } = await supabase.storage
          .from(bucketName)
          .download(bucketPath)
        
        if (fileError || !fileData) {
          results.missingFiles++
          results.syncErrors.push(`버킷에 업로드되지 않음: ${bucketPath}`)
        } else {
          results.uploadedFiles++
          
          // 파일 크기 비교
          const localStats = await fs.stat(localFile.fullPath)
          const bucketSize = fileData.size
          
          if (localStats.size !== bucketSize) {
            results.syncErrors.push(`파일 크기 불일치: ${bucketPath} (로컬: ${localStats.size}bytes, 버킷: ${bucketSize}bytes)`)
          }
        }
      } catch (error) {
        results.syncErrors.push(`파일 검증 오류: ${localFile.relativePath} - ${error.message}`)
      }
    }
    
    return results
  } catch (error) {
    results.syncErrors.push(`버킷 동기화 검증 오류: ${error.message}`)
    return results
  }
}

// 로컬 파일 목록 수집
const collectLocalFiles = async (sourcePath) => {
  const files = []
  
  try {
    const items = await fs.readdir(sourcePath)
    
    for (const item of items) {
      const itemPath = path.join(sourcePath, item)
      const stats = await fs.stat(itemPath)
      
      if (stats.isDirectory()) {
        // 부품 폴더 내부 파일들 수집
        const partItems = await fs.readdir(itemPath)
        
        for (const partItem of partItems) {
          const partItemPath = path.join(itemPath, partItem)
          const partItemStats = await fs.stat(partItemPath)
          
          if (partItemStats.isFile()) {
            files.push({
              fileName: partItem,
              fullPath: partItemPath,
              relativePath: path.relative(sourcePath, partItemPath),
              size: partItemStats.size,
              partId: item
            })
          }
        }
      }
    }
    
    return files
  } catch (error) {
    console.error('로컬 파일 수집 오류:', error)
    return []
  }
}

// 파일 무결성 검증
const validateFileIntegrity = async (filePath) => {
  try {
    const stats = await fs.stat(filePath)
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

// 이미지 파일 검증
const validateImageFile = async (filePath) => {
  const integrity = await validateFileIntegrity(filePath)
  if (!integrity.isValid) {
    return { valid: false, error: '파일이 손상되었거나 비어있습니다' }
  }
  
  // 이미지 파일 확장자 검증
  const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
  const ext = path.extname(filePath).toLowerCase()
  
  if (!validExtensions.includes(ext)) {
    return { valid: false, error: `지원하지 않는 이미지 형식: ${ext}` }
  }
  
  return { valid: true, size: integrity.size }
}

// YOLO 라벨 파일 검증
const validateLabelFile = async (filePath) => {
  const integrity = await validateFileIntegrity(filePath)
  if (!integrity.isValid) {
    return { valid: false, error: '라벨 파일이 손상되었거나 비어있습니다' }
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const lines = content.trim().split('\n')
    
    // YOLO 형식 검증
    for (const line of lines) {
      if (line.trim()) {
        const parts = line.trim().split(' ')
        if (parts.length !== 5) {
          return { valid: false, error: `잘못된 YOLO 형식: ${line}` }
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
        
        if (classIdNum < 0 || xNum < 0 || xNum > 1 || yNum < 0 || yNum > 1 || wNum < 0 || wNum > 1 || hNum < 0 || hNum > 1) {
          return { valid: false, error: `좌표 범위 오류: ${line}` }
        }
      }
    }
    
    return { valid: true, lineCount: lines.length }
  } catch (error) {
    return { valid: false, error: `라벨 파일 읽기 오류: ${error.message}` }
  }
}

// JSON 메타데이터 파일 검증
const validateMetadataFile = async (filePath) => {
  const integrity = await validateFileIntegrity(filePath)
  if (!integrity.isValid) {
    return { valid: false, error: '메타데이터 파일이 손상되었거나 비어있습니다' }
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const metadata = JSON.parse(content)
    
    // 필수 필드 검증
    const requiredFields = ['part_id', 'part_name', 'element_id']
    for (const field of requiredFields) {
      if (!metadata[field]) {
        return { valid: false, error: `필수 필드 누락: ${field}` }
      }
    }
    
    return { valid: true, fields: Object.keys(metadata) }
  } catch (error) {
    return { valid: false, error: `JSON 파싱 오류: ${error.message}` }
  }
}

// 폴더 구조 검증
const validateFolderStructure = async (sourcePath) => {
  const errors = []
  const warnings = []
  
  try {
    const items = await fs.readdir(sourcePath)
    
    // 부품 폴더들 검증
    for (const item of items) {
      const itemPath = path.join(sourcePath, item)
      const stats = await fs.stat(itemPath)
      
      if (stats.isDirectory()) {
        // 부품 폴더 내부 구조 검증
        const partItems = await fs.readdir(itemPath)
        const hasImages = partItems.some(file => /\.(jpg|jpeg|png|bmp|tiff)$/i.test(file))
        const hasLabels = partItems.some(file => file.endsWith('.txt'))
        const hasMetadata = partItems.some(file => file.endsWith('.json'))
        
        if (!hasImages) {
          errors.push(`부품 ${item}: 이미지 파일이 없습니다`)
        }
        if (!hasLabels) {
          warnings.push(`부품 ${item}: 라벨 파일이 없습니다`)
        }
        if (!hasMetadata) {
          warnings.push(`부품 ${item}: 메타데이터 파일이 없습니다`)
        }
      }
    }
    
    return { errors, warnings }
  } catch (error) {
    errors.push(`폴더 읽기 오류: ${error.message}`)
    return { errors, warnings }
  }
}

// 메인 검증 함수
const performValidation = async (sourcePath, options) => {
  const results = {
    totalParts: 0,
    validParts: 0,
    invalidParts: 0,
    totalImages: 0,
    totalLabels: 0,
    totalMetadata: 0,
    errors: [],
    warnings: [],
    fileIntegrity: {
      valid: 0,
      invalid: 0,
      errors: []
    },
    bucketSync: {
      totalFiles: 0,
      uploadedFiles: 0,
      missingFiles: 0,
      syncErrors: [],
      bucketStats: {
        totalObjects: 0,
        totalSize: 0
      }
    }
  }
  
  try {
    // 폴더 구조 검증
    const structureValidation = await validateFolderStructure(sourcePath)
    results.errors.push(...structureValidation.errors)
    results.warnings.push(...structureValidation.warnings)
    
    // 부품별 상세 검증
    const items = await fs.readdir(sourcePath)
    
    for (const item of items) {
      const itemPath = path.join(sourcePath, item)
      const stats = await fs.stat(itemPath)
      
      if (stats.isDirectory()) {
        results.totalParts++
        
        const partItems = await fs.readdir(itemPath)
        let partValid = true
        let partErrors = []
        
        // 이미지 파일 검증
        const imageFiles = partItems.filter(file => /\.(jpg|jpeg|png|bmp|tiff)$/i.test(file))
        results.totalImages += imageFiles.length
        
        for (const imageFile of imageFiles) {
          const imagePath = path.join(itemPath, imageFile)
          const imageValidation = await validateImageFile(imagePath)
          
          if (!imageValidation.valid) {
            partValid = false
            partErrors.push(`이미지 ${imageFile}: ${imageValidation.error}`)
            results.fileIntegrity.invalid++
          } else {
            results.fileIntegrity.valid++
          }
        }
        
        // 라벨 파일 검증
        const labelFiles = partItems.filter(file => file.endsWith('.txt'))
        results.totalLabels += labelFiles.length
        
        for (const labelFile of labelFiles) {
          const labelPath = path.join(itemPath, labelFile)
          const labelValidation = await validateLabelFile(labelPath)
          
          if (!labelValidation.valid) {
            partValid = false
            partErrors.push(`라벨 ${labelFile}: ${labelValidation.error}`)
          }
        }
        
        // 메타데이터 파일 검증
        const metadataFiles = partItems.filter(file => file.endsWith('.json'))
        results.totalMetadata += metadataFiles.length
        
        for (const metadataFile of metadataFiles) {
          const metadataPath = path.join(itemPath, metadataFile)
          const metadataValidation = await validateMetadataFile(metadataPath)
          
          if (!metadataValidation.valid) {
            partValid = false
            partErrors.push(`메타데이터 ${metadataFile}: ${metadataValidation.error}`)
          }
        }
        
        if (partValid) {
          results.validParts++
        } else {
          results.invalidParts++
          results.errors.push(`부품 ${item}: ${partErrors.join(', ')}`)
        }
      }
    }
    
    // 버킷 동기화 검증 (옵션이 활성화된 경우)
    if (options.validateBucketSync) {
      try {
        console.log('버킷 동기화 검증 시작...')
        
        // 로컬 파일 목록 수집
        const localFiles = await collectLocalFiles(sourcePath)
        results.bucketSync.totalFiles = localFiles.length
        
        if (localFiles.length > 0) {
          // 버킷 동기화 상태 검증
          const bucketSyncResults = await validateBucketSync(localFiles, options.bucketName || 'synthetic-images')
          
          results.bucketSync.uploadedFiles = bucketSyncResults.uploadedFiles
          results.bucketSync.missingFiles = bucketSyncResults.missingFiles
          results.bucketSync.syncErrors = bucketSyncResults.syncErrors
          results.bucketSync.bucketStats = bucketSyncResults.bucketStats
          
          // 동기화 오류를 메인 오류 목록에 추가
          if (bucketSyncResults.syncErrors.length > 0) {
            results.errors.push(...bucketSyncResults.syncErrors.map(error => `버킷 동기화: ${error}`))
          }
          
          // 동기화 경고 추가
          if (bucketSyncResults.missingFiles > 0) {
            results.warnings.push(`${bucketSyncResults.missingFiles}개 파일이 버킷에 업로드되지 않았습니다`)
          }
        }
        
        console.log('버킷 동기화 검증 완료')
      } catch (error) {
        console.error('버킷 동기화 검증 오류:', error)
        results.errors.push(`버킷 동기화 검증 실패: ${error.message}`)
      }
    }
    
    return results
  } catch (error) {
    results.errors.push(`검증 중 오류 발생: ${error.message}`)
    return results
  }
}

// 검증 API 엔드포인트
router.post('/', async (req, res) => {
  try {
    const { 
      sourcePath, 
      validateImages, 
      validateLabels, 
      validateMetadata, 
      checkFileIntegrity,
      validateBucketSync,
      bucketName
    } = req.body
    
    if (!sourcePath) {
      return res.status(400).json({ error: 'sourcePath가 필요합니다' })
    }
    
    // 검증 작업 ID 생성
    const jobId = `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 비동기 검증 시작
    const validationPromise = performValidation(sourcePath, {
      validateImages,
      validateLabels,
      validateMetadata,
      checkFileIntegrity,
      validateBucketSync: validateBucketSync || false,
      bucketName: bucketName || 'synthetic-images'
    })
    
    // 작업 상태 저장
    validationJobs.set(jobId, {
      status: 'processing',
      progress: 0,
      startTime: Date.now(),
      promise: validationPromise
    })
    
    // 검증 완료 처리
    validationPromise.then(results => {
      validationJobs.set(jobId, {
        status: 'completed',
        progress: 100,
        results,
        endTime: Date.now()
      })
    }).catch(error => {
      validationJobs.set(jobId, {
        status: 'failed',
        progress: 0,
        error: error.message,
        endTime: Date.now()
      })
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
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = validationJobs.get(jobId)
    
    if (!job) {
      return res.status(404).json({ error: '검증 작업을 찾을 수 없습니다' })
    }
    
    if (job.status === 'completed') {
      res.json({
        status: 'completed',
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
          bucketSync: job.results.bucketSync
        }
      })
    } else if (job.status === 'failed') {
      res.json({
        status: 'failed',
        progress: 0,
        error: job.error
      })
    } else {
      // 진행률 계산 (간단한 시뮬레이션)
      const elapsed = Date.now() - job.startTime
      const progress = Math.min(90, Math.floor(elapsed / 1000) * 10)
      
      res.json({
        status: 'processing',
        progress,
        currentStep: '파일 검증 중...'
      })
    }
    
  } catch (error) {
    console.error('검증 상태 확인 오류:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
