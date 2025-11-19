import { ref } from 'vue'
import { supabase } from './useSupabase'
import { useRebrickable } from './useRebrickable'

// UPLOAD_PROXY 상수 제거 - 직접 경로 사용

/**
 * 자동 이미지 마이그레이션 시스템
 * - CDN 링크를 사용하는 부품을 자동으로 Supabase Storage로 마이그레이션
 * - 백그라운드에서 처리하여 사용자 경험 향상
 */
export function useAutoImageMigration() {
  const migrating = ref(false)
  const migrationQueue = ref([])
  const migrationStats = ref({
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0
  })
  
  // 마이그레이션 캐시 (중복 요청 방지)
  const migrationCache = new Map()
  const pendingMigrations = new Map()

  /**
   * 부품 이미지 자동 마이그레이션 (캐싱 및 중복 방지)
   */
  const migratePartImage = async (partNum, colorId, originalUrl, options = {}) => {
    const elementId = options?.elementId || null
    const cacheKey = elementId ? `element_${String(elementId)}` : `${partNum}_${colorId}`
    
    try {
      // 1. 캐시 확인
      if (!options.force && migrationCache.has(cacheKey)) {
        console.log(`✅ 캐시에서 마이그레이션 결과 반환: ${partNum}`)
        return migrationCache.get(cacheKey)
      }
      
      // 2. 진행 중인 마이그레이션 확인
      if (!options.force && pendingMigrations.has(cacheKey)) {
        console.log(`⏳ 진행 중인 마이그레이션 대기: ${partNum}`)
        return await pendingMigrations.get(cacheKey)
      }
      
      console.log(`🔄 자동 마이그레이션 시작: ${partNum} (색상: ${colorId})`)
      
      // 3. 진행 중인 마이그레이션으로 등록
      const migrationPromise = performMigration(partNum, colorId, originalUrl, options)
      pendingMigrations.set(cacheKey, migrationPromise)
      
      try {
        const result = await migrationPromise
        // 성공 시 캐시에 저장
        if (result) {
          migrationCache.set(cacheKey, result)
        }
        return result
      } finally {
        // 완료 후 진행 중인 마이그레이션에서 제거
        pendingMigrations.delete(cacheKey)
      }
      
    } catch (error) {
      console.error(`❌ 마이그레이션 실패: ${partNum}`, error)
      migrationStats.value.failed++
      return null
    }
  }
  
  /**
   * 실제 마이그레이션 수행
   */
  const performMigration = async (partNum, colorId, originalUrl, options = {}) => {
    const elementId = options?.elementId || null
    try {
      // 1. 이미 Supabase Storage에 있는지 확인 (강제 재업로드 옵션)
      const forceReupload = options?.force || false
      if (!forceReupload) {
        const existingImage = await checkExistingSupabaseImage(partNum, colorId, elementId)
        if (existingImage) {
          console.log(`✅ 이미 Supabase Storage에 존재: ${partNum}${elementId ? ` (element_id: ${elementId})` : ''}`)
          migrationStats.value.skipped++
          return existingImage
        }
      } else {
        console.log(`🔄 강제 재업로드 모드: ${partNum}${elementId ? ` (element_id: ${elementId})` : ''}`)
      }

      // 2. 이미지 다운로드 (여러 방법 시도, 실패 시 재시도)
      let imageBlob = null
      let downloadMethod = 'unknown'
      
      // 다운로드 재시도 로직 (최대 3회)
      const maxRetries = 3
      let lastError = null
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`📥 이미지 다운로드 시도 ${attempt}/${maxRetries}: ${originalUrl}`)
          imageBlob = await downloadImage(originalUrl)
          if (imageBlob) {
            downloadMethod = 'proxy_or_direct'
            console.log(`✅ 이미지 다운로드 성공 (시도 ${attempt}/${maxRetries})`)
            break
          }
        } catch (downloadError) {
          lastError = downloadError
          console.warn(`⚠️ 이미지 다운로드 실패 (시도 ${attempt}/${maxRetries}): ${downloadError.message}`)
          
          // 마지막 시도가 아니면 재시도
          if (attempt < maxRetries) {
            const waitTime = attempt * 1000 // 1초, 2초, 3초 대기
            console.log(`⏳ ${waitTime}ms 후 재시도...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }
      }
      
      // 모든 시도 실패 시 서버 사이드 프록시로 강제 시도
      if (!imageBlob) {
        console.warn(`⚠️ 모든 다운로드 시도 실패, 서버 사이드 프록시로 강제 시도: ${partNum}`)
        try {
          // 서버 사이드 프록시는 WebP로 변환된 이미지를 반환하므로, 이를 직접 사용
          const proxyUrl = `/api/upload/proxy-image?url=${encodeURIComponent(originalUrl)}`
          const proxyResponse = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'image/webp',
              'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
            }
          })
          
          if (proxyResponse.ok) {
            const webpBlob = await proxyResponse.blob()
            if (webpBlob && webpBlob.type === 'image/webp') {
              console.log(`✅ 서버 사이드 프록시 다운로드 성공 (이미 WebP): ${webpBlob.size} bytes`)
              // 이미 WebP이므로 바로 업로드
              const uploadResult = await uploadToSupabase(partNum, colorId, webpBlob, { verifyUpload: options.verifyUpload, elementId })
              console.log(`✅ Supabase 업로드 완료: ${uploadResult.url}`)
              migrationStats.value.completed++
              
              // 데이터베이스에 등록
              try {
                await registerInDatabase(partNum, colorId, originalUrl, uploadResult.url, elementId)
              } catch (dbError) {
                console.warn(`⚠️ 데이터베이스 등록 실패하지만 마이그레이션은 성공: ${partNum}`, dbError)
              }
              
              return uploadResult.url
            }
          } else {
            console.warn(`⚠️ 서버 사이드 프록시 다운로드 실패: ${proxyResponse.status}`)
          }
        } catch (proxyError) {
          console.error(`❌ 서버 사이드 프록시 오류: ${proxyError.message}`)
        }
        
        // 최종 실패
        console.error(`❌ 모든 다운로드 방법 실패: ${partNum}`)
        throw new Error(`이미지 다운로드 실패: ${lastError?.message || '알 수 없는 오류'}`)
      }

      // 3. WebP로 변환
      let webpBlob
      try {
        webpBlob = await convertToWebP(imageBlob)
      } catch (conversionError) {
        console.warn(`⚠️ WebP 변환 실패, 원본 이미지 사용: ${conversionError.message}`)
        webpBlob = imageBlob
      }
      
      // 4. Supabase Storage에 업로드 (element_id 전달, 재시도 포함)
      let uploadResult
      const maxUploadRetries = 3
      let uploadSuccess = false
      
      for (let attempt = 1; attempt <= maxUploadRetries; attempt++) {
        try {
          console.log(`📤 Supabase 업로드 시도 ${attempt}/${maxUploadRetries}: ${partNum}`)
          uploadResult = await uploadToSupabase(partNum, colorId, webpBlob, { verifyUpload: options.verifyUpload, elementId })
          uploadSuccess = true
          console.log(`✅ Supabase 업로드 성공 (시도 ${attempt}/${maxUploadRetries}): ${uploadResult.url}`)
          break
        } catch (uploadError) {
          console.warn(`⚠️ Supabase 업로드 실패 (시도 ${attempt}/${maxUploadRetries}): ${uploadError.message}`)
          
          // 마지막 시도가 아니면 재시도
          if (attempt < maxUploadRetries) {
            const waitTime = attempt * 1000 // 1초, 2초, 3초 대기
            console.log(`⏳ ${waitTime}ms 후 재시도...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          } else {
            // 모든 시도 실패
            console.error(`❌ 모든 Supabase 업로드 시도 실패: ${partNum}`)
            throw new Error(`Supabase 업로드 실패: ${uploadError.message}`)
          }
        }
      }
      
      if (!uploadSuccess || !uploadResult) {
        throw new Error('Supabase 업로드 실패')
      }
      
      // 5. 데이터베이스에 등록 (실패해도 계속 진행)
      try {
        await registerInDatabase(partNum, colorId, originalUrl, uploadResult.url, elementId)
      } catch (dbError) {
        console.warn(`⚠️ 데이터베이스 등록 실패하지만 마이그레이션은 성공: ${partNum}`, dbError)
        // 데이터베이스 등록 실패해도 마이그레이션은 성공으로 간주
      }
      
      console.log(`✅ 마이그레이션 완료: ${partNum} (방법: ${downloadMethod})`)
      migrationStats.value.completed++
      
      return uploadResult.url
      
    } catch (error) {
      console.error(`❌ 마이그레이션 실패: ${partNum}`, error)
      migrationStats.value.failed++
      
      // 최종 fallback: null 반환 (프록시 URL 생성하지 않음)
      console.error(`❌ 마이그레이션 완전 실패: ${partNum} - ${error.message}`)
      console.error(`   원본 URL: ${originalUrl}`)
      console.error(`   주의: 프로덕션 모드에서는 이 이미지가 표시되지 않을 수 있습니다.`)
      return null
    }
  }

  /**
   * 기존 Supabase Storage 이미지 확인 (element_id 우선)
   */
  const checkExistingSupabaseImage = async (partNum, colorId, elementId = null) => {
    try {
      // 1. element_id가 있으면 element_id로 먼저 확인
      if (elementId) {
        const { data: partImageByElement } = await supabase
          .from('part_images')
          .select('uploaded_url')
          .eq('element_id', String(elementId))
          .not('uploaded_url', 'is', null)
          .maybeSingle()
        
        if (partImageByElement?.uploaded_url) {
          // JPG는 존재로 간주하지 않음 (webp만 인정)
          if (!partImageByElement.uploaded_url.toLowerCase().endsWith('.jpg')) {
            try {
              const response = await fetch(partImageByElement.uploaded_url, { 
                method: 'HEAD',
                signal: AbortSignal.timeout(3000)
              })
              const contentType = response.headers.get('content-type')
              const isJsonError = contentType && contentType.includes('application/json')
              if (!isJsonError && response.ok) {
                return partImageByElement.uploaded_url
              }
            } catch (error) {
              // 조용히 실패 처리
            }
          }
        }
      }
      
      // 2. part_images 테이블에서 part_id + color_id로 확인
      const { data: partImage } = await supabase
        .from('part_images')
        .select('uploaded_url')
        .eq('part_id', partNum)
        .eq('color_id', colorId)
        .not('uploaded_url', 'is', null)
        .maybeSingle()

      if (partImage?.uploaded_url) {
        // JPG는 존재로 간주하지 않음 (webp만 인정)
        if (partImage.uploaded_url.toLowerCase().endsWith('.jpg')) {
          console.log(`ℹ️ DB URL이 JPG이므로 무시: ${partImage.uploaded_url}`)
        } else {
        // ✅ 실제 이미지 존재 여부 확인 (HEAD 요청으로 400 에러 방지)
        try {
          const response = await fetch(partImage.uploaded_url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(3000)
          })
          const contentType = response.headers.get('content-type')
          const isJsonError = contentType && contentType.includes('application/json')
          if (!isJsonError && response.ok) {
            return partImage.uploaded_url
          }
          // 오류는 조용히 처리 (로그 제거)
        } catch (error) {
          // 조용히 실패 처리
        }
        }
      }

      // image_metadata 테이블에서 확인
      const { data: metadata } = await supabase
        .from('image_metadata')
        .select('supabase_url')
        .eq('part_num', partNum)
        .eq('color_id', colorId)
        .not('supabase_url', 'is', null)
        .maybeSingle()

      if (metadata?.supabase_url) {
        // JPG는 존재로 간주하지 않음 (webp만 인정)
        if (metadata.supabase_url.toLowerCase().endsWith('.jpg')) {
          console.log(`ℹ️ metadata URL이 JPG이므로 무시: ${metadata.supabase_url}`)
        } else {
        // ✅ 실제 이미지 존재 여부 확인 (HEAD 요청으로 400 에러 방지)
        try {
          const response = await fetch(metadata.supabase_url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(3000)
          })
          const contentType = response.headers.get('content-type')
          const isJsonError = contentType && contentType.includes('application/json')
          if (!isJsonError && response.ok) {
            return metadata.supabase_url
          }
          // 오류는 조용히 처리 (로그 제거)
        } catch (error) {
          // 조용히 실패 처리
        }
        }
      }

      // 3. Storage에서 직접 확인 (element_id 우선, 여러 경로 시도)
      // webp만 인정하여 확인
      const possiblePaths = elementId
        ? [`images/${String(elementId)}.webp`, `images/${partNum}_${colorId}.webp`]
        : [`images/${partNum}_${colorId}.webp`]

      for (const path of possiblePaths) {
        try {
          const { data: urlData } = supabase.storage
            .from('lego_parts_images')
            .getPublicUrl(path)
          
          // ✅ HEAD 요청으로 파일 존재 여부 확인 (GET 대신 HEAD로 400 에러 방지)
          const response = await fetch(urlData.publicUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(3000) // 3초 타임아웃
          })
          
          // Content-Type 확인: JSON이면 에러 응답
          const contentType = response.headers.get('content-type')
          const isJsonError = contentType && contentType.includes('application/json')
          
          // JSON 응답이면 파일이 없는 것 (Supabase 에러 메시지)
          if (isJsonError) {
            // 조용히 처리 (정상적인 흐름)
            continue
          } else if (response.ok) {
            // 200 응답이고 이미지 타입이면 파일 존재
            console.log(`✅ Storage에서 이미지 발견: ${path}`)
            return urlData.publicUrl
          }
        } catch (error) {
          // 네트워크 오류나 타임아웃은 조용히 처리 (로그 레벨 낮춤)
          // console.log 대신 아무것도 하지 않음 (400 에러는 정상적인 "파일 없음" 응답)
          continue
        }
      }
      
      return null
    } catch (error) {
      console.warn('기존 이미지 확인 실패:', error)
      return null
    }
  }

  /**
   * 이미지 다운로드 (프록시 서버 우선 사용)
   */
  const downloadImage = async (imageUrl) => {
    try {
      console.log(`📥 이미지 다운로드 시작: ${imageUrl}`)
      
      // 1. Vite 프록시를 통한 다운로드 (CORS 문제 해결)
      if (imageUrl.includes('cdn.rebrickable.com')) {
        try {
          // Vite 프록시를 통해 Rebrickable CDN 접근
          const proxyUrl = imageUrl.replace('https://cdn.rebrickable.com', '/api/proxy')
          const proxyResponse = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'image/*',
              'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
            }
          })
          
          if (proxyResponse.ok) {
            const blob = await proxyResponse.blob()
            
            // 이미지 유효성 검사
            if (!blob.type.startsWith('image/')) {
              throw new Error('프록시에서 다운로드된 파일이 이미지가 아님')
            }
            
            // 파일 크기 제한 (10MB)
            if (blob.size > 10 * 1024 * 1024) {
              throw new Error('이미지 파일이 너무 큼 (최대 10MB)')
            }
            
            console.log(`✅ Vite 프록시 다운로드 성공: ${blob.size} bytes`)
            return blob
          } else {
            console.warn(`⚠️ Vite 프록시 다운로드 실패: ${proxyResponse.status}`)
          }
        } catch (proxyError) {
          console.warn(`⚠️ Vite 프록시 서버 오류: ${proxyError.message}`)
        }
      }
      
      // 2. API 프록시 서버를 통한 다운로드 (fallback)
      try {
        const proxyResponse = await fetch(`/api/upload/proxy-image?url=${encodeURIComponent(imageUrl)}`, {
          method: 'GET',
          headers: {
            'Accept': 'image/*',
            'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
          }
        })
        
        if (proxyResponse.ok) {
          const blob = await proxyResponse.blob()
          
          // 이미지 유효성 검사
          if (!blob.type.startsWith('image/')) {
            throw new Error('API 프록시에서 다운로드된 파일이 이미지가 아님')
          }
          
          // 파일 크기 제한 (10MB)
          if (blob.size > 10 * 1024 * 1024) {
            throw new Error('이미지 파일이 너무 큼 (최대 10MB)')
          }
          
          console.log(`✅ API 프록시 다운로드 성공: ${blob.size} bytes`)
          return blob
        } else {
          console.warn(`⚠️ API 프록시 다운로드 실패: ${proxyResponse.status}`)
        }
      } catch (proxyError) {
        console.warn(`⚠️ API 프록시 서버 오류: ${proxyError.message}`)
      }
      
      // 3. 직접 다운로드 시도 (최종 fallback)
      console.log(`🔄 직접 다운로드 시도: ${imageUrl}`)
      const response = await fetch(imageUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
        }
      })
      
      if (!response.ok) {
        throw new Error(`직접 다운로드 실패: ${response.status}`)
      }
      
      const blob = await response.blob()
      
      // 이미지 유효성 검사
      if (!blob.type.startsWith('image/')) {
        throw new Error('다운로드된 파일이 이미지가 아님')
      }
      
      // 파일 크기 제한 (10MB)
      if (blob.size > 10 * 1024 * 1024) {
        throw new Error('이미지 파일이 너무 큼 (최대 10MB)')
      }
      
      console.log(`✅ 직접 다운로드 성공: ${blob.size} bytes`)
      return blob
      
    } catch (error) {
      console.error('이미지 다운로드 실패:', error)
      return null
    }
  }

  /**
   * WebP로 변환
   * ✅ 통일된 품질 설정 사용
   */
  const convertToWebP = async (imageBlob) => {
    // 상수 정의 (useImageManager와 동일)
    const WEBP_QUALITY = 0.90
    const WEBP_MAX_SIZE = 800
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        try {
          // 이미지 크기 조정 (최대 800px)
          let { width, height } = img
          
          if (width > WEBP_MAX_SIZE || height > WEBP_MAX_SIZE) {
            const ratio = Math.min(WEBP_MAX_SIZE / width, WEBP_MAX_SIZE / height)
            width *= ratio
            height *= ratio
          }
          
          canvas.width = width
          canvas.height = height
          
          // 이미지 품질 향상을 위한 설정
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          // 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height)
          
          // WebP로 변환 (통일된 품질 설정)
          canvas.toBlob((blob) => {
            if (blob) {
              console.log(`✅ WebP 변환 완료: ${(blob.size / 1024).toFixed(2)}KB`)
              resolve(blob)
            } else {
              reject(new Error('WebP 변환 실패'))
            }
          }, 'image/webp', WEBP_QUALITY)
        } catch (error) {
          reject(new Error(`WebP 변환 중 오류: ${error.message}`))
        }
      }
      
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = URL.createObjectURL(imageBlob)
    })
  }

  /**
   * Supabase Storage에 업로드 (element_id 지원)
   */
  const uploadToSupabase = async (partNum, colorId, webpBlob, options = {}) => {
    const elementId = options?.elementId || null
    const fileName = elementId ? `${String(elementId)}.webp` : `${partNum}_${colorId}.webp`
    const filePath = `images/${fileName}`
    
    try {
      // upsert=true이므로 선삭제 불필요 → 속도 개선
      
      // 새 파일 업로드
      console.log(`📤 업로드 시도: ${filePath} (크기: ${webpBlob.size} bytes)`)
      const { data, error } = await supabase.storage
        .from('lego_parts_images')
        .upload(filePath, webpBlob, {
          contentType: 'image/webp',
          cacheControl: '3600', // 1시간 캐시
          upsert: true // 덮어쓰기 허용
        })
      
      if (error) {
        console.error(`❌ Supabase 업로드 오류:`, error)
        throw new Error(`업로드 실패: ${error.message}`)
      }
      
      console.log(`📊 업로드 응답:`, { data, error })
      
      console.log(`✅ Supabase Storage 업로드 완료: ${filePath}`)
      
      // 공개 URL 생성
      const { data: urlData } = supabase.storage
        .from('lego_parts_images')
        .getPublicUrl(filePath)
      
      // 업로드 검증은 옵션으로 수행 (속도 개선)
      if (options.verifyUpload) {
        try {
          const head = await fetch(urlData.publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
          if (head.ok) {
            console.log(`✅ 업로드 검증 성공: ${urlData.publicUrl}`)
          } else {
            console.warn(`⚠️ 업로드 검증 실패: ${head.status} - ${urlData.publicUrl}`)
          }
        } catch (verifyError) {
          console.warn(`⚠️ 업로드 검증 스킵(네트워크): ${verifyError.message}`)
        }
      }
      
      return {
        path: filePath,
        url: urlData.publicUrl
      }
    } catch (error) {
      console.error('Supabase Storage 업로드 실패:', error)
      throw error
    }
  }

  /**
   * 데이터베이스에 등록 (element_id 지원)
   */
  const registerInDatabase = async (partNum, colorId, originalUrl, supabaseUrl, elementId = null) => {
    try {
      const fileName = elementId ? `${String(elementId)}.webp` : `${partNum}_${colorId}.webp`
      
      // part_images 테이블에 간단히 삽입 시도 (스키마에 맞게 수정)
      const { error: insertError } = await supabase
        .from('part_images')
        .insert({
          part_id: partNum,
          color_id: colorId,
          original_url: originalUrl,
          uploaded_url: supabaseUrl,
          filename: fileName,
          ...(elementId && { element_id: String(elementId) }),
          image_format: 'webp',
          upload_status: 'completed',
          download_status: 'completed'
        })
      
      if (insertError) {
        // 삽입 실패 시 업데이트 시도 (element_id 우선)
        console.log(`📝 삽입 실패, 업데이트 시도: ${partNum}_${colorId}${elementId ? ` (element_id: ${elementId})` : ''}`)
        
        // element_id 우선 업데이트 시도
        let updated = false
        if (elementId) {
          const { error: elementUpdateError } = await supabase
            .from('part_images')
            .update({
              original_url: originalUrl,
              uploaded_url: supabaseUrl,
              filename: fileName,
              element_id: String(elementId),
              image_format: 'webp',
              upload_status: 'completed',
              download_status: 'completed'
            })
            .eq('element_id', String(elementId))
          
          if (!elementUpdateError) {
            updated = true
            console.log(`✅ 데이터베이스 업데이트 완료 (element_id): ${elementId}`)
          }
        }
        
        // element_id로 업데이트 실패했거나 element_id가 없으면 part_id + color_id로 업데이트
        if (!updated) {
          const { error: updateError } = await supabase
            .from('part_images')
            .update({
              original_url: originalUrl,
              uploaded_url: supabaseUrl,
              filename: fileName,
              ...(elementId && { element_id: String(elementId) }),
              image_format: 'webp',
              upload_status: 'completed',
              download_status: 'completed'
            })
            .eq('part_id', partNum)
            .eq('color_id', colorId)
          
          if (updateError) {
            console.warn('part_images 테이블 등록 실패:', updateError)
          } else {
            console.log(`✅ 데이터베이스 업데이트 완료: ${partNum}_${colorId}`)
          }
        }
      } else {
        console.log(`✅ 데이터베이스 등록 완료: ${partNum}_${colorId}`)
      }
      
      // image_metadata 테이블은 선택적으로만 시도 (element_id 지원)
      try {
        const metadataFileName = elementId ? `${String(elementId)}.webp` : `${partNum}_${colorId}.webp`
        const metadataFilePath = `images/${metadataFileName}`
        
        const { error: metadataError } = await supabase
          .from('image_metadata')
          .insert({
            part_num: partNum,
            color_id: colorId,
            original_url: originalUrl,
            supabase_url: supabaseUrl,
            file_path: metadataFilePath,
            file_name: metadataFileName,
            ...(elementId && { element_id: String(elementId) })
            // created_at은 자동으로 설정됨
          })
        
        if (metadataError) {
          console.log(`📝 image_metadata 삽입 실패, 스킵: ${partNum}_${colorId}${elementId ? ` (element_id: ${elementId})` : ''}`, metadataError)
        } else {
          console.log(`✅ image_metadata 등록 완료: ${partNum}_${colorId}${elementId ? ` (element_id: ${elementId})` : ''}`)
        }
      } catch (metadataError) {
        console.log(`📝 image_metadata 테이블 등록 스킵: ${partNum}_${colorId}${elementId ? ` (element_id: ${elementId})` : ''}`)
        // 실패해도 계속 진행
      }
      
    } catch (error) {
      console.warn('데이터베이스 등록 실패:', error)
      // 실패해도 계속 진행
    }
  }

  /**
   * 배치 마이그레이션 (강화된 버전)
   */
  const batchMigrateImages = async (parts, options = {}) => {
    const concurrency = Math.max(1, Math.min(6, options.concurrency || 4))
    const verifyUpload = options.verifyUpload ?? false
    migrating.value = true
    migrationStats.value = {
      total: parts.length,
      completed: 0,
      failed: 0,
      skipped: 0
    }

    // Rebrickable API 호출을 순차적으로 처리하기 위한 락
    let apiCallLock = Promise.resolve()

    try {
      const results = []
      let index = 0
      const worker = async (workerId) => {
        while (index < parts.length) {
          const i = index++
          const part = parts[i]
          if (!part) break

          if (!part.lego_parts?.part_img_url) {
            results[i] = { part, success: false, reason: 'no_image_url' }
            migrationStats.value.skipped++
            continue
          }

          try {
            console.log(`🔄 [W${workerId}] ${i + 1}/${parts.length} - ${part.lego_parts.part_num}`)
            // element_id 검증 및 정규화
            let elementId = part.element_id || part.lego_parts?.element_id || null
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
            
            console.log(`[AutoMigration] part_num=${part.lego_parts.part_num}, color_id=${part.lego_colors.color_id}, element_id=${elementId || '없음'}`)
            
            // element_id가 있으면 Rebrickable API에서 element_img_url 가져오기
            let imageUrl = part.lego_parts.part_img_url
            let effectiveColorId = part.lego_colors.color_id
            
            if (elementId) {
              try {
                // Rebrickable API 호출을 순차적으로 처리 (rate limit 방지)
                const { getElement } = useRebrickable()
                
                // 락을 사용하여 순차 처리: 이전 API 호출이 완료될 때까지 대기
                apiCallLock = apiCallLock.then(async () => {
                  // API 호출 전 지연 (200ms)
                  await new Promise(r => setTimeout(r, 200))
                  return await getElement(elementId)
                }).catch(err => {
                  console.warn(`⚠️ element_id ${elementId} API 호출 실패:`, err)
                  return null
                })
                
                const elementData = await apiCallLock
                
                if (!elementData) {
                  // API 호출 실패 시 기존 part_img_url 사용
                  console.warn(`⚠️ element_id ${elementId} 이미지 조회 실패, part_img_url 사용`)
                } else {
                  // API 응답의 element_id 확인 (Rebrickable 데이터 불일치 감지)
                  const apiElementId = elementData?.element_id ? String(elementData.element_id) : null
                  if (apiElementId && apiElementId !== String(elementId)) {
                    console.warn(`⚠️ API 응답 불일치: 요청 element_id=${elementId}, API 응답 element_id=${apiElementId}`)
                    console.warn(`⚠️ API 응답의 element_id를 사용합니다: ${apiElementId}`)
                  }
                  
                  // Element ID는 색상 정보를 포함하므로, API에서 가져온 색상 정보를 사용
                  if (elementData?.color?.id) {
                    effectiveColorId = elementData.color.id
                    console.log(`✅ element_id ${apiElementId || elementId}의 실제 색상: ${elementData.color.name} (ID: ${effectiveColorId})`)
                  }
                  
                  if (elementData?.element_img_url) {
                    imageUrl = elementData.element_img_url
                    console.log(`✅ element_id ${apiElementId || elementId} 기반 이미지 URL 획득: ${imageUrl}`)
                    
                    // URL 검증: API 응답의 element_id와 URL의 element_id 비교
                    if (apiElementId && imageUrl.includes('/elements/')) {
                      const urlElementIdMatch = imageUrl.match(/\/elements\/(\d+)\.jpg/)
                      if (urlElementIdMatch) {
                        const urlElementId = urlElementIdMatch[1]
                        if (urlElementId !== apiElementId) {
                          console.warn(`⚠️ Rebrickable 데이터 불일치 감지:`)
                          console.warn(`   - API 응답 element_id: ${apiElementId}`)
                          console.warn(`   - URL의 element_id: ${urlElementId}`)
                          console.warn(`   - URL: ${imageUrl}`)
                          console.warn(`   - 원인: Rebrickable API의 element_img_url 필드가 다른 element_id의 이미지를 가리키고 있습니다.`)
                          console.warn(`   - 조치: API 응답의 element_id(${apiElementId})를 사용하고, URL은 그대로 사용합니다.`)
                        } else {
                          console.log(`✅ URL 검증 성공: API 응답 element_id(${apiElementId})와 URL의 element_id 일치`)
                        }
                      }
                    }
                  } else if (elementData?.part_img_url) {
                    imageUrl = elementData.part_img_url
                    console.log(`⚠️ element_id 이미지 없음, part_img_url 사용`)
                  }
                }
              } catch (elementErr) {
                console.warn(`⚠️ element_id ${elementId} 이미지 조회 실패:`, elementErr)
                // 실패 시 기존 part_img_url 사용
              }
            }
            
            const result = await migratePartImage(
              part.lego_parts.part_num,
              effectiveColorId,
              imageUrl,
              { force: options.force, verifyUpload, elementId }
            )
            results[i] = { part, success: !!result, supabaseUrl: result }
            if (result) migrationStats.value.completed++
            else migrationStats.value.failed++
          } catch (error) {
            console.error(`❌ 마이그레이션 실패: ${part.lego_parts.part_num}`, error)
            results[i] = { part, success: false, reason: error.message }
            migrationStats.value.failed++
          }
          // 가벼운 지연으로 Supabase 급격한 요청 방지
          await new Promise(r => setTimeout(r, 30))
        }
      }

      const workers = Array.from({ length: concurrency }, (_, w) => worker(w + 1))
      await Promise.all(workers)
      
      console.log(`📊 마이그레이션 완료: ${migrationStats.value.completed}개 성공, ${migrationStats.value.failed}개 실패, ${migrationStats.value.skipped}개 스킵`)
      
      return results
    } finally {
      migrating.value = false
    }
  }

  /**
   * 마이그레이션 상태 초기화
   */
  const resetMigrationStats = () => {
    migrationStats.value = {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0
    }
  }

  /**
   * 디버깅용: 특정 부품의 마이그레이션 상태 확인
   */
  const debugMigrationStatus = async (partNum, colorId) => {
    console.log(`🔍 마이그레이션 상태 디버깅: ${partNum}_${colorId}`)
    
    // 1. 캐시 상태 확인
    const cacheKey = `${partNum}_${colorId}`
    console.log(`📝 캐시 상태: ${migrationCache.has(cacheKey) ? '있음' : '없음'}`)
    console.log(`⏳ 진행 중: ${pendingMigrations.has(cacheKey) ? '예' : '아니오'}`)
    
    // 2. Storage 확인
    const existingImage = await checkExistingSupabaseImage(partNum, colorId)
    console.log(`💾 Storage 상태: ${existingImage ? '있음' : '없음'}`)
    if (existingImage) {
      console.log(`🔗 Storage URL: ${existingImage}`)
    }
    
    // 3. 통계 정보
    console.log(`📊 마이그레이션 통계:`, migrationStats.value)
    
    return {
      cached: migrationCache.has(cacheKey),
      pending: pendingMigrations.has(cacheKey),
      inStorage: !!existingImage,
      storageUrl: existingImage,
      stats: migrationStats.value
    }
  }

  /**
   * 수동 마이그레이션 트리거 (모든 부품 이미지 마이그레이션)
   */
  const triggerFullMigration = async (options = {}) => {
    console.log(`🚀 전체 이미지 마이그레이션 시작... ${options.force ? '(강제 재업로드)' : ''}`)
    
    try {
      // 1. 모든 부품 데이터 조회 (외래 키 제약 조건 제거로 인한 관계 인식 문제 해결)
      // 단계별 조회로 문제 해결
      const { data: setParts, error: setPartsError } = await supabase
        .from('set_parts')
        .select('part_id, color_id, element_id')
        // ✅ 제한 제거: 모든 부품 마이그레이션
      
      if (setPartsError) {
        throw new Error(`set_parts 조회 실패: ${setPartsError.message}`)
      }
      
      // part_id 목록 추출
      const partIds = [...new Set(setParts.map(sp => sp.part_id))]
      
      // lego_parts에서 이미지 URL이 있는 부품만 조회
      const { data: legoParts, error: legoPartsError } = await supabase
        .from('lego_parts')
        .select('part_num, part_img_url')
        .in('part_num', partIds)
        .not('part_img_url', 'is', null)
      
      if (legoPartsError) {
        throw new Error(`lego_parts 조회 실패: ${legoPartsError.message}`)
      }
      
      // set_parts와 lego_parts 조합 (element_id 포함)
      const parts = setParts
        .filter(sp => legoParts.some(lp => lp.part_num === sp.part_id))
        .map(sp => {
          const legoPart = legoParts.find(lp => lp.part_num === sp.part_id)
          return {
            part_id: sp.part_id,
            color_id: sp.color_id,
            element_id: sp.element_id || null, // element_id 포함
            lego_parts: legoPart,
            lego_colors: { color_id: sp.color_id }
          }
        })
      
      console.log(`📊 마이그레이션 대상: ${parts.length}개 부품`)
      
      // 2. 배치 마이그레이션 실행 (옵션 전달)
      const results = await batchMigrateImages(parts, options)
      
      console.log(`✅ 전체 마이그레이션 완료: ${results.filter(r => r.success).length}개 성공`)
      
      return results
    } catch (error) {
      console.error('❌ 전체 마이그레이션 실패:', error)
      throw error
    }
  }

  /**
   * 강제 재업로드 (기존 파일 삭제 후 재업로드)
   */
  const forceReuploadAll = async () => {
    console.log(`🔄 강제 재업로드 시작...`)
    
    try {
      // 1. 모든 부품 데이터 조회
      const { data: parts, error } = await supabase
        .from('set_parts')
        .select(`
          lego_parts!inner(part_num, part_img_url),
          lego_colors!inner(color_id)
        `)
        .not('lego_parts.part_img_url', 'is', null)
        .limit(100) // 처음 100개만 테스트
      
      if (error) {
        throw new Error(`부품 데이터 조회 실패: ${error.message}`)
      }
      
      console.log(`📊 강제 재업로드 대상: ${parts.length}개 부품`)
      
      // 2. 강제 재업로드 실행
      const results = await batchMigrateImages(parts, { force: true })
      
      console.log(`✅ 강제 재업로드 완료: ${results.filter(r => r.success).length}개 성공`)
      return results
      
    } catch (error) {
      console.error('강제 재업로드 실패:', error)
      return []
    }
  }

  return {
    migrating,
    migrationQueue,
    migrationStats,
    migratePartImage,
    // 세트 이미지 업로드 (lego_parts_images/lego_sets_images)
    async uploadSetWebP(setNum, originalUrl, webpBlob, options = {}) {
      const fileName = `${setNum}_set.webp`
      const filePath = `lego_sets_images/${fileName}`
      // 업로드
      const { data, error } = await supabase.storage
        .from('lego_parts_images')
        .upload(filePath, webpBlob, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: true
        })
      if (error) throw new Error(error.message)
      const { data: urlData } = supabase.storage
        .from('lego_parts_images')
        .getPublicUrl(filePath)
      // 메타데이터 저장
      await supabase.from('set_images').upsert({
        set_num: setNum,
        original_url: originalUrl,
        supabase_url: urlData.publicUrl,
        file_path: filePath,
        file_name: fileName
      }, { onConflict: 'set_num' })
      return urlData.publicUrl
    },
    batchMigrateImages,
    triggerFullMigration,
    forceReuploadAll,
    resetMigrationStats,
    debugMigrationStatus,
    // 캐시 관리 함수들 추가
    clearCache: () => {
      migrationCache.clear()
      pendingMigrations.clear()
      console.log('🧹 마이그레이션 캐시 초기화')
    },
    getCacheStats: () => ({
      cacheSize: migrationCache.size,
      pendingSize: pendingMigrations.size
    })
  }
}
