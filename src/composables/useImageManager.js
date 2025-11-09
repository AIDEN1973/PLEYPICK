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

// 파일명 생성 헬퍼 함수: element_id 우선, 없으면 part_num_color_id
export const generateImageFilename = (partNum, colorId, elementId = null) => {
  console.log(`[generateImageFilename] 입력: partNum=${partNum}, colorId=${colorId}, elementId=${elementId}, elementId 타입=${typeof elementId}, elementId truthy=${!!elementId}`)
  // elementId가 null, undefined, 빈 문자열이 아닌 경우에만 사용
  if (elementId !== null && elementId !== undefined && elementId !== '') {
    const filename = `${elementId}.webp`
    console.log(`[generateImageFilename] elementId 사용: ${filename}`)
    return filename
  }
  const filename = `${partNum}_${colorId}.webp`
  console.log(`[generateImageFilename] partNum_colorId 사용: ${filename}`)
  return filename
}

export function useImageManager() {
  const uploading = ref(false)
  const downloading = ref(false)
  const error = ref(null)

  // 이미지 다운로드 함수 (Axios + 재시도 로직)
  const downloadImage = async (imageUrl, filename, maxRetries = 2) => {
    downloading.value = true
    error.value = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 이미지 다운로드 시도 ${attempt}/${maxRetries}: ${imageUrl}`)
        
        // Axios를 사용한 안정적인 다운로드
        const response = await axios.get(`/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`, {
          responseType: 'arraybuffer',
          timeout: 3000,              // 3초 제한
          validateStatus: status => status < 500,  // 5xx 에러만 재시도
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
        
        if (!response.data || response.data.length === 0) {
          throw new Error('Image download failed - empty response')
        }

        // ArrayBuffer를 Blob으로 변환
        const blob = new Blob([response.data])
        console.log(`✅ 이미지 다운로드 성공: ${blob.size} bytes`)
        return blob
        
      } catch (err) {
        console.warn(`⚠️ 다운로드 시도 ${attempt} 실패: ${err.message}`)
        
        if (attempt === maxRetries) {
          error.value = `이미지 다운로드 실패 (${maxRetries}회 시도): ${err.message}`
          throw err
        }
        
        // 재시도 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
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
      const fileName = `${partNum}_${colorId}.webp`
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
      const bucketName = 'lego_parts_images'
      const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
      
      // HTTP HEAD 요청으로 이미지 존재 여부 확인
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' })
        if (response.ok) {
          console.log(`Existing image found in Storage for ${partNum} (color: ${colorId}): ${imageUrl}`)
          imageDuplicateCache.set(cacheKey, true) // ✅ 캐시 저장
          return true
        }
      } catch (fetchError) {
        console.log(`Image not found in Storage: ${fileName}`)
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
    // elementId가 실제로 존재하는지 확인 (0이나 빈 문자열도 유효한 값일 수 있음)
    const elementId = (options?.elementId !== null && options?.elementId !== undefined && options?.elementId !== '') 
      ? options.elementId 
      : null
    console.log(`[processRebrickableImage] 입력값: partNum=${partNum}, colorId=${colorId}, options.elementId=${options?.elementId}, 최종 elementId=${elementId}, elementId 타입=${typeof elementId}`)
    try {
      // 원본 URL에서 파일명 추출
      const originalFilename = extractOriginalFilename(imageUrl)
      console.log(`Original filename from URL: ${originalFilename}`)
      
      // 업로드 경로 설정 (일관된 경로)
      const uploadPath = `images`
      
      // 1. 부품별 이미지 중복 검사 수행 (강제 업로드 옵션)
      const forceUpload = options?.forceUpload || false
      if (!forceUpload) {
        const isDuplicate = await checkPartImageDuplicate(partNum, colorId)
        if (isDuplicate) {
          console.log(`Skipping duplicate image for part ${partNum} (color: ${colorId})`)
          return {
            originalUrl: imageUrl,
            uploadedUrl: null, // 중복으로 업로드하지 않음
            filename: originalFilename,
            path: uploadPath,
            isDuplicate: true
          }
        }
      } else {
        console.log(`Force uploading image for part ${partNum} (color: ${colorId}) - overwriting existing`)
      }
      
      try {
        // 이미지 다운로드 시도
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
        
        // 파일명 생성: element_id 우선, 없으면 partNum_colorId
        const fileName = generateImageFilename(partNum, colorId, elementId)
        console.log(`📝 파일명 생성: partNum=${partNum}, colorId=${colorId}, elementId=${elementId}, fileName=${fileName}`)
        const file = new File([webpBlob], fileName, { type: 'image/webp' })
        
        // Supabase Storage에 직접 업로드
        const bucketName = 'lego_parts_images'
        const filePath = `images/${fileName}`
        
        console.log(`📤 Supabase Storage 업로드 시도: ${filePath} (elementId: ${elementId || '없음'})`)
        const { data, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            upsert: true // 파일이 이미 존재하면 덮어쓰기
          })

        if (uploadError) {
          console.error(`❌ Supabase 업로드 실패:`, uploadError)
          throw new Error(`Supabase upload failed: ${uploadError.message}`)
        }
        
        console.log(`✅ Supabase 업로드 성공:`, data)
        
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
        
        try {
          // 대체 방법 1: 프록시를 통한 이미지 다운로드 및 WebP 변환 (Axios + 재시도)
          const proxyUrl = `/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`
          console.log(`🔄 프록시를 통한 이미지 다운로드 시도: ${proxyUrl}`)
          
          const proxyResponse = await axios.get(proxyUrl, {
            responseType: 'arraybuffer',
            timeout: 3000,
            validateStatus: status => status < 500,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          })
          
          if (!proxyResponse.data || proxyResponse.data.length === 0) {
            throw new Error('프록시 다운로드 실패 - 빈 응답')
          }
          
          const proxyBlob = new Blob([proxyResponse.data])
          // 파일명 생성: element_id 우선, 없으면 partNum_colorId
          const fileName = generateImageFilename(partNum, colorId, elementId)
          const file = new File([proxyBlob], fileName, { type: 'image/webp' })
          
          // Supabase Storage에 직접 업로드
          const bucketName = 'lego_parts_images'
          const filePath = `images/${fileName}`
          
          console.log(`📤 Supabase Storage 업로드 시도 (프록시): ${filePath}`)
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
          
          const uploadedUrl = urlData.publicUrl
          console.log(`✅ 프록시를 통한 업로드 성공: ${uploadedUrl}`)
          
          // part_images 동기화
          await upsertPartImage({ partNum, colorId, uploadedUrl, filename: fileName, elementId })
          
          return {
            originalUrl: imageUrl,
            uploadedUrl: uploadedUrl,
            filename: fileName,
            path: filePath
          }
        } catch (serverErr) {
          console.warn('프록시 업로드 실패, 로컬 저장소 사용:', serverErr.message)
          
          // 대체 방법 2: 로컬 저장소에 이미지 정보 저장
          const localResult = await saveImageLocally(imageUrl, originalFilename, uploadPath)
          
          return {
            originalUrl: imageUrl,
            uploadedUrl: localResult.url,
            filename: originalFilename,
            path: uploadPath,
            isLocal: true
          }
        }
      }
    } catch (err) {
      error.value = err.message
      throw err
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

        // Supabase Storage 사용: 먼저 이미지를 다운로드한 후 업로드
        let response
        let downloadMethod = 'unknown'
        
        try {
          // 1. Vite 프록시를 통한 다운로드 (CORS 문제 해결)
          if (imageUrl.includes('cdn.rebrickable.com')) {
            try {
              // Vite 프록시를 통해 Rebrickable CDN 접근
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
                console.log(`✅ Vite 프록시 다운로드 성공`)
              } else {
                console.warn(`⚠️ Vite 프록시 다운로드 실패: ${response.status}`)
              }
            } catch (proxyError) {
              console.warn(`⚠️ Vite 프록시 서버 오류: ${proxyError.message}`)
            }
          }
          
          // 2. API 프록시 서버를 통한 다운로드 (fallback)
          if (!response || !response.ok) {
            try {
              const proxyUrl = `/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`
              response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                  'Accept': 'image/*',
                  'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
                }
              })
              
              if (response.ok) {
                downloadMethod = 'api_proxy'
                console.log(`✅ API 프록시 다운로드 성공`)
              } else {
                console.warn(`⚠️ API 프록시 다운로드 실패: ${response.status}`)
              }
            } catch (proxyError) {
              console.warn(`⚠️ API 프록시 서버 오류: ${proxyError.message}`)
            }
          }
          
          // 3. 직접 다운로드 시도 (최종 fallback)
          if (!response || !response.ok) {
            console.log(`🔄 직접 다운로드 시도: ${imageUrl}`)
            response = await fetch(imageUrl)
            if (response.ok) {
              downloadMethod = 'direct'
              console.log(`✅ 직접 다운로드 성공`)
            } else {
              throw new Error(`모든 다운로드 방법 실패: ${response.status}`)
            }
          }
        } catch (downloadErr) {
          console.warn('모든 다운로드 방법 실패:', downloadErr.message)
          throw new Error(`이미지 다운로드 실패: ${downloadErr.message}`)
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
        
        // 중복 파일 처리: 덮어쓰기 옵션 사용
        console.log(`📤 Supabase Storage 업로드 시도: ${filePath} (bucket: ${bucketName})`)
        console.log(`📤 File size: ${file.size} bytes`)
        console.log(`📤 File type: ${file.type}`)
        console.log(`📤 Upload path: ${uploadPath}`)
        
        const { data, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            upsert: true // 파일이 이미 존재하면 덮어쓰기
          })

        if (uploadError) {
          console.error(`❌ Supabase 업로드 실패:`, uploadError)
          console.error(`❌ Upload details:`, {
            bucket: bucketName,
            filePath: filePath,
            fileSize: file.size,
            fileType: file.type,
            uploadPath: uploadPath
          })
          throw new Error(`Supabase upload failed: ${uploadError.message}`)
        }
        
        console.log(`✅ Supabase 업로드 성공:`, data)

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
      const { error } = await supabase
        .from('image_metadata')
        .insert([imageData], { returning: 'minimal' })

      if (error) {
        throw new Error(`Failed to save image metadata: ${error.message}`)
      }

      return true
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 업로드 직후 part_images 테이블에 동기화 (트리거 없이 앱 레벨에서 처리)
  const upsertPartImage = async ({ partNum, colorId, uploadedUrl, filename, elementId }) => {
    try {
      if (!partNum || typeof colorId !== 'number' || !uploadedUrl) return

      const payload = {
        part_id: String(partNum),
        color_id: colorId,
        original_url: uploadedUrl,
        uploaded_url: uploadedUrl,
        filename: filename || generateImageFilename(partNum, colorId, elementId),
        upload_status: 'completed',
        ...(elementId && { element_id: String(elementId) }) // element_id가 있으면 추가
      }

      // element_id가 있으면 element_id로도 조회/업데이트 시도
      let updateQuery = supabase
        .from('part_images')
        .update(payload)
      
      if (elementId) {
        // element_id가 있으면 element_id로 우선 조회
        updateQuery = updateQuery.eq('element_id', String(elementId))
      } else {
        // element_id가 없으면 part_id + color_id로 조회
        updateQuery = updateQuery.eq('part_id', String(partNum)).eq('color_id', colorId)
      }

      const { data: updated, error: updateError } = await updateQuery.select('part_id')

      if (updateError) {
        console.warn('part_images update failed, will try insert:', updateError.message)
      }

      // 2) 업데이트된 행이 없으면 삽입
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

  // 여러 이미지를 일괄 처리
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
            data.colorId
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
    generateImageFilename, // 파일명 생성 함수 export
    // ✅ 캐시 관리 함수 추가
    clearImageCache: () => imageDuplicateCache.clear(),
    getImageCacheSize: () => imageDuplicateCache.size,
    getImageCacheStats: () => ({
      size: imageDuplicateCache.size,
      maxSize: imageDuplicateCache.maxSize
    })
  }
}
