# 깊이 맵 Supabase Storage 동기화 분석

## 현재 상태

### ❌ 깊이 맵 EXR 파일은 Supabase Storage에 업로드되지 않음

## 코드 확인 결과

### `upload_to_supabase()` 함수 (line 5177-5512)

업로드되는 파일:
1. ✅ 이미지 (.webp) → `synthetic/{element_id}/images/{uuid}.webp`
2. ✅ 어노테이션 (.txt) → `synthetic/{element_id}/labels/{uuid}.txt`
3. ✅ 메타데이터 JSON (E1) → `synthetic/{element_id}/meta/{uuid}.json`
4. ✅ E2 메타데이터 JSON → `synthetic/{element_id}/meta-e/{uuid}_e2.json`
5. ❌ 깊이 맵 EXR → **업로드 로직 없음**

### `render_single_part()` 함수 (line 6258)

```python
urls = self.upload_to_supabase(image_path, annotation_path, part_id, metadata)
```

`upload_to_supabase()` 호출 시 전달되는 인자:
- `image_path`: 이미지 경로
- `annotation_path`: 어노테이션 경로
- `part_id`: 부품 ID
- `metadata`: 메타데이터

**`depth_path`는 전달되지 않음**

## 현재 구조

### 로컬 저장
```
output/synthetic/6313121/
├── images/6313121_000.webp      ✅ 로컬 저장
├── labels/6313121_000.txt        ✅ 로컬 저장
├── meta/6313121_000.json         ✅ 로컬 저장
├── meta-e/6313121_000_e2.json    ✅ 로컬 저장
└── depth/6313121_000.exr         ✅ 로컬 저장 (Supabase 미업로드)
```

### Supabase Storage
```
synthetic/6313121/
├── images/{uuid}.webp             ✅ 업로드됨
├── labels/{uuid}.txt              ✅ 업로드됨
├── meta/{uuid}.json               ✅ 업로드됨
├── meta-e/{uuid}_e2.json          ✅ 업로드됨
└── depth/{uuid}.exr               ❌ 업로드 안 됨
```

## 영향 분석

### 현재 문제
1. 깊이 맵 파일이 로컬에만 저장됨
2. Supabase Storage에서 깊이 맵 파일에 접근 불가
3. 다른 환경에서 깊이 맵 파일 다운로드 불가

### 필요한 경우
- 깊이 맵 파일을 다른 서버/환경에서 사용해야 하는 경우
- 깊이 맵 파일을 공유하거나 분석해야 하는 경우
- 클라우드 기반 처리 파이프라인이 필요한 경우

### 필요 없는 경우
- 로컬에서만 깊이 맵을 사용하는 경우
- 깊이 맵이 품질 메트릭 계산용으로만 사용되는 경우 (이미 메타데이터에 저장됨)

## 해결 방안

### 방법 1: 깊이 맵 업로드 추가 (권장)

`upload_to_supabase()` 함수에 깊이 맵 업로드 로직 추가:

```python
def upload_to_supabase(self, image_path, annotation_path, part_id, metadata, depth_path=None):
    # ... 기존 코드 ...
    
    # 깊이 맵 업로드 (선택적)
    if depth_path and os.path.exists(depth_path):
        try:
            with open(depth_path, 'rb') as f:
                depth_data = f.read()
            
            depth_filename = f"{unique_id}.exr"
            depth_path_supabase = f"synthetic/{element_id}/depth/{depth_filename}"
            
            result = self.supabase.storage.from_('lego-synthetic').upload(
                depth_path_supabase,
                depth_data,
                file_options={
                    "content-type": "image/x-exr",
                    "upsert": "true",
                    "cache-control": "public, max-age=31536000"
                }
            )
            
            if hasattr(result, 'error') and result.error:
                print(f"[WARN] 깊이 맵 업로드 실패: {result.error}")
            else:
                print(f"[OK] 깊이 맵 업로드 완료: {depth_path_supabase}")
        except Exception as e:
            print(f"[WARN] 깊이 맵 업로드 예외: {e}")
```

그리고 `render_single_part()` 함수에서:

```python
urls = self.upload_to_supabase(image_path, annotation_path, part_id, metadata, depth_path=depth_path)
```

### 방법 2: 선택적 업로드 플래그

깊이 맵 업로드가 필요한 경우에만 활성화:

```python
if args.upload_depth_maps:
    # 깊이 맵 업로드 로직
```

## 권장 사항

### 즉시 필요 시
깊이 맵 파일이 Supabase Storage에 업로드되어야 한다면:
1. `upload_to_supabase()` 함수에 깊이 맵 업로드 로직 추가
2. `render_single_part()`에서 `depth_path` 전달

### 나중에 필요 시
현재는 로컬 저장만으로 충분하다면:
- 깊이 맵은 메타데이터에 `depth_score`로 저장되므로 품질 검증에는 충분
- 필요시 나중에 추가 가능

## 결론

**답변: 아니요, 현재는 로컬 depth 폴더의 EXR 파일이 Supabase Storage에 동기화되지 않습니다.**

- ✅ 로컬 저장: 됨
- ❌ Supabase Storage 업로드: 안 됨
- ✅ 메타데이터 저장: 깊이 맵 검증 결과(`depth_score`)는 메타데이터에 저장됨

필요시 업로드 로직을 추가할 수 있습니다.

