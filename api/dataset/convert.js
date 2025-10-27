// Vercel Serverless Function for Dataset Conversion
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { 
      sourcePath, 
      targetPath, 
      format, 
      conversionType = 'all',
      selectedParts = [],
      selectedSets = []
    } = req.body
    
    // 변환 타입에 따른 메시지 생성
    const conversionTypeMessages = {
      'all': '전체 데이터셋',
      'parts': '부품단위 데이터셋',
      'sets': '세트단위 데이터셋'
    }
    
    const selectedType = conversionTypeMessages[conversionType] || '전체 데이터셋'
    
    // 선택된 아이템 정보 로깅
    if (conversionType === 'parts' && selectedParts.length > 0) {
      console.log(`Selected parts for conversion:`, selectedParts)
    } else if (conversionType === 'sets' && selectedSets.length > 0) {
      console.log(`Selected sets for conversion:`, selectedSets)
    }
    
    // Vercel에서는 Python 스크립트 실행 불가
    // 대신 클라우드 서비스 연동 필요
    return res.status(501).json({
      success: false,
      error: 'Dataset conversion not available in production',
      message: `Please use the local development environment for ${selectedType} conversion`,
      conversionType: conversionType,
      selectedItems: {
        parts: selectedParts,
        sets: selectedSets
      },
      alternatives: [
        'Use local development environment',
        'Use cloud-based ML services (Google Colab, AWS SageMaker)',
        'Use dedicated server for heavy processing'
      ]
    })
    
  } catch (error) {
    console.error('Dataset conversion error:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
