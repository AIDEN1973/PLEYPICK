# 임베딩 차원 변경: 768차원 (ViT-L/14)

## 📋 개요

BrickBox 시스템을 **768차원 CLIP 임베딩**으로 변경합니다.
설계 문서(메타데이터.txt)에 명시된 768차원 벡터에 맞춰 시스템을 정렬합니다.

---

## 🔧 변경 사항

### 1. CLIP 모델
- **이전**: `ViT-B/32` (512차원)
- **이후**: `ViT-L/14` (768차원) ✅

### 2. DB 스키마
```sql
-- 이전: vector(512)
-- 이후: vector(768)
ALTER TABLE parts_master_features 
    ALTER COLUMN clip_text_emb TYPE vector(768);
    
ALTER TABLE parts_master_features 
    ALTER COLUMN semantic_vector TYPE vector(768);
```

### 3. RPC 함수
```sql
CREATE OR REPLACE FUNCTION update_part_embedding(
    p_id INTEGER,
    p_embedding TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE parts_master_features
    SET 
        clip_text_emb = p_embedding::vector(768),  -- 768차원
        semantic_vector = p_embedding::vector(768),
        embedding_status = 'completed',
        updated_at = NOW()
    WHERE id = p_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
```

### 4. Python 스크립트
- `scripts/embedding_worker.py`: ViT-L/14
- `scripts/generate_embeddings.py`: ViT-L/14
- `scripts/test_single_embedding.py`: ViT-L/14

---

## 🚀 실행 순서

### 1단계: DB 스키마 변경 (Supabase SQL Editor)
```bash
database/fix_embedding_to_768.sql
```

**예상 결과:**
- ✅ RPC 함수: `update_part_embedding(768)`
- ✅ DB 컬럼: `vector(768)`
- ✅ 모든 임베딩: `pending` 상태

### 2단계: 테스트 (1건)
```bash
# PowerShell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_KEY = "your-service-role-key"
$env:PYTHONIOENCODING = "utf-8"

python scripts\test_single_embedding.py
```

**예상 출력:**
```
2. Loading CLIP model (ViT-L/14, 768-dim)...
   Model loaded: openai/clip-vit-large-patch14 (768-dim)

4. Generating embedding...
   Embedding shape: (768,)
   First 5 values: [...]
   Norm: 1.000000

✅ SUCCESS!
```

### 3단계: 전체 임베딩 생성
```bash
python scripts\embedding_worker.py
```

---

## 📊 성능 비교

| 항목 | ViT-B/32 (512차원) | ViT-L/14 (768차원) |
|------|-------------------|-------------------|
| **정확도** | 보통 | 높음 ✅ |
| **속도** | 빠름 (~50ms) | 느림 (~100ms) |
| **메모리** | 350MB | 890MB |
| **모델 크기** | 149MB | 428MB |
| **검색 품질** | 보통 | 우수 ✅ |

**20,000+ 부품 규모에서는 768차원이 더 적합합니다.**

---

## 🔍 검증

### A. DB 차원 확인
```sql
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'parts_master_features' 
    AND column_name IN ('clip_text_emb', 'semantic_vector');
```

**기대 결과:**
```
column_name     | data_type | udt_name
----------------|-----------|----------
clip_text_emb   | USER-DEFINED | vector
semantic_vector | USER-DEFINED | vector
```

### B. 벡터 차원 확인
```sql
SELECT 
    id,
    part_id,
    array_length(clip_text_emb::real[], 1) AS dimension,
    embedding_status
FROM parts_master_features
WHERE embedding_status = 'completed'
LIMIT 1;
```

**기대 결과:**
```
id   | part_id | dimension | embedding_status
-----|---------|-----------|------------------
2124 | 3437    | 768       | completed
```

---

## 📝 주의사항

1. **모델 다운로드**: ViT-L/14는 약 890MB이므로 최초 실행 시 시간이 걸립니다.
2. **메모리**: GPU 메모리 최소 2GB 필요 (CPU는 4GB+ 권장)
3. **속도**: 512차원 대비 약 2배 느림 (배치 처리로 완화)
4. **기존 임베딩**: 모두 NULL로 초기화되어 재생성 필요

---

## 🎯 최종 확인

- [ ] `fix_embedding_to_768.sql` 실행 완료
- [ ] `test_single_embedding.py` 테스트 성공 (768차원)
- [ ] `embedding_worker.py` 실행 중
- [ ] 샘플 10건 `embedding_status = 'completed'`
- [ ] 벡터 차원 확인: 768

---

**✅ 768차원 변경 완료 시 설계 문서와 100% 일치하게 됩니다!**

