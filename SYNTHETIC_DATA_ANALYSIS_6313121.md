# 6313121 폴더 데이터 정밀 분석 결과

## 파일 구조 현황

### 파일 카운트
- **images**: 5개 파일 (6313121_000.webp ~ 6313121_004.webp)
- **labels**: 4개 파일 (6313121_000.txt ~ 6313121_003.txt)
- **meta**: 4개 파일 (6313121_000.json ~ 6313121_003.json)
- **meta-e**: 4개 파일 (6313121_000_e2.json ~ 6313121_003_e2.json)
- **depth**: 5개 파일 (6313121_000_0001.png ~ 6313121_004_0001.png)

## 발견된 문제점

### 1. 파일 수 불일치
- **문제**: images와 depth는 5개, labels/meta/meta-e는 4개
- **누락 파일**: `6313121_004`에 대한 labels, meta, meta-e 파일 없음
- **원인 추정**: 렌더링 중 하나의 이미지에 대한 후처리(어노테이션/메타데이터 생성) 실패

### 2. 깊이 맵 형식 오류 (심각)
- **문제**: depth 폴더의 파일이 PNG 형식 (`6313121_000_0001.png`)
- **기대 형식**: EXR 형식 (`6313121_000.exr`)
- **원인**: Blender OutputFile 노드의 형식 설정이 PNG로 변경되었거나, 기본 형식이 사용됨
- **영향**: 
  - 깊이 정보 손실 (PNG는 8비트/16비트, EXR은 32비트 부동소수점)
  - 깊이 맵 검증 불가 (어노테이션.txt 기준: EXR 필수)
  - Supabase Storage 업로드 시 형식 불일치

### 3. 깊이 맵 파일명 패턴
- **현재**: `{uid}_0001.png` (Blender 자동 번호 포함)
- **기대**: `{uid}.exr` (단일 파일명)
- **원인**: OutputFile 노드의 `file_slots[0].path` 설정 문제

## 정상 동작 확인

### ✅ 디렉토리 구조
- 모든 필수 폴더 존재 (images, labels, meta, meta-e, depth)

### ✅ 기본 파일 매칭
- images ↔ labels: 4개 일치 (6313121_000 ~ 6313121_003)
- images ↔ meta: 4개 일치
- images ↔ meta-e: 4개 일치

### ✅ E2 JSON 스키마
- schema_version: "1.6.1-E2" ✅
- part_id, element_id ✅
- annotation (bbox, segmentation) ✅
- qa 필드 ✅

## 조치 사항

### 긴급 수정 필요

1. **깊이 맵 형식 수정**
   - OutputFile 노드의 `format.file_format` 확인
   - `OPEN_EXR` 형식 강제 설정
   - PNG 출력 비활성화

2. **파일 수 불일치 해결**
   - `6313121_004`에 대한 labels, meta, meta-e 파일 생성
   - 또는 해당 이미지 재렌더링

3. **깊이 맵 파일명 수정**
   - OutputFile 노드의 `file_slots[0].path` 설정 개선
   - 자동 번호 제거 또는 파일명 패턴 조정

## 상세 분석 대기

검증 스크립트 실행 결과를 기다리는 중...

