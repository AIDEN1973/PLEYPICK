-- 향상된 인식 시스템 테스트 데이터 생성
-- 다양한 Tier와 복잡도를 가진 부품 데이터 추가

-- 1. Structural-tier 부품 추가 (Technic)
INSERT INTO parts_master_features (
  part_id, color_id, tier, orientation_sensitive, flip_tolerance, 
  semantic_complexity, complexity_level, has_stud, groove, center_stud,
  rotation_invariance, angle_step, polar_transform, radial_profile,
  teeth_count, pitch_periodicity, circular_array, key_features,
  confidence, method, created_at
) VALUES 
-- Technic 기어들
('3647', 1, 'STRUCTURAL', false, 0.2, 0.3, 'medium', false, false, false,
 true, 5, true, true, 8, true, false, ARRAY['teeth', 'pitch_periodicity'],
 0.85, 'enhanced_multi_attribute', NOW()),

('3648', 1, 'STRUCTURAL', false, 0.2, 0.3, 'medium', false, false, false,
 true, 5, true, true, 16, true, false, ARRAY['teeth', 'pitch_periodicity'],
 0.88, 'enhanced_multi_attribute', NOW()),

('3650', 1, 'STRUCTURAL', false, 0.2, 0.3, 'medium', false, false, false,
 true, 5, true, true, 24, true, false, ARRAY['teeth', 'pitch_periodicity'],
 0.90, 'enhanced_multi_attribute', NOW()),

-- Technic 핀들
('2780', 1, 'STRUCTURAL', false, 0.3, 0.2, 'low', false, false, false,
 true, 5, true, true, 0, false, true, ARRAY['holes', 'pins', 'circular_array'],
 0.82, 'enhanced_multi_attribute', NOW()),

('2781', 1, 'STRUCTURAL', false, 0.3, 0.2, 'low', false, false, false,
 true, 5, true, true, 0, false, true, ARRAY['holes', 'pins', 'circular_array'],
 0.85, 'enhanced_multi_attribute', NOW());

-- 2. Semantic-tier 부품 추가 (조형형)
INSERT INTO parts_master_features (
  part_id, color_id, tier, orientation_sensitive, flip_tolerance,
  semantic_complexity, complexity_level, has_stud, groove, center_stud,
  orientation_locked, key_features, aliases,
  confidence, method, created_at
) VALUES 
-- Minifig Head들
('3626b', 1, 'SEMANTIC', true, 0.1, 0.8, 'high', false, false, false,
 true, ARRAY['sculpted_details', 'unique_shape', 'eyes', 'mouth'],
 ARRAY['minifig head', '사자 머리', 'lion head'], 0.75, 'enhanced_multi_attribute', NOW()),

('3626bp01', 1, 'SEMANTIC', true, 0.1, 0.8, 'high', false, false, false,
 true, ARRAY['sculpted_details', 'unique_shape', 'eyes', 'mouth', 'print'],
 ARRAY['printed minifig head', '인쇄된 미니피그 머리'], 0.78, 'enhanced_multi_attribute', NOW()),

-- 동물 부품들
('24201', 1, 'SEMANTIC', true, 0.1, 0.7, 'high', false, false, false,
 true, ARRAY['sculpted_details', 'unique_shape', 'animal'],
 ARRAY['animal head', '동물 머리'], 0.72, 'enhanced_multi_attribute', NOW());

-- 3. 고복잡도 부품 추가
INSERT INTO parts_master_features (
  part_id, color_id, tier, orientation_sensitive, flip_tolerance,
  semantic_complexity, complexity_level, has_stud, groove, center_stud,
  key_features, expected_stud_count, expected_hole_count,
  confidence, method, created_at
) VALUES 
-- 특수 부품들
('18674', 1, 'GEOMETRY', true, 0.4, 0.6, 'high', true, false, true,
 ARRAY['center_stud', 'special', 'jumper'], 1, 0, 0.92, 'enhanced_multi_attribute', NOW()),

('3068b', 1, 'GEOMETRY', true, 0.4, 0.5, 'medium', true, false, false,
 ARRAY['round', 'special'], 4, 0, 0.89, 'enhanced_multi_attribute', NOW()),

-- 슬로프 부품들
('3040', 1, 'GEOMETRY', true, 0.3, 0.4, 'medium', true, false, false,
 ARRAY['slope', 'curved', 'special'], 4, 0, 0.87, 'enhanced_multi_attribute', NOW()),

('3041', 1, 'GEOMETRY', true, 0.3, 0.4, 'medium', true, false, false,
 ARRAY['slope', 'curved', 'special'], 2, 0, 0.85, 'enhanced_multi_attribute', NOW());

-- 4. 혼동군 테스트 데이터
INSERT INTO parts_master_features (
  part_id, color_id, tier, orientation_sensitive, flip_tolerance,
  semantic_complexity, complexity_level, has_stud, groove, center_stud,
  key_features, confusion_groups, confusion_penalty,
  confidence, method, created_at
) VALUES 
-- 2x2 관련 혼동군
('3023', 1, 'GEOMETRY', true, 0.4, 0.1, 'low', true, false, false,
 ARRAY['studs'], ARRAY['2412b', '18674', '3068b'], 0.0, 0.94, 'enhanced_multi_attribute', NOW()),

('2412b', 1, 'GEOMETRY', true, 0.4, 0.1, 'low', false, true, false,
 ARRAY['groove'], ARRAY['3023', '3068b'], 0.0, 0.91, 'enhanced_multi_attribute', NOW()),

('3068b', 1, 'GEOMETRY', true, 0.4, 0.1, 'low', true, false, false,
 ARRAY['round', 'studs'], ARRAY['3023', '2412b', '18674'], 0.0, 0.88, 'enhanced_multi_attribute', NOW());

-- 5. 통계 업데이트를 위한 함수 실행
SELECT get_enhanced_recognition_stats();
