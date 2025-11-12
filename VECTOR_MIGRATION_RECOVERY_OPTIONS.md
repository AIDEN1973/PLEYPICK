# VECTOR 마이그레이션 데이터 복구 옵션

## 현재 상황

- ✅ 마이그레이션 완료 (임시 컬럼이 `RENAME`되어 정상 완료)
- ❌ 일부 데이터가 `NULL`로 변경됨 (변환 실패 또는 누락)

## 복구 옵션

### 옵션 1: Supabase Point-in-Time Recovery (PITR)

**가장 안전한 방법**

1. Supabase Dashboard → Database → Backups
2. 마이그레이션 실행 전 시점 선택
3. PITR로 복구

**장점**: 원본 데이터 완전 복구
**단점**: 마이그레이션 재실행 필요

### 옵션 2: 백업 파일에서 복구

백업 파일이 있다면:
```sql
-- 백업 파일에서 해당 레코드만 복구
UPDATE parts_master_features
SET clip_text_emb = '[백업된 데이터]'
WHERE id = 3388;
```

### 옵션 3: 원본 소스에서 재생성

CLIP 임베딩이 저장된 원본 소스에서:
- `EmbeddingTab.vue`에서 해당 부품 재생성
- 또는 Python 스크립트로 배치 재생성

### 옵션 4: 부분 데이터 확인 및 수동 복구

다른 레코드에 동일한 벡터가 있는지 확인:
```sql
-- 유사한 부품의 벡터 확인
SELECT 
  part_id,
  color_id,
  clip_text_emb
FROM parts_master_features
WHERE part_id LIKE '320%'
  AND clip_text_emb IS NOT NULL
LIMIT 10;
```

## 예방 조치

향후 마이그레이션 개선:
1. 변환 실패 시 원본 컬럼 유지
2. 롤백 가능한 트랜잭션 구조
3. 변환 전 백업 자동 생성

## 권장 사항

1. **즉시**: PITR로 마이그레이션 전 상태 복구
2. **마이그레이션 SQL 수정**: 실패 시 롤백 로직 추가
3. **재실행**: 수정된 마이그레이션 SQL로 재실행














