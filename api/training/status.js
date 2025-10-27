// 로컬 PC 학습 상태 확인 API
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 로컬 학습 상태 확인
    const fs = require('fs')
    const path = require('path')
    
    const trainingDir = path.join(process.cwd(), 'output', 'training')
    const logDir = path.join(trainingDir, 'logs')
    
    // 최신 로그 파일 찾기
    let latestLogFile = null
    let latestTime = 0
    
    if (fs.existsSync(logDir)) {
      const logFiles = fs.readdirSync(logDir).filter(file => file.startsWith('training_') && file.endsWith('.log'))
      
      for (const file of logFiles) {
        const filePath = path.join(logDir, file)
        const stats = fs.statSync(filePath)
        if (stats.mtime.getTime() > latestTime) {
          latestTime = stats.mtime.getTime()
          latestLogFile = filePath
        }
      }
    }
    
    // 학습 상태 확인
    let isRunning = false
    let isCompleted = false
    let currentEpoch = 0
    let totalEpochs = 100
    let modelPath = null
    
    if (latestLogFile && fs.existsSync(latestLogFile)) {
      const logContent = fs.readFileSync(latestLogFile, 'utf8')
      const lines = logContent.split('\n')
      
      // 최근 로그에서 학습 상태 확인
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]
        
        if (line.includes('학습 완료') || line.includes('training completed')) {
          isCompleted = true
          break
        }
        
        if (line.includes('Epoch') && line.includes('/')) {
          const epochMatch = line.match(/Epoch\s+(\d+)\/(\d+)/)
          if (epochMatch) {
            currentEpoch = parseInt(epochMatch[1])
            totalEpochs = parseInt(epochMatch[2])
            isRunning = true
          }
        }
        
        if (line.includes('모델 저장 위치')) {
          const pathMatch = line.match(/모델 저장 위치:\s*(.+)/)
          if (pathMatch) {
            modelPath = pathMatch[1]
          }
        }
      }
    }
    
    // 모델 파일 확인
    if (isCompleted && !modelPath) {
      const modelsDir = path.join(trainingDir, 'models')
      if (fs.existsSync(modelsDir)) {
        const modelDirs = fs.readdirSync(modelsDir).filter(dir => 
          fs.statSync(path.join(modelsDir, dir)).isDirectory() && 
          dir.startsWith('lego_training_')
        )
        
        if (modelDirs.length > 0) {
          const latestModelDir = modelDirs.sort().pop()
          modelPath = path.join(modelsDir, latestModelDir)
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      isRunning: isRunning,
      isCompleted: isCompleted,
      currentEpoch: currentEpoch,
      totalEpochs: totalEpochs,
      modelPath: modelPath,
      lastChecked: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('학습 상태 확인 실패:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
