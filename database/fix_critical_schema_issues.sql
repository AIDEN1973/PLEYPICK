-- ============================================================================
-- 메타데이터 시스템 Critical 이슈 수정 스크립트
-- ============================================================================
-- 날짜: 2025-10-13
-- 목적: 메타데이터 문서와 실제 DB 스키마 간 치명적 불일치 해결
-- 심각도: 🔴 CRITICAL - 즉시 실행 필요
-- 
-- 수정 내역:
-- 1. 벡터 차원 1536 → 768 통일 (ViT-L/14 CLIP 기준)
-- 2. series 필드 추가 (시리즈 분류: system/duplo/technic/bionicle)
-- 3. shape_tag 필드 추가 (순수 형태: plate/brick/tile 등)
-- 4. version 자동 증가 트리거 추가
-- 5. 인덱스 최적화 (IVFFlat → HNSW)
-- 
-- 참고: set_id는 추가하지 않음 (set_parts 테이블에 있어야 함, 정규화 유지)
-- ============================================================================

-- ============================================================================
-- ⚠️ 주의사항
-- ============================================================================
-- 1. 백업 필수: 실행 전 반드시 백업 생성
-- 2. 다운타임: 벡터 인덱스 재생성 시 5-10분 소요 가능
-- 3. 데이터 검증: 실행 후 반드시 검증 섹션 확인
-- 4. 롤백 준비: 문제 발생 시 즉시 롤백 가능하도록 준비
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: 백업 생성 (필수)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '⏳ 백업 생성 중...';
END $$;

CREATE TABLE IF NOT EXISTS parts_master_features_backup_20251013 AS 
SELECT * FROM parts_master_features;

DO $$
DECLARE
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backup_count FROM parts_master_features_backup_20251013;
  RAISE NOTICE '✅ 백업 완료: % 레코드', backup_count;
END $$;


-- ============================================================================
-- STEP 1: 벡터 차원 수정 (1536 → 768)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '🔧 STEP 1: 벡터 차원 수정 중... (1536 → 768)';
END $$;

-- 1.1 기존 벡터 인덱스 삭제
DROP INDEX IF EXISTS idx_parts_master_features_clip_text_emb CASCADE;

-- 1.2 벡터 컬럼 삭제 (CASCADE로 관련 제약/트리거도 함께 삭제)
ALTER TABLE parts_master_features 
DROP COLUMN IF EXISTS clip_text_emb CASCADE;

-- 1.3 768차원 벡터 컬럼 추가
ALTER TABLE parts_master_features 
ADD COLUMN clip_text_emb VECTOR(768);

-- 1.4 HNSW 인덱스 생성 (IVFFlat 대신 HNSW 사용)
-- HNSW 파라미터:
--   m = 32: 각 노드의 최대 연결 수 (기본: 16, 권장: 16-64)
--   ef_construction = 128: 인덱스 생성 시 탐색 범위 (기본: 64, 권장: 100-200)
CREATE INDEX idx_parts_master_features_clip_text_emb 
ON parts_master_features USING hnsw (clip_text_emb vector_cosine_ops)
WITH (m = 32, ef_construction = 128);

DO $$
BEGIN
  RAISE NOTICE '✅ STEP 1 완료: 벡터 차원 768로 통일';
END $$;


-- ============================================================================
-- STEP 2: series 및 shape_tag 필드 추가
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '🔧 STEP 2: series 및 shape_tag 필드 추가 중...';
END $$;

-- 2.1 series 필드 추가 (시리즈 분류)
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS series VARCHAR(20) DEFAULT 'system'
CHECK (series IN ('system', 'duplo', 'technic', 'bionicle', 'unknown'));

-- 2.2 shape_tag 필드 추가 (순수 형태)
ALTER TABLE parts_master_features 
ADD COLUMN IF NOT EXISTS shape_tag VARCHAR(20) DEFAULT 'unknown'
CHECK (shape_tag IN (
  'plate', 'brick', 'tile', 'slope', 'panel', 'wedge', 
  'cylinder', 'cone', 'arch', 'round', 'dish', 'minifig_part', 'unknown'
));

