# 🔧 후처리 워커 배포 가이드

## 📋 개요

BrickBox 후처리 워커는 메타데이터의 계산 필드(`function`, `connection`, `area_px`, `shape`)를 자동으로 채웁니다.

---

## 🎯 처리 대상

### 자동 채워지는 필드:

| 필드 | 설명 | 예시 |
|------|------|------|
| **function** | 부품 기능 | `building_block`, `mechanical`, `connector`, `decoration` |
| **connection** | 연결 방식 | `stud_connection`, `hinge_connection`, `axle_connection` |
| **area_px** | 픽셀 면적 | `450000` (bbox_ratio 기반 계산) |
| **shape** | 상세 형태 | `curved`, `angular`, `rounded` |

### 추론 방식:

1. **shape_tag 기반 매핑** (주요)
   ```javascript
   'plate' → function: 'building_block', connection: 'stud_connection'
   'gear' → function: 'mechanical', connection: 'axle_connection'
   'hinge' → function: 'connector', connection: 'hinge_connection'
   ```

2. **part_name 기반 추가 추론** (보조)
   - 부품명에 'hinge' 포함 → `hinge_connection`
   - 부품명에 'gear' 포함 → `mechanical`

3. **bbox_ratio 기반 계산** (area_px)
   - `area_px = bbox_ratio[0] * bbox_ratio[1] * resolution²`

---

## 🚀 배포 방법

### 옵션 1: PM2 (추천) ⭐

```bash
# 1. PM2 설치 (없으면)
npm install -g pm2

# 2. 환경 변수 수정
nano deployment/ecosystem.config.js
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 수정

# 3. 워커 시작
pm2 start deployment/ecosystem.config.js --only postprocess-worker

# 4. 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

### 관리 명령어:

```bash
# 상태 확인
pm2 status

# 로그 확인 (실시간)
pm2 logs postprocess-worker

# 재시작
pm2 restart postprocess-worker

# 중지
pm2 stop postprocess-worker

# 삭제
pm2 delete postprocess-worker
```

---

### 옵션 2: Systemd (Linux 서버)

```bash
# 1. 서비스 파일 복사
sudo cp deployment/postprocess-worker.service /etc/systemd/system/

# 2. 환경 변수 수정
sudo nano /etc/systemd/system/postprocess-worker.service
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 수정

# 3. 로그 디렉토리 생성
sudo mkdir -p /var/log/brickbox
sudo chown www-data:www-data /var/log/brickbox

# 4. 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable postprocess-worker
sudo systemctl start postprocess-worker
```

### 관리 명령어:

```bash
# 상태 확인
sudo systemctl status postprocess-worker

# 로그 확인
sudo journalctl -u postprocess-worker -f

# 재시작
sudo systemctl restart postprocess-worker

# 중지
sudo systemctl stop postprocess-worker
```

---

## 🧪 로컬 테스트

### 1. 환경 변수 설정

`.env` 파일에 추가:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. 수동 실행

```bash
# 의존성 설치
npm install

# 워커 실행
node scripts/postprocess_worker.js
```

### 3. 예상 출력

```
============================================================
[WORKER] BrickBox 후처리 워커 시작
============================================================
[TIME] 시작 시간: 2025-10-13T07:00:00.000Z
[BATCH] 배치 크기: 50
[POLL] 폴링 주기: 30초

[OK] Supabase 연결 완료

============================================================
[RUN] 워커 실행 중... (Ctrl+C로 종료)
============================================================

[PROCESSING] 25개 항목 처리 중...
[SUCCESS] 25개 항목 업데이트 완료
  └─ 샘플: 3001 (brick) → function: building_block, connection: stud_connection

[IDLE] 처리할 항목 없음 (07:00:35)
```

---

## 📊 매핑 규칙

### Function 매핑:

| shape_tag | function |
|-----------|----------|
| `plate`, `brick`, `tile`, `slope` | `building_block` |
| `gear`, `axle`, `propeller` | `mechanical` |
| `hinge`, `clip`, `bar`, `chain` | `connector` |
| `wheel`, `tire` | `movement` |
| `animal_figure`, `plant_leaf`, `wing` | `decoration` |
| `minifig_part` | `minifigure` |
| `door`, `window`, `fence` | `structure` |

### Connection 매핑:

| shape_tag | connection |
|-----------|------------|
| `plate`, `brick`, `tile`, `slope` | `stud_connection` |
| `hinge` | `hinge_connection` |
| `clip` | `clip_connection` |
| `bar`, `fence` | `bar_connection` |
| `axle`, `gear`, `wheel` | `axle_connection` |
| `chain` | `chain_connection` |
| `tire` | `friction_fit` |
| `minifig_part` | `ball_joint` |
| `animal_figure` | `integrated` |

---

## 🔍 모니터링

### 처리 상태 확인

SQL 쿼리:

```sql
-- 후처리 대기 중인 항목 수
SELECT COUNT(*) 
FROM parts_master_features
WHERE (feature_json->>'function' = 'unknown' OR feature_json->>'connection' = 'unknown');

