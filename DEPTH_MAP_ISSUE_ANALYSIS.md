# 깊이 맵 생성 문제 분석

## 문제 상황
- ✅ depth 폴더 생성됨
- ❌ depth 폴더 내 EXR 파일 없음
- ✅ 카메라 파라미터 정상 저장됨
- ⚠️ 품질 메트릭: RMS 24.73px (기준 초과), depth_score 0.002 (기준 미달) → 폴백 로직 사용

## 원인 분석

### 가능한 원인

1. **Blender OutputFile 노드 경로 문제**
   - `_configure_depth_output_path()`에서 `base_path`와 `file_slots[0].path` 설정
   - Blender는 이 두 값을 조합하여 파일을 저장함
   - 현재 설정: `base_path = os.path.dirname(depth_path)`, `file_slots[0].path = file_name.replace('.exr', '_')`
   - 문제: Blender가 예상 경로에 저장하지 않을 수 있음

2. **렌더링 시점 문제**
   - `bpy.ops.render.render(write_still=True)`는 메인 이미지만 저장
   - Compositor 노드의 OutputFile은 별도로 처리되어야 함
   - 렌더링 후 즉시 파일이 생성되지 않을 수 있음

3. **Render Layers Depth 출력 문제**
   - `render_layers.outputs.get('Depth')`가 None일 수 있음
   - Blender 버전별로 Depth 출력 이름이 다를 수 있음

## 해결 방안

### 즉시 확인 필요
1. Blender 콘솔 로그에서 다음 메시지 확인:
   - `[INFO] 깊이 맵 렌더링 활성화: EXR 형식으로 저장` - 정상
   - `[WARN] Render Layers에 Depth 출력이 없습니다` - 문제
   - `[WARN] 깊이 맵 파일을 찾을 수 없음` - 문제

2. 실제 파일 위치 확인:
   - Blender 출력 디렉토리 (렌더링 시 설정된 경로)
   - 현재 작업 디렉토리
   - `output/synthetic/6313121/` 디렉토리 전체

### 코드 수정 제안

#### 방법 1: 렌더링 후 명시적 파일 확인
렌더링 직후 Compositor 노드의 파일 출력을 확인하고, 완료될 때까지 대기

#### 방법 2: View Layer 설정 확인
Blender의 View Layer에서 Pass 설정 확인 (Depth Pass 활성화 필요)

#### 방법 3: 대안 경로 확인 강화
`_locate_rendered_depth_map()` 함수에서 더 넓은 범위 검색

## 현재 상태

**정상 아님**: 깊이 맵 파일이 생성되지 않았습니다.

메타데이터의 품질 메트릭이 폴백 값(이미지 기반 RMS, edge strength 기반 depth_score)을 사용하고 있어, 실제 PnP 재투영 RMS와 깊이 맵 검증이 수행되지 않았습니다.

## 조치 권장사항

1. **Blender 콘솔 로그 확인**: 렌더링 시 출력된 경고/오류 메시지 확인
2. **View Layer 설정 확인**: Depth Pass가 활성화되어 있는지 확인
3. **수동 테스트**: Blender GUI에서 렌더링하여 깊이 맵 생성 여부 확인
4. **코드 수정**: Blender 버전별 호환성 개선

