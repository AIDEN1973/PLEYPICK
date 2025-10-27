# CLIP 임베딩 서비스 설정 가이드

## 개요
CLIP ViT-L/14 기반 768차원 임베딩 서비스로 OpenAI API와 호환되는 인터페이스를 제공합니다.

## 설치 및 실행

### Windows
```bash
# 1. CLIP 서비스 시작
start-clip-service.bat

# 2. 환경 변수 설정 (선택사항)
set EMBEDDING_PROVIDER=clip
set CLIP_SERVICE_URL=http://localhost:3021
```

### Linux/macOS
```bash
# 1. 실행 권한 부여
chmod +x start-clip-service.sh

# 2. CLIP 서비스 시작
./start-clip-service.sh

# 3. 환경 변수 설정 (선택사항)
export EMBEDDING_PROVIDER=clip
export CLIP_SERVICE_URL=http://localhost:3021
```

## 서비스 확인

### 헬스 체크
```bash
curl http://localhost:3021/health
```

### 임베딩 생성 테스트
```bash
curl -X POST http://localhost:3021/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": "2x4 플레이트, 홈 없음, 평평한 표면",
    "model": "clip-vit-l/14",
    "dimensions": 768
  }'
```

## 워커 설정

### 환경 변수
```bash
# CLIP 서비스 사용 (권장)
EMBEDDING_PROVIDER=clip
CLIP_SERVICE_URL=http://localhost:3021

# OpenAI 폴백 (CLIP 서비스 실패 시)
EMBEDDING_PROVIDER=openai
VITE_OPENAI_API_KEY=your_api_key
```

### 워커 재시작
```bash
# 워커 재시작하여 새 설정 적용
npm run worker:auto
```

## 장점

1. **정합성**: [기술문서] CLIP 768 기준과 완전 일치
2. **재현성**: 동일한 입력에 대해 항상 동일한 임베딩 생성
3. **성능**: 로컬 처리로 API 호출 제한 없음
4. **비용**: OpenAI API 비용 절약
5. **호환성**: OpenAI API와 동일한 인터페이스

## 문제 해결

### CLIP 모델 로드 실패
```bash
# PyTorch CUDA 지원 확인
python -c "import torch; print(torch.cuda.is_available())"

# CPU 모드로 강제 실행
export CUDA_VISIBLE_DEVICES=""
python server/clip-embedding-service.py
```

### 포트 충돌
```bash
# 다른 포트 사용
export CLIP_SERVICE_PORT=3023
export CLIP_SERVICE_URL=http://localhost:3023
```

### 워커 연결 실패
```bash
# CLIP 서비스 상태 확인
curl http://localhost:3021/health

# 워커 로그 확인
# EMBEDDING_PROVIDER=clip 설정 확인
```

## 모니터링

### 서비스 상태
- URL: http://localhost:3021/health
- 응답: `{"status": "healthy", "model": "clip-vit-l/14", "device": "cuda", "dimensions": 768}`

### 워커 로그
```
✅ CLIP embedding generated: 768D, norm=1.0000
```

## 마이그레이션

### 기존 제로 벡터 재처리
```sql
-- 제로 벡터 재처리
UPDATE parts_master_features 
SET embedding_status = 'pending', updated_at = NOW()
WHERE clip_text_emb IS NULL 
   OR array_length(clip_text_emb::real[], 1) IS NULL
   OR (SELECT bool_and(v = 0) FROM unnest(clip_text_emb::real[]) AS v);
```

### 배치 재처리
```bash
# EmbeddingTab에서 "없음 전체 생성" 버튼 클릭
# 또는 SQL로 직접 pending 설정
```
