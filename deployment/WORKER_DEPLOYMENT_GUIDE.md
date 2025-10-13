# 🤖 임베딩 워커 배포 가이드

## 📋 개요

BrickBox 임베딩 워커를 프로덕션 환경에서 안정적으로 실행하는 방법입니다.

---

## 🎯 배포 옵션 비교

| 옵션 | 난이도 | 안정성 | 모니터링 | 추천 환경 |
|------|--------|--------|----------|-----------|
| **Systemd** | ⭐ 쉬움 | ⭐⭐⭐ 높음 | ⭐⭐ 보통 | Linux 서버 |
| **PM2** | ⭐⭐ 보통 | ⭐⭐⭐ 높음 | ⭐⭐⭐ 높음 | Node.js 환경 |
| **Docker** | ⭐⭐ 보통 | ⭐⭐⭐ 높음 | ⭐⭐ 보통 | 컨테이너 환경 |
| **Kubernetes** | ⭐⭐⭐ 어려움 | ⭐⭐⭐ 높음 | ⭐⭐⭐ 높음 | 대규모 클러스터 |
| **Railway** | ⭐ 쉬움 | ⭐⭐⭐ 높음 | ⭐⭐⭐ 높음 | PaaS 선호 |

---

## 1️⃣ Systemd Service (Linux 서버) ⭐ 추천

### 설치

```bash
# 1. 서비스 파일 복사
sudo cp deployment/embedding-worker.service /etc/systemd/system/

# 2. 환경 변수 수정
sudo nano /etc/systemd/system/embedding-worker.service
# SUPABASE_URL, SUPABASE_KEY 수정

# 3. 로그 디렉토리 생성
sudo mkdir -p /var/log/brickbox
sudo chown www-data:www-data /var/log/brickbox

# 4. 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable embedding-worker
sudo systemctl start embedding-worker
```

### 관리 명령어

```bash
# 상태 확인
sudo systemctl status embedding-worker

# 로그 확인
sudo journalctl -u embedding-worker -f

# 재시작
sudo systemctl restart embedding-worker

# 중지
sudo systemctl stop embedding-worker

# 비활성화
sudo systemctl disable embedding-worker
```

### 장점
- ✅ Linux 서버에 기본 내장
- ✅ 자동 재시작
- ✅ 시스템 부팅 시 자동 실행
- ✅ 간단한 설정

---

## 2️⃣ PM2 (Node.js 환경)

### 설치

```bash
# 1. PM2 설치
npm install -g pm2

# 2. 환경 변수 수정
nano deployment/ecosystem.config.js
# SUPABASE_URL, SUPABASE_KEY 수정

# 3. 워커 시작
pm2 start deployment/ecosystem.config.js

# 4. 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

### 관리 명령어

```bash
# 상태 확인
pm2 status

# 로그 확인 (실시간)
pm2 logs embedding-worker

# 로그 확인 (파일)
pm2 logs embedding-worker --lines 100

# 재시작
pm2 restart embedding-worker

# 중지
pm2 stop embedding-worker

# 삭제
pm2 delete embedding-worker

# 모니터링 대시보드
pm2 monit
```

### 장점
- ✅ 웹 대시보드 제공 (`pm2 monit`)
- ✅ 로그 관리 우수
- ✅ 메모리 기반 자동 재시작
- ✅ Node.js 환경과 잘 통합

---

## 3️⃣ Docker Compose

### 설치

```bash
# 1. .env 파일 생성
cat > deployment/.env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
EOF

# 2. Docker Compose 실행
cd deployment
docker-compose -f docker-compose.worker.yml up -d
```

### 관리 명령어

```bash
# 상태 확인
docker-compose -f docker-compose.worker.yml ps

# 로그 확인
docker-compose -f docker-compose.worker.yml logs -f

# 재시작
docker-compose -f docker-compose.worker.yml restart

# 중지
docker-compose -f docker-compose.worker.yml down

# 업데이트 후 재배포
docker-compose -f docker-compose.worker.yml up -d --build
```

### 장점
- ✅ 환경 독립성
- ✅ 쉬운 복제
- ✅ 버전 관리 용이
- ✅ 로컬과 동일한 환경

---

## 4️⃣ Docker (단독)

### 빌드 및 실행

```bash
# 1. 이미지 빌드
docker build -t brickbox-embedding-worker -f deployment/Dockerfile.worker .

# 2. 컨테이너 실행
docker run -d \
  --name embedding-worker \
  --restart always \
  -e SUPABASE_URL="https://your-project.supabase.co" \
  -e SUPABASE_KEY="your-service-role-key" \
  brickbox-embedding-worker
```

### 관리 명령어

```bash
# 상태 확인
docker ps | grep embedding-worker

# 로그 확인
docker logs -f embedding-worker

