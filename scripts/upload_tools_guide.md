# 🚀 BrickBox 통합 업로드 도구 사용 가이드

## 📋 개요
BrickBox에서 사용할 수 있는 모든 업로드 도구들을 하나의 통합 인터페이스에서 실행할 수 있습니다.

## 🎯 **통합 실행 방법 (권장)**

### **모든 도구를 한 곳에서 실행**
```bash
# 통합 도구 실행 (더블클릭)
scripts\run_all_upload_tools.bat
```

**통합 메뉴 옵션:**
1. 빠른 드래그 앤 드롭 업로드
2. 옵션 선택 가능한 업로드
3. 중복 파일 확인
4. **자동 진단 실행 (통합)** ← 새로 추가됨
5. 일괄 업로드 실행
6. 안전 업로드 실행
7. 종료

## 🔧 **통합된 자동 진단 실행 (옵션 4)**

### **통합 진단 기능**
- ✅ **환경 확인**: Supabase 라이브러리 설치 상태 확인
- ✅ **폴더 확인**: 로컬 output 폴더 존재 여부 확인
- ✅ **종합 진단**: 모든 시스템 상태 자동 분석
- ✅ **상세 리포트**: JSON 형태로 진단 결과 저장

### **진단 과정**
```
📋 1단계: 환경 확인
   - Supabase 라이브러리 설치 상태 확인
   - 필요한 라이브러리 자동 설치 안내

📁 2단계: 로컬 output 폴더 확인
   - output\synthetic 폴더 존재 여부 확인
   - 렌더링 작업 완료 여부 확인

🔍 3단계: 업로드 문제 진단 실행
   - 로컬 파일 상태 분석
   - Supabase 연결 상태 확인
   - Storage 버킷 상태 확인
   - 업로드 이력 분석
   - 렌더링 스크립트 설정 확인
```

## 🎯 **개별 도구별 실행 방법**

### 1️⃣ **빠른 드래그 앤 드롭 업로드**
```bash
# 통합 도구에서 실행
scripts\run_all_upload_tools.bat → 1번 선택

# 또는 직접 실행
scripts\quick_upload.bat
```
**사용법:**
1. 통합 도구 실행 후 1번 선택
2. 업로드할 폴더를 창에 드래그 앤 드롭
3. 자동으로 업로드 시작

### 2️⃣ **옵션 선택 가능한 업로드**
```bash
# 통합 도구에서 실행
scripts\run_all_upload_tools.bat → 2번 선택

# 또는 직접 실행
scripts\drag_drop_upload.bat
```
**사용법:**
1. 통합 도구 실행 후 2번 선택
2. 업로드할 폴더 경로 입력 또는 드래그 앤 드롭
3. 업로드 옵션 선택:
   - 기본 업로드
   - 데이터베이스 동기화 포함
   - Part ID 지정 업로드

### 3️⃣ **중복 파일 확인**
```bash
# 통합 도구에서 실행
scripts\run_all_upload_tools.bat → 3번 선택

# 또는 직접 실행
python scripts\check_duplicates.py "output/synthetic/3001"
```
**사용법:**
1. 통합 도구 실행 후 3번 선택
2. 확인할 폴더 경로 입력
3. 로컬 파일과 Supabase 파일 비교
4. 중복 파일 목록 출력

### 4️⃣ **자동 진단 실행 (통합)**
```bash
# 통합 도구에서 실행 (권장)
scripts\run_all_upload_tools.bat → 4번 선택

# 또는 개별 실행
scripts\run_diagnosis.bat
python scripts\diagnose_upload_issue.py output/synthetic
```
**사용법:**
1. 통합 도구 실행 후 4번 선택
2. 자동으로 환경 확인 → 폴더 확인 → 진단 실행
3. 상세 진단 리포트 생성

### 5️⃣ **일괄 업로드 실행**
```bash
# 통합 도구에서 실행
scripts\run_all_upload_tools.bat → 5번 선택

# 또는 직접 실행
scripts\run_batch_upload.bat
```
**사용법:**
1. 통합 도구 실행 후 5번 선택
2. 자동으로 일괄 업로드 실행
3. 배치 크기: 10개씩, 중복 확인: 활성화

### 6️⃣ **안전 업로드 실행**
```bash
# 통합 도구에서 실행
scripts\run_all_upload_tools.bat → 6번 선택

# 또는 직접 실행
python scripts\safe_upload_supabase.py "output/synthetic/3001"
```
**사용법:**
1. 통합 도구 실행 후 6번 선택
2. 업로드할 폴더 경로 입력
3. 중복 확인 + 백업 생성 + 안전 업로드

## 📊 **도구별 특징 비교**

