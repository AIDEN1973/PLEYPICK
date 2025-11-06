import * as ort from 'onnxruntime-web'
import { useSupabase } from './useSupabase'

// 간단한 YOLO WebGPU 추론 컴포저블 (2단계 검출 지원) // 🔧 수정됨
export function useYoloDetector() {
  const { supabase } = useSupabase()
  let session = null
  let stage1Session = null  // Stage 1 모델 세션
  let stage2Session = null  // Stage 2 모델 세션
  let inputSize = 640
  let modelPath = import.meta.env.VITE_DEFAULT_MODEL_URL || 'https://your-supabase-url.supabase.co/storage/v1/object/public/models/your-model-path/default_model.onnx'
  let executionProviders = ['wasm']
  
  // 동시 초기화 방지 (Promise 캐싱)
  let initStage1Promise = null
  let initStage2Promise = null
  let initDefaultPromise = null

  const isWebGPUAvailable = () => {
    return typeof navigator !== 'undefined' && 'gpu' in navigator
  }

  const isWebGL2Available = () => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2')
      return !!gl
    } catch (e) {
      return false
    }
  }

  // Stage별 모델 초기화 // 🔧 수정됨
  const initStage = async (stage, options = {}) => {
    const targetSession = stage === 'stage1' ? stage1Session : stage === 'stage2' ? stage2Session : session
    if (targetSession) {
      console.log(`✅ ${stage || '기본'} 모델 세션 이미 존재, 재사용`)
      return targetSession
    }
    
    // 동시 초기화 방지: 진행 중인 Promise가 있으면 재사용
    if (stage === 'stage1') {
      if (initStage1Promise) {
        console.log(`⏳ Stage1 모델 초기화 중... 기존 Promise 재사용 (대기 중)`)
        try {
          const result = await initStage1Promise
          console.log(`✅ Stage1 모델 초기화 완료 (Promise 재사용)`)
          return result
        } catch (err) {
          console.error(`❌ Stage1 모델 초기화 실패 (Promise 재사용 중):`, err)
          initStage1Promise = null // 실패 시 초기화하여 재시도 가능하게
          throw err
        }
      }
      initStage1Promise = (async () => {
        try {
          return await initStageInternal(stage, options)
        } finally {
          initStage1Promise = null // 완료 후 초기화
        }
      })()
      return await initStage1Promise
    } else if (stage === 'stage2') {
      if (initStage2Promise) {
        console.log(`⏳ Stage2 모델 초기화 중... 기존 Promise 재사용 (대기 중)`)
        try {
          const result = await initStage2Promise
          console.log(`✅ Stage2 모델 초기화 완료 (Promise 재사용)`)
          return result
        } catch (err) {
          console.error(`❌ Stage2 모델 초기화 실패 (Promise 재사용 중):`, err)
          initStage2Promise = null
          throw err
        }
      }
      initStage2Promise = (async () => {
        try {
          return await initStageInternal(stage, options)
        } finally {
          initStage2Promise = null
        }
      })()
      return await initStage2Promise
    } else {
      if (initDefaultPromise) {
        console.log(`⏳ 기본 모델 초기화 중... 기존 Promise 재사용 (대기 중)`)
        try {
          const result = await initDefaultPromise
          console.log(`✅ 기본 모델 초기화 완료 (Promise 재사용)`)
          return result
        } catch (err) {
          console.error(`❌ 기본 모델 초기화 실패 (Promise 재사용 중):`, err)
          initDefaultPromise = null
          throw err
        }
      }
      initDefaultPromise = (async () => {
        try {
          return await initStageInternal(stage, options)
        } finally {
          initDefaultPromise = null
        }
      })()
      return await initDefaultPromise
    }
  }
  
  // 실제 초기화 로직 (내부 함수)
  const initStageInternal = async (stage, options = {}) => {
    const stageInputSize = options.inputSize || inputSize

    // onnxruntime-web 환경 설정 (CDN 사용)
    try {
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/'
      ort.env.wasm.numThreads = 1
      ort.env.logLevel = 'warning' // 경고 레벨로 변경하여 불필요한 경고만 표시
    } catch (_) {}

    // Stage별 실행 프로바이더 최적화
    // Stage1 (작은 모델 11.5MB): WASM이 더 빠름 (초기화 오버헤드 없음)
    // Stage2 (큰 모델 40.4MB): WebGPU가 2-3배 빠름 (병렬 처리 유리)
    let stageExecutionProviders = ['wasm']
    
    if (stage === 'stage1') {
      // Stage1: WASM만 사용 (작은 모델, 빠른 초기화)
      stageExecutionProviders = ['wasm']
      console.log('📊 Stage1 실행 프로바이더: WASM (최적화)')
    } else if (stage === 'stage2') {
      // Stage2: WebGPU 우선 (큰 모델, 병렬 처리 유리)
      if (isWebGPUAvailable()) {
        stageExecutionProviders = ['webgpu', 'wasm']
        console.log('📊 Stage2 실행 프로바이더: WebGPU + WASM (최적화)')
      } else {
        stageExecutionProviders = ['wasm']
        console.log('📊 Stage2 실행 프로바이더: WASM (WebGPU 불가)')
      }
    } else {
      // 기본: WebGPU 사용 가능하면 사용
      if (isWebGPUAvailable()) {
        stageExecutionProviders = ['webgpu', 'wasm']
        console.log('📊 실행 프로바이더: WebGPU + WASM')
      } else {
        console.log('📊 실행 프로바이더: WASM')
      }
    }

    // 모델 바이트를 직접 로드 (SPA 리다이렉트/MIME 문제 회피) - Stage별 모델 지원 // 🔧 수정됨
    const loadModelBytes = async () => {
      // Stage별 모델 조회 (stage1 우선, 없으면 stage2 또는 최신 모델)
      let activeModelUrl = null
      try {
        let query = supabase
          .from('model_registry')
          .select('model_url, model_path, model_name, model_stage, training_metadata')
          .eq('status', 'active')
          .eq('is_active', true)
        
        // Stage 지정이 있으면 해당 stage만 조회
        if (stage === 'stage1' || stage === 'stage2') {
          query = query.eq('model_stage', stage)
        }
        
        const { data: activeModels, error: modelError } = await query
          .order('created_at', { ascending: false })
          .limit(stage ? 1 : 2)  // stage 지정 시 1개, 미지정 시 2개까지
        
        if (modelError) {
          console.warn('⚠️ model_registry 조회 에러:', modelError.message)
        } else if (activeModels && activeModels.length > 0) {
          // Stage 지정 시 첫 번째 모델 사용
          // 미지정 시 stage1 우선, 없으면 stage2 또는 최신 모델
          let activeModel = activeModels[0]
          if (!stage && activeModels.length > 1) {
            const stage1Model = activeModels.find(m => m.model_stage === 'stage1')
            activeModel = stage1Model || activeModels[0]
          }
          
          // training_metadata에서 imgsz 추출하여 inputSize 설정
          // [FIX] 수정됨: 모델 입력 크기를 training_metadata에서 자동 감지
          if (activeModel.training_metadata && typeof activeModel.training_metadata === 'object') {
            const imgsz = activeModel.training_metadata.imgsz
            if (imgsz && typeof imgsz === 'number' && imgsz > 0) {
              inputSize = imgsz
              console.log(`📊 모델 입력 크기 자동 설정: ${inputSize}px (training_metadata.imgsz)`)
            } else {
              console.warn(`⚠️ training_metadata.imgsz가 유효하지 않음: ${imgsz}, 기본값 640 사용`)
            }
          } else {
            console.warn(`⚠️ training_metadata가 없음, 기본값 640 사용`)
          }
          
          console.log('📊 model_registry 활성 모델 조회 성공:', activeModel.model_name, {
            model_url: activeModel.model_url,
            model_path: activeModel.model_path,
            model_stage: activeModel.model_stage,
            inputSize: inputSize
          })
          
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
          
          // ONNX 파일이 있는 경우 우선 사용
          if (activeModel.model_url && activeModel.model_url.endsWith('.onnx')) {
            activeModelUrl = activeModel.model_url
            console.log(`✅ ONNX model_url 사용: ${activeModelUrl}`)
          } else if (activeModel.model_path && activeModel.model_path.endsWith('.onnx')) {
            // model_path가 .onnx인 경우 Supabase Storage URL 생성
            activeModelUrl = `${supabaseUrl}/storage/v1/object/public/models/${activeModel.model_path}`
            console.log(`✅ ONNX model_path 사용: ${activeModelUrl}`)
          } else if (activeModel.model_path && activeModel.model_path.endsWith('.pt')) {
            // .pt 파일 경로에서 .onnx 파일 경로 추론
            // [FIX] 수정됨: model_path가 .pt인 경우, ONNX 파일이 실제로 업로드되었는지 확인 필요
            // 학습 스크립트에서 ONNX 변환 실패 시 model_path는 .pt로 저장되지만 ONNX 파일은 없을 수 있음
            const onnxPath = activeModel.model_path.replace(/\.pt$/, '.onnx')
            activeModelUrl = `${supabaseUrl}/storage/v1/object/public/models/${onnxPath}`
            console.log(`🔍 .pt 경로에서 .onnx 추론: ${activeModel.model_path} → ${onnxPath}`)
            console.log(`⚠️ ONNX 파일이 없을 수 있습니다. 학습 스크립트에서 ONNX 변환이 실패했을 가능성이 있습니다.`)
          } else if (activeModel.model_url && activeModel.model_url.endsWith('.pt')) {
            // model_url이 .pt인 경우 .onnx로 변환하여 시도
            // [FIX] 수정됨: model_url이 .pt인 경우도 ONNX 파일이 없을 수 있음
            activeModelUrl = activeModel.model_url.replace(/\.pt$/, '.onnx')
            console.log(`🔍 .pt URL에서 .onnx 추론: ${activeModelUrl}`)
            console.log(`⚠️ ONNX 파일이 없을 수 있습니다. 학습 스크립트에서 ONNX 변환이 실패했을 가능성이 있습니다.`)
          }
        } else {
          console.log('⚠️ model_registry에 활성 모델이 없습니다')
        }
      } catch (err) {
        console.warn('⚠️ model_registry 조회 실패:', err.message)
      }
      
      // 우선순위 2: 옵션으로 전달된 modelPath
      // 우선순위 3: 환경 변수
      // 우선순위 4: 로컬 파일 경로들
      const candidates = []
      if (activeModelUrl) candidates.push(activeModelUrl)
      if (modelPath) candidates.push(modelPath)
      candidates.push(
        import.meta.env.VITE_DEFAULT_MODEL_URL || 'https://your-supabase-url.supabase.co/storage/v1/object/public/models/your-model-path/default_model.onnx',
        '/models/default_model.onnx',
        '/models/yolo11n-seg.onnx', 
        '/models/yolo11n.onnx', 
        '/models/yolov8n.onnx'
      )
      
      let lastErr = null
      for (let i = 0; i < candidates.length; i++) {
        const p = candidates[i]
        if (!p) continue // null/undefined 제외
        try {
          const loadStartTime = Date.now()
          console.log(`📥 모델 다운로드 시도 ${i + 1}/${candidates.length}: ${p}`)
          
          // 타임아웃 설정 (60초)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 60000)
          
          const res = await fetch(p, { 
            cache: 'no-store',
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const buf = await res.arrayBuffer()
          const loadTime = Date.now() - loadStartTime
          
          // 간단 검증: ONNX는 protobuf 바이너리, 최소 크기 체크
          if (buf.byteLength < 1024) throw new Error('ONNX too small')
          const bytes = new Uint8Array(buf)
          // HTML 응답(리다이렉트 등) 차단: '<!DOCT' 시그니처 감지
          if (
            bytes[0] === 60 && // '<'
            (bytes[1] === 33 || bytes[1] === 104 || bytes[1] === 72) // '!' or 'h' or 'H'
          ) {
            throw new Error('Received HTML instead of ONNX at ' + p)
          }
          console.log(`✅ YOLO 모델 로드 성공: ${p} (${buf.byteLength} bytes, ${loadTime}ms)`)
          return bytes
        } catch (e) {
          lastErr = e
          // 조용히 다음 후보 시도 (마지막 에러만 기록)
        }
      }
      throw lastErr || new Error('YOLO 모델을 로드할 수 없습니다. model_registry에 활성 모델이 등록되어 있는지 확인하세요.')
    }

    console.log(`📦 모델 바이트 로드 시작... (${stage || '기본'})`)
    const onnxBytes = await loadModelBytes()
    console.log(`✅ 모델 바이트 로드 완료: ${onnxBytes.length} bytes`)
    
    console.log(`🔧 ONNX 세션 생성 시작... (${stage || '기본'})`)
    const createStartTime = Date.now()
    const createdSession = await ort.InferenceSession.create(onnxBytes, {
      executionProviders: stageExecutionProviders,
      graphOptimizationLevel: 'basic'
    })
    const createTime = Date.now() - createStartTime
    
    // [FIX] 수정됨: 세션에 inputSize 정보 저장 (letterbox에서 사용)
    createdSession.inputSize = inputSize
    console.log(`✅ ONNX 세션 생성 완료: ${createTime}ms (inputSize: ${inputSize})`)
    
    // Stage별 세션 저장 (동기적으로 설정하여 즉시 사용 가능)
    if (stage === 'stage1') {
      stage1Session = createdSession
      console.log(`✅ Stage1 모델 세션 저장 완료 및 사용 가능 (inputSize: ${inputSize})`)
    } else if (stage === 'stage2') {
      stage2Session = createdSession
      console.log(`✅ Stage2 모델 세션 저장 완료 및 사용 가능 (inputSize: ${inputSize})`)
    } else {
      session = createdSession
      console.log(`✅ 기본 모델 세션 저장 완료 및 사용 가능 (inputSize: ${inputSize})`)
    }
    
    return createdSession
  }

  // 기존 init 함수 (하위 호환성 유지) // 🔧 수정됨
  const init = async (options = {}) => {
    const stage = options.stage || null
    const targetSession = stage === 'stage1' ? stage1Session : stage === 'stage2' ? stage2Session : session
    
    if (targetSession && !options.forceReload) {
      console.log(`ℹ️ ${stage || '기본'} 모델 세션 이미 로드됨, 재사용`)
      return targetSession
    }
    
    modelPath = options.modelPath || modelPath
    // [FIX] 수정됨: inputSize는 모델 로드 시 training_metadata에서 자동 설정되므로
    // 명시적으로 options.inputSize가 제공되면 우선 사용, 아니면 모델 로드 시 설정된 값 사용
    if (options.inputSize && typeof options.inputSize === 'number') {
      inputSize = options.inputSize
      console.log(`📊 입력 크기 옵션 사용: ${inputSize}`)
    }
    // options.inputSize가 없으면 모델 로드 시 training_metadata에서 설정된 값 사용
    
    return await initStage(stage, options)
  }

  // letterbox 리사이즈 (패딩 유지)
  // [FIX] 수정됨: inputSize를 파라미터로 받아서 사용 (세션의 inputSize 지원)
  const letterbox = (img, targetSize = null) => {
    const size = targetSize || inputSize
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = size
    canvas.height = size

    const scale = Math.min(size / img.width, size / img.height)
    const newW = Math.round(img.width * scale)
    const newH = Math.round(img.height * scale)
    const dx = Math.floor((size - newW) / 2)
    const dy = Math.floor((size - newH) / 2)

    // 배경을 회색(114)로 채워 일반 YOLO 전처리와 유사하게 함
    ctx.fillStyle = 'rgb(114,114,114)'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, dx, dy, newW, newH)

    const imageData = ctx.getImageData(0, 0, size, size)
    return { imageData, scale, dx, dy }
  }

  const toNchw = (imageData) => {
    const { data, width, height } = imageData
    const H = height
    const W = width
    const numPixels = H * W
    const float32Data = new Float32Array(3 * numPixels)
    
    console.log('🔧 이미지 전처리:', { width: W, height: H, numPixels, dataLength: data.length })
    
    for (let i = 0; i < numPixels; i++) {
      const j = i * 4
      float32Data[i] = data[j] / 255.0            // R
      float32Data[i + numPixels] = data[j + 1] / 255.0 // G
      float32Data[i + 2 * numPixels] = data[j + 2] / 255.0 // B
    }
    
    // 정규화 확인
    const pixelR = float32Data[0]
    const pixelG = float32Data[numPixels]
    const pixelB = float32Data[2 * numPixels]
    console.log('🔧 정규화 픽셀:', { R: pixelR, G: pixelG, B: pixelB })
    
    return new ort.Tensor('float32', float32Data, [1, 3, H, W])
  }

  // NHWC 경로 제거: YOLOv8n ONNX는 일반적으로 NCHW([1,3,H,W])를 사용

  const sigmoid = (x) => 1 / (1 + Math.exp(-x))

  const nms = (boxes, scores, iouThreshold = 0.45, topK = 100) => {
    const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s).map(o => o.i)
    const keep = []
    while (order.length && keep.length < topK) {
      const i = order.shift()
      keep.push(i)
      const rest = []
      for (const j of order) {
        const iouVal = iou(boxes[i], boxes[j])
        if (iouVal < iouThreshold) rest.push(j)
      }
      order.splice(0, order.length, ...rest)
    }
    return keep
  }

  const iou = (a, b) => {
    const x1 = Math.max(a[0], b[0])
    const y1 = Math.max(a[1], b[1])
    const x2 = Math.min(a[2], b[2])
    const y2 = Math.min(a[3], b[3])
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
    const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1])
    const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1])
    return inter / Math.max(1e-6, areaA + areaB - inter)
  }

  // YOLOv8 호환 후처리 (출력 형태 [1,84,8400] 또는 [1,25200,85])
  const postprocess = (output, imgW, imgH, padDx, padDy, scale, confThreshold = 0.25, maxDetections = 50) => {
    const out = output
    const dims = out.dims
    const data = out.data

    // NMS 내장 모델 형식: [numDet, 6] => [x1,y1,x2,y2,score,class]
    if (dims.length === 2 && dims[1] === 6) {
      const dets = []
      const numDet = dims[0]
      for (let i = 0; i < numDet; i++) {
        const base = i * 6
        const x1 = data[base + 0]
        const y1 = data[base + 1]
        const x2 = data[base + 2]
        const y2 = data[base + 3]
        const score = data[base + 4]
        const cls = data[base + 5]
        if (score >= confThreshold) {
          // 좌표는 원본 기준이라고 가정
          dets.push({ box: [
            Math.max(0, Math.min(imgW, x1)),
            Math.max(0, Math.min(imgH, y1)),
            Math.max(0, Math.min(imgW, x2)),
            Math.max(0, Math.min(imgH, y2))
          ], score, classId: Math.round(cls) })
        }
      }
      // 폐쇄 환경 최적화: maxDetections 제한 적용 // 🔧 수정됨
      if (dets.length > maxDetections) {
        return dets.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, maxDetections)
      }
      return dets
    }

    let numAnchors, numAttrs, byRow
    if (dims.length === 3) {
      // [1,84,8400]
      numAttrs = dims[1]
      numAnchors = dims[2]
      byRow = true
    } else if (dims.length === 2) {
      // [25200,85]
      numAnchors = dims[0]
      numAttrs = dims[1]
      byRow = false
    } else {
      // 알 수 없는 포맷
      return []
    }

    const boxes = []
    const scores = []
    const classes = []

    for (let a = 0; a < numAnchors; a++) {
      const get = (k) => byRow ? data[k * numAnchors + a] : data[a * numAttrs + k]
      const x = get(0)
      const y = get(1)
      const w = get(2)
      const h = get(3)
      let obj = byRow ? 1 : get(4) // 일부 모델은 obj가 분리되어 있지 않음

      let maxCls = 0
      let maxScore = 0
      const clsStart = byRow ? 4 : 5
      for (let c = clsStart; c < numAttrs; c++) {
        const s = byRow ? data[c * numAnchors + a] : data[a * numAttrs + c]
        if (s > maxScore) { maxScore = s; maxCls = c - clsStart }
      }

      const score = sigmoid(maxScore) * (byRow ? 1 : sigmoid(obj))
      if (score < confThreshold) continue

      // xywh -> xyxy (모델 출력이 이미 xywh 가정)
      const cx = x
      const cy = y
      const bw = w
      const bh = h
      let x1 = cx - bw / 2
      let y1 = cy - bh / 2
      let x2 = cx + bw / 2
      let y2 = cy + bh / 2

      // letterbox 보정 역변환
      x1 = (x1 - padDx) / scale
      y1 = (y1 - padDy) / scale
      x2 = (x2 - padDx) / scale
      y2 = (y2 - padDy) / scale

      // 원본 이미지 경계로 클램프
      x1 = Math.max(0, Math.min(imgW, x1))
      y1 = Math.max(0, Math.min(imgH, y1))
      x2 = Math.max(0, Math.min(imgW, x2))
      y2 = Math.max(0, Math.min(imgH, y2))

      boxes.push([x1, y1, x2, y2])
      scores.push(score)
      classes.push(maxCls)
    }

    // 폐쇄 환경 최적화: topK를 줄여서 과도한 false positive 방지 // 🔧 수정됨
    const topK = Math.min(maxDetections, 50) // 🔧 수정됨: 기본값 100 → 50
    const keep = nms(boxes, scores, 0.45, topK) // IoU 임계값 0.45 유지
    return keep.map(i => ({
      box: boxes[i],
      score: scores[i],
      classId: classes[i]
    }))
  }

  const cropToDataUrl = (imageDataUrl, box) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const [x1, y1, x2, y2] = box
        const w = Math.max(1, Math.round(x2 - x1))
        const h = Math.max(1, Math.round(y2 - y1))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, Math.round(-x1), Math.round(-y1))
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = imageDataUrl
    })
  }

  const detect = async (imageDataUrl, options = {}) => {
    const stage = options.stage || null
    const startTime = Date.now()
    console.log(`🔍 YOLO 검출 시작 ${stage ? `(${stage})` : ''}`)
    
    try {
      const initializedSession = await init(options)
      const initTime = Date.now() - startTime
      console.log(`✅ YOLO 모델 초기화 완료 ${stage ? `(${stage})` : ''} (${initTime}ms)`)
      
      // Stage별 세션 선택 // 🔧 수정됨
      const activeSession = stage === 'stage1' ? stage1Session : stage === 'stage2' ? stage2Session : session
      if (!activeSession) {
        // 초기화는 완료되었지만 세션 변수가 아직 설정되지 않은 경우 (비동기 타이밍 이슈)
        // 잠시 대기 후 다시 확인
        await new Promise(resolve => setTimeout(resolve, 10))
        const retrySession = stage === 'stage1' ? stage1Session : stage === 'stage2' ? stage2Session : session
        if (!retrySession) {
          throw new Error(`모델 세션이 초기화되지 않았습니다 (stage: ${stage || 'none'})`)
        }
        return await detectWithSession(imageDataUrl, retrySession, options, stage)
      }
      
      return await detectWithSession(imageDataUrl, activeSession, options, stage)
    } catch (error) {
      console.error(`❌ YOLO 검출 실패 ${stage ? `(${stage})` : ''}:`, error)
      throw error
    }
  }
  
  // 실제 검출 로직 (세션이 준비된 후)
  const detectWithSession = async (imageDataUrl, activeSession, options, stage) => {

    // 원본 이미지를 로드하고 letterbox
    const img = await new Promise((resolve, reject) => {
      const im = new Image()
      im.onload = () => {
        console.log('📸 이미지 로드 완료:', { width: im.width, height: im.height })
        resolve(im)
      }
      im.onerror = (error) => {
        console.error('❌ 이미지 로드 실패:', error)
        reject(error)
      }
      im.src = imageDataUrl
    })

    // [FIX] 수정됨: 세션의 inputSize 우선 사용 (training_metadata에서 설정된 값)
    const sessionInputSize = activeSession.inputSize || inputSize
    const { imageData, scale, dx, dy } = letterbox(img, sessionInputSize)
    console.log('🔧 Letterbox 완료:', { scale, dx, dy, size: sessionInputSize })
    
    // 입력 텐서: 항상 NCHW([1,3,H,W])로 생성
    const input = toNchw(imageData)
    console.log('🔧 입력 텐서 생성:', { shape: input.dims, type: input.type })

    // 입력 이름 자동 감지 (첫 번째 입력 또는 images)
    const inputName = Array.isArray(activeSession.inputNames) && activeSession.inputNames.length > 0
      ? activeSession.inputNames[0]
      : 'images'
    console.log('🔧 YOLO 입력 이름:', inputName)
    const feeds = { [inputName]: input }

    let results
    try {
      const inferenceStartTime = Date.now()
      console.log(`🚀 YOLO 추론 시작... (${stage || '기본'})`)
      results = await activeSession.run(feeds)
      const inferenceTime = Date.now() - inferenceStartTime
      console.log(`✅ YOLO 추론 완료 (${stage || '기본'}): ${inferenceTime}ms`)
    } catch (e) {
      console.error(`❌ YOLO 추론 실패 (${stage || '기본'}):`, e)
      throw e
    }

    // 출력 텐서 선택 (첫 번째 또는 적절한 형식 탐색)
    let outputName = activeSession.outputNames?.[0]
    let output = results[outputName]
    console.log('🔧 출력 텐서 선택:', { outputName, hasOutput: !!output, outputNames: activeSession.outputNames })
    
    if (!output || !output.dims) {
      const values = Object.values(results)
      console.log('🔧 출력 텐서 후보:', values.map(v => ({ dims: v?.dims, type: v?.type })))
      output = values.find(t => t && t.dims && (t.dims.length === 2 || t.dims.length === 3)) || values[0]
    }
    
    if (!output || !output.dims) {
      console.error('❌ 유효하지 않은 YOLO 출력 텐서')
      throw new Error('Invalid YOLO output tensor')
    }
    
    console.log('🔧 선택된 출력 텐서:', { dims: output.dims, type: output.type, dataLength: output.data.length })

    // 폐쇄 환경 최적화: confidence threshold를 높여서 false positive 감소 // 🔧 수정됨
    // 기술문서 4.2: conf=0.15는 개방 환경용, 폐쇄 환경에서는 더 보수적으로
    const confThreshold = options.confThreshold || 0.25 // 🔧 수정됨: 기본값 0.15 → 0.25
    const maxDetections = options.maxDetections || 50 // 🔧 수정됨: 기본값 50
    const dets = postprocess(output, img.width, img.height, dx, dy, scale, confThreshold, maxDetections)
    
    console.log('🔍 YOLO 원시 검출:', dets?.length || 0)
    if (dets.length > 0) {
      console.log('🔍 검출 결과 샘플:', dets.slice(0, 3).map(d => ({ box: d.box, score: d.score, classId: d.classId })))
    }

    // 결과를 BrickBox 형식으로 변환
    // 실시간 검출 성능 최적화: 이미지 크롭을 스킵하고 원본 이미지 URL 사용
    const isRealtime = options.realtime || false
    const mapped = []
    
    console.log(`🔄 검출 결과 변환 시작: ${dets.length}개 (실시간 모드: ${isRealtime}, ${stage || '기본'})`)
    
    if (isRealtime) {
      // 실시간 검출: 빠른 변환 (이미지 크롭 스킵) - 성능 최적화
      for (const d of dets) {
        const [x1, y1, x2, y2] = d.box
        mapped.push({
          id: crypto.randomUUID(),
          boundingBox: {
            x: x1 / img.width,
            y: y1 / img.height,
            width: (x2 - x1) / img.width,
            height: (y2 - y1) / img.height
          },
          confidence: d.score,
          classId: d.classId,
          image: imageDataUrl, // 원본 이미지 URL 사용 (크롭 스킵으로 성능 향상)
          timestamp: new Date().toISOString()
        })
      }
      console.log(`✅ YOLO 검출 결과 변환 완료: ${mapped.length}개 (실시간 모드: 크롭 스킵)`)
    } else {
      // 일반 검출: 정확한 이미지 크롭 (비동기, 느림)
      console.log(`📸 이미지 크롭 시작: ${dets.length}개 객체`)
      for (let i = 0; i < dets.length; i++) {
        const d = dets[i]
        const [x1, y1, x2, y2] = d.box
        const crop = await cropToDataUrl(imageDataUrl, d.box)
        mapped.push({
          id: crypto.randomUUID(),
          boundingBox: {
            x: x1 / img.width,
            y: y1 / img.height,
            width: (x2 - x1) / img.width,
            height: (y2 - y1) / img.height
          },
          confidence: d.score,
          classId: d.classId,
          image: crop,
          timestamp: new Date().toISOString()
        })
        if ((i + 1) % 10 === 0) {
          console.log(`📸 이미지 크롭 진행: ${i + 1}/${dets.length}개`)
        }
      }
      console.log(`✅ YOLO 검출 결과 변환 완료: ${mapped.length}개 (이미지 크롭 포함)`)
    }
    
    if (mapped.length > 0) {
      console.log(`📊 검출 결과 샘플 (최종):`, mapped.slice(0, 3).map(m => ({
        confidence: m.confidence.toFixed(3),
        boundingBox: m.boundingBox,
        classId: m.classId
      })))
    }
    
    return mapped
  }

  return { init, detect }
}


