# 깊이 맵 생성 문제 해결 제안

## 문제 확인

현재 상태:
- ✅ depth 폴더 생성됨
- ❌ EXR 파일 없음
- ⚠️ 품질 메트릭: RMS 24.73px, depth_score 0.002 → 폴백 로직 사용 중

**메타데이터 분석 결과**:
- 카메라 파라미터는 정상 저장됨
- 품질 메트릭이 폴백 값 사용 (깊이 맵 없음)

## 원인 추정

### 1. View Layer Depth Pass 미활성화 (가장 유력)
Blender에서 깊이 맵을 렌더링하려면 View Layer의 Pass 설정에서 Depth Pass가 활성화되어 있어야 합니다.

### 2. Render Layers 노드 연결 문제
Compositor 노드의 Render Layers 출력 중 'Depth'가 없을 수 있습니다.

### 3. 렌더링 후 파일 검색 실패
OutputFile 노드의 경로 설정과 실제 저장 경로가 다를 수 있습니다.

## 해결 방안

### 즉시 적용 가능한 수정

#### 수정 1: View Layer Depth Pass 활성화 추가

```python
def _setup_depth_map_rendering(self):
    """깊이 맵 렌더링 설정 (Compositor 노드)"""
    try:
        scene = bpy.context.scene
        
        # 🔧 추가: View Layer의 Depth Pass 활성화
        view_layer = scene.view_layers[0]
        if not view_layer.use_pass_z:
            view_layer.use_pass_z = True
            print("[INFO] View Layer Depth Pass 활성화")
        
        scene.use_nodes = True
        tree = scene.node_tree
        # ... 기존 코드 ...
```

#### 수정 2: 렌더링 후 명시적 파일 저장 확인

```python
# 렌더링 후
bpy.ops.render.render(write_still=True)

# Compositor 노드 강제 실행
bpy.context.scene.use_nodes = True
tree = bpy.context.scene.node_tree
if tree:
    # OutputFile 노드 강제 업데이트
    for node in tree.nodes:
        if node.type == 'OUTPUT_FILE' and node.name == 'DepthOutput':
            node.file_slots[0].save_as_render = True
            break

# 파일 찾기 전 짧은 대기
import time
time.sleep(0.5)
```

#### 수정 3: 파일 검색 범위 확대

현재 `_locate_rendered_depth_map()` 함수를 개선하여:
- Blender의 기본 출력 디렉토리 확인
- 임시 디렉토리 확인
- 현재 씬 파일 위치 확인

## 권장 조치

1. **즉시 조치**: View Layer Depth Pass 활성화 코드 추가
2. **검증**: 렌더링 후 깊이 맵 파일 생성 여부 확인
3. **로그 확인**: Blender 콘솔에서 경고 메시지 확인

## 참고

Blender 4.5에서 깊이 맵 렌더링을 위해서는:
- View Layer > Passes > Data > Z (Depth) 활성화 필수
- Compositor 노드에서 Render Layers > Depth 출력 연결 필수
- OutputFile 노드의 경로 설정 확인 필수

