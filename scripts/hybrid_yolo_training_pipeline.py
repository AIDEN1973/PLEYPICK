#!/usr/bin/env python3
"""
🚀 BrickBox 2단계 하이브리드 YOLO11s-seg 학습 파이프라인

1차: YOLO11n-seg 학습 (빠른 스캔용)
2차: YOLO11s-seg 학습 (정밀 검증용)

특징:
- 하이브리드 모델 동시 학습
- 성능 기반 모델 선택
- 자동 ONNX 변환
- Supabase 모델 레지스트리 업데이트
"""

import os
import sys
import json
import time
import shutil
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class HybridYOLOTrainingPipeline:
    """2단계 하이브리드 YOLO 학습 파이프라인"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.models_dir = self.project_root / 'public' / 'models'
        self.output_dir = self.project_root / 'output' / 'hybrid_training'
        self.training_results = {}
        
        # Supabase 설정
        self.supabase_url = os.getenv('VITE_SUPABASE_URL')
        self.supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase 환경 변수가 설정되지 않았습니다.")
    
    def initialize_training_environment(self):
        """학습 환경 초기화"""
        try:
            logger.info("🚀 하이브리드 YOLO 학습 환경 초기화...")
            
            # 출력 디렉토리 생성
            self.output_dir.mkdir(parents=True, exist_ok=True)
            
            # 모델 디렉토리 생성
            self.models_dir.mkdir(parents=True, exist_ok=True)
            
            # Ultralytics 설치 확인
            try:
                from ultralytics import YOLO
                logger.info("✅ Ultralytics 설치 확인 완료")
            except ImportError:
                logger.error("❌ Ultralytics가 설치되지 않았습니다.")
                raise
            
            logger.info("✅ 학습 환경 초기화 완료")
            
        except Exception as e:
            logger.error(f"❌ 학습 환경 초기화 실패: {e}")
            raise
    
    def prepare_hybrid_dataset(self, dataset_path: str) -> Dict[str, str]:
        """하이브리드 학습용 데이터셋 준비"""
        try:
            logger.info("📊 하이브리드 데이터셋 준비...")
            
            dataset_path = Path(dataset_path)
            
            # Train/Val 분할 확인
            train_images = dataset_path / 'train' / 'images'
            train_labels = dataset_path / 'train' / 'labels'
            val_images = dataset_path / 'val' / 'images'
            val_labels = dataset_path / 'val' / 'labels'
            
            if not all([train_images.exists(), train_labels.exists(), 
                       val_images.exists(), val_labels.exists()]):
                raise ValueError("Train/Val 분할된 데이터셋이 필요합니다.")
            
            # 데이터셋 통계
            train_count = len(list(train_images.glob('*.jpg')))
            val_count = len(list(val_images.glob('*.jpg')))
            
            logger.info(f"📊 데이터셋 통계:")
            logger.info(f"   - 학습 데이터: {train_count}개")
            logger.info(f"   - 검증 데이터: {val_count}개")
            logger.info(f"   - 총 데이터: {train_count + val_count}개")
            
            # dataset.yaml 생성
            dataset_config = {
                'path': str(dataset_path),
                'train': 'train/images',
                'val': 'val/images',
                'nc': 1,
                'names': ['lego_part']
            }
            
            yaml_path = dataset_path / 'dataset.yaml'
            with open(yaml_path, 'w') as f:
                import yaml
                yaml.dump(dataset_config, f, default_flow_style=False)
            
            logger.info(f"✅ dataset.yaml 생성: {yaml_path}")
            
            return {
                'dataset_path': str(dataset_path),
                'yaml_path': str(yaml_path),
                'train_count': train_count,
                'val_count': val_count
            }
            
        except Exception as e:
            logger.error(f"❌ 데이터셋 준비 실패: {e}")
            raise
    
    def train_stage1_model(self, dataset_info: Dict) -> Dict:
        """1차 모델 학습 (YOLO11n-seg)"""
        try:
            logger.info("🔧 1차 모델 학습 시작 (YOLO11n-seg)...")
            
            from ultralytics import YOLO
            import torch
            
            # YOLO11n-seg 모델 초기화
            model = YOLO('yolo11n-seg.pt')
            
            # 학습 설정
            training_name = f'brickbox_hybrid_stage1_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
            
            # 학습 실행
            results = model.train(
                data=dataset_info['yaml_path'],
                epochs=100,
                batch=16,
                imgsz=640,
                device='cuda' if torch.cuda.is_available() else 'cpu',
                project=str(self.output_dir),
                name=training_name,
                save=True,
                plots=True,
                val=True,
                patience=10,
                save_period=10
            )
            
            # 학습 결과 저장
            stage1_results = {
                'model_name': 'yolo11n-seg',
                'model_stage': 'stage1',
                'training_name': training_name,
                'best_model_path': str(self.output_dir / training_name / 'weights' / 'best.pt'),
                'last_model_path': str(self.output_dir / training_name / 'weights' / 'last.pt'),
                'metrics': {
                    'mAP50': float(results.results_dict.get('metrics/mAP50(B)', 0.0)),
                    'mAP50_95': float(results.results_dict.get('metrics/mAP50-95(B)', 0.0)),
                    'precision': float(results.results_dict.get('metrics/precision(B)', 0.0)),
                    'recall': float(results.results_dict.get('metrics/recall(B)', 0.0))
                },
                'training_time': results.results_dict.get('training_time', 0),
                'epochs_completed': results.results_dict.get('epochs', 0)
            }
            
            logger.info(f"✅ 1차 모델 학습 완료: {training_name}")
            logger.info(f"   - mAP50: {stage1_results['metrics']['mAP50']:.4f}")
            logger.info(f"   - mAP50-95: {stage1_results['metrics']['mAP50_95']:.4f}")
            
            return stage1_results
            
        except Exception as e:
            logger.error(f"❌ 1차 모델 학습 실패: {e}")
            raise
    
    def train_stage2_model(self, dataset_info: Dict) -> Dict:
        """2차 모델 학습 (YOLO11s-seg)"""
        try:
            logger.info("🔧 2차 모델 학습 시작 (YOLO11s-seg)...")
            
            from ultralytics import YOLO
            import torch
            
            # YOLO11s-seg 모델 초기화
            model = YOLO('yolo11s-seg.pt')
            
            # 학습 설정
            training_name = f'brickbox_hybrid_stage2_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
            
            # 학습 실행
            results = model.train(
                data=dataset_info['yaml_path'],
                epochs=100,
                batch=16,
                imgsz=640,
                device='cuda' if torch.cuda.is_available() else 'cpu',
                project=str(self.output_dir),
                name=training_name,
                save=True,
                plots=True,
                val=True,
                patience=10,
                save_period=10
            )
            
            # 학습 결과 저장
            stage2_results = {
                'model_name': 'yolo11s-seg',
                'model_stage': 'stage2',
                'training_name': training_name,
                'best_model_path': str(self.output_dir / training_name / 'weights' / 'best.pt'),
                'last_model_path': str(self.output_dir / training_name / 'weights' / 'last.pt'),
                'metrics': {
                    'mAP50': float(results.results_dict.get('metrics/mAP50(B)', 0.0)),
                    'mAP50_95': float(results.results_dict.get('metrics/mAP50-95(B)', 0.0)),
                    'precision': float(results.results_dict.get('metrics/precision(B)', 0.0)),
                    'recall': float(results.results_dict.get('metrics/recall(B)', 0.0))
                },
                'training_time': results.results_dict.get('training_time', 0),
                'epochs_completed': results.results_dict.get('epochs', 0)
            }
            
            logger.info(f"✅ 2차 모델 학습 완료: {training_name}")
            logger.info(f"   - mAP50: {stage2_results['metrics']['mAP50']:.4f}")
            logger.info(f"   - mAP50-95: {stage2_results['metrics']['mAP50_95']:.4f}")
            
            return stage2_results
            
        except Exception as e:
            logger.error(f"❌ 2차 모델 학습 실패: {e}")
            raise
    
    def convert_to_onnx(self, model_results: Dict) -> str:
        """PyTorch 모델을 ONNX로 변환"""
        try:
            logger.info(f"🔄 ONNX 변환 시작: {model_results['model_name']}")
            
            from ultralytics import YOLO
            
            # 모델 로드
            model = YOLO(model_results['best_model_path'])
            
            # ONNX 변환
            onnx_path = model.export(
                format='onnx',
                imgsz=640,
                optimize=True,
                half=True,  # FP16 최적화
                dynamic=False,
                simplify=True
            )
            
            logger.info(f"✅ ONNX 변환 완료: {onnx_path}")
            return onnx_path
            
        except Exception as e:
            logger.error(f"❌ ONNX 변환 실패: {e}")
            raise
    
    def deploy_models(self, stage1_results: Dict, stage2_results: Dict):
        """학습된 모델 배포"""
        try:
            logger.info("🚀 하이브리드 모델 배포 시작...")
            
            # ONNX 변환
            stage1_onnx = self.convert_to_onnx(stage1_results)
            stage2_onnx = self.convert_to_onnx(stage2_results)
            
            # 모델 파일 복사
            stage1_dest = self.models_dir / 'yolo11n-seg.onnx'
            stage2_dest = self.models_dir / 'yolo11s-seg.onnx'
            
            shutil.copy2(stage1_onnx, stage1_dest)
            shutil.copy2(stage2_onnx, stage2_dest)
            
            logger.info(f"✅ 모델 배포 완료:")
            logger.info(f"   - 1차 모델: {stage1_dest}")
            logger.info(f"   - 2차 모델: {stage2_dest}")
            
            return {
                'stage1_onnx': str(stage1_dest),
                'stage2_onnx': str(stage2_dest)
            }
            
        except Exception as e:
            logger.error(f"❌ 모델 배포 실패: {e}")
            raise
    
    def update_model_registry(self, stage1_results: Dict, stage2_results: Dict, deployment_info: Dict):
        """모델 레지스트리 업데이트"""
        try:
            logger.info("📊 모델 레지스트리 업데이트...")
            
            import requests
            
            headers = {
                'apikey': self.supabase_key,
                'Authorization': f'Bearer {self.supabase_key}',
                'Content-Type': 'application/json'
            }
            
            # 1차 모델 등록
            stage1_data = {
                'model_name': 'yolo11n-seg',
                'model_version': '1.0.0',
                'model_type': 'segmentation',
                'model_stage': 'stage1',
                'model_path': deployment_info['stage1_onnx'],
                'pt_model_path': stage1_results['best_model_path'],
                'performance_metrics': stage1_results['metrics'],
                'segmentation_support': True,
                'memory_usage': 2000,  # 2GB
                'fps_performance': 50.0,
                'model_size_mb': 5.2,
                'hybrid_config': {
                    'conf_threshold': 0.3,
                    'max_detections': 50,
                    'input_size': 640
                },
                'is_active': True,
                'training_metadata': {
                    'training_name': stage1_results['training_name'],
                    'epochs_completed': stage1_results['epochs_completed'],
                    'training_time': stage1_results['training_time']
                }
            }
            
            # 2차 모델 등록
            stage2_data = {
                'model_name': 'yolo11s-seg',
                'model_version': '1.0.0',
                'model_type': 'segmentation',
                'model_stage': 'stage2',
                'model_path': deployment_info['stage2_onnx'],
                'pt_model_path': stage2_results['best_model_path'],
                'performance_metrics': stage2_results['metrics'],
                'segmentation_support': True,
                'memory_usage': 4000,  # 4GB
                'fps_performance': 27.5,
                'model_size_mb': 21.5,
                'hybrid_config': {
                    'conf_threshold': 0.5,
                    'max_detections': 20,
                    'input_size': 640
                },
                'is_active': True,
                'training_metadata': {
                    'training_name': stage2_results['training_name'],
                    'epochs_completed': stage2_results['epochs_completed'],
                    'training_time': stage2_results['training_time']
                }
            }
            
            # Supabase에 모델 등록
            for model_data in [stage1_data, stage2_data]:
                response = requests.post(
                    f'{self.supabase_url}/rest/v1/model_registry',
                    headers=headers,
                    json=model_data
                )
                
                if response.status_code not in [200, 201]:
                    logger.warning(f"⚠️ 모델 등록 실패: {model_data['model_name']}")
                else:
                    logger.info(f"✅ 모델 등록 완료: {model_data['model_name']}")
            
            # 활성 하이브리드 모델 설정
            self.set_active_hybrid_models()
            
            logger.info("✅ 모델 레지스트리 업데이트 완료")
            
        except Exception as e:
            logger.error(f"❌ 모델 레지스트리 업데이트 실패: {e}")
            raise
    
    def set_active_hybrid_models(self):
        """활성 하이브리드 모델 설정"""
        try:
            import requests
            
            headers = {
                'apikey': self.supabase_key,
                'Authorization': f'Bearer {self.supabase_key}',
                'Content-Type': 'application/json'
            }
            
            # 활성 모델 설정
            active_data = {
                'hybrid_mode': True,
                'stage1_config': {
                    'enabled': True,
                    'auto_load': True,
                    'conf_threshold': 0.3,
                    'max_detections': 50
                },
                'stage2_config': {
                    'enabled': True,
                    'auto_load': False,
                    'trigger_threshold': 0.3,
                    'conf_threshold': 0.5,
                    'max_detections': 20
                }
            }
            
            response = requests.patch(
                f'{self.supabase_url}/rest/v1/active_models',
                headers=headers,
                json=active_data
            )
            
            if response.status_code in [200, 201]:
                logger.info("✅ 활성 하이브리드 모델 설정 완료")
            else:
                logger.warning("⚠️ 활성 모델 설정 실패")
                
        except Exception as e:
            logger.error(f"❌ 활성 모델 설정 실패: {e}")
    
    def run_hybrid_training(self, dataset_path: str):
        """하이브리드 학습 전체 실행"""
        try:
            logger.info("🚀 BrickBox 하이브리드 YOLO 학습 시작")
            
            # 1. 환경 초기화
            self.initialize_training_environment()
            
            # 2. 데이터셋 준비
            dataset_info = self.prepare_hybrid_dataset(dataset_path)
            
            # 3. 1차 모델 학습
            stage1_results = self.train_stage1_model(dataset_info)
            
            # 4. 2차 모델 학습
            stage2_results = self.train_stage2_model(dataset_info)
            
            # 5. 모델 배포
            deployment_info = self.deploy_models(stage1_results, stage2_results)
            
            # 6. 모델 레지스트리 업데이트
            self.update_model_registry(stage1_results, stage2_results, deployment_info)
            
            # 7. 결과 저장
            self.training_results = {
                'stage1': stage1_results,
                'stage2': stage2_results,
                'deployment': deployment_info,
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info("🎉 하이브리드 YOLO 학습 완료!")
            logger.info(f"   - 1차 모델 mAP50: {stage1_results['metrics']['mAP50']:.4f}")
            logger.info(f"   - 2차 모델 mAP50: {stage2_results['metrics']['mAP50']:.4f}")
            
            return self.training_results
            
        except Exception as e:
            logger.error(f"❌ 하이브리드 학습 실패: {e}")
            raise

def main():
    """메인 실행 함수"""
    if len(sys.argv) < 2:
        print("사용법: python hybrid_yolo_training_pipeline.py <dataset_path>")
        sys.exit(1)
    
    dataset_path = sys.argv[1]
    
    try:
        pipeline = HybridYOLOTrainingPipeline()
        results = pipeline.run_hybrid_training(dataset_path)
        
        print("✅ 하이브리드 학습 완료!")
        print(f"결과: {json.dumps(results, indent=2, ensure_ascii=False)}")
        
    except Exception as e:
        logger.error(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
