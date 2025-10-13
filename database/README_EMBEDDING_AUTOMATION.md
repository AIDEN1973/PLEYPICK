# 🤖 BrickBox 임베딩 자동화 시스템

## 📋 개요

트리거 기반 자동 임베딩 생성 시스템입니다. 

### 작동 방식

```
1. AI 메타데이터 생성 (feature_text)
   ↓
2. 트리거가 자동으로 embedding_status = 'pending' 설정
   ↓
3. 백그라운드 워커가 10초마다 큐 확인
   ↓
4. pending 항목에 대해 CLIP 임베딩 자동 생성
   ↓
5. embedding_status = 'completed' 업데이트
```

### 장점

- ✅ **자동화**: feature_text 저장 시 자동으로 임베딩 생성 예약
- ✅ **비동기**: 메타데이터 저장은 즉시, 임베딩은 1-2분 후
- ✅ **확장성**: 워커 수 증가로 처리량 확장 가능
- ✅ **복원력**: 워커 재시작 시 자동으로 미완료 작업 재개
- ✅ **모니터링**: 실시간 상태 확인 가능

---

## 🚀 설치 및 실행

### 1단계: DB 스키마 설정

```bash
# Supabase SQL Editor에서 실행
psql -f database/setup_embedding_automation.sql
```

**예상 결과**:
```
========================================
임베딩 자동화 시스템 설정 완료
========================================
embedding_status 컬럼: ✅ 추가됨
트리거 함수: ✅ trg_embedding_pending()
트리거: ✅ trg_auto_embedding
인덱스: ✅ idx_embedding_status, idx_embedding_updated
뷰: ✅ v_embedding_status, v_embedding_queue
========================================

embedding_status | count | percentage
-----------------|-------|------------
pending          | 10    | 100.00
completed        | 0     | 0.00
```

---

### 2단계: 패키지 설치

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install openai-clip supabase
```

**또는 CPU 버전**:
```bash
pip install torch torchvision torchaudio
pip install openai-clip supabase
```

---

### 3단계: 환경 변수 설정

#### Windows (PowerShell)
```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_KEY = "your-service-role-key"
```

#### Linux/Mac
```bash
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_KEY='your-service-role-key'
```

---

### 4단계: 워커 실행

#### 테스트 실행 (포그라운드)
```bash
python scripts/embedding_worker.py
```

**예상 출력**:
```
============================================================
🤖 BrickBox 임베딩 워커 시작
============================================================
⏰ 시작 시간: 2025-10-12 15:30:45
📱 Device: cuda
📦 배치 크기: 10
⏱️  폴링 주기: 10초

⏳ CLIP 모델 로드 중...
✅ CLIP 모델 로드 완료
⏳ Supabase 연결 중...
✅ Supabase 연결 완료

============================================================
🔄 워커 실행 중... (Ctrl+C로 종료)
============================================================

[15:30:50] 📦 10개 부품 처리 중...
✅ 3437            (id=2124) → 완료
✅ 53920pr0003     (id=2125) → 완료
✅ 109575pr0002    (id=2126) → 완료
...
   성공: 10, 실패: 0
   (누적: 성공 10, 실패 0)

[15:31:00] 💤 대기 중... (큐 비어있음)
```

---

#### 프로덕션 실행 (백그라운드)

##### PM2 사용 (권장)
```bash
# PM2 설치
npm install -g pm2

# 워커 시작
pm2 start scripts/embedding_worker.py --name "embedding-worker" --interpreter python3

# 상태 확인
pm2 status

# 로그 확인
pm2 logs embedding-worker

# 재시작
pm2 restart embedding-worker

# 중지
pm2 stop embedding-worker

# 자동 시작 설정
pm2 startup
pm2 save
```

##### Systemd 사용 (Linux)
```bash
# 서비스 파일 생성
sudo nano /etc/systemd/system/embedding-worker.service
```

```ini
[Unit]
Description=BrickBox Embedding Worker
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/brickbox
Environment="SUPABASE_URL=https://..."
Environment="SUPABASE_KEY=..."
ExecStart=/usr/bin/python3 scripts/embedding_worker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 시작
sudo systemctl start embedding-worker
sudo systemctl enable embedding-worker
sudo systemctl status embedding-worker

# 로그 확인
sudo journalctl -u embedding-worker -f
```

---

## 📊 모니터링

### 상태 확인

```sql
-- 전체 상태
SELECT * FROM v_embedding_status;

-- 큐 확인
SELECT 
    part_id,
    LEFT(feature_text, 40) AS feature_text,
    age_seconds,
    CASE 
        WHEN age_seconds < 60 THEN '🟢 신규'
        WHEN age_seconds < 3600 THEN '🟡 1시간 이내'
        ELSE '🔴 오래됨'
    END AS priority
FROM v_embedding_queue
LIMIT 10;

