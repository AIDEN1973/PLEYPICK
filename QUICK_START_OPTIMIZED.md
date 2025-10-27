# 🚀 BrickBox 최적화된 시작 가이드

## 📋 시작 옵션

### 1. 빠른 시작 (권장)
```bash
npm run dev:quick
```
- **시간**: 5-10초
- **서비스**: 핵심 4개 (Frontend, AI API, WebP API, Training API)
- **특징**: 포트 정리 생략, 최소 대기 시간

### 2. 표준 빠른 시작
```bash
npm run dev:fast
```
- **시간**: 10-15초
- **서비스**: 핵심 4개 + 포트 설정
- **특징**: 포트 설정 포함, 안정성 우선

### 3. 전체 서비스 시작
```bash
npm run dev:full
```
- **시간**: 20-30초 (기존 60-90초에서 단축)
- **서비스**: 모든 9개 서비스
- **특징**: 포트 정리 + 최적화된 시작

## 🔧 최적화 내용

### 서비스 시작 최적화
- **서비스별 대기 시간**: 2초 → 0.5-1.5초
- **타임아웃 단축**: 30초 → 7.5-25초 (서비스별 차등)
- **연결 타임아웃**: 2초 → 1.5초

### 포트 정리 최적화
- **핵심 포트 우선**: 8개 핵심 포트만 정리
- **선택적 전체 정리**: `FULL_CLEANUP=1` 환경변수로 제어
- **정리 시간 단축**: 36개 포트 → 8개 포트

### 서비스별 최적화
- **Frontend/AI API/WebP API**: 7.5초 타임아웃
- **Worker/Postprocess**: 16초 타임아웃  
- **기타 API**: 25초 타임아웃

## 🌐 접속 주소

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Frontend** | http://localhost:3000 | Vue.js 메인 애플리케이션 |
| **AI API** | http://localhost:3005 | AI 추론 API |
| **WebP API** | http://localhost:3004 | WebP 이미지 처리 API |
| **Training API** | http://localhost:3010 | 머신러닝 학습 API |

## 🚀 개발 워크플로우

### 일상적인 개발
```bash
npm run dev:quick  # 5-10초로 빠른 시작
```

### 전체 테스트
```bash
npm run dev:full   # 모든 서비스 시작
```

### 포트 충돌 해결
```bash
npm run cleanup:force  # 강제 포트 정리
npm run dev:quick       # 빠른 재시작
```

## ⚡ 성능 개선 결과

- **기존**: 60-90초 (순차적 시작)
- **개선**: 20-30초 (최적화된 시작)
- **빠른 시작**: 5-10초 (핵심 서비스만)
- **시간 단축**: 약 50-70% 개선

## 🔧 환경 변수

```bash
# 전체 포트 정리 활성화
FULL_CLEANUP=1 npm run dev:full

# 개발 모드 (기존 분석 재실행)
DEV=1 npm run dev:quick
```

## 💡 팁

1. **일상 개발**: `npm run dev:quick` 사용
2. **포트 충돌**: `npm run cleanup:force` 후 재시작
3. **전체 테스트**: `npm run dev:full` 사용
4. **개발 중단**: `Ctrl+C`로 모든 서비스 종료
