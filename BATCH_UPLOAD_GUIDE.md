# 🚀 BrickBox 일괄 업로드 가이드

## 📋 개요
렌더링 작업 중 실시간 Supabase 업로드 대신, 로컬에 저장 후 작업 완료 시 일괄 업로드하는 방식으로 변경합니다.

## 🔄 기존 방식 vs 일괄 업로드 방식

### ❌ 기존 방식 (실시간 업로드)
```
렌더링 → 즉시 Supabase 업로드 → 다음 렌더링
```
**문제점:**
- 네트워크 오류 시 전체 작업 중단
- 렌더링 속도 저하 (업로드 대기)
- 중복 업로드 가능성
- 재시도 어려움

### ✅ 일괄 업로드 방식
```
렌더링 → 로컬 저장 → 모든 렌더링 완료 → 일괄 업로드
```
**장점:**
- 네트워크 오류 시 재시도 가능
- 렌더링 속도 향상
- 중복 업로드 방지
- 백업 자동 생성

## 🚀 설정 방법

### 1단계: 일괄 업로드 환경 설정
```bash
scripts\setup_batch_upload.bat
```

### 2단계: 렌더링 실행 (로컬 저장)
```bash
# 기존 렌더링 명령어와 동일
python scripts/render_ldraw_to_supabase.py --part-id 3001 --count 100
```

### 3단계: 일괄 업로드 실행
```bash
# 자동 실행
scripts\run_batch_upload.bat

# 수동 실행
python scripts/batch_upload_renderings.py output/renders
```

## 📁 디렉토리 구조

```
brickbox/
├── output/
│   ├── renders/              # 로컬 렌더링 결과
│   │   ├── 3001/            # Part ID별 폴더
│   │   │   ├── 3001_000.png
│   │   │   ├── 3001_000.txt
│   │   │   └── 3001_000.json
│   │   └── 3002/
│   └── backup/              # 백업 폴더
│       └── backup_20250107_143022/
├── scripts/
│   ├── batch_upload_renderings.py  # 일괄 업로드 스크립트
│   ├── run_batch_upload.bat        # 자동 실행 배치
│   └── setup_batch_upload.bat      # 환경 설정
└── Supabase/
    └── lego-synthetic/      # 업로드된 파일들
        └── synthetic/
            ├── 3001/
            └── 3002/
```

## 🔧 일괄 업로드 스크립트 옵션

### 기본 사용법
```bash
python scripts/batch_upload_renderings.py output/renders
```

### 고급 옵션
```bash
# 배치 크기 설정 (기본값: 10)
python scripts/batch_upload_renderings.py output/renders --batch-size 20

# 업로드 후 로컬 파일 정리
python scripts/batch_upload_renderings.py output/renders --cleanup

# 모든 옵션 조합
python scripts/batch_upload_renderings.py output/renders --batch-size 15 --cleanup
```

## 📊 일괄 업로드 기능

### 1. 중복 업로드 방지
- Supabase에서 기존 파일 확인
- 이미 업로드된 파일 건너뛰기
- 중복 처리 시간 단축

### 2. 배치 처리
- 설정 가능한 배치 크기 (기본: 10개)
- 배치 간 대기 시간 (API 제한 방지)
- 진행률 표시

### 3. 오류 처리
- 개별 파일 업로드 실패 시 계속 진행
- 실패한 파일 목록 기록
- 재시도 가능

### 4. 백업 관리
- 업로드 완료 후 로컬 파일 백업
- 백업 폴더 자동 생성
- 오래된 백업 자동 정리

## 🎯 사용 시나리오

### 시나리오 1: 일반적인 렌더링 작업
```bash
# 1. 환경 설정
scripts\setup_batch_upload.bat

# 2. 렌더링 실행
python scripts/render_ldraw_to_supabase.py --part-id 3001 --count 50

# 3. 일괄 업로드
scripts\run_batch_upload.bat
```

### 시나리오 2: 대량 렌더링 작업
```bash
# 1. 여러 파트 렌더링
python scripts/render_ldraw_to_supabase.py --part-id 3001 --count 100
python scripts/render_ldraw_to_supabase.py --part-id 3002 --count 100
python scripts/render_ldraw_to_supabase.py --part-id 3003 --count 100

# 2. 모든 결과 일괄 업로드
python scripts/batch_upload_renderings.py output/renders --batch-size 20
```

### 시나리오 3: 네트워크 문제 해결
```bash
# 1. 업로드 실패 시 재시도
python scripts/batch_upload_renderings.py output/renders

# 2. 특정 파트만 재업로드
python scripts/batch_upload_renderings.py output/renders/3001
```

## 🔍 모니터링 및 디버깅

### 업로드 상태 확인
```bash
# Supabase에서 확인
SELECT part_id, COUNT(*) as file_count 
FROM synthetic_dataset 
GROUP BY part_id 
ORDER BY created_at DESC;
```

### 로그 확인
```bash
# 일괄 업로드 로그
python scripts/batch_upload_renderings.py output/renders 2>&1 | tee upload.log
```

### 로컬 파일 확인
```bash
# 렌더링 결과 확인
dir output\renders /s

# 백업 파일 확인
dir output\backup /s
```

## ⚙️ 설정 파일

### batch_upload_config.json
```json
{
  "batch_upload": {
    "enabled": true,
    "batch_size": 10,
    "upload_delay": 0.5,
    "batch_delay": 2.0,
    "cleanup_after_upload": true,
    "keep_backup": true
  },
  "local_storage": {
    "output_dir": "output/renders",
    "backup_dir": "output/backup",
    "max_backup_age_days": 30
  },
  "supabase": {
    "bucket": "lego-synthetic",
    "table": "synthetic_dataset",
    "check_existing": true
  }
}
```

## 🚨 문제 해결

### 업로드 실패
```bash
# 1. 네트워크 연결 확인
ping supabase.co

# 2. Supabase 인증 확인
python -c "from supabase import create_client; print('✅ Supabase 연결 확인')"

# 3. 재시도
python scripts/batch_upload_renderings.py output/renders
```

### 메모리 부족
```bash
# 배치 크기 줄이기
python scripts/batch_upload_renderings.py output/renders --batch-size 5
```

### 디스크 공간 부족
```bash
# 백업 정리
python scripts/cleanup_backups.py

# 로컬 파일 정리 (업로드 완료 후)
python scripts/batch_upload_renderings.py output/renders --cleanup
```

## 📈 성능 최적화

### 배치 크기 조정
- **소용량 파일**: 배치 크기 20-30
- **대용량 파일**: 배치 크기 5-10
- **네트워크 느림**: 배치 크기 5

### 업로드 순서
1. 작은 파일부터 업로드
2. 중요한 파트 우선 업로드
3. 실패한 파일 재시도

## 🎉 완료!

이제 렌더링 작업을 더 효율적으로 관리할 수 있습니다!

**핵심 장점:**
- ✅ 네트워크 오류 시 재시도 가능
- ✅ 렌더링 속도 향상
- ✅ 중복 업로드 방지
- ✅ 백업 자동 생성
- ✅ 배치 처리로 효율성 증대
