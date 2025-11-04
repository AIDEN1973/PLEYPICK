# VECTOR 마이그레이션 의존성 오류 해결

## 오류 내용

```
ERROR:  2BP01: cannot drop column clip_text_emb of table parts_master_features because other objects depend on it
DETAIL:  view v_embedding_status depends on column clip_text_emb of table parts_master_features
HINT:  Use DROP ... CASCADE to drop the dependent objects too.
```

## 해결 방법

### 수정된 마이그레이션 SQL

`supabase/migrations/20251101_convert_vectors_to_vector_type.sql`에 다음 단계 추가:

1. **의존 뷰 삭제** (4단계):
   ```sql
   DROP VIEW IF EXISTS v_embedding_status CASCADE;
   DROP VIEW IF EXISTS v_parts_with_embeddings CASCADE;
   DROP VIEW IF EXISTS v_missing_embeddings CASCADE;
   ```

2. **컬럼 교체** (5단계):
   ```sql
   ALTER TABLE parts_master_features 
     DROP COLUMN IF EXISTS clip_text_emb,
     DROP COLUMN IF EXISTS semantic_vector;
   
   ALTER TABLE parts_master_features 
     RENAME COLUMN clip_text_emb_new TO clip_text_emb;
   
   ALTER TABLE parts_master_features 
     RENAME COLUMN semantic_vector_new TO semantic_vector;
   ```

3. **의존 뷰 재생성** (6단계):
   ```sql
   CREATE OR REPLACE VIEW v_embedding_status AS
   SELECT 
     part_id,
     color_id,
     CASE 
       WHEN clip_text_emb IS NOT NULL AND semantic_vector IS NOT NULL THEN 'completed'
       WHEN clip_text_emb IS NOT NULL OR semantic_vector IS NOT NULL THEN 'partial'
       ELSE 'pending'
     END AS embedding_status,
     CASE WHEN clip_text_emb IS NOT NULL THEN 1 ELSE 0 END AS has_clip,
     CASE WHEN semantic_vector IS NOT NULL THEN 1 ELSE 0 END AS has_semantic,
     updated_at
   FROM parts_master_features;
   ```

## 주의사항

- `CASCADE` 옵션 사용으로 의존 객체도 함께 삭제
- 뷰 재생성으로 기존 기능 유지
- VECTOR 타입과 호환되도록 뷰 정의 유지

## 실행 순서

1. 의존 뷰 삭제
2. 컬럼 교체
3. 뷰 재생성
4. 인덱스 생성
5. 함수 생성

---

**수정 완료일**: 2025-11-01  
**상태**: ✅ 의존성 오류 해결 완료










