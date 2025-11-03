# 깊이 맵 Supabase Storage 동기화 구현 완료

## 구현 내용

### 1. `upload_to_supabase()` 함수 수정

#### 함수 시그니처 변경
```python
# 기존
def upload_to_supabase(self, image_path, annotation_path, part_id, metadata):

# 수정 후
def upload_to_supabase(self, image_path, annotation_path, part_id, metadata, depth_path=None):
```

#### 깊이 맵 업로드 로직 추가
- 깊이 맵 파일 존재 확인
- EXR 파일 읽기
- Supabase Storage 경로: `synthetic/{element_id}/depth/{uuid}.exr`
- 재시도 로직 (최대 3회)
- Content-Type: `image/x-exr`
- 공개 URL 생성
- 반환값에 `depth_url`, `depth_path` 추가

### 2. `upload_to_supabase_direct_http()` 함수 수정

#### 함수 시그니처 변경
```python
# 기존
def upload_to_supabase_direct_http(self, image_path, annotation_path, part_id, metadata):

# 수정 후
def upload_to_supabase_direct_http(self, image_path, annotation_path, part_id, metadata, depth_path=None):
```

#### 깊이 맵 업로드 추가
- Content-Type 매핑에 `.exr` → `image/x-exr` 추가
- 병렬 업로드 작업에 깊이 맵 파일 추가

### 3. `render_single_part()` 함수 수정

#### 업로드 호출 변경
```python
# 기존
urls = self.upload_to_supabase(image_path, annotation_path, part_id, metadata)

# 수정 후
urls = self.upload_to_supabase(image_path, annotation_path, part_id, metadata, depth_path=depth_path)
```

## 업로드되는 파일 목록

### Supabase Storage 경로 구조
```
synthetic/{element_id}/
├── images/{uuid}.webp          ✅
├── labels/{uuid}.txt            ✅
├── meta/{uuid}.json             ✅
├── meta-e/{uuid}_e2.json        ✅
└── depth/{uuid}.exr             ✅ (새로 추가)
```

## 동기화 흐름

### 1. 로컬 저장
```
output/synthetic/6313121/
├── images/6313121_000.webp      ✅ 로컬 저장
├── labels/6313121_000.txt       ✅ 로컬 저장
├── meta/6313121_000.json        ✅ 로컬 저장
├── meta-e/6313121_000_e2.json   ✅ 로컬 저장
└── depth/6313121_000.exr         ✅ 로컬 저장
```

### 2. Supabase Storage 업로드
```
synthetic/6313121/
├── images/{uuid}.webp           ✅ 업로드
├── labels/{uuid}.txt            ✅ 업로드
├── meta/{uuid}.json             ✅ 업로드
├── meta-e/{uuid}_e2.json        ✅ 업로드
└── depth/{uuid}.exr             ✅ 업로드 (새로 추가)
```

## 반환값 변경

### 기존
```python
{
    'image_url': image_url,
    'annotation_url': annotation_url,
    'image_path': image_path_supabase,
    'annotation_path': annotation_path_supabase
}
```

### 수정 후
```python
{
    'image_url': image_url,
    'annotation_url': annotation_url,
    'image_path': image_path_supabase,
    'annotation_path': annotation_path_supabase,
    'depth_url': depth_url,          # 🔧 추가
    'depth_path': depth_path_supabase  # 🔧 추가
}
```

## 오류 처리

### 깊이 맵 파일이 없는 경우
- 경고 메시지 출력
- 다른 파일 업로드는 계속 진행
- `depth_url`과 `depth_path`는 `None`으로 설정

### 깊이 맵 업로드 실패
- 최대 3회 재시도
- 실패 시 경고 메시지 출력
- 다른 파일 업로드는 계속 진행
- 로컬 파일은 유지됨

## 로그 메시지

### 정상 업로드
```
[INFO] 깊이 맵 업로드 시작: {depth_path}
깊이 맵 upload attempt 1/3: synthetic/{element_id}/depth/{uuid}.exr
깊이 맵 upload completed: synthetic/{element_id}/depth/{uuid}.exr
file size: {size} bytes
[OK] 깊이 맵 공개 URL 생성: {depth_url}
```

### 업로드 실패
```
[WARN] 깊이 맵 파일이 존재하지 않음: {depth_path}
또는
[WARN] 깊이 맵 업로드 실패 - 로컬에만 저장됨
```

## 구현 완료 상태

### ✅ 완료된 항목
1. `upload_to_supabase()` 함수에 깊이 맵 업로드 로직 추가
2. `upload_to_supabase_direct_http()` 함수에 깊이 맵 업로드 로직 추가
3. `render_single_part()` 함수에서 `depth_path` 전달
4. 반환값에 `depth_url`, `depth_path` 추가
5. 오류 처리 및 재시도 로직 추가
6. Content-Type 설정 (`image/x-exr`)
7. 로그 메시지 추가

### 다음 렌더링 시
- 모든 깊이 맵 EXR 파일이 Supabase Storage에 자동 업로드됩니다
- 로컬 저장과 Supabase Storage 동기화가 완료됩니다

