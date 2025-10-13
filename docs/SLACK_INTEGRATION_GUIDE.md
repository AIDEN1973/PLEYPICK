# 🔔 Slack 알림 시스템 연동 가이드

BrickBox 메타데이터 시스템의 주요 오류 및 이벤트를 Slack으로 실시간 알림받을 수 있습니다.

---

## ⚠️ 중요 보안 사항

### 우리가 필요한 것

✅ **Incoming Webhook URL만 필요합니다**:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### 필요하지 않은 것 (공유 금지!)

❌ 다음은 **절대 공유하지 마세요**:
- Client Secret
- Client ID
- Signing Secret
- Verification Token
- App Credentials의 모든 정보

이러한 정보가 노출되면 즉시 재생성해야 합니다!

---

## 📋 목차

1. [Slack Webhook URL 생성](#1-slack-webhook-url-생성)
2. [환경 변수 설정](#2-환경-변수-설정)
3. [알림 종류](#3-알림-종류)
4. [연결 테스트](#4-연결-테스트)
5. [트러블슈팅](#5-트러블슈팅)
6. [보안 FAQ](#6-보안-faq)

---

## 1. Slack Webhook URL 생성

### Step 1: Slack 워크스페이스 접속

1. [Slack API 페이지](https://api.slack.com/apps) 접속
2. **"Create New App"** 클릭
3. **"From scratch"** 선택

### Step 2: App 생성

1. **App Name**: `BrickBox Alerts` (또는 원하는 이름)
2. **Workspace**: 알림을 받을 워크스페이스 선택
3. **"Create App"** 클릭

### Step 3: Incoming Webhooks 활성화

1. 왼쪽 사이드바 **"Features"** 섹션에서 **"Incoming Webhooks"** 선택
2. 상단의 **"Activate Incoming Webhooks"** 토글을 **ON**으로 변경
3. 페이지를 아래로 스크롤하여 **"Webhook URLs for Your Workspace"** 섹션 찾기
4. **"Add New Webhook to Workspace"** 버튼 클릭

### Step 4: 채널 선택

1. 알림을 받을 채널 선택 (예: `#brickbox-alerts`)
2. **"Allow"** 클릭

### Step 5: Webhook URL 복사

**"Webhook URLs for Your Workspace"** 섹션에 생성된 URL이 표시됩니다:

```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

이 URL을 복사합니다. (오른쪽의 **"Copy"** 버튼 클릭)

⚠️ **중요 보안 사항**:
- ✅ **이것만 필요합니다**: Webhook URL
- ❌ **필요하지 않음**: Client Secret, Signing Secret, Verification Token
- ❌ **절대 공유 금지**: Webhook URL을 GitHub, 채팅, 이메일 등에 올리지 마세요!
- ✅ **저장 위치**: `.env` 파일만 (`.gitignore`에 포함되어 있는지 확인)

---

## 2. 환경 변수 설정

### `.env` 파일에 추가

프로젝트 루트의 `.env` 파일에 다음 라인을 추가합니다:

```bash
# Slack 알림 설정
VITE_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 개발 환경 vs 프로덕션 환경

`.env.development` (개발):
```bash
VITE_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/DEV/WEBHOOK/URL
```

`.env.production` (프로덕션):
```bash
VITE_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/PROD/WEBHOOK/URL
```

### 서버 재시작

환경 변수 변경 후 **Vite 개발 서버를 재시작**해야 합니다:

```bash
# 서버 중지 (Ctrl+C)
npm run dev  # 재시작
```

---

## 3. 알림 종류

### 🚨 오류 알림 (Error)

#### 1. LLM 분석 실패
- **발생 조건**: LLM 메타데이터 분석 실패, 3회 재시도 초과
- **포함 정보**:
  - 부품 ID
  - 오류 메시지
  - 재시도 횟수

#### 2. 워커 중지 감지
- **발생 조건**: 워커 하트비트가 1분 이상 없을 때
- **포함 정보**:
  - 워커 타입 (임베딩 워커)
  - 마지막 하트비트 시간
  - 중지 시간

#### 3. 데이터베이스 오류
- **발생 조건**: DB 작업 중 오류 발생
- **포함 정보**:
  - 작업 종류
  - 오류 메시지
  - 쿼리 (일부)

### ⚠️ 경고 알림 (Warning)

#### 1. 이미지 마이그레이션 타임아웃
- **발생 조건**: 이미지 마이그레이션이 2분 내에 완료되지 않음
- **포함 정보**:
  - 세트 번호
  - 업로드된 이미지 수
  - 전체 이미지 수
  - 완료율

#### 2. 배치 처리 실패
- **발생 조건**: 세트 저장 중 일부 부품 실패
- **포함 정보**:
  - 세트 번호
  - 성공/실패 부품 수
  - 실패율
  - 샘플 오류 (최대 3개)

### ✅ 성공 알림 (Success)

- 중요한 작업 완료 시 (선택적)

### ℹ️ 정보 알림 (Info)

- 시스템 정보 및 연결 테스트

---

## 4. 연결 테스트

### 브라우저 콘솔에서 테스트

```javascript
// 개발자 도구 (F12) → Console
import { useSlackAlert } from './composables/useSlackAlert'

const { testSlackConnection } = useSlackAlert()
await testSlackConnection()
```

### 성공 시 출력

```
✅ Slack 알림 전송 완료: 🧪 Slack 연결 테스트
```

### 실제 Slack 메시지

다음과 같은 메시지가 지정한 채널에 표시됩니다:

```
🔔 BrickBox 알림

🧪 Slack 연결 테스트
BrickBox 메타데이터 시스템의 Slack 알림 시스템이 정상 작동합니다.

발생 시간: 2025-10-13 14:30:15
레벨: INFO
위치: useSlackAlert.js → testSlackConnection()
```

---

## 5. 트러블슈팅

### 문제: 알림이 전송되지 않음

#### 1. 환경 변수 확인

```bash
# 브라우저 콘솔에서 확인
console.log(import.meta.env.VITE_SLACK_WEBHOOK_URL)
```

**예상 출력**: `https://hooks.slack.com/services/...`  
**오류 출력**: `undefined` → 환경 변수 미설정

#### 2. 서버 재시작 확인

환경 변수 변경 후 반드시 개발 서버를 재시작해야 합니다.

#### 3. Webhook URL 유효성 확인

터미널에서 직접 테스트:

```bash
curl -X POST \
  https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"테스트 메시지"}'
```

**성공**: `ok` 응답  
**실패**: `invalid_payload` 또는 `404` → Webhook URL 재확인

### 문제: "📢 Slack 알림 비활성화 (환경 변수 미설정)" 로그

**원인**: `VITE_SLACK_WEBHOOK_URL` 환경 변수가 설정되지 않음

**해결**:
1. `.env` 파일에 `VITE_SLACK_WEBHOOK_URL` 추가
2. 서버 재시작

### 문제: 알림이 너무 많이 옴

#### 워커 중지 알림 쿨다운

워커 중지 알림은 **5분마다 최대 1회**만 전송됩니다.

쿨다운 시간 조정:
```javascript
// src/composables/useWorkerHealth.js
const alertCooldownMs = 300000 // 5분 → 10분으로 변경: 600000
```

#### 특정 알림 비활성화

```javascript
// src/composables/useSlackAlert.js
// 알림 함수에서 early return 추가

const alertMigrationFailed = async (setNum, stats, errorMessage) => {
  return { success: false, reason: 'disabled' } // 비활성화
  // ... 기존 코드
}
```

---

## 📊 알림 예시

### 🚨 LLM 분석 실패

```
🔔 BrickBox 알림

🤖 LLM 분석 실패
부품 3001의 LLM 메타데이터 분석이 실패했습니다.

발생 시간: 2025-10-13 14:35:22
레벨: ERROR
위치: useMasterPartsPreprocessing.js → analyzePartWithLLM()

상세 정보:
{
  "part_id": "3001",
  "error": "API rate limit exceeded",
  "retry_count": 3,
  "max_retries": 3
}
```

### ⚠️ 이미지 마이그레이션 타임아웃

```
🔔 BrickBox 알림

🖼️ 이미지 마이그레이션 타임아웃
세트 10255-1의 이미지 마이그레이션이 타임아웃되었습니다.
원본 이미지로 LLM 분석을 진행합니다.

발생 시간: 2025-10-13 14:40:15
레벨: WARNING
위치: NewLegoRegistration.vue → waitForMigrationComplete()

상세 정보:
{
  "set_num": "10255-1",
  "uploaded": 85,
  "total": 120,
  "completion_rate": "71%",
  "error": "마이그레이션 타임아웃 (120초 초과)"
}
```

---

## 6. 보안 FAQ

### Q: App Credentials와 Webhook URL의 차이는?

**App Credentials** (OAuth 인증용):
- Client ID, Client Secret, Signing Secret
- 앱이 Slack API에 접근할 때 사용
- **우리는 사용하지 않습니다**
- 절대 공유하면 안 됩니다

**Webhook URL** (메시지 전송용):
- `https://hooks.slack.com/services/...` 형식
- 단방향으로 메시지만 전송
- **우리가 필요한 것입니다**
- `.env` 파일에만 저장하고 GitHub에 커밋하지 마세요

### Q: Webhook URL을 실수로 공유했다면?

1. [Slack API 앱 설정](https://api.slack.com/apps) 접속
2. 해당 앱 선택
3. **"Incoming Webhooks"** 메뉴
4. 노출된 Webhook 옆의 **"Remove"** 클릭
5. **"Add New Webhook to Workspace"**로 새로 생성

### Q: .env 파일이 Git에 커밋되지 않는지 확인하려면?

```bash
# .gitignore 파일 확인
cat .gitignore | grep ".env"

# 출력 예상: .env
```

`.env`가 포함되어 있으면 안전합니다.

### Q: 여러 사람과 협업 시 Webhook URL 공유는?

**안전한 방법**:
1. 각자 개발 환경용 Webhook URL 생성 (개인 Slack 채널)
2. 프로덕션 Webhook URL은 환경 변수 관리 도구 사용:
   - Vercel/Netlify: 환경 변수 설정
   - Docker: Secrets 사용
   - CI/CD: Encrypted Secrets

**절대 하지 마세요**:
- ❌ Slack/Discord에 직접 공유
- ❌ 이메일로 전송
- ❌ 공개 문서에 기록
- ❌ Git에 커밋

---

## 🔧 고급 설정

### 여러 채널에 알림 전송

각 알림 타입별로 다른 채널에 전송하려면:

1. **각 채널별 Webhook URL 생성**
2. **환경 변수 추가**:

```bash
VITE_SLACK_WEBHOOK_ERROR=https://hooks.slack.com/services/.../ERROR_CHANNEL
VITE_SLACK_WEBHOOK_WARNING=https://hooks.slack.com/services/.../WARNING_CHANNEL
VITE_SLACK_WEBHOOK_INFO=https://hooks.slack.com/services/.../INFO_CHANNEL
```

3. **`useSlackAlert.js` 수정**:

```javascript
const webhookUrl = ref({
  error: import.meta.env.VITE_SLACK_WEBHOOK_ERROR,
  warning: import.meta.env.VITE_SLACK_WEBHOOK_WARNING,
  info: import.meta.env.VITE_SLACK_WEBHOOK_INFO
})

// sendSlackAlert 함수에서:
const url = webhookUrl.value[level] || webhookUrl.value.error
```

### 멘션 추가

특정 사용자를 멘션하려면:

```javascript
// useSlackAlert.js의 payload에 추가
const payload = {
  text: `${emoji} *BrickBox 알림* <@USER_ID>`, // USER_ID는 Slack 사용자 ID
  // ...
}
```

Slack 사용자 ID 확인:
1. Slack에서 사용자 프로필 클릭
2. "..." 메뉴 → "프로필 복사" → "멤버 ID 복사"

---

## ✅ 체크리스트

설정이 완료되면 다음을 확인하세요:

- [ ] Slack Webhook URL 생성 완료
- [ ] `.env` 파일에 `VITE_SLACK_WEBHOOK_URL` 추가
- [ ] 개발 서버 재시작
- [ ] 브라우저 콘솔에서 `testSlackConnection()` 실행
- [ ] Slack 채널에 테스트 메시지 수신 확인
- [ ] 실제 오류 발생 시 알림 수신 확인

---

## 📞 문의

Slack 알림 시스템에 대한 문의사항은:
- GitHub Issues에 등록
- 프로젝트 관리자에게 문의

**감사합니다!** 🎉

