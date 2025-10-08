모델 배치 안내

- YOLO11n ONNX 파일을 아래 경로에 배치하세요:
  - public/models/yolo11n.onnx
- 다른 모델을 사용할 경우 파일명을 환경에 맞게 변경하고, useYoloDetector.init({ modelPath }) 옵션으로 경로를 조정하세요.

권장:
- 입력 크기: 640
- WebGPU 지원 브라우저(Chrome/Edge 최신)에서 GPU 추론 사용
- 미지원 환경에서는 WASM/CPU로 자동 폴백

