import express from 'express'

const app = express()
app.use(express.json())

// 간단한 테스트 API
app.get('/api/synthetic/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalParts: 22334,
      renderedImages: 0,
      storageUsed: '0 GB',
      renderingStatus: '대기 중'
    }
  })
})

app.post('/api/synthetic/start-rendering', (req, res) => {
  console.log('🎨 렌더링 요청:', req.body)
  
  // 시뮬레이션 렌더링 결과 생성
  const { partId, imageCount, quality } = req.body
  const results = []
  
  for (let i = 1; i <= imageCount; i++) {
    const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7']
    const colorNames = ['빨강', '파랑', '노랑', '초록', '보라']
    const colorIndex = (i - 1) % 5
    
    // 로컬 이미지 URL 생성
    const imageUrl = `data:image/svg+xml;base64,${Buffer.from(`
      <svg width="640" height="640" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="640" fill="#${colors[colorIndex]}"/>
        <text x="320" y="320" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">
          ${partId}_${i.toString().padStart(3, '0')}
        </text>
      </svg>
    `).toString('base64')}`
    
    results.push({
      id: i,
      partId: partId,
      imageUrl: imageUrl,
      colorName: colorNames[colorIndex],
      angle: `${(i * 72) % 360}°`,
      resolution: '640x640',
      quality: quality
    })
  }
  
  res.json({
    success: true,
    jobId: `job_${Date.now()}`,
    message: '렌더링이 시작되었습니다',
    results: results
  })
})

app.post('/api/synthetic/stop-rendering', (req, res) => {
  res.json({
    success: true,
    message: '렌더링이 중지되었습니다'
  })
})

const PORT = 5003
app.listen(PORT, () => {
  console.log(`🧱 BrickBox 테스트 API 서버가 포트 ${PORT}에서 실행 중입니다`)
})
