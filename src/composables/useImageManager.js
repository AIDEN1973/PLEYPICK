import { ref } from 'vue'
import { supabase } from './useSupabase'

const UPLOAD_SERVER = 'https://vanessa2.godohosting.com'
const UPLOAD_PROXY = '/api/upload'
const USE_SUPABASE_STORAGE = true // Supabase Storage 사용 여부

export function useImageManager() {
  const uploading = ref(false)
  const downloading = ref(false)
  const error = ref(null)

  // 이미지 다운로드 함수 (프록시 사용)
  const downloadImage = async (imageUrl, filename) => {
    downloading.value = true
    error.value = null

    try {
      // Rebrickable CDN URL을 프록시 URL로 변환
      let proxyUrl = imageUrl
      if (imageUrl.includes('cdn.rebrickable.com')) {
        const path = imageUrl.replace('https://cdn.rebrickable.com', '')
        proxyUrl = `/api/proxy${path}`
      }
      
      const response = await fetch(proxyUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`)
      }

      const blob = await response.blob()
      return blob
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      downloading.value = false
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
      
      // 버킷 존재 여부를 실제 업로드로 확인
      try {
        const { data, error } = await supabase.storage.listBuckets()
        if (error) {
          console.warn('Failed to list buckets, but bucket might still exist:', error.message)
          return true // 목록 조회 실패 시에도 업로드 시도
        }
        
        console.log('Available buckets:', data.map(b => b.id))
        
        const bucketExists = data.some(bucket => bucket.id === 'lego_parts_images')
        console.log('Bucket lego_parts_images exists:', bucketExists)
        return bucketExists
      } catch (listError) {
        console.warn('Bucket list check failed, but bucket might still exist:', listError.message)
        return true // 목록 조회 실패 시에도 업로드 시도
      }
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

  // 부품별 이미지 중복 검사 함수 (부품번호 + 색상ID로 검사)
  const checkPartImageDuplicate = async (partNum, colorId) => {
    try {
      console.log(`Checking for existing image: part_num=${partNum}, color_id=${colorId}`)
      
      // image_metadata 테이블에서 해당 부품의 이미지가 이미 있는지 확인
      const { data, error } = await supabase
        .from('image_metadata')
        .select('id, supabase_url')
        .eq('part_num', partNum)
        .eq('color_id', colorId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.warn('Image existence check failed:', error.message)
        return false // 오류 시 중복 없음으로 처리
      }
      
      // 이미지가 존재하면 중복
      if (data && data.supabase_url) {
        console.log(`Existing image found for ${partNum} (color: ${colorId}): ${data.supabase_url}`)
        return true
      }
      
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

        // 원본 파일명 사용
        const fileName = file.name
        const filePath = path ? `${path}/${fileName}` : `images/${fileName}`
        
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

        return {
          url: urlData.publicUrl,
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
      return `image_${Date.now()}.jpg`
    }
  }

  // Rebrickable 이미지를 다운로드하고 업로드하는 통합 함수 (파일명 기반 중복 검사)
  const processRebrickableImage = async (imageUrl, partNum, colorId = null) => {
    try {
      // 원본 URL에서 파일명 추출
      const originalFilename = extractOriginalFilename(imageUrl)
      console.log(`Original filename from URL: ${originalFilename}`)
      
      // 업로드 경로 설정 (부품별 폴더)
      const uploadPath = `lego/parts/${partNum}`
      
      // 1. 부품별 이미지 중복 검사 수행
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
      
      try {
        // 이미지 다운로드 시도
        const blob = await downloadImage(imageUrl)
        
        // 파일 생성 (원본 파일명 사용)
        const file = new File([blob], originalFilename, { type: blob.type })
        
        // 서버에 업로드 (원본 파일명 그대로 사용)
        const result = await uploadImage(file, uploadPath)
        
        console.log(`Successfully uploaded: ${originalFilename}`)
        
        return {
          originalUrl: imageUrl,
          uploadedUrl: result.url,
          filename: originalFilename, // 원본 파일명 반환
          path: result.path
        }
      } catch (downloadErr) {
        console.warn('Direct download failed, using alternative method:', downloadErr.message)
        
        try {
          // 대체 방법 1: 이미지 URL을 직접 서버로 전달하여 서버에서 다운로드
          const result = await uploadImageFromUrl(imageUrl, originalFilename, uploadPath)
          
          return {
            originalUrl: imageUrl,
            uploadedUrl: result.url,
            filename: result.filename,
            path: result.path
          }
        } catch (serverErr) {
          console.warn('Server upload failed, using local storage:', serverErr.message)
          
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
        try {
          // 프록시를 통해 이미지 다운로드
          let proxyUrl = imageUrl
          if (imageUrl.includes('cdn.rebrickable.com')) {
            const path = imageUrl.replace('https://cdn.rebrickable.com', '')
            proxyUrl = `/api/proxy${path}`
          }
          
          response = await fetch(proxyUrl)
          if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`)
          }
        } catch (proxyErr) {
          console.warn('Proxy download failed, trying direct download:', proxyErr.message)
          // 프록시 실패 시 직접 다운로드 시도
          response = await fetch(imageUrl)
          if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`)
          }
        }
        
        const blob = await response.blob()
        const file = new File([blob], filename, { type: blob.type })
        
        // 원본 파일명 그대로 사용
        const fileName = filename
        const filePath = uploadPath ? `${uploadPath}/${fileName}` : `images/${fileName}`
        
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

        return {
          url: urlData.publicUrl,
          path: filePath,
          bucket: 'lego_parts_images'
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
      const { data, error } = await supabase
        .from('image_metadata')
        .insert([imageData])
        .select()

      if (error) {
        throw new Error(`Failed to save image metadata: ${error.message}`)
      }

      return data[0]
    } catch (err) {
      error.value = err.message
      throw err
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

    for (const data of imageData) {
      try {
        const result = await processRebrickableImage(
          data.imageUrl, 
          data.partNum, 
          data.colorId
        )
        results.push(result)
      } catch (err) {
        errors.push({
          partNum: data.partNum,
          error: err.message
        })
      }
    }

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
    checkPartImageDuplicate
  }
}
