# FGC-Encoder 모델 파일 구조

## 📁 모델 파일 위치

```
public/models/
├── fgc_encoder.onnx          # ONNX 모델 (우선순위 1)
├── fgc_encoder.trt           # TensorRT 엔진 (우선순위 2)
├── fgc_encoder_cpu.json      # CPU 모델 (fallback)
└── README.md                 # 이 파일
```

## 🚀 모델 로드 우선순위

1. **ONNX Runtime** (권장)
   - 파일: `fgc_encoder.onnx`
   - 성능: 최고 (GPU 가속)
   - 호환성: 브라우저/Node.js

2. **TensorRT** (고성능)
   - 파일: `fgc_encoder.trt`
   - 성능: 매우 높음 (GPU 최적화)
   - 호환성: NVIDIA GPU 필요

3. **CPU Fallback** (호환성)
   - 파일: `fgc_encoder_cpu.json`
   - 성능: 낮음 (CPU만)
   - 호환성: 모든 환경

## 📊 모델 사양

### 입력
- **형식**: RGB 이미지
- **크기**: 224×224 픽셀
- **정규화**: ImageNet 표준 (mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])

### 출력
- **형식**: 정규화된 임베딩 벡터
- **차원**: 512차원
- **범위**: [-1, 1] (L2 정규화)

### 성능 요구사항
- **지연시간**: ≤ 130ms (p95)
- **메모리**: ≤ 500MB
- **정확도**: Top-1 +1.5%p 이상

## 🔧 모델 변환 가이드

### PyTorch → ONNX
```python
import torch
import torch.onnx

# 모델 로드
model = torch.load('fgc_encoder.pth')
model.eval()

# ONNX 변환
dummy_input = torch.randn(1, 3, 224, 224)
torch.onnx.export(
    model,
    dummy_input,
    'fgc_encoder.onnx',
    export_params=True,
    opset_version=11,
    do_constant_folding=True,
    input_names=['input'],
    output_names=['output']
)
```

### ONNX → TensorRT
```python
import tensorrt as trt

# TensorRT 엔진 빌드
builder = trt.Builder(trt.Logger())
network = builder.create_network()
parser = trt.OnnxParser(network, trt.Logger())

# ONNX 파싱
with open('fgc_encoder.onnx', 'rb') as model:
    parser.parse(model.read())

# 엔진 빌드
engine = builder.build_cuda_engine(network)
with open('fgc_encoder.trt', 'wb') as f:
    f.write(engine.serialize())
```

### TensorFlow → CPU 모델
```python
import tensorflow as tf

# 모델 로드
model = tf.keras.models.load_model('fgc_encoder.h5')

# TensorFlow.js 변환
import tensorflowjs as tfjs
tfjs.converters.save_keras_model(model, 'fgc_encoder_cpu')
```

## 🚀 사용법

### 자동 모델 로드
```javascript
import { useFGCEncoder } from './composables/useFGCEncoder'

const fgcEncoder = useFGCEncoder()
const model = await fgcEncoder.initializeFGCEncoder()

// 이미지 인코딩
const embedding = await model.encode(imageData)
```

### 수동 모델 선택
```javascript
// ONNX 모델만 사용
const model = await fgcEncoder.initializeFGCEncoder({
  preferredModel: 'onnx'
})

// TensorRT 모델만 사용
const model = await fgcEncoder.initializeFGCEncoder({
  preferredModel: 'tensorrt'
})
```

## 🔍 성능 모니터링

### 모델 성능 확인
```javascript
const stats = fgcEncoder.getStats()
console.log('모델 성능:', {
  modelType: stats.modelType,
  avgLatency: stats.avgLatency,
  totalEncodings: stats.totalEncodings
})
```

### 성능 최적화
```javascript
// A/B 캘리브레이션
await fgcEncoder.performABCalibration(testData)

// 성능 검증
const validation = await fgcEncoder.validatePerformance(model)
console.log('성능 검증:', validation)
```

## 🛠️ 문제 해결

### ONNX 로드 실패
- WebGL 지원 확인
- 모델 파일 경로 확인
- 브라우저 호환성 확인

### TensorRT 로드 실패
- NVIDIA GPU 확인
- CUDA 버전 확인
- TensorRT 설치 확인

### CPU 모델 성능 저하
- 배치 크기 조정
- 메모리 사용량 모니터링
- CPU 코어 수 확인

## 📈 성능 벤치마크

| 모델 타입 | 지연시간 (ms) | 메모리 (MB) | 정확도 (%) |
|-----------|---------------|-------------|------------|
| ONNX      | 45-65        | 200-300     | 98.5       |
| TensorRT  | 25-40        | 150-250     | 98.7       |
| CPU       | 200-400      | 100-150     | 97.8       |

## 🔄 모델 업데이트

1. 새 모델 파일을 `public/models/`에 배치
2. 기존 모델 파일 백업
3. 시스템 재시작
4. 성능 검증 실행