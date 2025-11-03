# 깊이 맵 형식 수정 구현 완료

## 구현 내용

### 1. OutputFile 노드 형식 강제 설정

#### `_setup_depth_map_rendering()` 함수
```python
# 🔧 수정됨: 깊이 출력을 EXR 형식으로 강제 설정 (렌더링 전 설정)
depth_output.format.file_format = 'OPEN_EXR'
depth_output.format.color_mode = 'RGB'
depth_output.format.color_depth = '32'
depth_output.format.exr_codec = 'ZIP'

# 🔧 추가: 파일 슬롯별 형식 강제 설정
depth_output.file_slots[0].format.file_format = 'OPEN_EXR'
depth_output.file_slots[0].format.color_mode = 'RGB'
depth_output.file_slots[0].format.color_depth = '32'
depth_output.file_slots[0].format.exr_codec = 'ZIP'
```

**변경 사항**:
- 노드 레벨 형식 설정 (`depth_output.format`)
- 파일 슬롯 레벨 형식 설정 (`file_slots[0].format`)
- 양쪽 모두 EXR로 강제 설정하여 이중 보호

### 2. 렌더링 전 형식 재확인

#### `_configure_depth_output_path()` 함수
```python
# 🔧 추가: 형식 강제 설정 (렌더링 직전 재확인)
depth_output.format.file_format = 'OPEN_EXR'
depth_output.file_slots[0].format.file_format = 'OPEN_EXR'
# ... 기타 형식 설정 ...

# 🔧 추가: 형식 설정 검증
actual_format = depth_output.file_slots[0].format.file_format
if actual_format != 'OPEN_EXR':
    print(f"[WARN] 깊이 맵 형식 불일치: {actual_format}, 재설정 시도")
    depth_output.file_slots[0].format.file_format = 'OPEN_EXR'
    depth_output.format.file_format = 'OPEN_EXR'
```

**변경 사항**:
- 렌더링 직전 형식 재설정
- 형식 검증 및 불일치 시 자동 수정 시도

### 3. 렌더링 전후 형식 검증

#### `render_image()` 함수 - 렌더링 전
```python
# 🔧 추가: 깊이 맵 노드 형식 강제 확인 (렌더링 직전)
if node.name == 'DepthOutput':
    node.format.file_format = 'OPEN_EXR'
    node.file_slots[0].format.file_format = 'OPEN_EXR'
    node.file_slots[0].format.color_mode = 'RGB'
    node.file_slots[0].format.color_depth = '32'
    node.file_slots[0].format.exr_codec = 'ZIP'
    print(f"[INFO] 깊이 맵 노드 형식 재확인: {node.file_slots[0].format.file_format}")
```

#### `render_image()` 함수 - 렌더링 후
```python
# 🔧 추가: 렌더링 후 형식 검증
actual_format = node.file_slots[0].format.file_format
if actual_format != 'OPEN_EXR':
    print(f"[ERROR] 렌더링 후 형식 불일치: {actual_format} (기대: OPEN_EXR)")
    print(f"[ERROR] 깊이 맵이 올바른 형식으로 저장되지 않았을 수 있습니다.")
else:
    print(f"[INFO] 렌더링 후 형식 확인: {actual_format} ✅")
```

**변경 사항**:
- 렌더링 직전 형식 재확인
- 렌더링 후 형식 검증 및 오류 로그 출력

### 4. 파일 저장 시 형식 검증

#### `render_single_part()` 함수
```python
# 🔧 추가: 파일 형식 검증
file_ext = os.path.splitext(actual_depth_path)[1].lower()
if file_ext == '.png':
    print(f"[ERROR] 깊이 맵이 PNG 형식으로 저장됨: {actual_depth_path}")
    print(f"[ERROR] EXR 형식이어야 합니다. Blender OutputFile 노드 설정을 확인하세요.")
elif file_ext == '.exr':
    print(f"[INFO] 깊이 맵 형식 확인: EXR ✅")
else:
    print(f"[WARN] 깊이 맵 형식 예상 외: {file_ext}")

# PNG 파일 처리
if file_ext == '.png' and depth_path.endswith('.exr'):
    depth_path_png = depth_path.replace('.exr', '.png')
    shutil.move(actual_depth_path, depth_path_png)
    print(f"[WARN] PNG 파일 저장: {depth_path_png} (EXR 형식으로 재렌더링 필요)")
    depth_path = None
```

**변경 사항**:
- 저장된 파일의 실제 형식 검증
- PNG 파일 감지 시 경고 및 별도 저장
- EXR 형식 확인 시 성공 로그

### 5. 파일 검색 패턴 개선

#### `_locate_rendered_depth_map()` 함수
```python
possible_names = [
    f"{file_prefix}_0001.exr",  # EXR 형식 (정상)
    f"{file_prefix}_0001.png",  # 🔧 추가: PNG 형식도 검색 (오류 시 대비)
    # ... 기타 패턴 ...
]
```

**변경 사항**:
- PNG 형식 파일도 검색하여 오류 감지 개선

## 검증 포인트

### 3단계 형식 검증
1. **설정 시점**: `_setup_depth_map_rendering()` - 노드 생성 시
2. **렌더링 직전**: `render_image()` - 렌더링 전 형식 재확인
3. **렌더링 직후**: `render_image()` + 파일 저장 시 - 실제 파일 형식 검증

### 로그 메시지
- `[INFO] 깊이 맵 출력 형식 설정: OPEN_EXR (32비트)`
- `[INFO] 깊이 맵 노드 형식 재확인: OPEN_EXR`
- `[INFO] 렌더링 후 형식 확인: OPEN_EXR ✅`
- `[INFO] 깊이 맵 형식 확인: EXR ✅`
- `[ERROR] 깊이 맵이 PNG 형식으로 저장됨` (오류 시)

## 예상 결과

다음 렌더링부터:
- ✅ 깊이 맵이 EXR 형식으로 저장됨
- ✅ 형식 검증 로그 출력
- ✅ 오류 발생 시 즉시 감지 및 경고

## 추가 보완 사항

### 형식 강제 설정 위치
1. 노드 생성 시 (`_setup_depth_map_rendering`)
2. 경로 설정 시 (`_configure_depth_output_path`)
3. 렌더링 직전 (`render_image`)

### 검증 시점
1. 렌더링 후 노드 형식 확인
2. 파일 저장 시 실제 파일 확장자 확인

## 완료 상태

✅ 모든 형식 강제 설정 및 검증 로직 구현 완료

다음 렌더링에서 깊이 맵이 EXR 형식으로 저장되는지 확인하세요.

