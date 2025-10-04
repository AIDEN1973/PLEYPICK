-- 스키마 불일치 문제 해결

-- 1. set_parts 테이블의 part_id를 character varying으로 변경
ALTER TABLE set_parts 
ALTER COLUMN part_id TYPE character varying;

-- 2. set_parts 테이블의 color_id를 integer로 변경
ALTER TABLE set_parts 
ALTER COLUMN color_id TYPE integer;

-- 3. part_images 테이블의 part_id를 character varying으로 변경
ALTER TABLE part_images 
ALTER COLUMN part_id TYPE character varying;

-- 4. part_images 테이블의 color_id를 integer로 변경
ALTER TABLE part_images 
ALTER COLUMN color_id TYPE integer;

-- 5. parts_master_features 테이블에 UNIQUE 제약 추가
ALTER TABLE parts_master_features 
ADD CONSTRAINT unique_part_color UNIQUE (part_id, color_id);

-- 6. 외래키 제약 추가 (올바른 참조 관계)
-- set_parts.part_id -> lego_parts.part_num (character varying)
ALTER TABLE set_parts 
ADD CONSTRAINT fk_set_parts_part_id 
FOREIGN KEY (part_id) REFERENCES lego_parts(part_num);

-- set_parts.color_id -> lego_colors.color_id (integer)
ALTER TABLE set_parts 
ADD CONSTRAINT fk_set_parts_color_id 
FOREIGN KEY (color_id) REFERENCES lego_colors(color_id);

-- 7. parts_master_features 테이블에 외래키 제약 추가
-- parts_master_features.part_id -> lego_parts.part_num (character varying)
ALTER TABLE parts_master_features 
ADD CONSTRAINT fk_parts_master_features_part_id 
FOREIGN KEY (part_id) REFERENCES lego_parts(part_num);

-- parts_master_features.color_id -> lego_colors.color_id (integer)
ALTER TABLE parts_master_features 
ADD CONSTRAINT fk_parts_master_features_color_id 
FOREIGN KEY (color_id) REFERENCES lego_colors(color_id);

-- 8. part_images 테이블에 외래키 제약 추가
-- part_images.part_id -> lego_parts.part_num (character varying)
ALTER TABLE part_images 
ADD CONSTRAINT fk_part_images_part_id 
FOREIGN KEY (part_id) REFERENCES lego_parts(part_num);

-- part_images.color_id -> lego_colors.color_id (integer)
ALTER TABLE part_images 
ADD CONSTRAINT fk_part_images_color_id 
FOREIGN KEY (color_id) REFERENCES lego_colors(color_id);
