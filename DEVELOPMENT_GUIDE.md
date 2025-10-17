# 🚀 BrickBox 개발 환경 가이드

## 📋 개요

BrickBox AI 시스템의 개발 환경 설정 및 실행 방법을 안내합니다.

## 🛠️ 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`env.template` 파일을 `.env`로 복사하고 실제 값으로 수정:

```bash
cp env.template .env
```

필수 환경변수:
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase 익명 키
- `VITE_SUPABASE_SERVICE_ROLE`: Supabase 서비스 역할 키

## 🚀 서비스 실행

### 전체 서비스 실행 (권장)

```bash
npm run dev:full
```

이 명령어는 다음 4개 서비스를 동시에 실행합니다:
- **Vite 서버** (포트 3000) - 프론트엔드
- **Training API** (포트 3005) - 머신러닝 학습 API
- **Worker** (포트 3006) - 백그라운드 작업 처리
- **Synthetic API** (포트 3007) - 합성 데이터셋 렌더링

### 개별 서비스 실행

#### 프론트엔드만 실행
```bash
npm run dev
```

#### API 서버만 실행
```bash
npm run api
```

#### Worker 서버만 실행
```bash
npm run worker
```

#### Synthetic API만 실행
```bash
npm run synthetic
```

## 🌐 접속 URL

| 서비스 | URL | 설명 |
|--------|-----|------|
| **프론트엔드** | http://localhost:3000 | Vue.js 메인 애플리케이션 |
| **합성 데이터셋** | http://localhost:3000/synthetic-dataset | 3D 렌더링 관리 페이지 |
| **Training API** | http://localhost:3005 | 머신러닝 학습 API |
| **Synthetic API** | http://localhost:3007 | 합성 데이터셋 렌더링 API |

## 🔧 개발 워크플로우

### 프론트엔드 개발
```bash
npm run dev
```
- Vue.js 컴포넌트 수정
- 스타일링 작업
- 라우팅 설정

### API 개발
```bash
npm run api
```
- Express.js API 엔드포인트 개발
- 데이터베이스 연동 테스트

### 전체 통합 테스트
```bash
npm run dev:full
```
- 모든 서비스가 연동된 상태에서 테스트
- synthetic-dataset 페이지 렌더링 테스트

## 🛑 서비스 종료

### 전체 종료
```bash
# 터미널에서 Ctrl+C
# 또는
taskkill /IM node.exe /F  # Windows
```

### 개별 종료
```bash
# 특정 포트의 프로세스 찾기
netstat -ano | findstr :3000

# 프로세스 종료
taskkill /PID <PID번호> /F
```

## 🐛 문제 해결

### 포트 충돌 (EADDRINUSE)
```bash
# 모든 Node.js 프로세스 종료
taskkill /IM node.exe /F

# 다시 실행
npm run dev:full
```

### 환경변수 문제
- `.env` 파일이 존재하는지 확인
- `env.template`을 참고하여 필수 변수 설정 확인

### 의존성 문제
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

## 📁 프로젝트 구조

```
brickbox/
├── src/                    # 프론트엔드 소스
│   ├── views/             # Vue 페이지 컴포넌트
│   ├── composables/       # Vue 컴포저블
│   └── components/        # 재사용 컴포넌트
├── server/                # 백엔드 서버
│   ├── training-api.js    # 학습 API 서버
│   ├── worker.js         # 백그라운드 워커
│   └── synthetic-api.js  # 합성 데이터셋 API
├── package.json          # 프로젝트 설정
├── env.template          # 환경변수 템플릿
└── vite.config.js       # Vite 설정
```

## ✅ 체크리스트

- [ ] Node.js 22+ 설치됨
- [ ] `npm install` 완료
- [ ] `.env` 파일 설정 완료
- [ ] `npm run dev:full` 실행 성공
- [ ] http://localhost:3000 접속 가능
- [ ] http://localhost:3000/synthetic-dataset 페이지 렌더링 확인

## 🎯 다음 단계

1. **Supabase 연결**: 실제 데이터베이스 연결 설정
2. **Blender 연동**: 3D 렌더링 파이프라인 설정
3. **AI 모델**: ONNX 런타임 연동 테스트
4. **배포**: 프로덕션 환경 설정