# 재시작
docker restart embedding-worker

# 중지 및 삭제
docker stop embedding-worker
docker rm embedding-worker
```

---

## 5️⃣ Railway (PaaS)

### 배포

1. Railway 프로젝트 생성
2. GitHub 연동
3. 환경 변수 설정:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key
   PYTHONIOENCODING=utf-8
   ```
4. `Procfile` 생성:
   ```
   worker: python scripts/embedding_worker.py
   ```
5. 자동 배포

### 장점
- ✅ 클릭 몇 번으로 배포
- ✅ 자동 스케일링
- ✅ 모니터링 대시보드
- ✅ GitHub 자동 배포

---

## 6️⃣ Kubernetes (대규모)

```yaml
# deployment/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: embedding-worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: embedding-worker
  template:
    metadata:
      labels:
        app: embedding-worker
    spec:
      containers:
      - name: worker
        image: brickbox-embedding-worker:latest
        env:
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: brickbox-secrets
              key: supabase-url
        - name: SUPABASE_KEY
          valueFrom:
            secretKeyRef:
              name: brickbox-secrets
              key: supabase-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

---

## 🔍 모니터링

### 헬스 체크

워커가 정상적으로 동작하는지 확인:

```bash
# 로그에서 최근 활동 확인
tail -f /var/log/brickbox/embedding-worker.log

# DB에서 상태 확인
psql -d brickbox -c "
SELECT 
    embedding_status, 
    COUNT(*) 
FROM parts_master_features 
GROUP BY embedding_status;
"
```

### 진행률 모니터링

```sql
-- Supabase SQL Editor
SELECT 
    embedding_status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM parts_master_features
GROUP BY embedding_status;
```

### 알림 설정 (선택)

```bash
# 워커가 중지되면 알림 (cron)
*/5 * * * * if ! pgrep -f embedding_worker.py > /dev/null; then echo "Worker down!" | mail -s "Alert" admin@example.com; fi
```

---

## 📊 성능 최적화

### 1. GPU 사용 (CUDA)

워커가 GPU를 사용하도록 설정:

```bash
# CUDA 설치 확인
nvidia-smi

# PyTorch GPU 버전 설치
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# 워커가 자동으로 GPU 감지 및 사용
```

### 2. 배치 크기 조정

`scripts/embedding_worker.py` 수정:

```python
BATCH_SIZE = 20  # 기본 10 → 20 (GPU 환경)
```

### 3. 워커 다중 실행

여러 워커를 동시에 실행 (각각 다른 프로세스):

```bash
# PM2 예시
pm2 start deployment/ecosystem.config.js -i 2  # 2개 인스턴스
```

---

## 🚨 트러블슈팅

### 워커가 시작되지 않음

```bash
# 1. 의존성 확인
pip list | grep -E "torch|clip|supabase"

# 2. 환경 변수 확인
echo $SUPABASE_URL
echo $SUPABASE_KEY

# 3. 수동 실행으로 에러 확인
python scripts/embedding_worker.py
```

### 워커가 자주 재시작됨

```bash
# 메모리 확인
free -m

# CLIP 모델이 메모리 부족으로 실패할 수 있음
# → 최소 4GB RAM 필요 (ViT-L/14)
```

### 임베딩 생성 속도가 느림

```bash
# CPU vs GPU 확인
python -c "import torch; print('CUDA:', torch.cuda.is_available())"

# GPU 없으면 배치 크기 감소
# BATCH_SIZE = 5
```

---

## ✅ 체크리스트

배포 전 확인사항:

- [ ] Python 3.11+ 설치
- [ ] 필수 패키지 설치 (`requirements.txt`)
- [ ] CLIP 모델 다운로드 (ViT-L/14, ~890MB)
- [ ] Supabase 환경 변수 설정
- [ ] DB 뷰 및 RPC 함수 생성 완료
- [ ] 로그 디렉토리 생성 및 권한 설정
- [ ] 방화벽/보안 그룹 설정 (필요 시)
- [ ] 모니터링 설정

배포 후 확인사항:

- [ ] 워커 프로세스 실행 중
- [ ] 로그에 에러 없음
- [ ] DB에서 `pending` 항목 감소 확인
- [ ] `completed` 항목 증가 확인
- [ ] 임베딩 차원 확인 (768)

---

## 📚 관련 문서

- [워커 스크립트](../scripts/embedding_worker.py)
- [RPC 함수](../database/create_metadata_management_views.sql)
- [768차원 가이드](../database/README_EMBEDDING_768.md)
- [메타데이터 관리 UI](../README_METADATA_MANAGEMENT.md)

---

**✅ 프로덕션 환경에서 안정적인 워커 운영을 위해 Systemd 또는 PM2를 추천합니다!** 🚀

