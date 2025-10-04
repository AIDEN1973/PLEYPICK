-- 1) 중복 행 제거: (set_id, part_id, color_id) 기준으로 1개만 유지
WITH dups AS (
  SELECT set_id, part_id, color_id, MIN(ctid) AS keep_ctid
  FROM set_parts
  GROUP BY set_id, part_id, color_id
  HAVING COUNT(*) > 1
)
DELETE FROM set_parts sp
USING dups
WHERE sp.set_id = dups.set_id
  AND sp.part_id = dups.part_id
  AND sp.color_id = dups.color_id
  AND sp.ctid <> dups.keep_ctid;

-- 2) 유니크 인덱스 생성 (존재 시 생략)
CREATE UNIQUE INDEX IF NOT EXISTS ux_set_parts_unique
ON set_parts (set_id, part_id, color_id);

-- 3) 유니크 제약 생성 (인덱스를 제약으로 연결, 존재 시 생략)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'set_parts_unique'
  ) THEN
    ALTER TABLE set_parts
      ADD CONSTRAINT set_parts_unique UNIQUE USING INDEX ux_set_parts_unique;
  END IF;
END$$;

-- 4) 검증
-- 중복 여부 확인: 0 이어야 정상
SELECT COUNT(*) AS remaining_duplicates
FROM (
  SELECT set_id, part_id, color_id, COUNT(*)
  FROM set_parts
  GROUP BY set_id, part_id, color_id
  HAVING COUNT(*) > 1
) t;
