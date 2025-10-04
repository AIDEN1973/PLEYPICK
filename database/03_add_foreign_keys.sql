-- 3단계: 외래키 제약 조건 추가 (기존 제약 조건 제거 후)

-- 1. set_parts 테이블의 기존 외래키 제약 제거
ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS fk_set_parts_part_id;

ALTER TABLE set_parts 
DROP CONSTRAINT IF EXISTS fk_set_parts_color_id;

-- 2. set_parts 테이블의 외래키 제약 추가
ALTER TABLE set_parts 
ADD CONSTRAINT fk_set_parts_part_id 
FOREIGN KEY (part_id) REFERENCES lego_parts(part_num);

ALTER TABLE set_parts 
ADD CONSTRAINT fk_set_parts_color_id 
FOREIGN KEY (color_id) REFERENCES lego_colors(color_id);

-- 3. parts_master_features 테이블의 기존 외래키 제약 제거
ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS fk_parts_master_features_part_id;

ALTER TABLE parts_master_features 
DROP CONSTRAINT IF EXISTS fk_parts_master_features_color_id;

-- 4. parts_master_features 테이블의 외래키 제약 추가
ALTER TABLE parts_master_features 
ADD CONSTRAINT fk_parts_master_features_part_id 
FOREIGN KEY (part_id) REFERENCES lego_parts(part_num);

ALTER TABLE parts_master_features 
ADD CONSTRAINT fk_parts_master_features_color_id 
FOREIGN KEY (color_id) REFERENCES lego_colors(color_id);

-- 5. part_images 테이블의 기존 외래키 제약 제거
ALTER TABLE part_images 
DROP CONSTRAINT IF EXISTS fk_part_images_part_id;

ALTER TABLE part_images 
DROP CONSTRAINT IF EXISTS fk_part_images_color_id;

-- 6. part_images 테이블의 외래키 제약 추가
ALTER TABLE part_images 
ADD CONSTRAINT fk_part_images_part_id 
FOREIGN KEY (part_id) REFERENCES lego_parts(part_num);

ALTER TABLE part_images 
ADD CONSTRAINT fk_part_images_color_id 
FOREIGN KEY (color_id) REFERENCES lego_colors(color_id);
