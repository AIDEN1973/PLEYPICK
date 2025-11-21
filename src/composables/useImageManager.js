import { ref } from 'vue'
import { supabase } from './useSupabase'
import axios from 'axios'

// UPLOAD_SERVER와 UPLOAD_PROXY 제거 - 로컬 프록시 사용
const USE_SUPABASE_STORAGE = true // Supabase Storage 사용 여부

// ✅ WebP 품질 설정 통일 (기술문서 권장: q=90)
const WEBP_QUALITY = 0.90
const WEBP_MAX_SIZE = 800 // 최대 이미지 크기 (px)

// ✅ 중복 체크 캐시 (LRU 캐시)
class ImageDuplicateCache {
  constructor(maxSize = 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
  }
  
  get(key) {
    if (!this.cache.has(key)) return undefined
    
    // LRU: 접근한 항목을 맨 뒤로 이동
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    
    return value
  }
  
  set(key, value) {
    // 이미 존재하면 삭제 후 재추가 (맨 뒤로 이동)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    
    // 캐시 크기 제한 (LRU: 가장 오래된 항목 제거)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(key, value)
  }
  
  has(key) {
    return this.cache.has(key)
  }
  
  clear() {
    this.cache.clear()
  }
  
  get size() {
    return this.cache.size
  }
}

const imageDuplicateCache = new ImageDuplicateCache()

