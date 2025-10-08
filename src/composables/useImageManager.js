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
      // 1차: 프록시를 통한 다운로드 시도
      let response
      try {
        if (imageUrl.includes('cdn.rebrickable.com')) {
          const path = imageUrl.replace('https://cdn.rebrickable.com', '')
          const proxyUrl = `/api/proxy${path}`
          response = await fetch(proxyUrl)
        } else {
          response = await fetch(imageUrl)
        }
        
        if (!response.ok) {
          throw new Error(`Proxy download failed: ${response.status}`)
        }
      } catch (proxyErr) {
        console.warn('Direct download failed, using alternative method:', proxyErr.message)
        
        // 2차: 직접 다운로드 시도 (CORS 우회)
        try {
          response = await fetch(imageUrl, {
            mode: 'cors',
            headers: {
              'Accept': 'image/*',
              'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
            }
          })
          
          if (!response.ok) {
            throw new Error(`Direct download failed: ${response.status}`)
          }
        } catch (directErr) {
          console.warn('All download methods failed:', directErr.message)
          throw new Error(`Failed to download image: ${directErr.message}`)
        }
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

  // 부품별 이미지 중복 검사 함수 (부품번호 + 색상ID로 검사)
  const checkPartImageDuplicate = async (partNum, colorId) => {
    try {
      console.log(`Checking for existing image: part_num=${partNum}, color_id=${colorId}`)
      
      // Storage 버킷에서 직접 확인 (테이블 대신 실제 파일 존재 여부 확인)
      const fileName = `${partNum}_${colorId}.jpg`
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const bucketName = 'lego_parts_images'
      const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/images/${fileName}`
      
      // HTTP HEAD 요청으로 이미지 존재 여부 확인
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' })
        if (response.ok) {
          console.log(`Existing image found for ${partNum} (color: ${colorId}): ${imageUrl}`)
          return true
        }
      } catch (fetchError) {
        console.log(`Image not found in Storage: ${fileName}`)
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
  const processRebrickableImage = async (imageUrl, partNum, colorId = null, options = {}) => {
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
        
        // 파일명을 partNum_colorId.jpg 형식으로 통일
        const fileName = `${partNum}_${colorId}.jpg`
        const file = new File([blob], fileName, { type: 'image/jpeg' })
        
        // 서버에 업로드 (원본 파일명 그대로 사용)
        const result = await uploadImage(file, uploadPath)
        
        console.log(`Successfully uploaded: ${fileName}`)
        
        // part_images 동기화
        await upsertPartImage({ partNum, colorId, uploadedUrl: result.url, filename: fileName })
        
        return {
          originalUrl: imageUrl,
          uploadedUrl: result.url,
          filename: fileName, // 통일된 파일명 반환
          path: result.path
        }
      } catch (downloadErr) {
        console.warn('Direct download failed, using alternative method:', downloadErr.message)
        
        try {
          // 대체 방법 1: 이미지 URL을 직접 서버로 전달하여 서버에서 다운로드
          // 파일명도 일관되게 partNum_colorId.jpg 사용
          const combinedFilename = `${partNum}_${colorId}.jpg`
          const result = await uploadImageFromUrl(imageUrl, combinedFilename, uploadPath)
          
          // part_images 동기화
          await upsertPartImage({ partNum, colorId, uploadedUrl: result.url, filename: result.filename })
          
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
        
        // 중복 파일 처리: 덮어쓰기 옵션 사용
        console.log(`📤 Supabase Storage 업로드 시도: ${filePath}`)
        const { data, error: uploadError } = await supabase.storage
          .from('lego_parts_images')
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
  const upsertPartImage = async ({ partNum, colorId, uploadedUrl, filename }) => {
    try {
      if (!partNum || typeof colorId !== 'number' || !uploadedUrl) return

      const payload = {
        part_id: String(partNum),
        color_id: colorId,
        original_url: uploadedUrl,
        uploaded_url: uploadedUrl,
        filename: filename || `${partNum}_${colorId}.jpg`,
        upload_status: 'completed'
      }

      // 1) 존재 시 업데이트
      const { data: updated, error: updateError } = await supabase
        .from('part_images')
        .update(payload)
        .eq('part_id', String(partNum))
        .eq('color_id', colorId)
        .select('part_id')

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
        console.log(`part_images inserted: ${partNum}_${colorId}`)
      } else {
        console.log(`part_images updated: ${partNum}_${colorId}`)
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
    checkPartImageDuplicate
  }
}