-- 후처리 완료된 항목 수
SELECT COUNT(*) 
FROM parts_master_features
WHERE feature_json->>'function' != 'unknown' AND feature_json->>'connection' != 'unknown';

-- function별 분포
SELECT 
  feature_json->>'function' AS function,
  COUNT(*) AS count
FROM parts_master_features
GROUP BY feature_json->>'function'
ORDER BY count DESC;
```

---

## ⚙️ 설정 조정

### `scripts/postprocess_worker.js` 파일 수정:

```javascript
// 배치 크기 조정 (기본: 50)
const BATCH_SIZE = 100  // 더 많은 항목을 한 번에 처리

// 폴링 주기 조정 (기본: 30초)
const POLL_INTERVAL = 60000  // 1분마다 확인

// 업데이트 조건 변경
const UPDATE_CONDITION = "feature_json->>'function' = 'unknown'"  // function만 업데이트
```

---

## 🐛 트러블슈팅

### 1. "환경 변수 설정 필요" 오류

**증상**:
```
[ERROR] 환경 변수 설정 필요:
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
```

**해결**:
```bash
# .env 파일에 추가
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" >> .env
echo "VITE_SUPABASE_ANON_KEY=your-key" >> .env
```

---

### 2. "처리할 항목 없음" 계속 표시

**증상**:
```
[IDLE] 처리할 항목 없음 (07:00:00)
[IDLE] 처리할 항목 없음 (07:00:30)
```

**확인**:
```sql
-- 실제로 대기 중인 항목이 있는지 확인
SELECT COUNT(*) 
FROM parts_master_features
WHERE (feature_json->>'function' = 'unknown' OR feature_json->>'connection' = 'unknown');
```

**해결**: 모든 항목이 이미 처리됨. 새 메타데이터 추가 시 자동 처리됨.

---

### 3. 메모리 부족 오류

**증상**:
```
JavaScript heap out of memory
```

**해결**:
```bash
# 배치 크기 줄이기
nano scripts/postprocess_worker.js
# BATCH_SIZE = 50 → 25로 변경

# 또는 Node.js 메모리 증가
node --max-old-space-size=512 scripts/postprocess_worker.js
```

---

## ✅ 검증

### 업데이트 확인:

```sql
-- 샘플 데이터 확인
SELECT 
  part_id,
  shape_tag,
  feature_json->>'function' AS function,
  feature_json->>'connection' AS connection,
  area_px
FROM parts_master_features
WHERE feature_json->>'function' != 'unknown'
LIMIT 10;
```

**예상 결과**:
```
part_id | shape_tag      | function       | connection       | area_px
--------|----------------|----------------|------------------|--------
3001    | brick          | building_block | stud_connection  | 450000
3003    | plate          | building_block | stud_connection  | 300000
32062   | axle           | mechanical     | axle_connection  | 50000
3937    | hinge          | connector      | hinge_connection | 120000
```

---

## 📈 성능

- **처리 속도**: ~100-200개/초 (규칙 기반)
- **메모리 사용**: ~50-100MB
- **CPU 사용**: ~5-10%
- **폴링 주기**: 30초 (조정 가능)

---

## 🔄 임베딩 워커와 비교

| 항목 | 임베딩 워커 | 후처리 워커 |
|------|-------------|-------------|
| **언어** | Python | JavaScript |
| **모델** | CLIP (ViT-L/14) | 규칙 기반 |
| **처리** | feature_text → 768차원 벡터 | shape_tag → function, connection |
| **속도** | 느림 (~10개/초) | 빠름 (~100개/초) |
| **GPU** | 권장 | 불필요 |
| **메모리** | 1GB | 256MB |

---

## 📚 참고

- 임베딩 워커: `deployment/WORKER_DEPLOYMENT_GUIDE.md`
- 메타데이터 문서: `database/메타데이터.txt`
- 기술 문서: `database/기술문서.txt`

