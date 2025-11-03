# 깊이 맵 생성 문제 해결

## 문제점

`output/synthetic/6313121/depth` 폴더가 비어있음 - 깊이 맵 EXR 파일이 생성되지 않음

## 원인 분석

### 1. Compositor 노드 비활성화
`render_image()` 함수에서 `bpy.context.scene.use_nodes = False`로 설정하여 Compositor 노드를 비활성화하고 있었음
- OutputFile 노드가 작동하려면 Compositor가 활성화되어야 함

### 2. 깊이 출력 연결 문제
- Render Layers 노드의 'Depth' 출력이 없을 경우 처리 미흡
- Blender 버전에 따라 'Z' 출력일 수 있음

### 3. 파일명 패턴 검색 부정확
- OutputFile 노드가 생성하는 실제 파일명 패턴과 검색 패턴 불일치

## 수정 사항

### 1. Compositor 노드 활성화 유지
```python
# 기존 (문제)
bpy.context.scene.use_nodes = False  # Compositor 비활성화

# 수정 후
bpy.context.scene.use_nodes = True  # Compositor 활성화 (깊이 맵 생성 필수)
```

### 2. 렌더링 전후 Compositor 확인
```python
# 렌더링 전: OutputFile 노드 활성화 확인
if bpy.context.scene.use_nodes:
    tree = bpy.context.scene.node_tree
    if tree:
        for node in tree.nodes:
            if node.type == 'OUTPUT_FILE':
                node.file_slots[0].save_as_render = True
                node.mute = False

# 렌더링 후: 노드 연결 확인
bpy.context.view_layer.update()
# DepthOutput 노드 연결 상태 확인 및 로그 출력
```

### 3. 깊이 출력 연결 개선
```python
# 'Depth', 'Z', 'Mist' 출력 모두 시도
depth_output_socket = None
if render_layers.outputs.get('Depth'):
    depth_output_socket = render_layers.outputs['Depth']
elif render_layers.outputs.get('Z'):
    depth_output_socket = render_layers.outputs['Z']
elif render_layers.outputs.get('Mist'):
    depth_output_socket = render_layers.outputs['Mist']
```

### 4. 파일명 패턴 검색 개선
```python
# Blender OutputFile 노드가 생성하는 실제 패턴
# base_path + file_slots[0].path + "_0001.exr"
# 예: {base_path}/6313121_000_/6313121_000_0001.exr
# 또는: {base_path}/6313121_000_0001.exr

file_prefix = os.path.basename(expected_path).replace('.exr', '')
possible_names = [
    f"{file_prefix}_0001.exr",  # Blender 기본 패턴
    f"{file_prefix}_0002.exr",
    f"{file_prefix}_0003.exr",
    # ... 기타 패턴
]
```

### 5. OutputFile 노드 설정 강화
```python
depth_output.file_slots[0].use_node_format = False  # 노드 형식 사용 안 함
depth_output.file_slots[0].save_as_render = True  # 렌더링 시 저장
depth_output.mute = False  # 노드 비활성화 안 함
```

## 수정된 코드 위치

### `render_image()` 함수
- **라인 4841**: `use_nodes = True`로 변경

### `render_image()` 함수 (렌더링 전후)
- **라인 4887-4920**: Compositor 노드 확인 및 강제 실행 로직 추가

### `_setup_depth_map_rendering()` 함수
- **라인 1042-1060**: 깊이 출력 연결 개선 (Depth, Z, Mist 시도)

### `_locate_rendered_depth_map()` 함수
- **라인 1189-1199**: 파일명 패턴 검색 개선

## 테스트 방법

1. 단일 부품 렌더링 실행
2. `output/synthetic/{element_id}/depth/` 폴더 확인
3. EXR 파일 존재 여부 확인
4. 로그에서 다음 메시지 확인:
   - `[INFO] 깊이 맵 렌더링 활성화: EXR 형식으로 저장`
   - `[INFO] DepthOutput 노드 연결 확인: 입력 연결됨`
   - `[INFO] 깊이 맵 저장: {path}`

## 예상 결과

다음 렌더링부터:
- `output/synthetic/{element_id}/depth/{uid}.exr` 파일 생성
- Supabase Storage에 자동 업로드
- 메타데이터에 깊이 맵 경로 포함

