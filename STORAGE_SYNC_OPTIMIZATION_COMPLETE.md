# Supabase Storage 동기화 최적화 완료

## 수정 내용

### 변경 전
- ✅ WebP 이미지 업로드
- ✅ TXT 라벨 업로드
- ✅ E1 JSON 업로드
- ✅ E2 JSON 업로드
- ✅ EXR 깊이 맵 업로드

**총 5개 파일 업로드**

### 변경 후
- ✅ WebP 이미지 업로드 (유지)
- ❌ TXT 라벨 업로드 제거
- ❌ E1 JSON 업로드 제거
- ❌ E2 JSON 업로드 제거
- ❌ EXR 깊이 맵 업로드 제거

**총 1개 파일 업로드 (WebP만)**

## 수정된 함수

### 1. `upload_to_supabase()` 함수
- **변경**: 비동기 업로드 큐에 WebP 이미지만 추가
- **제거**: TXT, JSON, EXR 파일 업로드 코드 제거 또는 주석 처리

### 2. `upload_to_supabase_direct_http()` 함수
- **변경**: 병렬 업로드 작업에 WebP 이미지만 추가
- **제거**: TXT, JSON, EXR 파일 업로드 코드 제거

### 3. 반환값 변경
- **변경 전**: `annotation_url`, `annotation_path`, `depth_url`, `depth_path` 포함
- **변경 후**: `image_url`, `image_path`만 포함 (나머지는 `None`)

## 예상 효과

### Storage 용량 절약
- **TXT 라벨**: 약 1-2 KB/파일 × 수백~수천 파일 = 수백 KB ~ 수 MB
- **E1 JSON**: 약 10-50 KB/파일 × 수백~수천 파일 = 수 MB ~ 수십 MB
- **E2 JSON**: 약 2-5 KB/파일 × 수백~수천 파일 = 수 MB
- **EXR 깊이 맵**: 약 1-5 MB/파일 × 수백~수천 파일 = 수백 MB ~ 수 GB ⭐ **가장 큰 절약**

### 업로드 시간 단축
- **변경 전**: 5개 파일 업로드 (이미지 + 라벨 + E1 + E2 + 깊이 맵)
- **변경 후**: 1개 파일 업로드 (이미지만)
- **예상 시간 단축**: 약 **80% 단축**

### 네트워크 대역폭 절약
- EXR 파일이 가장 크므로 제외 시 큰 효과

## 파일 저장 위치

### Supabase Storage (원격)
- ✅ WebP 이미지만 저장
- 경로: `synthetic/{element_id}/images/{uuid}.webp`

### 로컬 저장소 (로컬)
- ✅ TXT 라벨: `output/synthetic/{element_id}/labels/{uid}.txt`
- ✅ E1 JSON: `output/synthetic/{element_id}/meta/{uid}.json`
- ✅ E2 JSON: `output/synthetic/{element_id}/meta-e/{uid}_e2.json`
- ✅ EXR 깊이 맵: `output/synthetic/{element_id}/depth/{uid}.exr`

## 사용 시나리오

### 학습 단계
- **WebP 이미지**: Supabase Storage에서 다운로드 (필요 시)
- **TXT 라벨**: 로컬 파일 사용 (`output/synthetic/`)

### 탐지 단계
- **WebP 이미지**: Supabase Storage에서 다운로드

### 식별 단계
- **모든 로컬 파일 불필요**: DB 테이블에서 직접 조회

### 품질 검증 단계
- **모든 파일**: 로컬 파일 사용 (`output/synthetic/`)

## 완료 상태

✅ WebP 이미지만 Supabase Storage에 업로드
✅ TXT, JSON, EXR 파일은 로컬에만 저장
✅ 반환값 수정 (이미지 정보만 반환)
✅ 로그 메시지 업데이트

**다음 렌더링부터 적용됩니다.**

