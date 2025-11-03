# 모델 검증 404 오류 해결

## 문제

모델 검증 실행 시 404 오류:
```
POST http://localhost:3012/api/training/validate/34 404 (Not Found)
```

## 원인

`server/training-executor.js`에 검증 API가 추가되었지만, 서버가 재시작되지 않아 새 엔드포인트를 인식하지 못함.

## 해결 방법

### 방법 1: 서버 재시작 (PowerShell 또는 CMD)

**1단계: 실행 중인 서버 종료**

PowerShell 또는 CMD에서:
```powershell
# PID 17464 프로세스 종료
taskkill /F /PID 17464

# 또는 포트로 찾아서 종료
netstat -ano | findstr ":3012"
# 출력된 PID를 사용:
taskkill /F /PID <PID번호>
```

**2단계: 서버 재시작**

터미널에서:
```bash
npm run training-executor
```

또는:
```bash
node --env-file=.env server/training-executor.js
```

**3단계: 서버 시작 확인**

콘솔에 다음 메시지 확인:
```
🧠 BrickBox 학습 실행 서버가 포트 3012에서 실행 중입니다
📡 API 엔드포인트: http://localhost:3012/api/training/
```

### 방법 2: 전체 서비스 재시작

```bash
npm run dev:full
```

### 방법 3: 직접 Python 스크립트 실행 (임시)

서버 재시작이 어려운 경우:

```bash
# 환경 변수 설정
export SUPABASE_URL="https://npferbxuxocbfnfbpcnz.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 검증 실행
python scripts/validate_registered_model.py
```

---

## 검증 완료 후

1. **UI에서 새로고침**: "🔄 새로고침" 버튼 클릭
2. **성능 메트릭 확인**: 검증 결과가 자동으로 표시됨
3. **DB에서 확인**:
```sql
SELECT metrics->'validation_mAP50' as validation_map50
FROM model_registry WHERE id = 34;
```

---

## 추가 개선 사항

- 404 오류 시 더 명확한 안내 메시지 표시
- 서버 상태 확인 기능 추가 (향후)

