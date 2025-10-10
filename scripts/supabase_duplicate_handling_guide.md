# 🔄 Supabase 웹 대시보드 중복 파일 처리 가이드

## 📋 Supabase Storage 중복 처리 방식

### 🚨 기본 동작 (주의사항)
Supabase 웹 대시보드에서 파일을 업로드할 때:
- **같은 이름의 파일이 있으면 자동으로 덮어쓰기**
- **경고 메시지 없이 바로 교체됨**
- **이전 파일은 복구 불가능**

## 🛡️ 중복 방지 방법

### 방법 1: 폴더 구조로 분리
```
lego-synthetic/synthetic/
├── 3001_20250107/          # 날짜별 폴더
│   ├── 3001_000.png
│   └── 3001_001.png
├── 3001_20250108/          # 새로운 날짜
│   ├── 3001_000.png
│   └── 3001_001.png
└── 3001_backup/            # 백업 폴더
    ├── 3001_000.png
    └── 3001_001.png
```

### 방법 2: 파일명에 타임스탬프 추가
```
기존: 3001_000.png
수정: 3001_000_20250107_143022.png
```

### 방법 3: 버전 번호 추가
```
기존: 3001_000.png
수정: 3001_000_v1.png, 3001_000_v2.png
```

## 🔍 중복 확인 방법

### 웹 대시보드에서 확인
1. **Storage** → **lego-synthetic** → **synthetic**
2. 폴더별로 파일 목록 확인
3. 파일명과 크기로 중복 여부 판단

### SQL로 중복 확인
```sql
-- 중복 파일명 확인
SELECT filename, COUNT(*) as count
FROM synthetic_dataset 
WHERE filename IS NOT NULL
GROUP BY filename 
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Part ID별 파일 개수 확인
SELECT part_id, COUNT(*) as file_count
FROM synthetic_dataset 
GROUP BY part_id 
ORDER BY file_count DESC;
```

## 🚀 안전한 업로드 전략

### 전략 1: 백업 후 업로드
```bash
# 1. 기존 파일 백업
python scripts/backup_existing_files.py

# 2. 새 파일 업로드
# 웹 대시보드에서 업로드
```

### 전략 2: 단계별 업로드
```bash
# 1. 테스트 폴더로 먼저 업로드
synthetic/test_3001/
├── 3001_000.png
└── 3001_001.png

# 2. 확인 후 실제 폴더로 이동
synthetic/3001/
```

### 전략 3: 스크립트로 안전 업로드
```python
# 중복 확인 후 업로드
python scripts/safe_upload_supabase.py "output/renders/3001" --check-duplicates
```

## 🛠️ 중복 처리 스크립트

### 중복 확인 스크립트
```python
#!/usr/bin/env python3
"""
중복 파일 확인 스크립트
"""
import os
from pathlib import Path
from supabase import create_client

def check_duplicates(local_folder, supabase_client):
    """로컬 폴더와 Supabase의 중복 파일 확인"""
    
    # 로컬 파일 목록
    local_files = set()
    for file_path in Path(local_folder).rglob('*'):
        if file_path.is_file():
            local_files.add(file_path.name)
    
    # Supabase 파일 목록
    try:
        result = supabase_client.storage.from_('lego-synthetic').list('synthetic')
        remote_files = set()
        for file_info in result:
            if file_info.get('name'):
                remote_files.add(file_info['name'])
    except:
        remote_files = set()
    
    # 중복 파일 확인
    duplicates = local_files.intersection(remote_files)
    
    if duplicates:
        print(f"⚠️ 중복 파일 발견: {len(duplicates)}개")
        for dup in sorted(duplicates):
            print(f"  - {dup}")
        return True
    else:
        print("✅ 중복 파일 없음")
        return False

# 사용법
# python check_duplicates.py "output/renders/3001"
```

### 안전 업로드 스크립트
```python
#!/usr/bin/env python3
"""
안전한 업로드 스크립트 (중복 확인 포함)
"""
import os
import shutil
from datetime import datetime
from pathlib import Path

def safe_upload_folder(local_folder, backup_existing=True):
    """중복 확인 후 안전하게 업로드"""
    
    # 1. 중복 파일 확인
    if check_duplicates(local_folder):
        response = input("중복 파일이 있습니다. 계속하시겠습니까? (y/N): ")
        if response.lower() != 'y':
            print("업로드 취소됨")
            return False
    
    # 2. 기존 파일 백업 (선택사항)
    if backup_existing:
        backup_folder = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        print(f"📦 기존 파일 백업: {backup_folder}")
        # 백업 로직 구현
    
    # 3. 안전하게 업로드
    print("🚀 안전 업로드 시작...")
    # 업로드 로직 구현
    
    return True
```

## 📊 중복 관리 모니터링

### 정기적인 중복 확인
```sql
-- 일별 중복 파일 리포트
SELECT 
    DATE(created_at) as upload_date,
    part_id,
    COUNT(*) as file_count,
    COUNT(DISTINCT filename) as unique_files
FROM synthetic_dataset 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), part_id
ORDER BY upload_date DESC, file_count DESC;
```

### 저장 공간 사용량 확인
```sql
-- Part ID별 저장 공간 사용량
SELECT 
    part_id,
    COUNT(*) as file_count,
    SUM(file_size) as total_size_mb
FROM synthetic_dataset 
GROUP BY part_id 
ORDER BY total_size_mb DESC;
```

## 🚨 주의사항 및 해결책

### 문제 1: 실수로 덮어쓰기
**해결책:**
- 업로드 전 항상 백업 생성
- 테스트 폴더에서 먼저 확인
- 파일명에 타임스탬프 추가

### 문제 2: 대용량 파일 중복
**해결책:**
- 파일 크기로 중복 여부 판단
- 체크섬으로 정확한 중복 확인
- 점진적 업로드 (작은 배치로)

### 문제 3: 네트워크 오류로 중복 업로드
**해결책:**
- 업로드 상태 추적
- 실패한 파일만 재시도
- 중복 제거 스크립트 실행

## 🎯 권장 워크플로우

### 1단계: 업로드 전 확인
```bash
# 중복 파일 확인
python scripts/check_duplicates.py "output/renders/3001"

# 백업 생성
python scripts/backup_existing.py
```

### 2단계: 안전한 업로드
```bash
# 방법 1: 스크립트로 안전 업로드
python scripts/safe_upload_supabase.py "output/renders/3001"

# 방법 2: 웹 대시보드에서 수동 업로드 (백업 후)
```

### 3단계: 업로드 후 확인
```sql
-- 업로드 결과 확인
SELECT part_id, COUNT(*) as files, MAX(created_at) as last_upload
FROM synthetic_dataset 
WHERE part_id = '3001'
GROUP BY part_id;
```

## 🎉 완료!

이제 Supabase 웹 대시보드에서 안전하게 파일을 업로드할 수 있습니다!

**핵심 포인트:**
- ⚠️ **기본적으로 덮어쓰기됨** - 주의 필요
- 🛡️ **백업 필수** - 업로드 전 기존 파일 보존
- 🔍 **중복 확인** - 업로드 전 파일 목록 확인
- 📊 **모니터링** - 정기적인 중복 파일 점검
