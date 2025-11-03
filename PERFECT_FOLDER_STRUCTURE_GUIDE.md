# 완벽한 폴더 구조 렌더링 가이드

## 개요

렌더링 시부터 완벽한 폴더 구조로 자동 저장하여 학습 품질을 향상시키는 시스템입니다.

## 폴더 구조

```
output/synthetic/엘리먼트ID/
├── images/          # WebP 이미지 파일
├── labels/          # YOLO 라벨 파일 (.txt)
├── meta/            # 전체 메타데이터 (.json)
├── meta-e/          # Essential 메타데이터 (_e2.json)
└── dataset.yaml     # YOLO 데이터셋 설정
```

## 주요 개선사항

### 1. 렌더링 스크립트 수정
- `scripts/render_ldraw_to_supabase.py` 수정
- 자동으로 완벽한 폴더 구조 생성
- WebP, JSON, E2 JSON, TXT 파일을 각각 적절한 폴더에 저장

### 2. 데이터셋 분할 스크립트 수정
- `scripts/convert_dataset_structure.py` 수정
- 완벽한 폴더 구조를 유지하면서 train/val/test 분할
- 모든 메타데이터 파일도 함께 분할

### 3. 학습 스크립트 수정
- `scripts/local_yolo_training.py` 수정
- 완벽한 폴더 구조 확인 및 검증
- 학습 품질 향상을 위한 데이터셋 검증

## 사용 방법

### 1. 기본 렌더링 (완벽한 폴더 구조)

```bash
# Python 스크립트 사용
python scripts/render_with_perfect_structure.py --part-id 6335317 --element-id 6335317 --count 100

# 배치 파일 사용 (Windows)
scripts/render_perfect_structure.bat 6335317 6335317 100 640 64
```

### 2. 테스트 렌더링

```bash
# 5개 파일로 테스트
python scripts/test_perfect_folder_structure.py
```

### 3. 학습 실행

```bash
# 완벽한 폴더 구조로 학습
python scripts/local_yolo_training.py --part-id 6335317
```

## 파일 타입별 저장 위치

| 파일 타입 | 확장자 | 저장 위치 | 용도 |
|-----------|--------|-----------|------|
| 이미지 | .webp | `images/` | YOLO 학습용 이미지 |
| 라벨 | .txt | `labels/` | YOLO 세그멘테이션 라벨 |
| 메타데이터 | .json | `meta/` | 전체 렌더링 메타데이터 |
| E2 메타데이터 | _e2.json | `meta-e/` | Essential 메타데이터 |
| 데이터셋 설정 | .yaml | 루트 | YOLO 데이터셋 설정 |

## 메타데이터 구조

### 전체 메타데이터 (meta/*.json)
- 렌더링 파라미터
- 카메라 설정
- 조명 정보
- 재질 정보
- 품질 메트릭
- 3D 변환 정보

### Essential 메타데이터 (meta-e/*_e2.json)
- 핵심 필드만 추출
- 빠른 로딩을 위한 최소 정보
- 학습에 필요한 기본 정보

## 품질 향상 효과

1. **데이터셋 구조 일관성**: 모든 파일이 체계적으로 정리
2. **학습 효율성**: YOLO가 올바른 경로에서 파일 로드
3. **메타데이터 활용**: 품질 검증 및 디버깅 용이
4. **확장성**: 새로운 파일 타입 추가 용이

## 문제 해결

### 폴더 구조 확인
```bash
# 폴더 구조 확인
ls -la output/synthetic/엘리먼트ID/
```

### 파일 수 확인
```bash
# 각 폴더별 파일 수 확인
find output/synthetic/엘리먼트ID/ -type f | wc -l
```

### 학습 전 검증
```bash
# 데이터셋 품질 검증
python scripts/validate_dataset_quality.py output/synthetic/엘리먼트ID/
```

## 주의사항

1. **엘리먼트 ID 사용**: 부품 ID가 아닌 엘리먼트 ID로 폴더 생성
2. **파일명 일치**: 모든 파일의 기본명이 동일해야 함
3. **권한 확인**: 출력 디렉토리에 쓰기 권한 필요
4. **디스크 공간**: 메타데이터 파일로 인한 추가 공간 필요

## 다음 단계

1. 완벽한 폴더 구조로 렌더링 실행
2. 데이터셋 품질 검증
3. YOLO 학습 실행
4. 학습 품질 모니터링
5. 필요시 추가 최적화

