/**
 * 🧱 BrickBox 중앙 모델 관리 시스템
 * 매장별 모델 배포 및 관리를 담당하는 중앙 서버
 */

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const { createClient } = require('@supabase/supabase-js')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

class CentralModelManager {
  constructor() {
    this.app = express()
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_SERVICE_ROLE
    )
    this.stores = new Map() // 매장별 정보 캐시
    this.modelVersions = new Map() // 모델 버전 관리
    this.setupRoutes()
  }

  setupRoutes() {
    this.app.use(express.json())
    
    // 모델 업로드 (Colab에서 학습 완료 후)
    this.app.post('/api/models/upload', this.uploadModel.bind(this))
    
    // 매장별 모델 배포
    this.app.post('/api/stores/:storeId/deploy', this.deployToStore.bind(this))
    
    // 전체 매장 배포
    this.app.post('/api/stores/deploy-all', this.deployToAllStores.bind(this))
    
    // 매장 상태 조회
    this.app.get('/api/stores/:storeId/status', this.getStoreStatus.bind(this))
    
    // 매장 등록
    this.app.post('/api/stores/register', this.registerStore.bind(this))
    
    // 모델 버전 관리
    this.app.get('/api/models/versions', this.getModelVersions.bind(this))
    this.app.post('/api/models/:version/activate', this.activateModel.bind(this))
  }

  /**
   * 새 모델 업로드 (Colab 학습 완료 후)
   */
  async uploadModel(req, res) {
    try {
      const { modelType, version, metrics, trainingJobId } = req.body
      
      console.log(`📦 새 모델 업로드: ${modelType} v${version}`)
      
      // 1. 모델 파일 검증
      const modelFiles = await this.validateModelFiles(req.files)
      if (!modelFiles.valid) {
        return res.status(400).json({ error: modelFiles.error })
      }
      
      // 2. Supabase Storage에 업로드
      const storagePaths = await this.uploadToSupabaseStorage(modelFiles, version)
      
      // 3. model_registry 업데이트
      const modelId = await this.updateModelRegistry({
        modelType,
        version,
        metrics,
        trainingJobId,
        storagePaths
      })
      
      // 4. 매장별 배포 준비
      await this.prepareStoreDeployment(modelId, version)
      
      res.json({
        success: true,
        modelId,
        version,
        message: '모델 업로드 및 배포 준비 완료'
      })
      
    } catch (error) {
      console.error('❌ 모델 업로드 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * 특정 매장에 모델 배포
   */
  async deployToStore(req, res) {
    try {
      const { storeId } = req.params
      const { modelVersion, forceUpdate = false } = req.body
      
      console.log(`🚀 매장 ${storeId}에 모델 v${modelVersion} 배포 시작`)
      
      // 1. 매장 정보 조회
      const store = await this.getStoreInfo(storeId)
      if (!store) {
        return res.status(404).json({ error: '매장을 찾을 수 없습니다' })
      }
      
      // 2. 현재 모델 버전 확인
      const currentVersion = await this.getStoreCurrentModel(storeId)
      if (currentVersion === modelVersion && !forceUpdate) {
        return res.json({ message: '이미 최신 버전입니다', currentVersion })
      }
      
      // 3. 모델 파일 다운로드 URL 생성
      const downloadUrls = await this.generateModelDownloadUrls(modelVersion)
      
      // 4. 매장별 배포 패키지 생성
      const deploymentPackage = await this.createDeploymentPackage({
        storeId,
        modelVersion,
        downloadUrls,
        storeConfig: store.config
      })
      
      // 5. 매장에 배포 명령 전송
      const deploymentResult = await this.sendDeploymentCommand(store, deploymentPackage)
      
      if (deploymentResult.success) {
        // 6. 배포 상태 업데이트
        await this.updateStoreDeploymentStatus(storeId, {
          modelVersion,
          deployedAt: new Date().toISOString(),
          status: 'deployed'
        })
        
        res.json({
          success: true,
          storeId,
          modelVersion,
          message: '배포 완료'
        })
      } else {
        throw new Error(deploymentResult.error)
      }
      
    } catch (error) {
      console.error(`❌ 매장 ${req.params.storeId} 배포 실패:`, error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * 전체 매장에 모델 배포 (단계적)
   */
  async deployToAllStores(req, res) {
    try {
      const { modelVersion, deploymentStrategy = 'gradual' } = req.body
      
      console.log(`🌍 전체 매장 배포 시작: v${modelVersion} (${deploymentStrategy})`)
      
      // 1. 모든 매장 조회
      const stores = await this.getAllStores()
      
      if (deploymentStrategy === 'gradual') {
        // 단계적 배포
        const pilotStores = this.selectPilotStores(stores, 10) // 10개 매장 먼저
        const remainingStores = stores.filter(s => !pilotStores.includes(s))
        
        // 1단계: 파일럿 매장 배포
        console.log(`📊 1단계: 파일럿 매장 ${pilotStores.length}개 배포`)
        const pilotResults = await Promise.allSettled(
          pilotStores.map(store => this.deployToStore({ params: { storeId: store.id }, body: { modelVersion } }))
        )
        
        // 2단계: 성능 모니터링 (24시간)
        console.log('⏰ 2단계: 성능 모니터링 시작 (24시간)')
        await this.monitorPilotPerformance(pilotStores, 24 * 60 * 60 * 1000)
        
        // 3단계: 전체 배포
        console.log(`📊 3단계: 전체 매장 ${remainingStores.length}개 배포`)
        const fullResults = await Promise.allSettled(
          remainingStores.map(store => this.deployToStore({ params: { storeId: store.id }, body: { modelVersion } }))
        )
        
        res.json({
          success: true,
          pilotStores: pilotResults.length,
          fullStores: fullResults.length,
          message: '단계적 배포 완료'
        })
        
      } else {
        // 즉시 전체 배포
        const results = await Promise.allSettled(
          stores.map(store => this.deployToStore({ params: { storeId: store.id }, body: { modelVersion } }))
        )
        
        res.json({
          success: true,
          totalStores: stores.length,
          message: '전체 배포 완료'
        })
      }
      
    } catch (error) {
      console.error('❌ 전체 배포 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * 매장 등록
   */
  async registerStore(req, res) {
    try {
      const { storeId, storeName, location, contact, config } = req.body
      
      console.log(`🏪 새 매장 등록: ${storeName} (${storeId})`)
      
      // Supabase stores 테이블에 등록
      const { data, error } = await this.supabase
        .from('stores')
        .insert({
          id: storeId,
          name: storeName,
          location,
          contact,
          config: config || {},
          status: 'active',
          registered_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      
      // 로컬 캐시 업데이트
      this.stores.set(storeId, data)
      
      res.json({
        success: true,
        store: data,
        message: '매장 등록 완료'
      })
      
    } catch (error) {
      console.error('❌ 매장 등록 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * 매장 상태 조회
   */
  async getStoreStatus(req, res) {
    try {
      const { storeId } = req.params
      
      const store = await this.getStoreInfo(storeId)
      if (!store) {
        return res.status(404).json({ error: '매장을 찾을 수 없습니다' })
      }
      
      // 현재 모델 버전
      const currentModel = await this.getStoreCurrentModel(storeId)
      
      // 최신 모델 버전
      const latestModel = await this.getLatestModelVersion()
      
      // 성능 메트릭
      const performance = await this.getStorePerformance(storeId)
      
      res.json({
        storeId,
        storeName: store.name,
        currentModel,
        latestModel,
        hasUpdate: currentModel !== latestModel,
        performance,
        lastUpdate: store.last_deployment_at,
        status: store.status
      })
      
    } catch (error) {
      console.error(`❌ 매장 ${req.params.storeId} 상태 조회 실패:`, error)
      res.status(500).json({ error: error.message })
    }
  }

  // === 헬퍼 메서드들 ===

  async validateModelFiles(files) {
    const requiredFiles = ['best.pt', 'best.onnx']
    const missingFiles = requiredFiles.filter(file => !files[file])
    
    if (missingFiles.length > 0) {
      return { valid: false, error: `필수 파일 누락: ${missingFiles.join(', ')}` }
    }
    
    return { valid: true, files }
  }

  async uploadToSupabaseStorage(files, version) {
    const paths = {}
    
    for (const [filename, file] of Object.entries(files)) {
      const path = `models/${version}/${filename}`
      const { data, error } = await this.supabase.storage
        .from('model-storage')
        .upload(path, file.buffer, {
          contentType: 'application/octet-stream',
          upsert: true
        })
      
      if (error) throw error
      paths[filename] = data.path
    }
    
    return paths
  }

  async updateModelRegistry(modelData) {
    const { data, error } = await this.supabase
      .from('model_registry')
      .insert({
        model_name: `brickbox_${modelData.modelType}`,
        model_version: modelData.version,
        model_type: modelData.modelType,
        model_path: modelData.storagePaths['best.onnx'],
        pt_model_path: modelData.storagePaths['best.pt'],
        performance_metrics: modelData.metrics,
        is_active: false, // 수동 활성화 필요
        training_job_id: modelData.trainingJobId
      })
      .select()
      .single()
    
    if (error) throw error
    return data.id
  }

  async createDeploymentPackage({ storeId, modelVersion, downloadUrls, storeConfig }) {
    return {
      storeId,
      modelVersion,
      downloadUrls,
      storeConfig,
      deploymentScript: this.generateDeploymentScript(storeConfig),
      rollbackScript: this.generateRollbackScript(storeId)
    }
  }

  generateDeploymentScript(storeConfig) {
    return `
@echo off
echo 🧱 BrickBox 모델 업데이트 시작

REM 1. 기존 모델 백업
if exist "models" (
    echo 📦 기존 모델 백업 중...
    move models models_backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
)

REM 2. 새 모델 다운로드
echo 📥 새 모델 다운로드 중...
curl -o models.zip "${downloadUrls.package}"
unzip -o models.zip -d models/

REM 3. 설정 파일 업데이트
echo ⚙️ 설정 업데이트 중...
echo ${JSON.stringify(storeConfig)} > config/store.json

REM 4. 시스템 재시작
echo 🔄 시스템 재시작 중...
taskkill /f /im brickbox.exe 2>nul
timeout /t 3
start brickbox.exe

echo ✅ 업데이트 완료!
echo 🎉 BrickBox v${modelVersion} 준비 완료
    `.trim()
  }

  generateRollbackScript(storeId) {
    return `
@echo off
echo 🔄 BrickBox 모델 롤백 시작

REM 1. 현재 모델 백업
if exist "models" (
    move models models_failed_%date:~0,4%%date:~5,2%%date:~8,2%
)

REM 2. 이전 모델 복원
if exist "models_backup_*" (
    for /d %%i in (models_backup_*) do (
        move "%%i" models
        goto :restart
    )
)

:restart
REM 3. 시스템 재시작
taskkill /f /im brickbox.exe 2>nul
timeout /t 3
start brickbox.exe

echo ✅ 롤백 완료!
    `.trim()
  }

  async sendDeploymentCommand(store, package) {
    // 매장별 배포 방법에 따라 구현
    // 1. HTTP API 호출 (매장이 웹 서버 실행 중)
    // 2. SSH 연결 (Linux 매장)
    // 3. 원격 데스크톱 (Windows 매장)
    // 4. 모바일 앱 푸시 (모바일 기반 매장)
    
    try {
      if (store.deployment_method === 'http') {
        return await this.deployViaHTTP(store, package)
      } else if (store.deployment_method === 'ssh') {
        return await this.deployViaSSH(store, package)
      } else {
        return await this.deployViaMobileApp(store, package)
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async deployViaHTTP(store, package) {
    const response = await fetch(`http://${store.ip}:${store.port}/api/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(package)
    })
    
    return await response.json()
  }

  async deployViaSSH(store, package) {
    const script = package.deploymentScript
    const command = `echo "${script}" | ssh ${store.ssh_user}@${store.ip} "bash"`
    
    const { stdout, stderr } = await execAsync(command)
    return { success: !stderr, output: stdout, error: stderr }
  }

  async deployViaMobileApp(store, package) {
    // 모바일 앱 푸시 알림으로 배포 패키지 전송
    const pushData = {
      type: 'model_update',
      storeId: store.id,
      package: package
    }
    
    // FCM 또는 다른 푸시 서비스 사용
    return await this.sendPushNotification(store.push_token, pushData)
  }

  async getAllStores() {
    const { data, error } = await this.supabase
      .from('stores')
      .select('*')
      .eq('status', 'active')
    
    if (error) throw error
    return data
  }

  selectPilotStores(stores, count) {
    // 다양한 조건으로 파일럿 매장 선별
    return stores
      .filter(store => store.pilot_eligible !== false)
      .sort((a, b) => a.performance_score - b.performance_score) // 성능이 좋은 매장부터
      .slice(0, count)
  }

  async monitorPilotPerformance(pilotStores, duration) {
    const startTime = Date.now()
    
    while (Date.now() - startTime < duration) {
      for (const store of pilotStores) {
        const performance = await this.getStorePerformance(store.id)
        
        // 성능 임계값 확인
        if (performance.accuracy < 0.8 || performance.fps < 10) {
          console.warn(`⚠️ 매장 ${store.id} 성능 저하 감지`)
          // 자동 롤백 또는 알림
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 60000)) // 1분마다 체크
    }
  }

  async getStoreInfo(storeId) {
    if (this.stores.has(storeId)) {
      return this.stores.get(storeId)
    }
    
    const { data, error } = await this.supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()
    
    if (error) throw error
    
    this.stores.set(storeId, data)
    return data
  }

  async getStoreCurrentModel(storeId) {
    const { data } = await this.supabase
      .from('store_deployments')
      .select('model_version')
      .eq('store_id', storeId)
      .order('deployed_at', { ascending: false })
      .limit(1)
      .single()
    
    return data?.model_version || 'unknown'
  }

  async getLatestModelVersion() {
    const { data } = await this.supabase
      .from('model_registry')
      .select('model_version')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    return data?.model_version || 'unknown'
  }

  async getStorePerformance(storeId) {
    const { data } = await this.supabase
      .from('store_performance')
      .select('*')
      .eq('store_id', storeId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()
    
    return data || { accuracy: 0, fps: 0, memory_usage: 0 }
  }

  async updateStoreDeploymentStatus(storeId, status) {
    await this.supabase
      .from('store_deployments')
      .insert({
        store_id: storeId,
        model_version: status.modelVersion,
        deployed_at: status.deployedAt,
        status: status.status
      })
  }

  async generateModelDownloadUrls(version) {
    const baseUrl = process.env.MODEL_DOWNLOAD_BASE_URL || 'https://brickbox-central.com'
    
    return {
      package: `${baseUrl}/api/models/${version}/download`,
      onnx: `${baseUrl}/api/models/${version}/onnx`,
      pt: `${baseUrl}/api/models/${version}/pt`
    }
  }

  async prepareStoreDeployment(modelId, version) {
    console.log(`📦 매장 배포 준비: 모델 ${modelId} v${version}`)
    
    // 배포 큐에 추가
    await this.supabase
      .from('deployment_queue')
      .insert({
        model_id: modelId,
        model_version: version,
        status: 'pending',
        created_at: new Date().toISOString()
      })
  }

  async activateModel(req, res) {
    try {
      const { version } = req.params
      
      // 활성화할 모델 정보 조회
      const { data: targetModel, error: fetchError } = await this.supabase
        .from('model_registry')
        .select('model_stage')
        .eq('model_version', version)
        .single()
      
      if (fetchError || !targetModel) {
        throw new Error(`모델 조회 실패: ${fetchError?.message}`)
      }
      
      // 동일 model_stage의 기존 활성 모델 비활성화
      let deactivateQuery = this.supabase
        .from('model_registry')
        .update({ is_active: false, status: 'inactive' })
        .eq('is_active', true)
      
      // model_stage가 있으면 동일 stage만, 없으면 모든 모델 비활성화 (레거시 호환)
      if (targetModel.model_stage) {
        deactivateQuery = deactivateQuery.eq('model_stage', targetModel.model_stage)
      }
      
      await deactivateQuery
      
      // 새 모델 활성화
      const { data, error } = await this.supabase
        .from('model_registry')
        .update({ is_active: true, status: 'active' })
        .eq('model_version', version)
        .select()
        .single()
      
      if (error) throw error
      
      res.json({
        success: true,
        model: data,
        message: `모델 v${version} 활성화 완료`
      })
      
    } catch (error) {
      console.error('❌ 모델 활성화 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  async getModelVersions(req, res) {
    try {
      const { data, error } = await this.supabase
        .from('model_registry')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      res.json({
        success: true,
        versions: data
      })
      
    } catch (error) {
      console.error('❌ 모델 버전 조회 실패:', error)
      res.status(500).json({ error: error.message })
    }
  }

  start(port = 3002) {
    this.app.listen(port, () => {
      console.log(`🚀 BrickBox 중앙 모델 관리 서버 시작: http://localhost:${port}`)
      console.log('📊 매장별 모델 배포 시스템 준비 완료')
    })
  }
}

// 서버 시작
if (require.main === module) {
  const manager = new CentralModelManager()
  manager.start()
}

module.exports = CentralModelManager
