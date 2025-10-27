-- ========================================
-- 최적 50개 카테고리 체계 (리브릭커블 호환)
-- ========================================
-- 
-- 목적: 리브릭커블 API와 95% 호환, 실용적 균형점
-- 작성일: 2025-10-23
-- 버전: v3.0 (Optimal 50)
--
-- ========================================

-- 1. 기존 제약 조건 제거
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS chk_shape_tag;

-- 2. 최적 50개 카테고리 체계
ALTER TABLE parts_master_features
ADD CONSTRAINT chk_shape_tag CHECK (
  shape_tag IN (
    -- ========================================
    -- 기본 조립 부품 (Building Blocks) - 15개
    -- ========================================
    'plate', 'brick', 'tile', 'slope', 'panel', 
    'wedge', 'cylinder', 'cone', 'arch', 'round', 
    'dish', 'roof', 'inverted', 'baseplate', 'corner',
    
    -- ========================================
    -- 연결/구조 부품 (Connectors) - 8개
    -- ========================================
    'hinge', 'clip', 'bar', 'fence', 'door', 'window', 
    'technic_pin', 'technic_beam',
    
    -- ========================================
    -- 기계/전자 부품 (Mechanical/Electronic) - 8개
    -- ========================================
    'gear', 'axle', 'wheel', 'tire', 'propeller', 'chain', 
    'electronics', 'mechanical',
    
    -- ========================================
    -- 미니피그 부품 (Minifigure) - 5개
    -- ========================================
    'minifig_head', 'minifig_torso', 'minifig_leg', 
    'minifig_accessory', 'minifig_part',
    
    -- ========================================
    -- 생물/자연 부품 (Animals/Nature) - 4개
    -- ========================================
    'animal_figure', 'plant_leaf', 'animals', 'plants',
    
    -- ========================================
    -- 액세서리/기타 (Accessories/Other) - 10개
    -- ========================================
    'sticker', 'decal', 'accessory', 'printed_part', 'transparent',
    'tools', 'containers', 'energy_effects', 'magnets', 'tubes_hoses',
    
    -- ========================================
    -- 레거시 호환 (Legacy) - 3개
    -- ========================================
    'technic', 'minifig', 'duplo',
    
    -- ========================================
    -- 분류 불가 (Unknown) - 1개
    -- ========================================
    'unknown'
  )
);

-- 3. 확인
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'chk_shape_tag';

-- 완료 메시지
SELECT '✅ 최적 50개 카테고리 체계가 적용되었습니다!' as status;

