# 깊이 맵 및 PnP 재투영 RMS 테스트 가이드

## 테스트 전 확인사항

### 1. 의존성 설치 확인

```bash
# OpenEXR 및 OpenCV 설치 확인
python scripts/install_opencv_opencxr.py

# 또는 수동 설치
pip install --user OpenEXR opencv-python-headless
```

### 2. 기능 테스트

```bash
# 깊이 맵 읽기 기능 테스트
python scripts/test_depth_map_reading.py
```

## 렌더링 테스트

### 1. 단일 부품 렌더링 테스트

```bash
# Blender에서 실행
blender --background --python scripts/render_ldraw_to_supabase.py -- \
  --part-id 3001 \
  --count 1 \
  --output-dir ./output/test
```

**확인 사항**:
- `output/test/3001/images/` 에 WebP 이미지 생성됨
- `output/test/3001/depth/` 에 EXR 파일 생성됨
- `output/test/3001/meta/` 에 메타데이터 JSON 생성됨

### 2. 깊이 맵 생성 확인

**확인할 파일**:
```
output/synthetic/{element_id}/depth/{uid}.exr
```

**확인 방법**:
```bash
# Windows
dir output\synthetic\*\depth\*.exr

# Linux/Mac
find output/synthetic -name "*.exr" -path "*/depth/*"
```

### 3. 카메라 파라미터 저장 확인

**메타데이터 JSON 확인**:
```json
{
  "camera": {
    "intrinsics_3x3": [[fx, 0, cx], [0, fy, cy], [0, 0, 1]],
    "rotation_matrix_3x3": [...],
    "translation": [...],
    "distortion_coeffs": {...}
  }
}
```

**확인 스크립트**:
```python
import json
from pathlib import Path

meta_file = Path("output/synthetic/6179330/meta/6179330_000.json")
data = json.loads(meta_file.read_text())

if "camera" in data and "intrinsics_3x3" in data["camera"]:
    print("✅ 카메라 파라미터 저장됨")
    print(f"K 행렬: {data['camera']['intrinsics_3x3']}")
else:
    print("❌ 카메라 파라미터 누락")
```

## 품질 메트릭 검증

### 1. PnP 재투영 RMS 확인

**메타데이터에서 확인**:
```json
{
  "quality_metrics": {
    "reprojection_rms_px": 0.85,  // ≤1.5px 기준
    "rms": 0.85
  }
}
```

**로그 확인**:
```
[INFO] PnP 재투영 RMS: 0.850px (inliers: 1234/1500)
```

**기준**: ≤1.5px

### 2. 깊이 맵 검증 점수 확인

**메타데이터에서 확인**:
```json
{
  "quality_metrics": {
    "depth_score": 0.92,  // ≥0.85 기준
    "reprojection_rms_px": 0.85
  }
}
```

**로그 확인**:
```
[INFO] 깊이 맵 검증 완료: 0.9200 (valid_ratio: 0.99)
```

**기준**: ≥0.85

### 3. QA 플래그 확인

**메타데이터에서 확인**:
```json
{
  "quality_metrics": {
    "qa_flag": true,  // PASS = true, FAIL_* = false
    "reprojection_rms_px": 0.85,
    "depth_score": 0.92
  }
}
```

**E2 메타데이터에서 확인**:
```json
{
  "qa": {
    "qa_flag": "PASS",
    "qa_flag_runtime": "PASS",
    "qa_flag_strict": "PASS"
  }
}
```

## 실제 렌더링 테스트 스크립트