export function useImageManager() {
  const uploading = ref(false)
  const downloading = ref(false)
  const error = ref(null)

  // 이미지 다운로드 함수 (Axios + 재시도 로직, 강화)
  const downloadImage = async (imageUrl, filename, maxRetries = 3) => {
    downloading.value = true
    error.value = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 이미지 다운로드 시도 ${attempt}/${maxRetries}: ${imageUrl}`)
        
        // URL 검증: 프록시로 전달되기 전 원본 URL 확인
        const proxyUrl = `/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`
        console.log(`[ImageManager] 프록시 URL: ${proxyUrl}`)
        console.log(`[ImageManager] 원본 URL 검증: ${imageUrl}`)
        
        // Axios를 사용한 안정적인 다운로드
        // 프로덕션 모드에서 네트워크 지연을 고려하여 타임아웃 증가
        const response = await axios.get(proxyUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,              // 15초 제한 (프로덕션 모드 대응)
          validateStatus: status => status < 500  // 5xx 에러만 재시도
        })
        
        if (!response.data || response.data.length === 0) {
          throw new Error('Image download failed - empty response')
        }

        // ArrayBuffer를 Blob으로 변환
        const blob = new Blob([response.data])
        console.log(`✅ 이미지 다운로드 성공: ${blob.size} bytes (원본 URL: ${imageUrl})`)
        return blob
        
      } catch (err) {
        console.warn(`⚠️ 다운로드 시도 ${attempt} 실패: ${err.message}`)
        
        if (attempt === maxRetries) {
          error.value = `이미지 다운로드 실패 (${maxRetries}회 시도): ${err.message}`
          throw err
        }
        
        // 재시도 전 잠시 대기 (1초, 2초, 3초)
        const waitTime = attempt * 1000
        console.log(`⏳ ${waitTime}ms 후 재시도...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  // Supabase Storage 버킷 존재 여부 확인 (개선된 버전)
  const checkBucketExists = async () => {
    try {
      // 현재 사용자 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Session error:', sessionError)
        return true // 세션 오류 시에도 업로드 시도
      }
      
      if (!session) {
        console.warn('No active session. User needs to be authenticated.')
        return true // 인증 없이도 업로드 시도
      }
      
      console.log('Current user:', session.user?.email)
      
      // 버킷 존재 여부를 실제 업로드로 확인 (간소화)
      console.log('Assuming bucket exists and attempting upload...')
      return true // 항상 true 반환하여 업로드 시도
    } catch (err) {
      console.warn('Error checking bucket, but bucket might still exist:', err.message)
      return true // 오류 시에도 업로드 시도
    }
  }

  // 이미지 해시 생성 함수 (중복 검사용)
  const generateImageHash = async (blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return hashHex
    } catch (err) {
      console.warn('Failed to generate image hash:', err.message)
      return null
    }
  }

  // 이미지 중복 검사 함수
  const checkImageDuplicate = async (imageHash, partNum, colorId) => {
    try {
      const { data, error } = await supabase
        .from('image_metadata')
        .select('supabase_url, file_path, file_name')
        .eq('part_num', partNum)
        .eq('color_id', colorId)
        .not('supabase_url', 'is', null)

      if (error) {
        console.warn('Duplicate check failed:', error.message)
        return null
      }

      // 동일한 부품+색상 조합이 이미 존재하는지 확인
      if (data && data.length > 0) {
        console.log(`Duplicate found for part ${partNum} color ${colorId}:`, data[0])
        return data[0] // 기존 이미지 정보 반환
      }

      return null // 중복 없음
    } catch (err) {
      console.warn('Error checking image duplicate:', err.message)
      return null
    }
  }

  // element_id + color_id 기반 이미지 중복 검사 함수 - 색상 정보 포함 검증
  const checkPartImageDuplicateByElementIdAndColor = async (elementId, colorId) => {
    try {
      const cacheKey = `element_${String(elementId)}_color_${colorId}`
      
      // ✅ 캐시 확인
      const cached = imageDuplicateCache.get(cacheKey)
      if (cached !== undefined) {
        console.log(`✅ Cache hit for ${cacheKey}: ${cached}`)
        return cached === true ? { exists: true, url: null } : cached
      }
      
      console.log(`Checking for existing image: element_id=${elementId}, color_id=${colorId}`)
      
      // 1. DB에서 element_id + color_id로 확인 (색상 정보 포함)
      const { data: partImage, error: dbError } = await supabase
        .from('part_images')
        .select('uploaded_url, filename, color_id')
        .eq('element_id', String(elementId))
        .eq('color_id', colorId)
        .maybeSingle()
      
      if (!dbError && partImage?.uploaded_url) {
        // 색상 정보가 일치하는 경우에만 중복으로 인정
        if (partImage.color_id === colorId) {
          console.log(`Existing image found in DB for element_id ${elementId} (color: ${colorId}): ${partImage.uploaded_url}`)
          const result = { exists: true, url: partImage.uploaded_url }
          imageDuplicateCache.set(cacheKey, result) // ✅ 캐시 저장
          return result
        } else {
          console.warn(`⚠️ 색상 불일치: element_id ${elementId}의 기존 이미지 색상(${partImage.color_id})과 요청 색상(${colorId})이 다릅니다. 재다운로드 필요.`)
        }
      }
      
      // 2. element_id만으로 확인 (하위 호환성, 색상 정보 없이 저장된 경우)
      const { data: partImageByElement, error: elementError } = await supabase
        .from('part_images')
        .select('uploaded_url, filename, color_id')
        .eq('element_id', String(elementId))
        .maybeSingle()
      
      if (!elementError && partImageByElement?.uploaded_url) {
        // 색상 정보가 일치하는 경우에만 중복으로 인정
        if (partImageByElement.color_id === colorId) {
          console.log(`Existing image found in DB for element_id ${elementId} (color: ${colorId}): ${partImageByElement.uploaded_url}`)
          const result = { exists: true, url: partImageByElement.uploaded_url }
          imageDuplicateCache.set(cacheKey, result) // ✅ 캐시 저장
          return result
        } else {
          console.warn(`⚠️ 색상 불일치 감지: element_id ${elementId}의 기존 이미지 색상(${partImageByElement.color_id})과 요청 색상(${colorId})이 다릅니다.`)
          console.warn(`⚠️ 재다운로드 필요: 기존 이미지를 덮어쓰기 위해 false 반환`)
          // 색상 불일치 시 재다운로드 강제
          imageDuplicateCache.set(cacheKey, false)
          return false
        }
      }
      
      // 3. Storage 버킷에서 직접 확인 (폴백, 색상 검증 불가)
      const fileName = `${String(elementId)}.webp`
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
      const bucketName = 'lego_parts_images'
      const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
      
      // HTTP HEAD 요청으로 이미지 존재 여부 확인
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' })
        if (response.ok) {
          // Storage에 파일이 있어도 색상 정보를 확인할 수 없으므로, DB에서 색상 불일치가 확인된 경우 재다운로드
          console.log(`⚠️ Storage에 이미지가 있지만 색상 검증이 필요합니다. element_id ${elementId} (요청 색상: ${colorId})`)
          // DB에서 색상 불일치가 확인된 경우 재다운로드 강제
          if (partImageByElement && partImageByElement.color_id !== colorId) {
            console.warn(`⚠️ 색상 불일치로 인한 재다운로드 강제: element_id ${elementId}`)
            imageDuplicateCache.set(cacheKey, false)
            return false
          }
          // 색상 불일치 가능성이 있으므로 false 반환하여 재다운로드 유도
          imageDuplicateCache.set(cacheKey, false)
          return false
        }
      } catch (fetchErr) {
        // 400, 404 등은 이미지가 없는 것으로 간주 (정상 동작)
      }
      
      imageDuplicateCache.set(cacheKey, false) // ✅ 캐시 저장
      return false
    } catch (err) {
      console.warn('Error checking image duplicate by element_id and color:', err.message)
      return false
    }
  }

  // element_id 기반 이미지 중복 검사 함수 - ✅ 캐싱 적용, 기존 URL 반환 (하위 호환성)
  const checkPartImageDuplicateByElementId = async (elementId) => {
    try {
      const cacheKey = `element_${String(elementId)}`
      
      // ✅ 캐시 확인
      const cached = imageDuplicateCache.get(cacheKey)
      if (cached !== undefined) {
        console.log(`✅ Cache hit for ${cacheKey}: ${cached}`)
        return cached === true ? { exists: true, url: null } : cached
      }
      
      console.log(`Checking for existing image: element_id=${elementId}`)
      
      // 1. DB에서 먼저 확인 (더 정확함)
      const { data: partImage, error: dbError } = await supabase
        .from('part_images')
        .select('uploaded_url, filename')
        .eq('element_id', String(elementId))
        .maybeSingle()
      
      if (!dbError && partImage?.uploaded_url) {
        console.log(`Existing image found in DB for element_id ${elementId}: ${partImage.uploaded_url}`)
        const result = { exists: true, url: partImage.uploaded_url }
        imageDuplicateCache.set(cacheKey, result) // ✅ 캐시 저장
        return result
      }
      
      // 2. Storage 버킷에서 직접 확인 (폴백)
      // 주의: Supabase Storage는 파일이 없을 때 400을 반환하므로 이를 정상 응답으로 처리
      const fileName = `${String(elementId)}.webp`
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
      const bucketName = 'lego_parts_images'
      const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
      
      // HTTP HEAD 요청으로 이미지 존재 여부 확인
      try {
        const response = await fetch(imageUrl, { 
          method: 'HEAD',
          // 400 오류를 조용히 처리하기 위해 에러를 던지지 않음
        })
        
        // 200-299 범위의 응답만 성공으로 간주
        if (response.ok && response.status >= 200 && response.status < 300) {
          console.log(`Existing image found in Storage for element_id ${elementId}: ${imageUrl}`)
          const result = { exists: true, url: imageUrl }
          imageDuplicateCache.set(cacheKey, result) // ✅ 캐시 저장
          return result
        }
        // 400, 404 등은 이미지가 없는 것으로 간주 (정상 동작, 로그 출력 안 함)
      } catch (fetchErr) {
        // 네트워크 오류만 경고 로그 출력 (400, 404는 정상적인 "파일 없음" 응답)
        const errorMsg = fetchErr.message || String(fetchErr)
        if (!errorMsg.includes('400') && !errorMsg.includes('404') && !errorMsg.includes('Bad Request')) {
          console.warn('Storage check failed:', fetchErr.message)
        }
      }
      
      imageDuplicateCache.set(cacheKey, false) // ✅ 캐시 저장
      return false
    } catch (err) {
      console.warn('Error checking image duplicate by element_id:', err.message)
      return false
    }
  }

  // 부품별 이미지 중복 검사 함수 (부품번호 + 색상ID로 검사) - ✅ 캐싱 적용
  const checkPartImageDuplicate = async (partNum, colorId) => {
    try {
      const cacheKey = `${partNum}_${colorId}`
      
      // ✅ 캐시 확인
      const cached = imageDuplicateCache.get(cacheKey)
      if (cached !== undefined) {
        console.log(`✅ Cache hit for ${cacheKey}: ${cached}`)
        return cached
      }
      
      console.log(`Checking for existing image: part_num=${partNum}, color_id=${colorId}`)
      
      // 1. DB에서 먼저 확인 (더 정확함)
      const { data: partImage, error: dbError } = await supabase
        .from('part_images')
        .select('uploaded_url, filename')
        .eq('part_id', partNum)
        .eq('color_id', colorId)
        .maybeSingle()
      
      if (!dbError && partImage?.uploaded_url) {
        console.log(`Existing image found in DB for ${partNum} (color: ${colorId}): ${partImage.uploaded_url}`)
        imageDuplicateCache.set(cacheKey, true) // ✅ 캐시 저장
        return true
      }
      
      // 2. Storage 버킷에서 직접 확인 (폴백)
      // 주의: Supabase Storage는 파일이 없을 때 400을 반환하므로 이를 정상 응답으로 처리
      const fileName = `${partNum}_${colorId}.webp`
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
      const bucketName = 'lego_parts_images'
      const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
      
      // HTTP HEAD 요청으로 이미지 존재 여부 확인
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' })
        // 200-299 범위의 응답만 성공으로 간주
        if (response.ok && response.status >= 200 && response.status < 300) {
          console.log(`Existing image found in Storage for ${partNum} (color: ${colorId}): ${imageUrl}`)
          imageDuplicateCache.set(cacheKey, true) // ✅ 캐시 저장
          return true
        }
        // 400, 404 등은 이미지가 없는 것으로 간주 (정상 동작, 로그 출력 안 함)
      } catch (fetchError) {
        // 400, 404는 정상적인 "파일 없음" 응답이므로 조용히 처리
        const errorMsg = fetchError.message || String(fetchError)
        if (!errorMsg.includes('400') && !errorMsg.includes('404') && !errorMsg.includes('Bad Request')) {
          console.log(`Image not found in Storage: ${fileName}`)
        }
      }
      
      imageDuplicateCache.set(cacheKey, false) // ✅ 캐시 저장 (없음)
      return false // 중복 없음
    } catch (err) {
      console.warn('Image existence check failed:', err)
      return false
    }
  }

  // 이미지 업로드 함수 (Supabase Storage 또는 외부 서버)
  const uploadImage = async (file, path = '') => {
    uploading.value = true
    error.value = null

    try {
      if (USE_SUPABASE_STORAGE) {
        // 버킷 존재 여부 확인 (인증 없이도 시도)
        try {
          const bucketExists = await checkBucketExists()
          if (!bucketExists) {
            console.warn('Bucket check failed, but attempting upload anyway...')
          }
        } catch (err) {
          console.warn('Bucket check failed, but attempting upload anyway:', err.message)
        }

        // 파일명을 partNum_colorId.jpg 형식으로 통일
        const fileName = file.name
        const filePath = `images/${fileName}`
        
        // 기존 파일 삭제 후 업로드 (중복 방지)
        try {
          await supabase.storage
            .from('lego_parts_images')
            .remove([filePath])
        } catch (deleteError) {
          // 파일이 없어도 무시
          console.log('No existing file to delete:', filePath)
        }
        
        // Storage 업로드
        const { data, error: uploadError } = await supabase.storage
          .from('lego_parts_images')
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`Supabase upload failed: ${uploadError.message}`)
        }

        // 공개 URL 생성
        const { data: urlData } = supabase.storage
          .from('lego_parts_images')
          .getPublicUrl(filePath)

        // ✅ 최적화: 업로드 검증을 개발 모드에서만 실행 (프로덕션 성능 개선)
        const publicUrl = urlData.publicUrl
        
        if (import.meta.env.DEV) {
          // 개발 모드에서만 검증 (빠른 확인, 1회만)
          try {
            const verifyResponse = await fetch(publicUrl, { 
              method: 'HEAD',
              signal: AbortSignal.timeout(1000) // 1초 타임아웃
            })
            if (verifyResponse.ok) {
              console.log(`✅ Upload verified: ${filePath}`)
            } else {
              console.warn(`⚠️ Upload verification failed (${verifyResponse.status}), but proceeding: ${filePath}`)
            }
          } catch (verifyError) {
            console.warn(`⚠️ Upload verification skipped (timeout): ${filePath}`)
          }
        }

        return {
          url: publicUrl,
          path: filePath,
          bucket: 'lego_parts_images'
        }
      } else {
        // 외부 서버 사용 (기존 방식)
        const formData = new FormData()
        formData.append('image', file)
        if (path) {
          formData.append('path', path)
        }

        // 프록시를 통해 업로드
        const response = await fetch(`${UPLOAD_PROXY}/upload`, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`)
        }

        const result = await response.json()
        return result
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      uploading.value = false
    }
  }

  // URL에서 원본 파일명 추출 함수
  const extractOriginalFilename = (imageUrl) => {
    try {
      // URL에서 파일명 추출
      const urlParts = imageUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      
      // 파일명이 없거나 확장자가 없으면 기본값 사용
      if (!filename || !filename.includes('.')) {
        const extension = imageUrl.split('.').pop() || 'jpg'
        return `image_${Date.now()}.${extension}`
      }
      
      return filename
    } catch (err) {
      console.warn('Failed to extract filename from URL:', err.message)
      return `image_${Date.now()}.webp`
    }
  }

  // Rebrickable 이미지를 다운로드하고 업로드하는 통합 함수 (파일명 기반 중복 검사)
  const processRebrickableImage = async (imageUrl, partNum, colorId = null, options = {}) => {
    // elementId 검증 및 정규화
    let elementId = options?.elementId || null
    if (elementId !== null && elementId !== undefined) {
      const elementIdStr = String(elementId).trim()
      if (elementIdStr === '' || elementIdStr === 'null' || elementIdStr === 'undefined' || elementIdStr === '0') {
        elementId = null
      } else {
        elementId = elementIdStr
      }
    } else {
      elementId = null
    }
    
    console.log(`[ImageManager] processRebrickableImage 호출: part_num=${partNum}, color_id=${colorId}, element_id=${elementId || '없음'}`)
    
    try {
      // 원본 URL에서 파일명 추출
      const originalFilename = extractOriginalFilename(imageUrl)
      console.log(`Original filename from URL: ${originalFilename}`)
      
      // 업로드 경로 설정 (일관된 경로)
      const uploadPath = `images`
      
      // 1. 부품별 이미지 중복 검사 수행 (강제 업로드 옵션)
      const forceUpload = options?.forceUpload || false
      if (!forceUpload) {
        // element_id가 있으면 element_id + color_id로 중복 검사 (색상 정보 포함)
        if (elementId && colorId !== null && colorId !== undefined) {
          const duplicateCheck = await checkPartImageDuplicateByElementIdAndColor(elementId, colorId)
          if (duplicateCheck && (duplicateCheck === true || (duplicateCheck.exists && duplicateCheck.url))) {
            const existingUrl = (duplicateCheck && typeof duplicateCheck === 'object' && duplicateCheck.url) 
              ? duplicateCheck.url 
              : `${import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'}/storage/v1/object/public/lego_parts_images/images/${String(elementId)}.webp`
            console.log(`Skipping duplicate image for element_id ${elementId} (color: ${colorId}), using existing URL: ${existingUrl}`)
            const duplicateFilename = `${String(elementId)}.webp`
            return {
              originalUrl: imageUrl,
              uploadedUrl: existingUrl,
              filename: duplicateFilename,
              path: uploadPath,
              isDuplicate: true
            }
          }
        } else if (elementId) {
          // colorId가 없는 경우 기존 로직 사용 (하위 호환성)
          const duplicateCheck = await checkPartImageDuplicateByElementId(elementId)
          if (duplicateCheck && (duplicateCheck === true || (duplicateCheck.exists && duplicateCheck.url))) {
            const existingUrl = (duplicateCheck && typeof duplicateCheck === 'object' && duplicateCheck.url) 
              ? duplicateCheck.url 
              : `${import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'}/storage/v1/object/public/lego_parts_images/images/${String(elementId)}.webp`
            console.log(`Skipping duplicate image for element_id ${elementId}, using existing URL: ${existingUrl}`)
            const duplicateFilename = `${String(elementId)}.webp`
            return {
              originalUrl: imageUrl,
              uploadedUrl: existingUrl,
              filename: duplicateFilename,
              path: uploadPath,
              isDuplicate: true
            }
          }
        } else {
          const isDuplicate = await checkPartImageDuplicate(partNum, colorId)
          if (isDuplicate) {
            console.log(`Skipping duplicate image for part ${partNum} (color: ${colorId})`)
            const duplicateFilename = `${partNum}_${colorId || 'unknown'}.webp`
            return {
              originalUrl: imageUrl,
              uploadedUrl: null, // 중복으로 업로드하지 않음
              filename: duplicateFilename,
              path: uploadPath,
              isDuplicate: true
            }
          }
        }
      } else {
        console.log(`Force uploading image for ${elementId ? `element_id ${elementId}` : `part ${partNum} (color: ${colorId})`} - overwriting existing`)
      }
      
      try {
        // 이미지 다운로드 시도
        console.log(`[ImageManager] 다운로드할 이미지 URL 검증: ${imageUrl}`)
        console.log(`[ImageManager] element_id: ${elementId}, 예상 색상 ID: ${colorId}`)
        
        // URL에서 element_id 추출하여 검증 (경고만, 계속 진행)
        if (elementId && imageUrl.includes('/elements/')) {
          const urlElementIdMatch = imageUrl.match(/\/elements\/(\d+)\.jpg/)
          if (urlElementIdMatch) {
            const urlElementId = urlElementIdMatch[1]
            if (urlElementId !== String(elementId)) {
              console.warn(`⚠️ URL 불일치: 요청 element_id=${elementId}, URL의 element_id=${urlElementId}`)
              console.warn(`⚠️ Rebrickable API가 다른 element_id의 URL을 반환했습니다. API 응답을 신뢰하고 계속 진행합니다.`)
              console.warn(`⚠️ URL: ${imageUrl}`)
              // API가 반환한 URL을 신뢰하고 계속 진행 (요청한 element_id는 그대로 사용)
            } else {
              console.log(`✅ URL 검증 성공: element_id 일치 (${elementId})`)
            }
          }
        }
        
        const blob = await downloadImage(imageUrl)
        
        // WebP로 변환
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = URL.createObjectURL(blob)
        })
        
        // 이미지 크기 최적화 (최대 800px)
        let { width, height } = img
        if (width > WEBP_MAX_SIZE || height > WEBP_MAX_SIZE) {
          const ratio = Math.min(WEBP_MAX_SIZE / width, WEBP_MAX_SIZE / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        
        // WebP로 변환 (통일된 품질 설정)
        const webpBlob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
        })
        
        URL.revokeObjectURL(img.src)
        
        // 파일명 생성: element_id 우선, 없으면 partNum_colorId.webp
        // elementId는 이미 위에서 검증 및 정규화됨
        const fileName = elementId
          ? `${elementId}.webp`
          : `${partNum}_${colorId || 'unknown'}.webp`
        
        console.log(`[ImageManager] 파일명 결정: element_id=${elementId || '없음'} → 파일명=${fileName}`)
        
        const file = new File([webpBlob], fileName, { type: 'image/webp' })
        
        // Supabase Storage에 직접 업로드 (재시도 포함)
        const bucketName = 'lego_parts_images'
        const filePath = `images/${fileName}`
        
        const maxUploadRetries = 3
        let uploadSuccess = false
        let uploadData = null
        
        for (let attempt = 1; attempt <= maxUploadRetries; attempt++) {
          try {
            console.log(`📤 Supabase Storage 업로드 시도 ${attempt}/${maxUploadRetries}: ${filePath} (element_id: ${elementId || '없음'})`)
            const { data, error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(filePath, file, {
                upsert: true // 파일이 이미 존재하면 덮어쓰기
              })

            if (uploadError) {
              throw new Error(`Supabase upload failed: ${uploadError.message}`)
            }
            
            uploadData = data
            uploadSuccess = true
            console.log(`✅ Supabase 업로드 성공 (시도 ${attempt}/${maxUploadRetries}):`, data)
            break
          } catch (uploadErr) {
            console.warn(`⚠️ Supabase 업로드 실패 (시도 ${attempt}/${maxUploadRetries}): ${uploadErr.message}`)
            
            if (attempt < maxUploadRetries) {
              const waitTime = attempt * 1000
              console.log(`⏳ ${waitTime}ms 후 재시도...`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
              continue
            } else {
              console.error(`❌ 모든 Supabase 업로드 시도 실패:`, uploadErr)
              throw uploadErr
            }
          }
        }
        
        if (!uploadSuccess || !uploadData) {
          throw new Error('Supabase 업로드 실패')
        }
        
        // 공개 URL 생성
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath)
        
        const uploadedUrl = urlData.publicUrl
        console.log(`✅ 업로드된 이미지 URL: ${uploadedUrl}`)
        
        // part_images 동기화
        await upsertPartImage({ partNum, colorId, uploadedUrl, filename: fileName, elementId })
        
        return {
          originalUrl: imageUrl,
          uploadedUrl: uploadedUrl,
          filename: fileName,
          path: filePath
        }
      } catch (downloadErr) {
        console.warn('Direct download failed, using alternative method:', downloadErr.message)
        
        // 대체 방법: 서버 사이드 프록시를 통한 이미지 다운로드 및 WebP 변환 (재시도 포함)
        const maxProxyRetries = 3
        let lastProxyError = null
        
        for (let attempt = 1; attempt <= maxProxyRetries; attempt++) {
          try {
            const proxyUrl = `/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`
            console.log(`🔄 프록시를 통한 이미지 다운로드 시도 ${attempt}/${maxProxyRetries}: ${proxyUrl}`)
            
            const proxyResponse = await axios.get(proxyUrl, {
              responseType: 'arraybuffer',
              timeout: 15000, // 15초 제한 (프로덕션 모드 대응)
              validateStatus: status => status < 500,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            })
            
            if (!proxyResponse.data || proxyResponse.data.length === 0) {
              throw new Error('프록시 다운로드 실패 - 빈 응답')
            }
            
            const proxyBlob = new Blob([proxyResponse.data])
            // 파일명 생성: element_id 우선, 없으면 partNum_colorId.webp
            const fileName = elementId
              ? `${String(elementId)}.webp`
              : `${partNum}_${colorId || 'unknown'}.webp`
            const file = new File([proxyBlob], fileName, { type: 'image/webp' })
            
            // Supabase Storage에 직접 업로드 (재시도 포함)
            const bucketName = 'lego_parts_images'
            const filePath = `images/${fileName}`
            
            const maxUploadRetries = 3
            let uploadSuccess = false
            let uploadedUrl = null
            
            for (let uploadAttempt = 1; uploadAttempt <= maxUploadRetries; uploadAttempt++) {
              try {
                console.log(`📤 Supabase Storage 업로드 시도 ${uploadAttempt}/${maxUploadRetries} (프록시): ${filePath}`)
                const { data, error: uploadError } = await supabase.storage
                  .from(bucketName)
                  .upload(filePath, file, {
                    upsert: true
                  })

                if (uploadError) {
                  throw new Error(`Supabase upload failed: ${uploadError.message}`)
                }
                
                // 공개 URL 생성
                const { data: urlData } = supabase.storage
                  .from(bucketName)
                  .getPublicUrl(filePath)
                
                uploadedUrl = urlData.publicUrl
                uploadSuccess = true
                console.log(`✅ 프록시를 통한 업로드 성공 (시도 ${uploadAttempt}/${maxUploadRetries}): ${uploadedUrl}`)
                break
              } catch (uploadErr) {
                console.warn(`⚠️ Supabase 업로드 실패 (시도 ${uploadAttempt}/${maxUploadRetries}): ${uploadErr.message}`)
                if (uploadAttempt < maxUploadRetries) {
                  const waitTime = uploadAttempt * 1000
                  console.log(`⏳ ${waitTime}ms 후 재시도...`)
                  await new Promise(resolve => setTimeout(resolve, waitTime))
                } else {
                  throw uploadErr
                }
              }
            }
            
            if (!uploadSuccess || !uploadedUrl) {
              throw new Error('Supabase 업로드 실패')
            }
            
            // part_images 동기화
            await upsertPartImage({ partNum, colorId, uploadedUrl, filename: fileName, elementId })
            
            return {
              originalUrl: imageUrl,
              uploadedUrl: uploadedUrl,
              filename: fileName,
              path: filePath
            }
          } catch (proxyErr) {
            lastProxyError = proxyErr
            console.warn(`⚠️ 프록시 다운로드 실패 (시도 ${attempt}/${maxProxyRetries}): ${proxyErr.message}`)
            
            if (attempt < maxProxyRetries) {
              const waitTime = attempt * 1000
              console.log(`⏳ ${waitTime}ms 후 재시도...`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
              continue
            }
          }
        }
        
        // 모든 프록시 시도 실패 시 로컬 저장소 사용
        console.warn('프록시 업로드 완전 실패, 로컬 저장소 사용:', lastProxyError?.message)
        
        // 대체 방법: 로컬 저장소에 이미지 정보 저장
        const localResult = await saveImageLocally(imageUrl, originalFilename, uploadPath)
        
        return {
          originalUrl: imageUrl,
          uploadedUrl: localResult.url,
          filename: originalFilename,
          path: uploadPath,
          isLocal: true
        }
      }
    } catch (err) {
      error.value = err.message
      console.error(`[ImageManager] processRebrickableImage 완전 실패:`, {
        partNum,
        colorId,
        elementId,
        imageUrl,
        error: err.message,
        stack: err.stack
      })
      
      // 프로덕션 모드에서 실패 시 원본 URL 반환 (나중에 재시도 가능하도록)
      return {
        originalUrl: imageUrl,
        uploadedUrl: null,
        filename: elementId ? `${String(elementId)}.webp` : `${partNum}_${colorId || 'unknown'}.webp`,
        path: 'images',
        error: err.message,
        failed: true
      }
    }
  }

  // 서버를 통해 이미지 다운로드 및 업로드 (Supabase Storage 또는 외부 서버)
  const uploadImageFromUrl = async (imageUrl, filename, uploadPath) => {
    try {
      if (USE_SUPABASE_STORAGE) {
        // 버킷 존재 여부 확인 (인증 없이도 시도)
        try {
          const bucketExists = await checkBucketExists()
          if (!bucketExists) {
            console.warn('Bucket check failed, but attempting upload anyway...')
          }
        } catch (err) {
          console.warn('Bucket check failed, but attempting upload anyway:', err.message)
        }

        // Supabase Storage 사용: 먼저 이미지를 다운로드한 후 업로드 (재시도 포함)
        let response
        let downloadMethod = 'unknown'
        const maxDownloadRetries = 3
        let lastDownloadError = null
        
        for (let attempt = 1; attempt <= maxDownloadRetries; attempt++) {
          try {
            // 1. Vite 프록시를 통한 다운로드 (CORS 문제 해결)
            if (imageUrl.includes('cdn.rebrickable.com')) {
              try {
                const proxyUrl = imageUrl.replace('https://cdn.rebrickable.com', '/api/proxy')
                response = await fetch(proxyUrl, {
                  method: 'GET',
                  headers: {
                    'Accept': 'image/*',
                    'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
                  }
                })
                
                if (response.ok) {
                  downloadMethod = 'vite_proxy'
                  break
                } else if (response.status === 404) {
                  // 404는 즉시 실패 처리 (재시도 불필요)
                  throw new Error(`이미지 없음 (404): ${imageUrl}`)
                }
              } catch (proxyError) {
                if (proxyError.message.includes('404')) {
                  throw proxyError
                }
              }
            }
            
            // 2. API 프록시 서버를 통한 다운로드 (fallback)
            if (!response || !response.ok) {
              try {
                const proxyUrl = `/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`
                response = await fetch(proxyUrl, {
                  method: 'GET',
                  headers: {
                    'Accept': 'image/webp',
                    'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
                  }
                })
                
                if (response.ok) {
                  downloadMethod = 'api_proxy'
                  break
                } else if (response.status === 404) {
                  // 404는 즉시 실패 처리
                  throw new Error(`이미지 없음 (404): ${imageUrl}`)
                }
              } catch (proxyError) {
                if (proxyError.message.includes('404')) {
                  throw proxyError
                }
              }
            }
            
            // 3. 직접 다운로드 시도 (최종 fallback, CORS 문제로 실패 가능)
            if (!response || !response.ok) {
              try {
                response = await fetch(imageUrl, {
                  method: 'GET',
                  mode: 'cors',
                  headers: {
                    'Accept': 'image/*',
                    'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
                  }
                })
                if (response.ok) {
                  downloadMethod = 'direct'
                  break
                } else if (response.status === 404) {
                  throw new Error(`이미지 없음 (404): ${imageUrl}`)
                }
              } catch (directErr) {
                // CORS 에러는 재시도 불필요
                if (directErr.message.includes('CORS') || directErr.message.includes('404')) {
                  throw directErr
                }
              }
            }
          } catch (downloadErr) {
            lastDownloadError = downloadErr
            
            // 404 에러는 즉시 실패 (재시도 불필요)
            if (downloadErr.message.includes('404') || downloadErr.message.includes('이미지 없음')) {
              throw downloadErr
            }
            
            // 네트워크 오류만 재시도 (대기 시간 단축)
            if (attempt < maxDownloadRetries) {
              const waitTime = attempt * 100 // 100ms, 200ms, 300ms
              await new Promise(resolve => setTimeout(resolve, waitTime))
              continue
            } else {
              throw new Error(`이미지 다운로드 실패 (${maxDownloadRetries}회 시도): ${lastDownloadError.message}`)
            }
          }
        }
        
        if (!response || !response.ok) {
          throw new Error(`이미지 다운로드 실패: ${lastDownloadError?.message || '알 수 없는 오류'}`)
        }
        
        const blob = await response.blob()
        console.log(`📊 다운로드 완료: ${blob.size} bytes (방법: ${downloadMethod})`)
        
        // WebP로 강제 변환
        let webpBlob
        if (filename.endsWith('.webp')) {
          // Canvas를 사용하여 WebP로 변환
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const img = new Image()
          
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = URL.createObjectURL(blob)
          })
          
          // 이미지 크기 최적화 (최대 800px)
          let { width, height } = img
          if (width > WEBP_MAX_SIZE || height > WEBP_MAX_SIZE) {
            const ratio = Math.min(WEBP_MAX_SIZE / width, WEBP_MAX_SIZE / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }
          
          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)
          
          // WebP로 변환 (통일된 품질 설정)
          webpBlob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
          })
          
          URL.revokeObjectURL(img.src)
        } else {
          webpBlob = blob
        }
        
        const file = new File([webpBlob], filename, { type: 'image/webp' })
        
        // 원본 파일명 그대로 사용
        const fileName = filename
        
        // 모든 이미지를 lego_parts_images 버킷에 저장
        const bucketName = 'lego_parts_images'
        
        // 세트 이미지는 lego_sets_images 폴더에, 부품 이미지는 images 폴더에 저장
        const filePath = uploadPath === 'lego_sets_images' ? `lego_sets_images/${fileName}` : `images/${fileName}`
        
        // 중복 파일 처리: 덮어쓰기 옵션 사용 (재시도 포함)
        const maxUploadRetries = 3
        let uploadSuccess = false
        let uploadData = null
        
        for (let attempt = 1; attempt <= maxUploadRetries; attempt++) {
          try {
            console.log(`📤 Supabase Storage 업로드 시도 ${attempt}/${maxUploadRetries}: ${filePath} (bucket: ${bucketName})`)
            console.log(`📤 File size: ${file.size} bytes`)
            console.log(`📤 File type: ${file.type}`)
            console.log(`📤 Upload path: ${uploadPath}`)
            
            const { data, error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(filePath, file, {
                upsert: true // 파일이 이미 존재하면 덮어쓰기
              })

            if (uploadError) {
              throw new Error(`Supabase upload failed: ${uploadError.message}`)
            }
            
            uploadData = data
            uploadSuccess = true
            console.log(`✅ Supabase 업로드 성공 (시도 ${attempt}/${maxUploadRetries}):`, data)
            break
          } catch (uploadErr) {
            console.warn(`⚠️ Supabase 업로드 실패 (시도 ${attempt}/${maxUploadRetries}): ${uploadErr.message}`)
            console.warn(`⚠️ Upload details:`, {
              bucket: bucketName,
              filePath: filePath,
              fileSize: file.size,
              fileType: file.type,
              uploadPath: uploadPath
            })
            
            if (attempt < maxUploadRetries) {
              const waitTime = attempt * 1000
              console.log(`⏳ ${waitTime}ms 후 재시도...`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
              continue
            } else {
              console.error(`❌ 모든 Supabase 업로드 시도 실패:`, uploadErr)
              throw uploadErr
            }
          }
        }
        
        if (!uploadSuccess || !uploadData) {
          throw new Error('Supabase 업로드 실패')
        }

        // 공개 URL 생성
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath)

        // 업로드 검증: 실제 파일 존재 여부 확인 (GET Range + Content-Type)
        try {
          const verifyResp = await fetch(urlData.publicUrl, {
            method: 'GET',
            headers: { 'Range': 'bytes=0-0' }
          })
          const ct = verifyResp.headers.get('content-type') || ''
          if (!(verifyResp.ok || verifyResp.status === 206) || ct.includes('application/json')) {
            console.warn(`⚠️ 세트 이미지 업로드 검증 실패: status=${verifyResp.status}, type=${ct}, url=${urlData.publicUrl}`)
          } else {
            console.log(`✅ 세트 이미지 업로드 검증 성공: ${urlData.publicUrl}`)
          }
        } catch (e) {
          console.warn(`⚠️ 세트 이미지 업로드 검증 오류: ${e.message}`)
        }

        return {
          url: urlData.publicUrl,
          path: filePath,
          bucket: bucketName
        }
      } else {
        // 외부 서버 사용 (기존 방식)
        const response = await fetch(`${UPLOAD_PROXY}/upload-from-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: imageUrl,
            filename: filename,
            path: uploadPath
          })
        })

        if (!response.ok) {
          throw new Error(`Server upload failed: ${response.status}`)
        }

        const result = await response.json()
        return result
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 이미지 메타데이터를 Supabase에 저장
  const saveImageMetadata = async (imageData) => {
    try {
      console.log(`[ImageManager] saveImageMetadata 호출:`, {
        part_num: imageData.part_num,
        color_id: imageData.color_id,
        element_id: imageData.element_id || '없음',
        file_name: imageData.file_name
      })
      
      // element_id가 있으면 String으로 변환하여 일관성 유지
      // element_id 컬럼이 없을 수 있으므로 조건부로 추가
      const metadataPayload = {
        original_url: imageData.original_url,
        supabase_url: imageData.supabase_url,
        file_path: imageData.file_path,
        file_name: imageData.file_name,
        part_num: imageData.part_num,
        color_id: imageData.color_id,
        ...(imageData.set_num && { set_num: imageData.set_num })
      }
      
      // element_id가 있으면 추가 (컬럼이 존재하는 경우에만)
      if (imageData.element_id) {
        metadataPayload.element_id = String(imageData.element_id)
      }
      
      const { error } = await supabase
        .from('image_metadata')
        .insert([metadataPayload], { returning: 'minimal' })

      if (error) {
        // element_id 컬럼이 없는 경우 에러를 무시하고 계속 진행
        if (error.message && error.message.includes('element_id')) {
          console.warn(`[ImageManager] image_metadata 테이블에 element_id 컬럼이 없습니다. 마이그레이션을 실행해주세요: ${error.message}`)
          // element_id 없이 다시 시도
          delete metadataPayload.element_id
          const { error: retryError } = await supabase
            .from('image_metadata')
            .insert([metadataPayload], { returning: 'minimal' })
          
          if (retryError) {
            console.error(`[ImageManager] image_metadata 저장 실패 (재시도):`, retryError)
            throw new Error(`Failed to save image metadata: ${retryError.message}`)
          }
          console.log(`[ImageManager] ✅ image_metadata 저장 완료 (element_id 제외): ${imageData.file_name}`)
          return true
        }
        console.error(`[ImageManager] image_metadata 저장 실패:`, error)
        throw new Error(`Failed to save image metadata: ${error.message}`)
      }

      console.log(`[ImageManager] ✅ image_metadata 저장 완료: ${imageData.file_name}`)
      return true
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 업로드 직후 part_images 테이블에 동기화 (트리거 없이 앱 레벨에서 처리, 색상 불일치 처리 포함)
  const upsertPartImage = async ({ partNum, colorId, uploadedUrl, filename, elementId }) => {
    try {
      if (!partNum || typeof colorId !== 'number' || !uploadedUrl) return

      const payload = {
        part_id: String(partNum),
        color_id: colorId,
        original_url: uploadedUrl,
        uploaded_url: uploadedUrl,
        filename: filename || (elementId ? `${String(elementId)}.webp` : `${partNum}_${colorId}.webp`),
        upload_status: 'completed',
        ...(elementId && { element_id: String(elementId) }) // element_id가 있으면 추가
      }

      // 색상 불일치 확인: element_id가 있으면 기존 레코드의 color_id 확인
      if (elementId) {
        const { data: existingImage, error: checkError } = await supabase
          .from('part_images')
          .select('color_id')
          .eq('element_id', String(elementId))
          .maybeSingle()
        
        if (!checkError && existingImage && existingImage.color_id !== colorId) {
          console.warn(`⚠️ 색상 불일치 감지: element_id ${elementId}의 기존 색상(${existingImage.color_id})과 새 색상(${colorId})이 다릅니다.`)
          console.warn(`⚠️ 기존 레코드 삭제 후 새로 삽입합니다.`)
          
          // 색상 불일치 시 기존 레코드 삭제
          const { error: deleteError } = await supabase
            .from('part_images')
            .delete()
            .eq('element_id', String(elementId))
            .neq('color_id', colorId) // 다른 color_id만 삭제
          
          if (deleteError) {
            console.warn(`⚠️ 색상 불일치 레코드 삭제 실패: ${deleteError.message}`)
          } else {
            console.log(`✅ 색상 불일치 레코드 삭제 완료: element_id ${elementId}`)
          }
        }
      }

      // 1) element_id가 있으면 element_id + color_id로 조회/업데이트 시도 (정확한 매칭)
      let updated = null
      let updateError = null
      
      if (elementId) {
        const { data: updatedByElement, error: elementUpdateError } = await supabase
          .from('part_images')
          .update(payload)
          .eq('element_id', String(elementId))
          .eq('color_id', colorId) // color_id도 함께 확인
          .select('part_id')
        
        if (!elementUpdateError && updatedByElement && updatedByElement.length > 0) {
          updated = updatedByElement
          console.log(`part_images updated by element_id + color_id: ${elementId}_${colorId}`)
        } else if (elementUpdateError) {
          updateError = elementUpdateError
        }
      }
      
      // 2) element_id로 업데이트 실패했거나 element_id가 없으면 part_id + color_id로 조회/업데이트 시도
      if (!updated || updated.length === 0) {
        const { data: updatedByPartColor, error: partColorUpdateError } = await supabase
          .from('part_images')
          .update(payload)
          .eq('part_id', String(partNum))
          .eq('color_id', colorId)
          .select('part_id')
        
        if (!partColorUpdateError && updatedByPartColor && updatedByPartColor.length > 0) {
          updated = updatedByPartColor
          console.log(`part_images updated by part_id + color_id: ${partNum}_${colorId}`)
        } else if (partColorUpdateError) {
          updateError = partColorUpdateError
        }
      }

      if (updateError) {
        console.warn('part_images update failed, will try insert:', updateError.message)
      }

      // 3) 업데이트된 행이 없으면 삽입
      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase
          .from('part_images')
          .insert([payload])

        if (insertError) {
          console.warn('part_images insert failed:', insertError.message)
          return
        }
        console.log(`part_images inserted: ${partNum}_${colorId}${elementId ? ` (element_id: ${elementId})` : ''}`)
      } else {
        console.log(`part_images updated: ${partNum}_${colorId}${elementId ? ` (element_id: ${elementId})` : ''}`)
      }
    } catch (err) {
      console.warn('part_images upsert error:', err.message)
    }
  }

  // 로컬 저장소에 이미지 정보 저장
  const saveImageLocally = async (imageUrl, filename, uploadPath) => {
    try {
      // 로컬 저장소에 이미지 정보 저장
      const imageData = {
        originalUrl: imageUrl,
        filename: filename,
        path: uploadPath,
        timestamp: new Date().toISOString(),
        status: 'pending'
      }

      // localStorage에 저장
      const existingImages = JSON.parse(localStorage.getItem('pendingImages') || '[]')
      existingImages.push(imageData)
      localStorage.setItem('pendingImages', JSON.stringify(existingImages))

      // 로컬 URL 생성 (실제로는 원본 URL을 반환)
      const localUrl = imageUrl

      return {
        url: localUrl,
        local: true,
        pending: true
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 여러 이미지를 일괄 처리 (element_id 지원)
  const processMultipleImages = async (imageData) => {
    const results = []
    const errors = []

    const concurrency = 5
    let index = 0

    const worker = async () => {
      while (index < imageData.length) {
        const i = index++
        const data = imageData[i]
        try {
          const result = await processRebrickableImage(
            data.imageUrl,
            data.partNum,
            data.colorId,
            { elementId: data.elementId || null, imageSource: data.imageSource || 'unknown' }
          )
          results[i] = result
        } catch (err) {
          errors.push({ partNum: data.partNum, error: err.message })
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, imageData.length) }, () => worker())
    await Promise.all(workers)

    return { results, errors }
  }

  return {
    uploading,
    downloading,
    error,
    downloadImage,
    uploadImage,
    processRebrickableImage,
    processMultipleImages,
    uploadImageFromUrl,
    saveImageLocally,
    saveImageMetadata,
    checkBucketExists,
    extractOriginalFilename,
    checkPartImageDuplicate,
    checkPartImageDuplicateByElementId,
    checkPartImageDuplicateByElementIdAndColor,
    upsertPartImage,
    // ✅ 캐시 관리 함수 추가
    clearImageCache: () => imageDuplicateCache.clear(),
    getImageCacheSize: () => imageDuplicateCache.size,
    getImageCacheStats: () => ({
      size: imageDuplicateCache.size,
      maxSize: imageDuplicateCache.maxSize
    })
  }
}
