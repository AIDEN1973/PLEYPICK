# 데이터베이스 설정 가이드

## 1. pgvector 확장 활성화

### Supabase (권장)
- Supabase는 이미 pgvector가 활성화되어 있습니다.
- 별도 설정 불필요.

### 로컬 PostgreSQL
```bash
# PostgreSQL에 pgvector 확장 설치
# Ubuntu/Debian
sudo apt install postgresql-14-pgvector

# 또는 소스에서 빌드
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

### 확장 활성화
```sql
-- 데이터베이스에 연결 후
CREATE EXTENSION IF NOT EXISTS vector;
```

## 2. 테이블 생성 순서

1. **pgvector 확장 활성화**
   ```sql
   \i database/enable_pgvector.sql
   ```

2. **마스터 부품 특징 테이블 생성**
   ```sql
   \i database/create_parts_master_features.sql
   ```

3. **기존 테이블들 (필요시)**
   ```sql
   \i database/create_part_characteristics.sql
   \i database/create_detection_logs.sql
   ```

## 3. 환경변수 설정

`.env` 파일에 다음 변수들을 설정하세요:

```env
# Supabase 설정
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# API 키들
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_REBRICKABLE_API_KEY=your_rebrickable_api_key

# 로컬 추론 엔드포인트
VITE_DETECTION_API_URL=http://127.0.0.1:7000/detect
VITE_CLIP_IMAGE_API_URL=http://127.0.0.1:7000/embed/image
VITE_COLOR_EXTRACT_API_URL=http://127.0.0.1:7000/extract/color
VITE_OBJECT_SIZE_API_URL=http://127.0.0.1:7000/extract/size
VITE_FEATURE_EXTRACT_API_URL=http://127.0.0.1:7000/extract/features

# LLM 재랭킹 (선택사항)
VITE_ENABLE_LLM_RERANK=false
```

## 4. 로컬 추론 서비스 설정

로컬 백그라운드 서비스가 필요합니다:

- **검출 API**: YOLO/RT-DETR 모델
- **이미지 임베딩 API**: OpenCLIP ViT-B/32 (768차원)
- **색상 추출 API**: 이미지에서 RGB 추출
- **크기/특징 추출 API**: 객체 크기 및 특징 분석

각 API는 `http://127.0.0.1:7000`에서 실행되어야 합니다.

## 5. 문제 해결

### pgvector 오류
```
ERROR: type "vector" does not exist
```
→ `CREATE EXTENSION IF NOT EXISTS vector;` 실행 필요

### 임베딩 차원 불일치
- 모든 임베딩은 768차원으로 통일
- 텍스트 임베딩: OpenAI text-embedding-3-small (1536) → OpenCLIP (768)로 변경 필요
- 이미지 임베딩: OpenCLIP ViT-B/32 (768)

### 로컬 서비스 연결 오류
- 로컬 백그라운드 서비스가 실행 중인지 확인
- 포트 7000이 사용 가능한지 확인
- CORS 설정 확인 (필요시)
