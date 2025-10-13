# 🚀 BrickBox 빠른 시작 가이드

## 📋 개발 환경 설정

### 1️⃣ 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```bash
# .env
SUPABASE_URL=https://npferbxuxocbfnfbpcnz.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00
PYTHONIOENCODING=utf-8

# Vite 환경 변수 (기존)
VITE_SUPABASE_URL=https://npferbxuxocbfnfbpcnz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk
```

### 2️⃣ Python 패키지 설치

```bash
pip install -r requirements.txt
```

### 3️⃣ Node.js 패키지 설치

```bash
npm install
```

---

## 🎯 실행 방법

### 옵션 1: Vite + 워커 자동 실행 (추천) ⭐

```bash
npm run dev
```

이 명령어는 다음을 동시에 실행합니다:
- 🔵 Vite 개발 서버 (`http://localhost:5173`)
- 🟢 임베딩 워커 (백그라운드)

**출력 예시:**
```
[vite]   VITE v5.0.0  ready in 500 ms
[vite]   ➜  Local:   http://localhost:5173/
[worker] 🤖 BrickBox 임베딩 워커 시작
[worker] 📱 Device: cpu
[worker] 🔄 워커 실행 중...
```

### 옵션 2: Vite만 실행 (워커 없이)

```bash
npm run dev:no-worker
```

### 옵션 3: 모든 서비스 실행 (Vite + API 서버 + 워커)

```bash
npm run dev:full
```

이 명령어는 다음을 동시에 실행합니다:
- 🔵 Vite 개발 서버
- 🟡 합성 데이터 API 서버
- 🟢 임베딩 워커

---

## 🛑 중지 방법

### 개발 서버 중지

```
Ctrl + C
```

모든 프로세스(Vite + 워커)가 함께 종료됩니다.

---

## 📊 워커 상태 확인

### 웹 UI에서 확인

1. 브라우저에서 `http://localhost:5173/metadata-management` 접속
2. **CLIP 임베딩** 탭 클릭
3. 통계 및 워커 상태 확인

### 터미널에서 확인

```bash
# 워커 로그 확인 (콘솔에 실시간 출력됨)
# [worker] 접두사가 붙은 로그 확인
```

---

## 🔧 트러블슈팅

### 1. "SUPABASE_URL이 없습니다" 에러

**원인**: `.env` 파일이 없거나 환경 변수가 설정되지 않음

**해결**:
```bash
# 1. .env 파일 생성 (위의 내용 복사)
# 2. 개발 서버 재시작
npm run dev
```

### 2. "ModuleNotFoundError: No module named 'clip'" 에러

**원인**: Python 패키지가 설치되지 않음

**해결**:
```bash
pip install -r requirements.txt
```

### 3. 워커가 실행되지 않음

**원인**: Python이 시스템 PATH에 없음

**해결**:
```bash
# Windows
where python

# Linux/Mac
which python3

# PATH 확인 후, package.json에서 python → python3로 변경 가능
```

### 4. CLIP 모델 다운로드가 느림

**원인**: ViT-L/14 모델이 약 890MB

**해결**:
- 첫 실행 시 자동 다운로드됨 (1-2분 소요)
- 이후 실행은 캐시 사용으로 빠름
- 다운로드 위치: `~/.cache/clip/`

### 5. 워커만 재시작하고 싶음

**방법 1**: 별도 터미널에서 수동 실행
```bash
python scripts/embedding_worker.py
```

**방법 2**: 개발 서버 전체 재시작
```bash
# Ctrl+C로 중지 후
npm run dev
```

---

## 📦 스크립트 설명

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Vite + 워커 자동 실행 ⭐ |
| `npm run dev:no-worker` | Vite만 실행 (워커 없이) |
| `npm run dev:full` | Vite + API 서버 + 워커 모두 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run server` | API 서버만 실행 |
| `npm run worker` | 워커만 실행 |

---

## 🎯 개발 워크플로우

### 일반적인 개발

```bash
# 1. 환경 변수 확인
cat .env

# 2. 개발 서버 + 워커 시작
npm run dev

# 3. 브라우저에서 작업
# http://localhost:5173

# 4. 메타데이터 관리
# http://localhost:5173/metadata-management

# 5. 완료 후 중지
# Ctrl+C
```

### 프론트엔드만 개발 (워커 불필요)

```bash
npm run dev:no-worker
```

### 전체 시스템 테스트

```bash
npm run dev:full
```

---

## 📚 다음 단계

1. ✅ [메타데이터 관리 UI 사용법](README_METADATA_MANAGEMENT.md)
2. ✅ [워커 프로덕션 배포](deployment/WORKER_DEPLOYMENT_GUIDE.md)
3. ✅ [768차원 임베딩 가이드](database/README_EMBEDDING_768.md)

---

## 💡 팁

### 자동 재시작 비활성화

워커의 자동 재시작이 불필요한 경우:

```bash
# dev:no-worker 사용
npm run dev:no-worker

# 필요할 때만 별도 터미널에서 워커 실행
python scripts/embedding_worker.py
```

### GPU 사용

CUDA가 설치된 경우 워커가 자동으로 GPU를 감지하고 사용합니다:

```bash
# 워커 시작 시 로그 확인
[worker] 📱 Device: cuda  # GPU 사용
[worker] 📱 Device: cpu   # CPU 사용
```

### 로그 분리

각 프로세스의 로그를 구분하기 쉽도록 색상과 접두사가 표시됩니다:

- 🔵 `[vite]` - Vite 개발 서버
- 🟢 `[worker]` - 임베딩 워커
- 🟡 `[server]` - API 서버 (dev:full)

---

**✅ 이제 `npm run dev` 한 번으로 전체 개발 환경이 실행됩니다!** 🎉

