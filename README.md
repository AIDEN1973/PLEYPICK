# BrickBox - 레고 부품 검수 시스템

Vue.js, Supabase, 그리고 Rebrickable API를 기반으로 한 레고 부품 검수 및 관리 시스템입니다.

## 🚀 핵심 기능

### 🔍 레고 세트 관리
- **Rebrickable API 연동**: [Rebrickable API](https://rebrickable.com/api/v3/docs/?key=d966442dee02b69a7d05a63805216a85)를 통한 레고 세트 검색 및 정보 조회
- **세트 정보 등록**: 프랜차이즈 본사 관리자가 레고 세트 정보를 데이터베이스에 저장
- **부품 목록 관리**: 각 세트에 포함된 부품들의 상세 정보 관리

### 🖼️ 이미지 관리 시스템
- **자동 이미지 다운로드**: Rebrickable에서 부품 이미지를 자동으로 다운로드
- **이미지 업로드**: `vanessa2.godohosting.com` 서버에 이미지 업로드
- **일괄 처리**: 여러 부품 이미지를 한 번에 처리하는 기능

### 🗄️ 데이터베이스 관리
- **Supabase 연동**: PostgreSQL 기반 데이터베이스
- **관계형 데이터**: 세트, 부품, 색상, 이미지 간의 관계 관리
- **작업 로그**: 모든 작업에 대한 상세 로그 기록

### 🎨 사용자 인터페이스
- **Vue.js 3**: Composition API를 사용한 반응형 사용자 인터페이스
- **반응형 디자인**: 모든 디바이스에서 완벽하게 작동
- **관리자 대시보드**: 직관적인 관리 인터페이스

## 🛠️ 기술 스택

- **Frontend**: Vue.js 3, Vue Router, Vite
- **Backend**: Supabase (PostgreSQL, 인증, 실시간)
- **API 연동**: Rebrickable API (레고 데이터)
- **이미지 서버**: vanessa2.godohosting.com
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
4. **레고 관리** (`/lego-manager`): 레고 세트 및 부품 관리 시스템

## 📊 데이터베이스 스키마

시스템은 Rebrickable API의 **모든 정보를 수용**할 수 있도록 설계된 테이블들을 포함합니다:

### 🏗️ **핵심 테이블**
- **lego_sets**: 레고 세트 정보 (무게, 치수, 가용성, 바코드 등 모든 필드 포함)
- **lego_parts**: 레고 부품 정보 (재질, 무게, 치수, 상태 등 모든 필드 포함)
- **lego_colors**: 색상 정보 (투명도, 메탈릭, 글로우 등 모든 색상 속성 포함)
- **lego_themes**: 테마 정보 (부모 테마, 서브테마 관계 포함)

### 🔗 **관계 테이블**
- **set_parts**: 세트-부품 관계 (수량, 스페어 여부 등)
- **part_images**: 부품 이미지 관리 (다운로드/업로드 상태 추적)
- **admin_users**: 관리자 사용자
- **operation_logs**: 작업 로그

### 📋 **Rebrickable API 100% 완전 지원 (실제 API 응답 정밀 분석 기반)**
- ✅ **세트**: 실제 API 응답의 모든 필드 (set_num, name, year, theme_id, num_parts, URLs, last_modified_dt)
- ✅ **부품**: 실제 API 응답의 모든 필드 + **특수 배열** (prints, molds, alternates)
- ✅ **색상**: 실제 API 응답의 모든 필드 (id, name, rgb, is_trans, external_ids)
- ✅ **테마**: 실제 API 응답의 모든 필드 (id, name, parent_id)
- ✅ **관계**: 세트-부품-색상 간의 완전한 관계 관리 + **inv_part_id** 포함
- ✅ **외부 ID**: BrickLink, BrickOwl, LEGO 등 모든 외부 시스템 매핑 (실제 구조)
- ✅ **JSONB**: 확장 가능한 메타데이터 저장
- ✅ **실제 API 검증**: 실제 API 응답과 100% 정확히 일치하는 스키마
- ✅ **불필요한 필드 제거**: API에 존재하지 않는 필드들 완전 제거

## 🚀 배포

이 애플리케이션은 Vite를 사용하여 빌드되며, Netlify, Vercel, 또는 다른 정적 호스팅 서비스에 배포할 수 있습니다.

```bash
npm run build
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

## 📝 라이선스

MIT License