| 도구 | 용도 | 특징 | 추천 상황 |
|------|------|------|-----------|
| `quick_upload.bat` | 빠른 업로드 | 드래그 앤 드롭, 간단함 | 소량 파일 |
| `drag_drop_upload.bat` | 옵션 업로드 | 다양한 옵션 선택 | 중간 규모 |
| `check_duplicates.py` | 중복 확인 | 파일 비교, 상세 분석 | 업로드 전 확인 |
| `run_diagnosis.bat` | 문제 진단 | 종합 진단, 자동 분석 | 문제 해결 |
| `run_batch_upload.bat` | 일괄 업로드 | 대량 처리, 자동화 | 대량 파일 |
| `safe_upload_supabase.py` | 안전 업로드 | 백업 생성, 중복 확인 | 중요한 파일 |

## 🚀 **실행 시나리오**

### **시나리오 1: 처음 사용자 (통합 도구 사용)**
```bash
# 1. 통합 도구 실행
scripts\run_all_upload_tools.bat

# 2. 메뉴에서 "4" 선택 (자동 진단 실행)
# 3. 진단 결과 확인 후 "1" 선택 (빠른 업로드)
```

### **시나리오 2: 대량 파일 업로드 (통합 도구 사용)**
```bash
# 1. 통합 도구 실행
scripts\run_all_upload_tools.bat

# 2. 메뉴에서 "3" 선택 (중복 파일 확인)
# 3. 메뉴에서 "5" 선택 (일괄 업로드 실행)
```

### **시나리오 3: 중요한 파일 업로드 (통합 도구 사용)**
```bash
# 1. 통합 도구 실행
scripts\run_all_upload_tools.bat

# 2. 메뉴에서 "6" 선택 (안전 업로드 실행)
# 3. 폴더 경로 입력 후 안전 업로드 실행
```

### **시나리오 4: 문제 해결 (통합 도구 사용)**
```bash
# 1. 통합 도구 실행
scripts\run_all_upload_tools.bat

# 2. 메뉴에서 "4" 선택 (자동 진단 실행)
# 3. 진단 결과에 따른 해결책 실행
# 4. 필요시 다른 메뉴 옵션 선택
```

### **시나리오 5: 개별 도구 직접 실행**
```bash
# 1. 자동 진단
scripts\run_diagnosis.bat

# 2. 중복 확인
python scripts\check_duplicates.py "output/synthetic"

# 3. 안전 업로드
python scripts\safe_upload_supabase.py "output/synthetic/3001" --sync-db --part-id 3001
```

## 🔧 **문제 해결**

### **실행 오류 시**
```bash
# 1. Python 환경 확인
python --version

# 2. 필요한 라이브러리 설치
pip install supabase requests tqdm

# 3. 환경 변수 확인
echo %VITE_SUPABASE_URL%
echo %VITE_SUPABASE_ANON_KEY%
```

### **업로드 실패 시**
```bash
# 1. 진단 실행
scripts\run_diagnosis.bat

# 2. 중복 확인
python scripts\check_duplicates.py "output/synthetic"

# 3. 안전 업로드로 재시도
python scripts\safe_upload_supabase.py "output/synthetic"
```

## 📝 **로그 및 리포트**

### **진단 리포트**
- 파일명: `upload_diagnosis_YYYYMMDD_HHMMSS.json`
- 내용: 시스템 상태, 문제점, 해결책

### **중복 확인 리포트**
- 파일명: `duplicate_check_report_YYYYMMDD_HHMMSS.json`
- 내용: 중복 파일 목록, 파일 정보

### **업로드 로그**
- 콘솔 출력: 실시간 진행 상황
- 오류 메시지: 실패 원인 및 해결책

## 🎉 **완료!**

이제 모든 업로드 도구를 하나의 통합 인터페이스에서 효과적으로 사용할 수 있습니다!

**핵심 포인트:**
- ✅ **통합 도구**: `scripts\run_all_upload_tools.bat`로 모든 도구 접근
- ✅ **자동 진단 통합**: 환경 확인 → 폴더 확인 → 종합 진단을 한 번에 실행
- ✅ **단계별 실행**: 진단 → 확인 → 업로드 순서로 진행
- ✅ **상황별 선택**: 파일 규모와 중요도에 따라 적절한 도구 선택
- ✅ **문제 해결**: 통합 진단으로 문제 원인 파악 후 해결

**새로운 기능:**
- 🔧 **통합된 자동 진단**: 옵션 4번으로 환경 확인부터 종합 진단까지 한 번에 실행
- 📊 **상세 리포트**: JSON 형태로 진단 결과 자동 저장
- 🎯 **원스톱 솔루션**: 모든 업로드 관련 작업을 하나의 도구에서 처리
