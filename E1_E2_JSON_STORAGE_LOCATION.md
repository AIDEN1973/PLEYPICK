# E1/E2 JSON 저장 위치

## 요약

| JSON 타입 | 로컬 파일 | DB 테이블 | DB 필드 |
|----------|---------|----------|---------|
| **E1 JSON (Full Meta)** | ✅ `output/synthetic/{SET_ID}/meta/{element_id}/{uuid}.json` | ✅ `synthetic_dataset` | `metadata` (JSONB) |
| **E2 JSON (Essential Meta)** | ✅ `output/synthetic/{SET_ID}/meta-e/{element_id}/{uuid}_e2.json` | ❌ 없음 | - |

---

## 1. E1 JSON (Full Meta)

### 로컬 파일 저장
- **경로**: `output/synthetic/{SET_ID}/meta/{element_id}/{uuid}.json`
- **예시**: `output/synthetic/6313121/meta/6313121/6313121_000.json`
- **내용**: 렌더링 메타데이터 전체 (카메라 파라미터, 재질, 품질 메트릭 등)

### DB 저장
- **테이블**: `synthetic_dataset`
- **필드**: `metadata` (JSONB 타입)
- **저장 위치**: `scripts/render_ldraw_to_supabase.py:5503`
  ```python
  metadata_record = {
      'part_id': part_id,
      'image_url': urls['image_url'] if urls else None,
      'annotation_url': urls['annotation_url'] if urls else None,
      'metadata': json.dumps(metadata),  # ← E1 JSON 전체가 여기에 저장
      'created_at': datetime.now().isoformat()
  }
  result = self.supabase.table('synthetic_dataset').insert(metadata_record).execute()
  ```

### 확인 쿼리
```sql
SELECT 
    part_id,
    image_url,
    metadata->>'schema_version' as schema_version,
    metadata->>'part_id' as part_id_from_meta,
    metadata->'quality_metrics' as quality_metrics
FROM synthetic_dataset
WHERE part_id = '32028'
LIMIT 5;
```

---

## 2. E2 JSON (Essential Meta)

### 로컬 파일 저장
- **경로**: `output/synthetic/{SET_ID}/meta-e/{element_id}/{uuid}_e2.json`
- **예시**: `output/synthetic/6313121/meta-e/6313121/6313121_000_e2.json`
- **내용**: 경량화된 필수 메타데이터 (bbox, segmentation, QA 플래그 등)

### DB 저장
- ❌ **DB에 저장되지 않음**
- E2 JSON은 로컬 파일로만 저장됨
- 저장 위치: `scripts/render_ldraw_to_supabase.py:2636-2692` (`_create_e2_metadata` 함수)
- 로컬 파일 저장: `scripts/render_ldraw_to_supabase.py:5099-5112` (`_create_local_e2_json` 함수)

### 확인 방법
```bash
# 로컬 파일 시스템 확인
ls output/synthetic/*/meta-e/*/*_e2.json
```

---

## 3. DB 스키마 상세

### `synthetic_dataset` 테이블
```sql
CREATE TABLE synthetic_dataset (
    id INTEGER PRIMARY KEY,
    part_id VARCHAR NOT NULL,
    image_url TEXT,
    annotation_url TEXT,
    image_path TEXT,
    annotation_path TEXT,
    metadata JSONB,  -- ← E1 JSON 전체 저장
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    set_num VARCHAR,
    filename TEXT,
    file_size BIGINT,
    status TEXT DEFAULT 'completed',
    upload_method TEXT DEFAULT 'manual',
    version INTEGER DEFAULT 1
);
```

### 관련 테이블
- **`parts_master_features`**: LLM 생성 메타데이터 저장 (E1/E2 JSON 아님)
  - `feature_json`: LLM 생성 메타 (shape_tag, stud_count_top 등)
  - `clip_text_emb`: CLIP 임베딩
  - `semantic_vector`: Semantic Vector
  - `recognition_hints`: 인식 힌트

---

## 4. 사용 목적별 데이터 소스

### 학습 단계
- ✅ 로컬 E1/E2 JSON 파일 (복사만, 사용 안 함)
- ❌ DB 테이블 불필요

### 탐지 단계
- ❌ E1/E2 JSON 불필요

### 식별 단계
- ✅ **`parts_master_features`** 테이블에서 직접 조회
  - `feature_json`: LLM 메타데이터
  - `clip_text_emb`: FAISS 검색용
  - `semantic_vector`: 폴백 벡터
- ❌ 로컬 E1/E2 JSON 파일 사용 안 함

### 품질 검증 단계
- ✅ 로컬 E1 JSON 파일 (오프라인 QA)
- ✅ 로컬 E2 JSON 파일 (Edge 최적화)
- ❌ DB 테이블 불필요

**참고: 품질 검증의 "품질" 의미**
- **렌더링 품질** (합성 데이터셋의 품질)
  - SSIM: 이미지 구조적 유사도 (기준: ≥0.96)
  - SNR: 신호 대 잡음 비율 (기준: ≥30 dB)
  - Reprojection RMS: PnP 재투영 오차 (기준: ≤1.5px)
  - Depth Score: 깊이 맵 품질 (기준: ≥0.85)
- **용도**: 학습 편입 기준 검증 (어노테이션.txt:319)
  - `qa_flag='PASS' AND ssim ≥ 0.96 AND snr ≥ 30 AND reprojection_rms ≤ 1.5 AND depth_quality_score ≥ 0.85`
- **주의**: 
  - ❌ 식별 품질 아님 (FAISS 검색 정확도 등)
  - ❌ 학습 품질 아님 (YOLO 모델 성능 등)
  - ✅ 합성 렌더링 이미지의 품질 (학습 데이터셋 품질)

---

## 5. 실제 데이터 확인 예시

### E1 JSON 조회 (DB)
```sql
-- synthetic_dataset 테이블에서 E1 JSON 조회
SELECT 
    part_id,
    image_url,
    metadata->>'schema_version' as e1_schema_version,
    metadata->'quality_metrics'->>'ssim' as ssim,
    metadata->'quality_metrics'->>'reprojection_rms_px' as rms,
    metadata->'quality_metrics'->>'depth_score' as depth_score
FROM synthetic_dataset
WHERE part_id = '32028'
ORDER BY created_at DESC
LIMIT 10;
```

### E2 JSON 확인 (로컬)
```bash
# 로컬 파일 시스템 확인
find output/synthetic -name "*_e2.json" -type f | head -5

# E2 JSON 내용 확인
cat output/synthetic/6313121/meta-e/6313121/6313121_000_e2.json | jq '.schema_version'
```

---

## 결론

1. **E1 JSON**: 로컬 파일 + DB (`synthetic_dataset.metadata`)
2. **E2 JSON**: 로컬 파일만 (DB 저장 안 함)
3. **식별 단계**: `parts_master_features` 테이블에서 직접 조회 (E1/E2 JSON 아님)