```python
#!/usr/bin/env python3
"""
렌더링 후 깊이 맵 및 품질 메트릭 검증 테스트
"""

import json
import os
from pathlib import Path

def validate_render_output(part_id, index=0):
    """렌더링 출력 검증"""
    base_dir = Path(f"output/synthetic/{part_id}")
    
    results = {
        "part_id": part_id,
        "index": index,
        "checks": {}
    }
    
    uid = f"{part_id}_{index:03d}"
    
    # 1. 이미지 파일 확인
    image_path = base_dir / "images" / f"{uid}.webp"
    results["checks"]["image_exists"] = image_path.exists()
    
    # 2. 깊이 맵 파일 확인
    depth_path = base_dir / "depth" / f"{uid}.exr"
    results["checks"]["depth_map_exists"] = depth_path.exists()
    if depth_path.exists():
        size_mb = depth_path.stat().st_size / (1024 * 1024)
        results["checks"]["depth_map_size_mb"] = size_mb
    
    # 3. 메타데이터 확인
    meta_path = base_dir / "meta" / f"{uid}.json"
    if meta_path.exists():
        data = json.loads(meta_path.read_text())
        
        # 카메라 파라미터 확인
        results["checks"]["camera_params"] = "camera" in data and "intrinsics_3x3" in data.get("camera", {})
        
        # 품질 메트릭 확인
        qm = data.get("quality_metrics", {})
        results["checks"]["quality_metrics"] = {
            "rms": qm.get("reprojection_rms_px", None),
            "depth_score": qm.get("depth_score", None),
            "qa_flag": qm.get("qa_flag", None)
        }
        
        # 기준 통과 여부
        rms = qm.get("reprojection_rms_px", 999)
        depth = qm.get("depth_score", 0)
        results["checks"]["passes_quality"] = (
            rms <= 1.5 and depth >= 0.85
        )
    
    return results

if __name__ == "__main__":
    # 테스트 실행
    part_id = "3001"
    result = validate_render_output(part_id, 0)
    
    print("=" * 60)
    print("렌더링 출력 검증 결과")
    print("=" * 60)
    print(f"부품 ID: {result['part_id']}")
    print(f"인덱스: {result['index']}")
    print("\n검증 항목:")
    for key, value in result["checks"].items():
        if isinstance(value, bool):
            status = "✅" if value else "❌"
            print(f"  {status} {key}")
        else:
            print(f"  {key}: {value}")
```

## 문제 해결

### OpenEXR Import 오류

**증상**:
```
ImportError: No module named 'OpenEXR'
```

**해결**:
```bash
python scripts/install_opencv_opencxr.py
```

### 깊이 맵 파일이 생성되지 않음

**확인 사항**:
1. Blender Compositor 노드 설정 확인
2. Render Layers에 Depth 출력 활성화 확인
3. 출력 파일 노드 경로 설정 확인

**로그 확인**:
```
[INFO] 깊이 맵 렌더링 활성화: EXR 형식으로 저장
[INFO] 깊이 맵 출력 경로 설정: {path}
[INFO] 깊이 맵 저장: {path}
```

### PnP 계산 실패

**로그 확인**:
```
[WARN] PnP 재투영 RMS 계산 불가, 그래디언트 RMS 사용: 2.91px
```

**원인**:
- 카메라 파라미터 누락
- 3D 모델 버텍스 부족 (< 4개)

**해결**:
- 카메라 파라미터 추출 로직 확인
- 3D 모델 로드 확인

### 깊이 맵 검증 실패

**로그 확인**:
```
[WARN] OpenEXR 모듈 없음, 이미지 기반 폴백 사용
[WARN] EXR 파일 읽기 실패: {error}
```

**원인**:
- OpenEXR 미설치
- EXR 파일 손상

**해결**:
- OpenEXR 재설치
- EXR 파일 무결성 확인

## 예상 결과

### 성공적인 렌더링

```
[INFO] 깊이 맵 렌더링 활성화: EXR 형식으로 저장
[INFO] 카메라 파라미터 추출 완료: K=1234.5, 위치=['1.23', '2.34', '3.45']
[INFO] 깊이 맵 저장: output/synthetic/6179330/depth/6179330_000.exr
[INFO] PnP 재투영 RMS: 0.850px (inliers: 1234/1500)
[INFO] 깊이 맵 검증 완료: 0.9200 (valid_ratio: 0.99)
품질 검증 통과: SSIM 0.985, SNR 45.2, RMS 0.85px, Depth 0.920
```

### 메타데이터 예시

```json
{
  "quality_metrics": {
    "ssim": 0.985,
    "snr": 45.2,
    "rms": 0.85,
    "depth_score": 0.92,
    "qa_flag": true,
    "reprojection_rms_px": 0.85
  },
  "camera": {
    "intrinsics_3x3": [[1234.5, 0, 512], [0, 1234.5, 512], [0, 0, 1]],
    "rotation_matrix_3x3": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    "translation": [-1.23, -2.34, -3.45],
    "distortion_coeffs": {"k1": 0, "k2": 0, "p1": 0, "p2": 0, "k3": 0}
  }
}
```

