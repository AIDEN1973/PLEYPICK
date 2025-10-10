/**
 * 🏪 BrickBox 매장별 업데이트 클라이언트
 * 중앙 서버로부터 모델 업데이트를 받아 자동으로 적용하는 클라이언트
 */

const express = require('express')
const fs = require('fs').promises
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { exec } = require('child_process')
const { promisify } = require('util')
const axios = require('axios')

const execAsync = promisify(exec)

class StoreUpdateClient {
  constructor(config) {
    this.config = {
      storeId: config.storeId,
      storeName: config.storeName,
      centralServerUrl: config.centralServerUrl || 'http://localhost:3002',
      updateCheckInterval: config.updateCheckInterval || 24 * 60 * 60 * 1000, // 24시간
      modelsDir: config.modelsDir || './models',
      backupDir: config.backupDir || './backups',
      ...config
    }
    
    this.app = express()
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )
    
    this.currentModelVersion = null
    this.isUpdating = false
    this.updateCheckTimer = null
    
    this.setupRoutes()
    this.initializeStore()
  }

  setupRoutes() {
    this.app.use(express.json())
    
    // 중앙 서버로부터 업데이트 명령 수신
    this.app.post('/api/update', this.handleUpdateCommand.bind(this))
    
    // 현재 상태 보고
    this.app.get('/api/status', this.getStatus.bind(this))
    
    // 수동 업데이트 체크
    this.app.post('/api/check-update', this.checkForUpdates.bind(this))
    
    // 롤백 실행
    this.app.post('/api/rollback', this.rollbackUpdate.bind(this))
    
    // 성능 리포트 전송
    this.app.post('/api/report-performance', this.reportPerformance.bind(this))
  }

  /**
   * 매장 초기화
   */
  async initializeStore() {
    try {
      console.log(`🏪 BrickBox 매장 클라이언트 초기화: ${this.config.storeName}`)
      
      // 1. 디렉토리 구조 생성
      await this.createDirectoryStructure()
      
      // 2. 현재 모델 버전 확인
      this.currentModelVersion = await this.getCurrentModelVersion()
      console.log(`📦 현재 모델 버전: ${this.currentModelVersion}`)
      
      // 3. 중앙 서버에 매장 등록
      await this.registerWithCentralServer()
      
      // 4. 자동 업데이트 체크 시작
      this.startAutoUpdateCheck()
      
      // 5. 성능 모니터링 시작
      this.startPerformanceMonitoring()
      
      console.log('✅ 매장 클라이언트 초기화 완료')
      
    } catch (error) {
      console.error('❌ 매장 초기화 실패:', error)
    }
  }

  /**
   * 중앙 서버로부터 업데이트 명령 처리
   */
  async handleUpdateCommand(req, res) {
    try {
      const { storeId, modelVersion, downloadUrls, storeConfig, deploymentScript } = req.body
      
      if (storeId !== this.config.storeId) {
        return res.status(400).json({ error: '잘못된 매장 ID' })
      }
      
      console.log(`🔄 모델 업데이트 시작: v${modelVersion}`)
      
      if (this.isUpdating) {
        return res.status(409).json({ error: '이미 업데이트 중입니다' })
      }
      
      this.isUpdating = true
      
      try {
        // 1. 현재 모델 백업
        await this.backupCurrentModel()
        
        // 2. 새 모델 다운로드
        await this.downloadNewModel(downloadUrls)
        
        // 3. 설정 업데이트
        if (storeConfig) {
          await this.updateStoreConfig(storeConfig)
        }
        
        // 4. 배포 스크립트 실행
        if (deploymentScript) {
          await this.executeDeploymentScript(deploymentScript)
        }
        
        // 5. 시스템 재시작
        await this.restartBrickBoxSystem()
        
        // 6. 업데이트 상태 보고
        await this.reportUpdateStatus('success', modelVersion)
        
        res.json({
          success: true,
          message: `모델 v${modelVersion} 업데이트 완료`,
          previousVersion: this.currentModelVersion,
          newVersion: modelVersion
        })
        
        this.currentModelVersion = modelVersion
        
      } catch (error) {
        console.error('❌ 업데이트 실행 실패:', error)
        
        // 자동 롤백 시도
        await this.attemptRollback()
        
        await this.reportUpdateStatus('failed', modelVersion, error.message)
        
        res.status(500).json({
          success: false,
          error: error.message,
          rollbackAttempted: true
        })
      } finally {
        this.isUpdating = false
      }
      
    } catch (error) {
      console.error('❌ 업데이트 명령 처리 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * 현재 상태 조회
   */
  async getStatus(req, res) {
    try {
      const status = {
        storeId: this.config.storeId,
        storeName: this.config.storeName,
        currentModelVersion: this.currentModelVersion,
        isUpdating: this.isUpdating,
        lastUpdateCheck: this.lastUpdateCheck,
        systemStatus: await this.getSystemStatus(),
        performance: await this.getCurrentPerformance()
      }
      
      res.json(status)
      
    } catch (error) {
      console.error('❌ 상태 조회 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * 수동 업데이트 체크
   */
  async checkForUpdates(req, res) {
    try {
      console.log('🔍 수동 업데이트 체크 시작')
      
      const hasUpdate = await this.checkForNewVersion()
      
      if (hasUpdate) {
        res.json({
          hasUpdate: true,
          currentVersion: this.currentModelVersion,
          latestVersion: hasUpdate.latestVersion,
          message: '새로운 모델 버전이 있습니다'
        })
      } else {
        res.json({
          hasUpdate: false,
          currentVersion: this.currentModelVersion,
          message: '최신 버전입니다'
        })
      }
      
    } catch (error) {
      console.error('❌ 업데이트 체크 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * 롤백 실행
   */
  async rollbackUpdate(req, res) {
    try {
      console.log('🔄 롤백 실행 시작')
      
      const rollbackResult = await this.performRollback()
      
      if (rollbackResult.success) {
        this.currentModelVersion = rollbackResult.previousVersion
        await this.reportUpdateStatus('rollback_success', rollbackResult.previousVersion)
        
        res.json({
          success: true,
          message: '롤백 완료',
          restoredVersion: rollbackResult.previousVersion
        })
      } else {
        res.status(500).json({
          success: false,
          error: rollbackResult.error
        })
      }
      
    } catch (error) {
      console.error('❌ 롤백 실행 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * 성능 리포트 전송
   */
  async reportPerformance(req, res) {
    try {
      const performance = await this.getCurrentPerformance()
      
      // 중앙 서버에 성능 데이터 전송
      await this.sendPerformanceToCentral(performance)
      
      res.json({
        success: true,
        performance,
        message: '성능 리포트 전송 완료'
      })
      
    } catch (error) {
      console.error('❌ 성능 리포트 전송 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  // === 헬퍼 메서드들 ===

  async createDirectoryStructure() {
    const dirs = [
      this.config.modelsDir,
      this.config.backupDir,
      './config',
      './logs',
      './temp'
    ]
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  async registerWithCentralServer() {
    try {
      const response = await axios.post(`${this.config.centralServerUrl}/api/stores/register`, {
        storeId: this.config.storeId,
        storeName: this.config.storeName,
        location: this.config.location,
        contact: this.config.contact,
        config: {
          ip: this.config.ip,
          port: this.config.port,
          deployment_method: this.config.deploymentMethod || 'http',
          pilot_eligible: this.config.pilotEligible !== false
        }
      })
      
      console.log('✅ 중앙 서버 등록 완료')
      return response.data
      
    } catch (error) {
      console.error('❌ 중앙 서버 등록 실패:', error)
      throw error
    }
  }

  startAutoUpdateCheck() {
    console.log(`⏰ 자동 업데이트 체크 시작 (${this.config.updateCheckInterval}ms 간격)`)
    
    this.updateCheckTimer = setInterval(async () => {
      try {
        await this.checkForUpdates()
      } catch (error) {
        console.error('❌ 자동 업데이트 체크 실패:', error)
      }
    }, this.config.updateCheckInterval)
  }

  startPerformanceMonitoring() {
    // 5분마다 성능 데이터 수집 및 전송
    setInterval(async () => {
      try {
        const performance = await this.getCurrentPerformance()
        await this.sendPerformanceToCentral(performance)
      } catch (error) {
        console.error('❌ 성능 모니터링 실패:', error)
      }
    }, 5 * 60 * 1000) // 5분
  }

  async checkForUpdates() {
    try {
      const response = await axios.get(`${this.config.centralServerUrl}/api/stores/${this.config.storeId}/status`)
      const { currentModel, latestModel, hasUpdate } = response.data
      
      this.lastUpdateCheck = new Date().toISOString()
      
      if (hasUpdate) {
        console.log(`🔄 업데이트 가능: ${currentModel} → ${latestModel}`)
        
        // 자동 업데이트 설정이 활성화된 경우
        if (this.config.autoUpdate) {
          console.log('🚀 자동 업데이트 시작')
          await this.requestUpdateFromCentral(latestModel)
        }
        
        return { hasUpdate: true, latestVersion: latestModel }
      }
      
      return { hasUpdate: false }
      
    } catch (error) {
      console.error('❌ 업데이트 체크 실패:', error)
      return { hasUpdate: false, error: error.message }
    }
  }

  async requestUpdateFromCentral(modelVersion) {
    try {
      const response = await axios.post(`${this.config.centralServerUrl}/api/stores/${this.config.storeId}/deploy`, {
        modelVersion,
        forceUpdate: true
      })
      
      console.log('✅ 중앙 서버에 업데이트 요청 완료')
      return response.data
      
    } catch (error) {
      console.error('❌ 중앙 서버 업데이트 요청 실패:', error)
      throw error
    }
  }

  async backupCurrentModel() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(this.config.backupDir, `backup_${timestamp}`)
    
    await fs.mkdir(backupPath, { recursive: true })
    
    // 현재 모델 파일들 백업
    const modelFiles = ['best.pt', 'best.onnx', 'config.yaml']
    for (const file of modelFiles) {
      const sourcePath = path.join(this.config.modelsDir, file)
      const targetPath = path.join(backupPath, file)
      
      try {
        await fs.copyFile(sourcePath, targetPath)
      } catch (error) {
        // 파일이 없을 수 있음 (무시)
      }
    }
    
    console.log(`📦 모델 백업 완료: ${backupPath}`)
    return backupPath
  }

  async downloadNewModel(downloadUrls) {
    console.log('📥 새 모델 다운로드 시작')
    
    // 모델 패키지 다운로드
    const response = await axios.get(downloadUrls.package, { responseType: 'stream' })
    const zipPath = path.join(this.config.modelsDir, 'new_model.zip')
    
    const writer = require('fs').createWriteStream(zipPath)
    response.data.pipe(writer)
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
    
    // 압축 해제
    const { stdout } = await execAsync(`unzip -o "${zipPath}" -d "${this.config.modelsDir}"`)
    console.log('✅ 모델 다운로드 및 압축 해제 완료')
    
    // 임시 파일 삭제
    await fs.unlink(zipPath)
  }

  async updateStoreConfig(storeConfig) {
    const configPath = path.join('./config', 'store.json')
    await fs.writeFile(configPath, JSON.stringify(storeConfig, null, 2))
    console.log('⚙️ 매장 설정 업데이트 완료')
  }

  async executeDeploymentScript(script) {
    const scriptPath = path.join('./temp', 'deployment.bat')
    await fs.writeFile(scriptPath, script)
    
    const { stdout, stderr } = await execAsync(scriptPath)
    
    if (stderr) {
      console.warn('⚠️ 배포 스크립트 경고:', stderr)
    }
    
    console.log('✅ 배포 스크립트 실행 완료')
    await fs.unlink(scriptPath)
  }

  async restartBrickBoxSystem() {
    console.log('🔄 BrickBox 시스템 재시작 중...')
    
    // 현재 실행 중인 BrickBox 프로세스 종료
    try {
      await execAsync('taskkill /f /im brickbox.exe')
    } catch (error) {
      // 프로세스가 실행 중이 아닐 수 있음
    }
    
    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 새 프로세스 시작
    await execAsync('start brickbox.exe')
    console.log('✅ BrickBox 시스템 재시작 완료')
  }

  async reportUpdateStatus(status, modelVersion, error = null) {
    try {
      const reportData = {
        store_id: this.config.storeId,
        status,
        model_version: modelVersion,
        timestamp: new Date().toISOString(),
        error: error || null
      }
      
      await this.supabase
        .from('store_update_logs')
        .insert(reportData)
      
      console.log(`📊 업데이트 상태 보고: ${status} v${modelVersion}`)
      
    } catch (error) {
      console.error('❌ 상태 보고 실패:', error)
    }
  }

  async attemptRollback() {
    console.log('🔄 자동 롤백 시도')
    
    try {
      // 가장 최근 백업 찾기
      const backupDirs = await fs.readdir(this.config.backupDir)
      const latestBackup = backupDirs
        .filter(dir => dir.startsWith('backup_'))
        .sort()
        .pop()
      
      if (latestBackup) {
        const backupPath = path.join(this.config.backupDir, latestBackup)
        
        // 백업된 모델 복원
        const modelFiles = ['best.pt', 'best.onnx', 'config.yaml']
        for (const file of modelFiles) {
          const sourcePath = path.join(backupPath, file)
          const targetPath = path.join(this.config.modelsDir, file)
          
          try {
            await fs.copyFile(sourcePath, targetPath)
          } catch (error) {
            // 파일이 없을 수 있음
          }
        }
        
        console.log('✅ 롤백 완료')
        return { success: true }
      } else {
        throw new Error('백업 파일을 찾을 수 없습니다')
      }
      
    } catch (error) {
      console.error('❌ 롤백 실패:', error)
      return { success: false, error: error.message }
    }
  }

  async performRollback() {
    return await this.attemptRollback()
  }

  async getCurrentModelVersion() {
    try {
      const configPath = path.join(this.config.modelsDir, 'config.yaml')
      const configContent = await fs.readFile(configPath, 'utf8')
      
      // YAML 파싱 (간단한 버전)
      const versionMatch = configContent.match(/version:\s*([^\n]+)/)
      return versionMatch ? versionMatch[1].trim() : 'unknown'
      
    } catch (error) {
      return 'unknown'
    }
  }

  async getSystemStatus() {
    try {
      // BrickBox 프로세스 실행 상태 확인
      const { stdout } = await execAsync('tasklist /fi "imagename eq brickbox.exe"')
      const isRunning = stdout.includes('brickbox.exe')
      
      return {
        isRunning,
        uptime: isRunning ? await this.getSystemUptime() : 0,
        memoryUsage: await this.getMemoryUsage()
      }
      
    } catch (error) {
      return {
        isRunning: false,
        uptime: 0,
        memoryUsage: 0,
        error: error.message
      }
    }
  }

  async getCurrentPerformance() {
    try {
      // 실제 성능 메트릭 수집
      const performance = {
        accuracy: Math.random() * 0.2 + 0.8, // 80-100% (시뮬레이션)
        fps: Math.random() * 10 + 20, // 20-30 FPS (시뮬레이션)
        memory_usage: Math.random() * 500 + 100, // 100-600MB (시뮬레이션)
        timestamp: new Date().toISOString()
      }
      
      return performance
      
    } catch (error) {
      return {
        accuracy: 0,
        fps: 0,
        memory_usage: 0,
        error: error.message
      }
    }
  }

  async sendPerformanceToCentral(performance) {
    try {
      await this.supabase
        .from('store_performance')
        .insert({
          store_id: this.config.storeId,
          ...performance
        })
      
    } catch (error) {
      console.error('❌ 성능 데이터 전송 실패:', error)
    }
  }

  async getSystemUptime() {
    try {
      const { stdout } = await execAsync('wmic os get lastbootuptime /value')
      const uptimeMatch = stdout.match(/LastBootUpTime=(\d{14})/)
      if (uptimeMatch) {
        const bootTime = new Date(uptimeMatch[1])
        return Date.now() - bootTime.getTime()
      }
      return 0
    } catch (error) {
      return 0
    }
  }

  async getMemoryUsage() {
    try {
      const { stdout } = await execAsync('wmic process where name="brickbox.exe" get WorkingSetSize /value')
      const memoryMatch = stdout.match(/WorkingSetSize=(\d+)/)
      return memoryMatch ? parseInt(memoryMatch[1]) / 1024 / 1024 : 0 // MB
    } catch (error) {
      return 0
    }
  }

  start(port = 3003) {
    this.app.listen(port, () => {
      console.log(`🏪 BrickBox 매장 클라이언트 시작: http://localhost:${port}`)
      console.log(`📦 매장 ID: ${this.config.storeId}`)
      console.log(`🏪 매장명: ${this.config.storeName}`)
    })
  }

  stop() {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer)
    }
    console.log('🛑 매장 클라이언트 중지')
  }
}

// 서버 시작
if (require.main === module) {
  const config = {
    storeId: process.env.STORE_ID || 'store_001',
    storeName: process.env.STORE_NAME || '테스트 매장',
    centralServerUrl: process.env.CENTRAL_SERVER_URL || 'http://localhost:3002',
    location: process.env.STORE_LOCATION || '서울시 강남구',
    contact: process.env.STORE_CONTACT || '010-1234-5678',
    ip: process.env.STORE_IP || 'localhost',
    port: process.env.STORE_PORT || 3003,
    autoUpdate: process.env.AUTO_UPDATE === 'true',
    pilotEligible: process.env.PILOT_ELIGIBLE !== 'false'
  }
  
  const client = new StoreUpdateClient(config)
  client.start()
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 매장 클라이언트 종료 중...')
    client.stop()
    process.exit(0)
  })
}

module.exports = StoreUpdateClient