-- 실패한 항목
SELECT id, part_id, feature_text, updated_at
FROM parts_master_features
WHERE embedding_status = 'failed'
ORDER BY updated_at DESC;
```

### 성능 확인

```sql
-- 완료율
SELECT 
    ROUND(COUNT(*) FILTER (WHERE embedding_status = 'completed')::NUMERIC / 
          COUNT(*)::NUMERIC * 100, 2) AS completion_rate
FROM parts_master_features;

-- 평균 처리 시간 (추정)
SELECT 
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_processing_seconds
FROM parts_master_features
WHERE embedding_status = 'completed'
  AND updated_at > created_at;
```

---

## 🔄 테스트

### 트리거 테스트

```sql
-- feature_text 변경 시 자동으로 pending 설정 확인
UPDATE parts_master_features
SET feature_text = '테스트: 듀플로 2x4 브릭, 홈 없음'
WHERE id = 2124;

-- 상태 확인 (pending으로 변경되어야 함)
SELECT id, part_id, feature_text, embedding_status
FROM parts_master_features
WHERE id = 2124;
```

### 워커 테스트

```bash
# 워커 실행 (포그라운드)
python scripts/embedding_worker.py

# 다른 터미널에서 feature_text 변경
psql ... -c "UPDATE parts_master_features SET feature_text = '...' WHERE id = 2124;"

# 워커 로그에서 처리 확인
# ✅ 3437 (id=2124) → 완료
```

---

## ⚙️ 설정

### embedding_worker.py 설정

```python
# 배치 크기 (한 번에 처리할 부품 수)
BATCH_SIZE = 10  # 10 (기본) ~ 100 (고성능)

# 폴링 주기 (큐 확인 주기, 초)
POLL_INTERVAL = 10  # 10 (기본) ~ 60 (부하 낮춤)

# Device (자동 감지)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
```

### 여러 워커 실행 (확장)

```bash
# 워커 3개 실행 (처리량 3배)
pm2 start scripts/embedding_worker.py --name "worker-1" --interpreter python3
pm2 start scripts/embedding_worker.py --name "worker-2" --interpreter python3
pm2 start scripts/embedding_worker.py --name "worker-3" --interpreter python3
```

---

## 🔧 트러블슈팅

### 문제 1: 워커가 항목을 처리하지 않음

```sql
-- 큐 확인
SELECT * FROM v_embedding_queue LIMIT 10;

-- 없으면 수동 설정
UPDATE parts_master_features
SET embedding_status = 'pending'
WHERE clip_text_emb LIKE '[0,0,0,0%' OR clip_text_emb IS NULL;
```

### 문제 2: CUDA Out of Memory

```python
# embedding_worker.py 수정
BATCH_SIZE = 5  # 10 → 5로 축소
DEVICE = "cpu"  # 강제 CPU 사용
```

### 문제 3: 워커가 중단됨

```bash
# PM2 자동 재시작 설정
pm2 start scripts/embedding_worker.py \
  --name "embedding-worker" \
  --interpreter python3 \
  --max-restarts 10 \
  --min-uptime 10000
```

### 문제 4: 실패 항목 재처리

```sql
-- 실패 항목 다시 pending으로
UPDATE parts_master_features
SET embedding_status = 'pending'
WHERE embedding_status = 'failed';
```

---

## 📈 확장 (20,000개 부품)

### 전체 데이터 적용

```sql
-- 모든 부품을 pending으로 설정
UPDATE parts_master_features
SET embedding_status = 'pending'
WHERE clip_text_emb LIKE '[0,0,0,0%' OR clip_text_emb IS NULL;

-- 진행 상황 확인
SELECT * FROM v_embedding_status;
```

### 예상 처리 시간

| 워커 수 | GPU | 처리 속도 | 20,000개 소요 시간 |
|---------|-----|-----------|-------------------|
| 1개 | CUDA | 10개/분 | 약 33시간 |
| 1개 | CPU | 3개/분 | 약 111시간 |
| 3개 | CUDA | 30개/분 | 약 11시간 |
| 5개 | CUDA | 50개/분 | 약 6.7시간 |

---

## 📝 운영 체크리스트

- [ ] DB 스키마 설정 완료
- [ ] 환경 변수 설정 완료
- [ ] 워커 테스트 실행 완료
- [ ] PM2/Systemd 설정 완료
- [ ] 모니터링 쿼리 확인
- [ ] 자동 재시작 설정 완료
- [ ] 로그 rotation 설정
- [ ] 알림 설정 (실패 시)

---

## 🎯 다음 단계

1. ✅ 트리거 기반 자동화 완료
2. ⏳ 워커 실행 및 테스트
3. ⏳ 전체 데이터 적용
4. ⏳ 성능 모니터링
5. ⏳ 알림 시스템 추가

---

**작성일**: 2025-10-12  
**버전**: 1.0  
**상태**: 프로덕션 준비 완료

