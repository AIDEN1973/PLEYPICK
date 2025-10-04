-- 1) null-color 레코드 제거 또는 보정: 동일 part_id에 대해 color_id가 NULL인 중복을 우선 삭제
DELETE FROM parts_master_features pmf
USING (
  SELECT part_id
  FROM parts_master_features
  WHERE color_id IS NULL
  GROUP BY part_id
  HAVING COUNT(*) > 0
) t
WHERE pmf.part_id = t.part_id
  AND pmf.color_id IS NULL;

-- 2) 유니크 인덱스 재정의: (part_id, color_id) 조합을 유니크, 단 color_id가 NULL인 경우 저장 자체를 금지하도록 부분 인덱스도 추가
-- 기본 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS ux_pmf_part_color
ON parts_master_features (part_id, color_id);

-- 부분 인덱스: color_id IS NULL 행을 별도로 방지(선택사항: 애플리케이션에서 스킵 처리했으므로 안전망)
CREATE UNIQUE INDEX IF NOT EXISTS ux_pmf_part_nullcolor
ON parts_master_features (part_id)
WHERE color_id IS NULL;

-- 3) 검증: 중복 여부 확인
SELECT COUNT(*) AS remaining_pmf_duplicates
FROM (
  SELECT part_id, color_id, COUNT(*)
  FROM parts_master_features
  GROUP BY part_id, color_id
  HAVING COUNT(*) > 1
) d;
