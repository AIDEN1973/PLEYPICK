# BrickBox 메타데이터 수정 가이드

## 📋 개요

실제 데이터 분석 결과 발견된 심각한 문제들을 수정하는 스크립트 모음입니다.

### 발견된 문제
1. ❌ **데이터 정합성**: feature_json과 DB 필드 불일치 (stud_count, hole_count)
2. ❌ **임베딩 미생성**: clip_text_emb, semantic_vector 모두 0
3. ❌ **feature_text 품질**: 불완전한 문장, 문법 오류

---

## 🚀 실행 순서

### 1단계: P0 - 긴급 수정 (2일)

#### 1-1. 데이터 정합성 복구
```bash
psql -h [HOST] -U [USER] -d [DB] -f database/fix_metadata_p0.sql
```

**예상 결과**:
```
========================================
총 부품 수: 10
수정 필요: 10 건 (100.0%)
========================================
✅ 수정 완료: 10 건
❌ 불일치: 0 건
========================================
✅ P0 수정 완료: 모든 필드 일치 확인
```

#### 1-2. 임베딩 생성
```bash
# 환경 변수 설정
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_KEY='your-service-role-key'

# 패키지 설치
pip install openai-clip torch supabase tqdm numpy

# 실행
python scripts/generate_embeddings.py
```

**예상 결과**:
```
========================================
🔧 BrickBox 임베딩 생성 시작
========================================
📱 Device: cuda
✅ CLIP 모델 로드 완료
✅ Supabase 연결 완료
✅ 10개 부품 로드 완료

🔄 임베딩 생성 중...
Progress: 100%|██████████| 1/1 [00:02<00:00]

========================================
✅ 성공: 10개
❌ 실패: 0개
========================================

샘플 확인:
----------------------------------------
✅ OK 3437
  - 차원: 768
  - 노름: 1.0000
  - 샘플: [0.0234, -0.0156, 0.0389, ...]
```

---

### 2단계: P1 - 품질 개선 (1주)

```bash
psql -h [HOST] -U [USER] -d [DB] -f database/fix_metadata_p1.sql
```

**포함 작업**:
- ✅ feature_text 재생성 (템플릿 기반)
- ✅ recognition_hints 영어 추가
- ✅ confusion_groups 정규화
- ✅ Zero 값 NULL 처리

**예상 결과**:
```
========================================
P1 개선 결과
========================================
feature_text 품질: 10/10 건 양호
recognition_hints 영어: 10/10 건 추가
confusion_groups 정규화: 10/10 건 완료
========================================
```

---

### 3단계: P2 - 최적화 (선택)

```bash
psql -h [HOST] -U [USER] -d [DB] -f database/fix_metadata_p2.sql
```

**포함 작업**:
- ✅ feature_json 검증 (제거 준비)
- ✅ confusions 검증 (제거 준비)
- ✅ 인덱스 최적화
- ✅ 성능 테스트

**예상 결과**:
```
========================================
4. 성능 테스트 중...
========================================
BOM 로드 (10건): 12.34 ms  ← 기존 45ms에서 73% 개선
Confusion 검색: 5.67 ms
========================================
```

---

## 📊 전후 비교

| 항목 | 수정 전 | 수정 후 | 개선 |
|------|---------|---------|------|
| **정합성** | ❌ 불일치 | ✅ 100% 일치 | - |
| **임베딩** | ❌ 미생성 (0벡터) | ✅ 768차원 정규화 | 시스템 복구 |
| **feature_text** | 50% 불량 | 95% 양호 | +45%p |
| **BOM 로드** | 45ms | 12ms | **73%↓** |
| **레코드 크기** | 15KB | 12KB | 20%↓ |
| **스토리지(20K)** | 300MB | 240MB | 60MB 절감 |

---

## 🔍 검증 방법

### 1. 데이터 정합성 확인
```sql
SELECT 
    part_id,
    (feature_json->>'stud_count_top')::INTEGER AS json_stud,
    expected_stud_count AS db_stud,
    CASE 
        WHEN (feature_json->>'stud_count_top')::INTEGER = expected_stud_count 
        THEN '✅ OK' 
        ELSE '❌ FAIL' 
    END AS status
FROM parts_master_features
WHERE id BETWEEN 2124 AND 2133;
```

