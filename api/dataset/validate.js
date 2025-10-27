// 렌더링 데이터 검증 API
import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { partIds = [] } = req.body
    
    const validationResults = {
      success: true,
      stats: {
        totalParts: 0,
        validParts: 0,
        invalidParts: 0,
        totalImages: 0,
        totalLabels: 0,
        totalMetadata: 0
      },
      errors: [],
      warnings: [],
      partDetails: []
    }

    // 렌더링된 데이터 디렉토리 확인
    const syntheticDir = path.join(process.cwd(), 'output', 'synthetic')
    
    if (!fs.existsSync(syntheticDir)) {
      validationResults.errors.push('렌더링 데이터 디렉토리가 존재하지 않습니다')
      validationResults.success = false
      return res.status(200).json(validationResults)
    }

    // 부품별 검증
    const partDirs = fs.readdirSync(syntheticDir).filter(dir => {
      const fullPath = path.join(syntheticDir, dir)
      return fs.statSync(fullPath).isDirectory() && 
             !dir.startsWith('.') && 
             !dir.includes('dataset_synthetic')
    })

    validationResults.stats.totalParts = partDirs.length

    for (const partDir of partDirs) {
      const partPath = path.join(syntheticDir, partDir)
      const partValidation = await validatePartData(partPath, partDir)
      
      validationResults.partDetails.push(partValidation)
      
      if (partValidation.isValid) {
        validationResults.stats.validParts++
        validationResults.stats.totalImages += partValidation.imageCount
        validationResults.stats.totalLabels += partValidation.labelCount
        validationResults.stats.totalMetadata += partValidation.metadataCount
      } else {
        validationResults.stats.invalidParts++
        validationResults.errors.push(...partValidation.errors)
      }
      
      if (partValidation.warnings.length > 0) {
        validationResults.warnings.push(...partValidation.warnings)
      }
    }

    // 전체 데이터 품질 검사
    if (validationResults.stats.totalImages === 0) {
      validationResults.errors.push('렌더링된 이미지가 없습니다')
      validationResults.success = false
    }

    if (validationResults.stats.totalLabels === 0) {
      validationResults.errors.push('라벨 파일이 없습니다')
      validationResults.success = false
    }

    // 최소 데이터 요구사항 확인
    if (validationResults.stats.validParts < 1) {
      validationResults.errors.push('유효한 부품 데이터가 없습니다')
      validationResults.success = false
    }

    if (validationResults.stats.totalImages < 10) {
      validationResults.warnings.push('이미지 개수가 적습니다 (최소 10개 권장)')
    }

    return res.status(200).json(validationResults)

  } catch (error) {
    console.error('데이터 검증 실패:', error)
    return res.status(500).json({
      success: false,
      error: error.message,
      stats: { totalParts: 0, validParts: 0, invalidParts: 0, totalImages: 0, totalLabels: 0 },
      errors: [`검증 과정 오류: ${error.message}`],
      warnings: []
    })
  }
}

// 개별 부품 데이터 검증
async function validatePartData(partPath, partId) {
  const validation = {
    partId,
    isValid: true,
    imageCount: 0,
    labelCount: 0,
    metadataCount: 0,
    errors: [],
    warnings: []
  }

  try {
    // 이미지 파일 확인
    const imageExtensions = ['.webp', '.jpg', '.jpeg', '.png']
    const imageFiles = []
    
    for (const ext of imageExtensions) {
      const files = fs.readdirSync(partPath).filter(file => 
        file.toLowerCase().endsWith(ext)
      )
      imageFiles.push(...files)
    }
    
    validation.imageCount = imageFiles.length

    if (imageFiles.length === 0) {
      validation.errors.push(`부품 ${partId}: 이미지 파일이 없습니다`)
      validation.isValid = false
    }

    // 라벨 파일 확인
    const labelFiles = fs.readdirSync(partPath).filter(file => 
      file.toLowerCase().endsWith('.txt')
    )
    validation.labelCount = labelFiles.length

    if (labelFiles.length === 0) {
      validation.errors.push(`부품 ${partId}: 라벨 파일이 없습니다`)
      validation.isValid = false
    }

    // 메타데이터 파일 확인
    const metadataFiles = fs.readdirSync(partPath).filter(file => 
      file.toLowerCase().endsWith('.json')
    )
    validation.metadataCount = metadataFiles.length

    // 이미지와 라벨 개수 일치 확인
    if (imageFiles.length !== labelFiles.length) {
      validation.warnings.push(`부품 ${partId}: 이미지(${imageFiles.length})와 라벨(${labelFiles.length}) 개수가 일치하지 않습니다`)
    }

    // 라벨 파일 내용 검증
    for (const labelFile of labelFiles) {
      const labelPath = path.join(partPath, labelFile)
      try {
        const labelContent = fs.readFileSync(labelPath, 'utf8').trim()
        
        if (labelContent.length === 0) {
          validation.warnings.push(`부품 ${partId}: 라벨 파일 ${labelFile}이 비어있습니다`)
        } else {
          // YOLO 형식 검증 (클래스ID x y w h)
          const lines = labelContent.split('\n').filter(line => line.trim())
          for (const line of lines) {
            const parts = line.trim().split(' ')
            if (parts.length !== 5) {
              validation.errors.push(`부품 ${partId}: 라벨 파일 ${labelFile} 형식 오류 (${line})`)
              validation.isValid = false
            }
          }
        }
      } catch (error) {
        validation.errors.push(`부품 ${partId}: 라벨 파일 ${labelFile} 읽기 실패`)
        validation.isValid = false
      }
    }

    // 메타데이터 파일 검증
    for (const metadataFile of metadataFiles) {
      const metadataPath = path.join(partPath, metadataFile)
      try {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8')
        JSON.parse(metadataContent) // JSON 형식 검증
      } catch (error) {
        validation.warnings.push(`부품 ${partId}: 메타데이터 파일 ${metadataFile} 형식 오류`)
      }
    }

  } catch (error) {
    validation.errors.push(`부품 ${partId}: 데이터 검증 실패 - ${error.message}`)
    validation.isValid = false
  }

  return validation
}
