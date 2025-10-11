# Supabase 실시간 구독 활성화 가이드

## 문제 상황
`AutomatedTrainingDashboard.vue`에서 다음과 같은 오류가 반복적으로 발생합니다:
```
📡 training_jobs 채널 구독 상태: CHANNEL_ERROR
📡 training_metrics 채널 구독 상태: CHANNEL_ERROR
📡 model_registry 채널 구독 상태: CHANNEL_ERROR
```

## 원인
Supabase에서 실시간 구독이 작동하려면 다음이 필요합니다:
1. **테이블에 실시간 구독 활성화**
2. **Row Level Security (RLS) 정책 설정**
3. **적절한 권한 설정**

## 해결 방법

### 방법 1: SQL Editor에서 직접 실행 (권장)
1. Supabase Dashboard → **SQL Editor**
2. `scripts/enable_realtime_subscriptions.sql` 파일 내용을 복사하여 실행

### 방법 2: 수동으로 Supabase Dashboard에서 설정

#### 2-1. Supabase Dashboard 접속
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. **Database** → **Replication** 메뉴로 이동

#### 2-2. 실시간 구독 활성화
다음 테이블들에 대해 실시간 구독을 활성화:
- `training_jobs`
- `training_metrics`
- `model_registry`

#### 2-3. RLS 정책 설정
**Authentication** → **Policies**에서 다음 정책들을 생성:

**training_jobs 테이블:**
```sql
CREATE POLICY "Enable all access for training_jobs" ON training_jobs
    FOR ALL USING (true) WITH CHECK (true);
```

**training_metrics 테이블:**
```sql
CREATE POLICY "Enable all access for training_metrics" ON training_metrics
    FOR ALL USING (true) WITH CHECK (true);
```

**model_registry 테이블:**
```sql
CREATE POLICY "Enable all access for model_registry" ON model_registry
    FOR ALL USING (true) WITH CHECK (true);
```


## 확인 방법

### 1. 실시간 구독 상태 확인
```sql
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('training_jobs', 'training_metrics', 'model_registry');
```

### 2. RLS 정책 확인
```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('training_jobs', 'training_metrics', 'model_registry');
```

### 3. 브라우저 콘솔에서 확인
실시간 구독이 활성화되면 다음과 같은 메시지가 표시됩니다:
```
✅ training_jobs 채널 구독 성공
✅ training_metrics 채널 구독 성공
✅ model_registry 채널 구독 성공
```

## 문제 해결

### 여전히 CHANNEL_ERROR가 발생하는 경우:

1. **네트워크 연결 확인**
   - 인터넷 연결 상태 확인
   - 방화벽 설정 확인

2. **Supabase 프로젝트 상태 확인**
   - 프로젝트가 일시정지되지 않았는지 확인
   - API 키가 유효한지 확인

3. **권한 확인**
   - 사용자에게 해당 테이블에 대한 읽기/쓰기 권한이 있는지 확인

4. **대안: 자동 새로고침 사용**
   - 실시간 구독이 계속 실패하는 경우, 자동 새로고침 간격을 단축하여 사용
   - 현재 설정: 30초 → 10초로 자동 단축됨

## 추가 정보

- **실시간 구독 비용**: Supabase Pro 플랜 이상에서 무제한 사용 가능
- **성능 영향**: 실시간 구독은 최소한의 성능 영향을 미침
- **대안**: 실시간 구독이 불가능한 경우, 폴링 방식(자동 새로고침)을 사용

## 관련 파일
- `scripts/enable_realtime_subscriptions.sql`: 실시간 구독 활성화 SQL
- `src/views/AutomatedTrainingDashboard.vue`: 실시간 구독 로직
