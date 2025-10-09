import * as ort from 'onnxruntime-web'

// 간단한 YOLO WebGPU 추론 컴포저블 (로컬 전용)
export function useYoloDetector() {
  let session = null
  let inputSize = 640
  let modelPath = '/models/yolo11n-seg.onnx'
  let executionProviders = ['wasm']

  const isWebGPUAvailable = () => {
    return typeof navigator !== 'undefined' && 'gpu' in navigator
  }

  const init = async (options = {}) => {
    if (session) return
    modelPath = options.modelPath || modelPath
    inputSize = options.inputSize || inputSize

    // onnxruntime-web 환경 설정 (CDN 사용)
    try {
      // CDN에서 WASM 파일 로드하도록 설정
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/'
      ort.env.wasm.numThreads = 1 // 멀티스레딩 비활성화로 안정성 확보
      ort.env.logLevel = 'error' // 경고 로그 숨기기
    } catch (_) {}

    // 현재 환경에서는 WASM 고정 (WebGPU 미지원 환경에서 경고 제거)
    executionProviders = ['wasm']

    // 모델 바이트를 직접 로드 (SPA 리다이렉트/MIME 문제 회피)
    const loadModelBytes = async () => {
      const candidates = [modelPath, '/models/yolo11n-seg.onnx', '/models/yolo11n.onnx', '/models/yolov8n.onnx']
      let lastErr = null
      for (const p of candidates) {
        try {
          const res = await fetch(p, { cache: 'no-store' })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const buf = await res.arrayBuffer()
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
          console.log(`YOLO model bytes loaded from ${p}: ${buf.byteLength} bytes`)
          return bytes
        } catch (e) {
          lastErr = e
        }
      }
      throw lastErr || new Error('Failed to load ONNX model bytes')
    }

    const onnxBytes = await loadModelBytes()

    session = await ort.InferenceSession.create(onnxBytes, {
      executionProviders,
      graphOptimizationLevel: 'basic'
    })
  }

  // letterbox 리사이즈 (패딩 유지)
  const letterbox = (img) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = inputSize
    canvas.height = inputSize

    const scale = Math.min(inputSize / img.width, inputSize / img.height)
    const newW = Math.round(img.width * scale)
    const newH = Math.round(img.height * scale)
    const dx = Math.floor((inputSize - newW) / 2)
    const dy = Math.floor((inputSize - newH) / 2)

    // 배경을 회색(114)로 채워 일반 YOLO 전처리와 유사하게 함
    ctx.fillStyle = 'rgb(114,114,114)'
    ctx.fillRect(0, 0, inputSize, inputSize)
    ctx.drawImage(img, dx, dy, newW, newH)

    const imageData = ctx.getImageData(0, 0, inputSize, inputSize)
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
    const sampleR = float32Data[0]
    const sampleG = float32Data[numPixels]
    const sampleB = float32Data[2 * numPixels]
    console.log('🔧 정규화 샘플:', { R: sampleR, G: sampleG, B: sampleB })
    
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
  const postprocess = (output, imgW, imgH, padDx, padDy, scale, confThreshold = 0.25) => {
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

    const keep = nms(boxes, scores, 0.45, 100) // IoU 임계값 0.45 유지
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
    console.log('🔍 YOLO 검출 시작:', { imageDataUrl: imageDataUrl?.substring(0, 50) + '...', options })
    
    try {
      await init(options)
      console.log('✅ YOLO 모델 초기화 완료')
    } catch (error) {
      console.error('❌ YOLO 모델 초기화 실패:', error)
      throw error
    }

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

    const { imageData, scale, dx, dy } = letterbox(img)
    console.log('🔧 Letterbox 완료:', { scale, dx, dy, size: inputSize })
    
    // 입력 텐서: 항상 NCHW([1,3,H,W])로 생성
    const input = toNchw(imageData)
    console.log('🔧 입력 텐서 생성:', { shape: input.dims, type: input.type })

    // 입력 이름 자동 감지 (첫 번째 입력 또는 images)
    const inputName = Array.isArray(session.inputNames) && session.inputNames.length > 0
      ? session.inputNames[0]
      : 'images'
    console.log('🔧 YOLO 입력 이름:', inputName)
    const feeds = { [inputName]: input }

    let results
    try {
      console.log('🚀 YOLO 추론 시작...')
      results = await session.run(feeds)
      console.log('✅ YOLO 추론 완료')
    } catch (e) {
      console.error('❌ YOLO 추론 실패:', e)
      throw e
    }

    // 출력 텐서 선택 (첫 번째 또는 적절한 형식 탐색)
    let outputName = session.outputNames?.[0]
    let output = results[outputName]
    console.log('🔧 출력 텐서 선택:', { outputName, hasOutput: !!output, outputNames: session.outputNames })
    
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

    const dets = postprocess(output, img.width, img.height, dx, dy, scale, options.confThreshold || 0.25)
    console.log('🔍 YOLO 원시 검출:', dets?.length || 0)
    if (dets.length > 0) {
      console.log('🔍 검출 결과 샘플:', dets.slice(0, 3).map(d => ({ box: d.box, score: d.score, classId: d.classId })))
    }

    // 결과를 BrickBox 형식으로 변환
    const mapped = []
    for (const d of dets) {
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
    }
    return mapped
  }

  return { init, detect }
}


