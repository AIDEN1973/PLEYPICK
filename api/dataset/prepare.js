// Vercel Serverless Function for Auto Dataset Preparation
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { 
      partIds = [],
      outputDir = 'output/synthetic',
      forceUpdate = false
    } = req.body
    
    console.log('🚀 자동 데이터셋 준비 시작...')
    console.log(`📋 처리할 부품: ${partIds.length > 0 ? partIds.join(', ') : '전체'}`)
    
    // Python 스크립트 실행을 위한 명령어 구성
    const scriptPath = 'scripts/auto_dataset_preparation.py'
    const args = [
      '--output-dir', outputDir
    ]
    
    if (partIds.length > 0) {
      args.push('--parts', ...partIds)
    }
    
    // Vercel에서는 Python 스크립트 직접 실행 불가
    // 대신 클라이언트에서 실행하도록 안내
    return res.status(200).json({
      success: true,
      message: '자동 데이터셋 준비 요청 수신',
      instructions: {
        script: scriptPath,
        args: args,
        command: `python ${scriptPath} ${args.join(' ')}`,
        description: '로컬 환경에서 위 명령어를 실행하여 데이터셋을 준비하세요'
      },
      dataset_structure: {
        'output/synthetic/dataset_synthetic/': {
          'data.yaml': 'YOLO 설정 파일',
          'images/train/': '훈련용 이미지',
          'images/val/': '검증용 이미지 (비어있음)',
          'labels/train/': '훈련용 라벨',
          'labels/val/': '검증용 라벨 (비어있음)',
          'meta/train/': '메타데이터 (JSON 파일들)'
        }
      },
      alternatives: [
        '로컬 개발 환경에서 Python 스크립트 실행',
        '클라우드 서비스 (Google Colab, AWS SageMaker) 사용',
        '전용 서버에서 자동화 스크립트 실행'
      ]
    })
    
  } catch (error) {
    console.error('Dataset preparation error:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