-- 2.3 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_parts_master_features_series 
ON parts_master_features(series);

CREATE INDEX IF NOT EXISTS idx_parts_master_features_shape_tag 
ON parts_master_features(shape_tag);

DO $$
BEGIN
  RAISE NOTICE '✅ STEP 2 완료: series 및 shape_tag 추가';
END $$;


-- ============================================================================
-- STEP 3: UNIQUE 제약 확인 (기존 유지)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '🔧 STEP 3: UNIQUE 제약 확인 중...';
END $$;

-- 3.1 UNIQUE 제약 확인
-- parts_master_features는 부품 마스터 카탈로그로, (part_id, color_id)로 고유 식별
-- set_id는 넣지 않음 (set_parts 테이블에서 관리, 정규화 유지)
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE '%part_id%color_id%'
      AND conrelid = 'parts_master_features'::regclass
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    RAISE NOTICE '  ✓ UNIQUE 제약 (part_id, color_id) 존재';
  ELSE
    RAISE NOTICE '  ⚠ UNIQUE 제약 없음 - 추가 권장';
    -- UNIQUE 제약 추가 (없는 경우)
    ALTER TABLE parts_master_features
    ADD CONSTRAINT parts_master_features_part_id_color_id_key 
    UNIQUE(part_id, color_id);
    RAISE NOTICE '  ✓ UNIQUE 제약 추가 완료';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ STEP 3 완료: UNIQUE 제약 확인';
  RAISE NOTICE '';
  RAISE NOTICE '💡 참고: set_id는 parts_master_features에 추가하지 않습니다.';
  RAISE NOTICE '   → 이유: 1개 부품이 N개 세트에서 사용되므로 정규화 위배';
  RAISE NOTICE '   → 세트-부품 관계는 set_parts 테이블에서 관리합니다.';
END $$;


-- ============================================================================
-- STEP 4: version 자동 증가 트리거 추가
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 STEP 4: version 자동 증가 트리거 추가 중...';
END $$;

-- 4.1 트리거 함수 생성
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  -- version 자동 증가
  NEW.version = COALESCE(OLD.version, 0) + 1;
  
  -- updated_at 자동 갱신
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 트리거 생성 (UPDATE 시에만 실행)
DROP TRIGGER IF EXISTS parts_master_features_version_trigger ON parts_master_features;
CREATE TRIGGER parts_master_features_version_trigger
BEFORE UPDATE ON parts_master_features
FOR EACH ROW
EXECUTE FUNCTION increment_version();

DO $$
BEGIN
  RAISE NOTICE '✅ STEP 4 완료: version 자동 증가 트리거 추가';
END $$;


-- ============================================================================
-- STEP 5: RPC 함수 업데이트 (768차원 대응)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 STEP 5: RPC 함수 업데이트 중...';
END $$;

-- 5.1 기존 함수 삭제 (반환 타입이 변경되므로 필수)
DROP FUNCTION IF EXISTS search_parts_by_text_embedding(vector, double precision, integer);
DROP FUNCTION IF EXISTS search_parts_by_text_embedding(vector, float, integer);
DROP FUNCTION IF EXISTS search_parts_by_text_embedding(vector(1536), float, integer);
DROP FUNCTION IF EXISTS search_parts_by_text_embedding(vector(768), float, integer);
-- 다양한 시그니처 시도 (기존 함수가 어떤 형태로 생성되었는지 모르므로)

DO $$
BEGIN
  RAISE NOTICE '  ✓ 기존 search_parts_by_text_embedding 함수 삭제 완료';
END $$;

