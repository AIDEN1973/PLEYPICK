#!/usr/bin/env python3
"""
🧱 BrickBox 레고 YOLO 학습 통합 파이프라인

렌더링 완료 후 전체 YOLO 학습 프로세스를 자동화하는 통합 스크립트
1. 데이터셋 준비
2. YOLO 모델 학습
3. 모델 검증
4. 모델 배포
5. 성능 테스트
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import argparse

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

# 하위 스크립트 import
try:
    from prepare_yolo_dataset import YOLODatasetPreparer
    from train_yolo_lego import LegoYOLOTrainer
    from deploy_yolo_model import YOLOModelDeployer
    SCRIPTS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ 하위 스크립트를 찾을 수 없습니다: {e}")
    SCRIPTS_AVAILABLE = False

class LegoYOLOTrainingPipeline:
    """레고 YOLO 학습 통합 파이프라인"""
    
    def __init__(self, config_path: str = None):
        self.project_root = project_root
        self.pipeline_dir = project_root / "output" / "pipeline"
        self.config_path = config_path
        
        # 로깅 설정
        self.setup_logging()
        
        # 디렉토리 생성
        self.create_directories()
        
        # 설정 로드
        self.config = self.load_config()
    
    def setup_logging(self):
        """로깅 설정"""
        log_dir = self.pipeline_dir / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def create_directories(self):
        """필요한 디렉토리 생성"""
        directories = [
            self.pipeline_dir,
            self.pipeline_dir / "logs",
            self.pipeline_dir / "results"
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            self.logger.info(f"📁 디렉토리 생성: {directory}")
    
    def load_config(self) -> Dict:
        """파이프라인 설정 로드"""
        default_config = {
            'dataset': {
                'output_dir': str(project_root / "output" / "synthetic"),
                'train_ratio': 0.8,
                'val_ratio': 0.1,
                'test_ratio': 0.1,
                'min_images_per_part': 10,
                'max_images_per_part': 1000
            },
            'training': {
                'epochs': 100,
                'batch_size': 16,
                'imgsz': 640,
                'device': 'auto',
                'patience': 10,
                'save_period': 10
            },
            'deployment': {
                'model_name': 'lego_yolo_custom',
                'backup_existing': True,
                'test_deployed': True
            },
            'pipeline': {
                'skip_dataset_prep': False,
                'skip_training': False,
                'skip_deployment': False,
                'continue_on_error': False
            }
        }
        
        if self.config_path and Path(self.config_path).exists():
            with open(self.config_path, 'r', encoding='utf-8') as f:
                import yaml
                user_config = yaml.safe_load(f)
                self.update_config(default_config, user_config)
        
        return default_config
    
    def update_config(self, base_config: Dict, user_config: Dict):
        """설정 업데이트 (재귀적)"""
        for key, value in user_config.items():
            if key in base_config and isinstance(base_config[key], dict) and isinstance(value, dict):
                self.update_config(base_config[key], value)
            else:
                base_config[key] = value
    
    def check_prerequisites(self) -> Tuple[bool, List[str]]:
        """사전 요구사항 확인"""
        self.logger.info("🔍 사전 요구사항 확인...")
        
        issues = []
        
        # 1. 하위 스크립트 확인
        if not SCRIPTS_AVAILABLE:
            issues.append("하위 스크립트를 찾을 수 없습니다")
        
        # 2. 렌더링된 데이터 확인
        dataset_dir = Path(self.config['dataset']['output_dir'])
        if not dataset_dir.exists():
            issues.append(f"렌더링된 데이터 디렉토리가 없습니다: {dataset_dir}")
        else:
            # 이미지 파일 확인
            image_files = list(dataset_dir.rglob("*.webp"))
            if not image_files:
                issues.append("렌더링된 WebP 이미지가 없습니다")
            else:
                self.logger.info(f"📊 발견된 이미지: {len(image_files)}개")
        
        # 3. 필요한 패키지 확인
        try:
            import ultralytics
            self.logger.info("✅ ultralytics 패키지 확인")
        except ImportError:
            issues.append("ultralytics 패키지가 설치되지 않았습니다")
        
        try:
            import torch
            self.logger.info("✅ PyTorch 패키지 확인")
        except ImportError:
            issues.append("PyTorch 패키지가 설치되지 않았습니다")
        
        # 4. GPU 가용성 확인
        try:
            import torch
            if torch.cuda.is_available():
                gpu_count = torch.cuda.device_count()
                self.logger.info(f"🚀 GPU 사용 가능: {gpu_count}개")
            else:
                self.logger.warning("⚠️ GPU를 사용할 수 없습니다. CPU로 학습합니다")
        except:
            pass
        
        success = len(issues) == 0
        if success:
            self.logger.info("✅ 모든 사전 요구사항 충족")
        else:
            self.logger.error(f"❌ 사전 요구사항 실패: {issues}")
        
        return success, issues
    
    def prepare_dataset(self) -> Dict:
        """1단계: 데이터셋 준비"""
        self.logger.info("📊 1단계: 데이터셋 준비 시작...")
        
        try:
            preparer = YOLODatasetPreparer(self.config['dataset']['output_dir'])
            
            results = preparer.prepare_dataset(
                train_ratio=self.config['dataset']['train_ratio'],
                val_ratio=self.config['dataset']['val_ratio'],
                test_ratio=self.config['dataset']['test_ratio']
            )
            
            if results['success']:
                self.logger.info("✅ 데이터셋 준비 완료")
            else:
                self.logger.error(f"❌ 데이터셋 준비 실패: {results.get('error', 'Unknown error')}")
            
            return results
            
        except Exception as e:
            self.logger.error(f"❌ 데이터셋 준비 실패: {e}")
            return {'success': False, 'error': str(e)}
    
    def train_model(self) -> Dict:
        """2단계: YOLO 모델 학습"""
        self.logger.info("🚀 2단계: YOLO 모델 학습 시작...")
        
        try:
            trainer = LegoYOLOTrainer()
            
            results = trainer.run_full_pipeline()
            
            if results['success']:
                self.logger.info("✅ YOLO 모델 학습 완료")
            else:
                self.logger.error(f"❌ YOLO 모델 학습 실패: {results.get('error', 'Unknown error')}")
            
            return results
            
        except Exception as e:
            self.logger.error(f"❌ YOLO 모델 학습 실패: {e}")
            return {'success': False, 'error': str(e)}
    
    def deploy_model(self, model_path: str = None) -> Dict:
        """3단계: 모델 배포"""
        self.logger.info("🚀 3단계: 모델 배포 시작...")
        
        try:
            deployer = YOLOModelDeployer()
            
            results = deployer.run_deployment_pipeline(
                model_path=model_path,
                model_name=self.config['deployment']['model_name']
            )
            
            if results['success']:
                self.logger.info("✅ 모델 배포 완료")
            else:
                self.logger.error(f"❌ 모델 배포 실패: {results.get('error', 'Unknown error')}")
            
            return results
            
        except Exception as e:
            self.logger.error(f"❌ 모델 배포 실패: {e}")
            return {'success': False, 'error': str(e)}
    
    def run_full_pipeline(self) -> Dict:
        """전체 학습 파이프라인 실행"""
        self.logger.info("🎯 레고 YOLO 학습 통합 파이프라인 시작...")
        
        pipeline_results = {
            'start_time': datetime.now(),
            'prerequisites': None,
            'dataset_preparation': None,
            'training': None,
            'deployment': None,
            'success': False,
            'total_time': None,
            'error': None
        }
        
        start_time = time.time()
        
        try:
            # 0. 사전 요구사항 확인
            self.logger.info("🔍 0단계: 사전 요구사항 확인")
            prereq_success, prereq_issues = self.check_prerequisites()
            pipeline_results['prerequisites'] = {
                'success': prereq_success,
                'issues': prereq_issues
            }
            
            if not prereq_success:
                raise ValueError(f"사전 요구사항 실패: {prereq_issues}")
            
            # 1. 데이터셋 준비
            if not self.config['pipeline']['skip_dataset_prep']:
                self.logger.info("📊 1단계: 데이터셋 준비")
                dataset_results = self.prepare_dataset()
                pipeline_results['dataset_preparation'] = dataset_results
                
                if not dataset_results['success']:
                    if not self.config['pipeline']['continue_on_error']:
                        raise ValueError(f"데이터셋 준비 실패: {dataset_results.get('error', 'Unknown error')}")
                    else:
                        self.logger.warning("⚠️ 데이터셋 준비 실패했지만 계속 진행합니다")
            else:
                self.logger.info("⏭️ 데이터셋 준비 단계 건너뛰기")
                pipeline_results['dataset_preparation'] = {'success': True, 'skipped': True}
            
            # 2. 모델 학습
            if not self.config['pipeline']['skip_training']:
                self.logger.info("🚀 2단계: YOLO 모델 학습")
                training_results = self.train_model()
                pipeline_results['training'] = training_results
                
                if not training_results['success']:
                    if not self.config['pipeline']['continue_on_error']:
                        raise ValueError(f"모델 학습 실패: {training_results.get('error', 'Unknown error')}")
                    else:
                        self.logger.warning("⚠️ 모델 학습 실패했지만 계속 진행합니다")
            else:
                self.logger.info("⏭️ 모델 학습 단계 건너뛰기")
                pipeline_results['training'] = {'success': True, 'skipped': True}
            
            # 3. 모델 배포
            if not self.config['pipeline']['skip_deployment']:
                self.logger.info("🚀 3단계: 모델 배포")
                
                # 학습된 모델 경로 찾기
                model_path = None
                if pipeline_results['training'] and pipeline_results['training'].get('training'):
                    model_path = pipeline_results['training']['training'].get('model_path')
                
                deployment_results = self.deploy_model(model_path)
                pipeline_results['deployment'] = deployment_results
                
                if not deployment_results['success']:
                    if not self.config['pipeline']['continue_on_error']:
                        raise ValueError(f"모델 배포 실패: {deployment_results.get('error', 'Unknown error')}")
                    else:
                        self.logger.warning("⚠️ 모델 배포 실패했지만 파이프라인을 완료합니다")
            else:
                self.logger.info("⏭️ 모델 배포 단계 건너뛰기")
                pipeline_results['deployment'] = {'success': True, 'skipped': True}
            
            pipeline_results['success'] = True
            pipeline_results['end_time'] = datetime.now()
            pipeline_results['total_time'] = time.time() - start_time
            
            self.logger.info("🎉 전체 학습 파이프라인 완료!")
            self.logger.info(f"⏱️ 총 소요 시간: {pipeline_results['total_time']:.2f}초")
            
        except Exception as e:
            pipeline_results['error'] = str(e)
            pipeline_results['end_time'] = datetime.now()
            pipeline_results['total_time'] = time.time() - start_time
            self.logger.error(f"❌ 학습 파이프라인 실패: {e}")
        
        # 결과 저장
        results_file = self.pipeline_dir / f"pipeline_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(pipeline_results, f, indent=2, ensure_ascii=False, default=str)
        
        self.logger.info(f"📊 파이프라인 결과 저장: {results_file}")
        
        return pipeline_results

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='레고 YOLO 학습 통합 파이프라인')
    parser.add_argument('--config', type=str, help='설정 파일 경로')
    parser.add_argument('--skip-dataset', action='store_true', help='데이터셋 준비 단계 건너뛰기')
    parser.add_argument('--skip-training', action='store_true', help='모델 학습 단계 건너뛰기')
    parser.add_argument('--skip-deployment', action='store_true', help='모델 배포 단계 건너뛰기')
    parser.add_argument('--continue-on-error', action='store_true', help='오류 발생 시에도 계속 진행')
    parser.add_argument('--check-prerequisites', action='store_true', help='사전 요구사항만 확인')
    
    args = parser.parse_args()
    
    # 파이프라인 초기화
    pipeline = LegoYOLOTrainingPipeline(args.config)
    
    # 설정 업데이트
    if args.skip_dataset:
        pipeline.config['pipeline']['skip_dataset_prep'] = True
    if args.skip_training:
        pipeline.config['pipeline']['skip_training'] = True
    if args.skip_deployment:
        pipeline.config['pipeline']['skip_deployment'] = True
    if args.continue_on_error:
        pipeline.config['pipeline']['continue_on_error'] = True
    
    try:
        if args.check_prerequisites:
            # 사전 요구사항만 확인
            success, issues = pipeline.check_prerequisites()
            print(f"사전 요구사항 확인: {'성공' if success else '실패'}")
            if issues:
                print("발견된 문제점:")
                for issue in issues:
                    print(f"  - {issue}")
            
        else:
            # 전체 파이프라인 실행
            results = pipeline.run_full_pipeline()
            print("학습 파이프라인 결과:")
            print(json.dumps(results, indent=2, ensure_ascii=False))
            
    except Exception as e:
        print(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
