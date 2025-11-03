# 🌐 Supabase 웹 대시보드 수동 업로드 가이드

## 📋 개요
Supabase 웹 대시보드를 통한 수동 파일 업로드 방법을 안내합니다.

## 🚀 방법 1: Supabase 웹 대시보드 업로드

### 1단계: Supabase 대시보드 접속
1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 프로젝트 선택: `brickbox`
3. 좌측 메뉴에서 **Storage** 클릭

### 2단계: Storage 버킷 선택
1. **lego-synthetic** 버킷 클릭
2. **synthetic** 폴더로 이동 (없으면 생성)

### 3단계: 파일 업로드
1. **Upload files** 버튼 클릭
2. 업로드할 폴더 선택 또는 파일 드래그 앤 드롭
3. **Upload** 버튼 클릭

### 4단계: 폴더 구조 생성
```
lego-synthetic/
└── synthetic/
    ├── 3001/          # Part ID별 폴더
    │   ├── 3001_000.png
    │   ├── 3001_000.txt
    │   └── 3001_000.json
    └── 3002/
        ├── 3002_000.png
        └── 3002_000.txt
```

## 🚀 방법 2: 로컬 스크립트 사용

### 기본 업로드
```bash
# 폴더 전체 업로드
python scripts/manual_upload_supabase.py "output/renders/3001"

# 원격 폴더명 지정
python scripts/manual_upload_supabase.py "output/renders/3001" "3001_renders"
```

### 데이터베이스 동기화 포함
```bash
# 데이터베이스에 레코드 생성
python scripts/manual_upload_supabase.py "output/renders/3001" --sync-db --part-id 3001
```

### 드래그 앤 드롭 업로드
```bash
# 간단한 드래그 앤 드롭 업로드
scripts\quick_upload.bat

# 옵션 선택 가능한 업로드
scripts\drag_drop_upload.bat
```

## 🎯 사용 시나리오

### 시나리오 1: 단일 파트 업로드
```bash
# 1. 렌더링 완료된 폴더
output/renders/3001/

# 2. 업로드 실행
python scripts/manual_upload_supabase.py "output/renders/3001" --sync-db --part-id 3001
```

### 시나리오 2: 여러 파트 일괄 업로드
```bash
# 1. 모든 파트 폴더 업로드
for /d %%d in (output/renders/*) do (
    python scripts/manual_upload_supabase.py "%%d" --sync-db
)
```

### 시나리오 3: 웹 대시보드 업로드
1. Supabase 대시보드 → Storage → lego-synthetic
2. synthetic 폴더로 이동
3. Part ID별 폴더 생성 (예: 3001, 3002)
4. 파일 드래그 앤 드롭으로 업로드

## 📊 업로드 후 확인

### Supabase Storage 확인
1. 대시보드 → Storage → lego-synthetic
2. synthetic 폴더 내 파일 확인
3. 파일 개수 및 크기 확인

### 데이터베이스 확인
```sql
-- 업로드된 파일 확인
SELECT part_id, COUNT(*) as file_count, 
       MIN(created_at) as first_upload,
       MAX(created_at) as last_upload
FROM synthetic_dataset 
WHERE upload_method = 'manual_folder'
GROUP BY part_id 
ORDER BY last_upload DESC;
```

### 공개 URL 확인
```sql
-- 공개 URL 확인
SELECT part_id, image_url, filename, created_at
FROM synthetic_dataset 
WHERE part_id = '3001'
ORDER BY created_at DESC
LIMIT 10;
```

## 🔧 고급 옵션

### 배치 업로드 스크립트
```python
# 여러 폴더 일괄 업로드
import os
from pathlib import Path

render_folders = Path("output/renders")
for part_folder in render_folders.iterdir():
    if part_folder.is_dir():
        part_id = part_folder.name
        os.system(f'python scripts/manual_upload_supabase.py "{part_folder}" --sync-db --part-id {part_id}')
```

### 파일 필터링
```python
# 특정 파일만 업로드
import glob

# PNG 파일만 업로드
png_files = glob.glob("output/renders/3001/*.png")
for file in png_files:
    # 개별 파일 업로드 로직
    pass
```

## 🚨 문제 해결

### 업로드 실패
```bash
# 1. 네트워크 연결 확인
ping supabase.co

# 2. 인증 확인
python -c "from supabase import create_client; print('[OK] 연결 확인')"

# 3. 파일 권한 확인
dir "output/renders/3001"
```

### 대용량 파일 업로드
```bash
# 파일 크기 확인
dir "output/renders/3001" /s

# 큰 파일 분할 업로드
python scripts/manual_upload_supabase.py "output/renders/3001" --batch-size 5
```

### 중복 파일 처리
```bash
# 기존 파일 덮어쓰기
python scripts/manual_upload_supabase.py "output/renders/3001" --overwrite
```

## 📈 성능 최적화

### 업로드 속도 향상
1. **파일 압축**: ZIP 파일로 압축 후 업로드
2. **배치 크기 조정**: 네트워크 상태에 따라 조정
3. **병렬 업로드**: 여러 폴더 동시 업로드

### 저장 공간 최적화
1. **중복 제거**: 동일한 파일명 확인
2. **압축 저장**: 이미지 품질 조정
3. **정기 정리**: 오래된 파일 삭제

## 🎉 완료!

이제 다양한 방법으로 렌더링 결과를 Supabase에 업로드할 수 있습니다!

**추천 방법:**
- **소량**: 웹 대시보드 드래그 앤 드롭
- **대량**: 로컬 스크립트 자동화
- **정기적**: 배치 스크립트 사용
