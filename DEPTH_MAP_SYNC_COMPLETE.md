# 깊이 맵 Supabase Storage 동기화 구현 완료

## 구현 완료 항목

### ✅ 모든 수정 사항 적용 완료

1. **`upload_to_supabase()` 함수**
   - `depth_path` 파라미터 추가
   - 깊이 맵 EXR 파일 업로드 로직 추가
   - 재시도 로직 (최대 3회)
   - 공개 URL 생성
   - 반환값에 `depth_url`, `depth_path` 추가

2. **`upload_to_supabase_direct_http()` 함수**
   - `depth_path` 파라미터 추가
   - Content-Type 매핑에 `.exr` → `image/x-exr` 추가
   - 병렬 업로드 작업에 깊이 맵 파일 추가

3. **`render_single_part()` 함수**
   - `upload_to_supabase()` 호출 시 `depth_path` 전달

4. **로그 메시지 개선**
   - 깊이 맵 업로드 시작/완료 메시지
   - 경로 정보에 depth 폴더 포함

## Supabase Storage 구조

### 업로드 경로
```
synthetic/{element_id}/
├── images/{uuid}.webp          ✅
├── labels/{uuid}.txt           ✅
├── meta/{uuid}.json            ✅
├── meta-e/{uuid}_e2.json       ✅
└── depth/{uuid}.exr            ✅ (새로 추가)
```

## 동기화 흐름

### 로컬 저장
```
output/synthetic/6313121/
├── images/6313121_000.webp      ✅
├── labels/6313121_000.txt       ✅
├── meta/6313121_000.json          ✅
├── meta-e/6313121_000_e2.json     ✅
└── depth/6313121_000.exr          ✅
```

### Supabase Storage 업로드
```
synthetic/6313121/
├── images/{uuid}.webp           ✅
├── labels/{uuid}.txt            ✅
├── meta/{uuid}.json             ✅
├── meta-e/{uuid}_e2.json        ✅
└── depth/{uuid}.exr             ✅ (동기화 완료)
```

## 구현 특징

### 재시도 로직
- 최대 3회 재시도
- 지수 백오프 (1초 → 2초 → 4초)
- 실패 시 경고 메시지 출력 및 로컬 파일 유지

### 오류 처리
- 깊이 맵 파일이 없는 경우: 경고 메시지, 다른 파일 업로드 계속
- 업로드 실패: 재시도 후 실패 시 경고, 로컬 파일 유지
- 예외 발생: 예외 처리 및 경고 메시지

### Content-Type
- EXR 파일: `image/x-exr`
- 캐시 설정: `public, max-age=31536000`
- Upsert: `true` (덮어쓰기 허용)

## 반환값

### 업로드 성공 시
```python
{
    'image_url': 'https://...',
    'annotation_url': 'https://...',
    'image_path': 'synthetic/6313121/images/{uuid}.webp',
    'annotation_path': 'synthetic/6313121/labels/{uuid}.txt',
    'depth_url': 'https://...',           # 🔧 추가
    'depth_path': 'synthetic/6313121/depth/{uuid}.exr'  # 🔧 추가
}
```

### 깊이 맵이 없는 경우
```python
{
    'image_url': 'https://...',
    'annotation_url': 'https://...',
    'image_path': 'synthetic/6313121/images/{uuid}.webp',
    'annotation_path': 'synthetic/6313121/labels/{uuid}.txt',
    'depth_url': None,           # 깊이 맵 없음
    'depth_path': None           # 깊이 맵 없음
}
```

## 완료 상태

**✅ 모든 파일이 Supabase Storage에 동기화됩니다**

- ✅ 이미지 (.webp)
- ✅ 어노테이션 (.txt)
- ✅ 메타데이터 JSON (E1)
- ✅ E2 메타데이터 JSON
- ✅ 깊이 맵 EXR (새로 추가)

다음 렌더링부터 모든 파일이 자동으로 Supabase Storage에 업로드됩니다.

