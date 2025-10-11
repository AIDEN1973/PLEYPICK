import { ref } from 'vue'
import { supabase } from './useSupabase'

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

  /**
   * 부품 이미지 자동 마이그레이션
   */
  const migratePartImage = async (partNum, colorId, originalUrl) => {
    try {
      console.log(`🔄 자동 마이그레이션 시작: ${partNum} (색상: ${colorId})`)
      
      // 1. 이미 Supabase Storage에 있는지 확인
      const existingImage = await checkExistingSupabaseImage(partNum, colorId)
      if (existingImage) {
        console.log(`✅ 이미 Supabase Storage에 존재: ${partNum}`)
        migrationStats.value.skipped++
        return existingImage
      }

      // 2. 이미지 다운로드
      const imageBlob = await downloadImage(originalUrl)
      if (!imageBlob) {
        throw new Error('이미지 다운로드 실패')
      }

      // 3. WebP로 변환
      const webpBlob = await convertToWebP(imageBlob)
      
      // 4. Supabase Storage에 업로드
      const uploadResult = await uploadToSupabase(partNum, colorId, webpBlob)
      
      // 5. 데이터베이스에 등록
      await registerInDatabase(partNum, colorId, originalUrl, uploadResult.url)
      
      console.log(`✅ 마이그레이션 완료: ${partNum}`)
      migrationStats.value.completed++
      
      return uploadResult.url
      
    } catch (error) {
      console.error(`❌ 마이그레이션 실패: ${partNum}`, error)
      migrationStats.value.failed++
      return null
    }
  }

  /**
   * 기존 Supabase Storage 이미지 확인
   */
  const checkExistingSupabaseImage = async (partNum, colorId) => {
    try {
      // part_images 테이블에서 확인
      const { data: partImage } = await supabase
        .from('part_images')
        .select('uploaded_url')
        .eq('part_id', partNum)
        .eq('color_id', colorId)
        .not('uploaded_url', 'is', null)
        .maybeSingle()

      if (partImage?.uploaded_url) {
        return partImage.uploaded_url
      }

      // image_metadata 테이블에서 확인
      const { data: metadata } = await supabase
        .from('image_metadata')
        .select('supabase_url')
        .eq('part_num', partNum)
        .eq('color_id', colorId)
        .not('supabase_url', 'is', null)
        .maybeSingle()

      return metadata?.supabase_url || null
    } catch (error) {
      console.warn('기존 이미지 확인 실패:', error)
      return null
    }
  }

  /**
   * 이미지 다운로드
   */
  const downloadImage = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl, {
        mode: 'cors',
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 (compatible; BrickBox/1.0)'
        }
      })
      
      if (!response.ok) {
        throw new Error(`다운로드 실패: ${response.status}`)
      }
      
      return await response.blob()
    } catch (error) {
      console.error('이미지 다운로드 실패:', error)
      return null
    }
  }

  /**
   * WebP로 변환
   */
  const convertToWebP = async (imageBlob) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // 이미지 크기 조정 (최대 800px)
        const maxSize = 800
        let { width, height } = img
        
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width *= ratio
          height *= ratio
        }
        
        canvas.width = width
        canvas.height = height
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height)
        
        // WebP로 변환 (기술문서 권장: q=90)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('WebP 변환 실패'))
          }
        }, 'image/webp', 0.90)
      }
      
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = URL.createObjectURL(imageBlob)
    })
  }

  /**
   * Supabase Storage에 업로드
   */
  const uploadToSupabase = async (partNum, colorId, webpBlob) => {
    const fileName = `${partNum}_${colorId}.webp`
    const filePath = `images/${fileName}`
    
    // 기존 파일 삭제
    try {
      await supabase.storage.from('lego_parts_images').remove([filePath])
    } catch (error) {
      // 파일이 없어도 무시
    }
    
    // 새 파일 업로드
    const { data, error } = await supabase.storage
      .from('lego_parts_images')
      .upload(filePath, webpBlob, {
        contentType: 'image/webp'
      })
    
    if (error) {
      throw new Error(`업로드 실패: ${error.message}`)
    }
    
    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('lego_parts_images')
      .getPublicUrl(filePath)
    
    return {
      path: filePath,
      url: urlData.publicUrl
    }
  }

  /**
   * 데이터베이스에 등록
   */
  const registerInDatabase = async (partNum, colorId, originalUrl, supabaseUrl) => {
    try {
      // part_images 테이블에 등록
      await supabase.table('part_images').insert({
        part_id: partNum,
        color_id: colorId,
        original_url: originalUrl,
        uploaded_url: supabaseUrl,
        filename: `${partNum}_${colorId}.webp`,
        upload_status: 'completed'
      })
    } catch (error) {
      console.warn('데이터베이스 등록 실패:', error)
      // 실패해도 계속 진행
    }
  }

  /**
   * 배치 마이그레이션
   */
  const batchMigrateImages = async (parts) => {
    migrating.value = true
    migrationStats.value = {
      total: parts.length,
      completed: 0,
      failed: 0,
      skipped: 0
    }

    try {
      const migrationPromises = parts.map(async (part) => {
        if (!part.lego_parts?.part_img_url) {
          return { part, success: false, reason: 'no_image_url' }
        }

        const result = await migratePartImage(
          part.lego_parts.part_num,
          part.lego_colors.color_id,
          part.lego_parts.part_img_url
        )

        return {
          part,
          success: !!result,
          supabaseUrl: result
        }
      })

      const results = await Promise.all(migrationPromises)
      
      console.log(`📊 마이그레이션 완료: ${migrationStats.value.completed}개 성공, ${migrationStats.value.failed}개 실패`)
      
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

  return {
    migrating,
    migrationQueue,
    migrationStats,
    migratePartImage,
    batchMigrateImages,
    resetMigrationStats
  }
}
