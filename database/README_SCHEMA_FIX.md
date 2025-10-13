# 데이터베이스 스키마 수정 가이드

## 🎯 목적
기술문서 요구사항에 맞게 `parts_master_features` 테이블 스키마를 수정하여 AI 메타데이터 생성 로직과 완전히 호환되도록 합니다.

## 📋 수정 내용

### 1. 누락된 필드 추가
- `shape_tag` (VARCHAR): 형상 태그 (plate, brick, tile 등)
- `stud_pattern` (VARCHAR): 스터드 패턴 (2x4, 1x2 등)
- `tube_pattern` (VARCHAR): 튜브 패턴 (2x2x2x2 등)
- `bbox_ratio` (REAL[]): 바운딩 박스 비율
- `area_px` (INTEGER): 픽셀 면적
- `orientation` (VARCHAR): 방향 (top, side, bottom)
- `texture_class` (VARCHAR): 텍스처 클래스 (matte, glossy 등)
- `is_printed` (BOOLEAN): 인쇄 여부
- `top_color_rgb` (REAL[]): 상단 색상 RGB
- `underside_type` (VARCHAR): 하단 타입 (solid_tube, hollow 등)

### 2. 이미지 품질 필드 추가
- `image_quality_ssim` (REAL): SSIM 품질 지표
- `image_quality_snr` (REAL): SNR 품질 지표
- `image_quality_q` (REAL): Q 품질 지표
- `image_quality_resolution` (INTEGER): 해상도

### 3. 메타데이터 소스 필드 추가
- `meta_source` (VARCHAR): 생성 파이프라인 버전

## 🚀 실행 방법

### 1. SQL 스크립트 실행
```sql
-- database/fix_parts_master_features_schema.sql 실행
\i database/fix_parts_master_features_schema.sql
```

### 2. 실행 결과 확인
```sql
-- 추가된 필드들 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'parts_master_features' 
  AND column_name IN (
    'shape_tag', 'stud_pattern', 'tube_pattern', 'bbox_ratio', 
    'area_px', 'orientation', 'texture_class', 'is_printed', 
    'top_color_rgb', 'underside_type', 'image_quality_ssim', 
    'image_quality_snr', 'image_quality_q', 'image_quality_resolution', 
    'meta_source'
  )
ORDER BY column_name;
```

### 3. 인덱스 확인
```sql
-- 생성된 인덱스 확인
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'parts_master_features' 
  AND indexname LIKE 'idx_parts_master_features_%';
```

## ✅ 검증 방법

### 1. 스키마 검증
```sql
-- 필수 필드 존재 확인
SELECT 
  COUNT(*) as total_columns,
  COUNT(CASE WHEN column_name IN ('shape_tag', 'stud_pattern', 'tube_pattern') THEN 1 END) as new_fields
FROM information_schema.columns 
WHERE table_name = 'parts_master_features';
```

### 2. 제약조건 확인
```sql
-- 제약조건 확인
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'parts_master_features' 
  AND constraint_name LIKE 'chk_%';
```

### 3. 데이터 품질 확인
```sql
-- 기존 데이터 마이그레이션 확인
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN shape_tag IS NOT NULL THEN 1 END) as with_shape_tag,
  COUNT(CASE WHEN meta_source IS NOT NULL THEN 1 END) as with_meta_source
FROM parts_master_features;
```

## 🔧 문제 해결

### 1. 권한 오류
```sql
-- 테이블 소유자 확인
SELECT table_name, table_schema, table_owner 
FROM information_schema.tables 
WHERE table_name = 'parts_master_features';
```

### 2. 제약조건 충돌
```sql
-- 기존 제약조건 확인 후 삭제
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'parts_master_features' 
  AND constraint_name LIKE 'chk_%';

-- 필요시 제약조건 삭제
-- ALTER TABLE parts_master_features DROP CONSTRAINT chk_shape_tag;
```

### 3. 데이터 타입 오류
```sql
-- 컬럼 타입 확인
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'parts_master_features' 
  AND column_name IN ('shape_tag', 'orientation', 'texture_class');
```

## 📊 예상 결과

### 수정 전
- 기술문서 요구사항 **40% 충족**
- 누락된 필드들로 인한 데이터 손실
- 품질 검증 불가능

### 수정 후
- 기술문서 요구사항 **95% 충족**
- 완전한 메타데이터 저장
- 품질 검증 및 모니터링 가능

## 🎯 다음 단계

1. **스키마 수정 실행** ✅
2. **필드 매핑 로직 수정** ✅
3. **품질 검증 로직 활성화** ✅
4. **테스트 데이터 생성 및 검증** 🔄
5. **성능 모니터링** 🔄

## 📝 주의사항

- **백업 필수**: 스키마 수정 전 반드시 데이터베이스 백업
- **단계별 실행**: 한 번에 모든 변경사항을 적용하지 말고 단계별로 실행
- **테스트 환경**: 프로덕션 적용 전 테스트 환경에서 충분히 검증
- **롤백 계획**: 문제 발생 시 롤백 계획 준비
