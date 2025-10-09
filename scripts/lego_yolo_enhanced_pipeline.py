#!/usr/bin/env python3
"""
🧱 BrickBox 레고 부품 YOLO 학습 통합 파이프라인 (개선된 버전)

모든 개선사항이 반영된 완전한 YOLO 학습 파이프라인:
- 데이터셋 검증 (WebP, JPG, PNG, Segmentation 지원)
- Supabase DB 연동 (synthetic_part_stats, operation_logs, parts_master_features)
- 성능 검증 안전성 강화
- ONNX 런타임 기반 테스트
- GPU 설정 개선
- 자동 배포 및 프론트엔드 연동
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
from datetime import datetime
import argparse

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

class LegoYOLOEnhancedPipeline:
    """개선된 레고 YOLO 학습 통합 파이프라인"""
    
    def __init__(self):
        self.project_root = project_root
        self.output_dir = project_root / "output" / "synthetic"
        self.training_dir = project_root / "output" / "training"
        self.models_dir = project_root / "public" / "models"
        
        # 파이프라인 결과 저장
        self.pipeline_results = {
            'start_time': datetime.now(),
            'steps': {},
            'success': False,
            'error': None
        }
    
    def log_step(self, step_name: str, status: str, message: str, details: dict = None):
        """단계별 로깅"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {status} {step_name}: {message}")
        
        self.pipeline_results['steps'][step_name] = {
            'status': status,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'details': details or {}
        }
    
    def check_prerequisites(self) -> bool:
        """사전 요구사항 확인"""
        self.log_step("prerequisites", "running", "사전 요구사항 확인 중...")
        
        # 필수 디렉토리 확인
        required_dirs = [
            self.output_dir,
            self.training_dir,
            self.models_dir
        ]
        
        for directory in required_dirs:
            if not directory.exists():
                directory.mkdir(parents=True, exist_ok=True)
                self.log_step("prerequisites", "info", f"디렉토리 생성: {directory}")
        
        # 필수 파일 확인
        required_files = [
            "scripts/prepare_yolo_dataset.py",
            "scripts/train_yolo_lego.py", 
            "scripts/deploy_yolo_model.py"
        ]
        
        missing_files = []
        for file_path in required_files:
            if not (self.project_root / file_path).exists():
                missing_files.append(file_path)
        
        if missing_files:
            self.log_step("prerequisites", "error", f"필수 파일 누락: {missing_files}")
            return False
        
        # 데이터셋 확인
        if not self.output_dir.exists() or not any(self.output_dir.iterdir()):
            self.log_step("prerequisites", "warning", "합성 데이터셋이 없습니다. 먼저 렌더링을 실행하세요.")
            return False
        
        self.log_step("prerequisites", "success", "사전 요구사항 확인 완료")
        return True
    
    def run_dataset_preparation(self) -> bool:
        """데이터셋 준비 실행"""
        self.log_step("dataset_prep", "running", "데이터셋 준비 시작...")
        
        try:
            result = subprocess.run([
                sys.executable, 
                str(self.project_root / "scripts" / "prepare_yolo_dataset.py")
            ], capture_output=True, text=True, cwd=self.project_root)
            
            if result.returncode == 0:
                self.log_step("dataset_prep", "success", "데이터셋 준비 완료")
                return True
            else:
                self.log_step("dataset_prep", "error", f"데이터셋 준비 실패: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_step("dataset_prep", "error", f"데이터셋 준비 실행 실패: {e}")
            return False
    
    def run_model_training(self, device: str = "auto", epochs: int = 100, batch_size: int = 16) -> bool:
        """모델 학습 실행"""
        self.log_step("training", "running", f"YOLO 모델 학습 시작 (디바이스: {device}, 에포크: {epochs})")
        
        try:
            cmd = [
                sys.executable,
                str(self.project_root / "scripts" / "train_yolo_lego.py"),
                "--device", device,
                "--epochs", str(epochs),
                "--batch-size", str(batch_size)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=self.project_root)
            
            if result.returncode == 0:
                self.log_step("training", "success", "YOLO 모델 학습 완료")
                return True
            else:
                self.log_step("training", "error", f"YOLO 모델 학습 실패: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_step("training", "error", f"YOLO 모델 학습 실행 실패: {e}")
            return False
    
    def run_model_deployment(self, test_model: bool = True) -> bool:
        """모델 배포 실행"""
        self.log_step("deployment", "running", "모델 배포 시작...")
        
        try:
            cmd = [
                sys.executable,
                str(self.project_root / "scripts" / "deploy_yolo_model.py")
            ]
            
            if test_model:
                cmd.append("--test-model")
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=self.project_root)
            
            if result.returncode == 0:
                self.log_step("deployment", "success", "모델 배포 완료")
                return True
            else:
                self.log_step("deployment", "error", f"모델 배포 실패: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_step("deployment", "error", f"모델 배포 실행 실패: {e}")
            return False
    
    def run_full_pipeline(self, device: str = "auto", epochs: int = 100, batch_size: int = 16, test_model: bool = True) -> bool:
        """전체 파이프라인 실행"""
        print("=" * 60)
        print("🧱 BrickBox 레고 YOLO 학습 통합 파이프라인 시작")
        print("=" * 60)
        
        try:
            # 1. 사전 요구사항 확인
            if not self.check_prerequisites():
                return False
            
            # 2. 데이터셋 준비
            if not self.run_dataset_preparation():
                return False
            
            # 3. 모델 학습
            if not self.run_model_training(device, epochs, batch_size):
                return False
            
            # 4. 모델 배포
            if not self.run_model_deployment(test_model):
                return False
            
            # 파이프라인 성공
            self.pipeline_results['success'] = True
            self.pipeline_results['end_time'] = datetime.now()
            
            print("\n" + "=" * 60)
            print("🎉 BrickBox YOLO 학습 파이프라인 성공적으로 완료!")
            print("=" * 60)
            
            # 결과 저장
            self.save_pipeline_results()
            return True
            
        except Exception as e:
            self.pipeline_results['error'] = str(e)
            self.pipeline_results['end_time'] = datetime.now()
            self.log_step("pipeline", "error", f"파이프라인 실행 중 오류: {e}")
            
            print("\n" + "=" * 60)
            print(f"❌ BrickBox YOLO 학습 파이프라인 실패: {e}")
            print("=" * 60)
            
            # 결과 저장
            self.save_pipeline_results()
            return False
    
    def save_pipeline_results(self):
        """파이프라인 결과 저장"""
        results_file = self.training_dir / f"enhanced_pipeline_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        try:
            with open(results_file, 'w', encoding='utf-8') as f:
                json.dump(self.pipeline_results, f, indent=2, ensure_ascii=False, default=str)
            
            print(f"📊 파이프라인 결과 저장: {results_file}")
            
        except Exception as e:
            print(f"⚠️ 결과 저장 실패: {e}")

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='BrickBox 레고 YOLO 학습 통합 파이프라인')
    parser.add_argument('--device', type=str, default='auto', help='학습 디바이스 (auto, cpu, cuda, cuda:0)')
    parser.add_argument('--epochs', type=int, default=100, help='학습 에포크 수')
    parser.add_argument('--batch-size', type=int, default=16, help='배치 크기')
    parser.add_argument('--no-test', action='store_true', help='모델 테스트 건너뛰기')
    parser.add_argument('--check-only', action='store_true', help='사전 요구사항만 확인')
    
    args = parser.parse_args()
    
    # 파이프라인 초기화
    pipeline = LegoYOLOEnhancedPipeline()
    
    # 사전 요구사항만 확인하는 경우
    if args.check_only:
        success = pipeline.check_prerequisites()
        sys.exit(0 if success else 1)
    
    # 전체 파이프라인 실행
    success = pipeline.run_full_pipeline(
        device=args.device,
        epochs=args.epochs,
        batch_size=args.batch_size,
        test_model=not args.no_test
    )
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
