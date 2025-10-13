-- ========================================
-- shape_tag CHECK 제약 조건 업데이트 (v2.1)
-- ========================================
-- 
-- 목적: 30개 카테고리를 허용하도록 CHECK 제약 조건 수정
-- 작성일: 2025-10-13
-- 버전: v2.1
--
-- ========================================

-- 1. 기존 제약 조건 제거
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS chk_shape_tag;

-- 2. 새로운 제약 조건 추가 (30개 카테고리)
ALTER TABLE parts_master_features
ADD CONSTRAINT chk_shape_tag CHECK (
  shape_tag IN (
    -- 기본 형태 (1-19)
    'plate', 'brick', 'tile', 'slope', 'panel', 'wedge', 'cylinder', 'cone', 'arch',
    'round', 'dish', 'hinge', 'clip', 'bar', 'fence', 'door', 'window', 'roof', 'inverted',
    
    -- 특수 부품 (20-29)
    'minifig_part', 'animal_figure', 'plant_leaf', 'wheel', 'tire',
    'wing', 'propeller', 'gear', 'chain', 'axle',
    
    -- 레거시 호환 (구버전)
    'technic', 'minifig', 'duplo',
    
    -- 분류 불가
    'unknown'
  )
);

-- 3. 확인
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'chk_shape_tag';

-- 완료 메시지
SELECT '✅ shape_tag CHECK 제약 조건이 30개 카테고리로 업데이트되었습니다!' as status;

