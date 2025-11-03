# 깊이 맵 생성 로직 분석

## 각 렌더링마다 깊이 맵 생성

### 코드 흐름 확인

#### 1. `render_single_part()` 함수 호출
각 이미지마다 독립적으로 호출됩니다:
```python
# line 3053, 3065, 3081 등
result = self.render_single_part(part_path, part_id, output_dir, index, ...)
```

#### 2. 고유한 파일명 생성 (line 6078)
```python
uid = f"{base_id_for_filename}_{index:03d}"
# 예: "6313121_000", "6313121_001", "6313121_002" 등
```

#### 3. 깊이 맵 경로 설정 (line 6127-6131)
```python
depth_dir = os.path.join(synthetic_dir, 'depth')
os.makedirs(depth_dir, exist_ok=True)
depth_filename = f"{uid}.exr"  # 각 렌더링마다 다른 파일명
depth_path = os.path.join(depth_dir, depth_filename)
```

#### 4. 깊이 맵 출력 설정 (line 6134)
```python
self._configure_depth_output_path(depth_path)  # 각 렌더링마다 다른 경로
```

#### 5. 렌더링 실행 (line 6140)
```python
render_result = self.render_image_with_retry(image_path)
# 렌더링 시 Compositor 노드가 깊이 맵을 저장
```

#### 6. 깊이 맵 파일 찾기 및 이동 (line 6171-6177)
```python
actual_depth_path = self._locate_rendered_depth_map(depth_path, uid)
if actual_depth_path and os.path.exists(actual_depth_path):
    shutil.move(actual_depth_path, depth_path)
    print(f"[INFO] 깊이 맵 저장: {depth_path}")
```

## 예상 결과

### 정상 동작 시 생성될 파일 구조
```
output/synthetic/6313121/
├── images/
│   ├── 6313121_000.webp
│   ├── 6313121_001.webp
│   └── ...
├── labels/
│   ├── 6313121_000.txt
│   └── ...
├── meta/
│   ├── 6313121_000.json
│   └── ...
├── meta-e/
│   ├── 6313121_000_e2.json
│   └── ...
└── depth/
    ├── 6313121_000.exr  ← 각 렌더링마다 생성
    ├── 6313121_001.exr  ← 각 렌더링마다 생성
    └── ...
```

## 현재 문제

### 코드 구조: ✅ 정상
- 각 렌더링마다 고유한 `uid` 생성
- 각 렌더링마다 다른 `depth_path` 설정
- 각 렌더링마다 `_configure_depth_output_path()` 호출

### 실제 생성: ❌ 실패
- View Layer Depth Pass 미활성화로 인해 깊이 맵이 생성되지 않음
- 따라서 모든 렌더링에서 깊이 맵 파일이 생성되지 않음

## 해결 후 예상 동작

수정 사항 적용 후:
1. **각 렌더링마다** View Layer Depth Pass 활성화
2. **각 렌더링마다** 깊이 맵 EXR 파일 생성
3. **각 이미지와 1:1 대응**하는 깊이 맵 파일 생성

### 예시
- `6313121_000.webp` → `6313121_000.exr`
- `6313121_001.webp` → `6313121_001.exr`
- `6313121_002.webp` → `6313121_002.exr`

## 결론

**답변: 네, 각 렌더링 파일마다 깊이 맵 EXR 파일이 생성되도록 구현되어 있습니다.**

현재는 View Layer Depth Pass 미활성화 문제로 생성되지 않았지만, 수정 사항 적용 후에는 모든 렌더링마다 대응하는 깊이 맵 파일이 생성됩니다.

