import { ref } from 'vue'

const UPLOAD_SERVER = 'https://vanessa2.godohosting.com'

export function useImageManager() {
  const uploading = ref(false)
  const downloading = ref(false)
  const error = ref(null)

  // 이미지 다운로드 함수
  const downloadImage = async (imageUrl, filename) => {
    downloading.value = true
    error.value = null

    try {
      const response = await fetch(imageUrl)
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

  // 이미지 업로드 함수
  const uploadImage = async (file, path = '') => {
    uploading.value = true
    error.value = null

    try {
      const formData = new FormData()
      formData.append('image', file)
      if (path) {
        formData.append('path', path)
      }

      const response = await fetch(`${UPLOAD_SERVER}/upload`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const result = await response.json()
      return result
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
      // 이미지 다운로드
      const blob = await downloadImage(imageUrl)
      
      // 파일명 생성
      const extension = imageUrl.split('.').pop() || 'jpg'
      const filename = colorId 
        ? `${partNum}_${colorId}.${extension}`
        : `${partNum}.${extension}`
      
      // 파일 생성
      const file = new File([blob], filename, { type: blob.type })
      
      // 업로드 경로 설정
      const uploadPath = `lego/parts/${partNum}`
      
      // 서버에 업로드
      const result = await uploadImage(file, uploadPath)
      
      return {
        originalUrl: imageUrl,
        uploadedUrl: result.url,
        filename: filename,
        path: uploadPath
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
    processMultipleImages
  }
}