-- 5.2 새 함수 생성 (768차원, series/shape_tag 추가)
CREATE FUNCTION search_parts_by_text_embedding(
  query_embedding VECTOR(768),
  similarity_threshold FLOAT DEFAULT 0.7,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  part_id VARCHAR,
  part_name VARCHAR,
  similarity FLOAT,
  feature_text TEXT,
  confidence FLOAT,
  series VARCHAR,
  shape_tag VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pmf.part_id,
    pmf.part_name,
    1 - (pmf.clip_text_emb <=> query_embedding) as similarity,
    pmf.feature_text,
    pmf.confidence,
    pmf.series,
    pmf.shape_tag
  FROM parts_master_features pmf
  WHERE pmf.clip_text_emb IS NOT NULL
    AND 1 - (pmf.clip_text_emb <=> query_embedding) >= similarity_threshold
  ORDER BY pmf.clip_text_emb <=> query_embedding
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  RAISE NOTICE '✅ STEP 5 완료: RPC 함수 업데이트';
END $$;


-- ============================================================================
-- STEP 6: 기존 데이터 마이그레이션
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 STEP 6: 기존 데이터 마이그레이션 중...';
END $$;

-- 6.1 series 자동 감지 (부품명 기반)
UPDATE parts_master_features
SET series = CASE
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%duplo%' THEN 'duplo'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%technic%' THEN 'technic'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%bionicle%' THEN 'bionicle'
  ELSE 'system'
END
WHERE series = 'system' OR series IS NULL;

DO $$
DECLARE
  updated_series INTEGER;
BEGIN
  GET DIAGNOSTICS updated_series = ROW_COUNT;
  RAISE NOTICE '  ✓ series 자동 감지: % 레코드 업데이트', updated_series;
END $$;

-- 6.2 shape_tag 자동 감지 (부품명 기반)
UPDATE parts_master_features
SET shape_tag = CASE
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%plate%' THEN 'plate'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%brick%' THEN 'brick'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%tile%' THEN 'tile'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%slope%' THEN 'slope'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%panel%' THEN 'panel'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%wedge%' THEN 'wedge'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%cylinder%' THEN 'cylinder'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%cone%' THEN 'cone'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%arch%' THEN 'arch'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%round%' THEN 'round'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%dish%' THEN 'dish'
  WHEN LOWER(COALESCE(part_name, '')) LIKE '%minifig%' THEN 'minifig_part'
  ELSE 'unknown'
END
WHERE shape_tag = 'unknown' OR shape_tag IS NULL;

DO $$
DECLARE
  updated_shape INTEGER;
BEGIN
  GET DIAGNOSTICS updated_shape = ROW_COUNT;
  RAISE NOTICE '  ✓ shape_tag 자동 감지: % 레코드 업데이트', updated_shape;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ STEP 6 완료: 기존 데이터 마이그레이션';
END $$;


-- ============================================================================
-- STEP 7: 검증
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 STEP 7: 데이터 검증 중...';
END $$;

-- 7.1 벡터 차원 검증
DO $$
DECLARE
  sample_dim INTEGER;
BEGIN
  SELECT array_length(clip_text_emb::real[], 1) INTO sample_dim
  FROM parts_master_features
  WHERE clip_text_emb IS NOT NULL
  LIMIT 1;
  
  IF sample_dim = 768 THEN
    RAISE NOTICE '  ✓ 벡터 차원: 768 (정상)';
  ELSIF sample_dim IS NULL THEN
    RAISE NOTICE '  ⚠ 벡터 데이터 없음 (임베딩 재생성 필요)';
  ELSE
    RAISE EXCEPTION '  ✗ 벡터 차원: % (오류! 768이어야 함)', sample_dim;
  END IF;
END $$;

-- 7.2 series 분포 확인
DO $$
DECLARE
  series_stats RECORD;
BEGIN
  FOR series_stats IN 
    SELECT series, COUNT(*) as count
    FROM parts_master_features
    GROUP BY series
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  ✓ series "%": % 레코드', series_stats.series, series_stats.count;
  END LOOP;
END $$;

-- 7.3 shape_tag 분포 확인
DO $$
DECLARE
  shape_stats RECORD;
BEGIN
  FOR shape_stats IN 
    SELECT shape_tag, COUNT(*) as count
    FROM parts_master_features
    GROUP BY shape_tag
    ORDER BY count DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  ✓ shape_tag "%": % 레코드', shape_stats.shape_tag, shape_stats.count;
  END LOOP;
END $$;

-- 7.4 인덱스 확인
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE tablename = 'parts_master_features'
    AND indexname LIKE '%clip_text_emb%';
  
  IF idx_count > 0 THEN
    RAISE NOTICE '  ✓ 벡터 인덱스: 정상 (% 개)', idx_count;
  ELSE
    RAISE WARNING '  ⚠ 벡터 인덱스 없음 (재생성 필요)';
  END IF;
END $$;

-- 7.5 트리거 확인
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname = 'parts_master_features_version_trigger';
  
  IF trigger_count > 0 THEN
    RAISE NOTICE '  ✓ version 트리거: 정상';
  ELSE
    RAISE WARNING '  ⚠ version 트리거 없음';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ STEP 7 완료: 데이터 검증';
END $$;


-- ============================================================================
-- STEP 8: 통계 업데이트
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 STEP 8: 통계 업데이트 중...';
END $$;

ANALYZE parts_master_features;

DO $$
BEGIN
  RAISE NOTICE '✅ STEP 8 완료: 통계 업데이트';
END $$;


-- ============================================================================
-- 완료
-- ============================================================================
COMMIT;

DO $$
DECLARE
  total_records INTEGER;
  with_embedding INTEGER;
  with_series INTEGER;
  with_shape INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM parts_master_features;
  SELECT COUNT(*) INTO with_embedding FROM parts_master_features WHERE clip_text_emb IS NOT NULL;
  SELECT COUNT(*) INTO with_series FROM parts_master_features WHERE series != 'system';
  SELECT COUNT(*) INTO with_shape FROM parts_master_features WHERE shape_tag != 'unknown';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ 모든 Critical 이슈 수정 완료!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 최종 통계:';
  RAISE NOTICE '  - 총 레코드: %', total_records;
  RAISE NOTICE '  - 임베딩 보유: % (%.1f%%)', with_embedding, (with_embedding::FLOAT / NULLIF(total_records, 0) * 100);
  RAISE NOTICE '  - series 분류: % (%.1f%%)', with_series, (with_series::FLOAT / NULLIF(total_records, 0) * 100);
  RAISE NOTICE '  - shape_tag 분류: % (%.1f%%)', with_shape, (with_shape::FLOAT / NULLIF(total_records, 0) * 100);
  RAISE NOTICE '';
  RAISE NOTICE '📝 다음 단계:';
  RAISE NOTICE '  1. 임베딩 워커 재시작 (768차원 생성 확인)';
  RAISE NOTICE '  2. 코드 배포 (자동 매핑 함수 포함)';
  RAISE NOTICE '  3. 문서 업데이트 (메타데이터.txt, 기술문서.txt)';
  RAISE NOTICE '  4. 검증 쿼리 실행 (아래 참조)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 백업 위치: parts_master_features_backup_20251013';
  RAISE NOTICE '';
  RAISE NOTICE '💡 데이터 모델 참고:';
  RAISE NOTICE '  - parts_master_features: 부품 특징 (1개 부품 = 1개 레코드)';
  RAISE NOTICE '  - set_parts: 세트-부품 관계 (1개 부품 = N개 세트)';
  RAISE NOTICE '  - BOM 제약은 런타임에 set_parts를 조회하여 적용';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
END $$;


-- ============================================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================================

-- 벡터 차원 확인
-- SELECT 
--   part_id,
--   array_length(clip_text_emb::real[], 1) as vector_dimension,
--   series,
--   shape_tag
-- FROM parts_master_features
-- WHERE clip_text_emb IS NOT NULL
-- LIMIT 10;

-- series 분포
-- SELECT series, COUNT(*) as count, ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
-- FROM parts_master_features
-- GROUP BY series
-- ORDER BY count DESC;

-- shape_tag 분포
-- SELECT shape_tag, COUNT(*) as count, ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
-- FROM parts_master_features
-- GROUP BY shape_tag
-- ORDER BY count DESC;

-- version 트리거 테스트
-- UPDATE parts_master_features 
-- SET feature_text = feature_text 
-- WHERE id = (SELECT id FROM parts_master_features LIMIT 1)
-- RETURNING id, version, updated_at;

-- 검색 함수 테스트 (768차원 벡터 생성 후)
-- SELECT * FROM search_parts_by_text_embedding(
--   (SELECT clip_text_emb FROM parts_master_features WHERE clip_text_emb IS NOT NULL LIMIT 1),
--   0.7,
--   5
-- );

