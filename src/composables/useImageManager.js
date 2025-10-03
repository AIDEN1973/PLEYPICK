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

  // 이미지 업로드 함수 (Supabase Storage 또는 외부 서버)
  const uploadImage = async (file, path = '') => {
    uploading.value = true
    error.value = null

    try {
      if (USE_SUPABASE_STORAGE) {
        // Supabase Storage 사용
        const fileName = `${Date.now()}-${file.name}`
        const filePath = path ? `${path}/${fileName}` : `images/${fileName}`
        
        const { data, error: uploadError } = await supabase.storage
          .from('lego-images')
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`Supabase upload failed: ${uploadError.message}`)
        }

        // 공개 URL 생성
        const { data: urlData } = supabase.storage
          .from('lego-images')
          .getPublicUrl(filePath)

        return {
          url: urlData.publicUrl,
          path: filePath,
          bucket: 'lego-images'
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

  // Rebrickable 이미지를 다운로드하고 업로드하는 통합 함수
  const processRebrickableImage = async (imageUrl, partNum, colorId = null) => {
    try {
      // 파일명 생성
      const extension = imageUrl.split('.').pop() || 'jpg'
      const filename = colorId 
        ? `${partNum}_${colorId}.${extension}`
        : `${partNum}.${extension}`
      
      // 업로드 경로 설정
      const uploadPath = `lego/parts/${partNum}`
      
      try {
        // 이미지 다운로드 시도
        const blob = await downloadImage(imageUrl)
        
        // 파일 생성
        const file = new File([blob], filename, { type: blob.type })
        
        // 서버에 업로드
        const result = await uploadImage(file, uploadPath)
        
        return {
          originalUrl: imageUrl,
          uploadedUrl: result.url,
          filename: filename,
          path: uploadPath
        }
      } catch (downloadErr) {
        console.warn('Direct download failed, using alternative method:', downloadErr.message)
        
        try {
          // 대체 방법 1: 이미지 URL을 직접 서버로 전달하여 서버에서 다운로드
          const result = await uploadImageFromUrl(imageUrl, filename, uploadPath)
          
          return {
            originalUrl: imageUrl,
            uploadedUrl: result.url,
            filename: filename,
            path: uploadPath
          }
        } catch (serverErr) {
          console.warn('Server upload failed, using local storage:', serverErr.message)
          
          // 대체 방법 2: 로컬 저장소에 이미지 정보 저장
          const localResult = await saveImageLocally(imageUrl, filename, uploadPath)
          
          return {
            originalUrl: imageUrl,
            uploadedUrl: localResult.url,
            filename: filename,
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
        // Supabase Storage 사용: 먼저 이미지를 다운로드한 후 업로드
        const response = await fetch(imageUrl)
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status}`)
        }
        
        const blob = await response.blob()
        const file = new File([blob], filename, { type: blob.type })
        
        // Supabase Storage에 업로드
        const fileName = `${Date.now()}-${filename}`
        const filePath = uploadPath ? `${uploadPath}/${fileName}` : `images/${fileName}`
        
        const { data, error: uploadError } = await supabase.storage
          .from('lego-images')
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`Supabase upload failed: ${uploadError.message}`)
        }

        // 공개 URL 생성
        const { data: urlData } = supabase.storage
          .from('lego-images')
          .getPublicUrl(filePath)

        return {
          url: urlData.publicUrl,
          path: filePath,
          bucket: 'lego-images'
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
    saveImageMetadata
  }
}