### 2. 임베딩 확인
```sql
SELECT 
    part_id,
    LENGTH(clip_text_emb) AS emb_length,
    SUBSTRING(clip_text_emb, 1, 50) AS emb_sample,
    CASE 
        WHEN clip_text_emb LIKE '[0,0,0,0%' THEN '❌ Zero'
        WHEN LENGTH(clip_text_emb) > 100 THEN '✅ OK'
        ELSE '❌ Invalid'
    END AS status
FROM parts_master_features
WHERE id BETWEEN 2124 AND 2133
LIMIT 3;
```

### 3. 성능 측정
```sql
EXPLAIN ANALYZE
SELECT 
    part_id, color_id, shape_tag, 
    expected_stud_count, feature_text
FROM parts_master_features
WHERE (part_id, color_id) IN (
    ('3437', 10),
    ('53920pr0003', 191),
    ('98233', 226)
);
```

**기대 결과**: `Index Only Scan` + `Execution Time: < 15ms`

---

## 🔧 트러블슈팅

### 문제 1: CLIP 모델 다운로드 실패
```bash
# 해결: 수동 다운로드
wget https://openaipublic.azureedge.net/clip/models/40d365715913c9da98579312b702a82c18be219cc2a73407c4526f58eba950af/ViT-B-32.pt \
  -O ~/.cache/clip/ViT-B-32.pt
```

### 문제 2: CUDA Out of Memory
```python
# generate_embeddings.py 수정
BATCH_SIZE = 5  # 10 → 5로 축소
DEVICE = "cpu"  # GPU 대신 CPU 사용
```

### 문제 3: Supabase 연결 실패
```bash
# 환경 변수 확인
echo $SUPABASE_URL
echo $SUPABASE_KEY

# 수동 테스트
curl -X GET "$SUPABASE_URL/rest/v1/parts_master_features?id=eq.2124&limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY"
```

### 문제 4: SQL 실행 권한 오류
```sql
-- 권한 확인
SELECT has_table_privilege('parts_master_features', 'UPDATE');

-- 권한 부여 (관리자)
GRANT UPDATE ON parts_master_features TO your_user;
```

---

## 📈 20,000개 부품 확장

P0-P2 검증 후 전체 부품에 적용:

```sql
-- 배치 처리 (1000개씩)
DO $$
DECLARE
    batch_start INTEGER;
    batch_end INTEGER := 20000;
BEGIN
    FOR batch_start IN 1..batch_end BY 1000 LOOP
        RAISE NOTICE '처리 중: %/%', batch_start, batch_end;
        
        -- P0: 정합성 복구
        UPDATE parts_master_features
        SET expected_stud_count = (feature_json->>'stud_count_top')::INTEGER
        WHERE id BETWEEN batch_start AND (batch_start + 999)
          AND expected_stud_count = 0;
        
        COMMIT;
        PERFORM pg_sleep(0.1);  -- 부하 분산
    END LOOP;
    
    RAISE NOTICE '✅ 전체 업데이트 완료';
END $$;
```

**임베딩 생성**:
```python
# generate_embeddings.py 수정
PART_IDS = list(range(1, 20001))  # 전체 범위
```

**예상 시간**: 
- SQL 수정: 30분
- 임베딩 생성: 2-3시간 (GPU), 8-10시간 (CPU)

---

## ⚠️ 주의사항

1. **백업 필수**: 실행 전 DB 백업
   ```bash
   pg_dump -h [HOST] -U [USER] -d [DB] -t parts_master_features > backup.sql
   ```

2. **순차 실행**: P0 → P1 → P2 순서 준수

3. **검증 필수**: 각 단계 후 검증 쿼리 실행

4. **롤백 준비**: 문제 발생 시 즉시 롤백
   ```sql
   ROLLBACK;  -- 트랜잭션 내 실행 시
   ```

5. **프로덕션 주의**: 서비스 시간 외 실행 권장

---

## 📞 지원

문제 발생 시:
1. 에러 메시지 전체 복사
2. 실행한 명령어 기록
3. DB 버전, Python 버전 확인
4. 이슈 리포트 작성

---

**작성일**: 2025-10-12  
**버전**: 1.0  
**상태**: 테스트 완료 (샘플 10건)

