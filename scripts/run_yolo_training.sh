#!/bin/bash
"""
🧱 BrickBox YOLO 학습 실행 스크립트

렌더링 완료 후 YOLO 학습을 실행하는 편리한 스크립트
"""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 프로젝트 루트 디렉토리
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log_info "🧱 BrickBox YOLO 학습 시작"
log_info "프로젝트 루트: $PROJECT_ROOT"

# 1. 사전 요구사항 확인
log_info "🔍 1단계: 사전 요구사항 확인"

# Python 확인
if ! command -v python &> /dev/null; then
    log_error "Python이 설치되지 않았습니다"
    exit 1
fi

# 필요한 패키지 확인
log_info "📦 필요한 패키지 확인 중..."
python -c "import ultralytics, torch" 2>/dev/null
if [ $? -ne 0 ]; then
    log_warning "필요한 패키지가 설치되지 않았습니다"
    log_info "설치 중: pip install ultralytics torch"
    pip install ultralytics torch
fi

# 렌더링된 데이터 확인
if [ ! -d "output/synthetic" ]; then
    log_error "렌더링된 데이터가 없습니다. 먼저 렌더링을 실행하세요"
    exit 1
fi

# WebP 이미지 확인
WEBP_COUNT=$(find output/synthetic -name "*.webp" | wc -l)
if [ $WEBP_COUNT -eq 0 ]; then
    log_error "WebP 이미지가 없습니다"
    exit 1
fi

log_success "사전 요구사항 확인 완료 ($WEBP_COUNT개 WebP 이미지 발견)"

# 2. 데이터셋 준비
log_info "📊 2단계: 데이터셋 준비"
python scripts/prepare_yolo_dataset.py --train-ratio 0.8 --val-ratio 0.1 --test-ratio 0.1

if [ $? -ne 0 ]; then
    log_error "데이터셋 준비 실패"
    exit 1
fi

log_success "데이터셋 준비 완료"

# 3. YOLO 모델 학습
log_info "🚀 3단계: YOLO 모델 학습"
python scripts/train_yolo_lego.py --device auto --epochs 100 --batch-size 16

if [ $? -ne 0 ]; then
    log_error "YOLO 모델 학습 실패"
    exit 1
fi

log_success "YOLO 모델 학습 완료"

# 4. 모델 배포
log_info "🚀 4단계: 모델 배포"
python scripts/deploy_yolo_model.py --test-model

if [ $? -ne 0 ]; then
    log_error "모델 배포 실패"
    exit 1
fi

log_success "모델 배포 완료"

# 5. 완료 메시지
log_success "🎉 YOLO 학습 파이프라인 완료!"
log_info "학습된 모델이 프론트엔드에 배포되었습니다"
log_info "이제 레고 부품 탐지 성능이 크게 향상될 것입니다"

# 결과 요약
echo ""
echo "📊 학습 결과 요약:"
echo "  - 데이터셋: output/synthetic/prepared/"
echo "  - 학습 결과: output/training/runs/"
echo "  - 배포된 모델: public/models/lego_yolo_custom.onnx"
echo "  - 로그: output/pipeline/logs/"
echo ""
echo "🔧 다음 단계:"
echo "  1. 프론트엔드에서 새로운 모델 테스트"
echo "  2. 탐지 성능 확인"
echo "  3. 필요시 추가 학습 데이터 생성"
