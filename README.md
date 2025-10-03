# BrickBox

Vue.js와 Supabase를 기반으로 한 현대적인 웹 애플리케이션입니다.

## 🚀 기능

- **Vue.js 3**: Composition API를 사용한 반응형 사용자 인터페이스
- **Supabase 인증**: 안전한 사용자 인증 및 세션 관리
- **반응형 디자인**: 모든 디바이스에서 완벽하게 작동
- **현대적인 UI**: 깔끔하고 직관적인 사용자 경험

## 🛠️ 기술 스택

- **Frontend**: Vue.js 3, Vue Router, Vite
- **Backend**: Supabase (PostgreSQL, 인증, 실시간)
- **스타일링**: CSS3, Flexbox, Grid

## 📦 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

### 3. 프로덕션 빌드

```bash
npm run build
```

## 🔧 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📁 프로젝트 구조

```
src/
├── components/          # 재사용 가능한 컴포넌트
├── views/              # 페이지 컴포넌트
│   ├── Home.vue        # 홈페이지
│   ├── Login.vue       # 로그인/회원가입
│   └── Dashboard.vue   # 대시보드
├── composables/        # Vue Composition API 함수들
│   └── useSupabase.js  # Supabase 클라이언트
├── utils/              # 유틸리티 함수들
├── App.vue             # 메인 앱 컴포넌트
└── main.js             # 앱 진입점
```

## 🔐 인증 기능

- 이메일/비밀번호 로그인
- 사용자 회원가입
- 자동 세션 관리
- 보호된 라우트

## 🎨 주요 페이지

1. **홈페이지** (`/`): 애플리케이션 소개 및 기능 안내
2. **로그인** (`/login`): 사용자 인증 및 회원가입
3. **대시보드** (`/dashboard`): 인증된 사용자 전용 페이지

## 🚀 배포

이 애플리케이션은 Vite를 사용하여 빌드되며, Netlify, Vercel, 또는 다른 정적 호스팅 서비스에 배포할 수 있습니다.

```bash
npm run build
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

## 📝 라이선스

MIT License
