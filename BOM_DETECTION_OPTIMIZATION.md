# BOM 기반 누락 부품 탐지 최적화 가이드

## 시스템 목표 명확화

**최종 목표:**
- 단일 레고 세트(BOM 환경)에서 누락된 부품을 최대한 정확하게 탐지, 식별
- 폐쇄 세계(Closed-World) 환경: BOM에 있는 부품만 탐지 대상

**학습 모델 구조:**
- 1차: YOLO11n-seg (빠른 스캔용, 전체 프레임 빠르게 처리)
- 2차: YOLO11s-seg (정밀 검증용, 1차에서 탐지된 영역 재검증)

---

## 목표에 맞는 최적화 전략

### 1. BOM 환경 특성 이해

**특징:**
- 폐쇄 세계: 특정 세트의 부품만 탐지 대상 (BOM 제약)
- 1-class segmentation: 모든 레고 부품을 하나의 클래스로 탐지
- 탐지 후 식별: YOLO로 탐지 → FAISS/Adaptive Fusion으로 식별

**핵심 성능 지표:**
- **Recall**: 최우선 (누락 부품을 놓치면 안 됨)
- **Precision**: 중요하지만 BOM 제약 + 후처리로 보완 가능
- **mAP50/mAP50-95**: 탐지 정확도 (바운딩 박스 위치)

---

### 2. 현재 학습 설정 검증

#### 2.1 모델 구조 (확인됨 ✅)
```python
# 1차: YOLO11n-seg
model = YOLO('yolo11n-seg.pt')  # 빠른 스캔

# 2차: YOLO11s-seg  
model = YOLO('yolo11s-seg.pt')  # 정밀 검증
```

#### 2.2 현재 문제점
- **데이터셋 크기**: 200개 (너무 적음)
- **Recall**: 17.5% (목표 95%, 매우 낮음)
- **단일 부품만**: 여러 부품 데이터 필요

#### 2.3 개선된 설정 (적용 완료 ✅)
- 데이터 증강 강화 (mosaic=1.0, copy_paste=1.0, mixup 추가)
- 학습률 조정 (lr0=0.005, 작은 데이터셋에 적합)
- Confidence threshold 조정 (conf=0.15, Recall 향상)
- Loss 가중치 조정 (box=10.0, 바운딩 박스 정확도 강조)

---

## BOM 환경 최적화 권장사항

### 3.1 데이터셋 구성 전략

**단일 세트 환경에 맞춘 데이터 구성:**
```
목표: 특정 세트의 부품들을 모두 포함하는 데이터셋

권장 구성:
- 세트별 부품 다양성 확보
  - 예: 세트 76917의 모든 고유 부품 포함
  - 각 부품당 최소 50-100개 이미지
  - 총 1,000-5,000개 이미지

- 다양한 조건 포함
  - 각도: 위/옆/기울임 (0°, 45°, 90°, 135°)
  - 조명: 밝음/어둠/측면
  - 배경: 단색/무늬/복잡
  - 오클루전: 다른 부품에 가려짐
```

### 3.2 학습 설정 최적화 (BOM 환경)

#### 3.2.1 1차 모델 (YOLO11n-seg) - 빠른 스캔
```python
training_args_stage1 = {
    # Recall 우선 (누락 방지)
    'conf': 0.10,  # 0.15 → 0.10 (더 낮춰서 더 많은 후보 수집)
    'iou': 0.50,
    'max_det': 200,  # 50 → 200 (더 많은 탐지 허용)
    
    # 데이터 증강 (이미 적용됨)
    'mosaic': 1.0,
    'copy_paste': 1.0,
    'mixup': 0.1,
    
    # 학습 파라미터
    'lr0': 0.005,
    'box': 10.0,  # Recall 향상에 집중
}
```

#### 3.2.2 2차 모델 (YOLO11s-seg) - 정밀 검증
```python
training_args_stage2 = {
    # Precision 우선 (오검출 방지)
    'conf': 0.25,  # 0.5 → 0.25 (1차 결과 재검증)
    'iou': 0.60,  # 더 엄격한 IoU
    'max_det': 100,  # 1차에서 탐지된 영역만 검증
    
    # 데이터 증강 (이미 적용됨)
    'mosaic': 1.0,
    'copy_paste': 1.0,
    'mixup': 0.2,
    
    # 학습 파라미터
    'lr0': 0.005,
    'box': 12.0,  # 더 정밀한 바운딩 박스
}
```

