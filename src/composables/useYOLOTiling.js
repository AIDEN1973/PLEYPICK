import { ref, reactive } from 'vue'

/**
 * YOLO 타일링 구현 (기술문서 4.2)
 * 밀집 프레임: 2×2 타일링(overlap 15%) 자동 스위치
 */
export function useYOLOTiling() {
  const loading = ref(false)
  const error = ref(null)
  const tilingStats = reactive({
    totalFrames: 0,
    tiledFrames: 0,
    tilingRate: 0,
    avgProcessingTime: 0,
    overlapRatio: 0.15 // 15% 오버랩
  })

  // 타일링 설정
  const tilingConfig = {
    tileSize: 768,           // 기본 타일 크기
    overlapRatio: 0.15,      // 15% 오버랩
    densityThreshold: 0.3,    // 밀집도 임계값
    maxDetectionsPerTile: 50, // 타일당 최대 검출 수
    minTileSize: 512         // 최소 타일 크기
  }

  /**
   * 밀집도 계산
   */
  const calculateDensity = (detections, imageWidth, imageHeight) => {
    if (detections.length === 0) return 0
    
    const totalArea = imageWidth * imageHeight
    const detectionArea = detections.reduce((sum, det) => {
      const bbox = det.boundingBox || det.box
      return sum + (bbox.width * bbox.height * imageWidth * imageHeight)
    }, 0)
    
    return detectionArea / totalArea
  }

  /**
   * 타일링 필요성 판단
   */
  const shouldUseTiling = (detections, imageWidth, imageHeight, options = {}) => {
    const { densityThreshold = tilingConfig.densityThreshold } = options
    
    // 검출 수 기반 판단 (기술문서 4.2)
    if (detections.length > 20) {
      console.log('🔍 밀집 프레임 감지: 검출 수 > 20')
      return true
    }
    
    // 밀집도 기반 판단 (기술문서 4.2)
    const density = calculateDensity(detections, imageWidth, imageHeight)
    if (density > densityThreshold) {
      console.log(`🔍 밀집 프레임 감지: 밀집도 ${density.toFixed(3)} > ${densityThreshold}`)
      return true
    }
    
    // 이미지 크기 기반 판단
    if (imageWidth > 1024 || imageHeight > 1024) return true
    
    return false
  }

  /**
   * 2×2 타일 생성
   */
  const generateTiles = (imageData, options = {}) => {
    const { tileSize = tilingConfig.tileSize, overlapRatio = tilingConfig.overlapRatio } = options
    
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          const tiles = []
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          const { width, height } = img
          const overlap = Math.floor(tileSize * overlapRatio)
          
          // 2×2 타일 생성 (기술문서 4.2)
          for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 2; col++) {
              const x = col * (tileSize - overlap)
              const y = row * (tileSize - overlap)
              
              // 타일 크기 조정 (이미지 경계 고려)
              const actualTileSize = Math.min(tileSize, width - x, height - y)
              if (actualTileSize < tilingConfig.minTileSize) continue
              
              canvas.width = actualTileSize
              canvas.height = actualTileSize
              
              // 타일 영역 그리기 (기술문서 4.2)
              ctx.drawImage(
                img,
                x, y, actualTileSize, actualTileSize,
                0, 0, actualTileSize, actualTileSize
              )
              
              const tileData = {
                id: `tile_${row}_${col}`,
                x, y,
                width: actualTileSize,
                height: actualTileSize,
                imageData: canvas.toDataURL('image/webp', 0.90),
                originalCoords: { x, y, width: actualTileSize, height: actualTileSize }
              }
              
              tiles.push(tileData)
            }
          }
          
          resolve(tiles)
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = reject
      img.src = imageData
    })
  }

  /**
   * 타일별 YOLO 검출 실행
   */
  const detectOnTiles = async (tiles, yoloDetector, options = {}) => {
    const { confThreshold = 0.15, iouThreshold = 0.60 } = options
    const allDetections = []
    
    console.log(`🔍 타일별 YOLO 검출 시작: ${tiles.length}개 타일`)
    
    for (const tile of tiles) {
      try {
        const startTime = performance.now()
        
        // YOLO 검출 실행
        const detections = await yoloDetector.detect(tile.imageData, {
          confThreshold,
          iouThreshold,
          maxDetections: tilingConfig.maxDetectionsPerTile
        })
        
        const processingTime = performance.now() - startTime
        
        // 좌표를 원본 이미지 좌표로 변환
        const transformedDetections = detections.map(det => ({
          ...det,
          boundingBox: transformCoordinates(det.boundingBox, tile.originalCoords),
          tileId: tile.id,
          processingTime
        }))
        
        allDetections.push(...transformedDetections)
        
        console.log(`🔍 타일 ${tile.id} 검출 완료: ${detections.length}개 (${processingTime.toFixed(2)}ms)`)
        
      } catch (err) {
        console.error(`❌ 타일 ${tile.id} 검출 실패:`, err)
      }
    }
    
    return allDetections
  }

  /**
   * 좌표 변환 (타일 → 원본 이미지)
   */
  const transformCoordinates = (bbox, tileCoords) => {
    return {
      x: bbox.x + tileCoords.x,
      y: bbox.y + tileCoords.y,
      width: bbox.width,
      height: bbox.height
    }
  }

  /**
   * 중복 검출 제거 (IoU 기반)
   */
  const removeDuplicateDetections = (detections, iouThreshold = 0.5) => {
    if (detections.length === 0) return []
    
    // 신뢰도 순으로 정렬
    const sortedDetections = detections.sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    )
    
    const filtered = []
    const used = new Set()
    
    for (let i = 0; i < sortedDetections.length; i++) {
      if (used.has(i)) continue
      
      const current = sortedDetections[i]
      filtered.push(current)
      
      // IoU 계산하여 중복 제거
      for (let j = i + 1; j < sortedDetections.length; j++) {
        if (used.has(j)) continue
        
        const other = sortedDetections[j]
        const iou = calculateIoU(current.boundingBox, other.boundingBox)
        
        if (iou > iouThreshold) {
          used.add(j)
        }
      }
    }
    
    console.log(`🔍 중복 제거: ${detections.length} → ${filtered.length}개`)
    return filtered
  }

  /**
   * IoU 계산
   */
  const calculateIoU = (bbox1, bbox2) => {
    const x1 = Math.max(bbox1.x, bbox2.x)
    const y1 = Math.max(bbox1.y, bbox2.y)
    const x2 = Math.min(bbox1.x + bbox1.width, bbox2.x + bbox2.width)
    const y2 = Math.min(bbox1.y + bbox1.height, bbox2.y + bbox2.height)
    
    if (x2 <= x1 || y2 <= y1) return 0
    
    const intersection = (x2 - x1) * (y2 - y1)
    const area1 = bbox1.width * bbox1.height
    const area2 = bbox2.width * bbox2.height
    const union = area1 + area2 - intersection
    
    return intersection / union
  }

  /**
   * 통합 타일링 파이프라인
   */
  const processWithTiling = async (imageData, yoloDetector, options = {}) => {
    const startTime = performance.now()
    
    try {
      loading.value = true
      error.value = null
      
      // 1. 밀집도 계산
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageData
      })
      
      // 2. 타일링 필요성 판단
      const needsTiling = shouldUseTiling([], img.width, img.height, options)
      
      if (!needsTiling) {
        console.log('🔍 타일링 불필요, 일반 검출 실행')
        const detections = await yoloDetector.detect(imageData, options)
        return { detections, usedTiling: false }
      }
      
      console.log('🔍 타일링 필요, 2×2 타일 생성')
      
      // 3. 타일 생성
      const tiles = await generateTiles(imageData, options)
      
      // 4. 타일별 검출
      const tileDetections = await detectOnTiles(tiles, yoloDetector, options)
      
      // 5. 중복 제거
      const finalDetections = removeDuplicateDetections(tileDetections, options.iouThreshold)
      
      const processingTime = performance.now() - startTime
      
      // 통계 업데이트
      tilingStats.totalFrames++
      tilingStats.tiledFrames++
      tilingStats.tilingRate = (tilingStats.tiledFrames / tilingStats.totalFrames) * 100
      tilingStats.avgProcessingTime = (tilingStats.avgProcessingTime + processingTime) / 2
      
      console.log(`✅ 타일링 검출 완료: ${finalDetections.length}개 (${processingTime.toFixed(2)}ms)`)
      
      return {
        detections: finalDetections,
        usedTiling: true,
        tiles: tiles.length,
        processingTime
      }
      
    } catch (err) {
      error.value = err.message
      console.error('❌ 타일링 처리 실패:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 통계 조회
   */
  const getTilingStats = () => {
    return {
      ...tilingStats,
      config: tilingConfig
    }
  }

  /**
   * 통계 리셋
   */
  const resetStats = () => {
    tilingStats.totalFrames = 0
    tilingStats.tiledFrames = 0
    tilingStats.tilingRate = 0
    tilingStats.avgProcessingTime = 0
  }

  return {
    loading,
    error,
    tilingStats,
    shouldUseTiling,
    generateTiles,
    processWithTiling,
    getTilingStats,
    resetStats
  }
}