### 3.3 추론 시 BOM 제약 활용

**폐쇄 세계 검색:**
```javascript
// BOM 서브셋만 검색 (기술문서 5.1)
인덱스: BOM 서브셋(클래스당 대표 10~20 + Hard 5)
Stage-1: Top-5 (ef=128)
Stage-2: 필요시 Top-10 (ef=160)

// Adaptive Fusion 활용
- 이미지 임베딩: CLIP
- 메타데이터: shape_tag, stud_count 등
- 텍스트 임베딩: part_name
- Topological penalty: 위치 기반 보정
```

---

## 단계별 실행 계획

### 단계 1: 즉시 적용 (완료 ✅)
- [x] 데이터 증강 강화
- [x] 학습률 조정
- [x] Confidence threshold 조정
- [x] Loss 가중치 조정

### 단계 2: 데이터셋 확대 (1주일 내)
- [ ] 세트별 부품 다양성 확보
- [ ] 각 부품당 50-100개 이미지
- [ ] 총 1,000개 이상 이미지

### 단계 3: BOM 환경 최적화 (2주일 내)
- [ ] 세트별 BOM 포함 데이터셋 구성
- [ ] BOM 제약 검증 로직 테스트
- [ ] 실세트 환경에서 검증

### 단계 4: 성능 검증 및 조정 (1개월 내)
- [ ] 실제 세트로 누락 부품 탐지 테스트
- [ ] Recall ≥ 95% 달성 확인
- [ ] Precision ≥ 85% 달성 확인

---

## 예상 성능 개선

### 현재 상태 (200개 데이터셋)
- Recall: 17.5% ❌
- mAP50: 53.0% ❌
- mAP50-95: 38.6% ❌

### 개선 후 (1,000개 데이터셋 + 최적화)
- Recall: 60-75% ⚠️ (아직 미달)
- mAP50: 70-80% ⚠️
- mAP50-95: 50-60% ⚠️

### 목표 달성 (5,000개 데이터셋 + 최적화)
- Recall: 85-95% ✅
- mAP50: 85-92% ✅
- mAP50-95: 60-70% ✅

---

## BOM 환경 특화 팁

### 1. 세트별 특화 학습 (선택사항)
특정 세트에서만 사용할 경우:
- 해당 세트의 부품만으로 데이터셋 구성
- 세트별 fine-tuning
- 예상 효과: Recall +5-10%

### 2. BOM 제약 사전 필터링
추론 시 BOM에 없는 부품은 탐지해도 무시:
```javascript
// BOM 제약 필터링
const bomPartIds = new Set(bomMetadata.map(p => p.part_id))
detections = detections.filter(d => 
    bomPartIds.has(identifyPart(d))  // BOM에 있는 부품만
)
```

### 3. 수량 기반 누락 판정
BOM 수량과 탐지 수량 비교:
```javascript
// 수량 비교
for (const bomPart of bomMetadata) {
    const detectedCount = matches.filter(m => 
        m.part_id === bomPart.part_id && 
        m.color_id === bomPart.color_id
    ).length
    
    if (detectedCount < bomPart.quantity) {
        missingParts.push({
            part_id: bomPart.part_id,
            quantity_missing: bomPart.quantity - detectedCount
        })
    }
}
```

---

## 결론

**현재 상황:**
- 모델 구조: ✅ 올바름 (11n-seg + 11s-seg)
- 학습 설정: ✅ 개선 완료
- 데이터셋: ❌ 부족 (200개 → 최소 1,000개 필요)

**핵심 과제:**
1. 데이터셋 확대 (최우선)
2. 세트별 부품 다양성 확보
3. BOM 환경 검증

**다음 액션:**
1. 데이터셋 생성 확대 실행
2. 개선된 설정으로 재학습
3. 실제 세트로 검증

